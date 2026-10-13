/* analytics.js — проста аналітика гри для адмін-панелі (вкладка «📈 Аналітика»). Лише агрегати, без персональних даних у звітах.
 *
 * Що рахується (по днях за Києвом, зберігається 45 днів у MongoDB meta/analytics — один запис раз на 5 хв, якщо щось змінилось):
 *   • активні гравці за день (DAU), нові реєстрації, пік онлайну, кількість і тривалість сесій;
 *   • режими: кількість боїв, гравців, середня тривалість, скільки разів гравці покинули бій посеред матчу («кидають гру»);
 *   • Фортуна: оберти колеса, видані кредити, квитки, дуелі та їхні ставки.
 * Воронка новачків (рахується на льоту з акаунтів у пам'яті, за 30 днів): реєстрація → навчання → 1 / 3 / 10 боїв,
 * повернення на 1-й і 7-й день (u.an.m — бітова маска днів, у які гравець заходив, перші 31 день від реєстрації).
 * Пам'ять: акаунтів у пам'яті, середній розмір акаунта, RSS / heap процесу й межа heap — щоб вчасно помітити, коли час вивантажувати неактивних. */
'use strict';
const v8 = require('v8');

module.exports = function (ctx) {
    const { io, dbUsers, Events, saveUser } = ctx;
    const KEEP_DAYS = 45, DAY = 864e5;
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.ADVENT_TZ || 'Europe/Kiev', year: 'numeric', month: '2-digit', day: '2-digit' });
    const dayId = ms => { const p = {}; fmt.formatToParts(new Date(ms)).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; }); return p.year + '-' + p.month + '-' + p.day; };
    const dayNum = ms => Math.floor(Date.parse(dayId(ms) + 'T00:00:00Z') / DAY);      // номер дня (для маски повернень)

    // ---------- денні лічильники ----------
    let DAYS = Object.create(null), dirty = false;
    function D(ms) {
        const k = dayId(ms || Date.now());
        let d = DAYS[k];
        if (!d) {
            d = DAYS[k] = { reg: 0, act: [], peak: 0, sess: 0, sessMs: 0, quits: 0, modes: {}, fo: { spins: 0, cr: 0, tk: 0, duels: 0, stake: 0 } };
            const ks = Object.keys(DAYS).sort(); while (ks.length > KEEP_DAYS) delete DAYS[ks.shift()];
        }
        if (!d._act) Object.defineProperty(d, '_act', { value: new Set(d.act), enumerable: false, writable: true });
        dirty = true; return d;
    }
    const M = (d, mode) => d.modes[mode] || (d.modes[mode] = { games: 0, players: 0, ms: 0, quits: 0 });

    // ---------- події ----------
    const seenAt = new Map();      // логін → час входу (тривалість сесії)
    function markSeen(name) {
        const u = dbUsers[name]; if (!u) return;
        const now = Date.now(), d = D(now);
        if (!d._act.has(name)) { d._act.add(name); d.act.push(name); }
        // маска повернень: біт i — гравець заходив на i-й день після реєстрації (0…30)
        if (!u.an || typeof u.an !== 'object') { const fs = u.pstats && u.pstats.firstSeen > 0 ? u.pstats.firstSeen : now; u.an = { d0: dayNum(fs), m: 0 }; }
        const off = dayNum(now) - (u.an.d0 | 0);
        if (off >= 0 && off <= 30 && !(u.an.m & (1 << off))) { u.an.m |= (1 << off); saveUser(name); }
    }
    Events.on('register', e => { try { D().reg++; const u = dbUsers[e.name]; if (u) u.an = { d0: dayNum(Date.now()), m: 0 }; } catch (er) {} });
    Events.on('login', e => {
        try {
            if (!e || !dbUsers[e.name]) return;
            if (!seenAt.has(e.name)) seenAt.set(e.name, Date.now());
            markSeen(e.name);
            const on = new Set(Object.values(ctx.globalPlayers)).size, d = D(); if (on > d.peak) d.peak = on;
        } catch (er) {}
    });
    Events.on('logout', e => {
        try {
            if (!e || !e.name || ctx.isOnline(e.name)) return;      // ще є інша вкладка
            const t0 = seenAt.get(e.name); seenAt.delete(e.name); if (!t0) return;
            const d = D(); d.sess++; d.sessMs += Math.min(12 * 3600e3, Date.now() - t0);
        } catch (er) {}
    });
    Events.on('matchEnd', e => {
        try {
            const humans = (e.players || []).filter(p => !p.isBot).length; if (!humans) return;
            const m = M(D(), e.duel ? 'duel' : e.ranked ? 'ranked' : e.mode); m.games++; m.players += humans; m.ms += Math.max(0, Math.min(3 * 3600e3, e.durationMs | 0));
        } catch (er) {}
    });
    Events.on('matchQuit', e => { try { const d = D(); d.quits++; M(d, e.duel ? 'duel' : e.ranked ? 'ranked' : e.mode).quits++; } catch (er) {} });
    Events.on('wheelSpin', e => { try { const d = D(); d.fo.spins++; d.fo.cr += Math.max(0, e.v | 0); } catch (er) {} });
    Events.on('wheelTicket', e => { try { D().fo.tk += Math.max(0, e.n | 0); } catch (er) {} });
    Events.on('duelEnd', e => { try { const d = D(); d.fo.duels++; d.fo.stake += Math.max(0, e.stake | 0) * 2; } catch (er) {} });

    // ---------- збереження (MongoDB meta/analytics) ----------
    let loaded = false;
    function load() {
        const db = ctx.getDb && ctx.getDb(); if (!db || loaded) return; loaded = true;
        db.collection('meta').findOne({ _id: 'analytics' }).then(doc => {
            const saved = doc && doc.days && typeof doc.days === 'object' ? doc.days : {};
            Object.keys(saved).forEach(k => {
                const s = saved[k], cur = DAYS[k];
                if (!cur) { DAYS[k] = s; return; }
                // за кілька секунд до завантаження вже щось набралось — додаємо
                cur.reg += s.reg | 0; cur.peak = Math.max(cur.peak, s.peak | 0); cur.sess += s.sess | 0; cur.sessMs += s.sessMs | 0; cur.quits += s.quits | 0;
                (s.act || []).forEach(n => { if (!cur._act.has(n)) { cur._act.add(n); cur.act.push(n); } });
                Object.keys(s.modes || {}).forEach(m => { const a = M(cur, m), b = s.modes[m]; a.games += b.games | 0; a.players += b.players | 0; a.ms += b.ms | 0; a.quits += b.quits | 0; });
                Object.keys(cur.fo).forEach(f => { cur.fo[f] += (s.fo && s.fo[f]) | 0; });
            });
            dirty = true;
        }).catch(err => { loaded = false; console.error('❌ analytics load', err.message); });
    }
    function save() {
        const db = ctx.getDb && ctx.getDb(); if (!db || !loaded || !dirty) return Promise.resolve();
        dirty = false;
        return db.collection('meta').replaceOne({ _id: 'analytics' }, { _id: 'analytics', days: DAYS }, { upsert: true }).catch(err => { dirty = true; console.error('❌ analytics save', err.message); });
    }
    const lt = setInterval(load, 4000); if (lt.unref) lt.unref();
    const st = setInterval(() => { if (loaded) clearInterval(lt); save(); }, 5 * 60e3); if (st.unref) st.unref();
    { const prev = ctx.hooks.beforeExit; ctx.hooks.beforeExit = async () => { try { await save(); } catch (e) {} if (prev) await prev(); }; }

    // ---------- звіт ----------
    function funnel(now) {
        const today = dayNum(now), F = { reg: 0, tut: 0, g1: 0, g3: 0, g10: 0, d1n: 0, d1: 0, d7n: 0, d7: 0, gamesHist: [0, 0, 0, 0, 0, 0] };
        for (const n in dbUsers) {
            const u = dbUsers[n]; if (!u) continue;
            const fs = u.pstats && u.pstats.firstSeen; if (!(fs > now - 30 * DAY)) continue;
            F.reg++;
            const g = (u.pstats && u.pstats.games) | 0;
            if (u.tut && (u.tut.s === 'done')) F.tut++;
            if (g >= 1) F.g1++; if (g >= 3) F.g3++; if (g >= 10) F.g10++;
            F.gamesHist[g === 0 ? 0 : g === 1 ? 1 : g === 2 ? 2 : g <= 5 ? 3 : g <= 10 ? 4 : 5]++;
            const an = u.an; if (!an) continue;
            const age = today - (an.d0 | 0);
            if (age >= 2) { F.d1n++; if (an.m & 2) F.d1++; }
            if (age >= 8) { F.d7n++; if (an.m & 128) F.d7++; }
        }
        return F;
    }
    function memory() {
        const m = process.memoryUsage(), h = v8.getHeapStatistics(), names = Object.keys(dbUsers), n = names.length;
        let bytes = 0, k = 0; const step = Math.max(1, Math.floor(n / 300));
        for (let i = 0; i < n; i += step) { try { bytes += JSON.stringify(dbUsers[names[i]]).length; k++; } catch (e) {} }
        const avg = k ? bytes / k : 0;
        return { users: n, avgKb: Math.round(avg / 102.4) / 10, estMb: Math.round(avg * n * 3 / 1048576), rss: Math.round(m.rss / 1048576), heap: Math.round(m.heapUsed / 1048576), limit: Math.round(h.heap_size_limit / 1048576) };
    }
    function report() {
        const now = Date.now(), keys = Object.keys(DAYS).sort().slice(-14);
        const days = keys.map(k => { const d = DAYS[k], games = Object.values(d.modes).reduce((a, m) => a + m.games, 0); return { day: k, dau: (d.act || []).length, reg: d.reg, peak: d.peak, games, quits: d.quits, sess: d.sess, avgSess: d.sess ? Math.round(d.sessMs / d.sess / 60000) : 0, fo: d.fo }; });
        // режими за останні 7 днів
        const modes = {};
        keys.slice(-7).forEach(k => { const ms = DAYS[k].modes; Object.keys(ms).forEach(m => { const a = modes[m] || (modes[m] = { games: 0, players: 0, ms: 0, quits: 0 }), b = ms[m]; a.games += b.games; a.players += b.players; a.ms += b.ms; a.quits += b.quits; }); });
        const modeList = Object.keys(modes).map(m => { const a = modes[m]; return { mode: m, name: (ctx.ModeInfo.MODES[m] && ctx.ModeInfo.MODES[m].n) || (m === 'ranked' ? 'Рейтинг' : m === 'duel' ? 'Дуелі' : m), games: a.games, players: a.players, avgMin: a.games ? Math.round(a.ms / a.games / 6000) / 10 : 0, quits: a.quits, quitPct: (a.players + a.quits) ? Math.round(a.quits / (a.players + a.quits) * 1000) / 10 : 0 }; }).sort((a, b) => b.games - a.games);
        return { now, online: new Set(Object.values(ctx.globalPlayers)).size, days, modes: modeList, funnel: funnel(now), mem: memory(), saved: loaded };
    }
    ctx.Analytics = { report, save, _days: () => DAYS };
};
