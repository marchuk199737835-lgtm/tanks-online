/* extras.js — дрібні «живі» функції гри (клієнт):
 *  • Емоції в бою: ПК — Q відкриває меню, 1–6 обирає (Q/Esc — закрити); телефон — кнопка 💬 над правим джойстиком. Над танком — «бульбашка» 2.6 с.
 *    Сервер пересилає лише номер емоції; текст перекладається мовою кожного гравця. Вимкнути чужі емоції — у налаштуваннях.
 *  • Кілкам (лише у звичайних сесіях, НЕ в рейтингу): хто вас знищив, чим, скільки в нього лишилось броні; камера стежить за ним, навколо — мітка.
 *  • Push-сповіщення: перемикач у налаштуваннях + одноразова пропозиція; «Ми скучили!» (нагорода за повернення); подія від адміністрації; оголошення.
 *  • #admin в адресі — підвантажує адмін-панель (js/admin.js); сама перевірка доступу — на сервері. */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var tt = function (s) { return window.I18N && I18N.t ? I18N.t(s) : s; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var inGame = function () { var g = $('game-screen'); return !!g && !g.classList.contains('hidden') && typeof currentRoomData !== 'undefined' && currentRoomData && currentRoomData.status === 'playing'; };
    var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };

    var css = '' +
        // ---- меню емоцій ----
        '#emo-menu{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 96px);transform:translateX(-50%) translateY(10px) scale(.96);z-index:60;display:flex;gap:6px;padding:8px;border-radius:18px;background:rgba(8,12,32,.86);border:1px solid rgba(129,140,248,.45);box-shadow:0 10px 30px rgba(0,0,0,.5);opacity:0;pointer-events:none;transition:opacity .14s,transform .14s}' +
        '#emo-menu.on{opacity:1;pointer-events:auto;transform:translateX(-50%) translateY(0) scale(1)}' +
        '#emo-menu button{position:relative;min-width:58px;height:52px;padding:0 10px;border-radius:13px;border:1px solid rgba(148,163,184,.25);background:linear-gradient(160deg,rgba(51,65,120,.7),rgba(15,23,42,.9));color:#fff;font:700 15px/1 "Russo One",Arial,sans-serif;cursor:pointer;white-space:nowrap;transition:transform .1s,border-color .1s}' +
        '#emo-menu button:hover,#emo-menu button:focus-visible{border-color:#a78bfa;transform:translateY(-2px)}#emo-menu button kbd{position:absolute;top:3px;left:5px;font:700 9px/1 Jura,Arial;color:#a5b4fc}' +
        '#emo-menu.cd button{opacity:.45;pointer-events:none}' +
        '#emo-btn{position:fixed;right:calc(env(safe-area-inset-right,0px) + 22px);bottom:calc(env(safe-area-inset-bottom,0px) + 46%);z-index:35;width:46px;height:46px;border-radius:50%;border:1px solid rgba(165,180,252,.6);background:rgba(30,27,75,.75);color:#fff;font-size:20px;display:none;align-items:center;justify-content:center}' +
        'html.ctl-touch #game-screen:not(.hidden) ~ #emo-btn.show,#emo-btn.show{display:flex}' +
        '@media (max-width:640px){#emo-menu{flex-wrap:wrap;justify-content:center;width:min(330px,calc(100vw - 20px));bottom:calc(env(safe-area-inset-bottom,0px) + 44%)}#emo-menu button{min-width:94px}}' +
        // ---- кілкам ----
        '#kc{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 70px);transform:translateX(-50%);z-index:44;min-width:260px;max-width:min(420px,calc(100vw - 20px));padding:12px 16px 12px;border-radius:16px;background:linear-gradient(160deg,rgba(69,10,10,.92),rgba(15,6,20,.92));border:1px solid rgba(248,113,113,.6);box-shadow:0 0 30px rgba(239,68,68,.35);color:#fee2e2;text-align:center;pointer-events:none;opacity:0;transition:opacity .2s}' +
        '#kc.on{opacity:1;animation:kcIn .35s cubic-bezier(.2,1.3,.4,1)}@keyframes kcIn{from{transform:translateX(-50%) scale(1.25)}to{transform:translateX(-50%) scale(1)}}html.gfx-low #kc.on{animation:none}' +
        '#kc small{display:block;font:700 10px/1 Jura,Arial;letter-spacing:.25em;color:#fca5a5}#kc b{display:block;margin:5px 0 4px;font:400 20px/1.1 "Russo One",Arial;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '#kc .w{font-size:12.5px;color:#fecaca}#kc .hp{margin:7px auto 0;width:180px;height:7px;border-radius:5px;background:rgba(0,0,0,.5);overflow:hidden}#kc .hp i{display:block;height:100%;background:linear-gradient(90deg,#ef4444,#f59e0b)}#kc .rs{margin-top:6px;font-size:11px;color:#fca5a5}' +
        // ---- пропозиція сповіщень, подія, оголошення ----
        '#push-ask{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 14px);transform:translateX(-50%);z-index:58;display:flex;align-items:center;gap:10px;width:min(460px,calc(100vw - 20px));padding:10px 12px;border-radius:16px;background:linear-gradient(100deg,rgba(30,41,95,.96),rgba(76,29,149,.94));border:1px solid rgba(167,139,250,.55);color:#e0e7ff;font-size:12.5px;box-shadow:0 12px 30px rgba(0,0,0,.5)}' +
        '#push-ask i{font-style:normal;font-size:24px}#push-ask div{flex:1}#push-ask button{padding:8px 12px;border-radius:11px;border:0;font:400 12px/1 "Russo One",Arial;cursor:pointer}#push-ask .y{background:linear-gradient(90deg,#8b5cf6,#ec4899);color:#fff}#push-ask .n{background:transparent;color:#a5b4fc}' +
        '#ev-bar{margin:6px auto 0;display:none;align-items:center;gap:8px;width:max-content;max-width:calc(100vw - 24px);padding:6px 14px;border-radius:999px;background:linear-gradient(90deg,rgba(234,88,12,.85),rgba(219,39,119,.85));border:1px solid rgba(253,186,116,.7);color:#fff;font:700 12px/1.2 Jura,Arial;box-shadow:0 0 18px rgba(234,88,12,.45);position:relative;z-index:5}#ev-bar.on{display:flex}#ev-bar b{font-family:"Russo One",Arial;letter-spacing:.04em}' +
        '#ann{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 12px);transform:translateX(-50%) translateY(-120%);z-index:9800;width:min(560px,calc(100vw - 20px));padding:12px 16px;border-radius:14px;background:linear-gradient(100deg,#1e3a8a,#6d28d9);border:1px solid rgba(191,219,254,.6);color:#fff;font-size:13.5px;box-shadow:0 14px 34px rgba(0,0,0,.55);transition:transform .35s cubic-bezier(.2,1.2,.4,1)}#ann.on{transform:translateX(-50%) translateY(0)}#ann b{display:block;font:400 11px/1 "Russo One",Arial;letter-spacing:.18em;color:#bfdbfe;margin-bottom:5px}';
    var se = document.createElement('style'); se.id = 'extras-css'; se.textContent = css; document.head.appendChild(se);

    // ================= ЕМОЦІЇ =================
    var EMO = ['GG', '😂', 'Дякую!', 'Допоможіть!', '👍', '😡'];
    var bubbles = {}, menu = null, lastSent = 0, menuT = null, CD = 1800;
    function emoOff() { return lsGet('emoOff') === '1'; }
    function buildMenu() {
        menu = document.createElement('div'); menu.id = 'emo-menu'; menu.setAttribute('role', 'menu');
        menu.innerHTML = EMO.map(function (e, i) { return '<button type="button" data-e="' + i + '"><kbd>' + (i + 1) + '</kbd>' + esc(e) + '</button>'; }).join('');
        document.body.appendChild(menu);
        menu.addEventListener('pointerdown', function (ev) { var b = ev.target.closest('button'); if (!b) return; ev.preventDefault(); ev.stopPropagation(); sendEmo(+b.dataset.e); });
    }
    function openMenu() { if (!inGame() || myLocalTank.hp <= 0) return; if (!menu) buildMenu(); menu.classList.add('on'); menu.classList.toggle('cd', Date.now() - lastSent < CD); clearTimeout(menuT); menuT = setTimeout(closeMenu, 4000); }
    function closeMenu() { if (menu) menu.classList.remove('on'); clearTimeout(menuT); }
    function menuOpen() { return !!menu && menu.classList.contains('on'); }
    function sendEmo(i) {
        var now = Date.now(); closeMenu(); if (now - lastSent < CD || !inGame()) return;
        lastSent = now; socket.emit('emote', i); snd('ui_click');
        bubbles[myId] = { e: i, t: now };                               // своя — одразу, без чекання сервера
    }
    window.addEventListener('keydown', function (e) {
        var tg = e.target, typing = tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable);
        if (typing || !inGame()) return;
        var k = (e.key || '').toLowerCase();
        if (k === 'q' || k === 'й') { e.preventDefault(); menuOpen() ? closeMenu() : openMenu(); return; }
        if (menuOpen()) {
            if (/^[1-6]$/.test(e.key)) { e.preventDefault(); sendEmo(+e.key - 1); }
            else if (k === 'escape') { e.preventDefault(); closeMenu(); }
        }
    }, true);
    // кнопка для дотику
    var ebtn = document.createElement('button'); ebtn.id = 'emo-btn'; ebtn.type = 'button'; ebtn.setAttribute('aria-label', 'Емоції'); ebtn.textContent = '💬'; document.body.appendChild(ebtn);
    ebtn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); menuOpen() ? closeMenu() : openMenu(); });
    setInterval(function () { var show = inGame() && document.documentElement.classList.contains('ctl-touch') && myLocalTank.hp > 0; ebtn.classList.toggle('show', show); if (!inGame()) closeMenu(); }, 500);
    socket.on('emo', function (d) { if (!Array.isArray(d)) return; var id = d[0], e = d[1] | 0; if (e < 0 || e >= EMO.length) return; if (id !== myId && emoOff()) return; bubbles[id] = { e: e, t: Date.now() }; });
    socket.on('gameStarting', function () { bubbles = {}; kcHide(); });

    // малювання над танками (викликає game.js у світових координатах): «бульбашка» з появою й згасанням
    function pos(id) { if (id === myId) return myLocalTank.hp > 0 ? myLocalTank : null; var o = typeof opponents !== 'undefined' ? opponents[id] : null; return o && o.hp > 0 && !o.isDisguised ? o : null; }
    function bubble(ctx, x, y, txt, k) {
        var a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1, sc = k < 0.12 ? 0.6 + 0.4 * (k / 0.12) + 0.12 * Math.sin(k / 0.12 * Math.PI) : 1;
        ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, y - 64 - (1 - sc) * 10); ctx.scale(sc, sc);
        ctx.font = '700 17px "Russo One", Arial'; var w = Math.max(40, ctx.measureText(txt).width + 22), h = 30;
        ctx.fillStyle = 'rgba(10,14,38,.9)'; ctx.strokeStyle = 'rgba(167,139,250,.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 12); else ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, h / 2 - 1); ctx.lineTo(0, h / 2 + 7); ctx.lineTo(6, h / 2 - 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 1); ctx.restore();
    }
    window.EmoteFX = {
        draw: function (ctx, now) {
            for (var id in bubbles) {
                var b = bubbles[id], k = (now - b.t) / 2600; if (k >= 1) { delete bubbles[id]; continue; }
                var p = pos(id); if (!p) continue; bubble(ctx, p.x, p.y, tt(EMO[b.e]), k);
            }
            if (kc && kc.on && kc.killer) { var o = pos(kc.killer); if (o) { var t = now / 200; ctx.save(); ctx.strokeStyle = 'rgba(239,68,68,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -now / 30; ctx.beginPath(); ctx.arc(o.x, o.y, 44 + 3 * Math.sin(t), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); } }
        }
    };

    // ================= КІЛКАМ (звичайні сесії) =================
    var WN = { normal: 'Гармата', explosive: 'Вибуховий снаряд', fast: 'Кулемет', minigun: 'Мінігун', piercing: 'Бронебійний снаряд', homing: 'Самонавідна ракета', shotgun: 'Дробовик', incendiary: 'Запальний снаряд', samurai: 'Клинок самурая', melee: 'Таран', mine: 'Міна', laser: 'Автолазер', hunter_gun: 'Рушниця мисливця', acid: 'Кислота', boss_proj: 'Снаряд боса' };
    var WI = { normal: '💥', explosive: '🧨', fast: '🔫', minigun: '🔫', piercing: '🗡️', homing: '🚀', shotgun: '💢', incendiary: '🔥', samurai: '⚔️', melee: '💥', mine: '💣', laser: '⚡', hunter_gun: '🎯' };
    var kc = { on: false }, kcEl = null, kcT = null, kcIv = null;
    function kcHide() { kc.on = false; clearTimeout(kcT); clearInterval(kcIv); if (kcEl) kcEl.classList.remove('on'); }
    socket.on('playerDied', function (d) {
        if (!d || d.id !== myId || !d.killer || d.killer === myId || d.killer === 'zombie') return;
        var r = typeof currentRoomData !== 'undefined' ? currentRoomData : null; if (!r || r.rk) return;      // у рейтингу кілкаму немає
        var kp = r.players && r.players[d.killer]; if (!kp) return;
        if (!kcEl) { kcEl = document.createElement('div'); kcEl.id = 'kc'; kcEl.setAttribute('aria-live', 'polite'); var gs = $('game-screen'); (gs || document.body).appendChild(kcEl); }
        var w = d.w || 'normal', resp = { deathmatch: 3, team_deathmatch: 3, bounty: 3, capture_points: 4 }[r.mode];
        kcEl.innerHTML = '<small>ВАС ЗНИЩИВ</small><b>' + esc(window.dispName ? dispName(kp) : (kp.nick || kp.name)) + '</b><div class="w">' + (WI[w] || '💥') + ' <span>' + esc(tt(WN[w] || 'Гармата')) + '</span></div><div class="hp"><i style="width:100%"></i></div>' + (resp ? '<div class="rs"><span>Відродження через</span> <span class="n">' + resp + '</span> <span>с</span></div>' : '');
        kc = { on: true, killer: d.killer, t0: Date.now() }; kcEl.classList.remove('on'); void kcEl.offsetWidth; kcEl.classList.add('on');
        var maxHp = function (p) { return Math.round((typeof MAX_HP !== 'undefined' ? MAX_HP : 500) * (window.GameData ? GameData.statMult(p.equipped, 'hp') : 1)); };
        clearInterval(kcIv); kcIv = setInterval(function () {
            var o = typeof opponents !== 'undefined' ? opponents[d.killer] : null, i = kcEl.querySelector('.hp i'), n = kcEl.querySelector('.rs .n');
            if (o && i) i.style.width = Math.max(0, Math.min(100, o.hp / maxHp(kp) * 100)) + '%';
            if (n && resp) n.textContent = Math.max(0, Math.ceil(resp - (Date.now() - kc.t0) / 1000));
        }, 200);
        clearTimeout(kcT); kcT = setTimeout(kcHide, (resp || 3) * 1000 + 300);
    });
    socket.on('playerRespawn', function (d) { if (d && d.id === myId) kcHide(); });
    socket.on('gameOver', kcHide);

    // ================= PUSH-СПОВІЩЕННЯ =================
    var pushOk = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window, vapidKey = null;
    function b64(s) { var p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
    function getKey() { return new Promise(function (res) { if (vapidKey) return res(vapidKey); var done = false; socket.once('pushKey', function (d) { done = true; vapidKey = d && d.key; res(vapidKey); }); socket.emit('pushKey'); setTimeout(function () { if (!done) res(null); }, 4000); }); }
    function subscribe() {
        if (!pushOk) return Promise.resolve('unsupported');
        return Notification.requestPermission().then(function (perm) {
            if (perm !== 'granted') return perm;
            return getKey().then(function (key) {
                if (!key) return 'nokey';
                return navigator.serviceWorker.ready.then(function (reg) {
                    return reg.pushManager.getSubscription().then(function (s) { return s || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) }); });
                }).then(function (sub) { socket.emit('pushSub', { sub: sub.toJSON() }); lsSet('pushOn', '1'); return 'ok'; });
            });
        }).catch(function () { return 'error'; });
    }
    function unsubscribe() {
        if (!pushOk) return Promise.resolve();
        return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) { if (s) { socket.emit('pushOff', { e: s.endpoint }); return s.unsubscribe(); } }).catch(function () {}).then(function () { lsSet('pushOn', '0'); });
    }
    // після входу: якщо дозвіл уже є — нагадуємо серверу про підписку (вона могла змінитися)
    socket.on('authSuccess', function () {
        setTimeout(function () {
            if (pushOk && Notification.permission === 'granted' && lsGet('pushOn') !== '0') subscribe();
            var n = (+lsGet('logins') || 0) + 1; lsSet('logins', n);
            if (pushOk && Notification.permission === 'default' && n >= 2 && !lsGet('pushAsked')) setTimeout(askPush, 6000);
        }, 3000);
    });
    function askPush() {
        if ($('push-ask') || inGame()) return; var mm = $('main-menu-screen'); if (!mm || mm.classList.contains('hidden')) return;
        lsSet('pushAsked', '1');
        var a = document.createElement('div'); a.id = 'push-ask';
        a.innerHTML = '<i>🔔</i><div><b>Увімкнути сповіщення?</b><br><span>Нагадаємо про щоденний бонус, повідомлення друзів і кінець сезону. Не частіше разу на день.</span></div><button type="button" class="y">Увімкнути</button><button type="button" class="n">Ні</button>';
        document.body.appendChild(a);
        a.querySelector('.y').onclick = function () { a.remove(); subscribe().then(function (r) { if (window.uiToast) uiToast(r === 'ok' ? '🔔 Сповіщення увімкнено' : 'Сповіщення не увімкнено', r !== 'ok'); paintPushRow(); }); };
        a.querySelector('.n').onclick = function () { a.remove(); };
        setTimeout(function () { if (a.parentNode) a.remove(); }, 20000);
    }
    // рядок у налаштуваннях: сповіщення + показ чужих емоцій
    var row = null;
    function paintPushRow() {
        if (!row) return; var b = row.querySelector('[data-a=push]'), e = row.querySelector('[data-a=emo]');
        var st = !pushOk ? 'off' : Notification.permission === 'denied' ? 'denied' : (Notification.permission === 'granted' && lsGet('pushOn') === '1') ? 'on' : 'off';
        b.textContent = st === 'on' ? '🔔 Увімкнено' : st === 'denied' ? '🚫 Заблоковано в браузері' : '🔕 Вимкнено'; b.classList.toggle('on', st === 'on'); b.disabled = !pushOk || st === 'denied';
        e.textContent = emoOff() ? '🙈 Приховано' : '💬 Показувати'; e.classList.toggle('on', !emoOff());
    }
    function initRow() {
        var anchor = $('ctl-row') || ($('lang-select') && $('lang-select').closest('.mb-4')); if (!anchor || $('xt-row')) return;
        row = document.createElement('div'); row.id = 'xt-row'; row.className = 'mb-4 lg:mb-6 text-left';
        row.innerHTML = '<label class="text-[10px] lg:text-xs font-bold uppercase text-slate-400 block mb-2 tracking-wider">Сповіщення й емоції</label><div class="ctl-seg"><button type="button" data-a="push"></button><button type="button" data-a="emo"></button></div>' +
            '<div class="ctl-hint">Сповіщення — не частіше разу на день. Емоції: Q і цифри 1–6 (на телефоні — кнопка 💬).</div>';
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
        row.addEventListener('click', function (ev) {
            var b = ev.target.closest('button'); if (!b) return; snd('ui_click');
            if (b.dataset.a === 'emo') { lsSet('emoOff', emoOff() ? '0' : '1'); return paintPushRow(); }
            if (lsGet('pushOn') === '1' && Notification.permission === 'granted') unsubscribe().then(paintPushRow);
            else subscribe().then(function (r) { if (r !== 'ok' && window.uiToast) uiToast(r === 'denied' ? 'Сповіщення заблоковано в налаштуваннях браузера' : r === 'unsupported' ? 'Цей браузер не підтримує сповіщення' : 'Не вдалося увімкнути сповіщення', true); paintPushRow(); });
        });
        paintPushRow();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(initRow, 50); }); else setTimeout(initRow, 50);

    // ================= ПОВЕРНЕННЯ, ПОДІЯ, ОГОЛОШЕННЯ =================
    socket.on('welcomeBack', function (d) {
        if (!d || !window.uiDialog) return; snd('ui_buy');
        uiDialog.show({ kind: 'success', icon: '🤗', title: 'Ми скучили!', text: 'Вас не було ' + d.days + ' дн. Тримайте подарунок до повернення: +' + d.cr + ' кредитів!' });
    });
    var evBar = null, evData = null, evIv = null;
    function fmtLeft(ms) { ms = Math.max(0, ms); var h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return h ? h + ':' + String(m).padStart(2, '0') : m + ' хв'; }
    function paintEv() {
        if (!evBar) { var ad = document.querySelector('#main-menu-screen .mm-advent'); if (!ad) return; evBar = document.createElement('div'); evBar.id = 'ev-bar'; ad.insertAdjacentElement('afterend', evBar); }
        if (!evData || evData.until < Date.now()) { evBar.classList.remove('on'); clearInterval(evIv); evIv = null; return; }
        var mn = evData.mode && window.ModeInfo && ModeInfo.MODES[evData.mode] ? ModeInfo.MODES[evData.mode].e + ' ' + ModeInfo.MODES[evData.mode].sn : '';
        evBar.innerHTML = '🔥 <b>' + esc(evData.title) + '</b>' + (evData.cr > 1 ? ' · ×' + evData.cr + ' <span>кредитів</span>' : '') + (evData.xp > 1 ? ' · ×' + evData.xp + ' XP' : '') + (mn ? ' · <span>' + esc(mn) + '</span>' : '') + ' · ⏳ ' + fmtLeft(evData.until - Date.now());
        evBar.classList.add('on');
        if (!evIv) evIv = setInterval(paintEv, 30000);
    }
    socket.on('gameEvent', function (d) { evData = d; paintEv(); if (d && window.uiToast) uiToast('🔥 ' + d.title); });
    socket.on('eventBonus', function (d) { if (d && window.uiToast) uiToast('🔥 ' + d.title + ': ' + (d.cr ? '+' + d.cr + ' ' + tt('кредитів') : '') + (d.xp ? ' +' + d.xp + ' XP' : '')); });
    var annEl = null, annT = null;
    socket.on('announce', function (d) {
        if (!d || !d.text) return; snd('powerup');
        if (!annEl) { annEl = document.createElement('div'); annEl.id = 'ann'; annEl.setAttribute('role', 'status'); document.body.appendChild(annEl); }
        annEl.innerHTML = '<b>📢 ОГОЛОШЕННЯ</b><span></span>'; annEl.querySelector('span').textContent = d.text;
        annEl.classList.remove('on'); void annEl.offsetWidth; annEl.classList.add('on'); clearTimeout(annT); annT = setTimeout(function () { annEl.classList.remove('on'); }, 9000);
    });
    socket.on('admGift', function (d) { if (d && window.uiToast) uiToast('🎁 Подарунок від адміністрації' + (d.cr ? ': +' + d.cr + ' ' + tt('кредитів') : '')); });

    // ================= адмін-панель за адресою #admin =================
    function maybeAdmin() {
        if (location.hash !== '#admin' || window.AdminUI) { if (window.AdminUI && location.hash === '#admin') AdminUI.open(); return; }
        var s = document.createElement('script'); s.src = window.__av ? __av('js/admin.js') : 'js/admin.js'; document.head.appendChild(s);
    }
    socket.on('authSuccess', function () { setTimeout(maybeAdmin, 800); });
    window.addEventListener('hashchange', function () { if (typeof myName !== 'undefined' && myName) maybeAdmin(); });
})();
