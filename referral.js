/* referral.js — «Запроси друга»: реферальне посилання (?ref=<публічний ID>) і нагороди обом сторонам.
 *
 * Новачок, що зареєструвався за посиланням: +100 кредитів одразу, кейс на 3-му рівні, автоматично стає другом того, хто запросив.
 * Той, хто запросив, — за кожного друга етапи (друг має сам дограти до рівня, тож «порожні» акаунти нічого не дають):
 *   3 рівень → 100 кредитів · 5 рівень → кейс (~175) · 10 рівень → 300 кредитів + кейс (~340)
 * Бонуси за кількість активних друзів (досягли 5 рівня): 3 → кейс «Чорний ринок» (~450) · 5 → 500 кредитів · 10 → кейс «Імператор» (~1400).
 * Захист: реєстрація з тієї ж мережі (хеш IP), що й у запрошувача, не приносить йому нагород; максимум 50 друзів з нагородами;
 * нагороди забираються вручну у вікні «Запроси друга» (сервер перевіряє рівень друга в момент отримання).
 *
 * Сокет: refInfo → refInfo {code, link?, list:[{nick,lvl,claimable:[L…],got:[L…],sus}], tiers, bonus, me:{by,lvl,case}}
 *        refClaim {k:'f', who:index, lv} | {k:'t', n} | {k:'me'} → refInfo + caseResult (якщо кейс) */
'use strict';
module.exports = function (ctx) {
    const { io, dbUsers, Events, GameData, saveUser } = ctx;
    const STEPS = [{ lv: 3, cr: 100 }, { lv: 5, caseP: 175 }, { lv: 10, cr: 300, caseP: 340 }];
    const TIERS = [{ n: 3, caseP: 450 }, { n: 5, cr: 500 }, { n: 10, caseP: 1400 }];
    const WELCOME = 100, NEWBIE_LV = 3, NEWBIE_CASEP = 100, MAX_REF = 50, ACTIVE_LV = 5;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const lvl = n => { try { return ctx.playerLevel(n); } catch (e) { return 1; } };
    const nick = n => (ctx.displayName && ctx.displayName(n)) || n;
    function caseNear(p) { let best = null, bd = 1e9; Object.keys(GameData.CASES).forEach(k => { const d = Math.abs(GameData.CASES[k].price - p); if (d < bd) { bd = d; best = +k; } }); return best; }
    const caseOf = o => o.legend ? GameData.legendCaseId() : o.caseP ? caseNear(o.caseP) : null;
    const caseName = id => id && GameData.CASES[id] ? GameData.CASES[id].name : '';
    function data(u) {
        if (!u.ref || typeof u.ref !== 'object') u.ref = { list: [], got: {}, tiers: [] };
        if (!Array.isArray(u.ref.list)) u.ref.list = []; if (!u.ref.got || typeof u.ref.got !== 'object') u.ref.got = {}; if (!Array.isArray(u.ref.tiers)) u.ref.tiers = [];
        return u.ref;
    }
    const pidOf = n => { try { return ctx.Social ? ctx.Social.ensurePid(n) : 0; } catch (e) { return 0; } };

    // запис IP-хешів акаунта (останні 5) — для перевірки «той самий пристрій/мережа»
    function noteIp(n, h) { const u = dbUsers[n]; if (!u || !h) return; if (!Array.isArray(u.ipH)) u.ipH = []; if (u.ipH[u.ipH.length - 1] === h) return; u.ipH = u.ipH.filter(x => x !== h).concat(h).slice(-5); }
    Events.on('login', e => { try { const s = io.sockets.sockets.get(e.socketId); if (s) noteIp(e.name, ctx.ipHashOf(s)); } catch (er) {} });

    // ---------- реєстрація за посиланням ----------
    Events.on('register', e => {
        try {
            const u = dbUsers[e.name]; if (!u) return; noteIp(e.name, e.ip);
            const code = e.ref && /^\d{7}$/.test(String(e.ref)) ? Number(e.ref) : null; if (!code || !ctx.Social) return;
            const by = ctx.Social.loginByPid(code); if (!by || by === e.name || !dbUsers[by]) return;
            const B = dbUsers[by], R = data(B);
            const sus = !!(e.ip && Array.isArray(B.ipH) && B.ipH.includes(e.ip));          // той самий пристрій / мережа
            u.refBy = by; u.refAt = Date.now(); u.refSus = sus; u.refCase = false;
            u.bucks += WELCOME; if (u.stats) u.stats.earned = (u.stats.earned | 0) + WELCOME;
            if (R.list.length < 200) R.list.push({ l: e.name, at: Date.now(), sus });
            // одразу друзі (без запиту)
            [[u, by], [B, e.name]].forEach(([x, o]) => { if (!Array.isArray(x.friends)) x.friends = []; if (!x.friends.includes(o) && x.friends.length < 50) x.friends.push(o); });
            saveUser(by);
            ctx.onlineSocketsOf(by).forEach(sid => io.to(sid).emit('refNotify', { kind: 'joined', nick: nick(e.name) }));
            setTimeout(() => { try { io.to(e.socketId).emit('refNotify', { kind: 'welcome', by: nick(by), cr: WELCOME }); ctx.sendEconomy(e.socketId, e.name); } catch (er) {} }, 1500);
        } catch (er) { console.error('❌ referral register', er && er.message); }
    });

    // ---------- стан для вікна ----------
    function counted(R) { return R.list.filter(x => !x.sus && dbUsers[x.l]).slice(0, MAX_REF); }
    function info(n) {
        const u = dbUsers[n], R = data(u), pid = pidOf(n), list = counted(R);
        const rows = R.list.filter(x => dbUsers[x.l]).slice(-60).reverse().map(x => {
            const L = lvl(x.l), idx = list.indexOf(x), got = (R.got[x.l] || []);
            return { nick: nick(x.l), lvl: L, sus: !!x.sus || idx < 0, at: x.at, i: R.list.indexOf(x), got, claimable: (x.sus || idx < 0) ? [] : STEPS.filter(s => L >= s.lv && !got.includes(s.lv)).map(s => s.lv) };
        });
        const active = list.filter(x => lvl(x.l) >= ACTIVE_LV).length;
        return {
            code: pid || null, steps: STEPS.map(s => ({ lv: s.lv, cr: s.cr || 0, caseName: caseName(caseOf(s)) })),
            tiers: TIERS.map(t => ({ n: t.n, cr: t.cr || 0, caseName: caseName(caseOf(t)), got: R.tiers.includes(t.n), ready: active >= t.n })),
            active, total: list.length, list: rows, welcome: WELCOME, newbieLv: NEWBIE_LV, newbieCase: caseName(caseNear(NEWBIE_CASEP)),
            me: u.refBy ? { by: nick(u.refBy), lvl: lvl(n), got: !!u.refCase, ready: !u.refCase && !u.refSus && lvl(n) >= NEWBIE_LV } : null
        };
    }

    // ---------- видача ----------
    function give(sock, n, cr, caseId) {
        const u = dbUsers[n];
        if (caseId && u.inventory.length >= 30) return 'Інвентар повний (макс 30)! Звільніть місце для кейса';
        const modId = caseId ? ctx.getRandomModuleFromCase(caseId) : null; if (caseId && !modId) return 'Не вдалося відкрити кейс, спробуйте ще раз';
        if (cr) { u.bucks += cr; if (u.stats) u.stats.earned = (u.stats.earned | 0) + cr; }
        if (modId) u.inventory.push(modId);
        saveUser(n); ctx.sendEconomy(sock.id, n);
        if (modId) { sock.emit('caseResult', { modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId, fromProgress: 'ref' }); Events.emit('caseOpened', { name: n, caseId, modId, price: 0, fromLevel: true }); }
        return null;
    }
    ctx.onConnection(socket => {
        let last = 0;
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        const gate = ms => { const t = Date.now(); if (t - last < ms) return false; last = t; return true; };
        socket.on('refInfo', () => { const n = me(); if (n && gate(300)) socket.emit('refInfo', info(n)); });
        socket.on('refClaim', d => {
            const n = me(); if (!n || !gate(500) || !d || typeof d !== 'object') return;
            const u = dbUsers[n], R = data(u), fail = msg => socket.emit('refError', { msg });
            let err = null, ok = '';
            if (d.k === 'f') {
                const x = R.list[d.i | 0], st = STEPS.find(s => s.lv === (d.lv | 0));
                if (!x || !st || !dbUsers[x.l] || counted(R).indexOf(x) < 0) return fail('Нагорода недоступна');
                const got = R.got[x.l] || (R.got[x.l] = []); if (got.includes(st.lv)) return fail('Нагороду вже отримано');
                if (lvl(x.l) < st.lv) return fail('Друг ще не досяг ' + st.lv + ' рівня');
                err = give(socket, n, st.cr || 0, caseOf(st)); if (!err) { got.push(st.lv); ok = 'Нагороду за друга отримано!'; }
            } else if (d.k === 't') {
                const t = TIERS.find(x => x.n === (d.n | 0)); if (!t || R.tiers.includes(t.n)) return fail('Нагороду вже отримано');
                if (counted(R).filter(x => lvl(x.l) >= ACTIVE_LV).length < t.n) return fail('Потрібно ' + t.n + ' друзів, які досягли ' + ACTIVE_LV + ' рівня');
                err = give(socket, n, t.cr || 0, caseOf(t)); if (!err) { R.tiers.push(t.n); ok = 'Бонус за друзів отримано!'; }
            } else if (d.k === 'me') {
                if (!u.refBy || u.refCase || u.refSus) return fail('Нагорода недоступна');
                if (lvl(n) < NEWBIE_LV) return fail('Досягніть ' + NEWBIE_LV + ' рівня');
                err = give(socket, n, 0, caseNear(NEWBIE_CASEP)); if (!err) { u.refCase = true; ok = 'Подарунок від друга отримано!'; }
            }
            if (err) return fail(err);
            saveUser(n); socket.emit('refInfo', info(n)); if (ok) socket.emit('refNotify', { kind: 'claimed', msg: ok });
        });
    });
    // нагадування: друг досяг етапу (рівень змінився після бою)
    Events.on('matchEnd', ev => {
        try {
            (ev.players || []).forEach(p => {
                const u = !p.isBot && dbUsers[p.name]; if (!u || !u.refBy || u.refSus || !p.xp || p.xp.lvlAfter <= p.xp.lvlBefore) return;
                const L = p.xp.lvlAfter;
                if (STEPS.some(s => s.lv === L)) ctx.onlineSocketsOf(u.refBy).forEach(sid => io.to(sid).emit('refNotify', { kind: 'step', nick: nick(p.name), lv: L }));
                if (L === NEWBIE_LV && !u.refCase) ctx.onlineSocketsOf(p.name).forEach(sid => io.to(sid).emit('refNotify', { kind: 'gift' }));
            });
        } catch (e) {}
    });
    ctx.Referral = { info };
};
