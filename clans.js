/* clans.js — клани: створення (249 кредитів), склад і ролі, заявки, рейтинг сезону, чат, нагороди сезону.
 * Сервер-модуль: module.exports = function (ctx) { … }. Усе тут рахується на сервері, клієнту довіряти не можна.
 *
 * Сокет (клієнт → сервер):
 *   clanGet                          → clanState { mine:view|null, cost, bucks, minLevel? }
 *   clanList { q? }                  → clanList { list:[summary], total, mineId, season }  (топ-50 або пошук)
 *   clanPeek { id }                  → clanPeek { clan:summary + members }
 *   clanCreate { name, tag, emblem:{icon,color1,color2}, desc, join, minLevel }
 *   clanJoin { id } · clanCancelRequest { id } · clanLeave
 *   clanAccept { login } · clanReject { login } · clanKick { login }
 *   clanPromote { login } · clanDemote { login } · clanTransfer { login } · clanDisband
 *   clanSettings { desc, join, minLevel, emblem }
 *   clanChat { text }
 * Сервер → клієнт:
 *   clanState (власний клан або null) · clanList · clanPeek · clanResult { ok, msg, act, id? }
 *   clanChatMsg { t, login, nick, text } · clanNotify { kind, text }
 * Events (слухає): kill, matchEnd, login.  ctx.hooks.clanTag, ctx.Clans = { clanOf(name), tagOf(name) }.
 */
module.exports = function (ctx) {
    'use strict';
    const { io, dbUsers, Events } = ctx;

    // ---------- Константи ----------
    const COST = 249, MAX_MEMBERS = 30, MAX_OFFICERS = 5, MAX_REQ = 40, MAX_LOG = 30, MAX_CHAT = 50, CHAT_LEN = 200, CHAT_GAP = 1200;
    const DAY_CAP = 250;                       // скільки очок клану один гравець може принести за добу (захист від фарму)
    const REWARDS = [150, 100, 60];            // нагорода кожному учаснику за 1/2/3 місце сезону
    const LEVEL_AT = [0, 100, 300, 700, 1500, 3000, 6000, 10000, 16000, 25000];
    const LEVEL_NAMES = ['Новобранці', 'Загін', 'Взвод', 'Рота', 'Батальйон', 'Полк', 'Бригада', 'Дивізія', 'Корпус', 'Легенда'];
    const ICONS = ['tank', 'star', 'bolt', 'crown', 'skull', 'swords', 'flame', 'wing', 'aim', 'gear', 'gem', 'paw', 'moon', 'rocket', 'bomb', 'snow', 'eye', 'shield'];
    const JOINS = ['open', 'request', 'closed'];
    const MAXLVL = (ctx.GameData && ctx.GameData.MAX_LEVEL) || 15;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

    // ---------- Стан ----------
    const clans = new Map();          // id → clan
    const memberOf = new Map();       // login → clanId (джерело істини про членство; дзеркало — u.clan)
    const chats = new Map();          // clanId → [{t,login,nick,text}]
    const dirty = new Set();
    const rate = Object.create(null); // `${login}|${act}` → last
    const lastRank = new Map();       // clanId → { rank, notifiedAt }
    let col = null, loaded = false, loading = false, saveTimer = 0, curSeason = null, seasonAt = 0, rankCache = null, rankAt = 0;

    // ---------- Час: Київ ----------
    function kyivParts(ts) {
        try {
            const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
            const o = {}; f.formatToParts(new Date(ts)).forEach(p => { o[p.type] = p.value; });
            return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24 };
        } catch (e) { const d = new Date(ts + 3 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours() }; }
    }
    const p2 = n => (n < 10 ? '0' : '') + n;
    const dayId = ts => { const k = kyivParts(ts || Date.now()); return k.y + '-' + p2(k.m) + '-' + p2(k.d); };
    function seasonNow() {
        const now = Date.now();
        if (curSeasonNow && Math.abs(now - seasonAt) < 20000) return curSeasonNow;
        seasonAt = now; const k = kyivParts(now); curSeasonNow = k.y + '-' + p2(k.m); return curSeasonNow;
    }
    let curSeasonNow = null;
    function seasonEndTs() {   // початок наступного місяця за Києвом
        const now = Date.now(), k = kyivParts(now);
        let y = k.y, m = k.m + 1; if (m > 12) { m = 1; y++; }
        const guess = Date.UTC(y, m - 1, 1, 0, 0, 0);
        const g = kyivParts(guess), off = Date.UTC(g.y, g.m - 1, g.d, g.h) - Math.floor(guess / 3600e3) * 3600e3;  // зсув Києва відносно UTC у мс
        return guess - off;
    }

    // ---------- Допоміжне ----------
    const clanById = id => (typeof id === 'string' && clans.has(id)) ? clans.get(id) : null;
    const clanOf = name => memberOf.get(name) || '';
    const tagOf = name => { const c = clanById(clanOf(name)); return c ? c.tag : ''; };
    const lvOf = pts => { let l = 1; for (let i = 1; i < LEVEL_AT.length; i++) if (pts >= LEVEL_AT[i]) l = i + 1; return l; };
    const nick = login => ctx.displayName(login);
    const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const sockets = login => ctx.onlineSocketsOf(login);
    const emitTo = (login, ev, d) => sockets(login).forEach(id => io.to(id).emit(ev, d));
    const newId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    function throttle(login, act, gap) {
        const k = login + '|' + act, now = Date.now();
        if (rate[k] && now - rate[k] < gap) return false;
        rate[k] = now; return true;
    }
    function cleanName(s) {
        s = str(s, 60).normalize('NFC').replace(/[^\p{L}\p{N} _.\-]/gu, '').replace(/\s+/g, ' ').trim();
        return s.slice(0, 16).trim();
    }
    const nameKey = s => s.toLowerCase().replace(/[\s._-]+/g, '');
    function cleanTag(s) { return str(s, 20).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); }
    function cleanDesc(s) { return str(s, 400).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120); }
    const HEX = /^#[0-9a-fA-F]{6}$/;
    function cleanEmblem(e, def) {
        e = (e && typeof e === 'object') ? e : {};
        const d = def || { icon: 'tank', color1: '#f59e0b', color2: '#b45309' };
        return {
            icon: (typeof e.icon === 'string' && ICONS.includes(e.icon)) ? e.icon : d.icon,
            color1: (typeof e.color1 === 'string' && HEX.test(e.color1)) ? e.color1.toLowerCase() : d.color1,
            color2: (typeof e.color2 === 'string' && HEX.test(e.color2)) ? e.color2.toLowerCase() : d.color2
        };
    }
    const nameTaken = (key, exceptId) => { for (const c of clans.values()) if (c.id !== exceptId && nameKey(c.name) === key) return true; return false; };
    const tagTaken = (tag, exceptId) => { for (const c of clans.values()) if (c.id !== exceptId && c.tag === tag) return true; return false; };

    // ---------- Збереження ----------
    function plain(c) {
        const o = Object.assign({}, c); o._id = c.id; o.members = Object.assign({}, c.members);
        return o;
    }
    function markDirty(c) {
        if (!c) return; dirty.add(c.id);
        if (!col || saveTimer) return;
        saveTimer = setTimeout(flush, 2500);
    }
    function flush() {
        saveTimer = 0;
        if (!col) return;
        const ids = Array.from(dirty); dirty.clear();
        ids.forEach(id => {
            const c = clans.get(id);
            const p = c ? col.replaceOne({ _id: id }, plain(c), { upsert: true }) : col.deleteOne({ _id: id });
            if (p && p.catch) p.catch(e => console.error('❌ Клан не збережено', id, e && e.message));
        });
    }
    function normalize(raw) {
        if (!raw || typeof raw !== 'object' || typeof (raw.id || raw._id) !== 'string') return null;
        const c = Object.assign({}, raw); c.id = String(raw.id || raw._id); delete c._id;
        c.name = cleanName(c.name); c.tag = cleanTag(c.tag); if (c.name.length < 3 || c.tag.length < 2) return null;
        c.emblem = cleanEmblem(c.emblem); c.desc = cleanDesc(c.desc);
        c.join = JOINS.includes(c.join) ? c.join : 'open'; c.minLevel = Math.max(1, Math.min(MAXLVL, c.minLevel | 0 || 1));
        const ms = Object.create(null);
        if (c.members && typeof c.members === 'object') for (const k of Object.keys(c.members)) {
            const m = c.members[k]; if (!m || typeof m !== 'object') continue;
            ms[k] = { role: ['leader', 'officer', 'member'].includes(m.role) ? m.role : 'member', joinedAt: +m.joinedAt || Date.now(), points: +m.points || 0, dayId: str(m.dayId, 12), dayPts: +m.dayPts || 0 };
        }
        c.members = ms; c.points = +c.points || 0; c.totalPoints = +c.totalPoints || 0; c.created = +c.created || Date.now();
        c.log = Array.isArray(c.log) ? c.log.slice(-MAX_LOG) : []; c.requests = Array.isArray(c.requests) ? c.requests.filter(x => typeof x === 'string').slice(0, MAX_REQ) : [];
        c.seasonId = str(c.seasonId, 10) || seasonNow(); c.award = (c.award && typeof c.award === 'object' && Array.isArray(c.award.eligible)) ? c.award : null;
        c.lastSeason = c.lastSeason && typeof c.lastSeason === 'object' ? c.lastSeason : null;
        if (!own(ms, c.leader) || !c.leader) { const l = Object.keys(ms).find(k => ms[k].role === 'leader') || Object.keys(ms)[0]; if (!l) return null; c.leader = l; ms[l].role = 'leader'; }
        return c;
    }
    function indexClan(c) { for (const k of Object.keys(c.members)) { memberOf.set(k, c.id); const u = dbUsers[k]; if (u && u.clan !== c.id) { u.clan = c.id; } } }
    function loadFromDb() {
        if (loaded || loading) return; const db = ctx.getDb(); if (!db) return;
        loading = true;
        const cl = db.collection('clans');
        cl.find({}).toArray().then(rows => {
            const mem = Array.from(clans.values());
            clans.clear(); memberOf.clear();
            rows.forEach(r => { const c = normalize(r); if (c && !clans.has(c.id)) { clans.set(c.id, c); } });
            // клани, створені в пам'яті до підключення БД: додаємо, якщо немає конфліктів
            mem.forEach(c => {
                if (clans.has(c.id)) return;
                if (nameTaken(nameKey(c.name)) || tagTaken(c.tag) || Object.keys(c.members).some(k => memberOf.has(k) || clanOfDb(k))) {
                    const u = dbUsers[c.leader]; if (u) { u.bucks += COST; u.clan = ''; ctx.saveUser(c.leader); }
                    Object.keys(c.members).forEach(k => { const x = dbUsers[k]; if (x && x.clan === c.id) x.clan = ''; });
                    return;
                }
                clans.set(c.id, c); dirty.add(c.id);
            });
            clans.forEach(indexClan);
            col = cl; loaded = true; loading = false;
            settle(); rankCache = null;
            if (dirty.size && !saveTimer) saveTimer = setTimeout(flush, 500);
            console.log('✅ Завантажено кланів: ' + clans.size);
        }).catch(e => { loading = false; console.error('❌ Клани не завантажено:', e && e.message); });
    }
    function clanOfDb(login) { for (const c of clans.values()) if (own(c.members, login)) return c.id; return ''; }
    function dbWaiting() { return !loaded && !!ctx.getDb(); }
    loadFromDb();
    if (!loaded) {
        const t = setInterval(() => { if (loaded) { clearInterval(t); return; } loadFromDb(); }, 5000);
        if (t && t.unref) t.unref();
    }
    curSeason = seasonNow();

    // ---------- Сезон ----------
    function settle() {
        const now = seasonNow(); curSeason = now;
        const olds = Array.from(clans.values()).filter(c => c.seasonId !== now);
        if (!olds.length) return;
        const maxOld = olds.map(c => c.seasonId).sort().pop();
        const rank = olds.filter(c => c.seasonId === maxOld && c.points > 0).sort(byPoints);
        rank.forEach((c, i) => {
            c.lastSeason = { season: maxOld, place: i + 1, points: c.points };
            if (i < REWARDS.length) { c.award = { season: maxOld, place: i + 1, amount: REWARDS[i], eligible: Object.keys(c.members) }; pushLog(c, 'season', '', '', i + 1); }
        });
        olds.forEach(c => {
            if (!c.lastSeason || c.lastSeason.season !== maxOld) c.lastSeason = { season: maxOld, place: 0, points: c.points };
            c.points = 0; c.seasonId = now; for (const k of Object.keys(c.members)) c.members[k].points = 0;
            markDirty(c);
        });
        rankCache = null;
    }
    function claimAward(login) {
        const id = clanOf(login), c = clanById(id), u = dbUsers[login]; if (!c || !u || !c.award) return 0;
        const i = c.award.eligible.indexOf(login); if (i < 0) return 0;
        c.award.eligible.splice(i, 1);
        const amt = Math.max(0, c.award.amount | 0), place = c.award.place;
        if (!c.award.eligible.length) c.award = null;
        markDirty(c);
        u.bucks += amt; u.stats = u.stats || { kills: 0, matches: 0, earned: 0 }; u.stats.earned = (u.stats.earned | 0) + amt;
        ctx.saveUser(login);
        sockets(login).forEach(id2 => { ctx.sendEconomy(id2, login); io.to(id2).emit('clanNotify', { kind: 'season', text: 'Ваш клан ' + (place === 1 ? 'переміг' : 'посів ' + place + ' місце') + ' у сезоні! Нагорода: +' + amt + ' кредитів' }); });
        return amt;
    }

    // ---------- Рейтинг ----------
    const byPoints = (a, b) => (b.points - a.points) || (b.totalPoints - a.totalPoints) || (a.created - b.created);
    function ranking() {
        const now = Date.now();
        if (rankCache && now - rankAt < 3000) return rankCache;
        settle();
        rankCache = Array.from(clans.values()).sort(byPoints); rankAt = now;
        return rankCache;
    }
    const rankOf = c => ranking().indexOf(c) + 1;

    // ---------- Подання ----------
    function pushLog(c, k, a, b, x) { c.log.push({ t: Date.now(), k, a: a || '', b: b || '', x: x || 0 }); if (c.log.length > MAX_LOG) c.log.splice(0, c.log.length - MAX_LOG); }
    function logText(e) {
        const a = e.a ? nick(e.a) : '', b = e.b ? nick(e.b) : '';
        switch (e.k) {
            case 'create': return a + ' створив(ла) клан';
            case 'join': return a + ' приєднався(лась) до клану';
            case 'leave': return a + ' покинув(ла) клан';
            case 'kick': return a + ' вигнав(ла) ' + b;
            case 'promote': return a + ' призначив(ла) офіцером ' + b;
            case 'demote': return a + ' знизив(ла) до учасника ' + b;
            case 'transfer': return a + ' передав(ла) лідерство гравцю ' + b;
            case 'settings': return a + ' змінив(ла) налаштування клану';
            case 'level': return 'Клан досяг рівня ' + e.x + ' — «' + LEVEL_NAMES[e.x - 1] + '»';
            case 'season': return 'Сезон завершено: ' + e.x + ' місце, нагороди чекають учасників';
            default: return '';
        }
    }
    function summary(c, forLogin) {
        const lv = lvOf(c.totalPoints);
        return {
            id: c.id, name: c.name, tag: c.tag, emblem: c.emblem, desc: c.desc, join: c.join, minLevel: c.minLevel,
            level: lv, levelName: LEVEL_NAMES[lv - 1], members: Object.keys(c.members).length, max: MAX_MEMBERS,
            points: c.points, totalPoints: c.totalPoints, rank: rankOf(c), leader: nick(c.leader),
            requested: !!(forLogin && c.requests.includes(forLogin))
        };
    }
    function view(c, login) {
        const today = dayId(), role = c.members[login] ? c.members[login].role : 'member';
        const staff = role === 'leader' || role === 'officer';
        let todayPts = 0;
        const members = Object.keys(c.members).map(k => {
            const m = c.members[k], dp = m.dayId === today ? m.dayPts : 0; todayPts += dp;
            return { login: k, nick: nick(k), role: m.role, level: ctx.playerLevel(k), points: m.points, today: dp, joinedAt: m.joinedAt, online: ctx.isOnline(k) };
        }).sort((a, b) => (b.role === 'leader') - (a.role === 'leader') || (b.role === 'officer') - (a.role === 'officer') || b.points - a.points);
        const lv = lvOf(c.totalPoints);
        const s = summary(c, login);
        s.members = members; s.count = members.length; s.todayPts = todayPts; s.myToday = c.members[login] && c.members[login].dayId === today ? c.members[login].dayPts : 0;
        s.myRole = role; s.myPoints = c.members[login] ? c.members[login].points : 0;
        s.lvFrom = LEVEL_AT[lv - 1]; s.lvTo = lv < LEVEL_AT.length ? LEVEL_AT[lv] : 0;
        s.seasonId = c.seasonId; s.seasonEnd = seasonEndTs(); s.total = clans.size; s.lastSeason = c.lastSeason;
        s.requests = staff ? c.requests.map(k => ({ login: k, nick: nick(k), level: ctx.playerLevel(k) })) : [];
        s.reqCount = c.requests.length;
        s.log = c.log.slice().reverse().map(e => ({ t: e.t, k: e.k, text: logText(e) })).filter(e => e.text);
        s.chat = (chats.get(c.id) || []).slice(-MAX_CHAT);
        s.award = c.award && c.award.eligible.includes(login) ? { place: c.award.place, amount: c.award.amount } : null;
        return s;
    }
    function statePayload(login) {
        const u = dbUsers[login], c = clanById(clanOf(login));
        return { mine: c ? view(c, login) : null, cost: COST, bucks: u ? u.bucks : 0, max: MAX_MEMBERS, rewards: REWARDS, season: seasonNow() };
    }
    // пуш стану — лише якщо корисне навантаження справді змінилось для цього сокета (підпис JSON); без дублікатів
    const lastSent = new Map();
    function sendState(login) {
        const ids = sockets(login); if (!ids.length) return;
        const st = statePayload(login), sig = JSON.stringify(st);
        if (lastSent.size > 3000) for (const k of lastSent.keys()) if (!io.sockets.sockets.has(k)) lastSent.delete(k);
        ids.forEach(id => { if (lastSent.get(id) === sig) return; lastSent.set(id, sig); io.to(id).emit('clanState', st); });
    }
    function pushClan(c) { Object.keys(c.members).forEach(k => { if (ctx.isOnline(k)) sendState(k); }); }

    // ---------- Членство ----------
    function syncRooms(login) {
        const tag = tagOf(login);
        for (const rid in ctx.rooms) { const ps = ctx.rooms[rid].players; for (const sid in ps) if (ps[sid].name === login) ps[sid].clan = tag; }
    }
    function addMember(c, login, role) {
        c.members[login] = { role, joinedAt: Date.now(), points: 0, dayId: '', dayPts: 0 };
        memberOf.set(login, c.id); const u = dbUsers[login]; if (u) { u.clan = c.id; ctx.saveUser(login); }
        for (const o of clans.values()) { const i = o.requests.indexOf(login); if (i >= 0) { o.requests.splice(i, 1); markDirty(o); } }
        syncRooms(login);
    }
    function removeMember(c, login) {
        delete c.members[login]; memberOf.delete(login);
        const u = dbUsers[login]; if (u) { u.clan = ''; ctx.saveUser(login); }
        syncRooms(login);
    }
    function disband(c) {
        const ids = Object.keys(c.members);
        ids.forEach(k => { memberOf.delete(k); const u = dbUsers[k]; if (u) { u.clan = ''; ctx.saveUser(k); } });
        clans.delete(c.id); chats.delete(c.id); lastRank.delete(c.id); rankCache = null; markDirty(c);
        ids.forEach(k => { syncRooms(k); emitTo(k, 'clanState', statePayload(k)); emitTo(k, 'clanNotify', { kind: 'info', text: 'Клан «' + c.name + '» розпущено' }); });
    }

    // ---------- Очки ----------
    function addPts(login, n) {
        const c = clanById(clanOf(login)); if (!c || !(n > 0)) return;
        settle();
        const m = c.members[login]; if (!m) return;
        const today = dayId(); if (m.dayId !== today) { m.dayId = today; m.dayPts = 0; }
        n = Math.min(n, DAY_CAP - m.dayPts); if (n <= 0) return;
        m.dayPts += n; m.points += n; c.points += n;
        const before = lvOf(c.totalPoints); c.totalPoints += n; const after = lvOf(c.totalPoints);
        if (after > before) { pushLog(c, 'level', '', '', after); pushClan(c); }
        rankCache = null; markDirty(c);
    }
    Events.on('kill', e => {
        try {
            if (!e || e.killerBot || !e.killerName || e.killerName === e.victimName) return;
            addPts(e.killerName, 1);
        } catch (err) { console.error('❌ clans kill', err && err.message); }
    });
    Events.on('matchEnd', e => {
        try {
            if (!e || !Array.isArray(e.players)) return;
            if (typeof e.durationMs === 'number' && e.durationMs < 20000) return;   // миттєві «матчі» не рахуються
            const br = e.mode === 'battle_royale';
            e.players.forEach(p => { if (!p || p.isBot || !p.name) return; addPts(p.name, p.outcome === 'win' ? (br ? 20 : 10) : 2); });
        } catch (err) { console.error('❌ clans matchEnd', err && err.message); }
    });
    Events.on('login', e => {
        try {
            if (!e || !e.name) return;
            const u = dbUsers[e.name]; if (!u) return;
            if (!memberOf.has(e.name) && u.clan && loaded) { u.clan = ''; ctx.saveUser(e.name); }
            if (memberOf.has(e.name) && u.clan !== memberOf.get(e.name)) u.clan = memberOf.get(e.name);
            settle(); claimAward(e.name); syncRooms(e.name); sendState(e.name);
        } catch (err) { console.error('❌ clans login', err && err.message); }
    });

    // ---------- Сповіщення про зміну місця (раз на хвилину) ----------
    function rankTick() {
        try {
            const r = ranking(), now = Date.now();
            r.forEach((c, i) => {
                const prev = lastRank.get(c.id), rk = i + 1;
                if (prev && rk < prev.rank && c.points > 0 && now - prev.notifiedAt > 600000) {
                    Object.keys(c.members).forEach(k => emitTo(k, 'clanNotify', { kind: 'rank', text: 'Ваш клан піднявся на ' + rk + ' місце!' }));
                    lastRank.set(c.id, { rank: rk, notifiedAt: now });
                } else lastRank.set(c.id, { rank: rk, notifiedAt: prev ? prev.notifiedAt : 0 });
            });
        } catch (e) {}
    }
    { const t = setInterval(rankTick, 60000); if (t && t.unref) t.unref(); }

    // ---------- Обробники сокета ----------
    ctx.onConnection(socket => {
        const who = () => ctx.globalPlayers[socket.id];
        const res = (ok, msg, act, extra) => socket.emit('clanResult', Object.assign({ ok, msg, act }, extra || {}));
        // обгортка: перевіряє вхід, ліміт частоти й ловить помилки
        const on = (ev, gap, fn) => socket.on(ev, data => {
            try {
                const me = who(); const u = me && dbUsers[me];
                if (!u) return res(false, 'Спершу увійдіть в акаунт', ev);
                if (!throttle(me, ev, gap)) return res(false, 'Не так швидко! Зачекайте мить', ev);
                if (data !== undefined && data !== null && typeof data !== 'object') data = {};
                fn(me, u, data || {});
            } catch (e) { console.error('❌ clans', ev, e && e.stack || e); res(false, 'Сталася помилка. Спробуйте ще раз', ev); }
        });
        const myClan = me => clanById(clanOf(me));
        const roleOf = (c, k) => (c && own(c.members, k)) ? c.members[k].role : null;
        const lg = v => (typeof v === 'string' && v.length > 0 && v.length <= 40) ? v : '';

        on('clanGet', 400, (me, u) => { settle(); claimAward(me); const st = statePayload(me); lastSent.set(socket.id, JSON.stringify(st)); socket.emit('clanState', st); });

        on('clanList', 400, (me, u, d) => {
            const q = str(d.q, 30).trim().toLowerCase();
            let list = ranking();
            if (q) list = list.filter(c => c.name.toLowerCase().includes(q) || c.tag.toLowerCase().includes(q));
            socket.emit('clanList', { list: list.slice(0, 50).map(c => summary(c, me)), total: clans.size, mineId: clanOf(me), season: seasonNow(), seasonEnd: seasonEndTs(), q });
        });

        on('clanPeek', 400, (me, u, d) => {
            const c = clanById(d.id); if (!c) return res(false, 'Клан не знайдено', 'clanPeek');
            const s = summary(c, me); s.membersList = Object.keys(c.members).map(k => ({ nick: nick(k), role: c.members[k].role, level: ctx.playerLevel(k), points: c.members[k].points }))
                .sort((a, b) => b.points - a.points).slice(0, MAX_MEMBERS);
            socket.emit('clanPeek', { clan: s });
        });

        on('clanCreate', 2500, (me, u, d) => {
            const A = 'create';
            if (dbWaiting()) return res(false, 'Клани ще завантажуються. Спробуйте за хвилину', A);
            if (memberOf.has(me)) return res(false, 'Ви вже перебуваєте в клані', A);
            const name = cleanName(d.name), tag = cleanTag(d.tag);
            if (name.length < 3) return res(false, 'Назва клану — від 3 до 16 символів', A, { field: 'name' });
            if (!/[\p{L}\p{N}]/u.test(name)) return res(false, 'У назві мають бути літери або цифри', A, { field: 'name' });
            if (tag.length < 2) return res(false, 'Тег клану — від 2 до 4 символів (латиниця й цифри)', A, { field: 'tag' });
            if (nameTaken(nameKey(name))) return res(false, 'Клан з такою назвою вже існує', A, { field: 'name' });
            if (tagTaken(tag)) return res(false, 'Цей тег уже зайнятий', A, { field: 'tag' });
            const join = JOINS.includes(d.join) ? d.join : 'open';
            const minLevel = Math.max(1, Math.min(MAXLVL, d.minLevel | 0 || 1));
            if (!Number.isFinite(u.bucks) || u.bucks < COST) return res(false, 'Бракує ' + Math.max(0, COST - (u.bucks | 0)) + ' кредитів для створення клану', A, { need: COST - (u.bucks | 0) });
            // усі перевірки пройдено — знімаємо плату й створюємо (синхронно, без розривів)
            u.bucks -= COST;
            const c = {
                id: newId(), name, tag, emblem: cleanEmblem(d.emblem), desc: cleanDesc(d.desc), join, minLevel, leader: me,
                members: Object.create(null), points: 0, totalPoints: 0, created: Date.now(), log: [], requests: [],
                seasonId: seasonNow(), award: null, lastSeason: null
            };
            clans.set(c.id, c); addMember(c, me, 'leader'); pushLog(c, 'create', me); rankCache = null; markDirty(c);
            ctx.saveUser(me); ctx.sendEconomy(socket.id, me);
            res(true, 'Клан «' + name + '» створено!', A, { id: c.id });
            sendState(me);
        });

        on('clanJoin', 600, (me, u, d) => {
            const A = 'join';
            if (dbWaiting()) return res(false, 'Клани ще завантажуються. Спробуйте за хвилину', A);
            if (memberOf.has(me)) return res(false, 'Спершу покиньте поточний клан', A);
            const c = clanById(d.id); if (!c) return res(false, 'Клан не знайдено', A);
            if (Object.keys(c.members).length >= MAX_MEMBERS) return res(false, 'У клані немає вільних місць', A);
            if (c.join === 'closed') return res(false, 'Клан закритий для вступу', A);
            const lvl = ctx.playerLevel(me); if (lvl < c.minLevel) return res(false, 'Потрібен ' + c.minLevel + ' рівень (у вас ' + lvl + ')', A);
            if (c.join === 'open') {
                addMember(c, me, 'member'); pushLog(c, 'join', me); markDirty(c);
                res(true, 'Ви приєдналися до клану «' + c.name + '»', A, { id: c.id }); pushClan(c);
            } else {
                if (c.requests.includes(me)) return res(false, 'Заявку вже подано', A);
                if (c.requests.length >= MAX_REQ) return res(false, 'Черга заявок переповнена. Спробуйте пізніше', A);
                c.requests.push(me); markDirty(c);
                res(true, 'Заявку до «' + c.name + '» подано. Чекайте відповіді офіцерів', A, { id: c.id });
                Object.keys(c.members).forEach(k => { const r = c.members[k].role; if (r !== 'member') { emitTo(k, 'clanNotify', { kind: 'request', text: nick(me) + ' подає заявку до клану' }); sendState(k); } });
            }
        });

        on('clanCancelRequest', 400, (me, u, d) => {
            const c = clanById(d.id); if (!c) return res(false, 'Клан не знайдено', 'cancel');
            const i = c.requests.indexOf(me); if (i < 0) return res(false, 'Заявки немає', 'cancel');
            c.requests.splice(i, 1); markDirty(c); res(true, 'Заявку скасовано', 'cancel', { id: c.id });
        });

        on('clanLeave', 800, (me) => {
            const A = 'leave', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) === 'leader') {
                if (Object.keys(c.members).length === 1) { disband(c); return res(true, 'Клан розпущено', A); }
                return res(false, 'Лідер не може вийти: передайте лідерство або розпустіть клан', A);
            }
            removeMember(c, me); pushLog(c, 'leave', me); markDirty(c);
            res(true, 'Ви залишили клан «' + c.name + '»', A); sendState(me); pushClan(c);
        });

        on('clanAccept', 400, (me, u, d) => {
            const A = 'accept', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) === 'member') return res(false, 'Недостатньо прав', A);
            const t = lg(d.login), i = c.requests.indexOf(t); if (i < 0) return res(false, 'Заявку не знайдено', A);
            if (memberOf.has(t)) { c.requests.splice(i, 1); markDirty(c); return res(false, 'Гравець уже в іншому клані', A); }
            if (Object.keys(c.members).length >= MAX_MEMBERS) return res(false, 'У клані немає вільних місць', A);
            const tu = dbUsers[t]; if (!tu) { c.requests.splice(i, 1); markDirty(c); return res(false, 'Гравця не знайдено', A); }
            addMember(c, t, 'member'); pushLog(c, 'join', t); markDirty(c);
            emitTo(t, 'clanNotify', { kind: 'joined', text: 'Вашу заявку до клану «' + c.name + '» прийнято!' });
            res(true, nick(t) + ' приєднався до клану', A); sendState(t); pushClan(c);
        });

        on('clanReject', 400, (me, u, d) => {
            const A = 'reject', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) === 'member') return res(false, 'Недостатньо прав', A);
            const t = lg(d.login), i = c.requests.indexOf(t); if (i < 0) return res(false, 'Заявку не знайдено', A);
            c.requests.splice(i, 1); markDirty(c);
            emitTo(t, 'clanNotify', { kind: 'info', text: 'Заявку до клану «' + c.name + '» відхилено' });
            res(true, 'Заявку відхилено', A); pushClan(c);
        });

        on('clanKick', 500, (me, u, d) => {
            const A = 'kick', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            const mr = roleOf(c, me), t = lg(d.login), tr = roleOf(c, t);
            if (!tr) return res(false, 'Гравця немає в клані', A);
            if (t === me) return res(false, 'Себе вигнати не можна — скористайтеся виходом', A);
            if (mr === 'member' || tr === 'leader' || (mr === 'officer' && tr !== 'member')) return res(false, 'Недостатньо прав', A);
            removeMember(c, t); pushLog(c, 'kick', me, t); markDirty(c);
            emitTo(t, 'clanNotify', { kind: 'kick', text: 'Вас вигнано з клану «' + c.name + '»' }); sendState(t);
            res(true, nick(t) + ' більше не в клані', A); pushClan(c);
        });

        const roleChange = (ev, newRole, need) => on(ev, 500, (me, u, d) => {
            const c = myClan(me); if (!c) return res(false, 'Ви не в клані', ev);
            if (roleOf(c, me) !== 'leader') return res(false, 'Це може лише лідер', ev);
            const t = lg(d.login), tr = roleOf(c, t); if (!tr || t === me) return res(false, 'Оберіть іншого учасника', ev);
            if (tr !== need) return res(false, newRole === 'officer' ? 'Гравець уже офіцер' : 'Гравець не офіцер', ev);
            if (newRole === 'officer' && Object.keys(c.members).filter(k => c.members[k].role === 'officer').length >= MAX_OFFICERS) return res(false, 'Максимум офіцерів — ' + MAX_OFFICERS, ev);
            c.members[t].role = newRole; pushLog(c, newRole === 'officer' ? 'promote' : 'demote', me, t); markDirty(c);
            res(true, nick(t) + (newRole === 'officer' ? ' тепер офіцер' : ' тепер звичайний учасник'), ev); pushClan(c);
        });
        roleChange('clanPromote', 'officer', 'member');
        roleChange('clanDemote', 'member', 'officer');

        on('clanTransfer', 800, (me, u, d) => {
            const A = 'transfer', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) !== 'leader') return res(false, 'Це може лише лідер', A);
            const t = lg(d.login); if (!roleOf(c, t) || t === me) return res(false, 'Оберіть іншого учасника', A);
            c.members[t].role = 'leader'; c.members[me].role = 'officer'; c.leader = t; pushLog(c, 'transfer', me, t); markDirty(c);
            emitTo(t, 'clanNotify', { kind: 'leader', text: 'Вас призначено лідером клану «' + c.name + '»' });
            res(true, 'Лідерство передано гравцю ' + nick(t), A); pushClan(c);
        });

        on('clanDisband', 1000, (me) => {
            const A = 'disband', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) !== 'leader') return res(false, 'Це може лише лідер', A);
            disband(c); res(true, 'Клан розпущено', A);
        });

        on('clanSettings', 800, (me, u, d) => {
            const A = 'settings', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            if (roleOf(c, me) !== 'leader') return res(false, 'Це може лише лідер', A);
            if (typeof d.desc === 'string') c.desc = cleanDesc(d.desc);
            if (JOINS.includes(d.join)) c.join = d.join;
            if (d.minLevel !== undefined) c.minLevel = Math.max(1, Math.min(MAXLVL, d.minLevel | 0 || 1));
            if (d.emblem) c.emblem = cleanEmblem(d.emblem, c.emblem);
            if (c.join !== 'request' && c.requests.length && c.join === 'closed') c.requests = [];
            pushLog(c, 'settings', me); markDirty(c); res(true, 'Налаштування збережено', A); pushClan(c);
        });

        on('clanChat', CHAT_GAP, (me, u, d) => {
            const A = 'chat', c = myClan(me); if (!c) return res(false, 'Ви не в клані', A);
            const text = str(d.text, 600).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_LEN);
            if (!text) return res(false, 'Порожнє повідомлення', A);
            const msg = { t: Date.now(), login: me, nick: nick(me), text };
            let arr = chats.get(c.id); if (!arr) chats.set(c.id, arr = []);
            arr.push(msg); if (arr.length > MAX_CHAT) arr.splice(0, arr.length - MAX_CHAT);
            Object.keys(c.members).forEach(k => emitTo(k, 'clanChatMsg', msg));
        });
    });

    // ---------- Експорт ----------
    ctx.hooks.clanTag = name => tagOf(name);
    ctx.Clans = {
        clanOf, tagOf, COST,
        _t: { clans, settle, claimAward, addPts, seasonNow, rankTick, ranking, get loaded() { return loaded; } }
    };
};
