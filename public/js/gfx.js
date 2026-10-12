// ===== Якість графіки: Авто / Висока / Середня / Низька =====
// Мета — щоб гра йшла навіть на дуже слабких ноутбуках і телефонах, а на нормальних виглядала як раніше.
// Що змінює рівень: внутрішня роздільна здатність полотна, тіні/світіння (shadowBlur), кількість частинок,
// ліміт кадрів, а також важкі CSS-ефекти меню (backdrop-filter, розмиті плями, нескінченні анімації).
// «Авто» стартує з оцінки заліза (ядра/пам'ять/тач/програмний рендер), а далі сама знижує рівень, якщо FPS стабільно нижче 45
// (або часто «рветься» довгими кадрами). Угору вона САМА НЕ піднімає — щоб гра не смикалась туди-сюди; підняти можна вручну в налаштуваннях.
// Остання вдала якість запам'ятовується між візитами.
(function () {
    const LS = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const ORDER = ['low', 'medium', 'high'];
    const TIERS = {
        // rs — роздільна здатність полотна; на ПК середня якість лишає повну чіткість (дорожчі тут тіні/ефекти, а не пікселі),
        // на телефоні — трохи менше пікселів. Низька: 60 кадрів, а якщо пристрій їх не тягне — рівні 30 (див. fr)
        high:   { rs: 1,    rsT: 1,    blur: 1,   shadow: true,  fx: 1,    partMax: 400, cap: 60 },   // стеля 60: на екранах 120/144 Гц не гріємо відеокарту дарма
        medium: { rs: 1,    rsT: 0.85, blur: 0.35, shadow: true, fx: 0.5,  partMax: 180, cap: 60 },
        low:    { rs: 0.8,  rsT: 0.7,  blur: 0,   shadow: false, fx: 0.25, partMax: 70,  cap: 60 }
    };
    const NAMES = { auto: 'Авто', high: 'Висока', medium: 'Середня', low: 'Низька' };

    const ua = navigator.userAgent || '';
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(ua);
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    // програмний рендер (SwiftShader/llvmpipe/«Basic Render») — гарантовано «низька»; WebGL-контекст створюється на мить і одразу звільняється
    function softGpu() {
        try {
            const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl'); if (!gl) return false;
            const x = gl.getExtension('WEBGL_debug_renderer_info'), r = x ? String(gl.getParameter(x.UNMASKED_RENDERER_WEBGL) || '') : '';
            const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext();
            return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(r);
        } catch (e) { return false; }
    }
    function guess() {
        if (cores <= 2 || mem <= 2 || softGpu()) return 'low';
        if ((touch && cores <= 4) || mem <= 3 || (cores <= 4 && mem <= 4)) return 'medium';
        return 'high';
    }

    const G = window.GFX = {
        mode: LS.get('gfxMode') || 'auto', tier: 'high', showFps: LS.get('gfxFps') === '1',
        rs: 1, blur: 1, shadow: true, fx: 1, partMax: 400, cap: 0,
        fps: 0, work: wk, frame: fr, attach, set, apply, label
    };
        if (ORDER.indexOf(LS.get('gfxMode')) < 0 && G.mode !== 'auto') G.mode = 'auto';
    const saved = LS.get('gfxAuto');
    G.tier = G.mode === 'auto' ? (ORDER.indexOf(saved) >= 0 ? saved : guess()) : G.mode;
    if (G.mode === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && G.tier === 'high') G.tier = 'medium';

    let lock30 = false;
    function apply() {
        const t = TIERS[G.tier];
        G.rs = touch ? t.rsT : t.rs; G.blur = t.blur; lock30 = false; G.shadow = t.shadow; G.fx = t.fx; G.partMax = t.partMax; G.cap = t.cap;
        const c = document.documentElement.classList;
        ORDER.forEach(n => c.toggle('gfx-' + n, n === G.tier));
        if (typeof window.fitCanvas === 'function') window.fitCanvas();
        refreshUI();
    }
    function set(mode) {
        G.mode = mode; LS.set('gfxMode', mode);
        if (mode === 'auto') { G.tier = ORDER.indexOf(LS.get('gfxAuto')) >= 0 ? LS.get('gfxAuto') : guess(); } else G.tier = mode;
        resetStats(); apply();
    }
    function label() { return NAMES[G.tier]; }

    // ---- контекст: усі shadowBlur/shadowColor у грі проходять через рівень якості, без правок у місцях малювання ----
    function attach(ctx) {
        const proto = CanvasRenderingContext2D.prototype;
        const dB = Object.getOwnPropertyDescriptor(proto, 'shadowBlur'), dC = Object.getOwnPropertyDescriptor(proto, 'shadowColor');
        if (!dB || !dC) return;
        Object.defineProperty(ctx, 'shadowBlur', { configurable: true, get() { return dB.get.call(ctx); }, set(v) { dB.set.call(ctx, G.shadow ? v * G.blur : 0); } });
        Object.defineProperty(ctx, 'shadowColor', { configurable: true, get() { return dC.get.call(ctx); }, set(v) { dC.set.call(ctx, G.shadow ? v : 'transparent'); } });
    }

    // ---- вимірювання ----
    let acc = 0, n = 0, winT = 0, slowWins = 0, workAcc = 0, workN = 0, warm = 0, fpsAcc = 0, fpsN = 0, fpsShown = 0, stalls = 0, stallWins = 0, sevWins = 0;
    function resetStats() { acc = 0; n = 0; winT = 0; slowWins = 0; workAcc = 0; workN = 0; warm = 0; stalls = 0; stallWins = 0; sevWins = 0; }
    function wk(ms) { workAcc += ms; workN++; }
    let lastCall = 0, goodWins = 0, gameFr = 0, gameAt = 0;
    // спроба повернути вищу якість: якщо попередній бій ішов рівно на повних кадрах — у наступному бою «Авто» піднімає рівень на один щабель;
    // якщо він знову не потягне — опуститься, і після двох таких невдач на цьому пристрої більше не пробуємо
    function battleStart() {
        if (G.mode !== 'auto') return;
        const i = ORDER.indexOf(G.tier), fails = +(LS.get('gfxUpFail') || 0);
        if (LS.get('gfxGood') === '1' && i < ORDER.length - 1 && fails < 2) { LS.set('gfxGood', '0'); G.tier = ORDER[i + 1]; G._tryUp = true; LS.set('gfxAuto', G.tier); apply(); }
    }
    function fr(now, dt) {
        gameFr++; gameAt = now;                                      // для лічильника FPS: реально намальовані кадри гри
        if (now - lastCall > 1000) { battleStart(); warm = now; winT = 0; acc = 0; n = 0; stalls = 0; goodWins = 0; }   // новий бій після меню — знову прогрів
        lastCall = now;
        if (dt > 0.5) { warm = now; return; }                       // вкладка була прихована / довга пауза — не рахуємо
        if (!warm) warm = now;
        if (now - warm < 4000) return;                               // прогрів: перші секунди після старту/перемикання (будуються кеші, міні-мапа)
        acc += dt; n++; fpsAcc += dt; fpsN++;
        if (dt > 0.1) stalls++;
        
        if (!winT) winT = now;
        if (now - winT < 1000) return;
        const avg = acc / n, fps = 1 / avg, target = G.cap || 60;
        const st = stalls; acc = 0; n = 0; winT = now; workAcc = 0; workN = 0; stalls = 0;
        // низька якість і пристрій не тягне 60 — фіксуємо рівні 30 кадрів (рівні 30 виглядають плавніше, ніж «рвані» 40–50)
        if (G.tier === 'low' && !lock30 && fps < 50) { slowWins++; if (slowWins >= 3) { lock30 = true; G.cap = 30; slowWins = 0; } return; }
        if (G.mode !== 'auto') return;
        const slow = fps < target * 0.75, severe = fps < target * 0.5, stuck = st >= 4;   // «гальмує» / «дуже гальмує» / «рветься»
        slowWins = slow ? slowWins + 1 : 0; sevWins = severe ? sevWins + 1 : 0; stallWins = stuck ? stallWins + 1 : 0;
        goodWins = fps >= target * 0.93 && !st ? goodWins + 1 : 0;
        if (goodWins >= 40) { goodWins = 0; LS.set('gfxGood', '1'); if (G._tryUp) { G._tryUp = false; LS.set('gfxUpFail', '0'); } }   // 40 с рівних кадрів
        const i = ORDER.indexOf(G.tier);
        if ((slowWins >= 3 || sevWins >= 2 || stallWins >= 2) && i > 0) {
            if (G._tryUp) { G._tryUp = false; LS.set('gfxUpFail', String(+(LS.get('gfxUpFail') || 0) + 1)); }
            LS.set('gfxGood', '0'); G.tier = ORDER[i - 1]; LS.set('gfxAuto', G.tier); toast(); resetStats(); apply();
        }
    }

    function toast() {
        let t = document.getElementById('gfx-toast');
        if (!t) { t = document.createElement('div'); t.id = 'gfx-toast'; t.className = 'gfx-toast'; document.body.appendChild(t); }
        t.innerHTML = '<span>Для плавності знижено графіку:</span> <b></b>';
        t.querySelector('b').textContent = NAMES[G.tier];
        t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 4500);
    }

    // ---- інтерфейс у налаштуваннях ----
    function buildUI() {
        const modal = document.getElementById('settings-modal'); if (!modal || document.getElementById('gfx-box')) return;
        const close = document.getElementById('close-settings-btn'); if (!close) return;
        const box = document.createElement('div'); box.id = 'gfx-box'; box.className = 'mb-4 lg:mb-6 text-left';
        box.innerHTML = '<label class="text-[10px] lg:text-xs font-bold uppercase text-slate-400 block mb-2 tracking-wider">Графіка</label>' +
            '<div class="gfx-seg" id="gfx-seg">' + ['auto', 'high', 'medium', 'low'].map(m => '<button type="button" data-m="' + m + '"><span>' + NAMES[m] + '</span></button>').join('') + '</div>' +
            '<p class="gfx-hint" id="gfx-hint"></p>' +
            '<label class="gfx-chk"><input type="checkbox" id="gfx-fps-chk"><span>Лічильник FPS</span></label>';
        close.parentNode.insertBefore(box, close);
        box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { if (typeof playSound === 'function') playSound('ui_click'); set(b.dataset.m); }));
        const chk = box.querySelector('#gfx-fps-chk'); chk.checked = G.showFps;
        chk.addEventListener('change', () => { G.showFps = chk.checked; LS.set('gfxFps', G.showFps ? '1' : '0'); fpsEl(); });
        refreshUI();
    }
    const HINT = {
        auto: 'Сама підбирає якість і знижує її, якщо гра гальмує (назад сама не піднімає).',
        high: 'Повна якість: усі тіні, світіння та ефекти.',
        medium: 'Легші тіні й ефекти (на телефоні — трохи нижча чіткість). Зручно для старих ноутбуків.',
        low: 'Без тіней, мало ефектів, менша чіткість. Якщо пристрій не тягне 60 кадрів — рівні 30. Для дуже слабких пристроїв.'
    };
    function refreshUI() {
        const seg = document.getElementById('gfx-seg'); if (!seg) return;
        seg.querySelectorAll('button').forEach(b => {
            b.classList.toggle('on', b.dataset.m === G.mode);
            if (b.dataset.m === 'auto') { const s = b.querySelector('span'); s.textContent = NAMES.auto; let sm = b.querySelector('small'); if (!sm) { sm = document.createElement('small'); b.appendChild(sm); } sm.textContent = G.mode === 'auto' ? NAMES[G.tier] : ''; sm.style.display = G.mode === 'auto' ? '' : 'none'; sm.setAttribute('data-x', ''); }
        });
        const h = document.getElementById('gfx-hint'); if (h) h.textContent = HINT[G.mode] || '';
    }
    // Лічильник FPS живе власним rAF-циклом — працює і в меню, і в бою (раніше оновлювався лише з ігрового циклу, тож у меню був порожній)
    let fpsRaf = 0, fpsLast = 0, fpsFr = 0, fpsT0 = 0;
    function fpsTick(now) {
        fpsRaf = 0; if (!G.showFps) return;
        fpsFr++; if (!fpsT0) fpsT0 = now;
        if (now - fpsT0 >= 500) {
            // у бою показуємо, скільки кадрів НАМАЛЮВАЛА гра (а не скільки разів оновився екран) — це чесна цифра плавності
            const inGame = now - gameAt < 300;
            G.fps = Math.round((inGame ? gameFr : fpsFr) * 1000 / (now - fpsT0)); fpsFr = 0; gameFr = 0; fpsT0 = now;
            const e = document.getElementById('gfx-fps'); if (e) e.textContent = G.fps + ' FPS · ' + NAMES[G.tier];
        }
        fpsRaf = requestAnimationFrame(fpsTick);
    }
    function fpsEl() {
        let e = document.getElementById('gfx-fps');
        if (G.showFps) {
            if (!e) { e = document.createElement('div'); e.id = 'gfx-fps'; e.className = 'gfx-fps'; e.textContent = '… FPS'; document.body.appendChild(e); }
            if (!fpsRaf) { fpsFr = 0; fpsT0 = 0; fpsRaf = requestAnimationFrame(fpsTick); }
        } else { if (e) e.remove(); if (fpsRaf) { cancelAnimationFrame(fpsRaf); fpsRaf = 0; } }
    }
    buildUI(); fpsEl(); apply();
})();
