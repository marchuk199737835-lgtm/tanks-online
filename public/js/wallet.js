// ===== КРЕДИ: іконка валюти + вікно «Гаманець» (як заробити / промокод) =====
// Внутрішнє поле валюти в коді та БД лишається `bucks`; тут лише видима частина.
//  creditIcon(size)        -> HTML-рядок inline-SVG іконки (для innerHTML у ui.js / network.js / lobby.js ...)
//  creditAmount(n, size)   -> '<іконка> n'
//  <em class="cr-slot" data-cr="18"></em> у статичному HTML автоматично заповнюється іконкою.
//  Wallet.open('earn'|'promo'), Wallet.close(), Wallet.refresh(), Wallet.onPromoResult(res)
(function () {
    'use strict';
    var SVGNS = 'http://www.w3.org/2000/svg';
    var tr = function (s) { return (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

    // ---------- Іконка: гранований кристал у золотому шестикутному чипі ----------
    // Градієнти й clipPath живуть в одному прихованому спрайті (не display:none — інакше градієнти не працюють у частини браузерів).
    var DEFS = '<svg id="cr-defs" width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>' +
        '<linearGradient id="cr-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6c2"/><stop offset=".32" stop-color="#fbbf24"/><stop offset=".7" stop-color="#d97706"/><stop offset="1" stop-color="#8a3d06"/></linearGradient>' +
        '<linearGradient id="cr-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#14465a"/><stop offset="1" stop-color="#06121d"/></linearGradient>' +
        '<linearGradient id="cr-gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0fdff"/><stop offset=".45" stop-color="#67e8f9"/><stop offset="1" stop-color="#06b6d4"/></linearGradient>' +
        '<linearGradient id="cr-gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22b8d6"/><stop offset="1" stop-color="#134e66"/></linearGradient>' +
        '<linearGradient id="cr-sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
        '<clipPath id="cr-clip"><path d="M16 2.6L27.6 9.3V22.7L16 29.4L4.4 22.7V9.3Z"/></clipPath></defs></svg>';
    var BODY = '<path d="M16 2.6L27.6 9.3V22.7L16 29.4L4.4 22.7V9.3Z" fill="url(#cr-rim)" stroke="url(#cr-rim)" stroke-width="2" stroke-linejoin="round"/>' +
        '<path d="M16 2.6L4.4 9.3" stroke="#fff" stroke-opacity=".75" stroke-width="1.1" stroke-linecap="round" fill="none"/>' +
        '<path d="M16 5.7L24.8 10.8V21.2L16 26.3L7.2 21.2V10.8Z" fill="url(#cr-face)" stroke="#6b2d04" stroke-opacity=".6" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M16 9.3L10 16L16 22.7Z" fill="url(#cr-gl)"/><path d="M16 9.3L22 16L16 22.7Z" fill="url(#cr-gr)"/>' +
        '<path d="M16 9.3L10 16H14.2Z" fill="#fff" fill-opacity=".55"/><path d="M10 16H22" stroke="#fff" stroke-opacity=".35" stroke-width=".7"/>' +
        '<g clip-path="url(#cr-clip)"><g class="cr-sh"><rect x="-13" y="-2" width="7" height="36" fill="url(#cr-sg)" transform="skewX(-20)"/></g></g>' +
        '<path class="cr-sp" d="M25.6 2.2Q26 5.2 29 5.6Q26 6 25.6 9Q25.2 6 22.2 5.6Q25.2 5.2 25.6 2.2Z" fill="#fff"/>';
    function ensureDefs() {
        if (document.getElementById('cr-defs') || !document.body) return;
        var d = document.createElement('div'); d.innerHTML = DEFS; document.body.insertBefore(d.firstChild, document.body.firstChild);
    }
    window.creditIcon = function (size) {
        size = size || 16;
        return '<svg class="cr-ico" width="' + size + '" height="' + size + '" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' + BODY + '</svg>';
    };
    window.creditAmount = function (n, size) { return window.creditIcon(size || 14) + ' ' + n; };

    function hydrate(root) {
        ensureDefs();
        var els = (root || document).querySelectorAll('.cr-slot:not([data-done])');
        for (var i = 0; i < els.length; i++) { els[i].setAttribute('data-done', '1'); els[i].innerHTML = creditIcon(+els[i].getAttribute('data-cr') || 16); }
        var pills = (root || document).querySelectorAll('.mm-pill');
        for (var j = 0; j < pills.length; j++) {
            var p = pills[j]; if (p.getAttribute('data-wl') || !p.querySelector('.global-bucks-display')) continue;
            p.setAttribute('data-wl', '1'); p.setAttribute('role', 'button'); p.setAttribute('tabindex', '0'); p.setAttribute('aria-haspopup', 'dialog');
            p.setAttribute('aria-label', 'Гаманець: баланс, як заробити, промокод');
            p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Wallet.open(); } });
        }
    }

    // ---------- Дані для вкладки «Як заробити» (усе береться з коду гри) ----------
    function rng(a, b) { return a === b ? '' + a : a + '–' + b; }
    function earnHtml() {
        var MI = window.ModeInfo, G = window.GameData, h = '';
        var ico = function (n) { return creditIcon(n || 14); };
        var row = function (e, name, note, val) {
            return '<div class="wl-row"><i class="wl-e">' + e + '</i><div class="wl-t"><b>' + esc(name) + '</b>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div><span class="wl-v">' + val + '</span></div>';
        };
        var val = function (t) { return '<em>' + esc(t) + '</em>' + ico(14); };
        if (MI) {
            h += '<h4 class="wl-h">Нагороди за бій</h4><p class="wl-n">Вказано для стандартних налаштувань сесії. Вища складність і довші бої дають більше.</p>';
            MI.GROUPS.forEach(function (g) {
                var ms = MI.ORDER.filter(function (m) { return MI.MODES[m] && MI.MODES[m].kind === g.k; });
                if (!ms.length) return;
                h += '<div class="wl-g">' + esc(g.n) + '</div>';
                ms.forEach(function (m) {
                    var md = MI.MODES[m], t, note = '';
                    if (m === 'survival') { t = '+1'; note = 'за кожну пережиту хвилю'; }
                    else { var rr = MI.rewardRange(m, {}); t = rng(rr.loss, rr.win); }
                    h += row(md.e, md.sn, note, val(t));
                });
            });
        }
        if (G) {
            var by = {}; Object.keys(G.MODULES).forEach(function (k) { var m = G.MODULES[k]; var b = by[m.rarity] || (by[m.rarity] = [1e9, 0]); b[0] = Math.min(b[0], m.price); b[1] = Math.max(b[1], m.price); });
            h += '<h4 class="wl-h">Продаж модулів</h4><p class="wl-n">Непотрібний модуль можна продати в інвентарі за його ціну.</p><div class="wl-chips">';
            G.RARITY_ORDER.forEach(function (r) {
                if (!by[r]) return;
                h += '<div class="wl-chip" style="--rc:' + G.RARITY[r].color + '"><span>' + esc(G.RARITY[r].name) + '</span><b>' + rng(by[r][0], by[r][1]) + ico(13) + '</b></div>';
            });
            h += '</div>';
            h += '<h4 class="wl-h">Інші способи</h4>';
            h += row('🎁', 'Дроп після бою', 'Шанс отримати модуль після кожного бою — його можна продати', '<em>' + Math.round(G.DROP_CHANCE * 100) + '%</em>');
            // формула адвенту — та сама, що в server.js (claimAdvent) та ui.js (renderAdvent): 20 + (день − 3) × 5, дні 3..30
            h += row('🎃', 'Адвент-календар', 'Щодня в жовтні: що далі день, то більша нагорода', val(rng(20, 20 + (30 - 3) * 5)));
            h += row('⭐', 'Нагороди за рівні', 'Кейс за кожен новий рівень — у ньому модулі на продаж', '<em>×' + (G.MAX_LEVEL - 1) + '</em>');
        }
        h += '<div class="wl-row wl-go"><i class="wl-e">🎟️</i><div class="wl-t"><b>Промокоди</b><small>Є код? Активуйте його й отримайте креди</small></div><button type="button" class="wl-mini" data-wl-go="promo">Ввести код</button></div>';
        return h;
    }

    // ---------- Вікно ----------
    var root = null, lastFocus = null, tab = 'earn', busy = false, busyT = 0, built = false;

    function build() {
        if (built) return; built = true; ensureDefs();
        root = document.createElement('div'); root.id = 'wallet-modal'; root.className = 'wl-back'; root.hidden = true;
        root.innerHTML =
            '<div class="wl-box" role="dialog" aria-modal="true" aria-labelledby="wl-title">' +
            '<i class="wl-glow" aria-hidden="true"></i>' +
            '<button type="button" class="wl-x" id="wl-x" aria-label="Закрити">✕</button>' +
            '<header class="wl-hd"><div class="wl-coin" aria-hidden="true">' + creditIcon(46) + '</div><div class="wl-bal"><h3 id="wl-title">Гаманець</h3><small>Ваш баланс</small><b><span id="wl-bal">0</span></b></div></header>' +
            '<div class="wl-tabs" role="tablist" aria-label="Гаманець">' +
            '<button type="button" role="tab" id="wl-t-earn" aria-controls="wl-p-earn" aria-selected="true" data-wl-tab="earn">Як заробити</button>' +
            '<button type="button" role="tab" id="wl-t-promo" aria-controls="wl-p-promo" aria-selected="false" tabindex="-1" data-wl-tab="promo">Промокод</button><i class="wl-ink" aria-hidden="true"></i></div>' +
            '<div class="wl-body">' +
            '<section class="wl-panel" id="wl-p-earn" role="tabpanel" aria-labelledby="wl-t-earn"></section>' +
            '<section class="wl-panel" id="wl-p-promo" role="tabpanel" aria-labelledby="wl-t-promo" hidden>' +
            '<div class="wl-pr"><i class="wl-pr-ico" aria-hidden="true">🎟️</i><p>Введіть промокод і отримайте креди на баланс</p></div>' +
            '<label class="wl-lbl" for="wl-code">Ваш промокод</label>' +
            '<div class="wl-inp"><input id="wl-code" type="text" maxlength="40" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="Введіть промокод" aria-describedby="wl-msg">' +
            '<button type="button" id="wl-go" class="wl-btn">Активувати</button></div>' +
            '<div id="wl-msg" class="wl-msg" role="status" aria-live="polite"></div>' +
            '<p class="wl-n">Регістр літер не має значення. Кожен код можна використати лише один раз на акаунт.</p>' +
            '</section></div></div>';
        document.body.appendChild(root);
        root.addEventListener('pointerdown', function (e) { if (e.target === root) { close(); } });
        root.addEventListener('click', function (e) {
            var t = e.target.closest && e.target.closest('[data-wl-tab],[data-wl-go],#wl-x,#wl-go'); if (!t) return;
            if (t.id === 'wl-x') return close();
            if (t.id === 'wl-go') return submit();
            var k = t.getAttribute('data-wl-tab') || t.getAttribute('data-wl-go'); snd('ui_click'); setTab(k, true);
        });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.id === 'wl-code') { e.preventDefault(); submit(); return; }
            var tb = e.target.getAttribute && e.target.getAttribute('data-wl-tab');
            if (tb && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) { e.preventDefault(); setTab(tb === 'earn' ? 'promo' : 'earn', true); }
        });
        $('wl-code').addEventListener('input', function () { clearMsg(); });
        $('wl-p-earn').innerHTML = earnHtml();
    }

    function setTab(k, focus) {
        tab = k === 'promo' ? 'promo' : 'earn';
        ['earn', 'promo'].forEach(function (n) {
            var on = n === tab, b = $('wl-t-' + n), p = $('wl-p-' + n);
            b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; p.hidden = !on;
            if (on) { p.classList.remove('wl-in'); void p.offsetWidth; p.classList.add('wl-in'); }
        });
        root.querySelector('.wl-tabs').setAttribute('data-on', tab);
        root.querySelector('.wl-body').scrollTop = 0;
        if (focus) { if (tab === 'promo') { var c = $('wl-code'); if (c) setTimeout(function () { c.focus(); }, 30); } else $('wl-t-earn').focus(); }
    }

    function focusables() {
        return Array.prototype.filter.call(root.querySelectorAll('button,input,[href],[tabindex]:not([tabindex="-1"])'), function (el) { return !el.disabled && !el.hidden && el.offsetParent !== null && el.tabIndex >= 0; });
    }
    function onKey(e) {
        if (!root || root.hidden) return;
        var dlg = document.getElementById('dlg'); if (dlg && !dlg.classList.contains('hidden')) return;   // вікно-повідомлення гри зверху — воно закривається першим
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Tab') {
            var f = focusables(); if (!f.length) return;
            var first = f[0], last = f[f.length - 1];
            if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
            else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
    }
    document.addEventListener('keydown', onKey, true);

    function open(which) {
        build();
        if (!root.hidden) { setTab(which || tab, true); return; }
        lastFocus = document.activeElement;
        $('wl-p-earn').innerHTML = earnHtml();      // перерахунок (дані режимів могли змінитись)
        refresh(); clearMsg(); setBusy(false);
        root.hidden = false; root.classList.remove('wl-out'); void root.offsetWidth; root.classList.add('wl-on');
        setTab(which || 'earn', false);
        setTimeout(function () { var b = (which === 'promo') ? $('wl-code') : $('wl-t-earn'); if (b) b.focus(); }, 40);
        snd('ui_click');
    }
    function close() {
        if (!root || root.hidden) return;
        root.classList.remove('wl-on'); root.classList.add('wl-out');
        var done = function () { root.hidden = true; root.classList.remove('wl-out'); };
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) done(); else setTimeout(done, 160);
        snd('ui_click');
        try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }
    function refresh() {
        var b = $('wl-bal'); if (b && typeof myBucks !== 'undefined') b.textContent = myBucks;
    }

    // ---------- Промокод ----------
    function clearMsg() { var m = $('wl-msg'); if (m) { m.className = 'wl-msg'; m.innerHTML = ''; } }
    function setBusy(v) {
        busy = v; var g = $('wl-go'); if (!g) return; g.disabled = v; g.classList.toggle('busy', v);
        clearTimeout(busyT); if (v) busyT = setTimeout(function () { setBusy(false); showMsg(false, 'Немає відповіді від сервера. Спробуйте ще раз'); }, 7000);
    }
    function showMsg(ok, text, amount) {
        var m = $('wl-msg'); if (!m) return;
        m.className = 'wl-msg ' + (ok ? 'ok' : 'bad'); m.innerHTML = '';
        if (ok && amount != null) { var big = document.createElement('div'); big.className = 'wl-won'; big.innerHTML = '<b>+' + (amount | 0) + '</b>' + creditIcon(26); m.appendChild(big); }
        var s = document.createElement('span'); s.textContent = text; m.appendChild(s);
        m.classList.remove('wl-shake'); void m.offsetWidth; if (!ok) m.classList.add('wl-shake');
    }
    function submit() {
        if (busy) return;
        var inp = $('wl-code'), code = (inp.value || '').trim();
        if (!code) { showMsg(false, 'Введіть промокод'); inp.focus(); return; }
        if (typeof socket === 'undefined' || !socket || !socket.connected) { showMsg(false, 'Немає зв’язку з сервером'); return; }
        snd('ui_click'); clearMsg(); setBusy(true);
        socket.emit('redeemPromo', { code: code });
    }
    function onPromoResult(res) {
        if (!res) return; setBusy(false);
        if (res.ok) {
            snd('ui_buy'); showMsg(true, res.msg || 'Готово', res.amount);
            var inp = $('wl-code'); if (inp) inp.value = '';
            if (typeof res.bucks === 'number') { try { myBucks = res.bucks; } catch (e) {} if (typeof updateGlobalBucks === 'function') updateGlobalBucks(); }
            refresh();
        } else showMsg(false, res.msg || 'Не вдалося активувати промокод');
        if (!root || root.hidden) { if (typeof uiDialog !== 'undefined') uiDialog.show({ kind: res.ok ? 'success' : 'error', icon: res.ok ? '🎁' : '🎟️', title: res.ok ? 'Промокод активовано' : 'Промокод не підійшов', text: res.msg }); }
    }

    var Wallet = window.Wallet = { open: open, close: close, refresh: refresh, onPromoResult: onPromoResult, setTab: function (k) { build(); setTab(k, false); } };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { hydrate(); }); else hydrate();
    // нові елементи з .cr-slot / .mm-pill, що з'явилися пізніше
    window.hydrateCredits = hydrate;
})();
