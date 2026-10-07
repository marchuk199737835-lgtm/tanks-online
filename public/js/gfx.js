// ===== Якість графіки: Авто / Висока / Середня / Низька =====
// Мета — щоб гра йшла навіть на дуже слабких ноутбуках і телефонах, а на нормальних виглядала як раніше.
// Що змінює рівень: внутрішня роздільна здатність полотна, тіні/світіння (shadowBlur), кількість частинок,
// ліміт кадрів, а також важкі CSS-ефекти меню (backdrop-filter, розмиті плями, нескінченні анімації).
// «Авто» стартує з оцінки заліза (ядра/пам'ять/тач), а далі сама знижує рівень, якщо FPS просідає
// (і обережно піднімає, якщо запас великий). Остання вдала якість запам'ятовується між візитами.
(function () {
    const LS = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    const ORDER = ['low', 'medium', 'high'];
    const TIERS = {
        high:   { rs: 1,    blur: 1,   shadow: true,  fx: 1,    partMax: 400, cap: 0 },
        medium: { rs: 0.85, blur: 0.35, shadow: true, fx: 0.5,  partMax: 180, cap: 0 },
        low:    { rs: 0.65, blur: 0,   shadow: false, fx: 0.25, partMax: 70,  cap: 30 }
    };
    const NAMES = { auto: 'Авто', high: 'Висока', medium: 'Середня', low: 'Низька' };

    const ua = navigator.userAgent || '';
    const touch = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches) || /Android|iPhone|iPad|iPod/i.test(ua);
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
    function guess() {
        if (cores <= 2 || mem <= 2) return 'low';
        if ((touch && cores <= 4) || mem <= 3 || (cores <= 4 && mem <= 4)) return 'medium';
        return 'high';
    }

    const G = window.GFX = {
        mode: LS.get('gfxMode') || 'auto', tier: 'high', showFps: LS.get('gfxFps') === '1',
        rs: 1, blur: 1, shadow: true, fx: 1, partMax: 400, cap: 0,
        fps: 0, work: wk, frame: fr, attach, set, apply, label
    };
    let ceiling = 'high';
    if (ORDER.indexOf(LS.get('gfxMode')) < 0 && G.mode !== 'auto') G.mode = 'auto';
    const saved = LS.get('gfxAuto');
    G.tier = G.mode === 'auto' ? (ORDER.indexOf(saved) >= 0 ? saved : guess()) : G.mode;
    if (G.mode === 'auto' && window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && G.tier === 'high') G.tier = 'medium';

    function apply() {
        const t = TIERS[G.tier];
        G.rs = t.rs; G.blur = t.blur; G.shadow = t.shadow; G.fx = t.fx; G.partMax = t.partMax; G.cap = t.cap;
        const c = document.documentElement.classList;
        ORDER.forEach(n => c.toggle('gfx-' + n, n === G.tier));
        if (typeof window.fitCanvas === 'function') window.fitCanvas();
        refreshUI();
    }
    function set(mode) {
        G.mode = mode; LS.set('gfxMode', mode);
        if (mode === 'auto') { ceiling = 'high'; G.tier = ORDER.indexOf(LS.get('gfxAuto')) >= 0 ? LS.get('gfxAuto') : guess(); } else G.tier = mode;
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
    let acc = 0, n = 0, winT = 0, slowWins = 0, goodWins = 0, workAcc = 0, workN = 0, tierSince = 0, warm = 0, lastUp = 0, fpsAcc = 0, fpsN = 0, fpsShown = 0;
    function resetStats() { acc = 0; n = 0; winT = 0; slowWins = 0; goodWins = 0; workAcc = 0; workN = 0; warm = 0; }
    function wk(ms) { workAcc += ms; workN++; }
    let lastCall = 0;
    function fr(now, dt) {
        if (now - lastCall > 1000) { warm = now; winT = 0; acc = 0; n = 0; }   // новий бій після меню — знову прогрів
        lastCall = now;
        if (dt > 0.5) { warm = now; return; }                       // вкладка була прихована / довга пауза — не рахуємо
        if (!warm) warm = now;
        if (now - warm < 2500) return;                               // прогрів: перші секунди після старту/перемикання
        acc += dt; n++; fpsAcc += dt; fpsN++;
        if (G.showFps && now - fpsShown > 500) { fpsShown = now; G.fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; const e = document.getElementById('gfx-fps'); if (e) e.textContent = G.fps + ' FPS · ' + NAMES[G.tier]; }
        if (!winT) winT = now;
        if (now - winT < 1000) return;
        const avg = acc / n, fps = 1 / avg, work = workN ? workAcc / workN : 0, target = G.cap || 60;
        acc = 0; n = 0; winT = now; workAcc = 0; workN = 0;
        if (G.mode !== 'auto') return;
        const slow = G.cap ? fps < 22 : fps < 38;                    // «гальмує»
        const great = fps >= target * 0.93 && work < 7;              // «є великий запас»
        slowWins = slow ? slowWins + 1 : 0; goodWins = great ? goodWins + 1 : 0;
        const i = ORDER.indexOf(G.tier);
        if (slowWins >= 3 && i > 0) {
            if (lastUp && now - lastUp < 60000) ceiling = G.tier;     // піднялись і одразу просіли — вище не піднімаємось
            G.tier = ORDER[i - 1]; LS.set('gfxAuto', G.tier); toast(); resetStats(); apply();
        } else if (goodWins >= 30 && i < ORDER.indexOf(ceiling)) {
            G.tier = ORDER[i + 1]; lastUp = now; LS.set('gfxAuto', G.tier); resetStats(); apply();
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
        auto: 'Сама підбирає якість і знижує її, якщо гра гальмує.',
        high: 'Повна якість: усі тіні, світіння та ефекти.',
        medium: 'Легші тіні й ефекти, трохи нижча чіткість. Зручно для старих ноутбуків.',
        low: 'Без тіней, мало ефектів, 30 кадрів/с. Для дуже слабких пристроїв.'
    };
    function refreshUI() {
        const seg = document.getElementById('gfx-seg'); if (!seg) return;
        seg.querySelectorAll('button').forEach(b => {
            b.classList.toggle('on', b.dataset.m === G.mode);
            if (b.dataset.m === 'auto') { const s = b.querySelector('span'); s.textContent = NAMES.auto; let sm = b.querySelector('small'); if (!sm) { sm = document.createElement('small'); b.appendChild(sm); } sm.textContent = G.mode === 'auto' ? NAMES[G.tier] : ''; sm.style.display = G.mode === 'auto' ? '' : 'none'; sm.setAttribute('data-x', ''); }
        });
        const h = document.getElementById('gfx-hint'); if (h) h.textContent = HINT[G.mode] || '';
    }
    function fpsEl() {
        let e = document.getElementById('gfx-fps');
        if (G.showFps) { if (!e) { e = document.createElement('div'); e.id = 'gfx-fps'; e.className = 'gfx-fps'; document.body.appendChild(e); } }
        else if (e) e.remove();
    }
    buildUI(); fpsEl(); apply();
})();
