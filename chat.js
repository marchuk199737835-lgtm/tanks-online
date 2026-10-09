/* chat.js — єдиний чат гри: глобальний, клану, друзів/приватний (DM), кімнати (лобі і гра) та командний.
 * Серверний модуль: module.exports = function (ctx) { … }. Усе в пам'яті (без БД). Реєстрація сокет-обробників — ТІЛЬКИ через ctx.onConnection.
 *
 * Клієнт → сервер:
 *   chatSend    { ch:'global'|'clan'|'room'|'team'|'dm', text, to? (h співрозмовника для dm) }   (кімнату сервер визначає сам — roomId від клієнта не потрібен)
 *   chatHistory { ch, to? }      → chatHist { ch, to?, msgs }
 *   chatFriends                  → chatFriends [{ h, nick, clan, lvl }]   (лише ОНЛАЙН-друзі; також надсилається при зміні, з throttle)
 *   chatInfo                     → chatInit { h, nick, clan, hasClan, dmFo }   (ідентичність + стан клану; надсилається і після входу разом з hist глобального чату)
 *   chatSet     { dmFo:boolean } — приватні повідомлення лише від друзів (u.chatDmFriendsOnly)
 * Сервер → клієнт:
 *   chatInit { h, nick, clan, hasClan, dmFo, hist? } · chatMsg { ch, h, nick, clan, lvl, t, text, to? } · chatHist · chatFriends · chatErr { msg }
 * Повідомлення НЕ містять логіна/pid, лише непрозорий h (ctx.Handles). Боти не пишуть. DM до бота «доставляється» лише відправнику (echo, bot:1).
 * Events: слухає login/logout (оновлення списку онлайн-друзів). ctx.Chat = { clean, _t }. */
module.exports = function (ctx) {
    'use strict';
    const { io, rooms, globalPlayers, dbUsers, Events } = ctx;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const MAXLEN = 200, GAP = 800, BURST = 8, BURST_MS = 10000, MUTE_MS = 30000;
    const HIST = { global: 60, clan: 60, room: 40, team: 40, dm: 50 };
    const CHANNELS = ['global', 'clan', 'room', 'team', 'dm'];

    // ---------- очищення тексту ----------
    const rng = a => new RegExp('[' + a.map(r => String.fromCharCode(r[0]) + '-' + String.fromCharCode(r[1])).join('') + ']', 'g');
    const BAD = rng([[0, 31], [127, 159], [173, 173], [847, 847], [1564, 1564], [4447, 4448], [6068, 6069], [6155, 6158], [8203, 8207], [8232, 8239], [8287, 8303], [10240, 10240], [12644, 12644], [65024, 65039], [65279, 65279], [65440, 65440], [65520, 65535]]);
    const COMB = new RegExp('[' + String.fromCharCode(768) + '-' + String.fromCharCode(879) + ']{3,}', 'g');
    function clean(s) {
        if (typeof s !== 'string') return '';
        s = s.slice(0, 600).normalize('NFC').replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '').replace(BAD, ' ').replace(COMB, '');
        s = s.replace(/\s+/g, ' ').trim();
        if (s.length > MAXLEN) { s = s.slice(0, MAXLEN); const c = s.charCodeAt(s.length - 1); if (c >= 0xd800 && c <= 0xdbff) s = s.slice(0, -1); s = s.trim(); }
        return s;
    }

    // ---------- ідентичність ----------
    const hCache = new Map();
    const hOf = login => { let h = hCache.get(login); if (!h) { h = ctx.Handles.of(login); if (h) hCache.set(login, h); } return h; };
    const nickOf = login => String(ctx.displayName(login) || login).slice(0, 40);
    const tagOf = login => { try { return String(ctx.hooks.clanTag(login) || ''); } catch (e) { return ''; } };
    const lvlOf = login => { try { return ctx.playerLevel(login) || 1; } catch (e) { return 1; } };
    const user = login => (typeof login === 'string' && own(dbUsers, login)) ? dbUsers[login] : null;
    const loginOfSock = sid => { const l = globalPlayers[sid]; return (typeof l === 'string' && user(l)) ? l : null; };
    const socksOf = login => ctx.onlineSocketsOf(login);
    const to = (sid, ev, d) => io.to(sid).emit(ev, d);
    const cid = login => { try { return ctx.Clans ? ctx.Clans.clanOf(login) : ''; } catch (e) { return ''; } };
    const areFriends = (a, b) => { try { return !!(ctx.Social && ctx.Social.areFriends(a, b)); } catch (e) { return false; } };
    function roomOf(sid) {
        for (const id in rooms) { const r = rooms[id]; if (r && r.players && r.players[sid]) return r; }
        return null;
    }
    const isTeamRoom = r => { try { return !!ctx.isTeamPvp(r.mode); } catch (e) { return false; } };

    // ---------- історія ----------
    const hist = { global: [], clan: new Map(), room: new Map(), team: new Map(), dm: new Map() };
    function push(arr, m, max) { arr.push(m); if (arr.length > max) arr.splice(0, arr.length - max); }
    function store(kind, key, m) {
        if (kind === 'global') return push(hist.global, m, HIST.global);
        const mp = hist[kind]; let a = mp.get(key);
        if (!a) { a = []; mp.set(key, a); if (mp.size > 3000) mp.delete(mp.keys().next().value); }
        push(a, m, HIST[kind]);
    }
    const getHist = (kind, key) => kind === 'global' ? hist.global : (hist[kind].get(key) || []);
    const dmKey = (a, b) => a < b ? a + '\n' + b : b + '\n' + a;
    const teamKey = (r, p) => r.id + '|' + p.team;
    const sweepT = setInterval(() => {   // прибирання історії кімнат, яких уже немає
        for (const k of [...hist.room.keys()]) if (!rooms[k]) hist.room.delete(k);
        for (const k of [...hist.team.keys()]) if (!rooms[k.split('|')[0]]) hist.team.delete(k);
        const now = Date.now(); for (const [k, v] of st) if (now - v.last > 600000 && now > v.mute) st.delete(k);
    }, 60000); if (sweepT && sweepT.unref) sweepT.unref();

    // ---------- антиспам ----------
    const st = new Map();   // login → { last, times[], lastText, lastAt, strikes[], mute }
    function guard(login, text) {
        const now = Date.now(); let s = st.get(login);
        if (!s) st.set(login, s = { last: 0, times: [], lastText: '', lastAt: 0, strikes: [], mute: 0 });
        if (now < s.mute) return 'Ви в муті ще ' + Math.ceil((s.mute - now) / 1000) + ' с';
        s.times = s.times.filter(t => now - t < BURST_MS); s.strikes = s.strikes.filter(t => now - t < 20000);
        let bad = null;
        if (now - s.last < GAP) bad = 'Не так швидко';
        else if (s.times.length >= BURST) bad = 'Не так швидко';
        else if (s.lastText === text.toLowerCase() && now - s.lastAt < 30000) bad = 'Не повторюйте повідомлення';
        if (bad) {
            s.strikes.push(now);
            if (s.strikes.length >= 4) { s.mute = now + MUTE_MS; s.strikes = []; return 'Мут на 30 с за спам'; }
            return bad;
        }
        s.last = now; s.times.push(now); s.lastText = text.toLowerCase(); s.lastAt = now;
        return null;
    }
    const light = new Map();   // login|kind → [count, windowStart]
    function lightOk(login, kind, max, ms) {
        const k = login + '|' + kind, now = Date.now(); let v = light.get(k);
        if (!v || now - v[1] > ms) light.set(k, v = [0, now]);
        if (++v[0] > max) return false; if (light.size > 5000) light.clear(); return true;
    }

    // ---------- доставка ----------
    function sendList(logins, m) {   // logins: Set логінів → усі їхні сокети (один прохід по globalPlayers)
        for (const sid in globalPlayers) if (logins.has(globalPlayers[sid])) to(sid, 'chatMsg', m);
    }
    function deliver(login, d, socket) {
        const ch = CHANNELS.includes(d.ch) ? d.ch : null; if (!ch) return;
        const text = clean(d.text); if (!text) return;
        const err = guard(login, text);
        if (err) return socket.emit('chatErr', { msg: err });
        const m = { ch, h: hOf(login), nick: nickOf(login), clan: tagOf(login), lvl: lvlOf(login), t: Date.now(), text };
        if (ch === 'global') {
            store('global', '', m);
            for (const sid in globalPlayers) if (user(globalPlayers[sid])) to(sid, 'chatMsg', m);
        } else if (ch === 'clan') {
            const id = cid(login); if (!id) return socket.emit('chatErr', { msg: 'Ви не в клані' });
            let mem = []; try { mem = ctx.Clans.membersOf(id); } catch (e) {}
            store('clan', id, m); sendList(new Set(mem), m);
        } else if (ch === 'room' || ch === 'team') {
            const r = roomOf(socket.id); if (!r) return socket.emit('chatErr', { msg: 'Ви не в кімнаті' });
            const me = r.players[socket.id];
            if (ch === 'team' && (!isTeamRoom(r) || !me.team)) return socket.emit('chatErr', { msg: 'Командний чат доступний лише в командних режимах' });
            store(ch, ch === 'room' ? r.id : teamKey(r, me), m);
            for (const sid in r.players) { const p = r.players[sid]; if (p.isBot) continue; if (ch === 'team' && p.team !== me.team) continue; to(sid, 'chatMsg', m); }
        } else {   // dm
            const th = typeof d.to === 'string' ? d.to.slice(0, 24) : '';
            const bot = ctx.Handles.botOf(th);
            if (bot) { m.to = th; m.bot = 1; return socket.emit('chatMsg', m); }   // боту: «доставлено», відповіді не буде
            const other = ctx.Handles.loginOf(th);
            if (!other || other === login || !user(other)) return socket.emit('chatErr', { msg: 'Гравця не знайдено' });
            if (!ctx.isOnline(other)) {
                // друг не в мережі: повідомлення чекає в історії, а йому летить push «Вам написав …» (не частіше разу на добу)
                if (!areFriends(login, other)) return socket.emit('chatErr', { msg: 'Гравець не в мережі' });
                m.to = th; store('dm', dmKey(login, other), m); socket.emit('chatMsg', m);
                try { if (ctx.Notify) ctx.Notify.send(other, 'dm', { n: nickOf(login), t: text.slice(0, 120) }); } catch (e) {}
                return;
            }
            if (!areFriends(login, other) && user(other).chatDmFriendsOnly) return socket.emit('chatErr', { msg: 'Гравець приймає приватні повідомлення лише від друзів' });
            m.to = th; store('dm', dmKey(login, other), m);
            sendList(new Set([login, other]), m);
        }
    }

    // ---------- друзі онлайн ----------
    function friendsOnline(login) {
        const u = user(login); if (!u || !Array.isArray(u.friends)) return [];
        const out = [];
        for (const f of u.friends.slice(0, 200)) {
            if (typeof f !== 'string' || !user(f) || !ctx.isOnline(f)) continue;
            out.push({ h: hOf(f), nick: nickOf(f), clan: tagOf(f), lvl: lvlOf(f) });
            if (out.length >= 60) break;
        }
        return out;
    }
    const pushT = new Map();
    function pushFriends(login) {   // throttled: не частіше за раз на 2 с на гравця
        if (pushT.has(login)) return;
        pushT.set(login, setTimeout(() => {
            pushT.delete(login);
            const l = friendsOnline(login); socksOf(login).forEach(sid => to(sid, 'chatFriends', l));
        }, 2000));
    }
    function notifyFriendsOf(login) {
        const u = user(login); if (!u || !Array.isArray(u.friends)) return;
        u.friends.slice(0, 200).forEach(f => { if (typeof f === 'string' && user(f) && ctx.isOnline(f)) pushFriends(f); });
    }

    const initOf = login => { const u = user(login); return { h: hOf(login), nick: nickOf(login), clan: tagOf(login), hasClan: !!cid(login), dmFo: !!(u && u.chatDmFriendsOnly) }; };

    Events.on('login', e => {
        try {
            if (!e || !user(e.name)) return;
            const d = initOf(e.name); d.hist = hist.global.slice(-HIST.global); d.friends = friendsOnline(e.name);
            to(e.socketId, 'chatInit', d); notifyFriendsOf(e.name);
        } catch (err) { console.error('❌ chat login', err && err.message); }
    });
    Events.on('logout', e => { try { if (e && e.name) { if (!ctx.isOnline(e.name)) notifyFriendsOf(e.name); } } catch (err) {} });

    ctx.onConnection(socket => {
        const on = (ev, fn) => socket.on(ev, d => {
            try {
                const login = loginOfSock(socket.id); if (!login) return;
                fn(login, (d && typeof d === 'object') ? d : {});
            } catch (e) { console.error('❌ chat', ev, e && e.message); }
        });
        on('chatSend', (login, d) => deliver(login, d, socket));
        on('chatHistory', (login, d) => {
            if (!lightOk(login, 'h', 12, 10000)) return;
            const ch = CHANNELS.includes(d.ch) ? d.ch : null; if (!ch) return;
            let msgs = [];
            if (ch === 'global') msgs = getHist('global');
            else if (ch === 'clan') { const id = cid(login); if (id) msgs = getHist('clan', id); }
            else if (ch === 'room' || ch === 'team') {
                const r = roomOf(socket.id);
                if (r) { const me = r.players[socket.id]; msgs = ch === 'room' ? getHist('room', r.id) : (isTeamRoom(r) && me.team ? getHist('team', teamKey(r, me)) : []); }
            } else {
                const o = ctx.Handles.loginOf(typeof d.to === 'string' ? d.to.slice(0, 24) : '');
                if (o && user(o) && o !== login) msgs = getHist('dm', dmKey(login, o));
            }
            const out = { ch, msgs: msgs.slice(-HIST[ch]) }; if (ch === 'dm') out.to = d.to;
            socket.emit('chatHist', out);
        });
        on('chatFriends', login => { if (lightOk(login, 'f', 6, 10000)) socket.emit('chatFriends', friendsOnline(login)); });
        on('chatInfo', login => { if (lightOk(login, 'i', 6, 10000)) socket.emit('chatInit', initOf(login)); });
        on('chatSet', (login, d) => {
            if (!lightOk(login, 's', 10, 10000)) return;
            const u = user(login); if (!u) return;
            if (typeof d.dmFo === 'boolean' && !!u.chatDmFriendsOnly !== d.dmFo) { u.chatDmFriendsOnly = d.dmFo; try { ctx.saveUser(login); } catch (e) {} }
        });
    });

    ctx.Chat = { clean, _t: { hist, st, guard, deliver, friendsOnline } };
};
