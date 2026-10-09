// ===== ЛОБІ СЕСІЇ =====
// Усі гравці бачать мапу, режим і правила; лідер має зручну панель налаштувань (з підказками «i»: мін/макс), може вигнати гравця
// або передати лідерство. Список гравців залежить від режиму (команди, мисливці/ті, хто ховається, кольори).
(function () {
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const click = () => { if (typeof playSound === 'function') playSound('ui_click'); };

    const MI = window.ModeInfo, MODES = {};
    MI.ORDER.forEach(k => { const m = MI.MODES[k]; MODES[k] = { e: m.e, n: m.n, d: m.d }; });
    const TEAMS = {
        hunter: { n: 'Мисливці', c: '239,68,68' }, hider: { n: 'Ті, хто ховається', c: '59,130,246' },
        red: { n: 'Червоні', c: '239,68,68' }, blue: { n: 'Сині', c: '59,130,246' }, green: { n: 'Зелені', c: '34,197,94' }, yellow: { n: 'Жовті', c: '234,179,8' }
    };
    const TDM_TEAMS = ['red', 'blue', 'green', 'yellow'];
    const COLORS = { white: '248,250,252', black: '71,85,105', red: '239,68,68', blue: '59,130,246', brown: '120,53,15', purple: '147,51,234', green: '22,163,74', yellow: '234,179,8', orange: '249,115,22', cyan: '6,182,212' };

    // параметри, які може міняти лідер (межі збігаються з серверними — спільний файл modeinfo.js)
    const PARAMS = MI.PARAMS;
    window.LB_PARAMS = PARAMS;
    const cur = () => (typeof currentRoomData !== 'undefined' ? currentRoomData : null);
    const val = (r, p) => r[p.key] != null ? r[p.key] : p.def;
    const isOn = (p, mode) => MI.paramOn(p, mode);
    const maxOf = (r, p) => p.dyn ? Math.max(1, Math.min(9, Object.keys(r.players).length - 1)) : p.max;

    // ---------- панель параметрів лідера (будується один раз) ----------
    let built = false, openTip = null;
    function buildParams() {
        const box = $('host-params'); if (!box) return; built = true; box.innerHTML = '';
        PARAMS.forEach((p, idx) => {
            const d = document.createElement('div'); d.className = 'lb-param'; d.dataset.key = p.key;
            const head = '<div class="lb-param-h"><div class="lb-param-l"><span>' + esc(p.label) + '</span><button type="button" class="lb-i" aria-label="Інформація">i</button></div>';
            if (p.type === 'toggle') d.innerHTML = head + '<div class="lb-sw" role="switch"></div></div><div class="lb-tip hidden"></div>';
            else if (p.type === 'choice') d.innerHTML = head + '</div><div class="lb-seg">' + p.options.map(o => '<button type="button" data-v="' + esc(o.v) + '">' + esc(o.l) + '</button>').join('') + '</div><div class="lb-tip hidden"></div>';
            else d.innerHTML = head + '<div class="lb-param-v"><span class="v">0</span>' + (p.unit ? '<small>' + p.unit + '</small>' : '') + '</div></div><div class="lb-step"><button type="button" data-d="-1">−</button><input type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.step + '"><button type="button" data-d="1">+</button></div><div class="lb-tip hidden"></div>';
            box.appendChild(d);
            const tip = d.querySelector('.lb-tip'), ib = d.querySelector('.lb-i');
            const show = () => {
                const r = cur(); const mx = r ? maxOf(r, p) : p.max;
                tip.innerHTML = '<h5>' + esc(p.label) + '</h5>' + esc(p.desc) + (p.type === 'toggle' || p.type === 'choice' ? '' : '<div class="lb-tip-r"><div><small>Мін</small><b>' + p.min + (p.unit || '') + '</b></div><div><small>Макс</small><b>' + mx + (p.unit || '') + '</b></div><div><small>Стандарт</small><b>' + p.def + (p.unit || '') + '</b></div></div>');
                tip.classList.toggle('up', [...box.children].filter(x => x.style.display !== 'none').indexOf(d) >= 2);
                tip.classList.remove('hidden'); ib.classList.add('on'); openTip = { tip, ib };
            };
            const hide = () => { tip.classList.add('hidden'); ib.classList.remove('on'); if (openTip && openTip.tip === tip) openTip = null; };
            ib.addEventListener('mouseenter', e => { if (e.pointerType !== 'touch' && matchMedia('(hover:hover)').matches) show(); });
            ib.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) hide(); });
            ib.addEventListener('click', e => { e.stopPropagation(); click(); tip.classList.contains('hidden') ? (closeTip(), show()) : hide(); });
            if (p.type === 'toggle') {
                d.querySelector('.lb-sw').addEventListener('click', () => { click(); const r = cur(); if (r) { const o = { roomId: currentRoomId }; o[p.key] = !val(r, p); socket.emit('updateRoomSettings', o); } });
            } else if (p.type === 'choice') {
                d.querySelectorAll('.lb-seg button').forEach(b => b.addEventListener('click', () => { click(); const o = { roomId: currentRoomId }; o[p.key] = b.dataset.v; socket.emit('updateRoomSettings', o); }));
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
            const d = document.querySelector('#host-params .lb-param[data-key="' + p.key + '"]'); if (!d) return;
            const on = isOn(p, r.mode); d.style.display = on ? '' : 'none';
            if (!on) return;
            if (p.type === 'toggle') { d.querySelector('.lb-sw').classList.toggle('on', !!val(r, p)); return; }
            if (p.type === 'choice') { d.querySelectorAll('.lb-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === val(r, p))); return; }
            if (dragging === p.key) return;
            const rg = d.querySelector('input'), mx = maxOf(r, p); rg.max = mx; rg.value = Math.min(val(r, p), mx); d.querySelector('.v').textContent = rg.value;
        });
    }

    // ---------- інформація для всіх ----------
    const mapTitle = n => { const m = (typeof MAP_DATA !== 'undefined') && MAP_DATA[n]; return (m && m.title) || n || '---'; };
    function rule(i, l, v) { return '<div class="lb-rule"><i>' + i + '</i><div><small>' + l + '</small><b>' + v + '</b></div></div>'; }
    function renderInfo(r) {
        const M = MODES[r.mode] || MODES.deathmatch;
        $('lobby-room-name').textContent = (window.dispName ? dispName(r.hostName) : r.hostName) + ' · СЕСІЯ';
        $('lobby-mode-chip').textContent = M.e + ' ' + M.n;
        $('lobby-host-chip').textContent = '👑 ' + (window.dispName ? dispName(r.hostName) : r.hostName);
        $('lobby-mode-badge').textContent = M.e + ' ' + M.n;
        $('lobby-mode-desc').textContent = M.d;
        $('lobby-map-title').textContent = mapTitle(r.map);
        const n = Object.keys(r.players).length;
        $('lobby-count').textContent = n + ' / ' + r.maxPlayers;
        let h = rule('👥', 'Гравців', n + ' / ' + r.maxPlayers);
        const v = k => val(r, MI.BYKEY[k]), tm = k => { const t = +v(k); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); }, yn = k => v(k) ? '✓' : '✗';
        switch (r.mode) {
            case 'deathmatch': h += rule('🎯', 'Жетонів', r.winScore); break;
            case 'survival': h += rule('🌊', 'Хвилі', '∞') + rule('🤝', 'Режим', 'Кооп'); break;
            case 'prophunt': h += rule('📦', 'Схованка', (r.hideTime || 30) + 'с') + rule('🔍', 'Пошук', (r.seekTime || 120) + 'с') + rule('🔴', 'Мисливців', r.hunterCount || 1); break;
            case 'team_deathmatch': h += rule('🚩', 'Команд', r.tdmTeams || 2) + rule('⏱', 'Час', (r.tdmTime || 180) + 'с') + rule('🏁', 'Очки', r.tdmScore || 20) + rule('⚖️', 'Автобаланс', r.tdmAutoBalance ? '✓' : '✗'); break;
            case 'base_defense': h += rule('🌊', 'Хвиль', v('bdWaves')) + rule('🏰', 'Ядро', v('bdCoreHp')) + rule('💪', 'Складність', v('pveDiff') + '%') + rule('🔧', 'Ремонт', yn('bdRepair')); break;
            case 'boss_raid': h += rule('👹', 'Бос', MI.BOSS_NAMES[v('rbBoss')]) + rule('❤️', 'Життів', v('rbLives')) + rule('⏱', 'Час', tm('rbTime')) + rule('💪', 'Складність', v('pveDiff') + '%') + rule('👥', 'Приспішники', yn('rbMinions')); break;
            case 'convoy': h += rule('🚚', 'Конвой', v('cvHp')) + rule('⚡', 'Швидкість', v('cvSpeed')) + rule('⏱', 'Час', tm('cvTime')) + rule('💪', 'Складність', v('pveDiff') + '%'); break;
            case 'solo_arena': h += rule('🌊', 'Хвиль', v('saWaves')) + rule('💪', 'Складність', v('pveDiff') + '%') + rule('🩹', 'Лікування', yn('saHeal')); break;
            case 'boss_duel': h += rule('💀', 'Босів', v('duBosses')) + rule('❤️', 'Життів', v('duLives')) + rule('💪', 'Складність', v('pveDiff') + '%') + rule('🩹', 'Лікування', yn('duHeal')); break;
            case 'battle_royale': h += rule('⏱', 'До фіналу', tm('brTime')) + rule('☣️', 'Шкода зони', v('brDmg') + '%/с') + rule('🎁', 'Модулі', yn('brLoot')); break;
            case 'capture_points': h += rule('🚩', 'Команд', v('cpTeams')) + rule('📍', 'Точок', v('cpPoints')) + rule('🏁', 'Очки', v('cpScore')) + rule('⏱', 'Час', tm('cpTime')); break;
            case 'bounty': h += rule('🏁', 'Очки', v('bnScore')) + rule('⏱', 'Час', tm('bnTime')) + rule('🎯', 'Зміна цілі', v('bnInterval') + 'с'); break;
            case 'rounds': h += rule('🔁', 'Раундів', v('rdRounds')) + rule('⏱', 'Раунд', v('rdTime') + 'с') + rule('🤝', 'Нічия', yn('rdDraw')); break;
        }
        const rr = MI.rewardRange(r.mode, r);
        h += rule(creditIcon(20), 'Нагорода', rr.loss + '–' + rr.win) + (rr.draw != null ? rule('🤝', 'Нічия', creditAmount(rr.draw, 14)) : '');
        const lr = $('lobby-rules'); if (lr.__h !== h) { lr.__h = h; lr.innerHTML = h; }
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
    function statLine(p) {
        const s = p && p.stats; if (!s || !(s.games > 0)) return '';
        const kd = s.deaths > 0 ? (s.kills / s.deaths).toFixed(2) : String(s.kills || 0), wr = Math.round(100 * (s.wins || 0) / s.games);
        return '<span class="lb-pl-lv lb-pl-stat" title="K/D · win rate">K/D <b>' + kd + '</b> · <b>' + wr + '%</b></span>';
    }
    function card(r, id, p, isHost) {
        const L = level(p), rank = (window.LV ? LV.rankName(L) : ''), me = id === myId, host = id === r.hostSocket;
        let pc = '71,85,105'; if (MI.usesColor(r.mode)) pc = p.color ? COLORS[p.color] : pc;
        else if (p.team && TEAMS[p.team]) pc = TEAMS[p.team].c;
        const dot = MI.usesColor(r.mode) ? '<span class="lb-dot" style="background:rgb(' + pc + ')"></span>' : '';
        let acts = '';
        if (isHost && !me) acts = '<div class="lb-acts"><button type="button" class="lb-act" data-act="crown" data-id="' + esc(id) + '" title="Зробити лідером">👑</button><button type="button" class="lb-act danger" data-act="kick" data-id="' + esc(id) + '" title="Вигнати з сесії">✖</button><button type="button" class="lb-act danger" data-act="ban" data-id="' + esc(id) + '" title="Заблокувати в цій сесії">🚫</button></div>';
        return '<div data-key="' + esc(id) + '" class="lb-pl' + (p.ready ? ' ready' : '') + (p.away ? ' away' : '') + (me ? ' me' : '') + '" style="--pc:' + pc + '">' + dot +
            '<span class="lb-pl-ico">' + (window.LV ? LV.icon(L, 32) : '') + '</span>' +
            '<div class="lb-pl-main"><span class="lb-pl-name">' + esc(window.dispName ? dispName(p) : p.name) + (host ? '<em>👑</em>' : '') + (me ? '<u>ВИ</u>' : '') + '</span><span class="lb-pl-lv">Рівень <b>' + L + '</b> · ' + esc(rank) + '</span>' + statLine(p) + '</div>' +
            '<span class="lb-pl-st" title="' + (p.away ? 'Ще дивиться результати бою' : '') + '">' + (p.away ? '🎮 У ГРІ' : p.ready ? 'ГОТОВИЙ' : 'ЧЕКАЄ') + '</span>' + acts + '</div>';
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
        } else if (MI.isTeamPvp(r.mode)) {
            const keys = TDM_TEAMS.slice(0, (r.mode === 'rounds' || r.rk ? 2 : r.mode === 'capture_points' ? r.cpTeams : r.tdmTeams) || 2), no = entries.filter(([, p]) => !p.team || !keys.includes(p.team));
            h = '<div class="lb-teams">' + keys.map(k => teamBox(r, k, entries.filter(([, p]) => p.team === k), isHost, null)).join('') + '</div>';
            $('lobby-roster-title').textContent = 'Команди';
            const sizes = keys.map(k => entries.filter(([, p]) => p.team === k).length), unb = r.tdmAutoBalance && sizes.some(x => x > 0) && Math.max(...sizes) - Math.min(...sizes) > 1;
            $('lobby-roster-sub').textContent = unb ? '⚖️ склади нерівні' : (r.tdmAutoBalance ? '⚖️ автобаланс' : '');
            if (no.length) h += '<div class="lb-unass-h">Без команди</div>' + no.map(([id, p]) => card(r, id, p, isHost)).join('');
        } else {
            $('lobby-roster-title').textContent = 'Загін'; $('lobby-roster-sub').textContent = entries.filter(([, p]) => p.ready).length + ' готові';
            h = entries.map(([id, p]) => card(r, id, p, isHost)).join('');
        }
        const pl = $('players-list'); if (pl.__h !== h) { pl.__h = h; if (window.DomPatch && pl.firstChild) DomPatch.html(pl, h); else pl.innerHTML = h; }   // лише змінені вузли: без блимання при готовності/вході ботів
    }
    $('players-list').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; const r = cur(); if (!r) return;
        if (b.dataset.team) { click(); socket.emit('setTeam', { roomId: currentRoomId, team: b.dataset.team }); return; }
        const id = b.dataset.id; if (!id) return;
        if (b.dataset.act === 'crown') { click(); socket.emit('transferHost', { roomId: currentRoomId, targetId: id }); }
        else if (b.dataset.act === 'ban') {
            click(); const nm = (r.players[id] && (window.dispName ? dispName(r.players[id]) : r.players[id].name)) || '';
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
        const dm = MI.usesColor(r.mode), taken = new Set(Object.entries(r.players).filter(([id, p]) => id !== myId && p.color).map(([, p]) => p.color));
        $('color-selectors').classList.toggle('hidden', !dm); $('lb-team-hint').classList.toggle('hidden', dm);
        document.querySelectorAll('#color-selectors .color-btn').forEach(b => { const c = b.dataset.color; b.classList.toggle('selected', c === me.color); b.disabled = taken.has(c); });
        const btn = $('btn-ready'), ids = Object.keys(r.players), all = ids.every(id => r.players[id].ready), can = dm ? !!me.color : !!me.team, host = myId === r.hostSocket;
        let t, st;
        if (!can) { t = dm ? 'ОБЕРІТЬ КАМУФЛЯЖ' : 'ОБЕРІТЬ КОМАНДУ'; st = 'is-disabled'; }
        else if (host) { if (me.ready) { if (ids.length >= MI.minPlayers(r.mode) && all) { t = '🚀 ЗАПУСК СЕСІЇ'; st = 'is-go'; } else { t = 'ГОТОВИЙ (ЧЕКАЄМО...)'; st = 'is-wait'; } } else { t = 'ПІДТВЕРДИТИ'; st = ''; } }
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
