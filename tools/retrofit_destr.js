// Доповнює вбудовані мапи (maps_modes.js) руйнівними об'єктами: стоси ящиків, вибухові бочки, паркани, сіно, шини…
// Розстановка детермінована (той самий результат при повторному запуску), лише на вільному місці, далеко від точок появи й цілей режимів.
// Повторний запуск нічого не дублює (позначка map.destrV). Запуск: node tools/retrofit_destr.js
'use strict';
const fs = require('fs'), path = require('path');
const FILE = path.join(__dirname, '..', 'maps_modes.js');
const MapObj = require('../public/js/mapobjects.js');
const maps = require(FILE);
const VER = 1;

function srand(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// групи: [тип, dx, dy, w, h] відносно центру групи
const G = {
    crates: rnd => { const n = 2 + Math.floor(rnd() * 2), out = []; for (let i = 0; i < n; i++) out.push(['prop_crate', (i % 2) * 52 - 26, Math.floor(i / 2) * 52 - 26, 50, 50]); return out; },
    barrels: rnd => { const n = 2 + Math.floor(rnd() * 2), out = []; for (let i = 0; i < n; i++) { const a = i * 2.1 + rnd(); out.push(['prop_barrel', Math.cos(a) * 26 - 20, Math.sin(a) * 26 - 20, 40, 40]); } return out; },
    gas: () => [['prop_gas', -36, -17, 34, 34], ['prop_gas', 2, -17, 34, 34], ['prop_crate', -25, 22, 50, 50]],
    fence: rnd => rnd() < 0.5 ? [['prop_fence_wood', -60, -10, 120, 20]] : [['prop_fence_wood', -60, -10, 120, 20], ['prop_fence_wood', 62, -10, 120, 20]],
    hay: () => [['prop_hay', -40, -40, 80, 80]],
    wood: rnd => [['prop_wood_pallet', -40, -30, 80, 60], ['prop_wood_barrel', 44, -22, 44, 44]].concat(rnd() < 0.5 ? [['prop_wood_planks', -45, 34, 90, 50]] : []),
    tires: () => [['prop_tires', -50, -25, 50, 50], ['prop_tires', 2, -25, 50, 50]],
    cones: () => [['prop_cone', -50, -15, 30, 30], ['prop_cone', -15, -15, 30, 30], ['prop_cone', 20, -15, 30, 30]],
    cart: () => [['prop_wood_cart', -45, -30, 90, 60], ['prop_hay', 50, -40, 80, 80]]
};
const BY_THEME = {
    grass: ['crates', 'barrels', 'fence', 'hay', 'wood', 'cart'], stone: ['crates', 'barrels', 'wood', 'fence', 'cart'], swamp: ['wood', 'fence', 'barrels', 'crates'],
    snow: ['crates', 'barrels', 'wood', 'fence'], sand: ['crates', 'barrels', 'hay', 'cart', 'gas'], metal: ['crates', 'barrels', 'gas', 'tires'],
    asphalt: ['crates', 'barrels', 'gas', 'tires', 'cones'], tech: ['barrels', 'gas', 'crates'], lava: ['barrels', 'crates']
};
// скільки груп на карту 3200×3200: PvP — більше укриттів, кооп — менше барикад, соло-арени — небагато; конвой не чіпаємо (маршрут вантажівки)
function plan(m) {
    const md = m.modes || [], area = (m.size / 3200) * (m.size / 3200);
    if (md.includes('convoy')) return 0;
    if (m.solids.length > 1200) return 0;      // великі мапи королівського бою вже мають сотні руйнівних об'єктів
    const pvp = md.some(x => ['deathmatch', 'team_deathmatch', 'capture_points', 'bounty', 'battle_royale', 'prophunt'].includes(x));
    const solo = md.every(x => ['solo_arena', 'boss_duel', 'survival'].includes(x)) && md.some(x => x === 'solo_arena' || x === 'boss_duel');
    return Math.round((pvp ? 16 : solo ? 6 : 9) * area);
}

let total = 0;
for (const name in maps) {
    const m = maps[name]; if (m.destrV >= VER) continue;
    const n = plan(m); if (!n) { m.destrV = VER; continue; }
    const rnd = srand(hash(name + '|destr'));
    const keep = m.solids.filter(o => o.type.indexOf('spawn') === 0);
    const kinds = BY_THEME[m.theme] || BY_THEME.grass;
    let made = 0;
    for (let tries = 0; tries < n * 40 && made < n; tries++) {
        const S = m.size, x = 180 + rnd() * (S - 360), y = 180 + rnd() * (S - 360);
        if (MapObj.hasShape(m) && !MapObj.circleInPoly(m.shape, x, y, 140)) continue;
        if (keep.some(s => Math.hypot(s.x - x, s.y - y) < 280)) continue;
        if (MapObj.collides(m, x, y, 110, { doorOpen: () => false })) continue;      // вільне місце з запасом на прохід навколо групи
        if (MapObj.surfAt(m, x, y) === 1) continue;                                     // не на дорогах
        const g = G[kinds[Math.floor(rnd() * kinds.length)]](rnd), rot = Math.round((rnd() - 0.5) * 40);
        const ca = Math.cos(rot * Math.PI / 180), sa = Math.sin(rot * Math.PI / 180);
        g.forEach(([type, dx, dy, w, h]) => {
            const ox = dx + w / 2, oy = dy + h / 2, rx = ox * ca - oy * sa, ry = ox * sa + oy * ca;      // поворот групи навколо її центру
            const o = { type, x: Math.round(x + rx - w / 2), y: Math.round(y + ry - h / 2), w, h }; if (rot && type !== 'prop_barrel' && type !== 'prop_gas') o.rot = rot;
            m.solids.push(o);
        });
        made++;
    }
    m.destrV = VER; total += made;
    console.log(name.padEnd(18), 'груп додано:', made, '/', n);
}
const src = fs.readFileSync(FILE, 'utf8'), head = src.slice(0, src.indexOf('module.exports'));
fs.writeFileSync(FILE, head + 'module.exports = ' + JSON.stringify(maps) + ';\n');
console.log('Разом груп:', total);
