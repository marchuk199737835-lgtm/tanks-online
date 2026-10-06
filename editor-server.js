/* =====================================================================
 * editor-server.js — серверна частина редактора мап (окремий файл).
 *  - вхід за паролем адміна (перевіряється на сервері, пароль не лежить у клієнтському коді)
 *  - збереження / видалення / читання мап (MongoDB, а якщо її немає — файл data/custom_maps.json)
 *  - /mapdata.js — віддає клієнтам мапи, змінені в редакторі
 * Зміни мап застосовуються після перезапуску сервера.
 * Пароль можна змінити змінною середовища EDITOR_PASSWORD (за замовчуванням 20062007).
 * ===================================================================== */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MapObj = require('./public/js/mapobjects.js');

const NAME_RE = /^[\p{L}\p{N} _\-]{1,32}$/u;
const MAX_BODY = 8 * 1024 * 1024;

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }

module.exports = function mountEditor(app, ctx) {
    // ctx: { MAP_DATA, getMapsCol: () => collection|null, dataDir?: string }
    const MAP_DATA = ctx.MAP_DATA;
    const BUILTIN = JSON.parse(JSON.stringify(MAP_DATA));              // знімок вбудованих мап до накладання змін
    const dataDir = ctx.dataDir || path.join(__dirname, 'data'), filePath = path.join(dataDir, 'custom_maps.json');
    const PASSWORD_HASH = sha(process.env.EDITOR_PASSWORD || '20062007');
    // Вбудовані мапи прибрано з гри: вони лишаються в редакторі як шаблони, а гравцям показуються лише мапи, збережені в редакторі.
    // Якщо жодної збереженої мапи ще немає — вбудовані лишаються, щоб гра не залишилась без мап.
    // Змінна середовища SHOW_BUILTIN_MAPS=1 повертає їх у гру.
    const HIDDEN_BUILTIN = ['epic_map', 'Бій Насмерть'];
    let hidden = [];
    function hideBuiltin() {
        hidden = [];
        if (process.env.SHOW_BUILTIN_MAPS === '1') return;
        const playable = Object.keys(MAP_DATA).filter(k => !HIDDEN_BUILTIN.includes(k) || saved[k]);
        if (!playable.length) { console.warn('⚠️  У редакторі ще немає збережених мап — вбудовані мапи лишаються в грі. Створіть мапу в /editor.html'); return; }
        HIDDEN_BUILTIN.forEach(n => { if (MAP_DATA[n] && !saved[n]) { delete MAP_DATA[n]; hidden.push(n); } });
        console.log('🗺️  Вбудовані мапи прибрано з гри: ' + hidden.join(', '));
    }
    let saved = Object.create(null);          // що збережено (в БД/файлі)
    let applied = Object.create(null);        // що застосоване при старті (те, що бачать гравці)
    const attempts = Object.create(null);     // ip -> {n, until}

    const checkPwd = (p) => typeof p === 'string' && p.length < 200 && crypto.timingSafeEqual(sha(p), PASSWORD_HASH);
    const ipOf = (req) => (req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'ip').toString().split(',')[0].trim();

    // ---------- сховище ----------
    function readFileStore() { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (e) { return {}; } }
    function writeFileStore(obj) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(obj)); }
    async function persistSave(name, map) {
        const col = ctx.getMapsCol && ctx.getMapsCol();
        if (col) await col.updateOne({ _id: name }, { $set: { map: map, updated: Date.now() } }, { upsert: true });
        else { const o = readFileStore(); o[name] = map; writeFileStore(o); }
    }
    async function persistRemove(name) {
        const col = ctx.getMapsCol && ctx.getMapsCol();
        if (col) await col.deleteOne({ _id: name });
        else { const o = readFileStore(); delete o[name]; writeFileStore(o); }
    }
    // Викликається при старті сервера (після підключення до MongoDB): підтягує мапи та накладає їх на MAP_DATA
    async function loadSaved() {
        const col = ctx.getMapsCol && ctx.getMapsCol();
        let data = {};
        if (col) (await col.find({}).toArray()).forEach(d => { data[d._id] = d.map; });
        else data = readFileStore();
        let n = 0;
        Object.keys(data).forEach(name => {
            try {
                if (!NAME_RE.test(name)) return;
                const m = MapObj.sanitizeMap(data[name]);
                saved[name] = m; applied[name] = m; MAP_DATA[name] = m; n++;
            } catch (e) { console.error('⚠️  Мапа "' + name + '" пропущена:', e.message); }
        });
        if (n) console.log('🗺️  Завантажено мап з редактора: ' + n);
        hideBuiltin();
    }

    // ---------- допоміжне ----------
    function send(res, code, obj, type) {
        const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
        res.statusCode = code; res.setHeader('Content-Type', type || 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.end(body);
    }
    function readBody(req) {
        return new Promise((resolve, reject) => {
            let size = 0; const chunks = [];
            req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Запит завеликий')); req.destroy(); } else chunks.push(c); });
            req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (e) { reject(new Error('Некоректний JSON')); } });
            req.on('error', reject);
        });
    }
    function throttled(req) { const a = attempts[ipOf(req)]; return a && a.until > Date.now(); }
    function fail(req) { const k = ipOf(req), a = attempts[k] || (attempts[k] = { n: 0, until: 0 }); a.n++; if (a.n >= 8) { a.until = Date.now() + 10 * 60 * 1000; a.n = 0; } }
    function ok(req) { delete attempts[ipOf(req)]; }

    // ---------- /mapdata.js для клієнтів ----------
    app.get('/mapdata.js', (req, res) => {
        send(res, 200, '(function(){var d=' + JSON.stringify(applied).replace(/</g, '\\u003c') + ';var h=' + JSON.stringify(hidden) + ';for(var k in d){MAP_DATA[k]=d[k];}h.forEach(function(k){delete MAP_DATA[k];});if(window.onMapDataLoaded)window.onMapDataLoaded();})();', 'application/javascript; charset=utf-8');
    });

    // ---------- API редактора ----------
    app.use('/api/editor', async (req, res) => {
        try {
            const url = decodeURIComponent((req.url || '/').split('?')[0]);
            if (req.method === 'POST' && url === '/login') {
                if (throttled(req)) return send(res, 429, { error: 'Забагато спроб. Зачекайте 10 хвилин.' });
                const b = await readBody(req);
                if (checkPwd(b.password)) { ok(req); return send(res, 200, { ok: true }); }
                fail(req); return send(res, 401, { error: 'Невірний пароль' });
            }
            // усе інше — лише з паролем у заголовку
            if (throttled(req)) return send(res, 429, { error: 'Забагато спроб. Зачекайте 10 хвилин.' });
            if (!checkPwd(req.headers['x-editor-password'])) { fail(req); return send(res, 401, { error: 'Потрібен пароль адміна' }); }

            if (req.method === 'GET' && url === '/maps') {
                const maps = {}, info = {};
                Object.keys(BUILTIN).concat(Object.keys(saved)).forEach(n => {
                    if (maps[n]) return;
                    maps[n] = saved[n] || BUILTIN[n];
                    info[n] = { builtin: !!BUILTIN[n], hidden: hidden.includes(n), saved: !!saved[n], pending: JSON.stringify(saved[n] || null) !== JSON.stringify(applied[n] || null) };
                });
                return send(res, 200, { maps: maps, info: info });
            }
            const m = /^\/maps\/(.+)$/.exec(url);
            if (m) {
                const name = m[1];
                if (!NAME_RE.test(name)) return send(res, 400, { error: 'Некоректна назва мапи (літери, цифри, пробіл, _ та -, до 32 символів)' });
                if (req.method === 'PUT') {
                    const b = await readBody(req);
                    const clean = MapObj.sanitizeMap(b.map);
                    await persistSave(name, clean); saved[name] = clean;
                    return send(res, 200, { ok: true, name: name, objects: clean.solids.length });
                }
                if (req.method === 'DELETE') {
                    await persistRemove(name); delete saved[name];
                    return send(res, 200, { ok: true });
                }
            }
            send(res, 404, { error: 'Не знайдено' });
        } catch (e) { send(res, 400, { error: e.message || 'Помилка' }); }
    });

    return { loadSaved, BUILTIN, _state: () => ({ saved, applied }) };
};
