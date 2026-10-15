/* gladiators.js — режим «Гладіатори» (від 2 до 10 гравців, у кожного 3 життя).
 * Устрій: сама сесія — це «Форум» (мапа Forum, режим 'gladiators'): тут чекають між раундами, купують бафи й кейси, ставлять на дуелі.
 * Кожен раунд гравця переносить у ВЛАСНУ приховану кімнату-арену ('gl_arena', мапа Colosseum) проти однієї хвилі зомбі;
 * кожен 3-й раунд випадкова пара йде в кімнату-дуель ('gl_duel', мапа Duelist Pit) до першого знищення, інші — на арени.
 * Дочірні кімнати — звичайні кімнати rooms[] з полем glc = id Форуму: уся логіка руху, зіткнень, зомбі й синхронізації працює як завжди,
 * а гравець «перестрибує» між кімнатами (подія 'glHop' + звичайний 'gameStarting' без відліку). Глядач — гравець із out = true, hp = 0:
 * клієнт сам переходить у режим спостереження за живими в кімнаті.
 * Поінти, бафи, кейси, тимчасовий інвентар і ставки існують лише в межах однієї гри (стан у G — неперелічуване поле _gl Форуму).
 * Клієнт: public/js/gladiators.js. Мапа Форуму: tools/genforum.js (координати зон — ZONES, мають збігатися). */
'use strict';
const ModeInfo = require('./public/js/modeinfo.js');
const GD = require('./public/js/gamedata.js');
const GLC = require('./public/js/glclasses.js');      // 30 класів: базові характеристики й вміння

module.exports = function createGladiators(D) {
    const { io, rooms, dbUsers, MAP_DATA, Z_TYPES, getValidSpawn, getValidEdgeSpawn, checkCollisionServer, getMaxHp, zombieTick, grantXp, rollDrop,
        saveUser, ecoPayload, pushRooms, emitMatchEnd, hiddenSet, applyEventBonus, nickOf } = D;
    const SYNCS = () => D.SYNCS();

    // ---------- налаштування режиму ----------
    const HUB = 'Forum', ARENA = 'Colosseum', PIT = 'Duelist Pit';
    const LIVES = 3;
    const FAST = process.env.GL_FAST === '1';                              // лише для локальних тестів: коротші таймери Форуму
    const PICK_MS = FAST ? 15000 : GLC.PICK_MS;                            // вибір класу на старті: 45 с, далі — автоматично
    const HUB_FIRST = FAST ? 20000 : GLC.PICK_MS + 5000, HUB_WAIT = FAST ? 15000 : 60000, BET_CLOSE = 5000;          // перше очікування / між раундами / ставки закриваються за 5 с до старту
    const ARENA_SOFT = 240000, ENRAGE_EVERY = 15000, ENRAGE_STEP = 0.10;   // після 4 хв кожні 15 с зомбі +10% до HP, шкоди й швидкості
    const ARENA_HARD = 480000;      // 8 хв — запобіжник від завислого / згорнутого клієнта (шкоду від зомбі рахує клієнт): −1 життя, арена закривається
    const DUEL_EVERY = 3;                                                  // дуель — кожен 3-й раунд; вибір модуля — кожен парний
    const DUEL_MAX = 180000;                                              // дуель довше 3 хв — перемагає той, у кого більша частка HP
    const RESPAWN_MS = 3000;
    const ZONES = { shop: { x: 1790, y: 640, r: 150 }, bets: { x: 610, y: 640, r: 150 } };
    const BUY = { speed: 1, dmg: 1, hp: 1 }, BUY_BASE = 200, BUY_STEP = 75, BUY_MAX = 20, BUY_PCT = 0.02;
    const CASE_BASE = 350, CASE_STEP = 75, CASE_ODDS = { common: 75, rare: 15, epic: 7, legendary: 2, mythic: 1 };
    const PICK_ODDS = { common: 60, rare: 15, epic: 10, legendary: 10, mythic: 5 };     // перша роздача; кожна наступна: +1% кожній рідкості, крім звичайної
    const BET_MIN = 50, WIN_MIN = 200, LOSER_PCT = 0.05, POOL_PCT = 0.95;
    // прокляття: поразка в дуелі на ОСТАННЬОМУ житті не вбиває, а дає чорне серце (−10% до всіх характеристик за кожне);
    // 4-та така поразка — вибуття. Смерть на арені з останнім (звичайним чи проклятим) серцем — вибуття одразу.
    const CURSE_MAX = 3, CURSE_PCT = 0.10;
    const LIFE_PRICE = 1000;      // додаткове життя в Лавці — лише одне за гру
    // поінти за зомбі (не більше 50); «швидких» зомбі (бігун, малий) і босів у режимі немає
    const PTS = { normal: 15, ghost: 20, spitter: 25, tanker: 25, bomber: 30, puller: 50 };

    const SLOTS = ['cannon', 'turret', 'hull', 'tracks'], RORD = GD.RARITY_ORDER;
    const MOD_IDX = {}; SLOTS.forEach(s => { MOD_IDX[s] = {}; RORD.forEach(q => { MOD_IDX[s][q] = []; }); });
    Object.keys(GD.MODULES).forEach(id => { const m = GD.MODULES[id]; if (MOD_IDX[m.type] && MOD_IDX[m.type][m.rarity]) MOD_IDX[m.type][m.rarity].push(id); });
    const BASE_EQ = () => ({ cannon: null, turret: null, hull: null, tracks: null });

    const isHub = r => !!r && r.mode === 'gladiators';
    const G_of = r => !r ? null : r.glc ? (rooms[r.glc] && rooms[r.glc]._gl) || null : (isHub(r) ? r._gl || null : null);
    const owns = r => !!G_of(r);
    const now_ = () => Date.now();
    const sockOf = id => io.sockets.sockets.get(id);
    const chan = G => 'glc:' + G.hub.id;
    const priceBuy = n => BUY_BASE + BUY_STEP * n, priceCase = n => CASE_BASE + CASE_STEP * n;

    // ---------- випадковий модуль ----------
    function roll(odds) { let tot = 0; for (const k in odds) tot += odds[k]; let x = Math.random() * tot; for (const k of RORD) { x -= odds[k] || 0; if (x < 0) return k; } return 'common'; }
    function rollMod(rar) { const sl = SLOTS.filter(s => MOD_IDX[s][rar].length), s = sl[Math.floor(Math.random() * sl.length)], l = MOD_IDX[s][rar]; return l[Math.floor(Math.random() * l.length)]; }
    function pickOdds(n) { const o = Object.assign({}, PICK_ODDS); RORD.forEach(k => { if (k !== 'common') o[k] += n; }); o.common = Math.max(0, o.common - 4 * n); return o; }

    // ---------- екіпіровка в межах гри: модулі зі слотів + бафи (поле bm читає GameData.statMult) ----------
    // множники: клас (база) × куплені бафи × прокляття × активні вміння (fx)
    const N3 = v => +v.toFixed(3);
    function fxSum(rec, now) { const s = { spd: 0, dmg: 0, rate: 0, rng: 0, armor: 0, vamp: 0 }; (rec.fx || []).forEach(f => { if (f.until > now) for (const k in s) s[k] += f[k] || 0; }); return s; }
    function applyEq(G, rec) {
        const p = findP(G, rec.id); const e = Object.assign(BASE_EQ(), rec.eq);
        const k = 1 - CURSE_PCT * (rec.curse || 0);      // прокляття: −10% до кожної характеристики (скорострільність — довша перезарядка)
        const C = rec.cls && GLC.BYID[rec.cls], st = C ? C.st : { hp: 1, dmg: 1, spd: 1, cd: 1, rng: 1, rot: 1 }, f = fxSum(rec, now_());
        e.bm = { speed: N3((1 + BUY_PCT * rec.buys.speed) * k * st.spd * (1 + f.spd)), dmg: N3((1 + BUY_PCT * rec.buys.dmg) * k * st.dmg * (1 + f.dmg)), hp: N3((1 + BUY_PCT * rec.buys.hp) * k * st.hp),
            range: N3(k * st.rng * (1 + f.rng)), rotSpeed: N3(k * st.rot), cd: N3(st.cd / k / (1 + f.rate)) };
        if (p) { const full = p.hp >= getMaxHp(p.equipped) - 0.5; p.equipped = e; if (full || p.hp > getMaxHp(e)) p.hp = getMaxHp(e); }
        return e;
    }

    // ---------- стан гри ----------
    function newRec(p) { return { id: p.id, name: p.name, lives: LIVES, curse: 0, lifeBought: false, cls: null, cdUntil: 0, fx: [], hot: [], barrier: null, pts: FAST ? 1000 : 0, out: false, left: false, done: false, buys: { speed: 0, dmg: 0, hp: 0 }, cases: 0, inv: [], eq: BASE_EQ(), offer: null, lived: 0, kills: 0, place: 0, paid: false, bet: null, room: null }; }
    function findP(G, id) { const rec = G.ps[id]; if (!rec || !rec.room || !rooms[rec.room]) return null; return rooms[rec.room].players[id] || null; }
    const recs = G => Object.values(G.ps).filter(q => !q.left);
    const alive = G => recs(G).filter(q => !q.out);

    function start(r, pK, now) {
        const G = { hub: r, ps: {}, round: 0, ph: 'hub', t: now + 4000 + HUB_FIRST, pickEnd: now + 4000 + PICK_MS, duel: null, kids: {}, offerN: 0, n0: pK.length, t0: now, seq: 0 };
        hiddenSet(r, '_gl', G); r.map = HUB;
        pK.forEach(id => {
            const p = r.players[id], rec = G.ps[id] = newRec(p); rec.room = r.id; rec.p = p;
            hiddenSet(p, 'realEq', p.realEq || p.equipped); p.equipped = applyEq(G, rec); p.hp = getMaxHp(p.equipped); p.out = false; p.lives = LIVES; p.score = 0;
            const s = sockOf(id); if (s) s.join(chan(G));
        });
        setTimeout(() => { if (r._gl === G) { broadcast(G); recs(G).forEach(q => sendMe(G, q)); } }, 300);
    }

    // ---------- дочірні кімнати ----------
    function mkRoom(G, kind, map) {
        const now = now_(), id = (kind === 'gl_arena' ? 'gla_' : 'gld_') + now + '_' + (G.seq++);
        const r = rooms[id] = { id, hostName: G.hub.hostName, hostSocket: G.hub.hostSocket, mode: kind, map, maxPlayers: 10, status: 'playing', state: 'playing', phaseEndTime: 0,
            players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {}, wave: G.round, nextWaveTime: 0, lastPowerupSpawn: now, glc: G.hub.id };
        hiddenSet(r, '_obj', null); hiddenSet(r, '_fin', null); hiddenSet(r, '_me', null); hiddenSet(r, '_leader', null); hiddenSet(r, '_ldAt', 0);
        hiddenSet(r, '_k', { t0: now, enr: 0, owner: null, a: null, b: null, spawned: false });
        G.kids[id] = kind; return r;
    }
    function killRoom(G, rid) {
        const r = rooms[rid]; delete G.kids[rid]; if (!r) return;
        Object.keys(r.players).forEach(id => { const s = sockOf(id); if (s) s.leave(rid); });
        delete rooms[rid]; const S = SYNCS(); if (S) S.delete(rid);
    }
    // перенести гравця в іншу кімнату (watch — глядачем: hp 0, out)
    function hop(G, rec, to, pos, watch) {
        const from = rec.room && rooms[rec.room] ? rooms[rec.room] : null;
        const p = (from && from.players[rec.id]) || rec.p;      // rec.p — той самий об'єкт гравця (на випадок, якщо його кімнату вже прибрали)
        if (!p || !to) return null;
        if (from !== to) { if (from) delete from.players[rec.id]; to.players[rec.id] = p; }
        const s = sockOf(rec.id); if (s && from !== to) { if (from) s.leave(from.id); else if (rec.room) s.leave(rec.room); s.join(to.id); }
        rec.room = to.id;
        p.x = pos.x; p.y = pos.y; p.stuckIn = []; p.buff = null; p.buffProgress = 0; p.onFire = null; p.isDisguised = false; p.laserTarget = null;
        p.out = !!watch || rec.out; p.hp = p.out ? 0 : getMaxHp(p.equipped); p.lives = rec.lives;
        const S = SYNCS(); if (S) S.delete(to.id);
        if (s) { s.emit('glHop', { roomId: to.id, kind: to.mode === 'gladiators' ? 'hub' : to.mode === 'gl_arena' ? 'arena' : 'duel', watch: !!watch }); s.emit('gameStarting', to); }
        if (from && from !== to && from.glc && !Object.keys(from.players).length) killRoom(G, from.id);      // порожня дочірня кімната більше не потрібна
        return p;
    }
    function hubSpot(G) { return getValidSpawn(HUB, 24, 'spawn_player'); }
    function toHub(G, rec) { return hop(G, rec, G.hub, hubSpot(G), false); }
    // глядач: дивиться дуель (якщо триває), інакше чиюсь арену, інакше — на Форумі
    // skip — кімната, яку саме закривають (туди глядача не садимо)
    function toWatch(G, rec, prefer, skip) {
        const ok = id => id && id !== skip && rooms[id] && rooms[id].glc === G.hub.id && !(rooms[id].mode === 'gl_duel' && G.duel && G.duel.over);
        let target = ok(prefer) ? rooms[prefer] : null;
        if (!target && G.duel && ok(G.duel.room)) target = rooms[G.duel.room];
        if (!target) { const a = Object.keys(G.kids).find(k => G.kids[k] === 'gl_arena' && ok(k)); if (a) target = rooms[a]; }
        if (!target) return hop(G, rec, G.hub, hubSpot(G), rec.out);
        const c = MAP_DATA[target.map] || {}, half = (c.size || 2000) / 2;
        return hop(G, rec, target, { x: half, y: half }, true);
    }

    // ---------- фази ----------
    function startHub(G) {
        const now = now_(); G.ph = 'hub';
        // усіх повертаємо на Форум (глядачі теж стоять там), дочірні кімнати прибираємо
        recs(G).forEach(rec => {
            rec.fx = []; rec.hot = []; rec.barrier = null; applyEq(G, rec);      // ефекти вмінь закінчуються разом із раундом
            if (rec.room !== G.hub.id) toHub(G, rec); else { const p = findP(G, rec.id); if (p) { p.out = rec.out; p.hp = rec.out ? 0 : getMaxHp(p.equipped); p.buff = null; } }
            rec.done = false; rec.bet = null;
        });
        Object.keys(G.kids).forEach(k => killRoom(G, k));
        const al = alive(G);
        if (al.length <= 1 && G.round > 0) return finish(G);
        // кожен 2-й раунд — вибір 1 з 3 модулів (кожна наступна роздача щедріша)
        if (G.round > 0 && G.round % 2 === 0) { const odds = pickOdds(G.offerN++); al.forEach(rec => { rec.offer = [rollMod(roll(odds)), rollMod(roll(odds)), rollMod(roll(odds))]; }); }
        // дуель — кожен 3-й раунд (3, 6, 9…): випадкова пара; решта раундів — лише зомбі (прокачка). Двоє живих — дуель без ставок
        G.duel = null;
        if ((G.round + 1) % DUEL_EVERY === 0 && al.length >= 2) {
            const sh = al.slice().sort(() => Math.random() - 0.5), a = sh[0], b = sh[1];
            G.duel = { a: a.id, b: b.id, bets: {}, open: al.length > 2 || recs(G).length > 2, room: null, t0: 0 };
        }
        G.t = now + (G.round === 0 ? HUB_FIRST : HUB_WAIT);
        recs(G).forEach(q => sendMe(G, q)); broadcast(G);
    }
    function startRound(G) {
        const now = now_(); if (!G.picked) autoPick(G); G.round++; G.ph = 'fight';
        if (G.duel) G.duel.open = false;
        recs(G).forEach(rec => { rec.cdUntil = now + 3000; });      // вміння доступне з початком бою
        // невибрані модулі — випадковий з трьох
        recs(G).forEach(rec => { if (rec.offer) { rec.inv.push(rec.offer[Math.floor(Math.random() * 3)]); rec.offer = null; } });
        const al = alive(G), duel = G.duel && G.ps[G.duel.a] && G.ps[G.duel.b] && !G.ps[G.duel.a].out && !G.ps[G.duel.b].out ? G.duel : null;
        if (!duel) G.duel = null;
        if (duel) {
            const r = mkRoom(G, 'gl_duel', PIT); duel.room = r.id; duel.t0 = now + 3000; r._k.a = duel.a; r._k.b = duel.b;
            hop(G, G.ps[duel.a], r, spotNear(PIT, 1100, 420), false); hop(G, G.ps[duel.b], r, spotNear(PIT, 1100, 1780), false);
            const pa = r.players[duel.a]; if (pa) pa.bodyAngle = pa.turretAngle = Math.PI / 2;
            const pb = r.players[duel.b]; if (pb) pb.bodyAngle = pb.turretAngle = -Math.PI / 2;
        }
        al.forEach(rec => {
            if (duel && (rec.id === duel.a || rec.id === duel.b)) return;
            const r = mkRoom(G, 'gl_arena', ARENA); r._k.owner = rec.id; r._k.t0 = now + 3000;
            hop(G, rec, r, getValidSpawn(ARENA, 24, 'spawn_player'), false);
            spawnWave(G, r, now);
        });
        recs(G).filter(q => q.out).forEach(rec => toWatch(G, rec));
        recs(G).forEach(q => sendMe(G, q)); broadcast(G); pushRooms();
    }
    function spotNear(map, x, y) {
        if (!checkCollisionServer(map, x, y, 30)) return { x, y };
        for (let k = 1; k < 30; k++) for (let a = 0; a < 12; a++) { const px = x + Math.cos(a / 12 * Math.PI * 2) * k * 30, py = y + Math.sin(a / 12 * Math.PI * 2) * k * 30; if (!checkCollisionServer(map, px, py, 30)) return { x: px, y: py }; }
        return getValidSpawn(map, 24, 'spawn_player');
    }

    // ---------- хвиля зомбі арени: одна хвиля, з кожним раундом більша й різноманітніша ----------
    const EASE = 0.75;      // хвилі на 25% легші: здоров’я й шкода зомбі ×0.75 (кількість і поінти за вбивство — без змін)
    function waveSpec(R) {
        const n = Math.min(30, 5 + 2 * (R - 1)), pool = [['normal', 10]];
        if (R >= 2) pool.push(['spitter', 3], ['tanker', 3]);
        if (R >= 3) pool.push(['bomber', 2], ['ghost', 2]);
        if (R >= 5) pool[0][1] = 6;
        const elites = R >= 4 ? Math.min(Math.floor(n / 3), R - 3) : 0, el = ['puller'];      // еліт — лише тягуни (щитоносців у режимі немає)
        return { n, pool, elites, el, hp: EASE * (1 + 0.12 * (R - 1)), dmg: EASE * (1 + 0.08 * (R - 1)) };
    }
    function pickW(pool) { let t = 0; pool.forEach(x => t += x[1]); let v = Math.random() * t; for (const x of pool) { v -= x[1]; if (v < 0) return x[0]; } return pool[0][0]; }
    function spawnWave(G, r, now) {
        const W = waveSpec(G.round);
        for (let i = 0; i < W.n; i++) {
            const t = i < W.elites ? W.el[Math.floor(Math.random() * W.el.length)] : pickW(W.pool), pos = getValidEdgeSpawn(ARENA, (Z_TYPES[t].radius || 15) + 5, 'spawn_zombie');
            const id = 'gz_' + now + '_' + i + '_' + Math.floor(Math.random() * 1e4), hp = Math.max(1, Math.round(Z_TYPES[t].hp * W.hp));
            r.zombies[id] = { id, x: pos.x, y: pos.y, type: t, hp, maxHp: hp, dmgMult: W.dmg, nextAttack: now + 3500, onFire: null, nextPull: now + 5000 };
        }
        r._k.spawned = true; r._k.total = W.n;
        io.to(r.id).emit('newWave', { wave: G.round, isBoss: false });
    }

    // ---------- головний цикл (кожен тік для Форуму й кожної дочірньої кімнати). true — далі для кімнати нічого не робити ----------
    function tick(r, now, dt) {
        const G = G_of(r); if (!G) return false;
        if (isHub(r)) {
            if (r.status !== 'playing') return true;
            fxTick(G, now);
            if (G.ph === 'hub') {
                if (!G.picked && now >= G.pickEnd) autoPick(G);
                if (G.duel && G.duel.open && now >= G.t - BET_CLOSE) { G.duel.open = false; broadcast(G); }
                if (now >= G.t) startRound(G);
            } else if (G.ph === 'fight' && !Object.keys(G.kids).length) { endRound(G); }
            return false;
        }
        const K = r._k;
        if (r.mode === 'gl_arena') {
            const owner = G.ps[K.owner];
            if (!owner || owner.left || !r.players[K.owner]) { closeArena(G, r); return true; }
            const aP = Object.values(r.players).filter(p => p.hp > 0 && !p.out);
            // посилення затягнутої хвилі
            if (now - K.t0 > ARENA_SOFT) {
                const st = Math.floor((now - K.t0 - ARENA_SOFT) / ENRAGE_EVERY) + 1;
                if (st > K.enr) {
                    const k = Math.pow(1 + ENRAGE_STEP, st - K.enr); K.enr = st;
                    for (const id in r.zombies) { const z = r.zombies[id]; z.hp *= k; z.maxHp *= k; z.dmgMult = (z.dmgMult || 1) * k; z.spdMul = (z.spdMul || 1) * k; }
                    io.to(r.id).emit('glEnrage', { n: st, pct: Math.round((Math.pow(1 + ENRAGE_STEP, st) - 1) * 100) });
                }
            }
            if (now - K.t0 > ARENA_HARD && !owner.out) {
                owner.lives = Math.max(0, owner.lives - 1); io.to(owner.id).emit('glMsg', { t: 'Час арени вичерпано: −1 життя', err: 1 });
                if (owner.lives <= 0) eliminate(G, owner); else { owner.done = true; owner.lived = Math.max(owner.lived, G.round); }
                closeArena(G, r); return true;
            }
            if (now >= K.t0 - 2500) zombieTick(r, r.id, now, dt, aP, null);
            if (K.spawned && !Object.keys(r.zombies).length && owner.room === r.id && !owner.out) {      // хвилю відбито
                owner.done = true; owner.lived = Math.max(owner.lived, G.round);
                io.to(owner.id).emit('glClear', { round: G.round, pts: owner.pts });
                closeArena(G, r); return true;
            }
            return false;
        }
        if (r.mode === 'gl_duel') {
            const d = G.duel; if (!d || d.room !== r.id) { killRoom(G, r.id); return true; }
            if (now - d.t0 > DUEL_MAX) {
                const pa = r.players[d.a], pb = r.players[d.b];
                const fa = pa ? pa.hp / Math.max(1, getMaxHp(pa.equipped)) : 0, fb = pb ? pb.hp / Math.max(1, getMaxHp(pb.equipped)) : 0;
                const win = fa === fb ? (Math.random() < 0.5 ? d.a : d.b) : fa > fb ? d.a : d.b;
                duelEnd(G, win, win === d.a ? d.b : d.a, 'time'); return true;
            }
            return false;
        }
        return false;
    }
    // арену закрито (хвилю відбито / вибув / вийшов): власник — дивитись дуель або на Форум; глядачі — теж геть
    function closeArena(G, r) {
        const owner = G.ps[r._k.owner];
        r.zombies = {};
        Object.keys(r.players).forEach(id => {
            const rec = G.ps[id]; if (!rec || rec.left) return;
            if (G.duel && G.duel.room && rooms[G.duel.room] && !G.duel.over && (rec.done || rec.out)) toWatch(G, rec, G.duel.room, r.id);
            else if (rec.out && id !== (owner && owner.id)) toWatch(G, rec, null, r.id);
            else toHub(G, rec);
        });
        killRoom(G, r.id);
        if (owner) sendMe(G, owner); broadcast(G);
    }
    function endRound(G) {
        alive(G).forEach(rec => { rec.lived = Math.max(rec.lived, G.round); });
        startHub(G);
    }

    // ---------- смерть ----------
    function onDeath(r, v, killerId) {
        const G = G_of(r); if (!G) return;
        const rec = G.ps[v.id]; if (!rec) return;
        if (r.mode === 'gl_arena') {
            rec.lives = Math.max(0, rec.lives - 1); v.lives = rec.lives;
            io.to(v.id).emit('clsLives', { n: rec.lives });
            if (rec.lives > 0) {
                setTimeout(() => {
                    const R = rooms[r.id]; if (!R || R !== r || !r.players[v.id] || v.hp > 0 || rec.out) return;
                    const sp = getValidSpawn(ARENA, 24, 'spawn_player'); v.hp = getMaxHp(v.equipped); v.x = sp.x; v.y = sp.y; v.stuckIn = []; v.buff = null; v.onFire = null;
                    io.to(r.id).emit('playerRespawn', v);
                }, RESPAWN_MS);
                sendMe(G, rec); broadcast(G);
            } else { eliminate(G, rec); setTimeout(() => { if (rooms[r.id] === r) closeArena(G, r); }, 1500); }
            return;
        }
        if (r.mode === 'gl_duel') {
            const d = G.duel; if (!d || d.room !== r.id || d.over) return;
            const win = v.id === d.a ? d.b : d.a; duelEnd(G, win, v.id, 'kill');
        }
    }
    // дуель завершено: виплати за ставками, −1 життя тому, хто програв
    function duelEnd(G, winId, loseId, why) {
        const d = G.duel; if (!d || d.over) return; d.over = true;
        const W = G.ps[winId], L = G.ps[loseId], bets = Object.values(d.bets);
        const bankW = bets.filter(b => b.on === winId).reduce((a, b) => a + b.amt, 0), bankL = bets.filter(b => b.on === loseId).reduce((a, b) => a + b.amt, 0);
        // банк кожного дуелянта — щонайменше 200 (WIN_MIN), навіть якщо на нього ніхто не ставив: тоді переможці ставок усе одно мають прибуток
        const effW = Math.max(WIN_MIN, bankW), effL = Math.max(WIN_MIN, bankL);
        const pay = { win: 0, lose: 0, bettors: {} };
        if (W && !W.left) { pay.win = effW; W.pts += pay.win; W.kills++; }
        if (L && !L.left) { pay.lose = Math.round(effL * LOSER_PCT); L.pts += pay.lose; }
        bets.forEach(b => {
            if (b.on !== winId) return; const q = G.ps[b.id]; if (!q || q.left) return;
            const got = b.amt + Math.round(b.amt / effW * effL * POOL_PCT); q.pts += got; pay.bettors[b.id] = got;
        });
        // той, хто програв: −1 звичайне серце; на останньому — чорне серце прокляття (−10%), понад 3 — вибуття
        let cursed = 0, outNow = false;
        if (L && !L.left) {
            if (L.lives > 1) L.lives--;
            else if ((L.curse || 0) < CURSE_MAX) { L.curse = (L.curse || 0) + 1; cursed = L.curse; applyEq(G, L); }
            else { L.lives = 0; outNow = true; }
            const pl = findP(G, L.id); if (pl) pl.lives = L.lives;
        }
        io.to(chan(G)).emit('glDuelEnd', { win: winId, lose: loseId, winName: W ? nickOf(W.name) : '', loseName: L ? nickOf(L.name) : '', bankW, bankL, prize: pay.win, consol: pay.lose, why, bettors: pay.bettors, curse: cursed, pct: Math.round(cursed * CURSE_PCT * 100), out: outNow });
        if (outNow) eliminate(G, L);
        if (W && !W.left) W.lived = Math.max(W.lived, G.round);
        const room = rooms[d.room];
        setTimeout(() => {      // 2 с — подивитись на вибух, далі всіх із дуелі розвести
            if (G.duel !== d) return; d.room = null;
            if (room && rooms[room.id] === room) {
                Object.keys(room.players).forEach(id => { const rec = G.ps[id]; if (!rec || rec.left) return; if (rec.out && id !== loseId) toWatch(G, rec, null, room.id); else toHub(G, rec); });
                killRoom(G, room.id);
            }
            recs(G).forEach(q => sendMe(G, q)); broadcast(G);
        }, 2200);
    }
    // гравець вибув: місце, нагорода за прожиті раунди — одразу
    function eliminate(G, rec) {
        if (rec.out) return; rec.out = true; rec.done = true;
        const rest = alive(G).length;      // живих після вибуття
        rec.place = rest + 1; rec.lived = Math.max(rec.lived, G.round - 1);
        const p = findP(G, rec.id); if (p) { p.out = true; p.lives = 0; }
        payout(G, rec, rec.place === 1 ? 'win' : 'loss');
        sendMe(G, rec); broadcast(G);
    }
    function payout(G, rec, outcome) {
        if (rec.paid) return; rec.paid = true;
        const amt = ModeInfo.reward('gladiators', G.hub, outcome, { rounds: rec.lived, n: G.n0, place: rec.place });
        const u = dbUsers[rec.name]; let xp = null, drop = null;
        if (u) {
            u.bucks += amt; u.stats.earned = (u.stats.earned | 0) + amt; u.stats.matches++;
            xp = grantXp(rec.name, outcome); drop = rollDrop(rec.name); saveUser(rec.name);
            io.to(rec.id).emit('economyUpdate', ecoPayload(rec.name)); if (drop) io.to(rec.id).emit('dropReceived', drop);
        }
        rec.reward = amt;
        io.to(rec.id).emit('glOver', { place: rec.place, n: G.n0, reward: amt, xp, rounds: rec.lived, win: outcome === 'win', final: G.ph === 'end' });
    }
    function finish(G) {
        if (G.ph === 'end') return; G.ph = 'end';
        const hub = G.hub;
        recs(G).forEach(rec => { if (rec.room !== hub.id) toHub(G, rec); });      // усіх — на Форум (там вікно підсумків і кнопка «Повернутись у сесію»)
        Object.keys(G.kids).forEach(k => killRoom(G, k));
        const w = alive(G)[0];
        if (w) { w.place = 1; w.lived = Math.max(w.lived, G.round); payout(G, w, 'win'); }
        const all = Object.values(G.ps), oc = {}, rw = {}, pl = {};
        all.forEach(q => { oc[q.id] = q.place === 1 ? 'win' : 'loss'; rw[q.id] = q.reward | 0; pl[q.id] = q.place || all.length; });
        io.to(chan(G)).emit('glEnd', { standings: all.slice().sort((a, b) => (a.place || 99) - (b.place || 99)).map(q => ({ id: q.id, name: nickOf(q.name), place: q.place, rounds: q.lived, reward: q.reward | 0, left: q.left })), rounds: G.round });
        // повернути справжню екіпіровку; кімната — «завершена» (вихід у лобі сесії — звичайною кнопкою «Повернутись у сесію»)
        Object.values(hub.players).forEach(p => { if (p.realEq) { p.equipped = p.realEq; p.realEq = null; } p.out = false; p.lives = 0; });
        hub.status = 'finished';
        try { emitMatchEnd(hub, { outcomes: oc, rewards: rw, place: pl, waves: G.round }); } catch (e) {}
        recs(G).forEach(q => { const s = sockOf(q.id); if (s) s.leave(chan(G)); });
        hiddenSet(hub, '_gl', null); pushRooms();
    }

    // ---------- вихід / розрив зв'язку (викликає removePlayer у server.js; гравця вже видалено з r.players) ----------
    function onLeave(r, left) {
        const G = G_of(r); if (!G) return false;
        const rec = G.ps[left.id]; if (!rec || rec.left) return true;
        if (left.realEq) { left.equipped = left.realEq; left.realEq = null; }
        const wasIn = rec.room; rec.left = true; rec.room = null;
        const s = sockOf(left.id); if (s) s.leave(chan(G));
        if (!rec.out) { rec.out = true; rec.place = alive(G).length + 1; rec.lived = Math.max(rec.lived, G.round - 1); payout(G, rec, 'loss'); }
        if (G.duel && !G.duel.over && (G.duel.a === rec.id || G.duel.b === rec.id)) {
            if (G.duel.room) duelEnd(G, G.duel.a === rec.id ? G.duel.b : G.duel.a, rec.id, 'left');
            else { if (G.duel.bets) Object.values(G.duel.bets).forEach(b => { const q = G.ps[b.id]; if (q && !q.left) q.pts += b.amt; }); G.duel = null; }      // дуель ще не почалась — ставки повертаються
        }
        if (G.duel && G.duel.bets && G.duel.bets[rec.id]) delete G.duel.bets[rec.id];
        if (G.hub.hostSocket === rec.id) { const nx = recs(G)[0]; if (nx) { G.hub.hostSocket = nx.id; G.hub.hostName = nx.name; } }
        const kid = wasIn && rooms[wasIn] && rooms[wasIn].glc ? rooms[wasIn] : null;
        if (kid && kid.mode === 'gl_arena' && kid._k.owner === rec.id) closeArena(G, kid);
        else if (kid && !Object.keys(kid.players).length) killRoom(G, kid.id);
        if (!recs(G).length) { Object.keys(G.kids).forEach(k => killRoom(G, k)); hiddenSet(G.hub, '_gl', null); return 'empty'; }
        if (G.ph !== 'end' && alive(G).length <= 1) finish(G);
        else { broadcast(G); }
        pushRooms();
        return true;
    }

    // ---------- дії гравця ----------
    function inHub(G, rec) { return rec && !rec.left && rec.room === G.hub.id; }
    function nearZone(p, z) { return p && Math.hypot(p.x - z.x, p.y - z.y) <= z.r + 70; }
    function buy(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || !inHub(G, rec) || rec.out || G.ph === 'end') return;
        const p = findP(G, rec.id); if (!nearZone(p, ZONES.shop)) return socket.emit('glMsg', { t: 'Підʼїдьте до Лавки, щоб купувати', err: 1 });
        const k = d.k;
        if (BUY[k]) {
            if (rec.buys[k] >= BUY_MAX) return socket.emit('glMsg', { t: 'Досягнуто максимум покращень', err: 1 });
            const pr = priceBuy(rec.buys[k]); if (rec.pts < pr) return socket.emit('glMsg', { t: 'Не вистачає поінтів', err: 1 });
            rec.pts -= pr; rec.buys[k]++; applyEq(G, rec); if (k === 'hp' && p) p.hp = getMaxHp(p.equipped);
            socket.emit('glBought', { k, n: rec.buys[k] });
        } else if (k === 'case') {
            const pr = priceCase(rec.cases); if (rec.pts < pr) return socket.emit('glMsg', { t: 'Не вистачає поінтів', err: 1 });
            rec.pts -= pr; rec.cases++; const rar = roll(CASE_ODDS), mod = rollMod(rar); rec.inv.push(mod);
            socket.emit('glCase', { mod, rar });
        } else if (k === 'life') {      // +1 звичайне серце; лише одне за гру
            if (rec.lifeBought) return socket.emit('glMsg', { t: 'Життя можна купити лише один раз за гру', err: 1 });
            if (rec.pts < LIFE_PRICE) return socket.emit('glMsg', { t: 'Не вистачає поінтів', err: 1 });
            rec.pts -= LIFE_PRICE; rec.lifeBought = true; rec.lives++; if (p) p.lives = rec.lives;
            socket.emit('glBought', { k, n: rec.lives }); broadcast(G);
        } else return;
        sendMe(G, rec);
    }
    function pick(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || !rec.offer || rec.left) return;
        const i = d.i | 0; if (i < 0 || i > 2) return;
        rec.inv.push(rec.offer[i]); rec.offer = null; sendMe(G, rec);
    }
    function equip(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || !inHub(G, rec) || rec.out) return;
        if (typeof d.mod === 'string') {
            const i = rec.inv.indexOf(d.mod), m = GD.MODULES[d.mod]; if (i < 0 || !m) return;
            rec.inv.splice(i, 1); const old = rec.eq[m.type]; if (old) rec.inv.push(old); rec.eq[m.type] = d.mod;
        } else if (SLOTS.includes(d.slot) && rec.eq[d.slot]) { rec.inv.push(rec.eq[d.slot]); rec.eq[d.slot] = null; }
        else return;
        applyEq(G, rec); sendMe(G, rec);
    }
    function bet(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || rec.left || G.ph !== 'hub') return;
        const D2 = G.duel; if (!D2 || !D2.open || now_() >= G.t - BET_CLOSE) return socket.emit('glMsg', { t: 'Ставки вже закрито', err: 1 });
        if (rec.id === D2.a || rec.id === D2.b) return socket.emit('glMsg', { t: 'Дуелянти не можуть ставити', err: 1 });
        const on = d.on === 'a' ? D2.a : d.on === 'b' ? D2.b : null, amt = Math.floor(+d.amt || 0); if (!on) return;
        const cur = D2.bets[rec.id];
        if (cur && cur.on !== on) return socket.emit('glMsg', { t: 'Ви вже поставили на іншого дуелянта', err: 1 });
        if (amt < BET_MIN) return socket.emit('glMsg', { t: 'Мінімальна ставка — ' + BET_MIN, err: 1 });
        if (amt > rec.pts) return socket.emit('glMsg', { t: 'Не вистачає поінтів', err: 1 });
        rec.pts -= amt; if (cur) cur.amt += amt; else D2.bets[rec.id] = { id: rec.id, on, amt };
        rec.bet = { on, amt: D2.bets[rec.id].amt };
        sendMe(G, rec); broadcast(G);
    }
    function watch(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || rec.left || G.ph !== 'fight') return;
        if (!rec.out && !rec.done) return;      // живий гравець у бою — не можна
        const tgt = d.id && G.ps[d.id], room = tgt && tgt.room && rooms[tgt.room] && rooms[tgt.room].glc === G.hub.id ? tgt.room : null;
        if (d.id === 'hub') toHub(G, rec); else if (room) toWatch(G, rec, room);
    }

    // ---------- КЛАСИ ----------
    function pickClass(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (!rec || rec.left || G.picked || G.ph !== 'hub' || G.round > 0) return;
        if (!d.id || !GLC.BYID[d.id]) return;
        rec.cls = d.id; applyEq(G, rec); const p = findP(G, rec.id); if (p) p.hp = getMaxHp(p.equipped);
        sendMe(G, rec); broadcast(G);
        if (recs(G).every(q => q.cls)) { G.picked = true; G.t = Math.min(G.t, now_() + 10000); broadcast(G); }      // усі обрали — раунд за 10 с
    }
    function autoPick(G) {
        G.picked = true;
        recs(G).forEach(rec => {
            if (rec.cls) return; const L = GLC.LIST; rec.cls = L[Math.floor(Math.random() * L.length)].id; applyEq(G, rec);
            const p = findP(G, rec.id); if (p) p.hp = getMaxHp(p.equipped); io.to(rec.id).emit('glMsg', { t: 'Клас обрано автоматично: ' + GLC.BYID[rec.cls].n }); sendMe(G, rec);
        });
        broadcast(G);
    }
    // тимчасові ефекти вмінь: закінчення (перерахунок характеристик) і лікування з часом — щотіку
    function fxTick(G, now) {
        recs(G).forEach(rec => {
            if (rec.fx.length && rec.fx.some(f => f.until <= now)) { rec.fx = rec.fx.filter(f => f.until > now); applyEq(G, rec); sendMe(G, rec); }
            if (rec.barrier && rec.barrier.until <= now) rec.barrier = null;
            if (rec.hot.length) {
                const p = findP(G, rec.id);
                rec.hot = rec.hot.filter(h => h.until > now - 50);
                rec.hot.forEach(h => { if (now >= h.next) { h.next += 1000; if (p && p.hp > 0 && !p.out) p.hp = Math.min(getMaxHp(p.equipped), p.hp + h.v); } });
            }
        });
    }
    // шкода по гравцю з урахуванням броні (armor) і щита (barrier) — викликає server.js (зомбі, постріли в дуелі) і самі вміння
    function taken(r, v, amt) {
        const G = G_of(r), rec = G && v && G.ps[v.id]; if (!rec || !(amt > 0)) return amt;
        const now = now_(), f = fxSum(rec, now); let a = amt * (1 - Math.max(-0.5, Math.min(0.8, f.armor)));
        const B = rec.barrier; if (B && B.until > now && B.v > 0) { const ab = Math.min(B.v, a); B.v -= ab; a -= ab; if (B.v <= 0) rec.barrier = null; }
        return a;
    }
    // завдана шкода → вампіризм
    function dealt(r, sid, amt) {
        const G = G_of(r), rec = G && G.ps[sid]; if (!rec || !(amt > 0)) return;
        const f = fxSum(rec, now_()); if (!(f.vamp > 0)) return;
        const p = r.players[sid]; if (p && p.hp > 0 && !p.out) p.hp = Math.min(getMaxHp(p.equipped), p.hp + amt * f.vamp);
    }
    function hitPlayer(r, atkId, v, dmg) {      // удар вмінням по суперникові в дуелі
        if (!v || v.hp <= 0 || v.out) return;
        const a = taken(r, v, dmg), hp0 = v.hp; v.hp = Math.max(0, v.hp - a);
        io.to(atkId).emit('dmgN', { x: Math.round(v.x), y: Math.round(v.y), v: Math.round(Math.min(hp0, a)), k: v.hp === 0 ? 2 : 1 }); dealt(r, atkId, Math.min(hp0, a));
        if (v.hp === 0) D.processPlayerDeath(r, v.id, atkId, { weapon: 'ability' });
    }
    function useAbility(socket, d) {
        const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id], now = now_();
        if (!rec || rec.left || rec.out || !r.glc || G.ph !== 'fight' || !rec.cls) return;
        const p = r.players[socket.id]; if (!p || p.hp <= 0 || p.out) return;
        if (now < rec.cdUntil || now < r._k.t0 - 500) return socket.emit('glCd', { ms: Math.max(0, rec.cdUntil - now) });
        const C = GLC.BYID[rec.cls]; let fx = C.ab.fx;
        if (fx.any) fx = fx.any[Math.floor(Math.random() * fx.any.length)];
        rec.cdUntil = now + C.ab.cd * 1000;
        const mx = () => getMaxHp(p.equipped), pw = GD.statMult(p.equipped, 'dmg'), duel = r.mode === 'gl_duel';
        const foe = duel ? Object.values(r.players).find(q => q.id !== p.id && q.hp > 0 && !q.out) : null, inR = (o, rad) => Math.hypot(o.x - p.x, o.y - p.y) <= rad;
        const out = { id: p.id, cls: C.id, x: Math.round(p.x), y: Math.round(p.y) };
        if (fx.cost) p.hp = Math.max(1, Math.round(p.hp * (1 - fx.cost)));
        if (fx.heal) p.hp = Math.min(mx(), p.hp + fx.heal);
        if (fx.healPct) p.hp = Math.min(mx(), p.hp + mx() * fx.healPct);
        if (fx.healMiss) p.hp = Math.min(mx(), p.hp + (mx() - p.hp) * fx.healMiss);
        if (fx.hot) rec.hot.push({ v: fx.hot[0], until: now + fx.hot[1] * 1000, next: now + 1000 });
        if (fx.t && (fx.spd || fx.dmg || fx.rate || fx.armor || fx.vamp || fx.rng)) { rec.fx.push({ until: now + fx.t * 1000, spd: fx.spd || 0, dmg: fx.dmg || 0, rate: fx.rate || 0, armor: fx.armor || 0, vamp: fx.vamp || 0, rng: fx.rng || 0 }); applyEq(G, rec); out.t = fx.t; }
        if (fx.barrier) { rec.barrier = { v: fx.barrier, until: now + (fx.t || 8) * 1000 }; out.t = fx.t || 8; }
        if (fx.invis) { p.buff = 'invisible'; p.buffEndTime = now + fx.invis * 1000; }
        if (fx.weapon) { p.buff = fx.weapon[0]; p.buffEndTime = now + fx.weapon[1] * 1000; }
        if (fx.blink) {
            const a = Number.isFinite(p.turretAngle) ? p.turretAngle : 0, dir = Math.sign(fx.blink), L = Math.abs(fx.blink), size = (MAP_DATA[r.map] || {}).size || 2400;
            for (let s = L; s >= 20; s -= 20) {
                const x = p.x + Math.cos(a) * s * dir, y = p.y + Math.sin(a) * s * dir;
                if (x > 40 && y > 40 && x < size - 40 && y < size - 40 && !checkCollisionServer(r.map, x, y, 26, [], r)) { out.to = { x: Math.round(x), y: Math.round(y) }; p.x = x; p.y = y; p.stuckIn = []; socket.emit('posFix', { x: Math.round(x), y: Math.round(y) }); break; }
            }
        }
        if (fx.pull && !duel) {      // стягнути зомбі до себе
            const [rad, dm] = fx.pull; out.r = rad;
            for (const id in r.zombies) { const z = r.zombies[id]; if (!inR(z, rad)) continue; const ang = Math.atan2(z.y - p.y, z.x - p.x), nx = p.x + Math.cos(ang) * 75, ny = p.y + Math.sin(ang) * 75; if (!checkCollisionServer(r.map, nx, ny, 15, [], r)) { z.x = nx; z.y = ny; } }
            D.area(r, p.x, p.y, 120, dm * pw, p.id);
        } else if (fx.pull && foe && inR(foe, fx.pull[0])) { out.r = fx.pull[0]; hitPlayer(r, p.id, foe, fx.pull[1] * pw); }
        if (fx.nova) {
            const [rad, dm, sec] = fx.nova; out.r = rad;
            if (sec) for (const id in r.zombies) { const z = r.zombies[id]; if (inR(z, rad)) z.stunUntil = now + sec * 1000; }
            if (dm) D.area(r, p.x, p.y, rad, dm * pw, p.id);
            if (foe && inR(foe, rad)) { if (sec) hiddenSet(foe, 'stunUntil', now + sec * 1000); if (dm) hitPlayer(r, p.id, foe, dm * pw); }
        }
        if (fx.stun) {
            const [rad, sec] = fx.stun; out.r = rad;
            for (const id in r.zombies) { const z = r.zombies[id]; if (inR(z, rad)) z.stunUntil = now + sec * 1000; }
            if (foe && inR(foe, rad)) hiddenSet(foe, 'stunUntil', now + sec * 1000);
        }
        if (fx.mines) { for (let i = 0; i < fx.mines; i++) { const a = i / fx.mines * Math.PI * 2, x = p.x + Math.cos(a) * 90, y = p.y + Math.sin(a) * 90; if (checkCollisionServer(r.map, x, y, 12, [], r)) continue; const id = 'glm_' + now + '_' + i; r.mines[id] = { id, x: Math.round(x), y: Math.round(y), owner: p.id, time: now }; } }
        out.k = Object.keys(fx).filter(k => k !== 't').join(',');
        io.to(r.id).emit('glAbil', out);
        socket.emit('glCd', { ms: C.ab.cd * 1000 });
        sendMe(G, rec);
    }

    // ---------- стан для клієнта ----------
    function broadcast(G) {
        if (!G || G.ph === 'end' && !G.hub) return;
        const now = now_(), D2 = G.duel;
        const st = {
            ph: G.ph, round: G.round, left: Math.max(0, G.t - now), hub: G.hub.id, betClose: BET_CLOSE, pick: G.picked ? 0 : Math.max(0, G.pickEnd - now),
            roster: Object.values(G.ps).map(q => ({ id: q.id, n: nickOf(q.name), l: q.lives, c: q.curse || 0, k: q.cls || null, o: q.out ? 1 : 0, x: q.left ? 1 : 0, w: q.room === G.hub.id ? 'hub' : q.room && rooms[q.room] ? (rooms[q.room].mode === 'gl_duel' ? 'duel' : 'arena') : '', d: q.done ? 1 : 0, p: q.place || 0, room: q.room })),
            duel: D2 ? { a: D2.a, b: D2.b, open: !!D2.open, bankA: sumOn(D2, D2.a), bankB: sumOn(D2, D2.b), room: D2.room || null, live: !!D2.room } : null
        };
        io.to(chan(G)).emit('glState', st);
    }
    const sumOn = (D2, id) => Object.values(D2.bets).filter(b => b.on === id).reduce((a, b) => a + b.amt, 0);
    function sendMe(G, rec) {
        if (!rec || rec.left) return;
        io.to(rec.id).emit('glMe', {
            cls: rec.cls, cd: Math.max(0, rec.cdUntil - now_()), pickLeft: G.picked ? 0 : Math.max(0, G.pickEnd - now_()),
            fxLeft: Math.max(0, ...(rec.fx || []).map(f => f.until - now_()), rec.barrier ? rec.barrier.until - now_() : 0), barrier: rec.barrier ? Math.round(rec.barrier.v) : 0,
            lives: rec.lives, curse: rec.curse || 0, cursePct: Math.round((rec.curse || 0) * CURSE_PCT * 100), lifeBought: rec.lifeBought, pts: rec.pts, out: rec.out, done: rec.done, place: rec.place, buys: rec.buys, cases: rec.cases, inv: rec.inv, eq: rec.eq, offer: rec.offer, bet: rec.bet, kills: rec.kills,
            price: { speed: priceBuy(rec.buys.speed), dmg: priceBuy(rec.buys.dmg), hp: priceBuy(rec.buys.hp), case: priceCase(rec.cases), life: LIFE_PRICE }, max: BUY_MAX, pct: BUY_PCT
        });
    }
    function onZombieKill(r, sid, z) {
        const G = G_of(r); if (!G || r.mode !== 'gl_arena') return;
        const rec = G.ps[sid]; if (!rec || rec.left || r._k.owner !== sid) return;
        const v = Math.min(50, PTS[z.type] || 10); rec.pts += v; rec.kills++;
        io.to(sid).emit('glPts', { v, x: Math.round(z.x), y: Math.round(z.y), left: Object.keys(r.zombies).length });
        sendMe(G, rec);
    }

    function bind(socket) {
        socket.on('glBuy', d => buy(socket, d));
        socket.on('glPick', d => pick(socket, d));
        socket.on('glEquip', d => equip(socket, d));
        socket.on('glBet', d => bet(socket, d));
        socket.on('glWatch', d => watch(socket, d));
        socket.on('glClass', d => pickClass(socket, d));
        socket.on('glAbility', d => useAbility(socket, d));
        socket.on('glSync', d => { const r = d && rooms[d.roomId], G = G_of(r), rec = G && G.ps[socket.id]; if (rec && !rec.left) { sendMe(G, rec); broadcast(G); } });
    }
    // скільки людей у сесії (для списку сесій): учасники, які ще не вийшли
    function count(r) { const G = r && r._gl; return G ? recs(G).length : null; }
    // id сокетів усіх учасників гри (спільний чат), або null — якщо це не Форум під час гри
    function members(r) { const G = r && r._gl; return G ? recs(G).map(q => q.id) : null; }
    const noDmg = r => isHub(r) && !!r._gl;      // Форум: шкоди немає (цифри показуються)
    const noPowerups = m => m === 'gladiators' || m === 'gl_arena' || m === 'gl_duel';

    return { start, tick, onDeath, onLeave, onZombieKill, bind, owns, isHub, count, members, noDmg, noPowerups, taken, dealt, HUB, ZONES, G_of };
};
