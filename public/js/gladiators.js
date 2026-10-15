// ===== «ГЛАДІАТОРИ»: інтерфейс гравця (сервер — gladiators.js у корені) =====
// Верхня панель (раунд, таймер, життя, поінти), відлік останніх 5 с зі звуком, Лавка (бафи й кейси — зона на Форумі),
// Табло ставок (зона + кнопка), вибір 1 з 3 модулів, тимчасовий інвентар (X / кнопка, лише на Форумі), спостереження,
// вікна «Хвилю відбито», підсумок дуелі, вибуття й фінал. Переходи між кімнатами: 'glHop' + звичайний 'gameStarting' без відліку.
(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const snd = n => { if (typeof playSound === 'function') playSound(n); };
    const toast = (t, err) => { if (window.uiToast) uiToast(t, err); };
    const MODES_GL = { gladiators: 'hub', gl_arena: 'arena', gl_duel: 'duel' };
    const ZONES = { shop: { x: 1790, y: 640, r: 150 }, bets: { x: 610, y: 640, r: 150 } };      // збігається з gladiators.js / tools/genforum.js
    const SLOTN = { cannon: 'Дуло', turret: 'Башта', hull: 'Корпус', tracks: 'Гусениці' };
    const RAR = () => (typeof RARITY !== 'undefined' ? RARITY : (window.GameData && GameData.RARITY) || {});
    const RCOL = r => (RAR()[r] ? RAR()[r].color : '#94a3b8');
    const RNAME = r => (RAR()[r] ? RAR()[r].name : r);
    const MOD = id => (typeof MODULES !== 'undefined' && MODULES[id]) || null;
    const low = () => document.documentElement.classList.contains('gfx-low');
    const PT = '<i class="gl-coin" aria-hidden="true"></i>';      // поінти гри (не креди акаунту): намальована монетка — однакова на всіх пристроях

    const S = { st: null, stAt: 0, me: null, kind: null, zone: null, dismiss: {}, lastBeep: -1, hop: false, over: false };
    const kindNow = () => (typeof currentRoomData !== 'undefined' && currentRoomData ? MODES_GL[currentRoomData.mode] || null : null);
    const playing = () => { const g = $('game-screen'); return !!(g && !g.classList.contains('hidden')); };
    const active = () => !!kindNow() && !!S.st && S.st.ph !== 'end' && playing();
    const left = () => S.st ? Math.max(0, S.st.left - (performance.now() - S.stAt)) : 0;
    const mmss = ms => { const t = Math.ceil(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    const rosterOf = id => S.st && S.st.roster.find(q => q.id === id);
    const rid = () => (typeof currentRoomId !== 'undefined' ? currentRoomId : null);

    // ---------- звук відліку (WebAudio, без файлів) ----------
    let AC = null;
    function beep(f, dur, vol) {
        try {
            AC = AC || (typeof audioCtx !== 'undefined' && audioCtx) || new (window.AudioContext || window.webkitAudioContext)();
            const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
            o.type = 'square'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
            o.connect(g); g.connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
        } catch (e) {}
    }

    // ---------- розмітка ----------
    function build() {
        if ($('gl-hud')) return;
        const d = document.createElement('div'); d.id = 'gl-root';
        d.innerHTML =
            '<div id="gl-hud" class="gl-hud hidden">' +
              '<div class="gl-rd"><small>РАУНД</small><b id="gl-round">1</b></div>' +
              '<div class="gl-mid"><small id="gl-ph">Форум</small><b id="gl-timer">0:00</b></div>' +
              '<div class="gl-lv" id="gl-lives"></div>' +
              '<div class="gl-pts"><i>' + PT + '</i><b id="gl-pts">0</b><em id="gl-pd"></em></div>' +
            '</div>' +
            '<div id="gl-acts" class="gl-acts hidden">' +
              '<button type="button" id="gl-b-inv"><i>🎒</i><span>Інвентар</span><kbd id="gl-kx">X</kbd></button>' +
              '<button type="button" id="gl-b-bet" class="hidden"><i>🎲</i><span>Ставки</span></button>' +
              '<button type="button" id="gl-b-shop" class="hidden"><i>🛒</i><span>Лавка</span></button>' +
              '<button type="button" id="gl-b-watch" class="hidden"><i>👁</i><span>Дивитись</span></button>' +
            '</div>' +
            '<div id="gl-duelbar" class="gl-duelbar hidden"></div>' +
            '<div id="gl-big" class="gl-big hidden"></div>' +
            '<div id="gl-ban" class="gl-ban hidden"></div>' +
            '<div id="gl-panel" class="gl-panel hidden"><div class="gl-pbox"></div></div>';
        document.body.appendChild(d);
        $('gl-b-inv').onclick = () => { snd('ui_click'); openInv(); };
        $('gl-b-bet').onclick = () => { snd('ui_click'); openBets(); };
        $('gl-b-shop').onclick = () => { snd('ui_click'); openShop(); };
        $('gl-b-watch').onclick = () => { snd('ui_click'); openWatch(); };
        $('gl-panel').addEventListener('click', e => { if (e.target.id === 'gl-panel') closePanel(); });
    }

    // ---------- верхня панель ----------
    let lastPts = null;
    function hud() {
        build();
        const on = active(); $('gl-hud').classList.toggle('hidden', !on); $('gl-acts').classList.toggle('hidden', !on);
        const dm = $('deathmatch-score-hud'); if (dm) { const want = kindNow() ? 'none' : ''; if (dm.style.display !== want) dm.style.display = want; }      // таблиця жетонів детматчу тут не потрібна
        if (!on) { $('gl-duelbar').classList.add('hidden'); $('gl-big').classList.add('hidden'); return; }
        const st = S.st, me = S.me || {}, k = kindNow(), L = left();
        set('gl-round', String(st.ph === 'hub' ? st.round + 1 : st.round));
        const ph = k === 'hub' ? (st.ph === 'hub' ? (st.round === 0 ? 'Форум · підготовка' : 'Форум · до раунду') : me.out ? 'Ви вибули · Форум' : 'Форум · чекаємо інших') :
            k === 'arena' ? (me.out || myHp() <= 0 && !me.lives ? 'Спостереження' : 'Колізей · зомбі ' + (S.zl != null ? S.zl : '…')) : (isDuelist() ? 'Дуель!' : 'Спостереження · дуель');
        set('gl-ph', ph);
        set('gl-timer', st.ph === 'hub' ? mmss(L) : arenaClock());
        $('gl-timer').classList.toggle('warn', st.ph === 'hub' && L <= 10000);
        // серця: червоні — звичайні життя (+1 куплене), чорні — прокляття (−10% до всього за кожне)
        const lv = Math.max(0, me.lives == null ? 3 : me.lives), cu = me.curse | 0; let h = '';
        for (let i = 0; i < Math.max(3, lv); i++) h += '<i class="' + (i < lv ? 'on' : '') + '">❤</i>';
        for (let i = 0; i < cu; i++) h += '<i class="cur" title="Прокляття −' + (cu * 10) + '%">🖤</i>';
        setH('gl-lives', h);
        const pts = me.pts | 0; if (lastPts != null && pts !== lastPts) popPts(pts - lastPts); lastPts = pts; set('gl-pts', String(pts));
        // кнопки дій
        const hubNow = k === 'hub', duel = st.duel;
        $('gl-b-inv').classList.toggle('hidden', !hubNow || me.out);
        $('gl-b-bet').classList.toggle('hidden', !(hubNow && duel && duel.open && !isDuelist() && st.ph === 'hub'));
        $('gl-b-shop').classList.toggle('hidden', !(hubNow && !me.out));
        $('gl-b-watch').classList.toggle('hidden', !(st.ph === 'fight' && (me.out || me.done)));
        if (window.KB) set('gl-kx', KB.label('inventory'));
        duelBar(); countdown(L);
    }
    function arenaClock() { if (!S.arenaT0) return '—'; const t = Date.now() - S.arenaT0; return mmss(Math.max(0, t)); }
    function myHp() { return typeof myLocalTank !== 'undefined' ? myLocalTank.hp : 0; }
    function isDuelist() { const d = S.st && S.st.duel; return !!d && typeof myId !== 'undefined' && (d.a === myId || d.b === myId); }
    function set(id, t) { const e = $(id); if (e && e.textContent !== t) e.textContent = t; }
    function setH(id, h) { const e = $(id); if (e && e.__h !== h) { e.__h = h; e.innerHTML = h; } }
    function popPts(dv) {
        const e = $('gl-pd'); if (!e || !dv) return;
        e.textContent = (dv > 0 ? '+' : '') + dv; e.className = dv > 0 ? 'up' : 'dn'; e.style.animation = 'none'; void e.offsetWidth; e.style.animation = '';
    }
    // панель дуелі (Форум перед раундом / дуель триває)
    function duelBar() {
        const b = $('gl-duelbar'), d = S.st.duel, k = kindNow();
        if (!d || (S.st.ph !== 'hub' && k !== 'duel')) { b.classList.add('hidden'); return; }
        const A = rosterOf(d.a), B = rosterOf(d.b); if (!A || !B) { b.classList.add('hidden'); return; }
        const tag = S.st.ph === 'hub' ? (d.open ? 'СТАВКИ ВІДКРИТО · ' + mmss(Math.max(0, left() - S.st.betClose)) : 'СТАВКИ ЗАКРИТО') : 'ДУЕЛЬ ТРИВАЄ';
        setH('gl-duelbar', '<small>' + tag + '</small><div><span class="a">' + esc(A.n) + '<em>' + PT + ' ' + d.bankA + '</em></span><b>VS</b><span class="b">' + esc(B.n) + '<em>' + PT + ' ' + d.bankB + '</em></span></div>');
        b.classList.remove('hidden');
    }
    // великий відлік останніх 5 с + сигнали
    function countdown(L) {
        const big = $('gl-big');
        if (S.st.ph !== 'hub' || L > 5200 || kindNow() !== 'hub') { if (!big.classList.contains('go')) big.classList.add('hidden'); S.lastBeep = -1; return; }
        const n = Math.ceil(L / 1000);
        if (n !== S.lastBeep) {
            S.lastBeep = n;
            if (n >= 1) { big.textContent = n; big.className = 'gl-big pop'; beep(n <= 3 ? 880 : 660, 0.12, 0.1); }
            if (n === 5) closePanel('bets');      // ставки закриваються за 5 с
        }
    }
    function goFlash(t) { const big = $('gl-big'); big.textContent = t; big.className = 'gl-big go pop'; beep(1180, 0.35, 0.13); setTimeout(() => { big.classList.add('hidden'); big.classList.remove('go'); }, 1100); }
    function banner(icon, title, sub, cls, ms) {
        build(); const b = $('gl-ban');
        b.innerHTML = '<i>' + icon + '</i><div><b>' + esc(title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
        b.className = 'gl-ban ' + (cls || ''); clearTimeout(b.__t); b.__t = setTimeout(() => b.classList.add('hidden'), ms || 3200);
    }

    // ---------- панелі ----------
    let panelKind = null;
    function panel(kind, html) {
        build(); panelKind = kind; const p = $('gl-panel'); p.firstChild.innerHTML = html; p.classList.remove('hidden'); p.dataset.k = kind;
        const x = p.querySelector('[data-x]'); if (x) x.onclick = () => { snd('ui_click'); closePanel(); };
        return p.firstChild;
    }
    function closePanel(only) { const p = $('gl-panel'); if (!p || (only && panelKind !== only)) return; if (panelKind === 'shop' || panelKind === 'bets') S.dismiss[panelKind] = true; p.classList.add('hidden'); panelKind = null; }
    const head = (ic, t, sub) => '<div class="gl-ph"><i>' + ic + '</i><div><b>' + t + '</b><small>' + (sub || '') + '</small></div><span class="gl-bal">' + PT + ' <b>' + ((S.me && S.me.pts) | 0) + '</b></span><button type="button" class="gl-x" data-x aria-label="Закрити">✕</button></div>';
    function refreshPanel() { if (!panelKind) return; if (panelKind === 'shop') openShop(true); else if (panelKind === 'bets') openBets(true); else if (panelKind === 'inv') openInv(true); else if (panelKind === 'watch') openWatch(true); else if (panelKind === 'pick') openPick(true); }

    // --- Лавка ---
    const BUYS = [['speed', '💨', 'Швидкість', 'швидкість руху'], ['dmg', '🔥', 'Шкода', 'шкода снарядів'], ['hp', '🛡️', 'Здоровʼя', 'максимум HP']];
    function openShop(re) {
        const me = S.me; if (!me) return; if (!re) snd('ui_click');
        if (kindNow() !== 'hub' || me.out) return;
        const pc = Math.round(me.pct * 100);
        let h = head('🛒', 'ЛАВКА', 'Бафи діють до кінця гри · +' + pc + '% за покупку') + '<div class="gl-shop">';
        BUYS.forEach(([k, ic, n, d]) => {
            const lv = me.buys[k], max = lv >= me.max, pr = me.price[k], can = !max && me.pts >= pr;
            h += '<div class="gl-buy"><div class="gl-bi">' + ic + '</div><div class="gl-bt"><b>' + n + ' <em>+' + (lv * pc) + '%</em></b><small>' + d + ' · рівень ' + lv + ' / ' + me.max + '</small><div class="gl-bar"><i style="width:' + (lv / me.max * 100) + '%"></i></div></div>' +
                '<button type="button" data-buy="' + k + '"' + (can ? '' : ' disabled') + '>' + (max ? 'МАКС' : '' + PT + ' ' + pr) + '</button></div>';
        });
        const odds = [['common', 75], ['rare', 15], ['epic', 7], ['legendary', 2], ['mythic', 1]];
        // додаткове життя — лише одне за гру
        h += '<div class="gl-buy gl-life"><div class="gl-bi">❤️</div><div class="gl-bt"><b>Додаткове життя</b><small>' + (me.lifeBought ? 'Уже куплено в цій грі' : '+1 серце · лише одне за гру') + '</small></div>' +
            '<button type="button" data-buy="life"' + (!me.lifeBought && me.pts >= me.price.life ? '' : ' disabled') + '>' + (me.lifeBought ? '✓' : PT + ' ' + me.price.life) + '</button></div>';
        h += '<div class="gl-case"><div class="gl-cimg">🎁</div><div class="gl-bt"><b>Кейс із модулем</b><small>Випадковий модуль у тимчасовий інвентар</small><div class="gl-odds">' + odds.map(o => '<span style="--rc:' + RCOL(o[0]) + '">' + o[1] + '%</span>').join('') + '</div></div>' +
            '<button type="button" data-buy="case"' + (me.pts >= me.price.case ? '' : ' disabled') + '>' + PT + ' ' + me.price.case + '</button></div></div>';
        const box = panel('shop', h);
        box.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (b.disabled) return; socket.emit('glBuy', { roomId: rid(), k: b.dataset.buy }); });
    }
    // --- Табло ставок ---
    let betAmt = 100;
    function openBets(re) {
        const st = S.st, d = st && st.duel, me = S.me || {}; if (!d) return;
        const A = rosterOf(d.a), B = rosterOf(d.b); if (!A || !B) return;
        const closeIn = Math.max(0, left() - st.betClose), mine = me.bet;
        const can = d.open && st.ph === 'hub' && !isDuelist() && closeIn > 0;
        betAmt = Math.max(50, Math.min(betAmt, Math.max(50, me.pts | 0)));
        const side = (r, key, bank) => {
            const on = mine && mine.on === r.id, dis = !can || (mine && !on) || (me.pts | 0) < 50;
            return '<div class="gl-bs ' + key + (on ? ' on' : '') + '"><b>' + esc(r.n) + '</b><small>' + '❤'.repeat(Math.max(0, r.l)) + '🖤'.repeat(r.c | 0) + '</small><div class="gl-bank">Банк <b>' + PT + ' ' + bank + '</b></div>' +
                (on ? '<div class="gl-my">Ваша ставка: ' + PT + ' ' + mine.amt + '</div>' : '') + '<button type="button" data-on="' + key + '"' + (dis ? ' disabled' : '') + '>Поставити</button></div>';
        };
        let h = head('🎲', 'СТАВКИ НА ДУЕЛЬ', can ? 'Закриються через ' + mmss(closeIn) : isDuelist() ? 'Ви дуелянт — ставити не можна' : 'Ставки закрито') +
            '<div class="gl-bets">' + side(A, 'a', d.bankA) + '<div class="gl-vs">VS</div>' + side(B, 'b', d.bankB) + '</div>' +
            '<div class="gl-amt"><span>Сума</span><button type="button" data-d="-50">−50</button><input id="gl-bet-in" type="number" min="50" step="50" value="' + betAmt + '"><button type="button" data-d="50">+50</button><button type="button" data-d="500">+500</button><button type="button" data-max>Усе</button></div>' +
            '<p class="gl-note">Банк кожного дуелянта — щонайменше 200 поінтів, навіть якщо на нього не ставили. Переможець дуелі забирає свій банк, той, хто програв, — 5% свого. Хто ставив на переможця, повертає ставку й ділить 95% банку суперника пропорційно ставкам.</p>';
        const box = panel('bets', h), inp = box.querySelector('#gl-bet-in');
        const fix = v => { betAmt = Math.max(50, Math.min(Math.floor(+v || 0), Math.max(50, (S.me && S.me.pts) | 0))); inp.value = betAmt; };
        box.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { snd('ui_click'); fix(betAmt + (+b.dataset.d)); });
        box.querySelector('[data-max]').onclick = () => { snd('ui_click'); fix((S.me && S.me.pts) | 0); };
        inp.onchange = () => fix(inp.value);
        box.querySelectorAll('[data-on]').forEach(b => b.onclick = () => { if (b.disabled) return; snd('ui_buy'); socket.emit('glBet', { roomId: rid(), on: b.dataset.on, amt: betAmt }); });
    }
    // --- Інвентар ---
    function statPct(eq, k) { return Math.round((GameData.statMult(eq, k) - 1) * 100); }
    function openInv(re) {
        const me = S.me; if (!me) return;
        if (kindNow() !== 'hub') { toast('Інвентар доступний лише на Форумі', true); return; }
        if (me.out) return;
        const pc = Math.round(me.pct * 100), eq = Object.assign({}, me.eq, { bm: { speed: 1 + me.pct * me.buys.speed, dmg: 1 + me.pct * me.buys.dmg, hp: 1 + me.pct * me.buys.hp } });
        const slot = s => { const m = MOD(me.eq[s]); return '<button type="button" class="gl-slot' + (m ? ' full' : '') + '" data-slot="' + s + '" style="--rc:' + (m ? RCOL(m.rarity) : '#334155') + '">' + (m ? '<div class="gl-mi">' + (typeof modIcon === 'function' ? modIcon(m) : '') + '</div><b>' + esc(m.name) + '</b><small>' + RNAME(m.rarity) + '</small>' : '<div class="gl-mi gl-empty">＋</div><b>' + SLOTN[s] + '</b><small>базовий</small>') + '</button>'; };
        const st = [['💨', 'Швидкість', 'speed', me.buys.speed], ['🔥', 'Шкода', 'dmg', me.buys.dmg], ['🛡️', 'Здоровʼя', 'hp', me.buys.hp], ['⏱', 'Скорострільність', 'cd', null], ['🎯', 'Дальність', 'range', null]];
        const mc = window.GlClasses && GlClasses.BYID[me.cls];
        let h = head('🎒', 'ІНВЕНТАР ГРИ', 'Модулі й бафи діють лише в цій грі') +
            (mc ? '<div class="glc-mine" style="--cc:' + mc.c + '"><div class="glc-icw">' + GlClasses.icon(mc.id) + '</div><div><small>' + GlClasses.ROLES[mc.r].n + '</small><b>' + esc(mc.n) + '</b><span>✨ ' + esc(mc.ab.n) + ' · ⏱ ' + mc.ab.cd + ' с — ' + esc(mc.ab.d) + '</span></div></div>' : '') +
            '<div class="gl-inv"><div class="gl-col"><div class="gl-sec">Встановлено</div><div class="gl-slots">' + ['cannon', 'turret', 'hull', 'tracks'].map(slot).join('') + '</div>' +
            '<div class="gl-sec">Характеристики</div><div class="gl-stats">' + st.map(([ic, n, k, b]) => { let p = k === 'cd' ? Math.round((1 / GameData.statMult(eq, 'cd') - 1) * 100) : statPct(eq, k); return '<div><i>' + ic + '</i><span>' + n + '</span><b class="' + (p > 0 ? 'up' : p < 0 ? 'dn' : '') + '">' + (p > 0 ? '+' : '') + p + '%</b>' + (b != null ? '<em>куплено +' + b * pc + '%</em>' : '') + '</div>'; }).join('') + '</div>' +
            (me.curse ? '<div class="gl-curse"><i>🖤</i><span>Прокляття: ' + me.curse + ' · −' + me.cursePct + '% до всіх характеристик</span></div>' : '') +
            '<div class="gl-sum"><span>❤ Життів <b>' + me.lives + '</b></span><span>' + PT + ' Баланс <b>' + me.pts + '</b></span><span>💀 Зомбі <b>' + me.kills + '</b></span></div></div>' +
            '<div class="gl-col"><div class="gl-sec">Тимчасовий інвентар · ' + me.inv.length + '</div><div class="gl-list">' +
            (me.inv.length ? me.inv.map((id, i) => { const m = MOD(id); if (!m) return ''; return '<button type="button" class="gl-it" data-mod="' + esc(id) + '" style="--rc:' + RCOL(m.rarity) + '"><div class="gl-mi">' + (typeof modIcon === 'function' ? modIcon(m) : '') + '</div><div class="gl-itt"><b>' + esc(m.name) + '</b><small>' + RNAME(m.rarity) + ' · ' + SLOTN[m.type] + '</small><div class="gl-ms">' + (typeof modStatsHtml === 'function' ? modStatsHtml(m, ' · ') : '') + '</div></div><span class="gl-eq">Встановити</span></button>'; }).join('') : '<div class="gl-none">Порожньо. Модулі дають кейси в Лавці й вибір кожного 2-го раунду.</div>') +
            '</div></div></div>';
        const box = panel('inv', h);
        box.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => { snd('ui_click'); socket.emit('glEquip', { roomId: rid(), mod: b.dataset.mod }); });
        box.querySelectorAll('.gl-slot.full').forEach(b => b.onclick = () => { snd('ui_click'); socket.emit('glEquip', { roomId: rid(), slot: b.dataset.slot }); });
    }
    // --- вибір модуля (кожен 2-й раунд) ---
    function openOffer() {
        const me = S.me; if (!me || !me.offer || kindNow() !== 'hub' || panelKind === 'offer') return;
        let h = head('🎁', 'ОБЕРІТЬ МОДУЛЬ', 'Один із трьох піде в тимчасовий інвентар') + '<div class="gl-offer">' +
            me.offer.map((id, i) => { const m = MOD(id); if (!m) return ''; return '<button type="button" class="gl-oc" data-i="' + i + '" style="--rc:' + RCOL(m.rarity) + ';animation-delay:' + i * 90 + 'ms"><small>' + RNAME(m.rarity) + '</small><div class="gl-mi">' + (typeof modIcon === 'function' ? modIcon(m) : '') + '</div><b>' + esc(m.name) + '</b><em>' + SLOTN[m.type] + '</em><div class="gl-ms">' + (typeof modStatsHtml === 'function' ? modStatsHtml(m) : '') + '</div></button>'; }).join('') + '</div>';
        const box = panel('offer', h);
        box.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { snd('ui_buy'); socket.emit('glPick', { roomId: rid(), i: +b.dataset.i }); if (S.me) S.me.offer = null; closePanel(); toast('Модуль у тимчасовому інвентарі — встановіть його (' + (window.KB ? KB.label('inventory') : 'X') + ')'); });
    }
    // --- спостереження ---
    function openWatch(re) {
        const st = S.st; if (!st) return;
        const list = st.roster.filter(q => !q.o && !q.x && (q.w === 'arena' || q.w === 'duel'));
        let h = head('👁', 'СПОСТЕРЕЖЕННЯ', 'Оберіть, за ким дивитись') + '<div class="gl-watch">' +
            (list.length ? list.map(q => '<button type="button" data-w="' + esc(q.id) + '"><i>' + (q.w === 'duel' ? '⚔️' : '🧟') + '</i><b>' + esc(q.n) + '</b><small>' + (q.w === 'duel' ? 'дуель' : 'арена') + ' · ' + '❤'.repeat(Math.max(0, q.l)) + '🖤'.repeat(q.c | 0) + '</small></button>').join('') : '<div class="gl-none">Зараз ніхто не бʼється</div>') +
            '<button type="button" data-w="hub"><i>🏛️</i><b>Форум</b><small>повернутись на площу</small></button></div>';
        const box = panel('watch', h);
        box.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { snd('ui_click'); socket.emit('glWatch', { roomId: rid(), id: b.dataset.w }); closePanel(); });
    }
    // --- підсумкові вікна ---
    function overWin(d) {
        S.over = true;
        const h = '<div class="gl-over ' + (d.win ? 'win' : '') + '"><div class="gl-ot">' + (d.win ? '🏆' : '💀') + '</div><b>' + (d.win ? 'ВИ — ЧЕМПІОН АРЕНИ!' : 'ВИ ВИБУЛИ') + '</b><small>Місце ' + d.place + ' з ' + d.n + ' · прожито раундів: ' + d.rounds + '</small>' +
            '<div class="gl-rw"><span>' + (typeof creditIcon === 'function' ? creditIcon(18) : '💰') + ' <b>+' + d.reward + '</b></span>' + (d.xp && d.xp.gain ? '<span>⭐ <b>+' + d.xp.gain + '</b> XP</span>' : '') + '</div>' +
            (d.win || d.final ? '' : '<p>Нагороду вже нараховано. Можна спостерігати за рештою гри.</p>') +
            '<div class="gl-ob">' + (d.win || d.final ? '' : '<button type="button" data-a="watch">👁 Спостерігати</button>') + '<button type="button" data-a="leave" class="dn">🚪 Повернутись у лобі</button></div></div>';
        const box = panel('over', h);
        const w = box.querySelector('[data-a=watch]'); if (w) w.onclick = () => { snd('ui_click'); closePanel(); };
        box.querySelector('[data-a=leave]').onclick = () => { snd('ui_click'); quit(); };
    }
    function quit() {
        if (S.endData) { backToSession(); return; }
        uiDialog.confirm({ kind: 'danger', icon: '🚪', title: 'Повернутись у лобі?', text: 'Ви точно хочете вийти, а не спостерігати за рештою боїв?', cancelText: 'Спостерігати', okText: 'Вийти' })
            .then(ok => { if (!ok) return; const r = rid(); if (r) socket.emit('leaveRoom', r); currentRoomId = null; currentRoomData = null; closePanel(); reset(); if (window.resetLobbyUI) resetLobbyUI(); if (typeof switchMusicState === 'function') switchMusicState('loby'); showScreen('room-browser-screen'); });
    }
    function backToSession() {
        const hubId = S.endData && S.endData.hub; closePanel(); reset();
        if (hubId) { currentRoomId = hubId; socket.emit('backToRoomLobby', hubId); }
        if (typeof switchMusicState === 'function') switchMusicState('loby'); showScreen('lobby-screen');
    }
    function endWin(d) {
        const me = typeof myId !== 'undefined' ? myId : null;
        const rows = d.standings.map(q => '<div class="gl-sr' + (q.id === me ? ' me' : '') + (q.place === 1 ? ' p1' : '') + '"><i>' + (q.place === 1 ? '🏆' : q.place === 2 ? '🥈' : q.place === 3 ? '🥉' : q.place || '—') + '</i><b>' + esc(q.name) + (q.left ? ' <small>(вийшов)</small>' : '') + '</b><span>раундів ' + q.rounds + '</span><em>+' + q.reward + '</em></div>').join('');
        const box = panel('end', '<div class="gl-over win"><div class="gl-ot">🏛️</div><b>ГРУ ЗАВЕРШЕНО</b><small>Раундів зіграно: ' + d.rounds + '</small><div class="gl-stand">' + rows + '</div><div class="gl-ob"><button type="button" data-a="back">⟲ Повернутись у сесію</button></div></div>');
        box.querySelector('[data-a=back]').onclick = () => { snd('ui_click'); backToSession(); };
    }

    // ---------- зони Форуму ----------
    function zones() {
        if (!active() || kindNow() !== 'hub' || !S.me || S.me.out || typeof myLocalTank === 'undefined' || myLocalTank.hp <= 0) { S.zone = null; return; }
        const inZ = z => Math.hypot(myLocalTank.x - z.x, myLocalTank.y - z.y) <= z.r;
        const z = inZ(ZONES.shop) ? 'shop' : inZ(ZONES.bets) ? 'bets' : null;
        if (z !== S.zone) {
            if (S.zone && panelKind === S.zone) closePanel();
            S.dismiss = {}; S.zone = z;
            if (z === 'shop' && !panelKind) openShop();
            if (z === 'bets' && !panelKind && S.st && S.st.duel && S.st.duel.open) openBets();
        }
    }

    // ---------- КЛАСИ: вибір на старті (45 с), кнопка вміння, ефекти ----------
    const GC = window.GlClasses, CL = id => GC && GC.BYID[id];
    const STATN = [['hp', '❤', 'Здоровʼя'], ['dmg', '🔥', 'Шкода'], ['spd', '💨', 'Швидкість'], ['cd', '⏱', 'Скорострільність'], ['rng', '🎯', 'Дальність']];
    // множник → відсоток (перезарядка: менша = краще, тому показуємо як скорострільність)
    const pctOf = (k, v) => Math.round(((k === 'cd' ? 1 / v : v) - 1) * 100);
    function statChips(c) {
        return STATN.map(([k, ic, n]) => { const p = pctOf(k, c.st[k]); if (!p) return ''; return '<span class="' + (p > 0 ? 'up' : 'dn') + '" title="' + n + '">' + ic + ' ' + (p > 0 ? '+' : '') + p + '%</span>'; }).join('') || '<span>⚖ збалансований</span>';
    }
    let pickSel = null, pickRole = 'all';
    const pickLeft = () => S.st ? Math.max(0, (S.st.pick || 0) - (performance.now() - S.stAt)) : 0;
    function openPick(re) {
        if (!GC || !S.st || !S.me || S.me.cls || S.st.round > 0 || !(S.st.pick > 0)) return;
        const roles = Object.keys(GC.ROLES), picked = S.st.roster.filter(q => q.k && !q.x).length, tot = S.st.roster.filter(q => !q.x).length;
        const list = GC.LIST.filter(c => pickRole === 'all' || c.r === pickRole);
        let h = '<div class="gl-ph"><i>🛡️</i><div><b>ОБЕРІТЬ КЛАС</b><small>Клас дає базові характеристики й вміння на всю гру · обрали ' + picked + ' / ' + tot + '</small></div><span class="gl-bal gl-pt" id="gl-pick-t">' + mmss(pickLeft()) + '</span></div>' +
            '<div class="glc-roles"><button type="button" data-role="all" class="' + (pickRole === 'all' ? 'on' : '') + '">Усі · ' + GC.LIST.length + '</button>' + roles.map(r => '<button type="button" data-role="' + r + '" class="' + (pickRole === r ? 'on' : '') + '" style="--rc:' + GC.ROLES[r].c + '">' + GC.ROLES[r].n + '</button>').join('') + '</div>' +
            '<div class="glc-grid">' + list.map((c, i) => '<button type="button" class="glc-card' + (pickSel === c.id ? ' sel' : '') + '" data-c="' + c.id + '" style="--cc:' + c.c + ';--rc:' + GC.ROLES[c.r].c + ';animation-delay:' + Math.min(i, 20) * 18 + 'ms">' +
                '<div class="glc-top"><div class="glc-icw">' + GC.icon(c.id) + '</div><div><b>' + esc(c.n) + '</b><em>' + GC.ROLES[c.r].n + '</em></div></div>' +
                '<div class="glc-stats">' + statChips(c) + '</div>' +
                '<div class="glc-ab"><b>✨ ' + esc(c.ab.n) + '<i>⏱ ' + c.ab.cd + ' с</i></b><small>' + esc(c.ab.d) + '</small></div></button>').join('') + '</div>' +
            '<div class="glc-foot"><button type="button" id="glc-ok"' + (pickSel ? '' : ' disabled') + '>' + (pickSel ? 'ОБРАТИ: ' + esc(CL(pickSel).n) : 'Оберіть клас') + '</button><small>Якщо не встигнете — клас буде обрано автоматично</small></div>';
        const pb = $('gl-panel') && $('gl-panel').firstChild, sc = re && pb ? pb.scrollTop : 0;      // перемальовування не скидає прокрутку
        const box = panel('pick', h); box.scrollTop = sc;
        box.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { snd('ui_click'); pickRole = b.dataset.role; openPick(true); });
        box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { snd('ui_click'); pickSel = b.dataset.c; box.querySelectorAll('.glc-card').forEach(x => x.classList.toggle('sel', x === b)); const ok = $('glc-ok'); ok.disabled = false; ok.textContent = (window.I18N ? I18N.t('ОБРАТИ:') : 'ОБРАТИ:') + ' ' + CL(pickSel).n; });
        box.querySelectorAll('[data-c]').forEach(b => b.ondblclick = () => { pickSel = b.dataset.c; confirmPick(); });
        $('glc-ok').onclick = confirmPick;
    }
    function confirmPick() { if (!pickSel) return; snd('ui_buy'); socket.emit('glClass', { roomId: rid(), id: pickSel }); }
    // кнопка вміння: іконка класу + перезарядка; E (або своя клавіша) на ПК, дотик — на телефоні
    let cdEnd = 0, fxEnd = 0;
    function abBtn() {
        build(); let b = $('gl-ab');
        if (!b) { b = document.createElement('button'); b.type = 'button'; b.id = 'gl-ab'; b.className = 'gl-ab hidden'; b.innerHTML = '<div class="gl-abi"></div><div class="gl-abcd"></div><span class="gl-abt"></span><kbd></kbd>'; $('gl-root').appendChild(b); b.addEventListener('click', useAb); }
        const c = S.me && CL(S.me.cls), k = kindNow(), on = active() && !!c && !(S.me && S.me.out);
        b.classList.toggle('hidden', !on); if (!on) return;
        const ic = b.querySelector('.gl-abi'); if (ic.__c !== c.id) { ic.__c = c.id; ic.innerHTML = GC.icon(c.id); b.style.setProperty('--cc', c.c); b.title = c.ab.n + ' — ' + c.ab.d; }
        const left = Math.max(0, cdEnd - performance.now()), fight = (k === 'arena' || k === 'duel') && myHp() > 0, frac = left / (c.ab.cd * 1000);
        b.classList.toggle('off', !fight); b.classList.toggle('cd', left > 0); b.classList.toggle('act', fxEnd > performance.now());
        b.querySelector('.gl-abcd').style.background = left > 0 ? 'conic-gradient(rgba(2,6,23,.78) ' + Math.round(Math.min(1, frac) * 360) + 'deg, transparent 0)' : 'none';
        b.querySelector('.gl-abt').textContent = left > 0 ? Math.ceil(left / 1000) : (fight ? '' : '⛔');
        b.querySelector('kbd').textContent = window.KB ? KB.label('ability') : 'E';
    }
    function useAb() {
        const k = kindNow(); if (k !== 'arena' && k !== 'duel') { toast('Вміння працює лише в бою: на арені та в дуелі', true); return; }
        if (performance.now() < cdEnd || myHp() <= 0) return;
        socket.emit('glAbility', { roomId: rid() });
    }
    const fxs = [];      // спалахи вмінь на мапі
    socket.on('glAbil', d => {
        const c = CL(d.cls); if (!c) return;
        fxs.push({ x: d.x, y: d.y, r: d.r || 110, to: d.to, c: c.c, n: c.ab.n, t0: performance.now(), id: d.id });
        if (fxs.length > 12) fxs.shift();
        if (d.id === (typeof myId !== 'undefined' ? myId : null)) { snd('powerup'); fxEnd = d.t ? performance.now() + d.t * 1000 : 0; if (d.to && typeof myLocalTank !== 'undefined') { myLocalTank.x = d.to.x; myLocalTank.y = d.to.y; } }
    });
    socket.on('glCd', d => { cdEnd = performance.now() + (d.ms | 0); abBtn(); });
    function drawFx(ctx, now, lowG) {
        const t = performance.now();
        for (let i = fxs.length - 1; i >= 0; i--) {
            const f = fxs[i], age = (t - f.t0) / 900; if (age >= 1.4) { fxs.splice(i, 1); continue; }
            ctx.save();
            if (age < 1) {
                const R = f.r * (0.25 + 0.75 * age);
                ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, Math.PI * 2); ctx.lineWidth = 8 * (1 - age) + 2; ctx.strokeStyle = 'rgba(' + f.c + ',' + (0.85 * (1 - age)) + ')'; ctx.stroke();
                if (!lowG) { ctx.fillStyle = 'rgba(' + f.c + ',' + (0.14 * (1 - age)) + ')'; ctx.fill(); }
                if (f.to) { ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.to.x, f.to.y); ctx.setLineDash([10, 10]); ctx.lineWidth = 4; ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(f.to.x, f.to.y, 60 * (0.4 + 0.6 * age), 0, Math.PI * 2); ctx.stroke(); }
            }
            const a = Math.max(0, 1 - Math.max(0, age - 0.6) / 0.8), y = (f.to ? f.to.y : f.y) - 70 - age * 24;
            ctx.globalAlpha = a; ctx.font = '700 22px "Russo One", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(2,6,23,.85)';
            const tx = window.I18N ? I18N.t(f.n) : f.n; ctx.strokeText(tx, f.to ? f.to.x : f.x, y); ctx.fillStyle = 'rgb(' + f.c + ')'; ctx.fillText(tx, f.to ? f.to.x : f.x, y);
            ctx.restore();
        }
    }

    // ---------- малювання на мапі: світні кола зон ----------
    window.GladFX = {
        ground(ctx, now, pv, lowG) {
            if (fxs.length) drawFx(ctx, now, lowG);
            if (kindNow() !== 'hub' || !S.st) return;
            [['shop', 'ЛАВКА', '251,191,36'], ['bets', 'СТАВКИ', '168,85,247']].forEach(([k, t, c]) => {
                const z = ZONES[k]; if (z.x + z.r < pv.x0 || z.x - z.r > pv.x1 || z.y + z.r < pv.y0 || z.y - z.r > pv.y1) return;
                const pulse = lowG ? 0.5 : 0.5 + 0.5 * Math.sin(now / 400);
                ctx.save(); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(' + c + ',' + (0.08 + 0.06 * pulse) + ')'; ctx.fill();
                ctx.setLineDash([18, 12]); ctx.lineDashOffset = lowG ? 0 : -now / 40; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(' + c + ',' + (0.55 + 0.35 * pulse) + ')'; ctx.stroke(); ctx.setLineDash([]);
                ctx.font = '700 30px "Russo One", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(' + c + ',0.95)'; ctx.fillText(window.I18N ? I18N.t(t) : t, z.x, z.y);      // текст на канвасі DOM-переклад не бачить
                ctx.restore();
            });
        }
    };

    // ---------- мережа ----------
    socket.on('glState', d => {
        const prev = S.st; S.st = d; S.stAt = performance.now();
        if (prev && prev.ph === 'hub' && d.ph === 'fight') { goFlash('БІЙ!'); closePanel(); }
        if (prev && prev.ph === 'fight' && d.ph === 'hub') {
            banner('🏛️', 'Раунд ' + d.round + ' завершено', 'Наступний — через ' + mmss(d.left), 'gold');
            if (d.duel) setTimeout(() => { const A = rosterOf(d.duel.a), B = rosterOf(d.duel.b); if (A && B) banner('⚔️', 'Дуель наступного раунду', esc(A.n) + ' <b>VS</b> ' + esc(B.n) + (d.duel.open ? ' · ставки відкрито!' : ''), 'red', 4200); }, 3300);
        }
        hud(); refreshPanel();
    });
    socket.on('glMe', d => {
        const had = S.me && S.me.offer, hadCls = S.me && S.me.cls; S.me = d; hud();
        if (d.cd > 0 && performance.now() + d.cd > cdEnd + 400) cdEnd = performance.now() + d.cd;      // перезарядка після переходу між кімнатами
        if (d.cls && !hadCls) { const c = CL(d.cls); if (panelKind === 'pick') closePanel(); if (c) banner('🛡️', 'Ваш клас: ' + c.n, '✨ ' + esc(c.ab.n) + ' — ' + esc(c.ab.d), 'gold', 4500); }
        if (panelKind === 'offer' && !d.offer) closePanel();
        if (d.offer && !had) setTimeout(openOffer, 600); else if (panelKind && panelKind !== 'offer' && panelKind !== 'over' && panelKind !== 'end' && panelKind !== 'case') refreshPanel();
    });
    socket.on('glHop', d => {
        window.__glHop = true; S.hop = true; currentRoomId = d.roomId; S.kind = d.kind; S.zl = null; S.arenaT0 = d.kind === 'arena' || d.kind === 'duel' ? Date.now() + 3000 : 0;
        if (panelKind && panelKind !== 'over' && panelKind !== 'end') closePanel();
        const rn = S.st ? (S.st.ph === 'hub' ? S.st.round + 1 : S.st.round) : '';      // сервер шле стан уже після переходу
        if (d.kind === 'arena' && !d.watch) banner('🏟️', 'Раунд ' + rn + ' · Колізей', 'Знищіть усіх зомбі — кожен дає поінти', 'gold');
        else if (d.kind === 'duel' && !d.watch) banner('⚔️', 'ДУЕЛЬ!', 'Знищіть суперника — дуель до першого знищення', 'red');
        else if (d.watch) banner('👁', 'Спостереження', d.kind === 'duel' ? 'Дивитесь дуель' : 'Дивитесь бій на арені', '');
    });
    socket.on('gameStarting', r => {
        if (!r || !MODES_GL[r.mode]) { if (!S.hop) reset(); return; }
        if (S.hop) { S.hop = false; setTimeout(() => { window.__glHop = false; if (myHp() <= 0 && typeof findNextSpec === 'function') findNextSpec(1); }, 0); }
        else if (r.mode === 'gladiators') { S.over = false; S.endData = null; setTimeout(() => banner('🏛️', 'ГЛАДІАТОРИ', 'Форум: купуйте бафи в Лавці, ставте на дуелі. Раунд скоро!', 'gold', 4500), 4200); }
        setTimeout(hud, 50);
    });
    socket.on('glPts', d => { S.zl = d.left; snd('token'); hud(); });
    socket.on('newWave', () => { if (kindNow() === 'arena') { S.zl = currentRoomData && currentRoomData.zombies ? Object.keys(currentRoomData.zombies).length : null; } });
    socket.on('glClear', d => { banner('✅', 'Хвилю відбито!', 'Поінтів: ' + PT + ' ' + d.pts, 'green'); snd('powerup'); });
    socket.on('glEnrage', d => banner('😡', 'Зомбі лютують!', 'Затягнута хвиля: +' + d.pct + '% до HP, шкоди й швидкості', 'red', 2600));
    socket.on('glBought', () => snd('ui_buy'));
    socket.on('glMsg', d => toast(d.t, !!d.err));
    socket.on('glCase', d => {
        const m = MOD(d.mod); if (!m) return; snd('ui_buy');
        const box = panel('case', '<div class="gl-cres" style="--rc:' + RCOL(d.rar) + '"><small>' + RNAME(d.rar) + '</small><div class="gl-mi">' + (typeof modIcon === 'function' ? modIcon(m) : '') + '</div><b>' + esc(m.name) + '</b><em>' + SLOTN[m.type] + '</em><div class="gl-ms">' + (typeof modStatsHtml === 'function' ? modStatsHtml(m) : '') + '</div><div class="gl-ob"><button type="button" data-a="inv">🎒 Встановити</button><button type="button" data-a="more">🛒 До Лавки</button></div></div>');
        box.querySelector('[data-a=inv]').onclick = () => { snd('ui_click'); openInv(); };
        box.querySelector('[data-a=more]').onclick = () => { snd('ui_click'); openShop(); };
    });
    socket.on('glDuelEnd', d => {
        const me = typeof myId !== 'undefined' ? myId : null, my = d.bettors && d.bettors[me];
        const sub = d.win === me ? 'Приз: ' + PT + ' ' + d.prize : d.lose === me ? 'Втіха: ' + PT + ' ' + d.consol + (d.curse ? ' · 🖤 прокляття −' + d.pct + '%' : d.out ? '' : ' · −1 життя') : my ? 'Ваш виграш: ' + PT + ' ' + my : 'Банк: ' + PT + ' ' + d.bankW + ' / ' + d.bankL;
        banner(d.win === me ? '🏆' : d.lose === me ? '💔' : '⚔️', esc(d.winName) + ' перемагає в дуелі' + (d.why === 'time' ? ' (за часом)' : d.why === 'left' ? ' (суперник вийшов)' : ''), sub, d.win === me || my ? 'green' : d.lose === me ? 'red' : 'gold', 4200);
    });
    socket.on('glOver', d => { setTimeout(() => overWin(d), d.win ? 400 : 1600); });
    socket.on('glEnd', d => { S.endData = { hub: S.st && S.st.hub }; if (S.st) S.st.ph = 'end'; setTimeout(() => endWin(d), 900); hud(); });
    socket.on('clsLives', d => { if (S.me && d && d.n != null && kindNow()) { S.me.lives = d.n; hud(); } });

    // ---------- клавіша вміння (та сама, що для здібностей класів у кооперативі: E) ----------
    window.addEventListener('keydown', e => {
        if (!active() || !window.KB || !KB.is(e, 'ability') || e.repeat) return;
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault(); useAb();
    });
    // ---------- клавіша інвентарю ----------
    window.addEventListener('keydown', e => {
        if (!active() || !window.KB || !KB.is(e, 'inventory')) return;
        const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        e.preventDefault(); if (panelKind === 'inv') closePanel(); else openInv();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panelKind && panelKind !== 'over' && panelKind !== 'end' && active()) { e.stopPropagation(); closePanel(); } }, true);

    // ---------- цикл інтерфейсу: 4 рази на секунду (без роботи, поки гра не «Гладіатори») ----------
    setInterval(() => {
        if (!S.st) return;
        if (!active()) { if ($('gl-hud') && !$('gl-hud').classList.contains('hidden')) hud(); return; }
        hud(); zones(); abBtn();
        if (S.me && !S.me.cls && S.st.round === 0 && S.st.pick > 0) { if (panelKind !== 'pick' && panelKind !== 'end') openPick(); else if (panelKind === 'pick') { const t = $('gl-pick-t'); if (t) t.textContent = mmss(pickLeft()); } }
        if (panelKind === 'bets' || panelKind === 'watch') refreshPanel();
        if (S.me && S.me.offer && !panelKind && kindNow() === 'hub') openOffer();
        // глядач: якщо ціль зникла — наступний живий
        if (myHp() <= 0 && typeof spectatingId !== 'undefined' && typeof opponents !== 'undefined' && (!spectatingId || !opponents[spectatingId] || opponents[spectatingId].hp <= 0) && typeof findNextSpec === 'function') findNextSpec(1);
        if (kindNow() === 'arena' && typeof zombies !== 'undefined') S.zl = Object.keys(zombies).length;
    }, 250);

    function reset() { const dm = $('deathmatch-score-hud'); if (dm) dm.style.display = ''; S.st = null; S.me = null; S.zone = null; S.dismiss = {}; S.over = false; lastPts = null; closePanel(); const h = $('gl-hud'); if (h) { h.classList.add('hidden'); $('gl-acts').classList.add('hidden'); $('gl-duelbar').classList.add('hidden'); $('gl-big').classList.add('hidden'); } }
    socket.on('kicked', reset);
    window.GladUI = { active, isOut: () => !!(S.me && S.me.out), reset, inv: openInv, shop: openShop, bets: openBets, watch: openWatch, pick: openPick, ability: useAb };
})();
