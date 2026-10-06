/* navgrid.js — пошук шляху для зомбі: сітка прохідності + «поле потоку» (BFS від гравця).
 * Зомбі йдуть по найкоротшому шляху в обхід стін, барикад, води й дверей і не застрягають у кутах. */
const MapObj = require('./public/js/mapobjects.js');
const CS = 30;                        // розмір клітинки
const CLASSES = [18, 25, 30];         // радіуси, під які будуються сітки (клітинка прохідна, якщо в ній вміщується коло такого радіуса)
const cache = new WeakMap();
const fieldStore = new WeakMap();   // кеш полів по кімнатах (не зберігаємо в самій кімнаті — її серіалізують і шлють клієнтам)

function navClass(radius) { for (const c of CLASSES) if (radius <= c) return c; return CLASSES[CLASSES.length - 1]; }

// Сітка прохідності для мапи й радіуса (двері вважаються зачиненими); будується один раз
function getGrid(map, rad) {
    let e = cache.get(map); if (!e) { e = {}; cache.set(map, e); }
    if (e[rad]) return e[rad];
    const N = Math.max(1, Math.ceil(map.size / CS)), walk = new Uint8Array(N * N);
    for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++)
        walk[gy * N + gx] = MapObj.collides(map, (gx + 0.5) * CS, (gy + 0.5) * CS, rad, { doorOpen: () => false }) ? 0 : 1;
    return (e[rad] = { N: N, walk: walk });
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
// BFS від клітинки цілі: dist[клітинка] = кількість кроків до цілі (-1 — недосяжна)
function buildField(grid, tx, ty) {
    const N = grid.N, walk = grid.walk, dist = new Int16Array(N * N).fill(-1), q = new Int32Array(N * N);
    const cx = Math.max(0, Math.min(N - 1, Math.floor(tx / CS))), cy = Math.max(0, Math.min(N - 1, Math.floor(ty / CS)));
    let h = 0, t = 0; dist[cy * N + cx] = 0; q[t++] = cy * N + cx;
    while (h < t) {
        const cur = q[h++], x = cur % N, y = (cur - x) / N, d = dist[cur] + 1;
        for (let k = 0; k < 8; k++) {
            const nx = x + NB[k][0], ny = y + NB[k][1];
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const ni = ny * N + nx;
            if (dist[ni] >= 0 || !walk[ni]) continue;
            if (k >= 4 && (!walk[y * N + nx] || !walk[ny * N + x])) continue; // не різати кути
            dist[ni] = d; q[t++] = ni;
        }
    }
    return { dist: dist, cx: cx, cy: cy };
}

// Наступна точка шляху з (x,y) до цілі або null (поруч із ціллю / шляху немає)
function nextWaypoint(grid, field, x, y) {
    const N = grid.N, walk = grid.walk, dist = field.dist;
    const cx = Math.max(0, Math.min(N - 1, Math.floor(x / CS))), cy = Math.max(0, Math.min(N - 1, Math.floor(y / CS)));
    const cur = dist[cy * N + cx];
    let best = null, bd = cur >= 0 ? cur : 1e9;
    for (let k = 0; k < 8; k++) {
        const nx = cx + NB[k][0], ny = cy + NB[k][1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const ni = ny * N + nx, d = dist[ni];
        if (d < 0 || !walk[ni]) continue;
        if (k >= 4 && (!walk[cy * N + nx] || !walk[ny * N + cx])) continue;
        if (d < bd) { bd = d; best = { x: (nx + 0.5) * CS, y: (ny + 0.5) * CS }; }
    }
    return best;
}

// Чи вільний прямий відрізок для кола радіуса r (перевірка кроками)
function lineClear(map, x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 12));
    for (let i = 1; i <= n; i++) { const t = i / n; if (MapObj.collides(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, { doorOpen: () => false })) return false; }
    return true;
}

// Напрям руху зомбі до цілі: {x,y} — точка, у бік якої рухатись. cacheObj — будь-який об'єкт для кешу полів (кімната)
function steer(map, cacheObj, targetKey, tx, ty, zx, zy, radius, now) {
    const cls = navClass(radius), grid = getGrid(map, cls);
    // близько й без перешкод — йдемо напряму
    if (Math.hypot(tx - zx, ty - zy) < 220 && lineClear(map, zx, zy, tx, ty, radius)) return { x: tx, y: ty };
    let store = fieldStore.get(cacheObj); if (!store) { store = {}; fieldStore.set(cacheObj, store); }
    const key = cls + '_' + targetKey;
    let f = store[key];
    const tcx = Math.floor(tx / CS), tcy = Math.floor(ty / CS);
    if (!f || f.cx !== tcx || f.cy !== tcy ? (!f || now - f.at > 120) : now - f.at > 1500) {
        const fl = buildField(grid, tx, ty); f = store[key] = { dist: fl.dist, cx: tcx, cy: tcy, at: now };
    }
    const w = nextWaypoint(grid, f, zx, zy);
    return w || { x: tx, y: ty };
}

module.exports = { steer, getGrid, buildField, nextWaypoint, lineClear, navClass, CS };
