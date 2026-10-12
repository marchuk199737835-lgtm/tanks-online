// 2 мапи королівського бою 7500×7500: «Frozen Valley» (відкрита зимова долина з великими будинками) і «TV Center» (величезний телецентр)
'use strict';
module.exports = function (def, L) {
    const { rr, ri, pick } = L, BR = ['battle_royale'];
    const near = (m, cx, cy, R, rad, fn, tries) => { for (let k = 0; k < (tries || 60); k++) { const a = L.rnd() * L.TAU, d = rr(rad, R), x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; if (m.free(x, y, rad)) { fn(x, y); return true; } } return false; };
    // будинок, що шукає собі місце біля (cx,cy) у радіусі R
    function placeBld(m, cx, cy, R, w, h, o, furn) {
        for (let k = 0; k < 80; k++) {
            const a = L.rnd() * L.TAU, d = rr(0, R), x = Math.round(cx + Math.cos(a) * d - w / 2), y = Math.round(cy + Math.sin(a) * d - h / 2);
            if (!m.rectFree(x, y, w, h, 120)) continue;
            const b = m.bld(x, y, w, h, o); (furn || []).forEach(f => m.furnish(b, f)); return b;
        }
        return null;
    }

    // ===================================== FROZEN VALLEY =====================================
    def('Frozen Valley', 7500, 'snow', BR, '#dce8f1', m => {
        const wood = ['#7c5a3a', '#6b4a2b', '#8a6a4a'], roofs = ['#5d6b7a', '#7a3f31', '#4b5563', '#6b5d45'], snowRoof = '#e2e8f0';
        // села і дороги між ними (спершу дороги — річка лишає під ними проміжки-мости)
        const V = [[1500, 1300], [5600, 1200], [3700, 2300], [1200, 5600], [3600, 5900], [6200, 6600], [6400, 3200]], roads = [];
        [[0, 2], [1, 2], [2, 6], [2, 4], [3, 4], [4, 5], [6, 5], [0, 3]].forEach(([a, b]) => { const A = V[a], B = V[b], mx = (A[0] + B[0]) / 2 + rr(-250, 250), my = (A[1] + B[1]) / 2 + rr(-250, 250), pts = [A, [mx, my], B]; roads.push(pts); m.road(pts, 150, '#b5c4d1', '#f1f5f9'); });
        // замерзла річка (вода непрохідна) з мостами: під дорогами і ще у двох місцях
        const river = [[0, 2600], [1400, 2900], [2600, 3700], [3800, 3900], [5000, 4700], [6200, 4900], [7500, 5600]], bridges = [[2600, 3700], [5000, 4700]];
        const onRoad = (x, y) => roads.some(pts => { for (let i = 1; i < pts.length; i++) if (L.MO.distToSeg(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) < 230) return true; return false; });
        for (let i = 0; i < river.length - 1; i++) {
            const [x1, y1] = river[i], [x2, y2] = river[i + 1], n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 160);
            for (let s = 0; s < n; s++) { const t = s / n, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t; if (onRoad(x, y)) continue; if (bridges.some(b => Math.hypot(b[0] - x, b[1] - y) < 230)) continue; m.water(x - 120, y - 130, 250, 260, true); }
        }
        bridges.forEach(([x, y]) => { m.line([[x - 60, y - 260], [x + 60, y + 260]], 170, '#8a6a4a', '#6b4a2b'); m.keep(x, y, 260); });
        m.keepLine(river, 300);
        // замерзлі озера (непрохідні)
        [[900, 3800, 900, 600], [5200, 2700, 700, 500], [2200, 6800, 800, 450]].forEach(([x, y, w, h]) => { if (m.rectFree(x, y, w, h, 100)) { m.water(x, y, w, h, true); m.keepRect(x - 80, y - 80, w + 160, h + 160); } });
        // центр: великий гірський готель (шале) з кімнатами
        const H = m.bld(3150, 2000, 1100, 720, { T: 30, wall: '#6b4a2b', floor: '#a0794a', roof: snowRoof, stripe: '#94a3b8',
            ents: [{ side: 's', at: 0.5, g: 170, door: 'prop_door_wood_d' }, { side: 'n', at: 0.5, g: 150 }, { side: 'w', at: 0.5, g: 140 }, { side: 'e', at: 0.5, g: 140, door: 'prop_door_wood_d' }],
            parts: [{ axis: 'v', at: 0.33, gap: 0.25, g: 140, door: 'prop_door_wood_s' }, { axis: 'v', at: 0.67, gap: 0.75, g: 140 }, { axis: 'h', at: 0.5, gap: 0.5, g: 160, x0: 3180, x1: 3500 }] });
        [['prop_sofa', 120, 50, 'wall'], ['prop_sofa', 120, 50, 'wall'], ['prop_wood_table', 100, 50, 'center'], ['prop_wood_table', 100, 50, 'center'], ['prop_wood_firewood', 60, 50, 'corner'], ['prop_shelf', 180, 40, 'wall'], ['prop_plant', 40, 40, 'corner'], ['prop_wood_barrel', 44, 44, 'corner'], ['prop_wood_bench', 100, 30, 'wall'], ['prop_crate', 50, 50, 'corner'], ['prop_desk', 100, 60, 'center']].forEach(f => m.furnish(H, f));
        m.prop('prop_campfire', 3675, 2830, 50, 50); m.keep(3700, 2850, 120);
        const lodgeF = [['prop_sofa', 110, 50, 'wall'], ['prop_wood_table', 100, 50, 'center'], ['prop_wood_bench', 100, 30, 'wall'], ['prop_shelf', 160, 40, 'wall'], ['prop_wood_barrel', 44, 44, 'corner'], ['prop_wood_firewood', 60, 50, 'corner'], ['prop_plant', 40, 40, 'corner']];
        const cabinF = [['prop_wood_table', 100, 50, 'center'], ['prop_wood_bench', 100, 30, 'wall'], ['prop_wood_firewood', 60, 50, 'corner'], ['prop_crate', 50, 50, 'corner']];
        const barnF = [['prop_hay', 80, 80, 'corner'], ['prop_hay', 80, 80, 'corner'], ['prop_wood_cart', 110, 70, 'wall'], ['prop_crate', 50, 50, 'corner'], ['prop_wood_pallet', 80, 60, 'wall'], ['prop_barrel', 40, 40, 'corner']];
        V.forEach(([cx, cy], vi) => {
            const n = vi === 2 ? 3 : ri(4, 6);
            for (let k = 0; k < n; k++) {
                const kind = k === 0 ? 'lodge' : pick(['cabin', 'cabin', 'barn', 'lodge']), sd = pick(['n', 's', 'e', 'w']), op = { n: 's', s: 'n', e: 'w', w: 'e' }[sd];
                if (kind === 'lodge') { const w = ri(54, 62) * 10, h = ri(38, 44) * 10; placeBld(m, cx, cy, 650, w, h, { T: 28, wall: pick(wood), floor: '#a0794a', roof: pick([snowRoof, pick(roofs)]), ents: [{ side: sd, at: rr(0.25, 0.75), g: 150, door: 'prop_door_wood_d' }, { side: op, at: 0.5, g: 140 }], parts: [{ axis: w > h ? 'v' : 'h', at: 0.5, gap: rr(0.25, 0.75), g: 140, door: L.rnd() < 0.5 ? 'prop_door_wood_s' : null }] }, lodgeF); }
                else if (kind === 'barn') placeBld(m, cx, cy, 700, 480, 320, { T: 26, wall: '#7a3f31', floor: '#7c5a3a', roof: '#57534e', ents: [{ side: sd, at: 0.5, g: 180 }, { side: op, at: 0.5, g: 140, door: 'prop_door_wood_d' }] }, barnF);
                else placeBld(m, cx, cy, 650, ri(30, 34) * 10, ri(25, 28) * 10, { T: 24, wall: pick(wood), floor: '#9a7448', roof: pick([snowRoof, pick(roofs)]), ents: [{ side: sd, at: 0.5, g: 130, door: L.rnd() < 0.5 ? 'prop_door_wood_s' : null }, { side: op, at: 0.5, g: 120 }] }, cabinF);
            }
            for (let k = 0; k < 6; k++) near(m, cx, cy, 700, 60, (x, y) => m.prop('prop_fence_wood', x - 60, y - 10, 120, 20, ri(0, 3) * 45));
            for (let k = 0; k < 5; k++) near(m, cx, cy, 700, 50, (x, y) => m.prop(pick(['prop_wood_firewood', 'prop_wood_log', 'prop_wood_pallet', 'prop_wood_barrel']), x - 40, y - 25, 80, 50));
            for (let k = 0; k < 2; k++) near(m, cx, cy, 650, 60, (x, y) => { m.barrel(x - 44, y - 20); m.barrel(x + 4, y - 20); });
            near(m, cx, cy, 400, 60, (x, y) => m.prop('prop_campfire', x - 25, y - 25, 50, 50));
            for (let k = 0; k < 4; k++) near(m, cx, cy, 900, 40, (x, y) => m.prop('prop_puddle', x - 60, y - 40, 120, 80));      // калюжі бруду (розтоптаний сніг)
        });
        // кемпінги між селами
        [[2600, 4600], [5000, 5600], [4900, 3700], [2200, 1300]].forEach(([cx, cy]) => { for (let k = 0; k < 3; k++) near(m, cx, cy, 300, 60, (x, y) => m.prop('prop_tent', x - 45, y - 40, 90, 80)); near(m, cx, cy, 200, 40, (x, y) => m.prop('prop_campfire', x - 25, y - 25, 50, 50)); for (let k = 0; k < 3; k++) near(m, cx, cy, 400, 60, (x, y) => m.sand(x - 50, y - 20, 100, 40, ri(0, 3) * 45)); });
        // ліс кількома гаями — долина відкрита
        [[300, 300, 1100, 800], [6300, 200, 1000, 900], [200, 6500, 900, 800], [6600, 4200, 800, 900], [2800, 4300, 900, 600], [4500, 6600, 1200, 700], [4600, 300, 900, 600]].forEach(r => m.forest(r, 26, 38, 70, 0.08));
        m.forest([200, 200, 7100, 7100], 70, 36, 64, 0.1);
        m.scatter(70, [150, 150, 7200, 7200], 50, (x, y) => m.rock(x - 45, y - 35, ri(70, 120), ri(60, 100)), 40);
        m.scatter(30, [150, 150, 7200, 7200], 40, (x, y) => m.prop('prop_wood_log', x - 60, y - 20, 120, 40, ri(0, 3) * 45), 40);
        m.scatter(30, [150, 150, 7200, 7200], 45, (x, y) => m.prop('prop_puddle', x - 60, y - 40, 120, 80), 40);
        m.scatter(10, [300, 300, 6900, 6900], 70, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 3) * 45), 40);
        m.scatter(14, [300, 300, 6900, 6900], 40, (x, y) => { m.crate(x - 52, y - 25); m.crate(x, y - 25); }, 40);
        m.scatter(10, [300, 300, 6900, 6900], 40, (x, y) => m.hedge(x - 30, y - 30), 40);
        for (let i = 0; i < 16; i++) { const a = i / 16 * L.TAU; m.P(3750 + Math.cos(a) * 2900, 3750 + Math.sin(a) * 2900); }
        m.P(3750, 3200);
    });

    // ===================================== TV CENTER =====================================
    def('TV Center', 7500, 'asphalt', BR, '#3f4247', m => {
        const CX = 3750, CY = 3750, WALL = '#64748b', GLASS = '#94a3b8';
        const FL = { hall: '#6b7280', office: '#57534e', studio: '#1f2937', studio2: '#1f2937', server: '#0f172a', canteen: '#78716c', lobby: '#cbd5e1' }, FS = { hall: 'tile', office: 'carpet', studio: 'carpet', studio2: 'carpet', server: 'plate', canteen: 'tile', lobby: 'tile' };
        const SY0 = 3610, SH = 280, XS = 2000, XE = 5500;      // головний коридор («хребет»)
        // кімнати вздовж хребта: ряд 1 (впритул до коридору) і ряд 2 (далі)
        const row = [[2000, 700, 'studio'], [2700, 520, 'office'], [3220, 520, 'office'], [3740, 760, 'studio'], [4500, 520, 'canteen'], [5020, 480, 'office']];
        const row2 = [[2000, 900, 'studio2'], [2900, 600, 'office'], [3500, 1000, 'studio2'], [4500, 1000, 'server']];
        const FURN = {
            studio: [['prop_monitor', 140, 40, 'wall'], ['prop_desk', 120, 60, 'center'], ['prop_spotlight', 40, 40, 'corner'], ['prop_spotlight', 40, 40, 'corner'], ['prop_sofa', 120, 50, 'wall'], ['prop_server', 50, 90, 'corner'], ['prop_plant', 40, 40, 'corner'], ['prop_crate', 50, 50, 'corner']],
            studio2: [['prop_monitor', 140, 40, 'wall'], ['prop_monitor', 140, 40, 'wall'], ['prop_spotlight', 40, 40, 'corner'], ['prop_spotlight', 40, 40, 'corner'], ['prop_spotlight', 40, 40, 'corner'], ['prop_desk', 120, 60, 'center'], ['prop_desk', 120, 60, 'center'], ['prop_sofa', 120, 50, 'wall'], ['prop_shelf', 200, 40, 'wall'], ['prop_glass', 160, 20, 'center']],
            office: [['prop_desk', 110, 60, 'center'], ['prop_desk', 110, 60, 'center'], ['prop_monitor', 70, 40, 'wall'], ['prop_monitor', 70, 40, 'wall'], ['prop_shelf', 160, 40, 'wall'], ['prop_plant', 40, 40, 'corner'], ['prop_plant', 40, 40, 'corner'], ['prop_vending', 60, 80, 'wall']],
            canteen: [['prop_wood_table', 100, 50, 'center'], ['prop_wood_table', 100, 50, 'center'], ['prop_wood_table', 100, 50, 'center'], ['prop_vending', 60, 80, 'wall'], ['prop_vending', 60, 80, 'wall'], ['prop_wood_bench', 100, 30, 'wall'], ['prop_plant', 40, 40, 'corner']],
            server: [['prop_monitor', 70, 40, 'wall'], ['prop_gas', 34, 34, 'corner'], ['prop_gas', 34, 34, 'corner'], ['prop_desk', 110, 60, 'wall']]
        };
        const roofOf = t => t === 'server' ? '#1e293b' : t.indexOf('studio') === 0 ? '#334155' : '#475569';
        const cDoor = (x, w) => Math.min(x + w - 120, Math.max(x + 120, x + w / 2));      // точка проходу між рядами (однакова для обох кімнат)
        const spineEnts = [{ side: 'w', c: SY0 + SH / 2, g: 160 }, { side: 'e', c: SY0 + SH / 2, g: 160 }];
        row.forEach(([x, w], i) => { spineEnts.push({ side: 'n', c: x + w / 2, g: 140 }); spineEnts.push({ side: 's', c: x + w / 2 + (i % 2 ? 60 : -60), g: 140 }); });
        const sp = m.bld(XS, SY0, XE - XS, SH, { T: 28, wall: WALL, floor: FL.hall, fs: 'tile', roof: '#52606f', ents: spineEnts });
        m.fillGrid(sp, 'prop_plant', 40, 40, 420, 400, 60);
        const R1H = 560, R2H = 640;
        [-1, 1].forEach(dir => {
            row.forEach(([x, w, t], i) => {
                const y = dir < 0 ? SY0 - R1H : SY0 + SH, toSpine = dir < 0 ? 's' : 'n', away = dir < 0 ? 'n' : 's';
                const ents = [{ side: toSpine, c: x + w / 2 + (dir > 0 ? (i % 2 ? 60 : -60) : 0), g: 140, door: i % 3 === 0 ? 'prop_door_glass' : null }];
                const c2 = cDoor(x, w); if (row2.some(([x2, w2]) => c2 > x2 + 100 && c2 < x2 + w2 - 100)) ents.push({ side: away, c: c2, g: 140 });
                const b = m.bld(x, y, w, R1H, { T: 28, wall: WALL, floor: FL[t], fs: FS[t], roof: roofOf(t), ents });
                FURN[t].forEach(f => m.furnish(b, f));
            });
            row2.forEach(([x, w, t]) => {
                const y = dir < 0 ? SY0 - R1H - R2H : SY0 + SH + R1H, toR1 = dir < 0 ? 's' : 'n', ents = [];
                row.forEach(([x1, w1]) => { const c = cDoor(x1, w1); if (c > x + 100 && c < x + w - 100) ents.push({ side: toR1, c, g: 140 }); });
                ents.push({ side: dir < 0 ? 'n' : 's', at: t === 'studio2' ? 0.25 : 0.5, g: 160, door: t === 'server' ? 'prop_door_metal_d' : null });      // вихід надвір
                const b = m.bld(x, y, w, R2H, { T: 28, wall: WALL, floor: FL[t], fs: FS[t], roof: roofOf(t), ents, parts: t === 'studio2' ? [{ axis: 'v', at: 0.5, gap: 0.5, g: 180 }] : [] });
                if (t === 'server') m.fillGrid(b, 'prop_server', 50, 90, 140, 200, 90); FURN[t].forEach(f => m.furnish(b, f));
            });
        });
        // хол (захід): світлий зал зі скляними перегородками, диванами й рецепцією
        const LB = m.bld(1100, 3150, 900, 1200, { T: 30, wall: GLASS, floor: FL.lobby, fs: 'tile', roof: '#cbd5e1', stripe: '#38bdf8', ents: [{ side: 'w', at: 0.5, g: 220, door: 'prop_door_glass' }, { side: 'e', c: SY0 + SH / 2, g: 160 }, { side: 'n', at: 0.5, g: 150 }, { side: 's', at: 0.5, g: 150 }] });
        [['prop_desk', 160, 60, 'center'], ['prop_sofa', 130, 50, 'wall'], ['prop_sofa', 130, 50, 'wall'], ['prop_sofa', 130, 50, 'wall'], ['prop_plant', 44, 44, 'corner'], ['prop_plant', 44, 44, 'corner'], ['prop_plant', 44, 44, 'corner'], ['prop_plant', 44, 44, 'corner'], ['prop_glass', 200, 20, 'center'], ['prop_glass', 200, 20, 'center'], ['prop_vending', 60, 80, 'wall'], ['prop_monitor', 140, 40, 'wall']].forEach(f => m.furnish(LB, f));
        // технічний корпус (схід): серверна зала й генератори
        const TE = m.bld(5500, 3200, 800, 1100, { T: 30, wall: '#475569', floor: FL.server, fs: 'plate', roof: '#1e293b', stripe: '#facc15', ents: [{ side: 'w', c: SY0 + SH / 2, g: 160 }, { side: 'e', at: 0.5, g: 180, door: 'prop_door_metal_d' }, { side: 'n', at: 0.5, g: 150 }, { side: 's', at: 0.5, g: 150 }] });
        m.fillGrid(TE, 'prop_server', 50, 90, 130, 220, 100); [['prop_gas', 34, 34, 'corner'], ['prop_gas', 34, 34, 'corner'], ['prop_generator', 80, 70, 'wall']].forEach(f => m.furnish(TE, f));
        // телевежа та парковки
        m.sq(CX - 70, 1500, 140, 140, '#334155', { neon: '#f43f5e' }); m.keep(CX, 1570, 160);
        [[CX - 400, 1350], [CX + 330, 1350], [CX - 400, 1720], [CX + 330, 1720]].forEach(([x, y]) => m.sq(x, y, 70, 70, '#475569'));
        const parking = (x0, y0, cols, rows) => { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = x0 + c * 200, y = y0 + r * 260; m.line([[x, y], [x, y + 160]], 6, '#e5e7eb'); if (L.rnd() < 0.55 && m.free(x + 100, y + 80, 60)) m.prop('prop_wreck', x + 30, y + 40, 140, 80, 90); } };
        parking(1100, 5200, 10, 3); parking(4300, 5200, 10, 3); parking(1200, 1100, 7, 2); parking(4800, 1100, 7, 2);
        m.road([[600, 900], [6900, 900]], 180, '#2f3237', '#facc15'); m.road([[600, 6500], [6900, 6500]], 180, '#2f3237', '#facc15');
        m.road([[600, 900], [600, 6500]], 180, '#2f3237', '#facc15'); m.road([[6900, 900], [6900, 6500]], 180, '#2f3237', '#facc15');
        m.road([[600, CY], [1100, CY]], 160, '#2f3237', '#e5e7eb'); m.road([[6300, CY], [6900, CY]], 160, '#2f3237', '#e5e7eb');
        // будки охорони й кіоски по периметру
        [[700, 650], [6550, 650], [700, 6650], [6550, 6650], [3600, 6750], [3600, 600]].forEach(([x, y]) => { if (m.rectFree(x, y, 260, 200, 40)) { const b = m.bld(x, y, 260, 200, { T: 22, wall: '#475569', floor: '#4b5563', fs: 'carpet', roof: '#1e3a5f', ents: [{ side: 's', at: 0.5, g: 130, door: 'prop_door_glass' }, { side: 'n', at: 0.5, g: 120 }] }); m.furnish(b, ['prop_desk', 100, 60, 'wall']); m.furnish(b, ['prop_monitor', 70, 40, 'wall']); } });
        // сквери, лавки й міський декор
        m.forest([200, 200, 7100, 7100], 120, 34, 60, 0.3);
        m.scatter(30, [200, 200, 7100, 7100], 40, (x, y) => m.prop('prop_wood_bench', x - 50, y - 15, 100, 30, ri(0, 1) * 90), 40);
        m.scatter(26, [200, 200, 7100, 7100], 45, (x, y) => m.prop('prop_cone', x - 15, y - 15, 30, 30), 40);
        m.scatter(18, [200, 200, 7100, 7100], 45, (x, y) => { m.barrel(x - 44, y - 20); m.barrel(x + 4, y - 20); }, 40);
        m.scatter(14, [200, 200, 7100, 7100], 45, (x, y) => { m.gas(x - 40, y - 17); m.gas(x + 2, y - 17); }, 40);
        m.scatter(16, [200, 200, 7100, 7100], 50, (x, y) => m.conc(x - 50, y - 25, 100, 50, ri(0, 3) * 45), 40);
        m.scatter(12, [200, 200, 7100, 7100], 110, (x, y) => { const v = L.rnd() < 0.5; m.prop(pick(['prop_cont_red', 'prop_cont_blue']), v ? x - 40 : x - 100, v ? y - 100 : y - 40, v ? 80 : 200, v ? 200 : 80); }, 40);
        m.scatter(20, [200, 200, 7100, 7100], 40, (x, y) => m.prop(pick(['prop_vending', 'prop_plant', 'prop_crate']), x - 25, y - 30, 50, 60), 40);
        for (let i = 0; i < 16; i++) { const a = i / 16 * L.TAU + 0.1; m.P(CX + Math.cos(a) * 2850, CY + Math.sin(a) * 2850); }
        m.P(CX, CY);
    });
};
