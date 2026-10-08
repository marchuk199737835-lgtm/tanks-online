/* progress.js — серверний модуль прогресу: щоденний бонус (серія 7 днів), щоденні завдання, досягнення, статистика акаунта.
 * Підключається з server.js: module.exports = function (ctx) { ... }. Усі нагороди й лічильники рахуються тільки тут (клієнту не довіряємо).
 *
 * Дані акаунта (зберігаються разом з u автоматично):
 *   u.pstats = { games, wins, losses, draws, kills, deaths, playMs, modes:{[mode]:{games,wins}}, cases:{[caseId]:n}, brWins, brKills, upOk, upFail, firstSeen, ...службові }
 *   u.daily  = { last:<ключ дня>, day:<1..7 останній отриманий>, caseId, total, cycles }
 *   u.quests = { day:<ключ дня>, list:[{t,a,goal,reward,p,c,seen}], rerolled, prev:[ids] }
 *   u.ach    = { done:{id:ts}, claimed:{id:ts} }
 *
 * Сокет (клієнт → сервер): getProgress, claimDaily, claimQuest(i), rerollQuest(i), claimAch(id)
 * Сокет (сервер → клієнт): progressState, dailyClaimed, questProgress, questClaimed, questRerolled, achUnlocked, achClaimed, progressError
 */
'use strict';
const OP = Object.prototype;
const has = (o, k) => OP.hasOwnProperty.call(o, k);

module.exports = function (ctx) {
    const { io, dbUsers, Events, GameData, MODULES, CASES, ModeInfo, saveUser, sendEconomy } = ctx;
    const TZ = process.env.ADVENT_TZ || 'Europe/Kiev';
    const DAY_MS = 86400000;

    // ---------- час (за Києвом) ----------
    const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    function parts(ms) {
        const o = {}; fmt.formatToParts(new Date(ms)).forEach(p => { if (p.type !== 'literal') o[p.type] = parseInt(p.value, 10); });
        return o;
    }
    function dayKey(ms) { const p = parts(ms); return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / DAY_MS); }
    function nextMidnight(ms) { const p = parts(ms); return ms - (ms % 1000) + (86400 - (p.hour * 3600 + p.minute * 60 + p.second)) * 1000; }

    // ---------- дрібні утиліти ----------
    const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0) ? v : (d || 0);
    function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return h >>> 0; }
    function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];
    const humanU = name => (typeof name === 'string' && has(dbUsers, name)) ? dbUsers[name] : null;
    const sockets = name => ctx.onlineSocketsOf(name);
    const toUser = (name, ev, data) => sockets(name).forEach(id => io.to(id).emit(ev, data));
    const syncEco = name => sockets(name).forEach(id => sendEconomy(id, name));
    const modeName = m => (ModeInfo.MODES && ModeInfo.MODES[m] && ModeInfo.MODES[m].n) || m;
    const MODE_SET = new Set(ModeInfo.ORDER);
    const WEAPONS = new Set(['normal', 'explosive', 'fast', 'piercing', 'homing', 'shotgun', 'minigun', 'incendiary', 'samurai', 'melee', 'acid', 'hunter_gun', 'boss_proj', 'mine', 'laser']);

    // відкладене збереження (часті події в бою не б'ють по БД)
    const pending = new Map();
    function touch(name) {
        if (pending.has(name)) return;
        pending.set(name, setTimeout(() => { pending.delete(name); if (dbUsers[name]) saveUser(name); }, 4000));
    }
    function flush(name) { const t = pending.get(name); if (t) { clearTimeout(t); pending.delete(name); } if (dbUsers[name]) saveUser(name); }

    // ---------- СТАТИСТИКА ----------
    const NUMS = ['games', 'wins', 'losses', 'draws', 'kills', 'deaths', 'playMs', 'brWins', 'brKills', 'upOk', 'upFail',
        'equips', 'sells', 'freeCases', 'curStreak', 'bestStreak', 'mkAny', 'mkPierce', 'brTop3', 'brNoMods', 'questsDone', 'bestMatchKills'];
    function ensureStats(u) {
        const fresh = !u.pstats || typeof u.pstats !== 'object';
        const s = fresh ? (u.pstats = {}) : u.pstats;
        NUMS.forEach(k => { s[k] = num(s[k]); });
        ['modes', 'cases', 'kw'].forEach(k => { if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = {}; });
        if (fresh && u.stats) { s.kills = num(u.stats.kills); s.games = num(u.stats.matches); }     // історія існуючих акаунтів
        if (!(typeof s.firstSeen === 'number' && s.firstSeen > 0)) s.firstSeen = Date.now();
        return s;
    }
    function modeRec(s, m) {
        if (!MODE_SET.has(m)) return null;
        let r = has(s.modes, m) ? s.modes[m] : null;
        if (!r || typeof r !== 'object') r = s.modes[m] = { games: 0, wins: 0 };
        r.games = num(r.games); r.wins = num(r.wins);
        return r;
    }
    const getStats = name => { const u = humanU(name); return u ? ensureStats(u) : null; };
    function addCredits(name, n) {
        const u = humanU(name); n = Math.floor(+n); if (!u || !(n > 0)) return false;
        u.bucks += n; u.stats.earned += n; flush(name); syncEco(name); return true;
    }

    // ---------- ЩОДЕННИЙ БОНУС ----------
    const DAILY = [30, 40, 60, 80, 110, 130, 150];              // сума = 600 кредитів за цикл; на 7-й день додатково кейс
    const DAILY_CASE_MIN = 600, DAILY_CASE_MAX = 1250;
    const dailyCases = () => Object.keys(CASES).map(Number).filter(id => CASES[id].price >= DAILY_CASE_MIN && CASES[id].price <= DAILY_CASE_MAX);
    function ensureDaily(u) {
        let d = u.daily;
        if (!d || typeof d !== 'object') d = u.daily = {};
        d.last = num(d.last); d.day = Math.max(0, Math.min(7, Math.floor(num(d.day)))); d.total = num(d.total); d.cycles = num(d.cycles);
        const ok = id => has(CASES, id) && CASES[id].price >= DAILY_CASE_MIN && CASES[id].price <= DAILY_CASE_MAX;
        if (!ok(d.caseId)) { const c = dailyCases(); d.caseId = c.length ? c[Math.floor(Math.random() * c.length)] : 0; }
        return d;
    }
    function dailyView(u, now) {
        const d = ensureDaily(u), today = dayKey(now), claimedToday = d.last === today;
        let cur, streak;
        if (claimedToday) { cur = d.day; streak = d.day; }
        else if (d.last === today - 1 && d.day >= 1) { cur = d.day % 7 + 1; streak = d.day; }
        else { cur = 1; streak = 0; }
        const cs = CASES[d.caseId];
        return { cur, claimedToday, streak, rewards: DAILY, canClaim: !claimedToday, caseId: d.caseId, caseName: cs ? cs.name : '', casePrice: cs ? cs.price : 0, caseColor: cs ? cs.color : '#fbbf24', total: d.total, today };
    }
    function claimDaily(name, now) {
        const u = humanU(name); if (!u) return { ok: false, msg: 'Спершу увійдіть в акаунт' };
        const v = dailyView(u, now), d = u.daily;
        if (v.claimedToday) return { ok: false, msg: 'Сьогоднішній бонус уже отримано' };
        const idx = v.cur, credits = DAILY[idx - 1];
        let modId = null;
        if (idx === 7) {
            if (u.inventory.length >= 30) return { ok: false, msg: 'Інвентар повний (макс 30)! Звільніть місце для кейса' };
            modId = ctx.getRandomModuleFromCase(d.caseId);
            if (!modId) return { ok: false, msg: 'Не вдалося відкрити кейс, спробуйте ще раз' };
        }
        const caseId = d.caseId;
        u.bucks += credits; u.stats.earned += credits;
        d.last = v.today; d.day = idx; d.total++;
        if (idx === 7) { d.cycles++; d.caseId = 0; u.inventory.push(modId); }
        ensureStats(u);
        flush(name);
        return { ok: true, idx, credits, caseId: idx === 7 ? caseId : 0, modId, bucks: u.bucks };
    }

    // ---------- ЩОДЕННІ ЗАВДАННЯ ----------
    const caseIdsBy = (lo, hi) => Object.keys(CASES).map(Number).filter(id => CASES[id].price >= lo && CASES[id].price <= hi && CASES[id].price <= 340);
    const isPve = m => ModeInfo.isPve(m), isSolo = m => ModeInfo.isSolo(m);
    const isTeam = m => m === 'team_deathmatch' || m === 'capture_points';
    const mePl = (e, p) => p; // читабельність
    const killIf = (cond, wpn) => ({ kill: (q, e) => (cond(e) && (!wpn || e.weapon === wpn)) ? 1 : 0 });
    function T(id, cat, ico, goal, reward, text, on, param) { return { id, cat, ico, goal, reward: typeof reward === 'function' ? reward : (() => reward), text, on: on || {}, param }; }
    const QT_LIST = [
        // --- бої ---
        T('win1', 'play', '🏆', 1, 25, () => 'Виграй 1 бій', { matchEnd: (q, e, p) => p.outcome === 'win' ? 1 : 0 }),
        T('win2', 'play', '🏆', 2, 45, () => 'Виграй 2 бої', { matchEnd: (q, e, p) => p.outcome === 'win' ? 1 : 0 }),
        T('play3', 'play', '🎮', 3, 30, () => 'Зіграй 3 матчі', { matchEnd: () => 1 }),
        T('modes3', 'play', '🧭', 3, 50, () => 'Зіграй у 3 різних режимах', { matchEnd: (q, e) => { if (q.seen.includes(e.mode)) return 0; q.seen.push(e.mode); return 1; } }),
        T('pvp2', 'play', '⚔️', 2, 35, () => 'Зіграй 2 матчі проти гравців', { matchEnd: (q, e) => isPve(e.mode) ? 0 : 1 }),
        T('pve_win', 'play', '🧟', 1, 40, () => 'Виграй 1 бій проти зомбі чи босів', { matchEnd: (q, e, p) => (isPve(e.mode) && p.outcome === 'win') ? 1 : 0 }),
        T('hide1', 'play', '📦', 1, 30, () => 'Зіграй матч у «' + modeName('prophunt') + '»', { matchEnd: (q, e) => e.mode === 'prophunt' ? 1 : 0 }),
        // --- вбивства ---
        T('k10', 'kills', '🎯', 10, 35, () => 'Зроби 10 вбивств', killIf(() => true)),
        T('k_dm', 'kills', '💥', 8, 35, () => 'Зроби 8 вбивств у режимі «' + modeName('deathmatch') + '»', killIf(e => e.mode === 'deathmatch')),
        T('k_tdm', 'kills', '🛡️', 6, 35, () => 'Зроби 6 вбивств у режимі «' + modeName('team_deathmatch') + '»', killIf(e => e.mode === 'team_deathmatch')),
        T('k_br', 'kills', '🔥', 10, 60, () => 'Зроби 10 вбивств у королівській битві', killIf(e => e.mode === 'battle_royale')),
        T('k_bnt', 'kills', '💰', 5, 35, () => 'Зроби 5 вбивств у режимі «' + modeName('bounty') + '»', killIf(e => e.mode === 'bounty')),
        T('k_expl', 'kills', '🧨', 3, 40, () => 'Знищ 3 гравців вибуховими снарядами', killIf(() => true, 'explosive')),
        T('k_pierce', 'kills', '🗡️', 3, 45, () => 'Знищ 3 гравців бронебійними снарядами', killIf(() => true, 'piercing')),
        T('k_homing', 'kills', '🚀', 3, 45, () => 'Знищ 3 гравців самонавідними ракетами', killIf(() => true, 'homing')),
        T('k_fire', 'kills', '🔥', 2, 40, () => 'Спали 2 гравців запальними снарядами', killIf(() => true, 'incendiary')),
        // --- режими ---
        T('waves5', 'mode', '🌊', 5, 40, () => 'Відбий 5 хвиль у режимах проти зомбі', { matchEnd: (q, e) => (isPve(e.mode) && e.waves > 0) ? e.waves : 0 }),
        T('caps3', 'mode', '🚩', 3, 40, () => 'Захопи 3 точки у «' + modeName('capture_points') + '»', { matchEnd: (q, e, p) => e.mode === 'capture_points' ? (p.caps | 0) : 0 }),
        T('br_top3', 'mode', '👑', 1, 50, () => 'Увійди в трійку найкращих у королівській битві', { matchEnd: (q, e, p) => (e.mode === 'battle_royale' && p.place <= 3) ? 1 : 0 }),
        T('boss1', 'mode', '🐲', 1, 60, () => 'Переможи боса: виграй рейд або дуель', { matchEnd: (q, e, p) => ((e.mode === 'boss_raid' || e.mode === 'boss_duel') && p.outcome === 'win') ? 1 : 0 }),
        T('team_win', 'mode', '🤝', 1, 45, () => 'Виграй командний бій', { matchEnd: (q, e, p) => (isTeam(e.mode) && p.outcome === 'win') ? 1 : 0 }),
        // --- економіка ---
        T('case_a', 'eco', '📦', 1, a => CASES[a] ? CASES[a].price : 65, a => 'Відкрий кейс «' + (CASES[a] ? CASES[a].name : '?') + '»', { caseOpened: (q, e) => (!e.fromLevel && e.caseId === q.a) ? 1 : 0 }, rnd => pick(caseIdsBy(0, 140), rnd)),
        T('case_b', 'eco', '🎁', 1, a => CASES[a] ? CASES[a].price : 175, a => 'Відкрий кейс «' + (CASES[a] ? CASES[a].name : '?') + '»', { caseOpened: (q, e) => (!e.fromLevel && e.caseId === q.a) ? 1 : 0 }, rnd => pick(caseIdsBy(141, 340), rnd)),
        T('upg1', 'eco', '⚗️', 1, 30, () => 'Спробуй покращити модуль в апгрейдері', { upgradeDone: () => 1 }),
        T('upg_ok', 'eco', '✨', 1, 60, () => 'Успішно покращ модуль в апгрейдері', { upgradeDone: (q, e) => e.win ? 1 : 0 }),
        T('equip1', 'eco', '🔧', 1, 15, () => 'Екіпіруй модуль на танк', { moduleEquipped: () => 1 }),
        T('sell1', 'eco', '💱', 1, 15, () => 'Продай модуль', { moduleSold: () => 1 })
    ];
    const QT = Object.create(null); QT_LIST.forEach(t => { QT[t.id] = t; });
    const QCATS = ['play', 'kills', 'mode', 'eco'];

    function mkQuest(t, rnd) {
        const a = t.param ? t.param(rnd) : null;
        return { t: t.id, a, goal: t.goal, reward: t.reward(a), p: 0, c: 0, seen: [] };
    }
    function genQuests(u, name, today) {
        const rnd = rngOf(hash(name + '|' + today)), prev = (u.quests && Array.isArray(u.quests.list)) ? u.quests.list.map(q => q.t) : [];
        const cats = QCATS.slice();
        for (let i = cats.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = cats[i]; cats[i] = cats[j]; cats[j] = x; }
        const list = cats.slice(0, 3).map(c => {
            let pool = QT_LIST.filter(t => t.cat === c && !prev.includes(t.id)); if (!pool.length) pool = QT_LIST.filter(t => t.cat === c);
            return mkQuest(pick(pool, rnd), rnd);
        });
        return { day: today, list, rerolled: 0 };
    }
    function ensureQuests(u, name, now) {
        const today = dayKey(now), q = u.quests;
        if (!q || typeof q !== 'object' || q.day !== today || !Array.isArray(q.list)) u.quests = genQuests(u, name, today);
        else q.list = q.list.filter(x => x && has(QT, x.t)).slice(0, 3);
        const Q = u.quests;
        Q.list.forEach(x => { x.p = num(x.p); x.goal = Math.max(1, num(x.goal, 1)); x.reward = num(x.reward); x.c = x.c ? 1 : 0; if (!Array.isArray(x.seen)) x.seen = []; });
        return Q;
    }
    const questView = (q, i) => { const t = QT[q.t]; return { i, t: q.t, ico: t.ico, text: t.text(q.a), goal: q.goal, p: Math.min(q.p, q.goal), reward: q.reward, done: q.p >= q.goal, claimed: !!q.c, cat: t.cat }; };
    const questsFor = name => { const u = humanU(name); if (!u) return []; return ensureQuests(u, name, Date.now()).list.map(questView); };

    // ---------- ДОСЯГНЕННЯ ----------
    const lvlOf = u => GameData.levelFromXp(u.xp || 0);
    const modeWins = (s, ...ms) => ms.reduce((a, m) => a + (has(s.modes, m) && s.modes[m] ? num(s.modes[m].wins) : 0), 0);
    const winModes = s => Object.keys(s.modes).filter(m => MODE_SET.has(m) && s.modes[m] && num(s.modes[m].wins) > 0).length;
    const caseKinds = s => Object.keys(s.cases).filter(k => has(CASES, k) && num(s.cases[k]) > 0).length;
    const kwOf = (s, w) => (has(s.kw, w) ? num(s.kw[w]) : 0);
    // tier: easy | medium | hard | legend ; cat — для фільтра в інтерфейсі
    function A(id, tier, cat, ico, name, desc, goal, prog, c, caseId) { return { id, tier, cat, ico, name, desc, goal, prog, reward: { c, caseId: caseId || 0 } }; }
    const ACH = [
        // легкі
        A('first_blood', 'easy', 'combat', '🩸', 'Перша кров', 'Знищ свого першого супротивника', 1, (s) => s.kills, 15),
        A('first_win', 'easy', 'battle', '🏁', 'Смак перемоги', 'Здобудь першу перемогу в бою', 1, (s) => s.wins, 20),
        A('wins_10', 'easy', 'battle', '🥉', 'Звичка перемагати', 'Виграй 10 боїв', 10, (s) => s.wins, 50),
        A('trader', 'easy', 'eco', '💱', 'Торговець', 'Продай 5 модулів', 5, (s) => s.sells, 40),
        A('daily3', 'easy', 'misc', '📅', 'Постійний гість', 'Отримай щоденний бонус 3 рази', 3, (s, u) => num(u.daily && u.daily.total), 40),
        A('quest3', 'easy', 'misc', '📋', 'Трудяга', 'Виконай 3 щоденні завдання', 3, (s) => s.questsDone, 50),
        A('upg_try', 'easy', 'eco', '🎲', 'Іскра азарту', 'Зроби 5 спроб апгрейду модулів', 5, (s) => s.upOk + s.upFail, 40),
        // середні
        A('koko', 'medium', 'combat', '💀', 'Вбивця КОКО', 'Знищ 100 гравців', 100, (s) => s.kills, 150),
        A('double', 'medium', 'combat', '✌️', 'Дубль', 'Знищ двох гравців одним снарядом', 1, (s) => s.mkAny, 100),
        A('boom', 'medium', 'combat', '💥', 'Підривник', 'Знищ 25 гравців вибуховими снарядами', 25, (s) => kwOf(s, 'explosive'), 120),
        A('homing', 'medium', 'combat', '🎯', 'Невідворотність', 'Знищ 15 гравців самонавідними ракетами', 15, (s) => kwOf(s, 'homing'), 120),
        A('br_win', 'medium', 'br', '👑', 'Король острова', 'Виграй королівський бій', 1, (s) => s.brWins, 150),
        A('streak3', 'medium', 'battle', '⚡', 'Гаряча серія', 'Виграй 3 бої поспіль', 3, (s) => s.bestStreak, 120),
        A('opener', 'medium', 'eco', '🧰', 'Відкривач нового', 'Відкрий 10 різних кейсів', 10, (s) => caseKinds(s), 180),
        A('games100', 'medium', 'battle', '🎖️', 'Ветеран боїв', 'Зіграй 100 матчів', 100, (s) => s.games, 150),
        A('lvl8', 'medium', 'misc', '⭐', 'Старший офіцер', 'Досягни 8 рівня', 8, (s, u) => lvlOf(u), 150),
        A('modes5', 'medium', 'battle', '🧭', 'Універсал', 'Здобудь перемоги у 5 різних режимах', 5, (s) => winModes(s), 200),
        A('upg_ok', 'medium', 'eco', '⚗️', 'Алхімік', 'Успішно покращ модулі 5 разів', 5, (s) => s.upOk, 150),
        // складні
        A('pierce', 'hard', 'combat', '🗡️', 'Прокол', 'Знищ двох гравців одним пострілом бронебійного снаряда', 1, (s) => s.mkPierce, 250),
        A('kills500', 'hard', 'combat', '☠️', 'Жнець', 'Знищ 500 гравців', 500, (s) => s.kills, 250),
        A('wins50', 'hard', 'battle', '🏆', 'Чемпіон', 'Виграй 50 боїв', 50, (s) => s.wins, 300),
        A('streak7', 'hard', 'battle', '🌪️', 'Невловимий', 'Виграй 7 боїв поспіль', 7, (s) => s.bestStreak, 350),
        A('br_nomods', 'hard', 'br', '🛡️', 'Голі гусениці', 'Виграй королівський бій, не підібравши жодного модуля', 1, (s) => s.brNoMods, 350),
        A('br_kills', 'hard', 'br', '🦅', 'Хижак зони', 'Зроби 40 вбивств у королівському бою', 40, (s) => s.brKills, 200),
        A('boss', 'hard', 'battle', '🐲', 'Вбивця босів', 'Переможи в рейді на боса чи дуелі з босом 3 рази', 3, (s) => modeWins(s, 'boss_raid', 'boss_duel'), 250),
        A('week7', 'hard', 'misc', '📆', 'Тиждень без пропусків', 'Забери щоденний бонус 7 днів поспіль', 1, (s, u) => num(u.daily && u.daily.cycles), 200),
        // легендарні
        A('kills2000', 'legend', 'combat', '🌋', 'Танковий апокаліпсис', 'Знищ 2000 гравців', 2000, (s) => s.kills, 500, 14),
        A('wins200', 'legend', 'battle', '🔱', 'Незламний', 'Виграй 200 боїв', 200, (s) => s.wins, 600, 16),
        A('modes10', 'legend', 'battle', '🌐', 'Майстер усіх режимів', 'Здобудь перемоги в 10 різних режимах', 10, (s) => winModes(s), 700, 20),
        A('lvl15', 'legend', 'misc', '💎', 'Легенда полігону', 'Досягни максимального рівня', GameData.MAX_LEVEL, (s, u) => lvlOf(u), 400, 15)
    ];
    if (ACH.length !== 30) throw new Error('Очікується рівно 30 досягнень, зараз ' + ACH.length);
    const ACH_BY = Object.create(null); ACH.forEach(a => { ACH_BY[a.id] = a; });
    const TIER_RARITY = { easy: 'common', medium: 'rare', hard: 'epic', legend: 'legendary' };

    function ensureAch(u) {
        if (!u.ach || typeof u.ach !== 'object') u.ach = {};
        ['done', 'claimed'].forEach(k => { if (!u.ach[k] || typeof u.ach[k] !== 'object' || Array.isArray(u.ach[k])) u.ach[k] = {}; });
        return u.ach;
    }
    function checkAch(name, u) {
        const s = ensureStats(u), A_ = ensureAch(u), fresh = [];
        ACH.forEach(a => {
            if (has(A_.done, a.id)) return;
            if (num(a.prog(s, u)) >= a.goal) { A_.done[a.id] = Date.now(); fresh.push(a); }
        });
        if (fresh.length) {
            touch(name);
            fresh.forEach(a => toUser(name, 'achUnlocked', achMeta(a, u)));
            pushState(name, 'ach');
        }
        return fresh;
    }
    function achMeta(a, u) {
        const A_ = ensureAch(u), s = ensureStats(u), p = Math.min(a.goal, num(a.prog(s, u))), cs = a.reward.caseId ? CASES[a.reward.caseId] : null;
        return { id: a.id, tier: a.tier, cat: a.cat, rarity: TIER_RARITY[a.tier], ico: a.ico, name: a.name, desc: a.desc, goal: a.goal, p,
            done: has(A_.done, a.id), claimed: has(A_.claimed, a.id), reward: { c: a.reward.c, caseId: a.reward.caseId, caseName: cs ? cs.name : '', caseColor: cs ? cs.color : '' } };
    }
    function claimAch(name, id) {
        const u = humanU(name); if (!u) return { ok: false, msg: 'Спершу увійдіть в акаунт' };
        const a = (typeof id === 'string' && has(ACH_BY, id)) ? ACH_BY[id] : null; if (!a) return { ok: false, msg: 'Невідоме досягнення' };
        const A_ = ensureAch(u); checkAch(name, u);
        if (!has(A_.done, a.id)) return { ok: false, msg: 'Досягнення ще не відкрито' };
        if (has(A_.claimed, a.id)) return { ok: false, msg: 'Нагороду вже отримано' };
        let modId = null;
        if (a.reward.caseId) {
            if (u.inventory.length >= 30) return { ok: false, msg: 'Інвентар повний (макс 30)! Звільніть місце для кейса' };
            modId = ctx.getRandomModuleFromCase(a.reward.caseId);
            if (!modId) return { ok: false, msg: 'Не вдалося відкрити кейс, спробуйте ще раз' };
            u.inventory.push(modId);
        }
        A_.claimed[a.id] = Date.now();
        u.bucks += a.reward.c; u.stats.earned += a.reward.c;
        flush(name);
        return { ok: true, a, modId, credits: a.reward.c, caseId: a.reward.caseId, bucks: u.bucks };
    }

    // ---------- ЗВЕДЕНИЙ СТАН ДЛЯ КЛІЄНТА ----------
    function stateOf(name) {
        const u = humanU(name); if (!u) return null;
        const now = Date.now(), dv = dailyView(u, now), Q = ensureQuests(u, name, now), A_ = ensureAch(u);
        const quests = Q.list.map(questView), ach = ACH.map(a => achMeta(a, u));
        const badge = { daily: dv.canClaim ? 1 : 0, quests: quests.filter(q => q.done && !q.claimed).length, ach: ach.filter(a => a.done && !a.claimed).length };
        return { now, next: nextMidnight(now), daily: dv, quests, rerolled: Q.rerolled ? 1 : 0, ach, badge };
    }
    function pushState(name, why) { const st = stateOf(name); if (st) { st.why = why || ''; toUser(name, 'progressState', st); } }

    // ---------- ОБРОБКА ПОДІЙ ----------
    function bumpQuests(name, u, evName, e, pl) {
        const Q = ensureQuests(u, name, Date.now()); let any = false;
        Q.list.forEach((q, i) => {
            if (q.c || q.p >= q.goal) return;
            const t = QT[q.t], f = t && t.on[evName]; if (!f) return;
            let n = 0; try { n = f(q, e, pl) | 0; } catch (err) { n = 0; }
            if (n <= 0) return;
            q.p = Math.min(q.goal, q.p + n); any = true;
            const done = q.p >= q.goal;
            if (done) ensureStats(u).questsDone++;
            toUser(name, 'questProgress', { i, p: q.p, goal: q.goal, done, text: t.text(q.a), reward: q.reward, ico: t.ico });
        });
        if (any) touch(name);
        return any;
    }
    const safe = fn => function (e) { try { fn(e || {}); } catch (err) { console.error('❌ progress:', err && err.stack || err); } };

    Events.on('login', safe(e => {
        const u = humanU(e.name); if (!u) return;
        ensureStats(u); ensureDaily(u); ensureQuests(u, e.name, Date.now()); ensureAch(u);
        checkAch(e.name, u);
        touch(e.name);
        const st = stateOf(e.name); if (st) { st.why = 'login'; io.to(e.socketId).emit('progressState', st); }
    }));
    Events.on('logout', safe(e => { if (pending.has(e.name)) flush(e.name); }));

    Events.on('kill', safe(e => {
        const k = (!e.killerBot && e.killerName !== e.victimName) ? humanU(e.killerName) : null;
        const v = !e.victimBot ? humanU(e.victimName) : null;
        if (v) { ensureStats(v).deaths++; touch(e.victimName); }
        if (!k) return;
        const had = !!k.pstats, s = ensureStats(k); if (had) s.kills++;     // нові pstats уже засіяні з u.stats.kills (сервер порахував це вбивство)
        const w = (typeof e.weapon === 'string' && WEAPONS.has(e.weapon)) ? e.weapon : null;
        if (w) s.kw[w] = num(s.kw[w]) + 1;
        if (e.mode === 'battle_royale') s.brKills++;
        bumpQuests(e.killerName, k, 'kill', e);
        checkAch(e.killerName, k);
    }));
    Events.on('multikill', safe(e => {
        if (e.killerBot || !(e.count >= 2)) return;
        const k = humanU(e.killerName); if (!k) return;
        const s = ensureStats(k); s.mkAny++; if (e.weapon === 'piercing') s.mkPierce++;
        bumpQuests(e.killerName, k, 'multikill', e);
        checkAch(e.killerName, k);
    }));
    Events.on('matchEnd', safe(e => {
        (e.players || []).forEach(p => {
            if (!p || p.isBot) return;
            const u = humanU(p.name); if (!u) return;
            const had = !!u.pstats, s = ensureStats(u);
            if (had) s.games++; s.playMs += Math.max(0, Math.min(6 * 3600000, e.durationMs | 0));
            const mr = modeRec(s, e.mode); if (mr) mr.games++;
            if (p.outcome === 'win') {
                s.wins++; s.curStreak++; if (s.curStreak > s.bestStreak) s.bestStreak = s.curStreak; if (mr) mr.wins++;
                if (e.mode === 'battle_royale') { s.brWins++; if (!(p.brPicks > 0)) s.brNoMods++; }
            } else if (p.outcome === 'draw') s.draws++;
            else { s.losses++; s.curStreak = 0; }
            if (e.mode === 'battle_royale' && p.place <= 3) s.brTop3++;
            s.bestMatchKills = Math.max(s.bestMatchKills, p.kills | 0);
            bumpQuests(p.name, u, 'matchEnd', e, p);
            checkAch(p.name, u);
            flush(p.name);
            pushState(p.name, 'match');
        });
    }));
    Events.on('caseOpened', safe(e => {
        const u = humanU(e.name); if (!u) return;
        const s = ensureStats(u);
        if (e.fromLevel) s.freeCases++;
        else if (has(CASES, e.caseId)) s.cases[e.caseId] = num(s.cases[e.caseId]) + 1;
        bumpQuests(e.name, u, 'caseOpened', e);
        checkAch(e.name, u);
        touch(e.name);
    }));
    Events.on('upgradeDone', safe(e => {
        const u = humanU(e.name); if (!u) return;
        const s = ensureStats(u); if (e.win) s.upOk++; else s.upFail++;
        bumpQuests(e.name, u, 'upgradeDone', e); checkAch(e.name, u); touch(e.name);
    }));
    Events.on('moduleEquipped', safe(e => { const u = humanU(e.name); if (!u) return; ensureStats(u).equips++; bumpQuests(e.name, u, 'moduleEquipped', e); checkAch(e.name, u); touch(e.name); }));
    Events.on('moduleSold', safe(e => { const u = humanU(e.name); if (!u) return; ensureStats(u).sells++; bumpQuests(e.name, u, 'moduleSold', e); checkAch(e.name, u); touch(e.name); }));

    // ---------- СОКЕТ ----------
    const lastReq = new Map();
    function gate(socket, key, gap) {
        const k = socket.id + '|' + key, now = Date.now(), l = lastReq.get(k) || 0;
        if (now - l < gap) return false; lastReq.set(k, now);
        if (lastReq.size > 5000) for (const kk of lastReq.keys()) { lastReq.delete(kk); if (lastReq.size < 2500) break; }
        return true;
    }
    function freeCaseResult(socketId, name, u, modId, caseId, src) {
        io.to(socketId).emit('caseResult', { modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId, fromProgress: src });
        Events.emit('caseOpened', { name, caseId, modId, price: 0, fromLevel: true });
    }

    ctx.onConnection(socket => {
        const who = () => { const n = ctx.globalPlayers[socket.id]; return (n && dbUsers[n]) ? n : null; };
        socket.on('getProgress', () => {
            const n = who(); if (!n || !gate(socket, 'get', 400)) return;
            const st = stateOf(n); if (st) { st.why = 'get'; socket.emit('progressState', st); }
        });
        socket.on('claimDaily', () => {
            const n = who(); if (!n || !gate(socket, 'cd', 600)) return;
            const r = claimDaily(n, Date.now());
            if (!r.ok) { socket.emit('progressError', { msg: r.msg }); return pushState(n, 'err'); }
            const u = dbUsers[n];
            syncEco(n);
            socket.emit('dailyClaimed', { idx: r.idx, credits: r.credits, caseId: r.caseId, bucks: r.bucks });
            if (r.modId) freeCaseResult(socket.id, n, u, r.modId, r.caseId, 'daily');
            checkAch(n, u);
            pushState(n, 'daily');
        });
        socket.on('claimQuest', (i) => {
            const n = who(); if (!n || !gate(socket, 'cq', 300)) return;
            const u = dbUsers[n], Q = ensureQuests(u, n, Date.now()); i = parseInt(i);
            const q = (i >= 0 && i < Q.list.length) ? Q.list[i] : null;
            if (!q) return;
            if (q.c) return socket.emit('progressError', { msg: 'Нагороду вже отримано' });
            if (q.p < q.goal) return socket.emit('progressError', { msg: 'Завдання ще не виконано' });
            q.c = 1; u.bucks += q.reward; u.stats.earned += q.reward; flush(n); syncEco(n);
            socket.emit('questClaimed', { i, reward: q.reward, bucks: u.bucks });
            pushState(n, 'quest');
        });
        socket.on('rerollQuest', (i) => {
            const n = who(); if (!n || !gate(socket, 'rq', 500)) return;
            const u = dbUsers[n], Q = ensureQuests(u, n, Date.now()); i = parseInt(i);
            const q = (i >= 0 && i < Q.list.length) ? Q.list[i] : null;
            if (!q) return;
            if (Q.rerolled) return socket.emit('progressError', { msg: 'Замінити завдання можна лише раз на день' });
            if (q.c || q.p >= q.goal) return socket.emit('progressError', { msg: 'Виконане завдання замінити не можна' });
            const used = Q.list.map(x => QT[x.t].cat), curCat = QT[q.t].cat, ids = Q.list.map(x => x.t);
            let pool = QT_LIST.filter(t => !ids.includes(t.id) && (t.cat === curCat || !used.filter((c, k) => k !== i).includes(t.cat)));
            if (!pool.length) pool = QT_LIST.filter(t => !ids.includes(t.id));
            Q.list[i] = mkQuest(pool[Math.floor(Math.random() * pool.length)], Math.random);
            Q.rerolled = 1; flush(n);
            socket.emit('questRerolled', { i });
            pushState(n, 'reroll');
        });
        socket.on('claimAch', (id) => {
            const n = who(); if (!n || !gate(socket, 'ca', 300)) return;
            const r = claimAch(n, id);
            if (!r.ok) return socket.emit('progressError', { msg: r.msg });
            const u = dbUsers[n];
            syncEco(n);
            socket.emit('achClaimed', { id: r.a.id, credits: r.credits, caseId: r.caseId, bucks: r.bucks });
            if (r.modId) freeCaseResult(socket.id, n, u, r.modId, r.caseId, 'ach');
            pushState(n, 'ach');
        });
        socket.on('disconnect', () => { for (const k of lastReq.keys()) if (k.startsWith(socket.id + '|')) lastReq.delete(k); });
    });

    ctx.Progress = { ensureStats, getStats, questsFor, addCredits, DAILY, ACH, QUESTS: QT_LIST, _dayKey: dayKey, _claimDaily: claimDaily, _stateOf: stateOf, _claimAch: claimAch };
};
