// Мапа лише для хованок «Decoy Yard» (2026-10): асиметрична — ферма з клунею, загін, звалище, склад, сад, луг і ставок,
// кожна зона своя, без дзеркальності. Увесь дрібний декор стоїть по сітці 50 px (як маскування хованців), а серед нього —
// «обманки»: поодинокі ящики / бочки / тюки там, де їх не чекаєш (посеред лугу, на роздоріжжі, в отворі ряду, біля входу),
// тож мисливець не може просто стріляти в кожен «підозрілий» предмет (промах коштує HP).
// Запуск: node tools/genhide.js — додає (або оновлює) мапу в maps_modes.js.
'use strict';
const fs = require('fs'), path = require('path');
const MO = require('../public/js/mapobjects.js');
const L = require('./maplib.js');
const PH = require('./phgrid.js');
const FILE = path.join(__dirname, '..', 'maps_modes.js');
const NAME = 'Decoy Yard', C = 50;

function make() {
    const m = new L.M(NAME, 2800, 'dirt', ['prophunt'], '#7a6343'), S = 2800, rr = L.rr, ri = L.ri, pick = L.pick, rnd = L.rnd;
    m.border(40, '#4a3a28');
    // ---- дороги й ставок ----
    m.road([[0, 1020], [700, 1080], [1150, 1250], [1500, 1700], [2100, 1780], [2800, 1760]], 120, '#8b7351', null);
    m.road([[1700, 0], [1660, 600], [1500, 1700]], 100, '#8b7351', null);
    m.road([[1150, 1250], [600, 2100], [560, 2800]], 90, '#8b7351', null);
    m.water(170, 2250, 380, 300, true); m.water(420, 2420, 260, 220, true); m.keepRect(150, 2230, 560, 450);

    // ---- сітка: розстановка дрібного декору лише в клітинки 50×50 ----
    const occ = new Set(), key = (x, y) => x + ',' + y;
    const blocked = (gx, gy, cw, ch) => {
        for (let x = gx; x < gx + cw; x++) for (let y = gy; y < gy + ch; y++) {
            if (occ.has(key(x, y))) return true;
            const cx = x * C + C / 2, cy = y * C + C / 2;
            if (cx < 70 || cy < 70 || cx > S - 70 || cy > S - 70) return true;
            if (MO.collides(m.m, cx, cy, 22)) return true;
            if (m.reserved(cx, cy, 20)) return true;
        }
        // не захаращуємо входи в будівлі (зони біля проходів усередині)
        const x0 = gx * C, y0 = gy * C, x1 = x0 + cw * C, y1 = y0 + ch * C;
        if ((m.blds || []).some(b => b.zones.some(z => x0 < z.x + z.w && x1 > z.x && y0 < z.y + z.h && y1 > z.y))) return true;
        return false;
    };
    const SZ = { prop_hay: [2, 2], prop_generator: [2, 1], prop_wood_pallet: [2, 1], prop_wood_planks: [2, 1] };
    const put = (t, gx, gy) => {
        const d = SZ[t] || [1, 1];
        if (blocked(gx, gy, d[0], d[1])) return false;
        for (let x = gx; x < gx + d[0]; x++) for (let y = gy; y < gy + d[1]; y++) occ.add(key(x, y));
        m.prop(t, gx * C, gy * C, d[0] * C, d[1] * C); return true;
    };
    const g = v => Math.round(v / C);     // px → клітинка

    // ---- точки появи (тримаємо вільними) ----
    const SP = [[150, 1020], [700, 1250], [1150, 1100], [1580, 450], [2450, 1200], [2600, 1760], [1500, 1550], [950, 2050], [760, 1900], [1250, 2650], [2150, 2650], [900, 150]];
    SP.forEach(([x, y]) => { m.P(x, y); m.keep(x, y, 70); });

    // ===== 1. ФЕРМА (північний захід): клуня з тюками сіна + сарай =====
    const barn = m.bld(250, 250, 650, 450, { T: 26, wall: '#7c4a21', floor: '#a0794a', roof: '#8b3a2e', ents: [{ side: 's', at: 0.25, g: 140, door: 'prop_door_wood_d' }, { side: 'e', at: 0.6, g: 120 }] });
    for (let gx = 7; gx <= 13; gx += 3) for (let gy = 6; gy <= 9; gy += 3) if (!(gx === 13 && gy === 9)) put('prop_hay', gx, gy);     // тюки з проходами між ними; одного в ряду бракує — «місце» для хованця
    [[7, 12], [8, 12], [16, 6]].forEach(([x, y]) => put('prop_crate', x, y));
    put('prop_wood_barrel', 16, 12); put('prop_wood_pallet', 12, 13);
    m.bld(250, 760, 260, 200, { T: 22, wall: '#6b4a2b', floor: '#7c5a3a', roof: '#57534e', ents: [{ side: 'e', at: 0.5, g: 110 }] });
    put('prop_wood_barrel', 6, 16); put('prop_crate', 7, 17); put('prop_crate', 6, 17);
    // загін: паркан з проходами, тюки двома рядами (у другому ряду бракує одного — ідеальне місце… або обманка поруч)
    const px0 = 1000, py0 = 250, pw = 520, ph = 420;
    [[px0, py0, 120, 20], [px0 + 130, py0, 120, 20], [px0 + 390, py0, 120, 20], [px0, py0 + ph, 120, 20], [px0 + 260, py0 + ph, 120, 20], [px0 + 390, py0 + ph, 120, 20]].forEach(f => m.prop('prop_fence_wood', f[0], f[1], f[2], f[3]));
    [[px0 - 20, py0 + 20, 20, 120], [px0 - 20, py0 + 280, 20, 120], [px0 + pw, py0 + 20, 20, 120], [px0 + pw, py0 + 150, 20, 120], [px0 + pw, py0 + 280, 20, 120]].forEach(f => m.prop('prop_fence_wood', f[0], f[1], f[2], f[3]));
    [21, 23, 25, 27].forEach(x => put('prop_hay', x, 6)); [21, 25, 27].forEach(x => put('prop_hay', x, 9));
    put('prop_bush', 23, 10);                                         // кущ у загоні — нетипово
    put('prop_crate', 30, 12);                                        // обманка: ящик під парканом ззовні

    // ===== 2. ЗВАЛИЩЕ (північний схід): машини, шини, бочки =====
    [[1950, 250, 0], [2300, 330, 25], [2050, 640, -15], [2450, 700, 80], [2200, 980, 10]].forEach(([x, y, r]) => m.prop('prop_wreck', x, y, 140, 80, r));
    m.prop('prop_cont_red', 2480, 220, 200, 80); m.prop('prop_cont_blue', 1900, 900, 80, 200);
    m.sq(2600, 440, 120, 260, '#57534e');
    const tiresAt = [[40, 9], [41, 9], [40, 10], [44, 4], [45, 4], [45, 5], [52, 12], [52, 13], [38, 15], [47, 17], [48, 17], [48, 18]];
    tiresAt.forEach(([x, y]) => put('prop_tires', x, y));
    [[43, 12], [44, 12], [43, 13], [50, 3], [51, 3], [36, 4], [46, 14]].forEach(([x, y]) => put('prop_barrel', x, y));
    put('prop_generator', 49, 8); put('prop_generator', 39, 18);
    put('prop_barrel', 41, 21);                                       // обманка: бочка в чистому полі біля дороги

    // ===== 3. СКЛАД (південний схід): ряди ящиків з пропусками, піддони, генератор =====
    const wh = m.bld(1750, 1950, 820, 560, { T: 28, wall: '#475569', floor: '#6b7280', roof: '#334155', stripe: '#facc15', ents: [{ side: 'n', at: 0.2, g: 150, door: 'prop_door_metal_d' }, { side: 'w', at: 0.5, g: 130 }, { side: 'n', at: 0.85, g: 120 }] });
    for (let y = 41; y <= 48; y += 3) for (let x = 37; x <= 49; x++) { if ((x + y * 3) % 7 === 0 || x === 43) continue; put('prop_crate', x, y); }      // ряди з «дірками» і проходом посередині
    put('prop_wood_pallet', 37, 50); put('prop_wood_pallet', 46, 50); put('prop_generator', 49, 50);
    put('prop_barrel', 36, 44);                                       // обманка біля входу
    // двір складу
    [[33, 38], [34, 38], [33, 39]].forEach(([x, y]) => put('prop_crate', x, y));
    put('prop_wood_pallet', 30, 41); put('prop_tires', 31, 46);

    // ===== 4. САД (південний захід / захід): дерева рядами, кущі, бочки під дощ =====
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { if ((i * 5 + j * 3) % 7 === 2) continue; m.tree(160 + i * 170 + (j % 2) * 40, 1350 + j * 190, ri(38, 50)); }
    [[3, 26], [4, 26], [9, 30], [13, 27], [13, 28], [2, 33], [12, 34]].forEach(([x, y]) => put('prop_bush', x, y));
    put('prop_wood_barrel', 15, 31); put('prop_wood_barrel', 15, 32);
    put('prop_bush', 6, 44);                                          // обманка: кущ на березі ставка
    put('prop_crate', 15, 49); put('prop_crate', 16, 49); put('prop_hay', 17, 47);

    // ===== 5. ЛУГ (центр): відкрите поле з кам'яними огорожами — і поодинокі «підозрілі» предмети =====
    m.sq(1000, 1450, 260, 40, '#78716c'); m.sq(1300, 1950, 40, 300, '#78716c'); m.sq(2000, 1300, 300, 40, '#78716c'); m.sq(800, 1750, 40, 220, '#78716c');
    [[20, 18], [29, 23], [24, 32], [36, 27], [19, 37], [33, 31]].forEach(([x, y], i) => put(['prop_crate', 'prop_barrel', 'prop_hay', 'prop_tires', 'prop_wood_barrel', 'prop_bush'][i], x, y));     // обманки посеред лугу
    [[21, 30], [22, 30], [21, 31]].forEach(([x, y]) => put('prop_crate', x, y));      // купка ящиків — справжнє укриття для 1–2 хованців
    for (let i = 0; i < 10; i++) { const x = rr(800, 2100), y = rr(800, 2300); if (m.free(x, y, 70)) m.tree(x, y, ri(40, 62)); }
    // ===== 6. ПІВДЕНЬ: хутір біля дороги =====
    m.bld(950, 2350, 360, 260, { T: 24, wall: '#8a5a2b', floor: '#a0794a', roof: '#9b5a45', ents: [{ side: 'n', at: 0.5, g: 130, door: 'prop_door_wood_s' }, { side: 'e', at: 0.4, g: 110 }] });
    put('prop_wood_barrel', 20, 49); put('prop_crate', 24, 48); put('prop_hay', 27, 52); put('prop_tires', 30, 50);
    put('prop_barrel', 26, 44);                                       // обманка на роздоріжжі
    // ===== 7. ЛІСОПИЛКА (південь-центр): штабелі дощок, дрова, колоди =====
    m.sq(1500, 2280, 40, 260, '#78716c');
    [[31, 46], [31, 48], [34, 46], [34, 48]].forEach(([x, y]) => put('prop_wood_planks', x, y));
    [[36, 45], [37, 45], [36, 50]].forEach(([x, y]) => put('prop_wood_barrel', x, y));
    m.prop('prop_wood_log', 1560, 2620, 120, 40); m.prop('prop_wood_log', 1700, 2660, 120, 40, 12);

    // купки по 2–4 однакові предмети по всій мапі (щоб маскування мало «природні» місця) …
    const CL = ['prop_crate', 'prop_barrel', 'prop_tires', 'prop_wood_barrel', 'prop_bush', 'prop_hay', 'prop_crate', 'prop_bush'];
    const SHAPES = [[[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1], [1, 1]]];
    for (let i = 0, n = 0; i < 900 && n < 60; i++) {
        const t = pick(CL), d = SZ[t] || [1, 1], x = ri(2, 52), y = ri(2, 52);
        if (!m.free(x * C + 25, y * C + 25, 60)) continue;
        const sh = pick(SHAPES); let k = 0;
        sh.forEach(([dx, dy]) => { if (put(t, x + dx * d[0], y + dy * d[1])) k++; });
        if (k) n++;
    }
    // … і поодинокі обманки на відкритих місцях
    for (let i = 0, n = 0; i < 600 && n < 22; i++) {
        const t = pick(['prop_crate', 'prop_barrel', 'prop_tires', 'prop_wood_barrel', 'prop_bush', 'prop_hay']), x = ri(2, 53), y = ri(2, 53);
        if (m.free(x * C + 25, y * C + 25, 110) && put(t, x, y)) n++;
    }
    return m;
}

const m = make(), out = m.out();
PH.gridify(out);      // контроль: дрібний декор уже по сітці — тут нічого не має змінитись
// прохідність: купки не мають замикати кишені. Еталон — та сама мапа без дрібного декору; поки є відрізані вільні клітинки,
// прибираємо дрібний предмет, найближчий до них.
{
    const Nav = require('../navgrid.js'), san = mm => MO.sanitizeMap(JSON.parse(JSON.stringify(mm)));
    const small = o => MO.phAligned(o);
    const field = mm => { const s = san(mm), g = Nav.getGrid(s, 26), sp = s.solids.find(o => o.type === 'spawn_player'); return { g, f: Nav.buildField(g, sp.x, sp.y) }; };
    const base = field(Object.assign({}, out, { solids: out.solids.filter(o => !small(o)) }));
    let cut = 0;
    for (let it = 0; it < 120; it++) {
        const now = field(out), lost = [];
        for (let i = 0; i < now.f.dist.length; i++) if (base.f.dist[i] >= 0 && now.g.walk[i] && now.f.dist[i] < 0) lost.push(i);
        if (!lost.length) break;
        let best = null, bd = 1e9;
        out.solids.forEach(o => {
            if (!small(o)) return;
            for (let j = 0; j < lost.length; j += Math.max(1, lost.length >> 6)) {
                const cx = (lost[j] % now.g.N + 0.5) * Nav.CS, cy = (Math.floor(lost[j] / now.g.N) + 0.5) * Nav.CS;
                const d = Math.hypot(Math.max(o.x - cx, 0, cx - (o.x + o.w)), Math.max(o.y - cy, 0, cy - (o.y + o.h)));
                if (d < bd) { bd = d; best = o; }
            }
        });
        if (!best) break;
        out.solids = out.solids.filter(o => o !== best); cut++;
    }
    if (cut) console.log('прохідність: прибрано предметів', cut);
}
const sm = MO.sanitizeMap(JSON.parse(JSON.stringify(out)));
if (sm.solids.length !== out.solids.length) throw new Error('sanitizeMap губить об\'єкти');
const inf = MO.phInfo(sm);
const src = fs.readFileSync(FILE, 'utf8'), head = src.slice(0, src.indexOf('module.exports'));
const maps = require(FILE); maps[NAME] = out;
fs.writeFileSync(FILE, head + 'module.exports = ' + JSON.stringify(maps) + ';\n');
console.log(NAME, out.size, 'об\'єктів', out.solids.length, '· рулетка:', inf.pool.map(t => MO.nameOf(t) + '×' + inf.count[t]).join(', '));
