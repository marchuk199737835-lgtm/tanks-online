// ===== Вікна всередині гри замість alert()/confirm() браузера =====
// uiDialog.show({kind,icon,title,text,rows,buttons}), uiDialog.confirm({...}) -> Promise<boolean>, uiDialog.money({price,have}).
// window.alert теж перенаправлено сюди, тож жодне повідомлення гри більше не виглядає як системне вікно браузера.
(function () {
    const KINDS = {
        error:   { c: '239,68,68',  icon: '🚫', title: 'Не вдалося' },
        warn:    { c: '245,158,11', icon: '⚠️', title: 'Увага' },
        success: { c: '16,185,129', icon: '🎉', title: 'Готово' },
        info:    { c: '59,130,246', icon: 'ℹ️', title: 'Повідомлення' },
        money:   { c: '245,158,11', icon: '💸', title: 'Не вистачає кредів' },
        danger:  { c: '239,68,68',  icon: '🚪', title: 'Увага' }
    };
    const tr = s => (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s);
    const snd = n => { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    let el = null, queue = [], cur = null;

    function build() {
        el = document.createElement('div'); el.id = 'dlg'; el.className = 'dlg hidden';
        el.innerHTML = '<div class="dlg-box" role="dialog" aria-modal="true"><i class="dlg-ico"></i><h3 class="dlg-t"></h3><p class="dlg-p"></p><div class="dlg-rows"></div><div class="dlg-btns"></div></div>';
        document.body.appendChild(el);
        el.addEventListener('pointerdown', e => { if (e.target === el && cur && cur.dismissable !== false) close(cur.cancelValue); });
        document.addEventListener('keydown', e => { if (!cur) return; if (e.key === 'Escape' && cur.dismissable !== false) close(cur.cancelValue); else if (e.key === 'Enter') { const b = el.querySelector('.dlg-b.primary, .dlg-b.danger'); if (b) b.click(); } });
    }
    function close(val) {
        if (!cur) return; const c = cur; cur = null; el.classList.add('hidden');
        if (c.onClose) c.onClose(val);
        if (queue.length) setTimeout(() => open(queue.shift()), 60);
    }
    function open(o) {
        if (!el) build();
        const k = KINDS[o.kind] || KINDS.info; cur = o;
        const box = el.querySelector('.dlg-box'); box.style.setProperty('--c', k.c); box.dataset.kind = o.kind || 'info';
        el.querySelector('.dlg-ico').textContent = o.icon || k.icon;
        el.querySelector('.dlg-t').textContent = tr(o.title || k.title);
        const p = el.querySelector('.dlg-p'); p.textContent = o.text ? tr(o.text) : ''; p.style.display = o.text ? '' : 'none';
        const rows = el.querySelector('.dlg-rows'); rows.innerHTML = ''; rows.style.display = o.rows && o.rows.length ? '' : 'none';
        (o.rows || []).forEach(r => { const d = document.createElement('div'); d.className = 'dlg-row' + (r[2] ? ' ' + r[2] : ''); const a = document.createElement('span'), b = document.createElement('b'); a.textContent = tr(r[0]); if (r[3]) b.innerHTML = r[1]; else b.textContent = r[1]; d.appendChild(a); d.appendChild(b); rows.appendChild(d); });
        const btns = el.querySelector('.dlg-btns'); btns.innerHTML = '';
        (o.buttons && o.buttons.length ? o.buttons : [{ t: 'Зрозуміло', cls: 'primary' }]).forEach(b => {
            const x = document.createElement('button'); x.type = 'button'; x.className = 'dlg-b ' + (b.cls || 'ghost'); x.textContent = tr(b.t);
            x.addEventListener('click', () => { snd('ui_click'); close(b.value); if (b.cb) b.cb(); }); btns.appendChild(x);
        });
        el.classList.remove('hidden'); snd(o.kind === 'error' || o.kind === 'money' || o.kind === 'danger' ? 'hurt' : (o.kind === 'success' ? 'powerup' : 'ui_click'));
        const first = btns.querySelector('.primary, .danger') || btns.firstChild; if (first) setTimeout(() => first.focus({ preventScroll: true }), 30);
    }
    function show(o) { o = Object.assign({}, o); if (cur) { queue.push(o); return; } open(o); }
    function confirm(o) {
        return new Promise(res => {
            o = Object.assign({ kind: 'warn', cancelValue: false }, o);
            o.buttons = [{ t: o.cancelText || 'Скасувати', cls: 'ghost', value: false }, { t: o.okText || 'Так', cls: o.danger ? 'danger' : 'primary', value: true }];
            o.onClose = res; show(o);
        });
    }
    function money(o) {
        o = o || {}; const rows = [];
        if (o.price != null) { const cr = n => creditIcon(16) + ' ' + (n | 0); rows.push(['Ціна', cr(o.price), '', 1]); rows.push(['Ваш баланс', cr(o.have || 0), '', 1]); rows.push(['Бракує', cr(Math.max(0, o.price - (o.have || 0))), 'bad', 1]); }
        show({ kind: 'money', title: 'Не вистачає кредів', text: o.text || 'Заробляйте креди в боях і в адвенті, продавайте зайві модулі або активуйте промокод.', rows,
            buttons: [{ t: 'Закрити', cls: 'ghost' }, { t: '🎁 Як заробити', cls: 'primary', cb: () => { if (window.Wallet) Wallet.open('earn'); } }] });
    }

    // ---- window.alert -> вікно гри: тип підбираємо за змістом повідомлення ----
    function alertKind(m) {
        if (/Вітаємо|ВІТАЄМО|успіш|Нараховано|активовано|Готово/i.test(m)) return 'success';
        if (/Недостатньо кредів/i.test(m)) return 'money';
        if (/Звільніть місце|Інвентар повний/i.test(m)) return 'warn';
        if (/не вдав|помилк|невір|занят|повна|не знайден|не можете|некоректн|вже|ще не/i.test(m)) return 'error';
        return 'info';
    }
    window.alert = function (m) {
        m = String(m == null ? '' : m); const k = alertKind(m);
        if (k === 'money') return money({ price: null });
        show({ kind: k, text: m });
    };
    window.uiDialog = { show, confirm, money, close: () => close(), isOpen: () => !!cur };

    // ---- вихід із матчу ----
    function inMatch() { return typeof currentRoomData !== 'undefined' && currentRoomData && currentRoomData.status === 'playing' && typeof currentRoomId !== 'undefined' && currentRoomId; }
    function leaveMatch() {
        if (!inMatch()) return;
        const ranked = !!currentRoomData.rk;
        uiDialog.confirm(ranked ? {
            kind: 'danger', icon: '🚪', title: 'Покинути рейтинговий бій?',
            text: 'Вихід зараховується як поразка зі штрафом до рейтингу, а черга буде недоступна 3 хвилини. Ваше місце в команді займе інший танк.',
            rows: [['Рейтинг', '— поразка', 'bad'], ['Креди', '— 0', 'bad'], ['Черга', '3 хв', 'bad']],
            cancelText: 'Залишитись', okText: 'Покинути бій', danger: true
        } : {
            kind: 'danger', icon: '🚪', title: 'Вийти з матчу?',
            text: 'Ви залишите бій передчасно й не отримаєте жодної нагороди: ні кредів, ні досвіду, ні кейсу. Для решти гравців бій триватиме.',
            rows: [['Креди', '— 0', 'bad'], ['Досвід', '— 0', 'bad'], ['Кейс', '— 0', 'bad']],
            cancelText: 'Залишитись', okText: 'Вийти без нагороди', danger: true
        }).then(ok => {
            if (!ok || !inMatch()) return;
            const rid = currentRoomId; socket.emit('leaveRoom', rid);
            currentRoomId = null; currentRoomData = null;
            ['settings-modal', 'winner-modal', 'prop-selection-menu', 'hunter-blind-overlay'].forEach(id => { const e = document.getElementById(id); if (e) { e.classList.add('hidden'); e.classList.remove('flex'); } });
            if (window.resetLobbyUI) resetLobbyUI();
            if (window.ModesFX) ModesFX.reset();
            if (typeof switchMusicState === 'function') switchMusicState('loby');
            if (ranked) { showScreen('main-menu-screen'); if (window.RankedUI) RankedUI.open(); if (window.uiToast) uiToast('Ви покинули рейтинговий бій: зараховано поразку', true); return; }
            showScreen('room-browser-screen');
            if (window.uiToast) uiToast('Ви вийшли з матчу без нагороди', true);
        });
    }
    window.leaveMatch = leaveMatch;
    function wire() {
        const x = document.getElementById('game-exit-btn'); if (x) x.addEventListener('click', () => { snd('ui_click'); leaveMatch(); });
        const sb = document.getElementById('settings-leave-btn'); if (sb) sb.addEventListener('click', () => { snd('ui_click'); leaveMatch(); });
        document.querySelectorAll('.settings-btn').forEach(b => b.addEventListener('click', () => { const l = document.getElementById('settings-leave-btn'); if (l) l.style.display = inMatch() ? '' : 'none'; }));
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
