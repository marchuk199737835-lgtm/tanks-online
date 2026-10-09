/* admin.js — інтерфейс адмін-панелі. Відкривається адресою …/#admin після входу в гру акаунтом-адміном.
 * Усі перевірки доступу — на сервері (admin.js у корені): пароль адміна + код 2FA, сесія лише для цього вікна. Тут лише відображення. */
(function () {
    'use strict';
    if (window.AdminUI) return;
    var $ = function (s, r) { return (r || document).querySelector(s); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var css = '#adm{position:fixed;inset:0;z-index:9900;display:none;background:radial-gradient(120% 90% at 50% 0,#14213d,#05070f 70%);color:#e2e8f0;font:14px/1.4 Jura,system-ui,sans-serif;overflow:auto}#adm.on{display:block}' +
        '#adm .w{width:min(1100px,100%);margin:0 auto;padding:max(12px,env(safe-area-inset-top)) 12px 24px}#adm h1{margin:0;font:400 22px/1.2 "Russo One",Arial;letter-spacing:.12em;color:#fff}#adm h1 small{font:700 11px Jura;color:#f87171;letter-spacing:.2em;margin-left:8px}' +
        '#adm .top{display:flex;align-items:center;gap:10px;margin-bottom:12px}#adm .top .sp{flex:1}#adm button{padding:9px 14px;border-radius:11px;border:1px solid rgba(148,163,184,.3);background:rgba(30,41,59,.9);color:#e2e8f0;font:700 12.5px Jura,Arial;cursor:pointer}#adm button:hover{border-color:#818cf8}' +
        '#adm button.p{background:linear-gradient(90deg,#4f46e5,#7c3aed);border:0;color:#fff}#adm button.d{background:#7f1d1d;border-color:#ef4444;color:#fff}#adm button.g{background:#065f46;border-color:#10b981;color:#fff}' +
        '#adm input,#adm select,#adm textarea{padding:9px 11px;border-radius:10px;border:1px solid #334155;background:#0b1224;color:#fff;font:14px Jura,Arial;min-width:0}#adm textarea{width:100%;min-height:70px;resize:vertical}' +
        '#adm .card{border-radius:16px;background:rgba(15,23,42,.85);border:1px solid rgba(99,102,241,.25);padding:14px;margin-bottom:12px}#adm .card h3{margin:0 0 10px;font:400 14px "Russo One",Arial;letter-spacing:.1em;color:#a5b4fc}' +
        '#adm .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}#adm .st{padding:10px;border-radius:12px;background:#0b1224;border:1px solid #1e293b}#adm .st b{display:block;font:400 22px "Russo One",Arial;color:#fff}#adm .st small{color:#94a3b8;font-size:11px}' +
        '#adm .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}#adm .tabs button.on{background:rgba(79,70,229,.5);border-color:#818cf8;color:#fff}' +
        '#adm .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}#adm table{width:100%;border-collapse:collapse;font-size:12.5px}#adm td,#adm th{padding:7px 6px;border-bottom:1px solid #1e293b;text-align:left;vertical-align:top}#adm th{color:#94a3b8;font-size:11px}' +
        '#adm .u{display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:12px;background:#0b1224;border:1px solid #1e293b;margin-bottom:8px}#adm .u .n{font-weight:800;color:#fff}#adm .u .ban{color:#fca5a5}#adm .ok{color:#4ade80}#adm .bad{color:#f87171}' +
        '#adm .login{max-width:380px;margin:12vh auto 0;text-align:center}#adm .login input{width:100%;margin-bottom:10px;font-size:16px;text-align:center}#adm .msg{min-height:20px;margin:6px 0;font-size:13px}' +
        '#adm .toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);padding:10px 16px;border-radius:12px;background:#1e293b;border:1px solid #818cf8;z-index:9901}';
    var se = document.createElement('style'); se.textContent = css; document.head.appendChild(se);
    var root = document.createElement('div'); root.id = 'adm'; document.body.appendChild(root);
    var S = { authed: false, tab: 'dash', stats: null, cases: [], modes: [], list: [], log: [], q: '' }, iv = null;
    function toast(m, bad) { var t = document.createElement('div'); t.className = 'toast'; t.style.borderColor = bad ? '#ef4444' : '#818cf8'; t.textContent = m; root.appendChild(t); setTimeout(function () { t.remove(); }, 3000); }
    function close() { root.classList.remove('on'); clearInterval(iv); if (location.hash === '#admin') history.replaceState(null, '', location.pathname); }
    function open() { root.classList.add('on'); render(); if (S.authed) refresh(); }
    function loginView() {
        root.innerHTML = '<div class="w"><div class="login card"><h1>🔐 ADMIN</h1><p style="color:#94a3b8;font-size:12px">Пароль адміністратора і код з додатка-автентифікатора</p>' +
            '<input id="ad-p" type="password" placeholder="Пароль адміна" autocomplete="current-password"><input id="ad-c" inputmode="numeric" maxlength="6" placeholder="Код 2FA (6 цифр)" autocomplete="one-time-code">' +
            '<div class="msg" id="ad-m"></div><div class="row" style="justify-content:center"><button class="p" id="ad-go">Увійти</button><button id="ad-x">Закрити</button></div></div></div>';
        var go = function () { $('#ad-go').disabled = true; $('#ad-m').textContent = 'Перевірка…'; socket.emit('admAuth', { pass: $('#ad-p').value, code: $('#ad-c').value }); };
        $('#ad-go').onclick = go; $('#ad-x').onclick = close;
        root.querySelectorAll('input').forEach(function (i) { i.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); }); });
        setTimeout(function () { $('#ad-p').focus(); }, 50);
    }
    function render() {
        if (!S.authed) return loginView();
        var T = [['dash', '📊 Огляд'], ['users', '👥 Гравці'], ['event', '🔥 Подія'], ['ann', '📢 Оголошення'], ['log', '📜 Журнал']];
        root.innerHTML = '<div class="w"><div class="top"><h1>PULS · ADMIN<small>●  LIVE</small></h1><span class="sp"></span><button id="ad-out">Вийти</button><button id="ad-x">✕</button></div>' +
            '<div class="tabs">' + T.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</div><div id="ad-b"></div></div>';
        $('#ad-x').onclick = close; $('#ad-out').onclick = function () { socket.emit('admLogout'); S.authed = false; clearInterval(iv); render(); };
        root.querySelectorAll('.tabs button').forEach(function (b) { b.onclick = function () { S.tab = b.dataset.t; render(); refresh(); }; });
        body();
    }
    function fmtT(t) { var d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString().slice(0, 5); }
    function up(s) { var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return (h ? h + ' год ' : '') + m + ' хв'; }
    function body() {
        var b = $('#ad-b'); if (!b) return; var s = S.stats;
        if (S.tab === 'dash') {
            if (!s) { b.innerHTML = '<div class="card">Завантаження…</div>'; return; }
            var st = function (v, l) { return '<div class="st"><b>' + v + '</b><small>' + l + '</small></div>'; };
            b.innerHTML = '<div class="card"><h3>Онлайн</h3><div class="grid">' + st(s.online, 'гравців онлайн') + st(s.inBattle, 'у бою') + st(s.rooms.lobby + ' / ' + s.rooms.play, 'лобі / боїв') + st(s.rooms.ranked, 'рейтингових боїв') + st(s.queue, 'у черзі рейтингу') + st(s.bots + ' (+' + s.virtual + ')', 'ботів (віртуальних сесій)') + st(s.users, 'акаунтів усього') + st(s.push, 'з push-підпискою') + '</div></div>' +
                '<div class="card"><h3>Сервер і база даних</h3><div class="grid">' + st(up(s.uptime), 'працює') + st(s.mem + ' МБ', 'пам’ять (heap ' + s.heap + ')') + st(s.db.on ? '<span class="ok">ON</span>' : '<span class="bad">OFF</span>', 'MongoDB') + st(s.db.perMin, 'записів/хв') + st(s.db.writes, 'записів усього') + st(s.db.skipped, 'пропущено (без змін)') + st(s.db.pending, 'чекають запису') + st(s.db.errors ? '<span class="bad">' + s.db.errors + '</span>' : 0, 'помилок БД') + '</div><div class="row" style="margin-top:10px"><button id="ad-fl">Записати в БД зараз</button></div></div>' +
                '<div class="card"><h3>Подія</h3>' + (s.event ? '🔥 <b>' + esc(s.event.title) + '</b> · ×' + s.event.cr + ' кредитів · ×' + s.event.xp + ' XP · ' + (s.event.mode || 'усі режими') + ' · до ' + fmtT(s.event.until) : 'Немає активної події') + '</div>';
            $('#ad-fl').onclick = function () { socket.emit('admFlush'); };
        } else if (S.tab === 'users') {
            b.innerHTML = '<div class="card"><div class="row"><input id="ad-q" placeholder="Логін, нік або ID" value="' + esc(S.q) + '" style="flex:1"><button class="p" id="ad-s">Знайти</button></div><div id="ad-l"></div></div>';
            var find = function () { S.q = $('#ad-q').value.trim(); if (S.q) socket.emit('admFind', { q: S.q }); };
            $('#ad-s').onclick = find; $('#ad-q').addEventListener('keydown', function (e) { if (e.key === 'Enter') find(); });
            users();
        } else if (S.tab === 'event') {
            b.innerHTML = '<div class="card"><h3>Запустити подію</h3><div class="row"><input id="ev-t" placeholder="Назва (напр. Вихідні подвійних кредитів)" maxlength="60" style="flex:1"></div>' +
                '<div class="row"><label>Кредити ×<select id="ev-c">' + [1, 1.5, 2, 2.5, 3].map(function (v) { return '<option' + (v === 2 ? ' selected' : '') + '>' + v + '</option>'; }).join('') + '</select></label>' +
                '<label>XP ×<select id="ev-x">' + [1, 1.5, 2, 3].map(function (v) { return '<option>' + v + '</option>'; }).join('') + '</select></label>' +
                '<label>Режим <select id="ev-m"><option value="">Усі режими</option>' + S.modes.map(function (m) { return '<option value="' + m.k + '">' + esc(m.n) + '</option>'; }).join('') + '</select></label>' +
                '<label>Тривалість <select id="ev-h">' + [[1, '1 год'], [3, '3 год'], [6, '6 год'], [12, '12 год'], [24, '1 доба'], [48, '2 доби'], [72, '3 доби'], [168, 'тиждень']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === 24 ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
                '<div class="row"><button class="g" id="ev-go">🚀 Запустити</button><button class="d" id="ev-st">Зупинити поточну</button></div><p style="color:#94a3b8;font-size:12px">Бонус додається після кожного бою поверх звичайної нагороди. Гравці бачать банер у головному меню.</p></div>';
            $('#ev-go').onclick = function () { socket.emit('admEvent', { title: $('#ev-t').value, cr: +$('#ev-c').value, xp: +$('#ev-x').value, mode: $('#ev-m').value, hours: +$('#ev-h').value }); };
            $('#ev-st').onclick = function () { if (confirm('Зупинити подію?')) socket.emit('admEventStop'); };
        } else if (S.tab === 'ann') {
            b.innerHTML = '<div class="card"><h3>Оголошення всім гравцям онлайн</h3><textarea id="an-t" maxlength="200" placeholder="Текст (до 200 символів)"></textarea><div class="row" style="margin-top:8px"><button class="p" id="an-go">📢 Надіслати</button></div></div>';
            $('#an-go').onclick = function () { var t = $('#an-t').value.trim(); if (t && confirm('Надіслати оголошення всім гравцям?')) socket.emit('admAnnounce', { text: t }); };
        } else if (S.tab === 'log') {
            b.innerHTML = '<div class="card"><h3>Журнал дій</h3><table><tr><th>Час</th><th>Хто</th><th>Дія</th><th>Ціль</th><th>Деталі</th></tr>' + S.log.map(function (e) { return '<tr><td>' + fmtT(e.t) + '</td><td>' + esc(e.by) + '</td><td>' + esc(e.act) + '</td><td>' + esc(e.target) + '</td><td style="max-width:320px;word-break:break-word">' + esc(e.detail ? JSON.stringify(e.detail) : '') + '</td></tr>'; }).join('') + '</table></div>';
        }
    }
    function users() {
        var l = $('#ad-l'); if (!l) return;
        if (!S.list.length) { l.innerHTML = S.q ? '<p style="color:#94a3b8">Нікого не знайдено</p>' : ''; return; }
        l.innerHTML = S.list.map(function (u, i) {
            return '<div class="u"><div><span class="n">' + esc(u.login) + '</span> · ' + esc(u.nick || '—') + ' · ID ' + (u.pid || '—') + (u.admin ? ' · 🛡 адмін' : '') + ' · ' + (u.online ? '<span class="ok">● онлайн</span>' : 'не в мережі' + (u.last ? ' (' + fmtT(u.last) + ')' : '')) + '</div>' +
                '<div>Рівень ' + u.lvl + ' · ' + u.bucks + ' кредитів · ' + u.matches + ' боїв · ' + u.rp + ' ОР</div>' + (u.ban ? '<div class="ban">⛔ ' + esc(u.ban) + '</div>' : '') +
                '<div class="row"><input data-i="' + i + '" class="r" placeholder="Причина бану" maxlength="120" style="flex:1;min-width:140px"><select class="m"><option value="60">1 год</option><option value="1440">1 доба</option><option value="10080">7 днів</option><option value="43200">30 днів</option><option value="0">Назавжди</option></select>' +
                (u.ban ? '<button class="g" data-a="unban" data-i="' + i + '">Розбанити</button>' : '<button class="d" data-a="ban" data-i="' + i + '"' + (u.admin ? ' disabled' : '') + '>Забанити</button>') + '<button data-a="kick" data-i="' + i + '"' + (u.admin ? ' disabled' : '') + '>Вигнати</button></div>' +
                '<div class="row"><input class="cr" type="number" min="0" max="100000" placeholder="Кредити" style="width:120px"><select class="cs"><option value="">— без кейса —</option>' + S.cases.map(function (c) { return '<option value="' + c.id + '">' + esc(c.n) + ' (' + c.p + ')</option>'; }).join('') + '</select><button class="p" data-a="give" data-i="' + i + '">Видати</button></div></div>';
        }).join('');
        l.querySelectorAll('button[data-a]').forEach(function (bt) {
            bt.onclick = function () {
                var u = S.list[+bt.dataset.i], box = bt.closest('.u'); if (!u) return;
                if (bt.dataset.a === 'ban') { if (confirm('Заблокувати ' + u.login + '?')) socket.emit('admBan', { login: u.login, mins: +box.querySelector('.m').value, reason: box.querySelector('.r').value }); }
                else if (bt.dataset.a === 'unban') socket.emit('admUnban', { login: u.login });
                else if (bt.dataset.a === 'kick') { if (confirm('Відключити ' + u.login + ' від гри?')) socket.emit('admKick', { login: u.login }); }
                else if (bt.dataset.a === 'give') { var cr = +box.querySelector('.cr').value || 0, cs = box.querySelector('.cs').value; if ((cr || cs) && confirm('Видати ' + u.login + ': ' + (cr ? cr + ' кредитів ' : '') + (cs ? '+ кейс' : '') + '?')) socket.emit('admGive', { login: u.login, cr: cr, caseId: cs ? +cs : null }); }
            };
        });
    }
    function refresh() { if (!S.authed) return; if (S.tab === 'dash') socket.emit('admStats'); if (S.tab === 'log') socket.emit('admLog'); clearInterval(iv); if (S.tab === 'dash') iv = setInterval(function () { if (root.classList.contains('on')) socket.emit('admStats'); }, 5000); }
    socket.on('admAuth', function (d) {
        if (!d) return; if (!d.ok) { var m = $('#ad-m'); if (m) { m.textContent = d.msg || 'Доступ заборонено'; m.className = 'msg bad'; } var g = $('#ad-go'); if (g) g.disabled = false; return; }
        S.authed = true; S.stats = d.stats; S.cases = d.cases || []; S.modes = d.modes || []; render(); refresh();
    });
    socket.on('admStats', function (d) { S.stats = d; if (S.tab === 'dash') body(); });
    socket.on('admFind', function (d) { S.list = (d && d.list) || []; users(); });
    socket.on('admLog', function (d) { S.log = d || []; if (S.tab === 'log') body(); });
    socket.on('admOk', function (d) { toast(d.msg || 'Готово'); if (d.list) { S.list = d.list; users(); } if (d.stats) { S.stats = d.stats; body(); } });
    socket.on('admErr', function (d) { toast((d && d.msg) || 'Помилка', true); if (d && d.relog) { S.authed = false; render(); } });
    window.AdminUI = { open: open, close: close };
    open();
})();
