// ===== ЛОБІ СЕСІЇ =====
// Усі гравці бачать мапу, режим і правила; лідер має зручну панель налаштувань (з підказками «i»: мін/макс), може вигнати гравця
// або передати лідерство. Список гравців залежить від режиму (команди, мисливці/ті, хто ховається, кольори).
(function () {
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const click = () => { if (typeof playSound === 'function') playSound('ui_click'); };

    const MODES = {
        deathmatch: { e: '⚔️', n: 'ДЕТМАТЧ', d: 'Кожен сам за себе. Збирайте жетони й знищуйте суперників — хто першим набере потрібну кількість, той перемагає.' },
        survival: { e: '🧟', n: 'ВИЖИВАННЯ', d: 'Кооператив проти хвиль зомбі. Тримайтесь разом і протримайтесь якомога довше — з кожною хвилею стає важче.' },
        prophunt: { e: '📦', n: 'ХОВАНКИ', d: 'Одні маскуються під предмети, інші полюють. Мисливці мають знайти всіх, ті, хто ховається, — дотягнути до кінця часу.' },
        team_deathmatch: { e: '🤝', n: 'КОМАНДНИЙ', d: 'Команди б’ються за очки. Оберіть свою команду у списку гравців та переможіть суперників.' }
    };
    const TEAMS = {
        hunter: { n: 'Мисливці', c: '239,68,68' }, hider: { n: 'Ті, хто ховається', c: '59,130,246' },
        red: { n: 'Червоні', c: '239,68,68' }, blue: { n: 'Сині', c: '59,130,246' }, green: { n: 'Зелені', c: '34,197,94' }, yellow: { n: 'Жовті', c: '234,179,8' }
    };
    const TDM_TEAMS = ['red', 'blue', 'green', 'yellow'];
    const COLORS = { white: '248,250,252', black: '71,85,105', red: '239,68,68', blue: '59,130,246', brown: '120,53,15', purple: '147,51,234' };

    // параметри, які може міняти лідер (межі збігаються з серверними)
    const PARAMS = [
        { key: 'maxPlayers', label: 'Макс. гравців', min: 2, max: 10, def: 6, step: 1, modes: '*', desc: 'Скільки гравців може бути в сесії одночасно.' },
        { key: 'winScore', label: 'Жетони для перемоги', min: 5, max: 1000, def: 50, step: 5, modes: ['deathmatch'], desc: 'Хто першим збере стільки жетонів — виграє. Чим більше жетонів, тим довший бій і більша нагорода.' },
        { key: 'hideTime', label: 'Час на схованку', min: 30, max: 200, def: 30, step: 5, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд ті, хто ховається, мають, щоб замаскуватись, поки мисливці чекають.' },
        { key: 'seekTime', label: 'Час пошуку', min: 120, max: 600, def: 120, step: 10, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд мисливці шукають. Якщо час вийшов — перемагають ті, хто ховався.' },
        { key: 'hunterCount', label: 'Мисливців', min: 1, max: 9, def: 1, step: 1, modes: ['prophunt'], dyn: true, desc: 'Скільки гравців грає мисливцями. Не більше, ніж гравців у сесії мінус один.' },
        { key: 'tdmTeams', label: 'Команд', min: 2, max: 4, def: 2, step: 1, modes: ['team_deathmatch'], desc: 'Скільки команд беруть участь у бою (червоні, сині, зелені, жовті).' },
        { key: 'tdmTime', label: 'Тривалість бою', min: 60, max: 300, def: 180, step: 10, unit: 'с', modes: ['team_deathmatch'], desc: 'Максимальний час бою. Коли час вийде, перемагає команда з більшою кількістю очків.' },
        { key: 'tdmScore', label: 'Очки для перемоги', min: 5, max: 50, def: 20, step: 1, modes: ['team_deathmatch'], desc: 'Команда, яка першою набере стільки очок (за вбивства), перемагає достроково.' },
        { key: 'tdmAutoBalance', label: 'Автобаланс', type: 'toggle', modes: ['team_deathmatch'], desc: 'Якщо увімкнено — гру не можна почати, поки склади команд відрізняються більш ніж на одного гравця.' }
    ];
    window.LB_PARAMS = PARAMS;
    const cur = () => (typeof currentRoomData !== 'undefined' ? currentRoomData : null);
    const val = (r, p) => r[p.key] != null ? r[p.key] : p.def;
    const maxOf = (r, p) => p.dyn ? Math.max(1, Math.min(9, Object.keys(r.players).length - 1)) : p.max;

    // ---------- панель параметрів лідера (будується один раз) ----------
    let built = false, openTip = null;
    function buildParams() {
        const box = $('host-params'); if (!box) return; built = true; box.innerHTML = '';
        PARAMS.forEach((p, idx) => {
            const d = document.createElement('div'); d.className = 'lb-param'; d.dataset.key = p.key;
            const head = '<div class="lb-param-h"><div class="lb-param-l"><span>' + esc(p.label) + '</span><button type="button" class="lb-i" aria-label="Інформація">i</button></div>';
            if (p.type === 'toggle') d.innerHTML = head + '<div class="lb-sw" role="switch"></div></div><div class="lb-tip hidden"></div>';
            else d.innerHTML = head + '<div class="lb-param-v"><span class="v">0</span>' + (p.unit ? '<small>' + p.unit + '</small>' : '') + '</div></div><div class="lb-step"><button type="button" data-d="-1">−</button><input type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '"><button type="button" data-d="1">+</button></div><div class="lb-tip hidden"></div>';
            box.appendChild(d);
            const tip = d.querySelector('.lb-tip'), ib = d.querySelector('.lb-i');
            const show = () => {
                const r = cur(); const mx = r ? maxOf(r, p) : p.max;
                tip.innerHTML = '<h5>' + esc(p.label) + '</h5>' + esc(p.desc) + (p.type === 'toggle' ? '' : '<div class="lb-tip-r"><div><small>Мін</small><b>' + p.min + (p.unit || '') + '</b></div><div><small>Макс</small><b>' + mx + (p.unit || '') + '</b></div><div><small>Стандарт</small><b>' + p.def + (p.unit || '') + '</b></div></div>');
                tip.classList.toggle('up', [...box.children].filter(x => x.style.display !== 'none').indexOf(d) >= 2);
                tip.classList.remove('hidden'); ib.classList.add('on'); openTip = { tip, ib };
            };
            const hide = () => { tip.classList.add('hidden'); ib.classList.remove('on'); if (openTip && openTip.tip === tip) openTip = null; };
            ib.addEventListener('mouseenter', e => { if (e.pointerType !== 'touch' && matchMedia('(hover:hover)').matches) show(); });
            ib.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) hide(); });
            ib.addEventListener('click', e => { e.stopPropagation(); click(); tip.classList.contains('hidden') ? (closeTip(), show()) : hide(); });
            if (p.type === 'toggle') {
                d.querySelector('.lb-sw').addEventListener('click', () => { click(); const r = cur(); if (r) socket.emit('updateRoomSettings', { roomId: currentRoomId, tdmAutoBalance: !r.tdmAutoBalance }); });
            } else {
                const rg = d.querySelector('input'), vv = d.querySelector('.v');
                let t = null;
                const push = () => { clearTimeout(t); t = setTimeout(() => { const o = { roomId: currentRoomId }; o[p.key] = +rg.value; socket.emit('updateRoomSettings', o); dragging = null; }, 220); };
                rg.addEventListener('input', () => { dragging = p.key; vv.textContent = rg.value; });
                rg.addEventListener('change', () => { push(); });
                d.querySelectorAll('.lb-step button').forEach(b => b.addEventListener('click', () => {
                    click(); dragging = p.key; const r = cur(); const mx = r ? maxOf(r, p) : p.max;
                    rg.value = Math.max(p.min, Math.min(mx, (+rg.value) + (+b.dataset.d) * p.step)); vv.textContent = rg.value; push();
                }));
            }
        });
    }
    function closeTip() { if (openTip) { openTip.tip.classList.add('hidden'); openTip.ib.classList.remove('on'); openTip = null; } }
    document.addEventListener('click', closeTip);
    let dragging = null;

    function updateParams(r) {
        PARAMS.forEach(p => {
            const d = document.querySelector('.lb-param[data-key="' + p.key + '"]'); if (!d) return;
            const on = p.modes === '*' || p.modes.includes(r.mode); d.style.display = on ? '' : 'none';
            if (!on) return;
            if (p.type === 'toggle') { d.querySelector('.lb-sw').classList.toggle('on', !!r.tdmAutoBalance); return; }
            if (dragging === p.key) return;
            const rg = d.querySelector('input'), mx = maxOf(r, p); rg.max = mx; rg.value = Math.min(val(r, p), mx); d.querySelector('.v').textContent = rg.value;
        });
    }

    // ---------- інформація для всіх ----------
    const mapTitle = n => { const m = (typeof MAP_DATA !== 'undefined') && MAP_DATA[n]; return (m && m.title) || n || '---'; };
    function rule(i, l, v) { return '<div class="lb-rule"><i>' + i + '</i><div><small>' + l + '</small><b>' + v + '</b></div></div>'; }
    function renderInfo(r) {
        const M = MODES[r.mode] || MODES.deathmatch;
        $('lobby-room-name').textContent = r.hostName + ' · СЕСІЯ';
        $('lobby-mode-chip').textContent = M.e + ' ' + M.n;
        $('lobby-host-chip').textContent = '👑 ' + r.hostName;
        $('lobby-mode-badge').textContent = M.e + ' ' + M.n;
        $('lobby-mode-desc').textContent = M.d;
        $('lobby-map-title').textContent = mapTitle(r.map);
        const n = Object.keys(r.players).length;
        $('lobby-count').textContent = n + ' / ' + r.maxPlayers;
        let h = rule('👥', 'Гравців', n + ' / ' + r.maxPlayers);
        if (r.mode === 'deathmatch') h += rule('🎯', 'Жетонів', r.winScore);
        else if (r.mode === 'survival') h += rule('🌊', 'Хвилі', '∞') + rule('🤝', 'Режим', 'Кооп');
        else if (r.mode === 'prophunt') h += rule('📦', 'Схованка', (r.hideTime || 30) + 'с') + rule('🔍', 'Пошук', (r.seekTime || 120) + 'с') + rule('🔴', 'Мисливців', r.hunterCount || 1);
        else if (r.mode === 'team_deathmatch') h += rule('🚩', 'Команд', r.tdmTeams || 2) + rule('⏱', 'Час', (r.tdmTime || 180) + 'с') + rule('🏁', 'Очки', r.tdmScore || 20) + rule('⚖️', 'Автобаланс', r.tdmAutoBalance ? '✓' : '✗');
        $('lobby-rules').innerHTML = h;
    }
    let lastMap = null;
    function drawMap(force) {
        const r = cur(); if (!r) return; const cv = $('lobby-map-canvas'); if (!cv) return;
        if (!force && lastMap === r.map + '|' + cv.parentElement.clientWidth) return;
        if (!cv.parentElement.clientWidth) return;          // вкладка прихована
        lastMap = r.map + '|' + cv.parentElement.clientWidth;
        if (typeof drawMapPreview === 'function') drawMapPreview(r.map, 'lobby-map-canvas', null);
    }
    window.addEventListener('resize', () => { setTimeout(() => drawMap(true), 150); });

    // ---------- список гравців ----------
    let kickArm = null;
    function level(p) { return Math.max(1, Math.min(15, p.level || 1)); }
    function card(r, id, p, isHost) {
        const L = level(p), rank = (window.LV ? LV.rankName(L) : ''), me = id === myId, host = id === r.hostSocket;
        let pc = '71,85,105'; if (r.mode === 'deathmatch' || r.mode === 'survival') pc = p.color ? COLORS[p.color] : pc;
        else if (p.team && TEAMS[p.team]) pc = TEAMS[p.team].c;
        const dot = (r.mode === 'deathmatch' || r.mode === 'survival') ? '<span class="lb-dot" style="background:rgb(' + pc + ')"></span>' : '';
        let acts = '';
        if (isHost && !me) acts = '<div class="lb-acts"><button type="button" class="lb-act" data-act="crown" data-id="' + esc(id) + '" title="Зробити лідером">👑</button><button type="button" class="lb-act danger" data-act="kick" data-id="' + esc(id) + '" title="Вигнати з сесії">✖</button><button type="button" class="lb-act danger" data-act="ban" data-id="' + esc(id) + '" title="Заблокувати в цій сесії">🚫</button></div>';
        return '<div class="lb-pl' + (p.ready ? ' ready' : '') + (me ? ' me' : '') + '" style="--pc:' + pc + '">' + dot +
            '<span class="lb-pl-ico">' + (window.LV ? LV.icon(L, 32) : '') + '</span>' +
            '<div class="lb-pl-main"><span class="lb-pl-name">' + esc(p.name) + (host ? '<em>👑</em>' : '') + (me ? '<u>ВИ</u>' : '') + '</span><span class="lb-pl-lv">Рівень <b>' + L + '</b> · ' + esc(rank) + '</span></div>' +
            '<span class="lb-pl-st">' + (p.ready ? 'ГОТОВИЙ' : 'ЧЕКАЄ') + '</span>' + acts + '</div>';
    }
    function teamBox(r, key, members, isHost, cap) {
        const T = TEAMS[key], mine = r.players[myId] && r.players[myId].team === key, full = cap != null && members.length >= cap && !mine;
        const list = members.length ? members.map(([id, p]) => card(r, id, p, isHost)).join('') : '<div class="lb-empty">порожньо</div>';
        return '<div class="lb-team' + (mine ? ' mine' : '') + '" style="--pc:' + T.c + '"><div class="lb-team-h"><b>' + T.n + '</b><span>' + members.length + (cap != null ? ' / ' + cap : '') + '</span></div>' + list +
            '<button type="button" class="lb-join" data-team="' + key + '"' + (mine || full ? ' disabled' : '') + '>' + (mine ? '✓ Ви тут' : full ? 'Заповнено' : 'Приєднатись') + '</button></div>';
    }
    function renderRoster(r) {
        const entries = Object.entries(r.players), isHost = myId === r.hostSocket;
        let h = '';
        if (r.mode === 'prophunt') {
            const hu = entries.filter(([, p]) => p.team === 'hunter'), hi = entries.filter(([, p]) => p.team === 'hider'), no = entries.filter(([, p]) => !p.team);
            h = '<div class="lb-teams">' + teamBox(r, 'hunter', hu, isHost, r.hunterCount || 1) + teamBox(r, 'hider', hi, isHost, null) + '</div>';
            $('lobby-roster-title').textContent = 'Команди'; $('lobby-roster-sub').textContent = 'Мисливців: ' + hu.length + ' / ' + (r.hunterCount || 1);
            if (no.length) h += '<div class="lb-unass-h">Без команди</div>' + no.map(([id, p]) => card(r, id, p, isHost)).join('');
        } else if (r.mode === 'team_deathmatch') {
            const keys = TDM_TEAMS.slice(0, r.tdmTeams || 2), no = entries.filter(([, p]) => !p.team || !keys.includes(p.team));
            h = '<div class="lb-teams">' + keys.map(k => teamBox(r, k, entries.filter(([, p]) => p.team === k), isHost, null)).join('') + '</div>';
            $('lobby-roster-title').textContent = 'Команди';
            const sizes = keys.map(k => entries.filter(([, p]) => p.team === k).length), unb = r.tdmAutoBalance && sizes.some(x => x > 0) && Math.max(...sizes) - Math.min(...sizes) > 1;
            $('lobby-roster-sub').textContent = unb ? '⚖️ склади нерівні' : (r.tdmAutoBalance ? '⚖️ автобаланс' : '');
            if (no.length) h += '<div class="lb-unass-h">Без команди</div>' + no.map(([id, p]) => card(r, id, p, isHost)).join('');
        } else {
            $('lobby-roster-title').textContent = 'Загін'; $('lobby-roster-sub').textContent = entries.filter(([, p]) => p.ready).length + ' готові';
            h = entries.map(([id, p]) => card(r, id, p, isHost)).join('');
        }
        $('players-list').innerHTML = h;
    }
    $('players-list').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; const r = cur(); if (!r) return;
        if (b.dataset.team) { click(); socket.emit('setTeam', { roomId: currentRoomId, team: b.dataset.team }); return; }
        const id = b.dataset.id; if (!id) return;
        if (b.dataset.act === 'crown') { click(); socket.emit('transferHost', { roomId: currentRoomId, targetId: id }); }
        else if (b.dataset.act === 'ban') {
            click(); const nm = (r.players[id] && r.players[id].name) || '';
            uiDialog.confirm({ kind: 'danger', icon: '🚫', title: 'Заблокувати гравця?', text: nm + ' буде вигнано, і він більше не зможе зайти саме в цю сесію. В інші сесії його вхід не обмежується.', cancelText: 'Скасувати', okText: 'Заблокувати', danger: true })
                .then(ok => { if (ok && cur() && cur().players[id]) socket.emit('banPlayer', { roomId: currentRoomId, targetId: id }); });
        }
        else if (b.dataset.act === 'kick') {
            if (kickArm === id) { kickArm = null; click(); socket.emit('kickPlayer', { roomId: currentRoomId, targetId: id }); }
            else { kickArm = id; click(); b.classList.add('confirm'); b.textContent = 'ТОЧНО?'; setTimeout(() => { if (kickArm === id) { kickArm = null; if (cur()) renderRoster(cur()); } }, 2600); }
        }
    });

    // ---------- низ: колір / команда / готовність ----------
    function renderFoot(r) {
        const me = r.players[myId]; if (!me) return;
        myColor = me.color; isReady = me.ready;
        const dm = r.mode === 'deathmatch' || r.mode === 'survival', taken = new Set(Object.entries(r.players).filter(([id, p]) => id !== myId && p.color).map(([, p]) => p.color));
        $('color-selectors').classList.toggle('hidden', !dm); $('lb-team-hint').classList.toggle('hidden', dm);
        document.querySelectorAll('#color-selectors .color-btn').forEach(b => { const c = b.dataset.color; b.classList.toggle('selected', c === me.color); b.disabled = taken.has(c); });
        const btn = $('btn-ready'), ids = Object.keys(r.players), all = ids.every(id => r.players[id].ready), can = dm ? !!me.color : !!me.team, host = myId === r.hostSocket;
        let t, st;
        if (!can) { t = dm ? 'ОБЕРІТЬ КАМУФЛЯЖ' : 'ОБЕРІТЬ КОМАНДУ'; st = 'is-disabled'; }
        else if (host) { if (me.ready) { if (ids.length >= 2 && all) { t = '🚀 ЗАПУСК СЕСІЇ'; st = 'is-go'; } else { t = 'ГОТОВИЙ (ЧЕКАЄМО...)'; st = 'is-wait'; } } else { t = 'ПІДТВЕРДИТИ'; st = ''; } }
        else { if (me.ready) { t = 'ВІДМІНИТИ'; st = 'is-wait'; } else { t = 'ПІДТВЕРДИТИ'; st = ''; } }
        btn.textContent = t; btn.disabled = !can; btn.className = 'lb-ready ' + st;
    }

    // ---------- головний оновлювач ----------
    let prevHost = null, inited = false;
    window.updateLobbyUI = function () {
        const r = cur(); if (!r || r.status === 'playing') return;
        if (!built) buildParams();
        const lb = $('lobby-screen');
        if (!inited) { inited = true; lb.dataset.tab = 'players'; if (window.syncMapButtons) syncMapButtons(); }
        const isHost = myId === r.hostSocket;
        if (prevHost && prevHost !== r.hostSocket && r.hostSocket === myId) toast('👑 Вас призначено лідером сесії!');
        prevHost = r.hostSocket;
        renderInfo(r);
        const hp = $('host-settings-panel'); hp.classList.toggle('hidden', !isHost); $('lb-guest-note').classList.toggle('hidden', isHost);
        if (isHost) {
            if (window.filterMapButtons) filterMapButtons('host-map-select', r.mode, r.map);
            document.querySelectorAll('.host-mode-select').forEach(el => el.classList.toggle('selected', el.dataset.mode === r.mode));
            document.querySelectorAll('.host-map-select').forEach(el => el.classList.toggle('selected', el.dataset.map === r.map));
            updateParams(r);
        }
        renderRoster(r); renderFoot(r); drawMap(false);
    };
    window.resetLobbyUI = function () { prevHost = null; lastMap = null; dragging = null; kickArm = null; inited = false; };

    document.querySelectorAll('.host-mode-select').forEach(b => b.addEventListener('click', () => { click(); socket.emit('updateRoomSettings', { roomId: currentRoomId, mode: b.dataset.mode }); }));
    document.querySelectorAll('.lb-tab').forEach(b => b.addEventListener('click', () => { click(); document.querySelectorAll('.lb-tab').forEach(x => x.classList.toggle('active', x === b)); $('lobby-screen').dataset.tab = b.dataset.lbtab; setTimeout(() => drawMap(true), 30); }));

    // ---------- повідомлення ----------
    function toast(msg, err) {
        const t = document.createElement('div'); t.className = 'ui-toast' + (err ? ' err' : ''); t.textContent = msg; document.body.appendChild(t);
        setTimeout(() => { t.style.transition = 'opacity .4s'; t.style.opacity = 0; setTimeout(() => t.remove(), 450); }, 3200);
    }
    window.uiToast = toast;
})();
