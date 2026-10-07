// ===== Зомбі та боси: окрема відрисовка (клієнт) =====
// Усе малюється ОДИН раз у кешовані спрайти (кадри ходьби), а в грі кожен моб — це один drawImage з поворотом.
// Тому сотня мобів на екрані коштує майже як десяток «градієнтних» кіл. На слабких пристроях (GFX низька):
// менший спрайт, 2 кадри замість 4, без аур, без спалахів, смужки здоров'я лише у поранених, мобів поза екраном не малюємо.
(function () {
    const TAU = Math.PI * 2;
    // Візуальний радіус (трохи більший за хітбокс — з руками/рогами). Хітбокс зі спільного Z_TYPES не змінюється.
    const VR = { normal: 17, runner: 14, tanker: 29, spitter: 17, bomber: 20, ghost: 18, pikus: 38, shurik: 31, oneshot: 38, padlo: 30, titan: 46 };
    const BOSS = { pikus: 1, shurik: 1, oneshot: 1, padlo: 1, titan: 1 };
    const AURA = { pikus: '168,85,247', shurik: '244,63,94', oneshot: '251,191,36', padlo: '52,211,153', titan: '56,189,248' };
    const RING_SPD = { shurik: 4.2, padlo: 0.7, titan: -1.1, oneshot: 0.9, pikus: -0.5 };

    // ---------- примітиви ----------
    const P = (c, pts, fill, stroke, lw) => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); } };
    const E = (c, x, y, rx, ry, fill, stroke, lw, rot) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, TAU); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw || 1; c.stroke(); } };
    const C = (c, x, y, r, fill, stroke, lw) => E(c, x, y, r, r, fill, stroke, lw);
    const L = (c, x0, y0, x1, y1, col, w) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke(); };
    const RG = (c, x, y, r0, r1, st) => { const g = c.createRadialGradient(x, y, r0, x, y, r1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const LG = (c, x0, y0, x1, y1, st) => { const g = c.createLinearGradient(x0, y0, x1, y1); st.forEach(s => g.addColorStop(s[0], s[1])); return g; };
    const glow = (c, x, y, r, rgb, a) => C(c, x, y, r, RG(c, x, y, 0, r, [[0, 'rgba(' + rgb + ',' + a + ')'], [1, 'rgba(' + rgb + ',0)']]));
    const shadow = (c, R) => E(c, 1, R * 0.12, R * 1.0, R * 0.95, 'rgba(0,0,0,.26)');

    // ---------- звичайні зомбі (вигляд зверху, дивляться вправо, +x) ----------
    const ART = {
        normal(c, R, f, N) {
            const s = Math.sin(f / N * TAU); shadow(c, R);
            [1, -1].forEach(side => {
                const sv = s * side, hx = R * (1.02 + 0.28 * sv);
                L(c, R * 0.05, side * R * 0.6, R * (0.55 + 0.2 * sv), side * R * 0.62, '#7c3f1d', R * 0.34);
                L(c, R * (0.55 + 0.2 * sv), side * R * 0.62, hx, side * R * 0.5, '#4ade80', R * 0.26);
                C(c, hx + R * 0.05, side * R * 0.48, R * 0.17, '#22c55e', '#14532d', 1);
                L(c, hx + R * 0.1, side * R * 0.48, hx + R * 0.26, side * R * 0.42, '#bbf7d0', R * 0.05);
            });
            E(c, -R * 0.05, 0, R * 0.6, R * 0.92, LG(c, 0, -R, 0, R, [[0, '#92400e'], [1, '#451a03']]), '#2b1204', 1.2, 0);
            E(c, -R * 0.2, R * 0.3, R * 0.2, R * 0.13, 'rgba(127,29,29,.75)'); E(c, R * 0.1, -R * 0.42, R * 0.13, R * 0.2, 'rgba(127,29,29,.7)');
            L(c, -R * 0.4, -R * 0.1, -R * 0.1, R * 0.1, '#2b1204', 1.3); L(c, -R * 0.45, R * 0.55, -R * 0.2, R * 0.7, '#2b1204', 1.3);
            C(c, R * 0.18, 0, R * 0.47, RG(c, R * 0.1, -R * 0.1, 1, R * 0.5, [[0, '#bbf7d0'], [0.6, '#4ade80'], [1, '#166534']]), '#14532d', 1.2);
            E(c, -R * 0.02, -R * 0.2, R * 0.2, R * 0.12, '#1c1917'); E(c, R * 0.0, R * 0.25, R * 0.14, R * 0.1, '#292524');
            C(c, R * 0.5, -R * 0.2, R * 0.13, 'rgba(253,224,71,.55)'); C(c, R * 0.5, R * 0.2, R * 0.13, 'rgba(253,224,71,.55)');
            C(c, R * 0.52, -R * 0.2, R * 0.075, '#fde047'); C(c, R * 0.52, R * 0.2, R * 0.075, '#fde047');
            E(c, R * 0.6, 0, R * 0.1, R * 0.17, '#450a0a'); L(c, R * 0.56, -R * 0.08, R * 0.56, R * 0.08, '#f1f5f9', 1.1);
        },
        runner(c, R, f, N) {
            const s = Math.sin(f / N * TAU); shadow(c, R);
            L(c, -R * 1.0, -R * 0.15, -R * 1.5, 0, 'rgba(190,242,100,.0)', 1);
            for (let i = 0; i < 3; i++) L(c, -R * (0.9 + i * 0.2), (i - 1) * R * 0.45, -R * (1.35 + i * 0.12), (i - 1) * R * 0.45, 'rgba(217,249,157,' + (0.35 - i * 0.08) + ')', 1.4);
            [1, -1].forEach(side => {
                const sv = s * side, hx = R * (0.85 + 0.55 * sv);
                L(c, R * 0.1, side * R * 0.5, R * (0.4 + 0.3 * sv), side * R * 0.55, '#f97316', R * 0.26);
                L(c, R * (0.4 + 0.3 * sv), side * R * 0.55, hx, side * R * 0.45, '#a3e635', R * 0.2);
                C(c, hx + R * 0.04, side * R * 0.44, R * 0.13, '#84cc16', '#3f6212', 1);
            });
            E(c, -R * 0.05, 0, R * 0.5, R * 0.72, LG(c, 0, -R, 0, R, [[0, '#ea580c'], [1, '#7c2d12']]), '#431407', 1.1);
            L(c, -R * 0.3, -R * 0.4, R * 0.1, -R * 0.1, '#fed7aa', 1.2);
            C(c, R * 0.3, 0, R * 0.42, RG(c, R * 0.25, -R * 0.1, 1, R * 0.45, [[0, '#ecfccb'], [0.6, '#a3e635'], [1, '#3f6212']]), '#365314', 1.1);
            L(c, R * 0.0, -R * 0.38, R * 0.0, R * 0.38, '#dc2626', R * 0.12);
            C(c, R * 0.6, -R * 0.17, R * 0.1, '#fef08a'); C(c, R * 0.6, R * 0.17, R * 0.1, '#fef08a'); C(c, R * 0.63, -R * 0.17, R * 0.05, '#7f1d1d'); C(c, R * 0.63, R * 0.17, R * 0.05, '#7f1d1d');
            E(c, R * 0.68, 0, R * 0.07, R * 0.15, '#450a0a');
        },
        tanker(c, R, f, N) {
            const s = Math.sin(f / N * TAU) * 0.6; shadow(c, R);
            [1, -1].forEach(side => {
                const sv = s * side, hx = R * (0.98 + 0.12 * sv);
                L(c, R * 0.0, side * R * 0.72, R * (0.55 + 0.1 * sv), side * R * 0.68, '#14532d', R * 0.5);
                L(c, R * (0.55 + 0.1 * sv), side * R * 0.68, hx, side * R * 0.56, '#16a34a', R * 0.42);
                C(c, hx + R * 0.05, side * R * 0.54, R * 0.26, RG(c, hx, side * R * 0.5, 1, R * 0.3, [[0, '#4ade80'], [1, '#14532d']]), '#052e16', 1.4);
                for (let k = -1; k <= 1; k++) L(c, hx + R * 0.15, side * R * (0.54 + k * 0.1), hx + R * 0.34, side * R * (0.54 + k * 0.14), '#fef9c3', 1.4);
            });
            E(c, -R * 0.1, 0, R * 0.7, R * 0.96, RG(c, -R * 0.2, -R * 0.2, 2, R, [[0, '#22c55e'], [1, '#052e16']]), '#052e16', 1.5);
            [1, -1].forEach(side => {
                P(c, [[-R * 0.38, side * R * 0.55], [R * 0.3, side * R * 0.52], [R * 0.4, side * R * 0.98], [-R * 0.3, side * R * 1.0]], LG(c, 0, 0, 0, side * R, [[0, '#94a3b8'], [1, '#334155']]), '#0f172a', 1.4);
                C(c, R * 0.12, side * R * 0.78, R * 0.05, '#e2e8f0'); C(c, -R * 0.18, side * R * 0.84, R * 0.05, '#e2e8f0');
                P(c, [[R * 0.1, side * R * 0.96], [R * 0.25, side * R * 1.2], [R * 0.32, side * R * 0.94]], '#cbd5e1', '#0f172a', 1);
                L(c, -R * 0.28, side * R * 0.74, R * 0.2, side * R * 0.9, 'rgba(120,53,15,.6)', 2);
            });
            L(c, -R * 0.55, -R * 0.35, -R * 0.55, R * 0.35, '#475569', R * 0.2); P(c, [[-R * 0.62, -R * 0.12], [-R * 0.95, 0], [-R * 0.62, R * 0.12]], '#cbd5e1', '#0f172a', 1);
            C(c, R * 0.22, 0, R * 0.34, RG(c, R * 0.15, -R * 0.1, 1, R * 0.4, [[0, '#86efac'], [1, '#14532d']]), '#052e16', 1.4);
            P(c, [[R * 0.0, -R * 0.3], [R * 0.4, -R * 0.2], [R * 0.4, -R * 0.08], [R * 0.0, -R * 0.14]], '#64748b', '#0f172a', 1); P(c, [[R * 0.0, R * 0.3], [R * 0.4, R * 0.2], [R * 0.4, R * 0.08], [R * 0.0, R * 0.14]], '#64748b', '#0f172a', 1);
            C(c, R * 0.36, -R * 0.1, R * 0.07, '#ef4444'); C(c, R * 0.36, R * 0.1, R * 0.07, '#ef4444');
        },
        spitter(c, R, f, N) {
            const ph = f / N * TAU, p = 0.5 + 0.5 * Math.sin(ph); shadow(c, R);
            [1, -1].forEach(side => { L(c, R * 0.0, side * R * 0.62, R * 0.45, side * R * 0.5, '#65a30d', R * 0.24); C(c, R * 0.52, side * R * 0.46, R * 0.14, '#a3e635', '#365314', 1); });
            E(c, -R * 0.1, 0, R * 0.62, R * 0.88, RG(c, -R * 0.2, -R * 0.2, 2, R, [[0, '#d9f99d'], [1, '#3f6212']]), '#1a2e05', 1.2);
            for (let i = 0; i < 4; i++) { const a = 2.2 + i * 0.65; C(c, Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.6, R * (0.1 + (i % 2) * 0.05), 'rgba(190,242,100,.85)', '#4d7c0f', 1); }
            C(c, R * 0.16, 0, R * 0.44, RG(c, R * 0.1, -R * 0.1, 1, R * 0.5, [[0, '#ecfccb'], [0.6, '#a3e635'], [1, '#4d7c0f']]), '#1a2e05', 1.1);
            glow(c, R * 0.5, 0, R * (0.6 + 0.12 * p), '190,242,100', 0.55 + 0.25 * p);
            E(c, R * 0.52, 0, R * (0.22 + 0.05 * p), R * (0.3 + 0.06 * p), RG(c, R * 0.5, 0, 1, R * 0.35, [[0, '#f7fee7'], [0.5, '#bef264'], [1, '#65a30d']]), '#365314', 1);
            E(c, R * 0.72, 0, R * 0.13, R * 0.2, '#1a2e05'); C(c, R * 0.78, -R * 0.04, R * 0.05, '#d9f99d'); C(c, R * 0.84, R * 0.12 + p * 2, R * 0.05, '#bef264');
            C(c, R * 0.34, -R * 0.2, R * 0.08, '#fef08a'); C(c, R * 0.34, R * 0.2, R * 0.08, '#fef08a'); C(c, R * 0.36, -R * 0.2, R * 0.04, '#365314'); C(c, R * 0.36, R * 0.2, R * 0.04, '#365314');
        },
        bomber(c, R, f, N) {
            const ph = f / N * TAU, s = Math.sin(ph), blink = f % 2 === 0; shadow(c, R);
            [1, -1].forEach(side => { const sv = s * side; L(c, R * 0.05, side * R * 0.6, R * (0.6 + 0.2 * sv), side * R * 0.5, '#b91c1c', R * 0.3); C(c, R * (0.7 + 0.2 * sv), side * R * 0.48, R * 0.16, '#fca5a5', '#7f1d1d', 1); });
            E(c, -R * 0.05, 0, R * 0.66, R * 0.9, LG(c, 0, -R, 0, R, [[0, '#ef4444'], [1, '#7f1d1d']]), '#450a0a', 1.2);
            [-0.5, 0, 0.5].forEach(k => { const y = k * R * 0.72; E(c, R * 0.02, y, R * 0.34, R * 0.14, LG(c, 0, y - 3, 0, y + 3, [[0, '#fcd34d'], [1, '#b45309']]), '#451a03', 1); L(c, -R * 0.08, y - R * 0.13, -R * 0.08, y + R * 0.13, '#1c1917', 1.8); L(c, R * 0.14, y - R * 0.13, R * 0.14, y + R * 0.13, '#1c1917', 1.8); });
            L(c, -R * 0.45, -R * 0.75, -R * 0.45, R * 0.75, '#1c1917', 2);
            C(c, R * 0.2, 0, R * 0.42, RG(c, R * 0.15, -R * 0.1, 1, R * 0.45, [[0, '#fecaca'], [0.6, '#f87171'], [1, '#991b1b']]), '#450a0a', 1.1);
            C(c, R * 0.38, -R * 0.17, R * 0.12, '#fff'); C(c, R * 0.38, R * 0.17, R * 0.12, '#fff'); C(c, R * 0.42, -R * 0.17, R * 0.055, '#111'); C(c, R * 0.42, R * 0.17, R * 0.055, '#111');
            E(c, R * 0.56, 0, R * 0.08, R * 0.16, '#450a0a');
            L(c, -R * 0.1, 0, -R * 0.34, -R * 0.4, '#a8a29e', 1.3);
            glow(c, -R * 0.36, -R * 0.42, R * (blink ? 0.5 : 0.3), '251,146,60', blink ? 0.9 : 0.5); C(c, -R * 0.36, -R * 0.42, R * (blink ? 0.14 : 0.09), blink ? '#fff7ed' : '#fdba74');
        },
        ghost(c, R, f, N) {
            const ph = f / N * TAU, w = Math.sin(ph);
            glow(c, 0, 0, R * 1.3, '203,213,225', 0.25);
            const tail = [[R * 0.2, -R * 0.62]]; for (let i = 0; i <= 5; i++) tail.push([-R * (0.3 + i * 0.22), Math.sin(ph + i * 0.9) * R * (0.12 + i * 0.05)]);
            tail.push([R * 0.2, R * 0.62]);
            c.beginPath(); c.moveTo(R * 0.2, -R * 0.62); for (let i = 1; i < tail.length - 1; i++) c.lineTo(tail[i][0], tail[i][1] - R * (0.55 - i * 0.09)); for (let i = tail.length - 2; i >= 1; i--) c.lineTo(tail[i][0], tail[i][1] + R * (0.55 - i * 0.09)); c.lineTo(R * 0.2, R * 0.62); c.closePath();
            c.fillStyle = LG(c, R * 0.3, 0, -R * 1.5, 0, [[0, 'rgba(241,245,249,.95)'], [1, 'rgba(148,163,184,0)']]); c.fill();
            C(c, R * 0.2, 0, R * 0.62, RG(c, R * 0.1, -R * 0.1, 1, R * 0.7, [[0, 'rgba(255,255,255,.98)'], [1, 'rgba(148,163,184,.9)']]), 'rgba(226,232,240,.8)', 1);
            [1, -1].forEach(side => { P(c, [[R * 0.1, side * R * 0.55], [R * (0.8 + 0.1 * w * side), side * R * (0.85 + 0.08 * w)], [R * 0.35, side * R * 0.35]], 'rgba(226,232,240,.6)'); });
            E(c, R * 0.42, -R * 0.2, R * 0.12, R * 0.17, '#0f172a'); E(c, R * 0.42, R * 0.2, R * 0.12, R * 0.17, '#0f172a');
            C(c, R * 0.45, -R * 0.2, R * 0.05, '#67e8f9'); C(c, R * 0.45, R * 0.2, R * 0.05, '#67e8f9'); glow(c, R * 0.45, -R * 0.2, R * 0.2, '103,232,249', .6); glow(c, R * 0.45, R * 0.2, R * 0.2, '103,232,249', .6);
            E(c, R * 0.62, 0, R * (0.08 + 0.03 * w), R * 0.14, '#0f172a');
        },

        // ---------- БОСИ ----------
        pikus(c, R, f, N) {
            const ph = f / N * TAU, s = Math.sin(ph), p = 0.5 + 0.5 * s; shadow(c, R);
            for (let i = 0; i < 6; i++) { const a = Math.PI * (0.58 + 0.84 * i / 5), x0 = Math.cos(a) * R * 0.8, y0 = Math.sin(a) * R * 0.85; P(c, [[x0 - 4, y0 - 4 * Math.sign(y0)], [Math.cos(a) * R * 1.28, Math.sin(a) * R * 1.3], [x0 + 5, y0 + 2]], LG(c, x0, y0, Math.cos(a) * R * 1.3, Math.sin(a) * R * 1.3, [[0, '#581c87'], [1, '#e9d5ff']]), '#2e1065', 1.3); }
            [1, -1].forEach(side => { const sv = s * side, fx = R * (0.62 + 0.14 * sv); L(c, 0, side * R * 0.7, fx, side * R * 0.86, '#581c87', R * 0.4); C(c, fx + R * 0.1, side * R * 0.9, R * 0.3, RG(c, fx, side * R * 0.85, 1, R * 0.35, [[0, '#c084fc'], [1, '#3b0764']]), '#2e1065', 1.6); for (let k = -1; k <= 1; k++) P(c, [[fx + R * 0.25, side * R * (0.9 + k * 0.14) - 2], [fx + R * 0.5, side * R * (0.9 + k * 0.16)], [fx + R * 0.25, side * R * (0.9 + k * 0.14) + 2]], '#fef9c3', '#3b0764', 0.8); });
            E(c, -R * 0.05, 0, R * 0.92, R * 0.98, RG(c, -R * 0.2, -R * 0.25, R * 0.1, R * 1.1, [[0, '#a855f7'], [0.55, '#6b21a8'], [1, '#1e0a3c']]), '#2e1065', 2);
            for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-R * 0.1, 0, R * (0.5 + i * 0.16), -1.1, 1.1); c.strokeStyle = 'rgba(233,213,255,.28)'; c.lineWidth = 1.4; c.stroke(); }
            [-0.4, 0, 0.4].forEach(y => { glow(c, R * 0.12, y * R, R * (0.26 + 0.1 * p), '251,146,60', 0.7); C(c, R * 0.12, y * R, R * 0.09, '#fff7ed'); });
            [1, -1].forEach(side => P(c, [[R * 0.42, side * R * 0.34], [R * 0.9, side * R * 0.5], [R * 1.28, side * R * 1.0], [R * 0.95, side * R * 0.38], [R * 0.58, side * R * 0.2]], LG(c, R * 0.4, 0, R * 1.2, side * R, [[0, '#f5f3ff'], [1, '#a78bfa']]), '#3b0764', 1.4));
            C(c, R * 0.56, 0, R * 0.46, RG(c, R * 0.45, -R * 0.12, 1, R * 0.5, [[0, '#c084fc'], [0.6, '#7e22ce'], [1, '#2e1065']]), '#2e1065', 1.6);
            [1, -1].forEach(side => { glow(c, R * 0.74, side * R * 0.2, R * 0.28, '253,224,71', 0.75); P(c, [[R * 0.62, side * R * 0.1], [R * 0.9, side * R * 0.24], [R * 0.64, side * R * 0.3]], '#fde047', '#713f12', 0.8); });
            c.beginPath(); c.moveTo(R * 0.92, -R * 0.3); for (let i = 0; i <= 6; i++) c.lineTo(R * (i % 2 ? 0.98 : 0.86), -R * 0.3 + i * R * 0.1); c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.stroke();
        },
        shurik(c, R, f, N) {
            const ph = f / N * TAU, p = 0.5 + 0.5 * Math.sin(ph); shadow(c, R);
            C(c, 0, 0, R * 0.68, RG(c, -R * 0.15, -R * 0.15, 1, R * 0.75, [[0, '#fb7185'], [0.5, '#9f1239'], [1, '#4c0519']]), '#fda4af', 2.2);
            for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P(c, [[Math.cos(a - 0.2) * R * 0.62, Math.sin(a - 0.2) * R * 0.62], [Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86], [Math.cos(a + 0.2) * R * 0.62, Math.sin(a + 0.2) * R * 0.62]], '#e2e8f0', '#334155', 1); }
            C(c, 0, 0, R * 0.44, '#1c0a10', '#fda4af', 1.4); glow(c, R * 0.06, 0, R * (0.55 + 0.1 * p), '244,63,94', 0.6);
            E(c, 0, 0, R * 0.34, R * 0.3, RG(c, 0, 0, 1, R * 0.35, [[0, '#fff'], [1, '#fecdd3']]), '#4c0519', 1.2);
            C(c, R * 0.12, 0, R * 0.19, RG(c, R * 0.12, 0, 1, R * 0.2, [[0, '#f43f5e'], [1, '#881337']])); C(c, R * 0.16, 0, R * 0.09, '#000'); C(c, R * 0.1, -R * 0.06, R * 0.04, '#fff');
        },
        oneshot(c, R, f, N) {
            const ph = f / N * TAU, s = Math.sin(ph), p = 0.5 + 0.5 * s; shadow(c, R);
            [1, -1].forEach(side => { const bx = R * 0.3, by = side * R * 0.34; P(c, [[bx, by - R * 0.12], [R * 1.4, by - R * 0.09], [R * 1.4, by + R * 0.09], [bx, by + R * 0.12]], LG(c, 0, by - R * 0.12, 0, by + R * 0.12, [[0, '#64748b'], [0.5, '#e2e8f0'], [1, '#1e293b']]), '#0f172a', 1.2); [0.6, 0.95, 1.25].forEach(x => L(c, R * x, by - R * 0.12, R * x, by + R * 0.12, '#fbbf24', 2.2)); P(c, [[R * 1.4, by - R * 0.15], [R * 1.52, by - R * 0.12], [R * 1.52, by + R * 0.12], [R * 1.4, by + R * 0.15]], '#334155', '#0f172a', 1); glow(c, R * 1.55, by, R * (0.22 + 0.1 * p), '253,224,71', 0.85); C(c, R * 1.53, by, R * 0.06, '#fff'); });
            P(c, [[-R * 0.9, -R * 0.35], [-R * 0.5, -R * 0.95], [R * 0.4, -R * 1.0], [R * 0.85, -R * 0.4], [R * 0.85, R * 0.4], [R * 0.4, R * 1.0], [-R * 0.5, R * 0.95], [-R * 0.9, R * 0.35]], LG(c, -R, -R, R, R, [[0, '#fde68a'], [0.5, '#d97706'], [1, '#78350f']]), '#451a03', 2.2);
            P(c, [[-R * 0.5, -R * 0.5], [R * 0.3, -R * 0.55], [R * 0.5, -R * 0.2], [R * 0.5, R * 0.2], [R * 0.3, R * 0.55], [-R * 0.5, R * 0.5]], 'rgba(120,53,15,.35)', 'rgba(254,243,199,.5)', 1.2);
            [1, -1].forEach(side => { P(c, [[-R * 0.1, side * R * 0.72], [R * 0.5, side * R * 0.7], [R * 0.55, side * R * 1.05], [-R * 0.05, side * R * 1.1]], LG(c, 0, 0, 0, side * R * 1.1, [[0, '#fcd34d'], [1, '#92400e']]), '#451a03', 1.6); C(c, R * 0.25, side * R * 0.9, R * 0.07, '#fef3c7'); });
            C(c, -R * 0.35, 0, R * 0.22, RG(c, -R * 0.35, 0, 1, R * 0.25, [[0, '#fff7ed'], [1, '#f59e0b']]), '#78350f', 1.2); glow(c, -R * 0.35, 0, R * 0.4, '253,224,71', 0.35 + 0.25 * p);
            C(c, R * 0.12, 0, R * 0.34, RG(c, R * 0.05, -R * 0.1, 1, R * 0.4, [[0, '#fef3c7'], [0.6, '#f59e0b'], [1, '#78350f']]), '#451a03', 1.6);
            P(c, [[R * 0.24, -R * 0.2], [R * 0.44, -R * 0.12], [R * 0.44, R * 0.12], [R * 0.24, R * 0.2]], '#1c0a0a', '#451a03', 1); glow(c, R * 0.36, 0, R * 0.26, '239,68,68', 0.8); L(c, R * 0.3, 0, R * 0.42, 0, '#fecaca', 2.2);
        },
        padlo(c, R, f, N) {
            const ph = f / N * TAU, s = Math.sin(ph), p = 0.5 + 0.5 * s; shadow(c, R);
            for (let i = 0; i < 11; i++) { const a = i / 11 * TAU, r = R * (0.78 + 0.1 * Math.sin(i * 2.3 + ph)); C(c, Math.cos(a) * r, Math.sin(a) * r, R * (0.24 + 0.05 * (i % 3)), RG(c, Math.cos(a) * r - 2, Math.sin(a) * r - 2, 1, R * 0.3, [[0, '#6ee7b7'], [1, '#047857']]), '#064e3b', 1.2); }
            C(c, 0, 0, R * 0.82, RG(c, -R * 0.2, -R * 0.25, R * 0.1, R * 0.9, [[0, '#6ee7b7'], [0.55, '#10b981'], [1, '#064e3b']]), '#064e3b', 2);
            for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.4; C(c, Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.1, 'rgba(236,252,203,.55)', 'rgba(5,46,22,.6)', 1); }
            [1, -1].forEach(side => { C(c, R * 0.34, side * R * 0.3, R * 0.2, '#ecfccb', '#064e3b', 1.3); C(c, R * 0.4, side * R * 0.3, R * 0.1, '#1a2e05'); C(c, R * 0.43, side * R * 0.27, R * 0.04, '#fff'); });
            E(c, R * 0.62, 0, R * 0.18, R * 0.34, '#022c22', '#064e3b', 1.2); for (let k = -1; k <= 1; k++) P(c, [[R * 0.55, k * R * 0.2 - 2], [R * 0.72, k * R * 0.2], [R * 0.55, k * R * 0.2 + 2]], '#f7fee7');
            C(c, R * 0.78, R * 0.1 + p * 3, R * 0.06, '#bef264'); C(c, R * 0.8, -R * 0.14 + p * 2, R * 0.045, '#d9f99d');
        },
        titan(c, R, f, N) {
            const ph = f / N * TAU, s = Math.sin(ph), p = 0.5 + 0.5 * s; shadow(c, R);
            [1, -1].forEach(side => { const sv = s * side * 0.5, fx = R * (0.6 + 0.1 * sv); L(c, 0, side * R * 0.75, fx, side * R * 0.9, '#0369a1', R * 0.46); P(c, [[fx - R * 0.2, side * R * 0.78], [fx + R * 0.15, side * R * 0.66], [fx + R * 0.55, side * R * 0.86], [fx + R * 0.45, side * R * 1.14], [fx - R * 0.05, side * R * 1.16]], LG(c, fx, side * R * 0.7, fx + R * 0.4, side * R * 1.1, [[0, '#e0f2fe'], [0.5, '#38bdf8'], [1, '#075985']]), '#082f49', 1.8); L(c, fx, side * R * 0.9, fx + R * 0.42, side * R * 0.9, 'rgba(255,255,255,.5)', 1.2); });
            const pts = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; const r = R * (i % 2 ? 0.88 : 1.06); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
            P(c, pts, RG(c, -R * 0.2, -R * 0.25, R * 0.1, R * 1.1, [[0, '#e0f2fe'], [0.45, '#38bdf8'], [1, '#0c4a6e']]), '#082f49', 2.4);
            pts.forEach((q, i) => { if (i % 2 === 0) L(c, 0, 0, q[0], q[1], 'rgba(255,255,255,.32)', 1.2); });
            for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.26; P(c, [[Math.cos(a - 0.14) * R * 0.5, Math.sin(a - 0.14) * R * 0.5], [Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78], [Math.cos(a + 0.14) * R * 0.5, Math.sin(a + 0.14) * R * 0.5]], 'rgba(224,242,254,.4)', 'rgba(8,47,73,.5)', 1); }
            glow(c, -R * 0.1, 0, R * (0.7 + 0.15 * p), '125,211,252', 0.7); C(c, -R * 0.1, 0, R * 0.22, RG(c, -R * 0.1, 0, 1, R * 0.24, [[0, '#fff'], [0.5, '#7dd3fc'], [1, '#0284c7']]), '#e0f2fe', 1.4);
            [1, -1].forEach(side => { P(c, [[R * 0.3, side * R * 0.5], [R * 0.45, side * R * 1.0], [R * 0.2, side * R * 0.85]], 'rgba(224,242,254,.85)', '#082f49', 1.2); });
            C(c, R * 0.5, 0, R * 0.34, RG(c, R * 0.42, -R * 0.1, 1, R * 0.4, [[0, '#e0f2fe'], [0.6, '#38bdf8'], [1, '#075985']]), '#082f49', 1.8);
            [1, -1].forEach(side => { P(c, [[R * 0.5, side * R * 0.08], [R * 0.78, side * R * 0.2], [R * 0.52, side * R * 0.26]], '#fff', '#0ea5e9', 1); glow(c, R * 0.66, side * R * 0.18, R * 0.2, '125,211,252', 0.8); });
        }
    };

    // ---------- кільця, що обертаються (окремі спрайти) та аури ----------
    const RING = {
        shurik(c, R) { for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; c.save(); c.rotate(a); c.beginPath(); c.moveTo(R * 0.5, -R * 0.06); c.quadraticCurveTo(R * 0.95, -R * 0.38, R * 1.28, 0); c.quadraticCurveTo(R * 0.92, -R * 0.1, R * 0.76, R * 0.16); c.lineTo(R * 0.5, R * 0.1); c.closePath(); c.fillStyle = LG(c, R * 0.5, 0, R * 1.28, 0, [[0, '#475569'], [0.6, '#e2e8f0'], [1, '#f43f5e']]); c.fill(); c.strokeStyle = '#4c0519'; c.lineWidth = 1.2; c.stroke(); c.restore(); } },
        padlo(c, R) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + 0.2; const x = Math.cos(a) * R * 1.1, y = Math.sin(a) * R * 1.1; glow(c, x, y, R * 0.28, '190,242,100', 0.5); C(c, x, y, R * 0.13, RG(c, x, y, 0, R * 0.14, [[0, '#f7fee7'], [1, '#65a30d']]), '#365314', 1); } },
        titan(c, R) { c.beginPath(); c.arc(0, 0, R * 1.2, 0, TAU); c.strokeStyle = 'rgba(186,230,253,.25)'; c.lineWidth = 1.5; c.setLineDash([6, 6]); c.stroke(); c.setLineDash([]); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; c.save(); c.translate(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2); c.rotate(a + 1.57); P(c, [[0, -R * 0.2], [R * 0.09, 0], [0, R * 0.16], [-R * 0.09, 0]], LG(c, 0, -R * 0.2, 0, R * 0.16, [[0, '#f0f9ff'], [1, '#0284c7']]), '#082f49', 1.2); c.restore(); } },
        oneshot(c, R) { c.beginPath(); c.arc(0, 0, R * 1.2, 0, TAU); c.strokeStyle = 'rgba(251,191,36,.45)'; c.lineWidth = 2; c.setLineDash([10, 7]); c.stroke(); c.setLineDash([]); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P(c, [[Math.cos(a) * R * 1.12, Math.sin(a) * R * 1.12], [Math.cos(a + 0.05) * R * 1.3, Math.sin(a + 0.05) * R * 1.3], [Math.cos(a - 0.05) * R * 1.3, Math.sin(a - 0.05) * R * 1.3]], '#fde68a', '#78350f', 1); } },
        pikus(c, R) { c.beginPath(); c.arc(0, 0, R * 1.18, 0, TAU); c.strokeStyle = 'rgba(192,132,252,.4)'; c.lineWidth = 1.8; c.setLineDash([3, 8]); c.stroke(); c.setLineDash([]); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; C(c, Math.cos(a) * R * 1.18, Math.sin(a) * R * 1.18, R * 0.07, '#e9d5ff'); glow(c, Math.cos(a) * R * 1.18, Math.sin(a) * R * 1.18, R * 0.2, '192,132,252', 0.6); } }
    };

    // ---------- кеш спрайтів ----------
    let cache = {}, qKey = '';
    const G = () => window.GFX || { tier: 'high', fx: 1, shadow: true };
    function cfg() { const t = G().tier; return t === 'low' ? { Q: 1, N: 2, A: 8 } : t === 'medium' ? { Q: 1.15, N: 4, A: 12 } : { Q: 1.5, N: 4, A: 16 }; }
    function mk(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
    function sprite(type, f, K, ai) {
        const key = type + '|' + f + '|' + (ai || 0); let s = cache[key]; if (s) return s;
        const R = VR[type], side = Math.ceil(R * (BOSS[type] ? 3.1 : 2.75) * K.Q), cv = mk(side, side), c = cv.getContext('2d');
        c.translate(side / 2, side / 2); c.scale(K.Q, K.Q); if (ai) c.rotate(ai / K.A * TAU); c.lineJoin = 'round'; c.lineCap = 'round'; ART[type](c, R, f, K.N);
        return (cache[key] = { cv, w: side / K.Q, h: side / K.Q });
    }
    function ringSprite(type, K) {
        const key = type + '|ring'; let s = cache[key]; if (s) return s; const R = VR[type], side = Math.ceil(R * 3.2 * K.Q), cv = mk(side, side), c = cv.getContext('2d');
        c.translate(side / 2, side / 2); c.scale(K.Q, K.Q); c.lineJoin = 'round'; RING[type](c, R); return (cache[key] = { cv, w: side / K.Q, h: side / K.Q });
    }
    function auraSprite(type) {
        const key = type + '|aura'; let s = cache[key]; if (s) return s; const R = VR[type] * 1.9, cv = mk(Math.ceil(R * 2), Math.ceil(R * 2)), c = cv.getContext('2d');
        const g = c.createRadialGradient(R, R, R * 0.2, R, R, R); g.addColorStop(0, 'rgba(' + AURA[type] + ',.55)'); g.addColorStop(0.5, 'rgba(' + AURA[type] + ',.18)'); g.addColorStop(1, 'rgba(' + AURA[type] + ',0)'); c.fillStyle = g; c.fillRect(0, 0, R * 2, R * 2);
        return (cache[key] = { cv, w: R * 2, h: R * 2 });
    }

    function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

    // ---------- малювання ----------
    function drawOne(ctx, z, id, t, K, g, view) {
        const type = ART[z.type] ? z.type : null, hb = (window.zType ? window.zType(z.type) : null) || { radius: 15, color: '#22c55e' };
        const R = type ? VR[type] : hb.radius + 2, boss = !!BOSS[type];
        if (z.x < view.x0 - R * 1.6 || z.x > view.x1 + R * 1.6 || z.y < view.y0 - R * 1.6 || z.y > view.y1 + R * 1.6) return;
        // напрям і темп ходьби — за фактичним переміщенням
        if (z._lx === undefined) { z._lx = z.x; z._ly = z.y; z.ang = 0; z._ph = hash(id) % 7; z._born = t; z._hp = z.hp; }
        const dx = z.x - z._lx, dy = z.y - z._ly, d = Math.hypot(dx, dy);
        if (d > 0.25) { let da = Math.atan2(dy, dx) - z.ang; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU; z.ang += da * (boss ? 0.12 : 0.3); z._ph += d / (R * (boss ? 1.1 : 0.7)); z._lx = z.x; z._ly = z.y; }
        if (z.hp < z._hp) z._flash = t + 110; z._hp = z.hp;
        const ts = t / 1000;
        if (!type) { ctx.fillStyle = hb.color; ctx.beginPath(); ctx.arc(z.x, z.y, hb.radius, 0, TAU); ctx.fill(); return; }
        const f = Math.floor(z._ph) % K.N;
        const born = Math.min(1, (t - z._born) / 280), sc = 0.55 + 0.45 * (1 - Math.pow(1 - born, 3));
        const B = view.m, tf = (th, k) => { const co = Math.cos(th) * k, si = Math.sin(th) * k; ctx.setTransform(B.a * co + B.c * si, B.b * co + B.d * si, -B.a * si + B.c * co, -B.b * si + B.d * co, B.a * z.x + B.c * z.y + B.e, B.b * z.x + B.d * z.y + B.f); };
        if (boss && g.fx >= 0.5) { const a = auraSprite(type); tf(0, 1); ctx.globalAlpha = 0.55 + 0.25 * Math.sin(ts * 3 + z._ph); ctx.drawImage(a.cv, -a.w / 2, -a.h / 2, a.w, a.h); ctx.globalAlpha = 1; }
        if (boss && RING[type]) { const rs = ringSprite(type, K); tf(g.tier === 'low' ? 0 : ts * (RING_SPD[type] || 0), 1); ctx.drawImage(rs.cv, -rs.w / 2, -rs.h / 2, rs.w, rs.h); }
        let ga = 1, sp;
        if (boss) {
            tf(z.ang, sc); sp = sprite(type, f, K, 0); ctx.drawImage(sp.cv, -sp.w / 2, -sp.h / 2, sp.w, sp.h);
            if (z._flash > t && g.fx >= 0.5) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
            ctx.setTransform(B);
        } else {
            // звичайні моби: спрайт уже повернутий у кеші (без обертання при малюванні — це найдешевший шлях)
            const ai = Math.round((((z.ang % TAU) + TAU) % TAU) / TAU * K.A) % K.A; sp = sprite(type, f, K, ai);
            if (type === 'ghost') { ga = 0.62 + 0.12 * Math.sin(ts * 2 + z._ph); ctx.globalAlpha = ga; }
            const w = sp.w * sc, h = sp.h * sc, yy = z.y - h / 2 + (type === 'ghost' ? Math.sin(ts * 3 + z._ph) * 1.6 : 0);
            ctx.drawImage(sp.cv, z.x - w / 2, yy, w, h);
            if (z._flash > t && g.fx >= 0.5) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(z.x, z.y, R * 0.7, 0, TAU); ctx.fill(); }
            if (ga !== 1 || z._flash > t) ctx.globalAlpha = 1;
        }
        // смужка здоров'я
        const mx = z.maxHp || hb.hp || 1, fr = Math.max(0, Math.min(1, z.hp / mx));
        if (boss) {
            const w = Math.max(70, R * 2.2), y = z.y - R - 20;
            ctx.fillStyle = 'rgba(2,6,23,.75)'; ctx.fillRect(z.x - w / 2 - 1.5, y - 1.5, w + 3, 10); ctx.fillStyle = '#7f1d1d'; ctx.fillRect(z.x - w / 2, y, w, 7);
            ctx.fillStyle = fr > 0.5 ? '#22c55e' : fr > 0.25 ? '#eab308' : '#ef4444'; ctx.fillRect(z.x - w / 2, y, w * fr, 7); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(z.x - w / 2, y, w * fr, 2);
            ctx.fillStyle = '#fff'; ctx.font = '18px Russo One, sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.7)'; const nm = hb.name || ''; ctx.strokeText(nm, z.x, y - 5); ctx.fillText(nm, z.x, y - 5);
        } else if (fr < 0.999) {
            const w = Math.max(24, R * 1.5), y = z.y - R - 7;
            ctx.fillStyle = '#1e293b'; ctx.fillRect(z.x - w / 2, y, w, 3); ctx.fillStyle = fr > 0.5 ? '#22c55e' : fr > 0.25 ? '#eab308' : '#ef4444'; ctx.fillRect(z.x - w / 2, y, w * fr, 3);
        }
    }

    window.ZombieFX = {
        VR, ART, BOSS,
        draw(ctx, zombies, t, view) {
            const g = G(), K = cfg(), key = g.tier; if (key !== qKey) { cache = {}; qKey = key; }
            view.m = ctx.getTransform();
            // при великій кількості мобів на слабкому пристрої: спершу звичайні, босів — поверх усіх
            let boss = null;
            for (const id in zombies) { const z = zombies[id]; if (BOSS[z.type]) { (boss || (boss = [])).push(id); continue; } drawOne(ctx, z, id, t, K, g, view); }
            if (boss) for (const id of boss) drawOne(ctx, zombies[id], id, t, K, g, view);
        },
        // для тестів і прев'ю: намалювати один тип у точці
        preview(ctx, type, x, y, ang, f, scale) { const K = cfg(); const sp = sprite(type, f % K.N, K); ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale || 1, scale || 1); ctx.drawImage(sp.cv, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore(); },
        reset() { cache = {}; }
    };
})();
