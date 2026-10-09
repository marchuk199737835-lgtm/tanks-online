const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, { perMessageDeflate: { threshold: 1024 } }); // стискаються лише великі повідомлення (лобі, списки); дрібні sync летять як є
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const MapObj = require('./public/js/mapobjects.js');     // спільний модуль: об'єкти мап, зіткнення, двері
const Nav = require('./navgrid.js');                     // пошук шляху для зомбі (обхід перешкод)
const mountEditor = require('./editor-server.js');       // серверна частина редактора мап
const Ev = require('./events.js');                       // шина подій (прогрес, профіль, соціальне, боти)

process.on('uncaughtException', err => console.error('Crash prevented:', err));
process.on('unhandledRejection', err => console.error('Promise rejection prevented:', err));

// статика: brotli/gzip, ETag/304, кеш, версіонування js/css в index.html, Range для звуків (див. static_gzip.js)
require('./static_gzip.js')(app, express, { publicDir: path.join(__dirname, 'public'), log: console.log });

const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);

// Музика: лише меню (main) і лобі (loby). У боях музики немає. Беруться ТІЛЬКИ треки з music/<категорія>/lic/free/ (перевірена ліцензія);
// файли, що лежать у lic/ поруч із free, ігноруються, доки їх не перенесено у free.
const musicCategories = ['main', 'loby'];
let musicData = {};

musicCategories.forEach(cat => {
    const freeDir = path.join(musicDir, cat, 'lic', 'free');
    if (!fs.existsSync(freeDir)) fs.mkdirSync(freeDir, { recursive: true });
});

function scanMusic() {
    musicCategories.forEach(cat => {
        const freeDir = path.join(musicDir, cat, 'lic', 'free');
        let list = [];
        try { list = fs.readdirSync(freeDir).filter(f => /\.mp3$/i.test(f)).sort().map(f => `${cat}/lic/free/${f}`); } catch (e) {}
        musicData[cat] = list;
    });
}
scanMusic();
console.log('[music] папка:', musicDir, '| main:', musicData.main.length, '| loby:', musicData.loby.length);
// перескан не частіше ніж раз на 20 с (нові треки підхоплюються без перезапуску), і JSON-діагностика: /music-status
let lastMusicScan = Date.now();
function rescanMusicSoon() { if (Date.now() - lastMusicScan > 20000) { lastMusicScan = Date.now(); try { scanMusic(); } catch (e) {} } }
app.get('/music-status', (req, res) => { scanMusic(); res.json({ dir: musicDir, exists: fs.existsSync(musicDir), main: musicData.main, loby: musicData.loby }); });
app.use('/music', express.static(musicDir, { maxAge: '1d' }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const MAX_HP = 500, BUFF_DURATION = 15000, BASE_RELOAD = 2000;
const mongoUri = process.env.MONGO_URI;
let dbUsersCol = null, dbMapsCol = null, editorApi = null, dbRef = null;
const dbUsers = Object.create(null); // без прототипу: логіни типу __proto__ чи constructor більше не ламають логіку

if (mongoUri) {
    const client = new MongoClient(mongoUri, { maxPoolSize: 5, minPoolSize: 0, maxIdleTimeMS: 60000, retryWrites: true });   // безкоштовний кластер: мало з'єднань
    client.connect().then(() => {
        console.log("✅ Підключено до MongoDB!");
        const db = client.db("tanks_db"); dbRef = db;
        dbUsersCol = db.collection("users");
        dbMapsCol = db.collection("maps");
        promoCol = db.collection("promo_uses");
        promoCol.find({}).toArray().then(rows => { rows.forEach(r => { if (r && r._id) promoUses[r._id] = Math.max(promoUses[r._id] || 0, r.uses | 0); }); }).catch(e => console.error('❌ Лічильники промокодів:', e.message));
        if (editorApi) editorApi.loadSaved().catch(e => console.error('❌ Не вдалося завантажити мапи з БД:', e.message));
        dbUsersCol.find({}).toArray().then(users => {
            users.forEach(u => { if (!u || typeof u.name !== 'string') return; if (!dbUsers[u.name]) dbUsers[u.name] = u; savedSnap.set(u.name, snapOf(u)); });
            console.log(`Завантажено акаунтів: ${users.length}`);
            if (dirtyUsers.size) scheduleFlush(false);
        });
    }).catch(err => console.error("❌ Помилка MongoDB:", err));
} else {
    console.warn("⚠️  MONGO_URI не задано! Акаунти зберігаються лише в пам'яті і зникнуть після перезапуску.");
}

// ===== Збереження акаунтів: економно для безкоштовної MongoDB (512 МБ, ~100 операцій/с) =====
// Раніше КОЖЕН виклик saveUser (вбивство, підбір, вхід…) одразу писав увесь документ. Тепер:
//  • виклики лише позначають акаунт «зміненим», запис іде пачкою раз на ~8 с (bulkWrite, один запит на пачку);
//  • у БД летять ЛИШЕ поля, що змінились з останнього запису (порівняння з відбитком), незмінений акаунт — 0 операцій;
//  • перед зупинкою сервера (редеплой, SIGTERM) усе незаписане зберігається; при помилці запису акаунт повертається в чергу.
const dirtyUsers = new Set(), savedSnap = new Map(), DB_FLUSH_MS = 8000;
const dbStat = { writes: 0, batches: 0, skipped: 0, errors: 0, since: Date.now() };
let flushTimer = null, flushing = false;
function snapOf(u) { const s = {}; for (const k of Object.keys(u)) { if (k === '_id') continue; try { s[k] = JSON.stringify(u[k]); } catch (e) { s[k] = String(Math.random()); } } return s; }
function scheduleFlush(urgent) {
    if (!dbUsersCol) return;
    if (urgent && flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    if (!flushTimer) flushTimer = setTimeout(() => { flushTimer = null; flushUsers(); }, urgent ? 400 : DB_FLUSH_MS);
}
// urgent — важливі зміни (новий акаунт, пароль): записати майже одразу
function saveUser(name, urgent) {
    if (!dbUsers[name]) return;
    dirtyUsers.add(name);
    scheduleFlush(!!urgent);
}
async function flushUsers() {
    if (!dbUsersCol || flushing || !dirtyUsers.size) return;
    flushing = true;
    const names = [...dirtyUsers]; dirtyUsers.clear();
    const ops = [], snaps = [];
    for (const n of names) {
        const u = dbUsers[n]; if (!u) continue;
        const prev = savedSnap.get(n), snap = snapOf(u), set = {}; let any = false;
        for (const k in snap) if (!prev || prev[k] !== snap[k]) { set[k] = u[k]; any = true; }
        if (!any) { dbStat.skipped++; continue; }
        set.name = n;
        ops.push({ updateOne: { filter: { name: n }, update: { $set: set }, upsert: true } }); snaps.push([n, snap]);
    }
    try {
        for (let i = 0; i < ops.length; i += 100) {
            await dbUsersCol.bulkWrite(ops.slice(i, i + 100), { ordered: false });
            snaps.slice(i, i + 100).forEach(([n, s]) => savedSnap.set(n, s));
            dbStat.batches++; dbStat.writes += Math.min(100, ops.length - i);
        }
    } catch (err) {
        dbStat.errors++; console.error('❌ Не вдалося зберегти акаунти:', err.message);
        snaps.forEach(([n]) => dirtyUsers.add(n));            // спробуємо ще раз
    } finally { flushing = false; if (dirtyUsers.size) scheduleFlush(false); }
}
let shuttingDown = false;
async function gracefulExit(sig) {
    if (shuttingDown) return; shuttingDown = true;
    console.log('⏹  ' + sig + ': зберігаю дані перед зупинкою…');
    try { clearTimeout(flushTimer); flushTimer = null; while (flushing) await new Promise(r => setTimeout(r, 50)); await flushUsers(); } catch (e) { console.error(e); }
    try { if (hooks.beforeExit) await hooks.beforeExit(); } catch (e) {}
    process.exit(0);
}
process.on('SIGTERM', () => gracefulExit('SIGTERM'));
process.on('SIGINT', () => gracefulExit('SIGINT'));

function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }
// Вхід за токеном без перебору всіх акаунтів: індекс токен → логін (самовідновлюваний: промах → одноразова перебудова, не частіше 1/с)
const tokenIdx = new Map(); let tokenIdxAt = 0;
function loginByToken(token) {
    let n = tokenIdx.get(token);
    if (n && dbUsers[n] && dbUsers[n].token === token) return n;
    if (Date.now() - tokenIdxAt < 1000) return null;
    tokenIdxAt = Date.now(); tokenIdx.clear();
    for (const k in dbUsers) { const t = dbUsers[k] && dbUsers[k].token; if (t) tokenIdx.set(t, k); }
    n = tokenIdx.get(token); return n && dbUsers[n] && dbUsers[n].token === token ? n : null;
}
// Блокування акаунта (адмін-панель): u.ban = { until (0 = назавжди), reason }. Повертає текст для гравця або null
function banInfo(u) {
    const b = u && u.ban; if (!b || typeof b !== 'object') return null;
    if (b.until && Date.now() > b.until) return null;
    const left = b.until ? Math.ceil((b.until - Date.now()) / 60000) : 0;
    return 'Акаунт заблоковано' + (b.until ? ' ще на ' + (left >= 1440 ? Math.ceil(left / 1440) + ' дн.' : left >= 60 ? Math.ceil(left / 60) + ' год' : left + ' хв') : ' назавжди') + (b.reason ? '. Причина: ' + String(b.reason).slice(0, 120) : '');
}
// Хеш IP-адреси підключення (саму адресу не зберігаємо): захист рейтингу й реферальної системи від твінків з одного пристрою/мережі
const IP_SALT = process.env.IP_SALT || 'puls-ip-v1';
function ipHashOf(socket) {
    try {
        const h = socket && socket.handshake || {}, xf = h.headers && h.headers['x-forwarded-for'];
        const ip = String(xf ? String(xf).split(',')[0] : (h.address || '')).trim().replace(/^::ffff:/, '');
        return ip ? crypto.createHash('sha256').update(IP_SALT + '|' + ip).digest('hex').slice(0, 16) : '';
    } catch (e) { return ''; }
}

// ===== ПРОМОКОДИ =====
// Коди й суми живуть лише на сервері (клієнту суму не довіряємо). credits — скільки Кредів (поле bucks) дає код;
// maxUses — загальний ліміт активацій (0 = без ліміту); expires — 'YYYY-MM-DD' (включно, UTC) або null; once — один раз на акаунт.
// Лічильники використань: колекція promo_uses у MongoDB (або пам'ять, якщо БД нема); застосовані коди акаунта — u.usedPromos.
const PROMO_CODES = {
    'WELCOME':   { credits: 50,  maxUses: 0,    expires: null,         once: true },
    'BONUS25':   { credits: 25,  maxUses: 1000, expires: '2026-12-31', once: true },
    'ALEX-TOP1': { credits: 200, maxUses: 0,    expires: null,         once: true },  // старий код (раніше був зашитий у usePromo)
    'START':     { credits: 200, maxUses: 0,    expires: null,         once: true }   // промокод навчання новачка
};
let promoCol = null;
const promoUses = Object.create(null);
const promoRate = Object.create(null);   // за ім'ям акаунта: { last, fails, windowStart, blockedUntil }
const PROMO_MIN_GAP = 1500, PROMO_MAX_FAILS = 8, PROMO_WINDOW = 10 * 60 * 1000, PROMO_BLOCK = 5 * 60 * 1000;
function redeemPromoCode(name, rawCode, now) {
    now = now || Date.now();
    const u = dbUsers[name];
    if (!u) return { ok: false, msg: 'Спершу увійдіть в акаунт' };
    const rt = promoRate[name] || (promoRate[name] = { last: 0, fails: 0, windowStart: now, blockedUntil: 0 });
    if (now < rt.blockedUntil) return { ok: false, msg: 'Забагато невдалих спроб. Спробуйте пізніше' };
    if (now - rt.last < PROMO_MIN_GAP) return { ok: false, msg: 'Не так швидко! Зачекайте секунду' };
    rt.last = now;
    if (now - rt.windowStart > PROMO_WINDOW) { rt.windowStart = now; rt.fails = 0; }
    const fail = msg => { if (++rt.fails >= PROMO_MAX_FAILS) { rt.blockedUntil = now + PROMO_BLOCK; rt.fails = 0; } return { ok: false, msg }; };
    if (typeof rawCode !== 'string') return fail('Невірний промокод');
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, msg: 'Введіть промокод' };
    if (code.length > 40 || !Object.prototype.hasOwnProperty.call(PROMO_CODES, code)) return fail('Невірний промокод');
    const p = PROMO_CODES[code];
    if (p.expires && now > Date.parse(p.expires + 'T23:59:59.999Z')) return fail('Термін дії промокоду минув');
    if (!Array.isArray(u.usedPromos)) u.usedPromos = [];
    if (p.once !== false && u.usedPromos.some(x => String(x).toUpperCase() === code)) return fail('Цей промокод уже використано');
    if (p.maxUses > 0 && (promoUses[code] || 0) >= p.maxUses) return fail('Ліміт активацій цього промокоду вичерпано');
    const amt = Math.max(0, Math.floor(p.credits)) || 0;
    promoUses[code] = (promoUses[code] || 0) + 1;
    if (promoCol) promoCol.updateOne({ _id: code }, { $inc: { uses: 1 } }, { upsert: true }).catch(e => console.error('❌ Лічильник промокоду', code, e.message));
    u.usedPromos.push(code);
    u.bucks += amt; u.stats.earned += amt;
    rt.fails = 0;
    return { ok: true, msg: 'Успішно! +' + amt + ' кредів', amount: amt, bucks: u.bucks };
}

// --- КОНСТАНТИ ---
const MAP_DATA={"epic_map":{size:3000,bg:"#565a6c",grid:"#494d55",solids:[{type:"wall_square",x:850,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1800,w:50,h:50,color:"#353940"},{type:"shape_rhombus",x:1150,y:1300,w:400,h:400,color:"#353940"},{type:"shape_rhombus",x:1250,y:1350,w:200,h:300,color:"#22252a"},{type:"tree",x:0,y:700,r:424.26},{type:"tree",x:2650,y:2550,r:180.27},{type:"tree",x:300,y:2400,r:158.11},{type:"tree",x:2850,y:750,r:364.00},{type:"neon_circle",x:850,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1900,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:850,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1900,w:50,h:50,color:"#21252c"},{type:"prop_crate",x:3000,y:2950,w:50,h:50},{type:"spawn_player",x:250,y:2750},{type:"spawn_player",x:2850,y:2850},{type:"spawn_player",x:1500,y:2750},{type:"spawn_powerup",x:1500,y:1500},{type:"spawn_powerup",x:800,y:800},{type:"spawn_powerup",x:2200,y:800},{type:"spawn_powerup",x:1500,y:2200}]},'Бій Насмерть':{size:2500,bg:'#3e2604',grid:'#1e293b',solids:[{type:"spawn_player",x:1400,y:1450},{type:"spawn_player",x:100,y:1350},{type:"spawn_player",x:1400,y:750},{type:"spawn_player",x:100,y:700},{type:"spawn_powerup",x:700,y:700},{type:"spawn_powerup",x:1800,y:700},{type:"spawn_powerup",x:700,y:1800},{type:"spawn_powerup",x:1800,y:1800}]}};
// Вбудовані мапи під нові режими (редактор бачить їх як звичайні; збережена в редакторі версія замінює вбудовану)
try { const MM = require('./maps_modes.js'); Object.keys(MM).forEach(k => { const m = MapObj.sanitizeMap(JSON.parse(JSON.stringify(MM[k]))); if (m) MAP_DATA[k] = m; }); } catch (e) { console.warn('maps_modes.js:', e.message); }
editorApi = mountEditor(app, { MAP_DATA: MAP_DATA, getMapsCol: () => dbMapsCol });
if (!mongoUri) editorApi.loadSaved().catch(e => console.error('❌ Не вдалося завантажити мапи:', e.message));
const Z_TYPES={normal:{hp:25,speed:120,dmg:10,radius:15,color:'#22c55e'},runner:{hp:15,speed:250,dmg:5,radius:12,color:'#84cc16'},tanker:{hp:100,speed:60,dmg:25,radius:25,color:'#15803d'},spitter:{hp:40,speed:90,dmg:15,radius:15,color:'#a3e635',ranged:true},bomber:{hp:30,speed:140,dmg:50,radius:18,color:'#dc2626',explode:true},ghost:{hp:20,speed:100,dmg:10,radius:15,color:'#cbd5e1',ghost:true},pikus:{isBoss:true,name:'ПІКУС',hp:1000,speed:294,dmg:100,radius:30,color:'#9333ea',bullets:3,cd:3000},shurik:{isBoss:true,name:'ШУРІК',hp:2000,speed:280,dmg:100,radius:22.5,color:'#f43f5e',bullets:10,cd:3000},oneshot:{isBoss:true,name:'ВАНШОТУС',hp:3000,speed:294,dmg:1000,radius:30,color:'#fbbf24',bullets:2,cd:2000},padlo:{isBoss:true,name:'ПАДЛО',hp:5000,speed:280,dmg:75,radius:15,color:'#10b981',bullets:25,cd:1500,ring:true},titan:{isBoss:true,name:'ТИТАН',hp:8000,speed:270,dmg:120,radius:36,color:'#38bdf8',bullets:18,cd:1400,ring:true}};
const GameData = require('./public/js/gamedata.js'); // єдине джерело модулів і кейсів (спільне з клієнтом)
const MODULES = GameData.MODULES, CASES = GameData.CASES;

// --- ЗОМБІ: ліміт кількості та масштабування складності ---
const ZOMBIE_CAP = 100;          // максимум зомбі на хвилі
const ZOMBIE_SPAWN_BASE = 20;    // зомбі на 1-й хвилі
const ZOMBIE_SPAWN_STEP = 5;     // приріст зомбі за хвилю (до ліміту)
const HP_SCALE_PER_WAVE = 0.05;  // після ліміту: +5% живучості за кожну наступну хвилю
const DMG_SCALE_PER_WAVE = 0.03; // після ліміту: +3% урону за кожну наступну хвилю
// Хвиля, на якій кількість зомбі вперше досягає ліміту (зараз 17)
const ZOMBIE_CAP_WAVE = Math.ceil((ZOMBIE_CAP - ZOMBIE_SPAWN_BASE) / ZOMBIE_SPAWN_STEP) + 1;
function waveScale(wave) {
    const extra = Math.max(0, wave - ZOMBIE_CAP_WAVE);
    return { hp: 1 + extra * HP_SCALE_PER_WAVE, dmg: 1 + extra * DMG_SCALE_PER_WAVE };
}
// Єдине джерело правди: ці дані (без серверних полів) віддаються клієнту при підключенні
const Z_TYPES_CLIENT = {};
for (const k in Z_TYPES) {
    const z = Z_TYPES[k];
    Z_TYPES_CLIENT[k] = { hp: z.hp, radius: z.radius, color: z.color };
    if (z.ghost) Z_TYPES_CLIENT[k].ghost = true;
    if (z.isBoss) { Z_TYPES_CLIENT[k].isBoss = true; Z_TYPES_CLIENT[k].name = z.name; }
}
// Компактний вигляд зомбі для sync (менше трафіку при 100 зомбі * 30 разів/с)
function compactZombies(zs) {
    const out = {};
    for (const id in zs) { const z = zs[id]; out[id] = { id: z.id, x: Math.round(z.x), y: Math.round(z.y), type: z.type, hp: Math.round(z.hp), maxHp: z.maxHp }; }
    return out;
}

function getRandomModuleFromCase(caseId) {
    const cs = CASES[caseId]; if (!cs) return null;
    return GameData.rollCase(cs);
}

// Гравці кімнати, що відкривають авто-двері (кеш на кадр)
function roomActors(room) {
    const now = Date.now();
    if (!room._actCache || now - room._actT > 25) {
        room._actCache = Object.values(room.players).filter(p => p.hp > 0 && !p.spectator).map(p => ({ x: p.x, y: p.y, r: 24 }));
        room._actT = now;
    }
    return room._actCache;
}

function checkCollisionServer(mapName, x, y, r, ignoreList = [], room = null) {
    let cM = MAP_DATA[mapName] ? mapName : 'epic_map';
    return MapObj.collides(MAP_DATA[cM], x, y, r, { ignore: ignoreList, doorOpen: room ? (o => MapObj.doorNear(o, roomActors(room))) : (() => false) });
}

function getValidSpawn(m, r, t = 'spawn_player') {
    let cM = MAP_DATA[m] ? m : 'epic_map', mS = MAP_DATA[cM].size, sP = MAP_DATA[cM].solids.filter(s => s.type === t);
    if (sP.length > 0) {
        let a = 0;
        while (a < 50) {
            let sp = sP[Math.floor(Math.random() * sP.length)], sx = sp.x + (Math.random() * 20 - 10), sy = sp.y + (Math.random() * 20 - 10);
            if (!checkCollisionServer(cM, sx, sy, r)) return { x: sx, y: sy };
            a++;
        }
        let sp = sP[Math.floor(Math.random() * sP.length)];
        return { x: sp.x, y: sp.y };
    }
    const shp = MapObj.hasShape(MAP_DATA[cM]) ? MapObj.shapeBounds(MAP_DATA[cM].shape) : null;
    for (let i = 0; i < 200; i++) {
        let x = shp ? shp.x0 + Math.random() * (shp.x1 - shp.x0) : Math.random() * (mS - 200) + 100, y = shp ? shp.y0 + Math.random() * (shp.y1 - shp.y0) : Math.random() * (mS - 200) + 100;
        if (!checkCollisionServer(cM, x, y, r + 20)) return { x, y };
    }
    if (shp) return { x: (shp.x0 + shp.x1) / 2, y: (shp.y0 + shp.y1) / 2 };
    return { x: mS / 2, y: mS / 2 };
}

function getValidEdgeSpawn(m, r, t = 'spawn_zombie') {
    let cM = MAP_DATA[m] ? m : 'epic_map', mS = MAP_DATA[cM].size, sP = MAP_DATA[cM].solids.filter(s => s.type === t);
    if (sP.length > 0) return getValidSpawn(m, r, t);
    if (MapObj.hasShape(MAP_DATA[cM])) { // фігурна мапа: беремо точку на контурі й трохи зсуваємо всередину
        const poly = MAP_DATA[cM].shape, bb = MapObj.shapeBounds(poly), mx = (bb.x0 + bb.x1) / 2, my = (bb.y0 + bb.y1) / 2;
        for (let i = 0; i < 200; i++) {
            const a = poly[Math.floor(Math.random() * poly.length)], b = poly[(poly.indexOf(a) + 1) % poly.length], t = Math.random();
            const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t, dx = mx - px, dy = my - py, l = Math.max(Math.hypot(dx, dy), 1);
            const x = px + dx / l * (r + 40), y = py + dy / l * (r + 40);
            if (!checkCollisionServer(cM, x, y, r + 20)) return { x, y };
        }
        return getValidSpawn(m, r);
    }
    for (let i = 0; i < 100; i++) {
        let x = Math.random() < 0.5 ? 50 : mS - 50, y = Math.random() * (mS - 100) + 50;
        if (!checkCollisionServer(cM, x, y, r + 20)) return { x, y };
    }
    return getValidSpawn(m, r);
}

let rooms = {};
// globalPlayers: socket.id → логін. Обгортка підтримує зворотний індекс логін → сокети, щоб onlineSocketsOf/isOnline
// (їх десятки разів на секунду викликають друзі, чат, клани, прогрес) не перебирали всі підключення.
const _sockByName = new Map();
const globalPlayers = new Proxy({}, {
    set(t, k, v) {
        if (Object.prototype.hasOwnProperty.call(t, k)) { const s = _sockByName.get(t[k]); if (s) { s.delete(k); if (!s.size) _sockByName.delete(t[k]); } }
        t[k] = v;
        if (typeof v === 'string') { let s = _sockByName.get(v); if (!s) _sockByName.set(v, s = new Set()); s.add(k); }
        return true;
    },
    deleteProperty(t, k) {
        if (Object.prototype.hasOwnProperty.call(t, k)) { const s = _sockByName.get(t[k]); if (s) { s.delete(k); if (!s.size) _sockByName.delete(t[k]); } delete t[k]; }
        return true;
    }
});
const hooks = { clanTag: () => '', extraRooms: () => [], preJoin: () => false, botNames: null, inRankedQueue: null, leaveRankedQueue: null, rankedLeave: null };   // модулі підміняють (clans.js → hooks.clanTag; bots.js → extraRooms/preJoin/botNames)
const nickOf = n => (dbUsers[n] && dbUsers[n].nick) || n;
const connHooks = [];   // обробники підключення від додаткових модулів (ctx.onConnection)

function ecoPayload(name) {
    const u = dbUsers[name];
    return { bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, adventClaims: u.adventClaims,
        xp: u.xp, levelRewards: u.levelRewards, levelClaims: u.levelClaims };
}
function sendEconomy(socketId, name) {
    if (dbUsers[name]) io.to(socketId).emit('economyUpdate', ecoPayload(name));
}

// ===== Система левелів: досвід за бій =====
// outcome: 'win' | 'loss' | 'draw'. Повертає дані для анімації у вікні результату.
function grantXp(name, outcome) {
    const u = dbUsers[name]; if (!u) return null;
    const before = u.xp || 0, gain = GameData.rollXp(outcome === 'win' ? 'win' : outcome === 'draw' ? 'draw' : 'loss');
    u.xp = before + gain;
    const lb = GameData.levelFromXp(before), la = GameData.levelFromXp(u.xp);
    return { gain, outcome, before, after: u.xp, lvlBefore: lb, lvlAfter: la };
}
function playerLevel(name) { return dbUsers[name] ? GameData.levelFromXp(dbUsers[name].xp || 0) : 1; }

// Список сесій отримують лише ті, хто його дивиться (кімната 'rb'), і не частіше разу на ~300 мс (раніше — усім підключеним на кожну зміну)
let _roomsTimer = null, _roomsLast = '';
// Компактна статистика гравця для картки в лобі (ігри / перемоги / вбивства / смерті); для ботів її генерує bots.js
function lobbyStats(n) {
    const u = dbUsers[n]; if (!u) return { games: 0, wins: 0, kills: 0, deaths: 0 };
    const ps = u.pstats || {}, st = u.stats || {}, num = v => (Number.isFinite(+v) ? Math.max(0, Math.floor(+v)) : 0);
    return { games: num(ps.games || st.matches), wins: num(ps.wins), kills: num(ps.kills || st.kills), deaths: num(ps.deaths) };
}
// Троттлінг: не частіше разу на ~1.8 с (після паузи — майже одразу, ~150 мс), і лише якщо корисне навантаження справді змінилось (підпис JSON)
const ROOMS_GAP = 1800; let _roomsAt = 0;
function pushRooms() { if (_roomsTimer) return; _roomsTimer = setTimeout(() => { _roomsTimer = null; const lst = getActiveRooms(), js = JSON.stringify(lst); if (js === _roomsLast) return; _roomsLast = js; _roomsAt = Date.now(); io.to('rb').emit('roomsList', lst); }, Math.max(150, _roomsAt + ROOMS_GAP - Date.now())); }
function getActiveRooms() {
    let extra = []; try { extra = hooks.extraRooms() || []; } catch (e) { extra = []; }   // «віртуальні» сесії (bots.js)
    return Object.values(rooms).filter(r => !r.ranked).map(r => ({ id: r.id, hostName: r.hostName, hostNick: nickOf(r.hostName), mode: r.mode, map: r.map, playersCount: Object.keys(r.players).length, maxPlayers: r.maxPlayers, status: r.status })).concat(extra);
}

function getMaxHp(equipped) {
    return Math.round(MAX_HP * GameData.statMult(equipped, 'hp'));
}

// мови інтерфейсу (мова зберігається в акаунті; тексти перекладає клієнт — public/js/i18n.js та public/js/lang/*.js)
const LANGS = ['uk', 'en', 'es', 'de', 'fr', 'pt', 'pl', 'tr'];
function cleanLang(l) { return typeof l === 'string' && LANGS.includes(l) ? l : null; }

function validateUser(u) {
    if (!u.inventory) u.inventory = [];
    if (!u.equipped) u.equipped = { cannon: null, turret: null, hull: null, tracks: null };
    if (!u.stats) u.stats = { kills: 0, matches: 0, earned: 0 };
    if (!u.usedPromos) u.usedPromos = [];
    if (!u.adventClaims) u.adventClaims = [];
    if (typeof u.xp !== 'number' || !(u.xp >= 0)) u.xp = 0;
    if (!u.levelRewards) u.levelRewards = GameData.genLevelRewards();
    if (!Array.isArray(u.levelClaims)) u.levelClaims = [];
    return u;
}

function rollDrop(name) {
    if (Math.random() <= GameData.DROP_CHANCE) {
        let r = Math.random() * 100, rarity = 'common';
        if (r > 90 && r <= 98) rarity = 'rare';
        else if (r > 98 && r <= 99.5) rarity = 'epic';
        else if (r > 99.5) rarity = 'legendary';
        let pool = Object.keys(MODULES).filter(m => MODULES[m].rarity === rarity);
        let modId = pool[Math.floor(Math.random() * pool.length)];
        if (dbUsers[name].inventory.length < 30) {
            dbUsers[name].inventory.push(modId);
            return modId;
        }
    }
    return null;
}

// ===== Події прогресу: підрахунок вбивств/смертей за матч, 'kill', 'multikill', 'matchEnd' =====
const WEAPON_TYPES = new Set(['normal', 'explosive', 'fast', 'piercing', 'homing', 'shotgun', 'minigun', 'incendiary', 'samurai', 'melee', 'acid', 'hunter_gun', 'boss_proj', 'mine', 'laser']);
const cleanWeapon = t => (typeof t === 'string' && WEAPON_TYPES.has(t)) ? t : null;
const matchTally = new Map();   // roomId -> { t0, kd: { [name]: { k, d } } }
const tallyOf = r => { let t = matchTally.get(r.id); if (!t) { t = { t0: Date.now(), kd: Object.create(null) }; matchTally.set(r.id, t); } return t; };
const kdOf = (t, name) => t.kd[name] || (t.kd[name] = { k: 0, d: 0 });
const SHOTS = new Map(); let shotSeq = 1;   // постріли (id снаряда), щоб розпізнати «один снаряд — кілька вбивств»
function trimShots(now) { for (const [k, s] of SHOTS) { if (now - s.t > 8000) SHOTS.delete(k); else break; } }
// o: { outcomes:{socketId:'win'|'loss'|'draw'}, rewards:{}, xp:{}, drops:{}, place:{}, wave, waves }
function emitMatchEnd(r, o) {
    try {
        const t = matchTally.get(r.id) || { t0: Date.now(), kd: Object.create(null) }; matchTally.delete(r.id);
        const ps = Object.values(r.players), rank = { win: 0, draw: 1, loss: 2 };
        const order = ps.slice().sort((a, b) => (rank[(o.outcomes || {})[a.id] || 'loss'] - rank[(o.outcomes || {})[b.id] || 'loss']) || ((b.score | 0) - (a.score | 0)));
        const list = ps.map(p => {
            const kd = t.kd[p.name] || { k: 0, d: 0 };
            return { id: p.id, name: p.name, isBot: !!p.isBot, outcome: (o.outcomes || {})[p.id] || 'loss', kills: kd.k, deaths: kd.d, credits: (o.rewards && o.rewards[p.id]) | 0,
                xp: (o.xp && o.xp[p.id]) || null, dropped: (o.drops && o.drops[p.id]) || null, place: (o.place && o.place[p.id]) || (order.indexOf(p) + 1),
                team: p.team || null, caps: p.caps | 0, brPicks: p.brPicks | 0 };
        });
        Ev.emit('matchEnd', { roomId: r.id, mode: r.mode, durationMs: Math.max(0, Date.now() - t.t0), players: list, wave: o.wave == null ? null : o.wave, waves: o.waves == null ? null : o.waves, score: o.score || null });
    } catch (e) { console.error('❌ matchEnd:', e && e.message); }
}

// УНІВЕРСАЛЬНА ФУНКЦІЯ ОБРОБКИ СМЕРТІ ТА РЕСПАВНУ
// meta (необов'язково): { weapon } — тип снаряда/джерело шкоди для події 'kill'
function processPlayerDeath(r, victimId, killerId, meta) {
    let v = r.players[victimId];
    if (!v) return;
    v.buff = null;
    v.onFire = null;
    
    io.to(r.id).emit('playerDied', { id: victimId, killer: killerId, w: cleanWeapon(meta && meta.weapon) || undefined });   // w — зброя (кілкам у звичайних сесіях)
    
    let atk = (killerId && r.players[killerId]) ? r.players[killerId] : null;
    if (atk && dbUsers[atk.name] && r.mode !== 'prophunt') {
        dbUsers[atk.name].stats.kills++;
        saveUser(atk.name);
    }
    try {
        const ta = tallyOf(r);
        kdOf(ta, v.name).d++;
        if (atk && atk.name !== v.name) kdOf(ta, atk.name).k++;
        Ev.emit('kill', { roomId: r.id, mode: r.mode, killerName: atk ? atk.name : null, killerBot: !!(atk && atk.isBot), victimName: v.name, victimBot: !!v.isBot, weapon: cleanWeapon(meta && meta.weapon) });
    } catch (e) { console.error('❌ kill event:', e && e.message); }

    if (Modes.has(r.mode)) { Modes.onDeath(r, v, killerId); return; }
    if (r.mode === 'team_deathmatch') {
        if (atk && atk.team && atk.team !== v.team) {
            r.teamScores[atk.team]++;
            if (r.teamScores[atk.team] >= r.tdmScore) {
                endTDMGame(r, atk.team);
                return;
            }
        }
        setTimeout(() => {
            if (rooms[r.id] && rooms[r.id].players[victimId] && rooms[r.id].status === 'playing') {
                v.hp = getMaxHp(v.equipped);
                let sp = getValidSpawn(r.map, 24, 'spawn_player');
                const ts = r.teamSpawns && r.teamSpawns[v.team];
                if (ts) {
                    let rx = ts.x + (Math.random() * 80 - 40), ry = ts.y + (Math.random() * 80 - 40);
                    sp = checkCollisionServer(r.map, rx, ry, 24) ? { x: ts.x, y: ts.y } : { x: rx, y: ry };
                }
                v.x = sp.x; v.y = sp.y;
                io.to(r.id).emit('playerRespawn', v);
            }
        }, 3000);
    } else if (r.mode === 'deathmatch') {
        const tid = 'tkn_' + Date.now() + Math.random();
        r.tokens[tid] = { id: tid, x: v.x, y: v.y, color: v.color, active: true };
        // ліміт жетонів на мапі: найстаріші зникають (інакше список росте весь бій і щотіку серіалізується й розсилається всім)
        const tks = Object.keys(r.tokens); for (let i = 0; i < tks.length - 60; i++) delete r.tokens[tks[i]];
        setTimeout(() => {
            if (rooms[r.id] && rooms[r.id].players[victimId] && rooms[r.id].status === 'playing') {
                v.hp = getMaxHp(v.equipped);
                let sp = getValidSpawn(r.map, 24, 'spawn_player');
                v.x = sp.x; v.y = sp.y;
                io.to(r.id).emit('playerRespawn', v);
            }
        }, 3000);
    } else if (r.mode === 'prophunt') {
        let hA = Object.values(r.players).filter(pl => pl.team === 'hider' && pl.hp > 0).length;
        if (hA === 0) endPropHuntGame(r, 'hunter');
    }
}
// Реєстрація: 3-12 символів (літери, цифри, _ та -). Для входу старі акаунти не обмежуємо.
const NAME_RE = /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9_-]{3,12}$/;
// Нові акаунти: логін ТІЛЬКИ латиницею, пароль — лише друковані ASCII (без пробілів/кирилиці/емодзі). NAME_RE лишається для старих логінів/ботів.
const LOGIN_RE_NEW = /^[A-Za-z0-9_-]{3,12}$/;
const PASS_RE_NEW = /^[\x21-\x7E]{4,128}$/;
function readCreds(data) {
    if (!data || typeof data.name !== 'string' || typeof data.password !== 'string') return null;
    return { name: data.name.trim(), password: data.password };
}
// Пошук акаунта для входу: точний збіг, інакше без урахування регістру (клієнт деякий час надсилав логін ВЕЛИКИМИ літерами)
function findLogin(name, pwdHash) {
    if (!name) return null;
    if (Object.prototype.hasOwnProperty.call(dbUsers, name) && dbUsers[name].password === pwdHash) return name;
    const low = name.toLowerCase();
    return Object.keys(dbUsers).find(k => k.toLowerCase() === low && dbUsers[k].password === pwdHash) || null;
}
// Штраф мисливцю за промах у хованках. 0 = вимкнено. Наприклад 10 = мінус 10 HP за промах (HP не опуститься нижче 1).
const HUNTER_MISS_PENALTY = 0;

// --- Валідація параметрів кімнати (клієнт обмежує їх, але сервер не повинен вірити клієнту) ---
function clampInt(v, min, max, def) {
    const n = parseInt(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(min, Math.min(max, n));
}
const ModeInfo = require('./public/js/modeinfo.js');   // спільне з клієнтом: режими, параметри, нагороди
const VALID_MODES = ModeInfo.ORDER.slice();
const Modes = require('./modes.js')({ io, rooms, dbUsers, MAP_DATA, MapObj, Nav, Z_TYPES, waveScale, getValidSpawn, getValidEdgeSpawn, checkCollisionServer, getMaxHp,
    grantXp, rollDrop, saveUser, ecoPayload, pushRooms, zombieTick, processPlayerDeath, emitMatchEnd, ZOMBIE_CAP, ZOMBIE_SPAWN_BASE, ZOMBIE_SPAWN_STEP });
const teamsOf = r => r.mode === 'rounds' || r.ranked ? 2 : r.mode === 'capture_points' ? Math.max(2, Math.min(4, r.cpTeams || 2)) : Math.max(2, Math.min(4, r.tdmTeams || 2));
const isTeamPvp = m => m === 'team_deathmatch' || m === 'capture_points' || m === 'rounds';
const powerupsOn = m => m !== 'prophunt' && m !== 'team_deathmatch' && m !== 'rounds';
// мапа для режиму: бажана, якщо вона дозволена в цьому режимі (поле modes з редактора), інакше перша дозволена
function pickMap(want, mode) {
    if (MAP_DATA[want] && MapObj.mapAllows(MAP_DATA[want], mode)) return want;
    return Object.keys(MAP_DATA).find(k => MapObj.mapAllows(MAP_DATA[k], mode)) || Object.keys(MAP_DATA)[0] || 'epic_map';
}
const VALID_COLORS = ['white', 'black', 'red', 'blue', 'brown', 'purple', 'green', 'yellow', 'orange', 'cyan'];   // 10 кольорів = макс. гравців у кімнаті
const TDM_TEAMS = ['red', 'blue', 'green', 'yellow']; // порядок як у кнопках лобі

// Повернути кімнату в лобі (кінець гри, скасування гри) з повним очищенням ігрового стану.
// backId — хто натиснув «Повернутись у сесію» після бою: у лобі одразу потрапляє лише він (і боти), решта людей лишаються
// на екрані результатів зі статусом «У грі» (p.away), доки самі не натиснуть кнопку. Без backId (бій скасовано) — повертаються всі.
function resetRoomToLobby(r, backId) {
    r.status = 'lobby'; r.state = 'waiting'; matchTally.delete(r.id);
    r.powerups = {}; r.tokens = {}; r.zombies = {}; r.mines = {}; r.wave = 1; Modes.cleanup(r.id);
    Object.values(r.players).forEach(p => {
        p.ready = false; p.score = 0; p.hp = getMaxHp(p.equipped); p.buff = null; p.out = false; p.lives = 0; p.perk = null; p.caps = 0;
        p.stuckIn = []; p.onFire = null; p.isDisguised = false; if (!p.isBot) p.level = playerLevel(p.name);
        p.away = !!(backId && !p.isBot && p.id !== backId);
    });
    io.to(r.id).emit('updateLobby', r);
    pushRooms();
}

// Єдина логіка виходу гравця з кімнати (кнопка «Вийти» і розрив з'єднання)
function removePlayer(rId, sockId) {
    const r = rooms[rId];
    if (!r || !r.players[sockId]) return;
    const left = r.players[sockId];
    delete r.players[sockId];
    if (r.ranked && hooks.rankedLeave) { try { hooks.rankedLeave(r, left); } catch (e) { console.error('❌ rankedLeave', e && e.message); } }   // рейтинг: дезертирство = поразка, місце займає бот
    const ids = Object.keys(r.players);
    if (ids.length === 0) { delete rooms[rId]; matchTally.delete(rId); if (typeof SYNCS !== "undefined") SYNCS.delete(rId); BANS.delete(rId); Modes.cleanup(rId); return; }
    if (r.hostSocket === sockId) { r.hostSocket = ids[0]; r.hostName = r.players[ids[0]].name; }
    if (r.status === 'playing') {
        let abort = false;
        // Виживання - кооператив: гра триває, поки лишається хоч один гравець. Інші режими потребують мінімум 2.
        // нові кооп-режими теж тривають, поки лишається хоч один гравець; королівський бій при одному гравцеві визначає переможця
        if (!ModeInfo.isPve(r.mode) && r.mode !== 'battle_royale' && ids.length < 2) abort = true;
        else if (isTeamPvp(r.mode) && new Set(ids.map(id => r.players[id].team)).size < 2) abort = true;
        if (abort) { resetRoomToLobby(r); return; }
        if (Modes.has(r.mode)) { Modes.afterLeave(r, left); if (r.status !== 'playing') return; }
        if (r.mode === 'prophunt') {
            if (left.team === 'hider' && !ids.some(id => r.players[id].team === 'hider' && r.players[id].hp > 0)) endPropHuntGame(r, 'hunter');
            else if (left.team === 'hunter' && !ids.some(id => r.players[id].team === 'hunter' && r.players[id].hp > 0)) endPropHuntGame(r, 'hider');
            return;
        }
    }
    io.to(rId).emit('updateLobby', r);
}

// ===== ADVENT: єдиний авторитетний часовий пояс івенту =====
const ADVENT_TZ = process.env.ADVENT_TZ || 'Europe/Kiev';
function tzParts(date) {
    let f = new Intl.DateTimeFormat('en-GB', { timeZone: ADVENT_TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    let o = {}; f.formatToParts(date).forEach(p => { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
    return { year: o.year, month: o.month - 1, day: o.day, hour: o.hour, minute: o.minute, second: o.second };
}
function tzOffsetMs(date) { let p = tzParts(date); return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000; }
function adventEndMs(year) {
    let guess = Date.UTC(year, 9, 31, 23, 59, 59), t = guess - tzOffsetMs(new Date(guess));
    return guess - tzOffsetMs(new Date(t));
}
function adventState() {
    let now = new Date(), p = tzParts(now);
    return { day: p.month === 9 ? p.day : 0, end: adventEndMs(p.year), now: now.getTime() };
}

// Запуск гри в кімнаті (кнопка лідера і боти-лідери з bots.js). notify(msg) — причина відмови. Повертає true, якщо гру запущено.
function startRoomGame(roomId, notify) {
    notify = notify || function () {};
    let r = rooms[roomId];
    if (r && r.status === 'lobby') {
        const pK = Object.keys(r.players);
        if (pK.length >= ModeInfo.minPlayers(r.mode) && pK.every(id => r.players[id].ready)) {
            if (r.mode === 'prophunt') {
                const nHunt = pK.filter(id => r.players[id].team === 'hunter').length, nHide = pK.filter(id => r.players[id].team === 'hider').length;
                if (nHunt < 1 || nHide < 1) return notify('Для Хованок потрібен хоча б один мисливець і один, хто ховається!');
                if (nHunt > r.hunterCount) return notify(`Забагато мисливців (максимум ${r.hunterCount})!`);
            }
            if (isTeamPvp(r.mode)) {
                let c = {};
                pK.forEach(id => { let t = r.players[id].team; if (t) c[t] = (c[t] || 0) + 1; });
                let aT = Object.keys(c);
                if (aT.length < 2) return notify('Для Командного бою потрібно мінімум 2 команди!');
                if (r.tdmAutoBalance) {
                    let v = Object.values(c);
                    if (Math.max(...v) - Math.min(...v) > 1) return notify('Увімкнено Автобаланс: склади команд не рівні!');
                }
                const cM = MAP_DATA[r.map] ? r.map : 'epic_map';
                let sPts = MAP_DATA[cM].solids.filter(s => s.type === 'spawn_player');
                if (sPts.length < aT.length) return notify(`На мапі недостатньо точок спавну (${sPts.length}) для ${aT.length} команд!`);
                r.teamScores = {};
                aT.forEach(t => r.teamScores[t] = 0);
                if (r.mode === 'team_deathmatch') r.timeEndTime = Date.now() + 4000 + (r.tdmTime * 1000);
                let tS = {};
                aT.forEach((t, i) => tS[t] = sPts[i % sPts.length]);
                r.teamSpawns = {}; aT.forEach(t => r.teamSpawns[t] = { x: tS[t].x, y: tS[t].y });
                pK.forEach(id => {
                    let p = r.players[id];
                    p.hp = getMaxHp(p.equipped);
                    p.score = 0; p.buff = null; p.stuckIn = []; p.onFire = null; p.color = p.team;
                    let sp = tS[p.team];
                    let rx = sp.x + (Math.random() * 80 - 40), ry = sp.y + (Math.random() * 80 - 40);
                    if (checkCollisionServer(cM, rx, ry, 24)) { rx = sp.x; ry = sp.y; }
                    p.x = rx; p.y = ry;
                });
            } else {
                pK.forEach(id => {
                    let p = r.players[id];
                    p.hp = getMaxHp(p.equipped);
                    p.score = 0; p.buff = null; p.stuckIn = []; p.onFire = null;
                    let sp = getValidSpawn(r.map, 24, 'spawn_player');
                    p.x = sp.x; p.y = sp.y;
                });
            }
            r.status = 'playing'; matchTally.set(roomId, { t0: Date.now(), kd: Object.create(null) });
            r.powerups = {}; r.mines = {}; r.tokens = {}; r.zombies = {}; r.lastPowerupSpawn = Date.now();
            if (Modes.has(r.mode)) { SYNCS.delete(roomId); Modes.start(r, pK, Date.now()); }
            
            if (r.mode === 'survival') {
                r.wave = 0; r.state = 'waiting'; r.nextWaveTime = Date.now() + 4000; r.zombies = {};
            } else if (r.mode === 'prophunt') {
                r.state = 'hiding'; r.phaseEndTime = Date.now() + 4000 + (r.hideTime * 1000);
                const prps = Array.from(MapObj.DISGUISE_IDS);
                pK.forEach(id => {
                    if (r.players[id].team === 'hider') {
                        r.players[id].propType = prps[Math.floor(Math.random() * prps.length)];
                        r.players[id].isDisguised = false;
                    }
                });
            }
            io.to(roomId).emit('gameStarting', r);
            pushRooms();
            return true;
        }
    }
    return false;
}

// ===== Античит: швидкість руху =====
// Клієнт шле позицію ~20 разів/с. Сервер тримає «бюджет» відстані: швидкість танка (модулі, бафи, покращення арени) × час × запас 1.3
// + 40 px на нерівномірну мережу. Більше — позицію обрізаємо до дозволеної й повертаємо клієнту ('posFix').
// Телепорт від сервера (спавн, відродження, новий раунд) помічаємо за тим, що p.x/p.y змінились не з цього обробника.
const AC = new WeakMap();
function maxSpeedOf(r, p) {
    let s = 200 * GameData.statMult(p.equipped, 'speed');
    if (p.buff === 'speed') s *= 1.5; else if (p.buff === 'samurai') s *= 1.6;
    if (r.mode === 'solo_arena') s *= 1.35;
    return s;
}
function speedCheck(r, p, x, y, socket) {
    const now = Date.now(); let s = AC.get(p);
    if (!s || s.x !== p.x || s.y !== p.y || s.room !== r.id) { s = { x: p.x, y: p.y, t: now, bud: 60, room: r.id, bad: 0, badAt: 0, fixAt: 0 }; AC.set(p, s); }
    const dt = Math.min(1.5, Math.max(0, (now - s.t) / 1000)); s.t = now;
    s.bud = Math.min(maxSpeedOf(r, p) * 1.3 * 1.5 + 60, s.bud + maxSpeedOf(r, p) * 1.3 * dt + 2);
    const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
    if (d <= s.bud + 40) { s.bud = Math.max(0, s.bud - d); s.x = x; s.y = y; return [x, y]; }
    const k = Math.max(0, s.bud) / d, nx = s.x + dx * k, ny = s.y + dy * k;      // дозволена частина шляху
    s.bud = 0; s.x = nx; s.y = ny;
    if (now - s.badAt > 10000) s.bad = 0; s.bad++; s.badAt = now;
    if (s.bad === 25) console.warn('⚠️ Античит: підозріла швидкість', p.name, r.id);
    if (now - s.fixAt > 250) { s.fixAt = now; socket.emit('posFix', { x: Math.round(nx), y: Math.round(ny) }); }
    return [nx, ny];
}

// Запис гравця-людини в кімнаті (лобі, швидка гра, рейтинговий матч)
function newPlayerEntry(sockId, n) {
    const uEq = (dbUsers[n] && dbUsers[n].equipped) ? dbUsers[n].equipped : { cannon: null, turret: null, hull: null, tracks: null };
    return {
        id: sockId, name: n, color: null, team: null, ready: false,
        hp: getMaxHp(uEq), score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0,
        buff: null, buffEndTime: 0, buffProgress: 0, stuckIn: [], laserTarget: null,
        onFire: null, equipped: uEq, propType: 'prop_crate', isDisguised: false, level: playerLevel(n),
        nick: nickOf(n), clan: hooks.clanTag(n) || '', stats: lobbyStats(n)
    };
}
// Вхід у кімнату (кнопка в списку сесій, запрошення друга, швидка гра). Повертає кімнату або null (помилку отримує клієнт).
function joinRoomFor(socket, roomId, quiet) {
    const n = globalPlayers[socket.id];
    const fail = msg => { socket.emit(quiet ? 'quickPlayResult' : 'joinError', quiet ? { ok: false, msg } : msg); return null; };
    if (!n || !dbUsers[n]) return fail('Помилка авторизації');
    if (typeof roomId !== 'string') return fail('Кімната не знайдена');
    try { if (hooks.preJoin(socket, roomId, n)) return null; } catch (e) { console.error('❌ preJoin', e && e.message); }   // bots.js: віртуальні сесії, бот звільняє місце
    const r = rooms[roomId];
    if (!r || r.ranked) return fail('Кімната не знайдена');
    if (r.players[socket.id]) { socket.emit('joinedRoom', { roomId: roomId, roomData: r }); return r; } // вже тут
    if (BANS.has(roomId) && BANS.get(roomId).has(n)) return fail('Лідер заблокував вас у цій сесії');
    for (const rid in rooms) for (const pid in rooms[rid].players) if (rooms[rid].players[pid].name === n) return fail('Цей акаунт уже перебуває в сесії!');
    if (hooks.inRankedQueue && hooks.inRankedQueue(n)) hooks.leaveRankedQueue(n);    // зайшов у звичайну сесію — виходимо з черги рейтингу
    if (Object.keys(r.players).length >= r.maxPlayers) return fail('Кімната повна');
    if (r.status !== 'lobby') return fail('Гра вже почалася');
    socket.join(roomId);
    r.players[socket.id] = newPlayerEntry(socket.id, n);
    socket.emit('joinedRoom', { roomId: roomId, roomData: r });
    io.to(roomId).emit('updateLobby', r);
    pushRooms();
    return r;
}

// Підбір жетона (детматч): сокет-обробник і боти. Повертає true, якщо жетон зараховано.
function collectTokenFor(roomId, sockId, tid) {
    let r = rooms[roomId];
    if (!r || r.status !== 'playing' || !r.tokens[tid] || !r.tokens[tid].active || !r.players[sockId] || r.players[sockId].hp <= 0) return;
    r.tokens[tid].active = false; r.players[sockId].score += 1;
    
    if (r.players[sockId].score >= r.winScore && r.mode === 'deathmatch') {
        r.status = 'finished';
        let mt = 1 + Math.max(0, r.winScore - 5) * 0.10, bW = Math.round(10 * mt), bL = Math.round(2 * mt), rw = {}, xpm = {}, drp = {}, ocm = {};
        Object.values(r.players).forEach(p => {
            let a = Math.round(p.id === sockId ? bW : bL); rw[p.id] = a; ocm[p.id] = p.id === sockId ? 'win' : 'loss';
            if (dbUsers[p.name]) {
                dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
                xpm[p.id] = grantXp(p.name, p.id === sockId ? 'win' : 'loss');
                let dr = rollDrop(p.name); drp[p.id] = dr; saveUser(p.name);
                io.to(p.id).emit('economyUpdate', ecoPayload(p.name));
                if (dr) io.to(p.id).emit('dropReceived', dr);
            }
        });
        io.to(roomId).emit('tokenCollected', { tid: tid, playerId: sockId, score: r.players[sockId].score });
        io.to(roomId).emit('gameOver', { winner: sockId, name: r.players[sockId] ? r.players[sockId].name : 'ГРАВЕЦЬ', rewards: rw, xp: xpm, isTeamWin: false });
        emitMatchEnd(r, { outcomes: ocm, rewards: rw, xp: xpm, drops: drp });
        pushRooms();
    } else {
        io.to(roomId).emit('tokenCollected', { tid: tid, playerId: sockId, score: r.players[sockId].score });
    }
    delete r.tokens[tid];
}

io.on('connection', (socket) => {
    connHooks.forEach(f => { try { f(socket); } catch (e) { console.error('❌ connHook', e && e.message); } });
    rescanMusicSoon();
    socket.emit('initMusic', musicData);
    socket.emit('initZombies', Z_TYPES_CLIENT);
    // клієнт створює сокет раніше, ніж network.js підписується на події, тож перші initMusic/initZombies можуть загубитися — він перепитує
    let initAsks = 0;
    socket.on('getInit', () => { if (++initAsks > 20) return; rescanMusicSoon(); socket.emit('initMusic', musicData); socket.emit('initZombies', Z_TYPES_CLIENT); });

    socket.on('register', (data) => {
        const creds = readCreds(data);
        if (!creds) return socket.emit('joinError', 'Некоректні дані!');
        const { name, password } = creds;
        if (!LOGIN_RE_NEW.test(name)) return socket.emit('joinError', 'Логін: 3-12 символів, лише латиниця, цифри, _ та -');
        if (!PASS_RE_NEW.test(password)) return socket.emit('joinError', 'Пароль: 4-128 символів, лише латиниця, цифри та знаки (без пробілів і кирилиці)');
        if (Object.prototype.hasOwnProperty.call(dbUsers, name) || (hooks.botNames && hooks.botNames.has(name.toLowerCase())) || (hooks.nameTaken && hooks.nameTaken(name))) return socket.emit('joinError', 'Цей логін вже зайнятий!');
        const token = crypto.randomUUID();
        dbUsers[name] = validateUser({ name: name, password: hashPwd(password), token: token, bucks: 0, lang: cleanLang(data && data.lang) });
        globalPlayers[socket.id] = name;
        // новий акаунт: реферальний код (запрошення друга) і навчання новачка — обробляють referral.js / tutorial.js
        Ev.emit('register', { name, socketId: socket.id, ref: data && (typeof data.ref === 'string' || typeof data.ref === 'number') ? String(data.ref).slice(0, 16) : null, ip: ipHashOf(socket) });
        saveUser(name, true);
        tokenIdx.set(token, name);
        socket.emit('authSuccess', { name, token, lang: dbUsers[name].lang });
        sendEconomy(socket.id, name);
        Ev.emit('login', { name, socketId: socket.id });
    });

    socket.on('login', (data) => {
        const creds = readCreds(data);
        if (!creds) return socket.emit('joinError', 'Невірний логін або пароль!');
        const { password } = creds;
        const name = findLogin(creds.name, hashPwd(password));
        let u = name ? dbUsers[name] : null;
        if (!u) return socket.emit('joinError', 'Невірний логін або пароль!');
        const bn = banInfo(u); if (bn) return socket.emit('joinError', bn);
        const token = crypto.randomUUID();
        if (u.token) tokenIdx.delete(u.token);
        u.token = token; tokenIdx.set(token, name);
        u = validateUser(u);
        saveUser(name);
        globalPlayers[socket.id] = name;
        socket.emit('authSuccess', { name, token, lang: cleanLang(u.lang) });
        sendEconomy(socket.id, name);
        Ev.emit('login', { name, socketId: socket.id });
    });

    // зміна мови інтерфейсу — зберігається за акаунтом
    socket.on('setLang', (lang) => {
        const n = globalPlayers[socket.id], l = cleanLang(lang);
        if (!n || !dbUsers[n] || !l || dbUsers[n].lang === l) return;
        dbUsers[n].lang = l;
        saveUser(n);
    });

    socket.on('authToken', (token) => {
        if (typeof token !== 'string' || !token || token.length > 80) return socket.emit('authError', 'Сесія закінчилась, увійдіть знову');
        const foundName = loginByToken(token);
        if (foundName) {
            const bn = banInfo(dbUsers[foundName]); if (bn) return socket.emit('authError', bn);
            globalPlayers[socket.id] = foundName;
            const hadLvl = !!dbUsers[foundName].levelRewards;
            dbUsers[foundName] = validateUser(dbUsers[foundName]);
            if (!hadLvl) saveUser(foundName);     // нагороди за рівні створюються один раз і зберігаються
            socket.emit('authSuccess', { name: foundName, token, lang: cleanLang(dbUsers[foundName].lang) });
            sendEconomy(socket.id, foundName);
            Ev.emit('login', { name: foundName, socketId: socket.id });
        } else socket.emit('authError', 'Сесія закінчилась, увійдіть знову');
    });

    socket.emit('adventState', adventState());
    socket.on('getAdventState', () => socket.emit('adventState', adventState()));

    socket.on('claimAdvent', () => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], st = adventState(), day = st.day;
        socket.emit('adventState', st);
        if (!u.adventClaims) u.adventClaims = [];
        if (day === 0) return socket.emit('promoError', 'Івент проходить лише в жовтні!');
        if (day < 3) return socket.emit('promoError', 'Івент ще не почався!');
        if (u.adventClaims.includes(day)) return socket.emit('promoError', 'Сьогоднішня нагорода вже отримана!');
        if (day === 31) {
            if (u.adventClaims.length + 1 < 20) return socket.emit('promoError', 'Недостатньо зібраних днів (мінімум 20) для фінальної нагороди!');
            if (u.inventory.length >= 30) return socket.emit('promoError', 'Інвентар повний! Звільніть місце для легендарної нагороди.');
            u.adventClaims.push(day);
            let modId = getRandomModuleFromCase(GameData.legendCaseId());
            u.inventory.push(modId);
            socket.emit('adventSuccess', { type: 'legendary', item: modId, day: day });
        } else {
            u.adventClaims.push(day);
            let reward = 20 + (day - 3) * 5;
            u.bucks += reward;
            u.stats.earned += reward;
            socket.emit('adventSuccess', { type: 'bucks', amount: reward, day: day });
        }
        saveUser(name);
        sendEconomy(socket.id, name);
    });

    // Промокод: клієнт надсилає лише текст коду; сума, ліміти й одноразовість рахуються на сервері (redeemPromoCode)
    function handlePromo(code, legacy) {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        const res = redeemPromoCode(name, code);
        if (res.ok) { saveUser(name); sendEconomy(socket.id, name); }
        if (legacy) socket.emit(res.ok ? 'promoSuccess' : 'promoError', res.msg);
        else socket.emit('promoResult', res);
        if (res.ok) Ev.emit('promoRedeemed', { name, code: String(code).trim().toUpperCase(), socketId: socket.id });   // навчання новачка слухає код START
    }
    socket.on('redeemPromo', (d) => handlePromo(d && typeof d === 'object' ? d.code : d, false));
    socket.on('usePromo', (code) => handlePromo(code, true));   // сумісність зі старими клієнтами

    socket.on('buyCase', (caseId) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name];
        if (u.inventory.length >= 30) return socket.emit('joinError', 'Інвентар повний (макс 30)!');
        let cs = CASES[caseId];
        if (!cs) return;
        if (u.bucks >= cs.price) {
            u.bucks -= cs.price;
            let modId = getRandomModuleFromCase(caseId);
            if (modId) {
                u.inventory.push(modId);
                saveUser(name);
                socket.emit('caseResult', { modId: modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId: caseId });
                Ev.emit('caseOpened', { name, caseId, modId, price: cs.price, fromLevel: false });
            } else { u.bucks += cs.price; } // кейс не видав предмет - повертаємо креди
        } else socket.emit('joinError', 'Недостатньо кредів!');
    });

    socket.on('upgradeItem', (d) => {
        let n = globalPlayers[socket.id];
        if (!n || !dbUsers[n]) return;
        let u = dbUsers[n], sId = u.inventory[d.idx];
        if (!sId) return socket.emit('joinError', 'Помилка предмета!');
        let sMod = MODULES[sId], tMod = MODULES[d.target];
        if (!sMod || !tMod) return;
        let pIn = sMod.price || 5, pOut = tMod.price || 5;
        if (pIn >= pOut) return socket.emit('joinError', 'Ви не можете апгрейднути в дешевший або такий самий предмет!');
        let b = parseInt(d.bucks) || 0;
        if (b < 0 || u.bucks < b) return socket.emit('joinError', 'Недостатньо кредів!');
        u.bucks -= b;
        u.inventory.splice(d.idx, 1);
        let ch = GameData.upgradeChance(pIn, b, tMod), roll = Math.random() * 100, win = d.rollUnder ? (roll <= ch) : (roll >= (100 - ch));
        if (win) u.inventory.push(d.target);
        saveUser(n);
        sendEconomy(socket.id, n);
        Ev.emit('upgradeDone', { name: n, win, srcId: sId, tgtId: d.target });
        socket.emit('upgradeResult', { win: win, roll: roll, ch: ch, under: d.rollUnder, newBucks: u.bucks, inv: u.inventory, tId: d.target });
    });

    // ===== Нагороди за рівні =====
    socket.on('claimLevelReward', (lvl) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name]; lvl = parseInt(lvl);
        if (!(lvl >= 2 && lvl <= GameData.MAX_LEVEL)) return;
        if (GameData.levelFromXp(u.xp) < lvl) return socket.emit('joinError', 'Цей рівень ще не досягнуто!');
        if (u.levelClaims.includes(lvl)) return;
        if (u.inventory.length >= 30) return socket.emit('joinError', 'Інвентар повний (макс 30)!');
        const caseId = u.levelRewards[lvl];
        let modId = getRandomModuleFromCase(caseId);
        if (!modId) return;
        u.levelClaims.push(lvl);
        u.inventory.push(modId);
        saveUser(name);
        socket.emit('caseResult', { modId: modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId: caseId, fromLevel: lvl });
        sendEconomy(socket.id, name);
        Ev.emit('caseOpened', { name, caseId, modId, price: 0, fromLevel: true });
    });

    socket.on('reorderInventory', (newInv) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name];
        if (Array.isArray(newInv) && newInv.length === u.inventory.length) {
            u.inventory = newInv;
            saveUser(name);
        }
    });

    socket.on('unequipModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], modId = u.equipped[data.type];
        if (modId) {
            if (u.inventory.length < 30) {
                u.inventory.push(modId);
                u.equipped[data.type] = null;
                saveUser(name);
                sendEconomy(socket.id, name);
                for (let rId in rooms) {
                    let r = rooms[rId];
                    if (r.players[socket.id] && r.status === 'lobby') {
                        r.players[socket.id].equipped = u.equipped;
                        r.players[socket.id].hp = getMaxHp(u.equipped);
                        io.to(rId).emit('updateLobby', r);
                    }
                }
            } else socket.emit('joinError', 'Інвентар повний!');
        }
    });

    socket.on('equipModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            if (u.equipped[data.type]) u.inventory.push(u.equipped[data.type]);
            u.equipped[data.type] = data.id;
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
            Ev.emit('moduleEquipped', { name, modId: data.id });
            for (let rId in rooms) {
                let r = rooms[rId];
                if (r.players[socket.id] && r.status === 'lobby') {
                    r.players[socket.id].equipped = u.equipped;
                    r.players[socket.id].hp = getMaxHp(u.equipped);
                    io.to(rId).emit('updateLobby', r);
                }
            }
        }
    });

    socket.on('sellModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            let modPr = MODULES[data.id] ? MODULES[data.id].price : 10;
            u.bucks += modPr;
            u.stats.earned += modPr;
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
            Ev.emit('moduleSold', { name, modId: data.id, price: modPr });
        }
    });

    socket.on('dropModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
        }
    });

    socket.on('requestRooms', () => { socket.join('rb'); socket.emit('roomsList', getActiveRooms()); });
    socket.on('rbLeave', () => { socket.leave('rb'); });

    socket.on('createRoom', (c) => {
        if (!c || typeof c !== 'object') c = {};
        let n = globalPlayers[socket.id];
        if (!n || !dbUsers[n]) return socket.emit('joinError', 'Помилка авторизації');
        let rId = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        rooms[rId] = {
            id: rId, hostName: n, hostSocket: socket.id, mode: VALID_MODES.includes(c.mode) ? c.mode : 'deathmatch',
            map: pickMap(c.map, VALID_MODES.includes(c.mode) ? c.mode : 'deathmatch'),
            maxPlayers: Math.max(2, Math.min(10, parseInt(c.maxPlayers) || 6)),
            winScore: clampInt(c.winScore, 5, 1000, 50),
            hideTime: clampInt(c.hideTime, 30, 200, 30), seekTime: clampInt(c.seekTime, 120, 600, 120),
            hunterCount: clampInt(c.hunterCount, 1, 9, 1), tdmTeams: clampInt(c.tdmTeams, 2, 4, 2),
            tdmTime: clampInt(c.tdmTime, 60, 300, 180), tdmScore: clampInt(c.tdmScore, 5, 50, 20),
            tdmAutoBalance: c.tdmAutoBalance !== undefined ? !!c.tdmAutoBalance : true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0,
            players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {},
            wave: 1, nextWaveTime: 0, lastPowerupSpawn: Date.now()
        };
        { const nr = rooms[rId]; nr.mpPref = nr.maxPlayers; Modes.readSettings(nr, c); if (ModeInfo.isSolo(nr.mode)) nr.maxPlayers = 1; }   // соло-режими: у сесії лише один гравець
        socket.emit('roomCreated', rId);
        pushRooms();
    });

    socket.on('joinRoom', (roomId) => { joinRoomFor(socket, roomId); });

    // ===== Швидка гра: кидає гравця в ІСНУЮЧЕ лобі (з людьми або ботами). Нових кімнат не створює. =====
    let qpAt = 0;
    socket.on('quickPlay', () => {
        const n = globalPlayers[socket.id], fail = msg => socket.emit('quickPlayResult', { ok: false, msg });
        if (!n || !dbUsers[n]) return fail('Спершу увійдіть в акаунт');
        const now = Date.now(); if (now - qpAt < 1500) return; qpAt = now;
        for (const rid in rooms) for (const pid in rooms[rid].players) if (rooms[rid].players[pid].name === n) {
            if (rooms[rid].status === 'lobby' && !rooms[rid].ranked) { socket.emit('joinedRoom', { roomId: rid, roomData: rooms[rid] }); return; }
            return fail('Ви вже перебуваєте в сесії');
        }
        const cand = [];
        for (const rid in rooms) {
            const r = rooms[rid]; if (r.ranked || r.status !== 'lobby' || ModeInfo.isSolo(r.mode)) continue;
            if (BANS.has(rid) && BANS.get(rid).has(n)) continue;
            const ps = Object.values(r.players), humans = ps.filter(p => !p.isBot).length, bots = ps.length - humans;
            if (ps.length >= r.maxPlayers && !ps.some(p => p.isBot && p.id !== r.hostSocket)) continue;   // повна й немає бота, що звільнить місце
            if (!humans && !bots) continue;
            cand.push({ id: rid, sc: humans * 100 + ps.length * 8 + (ModeInfo.isPve(r.mode) ? 0 : 25) + Math.random() * 20 });
        }
        let extra = []; try { extra = hooks.extraRooms() || []; } catch (e) {}
        extra.forEach(v => { if (v.status === 'lobby' && v.playersCount < v.maxPlayers && v.playersCount > 0) cand.push({ id: v.id, sc: v.playersCount * 8 + 25 + Math.random() * 20 }); });
        if (!cand.length) return fail('Зараз немає відкритих лобі. Спробуйте за кілька секунд або створіть власну сесію');
        cand.sort((a, b) => b.sc - a.sc);
        const r = joinRoomFor(socket, cand[0].id, true); if (!r) return;
        // одразу обираємо вільний камуфляж / найменшу команду й ставимо «готовий» — щоб бій почався якнайшвидше
        const p = r.players[socket.id]; if (!p) return;
        if (r.mode === 'prophunt') { const hunters = Object.values(r.players).filter(q => q.team === 'hunter').length; p.team = hunters < (r.hunterCount || 1) && Math.random() < 0.3 ? 'hunter' : 'hider'; }
        else if (ModeInfo.usesColor(r.mode)) { const taken = new Set(Object.values(r.players).filter(q => q !== p && q.color).map(q => q.color)), free = VALID_COLORS.filter(c => !taken.has(c)); p.color = free.length ? free[Math.floor(Math.random() * free.length)] : null; }
        else if (isTeamPvp(r.mode)) { const allowed = TDM_TEAMS.slice(0, teamsOf(r)), cnt = {}; allowed.forEach(t => cnt[t] = 0); Object.values(r.players).forEach(q => { if (q !== p && cnt[q.team] !== undefined) cnt[q.team]++; }); p.team = allowed.slice().sort((a, b) => cnt[a] - cnt[b])[0]; }
        p.ready = !!(p.color || p.team);
        socket.emit('quickPlayResult', { ok: true, roomId: r.id });
        io.to(r.id).emit('updateLobby', r);
    });

    socket.on('leaveRoom', (roomId) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            socket.leave(roomId);
            removePlayer(roomId, socket.id);
            pushRooms();
        }
    });

    socket.on('updateRoomSettings', (d) => {
        if (!d || typeof d !== 'object') return;
        let r = rooms[d.roomId];
        if (r && r.hostSocket === socket.id && r.status === 'lobby') {
            if (d.mode && VALID_MODES.includes(d.mode)) {
                if (ModeInfo.isSolo(d.mode) && Object.keys(r.players).length > 1) { socket.emit('joinError', 'Соло-режим для одного гравця: спершу приберіть інших гравців із сесії'); return; }
                r.mode = d.mode; r.maxPlayers = ModeInfo.isSolo(r.mode) ? 1 : Math.max(2, r.mpPref || 6);
                Object.values(r.players).forEach(p => { p.ready = false; p.team = null; p.color = null; });
                r.map = pickMap(r.map, r.mode);                     // якщо мапа не підходить режиму — перемикаємо на дозволену
            }
            if (d.map) r.map = pickMap(d.map, r.mode);
            if (d.maxPlayers) { r.mpPref = Math.max(2, Math.min(10, parseInt(d.maxPlayers) || 6)); if (!ModeInfo.isSolo(r.mode)) r.maxPlayers = r.mpPref; }
            if (d.winScore) r.winScore = clampInt(d.winScore, 5, 1000, 50);
            if (d.hunterCount) {
                r.hunterCount = Math.max(1, Math.min(9, Object.keys(r.players).length - 1, clampInt(d.hunterCount, 1, 9, 1)));
                // якщо мисливців стало більше за ліміт - зайвих повертаємо до вибору команди
                Object.values(r.players).filter(p => p.team === 'hunter').slice(r.hunterCount).forEach(p => { p.team = null; p.ready = false; });
            }
            if (d.hideTime) r.hideTime = clampInt(d.hideTime, 30, 200, 30);
            if (d.seekTime) r.seekTime = clampInt(d.seekTime, 120, 600, 120);
            if (d.tdmTeams) {
                r.tdmTeams = clampInt(d.tdmTeams, 2, 4, 2);
                // гравці з команд, яких більше немає, мають обрати наново
                Object.values(r.players).forEach(p => { if (r.mode === 'team_deathmatch' && p.team && !TDM_TEAMS.slice(0, r.tdmTeams).includes(p.team)) { p.team = null; p.ready = false; } });
            }
            if (d.tdmTime) r.tdmTime = clampInt(d.tdmTime, 60, 300, 180);
            if (d.tdmScore) r.tdmScore = clampInt(d.tdmScore, 5, 50, 20);
            if (d.tdmAutoBalance !== undefined) r.tdmAutoBalance = !!d.tdmAutoBalance;
            Modes.applyUpdate(r, d);
            io.to(d.roomId).emit('updateLobby', r);
            pushRooms();
        }
    });

    // ===== Лідер кімнати: вигнати гравця / передати лідерку =====
    socket.on('kickPlayer', (d) => {
        let r = d ? rooms[d.roomId] : null;
        if (!r || r.hostSocket !== socket.id || r.status !== 'lobby' || !d.targetId || d.targetId === socket.id || !r.players[d.targetId]) return;
        const tSock = io.sockets.sockets.get(d.targetId);
        if (tSock) { tSock.leave(r.id); tSock.emit('kicked', { roomId: r.id }); }
        removePlayer(r.id, d.targetId);
        if (rooms[r.id]) io.to(r.id).emit('updateLobby', r);
        pushRooms();
    });

    // Блокування: гравця викидає з сесії, і він більше не зможе зайти саме в цю сесію (інші сесії — без обмежень)
    socket.on('banPlayer', (d) => {
        let r = d ? rooms[d.roomId] : null;
        if (!r || r.hostSocket !== socket.id || r.status !== 'lobby' || !d.targetId || d.targetId === socket.id || !r.players[d.targetId]) return;
        const nm = r.players[d.targetId].name;
        if (!BANS.has(r.id)) BANS.set(r.id, new Set());
        BANS.get(r.id).add(nm);
        const tSock = io.sockets.sockets.get(d.targetId);
        if (tSock) { tSock.leave(r.id); tSock.emit('kicked', { roomId: r.id, banned: true }); }
        removePlayer(r.id, d.targetId);
        if (rooms[r.id]) io.to(r.id).emit('updateLobby', r);
        pushRooms();
    });

    socket.on('transferHost', (d) => {
        let r = d ? rooms[d.roomId] : null;
        if (!r || r.hostSocket !== socket.id || r.status !== 'lobby' || !d.targetId || d.targetId === socket.id || !r.players[d.targetId]) return;
        r.hostSocket = d.targetId; r.hostName = r.players[d.targetId].name;
        io.to(r.id).emit('updateLobby', r);
        pushRooms();
    });

    socket.on('setColor', (d) => {
        let r = d ? rooms[d.roomId] : null;
        if (r && r.status === 'lobby' && r.players[socket.id] && ModeInfo.usesColor(r.mode)
            && VALID_COLORS.includes(d.color) && !Object.values(r.players).some(p => p.id !== socket.id && p.color === d.color)) {
            r.players[socket.id].color = d.color;
            r.players[socket.id].ready = false;
            io.to(d.roomId).emit('updateLobby', r);
        }
    });

    socket.on('setTeam', (d) => {
        let r = d ? rooms[d.roomId] : null;
        if (r && r.status === 'lobby' && r.players[socket.id]) {
            const allowedTeams = r.mode === 'prophunt' ? ['hunter', 'hider'] : (isTeamPvp(r.mode) ? TDM_TEAMS.slice(0, teamsOf(r)) : []);
            if (!allowedTeams.includes(d.team)) return;
            if (r.mode === 'prophunt') {
                let cH = 0;
                Object.values(r.players).forEach(p => { if (p.team === 'hunter' && p.id !== socket.id) cH++; });
                if (d.team === 'hunter' && cH >= r.hunterCount) return;
            }
            r.players[socket.id].team = d.team;
            r.players[socket.id].ready = false;
            io.to(d.roomId).emit('updateLobby', r);
        }
    });

    socket.on('toggleReady', (roomId) => {
        let r = rooms[roomId];
        if (r && r.status === 'lobby' && r.players[socket.id]) {
            if (r.players[socket.id].away) return;                         // ще на екрані результатів
            if (!ModeInfo.usesColor(r.mode) && !r.players[socket.id].team) return;
            if (ModeInfo.usesColor(r.mode) && !r.players[socket.id].color) return;
            r.players[socket.id].ready = !r.players[socket.id].ready;
            io.to(roomId).emit('updateLobby', r);
        }
    });

    socket.on('startGame', (roomId) => {
        const r = rooms[roomId];
        if (r && r.hostSocket === socket.id) startRoomGame(roomId, msg => socket.emit('joinError', msg));
    });
socket.on('selectProp', (data) => {
        if (!data || !data.roomId) return;
        let r = rooms[data.roomId];
        if (r && r.status === 'playing' && r.mode === 'prophunt' && r.players[socket.id]) { if (typeof data.type === 'string' && MapObj.DISGUISE_IDS.has(data.type)) r.players[socket.id].propType = data.type; }
    });

    socket.on('updateDisguise', (data) => {
        if (!data || !data.roomId) return;
        let r = rooms[data.roomId];
        if (r && r.status === 'playing' && r.mode === 'prophunt' && r.players[socket.id]) {
            r.players[socket.id].isDisguised = !!data.state;
            if (data.state) {
                // маскування «прилипає» до сітки 50 px: зсув не більше ~40 px від поточної позиції (без телепортів через цю подію)
                const p = r.players[socket.id], x = +data.x, y = +data.y;
                if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x - p.x, y - p.y) <= 40) { const s = AC.get(p); p.x = x; p.y = y; if (s) { s.x = x; s.y = y; } }
                r.players[socket.id].bodyAngle = 0;
                r.players[socket.id].turretAngle = 0;
            }
        }
    });

    socket.on('setLaserTarget', (data) => {
        if (!data || typeof data !== 'object') return;
        let r = rooms[data.roomId], p = r ? r.players[socket.id] : null;
        if (p && p.buff === 'autolaser') p.laserTarget = data.targetId;
    });

    socket.on('move', (data) => {
        if (!data || typeof data !== 'object') return;
        let r = rooms[data.roomId];
        if (r && r.players[socket.id] && r.status === 'playing') {
            // лише скінченні числа: NaN/рядки в координатах ламали синхронізацію, ботів і зіткнення
            const x = +data.x, y = +data.y, ba = +data.bodyAngle, ta = +data.turretAngle;
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            let p = r.players[socket.id];
            if (p.hp <= 0 || p.out) return;                                  // загиблий не рухається
            const ok = speedCheck(r, p, x, y, socket);
            p.x = ok[0]; p.y = ok[1]; if (Number.isFinite(ba)) p.bodyAngle = ba; if (Number.isFinite(ta)) p.turretAngle = ta;
            if (p.stuckIn.length > 0) {
                let cM = MAP_DATA[r.map] ? r.map : 'epic_map', arr = MAP_DATA[cM].solids, sI = [];
                p.stuckIn.forEach(i => {
                    let s = arr[i], rad = 24;
                    let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30), h = Math.hypot(p.x - cx, p.y - cy) <= rad + sr;
                    let tX = Math.max(s.x, Math.min(p.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(p.y, s.y + (s.h || 30))), h2 = Math.hypot(p.x - tX, p.y - tY) <= rad;
                    if (s.type === 'tree' || s.type.includes('neon')) { if (h) sI.push(i); } else { if (h2) sI.push(i); }
                });
                p.stuckIn = sI;
            }
        }
    });

    socket.on('shoot', (data) => {
        if (!data || typeof data !== 'object') return;
        let r = rooms[data.roomId];
        if (r && r.status === 'playing') {
            let p = r.players[socket.id];
            if (!p) return;
            if (p.buff === 'reaper') {
                let mId = 'mine_' + Date.now() + Math.random();
                r.mines[mId] = { id: mId, x: data.x, y: data.y, owner: socket.id, time: Date.now() };
                return;
            }
            data.owner = socket.id; data.pierced = [];
            { const nowS = Date.now(); trimShots(nowS); data.bid = shotSeq++; SHOTS.set(data.bid, { owner: socket.id, type: cleanWeapon(data.type), kills: 0, t: nowS }); }
            io.to(data.roomId).emit('spawnBullet', data);
        }
    });

    socket.on('registerHit', (data) => {
        if (!data || typeof data !== 'object') return;
        let r = rooms[data.roomId];
        if (!r || r.status !== 'playing' || !r.players[data.targetId]) return;
        let v = r.players[data.targetId], atk = r.players[socket.id], atkName = globalPlayers[socket.id];
        
        if (ModeInfo.isPve(r.mode) || v.hp <= 0 || v.buff === 'shield') return;
        if (isTeamPvp(r.mode) && atk && atk.team === v.team) return;
        if (Modes.has(r.mode) && atk && (atk.hp <= 0 || atk.out)) return;
        if (Modes.frozen(r)) return;                              // раунди: підготовка / пауза між раундами

        if (!atk) return;                                         // влучати можуть лише гравці цієї кімнати
        let fD = Math.min(500, Math.max(0, +data.amt || 0));      // базова шкода снаряда (макс. — баф «бос» 500); NaN/рядки → 0

        if (r.mode === 'prophunt') {
            if (r.state !== 'seeking' || !atk || atk.team !== 'hunter' || v.team === 'hunter') return;
            fD = 250; v.isDisguised = false;
        } else {
            if (atk) fD *= GameData.statMult(atk.equipped, 'dmg');   // екіпіровка гравця в кімнаті (у королівському бою — підібрані модулі)
        }
        
        if (data.type === 'incendiary') v.onFire = { end: Date.now() + 5000, nextTick: Date.now() + 1000, owner: socket.id };
        
        if (r.ranked) r.ranked.dmg[socket.id] = (r.ranked.dmg[socket.id] || 0) + Math.min(v.hp, fD);   // рейтинг: облік участі (AFK не отримує рейтинг за перемогу)
        v.hp = Math.max(0, v.hp - fD);
        io.to(socket.id).emit('hitConfirmed');
        
        if (v.hp === 0) {
            processPlayerDeath(r, data.targetId, socket.id, { weapon: data.type });
            const sh = (typeof data.bid === 'number') ? SHOTS.get(data.bid) : null;   // один снаряд (id видає сервер у 'shoot') — кілька вбивств
            if (sh && sh.owner === socket.id) {
                sh.kills++;
                if (sh.kills >= 2 && atk) Ev.emit('multikill', { roomId: r.id, mode: r.mode, killerName: atk.name, killerBot: !!atk.isBot, weapon: sh.type || cleanWeapon(data.type), count: sh.kills });
            }
        }
    });

    socket.on('bulletMissed', (d) => {
        if (!HUNTER_MISS_PENALTY || !d) return;
        let r = rooms[d.roomId], p = r ? r.players[socket.id] : null;
        if (!p || r.status !== 'playing' || r.mode !== 'prophunt' || r.state !== 'seeking' || p.team !== 'hunter' || p.hp <= 0) return;
        p.hp = Math.max(1, p.hp - HUNTER_MISS_PENALTY);
    });

    socket.on('takeDamage', (d) => {
        if (!d || typeof d !== 'object') return;
        let r = rooms[d.roomId];
        if (!r || r.status !== 'playing' || !r.players[socket.id] || (d.attacker !== 'zombie' && d.attacker !== 'bomber')) return;
        let v = r.players[socket.id];
        if (v.buff === 'shield' || v.hp <= 0 || !ModeInfo.isPve(r.mode)) return;
        v.hp = Math.max(0, v.hp - Modes.dmgTaken(r, socket.id, Math.min(400, Math.max(0, +d.amt || 0))));
        if (v.hp === 0) processPlayerDeath(r, socket.id, 'zombie');
    });

    socket.on('collectToken', (d) => { if (d) collectTokenFor(d.roomId, socket.id, d.tid); });

    socket.on('collectPowerup', (d) => {
        if (!d || typeof d !== 'object') return;
        let r = rooms[d.roomId];
        if (r && r.status === 'playing' && r.powerups[d.pid] && r.powerups[d.pid].mod) { Modes.pickMod(r, socket.id, d.pid); return; }   // модуль (королівський бій)
        if (r && r.status === 'playing' && r.powerups[d.pid] && r.powerups[d.pid].active && r.players[socket.id] && r.players[socket.id].hp > 0 && powerupsOn(r.mode)) {
            let pT = r.powerups[d.pid].type, p = r.players[socket.id];
            p.buff = pT; p.buffEndTime = Date.now() + BUFF_DURATION; r.powerups[d.pid].active = false;
            if (pT === 'healing') { p.hp = Math.min(getMaxHp(p.equipped), p.hp + 150); p.nextHeal = Date.now() + 1000; }
            io.to(d.roomId).emit('powerupCollected', { pid: d.pid, playerId: socket.id, type: pT });
            delete r.powerups[d.pid];
        }
    });

    socket.on('zombieHit', (d) => {
        if (!d || typeof d !== 'object') return;
        let r = rooms[d.roomId];
        if (r && r.status === 'playing' && r.zombies[d.zid] && r.zombies[d.zid].hp > 0) {
            let fD = d.dmg, aP = r.players[socket.id];
            if (aP) fD *= GameData.statMult(aP.equipped, 'dmg');
            if (Modes.has(r.mode)) fD *= Modes.dmgMult(r, socket.id);
            if (d.type === 'incendiary') r.zombies[d.zid].onFire = { end: Date.now() + 5000, nextTick: Date.now() + 1000, owner: socket.id };
            r.zombies[d.zid].hp -= fD;
            if (r.zombies[d.zid].hp <= 0) {
                if (r.zombies[d.zid].type === 'bomber') io.to(d.roomId).emit('bomberExplode', { x: r.zombies[d.zid].x, y: r.zombies[d.zid].y, dmg: Math.round(50 * (r.zombies[d.zid].dmgMult || 1)) });
                if (Modes.has(r.mode)) Modes.onZombieKill(r, socket.id, r.zombies[d.zid]);
                delete r.zombies[d.zid];
            }
        }
    });

    socket.on('pickPerk', (d) => { if (d && rooms[d.roomId]) Modes.pickPerk(rooms[d.roomId], socket.id, d.id); });

    socket.on('backToRoomLobby', (roomId) => {
        let r = rooms[roomId];
        if (!r || r.ranked || !r.players[socket.id]) return;
        if (r.status === 'finished') resetRoomToLobby(r, socket.id);          // перший, хто повернувся: кімната знову в лобі, решта ще «у грі»
        else if (r.status === 'lobby' && r.players[socket.id].away) {          // наступні: повертаються по одному
            r.players[socket.id].away = false;
            io.to(r.id).emit('updateLobby', r); pushRooms();
        }
    });

    socket.on('disconnect', () => {
        const lgName = globalPlayers[socket.id];
        delete globalPlayers[socket.id];
        if (lgName) Ev.emit('logout', { name: lgName, socketId: socket.id });
        for (let rId in rooms) removePlayer(rId, socket.id);
        pushRooms();
    });
});

function endPropHuntGame(r, wT) {
    r.status = 'finished'; let rew = {}, wId = null, xpm = {}, drp = {}, ocm = {};
    Object.values(r.players).forEach(p => {
        let isW = (p.team === wT), a = isW ? 15 : 3; rew[p.id] = a; ocm[p.id] = isW ? 'win' : 'loss'; if (isW && !wId) wId = p.id;
        if (dbUsers[p.name]) {
            dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
            xpm[p.id] = grantXp(p.name, isW ? 'win' : 'loss');
            let dr = rollDrop(p.name); drp[p.id] = dr; saveUser(p.name);
            io.to(p.id).emit('economyUpdate', ecoPayload(p.name));
            if (dr) io.to(p.id).emit('dropReceived', dr);
        }
    });
    io.to(r.id).emit('gameOver', { winner: wId || 'TEAM', name: wT === 'hunter' ? 'КОМАНДА МИСЛИВЦІВ' : 'ТІ, ХТО ХОВАВСЯ', rewards: rew, xp: xpm, isTeamWin: true });
    emitMatchEnd(r, { outcomes: ocm, rewards: rew, xp: xpm, drops: drp });
    pushRooms();
}

function endTDMGame(r, wT) {
    r.status = 'finished'; let rew = {}, wId = null, xpm = {}, drp = {}, ocm = {}, isD = (wT === 'draw');
    Object.values(r.players).forEach(p => {
        let isW = !isD && (p.team === wT), a = isD ? 10 : (isW ? 20 : 5); rew[p.id] = a; ocm[p.id] = isD ? 'draw' : (isW ? 'win' : 'loss'); if (isW && !wId) wId = p.id;
        if (dbUsers[p.name]) {
            dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
            xpm[p.id] = grantXp(p.name, isD ? 'draw' : (isW ? 'win' : 'loss'));
            let dr = rollDrop(p.name); drp[p.id] = dr; saveUser(p.name);
            io.to(p.id).emit('economyUpdate', ecoPayload(p.name));
            if (dr) io.to(p.id).emit('dropReceived', dr);
        }
    });
    io.to(r.id).emit('gameOver', { winner: isD ? 'DRAW' : (wT || 'TEAM'), name: isD ? 'НІЧИЯ' : `КОМАНДА ${typeof wT === 'string' ? wT.toUpperCase() : 'ПОБЕДИТЕЛЬ'}`, rewards: rew, xp: xpm, isTeamWin: !isD });
    emitMatchEnd(r, { outcomes: ocm, rewards: rew, xp: xpm, drops: drp, score: Object.assign({}, r.teamScores || {}) });
    pushRooms();
}



// ===== Поведінка зомбі (спільна для «Виживання» й нових режимів) =====
// X (необов'язково): { targets:[{id,x,y,r,hit(dmg)}] } — споруди, які зомбі атакують (ядро бази, конвой); enrage — боси скаженіють при <50% здоров'я
function zombieTick(r, rId, now, dt, aP, X) {
    for (let zid in r.zombies) {
        let z = r.zombies[zid], t = null, mD = Infinity, st = null; const ZT = Z_TYPES[z.type];
        if (z.onFire) {
            if (now >= z.onFire.end) z.onFire = null;
            else if (now >= z.onFire.nextTick && z.hp > 0) {
                z.onFire.nextTick = now + 1000; z.hp -= 20; io.to(rId).emit('burnTick', { x: z.x, y: z.y });
                if (z.hp <= 0) { if (z.type === 'bomber') io.to(rId).emit('bomberExplode', { x: z.x, y: z.y, dmg: Math.round(50 * (z.dmgMult || 1)) }); delete r.zombies[zid]; continue; }
            }
        }
        aP.forEach(pl => { let d = Math.hypot(pl.x - z.x, pl.y - z.y); if (pl.buff === 'invisible') d *= 3; if (d < mD) { mD = d; t = pl; } });
        if (X && X.targets) for (const T of X.targets) { const d = Math.hypot(T.x - z.x, T.y - z.y) - T.r; if (d < mD) { mD = d; t = T; st = T; } }
        if (t) {
            let dx = t.x - z.x, dy = t.y - z.y, l = Math.max(Math.hypot(dx, dy), 0.001), sp = ZT.speed, cdM = 1;
            if (X && X.enrage && ZT.isBoss && z.hp < z.maxHp * 0.5) { sp *= 1.3; cdM = 0.7; }
            // шлях в обхід перешкод (барикади, стіни, вода): зомбі йде до наступної точки маршруту, а не тупо в гравця
            const wp = Nav.steer(MAP_DATA[r.map] || MAP_DATA['epic_map'], r, t.id, t.x, t.y, z.x, z.y, ZT.radius, now), wdx = wp.x - z.x, wdy = wp.y - z.y, wl = Math.max(Math.hypot(wdx, wdy), 0.001);
            let nX = z.x + (wdx / wl) * sp * dt, nY = z.y + (wdy / wl) * sp * dt;
            if (!st || mD > 4) {      // до споруди підходимо впритул, але не заходимо всередину неї
                if (!checkCollisionServer(r.map, nX, z.y, ZT.radius, [], r)) z.x = nX;
                if (!checkCollisionServer(r.map, z.x, nY, ZT.radius, [], r)) z.y = nY;
            }
            // Анти-застрягання: зомбі, що 3с не рухається далеко від гравця, переноситься на край мапи
            if (!z.stuckRef) z.stuckRef = { x: z.x, y: z.y, t: now };
            else if (now - z.stuckRef.t >= 3000) {
                if (Math.hypot(z.x - z.stuckRef.x, z.y - z.stuckRef.y) < 10 && mD > 80) {
                    let zs = getValidEdgeSpawn(r.map, ZT.radius + 5, 'spawn_zombie');
                    z.x = zs.x; z.y = zs.y;
                }
                z.stuckRef = { x: z.x, y: z.y, t: now };
            }
            const dmgV = Math.round(ZT.dmg * (z.dmgMult || 1));
            if (ZT.isBoss && now > z.nextAttack) {
                z.nextAttack = now + ZT.cd * cdM; let bC = ZT.bullets, spr = Math.PI / 4, sA = Math.atan2(dy, dx) - (spr / 2), stp = spr / Math.max(1, bC - 1); if (ZT.ring) { spr = Math.PI * 2; stp = spr / bC; sA = 0; }
                for (let b = 0; b < bC; b++) { let a = sA + (b * stp); io.to(rId).emit('spawnBullet', { id: 'b_' + now + b + zid, x: z.x, y: z.y, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500, type: 'boss_proj', owner: 'zombie', dmgOverride: dmgV }); }
                if (st && mD < 600) st.hit(Math.round(dmgV * 0.6));      // снаряди боса не бачать споруд — шкода споруді нараховується напряму
            } else if (ZT.ranged && !ZT.isBoss && mD < 400 && now > z.nextAttack) {
                z.nextAttack = now + 2000; io.to(rId).emit('spawnBullet', { id: 'ac_' + now + zid, x: z.x, y: z.y, vx: (dx / l) * 400, vy: (dy / l) * 400, type: 'acid', owner: 'zombie', dmgOverride: Math.round(75 * (z.dmgMult || 1)) });
                if (st) st.hit(Math.round(40 * (z.dmgMult || 1)));
            } else if (!ZT.isBoss && mD < (st ? ZT.radius + 12 : 30 + ZT.radius + 5) && now > z.nextAttack) {
                z.nextAttack = now + 1000;
                if (st) st.hit(dmgV); else io.to(rId).emit('zombieMeleeHit', { targetId: t.id, dmg: dmgV });
            }
        }
    }
}

// ===== Дельта-синхронізація стану бою =====
// Раніше щотіку (30 Гц) всім летів ПОВНИЙ стан: усі гравці з усіма полями, зомбі, жетони, бонуси, міни.
// Тепер: рухомі поля — масивом і лише для тих, що змінились; статичні (ім'я, колір, екіпірування…) — лише при зміні;
// бонуси/жетони/міни — лише коли змінились; повний зріз раз на секунду як страховка (піздній вхід, пропущений пакет).
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const SYNCS = new Map();
const BANS = new Map(); // roomId -> Set(імен акаунтів), яких лідер заблокував у цій сесії
 // стан дельта-синхронізації по кімнатах (окремо від r, щоб не потрапляти в updateLobby)
function buildSync(r, now) {
    let S = SYNCS.get(r.id);
    if (!S) { S = { n: 0, p: {}, st: {}, ids: '', z: {}, zi: '', zs: {}, pu: '', tk: '', mn: '', ph: '', tdm: '', tm: 0, za: {}, zn: 0 }; SYNCS.set(r.id, S); }
    const full = S.n % TICK_RATE === 0; S.n++;
    const stChk = full || (S.n & 3) === 0;   // «статичні» поля (ім'я, колір, екіпіровка…) змінюються рідко — перевіряємо раз на 4 тіки, а не JSON на кожен тік
    const out = {}; let any = false;
    const P = {}, ST = {}, ids = Object.keys(r.players);
    for (const id of ids) {
        const p = r.players[id];
        const a = [r1(p.x), r1(p.y), r2(p.bodyAngle), r2(p.turretAngle), r1(p.hp), p.score | 0, p.buff || 0, r2(p.buffProgress || 0), p.isDisguised ? 1 : 0];
        const k = a.join(',');
        if (full || S.p[id] !== k) { S.p[id] = k; P[id] = a; any = true; }
        if (!stChk && S.st[id] !== undefined) continue;
        const st = JSON.stringify([p.name, p.color, p.team, p.equipped, p.propType, p.level, p.ready, p.nick, p.clan]);
        if (full || S.st[id] !== st) { S.st[id] = st; ST[id] = { name: p.name, nick: p.nick, clan: p.clan, color: p.color, team: p.team, equipped: p.equipped, propType: p.propType, level: p.level, ready: p.ready }; any = true; }
    }
    for (const id in S.p) if (!r.players[id]) { delete S.p[id]; delete S.st[id]; }
    const idk = ids.join('|');
    if (full || idk !== S.ids) { S.ids = idk; out.ids = ids; any = true; }
    if (Object.keys(P).length) out.p = P; if (Object.keys(ST).length) out.s = ST;
    // зомбі: [x, y, hp] лише для змінених; тип і maxHp — один раз; перелік id — коли склад змінився
    if (r.zombies) {
        const Z = {}, ZS = {}, zids = Object.keys(r.zombies);
        for (const id of zids) {
            const z = r.zombies[id], a = [Math.round(z.x), Math.round(z.y), Math.round(z.hp)], k = a.join(',');
            const al = S.za[id] || (S.za[id] = ++S.zn);   // короткий числовий псевдонім замість довгого id у кожному пакеті
            if (full || S.z[id] !== k) { S.z[id] = k; Z[al] = a; any = true; }
            if (full || !S.zs[id]) { S.zs[id] = 1; ZS[id] = { a: al, id: z.id, type: z.type, maxHp: z.maxHp }; any = true; }
        }
        for (const id in S.z) if (!r.zombies[id]) { delete S.z[id]; delete S.zs[id]; delete S.za[id]; }
        const zk = zids.join('|');
        if (full || zk !== S.zi) { S.zi = zk; out.zi = zids; any = true; }
        if (Object.keys(Z).length) out.z = Z; if (Object.keys(ZS).length) out.zs = ZS;
    }
    const chg = (key, val, name) => { const j = JSON.stringify(val); if (full || S[key] !== j) { S[key] = j; out[name] = val; any = true; } };
    chg('pu', r.powerups || {}, 'pu'); chg('tk', r.tokens || {}, 'tk'); chg('mn', r.mines || {}, 'mn');
    if (Modes.has(r.mode)) { const md = Modes.md(r, now); if (md) chg('md', md, 'md'); }
    if (r.mode === 'prophunt') { const t = Math.max(0, Math.ceil((r.phaseEndTime - now) / 1000)), j = r.state + ':' + t; if (full || S.ph !== j) { S.ph = j; out.phState = r.state; out.phTimeLeft = t; any = true; } }
    if (r.mode === 'team_deathmatch') {
        chg('tdm', { teamScores: r.teamScores, timeEndTime: r.timeEndTime }, 'tdm');
        if (full || now - S.tm >= 1000) { S.tm = now; out.tdmMsLeft = Math.max(0, r.timeEndTime - now); any = true; }
    }
    return any ? out : null;
}

// ===== Мережева частота: 20 оновлень на секунду. Уся логіка йде за реальним часом (dt/now), тож швидкість гри не залежить від частоти. =====
const TICK_RATE = 20;
let _lastLoop = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.12, Math.max(0.01, (now - _lastLoop) / 1000)); _lastLoop = now;
    for (let rId in rooms) {
        let r = rooms[rId];
        if (r.status !== 'playing') { if (SYNCS.has(rId)) SYNCS.delete(rId); continue; }

        const PWR = Modes.has(r.mode) ? Modes.powerupRule(r) : null;
        if (powerupsOn(r.mode)) {
            let pKeys = Object.keys(r.powerups);
            pKeys.forEach(k => { if (!r.powerups[k].mod && now - r.powerups[k].spawnTime > 60000) delete r.powerups[k]; });   // модулі (mod) не зникають за часом
            pKeys = Object.keys(r.powerups);
            if (!(PWR && PWR.own) && now - r.lastPowerupSpawn >= 30000) {
                r.lastPowerupSpawn = now;
                const cM = MAP_DATA[r.map] ? r.map : 'epic_map', sPts = MAP_DATA[cM].solids.filter(s => s.type === 'spawn_powerup');
                if (sPts.length > 0 && pKeys.length < 4) {
                    let cnt = Math.min(2, 4 - pKeys.length), shuffled = [...sPts].sort(() => 0.5 - Math.random()).slice(0, cnt);
                    const pTypes = ['boss', 'samurai', 'minigun', 'shotgun', 'homing', 'incendiary', 'explosive', 'piercing', 'healing', 'shield', 'autolaser', 'reaper'];
                    shuffled.forEach((pt, i) => {
                        let pid = 'p_up_' + now + '_' + i, pType = pTypes[Math.floor(Math.random() * pTypes.length)];
                        r.powerups[pid] = { id: pid, x: pt.x, y: pt.y, type: pType, active: true, spawnTime: now };
                    });
                }
            }
        } else r.powerups = {};

        if (r.mode === 'prophunt') {
            if (r.state === 'hiding' && now >= r.phaseEndTime) {
                r.state = 'seeking'; r.phaseEndTime = now + (r.seekTime * 1000);
                Object.values(r.players).forEach(p => { if (p.team === 'hunter') { p.hp = getMaxHp(p.equipped); let sp = getValidSpawn(r.map, 30, 'spawn_player'); p.x = sp.x; p.y = sp.y; } });
                io.to(rId).emit('phPhaseChange', { phase: 'seeking', time: r.seekTime });
            } else if (r.state === 'seeking' && now >= r.phaseEndTime) {
                endPropHuntGame(r, 'hider');
                continue;
            }
        }
        
        if (r.mode === 'team_deathmatch') {
            if (now >= r.timeEndTime) {
                let mS = -1, w = [];
                for (let t in r.teamScores) {
                    if (r.teamScores[t] > mS) { mS = r.teamScores[t]; w = [t]; } else if (r.teamScores[t] === mS) w.push(t);
                }
                if (w.length === 1) endTDMGame(r, w[0]); else endTDMGame(r, 'draw');
                continue;
            }
        }

        for (let mid in r.mines) {
            let m = r.mines[mid];
            for (const p of Object.values(r.players)) {
                if (p.hp > 0 && p.id !== m.owner && !ModeInfo.isPve(r.mode) && !(isTeamPvp(r.mode) && r.players[m.owner] && r.players[m.owner].team === p.team) && Math.hypot(p.x - m.x, p.y - m.y) < 35 && p.buff !== 'shield') {
                    delete r.mines[mid];
                    p.hp = Math.max(0, p.hp - 125);
                    io.to(rId).emit('mineExploded', { x: m.x, y: m.y });
                    if (p.hp === 0) processPlayerDeath(r, p.id, m.owner, { weapon: 'mine' });
                    break;
                }
            }
        }

        Object.values(r.players).forEach(p => {
            if (p.onFire) {
                if (now >= p.onFire.end) p.onFire = null;
                else if (now >= p.onFire.nextTick && p.hp > 0) {
                    p.onFire.nextTick = now + 1000;
                    if (p.buff !== 'shield') p.hp = Math.max(0, p.hp - 20);
                    io.to(rId).emit('burnTick', { x: p.x, y: p.y });
                    if (p.hp === 0) {
                        let killerId = p.onFire ? p.onFire.owner : null;
                        processPlayerDeath(r, p.id, killerId, { weapon: 'incendiary' });
                    }
                }
            }
            if (p.buff) {
                p.buffProgress = Math.max(0, (p.buffEndTime - now) / BUFF_DURATION);
                if (p.buff === 'healing' && p.hp > 0 && now >= p.nextHeal) {
                    p.hp = Math.min(getMaxHp(p.equipped), p.hp + 10); p.nextHeal = now + 1000;
                }
                if (p.buff === 'autolaser' && p.laserTarget && r.players[p.laserTarget] && r.players[p.laserTarget].hp > 0 && (!p.nextLaser || now >= p.nextLaser)
                    && !ModeInfo.isPve(r.mode) && !(isTeamPvp(r.mode) && p.team && p.team === r.players[p.laserTarget].team)) {   // союзників (кооп / своя команда) лазер не чіпає
                    if (Math.hypot(p.x - r.players[p.laserTarget].x, p.y - r.players[p.laserTarget].y) < 400) {
                        p.nextLaser = now + 100;
                        io.to(rId).emit('laserHit', { src: p.id, tgt: p.laserTarget });
                        if (r.players[p.laserTarget].buff !== 'shield') {
                            r.players[p.laserTarget].hp = Math.max(0, r.players[p.laserTarget].hp - 20);
                            if (r.players[p.laserTarget].hp === 0) processPlayerDeath(r, p.laserTarget, p.id, { weapon: 'laser' });
                        }
                    }
                }
                if (now > p.buffEndTime) {
                    if (p.buff === 'boss') {
                        p.stuckIn = []; let cM = MAP_DATA[r.map] ? r.map : 'epic_map', arr = MAP_DATA[cM].solids;
                        for (let i = 0; i < arr.length; i++) {
                            let s = arr[i]; if (s.type.includes('spawn') || s.type === 'line') continue;
                            let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30), h = Math.hypot(p.x - cx, p.y - cy) <= 24 + sr;
                            let tX = Math.max(s.x, Math.min(p.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(p.y, s.y + (s.h || 30))), h2 = Math.hypot(p.x - tX, p.y - tY) <= 24;
                            if (s.type === 'tree' || s.type.includes('neon')) { if (h) p.stuckIn.push(i); } else { if (h2) p.stuckIn.push(i); }
                        }
                    }
                    p.buff = null; p.buffProgress = 0;
                }
            } else p.buffProgress = 0;
        });

        if (Modes.has(r.mode)) { if (Modes.tick(r, now, dt)) continue; }

        if (r.mode === 'survival') {
            const aP = Object.values(r.players).filter(pl => pl.hp > 0);
            if (aP.length === 0) {
                r.status = 'finished'; let rw = {}, xpm = {}, drp = {}, ocm = {}, crd = {};
                Object.values(r.players).forEach(pl => {
                    let n = pl.name; ocm[pl.id] = 'loss'; if (dbUsers[n]) { let wv = r.wave; crd[pl.id] = wv; dbUsers[n].bucks += wv; dbUsers[n].stats.earned += wv; dbUsers[n].stats.matches++; xpm[pl.id] = grantXp(n, 'loss'); let dr = rollDrop(n); drp[pl.id] = dr; saveUser(n); io.to(pl.id).emit('economyUpdate', ecoPayload(n)); if (dr) io.to(pl.id).emit('dropReceived', dr); }
                });
                io.to(rId).emit('gameOver', { winner: 'ZOMBIES', wave: r.wave, rewards: rw, xp: xpm, isTeamWin: false });
                emitMatchEnd(r, { outcomes: ocm, rewards: crd, xp: xpm, drops: drp, wave: r.wave, waves: Math.max(0, r.wave - 1) }); pushRooms();
                continue;
            }
            if (Object.keys(r.zombies).length === 0) {
                if (r.state === 'playing') { r.state = 'waiting'; r.nextWaveTime = now + 4000; let nW = r.wave + 1; if (nW === 10 || nW === 20 || nW === 30 || nW === 40) io.to(rId).emit('bossWarning'); }
                else if (r.state === 'waiting' && now > r.nextWaveTime) {
                    r.wave++; let isBW = (r.wave % 10 === 0 && r.wave <= 40);
                    if (isBW) {
                        let bTypes = ['pikus', 'shurik', 'oneshot', 'padlo'], bType = bTypes[(r.wave / 10) - 1], zid = 'boss_' + now, zS = getValidSpawn(r.map, 50, 'spawn_zombie');
                        let bsc = waveScale(r.wave), bHp = Math.round(Z_TYPES[bType].hp * bsc.hp);
                        r.zombies[zid] = { id: zid, x: zS.x, y: zS.y, type: bType, hp: bHp, maxHp: bHp, dmgMult: bsc.dmg, nextAttack: 0, onFire: null };
                        io.to(rId).emit('newWave', { wave: r.wave, isBoss: true, bossName: Z_TYPES[bType].name });
                    } else {
                        let sC = Math.min(ZOMBIE_CAP, ZOMBIE_SPAWN_BASE + (r.wave - 1) * ZOMBIE_SPAWN_STEP), sc = waveScale(r.wave), tL = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost'], mI = Math.min(tL.length - 1, Math.floor((r.wave) / 5)), aT = tL.slice(0, mI + 1);
                        for (let i = 0; i < sC; i++) { let t = aT[Math.floor(Math.random() * aT.length)], zS = getValidEdgeSpawn(r.map, 20, 'spawn_zombie'), zid = 'z_' + now + '_' + i; let zHp = Math.round(Z_TYPES[t].hp * sc.hp); r.zombies[zid] = { id: zid, x: zS.x, y: zS.y, type: t, hp: zHp, maxHp: zHp, dmgMult: sc.dmg, nextAttack: 0, onFire: null }; }
                        io.to(rId).emit('newWave', { wave: r.wave, isBoss: false });
                    }
                    r.state = 'playing';
                }
            } else if (r.state === 'playing') {
                zombieTick(r, rId, now, dt, aP, null);
            }
        }
        const sy = buildSync(r, now);
        if (sy) io.to(rId).volatile.emit('sync2', sy);
    }
}, 1000 / TICK_RATE);

// ===== Додаткові модулі (прогрес, профіль, друзі, клани, боти) =====
// Кожен файл — module.exports = function (ctx) { … }. Відсутні файли просто пропускаються.
{
    const Events = require('./events.js');
    const onlineSocketsOf = name => { const s = _sockByName.get(name); return s ? Array.from(s) : []; };
    const ctx = {
        io, rooms, dbUsers, globalPlayers, Events, GameData, MODULES, CASES, ModeInfo, Modes, MAP_DATA, MapObj, Nav, VALID_MODES, MAX_HP,
        saveUser, sendEconomy, ecoPayload, grantXp, rollDrop, playerLevel, getMaxHp, pushRooms, hashPwd, validateUser, NAME_RE, LOGIN_RE_NEW, PASS_RE_NEW,
        checkCollisionServer, getValidSpawn, processPlayerDeath, removePlayer, resetRoomToLobby, getRandomModuleFromCase,
        hooks, displayName: nickOf, onConnection: f => connHooks.push(f), getDb: () => dbRef, onlineSocketsOf, isOnline: name => _sockByName.has(name),
        get BANS() { return BANS; }, get TICK_RATE() { return TICK_RATE; }, get SYNCS() { return SYNCS; }, startRoomGame, collectTokenFor, emitMatchEnd, teamsOf, isTeamPvp, powerupsOn, pickMap, clampInt, BUFF_DURATION, VALID_COLORS, TDM_TEAMS,
        newPlayerEntry, joinRoomFor, ipHashOf, getRandomModuleFromCase, matchTally: () => matchTally,
        banInfo, dbStat, dirtyCount: () => dirtyUsers.size, flushUsers, PROMO_CODES
    };
    ['handles', 'progress', 'profile', 'social', 'clans', 'chat', 'playercard', 'bots', 'ranked', 'referral', 'tutorial', 'emotes', 'notify', 'admin'].forEach(f => {
        if (!fs.existsSync(path.join(__dirname, f + '.js'))) return;
        try { require('./' + f + '.js')(ctx); console.log('✅ Модуль', f); } catch (e) { console.error('❌ Модуль', f, e && e.stack || e); }
    });
}

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));