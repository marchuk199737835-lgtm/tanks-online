// ===== Встановлення гри як додатка (PWA): повний екран без інтерфейсу браузера =====
// Android/Chrome: системне вікно встановлення. iPhone/iPad: покрокова підказка «Поділитись → На початковий екран».
(function () {
    const tr = s => (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s);
    const ua = navigator.userAgent || '';
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = () => (window.matchMedia && (matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches)) || navigator.standalone === true;
    const isMobile = isIOS || /Android/i.test(ua) || (matchMedia && matchMedia('(pointer:coarse)').matches);
    const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
    let deferred = null;

    if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; refresh(); });
    window.addEventListener('appinstalled', () => { deferred = null; store.set('pwaInstalled', '1'); refresh(); });

    const canInstall = () => !standalone() && isMobile && (isIOS || !!deferred);

    function iosGuide() {
        let g = document.getElementById('pwa-guide'); if (g) g.remove();
        g = document.createElement('div'); g.id = 'pwa-guide'; g.className = 'dlg';
        const share = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
        const step = (n, t, ic) => '<div class="pwa-st"><b>' + n + '</b><span>' + t + '</span><i>' + (ic || '') + '</i></div>';
        g.innerHTML = '<div class="dlg-box" style="--c:59,130,246"><i class="dlg-ico">📲</i><h3 class="dlg-t">' + tr('Встановіть гру на телефон') + '</h3>' +
            '<p class="dlg-p">' + tr('Так гра відкриватиметься на весь екран, без адресного рядка й кнопок браузера') + '</p>' +
            '<div class="pwa-steps">' + step(1, tr('Натисніть «Поділитись» внизу (або вгорі) екрана Safari'), share) +
            step(2, tr('Оберіть «На початковий екран»'), '➕') + step(3, tr('Натисніть «Додати» і запускайте гру з іконки'), '🎮') + '</div>' +
            '<div class="dlg-btns"><button type="button" class="dlg-b primary">' + tr('Зрозуміло') + '</button></div></div>';
        document.body.appendChild(g);
        const done = () => g.remove();
        g.querySelector('button').addEventListener('click', done);
        g.addEventListener('pointerdown', e => { if (e.target === g) done(); });
    }
    function install() {
        if (isIOS) return iosGuide();
        if (!deferred) return;
        deferred.prompt(); deferred.userChoice.then(() => { deferred = null; refresh(); }).catch(() => {});
    }
    window.installApp = install;

    // кнопка у головному меню та в налаштуваннях
    let pill = null;
    function mk() {
        pill = document.createElement('button'); pill.type = 'button'; pill.id = 'pwa-install'; pill.className = 'pwa-pill hidden';
        pill.innerHTML = '<span>📲</span><b>' + tr('Грати на весь екран') + '</b><small>' + tr('Встановити гру') + '</small><u role="button" aria-label="x">✕</u>';
        pill.addEventListener('click', e => {
            if (e.target.tagName === 'U') { store.set('pwaHide', String(Date.now())); refresh(); e.stopPropagation(); return; }
            install();
        });
        document.body.appendChild(pill);
    }
    function refresh() {
        if (!pill) mk();
        const menu = document.getElementById('main-menu-screen');
        const hiddenRecently = Date.now() - (+store.get('pwaHide') || 0) < 3 * 24 * 3600 * 1000;
        const show = canInstall() && menu && !menu.classList.contains('hidden') && !hiddenRecently;
        pill.classList.toggle('hidden', !show);
        const sb = document.getElementById('settings-install-btn');
        if (sb) sb.style.display = canInstall() ? '' : 'none';
    }
    function wire() {
        const sb = document.getElementById('settings-install-btn');
        if (sb) sb.addEventListener('click', () => { const m = document.getElementById('settings-modal'); if (m && isIOS) { m.classList.add('hidden'); m.classList.remove('flex'); } install(); });
        refresh(); setInterval(refresh, 1000);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
