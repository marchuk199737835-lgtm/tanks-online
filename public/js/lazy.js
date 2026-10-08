/* lazy.js — ліниве підвантаження великих розділів меню (progress.js ≈ 50 КБ, clans.js ≈ 88 КБ) без етапу збірки.
 *
 * Як працює:
 *  1. На старті замість двох скриптів вантажиться цей маленький файл: він ставить у меню «картки-заглушки» (ті самі id, що й у справжніх карток)
 *     і підписується на серверні події цих розділів, складаючи їх у буфер (щоб не загубити нічого, що прийде до завантаження коду).
 *  2. Код розділу підвантажується: (а) після входу, коли браузер вільний (requestIdleCallback) — на звичайному інтернеті;
 *     (б) одразу при першому натисканні на картку; (в) на економному зв'язку (saveData / 2g / 3g) — ТІЛЬКИ за натисканням.
 *  3. Коли модуль виконався, його обробники подій (які він сам зареєстрував через socket.on) отримують накопичені події,
 *     а справжня картка меню стає на місце заглушки (без стрибків у сітці). Контракти модулів (MenuHub, socket.on, window.Progress/Clans) не змінюються.
 * Версія URL береться з window.__AV (її вставляє сервер у index.html), тож після деплою завантажується свіжий код. */
(function () {
    'use strict';
    var SLOW = false;
    try { var cn = navigator.connection; SLOW = !!(cn && (cn.saveData || /(^|-)(2g|3g)$/.test(cn.effectiveType || ''))); } catch (e) {}

    var MODS = [
        { id: 'progress', src: 'js/progress.js', re: /^(progress|daily|quest|ach)/,
          ev: ['progressState', 'dailyClaimed', 'questClaimed', 'achClaimed', 'questRerolled', 'questProgress', 'achUnlocked', 'progressError'],
          cards: [{ id: 'mm-progress', icon: '🏅', title: 'ЗАВДАННЯ', sub: 'БОНУС · ЗАВДАННЯ · НАГОРОДИ', color: 'amber', bg: '🎁' }] },
        { id: 'clans', src: 'js/clans.js', re: /^clan/,
          ev: ['clanState', 'clanList', 'clanPeek', 'clanChatMsg', 'clanNotify', 'clanResult'],
          cards: [{ id: 'mm-clans', icon: '🛡️', title: 'КЛАНИ', sub: 'Команди та рейтинг', color: 'amber', bg: '🛡️' }] }
    ];
    var MAXBUF = 40, authed = false, st = {};      // st[id] = { state: 0 нічого | 1 вантажиться | 2 готово, buf: [[ev, args]], waiters: [], failAt }
    MODS.forEach(function (m) { st[m.id] = { state: 0, buf: [], waiters: [], failAt: 0 }; });

    function urlOf(p) { try { if (window.__av) return window.__av(p); } catch (e) {} return p; }
    function modFor(ev) { for (var i = 0; i < MODS.length; i++) if (MODS[i].re.test(ev)) return MODS[i]; return null; }

    // ---------- буфер подій ----------
    function record(ev, args) {
        var m = modFor(ev); if (!m) return; var s = st[m.id]; if (s.state === 2) return;
        s.buf.push([ev, args]); if (s.buf.length > MAXBUF) s.buf.shift();
    }
    function hookSocket() {
        if (typeof socket === 'undefined' || !socket) return false;
        if (typeof socket.onAny === 'function') socket.onAny(function (ev) { record(ev, Array.prototype.slice.call(arguments, 1)); });
        else MODS.forEach(function (m) { m.ev.forEach(function (ev) { socket.on(ev, function () { record(ev, Array.prototype.slice.call(arguments)); }); }); });
        socket.on('authSuccess', function () { authed = true; if (!SLOW) scheduleIdle(); });
        return true;
    }

    // ---------- завантаження ----------
    function load(m, cb) {
        var s = st[m.id]; if (s.state === 2) return cb && cb(true);
        if (cb) s.waiters.push(cb);
        if (s.state === 1) return;
        if (s.failAt && Date.now() - s.failAt < 4000) { var w = s.waiters.splice(0); w.forEach(function (f) { f(false); }); return; }
        s.state = 1; setBusy(m, true);
        // перехоплюємо socket.on на час виконання модуля, щоб знати його обробники
        var caught = [], hadOwn = Object.prototype.hasOwnProperty.call(socket, 'on'), origOn = socket.on;
        socket.on = function (ev, fn) { caught.push([ev, fn]); return origOn.apply(this, arguments); };
        var hub = window.MenuHub, origAdd = hub && hub.addCard;
        if (hub && origAdd) hub.addCard = function (o) {                       // справжня картка заміщує заглушку на тому ж місці
            var ph = o && document.getElementById(o.id);
            if (ph && ph.getAttribute('data-lz')) {
                var parent = ph.parentNode, next = ph.nextSibling; ph.remove(); origAdd.call(hub, o);
                var nn = document.getElementById(o.id); if (nn && parent) parent.insertBefore(nn, next);
            } else origAdd.call(hub, o);
        };
        function restore() {
            if (hadOwn) socket.on = origOn; else delete socket.on;
            if (hub && origAdd) hub.addCard = origAdd;
        }
        var sc = document.createElement('script'); sc.src = urlOf(m.src);
        sc.onload = function () {
            restore();
            s.state = 2; var buf = s.buf; s.buf = [];
            buf.forEach(function (it) { caught.forEach(function (c) { if (c[0] === it[0]) { try { c[1].apply(null, it[1]); } catch (e) { console.error(e); } } }); });
            if (m.id === 'progress' && authed && !buf.some(function (it) { return it[0] === 'progressState'; }) && window.Progress && Progress.refresh) { try { Progress.refresh(); } catch (e) {} }
            setBusy(m, false); var w = s.waiters.splice(0); w.forEach(function (f) { f(true); });
        };
        sc.onerror = function () {
            restore(); sc.remove(); s.state = 0; s.failAt = Date.now(); setBusy(m, false);
            try { if (window.uiToast) uiToast('Не вдалося завантажити розділ. Перевірте зв’язок', true); } catch (e) {}
            var w = s.waiters.splice(0); w.forEach(function (f) { f(false); });
        };
        document.head.appendChild(sc);
    }
    function setBusy(m, on) { m.cards.forEach(function (c) { var el = document.getElementById(c.id); if (el && el.getAttribute('data-lz')) el.classList.toggle('lz-busy', !!on); }); }

    var idleSet = false;
    function scheduleIdle() {
        if (idleSet) return; idleSet = true;
        var run = function () { var i = 0; (function nextMod() { if (i >= MODS.length) return; load(MODS[i++], function () { setTimeout(nextMod, 150); }); })(); };
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 1200);
    }

    // ---------- картки-заглушки ----------
    function init() {
        var css = document.createElement('style'); css.id = 'lazy-css'; css.textContent = '.lz-busy{opacity:.55;cursor:progress;pointer-events:none}'; document.head.appendChild(css);
        if (!hookSocket()) { /* без сокета нічого не відкладаємо */ MODS.forEach(function (m) { load(m); }); return; }
        if (!window.MenuHub) { MODS.forEach(function (m) { load(m); }); return; }
        MODS.forEach(function (m) {
            m.cards.forEach(function (c) {
                MenuHub.addCard({ id: c.id, icon: c.icon, title: c.title, sub: c.sub, color: c.color, bg: c.bg, onClick: function () {
                    load(m, function (ok) { if (!ok) return; var real = document.getElementById(c.id); if (real && !real.getAttribute('data-lz')) real.click(); });
                } });
                var el = document.getElementById(c.id); if (el) el.setAttribute('data-lz', '1');
            });
        });
        // уже авторизовані до цього моменту (малоймовірно, але можливо на повільному пристрої)
        try { if (typeof myName !== 'undefined' && myName && socket.connected) { authed = true; if (!SLOW) scheduleIdle(); } } catch (e) {}
    }
    window.Lazy = { load: function (id) { MODS.forEach(function (m) { if (m.id === id) load(m); }); }, slow: SLOW, state: function () { var o = {}; MODS.forEach(function (m) { o[m.id] = st[m.id].state; }); return o; } };
    init();
})();
