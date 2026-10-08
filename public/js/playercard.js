/* playercard.js — картка гравця (скляне вікно): ім'я, клан, рівень, танк з екіпіруванням, статистика, «Додати в друзі» / «Написати».
 * API: PlayerCard.open({ roomId, playerId }) — гравець/бот у поточній кімнаті (лобі, гра);
 *      PlayerCard.open({ h }) — непрозорий ідентифікатор (чат, друзі, рейтинг);  PlayerCard.open({ self:true });  PlayerCard.close().
 * Сервер: getPlayerCard → playerCard (див. playercard.js у корені). Логіна й публічного ID у картці немає.
 * «Написати» викликає Chat.openDM(h, nick), якщо модуль чату є. «Додати в друзі» — socialAddByHandle {h}. */
(function () {
    'use strict';
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var SLOTS = ['cannon', 'turret', 'hull', 'tracks'];
    var TIER = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
    var el = null, body = null, cur = null, want = null, stopTank = null, loadT = 0, lastOpenAt = 0, pending = false;

    var css = [
        '.pc-ov{position:fixed;inset:0;z-index:79;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(2,6,23,.78);zoom:var(--ui-wz,var(--ui-zoom,1));--uvh:var(--uvh-w,1dvh);opacity:0;pointer-events:none;transition:opacity .2s}',
        'html:not(.gfx-low) .pc-ov{backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}',
        '.pc-ov *,.pc-ov *::before,.pc-ov *::after{box-sizing:border-box}.pc-ov.on{opacity:1;pointer-events:auto}.pc-ov.hidden{display:none}',
        '.pc-panel{--pc:#60a5fa;position:relative;width:min(640px,100%);max-height:calc(var(--uvh,1vh)*96);display:flex;flex-direction:column;border-radius:24px;color:#e2e8f0;font-family:"Russo One",sans-serif;background:linear-gradient(165deg,rgba(30,41,59,.95),rgba(8,15,32,.97));border:1px solid color-mix(in srgb,var(--pc) 55%,transparent);box-shadow:0 0 44px color-mix(in srgb,var(--pc) 35%,transparent),inset 0 1px 0 rgba(255,255,255,.07);overflow:hidden;transform:translateY(22px) scale(.95);transition:transform .38s cubic-bezier(.16,1,.3,1)}',
        '.pc-ov.on .pc-panel{transform:none}',
        '.pc-x{position:absolute;top:10px;right:10px;z-index:3;width:34px;height:34px;border-radius:50%;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.7);color:#cbd5e1;font-size:15px;cursor:pointer}.pc-x:hover{background:rgba(51,65,85,.9);color:#fff}',
        '.pc-scroll{overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px;display:flex;flex-direction:column;gap:12px}',
        '.pc-hero{position:relative;display:flex;gap:14px;align-items:center;padding:14px;border-radius:18px;background:radial-gradient(120% 140% at 0% 0%,color-mix(in srgb,var(--pc) 24%,transparent),rgba(15,23,42,.6) 60%);border:1px solid rgba(71,85,105,.5);padding-right:50px}',
        '.pc-hero .pf-av{width:76px!important;height:76px!important;font-size:35px!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--pc) 70%,transparent),0 0 22px color-mix(in srgb,var(--pc) 55%,transparent)}',
        '.pc-id{min-width:0;flex:1;display:flex;flex-direction:column;gap:5px}',
        '.pc-nick{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:21px;line-height:1.15;color:#fff;min-width:0}.pc-nick>span:first-child{overflow-wrap:anywhere}',
        '.pc-tag{font-size:12px;padding:2px 7px;border-radius:8px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.5);color:#fcd34d}',
        '.pc-you{font-size:10px;letter-spacing:.1em;padding:3px 8px;border-radius:8px;background:rgba(34,197,94,.18);border:1px solid rgba(34,197,94,.5);color:#86efac}',
        '.pc-dot{width:9px;height:9px;border-radius:50%;background:#475569;flex-shrink:0}.pc-dot.on{background:#22c55e;box-shadow:0 0 8px #22c55e}',
        '.pc-lv{display:flex;align-items:center;gap:9px}.pc-lv .ico{width:38px;height:38px;flex-shrink:0;filter:drop-shadow(0 0 6px var(--glow,#60a5fa))}.pc-lvm{flex:1;min-width:0}',
        '.pc-lvt{font-size:13px;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-lvt span{color:#94a3b8;font-size:11px}',
        '.pc-xp{position:relative;height:13px;margin-top:4px;border-radius:8px;background:rgba(2,6,23,.7);border:1px solid rgba(71,85,105,.6);overflow:hidden}',
        '.pc-xp i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:8px;background:linear-gradient(90deg,var(--c1),var(--c2));transition:width 1s cubic-bezier(.16,1,.3,1) .25s}',
        '.pc-xp span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;text-shadow:0 1px 3px #000}',
        '.pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
        '.pc-card{border-radius:18px;padding:12px;background:rgba(15,23,42,.6);border:1px solid rgba(71,85,105,.45);min-width:0}',
        '.pc-h{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}',
        '.pc-stage{position:relative;display:flex;justify-content:center;border-radius:14px;margin-bottom:8px;background:radial-gradient(closest-side,var(--tg,rgba(96,165,250,.25)),transparent 75%)}',
        '.pc-stage canvas{width:100%;max-width:190px;aspect-ratio:1;display:block}',
        '.pc-mods{display:flex;flex-direction:column;gap:6px}',
        '.pc-mod{--rc:#475569;position:relative;display:flex;align-items:center;gap:9px;padding:6px 8px;border-radius:12px;border:1px solid color-mix(in srgb,var(--rc) 65%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--rc) 16%,rgba(15,23,42,.85)),rgba(15,23,42,.85));box-shadow:0 0 12px color-mix(in srgb,var(--rc) 28%,transparent);cursor:pointer;opacity:0;animation:pcin .45s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*70ms + .1s);overflow:hidden;text-align:left;width:100%;color:inherit;font:inherit}',
        '.pc-mod.empty{--rc:#334155;cursor:default;box-shadow:none;opacity:.55;animation-name:pcin55}',
        '.pc-mi{width:34px;height:34px;flex-shrink:0;padding:3px;border-radius:9px;background:rgba(2,6,23,.65);display:flex;align-items:center;justify-content:center}.pc-mi svg{width:100%;height:100%}',
        '.pc-mt{min-width:0;flex:1}.pc-mn{font-size:12px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-mr{font-size:10px;color:var(--rc);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-mr span{color:#64748b}',
        '.pc-mod .pc-i{width:20px;height:20px;border-radius:50%;border:1px solid rgba(148,163,184,.5);display:flex;align-items:center;justify-content:center;font-size:11px;color:#cbd5e1;flex-shrink:0}',
        'html:not(.gfx-low) .pc-mod.hi::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.22),transparent);transform:skewX(-20deg);animation:pcshine 3.2s ease-in-out infinite 1s}',
        '.pc-tiles{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
        '.pc-tile{--tc:96,165,250;display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:13px;background:linear-gradient(150deg,rgba(30,41,59,.85),rgba(15,23,42,.75));border:1px solid rgba(var(--tc),.35);min-width:0;opacity:0;animation:pcin .45s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*45ms + .15s)}.pc-tile.w2{grid-column:span 2}',
        '.pc-tl{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.pc-tv{font-size:19px;color:rgb(var(--tc));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pc-tv small{font-size:12px;color:#64748b}',
        '.pc-acts{display:flex;gap:10px;flex-wrap:wrap;position:sticky;bottom:-1px;padding-top:6px;background:linear-gradient(180deg,transparent,rgba(8,15,32,.95) 30%)}',
        '.pc-btn{flex:1 1 150px;min-height:44px;padding:10px 14px;border-radius:14px;border:1px solid rgba(96,165,250,.55);background:linear-gradient(180deg,#2563eb,#1d4ed8);color:#fff;font:inherit;font-size:14px;letter-spacing:.04em;cursor:pointer;box-shadow:0 6px 18px rgba(37,99,235,.35);transition:transform .12s,filter .12s}',
        '.pc-btn:hover{filter:brightness(1.12)}.pc-btn:active{transform:scale(.97)}',
        '.pc-btn.alt{background:linear-gradient(180deg,#0f766e,#115e59);border-color:rgba(45,212,191,.55);box-shadow:0 6px 18px rgba(20,184,166,.28)}',
        '.pc-btn.ghost{background:rgba(30,41,59,.8);border-color:rgba(100,116,139,.55);box-shadow:none;color:#cbd5e1}',
        '.pc-btn[disabled]{filter:grayscale(.6) brightness(.8);cursor:default;transform:none}',
        '.pc-load{padding:46px 16px;text-align:center;color:#94a3b8;font-size:14px}.pc-load i{display:block;width:34px;height:34px;margin:0 auto 12px;border-radius:50%;border:3px solid rgba(96,165,250,.25);border-top-color:#60a5fa;animation:pcspin .8s linear infinite}',
        '@keyframes pcin{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}@keyframes pcin55{from{opacity:0}to{opacity:.55}}@keyframes pcspin{to{transform:rotate(360deg)}}@keyframes pcshine{0%,55%{left:-60%}100%{left:130%}}',
        'html.gfx-low .pc-panel{box-shadow:none;transition:none}html.gfx-low .pc-mod{box-shadow:none}html.gfx-low .pc-mod,html.gfx-low .pc-tile{animation-duration:.01s;animation-delay:0s}html.gfx-low .pc-xp i{transition:none}html.gfx-low .pc-ov{transition:none}',
        '@media (prefers-reduced-motion:reduce){.pc-mod,.pc-tile{animation-duration:.01s;animation-delay:0s}.pc-panel{transition:none}}',
        '.lb-pl{cursor:pointer}',
        '@media (max-width:560px){.pc-grid{grid-template-columns:1fr}.pc-scroll{padding:12px}.pc-nick{font-size:18px}.pc-hero .pf-av{width:62px!important;height:62px!important;font-size:28px!important}.pc-stage canvas{max-width:170px}}',
        '@media (max-height:480px) and (orientation:landscape){.pc-ov{padding:4px}.pc-panel{width:min(820px,100%);max-height:calc(var(--uvh,1vh)*98)}.pc-grid{grid-template-columns:1fr 1fr!important}.pc-scroll{padding:8px;gap:8px}.pc-hero{padding:8px 46px 8px 10px}.pc-hero .pf-av{width:50px!important;height:50px!important;font-size:23px!important}.pc-stage canvas{max-width:104px}.pc-stage{margin-bottom:4px}.pc-card{padding:8px}.pc-mod{padding:4px 7px}.pc-mi{width:28px;height:28px}.pc-tile{padding:5px 8px}.pc-tv{font-size:15px}.pc-btn{min-height:38px;padding:6px 12px;flex-basis:130px}}'
    ].join('\n');

    function build() {
        if (el) return;
        var st = document.createElement('style'); st.id = 'pc-css'; st.textContent = css; document.head.appendChild(st);
        el = document.createElement('div'); el.className = 'pc-ov hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
        el.innerHTML = '<div class="pc-panel"><button class="pc-x" type="button" aria-label="Закрити">✕</button><div class="pc-scroll"></div></div>';
        document.body.appendChild(el); body = el.querySelector('.pc-scroll');
        el.querySelector('.pc-x').onclick = function () { snd('ui_click'); close(); };
        el.addEventListener('mousedown', function (e) { if (e.target === el) close(); });
        el.addEventListener('touchstart', function (e) { if (e.target === el) close(); }, { passive: true });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape' || !isOpen()) return;
            var m = document.getElementById('case-info-modal'); if (m && !m.classList.contains('hidden')) { e.preventDefault(); m.classList.add('hidden'); return; }   // спершу закриваємо вікно характеристик модуля
            e.preventDefault(); close();
        });
    }
    function isOpen() { return !!el && el.classList.contains('on'); }
    function halt() { if (stopTank) { stopTank(); stopTank = null; } clearTimeout(loadT); }
    function close() {
        if (!isOpen()) return; halt(); want = null; el.classList.remove('on');
        setTimeout(function () { if (!el.classList.contains('on')) el.classList.add('hidden'); }, 220);
    }

    function open(o) {
        if (!o || typeof o !== 'object' || typeof socket === 'undefined') return;
        var t = Date.now(); if (t - lastOpenAt < 250) return; lastOpenAt = t;
        var req = {};
        if (o.roomId != null && o.playerId != null) { req.roomId = String(o.roomId); req.playerId = String(o.playerId); }
        else if (typeof o.h === 'string' && o.h) req.h = o.h;
        else if (o.self) req.self = true;
        else return;
        build(); halt(); want = req; cur = null; pending = false;
        body.innerHTML = '<div class="pc-load"><i></i>Завантаження…</div>';
        el.querySelector('.pc-panel').style.setProperty('--pc', '#60a5fa');
        el.classList.remove('hidden'); void el.offsetWidth; el.classList.add('on');
        snd('ui_click');
        socket.emit('getPlayerCard', req);
        loadT = setTimeout(function () { if (want === req && !cur) body.innerHTML = '<div class="pc-load">Гравця не знайдено</div>'; }, 7000);
    }
    function sameKey(k) { return !!want && !!k && (k.h || null) === (want.h || null) && (k.roomId || null) === (want.roomId || null) && (k.playerId || null) === (want.playerId || null); }

    function tile(i, rgb, label, val, w2) { return '<div class="pc-tile' + (w2 ? ' w2' : '') + '" style="--i:' + i + ';--tc:' + rgb + '"><div class="pc-tl">' + label + '</div><div class="pc-tv">' + val + '</div></div>'; }
    function modRow(i, slot, id, mod) {
        var cn = (typeof CAT_NAMES !== 'undefined' && CAT_NAMES[slot]) || slot;
        if (!mod) {
            var ic = (typeof SVG_ICONS !== 'undefined' && SVG_ICONS[slot]) ? SVG_ICONS[slot]('#64748b') : '';
            return '<div class="pc-mod empty" style="--i:' + i + '"><span class="pc-mi">' + ic + '</span><span class="pc-mt"><div class="pc-mn">Порожньо</div><div class="pc-mr"><span>' + esc(cn) + '</span></div></span></div>';
        }
        var R = (typeof RARITY !== 'undefined' && RARITY[mod.rarity]) || { name: '', color: '#94a3b8' };
        var hi = (TIER[mod.rarity] || 0) >= 3 ? ' hi' : '';
        return '<button type="button" class="pc-mod' + hi + '" data-mod="' + esc(id) + '" style="--i:' + i + ';--rc:' + esc(R.color) + '"><span class="pc-mi">' + (window.modIcon ? modIcon(mod) : '') + '</span><span class="pc-mt"><div class="pc-mn">' + esc(mod.name) + '</div><div class="pc-mr">' + esc(R.name) + ' <span>· ' + esc(cn) + '</span></div></span><span class="pc-i">i</span></button>';
    }
    function actions(c) {
        if (c.self) return '';
        var h = '';
        if (c.isFriend) h += '<button class="pc-btn ghost" type="button" disabled>✓ Вже у друзях</button>';
        else if (c.reqOut || pending) h += '<button class="pc-btn ghost" type="button" disabled>Запит надіслано</button>';
        else if (c.reqIn) h += '<button class="pc-btn alt" type="button" data-a="add">Прийняти запит</button>';
        else h += '<button class="pc-btn" type="button" data-a="add">➕ Додати в друзі</button>';
        if (window.Chat && typeof Chat.openDM === 'function') h += '<button class="pc-btn alt" type="button" data-a="dm">💬 Написати</button>';
        return h;
    }
    function fmtKd(v) { return v == null ? '—' : (Math.round(v * 100) / 100).toFixed(2); }
    function render(c) {
        cur = c; halt();
        var s = c.stats || {}, L = Math.max(1, c.level | 0), dash = '<span style="opacity:.5">—</span>';
        var best = -1, bestMod = null;
        SLOTS.forEach(function (sl) { var m = c.mods && c.mods[sl]; if (m && (TIER[m.rarity] || 0) > best) { best = TIER[m.rarity] || 0; bestMod = m; } });
        var pc = bestMod && typeof RARITY !== 'undefined' && RARITY[bestMod.rarity] ? RARITY[bestMod.rarity].color : '#60a5fa';
        el.querySelector('.pc-panel').style.setProperty('--pc', pc);
        var tg = window.LV && LV.TIERS ? (LV.TIERS[LV.tierOf(L)] || {}).glow : '#60a5fa';
        var BARS = [['#f59e0b', '#fde68a'], ['#0ea5e9', '#bae6fd'], ['#eab308', '#fef08a'], ['#14b8a6', '#99f6e4'], ['#a855f7', '#e9d5ff'], ['#ef4444', '#fecaca']], bc = BARS[window.LV ? LV.tierOf(L) : 0] || BARS[0];
        var av = window.Profile && Profile.avatar ? Profile.avatar(c.nick || '?', 76) : '';
        var fm = s.favMode && window.ModeInfo && ModeInfo.MODES && ModeInfo.MODES[s.favMode];
        var h = '<div class="pc-hero">' + av + '<div class="pc-id"><div class="pc-nick"><span class="i18n-skip">' + esc(c.nick) + '</span>' + (c.clan ? '<span class="pc-tag i18n-skip">[' + esc(c.clan) + ']</span>' : '') + (c.self ? '<span class="pc-you">ЦЕ ВИ</span>' : '') + '<i class="pc-dot' + (c.online ? ' on' : '') + '"></i></div>' +
            '<div class="pc-lv"><span class="ico" style="--glow:' + esc(tg) + '">' + (window.LV ? LV.icon(L, 38) : '') + '</span><div class="pc-lvm"><div class="pc-lvt">Рівень ' + L + ' <span>· ' + esc(c.rank || '') + '</span></div><div class="pc-xp" style="--c1:' + bc[0] + ';--c2:' + bc[1] + '"><i data-w="' + (c.xpMax ? 100 : Math.max(0, Math.min(100, c.xpPct | 0))) + '"></i><span>' + (c.xpMax ? 'MAX' : (c.xpPct | 0) + '%') + '</span></div></div></div></div></div>';
        h += '<div class="pc-grid"><div class="pc-card"><div class="pc-h">Танк і модулі</div><div class="pc-stage" style="--tg:' + esc(pc) + '55"><canvas id="pc-tank" width="300" height="300"></canvas></div><div class="pc-mods">';
        SLOTS.forEach(function (sl, i) { h += modRow(i, sl, c.equipped && c.equipped[sl], c.mods && c.mods[sl]); });
        h += '</div></div><div class="pc-card"><div class="pc-h">Статистика</div><div class="pc-tiles">';
        var hasG = (s.games | 0) > 0;
        h += tile(0, '59,130,246', 'Ігор', s.games | 0);
        h += tile(1, '245,158,11', 'Перемоги / поразки', hasG || s.wins ? (s.wins | 0) + ' <small>/ ' + (s.losses | 0) + '</small>' : dash);
        h += tile(2, '34,197,94', '% перемог', s.winRate != null ? s.winRate + '%' : dash);
        h += tile(3, '168,85,247', 'K/D', s.kd != null ? fmtKd(s.kd) : dash);
        h += tile(4, '239,68,68', 'Вбивств', s.kills | 0);
        h += tile(5, '148,163,184', 'Смертей', s.hasP ? (s.deaths | 0) : dash);
        h += tile(6, fm && fm.c ? fm.c : '236,72,153', 'Улюблений режим', fm ? esc(fm.e + ' ' + (fm.sn || fm.n)) : dash, true);
        h += '</div></div></div>';
        var a = actions(c); h += '<div class="pc-acts" id="pc-acts">' + a + '</div>';
        body.innerHTML = h; body.scrollTop = 0;
        setTimeout(function () { var f = body.querySelector('.pc-xp i'); if (f) f.style.width = f.dataset.w + '%'; }, 120);
        body.querySelectorAll('.pc-mod[data-mod]').forEach(function (b) { b.onclick = function () { if (window.openModuleInfo) openModuleInfo(b.dataset.mod); }; });
        bindActs();
        var cv = body.querySelector('#pc-tank');
        if (cv && window.Profile && Profile.tank) stopTank = Profile.tank(cv, c.equipped || {}, function () { return isOpen(); });
    }
    function bindActs() {
        var box = body && body.querySelector('#pc-acts'); if (!box) return;
        box.querySelectorAll('button[data-a]').forEach(function (b) {
            b.onclick = function () {
                if (!cur) return;
                if (b.dataset.a === 'add') {
                    snd('ui_click'); if (!cur.h) return; pending = true; b.disabled = true; b.className = 'pc-btn ghost'; b.textContent = 'Запит надіслано';
                    socket.emit('socialAddByHandle', { h: cur.h });
                } else if (b.dataset.a === 'dm') {
                    snd('ui_click'); var h = cur.h, nick = cur.nick; close();
                    try { if (window.Chat && Chat.openDM) Chat.openDM(h, nick); } catch (e) { console.error(e); }
                }
            };
        });
    }

    function init() {
        if (typeof socket === 'undefined' || !socket) return;
        socket.on('playerCard', function (r) {
            if (!r || !isOpen() || !sameKey(r.key)) return;
            clearTimeout(loadT);
            if (r.error || !r.card) { body.innerHTML = '<div class="pc-load">' + esc(r.error || 'Гравця не знайдено') + '</div>'; return; }
            // оновлення стосунків без перемальовування (кнопки), якщо картка та сама
            if (cur && cur.h === r.card.h && cur.nick === r.card.nick && body.querySelector('#pc-acts')) {
                cur = r.card; var box = body.querySelector('#pc-acts'); box.innerHTML = actions(cur); bindActs(); return;
            }
            render(r.card);
        });
        socket.on('socialResult', function (r) {
            if (!isOpen() || !cur || !r || r.kind !== 'add') return;
            if (r.ok) { if (!cur.bot && want) { setTimeout(function () { if (isOpen() && want) socket.emit('getPlayerCard', want); }, 350); } }
            else { pending = false; var box = body.querySelector('#pc-acts'); if (box) { box.innerHTML = actions(cur); bindActs(); } }
        });
        // лобі: клік по рядку гравця (кнопки хоста лишаються окремими)
        document.addEventListener('click', function (e) {
            var row = e.target.closest && e.target.closest('#players-list .lb-pl'); if (!row || e.target.closest('button')) return;
            var id = row.getAttribute('data-key'), rid = typeof currentRoomId !== 'undefined' ? currentRoomId : null;
            if (id && rid) open({ roomId: rid, playerId: id });
        });
    }
    window.PlayerCard = { open: open, close: close, isOpen: isOpen };
    init();
})();
