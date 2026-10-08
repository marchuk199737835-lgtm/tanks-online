// ===== ВХІД / РЕЄСТРАЦІЯ, заставка підключення, «торкніться, щоб увійти» (розблокування звуку) =====
(function () {
    const $ = id => document.getElementById(id);
    const tt = s => (window.I18N && I18N.t) ? I18N.t(s) : s;
    const click = () => { if (typeof playSound === 'function') playSound('ui_click'); };
    // Реєстрація (нові акаунти): логін — лише латиниця; пароль — лише друковані ASCII. Вхід старих акаунтів НЕ обмежуємо (там може бути кирилиця).
    const LOGIN_RE_NEW = /^[A-Za-z0-9_-]{3,12}$/, PASS_RE_NEW = /^[\x21-\x7E]{4,128}$/;
    const H_NAME = '3–12 символів: лише латиниця, цифри, _ та -', H_PASS = '4–128 символів: латиниця, цифри та знаки, без пробілів';
    function nameProblem(n) {
        if (!n) return '';
        if (/\s/.test(n)) return 'Логін без пробілів';
        if (/[^\x00-\x7F]/.test(n)) return 'Лише латиниця (A–Z): кирилиця, емодзі й інші символи не підходять';
        if (/[^A-Za-z0-9_-]/.test(n)) return 'Дозволені лише літери A–Z, цифри, _ та -';
        if (n.length < 3) return 'Логін: мінімум 3 символи';
        if (n.length > 12) return 'Логін: максимум 12 символів';
        return '';
    }
    function passProblem(p) {
        if (!p) return '';
        if (/\s/.test(p)) return 'Пароль без пробілів';
        if (/[^\x21-\x7E]/.test(p)) return 'Лише латиниця, цифри та знаки: без кирилиці й емодзі';
        if (p.length < 4) return 'Пароль: мінімум 4 символи';
        if (p.length > 128) return 'Пароль: максимум 128 символів';
        return '';
    }
    let isBusy = false;

    // ---------- іскри на тлі ----------
    const sp = $('au-sparks');
    if (sp) for (let i = 0; i < 18; i++) {
        const s = document.createElement('i'); s.className = 'au-spark';
        s.style.left = (Math.random() * 100) + '%'; s.style.animationDuration = (6 + Math.random() * 9) + 's'; s.style.animationDelay = (-Math.random() * 12) + 's';
        s.style.transform = 'scale(' + (0.6 + Math.random() * 1.6) + ')'; sp.appendChild(s);
    }

    // ---------- танк-логотип: башта стежить за курсором/дотиком, клік по танку — постріл ----------
    const tank = $('au-tank'), turret = $('au-turret'), recoil = $('au-recoil'), flash = $('au-flash');
    let idleT = 0;
    function aim(x, y) {
        if (!tank || !turret) return;
        const r = tank.getBoundingClientRect(); if (!r.width) return;
        const a = Math.atan2(y - (r.top + r.height / 2), x - (r.left + r.width / 2)) * 180 / Math.PI + 90;
        turret.setAttribute('transform', 'rotate(' + a.toFixed(1) + ')'); idleT = performance.now();
    }
    document.addEventListener('pointermove', e => aim(e.clientX, e.clientY), { passive: true });
    document.addEventListener('pointerdown', e => aim(e.clientX, e.clientY), { passive: true });
    const loginEl = $('login-screen');
    (function idle() { if (turret && (!loginEl || !loginEl.classList.contains('hidden')) && performance.now() - idleT > 3500) turret.setAttribute('transform', 'rotate(' + (Math.sin(performance.now() / 1400) * 25).toFixed(1) + ')'); requestAnimationFrame(idle); })();
    if (tank) tank.addEventListener('click', () => {
        if (typeof playSound === 'function') playSound('shoot');
        recoil.classList.remove('fire'); void recoil.getBoundingClientRect(); recoil.classList.add('fire');
        flash.setAttribute('opacity', '1'); setTimeout(() => flash.setAttribute('opacity', '0'), 90);
    });

    // ---------- режим: вхід / реєстрація ----------
    const card = $('auth-form'), tabs = card ? card.querySelector('.au-tabs') : null;
    function setMode(m) {
        authMode = m; const reg = m === 'register';
        $('tab-login').classList.toggle('active', !reg); $('tab-register').classList.toggle('active', reg);
        tabs.classList.toggle('reg', reg); card.classList.toggle('reg', reg);
        $('auth-btn').querySelector('.au-btn-t').textContent = reg ? 'СТВОРИТИ АКАУНТ' : 'УВІЙТИ';
        $('password-input').setAttribute('autocomplete', reg ? 'new-password' : 'current-password');
        $('au-switch').innerHTML = reg ? 'Вже є акаунт? <a href="#" id="au-switch-a">Увійти</a>' : 'Немає акаунта? <a href="#" id="au-switch-a">Зареєструватись</a>';
        bindSwitch(); validate(); showErr('');
    }
    function bindSwitch() { const a = $('au-switch-a'); if (a) a.onclick = e => { e.preventDefault(); click(); setMode(authMode === 'login' ? 'register' : 'login'); }; }
    $('tab-login').onclick = () => { click(); setMode('login'); };
    $('tab-register').onclick = () => { click(); setMode('register'); };
    bindSwitch();

    // ---------- валідація ----------
    function strength(p) {
        let s = 0; if (p.length >= 4) s++; if (p.length >= 8) s++; if (/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) s++; if (/\d/.test(p) && /[^\w]|_|[A-Za-zА-Яа-я]/.test(p)) s++;
        return p.length < 4 ? (p ? 1 : 0) : Math.max(1, Math.min(4, s));
    }
    const STR_T = ['', 'слабкий', 'середній', 'добрий', 'надійний'];
    function validate() {
        const n = $('nickname-input').value.trim(), p = $('password-input').value;
        const reg = authMode === 'register', nameOk = LOGIN_RE_NEW.test(n), passOk = PASS_RE_NEW.test(p);
        const nProb = reg ? nameProblem(n) : '', pProb = reg ? passProblem(p) : '';
        $('au-f-name').classList.toggle('ok', reg && nameOk); $('au-f-name').classList.toggle('bad', !!nProb);
        $('au-hint-name').classList.toggle('bad', !!nProb); $('au-hint-name').textContent = tt(nProb || H_NAME);
        const hp = $('au-hint-pass'); if (hp) { hp.classList.toggle('bad', !!pProb); hp.textContent = tt(pProb || H_PASS); }
        const st = reg && !pProb ? strength(p) : 0; $('au-strength').dataset.s = st; $('au-strength-t').textContent = tt(STR_T[st]);
        $('au-f-pass').classList.toggle('bad', !!pProb);
        $('au-f-pass').classList.toggle('ok', reg && passOk);
        // у режимі реєстрації кнопка заблокована, доки логін/пароль не відповідають правилам
        const b = $('auth-btn'); b.disabled = isBusy || (reg && !(nameOk && passOk));
    }
    $('nickname-input').addEventListener('input', () => { validate(); showErr(''); });
    $('password-input').addEventListener('input', () => { validate(); showErr(''); });
    $('au-eye').onclick = () => { click(); const i = $('password-input'), on = i.type === 'password'; i.type = on ? 'text' : 'password'; $('au-eye').classList.toggle('on', on); };

    function showErr(msg) {
        const e = $('auth-err'); e.textContent = msg ? tt(msg) : ''; e.classList.toggle('show', !!msg);
        if (msg) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); if (typeof playSound === 'function') playSound('hurt'); }
    }
    function busy(on) { isBusy = on; const b = $('auth-btn'); b.classList.toggle('loading', on); validate(); b.disabled = on || b.disabled; }
    window.authShowError = function (msg) { busy(false); showErr(msg); };
    window.authBusyOff = function () { busy(false); };

    card.addEventListener('submit', e => {
        e.preventDefault(); click();
        const rawN = $('nickname-input').value.trim(), rawP = $('password-input').value;
        const n = rawN;     // логін надсилаємо як є (без зміни регістру): сервер сам знайде акаунт незалежно від регістру
        // реєстрація: пароль надсилаємо як є (без обрізання); вхід: як раніше (з обрізанням країв) — для старих акаунтів
        const p = authMode === 'register' ? rawP : rawP.trim();
        if (!n || !p) return showErr('Введіть логін та пароль!');
        if (authMode === 'register') {
            const e1 = nameProblem(rawN) || (LOGIN_RE_NEW.test(rawN) ? '' : 'Логін: 3–12 символів, лише латиниця, цифри, _ та -');
            if (e1) return showErr(e1);
            const e2 = passProblem(rawP) || (PASS_RE_NEW.test(rawP) ? '' : 'Пароль: 4–128 символів, лише латиниця, цифри та знаки');
            if (e2) return showErr(e2);
        }
        busy(true); showErr('');
        socket.emit(authMode, { name: n, password: p, lang: window.I18N ? I18N.lang : null });
        setTimeout(() => busy(false), 8000);     // якщо сервер не відповів
    });
    setMode('login');

    // ---------- заставка підключення ----------
    // Показується одразу (поки йде автовхід за токеном), знімається при першому showScreen.
    let hasToken = false; try { hasToken = !!localStorage.getItem('tankToken'); } catch (e) {}
    let splash = null;
    if (hasToken) {
        splash = document.createElement('div'); splash.id = 'boot-splash'; splash.className = 'boot-splash';
        splash.innerHTML = '<h1 class="font-russo">PULS·PROJECT</h1><i class="au-spin"></i><p>Підключення…</p>';
        document.body.appendChild(splash);
        setTimeout(dropSplash, 9000);
    }
    function dropSplash() { if (!splash) return; const s = splash; splash = null; s.classList.add('out'); setTimeout(() => s.remove(), 450); }
    const _show = window.showScreen;
    window.showScreen = function (id) { _show(id); dropSplash(); };

    // ---------- «торкніться, щоб увійти»: гарантований жест → музика й звуки ----------
    // Після автовходу за токеном жесту не було, а браузер забороняє звук без нього. Якщо звук заблоковано — просимо один дотик.
    // «З поверненням» показуємо завжди при автовході (жесту користувача в цій сесії ще не було) — незалежно від того, чи вже грає звук.
    // Після ручного входу (був клік/дотик) екран не потрібен: звук і так розблоковано.
    let hadGesture = false;
    ['pointerdown', 'touchstart', 'mousedown', 'keydown'].forEach(ev => document.addEventListener(ev, () => { hadGesture = true; }, { capture: true, once: true, passive: true }));
    // запасний шлях: навіть якщо обробник у network.js збоїть раніше, екран «З поверненням» усе одно з'явиться
    if (typeof socket !== 'undefined' && socket && socket.on) socket.on('authSuccess', d => setTimeout(() => { try { if (window.soundGate && !document.getElementById('sound-gate') && !window.__gateShown) window.soundGate(d && d.name); } catch (e) { console.error('gate', e); } }, 60));
    window.soundGate = function (name) {
        const auto = !hadGesture;
        setTimeout(() => {
            if (document.getElementById('sound-gate') || window.__gateShown) return;
            window.__gateShown = true;
            const playing = typeof bgMusic !== 'undefined' && !bgMusic.paused && audioCtx && audioCtx.state === 'running';
            if (!auto && playing) { window.__gateShown = false; return; }
            if (!auto && !activePlaylist.length && audioCtx && audioCtx.state === 'running' && !(typeof myMusicPlaylists !== 'undefined' && ((myMusicPlaylists.main || []).length || (myMusicPlaylists.loby || []).length))) return;
            const g = document.createElement('div'); g.id = 'sound-gate'; g.className = 'sound-gate';
            const lv = window.LV ? LV.state().level : 1;
            g.innerHTML = '<div class="sound-gate-card"><div class="sg-hi">З поверненням</div>' + (window.LV ? LV.icon(lv, 64) : '') + '<div class="sg-name"></div><button class="sg-btn" type="button">▶ УВІЙТИ В ГРУ</button></div>';
            g.querySelector('.sg-name').textContent = name || '';
            document.body.appendChild(g);
            if (typeof hideAudioHint === 'function') hideAudioHint();
            const go = () => { if (typeof tryUnlockAudio === 'function') tryUnlockAudio(); g.classList.add('out'); setTimeout(() => { g.remove(); window.__gateShown = false; }, 400); };
            g.addEventListener('pointerup', go); g.addEventListener('click', go);
        }, 450);
    };
})();
