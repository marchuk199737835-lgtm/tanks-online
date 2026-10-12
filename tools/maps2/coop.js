// 10 мап для кооперативу й соло: виживання / оборона (космічна станція, зореліт, тропічний острів), конвой (джунглі, Марс),
// рейд на боса (кратер прибульців, затонулий корабель), арена хвиль / дуель (орбітальна арена, жерло вулкана, крижана печера).
// У кооперативі менше барикад і більше простору для маневру проти орд.
'use strict';
module.exports = function (def, L) {
    const { rr, ri, pick, TAU } = L, MO = L.MO;
    const SURV = ['base_defense', 'survival'], RAID = ['boss_raid', 'survival'], SOLO = ['solo_arena', 'boss_duel'];
    const deco = (m, rect, n, kinds, rad, rot) => m.scatter(n, rect, rad || 40, (x, y) => { const k = pick(kinds); m.prop(k[0], x - k[1] / 2, y - k[2] / 2, k[1], k[2], rot ? ri(0, 3) * 45 : 0); }, 60);
    // точки зомбі по краю фігурної мапи (трохи всередині)
    const edgeZ = (m, n, inset) => { const sh = m.m.shape; if (!sh) return; const cx = sh.reduce((a, p) => a + p.x, 0) / sh.length, cy = sh.reduce((a, p) => a + p.y, 0) / sh.length; for (let i = 0; i < n; i++) { const p = sh[Math.floor(i / n * sh.length)], dx = cx - p.x, dy = cy - p.y, l = Math.hypot(dx, dy) || 1; m.Z(p.x + dx / l * (inset || 160), p.y + dy / l * (inset || 160)); } };
    const ringZ = (m, cx, cy, R, n, ph) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + (ph || 0); m.Z(cx + Math.cos(a) * R, cy + Math.sin(a) * R); } };

    // ============ 11. ОРБІТАЛЬНА СТАНЦІЯ — реакторне ядро в центрі, 4 модулі, енергетичні ями ============
    def('Orbital Station', 3200, 'space', SURV, null, m => {
        const S = 3200, C = 1600; m.border(60, '#1e293b');
        // реакторна зала навколо ядра: 4 широкі проходи (зомбі мусять мати шлях до ядра)
        const R = m.bld(C - 380, C - 380, 760, 760, { T: 32, wall: '#334155', floor: '#0f172a', fs: 'plate', roof: '#1e293b', stripe: '#38bdf8', roofless: true,
            ents: [{ side: 'n', at: 0.5, g: 220 }, { side: 's', at: 0.5, g: 220 }, { side: 'w', at: 0.5, g: 220 }, { side: 'e', at: 0.5, g: 220 }] });
        m.mk('spawn_core', C, C); m.prop('prop_pad', C - 110, C - 110, 220, 220); m.keep(C, C, 130);
        [[-250, -250], [190, -250], [-250, 190], [190, 190]].forEach(([dx, dy]) => m.prop('prop_crystal', C + dx, C + dy, 60, 60));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(C + sx * 160, C + sy * 160));
        // світлові доріжки від ядра
        [[C, 0], [C, S], [0, C], [S, C]].forEach(([x, y]) => m.road([[C, C], [x, y]], 120, '#1e293b', '#38bdf8'));
        // модулі на діагоналях
        const MF = { lab: [['prop_server', 50, 90, 'wall'], ['prop_server', 50, 90, 'wall'], ['prop_monitor', 140, 40, 'wall'], ['prop_desk', 110, 60, 'center'], ['prop_gas', 34, 34, 'corner']], hab: [['prop_sofa', 120, 50, 'wall'], ['prop_desk', 110, 60, 'center'], ['prop_plant', 40, 40, 'corner'], ['prop_vending', 60, 80, 'wall'], ['prop_shelf', 160, 40, 'wall']] };
        [[350, 350, 'lab', 's'], [2290, 350, 'hab', 's'], [350, 2410, 'hab', 'n'], [2290, 2410, 'lab', 'n']].forEach(([x, y, t, sd]) => {
            const b = m.bld(x, y, 560, 440, { T: 28, wall: '#2b3448', floor: '#111827', fs: 'plate', roof: '#1e1b4b', stripe: '#818cf8', ents: [{ side: sd, at: 0.3, g: 160, door: 'prop_door_space_s' }, { side: sd, at: 0.8, g: 150 }, { side: x < C ? 'e' : 'w', at: 0.5, g: 150 }] });
            MF[t].forEach(f => m.furnish(b, f));
        });
        // енергетичні ями (непрохідні), сонячні панелі, термінали
        [[C - 750, C - 260, 300, 200], [C + 450, C + 60, 300, 200], [C - 160, C - 900, 200, 260], [C - 40, C + 640, 200, 260]].forEach(([x, y, w, h]) => { if (m.rectFree(x, y, w, h, 40)) m.water(x, y, w, h, true); });
        m.scatter(10, [150, 150, 2900, 2900], 70, (x, y) => m.prop('prop_solar', x - 50, y - 35, 100, 70), 50);
        m.scatter(8, [150, 150, 2900, 2900], 40, (x, y) => m.prop('prop_terminal', x - 25, y - 25, 50, 50), 50);
        m.scatter(6, [200, 200, 2800, 2800], 45, (x, y) => { m.gas(x - 40, y - 17); m.gas(x + 2, y - 17); }, 50);
        deco(m, [150, 150, 2900, 2900], 10, [['prop_crate', 50, 50], ['prop_pipe', 150, 30], ['prop_generator', 80, 70]], 50, true);
        ringZ(m, C, C, 1450, 12, 0.13);
        [[C - 300, C - 600], [C + 300, C + 600], [C - 600, C + 300], [C + 600, C - 300], [800, C], [2400, C], [C, 800], [C, 2400]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 12. ЗОРЕЛІТ — корпус корабля: рубка з ядром на носі, коридор, відсіки, машинне відділення ============
    def('Starship', 3400, 'space', SURV, null, m => {
        const S = 3400, CY = 1700;
        m.m.shape = [[250, 1450], [650, 1000], [1500, 820], [2500, 880], [3150, 1450], [3260, 1700], [3150, 1950], [2500, 2520], [1500, 2580], [650, 2400], [250, 1950]].map(([x, y]) => ({ x, y }));
        // центральний коридор (світла смуга) і відсіки над / під ним
        m.floor(500, CY - 150, 2400, 300, '#1f2937'); m.keepRect(500, CY - 150, 2400, 300);
        const bayF = { cargo: [['prop_crate', 50, 50, 'corner'], ['prop_crate', 50, 50, 'corner'], ['prop_shelf', 200, 40, 'wall'], ['prop_gas', 34, 34, 'corner']], crew: [['prop_sofa', 120, 50, 'wall'], ['prop_desk', 110, 60, 'center'], ['prop_plant', 40, 40, 'corner'], ['prop_vending', 60, 80, 'wall']], med: [['prop_server', 50, 90, 'wall'], ['prop_monitor', 140, 40, 'wall'], ['prop_desk', 110, 60, 'center']], arm: [['prop_shelf', 200, 40, 'wall'], ['prop_crate', 50, 50, 'corner'], ['prop_barrel', 40, 40, 'corner']] };
        [[900, 'cargo'], [1500, 'crew'], [2100, 'med']].forEach(([x, t], i) => {
            const up = m.bld(x, 1050, 520, 450, { T: 28, wall: '#2b3448', floor: '#111827', fs: 'plate', roof: '#1e1b4b', ents: [{ side: 's', at: 0.3, g: 160, door: 'prop_door_space_s' }, { side: 's', at: 0.8, g: 150 }] });
            bayF[t].forEach(f => m.furnish(up, f));
            const dn = m.bld(x, 1900, 520, 450, { T: 28, wall: '#2b3448', floor: '#111827', fs: 'plate', roof: '#1e1b4b', ents: [{ side: 'n', at: 0.25, g: 150 }, { side: 'n', at: 0.75, g: 160, door: 'prop_door_space_s' }] });
            bayF[i === 1 ? 'arm' : t].forEach(f => m.furnish(dn, f));
        });
        // рубка (ніс) — ядро для оборони
        m.mk('spawn_core', 2900, CY); m.prop('prop_pad', 2790, CY - 110, 220, 220); m.keep(2900, CY, 140);
        [[2700, CY - 260], [2700, CY + 210], [3050, CY - 200], [3050, CY + 150]].forEach(([x, y]) => m.prop('prop_terminal', x, y, 50, 50));
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(2900 + sx * 150, CY + sy * 140));
        // машинне відділення (корма): генератори й балони
        [[420, CY - 300], [420, CY + 220], [620, CY - 420], [620, CY + 340]].forEach(([x, y]) => m.prop('prop_generator', x, y, 80, 70));
        [[560, CY - 120], [560, CY + 60]].forEach(([x, y]) => { m.gas(x, y); m.gas(x + 40, y); });
        m.scatter(8, [400, 900, 2700, 1600], 50, (x, y) => { if (m.inShape(x, y, 60)) m.prop('prop_pipe', x - 75, y - 15, 150, 30, ri(0, 1) * 90); }, 60);
        m.scatter(6, [400, 900, 2700, 1600], 40, (x, y) => { if (m.inShape(x, y, 50)) m.crate(x - 25, y - 25); }, 60);
        // зомбі: з корми й пробоїн у корпусі
        [[350, CY - 120], [350, CY + 120], [700, 1080], [700, 2320], [1400, 920], [1400, 2480], [2300, 960], [2300, 2440], [1800, 950], [1800, 2450]].forEach(([x, y]) => m.Z(x, y));
        [[1200, CY], [1800, CY], [2400, CY], [800, CY], [2700, CY - 400], [2700, CY + 400]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 13. ТРОПІЧНИЙ ОСТРІВ — острів із лагуною, пальмами й хатинками; ядро в селі ============
    def('Tropic Island', 3600, 'sand', SURV, null, m => {
        const C = 1800; m.m.shape = L.blob(C, C, 1580, 48, 0.1, 3);
        m.water(2200, 650, 760, 520, true); m.keepRect(2120, 570, 920, 680);      // лагуна
        m.mk('spawn_core', C, C); m.prop('prop_campfire', C - 25, C - 25, 50, 50); m.keep(C, C, 150);
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => m.P(C + sx * 170, C + sy * 170));
        const hutF = [['prop_hay', 80, 80, 'corner'], ['prop_wood_table', 100, 50, 'center'], ['prop_wood_barrel', 44, 44, 'corner'], ['prop_crate', 50, 50, 'corner']];
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.4, x = C + Math.cos(a) * 520 - 140, y = C + Math.sin(a) * 520 - 120; if (m.rectFree(x, y, 280, 240, 40)) { const sd = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'w' : 'e') : (Math.sin(a) > 0 ? 'n' : 's'); const b = m.bld(x, y, 280, 240, { T: 22, wall: '#a16207', floor: '#c2a272', roof: '#ca8a04', ents: [{ side: sd, at: 0.5, g: 140 }] }); hutF.forEach(f => m.furnish(b, f)); } }
        // причал і човни
        m.line([[C, 3000], [C, 3380]], 120, '#8a6a4a', '#6b4a2b');
        m.scatter(5, [300, 300, 3000, 3000], 70, (x, y) => { if (m.inShape(x, y, 260) || !m.inShape(x, y, 80)) return; m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 3) * 45); }, 80);
        m.forest([200, 200, 3200, 3200], 90, 40, 70, 0.25);
        m.scatter(18, [200, 200, 3200, 3200], 50, (x, y) => m.rock(x - 45, y - 35, ri(70, 110), ri(60, 90)), 50);
        deco(m, [300, 300, 3000, 3000], 10, [['prop_crate', 50, 50], ['prop_wood_barrel', 44, 44], ['prop_hay', 80, 80], ['prop_tent', 90, 80]], 50);
        m.scatter(5, [300, 300, 3000, 3000], 45, (x, y) => { m.barrel(x - 44, y - 20); m.barrel(x + 4, y - 20); }, 50);
        edgeZ(m, 14, 170);
        [[C - 400, C], [C + 400, C], [C, C - 400], [C, C + 400], [900, 900], [2700, 2700], [900, 2700], [2700, 1700]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ КОНВОЙ: коридор-маршрут (як у genmaps.js) ============
    function convoy(name, theme, bg, ctrl, opt) {
        def(name, 3600, theme, ['convoy'], bg, m => {
            let chord = 0; for (let i = 1; i < ctrl.length; i++) chord += Math.hypot(ctrl[i][0] - ctrl[i - 1][0], ctrl[i][1] - ctrl[i - 1][1]);
            const route = L.spline(ctrl, Math.max(60, chord * 1.15 / 135)); m.m.shape = L.corridor(route);
            const pts = route.map(r => [r[0], r[1]]); m.road(pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1), opt.roadW, opt.roadColor, opt.roadStripe);
            const A = ctrl[0], B = ctrl[ctrl.length - 1]; m.mk('spawn_convoy_a', A[0], A[1]); m.mk('spawn_convoy_b', B[0], B[1]);
            const dx = ctrl[1][0] - A[0], dy = ctrl[1][1] - A[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l;
            [[-60, -70], [-60, 70], [-130, -70], [-130, 70]].forEach(([a, b]) => m.P(A[0] + ux * (a + 140) - uy * b, A[1] + uy * (a + 140) + ux * b));
            opt.decor(m, route, ctrl);
            let n = 0;
            for (let i = 12; i < route.length - 8; i += Math.round(route.length / 11)) {
                const r = route[i], a = route[i - 1], b = route[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, side = n % 2 ? 1 : -1, off = r[2] * 0.62;
                const zx = r[0] + nx * off * side, zy = r[1] + ny * off * side; if (!MO.collides(m.m, zx, zy, 40)) m.Z(zx, zy);
                const ux2 = r[0] - nx * off * 0.5 * side, uy2 = r[1] - ny * off * 0.5 * side; if (!MO.collides(m.m, ux2, uy2, 30)) m.U(ux2, uy2);
                n++;
            }
            for (let k = 1; k <= 3; k++) { const r = route[route.length - 1 - k * 5]; if (r && !MO.collides(m.m, r[0], r[1], 40)) m.Z(r[0] + (k % 2 ? 80 : -80), r[1] + 60); }
        });
    }
    // ============ 14. ДЖУНГЛІ ============
    convoy('Jungle Run', 'swamp', '#3b5440', [[300, 3250, 210], [1000, 3050, 240], [1500, 3300, 200], [2300, 3050, 250], [3000, 3200, 200], [3250, 2500, 240], [2600, 2000, 200], [1800, 2250, 250], [1000, 1900, 200], [500, 1300, 240], [1000, 650, 210], [1900, 450, 250], [2700, 750, 200], [3300, 400, 210]],
        { roadW: 210, roadColor: '#5c4a32', roadStripe: null, decor: (m, route, ctrl) => {
            L.edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 2 === 0) m.tree(x + sd * 8, y, rr(40, 64)); else if (i % 5 === 1) m.bush(x - 30, y - 30); }, 1, 0.93);
            L.edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 11 === 5) m.wall(x - 60, y - 20, 120, 40, '#6b6f68'); }, 3, 0.72);      // руїни храмів
            ctrl.slice(2, -2).forEach((c, k) => { if (k % 2) { m.prop('prop_statue', c[0] + 100, c[1] - 120, 60, 60); m.prop('prop_wood_log', c[0] - 160, c[1] + 70, 120, 40, 30); } else { m.prop('prop_hay', c[0] + 110, c[1] + 60, 80, 80); m.prop('prop_wood_barrel', c[0] - 140, c[1] - 80, 44, 44); } });
            m.scatter(18, [0, 0, 3600, 3600], 60, (x, y) => { if (m.inShape(x, y, 60)) m.tree(x, y, rr(36, 60)); }, 80);
            m.scatter(10, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.prop('prop_puddle', x - 60, y - 40, 120, 80); }, 80);
            m.scatter(8, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.crate(x - 25, y - 25); }, 80);
        } });
    // ============ 15. МАРСІАНСЬКИЙ КАНЬЙОН ============
    convoy('Mars Canyon', 'mars', '#a4512f', [[300, 3200, 200], [1100, 3300, 240], [1800, 3050, 200], [2500, 3250, 240], [3200, 2800, 200], [3000, 2100, 250], [2300, 1800, 200], [1500, 2000, 240], [800, 1700, 200], [600, 1000, 250], [1300, 600, 200], [2200, 700, 240], [2900, 450, 200], [3350, 300, 200]],
        { roadW: 200, roadColor: '#7a3b26', roadStripe: '#fdba74', decor: (m, route, ctrl) => {
            L.edgeProps(m, route, (x, y, ang, sd, i) => { if (i % 2 === 0) m.rock(x - 50, y - 40, ri(80, 130), ri(70, 110)); }, 1, 0.95);
            ctrl.slice(2, -2).forEach((c, k) => { if (k % 3 === 0) { m.sq(c[0] + 100, c[1] - 160, 120, 120, '#7a3b26', { neon: '#f97316' }); m.prop('prop_solar', c[0] - 180, c[1] + 60, 100, 70); } else if (k % 3 === 1) { m.prop('prop_wreck', c[0] - 70, c[1] + (k % 2 ? 70 : -150), 140, 80, 20 * k); m.gas(c[0] + 120, c[1] + 40); m.gas(c[0] + 160, c[1] + 40); } else { m.prop('prop_crystal', c[0] + 120, c[1] - 100, 60, 60); m.prop('prop_crate', c[0] - 150, c[1] + 50, 50, 50); } });
            m.scatter(16, [0, 0, 3600, 3600], 50, (x, y) => { if (m.inShape(x, y, 50)) m.rock(x - 40, y - 30); }, 80);
            m.scatter(6, [0, 0, 3600, 3600], 45, (x, y) => { if (m.inShape(x, y, 45)) m.prop('prop_crater', x - 40, y - 40, 80, 80); }, 80);
        } });

    // ============ 16. КРАТЕР ПРИБУЛЬЦІВ — рейд: вулик у центрі, кристали, капсули ============
    def('Alien Crater', 3400, 'mars', RAID, null, m => {
        const C = 1700; m.m.shape = L.blob(C, C, 1500, 44, 0.09, 4);
        m.Z(C, C - 120); m.keep(C, C - 120, 260);      // бос — у вулику
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, x = C + Math.cos(a) * 380, y = C - 120 + Math.sin(a) * 380; m.neon('neon_circle', x - 45, y - 45, 90, 90, i % 2 ? '#a3e635' : '#22d3ee'); }
        for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + 0.2, x = C + Math.cos(a) * rr(650, 1150), y = C + Math.sin(a) * rr(650, 1150); if (m.free(x, y, 60)) m.prop('prop_crystal', x - 35, y - 35, 70, 70); }
        // кільце скель на схилі кратера
        for (let i = 0; i < 26; i++) { const a = i / 26 * TAU, x = C + Math.cos(a) * 1250, y = C + Math.sin(a) * 1250; if (m.free(x, y, 60)) m.rock(x - 50, y - 40, ri(80, 130), ri(70, 110)); }
        m.scatter(10, [300, 300, 2800, 2800], 50, (x, y) => m.prop('prop_crater', x - 40, y - 40, 80, 80), 60);
        m.scatter(4, [400, 400, 2600, 2600], 50, (x, y) => { m.gas(x - 40, y - 17); m.gas(x + 2, y - 17); }, 60);
        m.scatter(5, [400, 400, 2600, 2600], 70, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 3) * 45), 60);
        [1480, 1580, 1680, 1780, 1880].forEach(x => m.P(x, 2950));
        ringZ(m, C, C, 1050, 6, 0.4);
        [[900, C], [2500, C], [C, 2500], [1100, 2300], [2300, 2300], [C, 900]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 17. ЗАТОНУЛИЙ КОРАБЕЛЬ — рейд: іржавий корпус посередині, розсипані контейнери, калюжі ============
    def('Sunken Ship', 3400, 'sand', RAID, '#b9a06a', m => {
        const S = 3400, C = 1700; m.border(50, '#8a7a5c');
        // корпус: обрис корабля з проломами
        const hull = [[900, 1700], [1200, 1350], [2200, 1300], [2700, 1500], [2850, 1700], [2700, 1900], [2200, 2100], [1200, 2050]];
        for (let i = 0; i < hull.length; i++) { if (i === 1 || i === 5) continue; const a = hull[i], b = hull[(i + 1) % hull.length]; m.segw(a[0], a[1], b[0], b[1], 40, '#9a4d2f', { stripe: '#7a3b26' }); }
        m.floor(1200, 1420, 1400, 560, '#6b4a2b'); m.Z(1900, 1700); m.keep(1900, 1700, 240);
        [[1350, 1500], [2300, 1520], [1450, 1850], [2250, 1880]].forEach(([x, y]) => m.sq(x, y, 90, 90, '#7a3b26'));
        // контейнери, бочки, калюжі морської води
        m.scatter(12, [300, 300, 2800, 2800], 120, (x, y) => { const v = L.rnd() < 0.5; m.prop(pick(['prop_cont_red', 'prop_cont_blue']), v ? x - 40 : x - 100, v ? y - 100 : y - 40, v ? 80 : 200, v ? 200 : 80, ri(0, 3) * 15); }, 60);
        m.scatter(8, [200, 200, 3000, 3000], 160, (x, y) => m.water(x - 130, y - 90, 260, 180, true), 60);
        m.scatter(8, [300, 300, 2800, 2800], 45, (x, y) => { m.barrel(x - 44, y - 20); m.barrel(x + 4, y - 20); }, 60);
        m.scatter(10, [300, 300, 2800, 2800], 50, (x, y) => m.prop('prop_crystal', x - 30, y - 30, 60, 60), 60);
        m.scatter(14, [200, 200, 3000, 3000], 50, (x, y) => m.rock(x - 45, y - 35, ri(70, 110), ri(60, 90)), 60);
        [1500, 1600, 1700, 1800, 1900].forEach(x => m.P(x, S - 250));
        ringZ(m, C, C, 1200, 6, 0.3);
        [[700, C], [2700, 900], [C, 2900], [900, 900], [2700, 2600], [C, 600]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 18. ОРБІТАЛЬНА АРЕНА — кругла космічна арена з неоновими колонами ============
    def('Orbital Arena', 2400, 'space', SOLO, null, m => {
        const C = 1200; m.m.shape = L.circlePoly(C, C, 1120, 48);
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + TAU / 16, x = C + Math.cos(a) * 520, y = C + Math.sin(a) * 520; m.sq(x - 45, y - 45, 90, 90, '#2b3448', { neon: '#38bdf8' }); }
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, x = C + Math.cos(a) * 820, y = C + Math.sin(a) * 820; m.water(x - 110, y - 80, 220, 160, true); }
        m.prop('prop_pad', C - 110, C - 110, 220, 220); m.P(C, C); m.keep(C, C, 140);
        m.scatter(6, [300, 300, 1800, 1800], 40, (x, y) => m.crate(x - 25, y - 25), 60);
        m.scatter(4, [300, 300, 1800, 1800], 40, (x, y) => m.gas(x - 17, y - 17), 60);
        m.scatter(6, [300, 300, 1800, 1800], 40, (x, y) => m.prop('prop_terminal', x - 25, y - 25, 50, 50), 60);
        ringZ(m, C, C, 1000, 12, 0.1);
        [[C - 300, C], [C + 300, C], [C, C - 300], [C, C + 300]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 19. ЖЕРЛО ВУЛКАНА — лавові озера, обсидіан ============
    def('Volcano Core', 2400, 'lava', SOLO, null, m => {
        const C = 1200; m.m.shape = L.blob(C, C, 1080, 40, 0.1, 5);
        [[C - 600, C - 420, 300, 200], [C + 300, C - 500, 260, 220], [C - 520, C + 320, 260, 220], [C + 330, C + 340, 300, 200], [C - 120, C - 820, 240, 160]].forEach(([x, y, w, h]) => m.water(x, y, w, h, true));
        m.P(C, C); m.keep(C, C, 160);
        for (let i = 0; i < 18; i++) { const x = rr(300, 2100), y = rr(300, 2100); if (m.free(x, y, 60)) m.prop('prop_rock', x - 45, y - 40, ri(70, 110), ri(60, 90)); }
        m.scatter(8, [300, 300, 1800, 1800], 50, (x, y) => m.prop('prop_crater', x - 40, y - 40, 80, 80), 60);
        m.scatter(4, [300, 300, 1800, 1800], 40, (x, y) => m.barrel(x - 20, y - 20), 60);
        edgeZ(m, 12, 150);
        [[C - 300, C], [C + 300, C], [C, C - 300], [C, C + 300]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 20. КРИЖАНА ПЕЧЕРА — нерівні стіни печери, крижані колони, кристали ============
    def('Ice Cave', 2400, 'snow', SOLO, '#cfdde8', m => {
        const C = 1200; m.m.shape = L.blob(C, C, 1060, 52, 0.16, 6);
        for (let i = 0; i < 10; i++) { const x = rr(350, 2050), y = rr(350, 2050); if (Math.hypot(x - C, y - C) > 260 && m.free(x, y, 80)) m.sq(x - 45, y - 45, ri(70, 110), ri(70, 110), '#a9c7dc', { stripe: '#e0f2fe' }, ri(0, 3) * 15); }
        for (let i = 0; i < 12; i++) { const x = rr(300, 2100), y = rr(300, 2100); if (m.free(x, y, 50)) m.prop('prop_crystal', x - 30, y - 30, 60, 60); }
        m.scatter(10, [300, 300, 1800, 1800], 50, (x, y) => m.rock(x - 40, y - 35), 60);
        m.water(C + 380, C - 520, 260, 180, true); m.water(C - 640, C + 360, 240, 200, true);
        m.P(C, C); m.keep(C, C, 160);
        edgeZ(m, 12, 150);
        [[C - 300, C], [C + 300, C], [C, C - 300], [C, C + 300]].forEach(([x, y]) => m.U(x, y));
    });
};
