/* classes_srv.js — класи танків у кооперативі (виживання, оборона бази, конвой). Дані класів — public/js/classes.js.
 * Сервер авторитетний: здібність (сокет 'useAbility') має перезарядку й тривалість лише тут; лікування, турель, артобстріл,
 * ударна хвиля бастіону, ремонт ядра/конвою інженером рахуються в tick(). Клієнт отримує лише події для ефектів і звуку:
 *   'clsAbil' {id,k,dur,x,y} — активація (усім у кімнаті), 'clsCd' {ms} — перезарядка (лише власнику), 'clsLives' {n} — життя,
 *   'clsShell' {x,y} — вибух снаряда артобстрілу, 'clsZap' {o,x,y} — постріл турелі, 'clsSplash' {x,y} — вибух снаряда бомбардира.
 * Також облік внеску (шкода по зомбі, лікування, ремонт, поглинута шкода) — хто майже нічого не зробив, отримує 40% нагороди. */
'use strict';
const TC = require('./public/js/classes.js');
const ModeInfo = require('./public/js/modeinfo.js');

module.exports = function (D) {
    const { io, rooms, getMaxHp, GameData, Modes, checkCollisionServer } = D;
    const hidden = (o, k, v) => { Object.defineProperty(o, k, { value: v, writable: true, configurable: true, enumerable: false }); return v; };   // не потрапляє в JSON / updateLobby
    const st = p => p._cs || hidden(p, '_cs', { cdUntil: 0, until: 0, k: null, next: 0, turret: null, shells: null });
    const on = r => !!r && TC.on(r.mode);
    const live = r => on(r) && r.status === 'playing';
    const eqDmg = p => GameData.statMult(p.equipped, 'dmg');
    const fin = v => Number.isFinite(v);

    // ---------- внесок ----------
    const cpOf = r => r._cp || hidden(r, '_cp', {});
    function addCp(r, id, v) { if (v > 0 && id) { const c = cpOf(r); c[id] = (c[id] || 0) + v; } }
    function contribMul(r, p) {
        if (!on(r)) return 1;
        const ids = Object.keys(r.players); if (ids.length < 2) return 1;
        const c = cpOf(r), sum = ids.reduce((a, id) => a + (c[id] || 0), 0), avg = sum / ids.length;
        if (avg < 200) return 1;                    // бій майже без подій — нікого не штрафуємо
        return (c[p.id] || 0) >= avg * 0.15 ? 1 : 0.4;
    }
    Modes.setContrib(contribMul);

    // ---------- лобі ----------
    function setClass(socket, d) {
        if (!d || typeof d !== 'object') return;
        const r = rooms[d.roomId], p = r && r.players[socket.id];
        if (!p || r.status !== 'lobby' || !TC.valid(d.cls) || p.cls === d.cls) return;
        p.cls = d.cls; io.to(r.id).emit('updateLobby', r);
    }

    // ---------- старт матчу: клас → база характеристик (окрема копія екіпіровки з множником HP; реальна повертається після бою) ----------
    function onStart(r, pK, now) {
        if (!on(r)) return;
        hidden(r, '_cp', {});
        const lv = r.mode === 'survival' ? r.svLives : r.mode === 'base_defense' ? r.bdLives : r.cvLives, L = ModeInfo.livesN(lv);
        pK.forEach(id => {
            const p = r.players[id]; if (!p) return;
            if (!TC.valid(p.cls)) p.cls = TC.DEF;
            const c = TC.of(p.cls), real = p.realEq || p.equipped;
            hidden(p, 'realEq', real); p.equipped = Object.assign({}, real); hidden(p.equipped, 'hpMul', c.hp / TC.BASE.hp);
            p.hp = getMaxHp(p.equipped);
            const s = st(p); s.cdUntil = now + 4000 + 2000; s.until = 0; s.k = null; s.turret = null; s.shells = null;
            // після 'gameStarting' (клієнт на ньому скидає стан класів)
            if (!p.isBot) setTimeout(() => { io.to(p.id).emit('clsCd', { ms: Math.max(0, s.cdUntil - Date.now()), full: c.ab.cd }); io.to(p.id).emit('clsLives', { n: L === Infinity ? null : L }); }, 150);
        });
    }

    // ---------- модифікатори (гарячі шляхи server.js) ----------
    function dmgMul(r, p, now) {
        if (!p || !p.cls || !live(r)) return 1;
        const c = TC.of(p.cls), s = p._cs; let m = c.dmg / TC.BASE.dmg;
        if (s && s.k === 'shadow' && (now || Date.now()) < s.until) m *= c.ab.mul;
        return m;
    }
    function baseMul(r, p) { return p && p.cls && live(r) ? TC.of(p.cls).dmg / TC.BASE.dmg : 1; }   // клас без здібностей (для визначення «крита»)
    function taken(r, p, amt) {
        const s = p && p._cs; if (!s || !live(r) || s.k !== 'bastion' || Date.now() >= s.until) return amt;
        const red = TC.C.tank.ab.red; addCp(r, p.id, amt * red * 0.5); return amt * (1 - red);
    }
    function speedMul(r, p) {
        if (!p || !p.cls || !live(r)) return 1;
        const c = TC.of(p.cls), s = p._cs; let m = c.spd;
        if (s && Date.now() < s.until && (s.k === 'shadow' || s.k === 'rage')) m *= c.ab.spd || 1;
        return m;
    }
    // вибір цілі зомбі: «тінь» — невидимий (якщо не впритул), «бастіон» — притягує всіх у радіусі
    function weight(p, d, now) {
        const s = p._cs; if (!s || now >= s.until) return d;
        if (s.k === 'shadow') return d > 70 ? d * 8 : d;
        if (s.k === 'bastion') return d < TC.C.tank.ab.r ? d * 0.25 : d;
        return d;
    }

    // ---------- шкода зомбі ----------
    function hurt(r, zid, dmg, ownerId) {
        const z = r.zombies[zid]; if (!z || z.hp <= 0 || !(dmg > 0)) return false;
        addCp(r, ownerId, Math.min(dmg, z.hp)); z.hp -= dmg;
        if (z.hp <= 0) {
            if (z.type === 'bomber') io.to(r.id).emit('bomberExplode', { x: z.x, y: z.y, dmg: Math.round(50 * (z.dmgMult || 1)) });
            if (Modes.has(r.mode)) Modes.onZombieKill(r, ownerId, z);
            delete r.zombies[zid]; if (D.onZDeath) D.onZDeath(r, z, ownerId); return true;
        }
        return false;
    }
    function area(r, x, y, rad, dmg, ownerId, skip) {
        for (const zid in r.zombies) { if (zid === skip) continue; const z = r.zombies[zid]; if (Math.hypot(z.x - x, z.y - y) < rad + 12) hurt(r, zid, dmg, ownerId); }
    }
    // влучання гравця по зомбі (zombieHit) — облік внеску + осколки бомбардира (лише звичайні снаряди, не бафи)
    function onHit(r, p, zid, fD, type) {
        if (!live(r) || !p) return;
        const z = r.zombies[zid]; if (!z) return;
        addCp(r, p.id, Math.min(fD, Math.max(0, z.hp)));
        if (p.cls === 'bomber' && (!type || type === 'none' || type === 'normal')) {
            const sp = TC.C.bomber.splash; area(r, z.x, z.y, sp.r, fD * sp.k, p.id, zid);
            io.to(r.id).emit('clsSplash', { x: Math.round(z.x), y: Math.round(z.y) });
        }
    }

    // ---------- здібність ----------
    function use(socket, d) {
        if (!d || typeof d !== 'object') return;
        const r = rooms[d.roomId], p = r && r.players[socket.id];
        if (!live(r) || !p || p.hp <= 0 || p.out || !p.cls) return;
        const now = Date.now(), s = st(p), c = TC.of(p.cls), A = c.ab;
        if (now < s.cdUntil) { socket.emit('clsCd', { ms: s.cdUntil - now, full: A.cd }); return; }
        s.k = A.k; s.until = now + A.dur; s.cdUntil = now + A.cd; s.next = now;
        const ev = { id: p.id, k: A.k, dur: A.dur, x: Math.round(p.x), y: Math.round(p.y) };
        if (A.k === 'bastion') {      // ударна хвиля: шкода й відкидання
            const pw = A.pulse * eqDmg(p);
            for (const zid in r.zombies) {
                const z = r.zombies[zid], dx = z.x - p.x, dy = z.y - p.y, l = Math.hypot(dx, dy);
                if (l > A.pr) continue;
                if (!hurt(r, zid, pw, p.id) && l > 1 && !(z.type || '').match(/^(pikus|shurik|oneshot|padlo|titan)$/)) {
                    const nx = z.x + dx / l * 80, ny = z.y + dy / l * 80; if (!checkCollisionServer(r.map, nx, ny, 16, [], r)) { z.x = nx; z.y = ny; }
                }
            }
        } else if (A.k === 'barrage') {      // точка прицілу — не далі за range від танка
            let tx = +d.x, ty = +d.y; if (!fin(tx) || !fin(ty)) { tx = p.x + Math.cos(p.turretAngle || 0) * 300; ty = p.y + Math.sin(p.turretAngle || 0) * 300; }
            const dx = tx - p.x, dy = ty - p.y, l = Math.hypot(dx, dy); if (l > A.range) { tx = p.x + dx / l * A.range; ty = p.y + dy / l * A.range; }
            s.shells = { x: tx, y: ty, left: A.shots, next: now + 450 }; ev.x = Math.round(tx); ev.y = Math.round(ty);
        } else if (A.k === 'turret') {
            let tx = p.x + Math.cos(p.turretAngle || 0) * 55, ty = p.y + Math.sin(p.turretAngle || 0) * 55;
            if (checkCollisionServer(r.map, tx, ty, 18, [], r)) { tx = p.x; ty = p.y; }
            s.turret = { x: tx, y: ty, until: now + A.dur, next: now + 500 }; ev.x = Math.round(tx); ev.y = Math.round(ty);
        }
        io.to(r.id).emit('clsAbil', ev);
        socket.emit('clsCd', { ms: A.cd, full: A.cd });
    }

    // ---------- тік (20 Гц) ----------
    function tick(r, now, dt) {
        if (!live(r)) return;
        const ps = Object.values(r.players), MSr = Modes.MS && Modes.MS.get(r.id), str = MSr && (MSr.core || MSr.cv);
        for (const p of ps) {
            if (!p.cls) continue;
            const c = TC.of(p.cls), A = c.ab, s = p._cs, alive = p.hp > 0 && !p.out;
            // інженер: ремонт ядра / конвою поруч
            if (p.cls === 'engineer' && alive && str && str.hp > 0 && str.hp < str.max && Math.hypot(str.x - p.x, str.y - p.y) < c.rr) {
                const add = Math.min(str.max - str.hp, c.repair * dt); str.hp += add; addCp(r, p.id, add * 2);
            }
            if (!s) continue;
            if (!alive && s.k === 'heal' && s.until > now) s.until = now;      // загиблий лікар — поле гасне
            if (s.k === 'heal' && now < s.until && now >= s.next) {
                s.next = now + A.tick;
                for (const q of ps) {
                    if (q.hp <= 0 || q.out || Math.hypot(q.x - p.x, q.y - p.y) > A.r) continue;
                    const mx = getMaxHp(q.equipped), b = q.hp; q.hp = Math.min(mx, q.hp + A.amt); addCp(r, p.id, (q.hp - b) * 1.5);
                }
            }
            if (s.shells && now >= s.shells.next) {
                const S = s.shells, a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * A.r, x = S.x + Math.cos(a) * rr, y = S.y + Math.sin(a) * rr;
                area(r, x, y, A.br, A.dmg * eqDmg(p), p.id);
                io.to(r.id).emit('clsShell', { x: Math.round(x), y: Math.round(y) });
                S.left--; S.next = now + Math.round((A.dur - 450) / A.shots); if (S.left <= 0) s.shells = null;
            }
            if (s.turret) {
                const T = s.turret;
                if (now >= T.until || !r.players[p.id]) s.turret = null;
                else if (now >= T.next) {
                    T.next = now + A.rate; let best = null, bd = A.r;
                    for (const zid in r.zombies) { const z = r.zombies[zid], dd = Math.hypot(z.x - T.x, z.y - T.y); if (dd < bd) { bd = dd; best = zid; } }
                    if (best) { const z = r.zombies[best]; (io.to(r.id).volatile || io.to(r.id)).emit('clsZap', { o: p.id, x: Math.round(z.x), y: Math.round(z.y) }); hurt(r, best, A.dmg * eqDmg(p), p.id); }
                }
            }
        }
    }
    function reset(p) { const s = p && p._cs; if (s) { s.until = 0; s.k = null; s.turret = null; s.shells = null; } }

    return { onStart, setClass, use, tick, dmgMul, baseMul, taken, speedMul, weight, onHit, contribMul, reset, on, live, hurt, area };
};
