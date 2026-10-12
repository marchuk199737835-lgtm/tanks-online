// Спільні інструменти генераторів мап (tools/genmaps2.js). Клас M — той самий, що в genmaps.js, плюс:
//  • bld() — будівля, у яку можна заїхати: підлога, стіни з проходами, двері (не на всіх входах), дах, меблі;
//  • part() — внутрішня перегородка з дверним прорізом; blob() / circlePoly() — фігурні контури мап;
//  • seed(name) — детермінований генератор випадкових чисел для кожної мапи окремо.
'use strict';
const MO = require('../public/js/mapobjects.js');

let _s = 7;
const L = {
    TAU: Math.PI * 2, MO,
    seed(name) { let h = 2166136261; for (let i = 0; i < name.length; i++) { h ^= name.charCodeAt(i); h = Math.imul(h, 16777619); } _s = (h >>> 0) % 2147483646 + 1; },
    rnd() { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; }
};
const rnd = L.rnd, rr = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1)), pick = a => a[Math.floor(rnd() * a.length)], TAU = L.TAU;
Object.assign(L, { rr, ri, pick });

const BG = { grass: '#5c8a45', sand: '#cfae72', snow: '#dce8f1', stone: '#8a8378', asphalt: '#44474c', metal: '#566270', dirt: '#7b5d3e', swamp: '#3b5440', lava: '#2a2220', tech: '#0e1a2b', autumn: '#8f6a3b', space: '#1b2131', mars: '#a4512f' };
const GRID = { grass: '#4b7238', sand: '#b8975c', snow: '#c4d3df', stone: '#756e64', asphalt: '#393b40', metal: '#4a5562', dirt: '#664b31', swamp: '#2f4534', lava: '#1f1816', tech: '#16273d', autumn: '#76572f', space: '#141a28', mars: '#8a4226' };
L.BG = BG;

class M {
    constructor(name, size, theme, modes, bg) {
        L.seed(name);
        this.m = { title: name, size, bg: bg || BG[theme], grid: GRID[theme], theme, modes, solids: [], destrV: 1 }; this.S = this.m.solids; this.size = size;
        this.res = [];
    }
    add(o) { this.S.push(o); return o; }
    wall(x, y, w, h, color, extra) { return this.add(Object.assign({ type: 'wall', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color: color || '#4b5563' }, extra || {})); }
    sq(x, y, w, h, color, extra, rot) { const o = Object.assign({ type: 'wall_square', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color: color || '#4b5563' }, extra || {}); if (rot) o.rot = Math.round(rot); return this.add(o); }
    segw(x1, y1, x2, y2, t, color, extra) {
        const len = Math.hypot(x2 - x1, y2 - y1), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
        return this.add(Object.assign({ type: 'wall', x: Math.round(mx - len / 2), y: Math.round(my - t / 2), w: Math.round(len), h: Math.round(t), color: color || '#4b5563', rot: ((Math.round(ang) % 360) + 360) % 360 || undefined }, extra || {}));
    }
    water(x, y, w, h, curve, rot) { const o = { type: curve ? 'water_curve' : 'water_square', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }; if (rot) o.rot = Math.round(rot); return this.add(o); }
    tree(x, y, r) { return this.add({ type: 'tree', x: Math.round(x), y: Math.round(y), r: Math.round(r || rr(40, 70)) }); }
    prop(t, x, y, w, h, rot) { const o = { type: t, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }; if (rot) o.rot = ((Math.round(rot) % 360) + 360) % 360; return this.add(o); }
    crate(x, y) { return this.prop('prop_crate', x, y, 50, 50); }
    barrel(x, y) { return this.prop('prop_barrel', x, y, 40, 40); }
    gas(x, y) { return this.prop('prop_gas', x, y, 34, 34); }
    sand(x, y, w, h, rot) { return this.prop('prop_sandbag', x, y, w || 100, h || 40, rot); }
    hedge(x, y) { return this.prop('prop_hedgehog', x, y, 60, 60); }
    conc(x, y, w, h, rot) { return this.prop('prop_concrete', x, y, w || 100, h || 50, rot); }
    rock(x, y, w, h) { return this.prop('prop_rock', x, y, w || 80, h || 70); }
    bush(x, y) { return this.prop('prop_bush', x, y, 60, 60); }
    neon(t, x, y, w, h, color) { return this.add({ type: t, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color: color || '#22d3ee' }); }
    line(pts, width, color, stripe) { const o = { type: 'line', points: pts.map(p => ({ x: Math.round(p[0]), y: Math.round(p[1]) })), color, width }; if (stripe) o.stripe = stripe; return this.add(o); }
    floor(x, y, w, h, color, neon, fs) { const o = { type: 'prop_floor', x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), color }; if (neon) o.neon = neon; if (fs) o.fs = fs; return this.add(o); }
    P(x, y) { return this.add({ type: 'spawn_player', x: Math.round(x), y: Math.round(y) }); }
    Z(x, y) { return this.add({ type: 'spawn_zombie', x: Math.round(x), y: Math.round(y) }); }
    U(x, y) { return this.add({ type: 'spawn_powerup', x: Math.round(x), y: Math.round(y) }); }
    mk(type, x, y) { return this.add({ type, x: Math.round(x), y: Math.round(y) }); }
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
    inShape(x, y, r) { return !this.m.shape || MO.circleInPoly(this.m.shape, x, y, r); }
    free(x, y, r) { return this.inShape(x, y, r) && !MO.collides(this.m, x, y, r) && !this.reserved(x, y, r) && !this.inBld(x, y, r); }
    inBld(x, y, r) { return (this.blds || []).some(b => x + r > b.x - 20 && x - r < b.x + b.w + 20 && y + r > b.y - 20 && y - r < b.y + b.h + 20); }
    rectFree(x, y, w, h, pad) {
        if (x - pad < 0 || y - pad < 0 || x + w + pad > this.size || y + h + pad > this.size) return false;
        for (let px = x - pad; px <= x + w + pad + 1; px += 40) for (let py = y - pad; py <= y + h + pad + 1; py += 40) if (MO.collides(this.m, Math.min(px, this.size - 30), Math.min(py, this.size - 30), 24) || this.reserved(px, py, 10) || !this.inShape(px, py, 10)) return false;
        return !(this.blds || []).some(b => x < b.x + b.w + pad && x + w + pad > b.x && y < b.y + b.h + pad && y + h + pad > b.y);
    }
    scatter(n, rect, rad, fn, tries) {
        let placed = 0, t = 0; const lim = (tries || 40) * n;
        while (placed < n && t++ < lim) { const x = rr(rect[0], rect[0] + rect[2]), y = rr(rect[1], rect[1] + rect[3]); if (!this.free(x, y, rad)) continue; fn(x, y); placed++; }
        return placed;
    }
    forest(rect, n, r0, r1, bushP) { return this.scatter(n, rect, r1 + 14, (x, y) => { if (bushP && rnd() < bushP) this.bush(x - 30, y - 30); else this.tree(x, y, rr(r0, r1)); }); }
    ring(x0, y0, x1, y1, t, gaps, color, extra) {
        const g = gaps || {}, seg = (a, b, gp, fn) => { let cur = a; (gp || []).slice().sort((p, q) => p[0] - q[0]).forEach(([f, to]) => { if (f > cur) fn(cur, f); cur = to; }); if (cur < b) fn(cur, b); };
        seg(x0, x1, g.n, (a, b) => this.wall(a, y0, b - a, t, color, extra));
        seg(x0, x1, g.s, (a, b) => this.wall(a, y1 - t, b - a, t, color, extra));
        seg(y0 + t, y1 - t, g.w, (a, b) => this.wall(x0, a, t, b - a, color, extra));
        seg(y0 + t, y1 - t, g.e, (a, b) => this.wall(x1 - t, a, t, b - a, color, extra));
    }
    circle(cx, cy, R, t, color, gaps, n, extra) {
        n = n || 32;
        for (let i = 0; i < n; i++) {
            const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2 * 180 / Math.PI;
            if ((gaps || []).some(([g0, g1]) => { const d = ((am - g0) % 360 + 360) % 360; return d <= ((g1 - g0) % 360 + 360) % 360; })) continue;
            this.segw(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R, t, color, extra);
        }
    }
    border(t, color) { const S = this.size; this.ring(0, 0, S, S, t, {}, color || '#374151'); }
    house(x, y, w, h, color, extra) { return this.sq(x, y, w, h, color, extra); }
    road(pts, w, color, stripe) { this.line(pts, w, color, stripe); this.keepLine(pts, w + 40); }

    // ===== БУДІВЛЯ, у яку можна заїхати =====
    // o: { T (товщина стін), wall, floor, roof, stripe, neon (світіння підлоги), ents: [{ side:'n'|'s'|'e'|'w', at: 0..1, g: ширина проходу, door: тип дверей | null }],
    //      furn: [[тип, w, h, 'wall'|'center'|'corner'], ...], parts: [{ axis:'v'|'h', at: 0..1, gap: 0..1 (де проріз), g: ширина }], roofless: true — без даху (двір/зала без стелі) }
    bld(x, y, w, h, o) {
        o = o || {}; const T = o.T || 26; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
        const b = { x, y, w, h, T, inner: { x0: x + T, y0: y + T, x1: x + w - T, y1: y + h - T }, zones: [], items: [] };
        (this.blds || (this.blds = [])).push(b);
        this.floor(x, y, w, h, o.floor || '#6b7280', o.neon, o.fs);
        const ents = o.ents && o.ents.length ? o.ents : [{ side: 's', at: 0.5, g: 140, door: null }];
        const sd = { n: [], s: [], e: [], w: [] };
        ents.forEach(e => { const len = (e.side === 'n' || e.side === 's') ? w : h, base = (e.side === 'n' || e.side === 's') ? x : y, g = e.g || 140, c = e.c != null ? Math.round(e.c) : Math.round(base + T + g / 2 + 10 + (len - 2 * T - g - 20) * (e.at == null ? 0.5 : e.at)); e._c = c; e._g = g; sd[e.side].push([c - g / 2, c + g / 2]); });      // e.c — точна координата (вирівнювання з сусідньою кімнатою)
        b.ents = ents; const ex = o.stripe ? { stripe: o.stripe } : null;
        const seg = (a, bb, gaps, fn) => { gaps.sort((p, q) => p[0] - q[0]); let cur = a; for (const g of gaps) { if (g[0] > cur + 2) fn(cur, g[0]); cur = Math.max(cur, g[1]); } if (cur < bb - 2) fn(cur, bb); };
        seg(x, x + w, sd.n, (a, bb) => this.wall(a, y, bb - a, T, o.wall, ex)); seg(x, x + w, sd.s, (a, bb) => this.wall(a, y + h - T, bb - a, T, o.wall, ex));
        seg(y + T, y + h - T, sd.w, (a, bb) => this.wall(x, a, T, bb - a, o.wall, ex)); seg(y + T, y + h - T, sd.e, (a, bb) => this.wall(x + w - T, a, T, bb - a, o.wall, ex));
        // двері: лише на частині входів (решта — відкриті), щоб навігація зомбі / ботів завжди мала прохід
        ents.forEach((e, i) => {
            const c = e._c, g = e._g, dt = e.door; if (dt && ents.filter(q => !q.door).length >= 1) {
                if (e.side === 'n' || e.side === 's') this.prop(dt, c - g / 2, (e.side === 'n' ? y : y + h - T) + (T - 25) / 2, g, 25); else this.prop(dt, (e.side === 'w' ? x : x + w - T) + (T - 25) / 2, c - g / 2, 25, g);
            }
            const dz = 130, gz = g + 40;      // вільна від меблів зона біля входу
            if (e.side === 'n') b.zones.push({ x: c - gz / 2, y: y + T, w: gz, h: dz }); else if (e.side === 's') b.zones.push({ x: c - gz / 2, y: y + h - T - dz, w: gz, h: dz });
            else if (e.side === 'w') b.zones.push({ x: x + T, y: c - gz / 2, w: dz, h: gz }); else b.zones.push({ x: x + w - T - dz, y: c - gz / 2, w: dz, h: gz });
            this.keepRect(e.side === 'e' ? x + w - 10 : e.side === 'w' ? x - 150 : c - g / 2 - 10, e.side === 's' ? y + h - 10 : e.side === 'n' ? y - 150 : c - g / 2 - 10, (e.side === 'e' || e.side === 'w') ? 160 : g + 20, (e.side === 'n' || e.side === 's') ? 160 : g + 20);
        });
        (o.parts || []).forEach(p => this.part(b, p, o.wall));
        (o.furn || []).forEach(f => this.furnish(b, f));
        if (!o.roofless) this.add({ type: 'prop_roof', x: x - 10, y: y - 10, w: w + 20, h: h + 20, color: o.roof || '#475569' });
        return b;
    }
    // внутрішня перегородка в будівлі b: axis 'v' — вертикальна на частці at ширини, 'h' — горизонтальна; проріз g на частці gap
    part(b, p, color) {
        const I = b.inner, T = b.T, g = p.g || 140, gp = p.gap == null ? 0.5 : p.gap, W = (x, y, w, h) => { b.items.push({ x, y, w, h }); return this.wall(x, y, w, h, color); };
        // перегородка не має впиратися в прохід у перпендикулярній стіні: зсуваємо її вбік від таких входів
        const dodge = (pos, sides) => { for (let it = 0; it < 4; it++) { const e = (b.ents || []).find(q => sides.includes(q.side) && pos + T > q._c - q._g / 2 - 60 && pos < q._c + q._g / 2 + 60); if (!e) break; const a = e._c + e._g / 2 + 70, c2 = e._c - e._g / 2 - 70 - T, lo = sides[0] === 'n' ? I.x0 + 80 : I.y0 + 80, hi = sides[0] === 'n' ? I.x1 - 80 - T : I.y1 - 80 - T; pos = (a <= hi && (Math.abs(a - pos) <= Math.abs(c2 - pos) || c2 < lo)) ? a : c2; } return Math.round(pos); };
        if (p.axis === 'v') {
            const px = dodge(Math.round(I.x0 + (I.x1 - I.x0) * p.at - T / 2), ['n', 's']), y0 = p.y0 != null ? p.y0 : I.y0, y1 = p.y1 != null ? p.y1 : I.y1, gc = Math.round(y0 + g / 2 + 20 + (y1 - y0 - g - 40) * gp);
            if (gc - g / 2 - y0 > 4) W(px, y0, T, gc - g / 2 - y0); if (y1 - (gc + g / 2) > 4) W(px, gc + g / 2, T, y1 - (gc + g / 2));
            b.zones.push({ x: px - 110, y: gc - g / 2 - 20, w: T + 220, h: g + 40 });
            if (p.door) this.prop(p.door, px + (T - 25) / 2, gc - g / 2, 25, g);
        } else {
            const py = dodge(Math.round(I.y0 + (I.y1 - I.y0) * p.at - T / 2), ['w', 'e']), x0 = p.x0 != null ? p.x0 : I.x0, x1 = p.x1 != null ? p.x1 : I.x1, gc = Math.round(x0 + g / 2 + 20 + (x1 - x0 - g - 40) * gp);
            if (gc - g / 2 - x0 > 4) W(x0, py, gc - g / 2 - x0, T); if (x1 - (gc + g / 2) > 4) W(gc + g / 2, py, x1 - (gc + g / 2), T);
            b.zones.push({ x: gc - g / 2 - 20, y: py - 110, w: g + 40, h: T + 220 });
            if (p.door) this.prop(p.door, gc - g / 2, py + (T - 25) / 2, g, 25);
        }
    }
    // ряди однакових меблів (стелажі, серверні стійки, столи) з кроком sx×sy; оминає входи, перегородки й уже поставлене
    fillGrid(b, t, w, h, sx, sy, pad, gapPad) {
        const I = b.inner, p = pad == null ? 80 : pad, gp = gapPad == null ? 30 : gapPad, ov = (a, c, q) => a.x < c.x + c.w + q && a.x + a.w + q > c.x && a.y < c.y + c.h + q && a.y + a.h + q > c.y; let n = 0;
        for (let y = I.y0 + p; y + h <= I.y1 - p; y += sy) for (let x = I.x0 + p; x + w <= I.x1 - p; x += sx) {
            const r = { x: Math.round(x), y: Math.round(y), w, h };
            if (b.zones.some(z => ov(r, z, 0)) || b.items.some(q => ov(r, q, gp))) continue;
            b.items.push(r); this.prop(t, r.x, r.y, w, h); n++;
        }
        return n;
    }
    furnish(b, f) {
        const [t, w, h, kind] = f, I = b.inner, cands = [];
        if (kind === 'corner') cands.push([I.x0, I.y0, w, h], [I.x1 - w, I.y0, w, h], [I.x0, I.y1 - h, w, h], [I.x1 - w, I.y1 - h, w, h]);
        else if (kind === 'center') for (let k = 0; k < 12; k++) cands.push([I.x0 + 60 + rnd() * (I.x1 - I.x0 - 120 - w), I.y0 + 60 + rnd() * (I.y1 - I.y0 - 120 - h), w, h]);
        else { for (let p = I.x0 + 6; p + w <= I.x1 - 6; p += 20) { cands.push([p, I.y0, w, h]); cands.push([p, I.y1 - h, w, h]); } for (let p = I.y0 + 6; p + w <= I.y1 - 6; p += 20) { cands.push([I.x0, p, h, w]); cands.push([I.x1 - h, p, h, w]); } }
        for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
        const ov = (a, c, pad) => a.x < c.x + c.w + pad && a.x + a.w + pad > c.x && a.y < c.y + c.h + pad && a.y + a.h + pad > c.y;
        for (const c of cands) {
            const r = { x: Math.round(c[0]), y: Math.round(c[1]), w: c[2], h: c[3] };
            if (r.x < I.x0 - 0.5 || r.y < I.y0 - 0.5 || r.x + r.w > I.x1 + 0.5 || r.y + r.h > I.y1 + 0.5) continue;
            if (b.zones.some(z => ov(r, z, 0)) || b.items.some(q => ov(r, q, 8))) continue;
            b.items.push(r); this.prop(t, r.x, r.y, r.w, r.h); return true;
        }
        return false;
    }

    // фінал: маркери зсуваємо з перешкод; недосяжні бонуси / зомбі прибираємо; декор, що відрізає важливі точки, «прориваємо»
    out() {
        const Nav = require('../navgrid.js'), san0 = () => MO.sanitizeMap(JSON.parse(JSON.stringify(this.m)));
        const okAt = (x, y, r) => !MO.collides(this.m, x, y, r, { doorOpen: () => true }) && (!this.m.shape || MO.circleInPoly(this.m.shape, x, y, r));
        this.S.forEach(o => {
            if (!/spawn/.test(o.type) || okAt(o.x, o.y, 32)) return;
            for (let rad = 20; rad <= 450; rad += 20) for (let k = 0; k < 20; k++) { const a = k / 20 * TAU, x = Math.round(o.x + Math.cos(a) * rad), y = Math.round(o.y + Math.sin(a) * rad); if (okAt(x, y, 36)) { o.x = x; o.y = y; return; } }
        });
        const isDeco = o => /^prop_(?!door|floor|roof)/.test(o.type) || o.type === 'tree';
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
        this.S = this.m.solids; delete this.blds; return this.m;
    }
}
L.M = M;

// ---------- контури ----------
L.circlePoly = (cx, cy, R, n) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * TAU; p.push({ x: Math.round(cx + Math.cos(a) * R), y: Math.round(cy + Math.sin(a) * R) }); } return p; };
// «органічна» пляма: коло з плавними хвилями радіуса (острів, печера, кратер)
L.blob = (cx, cy, R, n, amp, waves) => { const p = [], ph = rnd() * TAU, ph2 = rnd() * TAU; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + amp * Math.sin(a * (waves || 3) + ph) + amp * 0.5 * Math.sin(a * ((waves || 3) * 2 + 1) + ph2); p.push({ x: Math.round(cx + Math.cos(a) * R * k), y: Math.round(cy + Math.sin(a) * R * k) }); } return p; };
// ---------- конвой: сплайн-коридор ----------
L.spline = function (pts, step) {
    const out = []; const P = [pts[0], ...pts, pts[pts.length - 1]];
    for (let i = 1; i < P.length - 2; i++) {
        const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], seg = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.round(seg / step));
        for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), p1[2] + (p2[2] - p1[2]) * t]); }
    }
    const l = pts[pts.length - 1]; out.push([l[0], l[1], l[2]]); return out;
};
L.corridor = function (route) {
    const Lf = [], R = [];
    for (let i = 0; i < route.length; i++) {
        const a = route[Math.max(0, i - 1)], b = route[Math.min(route.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, w = route[i][2];
        Lf.push({ x: Math.round(route[i][0] + nx * w), y: Math.round(route[i][1] + ny * w) }); R.push({ x: Math.round(route[i][0] - nx * w), y: Math.round(route[i][1] - ny * w) });
    }
    const cap = (p, q, w) => { const a = Math.atan2(q[1] - p[1], q[0] - p[0]), pts = []; for (let k = 1; k < 8; k++) { const t = a + Math.PI / 2 - (k / 8) * Math.PI; pts.push({ x: Math.round(p[0] + Math.cos(t) * w), y: Math.round(p[1] + Math.sin(t) * w) }); } return pts; };
    const e = route[route.length - 1], e0 = route[route.length - 2], s = route[0], s1 = route[1];
    return [].concat(Lf, cap(e, [e[0] + (e[0] - e0[0]), e[1] + (e[1] - e0[1])], e[2]), R.reverse(), cap(s, [s[0] + (s[0] - s1[0]), s[1] + (s[1] - s1[1])], s[2]));
};
L.edgeProps = function (m, route, fn, every, offK) {
    for (let i = 3; i < route.length - 3; i += every) {
        const r = route[i], a = route[i - 1], b = route[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
        [-1, 1].forEach(sd => { const d = r[2] * (offK || 0.86), x = r[0] + nx * d * sd, y = r[1] + ny * d * sd; if (m.inShape(x, y, 14)) fn(x, y, Math.atan2(ty, tx) * 180 / Math.PI, sd, i); });
    }
};
// точка захоплення з укриттями
L.cpSite = function (m, x, y) {
    m.mk('spawn_cp', x, y); m.prop('prop_pad', x - 110, y - 110, 220, 220); m.keep(x, y, 140);
    [[-250, -250], [180, -250], [-250, 180], [180, 180]].forEach(([dx, dy]) => { if (m.free(x + dx + 35, y + dy + 35, 40)) m.conc(x + dx, y + dy, 70, 70); });
};
module.exports = L;
