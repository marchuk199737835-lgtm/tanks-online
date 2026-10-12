// 8 PvP-мап: 4 для детматчу / «Цілі» / хованок (2 малі, 2 середні) і 4 для командного бою / точок / раундів (2 малі, 1 середня, 1 велика)
'use strict';
module.exports = function (def, L) {
    const { rr, ri, pick } = L, FFA = ['deathmatch', 'bounty', 'prophunt'], TEAM = ['team_deathmatch', 'capture_points', 'rounds'];
    // розкид декору: kinds — [[тип, w, h], ...]
    const deco = (m, rect, n, kinds, rad, rot) => m.scatter(n, rect, rad || 40, (x, y) => { const k = pick(kinds); m.prop(k[0], x - k[1] / 2, y - k[2] / 2, k[1], k[2], rot ? ri(0, 3) * 45 : 0); }, 60);
    const barrels = (m, x, y) => { m.barrel(x - 44, y - 20); m.barrel(x + 4, y - 20); if (L.rnd() < 0.6) m.barrel(x - 20, y + 22); };
    const crates = (m, x, y) => { m.crate(x - 52, y - 25); m.crate(x, y - 25); if (L.rnd() < 0.5) m.crate(x - 26, y + 27); };

    // ============ 1. СКЛАД №9 — мала, метал: великий склад зі стелажами посередині, контейнерний двір ============
    def('Warehouse 9', 2400, 'metal', FFA, null, m => {
        const S = 2400; m.border(50, '#2f3a48');
        m.line([[120, 1200], [700, 1200]], 70, '#374151', '#facc15'); m.line([[1700, 1200], [2280, 1200]], 70, '#374151', '#facc15');
        const b = m.bld(700, 760, 1000, 880, { T: 30, wall: '#475569', floor: '#3a414c', fs: 'plate', roof: '#344256', stripe: '#facc15',
            ents: [{ side: 'w', at: 0.5, g: 170, door: 'prop_door_metal_d' }, { side: 'e', at: 0.5, g: 170 }, { side: 'n', at: 0.25, g: 140 }, { side: 's', at: 0.75, g: 140 }],
            parts: [{ axis: 'h', at: 0.28, gap: 0.82, g: 160, x0: 730, x1: 1000 }] });
        m.fillGrid(b, 'prop_shelf', 200, 40, 250, 125, 80);
        [['prop_crate', 50, 50, 'corner'], ['prop_gas', 34, 34, 'corner'], ['prop_wood_pallet', 80, 60, 'wall'], ['prop_barrel', 40, 40, 'corner'], ['prop_vending', 60, 80, 'wall']].forEach(f => m.furnish(b, f));
        // контейнерний двір і навантажувальні рампи
        [[160, 160], [420, 160], [1500, 160], [1760, 160], [160, 2120], [420, 2120], [1500, 2120], [1760, 2120]].forEach(([x, y], i) => m.prop(i % 2 ? 'prop_cont_red' : 'prop_cont_blue', x, y, 200, 80));
        [[140, 480], [140, 1560], [2180, 480], [2180, 1560]].forEach(([x, y], i) => m.prop(i % 2 ? 'prop_cont_blue' : 'prop_cont_red', x, y, 80, 200));
        [[1100, 300], [1100, 2000], [450, 1200], [1950, 1200]].forEach(([x, y]) => m.keep(x, y, 90));
        for (let i = 0; i < 6; i++) { const x = rr(200, 2200), y = rr(200, 2200); if (m.free(x, y, 70)) (i % 2 ? barrels : crates)(m, x, y); }
        // офіс охорони (можна заїхати)
        { const ob = m.bld(1700, 300, 380, 300, { T: 24, wall: '#475569', floor: '#4b5563', fs: 'carpet', roof: '#1e3a5f', ents: [{ side: 's', at: 0.3, g: 140, door: 'prop_door_glass' }, { side: 'w', at: 0.5, g: 130 }] });
            [['prop_desk', 110, 60, 'wall'], ['prop_monitor', 70, 40, 'wall'], ['prop_server', 50, 90, 'corner'], ['prop_plant', 40, 40, 'corner'], ['prop_sofa', 110, 50, 'wall']].forEach(f => m.furnish(ob, f)); }
        m.scatter(10, [200, 200, 2000, 2000], 120, (x, y) => { const v = L.rnd() < 0.5; m.prop(pick(['prop_cont_red', 'prop_cont_blue']), v ? x - 40 : x - 100, v ? y - 100 : y - 40, v ? 80 : 200, v ? 200 : 80); }, 80);
        for (let i = 0; i < 8; i++) { const x = rr(200, 2200), y = rr(200, 2200); if (m.free(x, y, 70)) crates(m, x, y); }
        deco(m, [150, 150, 2100, 2100], 20, [['prop_wood_pallet', 80, 60], ['prop_tires', 50, 50], ['prop_crate', 50, 50], ['prop_cone', 30, 30], ['prop_wood_planks', 90, 50], ['prop_gas', 34, 34]]);
        deco(m, [150, 150, 2100, 2100], 8, [['prop_wreck', 140, 80], ['prop_generator', 80, 70], ['prop_shelf', 200, 40]], 70, true);
        [[200, 700], [200, 1700], [2200, 700], [2200, 1700], [1200, 230], [1200, 2170], [600, 600], [1800, 1800], [600, 1800], [1500, 650]].forEach(([x, y]) => m.P(x, y));
        [[1200, 1200], [450, 450], [1950, 1950], [450, 1950], [1950, 450]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 2. НІЧНИЙ РИНОК — мала, асфальт: ряди ятів, неон, вузькі проходи, крамнички по краях ============
    def('Night Market', 2400, 'asphalt', FFA, '#2c2f36', m => {
        const S = 2400, C = 1200; m.border(50, '#1f2937');
        // центральний фонтан
        m.water(C - 130, C - 130, 260, 260, true); m.prop('prop_statue', C - 35, C - 35, 70, 70); m.keep(C, C, 230);
        [[C - 260, C - 260], [C + 200, C - 260], [C - 260, C + 200], [C + 200, C + 200]].forEach(([x, y], i) => m.neon('neon_pillar', x, y, 60, 60, ['#f0abfc', '#22d3ee', '#fde047', '#fb7185'][i]));
        // ряди ятів: намет + стіл + ящики; між рядами — проходи
        const neons = ['#f0abfc', '#22d3ee', '#fde047', '#fb7185', '#4ade80'];
        for (let row = 0; row < 4; row++) for (let col = 0; col < 6; col++) {
            const x = 300 + col * 320, y = 330 + row * 520; if (Math.hypot(x + 60 - C, y + 60 - C) < 380) continue;
            if (L.rnd() < 0.15) continue;
            m.prop('prop_tent', x, y, 110, 80); m.prop('prop_wood_table', x + 5, y + 92, 100, 50);
            const k = L.rnd(); if (k < 0.35) m.crate(x + 120, y + 30); else if (k < 0.55) m.prop('prop_vending', x + 122, y, 60, 80); else if (k < 0.75) m.prop('prop_wood_barrel', x + 122, y + 20, 44, 44); else m.prop('prop_plant', x + 122, y + 20, 44, 44);
            if (L.rnd() < 0.35) m.neon('neon_circle', x + 35, y - 60, 40, 40, pick(neons));
        }
        // крамнички по периметру, у які можна заїхати
        [[90, 90, 's'], [1970, 90, 's'], [90, 1990, 'n'], [1970, 1990, 'n']].forEach(([x, y, sd]) => {
            const b = m.bld(x, y, 340, 320, { T: 24, wall: pick(['#5b3a46', '#3b4a5c', '#44403c']), floor: '#4a3f3a', fs: 'tile', roof: pick(['#7f1d1d', '#1e3a8a', '#3f3f46']), ents: [{ side: sd, at: 0.5, g: 140, door: 'prop_door_glass' }, { side: x < C ? 'e' : 'w', at: 0.5, g: 130 }] });
            [['prop_shelf', 160, 40, 'wall'], ['prop_desk', 100, 60, 'center'], ['prop_monitor', 70, 40, 'wall'], ['prop_plant', 40, 40, 'corner']].forEach(f => m.furnish(b, f));
        });
        m.scatter(10, [150, 150, 2100, 2100], 30, (x, y) => m.prop('prop_spotlight', x - 20, y - 20, 40, 40), 60);
        m.scatter(12, [150, 150, 2100, 2100], 28, (x, y) => m.prop('prop_cone', x - 15, y - 15, 30, 30), 60);
        for (let i = 0; i < 5; i++) { const x = rr(200, 2200), y = rr(200, 2200); if (m.free(x, y, 70)) barrels(m, x, y); }
        [[120, 700], [120, 1700], [2280, 700], [2280, 1700], [700, 120], [1700, 120], [700, 2280], [1700, 2280], [C, 700], [C, 1700]].forEach(([x, y]) => m.P(x, y));
        [[C - 420, C], [C + 420, C], [C, C - 420], [C, C + 420], [600, 600], [1800, 1800]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 3. СТАЛЕЛИВАРНЯ — середня, метал: три цехи з перегородками, труби, газові балони, конвеєри ============
    def('Steel Works', 3200, 'metal', FFA, '#4f5a66', m => {
        const S = 3200; m.border(60, '#2f3a48');
        m.road([[0, 1600], [3200, 1600]], 150, '#3b424b', '#facc15'); m.road([[1600, 0], [1600, 3200]], 150, '#3b424b', '#facc15');
        const hall = (x, y, w, h, sd) => {
            const b = m.bld(x, y, w, h, { T: 30, wall: '#52606f', floor: '#3d4550', fs: 'plate', roof: pick(['#4b5a6a', '#5b4b4b', '#3f4a5a']), stripe: '#f59e0b',
                ents: [{ side: sd, at: 0.3, g: 170, door: 'prop_door_metal_d' }, { side: sd, at: 0.8, g: 150 }, { side: { n: 's', s: 'n', e: 'w', w: 'e' }[sd], at: 0.5, g: 150 }],
                parts: [{ axis: w > h ? 'v' : 'h', at: 0.5, gap: 0.5, g: 160 }] });
            m.fillGrid(b, 'prop_generator', 80, 70, 260, 200, 110);
            [['prop_gas', 34, 34, 'corner'], ['prop_gas', 34, 34, 'corner'], ['prop_shelf', 200, 44, 'wall'], ['prop_server', 50, 90, 'wall'], ['prop_crate', 50, 50, 'corner'], ['prop_barrel', 40, 40, 'corner']].forEach(f => m.furnish(b, f));
        };
        hall(250, 250, 1100, 700, 's'); hall(1900, 250, 1050, 700, 's'); hall(250, 2050, 1100, 800, 'n'); hall(1900, 2150, 1050, 750, 'n');
        // доменні печі (стовпи) і труби
        [[1050, 1250], [2050, 1250], [1050, 1800], [2050, 1800]].forEach(([x, y]) => { m.sq(x, y, 140, 140, '#3f3a40', { neon: '#f97316' }); m.keep(x + 70, y + 70, 120); });
        m.scatter(12, [150, 1000, 2900, 1100], 70, (x, y) => m.prop('prop_pipe', x - 80, y - 15, 160, 30, ri(0, 1) * 90), 60);
        m.line([[200, 1100], [1400, 1100]], 60, '#27272a', '#71717a'); m.line([[1800, 2100], [3000, 2100]], 60, '#27272a', '#71717a');
        for (let i = 0; i < 8; i++) { const x = rr(200, 3000), y = rr(1000, 2100); if (m.free(x, y, 70)) (i % 2 ? barrels : crates)(m, x, y); }
        m.scatter(6, [200, 1000, 2800, 1100], 50, (x, y) => { m.gas(x - 40, y - 17); m.gas(x + 2, y - 17); }, 60);
        m.scatter(10, [200, 200, 2800, 2800], 120, (x, y) => { const v = L.rnd() < 0.5; m.prop(pick(['prop_cont_red', 'prop_cont_blue']), v ? x - 40 : x - 100, v ? y - 100 : y - 40, v ? 80 : 200, v ? 200 : 80); }, 80);
        deco(m, [150, 150, 2900, 2900], 24, [['prop_tires', 50, 50], ['prop_wood_pallet', 80, 60], ['prop_cone', 30, 30], ['prop_concrete', 100, 50], ['prop_crate', 50, 50], ['prop_generator', 80, 70]], 45, true);
        deco(m, [150, 150, 2900, 2900], 10, [['prop_wreck', 140, 80], ['prop_shelf', 200, 40]], 70, true);
        [[150, 1100], [150, 2100], [3050, 1100], [3050, 2100], [1100, 1400], [2100, 1400], [1100, 1950], [2100, 1950], [800, 1050], [2400, 1050], [800, 2000], [2400, 2000]].forEach(([x, y]) => m.P(x, y));
        [[1600, 1600], [700, 1600], [2500, 1600], [1600, 700], [1600, 2500], [500, 500], [2700, 2700]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 4. ДАЧНЕ СЕЛИЩЕ — середня, осінь: будиночки з городами й парканами, сараї, ґрунтові дороги ============
    def('Dacha Village', 3200, 'autumn', FFA, null, m => {
        const S = 3200; m.border(40, '#5b4636');
        const R1 = [[0, 1050], [3200, 1050]], R2 = [[0, 2150], [3200, 2150]], R3 = [[1600, 0], [1600, 3200]];
        [R1, R2, R3].forEach(r => m.road(r, 130, '#7b5d3e', null));
        const wood = ['#8a5a2b', '#7c4a21', '#9a6a35'], roofs = ['#9b5a45', '#5d6b7a', '#7a3f31', '#6b5d45', '#b5593c'];
        const lots = [];
        for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) lots.push([150 + gx * 800 + (gx >= 2 ? 80 : 0), [150, 1250, 2350][gy]]);
        lots.forEach(([x0, y0], i) => {
            const w = ri(26, 32) * 10, h = ri(22, 26) * 10, x = x0 + ri(0, 15) * 10, y = y0 + ri(0, 10) * 10;
            if (!m.rectFree(x, y, w, h, 60)) return;
            const sd = y0 === 150 ? 's' : (y0 === 2350 ? 'n' : pick(['n', 's']));
            const b = m.bld(x, y, w, h, { T: 24, wall: pick(wood), floor: '#a0794a', roof: pick(roofs), ents: [{ side: sd, at: rr(0.2, 0.8), g: 130, door: 'prop_door_wood_s' }, { side: pick(['e', 'w']), at: 0.5, g: 120 }] });
            [['prop_wood_table', 100, 50, 'center'], ['prop_wood_bench', 100, 30, 'wall'], ['prop_sofa', 110, 50, 'wall'], ['prop_wood_barrel', 44, 44, 'corner'], ['prop_plant', 40, 40, 'corner']].forEach(f => m.furnish(b, f));
            // город і паркан
            const gx2 = x + w + 40, gy2 = y; if (m.rectFree(gx2, gy2, 260, h, 10)) { m.prop('prop_fence_wood', gx2, gy2, 120, 20); m.prop('prop_fence_wood', gx2 + 130, gy2, 120, 20); m.prop('prop_fence_wood', gx2, gy2 + h - 20, 120, 20); for (let k = 0; k < 3; k++) m.bush(gx2 + 20 + k * 80, gy2 + 70); if (L.rnd() < 0.6) m.prop('prop_hay', gx2 + 170, gy2 + h - 120, 80, 80); }
        });
        // сараї (маленькі будиночки з одним входом)
        [[700, 760], [2300, 760], [700, 1850], [2400, 1850], [1200, 2800]].forEach(([x, y]) => { if (m.rectFree(x, y, 200, 180, 50)) { const b = m.bld(x, y, 200, 180, { T: 22, wall: '#6b4a2b', floor: '#7c5a3a', roof: '#57534e', ents: [{ side: 's', at: 0.5, g: 120 }] }); m.furnish(b, ['prop_hay', 80, 80, 'corner']); m.furnish(b, ['prop_wood_firewood', 60, 50, 'corner']); } });
        m.prop('prop_well', 1560, 1560, 80, 80); m.keep(1600, 1600, 140);
        m.forest([100, 100, 3000, 3000], 60, 34, 64, 0.2);
        deco(m, [120, 120, 2960, 2960], 14, [['prop_wood_cart', 110, 70], ['prop_hay', 80, 80], ['prop_wood_firewood', 60, 50], ['prop_wood_log', 120, 40], ['prop_wood_pallet', 80, 60]], 50, true);
        for (let i = 0; i < 4; i++) { const x = rr(200, 3000), y = rr(200, 3000); if (m.free(x, y, 70)) barrels(m, x, y); }
        [[200, 1050], [3000, 1050], [200, 2150], [3000, 2150], [1600, 200], [1600, 3000], [900, 1600], [2300, 1600], [1100, 1050], [2100, 2150], [600, 2700], [2600, 500]].forEach(([x, y]) => m.P(x, y));
        [[1600, 1050], [1600, 2150], [800, 1600], [2400, 1600], [600, 600], [2600, 2600], [2600, 600]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 5. ЛІНІЯ МЕТРО — мала, камінь: дві платформи з колонами, колії, кіоски, турнікети; бази в кутах ============
    def('Metro Line', 2600, 'stone', TEAM, '#6f6a63', m => {
        const S = 2600; m.border(60, '#3f3a36');
        m.P(260, 260); m.P(S - 260, S - 260); m.P(S - 260, 260); m.P(260, S - 260);      // перші 4 — бази команд
        [[0, 0], [S - 520, S - 520], [S - 520, 0], [0, S - 520]].forEach(([x, y]) => m.keepRect(x, y, 520, 520));
        // колії: дві пари рейок по горизонталі (траншеї — смуги ґравію)
        [1050, 1550].forEach(yc => { m.line([[80, yc], [S - 80, yc]], 150, '#3b3631', '#57534e'); m.line([[80, yc - 40], [S - 80, yc - 40]], 8, '#a1a1aa'); m.line([[80, yc + 40], [S - 80, yc + 40]], 8, '#a1a1aa'); });
        // платформи: ряди колон, лавки, автомати
        for (let i = 0; i < 9; i++) { const x = 420 + i * 220; [1300].forEach(y => { if (i % 2 === 0) m.sq(x - 35, y - 35, 70, 70, '#8d8579', { stripe: '#facc15' }); else m.prop(i % 4 === 1 ? 'prop_wood_bench' : 'prop_vending', x - (i % 4 === 1 ? 50 : 30), y - (i % 4 === 1 ? 15 : 40), i % 4 === 1 ? 100 : 60, i % 4 === 1 ? 30 : 80); }); }
        for (let i = 0; i < 8; i++) { const x = 520 + i * 220; [800, 1800].forEach(y => { if (i % 2 === 0) m.sq(x - 35, y - 35, 70, 70, '#8d8579'); else m.prop(i % 3 === 0 ? 'prop_plant' : 'prop_wood_bench', x - 50, y - 15, i % 3 === 0 ? 44 : 100, i % 3 === 0 ? 44 : 30); }); }
        // кіоски (можна заїхати), турнікети
        [[1100, 470], [1100, 1920]].forEach(([x, y], i) => { const b = m.bld(x, y, 400, 200, { T: 22, wall: '#57534e', floor: '#78716c', fs: 'tile', roof: '#44403c', ents: [{ side: i ? 'n' : 's', at: 0.3, g: 130, door: 'prop_door_glass' }, { side: i ? 'n' : 's', at: 0.85, g: 120 }] }); m.furnish(b, ['prop_shelf', 150, 40, 'wall']); m.furnish(b, ['prop_monitor', 70, 40, 'wall']); });
        [[560, 600], [S - 760, 600], [560, S - 640], [S - 760, S - 640]].forEach(([x, y]) => { for (let k = 0; k < 3; k++) m.prop('prop_fence_metal', x + k * 70, y, 60, 30); });
        [[1300, 1300], [550, 1300], [S - 550, 1300], [1300, 800], [1300, 1800]].forEach(([x, y]) => L.cpSite(m, x, y));
        deco(m, [150, 150, 2300, 2300], 10, [['prop_crate', 50, 50], ['prop_wood_barrel', 44, 44], ['prop_cone', 30, 30], ['prop_tires', 50, 50]]);
        for (let i = 0; i < 4; i++) { const x = rr(300, 2300), y = rr(300, 2300); if (m.free(x, y, 70)) barrels(m, x, y); }
        [[800, 1300], [1800, 1300], [700, 700], [1900, 1900]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 6. ВАНТАЖНИЙ ПОРТ — мала, метал: канал посередині з мостами, контейнерний лабіринт, склади ============
    def('Cargo Port', 2800, 'metal', TEAM, '#55606c', m => {
        const S = 2800, C = 1400; m.border(60, '#2f3a48');
        m.P(250, 250); m.P(S - 250, S - 250); m.P(S - 250, 250); m.P(250, S - 250);
        [[0, 0], [S - 500, S - 500], [S - 500, 0], [0, S - 500]].forEach(([x, y]) => m.keepRect(x, y, 500, 500));
        // канал зі сходу на захід, три мости
        const bridges = [700, C, 2100];
        let x = 60; while (x < S - 60) { const nx = Math.min(S - 60, x + 260); if (!bridges.some(b => b > x - 110 && b < nx + 110)) m.water(x, C - 120, nx - x, 240, false); x = nx; }
        bridges.forEach(bx => { m.line([[bx, C - 220], [bx, C + 220]], 190, '#7b6a52', '#5a4b38'); m.keepLine([[bx, C - 260], [bx, C + 260]], 200); });
        // контейнерні стеки
        for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const cx = 450 + c * 420, cy = [520, 2080, 2400][r]; if ((r === 2) || (c === 2 && r === 0)) continue; m.prop((c + r) % 2 ? 'prop_cont_red' : 'prop_cont_blue', cx, cy, 200, 80); if (c % 2 === 0) m.prop((c + r) % 2 ? 'prop_cont_blue' : 'prop_cont_red', cx + 20, cy + 100, 160, 70); }
        // склади, у які можна заїхати
        [[560, 820, 's'], [1700, 820, 's'], [560, 1700, 'n'], [1700, 1700, 'n']].forEach(([bx, by, sd]) => {
            const b = m.bld(bx, by, 520, 280, { T: 26, wall: '#4b5a6a', floor: '#3a424c', fs: 'plate', roof: pick(['#6b5b4b', '#4b5a6a', '#5b4b4b']), stripe: '#facc15', ents: [{ side: sd, at: 0.25, g: 150, door: 'prop_door_metal_d' }, { side: sd, at: 0.8, g: 140 }, { side: 'w', at: 0.5, g: 120 }] });
            m.fillGrid(b, 'prop_crate', 50, 50, 120, 90, 80); m.furnish(b, ['prop_wood_pallet', 80, 60, 'corner']);
        });
        [[C, 520], [C, 2280], [450, C - 300], [S - 450, C + 300], [C, C - 330]].forEach(([px, py]) => L.cpSite(m, px, py));
        for (let i = 0; i < 6; i++) { const px = rr(300, 2500), py = rr(300, 2500); if (m.free(px, py, 70)) barrels(m, px, py); }
        deco(m, [150, 150, 2500, 2500], 12, [['prop_tires', 50, 50], ['prop_wood_planks', 90, 50], ['prop_wood_pallet', 80, 60], ['prop_spotlight', 40, 40], ['prop_gas', 34, 34]]);
        [[700, 2700], [2100, 100], [C, 1700], [C, 1100]].forEach(([px, py]) => m.U(px, py));
    });

    // ============ 7. ВІЙСЬКОВА БАЗА — середня, ґрунт: казарми, ангар, вежі, окопи, периметр із воротами ============
    def('Army Base', 3400, 'dirt', TEAM, null, m => {
        const S = 3400, C = 1700; m.border(50, '#4a3b2a');
        m.P(260, 260); m.P(S - 260, S - 260); m.P(S - 260, 260); m.P(260, S - 260);
        [[0, 0], [S - 560, S - 560], [S - 560, 0], [0, S - 560]].forEach(([x, y]) => m.keepRect(x, y, 560, 560));
        m.road([[C, 80], [C, S - 80]], 160, '#6f5a46'); m.road([[80, C], [S - 80, C]], 160, '#6f5a46');
        // периметр бази з чотирма воротами (металеві паркани)
        const P0 = 700, P1 = S - 700; [[P0, P0, P1, P0], [P0, P1, P1, P1]].forEach(([x0, y0, x1]) => { for (let xx = x0; xx < x1; xx += 130) if (Math.abs(xx + 60 - C) > 150) m.prop('prop_fence_metal', xx, y0 - 15, 120, 30); });
        [[P0, P0, P1], [P1, P0, P1]].forEach(([x0, y0, y1]) => { for (let yy = y0; yy < y1; yy += 130) if (Math.abs(yy + 60 - C) > 150) m.prop('prop_fence_metal', x0 - 15, yy, 30, 120); });
        // казарми
        [[860, 860, 'e'], [2040, 860, 'w'], [860, 2240, 'e'], [2040, 2240, 'w']].forEach(([x, y, sd]) => {
            const b = m.bld(x, y, 500, 300, { T: 26, wall: '#5f6b4e', floor: '#7c7466', roof: '#4d5a3c', ents: [{ side: sd, at: 0.5, g: 140, door: 'prop_door_wood_d' }, { side: 'n', at: 0.5, g: 130 }, { side: 's', at: 0.5, g: 130 }] });
            m.fillGrid(b, 'prop_wood_bench', 100, 30, 170, 110, 80); m.furnish(b, ['prop_crate', 50, 50, 'corner']); m.furnish(b, ['prop_shelf', 160, 40, 'wall']);
        });
        // ангар у центрі з технікою
        const hg = m.bld(C - 380, C - 260, 760, 520, { T: 30, wall: '#57534e', floor: '#5d5751', fs: 'plate', roof: '#3f4a3a', stripe: '#facc15', ents: [{ side: 'w', at: 0.5, g: 220 }, { side: 'e', at: 0.5, g: 220, door: 'prop_door_metal_d' }, { side: 'n', at: 0.5, g: 150 }, { side: 's', at: 0.5, g: 150 }] });
        m.furnish(hg, ['prop_wreck', 160, 90, 'center']); m.furnish(hg, ['prop_wreck', 160, 90, 'center']); m.furnish(hg, ['prop_gas', 34, 34, 'corner']); m.furnish(hg, ['prop_barrel', 40, 40, 'corner']); m.furnish(hg, ['prop_shelf', 200, 44, 'wall']);
        // вежі, окопи, їжаки, намети
        [[P0 - 60, P0 - 60], [P1 - 40, P0 - 60], [P0 - 60, P1 - 40], [P1 - 40, P1 - 40]].forEach(([x, y]) => m.sq(x, y, 100, 100, '#6b5d45', { stripe: '#d6b37a' }));
        m.scatter(16, [600, 600, 2200, 2200], 60, (x, y) => m.sand(x - 50, y - 20, 100, 40, ri(0, 3) * 45), 60);
        m.scatter(14, [100, 100, 3200, 3200], 40, (x, y) => m.hedge(x - 30, y - 30), 60);
        m.scatter(8, [700, 700, 2000, 2000], 60, (x, y) => m.prop('prop_tent', x - 45, y - 40, 90, 80), 60);
        [[C, 900], [C, S - 900], [900, C], [S - 900, C], [C, C + 430]].forEach(([x, y]) => L.cpSite(m, x, y));
        for (let i = 0; i < 6; i++) { const x = rr(300, 3100), y = rr(300, 3100); if (m.free(x, y, 70)) (i % 2 ? barrels : crates)(m, x, y); }
        m.forest([100, 100, 3200, 3200], 40, 34, 60, 0.3);
        [[C - 600, C - 600], [C + 600, C + 600], [C + 600, C - 600], [C - 600, C + 600], [C, 500], [C, S - 500]].forEach(([x, y]) => m.U(x, y));
    });

    // ============ 8. ЗРУЙНОВАНЕ МІСТО — велика, камінь: квартали з руїнами, площа, згорілі машини ============
    def('Ruined City', 4400, 'stone', TEAM, '#7d7468', m => {
        const S = 4400, C = 2200, N = 5, st = 200, blk = (S - st * (N + 1)) / N; m.border(60, '#4d463f');
        m.P(250, 250); m.P(S - 250, S - 250); m.P(S - 250, 250); m.P(250, S - 250);
        for (let k = 0; k <= N; k++) { const c = st / 2 + k * (blk + st); m.keepLine([[0, c], [S, c]], 120); m.keepLine([[c, 0], [c, S]], 120); }
        const cols = ['#8d8579', '#9b5a45', '#6b6f68', '#7c6f64', '#5d6b7a'];
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
            const x = st + i * (blk + st), y = st + j * (blk + st);
            if (i === 2 && j === 2) continue;                       // центральна площа
            if ((i === 0 || i === N - 1) && (j === 0 || j === N - 1)) continue;     // кути — бази команд
            const col = pick(cols), kind = L.rnd();
            if (kind < 0.45) {      // ціла будівля, у яку можна заїхати, з проломами
                const w = blk - 120, h = blk - 120, sides = ['n', 's', 'e', 'w'];
                const b = m.bld(x + 60, y + 60, w, h, { T: 30, wall: col, floor: '#6b655c', fs: 'tile', roof: pick(['#5d564f', '#7a3f31', '#4b5563']), ents: [{ side: pick(sides), at: rr(0.2, 0.8), g: 150 }, { side: pick(sides), at: rr(0.2, 0.8), g: 140 }, { side: pick(sides), at: rr(0.2, 0.8), g: 140, door: 'prop_door_wood_d' }], parts: [{ axis: pick(['v', 'h']), at: 0.5, gap: rr(0.2, 0.8), g: 150 }] });
                [['prop_wood_table', 100, 50, 'center'], ['prop_shelf', 160, 40, 'wall'], ['prop_crate', 50, 50, 'corner'], ['prop_sofa', 110, 50, 'wall'], ['prop_wood_barrel', 44, 44, 'corner']].forEach(f => m.furnish(b, f));
            } else {                // руїна: уламки стін + каміння
                const n = ri(3, 5); for (let k = 0; k < n; k++) { const L2 = ri(18, 34) * 10, hor = L.rnd() < 0.5, px = x + rr(40, blk - 40 - (hor ? L2 : 40)), py = y + rr(40, blk - 40 - (hor ? 40 : L2)); m.wall(px, py, hor ? L2 : 40, hor ? 40 : L2, col); }
                for (let k = 0; k < 4; k++) { const px = x + rr(60, blk - 60), py = y + rr(60, blk - 60); if (m.free(px, py, 50)) m.rock(px - 40, py - 35, ri(60, 100), ri(50, 80)); }
                if (L.rnd() < 0.5) { const px = x + blk / 2, py = y + blk / 2; if (m.free(px, py, 60)) m.prop('prop_crater', px - 40, py - 40, 80, 80); }
            }
        }
        // площа
        m.prop('prop_statue', C - 50, C - 470, 100, 100); m.keep(C, C, 160); m.water(C - 360, C - 360, 180, 180, true); m.water(C + 180, C + 180, 180, 180, true);
        [[C, C], [C, 900], [C, S - 900], [900, C], [S - 900, C]].forEach(([x, y]) => L.cpSite(m, x, y));
        m.scatter(18, [150, 150, 4100, 4100], 70, (x, y) => m.prop('prop_wreck', x - 70, y - 40, 140, 80, ri(0, 3) * 45), 80);
        for (let i = 0; i < 8; i++) { const x = rr(300, 4100), y = rr(300, 4100); if (m.free(x, y, 70)) barrels(m, x, y); }
        deco(m, [150, 150, 4100, 4100], 16, [['prop_concrete', 100, 50], ['prop_hedgehog', 60, 60], ['prop_tires', 50, 50], ['prop_cone', 30, 30], ['prop_crate', 50, 50]], 45, true);
        m.forest([100, 100, 4200, 4200], 26, 32, 56, 0.4);
        [[1100, 1100], [3300, 3300], [3300, 1100], [1100, 3300], [C, 600], [C, 3800], [600, C], [3800, C]].forEach(([x, y]) => m.U(x, y));
    });
};
