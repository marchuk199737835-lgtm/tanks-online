/* ranked.js — рейтинговий режим (клієнт): екран рангу з вибором формату й кнопкою «ГРАТИ», черга, екран п'єдесталу після бою.
 * Підвантажується ліниво (lazy.js), картка в меню — «РЕЙТИНГОВИЙ РЕЖИМ». Сервер — ranked.js у корені, ранги — js/rankinfo.js.
 * Легкий візуал: лише CSS (градієнти, одна анімація сітки, вимикається на слабкій графіці), без canvas і зображень. */
(function () {
    'use strict';
    var RI = window.RankInfo; if (!RI) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var TC = { red: '#ef4444', blue: '#3b82f6' }, TN = { red: 'Червоні', blue: 'Сині' };
    var MN = { team_deathmatch: 'Командний бій', capture_points: 'Захоплення точок', rounds: 'Раунди' }, ME = { team_deathmatch: '🤝', capture_points: '🚩', rounds: '⏱️' };
    var FMTS = ['1v1', '2v2', '5v5'], FL = { '1v1': '1×1', '2v2': '2×2', '5v5': '5×5' };
    var st = { info: null, fmt: null, q: null, tab: 'ladder', go: null, res: null, skew: 0 };
    try { st.fmt = localStorage.getItem('rkFmt'); } catch (e) {} if (FMTS.indexOf(st.fmt) < 0) st.fmt = '1v1';

    // ---------- стилі ----------
    var css = '' +
        '#rk-ov,#rk-res{position:fixed;inset:0;z-index:72;display:none;color:#e2e8f0;font-family:Jura,system-ui,sans-serif;overflow:hidden}' +
        '#rk-ov.on,#rk-res.on{display:flex;flex-direction:column}' +
        '#rk-ov{background:radial-gradient(120% 90% at 50% -10%,#1d2a6b 0%,#0a1030 45%,#03050f 100%)}' +
        '#rk-ov:before,#rk-res:before{content:"";position:absolute;inset:-50% -10% 0;background-image:linear-gradient(rgba(99,102,241,.13) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,.13) 1px,transparent 1px);background-size:48px 48px;transform:perspective(500px) rotateX(58deg);transform-origin:50% 100%;animation:rkGrid 9s linear infinite;pointer-events:none;opacity:.55}' +
        '@keyframes rkGrid{to{background-position:0 48px,0 0}}' +
        'html.gfx-low #rk-ov:before,html.gfx-low #rk-res:before{animation:none}@media (prefers-reduced-motion:reduce){#rk-ov:before,#rk-res:before{animation:none}}' +
        '.rk-hd{position:relative;display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 8px max(12px,env(safe-area-inset-left));z-index:2}' +
        '.rk-back{display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.6);color:#e2e8f0;font:700 12px "Russo One",Arial;letter-spacing:.06em;cursor:pointer}.rk-back:hover{border-color:#818cf8}' +
        '.rk-ttl{flex:1;min-width:0}.rk-ttl h2{margin:0;font:400 clamp(15px,2.6vw,24px)/1.1 "Russo One",Arial;letter-spacing:.14em;background:linear-gradient(90deg,#fff,#a5b4fc 55%,#f0abfc);-webkit-background-clip:text;background-clip:text;color:transparent;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.rk-ttl small{display:block;font-size:11px;color:#94a3b8;letter-spacing:.08em;margin-top:2px}' +
        '.rk-body{position:relative;z-index:1;flex:1;min-height:0;display:grid;grid-template-columns:minmax(280px,1.05fr) minmax(300px,1fr);gap:14px;padding:4px max(12px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));overflow:auto;-webkit-overflow-scrolling:touch}' +
        '.rk-card{position:relative;border-radius:18px;background:linear-gradient(160deg,rgba(30,41,95,.72),rgba(8,12,34,.86));border:1px solid rgba(129,140,248,.28);box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.06);padding:14px}' +
        '.rk-hero{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;overflow:hidden}' +
        '.rk-hero:after{content:"";position:absolute;left:50%;top:-30%;width:120%;height:70%;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(var(--g),.35),transparent);pointer-events:none}' +
        '.rk-emw{position:relative;filter:drop-shadow(0 0 18px rgba(var(--g),.65))}.rk-emw .rk-emb{width:clamp(96px,16vw,150px);height:auto}' +
        '.rk-name{font:400 clamp(20px,3.2vw,30px)/1 "Russo One",Arial;letter-spacing:.08em;color:#fff;text-shadow:0 0 18px rgba(var(--g),.7)}' +
        '.rk-rp{font:700 14px/1 "Russo One",Arial;color:#c7d2fe}.rk-rp b{font-size:20px;color:#fff}' +
        '.rk-bar{width:min(360px,100%);height:10px;border-radius:6px;background:rgba(2,6,23,.75);border:1px solid rgba(148,163,184,.25);overflow:hidden}.rk-bar i{display:block;height:100%;background:linear-gradient(90deg,rgba(var(--g),.6),rgba(var(--g),1));box-shadow:0 0 12px rgba(var(--g),.8);transition:width .6s}' +
        '.rk-next{font-size:12px;color:#94a3b8}.rk-next b{color:#e2e8f0}' +
        '.rk-chips{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;width:100%;margin-top:4px}.rk-chip{padding:7px 4px;border-radius:12px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.16)}.rk-chip b{display:block;font:400 17px/1.1 "Russo One",Arial;color:#fff}.rk-chip small{font-size:10px;color:#94a3b8;letter-spacing:.04em}' +
        '.rk-shield{font-size:11px;color:#5eead4}' +
        '.rk-play{display:flex;flex-direction:column;gap:10px}' +
        '.rk-fmt{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.rk-fmt button{position:relative;padding:10px 4px 8px;border-radius:14px;border:1px solid rgba(148,163,184,.25);background:rgba(2,6,23,.6);color:#cbd5e1;cursor:pointer;font:400 clamp(16px,2.4vw,22px)/1 "Russo One",Arial;letter-spacing:.06em;transition:transform .15s,border-color .15s,background .15s}' +
        '.rk-fmt button small{display:block;margin-top:5px;font:700 10px/1 Jura,Arial;letter-spacing:.06em;color:#94a3b8}.rk-fmt button.on{border-color:#a78bfa;background:linear-gradient(160deg,rgba(124,58,237,.45),rgba(30,27,75,.8));color:#fff;box-shadow:0 0 18px rgba(167,139,250,.45);transform:translateY(-2px)}' +
        '.rk-fmt button:disabled{opacity:.45;cursor:not-allowed}' +
        '.rk-go{position:relative;height:clamp(58px,9vh,78px);border:0;border-radius:18px;cursor:pointer;font:400 clamp(22px,3.4vw,32px)/1 "Russo One",Arial;letter-spacing:.22em;color:#fff;background:linear-gradient(100deg,#7c3aed,#db2777 55%,#f59e0b);box-shadow:0 10px 30px rgba(219,39,119,.45),inset 0 -4px 0 rgba(0,0,0,.25);overflow:hidden;transition:transform .12s,filter .15s}' +
        '.rk-go:hover{filter:brightness(1.1)}.rk-go:active{transform:scale(.98)}.rk-go:after{content:"";position:absolute;top:0;left:-40%;width:30%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg);animation:rkShine 3.2s ease-in-out infinite}' +
        '@keyframes rkShine{0%,60%{left:-40%}100%{left:130%}}html.gfx-low .rk-go:after{display:none}' +
        '.rk-go.q{background:linear-gradient(100deg,#0f766e,#1d4ed8);letter-spacing:.08em;font-size:clamp(18px,2.6vw,24px)}.rk-go.q:after{animation-duration:1.4s}' +
        '.rk-go:disabled{filter:grayscale(.8) brightness(.7);cursor:not-allowed}' +
        '.rk-cancel{align-self:center;padding:7px 18px;border-radius:10px;border:1px solid rgba(248,113,113,.5);background:rgba(127,29,29,.35);color:#fecaca;font-weight:800;font-size:12px;letter-spacing:.06em;cursor:pointer}' +
        '.rk-hint{font-size:11.5px;color:#94a3b8;text-align:center;line-height:1.4}.rk-hint b{color:#c7d2fe}' +
        '.rk-lock{padding:12px;border-radius:14px;background:rgba(127,29,29,.3);border:1px solid rgba(248,113,113,.45);font-size:13px;text-align:center;color:#fecaca}.rk-lock b{color:#fff}' +
        '.rk-pend{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:linear-gradient(100deg,rgba(245,158,11,.25),rgba(124,58,237,.25));border:1px solid rgba(251,191,36,.55);margin-bottom:10px}.rk-pend>div{flex:1;min-width:0;font-size:12.5px}.rk-pend b{color:#fde68a}' +
        '.rk-pend button,.rk-btn{padding:9px 14px;border-radius:12px;border:0;background:linear-gradient(90deg,#f59e0b,#ef4444);color:#fff;font:400 13px/1 "Russo One",Arial;letter-spacing:.06em;cursor:pointer;white-space:nowrap}' +
        '.rk-tabs{display:flex;gap:6px;margin-bottom:10px}.rk-tabs button{flex:1;padding:8px 6px;border-radius:11px;border:1px solid rgba(148,163,184,.2);background:rgba(2,6,23,.5);color:#94a3b8;font:400 12px/1 "Russo One",Arial;letter-spacing:.06em;cursor:pointer}.rk-tabs button.on{color:#fff;border-color:#818cf8;background:rgba(79,70,229,.35)}' +
        '.rk-list{display:flex;flex-direction:column;gap:5px;max-height:none}' +
        '.rk-row{display:flex;align-items:center;gap:8px;padding:6px 9px;border-radius:12px;background:rgba(2,6,23,.45);border:1px solid rgba(148,163,184,.1);font-size:12.5px}' +
        '.rk-row.cur{border-color:rgba(var(--g),.9);background:rgba(var(--g),.16);box-shadow:0 0 14px rgba(var(--g),.25)}.rk-row.me{border-color:#818cf8;background:rgba(79,70,229,.22)}' +
        '.rk-row .rk-emb{flex:0 0 30px;width:30px;height:30px}.rk-row .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-weight:700}.rk-row .nm small{display:block;color:#94a3b8;font-weight:600;font-size:10.5px}' +
        '.rk-row .v{font:400 13px/1 "Russo One",Arial;color:#c7d2fe;white-space:nowrap}.rk-row .pl{flex:0 0 26px;font:400 13px/1 "Russo One",Arial;color:#94a3b8;text-align:center}.rk-row .pl.g1{color:#fbbf24}.rk-row .pl.g2{color:#e2e8f0}.rk-row .pl.g3{color:#d97706}' +
        '.rk-row .rw{font-size:10.5px;color:#fde68a;white-space:nowrap}.rk-row .o-win{color:#4ade80}.rk-row .o-loss,.rk-row .o-leave{color:#f87171}.rk-row .o-draw{color:#cbd5e1}' +
        '.rk-empty{padding:18px;text-align:center;color:#64748b;font-size:13px}' +
        '@media (max-width:820px){.rk-body{grid-template-columns:1fr}.rk-chips{grid-template-columns:repeat(5,1fr)}}' +
        '@media (max-width:420px){.rk-chips{grid-template-columns:repeat(3,1fr)}.rk-chip:nth-child(n+4){display:none}}' +
        '@media (orientation:landscape) and (max-height:520px){.rk-body{grid-template-columns:1fr 1fr}.rk-emw .rk-emb{width:78px}.rk-chips{display:none}.rk-hd{padding-top:6px}}' +
        // ---- екран п'єдесталу ----
        '#rk-res{background:radial-gradient(120% 80% at 50% 0%,#2a1250 0%,#0b0f2a 50%,#02040c 100%);overflow:auto;-webkit-overflow-scrolling:touch}' +
        '#rk-res.win{background:radial-gradient(120% 80% at 50% 0%,#5a3a06 0%,#1a1033 50%,#02040c 100%)}#rk-res.loss{background:radial-gradient(120% 80% at 50% 0%,#3b0d18 0%,#0b0f2a 55%,#02040c 100%)}' +
        '.rr-in{position:relative;z-index:1;width:min(1100px,100%);margin:0 auto;padding:max(12px,env(safe-area-inset-top)) 12px max(14px,env(safe-area-inset-bottom));display:flex;flex-direction:column;gap:12px}' +
        '.rr-h{text-align:center}.rr-h h1{margin:0;font:400 clamp(30px,6vw,60px)/1 "Russo One",Arial;letter-spacing:.16em;color:#fff;text-shadow:0 0 30px rgba(255,255,255,.35)}' +
        '#rk-res.win .rr-h h1{background:linear-gradient(180deg,#fff7cc,#fbbf24 60%,#b45309);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 22px rgba(251,191,36,.6))}' +
        '#rk-res.loss .rr-h h1{color:#fca5a5}' +
        '.rr-sub{margin-top:6px;font-size:13px;color:#cbd5e1;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.rr-sc{font:400 clamp(20px,3vw,28px)/1 "Russo One",Arial}.rr-sc em{color:#64748b;font-style:normal;margin:0 8px}' +
        '.rr-pod{display:flex;align-items:flex-end;justify-content:center;gap:clamp(6px,2vw,22px);min-height:230px;padding-top:10px}' +
        '.rr-p{flex:0 1 180px;display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:translateY(24px);animation:rrUp .55s cubic-bezier(.2,.9,.3,1.2) forwards}' +
        '.rr-p.p1{animation-delay:.35s}.rr-p.p2{animation-delay:.15s}.rr-p.p3{animation-delay:.5s}@keyframes rrUp{to{opacity:1;transform:none}}' +
        '.rr-tank{width:clamp(64px,10vw,96px);filter:drop-shadow(0 8px 14px rgba(0,0,0,.6))}.rr-p.p1 .rr-tank{width:clamp(80px,13vw,124px)}' +
        '.rr-nm{margin-top:4px;font-weight:800;font-size:13px;color:#fff;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rr-nm i{font-style:normal}' +
        '.rr-st{font-size:11px;color:#cbd5e1}.rr-st b{color:#fff}' +
        '.rr-ped{margin-top:6px;width:100%;border-radius:12px 12px 4px 4px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;font:400 clamp(26px,4vw,40px)/1 "Russo One",Arial;color:rgba(255,255,255,.9);background:linear-gradient(180deg,rgba(var(--pc),.55),rgba(var(--pc),.12));border:1px solid rgba(var(--pc),.7);box-shadow:0 0 24px rgba(var(--pc),.25),inset 0 1px 0 rgba(255,255,255,.25)}' +
        '.rr-p.p1 .rr-ped{height:110px;--pc:251,191,36}.rr-p.p2 .rr-ped{height:78px;--pc:203,213,225}.rr-p.p3 .rr-ped{height:56px;--pc:217,119,6}' +
        '.rr-crown{font-size:22px;line-height:1;margin-bottom:-2px}' +
        '.rr-grid{display:grid;grid-template-columns:minmax(260px,.9fr) 1.4fr;gap:12px}' +
        '.rr-rk{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}.rr-rk .rk-emb{width:clamp(70px,10vw,104px);height:auto;filter:drop-shadow(0 0 16px rgba(var(--g),.6))}' +
        '.rr-d{font:400 clamp(26px,4vw,40px)/1 "Russo One",Arial}.rr-d.up{color:#4ade80;text-shadow:0 0 18px rgba(74,222,128,.5)}.rr-d.dn{color:#f87171}.rr-d.eq{color:#cbd5e1}' +
        '.rr-promo{padding:6px 12px;border-radius:999px;font:400 12px/1 "Russo One",Arial;letter-spacing:.08em;background:linear-gradient(90deg,#f59e0b,#db2777);color:#fff;animation:rrPulse 1.4s ease-in-out infinite}.rr-promo.dn{background:#7f1d1d}@keyframes rrPulse{50%{transform:scale(1.06)}}' +
        '.rr-rew{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:4px}.rr-rew span{padding:7px 12px;border-radius:12px;background:rgba(2,6,23,.6);border:1px solid rgba(148,163,184,.2);font-weight:800;font-size:13px;display:inline-flex;align-items:center;gap:5px}' +
        '.rr-tb{width:100%;border-collapse:separate;border-spacing:0 4px;font-size:12.5px}.rr-tb th{font-size:10.5px;color:#94a3b8;font-weight:700;text-align:center;padding:2px 4px;letter-spacing:.04em}.rr-tb th:first-child,.rr-tb td:first-child{text-align:left}' +
        '.rr-tb td{padding:6px 5px;background:rgba(2,6,23,.5);text-align:center;white-space:nowrap}.rr-tb td:first-child{border-radius:10px 0 0 10px;border-left:3px solid var(--tc);max-width:150px;overflow:hidden;text-overflow:ellipsis;color:#fff;font-weight:700}.rr-tb td:last-child{border-radius:0 10px 10px 0}' +
        '.rr-tb tr.me td{background:rgba(79,70,229,.3)}.rr-tb .up{color:#4ade80}.rr-tb .dn{color:#f87171}.rr-tb .rk-emb{width:22px;height:22px;vertical-align:middle}' +
        '.rr-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding-bottom:6px}.rr-btns button{min-width:170px;height:52px;border-radius:15px;border:0;font:400 16px/1 "Russo One",Arial;letter-spacing:.1em;cursor:pointer;color:#fff}' +
        '.rr-again{background:linear-gradient(100deg,#7c3aed,#db2777 60%,#f59e0b);box-shadow:0 8px 24px rgba(219,39,119,.4)}.rr-back{background:rgba(30,41,59,.85);border:1px solid rgba(148,163,184,.35)!important}' +
        '@media (max-width:760px){.rr-grid{grid-template-columns:1fr}.rr-pod{min-height:190px}.rr-p.p1 .rr-ped{height:84px}.rr-p.p2 .rr-ped{height:60px}.rr-p.p3 .rr-ped{height:44px}.rr-tb .hide-s{display:none}}';
    var sEl = document.createElement('style'); sEl.id = 'rk-css'; sEl.textContent = css; document.head.appendChild(sEl);

    // ---------- допоміжне ----------
    function glow(div) { return RI.TIERS[RI.DIVS[div].t].glow; }
    function fmtLeft(ms) { ms = Math.max(0, ms); var d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4); return (d ? d + 'д ' : '') + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'); }
    var mmss = function (s) { s = Math.max(0, s | 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
    function tankSvg(col, eq) {
        var rc = function (slot) { var id = eq && eq[slot], m = id && window.MODULES && MODULES[id]; return m && window.RARITY && RARITY[m.rarity] ? RARITY[m.rarity].color : '#475569'; };
        return '<svg class="rr-tank" viewBox="-60 -64 120 128" aria-hidden="true"><rect x="-44" y="-40" width="18" height="80" rx="6" fill="#0f172a" stroke="' + rc('tracks') + '" stroke-width="3"/><rect x="26" y="-40" width="18" height="80" rx="6" fill="#0f172a" stroke="' + rc('tracks') + '" stroke-width="3"/>' +
            '<rect x="-30" y="-36" width="60" height="72" rx="12" fill="' + col + '" stroke="' + rc('hull') + '" stroke-width="3"/><rect x="-5" y="-62" width="10" height="44" rx="3" fill="#cbd5e1" stroke="' + rc('cannon') + '" stroke-width="2.5"/>' +
            '<circle r="21" fill="' + col + '" stroke="' + rc('turret') + '" stroke-width="3"/><circle r="8" fill="rgba(2,6,23,.45)"/></svg>';
    }
    function divLabel(i) { return RI.DIVS[i].n; }

    // ---------- головний екран ----------
    var ov = null, qTimer = null, refT = null;
    function build() {
        ov = document.createElement('div'); ov.id = 'rk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
        ov.innerHTML = '<header class="rk-hd"><button type="button" class="rk-back" data-a="close"><span>←</span> <span>Меню</span></button><div class="rk-ttl"><h2>РЕЙТИНГОВИЙ РЕЖИМ</h2><small id="rk-season"></small></div></header>' +
            '<div class="rk-body"><div style="display:flex;flex-direction:column;gap:14px;min-width:0"><div id="rk-pend"></div><section class="rk-card rk-hero" id="rk-hero"></section><section class="rk-card rk-play" id="rk-play"></section></div>' +
            '<section class="rk-card" style="min-width:0"><div class="rk-tabs"><button type="button" data-tab="ladder">Ранги</button><button type="button" data-tab="top">Лідери</button><button type="button" data-tab="hist">Історія</button></div><div class="rk-list" id="rk-list"></div></section></div>';
        document.body.appendChild(ov);
        ov.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            if (b.dataset.a === 'close') { snd('ui_click'); return close(); }
            if (b.dataset.tab) { snd('ui_click'); st.tab = b.dataset.tab; renderList(); return; }
            if (b.dataset.fmt) { if (st.q) return; snd('ui_click'); st.fmt = b.dataset.fmt; try { localStorage.setItem('rkFmt', st.fmt); } catch (er) {} renderPlay(); return; }
            if (b.dataset.a === 'play') { snd('ui_buy'); socket.emit('rkJoin', { fmt: st.fmt }); b.disabled = true; setTimeout(function () { if (!st.q) renderPlay(); }, 1500); return; }
            if (b.dataset.a === 'cancel') { snd('ui_click'); socket.emit('rkCancel'); return; }
            if (b.dataset.a === 'claim') { snd('ui_buy'); socket.emit('rkClaim', { sid: b.dataset.sid }); b.disabled = true; return; }
            if (b.dataset.h && window.PlayerCard) { snd('ui_click'); PlayerCard.open({ h: b.dataset.h }); }
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && ov.classList.contains('on') && !(window.uiDialog && uiDialog.isOpen())) close(); });
    }
    function open() {
        if (!ov) build();
        ov.classList.add('on'); socket.emit('rkInfo'); render();
        clearInterval(refT); refT = setInterval(function () { if (ov.classList.contains('on')) socket.emit('rkInfo'); }, 15000);
    }
    function close() { if (ov) ov.classList.remove('on'); clearInterval(refT); }
    function render() { if (!ov) return; renderHero(); renderPlay(); renderList(); renderPend(); renderSeason(); }
    function renderSeason() {
        var I = st.info, el = $('rk-season'); if (!el) return;
        if (!I) { el.textContent = ''; return; }
        var left = I.season.end ? I.season.end - (Date.now() + st.skew) : 0;
        el.innerHTML = '<span>Сезон</span> ' + esc(I.season.id || '') + (left > 0 ? ' · <span>до кінця</span> ' + fmtLeft(left) : '');
    }
    function renderHero() {
        var I = st.info, h = $('rk-hero'); if (!h) return;
        if (!I) { h.innerHTML = '<div class="rk-empty">Завантаження…</div>'; return; }
        var d = RI.DIVS[I.div], nx = d.next != null ? RI.DIVS[I.div + 1] : null, wr = I.games ? Math.round(100 * I.w / I.games) : 0;
        h.style.setProperty('--g', glow(I.div));
        h.innerHTML = '<div class="rk-emw">' + RI.emblem(I.div, 150) + '</div><div class="rk-name">' + esc(d.n) + '</div>' +
            '<div class="rk-rp"><b>' + I.rp + '</b> <span>ОР</span></div>' +
            '<div class="rk-bar"><i style="width:' + Math.round(RI.progress(I.rp) * 100) + '%"></i></div>' +
            '<div class="rk-next">' + (nx ? '<span>До</span> <b>' + esc(nx.n) + '</b>: ' + (nx.rp - I.rp) + ' <span>ОР</span>' : '<b>Найвищий ранг!</b>') + '</div>' +
            (I.shield > 0 ? '<div class="rk-shield">🛡 <span>Захист рангу</span>: ' + I.shield + '</div>' : '') +
            '<div class="rk-chips"><div class="rk-chip"><b>' + I.games + '</b><small>Боїв</small></div><div class="rk-chip"><b>' + I.w + '</b><small>Перемог</small></div><div class="rk-chip"><b>' + wr + '%</b><small>% перемог</small></div><div class="rk-chip"><b>' + (I.place || '—') + '</b><small>Місце</small></div><div class="rk-chip"><b>' + I.peak + '</b><small>Рекорд ОР</small></div></div>';
    }
    function renderPlay() {
        var I = st.info, p = $('rk-play'); if (!p) return;
        if (I && !I.unlocked) {
            p.innerHTML = '<div class="rk-lock">🔒 <span>Рейтинговий режим відкривається з</span> <b>' + I.need.level + '</b> <span>рівня та після</span> <b>' + I.need.matches + '</b> <span>зіграних боїв</span>.<br><small><span>Ваш рівень</span>: ' + I.need.lv + ' · <span>боїв</span>: ' + I.need.m + '</small></div>' +
                '<div class="rk-hint">Так ми захищаємо рейтинг від накрутки твінками.</div>';
            return;
        }
        var oq = I && I.online ? I.online.q : {}, q = st.q;
        var h = '<div class="rk-fmt">' + FMTS.map(function (f) { return '<button type="button" data-fmt="' + f + '" class="' + (st.fmt === f ? 'on' : '') + '"' + (q ? ' disabled' : '') + '>' + FL[f] + '<small><span>у черзі</span>: ' + (oq[f] || 0) + '</small></button>'; }).join('') + '</div>';
        if (q) {
            var el = Math.max(0, Math.floor((Date.now() + st.skew - q.at) / 1000));
            h += '<button type="button" class="rk-go q" disabled><span>ПОШУК СУПЕРНИКІВ</span> ' + mmss(el) + '</button><button type="button" class="rk-cancel" data-a="cancel">Скасувати</button>';
        } else if (I && I.desert > 0) h += '<button type="button" class="rk-go" disabled><span>ЧЕРГА ЧЕРЕЗ</span> ' + mmss(Math.ceil(I.desert / 1000)) + '</button>';
        else h += '<button type="button" class="rk-go" data-a="play">ГРАТИ</button>';
        h += '<div class="rk-hint"><span>Режим і мапа обираються випадково</span>: <b>' + ME.team_deathmatch + ' ' + '<span>Командний бій</span>' + '</b> · <b>' + ME.capture_points + ' <span>Захоплення точок</span></b> · <b>' + ME.rounds + ' <span>Раунди</span></b>.<br><span>Суперники — у межах ±1 рангу.</span></div>';
        p.innerHTML = h;
        clearInterval(qTimer); if (q) qTimer = setInterval(function () { if (!st.q || !ov || !ov.classList.contains('on')) { clearInterval(qTimer); return; } var b = p.querySelector('.rk-go.q'); if (b) { var e2 = Math.max(0, Math.floor((Date.now() + st.skew - st.q.at) / 1000)); b.innerHTML = '<span>ПОШУК СУПЕРНИКІВ</span> ' + mmss(e2); } }, 1000);
    }
    function renderPend() {
        var I = st.info, el = $('rk-pend'); if (!el) return;
        if (!I || !I.pend || !I.pend.length) { el.innerHTML = ''; return; }
        el.innerHTML = I.pend.map(function (p) {
            return '<div class="rk-pend">' + RI.emblem(p.div, 44) + '<div><span>Нагорода за сезон</span> <b>' + esc(p.sid) + '</b>: ' + esc(divLabel(p.div)) + '<br>' + creditAmount(p.reward.cr, 13) + (p.reward.caseName ? ' + <span>кейс</span> «' + esc(p.reward.caseName) + '»' : '') + '</div><button type="button" data-a="claim" data-sid="' + esc(p.sid) + '">Забрати</button></div>';
        }).join('');
    }
    function renderList() {
        var I = st.info, el = $('rk-list'); if (!el || !ov) return;
        ov.querySelectorAll('.rk-tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === st.tab); });
        var h = '';
        if (st.tab === 'ladder') {
            for (var i = RI.DIVS.length - 1; i >= 0; i--) {
                var d = RI.DIVS[i], cur = I && I.div === i, sr = RI.SEASON_REWARDS[d.t], showRw = d.sub <= 0;
                h += '<div class="rk-row' + (cur ? ' cur' : '') + '" style="--g:' + glow(i) + '">' + RI.emblem(i, 30) + '<div class="nm">' + esc(d.n) + '<small>' + d.rp + (d.next != null ? '–' + (d.next - 1) : '+') + ' <span>ОР</span></small></div>' +
                    (showRw ? '<span class="rw">🏆 ' + creditAmount(sr.cr, 11) + (sr.caseP || sr.legend ? ' + 📦' : '') + '</span>' : '') + '</div>';
            }
            h += '<div class="rk-hint" style="margin-top:6px"><span>Нагорода сезону залежить від ліги наприкінці місяця</span> (<span>потрібно щонайменше</span> ' + RI.MIN_SEASON_GAMES + ' <span>боїв</span>). <span>Після сезону рейтинг зменшується вдвічі.</span></div>';
        } else if (st.tab === 'top') {
            if (!I || !I.top || !I.top.length) h = '<div class="rk-empty">Цього сезону ще ніхто не грав. Будьте першим!</div>';
            else h = I.top.map(function (r) { return '<button type="button" class="rk-row" data-h="' + esc(r.h || '') + '" style="--g:' + glow(r.div) + ';width:100%;text-align:left;color:inherit;cursor:pointer"><span class="pl g' + r.place + '">' + r.place + '</span>' + RI.emblem(r.div, 30) + '<div class="nm">' + (r.clan ? '<span style="color:#fbbf24">[' + esc(r.clan) + ']</span> ' : '') + esc(r.nick) + '<small>' + esc(divLabel(r.div)) + ' · ' + r.w + '/' + r.g + '</small></div><span class="v">' + r.rp + '</span></button>'; }).join('');
        } else {
            if (!I || !I.hist || !I.hist.length) h = '<div class="rk-empty">Ще немає рейтингових боїв цього сезону.</div>';
            else h = I.hist.map(function (x) {
                var o = { win: 'Перемога', loss: 'Поразка', draw: 'Нічия', leave: 'Вихід з бою' }[x.o] || x.o;
                return '<div class="rk-row"><span style="font-size:18px">' + (ME[x.m] || '⚔️') + '</span><div class="nm"><span class="o-' + x.o + '">' + o + '</span><small>' + esc(MN[x.m] || x.m) + ' · ' + FL[x.f] + '</small></div><span class="v ' + (x.d >= 0 ? 'o-win' : 'o-loss') + '">' + (x.d > 0 ? '+' : '') + x.d + '</span></div>';
            }).join('');
        }
        el.innerHTML = h;
    }

    // ---------- події сервера ----------
    socket.on('rkInfo', function (d) { if (!d) return; st.info = d; st.skew = d.season && d.season.now ? d.season.now - Date.now() : 0; st.q = d.queue; if (ov && ov.classList.contains('on')) render(); });
    socket.on('rkQueue', function (q) { st.q = q; if (q && q.now) st.skew = q.now - Date.now(); if (ov && ov.classList.contains('on')) renderPlay(); });
    socket.on('rkError', function (d) { if (d && d.requeue) { if (window.uiToast) uiToast(d.msg, true); return; } if (window.uiDialog) uiDialog.show({ kind: 'error', icon: '🏆', title: 'Рейтинговий режим', text: d && d.msg || '' }); if (ov && ov.classList.contains('on')) renderPlay(); });
    socket.on('rkClaimed', function (d) { if (window.uiToast) uiToast('Нагороду сезону отримано!'); });
    socket.on('rkFound', function (d) {
        if (!d) return; st.q = null; close();
        currentRoomId = d.roomId; currentRoomData = d.roomData; if (window.resetLobbyUI) resetLobbyUI();
        ['winner-modal', 'settings-modal'].forEach(function (id) { var e = $(id); if (e) e.classList.add('hidden'); });
        if (window.uiToast) uiToast('Суперників знайдено: ' + (MN[d.mode] || '') + ' · ' + (FL[d.fmt] || ''));
    });

    // ---------- екран п'єдесталу ----------
    var res = null, pendGO = null;
    function onGameOver(data) { pendGO = data; }
    socket.on('rkResult', function (r) { showResult(r); });
    function showResult(R) {
        if (!res) { res = document.createElement('div'); res.id = 'rk-res'; document.body.appendChild(res); res.addEventListener('click', onResClick); }
        st.res = R;
        var cls = R.outcome === 'win' ? 'win' : R.outcome === 'loss' ? 'loss' : 'draw', title = R.outcome === 'win' ? 'ПЕРЕМОГА' : R.outcome === 'loss' ? 'ПОРАЗКА' : 'НІЧИЯ';
        var rows = R.rows || [], podium = rows.slice().sort(function (a, b) { return (b.kills * 3 + b.caps * 2 - b.deaths * .5) - (a.kills * 3 + a.caps * 2 - a.deaths * .5); }).slice(0, 3);
        var ord = [podium[1], podium[0], podium[2]], pcls = ['p2', 'p1', 'p3'], pn = ['2', '1', '3'];
        var pod = ord.map(function (p, i) {
            if (!p) return '<div class="rr-p ' + pcls[i] + '" style="visibility:hidden"></div>';
            return '<div class="rr-p ' + pcls[i] + '">' + (p.mvp ? '<div class="rr-crown">👑</div>' : '') + tankSvg(TC[p.team] || '#64748b', p.eq) +
                '<div class="rr-nm">' + (p.id === R.me ? '⭐ ' : '') + (p.clan ? '<i style="color:#fbbf24">[' + esc(p.clan) + ']</i> ' : '') + esc(p.nick) + '</div>' +
                '<div class="rr-st"><b>' + p.kills + '</b> <span>вбивств</span>' + (p.caps ? ' · <b>' + p.caps + '</b> <span>точок</span>' : '') + '</div><div class="rr-ped">' + pn[i] + '</div></div>';
        }).join('');
        var m = R.rp, d = m.d, up = m.divA > m.divB, dn = m.divA < m.divB;
        var sc = R.score ? ['red', 'blue'].map(function (t) { return '<span style="color:' + TC[t] + '">' + (R.score[t] != null ? R.score[t] : 0) + '</span>'; }).join('<em>:</em>') : '';
        var xp = R.xp && R.xp.gain ? R.xp.gain : 0;
        var teamRows = function (t) { return rows.filter(function (p) { return p.team === t; }).map(function (p) {
            return '<tr class="' + (p.id === R.me ? 'me' : '') + '" style="--tc:' + TC[t] + '"><td>' + (p.mvp ? '👑 ' : '') + esc(p.nick) + '</td><td class="hide-s">' + RI.emblem(p.div, 22) + '</td><td>' + p.kills + '</td><td>' + p.deaths + '</td><td class="hide-s">' + p.caps + '</td><td class="' + (p.d >= 0 ? 'up' : 'dn') + '">' + (p.d > 0 ? '+' : '') + p.d + '</td></tr>';
        }).join(''); };
        res.className = 'on ' + cls;
        res.innerHTML = '<div class="rr-in"><div class="rr-h"><h1>' + title + '</h1><div class="rr-sub"><span>' + (ME[R.mode] || '') + ' <span>' + esc(MN[R.mode] || R.mode) + '</span> · ' + FL[R.fmt] + '</span>' + (sc ? '<span class="rr-sc">' + sc + '</span>' : '') + '</div></div>' +
            '<div class="rr-pod">' + pod + '</div>' +
            '<div class="rr-grid"><section class="rk-card rr-rk" style="--g:' + glow(m.divA) + '">' + RI.emblem(m.divA, 104) + '<div class="rk-name" style="font-size:20px">' + esc(divLabel(m.divA)) + '</div>' +
            '<div class="rr-d ' + (d > 0 ? 'up' : d < 0 ? 'dn' : 'eq') + '" data-d="' + d + '">' + (d > 0 ? '+' : '') + d + ' <span style="font-size:.5em">ОР</span></div>' +
            '<div class="rk-rp"><span>' + m.before + '</span> → <b id="rr-rpn">' + m.before + '</b> <span>ОР</span></div>' +
            (up ? '<div class="rr-promo">▲ <span>НОВИЙ РАНГ</span>!</div>' : dn ? '<div class="rr-promo dn">▼ <span>Ранг знижено</span></div>' : '') +
            (m.afk ? '<div class="rk-hint" style="color:#fca5a5">' + (R.outcome === 'win' ? 'Ви не брали участі в бою — рейтинг за перемогу не нараховано.' : 'Ви не брали участі в бою — втрату рейтингу збільшено.') + '</div>' : '') +
            '<div class="rr-rew"><span>' + creditAmount('+' + (R.credits | 0), 14) + '</span>' + (xp ? '<span>⭐ +' + xp + ' XP</span>' : '') + (R.dropped && window.MODULES && MODULES[R.dropped] ? '<span>📦 ' + esc(MODULES[R.dropped].name) + '</span>' : '') + '</div></section>' +
            '<section class="rk-card" style="overflow-x:auto"><table class="rr-tb"><thead><tr><th>Гравець</th><th class="hide-s">Ранг</th><th>Вбивства</th><th>Смерті</th><th class="hide-s">Точки</th><th>ОР</th></tr></thead><tbody>' + teamRows('red') + '<tr><td colspan="6" style="background:none;border:0;padding:2px"></td></tr>' + teamRows('blue') + '</tbody></table></section></div>' +
            '<div class="rr-btns"><button type="button" class="rr-again" data-a="again">ГРАТИ ЩЕ</button><button type="button" class="rr-back" data-a="rk">ДО РЕЙТИНГУ</button></div></div>';
        snd(R.outcome === 'win' ? 'powerup' : 'ui_click');
        // лічильник ОР
        var n = res.querySelector('#rr-rpn'); if (n && m.before !== m.after) { var t0 = performance.now(); (function step(t) { var k = Math.min(1, (t - t0) / 1100); n.textContent = Math.round(m.before + (m.after - m.before) * k); if (k < 1 && res.classList.contains('on')) requestAnimationFrame(step); })(t0); }
        if (typeof switchMusicState === 'function') switchMusicState('menu');
    }
    function leaveResult() {
        socket.emit('rkLeave'); if (res) res.className = '';
        currentRoomId = null; currentRoomData = null; if (window.resetLobbyUI) resetLobbyUI();
        if (window.ModesFX) ModesFX.reset();
        showScreen('main-menu-screen');
    }
    function onResClick(e) {
        var b = e.target.closest('button'); if (!b) return; snd('ui_click');
        var fmt = st.res && st.res.fmt;
        leaveResult(); open();
        if (b.dataset.a === 'again' && fmt) { st.fmt = fmt; setTimeout(function () { socket.emit('rkJoin', { fmt: fmt }); }, 250); }
    }

    window.RankedUI = { open: open, close: close, onGameOver: onGameOver, state: st };
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-ranked', icon: '🏆', title: 'РЕЙТИНГОВИЙ РЕЖИМ', sub: 'Ранги · ліги · сезони', color: 'pink', bg: '⚔️', onClick: open });
})();
