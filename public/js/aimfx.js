// ===== ПРИЦІЛ: лінія траєкторії (джойстик / за бажанням ПК) та курсор миші =====
// Налаштування живуть у localStorage (усе в try/catch), діють миттєво. Лінія малюється у два проходи (темна/світла обводка + яскраве ядро) без shadowBlur,
// тож читається на будь-якому тлі й нічого не коштує на телефонах. Курсор — CSS cursor:url(data:image/svg+xml) на #game-canvas (нуль роботи в кадрі).
(function () {
    'use strict';
    var LS = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    var clamp = function (v, a, b, d) { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };
    var HEX = /^#[0-9a-f]{6}$/i;
    var COLORS = [['#ffffff', 'Білий'], ['#ffe600', 'Жовтий'], ['#a3ff12', 'Лаймовий'], ['#22d3ee', 'Блакитний'], ['#ff5fb8', 'Рожевий'], ['#ff3b3b', 'Червоний'], ['#ff9100', 'Помаранчевий'], ['#a855f7', 'Фіолетовий']];
    var LINE_DEF = { show: true, pc: false, color: '#fffbe0', bright: 100, alpha: 100, width: 2, dash: 2 };
    var CUR_DEF = { style: 'cross', color: '#ffffff', size: 30, alpha: 100, dot: false };
    var CUR_STYLES = [['cross', 'Хрестик'], ['ring', 'Коло з крапкою'], ['gap', 'Перехрестя з зазором'], ['square', 'Квадрат'], ['dot', 'Крапка'], ['system', 'Системний']];
    var DASHES = [[7, 6], [12, 8], [20, 10]];

    function load(key, def, fix) {
        var o = Object.assign({}, def);
        try { var j = JSON.parse(LS.get(key) || 'null'); if (j && typeof j === 'object') Object.assign(o, j); } catch (e) {}
        return fix(o);
    }
    function fixLine(o) {
        o.show = o.show !== false; o.pc = o.pc === true;
        o.color = HEX.test(o.color) ? o.color.toLowerCase() : LINE_DEF.color;
        o.bright = clamp(o.bright, 40, 160, 100); o.alpha = clamp(o.alpha, 10, 100, 100);
        o.width = Math.round(clamp(o.width, 1, 6, 2)); o.dash = Math.round(clamp(o.dash, 1, 3, 2)); return o;
    }
    function fixCur(o) {
        if (!CUR_STYLES.some(function (s) { return s[0] === o.style; })) o.style = CUR_DEF.style;
        o.color = HEX.test(o.color) ? o.color.toLowerCase() : CUR_DEF.color;
        o.size = Math.round(clamp(o.size, 12, 64, 30)); o.alpha = clamp(o.alpha, 10, 100, 100); o.dot = o.dot === true; return o;
    }
    var L = load('aimfxLine', LINE_DEF, fixLine), C = load('aimfxCur', CUR_DEF, fixCur);
    var fine = false; try { fine = !!(window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches); } catch (e) {}

    // ---- кольори ----
    function rgb(h) { return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)]; }
    function lum(c) { return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
    function adjust(h, bright) {
        var f = bright / 100, c = rgb(h);
        return c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f + (f > 1 ? (f - 1) * 60 : 0)))); });
    }
    function outlineFor(c, a) { return lum(c) > 0.55 ? 'rgba(0,0,0,' + (0.78 * a) + ')' : 'rgba(255,255,255,' + (0.88 * a) + ')'; }

    // ---- лінія ----
    // координати у світі; vs — масштаб камери (px на одиницю світу). Мінімальна товщина тримається в екранних пікселях.
    function drawLine(ctx, x1, y1, x2, y2, vs) {
        if (!L.show) return;
        vs = vs > 0 ? vs : 1;
        var c = adjust(L.color, L.bright), a = L.alpha / 100, px = 1 / vs;
        var core = Math.max(2.4, L.width * vs * 1.5) * px, out = core + 2.6 * px;
        var d = DASHES[L.dash - 1], dash = [d[0] * px, d[1] * px], off = -(performance.now() / 1000) * 26 * px;
        ctx.save();
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.setLineDash(dash); ctx.lineDashOffset = off;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = outlineFor(c, a); ctx.lineWidth = out; ctx.stroke();
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; ctx.lineWidth = core; ctx.stroke();
        ctx.setLineDash([]);
        // маркер на кінці: кільце з хрестиком (теж з обводкою)
        var r = Math.max(5.5 * px, core * 2.2), k = r * 0.55;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(x2, y2, r, 0, Math.PI * 2);
        ctx.moveTo(x2 - k, y2); ctx.lineTo(x2 + k, y2); ctx.moveTo(x2, y2 - k); ctx.lineTo(x2, y2 + k);
        ctx.strokeStyle = outlineFor(c, a); ctx.lineWidth = out; ctx.stroke();
        ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; ctx.lineWidth = core; ctx.stroke();
        ctx.restore();
    }

    // ---- курсор ----
    function cursorSVG(o) {
        var s = o.size, h = s / 2, w = Math.max(1.6, s / 15), ow = w + 2.2, m = ow / 2 + 0.5, c = adjust(o.color, 100);
        var col = 'rgb(' + c.join(',') + ')', oc = lum(c) > 0.55 ? '#000' : '#fff', oa = lum(c) > 0.55 ? 0.8 : 0.9;
        var shapes = [], f = function (n) { return +n.toFixed(2); };
        var g = s * 0.15 + 1.5, dotR = Math.max(1.6, s / 14);
        if (o.style === 'cross') shapes.push('<path d="M' + f(m) + ' ' + f(h) + 'H' + f(s - m) + 'M' + f(h) + ' ' + f(m) + 'V' + f(s - m) + '" fill="none"/>');
        else if (o.style === 'gap') shapes.push('<path d="M' + f(m) + ' ' + f(h) + 'H' + f(h - g) + 'M' + f(h + g) + ' ' + f(h) + 'H' + f(s - m) + 'M' + f(h) + ' ' + f(m) + 'V' + f(h - g) + 'M' + f(h) + ' ' + f(h + g) + 'V' + f(s - m) + '" fill="none"/>');
        else if (o.style === 'ring') shapes.push('<circle cx="' + h + '" cy="' + h + '" r="' + f(h - m - 0.5) + '" fill="none"/>');
        else if (o.style === 'square') shapes.push('<rect x="' + f(m + 1) + '" y="' + f(m + 1) + '" width="' + f(s - 2 * m - 2) + '" height="' + f(s - 2 * m - 2) + '" fill="none"/>');
        var dot = o.style === 'ring' || o.style === 'dot' || o.dot, dr = o.style === 'dot' ? Math.max(2.6, s / 8) : dotR;
        if (dot) shapes.push('<circle cx="' + h + '" cy="' + h + '" r="' + f(dr) + '" stroke="none" fill="X"/>');
        function layer(color, strokeW, extra) {
            return shapes.map(function (sh) {
                var t = sh.replace('fill="X"', 'fill="' + color + '"');
                if (/fill="none"/.test(t)) t = t.replace('/>', ' stroke="' + color + '" stroke-width="' + strokeW + '" stroke-linecap="butt" stroke-linejoin="miter"/>');
                else t = t.replace('stroke="none"', 'stroke="' + (extra || color) + '" stroke-width="' + (extra ? 2.2 : 0) + '"');
                return t;
            }).join('');
        }
        // нижній шар — обводка (контур товщий), верхній — ядро
        var under = shapes.map(function (sh) {
            if (/fill="none"/.test(sh)) return sh.replace('/>', ' stroke="' + oc + '" stroke-opacity="' + oa + '" stroke-width="' + f(ow) + '"/>');
            return sh.replace('fill="X"', 'fill="' + oc + '" fill-opacity="' + oa + '"').replace('stroke="none"', 'stroke="' + oc + '" stroke-opacity="' + oa + '" stroke-width="2.4"');
        }).join('');
        var over = layer(col, f(w));
        return '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '" viewBox="0 0 ' + s + ' ' + s + '"><g opacity="' + (o.alpha / 100) + '">' + under + over + '</g></svg>';
    }
    function cursorURI(o) { return 'data:image/svg+xml,' + encodeURIComponent(cursorSVG(o)).replace(/\(/g, '%28').replace(/\)/g, '%29'); }
    var styleEl = null;
    function applyCursor() {
        if (!fine) return;
        if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'aimfx-cursor'; document.head.appendChild(styleEl); }
        if (C.style === 'system') { styleEl.textContent = ''; return; }
        var hot = Math.round(C.size / 2);
        styleEl.textContent = '#game-canvas{cursor:url("' + cursorURI(C) + '") ' + hot + ' ' + hot + ', crosshair}';
    }

    // ---- інтерфейс у налаштуваннях ----
    var CSS = '#settings-modal>div{max-height:94dvh;overflow-y:auto}' +
        '.ax-box{margin-bottom:14px;text-align:left;border:1px solid rgba(71,85,105,.7);border-radius:12px;background:rgba(2,6,23,.45)}' +
        '.ax-box>summary{cursor:pointer;list-style:none;padding:10px 12px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1;display:flex;justify-content:space-between;align-items:center}' +
        '.ax-box>summary::-webkit-details-marker{display:none}.ax-box>summary:after{content:"▾";color:#64748b}.ax-box[open]>summary:after{content:"▴"}' +
        '.ax-in{padding:2px 12px 12px}.ax-row{margin-top:10px}.ax-lab{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase}' +
        '.ax-lab b{color:#e2e8f0}.ax-sw{display:flex;flex-wrap:wrap;gap:6px;align-items:center}' +
        '.ax-sw button{width:26px;height:26px;border-radius:8px;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0}.ax-sw button.on{border-color:#fff;box-shadow:0 0 0 2px #3b82f6}' +
        '.ax-sw input[type=color]{width:34px;height:26px;border:2px solid rgba(255,255,255,.25);border-radius:8px;background:none;padding:0;cursor:pointer}' +
        '.ax-in input[type=range]{width:100%;accent-color:#3b82f6}' +
        '.ax-seg{display:grid;gap:4px}.ax-seg button{min-height:32px;padding:3px 4px;border-radius:9px;font-size:10px;font-weight:800;color:#94a3b8;background:rgba(2,6,23,.7);border:1px solid rgba(71,85,105,.7);cursor:pointer;line-height:1.15}' +
        '.ax-seg button.on{color:#fff;background:linear-gradient(135deg,#2563eb,#7c3aed)}' +
        '.ax-chk{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:11px;font-weight:700;color:#cbd5e1;cursor:pointer}.ax-chk input{accent-color:#3b82f6;width:16px;height:16px}' +
        '.ax-prev{margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid rgba(71,85,105,.7);display:block;width:100%}' +
        '.ax-tiles{display:grid;grid-template-columns:1fr 1fr;margin-top:10px;border-radius:10px;overflow:hidden;border:1px solid rgba(71,85,105,.7)}' +
        '.ax-tiles div{height:70px;display:flex;align-items:center;justify-content:center}' +
        '.ax-hint{margin-top:6px;font-size:10px;line-height:1.35;color:#64748b}' +
        '.ax-reset{width:100%;margin-top:12px;padding:8px;border-radius:10px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fecaca;background:rgba(127,29,29,.35);border:1px solid rgba(239,68,68,.5);cursor:pointer}';

    function swatches(id, cur) {
        return COLORS.map(function (c) { return '<button type="button" data-c="' + c[0] + '" title="' + c[1] + '" style="background:' + c[0] + '"' + (c[0] === cur ? ' class="on"' : '') + '></button>'; }).join('') +
            '<input type="color" id="' + id + '" value="' + cur + '" title="Свій колір">';
    }
    function slider(id, label, min, max, step, val, unit) {
        return '<div class="ax-row"><div class="ax-lab"><span>' + label + '</span><b id="' + id + '-v">' + val + unit + '</b></div><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></div>';
    }
    function click() { if (typeof playSound === 'function') try { playSound('ui_click'); } catch (e) {} }

    function build() {
        var modal = document.getElementById('settings-modal'), close = document.getElementById('close-settings-btn');
        if (!modal || !close || document.getElementById('ax-line')) return;
        var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

        // --- лінія ---
        var d1 = document.createElement('details'); d1.className = 'ax-box'; d1.id = 'ax-line';
        d1.innerHTML = '<summary>🎯 Лінія прицілу</summary><div class="ax-in">' +
            '<label class="ax-chk"><input type="checkbox" id="axl-show"><span>Показувати лінію</span></label>' +
            (fine ? '<label class="ax-chk"><input type="checkbox" id="axl-pc"><span>Показувати і на ПК</span></label>' : '') +
            '<div class="ax-row"><div class="ax-lab"><span>Колір</span></div><div class="ax-sw" id="axl-sw">' + swatches('axl-col', L.color) + '</div></div>' +
            slider('axl-br', 'Яскравість', 40, 160, 5, L.bright, '%') + slider('axl-al', 'Прозорість', 10, 100, 5, L.alpha, '%') + slider('axl-w', 'Товщина', 1, 6, 1, L.width, '') +
            '<div class="ax-row"><div class="ax-lab"><span>Пунктир</span></div><div class="ax-seg" id="axl-dash" style="grid-template-columns:repeat(3,1fr)"><button type="button" data-v="1">Короткий</button><button type="button" data-v="2">Середній</button><button type="button" data-v="3">Довгий</button></div></div>' +
            '<canvas class="ax-prev" id="axl-prev" width="300" height="108" style="height:108px"></canvas>' +
            '<p class="ax-hint">Лінія з’являється, коли ви цілитесь правим джойстиком.</p>' +
            '<button type="button" class="ax-reset" id="axl-reset">Скинути за замовчуванням</button></div>';
        close.parentNode.insertBefore(d1, close);

        var q = function (r, s) { return r.querySelector(s); };
        var pv = q(d1, '#axl-prev'), pctx = pv.getContext('2d');
        var BG = ['#eef3f8', '#3f7d3a', '#4a1710'];
        function paintPrev() {
            var w = pv.width, h = pv.height, bh = h / 3;
            for (var i = 0; i < 3; i++) {
                pctx.fillStyle = BG[i]; pctx.fillRect(0, i * bh, w, bh);
                if (i === 1) { pctx.fillStyle = 'rgba(0,0,0,.12)'; for (var x = 0; x < w; x += 18) pctx.fillRect(x, i * bh, 9, bh); }
                if (i === 2) { pctx.fillStyle = 'rgba(255,120,0,.35)'; for (var y = 0; y < w; y += 40) pctx.fillRect(y, i * bh + 8, 22, 5); }
                pctx.save(); var was = L.show; L.show = true; drawLine(pctx, 20, i * bh + bh / 2, w - 24, i * bh + bh / 2, 1); L.show = was; pctx.restore();
            }
            if (!L.show) { pctx.fillStyle = 'rgba(0,0,0,.55)'; pctx.fillRect(0, 0, w, h); }
        }
        function syncLine() {
            q(d1, '#axl-show').checked = L.show; var pc = q(d1, '#axl-pc'); if (pc) pc.checked = L.pc;
            q(d1, '#axl-col').value = L.color;
            d1.querySelectorAll('#axl-sw button').forEach(function (b) { b.classList.toggle('on', b.dataset.c === L.color); });
            [['br', 'bright', '%'], ['al', 'alpha', '%'], ['w', 'width', '']].forEach(function (a) { q(d1, '#axl-' + a[0]).value = L[a[1]]; q(d1, '#axl-' + a[0] + '-v').textContent = L[a[1]] + a[2]; });
            d1.querySelectorAll('#axl-dash button').forEach(function (b) { b.classList.toggle('on', +b.dataset.v === L.dash); });
            paintPrev();
        }
        function saveLine() { LS.set('aimfxLine', JSON.stringify(L)); syncLine(); }
        q(d1, '#axl-show').addEventListener('change', function () { L.show = this.checked; saveLine(); });
        var pcEl = q(d1, '#axl-pc'); if (pcEl) pcEl.addEventListener('change', function () { L.pc = this.checked; saveLine(); });
        d1.querySelectorAll('#axl-sw button').forEach(function (b) { b.addEventListener('click', function () { click(); L.color = b.dataset.c; saveLine(); }); });
        q(d1, '#axl-col').addEventListener('input', function () { L.color = this.value.toLowerCase(); saveLine(); });
        [['br', 'bright'], ['al', 'alpha'], ['w', 'width']].forEach(function (a) { q(d1, '#axl-' + a[0]).addEventListener('input', function () { L[a[1]] = +this.value; saveLine(); }); });
        d1.querySelectorAll('#axl-dash button').forEach(function (b) { b.addEventListener('click', function () { click(); L.dash = +b.dataset.v; saveLine(); }); });
        q(d1, '#axl-reset').addEventListener('click', function () { click(); L = fixLine(Object.assign({}, LINE_DEF)); saveLine(); });
        syncLine();

        // --- курсор (лише з мишею) ---
        var d2 = null;
        if (fine) {
            d2 = document.createElement('details'); d2.className = 'ax-box'; d2.id = 'ax-cur';
            d2.innerHTML = '<summary>🖱️ Курсор миші</summary><div class="ax-in">' +
                '<div class="ax-row"><div class="ax-lab"><span>Стиль</span></div><div class="ax-seg" id="axc-style" style="grid-template-columns:repeat(3,1fr)">' +
                CUR_STYLES.map(function (s) { return '<button type="button" data-v="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div></div>' +
                '<div class="ax-row"><div class="ax-lab"><span>Колір</span></div><div class="ax-sw" id="axc-sw">' + swatches('axc-col', C.color) + '</div></div>' +
                slider('axc-size', 'Розмір', 12, 64, 2, C.size, 'px') + slider('axc-al', 'Прозорість', 10, 100, 5, C.alpha, '%') +
                '<label class="ax-chk"><input type="checkbox" id="axc-dot"><span>Центральна крапка</span></label>' +
                '<div class="ax-tiles"><div id="axc-t1" style="background:#eef3f8"><img alt="" id="axc-i1"></div><div id="axc-t2" style="background:#2f6b2f"><img alt="" id="axc-i2"></div></div>' +
                '<p class="ax-hint">Курсор змінюється лише над ігровим полем. У меню лишається звичайний.</p>' +
                '<button type="button" class="ax-reset" id="axc-reset">Скинути за замовчуванням</button></div>';
            close.parentNode.insertBefore(d2, close);
            var syncCur = function () {
                q(d2, '#axc-col').value = C.color;
                d2.querySelectorAll('#axc-sw button').forEach(function (b) { b.classList.toggle('on', b.dataset.c === C.color); });
                d2.querySelectorAll('#axc-style button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === C.style); });
                q(d2, '#axc-size').value = C.size; q(d2, '#axc-size-v').textContent = C.size + 'px';
                q(d2, '#axc-al').value = C.alpha; q(d2, '#axc-al-v').textContent = C.alpha + '%';
                q(d2, '#axc-dot').checked = C.dot;
                var sys = C.style === 'system';
                ['#axc-i1', '#axc-i2'].forEach(function (s) { var im = q(d2, s); if (sys) { im.style.display = 'none'; } else { im.style.display = ''; im.src = cursorURI(C); } });
                q(d2, '#axc-t1').style.cursor = q(d2, '#axc-t2').style.cursor = sys ? 'default' : 'url("' + cursorURI(C) + '") ' + Math.round(C.size / 2) + ' ' + Math.round(C.size / 2) + ', crosshair';
            };
            var saveCur = function () { LS.set('aimfxCur', JSON.stringify(C)); syncCur(); applyCursor(); };
            d2.querySelectorAll('#axc-style button').forEach(function (b) { b.addEventListener('click', function () { click(); C.style = b.dataset.v; saveCur(); }); });
            d2.querySelectorAll('#axc-sw button').forEach(function (b) { b.addEventListener('click', function () { click(); C.color = b.dataset.c; saveCur(); }); });
            q(d2, '#axc-col').addEventListener('input', function () { C.color = this.value.toLowerCase(); saveCur(); });
            q(d2, '#axc-size').addEventListener('input', function () { C.size = +this.value; saveCur(); });
            q(d2, '#axc-al').addEventListener('input', function () { C.alpha = +this.value; saveCur(); });
            q(d2, '#axc-dot').addEventListener('change', function () { C.dot = this.checked; saveCur(); });
            q(d2, '#axc-reset').addEventListener('click', function () { click(); C = fixCur(Object.assign({}, CUR_DEF)); saveCur(); });
            syncCur();
        }
        // жива анімація пунктиру в прев’ю, поки секція відкрита
        setInterval(function () { if (d1.open && !modal.classList.contains('hidden')) paintPrev(); }, 70);
    }

    window.AimFX = {
        drawLine: drawLine,
        lineOn: function (touch) { return L.show && (touch || L.pc); },
        get line() { return L; }, get cursor() { return C; }, cursorSVG: cursorSVG
    };
    applyCursor();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
