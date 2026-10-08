/* progress.js (клієнт) — вікно «ЗАВДАННЯ»: щоденний бонус (серія 7 днів), щоденні завдання, досягнення + тости й сповіщення.
 *   Progress.openDaily() / openQuests() / openAchievements() / refresh()
 * Сервер (public API): progressState, dailyClaimed, questProgress, questClaimed, questRerolled, achUnlocked, achClaimed, progressError
 * Клієнт → сервер: getProgress, claimDaily, claimQuest(i), rerollQuest(i), claimAch(id) */
(function () {
    'use strict';
    var tr = function (s) { return (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s); };
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var reduce = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
    var lowGfx = function () { return document.documentElement.classList.contains('gfx-low'); };
    var cr = function (px) { return (typeof creditIcon === 'function') ? creditIcon(px || 14) : '◆'; };
    var crAmt = function (n, px) { return cr(px) + '<b>' + esc(n) + '</b>'; };

    // ---------- звук ----------
    function snd(name, fb) {
        try {
            if (window.UISFX && UISFX.ready() && UISFX.play(name, { force: true, jit: 0 })) return;
            if (typeof playSound === 'function') playSound(fb || 'ui_buy');
        } catch (e) {}
    }
    var REVEAL = { easy: 'reveal_common', medium: 'reveal_rare', hard: 'reveal_epic', legend: 'reveal_legendary' };

    // ---------- довідники ----------
    var TIERS = { easy: { n: 'Легко', c: '148,163,184', hex: '#94a3b8' }, medium: { n: 'Середньо', c: '59,130,246', hex: '#3b82f6' }, hard: { n: 'Складно', c: '168,85,247', hex: '#a855f7' }, legend: { n: 'Легендарне', c: '234,179,8', hex: '#eab308' } };
    var TIER_ORDER = ['easy', 'medium', 'hard', 'legend'];
    var QCAT = { play: '96,165,250', kills: '248,113,113', mode: '74,222,128', eco: '250,204,21' };
    var QCAT_N = { play: 'Бої', kills: 'Вбивства', mode: 'Режими', eco: 'Економіка' };

    // ---------- стан ----------
    var S = null, off = 0, tab = 'daily', fTier = 'all', fSt = 'all', root = null, isOpen = false, busy = {}, tickT = 0, lastFocus = null, autoShown = false, autoT = 0, bound = false;
    function now() { return Date.now() + off; }
    function inGame() { var g = $('game-screen'); return !!(g && !g.classList.contains('hidden')); }
    function vis(el) { return !!(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); }
    function menuVisible() { var m = $('main-menu-screen'); return !!(m && !m.classList.contains('hidden') && vis(m)); }
    function dlgOpen() { var d = $('dlg'); return !!(d && !d.classList.contains('hidden')); }
    function hms(ms) { ms = Math.max(0, Math.floor(ms / 1000)); var h = Math.floor(ms / 3600), m = Math.floor(ms % 3600 / 60), s = ms % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    function badgeTotal() { if (!S) return 0; var b = S.badge || {}; return (b.daily | 0) + (b.quests | 0) + (b.ach | 0); }

    // ---------- CSS ----------
    var CSS = [
        '.pg-back{position:fixed;inset:0;z-index:55;display:flex;align-items:center;justify-content:center;padding:12px;background:radial-gradient(ellipse at 50% 30%,rgba(30,41,90,.55),rgba(2,6,23,.88));backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .18s;zoom:var(--ui-wz,var(--ui-zoom,1));--uvh:var(--uvh-w,1dvh)}',
        '.pg-back[hidden]{display:none}.pg-back.on{opacity:1}',
        '.pg-box{--a:245,158,11;position:relative;width:min(980px,100%);height:min(680px,100%);display:flex;flex-direction:column;border-radius:22px;border:1px solid rgba(var(--a),.55);background:linear-gradient(160deg,rgba(15,23,42,.97),rgba(8,12,28,.98));box-shadow:0 24px 80px rgba(0,0,0,.7),0 0 60px rgba(var(--a),.18),inset 0 0 40px rgba(var(--a),.06);overflow:hidden;font-family:"Russo One",Arial,sans-serif;color:#e2e8f0;transform:translateY(14px) scale(.97);transition:transform .22s cubic-bezier(.2,1.3,.4,1),border-color .3s,box-shadow .3s}',
        '.pg-back.on .pg-box{transform:none}.pg-box[data-t=quests]{--a:34,211,238}.pg-box[data-t=ach]{--a:168,85,247}',
        '.pg-glow{position:absolute;left:-20%;top:-40%;width:70%;height:90%;background:radial-gradient(circle,rgba(var(--a),.22),transparent 65%);pointer-events:none;transition:background .3s}',
        '.pg-hd{position:relative;display:flex;align-items:center;gap:10px;padding:12px 14px 0 18px;flex-shrink:0}',
        '.pg-title{font-size:20px;letter-spacing:.14em;color:#fff;text-shadow:0 0 18px rgba(var(--a),.6);white-space:nowrap}',
        '.pg-bal{margin-left:auto;display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;background:rgba(2,6,23,.6);border:1px solid rgba(251,191,36,.35);font-size:14px;color:#fde68a}',
        '.pg-x{width:36px;height:36px;border-radius:50%;border:1px solid rgba(148,163,184,.35);background:rgba(30,41,59,.7);color:#cbd5e1;font-size:16px;cursor:pointer;transition:.15s;flex-shrink:0}',
        '.pg-x:hover{background:rgba(239,68,68,.25);border-color:#ef4444;color:#fff;transform:rotate(90deg)}',
        '.pg-tabs{position:relative;display:flex;gap:6px;padding:12px 14px 0;flex-shrink:0}',
        '.pg-tab{position:relative;flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px 6px;border-radius:12px 12px 0 0;border:1px solid transparent;border-bottom:none;background:rgba(30,41,59,.4);color:#94a3b8;font:inherit;font-size:12px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.18s}',
        '.pg-tab i{font-style:normal;font-size:18px;filter:grayscale(.7);transition:.18s}',
        '.pg-tab:hover{color:#fff;background:rgba(51,65,85,.55)}',
        '.pg-tab[aria-selected=true]{color:#fff;background:linear-gradient(180deg,rgba(var(--ta),.28),rgba(var(--ta),.06));border-color:rgba(var(--ta),.6);box-shadow:0 -4px 18px rgba(var(--ta),.25)}',
        '.pg-tab[aria-selected=true] i{filter:none;transform:scale(1.15)}',
        '.pg-tab[data-k=daily]{--ta:245,158,11}.pg-tab[data-k=quests]{--ta:34,211,238}.pg-tab[data-k=ach]{--ta:168,85,247}',
        '.pg-dot{min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font-size:10px;line-height:18px;text-align:center;box-shadow:0 0 10px rgba(239,68,68,.7);animation:pgPulse 1.8s ease-in-out infinite}',
        '@keyframes pgPulse{50%{transform:scale(1.15)}}',
        '.pg-body{position:relative;flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:16px 18px 18px;border-top:1px solid rgba(var(--a),.4);background:linear-gradient(180deg,rgba(var(--a),.05),transparent 120px)}',
        '.pg-body::-webkit-scrollbar{width:8px}.pg-body::-webkit-scrollbar-thumb{background:rgba(var(--a),.4);border-radius:4px}',
        '.pg-pane{animation:pgIn .22s ease-out}.pg-pane.dly{min-height:100%;display:flex;flex-direction:column;justify-content:center}@keyframes pgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
        /* --- щоденний бонус --- */
        '.pg-dh{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
        '.pg-streak{font-size:15px;letter-spacing:.06em;color:#fde68a}.pg-streak b{color:#fff;font-size:20px;text-shadow:0 0 14px rgba(245,158,11,.8)}',
        '.pg-timer{font-size:12px;color:#94a3b8;letter-spacing:.06em}.pg-timer b{display:inline-block;min-width:78px;color:#fff;font-size:15px;font-variant-numeric:tabular-nums;letter-spacing:.08em}',
        '.pg-days{display:grid;grid-template-columns:repeat(7,1fr);gap:10px}',
        '.pg-day{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:6px;min-height:clamp(170px,30vh,250px);padding:12px 6px 10px;border-radius:16px;border:1px solid rgba(100,116,139,.35);background:linear-gradient(180deg,rgba(30,41,59,.75),rgba(15,23,42,.85));text-align:center;overflow:hidden;transition:.2s}',
        '.pg-day .pg-dn{font-size:10px;letter-spacing:.18em;color:#94a3b8}',
        '.pg-day .pg-di{display:flex;align-items:center;justify-content:center;width:100%;height:clamp(60px,13vh,100px)}',
        '.pg-day .pg-di svg{filter:drop-shadow(0 4px 10px rgba(251,191,36,.45))}',
        '.pg-day .pg-da{display:flex;align-items:center;justify-content:center;gap:4px;font-size:16px;color:#fde68a}.pg-day .pg-da b{font-weight:400}',
        '.pg-day .pg-ds{font-size:9px;letter-spacing:.12em;color:#64748b;text-transform:uppercase;min-height:12px}',
        '.pg-day.future{opacity:.5;filter:saturate(.65)}',
        '.pg-day.done{border-color:rgba(52,211,153,.55);background:linear-gradient(180deg,rgba(6,78,59,.5),rgba(15,23,42,.85))}',
        '.pg-day.done .pg-ds{color:#34d399}',
        '.pg-day.done::after{content:"✓";position:absolute;top:6px;right:8px;width:22px;height:22px;border-radius:50%;background:#10b981;color:#fff;font-size:13px;line-height:22px;box-shadow:0 0 12px rgba(16,185,129,.8)}',
        '.pg-day.today{border:2px solid #f59e0b;background:linear-gradient(180deg,rgba(120,53,15,.55),rgba(30,20,10,.9));box-shadow:0 0 28px rgba(245,158,11,.5),inset 0 0 24px rgba(245,158,11,.18);animation:pgToday 1.6s ease-in-out infinite;transform:translateY(-4px)}',
        '.pg-day.today .pg-ds{color:#fbbf24}.pg-day.today .pg-dn{color:#fde68a}',
        '@keyframes pgToday{50%{box-shadow:0 0 44px rgba(245,158,11,.8),inset 0 0 30px rgba(245,158,11,.3)}}',
        '.pg-day.d7{border-color:rgba(232,121,249,.6);background:linear-gradient(180deg,rgba(88,28,135,.55),rgba(15,23,42,.9))}',
        '.pg-day.d7.today{border-color:#e879f9;box-shadow:0 0 34px rgba(232,121,249,.6),inset 0 0 26px rgba(232,121,249,.22);animation-name:pgToday7}',
        '@keyframes pgToday7{50%{box-shadow:0 0 54px rgba(232,121,249,.9),inset 0 0 34px rgba(232,121,249,.35)}}',
        '.pg-day.d7 .pg-di>div{width:clamp(64px,12vh,92px);height:clamp(64px,12vh,92px)}',
        '.pg-day.d7 .pg-cn{font-size:10px;letter-spacing:.06em;color:#f0abfc;line-height:1.15}',
        '.pg-day.d7 .pg-plus{font-size:9px;color:#c4b5fd;letter-spacing:.1em}',
        '.pg-day.d7::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.12) 50%,transparent 65%);transform:translateX(-120%);animation:pgShine 3.2s ease-in-out infinite}',
        '@keyframes pgShine{60%,100%{transform:translateX(120%)}}',
        '.pg-claimrow{display:flex;flex-direction:column;align-items:center;gap:10px;margin-top:20px}',
        '.pg-btn{position:relative;min-width:230px;padding:14px 26px;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:linear-gradient(180deg,#f59e0b,#b45309);color:#fff;font:inherit;font-size:16px;letter-spacing:.14em;cursor:pointer;box-shadow:0 8px 28px rgba(245,158,11,.45),inset 0 1px 0 rgba(255,255,255,.4);text-shadow:0 2px 6px rgba(0,0,0,.5);transition:.15s;overflow:hidden}',
        '.pg-btn:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 34px rgba(245,158,11,.65),inset 0 1px 0 rgba(255,255,255,.5)}',
        '.pg-btn:active:not(:disabled){transform:scale(.97)}',
        '.pg-btn:disabled{cursor:default;background:linear-gradient(180deg,#334155,#1e293b);box-shadow:none;color:#94a3b8;text-shadow:none;border-color:rgba(148,163,184,.25)}',
        '.pg-btn.go::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:skewX(-20deg);animation:pgBtnShine 2.4s ease-in-out infinite}',
        '@keyframes pgBtnShine{55%,100%{left:130%}}',
        '.pg-btn.busy{opacity:.7;pointer-events:none}',
        '.pg-note{max-width:620px;text-align:center;font-size:11px;line-height:1.5;letter-spacing:.04em;color:#94a3b8;font-family:Arial,sans-serif}',
        '.pg-note b{color:#fde68a}.pg-warn{color:#fca5a5}',
        /* --- завдання --- */
        '.pg-qh{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px}',
        '.pg-qs{display:grid;gap:12px}',
        '.pg-q{--c:96,165,250;position:relative;display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:center;padding:14px 16px;border-radius:16px;border:1px solid rgba(var(--c),.4);background:linear-gradient(100deg,rgba(var(--c),.14),rgba(15,23,42,.88) 55%);overflow:hidden;transition:.2s}',
        '.pg-q::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:rgb(var(--c));box-shadow:0 0 14px rgb(var(--c))}',
        '.pg-q.done{border-color:rgba(var(--c),.9);box-shadow:0 0 26px rgba(var(--c),.3)}',
        '.pg-q.claimed{opacity:.55;filter:saturate(.5)}',
        '.pg-qi{width:60px;height:60px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:30px;background:linear-gradient(145deg,rgba(var(--c),.4),rgba(2,6,23,.7));border:1px solid rgba(var(--c),.6);box-shadow:inset 0 0 16px rgba(var(--c),.3)}',
        '.pg-qm{min-width:0}.pg-qc{font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:rgb(var(--c));opacity:.9}',
        '.pg-qt{margin:3px 0 8px;font-size:15px;line-height:1.25;color:#f1f5f9;letter-spacing:.02em}',
        '.pg-bar{position:relative;height:12px;border-radius:7px;background:rgba(2,6,23,.75);border:1px solid rgba(var(--c,148,163,184),.35);overflow:hidden}',
        '.pg-bar i{position:absolute;inset:0 auto 0 0;width:0;border-radius:7px;background:linear-gradient(90deg,rgba(var(--c),.75),rgb(var(--c)));box-shadow:0 0 12px rgba(var(--c),.8);transition:width .6s cubic-bezier(.2,1,.3,1)}',
        '.pg-bar i::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent,rgba(255,255,255,.45),transparent);transform:translateX(-100%);animation:pgBar 2.2s ease-in-out infinite}',
        '@keyframes pgBar{60%,100%{transform:translateX(100%)}}',
        '.pg-bn{margin-top:4px;font-size:10px;letter-spacing:.1em;color:#94a3b8;font-variant-numeric:tabular-nums}',
        '.pg-qr{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:118px}',
        '.pg-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border-radius:999px;background:rgba(2,6,23,.65);border:1px solid rgba(251,191,36,.4);color:#fde68a;font-size:14px}.pg-chip b{font-weight:400}',
        '.pg-chip.case{border-color:rgba(232,121,249,.55);color:#f0abfc;font-size:11px}',
        '.pg-sm{padding:9px 16px;min-width:110px;font-size:12px;border-radius:11px;letter-spacing:.1em}',
        '.pg-sm.cy{background:linear-gradient(180deg,#06b6d4,#0e7490);box-shadow:0 6px 20px rgba(6,182,212,.4)}',
        '.pg-sm.gr{background:linear-gradient(180deg,#10b981,#047857);box-shadow:0 6px 20px rgba(16,185,129,.45)}',
        '.pg-sm.pu{background:linear-gradient(180deg,#a855f7,#6b21a8);box-shadow:0 6px 20px rgba(168,85,247,.45)}',
        '.pg-ghost{background:rgba(30,41,59,.7);border:1px solid rgba(148,163,184,.4);color:#cbd5e1;box-shadow:none;text-shadow:none;font-size:11px;padding:7px 12px;min-width:0}',
        '.pg-ghost:hover:not(:disabled){background:rgba(51,65,85,.9);box-shadow:none}',
        '.pg-tag{font-size:11px;letter-spacing:.1em;color:#34d399}',
        /* --- досягнення --- */
        '.pg-ah{display:flex;flex-direction:column;gap:10px;margin-bottom:14px}',
        '.pg-sum{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
        '.pg-sum .pg-bar{flex:1;min-width:140px;--c:168,85,247}.pg-sum b{color:#fff}',
        '.pg-sumt{font-size:13px;letter-spacing:.08em;color:#c4b5fd}',
        '.pg-chips{display:flex;gap:6px;flex-wrap:wrap}',
        '.pg-f{padding:6px 12px;border-radius:999px;border:1px solid rgba(148,163,184,.35);background:rgba(30,41,59,.6);color:#94a3b8;font:inherit;font-size:11px;letter-spacing:.06em;cursor:pointer;transition:.15s}',
        '.pg-f:hover{color:#fff;border-color:rgba(168,85,247,.7)}',
        '.pg-f[aria-pressed=true]{color:#fff;background:rgba(var(--fc,168,85,247),.3);border-color:rgb(var(--fc,168,85,247));box-shadow:0 0 12px rgba(var(--fc,168,85,247),.35)}',
        '.pg-sec{display:flex;align-items:center;gap:10px;margin:14px 0 10px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgb(var(--c))}',
        '.pg-sec::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(var(--c),.6),transparent)}',
        '.pg-sec span{color:#94a3b8;letter-spacing:.08em}',
        '.pg-ag{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}',
        '.pg-a{--c:148,163,184;position:relative;display:grid;grid-template-columns:56px 1fr;gap:12px;padding:12px;border-radius:14px;border:1px solid rgba(var(--c),.35);background:linear-gradient(145deg,rgba(var(--c),.1),rgba(15,23,42,.9) 60%);overflow:hidden;transition:.2s}',
        '.pg-a:hover{transform:translateY(-2px);border-color:rgba(var(--c),.8)}',
        '.pg-ai{position:relative;width:52px;height:52px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:27px;background:radial-gradient(circle at 35% 30%,rgba(var(--c),.55),rgba(2,6,23,.85));border:1px solid rgba(var(--c),.7);box-shadow:0 0 14px rgba(var(--c),.4)}',
        '.pg-a.lock .pg-ai{filter:grayscale(1) brightness(.55);box-shadow:none;border-color:rgba(100,116,139,.5)}',
        '.pg-a.lock .pg-ai::after{content:"🔒";position:absolute;right:-6px;bottom:-6px;font-size:15px;filter:none}',
        '.pg-a.lock{opacity:.82}.pg-a.lock .pg-an{color:#cbd5e1}',
        '.pg-a.ready{border-color:rgb(var(--c));box-shadow:0 0 22px rgba(var(--c),.5);animation:pgReady 1.8s ease-in-out infinite}',
        '@keyframes pgReady{50%{box-shadow:0 0 36px rgba(var(--c),.85)}}',
        '.pg-a.ready::before,.pg-a.t-legend.done::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.14) 50%,transparent 65%);transform:translateX(-120%);animation:pgShine 3s ease-in-out infinite;pointer-events:none}',
        '.pg-am{min-width:0;display:flex;flex-direction:column;gap:3px}',
        '.pg-an{font-size:14px;color:#fff;letter-spacing:.03em;line-height:1.15}',
        '.pg-ad{font-size:11px;line-height:1.3;color:#94a3b8;font-family:Arial,sans-serif;min-height:28px}',
        '.pg-a .pg-bar{height:8px;--c:var(--cc)}.pg-a .pg-bar i{background:linear-gradient(90deg,rgba(var(--c),.7),rgb(var(--c)))}',
        '.pg-af{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px}',
        '.pg-ap{font-size:10px;color:#94a3b8;letter-spacing:.08em;font-variant-numeric:tabular-nums}',
        '.pg-a .pg-chip{font-size:12px;padding:3px 8px}',
        '.pg-a .pg-sm{padding:6px 12px;min-width:0;font-size:11px}',
        '.pg-empty{padding:40px 10px;text-align:center;color:#64748b;font-size:13px;letter-spacing:.08em}',
        /* --- ефекти --- */
        '.pg-fx{position:fixed;left:0;top:0;width:0;height:0;z-index:9500;pointer-events:none}',
        '.pg-fx span{position:absolute;left:0;top:0;display:block;animation:pgFly .95s cubic-bezier(.15,.8,.3,1) forwards;will-change:transform,opacity}',
        '@keyframes pgFly{0%{transform:translate(0,0) rotate(0) scale(.4);opacity:1}70%{opacity:1}100%{transform:translate(var(--dx),var(--dy)) rotate(var(--r)) scale(1);opacity:0}}',
        '.pg-pop{position:fixed;z-index:9501;pointer-events:none;font-size:30px;color:#fde68a;text-shadow:0 0 18px rgba(245,158,11,.9),0 2px 6px #000;display:flex;align-items:center;gap:6px;animation:pgPop 1.4s ease-out forwards}',
        '@keyframes pgPop{0%{transform:translate(-50%,0) scale(.6);opacity:0}20%{transform:translate(-50%,-14px) scale(1.15);opacity:1}100%{transform:translate(-50%,-90px) scale(1);opacity:0}}',
        /* --- тости --- */
        '#pg-toasts{position:fixed;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);z-index:9000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;width:min(360px,94vw)}',
        '.pg-t{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border-radius:14px;background:linear-gradient(120deg,rgba(15,23,42,.96),rgba(8,12,28,.96));border:1px solid rgba(var(--c,34,211,238),.7);box-shadow:0 8px 30px rgba(0,0,0,.6),0 0 24px rgba(var(--c,34,211,238),.3);font-family:"Russo One",Arial,sans-serif;color:#e2e8f0;animation:pgTIn .35s cubic-bezier(.2,1.3,.4,1);transition:opacity .3s,transform .3s}',
        '.pg-t.out{opacity:0;transform:translateY(-12px)}',
        '.pg-t i{font-style:normal;font-size:24px;flex-shrink:0}.pg-t div{min-width:0;flex:1}',
        '.pg-t b{display:block;font-weight:400;font-size:13px;letter-spacing:.06em;color:#fff}.pg-t small{display:block;font-size:11px;color:#94a3b8;margin-top:1px;font-family:Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.pg-t.mini{width:auto;max-width:94vw;padding:5px 12px;gap:7px;border-radius:999px}.pg-t.mini i{font-size:15px}.pg-t.mini b{font-size:11px}.pg-t.mini small{display:none}',
        '@keyframes pgTIn{from{opacity:0;transform:translateY(-14px) scale(.92)}to{opacity:1;transform:none}}',
        '.pg-ach{--c:148,163,184;position:relative;display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;border-radius:18px;background:linear-gradient(120deg,rgba(var(--c),.3),rgba(8,12,28,.97) 70%);border:2px solid rgb(var(--c));box-shadow:0 12px 44px rgba(0,0,0,.7),0 0 40px rgba(var(--c),.6);overflow:hidden;pointer-events:auto;cursor:pointer;animation:pgAchIn .55s cubic-bezier(.2,1.4,.4,1);font-family:"Russo One",Arial,sans-serif;transition:opacity .4s,transform .4s}',
        '.pg-ach.out{opacity:0;transform:translateY(-16px) scale(.96)}',
        '.pg-ach::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);animation:pgShine 1.6s .3s ease-out 2}',
        '.pg-ach .pg-ai{width:62px;height:62px;font-size:34px;flex-shrink:0;animation:pgIcoPop .7s .15s cubic-bezier(.2,1.6,.4,1) both}',
        '.pg-ach .k{font-size:10px;letter-spacing:.22em;color:rgb(var(--c));text-transform:uppercase}',
        '.pg-ach .n{font-size:18px;color:#fff;line-height:1.15;margin:2px 0}.pg-ach .d{font-size:11px;color:#94a3b8;font-family:Arial,sans-serif;line-height:1.3}',
        '.pg-ach .r{margin-top:6px}',
        '@keyframes pgAchIn{from{opacity:0;transform:translateY(-40px) scale(.8)}to{opacity:1;transform:none}}',
        '@keyframes pgIcoPop{from{transform:scale(0) rotate(-90deg)}to{transform:none}}',
        /* --- меню --- */
        /* --- адаптив --- */
        '@media (max-width:760px){.pg-day .pg-dn{letter-spacing:.06em;padding:0 10px}.pg-day.done::after{width:18px;height:18px;line-height:18px;font-size:11px;top:4px;right:4px}.pg-days{grid-template-columns:repeat(4,1fr)}.pg-day.d7{grid-column:span 2}.pg-day{min-height:150px}.pg-q{grid-template-columns:48px 1fr;padding:12px}.pg-qi{width:46px;height:46px;font-size:23px}.pg-qr{grid-column:1/-1;flex-direction:row;justify-content:space-between;min-width:0}.pg-title{font-size:15px}.pg-tab{font-size:10px;letter-spacing:.04em;gap:5px}.pg-tab i{font-size:15px}.pg-body{padding:12px}.pg-ag{grid-template-columns:1fr}}',
        '@media (max-width:480px){.pg-back{padding:0}.pg-box{border-radius:0;height:100%}.pg-tab span{display:none}.pg-tab[aria-selected=true] span{display:inline}.pg-bal{padding:4px 9px;font-size:12px}}',
        '@media (max-height:520px){.pg-back{padding:0}.pg-box{border-radius:0;height:100%}.pg-hd{padding-top:6px}.pg-tabs{padding-top:6px}.pg-tab{padding:6px}.pg-title{font-size:14px}.pg-day{min-height:122px;padding:8px 4px}.pg-day .pg-di{height:40px}.pg-body{padding:10px 14px}.pg-btn{padding:9px 20px;font-size:13px}.pg-claimrow{margin-top:10px;gap:6px}.pg-dh{margin-bottom:8px}}',
        '@media (max-height:520px){.pg-day{min-height:138px}.pg-day .pg-di,.pg-day.d7 .pg-di{height:42px}.pg-day.d7 .pg-di>div{width:42px;height:42px}.pg-note{font-size:10px}.pg-day.d7 .pg-plus{display:none}}',
        '@media (max-height:520px) and (min-width:761px){.pg-days{gap:6px}.pg-day .pg-da{font-size:13px}}',
        /* --- телефон: безпечні зони, цілі дотику ≥44px, мінімальний шрифт --- */
        '.pg-back{padding-left:max(12px,calc(env(safe-area-inset-left,0px)/var(--ui-wz,1)));padding-right:max(12px,calc(env(safe-area-inset-right,0px)/var(--ui-wz,1)))}.pg-body{overscroll-behavior:contain}.pg-box{max-height:100%}',
        '@media (max-width:480px),(max-height:520px){.pg-back{padding-left:calc(env(safe-area-inset-left,0px)/var(--ui-wz,1));padding-right:calc(env(safe-area-inset-right,0px)/var(--ui-wz,1));padding-top:calc(env(safe-area-inset-top,0px)/var(--ui-wz,1));padding-bottom:calc(env(safe-area-inset-bottom,0px)/var(--ui-wz,1))}}',
        '@media (hover:none) and (pointer:coarse){.pg-x{width:44px;height:44px}.pg-tab{min-height:44px}.pg-btn{min-height:40px}.pg-btn.pg-ghost,.pg-btn.pg-sm,.pg-a .pg-sm{min-height:40px}.pg-f{min-height:40px;min-width:40px;padding:8px 13px;font-size:12px}.pg-dn,.pg-ap,.pg-bn,.pg-ach .k,.pg-tab,.pg-dot{font-size:11px}.pg-ad,.pg-note,.pg-chip.case,.pg-t small{font-size:12px}}',
        '@media (hover:none) and (pointer:coarse){#pg-toasts:has(.pg-t.mini){left:auto;right:max(12px,env(safe-area-inset-right,0px));transform:none;top:max(84px,calc(env(safe-area-inset-top,0px) + 76px));align-items:flex-end}}',
        '.pg-bal{white-space:nowrap;flex-shrink:0}.pg-day .pg-dn{white-space:nowrap}@media (max-width:360px){.pg-day .pg-dn{letter-spacing:0;padding:0 4px}}@media (hover:none) and (pointer:coarse) and (max-height:520px){.pg-x{width:48px;height:48px}.pg-tab{min-height:48px}.pg-btn.pg-ghost,.pg-btn.pg-sm,.pg-a .pg-sm{min-height:44px}.pg-f{min-height:42px}.pg-btn{min-height:40px}}',
        'html.gfx-low .pg-back{backdrop-filter:none;-webkit-backdrop-filter:none}',
        'html.gfx-low .pg-day.today,html.gfx-low .pg-a.ready,html.gfx-low .pg-dot{animation:none}',
        'html.gfx-low .pg-day.d7::before,html.gfx-low .pg-a.ready::before,html.gfx-low .pg-bar i::after,html.gfx-low .pg-btn.go::after{animation:none;display:none}',
        '@media (prefers-reduced-motion:reduce){.pg-box,.pg-back,.pg-pane,.pg-t,.pg-ach,.pg-day.today,.pg-a.ready,.pg-dot{animation:none!important;transition:none!important}.pg-day.d7::before,.pg-bar i::after,.pg-btn.go::after{display:none}}'
    ].join('');
    function addCss() { if ($('pg-css')) return; var st = document.createElement('style'); st.id = 'pg-css'; st.textContent = CSS; document.head.appendChild(st); }

    // ---------- ефекти ----------
    function burst(el, n, kind) {
        if (reduce()) return; n = lowGfx() ? Math.min(n, 6) : n;
        var r = el.getBoundingClientRect(), z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
        var fx = document.createElement('div'); fx.className = 'pg-fx'; fx.style.left = (r.left + r.width / 2) + 'px'; fx.style.top = (r.top + r.height / 2) + 'px';
        var parts = kind === 'star' ? ['✨', '⭐', '💫'] : null;
        for (var i = 0; i < n; i++) {
            var s = document.createElement('span'), a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 150;
            s.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px'); s.style.setProperty('--dy', (Math.sin(a) * d - 40).toFixed(0) + 'px'); s.style.setProperty('--r', ((Math.random() - 0.5) * 540).toFixed(0) + 'deg');
            s.style.animationDelay = (Math.random() * 120).toFixed(0) + 'ms';
            s.innerHTML = parts ? '<em style="font-style:normal;font-size:' + (14 + Math.random() * 14).toFixed(0) + 'px">' + parts[i % parts.length] + '</em>' : cr(16 + Math.floor(Math.random() * 12));
            fx.appendChild(s);
        }
        document.body.appendChild(fx); setTimeout(function () { fx.remove(); }, 1500);
    }
    function pop(el, text) {
        if (reduce()) return; var r = el.getBoundingClientRect(), p = document.createElement('div'); p.className = 'pg-pop';
        p.style.left = (r.left + r.width / 2) + 'px'; p.style.top = (r.top + r.height * 0.3) + 'px'; p.innerHTML = '<b style="font-weight:400">' + esc(text) + '</b>' + cr(26);
        document.body.appendChild(p); setTimeout(function () { p.remove(); }, 1500);
    }

    // ---------- тости ----------
    var tq = [], tBusy = false;
    function toastHost() { var h = $('pg-toasts'); if (!h) { h = document.createElement('div'); h.id = 'pg-toasts'; document.body.appendChild(h); } return h; }
    function toast(o) {
        if (tq.length > 4) tq.shift(); tq.push(o); if (!tBusy) nextToast();
    }
    function nextToast() {
        var o = tq.shift(); if (!o) { tBusy = false; return; } tBusy = true;
        var host = toastHost(), el = document.createElement('div');
        if (o.ach) {
            var th = TIERS[o.ach.tier] || TIERS.easy;
            el.className = 'pg-ach'; el.style.setProperty('--c', th.c);
            el.innerHTML = '<div class="pg-ai">' + esc(o.ach.ico) + '</div><div style="min-width:0;flex:1"><div class="k">Досягнення відкрито · ' + esc(th.n) + '</div><div class="n">' + esc(o.ach.name) + '</div><div class="d">' + esc(o.ach.desc) + '</div><div class="r pg-chip">' + cr(14) + '<b>+' + esc(o.ach.reward.c) + '</b>' + (o.ach.reward.caseId ? ' <span style="font-size:11px">+ кейс</span>' : '') + '</div></div>';
            el.addEventListener('click', function () { openAchievements(); });
            snd(REVEAL[o.ach.tier] || 'reveal_common', 'powerup');
            var big = o.ach.tier === 'hard' || o.ach.tier === 'legend'; if (!reduce()) setTimeout(function () { burst(el, big ? 22 : 10, 'star'); }, 250);
        } else {
            el.className = 'pg-t' + (o.mini ? ' mini' : ''); el.style.setProperty('--c', o.c || '34,211,238');
            el.innerHTML = '<i>' + esc(o.ico || '📋') + '</i><div><b>' + esc(o.title) + '</b>' + (o.sub ? '<small>' + esc(o.sub) + '</small>' : '') + '</div>';
            if (o.sound) snd(o.sound, 'ui_confirm');
        }
        host.appendChild(el);
        var life = o.ach ? 5200 : (o.mini ? 2300 : 3200);
        setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); nextToast(); }, 380); }, life);
    }

    // ---------- каркас вікна ----------
    function build() {
        if (root) return; addCss();
        root = document.createElement('div'); root.id = 'pg-modal'; root.className = 'pg-back'; root.hidden = true;
        root.innerHTML = '<div class="pg-box" role="dialog" aria-modal="true" aria-labelledby="pg-title" data-t="daily"><i class="pg-glow" aria-hidden="true"></i>' +
            '<div class="pg-hd"><div class="pg-title" id="pg-title">ЗАВДАННЯ</div><div class="pg-bal" title="Баланс"><span id="pg-bal">0</span></div><button type="button" class="pg-x" id="pg-x" aria-label="Закрити">✕</button></div>' +
            '<div class="pg-tabs" role="tablist" aria-label="Розділи">' +
            '<button type="button" role="tab" class="pg-tab" data-k="daily" aria-selected="true"><i>🎁</i><span>Щоденний бонус</span><em class="pg-dot" hidden></em></button>' +
            '<button type="button" role="tab" class="pg-tab" data-k="quests" aria-selected="false" tabindex="-1"><i>📋</i><span>Завдання</span><em class="pg-dot" hidden></em></button>' +
            '<button type="button" role="tab" class="pg-tab" data-k="ach" aria-selected="false" tabindex="-1"><i>🏅</i><span>Досягнення</span><em class="pg-dot" hidden></em></button></div>' +
            '<div class="pg-body" id="pg-body" role="tabpanel"></div></div>';
        document.body.appendChild(root);
        root.addEventListener('pointerdown', function (e) { if (e.target === root) close(); });
        root.addEventListener('click', onClick);
        root.addEventListener('keydown', function (e) {
            var k = e.target.getAttribute && e.target.getAttribute('data-k');
            if (k && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); var ks = ['daily', 'quests', 'ach'], i = ks.indexOf(k) + (e.key === 'ArrowRight' ? 1 : -1); setTab(ks[(i + 3) % 3], true); }
        });
        document.addEventListener('keydown', onKey, true);
    }
    function onKey(e) {
        if (!isOpen || dlgOpen()) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'Tab') {
            var f = Array.prototype.filter.call(root.querySelectorAll('button:not(:disabled),[tabindex="0"]'), function (el) { return !el.hidden && el.offsetParent !== null && el.tabIndex >= 0; });
            if (!f.length) return; var a = f[0], z = f[f.length - 1];
            if (!root.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
            else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
            else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        }
    }
    function setTab(k, focus) {
        tab = (k === 'quests' || k === 'ach') ? k : 'daily';
        root.querySelector('.pg-box').setAttribute('data-t', tab);
        Array.prototype.forEach.call(root.querySelectorAll('.pg-tab'), function (b) { var on = b.getAttribute('data-k') === tab; b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
        $('pg-title').textContent = tab === 'daily' ? 'ЩОДЕННИЙ БОНУС' : tab === 'quests' ? 'ЩОДЕННІ ЗАВДАННЯ' : 'ДОСЯГНЕННЯ';
        render(true); var b = $('pg-body'); if (b) b.scrollTop = 0;
    }
    function open(k) {
        build();
        if (!bound) bind();
        lastFocus = document.activeElement;
        if (!isOpen) {
            isOpen = true; root.hidden = false; void root.offsetWidth; root.classList.add('on');
            snd('ui_open', 'ui_click');
            try { socket.emit('getProgress'); } catch (e) {}
            tickT = setInterval(tick, 1000);
            setTimeout(function () { var t = root.querySelector('.pg-tab[aria-selected=true]'); if (t) t.focus(); }, 40);
        }
        setTab(k || tab, false);
    }
    function close() {
        if (!isOpen) return; isOpen = false; clearInterval(tickT); root.classList.remove('on');
        setTimeout(function () { if (!isOpen) root.hidden = true; }, reduce() ? 0 : 180);
        try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }

    // ---------- відмальовка ----------
    function render(anim) {
        if (!root || !isOpen) { updateBadges(); return; }
        var b = $('pg-body'), top = b.scrollTop, bal = $('pg-bal');
        if (bal && typeof myBucks !== 'undefined') bal.innerHTML = cr(18) + ' <b style="font-weight:400">' + esc(myBucks) + '</b>';
        updateBadges();
        if (!S) { b.innerHTML = '<div class="pg-empty">Завантаження…</div>'; return; }
        var ph = '<div class="pg-pane' + (tab === 'daily' ? ' dly' : '') + '">' + (tab === 'daily' ? dailyHtml() : tab === 'quests' ? questsHtml() : achHtml()) + '</div>';
        if (!anim && b.__ph === ph && b.firstChild) { tick(); return; }
        var sameTab = b.__tk === tab; b.__tk = tab; b.__ph = ph;
        if (!anim && sameTab && window.DomPatch && b.firstChild) { DomPatch.html(b, ph); b.scrollTop = top; }   // фонове оновлення: лише змінені вузли
        else { b.innerHTML = ph; if (!anim) { var p = b.firstChild; if (p) p.style.animation = 'none'; b.scrollTop = top; } }
        tick();
    }
    function updateBadges() {
        var bd = (S && S.badge) || {}, ks = { daily: bd.daily | 0, quests: bd.quests | 0, ach: bd.ach | 0 };
        if (root) Array.prototype.forEach.call(root.querySelectorAll('.pg-tab'), function (t) { var d = t.querySelector('.pg-dot'), n = ks[t.getAttribute('data-k')]; if (d) { d.hidden = !n; d.textContent = n || ''; } });
        if (window.MenuHub) MenuHub.badge('mm-progress', badgeTotal());
    }
    function dayCard(i, D) {
        var idx = i + 1, claimedCur = D.claimedToday, st = idx < D.cur || (idx === D.cur && claimedCur) ? 'done' : (idx === D.cur ? 'today' : 'future'), amt = D.rewards[i];
        var stTxt = st === 'done' ? 'Отримано' : st === 'today' ? 'Сьогодні' : (idx === D.cur + 1 && claimedCur ? 'Завтра' : '');
        var ico, extra = '';
        if (idx === 7) {
            var cs = (typeof CASES !== 'undefined') ? CASES[D.caseId] : null;
            ico = '<div>' + (cs && typeof caseIcon === 'function' ? caseIcon(cs) : '🎁') + '</div>';
            extra = '<div class="pg-plus">+ КЕЙС</div><div class="pg-cn">«' + esc(D.caseName) + '»</div>';
        } else {
            var sz = 34 + idx * 5; ico = cr(sz);
        }
        return '<div class="pg-day ' + st + (idx === 7 ? ' d7' : '') + '" data-day="' + idx + '"><div class="pg-dn">ДЕНЬ ' + idx + '</div><div class="pg-di">' + ico + '</div><div class="pg-da">' + cr(15) + '<b>+' + amt + '</b></div>' + extra + '<div class="pg-ds">' + stTxt + '</div></div>';
    }
    function dailyHtml() {
        var D = S.daily, total = D.rewards.reduce(function (a, b) { return a + b; }, 0), h = '';
        h += '<div class="pg-dh"><div class="pg-streak">🔥 Серія: <b>' + D.streak + '</b> / 7</div><div class="pg-timer">' + (D.canClaim ? 'Бонус чекає на вас' : 'Наступний бонус через <b id="pg-t1">' + hms(S.next - now()) + '</b>') + '</div></div>';
        h += '<div class="pg-days">'; for (var i = 0; i < 7; i++) h += dayCard(i, D); h += '</div>';
        h += '<div class="pg-claimrow"><button type="button" class="pg-btn' + (D.canClaim ? ' go' : '') + '" id="pg-claim-d"' + (D.canClaim ? '' : ' disabled') + '>' + (D.canClaim ? 'ЗАБРАТИ' : 'ОТРИМАНО ✓') + '</button>';
        h += '<p class="pg-note">За 7 днів поспіль: <b>' + total + '</b> кредитів і <b>кейс</b> на 7-й день. Пропустиш день — серія почнеться з першого. День змінюється о 00:00 за київським часом.' + (D.streak === 0 && D.total > 0 && D.canClaim ? '<br><span class="pg-warn">Серію перервано — відлік знову з 1-го дня.</span>' : '') + '</p></div>';
        return h;
    }
    function questsHtml() {
        var h = '<div class="pg-qh"><div class="pg-timer">Нові завдання через <b id="pg-t2">' + hms(S.next - now()) + '</b></div><div class="pg-timer">' + (S.rerolled ? 'Заміну сьогодні використано' : 'Одне завдання можна замінити раз на день') + '</div></div><div class="pg-qs">';
        S.quests.forEach(function (q) {
            var pct = Math.round(q.p / q.goal * 100), c = QCAT[q.cat] || '34,211,238', act;
            if (q.claimed) act = '<span class="pg-tag">✓ ОТРИМАНО</span>';
            else if (q.done) act = '<button type="button" class="pg-btn pg-sm gr go" data-claim-q="' + q.i + '">ЗАБРАТИ</button>';
            else act = '<button type="button" class="pg-btn pg-ghost" data-reroll="' + q.i + '"' + (S.rerolled ? ' disabled title="Заміна вже використана"' : '') + '>⟳ Замінити</button>';
            h += '<div class="pg-q' + (q.done ? ' done' : '') + (q.claimed ? ' claimed' : '') + '" style="--c:' + c + '"><div class="pg-qi">' + esc(q.ico) + '</div><div class="pg-qm"><div class="pg-qc">' + esc(QCAT_N[q.cat] || '') + '</div><div class="pg-qt">' + esc(q.text) + '</div><div class="pg-bar"><i style="width:' + pct + '%"></i></div><div class="pg-bn">' + q.p + ' / ' + q.goal + '</div></div><div class="pg-qr"><div class="pg-chip">' + cr(16) + '<b>+' + q.reward + '</b></div>' + act + '</div></div>';
        });
        return h + '</div><p class="pg-note" style="margin:16px auto 0">Прогрес рахується автоматично під час гри. Нагороду потрібно забрати до півночі за Києвом.</p>';
    }
    function achHtml() {
        var list = S.ach, tot = list.length, dn = list.filter(function (a) { return a.done; }).length, h = '';
        var chip = function (grp, key, label, cur, col) { return '<button type="button" class="pg-f" data-f="' + grp + ':' + key + '" aria-pressed="' + (cur === key) + '"' + (col ? ' style="--fc:' + col + '"' : '') + '>' + label + '</button>'; };
        h += '<div class="pg-ah"><div class="pg-sum"><div class="pg-sumt">Відкрито <b>' + dn + '</b> / ' + tot + '</div><div class="pg-bar"><i style="width:' + Math.round(dn / tot * 100) + '%"></i></div></div><div class="pg-chips">' + chip('t', 'all', 'Усі', fTier);
        TIER_ORDER.forEach(function (t) { h += chip('t', t, TIERS[t].n, fTier, TIERS[t].c); });
        h += '</div><div class="pg-chips">' + chip('s', 'all', 'Усі', fSt) + chip('s', 'ready', '🎁 Нагорода', fSt, '16,185,129') + chip('s', 'open', 'Відкриті', fSt, '52,211,153') + chip('s', 'lock', 'Закриті', fSt, '100,116,139') + '</div></div>';
        var shown = 0;
        TIER_ORDER.forEach(function (t) {
            if (fTier !== 'all' && fTier !== t) return;
            var items = list.filter(function (a) { return a.tier === t && (fSt === 'all' || (fSt === 'ready' && a.done && !a.claimed) || (fSt === 'open' && a.done) || (fSt === 'lock' && !a.done)); });
            if (!items.length) return; shown += items.length;
            var tdn = list.filter(function (a) { return a.tier === t && a.done; }).length, tall = list.filter(function (a) { return a.tier === t; }).length;
            h += '<div class="pg-sec" style="--c:' + TIERS[t].c + '">' + TIERS[t].n + ' <span>' + tdn + ' / ' + tall + '</span></div><div class="pg-ag">';
            items.forEach(function (a) {
                var pct = Math.round(a.p / a.goal * 100), rdy = a.done && !a.claimed, cls = 'pg-a t-' + t + (a.done ? ' done' : ' lock') + (rdy ? ' ready' : '');
                var rew = '<span class="pg-chip">' + cr(13) + '<b>+' + a.reward.c + '</b>' + (a.reward.caseId ? ' <span style="font-size:10px;color:#f0abfc">+ кейс</span>' : '') + '</span>';
                var act = a.claimed ? '<span class="pg-tag">✓ ОТРИМАНО</span>' : rdy ? '<button type="button" class="pg-btn pg-sm pu go" data-claim-a="' + esc(a.id) + '">ЗАБРАТИ +' + a.reward.c + (a.reward.caseId ? ' + 🎁' : '') + '</button>' : rew;
                h += '<div class="' + cls + '" style="--c:' + TIERS[t].c + ';--cc:' + TIERS[t].c + '"><div class="pg-ai">' + esc(a.ico) + '</div><div class="pg-am"><div class="pg-an">' + esc(a.name) + '</div><div class="pg-ad">' + esc(a.desc) + '</div><div class="pg-bar"><i style="width:' + pct + '%"></i></div><div class="pg-af"><span class="pg-ap">' + a.p + ' / ' + a.goal + '</span>' + act + '</div></div></div>';
            });
            h += '</div>';
        });
        if (!shown) h += '<div class="pg-empty">Нічого не знайдено за цим фільтром</div>';
        return h;
    }
    function tick() {
        if (!S) return; var ms = S.next - now(), a = $('pg-t1'), b = $('pg-t2');
        if (a) a.textContent = hms(ms); if (b) b.textContent = hms(ms);
        if (ms <= 0 && !tick._req) { tick._req = true; setTimeout(function () { tick._req = false; try { socket.emit('getProgress'); } catch (e) {} }, 1500); }
    }

    // ---------- дії ----------
    function setBusy(k, v) { busy[k] = v ? Date.now() : 0; }
    function isBusy(k) { return busy[k] && Date.now() - busy[k] < 3000; }
    function onClick(e) {
        var t = e.target.closest && e.target.closest('button'); if (!t) return;
        if (t.id === 'pg-x') return close();
        var k = t.getAttribute('data-k'); if (k) return setTab(k, false);
        if (t.id === 'pg-claim-d') { if (isBusy('d')) return; setBusy('d', 1); t.classList.add('busy'); return emit('claimDaily'); }
        var q = t.getAttribute('data-claim-q'); if (q != null) { if (isBusy('q' + q)) return; setBusy('q' + q, 1); t.classList.add('busy'); lastBtn = t; return emit('claimQuest', +q); }
        var rr = t.getAttribute('data-reroll'); if (rr != null) { if (isBusy('r')) return; setBusy('r', 1); return emit('rerollQuest', +rr); }
        var a = t.getAttribute('data-claim-a'); if (a) { if (isBusy('a' + a)) return; setBusy('a' + a, 1); t.classList.add('busy'); lastBtn = t; return emit('claimAch', a); }
        var f = t.getAttribute('data-f'); if (f) { var p = f.split(':'); if (p[0] === 't') fTier = p[1]; else fSt = p[1]; render(false); }
    }
    var lastBtn = null;
    function emit(ev, arg) { try { if (typeof socket === 'undefined' || !socket.connected) { toast({ ico: '📡', title: 'Немає зв’язку з сервером', c: '248,113,113', mini: true }); busy = {}; return render(false); } socket.emit(ev, arg); } catch (e) {} }

    // ---------- сокет ----------
    function bind() {
        if (bound || typeof socket === 'undefined') return; bound = true;
        socket.on('progressState', function (st) {
            if (!st || !st.daily) return; S = st; off = (+st.now || Date.now()) - Date.now(); busy = {};
            if (isOpen) render(false); else updateBadges();
            if (st.why === 'login') scheduleAuto();
        });
        socket.on('dailyClaimed', function (d) {
            snd('ui_buy', 'ui_buy'); var btn = $('pg-claim-d') || root; if (isOpen) { var card = root.querySelector('.pg-day.today') || btn; burst(card, d.caseId ? 30 : 18); pop(card, '+' + d.credits); }
            else toast({ ico: '🎁', title: 'Щоденний бонус: +' + d.credits, sub: d.caseId ? 'і кейс — зараз відкриється' : 'Серія: день ' + d.idx, c: '245,158,11', sound: 'ui_buy' });
            if (d.caseId) snd('case_confirm', 'powerup');
        });
        socket.on('questClaimed', function (d) { snd('ui_buy', 'ui_buy'); if (lastBtn && document.body.contains(lastBtn)) { burst(lastBtn, 14); pop(lastBtn, '+' + d.reward); } else toast({ ico: '💰', title: 'Нагорода: +' + d.reward, c: '250,204,21', mini: true }); });
        socket.on('achClaimed', function (d) { snd('ui_buy', 'ui_buy'); if (lastBtn && document.body.contains(lastBtn)) { burst(lastBtn, d.caseId ? 26 : 16); pop(lastBtn, '+' + d.credits); } });
        socket.on('questRerolled', function () { snd('ui_confirm', 'ui_click'); });
        socket.on('questProgress', function (d) {
            if (!d || !S || !S.quests || !S.quests[d.i]) return;
            var q = S.quests[d.i]; q.p = d.p; q.done = !!d.done; if (S.badge && d.done) S.badge.quests = (S.badge.quests | 0) + 1;
            if (isOpen && tab === 'quests') render(false); else updateBadges();
            var ig = inGame();
            if (d.done) toast({ ico: d.ico || '✅', title: 'Завдання виконано!', sub: d.text, c: '34,211,238', mini: ig, sound: ig ? null : 'ui_confirm' });
            else if (!ig && !isOpen) { var t = Date.now(); if (t - lastQP > 2500) { lastQP = t; toast({ ico: d.ico || '📋', title: 'Завдання: ' + d.p + ' / ' + d.goal, sub: d.text, c: '34,211,238', mini: true }); } }
        });
        socket.on('achUnlocked', function (a) {
            if (!a) return; if (S && S.ach) { for (var i = 0; i < S.ach.length; i++) if (S.ach[i].id === a.id) { S.ach[i] = a; } if (S.badge) S.badge.ach = S.ach.filter(function (x) { return x.done && !x.claimed; }).length; }
            if (isOpen && tab === 'ach') render(false); else updateBadges();
            if (inGame()) toast({ ico: a.ico, title: 'Досягнення: ' + a.name, c: (TIERS[a.tier] || TIERS.easy).c, mini: true, sound: 'ui_notify' });
            else toast({ ach: a });
        });
        socket.on('progressError', function (d) { snd('ui_error', 'hurt'); toast({ ico: '⚠️', title: (d && d.msg) || 'Не вдалося', c: '248,113,113', mini: false }); busy = {}; if (isOpen) render(false); });
        socket.on('economyUpdate', function () { if (isOpen) { var bal = $('pg-bal'); if (bal && typeof myBucks !== 'undefined') bal.innerHTML = cr(18) + ' <b style="font-weight:400">' + esc(myBucks) + '</b>'; } });
        socket.on('connect', function () { /* стан прийде після авторизації (подія login) */ });
    }
    var lastQP = 0;

    // автопоказ вікна бонусу: один раз за сесію, лише в меню й не поверх інших вікон
    function scheduleAuto() {
        if (autoShown || !S || !S.daily.canClaim || autoT) return;
        var tries = 0;
        autoT = setInterval(function () {
            tries++;
            if (autoShown || !S || !S.daily.canClaim || tries > 60) { clearInterval(autoT); autoT = 0; return; }
            if (inGame() || !menuVisible() || dlgOpen() || isOpen) return;
            var other = document.querySelector('.wl-back:not([hidden]),.modal:not(.hidden)'); if (other && vis(other)) return;
            autoShown = true; clearInterval(autoT); autoT = 0; open('daily');
        }, 1200);
    }

    // ---------- старт ----------
    function init() {
        addCss(); bind();
        if (window.MenuHub) {
            MenuHub.addCard({ id: 'mm-progress', icon: '🏅', title: 'ЗАВДАННЯ', sub: 'БОНУС · ЗАВДАННЯ · НАГОРОДИ', color: 'amber', bg: '🎁', onClick: function () { open(S && S.daily && S.daily.canClaim ? 'daily' : (S && S.badge && S.badge.quests ? 'quests' : (S && S.badge && S.badge.ach ? 'ach' : tab))); } });
            setTimeout(updateBadges, 300);
        }
        if (!bound) { var n = 0, iv = setInterval(function () { bind(); if (bound || ++n > 40) clearInterval(iv); }, 250); }
    }
    window.Progress = {
        openDaily: function () { open('daily'); }, openQuests: function () { open('quests'); }, openAchievements: function () { open('ach'); },
        refresh: function () { try { socket.emit('getProgress'); } catch (e) {} }, close: close, state: function () { return S; }, _toast: toast
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
