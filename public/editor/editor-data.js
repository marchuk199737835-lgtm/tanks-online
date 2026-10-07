/* editor-data.js — стан редактора, вкладки та каталог інструментів */
const GRID_SIZE = 50;

const ED = {
    settings: { name: 'нова_мапа', title: '', modes: ['deathmatch', 'team_deathmatch', 'survival', 'prophunt'], size: 3000, bg: '#020617', grid: '#1e293b' },
    objects: [],            // об'єкти мапи (solids)
    shape: null,            // фігурний контур: [{x,y},...] або null (прямокутна мапа)
    tool: 'select',
    selected: null,         // вибраний об'єкт
    drawColor: '#3b82f6', drawWidth: 10,
    zoom: 0.35,
    mouse: { x: 0, y: 0, in: false },
    dirty: false,
    serverMaps: {}, serverInfo: {},     // мапи, отримані із сервера
    draftShape: null,       // контур, що малюється зараз (точки)
    dragVertex: -1,
    snapSize: GRID_SIZE
};

// Вкладки. Клавіші 1…9 та 0 перемикають їх по порядку.
const TABS = [
    { id: 'settings', name: 'Налашт.' }, { id: 'shapes', name: 'Фігури' },
    { id: 'props', name: 'Декор(20)' }, { id: 'wood', name: 'Дерево(10)' }, { id: 'extra', name: 'Інше(10)' },
    { id: 'doors', name: 'Двері' }, { id: 'neon', name: 'Неон' }, { id: 'water', name: 'Вода' },
    { id: 'spawns', name: 'Спавни' }, { id: 'contour', name: 'Контур' }
];
const tabKey = (i) => (i === 9 ? '0' : String(i + 1));

const eraser = { id: 'eraser', name: '🧽 Гумка' };
const toTools = (list) => list.map(p => ({ id: p.id, name: p.name })).concat([eraser]);

const TOOLS = {
    settings: [{ type: 'custom', render: 'settings' }],
    shapes: [
        { type: 'html', html: `<div class="mb-3 p-3 bg-slate-800 rounded-xl"><label class="text-[10px] text-slate-400 block mb-1">Колір об'єктів / ліній</label><input type="color" id="shape-color" value="#3b82f6" class="w-full h-8 bg-transparent cursor-pointer mb-2"><label class="text-[10px] text-slate-400 block mb-1">Товщина лінії (пензель)</label><input type="range" id="line-width" min="2" max="60" value="10" class="w-full"></div>` },
        { id: 'shape_line', name: 'Крива лінія (пензель)' }, { id: 'wall_square', name: 'Квадрат / Прямокутник' },
        { id: 'shape_triangle', name: 'Трикутник' }, { id: 'shape_rhombus', name: 'Ромб' }, { id: 'shape_parallelepiped', name: 'Паралелепіпед' }, eraser
    ],
    props: toTools(MapObj.PROPS_BASE),
    wood: toTools(MapObj.PROPS_WOOD),
    extra: toTools(MapObj.PROPS_EXTRA),
    doors: [{ type: 'html', html: `<p class="hint">Авто-двері відкриваються самі, коли до них наближається танк (і закриваються, коли він відійшов). Клік — стандартний розмір, перетягування — своя довжина. Повернути — клік по дверях.</p>` }]
        .concat(MapObj.DOORS.map(d => ({ id: d.id, name: d.name + ' (' + d.w + '×' + d.h + ')' }))).concat([eraser]),
    neon: [
        { id: 'neon_wall', name: 'Неонова стіна' }, { id: 'neon_circle', name: 'Неонове кільце' }, { id: 'neon_triangle', name: 'Неоновий трикутник' },
        { id: 'neon_cross', name: 'Неоновий хрест' }, { id: 'neon_diamond', name: 'Неоновий ромб' }, { id: 'neon_arch', name: 'Неонова арка' }, { id: 'neon_pillar', name: 'Неоновий стовп' }, eraser
    ],
    water: [{ id: 'water_square', name: 'Куб води' }, { id: 'water_curve', name: 'Заокруглена вода' }, eraser],
    spawns: [
        { id: 'spawn_player', name: 'Спавн: Гравець (невидимий у грі)' }, { id: 'spawn_zombie', name: 'Спавн: Зомбі (невидимий)' },
        { id: 'spawn_powerup', name: 'Спавн: Лут / баф (невидимий)' },
        { id: 'spawn_core', name: '🏰 Ядро бази — Оборона бази (невидимий)' }, { id: 'spawn_cp', name: '🚩 Точка захоплення — Захоплення точок (невидимий)' },
        { id: 'spawn_convoy_a', name: '🚚 Конвой: старт A (невидимий)' }, { id: 'spawn_convoy_b', name: '🏁 Конвой: фініш B (невидимий)' }, eraser
    ],
    contour: [{ type: 'custom', render: 'contour' }]
};

const NAMES = {};
Object.keys(TOOLS).forEach(k => TOOLS[k].forEach(t => { if (t.id) NAMES[t.id] = t.name.replace(/ \(\d+×\d+\)$/, ''); }));
NAMES.line = 'Лінія'; NAMES.tree = 'Дерево'; NAMES.wall = 'Стіна';

// Попередньо задані контури
function shapePreset(kind, size) {
    const s = size, c = s / 2, R = s * 0.45, pts = [];
    const poly = (n, rot, rad) => { for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; pts.push({ x: c + Math.cos(a) * rad, y: c + Math.sin(a) * rad }); } };
    if (kind === 'hexagon') poly(6, 0, R);
    else if (kind === 'circle') poly(28, 0, R);
    else if (kind === 'diamond') poly(4, -Math.PI / 2, R);
    else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? R * 0.48 : R; pts.push({ x: c + Math.cos(a) * rad, y: c + Math.sin(a) * rad }); } }
    else if (kind === 'cross') { const a = s * 0.18, b = s * 0.82, m = s * 0.06, n = s * 0.94; [[a, m], [b, m], [b, a], [n, a], [n, b], [b, b], [b, n], [a, n], [a, b], [m, b], [m, a], [a, a]].forEach(p => pts.push({ x: p[0], y: p[1] })); }
    else if (kind === 'lshape') { const m = s * 0.06, n = s * 0.94, h = s * 0.5; [[m, m], [h, m], [h, h], [n, h], [n, n], [m, n]].forEach(p => pts.push({ x: p[0], y: p[1] })); }
    else if (kind === 'island') { const n = 20; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, rad = R * (0.72 + rnd() * 0.28); pts.push({ x: c + Math.cos(a) * rad, y: c + Math.sin(a) * rad }); } }
    return pts.map(p => ({ x: Math.round(p.x / 25) * 25, y: Math.round(p.y / 25) * 25 }));
}

function snap(v, step) { step = step || GRID_SIZE; return Math.round(v / step) * step; }
const clone = (o) => JSON.parse(JSON.stringify(o));
