/* tutorial.js — навчання новачка (клієнт). Стан приходить із сервера (tutorial.js у корені): tour → promo → case → equip → play → done.
 *  • tour: огляд усіх кнопок головного меню (коротко: що це й навіщо), «Далі» / «Пропустити навчання»;
 *  • promo: гаманець → промокод START (+200 кредитів);  • case: «Постачання» → найдешевший кейс;
 *  • equip: ангар → модуль із рюкзака → «Одягнути»;      • play: «Швидка гра» → зіграти один бій;  • done: вітання.
 * Підсвічування — 4 затемнені блоки довкола цілі (клік проходить лише в ціль), без canvas і важких ефектів; оновлення 4 рази/с. */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var vis = function (el) { if (!el) return false; if (el.hidden || el.classList.contains('hidden')) return false; var r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
    var screenOn = function (id) { var e = $(id); return !!e && !e.classList.contains('hidden'); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var css = '.tut-blk{position:fixed;z-index:9500;background:rgba(2,6,23,.82);pointer-events:auto;transition:all .18s ease-out}' +
        '.tut-ring{position:fixed;z-index:9501;pointer-events:none;border-radius:16px;border:3px solid #fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,.25),0 0 26px rgba(251,191,36,.7);transition:all .18s ease-out;animation:tutPulse 1.5s ease-in-out infinite}' +
        '@keyframes tutPulse{50%{box-shadow:0 0 0 8px rgba(251,191,36,.12),0 0 34px rgba(251,191,36,.9)}}html.gfx-low .tut-ring{animation:none}' +
        '.tut-tip{position:fixed;z-index:9502;width:min(340px,calc(100vw - 20px));padding:14px 14px 12px;border-radius:16px;background:linear-gradient(160deg,#1e2a5e,#0b1230);border:1px solid rgba(251,191,36,.6);box-shadow:0 14px 40px rgba(0,0,0,.6);color:#e2e8f0;transition:top .18s,left .18s}' +
        '.tut-tip h4{margin:0 0 6px;font:400 15px/1.15 "Russo One",Arial;letter-spacing:.08em;color:#fde68a}.tut-tip p{margin:0;font-size:13px;line-height:1.45}.tut-tip p b{color:#fff}' +
        '.tut-row{display:flex;align-items:center;gap:8px;margin-top:10px}.tut-row .sp{flex:1}.tut-skip{background:none;border:0;color:#94a3b8;font-size:11.5px;text-decoration:underline;cursor:pointer;padding:6px 2px}' +
        '.tut-next{padding:9px 16px;border-radius:11px;border:0;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;font:400 13px/1 "Russo One",Arial;letter-spacing:.06em;cursor:pointer;min-height:40px}' +
        '.tut-step{font-size:11px;color:#94a3b8}.tut-tip.center{left:50%!important;top:50%!important;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 24px));text-align:center;padding:20px}.tut-tip.center h4{font-size:20px}.tut-tip.center .tut-row{justify-content:center}' +
        '.tut-tip.bar{left:50%!important;top:calc(env(safe-area-inset-top,0px) + 62px)!important;bottom:auto;transform:translateX(-50%);width:min(520px,calc(100vw - 20px));padding:10px 12px;opacity:.96}.tut-tip.bar .tut-row{margin-top:4px}' +
        '.tut-big{font-size:42px;line-height:1;margin-bottom:8px}';
    var se = document.createElement('style'); se.id = 'tut-css'; se.textContent = css; document.head.appendChild(se);

    var TOUR = [
        { c: true, icon: '🎖️', t: 'Ласкаво просимо, командире!', p: 'Коротко покажемо, що де є. Це хвилина — а наприкінці отримаєте <b>200 кредитів</b> на старт.' },
        { s: '#mm-quick', t: 'ШВИДКА ГРА', p: 'Одна кнопка — і ви вже в лобі з іншими гравцями. Найшвидший шлях у бій.' },
        { s: '#mm-ranked', t: 'РЕЙТИНГОВИЙ РЕЖИМ', p: 'Бої <b>1×1, 2×2 і 5×5</b> за ранги від Бронзи до Абсолюту. Наприкінці сезону — нагороди за лігу.' },
        { s: '#nav-sessions-btn', t: 'СЕСІЇ', p: 'Усі бої гравців. Приєднуйтесь до будь-якого або створіть власну сесію з потрібним режимом і мапою.' },
        { s: '#nav-hangar-btn', t: 'АНГАР', p: 'Ваш танк і рюкзак. Модулі посилюють броню, шкоду, швидкість і перезарядку.' },
        { s: '#nav-shop-btn', t: 'ПОСТАЧАННЯ', p: 'Кейси з модулями за креди. Що дорожчий кейс — то вищий шанс на рідкісні модулі.' },
        { s: '#nav-upgrader-btn', t: 'АПГРЕЙДОР', p: 'Обміняйте модуль на кращий: обираєте ціль і бачите шанс успіху.' },
        { s: '#mm-progress', t: 'ЗАВДАННЯ', p: 'Щоденний бонус, завдання й досягнення. Заходьте щодня — нагороди ростуть.' },
        { s: '#mm-clans', t: 'КЛАНИ', p: 'Обʼєднуйтесь з гравцями, заробляйте очки клану й змагайтесь у рейтингу кланів.' },
        { s: '#mm-profile-card', t: 'ПРОФІЛЬ', p: 'Ваша статистика, танк, імʼя та налаштування акаунта.' },
        { s: '#mm-rating-card', t: 'РЕЙТИНГ', p: 'Сезонні таблиці найкращих гравців за вбивствами й перемогами.' },
        { s: '#mm-referral', t: 'ЗАПРОСИ ДРУГА', p: 'Запрошуйте друзів за посиланням і отримуйте креди та кейси, коли вони ростуть у рівнях.' },
        { s: '#sc-top', t: 'ДРУЗІ', p: 'Список друзів, запрошення в бій і приватні повідомлення.' },
        { s: '#menu-lv', t: 'РІВЕНЬ', p: 'Досвід за кожен бій. Новий рівень — нова нагорода.' },
        { s: '#mm-music-btn', t: 'МУЗИКА', p: 'Автори та ліцензії музики гри.' },
        { s: '#main-menu-screen .settings-btn', t: 'НАЛАШТУВАННЯ', p: 'Гучність, мова та масштаб інтерфейсу.' }
    ];
    var state = null, ti = 0, timer = null, els = null, lastKey = '', doneShown = false;
    function ensureEls() {
        if (els) return els;
        els = { b: [0, 1, 2, 3].map(function () { var d = document.createElement('div'); d.className = 'tut-blk'; document.body.appendChild(d); return d; }), ring: document.createElement('div'), tip: document.createElement('div') };
        els.ring.className = 'tut-ring'; els.tip.className = 'tut-tip'; document.body.appendChild(els.ring); document.body.appendChild(els.tip);
        els.tip.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            if (b.dataset.a === 'next') { snd('ui_click'); next(); }
            else if (b.dataset.a === 'skip') skip();
            else if (b.dataset.a === 'done') { snd('ui_buy'); stop(); }
        });
        return els;
    }
    function hideAll() { if (!els) return; els.b.forEach(function (d) { d.style.display = 'none'; }); els.ring.style.display = 'none'; els.tip.style.display = 'none'; lastKey = ''; }
    function stop() { clearInterval(timer); timer = null; hideAll(); }
    function skip() {
        var go = function () { socket.emit('tutSkip'); state = 'skip'; stop(); };
        if (window.uiDialog && uiDialog.confirm) uiDialog.confirm({ icon: '🎓', title: 'Пропустити навчання?', text: 'Промокод START на 200 кредитів залишиться доступним у гаманці.', cancelText: 'Продовжити навчання', okText: 'Пропустити' }).then(function (ok) { if (ok) go(); }); else go();
    }
    function next() { ti++; while (ti < TOUR.length && TOUR[ti].s && !vis(document.querySelector(TOUR[ti].s))) ti++; if (ti >= TOUR.length) { socket.emit('tutNext'); ti = 0; } lastKey = ''; tick(); }

    // показ: el — ціль (або null для вікна по центру), mode: 'next' | 'click' | 'bar'
    function show(key, el, o) {
        ensureEls(); var e = els, W = innerWidth, H = innerHeight;
        var tip = e.tip, btns = (o.mode === 'next' ? '<button type="button" class="tut-next" data-a="next">' + (o.last ? 'Почнімо!' : 'Далі') + '</button>' : o.mode === 'done' ? '<button type="button" class="tut-next" data-a="done">Чудово!</button>' : '');
        if (key !== lastKey) {
            lastKey = key;
            tip.className = 'tut-tip' + (!el && o.mode !== 'bar' ? ' center' : '') + (o.mode === 'bar' ? ' bar' : '');
            tip.innerHTML = (o.icon ? '<div class="tut-big">' + o.icon + '</div>' : '') + '<h4>' + esc(o.t) + '</h4><p>' + o.p + '</p><div class="tut-row">' + (o.step ? '<span class="tut-step">' + o.step + '</span>' : '') + '<span class="sp"></span>' + (o.mode !== 'done' ? '<button type="button" class="tut-skip" data-a="skip">Пропустити навчання</button>' : '') + btns + '</div>';
            if (o.mode === 'click') snd('ui_click');
        }
        tip.style.display = 'block';
        if (o.mode === 'bar') { e.b.forEach(function (d) { d.style.display = 'none'; }); e.ring.style.display = 'none'; tip.style.left = ''; tip.style.top = ''; return; }
        if (!el) { // по центру з повним затемненням
            e.ring.style.display = 'none'; var b0 = e.b[0]; b0.style.cssText = 'display:block;left:0;top:0;width:' + W + 'px;height:' + H + 'px'; for (var i = 1; i < 4; i++) e.b[i].style.display = 'none'; tip.style.left = ''; tip.style.top = ''; return;
        }
        var r = el.getBoundingClientRect(), pd = 6, x0 = Math.max(0, r.left - pd), y0 = Math.max(0, r.top - pd), x1 = Math.min(W, r.right + pd), y1 = Math.min(H, r.bottom + pd);
        var set = function (d, l, t, w, h) { d.style.display = 'block'; d.style.left = l + 'px'; d.style.top = t + 'px'; d.style.width = Math.max(0, w) + 'px'; d.style.height = Math.max(0, h) + 'px'; };
        set(e.b[0], 0, 0, W, y0); set(e.b[1], 0, y1, W, H - y1); set(e.b[2], 0, y0, x0, y1 - y0); set(e.b[3], x1, y0, W - x1, y1 - y0);
        if (o.mode === 'next') { e.b.forEach(function (d) { d.style.pointerEvents = 'auto'; }); }
        var ring = e.ring; ring.style.display = 'block'; ring.style.left = x0 + 'px'; ring.style.top = y0 + 'px'; ring.style.width = (x1 - x0) + 'px'; ring.style.height = (y1 - y0) + 'px';
        // інформаційний крок: ціль теж не клікабельна (блок поверх неї без затемнення)
        ring.style.pointerEvents = o.mode === 'next' ? 'auto' : 'none';
        var tw = tip.offsetWidth || 320, th = tip.offsetHeight || 140, tx = Math.min(W - tw - 10, Math.max(10, (x0 + x1) / 2 - tw / 2)), ty = y1 + 12;
        if (ty + th > H - 10) ty = y0 - th - 12; if (ty < 10) ty = Math.min(H - th - 10, Math.max(10, (y0 + y1) / 2 - th / 2));
        tip.style.left = tx + 'px'; tip.style.top = ty + 'px';
    }
    var BACKS = { 'hangar-screen': '#hangar-back-btn', 'shop-screen': '#shop-back-btn', 'upgrader-screen': '#upg-back-btn', 'room-browser-screen': '#back-to-menu-btn' };
    function backStep(key, t) { for (var id in BACKS) if (screenOn(id)) { var b = document.querySelector(BACKS[id]); if (vis(b)) { show(key + ':back:' + id, b, { t: t || 'Повернімось у меню', p: 'Натисніть «Назад».', mode: 'click' }); return true; } } return false; }
    function cheapestBtn() {
        var best = null, bp = 1e9; if (typeof CASES === 'undefined') return null;
        Object.keys(CASES).forEach(function (k) { if (CASES[k].price < bp) { bp = CASES[k].price; best = k; } });
        var bs = document.querySelectorAll('#shop-cases-container .sh-buy');
        for (var i = 0; i < bs.length; i++) { var oc = bs[i].getAttribute('onclick') || ''; if (oc.indexOf('buyShopCase(' + best + ',') === 0) return bs[i]; }
        return null;
    }
    function walletOpen() { var w = $('wallet-modal'); return !!w && !w.hidden; }
    function modalOn(id) { var m = $(id); return !!m && !m.classList.contains('hidden'); }

    function tick() {
        if (!state || state === 'skip' || (state === 'done' && doneShown)) { stop(); return; }
        if (screenOn('game-screen') || screenOn('login-screen')) { hideAll(); return; }          // у бою — не заважаємо
        if (window.uiDialog && uiDialog.isOpen && uiDialog.isOpen()) { hideAll(); return; }
        if ($('sound-gate') || $('boot-splash')) { hideAll(); return; }                         // спершу «Увійти в гру» / заставка
        if ($('rk-ov') && $('rk-ov').classList.contains('on')) { hideAll(); return; }
        if (state === 'tour') {
            if (!screenOn('main-menu-screen')) { if (!backStep('tour')) hideAll(); return; }
            var s = TOUR[ti]; if (!s) { ti = 0; s = TOUR[0]; }
            if (s.s && !vis(document.querySelector(s.s))) { next(); return; }
            show('tour' + ti, s.s ? document.querySelector(s.s) : null, { t: s.t, p: s.p, icon: s.icon, mode: 'next', step: (ti + 1) + ' / ' + TOUR.length, last: ti === 0 });
            return;
        }
        if (state === 'promo') {
            if (walletOpen()) {
                var pp = $('wl-p-promo'); if (pp && pp.hidden && window.Wallet) Wallet.setTab('promo');
                var box = document.querySelector('#wl-p-promo .wl-inp');
                if (vis(box)) { show('promo:inp', box, { t: 'ПРОМОКОД', p: 'Введіть промокод <b>START</b> і натисніть «Активувати» — отримаєте <b>200 кредитів</b>.', mode: 'click' }); return; }
                hideAll(); return;
            }
            if (!screenOn('main-menu-screen')) { if (!backStep('promo')) hideAll(); return; }
            var pill = document.querySelector('#main-menu-screen .mm-pill');
            if (vis(pill)) show('promo:pill', pill, { t: 'ГАМАНЕЦЬ', p: 'Тут ваші креди та промокоди. Натисніть на гаманець.', mode: 'click' }); else hideAll();
            return;
        }
        if (state === 'case') {
            if (walletOpen() && window.Wallet) { Wallet.close(); hideAll(); return; }
            if (modalOn('roulette-modal')) { hideAll(); return; }
            if (screenOn('shop-screen')) {
                if (modalOn('case-confirm-modal')) { show('case:confirm', $('confirm-case-btn'), { t: 'ВІДКРИВАЄМО', p: 'Підтвердіть відкриття кейса.', mode: 'click' }); return; }
                var cb = cheapestBtn(); if (cb && vis(cb)) { cb.scrollIntoView({ block: 'nearest' }); show('case:buy', cb, { t: 'ПЕРШИЙ КЕЙС', p: 'Це найдешевший кейс. Відкрийте його — модуль одразу потрапить у ваш рюкзак.', mode: 'click' }); } else hideAll();
                return;
            }
            if (screenOn('main-menu-screen')) { show('case:nav', $('nav-shop-btn'), { t: 'ПОСТАЧАННЯ', p: 'Креди вже на рахунку! Перейдімо по перший кейс.', mode: 'click' }); return; }
            if (!backStep('case')) hideAll(); return;
        }
        if (state === 'equip') {
            if (modalOn('roulette-modal')) { hideAll(); return; }
            if (modalOn('reward-modal')) { show('eq:rw', $('close-reward-btn'), { t: 'МОДУЛЬ ВАШ!', p: 'Закрийте вікно — далі вдягнемо модуль на танк.', mode: 'click' }); return; }
            if (screenOn('hangar-screen')) {
                var cm = $('context-menu');
                if (cm && !cm.classList.contains('hidden') && vis($('ctx-equip'))) { show('eq:ctx', $('ctx-equip'), { t: 'ВДЯГНУТИ', p: 'Натисніть «Одягнути».', mode: 'click' }); return; }
                var slot = document.querySelector('#inventory-grid .inv-slot:not(.empty)');
                if (vis(slot)) { show('eq:slot', slot, { t: 'РЮКЗАК', p: 'Натисніть на модуль у рюкзаку.', mode: 'click' }); return; }
                hideAll(); return;
            }
            if (screenOn('main-menu-screen')) { show('eq:nav', $('nav-hangar-btn'), { t: 'АНГАР', p: 'Тепер вдягнемо модуль. Перейдіть в ангар.', mode: 'click' }); return; }
            if (!backStep('equip', 'До меню')) hideAll(); return;
        }
        if (state === 'play') {
            if (screenOn('lobby-screen')) {
                var me = typeof currentRoomData !== 'undefined' && currentRoomData && currentRoomData.players ? currentRoomData.players[myId] : null;
                show('play:lobby' + (me && me.ready ? 'r' : ''), null, { t: 'ВИ В ЛОБІ', p: me && me.ready ? 'Бій почнеться, щойно всі будуть готові. Зіграйте свій перший бій!' : 'Оберіть камуфляж або команду й натисніть «Підтвердити».', mode: 'bar' });
                return;
            }
            if (screenOn('main-menu-screen')) { var q = $('mm-quick'); if (vis(q)) show('play:quick', q, { t: 'У БІЙ!', p: 'Танк готовий. Натисніть <b>ШВИДКА ГРА</b> й зіграйте свій перший бій!', mode: 'click' }); else hideAll(); return; }
            if (!backStep('play', 'До меню')) hideAll(); return;
        }
        if (state === 'done') {
            if (!screenOn('main-menu-screen') && !screenOn('lobby-screen')) { hideAll(); return; }
            doneShown = true; try { localStorage.setItem('tutDone', '1'); } catch (e) {}
            show('done', null, { icon: '🏆', t: 'Навчання завершено!', p: 'Ви знаєте все необхідне. Відкривайте кейси, піднімайте рівень і пробуйте рейтинговий режим. Удачі на полі бою, командире!', mode: 'done' });
            clearInterval(timer); timer = null;
        }
    }
    function start() { if (!timer) timer = setInterval(tick, 250); tick(); }
    socket.on('tutState', function (d) {
        var s = d && d.s; if (!s) return;
        if (s === 'done' && state && state !== 'done') { state = 'done'; doneShown = false; start(); return; }
        if (s === 'done' || s === 'skip') { state = s; if (s === 'skip') stop(); return; }
        if (state === 'promo' && s === 'case' && window.uiToast) uiToast('🎉 +200 кредитів! Тепер відкриємо кейс');
        state = s; lastKey = ''; start();
    });
    socket.on('promoResult', function (r) { if (state === 'promo' && r && !r.ok && /використано/i.test(r.msg || '')) socket.emit('tutPromoUsed'); });
    window.addEventListener('resize', function () { lastKey = ''; if (timer) tick(); });
    window.Tutorial = { start: function () { socket.emit('tutGet'); }, state: function () { return state; } };
    try { socket.emit('tutGet'); } catch (e) {}
})();
