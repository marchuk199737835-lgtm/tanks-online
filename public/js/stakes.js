/* stakes.js — «Фортуна» (клієнт): батл кейсів, койнфліп, джекпот, колесо фортуни, дуелі з друзями.
 * Сервер — stakes.js у корені, правила й числа — js/stakesinfo.js. Підвантажується ліниво (lazy.js), картка в меню — «ФОРТУНА».
 * Візуал легкий: CSS-анімації й два невеликі canvas (краш, колесо), що малюються лише коли їхня вкладка відкрита. */
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
    // MODULES / CASES / RARITY / MAP_DATA оголошені в config.js через const — їх немає на window, беремо напряму
    var G = function (n) { try { return n === 'MODULES' ? MODULES : n === 'CASES' ? CASES : n === 'RARITY' ? RARITY : n === 'MAP_DATA' ? MAP_DATA : null; } catch (e) { return null; } };
    var M = function (id) { var m = G('MODULES'); return m ? m[id] : null; };
    var priceOf = function (id) { var m = M(id); return m ? m.price | 0 : 0; };
    var rc = function (id) { var m = M(id); return m && G('RARITY') && RARITY[m.rarity] ? RARITY[m.rarity].color : '#64748b'; };
    var bucks = function () { try { return typeof myBucks === 'number' ? myBucks : 0; } catch (e) { return 0; } };
    var inv = function () { try { return Array.isArray(myInventory) ? myInventory.slice() : []; } catch (e) { return []; } };
    var me = function () { try { return typeof myName !== 'undefined' ? myName : ''; } catch (e) { return ''; } };
    var lowGfx = function () { return document.documentElement.classList.contains('gfx-low'); };
    var ST = { me: null, cb: { list: [] }, cf: { list: [] }, jp: null, cr: null, wh: null, lt: null, cbHist: [], cfHist: [], skew: 0, tab: 'cb', view: null };
    try { var lt0 = localStorage.getItem('stkTab'); if (lt0) ST.tab = lt0; } catch (e) {}
    var srvNow = function () { return Date.now() + ST.skew; };
    var syncT = function (d) { if (d && d.now) ST.skew = d.now - Date.now(); };

    function item(id, cls, extra) {
        var m = M(id); if (!m) return '';
        return '<div class="sk-it ' + (cls || '') + '" style="--rc:' + rc(id) + '" title="' + esc(m.name) + ' · ' + priceOf(id) + '"><div class="sk-ic">' + (window.modIcon ? modIcon(m) : '') + '</div><span class="sk-pr">' + fmt(m.price) + '</span>' + (extra || '') + '</div>';
    }
    function caseHtml(cid, cls) { var c = G('CASES') && CASES[cid]; if (!c) return ''; return '<div class="sk-case ' + (cls || '') + '" style="--cc:' + c.color + '" title="' + esc(c.name) + ' · ' + c.price + '">' + (window.caseIcon ? caseIcon(c) : '📦') + '</div>'; }

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
        '.sk-chips{display:flex;flex-wrap:wrap;gap:6px}.sk-chip{padding:7px 11px;border-radius:11px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.55);color:#cbd5e1;font:400 12px "Russo One",Arial;cursor:pointer}.sk-chip.on{border-color:#fb7185;color:#fff;background:rgba(225,29,72,.35);box-shadow:0 0 12px rgba(244,63,94,.35)}.sk-chip:disabled{opacity:.4;cursor:not-allowed}' +
        '.sk-in{display:flex;align-items:center;gap:6px}.sk-in input{width:100%;min-width:0;padding:9px 10px;border-radius:11px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.7);color:#fff;font:400 15px "Russo One",Arial;outline:none}.sk-in input:focus{border-color:#fb7185}' +
        '.sk-lbl{display:block;font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#a8a2c8;margin:8px 0 5px}' +
        '.sk-note{font-size:11.5px;color:#a8a2c8;line-height:1.4}.sk-note b{color:#fde68a}.sk-empty{padding:22px 10px;text-align:center;color:#7c76a0;font-size:13px}' +
        // предмети
        '.sk-it{position:relative;flex:none;width:62px;height:62px;border-radius:11px;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--rc) 35%,transparent),rgba(2,6,23,.85) 70%);border:1px solid color-mix(in srgb,var(--rc) 70%,transparent);display:flex;align-items:center;justify-content:center}' +
        '.sk-it .sk-ic{width:70%;height:70%;display:flex;align-items:center;justify-content:center}.sk-it .sk-pr{position:absolute;left:0;right:0;bottom:1px;text-align:center;font:400 9.5px "Russo One",Arial;color:#fde68a;text-shadow:0 1px 2px #000}' +
        '.sk-it.sm{width:42px;height:42px;border-radius:9px}.sk-it.sm .sk-pr{font-size:8px}.sk-it.sel{box-shadow:0 0 0 2px #fb7185,0 0 14px rgba(244,63,94,.6)}.sk-it.dis{opacity:.3;filter:grayscale(1)}.sk-it.pick{cursor:pointer}' +
        '.sk-it .sk-x{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:#e11d48;color:#fff;font:700 11px/18px Arial;text-align:center}' +
        '.sk-case{flex:none;width:46px;height:46px;border-radius:10px;padding:3px;background:rgba(2,6,23,.6);border:1px solid color-mix(in srgb,var(--cc) 60%,transparent)}.sk-case.sm{width:30px;height:30px;padding:2px;border-radius:7px}.sk-case.pick{cursor:pointer}' +
        '.sk-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}' +
        '.sk-inv{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px;max-height:min(46vh,340px);overflow:auto;padding:2px}' +
        // список ігор
        '.sk-list{display:flex;flex-direction:column;gap:8px}.sk-game{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:14px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.14);flex-wrap:wrap}' +
        '.sk-game.run{border-color:rgba(250,204,21,.5);box-shadow:0 0 14px rgba(250,204,21,.18)}.sk-game.mine{border-color:rgba(244,114,182,.5)}' +
        '.sk-tag{padding:3px 8px;border-radius:7px;font:400 10.5px "Russo One",Arial;letter-spacing:.04em;background:rgba(225,29,72,.3);border:1px solid rgba(244,114,182,.5);color:#fff;white-space:nowrap}' +
        '.sk-slots{display:flex;gap:5px;flex-wrap:wrap}.sk-slot{display:flex;align-items:center;gap:5px;padding:4px 8px;border-radius:10px;background:rgba(30,41,59,.7);font-size:11.5px;font-weight:700;color:#fff;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sk-slot.free{color:#a8a2c8;border:1px dashed rgba(148,163,184,.4);background:none;cursor:pointer}.sk-slot.t1{box-shadow:inset 3px 0 0 #60a5fa}.sk-slot.t0{box-shadow:inset 3px 0 0 #f87171}' +
        '.sk-pz{margin-left:auto;display:flex;align-items:center;gap:6px}' +
        // батл: перегляд
        '.cb-v{display:flex;flex-direction:column;gap:10px}.cb-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
        '.cb-rd{display:flex;gap:4px;align-items:center}.cb-rd .sk-case{opacity:.4;transition:opacity .2s,transform .2s}.cb-rd .sk-case.cur{opacity:1;transform:scale(1.12);box-shadow:0 0 14px var(--cc)}.cb-rd .sk-case.past{opacity:.75}' +
        '.cb-cols{display:grid;gap:8px}' +
        '.cb-col{position:relative;border-radius:14px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.15);padding:8px;display:flex;flex-direction:column;gap:6px;min-width:0;transition:opacity .4s,filter .4s,border-color .3s}' +
        '.cb-col.t0{border-top:3px solid #f87171}.cb-col.t1{border-top:3px solid #60a5fa}.cb-col.out{opacity:.45;filter:grayscale(.8)}.cb-col.win{border-color:#facc15;box-shadow:0 0 24px rgba(250,204,21,.4)}' +
        '.cb-pl{display:flex;align-items:center;justify-content:space-between;gap:6px;font-weight:800;font-size:12.5px;color:#fff;min-width:0}.cb-pl span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cb-sum{font:400 14px "Russo One",Arial;color:#fde68a;white-space:nowrap}' +
        '.cb-reel{position:relative;height:96px;border-radius:11px;overflow:hidden;background:rgba(0,0,0,.35);border:1px solid rgba(148,163,184,.15)}' +
        '.cb-reel:before,.cb-reel:after{content:"";position:absolute;left:0;right:0;height:24px;z-index:2;pointer-events:none}.cb-reel:before{top:0;background:linear-gradient(rgba(2,6,23,.95),transparent)}.cb-reel:after{bottom:0;background:linear-gradient(0deg,rgba(2,6,23,.95),transparent)}' +
        '.cb-mk{position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:#facc15;box-shadow:0 0 8px #facc15;z-index:3}' +
        '.cb-tape{position:absolute;left:50%;top:0;display:flex;flex-direction:column;align-items:center;gap:4px;will-change:transform}.cb-tape .sk-it{width:58px;height:58px}' +
        '.cb-won{display:flex;flex-wrap:wrap;gap:4px;min-height:44px}.cb-won .sk-it{animation:skPop .35s cubic-bezier(.2,1.4,.4,1)}@keyframes skPop{from{transform:scale(.3);opacity:0}}' +
        '.cb-res{text-align:center;font:400 clamp(18px,3vw,26px) "Russo One",Arial;letter-spacing:.1em;color:#fde68a;text-shadow:0 0 18px rgba(250,204,21,.6)}' +
        '.sk-fair{font:600 10px/1.4 ui-monospace,Consolas,monospace;color:#7c76a0;word-break:break-all}.sk-fair b{color:#a8a2c8;font-family:Jura,Arial}' +
        // койнфліп
        '.cf-arena{display:flex;align-items:center;justify-content:space-around;gap:10px;padding:10px 4px}.cf-side{flex:1;min-width:0;text-align:center}.cf-side b{display:block;color:#fff;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cf-side small{color:#a8a2c8}' +
        '.cf-side.win{filter:drop-shadow(0 0 12px rgba(250,204,21,.7))}.cf-side.lose{opacity:.45}' +
        '.cf-coin{flex:none;width:clamp(96px,18vw,140px);height:clamp(96px,18vw,140px);perspective:600px}.cf-c{position:relative;width:100%;height:100%;transform-style:preserve-3d}' +
        '.cf-f{position:absolute;inset:0;border-radius:50%;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;font:400 34px "Russo One",Arial;color:#fff;box-shadow:inset 0 0 0 6px rgba(255,255,255,.25),inset 0 -8px 16px rgba(0,0,0,.35),0 8px 24px rgba(0,0,0,.5)}' +
        '.cf-f.b{background:radial-gradient(circle at 35% 30%,#93c5fd,#1d4ed8 65%,#172554)}.cf-f.o{background:radial-gradient(circle at 35% 30%,#fdba74,#ea580c 65%,#7c2d12);transform:rotateY(180deg)}' +
        '.cf-dot{display:inline-block;width:12px;height:12px;border-radius:50%;vertical-align:-1px;margin-right:4px}.cf-dot.b{background:#3b82f6;box-shadow:0 0 8px #3b82f6}.cf-dot.o{background:#f97316;box-shadow:0 0 8px #f97316}' +
        // джекпот
        '.jp-pot{text-align:center;padding:6px 0}.jp-pot big{display:block;font:400 clamp(30px,6vw,52px)/1 "Russo One",Arial;color:#fde68a;text-shadow:0 0 26px rgba(250,204,21,.55)}.jp-pot small{color:#a8a2c8;font-size:12px}' +
        '.jp-bar{display:flex;height:14px;border-radius:8px;overflow:hidden;background:rgba(2,6,23,.7);margin:8px 0}.jp-bar i{display:block;height:100%;transition:width .4s}' +
        '.jp-pl{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:10px;background:rgba(2,6,23,.45);font-size:12.5px}.jp-pl .cl{width:10px;height:10px;border-radius:3px;flex:none}.jp-pl .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:800;color:#fff}.jp-pl .ch{font:400 12px "Russo One",Arial;color:#c4b5fd}' +
        '.jp-strip{position:relative;height:70px;border-radius:12px;overflow:hidden;background:rgba(0,0,0,.4);margin:8px 0}.jp-tape{position:absolute;top:8px;left:0;display:flex;gap:4px;will-change:transform}.jp-tile{flex:none;width:76px;height:54px;border-radius:10px;display:flex;align-items:center;justify-content:center;padding:4px;font:700 11px Jura,Arial;color:#fff;text-align:center;overflow:hidden;word-break:break-all}' +
        '.jp-strip .cb-mk{left:50%;right:auto;top:0;bottom:0;width:3px;height:auto;margin:0 0 0 -1.5px}' +
        // краш
        '.cr-wrap{position:relative;border-radius:14px;overflow:hidden;background:linear-gradient(180deg,#0b0820,#120a2a);border:1px solid rgba(148,163,184,.15)}.cr-wrap canvas{display:block;width:100%;height:clamp(200px,38vh,330px)}' +
        '.cr-m{position:absolute;left:0;right:0;top:34%;text-align:center;font:400 clamp(34px,7vw,64px)/1 "Russo One",Arial;color:#fff;text-shadow:0 0 24px rgba(255,255,255,.35);pointer-events:none}.cr-m.boom{color:#f87171;text-shadow:0 0 30px rgba(248,113,113,.7)}.cr-m small{display:block;font:700 13px Jura,Arial;color:#a8a2c8;margin-top:6px;letter-spacing:.08em}' +
        '.cr-hist{display:flex;gap:5px;overflow:hidden;margin:8px 0}.cr-hist span{flex:none;padding:4px 8px;border-radius:8px;font:400 11px "Russo One",Arial;background:rgba(2,6,23,.6)}' +
        '.cr-bets{display:flex;flex-direction:column;gap:4px;max-height:220px;overflow:auto}.cr-bet{display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 8px;border-radius:9px;background:rgba(2,6,23,.45)}.cr-bet .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-weight:700}.cr-bet .ok{color:#4ade80;font-weight:800}.cr-bet .no{color:#f87171}' +
        // колесо
        '.wh-wrap{position:relative;width:min(100%,360px);margin:0 auto}.wh-wrap canvas{display:block;width:100%;height:auto}.wh-ptr{position:absolute;left:50%;top:-4px;margin-left:-12px;width:0;height:0;border:12px solid transparent;border-top:22px solid #fde68a;filter:drop-shadow(0 2px 4px #000);z-index:2}' +
        '.wh-c{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;font:400 clamp(22px,4.5vw,34px) "Russo One",Arial;color:#fff;text-shadow:0 2px 10px #000}.wh-c small{font:700 11px Jura,Arial;color:#cbd5e1;letter-spacing:.08em}' +
        '.wh-bets{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.wh-b{padding:9px 4px;border-radius:12px;border:1px solid color-mix(in srgb,var(--c) 70%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--c) 45%,transparent),rgba(2,6,23,.85));color:#fff;cursor:pointer;text-align:center}' +
        '.wh-b b{display:block;font:400 18px "Russo One",Arial}.wh-b small{display:block;font-size:10.5px;color:#e2e8f0;margin-top:2px}.wh-b em{display:block;font-style:normal;font-size:10.5px;color:#fde68a;min-height:13px}.wh-b:disabled{opacity:.5;cursor:not-allowed}' +
        '.wh-hist{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.wh-hist i{width:16px;height:16px;border-radius:5px;display:block}' +
        // контракт / лотерея / скринька
        '.ct-slots{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:4px;margin:6px 0}.ct-slot{aspect-ratio:1;border-radius:9px;border:1px dashed rgba(148,163,184,.35);display:flex;align-items:center;justify-content:center}.ct-slot .sk-it{width:100%;height:100%}' +
        '.lt-big{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center}.lt-big div{padding:10px 6px;border-radius:12px;background:rgba(2,6,23,.5)}.lt-big b{display:block;font:400 clamp(16px,3vw,24px) "Russo One",Arial;color:#fde68a}.lt-big small{color:#a8a2c8;font-size:11px}' +
        '.lt-pr{display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:10px;background:rgba(2,6,23,.45);font-size:12.5px;margin-top:5px}.lt-pr b{font:400 16px "Russo One",Arial;width:24px;text-align:center}' +
        '.sk-hist{display:flex;flex-direction:column;gap:4px}.sk-hr{display:flex;gap:8px;align-items:center;font-size:12px;padding:5px 8px;border-radius:9px;background:rgba(2,6,23,.4)}.sk-hr .x{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cbd5e1}.sk-hr .p{color:#4ade80;font-weight:800}.sk-hr .m{color:#f87171;font-weight:800}' +
        // модальні вікна арени
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
        // вузький телефон: компактна шапка, батл на 3–4 гравців — по 2 колонки
        '@media (max-width:520px){.sk-hd{gap:5px}.sk-back{padding:8px 10px}.sk-back span:last-child{display:none}.sk-ttl h2{font-size:17px;letter-spacing:.08em}.sk-ttl small{font-size:9.5px}.sk-hbtn{padding:6px 8px;font-size:14px}.sk-bal{padding:6px 8px;font-size:12.5px}' +
        '.cb-cols{grid-template-columns:repeat(2,minmax(0,1fr))!important}.cb-top .sk-note{display:none}.sk-ft{font-size:10px}.sk-game{gap:7px}.sk-pz{margin-left:0;width:100%;justify-content:space-between}}' +
        '@media (orientation:landscape) and (max-height:520px){.sk-ttl small,.sk-ft p{display:none}.sk-hd{padding-top:5px}.cr-wrap canvas{height:190px}.cb-reel{height:74px}.cb-tape .sk-it{width:46px;height:46px}.sk-grid2{grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}}' +
        'html.gfx-low #stk-ov:before{display:none}html.gfx-low .sk-tab.on,html.gfx-low .sk-btn{box-shadow:none}';
    var sEl = document.createElement('style'); sEl.id = 'stk-css'; sEl.textContent = css; document.head.appendChild(sEl);

    // ================= КАРКАС =================
    var TABS = [['cb', '⚔️', 'Батл кейсів'], ['cf', '🪙', 'Койнфліп'], ['jp', '💰', 'Джекпот'], ['wh', '🎡', 'Колесо фортуни'], ['du', '🤝', 'Дуелі']];
    if (!TABS.some(function (t) { return t[0] === ST.tab; })) ST.tab = 'cb';
    var ov = null, body = null, loopRaf = 0;
    function build() {
        ov = document.createElement('div'); ov.id = 'stk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = '<header class="sk-hd"><button type="button" class="sk-back" data-a="close"><span>←</span> <span>Меню</span></button>' +
            '<div class="sk-ttl"><h2>ФОРТУНА</h2><small id="sk-lim"></small></div>' +
            '<button type="button" class="sk-hbtn" data-a="box" title="Скринька виграшу">🎁<i id="sk-boxn" style="display:none"></i></button>' +
            '<button type="button" class="sk-hbtn" data-a="hist" title="Історія ставок">📜</button>' +
            '<div class="sk-bal" id="sk-bal"></div></header>' +
            '<nav class="sk-tabs" role="tablist">' + TABS.map(function (t) { return '<button type="button" class="sk-tab" data-tab="' + t[0] + '"><i>' + t[1] + '</i><span>' + t[2] + '</span></button>'; }).join('') + '</nav>' +
            '<main class="sk-body" id="sk-body"></main>' +
            '<footer class="sk-ft"><span>🛡️</span><p>Лише ігрова валюта: кредити й предмети не мають грошової вартості, їх неможливо вивести чи обміняти на реальні гроші. Продаж акаунтів заборонено.</p><button type="button" data-a="rules">Правила</button><button type="button" data-a="fair">Чесність</button></footer>';
        document.body.appendChild(ov); body = $('sk-body');
        ov.addEventListener('click', onClick);
        ov.addEventListener('input', onInput);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov.classList.contains('on') && !document.querySelector('.sk-mod') && !(window.uiDialog && uiDialog.isOpen())) close(); });
    }
    function open(tab) {
        if (!ov) build();
        if (tab) ST.tab = tab;
        ov.classList.add('on'); socket.emit('stkHello'); paintHead(); render(); loop();
        if (ST.me && !ST.me.acc) setTimeout(rulesDlg, 200);
    }
    function close() { if (!ov) return; ov.classList.remove('on'); socket.emit('stkBye'); cancelAnimationFrame(loopRaf); loopRaf = 0; closeMod(); }
    function isOpen() { return !!ov && ov.classList.contains('on'); }
    function paintHead() {
        if (!ov) return;
        $('sk-bal').innerHTML = crI(bucks(), 16);
        var m = ST.me; $('sk-lim').textContent = m ? tt('Ставок сьогодні') + ': ' + m.n + ' / ' + m.max + ' · ' + tt('ставка') + ' ' + SI.MIN_BET + '–' + fmt(SI.MAX_BET) : '';
        var bx = $('sk-boxn'), n = m && m.prize ? m.prize.length : 0; bx.style.display = n ? '' : 'none'; bx.textContent = n;
        ov.querySelectorAll('.sk-tab').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === ST.tab); });
    }
    function setTab(t) { ST.tab = t; ST.view = null; try { localStorage.setItem('stkTab', t); } catch (e) {} paintHead(); render(); body.scrollTop = 0; }
    function render() {
        if (!isOpen()) return;
        var f = { cb: rCb, cf: rCf, jp: rJp, wh: rWh, du: rDu }[ST.tab] || rCb;
        if (ST.me && ST.me.lvl < SI.MIN_LEVEL && ST.tab !== 'du') { body.innerHTML = '<div class="sk-card sk-empty" style="margin-top:20px">🔒 ' + tt('Фортуна відкривається з') + ' <b>' + SI.MIN_LEVEL + '</b> ' + tt('рівня') + '.<br><br>' + tt('Грайте бої, щоб підвищити рівень!') + '</div>'; return; }
        f();
    }
    // постійний цикл анімацій лише для живих вкладок (краш, колесо, таймери)
    function loop() {
        cancelAnimationFrame(loopRaf);
        (function step() {
            if (!isOpen()) { loopRaf = 0; return; }
            try { tick(); } catch (e) { console.error(e); }
            loopRaf = requestAnimationFrame(step);
        })();
    }
    var lastTimerPaint = 0;
    function tick() {
        if (ST.tab === 'wh') whFrame();
        else if (ST.tab === 'cb' && ST.view) cbFrame();
        var t = performance.now(); if (t - lastTimerPaint > 250) { lastTimerPaint = t; paintTimers(); }
    }
    function paintTimers() {
        body.querySelectorAll('[data-until]').forEach(function (el) {
            var left = Math.max(0, (+el.dataset.until) - srvNow()), s = Math.ceil(left / 1000);
            var txt = left > 3600e3 ? Math.floor(left / 864e5) + tt('д') + ' ' + String(Math.floor(left % 864e5 / 36e5)).padStart(2, '0') + ':' + String(Math.floor(left % 36e5 / 6e4)).padStart(2, '0') : (Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'));
            if (el.textContent !== txt) el.textContent = txt;
        });
    }

    // ================= ВЗАЄМОДІЯ =================
    function emit(ev, d) { socket.emit(ev, d || {}); }
    function onClick(e) {
        var b = e.target.closest('[data-a],[data-tab]'); if (!b || b.disabled) return;
        if (b.dataset.tab) { snd('ui_click'); return setTab(b.dataset.tab); }
        var a = b.dataset.a, d = b.dataset;
        if (a !== 'mnc') snd('ui_click');
        switch (a) {
            case 'close': return close();
            case 'rules': return rulesDlg();
            case 'fair': return fairDlg();
            case 'box': return boxDlg();
            case 'hist': return histDlg();
            case 'cbnew': return cbNewDlg();
            case 'cbjoin': return guard(function () { emit('stkCbJoin', { id: d.id, slot: d.s != null ? +d.s : undefined }); });
            case 'cbleave': return emit('stkCbLeave', { id: d.id });
            case 'cbview': ST.view = d.id; return rCb();
            case 'cbback': ST.view = null; return rCb();
            case 'cfnew': return guard(function () { cfPick(null); });
            case 'cfjoin': return guard(function () { cfPick(d.id); });
            case 'cfcancel': return emit('stkCfCancel', { id: d.id });
            case 'cfview': ST.view = d.id; return rCf();
            case 'cfback': ST.view = null; return rCf();
            case 'amt': { var inp = $(d.for); if (!inp) return; var cur = +inp.value || 0, v = d.v === 'x2' ? cur * 2 : d.v === 'half' ? Math.floor(cur / 2) : d.v === 'max' ? Math.min(SI.MAX_BET, bucks()) : +d.v; inp.value = Math.max(SI.MIN_BET, Math.min(SI.MAX_BET, v)); return; }
            case 'jpbet': return guard(function () { emit('stkJpBet', { amt: +($('jp-amt').value) }); });
            case 'whbet': return guard(function () { emit('stkWhBet', { sect: d.k, amt: +($('wh-amt').value) }); });
            case 'friends': close(); if (window.Social && Social.open) Social.open('friends'); else { var t = $('sc-top'); if (t) t.click(); } return;
            case 'verify': return verify(d);
        }
    }
    function onInput() {}
    // перед ставкою — правила (один раз)
    function guard(fn) { if (ST.me && !ST.me.acc) return rulesDlg(fn); fn(); }
    function amtBox(id, def) {
        return '<div class="sk-in"><input id="' + id + '" type="number" inputmode="numeric" min="' + SI.MIN_BET + '" max="' + SI.MAX_BET + '" step="10" value="' + (def || 100) + '"></div>' +
            '<div class="sk-chips" style="margin-top:6px"><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="50">50</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="100">100</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="500">500</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="1000">1000</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="half">½</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="x2">×2</button><button type="button" class="sk-chip" data-a="amt" data-for="' + id + '" data-v="max">MAX</button></div>';
    }
    // збереження введених сум між перемальовуваннями
    function keepVals(fn) { var v = {}; ['jp-amt', 'wh-amt'].forEach(function (id) { var e = $(id); if (e) v[id] = e.value; }); fn(); Object.keys(v).forEach(function (id) { var e = $(id); if (e) e.value = v[id]; }); }

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
            '<li>' + tt('Фортуна — розважальний розділ гри. Усі ставки робляться лише ігровою валютою (кредити) та ігровими предметами.') + '</li>' +
            '<li><b>' + tt('Кредити й предмети не мають грошової вартості. Їх неможливо вивести з гри, обміняти чи продати за реальні гроші — ні через гру, ні через адміністрацію.') + '</b></li>' +
            '<li>' + tt('Продаж, купівля й передача акаунтів заборонені — за це акаунт блокується без повернення.') + '</li>' +
            '<li>' + tt('Доступ — з 3 рівня. Ставка — від') + ' ' + SI.MIN_BET + ' ' + tt('до') + ' ' + fmt(SI.MAX_BET) + ' ' + tt('кредитів, не більше') + ' ' + SI.DAILY + ' ' + tt('ставок на добу.') + '</li>' +
            '<li>' + tt('Комісія системи 5% — у дуелях, койнфліпі та джекпоті. У батлі кейсів комісії немає.') + '</li>' +
            '<li>' + tt('Результати визначає сервер і їх можна перевірити: до гри показується хеш секретного ключа, після — сам ключ (кнопка «Чесність»).') + '</li>' +
            '<li>' + tt('Програні кредити й предмети не повертаються. Якщо гру перервано технічно — ставка повертається автоматично.') + '</li>' +
            '<li>' + tt('Граючи, пам’ятайте: це гра на удачу. Робіть паузи й не ставте все одразу.') + '</li></ul>' +
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
    function fairRow(hash, ss, cs) {
        return '<div class="sk-fair"><b>' + tt('Хеш ключа') + ':</b> ' + esc(hash || '—') + (ss ? '<br><b>' + tt('Ключ') + ':</b> ' + esc(ss) : '<br><b>' + tt('Ключ') + ':</b> ' + tt('буде відкрито після гри')) + (cs ? '<br><b>' + tt('Сіль') + ':</b> ' + esc(cs) : '') + '</div>';
    }
    function fairDlg() {
        var rows = [];
        (ST.wh && ST.wh.hist || []).slice(0, 6).forEach(function (h) { rows.push({ k: 'wh', t: tt('Колесо фортуни') + ' ' + SI.sect(h.k).m + '×', hash: h.hash, ss: h.ss, cs: h.id, n: 'spin' }); });
        (ST.jp && ST.jp.hist || []).slice(0, 4).forEach(function (h) { rows.push({ k: 'jp', t: tt('Джекпот') + ' · ' + h.nick, hash: h.hash, ss: h.ss, cs: h.cs, n: 'win' }); });
        (ST.cfHist || []).slice(0, 4).forEach(function (h) { rows.push({ k: 'cf', t: tt('Койнфліп') + ' · ' + (h.win ? h[h.win].nick : ''), hash: h.hash, ss: h.ss, cs: h.cs, n: 'flip' }); });
        modal('<h3>🛡️ ' + tt('Перевірка чесності') + '</h3><p class="sk-note">' + tt('Перед кожною грою сервер фіксує секретний ключ і показує його SHA-256 хеш. Після гри ключ відкривається. Результат = HMAC-SHA256(ключ, сіль:номер) → число від 0 до 1. Натисніть «Перевірити» — ваш браузер сам перерахує результат.') + '</p>' +
            '<div class="sk-hist" style="margin-top:8px">' + (rows.length ? rows.map(function (r, i) { return '<div class="sk-hr" style="flex-direction:column;align-items:stretch"><div style="display:flex;gap:8px;align-items:center"><span class="x">' + esc(r.t) + '</span><button type="button" class="sk-btn sm ghost" data-m="v" data-i="' + i + '">' + tt('Перевірити') + '</button></div>' + fairRow(r.hash, r.ss, r.cs) + '<div class="sk-fair" id="fv-' + i + '"></div></div>'; }).join('') : '<div class="sk-empty">' + tt('Поки що немає завершених ігор') + '</div>') + '</div>' +
            '<div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button></div>',
            function (b) {
                if (b.dataset.m !== 'v') return; var r = rows[+b.dataset.i], out = $('fv-' + b.dataset.i); if (!r || !out) return;
                if (!r.ss) { out.textContent = tt('Ключ ще не відкрито'); return; }
                Promise.all([sha256(r.ss), hmacFloat(r.ss, r.cs, r.n)]).then(function (x) {
                    var okH = x[0] === r.hash, f = x[1], res = r.k === 'wh' ? SI.sect(SI.wheel[Math.floor(f * SI.wheel.length)]).m + '×' : f.toFixed(6);
                    out.innerHTML = (okH ? '✅ ' + tt('Хеш збігається') : '❌ ' + tt('Хеш НЕ збігається')) + ' · ' + tt('Результат') + ': <b style="color:#fde68a">' + esc(res) + '</b>';
                }).catch(function () { out.textContent = tt('Ваш браузер не підтримує перевірку (потрібне HTTPS-з’єднання)'); });
            });
    }
    function verify() { fairDlg(); }

    // ================= ІСТОРІЯ / СКРИНЬКА =================
    var KN = { cb: 'Батл кейсів', cf: 'Койнфліп', jp: 'Джекпот', wh: 'Колесо фортуни', du: 'Дуель', box: 'Скринька' };
    function histRows(list) {
        return list && list.length ? list.map(function (h) { return '<div class="sk-hr"><span>' + esc(tt(KN[h.k] || h.k)) + '</span><span class="x">' + esc(tt(h.x || '')) + '</span><span class="' + (h.d >= 0 ? 'p' : 'm') + '">' + (h.d > 0 ? '+' : '') + fmt(h.d) + '</span></div>'; }).join('') : '<div class="sk-empty">' + tt('Ще немає ставок') + '</div>';
    }
    function histDlg() { modal('<h3>📜 ' + tt('Історія ставок') + '</h3><div class="sk-hist">' + histRows(ST.me && ST.me.hist) + '</div><div class="sk-mbtns"><button type="button" class="sk-btn ghost" data-m="x">' + tt('Закрити') + '</button></div>'); }
    function boxDlg() {
        var P = (ST.me && ST.me.prize) || [], full = inv().length >= SI.INV_MAX;
        var h = '<h3>🎁 ' + tt('Скринька виграшу') + '</h3><p class="sk-note">' + tt('Сюди потрапляють виграні предмети, якщо інвентар повний (30). Заберіть, продайте за повну ціну або замініть ними непотрібний предмет з інвентарю.') + '</p>';
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

    // ================= БАТЛ КЕЙСІВ =================
    var CBM = { '1v1': '1×1', '2v2': '2×2', cheap: 'Хто дешевше', allin: 'Ва-банк' };
    var CBD = { '1v1': 'Хто вибив найдорожче — забирає все. Якщо за 30 с ніхто не сяде — зіграє бот.', '2v2': 'Дві команди по двоє: сума команди проти суми команди. Виграш ділиться між переможцями.', cheap: 'Навпаки: перемагає той, у кого сума найменша.', allin: 'Після кожного раунду той, хто вибив найдешевше, вибуває. Невідкриті кейси повертаються кредитами.' };
    function rCb() {
        if (ST.view) { var b = (ST.cb.list || []).filter(function (x) { return x.id === ST.view; })[0] || (ST.cbHist || []).filter(function (x) { return x.id === ST.view; })[0]; if (b) return cbViewHtml(b); ST.view = null; }
        var L = (ST.cb.list || []).slice().sort(function (a, b) { return (a.st === 'open' ? 0 : 1) - (b.st === 'open' ? 0 : 1) || b.at - a.at; });
        body.innerHTML = '<div class="sk-card"><div class="sk-h"><div><h3>⚔️ ' + tt('Батл кейсів') + '</h3><small>' + tt('Відкривайте однакові кейси одночасно — переможець забирає всі предмети') + '</small></div><button type="button" class="sk-btn gold" data-a="cbnew">＋ ' + tt('Створити') + '</button></div>' +
            '<div class="sk-list">' + (L.length ? L.map(cbRow).join('') : '<div class="sk-empty">' + tt('Відкритих батлів немає. Створіть свій!') + '</div>') + '</div></div>';
    }
    function cbRow(b) {
        var mine = b.slots.some(function (s) { return s && s.l === me(); }), creator = b.slots[0] && b.slots[0].l === me();
        var slots = b.slots.map(function (s, i) {
            var tc = b.mode === '2v2' ? ' t' + (i < b.n / 2 ? 0 : 1) : '';
            if (!s) return b.st === 'open' && !mine ? '<button type="button" class="sk-slot free' + tc + '" data-a="cbjoin" data-id="' + b.id + '" data-s="' + i + '">＋ ' + tt('Сісти') + '</button>' : '<span class="sk-slot free' + tc + '">…</span>';
            return '<span class="sk-slot' + tc + '">' + (s.bot ? '🤖 ' : '') + esc(s.nick) + '</span>';
        }).join('');
        var act = b.st === 'open' ? (mine ? '<button type="button" class="sk-btn sm ghost" data-a="cbleave" data-id="' + b.id + '">' + tt(creator ? 'Скасувати' : 'Вийти') + '</button>' : '<button type="button" class="sk-btn sm" data-a="cbjoin" data-id="' + b.id + '">' + tt('Грати') + ' ' + crI(b.price, 12) + '</button>') : '';
        return '<div class="sk-game' + (b.st !== 'open' ? ' run' : '') + (mine ? ' mine' : '') + '"><span class="sk-tag">' + esc(tt(CBM[b.mode])) + (b.mode === 'cheap' || b.mode === 'allin' ? ' · ' + b.n : '') + '</span>' +
            '<div class="sk-row">' + b.cases.map(function (c) { return caseHtml(c, 'sm'); }).join('') + '</div><div class="sk-slots">' + slots + '</div>' +
            '<div class="sk-pz"><small style="color:#a8a2c8">' + crI(b.price, 12) + '</small>' + act + (b.st !== 'open' || mine ? '<button type="button" class="sk-btn sm ghost" data-a="cbview" data-id="' + b.id + '">' + (b.st === 'open' ? '👁' : '▶ ' + tt('Дивитись')) + '</button>' : '') + '</div></div>';
    }
    function cbNewDlg() {
        guard(function () {
            var S = { mode: '1v1', n: 2, cases: [] };
            var ids = Object.keys(CASES).map(Number).sort(function (a, b) { return CASES[a].price - CASES[b].price; });
            function draw() {
                var M0 = SI.CB.MODES[S.mode], price = S.cases.reduce(function (s, c) { return s + CASES[c].price; }, 0), ok = S.cases.length && price >= SI.MIN_BET && price <= SI.MAX_BET && price <= bucks();
                var h = '<h3>⚔️ ' + tt('Новий батл кейсів') + '</h3><span class="sk-lbl">' + tt('Режим') + '</span><div class="sk-chips">' + Object.keys(CBM).map(function (k) { return '<button type="button" class="sk-chip' + (S.mode === k ? ' on' : '') + '" data-m="mode" data-v="' + k + '">' + esc(tt(CBM[k])) + '</button>'; }).join('') + '</div>' +
                    '<p class="sk-note" style="margin-top:6px">' + tt(CBD[S.mode]) + '</p>' +
                    (M0.n[0] !== M0.n[1] ? '<span class="sk-lbl">' + tt('Гравців') + '</span><div class="sk-chips">' + [2, 3, 4].map(function (n) { return '<button type="button" class="sk-chip' + (S.n === n ? ' on' : '') + '" data-m="n" data-v="' + n + '">' + n + '</button>'; }).join('') + '</div>' : '') +
                    '<span class="sk-lbl">' + tt('Кейси') + ' (' + S.cases.length + '/' + SI.CB.MAX_CASES + ') — ' + tt('по одному на раунд') + '</span><div class="sk-row" style="min-height:52px;padding:4px;border-radius:12px;background:rgba(2,6,23,.45)">' + (S.cases.length ? S.cases.map(function (c, i) { return '<div style="position:relative" data-m="rm" data-i="' + i + '">' + caseHtml(c, 'pick') + '<span class="sk-x" style="position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:#e11d48;color:#fff;font:700 10px/16px Arial;text-align:center">×</span></div>'; }).join('') : '<span class="sk-note">' + tt('Натисніть на кейси нижче') + '</span>') + '</div>' +
                    '<div class="sk-row" style="margin-top:8px;max-height:min(34vh,260px);overflow:auto">' + ids.map(function (c) { var cs = CASES[c]; return '<div data-m="add" data-c="' + c + '" style="display:flex;flex-direction:column;align-items:center;width:64px;cursor:pointer;font-size:9.5px;color:#cbd5e1;text-align:center">' + caseHtml(c, 'pick') + '<b style="color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:64px">' + esc(tt(cs.name)) + '</b><span style="color:#fde68a">' + cs.price + '</span></div>'; }).join('') + '</div>' +
                    '<div class="sk-mbtns" style="align-items:center"><span class="sk-note" style="margin-right:auto">' + tt('Вхід') + ': ' + crI(price) + (price > SI.MAX_BET ? ' <span style="color:#f87171">(' + tt('макс.') + ' ' + fmt(SI.MAX_BET) + ')</span>' : '') + '</span><button type="button" class="sk-btn ghost" data-m="x">' + tt('Скасувати') + '</button><button type="button" class="sk-btn gold" data-m="go"' + (ok ? '' : ' disabled') + '>' + tt('Створити') + '</button></div>';
                modEl.querySelector('.sk-mbox').innerHTML = h;
            }
            modal('', function (b) {
                var m = b.dataset.m;
                if (m === 'mode') { S.mode = b.dataset.v; var M0 = SI.CB.MODES[S.mode]; S.n = Math.max(M0.n[0], Math.min(M0.n[1], S.n)); if (M0.n[0] === M0.n[1]) S.n = M0.n[0]; }
                else if (m === 'n') S.n = +b.dataset.v;
                else if (m === 'add') { if (S.cases.length < SI.CB.MAX_CASES) S.cases.push(+b.dataset.c); else toast('Не більше ' + SI.CB.MAX_CASES + ' кейсів', true); }
                else if (m === 'rm') S.cases.splice(+b.dataset.i, 1);
                else if (m === 'go') { emit('stkCbNew', { mode: S.mode, n: S.n, cases: S.cases }); closeMod(); return; }
                draw();
            });
            draw();
        });
    }
    // ---- перегляд батлу: колонки гравців з рулетками ----
    var cbAnim = { id: null, k: -1, built: false };
    function cbSig(b) { return (b.st === 'open' ? 'o' : b.st === 'done' ? 'd' : 'r') + b.slots.map(function (s) { return s ? s.nick : '-'; }).join('|'); }
    function cbViewHtml(b) {
        var cols = b.n <= 2 ? 2 : b.n;
        body.innerHTML = '<div class="sk-card cb-v" data-cb="' + b.id + '"><div class="cb-top"><button type="button" class="sk-btn sm ghost" data-a="cbback">← ' + tt('До списку') + '</button><span class="sk-tag">' + esc(tt(CBM[b.mode])) + '</span><div class="cb-rd" id="cb-rd">' + b.cases.map(function (c, k) { return caseHtml(c, 'sm').replace('sk-case sm', 'sk-case sm r' + k); }).join('') + '</div><small class="sk-note" style="margin-left:auto">' + tt('Вхід') + ' ' + crI(b.price, 12) + '</small></div>' +
            '<div class="cb-res" id="cb-res"></div>' +
            '<div class="cb-cols" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + b.slots.map(function (s, i) {
                return '<div class="cb-col' + (b.mode === '2v2' ? ' t' + (i < b.n / 2 ? 0 : 1) : '') + '" id="cbc-' + i + '"><div class="cb-pl"><span>' + (s ? (s.bot ? '🤖 ' : '') + esc(s.nick) : '…') + '</span><b class="cb-sum" id="cbs-' + i + '">0</b></div>' +
                    '<div class="cb-reel"><div class="cb-tape" id="cbt-' + i + '"></div><div class="cb-mk"></div></div><div class="cb-won" id="cbw-' + i + '"></div></div>';
            }).join('') + '</div>' + fairRow(b.hash, b.ss, b.cs) + '</div>';
        cbAnim = { id: b.id, k: -1, shown: {}, done: false, sig: cbSig(b) };
        cbFrame();
    }
    function cbFrame() {
        var b = (ST.cb.list || []).filter(function (x) { return x.id === ST.view; })[0] || (ST.cbHist || []).filter(function (x) { return x.id === ST.view; })[0];
        if (!b || !$('cb-res')) return;
        if (cbAnim.id !== b.id || cbAnim.sig !== cbSig(b)) return cbViewHtml(b);      // хтось сів / вийшов / батл стартував — перебудовуємо колонки
        if (b.st === 'open') { var free = b.slots.filter(function (s) { return !s; }).length; var r = $('cb-res'), tx = tt('Чекаємо гравців') + '… (' + (b.n - free) + '/' + b.n + ')'; if (r.textContent !== tx) r.textContent = tx; return; }
        if (!b.rounds) return;
        var t = srvNow() - b.t0, R = SI.CB.ROUND_MS, k = b.st === 'done' && !cbAnim.live ? b.rounds.length : Math.floor(t / R);
        if (t < 0) { var rr = $('cb-res'), s0 = Math.ceil(-t / 1000), tx0 = tt('Старт через') + ' ' + s0; if (rr.textContent !== tx0) rr.textContent = tx0; return; }
        cbAnim.live = true;
        var kk = Math.min(k, b.rounds.length);
        if (!cbAnim.done) { var rt = $('cb-res'), txr = tt('Раунд') + ' ' + Math.min(kk + 1, b.rounds.length) + ' / ' + b.rounds.length; if (rt.textContent !== txr) rt.textContent = txr; }
        // новий раунд — запускаємо рулетки
        if (kk < b.rounds.length && cbAnim.k !== kk) { cbAnim.k = kk; cbSpin(b, kk, Math.max(0, t - kk * R)); }
        // показати завершені раунди (рулетка зупиняється на ~4.2 с)
        for (var q = 0; q < b.rounds.length; q++) {
            var revealAt = q * R + 4300; if (t < revealAt || cbAnim.shown[q]) continue; cbAnim.shown[q] = 1;
            b.rounds[q].forEach(function (id, i) { if (!id) return; var w = $('cbw-' + i); if (w) w.insertAdjacentHTML('beforeend', item(id, 'sm')); });
            var sums = b.slots.map(function (s, i) { var v = 0; for (var z = 0; z <= q; z++) if (b.rounds[z][i]) v += priceOf(b.rounds[z][i]); return v; });
            sums.forEach(function (v, i) { var e = $('cbs-' + i); if (e) e.textContent = fmt(v); });
            if (b.elim) b.elim.forEach(function (e, i) { if (e === q) { var c = $('cbc-' + i); if (c) c.classList.add('out'); } });
            usnd('reveal_rare', { force: true });
        }
        var rd = $('cb-rd'); if (rd) rd.querySelectorAll('.sk-case').forEach(function (c, i) { c.classList.toggle('cur', i === kk); c.classList.toggle('past', i < kk); });
        if (t >= b.rounds.length * R - R + 4400 && b.win && !cbAnim.done) {
            cbAnim.done = true;
            b.win.forEach(function (i) { var c = $('cbc-' + i); if (c) c.classList.add('win'); });
            var mineWin = b.win.some(function (i) { return b.slots[i] && b.slots[i].l === me(); }), mineIn = b.slots.some(function (s) { return s && s.l === me(); });
            var tot = 0; b.rounds.forEach(function (row) { row.forEach(function (id) { if (id) tot += priceOf(id); }); });
            $('cb-res').innerHTML = (mineIn ? (mineWin ? '🏆 ' + tt('ВИ ПЕРЕМОГЛИ!') : '💀 ' + tt('Поразка')) : '🏆 ' + esc(b.win.map(function (i) { return b.slots[i].nick; }).join(' + '))) + ' · ' + crI(tot, 18);
            if (mineIn) snd(mineWin ? 'powerup' : 'ui_click');
        }
    }
    function cbSpin(b, k, elapsed) {
        var cs = G('CASES') && CASES[b.cases[k]], pool = cs && window.GameData ? GameData.casePool(cs) : Object.keys(G('MODULES') || {});
        b.rounds[k].forEach(function (id, i) {
            var tp = $('cbt-' + i); if (!tp) return;
            if (!id) { tp.innerHTML = ''; return; }
            var N = 26, h = '';
            for (var z = 0; z < N; z++) h += item(z === N - 3 ? id : pool[Math.floor(Math.random() * pool.length)]);
            tp.innerHTML = h; tp.style.transition = 'none';
            var it = tp.firstElementChild, H = it ? it.offsetHeight + 4 : 62, reel = tp.parentElement.offsetHeight;
            tp.style.marginLeft = -(it ? it.offsetWidth / 2 : 29) + 'px';
            var end = -((N - 3) * H + H / 2 - reel / 2), dur = Math.max(200, 4200 - elapsed);
            tp.style.transform = 'translateY(0px)'; void tp.offsetWidth;
            tp.style.transition = 'transform ' + dur + 'ms cubic-bezier(.12,.75,.2,1)'; tp.style.transform = 'translateY(' + end + 'px)';
        });
        if (elapsed < 400) usnd('roll_start', { force: true });
    }

    // ================= КОЙНФЛІП =================
    function rCf() {
        if (ST.view) { var f = (ST.cf.list || []).filter(function (x) { return x.id === ST.view; })[0] || (ST.cfHist || []).filter(function (x) { return x.id === ST.view; })[0]; if (f) return cfViewHtml(f); ST.view = null; }
        var L = (ST.cf.list || []).slice().sort(function (a, b) { return (a.st === 'open' ? 0 : 1) - (b.st === 'open' ? 0 : 1) || b.a.val - a.a.val; });
        body.innerHTML = '<div class="sk-card"><div class="sk-h"><div><h3>🪙 ' + tt('Койнфліп') + '</h3><small>' + tt('Ставка — лише предмети. Суперник ставить предмети на суму ±150. Шанс — пропорційно вашій сумі. Комісія 5% кредитами.') + '</small></div><button type="button" class="sk-btn gold" data-a="cfnew">＋ ' + tt('Створити') + '</button></div>' +
            '<div class="sk-list">' + (L.length ? L.map(cfRow).join('') : '<div class="sk-empty">' + tt('Немає відкритих ставок. Створіть свою!') + '</div>') + '</div></div>';
    }
    function cfRow(f) {
        var mine = f.a.l === me(), items = f.a.items.slice(0, 6).map(function (id) { return item(id, 'sm'); }).join('') + (f.a.items.length > 6 ? '<span class="sk-note">+' + (f.a.items.length - 6) + '</span>' : '');
        var act = f.st === 'open' ? (mine ? '<button type="button" class="sk-btn sm ghost" data-a="cfcancel" data-id="' + f.id + '">' + tt('Скасувати') + '</button>' : '<button type="button" class="sk-btn sm" data-a="cfjoin" data-id="' + f.id + '">' + tt('Грати') + '</button>') : '<button type="button" class="sk-btn sm ghost" data-a="cfview" data-id="' + f.id + '">▶ ' + tt('Дивитись') + '</button>';
        return '<div class="sk-game' + (f.st !== 'open' ? ' run' : '') + (mine ? ' mine' : '') + '"><span class="cf-dot ' + f.a.side + '"></span><b style="color:#fff;font-size:12.5px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(f.a.nick) + '</b><div class="sk-row">' + items + '</div>' +
            '<div class="sk-pz"><small style="color:#a8a2c8;text-align:right">' + crI(f.a.val, 12) + '<br>' + tt('потрібно') + ' ' + fmt(Math.max(SI.MIN_BET, f.a.val - SI.CF.DIFF)) + '–' + fmt(Math.min(SI.MAX_BET, f.a.val + SI.CF.DIFF)) + '</small>' + act + '</div></div>';
    }
    // вибір предметів для ставки (join=id — приєднання до чужої)
    function cfPick(joinId) {
        var f = joinId ? (ST.cf.list || []).filter(function (x) { return x.id === joinId; })[0] : null; if (joinId && !f) return;
        var sel = [], side = 'b';
        function draw() {
            var I = inv(), v = sel.reduce(function (s, j) { return s + priceOf(I[j]); }, 0), fee = Math.ceil(v * SI.FEE);
            var okV = f ? Math.abs(v - f.a.val) <= SI.CF.DIFF && v >= SI.MIN_BET && v <= SI.MAX_BET : v >= SI.MIN_BET && v <= SI.MAX_BET;
            var h = '<h3>🪙 ' + (f ? tt('Прийняти виклик') + ' · ' + esc(f.a.nick) : tt('Новий койнфліп')) + '</h3>' +
                (f ? '<p class="sk-note">' + tt('Суперник поставив') + ' ' + crI(f.a.val) + '. ' + tt('Ваша сума має бути від') + ' <b>' + fmt(f.a.val - SI.CF.DIFF) + '</b> ' + tt('до') + ' <b>' + fmt(f.a.val + SI.CF.DIFF) + '</b>.</p>' :
                    '<span class="sk-lbl">' + tt('Ваша сторона монети') + '</span><div class="sk-chips"><button type="button" class="sk-chip' + (side === 'b' ? ' on' : '') + '" data-m="side" data-v="b"><span class="cf-dot b"></span>' + tt('Синя') + '</button><button type="button" class="sk-chip' + (side === 'o' ? ' on' : '') + '" data-m="side" data-v="o"><span class="cf-dot o"></span>' + tt('Помаранчева') + '</button></div>') +
                '<span class="sk-lbl">' + tt('Ваші предмети') + ' (' + sel.length + '/' + SI.CF.MAX_ITEMS + ') — ' + tt('вдягнені модулі не беруть участі') + '</span>' +
                (I.length ? '<div class="sk-inv">' + I.map(function (id, j) { return '<div data-m="t" data-j="' + j + '">' + item(id, 'pick' + (sel.indexOf(j) >= 0 ? ' sel' : '')) + '</div>'; }).join('') + '</div>' : '<div class="sk-empty">' + tt('Інвентар порожній') + '</div>') +
                '<div class="sk-mbtns" style="align-items:center"><span class="sk-note" style="margin-right:auto">' + tt('Сума') + ': ' + crI(v) + ' · ' + tt('комісія') + ' ' + crI(fee, 12) + '</span><button type="button" class="sk-btn ghost" data-m="x">' + tt('Скасувати') + '</button><button type="button" class="sk-btn gold" data-m="go"' + (okV && sel.length && fee <= bucks() ? '' : ' disabled') + '>' + tt(f ? 'Грати' : 'Створити') + '</button></div>';
            modEl.querySelector('.sk-mbox').innerHTML = h;
        }
        modal('', function (b) {
            var m = b.dataset.m;
            if (m === 'side') side = b.dataset.v;
            else if (m === 't') { var j = +b.dataset.j, p = sel.indexOf(j); if (p >= 0) sel.splice(p, 1); else if (sel.length < SI.CF.MAX_ITEMS) sel.push(j); }
            else if (m === 'go') { var I = inv(), ids = sel.map(function (j) { return I[j]; }); if (f) emit('stkCfJoin', { id: f.id, items: ids }); else emit('stkCfNew', { items: ids, side: side }); ST.view = f ? f.id : null; closeMod(); return; }
            draw();
        });
        draw();
    }
    var cfAnim = {};
    function cfViewHtml(f) {
        var tot = f.a.val + (f.b ? f.b.val : 0), ch = function (x) { return x && tot ? Math.round(x.val / tot * 1000) / 10 : 0; };
        var side = function (x, key) { if (!x) return '<div class="cf-side"><b>…</b><small>' + tt('чекаємо суперника') + '</small></div>'; return '<div class="cf-side" id="cfs-' + key + '"><span class="cf-dot ' + x.side + '"></span><b>' + esc(x.nick) + '</b><small>' + crI(x.val, 12) + ' · ' + ch(x) + '%</small><div class="sk-row" style="justify-content:center;margin-top:6px">' + x.items.map(function (id) { return item(id, 'sm'); }).join('') + '</div></div>'; };
        body.innerHTML = '<div class="sk-card"><div class="cb-top"><button type="button" class="sk-btn sm ghost" data-a="cfback">← ' + tt('До списку') + '</button><span class="cb-res" id="cf-res" style="flex:1"></span></div>' +
            '<div class="cf-arena">' + side(f.a, 'a') + '<div class="cf-coin"><div class="cf-c" id="cf-c"><div class="cf-f b">◆</div><div class="cf-f o">◆</div></div></div>' + side(f.b, 'b') + '</div>' + fairRow(f.hash, f.ss, f.cs) + '</div>';
        if (f.st !== 'open' && f.win) {
            var winSide = f[f.win].side, c = $('cf-c'), left = f.t0 + SI.CF.SPIN_MS - srvNow(), turns = 8 * 360 + (winSide === 'o' ? 180 : 0);
            if (cfAnim[f.id] || left <= 0) { c.style.transform = 'rotateY(' + turns + 'deg)'; cfDone(f); }
            else { cfAnim[f.id] = 1; c.style.transform = 'rotateY(0deg)'; void c.offsetWidth; c.style.transition = 'transform ' + Math.max(300, left) + 'ms cubic-bezier(.15,.7,.2,1)'; c.style.transform = 'rotateY(' + turns + 'deg)'; usnd('roll_start', { force: true }); setTimeout(function () { if ($('cf-c')) cfDone(f); }, Math.max(300, left)); }
        }
    }
    function cfDone(f) {
        var W = f[f.win], L = f[f.win === 'a' ? 'b' : 'a'], r = $('cf-res'); if (!r) return;
        var s = $('cfs-' + f.win), o = $('cfs-' + (f.win === 'a' ? 'b' : 'a')); if (s) s.classList.add('win'); if (o) o.classList.add('lose');
        r.innerHTML = (W.l === me() ? '🏆 ' + tt('ВИ ПЕРЕМОГЛИ!') : L.l === me() ? '💀 ' + tt('Поразка') : '🏆 ' + esc(W.nick)) + ' · ' + crI(f.a.val + f.b.val, 16);
        if (!cfAnim['s' + f.id]) { cfAnim['s' + f.id] = 1; if (W.l === me()) snd('powerup'); }
    }

    // ================= ДЖЕКПОТ =================
    var COLS = ['#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#eab308', '#6366f1', '#14b8a6', '#ef4444', '#8b5cf6', '#0ea5e9', '#d946ef', '#10b981', '#f97316', '#64748b', '#facc15', '#2dd4bf'];
    var jpAnim = { id: null };
    function rJp() {
        var J = ST.jp; if (!J) { body.innerHTML = '<div class="sk-empty">…</div>'; return; }
        var ps = J.players || [], mine = ps.filter(function (p) { return p.l === me(); })[0];
        keepVals(function () {
            body.innerHTML = '<div class="sk-grid2"><div class="sk-card"><div class="sk-h"><h3>💰 ' + tt('Джекпот') + '</h3><small>' + tt('Шанс = ваша частка котла. Переможець забирає все (−5%).') + '</small></div>' +
                '<div class="jp-pot"><small>' + tt('У котлі') + '</small><big>' + crI(J.total, 30) + '</big><small>' + (J.st === 'open' ? (J.endAt ? tt('Розіграш через') + ' <b data-until="' + J.endAt + '"></b>' : tt('Таймер стартує, коли в котлі буде 2 гравці')) : J.st === 'spin' ? tt('Розіграш!') : tt('Переможець визначений')) + '</small></div>' +
                '<div class="jp-bar">' + ps.map(function (p, i) { return '<i style="width:' + (J.total ? p.amt / J.total * 100 : 0) + '%;background:' + COLS[i % COLS.length] + '"></i>'; }).join('') + '</div>' +
                '<div class="jp-strip" id="jp-strip"' + (J.st === 'open' ? ' style="display:none"' : '') + '><div class="jp-tape" id="jp-tape"></div><div class="cb-mk"></div></div>' +
                '<div class="cb-res" id="jp-res">' + (J.st === 'done' && J.win ? '🏆 ' + esc(J.win.nick) + ' · ' + crI(J.win.amt, 18) : '') + '</div>' +
                '<div class="sk-list" style="gap:4px">' + (ps.length ? ps.map(function (p, i) { return '<div class="jp-pl"><span class="cl" style="background:' + COLS[i % COLS.length] + '"></span><span class="nm">' + esc(p.nick) + '</span><span>' + crI(p.amt, 12) + '</span><span class="ch">' + (J.total ? (p.amt / J.total * 100).toFixed(1) : 0) + '%</span></div>'; }).join('') : '<div class="sk-empty">' + tt('Котел порожній — зробіть першу ставку!') + '</div>') + '</div>' + fairRow(J.hash, J.ss, J.st === 'done' ? J.id : null) + '</div>' +
                '<div class="sk-card"><div class="sk-h"><h3>' + tt('Ваша ставка') + '</h3>' + (mine ? '<small>' + tt('у котлі') + ': ' + crI(mine.amt, 12) + '</small>' : '') + '</div>' + amtBox('jp-amt', 100) +
                '<button type="button" class="sk-btn gold" style="width:100%;margin-top:10px" data-a="jpbet"' + (J.st === 'open' ? '' : ' disabled') + '>' + tt('Кинути в котел') + '</button>' +
                '<p class="sk-note" style="margin-top:8px">' + tt('Від одного гравця — до') + ' ' + fmt(SI.JP.MAX_PLAYER) + ' ' + tt('кредитів за раунд. Раунд триває') + ' ' + (SI.JP.MS / 1000) + ' ' + tt('с після появи другого гравця.') + '</p>' +
                '<span class="sk-lbl">' + tt('Останні переможці') + '</span><div class="sk-hist">' + ((J.hist || []).length ? J.hist.map(function (h) { return '<div class="sk-hr"><span class="x">🏆 ' + esc(h.nick) + ' · ' + h.ch + '%</span><span class="p">' + fmt(h.amt) + '</span></div>'; }).join('') : '<div class="sk-empty">—</div>') + '</div></div></div>';
        });
        if (J.st === 'spin' || (J.st === 'done' && jpAnim.id === J.id)) jpSpin(J);
    }
    function jpSpin(J) {
        var tape = $('jp-tape'), strip = $('jp-strip'); if (!tape || !J.win) return;
        var ps = J.players || [], N = 60, WIN = 52, h = '', wi = 0;
        ps.forEach(function (p, i) { if (p.l === J.win.l) wi = i; });
        // плитки пропорційно шансу
        var bag = []; ps.forEach(function (p, i) { var n = Math.max(1, Math.round(p.amt / J.total * 20)); for (var z = 0; z < n; z++) bag.push(i); });
        var seq = []; for (var z = 0; z < N; z++) seq.push(z === WIN ? wi : bag[Math.floor(Math.random() * bag.length)]);
        tape.innerHTML = seq.map(function (i) { return '<div class="jp-tile" style="background:' + COLS[i % COLS.length] + '">' + esc(ps[i].nick) + '</div>'; }).join('');
        var it = tape.firstElementChild, W = it ? it.offsetWidth + 4 : 80, cw = strip.offsetWidth, end = -(WIN * W + W / 2 - cw / 2) + (Math.random() - 0.5) * W * 0.5;
        var left = J.spinAt + SI.JP.SPIN_MS - 400 - srvNow();
        if (jpAnim.id === J.id || left <= 100) { tape.style.transition = 'none'; tape.style.transform = 'translateX(' + end + 'px)'; jpAnim.id = J.id; return; }
        jpAnim.id = J.id; tape.style.transition = 'none'; tape.style.transform = 'translateX(0px)'; void tape.offsetWidth;
        tape.style.transition = 'transform ' + left + 'ms cubic-bezier(.1,.7,.15,1)'; tape.style.transform = 'translateX(' + end + 'px)';
        if (window.UISFX && UISFX.roll) UISFX.roll(tape);
    }

    // ================= КОЛЕСО =================
    var whCv = null, whG = null, whRot = 0, whSpin = null;
    function rWh() {
        var Wh = ST.wh; if (!Wh) { body.innerHTML = '<div class="sk-empty">…</div>'; return; }
        keepVals(function () {
            body.innerHTML = '<div class="sk-grid2"><div class="sk-card"><div class="sk-h"><h3>🎡 ' + tt('Колесо фортуни') + '</h3><small>' + tt('Один спільний оберт кожні 30 с') + '</small></div>' +
                '<div class="wh-wrap"><div class="wh-ptr"></div><canvas id="wh-cv" width="520" height="520"></canvas><div class="wh-c" id="wh-c"></div></div>' +
                '<div class="wh-hist">' + (Wh.hist || []).map(function (h) { return '<i style="background:' + SI.sect(h.k).c + '" title="×' + SI.sect(h.k).m + '"></i>'; }).join('') + '</div>' + fairRow(Wh.hash, Wh.ss, Wh.st === 'done' ? Wh.id : null) + '</div>' +
                '<div class="sk-card"><div class="sk-h"><h3>' + tt('Ставка') + '</h3></div>' + amtBox('wh-amt', 100) +
                '<span class="sk-lbl">' + tt('Оберіть сектор') + '</span><div class="wh-bets">' + SI.WH.SECT.map(function (s) {
                    var ch = (s.n / SI.wheel.length * 100).toFixed(1);
                    return '<button type="button" class="wh-b" style="--c:' + s.c + '" data-a="whbet" data-k="' + s.id + '"' + (Wh.st === 'bet' ? '' : ' disabled') + '><b>×' + s.m + '</b><small>' + ch + '%</small><small>Σ ' + fmt(Wh.tot ? Wh.tot[s.id] : 0) + '</small></button>';
                }).join('') + '</div>' +
                '<p class="sk-note" style="margin-top:8px">' + tt('Можна ставити на кілька секторів. Виграш = ставка × множник сектора.') + '</p>' +
                '<span class="sk-lbl">' + tt('Ставки') + '</span><div class="cr-bets">' + ((Wh.list || []).length ? Wh.list.slice().reverse().map(function (b) { return '<div class="cr-bet"><i style="width:10px;height:10px;border-radius:3px;background:' + SI.sect(b.k).c + '"></i><span class="nm">' + esc(b.nick) + '</span><span>' + crI(b.amt, 11) + '</span></div>'; }).join('') : '<div class="sk-empty">' + tt('Ставок ще немає') + '</div>') + '</div></div></div>';
        });
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
        var Wh = ST.wh; if (!Wh || !whCv || !document.body.contains(whCv)) return;
        var n = SI.wheel.length, a = Math.PI * 2 / n, t = srvNow();
        if (Wh.st !== 'bet' && Wh.idx != null) {
            var target = -Wh.idx * a, el = t - Wh.spinAt, k = Math.min(1, Math.max(0, el / (SI.WH.SPIN - 300)));
            if (!whSpin || whSpin.id !== Wh.id) whSpin = { id: Wh.id, from: whRot % (Math.PI * 2), to: target - 6 * Math.PI * 2 };
            var e = 1 - Math.pow(1 - k, 4); whRot = whSpin.from + (whSpin.to - whSpin.from) * e;
            if (k >= 1 && !whSpin.sd) { whSpin.sd = 1; var s0 = SI.sect(SI.wheel[Wh.idx]); usnd(s0.m >= 50 ? 'reveal_legendary' : 'reveal_rare', { force: true }); }
        }
        whDraw(whRot);
        var c = $('wh-c'), txt;
        if (Wh.st === 'bet') txt = '<small>' + tt('Оберт через') + '</small>' + Math.max(0, Math.ceil((Wh.spinAt - t) / 1000));
        else { var s = SI.sect(SI.wheel[Wh.idx]); txt = (t - Wh.spinAt > SI.WH.SPIN - 400 ? '<span style="color:' + s.c + '">×' + s.m + '</span>' : '…') + '<small>' + tt('Наступний оберт скоро') + '</small>'; }
        if (c.__t !== txt) { c.__t = txt; c.innerHTML = txt; }
    }

    // ================= ДУЕЛІ =================
    function rDu() {
        var H = (ST.me && ST.me.hist || []).filter(function (h) { return h.k === 'du'; });
        body.innerHTML = '<div class="sk-grid2"><div class="sk-card"><div class="sk-h"><h3>🤝 ' + tt('Дуелі з друзями') + '</h3></div>' +
            '<p class="sk-note">' + tt('Викликайте друга на дуель 1×1 зі ставкою в кредитах. Ви обираєте арену, кількість раундів і час раунду. Переможець забирає банк (комісія 5%), предмети в дуелі не випадають. Хто покине бій — програє.') + '</p>' +
            '<ol class="sk-note" style="padding-left:18px"><li>' + tt('Відкрийте 👥 Друзі') + '</li><li>' + tt('Біля друга в мережі натисніть «💰 Дуель»') + '</li><li>' + tt('Налаштуйте бій і надішліть виклик') + '</li></ol>' +
            '<button type="button" class="sk-btn gold" data-a="friends">👥 ' + tt('Відкрити друзів') + '</button>' +
            '<p class="sk-note" style="margin-top:8px">' + tt('З одним другом — не більше') + ' ' + SI.DU.PAIR_MAX + ' ' + tt('дуелей на добу. Дуелі між акаунтами з однієї мережі заборонені.') + '</p></div>' +
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
    socket.on('stkState', function (d) {
        if (!d) return; syncT(d); ST.me = d.me; ST.cb = d.cb || ST.cb; ST.cf = d.cf || ST.cf; ST.jp = d.jp; ST.wh = d.wh; ST.cbHist = d.cbHist || []; ST.cfHist = d.cfHist || [];
        if (d.me && d.me.news && d.me.news.length) d.me.news.forEach(function (n) { toast(n.x); });
        paintHead(); render(); if (ST.me && !ST.me.acc && isOpen()) rulesDlg();
    });
    socket.on('stkMe', function (d) {
        if (!d) return; var was = ST.me; ST.me = d;
        if (d.news && d.news.length) d.news.forEach(function (n) { if (window.uiDialog) uiDialog.show({ kind: 'success', icon: '🎰', title: tt('Фортуна'), text: n.x }); });
        paintHead(); if (ST.tab === 'du') render();
    });
    socket.on('stkMsg', function (d) { if (d && d.t) { toast(d.t, d.bad); if (d.bad) snd('ui_error'); } });
    socket.on('stkMsgAll', function (d) { if (d && d.t && isOpen()) toast(d.t); });
    socket.on('stkOk', function (d) { if (!d) return; if (d.ev === 'stkCbNew' || d.ev === 'stkCbJoin') { snd('ui_buy'); } if (d.ev === 'stkPrize') boxDlg(); if (d.ev === 'stkCfNew') toast('Койнфліп створено — чекаємо суперника'); });
    socket.on('stk_cb', function (d) { if (!d) return; syncT(d); var prev = ST.cb; ST.cb = d;
        // мій батл щойно стартував — відкриваємо перегляд
        (d.list || []).forEach(function (b) { if (b.st === 'run' && b.slots.some(function (s) { return s && s.l === me(); })) { var p = (prev.list || []).filter(function (x) { return x.id === b.id; })[0]; if (p && p.st === 'open' && isOpen() && ST.tab === 'cb') ST.view = b.id; } });
        if (isOpen() && ST.tab === 'cb') { if (ST.view) cbFrame(); if (!ST.view || !$('cb-res')) rCb(); else { var v = (d.list || []).filter(function (x) { return x.id === ST.view; })[0]; if (v && v.st === 'open') cbViewHtml(v); } } });
    socket.on('stk_cf', function (d) { if (!d) return; syncT(d); var prev = ST.cf; ST.cf = d;
        (d.list || []).forEach(function (f) { if (f.st === 'run' && (f.a.l === me() || (f.b && f.b.l === me()))) { var p = (prev.list || []).filter(function (x) { return x.id === f.id; })[0]; if ((!p || p.st === 'open') && isOpen() && ST.tab === 'cf') ST.view = f.id; } });
        if (isOpen() && ST.tab === 'cf') { var cur = ST.view && (d.list || []).filter(function (x) { return x.id === ST.view; })[0]; if (cur && cfAnim[cur.id]) return; rCf(); } });
    socket.on('stk_jp', function (d) { if (!d) return; syncT(d); var was = ST.jp; ST.jp = d; if (isOpen() && ST.tab === 'jp') { if (was && was.st === 'spin' && d.st === 'spin' && jpAnim.id === d.id) return; rJp(); }
        if (d.st === 'done' && d.win && d.win.l === me() && (!was || was.st !== 'done')) { snd('powerup'); toast('💰 ' + tt('Ви виграли джекпот') + ': ' + fmt(d.win.amt)); } });
    socket.on('stk_wh', function (d) { if (!d) return; syncT(d); var was = ST.wh; ST.wh = d; if (isOpen() && ST.tab === 'wh') rWh(); if (was && was.id !== d.id) whSpin = null; });
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
    socket.on('economyUpdate', function () { if (isOpen()) { paintHead(); if (ST.tab === 'cf') render(); } });

    window.Stakes = { open: open, close: close, duel: duelDlg, rules: rulesDlg, state: ST };
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-stakes', icon: '🎰', title: 'ФОРТУНА', sub: 'Батли кейсів · дуелі · колесо', color: 'rose', bg: '💰', onClick: function () { open(); } });
    // стан (ліміти, прийняття правил, новини) — одразу після завантаження модуля
    if (typeof socket !== 'undefined' && socket.connected) { socket.emit('stkHello'); setTimeout(function () { if (!isOpen()) socket.emit('stkBye'); }, 1500); }
})();
