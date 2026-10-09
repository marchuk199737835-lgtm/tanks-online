/* referral.js — вікно «Запроси друга»: посилання (копіювати / поділитися), як це працює, нагороди за друзів, список запрошених.
 * Підвантажується ліниво (lazy.js), картка в меню «ЗАПРОСИ ДРУГА». Сервер — referral.js у корені (refInfo / refClaim / refNotify). */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var css = '#rf-ov{position:fixed;inset:0;z-index:74;display:none;align-items:center;justify-content:center;padding:max(10px,env(safe-area-inset-top)) 10px max(10px,env(safe-area-inset-bottom));background:rgba(2,6,23,.84)}#rf-ov.on{display:flex}' +
        '.rf-box{position:relative;width:min(640px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:22px;overflow:hidden;color:#e2e8f0;background:linear-gradient(165deg,#13204d,#0a1028 60%,#060a1c);border:1px solid rgba(52,211,153,.4);box-shadow:0 0 40px rgba(16,185,129,.2),0 20px 60px rgba(0,0,0,.6)}' +
        '.rf-hd{padding:18px 56px 14px 18px;background:radial-gradient(120% 140% at 0 0,rgba(16,185,129,.32),transparent 60%)}.rf-hd h2{margin:0;font:400 clamp(18px,3vw,24px)/1.1 "Russo One",Arial;letter-spacing:.08em;color:#fff}.rf-hd p{margin:6px 0 0;font-size:12.5px;color:#a7f3d0}' +
        '.rf-x{position:absolute;top:10px;right:10px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.7);color:#e2e8f0;font-size:16px;cursor:pointer}' +
        '.rf-bd{padding:4px 16px 16px;overflow-y:auto;-webkit-overflow-scrolling:touch;display:flex;flex-direction:column;gap:12px}' +
        '.rf-link{display:flex;gap:8px;align-items:stretch}.rf-link input{flex:1;min-width:0;padding:12px;border-radius:12px;border:1px solid rgba(52,211,153,.45);background:rgba(2,6,23,.7);color:#fff;font:700 13px/1 monospace}' +
        '.rf-b{padding:0 14px;border-radius:12px;border:0;background:linear-gradient(90deg,#10b981,#0ea5e9);color:#fff;font:400 13px/1 "Russo One",Arial;letter-spacing:.04em;cursor:pointer;white-space:nowrap;min-height:44px}.rf-b.alt{background:rgba(30,41,59,.9);border:1px solid rgba(148,163,184,.35)}.rf-b:disabled{opacity:.45;cursor:not-allowed}' +
        '.rf-code{font-size:12px;color:#94a3b8}.rf-code b{color:#fff;font-family:monospace;font-size:14px}' +
        '.rf-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rf-st{padding:10px;border-radius:14px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.15);text-align:center;font-size:12px;line-height:1.35}.rf-st i{display:block;font-style:normal;font-size:24px;margin-bottom:4px}.rf-st b{color:#fff}' +
        '.rf-h{font:400 12px/1 "Russo One",Arial;letter-spacing:.12em;color:#6ee7b7;text-transform:uppercase;margin-top:4px}' +
        '.rf-rw{display:flex;flex-wrap:wrap;gap:6px}.rf-rw>span{padding:7px 10px;border-radius:11px;background:rgba(16,185,129,.12);border:1px solid rgba(52,211,153,.3);font-size:12px}.rf-rw b{color:#fff}' +
        '.rf-tier{display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:13px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.15)}.rf-tier.ready{border-color:#fbbf24;background:rgba(245,158,11,.14)}.rf-tier.got{opacity:.55}' +
        '.rf-tier .n{flex:0 0 46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font:400 18px/1 "Russo One",Arial;background:rgba(16,185,129,.18);color:#6ee7b7}.rf-tier>div{flex:1;min-width:0;font-size:12.5px}.rf-tier small{display:block;color:#94a3b8}' +
        '.rf-bar{height:6px;border-radius:4px;background:rgba(2,6,23,.8);overflow:hidden;margin-top:4px}.rf-bar i{display:block;height:100%;background:linear-gradient(90deg,#10b981,#fbbf24)}' +
        '.rf-fr{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:12px;background:rgba(2,6,23,.45);border:1px solid rgba(148,163,184,.12);font-size:12.5px;flex-wrap:wrap}.rf-fr .nm{flex:1;min-width:120px;color:#fff;font-weight:700}.rf-fr .nm small{display:block;color:#94a3b8;font-weight:600}' +
        '.rf-dots{display:flex;gap:4px}.rf-dots i{font-style:normal;font-size:10.5px;padding:3px 6px;border-radius:7px;background:rgba(51,65,85,.6);color:#94a3b8}.rf-dots i.ok{background:rgba(16,185,129,.3);color:#a7f3d0}.rf-dots i.c{background:#f59e0b;color:#fff}' +
        '.rf-me{padding:12px;border-radius:14px;background:linear-gradient(100deg,rgba(124,58,237,.3),rgba(16,185,129,.2));border:1px solid rgba(167,139,250,.5);font-size:13px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.rf-me>div{flex:1;min-width:160px}' +
        '.rf-empty{padding:14px;text-align:center;color:#64748b;font-size:13px}' +
        '@media (max-width:480px){.rf-steps{grid-template-columns:1fr}.rf-link{flex-wrap:wrap}.rf-link input{flex-basis:100%}.rf-link .rf-b{flex:1}}';
    var se = document.createElement('style'); se.id = 'rf-css'; se.textContent = css; document.head.appendChild(se);

    var ov = null, data = null;
    function linkOf(code) { return location.origin + '/?ref=' + code; }
    function build() {
        ov = document.createElement('div'); ov.id = 'rf-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = '<div class="rf-box"><button type="button" class="rf-x" aria-label="Закрити">✕</button><div class="rf-hd"><h2>🤝 <span>ЗАПРОСИ ДРУГА</span></h2><p>Грайте разом і отримуйте креди та кейси за кожного друга</p></div><div class="rf-bd" id="rf-bd"></div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) {
            if (e.target === ov || e.target.closest('.rf-x')) { snd('ui_click'); return close(); }
            var b = e.target.closest('button[data-a]'); if (!b) return;
            var a = b.dataset.a;
            if (a === 'copy') { copy(); return; }
            if (a === 'share') { share(); return; }
            snd('ui_buy'); b.disabled = true;
            if (a === 'f') socket.emit('refClaim', { k: 'f', i: +b.dataset.i, lv: +b.dataset.lv });
            else if (a === 't') socket.emit('refClaim', { k: 't', n: +b.dataset.n });
            else if (a === 'me') socket.emit('refClaim', { k: 'me' });
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && ov.classList.contains('on') && !(window.uiDialog && uiDialog.isOpen())) close(); });
    }
    function copy() {
        if (!data || !data.code) return; var t = linkOf(data.code), inp = $('rf-inp');
        var done = function () { snd('ui_buy'); if (window.uiToast) uiToast('Посилання скопійовано!'); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { if (inp) { inp.select(); try { document.execCommand('copy'); done(); } catch (e) {} } });
        else if (inp) { inp.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    }
    function share() {
        if (!data || !data.code) return; var t = linkOf(data.code);
        if (navigator.share) navigator.share({ title: 'PULS-PROJECT', text: 'Приєднуйся до танкових боїв! За реєстрацію за моїм посиланням — +100 кредитів', url: t }).catch(function () {});
        else copy();
    }
    function open() { if (!ov) build(); ov.classList.add('on'); render(); socket.emit('refInfo'); }
    function close() { if (ov) ov.classList.remove('on'); }
    function render() {
        var bd = $('rf-bd'); if (!bd) return; var D = data;
        if (!D) { bd.innerHTML = '<div class="rf-empty">Завантаження…</div>'; return; }
        var h = '';
        if (D.me) h += '<div class="rf-me"><span style="font-size:26px">🎁</span><div><span>Вас запросив</span> <b>' + esc(D.me.by) + '</b>.<br><span>Подарунок на</span> ' + D.newbieLv + ' <span>рівні</span>: <span>кейс</span> «' + esc(D.newbieCase) + '»</div>' +
            (D.me.got ? '<span>✓ <span>Отримано</span></span>' : '<button type="button" class="rf-b" data-a="me"' + (D.me.ready ? '' : ' disabled') + '>' + (D.me.ready ? 'Забрати' : 'Рівень ' + D.me.lvl + '/' + D.newbieLv) + '</button>') + '</div>';
        h += '<div class="rf-h">Ваше посилання</div>' + (D.code ? '<div class="rf-link"><input id="rf-inp" readonly value="' + esc(linkOf(D.code)) + '"><button type="button" class="rf-b" data-a="copy">Копіювати</button>' + (navigator.share ? '<button type="button" class="rf-b alt" data-a="share">Поділитися</button>' : '') + '</div><div class="rf-code"><span>Ваш ID</span>: <b>' + D.code + '</b></div>' : '<div class="rf-empty">Посилання ще генерується…</div>');
        h += '<div class="rf-steps"><div class="rf-st"><i>🔗</i><span>Надішліть посилання другові</span></div><div class="rf-st"><i>🎮</i><span>Друг реєструється й отримує</span> <b>+' + D.welcome + '</b> <span>кредитів і кейс на</span> ' + D.newbieLv + ' <span>рівні</span></div><div class="rf-st"><i>🏆</i><span>Ви отримуєте нагороди, коли друг росте в рівнях</span></div></div>';
        h += '<div class="rf-h">За кожного друга</div><div class="rf-rw">' + D.steps.map(function (s) { return '<span><span>Рівень</span> <b>' + s.lv + '</b> → ' + (s.cr ? creditAmount(s.cr, 12) : '') + (s.cr && s.caseName ? ' + ' : '') + (s.caseName ? '📦 ' + esc(s.caseName) : '') + '</span>'; }).join('') + '</div>';
        h += '<div class="rf-h">Бонуси за активних друзів (5+ рівень)</div>' + D.tiers.map(function (t) {
            var pr = Math.min(1, D.active / t.n);
            return '<div class="rf-tier' + (t.got ? ' got' : t.ready ? ' ready' : '') + '"><span class="n">' + t.n + '</span><div><b>' + (t.cr ? creditAmount(t.cr, 12) : '') + (t.caseName ? ' 📦 ' + esc(t.caseName) : '') + '</b><small>' + Math.min(D.active, t.n) + ' / ' + t.n + ' <span>друзів</span></small><div class="rf-bar"><i style="width:' + Math.round(pr * 100) + '%"></i></div></div>' +
                (t.got ? '<span>✓</span>' : '<button type="button" class="rf-b" data-a="t" data-n="' + t.n + '"' + (t.ready ? '' : ' disabled') + '>Забрати</button>') + '</div>';
        }).join('');
        h += '<div class="rf-h"><span>Запрошені друзі</span> (' + D.total + ')</div>';
        if (!D.list.length) h += '<div class="rf-empty">Поки що нікого. Надішліть посилання — і грайте разом!</div>';
        else h += D.list.map(function (f) {
            var dots = D.steps.map(function (s) { var c = f.claimable.indexOf(s.lv) >= 0, ok = f.got.indexOf(s.lv) >= 0; return '<i class="' + (ok ? 'ok' : c ? 'c' : '') + '">' + s.lv + '</i>'; }).join('');
            var btn = f.claimable.length ? '<button type="button" class="rf-b" data-a="f" data-i="' + f.i + '" data-lv="' + f.claimable[0] + '">Забрати</button>' : '';
            return '<div class="rf-fr"><div class="nm">' + esc(f.nick) + '<small><span>Рівень</span> ' + f.lvl + (f.sus ? ' · <span>без нагород (той самий пристрій)</span>' : '') + '</small></div><div class="rf-dots">' + dots + '</div>' + btn + '</div>';
        }).join('');
        bd.innerHTML = h;
    }
    socket.on('refInfo', function (d) { data = d; if (ov && ov.classList.contains('on')) render(); badge(); });
    socket.on('refError', function (d) { if (window.uiDialog) uiDialog.show({ kind: 'error', icon: '🤝', title: 'Запроси друга', text: d && d.msg || '' }); if (ov && ov.classList.contains('on')) render(); });
    socket.on('refNotify', function (d) {
        if (!d || !window.uiToast) return;
        if (d.kind === 'joined') uiToast('🤝 ' + d.nick + ' приєднався за вашим запрошенням!');
        else if (d.kind === 'welcome') { if (window.uiDialog) uiDialog.show({ kind: 'success', icon: '🎁', title: 'Подарунок від друга', text: d.by + ' запросив вас у гру. Нараховано +' + d.cr + ' кредитів! На 3 рівні вас чекає кейс у вікні «Запроси друга».' }); }
        else if (d.kind === 'step') { uiToast('🏆 ' + d.nick + ' досяг ' + d.lv + ' рівня — заберіть нагороду в «Запроси друга»'); socket.emit('refInfo'); }
        else if (d.kind === 'gift') { uiToast('🎁 Подарунок від друга чекає у вікні «Запроси друга»!'); socket.emit('refInfo'); }
        else if (d.kind === 'claimed') uiToast(d.msg);
    });
    function badge() {
        if (!window.MenuHub || !data) return; var n = 0;
        data.list.forEach(function (f) { n += f.claimable.length; }); data.tiers.forEach(function (t) { if (t.ready && !t.got) n++; }); if (data.me && data.me.ready && !data.me.got) n++;
        MenuHub.badge('mm-referral', n);
    }
    window.Referral = { open: open, close: close };
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-referral', icon: '🤝', title: 'ЗАПРОСИ ДРУГА', sub: 'Креди та кейси за друзів', color: 'teal', bg: '🎁', onClick: open });
    try { socket.emit('refInfo'); } catch (e) {}
})();
