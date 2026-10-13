/* stakes.js — «Фортуна» (клієнт): колесо фортуни за квитки та дуелі з друзями.
 * Сервер — stakes.js у корені, правила й числа — js/stakesinfo.js. Підвантажується ліниво (lazy.js), картка в меню — «ФОРТУНА».
 * Квиток на оберт дає щоденне завдання «Квиток дня» (вкладка «Завдання» в прогресі). Колесо — canvas, малюється лише коли його вкладка відкрита. */
(function () {
    'use strict';
    var SI = window.StakesInfo; if (!SI || window.Stakes) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var tt = function (s) { return window.I18N ? I18N.t(String(s)) : String(s); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var usnd = function (n, o) { try { if (window.UISFX && UISFX.play) return UISFX.play(n, o || {}); } catch (e) {} return null; };
    var toast = function (m, bad) { if (window.uiToast) uiToast(tt(m), bad); };
    var crI = function (n, sz) { return (window.creditIcon ? creditIcon(sz || 14) : '💰') + ' <b>' + fmt(n) + '</b>'; };
    var fmt = function (n) { n = Math.floor(+n || 0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
    // MODULES / RARITY / MAP_DATA оголошені в config.js через const — їх немає на window, беремо напряму
    var G = function (n) { try { return n === 'MODULES' ? MODULES : n === 'RARITY' ? RARITY : n === 'MAP_DATA' ? MAP_DATA : null; } catch (e) { return null; } };
    var M = function (id) { var m = G('MODULES'); return m ? m[id] : null; };
    var priceOf = function (id) { var m = M(id); return m ? m.price | 0 : 0; };
    var rc = function (id) { var m = M(id); return m && G('RARITY') && RARITY[m.rarity] ? RARITY[m.rarity].color : '#64748b'; };
    var bucks = function () { try { return typeof myBucks === 'number' ? myBucks : 0; } catch (e) { return 0; } };
    var inv = function () { try { return Array.isArray(myInventory) ? myInventory.slice() : []; } catch (e) { return []; } };
    var ST = { me: null, feed: [], tab: 'wh', skew: 0 };
    try { var lt0 = localStorage.getItem('stkTab'); if (lt0) ST.tab = lt0; } catch (e) {}
    var syncT = function (d) { if (d && d.now) ST.skew = d.now - Date.now(); };

    function item(id, cls) {
        var m = M(id); if (!m) return '';
        return '<div class="sk-it ' + (cls || '') + '" style="--rc:' + rc(id) + '" title="' + esc(m.name) + ' · ' + priceOf(id) + '"><div class="sk-ic">' + (window.modIcon ? modIcon(m) : '') + '</div><span class="sk-pr">' + fmt(m.price) + '</span></div>';
    }

    // ================= СТИЛІ =================
    var css = '' +
        '#stk-ov{position:fixed;inset:0;z-index:72;display:none;flex-direction:column;color:#e2e8f0;font-family:Jura,system-ui,sans-serif;background:radial-gradient(110% 80% at 50% -15%,#4a1033 0%,#160a2e 45%,#04030c 100%);overflow:hidden}' +
        '#stk-ov.on{display:flex}' +
        '#stk-ov:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 15% 85%,rgba(250,204,21,.08),transparent 40%),radial-gradient(circle at 85% 20%,rgba(236,72,153,.1),transparent 45%);pointer-events:none}' +
        '.sk-hd{position:relative;z-index:2;display:flex;align-items:center;gap:8px;padding:max(8px,env(safe-area-inset-top)) max(10px,env(safe-area-inset-right)) 6px max(10px,env(safe-area-inset-left))}' +
        '.sk-back{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:12px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.6);color:#e2e8f0;font:400 12px "Russo One",Arial;letter-spacing:.05em;cursor:pointer}' +
        '.sk-ttl{flex:1;min-width:0}.sk-ttl h2{margin:0;font:400 clamp(15px,2.6vw,24px)/1.1 "Russo One",Arial;letter-spacing:.12em;background:linear-gradient(90deg,#fde68a,#fb7185 55%,#c084fc);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.sk-ttl small{display:block;font-size:10.5px;color:#a8a2c8;letter-spacing:.05em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.sk-bal,.sk-hbtn{flex:none;display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;background:rgba(15,23,42,.7);border:1px solid rgba(251,191,36,.45);font:400 14px "Russo One",Arial;color:#fde68a;white-space:nowrap}' +
        '.sk-hbtn{position:relative;border-color:rgba(148,163,184,.3);color:#e2e8f0;cursor:pointer;font-size:15px;padding:7px 10px}.sk-hbtn i{position:absolute;top:-5px;right:-5px;min-width:17px;height:17px;border-radius:9px;background:#ef4444;color:#fff;font:700 10px/17px Arial;font-style:normal;text-align:center;padding:0 4px}' +
        '.sk-tabs{position:relative;z-index:2;display:flex;gap:6px;overflow-x:auto;padding:2px max(10px,env(safe-area-inset-left)) 8px;scrollbar-width:none;flex:none}.sk-tabs::-webkit-scrollbar{display:none}' +
        '.sk-tab{flex:none;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:13px;border:1px solid rgba(148,163,184,.2);background:rgba(15,23,42,.55);color:#a8a2c8;font:400 12.5px/1 "Russo One",Arial;letter-spacing:.04em;cursor:pointer;white-space:nowrap;transition:background .15s,color .15s,border-color .15s}' +
        '.sk-tab i{font-style:normal;font-size:15px}.sk-tab:hover{color:#fff}.sk-tab.on{color:#fff;border-color:#fb7185;background:linear-gradient(135deg,rgba(225,29,72,.55),rgba(124,58,237,.55));box-shadow:0 0 16px rgba(244,63,94,.35)}' +
        '.sk-body{position:relative;z-index:1;flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:2px max(10px,env(safe-area-inset-right)) 10px max(10px,env(safe-area-inset-left))}' +
        '.sk-ft{position:relative;z-index:2;flex:none;display:flex;align-items:center;gap:8px;padding:7px max(10px,env(safe-area-inset-left)) max(7px,env(safe-area-inset-bottom));background:rgba(2,6,23,.7);border-top:1px solid rgba(148,163,184,.15);font-size:11px;color:#94a3b8}' +
        '.sk-ft p{flex:1;margin:0;line-height:1.35}.sk-ft button{flex:none;padding:6px 10px;border-radius:9px;border:1px solid rgba(148,163,184,.3);background:rgba(30,41,59,.7);color:#e2e8f0;font:700 11px Jura,Arial;cursor:pointer}' +
        '.sk-card{position:relative;border-radius:16px;background:linear-gradient(160deg,rgba(49,20,80,.7),rgba(10,8,30,.88));border:1px solid rgba(244,114,182,.22);box-shadow:0 10px 26px rgba(0,0,0,.35);padding:12px}' +
        '.sk-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}.sk-h h3{margin:0;font:400 15px "Russo One",Arial;letter-spacing:.06em;color:#fff}.sk-h small{color:#a8a2c8;font-size:11px}' +
        '.sk-grid2{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:10px}' +
        '.sk-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 16px;border-radius:13px;border:0;cursor:pointer;font:400 14px/1 "Russo One",Arial;letter-spacing:.06em;color:#fff;background:linear-gradient(100deg,#e11d48,#9333ea);box-shadow:0 6px 18px rgba(225,29,72,.35);transition:filter .15s,transform .1s}' +
        '.sk-btn:hover{filter:brightness(1.12)}.sk-btn:active{transform:scale(.97)}.sk-btn:disabled{filter:grayscale(.85) brightness(.65);cursor:not-allowed}' +
        '.sk-btn.gold{background:linear-gradient(100deg,#f59e0b,#ea580c);box-shadow:0 6px 18px rgba(245,158,11,.35)}.sk-btn.green{background:linear-gradient(100deg,#16a34a,#0d9488);box-shadow:0 6px 18px rgba(22,163,74,.35)}.sk-btn.ghost{background:rgba(30,41,59,.8);box-shadow:none;border:1px solid rgba(148,163,184,.3)}.sk-btn.sm{padding:7px 11px;font-size:12px;border-radius:10px}' +
        '.sk-chips{display:flex;flex-wrap:wrap;gap:6px}.sk-chip{padding:7px 11px;border-radius:11px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);color:#cbd5e1;font:400 12px "Russo One",Arial;cursor:pointer}.sk-chip.on{border-color:#fb7185;color:#fff;background:rgba(225,29,72,.35);box-shadow:0 0 12px rgba(244,63,94,.35)}' +
        '.sk-in{display:flex;align-items:center;gap:6px}.sk-in input{width:100%;min-width:0;padding:9px 10px;border-radius:11px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.7);color:#fff;font:400 15px "Russo One",Arial;outline:none}.sk-in input:focus{border-color:#fb7185}' +
        '.sk-lbl{display:block;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#a8a2c8;margin:8px 0 5px}' +
        '.sk-note{font-size:11.5px;color:#a8a2c8;line-height:1.4}.sk-note b{color:#fde68a}.sk-empty{padding:22px 10px;text-align:center;color:#7c76a0;font-size:13px}' +
        '.sk-it{position:relative;flex:none;width:62px;height:62px;border-radius:11px;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--rc) 35%,transparent),rgba(2,6,23,.85) 70%);border:1px solid color-mix(in srgb,var(--rc) 70%,transparent);display:flex;align-items:center;justify-content:center}' +
        '.sk-it .sk-ic{width:70%;height:70%;display:flex;align-items:center;justify-content:center}.sk-it .sk-pr{position:absolute;left:0;right:0;bottom:1px;text-align:center;font:400 9.5px "Russo One",Arial;color:#fde68a;text-shadow:0 1px 2px #000}' +
        '.sk-it.pick{cursor:pointer}.sk-inv{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px;max-height:min(46vh,340px);overflow:auto;padding:2px}' +
        '.sk-list{display:flex;flex-direction:column;gap:8px}.sk-game{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.14);flex-wrap:wrap}.sk-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
        '.sk-fair{font:600 10px/1.4 ui-monospace,Consolas,monospace;color:#7c76a0;word-break:break-all}.sk-fair b{color:#a8a2c8;font-family:Jura,Arial}' +
        // колесо
        '.wh-wrap{position:relative;width:min(100%,380px);margin:0 auto}.wh-wrap canvas{display:block;width:100%;height:auto}.wh-ptr{position:absolute;left:50%;top:-4px;margin-left:-12px;width:0;height:0;border:12px solid transparent;border-top:22px solid #fde68a;filter:drop-shadow(0 2px 4px #000);z-index:2}' +
        '.wh-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;font:400 clamp(22px,4.5vw,34px) "Russo One",Arial;color:#fff;text-shadow:0 2px 10px #000;text-align:center}.wh-c small{font:700 11px Jura,Arial;color:#cbd5e1;letter-spacing:.08em}' +
        '.wh-tk{display:flex;align-items:center;justify-content:center;gap:10px;margin:10px 0 4px}.wh-tk b{font:400 clamp(26px,5vw,40px)/1 "Russo One",Arial;color:#fde68a;text-shadow:0 0 18px rgba(250,204,21,.5)}.wh-tk span{font-size:12px;color:#a8a2c8;text-align:left;line-height:1.3}' +
        '.wh-spin{width:100%;margin-top:8px;font-size:17px;padding:14px 16px}' +
        '.wh-legend{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.wh-lg{padding:9px 4px;border-radius:12px;border:1px solid color-mix(in srgb,var(--c) 70%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 45%,transparent),rgba(2,6,23,.85));color:#fff;text-align:center}' +
        '.wh-lg b{display:block;font:400 16px "Russo One",Arial}.wh-lg small{display:block;font-size:10.5px;color:#e2e8f0;margin-top:2px}' +
        '.wh-how{display:flex;gap:10px;align-items:flex-start;padding:10px;border-radius:12px;background:rgba(2,6,23,.45);border:1px dashed rgba(250,204,21,.35);margin-top:10px}.wh-how i{font-style:normal;font-size:24px}' +
        '.sk-hist{display:flex;flex-direction:column;gap:4px}.sk-hr{display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 8px;border-radius:9px;background:rgba(2,6,23,.4)}.sk-hr .x{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1}.sk-hr .p{color:#4ade80;font-weight:800}.sk-hr .m{color:#f87171;font-weight:800}' +
        // модальні вікна
        '.sk-mod{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(2,3,12,.78);backdrop-filter:blur(3px)}' +
        '.sk-mbox{width:min(640px,100%);max-height:94dvh;overflow:auto;border-radius:18px;background:linear-gradient(160deg,#2a1146,#0b0820);border:1px solid rgba(244,114,182,.35);box-shadow:0 20px 50px rgba(0,0,0,.6);padding:14px}' +
        '.sk-mbox h3{margin:0 0 8px;font:400 17px "Russo One",Arial;letter-spacing:.06em;color:#fff}.sk-mbtns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}' +
        '.sk-rules{font-size:12.5px;line-height:1.5;color:#cbd5e1}.sk-rules li{margin:3px 0}.sk-rules b{color:#fde68a}' +
        '.sk-chk{display:flex;gap:8px;align-items:flex-start;margin-top:10px;font-size:12.5px;font-weight:700;color:#fff;cursor:pointer}.sk-chk input{width:18px;height:18px;accent-color:#e11d48;flex:none;margin-top:1px}' +
        '.du-maps{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px}.du-map{padding:10px 8px;border-radius:12px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);color:#e2e8f0;font:400 12px "Russo One",Arial;cursor:pointer;text-align:left}.du-map small{display:block;font:700 10px Jura,Arial;color:#a8a2c8;margin-top:3px}.du-map.on{border-color:#fb7185;background:rgba(225,29,72,.3)}' +
        '#stk-dres{position:fixed;inset:0;z-index:85;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle,rgba(30,10,50,.92),rgba(2,3,12,.97))}#stk-dres .in{text-align:center;padding:20px}' +
        '#stk-dres h1{margin:0;font:400 clamp(34px,8vw,72px)/1 "Russo One",Arial;letter-spacing:.14em}#stk-dres.win h1{background:linear-gradient(180deg,#fff7cc,#fbbf24 60%,#b45309);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 22px rgba(251,191,36,.6))}#stk-dres.loss h1{color:#fca5a5}' +
        '#stk-dres p{font-size:15px;color:#e2e8f0}#stk-dres .pz{font:400 clamp(22px,4vw,34px) "Russo One",Arial;margin:12px 0}' +
        '@media (max-width:820px){.sk-grid2{grid-template-columns:1fr}}' +
        '@media (max-width:520px){.sk-hd{gap:5px}.sk-back{padding:8px 10px}.sk-back span:last-child{display:none}.sk-ttl h2{font-size:17px;letter-spacing:.08em}.sk-ttl small{font-size:9.5px}.sk-hbtn{padding:6px 8px;font-size:14px}.sk-bal{padding:6px 8px;font-size:12.5px}.sk-ft{font-size:10px}.wh-legend{grid-template-columns:repeat(2,minmax(0,1fr))}}' +
        '@media (orientation:landscape) and (max-height:520px){.sk-ttl small,.sk-ft p{display:none}.sk-hd{padding-top:5px}.wh-wrap{width:min(100%,250px)}.sk-grid2{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}}' +
        'html.gfx-low #stk-ov:before{display:none}html.gfx-low .sk-tab.on,html.gfx-low .sk-btn{box-shadow:none}';
    var sEl = document.createElement('style'); sEl.id = 'stk-css'; sEl.textContent = css; document.head.appendChild(sEl);

    // ================= КАРКАС =================
    var TABS = [['wh', '🎡', 'Колесо фортуни'], ['du', '🤝', 'Дуелі']];
    if (!TABS.some(function (t) { return t[0] === ST.tab; })) ST.tab = 'wh';
    var ov = null, body = null, loopRaf = 0;
    function build() {
        ov = document.createElement('div'); ov.id = 'stk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = '<header class="sk-hd"><button type="button" class="sk-back" data-a="close"><span>←</span> <span>Меню</span></button>' +
            '<div class="sk-ttl"><h2>ФОРТУНА</h2><small id="sk-lim"></small></div>' +
            '<button type="button" class="sk-hbtn" data-a="box" title="Скринька виграшу" id="sk-boxb" style="display:none">🎁<i id="sk-boxn"></i></button>' +
            '<button type="button" class="sk-hbtn" data-a="hist" title="Історія">📜</button>' +
            '<div class="sk-bal" id="sk-bal"></div></header>' +
            '<nav class="sk-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" class="sk-tab" data-tab="' + t[0] + '"><i>' + t[1] + '</i><span>' + t[2] + '</span></button>'; }).join('') + '</nav>' +
            '<main class="sk-body" id="sk-body"></main>' +
            '<footer class="sk-ft"><span>🛡️</span><p>Лише ігрова валюта: кредити й предмети не мають грошової вартості, їх неможливо вивести чи обміняти на реальні гроші. Продаж акаунтів заборонено.</p><button type="button" data-a="rules">Правила</button><button type="button" data-a="fair">Чесність</button></footer>';
        document.body.appendChild(ov); body = $('sk-body');
        ov.addEventListener('click', onClick);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on') && !document.querySelector('.sk-mod') && !(window.uiDialog && uiDialog.isOpen())) close(); });
    }
    function open(tab) {
        if (!ov) build();
        if (tab) ST.tab = tab;
        ov.classList.add('on'); socket.emit('stkHello'); paintHead(); render(); loop();
    }
    function close() { if (!ov) return; ov.classList.remove('on'); socket.emit('stkBye'); cancelAnimationFrame(loopRaf); loopRaf = 0; closeMod(); }
    function isOpen() { return !!ov && ov.classList.contains('on'); }
    function paintHead() {
        if (!ov) return;
        $('sk-bal').innerHTML = crI(bucks(), 16);
        var m = ST.me; $('sk-lim').textContent = m ? '🎟 ' + tt('Квитків') + ': ' + m.tk + ' · ' + tt('Дуелей сьогодні') + ': ' + m.n + ' / ' + m.max : '';
        var n = m && m.prize ? m.prize.length : 0; $('sk-boxb').style.display = n ? '' : 'none'; $('sk-boxn').textContent = n;
        ov.querySelectorAll('.sk-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === ST.tab); });
    }
    function setTab(t) { ST.tab = t; try { localStorage.setItem('stkTab', t); } catch (e) {} paintHead(); render(); body.scrollTop = 0; }
    function render() { if (!isOpen()) return; (ST.tab === 'du' ? rDu : rWh)(); }
    function loop() {
        cancelAnimationFrame(loopRaf);
        (function step() {
            if (!isOpen()) { loopRaf = 0; return; }
            try { if (ST.tab === 'wh') whFrame(); } catch (e) { console.error(e); }
            loopRaf = requestAnimationFrame(step);
        })();
    }

    // ================= ВЗАЄМОДІЯ =================
    function emit(ev, d) { socket.emit(ev, d || {}); }
    function onClick(e) {
        var b = e.target.closest('[data-a],[data-tab]'); if (!b || b.disabled) return;
        if (b.dataset.tab) { snd('ui_click'); return setTab(b.dataset.tab); }
        var a = b.dataset.a;
        snd('ui_click');
        switch (a) {
            case 'close': return close();
            case 'rules': return rulesDlg();
            case 'fair': return fairDlg();
            case 'box': return boxDlg();
            case 'hist': return histDlg();
            case 'spin': return spin();
            case 'quests': close(); if (window.Progress && Progress.openQuests) Progress.openQuests(); else { var c = $('mm-progress'); if (c) c.click(); } return;
            case 'friends': close(); if (window.Social && Social.open) Social.open('friends'); else { var t = $('sc-top'); if (t) t.click(); } return;
        }
    }
    // перед дуеллю — правила (один раз)
    function guard(fn) { if (ST.me && !ST.me.acc) return rulesDlg(fn); fn(); }

    // ================= МОДАЛЬНІ =================
    var modEl = null;
    function modal(html, onClickFn) {
        closeMod(); modEl = document.createElement('div'); modEl.className = 'sk-mod';
        modEl.innerHTML = '<div class="sk-mbox" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(modEl);
        modEl.addEventListener('pointerdown', function (e) { if (e.target === modEl) closeMod(); });
        modEl.addEventListener('click', function (e) { var b = e.target.closest('[data-m]'); if (!b || b.disabled) return; snd('ui_click'); if (b.dataset.m === 'x') return closeMod(); if (onClickFn) onClickFn(b, e); });
        return modEl;
    }
    function closeMod() { if (modEl) { modEl.remove(); modEl = null; } }

    function rulesDlg(after) {
        var acc = ST.me && ST.me.acc;
        modal('<h3>📜 ' + tt('Правила Фортуни') + '</h3><div class="sk-rules"><ul>' +
            '<li>' + tt('Фортуна — розважальний розділ гри. Тут лише ігрова валюта (кредити) й ігрові предмети.') + '</li>' +
            '<li><b>' + tt('Кредити й предмети не мають грошової вартості. Їх неможливо вивести з гри, обміняти чи продати за реальні гроші — ні через гру, ні через адміністрацію.') + '</b></li>' +
            '<li>' + tt('Колесо фортуни крутиться лише за квиток. Квиток дає щоденне завдання «Квиток дня» — купити оберт неможливо.') + '</li>' +
            '<li>' + tt('Дуель — бій 1×1 з другом на кредити: перемагає той, хто краще грає. Доступ — з 3 рівня. Ставка — від') + ' ' + SI.MIN_BET + ' ' + tt('до') + ' ' + fmt(SI.MAX_BET) + ' ' + tt('кредитів, не більше') + ' ' + SI.DAILY + ' ' + tt('дуелей на добу.') + '</li>' +
            '<li>' + tt('Комісія системи в дуелі — 5%. Хто покине бій — програє.') + '</li>' +
            '<li>' + tt('Продаж, купівля й передача акаунтів заборонені — за це акаунт блокується без повернення.') + '</li>' +
            '<li>' + tt('Результат колеса визначає сервер і його можна перевірити: до оберту показується хеш секретного ключа, після — сам ключ (кнопка «Чесність»).') + '</li></ul>' +
            (acc ? '' : '<label class="sk-chk"><input type="checkbox" id="sk-acc"><span>' + tt('Мені виповнилося 18 років, я прочитав(-ла) правила й погоджуюсь із ними') + '</span></label>') + '</div>' +
            '<div class="sk-mbtns">' + (acc ? '<button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button>' : '<button type="button" class="sk-btn ghost" data-m="x">' + tt('Пізніше') + '</button><button type="button" class="sk-btn" data-m="ok">' + tt('Приймаю') + '</button>') + '</div>',
            function (b) {
                if (b.dataset.m !== 'ok') return;
                if (!$('sk-acc').checked) { toast('Підтвердіть згоду з правилами', true); return; }
                socket.emit('stkRules'); if (ST.me) ST.me.acc = Date.now(); closeMod(); if (typeof after === 'function') setTimeout(after, 150);
            });
    }

    // ================= ПЕРЕВІРКА ЧЕСНОСТІ =================
    function hmacFloat(ss, cs, nonce) {
        if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('no-subtle'));
        var enc = new TextEncoder();
        return crypto.subtle.importKey('raw', enc.encode(ss), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']).then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(cs + ':' + nonce)); })
            .then(function (sig) { var h = Array.prototype.map.call(new Uint8Array(sig), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); return SI.hexFloat(h); });
    }
    function sha256(s) { if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('no-subtle')); return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); }); }
    function myLogin() { try { return typeof myName !== 'undefined' ? myName : ''; } catch (e) { return ''; } }
    function fairDlg() {
        var W = (ST.me && ST.me.wh) || { last: [] }, rows = W.last || [];
        modal('<h3>🛡️ ' + tt('Перевірка чесності') + '</h3><p class="sk-note">' + tt('Перед кожним обертом сервер фіксує секретний ключ і показує його SHA-256 хеш. Після оберту ключ відкривається. Сектор = HMAC-SHA256(ключ, логін:номер оберту) → число від 0 до 1 × кількість секторів. Натисніть «Перевірити» — ваш браузер сам перерахує результат.') + '</p>' +
            '<div class="sk-fair" style="margin:8px 0"><b>' + tt('Хеш ключа наступного оберту') + ':</b> ' + esc(W.hash || '—') + '</div>' +
            '<div class="sk-hist">' + (rows.length ? rows.map(function (r, i) { return '<div class="sk-hr" style="flex-direction:column;align-items:stretch"><div style="display:flex;gap:8px;align-items:center"><span class="x">#' + r.n + ' · ' + crI(r.v, 12) + '</span><button type="button" class="sk-btn sm ghost" data-m="v" data-i="' + i + '">' + tt('Перевірити') + '</button></div><div class="sk-fair"><b>' + tt('Хеш ключа') + ':</b> ' + esc(r.hash) + '<br><b>' + tt('Ключ') + ':</b> ' + esc(r.ss) + '</div><div class="sk-fair" id="fv-' + i + '"></div></div>'; }).join('') : '<div class="sk-empty">' + tt('Поки що немає обертів') + '</div>') + '</div>' +
            '<div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button></div>',
            function (b) {
                if (b.dataset.m !== 'v') return; var r = rows[+b.dataset.i], out = $('fv-' + b.dataset.i); if (!r || !out) return;
                Promise.all([sha256(r.ss), hmacFloat(r.ss, myLogin(), r.n)]).then(function (x) {
                    var okH = x[0] === r.hash, idx = Math.floor(x[1] * SI.wheel.length), s = SI.sect(SI.wheel[idx]);
                    out.innerHTML = (okH ? '✅ ' + tt('Хеш збігається') : '❌ ' + tt('Хеш НЕ збігається')) + ' · ' + tt('Результат') + ': <b style="color:#fde68a">' + fmt(s.v) + '</b>' + (s.v === r.v ? ' ✅' : ' ❌');
                }).catch(function () { out.textContent = tt('Ваш браузер не підтримує перевірку (потрібне HTTPS-з’єднання)'); });
            });
    }

    // ================= ІСТОРІЯ / СКРИНЬКА =================
    var KN = { cb: 'Батл кейсів', cf: 'Койнфліп', jp: 'Джекпот', wh: 'Колесо фортуни', du: 'Дуель', box: 'Скринька' };
    function histRows(list) {
        return list && list.length ? list.map(function (h) { return '<div class="sk-hr"><span>' + esc(tt(KN[h.k] || h.k)) + '</span><span class="x">' + esc(tt(h.x || '')) + '</span><span class="' + (h.d >= 0 ? 'p' : 'm') + '">' + (h.d > 0 ? '+' : '') + fmt(h.d) + '</span></div>'; }).join('') : '<div class="sk-empty">' + tt('Ще нічого немає') + '</div>';
    }
    function histDlg() { modal('<h3>📜 ' + tt('Історія') + '</h3><div class="sk-hist">' + histRows(ST.me && ST.me.hist) + '</div><div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button></div>'); }
    function boxDlg() {
        var P = (ST.me && ST.me.prize) || [], full = inv().length >= SI.INV_MAX;
        var h = '<h3>🎁 ' + tt('Скринька виграшу') + '</h3><p class="sk-note">' + tt('Тут лежать предмети, що не вмістилися в інвентар (30). Заберіть, продайте за повну ціну або замініть ними непотрібний предмет з інвентарю.') + '</p>';
        h += P.length ? '<div class="sk-list" style="margin-top:8px">' + P.map(function (id, i) { var m = M(id); return '<div class="sk-game">' + item(id) + '<div style="flex:1;min-width:0"><b style="color:#fff">' + esc(m ? m.name : id) + '</b><br><small style="color:#a8a2c8">' + crI(priceOf(id), 12) + '</small></div><div class="sk-row"><button type="button" class="sk-btn sm green" data-m="take" data-i="' + i + '"' + (full ? ' disabled' : '') + '>' + tt('Забрати') + '</button><button type="button" class="sk-btn sm gold" data-m="sell" data-i="' + i + '">' + tt('Продати') + '</button><button type="button" class="sk-btn sm ghost" data-m="swap" data-i="' + i + '">' + tt('Замінити…') + '</button></div></div>'; }).join('') + '</div>' : '<div class="sk-empty">' + tt('Скринька порожня') + '</div>';
        modal(h + '<div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button></div>', function (b) {
            var i = +b.dataset.i;
            if (b.dataset.m === 'take') emit('stkPrize', { i: i, act: 'take' });
            else if (b.dataset.m === 'sell') emit('stkPrize', { i: i, act: 'sell' });
            else if (b.dataset.m === 'swap') swapDlg(i);
        });
    }
    function swapDlg(i) {
        var I = inv(), id = ST.me.prize[i];
        modal('<h3>🔁 ' + tt('Замінити предмет') + '</h3><p class="sk-note">' + tt('Оберіть предмет з інвентарю: він продасться за повну ціну, а на його місце стане') + ' <b>' + esc(M(id) ? M(id).name : '') + '</b>.</p><div class="sk-inv">' +
            I.map(function (x, j) { return '<div data-m="pick" data-j="' + j + '" style="cursor:pointer">' + item(x, 'pick') + '</div>'; }).join('') + '</div><div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Скасувати') + '</button></div>',
            function (b) { if (b.dataset.m === 'pick') { emit('stkPrize', { i: i, act: 'swap', with: +b.dataset.j }); closeMod(); } });
    }

    // ================= КОЛЕСО =================
    var whCv = null, whG = null, whRot = 0, whSpin = null, whBusy = false;
    function rWh() {
        var m = ST.me || { tk: 0 }, tk = m.tk | 0, n = SI.wheel.length;
        body.innerHTML = '<div class="sk-grid2"><div class="sk-card"><div class="sk-h"><h3>🎡 ' + tt('Колесо фортуни') + '</h3><small>' + tt('Оберт — за квиток, без ставок') + '</small></div>' +
            '<div class="wh-wrap"><div class="wh-ptr"></div><canvas id="wh-cv" width="520" height="520"></canvas><div class="wh-c" id="wh-c"></div></div>' +
            '<div class="wh-tk"><b id="wh-tkn">🎟 ' + tk + '</b><span>' + tt('квитків') + '<br>' + tt('у запасі') + '</span></div>' +
            '<button type="button" class="sk-btn gold wh-spin" data-a="spin" id="wh-go"' + (tk > 0 && !whBusy ? '' : ' disabled') + '>' + (whBusy ? tt('Крутиться…') : '🎡 ' + tt('Крутити')) + '</button></div>' +
            '<div class="sk-card"><div class="sk-h"><h3>' + tt('Призи') + '</h3><small>' + n + ' ' + tt('секторів') + '</small></div><div class="wh-legend">' + SI.WH.SECT.slice().reverse().map(function (s) {
                return '<div class="wh-lg" style="--c:' + s.c + '"><b>' + fmt(s.v) + '</b><small>' + (s.n / n * 100).toFixed(1) + '%</small></div>';
            }).join('') + '</div>' +
            '<div class="wh-how"><i>🎟</i><div class="sk-note">' + tt('Як отримати квиток: виконайте щоденні завдання — у списку завдань є «Квиток дня». Один квиток на добу, у запасі — до') + ' ' + SI.TICKETS_MAX + '.<br><button type="button" class="sk-btn sm ghost" style="margin-top:6px" data-a="quests">📋 ' + tt('До завдань') + '</button></div></div>' +
            '<span class="sk-lbl">' + tt('Великі виграші') + '</span><div class="sk-hist">' + (ST.feed.length ? ST.feed.map(function (f) { return '<div class="sk-hr"><span class="x">🎉 ' + esc(f.nick) + '</span><span class="p">+' + fmt(f.v) + '</span></div>'; }).join('') : '<div class="sk-empty">—</div>') + '</div></div></div>';
        whCv = $('wh-cv'); whG = whCv.getContext('2d'); whFrame();
    }
    function whDraw(rot) {
        var g = whG, W = whCv.width, R = W / 2 - 6, cx = W / 2, cy = W / 2, n = SI.wheel.length, a = Math.PI * 2 / n;
        g.clearRect(0, 0, W, W); g.save(); g.translate(cx, cy); g.rotate(rot);
        for (var i = 0; i < n; i++) { var s = SI.sect(SI.wheel[i]); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, i * a - Math.PI / 2 - a / 2, (i + 1) * a - Math.PI / 2 - a / 2); g.closePath(); g.fillStyle = s.c; g.fill(); g.strokeStyle = 'rgba(2,6,23,.55)'; g.lineWidth = 2; g.stroke(); }
        g.beginPath(); g.arc(0, 0, R * 0.62, 0, Math.PI * 2); g.fillStyle = '#0b0820'; g.fill(); g.strokeStyle = 'rgba(253,230,138,.5)'; g.lineWidth = 3; g.stroke();
        g.restore();
    }
    function whFrame() {
        if (!whCv || !document.body.contains(whCv)) return;
        var t = performance.now(), c = $('wh-c'), txt;
        if (whSpin) {
            var k = Math.min(1, (t - whSpin.t0) / whSpin.dur), e = 1 - Math.pow(1 - k, 4);
            whRot = whSpin.from + (whSpin.to - whSpin.from) * e;
            if (k >= 1) { var r = whSpin.res; whSpin = null; whBusy = false; whDone(r); }
        }
        whDraw(whRot);
        txt = whBusy ? '…' : (ST.last ? '<span style="color:' + SI.sect(SI.wheel[ST.last.idx]).c + '">+' + fmt(ST.last.v) + '</span><small>' + tt('останній оберт') + '</small>' : '🎟<small>' + tt('квиток = оберт') + '</small>');
        if (c && c.__t !== txt) { c.__t = txt; c.innerHTML = txt; }
    }
    function spin() {
        if (whBusy || !ST.me || !(ST.me.tk > 0)) return;
        whBusy = true; var b = $('wh-go'); if (b) { b.disabled = true; b.textContent = tt('Крутиться…'); }
        emit('stkWhSpin');
        setTimeout(function () { if (whBusy && !whSpin) { whBusy = false; render(); } }, 5000);      // відповіді немає (обрив зв'язку) — розблокувати
    }
    function whStart(d) {
        var n = SI.wheel.length, a = Math.PI * 2 / n, base = whRot - (whRot % (Math.PI * 2));
        var W = whSpin = { t0: performance.now(), dur: SI.WH.SPIN - 500, from: whRot, to: base - d.idx * a - 6 * Math.PI * 2 + (Math.random() - 0.5) * a * 0.6, res: d };
        usnd('roll_start', { force: true });
        // вкладка у фоні (анімація стоїть) — результат однаково показуємо вчасно
        setTimeout(function () { if (whSpin === W) { whSpin = null; whBusy = false; whRot = W.to; whDone(d); } }, W.dur + 700);
    }
    function whDone(d) {
        ST.last = d; var s = SI.sect(SI.wheel[d.idx]);
        usnd(s.v >= 1500 ? 'reveal_legendary' : s.v >= 250 ? 'reveal_rare' : 'reveal_common', { force: true });
        if (window.uiDialog && s.v >= 250) uiDialog.show({ kind: 'success', icon: s.v >= 1500 ? '🏆' : '🎉', title: tt('Колесо фортуни'), text: tt('Ваш приз') + ': ' + crI(s.v, 16) });
        else toast('🎡 +' + fmt(s.v) + ' ' + tt('кредитів'));
        if (isOpen() && ST.tab === 'wh') rWh();
    }

    // ================= ДУЕЛІ =================
    function rDu() {
        var H = (ST.me && ST.me.hist || []).filter(function (h) { return h.k === 'du'; });
        var lock = ST.me && ST.me.lvl < SI.MIN_LEVEL;
        body.innerHTML = '<div class="sk-grid2"><div class="sk-card"><div class="sk-h"><h3>🤝 ' + tt('Дуелі з друзями') + '</h3></div>' +
            (lock ? '<div class="sk-empty">🔒 ' + tt('Дуелі відкриваються з') + ' <b>' + SI.MIN_LEVEL + '</b> ' + tt('рівня') + '.<br>' + tt('Грайте бої, щоб підвищити рівень!') + '</div>' :
            '<p class="sk-note">' + tt('Викликайте друга на дуель 1×1 зі ставкою в кредитах. Ви обираєте арену, кількість раундів і час раунду. Переможець забирає банк (комісія 5%), предмети в дуелі не випадають. Хто покине бій — програє.') + '</p>' +
            '<ol class="sk-note" style="padding-left:18px"><li>' + tt('Відкрийте 👥 Друзі') + '</li><li>' + tt('Біля друга в мережі натисніть «💰 Дуель»') + '</li><li>' + tt('Налаштуйте бій і надішліть виклик') + '</li></ol>' +
            '<button type="button" class="sk-btn gold" data-a="friends">👥 ' + tt('Відкрити друзів') + '</button>' +
            '<p class="sk-note" style="margin-top:8px">' + tt('З одним другом — не більше') + ' ' + SI.DU.PAIR_MAX + ' ' + tt('дуелей на добу. Дуелі між акаунтами з однієї мережі заборонені.') + '</p>') + '</div>' +
            '<div class="sk-card"><div class="sk-h"><h3>' + tt('Ваші дуелі') + '</h3></div><div class="sk-hist">' + histRows(H) + '</div></div></div>';
    }
    var THEME = { stone: '🏛️', sand: '🏜️', tech: '💠', snow: '❄️', lava: '🌋', metal: '⚙️' };
    function duelDlg(login, nm) {
        if (ST.me && !ST.me.acc) return rulesDlg(function () { duelDlg(login, nm); });
        var S = { stake: 200, map: SI.DU.MAPS[0], rounds: 3, time: 90 };
        var maps = SI.DU.MAPS.filter(function (k) { return G('MAP_DATA') && MAP_DATA[k]; }); if (!maps.length) maps = SI.DU.MAPS.slice(); S.map = maps[0];
        function draw() {
            var prize = Math.floor(S.stake * 2 * (1 - SI.FEE));
            modEl.querySelector('.sk-mbox').innerHTML = '<h3>💰 ' + tt('Дуель з') + ' ' + esc(nm) + '</h3>' +
                '<span class="sk-lbl">' + tt('Ставка (кожен)') + '</span><div class="sk-in"><input id="du-st" type="number" min="' + SI.MIN_BET + '" max="' + SI.MAX_BET + '" step="10" value="' + S.stake + '"></div>' +
                '<div class="sk-chips" style="margin-top:6px">' + [50, 100, 200, 500, 1000, 2500].map(function (v) { return '<button type="button" class="sk-chip' + (S.stake === v ? ' on' : '') + '" data-m="st" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div>' +
                '<span class="sk-lbl">' + tt('Арена') + '</span><div class="du-maps">' + maps.map(function (k) { var m = G('MAP_DATA') && MAP_DATA[k]; return '<button type="button" class="du-map' + (S.map === k ? ' on' : '') + '" data-m="map" data-v="' + esc(k) + '">' + (THEME[m && m.theme] || '⚔️') + ' ' + esc(k) + '<small>' + (m ? m.size + '×' + m.size : '') + '</small></button>'; }).join('') + '</div>' +
                '<span class="sk-lbl">' + tt('Раундів') + '</span><div class="sk-chips">' + SI.DU.ROUNDS.map(function (v) { return '<button type="button" class="sk-chip' + (S.rounds === v ? ' on' : '') + '" data-m="rd" data-v="' + v + '">' + v + '</button>'; }).join('') + '</div>' +
                '<span class="sk-lbl">' + tt('Час раунду') + '</span><div class="sk-chips">' + SI.DU.TIMES.map(function (v) { return '<button type="button" class="sk-chip' + (S.time === v ? ' on' : '') + '" data-m="tm" data-v="' + v + '">' + v + ' ' + tt('с') + '</button>'; }).join('') + '</div>' +
                '<p class="sk-note" style="margin-top:8px">' + tt('Переможець отримає') + ' ' + crI(prize) + ' (' + tt('банк') + ' ' + fmt(S.stake * 2) + ' − 5%). ' + tt('Без класів і бонусів, предмети не випадають. Вихід з бою = поразка.') + '</p>' +
                '<div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Скасувати') + '</button><button type="button" class="sk-btn" data-m="go"' + (S.stake <= bucks() ? '' : ' disabled') + '>⚔ ' + tt('Викликати') + '</button></div>';
            var inp = $('du-st'); inp.addEventListener('change', function () { S.stake = Math.max(SI.MIN_BET, Math.min(SI.MAX_BET, Math.floor(+inp.value || 0))); draw(); });
        }
        modal('', function (b) {
            var m = b.dataset.m;
            if (m === 'st') S.stake = +b.dataset.v; else if (m === 'map') S.map = b.dataset.v; else if (m === 'rd') S.rounds = +b.dataset.v; else if (m === 'tm') S.time = +b.dataset.v;
            else if (m === 'go') { var v = Math.floor(+$('du-st').value || S.stake); emit('stkDuInv', { to: login, stake: v, map: S.map, rounds: S.rounds, time: S.time }); closeMod(); return; }
            draw();
        });
        draw();
    }
    // вхідний виклик
    var invT = {};
    function onInvite(d) {
        if (!d) return; snd('ui_invite');
        var go = function (ok) { clearTimeout(invT[d.id]); if (ok && ST.me && !ST.me.acc) return rulesDlg(function () { socket.emit('stkDuAns', { id: d.id, ok: true }); }); socket.emit('stkDuAns', { id: d.id, ok: !!ok }); };
        if (!window.uiDialog) return;
        uiDialog.show({ kind: 'warn', icon: '💰', title: tt('Виклик на дуель!'), text: esc(d.nick) + ' ' + tt('викликає вас на дуель 1×1 зі ставкою'),
            rows: [[tt('Ставка (кожен)'), (window.creditIcon ? creditIcon(14) : '') + ' ' + fmt(d.stake), '', 1], [tt('Переможець отримає'), (window.creditIcon ? creditIcon(14) : '') + ' ' + fmt(Math.floor(d.stake * 2 * (1 - SI.FEE))), '', 1], [tt('Арена'), esc(d.map)], [tt('Раундів'), String(d.rounds)], [tt('Час раунду'), d.time + ' ' + tt('с')]],
            buttons: [{ t: tt('Відхилити'), cls: 'ghost', cb: function () { go(false); } }, { t: tt('Прийняти'), cls: 'primary', cb: function () { go(true); } }], dismissable: false });
        invT[d.id] = setTimeout(function () { if (window.uiDialog && uiDialog.isOpen()) uiDialog.close(); }, d.ttl || SI.DU.INVITE_MS);
    }

    // ================= ПОДІЇ СЕРВЕРА =================
    function setMe(d) {
        ST.me = d;
        if (d && d.news && d.news.length) d.news.forEach(function (n) { if (window.uiDialog) uiDialog.show({ kind: 'success', icon: '🎰', title: tt('Фортуна'), text: tt(n.x) }); else toast(n.x); });
        if (window.MenuHub && MenuHub.badge) try { MenuHub.badge('mm-stakes', d && d.tk ? d.tk : 0); } catch (e) {}
    }
    socket.on('stkState', function (d) { if (!d) return; syncT(d); setMe(d.me); ST.feed = d.feed || []; paintHead(); render(); });
    socket.on('stkMe', function (d) { if (!d) return; setMe(d); paintHead(); if (isOpen() && !whBusy) render(); });
    socket.on('stkFeed', function (d) { ST.feed = d || []; });
    socket.on('stkWhRes', function (d) { if (!d) return; if (ST.me) { ST.me.tk = d.tk; } if (isOpen() && ST.tab === 'wh' && whCv && document.body.contains(whCv)) whStart(d); else { whBusy = false; ST.last = d; toast('🎡 +' + fmt(d.v)); } });
    socket.on('stkMsg', function (d) { if (d && d.t) { toast(d.t, d.bad); if (d.bad) snd('ui_error'); if (d.bad && d.ev === 'stkWhSpin') { whBusy = false; render(); } } });
    socket.on('stkOk', function (d) { if (d && d.ev === 'stkPrize') boxDlg(); });
    socket.on('stkDuInv', onInvite);
    socket.on('stkDuGone', function (d) { if (d && invT[d.id] && window.uiDialog && uiDialog.isOpen()) uiDialog.close(); });
    socket.on('stkDuGo', function (d) {
        if (!d) return; close(); if (window.uiDialog) uiDialog.closeAll();
        if (window.Social && Social.close) try { Social.close(); } catch (e) {}
        currentRoomId = d.roomId; currentRoomData = d.roomData; if (window.resetLobbyUI) resetLobbyUI();
        ['winner-modal', 'settings-modal'].forEach(function (id) { var e = $(id); if (e) e.classList.add('hidden'); });
        toast('⚔ ' + tt('Дуель починається! Ставка') + ': ' + fmt(d.stake));
    });
    socket.on('stkDuRes', function (d) {
        if (!d) return; var el = $('stk-dres'); if (!el) { el = document.createElement('div'); el.id = 'stk-dres'; document.body.appendChild(el); }
        el.className = d.win ? 'win' : 'loss';
        el.innerHTML = '<div class="in"><h1>' + tt(d.win ? 'ПЕРЕМОГА' : 'ПОРАЗКА') + '</h1><p>' + tt('Дуель з') + ' <b>' + esc(d.vs) + '</b>' + (d.why === 'leave' ? ' · ' + tt(d.win ? 'суперник покинув бій' : 'ви покинули бій') : '') + '</p>' +
            '<div class="pz">' + (d.win ? '+' + crI(d.prize, 26) : '−' + crI(d.stake, 26)) + '</div><button type="button" class="sk-btn gold" data-x="1">' + tt('В меню') + '</button></div>';
        snd(d.win ? 'powerup' : 'ui_click');
        el.querySelector('[data-x]').onclick = function () {
            snd('ui_click'); el.remove(); socket.emit('stkDuLeave');
            if (currentRoomData && currentRoomData.du) { currentRoomId = null; currentRoomData = null; if (window.resetLobbyUI) resetLobbyUI(); if (window.ModesFX) ModesFX.reset(); }
            showScreen('main-menu-screen'); if (typeof switchMusicState === 'function') switchMusicState('menu');
        };
    });
    socket.on('stkDuFail', function () { showScreen('main-menu-screen'); });
    socket.on('economyUpdate', function () { if (isOpen()) paintHead(); });

    window.Stakes = { open: open, close: close, duel: duelDlg, rules: rulesDlg, state: ST };
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-stakes', icon: '🎰', title: 'ФОРТУНА', sub: 'Колесо за квиток · дуелі', color: 'rose', bg: '💰', onClick: function () { open(); } });
    // стан (квитки, прийняття правил, новини) — одразу після завантаження модуля
    if (typeof socket !== 'undefined' && socket.connected) { socket.emit('stkHello'); setTimeout(function () { if (!isOpen()) socket.emit('stkBye'); }, 1500); }
})();
