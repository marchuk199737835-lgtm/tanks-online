// ===== РІВНІ ТА ДОСВІД (клієнт) =====
// Дані (пороги XP, назви звань, нагороди) — спільні з сервером у GameData (public/js/gamedata.js).
// Тут: іконки рівнів (SVG), смужки досвіду (ангар / головне меню / вікно результату), вікно нагород і анімація +XP.
(function () {
    const G = window.GameData;
    if (!G) return;

    // ---------- іконки ----------
    const TIERS = [
        { a: '#fcd9b0', b: '#d97706', c: '#78350f', glow: '#f59e0b' },   // бронза  1-3
        { a: '#f8fafc', b: '#94a3b8', c: '#334155', glow: '#cbd5e1' },   // срібло  4-6
        { a: '#fef08a', b: '#f59e0b', c: '#92400e', glow: '#fbbf24' },   // золото  7-9
        { a: '#cffafe', b: '#22d3ee', c: '#155e75', glow: '#22d3ee' },   // платина 10-12
        { a: '#f3e8ff', b: '#a855f7', c: '#581c87', glow: '#c084fc' },   // аметист 13-14
        { a: '#fecaca', b: '#ef4444', c: '#7f1d1d', glow: '#fb923c' }    // міф 15
    ];
    const BAR = [['#f59e0b', '#fde68a'], ['#0ea5e9', '#bae6fd'], ['#eab308', '#fef08a'], ['#14b8a6', '#99f6e4'], ['#a855f7', '#e9d5ff'], ['#ef4444', '#fecaca']];   // кольори смужки XP за рангами
    const tierOf = l => l <= 3 ? 0 : l <= 6 ? 1 : l <= 9 ? 2 : l <= 12 ? 3 : l <= 14 ? 4 : 5;
    function star(cx, cy, R, fill) {
        const r = R * 0.45; let d = '';
        for (let i = 0; i < 10; i++) { const ang = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; d += (i ? 'L' : 'M') + (cx + Math.cos(ang) * rr).toFixed(1) + ' ' + (cy + Math.sin(ang) * rr).toFixed(1); }
        return `<path d="${d}Z" fill="${fill}" stroke="rgba(0,0,0,.35)" stroke-width=".8" stroke-linejoin="round"/>`;
    }
    let uid = 0;
    function iconSvg(level, size) {
        level = Math.max(1, Math.min(G.MAX_LEVEL, level | 0)); size = size || 40;
        const t = tierOf(level), T = TIERS[t], gid = 'lvg' + t + '_' + (++uid);      // id унікальний для кожної іконки (градієнти не працюють у прихованих <svg>)
        const n = level >= 15 ? 2 : ((level - 1) % 3) + 1;
        let o = `<svg class="lv-ico lv-t${t}${level === 15 ? ' lv-top' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" style="--glow:${T.glow}" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.a}"/><stop offset=".5" stop-color="${T.b}"/><stop offset="1" stop-color="${T.c}"/></linearGradient><linearGradient id="${gid}w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.a}"/><stop offset="1" stop-color="${T.b}"/></linearGradient></defs>`;
        if (t >= 2) { // крила
            const w = `<path d="M14 21C8 18 3 22 1 29c4-1 8-1 10 2-4 0-7 3-7 8 4-2 8-2 10 1z" fill="url(#${gid}w)" stroke="${T.c}" stroke-width="1.2" stroke-linejoin="round"/>`;
            o += w + `<g transform="translate(64 0) scale(-1 1)">${w}</g>`;
        }
        o += `<path d="M32 3L51 10.5V32C51 45.5 42.5 54.5 32 60.5C21.500 54.5 13 45.5 13 32V10.5Z" fill="url(#${gid})" stroke="${T.c}" stroke-width="2" stroke-linejoin="round"/>`;
        o += `<path d="M32 8.5L46 14V32C46 42 40 49 32 53.800C24 49 18 42 18 32V14Z" fill="rgba(2,6,23,.55)" stroke="${T.a}" stroke-opacity=".55" stroke-width="1"/>`;
        // шеврони
        const baseY = level === 15 ? 47 : 45, step = 6.5;
        for (let k = 0; k < n; k++) { const y = baseY - k * step; o += `<path d="M23.500 ${y}L32 ${y - 6.500}L40.500 ${y}" fill="none" stroke="url(#${gid}w)" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round"/>`; }
        // зірки/корона по рівнях
        if (level === 15) {
            o += star(32, 27, 11, T.a);
            o += `<path d="M19 13L21.500 3.500L27 9.500L32 1.500L37 9.500L42.500 3.500L45 13Z" fill="url(#${gid}w)" stroke="${T.c}" stroke-width="1.300" stroke-linejoin="round"/><circle cx="32" cy="7.500" r="1.800" fill="#fff"/>`;
        } else if (level >= 13) {
            const c = level === 13 ? 2 : 3, xs = c === 2 ? [26, 38] : [22.500, 32, 41.500], ys = c === 2 ? [20, 20] : [22, 17.500, 22];
            xs.forEach((x, i) => { o += star(x, ys[i], 4.600, T.a); });
        } else if (t >= 1) { o += star(32, level >= 10 ? 19 : 20, 5.200, T.a); }
        if (t >= 3) o += `<path d="M32 47.500l3 3-3 3-3-3z" fill="${T.a}" stroke="${T.c}" stroke-width=".8"/>`;
        return o + '</svg>';
    }

    // ---------- стан ----------
    const S = { xp: 0, rewards: {}, claims: [] };
    function state(xp) { return G.levelProgress(xp == null ? S.xp : xp); }
    function claimable() {
        const lv = G.levelFromXp(S.xp), out = [];
        for (let l = 2; l <= lv; l++) if (!S.claims.includes(l) && S.rewards[l]) out.push(l);
        return out;
    }
    function rankName(l) { return G.LEVEL_NAMES[Math.max(1, Math.min(G.MAX_LEVEL, l)) - 1]; }
    const num = v => Math.round(v).toLocaleString('uk-UA').replace(/ /g, ' ');
    function barText(p) { return p.max ? 'MAX' : `${num(p.cur)} / ${num(p.need)} XP`; }
    function setBar(root, p) {
        if (!root) return;
        const f = root.querySelector('.xpbar-fill'), t = root.querySelector('.xpbar-txt');
        if (f) f.style.width = (p.max ? 100 : p.pct) + '%';
        if (t) t.textContent = barText(p);
        root.classList.toggle('is-max', !!p.max);
        const B = BAR[tierOf(p.level)];
        root.style.setProperty('--c1', B[0]); root.style.setProperty('--c2', B[1]);
    }

    // ---------- відмальовування ----------
    function renderAll() {
        const p = state(), L = p.level, cl = claimable();
        document.querySelectorAll('[data-lv-icon]').forEach(el => { const s = +el.dataset.lvIcon || 40; const key = L + ':' + s; if (el.dataset.k !== key) { el.innerHTML = iconSvg(L, s); el.dataset.k = key; } });
        document.querySelectorAll('[data-lv-num]').forEach(el => { el.textContent = L; });
        document.querySelectorAll('[data-lv-rank]').forEach(el => { el.textContent = rankName(L); });
        document.querySelectorAll('[data-lv-next]').forEach(el => { el.textContent = p.max ? '' : ('до рівня ' + (L + 1) + ': ' + num(p.need - p.cur) + ' XP'); });
        document.querySelectorAll('.lv-bar').forEach(b => setBar(b, p));
        document.querySelectorAll('.lv-gift').forEach(b => {
            b.classList.toggle('hidden', cl.length === 0);
            const c = b.querySelector('.lv-gift-n'); if (c) c.textContent = cl.length;
        });
        document.querySelectorAll('.lv-gift-dot').forEach(d => d.classList.toggle('hidden', cl.length === 0));
        document.querySelectorAll('.lv-hud').forEach(h => h.classList.toggle('has-gift', cl.length > 0));
        if (!document.getElementById('lv-modal').classList.contains('hidden')) renderModal();
    }

    function caseMini(cid) {
        const cs = CASES[cid]; if (!cs) return '';
        return `<div class="lv-case-ico">${caseIcon(cs)}</div>`;
    }
    function renderModal() {
        const p = state(), L = p.level, cl = claimable();
        const head = document.getElementById('lv-modal-head');
        if (head) {
            head.innerHTML = `<div class="flex items-center gap-3 lg:gap-5"><div class="lv-big-ico">${iconSvg(L, 84)}</div><div class="flex-1 min-w-0"><div class="lv-head-sub">Рівень ${L} · ${rankName(L)}</div><div class="lv-bar xpbar xpbar-lg mt-1.5"><div class="xpbar-fill"></div><div class="xpbar-notch"></div><div class="xpbar-txt"></div></div><div class="lv-head-sub mt-1.5 opacity-70" data-lv-next></div></div></div>`;
            setBar(head.querySelector('.lv-bar'), p);
            const nx = head.querySelector('[data-lv-next]'); if (nx) nx.textContent = p.max ? 'Максимальний рівень!' : ('до рівня ' + (L + 1) + ': ' + num(p.need - p.cur) + ' XP');
        }
        // доступні нагороди
        const av = document.getElementById('lv-available');
        if (av) {
            if (!cl.length) av.innerHTML = '<div class="lv-empty">Немає доступних нагород — граєте далі й отримуйте досвід!</div>';
            else av.innerHTML = cl.map(l => rewardCard(l, 'ready')).join('');
        }
        const all = document.getElementById('lv-all');
        if (all) {
            let h = '';
            for (let l = 2; l <= G.MAX_LEVEL; l++) h += rewardCard(l, S.claims.includes(l) ? 'done' : (l <= L ? 'ready' : 'locked'));
            all.innerHTML = h;
        }
        const how = document.getElementById('lv-how');
        if (how && !how.dataset.done) {
            how.dataset.done = 1;
            how.innerHTML = `<div class="lv-how-item"><b>🏆 Перемога</b><span>+${G.XP_WIN[0]}–${G.XP_WIN[1]} XP</span></div><div class="lv-how-item"><b>💀 Поразка / 🤝 нічия</b><span>+${G.XP_LOSS[0]}–${G.XP_LOSS[1]} XP</span></div><div class="lv-how-item"><b>🎁 Новий рівень</b><span>кейс з нагородою (до 💵650)</span></div>`;
        }
    }
    function rewardCard(l, st) {
        const cid = S.rewards[l], cs = CASES[cid]; if (!cs) return '';
        const need = G.LEVEL_XP[l - 1];
        const btn = st === 'ready' ? `<button class="lv-claim" onclick="LV.claim(${l})">ЗАБРАТИ</button>`
            : st === 'done' ? '<div class="lv-state done">✓ Отримано</div>'
            : `<div class="lv-state lock">🔒 ${num(need)} XP</div>`;
        return `<div class="lv-card ${st}"><div class="lv-card-ico">${iconSvg(l, 46)}</div><div class="lv-card-mid"><div class="lv-card-lvl">Рівень ${l}<span> · ${rankName(l)}</span></div><button class="lv-case" onclick="openCaseInfo(${cid})" title="Що може випасти"><span class="lv-case-ico">${caseIcon(cs)}</span><span class="lv-case-txt"><b>${cs.name}</b><i>💵 ${cs.price} · вміст ›</i></span></button></div>${btn}</div>`;
    }

    let reopen = false;
    function openRewards() {
        if (typeof playSound === 'function') playSound('ui_click');
        renderModal(); document.getElementById('lv-modal').classList.remove('hidden');
    }
    function closeRewards() { document.getElementById('lv-modal').classList.add('hidden'); }
    function claim(l) {
        if (typeof playSound === 'function') playSound('ui_buy');
        socket.emit('claimLevelReward', l);
    }
    function onClaimResult() { reopen = true; closeRewards(); }

    // ---------- дані з сервера ----------
    function setEco(d) {
        if (typeof d.xp === 'number') S.xp = d.xp;
        if (d.levelRewards) S.rewards = d.levelRewards;
        if (d.levelClaims) S.claims = d.levelClaims;
        if (!pending) renderAll();
    }

    // ---------- анімація +XP у вікні результату ----------
    let pending = false, anim = null;
    function animateXp(info, root) {
        root = root || document.getElementById('winner-xp');
        if (!root) return;
        if (!info) { root.classList.add('hidden'); return; }
        root.classList.remove('hidden');
        const gainEl = root.querySelector('.wx-gain'), barEl = root.querySelector('.xpbar'), icoEl = root.querySelector('.wx-ico'),
            lvlEl = root.querySelector('.wx-lvl'), upEl = root.querySelector('.wx-up'), fill = root.querySelector('.xpbar-fill'), txt = root.querySelector('.xpbar-txt');
        cancelAnimationFrame(anim); pending = true;
        const start = info.before, end = info.after, total = Math.max(1, end - start);
        const kind = info.outcome === 'win' ? '🏆' : info.outcome === 'draw' ? '🤝' : '💀';
        gainEl.textContent = '+0 XP'; if (upEl) upEl.classList.add('hidden');
        function paint(xp) {
            const p = G.levelProgress(xp);
            lvlEl.textContent = 'Рівень ' + p.level + ' · ' + rankName(p.level);
            if (icoEl.dataset.lv !== String(p.level)) { icoEl.innerHTML = iconSvg(p.level, 64); icoEl.dataset.lv = p.level; }
            setBar(barEl, p);
            return p;
        }
        paint(start);
        const dur = Math.min(2600, 900 + total * 28);
        let t0 = null, lastLvl = G.levelFromXp(start), lastTick = 0;
        setTimeout(() => {
            function step(ts) {
                if (!t0) t0 = ts;
                const k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3), xp = start + total * e, p = paint(xp);
                gainEl.textContent = '+' + Math.round(total * e) + ' XP';
                if (ts - lastTick > 90 && k < 1) { lastTick = ts; if (typeof playSound === 'function') playSound('hitmarker'); }
                if (p.level > lastLvl) {
                    lastLvl = p.level;
                    icoEl.classList.remove('lv-pop'); void icoEl.offsetWidth; icoEl.classList.add('lv-pop');
                    if (upEl) { upEl.classList.remove('hidden'); upEl.textContent = '⬆ НОВИЙ РІВЕНЬ ' + p.level + '!'; }
                    if (typeof playSound === 'function') playSound('powerup');
                    root.classList.add('flash'); setTimeout(() => root.classList.remove('flash'), 700);
                }
                if (k < 1) anim = requestAnimationFrame(step);
                else {
                    gainEl.textContent = '+' + total + ' XP'; paint(end); pending = false; renderAll();
                    if (info.lvlAfter > info.lvlBefore && upEl) { const c = info.lvlAfter - info.lvlBefore; upEl.innerHTML = '⬆ НОВИЙ РІВЕНЬ ' + info.lvlAfter + '! <span>🎁 нагорода чекає в Ангарі</span>'; }
                }
            }
            anim = requestAnimationFrame(step);
        }, 500);
        root.querySelector('.wx-kind').textContent = kind;
    }

    // нагорода закрита → знову відкрити вікно рівнів
    document.addEventListener('click', e => {
        if (e.target && e.target.id === 'close-reward-btn' && reopen) { reopen = false; setTimeout(openRewards, 150); }
    }, true);

    window.LV = { icon: iconSvg, rankName, setEco, renderAll, openRewards, closeRewards, claim, onClaimResult, animateXp, state, claimable, tierOf, TIERS, S };
    document.addEventListener('DOMContentLoaded', () => renderAll());
})();
