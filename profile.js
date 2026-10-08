/* profile.js — профіль гравця, зміна імені/пароля, сезонний рейтинг, підсумки бою.
 *
 * Сокет (клієнт → сервер):
 *   getProfile {name?|pid?}        → 'profile' {…}         (без аргументів — свій профіль; для чужого — режим перегляду)
 *   changeNick {nick}              → 'nickResult' {ok,msg,nick,nextAt}
 *   changePassword {oldPassword,newPassword,confirm} → 'passwordResult' {ok,msg,token}
 *   getRanking {}                  → 'ranking' {season:{id,endsAt,now},kills:{rows,me},br:{rows,me},rewards}
 *   getNicks {names:[..]}          → 'nicks' {map:{LOGIN:{nick,clan}}}
 * Сокет (сервер → клієнт):
 *   'nickUpdate' {name,nick}       — хтось змінив ім'я (оновити NickCache)
 *   'profileToken' {token}         — новий токен (після зміни пароля), усім вкладкам акаунта
 *   'seasonReward' {seasonId,items:[{table,place,value,reward}],total}
 *   'matchSummary' {…}             — персональні підсумки бою (див. buildSummary)
 * Events: слухає 'kill', 'matchEnd', 'login'. Нічого не емітить.
 * ctx.Profile = { seasonId(), seasonEnd(), tables(), settle(), claim(login) } */
const crypto = require('crypto');

module.exports = function (ctx) {
    const { io, dbUsers, Events, GameData, ModeInfo, rooms, saveUser, sendEconomy, hashPwd } = ctx;
    const NAME_RE = ctx.NAME_RE;
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const now = () => Date.now();
    const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max || 64);

    // ---------- час сезону (Київ) ----------
    const TZ = process.env.ADVENT_TZ || 'Europe/Kiev';
    function tzParts(date) {
        const f = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
        const o = {}; f.formatToParts(date).forEach(p => { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
        return { year: o.year, month: o.month - 1, day: o.day, hour: o.hour, minute: o.minute, second: o.second };
    }
    function tzOffsetMs(date) { const p = tzParts(date); return Date.UTC(p.year, p.month, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000; }
    const pad2 = n => (n < 10 ? '0' : '') + n;
    function seasonIdAt(ms) { const p = tzParts(new Date(ms)); return p.year + '-' + pad2(p.month + 1); }
    function seasonEndAt(ms) {
        const p = tzParts(new Date(ms)), ny = p.month === 11 ? p.year + 1 : p.year, nm = (p.month + 1) % 12;
        const guess = Date.UTC(ny, nm, 1, 0, 0, 0), t = guess - tzOffsetMs(new Date(guess));
        return guess - tzOffsetMs(new Date(t));
    }
    const curId = () => seasonIdAt(now());

    // нагороди: місце → кредити (однакові для обох таблиць)
    const REWARDS = [[1, 500], [2, 300], [3, 200], [10, 100]];
    function rewardFor(place) { for (const [mx, v] of REWARDS) if (place <= mx) return v; return 0; }

    // ---------- сезонні лічильники ----------
    const snaps = Object.create(null);          // id → знімок підсумкового топу
    const settled = new Set();
    let snapsReady = !process.env.MONGO_URI;
    let snapsTried = false;
    function seasonsCol() { const db = ctx.getDb && ctx.getDb(); return db ? db.collection('seasons') : null; }
    function loadSnaps() {
        if (snapsReady || snapsTried) return;
        const c = seasonsCol(); if (!c) return;
        snapsTried = true;
        c.find({}).toArray().then(rows => { rows.forEach(r => { if (r && r.id) { snaps[r.id] = r; settled.add(r.id); } }); snapsReady = true; })
            .catch(e => { console.error('❌ seasons load', e && e.message); snapsTried = false; });
    }

    function freshSeason() { return { id: curId(), kills: 0, brWins: 0, t: 0 }; }
    function ensureSeason(u) {
        const cur = curId();
        if (!u.season || typeof u.season !== 'object' || typeof u.season.id !== 'string') { u.season = freshSeason(); return u.season; }
        if (u.season.id < cur) { settle(); u.season = freshSeason(); }
        return u.season;
    }

    function sortRows(rows) { return rows.sort((a, b) => b.v - a.v || a.t - b.t || (a.l < b.l ? -1 : 1)); }
    function collect(id) {
        const k = [], b = [];
        for (const l in dbUsers) {
            const u = dbUsers[l], s = u && u.season;
            if (!s || s.id !== id) continue;
            if (s.kills > 0) k.push({ l, v: s.kills | 0, t: s.t || 0 });
            if (s.brWins > 0) b.push({ l, v: s.brWins | 0, t: s.t || 0 });
        }
        return { k: sortRows(k), b: sortRows(b) };
    }

    // Закриття сезону(ів), що минули: знімок топу + запис нагород у u.seasonHistory (ідемпотентно).
    function settle() {
        if (!snapsReady) { loadSnaps(); return; }
        const cur = curId(), stale = new Set();
        for (const l in dbUsers) { const s = dbUsers[l] && dbUsers[l].season; if (s && typeof s.id === 'string' && s.id < cur && !settled.has(s.id)) stale.add(s.id); }
        [...stale].sort().forEach(id => {
            const t = collect(id), mk = rows => rows.slice(0, 10).map((r, i) => ({ login: r.l, place: i + 1, value: r.v, reward: rewardFor(i + 1) }));
            const snap = { _id: id, id, at: now(), kills: mk(t.k), br: mk(t.b) };
            snaps[id] = snap; settled.add(id);
            const c = seasonsCol(); if (c) c.replaceOne({ _id: id }, snap, { upsert: true }).catch(e => console.error('❌ seasons save', e && e.message));
            applyAwards(snap);
        });
        // знімки з БД, чиї нагороди могли не дійти до акаунтів
        Object.keys(snaps).forEach(id => { if (!snaps[id]._applied) applyAwards(snaps[id]); });
    }
    function applyAwards(snap) {
        snap._applied = true;
        const per = Object.create(null);
        ['kills', 'br'].forEach(tb => (snap[tb] || []).forEach(r => { if (!r.reward || !dbUsers[r.login]) return; (per[r.login] = per[r.login] || { kills: null, br: null })[tb] = r; }));
        for (const l in per) {
            const u = dbUsers[l]; if (!Array.isArray(u.seasonHistory)) u.seasonHistory = [];
            if (u.seasonHistory.some(h => h && h.id === snap.id)) continue;
            const k = per[l].kills, b = per[l].br;
            u.seasonHistory.push({ id: snap.id, kills: k ? { place: k.place, value: k.value, reward: k.reward } : null, br: b ? { place: b.place, value: b.value, reward: b.reward } : null, claimed: false });
            if (u.seasonHistory.length > 36) u.seasonHistory.splice(0, u.seasonHistory.length - 36);
            saveUser(l);
        }
    }
    // видача невидані нагород онлайн-гравцю
    function claim(login) {
        const u = dbUsers[login]; if (!u || !Array.isArray(u.seasonHistory)) return;
        let changed = false;
        u.seasonHistory.forEach(h => {
            if (!h || h.claimed) return;
            const items = [];
            if (h.kills && h.kills.reward) items.push({ table: 'kills', place: h.kills.place, value: h.kills.value, reward: h.kills.reward });
            if (h.br && h.br.reward) items.push({ table: 'br', place: h.br.place, value: h.br.value, reward: h.br.reward });
            const total = items.reduce((s, x) => s + x.reward, 0);
            h.claimed = true; changed = true;
            if (total > 0) {
                u.bucks += total; if (u.stats) u.stats.earned += total;
                ctx.onlineSocketsOf(login).forEach(sid => { io.to(sid).emit('seasonReward', { seasonId: h.id, items, total }); });
            }
        });
        if (changed) { saveUser(login); ctx.onlineSocketsOf(login).forEach(sid => sendEconomy(sid, login)); }
    }
    function claimOnline() { Object.keys(ctx.globalPlayers).forEach(sid => { const l = ctx.globalPlayers[sid]; if (l && dbUsers[l]) claim(l); }); }
    const tick = setInterval(() => { try { settle(); claimOnline(); } catch (e) { console.error('❌ season tick', e && e.message); } }, 30000);
    if (tick.unref) tick.unref();

    // ---------- рейтинг (кеш ~10 с) ----------
    let cache = null;
    function tables() {
        const t = now();
        if (cache && t - cache.t < 10000 && cache.id === curId()) return cache;
        settle();
        const id = curId(), c = collect(id);
        const rk = new Map(), rb = new Map();
        c.k.forEach((r, i) => rk.set(r.l, i + 1)); c.b.forEach((r, i) => rb.set(r.l, i + 1));
        cache = { t, id, k: c.k, b: c.b, rk, rb };
        return cache;
    }
    function nickOf(l) { return (dbUsers[l] && dbUsers[l].nick) || l; }
    function clanOf(l) { try { return (ctx.hooks.clanTag(l)) || ''; } catch (e) { return ''; } }
    function rowOut(r, i) { const u = dbUsers[r.l] || {}; return { place: i + 1, login: r.l, nick: nickOf(r.l), pid: u.pid || null, clan: clanOf(r.l), level: ctx.playerLevel(r.l), value: r.v }; }

    // ---------- допоміжне: пошук акаунта, профіль ----------
    function resolve(q) {
        if (q == null) return null;
        if (typeof q === 'object') { if (q.pid != null) return byPid(q.pid); return byName(q.name); }
        if (typeof q === 'number') return byPid(q);
        return byName(q);
    }
    function byPid(p) {
        const n = parseInt(p, 10); if (!Number.isFinite(n) || n <= 0) return null;
        for (const l in dbUsers) if (dbUsers[l] && dbUsers[l].pid === n) return l;
        return null;
    }
    function byName(s) {
        s = str(s, 40).trim(); if (!s) return null;
        if (has(dbUsers, s)) return s;
        const low = s.toLowerCase();
        for (const l in dbUsers) { if (l.toLowerCase() === low) return l; }
        for (const l in dbUsers) { const n = dbUsers[l] && dbUsers[l].nick; if (n && n.toLowerCase() === low) return l; }
        if (/^#?\d{1,9}$/.test(s)) return byPid(s.replace('#', ''));
        return null;
    }
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    function buildProfile(login, selfLogin) {
        const u = dbUsers[login]; if (!u) return null;
        const ps = (u.pstats && typeof u.pstats === 'object') ? u.pstats : null, st = u.stats || {};
        const modes = {}, mm = ps && ps.modes && typeof ps.modes === 'object' ? ps.modes : {};
        let fav = null, favG = 0;
        for (const k in mm) {
            if (!has(mm, k) || !mm[k]) continue;
            const g = num(mm[k].games); modes[k] = { games: g, wins: num(mm[k].wins) };
            if (g > favG) { favG = g; fav = k; }
        }
        let cases = 0; if (ps && ps.cases && typeof ps.cases === 'object') for (const k in ps.cases) cases += num(ps.cases[k]);
        const games = ps ? num(ps.games) : num(st.matches), wins = ps ? num(ps.wins) : 0, losses = ps ? num(ps.losses) : 0;
        const xp = num(u.xp), ss = ensureSeasonView(u);
        const sc = tables();
        const out = {
            self: login === selfLogin, login, nick: u.nick || '', pid: u.pid || null, clan: clanOf(login),
            level: GameData.levelFromXp(xp), xp, prog: GameData.levelProgress(xp), online: ctx.isOnline(login),
            equipped: { cannon: null, turret: null, hull: null, tracks: null },
            stats: { games, wins, losses, draws: ps ? num(ps.draws) : 0, kills: ps ? num(ps.kills) : num(st.kills), deaths: ps ? num(ps.deaths) : 0,
                playMs: ps ? num(ps.playMs) : 0, earned: num(st.earned), cases, favMode: fav, modes, brWins: ps ? num(ps.brWins) : 0, brKills: ps ? num(ps.brKills) : 0, hasP: !!ps },
            firstSeen: ps && ps.firstSeen ? num(ps.firstSeen) : 0,
            season: { id: ss.id, kills: ss.kills, brWins: ss.brWins, placeKills: sc.rk.get(login) || null, placeBr: sc.rb.get(login) || null },
            history: (Array.isArray(u.seasonHistory) ? u.seasonHistory : []).slice(-6).map(h => ({ id: h.id, kills: h.kills || null, br: h.br || null }))
        };
        const eq = u.equipped || {};
        ['cannon', 'turret', 'hull', 'tracks'].forEach(k => { out.equipped[k] = (typeof eq[k] === 'string' && ctx.MODULES[eq[k]]) ? eq[k] : null; });
        if (out.self) { out.nickNextAt = u.nickChangedAt ? u.nickChangedAt + NICK_CD : 0; out.nickChanges = u.nickChanges | 0; }
        return out;
    }
    function ensureSeasonView(u) { const s = u.season; return (s && s.id === curId()) ? s : { id: curId(), kills: 0, brWins: 0 }; }

    // ---------- ім'я ----------
    const NICK_CD = 24 * 3600 * 1000;
    const RESERVED = ['admin', 'administrator', 'moderator', 'system', 'server', 'bot', 'null', 'undefined'];
    function nameTaken(n, except) {
        const low = n.toLowerCase();
        if (RESERVED.includes(low)) return true;
        for (const l in dbUsers) {
            if (l === except) continue;
            if (l.toLowerCase() === low) return true;
            const k = dbUsers[l] && dbUsers[l].nick; if (k && k.toLowerCase() === low) return true;
        }
        const bn = ctx.botNames;
        if (bn && typeof bn.forEach === 'function') { let hit = false; bn.forEach(b => { if (typeof b === 'string' && b.toLowerCase() === low) hit = true; }); if (hit) return true; }
        return false;
    }
    function fmtLeft(ms) { const m = Math.ceil(ms / 60000), h = Math.floor(m / 60); return h > 0 ? h + ' год ' + (m % 60) + ' хв' : m + ' хв'; }

    // ---------- пароль: захист від перебору ----------
    const pwTries = Object.create(null);
    const PW_MAX = 5, PW_LOCK = 10 * 60 * 1000;

    // ---------- сокет ----------
    ctx.onConnection(socket => {
        const bucket = {};
        const limit = (k, ms) => { const t = now(); if (bucket[k] && t - bucket[k] < ms) return false; bucket[k] = t; return true; };

        socket.on('getProfile', d => {
            if (!limit('gp', 250)) return;
            const me = ctx.globalPlayers[socket.id]; if (!me || !dbUsers[me]) return;
            const own = d == null || (typeof d === 'object' && d.name == null && d.pid == null);
            const login = own ? me : resolve(d);
            if (own) { try { settle(); claim(me); } catch (e) {} }
            const p = login ? buildProfile(login, me) : null;
            socket.emit('profile', p || { error: 'Гравця не знайдено' });
        });

        socket.on('getNicks', d => {
            if (!limit('gn', 400)) return;
            if (!ctx.globalPlayers[socket.id] || !d || !Array.isArray(d.names)) return;
            const map = {};
            d.names.slice(0, 60).forEach(n => { n = str(n, 40); if (n && has(dbUsers, n)) map[n] = { nick: dbUsers[n].nick || '', clan: clanOf(n) }; });
            socket.emit('nicks', { map });
        });

        socket.on('changeNick', d => {
            const me = ctx.globalPlayers[socket.id], u = me && dbUsers[me];
            const fail = msg => socket.emit('nickResult', { ok: false, msg });
            if (!u) return;
            if (!limit('cn', 1200)) return fail('Забагато запитів, зачекайте секунду');
            const n = str(d && d.nick, 40).trim();
            if (!NAME_RE.test(n)) return fail('Ім\'я: 3–12 символів (літери, цифри, _ -)');
            if (u.nick === n) return fail('Це ім\'я вже ваше');
            const t = now();
            if (u.nickChangedAt && t - u.nickChangedAt < NICK_CD) return fail('Змінювати ім\'я можна раз на 24 години. Спробуйте через ' + fmtLeft(NICK_CD - (t - u.nickChangedAt)));
            if (nameTaken(n, me)) return fail('Це ім\'я вже зайняте');
            u.nick = n; u.nickChangedAt = t; u.nickChanges = (u.nickChanges | 0) + 1;
            saveUser(me);
            for (const rid in rooms) {
                const r = rooms[rid]; let hit = false;
                for (const pid in r.players) if (r.players[pid].name === me) { r.players[pid].nick = n; hit = true; }
                if (hit && r.status === 'lobby') io.to(rid).emit('updateLobby', r);
            }
            cache = null;
            ctx.pushRooms();
            socket.emit('nickResult', { ok: true, msg: 'Ім\'я змінено', nick: n, nextAt: t + NICK_CD });
            io.emit('nickUpdate', { name: me, nick: n });
        });

        socket.on('changePassword', d => {
            const me = ctx.globalPlayers[socket.id], u = me && dbUsers[me];
            const fail = msg => socket.emit('passwordResult', { ok: false, msg });
            if (!u) return;
            if (!limit('cp', 1000)) return fail('Забагато запитів, зачекайте секунду');
            const t = now(), tr = pwTries[me] || (pwTries[me] = { n: 0, until: 0 });
            if (tr.until > t) return fail('Забагато невдалих спроб. Спробуйте через ' + fmtLeft(tr.until - t));
            if (!d || typeof d.oldPassword !== 'string' || typeof d.newPassword !== 'string') return fail('Заповніть усі поля');
            const op = d.oldPassword.slice(0, 200), np = d.newPassword, cf = typeof d.confirm === 'string' ? d.confirm : '';
            if (!op || !np) return fail('Заповніть усі поля');
            if (np.length < 4 || np.length > 128) return fail('Новий пароль: від 4 до 128 символів');
            if (np !== cf) return fail('Підтвердження не збігається з новим паролем');
            if (u.password !== hashPwd(op)) {
                tr.n++; if (tr.n >= PW_MAX) { tr.n = 0; tr.until = t + PW_LOCK; return fail('Забагато невдалих спроб. Спробуйте через ' + fmtLeft(PW_LOCK)); }
                return fail('Старий пароль невірний (залишилось спроб: ' + (PW_MAX - tr.n) + ')');
            }
            if (op === np) return fail('Новий пароль збігається зі старим');
            tr.n = 0; tr.until = 0;
            u.password = hashPwd(np); u.token = crypto.randomUUID();
            saveUser(me);
            socket.emit('passwordResult', { ok: true, msg: 'Пароль змінено', token: u.token });
            ctx.onlineSocketsOf(me).forEach(sid => { if (sid !== socket.id) io.to(sid).emit('profileToken', { token: u.token }); });
        });

        socket.on('getRanking', () => {
            if (!limit('gr', 800)) return;
            const me = ctx.globalPlayers[socket.id]; if (!me || !dbUsers[me]) return;
            const c = tables(), s = ensureSeasonView(dbUsers[me]);
            const mine = (rk, v) => ({ place: rk.get(me) || null, value: v });
            const t = now();
            socket.emit('ranking', {
                season: { id: c.id, endsAt: seasonEndAt(t), now: t },
                kills: { rows: c.k.slice(0, 50).map(rowOut), me: mine(c.rk, s.kills) },
                br: { rows: c.b.slice(0, 50).map(rowOut), me: mine(c.rb, s.brWins) },
                rewards: REWARDS.map(r => ({ upTo: r[0], credits: r[1] }))
            });
        });
    });

    // ---------- події ----------
    Events.on('kill', e => {
        try {
            if (!e || e.killerBot || typeof e.killerName !== 'string' || !has(dbUsers, e.killerName)) return;
            const u = dbUsers[e.killerName]; if (!u) return;
            const s = ensureSeason(u); s.kills++; s.t = now();
        } catch (er) { console.error('❌ profile kill', er && er.message); }
    });

    const modeName = m => { try { const i = ModeInfo.MODES[m]; return i ? { n: i.n, e: i.e } : { n: String(m || ''), e: '🎮' }; } catch (e) { return { n: String(m || ''), e: '🎮' }; } };
    function buildSummary(ev, p) {
        const u = dbUsers[p.name]; if (!u) return null;
        const xo = (p.xp && typeof p.xp === 'object') ? p.xp : null;
        const gain = Math.max(0, xo ? num(xo.gain) : num(p.xp)), after = xo && typeof xo.after === 'number' ? xo.after : num(u.xp), before = xo && typeof xo.before === 'number' ? xo.before : Math.max(0, after - gain);
        const lb = GameData.levelFromXp(before), la = GameData.levelFromXp(after), pr = GameData.levelProgress(after);
        const mi = modeName(ev.mode), total = Array.isArray(ev.players) ? ev.players.length : 0;
        let board = (ev.players || []).map(q => ({ name: q.isBot ? String(q.name) : nickOf(q.name), me: q === p, bot: !!q.isBot, kills: num(q.kills), deaths: num(q.deaths), outcome: q.outcome, place: q.place || 0 }));
        board.sort((a, b) => (a.place && b.place ? a.place - b.place : 0) || b.kills - a.kills);
        board = board.slice(0, 8);
        return {
            mode: ev.mode, modeName: mi.n, modeEmoji: mi.e, outcome: p.outcome === 'win' || p.outcome === 'draw' ? p.outcome : 'loss',
            place: p.place || 0, players: total, kills: num(p.kills), deaths: num(p.deaths), credits: num(p.credits), xp: gain,
            xpBefore: before, xpAfter: after, lvlBefore: lb, lvlAfter: la, level: la, rank: GameData.LEVEL_NAMES[la - 1],
            toNext: pr.max ? 0 : Math.max(0, GameData.LEVEL_XP[la] - after), maxLevel: !!pr.max, dropped: typeof p.dropped === 'string' ? p.dropped : null,
            durationMs: num(ev.durationMs), board, at: now()
        };
    }
    Events.on('matchEnd', ev => {
        try {
            if (!ev || !Array.isArray(ev.players)) return;
            // sockets рахуємо одразу, а відправляємо наступним тиком: до того моменту модулі встигають виставити xp/кредити
            const room = rooms[ev.roomId], sockOf = {};
            if (room) for (const sid in room.players) sockOf[room.players[sid].name] = sid;
            ev.players.forEach(p => {
                if (!p || p.isBot || typeof p.name !== 'string' || !has(dbUsers, p.name)) return;
                if (ev.mode === 'battle_royale' && p.outcome === 'win') { const s = ensureSeason(dbUsers[p.name]); s.brWins++; s.t = now(); saveUser(p.name); }
                setTimeout(() => {
                    try {
                        const sm = buildSummary(ev, p); if (!sm) return;
                        const ids = sockOf[p.name] ? [sockOf[p.name]] : ctx.onlineSocketsOf(p.name);
                        ids.forEach(sid => io.to(sid).emit('matchSummary', sm));
                    } catch (er) { console.error('❌ matchSummary', er && er.message); }
                }, 0);
            });
        } catch (er) { console.error('❌ profile matchEnd', er && er.message); }
    });
    Events.on('login', e => { try { if (e && dbUsers[e.name]) { settle(); claim(e.name); } } catch (er) {} });

    ctx.Profile = { seasonId: curId, seasonEnd: () => seasonEndAt(now()), tables, settle, claim, ensureSeason, REWARDS, buildProfile };
};
