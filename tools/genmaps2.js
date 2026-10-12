// Генератор 20 нових мап (2026-10). Запуск: node tools/genmaps2.js — ДОДАЄ (або оновлює за назвою) мапи в maps_modes.js,
// не чіпаючи наявних (на відміну від genmaps.js, що перезаписує файл повністю). Розстановка детермінована: зерно — назва мапи.
//  • tools/maps2/pvp.js   — 8 мап: детматч / «Ціль» / хованки (4) і командний / точки / раунди (4)
//  • tools/maps2/br.js    — 2 мапи королівського бою 7500×7500 (зимова долина, телецентр)
//  • tools/maps2/coop.js  — 10 мап: виживання / оборона (3), конвой (2), рейд на боса (2), арена / дуель (3)
'use strict';
const fs = require('fs'), path = require('path');
const MO = require('../public/js/mapobjects.js');
const L = require('./maplib.js');
const FILE = path.join(__dirname, '..', 'maps_modes.js');

const made = {};
// мапи нових режимів дозволяємо й у схожих класичних (як у genmaps.js), щоб жоден режим не лишався без мап
function def(name, size, theme, modes, bg, fn) {
    const m = new L.M(name, size, theme, modes, bg); fn(m); const out = m.out();
    {   // точки появи гравців у замкнених кишенях прибираємо (якщо лишається достатньо інших)
        const Nav = require('../navgrid.js'), g = Nav.getGrid(out, 26), sps = out.solids.filter(o => o.type === 'spawn_player'), fld = Nav.buildField(g, sps[0].x, sps[0].y);
        const ok = o => fld.dist[Math.floor(o.y / Nav.CS) * g.N + Math.floor(o.x / Nav.CS)] >= 0, bad = sps.filter(o => !ok(o));
        if (bad.length && sps.length - bad.length >= 4) out.solids = out.solids.filter(o => !bad.includes(o));
    }
    const sm = MO.sanitizeMap(JSON.parse(JSON.stringify(out)));
    if (sm.solids.length !== out.solids.length) throw new Error(name + ': sanitizeMap гублює об\'єкти (' + out.solids.length + ' → ' + sm.solids.length + ')');
    if (!out.solids.some(o => o.type === 'spawn_player')) throw new Error(name + ': немає точок появи');
    made[name] = out; return m;
}
require('./maps2/pvp.js')(def, L);
require('./maps2/br.js')(def, L);
require('./maps2/coop.js')(def, L);

const src = fs.readFileSync(FILE, 'utf8'), head = src.slice(0, src.indexOf('module.exports'));
delete require.cache[require.resolve(FILE)];
const maps = require(FILE);
Object.assign(maps, made);
// ===== ЧІТКИЙ РОЗПОДІЛ МАП ЗА РЕЖИМАМИ (кожна мапа — у своїй групі; королівський бій — лише 3 найбільші мапи) =====
const FFA = ['deathmatch', 'bounty', 'prophunt'], TEAM = ['team_deathmatch', 'capture_points', 'rounds'];
const MODES_BY_MAP = {
    // кожен сам за себе: детматч, «Ціль», хованки
    'Neon City': FFA, 'Old Town': FFA, 'Harbor': FFA, 'Emerald Island': FFA, 'Frostbite Peak': FFA, 'Dust Bowl': FFA,
    'Warehouse 9': FFA, 'Night Market': FFA, 'Steel Works': FFA, 'Dacha Village': FFA,
    // лише хованки (tools/genhide.js): асиметрична мапа з обманками
    'Decoy Yard': ['prophunt'],
    // команди: командний бій, захоплення точок, раунди
    'Crossroads': TEAM, 'Factory Zone': TEAM, 'Frozen Lake': TEAM, 'Metro Line': TEAM, 'Cargo Port': TEAM, 'Army Base': TEAM, 'Ruined City': TEAM,
    // королівський бій — лише найбільші мапи
    'Grand Expanse': ['battle_royale'], 'Frozen Valley': ['battle_royale'], 'TV Center': ['battle_royale'],
    // кооператив: оборона бази + виживання (мапи з ядром)
    'Iron Bastion': ['base_defense', 'survival'], 'Frozen Outpost': ['base_defense', 'survival'], 'Desert Fort': ['base_defense', 'survival'],
    'Orbital Station': ['base_defense', 'survival'], 'Starship': ['base_defense', 'survival'], 'Tropic Island': ['base_defense', 'survival'],
    // кооператив: рейд на боса + виживання
    'Throne Hall': ['boss_raid', 'survival'], 'Volcano Crater': ['boss_raid', 'survival'], 'Haunted Swamp': ['boss_raid', 'survival'], 'Alien Crater': ['boss_raid', 'survival'], 'Sunken Ship': ['boss_raid', 'survival'],
    // кооператив: конвой (мапи-коридори з маршрутом)
    'Highway Run': ['convoy'], 'Frozen Pass': ['convoy'], 'Canyon Express': ['convoy'], 'Jungle Run': ['convoy'], 'Mars Canyon': ['convoy'],
    // соло: арена хвиль і дуель з босами
    'Colosseum': ['solo_arena'], 'Neon Grid': ['solo_arena'], 'Ruined Plaza': ['solo_arena'],
    'Duelist Pit': ['boss_duel'], 'Ice Cathedral': ['boss_duel'], 'Lava Pit': ['boss_duel'],
    'Orbital Arena': ['solo_arena', 'boss_duel'], 'Volcano Core': ['solo_arena', 'boss_duel'], 'Ice Cave': ['solo_arena', 'boss_duel']
};
for (const k in maps) { if (MODES_BY_MAP[k]) maps[k].modes = MODES_BY_MAP[k].slice(); else console.warn('⚠️ мапа без групи режимів:', k); }
require('./phgrid.js').apply(maps, true);      // хованки: дрібний декор — по сітці 50 px, як маскування гравців
fs.writeFileSync(FILE, head + 'module.exports = ' + JSON.stringify(maps) + ';\n');
for (const k in made) { const m = made[k], d = MO.destrList(m).length; console.log(k.padEnd(16), String(m.size).padEnd(5), m.theme.padEnd(8), (m.modes || []).join(',').padEnd(46), 'об\'єктів', m.solids.length, 'руйнівних', d); }
console.log('Нових мап:', Object.keys(made).length, '· усього в maps_modes.js:', Object.keys(maps).length);
