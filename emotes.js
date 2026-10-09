/* emotes.js — емоції в бою (GG, 😂, Дякую!, Допоможіть!, 👍, 😡). Сервер лише пересилає НОМЕР емоції всім у кімнаті:
 * пакет 'emo' = [socketId, номер] (~30 байтів), текст малює й перекладає клієнт. Обмеження: 1 емоція / 1.8 с, не більше 5 за 15 с.
 * Замаскований гравець у «Хованках» емоції не надсилає (інакше видасть себе). Боти зрідка реагують після вбивства/загибелі.
 * Сокет: emote (номер 0..5) → кімнаті 'emo' [id, номер]. */
'use strict';
module.exports = function (ctx) {
    const { io, rooms, Events } = ctx;
    const N = 6;
    function roomOf(id) { for (const rid in rooms) if (rooms[rid].players[id]) return rooms[rid]; return null; }
    ctx.onConnection(socket => {
        let last = 0, burst = [];
        socket.on('emote', d => {
            const e = Number(d); if (!Number.isInteger(e) || e < 0 || e >= N) return;
            const now = Date.now(); if (now - last < 1800) return;
            burst = burst.filter(t => now - t < 15000); if (burst.length >= 5) return;
            const r = roomOf(socket.id); if (!r || r.status !== 'playing') return;
            const p = r.players[socket.id]; if (!p || p.isDisguised) return;
            last = now; burst.push(now);
            io.to(r.id).emit('emo', [socket.id, e]);
        });
    });
    // «живі» боти: зрідка GG/😂/👍 після вбивства, 😡 після загибелі
    Events.on('kill', ev => {
        try {
            const r = rooms[ev.roomId]; if (!r || r.status !== 'playing') return;
            const pick = (name, set, ch, delay) => {
                if (Math.random() > ch) return; const p = Object.values(r.players).find(q => q.isBot && q.name === name); if (!p) return;
                setTimeout(() => { if (rooms[r.id] === r && r.status === 'playing' && r.players[p.id] && p.hp > 0) io.to(r.id).emit('emo', [p.id, set[Math.floor(Math.random() * set.length)]]); }, delay + Math.random() * 1400);
            };
            if (ev.killerBot) pick(ev.killerName, [0, 1, 4], 0.14, 600);
            if (ev.victimBot) pick(ev.victimName, [5, 0], 0.07, 3600);     // уже після відродження
        } catch (e) {}
    });
};
