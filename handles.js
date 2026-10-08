/* handles.js — «непрозорі» ідентифікатори гравців для клієнта (щоб не показувати логін і публічний ID там, де вони не потрібні:
 * чат, картка гравця). h = перші 12 символів HMAC(логін) з випадковим секретом процесу; живе до перезапуску сервера.
 * ctx.Handles = { of(login) → h, loginOf(h) → login|null, ofPlayer(room, playerId) → h|null (боти теж отримують h; loginOf для бота повертає null) } */
const crypto = require('crypto');
module.exports = function (ctx) {
    const secret = crypto.randomBytes(24), byH = new Map();
    const of = login => { if (typeof login !== 'string' || !login) return null; const h = crypto.createHmac('sha256', secret).update(login).digest('base64url').slice(0, 12); byH.set(h, login); return h; };
    const loginOf = h => (typeof h === 'string' && byH.has(h)) ? byH.get(h) : null;
    const botBy = new Map();   // h → { roomId, playerId } для ботів (у них немає логіна)
    const ofPlayer = (room, playerId) => {
        const p = room && room.players && room.players[playerId]; if (!p) return null;
        if (p.isBot) { const h = crypto.createHmac('sha256', secret).update('bot:' + playerId).digest('base64url').slice(0, 12); botBy.set(h, { roomId: room.id, playerId }); return h; }
        return of(p.name);
    };
    ctx.Handles = { of, loginOf, ofPlayer, botOf: h => botBy.get(h) || null };
};
