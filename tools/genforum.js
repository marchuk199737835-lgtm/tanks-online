// Мапа «Форум» (2026-10) — спільна площа режиму «Гладіатори» між раундами: тут гравці чекають, купують бафи й кейси та ставлять на дуелянтів.
// Центр — площа зі статуєю й колонадою; північний схід — «Лавка» (зона магазину, тут відкривається вікно покупок);
// північний захід — «Табло ставок»; південь — брама до Колізею (декор). Мапа службова: modes = ['gladiators'], у меню вибору мап її немає.
// Координати зон (магазин / табло) мають збігатися з gladiators.js (ZONES).
// Запуск: node tools/genforum.js — додає (або оновлює) мапу в maps/.
'use strict';
const L = require('./maplib.js');
const Store = require('../maps');
const NAME = 'Forum', S = 2400;
const ZONES = { shop: { x: 1790, y: 640, r: 150 }, bets: { x: 610, y: 640, r: 150 } };

function make() {
    const m = new L.M(NAME, S, 'stone', ['gladiators'], '#9a8f80');
    const STONE = '#a8957a', STRIPE = '#d8c7a6', COL = '#b9a98a', CX = 1200, CY = 1200;
    m.border(40, '#6f6455');
    // ---- дороги від площі до зон і брами ----
    m.road([[CX, CY], [ZONES.shop.x, ZONES.shop.y]], 120, '#b6a68c', null);
    m.road([[CX, CY], [ZONES.bets.x, ZONES.bets.y]], 120, '#b6a68c', null);
    m.road([[CX, CY], [CX, 2280]], 140, '#b6a68c', null);
    m.road([[300, 1200], [2100, 1200]], 90, '#b6a68c', null);
    // ---- центральна площа: статуя, жаровні, колонада з проходами ----
    m.floor(CX - 330, CY - 330, 660, 660, '#c4b394');
    m.prop('prop_statue', CX - 60, CY - 60, 120, 120); m.keep(CX, CY, 300);
    [[-170, -170], [130, -170], [-170, 130], [130, 130]].forEach(([dx, dy]) => m.prop('prop_campfire', CX + dx, CY + dy, 40, 40));
    for (let i = 0; i < 16; i++) {
        const a = i / 16 * L.TAU + L.TAU / 32; if (i % 4 === 1) continue;      // проходи на 4 боки
        m.sq(CX + Math.cos(a) * 470 - 30, CY + Math.sin(a) * 470 - 30, 60, 60, COL, { stripe: STRIPE });
    }
    // ---- «Лавка» (магазин): відкритий двір із золотою підлогою; зона покупок — у центрі ----
    const sh = ZONES.shop;
    m.bld(sh.x - 230, sh.y - 180, 460, 360, { T: 26, wall: STONE, stripe: STRIPE, floor: '#6b5a2e', neon: '#fbbf24', roofless: true,
        ents: [{ side: 's', at: 0.5, g: 170, door: null }, { side: 'w', at: 0.5, g: 150, door: null }],
        furn: [['prop_vending', 60, 40, 'wall'], ['prop_vending', 60, 40, 'wall'], ['prop_shelf', 90, 34, 'wall'], ['prop_shelf', 90, 34, 'wall'], ['prop_wood_table', 70, 50, 'corner']] });
    m.keep(sh.x, sh.y, sh.r);
    // ---- «Табло ставок»: фіолетова зала з терміналами ----
    const bt = ZONES.bets;
    m.bld(bt.x - 230, bt.y - 180, 460, 360, { T: 26, wall: STONE, stripe: STRIPE, floor: '#3b2f5a', neon: '#a855f7', roofless: true,
        ents: [{ side: 's', at: 0.5, g: 170, door: null }, { side: 'e', at: 0.5, g: 150, door: null }],
        furn: [['prop_terminal', 50, 50, 'wall'], ['prop_terminal', 50, 50, 'wall'], ['prop_monitor', 80, 30, 'wall'], ['prop_monitor', 80, 30, 'wall'], ['prop_spotlight', 40, 40, 'corner']] });
    m.keep(bt.x, bt.y, bt.r);
    // ---- брама Колізею на півдні: дві вежі й арка (прохід лишається) ----
    m.sq(CX - 260, 2040, 120, 160, STONE, { stripe: STRIPE }); m.sq(CX + 140, 2040, 120, 160, STONE, { stripe: STRIPE });
    m.wall(CX - 140, 2040, 280, 30, STONE, { stripe: STRIPE });
    m.prop('prop_campfire', CX - 120, 2120, 40, 40); m.prop('prop_campfire', CX + 80, 2120, 40, 40);
    // ---- декор по краях: лавки, вазони, сіно, бочки ----
    m.scatter(10, [120, 1450, 800, 800], 40, (x, y) => m.prop(L.pick(['prop_wood_bench', 'prop_plant', 'prop_hay', 'prop_wood_barrel']), x - 25, y - 25, 50, 50));
    m.scatter(10, [1480, 1450, 800, 800], 40, (x, y) => m.prop(L.pick(['prop_wood_bench', 'prop_plant', 'prop_hay', 'prop_wood_barrel']), x - 25, y - 25, 50, 50));
    m.scatter(6, [900, 120, 600, 300], 40, (x, y) => m.prop(L.pick(['prop_plant', 'prop_rock']), x - 30, y - 30, 60, 60));
    // ---- спавни: колом навколо площі ----
    for (let i = 0; i < 10; i++) { const a = i / 10 * L.TAU; m.P(CX + Math.cos(a) * 340, CY + Math.sin(a) * 340); }
    return m.out();
}

if (require.main === module) {
    const all = Store.readAll(); all[NAME] = make(); Store.writeAll(all);
    console.log('Forum: об\'єктів', all[NAME].solids.length);
}
module.exports = { make, ZONES };
