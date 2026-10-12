/* settings.js — вікно ⚙ «Налаштування» з вкладками: Загальні · Приціл · Графіка · Керування.
 * Інші модулі (gfx.js, aimfx.js, hud.js, controls.js, extras.js…) як і раніше додають свої рядки у #settings-modal —
 * цей модуль лише розкладає їх по вкладках (за id) і будує вкладку «Керування»:
 *   • ПК — перепризначення всіх клавіш гри (keybinds.js, працює на будь-якій розкладці);
 *   • телефон — варіанти розташування сенсорних кнопок з живим прев'ю, розмір і прозорість кнопок.
 * Тут же живе TouchLayout (game.js питає TouchLayout.swap() — «для лівші» міняє сторони джойстиків). */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var LS = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    var tt = function (s) { return window.I18N ? I18N.t(s) : s; };
    var snd = function (k) { if (typeof playSound === 'function') try { playSound(k || 'ui_click'); } catch (e) {} };
    var toast = function (m, bad) { if (window.uiToast) try { uiToast(tt(m), bad); } catch (e) {} };
    var isTouch = function () { return document.documentElement.classList.contains('ctl-touch'); };
    var clamp = function (v, a, b, d) { v = +v; return isFinite(v) ? Math.min(b, Math.max(a, v)) : d; };

    // ================= РОЗКЛАДКИ СЕНСОРНИХ КНОПОК =================
    // s — відступ від бокового краю (px), p — % висоти від низу, y — ще px від низу (× масштаб HUD), side — 'r' / 'l'
    var BTN = { ab: { id: 'cls-hud', sz: 58, e: '⚡', n: 'Здібність' }, dash: { id: 'bh-dash', sz: 52, e: '💨', n: 'Ривок' }, emo: { id: 'emo-btn', sz: 46, e: '💬', n: 'Емоції' } };
    var PRESETS = [
        { id: 'classic', n: 'Класична', d: 'Кнопки стовпчиком праворуч посередині. Рух — ліва половина екрана, приціл — права.',
            b: { emo: { side: 'r', s: 22, p: 46, y: 0 }, dash: { side: 'r', s: 18, p: 46, y: 56 }, ab: { side: 'r', s: 14, p: 46, y: 118 } } },
        { id: 'thumb', n: 'Під великий палець', d: 'Кнопки дугою в правому нижньому куті — тягнутись не треба.',
            b: { ab: { side: 'r', s: 22, p: 0, y: 26 }, dash: { side: 'r', s: 98, p: 0, y: 22 }, emo: { side: 'r', s: 28, p: 0, y: 106 } } },
        { id: 'split', n: 'Розділена', d: 'Ривок ліворуч (під палець, що керує рухом), здібність і емоції — праворуч.',
            b: { dash: { side: 'l', s: 26, p: 0, y: 30 }, ab: { side: 'r', s: 22, p: 0, y: 30 }, emo: { side: 'r', s: 28, p: 0, y: 112 } } },
        { id: 'lefty', n: 'Для лівші', d: 'Дзеркально: приціл і постріл — ліва половина, рух — права. Кнопки ліворуч.', swap: true,
            b: { emo: { side: 'l', s: 22, p: 46, y: 0 }, dash: { side: 'l', s: 18, p: 46, y: 56 }, ab: { side: 'l', s: 14, p: 46, y: 118 } } }
    ];
    var TL = { preset: 'classic', size: 100, alpha: 100 };
    try { var j0 = JSON.parse(LS.get('touchLayout') || 'null'); if (j0) { if (PRESETS.some(function (p) { return p.id === j0.preset; })) TL.preset = j0.preset; TL.size = Math.round(clamp(j0.size, 70, 140, 100)); TL.alpha = Math.round(clamp(j0.alpha, 40, 100, 100)); } } catch (e) {}
    function preset(id) { return PRESETS.filter(function (p) { return p.id === (id || TL.preset); })[0] || PRESETS[0]; }
    var tlStyle = null;
    function applyTL() {
        if (!tlStyle) { tlStyle = document.createElement('style'); tlStyle.id = 'tl-css'; document.head.appendChild(tlStyle); }
        var P = preset(), H = 'html.ctl-touch.tl-on ', css = ':root{--tbs:' + (TL.size / 100) + ';--tba:' + (TL.alpha / 100) + '}';
        Object.keys(BTN).forEach(function (k) {
            var q = P.b[k], sel = H + '#' + BTN[k].id + (k === 'emo' ? '.show' : ''), side = q.side === 'l' ? 'left' : 'right', other = q.side === 'l' ? 'right' : 'left';
            css += sel + '{' + other + ':auto!important;' + side + ':calc(env(safe-area-inset-' + side + ',0px) + ' + q.s + 'px)!important;bottom:calc(env(safe-area-inset-bottom,0px) + ' + q.p + '% + ' + q.y + 'px * var(--bhz,1))!important;opacity:var(--tba)}';
        });
        // розмір кнопок
        css += H + '#bh-dash{width:calc(52px * var(--bhz,1) * var(--tbs))!important;height:calc(52px * var(--bhz,1) * var(--tbs))!important;font-size:calc(22px * var(--bhz,1) * var(--tbs))!important}' +
            H + '#cls-ab{width:calc(58px * var(--bhz,1) * var(--tbs))!important;height:calc(58px * var(--bhz,1) * var(--tbs))!important}' +
            H + '#cls-ab i{line-height:calc(58px * var(--bhz,1) * var(--tbs))!important;font-size:calc(25px * var(--bhz,1) * var(--tbs))!important}' +
            H + '#emo-btn.show{width:calc(46px * var(--bhz,1) * var(--tbs))!important;height:calc(46px * var(--bhz,1) * var(--tbs))!important;font-size:calc(20px * var(--bhz,1) * var(--tbs))!important}' +
            H + '#cls-hud{transform:none!important}';
        tlStyle.textContent = css;
        document.documentElement.classList.add('tl-on');
    }
    function saveTL() { LS.set('touchLayout', JSON.stringify(TL)); applyTL(); }
    applyTL();
    window.TouchLayout = { swap: function () { return !!preset().swap; }, get: function () { return Object.assign({}, TL); }, PRESETS: PRESETS };

    // ================= СТИЛІ ВІКНА =================
    var CSS = '' +
        '#settings-modal>div.st-panel{max-width:600px;width:100%;max-height:94dvh;overflow:hidden!important;display:flex;flex-direction:column;padding:0!important;text-align:left}' +
        '.st-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 18px 10px}.st-head h2{margin:0!important;font-size:20px!important}' +
        '.st-x{width:36px;height:36px;border-radius:12px;border:1px solid #334155;background:rgba(15,23,42,.8);color:#cbd5e1;font-size:18px;cursor:pointer;flex:none}.st-x:hover{color:#fff;border-color:#64748b}' +
        '.st-tabs{display:flex;gap:6px;padding:0 18px 10px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid rgba(71,85,105,.5)}.st-tabs::-webkit-scrollbar{display:none}' +
        '.st-tab{flex:1 0 auto;display:flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:6px 12px;border-radius:12px;border:1px solid #334155;background:rgba(15,23,42,.7);color:#94a3b8;font:400 13px/1 "Russo One",Arial,sans-serif;letter-spacing:.03em;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}' +
        '.st-tab:hover{color:#e2e8f0;border-color:#475569}.st-tab.on{color:#fff;border-color:#818cf8;background:linear-gradient(135deg,#2563eb,#7c3aed);box-shadow:0 0 14px rgba(99,102,241,.45)}' +
        '.st-body{flex:1;min-height:0;overflow-y:auto;padding:14px 18px 6px;overscroll-behavior:contain}' +
        '.st-pane{display:none}.st-pane.on{display:block;animation:stIn .18s ease-out}@keyframes stIn{from{opacity:0;transform:translateY(4px)}}' +
        '.st-foot{display:flex;flex-direction:column;gap:0;padding:10px 18px 16px;border-top:1px solid rgba(71,85,105,.5)}.st-foot button{margin-bottom:0!important}.st-foot button+button{margin-top:8px}' +
        '.st-h{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#94a3b8;margin:4px 0 8px}' +
        '.st-note{font-size:11px;line-height:1.4;color:#64748b;margin:6px 0 12px}' +
        // клавіші
        '.kb-list{display:flex;flex-direction:column;gap:6px}' +
        '.kb-row{display:grid;grid-template-columns:1fr 104px 104px;gap:6px;align-items:center;padding:6px 8px;border-radius:12px;background:rgba(2,6,23,.45);border:1px solid rgba(51,65,85,.6)}' +
        '.kb-row>span{font-size:12px;font-weight:700;color:#e2e8f0}' +
        '.kb-k{height:34px;border-radius:9px;border:1px solid #475569;background:linear-gradient(#1e293b,#0f172a);box-shadow:inset 0 -2px 0 rgba(0,0,0,.4);color:#fff;font:400 12px/1 "Russo One",Arial,sans-serif;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 6px}' +
        '.kb-k:hover{border-color:#818cf8}.kb-k.empty{color:#475569}.kb-k.wait{border-color:#facc15;color:#facc15;animation:kbBlink .9s infinite}@keyframes kbBlink{50%{opacity:.55}}' +
        '.kb-k.flash{border-color:#4ade80;box-shadow:0 0 10px rgba(74,222,128,.6)}' +
        '.st-btn{width:100%;margin-top:12px;padding:9px;border-radius:11px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fecaca;background:rgba(127,29,29,.35);border:1px solid rgba(239,68,68,.5);cursor:pointer}' +
        // телефон
        '.tl-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}' +
        '.tl-card{position:relative;padding:6px;border-radius:13px;border:1px solid #334155;background:rgba(2,6,23,.5);cursor:pointer;text-align:center;color:#cbd5e1;font:400 12px/1.2 "Russo One",Arial,sans-serif}' +
        '.tl-card canvas{display:block;width:100%;height:auto;border-radius:9px;margin-bottom:5px}' +
        '.tl-card.on{border-color:#818cf8;box-shadow:0 0 0 2px rgba(129,140,248,.55),0 0 16px rgba(99,102,241,.35);color:#fff}' +
        '.tl-card.on:after{content:"✓";position:absolute;top:8px;right:10px;width:20px;height:20px;border-radius:50%;background:#6366f1;color:#fff;font:700 12px/20px Arial}' +
        '.tl-big{margin-top:12px;border-radius:14px;overflow:hidden;border:1px solid rgba(129,140,248,.45);background:#0b1220}.tl-big canvas{display:block;width:100%;height:auto}' +
        '.tl-desc{font-size:11px;line-height:1.4;color:#94a3b8;margin:8px 0 2px;min-height:30px}' +
        '.st-rng{margin-top:12px}.st-rng .ax-lab{display:flex;justify-content:space-between;font-size:10px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase}.st-rng .ax-lab b{color:#e2e8f0}.st-rng input{width:100%;accent-color:#3b82f6}' +
        '@media (max-width:520px){.kb-row{grid-template-columns:1fr 84px 84px}.st-tab{font-size:12px;padding:6px 9px}.st-head{padding:12px 14px 8px}.st-tabs,.st-body,.st-foot{padding-left:14px;padding-right:14px}}' +
        '@media (orientation:landscape) and (max-height:500px){.st-head{padding-top:8px;padding-bottom:6px}.st-head h2{font-size:16px!important}.st-tab{min-height:34px}.st-foot{padding-top:6px;padding-bottom:8px}.st-foot button{padding-top:8px!important;padding-bottom:8px!important}.tl-grid{grid-template-columns:repeat(4,minmax(0,1fr))}}';

    var TABS = [['general', '⚙️', 'Загальні'], ['aim', '🎯', 'Приціл'], ['gfx', '🖥️', 'Графіка'], ['ctl', '🎮', 'Керування']];
    // що в яку вкладку (за id елемента або його рядка)
    var PLACE = {
        general: ['#vol-sfx', '#vol-music', '#ctl-row', '#lang-select', '#xt-row', '#ui-scale-row', '#settings-install-btn'],
        aim: ['#ax-line', '#ax-cur'],
        gfx: ['#gfx-box', '#view-zoom-row', '#bh-set']
    };
    var panel = null, body = null, panes = {}, foot = null, built = false, curTab = LS.get('setTab') || 'general';
    if (!TABS.some(function (t) { return t[0] === curTab; })) curTab = 'general';

    function build() {
        var modal = $('settings-modal'), close = $('close-settings-btn'); if (!modal || !close || built) return;
        panel = modal.firstElementChild; if (!panel) return; built = true;
        var st = document.createElement('style'); st.id = 'st-css'; st.textContent = CSS; document.head.appendChild(st);
        panel.classList.remove('max-w-sm', 'p-6', 'lg:p-8', 'text-center'); panel.classList.add('st-panel');
        var h2 = panel.querySelector('h2');
        var head = document.createElement('div'); head.className = 'st-head';
        if (h2) head.appendChild(h2);
        var x = document.createElement('button'); x.type = 'button'; x.className = 'st-x'; x.setAttribute('aria-label', 'Закрити'); x.textContent = '✕';
        x.addEventListener('click', function () { close.click(); }); head.appendChild(x);
        var tabs = document.createElement('div'); tabs.className = 'st-tabs'; tabs.setAttribute('role', 'tablist');
        tabs.innerHTML = TABS.map(function (t) { return '<button type="button" class="st-tab" role="tab" data-t="' + t[0] + '"><i style="font-style:normal">' + t[1] + '</i><span>' + t[2] + '</span></button>'; }).join('');
        tabs.addEventListener('click', function (e) { var b = e.target.closest('.st-tab'); if (!b) return; snd('ui_tab'); setTab(b.dataset.t); });
        body = document.createElement('div'); body.className = 'st-body';
        TABS.forEach(function (t) { var p = document.createElement('div'); p.className = 'st-pane'; p.dataset.t = t[0]; p.setAttribute('role', 'tabpanel'); body.appendChild(p); panes[t[0]] = p; });
        foot = document.createElement('div'); foot.className = 'st-foot';
        panel.insertBefore(head, panel.firstChild); panel.insertBefore(tabs, head.nextSibling); panel.insertBefore(body, tabs.nextSibling);
        panel.appendChild(foot);
        var leave = $('settings-leave-btn'); if (leave) foot.appendChild(leave);
        foot.appendChild(close);
        organize(); buildCtl(); setTab(curTab);
        // кожне відкриття: дорозкласти пізні рядки, оновити вкладку «Керування» під поточний пристрій
        document.querySelectorAll('.settings-btn').forEach(function (b) { b.addEventListener('click', function () { organize(); renderCtl(); setTab(curTab); }, true); });
        var ctlRow = $('ctl-row'); if (ctlRow) ctlRow.addEventListener('click', function () { setTimeout(renderCtl, 0); });
        new MutationObserver(function () { organize(); }).observe(panel, { childList: true });
    }
    // «рядок» елемента — його предок, що лежить прямо в панелі, у вкладці або в підвалі
    function holder(n) { return n === panel || n === foot || !!(n && n.classList && n.classList.contains('st-pane')); }
    function rowOf(el) {
        var n = el; while (n && n.parentNode && !holder(n.parentNode)) n = n.parentNode;
        return n && n.parentNode ? n : null;
    }
    function organize() {
        if (!built) return;
        Object.keys(PLACE).forEach(function (t) {
            PLACE[t].forEach(function (sel) { var r = rowOf(panel.querySelector(sel)); if (r && (r.parentNode !== panes[t] || r !== panes[t].lastElementChild)) panes[t].appendChild(r); });      // у порядку списку
        });
        // модулі, що вставляють свої рядки «перед кнопкою Закрити», потрапляють у підвал — забираємо у «Загальні»
        Array.prototype.slice.call(foot.children).forEach(function (c) { if (c.id !== 'close-settings-btn' && c.id !== 'settings-leave-btn') panes.general.appendChild(c); });
        // прицільні секції — завжди розгорнуті
        ['ax-line', 'ax-cur'].forEach(function (id) { var d = $(id); if (d && !d._stOpen) { d._stOpen = 1; d.open = true; } });
        // все невідоме, що інші модулі додали прямо в панель, — у «Загальні»
        Array.prototype.slice.call(panel.children).forEach(function (c) {
            if (c.classList.contains('st-head') || c.classList.contains('st-tabs') || c.classList.contains('st-body') || c.classList.contains('st-foot')) return;
            if (c.id === 'close-settings-btn' || c.id === 'settings-leave-btn') { foot.appendChild(c); return; }
            panes.general.appendChild(c);
        });
        if (!panes.aim.children.length) panes.aim.innerHTML = '<p class="st-note">Налаштування прицілу завантажуються…</p>';
        else { var n = panes.aim.querySelector('.st-note'); if (n && panes.aim.children.length > 1) n.remove(); }
        if (!$('st-aim-note') && panes.aim.querySelector('#ax-line') && !panes.aim.querySelector('#ax-cur')) {
            var p = document.createElement('p'); p.id = 'st-aim-note'; p.className = 'st-note'; p.textContent = 'На телефоні приціл показує лінія траєкторії правого джойстика. Курсор миші налаштовується на ПК.'; panes.aim.appendChild(p);
        }
    }
    function setTab(t) {
        if (!panes[t]) t = 'general'; curTab = t; LS.set('setTab', t);
        if (waitBtn && t !== 'ctl') stopWait();
        Object.keys(panes).forEach(function (k) { panes[k].classList.toggle('on', k === t); });
        panel.querySelectorAll('.st-tab').forEach(function (b) { var on = b.dataset.t === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
        if (body) body.scrollTop = 0;
        if (t === 'ctl') paintPreviews();
    }

    // ================= ВКЛАДКА «КЕРУВАННЯ» =================
    var ctlMode = null;
    function buildCtl() {
        renderCtl();
        if (window.KB) KB.on(function () { if (ctlMode === 'pc') paintKeys(); });
        panes.ctl.addEventListener('click', function (e) { if (ctlMode === 'pc') pcClick(e); else touchClick(e); });
        // «примірка»: наведення / утримання картки одразу показує її у великому прев'ю
        panes.ctl.addEventListener('pointerover', function (e) { if (ctlMode !== 'touch') return; var c = e.target.closest && e.target.closest('.tl-card'), p = c ? c.dataset.p : null; if (p !== hoverP) { hoverP = p; paintBig(); } });
        panes.ctl.addEventListener('pointerleave', function () { if (hoverP) { hoverP = null; paintBig(); } });
        // закрили вікно / перейшли на іншу вкладку посеред очікування клавіші — скасовуємо
        new MutationObserver(function () { if (waitBtn && ($('settings-modal').classList.contains('hidden') || curTab !== 'ctl')) stopWait(); }).observe($('settings-modal'), { attributes: true, attributeFilter: ['class'] });
    }
    function renderCtl() {
        if (!built) return; var m = isTouch() ? 'touch' : 'pc';
        if (window.KB) KB.cancelCapture();
        if (m === ctlMode && panes.ctl.children.length) { if (m === 'pc') paintKeys(); else paintPreviews(); return; }
        ctlMode = m; panes.ctl.innerHTML = m === 'pc' ? pcHtml() : touchHtml();
        if (m === 'pc') wirePc(); else wireTouch();
    }
    // ---- ПК: клавіші ----
    function pcHtml() {
        if (!window.KB) return '<p class="st-note">Клавіші недоступні.</p>';
        return '<div class="st-h">Клавіші</div><p class="st-note">Натисніть на клавішу, щоб змінити її, і потім — нову клавішу. Esc — скасувати, Backspace — очистити. Керування працює на будь-якій розкладці клавіатури (українська, англійська тощо).</p>' +
            '<div class="kb-list">' + KB.ACTIONS.map(function (a) {
                return '<div class="kb-row" data-a="' + a.id + '"><span>' + a.n + '</span><button type="button" class="kb-k" data-s="0"></button><button type="button" class="kb-k" data-s="1"></button></div>';
            }).join('') + '</div>' +
            '<p class="st-note">Ліва кнопка миші — завжди постріл, курсор — приціл. Емоції в меню — цифри 1–6, вибір перка — 1–3.</p>' +
            '<button type="button" class="st-btn" id="kb-reset">Скинути всі клавіші</button>';
    }
    var waitBtn = null;
    function paintKeys() {
        if (!window.KB) return;
        panes.ctl.querySelectorAll('.kb-row').forEach(function (r) {
            var b = KB.get(r.dataset.a);
            r.querySelectorAll('.kb-k').forEach(function (k) {
                if (k === waitBtn) return; var c = b[+k.dataset.s];
                k.textContent = c ? KB.keyName(c) : '—'; k.classList.toggle('empty', !c); k.title = c ? c : '';
            });
        });
    }
    function stopWait() { if (waitBtn) { waitBtn.classList.remove('wait'); waitBtn = null; } if (window.KB) KB.cancelCapture(); paintKeys(); }
    function wirePc() { waitBtn = null; paintKeys(); }
    function pcClick(e) {
        if (!window.KB) return;
        {
            var k = e.target.closest('.kb-k');
            if (e.target.id === 'kb-reset') { snd(); stopWait(); KB.reset(); toast('Клавіші скинуто'); return; }
            if (!k) return;
            if (waitBtn === k) { stopWait(); return; }
            stopWait(); snd();
            waitBtn = k; k.classList.add('wait'); k.textContent = tt('Натисніть…');
            var row = k.closest('.kb-row'), id = row.dataset.a, s = +k.dataset.s;
            KB.capture(function (code) {
                var btn = waitBtn; waitBtn = null; if (btn) btn.classList.remove('wait');
                if (!code || code === 'Escape') { paintKeys(); return; }
                if (code === 'Backspace' || code === 'Delete') { KB.clear(id, s); snd('ui_off'); return; }
                if (KB.RESERVED[code]) { paintKeys(); snd('ui_error'); toast('Цю клавішу не можна призначити', true); return; }
                var from = KB.bind(id, s, code); snd('ui_on');
                if (from && from !== id) { var a = KB.ACTIONS.filter(function (q) { return q.id === from; })[0]; toast(tt('Клавішу знято з дії') + ' «' + tt(a ? a.n : from) + '»'); }
                if (btn) { btn.classList.add('flash'); setTimeout(function () { btn.classList.remove('flash'); }, 500); }
            });
        }
    }
    // ---- телефон: розкладка кнопок ----
    function touchHtml() {
        return '<div class="st-h">Розташування кнопок</div>' +
            '<div class="tl-grid">' + PRESETS.map(function (p) { return '<div class="tl-card" role="button" tabindex="0" data-p="' + p.id + '"><canvas width="220" height="102"></canvas><span>' + p.n + '</span></div>'; }).join('') + '</div>' +
            '<div class="tl-big"><canvas id="tl-big" width="640" height="296"></canvas></div><p class="tl-desc" id="tl-desc"></p>' +
            '<div class="st-rng"><div class="ax-lab"><span>Розмір кнопок</span><b id="tl-sz-v"></b></div><input type="range" id="tl-sz" min="70" max="140" step="5"></div>' +
            '<div class="st-rng"><div class="ax-lab"><span>Непрозорість кнопок</span><b id="tl-al-v"></b></div><input type="range" id="tl-al" min="40" max="100" step="5"></div>' +
            '<button type="button" class="st-btn" id="tl-reset">Скинути розкладку</button>';
    }
    var hoverP = null;
    function touchClick(e) {
        var c = e.target.closest('.tl-card');
        if (c) { snd(); TL.preset = c.dataset.p; hoverP = null; saveTL(); paintPreviews(); toast(tt('Розкладка') + ': ' + tt(preset().n)); return; }
        if (e.target.id === 'tl-reset') { snd(); TL = { preset: 'classic', size: 100, alpha: 100 }; $('tl-sz').value = 100; $('tl-al').value = 100; saveTL(); paintPreviews(); }
    }
    function wireTouch() {
        var sz = $('tl-sz'), al = $('tl-al');
        sz.value = TL.size; al.value = TL.alpha;
        sz.addEventListener('input', function () { TL.size = +sz.value; saveTL(); paintPreviews(); });
        al.addEventListener('input', function () { TL.alpha = +al.value; saveTL(); paintPreviews(); });
        paintPreviews();
    }
    // малюнок екрана телефона (844×390 логічних px) з джойстиками й кнопками розкладки
    function drawLayout(cv, P, opt) {
        var g = cv.getContext('2d'), W = cv.width, H = cv.height, LW = 844, LH = 390, k = W / LW, z = TL.size / 100, a = TL.alpha / 100;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
        // земля
        var gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2d4a2b'); gr.addColorStop(1, '#1f3520'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1; for (var x = 0; x < W; x += 22 * k * 2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (var y = 0; y < H; y += 22 * k * 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
        // зони джойстиків
        var mvLeft = !P.swap;
        g.fillStyle = 'rgba(59,130,246,.10)'; g.fillRect(mvLeft ? 0 : W / 2, 0, W / 2, H);
        g.fillStyle = 'rgba(239,68,68,.08)'; g.fillRect(mvLeft ? W / 2 : 0, 0, W / 2, H);
        g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
        function stick(cx, cy, col, lab) {
            g.beginPath(); g.arc(cx, cy, 60 * k, 0, 6.283); g.fillStyle = 'rgba(255,255,255,.08)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = Math.max(1, 2 * k); g.stroke();
            g.beginPath(); g.arc(cx + 14 * k, cy - 10 * k, 30 * k, 0, 6.283); g.fillStyle = col; g.fill();
            if (opt.labels) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = '700 ' + Math.round(13 * k * 1.6) + 'px Arial'; g.textAlign = 'center'; g.fillText(lab, cx < W / 2 ? W / 4 : W * 0.75, H * 0.42); }      // підпис — у центрі своєї половини (не під кнопками)
        }
        var lx = W * 0.2, rx = W * 0.8, sy = H * 0.66;
        stick(mvLeft ? lx : rx, sy, 'rgba(59,130,246,.55)', tt('РУХ'));
        stick(mvLeft ? rx : lx, sy, 'rgba(239,68,68,.5)', tt('ПРИЦІЛ · ПОСТРІЛ'));
        // міні-мапа (верхній лівий кут) і табло
        g.beginPath(); g.arc((10 + 52) * k, (48 + 52) * k, 52 * k, 0, 6.283); g.fillStyle = 'rgba(2,6,23,.6)'; g.fill(); g.strokeStyle = 'rgba(96,165,250,.6)'; g.lineWidth = Math.max(1, 2 * k); g.stroke();
        g.fillStyle = 'rgba(15,23,42,.8)'; g.fillRect(W - 140 * k, 8 * k, 130 * k, 60 * k);
        g.fillStyle = 'rgba(15,23,42,.8)'; g.fillRect(8 * k, 8 * k, 70 * k, 30 * k);
        // кнопки
        Object.keys(BTN).forEach(function (key) {
            var q = P.b[key], s = BTN[key].sz * z, cx = q.side === 'l' ? q.s + s / 2 : LW - q.s - s / 2, cy = LH - (q.p / 100 * LH + q.y + s / 2);
            g.globalAlpha = a;
            g.beginPath(); g.arc(cx * k, cy * k, s / 2 * k, 0, 6.283);
            var rg = g.createRadialGradient(cx * k, (cy - s * 0.12) * k, 1, cx * k, cy * k, s / 2 * k); rg.addColorStop(0, key === 'ab' ? 'rgba(99,102,241,.95)' : key === 'dash' ? 'rgba(56,189,248,.85)' : 'rgba(139,92,246,.85)'); rg.addColorStop(1, 'rgba(8,12,30,.95)');
            g.fillStyle = rg; g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = Math.max(1, 2 * k); g.stroke();
            g.globalAlpha = 1; g.font = Math.round(s * 0.45 * k) + 'px "Segoe UI Emoji",Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(BTN[key].e, cx * k, cy * k + 1);
            g.textBaseline = 'alphabetic';
        });
        if (opt.border) { g.strokeStyle = 'rgba(148,163,184,.5)'; g.lineWidth = 2; g.strokeRect(1, 1, W - 2, H - 2); }
    }
    function paintBig() {
        var big = $('tl-big'); if (!big) return; var P = preset(hoverP || TL.preset);
        drawLayout(big, P, { labels: true });
        var d = $('tl-desc'); if (d) d.textContent = (hoverP && hoverP !== TL.preset ? tt('Перегляд') + ': ' : '') + tt(P.n) + ' — ' + tt(P.d);
    }
    function paintPreviews() {
        if (ctlMode !== 'touch' || !built) return;
        panes.ctl.querySelectorAll('.tl-card').forEach(function (c) { c.classList.toggle('on', c.dataset.p === TL.preset); drawLayout(c.querySelector('canvas'), preset(c.dataset.p), {}); });
        var sv = $('tl-sz-v'), av = $('tl-al-v'); if (sv) sv.textContent = TL.size + '%'; if (av) av.textContent = TL.alpha + '%';
        paintBig();
    }

    function init() { build(); setTimeout(organize, 120); setTimeout(organize, 600); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
