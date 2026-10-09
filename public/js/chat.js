/* chat.js — «двигун» єдиного чату (сервер: /chat.js): кнопка чату з бейджем, прийом повідомлень, непрочитані, журнал у бою, клавіатурний захист гри.
 * Каналів п'ять: 🌍 Глобальний · 🛡 Клан · 👥 Друзі (DM) · 🏠 Лобі / 🎮 Гра · ⚔ Команда.
 * Важка частина (панель, емодзі, налаштування, контекстне меню) — у chat_ui.js, підвантажується при першому відкритті панелі.
 * window.Chat = { open(ch), close(), toggle(), openDM(h, nick), unread() }. Дані користувачів ніколи не йдуть в innerHTML. */
(function () {
    'use strict';
    if (window.Chat || typeof socket === 'undefined') return;
    var D = document, MAXROWS = 80, CHS = ['global', 'clan', 'room', 'team', 'dm'], TEAMM = { team_deathmatch: 1, capture_points: 1, rounds: 1 };
    var S = { me: null, hasClan: false, dmFo: false, tab: 'global', open: false, store: {}, unread: {}, loaded: {}, peer: null, convs: {}, fr: {}, online: [], rid: null, playing: false, team: false, kind: 'menu', hide: {}, prof: 1, snd: 1, logOn: 1, touch: false, ready: false };
    var root, fab, bdg, logEl, UI = null, pend = [], loading = 0, lastSnd = 0, infoT = 0;

    function lg(k, d) { try { var v = localStorage.getItem('ch_' + k); return v === null ? d : v; } catch (e) { return d; } }
    function ls(k, v) { try { localStorage.setItem('ch_' + k, v); } catch (e) {} }
    function el(tag, cls, txt) { var e = D.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
    function emit(ev, d) { try { socket.emit(ev, d); } catch (e) {} }
    function isTouch() { try { return matchMedia('(hover:none) and (pointer:coarse)').matches || (typeof isMobile !== 'undefined' && !!isMobile); } catch (e) { return false; } }

    var css = '#ch-root{position:fixed;z-index:45;left:14px;bottom:14px;font:12.5px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#dbe6ff;pointer-events:none;-webkit-tap-highlight-color:transparent;max-width:calc(100vw - 16px)}' +
        '#ch-root>*{pointer-events:auto}#ch-root.off{display:none}:where(#ch-root) button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}' +
        '#ch-root[data-k=game]{left:32px;bottom:112px}#ch-root[data-k=game][data-t="1"]{left:8px;bottom:auto;top:calc(env(safe-area-inset-top,0px) + 46px)}' +
        '#ch-root[data-t="1"]:not([data-k=game]){left:max(8px,env(safe-area-inset-left,0px));bottom:max(8px,env(safe-area-inset-bottom,0px))}' +
        '.ch-fab{position:relative;width:44px;height:44px;border-radius:50%;background:linear-gradient(145deg,#1d3a8a,#0f1b44);border:1.5px solid rgba(120,160,255,.55)!important;box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 12px rgba(59,130,246,.35);font-size:20px;line-height:1;display:flex;align-items:center;justify-content:center;transition:transform .15s,opacity .2s}' +
        '.ch-fab:active{transform:scale(.92)}#ch-root[data-k=game] .ch-fab{opacity:.72;width:38px;height:38px;font-size:17px}#ch-root[data-k=game][data-t="1"] .ch-fab{width:36px;height:36px}#ch-root[data-k=game] .ch-fab:hover{opacity:1}#ch-root.op .ch-fab{display:none}' +
        '.ch-fab.nw{animation:chPulse 1.1s ease-out 3}@keyframes chPulse{0%{box-shadow:0 0 0 0 rgba(250,204,21,.8)}100%{box-shadow:0 0 0 14px rgba(250,204,21,0)}}' +
        '.ch-bdg{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font:700 11px/18px system-ui,Arial,sans-serif;text-align:center;box-shadow:0 0 0 2px #0b1226}.ch-bdg:empty{display:none}' +
        '.ch-m{padding:1.5px 0}.ch-lv{display:inline-block;min-width:16px;padding:0 3px;margin-right:4px;border-radius:4px;font:700 9.5px/14px Arial,sans-serif;text-align:center;font-style:normal;color:#0b1226;background:#94a3b8;vertical-align:1px}' +
        '.c1{background:#4ade80}.c2{background:#38bdf8}.c3{background:#c084fc}.c4{background:#fbbf24}' +
        '.ch-n{font-weight:700;cursor:pointer;color:#9fb6e8}.ch-n.c1{color:#86efac;background:none}.ch-n.c2{color:#7dd3fc;background:none}.ch-n.c3{color:#d8b4fe;background:none}.ch-n.c4{color:#fcd34d;background:none}.ch-n:hover{text-decoration:underline}' +
        '.ch-m.me .ch-n{color:#bef264;background:none}.ch-m.sys{color:#fca5a5;font-size:11.5px;font-style:italic}.ch-m.ok{color:#86efac;font-style:italic;font-size:11.5px}.ch-m .tx{color:#e8eeff}' +
        '.ch-log{position:absolute;left:0;bottom:46px;width:min(380px,50vw);display:flex;flex-direction:column;gap:2px;pointer-events:none}.ch-log>div{padding:2px 8px;border-radius:7px;background:rgba(5,9,22,.5);text-shadow:0 1px 2px #000;overflow-wrap:anywhere;transition:opacity 1s;font-size:12.5px}.ch-log>div.f{opacity:0}.ch-log .ch-n{pointer-events:none}#ch-root.op .ch-log{display:none}' +
        '@media (hover:none) and (pointer:coarse){.ch-fab{width:42px;height:42px}}';
    var st = D.createElement('style'); st.id = 'ch-css'; st.textContent = css; D.head.appendChild(st);

    // ---------- фільтр лайки (клієнтський; увімкнений за замовчуванням; список лише основних коренів) ----------
    var BADW = /(?<![\p{L}])(?:ху[йяеіи]|хує|пізд|пизд|єб[аеиіоуя]|еб[аеиіоуя]н|ёб|заєб|заеб|уєб|бляд|блят|бля(?![\p{L}])|суч?к[аиуі](?![\p{L}])|мудак|мудил|гандон|залуп|шлюх|курв|підор|пидор|підар|пидар|дроч|сучар|fuck|shit|bitch|cunt|dick(?:s|head)?(?![\p{L}])|asshole|bastard|whore|slut|nigg|faggot|motherf)[\p{L}]*/giu;
    function filt(t) { if (!S.prof) return t; try { return t.replace(BADW, function (w) { return new Array(w.length + 1).join('*'); }); } catch (e) { return t; } }

    // ---------- спільні допоміжні ----------
    function tier(l) { l = l | 0; return l >= 15 ? 4 : l >= 10 ? 3 : l >= 5 ? 2 : l >= 2 ? 1 : 0; }
    function tag(m) { return (m.clan ? '[' + m.clan + '] ' : '') + m.nick; }
    function mine(m) { return !!(S.me && m.h === S.me.h); }
    function isAt(m) { var n = S.me && S.me.nick ? S.me.nick.toLowerCase() : ''; return !mine(m) && n.length >= 3 && m.text.toLowerCase().indexOf(n) >= 0; }
    function curKey() { return S.tab === 'dm' ? (S.peer ? 'dm:' + S.peer : null) : S.tab; }
    function keyOf(m) { if (m.ch !== 'dm') return m.ch; var p = mine(m) ? m.to : m.h; return typeof p === 'string' && p ? 'dm:' + p : null; }
    function total() { var n = 0; for (var k in S.unread) n += S.unread[k]; return n; }
    function load(key, ch, to) { if (!key || S.loaded[key]) return; S.loaded[key] = 1; emit('chatHistory', { ch: ch, to: to }); }
    function push(key, m) { var a = S.store[key] || (S.store[key] = []); a.push(m); if (a.length > MAXROWS) a.shift(); }
    function peers() {
        var seen = {}, a = [];
        S.online.forEach(function (f) { seen[f.h] = 1; a.push({ h: f.h, nick: f.nick, clan: f.clan, on: 1 }); });
        for (var h in S.convs) { if (seen[h] || S.fr[h]) continue; var c = S.convs[h]; a.push({ h: h, nick: c.nick, clan: c.clan, on: 0 }); }
        return a;
    }
    function tabs() {
        var a = [{ k: 'global', i: '🌍', t: 'Глобальний' }];
        if (S.hasClan) a.push({ k: 'clan', i: '🛡', t: 'Клан' });
        a.push({ k: 'dm', i: '👥', t: 'Друзі' });
        if (S.rid) a.push({ k: 'room', i: S.playing ? '🎮' : '🏠', t: S.playing ? 'Гра' : 'Лобі' });
        if (S.rid && S.team) a.push({ k: 'team', i: '⚔', t: 'Команда' });
        return a;
    }
    function ding() { var n = Date.now(); if (!S.snd || n - lastSnd < 350) return; lastSnd = n; try { UISFX.play('ui_notify'); } catch (e) {} }
    function ui(fn) { if (UI) { try { fn(UI); } catch (e) { console.error('chat ui', e); } return; } pend.push(fn); if (loading) return; loading = 1; var sc = el('script'); try { sc.src = window.__av ? window.__av('js/chat_ui.js') : 'js/chat_ui.js'; } catch (e) { sc.src = 'js/chat_ui.js'; }
        sc.onload = function () { loading = 0; var q = pend.splice(0); q.forEach(function (f) { if (UI) { try { f(UI); } catch (e) { console.error(e); } } }); layout(); };
        sc.onerror = function () { loading = 0; pend.length = 0; S.open = false; layout(); }; D.head.appendChild(sc); }

    // ---------- рядки журналу й системні ----------
    function logRow(m) { var d = el('div', 'ch-m i18n-skip'); d.appendChild(el('b', 'ch-n c' + tier(m.lvl), (m.ch === 'dm' ? '✉ ' : '') + tag(m))); d.appendChild(el('span', 'tx', ': ' + filt(m.text))); return d; }
    function logLine(node) {
        if (!logEl || S.kind !== 'game' || S.touch || !S.logOn || S.open) return;
        logEl.appendChild(node); while (logEl.childNodes.length > 5) logEl.removeChild(logEl.firstChild);
        setTimeout(function () { node.className += ' f'; }, 5200); setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 6400);
    }
    function note(txt, cls) { if (S.open && UI) UI.note(txt, cls); else logLine(el('div', 'ch-m ' + (cls || 'sys'), txt)); }

    // ---------- оновлення бейджа / стану ----------
    function badge() {
        var n = total(); bdg.textContent = n ? (n > 99 ? '99+' : String(n)) : '';
        if (UI && S.open) UI.refresh();
    }
    function layout() {
        if (!root) return;
        root.setAttribute('data-k', S.kind); root.setAttribute('data-t', S.touch ? '1' : '0');
        root.className = (S.me ? '' : 'off') + (S.open && UI ? ' op' : '');
        if (S.open || S.kind !== 'game' || S.touch) logEl.textContent = '';
    }
    function markRead() { var k = curKey(); if (k && S.unread[k]) { delete S.unread[k]; badge(); } fab.classList.remove('nw'); }
    function setOpen(v, focus) {
        v = !!v; if (S.kind !== 'game') ls('open_' + S.kind, v ? '1' : '0');   // у бою стан не запам'ятовуємо: кожен бій починається зі згорнутого чату
         var was = S.open; S.open = v;
        if (v) { ui(function (u) { u.show(focus); }); if (UI) layout(); }
        else { layout(); if (UI && was) UI.hide(); }
    }
    function defOpen(kind) { return kind === 'menu' && !S.touch; }
    function resetKeys() { try { if (typeof keys !== 'undefined') for (var k in keys) keys[k] = false; } catch (e) {} }

    // ---------- вхідні повідомлення ----------
    function clip(m, ch) { return { ch: ch || m.ch, h: m.h, nick: String(m.nick || '?').slice(0, 40), clan: String(m.clan || '').slice(0, 8), lvl: m.lvl | 0, t: +m.t || Date.now(), text: m.text.slice(0, 200), to: typeof m.to === 'string' ? m.to : '' }; }
    function onMsg(m) {
        if (!m || typeof m !== 'object' || CHS.indexOf(m.ch) < 0 || typeof m.text !== 'string' || typeof m.h !== 'string') return;
        m = clip(m);
        if (S.hide[m.h] && !mine(m)) return;
        var key = keyOf(m); if (!key) return;
        if (m.ch === 'dm' && !mine(m)) S.convs[m.h] = { nick: m.nick, clan: m.clan };
        push(key, m);
        var at = isAt(m), vis = S.open && UI && curKey() === key;
        if (vis) UI.add(m);
        else if (!mine(m)) {
            if (!(m.ch === 'global' && S.kind === 'game' && !at)) { S.unread[key] = (S.unread[key] || 0) + 1; badge(); fab.classList.remove('nw'); void fab.offsetWidth; fab.classList.add('nw'); }
            if (m.ch === 'dm' || at || (m.ch === 'clan' && S.kind !== 'game')) ding();
        }
        if (!S.open && !mine(m)) logLine(logRow(m));
        if (S.open && UI && !vis && m.ch === 'dm') UI.refresh();
    }
    function onHist(d) {
        if (!d || CHS.indexOf(d.ch) < 0 || !Array.isArray(d.msgs)) return;
        var key = d.ch === 'dm' ? (typeof d.to === 'string' && d.to ? 'dm:' + d.to : null) : d.ch; if (!key) return;
        var a = []; d.msgs.forEach(function (m) { if (m && typeof m.text === 'string' && typeof m.h === 'string' && !S.hide[m.h]) a.push(clip(m, d.ch)); });
        var last = a.length ? a[a.length - 1].t : 0, cur = S.store[key] || [];
        S.store[key] = a.concat(cur.filter(function (m) { return m.t > last; })).slice(-MAXROWS);
        if (S.open && UI && curKey() === key) UI.rerender();
    }
    function setFriends(l) {
        S.online = []; l.slice(0, 60).forEach(function (f) { if (f && typeof f.h === 'string') { S.online.push({ h: f.h, nick: String(f.nick || '?').slice(0, 40), clan: String(f.clan || '').slice(0, 8) }); S.fr[f.h] = 1; } });
        if (S.tab === 'dm') {
            var ps = peers(); if (S.peer && !ps.some(function (p) { return p.h === S.peer; })) S.peer = null;
            if (!S.peer && ps[0]) { S.peer = ps[0].h; load('dm:' + S.peer, 'dm', S.peer); }
            if (S.open && UI) UI.rerender();
        }
    }

    // ---------- публічні дії ----------
    function openDM(h, nick) {
        if (typeof h !== 'string' || !h || (S.me && S.me.h === h)) return;
        if (S.convs[h]) { if (nick) S.convs[h].nick = String(nick).slice(0, 40); } else if (!S.fr[h]) S.convs[h] = { nick: String(nick || '?').slice(0, 40), clan: '' };
        S.tab = 'dm'; S.peer = h; ls('tab', 'dm'); load('dm:' + h, 'dm', h); setOpen(true, true); if (UI) UI.rerender();
    }
    function openCh(ch) {
        if (ch && tabs().some(function (x) { return x.k === ch; })) { S.tab = ch; ls('tab', ch); if (ch !== 'dm') load(ch, ch); }
        setOpen(true, true); if (UI) UI.rerender();
    }
    window.Chat = {
        open: function (ch) { if (root) openCh(ch); }, close: function () { if (root) setOpen(false); },
        toggle: function () { if (root) { if (S.open) setOpen(false); else openCh(); } },
        openDM: function (h, nick) { if (root) openDM(h, nick); }, unread: total,
        _reg: function (api) { UI = api; },
        _: { S: S, el: el, lg: lg, ls: ls, emit: emit, tier: tier, tag: tag, mine: mine, isAt: isAt, filt: filt, curKey: curKey, load: load, peers: peers, tabs: tabs, total: total, markRead: markRead, setOpen: setOpen, badge: badge, layout: layout, resetKeys: resetKeys, openDM: openDM, note: note, root: function () { return root; }, MAX: MAXROWS }
    };

    // ---------- клавіатура (глобально, фаза capture): чат не керує грою ----------
    function inChat(t) { return !!(t && t.closest && t.closest('#ch-root')); }
    function busyElsewhere() {
        var a = D.activeElement; if (a && a !== D.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !inChat(a)) return true;
        if (window.uiDialog && uiDialog.isOpen && uiDialog.isOpen()) return true;
        return !!D.querySelector('#game-screen .modal:not(.hidden),#settings-modal:not(.hidden)');
    }
    function onKey(e) {
        if (!root) return;
        var t = e.target;
        if (inChat(t) && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
            e.stopPropagation();   // жодних WASD/пробілу/Tab/цифр до гри, поки фокус у полі чату
            if (e.type !== 'keydown' || !UI) return;
            if (e.key === 'Tab') { e.preventDefault(); return; }
            if (e.key === 'Enter') { if (!e.isComposing) { e.preventDefault(); UI.send(); } }
            else if (e.key === 'Escape') { e.preventDefault(); if (!UI.esc()) { if (S.kind === 'game' || S.touch) setOpen(false); else t.blur(); } }
            return;
        }
        if (e.type !== 'keydown' || !S.me) return;
        if (e.key === 'Enter' && S.kind === 'game' && !S.touch && !e.repeat && !e.ctrlKey && !e.altKey && !busyElsewhere()) {
            e.preventDefault(); e.stopPropagation();
            if (S.open && UI) { resetKeys(); UI.focus(); } else openCh();
        }
    }
    window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true);
    D.addEventListener('focusin', function (e) { if (inChat(e.target) && e.target.tagName === 'INPUT') resetKeys(); }, true);

    // ---------- стан гри (легке опитування раз на 600 мс) ----------
    function poll() {
        if (!root || !S.me) return;
        var scr = D.querySelector('.screen-container:not(.hidden)'), id = scr ? scr.id : '';
        if (id === 'login-screen') { if (S.me) { S.me = null; S.ready = false; S.open = false; if (UI) UI.hide(); layout(); } return; }
        var kind = id === 'game-screen' ? 'game' : (id === 'main-menu-screen' || id === 'lobby-screen') ? 'menu' : 'other';
        var rid = null, playing = false, team = false;
        try { if (typeof currentRoomId !== 'undefined' && currentRoomId) { rid = currentRoomId; var rd = currentRoomData; playing = kind === 'game' || !!(rd && rd.status === 'playing'); var me = rd && rd.players && rd.players[myId]; team = !!(rd && TEAMM[rd.mode] && me && me.team); } } catch (e) {}
        var touch = isTouch(), changed = false;
        if (touch !== S.touch) { S.touch = touch; changed = true; }
        if (rid !== S.rid) {
            S.store.room = []; S.store.team = []; delete S.unread.room; delete S.unread.team; S.loaded.room = 0; S.loaded.team = 0; S.rid = rid; changed = true;
            if (rid) load('room', 'room'); else if (S.tab === 'room' || S.tab === 'team') S.tab = 'global';
        }
        if (team !== S.team) { S.team = team; changed = true; if (team) load('team', 'team'); else if (S.tab === 'team') S.tab = 'room'; }
        if (playing !== S.playing) { S.playing = playing; changed = true; }
        if (kind !== S.kind) { S.kind = kind; changed = true; var v = lg('open_' + kind, null); var want = kind === 'game' ? false : v === null ? defOpen(kind) : v === '1'; if (want !== S.open) { S.open = want; if (want) ui(function (u) { u.show(false); }); else if (UI) UI.hide(); } }
        if (changed) { layout(); badge(); if (UI && S.open) UI.rerender(); }
    }

    // ---------- ініціалізація ----------
    function init() {
        S.prof = lg('prof', '1') === '1' ? 1 : 0; S.snd = lg('snd', '1') === '1' ? 1 : 0; S.logOn = lg('log', '1') === '1' ? 1 : 0;
        try { var h = JSON.parse(lg('hide', '{}')); if (h && typeof h === 'object') for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k) && typeof h[k] === 'string') S.hide[k] = h[k]; } catch (e) {}
        S.touch = isTouch(); S.tab = lg('tab', 'global'); if (CHS.indexOf(S.tab) < 0 || S.tab === 'room' || S.tab === 'team') S.tab = 'global';
        root = el('div'); root.id = 'ch-root'; root.className = 'off';
        fab = el('button', 'ch-fab', '💬'); fab.type = 'button'; fab.setAttribute('aria-label', 'Чат'); fab.title = 'Чат'; bdg = el('span', 'ch-bdg'); fab.appendChild(bdg);
        logEl = el('div', 'ch-log'); root.appendChild(logEl); root.appendChild(fab); D.body.appendChild(root);
        fab.addEventListener('click', function () { openCh(); });
        // події миші/дотику по чату не доходять до ігрових обробників (не стріляє, не рухає джойстик)
        ['mousedown', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel'].forEach(function (ev) { root.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true }); });
        socket.on('chatInit', function (d) {
            if (!d || typeof d.h !== 'string') return;
            S.me = { h: d.h, nick: String(d.nick || '').slice(0, 40) }; S.hasClan = !!d.hasClan; S.dmFo = !!d.dmFo;
            if (Array.isArray(d.hist)) { S.store.global = []; d.hist.forEach(function (m) { if (m && typeof m.text === 'string' && typeof m.h === 'string') S.store.global.push(clip(m, 'global')); }); S.loaded.global = 1; }
            if (Array.isArray(d.friends)) setFriends(d.friends);
            if (S.hasClan) load('clan', 'clan'); else { delete S.store.clan; S.loaded.clan = 0; if (S.tab === 'clan') S.tab = 'global'; }
            if (!S.ready) { S.ready = true; var v = lg('open_' + S.kind, null); S.open = S.kind === 'game' ? false : v === null ? defOpen(S.kind) : v === '1'; if (S.open) ui(function (u) { u.show(false); }); }
            layout(); badge(); poll();
        });
        socket.on('chatMsg', onMsg); socket.on('chatHist', onHist);
        socket.on('chatFriends', function (l) { if (Array.isArray(l)) setFriends(l); });
        socket.on('chatErr', function (d) { if (d && typeof d.msg === 'string') note(d.msg.slice(0, 120)); });
        var askInfo = function () { var n = Date.now(); if (n - infoT < 1500) return; infoT = n; emit('chatInfo'); };
        socket.on('clanState', function (d) { if (!!(d && d.mine) !== S.hasClan) askInfo(); });
        socket.on('clanResult', function (r) { if (r && r.ok && r.act && r.act !== 'chat') askInfo(); });
        socket.on('connect', function () { S.loaded = {}; });
        setInterval(poll, 600);
    }
    if (D.body) init(); else D.addEventListener('DOMContentLoaded', init);
})();
