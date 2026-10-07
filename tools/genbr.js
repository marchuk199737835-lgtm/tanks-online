// Генератор величезної мапи «Grand Expanse» для королівської битви (7600×7600, 3 біоми, ~80 будівель, що заходяться).
// Підключається з tools/genmaps.js (module.exports = build) і може запускатись окремо: node tools/genbr.js [out.json]
// Власний детермінований ГПВЧ — не чіпає генерацію інших мап.
'use strict';
const MO = require('../public/js/mapobjects.js');
const Nav = require('../navgrid.js');

function build() {
    // ---------- ГПВЧ ----------
    let sd = 0x5eed1234;
    const rnd = () => { sd |= 0; sd = sd + 0x6D2B79F5 | 0; let t = Math.imul(sd ^ sd >>> 15, 1 | sd); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const rr = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(rr(a, b + 1)), pick = a => a[Math.floor(rnd() * a.length)];
    const TAU = Math.PI * 2, R_ = Math.round, S = 7600, C = 3800, NAME = 'Grand Expanse';
    const r10 = v => Math.round(v / 10) * 10;

    const SOL = [];
    const MM = { title: NAME, size: S, bg: '#5c8a45', grid: '#4b7238', theme: 'grass', modes: ['battle_royale'], solids: SOL };
    let Z = 6;   // шар малювання (сортування наприкінці): 0 поля, 1 пляжі, 2 вода, 3 бруківка, 4 дороги, 5 підлоги, 6 решта
    const add = (o, z) => { Object.defineProperty(o, '_z', { value: z === undefined ? Z : z, writable: true, enumerable: false }); SOL.push(o); return o; };
    const wall = (x, y, w, h, color, extra) => add(Object.assign({ type: 'wall', x: R_(x), y: R_(y), w: R_(w), h: R_(h), color }, extra || {}));
    const prop = (t, x, y, w, h, rot) => { const o = { type: t, x: R_(x), y: R_(y), w, h }; if (rot) o.rot = ((R_(rot) % 360) + 360) % 360; return add(o); };
    const tree = (x, y, r) => add({ type: 'tree', x: R_(x), y: R_(y), r: R_(r) });
    const line = (pts, width, color, stripe, z) => { const o = { type: 'line', points: pts.map(p => ({ x: R_(p[0]), y: R_(p[1]) })), color, width }; if (stripe) o.stripe = stripe; return add(o, z); };
    const water = (x, y, w, h, rot) => { const o = { type: 'water_curve', x: R_(x), y: R_(y), w: R_(w), h: R_(h) }; if (rot) o.rot = ((R_(rot) % 360) + 360) % 360; return add(o, 2); };
    const marker = (t, x, y) => add({ type: t, x: R_(x), y: R_(y) }, 9);
    const floor = (x, y, w, h, color, neon) => { const o = { type: 'prop_floor', x: R_(x), y: R_(y), w: R_(w), h: R_(h), color }; if (neon) o.neon = neon; return add(o, 5); };

    // ---------- зарезервовані ділянки (растр 50 px) ----------
    const RC = 50, RN = Math.ceil(S / RC) + 1, RES = new Uint8Array(RN * RN);
    function resDisk(x, y, r) {
        const a0 = Math.max(0, Math.floor((x - r) / RC)), a1 = Math.min(RN - 1, Math.floor((x + r) / RC)), b0 = Math.max(0, Math.floor((y - r) / RC)), b1 = Math.min(RN - 1, Math.floor((y + r) / RC));
        for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) if (Math.hypot((a + 0.5) * RC - x, (b + 0.5) * RC - y) <= r + 18) RES[b * RN + a] = 1;
    }
    function resLine(pts, r) { for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), n = Math.max(1, Math.ceil(d / 25)); for (let k = 0; k <= n; k++) resDisk(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k / n, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k / n, r); } }
    function resHit(x, y, r) {
        const a0 = Math.max(0, Math.floor((x - r) / RC)), a1 = Math.min(RN - 1, Math.floor((x + r) / RC)), b0 = Math.max(0, Math.floor((y - r) / RC)), b1 = Math.min(RN - 1, Math.floor((y + r) / RC));
        for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) if (RES[b * RN + a] && Math.hypot((a + 0.5) * RC - x, (b + 0.5) * RC - y) <= r + 25) return true;
        return false;
    }
    const coll = (x, y, r, o) => MO.collides(MM, x, y, r, o);
    const free = (x, y, r, rres) => !coll(x, y, r) && !resHit(x, y, rres === undefined ? Math.min(r, 60) : rres);
    const nearBld = (x, y, m) => { for (const b of blds) if (x > b.x - m && x < b.x + b.w + m && y > b.y - m && y < b.y + b.h + m) return true; return false; };
    const inMap = (x, y, m) => x > m && y > m && x < S - m && y < S - m;

    // ---------- БІОМИ ----------
    const onB = p => p[0] <= 0 || p[0] >= S || p[1] <= 0 || p[1] >= S;
    function organic(ctrl, n, amp) {
        let tot = 0; for (let i = 0; i < ctrl.length; i++) { const a = ctrl[i], b = ctrl[(i + 1) % ctrl.length]; tot += Math.hypot(b[0] - a[0], b[1] - a[1]); }
        const step = tot / n, out = [];
        for (let i = 0; i < ctrl.length; i++) {
            const a = ctrl[i], b = ctrl[(i + 1) % ctrl.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(len / step));
            const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len, border = (a[0] <= 0 && b[0] <= 0) || (a[0] >= S && b[0] >= S) || (a[1] <= 0 && b[1] <= 0) || (a[1] >= S && b[1] >= S);
            out.push([a[0], a[1]]);
            let ph1 = rnd() * 6, ph2 = rnd() * 6;
            for (let j = 1; j < k; j++) {
                const t = j / k, q = border ? 0 : Math.min(amp, len * 0.16) * (0.55 * Math.sin(ph1 + t * 7) + 0.45 * Math.sin(ph2 + t * 13) + (rnd() - 0.5) * 0.5);
                out.push([Math.max(0, Math.min(S, a[0] + (b[0] - a[0]) * t + nx * q)), Math.max(0, Math.min(S, a[1] + (b[1] - a[1]) * t + ny * q))]);
            }
        }
        return out;
    }
    function selfX(P) {
        const n = P.length, X = (a, b, c, d) => { const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]); return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0; };
        for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; if (X(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n])) return true; }
        return false;
    }
    function biome(theme, bg, ctrl, n, amp) {
        for (let t = 0; t < 40; t++) { const P = organic(ctrl, n, amp); if (!selfX(P)) return { theme, bg, points: P.map(p => ({ x: R_(p[0]), y: R_(p[1]) })) }; }
        throw new Error('biome self-intersects');
    }
    MM.biomes = [
        biome('grass', '#5c8a45', [[0, 2300], [1800, 2500], [3400, 1900], [5000, 1300], [7600, 1500], [7600, 7600], [0, 7600]], 34, 260),
        biome('snow', '#dce8f1', [[0, 0], [4700, 0], [4900, 800], [4500, 1500], [4200, 2000], [3500, 2350], [2500, 2750], [1500, 3050], [600, 2950], [0, 3300]], 44, 330),
        biome('autumn', '#8f6a3b', [[7600, 0], [5800, 0], [5500, 900], [5300, 1900], [5600, 2800], [5400, 3800], [5700, 4700], [5400, 5600], [5700, 6500], [5500, 7200], [5800, 7600], [7600, 7600]], 48, 300)
    ];
    const themeAt = (x, y) => { const b = MO.biomeAt(MM, x, y); return b ? b.theme : 'grass'; };

    // ---------- СТИЛІ ----------
    const ST = {
        snow: { wall: ['#6d5240', '#5f4636', '#7a6a5c', '#7d8794'], roof: ['#7f8da0', '#8794a6', '#6f7f93', '#93a0b2'], stripe: '#f4f9ff', floor: ['#8d6b47', '#9a7650', '#7f603f'], road: '#b4c2d0', roadS: '#eef4fa', tree: [44, 66], fence: 'prop_fence_wood' },
        grass: { wall: ['#9b5a45', '#8d8579', '#a79a82', '#8a5a3b'], roof: ['#b5593c', '#a64a32', '#c06a3e', '#9c4a36'], stripe: null, floor: ['#a8763e', '#9a6a38', '#b5834a'], road: '#9b9079', roadS: '#d6cdb5', tree: [48, 72], fence: 'prop_fence_wood' },
        autumn: { wall: ['#8a5a2b', '#7a4e28', '#6e4b2f', '#7d5a38'], roof: ['#7a4a2a', '#8b4a2b', '#6d4a30', '#9a4d2f'], stripe: null, floor: ['#9a6a38', '#8a5e32', '#a8763e'], road: '#8a6f4a', roadS: '#c9a56a', tree: [48, 70], fence: 'prop_fence_wood' }
    };

    // ---------- БУДІВЛІ ----------
    const blds = [];
    const ARCH = {
        small: { w: [200, 240], h: [170, 200], loot: [1, 1] },
        house: { w: [280, 330], h: [220, 260], loot: [1, 2] },
        barn: { w: [400, 450], h: [280, 320], loot: [2, 3] },
        villa: { w: [340, 390], h: [300, 340], loot: [2, 3] },
        tower: { w: [170, 190], h: [170, 190], loot: [1, 1] }
    };
    const rectsOverlap = (a, b, pad) => !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
    function bldRectFree(r, pad) {
        if (!inMap(r.x, r.y, 260) || !inMap(r.x + r.w, r.y + r.h, 260)) return false;
        for (const b of blds) if (rectsOverlap(r, b, pad)) return false;
        for (let px = r.x - pad / 2; px <= r.x + r.w + pad / 2 + 1; px += 40) for (let py = r.y - pad / 2; py <= r.y + r.h + pad / 2 + 1; py += 40) if (coll(px, py, 20) || resHit(px, py, 10)) return false;
        return true;
    }
    // стіни з прорізами. op: {side,c,g,door:null|'s'|'d'}
    function ringWalls(x, y, w, h, T, col, ops) {
        const sd = { n: [], s: [], e: [], w: [] }; ops.forEach(o => sd[o.side].push([o.c - o.g / 2, o.c + o.g / 2]));
        const seg = (a, b, gaps, fn) => { gaps.sort((p, q) => p[0] - q[0]); let cur = a; for (const g of gaps) { if (g[0] > cur + 2) fn(cur, g[0]); cur = Math.max(cur, g[1]); } if (cur < b - 2) fn(cur, b); };
        seg(x, x + w, sd.n, (a, b) => wall(a, y, b - a, T, col)); seg(x, x + w, sd.s, (a, b) => wall(a, y + h - T, b - a, T, col));
        seg(y + T, y + h - T, sd.w, (a, b) => wall(x, a, T, b - a, col)); seg(y + T, y + h - T, sd.e, (a, b) => wall(x + w - T, a, T, b - a, col));
        { let used = false; ops.forEach(o => { if (!o.door) return; if (o.win || ops.filter(q => !q.win).length < 2 || used) o.door = null; else used = true; }); }   // двері лише на одному з ≥ 2 входів (Nav з закритими дверима має проходи)
        ops.forEach(o => {
            if (!o.door) return; const t = o.g >= 140 ? 'prop_door_wood_d' : 'prop_door_wood_s';
            if (o.side === 'n' || o.side === 's') prop(t, o.c - o.g / 2, (o.side === 'n' ? y : y + h - T) + (T - 25) / 2, o.g, 25);
            else prop(t, (o.side === 'w' ? x : x + w - T) + (T - 25) / 2, o.c - o.g / 2, 25, o.g);
        });
    }
    const itemRect = o => ({ x: o.x, y: o.y, w: o.w, h: o.h });
    // меблі: kind 'wall' (притиснуті до стіни), 'corner', 'center'
    function furnish(b, list) {
        const I = b.inner;
        for (const it of list) {
            const cands = [];
            const w = it.w, h = it.h;
            if (it.kind === 'wall' || !it.kind) {
                for (let p = I.x0 + 6; p + w <= I.x1 - 6; p += 14) { cands.push([p, I.y0, w, h]); cands.push([p, I.y1 - h, w, h]); }
                for (let p = I.y0 + 6; p + w <= I.y1 - 6; p += 14) { cands.push([I.x0, p, h, w]); cands.push([I.x1 - h, p, h, w]); }
            } else if (it.kind === 'corner') {
                cands.push([I.x0, I.y0, w, h], [I.x1 - w, I.y0, w, h], [I.x0, I.y1 - h, w, h], [I.x1 - w, I.y1 - h, w, h]);
            } else {
                for (let k = 0; k < 8; k++) cands.push([r10((I.x0 + I.x1) / 2 - w / 2 + rr(-40, 40)), r10((I.y0 + I.y1) / 2 - h / 2 + rr(-30, 30)), w, h]);
            }
            for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
            for (const c of cands) {
                const r = { x: c[0], y: c[1], w: c[2], h: c[3] };
                if (r.x < I.x0 - 0.5 || r.y < I.y0 - 0.5 || r.x + r.w > I.x1 + 0.5 || r.y + r.h > I.y1 + 0.5) continue;
                if (b.zones.some(z => rectsOverlap(r, z, 0))) continue;
                if (b.items.some(o => rectsOverlap(r, itemRect(o), 6))) continue;
                if (b.part && rectsOverlap(r, b.part, 40)) continue;
                const o = prop(it.t, r.x, r.y, r.w, r.h); b.items.push(o); break;
            }
        }
    }
    // перевірка досяжності всередині будівлі: заливка від порога (клітинка 10, танк r=25, двері відчинено)
    function reachInside(b, sx, sy, targets) {
        const x0 = b.x - 90, y0 = b.y - 90, W = Math.ceil((b.w + 180) / 10), H = Math.ceil((b.h + 180) / 10), seen = new Uint8Array(W * H), q = [], op = { doorOpen: () => true };
        const wk = (i, j) => !coll(x0 + i * 10 + 5, y0 + j * 10 + 5, 25, op);
        const si = Math.floor((sx - x0) / 10), sj = Math.floor((sy - y0) / 10);
        if (!wk(si, sj)) return false;
        seen[sj * W + si] = 1; q.push(si, sj);
        for (let h = 0; h < q.length; h += 2) {
            const i = q[h], j = q[h + 1];
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + dx, c = j + dy; if (a < 0 || c < 0 || a >= W || c >= H || seen[c * W + a] || !wk(a, c)) continue; seen[c * W + a] = 1; q.push(a, c); }
        }
        return targets.every(t => seen[Math.floor((t[1] - y0) / 10) * W + Math.floor((t[0] - x0) / 10)]);
    }
    function lootSpots(b, n, step) {
        const I = b.inner, out = [], cand = [], op = { doorOpen: () => false };
        for (let py = I.y0 + 36; py <= I.y1 - 36; py += 10) for (let px = I.x0 + 36; px <= I.x1 - 36; px += 10) if (!coll(px, py, 41, op)) cand.push([px, py]);
        // найдальші від входу — першими, з рознесенням ≥ 90
        const e = b.entry; cand.sort((p, q) => (Math.hypot(q[0] - e[0], q[1] - e[1]) - Math.hypot(p[0] - e[0], p[1] - e[1])) + (rnd() - 0.5) * 30);
        for (const c of cand) { if (out.length >= n) break; if (out.every(o => Math.hypot(o[0] - c[0], o[1] - c[1]) >= 90)) out.push(c); }
        return out;
    }

    // Будівля. side — сторона входу ('n','s','e','w'); style — 'snow'|'grass'|'autumn'; opt: {door, bunker, loot}
    function building(arch, cx, cy, side, style, opt) {
        opt = opt || {}; const A = ARCH[arch], st = ST[style];
        let w = r10(rr(A.w[0], A.w[1])), h = r10(rr(A.h[0], A.h[1]));
        if (arch === 'villa' ? (side === 'e' || side === 'w') : (arch !== 'tower' && (side === 'e' || side === 'w') !== (w < h) && rnd() < 0.7)) { const t = w; w = h; h = t; }   // довша вісь — вздовж вулиці (вілла: глибина ≥ 300)
        const x = r10(cx - w / 2), y = r10(cy - h / 2), T = opt.bunker ? 30 : pick([24, 26, 28]);
        const rect = { x, y, w, h };
        if (!bldRectFree(rect, opt.pad === undefined ? 130 : opt.pad)) return null;
        const bunker = !!opt.bunker, wc = bunker ? pick(['#7b7f86', '#6f747c']) : pick(st.wall);
        const horizEntry = side === 'n' || side === 's', len = horizEntry ? w : h, g1 = arch === 'barn' ? 160 : pick([110, 120, 130]);
        const eoff = horizEntry ? (rnd() - 0.5) * (len - g1 - 2 * T - 80) * 0.6 : (rnd() - 0.5) * (len - g1 - 2 * T - 80) * 0.6;
        const mid = horizEntry ? x + w / 2 : y + h / 2;
        const ops = [{ side, c: r10(mid + eoff), g: g1, door: opt.door === undefined ? rnd() < 0.5 : opt.door }];
        const opp = { n: 's', s: 'n', e: 'w', w: 'e' }[side];
        if (arch === 'barn' || (arch === 'villa' && rnd() < 0.6) || (arch === 'house' && rnd() < 0.3)) ops.push({ side: opp, c: r10(mid + (rnd() - 0.5) * len * 0.3), g: 110, door: rnd() < 0.4 });
        // вікна-бійниці (42 px — танк не пролізе)
        const wins = arch === 'tower' ? 2 : arch === 'small' ? ri(0, 1) : arch === 'barn' ? ri(1, 2) : ri(1, 3);
        const sides = ['n', 's', 'e', 'w'].filter(s => s !== side);
        for (let k = 0; k < wins; k++) {
            const s2 = pick(sides), L2 = (s2 === 'n' || s2 === 's') ? w : h, lo = (s2 === 'n' || s2 === 's' ? x : y) + T + 60, hi = (s2 === 'n' || s2 === 's' ? x : y) + L2 - T - 60, c = r10(rr(lo, hi));
            if (ops.some(o => o.side === s2 && Math.abs(o.c - c) < o.g / 2 + 70)) continue; ops.push({ side: s2, c, g: 42, door: null, win: true });
        }
        const b = { x, y, w, h, T, inner: { x0: x + T, y0: y + T, x1: x + w - T, y1: y + h - T }, ops, items: [], zones: [], style, arch, side };
        // вхід
        const eo = ops[0]; b.entry = horizEntry ? [eo.c, side === 's' ? y + h - T - 30 : y + T + 30] : [side === 'e' ? x + w - T - 30 : x + T + 30, eo.c];
        const outDir = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] }[side];
        b.step = [b.entry[0] + outDir[0] * (T + 70), b.entry[1] + outDir[1] * (T + 70)];
        // зони, вільні від меблів (проходи)
        ops.forEach(o => { if (o.win) return; const gz = o.g + 30, dz = 120; const sg = (o === eo ? side : opp); const d = { n: [0, 1], s: [0, -1], e: [-1, 0], w: [1, 0] }[sg];
            if (sg === 'n' || sg === 's') { const yy = sg === 'n' ? y + T : y + h - T - dz; b.zones.push({ x: o.c - gz / 2, y: yy, w: gz, h: dz }); } else { const xx = sg === 'w' ? x + T : x + w - T - dz; b.zones.push({ x: xx, y: o.c - gz / 2, w: dz, h: gz }); } });
        // підлога, стіни, перегородка
        const fl = bunker || arch === 'tower' && rnd() < 0.5 ? [pick(['#6b7280', '#5f6672']), '#7b8594'] : (arch === 'villa' && rnd() < 0.6 ? ['#cbbfa8', '#a99a80'] : [pick(st.floor), null]);
        floor(x, y, w, h, fl[0], fl[1]);
        if (arch === 'villa') {
            const vert = side === 'e' || side === 'w'; b.part = vert ? { x: r10(x + w / 2 - T / 2), y: y + T, w: T, h: h - 2 * T } : { x: x + T, y: r10(y + h / 2 - T / 2), w: w - 2 * T, h: T };   // перегородка паралельна стіні входу
        }
        ringWalls(x, y, w, h, T, wc, ops);
        if (b.part) {
            const vert = side === 'e' || side === 'w', pg = 120, lenP = vert ? h - 2 * T : w - 2 * T, pc = r10((vert ? y + T : x + T) + lenP / 2 + (rnd() - 0.5) * lenP * 0.3);
            const col = wc, p = b.part;
            if (vert) { wall(p.x, p.y, p.w, pc - pg / 2 - p.y, col); wall(p.x, pc + pg / 2, p.w, p.y + p.h - (pc + pg / 2), col); b.zones.push({ x: p.x - 100, y: pc - pg / 2 - 20, w: p.w + 200, h: pg + 40 }); }
            else { wall(p.x, p.y, pc - pg / 2 - p.x, p.h, col); wall(pc + pg / 2, p.y, p.x + p.w - (pc + pg / 2), p.h, col); b.zones.push({ x: pc - pg / 2 - 20, y: p.y - 100, w: pg + 40, h: p.h + 200 }); }
        }
        // меблі за архетипом
        const F = {
            small: [{ t: 'prop_wood_bench', w: 100, h: 30 }, { t: 'prop_crate', w: 50, h: 50, kind: 'corner' }],
            house: [{ t: 'prop_wood_table', w: 100, h: 50 }, { t: 'prop_wood_bench', w: 100, h: 30 }, { t: 'prop_wood_wall', w: 90, h: 30 }, { t: 'prop_barrel', w: 40, h: 40, kind: 'corner' }],
            barn: [{ t: 'prop_crate', w: 50, h: 50, kind: 'corner' }, { t: 'prop_crate', w: 50, h: 50, kind: 'corner' }, { t: 'prop_hay', w: 80, h: 80, kind: 'corner' }, { t: 'prop_wood_planks', w: 90, h: 50 }, { t: 'prop_barrel', w: 40, h: 40 }, { t: 'prop_wood_cart', w: 110, h: 70, kind: 'wall' }, { t: 'prop_wood_pallet', w: 80, h: 60 }],
            villa: [{ t: 'prop_wood_table', w: 100, h: 50 }, { t: 'prop_wood_bench', w: 100, h: 30 }, { t: 'prop_wood_wall', w: 100, h: 30 }, { t: 'prop_crate', w: 50, h: 50 }, { t: 'prop_wood_bench', w: 100, h: 30 }, { t: 'prop_barrel', w: 40, h: 40, kind: 'corner' }],
            tower: [{ t: 'prop_crate', w: 50, h: 50, kind: 'corner' }, { t: 'prop_barrel', w: 40, h: 40, kind: 'corner' }]
        }[arch];
        furnish(b, F);
        // лут і перевірка проходу; за потреби прибираємо меблі
        const want = opt.loot || ri(A.loot[0], A.loot[1]);
        let spots = lootSpots(b, want);
        for (let guard = 0; guard < 8; guard++) {
            const ok = spots.length >= Math.min(want, 1) && reachInside(b, b.step[0], b.step[1], spots.concat([b.entry]));
            if (ok && spots.length >= Math.min(want, arch === 'tower' || arch === 'small' ? 1 : 2)) break;
            const it = b.items.pop(); if (!it) break; SOL.splice(SOL.indexOf(it), 1); spots = lootSpots(b, want);
        }
        b.loot = spots;
        // дах із виступом 10 px
        const rf = { type: 'prop_roof', x: x - 10, y: y - 10, w: w + 20, h: h + 20, color: pick(st.roof) }; if (style === 'snow') rf.stripe = st.stripe;
        add(rf, 7);
        blds.push(b);
        return b;
    }
    // сходи біля входу (3 сходинки з підлоги різних відтінків)
    function stairs(b) {
        const eo = b.ops[0], sd = b.side, col = MO && ['#8c8c92', '#a0a0a8', '#b4b4bc'];
        for (let k = 0; k < 3; k++) {
            if (sd === 's') floor(eo.c - eo.g / 2 - 6, b.y + b.h + k * 14, eo.g + 12, 14, col[k]);
            else if (sd === 'n') floor(eo.c - eo.g / 2 - 6, b.y - (k + 1) * 14, eo.g + 12, 14, col[k]);
            else if (sd === 'e') floor(b.x + b.w + k * 14, eo.c - eo.g / 2 - 6, 14, eo.g + 12, col[k]);
            else floor(b.x - (k + 1) * 14, eo.c - eo.g / 2 - 6, 14, eo.g + 12, col[k]);
        }
    }

    // ---------- допоміжні декори ----------
    // предмет у вільному місці поблизу точки (радіус 30..R)
    function nearFree(cx, cy, r, R, fn, tries) {
        for (let k = 0; k < (tries || 60); k++) {
            const a = rnd() * TAU, d = rr(30, R), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
            if (inMap(x, y, 160) && free(x, y, r)) { fn(x, y); return true; }
        }
        return false;
    }

    // ---------- ВОДА ----------
    const lakes = [];
    function lake(cx, cy, w, h, beachCol, rot, frozen) {
        const rad = Math.min(w, h) / 2, R2 = rad + 42, pts = [], n = 64, a = (rot || 0) * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
        for (let i = 0; i < n; i++) {
            const t = i / n * TAU, ux = Math.cos(t), uy = Math.sin(t);
            const px = w >= h ? (ux >= 0 ? w / 2 - rad : rad - w / 2) + ux * R2 : ux * R2, py = w >= h ? uy * R2 : (uy >= 0 ? h / 2 - rad : rad - h / 2) + uy * R2;
            pts.push([cx + px * ca - py * sa, cy + px * sa + py * ca]);
        }
        pts.push(pts[0]);
        if (beachCol) line(pts, 74, beachCol, null, 1);
        water(cx - w / 2, cy - h / 2, w, h, rot);
        if (frozen) { const hw = Math.max(0, w / 2 - rad) * 0.98, a2 = (rot || 0) * Math.PI / 180; line([[cx - hw * Math.cos(a2), cy - hw * Math.sin(a2)], [cx + hw * Math.cos(a2), cy + hw * Math.sin(a2)]], Math.min(200, Math.round(Math.min(w, h) * 0.6)), '#a9d6ee', '#e6f3fb', 3); }
        lakes.push({ cx, cy, r: Math.max(w, h) / 2 }); resDisk(cx, cy, Math.max(w, h) / 2 + 30);
    }

    // ===================== ОЗЕРА / СТАВКИ =====================
    const BEACH = '#d8c690';
    lake(2300, 1550, 1100, 560, null, 0, true);            // замерзле озеро (зима)
    lake(4350, 1750, 560, 380, null, 0, true);             // крижаний ставок
    lake(1500, 6100, 1250, 700, BEACH);           // велике озеро (літо, південний захід)
    lake(5200, 6750, 720, 460, BEACH);            // ставок (літо, південь)
    lake(6400, 3500, 640, 440, '#cdb78a');        // ставок (осінь)
    lake(700, 3750, 500, 340, BEACH);             // ставок (літо, захід)
    lake(5150, 4750, 600, 420, BEACH);            // ставок (літо, схід від центру)
    const RIVER = [[2500, 1900], [2800, 2500], [2650, 3200], [2150, 3800], [2000, 4500], [1800, 5200], [1600, 5700]];
    resLine(RIVER, 290);

    // ===================== ПЛОЩА ЦИТАДЕЛІ =====================
    Z = 3;
    for (const rad of [170, 310, 450]) { const pts = []; for (let i = 0; i <= 48; i++) pts.push([C + Math.cos(i / 48 * TAU) * rad, C + Math.sin(i / 48 * TAU) * rad]); line(pts, 90, '#a39d8d', '#8a8476', 3); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + TAU / 16; line([[C + Math.cos(a) * 120, C + Math.sin(a) * 120], [C + Math.cos(a) * 520, C + Math.sin(a) * 520]], 64, '#a39d8d', '#8a8476', 3); }
    Z = 6;
    water(C - 110, C - 110, 220, 220); prop('prop_statue', C - 35, C - 35, 70, 70);       // фонтан зі статуєю
    resDisk(C, C, 560);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + TAU / 8; prop('prop_well', C + Math.cos(a) * 330 - 35, C + Math.sin(a) * 330 - 35, 70, 70); }
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2, rd = 450 + 0; const bx = C + Math.cos(a) * rd, by = C + Math.sin(a) * rd; prop('prop_wood_bench', bx - 50, by - 15, 100, 30, a * 180 / Math.PI + 90); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.55; prop('prop_statue', C + Math.cos(a) * 560 - 30, C + Math.sin(a) * 560 - 30, 60, 60); }

    // ===================== СЕЛИЩА =====================
    const settle = [];
    function pickArch(list) { return pick(list); }
    // cx,cy — центр; style; n — кількість будівель; mix — вага архетипів
    function village(name, cx, cy, n, R, mix, opt) {
        opt = opt || {}; const style = themeAt(cx, cy), made = [];
        const spec = opt.spec || Array.from({ length: n }, () => pickArch(mix));
        resDisk(cx, cy, 150);
        for (const arch of spec) {
            let ok = null;
            for (let t = 0; t < 500 && !ok; t++) {
                const a = rnd() * TAU, d = 230 + (t / 500) * R * 1.4 + rnd() * R * 0.5, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
                if (Math.hypot(x - cx, y - cy) < 230) continue;
                const dx = cx - x, dy = cy - y, side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'w' : 'e') : (dy > 0 ? 'n' : 's');
                ok = building(arch, x, y, side, themeAt(x, y), { bunker: arch === 'tower' && rnd() < 0.4, pad: opt.pad });
            }
            if (ok) { made.push(ok); if (ok.style === 'snow' || rnd() < 0.35) stairs(ok); }
        }
        settle.push({ name, cx, cy, R, style, made });
        // майдан: залежно від біому
        const props = style === 'snow' ? [['prop_campfire', 50, 50], ['prop_wood_firewood', 70, 50], ['prop_wood_bench', 100, 30]] : style === 'autumn' ? [['prop_well', 70, 70], ['prop_wood_cart', 110, 70], ['prop_hay', 80, 80]] : [['prop_well', 70, 70], ['prop_wood_bench', 100, 30], ['prop_wood_table', 100, 50]];
        props.forEach((p, i) => { const a = i / props.length * TAU + 0.6; const x = cx + Math.cos(a) * 140, y = cy + Math.sin(a) * 140; if (!coll(x, y, 45)) prop(p[0], x - p[1] / 2, y - p[2] / 2, p[1], p[2]); });
        // двірний інвентар
        made.forEach(b => {
            const items = b.style === 'snow' ? [['prop_wood_firewood', 70, 50], ['prop_wood_stump', 44, 44], ['prop_barrel', 40, 40], ['prop_crate', 50, 50]] : b.style === 'autumn' ? [['prop_hay', 80, 80], ['prop_wood_cart', 110, 70], ['prop_wood_planks', 90, 50], ['prop_barrel', 40, 40]] : [['prop_barrel', 40, 40], ['prop_crate', 50, 50], ['prop_wood_cart', 110, 70], ['prop_hay', 80, 80]];
            const k = ri(0, 2);
            for (let q = 0; q < k; q++) { const it = pick(items); nearFree(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) / 2 + 60, Math.max(b.w, b.h) / 2 + 130, (x, y) => { if (Math.hypot(x - b.step[0], y - b.step[1]) > 150) prop(it[0], x - it[1] / 2, y - it[2] / 2, it[1], it[2]); }, 25); }
        });
        return made;
    }
    const MIXV = ['small', 'small', 'small', 'house', 'house', 'house', 'barn', 'villa', 'tower'];
    const MIXW = ['small', 'small', 'house', 'house', 'house', 'barn', 'tower'];
    // цитадель: специфічний склад і розташування по кільцю
    (function citadel() {
        const spec = ['villa', 'villa', 'villa', 'barn', 'barn', 'house', 'house', 'house', 'tower', 'tower', 'house', 'small'];
        const made = [];
        spec.forEach((arch, i) => {
            for (let t = 0; t < 400; t++) {
                const a = (i / spec.length) * TAU + rr(-0.25, 0.25), d = rr(650, 1000), x = C + Math.cos(a) * d, y = C + Math.sin(a) * d;
                const dx = C - x, dy = C - y, side = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'w' : 'e') : (dy > 0 ? 'n' : 's');
                const b = building(arch, x, y, side, 'grass', { bunker: arch === 'tower', pad: 150, loot: arch === 'tower' ? 1 : undefined }); if (b) { made.push(b); if (rnd() < 0.6) stairs(b); break; }
            }
        });
        settle.push({ name: 'Citadel', cx: C, cy: C, R: 1100, style: 'grass', made });
    })();
    // стіна цитаделі (напівзруйнована) з воротами
    (function citadelWall() {
        const R = 1210, n = 46, gates = [0, 90, 180, 270];
        for (let i = 0; i < n; i++) {
            const a0 = i / n * TAU, a1 = (i + 1) / n * TAU, am = (a0 + a1) / 2 * 180 / Math.PI;
            if (gates.some(g => { const d = Math.abs(((am - g + 540) % 360) - 180); return d > 180 - 8.5; })) continue;      // ворота ≈ 18° (≈ 380 px)
            if (rnd() < 0.2) continue;                                                                                // пролом
            const x1 = C + Math.cos(a0) * R, y1 = C + Math.sin(a0) * R, x2 = C + Math.cos(a1) * R, y2 = C + Math.sin(a1) * R, len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            const o = wall((x1 + x2) / 2 - len / 2 - 4, (y1 + y2) / 2 - 28, len + 8, 56, pick(['#8d8579', '#7f786d', '#938b7e'])); o.rot = ((R_(ang) % 360) + 360) % 360;
        }
        gates.forEach(g => [-1, 1].forEach(sd => { const a = (g + sd * 10.5) * Math.PI / 180, x = C + Math.cos(a) * R, y = C + Math.sin(a) * R; wall(x - 45, y - 45, 90, 90, '#7b756c', { stripe: '#a69f92' }); }));
    })();

    // зима
    village('Frostholm', 1000, 1000, 6, 420, MIXW);
    village('Northwatch', 3300, 800, 5, 400, MIXW);
    village('Whitebrook', 900, 2300, 4, 380, MIXW);
    // літо
    village('Oakfield', 800, 4500, 6, 420, MIXV);
    village('Riverside', 2700, 5500, 5, 400, MIXV);
    village('Southgate', 3800, 6550, 5, 400, MIXV);
    village('Millstone', 5000, 5700, 4, 380, MIXV);
    village('Lowmarsh', 800, 6950, 3, 360, MIXV);
    // осінь
    village('Harvest', 6500, 2300, 6, 420, ['barn', 'barn', 'house', 'house', 'small', 'villa']);
    village('Amberfarm', 6500, 4950, 6, 420, ['barn', 'barn', 'house', 'house', 'small', 'villa', 'house']);
    village('Rustwood', 6300, 6500, 4, 380, ['barn', 'house', 'small', 'house']);
    village('Fallhill', 6300, 950, 3, 360, ['house', 'small', 'barn']);
    // самотні хутори, вежі, склади
    const lone = [
        ['tower', 4350, 950, 1], ['tower', 1450, 1950, 1], ['small', 650, 1650, 0], ['house', 4300, 2550, 0], ['barn', 2150, 2750, 0],
        ['tower', 1250, 3450, 1], ['tower', 3000, 4650, 1], ['villa', 4350, 5000, 0], ['tower', 2350, 6550, 1], ['barn', 4650, 7050, 0], ['house', 650, 5700, 0], ['small', 5700, 4900, 0], ['tower', 5000, 3400, 1],
        ['barn', 7000, 3050, 0], ['tower', 7000, 5600, 1], ['house', 7000, 6800, 0], ['barn', 6000, 1550, 0], ['small', 7000, 4300, 0], ['tower', 5600, 2650, 1], ['tower', 3100, 7050, 1]
    ];
    lone.forEach(([arch, x, y, bunker]) => {
        for (let t = 0; t < 60; t++) {
            const px = x + rr(-250, 250) * (t / 30), py = y + rr(-250, 250) * (t / 30), st = themeAt(px, py);
            const side = pick(['n', 's', 'e', 'w']); const b = building(arch, px, py, side, st, { bunker: !!bunker, pad: 180 });
            if (b) { if (rnd() < 0.5) stairs(b); break; }
        }
    });

        // ===================== ДОРОГИ (A* в обхід будівель і озер) =====================
    const roads = [];
    function aStar(sx, sy, tx, ty) {
        const G = 50, N = Math.ceil(S / G), st = new Int8Array(N * N), dop = { doorOpen: () => false };
        const blocked = (i, j) => { if (i < 2 || j < 2 || i >= N - 2 || j >= N - 2) return true; const k = j * N + i; if (st[k]) return st[k] === 2; const b = coll((i + 0.5) * G, (j + 0.5) * G, 54, dop); st[k] = b ? 2 : 1; return b; };
        const near = (x, y) => { let ci = Math.floor(x / G), cj = Math.floor(y / G); if (!blocked(ci, cj)) return [ci, cj]; for (let r = 1; r < 24; r++) for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) if ((Math.abs(a) === r || Math.abs(c) === r) && !blocked(ci + a, cj + c)) return [ci + a, cj + c]; return null; };
        const s = near(sx, sy), t = near(tx, ty); if (!s || !t) return null;
        const gS = new Float64Array(N * N).fill(1e18), from = new Int32Array(N * N).fill(-1), done = new Uint8Array(N * N);
        const heap = []; const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
        const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, r = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
        const sk = s[1] * N + s[0], tk = t[1] * N + t[0]; gS[sk] = 0; push(0, sk);
        while (heap.length) {
            const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === tk) break;
            const i = k % N, j = (k - i) / N;
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                if (!dx && !dy) continue; const a = i + dx, b = j + dy; if (blocked(a, b)) continue; if (dx && dy && (blocked(i + dx, j) || blocked(i, j + dy))) continue;
                const nk = b * N + a; if (done[nk]) continue;
                const pen = (blocked(a + 1, b) || blocked(a - 1, b) || blocked(a, b + 1) || blocked(a, b - 1)) ? 1.5 : 1, ng = gS[k] + (dx && dy ? 1.414 : 1) * pen;
                if (ng < gS[nk]) { gS[nk] = ng; from[nk] = k; push(ng + Math.hypot(a - t[0], b - t[1]), nk); }
            }
        }
        if (from[tk] < 0 && tk !== sk) return null;
        const pts = []; for (let k = tk; k >= 0; k = from[k]) { pts.push([((k % N) + 0.5) * G, (Math.floor(k / N) + 0.5) * G]); if (k === sk) break; } pts.reverse();
        pts[0] = [sx, sy]; pts[pts.length - 1] = [tx, ty];
        return pts;
    }
    function smooth(pts, it) { for (let q = 0; q < it; q++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } o.push(pts[pts.length - 1]); pts = o; } return pts; }
    function resample(pts, step) { const o = [pts[0]]; let acc = 0; for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc >= step) { o.push(pts[i]); acc = 0; } } if (o[o.length - 1] !== pts[pts.length - 1]) o.push(pts[pts.length - 1]); return o; }
    function makeRoad(a, b, wd, trimA, trimB) {
        let p = aStar(a[0], a[1], b[0], b[1]); if (!p) { console.warn('road failed', a, b); return; }
        p = resample(smooth(p, 2), 55);
        if (trimA) while (p.length > 3 && Math.hypot(p[0][0] - a[0], p[0][1] - a[1]) < trimA) p.shift();
        if (trimB) while (p.length > 3 && Math.hypot(p[p.length - 1][0] - b[0], p[p.length - 1][1] - b[1]) < trimB) p.pop();
        roads.push({ pts: p, w: wd });
    }
    const hubs = { cit: [C, C], WA: [1000, 1000], WB: [3300, 800], WC: [900, 2300], SA: [800, 4500], SB: [2700, 5500], SC: [3800, 6550], SD: [5000, 5700], SE: [800, 6950], AA: [6500, 2300], AB: [6500, 4950], AC: [6300, 6500], AD: [6300, 950] };
    [['cit', 'SB', 1], ['cit', 'SC', 1], ['cit', 'SD', 1], ['cit', 'AB', 1], ['cit', 'AA', 1], ['cit', 'WB', 1], ['cit', 'SA', 1], ['WB', 'WA', 0], ['WA', 'WC', 0], ['AA', 'AD', 0], ['AB', 'AC', 0], ['SB', 'SE', 0], ['SA', 'WC', 0], ['SD', 'AB', 0], ['WB', 'AD', 0]].forEach(([a, b, main]) => makeRoad(hubs[a], hubs[b], main ? 110 : 84, a === 'cit' ? 505 : 0, 0));
    // малюємо з кольором за біомом; резервуємо коридор
    roads.forEach(r => {
        resLine(r.pts, r.w / 2 + 40);
        let seg = [r.pts[0]], cur = themeAt(r.pts[0][0], r.pts[0][1]);
        const flush = () => { if (seg.length > 1) { const st = ST[cur]; line(seg, r.w, st.road, st.roadS, 4); } };
        for (let i = 1; i < r.pts.length; i++) { const th = themeAt(r.pts[i][0], r.pts[i][1]); seg.push(r.pts[i]); if (th !== cur) { flush(); seg = [r.pts[i]]; cur = th; } }
        flush();
    });

    // ===================== РІЧКА: ланцюг капсул із бродами/мостами на дорогах =====================
    (function river() {
        const L = []; for (let i = 1; i < RIVER.length; i++) { const a = RIVER[i - 1], b = RIVER[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let t = 0; t < d; t += 85) L.push([a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d, Math.atan2(b[1] - a[1], b[0] - a[0])]); }
        // броди: на перетині з дорогами + два додаткові
        const fords = [];
        roads.forEach(r => { for (let i = 0; i < r.pts.length; i += 1) { const p = r.pts[i]; if (RIVER.some((q, k) => k && MO.distToSeg(p[0], p[1], RIVER[k - 1][0], RIVER[k - 1][1], q[0], q[1]) < 90) && fords.every(f => Math.hypot(f[0] - p[0], f[1] - p[1]) > 380)) { let best = null, bd = 1e9; for (let k = 1; k < RIVER.length; k++) { const dd = MO.distToSeg(p[0], p[1], RIVER[k - 1][0], RIVER[k - 1][1], RIVER[k][0], RIVER[k][1]); if (dd < bd) { bd = dd; best = Math.atan2(RIVER[k][1] - RIVER[k - 1][1], RIVER[k][0] - RIVER[k - 1][0]); } } fords.push([p[0], p[1], best, 1]); } } });
        [[2850, 2900], [2000, 4900]].forEach(([x, y]) => { let best = null, bd = 1e9, bp = null; for (let k = 1; k < RIVER.length; k++) for (let t = 0; t <= 1; t += 0.02) { const px = RIVER[k - 1][0] + (RIVER[k][0] - RIVER[k - 1][0]) * t, py = RIVER[k - 1][1] + (RIVER[k][1] - RIVER[k - 1][1]) * t, d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; bp = [px, py]; best = Math.atan2(RIVER[k][1] - RIVER[k - 1][1], RIVER[k][0] - RIVER[k - 1][0]); } } if (fords.every(f => Math.hypot(f[0] - bp[0], f[1] - bp[1]) > 500)) fords.push([bp[0], bp[1], best, 0]); });
        for (let k = 1; k < RIVER.length; k++) {
            const a = RIVER[k - 1], b = RIVER[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d, ang = Math.atan2(uy, ux) * 180 / Math.PI;
            const cuts = fords.map(f => ({ t: (f[0] - a[0]) * ux + (f[1] - a[1]) * uy, dist: MO.distToSeg(f[0], f[1], a[0], a[1], b[0], b[1]) })).filter(c => c.dist < 60 && c.t > -250 && c.t < d + 250).map(c => c.t).sort((p, q) => p - q);
            let t0 = k === 1 ? -120 : -100; const pieces = [];
            for (const c of cuts) { if (c - 190 > t0 + 60) pieces.push([t0, c - 190]); t0 = Math.max(t0, c + 190); }
            if (d + 100 > t0 + 60) pieces.push([t0, d + 100]);
            for (const [p0, p1] of pieces) { const len = p1 - p0, tm = (p0 + p1) / 2, cx = a[0] + ux * tm, cy = a[1] + uy * tm, hh = 240; water(cx - (len + 150) / 2, cy - hh / 2, len + 150, hh, ang); }
        }
        fords.forEach(f => { const nx = -Math.sin(f[2]), ny = Math.cos(f[2]), a = [f[0] - nx * 200, f[1] - ny * 200], b = [f[0] + nx * 200, f[1] + ny * 200]; if (f[3]) line([a, b], 120, '#8f6a3a', '#5e4524', 4); else line([a, b], 150, '#cdbb8a', null, 4); });
        resLine(RIVER, 120);
    })();

        // ===================== ПОЛЯ, ПАГОРБИ, ПАРКАНИ =====================
    const lootPts = [];       // зовнішній лут (будинки додаємо окремо)
    const nearSettle = (x, y, pad) => settle.some(s => Math.hypot(x - s.cx, y - s.cy) < s.R + pad);
    function openSpot(clear, pad, tries) {
        for (let t = 0; t < (tries || 400); t++) { const x = rr(300, S - 300), y = rr(300, S - 300); if (free(x, y, clear) && !nearSettle(x, y, pad) && !nearBld(x, y, clear * 0.5 + 60)) return [x, y]; }
        return null;
    }
    // поля (широкі лінії з борознами)
    Z = 0;
    [['Oakfield', 0], ['Riverside', 1], ['Southgate', 2], ['Harvest', 3], ['Amberfarm', 4], ['Rustwood', 5], ['Millstone', 6], ['Lowmarsh', 7], ['Fallhill', 8]].forEach(([nm]) => {
        const s = settle.find(q => q.name === nm); if (!s) return;
        for (let k = 0; k < 2; k++) for (let t = 0; t < 40; t++) {
            const a = rnd() * TAU, d = s.R + rr(260, 520), x = s.cx + Math.cos(a) * d, y = s.cy + Math.sin(a) * d, th = rnd() * TAU, L = rr(240, 420), x2 = x + Math.cos(th) * L, y2 = y + Math.sin(th) * L;
            let ok = inMap(x, y, 250) && inMap(x2, y2, 250);
            for (let q = 0; q <= 6 && ok; q++) if (!free(x + (x2 - x) * q / 6, y + (y2 - y) * q / 6, 135)) ok = false;
            if (!ok) continue;
            const th2 = themeAt(x, y); line([[x, y], [x2, y2]], 190, th2 === 'autumn' ? '#b8923f' : th2 === 'snow' ? '#cdd9e6' : '#b9a64a', th2 === 'autumn' ? '#8f6a2a' : th2 === 'snow' ? '#a8bacc' : '#9c8a36', 0);
            resLine([[x, y], [x2, y2]], 60); break;
        }
    });
    // пагорби-плато: кільця-декалі
    Z = 1;
    for (let k = 0; k < 9; k++) {
        const sp = openSpot(300, 250, 600); if (!sp) continue; const r = rr(170, 260), th = themeAt(sp[0], sp[1]), pts = [];
        for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU; pts.push([sp[0] + Math.cos(a) * r * (1 + 0.08 * Math.sin(a * 3 + k)), sp[1] + Math.sin(a) * r * (1 + 0.08 * Math.cos(a * 2 + k))]); }
        line(pts, 64, th === 'snow' ? '#eef4fa' : th === 'autumn' ? '#a67c48' : '#7fa95d', th === 'snow' ? '#c5d4e3' : th === 'autumn' ? '#7d5a30' : '#5f8a45', 1);
        Z = 6; for (let q = 0; q < 2; q++) { const a = rnd() * TAU, d = rr(0, r * 0.5); const rx = sp[0] + Math.cos(a) * d, ry = sp[1] + Math.sin(a) * d; if (free(rx, ry, 70)) prop('prop_rock', rx - 40, ry - 35, 80, 70); } Z = 1;
        resDisk(sp[0], sp[1], r + 40);
    }
    Z = 6;
    // загорожі-вигони з проходами
    for (let k = 0; k < 8; k++) {
        const s = pick(settle.filter(q => q.name !== 'Citadel' && themeAt(q.cx, q.cy) !== 'snow')), a = rnd() * TAU, d = s.R + rr(250, 450), cx = s.cx + Math.cos(a) * d, cy = s.cy + Math.sin(a) * d, w = r10(rr(360, 480)), h = r10(rr(280, 360));
        if (!bldRectFree({ x: cx - w / 2 - 30, y: cy - h / 2 - 30, w: w + 60, h: h + 60 }, 90)) continue;
        const x0 = cx - w / 2, y0 = cy - h / 2, gaps = { n: rnd() < 0.7, s: rnd() < 0.7, e: rnd() < 0.5, w: rnd() < 0.5 }; if (!gaps.n && !gaps.s) gaps.s = true;
        for (const sd of ['n', 's', 'e', 'w']) {
            const horiz = sd === 'n' || sd === 's', len = horiz ? w : h, gc = len / 2 + rr(-len * 0.2, len * 0.2), n = Math.floor(len / 120);
            for (let i = 0; i < n; i++) { const c = (i + 0.5) * len / n; if (gaps[sd] && Math.abs(c - gc) < 85) continue; if (horiz) prop('prop_fence_wood', x0 + c - 60, (sd === 'n' ? y0 : y0 + h) - 10, 120, 20); else prop('prop_fence_wood', x0 + (sd === 'w' ? 0 : w) - 60, y0 + c - 10, 120, 20, 90); }
        }
        blds.push({ x: x0 - 30, y: y0 - 30, w: w + 60, h: h + 60 });
        nearFree(cx, cy, 70, 40, (x, y) => prop('prop_hay', x - 40, y - 40, 80, 80), 30);
    }

    // ===================== ОПОРНІ ПУНКТИ (групи укриттів) =====================
    function group(pieces) {
        for (const p of pieces) { if (!inMap(p.x, p.y, 200) || !free(p.x, p.y, Math.hypot(p.w, p.h) / 2 + 55)) return false; }
        pieces.forEach(p => { const o = prop(p.t, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.rot); });
        return true;
    }
    const rot2 = (x, y, th, dx, dy) => [x + Math.cos(th) * dx - Math.sin(th) * dy, y + Math.sin(th) * dx + Math.cos(th) * dy];
    const GROUPS = {
        trench(x, y, th) { const P = []; for (let i = 0; i < 4; i++) { const q = rot2(x, y, th, (i - 1.5) * 190, (i % 2 ? 36 : -36)); P.push({ t: 'prop_sandbag', x: q[0], y: q[1], w: 100, h: 40, rot: th * 180 / Math.PI }); } [-1, 1].forEach(sd => { const q = rot2(x, y, th, sd * 150, 130); P.push({ t: 'prop_hedgehog', x: q[0], y: q[1], w: 60, h: 60 }); }); return P; },
        yard(x, y, th) { const P = []; for (let i = 0; i < 3; i++) { const a = th + i / 3 * TAU, q = [x + Math.cos(a) * 200, y + Math.sin(a) * 200]; P.push({ t: i % 2 ? 'prop_cont_red' : 'prop_cont_blue', x: q[0], y: q[1], w: 160, h: 70, rot: Math.round((a * 180 / Math.PI + 90) / 15) * 15 }); } [0, 1].forEach(i => { const a = th + 0.5 + i * 3, q = [x + Math.cos(a) * 60, y + Math.sin(a) * 60]; P.push({ t: 'prop_barrel', x: q[0], y: q[1], w: 40, h: 40 }); }); return P; },
        nest(x, y, th) { const P = []; for (let i = 0; i < 4; i++) { const a = th + (i - 1.5) * (Math.PI / 3), q = [x + Math.cos(a) * 190, y + Math.sin(a) * 190]; P.push({ t: 'prop_concrete', x: q[0], y: q[1], w: 100, h: 50, rot: a * 180 / Math.PI + 90 }); } return P; },
        wreck(x, y, th) { const P = []; [0, 1].forEach(i => { const q = rot2(x, y, th, (i ? 1 : -1) * 170, (i ? -50 : 50)); P.push({ t: 'prop_wreck', x: q[0], y: q[1], w: 140, h: 80, rot: th * 180 / Math.PI + i * 60 }); }); [0, 1].forEach(i => { const q = rot2(x, y, th, i ? 40 : -60, i ? 150 : -140); P.push({ t: i ? 'prop_tires' : 'prop_barrel', x: q[0], y: q[1], w: i ? 50 : 40, h: i ? 50 : 40 }); }); return P; }
    };
    const outposts = [];
    function placeGroup(kind, x, y) {
        for (let t = 0; t < 10; t++) { const th = rnd() * TAU; if (group(GROUPS[kind](x, y, th))) { outposts.push([x, y]); resDisk(x, y, 180); return true; } }
        return false;
    }
    // навколо цитаделі — кільце опорних пунктів
    for (let k = 0; k < 14; k++) { const a = k / 14 * TAU + 0.2, d = rr(1450, 2000); const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d; for (let t = 0; t < 8; t++) { if (placeGroup(pick(['trench', 'nest', 'yard', 'trench']), x + rr(-120, 120), y + rr(-120, 120))) break; } }
    for (const [kind, n] of [['trench', 10], ['yard', 7], ['nest', 8], ['wreck', 8]]) for (let k = 0; k < n; k++) { for (let t = 0; t < 60; t++) { const sp = openSpot(260, 220, 50); if (!sp) continue; if (outposts.some(o => Math.hypot(o[0] - sp[0], o[1] - sp[1]) < 700)) continue; if (placeGroup(kind, sp[0], sp[1])) break; } }

    // ===================== РУЇНИ =====================
    const ruins = [];
    for (let k = 0; k < 13; k++) {
        const w = r10(rr(290, 410)), h = r10(rr(210, 300)), T = 28;
        for (let t = 0; t < 80; t++) {
            const sp = openSpot(200, 200, 30); if (!sp) continue; const x = r10(sp[0] - w / 2), y = r10(sp[1] - h / 2), rect = { x, y, w, h };
            if (!bldRectFree(rect, 160)) continue;
            const th = themeAt(sp[0], sp[1]), col = pick(th === 'snow' ? ['#8b94a0', '#7d8794'] : ['#8d8579', '#7f786d', '#938b7e']);
            const pieces = [];
            for (const sd of ['n', 's', 'e', 'w']) {
                const horiz = sd === 'n' || sd === 's', len = horiz ? w : h; let c = horiz ? 0 : T; const end = horiz ? w : h - T;
                while (c < end - 30) {
                    const L = Math.min(end - c, rr(90, 200)); pieces.push({ sd, c, L: Math.round(L) }); c += L;
                    if (rnd() < 0.5 && c < end - 130) c += rr(120, 190);
                }
            }
            // гарантуємо ≥ 2 проломи: за потреби прибираємо шматки
            let gapCount = 0; for (const sd of ['n', 's', 'e', 'w']) { const ps = pieces.filter(p => p.sd === sd).sort((a, b) => a.c - b.c); const horiz = sd === 'n' || sd === 's', len = horiz ? w : h, st = horiz ? 0 : T, en = horiz ? w : h - T; let cur = st; ps.forEach(p => { if (p.c - cur > 100) gapCount++; cur = p.c + p.L; }); if (en - cur > 100) gapCount++; }
            while (gapCount < 2 && pieces.length) { pieces.splice(Math.floor(rnd() * pieces.length), 1); gapCount += 1; }
            pieces.forEach(p => { if (p.sd === 'n') wall(x + p.c, y, p.L, T, col); else if (p.sd === 's') wall(x + p.c, y + h - T, p.L, T, col); else if (p.sd === 'w') wall(x, y + p.c, T, p.L, col); else wall(x + w - T, y + p.c, T, p.L, col); });
            blds.push(rect); ruins.push(rect);
            const cx = x + w / 2, cy = y + h / 2;
            for (let q = 0; q < 3; q++) nearFree(cx, cy, 55, Math.min(w, h) * 0.3, (px, py) => prop('prop_rock', px - 30, py - 25, 60, 50), 25);
            resDisk(cx, cy, Math.max(w, h) / 2 + 60);
            break;
        }
    }

    // ===================== ЛІС (до опорних пунктів, щоб зайняти свою територію) =====================
    const ph = Array.from({ length: 8 }, () => rnd() * 6.283);
    const dens = (x, y) => { const v = Math.sin(x / 760 + ph[0]) * Math.sin(y / 840 + ph[1]) + 0.7 * Math.sin((x + y) / 530 + ph[2]) + 0.6 * Math.sin((x - y) / 610 + ph[3]) + 0.4 * Math.sin(x / 290 + y / 330 + ph[4]); return Math.max(0, Math.min(1, 0.5 + v / 3.4)); };
    const TREE_CAP = 3560 - SOL.length - 520;     // місце для лісу: 3560 мінус решта (скелі/кущі + маркери)
    const TR = []; const treeGap = (x, y, r) => { for (const t of TR) { const dx = t[0] - x; if (dx > 400 || dx < -400) continue; if (Math.hypot(dx, t[1] - y) < r + t[2] + 77) return false; } return true; };
    let treesN = 0; const DBG = { m: 0, c: 0, r: 0 };
    {   // щільні масиви: зсунута гекс-решітка (кроки ≈ 200) з джитером; відбір за маскою густоти; зазор між кронами ≥ 77
        const cand = []; const st = 198;
        for (let j = 0; j * st * 0.866 < S - 240; j++) for (let i = 0; i * st < S - 240; i++) cand.push([120 + i * st + (j % 2 ? st / 2 : 0) + rr(-14, 14), 120 + j * st * 0.866 + rr(-14, 14)]);
        for (let i = cand.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [cand[i], cand[k]] = [cand[k], cand[i]]; }
        for (const [x, y] of cand) {
            if (treesN >= TREE_CAP) break;
            const d = dens(x, y), th = themeAt(x, y), inCit = Math.hypot(x - C, y - C) < 1500;
            if (d < 0.44 || (inCit && rnd() > 0.1)) continue;
            const rg = ST[th].tree, r = rr(rg[0], rg[1]) * (d > 0.64 ? 1.1 : 1);
            DBG.m++; if (coll(x, y, r + 62) || !treeGap(x, y, r) || nearBld(x, y, r + 45)) { DBG.c++; continue; } if (resHit(x, y, r * 0.6)) { DBG.r++; continue; }
            tree(x, y, r); TR.push([x, y, r]); treesN++;
        }
    }
    console.log('forest', JSON.stringify(DBG), 'cap', TREE_CAP);
    for (let t = 0; t < 4000000 && treesN < TREE_CAP; t++) {
        const x = rr(120, S - 120), y = rr(120, S - 120), d = dens(x, y), th = themeAt(x, y), inCit = Math.hypot(x - C, y - C) < 1500;
        const p = (d > 0.42 ? 1 : d > 0.36 ? 0.15 : 0.012) * (inCit ? 0.1 : 1);
        if (rnd() > p) continue;
        const rg = ST[th].tree, r = rr(rg[0] * 0.72, rg[0] * 1.02);
        if (coll(x, y, r + 62) || !treeGap(x, y, r) || resHit(x, y, r * 0.6) || nearBld(x, y, r + 45)) continue;
        tree(x, y, r); TR.push([x, y, r]); treesN++;
    }

        // ===================== ЛІСИ, СКЕЛІ, КУЩІ =====================
    // скелі: групи й поодинокі
    let rocks = 0;
    for (let k = 0; k < 40; k++) { const sp = openSpot(115, 100, 300); if (!sp) continue; for (let q = 0; q < 4; q++) nearFree(sp[0], sp[1], 90, 240, (x, y) => { const w = ri(70, 110), h = ri(60, 90); prop('prop_rock', x - w / 2, y - h / 2, w, h); rocks++; }, 20); }
    for (let k = 0; k < 140; k++) { const sp = openSpot(85, 80, 300); if (sp) { const w = ri(70, 110), h = ri(60, 90); prop('prop_rock', sp[0] - w / 2, sp[1] - h / 2, w, h); rocks++; } }
    // кущі й пеньки/колоди за біомом
    for (let k = 0; k < 1000; k++) {
        const sp = openSpot(78, 80, 300); if (!sp) continue; const th = themeAt(sp[0], sp[1]);
        if (th === 'snow') { if (rnd() < 0.5) prop('prop_wood_stump', sp[0] - 22, sp[1] - 22, 44, 44); else prop('prop_wood_log', sp[0] - 60, sp[1] - 20, 120, 40, ri(0, 3) * 45); }
        else if (th === 'autumn') { if (rnd() < 0.45) prop('prop_bush', sp[0] - 30, sp[1] - 30, 60, 60); else if (rnd() < 0.5) prop('prop_hay', sp[0] - 40, sp[1] - 40, 80, 80); else prop('prop_wood_stump', sp[0] - 22, sp[1] - 22, 44, 44); }
        else { if (rnd() < 0.75) prop('prop_bush', sp[0] - 30, sp[1] - 30, 60, 60); else prop('prop_wood_log', sp[0] - 60, sp[1] - 20, 120, 40, ri(0, 3) * 45); }
    }

    // ===================== ПЕРЕВІРКА ПРОХІДНОСТІ: заливка по сітці 20 px, танк r=25, двері відчинені =====================
    let GC = 20, GN = Math.ceil(S / GC), WR = 25;
    function walkGrid() { const w = new Uint8Array(GN * GN), op = { doorOpen: () => true }; for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) w[j * GN + i] = coll((i + 0.5) * GC, (j + 0.5) * GC, WR, op) ? 0 : 1; return w; }
    function components(w) {
        const lab = new Int32Array(GN * GN).fill(-1), sizes = [], q = new Int32Array(GN * GN);
        for (let s0 = 0; s0 < GN * GN; s0++) {
            if (!w[s0] || lab[s0] >= 0) continue; const id = sizes.length; let h = 0, t = 0; q[t++] = s0; lab[s0] = id;
            while (h < t) { const k = q[h++], i = k % GN, j = (k - i) / GN; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + dx, b = j + dy; if (a < 0 || b < 0 || a >= GN || b >= GN) continue; const nk = b * GN + a; if (w[nk] && lab[nk] < 0) { lab[nk] = id; q[t++] = nk; } } }
            sizes.push(t);
        }
        return { lab, sizes };
    }
    const DECOR = /^(tree|prop_(bush|rock|wood_stump|wood_log|fence_wood|hay|barrel|crate|tires|wood_table|wood_bench|wood_wall|wood_planks|wood_pallet|wood_cart|wood_firewood))$/;
    function healPockets(minKeep) {
        for (let round = 0; round < 14; round++) {
            const w = walkGrid(), { lab, sizes } = components(w); let main = 0; sizes.forEach((s, i) => { if (s > sizes[main]) main = i; });
            const pockets = sizes.map((s, i) => i).filter(i => i !== main && sizes[i] > (minKeep || 0));
            if (!pockets.length) return { main: sizes[main], pockets: 0 };
            let removed = 0;
            for (const pid of pockets) {
                // клітинки кишені → найближчі декоративні об'єкти, що її замикають
                const cells = []; for (let k = 0; k < GN * GN; k++) if (lab[k] === pid) cells.push(k);
                const cx = (cells[0] % GN + 0.5) * GC, cy = (Math.floor(cells[0] / GN) + 0.5) * GC;
                const rad = Math.sqrt(cells.length) * GC + 140, near = [];
                SOL.forEach((o, idx) => { if (!DECOR.test(o.type)) return; const ox = o.type === 'tree' ? o.x : o.x + (o.w || 0) / 2, oy = o.type === 'tree' ? o.y : o.y + (o.h || 0) / 2; const d = Math.hypot(ox - cx, oy - cy) - (o.r || 0); if (d < rad) near.push([d, o]); });
                near.sort((a, b) => a[0] - b[0]);
                if (near.length) { const o = near[0][1]; SOL.splice(SOL.indexOf(o), 1); removed++; }
            }
            if (!removed) return { main: sizes[main], pockets: pockets.length, stuck: true, at: pockets.map(pid => { const k = lab.indexOf(pid); return [Math.round((k % GN + 0.5) * GC), Math.round((Math.floor(k / GN) + 0.5) * GC), sizes[pid]]; }) };
        }
        return { pockets: -1 };
    }
    const heal = healPockets();
    GC = 30; GN = Math.ceil(S / GC); WR = 26;      // сітка Nav (CS=30, r=26)
    const heal2 = healPockets();
    GC = 20; GN = Math.ceil(S / GC); WR = 25;
    console.log('pockets', JSON.stringify(heal), JSON.stringify(heal2));

    // ===================== МАРКЕРИ: лут (spawn_powerup) =====================
    const U = [];
    const okU = (x, y) => inMap(x, y, 120) && !coll(x, y, 42) && U.every(u => Math.hypot(u[0] - x, u[1] - y) >= 90);
    let MAXU = 999; const addU = (x, y) => { if (U.length < MAXU && okU(x, y)) { U.push([R_(x), R_(y)]); return true; } return false; };
    { const bl = blds.filter(b => b.loot && b.loot.length).sort((a, c) => c.w * c.h - a.w * a.h); const got = new Map(); for (const b of bl) { for (const p of b.loot) if (addU(p[0], p[1])) { got.set(b, 1); break; } } let cnt = U.length; for (const b of bl) { if (cnt >= 84) break; for (const p of b.loot.slice(1, 2 + (b.w * b.h > 90000 ? 1 : 0))) if (cnt < 84 && addU(p[0], p[1])) cnt++; } }  // у будинках: ≥1 кожен, ≤ 90 всього
    const inside = U.length; MAXU = 108;
    // плац цитаделі
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + 0.3, d = k % 2 ? 250 : 400; for (let q = 0; q < 12 && !addU(C + Math.cos(a) * d + rr(-30, 30), C + Math.sin(a) * d + rr(-30, 30)); q++); }
    // опорні пункти, руїни, центри сіл
    outposts.forEach(o => { for (let q = 0; q < 30; q++) { const a = rnd() * TAU, d = rr(0, 110); if (addU(o[0] + Math.cos(a) * d, o[1] + Math.sin(a) * d)) break; } });
    ruins.forEach(r => { for (let q = 0; q < 30; q++) if (addU(r.x + rr(50, r.w - 50), r.y + rr(50, r.h - 50))) break; });
    settle.forEach(s => { for (let q = 0; q < 40; q++) { const a = rnd() * TAU, d = rr(0, 160); if (addU(s.cx + Math.cos(a) * d, s.cy + Math.sin(a) * d)) break; } });
    // решта — рівномірно по ландшафту (у вільних місцях), доки не набереться ≈ 100
    for (let t = 0; t < 4000 && U.length < 106; t++) addU(rr(250, S - 250), rr(250, S - 250));
    U.forEach(u => marker('spawn_powerup', u[0], u[1]));

    // ===================== МАРКЕРИ: гравці (16 по периметру, рівномірно по біомах) =====================
    const P16 = [];
    for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU + 0.12; let placed = false;
        for (let d = 3250; d >= 1900 && !placed; d -= 80) for (let q = 0; q < 40 && !placed; q++) {
            const x = C + Math.cos(a + (q % 2 ? 1 : -1) * Math.floor(q / 2) * 0.014) * d, y = C + Math.sin(a + (q % 2 ? 1 : -1) * Math.floor(q / 2) * 0.014) * d;
            if (!inMap(x, y, 300) || coll(x, y, 60) || resHit(x, y, 20)) continue; if (P16.some(p => Math.hypot(p[0] - x, p[1] - y) < 550)) continue;
            P16.push([R_(x), R_(y)]); placed = true;
        }
    }
    P16.forEach(p => marker('spawn_player', p[0], p[1]));
    // перший spawn_player має стояти в центрі досяжності (для перевірок) — зберігаємо порядок, але додаємо дубль у плац не потрібен

    // ===================== ПЕРЕВІРКА Nav: усі маркери досяжні з плацу (r = 24..26, двері зачинені) =====================
    const NAV = require('../navgrid.js');
    let navLeft = -1;
    for (let round = 0; round < 30; round++) {
        const tmp = { size: S, solids: SOL.slice() }; let sx = C, sy = C;
        for (let d = 0; d < 700 && sx === C; d += 10) for (let a = 0; a < 6.28; a += 0.2) { const x = C + Math.cos(a) * d, y = C + Math.sin(a) * d; if (!MO.collides(tmp, x, y, 30, { doorOpen: () => false })) { sx = x; sy = y; break; } }
        const bad = new Set();
        for (const r of [24, 26]) { const g = NAV.getGrid(tmp, r), f = NAV.buildField(g, sx, sy); SOL.forEach(o => { if (/^spawn_/.test(o.type) && !(f.dist[Math.floor(o.y / NAV.CS) * g.N + Math.floor(o.x / NAV.CS)] >= 0)) bad.add(o); }); }
        navLeft = bad.size; if (!bad.size) break;
        const g = NAV.getGrid(tmp, 26), f = NAV.buildField(g, sx, sy);
        for (const o of bad) {
            // кишеня: клітинки, досяжні від маркера; шукаємо найближчий декор до її меж (не всередині глибини)
            const N = g.N, st = Math.floor(o.y / NAV.CS) * N + Math.floor(o.x / NAV.CS), seen = new Set([st]), q = [st], cells = [];
            while (q.length && cells.length < 3000) { const k = q.pop(); cells.push(k); const x = k % N, y = (k - x) / N; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, b = y + dy; if (a < 0 || b < 0 || a >= N || b >= N) continue; const nk = b * N + a; if (seen.has(nk) || !g.walk[nk] || f.dist[nk] >= 0) continue; seen.add(nk); q.push(nk); } }
            const near = []; SOL.forEach(qq => { if (!DECOR.test(qq.type)) return; const qx = qq.type === 'tree' ? qq.x : qq.x + (qq.w || 0) / 2, qy = qq.type === 'tree' ? qq.y : qq.y + (qq.h || 0) / 2; let dm = 1e9; for (let c = 0; c < cells.length; c += 2) { const cx = (cells[c] % N + 0.5) * NAV.CS, cy = (Math.floor(cells[c] / N) + 0.5) * NAV.CS, d = Math.hypot(qx - cx, qy - cy); if (d < dm) dm = d; } dm -= (qq.r || Math.max(qq.w || 0, qq.h || 0) / 2); if (dm < 90) near.push([dm + Math.hypot(qx - o.x, qy - o.y) * 0.02, qq]); });
            near.sort((a, b) => a[0] - b[0]); if (near.length) SOL.splice(SOL.indexOf(near[0][1]), 1);
        }
    }
    console.log('nav unreachable markers left', navLeft);

    // ===================== ФІНАЛ =====================
    const sorted = SOL.map((o, i) => [o, i]).sort((a, b) => (a[0]._z - b[0]._z) || (a[1] - b[1])).map(q => q[0]);
    MM.solids = sorted;
    const stat = {}; sorted.forEach(o => stat[o.type] = (stat[o.type] || 0) + 1);
    return { map: MM, stats: { solids: sorted.length, buildings: blds.length - ruins.length, trees: treesN, loot: U.length, lootInside: inside, players: P16.length, roads: roads.length, byType: stat } };

}
module.exports = build;
if (require.main === module) { const t0 = Date.now(); const r = build(); console.log('ms', Date.now() - t0, JSON.stringify(r.stats)); require('fs').writeFileSync(process.argv[2] || '/tmp/br_dev.json', JSON.stringify(r.map)); }
