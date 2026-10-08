// ===== ДРУЗІ та ЗАПРОШЕННЯ В БІЙ =====
// Кнопка «👥» угорі праворуч (MenuHub.addTop) → панель з вкладками «Друзі / Запити / Додати».
// Запрошення в бій — картки-тости ЛІВОРУЧ УГОРІ з відліком 60 с і звуком ui_invite.
// API: Social.open(tab) | Social.invite(login) | Social.isFriend(login) | Social.addByLogin(login) | Social.state()
(function () {
    'use strict';
    var tr = function (s) { return (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var $ = function (id) { return document.getElementById(id); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var sfx = function (n) { try { if (window.UISFX && UISFX.ready()) UISFX.play(n); else if (n === 'ui_invite' || n === 'ui_friend') snd('ui_notify'); } catch (e) {} };

    var S = { pid: 0, dnd: false, max: 50, friends: [], reqIn: [], reqOut: [], got: false };
    var tab = 'friends', isOpen = false, invCool = {}, addMsg = null;

    // ---------- стилі ----------
    var CSS = '' +
        '#sc-ov{position:fixed;inset:0;z-index:200;display:flex;justify-content:flex-end;background:rgba(2,6,23,.62);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:0;pointer-events:none;transition:opacity .22s}' +
        '#sc-ov.on{opacity:1;pointer-events:auto}' +
        'html.gfx-low #sc-ov,html.gfx-medium #sc-ov{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(2,6,23,.82)}' +
        '.sc-panel{position:relative;width:min(440px,100vw);height:100%;display:flex;flex-direction:column;overflow:hidden;font-family:"Russo One",Arial,sans-serif;color:#e2e8f0;' +
        'background:linear-gradient(165deg,rgba(15,28,56,.97),rgba(7,12,28,.98) 60%);border-left:1px solid rgba(96,165,250,.35);box-shadow:-18px 0 60px rgba(0,0,0,.6),inset 0 0 80px rgba(59,130,246,.07);transform:translateX(40px);transition:transform .26s cubic-bezier(.2,.9,.3,1.1)}' +
        '#sc-ov.on .sc-panel{transform:none}' +
        '.sc-panel:before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:linear-gradient(90deg,#22d3ee,#3b82f6,#a855f7,#ec4899);background-size:200% 100%;animation:scSlide 6s linear infinite}' +
        'html.gfx-low .sc-panel:before{animation:none}@keyframes scSlide{to{background-position:200% 0}}' +
        '.sc-hd{display:flex;align-items:center;gap:10px;padding:max(14px,env(safe-area-inset-top)) 14px 8px 16px}' +
        '.sc-hd h2{margin:0;font-size:20px;letter-spacing:.14em;background:linear-gradient(90deg,#67e8f9,#93c5fd 55%,#c4b5fd);-webkit-background-clip:text;background-clip:text;color:transparent;flex:1;white-space:nowrap}' +
        '.sc-hd small{display:block;font-size:10px;letter-spacing:.08em;color:#64748b;-webkit-text-fill-color:#64748b;margin-top:2px}' +
        '.sc-x{width:36px;height:36px;border-radius:50%;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.7);color:#cbd5e1;font-size:16px;cursor:pointer;flex-shrink:0;transition:.2s}' +
        '.sc-x:hover{border-color:#f87171;color:#fecaca;box-shadow:0 0 14px rgba(248,113,113,.4)}' +
        '.sc-dnd{display:flex;align-items:center;gap:7px;font-size:10px;color:#94a3b8;letter-spacing:.04em;cursor:pointer;user-select:none;padding:5px 9px;border-radius:999px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6)}' +
        '.sc-dnd i{width:26px;height:14px;border-radius:8px;background:#334155;position:relative;transition:.2s}.sc-dnd i:after{content:"";position:absolute;left:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#cbd5e1;transition:.2s}' +
        '.sc-dnd.on{color:#fca5a5;border-color:rgba(248,113,113,.5)}.sc-dnd.on i{background:#ef4444}.sc-dnd.on i:after{left:14px;background:#fff}' +
        '.sc-tabs{display:flex;gap:6px;padding:4px 14px 10px}' +
        '.sc-tab{flex:1;position:relative;padding:10px 6px;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.55);color:#94a3b8;font:inherit;font-size:12px;letter-spacing:.06em;cursor:pointer;transition:.2s;white-space:nowrap}' +
        '.sc-tab:hover{color:#e2e8f0;border-color:rgba(96,165,250,.5)}.sc-tab.on{color:#fff;border-color:#60a5fa;background:linear-gradient(135deg,rgba(37,99,235,.55),rgba(124,58,237,.4));box-shadow:0 0 18px rgba(59,130,246,.35)}' +
        '.sc-tab b{display:inline-block;min-width:18px;height:18px;line-height:18px;border-radius:9px;margin-left:5px;padding:0 5px;font-size:10px;background:rgba(148,163,184,.25);color:#e2e8f0}.sc-tab b.hot{background:#ef4444;color:#fff;box-shadow:0 0 10px rgba(239,68,68,.7)}' +
        '.sc-body{flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:0 12px max(14px,env(safe-area-inset-bottom));scrollbar-width:thin;scrollbar-color:#334155 transparent}' +
        '.sc-sec{margin:10px 4px 6px;font-size:10px;letter-spacing:.16em;color:#64748b;display:flex;align-items:center;gap:8px}.sc-sec:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(100,116,139,.5),transparent)}' +
        '.sc-row{display:flex;flex-wrap:wrap;align-items:center;gap:11px;padding:10px;margin-bottom:7px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:linear-gradient(135deg,rgba(30,41,59,.62),rgba(15,23,42,.62));transition:border-color .2s,transform .2s;animation:scIn .28s both}' +
        '.sc-row:hover{border-color:rgba(96,165,250,.45)}.sc-row.off{opacity:.62}' +
        '.sc-still .sc-row{animation:none!important}' +
        '@keyframes scIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}html.gfx-low .sc-row{animation:none}' +
        '.sc-av{position:relative;width:46px;height:46px;border-radius:13px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.25);box-shadow:inset 0 0 14px rgba(255,255,255,.18),0 4px 12px rgba(0,0,0,.4)}' +
        '.sc-av.off{filter:grayscale(.85) brightness(.7)}' +
        '.sc-dot{position:absolute;right:-4px;bottom:-4px;width:14px;height:14px;border-radius:50%;background:#64748b;border:2px solid #0b1224}.sc-dot.s-on{background:#22c55e;box-shadow:0 0 10px #22c55e}.sc-dot.s-bt{background:#f59e0b;box-shadow:0 0 10px #f59e0b}.sc-dot.s-lb{background:#38bdf8;box-shadow:0 0 10px #38bdf8}' +
        '.sc-info{flex:1 1 150px;min-width:0}.sc-nm{display:flex;align-items:center;gap:6px;font-size:15px;line-height:1.15;min-width:0}' +
        '.sc-nm span.n{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc-tag{font-size:10px;padding:1px 5px;border-radius:5px;background:rgba(250,204,21,.15);color:#fde047;border:1px solid rgba(250,204,21,.35);flex-shrink:0}' +
        '.sc-lv{font-size:9px;padding:2px 6px;border-radius:6px;background:rgba(59,130,246,.22);color:#93c5fd;flex-shrink:0;letter-spacing:.04em}' +
        '.sc-st{font-size:11px;margin-top:4px;color:#64748b;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-st.s-on{color:#4ade80}.sc-st.s-lb{color:#7dd3fc}.sc-st.s-bt{color:#fbbf24}' +
        '.sc-acts{display:flex;gap:5px;flex:0 1 auto;flex-wrap:wrap;justify-content:flex-end;margin-left:auto}' +
        '.sc-b{font:inherit;font-size:11px;padding:7px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#cbd5e1;cursor:pointer;transition:.18s;white-space:nowrap;min-height:32px}' +
        '.sc-b:hover:not(:disabled){border-color:#60a5fa;color:#fff;box-shadow:0 0 12px rgba(59,130,246,.4)}.sc-b:disabled{opacity:.38;cursor:not-allowed}' +
        '.sc-b.go{background:linear-gradient(135deg,#16a34a,#15803d);border-color:#4ade80;color:#fff}.sc-b.inv{background:linear-gradient(135deg,#f59e0b,#d97706);border-color:#fbbf24;color:#1c1202}.sc-b.no{border-color:rgba(248,113,113,.5);color:#fca5a5}.sc-b.ico{padding:7px 9px}' +
        '.sc-b.no:hover:not(:disabled){border-color:#f87171;box-shadow:0 0 12px rgba(248,113,113,.45)}' +
        '.sc-empty{text-align:center;color:#64748b;padding:34px 18px;font-size:13px;line-height:1.6}.sc-empty big{display:block;font-size:44px;margin-bottom:8px;filter:grayscale(.3)}' +
        '.sc-add{padding:6px 4px}.sc-me{position:relative;padding:16px;border-radius:16px;margin:8px 0 14px;text-align:center;border:1px solid rgba(96,165,250,.4);background:radial-gradient(120% 140% at 50% 0,rgba(59,130,246,.28),rgba(15,23,42,.7))}' +
        '.sc-me small{display:block;font-size:10px;letter-spacing:.2em;color:#93c5fd}.sc-me .id{font-size:34px;letter-spacing:.14em;margin:6px 0 10px;color:#fff;text-shadow:0 0 18px rgba(96,165,250,.8)}' +
        '.sc-lbl{font-size:10px;letter-spacing:.14em;color:#94a3b8;margin:4px 2px 7px}' +
        '.sc-inp{display:flex;gap:8px}.sc-inp input{flex:1;min-width:0;font:inherit;font-size:20px;letter-spacing:.2em;text-align:center;padding:11px 8px;border-radius:12px;border:1px solid rgba(148,163,184,.35);background:rgba(2,6,23,.7);color:#fff;outline:none;transition:.2s}' +
        '.sc-inp input:focus{border-color:#60a5fa;box-shadow:0 0 16px rgba(59,130,246,.45)}.sc-inp input::placeholder{color:#475569;letter-spacing:.2em}' +
        '.sc-send{font:inherit;font-size:13px;padding:0 18px;border-radius:12px;border:1px solid #60a5fa;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;cursor:pointer;letter-spacing:.04em;transition:.18s;white-space:nowrap}.sc-send:hover:not(:disabled){box-shadow:0 0 18px rgba(99,102,241,.7);transform:translateY(-1px)}.sc-send:disabled{opacity:.5}' +
        '.sc-msg{min-height:20px;margin:10px 2px 0;font-size:12px;line-height:1.4;font-family:Arial,sans-serif;font-weight:700}.sc-msg.ok{color:#4ade80}.sc-msg.err{color:#fca5a5}' +
        '.sc-hint{margin:14px 2px 0;font:12px/1.5 Arial,sans-serif;color:#64748b}' +
        /* ---- тости: запрошення в бій та сповіщення ---- */
        '#sc-toasts{position:fixed;left:max(12px,env(safe-area-inset-left));top:max(12px,env(safe-area-inset-top));z-index:250;display:flex;flex-direction:column;gap:10px;width:min(330px,calc(100vw - 24px));pointer-events:none;font-family:"Russo One",Arial,sans-serif}' +
        '.sc-t{position:relative;pointer-events:auto;overflow:hidden;border-radius:16px;padding:12px 12px 14px;color:#e2e8f0;background:linear-gradient(135deg,rgba(30,27,75,.97),rgba(8,15,35,.97));border:1px solid rgba(251,191,36,.7);box-shadow:0 10px 36px rgba(0,0,0,.65),0 0 26px rgba(245,158,11,.28);animation:scT .42s cubic-bezier(.2,1.3,.4,1) both}' +
        '.sc-t.note{border-color:rgba(96,165,250,.7);box-shadow:0 10px 30px rgba(0,0,0,.6),0 0 22px rgba(59,130,246,.3);cursor:pointer;padding:11px 12px}.sc-t.out{animation:scTo .28s ease-in both}' +
        '@keyframes scT{from{opacity:0;transform:translateX(-120%) scale(.9)}to{opacity:1;transform:none}}@keyframes scTo{to{opacity:0;transform:translateX(-120%)}}' +
        '.sc-t:before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);transform:translateX(-120%);animation:scShine 2.4s .35s 1}@keyframes scShine{to{transform:translateX(120%)}}html.gfx-low .sc-t:before{display:none}' +
        '.sc-th{display:flex;align-items:center;gap:10px}.sc-th .sc-av{width:42px;height:42px;font-size:18px;border-radius:12px}' +
        '.sc-tt{flex:1;min-width:0}.sc-tt small{display:block;font-size:9px;letter-spacing:.18em;color:#fbbf24}.sc-tt b{display:block;font-size:15px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px}' +
        '.sc-note small{color:#7dd3fc}' +
        '.sc-tm{display:flex;flex-wrap:wrap;gap:6px;margin:9px 0 10px}.sc-tm span{font-size:11px;padding:4px 9px;border-radius:8px;background:rgba(15,23,42,.8);border:1px solid rgba(148,163,184,.25);color:#cbd5e1;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.sc-tb{display:flex;gap:8px}.sc-tb .sc-b{flex:1;padding:9px;min-height:38px;font-size:12px}' +
        '.sc-bar{position:absolute;left:0;right:0;bottom:0;height:4px;background:rgba(15,23,42,.9)}.sc-bar i{display:block;height:100%;width:100%;background:linear-gradient(90deg,#f59e0b,#fde047);transform-origin:left;box-shadow:0 0 10px #f59e0b}' +
        '.sc-t.low .sc-bar i{background:linear-gradient(90deg,#ef4444,#f97316)}' +
        '.sc-sec2{font-size:10px;color:#fbbf24;margin-left:auto;font-family:Arial,sans-serif;font-weight:700}' +
        /* під час бою — компактніше й напівпрозоро */
        '#sc-toasts.bt{width:min(250px,calc(100vw - 24px));gap:6px}#sc-toasts.bt .sc-t{padding:7px 8px 10px;border-radius:12px;opacity:.82;background:rgba(10,15,35,.88)}#sc-toasts.bt .sc-t:hover{opacity:1}' +
        '#sc-toasts.bt .sc-tm{display:none}#sc-toasts.bt .sc-th .sc-av{width:30px;height:30px;font-size:13px;border-radius:9px}#sc-toasts.bt .sc-tt b{font-size:12px}#sc-toasts.bt .sc-tt small{font-size:8px}#sc-toasts.bt .sc-th{margin-bottom:6px}#sc-toasts.bt .sc-b{padding:5px;min-height:28px;font-size:11px}' +
        '@media (max-width:600px){.sc-panel{width:100vw;border-left:0}.sc-row{padding:9px}.sc-b{padding:7px 8px}.sc-hd h2{font-size:17px}}' +
        '@media (max-height:460px){.sc-hd{padding-top:8px;padding-bottom:4px}.sc-tabs{padding-bottom:6px}.sc-tab{padding:7px 4px}.sc-me .id{font-size:24px;margin:2px 0 6px}.sc-me{padding:10px;margin:4px 0 8px}.sc-av{width:38px;height:38px}#sc-toasts{width:min(290px,50vw)}.sc-t{padding:7px 9px 11px}.sc-tm{margin:5px 0 6px;gap:4px}.sc-tm span{padding:2px 7px;font-size:10px}.sc-th .sc-av{width:32px;height:32px;font-size:14px}.sc-tt b{font-size:13px}.sc-tb .sc-b{min-height:30px;padding:6px}#sc-toasts{gap:6px}}' +
        '@media (max-height:460px) and (min-width:700px){.sc-panel{width:min(520px,60vw)}}' +
        /* телефон: безпечні зони, цілі дотику ≥44px, поля ≥16px */
        '.sc-body{overscroll-behavior:contain}.sc-panel{padding-right:env(safe-area-inset-right,0px)}.sc-hd{padding-left:max(16px,env(safe-area-inset-left,0px))}.sc-body{padding-left:max(12px,env(safe-area-inset-left,0px))}' +
        '@media (hover:none) and (pointer:coarse){.sc-x{width:44px;height:44px}.sc-tab{min-height:44px}.sc-b{min-height:44px;min-width:44px;font-size:12px}.sc-tb .sc-b{min-height:44px}.sc-inp input{font-size:20px;min-height:48px}.sc-send{min-height:48px}.sc-dnd{min-height:44px}.sc-st,.sc-sec,.sc-lbl,.sc-tag,.sc-sec2{font-size:11px}.sc-tt small{font-size:10px}#sc-toasts.bt .sc-tt small{font-size:10px}#sc-toasts.bt .sc-b{min-height:40px}}' +
        /* бій на телефоні: лише одне запрошення зверху під HUD, не перекриває джойстики/кнопку вогню */
        '@media (hover:none) and (pointer:coarse){#sc-toasts.bt{top:max(48px,calc(env(safe-area-inset-top,0px) + 42px));width:min(230px,calc(100vw - 24px - env(safe-area-inset-left,0px)))}#sc-toasts.bt .sc-t:nth-child(n+2){display:none}#sc-toasts.bt .sc-t{padding:6px 8px 9px}#sc-toasts.bt .sc-th{margin-bottom:5px}#sc-toasts.bt .sc-tb .sc-b,#sc-toasts.bt .sc-b{min-height:38px;padding:4px}}' +
        '@media (max-width:360px){.sc-row{gap:8px}.sc-hd h2{font-size:15px}.sc-dnd{padding:5px 7px}}';

    // ---------- допоміжне ----------
    function hue(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
    function avatar(f, extra, dot) {
        var h = hue(f.login), ch = esc(window.firstChar ? firstChar(f.nick || f.login) : String(f.nick || f.login).trim().charAt(0).toUpperCase() || '?');
        return '<div class="sc-av' + (extra || '') + '" style="background:linear-gradient(135deg,hsl(' + h + ',75%,52%),hsl(' + ((h + 50) % 360) + ',70%,30%))">' + ch + (dot || '') + '</div>';
    }
    function dname(f) { try { if (window.dispName) return window.dispName({ name: f.login, nick: f.nick }) || f.nick || f.login; } catch (e) {} return f.nick || f.login; }
    function modeName(m) { var mi = window.ModeInfo && ModeInfo.MODES && ModeInfo.MODES[m]; return mi ? (mi.e + ' ' + mi.sn) : String(m || ''); }
    function ago(t) {
        if (!t) return 'давно не заходив(ла)';
        var m = Math.floor((Date.now() - t) / 60000);
        if (m < 1) return 'був(ла) щойно';
        if (m < 60) return 'був(ла) ' + m + ' хв тому';
        var h = Math.floor(m / 60); if (h < 24) return 'був(ла) ' + h + ' год тому';
        return 'був(ла) ' + Math.floor(h / 24) + ' дн тому';
    }
    function inBattle() { var g = $('game-screen'); return !!(g && !g.classList.contains('hidden')); }
    function myRoom() { try { return (typeof currentRoomData !== 'undefined' && currentRoomData) ? currentRoomData : null; } catch (e) { return null; } }
    function canInviteNow() {
        var r = myRoom(); if (!r || r.status !== 'lobby' || inBattle()) return false;
        return Object.keys(r.players || {}).length < r.maxPlayers;
    }
    function toast(msg, err) { if (window.uiToast) uiToast(msg, !!err); }
    function emit(ev, d) { try { if (typeof socket !== 'undefined') socket.emit(ev, d); } catch (e) {} }

    // ---------- UI панелі ----------
    var built = false, ov, body, tabsEl, hdSub;
    function build() {
        if (built) return; built = true;
        var st = document.createElement('style'); st.id = 'sc-css'; st.textContent = CSS; document.head.appendChild(st);
        ov = document.createElement('div'); ov.id = 'sc-ov';
        ov.innerHTML = '<div class="sc-panel" role="dialog" aria-modal="true" aria-label="Друзі">' +
            '<div class="sc-hd"><h2>👥 ДРУЗІ<small id="sc-sub"></small></h2><div class="sc-dnd" id="sc-dnd" role="switch" tabindex="0" title="Не отримувати запрошень у бій"><i></i>Не турбувати</div><button class="sc-x" id="sc-x" aria-label="Закрити">✕</button></div>' +
            '<div class="sc-tabs" id="sc-tabs"></div><div class="sc-body" id="sc-body"></div></div>';
        document.body.appendChild(ov);
        body = $('sc-body'); tabsEl = $('sc-tabs'); hdSub = $('sc-sub');
        ov.addEventListener('pointerdown', function (e) { if (e.target === ov) close(); });
        $('sc-x').addEventListener('click', function () { snd('ui_back'); close(); });
        var dnd = $('sc-dnd'), tg = function () { S.dnd = !S.dnd; emit('socialDnd', S.dnd); renderHead(); };
        dnd.addEventListener('click', tg); dnd.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tg(); } });
        tabsEl.addEventListener('click', function (e) { var b = e.target.closest('.sc-tab'); if (b) { setTab(b.dataset.t); } });
        body.addEventListener('click', onBody);
        document.addEventListener('keydown', function (e) { if (isOpen && e.key === 'Escape' && !(window.uiDialog && uiDialog.isOpen())) { e.stopPropagation(); close(); } });
        setInterval(function () { if (isOpen && tab === 'friends') renderList(); }, 30000);
    }
    function setTab(t) { if (t === tab && body.firstChild) return; tab = t; snd('ui_tab'); renderAll(); }
    function open(t) {
        build(); if (t === 'requests' || t === 'add' || t === 'friends') tab = t;
        isOpen = true; ov.classList.add('on'); emit('socialSync'); renderAll();
        if (tab === 'add') setTimeout(function () { var i = $('sc-pid'); if (i && innerWidth > 700) i.focus(); }, 280);
    }
    function close() { if (!ov) return; isOpen = false; ov.classList.remove('on'); }
    function renderHead() {
        if (!built) return;
        var on = S.friends.filter(function (f) { return f.online; }).length;
        hdSub.textContent = S.friends.length + ' / ' + S.max + ' друзів · ' + on + ' онлайн';
        $('sc-dnd').classList.toggle('on', !!S.dnd); $('sc-dnd').setAttribute('aria-checked', S.dnd ? 'true' : 'false');
        var nIn = S.reqIn.length;
        var tabsH = [['friends', 'Друзі', S.friends.length, 0], ['requests', 'Запити', nIn + S.reqOut.length, nIn], ['add', '➕ Додати', 0, 0]].map(function (t) {
            return '<button class="sc-tab' + (tab === t[0] ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + (t[2] ? '<b class="' + (t[3] ? 'hot' : '') + '">' + t[2] + '</b>' : '') + '</button>';
        }).join(''); if (tabsEl.__h !== tabsH) { tabsEl.__h = tabsH; tabsEl.innerHTML = tabsH; }
    }
    function renderAll() {
        if (!built) { badge(); return; }
        renderHead();
        if (tab === 'add') renderAdd(); else renderList();
    }
    function stInfo(f) {
        var s = f.status;
        if (!f.online || !s) return { cls: '', dot: '', txt: ago(f.last) };
        if (s.t === 'battle') return { cls: 's-bt', dot: 's-bt', txt: 'У бою · ' + modeName(s.mode) };
        if (s.t === 'lobby') return { cls: 's-lb', dot: 's-lb', txt: 'У лобі · ' + modeName(s.mode) + ' (' + s.n + '/' + s.max + ')' };
        return { cls: 's-on', dot: 's-on', txt: 'У меню' };
    }
    function nameHtml(f) { return (f.clan ? '<span class="sc-tag">' + esc(f.clan) + '</span>' : '') + '<span class="n">' + esc(dname(f)) + '</span><span class="sc-lv">РІВ. ' + (f.level | 0) + '</span>'; }
    function friendRow(f, i) {
        var si = stInfo(f), s = f.status, r = myRoom(), mineId = (typeof currentRoomId !== 'undefined') ? currentRoomId : null, bt = inBattle();
        var sameRoom = s && s.roomId && s.roomId === mineId;
        var canInv = f.online && s && s.t !== 'battle' && !sameRoom && canInviteNow() && !(invCool[f.login] > Date.now());
        var canJoin = f.online && s && s.t === 'lobby' && s.free && !sameRoom && !bt;
        var acts = '';
        if (f.online) {
            if (canJoin) acts += '<button class="sc-b go" data-a="join" data-l="' + esc(f.login) + '">➜ Приєднатись</button>';
            acts += '<button class="sc-b inv" data-a="inv" data-l="' + esc(f.login) + '"' + (canInv ? '' : ' disabled') + ' title="' + (canInviteNow() ? '' : 'Запрошувати можна, перебуваючи в лобі кімнати з вільними місцями') + '">⚔ Запросити</button>';
        }
        if (window.Profile && Profile.open) acts += '<button class="sc-b ic" data-a="prof" data-l="' + esc(f.login) + '" title="Профіль">👤</button>';
        acts += '<button class="sc-b ico no" data-a="del" data-l="' + esc(f.login) + '" title="Видалити з друзів">✕</button>';
        return '<div data-key="' + esc(f.login) + '" class="sc-row' + (f.online ? '' : ' off') + '" style="animation-delay:' + Math.min(i, 8) * 25 + 'ms">' + avatar(f, f.online ? '' : ' off', '<i class="sc-dot ' + si.dot + '' + '"></i>') +
            '<div class="sc-info"><div class="sc-nm">' + nameHtml(f) + '</div><div class="sc-st ' + si.cls + '">' + esc(si.txt) + '</div></div><div class="sc-acts">' + acts + '</div></div>';
    }
    function renderList() {
        if (!built) return; renderHead();
        if (tab === 'add') return;
        var keep = body.scrollTop, h = '';
        if (tab === 'friends') {
            if (!S.friends.length) h = '<div class="sc-empty"><big>🤝</big>Поки що тут порожньо.<br>Додайте друзів за їхнім ID у вкладці «Додати» — і граймо разом!</div>';
            else {
                var on = S.friends.filter(function (f) { return f.online; }), off = S.friends.filter(function (f) { return !f.online; });
                off.sort(function (a, b) { return (b.last || 0) - (a.last || 0); });
                if (on.length) h += '<div class="sc-sec">ОНЛАЙН · ' + on.length + '</div>' + on.map(friendRow).join('');
                if (off.length) h += '<div class="sc-sec">ОФЛАЙН · ' + off.length + '</div>' + off.map(friendRow).join('');
            }
        } else {
            if (!S.reqIn.length && !S.reqOut.length) h = '<div class="sc-empty"><big>📭</big>Немає активних запитів.</div>';
            if (S.reqIn.length) h += '<div class="sc-sec">ВХІДНІ · ' + S.reqIn.length + '</div>' + S.reqIn.map(function (f, i) {
                return '<div data-key="in:' + esc(f.login) + '" class="sc-row" style="animation-delay:' + Math.min(i, 8) * 25 + 'ms">' + avatar(f, '') + '<div class="sc-info"><div class="sc-nm">' + nameHtml(f) + '</div><div class="sc-st">хоче дружити з вами</div></div><div class="sc-acts"><button class="sc-b go" data-a="acc" data-l="' + esc(f.login) + '">Прийняти</button><button class="sc-b no" data-a="dec" data-l="' + esc(f.login) + '">Відхилити</button></div></div>';
            }).join('');
            if (S.reqOut.length) h += '<div class="sc-sec">ВИХІДНІ · ' + S.reqOut.length + '</div>' + S.reqOut.map(function (f, i) {
                return '<div data-key="out:' + esc(f.login) + '" class="sc-row" style="animation-delay:' + Math.min(i, 8) * 25 + 'ms">' + avatar(f, '') + '<div class="sc-info"><div class="sc-nm">' + nameHtml(f) + '</div><div class="sc-st">очікує підтвердження…</div></div><div class="sc-acts"><button class="sc-b no" data-a="can" data-l="' + esc(f.login) + '">Скасувати</button></div></div>';
            }).join('');
        }
        var sameTab = body.__tab === tab; body.classList.toggle('sc-still', sameTab); body.__tab = tab;
        if (body.__h !== h || !body.firstChild) {
            body.__h = h;
            if (sameTab && window.DomPatch && body.firstChild) DomPatch.html(body, h);   // фонове оновлення: лише змінені вузли (без блимання, збереження hover/прокрутки)
            else { body.innerHTML = h; body.scrollTop = keep; }
        }
    }
    function renderAdd() {
        body.__tab = null; body.__h = null;
        body.innerHTML = '<div class="sc-add"><div class="sc-me"><small>ВАШ ІГРОВИЙ ID</small><div class="id" id="sc-myid">' + (S.pid || '…') + '</div><button class="sc-b" id="sc-copy" data-a="copy">📋 Скопіювати ID</button></div>' +
            '<div class="sc-lbl">ID ГРАВЦЯ, ЯКОГО ХОЧЕТЕ ДОДАТИ</div><div class="sc-inp"><input id="sc-pid" inputmode="numeric" autocomplete="off" maxlength="9" placeholder="0000000" aria-label="ID гравця"><button class="sc-send" id="sc-go" data-a="send">Надіслати запит</button></div>' +
            '<div class="sc-msg" id="sc-msg" role="status" aria-live="polite"></div><div class="sc-hint">ID складається з 7 цифр. Гравець побачить ваш запит одразу (або при наступному вході в гру). Максимум друзів: ' + S.max + '.</div></div>';
        var inp = $('sc-pid');
        inp.addEventListener('input', function () { inp.value = inp.value.replace(/\D/g, '').slice(0, 7); });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') sendAdd(); });
        if (addMsg) showMsg(addMsg.t, addMsg.ok);
    }
    function showMsg(t, ok) { addMsg = { t: t, ok: ok }; var m = $('sc-msg'); if (m) { m.textContent = t; m.className = 'sc-msg ' + (ok ? 'ok' : 'err'); } }
    function sendAdd() {
        var i = $('sc-pid'); if (!i) return; var v = i.value.replace(/\D/g, '');
        if (!/^[1-9]\d{6}$/.test(v)) { showMsg('Введіть коректний ID — 7 цифр', false); snd('ui_error'); return; }
        if (S.pid && String(S.pid) === v) { showMsg('Це ваш власний ID', false); snd('ui_error'); return; }
        $('sc-go').disabled = true; setTimeout(function () { var b = $('sc-go'); if (b) b.disabled = false; }, 900);
        emit('socialAdd', { pid: v });
    }
    function copyId() {
        var t = String(S.pid || ''); if (!t) return;
        var done = function () { var b = $('sc-copy'); if (b) { b.textContent = '✓ Скопійовано'; setTimeout(function () { if ($('sc-copy')) $('sc-copy').textContent = '📋 Скопіювати ID'; }, 1600); } snd('ui_confirm'); };
        try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(done, fb); return; } } catch (e) {}
        fb();
        function fb() { try { var ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); } catch (e) { toast('Ваш ID: ' + t); } }
    }
    function onBody(e) {
        var b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
        var a = b.dataset.a, l = b.dataset.l;
        if (a === 'send') sendAdd();
        else if (a === 'copy') copyId();
        else if (a === 'acc') emit('socialAccept', { login: l });
        else if (a === 'dec') emit('socialDecline', { login: l });
        else if (a === 'can') emit('socialCancel', { login: l });
        else if (a === 'inv') invite(l, b);
        else if (a === 'join') { emit('socialJoinFriend', { login: l }); }
        else if (a === 'prof') { try { Profile.open(l); } catch (er) {} }
        else if (a === 'del') {
            var f = S.friends.filter(function (x) { return x.login === l; })[0];
            var go = function () { emit('socialRemove', { login: l }); };
            if (window.uiDialog && uiDialog.confirm) uiDialog.confirm({ kind: 'danger', icon: '💔', title: 'Видалити з друзів?', text: (f ? dname(f) : l) + ' зникне зі списку ваших друзів. Дружба скасується з обох боків.', okText: 'Видалити', danger: true }).then(function (ok) { if (ok) go(); });
            else if (confirm(window.I18N && I18N.t ? I18N.t('Видалити з друзів?') : 'Видалити з друзів?')) go();
        }
    }
    function invite(l, btn) {
        if (!canInviteNow()) { toast('Зайдіть у лобі кімнати з вільними місцями, щоб запрошувати', true); return; }
        emit('socialInvite', { login: l });
        invCool[l] = Date.now() + 10000; if (btn) { btn.disabled = true; btn.textContent = '✓ Надіслано'; }
        setTimeout(function () { if (isOpen && tab === 'friends') renderList(); }, 10100);
    }

    // ---------- бейдж ----------
    function badge() { var n = S.reqIn.length; if (window.MenuHub) { MenuHub.ready(function () { MenuHub.badge('sc-top', n); }); } }

    // ---------- тости ----------
    var box = null, cards = [], queue = [];
    function ensureBox() {
        if (box) return box;
        if (!$('sc-css')) { var st = document.createElement('style'); st.id = 'sc-css'; st.textContent = CSS; document.head.appendChild(st); }
        box = document.createElement('div'); box.id = 'sc-toasts'; document.body.appendChild(box);
        setInterval(function () { box.classList.toggle('bt', inBattle()); }, 700);
        return box;
    }
    function removeCard(c, quick) {
        var i = cards.indexOf(c); if (i < 0) return; cards.splice(i, 1); clearTimeout(c.tm);
        if (c.timer) clearInterval(c.timer);
        if (quick) c.el.remove(); else { c.el.classList.add('out'); setTimeout(function () { c.el.remove(); }, 300); }
        fillQueue();
    }
    function fillQueue() { while (queue.length && cards.length < 3) addCard(queue.shift()); }
    function addCard(c) {
        ensureBox(); box.classList.toggle('bt', inBattle());
        c.el = document.createElement('div'); c.el.className = 'sc-t' + (c.kind === 'note' ? ' note sc-note' : '');
        c.el.innerHTML = c.html; box.appendChild(c.el); cards.push(c);
        if (c.kind === 'inv') {
            var left = Math.max(0, c.exp - Date.now()), bar = c.el.querySelector('.sc-bar i'), tx = c.el.querySelector('.sc-sec2');
            if (bar) { bar.style.transition = 'transform ' + left + 'ms linear'; requestAnimationFrame(function () { requestAnimationFrame(function () { bar.style.transform = 'scaleX(0)'; }); }); }
            c.timer = setInterval(function () {
                var s = Math.max(0, Math.ceil((c.exp - Date.now()) / 1000)); if (tx) tx.textContent = s + ' с';
                if (s <= 10) c.el.classList.add('low'); if (s <= 0) removeCard(c);
            }, 250);
            if (tx) tx.textContent = Math.ceil(left / 1000) + ' с';
            c.el.addEventListener('click', function (e) {
                var b = e.target.closest('[data-a]'); if (!b) return; snd('ui_click');
                if (b.dataset.a === 'ok') emit('socialInviteAccept', { id: c.id }); else emit('socialInviteDecline', { id: c.id });
                removeCard(c);
            });
        } else {
            c.tm = setTimeout(function () { removeCard(c); }, c.ttl || 6500);
            c.el.addEventListener('click', function () { removeCard(c); open(c.tab || 'friends'); });
        }
    }
    function showInvite(d) {
        if (!d || !d.id) return;
        for (var i = 0; i < cards.length; i++) if (cards[i].kind === 'inv' && cards[i].id === d.id) return;
        var f = d.from || {}, mi = window.ModeInfo && ModeInfo.MODES && ModeInfo.MODES[d.mode];
        var c = {
            kind: 'inv', id: d.id, exp: Date.now() + Math.min(60000, d.ttl || 60000),
            html: '<div class="sc-th">' + avatar(f, '') + '<div class="sc-tt"><small>⚔ ЗАПРОШЕННЯ В БІЙ</small><b>' + (f.clan ? '[' + esc(f.clan) + '] ' : '') + esc(dname(f)) + '</b></div><span class="sc-sec2"></span></div>' +
                '<div class="sc-tm"><span>' + esc(mi ? mi.e + ' ' + mi.sn : d.mode) + '</span><span>🗺 ' + esc(d.map || '') + '</span><span>👥 ' + (d.n | 0) + '/' + (d.max | 0) + '</span></div>' +
                '<div class="sc-tb"><button class="sc-b go" data-a="ok">Прийняти</button><button class="sc-b no" data-a="no">Відхилити</button></div><div class="sc-bar"><i></i></div>'
        };
        sfx('ui_invite');
        if (cards.length >= 3) queue.push(c); else addCard(c);
    }
    function note(icon, small, text, tabName) {
        ensureBox();
        var c = { kind: 'note', tab: tabName, html: '<div class="sc-th"><div class="sc-av" style="background:linear-gradient(135deg,#2563eb,#7c3aed)">' + icon + '</div><div class="sc-tt"><small>' + esc(small) + '</small><b>' + esc(text) + '</b></div></div>' };
        // не накопичуємо сповіщення: старе — геть
        cards.filter(function (x) { return x.kind === 'note'; }).slice(0, -1).forEach(function (x) { removeCard(x, true); });
        if (cards.length >= 3) { var o = cards.filter(function (x) { return x.kind === 'note'; })[0]; if (o) removeCard(o, true); }
        if (cards.length >= 3) queue.push(c); else addCard(c);
        sfx('ui_friend');
    }

    // ---------- сокет ----------
    function bind() {
        try { if (typeof socket === 'undefined' || !socket || !socket.on) return false; } catch (e) { return false; }
        socket.on('socialState', function (st) {
            if (!st) return; S.pid = st.pid; S.dnd = !!st.dnd; S.max = st.max || 50; S.friends = st.friends || []; S.reqIn = st.reqIn || []; S.reqOut = st.reqOut || []; S.got = true;
            badge(); if (isOpen) { if (tab === 'add') { renderHead(); var m = $('sc-myid'); if (m) m.textContent = S.pid; } else renderList(); }
        });
        socket.on('socialResult', function (r) {
            if (!r) return;
            if (r.kind === 'add') { if (isOpen && tab === 'add') { showMsg(r.msg, r.ok); if (r.ok) { var i = $('sc-pid'); if (i) i.value = ''; } } else toast(r.msg, !r.ok); snd(r.ok ? 'ui_confirm' : 'ui_error'); return; }
            if (r.kind === 'inv' || r.kind === 'join' || r.kind === 'rl' || !r.ok) { toast(r.msg, !r.ok); if (!r.ok) snd('ui_error'); if (r.kind === 'inv' && !r.ok) { invCool = {}; if (isOpen) renderList(); } return; }
            if (r.msg) toast(r.msg);
        });
        socket.on('socialNotify', function (n) {
            if (!n) return;
            if (n.type === 'request') note('🤝', 'ЗАПИТ У ДРУЗІ', 'Вам запропонували дружбу: ' + dname(n.from || {}), 'requests');
            else if (n.type === 'accepted') note('✅', 'НОВИЙ ДРУГ', dname(n.from || {}) + ' тепер ваш друг', 'friends');
            else if (n.type === 'pending') note('🤝', 'ЗАПИТИ У ДРУЗІ', 'Вам запропонували дружбу (' + (n.n | 0) + ')', 'requests');
        });
        socket.on('socialInvite', function (d) { showInvite(d); });
        socket.on('socialInviteGone', function (d) { cards.slice().forEach(function (c) { if (c.kind === 'inv' && d && c.id === d.id) removeCard(c); }); queue = queue.filter(function (c) { return !(d && c.id === d.id); }); });
        socket.on('socialJoin', function (d) { if (d && d.roomId) { close(); emit('joinRoom', d.roomId); } });
        socket.on('authSuccess', function () { setTimeout(function () { emit('socialSync'); }, 400); });
        socket.on('disconnect', function () { cards.slice().forEach(function (c) { if (c.kind === 'inv') removeCard(c, true); }); queue = []; });
        return true;
    }
    function init() {
        if (window.MenuHub) MenuHub.addTop({ id: 'sc-top', icon: '👥', title: 'Друзі', onClick: function () { open('friends'); } });
        if (!bind()) { var t = 0, iv = setInterval(function () { if (bind() || ++t > 50) clearInterval(iv); }, 200); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

    window.Social = {
        open: open, close: close,
        invite: function (login) { if (!canInviteNow()) { toast('Зайдіть у лобі кімнати з вільними місцями, щоб запрошувати', true); return; } emit('socialInvite', { login: login }); },
        isFriend: function (login) { return S.friends.some(function (f) { return f.login === login; }); },
        addByLogin: function (login) { emit('socialAdd', { login: login }); },
        state: function () { return S; }
    };
})();
