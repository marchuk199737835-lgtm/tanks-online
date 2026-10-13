/* admin.js — адмін-панель (сервер). Усе — через уже відкритий сокет гри (жодних HTTP-адрес, які можна сканувати).
 *
 * ЗАХИСТ (усі умови разом):
 *  1. Змінна ADMIN_USERS — логіни акаунтів-адмінів через кому. Порожня → панель повністю вимкнена.
 *  2. Гравець має бути ВЖЕ увійшов у гру саме цим акаунтом (сесія сокета).
 *  3. Окремий пароль адміна ADMIN_PASSWORD (не пароль акаунта). Порівняння через scrypt + timingSafeEqual.
 *  4. ADMIN_TOTP (рекомендовано!) — секрет Base32 для Google Authenticator / Authy: 6-значний код, що змінюється кожні 30 с; повтор коду заборонено.
 *  5. 5 невдалих спроб з акаунта/мережі → блок на 30 хв; 20 невдалих спроб за 10 хв загалом → вхід в адмінку закрито для всіх на 15 хв.
 *  6. Сесія адміна — лише для цього сокета: 20 хв бездіяльності або 2 год максимум; кожна дія перевіряє сесію наново.
 *  7. Відповіді «Доступ заборонено» однакові для всіх причин (не видно, чи акаунт — адмін). Усі дії пишуться в журнал (пам'ять + консоль сервера).
 *
 * Можливості: статистика онлайну/сервера/БД · пошук гравця · бан (з причиною й терміном) / розбан · вигнати з гри · видати кредити або кейс ·
 *             подія (множник кредитів/досвіду для всіх або одного режиму, з таймером) · оголошення всім гравцям · журнал дій ·
 *             промокоди (список з лічильниками активацій, створення, редагування, вимкнення, видалення; зберігаються в meta/promos).
 * Подія зберігається в MongoDB (meta/event) лише при зміні — 1 запис. */
'use strict';
const crypto = require('crypto');

module.exports = function (ctx) {
    const { io, rooms, dbUsers, Events, GameData, ModeInfo, saveUser } = ctx;
    const ADMINS = new Set(String(process.env.ADMIN_USERS || '').split(',').map(s => s.trim()).filter(Boolean));
    const PASS = process.env.ADMIN_PASSWORD || '', TOTP = String(process.env.ADMIN_TOTP || '').replace(/\s+/g, '').toUpperCase();
    const ENABLED = ADMINS.size > 0 && PASS.length >= 10;
    if (!ENABLED) console.log('🔒 Адмін-панель вимкнена (задайте ADMIN_USERS і ADMIN_PASSWORD ≥ 10 символів' + (TOTP ? '' : ', бажано ще ADMIN_TOTP') + ')');
    else console.log('🔐 Адмін-панель увімкнена для ' + ADMINS.size + ' акаунт(ів)' + (TOTP ? ' з 2FA' : ' БЕЗ 2FA — рекомендуємо задати ADMIN_TOTP'));
    const SALT = crypto.randomBytes(16), PASS_H = ENABLED ? crypto.scryptSync(PASS, SALT, 32) : null;
    const LOG = [], log = (by, act, target, detail) => { const e = { t: Date.now(), by, act, target: target || '', detail: detail || '' }; LOG.push(e); if (LOG.length > 300) LOG.shift(); console.log('[ADMIN]', by, act, target || '', detail ? JSON.stringify(detail).slice(0, 200) : ''); };

    // ---------- 2FA: TOTP (RFC 6238, SHA1, 30 с, 6 цифр) ----------
    function b32(s) { const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '', out = []; for (const c of s.replace(/=+$/, '')) { const v = A.indexOf(c); if (v < 0) return null; bits += v.toString(2).padStart(5, '0'); } for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); }
    const KEY = TOTP ? b32(TOTP) : null; let lastStep = 0;
    function totpAt(step) { const b = Buffer.alloc(8); b.writeUInt32BE(Math.floor(step / 4294967296), 0); b.writeUInt32BE(step >>> 0, 4); const h = crypto.createHmac('sha1', KEY).update(b).digest(), o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0'); }
    function totpOk(code) {
        if (!KEY) return true; code = String(code || '').replace(/\D/g, ''); if (code.length !== 6) return false;
        const s = Math.floor(Date.now() / 30000);
        for (const k of [0, -1, 1]) { const st = s + k; if (st <= lastStep) continue; if (crypto.timingSafeEqual(Buffer.from(totpAt(st)), Buffer.from(code))) { lastStep = st; return true; } }
        return false;
    }

    // ---------- спроби й сесії ----------
    const fails = new Map(), sess = new Map(); let globalFails = [], globalLock = 0;
    const lockKey = (n, ip) => n + '|' + ip;
    function locked(k) { const f = fails.get(k); return (f && f.until > Date.now()) || Date.now() < globalLock; }
    function fail(k) {
        const now = Date.now(), f = fails.get(k) || { n: 0, until: 0 }; f.n++; if (f.n >= 5) { f.n = 0; f.until = now + 30 * 60e3; } fails.set(k, f);
        globalFails = globalFails.filter(t => now - t < 10 * 60e3); globalFails.push(now); if (globalFails.length >= 20) { globalLock = now + 15 * 60e3; globalFails = []; console.warn('[ADMIN] забагато невдалих спроб — вхід закрито на 15 хв'); }
    }
    function session(socket) {
        const s = sess.get(socket.id), n = ctx.globalPlayers[socket.id], now = Date.now();
        if (!s || !n || s.login !== n || !ADMINS.has(n) || now > s.exp || now - s.last > 20 * 60e3) { if (s) sess.delete(socket.id); return null; }
        s.last = now; return s;
    }

    // ---------- подія ----------
    let EVENT = null;   // { title, cr, xp, mode|null, until }
    const evActive = () => EVENT && Date.now() < EVENT.until ? EVENT : null;
    function evPublic() { const e = evActive(); return e ? { title: e.title, cr: e.cr, xp: e.xp, mode: e.mode, until: e.until } : null; }
    function evSave() { const db = ctx.getDb && ctx.getDb(); if (db) db.collection('meta').replaceOne({ _id: 'event' }, { _id: 'event', ev: EVENT }, { upsert: true }).catch(e => console.error('❌ event save', e.message)); }
    let evLoaded = false;
    function evLoad() { if (evLoaded) return; const db = ctx.getDb && ctx.getDb(); if (!db) return; evLoaded = true; db.collection('meta').findOne({ _id: 'event' }).then(d => { if (d && d.ev && d.ev.until > Date.now()) EVENT = d.ev; }).catch(() => { evLoaded = false; }); }
    const lt = setInterval(() => { evLoad(); if (evLoaded) clearInterval(lt); }, 4000); if (lt.unref) lt.unref();
    Events.on('login', e => { const p = evPublic(); if (p) setTimeout(() => io.to(e.socketId).emit('gameEvent', p), 1200); });
    // бонус події: server.js (applyEventBonus) питає активну подію для режиму й нараховує ×креди / ×досвід ДО показу вікна результату
    ctx.hooks.eventBonus = mode => { const E = evActive(); return E && (!E.mode || E.mode === mode) ? E : null; };

    // ---------- промокоди ----------
    // Вбудовані коди — у server.js (PROMO_CODES). Створені / змінені в адмінці зберігаються в MongoDB (meta/promos) і накладаються поверх
    // при старті сервера. Вбудований код видалити не можна — лише вимкнути. Лічильник активацій — promo_uses (server.js).
    const PROMOS = ctx.PROMO_CODES || {}, BUILTIN = new Set(Object.keys(PROMOS)), OVR = {};      // OVR — усе, що змінено в адмінці (код → опис або null = видалено)
    const CODE_RE = /^[A-Z0-9_-]{3,24}$/, DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    function cleanPromo(p) { return { credits: Math.max(1, Math.min(100000, Math.floor(+p.credits || 0))), maxUses: Math.max(0, Math.min(1e6, Math.floor(+p.maxUses || 0))), expires: DATE_RE.test(p.expires || '') ? p.expires : null, once: p.once !== false, off: !!p.off, note: String(p.note || '').replace(/[<>]/g, '').slice(0, 80), by: p.by || '', at: +p.at || 0 }; }
    function applyOvr(code, p) { if (p) PROMOS[code] = cleanPromo(p); else if (!BUILTIN.has(code)) delete PROMOS[code]; }
    function promoSave() { const db = ctx.getDb && ctx.getDb(); if (db) db.collection('meta').replaceOne({ _id: 'promos' }, { _id: 'promos', codes: OVR }, { upsert: true }).catch(e => console.error('❌ promos save', e.message)); }
    let prLoaded = false;
    function promoLoad() {
        if (prLoaded) return; const db = ctx.getDb && ctx.getDb(); if (!db) return; prLoaded = true;
        db.collection('meta').findOne({ _id: 'promos' }).then(d => {
            const c = d && d.codes && typeof d.codes === 'object' ? d.codes : {};
            Object.keys(c).forEach(k => { if (CODE_RE.test(k) && !Object.prototype.hasOwnProperty.call(OVR, k)) { OVR[k] = c[k]; applyOvr(k, c[k]); } });      // зміни, зроблені до завантаження, не перетираємо
            if (Object.keys(c).length) console.log('🎟️  Промокоди з адмінки: ' + Object.keys(c).length);
        }).catch(() => { prLoaded = false; });
    }
    const pl = setInterval(() => { promoLoad(); if (prLoaded) clearInterval(pl); }, 4000); if (pl.unref) pl.unref();
    function promoList() {
        const uses = ctx.promoUses || {};
        return Object.keys(PROMOS).sort().map(k => { const p = PROMOS[k]; return { code: k, credits: p.credits | 0, maxUses: p.maxUses | 0, uses: uses[k] | 0, expires: p.expires || null, once: p.once !== false, off: !!p.off, note: p.note || '', builtin: BUILTIN.has(k), expired: !!(p.expires && Date.now() > Date.parse(p.expires + 'T23:59:59.999Z')) }; });
    }

    // ---------- статистика ----------
    let opsWin = [];
    function stats() {
        const now = Date.now(), online = new Set(Object.values(ctx.globalPlayers)).size;
        let lobby = 0, play = 0, inBattle = 0, bots = 0, ranked = 0;
        for (const id in rooms) { const r = rooms[id]; if (r.status === 'playing') play++; else lobby++; if (r.ranked) ranked++; for (const p in r.players) { if (r.players[p].isBot) bots++; else if (r.status === 'playing') inBattle++; } }
        const m = process.memoryUsage(), ds = ctx.dbStat || {};
        return { now, online, sockets: io.engine ? io.engine.clientsCount : 0, rooms: { lobby, play, ranked }, inBattle, bots, virtual: ctx.Bots && ctx.Bots.V ? ctx.Bots.V.size : 0,
            queue: ctx.Ranked ? ctx.Ranked.queue.size : 0, users: Object.keys(dbUsers).length, push: ctx.Notify ? ctx.Notify.pushUsers.size : 0,
            uptime: Math.round(process.uptime()), mem: Math.round(m.rss / 1048576), heap: Math.round(m.heapUsed / 1048576),
            db: { on: !!(ctx.getDb && ctx.getDb()), writes: ds.writes | 0, batches: ds.batches | 0, skipped: ds.skipped | 0, errors: ds.errors | 0, perMin: Math.round((ds.writes | 0) / Math.max(1, (now - (ds.since || now)) / 60000) * 10) / 10, pending: ctx.dirtyCount ? ctx.dirtyCount() : 0 },
            event: evPublic() };
    }
    function findUsers(q) {
        q = String(q || '').trim().toLowerCase().slice(0, 40); if (!q) return [];
        const out = [];
        for (const n in dbUsers) {
            const u = dbUsers[n]; if (!u) continue;
            if (n.toLowerCase().includes(q) || (u.nick && String(u.nick).toLowerCase().includes(q)) || String(u.pid || '') === q.replace('#', '')) {
                out.push({ login: n, nick: u.nick || '', pid: u.pid || null, lvl: ctx.playerLevel(n), bucks: u.bucks | 0, matches: (u.stats && u.stats.matches) | 0, online: ctx.isOnline(n), ban: ctx.banInfo(u), admin: ADMINS.has(n), last: u.lastLogin || u.lastSeen || 0, rp: u.rk ? u.rk.rp | 0 : 0 });
                if (out.length >= 25) break;
            }
        }
        return out;
    }
    function kickOut(n, msg) { ctx.onlineSocketsOf(n).forEach(sid => { const s = io.sockets.sockets.get(sid); if (s) { s.emit('authError', msg); setTimeout(() => { try { s.disconnect(true); } catch (e) {} }, 300); } }); }

    // ---------- сокет ----------
    ctx.onConnection(socket => {
        let rl = [];
        const rate = () => { const t = Date.now(); rl = rl.filter(x => t - x < 10000); if (rl.length >= 25) return false; rl.push(t); return true; };
        const deny = () => socket.emit('admAuth', { ok: false, msg: 'Доступ заборонено' });
        socket.on('admAuth', d => {
            if (!rate()) return;
            const n = ctx.globalPlayers[socket.id], ip = ctx.ipHashOf(socket), k = lockKey(n || '-', ip);
            setTimeout(() => {                                             // однакова затримка для всіх відповідей
                if (!ENABLED || !n || !dbUsers[n]) return deny();
                if (locked(k) || locked(lockKey('*', ip))) return socket.emit('admAuth', { ok: false, msg: 'Забагато спроб. Спробуйте пізніше' });
                const pass = d && typeof d.pass === 'string' ? d.pass.slice(0, 200) : '';
                let okPass = false; try { okPass = crypto.timingSafeEqual(crypto.scryptSync(pass, SALT, 32), PASS_H); } catch (e) {}
                if (!ADMINS.has(n) || !okPass || !totpOk(d && d.code)) { fail(k); fail(lockKey('*', ip)); log(n, 'auth-fail', '', { ip: ip.slice(0, 6) }); return deny(); }
                const now = Date.now(); sess.set(socket.id, { login: n, exp: now + 2 * 3600e3, last: now });
                log(n, 'login'); socket.emit('admAuth', { ok: true, totp: !!KEY, stats: stats(), cases: Object.keys(GameData.CASES).map(id => ({ id: +id, n: GameData.CASES[id].name, p: GameData.CASES[id].price })), modes: ModeInfo.ORDER.map(m => ({ k: m, n: ModeInfo.MODES[m].n })) });
            }, 600 + Math.random() * 400);
        });
        const A = (ev, fn) => socket.on(ev, d => {
            const s = session(socket); if (!s) return socket.emit('admErr', { msg: 'Сесію адміна завершено. Увійдіть знову', relog: true });
            if (!rate()) return socket.emit('admErr', { msg: 'Забагато дій. Зачекайте' });
            try { fn(s.login, d && typeof d === 'object' ? d : {}); } catch (e) { console.error('❌ admin', ev, e && e.stack); socket.emit('admErr', { msg: 'Помилка' }); }
        });
        const ok = (msg, extra) => socket.emit('admOk', Object.assign({ msg }, extra || {}));
        A('admStats', () => socket.emit('admStats', stats()));
        A('admFind', (by, d) => socket.emit('admFind', { q: d.q, list: findUsers(d.q) }));
        A('admLog', () => socket.emit('admLog', LOG.slice(-120).reverse()));
        A('admBan', (by, d) => {
            const t = typeof d.login === 'string' && dbUsers[d.login] ? d.login : null; if (!t) return socket.emit('admErr', { msg: 'Гравця не знайдено' });
            if (ADMINS.has(t)) return socket.emit('admErr', { msg: 'Адміністратора заблокувати не можна' });
            const mins = Math.max(0, Math.min(525600, Math.floor(+d.mins || 0))), reason = String(d.reason || '').replace(/[<>]/g, '').slice(0, 120);
            dbUsers[t].ban = { until: mins ? Date.now() + mins * 60e3 : 0, reason, by, at: Date.now() }; saveUser(t, true);
            kickOut(t, ctx.banInfo(dbUsers[t])); log(by, 'ban', t, { mins, reason }); ok('Гравця ' + t + ' заблоковано', { list: findUsers(t) });
        });
        A('admUnban', (by, d) => { const t = dbUsers[d.login] ? d.login : null; if (!t) return; delete dbUsers[t].ban; saveUser(t, true); log(by, 'unban', t); ok('Гравця ' + t + ' розблоковано', { list: findUsers(t) }); });
        A('admKick', (by, d) => { const t = dbUsers[d.login] ? d.login : null; if (!t || ADMINS.has(t)) return; kickOut(t, 'Вас відключено адміністратором'); log(by, 'kick', t); ok('Гравця ' + t + ' відключено'); });
        A('admGive', (by, d) => {
            const t = dbUsers[d.login] ? d.login : null; if (!t) return socket.emit('admErr', { msg: 'Гравця не знайдено' });
            const u = dbUsers[t], cr = Math.max(0, Math.min(100000, Math.floor(+d.cr || 0))), cid = d.caseId && GameData.CASES[d.caseId] ? +d.caseId : null;
            if (!cr && !cid) return socket.emit('admErr', { msg: 'Вкажіть кредити або кейс' });
            if (cid && u.inventory.length >= 30) return socket.emit('admErr', { msg: 'Інвентар гравця повний' });
            const modId = cid ? ctx.getRandomModuleFromCase(cid) : null;
            if (cr) { u.bucks += cr; if (u.stats) u.stats.earned = (u.stats.earned | 0) + cr; } if (modId) u.inventory.push(modId);
            saveUser(t, true);
            ctx.onlineSocketsOf(t).forEach(sid => { ctx.sendEconomy(sid, t); io.to(sid).emit('admGift', { cr, mod: modId }); });
            log(by, 'give', t, { cr, caseId: cid, modId }); ok('Видано: ' + (cr ? cr + ' кредитів ' : '') + (modId ? '+ модуль' : ''), { list: findUsers(t) });
        });
        A('admEvent', (by, d) => {
            const hours = Math.max(0.25, Math.min(168, +d.hours || 1)), cr = Math.max(1, Math.min(5, +d.cr || 1)), xp = Math.max(1, Math.min(5, +d.xp || 1));
            const mode = typeof d.mode === 'string' && ModeInfo.MODES[d.mode] ? d.mode : null, title = String(d.title || '').replace(/[<>]/g, '').trim().slice(0, 60) || 'Подія';
            if (cr === 1 && xp === 1) return socket.emit('admErr', { msg: 'Множник має бути більшим за ×1' });
            EVENT = { title, cr: Math.round(cr * 100) / 100, xp: Math.round(xp * 100) / 100, mode, until: Date.now() + hours * 3600e3 }; evSave();
            io.emit('gameEvent', evPublic()); log(by, 'event', mode || 'all', EVENT);
            try { if (ctx.Notify && ctx.Notify.sendAll) ctx.Notify.sendAll('event', { n: title, t: (cr > 1 ? '×' + EVENT.cr + ' 💰 ' : '') + (xp > 1 ? '×' + EVENT.xp + ' XP' : '') }); } catch (e) {}   // push усім підписаним, хто не в мережі ok('Подію запущено', { stats: stats() });
        });
        A('admEventStop', (by) => { EVENT = null; evSave(); io.emit('gameEvent', null); log(by, 'event-stop'); ok('Подію зупинено', { stats: stats() }); });
        A('admAnnounce', (by, d) => {
            const text = String(d.text || '').replace(/[<>]/g, '').trim().slice(0, 200); if (!text) return;
            io.emit('announce', { text, at: Date.now() }); log(by, 'announce', '', { text }); ok('Оголошення надіслано ' + new Set(Object.values(ctx.globalPlayers)).size + ' гравцям');
        });
        A('admPromos', () => socket.emit('admPromos', promoList()));
        A('admPromoSave', (by, d) => {
            const code = String(d.code || '').trim().toUpperCase();
            if (!CODE_RE.test(code)) return socket.emit('admErr', { msg: 'Код: 3–24 символи, лише латиниця, цифри, _ та -' });
            if (!(+d.credits >= 1)) return socket.emit('admErr', { msg: 'Вкажіть кількість кредитів (від 1)' });
            if (d.expires && !DATE_RE.test(d.expires)) return socket.emit('admErr', { msg: 'Дата дії: РРРР-ММ-ДД або порожньо' });
            const isNew = !PROMOS[code];
            if (isNew && d.edit) return socket.emit('admErr', { msg: 'Такого коду вже немає' });
            if (!isNew && !d.edit) return socket.emit('admErr', { msg: 'Код ' + code + ' уже існує — відредагуйте його в списку' });
            const p = cleanPromo(Object.assign({}, d, { by, at: Date.now() }));
            OVR[code] = p; applyOvr(code, p); promoSave();
            log(by, isNew ? 'promo-add' : 'promo-edit', code, p); ok((isNew ? 'Промокод створено: ' : 'Промокод оновлено: ') + code, { promos: promoList() });
        });
        A('admPromoToggle', (by, d) => {
            const code = String(d.code || '').toUpperCase(), p = PROMOS[code]; if (!p) return socket.emit('admErr', { msg: 'Код не знайдено' });
            const np = cleanPromo(Object.assign({}, p, { off: !p.off, by, at: Date.now() })); OVR[code] = np; applyOvr(code, np); promoSave();
            log(by, np.off ? 'promo-off' : 'promo-on', code); ok(code + (np.off ? ' вимкнено' : ' увімкнено'), { promos: promoList() });
        });
        A('admPromoDel', (by, d) => {
            const code = String(d.code || '').toUpperCase(); if (!PROMOS[code]) return socket.emit('admErr', { msg: 'Код не знайдено' });
            if (BUILTIN.has(code)) return socket.emit('admErr', { msg: 'Вбудований код видалити не можна — вимкніть його' });
            OVR[code] = null; applyOvr(code, null); promoSave();
            log(by, 'promo-del', code); ok('Промокод ' + code + ' видалено', { promos: promoList() });
        });
        A('admFlush', (by) => { if (ctx.flushUsers) ctx.flushUsers(); log(by, 'db-flush'); ok('Запис у БД запущено'); });
        A('admLogout', () => { sess.delete(socket.id); ok('Вихід з адмінки'); });
        socket.on('disconnect', () => sess.delete(socket.id));
    });
    ctx.Admin = { enabled: ENABLED, event: evPublic };
};
