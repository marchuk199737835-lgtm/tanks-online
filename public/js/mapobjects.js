/* =====================================================================
 * mapobjects.js — спільний модуль для гри (клієнт + сервер) та редактора мап.
 * Єдине джерело правди про: типи об'єктів, їх малювання, зіткнення (з поворотом),
 * авто-двері, фігурний контур мапи та перевірку (sanitize) мап.
 * Працює і в браузері (глобальна змінна MapObj), і в Node (require).
 * ===================================================================== */
var MapObj = (function () {
    'use strict';
    const D2R = Math.PI / 180;
    const DOOR_TRIGGER = 70;      // на якій відстані від дверей вони починають відкриватись
    const DOOR_PASS = 0.6;        // з якого ступеня відкриття двері вважаються прохідними

    // ---------- КАТАЛОГ ОБ'ЄКТІВ ----------
    const PROPS_BASE = [
        { id: 'prop_crate', name: 'Ящик' }, { id: 'prop_barrel', name: 'Бочка' }, { id: 'prop_sandbag', name: 'Мішки з піском' },
        { id: 'prop_rock', name: 'Камінь' }, { id: 'prop_bush', name: 'Кущ' }, { id: 'tree', name: 'Дерево' },
        { id: 'prop_cone', name: 'Конус' }, { id: 'prop_concrete', name: 'Бетонний блок' }, { id: 'prop_hedgehog', name: 'Протитанк. Їжак' },
        { id: 'prop_radar', name: 'Радар' }, { id: 'prop_tent', name: 'Намет' }, { id: 'prop_cont_red', name: 'Контейнер Ч' },
        { id: 'prop_cont_blue', name: 'Контейнер С' }, { id: 'prop_fence_wood', name: 'Дерев. паркан' }, { id: 'prop_fence_metal', name: 'Метал. паркан' },
        { id: 'prop_wreck', name: 'Знищений танк' }, { id: 'prop_tires', name: 'Шини' }, { id: 'prop_generator', name: 'Генератор' },
        { id: 'prop_spotlight', name: 'Прожектор' }, { id: 'prop_puddle', name: 'Калюжа бруду' }, { id: 'prop_crater', name: 'Воронка' }
    ];
    const PROPS_WOOD = [
        { id: 'prop_wood_log', name: 'Колода' }, { id: 'prop_wood_stump', name: 'Пеньок' }, { id: 'prop_wood_pallet', name: 'Піддон' },
        { id: 'prop_wood_barrel', name: 'Дерев\'яна бочка' }, { id: 'prop_wood_planks', name: 'Штабель дощок' }, { id: 'prop_wood_cart', name: 'Віз' },
        { id: 'prop_wood_table', name: 'Стіл' }, { id: 'prop_wood_bench', name: 'Лавка' }, { id: 'prop_wood_firewood', name: 'Дрова' },
        { id: 'prop_wood_wall', name: 'Дерев\'яна стіна' }
    ];
    const PROPS_EXTRA = [
        { id: 'prop_campfire', name: 'Багаття' }, { id: 'prop_hay', name: 'Стіг сіна' }, { id: 'prop_well', name: 'Колодязь' },
        { id: 'prop_statue', name: 'Статуя' }, { id: 'prop_crystal', name: 'Кристал' }, { id: 'prop_terminal', name: 'Термінал' },
        { id: 'prop_solar', name: 'Сонячна панель' }, { id: 'prop_pipe', name: 'Труба' }, { id: 'prop_hatch', name: 'Люк (без колізії)' },
        { id: 'prop_pad', name: 'Платформа (без колізії)' },
        { id: 'prop_floor', name: 'Підлога будівлі (без колізії)' }, { id: 'prop_roof', name: 'Дах будівлі (зникає всередині)' },
        // руйнівні об'єкти для міст / будівель (телецентр, офіси)
        { id: 'prop_gas', name: 'Газовий балон' }, { id: 'prop_glass', name: 'Скляна перегородка' }, { id: 'prop_desk', name: 'Офісний стіл' },
        { id: 'prop_monitor', name: 'Монітори' }, { id: 'prop_shelf', name: 'Стелаж' }, { id: 'prop_vending', name: 'Торговий автомат' },
        { id: 'prop_server', name: 'Серверна стійка' }, { id: 'prop_sofa', name: 'Диван' }, { id: 'prop_plant', name: 'Вазон' }
    ];
    // ---------- РУЙНІВНІ ОБ'ЄКТИ ----------
    // hp — міцність (звичайний снаряд — 75), mat — матеріал (колір уламків і звук), ex — вибух [шкода, радіус]: шкодить усім поруч і підриває сусідні бочки
    const DESTR = {
        prop_crate: { hp: 150, mat: 'wood' }, prop_wood_barrel: { hp: 110, mat: 'wood' }, prop_fence_wood: { hp: 110, mat: 'wood' }, prop_wood_wall: { hp: 300, mat: 'wood' },
        prop_wood_pallet: { hp: 80, mat: 'wood' }, prop_wood_planks: { hp: 160, mat: 'wood' }, prop_wood_table: { hp: 90, mat: 'wood' }, prop_wood_bench: { hp: 80, mat: 'wood' },
        prop_wood_cart: { hp: 220, mat: 'wood' }, prop_wood_firewood: { hp: 100, mat: 'wood' }, prop_hay: { hp: 110, mat: 'hay' }, prop_tires: { hp: 220, mat: 'rubber' },
        prop_cone: { hp: 30, mat: 'plastic' }, prop_tent: { hp: 120, mat: 'cloth' },
        prop_barrel: { hp: 60, mat: 'metal', ex: [120, 130] }, prop_gas: { hp: 40, mat: 'metal', ex: [150, 150] },
        prop_glass: { hp: 40, mat: 'glass' }, prop_desk: { hp: 120, mat: 'wood' }, prop_monitor: { hp: 50, mat: 'glass' }, prop_shelf: { hp: 160, mat: 'metal' },
        prop_vending: { hp: 220, mat: 'metal' }, prop_server: { hp: 260, mat: 'metal' }, prop_sofa: { hp: 140, mat: 'cloth' }, prop_plant: { hp: 50, mat: 'plant' }
    };
    const isDestr = o => !!(o && DESTR[o.type]);
    const _dl = new WeakMap();      // індекси руйнівних об'єктів мапи (для ланцюгових вибухів)
    function destrList(map) {
        const arr = map.solids; let e = _dl.get(arr);
        if (!e || e.n !== arr.length) { const l = []; for (let i = 0; i < arr.length; i++) if (DESTR[arr[i].type]) l.push(i); e = { n: arr.length, l }; _dl.set(arr, e); }
        return e.l;
    }
    // len — довжина, thick — товщина, leaves — кількість стулок
    const DOORS = [
        { id: 'prop_door_wood_s', name: 'Дерев\'яні малі', w: 100, h: 25, leaves: 1, style: 'wood' },
        { id: 'prop_door_wood_d', name: 'Дерев\'яні подвійні', w: 150, h: 25, leaves: 2, style: 'wood' },
        { id: 'prop_door_metal_s', name: 'Металеві малі', w: 100, h: 25, leaves: 1, style: 'metal' },
        { id: 'prop_door_metal_d', name: 'Металеві подвійні', w: 200, h: 25, leaves: 2, style: 'metal' },
        { id: 'prop_door_armor', name: 'Броньовані', w: 150, h: 30, leaves: 2, style: 'armor' },
        { id: 'prop_door_glass', name: 'Скляні', w: 150, h: 20, leaves: 2, style: 'glass' },
        { id: 'prop_door_space_s', name: 'Космічні малі', w: 100, h: 25, leaves: 2, style: 'space' },
        { id: 'prop_door_space_d', name: 'Космічні великі', w: 200, h: 30, leaves: 2, style: 'space' },
        { id: 'prop_door_space_gate', name: 'Космічні ворота', w: 300, h: 30, leaves: 2, style: 'space' }
    ];
    const DOOR_BY_ID = {}; DOORS.forEach(d => DOOR_BY_ID[d.id] = d);
    const NONSOLID = new Set(['prop_puddle', 'prop_crater', 'prop_hatch', 'prop_pad', 'prop_floor', 'prop_roof']);
    const BASE_TYPES = ['wall', 'wall_square', 'shape_line', 'line', 'shape_triangle', 'shape_rhombus', 'shape_parallelepiped', 'tree',
        'water_square', 'water_curve', 'neon_wall', 'neon_circle', 'neon_triangle', 'neon_cross', 'neon_diamond', 'neon_arch', 'neon_pillar',
        'spawn_player', 'spawn_zombie', 'spawn_powerup', 'spawn_core', 'spawn_cp', 'spawn_convoy_a', 'spawn_convoy_b'];
    const ALL_TYPES = new Set(BASE_TYPES);
    [PROPS_BASE, PROPS_WOOD, PROPS_EXTRA, DOORS].forEach(l => l.forEach(p => ALL_TYPES.add(p.id)));

    // Об'єкти, якими можуть маскуватись хованці: весь декор, дерево, «Інше» та фігури (без дверей, води й об'єктів без колізії)
    const DISGUISE_SHAPES = [
        { id: 'wall_square', name: 'Квадрат', color: '#64748b' }, { id: 'shape_triangle', name: 'Трикутник', color: '#78716c' },
        { id: 'shape_rhombus', name: 'Ромб', color: '#6b7280' }, { id: 'shape_parallelepiped', name: 'Паралелепіпед', color: '#71717a' }
    ];
    const DISGUISE_GROUPS = [
        { name: 'Декор', ids: PROPS_BASE.filter(p => !NONSOLID.has(p.id)).map(p => p.id) },
        { name: 'Дерево', ids: PROPS_WOOD.map(p => p.id) },
        { name: 'Інше', ids: PROPS_EXTRA.filter(p => !NONSOLID.has(p.id)).map(p => p.id) },
        { name: 'Фігури', ids: DISGUISE_SHAPES.map(p => p.id) }
    ];
    const DISGUISE_IDS = new Set(); DISGUISE_GROUPS.forEach(g => g.ids.forEach(id => DISGUISE_IDS.add(id)));
    // Малює маскування (декор або фігуру) у прямокутнику x,y,w,h
    function drawDisguise(c, o, t) {
        const sh = DISGUISE_SHAPES.filter(q => q.id === o.type)[0];
        if (!sh) return o.type === 'tree' ? drawTreeProp(c, o) : drawProp(c, o, t);
        const q = polyOf({ type: o.type, x: o.x, y: o.y, w: o.w, h: o.h }) || [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]];
        c.save(); c.fillStyle = sh.color; c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.lineJoin = 'round';
        c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.stroke(); c.restore();
        return true;
    }
    function drawTreeProp(c, o) {
        const cx = o.x + (o.w || 50) / 2, cy = o.y + (o.h || 50) / 2;
        c.save(); c.fillStyle = '#166534'; c.beginPath(); c.arc(cx, cy, 25, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#15803d'; c.beginPath(); c.arc(cx - 6, cy - 6, 12, 0, Math.PI * 2); c.fill(); c.restore(); return true;
    }
    const isDoor = o => typeof o.type === 'string' && o.type.indexOf('prop_door_') === 0;
    const isCircular = o => o.type === 'tree' || o.type === 'neon_circle' || o.type === 'neon_pillar';
    const isSolidType = o => !(o.type.indexOf('spawn') >= 0 || o.type === 'line' || NONSOLID.has(o.type));

    // ---------- ГЕОМЕТРІЯ ----------
    function center(o) {
        if (o.type === 'tree') return { x: o.x, y: o.y };
        return { x: o.x + (o.w || 30) / 2, y: o.y + (o.h || 30) / 2 };
    }
    // Застосувати поворот об'єкта (навколо його центру) до контексту канваса
    function applyRot(c, o) {
        if (!o.rot || o.type === 'line' || o.type === 'tree' || o.type.indexOf('spawn') >= 0) return;
        const m = center(o); c.translate(m.x, m.y); c.rotate(o.rot * D2R); c.translate(-m.x, -m.y);
    }
    // Точка (px,py) у локальній системі об'єкта (без повороту)
    function toLocal(o, px, py) {
        if (!o.rot || o.type === 'line' || o.type === 'tree') return { x: px, y: py };
        const m = center(o), a = -o.rot * D2R, cs = Math.cos(a), sn = Math.sin(a), dx = px - m.x, dy = py - m.y;
        return { x: m.x + dx * cs - dy * sn, y: m.y + dx * sn + dy * cs };
    }
    function distToSeg(px, py, ax, ay, bx, by) {
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    }
    function pointInPoly(poly, x, y) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if (((a.y > y) !== (b.y > y)) && (x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x)) inside = !inside;
        }
        return inside;
    }
    // коло радіуса r повністю всередині багатокутника
    function circleInPoly(poly, x, y, r) {
        if (!pointInPoly(poly, x, y)) return false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            if (distToSeg(x, y, poly[j].x, poly[j].y, poly[i].x, poly[i].y) < r) return false;
        }
        return true;
    }
    // Контур фігур у локальних координатах (без повороту): колізія йде точно по формі, а не по прямокутнику
    function polyOf(o) {
        const x = o.x, y = o.y, w = o.w || 30, h = o.h || 30;
        switch (o.type) {
            case 'shape_triangle': case 'neon_triangle': return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
            case 'shape_rhombus': case 'neon_diamond': return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
            case 'shape_parallelepiped': return [[x + w * 0.2, y], [x + w, y], [x + w * 0.8, y + h], [x, y + h]];
        }
        return null;
    }
    // коло (px,py,r) перетинає багатокутник
    function circleHitsPoly(poly, px, py, r) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const a = poly[i], b = poly[j];
            if (((a[1] > py) !== (b[1] > py)) && (px < (b[0] - a[0]) * (py - a[1]) / (b[1] - a[1]) + a[0])) inside = !inside;
            if (distToSeg(px, py, a[0], a[1], b[0], b[1]) <= r) return true;
        }
        return inside;
    }
    const hasShape = m => m && Array.isArray(m.shape) && m.shape.length >= 3;

    // Чи потрапляє точка в об'єкт (для редактора: вибір/гумка)
    function pointInObject(o, px, py, pad) {
        pad = pad || 0;
        if (o.type === 'line') {
            const w = (o.width || 10) / 2 + 10 + pad;
            for (let i = 1; i < o.points.length; i++) if (distToSeg(px, py, o.points[i - 1].x, o.points[i - 1].y, o.points[i].x, o.points[i].y) <= w) return true;
            return false;
        }
        if (o.type.indexOf('spawn') >= 0) return Math.hypot(px - o.x, py - o.y) <= 22 + pad;
        if (o.type === 'tree') return Math.hypot(px - o.x, py - o.y) <= (o.r || 30) + pad;
        const l = toLocal(o, px, py), w = o.w || 30, h = o.h || 30;
        return l.x >= o.x - pad && l.x <= o.x + w + pad && l.y >= o.y - pad && l.y <= o.y + h + pad;
    }

    // ---------- БІОМИ: згладжений контур (Chaikin x2) і пошук біому за точкою ----------
    // Вершини на межі мапи виносяться за її межі, щоб край біому по межі не давав м'якого переходу.
    const _bc = new WeakMap();   // кеш контурів біомів (не пишемо службові поля в самі дані мапи)
    function biomePoly(b, S) {
        S = S || 0; let e = _bc.get(b);
        if (e && e.pts === b.points && e.n === b.points.length && e.S === S) return e.sp;
        const lo = v => v <= 2 ? -600 : (S && v >= S - 2 ? S + 600 : v);
        let P = b.points.map(p => ({ x: lo(p.x), y: lo(p.y) }));
        for (let it = 0; it < 2; it++) {
            const N = []; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; N.push({ x: a.x * 0.75 + c.x * 0.25, y: a.y * 0.75 + c.y * 0.25 }, { x: a.x * 0.25 + c.x * 0.75, y: a.y * 0.25 + c.y * 0.75 }); }
            P = N;
        }
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; P.forEach(p => { if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y; });
        _bc.set(b, e = { pts: b.points, n: b.points.length, S: S, sp: P, bb: [x0, y0, x1, y1] });
        return P;
    }
    function biomeBBox(b) { const e = _bc.get(b); return e ? e.bb : null; }
    // Біом, у який потрапляє точка (пізніші біоми — зверху), або null
    function biomeAt(map, x, y) {
        const bs = map && map.biomes; if (!bs || !bs.length) return null;
        for (let i = bs.length - 1; i >= 0; i--) {
            const b = bs[i], sp = biomePoly(b, map.size), bb = biomeBBox(b);
            if (x < bb[0] || x > bb[2] || y < bb[1] || y > bb[3]) continue;
            if (pointInPoly(sp, x, y)) return b;
        }
        return null;
    }

    // ---------- ЗІТКНЕННЯ (єдина функція для клієнта і сервера) ----------
    // Геометрія одного твердого об'єкта: чи перетинає коло (x,y,r) об'єкт s
    function solidHit(s, x, y, r) {
        if (isCircular(s)) {
            const cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30);
            return Math.hypot(x - cx, y - cy) <= r + sr;
        } else if (s.type === 'water_curve') { // заокруглена вода: «капсула» (прямокутник із радіусом min(w,h)/2), а не блок
            const l = s.rot ? toLocal(s, x, y) : { x: x, y: y }, w = s.w || 30, h = s.h || 30, rr = Math.min(w, h) / 2;
            const nx = Math.max(s.x + rr, Math.min(l.x, s.x + w - rr)), ny = Math.max(s.y + rr, Math.min(l.y, s.y + h - rr));
            return Math.hypot(l.x - nx, l.y - ny) <= rr + r;
        } else if (polyOf(s)) {
            const l = s.rot ? toLocal(s, x, y) : { x: x, y: y };
            return circleHitsPoly(polyOf(s), l.x, l.y, r);
        }
        const l = s.rot ? toLocal(s, x, y) : { x: x, y: y };
        const tX = Math.max(s.x, Math.min(l.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(l.y, s.y + (s.h || 30)));
        return Math.hypot(l.x - tX, l.y - tY) <= r;
    }
    // Просторовий індекс (сітка IDX_CELL px) для великих мап: кеш у WeakMap за масивом solids, з інкрементальним доповненням.
    const IDX_MIN = 300, IDX_CELL = 200, IDX_OFF = 16, IDX_W = 1024;
    const _idx = new WeakMap();
    function idxAdd(e, s, i) {
        if (!isSolidType(s)) return;
        let cx, cy, R;
        if (isCircular(s)) { cx = s.x + (s.w ? s.w / 2 : 0); cy = s.y + (s.h ? s.h / 2 : 0); R = s.r || (s.w ? s.w / 2 : 30); }
        else { const w = s.w || 30, h = s.h || 30; cx = s.x + w / 2; cy = s.y + h / 2; R = Math.hypot(w, h) / 2; }
        R += 2;
        const a0 = Math.floor((cx - R) / IDX_CELL), a1 = Math.floor((cx + R) / IDX_CELL), b0 = Math.floor((cy - R) / IDX_CELL), b1 = Math.floor((cy + R) / IDX_CELL);
        for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) {
            const k = (a + IDX_OFF) * IDX_W + (b + IDX_OFF); let c = e.cells.get(k); if (!c) e.cells.set(k, c = []); c.push(i);
        }
    }
    function idxOf(arr) {
        let e = _idx.get(arr);
        if (e && (e.len > arr.length || (e.len > 0 && arr[e.len - 1] !== e.last))) e = null;   // масив скоротився/змінився — перебудова
        if (!e) { e = { len: 0, last: null, cells: new Map(), mark: null, stamp: 0 }; _idx.set(arr, e); }
        if (e.len < arr.length) {
            for (let i = e.len; i < arr.length; i++) idxAdd(e, arr[i], i);
            e.len = arr.length; e.last = arr[arr.length - 1]; e.mark = new Int32Array(arr.length); e.stamp = 0;
        }
        return e;
    }
    function invalidateIndex(arr) { if (arr) _idx.delete(arr); }
    // opts: { ignore:[індекси], skipWater:bool, doorOpen:(o,i)=>bool }
    function collides(map, x, y, r, opts) {
        opts = opts || {};
        const S = map.size;
        if (x - r < 0 || x + r > S || y - r < 0 || y + r > S) return true;
        if (hasShape(map) && !circleInPoly(map.shape, x, y, r)) return true;
        const arr = map.solids, ig = opts.ignore, dead = opts.dead;
        if (arr.length > IDX_MIN) {   // велика мапа: перевіряємо лише об'єкти з сусідніх клітинок
            const e = idxOf(arr), mark = e.mark, st = ++e.stamp;
            const a0 = Math.floor((x - r) / IDX_CELL), a1 = Math.floor((x + r) / IDX_CELL), b0 = Math.floor((y - r) / IDX_CELL), b1 = Math.floor((y + r) / IDX_CELL);
            for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) {
                const c = e.cells.get((a + IDX_OFF) * IDX_W + (b + IDX_OFF)); if (!c) continue;
                for (let q = 0; q < c.length; q++) {
                    const i = c[q]; if (mark[i] === st) continue; mark[i] = st;
                    if (ig && ig.length && ig.indexOf(i) >= 0) continue;
                    const s = arr[i]; if (s._dead || (dead && dead[i])) continue;
                    if (opts.skipWater && s.type.indexOf('water') >= 0) continue;
                    if (isDoor(s)) { if (opts.doorOpen ? opts.doorOpen(s, i) : (s._open || 0) >= DOOR_PASS) continue; }
                    if (solidHit(s, x, y, r)) return true;
                }
            }
            return false;
        }
        for (let i = 0; i < arr.length; i++) {
            const s = arr[i];
            if (ig && ig.length && ig.indexOf(i) >= 0) continue;
            if (!isSolidType(s) || s._dead || (dead && dead[i])) continue;
            if (opts.skipWater && s.type.indexOf('water') >= 0) continue;
            if (isDoor(s)) { if (opts.doorOpen ? opts.doorOpen(s, i) : (s._open || 0) >= DOOR_PASS) continue; }
            if (solidHit(s, x, y, r)) return true;
        }
        return false;
    }
    // індекс руйнівного об'єкта, у який влучає коло (x,y,r), або -1 (снаряд у ящик / таран)
    function destrAt(map, x, y, r, dead) {
        const arr = map.solids, l = destrList(map);
        for (let k = 0; k < l.length; k++) {
            const i = l[k], s = arr[i]; if (s._dead || (dead && dead[i])) continue;
            const cx = s.x + (s.w || 30) / 2, cy = s.y + (s.h || 30) / 2, R = Math.hypot(s.w || 30, s.h || 30) / 2 + r + 2;
            if (Math.abs(x - cx) > R || Math.abs(y - cy) > R) continue;
            if (solidHit(s, x, y, r)) return i;
        }
        return -1;
    }
    // наївна версія (без індексу) — для тестів
    function collidesNaive(map, x, y, r, opts) {
        opts = opts || {};
        const S = map.size;
        if (x - r < 0 || x + r > S || y - r < 0 || y + r > S) return true;
        if (hasShape(map) && !circleInPoly(map.shape, x, y, r)) return true;
        const arr = map.solids, ig = opts.ignore;
        for (let i = 0; i < arr.length; i++) {
            const s = arr[i];
            if (ig && ig.length && ig.indexOf(i) >= 0) continue;
            if (!isSolidType(s)) continue;
            if (opts.skipWater && s.type.indexOf('water') >= 0) continue;
            if (isDoor(s)) { if (opts.doorOpen ? opts.doorOpen(s, i) : (s._open || 0) >= DOOR_PASS) continue; }
            if (solidHit(s, x, y, r)) return true;
        }
        return false;
    }

    // ---------- АВТО-ДВЕРІ ----------
    // Чи є поряд з дверима хтось із actors ({x,y,r})
    function doorNear(o, actors) {
        const w = o.w || 100, h = o.h || 25;
        for (let k = 0; k < actors.length; k++) {
            const a = actors[k], l = toLocal(o, a.x, a.y), m = center(o);
            const ex = Math.max(Math.abs(l.x - m.x) - w / 2, 0), ey = Math.max(Math.abs(l.y - m.y) - h / 2, 0);
            if (Math.hypot(ex, ey) <= (a.r || 24) + DOOR_TRIGGER) return true;
        }
        return false;
    }
    // Анімація дверей на клієнті (стан у o._open)
    const _doorList = new WeakMap();   // список дверей мапи (раніше щокадру перебирали усі ~2000 об'єктів із перевіркою рядка)
    function doorsOf(arr) {
        let e = _doorList.get(arr);
        if (!e || e.n !== arr.length || e.last !== arr[arr.length - 1]) { const l = []; for (let i = 0; i < arr.length; i++) if (isDoor(arr[i])) l.push(arr[i]); e = { n: arr.length, last: arr[arr.length - 1], l }; _doorList.set(arr, e); }
        return e.l;
    }
    function updateDoors(map, actors, dt) {
        const arr = doorsOf(map.solids);
        for (let i = 0; i < arr.length; i++) {
            const o = arr[i];
            const target = doorNear(o, actors) ? 1 : 0, cur = o._open || 0;
            o._open = target > cur ? Math.min(1, cur + dt * 3.2) : Math.max(0, cur - dt * 2.4);
        }
    }
    function resetDoors(map) { if (map && map.solids) map.solids.forEach(o => { if (isDoor(o)) o._open = 0; }); }

    // ---------- ФІГУРНИЙ КОНТУР: допоміжне для спавнів ----------
    function shapeBounds(shape) {
        let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
        shape.forEach(p => { a = Math.min(a, p.x); b = Math.min(b, p.y); c = Math.max(c, p.x); d = Math.max(d, p.y); });
        return { x0: a, y0: b, x1: c, y1: d };
    }

    // ---------- МАЛЮВАННЯ ----------
    function wood(c, x, y, w, h, base, dark) {
        c.fillStyle = base; c.fillRect(x, y, w, h); c.strokeStyle = dark; c.lineWidth = 2; c.strokeRect(x, y, w, h);
    }
    function drawDoor(c, o, t) {
        const def = DOOR_BY_ID[o.type] || DOORS[0];
        let x = o.x, y = o.y, w = o.w || def.w, h = o.h || def.h, open = o._open || 0;
        c.save();
        if (h > w) { // вертикальні двері: малюємо як горизонтальні й повертаємо
            const cx = x + w / 2, cy = y + h / 2; c.translate(cx, cy); c.rotate(Math.PI / 2); const tw = w; w = h; h = tw; x = -w / 2; y = -h / 2;
        }
        const st = def.style, n = def.leaves, leafLen = w / n, thick = h;
        // рейки / рама
        const frame = { wood: '#451a03', metal: '#334155', armor: '#1e293b', glass: '#475569', space: '#020617' }[st];
        c.fillStyle = frame; c.fillRect(x - 3, y - 2, w + 6, h + 4);
        if (st === 'space') { c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.shadowColor = '#22d3ee'; c.shadowBlur = 8; c.strokeRect(x - 3, y - 2, w + 6, h + 4); c.shadowBlur = 0; }
        // стулки: при відкритті «заїжджають» у бік (скорочуються до зовнішнього краю)
        for (let i = 0; i < n; i++) {
            const full = leafLen, vis = Math.max(2, full * (1 - 0.94 * open));
            const px = (i === 0 || n === 1) ? x : x + w - vis;
            c.save();
            c.beginPath(); c.rect(px, y, vis, h); c.clip();
            if (st === 'wood') {
                c.fillStyle = '#92400e'; c.fillRect(px, y, vis, h);
                c.strokeStyle = '#78350f'; c.lineWidth = 1.5;
                for (let k = 0; k < 4; k++) { const yy = y + (h / 4) * k; c.beginPath(); c.moveTo(px, yy); c.lineTo(px + vis, yy); c.stroke(); }
                c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(n === 1 ? px + vis - 8 : (i === 0 ? px + vis - 6 : px + 6), y + h / 2, 3, 0, 7); c.fill();
            } else if (st === 'metal') {
                c.fillStyle = '#94a3b8'; c.fillRect(px, y, vis, h);
                c.strokeStyle = '#64748b'; c.lineWidth = 1.5;
                for (let k = 8; k < vis; k += 14) { c.beginPath(); c.moveTo(px + k, y + 2); c.lineTo(px + k, y + h - 2); c.stroke(); }
                c.strokeRect(px + 1, y + 1, vis - 2, h - 2);
            } else if (st === 'armor') {
                c.fillStyle = '#475569'; c.fillRect(px, y, vis, h);
                c.fillStyle = '#facc15';
                for (let k = -h; k < vis; k += 16) { c.beginPath(); c.moveTo(px + k, y + h); c.lineTo(px + k + 8, y + h); c.lineTo(px + k + 8 + h, y); c.lineTo(px + k + h, y); c.fill(); }
                c.fillStyle = '#1e293b'; c.fillRect(px, y + h * 0.3, vis, h * 0.4);
                c.fillStyle = '#94a3b8'; for (let k = 6; k < vis; k += 18) { c.beginPath(); c.arc(px + k, y + h / 2, 2.2, 0, 7); c.fill(); }
            } else if (st === 'glass') {
                c.fillStyle = 'rgba(125,211,252,0.35)'; c.fillRect(px, y, vis, h);
                c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.5; c.strokeRect(px + 0.5, y + 0.5, vis - 1, h - 1);
                c.strokeStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(px + vis * 0.2, y + h); c.lineTo(px + vis * 0.45, y); c.stroke();
            } else { // space
                c.fillStyle = '#0f172a'; c.fillRect(px, y, vis, h);
                c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.shadowColor = '#22d3ee'; c.shadowBlur = 6; c.strokeRect(px + 1, y + 1, vis - 2, h - 2);
                c.shadowBlur = 0; c.fillStyle = '#38bdf8';
                for (let k = 10; k < vis - 6; k += 22) c.fillRect(px + k, y + h / 2 - 1.5, 10, 3);
            }
            c.restore();
        }
        // індикатор: червоний — зачинено, зелений — відчинено
        const ind = open > 0.5 ? '#22c55e' : '#ef4444';
        c.fillStyle = ind; c.shadowColor = ind; c.shadowBlur = 6; c.beginPath(); c.arc(x + w / 2, y - 6, 3, 0, 7); c.fill(); c.shadowBlur = 0;
        c.restore();
    }

    // ----- підлога й дах будівлі -----
    const _tn = Object.create(null);
    function tint(hex, k) {   // k<1 — темніше, k>1 — світліше (до білого)
        const key = hex + '|' + k; if (_tn[key]) return _tn[key];
        const n = parseInt(String(hex || '#808080').slice(1, 7), 16), v = isNaN(n) ? 0x808080 : n, r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255; let R, G, B;
        if (k <= 1) { R = r * k; G = g * k; B = b * k; } else { const t = Math.min(1, k - 1); R = r + (255 - r) * t; G = g + (255 - g) * t; B = b + (255 - b) * t; }
        return (_tn[key] = 'rgb(' + (R | 0) + ',' + (G | 0) + ',' + (B | 0) + ')');
    }
    function srand(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    const seedOf = o => ((Math.round(o.x) * 73856093) ^ (Math.round(o.y) * 19349663)) >>> 0;
    const PLANK_K = [0.86, 0.92, 0.97, 1, 1.04, 1.09, 1.14];
    function drawFloor(c, o) {
        const x = o.x, y = o.y, w = o.w || 50, h = o.h || 50, base = o.color || '#a8763e';
        c.fillStyle = base; c.fillRect(x, y, w, h);
        c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
        if (o.neon) {   // плитка-шахматка color/neon
            const T = 40; c.fillStyle = o.neon;
            for (let iy = 0; iy * T < h; iy++) for (let ix = 0; ix * T < w; ix++) if ((ix + iy) & 1) c.fillRect(x + ix * T, y + iy * T, T, T);
            c.strokeStyle = 'rgba(0,0,0,0.16)'; c.lineWidth = 1; c.beginPath();
            for (let ix = 1; ix * T < w; ix++) { c.moveTo(x + ix * T, y); c.lineTo(x + ix * T, y + h); }
            for (let iy = 1; iy * T < h; iy++) { c.moveTo(x, y + iy * T); c.lineTo(x + w, y + iy * T); }
            c.stroke();
        } else if (o.fs === 'plate') {      // металеві плити 80 px зі швами й заклепками (склади, цехи, космос)
            const T = 80, R = srand(seedOf(o));
            for (let iy = 0; iy * T < h; iy++) for (let ix = 0; ix * T < w; ix++) { c.fillStyle = tint(base, 0.9 + R() * 0.2); c.fillRect(x + ix * T, y + iy * T, T, T); }
            c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2; c.beginPath();
            for (let ix = 1; ix * T < w; ix++) { c.moveTo(x + ix * T, y); c.lineTo(x + ix * T, y + h); }
            for (let iy = 1; iy * T < h; iy++) { c.moveTo(x, y + iy * T); c.lineTo(x + w, y + iy * T); }
            c.stroke(); c.fillStyle = 'rgba(255,255,255,0.22)';
            for (let iy = 0; iy * T < h; iy++) for (let ix = 0; ix * T < w; ix++) { const px = x + ix * T, py = y + iy * T; c.fillRect(px + 6, py + 6, 3, 3); c.fillRect(px + T - 9, py + 6, 3, 3); c.fillRect(px + 6, py + T - 9, 3, 3); c.fillRect(px + T - 9, py + T - 9, 3, 3); }
        } else if (o.fs === 'tile') {       // світла плитка 40 px (хол, їдальня, крамниці)
            const T = 40, R = srand(seedOf(o));
            for (let iy = 0; iy * T < h; iy++) for (let ix = 0; ix * T < w; ix++) { c.fillStyle = tint(base, ((ix + iy) & 1 ? 0.94 : 1.03) + R() * 0.03); c.fillRect(x + ix * T, y + iy * T, T, T); }
            c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 1; c.beginPath();
            for (let ix = 1; ix * T < w; ix++) { c.moveTo(x + ix * T, y); c.lineTo(x + ix * T, y + h); }
            for (let iy = 1; iy * T < h; iy++) { c.moveTo(x, y + iy * T); c.lineTo(x + w, y + iy * T); }
            c.stroke();
        } else if (o.fs === 'carpet') {     // ковролін: однотонний із дрібною фактурою (офіси, студії)
            const R = srand(seedOf(o)), n = Math.min(900, Math.round(w * h / 300));
            for (let k = 0; k < n; k++) { c.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)'; c.fillRect(x + R() * w, y + R() * h, 2, 2); }
        } else {        // дерев'яні дошки вздовж довшої осі
            const R = srand(seedOf(o)), horiz = w >= h, len = horiz ? w : h, wid = horiz ? h : w, RH = 22;
            c.beginPath();
            for (let p = 0; p < wid; p += RH) {
                const rh = Math.min(RH, wid - p); let q = -R() * 150;
                while (q < len) {
                    const l = 110 + R() * 90, a = Math.max(q, 0), b2 = Math.min(q + l, len);
                    if (b2 > a) { c.fillStyle = tint(base, PLANK_K[(R() * 7) | 0]); if (horiz) c.fillRect(x + a, y + p, b2 - a, rh); else c.fillRect(x + p, y + a, rh, b2 - a); }
                    if (q + l < len && q + l > 0) { if (horiz) { c.moveTo(x + q + l, y + p); c.lineTo(x + q + l, y + p + rh); } else { c.moveTo(x + p, y + q + l); c.lineTo(x + p + rh, y + q + l); } }
                    q += l;
                }
                if (horiz) { c.moveTo(x, y + p); c.lineTo(x + w, y + p); } else { c.moveTo(x + p, y); c.lineTo(x + p, y + h); }
            }
            c.strokeStyle = 'rgba(30,14,4,0.5)'; c.lineWidth = 1.3; c.stroke();
            c.strokeStyle = 'rgba(255,255,255,0.07)'; c.lineWidth = 1; c.beginPath();
            for (let p = 1; p < wid; p += RH) { if (horiz) { c.moveTo(x, y + p + 1); c.lineTo(x + w, y + p + 1); } else { c.moveTo(x + p + 1, y); c.lineTo(x + p + 1, y + h); } }
            c.stroke();
        }
        c.strokeStyle = 'rgba(0,0,0,0.11)'; [44, 30, 16].forEach(lw => { c.lineWidth = lw; c.strokeRect(x, y, w, h); });   // внутрішня тінь від стін
        c.restore();
    }
    // дах: горизонтальний гребінь (довша вісь); для вертикального повертаємо на -90° (світла сторона — західна)
    function drawRoof(c, o) {
        const x = o.x, y = o.y, w = o.w || 50, h = o.h || 50, base = o.color || '#b5593c', m = Math.min(w, h);
        if (o._a !== undefined) c.globalAlpha *= o._a;
        if (c.globalAlpha < 0.01) return;
        const sx = Math.min(26, m * 0.14), sy = Math.min(34, m * 0.18);
        c.fillStyle = 'rgba(0,0,0,0.13)'; c.fillRect(x + sx * 0.5, y + sy * 0.5, w, h);
        c.fillStyle = 'rgba(0,0,0,0.17)'; c.fillRect(x + sx, y + sy, w, h);
        const horiz = w >= h, L = horiz ? w : h, H = horiz ? h : w, cx = x + w / 2, cy = y + h / 2, x0 = cx - L / 2, y0 = cy - H / 2, ry = y0 + H / 2;
        if (!horiz) { c.translate(cx, cy); c.rotate(-Math.PI / 2); c.translate(-cx, -cy); }
        // два скати
        let g = c.createLinearGradient(0, ry, 0, y0); g.addColorStop(0, tint(base, 1.22)); g.addColorStop(1, tint(base, 1.02));
        c.fillStyle = g; c.fillRect(x0, y0, L, H / 2);
        g = c.createLinearGradient(0, ry, 0, y0 + H); g.addColorStop(0, tint(base, 0.86)); g.addColorStop(1, tint(base, 0.66));
        c.fillStyle = g; c.fillRect(x0, ry, L, H / 2);
        // ряди черепиці/дощок зі зсувом
        const RW = 13; c.lineWidth = 1; c.strokeStyle = 'rgba(0,0,0,0.20)'; c.beginPath();
        for (let d = RW, k = 0; d < H / 2 - 2; d += RW, k++) {
            c.moveTo(x0, ry - d); c.lineTo(x0 + L, ry - d); c.moveTo(x0, ry + d); c.lineTo(x0 + L, ry + d);
            for (let t = (k & 1) * 11 + 6; t < L - 2; t += 22) { c.moveTo(x0 + t, ry - d); c.lineTo(x0 + t, ry - d + RW); c.moveTo(x0 + t, ry + d); c.lineTo(x0 + t, ry + d - RW); }
        }
        c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.09)'; c.beginPath();
        for (let d = RW; d < H / 2 - 2; d += RW) { c.moveTo(x0, ry - d + 1.5); c.lineTo(x0 + L, ry - d + 1.5); c.moveTo(x0, ry + d + 1.5); c.lineTo(x0 + L, ry + d + 1.5); }
        c.stroke();
        // сніг / мох (кольор stripe) плямистою шапкою від гребеня
        if (o.stripe) {
            const R = srand(seedOf(o) ^ 0x9e3779b1), lobes = [];
            for (let t = 4; t < L - 4; t += 15) for (let sd = -1; sd <= 1; sd += 2) lobes.push([x0 + t + R() * 6, sd, (H / 2) * (0.22 + R() * 0.3), 12 + R() * 9]);
            c.fillStyle = 'rgba(0,0,0,0.16)'; lobes.forEach(b => { c.beginPath(); c.ellipse(b[0] + 2, ry + b[1] * b[2] / 2 + 3, b[3], b[2] / 2 + 3, 0, 0, 6.2832); c.fill(); });
            c.fillStyle = o.stripe; lobes.forEach(b => { c.beginPath(); c.ellipse(b[0], ry + b[1] * b[2] / 2, b[3], b[2] / 2 + 2, 0, 0, 6.2832); c.fill(); });
            c.fillStyle = tint(o.stripe, 0.88); lobes.forEach((b, i) => { if (i % 3) return; c.beginPath(); c.ellipse(b[0] + 3, ry + b[1] * (b[2] * 0.62), b[3] * 0.5, b[2] * 0.14, 0, 0, 6.2832); c.fill(); });
            c.fillStyle = o.stripe; for (let i = 0; i < Math.round(L / 60); i++) { const px = x0 + 20 + R() * (L - 40), py = ry + (R() < 0.5 ? -1 : 1) * (H / 2 * (0.55 + R() * 0.35)); c.beginPath(); c.ellipse(px, py, 10 + R() * 14, 5 + R() * 6, R(), 0, 6.2832); c.fill(); }
        }
        // гребінь із бліком
        c.lineCap = 'round'; c.strokeStyle = tint(base, 0.55); c.lineWidth = 8; c.beginPath(); c.moveTo(x0 + 5, ry + 0.5); c.lineTo(x0 + L - 5, ry + 0.5); c.stroke();
        c.strokeStyle = o.stripe ? o.stripe : tint(base, 1.4); c.lineWidth = 3; c.beginPath(); c.moveTo(x0 + 6, ry - 1.5); c.lineTo(x0 + L - 6, ry - 1.5); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0 + L * 0.22, ry - 2); c.lineTo(x0 + L * 0.22 + Math.min(40, L * 0.14), ry - 2); c.stroke();
        c.lineCap = 'butt';
        // карниз: виступ, світлий кант з NW і темний з SE, внутрішня лінія
        c.lineJoin = 'miter'; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.strokeRect(x0, y0, L, H);
        c.strokeStyle = 'rgba(0,0,0,0.20)'; c.lineWidth = 2; c.strokeRect(x0 + 6, y0 + 6, L - 12, H - 12);
        c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0 + 1.5, y0 + H - 1.5); c.lineTo(x0 + 1.5, y0 + 1.5); c.lineTo(x0 + L - 1.5, y0 + 1.5); c.stroke();
    }

    // Малює декор/двері. Повертає true, якщо тип відомий. Поворот (o.rot) застосовує викликаючий.
    function drawProp(c, o, t) {
        t = t || 0;
        const x = o.x, y = o.y, w = o.w || 50, h = o.h || 50, cx = x + w / 2, cy = y + h / 2;
        if (isDoor(o)) { drawDoor(c, o, t); return true; }
        c.save();
        let ok = true;
        switch (o.type) {
            // ===== базові (перенесені з гри) =====
            case 'prop_crate':
                c.fillStyle = '#b45309'; c.fillRect(x, y, w, h); c.strokeStyle = '#78350f'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
                c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke(); break;
            case 'prop_barrel':
                c.fillStyle = '#dc2626'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) / 2, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#991b1b'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) / 2 - 4, 0, Math.PI * 2); c.fill(); break;
            case 'prop_sandbag':
                c.fillStyle = '#d4a373'; c.strokeStyle = '#a68a64'; c.lineWidth = 2;
                c.beginPath(); c.roundRect(x, y, w, h / 2, 10); c.fill(); c.stroke();
                c.beginPath(); c.roundRect(x + 5, y + h / 2, w - 10, h / 2, 10); c.fill(); c.stroke(); break;
            case 'prop_rock':
                c.fillStyle = '#52525b'; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h / 3); c.lineTo(x + w * 0.8, y + h); c.lineTo(x + w * 0.2, y + h); c.lineTo(x, y + h / 2); c.fill(); break;
            case 'prop_bush': {   // кущ: темна основа, три гілки-кулі, світлі відблиски
                const bl = (bx, by, br, col) => { c.fillStyle = col; c.beginPath(); c.arc(bx, by, br, 0, Math.PI * 2); c.fill(); };
                bl(x + w * 0.35, y + h * 0.4, w * 0.36, '#14532d'); bl(x + w * 0.66, y + h * 0.42, w * 0.34, '#14532d'); bl(x + w * 0.5, y + h * 0.68, w * 0.34, '#14532d');
                bl(x + w * 0.35, y + h * 0.36, w * 0.28, '#166534'); bl(x + w * 0.66, y + h * 0.38, w * 0.26, '#15803d'); bl(x + w * 0.5, y + h * 0.62, w * 0.25, '#166534');
                bl(x + w * 0.3, y + h * 0.3, w * 0.12, '#4ade80'); bl(x + w * 0.62, y + h * 0.32, w * 0.08, '#86efac');
                c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.arc(x + w * 0.58, y + h * 0.78, w * 0.16, 0, Math.PI * 2); c.fill(); break; }
            case 'prop_cone':
                c.fillStyle = '#ea580c'; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill();
                c.fillStyle = '#fff'; c.fillRect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.2); break;
            case 'prop_concrete':
                c.fillStyle = '#a1a1aa'; c.fillRect(x, y, w, h); c.strokeStyle = '#71717a'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, w - 4, h - 4); break;
            case 'prop_hedgehog':
                c.strokeStyle = '#71717a'; c.lineWidth = 4; c.lineCap = 'round';
                c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
                c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke(); break;
            case 'prop_radar':
                c.fillStyle = '#334155'; c.beginPath(); c.arc(cx, cy, w / 2, 0, Math.PI * 2); c.fill();
                c.translate(cx, cy); c.rotate(t * 2); c.strokeStyle = '#10b981'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, 0); c.stroke(); break;
            case 'prop_tent': {   // намет: два скати даху, гребінь, розтяжки й вхід
                const hh = h / 2;
                c.fillStyle = '#5d7a3a'; c.fillRect(x, y, w, hh); c.fillStyle = '#44602a'; c.fillRect(x, y + hh, w, hh);
                c.fillStyle = 'rgba(255,255,255,0.14)'; c.fillRect(x, y, w, 3); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x, y + h - 3, w, 3);
                c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1.5; c.beginPath(); for (let k = 1; k < 5; k++) { c.moveTo(x + w * k / 5, y); c.lineTo(x + w * k / 5, y + h); } c.stroke();
                c.fillStyle = '#2b3d1a'; c.fillRect(x - 1, y + hh - 2, w + 2, 4);
                c.fillStyle = '#1a2810'; c.beginPath(); c.moveTo(x + w / 2 - 14, y + h); c.lineTo(x + w / 2, y + h - 22); c.lineTo(x + w / 2 + 14, y + h); c.fill();
                c.strokeStyle = 'rgba(210,200,160,0.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 10, y - 8); c.moveTo(x + w, y); c.lineTo(x + w + 10, y - 8); c.stroke(); break; }
            case 'prop_cont_red':
            case 'prop_cont_blue':
                c.fillStyle = o.type === 'prop_cont_red' ? '#dc2626' : '#2563eb'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
                for (let l = x + 10; l < x + w; l += 15) { c.beginPath(); c.moveTo(l, y); c.lineTo(l, y + h); c.stroke(); } break;
            case 'prop_fence_wood':
                c.fillStyle = '#78350f'; c.fillRect(x, y + h / 2 - 2, w, 4);
                for (let f = x; f <= x + w; f += 20) { c.beginPath(); c.arc(f, y + h / 2, 4, 0, Math.PI * 2); c.fill(); } break;
            case 'prop_fence_metal':
                c.fillStyle = '#94a3b8'; c.fillRect(x, y + h / 2 - 1, w, 2); c.setLineDash([5, 5]); c.strokeStyle = '#94a3b8';
                c.beginPath(); c.moveTo(x, y + h / 2 - 5); c.lineTo(x + w, y + h / 2 - 5); c.stroke();
                c.beginPath(); c.moveTo(x, y + h / 2 + 5); c.lineTo(x + w, y + h / 2 + 5); c.stroke(); break;
            case 'prop_wreck': {   // згорілий корпус: іржа, гусениці, обгоріла башта, зламаний ствол
                c.fillStyle = '#2b2623'; c.fillRect(x, y + h * 0.08, w, h * 0.22); c.fillRect(x, y + h * 0.7, w, h * 0.22);
                c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1; c.beginPath(); for (let k = 6; k < w; k += 9) { c.moveTo(x + k, y + h * 0.08); c.lineTo(x + k, y + h * 0.3); c.moveTo(x + k, y + h * 0.7); c.lineTo(x + k, y + h * 0.92); } c.stroke();
                const gr = c.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(0, '#5a4a3f'); gr.addColorStop(1, '#2f2723'); c.fillStyle = gr; c.fillRect(x + 4, y + h * 0.26, w - 8, h * 0.48);
                c.fillStyle = 'rgba(154,77,47,0.45)'; c.fillRect(x + 8, y + h * 0.3, w * 0.3, h * 0.2); c.fillRect(x + w * 0.62, y + h * 0.5, w * 0.22, h * 0.16);
                c.fillStyle = '#17120f'; c.beginPath(); c.arc(cx - w * 0.05, cy, Math.min(w, h) * 0.26, 0, Math.PI * 2); c.fill();
                c.fillStyle = 'rgba(0,0,0,0.45)'; c.beginPath(); c.arc(cx - w * 0.05, cy, Math.min(w, h) * 0.14, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#17120f'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - w * 0.05, cy); c.lineTo(x + w * 0.9, y + h * 0.78); c.stroke(); c.lineCap = 'butt';
                c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x + w * 0.25, y + h * 0.62, w * 0.14, h * 0.1, 0, 0, Math.PI * 2); c.fill(); break; }
            case 'prop_tires':
                c.fillStyle = '#171717'; c.beginPath(); c.arc(cx, cy, w / 2, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#27272a'; c.beginPath(); c.arc(cx, cy, w / 3, 0, Math.PI * 2); c.fill(); break;
            case 'prop_generator':
                c.fillStyle = '#eab308'; c.fillRect(x, y, w, h); c.fillStyle = '#171717'; c.fillRect(x + 5, y + 5, w - 10, h / 2); break;
            case 'prop_spotlight':
                c.fillStyle = '#d4d4d8'; c.beginPath(); c.arc(cx, cy, 10, 0, Math.PI * 2); c.fill();
                c.translate(cx, cy); c.rotate(Math.sin(t) * 0.5);
                c.fillStyle = 'rgba(253, 224, 71, 0.2)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(150, -40); c.lineTo(150, 40); c.fill(); break;
            case 'prop_puddle':
                c.fillStyle = '#451a03'; c.beginPath(); c.ellipse(cx, cy, w / 2, h / 3, Math.PI / 4, 0, Math.PI * 2); c.fill(); break;
            case 'prop_crater':
                c.fillStyle = '#27272a'; c.beginPath(); c.arc(cx, cy, w / 2, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#09090b'; c.beginPath(); c.arc(cx, cy, w / 3, 0, Math.PI * 2); c.fill(); break;

            // ===== ДЕРЕВО (10) =====
            case 'prop_wood_log': { // колода: бічний вигляд із торцем
                c.fillStyle = '#7c4a21'; c.beginPath(); c.roundRect(x, y + h * 0.1, w, h * 0.8, h * 0.4); c.fill();
                c.strokeStyle = '#5b3416'; c.lineWidth = 2; c.stroke();
                c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5;
                for (let k = 1; k < 4; k++) { const yy = y + h * (0.2 + k * 0.15); c.beginPath(); c.moveTo(x + h * 0.5, yy); c.lineTo(x + w - 6, yy); c.stroke(); }
                c.fillStyle = '#d6a566'; c.beginPath(); c.ellipse(x + h * 0.4, cy, h * 0.28, h * 0.4, 0, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#8b5a2b'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x + h * 0.4, cy, h * 0.16, h * 0.24, 0, 0, Math.PI * 2); c.stroke(); break; }
            case 'prop_wood_stump': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#4a2c12'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#c99358'; c.beginPath(); c.arc(cx, cy, r - 4, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#8a5a2a'; c.lineWidth = 1.5;
                for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(cx, cy, (r - 4) * k / 3.6, 0, Math.PI * 2); c.stroke(); } break; }
            case 'prop_wood_pallet': {
                c.fillStyle = '#a16207'; c.strokeStyle = '#713f12'; c.lineWidth = 2;
                const n = 4, sl = h / n;
                for (let k = 0; k < n; k++) { c.fillRect(x, y + k * sl + 2, w, sl - 4); c.strokeRect(x, y + k * sl + 2, w, sl - 4); }
                c.fillStyle = '#713f12'; c.fillRect(x + w * 0.1, y, 7, h); c.fillRect(x + w * 0.5 - 3, y, 7, h); c.fillRect(x + w * 0.9 - 7, y, 7, h); break; }
            case 'prop_wood_barrel': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#92400e'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#451a03'; c.lineWidth = 1.5;
                for (let a = 0; a < 6; a++) { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a * Math.PI / 3) * r, cy + Math.sin(a * Math.PI / 3) * r); c.stroke(); }
                c.strokeStyle = '#94a3b8'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r - 3, 0, Math.PI * 2); c.stroke();
                c.beginPath(); c.arc(cx, cy, r * 0.55, 0, Math.PI * 2); c.stroke(); break; }
            case 'prop_wood_planks': {
                const cols = ['#b07a3a', '#9a6a30', '#c28a46', '#a37236'];
                const n = Math.max(3, Math.round(h / 10)), sl = h / n;
                for (let k = 0; k < n; k++) { c.fillStyle = cols[k % 4]; c.fillRect(x + (k % 2) * 3, y + k * sl, w - 3, sl - 1.5); }
                c.strokeStyle = '#5b3416'; c.lineWidth = 2; c.strokeRect(x, y, w, h); break; }
            case 'prop_wood_cart': {
                c.fillStyle = '#7c4a21'; c.fillRect(x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76);
                c.strokeStyle = '#4a2c12'; c.lineWidth = 2; c.strokeRect(x + w * 0.08, y + h * 0.12, w * 0.84, h * 0.76);
                c.fillStyle = '#b8864a'; c.fillRect(x + w * 0.16, y + h * 0.22, w * 0.68, h * 0.56);
                c.fillStyle = '#1c1917';
                [[0.08, 0.12], [0.92, 0.12], [0.08, 0.88], [0.92, 0.88]].forEach(p => { c.beginPath(); c.arc(x + w * p[0], y + h * p[1], Math.min(w, h) * 0.13, 0, Math.PI * 2); c.fill(); });
                c.strokeStyle = '#4a2c12'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, cy); c.lineTo(x + w * 0.08, cy); c.stroke(); break; }
            case 'prop_wood_table': {
                c.fillStyle = '#6b3f1b'; [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(p => c.fillRect(x + p[0] * (w - 8), y + p[1] * (h - 8), 8, 8));
                c.fillStyle = '#a0692f'; c.fillRect(x + 3, y + 3, w - 6, h - 6); c.strokeStyle = '#6b3f1b'; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
                c.fillStyle = '#e5e7eb'; c.beginPath(); c.arc(cx - w * 0.2, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(cx + w * 0.2, cy, Math.min(w, h) * 0.12, 0, Math.PI * 2); c.fill(); break; }
            case 'prop_wood_bench': {
                c.fillStyle = '#5b3416'; c.fillRect(x + 6, y + h * 0.7, 6, h * 0.3); c.fillRect(x + w - 12, y + h * 0.7, 6, h * 0.3);
                c.fillStyle = '#b07a3a'; c.fillRect(x, y + h * 0.1, w, h * 0.3); c.fillRect(x, y + h * 0.45, w, h * 0.3);
                c.strokeStyle = '#6b3f1b'; c.lineWidth = 1.5; c.strokeRect(x, y + h * 0.1, w, h * 0.3); c.strokeRect(x, y + h * 0.45, w, h * 0.3); break; }
            case 'prop_wood_firewood': {
                const r = Math.max(6, Math.min(w, h) / 5);
                const rows = [3, 2, 1];
                rows.forEach((cnt, ri) => { for (let k = 0; k < cnt; k++) {
                    const px = cx + (k - (cnt - 1) / 2) * r * 2.1, py = y + h - r - ri * r * 1.8 - 2;
                    c.fillStyle = '#7c4a21'; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
                    c.fillStyle = '#d6a566'; c.beginPath(); c.arc(px, py, r * 0.7, 0, Math.PI * 2); c.fill();
                    c.strokeStyle = '#8a5a2a'; c.lineWidth = 1; c.beginPath(); c.arc(px, py, r * 0.35, 0, Math.PI * 2); c.stroke(); } }); break; }
            case 'prop_wood_wall': {
                const n = Math.max(2, Math.round(h / 12)), sl = h / n;
                for (let k = 0; k < n; k++) { c.fillStyle = k % 2 ? '#8a5a2b' : '#9a6a35'; c.fillRect(x, y + k * sl, w, sl); c.strokeStyle = '#4a2c12'; c.lineWidth = 1.5; c.strokeRect(x, y + k * sl, w, sl); }
                c.fillStyle = '#292524'; for (let nx = x + 12; nx < x + w - 6; nx += 28) { c.beginPath(); c.arc(nx, y + 5, 1.8, 0, 7); c.fill(); c.beginPath(); c.arc(nx, y + h - 5, 1.8, 0, 7); c.fill(); } break; }

            // ===== ІНШЕ (10) =====
            case 'prop_campfire': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#44403c'; for (let a = 0; a < 8; a++) { c.beginPath(); c.arc(cx + Math.cos(a * Math.PI / 4) * r * 0.78, cy + Math.sin(a * Math.PI / 4) * r * 0.78, r * 0.2, 0, Math.PI * 2); c.fill(); }
                c.strokeStyle = '#5b3416'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - r * 0.5, cy + r * 0.4); c.lineTo(cx + r * 0.5, cy - r * 0.4); c.moveTo(cx - r * 0.5, cy - r * 0.4); c.lineTo(cx + r * 0.5, cy + r * 0.4); c.stroke();
                const fl = 1 + Math.sin(t * 9 + x) * 0.15; c.shadowColor = '#f97316'; c.shadowBlur = 18;
                c.fillStyle = '#ea580c'; c.beginPath(); c.arc(cx, cy, r * 0.42 * fl, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#fbbf24'; c.beginPath(); c.arc(cx, cy, r * 0.26 * (2 - fl), 0, Math.PI * 2); c.fill(); break; }
            case 'prop_hay': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#ca8a04'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#a16207'; c.lineWidth = 1.5; c.beginPath();
                for (let a = 0; a < 20; a += 0.2) { const rr = r * a / 20; c.lineTo(cx + Math.cos(a * 1.6) * rr, cy + Math.sin(a * 1.6) * rr); } c.stroke();
                c.strokeStyle = '#78350f'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r - 2, 0, Math.PI * 2); c.stroke(); break; }
            case 'prop_well': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#78716c'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#57534e'; c.lineWidth = 2; for (let a = 0; a < 12; a++) { c.beginPath(); c.moveTo(cx + Math.cos(a * Math.PI / 6) * r * 0.7, cy + Math.sin(a * Math.PI / 6) * r * 0.7); c.lineTo(cx + Math.cos(a * Math.PI / 6) * r, cy + Math.sin(a * Math.PI / 6) * r); c.stroke(); }
                c.fillStyle = '#0c4a6e'; c.beginPath(); c.arc(cx, cy, r * 0.62, 0, Math.PI * 2); c.fill();
                c.strokeStyle = 'rgba(147,197,253,' + (0.4 + Math.sin(t * 3) * 0.2) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r * (0.2 + (t * 0.3 % 0.35)), 0, Math.PI * 2); c.stroke(); break; }
            case 'prop_statue': {
                c.fillStyle = '#57534e'; c.fillRect(x, y, w, h); c.strokeStyle = '#292524'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
                c.fillStyle = '#d6d3d1'; c.beginPath(); c.arc(cx, cy - h * 0.1, Math.min(w, h) * 0.17, 0, Math.PI * 2); c.fill();
                c.fillRect(cx - w * 0.2, cy + h * 0.02, w * 0.4, h * 0.3); c.fillRect(cx - w * 0.34, cy + h * 0.02, w * 0.14, h * 0.07); c.fillRect(cx + w * 0.2, cy + h * 0.02, w * 0.14, h * 0.07); break; }
            case 'prop_crystal': {
                const g = 12 + Math.sin(t * 2 + x) * 6; c.shadowColor = '#22d3ee'; c.shadowBlur = g;
                const cr = (px, py, sw, sh, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(px, py - sh); c.lineTo(px + sw, py); c.lineTo(px, py + sh * 0.5); c.lineTo(px - sw, py); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.2; c.stroke(); };
                cr(cx - w * 0.2, cy + h * 0.1, w * 0.17, h * 0.3, '#0e7490'); cr(cx + w * 0.22, cy + h * 0.12, w * 0.15, h * 0.26, '#155e75'); cr(cx, cy - h * 0.02, w * 0.22, h * 0.42, '#22d3ee'); break; }
            case 'prop_terminal': {
                c.fillStyle = '#1e293b'; c.fillRect(x, y, w, h); c.strokeStyle = '#475569'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
                c.fillStyle = '#022c22'; c.fillRect(x + 5, y + 5, w - 10, h * 0.5);
                c.fillStyle = '#34d399'; for (let k = 0; k < 4; k++) { const ww = (w - 18) * (0.4 + 0.5 * Math.abs(Math.sin(t * 1.3 + k * 1.7 + x))); c.fillRect(x + 8, y + 8 + k * (h * 0.5 - 8) / 4, ww, 2.5); }
                const bl = Math.sin(t * 6) > 0 ? '#ef4444' : '#7f1d1d'; c.fillStyle = bl; c.beginPath(); c.arc(x + w - 8, y + h - 8, 3, 0, 7); c.fill();
                c.fillStyle = '#334155'; for (let k = 0; k < 4; k++) c.fillRect(x + 6 + k * (w - 12) / 4, y + h * 0.68, (w - 12) / 4 - 3, h * 0.18); break; }
            case 'prop_solar': {
                c.fillStyle = '#1e3a8a'; c.fillRect(x, y, w, h); c.strokeStyle = '#93c5fd'; c.lineWidth = 1.2;
                for (let k = 1; k < 4; k++) { c.beginPath(); c.moveTo(x + w * k / 4, y); c.lineTo(x + w * k / 4, y + h); c.stroke(); c.beginPath(); c.moveTo(x, y + h * k / 4); c.lineTo(x + w, y + h * k / 4); c.stroke(); }
                c.strokeStyle = '#cbd5e1'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
                c.fillStyle = 'rgba(255,255,255,0.12)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + w * 0.5, y); c.lineTo(x, y + h * 0.5); c.fill(); break; }
            case 'prop_pipe': {
                const hor = w >= h, len = hor ? w : h, th = hor ? h : w;
                c.save(); if (!hor) { c.translate(cx, cy); c.rotate(Math.PI / 2); c.translate(-cx, -cy); }
                const px = hor ? x : cx - len / 2, py = hor ? y : cy - th / 2;
                const gr = c.createLinearGradient(0, py, 0, py + th); gr.addColorStop(0, '#94a3b8'); gr.addColorStop(0.5, '#e2e8f0'); gr.addColorStop(1, '#475569');
                c.fillStyle = gr; c.fillRect(px, py, len, th);
                c.fillStyle = '#334155'; for (let k = 0; k <= len; k += 50) c.fillRect(px + Math.min(k, len - 6), py - 2, 6, th + 4);
                c.restore(); break; }
            case 'prop_hatch': {
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#3f3f46'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#a1a1aa'; c.lineWidth = 3; c.stroke();
                c.strokeStyle = '#71717a'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, r * 0.65, 0, Math.PI * 2); c.stroke();
                c.strokeStyle = '#d4d4d8'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(cx - r * 0.3, cy); c.lineTo(cx + r * 0.3, cy); c.moveTo(cx, cy - r * 0.3); c.lineTo(cx, cy + r * 0.3); c.stroke(); break; }
            case 'prop_pad': {   // платформа / зона захоплення: напівпрозора плита з кільцем, що пульсує
                const rad = Math.min(w, h) * 0.16;
                c.fillStyle = 'rgba(8,16,28,0.42)'; c.beginPath(); c.roundRect(x, y, w, h, rad); c.fill();
                c.strokeStyle = 'rgba(255,255,255,0.28)'; c.lineWidth = 3; c.beginPath(); c.roundRect(x + 2, y + 2, w - 4, h - 4, rad); c.stroke();
                c.strokeStyle = 'rgba(34,211,238,0.85)'; c.lineWidth = 2; c.setLineDash([14, 10]); c.beginPath(); c.roundRect(x + 10, y + 10, w - 20, h - 20, rad * 0.7); c.stroke(); c.setLineDash([]);
                c.lineWidth = 2.5; for (let k = 0; k < 2; k++) { const ph = ((t * 0.6) + k * 0.5) % 1; c.globalAlpha = 0.9 * (1 - ph); c.strokeStyle = '#22d3ee'; c.beginPath(); c.arc(cx, cy, Math.min(w, h) * (0.08 + 0.3 * ph), 0, Math.PI * 2); c.stroke(); }
                c.globalAlpha = 1; c.fillStyle = 'rgba(34,211,238,0.9)'; c.beginPath(); c.arc(cx, cy, 4, 0, Math.PI * 2); c.fill(); break; }
            case 'prop_floor': drawFloor(c, o); break;
            case 'prop_roof': drawRoof(c, o); break;

            // ===== РУЙНІВНІ: міста й будівлі =====
            case 'prop_gas': {   // газовий балон: червоний із вентилем і попереджувальною смугою
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#b91c1c'; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#ef4444'; c.beginPath(); c.arc(cx - r * 0.2, cy - r * 0.2, r * 0.62, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#fde047'; c.lineWidth = Math.max(2, r * 0.18); c.beginPath(); c.arc(cx, cy, r * 0.78, 0.3, 1.6); c.stroke(); c.beginPath(); c.arc(cx, cy, r * 0.78, 3.4, 4.7); c.stroke();
                c.fillStyle = '#d4d4d8'; c.beginPath(); c.arc(cx, cy, r * 0.28, 0, Math.PI * 2); c.fill(); c.fillStyle = '#52525b'; c.fillRect(cx - r * 0.1, cy - r * 0.45, r * 0.2, r * 0.3); break; }
            case 'prop_glass': {   // скляна перегородка: блакитне скло з відблисками й рамою
                c.fillStyle = 'rgba(125,211,252,0.35)'; c.fillRect(x, y, w, h); c.strokeStyle = '#94a3b8'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
                c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1.5; c.beginPath();
                const hor = w >= h; for (let k = 0.2; k < 1; k += 0.35) { if (hor) { c.moveTo(x + w * k, y + h); c.lineTo(x + w * k + h, y); } else { c.moveTo(x, y + h * k + w); c.lineTo(x + w, y + h * k); } } c.stroke(); break; }
            case 'prop_desk': {   // офісний стіл: стільниця, клавіатура, папери
                c.fillStyle = '#57534e'; c.fillRect(x, y, w, h); c.fillStyle = '#a8a29e'; c.fillRect(x + 2, y + 2, w - 4, h - 4);
                c.strokeStyle = '#44403c'; c.lineWidth = 1.5; c.strokeRect(x + 2, y + 2, w - 4, h - 4);
                c.fillStyle = '#1f2937'; c.fillRect(cx - w * 0.2, y + h * 0.55, w * 0.4, h * 0.18);
                c.fillStyle = '#f8fafc'; c.save(); c.translate(x + w * 0.2, y + h * 0.35); c.rotate(-0.2); c.fillRect(-7, -9, 14, 18); c.restore(); break; }
            case 'prop_monitor': {   // монітори на підставках: темні екрани з синім світлом
                const n = w >= h ? Math.max(1, Math.round(w / 34)) : 1, sw = w / n;
                for (let k = 0; k < n; k++) { const mx = x + k * sw + 2; c.fillStyle = '#111827'; c.fillRect(mx, y + h * 0.15, sw - 4, h * 0.55); c.fillStyle = '#1d4ed8'; c.fillRect(mx + 3, y + h * 0.15 + 3, sw - 10, h * 0.55 - 6); c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(mx + 3, y + h * 0.15 + 3, (sw - 10) * 0.4, h * 0.55 - 6); c.fillStyle = '#374151'; c.fillRect(mx + sw / 2 - 5, y + h * 0.7, 6, h * 0.25); } break; }
            case 'prop_shelf': {   // металевий стелаж із коробками
                c.fillStyle = '#475569'; c.fillRect(x, y, w, h); c.strokeStyle = '#1e293b'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
                const n = Math.max(2, Math.round((w >= h ? w : h) / 30));
                for (let k = 0; k < n; k++) { const bx = w >= h ? x + 3 + k * (w - 6) / n : x + 3, by = w >= h ? y + 3 : y + 3 + k * (h - 6) / n, bw = w >= h ? (w - 6) / n - 3 : w - 6, bh = w >= h ? h - 6 : (h - 6) / n - 3; c.fillStyle = ['#b45309', '#a16207', '#78716c'][k % 3]; c.fillRect(bx, by, bw, bh); } break; }
            case 'prop_vending': {   // торговий автомат: корпус, вітрина з банками, кнопки
                c.fillStyle = '#be123c'; c.fillRect(x, y, w, h); c.strokeStyle = '#881337'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
                c.fillStyle = '#0f172a'; c.fillRect(x + 4, y + 4, w * 0.62, h - 8);
                const cols = ['#22d3ee', '#facc15', '#a3e635', '#f472b6']; for (let r2 = 0; r2 < 3; r2++) for (let k = 0; k < 3; k++) { c.fillStyle = cols[(r2 + k) % 4]; c.fillRect(x + 7 + k * (w * 0.62 - 6) / 3, y + 7 + r2 * (h - 14) / 3, (w * 0.62 - 6) / 3 - 3, (h - 14) / 3 - 3); }
                c.fillStyle = '#fecdd3'; c.fillRect(x + w * 0.72, y + h * 0.2, w * 0.2, h * 0.12); c.fillRect(x + w * 0.72, y + h * 0.4, w * 0.2, h * 0.12); break; }
            case 'prop_server': {   // серверна стійка: темний корпус і ряди індикаторів
                c.fillStyle = '#0f172a'; c.fillRect(x, y, w, h); c.strokeStyle = '#334155'; c.lineWidth = 2; c.strokeRect(x, y, w, h);
                const rows = Math.max(3, Math.round(h / 12));
                for (let k = 0; k < rows; k++) { const ry = y + 4 + k * (h - 8) / rows; c.fillStyle = '#1e293b'; c.fillRect(x + 4, ry, w - 8, (h - 8) / rows - 2); c.fillStyle = (Math.sin(t * 4 + k * 1.7 + x) > 0.2) ? '#22c55e' : '#14532d'; c.fillRect(x + w - 12, ry + 2, 4, 3); c.fillStyle = '#38bdf8'; c.fillRect(x + w - 20, ry + 2, 4, 3); } break; }
            case 'prop_sofa': {   // диван: спинка, підлокітники, подушки
                c.fillStyle = '#4338ca'; c.beginPath(); c.roundRect(x, y, w, h, 8); c.fill();
                c.fillStyle = '#3730a3'; c.fillRect(x + 3, y + 3, w - 6, h * 0.3); c.fillRect(x + 3, y + 3, w * 0.12, h - 6); c.fillRect(x + w * 0.88 - 3, y + 3, w * 0.12, h - 6);
                c.fillStyle = '#6366f1'; const cw = (w * 0.76) / 2; c.fillRect(x + w * 0.12 + 2, y + h * 0.36, cw - 3, h * 0.56); c.fillRect(x + w * 0.12 + cw + 1, y + h * 0.36, cw - 3, h * 0.56); break; }
            case 'prop_plant': {   // вазон: горщик і листя
                const r = Math.min(w, h) / 2;
                c.fillStyle = '#9a3412'; c.beginPath(); c.arc(cx, cy, r * 0.62, 0, Math.PI * 2); c.fill();
                c.fillStyle = '#166534'; for (let a = 0; a < 6; a++) { c.beginPath(); c.ellipse(cx + Math.cos(a * 1.047) * r * 0.45, cy + Math.sin(a * 1.047) * r * 0.45, r * 0.42, r * 0.2, a * 1.047, 0, Math.PI * 2); c.fill(); }
                c.fillStyle = '#22c55e'; c.beginPath(); c.arc(cx, cy, r * 0.25, 0, Math.PI * 2); c.fill(); break; }
            default: ok = false;
        }
        c.restore();
        return ok;
    }

    // ---------- УЛАМКИ на місці знищеного об'єкта (лягають у статичний шар мапи) ----------
    const MAT_COL = { wood: ['#7c4a21', '#a16207', '#5b3416'], hay: ['#ca8a04', '#a16207', '#eab308'], rubber: ['#171717', '#27272a', '#3f3f46'], plastic: ['#ea580c', '#f8fafc', '#c2410c'],
        cloth: ['#44602a', '#5d7a3a', '#3730a3'], metal: ['#52525b', '#3f3f46', '#71717a'], glass: ['#bae6fd', '#7dd3fc', '#e0f2fe'], plant: ['#166534', '#9a3412', '#22c55e'] };
    function drawRubble(c, o) {
        const D = DESTR[o.type]; if (!D) return;
        const x = o.x, y = o.y, w = o.w || 50, h = o.h || 50, cx = x + w / 2, cy = y + h / 2, cols = MAT_COL[D.mat] || MAT_COL.wood, rnd = srand((x * 73856093) ^ (y * 19349663));
        c.save();
        if (D.ex) {      // вибух лишає випалену пляму
            const R = Math.max(w, h) * 0.9; const g = c.createRadialGradient(cx, cy, 0, cx, cy, R); g.addColorStop(0, 'rgba(10,10,10,0.75)'); g.addColorStop(0.6, 'rgba(30,20,10,0.4)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
        } else { c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(cx, cy, w * 0.5, h * 0.5, 0, 0, Math.PI * 2); c.fill(); }
        const n = Math.max(5, Math.min(16, Math.round((w + h) / 9)));
        for (let k = 0; k < n; k++) {
            const px = x + rnd() * w, py = y + rnd() * h, s = 3 + rnd() * 7, a = rnd() * Math.PI;
            c.fillStyle = cols[k % cols.length]; c.save(); c.translate(px, py); c.rotate(a); c.fillRect(-s, -s * 0.35, s * 2, s * 0.7); c.restore();
        }
        c.restore();
    }

    // ---------- ПОКРИТТЯ: дорога +10%, бруд / пісок / сніг −15%, лід — ковзання ----------
    // Для мап без власного списку (map.surf) плями генеруються автоматично за темою (детерміновано: однаково на сервері й у клієнта),
    // далеко від точок появи та цілей режимів. Калюжі бруду (prop_puddle) — теж бруд, дороги — об'єкти «line».
    const SURF = { 1: { k: 'road', spd: 1.1 }, 2: { k: 'mud', spd: 0.85 }, 3: { k: 'sand', spd: 0.85 }, 4: { k: 'snow', spd: 0.85 }, 5: { k: 'ice', spd: 1, ice: true } };
    const SURF_ID = { road: 1, mud: 2, sand: 3, snow: 4, ice: 5 };
    const SURF_BY_THEME = { snow: [['ice', 5], ['snow', 6]], swamp: [['mud', 9]], sand: [['sand', 8]], grass: [['mud', 5]], stone: [['mud', 3]], asphalt: [['mud', 2]], mars: [['sand', 7]], dirt: [['mud', 5]], autumn: [['mud', 4]] };
    const _sf = new WeakMap();
    function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function surfacesOf(map) {
        let e = _sf.get(map); if (e && e.n === map.solids.length) return e;
        const out = [], S = map.size, solids = map.solids;
        // явні плями з мапи
        if (Array.isArray(map.surf)) map.surf.forEach(p => { if (SURF_ID[p.k] && Array.isArray(p.pts) && p.pts.length >= 3) out.push({ id: SURF_ID[p.k], pts: p.pts.map(q => [q.x, q.y]) }); });
        else {
            const keep = solids.filter(o => o.type.indexOf('spawn') === 0).map(o => ({ x: o.x, y: o.y }));
            const water = solids.filter(o => o.type.indexOf('water') >= 0);
            const rnd = srand(hashStr((map.title || '') + '|' + S + '|' + solids.length));
            const area = Math.max(0.35, Math.min(5, (S / 3200) * (S / 3200)));
            const plan = []; const add = th => { (SURF_BY_THEME[th] || []).forEach(q => plan.push(q)); };
            if (map.biomes && map.biomes.length) { const seen = {}; map.biomes.forEach(b => { if (!seen[b.theme]) { seen[b.theme] = 1; add(b.theme); } }); add(map.theme); } else add(map.theme);
            plan.forEach(([k, n0]) => {
                const n = Math.min(40, Math.round(n0 * area)); let made = 0;
                for (let tries = 0; tries < n * 8 && made < n; tries++) {
                    const x = 200 + rnd() * (S - 400), y = 200 + rnd() * (S - 400), rx = 130 + rnd() * 190, ry = rx * (0.55 + rnd() * 0.4), rot = rnd() * Math.PI;
                    if (hasShape(map) && !pointInPoly(map.shape, x, y)) continue;
                    if (map.biomes && map.biomes.length) { const b = biomeAt(map, x, y), th = b ? b.theme : map.theme; if (!(SURF_BY_THEME[th] || []).some(q => q[0] === k)) continue; }
                    let bad = false; for (let i = 0; i < keep.length && !bad; i++) if (Math.hypot(keep[i].x - x, keep[i].y - y) < rx + 230) bad = true;
                    for (let i = 0; i < water.length && !bad; i++) if (solidHit(water[i], x, y, 20)) bad = true;
                    if (bad) continue;
                    const pts = [], m = 16; for (let v = 0; v < m; v++) { const a = v / m * Math.PI * 2, j = 0.82 + rnd() * 0.3, px = Math.cos(a) * rx * j, py = Math.sin(a) * ry * j; pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]); }
                    out.push({ id: SURF_ID[k], pts }); made++;
                }
            });
        }
        solids.forEach(o => { if (o.type === 'prop_puddle') { const w = o.w || 50, h = o.h || 50, cx = o.x + w / 2, cy = o.y + h / 2, pts = []; for (let v = 0; v < 12; v++) { const a = v / 12 * Math.PI * 2, px = Math.cos(a) * w / 2, py = Math.sin(a) * h / 3, rr = Math.PI / 4; pts.push([cx + px * Math.cos(rr) - py * Math.sin(rr), cy + px * Math.sin(rr) + py * Math.cos(rr)]); } out.push({ id: 2, pts, puddle: true }); } });
        out.forEach(p => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; p.pts.forEach(q => { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; }); p.bb = [x0, y0, x1, y1]; });
        const lines = solids.filter(o => o.type === 'line' && o.points && o.points.length > 1);
        const lb = lines.map(o => { const hw = (o.width || 10) / 2; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; o.points.forEach(q => { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }); return [x0 - hw, y0 - hw, x1 + hw, y1 + hw]; });
        const N = Math.ceil(S / 40) + 1;
        e = { n: solids.length, list: out, lines, lb, N, grid: new Uint8Array(N * N).fill(255) }; _sf.set(map, e); return e;
    }
    function inPts(pts, x, y) { let ins = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (((a[1] > y) !== (b[1] > y)) && (x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0])) ins = !ins; } return ins; }
    // код покриття в точці (0 — звичайна земля). Сітка 40 px рахується ліниво й кешується
    function surfAt(map, x, y) {
        if (!map || !map.solids) return 0;
        const e = surfacesOf(map), gx = Math.floor(x / 40), gy = Math.floor(y / 40); if (gx < 0 || gy < 0 || gx >= e.N || gy >= e.N) return 0;
        const k = gy * e.N + gx; let v = e.grid[k]; if (v !== 255) return v;
        const px = (gx + 0.5) * 40, py = (gy + 0.5) * 40; v = 0;
        for (let i = e.list.length - 1; i >= 0 && !v; i--) { const p = e.list[i], b = p.bb; if (px < b[0] || px > b[2] || py < b[1] || py > b[3]) continue; if (inPts(p.pts, px, py)) v = p.id; }
        if (!v) for (let i = 0; i < e.lines.length && !v; i++) { const lb = e.lb[i]; if (px < lb[0] || px > lb[2] || py < lb[1] || py > lb[3]) continue; const o = e.lines[i], hw = (o.width || 10) / 2; for (let q = 1; q < o.points.length; q++) if (distToSeg(px, py, o.points[q - 1].x, o.points[q - 1].y, o.points[q].x, o.points[q].y) <= hw) { v = 1; break; } }
        e.grid[k] = v; return v;
    }
    const surfSpeed = (map, x, y) => { const v = surfAt(map, x, y); return v ? SURF[v].spd : 1; };
    const surfIce = (map, x, y) => surfAt(map, x, y) === 5;
    // малювання плям у прямокутнику R (клієнт: статичний шар мапи; редактор)
    function drawSurfaces(c, map, R, low) {
        const e = surfacesOf(map);
        for (let i = 0; i < e.list.length; i++) {
            const p = e.list[i], b = p.bb; if (p.puddle || b[2] < R.x0 || b[0] > R.x1 || b[3] < R.y0 || b[1] > R.y1) continue;
            const pth = () => { c.beginPath(); p.pts.forEach((q, j) => j ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); };
            const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, rr = Math.max(b[2] - b[0], b[3] - b[1]) / 2, rnd = srand(Math.round(cx * 13 + cy * 7));
            c.save(); c.lineJoin = 'round';
            if (p.id === 2) {      // бруд: темна пляма з мокрими відблисками
                pth(); c.fillStyle = 'rgba(58,38,20,0.82)'; c.fill(); c.strokeStyle = 'rgba(58,38,20,0.35)'; c.lineWidth = 14; c.stroke();
                if (!low) { c.clip(); for (let k = 0; k < 7; k++) { c.fillStyle = k % 2 ? 'rgba(34,22,10,0.55)' : 'rgba(120,90,60,0.22)'; c.beginPath(); c.ellipse(cx + (rnd() - 0.5) * rr * 1.2, cy + (rnd() - 0.5) * rr * 0.8, 20 + rnd() * 40, 10 + rnd() * 18, rnd() * 3, 0, Math.PI * 2); c.fill(); } }
            } else if (p.id === 3) {      // сипучий пісок: світла пляма з брижами
                pth(); c.fillStyle = 'rgba(222,190,128,0.78)'; c.fill(); c.strokeStyle = 'rgba(222,190,128,0.35)'; c.lineWidth = 16; c.stroke();
                if (!low) { c.clip(); c.strokeStyle = 'rgba(160,120,60,0.35)'; c.lineWidth = 3; for (let k = -6; k <= 6; k++) { c.beginPath(); for (let s = -1; s <= 1.01; s += 0.1) { const xx = cx + s * rr, yy = cy + k * 22 + Math.sin(s * 9 + k) * 6; if (s === -1) c.moveTo(xx, yy); else c.lineTo(xx, yy); } c.stroke(); } }
            } else if (p.id === 4) {      // глибокий сніг: біла пляма з блакитною тінню
                pth(); c.fillStyle = 'rgba(248,250,252,0.9)'; c.fill(); c.strokeStyle = 'rgba(226,232,240,0.5)'; c.lineWidth = 18; c.stroke();
                if (!low) { c.clip(); for (let k = 0; k < 8; k++) { c.fillStyle = 'rgba(148,163,184,0.18)'; c.beginPath(); c.ellipse(cx + (rnd() - 0.5) * rr * 1.3, cy + (rnd() - 0.5) * rr * 0.9, 30 + rnd() * 50, 12 + rnd() * 20, rnd() * 3, 0, Math.PI * 2); c.fill(); } }
            } else if (p.id === 5) {      // лід: блакитне скло з тріщинами й відблисками
                pth(); c.fillStyle = 'rgba(165,215,240,0.8)'; c.fill(); c.strokeStyle = 'rgba(224,242,254,0.8)'; c.lineWidth = 4; c.stroke();
                if (!low) { c.clip(); c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 6; for (let k = 0; k < 3; k++) { const yy = cy + (rnd() - 0.5) * rr; c.beginPath(); c.moveTo(cx - rr, yy + rr * 0.5); c.lineTo(cx + rr, yy - rr * 0.5); c.stroke(); }
                    c.strokeStyle = 'rgba(56,120,160,0.45)'; c.lineWidth = 1.5; for (let k = 0; k < 5; k++) { let xx = cx + (rnd() - 0.5) * rr, yy = cy + (rnd() - 0.5) * rr * 0.6; c.beginPath(); c.moveTo(xx, yy); for (let s = 0; s < 4; s++) { xx += (rnd() - 0.5) * 70; yy += (rnd() - 0.5) * 70; c.lineTo(xx, yy); } c.stroke(); } }
            }
            c.restore();
        }
    }

    // ---------- ПЕРЕВІРКА МАПИ (сервер) ----------
    const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
    const num = (v, lo, hi, d) => { v = Number(v); if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, v)); };
    const MODES = ['deathmatch', 'team_deathmatch', 'survival', 'prophunt', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'battle_royale', 'capture_points', 'bounty', 'rounds'];
    // чи дозволена мапа в режимі (без поля modes — доступна в усіх)
    // нові режими успадковують дозвіл базових: кооп/соло — як «Виживання», королівський бій і полювання — як «Детматч», захоплення точок — як «Командний»
    const MODE_ALIAS = { base_defense: 'survival', boss_raid: 'survival', convoy: 'survival', solo_arena: 'survival', boss_duel: 'survival', battle_royale: 'deathmatch', bounty: 'deathmatch', capture_points: 'team_deathmatch', rounds: 'team_deathmatch' };
    // мапа, де режим названо прямо, дозволена в ньому; старі мапи (без нових режимів у списку) діють за правилами базового режиму
    function mapAllows(m, mode) { if (!m || !Array.isArray(m.modes) || !m.modes.length) return true; return m.modes.indexOf(mode) >= 0 || (!!MODE_ALIAS[mode] && m.modes.indexOf(MODE_ALIAS[mode]) >= 0); }

    const THEME_IDS = ['grass', 'sand', 'snow', 'stone', 'asphalt', 'metal', 'dirt', 'swamp', 'lava', 'tech', 'autumn', 'space', 'mars'];
    function sanitizeMap(raw) {
        if (!raw || typeof raw !== 'object') throw new Error('Порожні дані мапи');
        const size = Math.round(num(raw.size, 1000, 8000, 3000));
        const out = { size: size, bg: COLOR_RE.test(raw.bg) ? raw.bg : '#020617', grid: COLOR_RE.test(raw.grid) ? raw.grid : '#1e293b', solids: [] };
        if (typeof raw.title === 'string' && raw.title.trim()) out.title = raw.title.trim().slice(0, 40);
        if (typeof raw.theme === 'string' && THEME_IDS.indexOf(raw.theme) >= 0) out.theme = raw.theme;
        if (Array.isArray(raw.biomes) && raw.biomes.length) {   // біоми: до 12 полігонів із власною темою землі
            if (raw.biomes.length > 12) throw new Error('Занадто багато біомів (макс. 12)');
            const bl = [];
            raw.biomes.forEach(b => {
                if (!b || THEME_IDS.indexOf(b.theme) < 0 || !Array.isArray(b.points) || b.points.length < 3) return;
                if (b.points.length > 120) throw new Error('Занадто багато вершин біому (макс. 120)');
                const nb = { theme: b.theme, points: b.points.map(p => ({ x: Math.round(num(p && p.x, 0, size, 0)), y: Math.round(num(p && p.y, 0, size, 0)) })) };
                if (COLOR_RE.test(b.bg)) nb.bg = b.bg;
                bl.push(nb);
            });
            if (bl.length) out.biomes = bl;
        }
        if (Array.isArray(raw.shape) && raw.shape.length >= 3) {
            if (raw.shape.length > 300) throw new Error('Занадто багато вершин контуру (макс. 300)');
            out.shape = raw.shape.map(p => ({ x: Math.round(num(p && p.x, 0, size, 0)), y: Math.round(num(p && p.y, 0, size, 0)) }));
        }
        if (Array.isArray(raw.modes)) {
            const mm = MODES.filter(m => raw.modes.indexOf(m) >= 0);
            if (!mm.length) throw new Error('Оберіть хоча б один режим для мапи');
            if (mm.length < MODES.length) out.modes = mm;       // усі режими = поле не потрібне
        }
        if (!Array.isArray(raw.solids)) throw new Error('Немає списку об\'єктів');
        if (raw.solids.length > 4000) throw new Error('Занадто багато об\'єктів (макс. 4000)');
        raw.solids.forEach(o => {
            if (!o || typeof o.type !== 'string' || !ALL_TYPES.has(o.type)) return;
            const c = { type: o.type, x: Math.round(num(o.x, -500, size + 500, 0) * 100) / 100, y: Math.round(num(o.y, -500, size + 500, 0) * 100) / 100 };
            if (o.type === 'line' || o.type === 'shape_line') {
                if (!Array.isArray(o.points) || o.points.length < 2) return;
                c.type = 'line'; c.points = o.points.slice(0, 3000).map(p => ({ x: Math.round(num(p && p.x, -500, size + 500, 0)), y: Math.round(num(p && p.y, -500, size + 500, 0)) }));
                c.color = COLOR_RE.test(o.color) ? o.color : '#3b82f6'; c.width = Math.round(num(o.width, 1, 200, 10)); if (COLOR_RE.test(o.stripe)) c.stripe = o.stripe; delete c.x; delete c.y;
            } else {
                if (o.w !== undefined) c.w = Math.round(num(o.w, 1, 4000, 50)); if (o.h !== undefined) c.h = Math.round(num(o.h, 1, 4000, 50));
                if (o.r !== undefined) c.r = Math.round(num(o.r, 1, 2000, 30));
                if (COLOR_RE.test(o.color)) c.color = o.color;
                if (COLOR_RE.test(o.neon)) c.neon = o.neon; if (COLOR_RE.test(o.stripe)) c.stripe = o.stripe;
                if (o.fs === 'plate' || o.fs === 'tile' || o.fs === 'carpet') c.fs = o.fs;      // вигляд підлоги будівлі
                const rot = ((Math.round(num(o.rot, -3600, 3600, 0)) % 360) + 360) % 360; if (rot) c.rot = rot;
            }
            out.solids.push(c);
        });
        if (!out.solids.some(s => s.type === 'spawn_player')) throw new Error('Додайте хоча б одну точку «Спавн: Гравець»');
        if (out.shape && !out.solids.some(s => s.type === 'spawn_player' && circleInPoly(out.shape, s.x, s.y, 24))) throw new Error('Жодна точка «Спавн: Гравець» не лежить всередині контуру мапи');
        return out;
    }

    const api = {
        D2R, DOOR_TRIGGER, DOOR_PASS, PROPS_BASE, PROPS_WOOD, PROPS_EXTRA, DOORS, DOOR_BY_ID, NONSOLID, ALL_TYPES,
        isDoor, isCircular, isSolidType, center, applyRot, toLocal, distToSeg, pointInPoly, circleInPoly, hasShape, pointInObject,
        collides, collidesNaive, invalidateIndex, DESTR, isDestr, destrList, destrAt, drawRubble, SURF, surfacesOf, surfAt, surfSpeed, surfIce, drawSurfaces, biomeAt, biomePoly, biomeBBox, polyOf, circleHitsPoly, DISGUISE_GROUPS, DISGUISE_IDS, DISGUISE_SHAPES, drawDisguise, doorNear, updateDoors, resetDoors, shapeBounds, drawProp, sanitizeMap, MODES, mapAllows, THEME_IDS
    };
    return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MapObj;
