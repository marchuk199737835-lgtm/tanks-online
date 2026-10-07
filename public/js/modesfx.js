// ===== Нові режими: ігровий інтерфейс, малювання на мапі, події, вибір покращень, екран результату =====
// Стан режиму приходить від сервера в пакеті sync2 (поле md); тут — лише відображення. Логіка й нагороди — на сервері (modes.js).
(function () {
    const MI = window.ModeInfo; if (!MI) return;
    const $ = id => document.getElementById(id);
    const NEWM = new Set(MI.NEW);
    const TC = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };
    const TN = { red: 'Червоні', blue: 'Сині', green: 'Зелені', yellow: 'Жовті' };
    const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    const cur = () => (typeof currentRoomData !== 'undefined' ? currentRoomData : null);
    let md = null, hud = null, hudMode = null, ref = {}, bannerT = null, zr = null, lastNow = 0;

    // ---------- каркас ігрового інтерфейсу ----------
    function box(html, cls) { return '<div class="mfx-box ' + (cls || '') + '">' + html + '</div>'; }
    const bar = (id, cls) => '<div class="mfx-bar ' + (cls || '') + '"><i data-r="' + id + '"></i></div>';
    const BUILD = {
        base_defense: () => box('<div class="mfx-col"><span class="mfx-t">Ядро бази</span>' + bar('hp', 'cyan') + '<span class="mfx-n" data-r="hpn">0</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Хвиля</span><span class="mfx-big"><b data-r="w">0</b><em>/</em><b data-r="W">0</b></span></div><div class="mfx-col mfx-c"><span class="mfx-t">Ворогів</span><span class="mfx-big" data-r="z">0</span></div>'),
        boss_raid: () => box('<div class="mfx-col mfx-w"><span class="mfx-t"><b data-r="bn">Бос</b></span>' + bar('hp', 'red wide') + '<span class="mfx-n" data-r="hpn">0</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Час</span><span class="mfx-big" data-r="t">0:00</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Життя</span><span class="mfx-big mfx-hearts" data-r="lv">❤</span></div>'),
        convoy: () => box('<div class="mfx-col"><span class="mfx-t">Конвой</span>' + bar('hp', 'cyan') + '<span class="mfx-n" data-r="hpn">0</span></div><div class="mfx-col mfx-w"><span class="mfx-t">Маршрут</span>' + bar('pg', 'blue wide') + '<span class="mfx-n"><b data-r="pgn">0</b>%</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Час</span><span class="mfx-big" data-r="t">0:00</span></div>') + '<div class="mfx-chip" data-r="hold"></div>',
        solo_arena: () => box('<div class="mfx-col mfx-c"><span class="mfx-t">Хвиля</span><span class="mfx-big"><b data-r="w">0</b><em>/</em><b data-r="W">0</b></span></div><div class="mfx-col mfx-c"><span class="mfx-t">Ворогів</span><span class="mfx-big" data-r="z">0</span></div>') + '<div class="mfx-perks" data-r="pk"></div>',
        boss_duel: () => box('<div class="mfx-col mfx-c"><span class="mfx-t">Бос</span><span class="mfx-big"><b data-r="i">0</b><em>/</em><b data-r="N">0</b></span></div><div class="mfx-col mfx-w"><span class="mfx-t"><b data-r="bn">—</b></span>' + bar('hp', 'red wide') + '<span class="mfx-n" data-r="hpn">0</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Життя</span><span class="mfx-big mfx-hearts" data-r="lv">❤</span></div>'),
        battle_royale: () => box('<div class="mfx-col mfx-c"><span class="mfx-t">Живих</span><span class="mfx-big"><b data-r="al">0</b><em>/</em><b data-r="n">0</b></span></div><div class="mfx-col mfx-c mfx-zone"><span class="mfx-t" data-r="zt">Зона</span><span class="mfx-big" data-r="zv">—</span></div>'),
        capture_points: () => box('<div class="mfx-scores" data-r="sc"></div><div class="mfx-col mfx-c"><span class="mfx-t">Мета</span><span class="mfx-big" data-r="goal">0</span></div><div class="mfx-col mfx-c"><span class="mfx-t">Час</span><span class="mfx-big" data-r="t">0:00</span></div>') + '<div class="mfx-pts" data-r="pts"></div>',
        bounty: () => box('<div class="mfx-col mfx-w mfx-tg"><span class="mfx-t">Ціль полювання</span><span class="mfx-big mfx-gold" data-r="tg">—</span><span class="mfx-n" data-r="tgn"></span></div><div class="mfx-col mfx-c"><span class="mfx-t">Час</span><span class="mfx-big" data-r="t">0:00</span></div><div class="mfx-col mfx-c"><span class="mfx-t">До перемоги</span><span class="mfx-big" data-r="goal">0</span></div>') + '<div class="mfx-board" data-r="bd"></div>'
    };

    function ensureHud(mode) {
        const gs = $('game-screen'); if (!gs) return;
        if (hud && hudMode === mode) return;
        removeHud();
        hud = document.createElement('div'); hud.id = 'mfx'; hud.style.setProperty('--c', MI.MODES[mode].c);
        hud.innerHTML = BUILD[mode](); hudMode = mode; ref = {};
        hud.querySelectorAll('[data-r]').forEach(e => { ref[e.dataset.r] = e; });
        gs.appendChild(hud);
        let bn = $('mfx-banner'); if (!bn) { bn = document.createElement('div'); bn.id = 'mfx-banner'; gs.appendChild(bn); }
    }
    function removeHud() { if (hud) { hud.remove(); hud = null; hudMode = null; ref = {}; } const b = $('mfx-banner'); if (b) b.classList.remove('show'); }
    const set = (k, v) => { const e = ref[k]; if (e && e.textContent !== String(v)) e.textContent = v; };
    const width = (k, p) => { const e = ref[k]; if (e) e.style.width = Math.max(0, Math.min(100, p)) + '%'; };
    const myPl = () => { const r = cur(); return r && r.players ? r.players[myId] : null; };
    const nameOf = id => { const r = cur(); return r && r.players[id] ? r.players[id].name : ''; };

    // оновлення панелі з поточного md
    function paint() {
        const r = cur(); if (!r || !md || md.m !== r.mode || !hud) return;
        switch (md.m) {
            case 'base_defense':
                width('hp', md.c.hp / md.c.max * 100); set('hpn', md.c.hp + ' / ' + md.c.max); set('w', md.w); set('W', md.W); set('z', md.z); break;
            case 'boss_raid':
                if (md.b) { set('bn', md.b.n); width('hp', md.b.hp / md.b.max * 100); set('hpn', md.b.hp + ' / ' + md.b.max); } else { width('hp', 0); set('hpn', '0'); }
                set('t', fmt(md.t)); set('lv', '❤'.repeat(Math.max(0, md.lv[myId] || 0)) || '—'); hud.classList.toggle('enr', !!md.enr); break;
            case 'convoy': {
                width('hp', md.cv.hp / md.cv.max * 100); set('hpn', md.cv.hp + ' / ' + md.cv.max); width('pg', md.prog); set('pgn', md.prog); set('t', fmt(md.t));
                const h = ref.hold; if (h) { const k = !md.go ? 'wait' : md.hold === 0 ? 'go' : md.hold === 2 ? 'fight' : 'esc'; if (h.dataset.k !== k) { h.dataset.k = k; h.textContent = { wait: 'Приготуйтесь…', go: '🚚 Конвой їде', fight: '⚔ Бій! Конвой стоїть', esc: '⚠ Підійдіть до конвою' }[k]; h.className = 'mfx-chip ' + k; } }
                break;
            }
            case 'solo_arena': {
                set('w', md.w); set('W', md.W); set('z', md.z);
                const pk = ref.pk, sig = JSON.stringify(md.pk); if (pk && pk.dataset.s !== sig) { pk.dataset.s = sig; pk.innerHTML = Object.keys(md.pk).map(k => '<span title="' + MI.PERKS[k].n + '">' + MI.PERKS[k].e + '<b>' + md.pk[k] + '</b></span>').join(''); }
                break;
            }
            case 'boss_duel':
                set('i', md.i); set('N', md.N); if (md.b) { set('bn', md.b.n); width('hp', md.b.hp / md.b.max * 100); set('hpn', md.b.hp + ' / ' + md.b.max); } else { set('bn', '—'); width('hp', 0); set('hpn', ''); }
                set('lv', '❤'.repeat(Math.max(0, md.lv)) || '—'); break;
            case 'battle_royale': {
                set('al', md.al); set('n', md.n);
                let t, v;
                if (md.zt > 0) { t = 'Зона зʼявиться'; v = fmt(md.zt); } else if (md.z.ph >= 5) { t = 'Фінал'; v = '🔥'; } else if (md.z.np > 0) { t = 'Зона звужується через'; v = fmt(md.z.np); } else { t = 'Зона звужується'; v = '⚠'; }
                set('zt', t); set('zv', v); break;
            }
            case 'capture_points': {
                const sc = ref.sc, ts = Object.keys(md.sc), sig = ts.map(t => t + md.sc[t]).join();
                if (sc && sc.dataset.s !== sig) { sc.dataset.s = sig; sc.innerHTML = ts.map(t => '<b style="color:' + TC[t] + '">' + md.sc[t] + '</b>').join('<em>:</em>'); }
                set('goal', md.goal); set('t', fmt(md.t));
                const pe = ref.pts, ps = JSON.stringify(md.pts.map(p => [p.o, p.w, p.p >> 3]));
                if (pe && pe.dataset.s !== ps) { pe.dataset.s = ps; pe.innerHTML = md.pts.map(p => '<span style="--tc:' + (p.o ? TC[p.o] : (p.w ? TC[p.w] : '#64748b')) + '"><i style="height:' + (p.o ? 100 : p.p) + '%"></i><b>' + String.fromCharCode(65 + p.i) + '</b></span>').join(''); }
                break;
            }
            case 'bounty': {
                const tg = md.tg ? nameOf(md.tg) : '';
                set('tg', md.tg ? tg : '—'); set('tgn', md.tg ? ('+' + md.bv + '  ·  ' + fmt(md.nt)) : ''); set('t', fmt(md.t)); set('goal', md.goal);
                hud.classList.toggle('me-tg', md.tg === myId);
                const bd = ref.bd, list = Object.values(r.players).sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 4), sig = list.map(p => p.id + ':' + (p.score || 0)).join();
                if (bd && bd.dataset.s !== sig) { bd.dataset.s = sig; bd.innerHTML = list.map(p => '<span class="' + (p.id === myId ? 'me' : '') + (p.id === md.tg ? ' tg' : '') + '"><u>' + (p.id === md.tg ? '🎯' : '') + '</u>' + esc(p.name) + '<b>' + (p.score || 0) + '</b></span>').join(''); }
                break;
            }
        }
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- плашка-повідомлення ----------
    function banner(html, cls) {
        let b = $('mfx-banner'), gs = $('game-screen'); if (!b && gs) { b = document.createElement('div'); b.id = 'mfx-banner'; gs.appendChild(b); } if (!b) return;
        b.className = 'show ' + (cls || ''); b.innerHTML = html; clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 3800);
    }
    function onEvent(d) {
        const r = cur(); if (!r || !NEWM.has(r.mode)) return; const sfx = n => { try { playSound(n); } catch (e) {} };
        switch (d.k) {
            case 'enrage': banner('<span>Бос скаженів!</span> <b>' + esc(d.n) + '</b>', 'bad'); sfx('boss_shoot'); break;
            case 'miniboss': banner('<span>На маршруті зʼявився бос!</span>', 'bad'); sfx('boss_shoot'); break;
            case 'capture': banner('<span class="dot" style="background:' + (TC[d.t] || '#fff') + '"></span><span>Точку захоплено:</span> <b>' + String.fromCharCode(64 + d.i) + '</b>', 'good'); sfx('powerup'); break;
            case 'zone': banner('<span>Зона звужується</span> <span>Фаза</span> <b>' + d.ph + '</b>', 'bad'); sfx('boss_shoot'); break;
            case 'zoneFinal': banner('<span>ФІНАЛ: зона стискається до нуля!</span>', 'bad'); sfx('boss_shoot'); break;
            case 'bountyPick': if (md && d.tg === nameOf(myId)) banner('<span>Вас обрано ціллю!</span> <em>+' + d.v + '</em>', 'bad'); else banner('<span>Ціль полювання:</span> <b>' + esc(d.tg) + '</b> <em>+' + d.v + '</em>', 'gold'); sfx('hitmarker'); break;
            case 'bountyClaimed': banner('<b>' + esc(d.by) + '</b> <span>знищив ціль</span> <b>' + esc(d.tg) + '</b> <em>+' + d.v + '</em>', 'good'); sfx('token'); break;
            case 'bountySurvived': banner('<b>' + esc(d.tg) + '</b> <span>пережив полювання</span> <em>+2</em>', 'gold'); sfx('powerup'); break;
        }
    }

    // ---------- покращення (арена) ----------
    window.PERK = { spd: 1, cd: 1 };
    let perkEl = null, perkT = null;
    function closePerk() { clearInterval(perkT); if (perkEl) { perkEl.remove(); perkEl = null; } }
    function showPerks(d) {
        closePerk(); const P = MI.PERKS;
        perkEl = document.createElement('div'); perkEl.id = 'mfx-perk';
        perkEl.innerHTML = '<div class="pk-wrap"><h3>Оберіть покращення</h3><p><span>Хвилю пройдено:</span> <b>' + d.wave + '</b></p><div class="pk-grid">' + d.ids.map((id, i) => {
            const p = P[id], lv = (d.have && d.have[id]) || 0;
            return '<button type="button" class="pk-card" data-id="' + id + '"><i>' + p.e + '</i><b>' + p.n + '</b><span>' + p.d + '</span><small>' + (id === 'heal' ? '&nbsp;' : '<u>Рівень</u> ' + lv + ' → ' + (lv + 1)) + '</small><kbd>' + (i + 1) + '</kbd></button>';
        }).join('') + '</div><div class="pk-time"><i></i></div></div>';
        $('game-screen').appendChild(perkEl);
        const pick = id => { try { playSound('powerup'); } catch (e) {} socket.emit('pickPerk', { roomId: currentRoomId, id }); closePerk(); };
        perkEl.querySelectorAll('.pk-card').forEach(b => b.addEventListener('click', () => pick(b.dataset.id)));
        perkEl._pick = pick; perkEl._ids = d.ids;
        const t0 = performance.now(), bar = perkEl.querySelector('.pk-time i');
        perkT = setInterval(() => { const k = 1 - (performance.now() - t0) / d.ms; if (bar) bar.style.width = Math.max(0, k * 100) + '%'; if (k <= 0) closePerk(); }, 100);
    }
    window.addEventListener('keydown', e => { if (perkEl && perkEl._ids && /^[1-3]$/.test(e.key)) { const id = perkEl._ids[+e.key - 1]; if (id) perkEl._pick(id); } });
    socket.on('perkOffer', showPerks);
    socket.on('perkState', d => { window.PERK = { spd: d.spd || 1, cd: d.cd || 1 }; });
    socket.on('modeEvent', onEvent);
    socket.on('bossWarning', () => { const r = cur(); if (r && NEWM.has(r.mode)) banner('<span>⚠ Бос поруч!</span>', 'bad'); });
    socket.on('gameStarting', () => { window.PERK = { spd: 1, cd: 1 }; md = null; zr = null; closePerk(); removeHud(); });

    // ---------- малювання на мапі ----------
    const teamCol = t => TC[t] || '#94a3b8';
    function drawCore(ctx, c, now) {
        const k = Math.max(0, c.hp / c.max), col = k > 0.6 ? '#38bdf8' : k > 0.3 ? '#f59e0b' : '#ef4444', p = 0.5 + 0.5 * Math.sin(now / 350);
        ctx.save(); ctx.translate(c.x, c.y);
        ctx.fillStyle = 'rgba(15,23,42,.92)'; ctx.shadowColor = col; ctx.shadowBlur = 18 + 10 * p;
        ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.rotate(now / 2200); ctx.fillStyle = col; ctx.globalAlpha = 0.85;
        ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * c.r * 0.55, Math.sin(a) * c.r * 0.55); } ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1; ctx.rotate(-now / 2200); ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, c.r * 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = .5 + .5 * p; ctx.beginPath(); ctx.arc(0, 0, c.r + 14 + 4 * p, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.fillStyle = '#ef4444'; ctx.fillRect(-36, -c.r - 22, 72, 7); ctx.fillStyle = col; ctx.fillRect(-36, -c.r - 22, 72 * k, 7);
        ctx.restore();
    }
    function drawConvoy(ctx, m, now) {
        const cv = m.cv, A = m.A, B = m.B, p = 0.5 + 0.5 * Math.sin(now / 300);
        // старт і фініш
        ctx.save(); ctx.font = '22px Russo One'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 4; ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(A.x, A.y, 55, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = '#22c55e'; ctx.fillText('A', A.x, A.y);
        ctx.shadowColor = '#facc15'; ctx.shadowBlur = 16; ctx.strokeStyle = '#facc15'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(B.x, B.y, 90, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = .12 + .1 * p; ctx.fillStyle = '#facc15'; ctx.beginPath(); ctx.arc(B.x, B.y, 90, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.fillStyle = '#facc15'; ctx.font = '30px Russo One'; ctx.fillText('B', B.x, B.y);
        ctx.restore();
        // вантажівка
        ctx.save(); ctx.translate(cv.x, cv.y); ctx.rotate(cv.a);
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.fillStyle = '#334155'; ctx.fillRect(-38, -21, 54, 42);
        ctx.fillStyle = '#475569'; ctx.fillRect(-34, -17, 46, 34); ctx.fillStyle = '#1e293b'; for (let i = 0; i < 3; i++) ctx.fillRect(-30 + i * 14, -13, 10, 26);
        ctx.fillStyle = '#0ea5e9'; ctx.fillRect(16, -19, 24, 38); ctx.fillStyle = '#bae6fd'; ctx.fillRect(30, -13, 7, 26);
        ctx.shadowBlur = 0; ctx.fillStyle = '#0f172a'; [-30, -4, 22].forEach(x => { ctx.fillRect(x, -25, 14, 5); ctx.fillRect(x, 20, 14, 5); });
        ctx.restore();
        ctx.save(); ctx.translate(cv.x, cv.y); const k = Math.max(0, cv.hp / cv.max); ctx.fillStyle = '#ef4444'; ctx.fillRect(-36, -cv.r - 22, 72, 7); ctx.fillStyle = '#38bdf8'; ctx.fillRect(-36, -cv.r - 22, 72 * k, 7);
        ctx.strokeStyle = 'rgba(56,189,248,.35)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.arc(0, 0, 380, 0, Math.PI * 2); ctx.stroke(); ctx.restore();   // радіус ескорту
    }
    function drawPoints(ctx, m, now) {
        const p = 0.5 + 0.5 * Math.sin(now / 400);
        m.pts.forEach(pt => {
            const own = pt.o ? teamCol(pt.o) : null, cap = pt.w ? teamCol(pt.w) : null;
            ctx.save(); ctx.translate(pt.x, pt.y);
            ctx.fillStyle = own || cap || '#94a3b8'; ctx.globalAlpha = own ? .18 : .09 + (pt.p / 100) * .1; ctx.beginPath(); ctx.arc(0, 0, pt.r, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
            ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.strokeStyle = own || '#cbd5e1'; ctx.lineDashOffset = -now / 40; ctx.beginPath(); ctx.arc(0, 0, pt.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
            if (!pt.o && pt.p > 0) { ctx.strokeStyle = cap; ctx.lineWidth = 9; ctx.shadowColor = cap; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(0, 0, pt.r - 12, -Math.PI / 2, -Math.PI / 2 + pt.p / 100 * Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0; }
            if (pt.o) { ctx.strokeStyle = own; ctx.lineWidth = 6; ctx.globalAlpha = .6 + .4 * p; ctx.shadowColor = own; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, 0, pt.r - 12, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
            ctx.fillStyle = own || '#e2e8f0'; ctx.font = '34px Russo One'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String.fromCharCode(65 + pt.i), 0, 2);
            ctx.restore();
        });
    }
    function drawZone(ctx, m, now) {
        const z = m.z, mS = (MAP_DATA[cur().map] || MAP_DATA['epic_map']).size;
        const dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
        zr = zr == null ? z.r : zr + (z.r - zr) * Math.min(1, dt * 6);
        ctx.save(); ctx.beginPath(); ctx.rect(-4000, -4000, mS + 8000, mS + 8000); ctx.arc(z.x, z.y, Math.max(1, zr), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220,38,38,.22)'; ctx.fill('evenodd');
        ctx.beginPath(); ctx.arc(z.x, z.y, Math.max(1, zr), 0, Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(248,113,113,.95)'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 20; ctx.stroke(); ctx.restore();
    }
    function drawBounty(ctx, m, now) {
        if (!m.tg) return; const t = m.tg === myId ? myLocalTank : opponents[m.tg]; if (!t || t.hp <= 0) return;
        const p = 0.5 + 0.5 * Math.sin(now / 200);
        ctx.save(); ctx.translate(t.x, t.y); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 3; ctx.shadowColor = '#facc15'; ctx.shadowBlur = 14; ctx.setLineDash([12, 8]); ctx.lineDashOffset = -now / 25;
        ctx.beginPath(); ctx.arc(0, 0, 42 + 4 * p, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([x, y]) => { ctx.moveTo(x * 30, y * 30); ctx.lineTo(x * 56, y * 56); }); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#facc15'; ctx.font = '18px Russo One'; ctx.textAlign = 'center'; ctx.fillText('🎯 +' + m.bv, 0, -66); ctx.restore();
    }
    // стрілки на краю екрана до важливих цілей
    function arrow(ctx, wx, wy, col, txt, now) {
        const sx = GW / 2 + (wx - camera.x) * VS, sy = GH / 2 + (wy - camera.y) * VS, mg = 34;
        if (sx > mg && sx < GW - mg && sy > mg + 40 && sy < GH - mg) return;
        const cx = GW / 2, cy = GH / 2, dx = sx - cx, dy = sy - cy, k = Math.min((cx - mg) / Math.abs(dx || 1e-6), (cy - mg - 20) / Math.abs(dy || 1e-6)), ax = cx + dx * k, ay = cy + dy * k, a = Math.atan2(dy, dx);
        ctx.save(); ctx.translate(ax, ay); ctx.globalAlpha = .75 + .25 * Math.sin(now / 250);
        ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 10; ctx.rotate(a); ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.rotate(-a);
        ctx.shadowBlur = 0; ctx.font = '15px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(txt, -Math.cos(a) * 20, -Math.sin(a) * 20); ctx.restore();
    }

    window.ModesFX = {
        active: m => NEWM.has(m),
        sync(d) { md = d || md; },
        toggle(mode) { if (NEWM.has(mode)) ensureHud(mode); else if (hud) removeHud(); },
        hud() { paint(); },
        world(ctx, now) {
            const r = cur(); if (!md || !r || md.m !== r.mode) return;
            if (md.m === 'base_defense') drawCore(ctx, md.c, now); else if (md.m === 'convoy') drawConvoy(ctx, md, now); else if (md.m === 'capture_points') drawPoints(ctx, md, now);
        },
        top(ctx, now) {
            const r = cur(); if (!md || !r || md.m !== r.mode) return;
            if (md.m === 'battle_royale') drawZone(ctx, md, now); else if (md.m === 'bounty') drawBounty(ctx, md, now);
        },
        screen(ctx, now) {
            const r = cur(); if (!md || !r || md.m !== r.mode) return;
            if (md.m === 'bounty' && md.tg && md.tg !== myId) { const t = opponents[md.tg]; if (t && t.hp > 0) arrow(ctx, t.x, t.y, '#facc15', '🎯', now); }
            else if (md.m === 'convoy') { arrow(ctx, md.cv.x, md.cv.y, '#38bdf8', '🚚', now); arrow(ctx, md.B.x, md.B.y, '#facc15', 'B', now); }
            else if (md.m === 'base_defense') arrow(ctx, md.c.x, md.c.y, '#38bdf8', '🏰', now);
            else if (md.m === 'boss_raid' && md.b) arrow(ctx, md.b.x, md.b.y, '#ef4444', '👹', now);
            else if (md.m === 'capture_points') md.pts.forEach(p => arrow(ctx, p.x, p.y, p.o ? teamCol(p.o) : '#cbd5e1', String.fromCharCode(65 + p.i), now));
        },
        // екран результату для нових режимів (перемога / нічия / поразка + підсумки)
        gameOver(data) {
            const me = data.outcomes[myId] || 'loss', per = (data.per && data.per[myId]) || {}, R = $('winner-reward');
            const T = $('winner-title'), E = $('winner-emoji'), M = $('winner-message');
            if (R) R.innerText = (data.rewards && data.rewards[myId]) || 0;
            const solo = MI.isSolo(data.mode), coop = MI.MODES[data.mode].kind === 'coop' || solo;
            const cls = 'font-russo mb-4 tracking-widest relative z-10 ';
            if (me === 'win') { T.innerText = 'ПЕРЕМОГА!'; T.className = 'text-5xl lg:text-6xl ' + cls + 'text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]'; E.innerText = data.mode === 'battle_royale' ? '👑' : '🏆'; }
            else if (me === 'draw') { T.innerText = 'НІЧИЯ'; T.className = 'text-5xl lg:text-6xl ' + cls + 'text-slate-300'; E.innerText = '🤝'; }
            else { T.innerText = 'ПОРАЗКА'; T.className = 'text-5xl lg:text-6xl ' + cls + 'text-slate-400'; E.innerText = coop ? '💀' : '💔'; }
            M.innerText = data.msg || '';
            if (data.team) { const nm = { red: 'Червоні', blue: 'Сині', green: 'Зелені', yellow: 'Жовті' }[data.team]; if (nm) M.innerText = nm + ' перемогли'; }
            else if (!coop && me !== 'draw' && data.winner && data.name && data.winner !== myId) M.innerText = (data.msg || '') + ' · ' + data.name;
            // підсумки
            let sum = $('mfx-sum'); if (!sum) { sum = document.createElement('div'); sum.id = 'mfx-sum'; M.insertAdjacentElement('afterend', sum); }
            const rows = (data.lines || []).map(l => ({ l: l[0], v: l[1] }));
            const PL = { kills: 'Ваші вбивства', place: 'Ваше місце', bk: 'Знищено цілей', caps: 'Захоплень точок', score: 'Ваші очки' };
            ['place', 'kills', 'bk', 'caps', 'score'].forEach(k => { if (per[k] !== undefined && !(k === 'kills' && per.kills === 0 && data.mode === 'capture_points')) rows.unshift({ l: PL[k], v: per[k] }); });
            sum.innerHTML = rows.map(x => '<div><span>' + esc(x.l) + '</span><b>' + (x.l === 'Рахунок' ? String(x.v).split(' ').map(s => { const q = s.split(':'); return '<i style="color:' + (TC[q[0]] || '#fff') + '">' + q[1] + '</i>'; }).join('<em>:</em>') : esc(x.v)) + '</b></div>').join('');
            closePerk(); removeHud();
        },
        reset() { md = null; zr = null; closePerk(); removeHud(); }
    };
})();
