// ===== Сесії: фільтри списку, нове меню створення сесії (параметри з підказками «i») =====
(function () {
    const $ = id => document.getElementById(id);
    // Список сесій сервер шле лише тим, хто його дивиться: входимо в «кімнату списку» при відкритті екрана і виходимо при закритті
    if (typeof window.showScreen === 'function' && !window.__rbWrapped) {
        window.__rbWrapped = true; const _s = window.showScreen; let cur = null;
        window.showScreen = function (id) { _s.apply(this, arguments); if (id === 'room-browser-screen') socket.emit('requestRooms'); else if (cur === 'room-browser-screen') socket.emit('rbLeave'); cur = id; };
    }
    const click = () => { if (typeof playSound === 'function') playSound('ui_click'); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const P = window.LB_PARAMS || [];
    const ID = { maxPlayers: 'create-max-players', winScore: 'create-win-score', hideTime: 'create-hide-time', seekTime: 'create-seek-time', hunterCount: 'create-hunter-count', tdmTeams: 'create-tdm-teams', tdmTime: 'create-tdm-time', tdmScore: 'create-tdm-score', tdmAutoBalance: 'create-tdm-autobalance' };
    const GROUP = { winScore: 'create-score-wrap', hideTime: 'create-prophunt-wrap', seekTime: 'create-prophunt-wrap', hunterCount: 'create-prophunt-wrap', tdmTeams: 'create-tdm-wrap', tdmTime: 'create-tdm-wrap', tdmScore: 'create-tdm-wrap', tdmAutoBalance: 'create-tdm-wrap' };
    const MODE_T = { deathmatch: '⚔ ДЕТМАТЧ', survival: '🧟 ВИЖИВАННЯ', prophunt: '📦 ХОВАНКИ', team_deathmatch: '🤝 КОМАНДНИЙ' };
    const box = $('create-params'); if (!box || !P.length) return;
    let openTip = null;
    const closeTip = () => { if (openTip) { openTip.tip.classList.add('hidden'); openTip.ib.classList.remove('on'); openTip = null; } };
    document.addEventListener('click', closeTip);

    function maxOf(p) { if (p.key === 'hunterCount') { const mp = +($('create-max-players') || { value: 6 }).value; return Math.max(1, Math.min(9, mp - 1)); } return p.max; }
    function attachTip(d, p) {
        const tip = d.querySelector('.lb-tip'), ib = d.querySelector('.lb-i');
        const show = () => {
            const mx = maxOf(p);
            tip.innerHTML = '<h5>' + esc(p.label) + '</h5>' + esc(p.desc) + (p.type === 'toggle' ? '' : '<div class="lb-tip-r"><div><small>Мін</small><b>' + p.min + (p.unit || '') + '</b></div><div><small>Макс</small><b>' + mx + (p.unit || '') + '</b></div><div><small>Стандарт</small><b>' + p.def + (p.unit || '') + '</b></div></div>');
            const sc = $('create-params').closest('.cr-scroll'), r = d.getBoundingClientRect(), sr = sc.getBoundingClientRect();
            tip.classList.toggle('up', r.bottom + 150 > sr.bottom && r.top - 150 > sr.top - 40);
            tip.classList.remove('hidden'); ib.classList.add('on'); openTip = { tip, ib };
        };
        const hide = () => { tip.classList.add('hidden'); ib.classList.remove('on'); if (openTip && openTip.tip === tip) openTip = null; };
        ib.addEventListener('mouseenter', () => { if (matchMedia('(hover:hover)').matches) show(); });
        ib.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) hide(); });
        ib.addEventListener('click', e => { e.stopPropagation(); click(); tip.classList.contains('hidden') ? (closeTip(), show()) : hide(); });
    }
    const groups = {};
    function grp(id) { if (!id) return box; if (groups[id]) return groups[id]; const w = document.createElement('div'); w.id = id; w.style.display = 'none'; w.innerHTML = '<div class="cr-grp"></div>'; box.appendChild(w); return (groups[id] = w); }
    P.forEach(p => {
        const d = document.createElement('div'); d.className = 'lb-param cr-p';
        const head = '<div class="lb-param-h"><div class="lb-param-l"><span>' + esc(p.label) + '</span><button type="button" class="lb-i" aria-label="Інформація">i</button></div>';
        const id = ID[p.key];
        if (p.type === 'toggle') d.innerHTML = head + '<div class="lb-sw on" role="switch"></div><input type="checkbox" id="' + id + '" checked hidden></div><div class="lb-tip hidden"></div>';
        else d.innerHTML = head + '<div class="lb-param-v"><span class="v">' + p.def + '</span>' + (p.unit ? '<small>' + p.unit + '</small>' : '') + '</div></div><div class="lb-step"><button type="button" data-d="-1">−</button><input type="range" id="' + id + '" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '" value="' + p.def + '"><button type="button" data-d="1">+</button></div><div class="lb-tip hidden"></div>';
        const g = GROUP[p.key]; const target = g ? grp(g).firstChild : box; target.appendChild(d);
        attachTip(d, p);
        if (p.type === 'toggle') {
            const sw = d.querySelector('.lb-sw'), cb = d.querySelector('input');
            sw.addEventListener('click', () => { click(); cb.checked = !cb.checked; sw.classList.toggle('on', cb.checked); });
        } else {
            const rg = d.querySelector('input'), vv = d.querySelector('.v');
            const set = v => { v = Math.max(p.min, Math.min(maxOf(p), v)); rg.value = v; vv.textContent = rg.value; if (p.key === 'maxPlayers') { if (typeof createConfig !== 'undefined') createConfig.maxPlayers = rg.value; const mv = $('max-players-val'); if (mv) mv.textContent = rg.value; syncHunters(); } };
            rg.addEventListener('input', () => set(+rg.value));
            d.querySelectorAll('.lb-step button').forEach(b => b.addEventListener('click', () => { click(); set((+rg.value) + (+b.dataset.d) * p.step); }));
            if (p.key === 'maxPlayers') { const s = document.createElement('span'); s.id = 'max-players-val'; s.hidden = true; s.textContent = p.def; d.appendChild(s); }
        }
    });
    function syncHunters() { const h = $('create-hunter-count'); if (!h) return; const p = P.find(x => x.key === 'hunterCount'); h.max = maxOf(p); if (+h.value > +h.max) { h.value = h.max; h.closest('.cr-p').querySelector('.v').textContent = h.value; } }
    // показ груп параметрів за режимом (початковий стан — детматч)
    function showGroups(mode) {
        grp('create-score-wrap').style.display = mode === 'deathmatch' ? 'block' : 'none';
        grp('create-prophunt-wrap').style.display = mode === 'prophunt' ? 'block' : 'none';
        grp('create-tdm-wrap').style.display = mode === 'team_deathmatch' ? 'block' : 'none';
        const t = $('cr-prev-mode'); if (t) t.textContent = MODE_T[mode] || '';
    }
    ['create-score-wrap', 'create-prophunt-wrap', 'create-tdm-wrap'].forEach(grp);
    showGroups('deathmatch');
    document.querySelectorAll('.create-mode-select').forEach(b => b.addEventListener('click', () => { closeTip(); showGroups(b.dataset.mode); }));
})();
