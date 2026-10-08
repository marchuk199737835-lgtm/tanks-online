/* bots_ai.js — бойовий ШІ ботів (серверна симуляція). Підключається з bots.js: require('./bots_ai.js')(ctx, CFG).
 *
 * Бот — звичайний запис у room.players (див. bots.js); тут він отримує «мозок» (brain): персональні риси, виведені з рівня й модулів
 * (більше урону → агресивніший, більше здоров'я/броні → йде напролом, швидкість/перезарядка → маневрує), автомат станів
 * (блукання / пошук / бій / відступ / збір предметів / зона БР / точки), рух зі стінами (checkCollisionServer), пошук шляху (Nav),
 * повороти корпусу й башти зі скінченною швидкістю, стрільбу з серверною симуляцією снарядів (клієнтам летить той самий 'spawnBullet'),
 * ухилення від снарядів, відступ при малому HP, виявлення застрягання.
 *
 * Частоти: фізика/стрільба — ~25 Гц (ticker у bots.js), рішення («думка») кожного бота — 10 Гц зі стелею часу на кадр (CFG.thinkBudgetMs).
 * Вся симуляція ведеться за Date.now() (тести можуть підміняти годинник).
 */
'use strict';
const MapObj = require('./public/js/mapobjects.js');
const Nav = require('./navgrid.js');
const GD = require('./public/js/gamedata.js');
const ModeInfo = require('./public/js/modeinfo.js');
let perfNow; try { perfNow = require('perf_hooks').performance.now.bind(require('perf_hooks').performance); } catch (e) { perfNow = () => Date.now(); }

module.exports = function createAI(ctx, CFG) {
    CFG = CFG || {};
    const { io, rooms, Modes, MAP_DATA } = ctx;
    const THINK_MS = CFG.thinkMs || 100, THINK_BUDGET = CFG.thinkBudgetMs || 6;

    // ---- константи (дзеркало клієнтських: config.js / game.js) ----
    const BASE_SPEED = 200, BASE_TURRET_ROT = 8, BASE_BULLET_SPEED = 700, BODY_R = 22, HIT_R = 24, BASE_RELOAD = 2000;
    const SIGHT = 980;                                  // дальність «бачення» (екран гравця приблизно такий)
    // Типи снарядів, які бот створює (як у людини: стандартний + підібраний бафф). dmg — як window.BUFFS на клієнті
    const BT = {
        none: { dmg: 75, spd: 1, life: 2.5, walls: true }, explosive: { dmg: 250, spd: 1, life: 2.5, walls: true, splash: 120 },
        minigun: { dmg: 25, spd: 1.8, life: 2.5, walls: true, rt: 150 }, shotgun: { dmg: 25, spd: 1, life: 1.2, walls: true, pellets: 20 },
        homing: { dmg: 125, spd: 1.25, life: 2.5, walls: false, homing: true }, piercing: { dmg: 50, spd: 1, life: 2.5, walls: false, pierce: true },
        incendiary: { dmg: 75, spd: 1, life: 2.5, walls: true, fire: true }, samurai: { dmg: 75, spd: 100 / 700, life: 0.15, walls: false, extra: 30, fixedLife: true },
        healing: { dmg: 75, spd: 1, life: 2.5, walls: true }, shield: { dmg: 75, spd: 1, life: 2.5, walls: true }
    };
    const FIRING_BUFFS = new Set(Object.keys(BT));   // бафи, з якими бот стріляє; 'autolaser' / 'reaper' обробляються окремо, 'boss' ігнорується
    const WANT_BUFF = { healing: 1, shield: 1.3, minigun: 1.5, explosive: 1.3, homing: 1.2, piercing: 1.0, shotgun: 1.0, incendiary: 0.9, samurai: 0.7, autolaser: 1.2, reaper: 0.8 };

    const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    const lerp = (a, b, t) => a + (b - a) * t;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    const SM = (e, k) => GD.statMult(e, k);
    const isTeamMode = r => r.mode === 'team_deathmatch' || r.mode === 'capture_points';
    const mapOf = r => MAP_DATA[r.map] || MAP_DATA['epic_map'] || Object.values(MAP_DATA)[0];
    const LOSOPT = { skipWater: true, doorOpen: () => false };
    const BULLETOPT = { skipWater: true, doorOpen: () => false };

    const brains = new Map();     // botId -> brain
    const rsMap = new Map();      // roomId -> { bullets:[], last, t0 }
    const perf = { steps: 0, ms: 0, maxMs: 0, thinks: 0, thinkMs: 0, maxThinkMs: 0, skipped: 0, shots: 0, hits: 0, stuck: 0, teleports: 0, dodges: 0, botsLast: 0 };

    // ---------- геометрія ----------
    function boundsOf(map) { return MapObj.hasShape(map) ? MapObj.shapeBounds(map.shape) : { x0: 0, y0: 0, x1: map.size, y1: map.size }; }
    function los(map, x0, y0, x1, y1) {
        const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy); if (d < 40) return true;
        const n = Math.ceil(d / 26);
        for (let i = 1; i < n; i++) { const t = i / n; if (MapObj.collides(map, x0 + dx * t, y0 + dy * t, 3, LOSOPT)) return false; }
        return true;
    }
    const reachCache = new WeakMap();
    function reachOf(map) {   // досяжні клітинки (від найбільшої зв'язної області навколо спавнів) — щоб не ставити цілі в закриті кишені
        let e = reachCache.get(map); if (e) return e;
        const cls = Nav.navClass(BODY_R), grid = Nav.getGrid(map, cls), N = grid.N;
        const srcs = map.solids.filter(o => o.type === 'spawn_player').slice(0, 4).map(o => ({ x: o.x, y: o.y }));
        const b = boundsOf(map); srcs.push({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
        let best = null, bc = -1;
        for (const q of srcs) { const f = Nav.buildField(grid, q.x, q.y); let c = 0; for (let i = 0; i < f.dist.length; i++) if (f.dist[i] >= 0) c++; if (c > bc) { bc = c; best = f; } }
        e = { grid, N, dist: best ? best.dist : null, ok: bc > 20 };
        reachCache.set(map, e); return e;
    }
    function reachable(map, x, y) {
        const e = reachOf(map); if (!e.ok) return true;
        const cx = Math.floor(x / Nav.CS), cy = Math.floor(y / Nav.CS); if (cx < 0 || cy < 0 || cx >= e.N || cy >= e.N) return false;
        return e.dist[cy * e.N + cx] >= 0;
    }
    function freeAt(room, x, y, r) { return !ctx.checkCollisionServer(room.map, x, y, r || BODY_R, [], room); }
    function randomPoint(room, opt) {
        opt = opt || {}; const map = mapOf(room), b = boundsOf(map);
        for (let i = 0; i < 40; i++) {
            let x, y;
            if (opt.cx !== undefined) { const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * opt.cr; x = opt.cx + Math.cos(a) * d; y = opt.cy + Math.sin(a) * d; }
            else { x = rnd(b.x0 + 80, b.x1 - 80); y = rnd(b.y0 + 80, b.y1 - 80); }
            if (opt.minD && opt.fx !== undefined && Math.hypot(x - opt.fx, y - opt.fy) < opt.minD) continue;
            if (opt.maxD && opt.fx !== undefined && Math.hypot(x - opt.fx, y - opt.fy) > opt.maxD) continue;
            if (!reachable(map, x, y) || !freeAt(room, x, y, 30)) continue;
            return { x, y };
        }
        return ctx.getValidSpawn(room.map, 30, 'spawn_player');
    }

    // ---------- «мозок»: персональні риси ----------
    // hint — необов'язкові перевизначення (тести): bold, erratic, skill, flank, camp, greed
    function newBrain(p, hint) {
        hint = hint || {};
        const L = p.level || 1, lv = clamp((L - 1) / 14, 0, 1);
        const skill = hint.skill !== undefined ? hint.skill : clamp(0.28 + 0.52 * lv + gauss() * 0.12, 0.1, 0.95);
        const B = {
            id: p.id, skill, bold: hint.bold !== undefined ? hint.bold : Math.random(), erratic: hint.erratic !== undefined ? hint.erratic : Math.random(),
            flankPref: hint.flank !== undefined ? hint.flank : Math.random(), campPref: hint.camp !== undefined ? hint.camp : Math.random() * 0.8, greed: hint.greed !== undefined ? hint.greed : Math.random(),
            reactionMs: lerp(640, 210, skill) * rnd(0.8, 1.25), aimSigma: lerp(0.105, 0.034, skill) * rnd(0.85, 1.2), leadQ: clamp(lerp(0.35, 0.95, skill) + gauss() * 0.08, 0.2, 1),
            sig: '', dmgM: 1, hpM: 1, spdM: 1, cdM: 1, rotM: 1, rngM: 1, aggr: 0.5, charge: 0.4, agility: 0.4, retreatHp: 0.35, dPref: 320, dodgeP: 0.3, archetype: 'balanced',
            state: 'wander', stateSince: 0, nextThink: 0, started: false, startAt: 0, roomKey: null,
            dir: null, speedF: 1, wp: null, pathAt: 0, pathKey: '', navKey: {}, goal: null, goalAt: 0, goalKind: '',
            target: null, tgtObj: null, engageAt: 0, canEngage: false, mem: Object.create(null), tr: Object.create(null), losC: Object.create(null), awareAt: 0, aware: null,
            lastHp: p.hp, lastHitAt: 0, lastAttacker: null, recentDmg: 0, dmgAt: 0,
            strafeDir: Math.random() < 0.5 ? 1 : -1, strafeUntil: 0, pauseUntil: 0, dodgeUntil: 0, dodgeDir: null, dodged: Object.create(null), reverseUntil: 0,
            cover: null, retreatSince: 0, retreatUntil: 0, hiddenSince: 0, braveUntil: 0, lastSeenFoeAt: 0,
            aimAng: p.turretAngle || 0, aimBias: 0, aimBiasUntil: 0, wantFire: false, fireTol: 0.08, reloadAt: 0, fireOkAt: 0, mistake: false,
            stuckT: 0, stuckExp: 0, stuckAct: 0, stuckCount: 0, unstuckUntil: 0, unstuckDir: null, lastGoodMove: 0,
            flankPt: null, flankUntil: 0, campUntil: 0, campPt: null, wasDead: false, wanderUntil: 0,
            stat: { shots: 0, hits: 0, retreats: 0, dodges: 0, stuck: 0, thinkN: 0, retreatMs: 0, combatMs: 0, distSum: 0, distN: 0, flips: 0, kills: 0, deaths: 0, items: 0, stateT: Object.create(null) }
        };
        deriveGear(B, p);
        return B;
    }
    // Риси, що залежать від поточних модулів (у БР змінюються підбором): агресія / напролом / маневреність / поріг відступу / дистанція бою
    function deriveGear(B, p) {
        const e = p.equipped || {}, sig = (e.cannon || '-') + (e.turret || '-') + (e.hull || '-') + (e.tracks || '-'); if (sig === B.sig) return; B.sig = sig;
        const dmgM = SM(e, 'dmg'), hpM = SM(e, 'hp'), spdM = SM(e, 'speed'), cdM = SM(e, 'cd'), rotM = SM(e, 'rotSpeed'), rngM = SM(e, 'range');
        B.dmgM = dmgM; B.hpM = hpM; B.spdM = spdM; B.cdM = cdM; B.rotM = rotM; B.rngM = rngM;
        const offense = clamp((Math.log(dmgM) + Math.log(1 / cdM)) / Math.log(1.6), -1, 1.5);
        const tank = clamp(Math.log(hpM) / Math.log(1.45), -0.6, 1.3);
        const mob = clamp((Math.log(spdM) + 0.5 * Math.log(1 / cdM) + 0.5 * Math.log(rotM)) / Math.log(1.4), -0.6, 1.3);
        B.offense = offense; B.tankiness = tank; B.mobility = mob;
        B.aggr = clamp(0.42 + 0.3 * offense + 0.1 * tank - 0.06 * mob + (B.bold - 0.5) * 0.34, 0.05, 0.98);
        B.charge = clamp(0.22 + 0.55 * tank + 0.12 * B.aggr + (B.bold - 0.5) * 0.2, 0, 1);
        B.agility = clamp(0.3 + 0.5 * mob + (B.erratic - 0.5) * 0.28 - 0.1 * B.charge, 0, 1);
        B.retreatHp = clamp(0.37 + 0.26 * (0.5 - B.aggr) - 0.2 * B.charge + 0.12 * (0.5 - B.bold), 0.12, 0.55);
        B.dPref = Math.max(120, lerp(500, 190, B.aggr) * (1 - 0.32 * B.charge) * (1 + 0.14 * mob));
        B.dodgeP = clamp(lerp(0.18, 0.7, B.skill) * (0.45 + 0.65 * B.agility) * (1 - 0.65 * B.charge), 0.03, 0.85);
        B.recoverS = lerp(22, 9, B.bold);   // скільки секунд ховається, перш ніж «відважитись» повернутись у бій
        const sc = { assault: offense + 0.15, tank: tank + 0.1 * (B.charge), fast: mob }; let a = 'balanced', bv = 0.28;
        for (const k in sc) if (sc[k] > bv) { bv = sc[k]; a = k; }
        B.archetype = a;
    }
    function brainOf(p, hint) { let B = brains.get(p.id); if (!B) { B = newBrain(p, hint); brains.set(p.id, B); } return B; }

    // ---------- стан кімнати ----------
    function rsOf(room, create) {
        let RS = rsMap.get(room.id);
        if (!RS && create) { RS = { bullets: [], last: Date.now(), t0: Date.now(), seq: 0, room }; rsMap.set(room.id, RS); }
        if (RS && RS.room !== room) { RS = null; rsMap.delete(room.id); if (create) { RS = { bullets: [], last: Date.now(), t0: Date.now(), seq: 0, room }; rsMap.set(room.id, RS); } }
        return RS || null;
    }

    // ---------- шкода / снаряди ----------
    function hitPlayer(room, b, v, dmgBase) {
        if (!v || v.hp <= 0 || v.out || v.buff === 'shield') return false;
        const atk = room.players[b.owner]; if (!atk) return false;
        if (ctx.isTeamPvp(room.mode) && atk.team && atk.team === v.team) return false;
        if (Modes.has(room.mode) && (atk.hp <= 0 || atk.out)) return true;      // снаряд «з'їдається», але шкоди немає (так само відхиляє registerHit)
        const fD = dmgBase * SM(atk.equipped, 'dmg'), now = Date.now();
        const BTt = BT[b.type] || BT.none;
        if (BTt.fire) v.onFire = { end: now + 5000, nextTick: now + 1000, owner: b.owner };
        v.hp = Math.max(0, v.hp - fD);
        const bv = brains.get(v.id); if (bv) { bv.lastAttacker = b.owner; bv.lastHitAt = now; }
        perf.hits++; const ba = brains.get(b.owner); if (ba) { ba.stat.hits++; if (v.hp === 0) ba.stat.kills++; }
        if (v.hp === 0) ctx.processPlayerDeath(room, v.id, b.owner, { weapon: b.type });
        return true;
    }
    function explode(room, b, x, y, skipId) {
        const R = (BT[b.type] || BT.none).splash; if (!R) return;
        for (const id in room.players) {
            if (id === skipId) continue; const q = room.players[id];
            if (q.hp <= 0 || q.out || q.buff === 'shield' || Math.hypot(q.x - x, q.y - y) >= R) continue;
            hitPlayer(room, b, q, (BT[b.type] || BT.none).dmg);
        }
    }
    function stepBullets(room, RS, dt) {
        const map = mapOf(room), arr = RS.bullets, bnd = boundsOf(map);
        for (let i = arr.length - 1; i >= 0; i--) {
            const b = arr[i], T = BT[b.type] || BT.none; let dead = false;
            b.life -= dt; if (b.life <= 0) { arr.splice(i, 1); continue; }
            if (T.homing && b.targetId) { const t = room.players[b.targetId]; if (t && t.hp > 0) { const a = Math.atan2(t.y - b.y, t.x - b.x), s = Math.hypot(b.vx, b.vy); b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s; } }
            const sp = Math.hypot(b.vx, b.vy), n = Math.max(1, Math.ceil(sp * dt / 12)), sdt = dt / n;
            for (let k = 0; k < n && !dead; k++) {
                b.x += b.vx * sdt; b.y += b.vy * sdt;
                if (T.walls) { if (MapObj.collides(map, b.x, b.y, 4, BULLETOPT)) { dead = true; break; } }
                else if (b.x - 4 < 0 || b.x + 4 > map.size || b.y - 4 < 0 || b.y + 4 > map.size || (MapObj.hasShape(map) && !MapObj.circleInPoly(map.shape, b.x, b.y, 4))) { dead = true; break; }
                if (b.ghost) continue;
                const hr = HIT_R + 4 + (T.extra || 0);
                for (const id in room.players) {
                    if (id === b.owner) continue; const q = room.players[id];
                    if (q.hp <= 0 || q.out || q.buff === 'shield' || q.isDisguised) continue;
                    if (Math.hypot(b.x - q.x, b.y - q.y) >= hr) continue;
                    if (ctx.isTeamPvp(room.mode) && room.players[b.owner] && room.players[b.owner].team === q.team) continue;
                    if (T.pierce) { if (b.pierced.indexOf(id) >= 0) continue; b.pierced.push(id); hitPlayer(room, b, q, T.dmg); continue; }
                    hitPlayer(room, b, q, T.dmg);
                    if (T.splash) explode(room, b, b.x, b.y, id);
                    dead = true; break;
                }
            }
            if (dead) arr.splice(i, 1);
        }
    }
    function fireShot(room, RS, B, p, now) {
        let t = p.buff && FIRING_BUFFS.has(p.buff) ? p.buff : 'none'; const T = BT[t];
        const ang = p.turretAngle, c = Math.cos(ang), s = Math.sin(ang), rng = B.rngM;
        let bs = BASE_BULLET_SPEED * T.spd;
        const data = { roomId: room.id, id: now + Math.random(), x: p.x + c * (HIT_R + (t === 'samurai' ? 15 : 10)), y: p.y + s * (HIT_R + (t === 'samurai' ? 15 : 10)), vx: c * bs, vy: s * bs, type: t, lifeMult: rng, owner: p.id, pierced: [] };
        if (t === 'homing' && B.target) data.targetId = B.target;
        io.to(room.id).emit('spawnBullet', data);
        const mk = (vx, vy, life) => ({ id: data.id, owner: p.id, x: data.x, y: data.y, vx, vy, type: t, life, pierced: [], targetId: data.targetId, ghost: false });
        if (T.pellets) { for (let i = 0; i < T.pellets; i++) { const a = ang + (Math.random() - 0.5) * 0.6, sp = BASE_BULLET_SPEED * (0.8 + Math.random() * 0.4); RS.bullets.push(mk(Math.cos(a) * sp, Math.sin(a) * sp, T.life * rng)); } }
        else RS.bullets.push(mk(data.vx, data.vy, T.fixedLife ? T.life : T.life * rng));
        B.stat.shots++; perf.shots++;
        const rt = T.rt ? T.rt : BASE_RELOAD * B.cdM * rnd(1.0, 1.06);
        B.reloadAt = now + rt;
    }
    function layMine(room, B, p, now) {
        const mId = 'mine_' + now + Math.random();
        room.mines[mId] = { id: mId, x: p.x + Math.cos(p.turretAngle) * (HIT_R + 10), y: p.y + Math.sin(p.turretAngle) * (HIT_R + 10), owner: p.id, time: now };
        B.reloadAt = now + BASE_RELOAD * B.cdM;
    }

    // ---------- сприйняття ----------
    function ownMaxHp(p) { return ctx.getMaxHp(p.equipped) || 500; }
    function perceive(room, B, p, now, map) {
        const team = isTeamMode(room), list = [];
        for (const id in room.players) {
            const q = room.players[id]; if (q === p || q.hp <= 0 || q.out || q.spectator) continue;
            if (team && q.team && q.team === p.team) continue;
            list.push({ q, id, d: Math.hypot(q.x - p.x, q.y - p.y), vis: false });
        }
        list.sort((a, b) => a.d - b.d);
        let n = 0;
        for (const e of list) {
            const q = e.q;
            // швидкість цілі (згладжена) — для упередження
            let tr = B.tr[e.id]; if (!tr) tr = B.tr[e.id] = { x: q.x, y: q.y, t: now, vx: 0, vy: 0 };
            const dtS = (now - tr.t) / 1000;
            if (dtS >= 0.05) {
                if (Math.hypot(q.x - tr.x, q.y - tr.y) > 160) { tr.vx = 0; tr.vy = 0; }
                else { let vx = (q.x - tr.x) / dtS, vy = (q.y - tr.y) / dtS; const m = Math.hypot(vx, vy); if (m > 420) { vx *= 420 / m; vy *= 420 / m; } tr.vx = lerp(tr.vx, vx, 0.5); tr.vy = lerp(tr.vy, vy, 0.5); }
                tr.x = q.x; tr.y = q.y; tr.t = now;
            }
            if (e.d <= SIGHT && n < 5 && !(q.buff === 'invisible' && e.d > 260)) {
                n++; let lc = B.losC[e.id];
                if (!lc || now - lc.t > 170) lc = B.losC[e.id] = { t: now, v: los(map, p.x, p.y, q.x, q.y) };
                e.vis = lc.v;
            }
            if (e.vis) B.mem[e.id] = { x: q.x, y: q.y, t: now };
        }
        return list;
    }
    function hpFrac(q) { return q.hp / (ctx.getMaxHp(q.equipped) || 500); }

    // ---------- зона БР / режимні дані ----------
    function modeState(room) { try { return Modes.has(room.mode) && Modes.MS ? Modes.MS.get(room.id) : null; } catch (e) { return null; } }
    function zoneDanger(room, p, S) {
        if (room.mode !== 'battle_royale' || !S || !S.zone || p.hp <= 0) return null;
        const Z = S.zone, d = Math.hypot(p.x - Z.x, p.y - Z.y), shrinking = Z.ph > 0 || Date.now() >= (S.zStart || 0);
        const margin = shrinking ? 90 : 20;
        if (d > Z.r - margin) return { cx: Z.x, cy: Z.y, r: Z.r, out: d > Z.r, d };
        return null;
    }

    // ---------- предмети ----------
    function modValue(B, p, u) {
        const m = GD.MODULES[u.mod]; if (!m || !p.realEq) return -1;
        const cur = p.equipped[m.type], curM = cur && GD.MODULES[cur];
        const RO = GD.RARITY_ORDER, ri = RO.indexOf(m.rarity);
        if (curM && ri <= RO.indexOf(curM.rarity)) return -1;
        const gain = ri - (curM ? RO.indexOf(curM.rarity) : -1);
        const w = { cannon: 1 + 0.45 * B.offense, turret: 0.9 + 0.2 * B.tankiness, hull: 1 + 0.4 * B.tankiness, tracks: 0.9 + 0.35 * B.mobility }[m.type] || 1;
        return gain * w * (1 + 0.25 * ri);
    }
    function wantPowerup(B, p, u, hpF) {
        if (!u.active || u.mod || !WANT_BUFF[u.type]) return -1;
        let v = WANT_BUFF[u.type];
        if (u.type === 'healing') v = hpF < 0.85 ? 0.6 + (1 - hpF) * 3.5 : 0.1;
        else if (u.type === 'minigun' || u.type === 'explosive' || u.type === 'samurai' || u.type === 'shotgun') v *= 0.6 + B.aggr;
        else if (u.type === 'shield') v *= 0.8 + (1 - hpF);
        if (p.buff && p.buff !== 'none' && p.buffEndTime - Date.now() > 4000 && u.type !== 'healing') v *= 0.3;
        return v;
    }
    function pickupsTick(room, RS, B, p, now, hpF) {
        const PU = room.powerups;
        if (PU) for (const pid in PU) {
            const u = PU[pid]; if (!u || Math.hypot(u.x - p.x, u.y - p.y) > 56) continue;
            if (u.mod) { if (modValue(B, p, u) > 0 && Modes.pickMod(room, p.id, pid)) { B.stat.items++; B.goal = null; } continue; }
            if (!u.active || !ctx.powerupsOn(room.mode)) continue;
            if (wantPowerup(B, p, u, hpF) < 0.25) continue;
            p.buff = u.type; p.buffEndTime = now + ctx.BUFF_DURATION; u.active = false;
            if (u.type === 'healing') { p.hp = Math.min(ownMaxHp(p), p.hp + 150); p.nextHeal = now + 1000; }
            io.to(room.id).emit('powerupCollected', { pid, playerId: p.id, type: u.type });
            delete PU[pid]; B.stat.items++; B.goal = null; break;
        }
        if (room.mode === 'deathmatch' && room.tokens) for (const tid in room.tokens) {
            const t = room.tokens[tid]; if (!t || !t.active || Math.hypot(t.x - p.x, t.y - p.y) > 50) continue;
            ctx.collectTokenFor(room.id, p.id, tid); B.stat.items++; B.goal = null; break;
        }
    }

    // ---------- вибір цілі руху ----------
    function setState(B, st, now) { if (B.state !== st) { B.state = st; B.stateSince = now; } }
    function pickItemGoal(room, B, p, now, hpF, S) {
        let best = null, bs = 0;
        const PU = room.powerups || {};
        for (const pid in PU) {
            const u = PU[pid]; if (!u) continue; const d = Math.hypot(u.x - p.x, u.y - p.y);
            if (u.mod) {
                const v = modValue(B, p, u); if (v <= 0) continue;
                const lim = u.keep ? 2400 : 1250 + 500 * B.greed; if (d > lim) continue;
                if (u.keep && S && S.air && S.air.cur && S.air.cur.st === 'open' && B.aggr < 0.15) continue;
                const sc = v * 520 + 200 - d * 0.75; if (sc > bs) { bs = sc; best = { x: u.x, y: u.y, kind: 'mod', id: pid }; }
            } else {
                const w = wantPowerup(B, p, u, hpF); if (w < 0.25) continue;
                const lim = (u.type === 'healing' && hpF < 0.6) ? 2600 : 1000 + 700 * B.greed; if (d > lim) continue;
                const sc = w * 520 - d * 0.6; if (sc > bs) { bs = sc; best = { x: u.x, y: u.y, kind: 'pu', id: pid }; }
            }
        }
        if (room.mode === 'deathmatch' && room.tokens) for (const tid in room.tokens) {
            const t = room.tokens[tid]; if (!t || !t.active) continue; const d = Math.hypot(t.x - p.x, t.y - p.y);
            const sc = 520 + 380 * B.greed - d * 0.75; if (d < 1500 && sc > bs) { bs = sc; best = { x: t.x, y: t.y, kind: 'token', id: tid }; }
        }
        return best;
    }
    function objectiveGoal(room, B, p, now, S) {
        if (room.mode === 'capture_points' && S && S.pts) {
            let best = null, bs = -1e9;
            for (const pt of S.pts) {
                const mine = pt.o === p.team, d = Math.hypot(pt.x - p.x, pt.y - p.y);
                let sc = -d * 0.5 + (mine ? (B.campPref > 0.45 ? 260 : -200) : 420) + (pt.w && pt.w !== p.team ? 120 : 0) + (B.goal && B.goal.id === pt.i ? 160 : 0);
                if (sc > bs) { bs = sc; best = { x: pt.x + rnd(-45, 45), y: pt.y + rnd(-45, 45), kind: 'point', id: pt.i, r: pt.r }; }
            }
            if (best) return best;
        }
        if (room.mode === 'battle_royale' && S && S.zone) {
            const Z = S.zone; let pt;
            if (S.air && S.air.cur && S.air.cur.st === 'open' && B.aggr > 0.35 && Math.hypot(S.air.cur.x - p.x, S.air.cur.y - p.y) < 1800) return { x: S.air.cur.x, y: S.air.cur.y, kind: 'drop', id: S.air.cur.id };
            pt = randomPoint(room, { cx: Z.x, cy: Z.y, cr: Math.max(60, Z.r * 0.7) });
            return { x: pt.x, y: pt.y, kind: 'patrol' };
        }
        // блукання: бафи на мапі (точки спавну) / випадкові точки
        const map = mapOf(room);
        if (ctx.powerupsOn(room.mode) && Math.random() < 0.45) {
            const sp = map.solids.filter(o => o.type === 'spawn_powerup'); if (sp.length) { const o = sp[Math.floor(Math.random() * sp.length)]; if (reachable(map, o.x, o.y)) return { x: o.x, y: o.y, kind: 'patrol' }; }
        }
        const pt = randomPoint(room, { fx: p.x, fy: p.y, minD: 350 });
        return { x: pt.x, y: pt.y, kind: 'patrol' };
    }
    // Укриття: вільна точка, яку не видно із позицій загроз (за перешкодою), не надто далеко; повертає {x,y} або null
    function findCover(room, B, p, threats, S) {
        const map = mapOf(room); let best = null, bs = -1e9;
        const Z = (room.mode === 'battle_royale' && S && S.zone) ? S.zone : null;
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2 + rnd(-0.2, 0.2), d = rnd(150, 430), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
            if (!freeAt(room, x, y, 28) || !reachable(map, x, y)) continue;
            if (Z && Math.hypot(x - Z.x, y - Z.y) > Z.r - 80) continue;
            let hidden = 0, away = 0;
            for (const t of threats) { if (!los(map, x, y, t.x, t.y)) hidden++; away += Math.hypot(x - t.x, y - t.y); }
            if (threats.length) away /= threats.length;
            const sc = hidden * 420 + away * 0.55 - d * 0.5 + rnd(0, 60);
            if (sc > bs) { bs = sc; best = { x, y, hidden: hidden === threats.length }; }
        }
        return best;
    }

    // ---------- мислення (10 Гц) ----------
    function think(room, RS, B, p, now) {
        const t0 = perfNow(), map = mapOf(room), S = modeState(room);
        deriveGear(B, p);
        const mx = ownMaxHp(p), hpF = p.hp / mx;
        // облік отриманої шкоди
        if (p.hp < B.lastHp - 0.5) { B.recentDmg = (B.recentDmg || 0) + (B.lastHp - p.hp); B.dmgAt = now; } else if (now - B.dmgAt > 3500) B.recentDmg = 0;
        B.lastHp = p.hp;
        const list = perceive(room, B, p, now, map);
        // ціль
        let best = null, bsc = -1e9;
        const bountyT = (room.mode === 'bounty' && S) ? S.target : null;
        for (const e of list) {
            if (e.d > 1500 && !e.vis) continue;
            let s = -e.d * (e.vis ? 1 : 2.4) + (e.vis ? 420 : 0) + (1 - hpFrac(e.q)) * 260 * B.aggr;
            if (B.target === e.id) s += 230;
            if (B.lastAttacker === e.id && now - B.lastHitAt < 4500) s += 220;
            if (bountyT === e.id) s += 380 * B.aggr;
            if (e.q.buff === 'shield') s -= 450;
            if (s > bsc) { bsc = s; best = e; }
        }
        const prevT = B.target;
        B.target = best ? best.id : null; B.tgtObj = best ? best.q : null;
        const vis = best && best.vis;
        if (vis) { if (!B.engageAt || prevT !== B.target) B.engageAt = now + B.reactionMs * rnd(0.8, 1.3); }
        else if (!best || now - (B.mem[B.target] ? B.mem[B.target].t : 0) > 2500) B.engageAt = 0;
        B.canEngage = !!vis && B.engageAt > 0 && now >= B.engageAt;
        const foeNear = list.length ? list[0] : null;
        if (foeNear && foeNear.vis) B.lastSeenFoeAt = now;
        const threatened = (foeNear && foeNear.vis && foeNear.d < 760) || now - B.dmgAt < 2500;

        // ухилення від снарядів (раз на снаряд, з імовірністю за «рівнем»)
        dodgeCheck(room, RS, B, p, now, hpF);

        // ---- пріоритет 1: зона БР ----
        const zd = zoneDanger(room, p, S);
        // ---- пріоритет 2: відступ ----
        let thr = B.retreatHp; if (now < B.braveUntil) thr *= 0.45; if (bountyT === p.id) thr += 0.12;
        let st = B.state;
        if (st === 'retreat') {
            const hidden = !(foeNear && foeNear.vis);
            if (hidden) { if (!B.hiddenSince) B.hiddenSince = now; } else B.hiddenSince = 0;
            const healed = hpF > thr + 0.22;
            const brave = now > B.retreatUntil && B.hiddenSince && now - B.hiddenSince > B.recoverS * 1000;
            if (healed || brave) { if (brave && !healed) B.braveUntil = now + 28000; setState(B, 'seek', now); B.cover = null; B.goal = null; st = 'seek'; }
        } else if (hpF < thr && (threatened || (foeNear && foeNear.d < 900)) && p.hp > 0) {
            setState(B, 'retreat', now); st = 'retreat'; B.retreatSince = now; B.retreatUntil = now + rnd(5500, 9500); B.hiddenSince = 0; B.cover = null; B.stat.retreats++; B.goal = null;
        }

        // ---- виконання станів ----
        B.mv = null; B.wantFire = false; B.flee = false; B.speedF = 1;
        const foePts = list.filter(e => e.d < 1000 && (e.vis || now - (B.mem[e.id] ? B.mem[e.id].t : 0) < 4000)).slice(0, 3).map(e => ({ x: e.q.x, y: e.q.y }));
        if (st === 'retreat') {
            if (!B.cover || now - (B.cover.at || 0) > 3500 || (foeNear && foeNear.vis && B.cover.hidden === false)) {
                const th = foePts.length ? foePts : (B.mem[B.target] ? [B.mem[B.target]] : []);
                const cv = findCover(room, B, p, th, S);
                if (cv) { cv.at = now; B.cover = cv; }
                else if (th.length) { // тікаємо від загроз
                    const t0p = th[0], a = Math.atan2(p.y - t0p.y, p.x - t0p.x) + rnd(-0.7, 0.7), d = rnd(250, 420), x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
                    B.cover = { x: freeAt(room, x, y, 28) ? x : p.x, y: freeAt(room, x, y, 28) ? y : p.y, hidden: false, at: now };
                }
            }
            const cv = B.cover;
            if (cv && Math.hypot(cv.x - p.x, cv.y - p.y) > 55) { B.mv = { kind: 'goal', x: cv.x, y: cv.y }; B.speedF = 1; }
            else {
                // у схованці: вичікуємо, дивимось на загрозу; за можливості добираємо аптечку
                const hp = pickItemGoal(room, B, p, now, hpF, S);
                if (hp && (hp.kind === 'pu') && PUtype(room, hp) === 'healing' && !(foeNear && foeNear.vis && foeNear.d < 450)) B.mv = { kind: 'goal', x: hp.x, y: hp.y };
                else B.mv = { kind: 'hold' };
            }
            // «загнаний»: ворог близько й дивиться на нас — відстрілюємось
            if (best && vis) {
                const cornered = best.d < 300 || (cv && Math.hypot(cv.x - p.x, cv.y - p.y) < 60 && best.d < 520);
                B.wantFire = (cornered || Math.random() < 0.28 * (1 - B.charge * 0.2)) && best.d < 800;
            }
            if (zd) B.mv = { kind: 'goal', x: zd.cx + rnd(-60, 60), y: zd.cy + rnd(-60, 60) };
        } else if (zd) {
            setState(B, 'zone', now);
            B.mv = { kind: 'goal', x: zd.cx + rnd(-90, 90) * 0 + Math.cos(now / 4000) * zd.r * 0.15, y: zd.cy + Math.sin(now / 4000) * zd.r * 0.15 }; B.speedF = 1;
            if (best && vis) B.wantFire = best.d < 750;
        } else if (best && (vis || (now - (B.mem[B.target] ? B.mem[B.target].t : 0) < 5000))) {
            // ---- бій / погоня ----
            if (vis && B.canEngage) { setState(B, 'combat', now); combatMove(room, B, p, best, now, hpF, map); B.wantFire = fireDiscipline(B, best, now); }
            else if (vis) { setState(B, 'combat', now); B.mv = { kind: 'hold' }; B.speedF = 0.4; }   // реакція: бот помітив ціль, але ще не відреагував
            else {
                setState(B, 'seek', now); const m = B.mem[B.target];
                if (m && B.aggr + B.greed * 0.1 > 0.22) B.mv = { kind: 'goal', x: m.x, y: m.y, hunt: true };
                else B.mv = { kind: 'hold' };
            }
        } else {
            // ---- немає цілі: предмети / завдання режиму / блукання ----
            const item = pickItemGoal(room, B, p, now, hpF, S);
            if (item && (hpF < 0.7 || !threatened)) { setState(B, 'collect', now); B.goal = item; B.goalAt = now; B.mv = { kind: 'goal', x: item.x, y: item.y }; }
            else {
                // «осідлість»: кемпер чекає у вибраній точці
                if (B.campUntil > now && B.campPt) { setState(B, 'wander', now); B.mv = { kind: 'hold', look: true }; }
                else {
                    if (!B.goal || B.goal.kind === 'mod' || B.goal.kind === 'pu' || B.goal.kind === 'token' || now - B.goalAt > 22000 || Math.hypot(B.goal.x - p.x, B.goal.y - p.y) < 70) {
                        const prev = B.goal; B.goal = objectiveGoal(room, B, p, now, S); B.goalAt = now;
                        if (prev && Math.hypot(prev.x - p.x, prev.y - p.y) < 90 && B.campPref > 0.55 && B.goal.kind === 'patrol' && Math.random() < B.campPref * 0.5) { B.campPt = { x: p.x, y: p.y }; B.campUntil = now + rnd(5000, 13000); }
                    }
                    setState(B, B.goal.kind === 'point' ? 'capture' : 'wander', now);
                    // у точці захоплення — тримаємось усередині
                    if (B.goal.kind === 'point' && Math.hypot(B.goal.x - p.x, B.goal.y - p.y) < (B.goal.r || 120) * 0.7) B.mv = { kind: 'hold', look: true, jitter: true };
                    else B.mv = { kind: 'goal', x: B.goal.x, y: B.goal.y };
                    // вороги, що чули/бачили поблизу (пам'ять про них): агресивні починають шукати
                    if (B.aggr > 0.3 && now >= B.awareAt && list.length) { B.awareAt = now + rnd(2500, 5000); const e = list[Math.floor(Math.random() * Math.min(2, list.length))]; if (e.d < 2200 && Math.random() < 0.35 + 0.5 * B.aggr) { B.aware = { x: e.q.x + rnd(-260, 260), y: e.q.y + rnd(-260, 260), t: now }; } }
                    if (B.aware && now - B.aware.t < 14000 && B.mv.kind === 'goal' && B.goal.kind !== 'point' && B.aggr > 0.3) { const a = B.aware; if (reachable(map, a.x, a.y) && freeAt(room, a.x, a.y, 30)) { B.mv.x = a.x; B.mv.y = a.y; if (Math.hypot(a.x - p.x, a.y - p.y) < 120) B.aware = null; } else B.aware = null; }
                }
            }
        }
        if (B.mv && B.mv.kind === 'goal') pathRefresh(room, B, p, now, map);
        // автолазер: ціль для серверного лазера
        if (p.buff === 'autolaser') { let lt = null; for (const e of list) if (e.d < 400 && e.vis) { lt = e.id; break; } p.laserTarget = lt; }
        else if (p.laserTarget) p.laserTarget = null;
        // міни (жнець)
        B.stat.thinkN++;
        // метрики для тестів
        if (B.tgtObj && vis) { B.stat.distSum += best.d; B.stat.distN++; }
        B.stat.stateT[B.state] = (B.stat.stateT[B.state] || 0) + THINK_MS;
        const dt = perfNow() - t0; perf.thinks++; perf.thinkMs += dt; if (dt > perf.maxThinkMs) perf.maxThinkMs = dt;
    }
    function PUtype(room, g) { const u = room.powerups && room.powerups[g.id]; return u ? u.type : null; }

    function fireDiscipline(B, e, now) {
        // агресивні стріляють при кожній нагоді; обережні чекають вдалого пострілу; «паузи» і «помилки» роблять поведінку менш передбачуваною
        if (now < B.pauseUntil) return false;
        const maxR = 700 * Math.min(1.5, B.rngM) + 160;
        if (e.d > maxR) return false;
        if (Math.random() < 0.025 + 0.06 * B.erratic) { B.pauseUntil = now + rnd(250, 800); return false; }
        const pFire = clamp(0.55 + 0.5 * B.aggr, 0.4, 1);
        return Math.random() < pFire;
    }
    function combatMove(room, B, p, e, now, hpF, map) {
        const q = e.q, d = e.d;
        // зайва «розумність»: рідкі раптові зміни напрямку
        if (now >= B.strafeUntil) { B.strafeUntil = now + rnd(700, 2300) * lerp(1.3, 0.7, B.agility); if (Math.random() < 0.55 + 0.25 * B.agility) { B.strafeDir *= -1; B.stat.flips++; } }
        if (now >= B.pauseUntil && Math.random() < 0.012 + 0.035 * B.erratic) B.pauseUntil = now + rnd(300, 900);
        let dp = B.dPref * rnd(0.95, 1.05);
        const bf = p.buff; if (bf === 'shotgun') dp = Math.min(dp, 190); else if (bf === 'samurai') dp = 60; else if (bf === 'homing' || bf === 'piercing') dp = Math.max(dp, 330); else if (bf === 'minigun') dp = Math.min(Math.max(dp, 250), 420);
        // фланг: агресивно-маневрені бояться «в лоб» — заходять збоку
        if (!B.flankPt && B.flankPref > 0.55 && d > dp * 1.4 && B.charge < 0.5 && now > B.flankUntil && Math.random() < 0.08 * B.flankPref) {
            const a0 = Math.atan2(p.y - q.y, p.x - q.x), fa = a0 + (Math.random() < 0.5 ? 1 : -1) * rnd(1.0, 1.5), fd = Math.max(dp * 1.15, 260);
            const fx = q.x + Math.cos(fa) * fd, fy = q.y + Math.sin(fa) * fd;
            if (reachable(map, fx, fy) && freeAt(room, fx, fy, 30)) { B.flankPt = { x: fx, y: fy }; B.flankUntil = now + 4500; }
        }
        if (B.flankPt && now > B.flankUntil) B.flankPt = null;
        if (B.flankPt && Math.hypot(B.flankPt.x - p.x, B.flankPt.y - p.y) < 90) B.flankPt = null;
        if (hpF < 0.6) dp *= 1 + (0.6 - hpF) * (1.3 - B.charge * 0.8);       // поранені тримають дистанцію
        const style = B.charge > 0.62 ? 'charge' : (B.agility > 0.55 ? 'agile' : 'balanced');
        B.mv = { kind: 'orbit', style, dp, sd: B.strafeDir, tx: q.x, ty: q.y, flank: B.flankPt || null };
        B.speedF = 1;
        // сильно далеко і без прямої видимості — шлях
        if (!e.vis && d > 300) { B.mv = { kind: 'goal', x: q.x, y: q.y }; }
    }
    function dodgeCheck(room, RS, B, p, now, hpF) {
        if (!RS || now < B.dodgeUntil) return;
        const team = isTeamMode(room);
        for (const b of RS.bullets) {
            if (b.owner === p.id || B.dodged[b.id] !== undefined) continue;
            if (team) { const ow = room.players[b.owner]; if (ow && ow.team && ow.team === p.team) continue; }
            const rx = b.x - p.x, ry = b.y - p.y, v2 = b.vx * b.vx + b.vy * b.vy; if (v2 < 40000) continue;
            const tca = -(rx * b.vx + ry * b.vy) / v2; if (tca < 0.04 || tca > 0.75 || tca > b.life) continue;
            const cx = rx + b.vx * tca, cy = ry + b.vy * tca, dm = Math.hypot(cx, cy);
            if (dm > 44) continue;
            B.dodged[b.id] = 1;
            const pr = clamp(B.dodgeP + (hpF < 0.4 ? 0.15 : 0), 0, 0.92);
            if (Math.random() > pr) continue;
            const sp = Math.sqrt(v2), px = -b.vy / sp, py = b.vx / sp; let sgn = (cx * px + cy * py) >= 0 ? 1 : -1; if (Math.abs(cx * px + cy * py) < 4) sgn = Math.random() < 0.5 ? 1 : -1;
            let dx = px * sgn, dy = py * sgn;
            if (!freeAt(room, p.x + dx * 70, p.y + dy * 70, BODY_R)) { dx = -dx; dy = -dy; if (!freeAt(room, p.x + dx * 70, p.y + dy * 70, BODY_R)) continue; }
            B.dodgeDir = { x: dx, y: dy }; B.dodgeUntil = now + clamp(tca * 1000 + 160, 260, 620); B.stat.dodges++; perf.dodges++;
            break;
        }
        // прибрати старі записи
        if (Math.random() < 0.05) { const keys = Object.keys(B.dodged); if (keys.length > 80) B.dodged = Object.create(null); }
    }
    function pathRefresh(room, B, p, now, map) {
        const mv = B.mv; if (!mv || mv.kind !== 'goal') return;
        const gx = Math.round(mv.x / 60) * 60, gy = Math.round(mv.y / 60) * 60, key = gx + '_' + gy;
        const direct = Math.hypot(mv.x - p.x, mv.y - p.y) < 160 && los(map, p.x, p.y, mv.x, mv.y);
        if (direct) { B.wp = { x: mv.x, y: mv.y }; B.pathKey = key; B.pathAt = now; return; }
        const wpReached = B.wp && Math.hypot(B.wp.x - p.x, B.wp.y - p.y) < 34;
        if (key !== B.pathKey || wpReached || now - B.pathAt > 600 || !B.wp) {
            B.pathKey = key; B.pathAt = now;
            const w = Nav.steer(map, B.navKey, 'g', gx, gy, p.x, p.y, BODY_R, now);
            B.wp = w ? { x: w.x, y: w.y } : { x: mv.x, y: mv.y };
        }
    }

    // ---------- рух (кожен фізичний тік) ----------
    function wishDir(room, B, p, now) {
        // повертає {x,y,f} (одиничний напрям і частка швидкості) або null
        if (now < B.unstuckUntil && B.unstuckDir) return { x: B.unstuckDir.x, y: B.unstuckDir.y, f: 1 };
        if (now < B.dodgeUntil && B.dodgeDir) return { x: B.dodgeDir.x, y: B.dodgeDir.y, f: 1 };
        if (now < B.reverseUntil && B.reverseDir) return { x: B.reverseDir.x, y: B.reverseDir.y, f: 1 };
        const mv = B.mv; if (!mv) return null;
        if (mv.kind === 'hold') { if (mv.jitter) { const a = now / 900 + B.strafeDir; return { x: Math.cos(a), y: Math.sin(a), f: 0.25 }; } return null; }
        if (now < B.pauseUntil && mv.kind !== 'goal') return null;
        if (mv.kind === 'goal') {
            const wp = B.wp || mv, dx = wp.x - p.x, dy = wp.y - p.y, d = Math.hypot(dx, dy); if (d < 8) return null;
            const gd = Math.hypot(mv.x - p.x, mv.y - p.y); let f = B.speedF || 1;
            if (gd < 55) return null;
            if (gd < 130) f = Math.min(f, 0.55);
            return { x: dx / d, y: dy / d, f };
        }
        if (mv.kind === 'orbit') {
            const t = B.tgtObj; if (!t || t.hp <= 0) return null;
            let dx = t.x - p.x, dy = t.y - p.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
            if (mv.flank) { const fx = mv.flank.x - p.x, fy = mv.flank.y - p.y, fd = Math.hypot(fx, fy) || 1; return { x: fx / fd, y: fy / fd, f: 1 }; }
            const tx = -dy * mv.sd, ty = dx * mv.sd, err = d - mv.dp, ratio = err / Math.max(80, mv.dp);
            let rad = clamp(ratio * 1.4, -1, 1), tang;
            if (mv.style === 'charge') { tang = d > mv.dp * 1.15 ? 0.15 : 0.55; rad = d > mv.dp ? Math.max(rad, 0.7) : rad * 0.5; }
            else if (mv.style === 'agile') { tang = 1.0; rad *= 0.9; }
            else { tang = 0.7; }
            // у ближньому бою «відхід назад» для тих, у кого мало здоров'я
            let vx = dx * rad + tx * tang, vy = dy * rad + ty * tang; const l = Math.hypot(vx, vy);
            if (l < 0.05) return null;
            return { x: vx / l, y: vy / l, f: 1 };
        }
        return null;
    }
    function physics(room, RS, B, p, dt, now) {
        if (p.hp <= 0) { B.wasDead = true; return; }
        if (B.wasDead) { // відродження: скидаємо стан
            B.wasDead = false; B.state = 'wander'; B.stateSince = now; B.goal = null; B.cover = null; B.wp = null; B.target = null; B.tgtObj = null; B.engageAt = 0; B.canEngage = false;
            B.dodgeUntil = 0; B.unstuckUntil = 0; B.reverseUntil = 0; B.flankPt = null; B.recentDmg = 0; B.lastHp = p.hp; B.hiddenSince = 0; B.mem = Object.create(null); B.losC = Object.create(null); B.tr = Object.create(null); B.startAt = now + rnd(500, 1600); B.nextThink = B.startAt; B.stuckT = 0; B.stuckCount = 0;
            B.stat.deaths++;
        }
        if (now < B.startAt) return;
        const hpF = p.hp / ownMaxHp(p);
        let spdMul = SM(p.equipped, 'speed');
        if (p.buff === 'speed') spdMul *= 1.5; else if (p.buff === 'samurai') spdMul *= 1.6; else if (p.buff === 'boss') spdMul *= 0.6;
        const wish = wishDir(room, B, p, now);
        let moved = 0, exp = 0;
        if (wish) {
            const spd = BASE_SPEED * spdMul * wish.f, step = spd * dt;
            let ix = wish.x, iy = wish.y;
            // легке обходження перешкод попереду: пробуємо відхилення
            const probe = 34;
            if (!freeAt(room, p.x + ix * probe, p.y + iy * probe, BODY_R)) {
                let found = false;
                for (const off of [0.6, -0.6, 1.1, -1.1, 1.6, -1.6]) {
                    const a = Math.atan2(iy, ix) + off, cx = Math.cos(a), cy = Math.sin(a);
                    if (freeAt(room, p.x + cx * probe, p.y + cy * probe, BODY_R)) { ix = cx; iy = cy; found = true; break; }
                }
                if (!found) { ix *= 0.2; iy *= 0.2; }
            }
            const nx = p.x + ix * step, ny = p.y + iy * step; let ox = p.x, oy = p.y;
            if (freeAt(room, nx, p.y, BODY_R)) p.x = nx;
            if (freeAt(room, p.x, ny, BODY_R)) p.y = ny;
            moved = Math.hypot(p.x - ox, p.y - oy); exp = step;
            const want = Math.atan2(iy, ix), bd = angDiff(want, p.bodyAngle), mxs = 9 * B.rotM * dt;
            p.bodyAngle = Math.abs(bd) <= mxs ? want : p.bodyAngle + Math.sign(bd) * mxs;
        }
        // застрягання: очікуваний шлях проти фактичного за ~1 с
        B.stuckExp += exp; B.stuckAct += moved;
        if (now - B.stuckT >= 1000) {
            if (B.stuckExp > 60 && B.stuckAct < 0.22 * B.stuckExp && now >= B.unstuckUntil) onStuck(room, B, p, now);
            else if (B.stuckExp > 60 && B.stuckAct > 0.6 * B.stuckExp) { if (now - B.lastGoodMove > 7000) B.stuckCount = 0; B.lastGoodMove = now; }
            B.stuckT = now; B.stuckExp = 0; B.stuckAct = 0;
        }
        // башта
        aimTurret(room, B, p, dt, now, wish);
        // стрільба
        if (p.buff === 'autolaser') { /* лазер працює в головному циклі сервера */ }
        else if (p.buff === 'reaper') {
            if (now >= B.reloadAt && B.state !== 'wander' && (B.state === 'combat' || B.state === 'retreat' || Math.random() < 0.01)) layMine(room, B, p, now);
        } else if (B.wantFire && B.tgtObj && B.tgtObj.hp > 0 && now >= B.reloadAt && now >= B.fireOkAt) {
            const t = B.tgtObj, d = Math.hypot(t.x - p.x, t.y - p.y), err = Math.abs(angDiff(p.turretAngle, B.aimAng));
            const tol = Math.max(0.035, Math.atan2(24, Math.max(40, d))) * (B.mistake ? 3 : 0.9);
            if (err < tol) {
                fireShot(room, RS, B, p, now);
                B.fireOkAt = now + rnd(60, 220);
                if (Math.random() < 0.05 + 0.07 * (1 - B.skill)) { B.aimBiasUntil = 0; B.mistake = Math.random() < 0.5; }
            }
        }
        pickupsTick(room, RS, B, p, now, hpF);
    }
    function onStuck(room, B, p, now) {
        B.stuckCount++; B.stat.stuck++; perf.stuck++;
        const base = Math.random() * Math.PI * 2; let dir = null;
        for (let i = 0; i < 8 && !dir; i++) { const a = base + i * Math.PI / 4, cx = Math.cos(a), cy = Math.sin(a); if (freeAt(room, p.x + cx * 60, p.y + cy * 60, BODY_R)) dir = { x: cx, y: cy }; }
        B.unstuckDir = dir; B.unstuckUntil = now + rnd(450, 900); B.wp = null; B.pathAt = 0; B.pathKey = '';
        if (B.stuckCount >= 3) { B.goal = null; B.cover = null; B.campUntil = 0; B.flankPt = null; }
        if (B.stuckCount >= 5 || !dir) {   // крайній випадок: переносимо в найближчу вільну досяжну точку
            const q = randomPoint(room, { fx: p.x, fy: p.y, maxD: 380 }); p.x = q.x; p.y = q.y; B.stuckCount = 0; perf.teleports++; B.stat.teleports = (B.stat.teleports || 0) + 1;
        }
    }
    function aimTurret(room, B, p, dt, now, wish) {
        let want = null;
        const t = B.tgtObj;
        if (t && t.hp > 0 && (B.canEngage || B.state === 'retreat') && (B.wantFire || B.state === 'combat' || B.state === 'retreat')) {
            // упередження: пристрілка за швидкістю цілі
            const tr = B.tr[B.target]; const bs = BASE_BULLET_SPEED * ((p.buff && BT[p.buff]) ? BT[p.buff].spd : 1);
            let px = t.x, py = t.y;
            if (tr && bs > 150) { const d0 = Math.hypot(t.x - p.x, t.y - p.y); let tt = d0 / bs; for (let i = 0; i < 2; i++) { px = t.x + tr.vx * tt * B.leadQ; py = t.y + tr.vy * tt * B.leadQ; tt = Math.hypot(px - p.x, py - p.y) / bs; } }
            if (now >= B.aimBiasUntil) { B.aimBias = gauss() * B.aimSigma * (B.mistake ? 3 : 1); B.aimBiasUntil = now + rnd(350, 900); if (B.mistake && Math.random() < 0.5) B.mistake = false; }
            want = Math.atan2(py - p.y, px - p.x) + B.aimBias;
            B.aimAng = want;
        } else if (B.state === 'seek' || B.state === 'wander' || B.state === 'capture' || B.state === 'collect' || B.state === 'zone') {
            // дивимось у напрямку руху, інколи «оглядаємось»
            if (wish) want = Math.atan2(wish.y, wish.x) + Math.sin(now / 1400 + B.strafeDir * 2) * 0.5; else want = p.turretAngle + Math.sin(now / 900) * 0.04 + 0.02;
        } else if (B.state === 'retreat' && B.cover && !(t && B.wantFire)) {
            const m = B.mem[B.target]; if (m) want = Math.atan2(m.y - p.y, m.x - p.x);
        }
        if (want === null) return;
        const mxs = BASE_TURRET_ROT * B.rotM * dt, df = angDiff(want, p.turretAngle);
        p.turretAngle = Math.abs(df) <= mxs ? want : p.turretAngle + Math.sign(df) * mxs;
    }

    // ---------- головний крок ----------
    let lastStep = 0;
    function step(now) {
        const t0 = perfNow(); now = now || Date.now();
        const dtAll = lastStep ? clamp((now - lastStep) / 1000, 0.01, 0.12) : 0.04; lastStep = now;
        let nBots = 0, thinkSpent = 0;
        // кімнати з ботами у грі
        const due = [];
        for (const rid in rooms) {
            const r = rooms[rid]; let RS = rsMap.get(rid);
            if (r.status !== 'playing') { if (RS) rsMap.delete(rid); continue; }
            let hasBot = false; for (const id in r.players) if (r.players[id].isBot) { hasBot = true; break; }
            if (!hasBot) { if (RS) rsMap.delete(rid); continue; }
            RS = rsOf(r, true);
            if (!RS.started) { RS.started = true; for (const id in r.players) { const p = r.players[id]; if (p.isBot) { const B = brainOf(p); B.startAt = now + rnd(1200, 3600); B.nextThink = B.startAt; B.started = true; B.state = 'wander'; B.goal = null; B.cover = null; B.reloadAt = now + rnd(300, 1200); B.lastHp = p.hp; B.mem = Object.create(null); B.tr = Object.create(null); B.losC = Object.create(null); B.wasDead = false; } } }
            // снаряди
            stepBullets(r, RS, dtAll);
            // людські снаряди-«привиди» старіють у stepBullets разом з іншими
            for (const id in r.players) {
                const p = r.players[id]; if (!p.isBot) continue;
                const B = brainOf(p); nBots++;
                physics(r, RS, B, p, dtAll, now);
                if (p.hp > 0 && now >= B.nextThink && now >= B.startAt) due.push([r, RS, B, p]);
            }
        }
        // «думки» — по черзі, найстарші першими, зі стелею часу
        due.sort((a, b) => a[2].nextThink - b[2].nextThink);
        for (const d of due) {
            if (perfNow() - t0 > THINK_BUDGET) { perf.skipped++; break; }
            const [r, RS, B, p] = d; B.nextThink = now + THINK_MS * rnd(0.85, 1.2);
            try { think(r, RS, B, p, now); } catch (e) { console.error('❌ bot think:', e && e.stack || e); B.nextThink = now + 500; }
        }
        // чистка «мозків» ботів, яких більше нема
        if (Math.random() < 0.02) for (const id of brains.keys()) { let found = false; for (const rid in rooms) if (rooms[rid].players[id]) { found = true; break; } if (!found) brains.delete(id); }
        const dt = perfNow() - t0; perf.steps++; perf.ms += dt; if (dt > perf.maxMs) perf.maxMs = dt; perf.botsLast = nBots;
    }
    // постріл людини (для ухилення ботів): сервер більше нічого про траєкторію не знає
    function onShoot(sockId, data) {
        try {
            if (!data || typeof data !== 'object') return; const r = rooms[data.roomId]; if (!r || r.status !== 'playing') return;
            const RS = rsMap.get(r.id); if (!RS) return; const p = r.players[sockId]; if (!p || p.buff === 'reaper') return;
            const x = +data.x, y = +data.y, vx = +data.vx, vy = +data.vy; if (![x, y, vx, vy].every(Number.isFinite)) return;
            const sp = Math.hypot(vx, vy); if (sp < 20 || sp > 3000) return;
            const T = BT[data.type] || BT.none, lm = clamp(+data.lifeMult || 1, 0.3, 3);
            if (RS.bullets.length > 400) return;
            RS.bullets.push({ id: 'h' + (RS.seq++), owner: sockId, x, y, vx, vy, type: BT[data.type] ? data.type : 'none', life: T.fixedLife ? T.life : T.life * lm, pierced: [], ghost: true });
        } catch (e) { /* ігноруємо */ }
    }
    function dropRoom(roomId) { rsMap.delete(roomId); }
    function forget(id) { brains.delete(id); }

    return { step, onShoot, brainOf, newBrain, deriveGear, forget, dropRoom, perf, brains, rsMap, BT, constants: { BASE_SPEED, BASE_TURRET_ROT, BASE_BULLET_SPEED, BODY_R, HIT_R, BASE_RELOAD, SIGHT }, reachable, warm: (room) => { try { reachOf(mapOf(room)); } catch (e) { } }, los, randomPoint, findCover, resetPerf: () => { for (const k in perf) perf[k] = 0; } };
};
