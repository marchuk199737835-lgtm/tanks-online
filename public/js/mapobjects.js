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
        { id: 'prop_pad', name: 'Платформа (без колізії)' }
    ];
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
    const NONSOLID = new Set(['prop_puddle', 'prop_crater', 'prop_hatch', 'prop_pad']);
    const BASE_TYPES = ['wall', 'wall_square', 'shape_line', 'line', 'shape_triangle', 'shape_rhombus', 'shape_parallelepiped', 'tree',
        'water_square', 'water_curve', 'neon_wall', 'neon_circle', 'neon_triangle', 'neon_cross', 'neon_diamond', 'neon_arch', 'neon_pillar',
        'spawn_player', 'spawn_zombie', 'spawn_powerup'];
    const ALL_TYPES = new Set(BASE_TYPES);
    [PROPS_BASE, PROPS_WOOD, PROPS_EXTRA, DOORS].forEach(l => l.forEach(p => ALL_TYPES.add(p.id)));

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

    // ---------- ЗІТКНЕННЯ (єдина функція для клієнта і сервера) ----------
    // opts: { ignore:[індекси], skipWater:bool, doorOpen:(o,i)=>bool }
    function collides(map, x, y, r, opts) {
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
            if (isCircular(s)) {
                const cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30);
                if (Math.hypot(x - cx, y - cy) <= r + sr) return true;
            } else {
                const l = s.rot ? toLocal(s, x, y) : { x: x, y: y };
                const tX = Math.max(s.x, Math.min(l.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(l.y, s.y + (s.h || 30)));
                if (Math.hypot(l.x - tX, l.y - tY) <= r) return true;
            }
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
    function updateDoors(map, actors, dt) {
        const arr = map.solids;
        for (let i = 0; i < arr.length; i++) {
            const o = arr[i]; if (!isDoor(o)) continue;
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
            case 'prop_bush':
                c.fillStyle = '#15803d'; c.beginPath(); c.arc(x + w / 3, y + h / 3, w / 2, 0, Math.PI * 2); c.fill();
                c.beginPath(); c.arc(x + w * 0.7, y + h / 3, w / 2, 0, Math.PI * 2); c.fill();
                c.beginPath(); c.arc(x + w / 2, y + h * 0.7, w / 2.5, 0, Math.PI * 2); c.fill(); break;
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
            case 'prop_tent':
                c.fillStyle = '#4d7c0f'; c.fillRect(x, y, w, h); c.fillStyle = '#1a2e05'; c.beginPath(); c.moveTo(x + w / 2, y + h); c.lineTo(x + w / 2 - 15, y + h - 20); c.lineTo(x + w / 2 + 15, y + h - 20); c.fill(); break;
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
            case 'prop_wreck':
                c.fillStyle = '#1c1917'; c.fillRect(x + 5, y + 10, w - 10, h - 20);
                c.fillStyle = '#09090b'; c.beginPath(); c.arc(cx, cy, 15, 0, Math.PI * 2); c.fill();
                c.strokeStyle = '#09090b'; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy); c.lineTo(x + w, y + h); c.stroke(); break;
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
            case 'prop_pad': {
                c.fillStyle = '#0f172a'; c.fillRect(x, y, w, h); c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.shadowColor = '#22d3ee'; c.shadowBlur = 10; c.strokeRect(x + 3, y + 3, w - 6, h - 6);
                const rr = Math.min(w, h) * (0.15 + 0.25 * ((t * 0.7) % 1)); c.globalAlpha = 1 - ((t * 0.7) % 1); c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.stroke(); break; }
            default: ok = false;
        }
        c.restore();
        return ok;
    }

    // ---------- ПЕРЕВІРКА МАПИ (сервер) ----------
    const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
    const num = (v, lo, hi, d) => { v = Number(v); if (!isFinite(v)) return d; return Math.max(lo, Math.min(hi, v)); };
    const MODES = ['deathmatch', 'team_deathmatch', 'survival', 'prophunt'];
    // чи дозволена мапа в режимі (без поля modes — доступна в усіх)
    function mapAllows(m, mode) { return !m || !Array.isArray(m.modes) || !m.modes.length || m.modes.indexOf(mode) >= 0; }

    function sanitizeMap(raw) {
        if (!raw || typeof raw !== 'object') throw new Error('Порожні дані мапи');
        const size = Math.round(num(raw.size, 1000, 8000, 3000));
        const out = { size: size, bg: COLOR_RE.test(raw.bg) ? raw.bg : '#020617', grid: COLOR_RE.test(raw.grid) ? raw.grid : '#1e293b', solids: [] };
        if (typeof raw.title === 'string' && raw.title.trim()) out.title = raw.title.trim().slice(0, 40);
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
                c.color = COLOR_RE.test(o.color) ? o.color : '#3b82f6'; c.width = Math.round(num(o.width, 1, 200, 10)); delete c.x; delete c.y;
            } else {
                if (o.w !== undefined) c.w = Math.round(num(o.w, 1, 4000, 50)); if (o.h !== undefined) c.h = Math.round(num(o.h, 1, 4000, 50));
                if (o.r !== undefined) c.r = Math.round(num(o.r, 1, 2000, 30));
                if (COLOR_RE.test(o.color)) c.color = o.color;
                if (COLOR_RE.test(o.neon)) c.neon = o.neon; if (COLOR_RE.test(o.stripe)) c.stripe = o.stripe;
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
        collides, doorNear, updateDoors, resetDoors, shapeBounds, drawProp, sanitizeMap, MODES, mapAllows
    };
    return api;
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MapObj;
