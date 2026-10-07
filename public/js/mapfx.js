/* =====================================================================
 * mapfx.js — «2D під 3D» вигляд мап: текстури землі, об'ємні стіни зі сторонніми гранями й тінню,
 * пишні дерева, жива вода, дороги. Використовується і грою, і редактором (однаковий вигляд).
 * Усе дешеве: земля — один візерунок-патерн, дерева — готові спрайти, тіні — без shadowBlur.
 * Поле map.theme: grass | sand | snow | stone | asphalt | metal | dirt | swamp | lava | tech (немає = старий плоский вигляд).
 * ===================================================================== */
var MapFX = (function () {
    'use strict';
    const TILE = 512;

    // ---------- допоміжне ----------
    function rngOf(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    const _rgb = Object.create(null);
    function rgb(hex) {
        if (_rgb[hex]) return _rgb[hex];
        if (typeof hex === 'string' && hex.charCodeAt(0) === 114) { const m = hex.match(/\d+/g); if (m && m.length >= 3) return (_rgb[hex] = [+m[0], +m[1], +m[2]]); }
        let h = String(hex || '#555555').replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        const n = parseInt(h.slice(0, 6), 16); const v = isNaN(n) ? [85, 85, 85] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
        return (_rgb[hex] = v);
    }
    const _sh = Object.create(null);
    // shade(hex, k): k<1 — темніше, k>1 — світліше (до білого)
    function shade(hex, k) {
        const key = hex + '|' + k; if (_sh[key]) return _sh[key];
        const c = rgb(hex); let r, g, b;
        if (k <= 1) { r = c[0] * k; g = c[1] * k; b = c[2] * k; } else { const t = Math.min(1, k - 1); r = c[0] + (255 - c[0]) * t; g = c[1] + (255 - c[1]) * t; b = c[2] + (255 - c[2]) * t; }
        return (_sh[key] = 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')');
    }
    function rgba(hex, a, k) { const c = rgb(hex), m = k == null ? 1 : k; return 'rgba(' + Math.min(255, c[0] * m | 0) + ',' + Math.min(255, c[1] * m | 0) + ',' + Math.min(255, c[2] * m | 0) + ',' + a + ')'; }
    function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

    // ---------- ТЕМИ ----------
    const THEMES = {
        grass:   { kind: 'grass',   water: ['#0b5f86', '#38a3c8', '#d9f4ff'], tree: { kind: 'leaf', cols: ['#14532d', '#166534', '#22863a', '#4ade80'] }, wall: '#6b7280' },
        sand:    { kind: 'sand',    water: ['#0e7490', '#3cc1cf', '#e6fbff'], tree: { kind: 'palm', cols: ['#3f6212', '#4d7c0f', '#65a30d', '#bef264'] }, wall: '#a8855a' },
        snow:    { kind: 'snow',    water: ['#1e6091', '#8fd3f4', '#ffffff'], tree: { kind: 'pine', cols: ['#0f3d2e', '#14532d', '#1f7a45', '#e8f4ff'] }, wall: '#7b8794' },
        stone:   { kind: 'stone',   water: ['#0b5f86', '#38a3c8', '#d9f4ff'], tree: { kind: 'leaf', cols: ['#365314', '#4d7c0f', '#65a30d', '#a3e635'] }, wall: '#7c6f64' },
        asphalt: { kind: 'asphalt', water: ['#0c4a6e', '#2a85b5', '#bfe9ff'], tree: { kind: 'leaf', cols: ['#14532d', '#166534', '#15803d', '#4ade80'] }, wall: '#52525b' },
        metal:   { kind: 'metal',   water: ['#0f3d56', '#1f8fb8', '#a5f3fc'], tree: { kind: 'leaf', cols: ['#134e4a', '#115e59', '#0f766e', '#5eead4'] }, wall: '#475569' },
        dirt:    { kind: 'dirt',    water: ['#0b5f86', '#3b9ac4', '#d9f4ff'], tree: { kind: 'leaf', cols: ['#7c2d12', '#9a3412', '#c2410c', '#fb923c'] }, wall: '#6f5a46' },
        swamp:   { kind: 'swamp',   water: ['#14532d', '#2f8f5a', '#bbf7d0'], tree: { kind: 'leaf', cols: ['#0f2e1d', '#14532d', '#1a6b3a', '#3fa66a'] }, wall: '#4b5a4a' },
        lava:    { kind: 'lava',    water: ['#7c1d0b', '#f97316', '#fde68a'], tree: { kind: 'dead', cols: ['#1c1917', '#292524', '#44403c', '#78716c'] }, wall: '#3f3a40' },
        tech:    { kind: 'tech',    water: ['#082f49', '#0ea5e9', '#a5f3fc'], tree: { kind: 'leaf', cols: ['#134e4a', '#0f766e', '#14b8a6', '#5eead4'] }, wall: '#334155' }
    };
    function themeOf(map) { return map && map.theme && THEMES[map.theme] || null; }

    // ---------- ЗЕМЛЯ (патерн 512×512 без швів) ----------
    const _tiles = Object.create(null), _pats = new WeakMap();
    function W(x, y, m, fn) { const xs = [x], ys = [y]; if (x < m) xs.push(x + TILE); if (x > TILE - m) xs.push(x - TILE); if (y < m) ys.push(y + TILE); if (y > TILE - m) ys.push(y - TILE); for (const px of xs) for (const py of ys) fn(px, py); }
    function blotches(g, R, n, col, a, r0, r1) {
        for (let i = 0; i < n; i++) {
            const x = R() * TILE, y = R() * TILE, r = r0 + R() * (r1 - r0);
            W(x, y, r, (px, py) => { const gr = g.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, rgba(col, a)); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(px - r, py - r, r * 2, r * 2); });
        }
    }
    function polyline(g, pts, wrapM) { W(pts[0][0], pts[0][1], wrapM || 30, (ox, oy) => { const dx = ox - pts[0][0], dy = oy - pts[0][1]; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.stroke(); }); }
    const GROUND = {
        grass(g, b, R) {
            blotches(g, R, 30, shade(b, 1.3), 0.16, 50, 130); blotches(g, R, 30, shade(b, 0.7), 0.2, 50, 130);
            g.lineCap = 'round';
            for (let i = 0; i < 1500; i++) { const x = R() * TILE, y = R() * TILE, l = 4 + R() * 6, a = -Math.PI / 2 + (R() - 0.5) * 1.2; g.strokeStyle = R() < 0.5 ? rgba(shade(b, 1.45), 0.5) : rgba(shade(b, 0.55), 0.55); g.lineWidth = 1.2; W(x, y, 10, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); g.stroke(); }); }
            for (let i = 0; i < 70; i++) { const x = R() * TILE, y = R() * TILE; g.fillStyle = rgba(shade(b, 0.6), 0.22); W(x, y, 16, (px, py) => { g.beginPath(); g.ellipse(px, py, 7 + R() * 8, 3 + R() * 3, 0, 0, 6.283); g.fill(); }); }
            const fl = ['#fde68a', '#ffffff', '#fca5a5', '#c4b5fd']; for (let i = 0; i < 26; i++) { g.fillStyle = fl[i % 4]; W(R() * TILE, R() * TILE, 4, (px, py) => { g.beginPath(); g.arc(px, py, 1.5, 0, 6.283); g.fill(); }); }
        },
        sand(g, b, R) {
            blotches(g, R, 28, shade(b, 1.22), 0.2, 60, 140); blotches(g, R, 28, shade(b, 0.8), 0.2, 60, 140);
            g.lineCap = 'round';
            for (let i = 0; i < 44; i++) {
                const x = R() * TILE, y = R() * TILE, n = 8 + (R() * 10 | 0), pts = []; for (let k = 0; k < n; k++) pts.push([x + k * 14, y + Math.sin(k * 0.6 + i) * 3]);
                g.strokeStyle = rgba(shade(b, 0.78), 0.4); g.lineWidth = 1.6; polyline(g, pts, 200);
                const p2 = pts.map(p => [p[0], p[1] + 2.4]); g.strokeStyle = rgba(shade(b, 1.25), 0.4); g.lineWidth = 1.2; polyline(g, p2, 200);
            }
            for (let i = 0; i < 300; i++) { const x = R() * TILE, y = R() * TILE, r = 0.8 + R() * 1.6; g.fillStyle = rgba(shade(b, 0.65), 0.5); W(x, y, 4, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * 0.7, 0, 0, 6.283); g.fill(); g.fillStyle = rgba(shade(b, 1.35), 0.5); g.fillRect(px - r * 0.5, py - r, r * 0.8, 0.8); g.fillStyle = rgba(shade(b, 0.65), 0.5); }); }
        },
        snow(g, b, R) {
            blotches(g, R, 30, '#bcd7f5', 0.16, 60, 150); blotches(g, R, 24, '#ffffff', 0.28, 50, 120);
            g.lineCap = 'round';
            for (let i = 0; i < 34; i++) { const x = R() * TILE, y = R() * TILE, n = 6 + (R() * 6 | 0), pts = []; for (let k = 0; k < n; k++) pts.push([x + k * 16, y + Math.sin(k * 0.7 + i) * 4]); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 3; polyline(g, pts, 200); g.strokeStyle = 'rgba(150,185,225,0.28)'; g.lineWidth = 1.4; polyline(g, pts.map(p => [p[0], p[1] + 3]), 200); }
            for (let i = 0; i < 320; i++) { g.fillStyle = 'rgba(255,255,255,' + (0.5 + R() * 0.5) + ')'; W(R() * TILE, R() * TILE, 3, (px, py) => g.fillRect(px, py, 1.4, 1.4)); }
        },
        stone(g, b, R) {
            const S = 64;
            for (let gy = 0; gy < TILE / S; gy++) for (let gx = 0; gx < TILE / S; gx++) {
                const k = 0.9 + R() * 0.2; g.fillStyle = shade(b, k); g.fillRect(gx * S, gy * S, S, S);
                const gr = g.createLinearGradient(gx * S, gy * S, gx * S + S, gy * S + S); gr.addColorStop(0, 'rgba(255,255,255,0.07)'); gr.addColorStop(1, 'rgba(0,0,0,0.09)'); g.fillStyle = gr; g.fillRect(gx * S, gy * S, S, S);
                g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(gx * S + 1, gy * S + 1, S - 2, 1.5); g.fillRect(gx * S + 1, gy * S + 1, 1.5, S - 2);
                g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(gx * S, gy * S + S - 1.5, S, 1.5); g.fillRect(gx * S + S - 1.5, gy * S, 1.5, S);
                if (R() < 0.18) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.beginPath(); let x = gx * S + 8 + R() * 48, y = gy * S + 6; g.moveTo(x, y); for (let q = 0; q < 4; q++) { x += (R() - 0.5) * 14; y += 8 + R() * 8; g.lineTo(x, y); } g.stroke(); }
            }
            blotches(g, R, 14, '#000000', 0.07, 60, 140); blotches(g, R, 10, '#ffffff', 0.05, 60, 140);
            for (let i = 0; i < 700; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'; g.fillRect(R() * TILE, R() * TILE, 1.5, 1.5); }
        },
        asphalt(g, b, R) {
            blotches(g, R, 26, shade(b, 1.35), 0.12, 60, 140); blotches(g, R, 26, shade(b, 0.6), 0.2, 60, 140);
            for (let i = 0; i < 4200; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,' + (0.1 + R() * 0.15) + ')' : 'rgba(255,255,255,' + (0.04 + R() * 0.07) + ')'; g.fillRect(R() * TILE, R() * TILE, 1 + (R() < 0.2 ? 1 : 0), 1); }
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (let i = 0; i < 9; i++) { let x = R() * TILE, y = R() * TILE; const pts = [[x, y]]; for (let k = 0; k < 7; k++) { x += (R() - 0.5) * 40; y += (R() - 0.3) * 30; pts.push([x, y]); } g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.3; polyline(g, pts, 120); g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; polyline(g, pts.map(p => [p[0] + 1.3, p[1] + 1.3]), 120); }
            for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(0,0,0,0.13)'; W(R() * TILE, R() * TILE, 40, (px, py) => { g.beginPath(); g.ellipse(px, py, 14 + R() * 16, 8 + R() * 8, R() * 3, 0, 6.283); g.fill(); }); }
        },
        metal(g, b, R) {
            const S = 128;
            for (let gy = 0; gy < TILE / S; gy++) for (let gx = 0; gx < TILE / S; gx++) {
                const x0 = gx * S, y0 = gy * S; g.fillStyle = shade(b, 0.9 + R() * 0.2); g.fillRect(x0, y0, S, S);
                for (let k = 0; k < 46; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.05)'; g.fillRect(x0, y0 + R() * S, S, 1); }
                const gr = g.createLinearGradient(x0, y0, x0 + S, y0 + S); gr.addColorStop(0, 'rgba(255,255,255,0.09)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(x0, y0, S, S);
                g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(x0, y0, S, 2); g.fillRect(x0, y0, 2, S); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x0 + 2, y0 + 2, S - 2, 1); g.fillRect(x0 + 2, y0 + 2, 1, S - 2);
                [[10, 10], [S - 10, 10], [10, S - 10], [S - 10, S - 10]].forEach(p => { g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x0 + p[0] + 0.8, y0 + p[1] + 0.8, 2.6, 0, 6.283); g.fill(); g.fillStyle = shade(b, 1.35); g.beginPath(); g.arc(x0 + p[0], y0 + p[1], 2.2, 0, 6.283); g.fill(); });
            }
            g.lineCap = 'round'; for (let i = 0; i < 46; i++) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; const x = R() * TILE, y = R() * TILE; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5 + R() * 12, y + 3 + R() * 8); g.stroke(); }
            blotches(g, R, 12, '#000000', 0.1, 40, 110);
        },
        dirt(g, b, R) {
            blotches(g, R, 34, shade(b, 1.3), 0.2, 50, 130); blotches(g, R, 34, shade(b, 0.65), 0.25, 50, 130);
            for (let i = 0; i < 420; i++) { const r = 0.8 + R() * 2; g.fillStyle = R() < 0.5 ? rgba(shade(b, 0.55), 0.55) : rgba(shade(b, 1.4), 0.5); W(R() * TILE, R() * TILE, 4, (px, py) => { g.beginPath(); g.ellipse(px, py, r, r * 0.75, 0, 0, 6.283); g.fill(); }); }
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (let i = 0; i < 12; i++) { let x = R() * TILE, y = R() * TILE; const pts = [[x, y]]; for (let k = 0; k < 5; k++) { x += (R() - 0.5) * 36; y += (R() - 0.4) * 28; pts.push([x, y]); } g.strokeStyle = rgba(shade(b, 0.4), 0.45); g.lineWidth = 1.2; polyline(g, pts, 100); }
            for (let i = 0; i < 40; i++) { g.strokeStyle = rgba('#4d7c0f', 0.5); g.lineWidth = 1; const x = R() * TILE, y = R() * TILE; W(x, y, 8, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px - 2, py - 6); g.moveTo(px, py); g.lineTo(px + 2, py - 7); g.stroke(); }); }
        },
        swamp(g, b, R) {
            blotches(g, R, 30, '#2f7d4f', 0.16, 50, 130); blotches(g, R, 30, shade(b, 0.55), 0.3, 50, 130);
            for (let i = 0; i < 14; i++) { const x = R() * TILE, y = R() * TILE, rx = 20 + R() * 30, ry = 10 + R() * 16; W(x, y, rx, (px, py) => { g.fillStyle = 'rgba(8,38,30,0.5)'; g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, 6.283); g.fill(); g.strokeStyle = 'rgba(120,200,150,0.28)'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(160,230,190,0.12)'; g.beginPath(); g.ellipse(px - rx * 0.2, py - ry * 0.3, rx * 0.5, ry * 0.3, 0, 0, 6.283); g.fill(); }); }
            g.lineCap = 'round'; for (let i = 0; i < 260; i++) { const x = R() * TILE, y = R() * TILE, l = 5 + R() * 8; g.strokeStyle = R() < 0.5 ? 'rgba(150,200,90,0.55)' : 'rgba(30,90,50,0.6)'; g.lineWidth = 1.2; W(x, y, 12, (px, py) => { g.beginPath(); g.moveTo(px, py); g.lineTo(px + (R() - 0.5) * 5, py - l); g.stroke(); }); }
            for (let i = 0; i < 120; i++) { g.fillStyle = 'rgba(190,230,120,0.28)'; W(R() * TILE, R() * TILE, 4, (px, py) => { g.beginPath(); g.arc(px, py, 1 + R() * 1.6, 0, 6.283); g.fill(); }); }
        },
        lava(g, b, R) {
            blotches(g, R, 30, shade(b, 1.5), 0.16, 50, 130); blotches(g, R, 30, '#000000', 0.25, 50, 130);
            for (let i = 0; i < 1800; i++) { g.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.05)'; g.fillRect(R() * TILE, R() * TILE, 1.5, 1.5); }
            g.lineCap = 'round'; g.lineJoin = 'round';
            for (let i = 0; i < 8; i++) {
                let x = R() * TILE, y = R() * TILE, a = R() * 6.283; const pts = [[x, y]]; for (let k = 0; k < 8; k++) { a += (R() - 0.5) * 1.2; x += Math.cos(a) * (14 + R() * 16); y += Math.sin(a) * (14 + R() * 16); pts.push([x, y]); }
                g.strokeStyle = 'rgba(124,45,18,0.55)'; g.lineWidth = 6; polyline(g, pts, 160); g.strokeStyle = '#ea580c'; g.lineWidth = 2.6; polyline(g, pts, 160); g.strokeStyle = '#fde68a'; g.lineWidth = 0.9; polyline(g, pts, 160);
            }
        },
        tech(g, b, R) {
            blotches(g, R, 20, shade(b, 1.5), 0.08, 60, 140); blotches(g, R, 14, '#000000', 0.2, 60, 140);
            for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(56,189,248,' + (0.03 + R() * 0.05) + ')'; g.fillRect((R() * 8 | 0) * 64 + 3, (R() * 8 | 0) * 64 + 3, 58, 58); }
            g.lineWidth = 1; for (let i = 0; i <= 8; i++) { g.strokeStyle = i % 4 === 0 ? 'rgba(56,189,248,0.2)' : 'rgba(56,189,248,0.1)'; g.beginPath(); g.moveTo(i * 64 + 0.5, 0); g.lineTo(i * 64 + 0.5, TILE); g.moveTo(0, i * 64 + 0.5); g.lineTo(TILE, i * 64 + 0.5); g.stroke(); }
            for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) { g.fillStyle = 'rgba(125,211,252,0.45)'; g.beginPath(); g.arc(x * 64, y * 64, 1.8, 0, 6.283); g.fill(); }
            for (let i = 0; i < 700; i++) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(R() * TILE, R() * TILE, 1, 1); }
        }
    };
    function groundTile(kind, base) {
        const key = kind + '|' + base; if (_tiles[key]) return _tiles[key];
        const cv = mkCanvas(TILE, TILE), g = cv.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
        try { GROUND[kind](g, base, rngOf(hash(key))); } catch (e) { }
        return (_tiles[key] = cv);
    }
    function groundPattern(c, kind, base) {
        const tile = groundTile(kind, base); let m = _pats.get(c); if (!m) { m = Object.create(null); _pats.set(c, m); }
        const k = kind + '|' + base; return m[k] || (m[k] = c.createPattern(tile, 'repeat'));
    }
    // Малює землю в прямокутнику (x0,y0)-(x1,y1) (світові координати). gridAlpha: 0 — без сітки.
    function drawGround(c, map, x0, y0, x1, y1, gridAlpha) {
        const th = themeOf(map);
        c.fillStyle = map.bg || '#020617'; c.fillRect(x0, y0, x1 - x0, y1 - y0);
        if (th) { c.fillStyle = groundPattern(c, th.kind, map.bg || '#4c6b3a'); c.fillRect(x0, y0, x1 - x0, y1 - y0); }
        const ga = gridAlpha == null ? (th ? 0 : 1) : gridAlpha;
        if (ga > 0) {
            c.save(); c.globalAlpha = ga; c.strokeStyle = map.grid || '#1e293b'; c.lineWidth = 1; c.beginPath();
            const gx0 = Math.max(0, Math.floor(x0 / 50) * 50), gx1 = Math.min(map.size, Math.ceil(x1 / 50) * 50), gy0 = Math.max(0, Math.floor(y0 / 50) * 50), gy1 = Math.min(map.size, Math.ceil(y1 / 50) * 50);
            for (let x = gx0; x <= gx1; x += 50) { c.moveTo(x, gy0); c.lineTo(x, gy1); }
            for (let y = gy0; y <= gy1; y += 50) { c.moveTo(gx0, y); c.lineTo(gx1, y); }
            c.stroke(); c.restore();
        }
    }
    // Затемнення країв мапи (рамка) — лише біля меж
    function drawEdges(c, map, x0, y0, x1, y1) {
        const S = map.size, E = 160; c.save();
        function band(ax, ay, bx, by, rx, ry, rw, rh) { const g = c.createLinearGradient(ax, ay, bx, by); g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(rx, ry, rw, rh); }
        if (x0 < E) band(0, 0, E, 0, 0, 0, E, S);
        if (x1 > S - E) band(S, 0, S - E, 0, S - E, 0, E, S);
        if (y0 < E) band(0, 0, 0, E, 0, 0, S, E);
        if (y1 > S - E) band(0, S, 0, S - E, 0, S - E, S, E);
        c.restore();
    }

    // ---------- ОБ'ЄМНІ ТІЛА (стіни, фігури) ----------
    function extrude(c, pts, ex, ey, base) {
        const n = pts.length;
        for (let i = 0; i < n; i++) {
            const p = pts[i], q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], nx = dy, ny = -dx; // назовні для обходу за годинниковою
            const dot = nx * ex + ny * ey; if (dot <= 0) continue;
            const l = Math.hypot(nx, ny) || 1, face = Math.abs(ny / l) > Math.abs(nx / l) ? 0.52 : 0.38; // південна грань світліша за східну
            c.fillStyle = shade(base, face);
            c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.lineTo(q[0] + ex, q[1] + ey); c.lineTo(p[0] + ex, p[1] + ey); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(255,255,255,0.10)'; c.lineWidth = 1; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke();
        }
    }
    function polyPts(o) {
        const x = o.x, y = o.y, w = o.w, h = o.h;
        if (o.type === 'shape_triangle') return [[x + w / 2, y], [x + w, y + h], [x, y + h]];
        if (o.type === 'shape_rhombus') return [[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]];
        if (o.type === 'shape_parallelepiped') return [[x + w * 0.2, y], [x + w, y], [x + w * 0.8, y + h], [x, y + h]];
        return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    }
    function drawBlock(c, o, th, opt) {
        const base = o.color || (th && th.wall) || '#475569', pts = polyPts(o), w = o.w, h = o.h;
        const big = (o.type === 'wall_square') && Math.min(w, h) >= 140;
        const d = big ? 16 : Math.max(6, Math.min(15, Math.min(w, h) * 0.32)); let ex = d * 0.55, ey = d, sx = ex * 2.1, sy = ey * 1.7;
        if (o.rot) { const a = -o.rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a); let t = ex * ca - ey * sa; ey = ex * sa + ey * ca; ex = t; t = sx * ca - sy * sa; sy = sx * sa + sy * ca; sx = t; } // світло завжди з північного заходу
        const lowfx = opt && opt.low;
        // тінь на землі
        c.fillStyle = 'rgba(0,0,0,0.26)'; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0] + sx, p[1] + sy) : c.moveTo(p[0] + sx, p[1] + sy)); c.closePath(); c.fill();
        extrude(c, pts, ex, ey, base);
        // верхня грань
        const g = c.createLinearGradient(o.x, o.y, o.x + w, o.y + h); g.addColorStop(0, shade(base, 1.2)); g.addColorStop(1, shade(base, 0.9));
        c.fillStyle = g; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill();
        if (big) {   // дах будівлі: рамка, гребінь, черепиця, люки
            c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 3; c.strokeRect(o.x + 9, o.y + 9, w - 18, h - 18);
            c.strokeStyle = 'rgba(255,255,255,0.14)'; c.lineWidth = 1.5; c.strokeRect(o.x + 12, o.y + 12, w - 24, h - 24);
            if (!(opt && opt.low)) {
                c.strokeStyle = 'rgba(0,0,0,0.10)'; c.lineWidth = 1; c.beginPath();
                if (w >= h) for (let yy = o.y + 26; yy < o.y + h - 14; yy += 16) { c.moveTo(o.x + 14, yy); c.lineTo(o.x + w - 14, yy); } else for (let xx = o.x + 26; xx < o.x + w - 14; xx += 16) { c.moveTo(xx, o.y + 14); c.lineTo(xx, o.y + h - 14); }
                c.stroke();
            }
            c.fillStyle = 'rgba(0,0,0,0.22)'; if (w >= h) c.fillRect(o.x + 14, o.y + h / 2 - 2, w - 28, 4); else c.fillRect(o.x + w / 2 - 2, o.y + 14, 4, h - 28);
            const hh = hash(o.x + ',' + o.y); const vx = o.x + 24 + (hh % Math.max(1, w - 80)), vy = o.y + 24 + ((hh >> 8) % Math.max(1, h - 80));
            c.fillStyle = shade(base, 0.7); c.fillRect(vx, vy, 30, 24); c.fillStyle = shade(base, 1.3); c.fillRect(vx + 3, vy + 3, 24, 4); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(vx + 3, vy + 12, 24, 3); c.fillRect(vx + 3, vy + 18, 24, 3);
        }
        if (o.type === 'wall' || o.type === 'wall_square') {
            const long = Math.max(w, h);
            if (big) { /* шви на даху не потрібні */ } else
            if (!lowfx) {
                // шви каменю/цегли
                c.strokeStyle = 'rgba(0,0,0,0.20)'; c.lineWidth = 1; c.beginPath();
                const seg = long > 160 ? 100 : 50;
                if (w >= h) { for (let sx = seg; sx < w - 8; sx += seg) { c.moveTo(o.x + sx, o.y); c.lineTo(o.x + sx, o.y + h); } if (h >= 90) for (let sy = 50; sy < h - 8; sy += 50) { c.moveTo(o.x, o.y + sy); c.lineTo(o.x + w, o.y + sy); } }
                else { for (let sy = seg; sy < h - 8; sy += seg) { c.moveTo(o.x, o.y + sy); c.lineTo(o.x + w, o.y + sy); } if (w >= 90) for (let sx = 50; sx < w - 8; sx += 50) { c.moveTo(o.x + sx, o.y); c.lineTo(o.x + sx, o.y + h); } }
                c.stroke();
            }
            // фаска: світлий кант зверху-зліва, темний знизу-справа
            c.fillStyle = 'rgba(255,255,255,0.28)'; c.fillRect(o.x, o.y, w, 1.6); c.fillRect(o.x, o.y, 1.6, h);
            c.fillStyle = 'rgba(0,0,0,0.30)'; c.fillRect(o.x, o.y + h - 1.6, w, 1.6); c.fillRect(o.x + w - 1.6, o.y, 1.6, h);
            if (o.neon) { c.strokeStyle = o.neon; c.lineWidth = 2; c.strokeRect(o.x + 1, o.y + 1, w - 2, h - 2); c.fillStyle = o.neon; c.globalAlpha = 0.18; c.fillRect(o.x, o.y, w, h); c.globalAlpha = 1; }
            if (o.stripe) { c.fillStyle = o.stripe; if (w >= h) c.fillRect(o.x, o.y + h / 2 - 8, w, 16); else c.fillRect(o.x + w / 2 - 8, o.y, 16, h); c.fillStyle = 'rgba(0,0,0,0.18)'; if (w >= h) c.fillRect(o.x, o.y + h / 2 + 4, w, 4); else c.fillRect(o.x + w / 2 + 4, o.y, 4, h); }
        } else {
            c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 1.4; c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
        }
    }

    // ---------- ДЕРЕВА (готові спрайти) ----------
    const _trees = Object.create(null);
    function treeSprite(kind, cols, r, variant) {
        const key = kind + '|' + cols[1] + '|' + r + '|' + variant; if (_trees[key]) return _trees[key];
        const pad = 6, S = Math.ceil(r * 2 + pad * 2), cv = mkCanvas(S, S), g = cv.getContext('2d'), cx = S / 2, cy = S / 2, R = rngOf(hash(key));
        const hue = variant === 1 ? 1.12 : variant === 2 ? 0.9 : 1;
        const C = cols.map((c0, i) => i < 3 ? shade(c0, hue) : c0);
        function blob(x, y, rad, col) { g.fillStyle = col; g.beginPath(); g.arc(x, y, rad, 0, 6.283); g.fill(); }
        if (kind === 'pine') {
            const layers = [[1, C[0]], [0.76, C[1]], [0.52, C[2]], [0.28, C[1]]];
            layers.forEach(([k, col], li) => {
                const n = 11 + li, rr = r * k; g.fillStyle = col; g.beginPath();
                for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * 6.283 + li * 0.2, rad = i % 2 ? rr * 0.62 : rr; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
                g.closePath(); g.fill();
                // світла сторона зліва-вгорі
                g.save(); g.clip(); const gr = g.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr); gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.55, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
                // сніг на гілках
                g.fillStyle = C[3]; g.globalAlpha = 0.85; for (let i = 0; i < n; i++) { const a = i / n * 6.283 + li * 0.2 + 0.2, rad = rr * 0.7; g.beginPath(); g.arc(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad - rr * 0.04, Math.max(1.4, rr * 0.07), 0, 6.283); g.fill(); } g.globalAlpha = 1;
            });
            blob(cx - r * 0.06, cy - r * 0.08, Math.max(2, r * 0.1), C[3]);
        } else if (kind === 'palm') {
            const n = 9; for (let i = 0; i < n; i++) {
                const a = i / n * 6.283 + R() * 0.2; g.save(); g.translate(cx, cy); g.rotate(a);
                g.fillStyle = C[1]; g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.5, r * 0.15, 0, 0, 6.283); g.fill();
                g.fillStyle = C[2]; g.beginPath(); g.ellipse(r * 0.55, -r * 0.03, r * 0.42, r * 0.08, 0, 0, 6.283); g.fill();
                g.strokeStyle = C[0]; g.lineWidth = 1; g.beginPath(); g.moveTo(0, 0); g.lineTo(r * 1.0, 0); g.stroke(); g.restore();
            }
            blob(cx, cy, r * 0.16, '#78350f'); blob(cx - 1, cy - 1, r * 0.1, '#a16207'); blob(cx - r * 0.04, cy - r * 0.04, r * 0.04, '#fde68a');
        } else if (kind === 'dead') {
            g.lineCap = 'round'; for (let i = 0; i < 7; i++) {
                const a = i / 7 * 6.283 + R() * 0.4; let x = cx, y = cy; g.strokeStyle = C[i % 2 ? 1 : 2]; g.lineWidth = Math.max(2, r * 0.14);
                const l = r * (0.7 + R() * 0.3); g.beginPath(); g.moveTo(x, y); const mx = cx + Math.cos(a) * l * 0.55, my = cy + Math.sin(a) * l * 0.55; g.lineTo(mx, my); const ex = mx + Math.cos(a + 0.5) * l * 0.45, ey = my + Math.sin(a + 0.5) * l * 0.45; g.lineTo(ex, ey); g.stroke();
                g.lineWidth = Math.max(1, r * 0.06); g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + Math.cos(a - 0.6) * l * 0.35, my + Math.sin(a - 0.6) * l * 0.35); g.stroke();
            }
            blob(cx, cy, r * 0.2, C[0]); blob(cx - r * 0.04, cy - r * 0.04, r * 0.12, C[2]);
        } else { // leaf
            const n = 8 + (r > 50 ? 3 : 0);
            for (let i = 0; i < n; i++) { const a = i / n * 6.283 + R() * 0.3; blob(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.52, C[0]); }
            blob(cx, cy, r * 0.62, C[0]);
            for (let i = 0; i < n; i++) { const a = i / n * 6.283 + 0.35 + R() * 0.3; blob(cx + Math.cos(a) * r * 0.38 - r * 0.04, cy + Math.sin(a) * r * 0.38 - r * 0.05, r * 0.4, C[1]); }
            for (let i = 0; i < 6; i++) { const a = 3.14 + 0.2 + i / 6 * 1.7; blob(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3, r * 0.28, C[2]); }
            blob(cx - r * 0.24, cy - r * 0.27, r * 0.24, shade(C[2], 1.1)); blob(cx - r * 0.3, cy - r * 0.33, r * 0.1, C[3]);
            g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < Math.min(30, r * 0.5 | 0); i++) { const a = R() * 6.283, d = R() * r * 0.8; g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 2, 1.4); }
            g.fillStyle = 'rgba(255,255,255,0.16)'; for (let i = 0; i < Math.min(30, r * 0.5 | 0); i++) { const a = R() * 6.283, d = R() * r * 0.8; g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.6, 1.2); }
            // об'ємність: тінь знизу-справа всередині крони
            g.save(); g.globalCompositeOperation = 'source-atop'; const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r * 1.02); gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)'); g.fillStyle = gr; g.fillRect(0, 0, S, S); g.restore();
        }
        return (_trees[key] = cv);
    }
    function drawTree(c, o, th, opt) {
        const r = o.r || 30, tt = (th && th.tree) || { kind: 'leaf', cols: ['#14532d', '#166534', '#22863a', '#4ade80'] };
        const v = ((o.x * 7 + o.y * 13) | 0) % 3, rs = Math.min(r, 110), sp = treeSprite(tt.kind, tt.cols, Math.max(8, Math.round(rs / 4) * 4), v < 0 ? -v : v), k = r / Math.max(8, Math.round(rs / 4) * 4);
        c.fillStyle = 'rgba(0,0,0,0.26)'; c.beginPath(); c.ellipse(o.x + r * 0.34, o.y + r * 0.46, r * 0.98, r * 0.88, 0, 0, 6.283); c.fill();
        const sz = sp.width * k; c.drawImage(sp, o.x - sz / 2, o.y - sz / 2, sz, sz);
    }

    // ---------- ВОДА і ДОРОГИ ----------
    function drawWater(c, o, th, tm, view, opt) {
        const col = (th && th.water) || ['#0b5f86', '#38a3c8', '#d9f4ff'];
        const curve = o.type === 'water_curve';
        c.beginPath(); if (curve) c.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) / 2); else c.rect(o.x, o.y, o.w, o.h);
        const gr = c.createLinearGradient(o.x, o.y, o.x + o.w * 0.4, o.y + o.h); gr.addColorStop(0, col[1]); gr.addColorStop(0.5, col[0]); gr.addColorStop(1, col[0]);
        c.fillStyle = gr; c.fill(); c.save(); c.clip();
        // темніша глибина всередині (мілина по краях)
        c.strokeStyle = 'rgba(0,0,0,0.0)';
        c.lineWidth = 34; c.strokeStyle = rgba(col[1], 0.45); c.beginPath(); if (curve) c.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) / 2); else c.rect(o.x, o.y, o.w, o.h); c.stroke();
        c.lineWidth = 12; c.strokeStyle = rgba(col[1], 0.55); c.stroke();
        if (!(opt && opt.low)) {
            const y0 = Math.max(o.y, view ? view[2] : o.y), y1 = Math.min(o.y + o.h, view ? view[3] : o.y + o.h), x0 = Math.max(o.x, view ? view[0] : o.x), x1 = Math.min(o.x + o.w, view ? view[1] : o.x + o.w);
            c.lineWidth = 2; c.lineCap = 'round';
            for (let wy = Math.ceil((y0 - o.y) / 38) * 38 + o.y; wy < y1; wy += 38) {
                const ph = tm * 1.4 + wy * 0.05, a = 0.12 + 0.08 * Math.sin(ph); c.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; c.beginPath();
                const sx = Math.floor(x0 / 26) * 26; for (let wx = sx; wx <= x1 + 26; wx += 26) { const yy = wy + Math.sin(wx * 0.045 + tm * 1.6 + wy) * 3.2; wx === sx ? c.moveTo(wx, yy) : c.lineTo(wx, yy); } c.stroke();
            }
            // відблиски
            c.fillStyle = 'rgba(255,255,255,0.22)'; const gx0 = Math.floor(x0 / 90) * 90, gy0 = Math.floor(y0 / 90) * 90;
            for (let gy = gy0; gy < y1; gy += 90) for (let gx = gx0; gx < x1; gx += 90) { const hh = hash(gx + ',' + gy); if (hh % 5) continue; const tw = (Math.sin(tm * 2 + hh) + 1) / 2; c.globalAlpha = tw * 0.9; c.fillRect(gx + (hh % 60), gy + ((hh >> 8) % 60), 6, 1.6); }
            c.globalAlpha = 1;
        }
        c.restore();
        // берегова піна
        c.strokeStyle = rgba(col[2], 0.55); c.lineWidth = 3; c.beginPath(); if (curve) c.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) / 2); else c.rect(o.x, o.y, o.w, o.h); c.stroke();
        c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1; c.beginPath(); if (curve) c.roundRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4, Math.min(o.w, o.h) / 2); else c.rect(o.x - 2, o.y - 2, o.w + 4, o.h + 4); c.stroke();
    }
    function drawLine(c, o) {
        const p = o.points; if (!p || p.length < 2) return;
        const path = () => { c.beginPath(); c.moveTo(p[0].x, p[0].y); for (let i = 1; i < p.length; i++) c.lineTo(p[i].x, p[i].y); };
        c.lineCap = 'round'; c.lineJoin = 'round';
        if (o.width >= 24) { c.strokeStyle = shade(o.color, 0.62); c.lineWidth = o.width + 10; path(); c.stroke(); c.strokeStyle = shade(o.color, 0.82); c.lineWidth = o.width + 4; path(); c.stroke(); }
        c.strokeStyle = o.color; c.lineWidth = o.width; path(); c.stroke();
        if (o.width >= 24) { c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = Math.max(2, o.width * 0.5); path(); c.stroke(); }
        if (o.stripe) { c.strokeStyle = o.stripe; c.lineWidth = Math.max(3, o.width * 0.06); c.setLineDash([o.width * 0.5, o.width * 0.4]); path(); c.stroke(); c.setLineDash([]); }
    }

    // ---------- ТІЛО ПРОПІВ: тінь + бокові грані (дешево, без blur) ----------
    const NOSHADOW = { prop_puddle: 1, prop_crater: 1, prop_hatch: 1, prop_pad: 1, prop_campfire: 1 };
    const BOX = { prop_crate: '#b45309', prop_concrete: '#71717a', prop_cont_red: '#b91c1c', prop_cont_blue: '#1d4ed8', prop_generator: '#4d7c0f', prop_terminal: '#334155', prop_solar: '#1e3a8a', prop_tent: '#6b7280',
        prop_sandbag: '#a68a64', prop_wood_pallet: '#a16207', prop_wood_planks: '#92400e', prop_wood_cart: '#78350f', prop_wood_table: '#92400e', prop_wood_bench: '#78350f', prop_wood_firewood: '#78350f', prop_wood_wall: '#78350f',
        prop_fence_wood: '#92400e', prop_fence_metal: '#64748b', prop_wreck: '#57534e', prop_hay: '#ca8a04', prop_tires: '#27272a', prop_pipe: '#6b7280', prop_spotlight: '#475569' };
    const CYL = { prop_radar: '#334155', prop_barrel: '#991b1b', prop_wood_barrel: '#78350f', prop_well: '#57534e', prop_wood_stump: '#78350f', prop_statue: '#78716c' };
    function propShadow(c, o) {
        const t = o.type || ''; if (NOSHADOW[t] || t.indexOf('prop_door') === 0) return;
        const w = o.w || 50, h = o.h || 50, cx = o.x + w / 2, cy = o.y + h / 2;
        if (CYL[t]) {
            const r = Math.min(w, h) / 2, d = Math.min(10, r * 0.4);
            c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(cx + 8, cy + 10, r, r * 0.92, 0, 0, 6.283); c.fill();
            c.fillStyle = shade(CYL[t], 0.55); c.beginPath(); c.arc(cx + d * 0.5, cy + d, r, 0, 6.283); c.fill();
            c.fillRect(cx - r + d * 0.5, cy, r * 2, d); return;
        }
        if (BOX[t]) {
            const base = BOX[t], d = Math.max(4, Math.min(11, Math.min(w, h) * 0.26)), ex = d * 0.55, ey = d, pts = [[o.x, o.y], [o.x + w, o.y], [o.x + w, o.y + h], [o.x, o.y + h]];
            c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(o.x + ex * 2, o.y + ey * 1.7, w, h);
            extrude(c, pts, ex, ey, base); return;
        }
        if (t === 'prop_bush' || t === 'prop_rock' || t === 'prop_cone' || t === 'prop_crystal') { c.fillStyle = 'rgba(0,0,0,0.24)'; c.beginPath(); c.ellipse(cx + 6, cy + 9, w / 2, h / 2.2, 0, 0, 6.283); c.fill(); return; }
        c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(o.x + 6, o.y + 8, w, h);
    }

    function solidKind(o) {
        const t = o.type;
        if (t === 'wall' || t === 'wall_square' || t === 'shape_triangle' || t === 'shape_rhombus' || t === 'shape_parallelepiped') return 'block';
        if (t === 'tree') return 'tree';
        return null;
    }
    return { THEMES, themeOf, shade, rgba, drawGround, drawEdges, drawBlock, drawTree, drawWater, drawLine, propShadow, solidKind, groundTile, treeSprite };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MapFX;
