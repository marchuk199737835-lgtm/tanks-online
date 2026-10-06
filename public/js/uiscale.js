// Адаптивний масштаб інтерфейсу меню (головне меню, сесії, ангар, постачання, апгрейдор, лобі, вікна).
// Інтерфейс малюється як на "ідеальному" екрані, а потім пропорційно збільшується/зменшується (CSS zoom),
// тож кнопки не розтягуються на великих моніторах, а стають більшими; на телефонах підлаштовується під розмір екрана.
(function () {
    var root = document.documentElement;
    var canZoom = !!(window.CSS && CSS.supports && CSS.supports('zoom', '1.5'));
    function bp(w) { return w >= 1280 ? 1280 : w >= 1024 ? 1024 : w >= 768 ? 768 : w >= 640 ? 640 : 0; }
    // пристрій із дотиком (планшет/телефон): ПК-розкладку (lg:) вимкнено в index.html, тож тут завжди "телефонний" розрахунок
    var touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches);
    function calc() {
        var w = window.innerWidth, h = window.innerHeight, z;
        if (w >= 1024 && !touch) z = Math.min(w / 1280, h / 720);            // комп'ютер / планшет-ландшафт
        else if (w > h) z = Math.min(w / 800, h / 410);            // телефон горизонтально
        else z = Math.min(w / 390, h / 780);                        // телефон вертикально / планшет
        var b = bp(w); if (touch && b > 768) b = 768; if (b) z = Math.min(z, w / b);              // не ламаємо брейкпоінти розкладки Tailwind
        return Math.max(0.6, Math.min(3, z));
    }
    function apply() {
        var z = canZoom ? calc() : 1;
        z = Math.round(z * 1000) / 1000;
        root.style.setProperty('--ui-zoom', z);
        root.style.setProperty('--uvh', (window.innerHeight / 100 / z) + 'px');   // 1vh з урахуванням масштабу
        window.UI_ZOOM = z;
    }
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', function () { setTimeout(apply, 120); });
})();
