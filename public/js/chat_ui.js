/* chat_ui.js — «важка» частина чату (підвантажується при першому відкритті панелі): панель, вкладки, список співрозмовників,
 * рядки повідомлень, панель емодзі, налаштування, контекстне меню гравця. Працює через window.Chat._ (див. chat.js). */
(function () {
    'use strict';
    var C = window.Chat; if (!C || !C._ || C._ui) return;
    var X = C._, S = X.S, el = X.el, D = document, pn, tabsEl, subEl, ms, dn, inp, cnt, emoEl, setEl, ctxEl, built = false;

    var css = '.ch-pn{display:none;flex-direction:column;width:340px;max-width:calc(100vw - 16px);height:clamp(170px,25vh,270px);background:rgba(8,13,30,.975);border:1px solid rgba(110,150,255,.32);border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.55),inset 0 0 0 1px rgba(255,255,255,.03);overflow:hidden;position:relative}' +
        '#ch-root.op .ch-pn{display:flex;animation:chIn .16s ease-out}@keyframes chIn{from{opacity:0;transform:translateY(6px)}}' +
        'html:not(.gfx-low):not(.gfx-medium) #ch-root:not([data-k=game]) .ch-pn{backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '#ch-root[data-k=game] .ch-pn{background:rgba(8,12,26,.74);width:360px;height:clamp(190px,34vh,260px)}' +
        '#ch-root[data-t="1"] .ch-pn{width:min(420px,calc(100vw - 16px));height:min(55dvh,340px)}#ch-root[data-k=game][data-t="1"] .ch-pn{width:min(330px,60vw);height:min(55dvh,260px)}' +
        '.ch-hd{display:flex;align-items:stretch;border-bottom:1px solid rgba(110,150,255,.2);background:rgba(20,32,70,.5);flex:none}' +
        '.ch-tabs{flex:1;display:flex;overflow-x:auto;scrollbar-width:none;min-width:0}.ch-tabs::-webkit-scrollbar{display:none}' +
        '.ch-tab{position:relative;flex:none;padding:8px 9px;font:11px/1 "Russo One",system-ui,sans-serif!important;color:#8fa3d6;white-space:nowrap;border-bottom:2px solid transparent;letter-spacing:.02em}' +
        '.ch-tab.on{color:#fff;border-bottom-color:#60a5fa;background:rgba(59,130,246,.14)}.ch-tab:hover{color:#fff}.ch-tab u{text-decoration:none;position:absolute;top:2px;right:1px;min-width:15px;height:15px;border-radius:8px;background:#ef4444;color:#fff;font:700 10px/15px Arial,sans-serif;text-align:center;padding:0 3px}' +
        '.ch-ib{flex:none;width:30px;font-size:14px!important;color:#8fa3d6;display:flex;align-items:center;justify-content:center}.ch-ib:hover{color:#fff;background:rgba(255,255,255,.08)}' +
        '.ch-sub{display:none;flex:none;gap:6px;padding:5px 7px;overflow-x:auto;scrollbar-width:none;border-bottom:1px solid rgba(110,150,255,.14);color:#6b7ca8;font-size:11.5px;align-items:center}.ch-sub.on{display:flex}.ch-sub::-webkit-scrollbar{display:none}' +
        '.ch-pr{position:relative;flex:none;display:flex;align-items:center;gap:5px;padding:2px 9px 2px 2px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid transparent!important;max-width:130px;color:#dbe6ff}.ch-pr.on{background:rgba(59,130,246,.28);border-color:rgba(96,165,250,.7)!important}' +
        '.ch-av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:700 11px/1 Arial,sans-serif;color:#fff;position:relative;flex:none}.ch-av.o:after{content:"";position:absolute;right:-1px;bottom:-1px;width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 1.5px #0b1226}' +
        '.ch-pr span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px}.ch-pr u{text-decoration:none;min-width:15px;height:15px;border-radius:8px;background:#ef4444;color:#fff;font:700 10px/15px Arial,sans-serif;text-align:center;padding:0 3px}' +
        '.ch-ms{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:6px 8px;scrollbar-width:thin;scrollbar-color:#3b4f8f transparent;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;overflow-wrap:anywhere;user-select:text}' +
        '.ch-ms .ch-m{animation:chFd .18s ease-out}@keyframes chFd{from{opacity:0}}.ch-m time{color:#5f7199;font-size:10px;margin-right:5px}' +
        '.ch-m.at{background:linear-gradient(90deg,rgba(250,204,21,.18),transparent);border-left:2px solid #facc15;padding-left:5px;margin-left:-7px}' +
        '.ch-em0{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;text-align:center;color:#6b7ca8;gap:4px;padding:0 14px}.ch-em0 i{font-size:26px;font-style:normal;opacity:.7}' +
        '.ch-dn{position:absolute;left:50%;transform:translateX(-50%);bottom:50px;display:none;padding:4px 12px;border-radius:14px;background:#2563eb;color:#fff;font-size:11px;box-shadow:0 3px 10px rgba(0,0,0,.5)}.ch-dn.on{display:block}' +
        '.ch-in{flex:none;display:flex;align-items:center;gap:4px;padding:6px;border-top:1px solid rgba(110,150,255,.2);background:rgba(8,14,32,.6);position:relative}' +
        '.ch-in input{flex:1;min-width:0;height:32px;padding:0 9px;border-radius:9px;border:1px solid rgba(110,150,255,.3);background:rgba(2,6,23,.7);color:#fff;font:13px system-ui,Arial,sans-serif;outline:none}.ch-in input:focus{border-color:#60a5fa;box-shadow:0 0 0 2px rgba(96,165,250,.22)}.ch-in input:disabled{opacity:.5}' +
        '.ch-in button{flex:none;width:32px;height:32px;border-radius:9px;background:rgba(255,255,255,.07);font-size:15px}.ch-in button:hover{background:rgba(255,255,255,.15)}.ch-in .sd{background:#2563eb;color:#fff}.ch-in .sd:hover{background:#3b82f6}' +
        '.ch-cnt{position:absolute;right:82px;top:-14px;font-size:10px;color:#6b7ca8;pointer-events:none}.ch-cnt.w{color:#f87171}' +
        '.ch-emo,.ch-set,.ch-ctx{display:none;position:absolute;z-index:3;background:#0d1631;border:1px solid rgba(110,150,255,.4);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.6)}' +
        '.ch-emo{left:6px;right:6px;bottom:46px;padding:6px;flex-wrap:wrap;gap:2px;max-height:50%;overflow-y:auto}.ch-emo.on{display:flex}.ch-emo button{width:30px;height:30px;font-size:19px;border-radius:7px}.ch-emo button:hover{background:rgba(255,255,255,.12)}' +
        '.ch-set{left:6px;right:6px;top:36px;bottom:6px;padding:8px 10px;overflow-y:auto}.ch-set.on{display:block}.ch-set h4{margin:2px 0 6px;font:12px "Russo One",system-ui,sans-serif;color:#9fb6e8}.ch-set label{display:flex;gap:8px;align-items:center;padding:5px 0;cursor:pointer;font-size:12.5px}.ch-set input{width:17px;height:17px;accent-color:#3b82f6}' +
        '.ch-hl{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:3px 0;font-size:12px;border-top:1px solid rgba(255,255,255,.06)}.ch-hl button{padding:3px 9px;border-radius:8px;background:#2563eb;font-size:11px}' +
        '.ch-ctx{min-width:140px;padding:4px}.ch-ctx.on{display:block}.ch-ctx b{display:block;padding:3px 8px;font-size:11px;color:#8fa3d6;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ch-ctx button{display:block;width:100%;text-align:left;padding:7px 9px;border-radius:7px;font-size:12.5px}.ch-ctx button:hover{background:rgba(59,130,246,.3)}' +
        '@media (hover:none) and (pointer:coarse){.ch-in input{font-size:16px;height:38px}.ch-in button{width:38px;height:38px}.ch-ib{width:38px}.ch-tab{padding:11px 10px}.ch-m time{display:none}.ch-pr{padding:3px 11px 3px 3px}.ch-av{width:26px;height:26px}.ch-cnt{right:90px}}' +
        '.ch-tabs.many .ch-tab:not(.on) .tt{display:none}.ch-tab u{top:0;right:-1px}@media (max-width:480px){.ch-tab:not(.on) .tt{display:none}.ch-tab{padding-left:10px;padding-right:10px}}' +
        '@media (orientation:landscape) and (max-height:480px){#ch-root[data-t="1"] .ch-pn{height:min(70dvh,260px)}#ch-root[data-t="1"]:not([data-k=game]) .ch-pn{width:min(360px,60vw)}}';
    var st = D.createElement('style'); st.id = 'ch-css2'; st.textContent = css; D.head.appendChild(st);

    function hh(t) { var d = new Date(t || Date.now()); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function btn(cls, txt, a, title) { var b = el('button', cls, txt); b.type = 'button'; if (a) b.dataset.a = a; if (title) b.title = title; return b; }
    function atBottom() { return ms.scrollHeight - ms.scrollTop - ms.clientHeight < 40; }
    function trim() { while (ms.childNodes.length > X.MAX) ms.removeChild(ms.firstChild); }
    function closePop() { if (ctxEl) ctxEl.classList.remove('on'); if (emoEl) emoEl.classList.remove('on'); if (setEl) setEl.classList.remove('on'); }
    function unreadOf(k) { if (k !== 'dm') return S.unread[k] || 0; var n = 0; for (var p in S.unread) if (p.indexOf('dm:') === 0) n += S.unread[p]; return n; }

    // ---------- відмальовування ----------
    function renderTabs() {
        var a = X.tabs(); if (!a.some(function (x) { return x.k === S.tab; })) S.tab = 'global';
        tabsEl.textContent = ''; tabsEl.className = 'ch-tabs' + (a.length >= 4 ? ' many' : '');
        a.forEach(function (x) {
            var b = el('button', 'ch-tab' + (x.k === S.tab ? ' on' : '')); b.type = 'button'; b.dataset.k = x.k;
            b.appendChild(D.createTextNode(x.i + ' ')); b.appendChild(el('span', 'tt', x.t));
            var n = unreadOf(x.k); if (n && (x.k !== S.tab || x.k === 'dm')) b.appendChild(el('u', '', n > 99 ? '99+' : String(n)));
            tabsEl.appendChild(b);
        });
    }
    function renderSub() {
        var dm = S.tab === 'dm'; subEl.className = 'ch-sub' + (dm ? ' on' : ''); if (!dm) return;
        subEl.textContent = '';
        X.peers().forEach(function (p) {
            var b = el('button', 'ch-pr' + (S.peer === p.h ? ' on' : '')); b.type = 'button'; b.dataset.h = p.h;
            var nm = p.nick || '?', av = el('div', 'ch-av' + (p.on ? ' o' : ''), (nm.replace(/^\[.*?\]\s*/, '').charAt(0) || '?').toUpperCase());
            av.style.background = 'hsl(' + (hash(nm) % 360) + ',55%,42%)'; b.appendChild(av); b.appendChild(el('span', 'i18n-skip', nm));
            var n = S.unread['dm:' + p.h]; if (n) b.appendChild(el('u', '', String(n)));
            subEl.appendChild(b);
        });
        if (!subEl.firstChild) subEl.appendChild(el('span', '', 'Немає друзів онлайн'));
    }
    function row(m) {
        var d = el('div', 'ch-m i18n-skip' + (X.mine(m) ? ' me' : '') + (X.isAt(m) ? ' at' : ''));
        d.appendChild(el('time', '', hh(m.t)));
        d.appendChild(el('i', 'ch-lv c' + X.tier(m.lvl), String(m.lvl | 0)));
        var n = el('b', 'ch-n c' + X.tier(m.lvl), X.tag(m)); n.dataset.h = m.h; n.dataset.n = m.nick; d.appendChild(n);
        d.appendChild(el('span', 'tx', ': ' + X.filt(m.text)));
        return d;
    }
    function empty(ico, txt) { var e = el('div', 'ch-em0'); e.appendChild(el('i', '', ico)); e.appendChild(el('span', '', txt)); return e; }
    function renderMsgs() {
        q.length = 0; ms.textContent = ''; var k = X.curKey();
        if (!k) ms.appendChild(empty('👥', X.peers().length ? 'Оберіть співрозмовника зверху' : 'Немає друзів онлайн. Напишіть гравцеві через його картку.'));
        else {
            var a = S.store[k] || [];
            if (!a.length) ms.appendChild(empty('💬', 'Тут поки тихо. Напишіть першим!'));
            else { var f = D.createDocumentFragment(); a.forEach(function (m) { f.appendChild(row(m)); }); ms.appendChild(f); }
        }
        ms.scrollTop = ms.scrollHeight; dn.classList.remove('on');
        inp.disabled = !k; inp.placeholder = k ? 'Повідомлення…' : 'Оберіть співрозмовника';
    }
    function rerender() { if (!built) return; renderTabs(); renderSub(); renderMsgs(); X.markRead(); }
    function refresh() { if (!built) return; renderTabs(); if (S.tab === 'dm') renderSub(); }
    var q = [], qt = 0;
    function flush() {   // усі повідомлення кадру — одним оновленням DOM (один layout замість кількох)
        qt = 0; if (!built || !q.length) { q.length = 0; return; }
        var list = q.splice(0), stick = atBottom() || list.some(X.mine), f = D.createDocumentFragment();
        if (ms.firstChild && ms.firstChild.className === 'ch-em0') ms.textContent = '';
        list.slice(-X.MAX).forEach(function (m) { f.appendChild(row(m)); });
        ms.appendChild(f); trim();
        if (stick) ms.scrollTop = ms.scrollHeight; else dn.classList.add('on');
        if (S.tab === 'dm') renderSub();
    }
    function add(m) { q.push(m); if (!qt) qt = (window.requestAnimationFrame ? requestAnimationFrame(flush) : setTimeout(flush, 30)); }
    function note(txt, cls) {
        if (!built) return; if (ms.firstChild && ms.firstChild.className === 'ch-em0') ms.textContent = '';
        var r = el('div', 'ch-m ' + (cls || 'sys'), txt); ms.appendChild(r); trim(); ms.scrollTop = ms.scrollHeight;
        setTimeout(function () { if (r.parentNode) r.parentNode.removeChild(r); }, 5000);
    }

    // ---------- відправка ----------
    function counter() { var n = inp.value.length; cnt.textContent = n > 140 ? n + '/200' : ''; cnt.className = 'ch-cnt' + (n > 185 ? ' w' : ''); }
    function send() {
        var v = inp.value.trim();
        if (!v) { if (S.kind === 'game' && !S.touch) X.setOpen(false); return; }
        if (S.tab === 'dm') { if (!S.peer) return note('Оберіть співрозмовника'); X.emit('chatSend', { ch: 'dm', to: S.peer, text: v }); }
        else X.emit('chatSend', { ch: S.tab, text: v });
        inp.value = ''; counter();
    }
    function insert(t) { var s = inp.selectionStart == null ? inp.value.length : inp.selectionStart; inp.value = (inp.value.slice(0, s) + t + inp.value.slice(s)).slice(0, 200); counter(); if (!S.touch) inp.focus(); }
    function focus() { if (built && !S.touch) { X.resetKeys(); inp.focus(); } }

    // ---------- вкладки / співрозмовники ----------
    function setTab(k) {
        if (!X.tabs().some(function (x) { return x.k === k; })) k = 'global';
        S.tab = k; X.ls('tab', k); closePop();
        if (k === 'dm') {
            var ps = X.peers(); if (S.peer && !ps.some(function (p) { return p.h === S.peer; })) S.peer = null; if (!S.peer && ps[0]) S.peer = ps[0].h;
            if (S.peer) X.load('dm:' + S.peer, 'dm', S.peer); X.emit('chatFriends');
        } else X.load(k, k);
        inp.value = ''; counter(); rerender();
    }
    function setPeer(h) { S.peer = h; X.load('dm:' + h, 'dm', h); rerender(); if (!S.touch) inp.focus(); }

    // ---------- ліниві підпанелі ----------
    var EMO = '😀😁😂🤣😊😍😎🤔😅😭😡😱👍👎👏🙏💪🔥💥⭐❤️💔🎯🏆🛡️⚔️💣🚀🎉😈💀👀🙌🤝😴🤡🥳😏🤯😬🫡💯✅❌⚡🍀🎮🔧'.match(/\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu) || [];
    function toggleEmo() {
        if (!emoEl) { emoEl = el('div', 'ch-emo'); EMO.forEach(function (e) { var b = btn('', e); b.dataset.e = e; emoEl.appendChild(b); }); emoEl.addEventListener('click', function (ev) { var b = ev.target.closest && ev.target.closest('button'); if (b) insert(b.dataset.e); }); pn.appendChild(emoEl); }
        var on = !emoEl.classList.contains('on'); closePop(); if (on) emoEl.classList.add('on');
    }
    function chk(txt, val, fn) { var l = el('label'), i = el('input'); i.type = 'checkbox'; i.checked = !!val; i.addEventListener('change', function () { fn(i.checked); }); l.appendChild(i); l.appendChild(el('span', '', txt)); return l; }
    function saveHide() { X.ls('hide', JSON.stringify(S.hide)); }
    function renderSet() {
        setEl.textContent = ''; setEl.appendChild(el('h4', '', 'Налаштування чату'));
        setEl.appendChild(chk('Фільтр лайки', S.prof, function (v) { S.prof = v ? 1 : 0; X.ls('prof', S.prof); renderMsgs(); }));
        setEl.appendChild(chk('Звук сповіщень', S.snd, function (v) { S.snd = v ? 1 : 0; X.ls('snd', S.snd); }));
        setEl.appendChild(chk('Журнал чату в бою', S.logOn, function (v) { S.logOn = v ? 1 : 0; X.ls('log', S.logOn); }));
        setEl.appendChild(chk('Приватні повідомлення лише від друзів', S.dmFo, function (v) { S.dmFo = v; X.emit('chatSet', { dmFo: v }); }));
        var hs = Object.keys(S.hide); setEl.appendChild(el('h4', '', 'Приховані гравці'));
        if (!hs.length) setEl.appendChild(el('div', 'ch-hl', 'Нікого'));
        hs.forEach(function (h) { var r = el('div', 'ch-hl'); r.appendChild(el('span', 'i18n-skip', S.hide[h])); var b = btn('', 'Показати'); b.addEventListener('click', function () { delete S.hide[h]; saveHide(); renderSet(); }); r.appendChild(b); setEl.appendChild(r); });
    }
    function toggleSet() {
        if (!setEl) { setEl = el('div', 'ch-set'); pn.appendChild(setEl); }
        var on = !setEl.classList.contains('on'); closePop(); if (on) { renderSet(); setEl.classList.add('on'); }
    }
    function popCtx(h, nick, x, y) {
        if (!ctxEl) {
            ctxEl = el('div', 'ch-ctx'); pn.appendChild(ctxEl);
            ctxEl.addEventListener('click', function (ev) {
                var b = ev.target.closest && ev.target.closest('button'); if (!b) return; var a = b.dataset.a, h2 = ctxEl.dataset.h, n2 = ctxEl.dataset.n; closePop();
                if (a === 'card' && window.PlayerCard) { try { PlayerCard.open({ h: h2 }); } catch (e) {} }
                else if (a === 'dm') X.openDM(h2, n2);
                else if (a === 'hide') { S.hide[h2] = n2; saveHide(); delete S.unread['dm:' + h2]; X.badge(); renderMsgs(); note('Гравця приховано. Повернути можна в налаштуваннях чату', 'ok'); }
            });
        }
        ctxEl.textContent = ''; ctxEl.dataset.h = h; ctxEl.dataset.n = nick; ctxEl.appendChild(el('b', 'i18n-skip', nick));
        if (window.PlayerCard) ctxEl.appendChild(btn('', '👤 Профіль', 'card'));
        if (!S.me || S.me.h !== h) { ctxEl.appendChild(btn('', '✉ Написати', 'dm')); ctxEl.appendChild(btn('', '🚫 Приховати', 'hide')); }
        var pr = pn.getBoundingClientRect(); ctxEl.classList.add('on');
        ctxEl.style.left = Math.max(4, Math.min(x - pr.left, pr.width - ctxEl.offsetWidth - 4)) + 'px'; ctxEl.style.top = Math.max(4, Math.min(y - pr.top, pr.height - ctxEl.offsetHeight - 4)) + 'px';
    }

    // ---------- побудова ----------
    function build() {
        var root = X.root(); pn = el('div', 'ch-pn');
        var hd = el('div', 'ch-hd'); tabsEl = el('div', 'ch-tabs'); hd.appendChild(tabsEl); hd.appendChild(btn('ch-ib', '⚙', 'cfg', 'Налаштування чату')); hd.appendChild(btn('ch-ib', '✕', 'x', 'Згорнути'));
        subEl = el('div', 'ch-sub'); ms = el('div', 'ch-ms'); ms.setAttribute('aria-live', 'polite'); dn = btn('ch-dn', '↓ до нових');
        var r2 = el('div', 'ch-in'); inp = el('input'); inp.type = 'text'; inp.maxLength = 200; inp.autocomplete = 'off'; inp.enterKeyHint = 'send'; inp.spellcheck = false; inp.setAttribute('autocorrect', 'off');
        cnt = el('span', 'ch-cnt'); r2.appendChild(inp); r2.appendChild(cnt); r2.appendChild(btn('', '😊', 'emo', 'Емодзі')); r2.appendChild(btn('sd', '➤', 'send', 'Надіслати'));
        pn.appendChild(hd); pn.appendChild(subEl); pn.appendChild(ms); pn.appendChild(dn); pn.appendChild(r2);
        root.insertBefore(pn, root.firstChild.nextSibling);
        tabsEl.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.ch-tab'); if (b) setTab(b.dataset.k); });
        subEl.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.ch-pr'); if (b) setPeer(b.dataset.h); });
        hd.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'x') X.setOpen(false); else toggleSet(); });
        r2.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'send') { send(); if (!S.touch) inp.focus(); } else toggleEmo(); });
        ms.addEventListener('click', function (e) { var n = e.target.closest && e.target.closest('.ch-n'); if (n && n.dataset.h) popCtx(n.dataset.h, n.dataset.n || '?', e.clientX, e.clientY); else closePop(); });
        ms.addEventListener('scroll', function () { if (atBottom()) dn.classList.remove('on'); }, { passive: true });
        dn.addEventListener('click', function () { ms.scrollTop = ms.scrollHeight; dn.classList.remove('on'); });
        inp.addEventListener('input', counter);
        D.addEventListener('click', function (e) { if (ctxEl && ctxEl.classList.contains('on') && !ctxEl.contains(e.target)) ctxEl.classList.remove('on'); }, true);
        built = true;
    }

    C._ui = true;
    C._reg({
        show: function (f) {
            if (!built) build(); X.layout();
            if (!X.tabs().some(function (x) { return x.k === S.tab; })) S.tab = 'global';
            var k = X.curKey(); if (k) X.load(k, S.tab, S.peer); if (S.tab === 'dm') X.emit('chatFriends');
            rerender(); if (f) focus();
        },
        hide: function () { closePop(); try { if (inp) inp.blur(); } catch (e) {} X.layout(); },
        refresh: refresh, rerender: rerender, add: add, note: note, send: send, focus: focus,
        esc: function () { if ((emoEl && emoEl.classList.contains('on')) || (setEl && setEl.classList.contains('on')) || (ctxEl && ctxEl.classList.contains('on'))) { closePop(); return true; } return false; }
    });
})();
