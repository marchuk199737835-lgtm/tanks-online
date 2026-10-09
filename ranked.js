/* ranked.js — рейтинговий режим: черга 1×1 / 2×2 / 5×5, підбір суперників у межах ±1 рангу, бій одразу (без лобі), очки рейтингу (ОР),
 * сезони (щомісяця, Київ) з нагородами за лігою, таблиця лідерів. Ранги й формули — public/js/rankinfo.js (спільні з клієнтом).
 *
 * Захист від накрутки (твінки, «злив» другом):
 *  • доступ лише з 5 рівня й після 10 зіграних боїв (свіжий твінк не потрапить у рейтинг);
 *  • акаунти з однієї мережі (хеш IP) ніколи не потрапляють в один матч — ні суперниками, ні союзниками;
 *  • одна й та сама пара гравців — не більше 3 рейтингових боїв за добу (далі підбір шукає інших або ботів);
 *  • черга лише соло (без груп): домовитись «зустрітись» неможливо, підбір сам обирає склад і команди;
 *  • бездіяльний (не завдав шкоди й нікого не знищив) не отримує ОР за перемогу, а за поразку втрачає ×1.5;
 *  • вихід з бою = поразка зі штрафом і 3 хвилини без черги; місце займає бот, щоб бій для інших тривав.
 *
 * Сокет (клієнт → сервер): rkInfo · rkJoin {fmt} · rkCancel · rkLeave (після бою) · rkClaim {sid}
 * Сервер → клієнт: rkInfo {…} · rkQueue {fmt,at,fill}|null · rkFound {roomId,roomData,fmt,mode} · rkResult {…} · rkError {msg}
 * Кімната рейтингового бою: r.rk = формат (видно клієнту), r.ranked — службові дані (не серіалізуються). */
'use strict';
const RI = require('./public/js/rankinfo.js');

module.exports = function (ctx) {
    const { io, rooms, dbUsers, Events, GameData, ModeInfo, MAP_DATA, MapObj, saveUser } = ctx;
    const FMT = RI.FORMATS, FILL_MS = { '1v1': 8000, '2v2': 10000, '5v5': 12000 };
    const MODES = [['team_deathmatch', 1], ['capture_points', 1], ['rounds', 1.2]];
    const PAIR_MAX = 3, PAIR_WIN = 24 * 3600e3, DESERT_MS = 3 * 60e3;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const queue = new Map();        // login → { login, sid, fmt, rp, div, at, ip }
    const pairs = new Map();        // 'a|b' → [час бою, …]
    const deserter = new Map();     // login → до коли заборонена черга
    const ipOf = new Map();         // socket.id → хеш IP

    // ---------- сезон ----------
    const seasonId = () => { try { return ctx.Profile.seasonId(); } catch (e) { const d = new Date(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); } };
    const seasonEnd = () => { try { return ctx.Profile.seasonEnd(); } catch (e) { return 0; } };

    // ---------- дані гравця ----------
    function rk(login) {
        const u = dbUsers[login]; if (!u) return null;
        if (!u.rk || typeof u.rk !== 'object') u.rk = { sid: null, rp: 0, games: 0, w: 0, l: 0, d: 0, streak: 0, peak: 0, shield: 0, hist: [], pend: [] };
        const R = u.rk; ['rp', 'games', 'w', 'l', 'd', 'streak', 'peak', 'shield'].forEach(k => { R[k] = Number.isFinite(R[k]) ? Math.max(0, Math.floor(R[k])) : 0; });
        if (!Array.isArray(R.hist)) R.hist = []; if (!Array.isArray(R.pend)) R.pend = [];
        rollover(login, R);
        return R;
    }
    // новий сезон: нагорода за минулий (якщо ≥5 боїв) у R.pend, м'яке скидання рейтингу
    function rollover(login, R) {
        const cur = seasonId(); if (R.sid === cur) return;
        if (R.sid && R.games >= RI.MIN_SEASON_GAMES) { R.pend.push({ sid: R.sid, div: RI.divOf(R.rp), rp: R.rp, games: R.games, claimed: false }); if (R.pend.length > 6) R.pend.splice(0, R.pend.length - 6); }
        R.rp = R.sid ? Math.round(R.rp * RI.SOFT_RESET) : 0; R.games = R.w = R.l = R.d = R.streak = R.shield = 0; R.peak = R.rp; R.hist = []; R.sid = cur;
        saveUser(login); topCache = null;
    }
    const lvl = login => { try { return ctx.playerLevel(login); } catch (e) { return 1; } };
    const unlocked = login => { const u = dbUsers[login]; return !!u && lvl(login) >= RI.MIN_LEVEL && ((u.stats && u.stats.matches) | 0) >= RI.MIN_MATCHES; };
    const nick = login => (ctx.displayName && ctx.displayName(login)) || login;
    const clanOf = login => { try { return ctx.hooks.clanTag(login) || ''; } catch (e) { return ''; } };
    const sockOf = login => ctx.onlineSocketsOf(login);

    // ---------- таблиця лідерів (кеш 10 с) ----------
    let topCache = null, topAt = 0;
    function top() {
        const now = Date.now(); if (topCache && now - topAt < 10000) return topCache;
        const cur = seasonId(), rows = [];
        for (const l in dbUsers) { const R = dbUsers[l] && dbUsers[l].rk; if (R && R.sid === cur && R.games > 0) rows.push({ l, rp: R.rp | 0, w: R.w | 0, g: R.games | 0 }); }
        rows.sort((a, b) => b.rp - a.rp || b.w - a.w || (a.l < b.l ? -1 : 1));
        topCache = { place: new Map(rows.map((r, i) => [r.l, i + 1])), rows: rows.slice(0, 50).map((r, i) => ({ place: i + 1, h: ctx.Handles ? ctx.Handles.of(r.l) : null, nick: nick(r.l), clan: clanOf(r.l), rp: r.rp, div: RI.divOf(r.rp), w: r.w, g: r.g, lvl: lvl(r.l) })), n: rows.length };
        topAt = now; return topCache;
    }
    function info(login) {
        const u = dbUsers[login], R = rk(login), t = top(), q = queue.get(login), now = Date.now();
        return {
            unlocked: unlocked(login), need: { level: RI.MIN_LEVEL, matches: RI.MIN_MATCHES, lv: lvl(login), m: (u.stats && u.stats.matches) | 0 },
            rp: R.rp, div: RI.divOf(R.rp), games: R.games, w: R.w, l: R.l, d: R.d, streak: R.streak, peak: R.peak, shield: R.shield, hist: R.hist.slice(-8).reverse(),
            season: { id: R.sid, end: seasonEnd(), now }, place: t.place.get(login) || null, total: t.n, top: t.rows,
            pend: R.pend.filter(p => !p.claimed).map(p => Object.assign({ reward: rewardFor(p.div) }, p)),
            queue: q ? { fmt: q.fmt, at: q.at, fill: FILL_MS[q.fmt], now } : null, desert: Math.max(0, (deserter.get(login) || 0) - now),
            online: online()
        };
    }
    function online() { const c = { '1v1': 0, '2v2': 0, '5v5': 0 }; queue.forEach(q => { c[q.fmt]++; }); let inMatch = 0; for (const id in rooms) if (rooms[id].ranked && rooms[id].status === 'playing') for (const p in rooms[id].players) if (!rooms[id].players[p].isBot) inMatch++; return { q: c, play: inMatch }; }

    // ---------- сезонні нагороди ----------
    const caseIds = () => Object.keys(GameData.CASES).map(Number);
    function caseNear(price) { let best = null, bd = 1e9; caseIds().forEach(id => { const d = Math.abs(GameData.CASES[id].price - price); if (d < bd) { bd = d; best = id; } }); return best; }
    function rewardFor(div) {
        const t = RI.DIVS[div].t, R = RI.SEASON_REWARDS[t], cs = R.legend ? GameData.legendCaseId() : R.caseP ? caseNear(R.caseP) : null;
        return { cr: R.cr, caseId: cs, caseName: cs && GameData.CASES[cs] ? GameData.CASES[cs].name : '' };
    }

    // ---------- черга ----------
    function leaveQueue(login, sid) { const q = queue.get(login); if (!q || (sid && q.sid !== sid)) return false; queue.delete(login); (sockOf(login) || []).forEach(s => io.to(s).emit('rkQueue', null)); return true; }
    ctx.hooks.inRankedQueue = login => queue.has(login);
    ctx.hooks.leaveRankedQueue = login => leaveQueue(login);
    function roomOfLogin(login) { for (const id in rooms) for (const p in rooms[id].players) if (rooms[id].players[p].name === login) return rooms[id]; return null; }
    const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    function pairCount(a, b, now) { const k = pairKey(a, b), arr = (pairs.get(k) || []).filter(t => now - t < PAIR_WIN); if (arr.length) pairs.set(k, arr); else pairs.delete(k); return arr.length; }
    function notePairs(logins, now) { for (let i = 0; i < logins.length; i++) for (let j = i + 1; j < logins.length; j++) { const k = pairKey(logins[i], logins[j]); const a = pairs.get(k) || []; a.push(now); pairs.set(k, a); } }
    const botsOn = () => !!(ctx.Bots && ctx.Bots.enabled);

    function tick() {
        const now = Date.now();
        for (const [l, q] of queue) if (!dbUsers[l] || !io.sockets.sockets.has(q.sid)) queue.delete(l);
        Object.keys(FMT).forEach(fmt => {
            const N = FMT[fmt], need = 2 * N, list = [...queue.values()].filter(q => q.fmt === fmt).sort((a, b) => a.at - b.at), used = new Set();
            for (const a of list) {
                if (used.has(a.login)) continue;
                const g = [a]; let lo = a.div, hi = a.div;
                for (const c of list) {
                    if (g.length >= need) break; if (c === a || used.has(c.login)) continue;
                    const nlo = Math.min(lo, c.div), nhi = Math.max(hi, c.div); if (nhi - nlo > 1) continue;      // усі в межах ±1 рангу
                    if (g.some(x => x.ip && x.ip === c.ip)) continue;                                           // одна мережа — ніколи в одному матчі
                    if (g.some(x => pairCount(x.login, c.login, now) >= PAIR_MAX)) continue;                    // одна пара — не частіше 3 разів на добу
                    g.push(c); lo = nlo; hi = nhi;
                }
                if (g.length === need || (now - a.at >= FILL_MS[fmt] && botsOn())) { g.forEach(x => used.add(x.login)); try { makeMatch(fmt, g, now); } catch (e) { console.error('❌ ranked match', e && e.stack || e); g.forEach(x => { const q = queue.get(x.login); if (q) q.at = now; }); } }
            }
        });
    }
    const timer = setInterval(() => { try { tick(); } catch (e) { console.error('❌ ranked tick', e && e.message); } }, 1000); if (timer.unref) timer.unref();

    // ---------- створення матчу ----------
    function pickMode() { const tot = MODES.reduce((s, m) => s + m[1], 0); let x = Math.random() * tot; for (const m of MODES) { x -= m[1]; if (x < 0) return m[0]; } return MODES[0][0]; }
    function pickMapFor(mode, N) {
        const spawns = k => (MAP_DATA[k].solids || []).filter(s => s.type === 'spawn_player').length;
        let keys = Object.keys(MAP_DATA).filter(k => MapObj.mapAllows(MAP_DATA[k], mode) && spawns(k) >= 2);
        if (!keys.length) keys = Object.keys(MAP_DATA).filter(k => spawns(k) >= 2);
        if (!keys.length) return ctx.pickMap(null, mode);
        keys.sort((a, b) => (MAP_DATA[a].size || 0) - (MAP_DATA[b].size || 0));
        const half = Math.max(1, Math.ceil(keys.length / 2)), pool = N === 1 ? keys.slice(0, half) : N >= 5 ? keys.slice(keys.length - half) : keys;
        return pool[Math.floor(Math.random() * pool.length)];
    }
    function cfgFor(mode, N) {
        if (mode === 'team_deathmatch') return { tdmTeams: 2, tdmTime: N === 1 ? 150 : 180, tdmScore: N === 1 ? 10 : N === 2 ? 15 : 25, tdmAutoBalance: true };
        if (mode === 'capture_points') return { cpTeams: 2, cpPoints: N === 1 ? 1 : N === 2 ? 2 : 3, cpScore: N === 1 ? 200 : 300, cpTime: N === 1 ? 240 : 300, tdmAutoBalance: true };
        return { rdRounds: 6, rdTime: N === 1 ? 60 : N === 2 ? 75 : 90, rdDraw: false, tdmAutoBalance: true };
    }
    function makeMatch(fmt, group, now) {
        const N = FMT[fmt], mode = pickMode(), map = pickMapFor(mode, N);
        // перевірка: усі ще онлайн і не в іншій кімнаті
        const humans = group.filter(q => io.sockets.sockets.has(q.sid) && !roomOfLogin(q.login));
        group.forEach(q => queue.delete(q.login));
        if (!humans.length) return;
        if (humans.length < 2 * N && !botsOn()) { humans.forEach(q => { q.at = now; queue.set(q.login, q); }); return; }
        // команди «змійкою» за рейтингом: 1-й → A, 2-й → B, 3-й → B, 4-й → A …
        const hs = humans.slice().sort((a, b) => b.rp - a.rp), T = { red: [], blue: [] };
        hs.forEach((q, i) => { const k = i % 4; (k === 0 || k === 3 ? T.red : T.blue).push(q); });
        if (T.red.length > N) T.blue.push(...T.red.splice(N)); if (T.blue.length > N) T.red.push(...T.blue.splice(N));
        const id = 'rk_' + now + '_' + Math.floor(Math.random() * 1e5), cfg = cfgFor(mode, N);
        const r = {
            id, hostName: hs[0].login, hostSocket: hs[0].sid, mode, map, maxPlayers: 2 * N, rk: fmt,
            winScore: 50, hideTime: 30, seekTime: 120, hunterCount: 1, tdmTeams: 2, tdmTime: cfg.tdmTime || 180, tdmScore: cfg.tdmScore || 20, tdmAutoBalance: true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0, players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {}, wave: 1, nextWaveTime: 0, lastPowerupSpawn: now
        };
        Object.defineProperty(r, 'ranked', { value: { fmt, rp: {}, dmg: {}, left: {}, t0: now, done: false, humans: hs.map(q => q.login) }, enumerable: false, writable: true });
        r.mpPref = r.maxPlayers; ctx.Modes.readSettings(r, cfg);
        rooms[id] = r;
        const anchor = hs.reduce((s, q) => s + q.rp, 0) / hs.length, adiv = RI.divOf(anchor);
        ['red', 'blue'].forEach(team => {
            T[team].forEach(q => {
                const s = io.sockets.sockets.get(q.sid); if (s) s.join(id);
                const p = ctx.newPlayerEntry(q.sid, q.login); p.team = team; p.color = team; p.ready = true;
                r.players[q.sid] = p; r.ranked.rp[q.sid] = q.rp;
            });
            // боти добирають команду до N; рейтинг бота — у межах ±1 рангу від гравців, рівень і вміння — за рангом
            for (let i = T[team].length; i < N; i++) {
                const brp = clamp(Math.round(anchor + rnd(-70, 70)), 0, 99999), bdiv = RI.divOf(brp);
                const level = clamp(Math.round(5 + bdiv * 0.75 + rnd(-1, 1.5)), RI.MIN_LEVEL, GameData.MAX_LEVEL || 15);
                const b = ctx.Bots.makeBot(level, { level, skill: clamp(0.22 + bdiv * 0.055 + rnd(-0.05, 0.05), 0.15, 0.95) });
                ctx.Bots.addToRoom(r, b, true); b.team = team; b.color = team; b.ready = true;
                r.ranked.rp[b.id] = brp;
            }
        });
        notePairs(hs.map(q => q.login), now);
        humans.forEach(q => io.to(q.sid).emit('rkFound', { roomId: id, roomData: r, fmt, mode }));
        const ok = ctx.startRoomGame(id, msg => console.warn('ranked start:', msg));
        if (!ok) {   // не вдалося стартувати (мапа без спавнів тощо) — прибираємо кімнату, гравці повертаються в чергу
            Object.keys(r.players).forEach(pid => { const s = io.sockets.sockets.get(pid); if (s) s.leave(id); if (r.players[pid].isBot && ctx.Bots.forgetBot) ctx.Bots.forgetBot(pid); });
            delete rooms[id];
            humans.forEach(q => { q.at = now; queue.set(q.login, q); io.to(q.sid).emit('rkError', { msg: 'Не вдалося запустити бій. Шукаємо знову…', requeue: true }); });
        }
    }

    // ---------- підсумки бою ----------
    const perf = p => (p.kills | 0) * 3 + (p.caps | 0) * 2 - (p.deaths | 0) * 0.5;
    Events.on('matchEnd', ev => {
        try {
            const r = ev && rooms[ev.roomId]; if (!r || !r.ranked || r.ranked.done) return;
            r.ranked.done = true;
            const now = Date.now(), K = r.ranked, list = ev.players.filter(p => p.team === 'red' || p.team === 'blue');
            const rpOf = p => K.rp[p.id] != null ? K.rp[p.id] : 0;
            const avg = t => { const a = list.filter(p => p.team === t); return a.length ? a.reduce((s, p) => s + rpOf(p), 0) / a.length : 0; };
            const A = { red: avg('red'), blue: avg('blue') };
            const sorted = list.slice().sort((a, b) => perf(b) - perf(a)), mvp = sorted[0] ? sorted[0].id : null;
            const topOf = t => { const a = sorted.filter(p => p.team === t); return a[0] ? a[0].id : null; };
            const TOP = { red: topOf('red'), blue: topOf('blue') };
            let winT = null; list.forEach(p => { if (p.outcome === 'win') winT = p.team; });
            const rows = [], mine = {};
            list.forEach(p => {
                const rp = K.rp[p.id] != null ? K.rp[p.id] : 0, opp = A[p.team === 'red' ? 'blue' : 'red'], rp0 = r.players[p.id];
                const human = !p.isBot && !!dbUsers[p.name];
                let d, after = rp;
                if (human) {
                    const R = rk(p.name), afk = (K.dmg[p.id] || 0) <= 0 && !(p.kills > 0) && !(p.caps > 0);
                    d = RI.delta({ me: R.rp, opp, outcome: p.outcome, mvp: p.id === mvp, top: TOP[p.team] === p.id, streak: R.streak, afk });
                    const before = R.rp, t0 = RI.tierOf(before);
                    R.rp = Math.max(0, R.rp + d);
                    if (d < 0 && R.shield > 0 && RI.tierIdx(RI.tierOf(R.rp)) < RI.tierIdx(t0)) { R.rp = RI.tierFloor(t0); R.shield--; }   // захист рангу
                    if (RI.tierIdx(RI.tierOf(R.rp)) > RI.tierIdx(t0)) R.shield = RI.SHIELD;
                    d = R.rp - before; after = R.rp;
                    R.games++; if (p.outcome === 'win') { R.w++; R.streak++; } else if (p.outcome === 'loss') { R.l++; R.streak = 0; } else R.d++;
                    R.peak = Math.max(R.peak, R.rp);
                    R.hist.push({ o: p.outcome, d, m: ev.mode, f: K.fmt, t: now }); if (R.hist.length > 20) R.hist.splice(0, R.hist.length - 20);
                    saveUser(p.name);
                    mine[p.id] = { before, after: R.rp, d, divB: RI.divOf(before), divA: RI.divOf(R.rp), shield: R.shield, afk };
                } else {   // бот: та сама формула, щоб у таблиці він виглядав як звичайний гравець
                    d = RI.delta({ me: rp, opp, outcome: p.outcome, mvp: p.id === mvp, top: TOP[p.team] === p.id, streak: 0, afk: false });
                    after = Math.max(0, rp + d);
                }
                rows.push({ id: p.id, nick: rp0 ? String(rp0.nick || rp0.name || p.name).slice(0, 24) : String(p.name).slice(0, 24), clan: rp0 ? (rp0.clan || '') : '', team: p.team, kills: p.kills | 0, deaths: p.deaths | 0, caps: p.caps | 0,
                    eq: rp0 ? rp0.equipped : null, lvl: rp0 ? rp0.level || 1 : 1, div: RI.divOf(after), d, mvp: p.id === mvp, out: p.outcome, cr: p.credits | 0 });
            });
            topCache = null;
            const order = rows.slice().sort((a, b) => (b.out === 'win') - (a.out === 'win') || (b.kills * 3 + b.caps * 2 - b.deaths * 0.5) - (a.kills * 3 + a.caps * 2 - a.deaths * 0.5));
            list.forEach(p => {
                if (!mine[p.id]) return; const m = mine[p.id];
                io.to(p.id).emit('rkResult', { fmt: K.fmt, mode: ev.mode, map: r.map, outcome: p.outcome, team: p.team, win: winT, score: ev.score || null, rows: order, me: p.id,
                    rp: m, credits: p.credits | 0, xp: p.xp || null, dropped: p.dropped || null, dur: ev.durationMs | 0 });
            });
        } catch (e) { console.error('❌ ranked matchEnd', e && e.stack || e); }
    });

    // вихід посеред бою: поразка зі штрафом, черга недоступна 3 хв; на місце гравця стає бот (команда не лишається в меншості)
    ctx.hooks.rankedLeave = function (r, left) {
        if (!left || left.isBot || r.status !== 'playing' || !r.ranked || r.ranked.done || !dbUsers[left.name] || r.ranked.left[left.name]) return;
        const K = r.ranked; K.left[left.name] = true;
        const R = rk(left.name), oppT = left.team === 'red' ? 'blue' : 'red';
        const opp = Object.values(r.players).filter(p => p.team === oppT), oppAvg = opp.length ? opp.reduce((s, p) => s + (K.rp[p.id] || 0), 0) / opp.length : R.rp;
        const d = Math.min(-10, Math.round(RI.delta({ me: R.rp, opp: oppAvg, outcome: 'loss', afk: true }) * 1.2));
        const before = R.rp; R.rp = Math.max(0, R.rp + d); R.games++; R.l++; R.streak = 0;
        R.hist.push({ o: 'leave', d: R.rp - before, m: r.mode, f: K.fmt, t: Date.now() }); if (R.hist.length > 20) R.hist.splice(0, R.hist.length - 20);
        deserter.set(left.name, Date.now() + DESERT_MS); saveUser(left.name); topCache = null;
        if (!botsOn()) return;
        const hasHuman = Object.values(r.players).some(p => !p.isBot); if (!hasHuman) return;
        const level = clamp(left.level || 5, 1, GameData.MAX_LEVEL || 15), b = ctx.Bots.makeBot(level, { level, skill: clamp(0.22 + RI.divOf(K.rp[left.id] || 0) * 0.055, 0.15, 0.95) });
        ctx.Bots.addToRoom(r, b, true); b.team = left.team; b.color = left.team; b.ready = true;
        b.x = left.x; b.y = left.y; b.hp = left.hp; b.out = !!left.out; K.rp[b.id] = K.rp[left.id] || 0;
    };

    // ---------- сокет ----------
    Events.on('login', e => { try { if (e && dbUsers[e.name]) rk(e.name); } catch (er) {} });
    ctx.onConnection(socket => {
        ipOf.set(socket.id, ctx.ipHashOf(socket));
        let last = 0;
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        const gate = ms => { const t = Date.now(); if (t - last < ms) return false; last = t; return true; };
        const err = msg => socket.emit('rkError', { msg });
        socket.on('rkInfo', () => { const n = me(); if (!n || !gate(250)) return; socket.emit('rkInfo', info(n)); });
        socket.on('rkJoin', d => {
            const n = me(); if (!n || !gate(400)) return;
            const fmt = d && typeof d.fmt === 'string' && FMT[d.fmt] ? d.fmt : null; if (!fmt) return err('Оберіть формат бою');
            if (!unlocked(n)) return err('Рейтинговий режим відкривається з ' + RI.MIN_LEVEL + ' рівня та після ' + RI.MIN_MATCHES + ' зіграних боїв');
            const du = (deserter.get(n) || 0) - Date.now(); if (du > 0) return err('Ви покинули рейтинговий бій. Черга буде доступна через ' + Math.ceil(du / 1000) + ' с');
            const inR = roomOfLogin(n);
            if (inR) {
                if (inR.ranked && inR.status !== 'playing') { socket.leave(inR.id); ctx.removePlayer(inR.id, socket.id); }   // ще «висить» у завершеному рейтинговому бою
                else return err('Спершу вийдіть із поточної сесії');
            }
            const R = rk(n), q = { login: n, sid: socket.id, fmt, rp: R.rp, div: RI.divOf(R.rp), at: Date.now(), ip: ipOf.get(socket.id) || '' };
            queue.set(n, q);
            socket.emit('rkQueue', { fmt, at: q.at, fill: FILL_MS[fmt], now: q.at });
        });
        socket.on('rkCancel', () => { const n = me(); if (n) leaveQueue(n); });
        socket.on('rkLeave', () => {
            const n = me(); if (!n) return;
            for (const id in rooms) { const r = rooms[id]; if (r.ranked && r.players[socket.id] && r.status !== 'playing') { socket.leave(id); ctx.removePlayer(id, socket.id); } }
        });
        socket.on('rkClaim', d => {
            const n = me(); if (!n || !gate(500)) return; const u = dbUsers[n], R = rk(n);
            const p = R.pend.find(x => x && !x.claimed && d && x.sid === d.sid); if (!p) return err('Нагороду вже отримано');
            const rw = rewardFor(p.div);
            if (rw.caseId && u.inventory.length >= 30) return err('Інвентар повний (макс 30)! Звільніть місце для кейса');
            const modId = rw.caseId ? ctx.getRandomModuleFromCase(rw.caseId) : null; if (rw.caseId && !modId) return err('Не вдалося відкрити кейс, спробуйте ще раз');
            p.claimed = true; u.bucks += rw.cr; u.stats.earned = (u.stats.earned | 0) + rw.cr; if (modId) u.inventory.push(modId);
            saveUser(n); ctx.sendEconomy(socket.id, n);
            socket.emit('rkClaimed', { sid: p.sid, cr: rw.cr, caseId: rw.caseId });
            if (modId) { socket.emit('caseResult', { modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId: rw.caseId, fromProgress: 'rk' }); Events.emit('caseOpened', { name: n, caseId: rw.caseId, modId, price: 0, fromLevel: true }); }
            socket.emit('rkInfo', info(n));
        });
        socket.on('disconnect', () => { const n = ctx.globalPlayers[socket.id]; if (n) leaveQueue(n, socket.id); ipOf.delete(socket.id); });
    });

    ctx.Ranked = { info, rk, queue, top, _tick: tick, _makeMatch: makeMatch };
};
