/* tutorial.js — навчання новачка (сервер). Лише для нових акаунтів (створених після появи навчання).
 * Етапи u.tut.s: 'tour' (огляд меню) → 'promo' (ввести START) → 'case' (відкрити найдешевший кейс) → 'equip' (вдягнути модуль)
 *               → 'play' (швидка гра: зіграти один бій) → 'done'. Можна пропустити ('skip').
 * Етапи з діями просуває лише сервер — за справжніми подіями (промокод, кейс, екіпірування, кінець бою), тож клієнт не може «перестрибнути».
 * Сокет: tutGet → tutState {s} · tutNext (лише з 'tour') · tutSkip.  Сервер шле tutState після кожної зміни. */
'use strict';
module.exports = function (ctx) {
    const { io, dbUsers, Events, saveUser } = ctx;
    const ORDER = ['tour', 'promo', 'case', 'equip', 'play', 'done'];
    const st = n => { const u = dbUsers[n]; return u && u.tut && typeof u.tut === 'object' ? u.tut.s : null; };
    function set(n, s) {
        const u = dbUsers[n]; if (!u || !u.tut) return; u.tut.s = s; u.tut.at = Date.now(); saveUser(n);
        ctx.onlineSocketsOf(n).forEach(sid => io.to(sid).emit('tutState', { s }));
    }
    const advance = (n, from) => { if (st(n) === from) set(n, ORDER[ORDER.indexOf(from) + 1]); };

    Events.on('register', e => { const u = dbUsers[e.name]; if (u) u.tut = { s: 'tour', at: Date.now() }; });
    Events.on('login', e => { const s = st(e.name); if (s && s !== 'done' && s !== 'skip') setTimeout(() => io.to(e.socketId).emit('tutState', { s }), 900); });
    Events.on('promoRedeemed', e => { if (e.code === 'START') advance(e.name, 'promo'); });
    Events.on('caseOpened', e => { if (!e.fromLevel) advance(e.name, 'case'); });
    Events.on('moduleEquipped', e => advance(e.name, 'equip'));
    Events.on('matchEnd', ev => { (ev.players || []).forEach(p => { if (!p.isBot && dbUsers[p.name]) advance(p.name, 'play'); }); });

    ctx.onConnection(socket => {
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        socket.on('tutGet', () => { const n = me(); if (n) socket.emit('tutState', { s: st(n) }); });
        socket.on('tutNext', () => { const n = me(); if (n) advance(n, 'tour'); });
        socket.on('tutSkip', () => { const n = me(); if (n && st(n) && st(n) !== 'done') set(n, 'skip'); });
        // промокод START уже використано раніше (наприклад, до навчання) — не застрягаємо
        socket.on('tutPromoUsed', () => { const n = me(); if (n && st(n) === 'promo' && Array.isArray(dbUsers[n].usedPromos) && dbUsers[n].usedPromos.some(x => String(x).toUpperCase() === 'START')) advance(n, 'promo'); });
    });
    ctx.Tutorial = { state: st, set };
};
