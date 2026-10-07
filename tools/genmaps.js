// Генератор мап (24 шт., по 3 на кожен режим). Запуск: node tools/genmaps.js → пише maps_modes.js (його підключає server.js).
// Усі мапи — звичайні мапи редактора: їх можна відкрити в /editor.html, змінити й зберегти.
const fs = require('fs'), path = require('path');
const MO = require('../public/js/mapobjects.js');

let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(rnd() * a.length)];
const TAU = Math.PI * 2;
const COL = { stone: '#8d8579', stoneD: '#5d5751', dark: '#4b5563', brick: '#9b5a45', brickD: '#7a3f31', sand: '#c2a272', adobe: '#b8905a', ice: '#a9c7dc', metal: '#64748b', metalD: '#3f4a5a', wood: '#8a5a2b', rust: '#9a4d2f', obs: '#2a2528', slate: '#5d6b7a', ochre: '#c9a14a', terra: '#b5593c', moss: '#6b7d5a', white: '#cbd5e1' };
const BG = { grass: '#5c8a45', sand: '#cfae72', snow: '#dce8f1', stone: '#8a8378', asphalt: '#44474c', metal: '#566270', dirt: '#7b5d3e', swamp: '#3b5440', lava: '#2a2220', tech: '#0e1a2b' };
const GRID = { grass: '#4b7238', sand: '#b8975c', snow: '#c4d3df', stone: '#756e64', asphalt: '#393b40', metal: '#4a5562', dirt: '#664b31', swamp: '#2f4534', lava: '#1f1816', tech: '#16273d' };

class M {
    constructor(name, size, theme, modes, bg) {
        this.m = { title: name, size, bg: bg || BG[theme], grid: GRID[theme], theme, modes, solids: [] }; this.S = this.m.solids; this.size = size;
        this.res = [];   // зарезервовані ділянки (дороги/проходи), де не розкидаємо декор
    }
    add(o) { this.S.push(o); return o; }
    // ---- будівельні блоки ----
    wall(x, y, w, h, color, extra) { return this.add(Object.assign({ type: 'wall', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color: color || COL.dark }, extra || {})); }
    sq(x, y, w, h, color, extra, rot) { const o = Object.assign({ type: 'wall_square', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color: color || COL.dark }, extra || {}); if (rot) o.rot = Math.round(rot); return this.add(o); }
    segw(x1, y1, x2, y2, t, color, extra) { // похила стіна від точки до точки
        const len = Math.hypot(x2 - x1, y2 - y1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return this.add(Object.assign({ type: 'wall', x: Math.round(mx - len / 2), y: Math.round(my - t / 2), w: Math.round(len), h: Math.round(t), color: color || COL.dark, rot: ((Math.round(ang) % 360) + 360) % 360 || undefined }, extra || {}));
    }
    water(x, y, w, h, curve) { return this.add({ type: curve ? 'water_curve' : 'water_square', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }); }
    tree(x, y, r) { return this.add({ type: 'tree', x: Math.round(x), y: Math.round(y), r: Math.round(r || rr(40, 70)) }); }
    prop(t, x, y, w, h, rot) { const o = { type: t, x: Math.round(x), y: Math.round(y), w, h }; if (rot) o.rot = ((Math.round(rot) % 360) + 360) % 360; return this.add(o); }
    crate(x, y) { return this.prop('prop_crate', x, y, 50, 50); }
    barrel(x, y) { return this.prop('prop_barrel', x, y, 40, 40); }
    sand(x, y, w, h, rot) { return this.prop('prop_sandbag', x, y, w || 100, h || 40, rot); }
    hedge(x, y) { return this.prop('prop_hedgehog', x, y, 60, 60); }
    conc(x, y, w, h, rot) { return this.prop('prop_concrete', x, y, w || 100, h || 50, rot); }
    rock(x, y, w, h) { return this.prop('prop_rock', x, y, w || 80, h || 70); }
    bush(x, y) { return this.prop('prop_bush', x, y, 60, 60); }
    neon(t, x, y, w, h, color) { return this.add({ type: t, x, y, w, h, color: color || '#22d3ee' }); }
    line(pts, width, color, stripe) { const o = { type: 'line', points: pts.map(p => ({ x: Math.round(p[0]), y: Math.round(p[1]) })), color, width }; if (stripe) o.stripe = stripe; return this.add(o); }
    P(x, y) { return this.add({ type: 'spawn_player', x: Math.round(x), y: Math.round(y) }); }
    Z(x, y) { return this.add({ type: 'spawn_zombie', x: Math.round(x), y: Math.round(y) }); }
    U(x, y) { return this.add({ type: 'spawn_powerup', x: Math.round(x), y: Math.round(y) }); }
    mk(type, x, y) { return this.add({ type, x: Math.round(x), y: Math.round(y) }); }
    // ---- резервування й перевірки ----
    keep(x, y, r) { this.res.push({ c: [x, y, r] }); }
    keepLine(pts, w) { this.res.push({ l: pts, w }); }
    keepRect(x, y, w, h) { this.res.push({ r: [x, y, w, h] }); }
    reserved(x, y, r) {
        for (const q of this.res) {
            if (q.c && Math.hypot(x - q.c[0], y - q.c[1]) < r + q.c[2]) return true;
            if (q.r && x + r > q.r[0] && x - r < q.r[0] + q.r[2] && y + r > q.r[1] && y - r < q.r[1] + q.r[3]) return true;
            if (q.l) for (let i = 1; i < q.l.length; i++) if (MO.distToSeg(x, y, q.l[i - 1][0], q.l[i - 1][1], q.l[i][0], q.l[i][1]) < r + q.w / 2) return true;
        }
        return false;
    }
    free(x, y, r) { return !MO.collides(this.m, x, y, r) && !this.reserved(x, y, r); }
    rectFree(x, y, w, h, pad) {
        for (let px = x - pad; px <= x + w + pad + 1; px += 40) for (let py = y - pad; py <= y + h + pad + 1; py += 40) if (MO.collides(this.m, Math.min(px, this.size - 30), Math.min(py, this.size - 30), 24) || this.reserved(px, py, 10)) return false;
        return true;
    }
    inShape(x, y, r) { return !this.m.shape || MO.circleInPoly(this.m.shape, x, y, r); }
    // розкид: fn(x,y) викликається на вільних точках у прямокутнику/колі
    scatter(n, rect, rad, fn, tries) {
        let placed = 0, t = 0; const lim = (tries || 40) * n;
        while (placed < n && t++ < lim) {
            const x = rr(rect[0], rect[0] + rect[2]), y = rr(rect[1], rect[1] + rect[3]);
            if (!this.free(x, y, rad)) continue; fn(x, y); placed++;
        }
        return placed;
    }
    forest(rect, n, r0, r1, bushP) { return this.scatter(n, rect, r1 + 14, (x, y) => { if (bushP && rnd() < bushP) this.bush(x - 30, y - 30); else this.tree(x, y, rr(r0, r1)); }); }
    // кільце стін навколо прямокутника з проходами {n,s,e,w:[[a,b],..]}
    ring(x0, y0, x1, y1, t, gaps, color, extra) {
        const g = gaps || {}, seg = (a, b, gp, fn) => { let cur = a; (gp || []).slice().sort((p, q) => p[0] - q[0]).forEach(([f, to]) => { if (f > cur) fn(cur, f); cur = to; }); if (cur < b) fn(cur, b); };
        seg(x0, x1, g.n, (a, b) => this.wall(a, y0, b - a, t, color, extra));
        seg(x0, x1, g.s, (a, b) => this.wall(a, y1 - t, b - a, t, color, extra));
        seg(y0 + t, y1 - t, g.w, (a, b) => this.wall(x0, a, t, b - a, color, extra));
        seg(y0 + t, y1 - t, g.e, (a, b) => this.wall(x1 - t, a, t, b - a, color, extra));
    }
    // кругова стіна (із похилих сегментів) з проходами по кутах [[a0,a1],..] у градусах
    circle(cx, cy, R, t, color, gaps, n, extra) {
        n = n || 32;
        for (let i = 0; i < n; i++) {
            const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2 * 180 / Math.PI;
            if ((gaps || []).some(([g0, g1]) => { const d = ((am - g0) % 360 + 360) % 360; return d <= ((g1 - g0) % 360 + 360) % 360; })) continue;
            this.segw(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, t, color, extra);
        }
    }
    border(t, color) { const S = this.size; this.ring(0, 0, S, S, t, {}, color || COL.dark); }
    // дах-будівля (суцільний блок) з тінню
    house(x, y, w, h, color, extra) { return this.sq(x, y, w, h, color, extra); }
    // дорога: ламана + резервування
    road(pts, w, color, stripe) { this.line(pts, w, color, stripe); this.keepLine(pts, w + 40); }
    // фінал: маркери зсуваємо з перешкод; недосяжні бонуси/зомбі-точки прибираємо
    out() {
        const Nav = require('../navgrid.js'), san0 = () => MO.sanitizeMap(JSON.parse(JSON.stringify(this.m)));
        this.S.forEach(o => {
            if (!/spawn/.test(o.type) || (!MO.collides(this.m, o.x, o.y, 32) && (!this.m.shape || MO.circleInPoly(this.m.shape, o.x, o.y, 32)))) return;
            for (let rad = 20; rad <= 450; rad += 20) for (let k = 0; k < 20; k++) {
                const a = k / 20 * TAU, x = Math.round(o.x + Math.cos(a) * rad), y = Math.round(o.y + Math.sin(a) * rad);
                if (!MO.collides(this.m, x, y, 36) && (!this.m.shape || MO.circleInPoly(this.m.shape, x, y, 36))) { o.x = x; o.y = y; return; }
            }
        });
        // «прориваємо» декор (пропи/дерева), що перекриває шлях до важливих точок
        const isDeco = o => /^prop_(?!door)/.test(o.type) || o.type === 'tree';
        for (let it = 0; it < 12; it++) {
            const sn = san0(), gg = Nav.getGrid(sn, 30), p0 = sn.solids.find(o => o.type === 'spawn_player'), ff = Nav.buildField(gg, p0.x, p0.y);
            const rch = o => ff.dist[Math.floor(o.y / Nav.CS) * gg.N + Math.floor(o.x / Nav.CS)] >= 0;
            const bad = sn.solids.filter(o => /spawn/.test(o.type) && o.type !== 'spawn_powerup' && !rch(o) && !MO.collides(sn, o.x, o.y, 28));
            if (!bad.length) break;
            const alt = JSON.parse(JSON.stringify(sn)); alt.solids = alt.solids.filter(o => !isDeco(o)); const g2 = Nav.getGrid(alt, 30);
            let removed = 0;
            bad.forEach(b => {
                const fl = Nav.buildField(g2, b.x, b.y); let cx = Math.floor(p0.x / Nav.CS), cy = Math.floor(p0.y / Nav.CS), guard = 0;
                if (fl.dist[cy * g2.N + cx] < 0) return;
                while (fl.dist[cy * g2.N + cx] > 0 && guard++ < 4000) {
                    const x = (cx + 0.5) * Nav.CS, y = (cy + 0.5) * Nav.CS;
                    for (let i = this.S.length - 1; i >= 0; i--) { const o = this.S[i]; if (isDeco(o) && MO.collides({ size: this.size, solids: [o] }, x, y, 38)) { this.S.splice(i, 1); removed++; } }
                    let best = null, bd = fl.dist[cy * g2.N + cx];
                    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= g2.N || ny >= g2.N) continue; const dd = fl.dist[ny * g2.N + nx]; if (dd >= 0 && dd < bd) { bd = dd; best = [nx, ny]; } }
                    if (!best) break; cx = best[0]; cy = best[1];
                }
            });
            if (!removed) break;
        }
        const san = san0(), g = Nav.getGrid(san, 30), pp = san.solids.find(o => o.type === 'spawn_player'), f = Nav.buildField(g, pp.x, pp.y);
        const reach = o => f.dist[Math.floor(o.y / Nav.CS) * g.N + Math.floor(o.x / Nav.CS)] >= 0;
        this.m.solids = this.S.filter(o => (o.type !== 'spawn_powerup' && o.type !== 'spawn_zombie') || (!MO.collides(this.m, o.x, o.y, 30) && reach(o)));
        this.S = this.m.solids; return this.m;
    }
}

// ---------- сплайн-коридор для конвою ----------
function spline(pts, step) {
    const out = []; const P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
        const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.round(seg / step));
        for (let k = 0; k < n; k++) {
            const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
            out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]);
        }
    }
    const l = pts[pts.length - 1]; out.push([l[0], l[1], l[2]]); return out;
}
// коридор: полілінія з півшириною (3-й елемент) → полігон
function corridor(route) {
    const L = [], R = [];
    for (let i = 0; i < route.length; i++) {
        const a = route[Math.max(0, i - 1)], b = route[Math.min(route.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = route[i][2];
        L.push({ x: Math.round(route[i][0] + nx * w), y: Math.round(route[i][1] + ny * w) }); R.push({ x: Math.round(route[i][0] - nx * w), y: Math.round(route[i][1] - ny * w) });
    }
    const cap = (p, q, w) => { const a = Math.atan2(q[1] - p[1], q[0] - p[0]), pts = []; for (let k = 1; k < 8; k++) { const t = a + Math.PI / 2 - (k / 8) * Math.PI; pts.push({ x: Math.round(p[0] + Math.cos(t) * w), y: Math.round(p[1] + Math.sin(t) * w) }); } return pts; };
    const e = route[route.length - 1], e0 = route[route.length - 2], s = route[0], s1 = route[1];
    return [].concat(L, cap(e, [e[0] + (e[0] - e0[0]), e[1] + (e[1] - e0[1])], e[2]), R.reverse(), cap(s, [s[0] + (s[0] - s1[0]), s[1] + (s[1] - s1[1])], s[2]));
}

const maps = {};
// мапи нових режимів дозволяємо й у схожих класичних, щоб жоден режим не лишався без мап
const EXTRA = { base_defense: ['survival'], boss_raid: ['survival'], solo_arena: ['survival'], boss_duel: [], convoy: [], battle_royale: ['deathmatch', 'prophunt'], bounty: ['deathmatch', 'prophunt'], capture_points: ['team_deathmatch'] };
const def = (name, size, theme, modes, bg, fn) => { const m = new M(name, size, theme, modes.concat(EXTRA[modes[0]] || []), bg); fn(m); maps[name] = m.out(); return m; };

// =====================================================================================================
//  1-3  ОБОРОНА БАЗИ
// =====================================================================================================
def('Iron Bastion', 3000, 'metal', ['base_defense'], '#566270', m => {
    const C = 1500, H = 470, T = 60, G = 90;
    // дороги від воріт до країв
    [[C, 0, C, C - H], [C, C + H, C, 3000], [0, C, C - H, C], [C + H, C, 3000, C]].forEach(([a, b, c, d]) => m.road([[a, b], [c, d]], 170, '#3b424b', '#e5e7eb'));
    m.keep(C, C, H + 40);
    m.ring(C - H, C - H, C + H, C + H, T, { n: [[C - G, C + G]], s: [[C - G, C + G]], w: [[C - G, C + G]], e: [[C - G, C + G]] }, COL.metal, { stripe: '#facc15' });
    [[C - H - 70, C - H - 70], [C + H - 90, C - H - 70], [C - H - 70, C + H - 90], [C + H - 90, C + H - 90]].forEach(([x, y]) => { m.sq(x, y, 160, 160, COL.metalD, { neon: '#38bdf8' }); m.prop('prop_spotlight', x + 60, y + 60, 40, 40); });
    // двір: ядро в центрі, генератори, термінал, укриття
    m.mk('spawn_core', C, C); m.prop('prop_pad', C - 110, C - 110, 220, 220); m.keep(C, C, 120);
    [[-250, -250], [200, -250], [-250, 190], [200, 190]].forEach(([dx, dy]) => m.prop('prop_generator', C + dx, C + dy, 80, 70));
    [[-60, -330], [-60, 290]].forEach(([dx, dy]) => m.prop('prop_terminal', C + dx, C + dy, 50, 50)); m.prop('prop_solar', C + 150, C + 290, 100, 70); m.prop('prop_solar', C - 250, C - 340, 100, 70);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(C + sx * 150, C + sy * 150));
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {  // укриття збоку від воріт зсередини й ззовні
        const px = -dy, py = dx;
        [-1, 1].forEach(sd => { m.sand(C + dx * (H - 130) + px * 170 * sd - 50 * Math.abs(px), C + dy * (H - 130) + py * 170 * sd - 20 * Math.abs(py), px ? 40 : 100, px ? 100 : 40); m.hedge(C + dx * (H + 110) + px * 200 * sd - 30, C + dy * (H + 110) + py * 200 * sd - 30); });
    });
    // зовнішня лінія оборони: мішки й бетон по діагоналях
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([sx, sy]) => { for (let i = 0; i < 4; i++) { const d = 700 + i * 120, x = C + sx * d * 0.78, y = C + sy * d * 0.78; if (m.free(x, y, 60)) { m.conc(x - 50, y - 25, 100, 50, sx * sy > 0 ? 45 : 135); } } });
    // сміття й техніка зовні
    m.scatter(9, [200, 200, 2600, 2600], 70, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 3) * 45), 80);
    m.scatter(14, [150, 150, 2700, 2700], 40, (x, y) => m.prop('prop_tires', x - 25, y - 25, 50, 50), 80);
    m.scatter(12, [150, 150, 2700, 2700], 32, (x, y) => m.barrel(x - 20, y - 20), 80);
    m.scatter(10, [120, 120, 2760, 2760], 45, (x, y) => m.rock(x - 40, y - 35), 80);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; m.Z(1500 + Math.cos(a) * 1420, 1500 + Math.sin(a) * 1420); }
    [[C - 330, C - 330], [C + 330, C - 330], [C - 330, C + 330], [C + 330, C + 330], [C, C - 700], [C, C + 700], [C - 700, C], [C + 700, C]].forEach(([x, y]) => m.U(x, y));
});

def('Frozen Outpost', 3200, 'snow', ['base_defense'], '#dce8f1', m => {
    const C = 1600, H = 400, T = 55;
    m.road([[C, 0], [C, 3200]], 190, '#b5c4d1', '#f8fafc'); m.road([[0, C], [3200, C]], 190, '#b5c4d1', '#f8fafc');
    m.keep(C, C, H + 60);
    // замерзлі озера та ліси
    m.water(180, 220, 820, 560, true); m.water(2200, 2420, 820, 560, true); m.keep(590, 500, 440); m.keep(2610, 2700, 440);
    m.ring(C - H, C - H, C + H, C + H, T, { n: [[C - 100, C + 100]], s: [[C - 100, C + 100]], w: [[C - 55, C + 55]], e: [[C - 55, C + 55]] }, COL.ice, { stripe: '#e0f2fe' });
    m.sq(C - H - 40, C - H - 40, 130, 130, '#86a9c4'); m.sq(C + H - 90, C - H - 40, 130, 130, '#86a9c4'); m.sq(C - H - 40, C + H - 90, 130, 130, '#86a9c4'); m.sq(C + H - 90, C + H - 90, 130, 130, '#86a9c4');
    m.mk('spawn_core', C, C); m.prop('prop_pad', C - 100, C - 100, 200, 200);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(C + sx * 140, C + sy * 140));
    [[-260, -260], [230, 190], [-290, 170], [210, -280]].forEach(([dx, dy]) => m.prop('prop_tent', C + dx, C + dy, 90, 80));
    [[-60, -30], [60, -30]].forEach(([dx, dy]) => m.prop('prop_campfire', C + dx - 25, C + dy - 25 + 120, 50, 50));
    // окопи з мішків і дерев'яні барикади перед воротами
    [[0, -1], [0, 1]].forEach(([dx, dy]) => { [-1, 1].forEach(sd => { m.sand(C + sd * 190 - 50, C + dy * (H + 150) - 20, 100, 40); m.prop('prop_wood_wall', C + sd * 330 - 75, C + dy * (H + 280) - 15, 150, 30); m.hedge(C + sd * 140 - 30, C + dy * (H + 280) - 30); }); });
    [[-1, 0], [1, 0]].forEach(([dx]) => { m.sand(C + dx * (H + 150) - 20, C - 160, 40, 100); m.sand(C + dx * (H + 150) - 20, C + 60, 40, 100); });
    m.forest([2100, 150, 900, 1000], 36, 36, 70); m.forest([200, 2150, 900, 900], 34, 36, 70);
    m.forest([150, 1000, 700, 400], 8, 36, 60); m.forest([2400, 1700, 650, 400], 8, 36, 60); m.forest([1100, 120, 800, 400], 10, 36, 60); m.forest([1100, 2680, 800, 400], 10, 36, 60);
    m.scatter(12, [100, 100, 3000, 3000], 45, (x, y) => m.rock(x - 40, y - 35), 60);
    m.scatter(8, [100, 100, 3000, 3000], 30, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 2) * 90), 60);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.26; m.Z(1600 + Math.cos(a) * 1500, 1600 + Math.sin(a) * 1500); }
    [[C - 280, C - 20], [C + 280, C - 20], [C, C - 300], [C, C + 300], [C - 700, C - 400], [C + 700, C + 400], [C - 700, C + 500], [C + 700, C - 500]].forEach(([x, y]) => m.U(x, y));
});

def('Desert Fort', 3000, 'sand', ['base_defense'], '#cfae72', m => {
    const C = 1500, H = 540, T = 70, WC = COL.adobe;
    m.road([[0, C], [3000, C]], 180, '#b99a63', '#e8d3a0'); m.keep(C, C, H + 50);
    // форт: ворота зі сходу й заходу, проломи на N (праворуч) і S (ліворуч)
    m.ring(C - H, C - H, C + H, C + H, T, { w: [[C - 110, C + 110]], e: [[C - 110, C + 110]], n: [[C + 250, C + 400]], s: [[C - 400, C - 250]] }, WC);
    [[C - H - 60, C - H - 60], [C + H - 110, C - H - 60], [C - H - 60, C + H - 110], [C + H - 110, C + H - 110]].forEach(([x, y]) => { m.sq(x, y, 170, 170, '#a37b48', { stripe: '#d9b777' }); m.prop('prop_statue', x + 55, y + 55, 60, 60); });
    m.mk('spawn_core', C, C); m.prop('prop_well', C - 35, C - 35, 70, 70); m.keep(C, C, 100);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(C + sx * 170, C + sy * 170));
    [[-350, -350], [260, -350], [-350, 250], [260, 250]].forEach(([dx, dy]) => m.prop('prop_hay', C + dx, C + dy, 80, 80));
    [[-330, -120], [250, -120]].forEach(([dx, dy]) => m.prop('prop_tent', C + dx, C + dy, 110, 90));
    [[-120, -380], [60, -380], [-120, 330], [60, 330]].forEach(([dx, dy]) => m.crate(C + dx, C + dy));
    [[-300, 30], [260, 30]].forEach(([dx, dy]) => m.tree(C + dx + 20, C + dy + 110, 46));
    // оазис і руїни ззовні
    m.water(2200, 300, 520, 360, true); m.keep(2460, 480, 330); [[2160, 260], [2740, 260], [2160, 680], [2740, 680], [2450, 230], [2450, 720]].forEach(([x, y]) => m.tree(x, y, 48));
    m.water(260, 2250, 400, 300, true); m.keep(460, 2400, 260); [[240, 2220], [680, 2220], [240, 2560], [680, 2560]].forEach(([x, y]) => m.tree(x, y, 44));
    for (let i = 0; i < 5; i++) { const x = rr(250, 2650), y = rr(200, 2700); if (m.free(x, y, 160)) { const L = ri(120, 260); m.wall(x - L / 2, y, L, 50, '#a98558'); m.wall(x - L / 2, y, 50, ri(80, 180), '#a98558'); } }
    m.scatter(22, [100, 100, 2800, 2800], 50, (x, y) => m.rock(x - 45, y - 35, ri(70, 110), ri(60, 90)), 60);
    m.scatter(10, [150, 150, 2700, 2700], 40, (x, y) => m.bush(x - 30, y - 30), 40);
    m.scatter(8, [150, 150, 2700, 2700], 30, (x, y) => m.barrel(x - 20, y - 20), 40);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.1; m.Z(1500 + Math.cos(a) * 1430, 1500 + Math.sin(a) * 1430); }
    [[C - 300, C + 20], [C + 300, C + 20], [C, C - 300], [C, C + 330], [C - 800, C], [C + 800, C], [C, C - 800], [C, C + 800]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  4-6  РЕЙД НА БОСА
// =====================================================================================================
def('Throne Hall', 3000, 'stone', ['boss_raid'], '#7d756c', m => {
    const S = 3000;
    m.border(70, COL.stoneD);
    m.road([[1500, 2850], [1500, 700]], 170, '#7f1d1d', '#fbbf24'); m.keepLine([[1500, 2850], [1500, 600]], 200);
    // поміст трону
    m.sq(900, 70, 1200, 110, '#a79f94'); m.sq(1050, 180, 900, 100, '#b3ab9f'); m.sq(1200, 280, 600, 90, '#c0b8ac'); m.keepRect(900, 70, 1200, 320);
    m.prop('prop_crystal', 1460, 90, 80, 80); m.prop('prop_statue', 1010, 100, 60, 60); m.prop('prop_statue', 1930, 100, 60, 60);
    // колони
    [700, 1150, 1850, 2300].forEach(x => [800, 1250, 1700, 2150].forEach(y => { m.sq(x - 50, y - 50, 100, 100, '#a8a094', { stripe: '#c9c1b4' }); }));
    // жаровні, статуї уздовж килима
    [[1300, 780], [1700, 780], [1300, 1480], [1700, 1480], [1300, 2180], [1700, 2180]].forEach(([x, y]) => m.prop('prop_campfire', x - 25, y - 25, 50, 50));
    [[1330, 1110], [1670, 1110], [1330, 1810], [1670, 1810]].forEach(([x, y]) => m.prop('prop_statue', x - 30, y - 30, 60, 60));
    // бічні ніші з укриттям
    m.sq(70, 500, 160, 60, COL.stoneD); m.sq(70, 1100, 160, 60, COL.stoneD); m.sq(70, 1700, 160, 60, COL.stoneD); m.sq(2770, 500, 160, 60, COL.stoneD); m.sq(2770, 1100, 160, 60, COL.stoneD); m.sq(2770, 1700, 160, 60, COL.stoneD);
    [[260, 900], [260, 1500], [260, 2100], [2740, 900], [2740, 1500], [2740, 2100]].forEach(([x, y]) => { m.prop('prop_wood_barrel', x - 22, y - 22, 44, 44); m.crate(x + (x < 1500 ? 40 : -90), y - 25); });
    [[1100, 2500], [1500, 2560], [1900, 2500]].forEach(([x, y]) => m.sand(x - 50, y - 20, 100, 40));
    for (let i = 0; i < 6; i++) { const x = i % 2 ? 2650 : 350, y = 330 + (i >> 1) * 500; m.prop('prop_wood_table', x - 50, y - 25, 100, 50); }
    // боса й мінійонів — на півночі; гравці — на півдні
    m.Z(1500, 520); m.Z(780, 560); m.Z(2220, 560); m.Z(1500, 1000);
    [1340, 1440, 1560, 1660].forEach(x => m.P(x, 2760));
    [[330, 1350], [2670, 1350], [1500, 1350], [800, 2350], [2200, 2350], [1500, 2300]].forEach(([x, y]) => m.U(x, y));
});

def('Volcano Crater', 3200, 'lava', ['boss_raid'], '#2a2220', m => {
    const S = 3200;
    m.border(110, '#3a3338');
    // скельні виступи по краю
    for (let i = 0; i < 18; i++) { const x = rr(150, 3000), y = rr(150, 3000); if (Math.min(x, y, S - x, S - y) < 330 && m.free(x, y, 90)) m.sq(x - 70, y - 50, rr(120, 220), rr(90, 160), '#3e3739', { stripe: undefined }, ri(0, 3) * 15); }
    // лавові озера
    const pools = [[420, 780, 560, 380], [2220, 780, 560, 380], [760, 1750, 480, 340], [1960, 1750, 480, 340], [1300, 1250, 600, 280]];
    pools.forEach(([x, y, w, h]) => { m.water(x, y, w, h, true); m.keep(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 30); });
    // тріщини-лавові ріки (декор)
    m.line([[250, 1500], [650, 1600], [900, 1450], [1150, 1500]], 38, '#4a1d12', '#f97316'); m.line([[2950, 1500], [2500, 1600], [2300, 1450], [2050, 1500]], 38, '#4a1d12', '#f97316');
    // обсидіанові укриття
    [[1000, 700], [2200, 700], [1600, 950], [600, 1350], [2600, 1350], [1000, 2150], [2200, 2150], [1600, 2250]].forEach(([x, y], i) => m.add({ type: 'shape_rhombus', x: x - 55, y: y - 55, w: 110, h: 110, color: i % 2 ? '#1c1917' : '#292524' }));
    [[1250, 1900], [1950, 1900], [1600, 1600]].forEach(([x, y]) => m.sq(x - 45, y - 45, 90, 90, '#4a3f45', { neon: '#f97316' }));
    m.scatter(14, [140, 140, 2920, 2920], 40, (x, y) => m.rock(x - 40, y - 35), 70);
    m.scatter(8, [140, 140, 2920, 2920], 30, (x, y) => m.prop('prop_crater', x - 40, y - 40, 80, 80), 40);
    // платформа гравців (південь) з мішками
    m.sq(1100, 2960, 1000, 60, '#3a3338'); [1300, 1500, 1700].forEach(x => m.sand(x - 50, 2760, 100, 40));
    m.Z(1600, 480); m.Z(900, 520); m.Z(2300, 520); m.Z(1600, 1000);
    [1480, 1560, 1640, 1720].forEach(x => m.P(x, 2900));
    [[320, 1000], [2880, 1000], [1600, 1480], [1000, 2400], [2200, 2400], [1600, 700]].forEach(([x, y]) => m.U(x, y));
});

def('Haunted Swamp', 3200, 'swamp', ['boss_raid'], '#3b5440', m => {
    const S = 3200;
    m.keepRect(1000, 700, 1200, 1600);   // галявина
    m.keepRect(1300, 2700, 600, 400); m.keepRect(1100, 250, 1000, 450);
    // ставки
    [[250, 700, 520, 380], [2430, 800, 520, 380], [300, 1900, 500, 340], [2400, 2000, 520, 360], [1150, 120, 300, 200]].forEach(([x, y, w, h]) => m.water(x, y, w, h, true));
    // руїни каплиці
    m.wall(1250, 1250, 260, 50, '#6b6f68'); m.wall(1700, 1250, 260, 50, '#6b6f68'); m.wall(1250, 1250, 50, 200, '#6b6f68'); m.wall(1910, 1250, 50, 140, '#6b6f68');
    m.wall(1250, 1750, 140, 50, '#6b6f68'); m.wall(1800, 1750, 160, 50, '#6b6f68'); m.wall(1250, 1650, 50, 150, '#6b6f68');
    [[1500, 1520], [1700, 1560], [1400, 1100], [1800, 1100], [1100, 1500], [2100, 1500]].forEach(([x, y]) => m.prop('prop_statue', x - 30, y - 30, 60, 60));
    m.prop('prop_well', 1550, 1450, 70, 70); m.keep(1585, 1485, 80);
    // дерева: густо по периметру, поодинокі на галявині
    m.forest([100, 100, 3000, 3000], 120, 34, 74, 0.1);
    m.scatter(14, [100, 100, 3000, 3000], 30, (x, y) => m.prop('prop_wood_stump', x - 25, y - 25, 50, 50), 40);
    m.scatter(8, [100, 100, 3000, 3000], 30, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
    m.scatter(8, [150, 150, 2900, 2900], 40, (x, y) => m.prop('prop_fence_wood', x - 60, y - 10, 120, 20, ri(0, 3) * 30), 40);
    m.Z(1600, 420); m.Z(1150, 480); m.Z(2050, 480); m.Z(1600, 900);
    [1480, 1560, 1640, 1720].forEach(x => m.P(x, 2900));
    [[700, 1500], [2500, 1500], [1100, 2300], [2100, 2300], [1600, 1950], [1600, 800]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  7-9  КОНВОЙ (мапа-коридор: полігон дороги)
// =====================================================================================================
function convoyMap(name, size, theme, bg, ctrl, opt) {
    return def(name, size, theme, ['convoy'], bg, m => {
        let chord = 0; for (let i = 1; i < ctrl.length; i++) chord += Math.hypot(ctrl[i][0] - ctrl[i - 1][0], ctrl[i][1] - ctrl[i - 1][1]); const route = spline(ctrl, Math.max(60, chord * 1.15 / 135)); m.m.shape = corridor(route);
        const pts = route.map(r => [r[0], r[1]]);
        m.road(pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1), opt.roadW, opt.roadColor, opt.roadStripe);
        const A = ctrl[0], B = ctrl[ctrl.length - 1];
        m.mk('spawn_convoy_a', A[0], A[1]); m.mk('spawn_convoy_b', B[0], B[1]);
        // гравці біля A
        const dx = ctrl[1][0] - A[0], dy = ctrl[1][1] - A[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
        [[-60, -70], [-60, 70], [-130, -70], [-130, 70]].forEach(([a, b]) => m.P(A[0] + ux * (a + 140) - uy * b, A[1] + uy * (a + 140) + ux * b));
        opt.decor(m, route, ctrl);
        // зомбі-точки та бонуси вздовж маршруту (збоку від дороги)
        let n = 0;
        for (let i = 12; i < route.length - 8; i += Math.round(route.length / 11)) {
            const r = route[i], a = route[i - 1], b = route[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, side = n % 2 ? 1 : -1, off = r[2] * 0.62;
            const zx = r[0] + nx * off * side, zy = r[1] + ny * off * side; if (!MO.collides(m.m, zx, zy, 40)) m.Z(zx, zy);
            const ux2 = r[0] - nx * off * 0.5 * side, uy2 = r[1] - ny * off * 0.5 * side; if (!MO.collides(m.m, ux2, uy2, 30)) m.U(ux2, uy2);
            n++;
        }
        // кілька точок зомбі в кінці коридору (щоб було що атакувати в фіналі)
        for (let k = 1; k <= 3; k++) { const r = route[route.length - 1 - k * 5]; if (r && !MO.collides(m.m, r[0], r[1], 40)) m.Z(r[0] + (k % 2 ? 80 : -80), r[1] + 60); }
    });
}
function edgeProps(m, route, fn, every, offK) {
    for (let i = 3; i < route.length - 3; i += every) {
        const r = route[i], a = route[i - 1], b = route[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
        [-1, 1].forEach(sd => { const d = r[2] * (offK || 0.86), x = r[0] + nx * d * sd, y = r[1] + ny * d * sd; if (m.inShape(x, y, 14)) fn(x, y, Math.atan2(ty, tx) * 180 / Math.PI, sd, i); });
    }
}

convoyMap('Highway Run', 3600, 'asphalt', '#44474c', [[300, 3200, 190], [1000, 3180, 190], [1700, 3000, 230], [2400, 3150, 190], [3050, 2800, 240], [3150, 2150, 190], [2650, 1700, 240], [1900, 1700, 190], [1200, 1450, 230], [750, 950, 190], [1150, 480, 240], [2000, 340, 190], [2800, 480, 230], [3300, 320, 200]],
    { roadW: 230, roadColor: '#383b40', roadStripe: '#eab308', decor: (m, route, ctrl) => {
        edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 4 === 0) m.conc(x - 50, y - 25, 100, 50, ang); else if (i % 6 === 1) m.prop('prop_cone', x - 15, y - 15, 30, 30); }, 3, 0.92);
        // аварійні затори: уламки на проїзній частині (з обхідним проходом)
        ctrl.slice(2, -2).forEach((c, k) => { const x = c[0], y = c[1] + (k % 2 ? 70 : -70); m.prop('prop_wreck', x - 70, y - 40, 140, 80, k * 37 % 90); m.prop('prop_tires', x + 110, y - 25, 50, 50); m.barrel(x - 130, y + 20); });
        m.scatter(30, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.prop(pick(['prop_crate', 'prop_barrel', 'prop_tires', 'prop_cone']), x - 22, y - 22, 44, 44); }, 80);
        m.scatter(16, [0, 0, 3600, 3600], 60, (x, y) => { if (m.inShape(x, y, 60)) m.tree(x, y, rr(36, 60)); }, 80);
    } });

convoyMap('Frozen Pass', 3600, 'snow', '#dce8f1', [[250, 3250, 200], [900, 3000, 230], [1500, 3250, 190], [2200, 2950, 230], [2850, 3100, 190], [3250, 2500, 240], [2750, 2000, 200], [2000, 2150, 240], [1300, 1750, 190], [700, 1300, 240], [900, 650, 190], [1700, 400, 230], [2500, 650, 200], [3300, 350, 200]],
    { roadW: 200, roadColor: '#aebfcd', roadStripe: '#f8fafc', decor: (m, route, ctrl) => {
        edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 3 === 0) m.tree(x + sd * 10, y, rr(38, 56)); else if (i % 7 === 1) m.rock(x - 40, y - 30); }, 3, 0.94);
        edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 9 === 4) m.prop('prop_wood_wall', x - 60, y - 14, 120, 28, ang); }, 3, 0.8);
        ctrl.slice(2, -2).forEach((c, k) => { m.sand(c[0] - 50, c[1] + (k % 2 ? 60 : -90), 100, 40); m.prop('prop_tent', c[0] + 90, c[1] + (k % 2 ? 40 : -120), 90, 80); m.prop('prop_campfire', c[0] + 30, c[1] - 20, 50, 50); });
        m.scatter(26, [0, 0, 3600, 3600], 60, (x, y) => { if (m.inShape(x, y, 60)) m.tree(x, y, rr(36, 62)); }, 80);
        m.scatter(10, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.rock(x - 40, y - 30); }, 80);
    } });

convoyMap('Canyon Express', 3600, 'sand', '#cfae72', [[300, 3150, 200], [1000, 3250, 240], [1800, 3100, 190], [2400, 2700, 240], [2500, 2100, 190], [1900, 1700, 240], [1100, 1850, 190], [600, 1400, 240], [900, 800, 200], [1700, 550, 240], [2500, 700, 190], [3100, 1000, 230], [3300, 450, 190]],
    { roadW: 210, roadColor: '#b69a62', roadStripe: '#ead7a4', decor: (m, route, ctrl) => {
        edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 3 === 0) m.rock(x - 45, y - 35, ri(80, 120), ri(70, 100)); }, 3, 0.95);
        edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 8 === 3) m.prop('prop_fence_wood', x - 60, y - 10, 120, 20, ang); }, 3, 0.8);
        ctrl.slice(2, -2).forEach((c, k) => { m.prop('prop_wreck', c[0] - 70, c[1] + (k % 2 ? 50 : -110), 140, 80, 20 * k); m.prop('prop_hay', c[0] + 110, c[1] + (k % 2 ? 20 : -90), 80, 80); m.barrel(c[0] - 150, c[1] + 10); });
        m.scatter(12, [0, 0, 3600, 3600], 45, (x, y) => { if (m.inShape(x, y, 45)) m.bush(x - 30, y - 30); }, 80);
        m.scatter(14, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.rock(x - 40, y - 30); }, 80);
        m.scatter(5, [0, 0, 3600, 3600], 60, (x, y) => { if (m.inShape(x, y, 60)) m.tree(x, y, 42); }, 80);
    } });

// =====================================================================================================
//  10-12  АРЕНА ХВИЛЬ (соло)
// =====================================================================================================
function circlePoly(cx, cy, R, n) { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push({ x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R) }); } return p; }

def('Colosseum', 2400, 'sand', ['solo_arena'], '#d2b27a', m => {
    const C = 1200;
    m.m.shape = circlePoly(C, C, 1120, 40);
    m.circle(C, C, 930, 90, '#a8957a', [[-12, 12], [78, 102], [168, 192], [258, 282]], 36, { stripe: '#d8c7a6' });
    // двері-ворота: тунелі з арками
    [[0, 1], [1, 0], [0, -1], [-1, 0]].forEach(([dx, dy]) => { const gx = C + dx * 930, gy = C + dy * 930; m.prop('prop_campfire', gx + dy * 130 - 25 - dx * 50, gy - dx * 130 - 25 - dy * 50, 50, 50); m.prop('prop_campfire', gx - dy * 130 - 25 - dx * 50, gy + dx * 130 - 25 - dy * 50, 50, 50); });
    // колони-восьмикутник і центр
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16, x = C + Math.cos(a) * 470, y = C + Math.sin(a) * 470; m.sq(x - 45, y - 45, 90, 90, '#b9a98a', { stripe: '#d9ccb0' }); }
    m.prop('prop_statue', C - 60, C - 60, 120, 120); m.keep(C, C, 110);
    [[-190, 0], [190, 0], [0, -190], [0, 190]].forEach(([dx, dy], i) => m.sand(C + dx - (i < 2 ? 20 : 50), C + dy - (i < 2 ? 50 : 20), i < 2 ? 40 : 100, i < 2 ? 100 : 40));
    // кров на піску, уламки, тіні
    m.scatter(12, [120, 120, 2160, 2160], 40, (x, y) => { if (Math.hypot(x - C, y - C) < 850) m.prop('prop_puddle', x - 50, y - 30, 100, 60); }, 50);
    m.scatter(7, [120, 120, 2160, 2160], 35, (x, y) => { if (Math.hypot(x - C, y - C) < 850) m.prop('prop_crater', x - 40, y - 40, 80, 80); }, 50);
    m.scatter(8, [120, 120, 2160, 2160], 36, (x, y) => { if (Math.hypot(x - C, y - C) < 850) m.rock(x - 40, y - 35); }, 50);
    m.mk('spawn_player', C, C + 230); m.P(C - 60, C + 250); m.P(C + 60, C + 250);
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + 0.26; m.Z(C + Math.cos(a) * 1030, C + Math.sin(a) * 1030); }
    [[C - 600, C], [C + 600, C], [C, C - 600], [C, C + 600], [C - 380, C - 380], [C + 380, C + 380]].forEach(([x, y]) => m.U(x, y));
});

def('Neon Grid', 2400, 'tech', ['solo_arena'], '#0e1a2b', m => {
    const C = 1200;
    m.border(60, '#1e3a5f'); m.ring(60, 60, 2340, 2340, 20, {}, '#0ea5e9', { neon: '#22d3ee' });
    // концентричні неонові кільця та квадранти
    m.neon('neon_circle', C - 150, C - 150, 300, 300, '#22d3ee'); m.neon('neon_circle', C - 90, C - 90, 180, 180, '#e879f9');
    m.prop('prop_crystal', C - 45, C - 45, 90, 90); m.keep(C, C, 160);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
        const x = C + sx * 560, y = C + sy * 560;
        m.sq(x - 130, y - 25, 260, 50, '#16324f', { neon: '#22d3ee' }); m.sq(x - 25, y - 130, 50, 260, '#16324f', { neon: '#22d3ee' });
        m.neon('neon_pillar', x - 35, y - 35, 70, 70, '#e879f9');
        m.sq(C + sx * 880 - 60, C + sy * 300 - 40, 120, 80, '#12304d', { neon: '#a78bfa' }); m.sq(C + sx * 300 - 40, C + sy * 880 - 60, 80, 120, '#12304d', { neon: '#a78bfa' });
    });
    [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => { m.sq(C + dx * 900 - (dx ? 30 : 100), C + dy * 900 - (dy ? 30 : 100), dx ? 60 : 200, dy ? 60 : 200, '#1b3d63', { stripe: '#22d3ee' }); m.prop('prop_terminal', C + dx * 720 - 25, C + dy * 720 - 25, 50, 50); });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; m.neon('neon_circle', C + Math.cos(a) * 1050 - 25, C + Math.sin(a) * 1050 - 25, 50, 50, '#38bdf8'); }
    m.mk('spawn_player', C + 40, C + 260); m.P(C - 40, C + 260); m.P(C, C + 300);
    [[200, 200], [1200, 140], [2200, 200], [140, 1200], [2260, 1200], [200, 2200], [1200, 2260], [2200, 2200], [700, 160], [1700, 160], [700, 2240], [1700, 2240]].forEach(([x, y]) => m.Z(x, y));
    [[C - 450, C], [C + 450, C], [C, C - 450], [C, C + 450], [C - 800, C - 800], [C + 800, C + 800]].forEach(([x, y]) => m.U(x, y));
});

def('Ruined Plaza', 2600, 'stone', ['solo_arena'], '#7f8a70', m => {
    const C = 1300;
    m.border(60, '#6e6a62');
    // фонтан
    m.water(C - 190, C - 190, 380, 380, true); m.prop('prop_statue', C - 40, C - 40, 80, 80); m.keep(C, C, 200);
    // арки та уламки колонад
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, x = C + Math.cos(a) * 560, y = C + Math.sin(a) * 560; if (i % 2) { m.sq(x - 40, y - 40, 80, 80, '#9a9a8e', { stripe: '#b8b8aa' }); } else { m.sq(x - 90, y - 25, 180, 50, '#8c8c80', undefined, a * 180 / Math.PI + 90); m.rock(x - 35, y + 40); } }
    // напівзруйновані будівлі по кутах
    [[160, 160], [2020, 160], [160, 2020], [2020, 2020]].forEach(([x, y], i) => {
        const w = 420, h = 420, ox = i % 2 ? -1 : 1; m.wall(x, y, w, 55, '#8d8e82'); m.wall(x, y, 55, h * 0.6, '#8d8e82'); m.wall(x + w - 55, y + (i < 2 ? 0 : 0), 55, h * 0.45, '#8d8e82'); m.wall(x + 120, y + h - 55, w - 120, 55, '#8d8e82');
        m.prop('prop_wood_barrel', x + 150, y + 150, 44, 44); m.crate(x + 220, y + 180); m.tree(x + 330, y + 300, 52);
    });
    m.forest([100, 100, 2400, 2400], 40, 36, 62, 0.2);
    m.scatter(10, [100, 100, 2400, 2400], 32, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
    m.scatter(8, [100, 100, 2400, 2400], 40, (x, y) => m.rock(x - 40, y - 35), 40);
    m.mk('spawn_player', C, C + 330); m.P(C - 70, C + 350); m.P(C + 70, C + 350);
    [[160, 160], [1300, 140], [2440, 160], [140, 1300], [2460, 1300], [160, 2440], [1300, 2460], [2440, 2440]].forEach(([x, y]) => m.Z(x, y));
    [[C - 500, C - 100], [C + 500, C + 100], [C, C - 480], [C, C + 560], [C - 800, C + 600], [C + 800, C - 600]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  13-15  ДУЕЛЬ З БОСОМ
// =====================================================================================================
def('Duelist Pit', 2200, 'stone', ['boss_duel'], '#6a6a72', m => {
    const C = 1100; m.border(60, '#3c3c46');
    m.circle(C, C, 920, 70, '#4c4c58', [], 28);
    m.keep(C, C, 270);
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + 0.39, x = C + Math.cos(a) * 520, y = C + Math.sin(a) * 520; m.sq(x - 45, y - 45, 90, 90, '#8a8a96', { stripe: '#a5a5b2' }); }
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { m.prop('prop_campfire', C + sx * 780 - 25, C + sy * 780 - 25, 50, 50); m.sand(C + sx * 380 - 50, C + sy * 380 - 20, 100, 40, 45 * sx * sy); });
    m.Z(C, 400); [C - 70, C, C + 70].forEach(x => m.P(x, 1800));
    [[C - 600, C], [C + 600, C], [C, C - 100], [C, C + 600]].forEach(([x, y]) => m.U(x, y));
});

def('Ice Cathedral', 2400, 'snow', ['boss_duel'], '#cfdde8', m => {
    const C = 1200; m.border(70, '#7fa1ba');
    [[100, 100, 380, 300], [1920, 100, 380, 300], [100, 2000, 380, 300], [1920, 2000, 380, 300]].forEach(([x, y, w, h]) => { m.water(x, y, w, h, true); m.keep(x + w / 2, y + h / 2, 210); });
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [-1, 0], [1, 0]].forEach(([sx, sy]) => { const x = C + sx * 560, y = C + sy * 520 + (sy === 0 ? 0 : 0); m.sq(x - 50, y - 50, 100, 100, '#9fc3dc', { stripe: '#d6ecfa' }); m.tree(x + (sx ? sx * 100 : 0), y + 130, 40); });
    m.sq(C - 300, 160, 600, 70, '#8fb3cc'); m.sq(C - 200, 230, 400, 60, '#a2c3da'); m.keepRect(C - 300, 160, 600, 130);
    m.prop('prop_crystal', C - 45, 100, 90, 90);
    [[C - 300, 1100], [C + 300, 1100], [C, 1500]].forEach(([x, y]) => m.sand(x - 50, y - 20, 100, 40));
    m.scatter(10, [120, 120, 2160, 2160], 38, (x, y) => m.rock(x - 40, y - 35), 50);
    m.Z(C, 450); [C - 70, C, C + 70].forEach(x => m.P(x, 2050));
    [[C - 700, 1200], [C + 700, 1200], [C, 800], [C, 1700]].forEach(([x, y]) => m.U(x, y));
});

def('Lava Pit', 2400, 'lava', ['boss_duel'], '#2a2220', m => {
    const C = 1200; m.border(80, '#3a3338');
    [[110, 110, 520, 360], [1770, 110, 520, 360], [110, 1930, 520, 360], [1770, 1930, 520, 360], [420, 1050, 380, 300], [1600, 1050, 380, 300]].forEach(([x, y, w, h]) => { m.water(x, y, w, h, true); m.keep(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 20); });
    m.line([[C - 150, 520], [C - 40, 700], [C + 40, 700], [C + 150, 520]], 30, '#4a1d12', '#f97316');
    [[C - 450, 700], [C + 450, 700], [C - 450, 1700], [C + 450, 1700], [C, 1150], [C, 1900]].forEach(([x, y], i) => m.add({ type: 'shape_rhombus', x: x - 50, y: y - 50, w: 100, h: 100, color: i % 2 ? '#1c1917' : '#292524' }));
    m.scatter(8, [120, 120, 2160, 2160], 38, (x, y) => m.rock(x - 40, y - 35), 50);
    m.Z(C, 450); [C - 70, C, C + 70].forEach(x => m.P(x, 2020));
    [[C - 700, 1700], [C + 700, 1700], [C, 1500], [C - 700, 700]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  16-18  КОРОЛІВСЬКИЙ БІЙ
// =====================================================================================================
function brSpawns(m, cx, cy, R, n, rot) {
    let placed = 0;
    for (let i = 0; i < n * 3 && placed < n; i++) {
        const a = (i / n) * TAU + (rot || 0) + (i >= n ? 0.15 * (i / n) : 0);
        for (let d = 0; d < 300; d += 30) { const x = cx + Math.cos(a) * (R - d), y = cy + Math.sin(a) * (R - d); if (m.free(x, y, 40)) { m.P(x, y); placed++; break; } }
    }
}
function seaBorder(m, S, thick, withBeach) {
    m.water(0, 0, S, thick); m.water(0, S - thick, S, thick); m.water(0, thick, thick, S - 2 * thick); m.water(S - thick, thick, thick, S - 2 * thick);
    [[thick, thick, 520, 320], [S - thick - 520, thick, 520, 320], [thick, S - thick - 320, 520, 320], [S - thick - 520, S - thick - 320, 520, 320]].forEach(([x, y, w, h]) => m.water(x, y, w, h, true));
    if (withBeach) { const b = '#e3d3a4'; m.line([[thick - 20, thick - 20], [S - thick + 20, thick - 20], [S - thick + 20, S - thick + 20], [thick - 20, S - thick + 20], [thick - 20, thick - 20]], 140, b); }
}

def('Emerald Island', 4000, 'grass', ['battle_royale'], '#5c8a45', m => {
    const S = 4000, C = 2000;
    m.line([[280, 280], [3720, 280], [3720, 3720], [280, 3720], [280, 280]], 170, '#e3d3a4');
    seaBorder(m, S, 300, false);
    // дороги: ґрунтові, між зонами
    m.road([[C, 700], [C, 3300]], 150, '#8a6d45', '#b69a6b'); m.road([[700, C], [3300, C]], 150, '#8a6d45', '#b69a6b');
    m.road([[C, 700], [900, 900], [700, C]], 120, '#8a6d45'); m.road([[3300, C], [3100, 3100], [C, 3300]], 120, '#8a6d45');
    // центр: військова база
    m.ring(C - 320, C - 320, C + 320, C + 320, 50, { n: [[C - 90, C + 90]], s: [[C - 90, C + 90]], w: [[C - 90, C + 90]], e: [[C - 90, C + 90]] }, COL.metal, { stripe: '#facc15' });
    m.sq(C - 70, C - 70, 140, 140, '#374151', { neon: '#38bdf8' }); m.prop('prop_radar', C - 250, C - 250, 100, 100); m.prop('prop_generator', C + 170, C - 260, 80, 70);
    m.prop('prop_cont_red', C - 270, C + 180, 160, 70); m.prop('prop_cont_blue', C + 110, C + 190, 160, 70); m.crate(C + 130, C - 20); m.crate(C + 180, C - 20); m.crate(C - 220, C - 10);
    m.keep(C, C, 360);
    // північно-західний ліс
    m.forest([420, 420, 1150, 1150], 80, 36, 84, 0.12);
    // північно-східне озеро з островом
    m.water(2650, 520, 800, 600, true); m.sq(2950, 700, 120, 120, '#8d8579'); m.prop('prop_crystal', 2975, 725, 70, 70); m.keep(3050, 820, 450);
    m.forest([2700, 1250, 800, 300], 8, 36, 64);
    // південно-західне село
    [[500, 2650, 300, 240, COL.terra], [900, 2750, 260, 220, COL.slate], [560, 3050, 280, 220, COL.ochre], [1000, 3080, 300, 240, COL.brick]].forEach(([x, y, w, h, c]) => m.house(x, y, w, h, c));
    m.prop('prop_well', 830, 2990, 70, 70); m.prop('prop_wood_cart', 1180, 2750, 120, 70); m.prop('prop_hay', 420, 2950, 80, 80);
    // південно-східний контейнерний двір
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = 2600 + i * 330, y = 2650 + j * 220; m.prop(((i + j) % 2) ? 'prop_cont_blue' : 'prop_cont_red', x, y, 200, 80, (i + j) % 3 === 0 ? 90 : 0); }
    // руїни на середині
    m.wall(1200, 1250, 300, 50, '#8d8579'); m.wall(1200, 1250, 50, 220, '#8d8579'); m.wall(2500, 2600, 280, 50, '#8d8579'); m.wall(2730, 2430, 50, 220, '#8d8579');
    m.forest([300, 300, 3400, 3400], 120, 34, 70, 0.2);
    m.scatter(24, [300, 300, 3400, 3400], 45, (x, y) => m.rock(x - 40, y - 35), 60);
    m.scatter(12, [300, 300, 3400, 3400], 36, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
    brSpawns(m, C, C, 1550, 16, 0.2);
    // лут: база, село, двір, ліс, острів, руїни, дороги
    [[C, C - 200], [C - 200, C], [C + 200, C], [C, C + 220], [1150, 2900], [850, 3350], [2900, 2750], [3250, 3150], [900, 900], [1350, 700], [2950, 760], [1350, 1450], [2650, 2450], [C, 1050], [C, 2950], [1000, C], [3050, C], [700, 2300], [3300, 1700], [1700, 3500]].forEach(([x, y]) => m.U(x, y));
});

def('Frostbite Peak', 4000, 'snow', ['battle_royale'], '#dce8f1', m => {
    const C = 2000;
    m.ring(0, 0, 4000, 4000, 140, {}, '#8aa6bd'); m.keepRect(0, 0, 4000, 160);
    // гірські хребти
    [[500, 700, 900, 120], [2600, 600, 900, 120], [300, 2900, 800, 120], [2900, 3000, 800, 120], [1000, 3500, 600, 110], [3000, 1700, 120, 700], [800, 1500, 120, 600]].forEach(([x, y, w, h], i) => { m.sq(x, y, w, h, i % 2 ? '#8ea7bb' : '#9bb3c6', { stripe: '#e6f1f9' }); });
    // замерзле озеро та тріщини
    m.water(500, 1750, 900, 560, true); m.keep(950, 2030, 480); m.line([[1450, 2000], [1750, 2100], [1950, 2000]], 40, '#9cc3dc', '#ffffff');
    // обсерваторія в центрі
    m.ring(C - 300, C - 300, C + 300, C + 300, 55, { n: [[C - 100, C + 100]], s: [[C - 100, C + 100]], w: [[C - 100, C + 100]], e: [[C - 100, C + 100]] }, '#7a8a99', { stripe: '#fde68a' });
    m.sq(C - 90, C - 90, 180, 180, '#5f7284', { neon: '#7dd3fc' }); m.prop('prop_radar', C + 120, C - 260, 100, 100); m.prop('prop_terminal', C - 250, C + 200, 50, 50); m.prop('prop_generator', C + 170, C + 190, 80, 70); m.keep(C, C, 340);
    // лижна база (хатки)
    [[2800, 450, 260, 200, '#b45309'], [3150, 520, 240, 190, '#92400e'], [2900, 800, 280, 200, '#a16207']].forEach(([x, y, w, h, c]) => m.house(x, y, w, h, c));
    m.prop('prop_campfire', 3230, 790, 50, 50); m.prop('prop_wood_firewood', 2780, 760, 80, 50);
    // печера-руїни
    m.wall(700, 3250, 400, 60, '#7b8794'); m.wall(700, 3250, 60, 300, '#7b8794'); m.wall(1050, 3250, 60, 300, '#7b8794');
    m.forest([200, 200, 3600, 3600], 190, 34, 78, 0.05);
    m.scatter(22, [200, 200, 3600, 3600], 45, (x, y) => m.rock(x - 40, y - 35), 60);
    m.scatter(10, [200, 200, 3600, 3600], 32, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
    brSpawns(m, C, C, 1600, 16, 0.4);
    [[C, C - 200], [C - 200, C], [C + 200, C], [C, C + 200], [3000, 700], [3200, 1050], [900, 3500], [950, 3000], [1000, 2100], [1500, 1100], [2600, 1400], [2600, 2700], [3300, 2500], [700, 1100], [C, 1300], [C, 2750], [1300, C], [2800, C], [1700, 3600], [3400, 3300]].forEach(([x, y]) => m.U(x, y));
});

def('Dust Bowl', 4000, 'sand', ['battle_royale'], '#cfae72', m => {
    const C = 2000;
    m.ring(0, 0, 4000, 4000, 140, {}, '#a98558');
    m.road([[200, C], [3800, C]], 170, '#b99a63', '#e8d3a0'); m.road([[C, 200], [C, 3800]], 170, '#b99a63', '#e8d3a0');
    // каньйонні скелі зліва й справа
    [[260, 500, 600, 260], [260, 3000, 700, 260], [3140, 700, 600, 260], [3040, 3000, 700, 260], [900, 1200, 250, 600], [2850, 2200, 250, 600]].forEach(([x, y, w, h], i) => { m.sq(x, y, w, h, i % 2 ? '#a5744b' : '#b38258', { stripe: '#d6a273' }); });
    // оаза з пальмами
    m.water(1650, 420, 700, 420, true); m.keep(2000, 630, 400); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; m.tree(2000 + Math.cos(a) * 470, 630 + Math.sin(a) * 300, 46); }
    // покинуте містечко в центрі
    [[1550, 1550, 280, 240, COL.adobe], [2170, 1550, 300, 240, '#a98558'], [1550, 2210, 300, 240, '#b9965f'], [2170, 2210, 280, 240, COL.adobe], [1290, 1900, 200, 200, '#a98558'], [2510, 1900, 200, 200, '#b9965f']].forEach(([x, y, w, h, c]) => m.house(x, y, w, h, c));
    m.prop('prop_well', C - 35, C - 35, 70, 70); m.prop('prop_wood_cart', 1700, 1900, 120, 70); m.keep(C, C, 110);
    // розбитий літак (уламки)
    m.prop('prop_wreck', 800, 3300, 200, 90, 12); m.prop('prop_wreck', 1050, 3380, 140, 80, 70); m.prop('prop_cont_blue', 1250, 3280, 160, 70, 20); m.crate(950, 3200); m.crate(1000, 3205); m.barrel(1180, 3400);
    // табір
    [[3000, 1000], [3250, 1100], [3100, 1300]].forEach(([x, y]) => m.prop('prop_tent', x, y, 110, 90)); m.prop('prop_campfire', 3190, 1230, 50, 50);
    m.scatter(34, [200, 200, 3600, 3600], 50, (x, y) => m.rock(x - 45, y - 35, ri(70, 120), ri(60, 100)), 60);
    m.scatter(30, [200, 200, 3600, 3600], 40, (x, y) => m.bush(x - 30, y - 30), 40);
    m.scatter(14, [200, 200, 3600, 3600], 55, (x, y) => m.tree(x, y, rr(38, 56)), 60);
    m.scatter(10, [200, 200, 3600, 3600], 34, (x, y) => m.prop('prop_hay', x - 40, y - 40, 80, 80), 40);
    brSpawns(m, C, C, 1650, 16, 0.1);
    [[C, 1450], [C, 2550], [1450, C], [2550, C], [1350, 1950], [2650, 2100], [2000, 700], [900, 3250], [3150, 1150], [600, 1300], [3400, 2900], [1700, 600], [2300, 3400], [800, 2100], [3250, 1800], [C - 380, C - 380], [C + 380, C + 380], [1200, 3700], [3600, 300], [400, 3600]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  19-21  ЗАХОПЛЕННЯ ТОЧОК (порядок P: NW, SE, NE, SW)
// =====================================================================================================
function base4(m, S, color, extra) {
    // база 420×420 у кутку: стіни з проходом до центру карти
    [[100, 100, 1, 1], [S - 100, S - 100, -1, -1], [S - 100, 100, -1, 1], [100, S - 100, 1, -1]].forEach(([x, y, sx, sy]) => {
        const x0 = sx > 0 ? x : x - 420, y0 = sy > 0 ? y : y - 420;
        m.wall(sx > 0 ? x : x - 270, sy > 0 ? y + 420 - 50 : y - 420, 270, 50, color, extra); m.wall(sx > 0 ? x + 420 - 50 : x - 420, sy > 0 ? y : y - 270, 50, 270, color, extra);
        m.keepRect(x0, y0, 420, 420);
    });
}
function cpSite(m, x, y, kind) {
    m.mk('spawn_cp', x, y); m.prop('prop_pad', x - 110, y - 110, 220, 220); m.keep(x, y, 140);
    [[-250, -250], [180, -250], [-250, 180], [180, 180]].forEach(([dx, dy]) => m.conc(x + dx, y + dy, 70, 70));
    [[-60, -290], [-60, 250]].forEach(([dx, dy]) => m.sand(x + dx, y + dy, 120, 40)); [[-290, -60], [250, -60]].forEach(([dx, dy]) => m.sand(x + dx, y + dy, 40, 120));
}

def('Crossroads', 3200, 'grass', ['capture_points'], '#5c8a45', m => {
    const S = 3200, C = 1600;
    m.road([[200, 200], [S - 200, S - 200]], 170, '#8a6d45', '#b69a6b'); m.road([[S - 200, 200], [200, S - 200]], 170, '#8a6d45', '#b69a6b');
    m.road([[C, 0], [C, S]], 130, '#8a6d45'); m.road([[0, C], [S, C]], 130, '#8a6d45');
    base4(m, S, COL.stone);
    [[100, 100, 1, 1], [S - 100, S - 100, -1, -1], [S - 100, 100, -1, 1], [100, S - 100, 1, -1]].forEach(([x, y, sx, sy]) => { const x0 = sx > 0 ? x : x - 420, y0 = sy > 0 ? y : y - 420; m.sq(x0 + (sx > 0 ? 40 : 300), y0 + (sy > 0 ? 40 : 300), 80, 80, '#6b7280', { neon: '#38bdf8' }); m.crate(x0 + (sx > 0 ? 160 : 210), y0 + (sy > 0 ? 40 : 330)); m.barrel(x0 + (sx > 0 ? 40 : 340), y0 + (sy > 0 ? 160 : 210)); });
    m.P(300, 300); m.P(S - 300, S - 300); m.P(S - 300, 300); m.P(300, S - 300);
    [[C, C], [C, 650], [C, S - 650], [650, C], [S - 650, C]].forEach(([x, y]) => cpSite(m, x, y));
    m.forest([100, 100, 3000, 3000], 70, 36, 70, 0.1);
    m.scatter(16, [120, 120, 2960, 2960], 40, (x, y) => m.rock(x - 40, y - 35), 50);
    m.scatter(10, [120, 120, 2960, 2960], 34, (x, y) => m.barrel(x - 20, y - 20), 40);
    [[500, 900], [2700, 900], [500, 2300], [2700, 2300], [1100, 500], [2100, 500], [1100, 2700], [2100, 2700]].forEach(([x, y]) => m.U(x, y));
});

def('Factory Zone', 3200, 'metal', ['capture_points'], '#566270', m => {
    const S = 3200, C = 1600;
    m.border(60, COL.metalD);
    m.line([[200, C], [3000, C]], 80, '#374151', '#facc15'); m.line([[C, 200], [C, 3000]], 80, '#374151', '#facc15'); m.keepLine([[200, C], [3000, C]], 100); m.keepLine([[C, 200], [C, 3000]], 100);
    base4(m, S, COL.metalD, { stripe: '#facc15' });
    m.P(300, 300); m.P(S - 300, S - 300); m.P(S - 300, 300); m.P(300, S - 300);
    // контейнерні стеки створюють «коридори»
    [[850, 550], [2000, 550], [850, 2450], [2000, 2450], [550, 850], [550, 2000], [2450, 850], [2450, 2000]].forEach(([x, y], i) => { const v = i >= 4; for (let k = 0; k < 2; k++) m.prop(((i + k) % 2) ? 'prop_cont_blue' : 'prop_cont_red', v ? x : x + k * 170, v ? y + k * 170 : y, v ? 80 : 160, v ? 160 : 80, 0); });
    [[C, C], [C, 650], [C, S - 650], [650, C], [S - 650, C]].forEach(([x, y], i) => { cpSite(m, x, y); if (i === 0) m.prop('prop_crystal', x - 40, y - 40, 80, 80); });
    // цехи (дахи), труби, генератори
    [[1050, 1050, 300, 240, '#4b5a6a'], [1850, 1050, 300, 240, '#4b5a6a'], [1050, 1910, 300, 240, '#4b5a6a'], [1850, 1910, 300, 240, '#4b5a6a']].forEach(([x, y, w, h, c]) => { m.house(x, y, w, h, c, { stripe: '#facc15' }); });
    m.scatter(10, [150, 150, 2900, 2900], 70, (x, y) => m.prop('prop_pipe', x - 75, y - 15, 150, 30, ri(0, 1) * 90), 50);
    m.scatter(8, [150, 150, 2900, 2900], 50, (x, y) => m.prop('prop_generator', x - 40, y - 35, 80, 70), 50);
    m.scatter(14, [150, 150, 2900, 2900], 34, (x, y) => m.barrel(x - 20, y - 20), 50);
    m.scatter(8, [150, 150, 2900, 2900], 32, (x, y) => m.prop('prop_tires', x - 25, y - 25, 50, 50), 50);
    [[500, 900], [2700, 900], [500, 2300], [2700, 2300], [1100, 500], [2100, 500], [1100, 2700], [2100, 2700]].forEach(([x, y]) => m.U(x, y));
});

def('Frozen Lake', 3200, 'snow', ['capture_points'], '#dce8f1', m => {
    const S = 3200, C = 1600;
    // 4 озера по діагоналях навколо льодового хреста; центральна точка — на льоду
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { m.water(sx < 0 ? C - 560 : C + 130, sy < 0 ? C - 560 : C + 130, 430, 430, true); });
    m.prop('prop_pad', C - 130, C - 130, 260, 260); m.keep(C, C, 150);
    base4(m, S, COL.ice, { stripe: '#e0f2fe' });
    m.P(300, 300); m.P(S - 300, S - 300); m.P(S - 300, 300); m.P(300, S - 300);
    m.mk('spawn_cp', C, C); m.keep(C, C, 100);
    [[C, 480], [C, S - 480], [480, C], [S - 480, C]].forEach(([x, y]) => { cpSite(m, x, y); m.prop('prop_tent', x + (x < C ? 190 : -280), y + 170, 90, 80); m.prop('prop_campfire', x - 25, y + 190, 50, 50); });
    m.forest([100, 100, 3000, 3000], 110, 36, 72);
    m.scatter(14, [120, 120, 2960, 2960], 40, (x, y) => m.rock(x - 40, y - 35), 50);
    m.scatter(8, [120, 120, 2960, 2960], 30, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
    [[800, 800], [2400, 800], [800, 2400], [2400, 2400], [C - 700, C], [C + 700, C], [C, C - 700], [C, C + 700]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  22-24  ПОЛЮВАННЯ ЗА ГОЛОВОЮ
// =====================================================================================================
def('Neon City', 3200, 'asphalt', ['bounty'], '#3a3d42', m => {
    const S = 3200, N = 4, street = 190, blk = (S - street * (N + 1)) / N;   // 4×4 квартали
    m.border(50, '#1f2937');
    for (let k = 0; k <= N; k++) { const yc = street / 2 + k * (blk + street); m.keepLine([[0, yc], [S, yc]], 110); m.keepLine([[yc, 0], [yc, S]], 110); }
    const cols = ['#3f3f46', '#52525b', '#44403c', '#3b4a5c', '#5b3a46', '#2f4a45'], neons = ['#f0abfc', '#22d3ee', '#fde047', '#fb7185', '#4ade80'];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = street + i * (blk + street), y = street + j * (blk + street);
        if ((i === 1 || i === 2) && (j === 1 || j === 2)) continue;     // центральна площа
        // кварталі розбиті на будівлі різного розміру з вузькими провулками
        const split = (i + j) % 3;
        if (split === 0) { m.house(x, y, blk * 0.55, blk, pick(cols), { neon: pick(neons) }); m.house(x + blk * 0.55 + 70, y, blk * 0.45 - 70, blk * 0.55, pick(cols), { neon: pick(neons) }); m.house(x + blk * 0.55 + 70, y + blk * 0.55 + 70, blk * 0.45 - 70, blk * 0.45 - 70, pick(cols), { neon: pick(neons) }); }
        else if (split === 1) { m.house(x, y, blk, blk * 0.45, pick(cols), { neon: pick(neons) }); m.house(x, y + blk * 0.45 + 70, blk * 0.5 - 35, blk * 0.55 - 70, pick(cols), { neon: pick(neons) }); m.house(x + blk * 0.5 + 35, y + blk * 0.45 + 70, blk * 0.5 - 35, blk * 0.55 - 70, pick(cols), { neon: pick(neons) }); }
        else { m.house(x, y, blk * 0.45, blk * 0.45, pick(cols), { neon: pick(neons) }); m.house(x + blk * 0.45 + 70, y, blk * 0.55 - 70, blk * 0.45, pick(cols), { neon: pick(neons) }); m.house(x, y + blk * 0.45 + 70, blk, blk * 0.55 - 70, pick(cols), { neon: pick(neons) }); }
    }
    // центральна площа
    const C = 1600; m.water(C - 150, C - 150, 300, 300, true); m.prop('prop_statue', C - 40, C - 40, 80, 80); m.keep(C, C, 200);
    [[C - 330, C - 330], [C + 270, C - 330], [C - 330, C + 270], [C + 270, C + 270]].forEach(([x, y]) => { m.neon('neon_pillar', x, y, 60, 60, '#f0abfc'); });
    [[C - 300, C], [C + 300, C], [C, C - 300], [C, C + 300]].forEach(([x, y]) => m.prop('prop_wood_bench', x - 50, y - 15, 100, 30, x === C ? 90 : 0));
    // вуличний декор: машини, контейнери, бочки, смітники
    m.scatter(14, [100, 100, 3000, 3000], 70, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 1) * 90), 100);
    m.scatter(22, [100, 100, 3000, 3000], 30, (x, y) => m.barrel(x - 20, y - 20), 100);
    m.scatter(12, [100, 100, 3000, 3000], 34, (x, y) => m.prop('prop_cone', x - 15, y - 15, 30, 30), 100);
    m.scatter(10, [100, 100, 3000, 3000], 50, (x, y) => m.conc(x - 50, y - 25, 100, 50), 100);
    m.scatter(8, [100, 100, 3000, 3000], 40, (x, y) => m.tree(x, y, 36), 100);
    [[525, 95], [1275, 95], [1925, 95], [2675, 95], [95, 525], [3105, 525], [95, 1275], [3105, 1925], [95, 2675], [3105, 2675], [525, 3105], [1275, 3105], [1925, 3105], [2675, 3105]].forEach(([x, y]) => m.P(x, y));
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if ((i + j) % 2 === 0) m.U(street + i * (blk + street) + blk / 2, street / 2 + j * (blk + street));
});

def('Old Town', 3200, 'stone', ['bounty'], '#8a7f72', m => {
    const S = 3200, C = 1600;
    m.border(60, '#5d564f');
    // річка по діагоналі з мостами
    const river = [[0, 700], [800, 900], [1500, 1500], [2000, 2200], [2700, 2500], [3200, 2600]], bridges = [[800, 900], [1760, 1850], [2700, 2500]];
    const dirAt = (x, y) => { let best = 1e9, d = [1, 0]; for (let i = 0; i < river.length - 1; i++) { const [x1, y1] = river[i], [x2, y2] = river[i + 1], q = MO.distToSeg(x, y, x1, y1, x2, y2); if (q < best) { best = q; const l = Math.hypot(x2 - x1, y2 - y1); d = [(x2 - x1) / l, (y2 - y1) / l]; } } return d; };
    for (let i = 0; i < river.length - 1; i++) {
        const [x1, y1] = river[i], [x2, y2] = river[i + 1], steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 140);
        for (let s2 = 0; s2 < steps; s2++) { const t0 = s2 / steps, x = x1 + (x2 - x1) * t0 + 35, y = y1 + (y2 - y1) * t0; if (bridges.some(b => Math.hypot(b[0] - x, b[1] - y) < 190)) continue; m.water(x - 105, y - 120, 220, 240, true); }
    }
    bridges.forEach(([x, y]) => { const d = dirAt(x, y), nx = -d[1], ny = d[0]; m.line([[x - nx * 260, y - ny * 260], [x + nx * 260, y + ny * 260]], 150, '#8a6a3a', '#5e4524'); });
    m.keepLine(river, 220);
    // забудова: різнокольорові дахи; кожен будинок ставимо лише якщо навколо лишається прохід
    const roofs = [COL.terra, COL.slate, COL.ochre, COL.brick, '#8f5a3c', '#6b7a8a'];
    const lots = [[300, 200, 300, 260], [750, 200, 340, 240], [1250, 160, 300, 260], [1750, 200, 360, 240], [2300, 160, 300, 260], [2700, 200, 280, 260], [200, 1100, 300, 260], [220, 1550, 260, 300], [200, 2100, 340, 280], [650, 2500, 300, 260], [1100, 2650, 340, 280], [1650, 2750, 300, 240], [2100, 2650, 280, 280], [2500, 2850, 340, 220], [2750, 1700, 280, 280], [1250, 1000, 240, 230], [2050, 750, 260, 250], [2550, 1050, 300, 260], [700, 1700, 280, 240]];
    lots.forEach(([x, y, w, h]) => { if (m.rectFree(x, y, w, h, 90)) m.house(x, y, w, h, pick(roofs)); });
    // церква
    if (m.rectFree(1250, 1700, 360, 220, 90)) { m.house(1250, 1700, 360, 220, '#9b8f84'); m.sq(1580, 1610, 90, 90, '#7d7266'); }
    // ринкова площа
    const MX = 1580, MY = 1250; m.prop('prop_well', MX - 35, MY - 35, 70, 70); m.keep(MX, MY, 280);
    [[-220, -150], [160, -150], [-220, 110], [160, 110]].forEach(([dx, dy]) => m.prop('prop_wood_table', MX + dx, MY + dy, 100, 50)); [[-220, 0], [190, 0]].forEach(([dx, dy]) => m.prop('prop_wood_cart', MX + dx - 20, MY + dy, 120, 70));
    m.scatter(18, [100, 100, 3000, 3000], 32, (x, y) => m.prop('prop_wood_barrel', x - 22, y - 22, 44, 44), 100);
    m.scatter(14, [100, 100, 3000, 3000], 30, (x, y) => m.crate(x - 25, y - 25), 100);
    m.scatter(10, [100, 100, 3000, 3000], 40, (x, y) => m.prop('prop_hay', x - 40, y - 40, 80, 80), 100);
    m.scatter(16, [100, 100, 3000, 3000], 45, (x, y) => m.tree(x, y, rr(36, 56)), 100);
    m.scatter(10, [100, 100, 3000, 3000], 30, (x, y) => m.prop('prop_fence_wood', x - 60, y - 10, 120, 20, ri(0, 1) * 90), 60);
    [[200, 800], [1000, 700], [2000, 500], [3000, 700], [250, 1400], [2600, 1450], [3000, 2200], [250, 2500], [1300, 2400], [2300, 2300], [2800, 3000], [700, 3000], [1700, 2500], [900, 1400], [2300, 1700], [1600, 800], [1000, 2200], [2900, 500]].forEach(([x, y], i) => { if (i < 12) m.P(x, y); });
    [[1000, 1000], [2200, 1300], [1100, 1850], [2500, 2000], [800, 2300], [1900, 1950], [1600, 1000], [2850, 1300], [450, 1850]].forEach(([x, y]) => m.U(x, y));
});

def('Harbor', 3200, 'metal', ['bounty'], '#5a6572', m => {
    const S = 3200;
    m.border(60, COL.metalD);
    // затока на півдні з пірсами
    m.water(60, 2250, 3080, 890, false); m.line([[60, 2250], [3140, 2250]], 60, '#7b8794');
    [[500, 2100], [1300, 2100], [2100, 2100], [2800, 2100]].forEach(([x, y]) => { m.sq(x - 90, y, 180, 600, '#8a7a5c', { stripe: '#6b5d45' }); m.keepRect(x - 90, y, 180, 600); m.prop('prop_wood_planks', x - 40, y + 540, 80, 50); m.barrel(x + 40, y + 300); m.prop('prop_wreck', x + 110, y + 260, 160, 70, 90); });
    // склади (дахи), контейнерні стеки
    [[200, 250, 520, 300, '#4b5a6a'], [900, 250, 460, 300, '#6b5b4b'], [1600, 250, 520, 300, '#4b5a6a'], [2400, 250, 560, 300, '#5b4b4b']].forEach(([x, y, w, h, c]) => m.house(x, y, w, h, c, { stripe: '#facc15' }));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { const x = 250 + c * 420 + (r % 2) * 100, y = 780 + r * 310; if (c % 3 === 2 && r === 1) continue; m.prop((c + r) % 2 ? 'prop_cont_red' : 'prop_cont_blue', x, y, 200, 80, 0); if (c % 2 === 0) m.prop((c + r) % 2 ? 'prop_cont_blue' : 'prop_cont_red', x + 20, y + 100, 160, 70, 0); }
    // портові крани: довгі стіни з жовтою смугою
    m.wall(300, 1950, 700, 40, '#d97706', { stripe: '#1f2937' }); m.wall(2200, 1950, 700, 40, '#d97706', { stripe: '#1f2937' }); m.sq(280, 1930, 60, 80, '#92400e'); m.sq(2850, 1930, 60, 80, '#92400e');
    m.scatter(14, [100, 100, 3000, 2100], 60, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 1) * 90), 100);
    m.scatter(22, [100, 100, 3000, 2100], 30, (x, y) => m.barrel(x - 20, y - 20), 100);
    m.scatter(12, [100, 100, 3000, 2100], 32, (x, y) => m.prop('prop_tires', x - 25, y - 25, 50, 50), 100);
    m.scatter(10, [100, 100, 3000, 2100], 40, (x, y) => m.conc(x - 50, y - 25, 100, 50), 100);
    m.scatter(8, [100, 100, 3000, 2100], 28, (x, y) => m.prop('prop_spotlight', x - 20, y - 20, 40, 40), 100);
    [[120, 160], [850, 640], [1540, 140], [2300, 640], [3000, 160], [140, 1100], [1500, 1700], [3060, 1100], [700, 2000], [1700, 1980], [2600, 1980], [110, 1800], [3070, 1700], [2000, 1400]].forEach(([x, y]) => m.P(x, y));
    [[600, 620], [1500, 650], [2500, 700], [250, 1500], [1100, 1650], [1900, 1500], [2900, 1500], [800, 2300], [1700, 2400]].forEach(([x, y]) => m.U(x, y));
});

// =====================================================================================================
//  запис
// =====================================================================================================
const outFile = path.join(__dirname, '..', 'maps_modes.js');
fs.writeFileSync(outFile, '// Вбудовані мапи під режими (створено tools/genmaps.js). Це звичайні мапи редактора: відкрийте /editor.html, змініть і збережіть.\n// Якщо мапу з такою назвою збережено в редакторі, вона замінює цю.\nmodule.exports = ' + JSON.stringify(maps) + ';\n');
console.log('maps:', Object.keys(maps).length, Object.keys(maps).map(k => k + ' (' + maps[k].solids.length + ')').join(', '));
