/* modes.js — серверна логіка нових режимів (спільні налаштування й нагороди — public/js/modeinfo.js)
 * Кооператив: base_defense (оборона бази), boss_raid (рейд на боса), convoy (конвой)
 * Соло (1 гравець): solo_arena (арена хвиль із покращеннями), boss_duel (дуель з босами)
 * Проти гравців: battle_royale (королівський бій), capture_points (захоплення точок), bounty (полювання за головою)
 * Стан кожного матчу лежить у MS (окремо від кімнати, бо кімнату серіалізують і шлють клієнтам). */
'use strict';
const ModeInfo = require('./public/js/modeinfo.js');

module.exports = function createModes(D) {
    const { io, rooms, dbUsers, MAP_DATA, MapObj, Nav, Z_TYPES, waveScale, getValidSpawn, getValidEdgeSpawn, checkCollisionServer, getMaxHp,
        grantXp, rollDrop, saveUser, ecoPayload, pushRooms, zombieTick, ZOMBIE_CAP, ZOMBIE_SPAWN_BASE, ZOMBIE_SPAWN_STEP } = D;
    const MS = new Map();
    const NEW = new Set(ModeInfo.NEW);
    const has = mode => NEW.has(mode);
    const BYKEY = ModeInfo.BYKEY, TEAM_ORDER = ['red', 'blue', 'green', 'yellow'];
    const POW_TYPES = ['boss', 'samurai', 'minigun', 'shotgun', 'homing', 'incendiary', 'explosive', 'piercing', 'healing', 'shield', 'autolaser', 'reaper'];
    const RAID_HP = { pikus: 4000, shurik: 6000, oneshot: 8000, padlo: 11000, titan: 16000 };      // здоров’я боса в рейді (на 1 гравця, далі росте)
    const DUEL_HP = { pikus: 2500, shurik: 4000, oneshot: 6000, padlo: 8000, titan: 12000 };        // здоров’я боса в дуелі
    const WAVE_BOSS = ['pikus', 'shurik', 'oneshot', 'padlo'];

    // ---------- налаштування ----------
    function clean(p, v) {
        if (p.type === 'toggle') return v === undefined || v === null ? p.def : !!v;
        if (p.type === 'choice') return p.options.some(o => o.v === v) ? v : p.def;
        const n = parseInt(v); if (!Number.isFinite(n)) return p.def;
        return Math.max(p.min, Math.min(p.max, n));
    }
    const KEYS = ModeInfo.PARAMS.filter(p => !['maxPlayers', 'winScore', 'hideTime', 'seekTime', 'hunterCount', 'tdmTeams', 'tdmTime', 'tdmScore', 'tdmAutoBalance'].includes(p.key));
    function readSettings(r, c) { c = c || {}; KEYS.forEach(p => { r[p.key] = clean(p, c[p.key]); }); }
    function applyUpdate(r, d) {
        KEYS.forEach(p => { if (d[p.key] !== undefined) r[p.key] = clean(p, d[p.key]); });
        if (d.cpTeams !== undefined && r.mode === 'capture_points') Object.values(r.players).forEach(pl => { if (pl.team && !TEAM_ORDER.slice(0, r.cpTeams).includes(pl.team)) { pl.team = null; pl.ready = false; } });
        if (ModeInfo.isSolo(r.mode)) r.maxPlayers = 1;
    }

    // ---------- допоміжне ----------
    const mapOf = r => MAP_DATA[r.map] || MAP_DATA['epic_map'] || Object.values(MAP_DATA)[0];
    function bounds(map) { return MapObj.hasShape(map) ? MapObj.shapeBounds(map.shape) : { x0: 0, y0: 0, x1: map.size, y1: map.size }; }
    function center(map) { const b = bounds(map); return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, w: b.x1 - b.x0, h: b.y1 - b.y0 }; }
    const isFree = (r, x, y, rad) => !checkCollisionServer(r.map, x, y, rad);
    function findOpen(r, x, y, rad) {
        if (isFree(r, x, y, rad)) return { x, y };
        for (let k = 1; k <= 40; k++) { const d = k * 35; for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2 + k, px = x + Math.cos(ang) * d, py = y + Math.sin(ang) * d; if (isFree(r, px, py, rad)) return { x: px, y: py }; } }
        return getValidSpawn(r.map, rad);
    }
    function ringSpot(r, c, rmin, rmax, rad) {
        for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, d = rmin + Math.random() * (rmax - rmin), px = c.x + Math.cos(a) * d, py = c.y + Math.sin(a) * d; if (isFree(r, px, py, rad)) return { x: px, y: py }; }
        return findOpen(r, c.x, c.y, rad);
    }
    const randFree = (r, rad) => getValidSpawn(r.map, rad, '_random');     // типу немає на мапі → випадкова вільна точка
    const alive = r => Object.values(r.players).filter(p => p.hp > 0 && !p.out);
    const df = r => (r.pveDiff || 100) / 100;
    const mmss = ms => { const t = Math.max(0, Math.round(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const emit = (r, ev, d) => io.to(r.id).emit(ev, d);
    const note = (r, k, a) => emit(r, 'modeEvent', Object.assign({ k }, a || {}));
    function place(p, pos) { p.x = pos.x; p.y = pos.y; p.stuckIn = []; }

    function mkZ(r, S, now, type, pos, hpM, dmgM, tag) {
        const id = (tag || 'z') + '_' + now + '_' + (S.zid++), hp = Math.max(1, Math.round(Z_TYPES[type].hp * hpM));
        const z = { id, x: pos.x, y: pos.y, type, hp, maxHp: hp, dmgMult: dmgM, nextAttack: 0, onFire: null };
        r.zombies[id] = z; return z;
    }
    // хвиля зомбі як у «Виживанні», але з урахуванням складності та кількості гравців
    function spawnWave(r, S, now, wave, o) {
        o = o || {}; const sc = waveScale(wave), d = df(r), n = Object.keys(r.players).length, hpM = sc.hp * d, dmgM = sc.dmg * d;
        if (wave % 10 === 0 && wave <= 40) {
            const bt = WAVE_BOSS[wave / 10 - 1], pos = getValidSpawn(r.map, 50, 'spawn_zombie');
            const z = mkZ(r, S, now, bt, pos, hpM * (1 + 0.35 * (n - 1)), dmgM, 'boss'); z.nextAttack = now + 3000;
            return { isBoss: true, bossName: Z_TYPES[bt].name };
        }
        const base = Math.min(ZOMBIE_CAP, ZOMBIE_SPAWN_BASE + (wave - 1) * ZOMBIE_SPAWN_STEP);
        const cnt = Math.min(120, Math.max(5, Math.round(base * (o.cnt || 1) * (0.6 + 0.4 * d) * (0.75 + 0.25 * n))));
        const tL = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost'], aT = tL.slice(0, Math.min(tL.length - 1, Math.floor(wave / 5)) + 1);
        for (let i = 0; i < cnt; i++) mkZ(r, S, now, aT[Math.floor(Math.random() * aT.length)], getValidEdgeSpawn(r.map, 20, 'spawn_zombie'), hpM, dmgM);
        return { isBoss: false };
    }
    function announceWave(r, wave, info) { emit(r, 'newWave', { wave, isBoss: info.isBoss, bossName: info.bossName }); }

    function respawn(r, v, delay, posFn) {
        setTimeout(() => {
            const R = rooms[r.id]; if (!R || R !== r || r.status !== 'playing' || !r.players[v.id] || v.hp > 0 || v.out) return;
            v.hp = getMaxHp(v.equipped); v.buff = null; v.onFire = null; place(v, posFn()); emit(r, 'playerRespawn', v);
        }, delay);
    }

    // ---------- завершення матчу: нагороди для кожного ----------
    // o: { outcomes:{id:'win'|'loss'|'draw'}, ctx:(p)=>{...}, winner, name, msg, lines:[...] }
    function finish(r, o) {
        if (r.status !== 'playing') return;
        r.status = 'finished'; const rw = {}, xpm = {}, oc = {}, per = {};
        Object.values(r.players).forEach(p => {
            const out = o.outcomes[p.id] || 'loss', amt = ModeInfo.reward(r.mode, r, out, Object.assign({ n: Object.keys(r.players).length }, o.ctx ? o.ctx(p) : {}));
            rw[p.id] = amt; oc[p.id] = out; if (o.per) per[p.id] = o.per(p);
            if (dbUsers[p.name]) {
                const u = dbUsers[p.name]; u.bucks += amt; u.stats.earned += amt; u.stats.matches++;
                xpm[p.id] = grantXp(p.name, out); const dr = rollDrop(p.name); saveUser(p.name);
                io.to(p.id).emit('economyUpdate', ecoPayload(p.name)); if (dr) io.to(p.id).emit('dropReceived', dr);
            }
        });
        MS.delete(r.id);
        emit(r, 'gameOver', { winner: o.winner || 'TEAM', name: o.name || '', rewards: rw, xp: xpm, isTeamWin: false, mode: r.mode, outcomes: oc, msg: o.msg || '', lines: o.lines || [], per, team: o.teamWin || null });
        pushRooms();
    }
    const allOutcome = (r, out) => { const m = {}; Object.keys(r.players).forEach(id => m[id] = out); return m; };

    // ---------- запуск ----------
    function start(r, pK, now) {
        const map = mapOf(r), C = center(map), S = { mode: r.mode, zid: 0, t0: now, kills: {}, ev: {} };
        MS.set(r.id, S);
        pK.forEach(id => { const p = r.players[id]; p.out = false; p.lives = 0; p.perk = null; p.caps = 0; p.score = 0; });
        switch (r.mode) {
            case 'base_defense': {
                const c = findOpen(r, C.x, C.y, 60); S.core = { x: c.x, y: c.y, hp: r.bdCoreHp, max: r.bdCoreHp, r: 46 };
                S.wave = 0; S.W = r.bdWaves; S.st = 'wait'; S.next = now + 5000;
                pK.forEach(id => place(r.players[id], ringSpot(r, c, 110, 200, 26)));
                break;
            }
            case 'boss_raid': {
                const n = pK.length, bt = r.rbBoss, hp = Math.round(RAID_HP[bt] * (1 + 0.5 * (n - 1)) * df(r));
                S.bt = bt; S.startAt = now + 4000; S.end = now + 4000 + r.rbTime * 1000; S.minionAt = S.startAt + 12000; S.enr = false;
                const pos = getValidSpawn(r.map, 50, 'spawn_zombie');
                const z = mkZ(r, S, now, bt, pos, 1, df(r), 'boss'); z.hp = z.maxHp = hp; z.nextAttack = S.startAt + 1500; S.bossId = z.id;
                pK.forEach(id => { r.players[id].lives = r.rbLives; });
                // гравці стартують якомога далі від боса
                const far = []; for (let i = 0; i < 12; i++) far.push(randFree(r, 26));
                far.sort((a, b) => dist(b, pos) - dist(a, pos)); const base = far[0];
                pK.forEach(id => place(r.players[id], ringSpot(r, base, 40, 140, 26)));
                break;
            }
            case 'convoy': {
                const sp = map.solids.filter(s => s.type === 'spawn_player');
                const cands = []; sp.forEach(a => sp.forEach(b => { if (a !== b) cands.push([a, b]); }));
                let A = null, B = null;
                if (cands.length) { cands.sort((x, y) => Math.hypot(y[0].x - y[1].x, y[0].y - y[1].y) - Math.hypot(x[0].x - x[1].x, x[0].y - x[1].y)); A = findOpen(r, cands[0][0].x, cands[0][0].y, 34); B = findOpen(r, cands[0][1].x, cands[0][1].y, 34); }
                const grid = Nav.getGrid(map, 30), ok = (a, b) => { const f = Nav.buildField(grid, b.x, b.y), N = grid.N, i = Math.floor(a.y / Nav.CS) * N + Math.floor(a.x / Nav.CS); return f.dist[i] >= 0; };
                if (!A || !B || Math.hypot(A.x - B.x, A.y - B.y) < 300 || !ok(A, B)) {
                    A = findOpen(r, C.x - C.w * 0.35, C.y + C.h * 0.35, 34); B = null; let best = 0;
                    for (let i = 0; i < 40; i++) { const q = randFree(r, 34), d = dist(q, A); if (d > best && d > Math.min(C.w, C.h) * 0.35 && ok(A, q)) { best = d; B = q; } }
                    if (!B) B = findOpen(r, C.x + C.w * 0.3, C.y - C.h * 0.3, 34);
                }
                const f = Nav.buildField(grid, B.x, B.y), N = grid.N, d0 = Math.max(1, f.dist[Math.floor(A.y / Nav.CS) * N + Math.floor(A.x / Nav.CS)]);
                S.A = { x: A.x, y: A.y }; S.B = { x: B.x, y: B.y }; S.d0 = d0; S.cv = { x: A.x, y: A.y, hp: r.cvHp, max: r.cvHp, a: 0, r: 34 };
                S.end = now + 4000 + r.cvTime * 1000; S.startAt = now + 4000; S.prog = 0; S.hold = 1; S.spawnAt = S.startAt + 3000; S.mb = false; S.nav = {};
                pK.forEach(id => place(r.players[id], ringSpot(r, A, 70, 160, 26)));
                break;
            }
            case 'solo_arena': {
                S.wave = 0; S.W = r.saWaves; S.st = 'wait'; S.next = now + 4000; S.perks = {}; S.pk = perkCalc(S.perks); S.offer = null;
                const p = r.players[pK[0]]; place(p, getValidSpawn(r.map, 24, 'spawn_player')); p.perk = S.pk;
                io.to(p.id).emit('perkState', perkClient(S));
                break;
            }
            case 'boss_duel': {
                S.list = ModeInfo.BOSSES.slice(0, r.duBosses); S.i = 0; S.st = 'wait'; S.next = now + 4000; S.killed = 0; S.bossId = null;
                const p = r.players[pK[0]]; p.lives = r.duLives; place(p, getValidSpawn(r.map, 24, 'spawn_player'));
                S.home = { x: p.x, y: p.y };
                break;
            }
            case 'battle_royale': {
                const R0 = Math.hypot(C.w, C.h) / 2 + 40, Rf = Math.max(120, Math.min(220, Math.min(C.w, C.h) * 0.08));
                S.zone = { x: C.x, y: C.y, r: R0, R0, Rf, ph: 0, phases: 5, T: r.brTime * 1000, grace: 15000 };
                S.zStart = now + 4000 + S.zone.grace; S.place = {}; S.dts = {}; S.killsB = {}; S.zdmgAt = now; S.sudden = false; S.lootAt = now + 6000;
                // спавн з рознесенням: жадібно беремо точки, найвіддаленіші одна від одної
                const pts = []; for (let i = 0; i < 80; i++) { const q = randFree(r, 30); if (Math.hypot(q.x - C.x, q.y - C.y) < Math.min(C.w, C.h) * 0.46) pts.push(q); }
                if (pts.length < pK.length) while (pts.length < pK.length) pts.push(randFree(r, 30));
                const chosen = [pts.splice(Math.floor(Math.random() * pts.length), 1)[0]];
                while (chosen.length < pK.length && pts.length) { let bi = 0, bd = -1; pts.forEach((q, i) => { const d = Math.min(...chosen.map(c => dist(c, q))); if (d > bd) { bd = d; bi = i; } }); chosen.push(pts.splice(bi, 1)[0]); }
                pK.forEach((id, i) => place(r.players[id], chosen[i % chosen.length]));
                break;
            }
            case 'capture_points': {
                const teams = [...new Set(pK.map(id => r.players[id].team))], sc = {}; teams.forEach(t => sc[t] = 0);
                S.teams = teams; S.sc = sc; S.goal = r.cpScore; S.end = now + 4000 + r.cpTime * 1000; S.acc = 0;
                const spawns = Object.values(r.teamSpawns || {}), cand = map.solids.filter(s => s.type === 'spawn_powerup').map(s => ({ x: s.x, y: s.y }));
                for (let i = 0; i < 60; i++) cand.push(randFree(r, 50));
                const okC = q => isFree(r, q.x, q.y, 50) && spawns.every(sp => dist(sp, q) > 380), pool = cand.filter(okC), pts = [];
                if (pool.length) { pool.sort((a, b) => dist(a, C) - dist(b, C)); pts.push(pool.shift()); }
                while (pts.length < r.cpPoints && pool.length) { let bi = 0, bd = -1; pool.forEach((q, i) => { const d = Math.min(...pts.map(c => dist(c, q))); if (d > bd) { bd = d; bi = i; } }); if (bd < 300 && pts.length >= 2) break; pts.push(pool.splice(bi, 1)[0]); }
                while (pts.length < Math.min(r.cpPoints, 2)) pts.push(randFree(r, 50));
                S.pts = pts.map((q, i) => ({ i, x: Math.round(q.x), y: Math.round(q.y), r: 120, o: null, w: null, p: 0 }));
                break;
            }
            case 'bounty': {
                S.end = now + 4000 + r.bnTime * 1000; S.target = null; S.next = now + 10000; S.bv = 3; S.streak = {}; S.bk = {}; S.prev = null; S.tEnd = 0;
                pK.forEach(id => place(r.players[id], getValidSpawn(r.map, 24, 'spawn_player')));
                break;
            }
        }
        return S;
    }

    // ---------- покращення (арена) ----------
    function perkCalc(L) { return { dmg: 1 + 0.15 * (L.dmg || 0), cd: Math.pow(0.9, L.rate || 0), spd: 1 + 0.08 * (L.spd || 0), dr: Math.min(0.5, 0.1 * (L.armor || 0)), regen: 3 * (L.regen || 0), vamp: 4 * (L.vamp || 0), crit: 0.12 * (L.crit || 0) }; }
    const perkClient = S => ({ spd: S.pk.spd, cd: S.pk.cd, list: S.perks });
    function offerPerks(r, S, now) {
        const P = ModeInfo.PERKS, ids = Object.keys(P).filter(k => k === 'heal' || (S.perks[k] || 0) < P[k].max);
        const pick = []; while (pick.length < 3 && ids.length) pick.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
        S.offer = pick; S.st = 'perk'; S.offerEnd = now + 20000;
        const p = Object.values(r.players)[0]; if (p) io.to(p.id).emit('perkOffer', { wave: S.wave, ids: pick, ms: 20000, have: S.perks });
    }
    function applyPerk(r, S, id, now) {
        const P = ModeInfo.PERKS[id], p = Object.values(r.players)[0]; if (!P || !p) return;
        if (id === 'heal') p.hp = Math.min(getMaxHp(p.equipped), p.hp + getMaxHp(p.equipped) * 0.6);
        else S.perks[id] = (S.perks[id] || 0) + 1;
        S.pk = perkCalc(S.perks); p.perk = S.pk; S.offer = null; S.st = 'wait'; S.next = now + 3000;
        io.to(p.id).emit('perkState', perkClient(S));
    }
    function pickPerk(r, sockId, id) {
        const S = r && MS.get(r.id); if (!S || S.mode !== 'solo_arena' || S.st !== 'perk' || !r.players[sockId] || !S.offer || !S.offer.includes(id)) return;
        applyPerk(r, S, id, Date.now());
    }
    // множник шкоди по ворогах (покращення «сила вогню» і «крит»)
    function dmgMult(r, sockId) { const S = MS.get(r.id); if (!S || S.mode !== 'solo_arena') return 1; return S.pk.dmg * (Math.random() < S.pk.crit ? 2 : 1); }
    function dmgTaken(r, sockId, amt) { const S = MS.get(r.id); if (!S || S.mode !== 'solo_arena') return amt; return amt * (1 - S.pk.dr); }
    function onZombieKill(r, sockId, z) {
        const S = MS.get(r.id); if (!S) return;
        if (S.mode === 'solo_arena' && S.pk.vamp) { const p = r.players[sockId]; if (p && p.hp > 0) p.hp = Math.min(getMaxHp(p.equipped), p.hp + S.pk.vamp); }
    }

    // ---------- загибель гравця ----------
    function onDeath(r, v, killerId) {
        const S = MS.get(r.id); if (!S) return; const now = Date.now();
        switch (r.mode) {
            case 'base_defense': respawn(r, v, 5000, () => ringSpot(r, S.core, 110, 200, 26)); break;
            case 'convoy': respawn(r, v, 5000, () => ringSpot(r, S.cv, 90, 180, 26)); break;
            case 'boss_raid':
                v.lives--; if (v.lives > 0) respawn(r, v, 4000, () => getValidSpawn(r.map, 26, 'spawn_player')); else v.out = true;
                break;
            case 'solo_arena': finishArena(r, S, false); break;
            case 'boss_duel':
                v.lives--; if (v.lives > 0) respawn(r, v, 3000, () => findOpen(r, S.home.x, S.home.y, 26)); else finishDuel(r, S, false);
                break;
            case 'battle_royale': {
                const left = alive(r).length; S.place[v.id] = left + 1; S.dts[v.id] = now; v.out = true;
                if (killerId && r.players[killerId] && killerId !== v.id) S.killsB[killerId] = (S.killsB[killerId] || 0) + 1;
                checkBR(r, S, now); break;
            }
            case 'capture_points': {
                const atk = killerId && r.players[killerId];
                if (atk && atk.team && atk.team !== v.team && S.sc[atk.team] !== undefined) { S.sc[atk.team] += 3; S.kills[atk.id] = (S.kills[atk.id] || 0) + 1; checkCP(r, S, now); }
                respawn(r, v, 4000, () => { const ts = r.teamSpawns && r.teamSpawns[v.team]; return ts ? ringSpot(r, ts, 0, 80, 24) : getValidSpawn(r.map, 24, 'spawn_player'); });
                break;
            }
            case 'bounty': {
                const atk = killerId && r.players[killerId];
                if (atk && atk.id !== v.id) {
                    S.kills[atk.id] = (S.kills[atk.id] || 0) + 1; S.streak[atk.id] = (S.streak[atk.id] || 0) + 1;
                    if (v.id === S.target) { atk.score += S.bv; S.bk[atk.id] = (S.bk[atk.id] || 0) + 1; note(r, 'bountyClaimed', { by: atk.name, tg: v.name, v: S.bv }); S.target = null; S.next = now + 3000; }
                    else atk.score += 1;
                } else if (v.id === S.target) { S.target = null; S.next = now + 3000; }
                S.streak[v.id] = 0;
                if (!checkBounty(r, S, now)) respawn(r, v, 3000, () => getValidSpawn(r.map, 24, 'spawn_player'));
                break;
            }
        }
    }
    function afterLeave(r, left) {
        const S = MS.get(r.id); if (!S || r.status !== 'playing') return;
        if (r.mode === 'battle_royale') checkBR(r, S, Date.now());
        else if (r.mode === 'bounty') checkBounty(r, S, Date.now());
    }

    // ---------- завершення окремих режимів ----------
    function finishArena(r, S, win) {
        const p = Object.values(r.players)[0], waves = win ? S.W : Math.max(0, S.wave - 1);
        finish(r, { outcomes: allOutcome(r, win ? 'win' : 'loss'), winner: win ? p.id : 'ZOMBIES', name: p.name, ctx: () => ({ waves }),
            msg: win ? 'Арену пройдено!' : 'Ваш танк знищено', lines: [['Хвиль пройдено', waves + ' / ' + S.W], ['Покращень', Object.values(S.perks).reduce((a, b) => a + b, 0)]] });
    }
    function finishDuel(r, S, win) {
        const p = Object.values(r.players)[0];
        finish(r, { outcomes: allOutcome(r, win ? 'win' : 'loss'), winner: win ? p.id : 'BOSS', name: p.name, ctx: () => ({ killed: S.killed }),
            msg: win ? 'Усіх босів переможено!' : 'Бос виявився сильнішим', lines: [['Босів переможено', S.killed + ' / ' + S.list.length]] });
    }
    function checkBR(r, S, now) {
        const al = alive(r);
        if (al.length > 1) return false;
        const oc = {}, ps = Object.values(r.players); let name = '', winner = 'DRAW', msg = '';
        if (al.length === 1) { oc[al[0].id] = 'win'; S.place[al[0].id] = 1; name = al[0].name; winner = al[0].id; msg = 'Останній танк на полі бою'; }
        else {   // усі впали майже одночасно (зона) — нічия між останніми
            const last = Math.max(0, ...ps.map(p => S.dts[p.id] || 0)), tied = ps.filter(p => last - (S.dts[p.id] || 0) < 1200);
            tied.forEach(p => { oc[p.id] = tied.length > 1 ? 'draw' : 'win'; S.place[p.id] = 1; }); if (tied.length === 1) { name = tied[0].name; winner = tied[0].id; msg = 'Останній танк на полі бою'; } else msg = 'Зона поглинула останніх — нічия';
        }
        finish(r, { outcomes: oc, winner, name, msg, ctx: p => ({ place: S.place[p.id] || ps.length, kills: S.killsB[p.id] || 0 }),
            lines: [['Гравців було', ps.length]], per: p => ({ kills: S.killsB[p.id] || 0, place: S.place[p.id] || ps.length }) });
        return true;
    }
    function checkCP(r, S, now) {
        const win = S.teams.find(t => S.sc[t] >= S.goal);
        if (win) return endCP(r, S, win);
        if (now >= S.end) {
            let mx = -1, w = []; S.teams.forEach(t => { if (S.sc[t] > mx) { mx = S.sc[t]; w = [t]; } else if (S.sc[t] === mx) w.push(t); });
            return endCP(r, S, w.length === 1 ? w[0] : 'draw');
        }
        return false;
    }
    function endCP(r, S, wT) {
        const draw = wT === 'draw', oc = {}; let wId = null;
        Object.values(r.players).forEach(p => { oc[p.id] = draw ? 'draw' : (p.team === wT ? 'win' : 'loss'); if (!wId && oc[p.id] === 'win') wId = p.id; });
        const sc = S.teams.map(t => t + ':' + Math.floor(S.sc[t])).join(' ');
        finish(r, { outcomes: oc, winner: draw ? 'DRAW' : (wT || 'TEAM'), name: draw ? '' : wT, msg: draw ? 'Рівний рахунок' : 'Команда захопила перевагу', ctx: p => ({ caps: p.caps || 0 }), lines: [['Рахунок', sc]], teamWin: wT, per: p => ({ caps: p.caps || 0, kills: S.kills[p.id] || 0 }) });
        return true;
    }
    function checkBounty(r, S, now) {
        const ps = Object.values(r.players);
        const top = Math.max(...ps.map(p => p.score)), timeUp = now >= S.end;
        if (top < r.bnScore && !timeUp) return false;
        const leaders = ps.filter(p => p.score === top), sorted = ps.slice().sort((a, b) => b.score - a.score), oc = {}, pl = {};
        sorted.forEach((p, i) => { pl[p.id] = sorted.findIndex(q => q.score === p.score) + 1; });
        ps.forEach(p => { oc[p.id] = leaders.includes(p) ? (leaders.length > 1 ? 'draw' : 'win') : 'loss'; });
        const w = leaders.length === 1 ? leaders[0] : null;
        finish(r, { outcomes: oc, winner: w ? w.id : 'DRAW', name: w ? w.name : '', msg: w ? 'Найкращий мисливець за головами' : 'Рівні очки — нічия', ctx: p => ({ place: pl[p.id], kills: S.kills[p.id] || 0, bk: S.bk[p.id] || 0 }),
            lines: [['Очків у переможця', top]], per: p => ({ kills: S.kills[p.id] || 0, bk: S.bk[p.id] || 0, place: pl[p.id], score: p.score }) });
        return true;
    }

    // ---------- головний тік ----------
    function tick(r, now, dt) {
        const S = MS.get(r.id); if (!S) return false;
        const ps = Object.values(r.players), al = alive(r);
        switch (r.mode) {
            case 'base_defense': {
                const c = S.core;
                if (c.hp <= 0) { finish(r, { outcomes: allOutcome(r, 'loss'), winner: 'ZOMBIES', msg: 'Ядро бази знищено', ctx: () => ({ waves: Math.max(0, S.wave - 1) }), lines: [['Хвиль відбито', Math.max(0, S.wave - 1) + ' / ' + S.W]] }); return true; }
                if (Object.keys(r.zombies).length === 0) {
                    if (S.st === 'play') {
                        S.st = 'wait'; S.next = now + 6000;
                        if (S.wave >= S.W) { finish(r, { outcomes: allOutcome(r, 'win'), winner: 'TEAM', msg: 'База вистояла!', ctx: () => ({ waves: S.W }), lines: [['Хвиль відбито', S.W + ' / ' + S.W], ['Міцність ядра', Math.round(c.hp / c.max * 100) + '%']] }); return true; }
                        if (r.bdRepair) c.hp = Math.min(c.max, c.hp + c.max * 0.15);
                        if ((S.wave + 1) % 10 === 0) emit(r, 'bossWarning');
                    } else if (S.st === 'wait' && now >= S.next) { S.wave++; announceWave(r, S.wave, spawnWave(r, S, now, S.wave, {})); S.st = 'play'; }
                } else if (S.st === 'play') {
                    zombieTick(r, r.id, now, dt, al, { targets: [{ id: 'core', x: c.x, y: c.y, r: c.r, hit: d => { c.hp = Math.max(0, c.hp - d); } }] });
                }
                return false;
            }
            case 'boss_raid': {
                const boss = r.zombies[S.bossId];
                if (!boss) { finish(r, { outcomes: allOutcome(r, 'win'), winner: 'TEAM', msg: 'Бос повалений!', ctx: () => ({ frac: 1 }), lines: [['Бос', ModeInfo.BOSS_NAMES[S.bt]], ['Залишилось часу', mmss(S.end - now)]] }); return true; }
                const fr = 1 - boss.hp / boss.maxHp;
                if (now >= S.end || !ps.some(p => !p.out)) { finish(r, { outcomes: allOutcome(r, 'loss'), winner: 'BOSS', msg: now >= S.end ? 'Час вийшов' : 'Усі гравці полягли', ctx: () => ({ frac: fr }), lines: [['Здоров’я боса збито', Math.round(fr * 100) + '%']] }); return true; }
                if (now < S.startAt) return false;
                if (!S.enr && boss.hp < boss.maxHp * 0.5) { S.enr = true; note(r, 'enrage', { n: Z_TYPES[S.bt].name }); }
                if (r.rbMinions && now >= S.minionAt) {
                    S.minionAt = now + (S.enr ? 9000 : 15000);
                    const have = Object.values(r.zombies).filter(z => z.id !== S.bossId).length;
                    if (have < 24) { const k = Math.min(24 - have, 3 + ps.length + (S.enr ? 3 : 0)), types = S.enr ? ['normal', 'runner', 'spitter'] : ['normal', 'runner'];
                        for (let i = 0; i < k; i++) mkZ(r, S, now, types[Math.floor(Math.random() * types.length)], ringSpot(r, boss, 120, 260, 18), df(r), df(r)); }
                }
                zombieTick(r, r.id, now, dt, al, { enrage: true, onEnrage: () => {} });
                return false;
            }
            case 'convoy': return convoyTick(r, S, now, dt, al);
            case 'solo_arena': {
                const p = ps[0]; if (!p) return false;
                if (p.hp > 0 && S.pk.regen) p.hp = Math.min(getMaxHp(p.equipped), p.hp + S.pk.regen * dt);
                if (S.st === 'perk') { if (now >= S.offerEnd) applyPerk(r, S, S.offer[Math.floor(Math.random() * S.offer.length)], now); return false; }
                if (Object.keys(r.zombies).length === 0) {
                    if (S.st === 'play') {
                        if (S.wave >= S.W) { finishArena(r, S, true); return true; }
                        if (r.saHeal && p.hp > 0) p.hp = Math.min(getMaxHp(p.equipped), p.hp + getMaxHp(p.equipped) * 0.3);
                        offerPerks(r, S, now);
                    } else if (S.st === 'wait' && now >= S.next) { S.wave++; announceWave(r, S.wave, spawnWave(r, S, now, S.wave, { cnt: 0.7 })); S.st = 'play'; }
                } else if (S.st === 'play') zombieTick(r, r.id, now, dt, al, null);
                return false;
            }
            case 'boss_duel': {
                const p = ps[0]; if (!p) return false;
                if (S.bossId && !r.zombies[S.bossId]) {   // бос повалений
                    S.killed++; S.bossId = null; S.i++;
                    if (S.i >= S.list.length) { finishDuel(r, S, true); return true; }
                    if (r.duHeal && p.hp > 0) p.hp = Math.min(getMaxHp(p.equipped), p.hp + getMaxHp(p.equipped) * 0.5);
                    S.st = 'wait'; S.next = now + 5000;
                }
                if (!S.bossId && S.st === 'wait' && now >= S.next) {
                    const bt = S.list[S.i], pos = ringSpot(r, S.home, 500, 900, 40), z = mkZ(r, S, now, bt, pos, 1, df(r), 'boss');
                    z.hp = z.maxHp = Math.round(DUEL_HP[bt] * df(r)); z.nextAttack = now + 2500; S.bossId = z.id; S.st = 'play';
                    emit(r, 'newWave', { wave: S.i + 1, isBoss: true, bossName: Z_TYPES[bt].name });
                }
                if (S.bossId) zombieTick(r, r.id, now, dt, al, { enrage: true });
                return false;
            }
            case 'battle_royale': return brTick(r, S, now, dt, al);
            case 'capture_points': return cpTick(r, S, now, dt, al);
            case 'bounty': {
                if (now < S.end - r.bnTime * 1000) return false;   // зворотний відлік перед боєм (4 с)
                if (checkBounty(r, S, now)) return true;
                if (now >= S.next) {
                    if (S.target && r.players[S.target] && r.players[S.target].hp > 0) { const t = r.players[S.target]; t.score += 2; note(r, 'bountySurvived', { tg: t.name }); S.prev = S.target; S.target = null; S.next = now + 2500; if (checkBounty(r, S, now)) return true; }
                    else {
                        const cand = al.filter(p => p.id !== S.prev); const pool = cand.length ? cand : al;
                        if (pool.length) {
                            const mx = Math.max(...pool.map(p => p.score)), leaders = pool.filter(p => p.score === mx && mx > 0);
                            const t = (leaders.length && Math.random() < 0.55) ? leaders[Math.floor(Math.random() * leaders.length)] : pool[Math.floor(Math.random() * pool.length)];
                            S.target = t.id; S.bv = 3 + Math.min(5, S.streak[t.id] || 0); S.tEnd = now + r.bnInterval * 1000; S.next = S.tEnd;
                            note(r, 'bountyPick', { tg: t.name, v: S.bv });
                        } else S.next = now + 1000;
                    }
                }
                return false;
            }
        }
        return false;
    }

    // --- конвой ---
    function convoyTick(r, S, now, dt, al) {
        const cv = S.cv, n = Object.keys(r.players).length;
        if (cv.hp <= 0) { finish(r, { outcomes: allOutcome(r, 'loss'), winner: 'ZOMBIES', msg: 'Конвой знищено', ctx: () => ({ frac: S.prog }), lines: [['Маршрут пройдено', Math.round(S.prog * 100) + '%']] }); return true; }
        if (now >= S.end) { finish(r, { outcomes: allOutcome(r, 'loss'), winner: 'ZOMBIES', msg: 'Час вийшов', ctx: () => ({ frac: S.prog }), lines: [['Маршрут пройдено', Math.round(S.prog * 100) + '%']] }); return true; }
        if (Math.hypot(cv.x - S.B.x, cv.y - S.B.y) < 90) { finish(r, { outcomes: allOutcome(r, 'win'), winner: 'TEAM', msg: 'Вантаж доставлено!', ctx: () => ({ frac: cv.hp / cv.max }), lines: [['Міцність конвою', Math.round(cv.hp / cv.max * 100) + '%'], ['Залишилось часу', mmss(S.end - now)]] }); return true; }
        if (now < S.startAt) return false;
        const zs = Object.values(r.zombies), threat = zs.some(z => Math.hypot(z.x - cv.x, z.y - cv.y) < 230), escort = al.some(p => Math.hypot(p.x - cv.x, p.y - cv.y) < 380);
        S.hold = threat ? 2 : (escort ? 0 : 1);
        if (S.hold === 0) {   // їдемо за маршрутом (найкоротший шлях у обхід перешкод)
            const wp = Nav.steer(mapOf(r), S.nav, 'cvDest', S.B.x, S.B.y, cv.x, cv.y, 30, now), dx = wp.x - cv.x, dy = wp.y - cv.y, l = Math.max(Math.hypot(dx, dy), 0.001), sp = r.cvSpeed * dt;
            const nx = cv.x + dx / l * sp, ny = cv.y + dy / l * sp;
            if (!checkCollisionServer(r.map, nx, cv.y, 30)) cv.x = nx; if (!checkCollisionServer(r.map, cv.x, ny, 30)) cv.y = ny;
            cv.a = Math.atan2(dy, dx);
        }
        // прогрес — за відстанню по сітці до кінцевої точки
        { const g = Nav.getGrid(mapOf(r), 30); if (!S.field) S.field = Nav.buildField(g, S.B.x, S.B.y); const N = g.N, dd = S.field.dist[Math.floor(cv.y / Nav.CS) * N + Math.floor(cv.x / Nav.CS)]; if (dd >= 0) S.prog = Math.max(S.prog, Math.min(1, 1 - dd / S.d0)); }
        // ворожі хвилі: потік зомбі, що росте з прогресом
        if (now >= S.spawnAt) {
            const d = df(r); S.spawnAt = now + Math.max(3500, 8000 - S.prog * 3000);
            const cap = Math.round((22 + n * 8) * (0.6 + 0.4 * d)), have = zs.filter(z => !z.mb).length;
            if (have < cap) {
                const k = Math.min(cap - have, Math.max(2, Math.round((2 + n * 1.2) * (0.6 + 0.4 * d)))), tL = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost'], aT = tL.slice(0, Math.min(5, Math.floor(S.prog * 6)) + 1);
                for (let i = 0; i < k; i++) {
                    let pos = null; for (let t = 0; t < 8; t++) { const q = getValidEdgeSpawn(r.map, 20, 'spawn_zombie'), dd = Math.hypot(q.x - cv.x, q.y - cv.y); if (dd > 450 && dd < 1500) { pos = q; break; } if (!pos) pos = q; }
                    mkZ(r, S, now, aT[Math.floor(Math.random() * aT.length)], pos, (1 + S.prog * 0.8) * d, (1 + S.prog * 0.4) * d);
                }
            }
        }
        if (!S.mb && S.prog >= 0.5) { S.mb = true; const z = mkZ(r, S, now, 'pikus', getValidEdgeSpawn(r.map, 30, 'spawn_zombie'), (1 + 0.35 * (n - 1)) * df(r), df(r), 'boss'); z.mb = true; z.nextAttack = now + 2500; emit(r, 'bossWarning'); note(r, 'miniboss', {}); }
        zombieTick(r, r.id, now, dt, al, { targets: [{ id: 'cv', x: cv.x, y: cv.y, r: cv.r, hit: d => { cv.hp = Math.max(0, cv.hp - d); } }] });
        return false;
    }

    // --- королівський бій ---
    function brTick(r, S, now, dt, al) {
        const Z = S.zone;
        if (now >= S.zStart) {   // зона звужується фазами: спершу тримається, потім стискається до наступного радіуса
            const DUR = Z.T / Z.phases, t = now - S.zStart, ph = Math.min(Z.phases - 1, Math.floor(t / DUR)), inPh = t - ph * DUR, hold = DUR * 0.4;
            const rOf = i => Z.R0 - (Z.R0 - Z.Rf) * (i + 1) / Z.phases, rStart = ph === 0 ? Z.R0 : rOf(ph - 1), rEnd = rOf(ph);
            if (t >= Z.T) {   // фінал: зона стискається до нуля — гра точно завершиться
                if (!S.sudden) { S.sudden = true; S.sdAt = now; S.sdR = Z.r; note(r, 'zoneFinal'); }
                Z.r = Math.max(0, S.sdR * (1 - (now - S.sdAt) / 30000)); Z.ph = Z.phases;
            } else {
                if (ph !== Z.ph) { Z.ph = ph; note(r, 'zone', { ph: ph + 1 }); }
                Z.r = inPh <= hold ? rStart : rStart + (rEnd - rStart) * Math.min(1, (inPh - hold) / (DUR - hold));
                S.nextPh = inPh <= hold ? Math.ceil((hold - inPh) / 1000) : 0;
            }
        }
        if (now - S.zdmgAt >= 500) {   // шкода від зони
            const k = (now - S.zdmgAt) / 1000; S.zdmgAt = now;
            const mult = 1 + 0.5 * Math.max(0, Z.ph - 0);
            al.forEach(p => { if (Math.hypot(p.x - Z.x, p.y - Z.y) > Z.r && p.buff !== 'shield') { p.hp = Math.max(0, p.hp - getMaxHp(p.equipped) * r.brDmg / 100 * mult * k); if (p.hp === 0) D.processPlayerDeath(r, p.id, null); } });
        }
        if (now >= S.lootAt) {   // бонуси на випадкових місцях усередині зони
            S.lootAt = now + (r.brLoot ? 12000 : 30000); const max = r.brLoot ? 8 : 3, cur = Object.keys(r.powerups).length;
            for (let i = 0; i < (r.brLoot ? 3 : 1) && cur + i < max; i++) {
                const q = randFree(r, 30); if (Math.hypot(q.x - Z.x, q.y - Z.y) > Math.max(60, Z.r - 40)) continue;
                const pid = 'p_br_' + now + '_' + i; r.powerups[pid] = { id: pid, x: q.x, y: q.y, type: POW_TYPES[Math.floor(Math.random() * POW_TYPES.length)], active: true, spawnTime: now };
            }
        }
        return false;
    }

    // --- захоплення точок ---
    function cpTick(r, S, now, dt, al) {
        if (now < S.end - r.cpTime * 1000) return false;
        S.pts.forEach(pt => {
            const by = {}; al.forEach(p => { if (p.team && Math.hypot(p.x - pt.x, p.y - pt.y) < pt.r) by[p.team] = (by[p.team] || 0) + 1; });
            const ts = Object.keys(by);
            if (ts.length === 1) {
                const t = ts[0], k = by[t], rate = (11 + 5 * (Math.min(4, k) - 1)) * dt;
                if (pt.o === t) { pt.p = 100; pt.w = t; }
                else if (pt.w && pt.w !== t && pt.p > 0) { pt.p = Math.max(0, pt.p - rate * 1.5); if (pt.p === 0) { pt.w = t; if (pt.o && pt.o !== t) pt.o = null; } }
                else { pt.w = t; pt.p = Math.min(100, pt.p + rate); if (pt.p >= 100) { pt.o = t; note(r, 'capture', { t, i: pt.i + 1 }); al.forEach(p => { if (p.team === t && Math.hypot(p.x - pt.x, p.y - pt.y) < pt.r) p.caps = (p.caps || 0) + 1; }); } }
            } else if (ts.length === 0 && !pt.o && pt.p > 0) pt.p = Math.max(0, pt.p - 5 * dt);
        });
        S.acc += dt; if (S.acc >= 1) { S.acc -= 1; S.pts.forEach(pt => { if (pt.o && S.sc[pt.o] !== undefined) S.sc[pt.o] += 1; }); }
        return checkCP(r, S, now);
    }

    // ---------- стан для синхронізації (у пакеті sync2 як md) ----------
    function md(r, now) {
        const S = MS.get(r.id); if (!S) return undefined;
        const left = S.end ? Math.max(0, Math.ceil((S.end - now) / 1000)) : undefined, rn = v => Math.round(v);
        switch (r.mode) {
            case 'base_defense': return { m: r.mode, w: S.wave, W: S.W, st: S.st, c: { x: rn(S.core.x), y: rn(S.core.y), hp: rn(S.core.hp), max: S.core.max, r: S.core.r }, z: Object.keys(r.zombies).length };
            case 'boss_raid': { const b = r.zombies[S.bossId]; const lv = {}; Object.values(r.players).forEach(p => { lv[p.id] = p.out ? 0 : p.lives; }); return { m: r.mode, b: b ? { n: Z_TYPES[S.bt].name, hp: rn(b.hp), max: b.maxHp, x: rn(b.x), y: rn(b.y) } : null, t: left, lv, enr: S.enr, go: now >= S.startAt }; }
            case 'convoy': return { m: r.mode, cv: { x: rn(S.cv.x), y: rn(S.cv.y), hp: rn(S.cv.hp), max: S.cv.max, a: Math.round(S.cv.a * 100) / 100, r: S.cv.r }, A: S.A, B: S.B, prog: Math.round(S.prog * 100), t: left, hold: S.hold, go: now >= S.startAt };
            case 'solo_arena': return { m: r.mode, w: S.wave, W: S.W, st: S.st, pk: S.perks, z: Object.keys(r.zombies).length };
            case 'boss_duel': { const b = r.zombies[S.bossId], p = Object.values(r.players)[0]; return { m: r.mode, i: S.i + 1, N: S.list.length, st: S.st, b: b ? { n: Z_TYPES[S.list[S.i]].name, hp: rn(b.hp), max: b.maxHp } : null, lv: p ? p.lives : 0 }; }
            case 'battle_royale': { const Z = S.zone; return { m: r.mode, z: { x: rn(Z.x), y: rn(Z.y), r: Math.round(Z.r / 4) * 4, ph: Z.ph, np: S.nextPh | 0, go: now >= S.zStart }, al: alive(r).length, n: Object.keys(r.players).length, zt: Math.max(0, Math.ceil((S.zStart - now) / 1000)) }; }
            case 'capture_points': { const sc = {}; S.teams.forEach(t => sc[t] = Math.floor(S.sc[t])); return { m: r.mode, pts: S.pts.map(p => ({ i: p.i, x: p.x, y: p.y, r: p.r, o: p.o, w: p.w, p: Math.round(p.p) })), sc, goal: S.goal, t: left }; }
            case 'bounty': return { m: r.mode, tg: S.target, bv: S.bv, nt: S.target ? Math.max(0, Math.ceil((S.tEnd - now) / 1000)) : 0, t: left, goal: r.bnScore };
        }
    }
    function cleanup(roomId) { MS.delete(roomId); }
    function powerupRule(r) {      // null — режим без бонусів; null-поле own — спавнить сам режим
        if (r.mode === 'battle_royale') return { own: true };
        return { every: 30000, max: 4, count: 2 };
    }

    return { has, readSettings, applyUpdate, start, tick, onDeath, afterLeave, md, cleanup, pickPerk, dmgMult, dmgTaken, onZombieKill, powerupRule, MS };
};
