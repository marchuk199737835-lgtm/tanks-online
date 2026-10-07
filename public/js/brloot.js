// ===== Королівський бій: малювання модулів на землі й аірдропу (використовує modesfx.js) =====
// Усі спрайти кешуються в offscreen canvas один раз; на кадр — лише drawImage/прості лінії без виділення пам’яті.
// Об’єкти поза видимою областю не малюються й не анімуються.
(function () {
    const GD = window.GameData; if (!GD) return;
    const RAR = GD.RARITY, RORD = GD.RARITY_ORDER, MODS = GD.MODULES;
    const rIdx = q => RORD.indexOf(q);
    const low = () => !!(window.GFX && GFX.tier === 'low');
    const TAU = Math.PI * 2, DASH = [10, 9], NODASH = [];
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; };

    // ---------- піктограми слотів (спільні для спрайтів і HUD) ----------
    // координати в одиницях, де радіус «чіпа» = 34; col — колір заливки акцентів
    function icon(c, type, col) {
        c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 3.4; c.strokeStyle = '#f1f5f9'; c.fillStyle = col;
        if (type === 'cannon') {
            c.rotate(-0.55);
            c.beginPath(); c.rect(-6, -6, 32, 12); c.fill(); c.stroke();
            c.beginPath(); c.rect(24, -9.5, 8, 19); c.fill(); c.stroke();
            c.beginPath(); c.arc(-12, 0, 11, 0, TAU); c.fill(); c.stroke();
            c.beginPath(); c.arc(-12, 0, 3.5, 0, TAU); c.stroke();
        } else if (type === 'turret') {
            c.beginPath(); c.arc(-1, 7, 17, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.rect(-22, 7, 42, 8); c.fill(); c.stroke();
            c.beginPath(); c.rect(13, -9, 16, 8); c.fill(); c.stroke();
            c.beginPath(); c.arc(-4, 0, 3.6, 0, TAU); c.stroke();
        } else if (type === 'hull') {
            c.beginPath(); c.moveTo(-25, 14); c.lineTo(25, 14); c.lineTo(19, -6); c.lineTo(-19, -6); c.closePath(); c.fill(); c.stroke();
            c.beginPath(); c.rect(-9, -16, 18, 10); c.fill(); c.stroke();
            c.beginPath(); c.moveTo(-17, 4); c.lineTo(17, 4); c.stroke();
        } else {
            [-16, 3].forEach(y => {
                c.beginPath(); c.rect(-26, y, 52, 14); c.fill(); c.stroke();
                for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(i * 15, y + 7, 3.4, 0, TAU); c.stroke(); }
            });
        }
        c.restore();
    }
    // мініатюра для HUD (inline SVG, колір — через currentColor)
    const SVG = {
        cannon: '<svg viewBox="0 0 24 24"><g transform="rotate(-32 12 12)" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="8" y="9" width="12" height="6"/><rect x="19" y="7.5" width="3.5" height="9"/><circle cx="7" cy="12" r="4.6"/></g></svg>',
        turret: '<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 15a7 7 0 0 1 14 0z"/><rect x="3.5" y="15" width="17" height="3.4"/><rect x="14" y="8" width="8" height="3.4"/></svg>',
        hull: '<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3 18h18l-2.6-8H5.6z"/><rect x="8.5" y="5" width="7" height="5"/></svg>',
        tracks: '<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="6"/><rect x="3" y="13.5" width="18" height="6"/></svg>'
    };

    // ---------- спрайти модулів ----------
    const chips = {}, beams = {};
    function chipSprite(type, rar) {
        const key = type + rar; if (chips[key]) return chips[key];
        const col = RAR[rar].color, c = mk(112, 112), g = c.getContext('2d'); g.translate(56, 56);
        const gr = g.createRadialGradient(0, 0, 14, 0, 0, 54); gr.addColorStop(0, rgba(col, rIdx(rar) >= 3 ? 0.5 : 0.32)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
        const hex = rd => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2; g[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rd, Math.sin(a) * rd); } g.closePath(); };
        hex(38); g.fillStyle = '#0b1220'; g.fill(); g.fillStyle = rgba(col, 0.22); g.fill();
        g.lineWidth = 5; g.strokeStyle = col; g.lineJoin = 'round'; g.stroke();
        hex(31); g.lineWidth = 1.5; g.strokeStyle = rgba(col, 0.55); g.stroke();
        icon(g, type, col);
        return (chips[key] = c);
    }
    function beamSprite(col) {
        if (beams[col]) return beams[col];
        const c = mk(48, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 256, 0, 0);
        gr.addColorStop(0, rgba(col, 0.7)); gr.addColorStop(0.35, rgba(col, 0.28)); gr.addColorStop(1, rgba(col, 0));
        g.fillStyle = gr; g.fillRect(8, 0, 32, 256);
        const gx = g.createLinearGradient(0, 0, 48, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,.55)'); gx.addColorStop(1, 'rgba(0,0,0,0)');
        g.globalCompositeOperation = 'destination-in'; g.fillStyle = gx; g.fillRect(0, 0, 48, 256);
        return (beams[col] = c);
    }

    // ---------- модуль на землі ----------
    // view: {x0,x1,y0,y1} — видима область у світових координатах
    function drawMod(ctx, p, now, view) {
        const x = p.x, y = p.y;
        if (x < view.x0 || x > view.x1 || y < view.y0 - 120 || y > view.y1 + 40) return;   // луч піднімається вгору — запас зверху
        const m = MODS[p.mod]; if (!m) return;
        const rar = p.rar || m.rarity, ri = rIdx(rar), col = RAR[rar].color, ph = x * 0.013 + y * 0.007;
        let dim = false;
        if (typeof myEquipped !== 'undefined' && myEquipped) { const e = MODS[myEquipped[m.type]]; if (e && ri <= rIdx(e.rarity)) dim = true; }
        const bob = Math.sin(now / 520 + ph) * 3, pulse = 1 + 0.045 * Math.sin(now / 330 + ph), lo = low();
        ctx.save(); ctx.translate(x, y);
        // тінь на землі
        ctx.globalAlpha = dim ? 0.12 : 0.22; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 12, 15 - bob * 0.3, 5.5, 0, 0, TAU); ctx.fill();
        if (!dim && ri >= 3) {   // легендарний/міфічний: вертикальний промінь
            const w = ri === 4 ? 54 : 42, h = ri === 4 ? 260 : 200;
            ctx.globalAlpha = 0.8 + 0.2 * Math.sin(now / 260 + ph); ctx.drawImage(beamSprite(col), -w / 2, -h + 6, w, h);
        }
        if (!dim && ri >= 2) {   // епічний+: тонке кільце
            const rr = 25 + 3 * Math.sin(now / 400 + ph);
            ctx.globalAlpha = ri === 2 ? 0.55 : 0.8; ctx.strokeStyle = col; ctx.lineWidth = ri === 2 ? 1.4 : 2;
            if (ri === 4) { ctx.setLineDash(DASH); ctx.lineDashOffset = -now / 60; }
            ctx.beginPath(); ctx.arc(0, -bob * 0.5, rr, 0, TAU); ctx.stroke(); if (ri === 4) ctx.setLineDash(NODASH);
        }
        ctx.globalAlpha = dim ? 0.45 : 1;
        const kc = typeof VS === 'number' ? Math.min(1.35, Math.max(1, 0.8 / VS)) : 1, s = 0.62 * kc * pulse, spr = chipSprite(m.type, rar); ctx.drawImage(spr, -56 * s, -56 * s + bob - 2, 112 * s, 112 * s);
        if (!dim && ri >= 3 && !lo) {   // ≤ 3 частинки, що піднімаються
            ctx.fillStyle = col;
            for (let i = 0; i < 3; i++) { const t = ((now / 1500 + i / 3 + ph) % 1), a = 1 - t; ctx.globalAlpha = a * 0.9; ctx.beginPath(); ctx.arc(Math.sin(now / 400 + i * 2.1 + ph) * 11, -10 - t * 46, 1.9 + a * 1.3, 0, TAU); ctx.fill(); }
        }
        // підпис — лише поруч із гравцем
        if (typeof myLocalTank !== 'undefined' && myLocalTank && Math.hypot(myLocalTank.x - x, myLocalTank.y - y) < 260) {
            ctx.globalAlpha = dim ? 0.55 : 1; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round';
            ctx.font = '13px "Russo One", Arial'; ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(2,6,23,.92)'; ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(0, -26 * kc + bob); ctx.scale(kc, kc);
            ctx.strokeText(m.name, 0, -16); ctx.fillText(m.name, 0, -16);
            ctx.font = '10px "Russo One", Arial'; ctx.lineWidth = 3; ctx.fillStyle = col; const t2 = RAR[rar].name + ' · ' + SLOTN[m.type];
            ctx.strokeText(t2, 0, -4); ctx.fillText(t2, 0, -4); ctx.restore();
        }
        ctx.restore();
    }
    const SLOTN = { cannon: 'гармата', turret: 'башта', hull: 'корпус', tracks: 'гусениці' };
    // чи можна підібрати (правило сервера): слот порожній або рідкість строго вища
    function canTake(p) {
        if (!p || !p.mod) return true; const m = MODS[p.mod]; if (!m) return false;
        if (typeof myEquipped === 'undefined' || !myEquipped) return true;
        const e = MODS[myEquipped[m.type]]; return !e || rIdx(p.rar || m.rarity) > rIdx(e.rarity);
    }

    // ---------- аірдроп ----------
    const MYTH = RAR.mythic.color;
    let spr = null;
    function sprites() {
        if (spr) return spr; spr = {};
        // ящик (вигляд зверху): тіло з кришкою, діагональні смуги
        const crate = (c, open) => {
            c.save(); c.translate(64, 64); c.lineJoin = 'round';
            c.fillStyle = '#334155'; c.strokeStyle = '#0f172a'; c.lineWidth = 6; c.beginPath(); c.rect(-50, -50, 100, 100); c.fill(); c.stroke();
            if (open) {
                const gr = c.createRadialGradient(0, 0, 4, 0, 0, 52); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, MYTH); gr.addColorStop(1, '#3b0a1c');
                c.fillStyle = gr; c.beginPath(); c.rect(-42, -42, 84, 84); c.fill();
            } else {
                c.fillStyle = '#475569'; c.beginPath(); c.rect(-42, -42, 84, 84); c.fill();
                c.strokeStyle = '#facc15'; c.lineWidth = 9; c.save(); c.beginPath(); c.rect(-42, -42, 84, 84); c.clip();
                for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * 22 - 60, -60); c.lineTo(i * 22 + 60, 60); c.stroke(); }
                c.restore();
                c.fillStyle = '#0f172a'; c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); c.fillStyle = '#facc15'; c.font = 'bold 22px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('★', 0, 1);
            }
            c.strokeStyle = '#94a3b8'; c.lineWidth = 3; c.beginPath(); c.rect(-50, -50, 100, 100); c.stroke();
            c.fillStyle = '#cbd5e1'; [[-44, -44], [44, -44], [-44, 44], [44, 44]].forEach(q => { c.beginPath(); c.arc(q[0], q[1], 3.5, 0, TAU); c.fill(); });
            c.restore();
        };
        spr.closed = mk(128, 128); crate(spr.closed.getContext('2d'), false);
        spr.openBase = mk(128, 128); crate(spr.openBase.getContext('2d'), true);
        // кришка (окремо — для анімації відкриття)
        spr.lid = mk(128, 128); { const c = spr.lid.getContext('2d'); c.translate(64, 64); c.fillStyle = '#475569'; c.strokeStyle = '#0f172a'; c.lineWidth = 6; c.beginPath(); c.rect(-50, -50, 100, 100); c.fill(); c.stroke();
            c.strokeStyle = '#facc15'; c.lineWidth = 9; c.save(); c.beginPath(); c.rect(-42, -42, 84, 84); c.clip(); for (let i = -5; i <= 5; i++) { c.beginPath(); c.moveTo(i * 22 - 60, -60); c.lineTo(i * 22 + 60, 60); c.stroke(); } c.restore();
            c.strokeStyle = '#94a3b8'; c.lineWidth = 3; c.beginPath(); c.rect(-50, -50, 100, 100); c.stroke(); }
        // ящик на парашуті: купол + стропи (вузол ящика — внизу)
        spr.chute = mk(240, 320); { const c = spr.chute.getContext('2d'); c.lineJoin = 'round';
            const cx = 120, cy = 118, R = 104, n = 7;
            c.strokeStyle = 'rgba(226,232,240,.9)'; c.lineWidth = 2.2;
            for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI, px = cx + Math.cos(a) * R, py = cy + Math.sin(a) * R * 0.62 + 6; c.beginPath(); c.moveTo(px, py); c.lineTo(120, 250); c.stroke(); }
            for (let i = 0; i < n; i++) {
                const a0 = Math.PI + i / n * Math.PI, a1 = Math.PI + (i + 1) / n * Math.PI;
                c.beginPath(); c.moveTo(cx, cy - R * 0.62 + 4);
                c.quadraticCurveTo(cx + Math.cos(a0) * R * 0.95, cy + Math.sin(a0) * R * 0.78, cx + Math.cos(a0) * R, cy + Math.sin(a0) * R * 0.62 + 6);
                c.quadraticCurveTo(cx + Math.cos((a0 + a1) / 2) * R * 1.0, cy + Math.sin((a0 + a1) / 2) * R * 0.62 + 20, cx + Math.cos(a1) * R, cy + Math.sin(a1) * R * 0.62 + 6);
                c.quadraticCurveTo(cx + Math.cos(a1) * R * 0.95, cy + Math.sin(a1) * R * 0.78, cx, cy - R * 0.62 + 4);
                c.closePath(); c.fillStyle = i % 2 ? '#f8fafc' : '#ef4444'; c.fill(); c.strokeStyle = '#0f172a'; c.lineWidth = 2.5; c.stroke();
            }
            c.drawImage(spr.closed, 120 - 40, 250 - 14, 80, 80);   // ящик (масштаб 0.625 від 128)
        }
        // світловий стовп і пляма світла
        spr.col = beamSprite(MYTH);
        spr.glow = mk(128, 128); { const c = spr.glow.getContext('2d'), gr = c.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, rgba(MYTH, 0.7)); gr.addColorStop(1, rgba(MYTH, 0)); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }
        return spr;
    }

    // стан аірдропу з боку клієнта (локальний час відліку від першого отримання стану)
    const D = { id: null, st: null, t0: 0, x: 0, y: 0 };
    // димовий хвіст: фіксований буфер (≤ 20 частинок)
    const SM = new Float32Array(20 * 5); let smAt = 0, smLast = 0;
    function track(dr, now) {
        if (!dr) { if (D.id !== null) { D.id = null; D.st = null; SM.fill(0); } return false; }
        if (dr.id !== D.id || dr.st !== D.st) { D.id = dr.id; D.st = dr.st; D.t0 = now; D.x = dr.x; D.y = dr.y; SM.fill(0); }
        return true;
    }
    const inView = (x, y, v, m) => x > v.x0 - m && x < v.x1 + m && y > v.y0 - m && y < v.y1 + m;
    const FALL_ALT = 560;
    const fallE = k => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 1.7);

    // наземний шар (під танками): маркер, тінь, ящик, світло, ударна хвиля, пил
    function ground(ctx, dr, now, view) {
        if (!track(dr, now)) return;
        if (!inView(dr.x, dr.y, view, 200)) return;
        const S = sprites(), age = now - D.t0, x = dr.x, y = dr.y, lo = low();
        ctx.save(); ctx.translate(x, y);
        if (dr.st === 'warn' || dr.st === 'fall') {
            const k = dr.st === 'warn' ? Math.min(1, age / dr.dur) * 0.4 : 0.4 + Math.min(1, age / dr.dur) * 0.6, p = 0.5 + 0.5 * Math.sin(now / 120);
            ctx.globalAlpha = 0.5 + 0.3 * p; ctx.strokeStyle = '#f87171'; ctx.lineWidth = 4; ctx.setLineDash(DASH); ctx.lineDashOffset = now / 40;
            ctx.beginPath(); ctx.arc(0, 0, 90 - 14 * k, 0, TAU); ctx.stroke(); ctx.setLineDash(NODASH);
            ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(26, 0); ctx.moveTo(0, -26); ctx.lineTo(0, 26); ctx.stroke();
            ctx.globalAlpha = 0.08 + 0.1 * p; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 88, 0, TAU); ctx.fill();
        }
        if (dr.st === 'fall') {
            const e = fallE(age / dr.dur), rx = 36 * (1 + (1 - e) * 0.9);
            ctx.globalAlpha = 0.1 + 0.3 * e; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 6, rx, rx * 0.55, 0, 0, TAU); ctx.fill();
        } else if (dr.st === 'open' || dr.st === 'done') {
            const fade = dr.st === 'done' ? Math.max(0.2, 1 - age / dr.dur * 0.8) : 1;
            // ударна хвиля й пил після приземлення
            if (dr.st === 'open' && age < 1100 && !lo) {
                const t = age / 1100; ctx.globalAlpha = (1 - t) * 0.8; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 6 * (1 - t) + 1; ctx.beginPath(); ctx.arc(0, 0, 30 + t * 210, 0, TAU); ctx.stroke();
                ctx.globalAlpha = (1 - t) * 0.5; ctx.fillStyle = '#a8a29e';
                for (let i = 0; i < 12; i++) { const a = i * 0.5236 + 0.3, d = 24 + t * (80 + (i % 3) * 22); ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.7, 9 + t * 14, 0, TAU); ctx.fill(); }
            }
            ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(0, 6, 40, 24, 0, 0, TAU); ctx.fill();
            if (dr.st === 'open') {   // пляма світла й стовп
                const fl = 0.75 + 0.25 * Math.sin(now / 70) * Math.sin(now / 173);
                ctx.globalAlpha = 0.55 * fl; ctx.drawImage(S.glow, -90, -90, 180, 180);
                ctx.globalAlpha = Math.min(1, age / 500) * (0.55 + 0.3 * fl); const bw = 76 + 10 * Math.sin(now / 200); ctx.drawImage(S.col, -bw / 2, -620, bw, 620);
            }
            ctx.globalAlpha = fade;
            ctx.drawImage(dr.st === 'open' || dr.st === 'done' ? S.openBase : S.closed, -32, -32, 64, 64);
            // кришка: відкривається за 650 мс (поворот навколо верхнього краю)
            const lk = dr.st === 'open' ? Math.min(1, age / 650) : 1, ang = lk * Math.PI * 0.92, cs = Math.cos(ang);
            ctx.save(); ctx.translate(0, -32); ctx.scale(1, cs); ctx.translate(0, 32); ctx.globalAlpha = fade * (cs < 0 ? 0.85 : 1);
            ctx.drawImage(S.lid, -32, -32, 64, 64); ctx.restore();
        }
        ctx.restore();
    }

    // небесний шар (над усім): ящик на парашуті
    function sky(ctx, dr, now, view) {
        if (!track(dr, now) || dr.st !== 'fall') { smLast = 0; return; }
        const k = (now - D.t0) / dr.dur, e = fallE(k), alt = (1 - e) * FALL_ALT, py = dr.y - alt;
        if (!inView(dr.x, py, view, 260)) return;
        const S = sprites(), sc = 1 + (1 - e) * 1.0, kk = 0.8 * sc, lo = low();
        // димовий хвіст
        if (!lo) {
            if (now - smLast > 90) { smLast = now; const i = smAt++ % 20; SM[i * 5] = dr.x + (Math.random() - 0.5) * 8; SM[i * 5 + 1] = py - 10 * sc; SM[i * 5 + 2] = 1; SM[i * 5 + 3] = (Math.random() - 0.5) * 12; SM[i * 5 + 4] = -6 - Math.random() * 6; }
            ctx.fillStyle = '#cbd5e1';
            for (let i = 0; i < 20; i++) {
                let a = SM[i * 5 + 2]; if (a <= 0) continue;
                a -= 0.012; SM[i * 5 + 2] = a < 0 ? 0 : a; SM[i * 5] += SM[i * 5 + 3] * 0.016; SM[i * 5 + 1] += SM[i * 5 + 4] * 0.016;
                ctx.globalAlpha = a * 0.5; ctx.beginPath(); ctx.arc(SM[i * 5], SM[i * 5 + 1], 4 + (1 - a) * 12, 0, TAU); ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        const sway = Math.sin(now / 430) * 0.1 * (1 - e * 0.8);
        ctx.save(); if (k > 0.93) ctx.globalAlpha = Math.max(0, (1 - k) / 0.07); ctx.translate(dr.x, py - 158 * kk); ctx.rotate(sway); ctx.drawImage(S.chute, -120 * kk, -118 * kk, 240 * kk, 320 * kk); ctx.restore();
    }

    window.BRLoot = { drawMod: drawMod, canTake: canTake, ground: ground, sky: sky, track: track, svg: SVG, slotName: SLOTN, reset() { track(null, 0); } };
})();
