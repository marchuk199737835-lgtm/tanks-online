/* stakes.js — «Фортуна» (сервер): колесо фортуни за квитки та дуелі з друзями. Правила й числа — public/js/stakesinfo.js (спільні з клієнтом).
 *
 * Колесо: оберт коштує 1 квиток (квиток дає щоденне завдання «Квиток дня» — progress.js, або адмін). Ставки немає, приз — кредити від гри.
 * Дуель: бій 1×1 з другом на кредити — результат вирішує вміння. Кредити й предмети не мають грошової вартості, вивести їх неможливо.
 *
 * Захист від зловживань:
 *  • дуелі — із 3 рівня, лише після згоди з правилами; ліміт дуелей на добу (Київ), 50…5000 кредитів, з одним другом — 3 на добу,
 *    не з тієї ж мережі (хеш IP), утікач програє, у дуелі не випадають предмети й звичайні нагороди;
 *  • ставка дуелі списується одразу й лежить «на утриманні» (u.stk.hold). Якщо сервер перезапуститься посеред бою — при вході все повертається;
 *  • колесо: результат визначає лише сервер (provably fair: хеш ключа до оберту, ключ — після), частота запитів обмежена;
 *  • старі предмети у «скриньці виграшу» (з часів батлів кейсів) можна забрати, продати чи замінити. */
'use strict';
const crypto = require('crypto');
const SI = require('./public/js/stakesinfo.js');

module.exports = function (ctx) {
    const { io, rooms, dbUsers, Events, MODULES, saveUser } = ctx;
    const priceOf = id => (MODULES[id] && MODULES[id].price) | 0;
    const nick = l => (ctx.displayName && ctx.displayName(l)) || l;
    const lvl = l => { try { return ctx.playerLevel(l); } catch (e) { return 1; } };
    const sockOf = l => ctx.onlineSocketsOf(l) || [];
    const toLogin = (l, ev, d) => sockOf(l).forEach(s => io.to(s).emit(ev, d));
    const msg = (l, t, bad) => toLogin(l, 'stkMsg', { t, bad: !!bad });
    const now = () => Date.now();
    const int = v => { const n = Math.floor(+v); return Number.isFinite(n) ? n : NaN; };

    // ================= ЧЕСНІСТЬ =================
    const newSeed = () => crypto.randomBytes(32).toString('hex');
    const sha = s => crypto.createHash('sha256').update(s).digest('hex');
    const fl = (ss, cs, nonce) => SI.hexFloat(crypto.createHmac('sha256', ss).update(cs + ':' + nonce).digest('hex'));
    let seq = 1; const gid = p => p + '_' + Date.now().toString(36) + (seq++).toString(36);

    // ================= ДАНІ ГРАВЦЯ =================
    // u.stk = { acc, day, n, hold:[{g,b,it,t}], prize:[modId], hist:[{k,d,x,t}], news:[], tk, ws, wn, wl:[оберти], spins, duW, duL }
    function S(l) {
        const u = dbUsers[l]; if (!u) return null;
        if (!u.stk || typeof u.stk !== 'object') u.stk = {};
        const s = u.stk;
        if (!Array.isArray(s.hold)) s.hold = []; if (!Array.isArray(s.prize)) s.prize = []; if (!Array.isArray(s.hist)) s.hist = [];
        if (!Array.isArray(s.news)) s.news = []; if (!Array.isArray(s.wl)) s.wl = [];
        const d = SI.dayId(now()); if (s.day !== d) { s.day = d; s.n = 0; }
        s.n = s.n | 0; s.tk = Math.max(0, Math.min(SI.TICKETS_MAX, s.tk | 0)); s.wn = s.wn | 0; s.spins = s.spins | 0; s.duW = s.duW | 0; s.duL = s.duL | 0;
        if (typeof s.ws !== 'string' || s.ws.length !== 64) s.ws = newSeed();
        return s;
    }
    const ACTIVE = new Set();      // дуелі, що зараз живуть у пам'яті
    function hist(l, k, d, x) { const s = S(l); if (!s) return; s.hist.push({ k, d: d | 0, x: String(x || '').slice(0, 80), t: now() }); if (s.hist.length > 40) s.hist.splice(0, s.hist.length - 40); }
    function canBet(l) {
        const u = dbUsers[l]; if (!u) return 'Спершу увійдіть в акаунт';
        if (lvl(l) < SI.MIN_LEVEL) return 'Дуелі відкриваються з ' + SI.MIN_LEVEL + ' рівня';
        const s = S(l); if (!s.acc) return 'Спершу прийміть правила Фортуни';
        if (s.n >= SI.DAILY) return 'Ліміт дуелей на сьогодні вичерпано (' + SI.DAILY + '). Повертайтесь завтра!';
        return null;
    }
    const betOk = a => Number.isFinite(a) && a >= SI.MIN_BET && a <= SI.MAX_BET;
    function countBet(l) { const s = S(l); s.n++; }
    // списати кредити на утримання гри g
    function takeCr(l, amt, g) {
        const u = dbUsers[l]; if (!u || !(amt > 0) || u.bucks < amt) return false;
        u.bucks -= amt; S(l).hold.push({ g, b: amt, it: [], t: now() }); return true;
    }
    // гра завершилась — утримання для g знімаємо (ставка вже або програна, або повернулась виграшем)
    function release(l, g) { const s = S(l); if (s) s.hold = s.hold.filter(h => h.g !== g); }
    function refund(l, g, part) {
        const u = dbUsers[l], s = S(l); if (!u) return;
        s.hold.filter(h => h.g === g).forEach(h => { u.bucks += h.b; giveIt(l, h.it, true); });
        s.hold = s.hold.filter(h => h.g !== g);
        if (!part) saveUser(l);
    }
    // віддати предмети: в інвентар, а що не вміщується — у скриньку виграшу (повернення старих ставок предметами)
    function giveIt(l, ids, quiet) {
        const u = dbUsers[l]; if (!u || !ids || !ids.length) return 0; const s = S(l); let box = 0;
        ids.forEach(id => { if (!MODULES[id]) return; if (u.inventory.length < SI.INV_MAX) u.inventory.push(id); else { s.prize.push(id); box++; } });
        if (box && !quiet) msg(l, '🎁 Інвентар повний: ' + box + ' предм. чекають у скриньці виграшу');
        return box;
    }
    function giveCr(l, amt) { const u = dbUsers[l]; if (u && amt > 0) { u.bucks += Math.floor(amt); if (u.stats) u.stats.earned = (u.stats.earned | 0) + Math.floor(amt); } }
    function flushEco(l) { saveUser(l); sockOf(l).forEach(s => ctx.sendEconomy(s, l)); sendMe(l); }
    // повернення ставок ігор, яких уже немає (перезапуск сервера; старі батли / койнфліпи / джекпот теж повертаються сюди)
    function settleOrphans(l) {
        const s = S(l); if (!s || !s.hold.length) return;
        const dead = [...new Set(s.hold.map(h => h.g))].filter(g => !ACTIVE.has(g)); if (!dead.length) return;
        dead.forEach(g => refund(l, g, true)); saveUser(l);
        s.news.push({ t: now(), x: 'Гру було перервано (оновлення сервера) — вашу ставку повернуто.' });
    }
    function meView(l) {
        const s = S(l), u = dbUsers[l];
        return { n: s.n, max: SI.DAILY, acc: !!s.acc, lvl: lvl(l), prize: s.prize.slice(), hist: s.hist.slice(-25).reverse(), news: s.news.splice(0), bucks: u.bucks,
            tk: s.tk, spins: s.spins, wh: { hash: sha(s.ws), n: s.wn, last: s.wl.slice(-8).reverse() } };
    }
    function sendMe(l) { if (!dbUsers[l] || !sockOf(l).length) return; toLogin(l, 'stkMe', meView(l)); }      // офлайн — новини лишаються до входу

    // ================= КОЛЕСО (за квиток) =================
    const FEED = [];      // останні великі виграші всіх гравців (для стрічки на екрані колеса)
    function addTicket(l, n, why) {
        const s = S(l); if (!s) return 0;
        const add = Math.max(0, Math.min(SI.TICKETS_MAX - s.tk, Math.floor(+n || 0))); if (!add) return 0;
        s.tk += add; saveUser(l); sendMe(l);
        Events.emit('wheelTicket', { name: l, n: add, why: why || '' });
        return add;
    }
    function whSpin(l) {
        const s = S(l), u = dbUsers[l]; if (!s.tk) return 'Немає квитків. Виконайте щоденні завдання — «Квиток дня» дає оберт колеса';
        const ss = s.ws, nonce = s.wn, idx = Math.floor(fl(ss, l, nonce) * SI.wheel.length), sec = SI.sect(SI.wheel[idx]);
        s.tk--; s.wn++; s.spins++; s.ws = newSeed();
        giveCr(l, sec.v);
        s.wl.push({ n: nonce, ss, hash: sha(ss), idx, v: sec.v, t: now() }); if (s.wl.length > 12) s.wl.splice(0, s.wl.length - 12);
        hist(l, 'wh', sec.v, 'Квиток → ' + sec.v);
        if (sec.v >= 250) { FEED.unshift({ nick: nick(l), v: sec.v, t: now() }); if (FEED.length > 12) FEED.length = 12; io.to('stk').emit('stkFeed', FEED.slice(0, 8)); }
        Events.emit('wheelSpin', { name: l, v: sec.v });
        saveUser(l); sockOf(l).forEach(sid => ctx.sendEconomy(sid, l));
        toLogin(l, 'stkWhRes', { idx, v: sec.v, n: nonce, ss, hash: sha(ss), next: sha(s.ws), tk: s.tk, bucks: u.bucks });
        sendMe(l);
        return null;
    }

    // ================= ДУЕЛІ =================
    const INV = new Map(), pairs = new Map(), ipOf = new Map();
    const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    function pairCount(a, b) { const k = pairKey(a, b), arr = (pairs.get(k) || []).filter(t => now() - t < 864e5); pairs.set(k, arr); return arr.length; }
    function roomOf(l) { for (const id in rooms) for (const p in rooms[id].players) if (rooms[id].players[p].name === l) return rooms[id]; return null; }
    function duCheck(a, b, stake) {
        if (!ctx.Social || !ctx.Social.areFriends(a, b)) return 'Дуель можлива лише з другом';
        if (!sockOf(b).length) return 'Друг зараз не в мережі';
        for (const l of [a, b]) {
            if (lvl(l) < SI.MIN_LEVEL) return (l === a ? 'Дуелі відкриваються з ' : 'Ваш друг ще не має ') + SI.MIN_LEVEL + ' рівня';
            if (roomOf(l)) return l === a ? 'Спершу вийдіть із поточної сесії' : 'Друг зараз у сесії або в бою';
            if (ctx.hooks.inRankedQueue && ctx.hooks.inRankedQueue(l)) return l === a ? 'Ви в черзі рейтингу' : 'Друг шукає рейтинговий бій';
            if ((dbUsers[l].bucks | 0) < stake) return l === a ? 'Недостатньо кредитів для ставки' : 'У друга недостатньо кредитів для такої ставки';
        }
        if (pairCount(a, b) >= SI.DU.PAIR_MAX) return 'З цим другом сьогодні вже зіграно ' + SI.DU.PAIR_MAX + ' дуелі. Спробуйте завтра';
        const ia = sockOf(a).map(s => ipOf.get(s)).filter(Boolean), ib = sockOf(b).map(s => ipOf.get(s)).filter(Boolean);
        if (ia.some(x => ib.indexOf(x) >= 0)) return 'Дуелі між акаунтами з однієї мережі заборонені';
        return null;
    }
    function duInvite(l, d) {
        const to = typeof (d && d.to) === 'string' ? d.to : ''; if (!dbUsers[to] || to === l) return 'Гравця не знайдено';
        const stake = int(d.stake); if (!betOk(stake)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const map = SI.DU.MAPS.indexOf(d.map) >= 0 && ctx.MAP_DATA[d.map] ? d.map : null; if (!map) return 'Оберіть арену';
        const rounds = SI.DU.ROUNDS.indexOf(int(d.rounds)) >= 0 ? int(d.rounds) : null, time = SI.DU.TIMES.indexOf(int(d.time)) >= 0 ? int(d.time) : null;
        if (!rounds || !time) return 'Оберіть кількість раундів і час';
        const e = canBet(l) || duCheck(l, to, stake); if (e) return e;
        for (const v of INV.values()) if (pairKey(v.a, v.b) === pairKey(l, to)) return 'Виклик цьому другу вже надіслано';
        const id = gid('du'), inv = { id, a: l, b: to, stake, map, rounds, time, at: now() };
        INV.set(id, inv);
        toLogin(to, 'stkDuInv', { id, from: l, nick: nick(l), lvl: lvl(l), stake, map, rounds, time, ttl: SI.DU.INVITE_MS });
        msg(l, '⚔ Виклик надіслано. Чекаємо на відповідь друга…');
        setTimeout(() => { if (INV.get(id) === inv) { INV.delete(id); msg(l, 'Друг не відповів на виклик'); toLogin(to, 'stkDuGone', { id }); } }, SI.DU.INVITE_MS);
        return null;
    }
    function duAnswer(l, d, sock) {
        const inv = INV.get(d && d.id); if (!inv || inv.b !== l) return 'Виклик уже неактуальний';
        INV.delete(inv.id);
        if (!d.ok) { msg(inv.a, nick(l) + ' відхилив(-ла) виклик на дуель'); return null; }
        const e = canBet(l) || canBet(inv.a) || duCheck(inv.a, l, inv.stake); if (e) { msg(inv.a, 'Дуель не відбулась: ' + e, true); return e; }
        const sa = sockOf(inv.a)[0], sb = sock.id; if (!sa) return 'Суперник вийшов з гри';
        const id = inv.id; if (!takeCr(inv.a, inv.stake, id)) return 'У суперника недостатньо кредитів';
        if (!takeCr(l, inv.stake, id)) { refund(inv.a, id); return 'Недостатньо кредитів'; }
        countBet(inv.a); countBet(l); ACTIVE.add(id); pairs.set(pairKey(inv.a, l), (pairs.get(pairKey(inv.a, l)) || []).concat(now()));
        const t = now(), rid = 'du_' + t + '_' + Math.floor(Math.random() * 1e5);
        const r = {
            id: rid, hostName: inv.a, hostSocket: sa, mode: 'rounds', map: inv.map, maxPlayers: 2, du: inv.stake,
            winScore: 50, hideTime: 30, seekTime: 120, hunterCount: 1, tdmTeams: 2, tdmTime: 180, tdmScore: 20, tdmAutoBalance: true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0, players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {}, wave: 1, nextWaveTime: 0, lastPowerupSpawn: t
        };
        Object.defineProperty(r, 'duel', { value: { id, a: inv.a, b: l, stake: inv.stake, done: false }, enumerable: false, writable: true });
        Object.defineProperty(r, '_spawnFix', { value: duelSpawns(inv.map), enumerable: false, writable: true });
        r.mpPref = 2; ctx.Modes.readSettings(r, { rdRounds: inv.rounds, rdTime: inv.time, rdDraw: false, tdmAutoBalance: true });
        rooms[rid] = r;
        [[sa, inv.a, 'red'], [sb, l, 'blue']].forEach(([sid, login, team]) => { const s = io.sockets.sockets.get(sid); if (s) s.join(rid); const p = ctx.newPlayerEntry(sid, login); p.team = team; p.color = team; p.ready = true; r.players[sid] = p; });
        [sa, sb].forEach(sid => io.to(sid).emit('stkDuGo', { roomId: rid, roomData: r, stake: inv.stake }));
        flushEco(inv.a); flushEco(l);
        if (!ctx.startRoomGame(rid, m => console.warn('duel start:', m))) {
            Object.keys(r.players).forEach(pid => { const s = io.sockets.sockets.get(pid); if (s) s.leave(rid); });
            delete rooms[rid]; [inv.a, l].forEach(x => { refund(x, id); flushEco(x); msg(x, 'Не вдалося запустити дуель — ставку повернуто', true); toLogin(x, 'stkDuFail', {}); });
            ACTIVE.delete(id);
        }
        return null;
    }
    // бази суперників на арені: дві досяжні вільні точки якнайдалі одна від одної (але не більше ~1500 px — щоб раунд не перетворювався на пошуки)
    const spCache = new Map();
    function duelSpawns(mapName) {
        if (spCache.has(mapName)) return spCache.get(mapName);
        let out = null;
        try {
            const m = ctx.MAP_DATA[mapName], Nav = ctx.Nav, g = Nav.getGrid(m, 30), sp = m.solids.find(o => o.type === 'spawn_player'); if (!sp) return null;
            const f = Nav.buildField(g, sp.x, sp.y), pts = [];
            for (let i = 0; i < f.dist.length; i += 3) { if (f.dist[i] < 0) continue; const x = (i % g.N + 0.5) * Nav.CS, y = (Math.floor(i / g.N) + 0.5) * Nav.CS; if (!ctx.MapObj.collides(m, x, y, 44)) pts.push({ x, y }); }
            let best = -1;
            for (let a = 0; a < pts.length; a += 2) for (let b = a + 1; b < pts.length; b += 2) { const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); if (d <= 1500 && d > best) { best = d; out = { red: pts[a], blue: pts[b] }; } }
        } catch (e) { console.error('❌ duel spawns', e && e.message); }
        spCache.set(mapName, out); return out;
    }
    function duPay(r, winLogin, why) {
        const D = r.duel; if (!D || D.done) return; D.done = true;
        const lose = winLogin === D.a ? D.b : D.a, prize = Math.floor(D.stake * 2 * (1 - SI.FEE));
        giveCr(winLogin, prize);
        [D.a, D.b].forEach(x => { const s = S(x); if (s) { if (x === winLogin) s.duW++; else s.duL++; } });
        [D.a, D.b].forEach(x => { release(x, D.id); hist(x, 'du', x === winLogin ? prize - D.stake : -D.stake, (x === winLogin ? 'Перемога' : 'Поразка') + ' · ' + nick(x === D.a ? D.b : D.a)); flushEco(x); });
        ACTIVE.delete(D.id);
        [D.a, D.b].forEach(x => toLogin(x, 'stkDuRes', { win: x === winLogin, prize, stake: D.stake, vs: nick(x === D.a ? D.b : D.a), why: why || '' }));
        Events.emit('duelEnd', { winner: winLogin, loser: lose, stake: D.stake, prize, why: why || '' });
    }
    Events.on('matchEnd', ev => {
        try {
            const r = ev && rooms[ev.roomId]; if (!r || !r.duel || r.duel.done) return;
            const w = ev.players.find(p => p.outcome === 'win'); if (w) duPay(r, w.name, '');
            else { [r.duel.a, r.duel.b].forEach(x => { refund(x, r.duel.id); flushEco(x); }); r.duel.done = true; ACTIVE.delete(r.duel.id); }
        } catch (e) { console.error('❌ duel matchEnd', e && e.stack || e); }
    });
    ctx.hooks.duelLeave = function (r, left) {
        if (!r.duel || r.duel.done || r.status !== 'playing' || !left) return;
        const other = left.name === r.duel.a ? r.duel.b : r.duel.a;
        duPay(r, other, 'leave');
    };

    // ================= СКРИНЬКА ВИГРАШУ (старі предмети) =================
    function prizeAct(l, d) {
        const u = dbUsers[l], s = S(l), i = int(d && d.i), id = s.prize[i]; if (!id) return 'Предмет не знайдено';
        if (d.act === 'sell') { s.prize.splice(i, 1); u.bucks += priceOf(id); hist(l, 'box', priceOf(id), 'Продано ' + MODULES[id].name); }
        else if (d.act === 'take') { if (u.inventory.length >= SI.INV_MAX) return 'Інвентар повний — продайте або замініть предмет'; s.prize.splice(i, 1); u.inventory.push(id); }
        else if (d.act === 'swap') {
            const j = int(d.with); const old = u.inventory[j]; if (!old) return 'Оберіть предмет з інвентарю';
            s.prize.splice(i, 1); u.inventory.splice(j, 1, id); u.bucks += priceOf(old); hist(l, 'box', priceOf(old), 'Замінено ' + MODULES[old].name);
        } else return null;
        flushEco(l); return null;
    }

    // ================= СОКЕТ =================
    Events.on('login', e => { try { if (e && dbUsers[e.name]) settleOrphans(e.name); } catch (er) {} });
    const H = { stkWhSpin: whSpin, stkDuInv: duInvite, stkDuAns: duAnswer, stkPrize: prizeAct };
    const GAP = { stkWhSpin: 1200 };      // оберт триває ~6,5 с; частіше ніж раз на 1,2 с не приймаємо
    ctx.onConnection(socket => {
        ipOf.set(socket.id, ctx.ipHashOf(socket));
        const last = {};
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        socket.on('stkHello', () => {
            const l = me(); if (!l) return; socket.join('stk'); settleOrphans(l);
            socket.emit('stkState', { me: meView(l), feed: FEED.slice(0, 8), now: now() });
        });
        socket.on('stkBye', () => socket.leave('stk'));
        socket.on('stkRules', () => { const l = me(); if (!l) return; const s = S(l); if (!s.acc) { s.acc = now(); saveUser(l); } sendMe(l); });
        Object.keys(H).forEach(ev => socket.on(ev, d => {
            const l = me(); if (!l) return; const t = now(); if (t - (last[ev] || 0) < (GAP[ev] || 350)) return; last[ev] = t;
            let err = null; try { err = H[ev](l, d || {}, socket); } catch (e) { console.error('❌ stakes', ev, e && e.stack || e); err = 'Помилка сервера, спробуйте ще раз'; }
            if (err) socket.emit('stkMsg', { t: err, bad: true, ev });
            else socket.emit('stkOk', { ev });
        }));
        socket.on('stkDuLeave', () => {
            for (const id in rooms) { const r = rooms[id]; if (r.duel && r.players[socket.id]) { socket.leave(id); ctx.removePlayer(id, socket.id); } }
        });
        socket.on('disconnect', () => { ipOf.delete(socket.id); });
    });

    ctx.Stakes = { INV, settleOrphans, S, addTicket, tickets: l => { const s = S(l); return s ? s.tk : 0; }, _ip: ipOf, _pairs: pairs };
};
