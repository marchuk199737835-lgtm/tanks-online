// Адаптивний масштаб інтерфейсу меню (головне меню, сесії, ангар, постачання, апгрейдор, лобі, вікна).
// Інтерфейс малюється як на "ідеальному" екрані, а потім пропорційно збільшується/зменшується (CSS zoom),
// тож кнопки не розтягуються на великих моніторах, а стають більшими; на телефонах підлаштовується під розмір екрана.
(function () {
    var root = document.documentElement;
    var canZoom = !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.5'));
    function bp(w) { return w >= 1280 ? 1280 : w >= 1024 ? 1024 : w >= 768 ? 768 : w >= 640 ? 640 : 0; }
    // пристрій із дотиком (планшет/телефон): ПК-розкладку (lg:) вимкнено в index.html, тож тут завжди "телефонний" розрахунок
    var touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    // користувацький множник масштабу меню та інтерфейсу (налаштування «Масштаб інтерфейсу», 70–130%); камера в матчі налаштовується окремо
    var userMul = 1;
    try { var um = parseFloat(localStorage.getItem('uiScale')); if (um >= 0.7 && um <= 1.3) userMul = um; } catch (e) {}
    function calc() {
        var w = window.innerWidth, h = window.innerHeight, z;
        if (w >= 1024 && !touch) z = Math.min(w / 1280, h / 720);            // комп'ютер / планшет-ландшафт
        else if (w > h) z = Math.min(w / 800, h / 410);            // телефон горизонтально
        else z = Math.min(w / 390, h / 780);                        // телефон вертикально / планшет
        z *= userMul;
        var b = bp(w); if (touch && b > 768) b = 768; if (b) z = Math.min(z, w / b);              // не ламаємо брейкпоінти розкладки Tailwind
        return Math.max(0.6, Math.min(3, z));
    }
    var lastW = 0;
    function typing() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
    function apply() {
        // екранна клавіатура зменшує innerHeight (interactive-widget=resizes-content) — масштаб при цьому не перераховуємо, щоб інтерфейс не «стрибав»
        if (lastW === window.innerWidth && typing()) return; lastW = window.innerWidth;
        var z = canZoom ? calc() : 1;
        z = Math.round(z * 1000) / 1000;
        root.style.setProperty('--ui-zoom', z);
        root.style.setProperty('--uvh', (window.innerHeight / 100 / z) + 'px');   // 1vh з урахуванням масштабу
        // масштаб для НОВИХ вікон (завдання, профіль, рейтинг): на телефоні не менше 1 (портрет) / 0.9 (ландшафт), щоб текст не ставав дрібним
        var wz = z;
        if (canZoom && touch) { var fl = (window.innerWidth > window.innerHeight ? 0.9 : 1) * Math.min(1, userMul); if (wz < fl) wz = fl; }
        wz = Math.round(wz * 1000) / 1000;
        root.style.setProperty('--ui-wz', wz);
        root.style.setProperty('--uvh-w', (window.innerHeight / 100 / wz) + 'px');
        window.UI_ZOOM = z;
    }
    apply();
    window.getUiScale = function () { return userMul; };
    window.setUiScale = function (m) { userMul = Math.max(0.7, Math.min(1.3, m)); try { localStorage.setItem('uiScale', String(userMul)); } catch (e) {} apply(); if (window.fitCanvas) window.fitCanvas(); };
    window.addEventListener('resize', apply);
    // поле вводу у вікнах (друзі, клани, профіль, чат…) не повинне ховатися під екранною клавіатурою
    document.addEventListener('focusin', function (e) {
        var t = e.target; if (!t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || !t.closest || !t.closest('.pg-back,.pf-ov,#sc-ov,.cl-ov,.dlg,.modal,.wl-back')) return;
        setTimeout(function () { try { t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (x) {} }, 320);
    });
    if (window.visualViewport) window.visualViewport.addEventListener('resize', function () {
        var t = document.activeElement; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName) && t.closest && t.closest('.pg-back,.pf-ov,#sc-ov,.cl-ov,.dlg,.modal,.wl-back')) setTimeout(function () { try { t.scrollIntoView({ block: 'center' }); } catch (x) {} }, 60);
    });
    window.addEventListener('orientationchange', function () { setTimeout(apply, 120); });
})();
