// Хованки: вирівнювання дрібного декору мап по сітці 50 px (той самий крок, до якого «прилипає» замаскований гравець).
// Раніше об'єкти стояли де завгодно (x=137, поворот 8°, розмір 80×70), а маскування — завжди 50×50 по сітці, тож хованця було видно одразу.
// Тепер на мапах із режимом prophunt кожен дрібний об'єкт: розмір — 50 або 100 по кожній осі (один розмір на тип у межах мапи),
// лівий-верхній кут кратний 50, без повороту. Якщо в клітинці тісно — пробуємо сусідні, інакше об'єкт прибираємо.
// Використання: node tools/phgrid.js — оновлює maps_modes.js на місці (детерміновано, повторний запуск нічого не змінює).
//                require('./phgrid.js').apply(maps) — з genmaps2.js / genhide.js.
'use strict';
const MO = require('../public/js/mapobjects.js');
const C = MO.PH_CELL;
const SKIP = new Set(['tree', 'wall_square', 'shape_triangle', 'shape_rhombus', 'shape_parallelepiped']);      // будівлі / фігури / дерева — це укриття, не маскування

function candidate(o) {
    if (!MO.DISGUISE_IDS.has(o.type) || SKIP.has(o.type)) return false;
    const w = o.w || 30, h = o.h || 30, mx = Math.max(w, h), mn = Math.min(w, h);
    return mx <= 125 && mx / Math.max(1, mn) <= 2.6;
}
const snapDim = v => Math.min(2, Math.max(1, Math.round(v / C))) * C;
function bbox(o) {
    if (o.type === 'tree') { const r = o.r || 30; return [o.x - r, o.y - r, o.x + r, o.y + r]; }
    if (o.type === 'line') { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; o.points.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }); const w = (o.width || 10) / 2; return [x0 - w, y0 - w, x1 + w, y1 + w]; }
    const w = o.w || 30, h = o.h || 30;
    if (o.rot) { const cx = o.x + w / 2, cy = o.y + h / 2, d = Math.hypot(w, h) / 2; return [cx - d, cy - d, cx + d, cy + d]; }
    return [o.x, o.y, o.x + w, o.y + h];
}

const Nav = require('../navgrid.js'), san = m => MO.sanitizeMap(JSON.parse(JSON.stringify(m)));
const field = m => { const s = san(m), g = Nav.getGrid(s, 26), sp = s.solids.find(o => o.type === 'spawn_player'); return { g, f: sp ? Nav.buildField(g, sp.x, sp.y) : null }; };

function gridify(map) {
    const S = map.solids, size = map.size;
    const cand = S.filter(candidate);
    if (!cand.length) return { moved: 0, dropped: 0 };
    const before = field(map);
    // канонічний розмір кожного типу — найчастіший після округлення до 50/100 (поворот ~90° міняє сторони місцями)
    const dims = {};
    cand.forEach(o => {
        const r = ((o.rot || 0) % 180 + 180) % 180, tr = r > 45 && r < 135;
        const w = snapDim(tr ? o.h : o.w), h = snapDim(tr ? o.w : o.h), k = w + 'x' + h;
        (dims[o.type] || (dims[o.type] = {}))[k] = ((dims[o.type] || {})[k] || 0) + 1;
    });
    const canon = {};
    Object.keys(dims).forEach(t => { const k = Object.keys(dims[t]).sort((a, b) => dims[t][b] - dims[t][a] || (a < b ? -1 : 1))[0].split('x'); canon[t] = [+k[0], +k[1]]; });
    // перешкоди: усе тверде, що не є кандидатом (стіни, вода, будівлі, двері з запасом), і точки появи
    const others = S.filter(o => !cand.includes(o) && (MO.isSolidType(o) || /spawn_(player|core|cp|convoy)/.test(o.type)) && o.type !== 'line').map(o => ({ o, b: bbox(o), pad: MO.isDoor(o) ? 30 : /spawn/.test(o.type) ? 36 : 2 }));
    const placed = [];
    const rectOk = (x, y, w, h) => {
        if (x < C || y < C || x + w > size - C || y + h > size - C) return false;
        if (MO.hasShape(map)) { for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) if (!MO.circleInPoly(map.shape, px, py, 6)) return false; }
        for (const q of placed) if (x < q[0] + q[2] && x + w > q[0] && y < q[1] + q[3] && y + h > q[1]) return false;
        for (const q of others) {
            const b = q.b, p = q.pad + 2; if (b[2] < x - p || b[0] > x + w + p || b[3] < y - p || b[1] > y + h + p) continue;
            for (let px = x; px <= x + w; px += 10) for (let py = y; py <= y + h; py += 10) if (MO.pointInObject(q.o, px, py, q.pad)) return false;
        }
        return true;
    };
    const OFFS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
    const drop = new Set(); let moved = 0;
    // спершу більші об'єкти (їм важче знайти місце)
    cand.slice().sort((a, b) => (canon[b.type][0] * canon[b.type][1]) - (canon[a.type][0] * canon[a.type][1])).forEach(o => {
        const [w, h] = canon[o.type], b = bbox(o), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
        const gx = Math.round((cx - w / 2) / C) * C, gy = Math.round((cy - h / 2) / C) * C;
        for (const [dx, dy] of OFFS) {
            const x = gx + dx * C, y = gy + dy * C;
            if (!rectOk(x, y, w, h)) continue;
            if (o.x !== x || o.y !== y || o.w !== w || o.h !== h || o.rot) moved++;
            o.x = x; o.y = y; o.w = w; o.h = h; delete o.rot; placed.push([x, y, w, h]); return;
        }
        drop.add(o);
    });
    if (drop.size) map.solids = S.filter(o => !drop.has(o));
    // прохідність: зсунутий / збільшений об'єкт не має перекривати прохід. Порівнюємо досяжні клітинки з мапою «до» і, поки є
    // відрізані вільні клітинки, прибираємо вирівняний об'єкт, найближчий до них.
    let cut = 0;
    if (before && before.f) for (let it = 0; it < 60; it++) {
        const now = field(map); if (!now.f) break;
        const lost = []; for (let i = 0; i < now.f.dist.length; i++) if (before.f.dist[i] >= 0 && now.g.walk[i] && now.f.dist[i] < 0) lost.push(i);
        if (!lost.length) break;
        let best = null, bd = 1e9;
        map.solids.forEach(o => {
            if (!cand.includes(o)) return;
            for (let j = 0; j < lost.length; j += Math.max(1, lost.length >> 6)) {
                const cx = (lost[j] % now.g.N + 0.5) * Nav.CS, cy = (Math.floor(lost[j] / now.g.N) + 0.5) * Nav.CS;
                const d = Math.hypot(Math.max(o.x - cx, 0, cx - (o.x + o.w)), Math.max(o.y - cy, 0, cy - (o.y + o.h)));
                if (d < bd) { bd = d; best = o; }
            }
        });
        if (!best || bd > 120) break;
        map.solids = map.solids.filter(o => o !== best); cut++;
    }
    return { moved, dropped: drop.size + cut };
}

function apply(maps, log) {
    const out = {};
    for (const k in maps) {
        const m = maps[k]; if (!Array.isArray(m.modes) || m.modes.indexOf('prophunt') < 0) continue;
        out[k] = gridify(m);
        if (log) { const inf = MO.phInfo(MO.sanitizeMap(JSON.parse(JSON.stringify(m)))); console.log('🧩 ' + k.padEnd(16), 'вирівняно', String(out[k].moved).padStart(3), '· прибрано', String(out[k].dropped).padStart(2), '· рулетка:', inf.pool.map(t => MO.nameOf(t) + '×' + inf.count[t]).join(', ')); }
    }
    return out;
}
module.exports = { apply, gridify };

if (require.main === module) {
    const fs = require('fs'), path = require('path'), FILE = path.join(__dirname, '..', 'maps_modes.js');
    const src = fs.readFileSync(FILE, 'utf8'), head = src.slice(0, src.indexOf('module.exports'));
    const maps = require(FILE);
    apply(maps, true);
    fs.writeFileSync(FILE, head + 'module.exports = ' + JSON.stringify(maps) + ';\n');
}
