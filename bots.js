/* bots.js — боти-гравці: «ілюзія онлайну», віртуальні сесії та керування ботами в кімнатах.
 *
 *  • Бот — звичайний запис у room.players (id 'b_…', поля як у людини). Прапорець isBot — НЕперелічувана властивість,
 *    тож не потрапляє в JSON / socket.io; клієнти бачать ботів як звичайних гравців (sync2, updateLobby).
 *  • Віртуальні сесії: 4–9 «кімнат» у списку (hostName = бот), наповнені ботами, які заходять/виходять/готуються;
 *    хост-бот сам запускає гру (ctx.startRoomGame — та сама логіка, що й у людини), потім сесія «в грі» зникає,
 *    через випадковий час з'являється нова. Коли реальний гравець заходить у таку сесію, вона стає справжньою кімнатою
 *    (materialize) з ботами всередині; хост-бот чекає «готовий» усіх людей і запускає гру.
 *  • У кімнатах реальних гравців боти поступово підключаються (кожні 2–8 с) до ~40–100% місць, готуються; якщо ≥2 людей —
 *    ботів лишається мало; повній кімнаті бот ввічливо звільняє місце; вигнання бота лідером поважається (більше не добавляємо).
 *  • Бойовий ШІ — у bots_ai.js.
 *
 * Керування: змінна середовища BOTS=off — повністю вимкнути; BOT_ROOMS=n — кількість віртуальних сесій (0 — без них);
 * BOT_IN_ROOMS=off — не підключати ботів до кімнат реальних гравців. Інші налаштування — у CFG нижче.
 * Події: ботів у подіях 'kill'/'matchEnd' позначає server.js (isBot=true). Економіка/рейтинг/друзі ботів не стосуються (dbUsers[bot.name] нема).
 */
'use strict';
const MapObj = require('./public/js/mapobjects.js');
const GD = require('./public/js/gamedata.js');
const ModeInfo = require('./public/js/modeinfo.js');

const ENV = process.env;
const off = v => v === 'off' || v === '0' || v === 'false';
const CFG = {
    enabled: !off(ENV.BOTS),
    virtualRooms: (ENV.BOT_ROOMS !== undefined && ENV.BOT_ROOMS !== '' && Number.isFinite(+ENV.BOT_ROOMS)) ? Math.max(0, Math.min(20, Math.floor(+ENV.BOT_ROOMS))) : null,   // null — випадково 4..9
    roomsMin: 4, roomsMax: 9,
    inRealRooms: !off(ENV.BOT_IN_ROOMS),
    maxSimBots: 60,                 // ботів у справжніх кімнатах (їх симулює ШІ)
    maxBotsTotal: 150,              // разом з віртуальними сесіями (там вони лише «в таблиці»)
    modes: ['deathmatch', 'team_deathmatch', 'capture_points', 'battle_royale', 'bounty', 'rounds'],      // режими, де боти мають сенс
    virtualModeW: { deathmatch: 3, team_deathmatch: 2.2, capture_points: 1.6, battle_royale: 2.2, bounty: 1, rounds: 1.4 },
    fillHuman: [0.4, 1.0],          // частка місць, до якої боти добирають кімнату реального гравця
    joinEveryMs: [2000, 8000],      // як часто боти «підключаються» до кімнати людини
    virtualFill: [0.2, 0.9],        // початкове наповнення віртуальних сесій
    autoStartMs: [60000, 200000],   // хост-бот запускає гру через стільки після появи сесії
    fakePlayMs: [60000, 160000],    // скільки віртуальна сесія «в грі», перш ніж зникне
    respawnRoomMs: [4000, 35000],   // пауза перед появою нової віртуальної сесії
    tickMs: 40, thinkMs: 100, thinkBudgetMs: 6
};

module.exports = function (ctx) {
    if (!CFG.enabled) { console.log('🤖 Боти вимкнено (BOTS=off)'); ctx.botNames = new Set(); ctx.Bots = { enabled: false, isBot: p => !!(p && p.isBot) }; return; }
    const { io, rooms, dbUsers, GameData, ModeInfo: MI, MAP_DATA, Modes } = ctx;
    const VALID_COLORS = ctx.VALID_COLORS, TDM_TEAMS = ctx.TDM_TEAMS;
    const AI = require('./bots_ai.js')(ctx, CFG);
    const botNames = new Set(); ctx.botNames = botNames; ctx.hooks.botNames = botNames;      // і точні, і маленькі літери (реєстрація/ніки перевіряють ctx.botNames.has(x.toLowerCase()))
    const BOTS = new Map();         // botId -> { p, where:'rooms'|'virtual', roomId, b:{ readyAt, pend, ... } }
    const V = new Map();            // віртуальні сесії (поза rooms): roomId -> room-подібний об'єкт
    const META = new WeakMap();     // room -> службові дані (не потрапляють у JSON)
    const now0 = () => Date.now();
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const lerp = (a, b, t) => a + (b - a) * t;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const rint = (a, b) => Math.floor(rnd(a, b + 1));
    const pick = a => a[Math.floor(Math.random() * a.length)];
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const wpick = (obj) => { let t = 0; for (const k in obj) t += obj[k]; let x = Math.random() * t; for (const k in obj) { x -= obj[k]; if (x < 0) return k; } return Object.keys(obj)[0]; };
    const metaOf = r => { let m = META.get(r); if (!m) { m = { virt: false, table: false, target: null, frac: null, nextJoin: 0, nextLeave: 0, known: new Set(), removed: new Set(), noMore: undefined, startAt: 0, born: now0(), failStart: 0, nextEvt: 0 }; META.set(r, m); } return m; };
    const isBot = p => !!(p && p.isBot);
    const humansOf = r => Object.values(r.players).filter(p => !p.isBot);
    const botsOf = r => Object.values(r.players).filter(p => p.isBot);
    const simBotCount = () => { let n = 0; for (const rid in rooms) for (const id in rooms[rid].players) if (rooms[rid].players[id].isBot) n++; return n; };
    const totalBotCount = () => BOTS.size;

    // =====================================================================
    //  ІМЕНА
    // =====================================================================
    // Лише латиниця (ніяких кириличних символів): пули слів → комбінації різних стилів; довжина ≤ 12.
    const ADJ = ['Dark', 'Iron', 'Silent', 'Swift', 'Crimson', 'Frozen', 'Mad', 'Wild', 'Lucky', 'Rapid', 'Toxic', 'Neon', 'Atomic', 'Cosmic', 'Savage', 'Sleepy', 'Angry', 'Happy', 'Brave', 'Rusty', 'Golden', 'Silver', 'Black', 'Red', 'Blue', 'Hyper', 'Mega', 'Ultra', 'Lone', 'Final', 'Epic', 'Chill', 'Stormy', 'Sneaky', 'Fierce', 'Grim', 'Lazy', 'Tiny', 'Big', 'Cold'];
    const NOUN = ['Wolf', 'Fox', 'Viper', 'Hawk', 'Raven', 'Cobra', 'Tiger', 'Bear', 'Falcon', 'Shark', 'Panda', 'Koala', 'Otter', 'Lynx', 'Badger', 'Bison', 'Eagle', 'Moose', 'Gecko', 'Mantis', 'Ghost', 'Storm', 'Blaze', 'Frost', 'Thunder', 'Spark', 'Comet', 'Rocket', 'Hammer', 'Blade', 'Arrow', 'Bullet', 'Tank', 'Sniper', 'Hunter', 'Rogue', 'Ninja', 'Joker', 'Pilot', 'Rider', 'Titan', 'Reaper', 'Wraith', 'Pixel', 'Turbo', 'Nova', 'Zero', 'Boom', 'Rex', 'Ace', 'Boss', 'King', 'Knight', 'Pirate', 'Viking', 'Samurai', 'Dragon', 'Phoenix', 'Cannon', 'Bolt', 'Rhino'];
    const SHORT = ['Nova', 'Rex', 'Ace', 'Zed', 'Kai', 'Neo', 'Jax', 'Vex', 'Orc', 'Fox', 'Ash', 'Ice', 'Zap', 'Max', 'Rio', 'Dex', 'Lux', 'Ray', 'Sky', 'Taz', 'Ziggy', 'Echo', 'Onyx', 'Hex', 'Flux', 'Volt', 'Drift', 'Rush', 'Kilo', 'Mojo'];
    const FIRST = ['Viktor', 'Alex', 'Max', 'Dan', 'Nick', 'Tom', 'Leo', 'Ivan', 'Oleg', 'Artem', 'Denys', 'Taras', 'Yura', 'Misha', 'Dima', 'Vova', 'Kolya', 'Stas', 'Sasha', 'Roman', 'Oksana', 'Olya', 'Anna', 'Kate', 'Sofia', 'Mila', 'Nina', 'Eva', 'Lena', 'Dasha', 'Mark', 'Ben', 'Jack', 'Sam', 'Ryan', 'Luke', 'Adam', 'Eric', 'Paul', 'Hugo', 'Igor', 'Bogdan', 'Danylo', 'Andrew', 'Pavlo', 'Yan', 'Egor', 'Gleb', 'Timur', 'Zoya'];
    const SUFFIX = ['X', 'Z', 'Pro', 'GG', 'TV', 'XD', 'HD', 'UA', 'EU', 'Jr', 'One', 'Prime', 'Rage', 'Fury', 'Zone', 'Ops', 'Lab'];
    const YEARS = ['99', '98', '97', '2k', '03', '05', '07', '08', '10', '11', '12', '13', '17', '21', '24', '33', '66', '77', '88', '69', '42', '007', '101', '404', '777', '123'];
    const LEET = [['Shadow', 'Sh4dow'], ['Killer', 'K1ller'], ['Hunter', 'Hunt3r'], ['Sniper', 'Snip3r'], ['Master', 'M4ster'], ['Ninja', 'N1nja'], ['Zero', 'Z3ro'], ['Elite', 'El1te'], ['Pirate', 'P1rate'], ['Legend', 'L3gend']];
    const mkName = () => {
        const yr = () => pick(YEARS), n2 = () => String(rint(2, 99)), cap = w => w[0].toUpperCase() + w.slice(1).toLowerCase();
        switch (rint(0, 17)) {
            case 0: return pick(ADJ) + pick(NOUN);                                   // DarkWolf
            case 1: return pick(SHORT) + '_' + pick(['X', 'Z', 'V', 'K', 'M', 'R', 'Q', 'One', 'Pro', 'GG']); // Nova_X
            case 2: return pick(NOUN) + pick(['', '', '_']) + yr();                  // Tank77
            case 3: return pick(FIRST) + '_' + pick(['Z', 'X', 'K', 'V', 'M', 'T', 'R', 'D', 'S', 'B']); // Viktor_Z
            case 4: return 'xX' + pick(NOUN) + 'Xx';                                 // xXSniperXx
            case 5: return pick(['Koala', 'Panda', 'Otter', 'Lynx', 'Bison', 'Gecko', 'Moose', 'Fox']) + pick(['Pro', 'Pro', 'Boss', 'King', 'Ace', 'Master', 'Lord', 'Chief']); // KoalaPro
            case 6: return pick(['Mr', 'Mrs', 'Sir', 'Dr', 'Big', 'Lil', 'Mad', 'Capt']) + pick(['_', '_', '.']) + pick(NOUN); // Mr_Boom
            case 7: return pick(['Iron', 'Steel', 'Red', 'Blue', 'Black', 'Dark', 'Ice', 'Night', 'Sky']) + '.' + pick(NOUN); // Iron.Fox
            case 8: return pick(FIRST) + pick(['', '_', '']) + yr();                 // Oleg2k
            case 9: return pick(NOUN).toLowerCase() + '_' + pick(['pro', 'xd', 'gg', 'tv', 'ua', 'hd', 'exe', 'bot', 'yt']); // wolf_pro
            case 10: return pick(ADJ) + pick(NOUN) + n2();                           // SavageHawk42
            case 11: return pick(['The', 'Its', 'Im', 'Just', 'Not']) + pick(NOUN);  // TheViper
            case 12: { const l = pick(LEET); return l[1] + pick(['', '', '_' + n2(), n2()]); }   // Sh4dow
            case 13: return pick(SHORT) + pick(SUFFIX);                              // NovaPro
            case 14: return pick(['Mr', 'Mr', 'Big']) + pick(NOUN) + pick(['', n2()]); // MrBoom7
            case 15: return pick(NOUN) + '-' + pick(NOUN);                           // Wolf-Fox
            case 16: return pick(FIRST) + '_' + pick(SHORT);                         // Oleg_Rex
            default: return pick(SHORT) + '_' + pick(NOUN);                          // Ace_Tank
        }
    };
    // імена людей: логіни й ніки існуючих акаунтів (без урахування регістру) кешуємо на 30 с
    let humanSet = null, humanSetAt = 0;
    function humanNames() {
        const t = now0(); if (humanSet && t - humanSetAt < 30000) return humanSet;
        humanSet = new Set(); humanSetAt = t;
        const cn = ctx.canonName || (x => String(x).toLowerCase());
        for (const k in dbUsers) { const u = dbUsers[k]; humanSet.add(cn(k)); if (u && u.nick) humanSet.add(cn(u.nick)); }
        return humanSet;
    }
    function freshName() {
        const hs = humanNames();
        for (let i = 0; i < 200; i++) {
            const nm = mkName();
            if (!/^[A-Za-z0-9_.-]{3,12}$/.test(nm)) continue;
            const lc = nm.toLowerCase(); if (botNames.has(lc) || hs.has(lc)) continue;
            return nm;
        }
        return 'Gamer' + rint(1000, 99999);
    }
    const takeName = nm => { botNames.add(nm); botNames.add(nm.toLowerCase()); };
    const freeName = nm => { botNames.delete(nm); botNames.delete(nm.toLowerCase()); };

    // =====================================================================
    //  ГЕНЕРАЦІЯ БОТА: рівень, модулі за архетипом, статистика
    // =====================================================================
    const SLOTS = ['cannon', 'turret', 'hull', 'tracks'], RO = GD.RARITY_ORDER;
    const IDX = {}; SLOTS.forEach(s => { IDX[s] = {}; RO.forEach(q => { IDX[s][q] = []; }); });
    Object.keys(GD.MODULES).forEach(id => { const m = GD.MODULES[id]; if (IDX[m.type] && IDX[m.type][m.rarity]) IDX[m.type][m.rarity].push(id); });
    const ARCH_W = { assault: { dmg: 1, cd: -0.7, range: 0.2 }, tank: { hp: 1, dmg: 0.1, rotSpeed: -0.05 }, fast: { speed: 1, cd: -0.6, rotSpeed: 0.4 }, balanced: { dmg: 0.5, hp: 0.5, speed: 0.5, cd: -0.3, rotSpeed: 0.2, range: 0.2 } };
    function modScore(id, arch) { const st = GD.MODULES[id].stats, w = ARCH_W[arch]; let s = 0; for (const k in w) if (st[k]) s += w[k] * Math.log(st[k]); return s; }
    function rarityWeights(L) {
        const t = (L - 1) / 14;
        return { common: 62 - 52 * t, rare: 30 + 8 * Math.sin(t * Math.PI), epic: 6 + 24 * t, legendary: Math.max(0, (t - 0.25)) * 40, mythic: Math.max(0, (t - 0.72)) * 20 };
    }
    function genEquip(L, arch) {
        const t = (L - 1) / 14, pOwn = clamp(0.28 + 0.7 * t, 0.2, 0.97), eq = { cannon: null, turret: null, hull: null, tracks: null };
        // ключовий слот архетипу майже завжди зайнятий
        const key = { assault: 'cannon', tank: 'hull', fast: 'tracks', balanced: null }[arch];
        SLOTS.forEach(slot => {
            if (!(slot === key && Math.random() < 0.9) && Math.random() > pOwn) return;
            const w = rarityWeights(L);
            for (let tries = 0; tries < 6; tries++) {
                const rar = wpick(w), list = IDX[slot][rar]; if (!list.length) continue;
                const sorted = list.slice().sort((a, b) => modScore(b, arch) - modScore(a, arch));
                const r = Math.random(); eq[slot] = sorted[r < 0.55 ? 0 : r < 0.85 ? Math.min(1, sorted.length - 1) : Math.min(2, sorted.length - 1)];
                break;
            }
        });
        return eq;
    }
    function genStats(L, skill) {
        const t = (L - 1) / 14, games = Math.max(3, Math.round(lerp(6, 520, Math.pow(t, 1.45)) * rnd(0.5, 1.6)));
        const wr = clamp(0.37 + 0.2 * skill + gauss() * 0.05, 0.28, 0.74), kd = clamp(0.5 + 1.35 * skill + gauss() * 0.16, 0.35, 2.7);
        const kills = Math.round(games * rnd(2.6, 6.2) * (0.7 + 0.5 * skill)), deaths = Math.max(1, Math.round(kills / kd));
        return { games, wins: Math.round(games * wr), kills, deaths };
    }
    function globalRef() {
        const ls = []; for (const sid in ctx.globalPlayers) { const n = ctx.globalPlayers[sid]; if (dbUsers[n]) ls.push(ctx.playerLevel(n)); }
        if (ls.length) return ls.reduce((a, b) => a + b, 0) / ls.length;
        return 5;
    }
    function pickLevel(ref) {
        let L = Math.round(ref + gauss() * 2.4 + (Math.random() < 0.12 ? rnd(-3, 5) : 0));
        if (Math.random() < 0.08) L = rint(1, 3);
        return clamp(L, 1, GD.MAX_LEVEL || 15);
    }
    // ref — орієнтовний рівень кімнати; o.arch — примусовий архетип (тести)
    function makeBot(ref, o) {
        o = o || {};
        const name = o.name || freshName(); takeName(name);
        let id; do { id = 'b_' + Math.random().toString(36).slice(2, 12); } while (BOTS.has(id));
        const level = o.level || pickLevel(ref);
        const arch = o.arch || wpick({ assault: 1, tank: 1, fast: 1, balanced: 1.1 });
        const eq = o.equipped || genEquip(level, arch);
        const skillHint = o.skill !== undefined ? o.skill : clamp(0.28 + 0.52 * ((level - 1) / 14) + gauss() * 0.12, 0.1, 0.95);
        const p = {
            id, name, color: null, team: null, ready: false, hp: ctx.getMaxHp(eq), score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0,
            buff: null, buffEndTime: 0, buffProgress: 0, stuckIn: [], laserTarget: null, onFire: null, equipped: eq, propType: 'prop_crate', isDisguised: false,
            level, nick: name, clan: '', stats: genStats(level, skillHint)
        };
        Object.defineProperty(p, 'isBot', { value: true, enumerable: false });
        const info = { p, where: 'rooms', roomId: null, b: { readyAt: 0, pend: false, joinedAt: now0() }, arch };
        BOTS.set(id, info);
        AI.brainOf(p, Object.assign({ skill: skillHint }, o.hint || {}));
        return p;
    }
    function forgetBot(id) {
        const info = BOTS.get(id); if (!info) return;
        BOTS.delete(id); freeName(info.p.name); AI.forget(id);
    }

    // =====================================================================
    //  ЛОБІ: колір / команда / «готовий»
    // =====================================================================
    const usesColor = r => MI.usesColor(r.mode);
    const eligibleMode = mode => CFG.modes.includes(mode) && !MI.isSolo(mode);
    const colorCap = r => usesColor(r) ? VALID_COLORS.length : 10;
    function ensureSlot(r, p) {
        let changed = false;
        if (usesColor(r)) {
            const taken = new Set(Object.values(r.players).filter(q => q !== p && q.color).map(q => q.color));
            if (!p.color || taken.has(p.color)) { const free = VALID_COLORS.filter(c => !taken.has(c)); const c = free.length ? pick(free) : null; if (c !== p.color) { p.color = c; changed = true; } }
        } else if (ctx.isTeamPvp(r.mode)) {
            const allowed = TDM_TEAMS.slice(0, ctx.teamsOf(r));
            if (!allowed.includes(p.team)) {
                const cnt = {}; allowed.forEach(t => { cnt[t] = 0; }); Object.values(r.players).forEach(q => { if (q !== p && cnt[q.team] !== undefined) cnt[q.team]++; });
                const mn = Math.min(...allowed.map(t => cnt[t])); p.team = pick(allowed.filter(t => cnt[t] === mn)); changed = true;
            }
        }
        return changed;
    }
    // вирівнює склади команд (переносить лише ботів; якщо не вдається — зайвих ботів видаляє)
    function balanceTeams(r) {
        if (!ctx.isTeamPvp(r.mode)) return;
        const allowed = TDM_TEAMS.slice(0, ctx.teamsOf(r));
        for (let it = 0; it < 24; it++) {
            const cnt = {}; allowed.forEach(t => { cnt[t] = []; }); Object.values(r.players).forEach(q => { if (cnt[q.team]) cnt[q.team].push(q); });
            // команда з мінімумом, але без тих, де нікого й так порожньо — враховуємо всі дозволені
            const ts = allowed.slice().sort((a, b) => cnt[b].length - cnt[a].length), big = ts[0], small = ts[ts.length - 1];
            if (cnt[big].length - cnt[small].length <= 1) break;
            const mover = cnt[big].find(q => q.isBot); if (!mover) break;
            mover.team = small; mover.ready = true;
        }
    }

    // =====================================================================
    //  ВІРТУАЛЬНІ СЕСІЇ
    // =====================================================================
    function spawnCount(mapName) { const m = MAP_DATA[mapName]; return m ? m.solids.filter(s => s.type === 'spawn_player').length : 0; }
    function pickVirtualMap(mode, teams) {
        const keys = Object.keys(MAP_DATA).filter(k => MapObj.mapAllows(MAP_DATA[k], mode) && spawnCount(k) >= Math.max(1, ctx.isTeamPvp(mode) ? teams : 1));
        const spec = keys.filter(k => Array.isArray(MAP_DATA[k].modes) && MAP_DATA[k].modes.includes(mode));      // мапи, зроблені саме під режим — частіше
        const pool = spec.length && Math.random() < 0.6 ? spec : keys;
        return pool.length ? pick(pool) : ctx.pickMap(null, mode);
    }
    function randomCfg(mode) {
        const c = {};
        if (mode === 'deathmatch') c.winScore = pick([15, 20, 30, 50, 50, 100]);
        if (mode === 'team_deathmatch') { c.tdmTeams = Math.random() < 0.8 ? 2 : 3; c.tdmTime = pick([120, 180, 180, 240]); c.tdmScore = pick([10, 20, 20, 30]); c.tdmAutoBalance = Math.random() < 0.85; }
        if (mode === 'capture_points') { c.cpTeams = 2; c.cpPoints = pick([2, 3, 3, 4]); c.cpScore = pick([200, 300, 300, 400]); c.cpTime = pick([180, 300, 300]); }
        if (mode === 'battle_royale') { c.brTime = pick([180, 240, 300, 300]); c.brDmg = pick([4, 4, 5, 6]); c.brLoot = Math.random() < 0.8; }
        if (mode === 'bounty') { c.bnScore = pick([20, 30, 30]); c.bnTime = pick([180, 300]); c.bnInterval = pick([30, 40, 40, 60]); }
        if (mode === 'rounds') { c.rdRounds = pick([4, 6, 6, 6, 8]); c.rdTime = pick([60, 90, 90, 120]); c.rdDraw = Math.random() < 0.25; c.tdmAutoBalance = true; }
        return c;
    }
    function buildRoom(id, host, mode, map, maxPlayers, cfg) {
        const r = {
            id, hostName: host.name, hostSocket: host.id, mode, map, maxPlayers: clamp(maxPlayers, 2, 10),
            winScore: ctx.clampInt(cfg.winScore, 5, 1000, 50), hideTime: 30, seekTime: 120, hunterCount: 1, tdmTeams: ctx.clampInt(cfg.tdmTeams, 2, 4, 2),
            tdmTime: ctx.clampInt(cfg.tdmTime, 60, 300, 180), tdmScore: ctx.clampInt(cfg.tdmScore, 5, 50, 20), tdmAutoBalance: cfg.tdmAutoBalance !== undefined ? !!cfg.tdmAutoBalance : true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0, players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {}, wave: 1, nextWaveTime: 0, lastPowerupSpawn: Date.now()
        };
        r.mpPref = r.maxPlayers; Modes.readSettings(r, cfg);
        return r;
    }
    function addToRoom(r, p, ready) {
        r.players[p.id] = p; const info = BOTS.get(p.id); if (info) info.roomId = r.id;
        ensureSlot(r, p); p.ready = !!ready; p.hp = ctx.getMaxHp(p.equipped);
    }
    function makeVirtualRoom(opts) {
        opts = opts || {};
        const mode = opts.mode || wpick(CFG.virtualModeW), teams = 2;
        let maxPlayers = ({ deathmatch: () => pick([4, 5, 6, 6, 6]), battle_royale: () => pick([5, 6, 6, 6]), bounty: () => pick([4, 5, 6, 6]), team_deathmatch: () => pick([4, 6, 6, 8, 10]), capture_points: () => pick([6, 6, 8, 10]), rounds: () => pick([4, 4, 6, 6, 8, 10]) })[mode]();
        const map = opts.map || pickVirtualMap(mode, teams), cfg = randomCfg(mode);
        const tier = clamp(Math.round(globalRef() + gauss() * 3), 1, 14);
        const nFill = clamp(Math.round(maxPlayers * rnd(CFG.virtualFill[0], CFG.virtualFill[1])), 2, maxPlayers - (Math.random() < 0.5 ? 1 : 0));
        const host = makeBot(tier, {}); const id = 'room_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const r = buildRoom(id, host, mode, map, maxPlayers, cfg), m = metaOf(r);
        m.virt = true; m.table = true; m.tier = tier; m.nextEvt = now0() + rnd(2000, 7000); m.startAt = now0() + rnd(CFG.autoStartMs[0], CFG.autoStartMs[1]);
        const info0 = BOTS.get(host.id); info0.where = 'virtual';
        addToRoom(r, host, Math.random() < 0.3); m.known.add(host.id);
        for (let i = 1; i < nFill; i++) { const b = makeBot(tier, {}); BOTS.get(b.id).where = 'virtual'; addToRoom(r, b, Math.random() < 0.55); m.known.add(b.id); }
        V.set(id, r);
        return r;
    }
    function removeVirtual(v) {
        V.delete(v.id); for (const id in v.players) forgetBot(id);
        v.players = {};
    }
    function startFake(v, now) {
        const m = metaOf(v);
        // потрібно ≥2 гравців і для командних режимів — дві команди
        while (Object.keys(v.players).length < 2) { const b = makeBot(m.tier, {}); BOTS.get(b.id).where = 'virtual'; addToRoom(v, b, true); m.known.add(b.id); }
        Object.values(v.players).forEach(p => { p.ready = true; });
        balanceTeams(v);
        v.status = 'playing'; m.endAt = now + rnd(CFG.fakePlayMs[0], CFG.fakePlayMs[1]);
        ctx.pushRooms();
    }
    function addVirtualBot(v, now) {
        const m = metaOf(v); if (Object.keys(v.players).length >= v.maxPlayers || totalBotCount() >= CFG.maxBotsTotal) return false;
        const b = makeBot(m.tier, {}); BOTS.get(b.id).where = 'virtual'; addToRoom(v, b, false); m.known.add(b.id); return true;
    }
    function tickVirtualRoom(v, now) {
        const m = metaOf(v);
        if (v.status === 'playing') { if (now >= m.endAt) { removeVirtual(v); m.gone = true; vGapUntil = Math.max(vGapUntil, now + rnd(2000, 4000)); vNextSpawn = Math.min(vNextSpawn, now + rnd(CFG.respawnRoomMs[0], CFG.respawnRoomMs[1])); ctx.pushRooms(); } return; }
        if (now < m.nextEvt || now < vGapUntil) return;   // зміни складу в списку — повільно: не частіше разу на ~3–6 с на ВЕСЬ список (4–8 с; інакше 8+ кімнат дають «мерехтіння» щосекунди)
        m.nextEvt = now + rnd(5000, 11000);   // повільна динаміка: зміни складу не частіше разу на 5–11 с
        const ps = Object.values(v.players), n = ps.length, host = v.players[v.hostSocket], statusBefore = v.status;
        const notReady = ps.filter(p => !p.ready), others = ps.filter(p => p !== host);
        if (m.cap === undefined) m.cap = Math.random() < 0.12 ? v.maxPlayers : Math.max(2, Math.min(v.maxPlayers - 1, Math.round(v.maxPlayers * rnd(0.45, 0.9))));
        const w = { join: n < Math.min(v.maxPlayers, m.cap) ? 4.5 : 0, leave: n > 3 && now - (m.lastJoin || 0) > 20000 ? 0.5 : 0, ready: notReady.length ? 5 : 0, unready: ps.length > 2 ? 0.25 : 0, swap: 0.5 };
        const act = wpick(w);
        let changed = true;
        if (act === 'join') { changed = addVirtualBot(v, now); if (changed) m.lastJoin = now; }
        else if (act === 'leave' && others.length) { const p = pick(others); delete v.players[p.id]; m.known.delete(p.id); forgetBot(p.id); }
        else if (act === 'ready' && notReady.length) pick(notReady).ready = true;
        else if (act === 'unready') { const p = pick(ps); p.ready = false; }
        else if (act === 'swap') { const p = pick(ps); if (usesColor(v)) { const taken = new Set(ps.filter(q => q !== p && q.color).map(q => q.color)), fr = VALID_COLORS.filter(c => !taken.has(c)); if (fr.length) p.color = pick(fr); } else if (ctx.isTeamPvp(v.mode)) { p.team = null; ensureSlot(v, p); } p.ready = false; }
        // хост-бот запускає гру: час вийшов, або всі готові й кімната достатньо повна
        const allReady = Object.values(v.players).every(p => p.ready), cnt = Object.keys(v.players).length;
        // у списку має лишатись достатньо «лобі»: гру не запускаємо, якщо це зменшить кількість відкритих сесій нижче половини
        const lobbies = Array.from(V.values()).filter(q => q.status === 'lobby').length, canStart = lobbies - 1 >= Math.max(2, Math.round(V.size * 0.5));
        if (canStart && (now >= m.startAt || (allReady && cnt >= Math.max(3, Math.ceil(v.maxPlayers * 0.8)) && now - m.born > 40000))) startFake(v, now);
        if (v.status !== statusBefore || Object.keys(v.players).length !== n) vGapUntil = now + rnd(4000, 8000);   // видима зміна (склад/статус)
        if (changed) ctx.pushRooms();
    }
    let vGapUntil = 0, vTarget = null, vTargetAt = 0, vNextSpawn = 0, vBooted = false;
    function virtualTick(now) {
        if (CFG.virtualRooms === 0) return;
        if (vTarget === null || now - vTargetAt > rnd(90000, 240000)) {      // ціль повільно «дрейфує»
            const lo = CFG.virtualRooms !== null ? CFG.virtualRooms : CFG.roomsMin, hi = CFG.virtualRooms !== null ? CFG.virtualRooms : CFG.roomsMax;
            vTarget = vTarget === null ? rint(lo, hi) : clamp(vTarget + pick([-1, 0, 1]), lo, hi); vTargetAt = now;
        }
        if (!vBooted) {   // перший запуск: одразу набираємо потрібну кількість, частина «вже грає»
            vBooted = true;
            for (let i = 0; i < vTarget; i++) {
                const v = makeVirtualRoom(); const m = metaOf(v);
                if (i % 3 === 2) { m.born = now - 60000; startFake(v, now); m.endAt = now + rnd(25000, 130000); }
                else if (i % 3 === 1) { m.born = now - rnd(5000, 40000); m.startAt = now + rnd(8000, 60000); }
            }
            ctx.pushRooms(); return;
        }
        for (const v of Array.from(V.values())) tickVirtualRoom(v, now);
        // «справжні» кімнати теж рахуємо: якщо їх багато, віртуальних менше
        const real = Object.values(rooms).filter(r => !metaOf(r).virt || humansOf(r).length).length;
        const want = Math.max(CFG.virtualRooms !== null ? CFG.virtualRooms : 3, vTarget - (CFG.virtualRooms !== null ? 0 : Math.floor(real / 3)));
        const wantEff = CFG.virtualRooms !== null ? CFG.virtualRooms : want;
        if (V.size < wantEff && now >= vNextSpawn && now >= vGapUntil && totalBotCount() < CFG.maxBotsTotal - 12) { makeVirtualRoom(); vNextSpawn = now + rnd(3000, 22000); vGapUntil = now + rnd(4000, 8000); ctx.pushRooms(); }
        else if (V.size > wantEff + 1) { const lob = Array.from(V.values()).filter(v => v.status === 'lobby'); if (lob.length && now >= vGapUntil && Math.random() < 0.02) { removeVirtual(pick(lob)); vGapUntil = now + rnd(4000, 8000); ctx.pushRooms(); } }
    }
    // перетворення віртуальної сесії на справжню кімнату (коли людина заходить)
    function materialize(v) {
        V.delete(v.id); const m = metaOf(v); m.table = false; m.virt = true; m.born = now0();
        rooms[v.id] = v; Object.keys(v.players).forEach(id => { const i = BOTS.get(id); if (i) i.where = 'rooms'; });
        return v;
    }
    ctx.hooks.extraRooms = function () {
        const out = [];
        V.forEach(v => out.push({ id: v.id, hostName: v.hostName, hostNick: v.hostName, mode: v.mode, map: v.map, playersCount: Object.keys(v.players).length, maxPlayers: v.maxPlayers, status: v.status }));
        return out;
    };
    // перед joinRoom: віртуальні сесії; повній кімнаті бот звільняє місце. true — запит оброблено (сервер далі не йде)
    ctx.hooks.preJoin = function (socket, roomId, name) {
        if (typeof roomId !== 'string') return false;
        let r = rooms[roomId];
        if (!r) {
            const v = V.get(roomId); if (!v) return false;
            if (v.status !== 'lobby') { socket.emit('joinError', 'Гра вже почалася'); return true; }
            for (const rid in rooms) for (const pid in rooms[rid].players) if (rooms[rid].players[pid].name === name) { socket.emit('joinError', 'Цей акаунт уже перебуває в сесії!'); return true; }
            if (Object.keys(v.players).length >= v.maxPlayers) { const cand = Object.values(v.players).filter(p => p.id !== v.hostSocket); if (!cand.length) { socket.emit('joinError', 'Кімната повна'); return true; } const b = pick(cand); delete v.players[b.id]; metaOf(v).known.delete(b.id); forgetBot(b.id); }
            r = materialize(v); return false;
        }
        if (r.status === 'lobby' && !r.players[socket.id] && Object.keys(r.players).length >= r.maxPlayers) {
            const cand = botsOf(r).filter(p => p.id !== r.hostSocket);
            if (cand.length) { const b = pick(cand); botLeave(r, b.id, true); }
        }
        return false;
    };

    // =====================================================================
    //  БОТИ У СПРАВЖНІХ КІМНАТАХ
    // =====================================================================
    function emitLobby(r) { io.to(r.id).emit('updateLobby', r); }
    function botLeave(r, id, silent) {
        const m = metaOf(r); m.removed.add(id); m.known.delete(id);
        const nm = BOTS.get(id) ? BOTS.get(id).p.name : null;
        forgetBot(id);
        if (r.players[id]) ctx.removePlayer(r.id, id);
        if (rooms[r.id]) emitLobby(r);
        ctx.pushRooms();
    }
    function destroyRoom(r) {
        const ids = Object.keys(r.players);
        if (r.status !== 'lobby') ctx.resetRoomToLobby(r);
        ids.forEach(id => { forgetBot(id); });
        ids.forEach(id => { if (rooms[r.id] && r.players[id]) ctx.removePlayer(r.id, id); });
        if (rooms[r.id]) { delete rooms[r.id]; ctx.SYNCS.delete(r.id); ctx.BANS.delete(r.id); try { Modes.cleanup(r.id); } catch (e) { } }
        AI.dropRoom(r.id); ctx.pushRooms();
    }
    function addRealRoomBot(r, m, now) {
        if (simBotCount() >= CFG.maxSimBots || totalBotCount() >= CFG.maxBotsTotal) return false;
        const hs = humansOf(r), ref = hs.length ? hs.reduce((a, p) => a + (p.level || 1), 0) / hs.length : globalRef();
        const p = makeBot(ref, {});
        addToRoom(r, p, false); m.known.add(p.id); BOTS.get(p.id).b.readyAt = now + rnd(1800, 9000); BOTS.get(p.id).b.pend = true;
        emitLobby(r); ctx.pushRooms(); return true;
    }
    function manageLobby(r, m, hs, bs, now) {
        const H = hs.length, eff = Math.min(r.maxPlayers, colorCap(r));
        if (!m.warmed) { m.warmed = true; AI.warm(r); }
        if (m.frac === null) { m.frac = rnd(CFG.fillHuman[0], CFG.fillHuman[1]); m.nextJoin = now + rnd(2500, 6500); }
        // вигнані лідером боти: запам'ятовуємо, щоб не повертати
        for (const id of Array.from(m.known)) if (!r.players[id]) { m.known.delete(id); if (!m.removed.has(id)) { m.noMore = bs.length; } else m.removed.delete(id); forgetBot(id); }
        let wantTotal = Math.max(2, Math.round(eff * m.frac));
        const cap = H >= 4 ? 0 : H === 3 ? 1 : H === 2 ? 2 : 99;
        let wantBots = clamp(wantTotal - H, 0, cap);
        if (m.noMore !== undefined) wantBots = Math.min(wantBots, m.noMore);
        if (m.virt) wantBots = Math.min(Math.max(wantBots, bs.length > 0 ? 1 : 0), cap);
        const total = Object.keys(r.players).length;
        if ((bs.length > wantBots || total > r.maxPlayers) && now >= m.nextLeave) {
            const cand = bs.filter(p => p.id !== r.hostSocket); if (cand.length) { botLeave(r, pick(cand).id); m.nextLeave = now + rnd(1500, 5000); return; }
        } else if (bs.length < wantBots && total < r.maxPlayers && now >= m.nextJoin) {
            if (addRealRoomBot(r, m, now)) m.nextJoin = now + rnd(CFG.joinEveryMs[0], CFG.joinEveryMs[1]);
        }
        // поведінка кожного бота: колір/команда й готовність
        let changed = false;
        for (const p of botsOf(r)) {
            const info = BOTS.get(p.id); if (!info) continue; const b = info.b;
            if ((usesColor(r) ? !p.color : (ctx.isTeamPvp(r.mode) && !TDM_TEAMS.slice(0, ctx.teamsOf(r)).includes(p.team))) && now >= b.readyAt - 1000) { if (ensureSlot(r, p)) changed = true; }
            if (!p.ready) {
                if (!b.pend) { b.pend = true; b.readyAt = now + rnd(2500, 10000); }
                else if (now >= b.readyAt && (usesColor(r) ? p.color : (ctx.isTeamPvp(r.mode) ? p.team : true))) { p.ready = true; b.pend = false; changed = true; }
            } else b.pend = false;
            if (usesColor(r) && p.color) { const dup = Object.values(r.players).some(q => q !== p && q.color === p.color); if (dup) { p.color = null; p.ready = false; changed = true; } }
        }
        // бот-лідер сам запускає гру, коли всі готові (лише в «віртуальних» сесіях; у кімнатах людей стартує людина)
        const host = r.players[r.hostSocket];
        if (host && host.isBot && m.virt) {
            const ids = Object.keys(r.players), all = ids.length >= 2 && ids.every(id => r.players[id].ready);
            if (all) {
                if (!m.startAt) m.startAt = now + rnd(1500, 4500);
                else if (now >= m.startAt) {
                    m.startAt = 0;
                    if (ctx.isTeamPvp(r.mode)) balanceTeams(r);
                    const ok = ctx.startRoomGame(r.id, () => { });
                    if (!ok) { m.failStart++; ids.forEach(id => { if (r.players[id].isBot) r.players[id].ready = false; }); changed = true; if (m.failStart > 4) { const cand = bs.filter(p => p.id !== r.hostSocket); if (cand.length) botLeave(r, pick(cand).id); } }
                }
            } else m.startAt = 0;
        }
        if (changed) emitLobby(r);
    }
    function sweepRooms(now) {
        // чистка реєстру: боти, яких уже нема в жодній кімнаті
        for (const [id, info] of BOTS) {
            if (info.where === 'virtual') { const v = V.get(info.roomId); if (!v || !v.players[id]) { forgetBot(id); } continue; }
            const r = rooms[info.roomId]; if (!r || !r.players[id]) forgetBot(id);
        }
        for (const rid of Object.keys(rooms)) {
            const r = rooms[rid]; if (!r) continue;
            const hs = humansOf(r), bs = botsOf(r);
            if (!hs.length) { if (bs.length) destroyRoom(r); continue; }
            if (r.ranked) continue;                 // рейтинговий бій: склад і боти визначає ranked.js

            if (!bs.length && !CFG.inRealRooms) continue;
            const m = metaOf(r);
            if (!eligibleMode(r.mode) || (!m.virt && !CFG.inRealRooms)) { if (bs.length) { bs.forEach(p => botLeave(r, p.id)); } continue; }
            // лідером у кімнаті людей має бути людина
            const host = r.players[r.hostSocket];
            if ((!host || host.isBot) && !m.virt) { const h = hs[0]; r.hostSocket = h.id; r.hostName = h.name; emitLobby(r); ctx.pushRooms(); }
            if (r.status === 'lobby') manageLobby(r, m, hs, bs, now);
        }
    }

    // =====================================================================
    //  ПІДКЛЮЧЕННЯ ДО СОКЕТІВ + ТІКЕР
    // =====================================================================
    ctx.onConnection(socket => {
        socket.on('shoot', d => AI.onShoot(socket.id, d));
        // зміна режиму лідером на такий, де ботам не місце, — боти виходять (інакше соло-режим відмовить через «інших гравців»)
        socket.on('updateRoomSettings', d => {
            try {
                const r = d && typeof d === 'object' ? rooms[d.roomId] : null;
                if (r && r.hostSocket === socket.id && r.status === 'lobby' && typeof d.mode === 'string' && ctx.VALID_MODES.includes(d.mode) && !eligibleMode(d.mode)) botsOf(r).forEach(p => botLeave(r, p.id));
            } catch (e) { /* ігноруємо */ }
        });
    });
    let lastSweep = 0, lastV = 0;
    const timer = setInterval(() => {
        try {
            const now = Date.now();
            AI.step(now);
            if (now - lastSweep >= 700) { lastSweep = now; sweepRooms(now); }
            if (now - lastV >= 500) { lastV = now; virtualTick(now); }
        } catch (e) { console.error('❌ bots tick:', e && e.stack || e); }
    }, CFG.tickMs);
    if (timer && timer.unref) timer.unref();

    ctx.Bots = {
        enabled: true, CFG, AI, V, BOTS, META, metaOf, isBot, makeBot, forgetBot, addToRoom, botLeave, destroyRoom, materialize, makeVirtualRoom, freshName, genEquip, genStats, mkName,
        sweepNow: () => sweepRooms(Date.now()), virtualNow: () => virtualTick(Date.now()), manageLobby, humansOf, botsOf, balanceTeams, ensureSlot,
        stats: () => ({ bots: BOTS.size, sim: simBotCount(), virtualRooms: V.size, perf: AI.perf })
    };
    console.log('🤖 Боти увімкнено' + (CFG.virtualRooms !== null ? ' (віртуальних сесій: ' + CFG.virtualRooms + ')' : '') + (CFG.inRealRooms ? '' : ' (без підключення до кімнат людей)'));
};
