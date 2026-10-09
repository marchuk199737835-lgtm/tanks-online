/* quickplay.js — «Швидка гра»: одна кнопка → гравець потрапляє в уже існуюче лобі (з людьми або ботами), з обраним кольором/командою й «готовий».
 * Нових кімнат не створює (сервер: socket 'quickPlay' → 'quickPlayResult'). Також ставить картки «Швидка гра» й «Рейтинговий режим» першими в меню. */
(function () {
    'use strict';
    var busy = false, bt = null;
    function go() {
        if (busy) return; busy = true; setBusy(true);
        try { if (typeof playSound === 'function') playSound('ui_buy'); } catch (e) {}
        socket.emit('quickPlay');
        clearTimeout(bt); bt = setTimeout(function () { busy = false; setBusy(false); }, 6000);
    }
    function setBusy(on) { var c = document.getElementById('mm-quick'); if (c) { c.classList.toggle('qp-busy', on); var p = c.querySelector('p'); if (p) p.textContent = on ? 'Шукаємо лобі…' : 'Одразу в бій'; } }
    socket.on('quickPlayResult', function (d) {
        busy = false; clearTimeout(bt); setBusy(false);
        if (!d) return;
        if (!d.ok && window.uiDialog) uiDialog.show({ kind: 'info', icon: '⚡', title: 'Швидка гра', text: d.msg || 'Зараз немає відкритих лобі', buttons: [{ t: 'Закрити', cls: 'ghost' }, { t: 'До сесій', cls: 'primary', cb: function () { showScreen('room-browser-screen'); } }] });
        else if (d.ok && window.uiToast) uiToast('⚡ Ви в лобі! Бій почнеться, щойно всі будуть готові');
    });
    var css = document.createElement('style'); css.id = 'qp-css';
    css.textContent = '#mm-quick{--c:132,204,22}#mm-quick .mm-card-ico{animation:qpBolt 1.6s ease-in-out infinite}@keyframes qpBolt{50%{transform:scale(1.12) rotate(-6deg)}}html.gfx-low #mm-quick .mm-card-ico{animation:none}#mm-quick.qp-busy{opacity:.7;pointer-events:none}';
    document.head.appendChild(css);
    function order() {
        var n = document.querySelector('#main-menu-screen .mm-grid-nav'); if (!n) return;
        var q = document.getElementById('mm-quick'), r = document.getElementById('mm-ranked');
        if (r && n.firstChild !== r && (!q || q.nextSibling !== r)) n.insertBefore(r, n.firstChild);
        if (q && n.firstChild !== q) n.insertBefore(q, n.firstChild);
    }
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-quick', icon: '⚡', title: 'ШВИДКА ГРА', sub: 'Одразу в бій', color: 'lime', bg: '🎯', onClick: go });
    if (window.MenuHub) MenuHub.ready(function () { order(); var n = document.querySelector('#main-menu-screen .mm-grid-nav'); if (n && window.MutationObserver) new MutationObserver(function () { order(); }).observe(n, { childList: true }); });
    window.QuickPlay = { go: go };
})();
