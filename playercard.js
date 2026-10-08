/* playercard.js — картка гравця (лобі/гра/чат/друзі): ім'я, рівень, екіпіровка, статистика, стосунки.
 *
 * Сокет (клієнт → сервер):
 *   getPlayerCard { roomId?, playerId?, h? } → 'playerCard' { key, error? | card }
 *     • { roomId, playerId } — гравець (або бот) у тій самій кімнаті, де і той, хто питає;
 *     • { h } — непрозорий ідентифікатор з ctx.Handles (чат, друзі, рейтинг); для бота h діє лише в його кімнаті.
 *   card = { h, nick, clan, level, rank, xpPct, xpMax, equipped:{cannon,turret,hull,tracks}, mods:{слот:{…модуль}|null},
 *            stats:{games,wins,losses,winRate|null,kills,deaths,kd,favMode|null,hasP}, self, online, bot, isFriend, reqOut, reqIn }
 *   У відповіді НЕМАЄ логіна й публічного ID.
 * Перевірка частоти: ≥250 мс між запитами, ≤30 запитів / 30 с на сокет.
 * Events: нічого не слухає й не емітить. ctx.PlayerCard = { build }. */
module.exports = function (ctx) {
    const { dbUsers, rooms, GameData, MODULES } = ctx;
    const SLOTS = ['cannon', 'turret', 'hull', 'tracks'];
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
    const now = () => Date.now();
    const arr = (u, k) => (u && Array.isArray(u[k]) ? u[k] : []);
    function hashFrac(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }

    function equipOut(eq) {
        const equipped = {}, mods = {};
        SLOTS.forEach(sl => {
            const id = eq && typeof eq[sl] === 'string' && has(MODULES, eq[sl]) ? eq[sl] : null;
            equipped[sl] = id; mods[sl] = id ? Object.assign({ id }, MODULES[id]) : null;
        });
        return { equipped, mods };
    }
    function ratio(games, wins, kills, deaths) {
        return { winRate: games > 0 ? Math.round(100 * wins / games) : null, kd: deaths > 0 ? Math.round(100 * kills / deaths) / 100 : kills };
    }
    function levelBlock(level, xp) {
        const lv = Math.max(1, Math.min(GameData.MAX_LEVEL, level | 0 || 1));
        if (typeof xp === 'number') { const pr = GameData.levelProgress(xp); return { level: pr.level, xpPct: Math.round(pr.pct), xpMax: !!pr.max }; }
        return { level: lv, xpPct: 0, xpMax: lv >= GameData.MAX_LEVEL };
    }
    function rankOf(l) { return GameData.LEVEL_NAMES[l - 1] || ''; }

    function humanCard(login, me, roomEq) {
        const u = dbUsers[login]; if (!u) return null;
        const pf = ctx.Profile && ctx.Profile.buildProfile ? ctx.Profile.buildProfile(login, me) : null;
        const ps = (u.pstats && typeof u.pstats === 'object') ? u.pstats : null, st = u.stats || {};
        const s = pf ? pf.stats : { games: num(st.matches), wins: 0, losses: 0, kills: num(st.kills), deaths: 0, favMode: null, hasP: false };
        const lb = levelBlock(0, num(u.xp)), eq = equipOut(roomEq || u.equipped);
        const mu = me && dbUsers[me];
        const games = s.games, rt = ratio(games, s.wins, s.kills, s.deaths);
        let clan = ''; try { clan = ctx.hooks.clanTag(login) || ''; } catch (e) {}
        return {
            h: ctx.Handles.of(login), nick: u.nick || login, clan, level: lb.level, rank: rankOf(lb.level), xpPct: lb.xpPct, xpMax: lb.xpMax,
            equipped: eq.equipped, mods: eq.mods,
            stats: { games, wins: s.wins, losses: s.losses, winRate: s.hasP || s.wins ? rt.winRate : null, kills: s.kills, deaths: s.deaths, kd: s.hasP ? rt.kd : (s.kills ? s.kills : null), favMode: s.favMode || null, hasP: !!s.hasP },
            self: login === me, online: ctx.isOnline(login), bot: false,
            isFriend: !!mu && arr(mu, 'friends').includes(login), reqOut: !!mu && arr(mu, 'friendReqOut').includes(login), reqIn: !!mu && arr(mu, 'friendReqIn').includes(login)
        };
    }
    function botCard(room, p) {
        const L = Math.max(1, Math.min(GameData.MAX_LEVEL, p.level | 0 || 1));
        const s = p.stats || {}, games = num(s.games), wins = num(s.wins), kills = num(s.kills), deaths = num(s.deaths), rt = ratio(games, wins, kills, deaths);
        const eq = equipOut(p.equipped);
        let xpPct = 0, xpMax = L >= GameData.MAX_LEVEL;
        if (!xpMax) xpPct = Math.round(8 + 84 * hashFrac('x' + p.id + L));
        return {
            h: ctx.Handles.ofPlayer(room, p.id), nick: String(p.nick || p.name || '').slice(0, 24), clan: typeof p.clan === 'string' ? p.clan : '', level: L, rank: rankOf(L), xpPct, xpMax,
            equipped: eq.equipped, mods: eq.mods,
            stats: { games, wins, losses: Math.max(0, games - wins), winRate: rt.winRate, kills, deaths, kd: rt.kd, favMode: null, hasP: true },
            self: false, online: true, bot: true, isFriend: false, reqOut: false, reqIn: false
        };
    }
    function roomOf(sid) { for (const rid in rooms) if (rooms[rid].players && rooms[rid].players[sid]) return rooms[rid]; return null; }

    ctx.onConnection(socket => {
        let last = 0, win = [];
        socket.on('getPlayerCard', d => {
            const me = ctx.globalPlayers[socket.id]; if (!me || !dbUsers[me]) return;
            const t = now();
            if (t - last < 250) return; last = t;
            win = win.filter(x => t - x < 30000); if (win.length >= 30) return; win.push(t);
            if (!d || typeof d !== 'object') return;
            const key = {};
            const reply = (card, error) => socket.emit('playerCard', error ? { key, error } : { key, card });
            try {
                const myRoom = roomOf(socket.id);
                if (typeof d.roomId === 'string' && typeof d.playerId === 'string' && d.roomId.length <= 64 && d.playerId.length <= 64) {
                    key.roomId = d.roomId; key.playerId = d.playerId;
                    const r = has(rooms, d.roomId) ? rooms[d.roomId] : null;
                    if (!r || !myRoom || myRoom.id !== r.id) return reply(null, 'Гравця не знайдено');
                    const p = has(r.players, d.playerId) ? r.players[d.playerId] : null; if (!p) return reply(null, 'Гравця не знайдено');
                    if (p.isBot) return reply(botCard(r, p));
                    const c = humanCard(p.name, me, p.equipped); if (!c) return reply(null, 'Гравця не знайдено');
                    return reply(c);
                }
                if (typeof d.h === 'string' && d.h.length <= 32) {
                    key.h = d.h;
                    const b = ctx.Handles.botOf && ctx.Handles.botOf(d.h);
                    if (b) {
                        const r = myRoom && myRoom.id === b.roomId ? myRoom : null, p = r && has(r.players, b.playerId) ? r.players[b.playerId] : null;
                        return p && p.isBot ? reply(botCard(r, p)) : reply(null, 'Гравця не знайдено');
                    }
                    const login = ctx.Handles.loginOf(d.h); if (!login) return reply(null, 'Гравця не знайдено');
                    const c = humanCard(login, me, null); return c ? reply(c) : reply(null, 'Гравця не знайдено');
                }
                if (d.self === true) { const c = humanCard(me, me, null); return c ? reply(c) : undefined; }
            } catch (e) { console.error('playercard', e && e.stack); }
        });
    });
    ctx.PlayerCard = { humanCard, botCard };
};
