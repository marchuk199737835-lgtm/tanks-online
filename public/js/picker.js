// ===== ВИБІР РЕЖИМУ Й МАПИ (плашки + вікна-вітрини) =====
// Плашка режиму (іконка, назва, короткий опис) і плашка мапи (мініатюра, назва, розмір) у «Новій сесії» та в кімнаті.
// Натискання відкриває вікно: режими — картками за групами з повним описом; мапи — мініатюрами (спершу сумісні, далі сірі «не для цього режиму»).
// Не лідер відкриває ті самі вікна лише для перегляду. Вибір у «Новій сесії» йде через старі (приховані) кнопки — уся наявна логіка ui.js/sessions.js працює як раніше.
// Підключається ПЕРЕД ui.js: дописує приховані кнопки для режимів, яких немає в розмітці (щоб на них повісились обробники).
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const click = () => { if (typeof playSound === 'function') playSound('ui_click'); };
    const MI = window.ModeInfo, IC = window.ModeIcons;
    if (!MI || !IC) return;
    const GROUPS = [{ k: 'coop', n: 'Кооператив', i: '🤝' }, { k: 'solo', n: 'Соло · 1 гравець', i: '🎯' }, { k: 'pvp', n: 'Проти гравців', i: '⚔️' }];
    const KIND = { coop: 'Кооператив', solo: 'Соло', pvp: 'Проти гравців' };
    const M = k => MI.MODES[k] || MI.MODES.deathmatch;
    const players = k => MI.isSolo(k) ? '1' : (M(k).players || '2–10');
    function reward(k) {
        if (M(k).rewardTxt) return M(k).rewardTxt;
        try { const r = MI.rewardRange(k, {}); return r.loss + '–' + r.win; } catch (e) { return '—'; }
    }
    const coin = () => (typeof creditIcon === 'function' ? creditIcon(13) : '💰');

    // ---------- приховані кнопки режимів у «Новій сесії» (для режимів, доданих пізніше за розмітку) ----------
    (function ensureCreateButtons() {
        const box = document.querySelector('#create-room-modal .cr-modes'); if (!box) return;
        MI.ORDER.forEach(k => {
            if (box.querySelector('.create-mode-select[data-mode="' + k + '"]')) return;
            const b = document.createElement('div'); b.className = 'select-btn create-mode-select cr-mode'; b.dataset.mode = k; b.innerHTML = '<em>' + M(k).e + '</em><div><b>' + esc(M(k).n) + '</b><small>' + esc(M(k).s) + '</small></div>'; box.appendChild(b);
        });
    })();

    // ---------- мапи ----------
    const MD = () => (typeof MAP_DATA !== 'undefined' ? MAP_DATA : {});
    // службові мапи режимів із фіксованими мапами (напр. Форум «Гладіаторів») у загальному списку не показуємо
    const FIXED = new Set(MI.ORDER.filter(k => M(k).fixedMaps));
    const isSys = m => !!(m && Array.isArray(m.modes) && m.modes.length && m.modes.every(x => FIXED.has(x)));
    const names = () => Object.keys(MD()).filter(n => !isSys(MD()[n]));
    const allows = (n, mode) => !M(mode).fixedMaps && !!MD()[n] && MapObj.mapAllows(MD()[n], mode);
    const title = n => (MD()[n] && MD()[n].title) || n || '—';
    const sizeL = n => { const s = (MD()[n] || {}).size || 3000; return s <= 2600 ? 'S' : s <= 4000 ? 'M' : 'L'; };
    const sizeTxt = n => ({ S: 'мала', M: 'середня', L: 'велика' })[sizeL(n)];
    const sizeTag = n => '<span class="pk-sz"><i class="' + sizeL(n) + '">' + sizeL(n) + '</i>' + sizeTxt(n) + '</span>';

    // ---------- мініатюри: малюються по черзі (≤ 8 мс за кадр) і кешуються на всю сесію ----------
    const cache = new Map(), queue = []; let busy = false;
    const low = () => document.documentElement.classList.contains('gfx-low');
    function drawMap(ctx, m, W) {
        const sc = W / m.size; ctx.save(); ctx.scale(sc, sc);
        const shp = MapObj.hasShape(m);
        if (shp) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, m.size, m.size); ctx.save(); ctx.beginPath(); m.shape.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip(); }
        ctx.fillStyle = m.bg || '#020617'; ctx.fillRect(0, 0, m.size, m.size);
        const F = !!window.MapFX && !low(), th = F && (MapFX.themeOf(m) || (m.biomes && m.biomes.length));
        if (th) { MapFX.drawGround(ctx, m, 0, 0, m.size, m.size, 0); MapFX.drawEdges(ctx, m, 0, 0, m.size, m.size); }
        else { ctx.strokeStyle = m.grid || '#1e293b'; ctx.lineWidth = 4; const st = m.size > 4000 ? 200 : 100; ctx.beginPath(); for (let i = 0; i <= m.size; i += st) { ctx.moveTo(i, 0); ctx.lineTo(i, m.size); ctx.moveTo(0, i); ctx.lineTo(m.size, i); } ctx.stroke(); }
        if (shp) ctx.restore();
        const _t = F ? MapFX.themeOf(m) : null;
        m.solids.forEach(o => { if (o.type === 'prop_floor') { ctx.save(); MapObj.applyRot(ctx, o); try { MapObj.drawProp(ctx, o, 0); } catch (e) {} ctx.restore(); } });
        m.solids.forEach(o => {
            if (o.type === 'prop_floor' || o.type === 'prop_roof' || o.type.indexOf('spawn') === 0) return;
            ctx.save(); MapObj.applyRot(ctx, o);
            try {
                if (F && o.type === 'line') MapFX.drawLine(ctx, o);
                else if (F && o.type.includes('water')) MapFX.drawWater(ctx, o, _t, 0, null, { low: true });
                else if (F && MapFX.solidKind(o) === 'block') MapFX.drawBlock(ctx, o, _t, { low: true });
                else if (F && o.type === 'tree') MapFX.drawTree(ctx, o, _t, {});
                else if (o.type === 'line') { ctx.strokeStyle = o.color; ctx.lineWidth = o.width; ctx.lineCap = 'round'; ctx.beginPath(); o.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); }
                else if (o.type.includes('water')) { ctx.fillStyle = '#0369a1'; ctx.fillRect(o.x, o.y, o.w, o.h); }
                else if (o.type === 'tree') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r || 30, 0, Math.PI * 2); ctx.fillStyle = '#166534'; ctx.fill(); }
                else if (o.type.includes('prop_')) MapObj.drawProp(ctx, o, 0);
                else if (o.type.includes('neon')) { ctx.strokeStyle = o.color; ctx.lineWidth = 10; ctx.strokeRect(o.x, o.y, o.w, o.h); }
                else if (o.w) { ctx.fillStyle = o.color || '#1e293b'; ctx.fillRect(o.x, o.y, o.w, o.h); }
            } catch (e) {}
            ctx.restore();
        });
        m.solids.forEach(o => { if (o.type === 'prop_roof') { ctx.save(); MapObj.applyRot(ctx, o); try { MapObj.drawProp(ctx, Object.assign({}, o, { _a: 1 }), 0); } catch (e) {} ctx.restore(); } });
        ctx.restore();
    }
    function paint(cv, n, px) {
        const m = MD()[n]; if (!cv || !m) return;
        const k = n + '|' + px + '|' + (low() ? 1 : 0);
        const put = () => { const src = cache.get(k); if (!src) return; cv.width = cv.height = px; cv.getContext('2d').drawImage(src, 0, 0); const s = cv.parentElement && cv.parentElement.querySelector('.pk-skel'); if (s) s.remove(); };
        if (cache.has(k)) { put(); return; }
        queue.push({ k, n, px, put }); if (!busy) { busy = true; requestAnimationFrame(pump); }
    }
    function pump() {
        const t0 = performance.now();
        while (queue.length && performance.now() - t0 < 8) {
            const j = queue.shift();
            if (!cache.has(j.k)) { const c = document.createElement('canvas'); c.width = c.height = j.px; try { drawMap(c.getContext('2d'), MD()[j.n], j.px); } catch (e) {} cache.set(j.k, c); }
            j.put();
        }
        if (queue.length) requestAnimationFrame(pump); else busy = false;
    }
    const dpr = () => Math.min(2, window.devicePixelRatio || 1) * (low() ? 0.6 : 1);
    const PX = s => Math.max(48, Math.round(s * dpr()));

    // ---------- плашки ----------
    // ctx: { mode, map, edit (bool), onMode(k), onMap(n) }
    function plaques(box, ctx) {
        if (!box) return;
        const k = ctx.mode, c = IC.color(k), mm = M(k), act = ctx.edit ? 'Змінити' : 'Переглянути';
        let mp;
        if (mm.fixedMaps) mp = '<button type="button" class="pk-pl" data-w="map" style="--c:' + c + '"><div class="pk-th pk-fixed">' + IC.svg(k) + '</div><div class="pk-tx"><small>МАПИ РЕЖИМУ</small><b>' + esc(mm.fixedMaps.map(x => x.t).join(' · ')) + '</b><span>Обираються автоматично</span></div><span class="pk-go">Деталі ›</span></button>';
        else mp = '<button type="button" class="pk-pl" data-w="map" style="--c:148,163,184"><div class="pk-th"><canvas></canvas><div class="pk-skel"></div></div><div class="pk-tx"><small>МАПА</small><b>' + esc(title(ctx.map)) + '</b><span>' + sizeTag(ctx.map) + '</span></div><span class="pk-go">' + act + ' ›</span></button>';
        const h = '<button type="button" class="pk-pl" data-w="mode" style="--c:' + c + '"><div class="pk-ic">' + IC.svg(k) + '</div><div class="pk-tx"><small>РЕЖИМ' + (mm.isNew ? ' <em class="pk-new">НОВИЙ</em>' : '') + '</small><b>' + esc(mm.n) + '</b><span>' + esc(mm.s) + ' · 👥 ' + players(k) + '</span></div><span class="pk-go">' + act + ' ›</span></button>' + mp;
        const sig = h + '|' + ctx.map;
        if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = h; const cv = box.querySelector('canvas'); if (cv) paint(cv, ctx.map, PX(112)); }
        box.__ctx = ctx;
        if (!box.__bound) { box.__bound = true; box.addEventListener('click', e => { const b = e.target.closest('.pk-pl'); if (!b) return; click(); open(b.dataset.w, box.__ctx); }); }
    }

    // ---------- вікно ----------
    let ov = null, sh = null, cur = null;
    function ensure() {
        if (ov) return;
        const d = document.createElement('div'); d.innerHTML = IC.defs(); document.body.appendChild(d.firstChild);
        ov = document.createElement('div'); ov.id = 'pk-ov'; ov.className = 'pk-ov'; ov.innerHTML = '<div class="pk-sh" role="dialog" aria-modal="true"></div>';
        document.body.appendChild(ov); sh = ov.firstChild;
        ov.addEventListener('click', e => { if (e.target === ov) close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) { e.stopPropagation(); close(); } }, true);
    }
    function open(w, ctx) { ensure(); cur = { w, ctx }; render(); requestAnimationFrame(() => ov.classList.add('on')); }
    function close() { if (!ov) return; ov.classList.remove('on'); cur = null; }
    function head(t, p, extra) { return '<div class="pk-h"><div class="pk-hs"><h3>' + t + '</h3><p>' + p + '</p></div>' + (extra || '') + '<button type="button" class="pk-x" data-x aria-label="Закрити">✕</button></div>'; }
    const ro = what => '<div class="pk-ro">👁 Перегляд: ' + what + ' змінює лише лідер сесії 👑</div>';
    const chip = k => '<span class="pk-chip" style="--c:' + IC.color(k) + '">' + IC.svg(k) + esc(M(k).n) + '</span>';
    function render() {
        if (!cur) return; const ctx = cur.ctx;
        sh.className = 'pk-sh' + (ctx.edit ? '' : ' pk-guest');
        if (cur.w === 'mode') modeWin(ctx); else if (M(ctx.mode).fixedMaps) fixedWin(ctx); else mapWin(ctx);
        sh.querySelector('[data-x]').onclick = () => { click(); close(); };
    }
    function modeWin(ctx) {
        let h = head('ОБЕРІТЬ РЕЖИМ', ctx.edit ? 'Що робити в кожному режимі — прямо на картці' : 'Опис усіх режимів') + '<div class="pk-nav">' + GROUPS.map(g => '<button type="button" data-g="' + g.k + '">' + g.i + ' ' + g.n + '</button>').join('') + '</div><div class="pk-b">';
        let d = 0;
        GROUPS.forEach(g => {
            const ks = MI.ORDER.filter(k => M(k).kind === g.k); if (!ks.length) return;
            h += '<div class="pk-gh" data-gh="' + g.k + '">' + g.i + ' ' + g.n + ' <em>' + ks.length + '</em></div><div class="pk-ga">';
            ks.forEach(k => {
                const m = M(k);
                h += '<button type="button" class="pk-mc' + (k === ctx.mode ? ' sel' : '') + '" data-m="' + k + '" style="--c:' + IC.color(k) + ';animation-delay:' + Math.min(d++, 14) * 22 + 'ms">' + (k === ctx.mode ? '<span class="pk-selb">✓ ОБРАНО</span>' : '') + '<div class="pk-mt"><div class="pk-ic">' + IC.svg(k) + '</div><div><b>' + esc(m.n) + (m.isNew ? '<em class="pk-new">НОВИЙ</em>' : '') + '</b><small>' + esc(m.s) + '</small></div></div><p>' + esc(m.d) + '</p><div class="pk-mf"><span>👥 ' + players(k) + '</span><span>' + coin() + ' ' + reward(k) + '</span><span>' + KIND[m.kind] + '</span></div></button>';
            });
            h += '</div>';
        });
        sh.innerHTML = h + '</div>' + ro('режим');
        const body = sh.querySelector('.pk-b');
        sh.querySelectorAll('.pk-mc').forEach(b => b.onclick = () => {
            if (!ctx.edit) return; click(); const k = b.dataset.m;
            if (k !== ctx.mode) ctx.onMode(k);
            close();
        });
        sh.querySelectorAll('.pk-nav button').forEach(b => b.onclick = () => { click(); const t = sh.querySelector('[data-gh="' + b.dataset.g + '"]'); if (t) body.scrollTo({ top: t.offsetTop - body.offsetTop - 6, behavior: 'smooth' }); });
        requestAnimationFrame(() => { const s = sh.querySelector('.pk-mc.sel'); if (s) body.scrollTop = s.offsetTop - body.offsetTop - body.clientHeight / 2 + s.offsetHeight / 2; });
    }
    function mapWin(ctx) {
        const all = names(), ok = all.filter(n => allows(n, ctx.mode)), no = all.filter(n => !allows(n, ctx.mode));
        const card = (n, i, off) => '<button type="button" class="pk-mp' + (off ? ' off' : '') + (n === ctx.map ? ' sel' : '') + '" data-n="' + esc(n) + '" style="--c:' + IC.color(ctx.mode) + ';animation-delay:' + Math.min(i, 18) * 18 + 'ms"><div class="pk-th"><canvas></canvas><div class="pk-skel"></div>' + (off ? '<div class="pk-lock"><span>🚫 не для цього режиму</span></div>' : '') + '</div><b>' + esc(title(n)) + '</b><div class="pk-mm">' + sizeTag(n) + '<span>' + MD()[n].size + ' м</span></div></button>';
        let h = head('ОБЕРІТЬ МАПУ', ok.length + ' мап підходять до режиму', chip(ctx.mode)) + '<div class="pk-b"><div class="pk-gh">✅ Підходять <em>' + ok.length + '</em></div><div class="pk-gm">' + ok.map((n, i) => card(n, i)).join('') + '</div>';
        if (no.length) h += '<div class="pk-gh">Не для цього режиму <em>' + no.length + '</em></div><div class="pk-gm">' + no.map((n, i) => card(n, i + ok.length, 1)).join('') + '</div>';
        sh.innerHTML = h + '</div>' + ro('мапу');
        const body = sh.querySelector('.pk-b');
        lazy(body);
        sh.querySelectorAll('.pk-mp').forEach(b => b.onclick = () => {
            const n = b.dataset.n; if (!ctx.edit || b.classList.contains('off')) return; click();
            if (n !== ctx.map) ctx.onMap(n);
            close();
        });
        requestAnimationFrame(() => { const s = sh.querySelector('.pk-mp.sel'); if (s) body.scrollTop = s.offsetTop - body.offsetTop - body.clientHeight / 2 + s.offsetHeight / 2; });
    }
    function fixedWin(ctx) {
        const fm = M(ctx.mode).fixedMaps;
        let h = head('МАПИ РЕЖИМУ', 'У цьому режимі мапи обираються автоматично', chip(ctx.mode)) + '<div class="pk-b"><div class="pk-gf">';
        fm.forEach((g, i) => {
            const has = g.n && MD()[g.n];
            h += '<div class="pk-mp pk-fx" data-n="' + esc(g.n || '') + '" style="--c:' + IC.color(ctx.mode) + ';animation-delay:' + i * 60 + 'ms"><div class="pk-th">' + (has ? '<canvas></canvas><div class="pk-skel"></div>' : '<div class="pk-fixed">' + IC.svg(ctx.mode) + '</div>') + '</div><b>' + (i + 1) + '. ' + esc(g.t) + '</b><p>' + esc(g.d) + '</p></div>';
        });
        sh.innerHTML = h + '</div></div>';
        lazy(sh.querySelector('.pk-b'));
    }
    function lazy(root) {
        const px = PX(170), cvs = root.querySelectorAll('canvas');
        if (!('IntersectionObserver' in window)) { cvs.forEach(c => paint(c, c.closest('[data-n]').dataset.n, px)); return; }
        const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target); paint(e.target, e.target.closest('[data-n]').dataset.n, px); }), { root, rootMargin: '240px' });
        cvs.forEach(c => io.observe(c));
    }
    // якщо вікно відкрите й налаштування змінились (лідер обрав інше) — оновити вміст
    function refreshOpen(ctx) { if (cur && ov && ov.classList.contains('on') && (cur.ctx.mode !== ctx.mode || cur.ctx.map !== ctx.map || cur.ctx.edit !== ctx.edit)) { cur.ctx = ctx; render(); } }

    window.Picker = { plaques, open, close, paint, isOpen: () => !!cur };

    // ================= ПІДКЛЮЧЕННЯ =================
    document.addEventListener('DOMContentLoaded', () => {
        // ---- «Нова сесія» ----
        const modal = $('create-room-modal'), modes = modal && modal.querySelector('.cr-modes'), maps = $('create-map-list');
        if (modal && modes && maps) {
            const sm = modes.closest('.cr-sec'), sp = maps.closest('.cr-sec');
            const sec = document.createElement('div'); sec.className = 'cr-sec'; sec.innerHTML = '<label>Режим і мапа</label><div class="pk-pq" id="pk-create"></div>';
            sm.parentNode.insertBefore(sec, sm); sm.classList.add('pk-off'); sp.classList.add('pk-off');
            const cfg = () => (typeof createConfig !== 'undefined' ? createConfig : { mode: 'deathmatch', map: names()[0] });
            const draw = () => {
                const c = cfg();
                plaques($('pk-create'), {
                    mode: c.mode, map: c.map, edit: true,
                    onMode: k => { const b = modes.querySelector('.create-mode-select[data-mode="' + k + '"]'); if (b) b.click(); draw(); },
                    onMap: n => { const b = maps.querySelector('.create-map-select[data-map="' + CSS.escape(n) + '"]'); if (b) b.click(); else { c.map = n; if (window.drawMapPreview) drawMapPreview(n); } draw(); }
                });
            };
            const ob = $('open-create-room-btn'); if (ob) ob.addEventListener('click', () => setTimeout(draw, 0));
            const old = window.onMapDataLoaded; window.onMapDataLoaded = function () { if (old) old.apply(this, arguments); draw(); };
            draw();
        }
        // ---- кімната (лобі) ----
        const pane = $('lb-pane-session');
        if (pane) {
            const box = document.createElement('div'); box.className = 'pk-pq pk-lobby'; box.id = 'pk-lobby'; pane.insertBefore(box, pane.firstChild);
            const hp = $('host-settings-panel');
            if (hp) {      // старі кнопки режимів і мап лідера ховаємо (параметри лишаються)
                hp.querySelectorAll('.lb-mg, #host-map-list').forEach(e => e.classList.add('pk-off'));
                hp.querySelectorAll('.lb-set-label').forEach(e => { if (/^(Режим|Мапа)$/.test(e.textContent.trim())) e.classList.add('pk-off'); });
            }
            const up = window.updateLobbyUI;
            if (typeof up === 'function') window.updateLobbyUI = function () {
                up.apply(this, arguments);
                const r = typeof currentRoomData !== 'undefined' ? currentRoomData : null; if (!r || r.status === 'playing') return;
                const ctx = {
                    mode: r.mode, map: r.map, edit: typeof myId !== 'undefined' && myId === r.hostSocket && !r.rk,
                    onMode: k => socket.emit('updateRoomSettings', { roomId: currentRoomId, mode: k }),
                    onMap: n => socket.emit('updateRoomSettings', { roomId: currentRoomId, map: n })
                };
                plaques(box, ctx); refreshOpen(ctx);
            };
            // вийшли з кімнати — закрити вікно
            const rs = window.resetLobbyUI; if (typeof rs === 'function') window.resetLobbyUI = function () { close(); return rs.apply(this, arguments); };
        }
    });
})();
