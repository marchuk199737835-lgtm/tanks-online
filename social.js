/* social.js — публічний ігровий ID (u.pid), друзі, запрошення в бій.
 *  Клієнт → сервер:  socialSync | socialAdd {pid|login} | socialAccept {login} | socialDecline {login} | socialCancel {login}
 *                    socialRemove {login} | socialDnd bool | socialInvite {login} | socialInviteAccept {id} | socialInviteDecline {id}
 *                    socialJoinFriend {login}
 *  Сервер → клієнт:  socialState {pid,dnd,friends[],reqIn[],reqOut[],max} | socialResult {ok,msg,kind} | socialNotify {type,...}
 *                    socialInvite {id,from,roomId,mode,map,ttl} | socialInviteGone {id} | socialJoin {roomId}
 *  Експорт: ctx.Social = { ensurePid, pidOf, loginByPid, friendsOf, areFriends } */
module.exports = function (ctx) {
    const { io, rooms, dbUsers, globalPlayers, Events } = ctx;
    const MAX_FRIENDS = 50, MAX_REQ = 50, INVITE_TTL = 60000, INVITE_GAP = 10000, PUSH_GAP = 2000;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const user = n => (typeof n === 'string' && own(dbUsers, n)) ? dbUsers[n] : null;
    const arr = (u, k) => { if (!Array.isArray(u[k])) u[k] = []; return u[k]; };
    const nick = n => (ctx.displayName ? ctx.displayName(n) : n) || n;
    const clanOf = n => { try { return (ctx.hooks && ctx.hooks.clanTag && ctx.hooks.clanTag(n)) || (user(n) && user(n).clanTag) || ''; } catch (e) { return ''; } };
    const lvOf = n => { try { return ctx.playerLevel(n) || 1; } catch (e) { return 1; } };
    const save = n => { try { ctx.saveUser(n); } catch (e) {} };

    // ---------- публічний ID ----------
    const byPid = new Map();       // pid -> login
    let indexed = false;
    function reindex() {
        byPid.clear();
        for (const n of Object.keys(dbUsers)) { const p = dbUsers[n] && dbUsers[n].pid; if (Number.isInteger(p) && !byPid.has(p)) byPid.set(p, n); }
        indexed = true;
    }
    function ensurePid(name) {
        const u = user(name); if (!u) return 0;
        if (!indexed) reindex();
        if (Number.isInteger(u.pid) && u.pid >= 1000000 && u.pid <= 9999999) {
            if (!byPid.has(u.pid)) byPid.set(u.pid, name);
            if (byPid.get(u.pid) === name) return u.pid;
        }
        let pid, tries = 0;
        do { pid = 1000000 + Math.floor(Math.random() * 9000000); tries++; } while (byPid.has(pid) && tries < 200);
        if (byPid.has(pid)) return 0;
        u.pid = pid; byPid.set(pid, name); save(name);
        return pid;
    }
    const pidOf = name => ensurePid(name);
    function loginByPid(pid) {
        pid = Number(pid); if (!Number.isInteger(pid)) return null;
        if (!indexed) reindex();
        let n = byPid.get(pid);
        if (!n || !user(n) || dbUsers[n].pid !== pid) { reindex(); n = byPid.get(pid); }
        return n && user(n) && dbUsers[n].pid === pid ? n : null;
    }

    // ---------- друзі: базові дані ----------
    const friendsOf = name => { const u = user(name); return u && Array.isArray(u.friends) ? u.friends.slice() : []; };
    const areFriends = (a, b) => { const u = user(a); return !!(u && Array.isArray(u.friends) && u.friends.includes(b)); };
    const isBotName = n => !user(n);

    // де гравець зараз
    function locate(name) {
        for (const rid in rooms) {
            const r = rooms[rid];
            for (const sid in r.players) if (r.players[sid].name === name) return { r, rid, sid };
        }
        return null;
    }
    function statusOf(name) {
        if (!ctx.isOnline(name)) return null;
        const f = locate(name);
        if (!f) return { t: 'menu' };
        const r = f.r, cnt = Object.keys(r.players).length;
        if (r.status === 'lobby') return { t: 'lobby', roomId: f.rid, mode: r.mode, map: r.map, n: cnt, max: r.maxPlayers, free: cnt < r.maxPlayers };
        return { t: 'battle', mode: r.mode, map: r.map };
    }
    function entry(n) {
        const u = user(n); if (!u) return null;
        const st = statusOf(n);
        return { login: n, nick: nick(n), clan: clanOf(n), level: lvOf(n), pid: u.pid || 0, online: !!st, status: st, last: u.lastSeen || 0 };
    }

    function stateFor(name) {
        const u = user(name); if (!u) return null;
        const clean = k => { const a = arr(u, k).filter(x => user(x) && x !== name); if (a.length !== u[k].length) u[k] = a; return a; };
        const fr = clean('friends'), ri = clean('friendReqIn'), ro = clean('friendReqOut');
        const fe = fr.map(entry).filter(Boolean);
        fe.sort((a, b) => (b.online - a.online) || a.nick.localeCompare(b.nick));
        return { pid: ensurePid(name), dnd: !!u.dnd, max: MAX_FRIENDS, friends: fe, reqIn: ri.map(entry).filter(Boolean), reqOut: ro.map(entry).filter(Boolean) };
    }

    // ---------- розсилка з тротлінгом (≤1 повного оновлення на 2 с на гравця) ----------
    const lastPush = new Map(), dirty = new Set();
    function pushNow(name) {
        dirty.delete(name); lastPush.set(name, Date.now());
        const ids = ctx.onlineSocketsOf(name); if (!ids.length) return;
        const st = stateFor(name); if (!st) return;
        ids.forEach(id => io.to(id).emit('socialState', st));
    }
    function markDirty(name) {
        if (!user(name) || !ctx.isOnline(name)) return;
        if (Date.now() - (lastPush.get(name) || 0) >= PUSH_GAP) pushNow(name); else dirty.add(name);
    }
    const emitTo = (name, ev, d) => ctx.onlineSocketsOf(name).forEach(id => io.to(id).emit(ev, d));

    // ---------- обмеження частоти ----------
    const rl = new Map();
    function limited(sid, max, win, key) {
        const now = Date.now(), k = sid + '|' + (key || ''); let a = rl.get(k) || [];
        a = a.filter(t => now - t < win); if (a.length >= max) { rl.set(k, a); return true; }
        a.push(now); rl.set(k, a); return false;
    }

    // ---------- дії ----------
    function sendRes(socket, ok, msg, kind) { socket.emit('socialResult', { ok: !!ok, msg: msg || '', kind: kind || '' }); }
    function makeFriends(a, b) {
        const ua = user(a), ub = user(b);
        [[ua, b], [ub, a]].forEach(([u, o]) => {
            ['friendReqIn', 'friendReqOut'].forEach(k => { u[k] = arr(u, k).filter(x => x !== o); });
            if (!arr(u, 'friends').includes(o)) u.friends.push(o);
        });
        save(a); save(b);
    }
    function dropFriend(a, b) {
        [[user(a), b], [user(b), a]].forEach(([u, o]) => {
            if (!u) return;
            ['friends', 'friendReqIn', 'friendReqOut'].forEach(k => { u[k] = arr(u, k).filter(x => x !== o); });
        });
        save(a); save(b);
    }
    const brief = n => ({ login: n, nick: nick(n), clan: clanOf(n), level: lvOf(n) });

    function addFriend(me, target, socket) {
        const u = user(me), t = user(target);
        if (!t) return sendRes(socket, false, 'Гравця з таким ID не знайдено', 'add');
        if (target === me) return sendRes(socket, false, 'Це ваш власний ID', 'add');
        if (arr(u, 'friends').includes(target)) return sendRes(socket, false, 'Ви вже друзі', 'add');
        if (arr(u, 'friendReqOut').includes(target)) return sendRes(socket, false, 'Запит уже надіслано', 'add');
        if (u.friends.length >= MAX_FRIENDS) return sendRes(socket, false, 'Ліміт друзів: ' + MAX_FRIENDS, 'add');
        if (arr(u, 'friendReqIn').includes(target)) {          // взаємний запит → одразу дружба
            if (arr(t, 'friends').length >= MAX_FRIENDS) return sendRes(socket, false, 'У цього гравця вже ' + MAX_FRIENDS + ' друзів', 'add');
            makeFriends(me, target);
            emitTo(target, 'socialNotify', { type: 'accepted', from: brief(me) });
            markDirty(me); markDirty(target);
            return sendRes(socket, true, 'Ви тепер друзі з ' + nick(target), 'add');
        }
        if (arr(t, 'friendReqIn').length >= MAX_REQ) return sendRes(socket, false, 'У гравця забагато вхідних запитів', 'add');
        if (arr(u, 'friendReqOut').length >= MAX_REQ) return sendRes(socket, false, 'Забагато вихідних запитів — скасуйте зайві', 'add');
        u.friendReqOut.push(target); arr(t, 'friendReqIn').push(me);
        save(me); save(target);
        emitTo(target, 'socialNotify', { type: 'request', from: brief(me) });
        markDirty(me); markDirty(target);
        sendRes(socket, true, 'Запит надіслано: ' + nick(target), 'add');
    }

    // ---------- запрошення в бій ----------
    const invites = new Map();   // id -> {id, from, to, roomId, exp}
    const lastInv = new Map();   // from|to -> ts
    let invSeq = 0;
    function roomOk(inv) {
        const r = rooms[inv.roomId]; if (!r || r.status !== 'lobby') return null;
        if (Object.keys(r.players).length >= r.maxPlayers) return null;
        if (!Object.values(r.players).some(p => p.name === inv.from)) return null;
        return r;
    }
    function dropInvite(inv, notify) {
        invites.delete(inv.id);
        if (notify) emitTo(inv.to, 'socialInviteGone', { id: inv.id });
    }
    function sendInvite(me, target, socket) {
        const u = user(me), t = user(target);
        if (!t || target === me) return sendRes(socket, false, 'Гравця не знайдено', 'inv');
        if (!areFriends(me, target)) return sendRes(socket, false, 'Запрошувати можна лише друзів', 'inv');
        const mine = locate(me);
        if (!mine || mine.r.status !== 'lobby') return sendRes(socket, false, 'Спершу зайдіть у лобі сесії', 'inv');
        const r = mine.r;
        if (Object.keys(r.players).length >= r.maxPlayers) return sendRes(socket, false, 'У кімнаті немає вільних місць', 'inv');
        if (!ctx.isOnline(target)) return sendRes(socket, false, 'Друг не в мережі', 'inv');
        const theirs = locate(target);
        if (theirs && theirs.rid === mine.rid) return sendRes(socket, false, 'Друг уже у вашій кімнаті', 'inv');
        if (theirs && theirs.r.status !== 'lobby') return sendRes(socket, false, 'Друг зараз у бою', 'inv');
        if (ctx.BANS && ctx.BANS.has(mine.rid) && ctx.BANS.get(mine.rid).has(target)) return sendRes(socket, false, 'Цей гравець заблокований у вашій сесії', 'inv');
        const key = me + '|' + target, now = Date.now();
        if (now - (lastInv.get(key) || 0) < INVITE_GAP) return sendRes(socket, false, 'Зачекайте кілька секунд перед повторним запрошенням', 'inv');
        if (t.dnd) return sendRes(socket, false, 'Гравець не приймає запрошень', 'inv');
        lastInv.set(key, now);
        for (const inv of [...invites.values()]) if (inv.from === me && inv.to === target) dropInvite(inv, true);
        const pend = [...invites.values()].filter(i => i.to === target);
        if (pend.length >= 5) dropInvite(pend[0], true);
        const inv = { id: 'i' + (++invSeq) + '_' + Math.random().toString(36).slice(2, 7), from: me, to: target, roomId: mine.rid, exp: now + INVITE_TTL };
        invites.set(inv.id, inv);
        emitTo(target, 'socialInvite', { id: inv.id, from: brief(me), roomId: inv.roomId, mode: r.mode, map: r.map, n: Object.keys(r.players).length, max: r.maxPlayers, ttl: INVITE_TTL });
        sendRes(socket, true, 'Запрошення надіслано: ' + nick(target), 'inv');
    }
    // спільна частина «прийняти запрошення / приєднатись до друга»: звільняє поточне лобі і дозволяє клієнту виконати joinRoom
    function goJoin(me, socket, roomId) {
        const r = rooms[roomId];
        if (!r) return sendRes(socket, false, 'Кімнати вже не існує', 'join');
        if (r.status !== 'lobby') return sendRes(socket, false, 'Гра вже почалася', 'join');
        if (Object.keys(r.players).length >= r.maxPlayers && !r.players[socket.id]) return sendRes(socket, false, 'Кімната вже заповнена', 'join');
        if (ctx.BANS && ctx.BANS.has(roomId) && ctx.BANS.get(roomId).has(me)) return sendRes(socket, false, 'Лідер заблокував вас у цій сесії', 'join');
        const cur = locate(me);
        if (cur && cur.rid === roomId) return socket.emit('socialJoin', { roomId });
        if (cur) {
            if (cur.r.status !== 'lobby') return sendRes(socket, false, 'Ви зараз у бою — спершу завершіть його', 'join');
            for (const sid in cur.r.players) if (cur.r.players[sid].name === me) {
                const s = io.sockets && io.sockets.sockets && io.sockets.sockets.get ? io.sockets.sockets.get(sid) : null;
                if (s && s.leave) s.leave(cur.rid);
                ctx.removePlayer(cur.rid, sid);
            }
            ctx.pushRooms();
        }
        socket.emit('socialJoin', { roomId });
    }

    // ---------- підключення ----------
    const notified = new Map();
    function onAuth(socket) {
        const n = globalPlayers[socket.id]; if (!user(n)) return;
        ensurePid(n);
        pushNow(n);
        const u = dbUsers[n], pend = arr(u, 'friendReqIn').length;
        if (pend > (notified.get(n) || 0)) socket.emit('socialNotify', { type: 'pending', n: pend });
        notified.set(n, pend);
    }
    Events.on('login', d => { try { if (d && d.name) setImmediate(() => { try { ensurePid(d.name); } catch (e) {} }); } catch (e) {} });

    ctx.onConnection(socket => {
        ['login', 'register', 'authToken'].forEach(ev => socket.on(ev, () => setImmediate(() => { try { onAuth(socket); } catch (e) { console.error('social auth', e && e.message); } })));
        const me = () => { const n = globalPlayers[socket.id]; return user(n) ? n : null; };
        const str = v => (typeof v === 'string' && v.length <= 40) ? v : null;
        const guard = (fn, max, win, key) => (d) => {
            const n = me(); if (!n) return;
            if (limited(socket.id, max || 20, win || 10000, key)) return sendRes(socket, false, 'Забагато запитів, спробуйте за мить', 'rl');
            try { fn(n, d); } catch (e) { console.error('social', e && e.stack); }
        };
        socket.on('socialSync', guard(n => { onAuth(socket); }, 8, 10000, 'sync'));
        socket.on('socialAdd', guard((n, d) => {
            if (!d || typeof d !== 'object') return;
            if (limited(socket.id, 5, 10000, 'add')) return sendRes(socket, false, 'Забагато запитів, спробуйте за мить', 'add');
            let target = null;
            if (d.pid !== undefined) {
                const s = String(d.pid).replace(/\s+/g, '');
                if (!/^[1-9]\d{6}$/.test(s)) return sendRes(socket, false, 'ID — це 7 цифр', 'add');
                target = loginByPid(Number(s));
            } else if (str(d.login)) target = user(d.login) ? d.login : null;
            addFriend(n, target || '', socket);
        }, 30, 10000, 'g'));
        socket.on('socialAccept', guard((n, d) => {
            const o = d && str(d.login), u = dbUsers[n];
            if (!o || !user(o) || !arr(u, 'friendReqIn').includes(o)) return sendRes(socket, false, 'Запит більше не актуальний', 'req');
            if (arr(u, 'friends').length >= MAX_FRIENDS) return sendRes(socket, false, 'Ліміт друзів: ' + MAX_FRIENDS, 'req');
            if (arr(dbUsers[o], 'friends').length >= MAX_FRIENDS) return sendRes(socket, false, 'У цього гравця вже ' + MAX_FRIENDS + ' друзів', 'req');
            makeFriends(n, o);
            emitTo(o, 'socialNotify', { type: 'accepted', from: brief(n) });
            markDirty(n); markDirty(o);
            sendRes(socket, true, 'Ви тепер друзі з ' + nick(o), 'req');
        }));
        const dropReq = (kind) => guard((n, d) => {
            const o = d && str(d.login); if (!o || !user(o)) return;
            const u = dbUsers[n], t = dbUsers[o];
            if (kind === 'decline') { u.friendReqIn = arr(u, 'friendReqIn').filter(x => x !== o); t.friendReqOut = arr(t, 'friendReqOut').filter(x => x !== n); }
            else { u.friendReqOut = arr(u, 'friendReqOut').filter(x => x !== o); t.friendReqIn = arr(t, 'friendReqIn').filter(x => x !== n); }
            save(n); save(o); markDirty(n); markDirty(o);
        });
        socket.on('socialDecline', dropReq('decline'));
        socket.on('socialCancel', dropReq('cancel'));
        socket.on('socialRemove', guard((n, d) => {
            const o = d && str(d.login); if (!o || !areFriends(n, o)) return;
            dropFriend(n, o);
            for (const inv of [...invites.values()]) if ((inv.from === n && inv.to === o) || (inv.from === o && inv.to === n)) dropInvite(inv, true);
            markDirty(n); markDirty(o);
        }));
        socket.on('socialDnd', guard((n, d) => {
            dbUsers[n].dnd = !!d; save(n);
            if (d) for (const inv of [...invites.values()]) if (inv.to === n) dropInvite(inv, true);
            markDirty(n);
        }, 10, 10000, 'dnd'));
        socket.on('socialInvite', guard((n, d) => { const o = d && str(d.login); if (o) sendInvite(n, o, socket); }, 12, 10000, 'inv'));
        socket.on('socialInviteAccept', guard((n, d) => {
            const inv = d && str(d.id) && invites.get(d.id);
            if (!inv || inv.to !== n) return sendRes(socket, false, 'Запрошення більше не дійсне', 'join');
            if (Date.now() > inv.exp) { dropInvite(inv, true); return sendRes(socket, false, 'Запрошення прострочене', 'join'); }
            if (!roomOk(inv)) { dropInvite(inv, true); return sendRes(socket, false, 'Кімната заповнена або гра вже почалась', 'join'); }
            for (const o of [...invites.values()]) if (o.to === n && o.id !== inv.id) dropInvite(o, true);
            dropInvite(inv, false);
            goJoin(n, socket, inv.roomId);
        }));
        socket.on('socialInviteDecline', guard((n, d) => {
            const inv = d && str(d.id) && invites.get(d.id);
            if (inv && inv.to === n) dropInvite(inv, false);
        }));
        socket.on('socialJoinFriend', guard((n, d) => {
            const o = d && str(d.login); if (!o || !areFriends(n, o)) return sendRes(socket, false, 'Це не ваш друг', 'join');
            const f = locate(o);
            if (!f || f.r.status !== 'lobby') return sendRes(socket, false, 'Друг не в лобі', 'join');
            goJoin(n, socket, f.rid);
        }, 10, 10000, 'jf'));
        socket.on('disconnect', () => {
            const n = globalPlayers[socket.id];     // основний обробник міг уже видалити запис — тому читаємо в setImmediate нижче нічого, а фіксуємо ім'я зараз
            const name = n;
            setImmediate(() => {
                for (const k of [...rl.keys()]) if (k.startsWith(socket.id + '|')) rl.delete(k);
                if (user(name) && !ctx.isOnline(name)) {
                    dbUsers[name].lastSeen = Date.now(); save(name);
                    for (const inv of [...invites.values()]) if (inv.to === name) invites.delete(inv.id);
                }
            });
        });
    });

    // ---------- періодичний обхід: зміни статусів → друзям; прострочені/недійсні запрошення ----------
    let lastSig = new Map();
    function tick() {
        const now = Date.now(), sig = new Map();
        const online = new Set(Object.values(globalPlayers));
        for (const n of online) {
            if (!user(n)) continue;                                                   // боти й чужі — ні
            const s = statusOf(n);
            sig.set(n, (s ? [s.t, s.roomId || '', s.mode || '', s.map || '', s.free ? 1 : 0, s.n || 0].join(':') : '') + '|' + nick(n) + '|' + clanOf(n));
        }
        const changed = new Set();
        for (const [n, v] of sig) if (lastSig.get(n) !== v) changed.add(n);
        for (const n of lastSig.keys()) if (!sig.has(n)) changed.add(n);
        lastSig = sig;
        changed.forEach(n => friendsOf(n).forEach(f => markDirty(f)));
        for (const f of [...dirty]) if (now - (lastPush.get(f) || 0) >= PUSH_GAP) pushNow(f);
        for (const inv of [...invites.values()]) {
            if (now > inv.exp) dropInvite(inv, true);
            else if (!roomOk(inv) || !ctx.isOnline(inv.to)) dropInvite(inv, true);
        }
        if (lastInv.size > 500) for (const [k, t] of lastInv) if (now - t > INVITE_GAP) lastInv.delete(k);
    }
    setInterval(tick, 1000);

    ctx.Social = { ensurePid, pidOf, loginByPid, friendsOf, areFriends, _tick: tick, _invites: invites };
};
