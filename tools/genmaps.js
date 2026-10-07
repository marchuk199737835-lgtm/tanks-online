// Генератор мап під нові режими. Запуск: node tools/genmaps.js  →  пише maps_modes.js (його підключає server.js).
// Усі мапи — звичайні мапи редактора: їх можна відкрити в /editor.html, змінити й зберегти.
const fs = require('fs'), path = require('path');
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rr = (a, b) => a + rnd() * (b - a);
const R50 = v => Math.round(v / 50) * 50;

class Map_ {
    constructor(title, size, bg, grid, modes) { this.m = { title, size, bg, grid, modes, solids: [] }; this.S = this.m.solids; }
    add(o) { this.S.push(o); return this; }
    wall(x, y, w, h, color) { return this.add({ type: 'wall', x, y, w, h, color: color || '#353940' }); }
    sq(x, y, w, h, color) { return this.add({ type: 'wall_square', x, y, w, h, color: color || '#353940' }); }
    water(x, y, w, h) { return this.add({ type: 'water_square', x, y, w, h }); }
    tree(x, y, r) { return this.add({ type: 'tree', x: Math.round(x), y: Math.round(y), r: Math.round(r || rr(40, 80)) }); }
    prop(t, x, y, w, h, rot) { const o = { type: t, x: Math.round(x), y: Math.round(y), w, h }; if (rot) o.rot = rot; return this.add(o); }
    crate(x, y) { return this.prop('prop_crate', x, y, 50, 50); }
    barrel(x, y) { return this.prop('prop_barrel', x, y, 40, 40); }
    sand(x, y, w, h) { return this.prop('prop_sandbag', x, y, w || 100, h || 40); }
    hedge(x, y) { return this.prop('prop_hedgehog', x, y, 60, 60); }
    conc(x, y, w, h) { return this.prop('prop_concrete', x, y, w || 100, h || 50); }
    rock(x, y, w, h) { return this.prop('prop_rock', x, y, w || 80, h || 70); }
    bush(x, y) { return this.prop('prop_bush', x, y, 60, 60); }
    neon(t, x, y, w, h, color) { return this.add({ type: t, x, y, w, h, color: color || '#21252c' }); }
    // маркери
    P(x, y) { return this.add({ type: 'spawn_player', x, y }); }
    Z(x, y) { return this.add({ type: 'spawn_zombie', x, y }); }
    U(x, y) { return this.add({ type: 'spawn_powerup', x, y }); }
    // рамка зі стін з проходами: сторона 'n','s','e','w' → список проміжків [from,to] уздовж сторони
    ring(x0, y0, x1, y1, t, gaps, color) {
        const g = gaps || {}, seg = (a, b, gp, fn) => { let cur = a; (gp || []).slice().sort((p, q) => p[0] - q[0]).forEach(([f, to]) => { if (f > cur) fn(cur, f); cur = to; }); if (cur < b) fn(cur, b); };
        seg(x0, x1, g.n, (a, b) => this.wall(a, y0, b - a, t, color));
        seg(x0, x1, g.s, (a, b) => this.wall(a, y1 - t, b - a, t, color));
        seg(y0 + t, y1 - t, g.w, (a, b) => this.wall(x0, a, t, b - a, color));
        seg(y0 + t, y1 - t, g.e, (a, b) => this.wall(x1 - t, a, t, b - a, color));
    }
    out() {
        // маркери не повинні опинятись у стінах/деревах: зсуваємо до найближчого вільного місця
        const MO = require('../public/js/mapobjects.js');
        this.m.solids.forEach(o => {
            if (!/spawn/.test(o.type) || !MO.collides(this.m, o.x, o.y, 30)) return;
            for (let rad = 25; rad <= 400; rad += 25) for (let k = 0; k < 16; k++) {
                const a = k / 16 * 6.283, x = Math.round(o.x + Math.cos(a) * rad), y = Math.round(o.y + Math.sin(a) * rad);
                if (!MO.collides(this.m, x, y, 34)) { o.x = x; o.y = y; return; }
            }
        });
        // бонуси в закритих кишенях/у стінах прибираємо
        const Nav = require('../navgrid.js'), san = MO.sanitizeMap(JSON.parse(JSON.stringify(this.m))), g = Nav.getGrid(san, 30);
        const pp = san.solids.find(o => o.type === 'spawn_player'), f = Nav.buildField(g, pp.x, pp.y);
        this.m.solids = this.m.solids.filter(o => o.type !== 'spawn_powerup' || (!MO.collides(this.m, o.x, o.y, 30) && f.dist[Math.floor(o.y / Nav.CS) * g.N + Math.floor(o.x / Nav.CS)] >= 0));
        return this.m;
    }
}

const maps = {};

// ================== 1. ОБОРОНА БАЗИ — «Форпост» ==================
{
    const m = new Map_('Форпост', 3000, '#44502f', '#39442a', ['base_defense']);
    const C = 1500, H = 450, T = 50, gate = 160, WC = '#4b5563';
    m.ring(C - H, C - H, C + H, C + H, T, { n: [[C - gate / 2, C + gate / 2]], s: [[C - gate / 2, C + gate / 2]], w: [[C - gate / 2, C + gate / 2]], e: [[C - gate / 2, C + gate / 2]] }, WC);
    // башти по кутах
    [[C - H - 50, C - H - 50], [C + H - 100, C - H - 50], [C - H - 50, C + H - 100], [C + H - 100, C + H - 100]].forEach(([x, y]) => { m.sq(x, y, 150, 150, '#374151'); m.neon('neon_circle', x + 50, y + 50, 50, 50, '#1f2937'); });
    // оборонні споруди біля воріт: їжаки + мішки з боку ворога
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {   // укриття збоку від воріт (прохід залишається вільним)
        const px = -dy, py = dx, off = gate / 2 + 70, dist = H + 130;
        [-1, 1].forEach(sd => { const cx = C + dx * dist + px * off * sd, cy = C + dy * dist + py * off * sd; m.hedge(cx - 30, cy - 30); });
    });
    // двір
    m.crate(C - 250, C - 250); m.crate(C - 200, C - 250); m.crate(C + 200, C - 250); m.crate(C + 200, C + 200); m.crate(C - 250, C + 200);
    m.prop('prop_generator', C - 330, C - 60, 80, 120); m.prop('prop_radar', C + 250, C - 300, 100, 100); m.prop('prop_tent', C + 180, C + 230, 120, 100); m.barrel(C - 300, C + 230); m.barrel(C - 260, C + 250);
    m.prop('prop_pad', C - 150, C - 150, 300, 300);
    // зовнішні L-бункери по діагоналях
    [[560, 560, 1, 1], [2440, 560, -1, 1], [560, 2440, 1, -1], [2440, 2440, -1, -1]].forEach(([x, y, sx, sy]) => { m.wall(sx > 0 ? x : x - 250, sy > 0 ? y : y - 50, 250, 50, '#4b5563'); m.wall(sx > 0 ? x : x - 50, sy > 0 ? y : y - 250, 50, 250, '#4b5563'); m.sand(x + sx * 80, y + sy * 80, 100, 40); });
    // природа
    for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, d = rr(800, 1450), x = 1500 + Math.cos(a) * d, y = 1500 + Math.sin(a) * d; if (Math.abs(x - 1500) < 330 || Math.abs(y - 1500) < 330) continue; if (rnd() < 0.55) m.tree(x, y, rr(40, 85)); else m.rock(x, y); }
    for (let i = 0; i < 6; i++) { m.prop('prop_crater', rr(500, 2500), rr(500, 2500), 90, 90); } m.prop('prop_wreck', 760, 1330, 130, 80); m.prop('prop_wreck', 2150, 1650, 130, 80, 40);
    // спавни
    [[C - 100, C - 100], [C + 100, C - 100], [C - 100, C + 100], [C + 100, C + 100]].forEach(([x, y]) => m.P(x, y));
    m.add({ type: 'spawn_core', x: C, y: C });
    [[150, 150], [2850, 150], [150, 2850], [2850, 2850], [1500, 100], [1500, 2900], [100, 1500], [2900, 1500], [750, 100], [2250, 100], [750, 2900], [2250, 2900]].forEach(([x, y]) => m.Z(x, y));
    [[C - 300, C - 300], [C + 300, C - 300], [C - 300, C + 300], [C + 300, C + 300], [C, C - 800], [C + 800, C], [C, C + 800], [C - 800, C]].forEach(([x, y]) => m.U(x, y));
    maps['Форпост'] = m.out();
}

// ================== 2. РЕЙД НА БОСА — «Тронна зала» ==================
{
    const m = new Map_('Тронна зала', 3000, '#2b2140', '#241b36', ['boss_raid']);
    const WC = '#3b2a5c';
    // краї арени — низькі стіни з проходами-ніші
    m.ring(0, 0, 3000, 3000, 50, {}, '#3b2a5c');
    // трон боса (північ): сходинки-пад і колони
    m.prop('prop_pad', 1200, 300, 600, 300); m.neon('neon_pillar', 1100, 320, 60, 60, '#a855f7'); m.neon('neon_pillar', 1840, 320, 60, 60, '#a855f7');
    // колони двома дугами для ухилення від кільцевих снарядів
    const pil = [[600, 1000], [2300, 1000], [1000, 1300], [1900, 1300], [450, 1700], [2450, 1700], [900, 2000], [2000, 2000], [1450, 1650]];
    pil.forEach(([x, y]) => { m.sq(x, y, 100, 100, WC); m.neon('neon_circle', x + 25, y + 25, 50, 50, '#a855f7'); });
    // бетонні укриття з тильного боку (де стартують гравці)
    [[500, 2450], [900, 2600], [2000, 2600], [2400, 2450], [1450, 2350]].forEach(([x, y]) => { m.conc(x, y, 150, 50); m.sand(x + 20, y + 70, 100, 40); });
    [[250, 1300], [2650, 1300], [250, 600], [2650, 600]].forEach(([x, y]) => { m.prop('prop_crystal', x, y, 100, 100); });
    m.prop('prop_statue', 1100, 1000, 100, 100); m.prop('prop_statue', 1800, 1000, 100, 100);
    for (let i = 0; i < 8; i++) m.prop('prop_crater', rr(300, 2700), rr(900, 2300), 80, 80);
    // спавни: гравці — південь; бос і приспішники — північні ніші
    [[1350, 2750], [1450, 2750], [1550, 2750], [1650, 2750]].forEach(([x, y]) => m.P(x, y));
    [[1500, 420], [700, 500], [2300, 500]].forEach(([x, y]) => m.Z(x, y));
    [[300, 1500], [2700, 1500], [1500, 1500], [800, 2300], [2200, 2300], [1500, 2400]].forEach(([x, y]) => m.U(x, y));
    maps['Тронна зала'] = m.out();
}

// ================== 3. КОНВОЙ — «Дорога життя» ==================
{
    const m = new Map_('Дорога життя', 3000, '#a0925f', '#8f8253', ['convoy']);
    const CL = '#6b6150';
    // скелі: північ, краї, смуги між дорогами
    m.wall(0, 0, 3000, 1100, CL); m.wall(0, 2800, 3000, 200, CL); m.wall(0, 1100, 150, 1700, CL); m.wall(2850, 1100, 150, 1700, CL);
    m.water(150, 1500, 2300, 900);                                     // озеро між дорогами
    // декор скель і озера
    for (let i = 0; i < 16; i++) m.tree(rr(100, 2900), rr(80, 1000), rr(50, 110));
    for (let i = 0; i < 10; i++) m.rock(rr(200, 2800), rr(1560, 2340), 80, 70);
    m.prop('prop_pad', 150, 2450, 200, 300); m.neon('neon_arch', 250, 1150, 100, 50, '#22c55e');
    // укриття на дорозі 1 (низ), по черзі з обох боків — лишається смуга ≥ 220 для вантажівки
    [[650, 2420, 0], [1000, 2690, 1], [1350, 2420, 0], [1700, 2690, 1], [2050, 2420, 0], [2300, 2690, 1]].forEach(([x, y, k]) => { m.conc(x, y - (k ? 0 : 0), 100, 50); m.sand(x + 120, y + (k ? 0 : 10), 100, 40); });
    m.prop('prop_wreck', 1500, 2560, 130, 80); m.prop('prop_wreck', 2200, 2540, 130, 80);
    // правий з'їзд
    [[2480, 1800], [2750, 2150], [2480, 2450]].forEach(([x, y]) => { m.crate(x, y); m.crate(x + 50, y); }); m.hedge(2600, 1650); m.hedge(2700, 1300);
    // дорога 2 (верх)
    [[2200, 1120], [1850, 1440], [1500, 1120], [1150, 1440], [800, 1120], [450, 1440]].forEach(([x, y]) => { m.sand(x, y, 100, 40); m.crate(x + 130, y - 5); });
    m.prop('prop_wreck', 1700, 1290, 130, 80); m.prop('prop_wreck', 900, 1280, 130, 80);
    for (let i = 0; i < 10; i++) m.prop('prop_puddle', rr(200, 2700), i % 2 ? rr(2440, 2760) : rr(1130, 1470), 90, 60);
    // конвой і спавни
    m.add({ type: 'spawn_convoy_a', x: 300, y: 2600 }); m.add({ type: 'spawn_convoy_b', x: 300, y: 1300 });
    [[250, 2520], [250, 2680], [380, 2520], [380, 2680]].forEach(([x, y]) => m.P(x, y));
    [[1250, 2600], [1950, 2600], [2650, 2200], [2650, 1700], [2000, 1300], [1300, 1300], [700, 1300], [900, 2600]].forEach(([x, y]) => m.Z(x, y));
    [[900, 2600], [1850, 2600], [2650, 2000], [1700, 1300], [800, 1300], [400, 2000]].forEach(([x, y]) => m.U(x, y));
    maps['Дорога життя'] = m.out();
}

// ================== 4. АРЕНА ХВИЛЬ (соло) — «Колізей» ==================
{
    const m = new Map_('Колізей', 2400, '#6b5436', '#5a462c', ['solo_arena']);
    const C = 1200, H = 800, WC = '#8b7355', g = 100;
    m.ring(C - H, C - H, C + H, C + H, 100, { n: [[C - g, C + g]], s: [[C - g, C + g]], w: [[C - g, C + g]], e: [[C - g, C + g]] }, WC);
    // колони-восьмикутник
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39, x = C + Math.cos(a) * 430, y = C + Math.sin(a) * 430; m.sq(R50(x - 50), R50(y - 50), 100, 100, '#a08a65'); m.neon('neon_circle', R50(x - 50) + 25, R50(y - 50) + 25, 50, 50, '#78350f'); }
    // центральний кристал і 4 бар'єри
    m.prop('prop_crystal', C - 50, C - 50, 100, 100);
    [[C - 50, C - 190], [C - 50, C + 150], [C - 190, C - 50], [C + 150, C - 50]].forEach(([x, y], i) => m.sand(x, y, i < 2 ? 100 : 40, i < 2 ? 40 : 100));
    // ворота: їжаки зовні, факели в арені
    [-1, 1].forEach(sd => { [[C + sd * 220 - 30, C - H - 110], [C + sd * 220 - 30, C + H + 50], [C - H - 110, C + sd * 220 - 30], [C + H + 50, C + sd * 220 - 30]].forEach(([x, y]) => m.hedge(x, y)); });
    [[C - 200, C - 700], [C + 150, C - 700], [C - 200, C + 650], [C + 150, C + 650], [C - 700, C - 200], [C - 700, C + 150], [C + 650, C - 200], [C + 650, C + 150]].forEach(([x, y]) => m.prop('prop_campfire', x, y, 50, 50));
    for (let i = 0; i < 6; i++) m.rock(rr(100, 400), rr(100, 2300), 80, 70), m.rock(rr(2000, 2300), rr(100, 2300), 80, 70);
    [[C - 50, C + 250], [C, C + 250], [C + 50, C + 250]].forEach(([x, y]) => m.P(x, y));
    [[C, 130], [C, 2270], [130, C], [2270, C], [200, 200], [2200, 200], [200, 2200], [2200, 2200]].forEach(([x, y]) => m.Z(x, y));
    [[C - 600, C - 600], [C + 600, C - 600], [C - 600, C + 600], [C + 600, C + 600], [C, C - 330]].forEach(([x, y]) => m.U(x, y));
    maps['Колізей'] = m.out();
}

// ================== 5. ДУЕЛЬ З БОСАМИ (соло) — «Яма дуелянта» ==================
{
    const m = new Map_('Яма дуелянта', 2200, '#1f2937', '#182030', ['boss_duel']);
    const WC = '#374151';
    m.ring(0, 0, 2200, 2200, 50, {}, '#2d3748');
    // 6 колон у шаховому порядку + 4 низьких укриття
    [[450, 700], [1650, 700], [750, 1100], [1350, 1100], [450, 1500], [1650, 1500]].forEach(([x, y]) => { m.sq(x - 50, y - 50, 100, 100, WC); m.neon('neon_pillar', x - 25, y - 25, 50, 50, '#ef4444'); });
    [[200, 1000], [1900, 1000], [200, 1250], [1900, 1250]].forEach(([x, y]) => m.conc(x, y, 100, 50));
    m.prop('prop_pad', 900, 250, 400, 300); m.prop('prop_pad', 900, 1650, 400, 300);   // «трон» боса і майданчик гравця
    m.prop('prop_crystal', 150, 150, 100, 100); m.prop('prop_crystal', 1950, 150, 100, 100); m.prop('prop_crystal', 150, 1950, 100, 100); m.prop('prop_crystal', 1950, 1950, 100, 100);
    for (let i = 0; i < 6; i++) m.prop('prop_crater', rr(300, 1900), rr(600, 1600), 70, 70);
    [[1000, 1800], [1100, 1800], [1200, 1800]].forEach(([x, y]) => m.P(x, y));
    m.Z(1100, 420);
    [[300, 1100], [1900, 1100], [1100, 1100], [1100, 1500]].forEach(([x, y]) => m.U(x, y));
    maps['Яма дуелянта'] = m.out();
}

// ================== 6. КОРОЛІВСЬКИЙ БІЙ — «Острів» ==================
{
    const m = new Map_('Острів', 4000, '#4b6a38', '#3e5a2e', ['battle_royale']);
    const WC = '#4b5563';
    // море по краях
    m.water(0, 0, 4000, 300); m.water(0, 3700, 4000, 300); m.water(0, 300, 300, 3400); m.water(3700, 300, 300, 3400);
    m.water(300, 300, 400, 200); m.water(3300, 300, 400, 200); m.water(300, 3500, 400, 200); m.water(3300, 3500, 400, 200);
    // центр: військова база
    m.ring(1650, 1650, 2350, 2350, 50, { n: [[1950, 2050]], s: [[1950, 2050]], w: [[1950, 2050]], e: [[1950, 2050]] }, WC);
    m.sq(1800, 1800, 100, 100, '#374151'); m.sq(2100, 2100, 100, 100, '#374151'); m.prop('prop_radar', 2150, 1750, 100, 100); m.prop('prop_generator', 1720, 2150, 80, 120); m.crate(1950, 1950); m.crate(2000, 1950); m.crate(1950, 2000);
    m.prop('prop_cont_red', 1700, 1700, 160, 70); m.prop('prop_cont_blue', 2140, 2230, 160, 70);
    // північно-західний ліс
    for (let i = 0; i < 48; i++) { const x = rr(450, 1450), y = rr(450, 1450); if (rnd() < 0.8) m.tree(x, y, rr(40, 90)); else m.bush(x, y); }
    // північно-східне озеро з островом
    m.water(2700, 500, 700, 600); m.prop('prop_crystal', 2950, 700, 100, 100); for (let i = 0; i < 5; i++) m.tree(rr(2650, 3450), rr(1150, 1450), rr(40, 70));
    // південно-західні руїни
    [[500, 2700, 300, 50], [800, 2900, 50, 300], [500, 3100, 250, 50], [1000, 2700, 50, 250], [1000, 3200, 300, 50], [1250, 2950, 50, 250], [650, 3350, 50, 200]].forEach(([x, y, w, h]) => m.wall(x, y, w, h, '#6b6560'));
    for (let i = 0; i < 6; i++) m.rock(rr(450, 1400), rr(2600, 3500), 80, 70); m.prop('prop_statue', 900, 3050, 100, 100);
    // південно-східний контейнерний двір
    for (let r_ = 0; r_ < 3; r_++) for (let c_ = 0; c_ < 3; c_++) if (!(r_ === 1 && c_ === 1)) m.prop(((r_ + c_) % 2) ? 'prop_cont_blue' : 'prop_cont_red', 2700 + c_ * 300, 2700 + r_ * 250, 160, 70);
    m.prop('prop_tent', 3000, 2950, 120, 100);
    // дрібні укриття та дороги
    [[1300, 1850], [2650, 1650], [1850, 1300], [1850, 2700], [700, 1950], [3200, 2100], [1950, 3300], [2500, 700]].forEach(([x, y]) => { m.conc(x, y, 100, 50); m.sand(x + 20, y + 80, 100, 40); });
    for (let i = 0; i < 12; i++) m.prop('prop_crater', rr(500, 3500), rr(500, 3500), 80, 80);
    // спавни по колу
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, x = 2000 + Math.cos(a) * 1560, y = 2000 + Math.sin(a) * 1560; m.P(Math.round(x), Math.round(y)); }
    [[2000, 2000], [1750, 1750], [2250, 2250], [1750, 2250], [2250, 1750], [1000, 1000], [800, 1300], [1200, 700], [3000, 750], [3000, 1300], [800, 3000], [1100, 3350], [3000, 3000], [3250, 2700], [2000, 1000], [1000, 2000], [3000, 2000], [2000, 3000], [1500, 2450], [2500, 1550]].forEach(([x, y]) => m.U(x, y));
    maps['Острів'] = m.out();
}

// ================== 7. ЗАХОПЛЕННЯ ТОЧОК — «Перехрестя» ==================
{
    const m = new Map_('Перехрестя', 3200, '#46525f', '#3a4550', ['capture_points']);
    const WC = '#3f4a58', C = 1600;
    // бази по кутах (порядок спавнів: NW, SE, NE, SW — щоб 2 команди стояли навпроти)
    const bases = [[100, 100, 1, 1], [3100, 3100, -1, -1], [3100, 100, -1, 1], [100, 3100, 1, -1]];
    bases.forEach(([x, y, sx, sy]) => {
        const x0 = sx > 0 ? x : x - 350, y0 = sy > 0 ? y : y - 350;       // база 300×300 з кутом у (x,y)
        m.wall(sx > 0 ? x : x - 230, sy > 0 ? y + 350 : y - 400, 230, 50, WC);       // внутрішня «горизонтальна» стіна з проходом нижче
        m.wall(sx > 0 ? x + 350 : x - 400, sy > 0 ? y : y - 230, 50, 230, WC);        // внутрішня «вертикальна» стіна
        m.neon('neon_circle', x0 + 150, y0 + 150, 50, 50, '#1f2937'); m.crate(sx > 0 ? x0 + 40 : x0 + 260, sy > 0 ? y0 + 40 : y0 + 260);
    });
    // спавн-точки: ПОРЯДОК ВАЖЛИВИЙ (команди беруть їх за порядком: червоні, сині, зелені, жовті)
    m.P(250, 250); m.P(2950, 2950); m.P(2950, 250); m.P(250, 2950);
    // 5 точок захоплення + укриття по колу
    const pts = [[C, C], [C, 600], [C, 2600], [600, C], [2600, C]];
    pts.forEach(([x, y]) => {
        m.add({ type: 'spawn_cp', x, y }); m.prop('prop_pad', x - 100, y - 100, 200, 200);
        [[-230, -230], [160, -230], [-230, 160], [160, 160]].forEach(([dx, dy]) => m.conc(x + dx, y + dy, 70, 70));
        [[-60, -250], [-60, 210]].forEach(([dx, dy]) => m.sand(x + dx, y + dy, 120, 40)); [[-250, -60], [210, -60]].forEach(([dx, dy]) => m.sand(x + dx, y + dy, 40, 120));
    });
    // діагональні траншеї та бочки
    for (let i = 0; i < 4; i++) { const t = 700 + i * 220; [[t, t], [3200 - t - 100, t], [t, 3200 - t - 40], [3200 - t - 100, 3200 - t - 40]].forEach(([x, y], k) => { if (Math.hypot(x + 50 - C, y + 20 - C) > 420) m.sand(x, y, 100, 40); }); }
    for (let i = 0; i < 12; i++) { const x = rr(500, 2700), y = rr(500, 2700); if (pts.every(([px, py]) => Math.hypot(px - x, py - y) > 350) && Math.min(x, y, 3200 - x, 3200 - y) > 450) m.barrel(x, y); }
    [[500, 900], [2700, 900], [500, 2300], [2700, 2300], [1100, 500], [2100, 500], [1100, 2700], [2100, 2700]].forEach(([x, y]) => m.U(x, y));
    maps['Перехрестя'] = m.out();
}

// ================== 8. ПОЛЮВАННЯ ЗА ГОЛОВОЮ — «Нічне місто» ==================
{
    const m = new Map_('Нічне місто', 3000, '#0f172a', '#1b2740', ['bounty']);
    const colors = ['#1e293b', '#273449', '#334155'];
    // квартали 450×450 на сітці 4×4, вулиці 300; центральні 4 квартали — площа
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const x = 150 + 750 * i, y = 150 + 750 * j; if ((i === 1 || i === 2) && (j === 1 || j === 2)) continue;
        const col = colors[(i + j) % 3];
        if ((i + j) % 2 === 0) { m.wall(x, y, 450, 450, col); m.neon('neon_pillar', x + 20, y + 20, 40, 40, '#22d3ee'); m.neon('neon_pillar', x + 390, y + 390, 40, 40, '#f472b6'); }
        else { m.wall(x, y, 200, 450, col); m.wall(x + 250, y, 200, 450, col); m.neon('neon_wall', x + 200, y + 100, 50, 250, '#a78bfa'); }
    }
    // центральна площа: фонтан, лавки, неон
    m.prop('prop_well', 1450, 1450, 100, 100); m.neon('neon_circle', 1250, 1250, 50, 50, '#22d3ee'); m.neon('neon_circle', 1700, 1250, 50, 50, '#f472b6'); m.neon('neon_circle', 1250, 1700, 50, 50, '#f472b6'); m.neon('neon_circle', 1700, 1700, 50, 50, '#22d3ee');
    [[1250, 1500, 40, 100], [1710, 1500, 40, 100], [1500, 1250, 100, 40], [1500, 1710, 100, 40]].forEach(([x, y, w, h]) => m.prop('prop_wood_bench', x, y, w, h));
    // вуличні укриття на перехрестях
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { const x = 600 + 750 * i + 0, y = 600 + 750 * j; if (i === 1 && j === 1) continue; m.crate(x, y); if ((i + j) % 2) m.barrel(x + 60, y + 4); }
    for (let i = 0; i < 8; i++) m.prop('prop_puddle', rr(200, 2800), rr(200, 2800), 100, 60);
    // спавни — на перехрестях по периметру (вулиці), точки лута — на всіх перехрестях
    [[525, 75], [1275, 75], [1725, 75], [2475, 75], [75, 525], [2925, 525], [75, 1275], [2925, 1725], [75, 2475], [2925, 2475], [525, 2925], [1275, 2925], [1725, 2925], [2475, 2925]].forEach(([x, y]) => m.P(x, y));
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m.U(525 + 750 * i, 525 + 750 * j);
    maps['Нічне місто'] = m.out();
}

// ---------- запис ----------
const outFile = path.join(__dirname, '..', 'maps_modes.js');
fs.writeFileSync(outFile, '// Мапи під нові режими (створено tools/genmaps.js). Це звичайні мапи редактора — їх можна відкрити в /editor.html і змінити.\n// Якщо мапу з такою назвою збережено в редакторі, вона замінює цю.\nmodule.exports = ' + JSON.stringify(maps) + ';\n');
console.log('maps:', Object.keys(maps).map(k => k + ' (' + maps[k].solids.length + ')').join(', '));
