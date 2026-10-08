/* profile.js — профіль гравця, зміна імені/пароля, сезонний рейтинг, підсумки бою, відображувані імена.
 *   dispName(p)            — '[ТЕГ] ' + (nick||name) для об'єкта гравця, або те саме для рядка-логіна (через NickCache)
 *   NickCache              — { LOGIN: { nick, clan } }
 *   Profile.open(loginOrPid?)   — вікно профілю (без аргументу — свій); Profile.close(); Profile.avatar(login, size)
 *   Ranking.open() / Ranking.close()
 *   PostMatch.addExtra(html)    — додати блок у підсумки бою (контейнер #ps-extra) */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var tt = function (s) { return (window.I18N && I18N.t) ? I18N.t(s) : s; };
    var num = function (n) { return Math.round(+n || 0).toLocaleString('uk-UA').replace(/[  ]/g, ' '); };
    var low = function () { return document.documentElement.classList.contains('gfx-low'); };
    var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var MODS = function () { return typeof MODULES !== 'undefined' ? MODULES : null; }, RAR = function () { return typeof RARITY !== 'undefined' ? RARITY : null; }, CATN = function () { return typeof CAT_NAMES !== 'undefined' ? CAT_NAMES : null; }, SVGI = function () { return typeof SVG_ICONS !== 'undefined' ? SVG_ICONS : null; };
    var NAME_RE = /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9_-]{3,12}$/;

    // =====================================================================================
    //  Відображувані імена
    // =====================================================================================
    var NC = window.NickCache = window.NickCache || Object.create(null);
    var asked = Object.create(null), askQ = [], askT = 0;
    function setNick(login, nick, clan) {
        if (!login || typeof login !== 'string') return;
        var c = NC[login] || (NC[login] = { nick: '', clan: '' });
        if (nick !== undefined && nick !== null) c.nick = String(nick);
        if (clan !== undefined && clan !== null) c.clan = typeof clan === 'string' ? clan : '';
    }
    function ask(login) {
        if (asked[login] || !NAME_RE.test(login) || typeof socket === 'undefined') return;
        asked[login] = 1; askQ.push(login);
        if (!askT) askT = setTimeout(function () { askT = 0; var n = askQ.splice(0, 60); if (n.length) socket.emit('getNicks', { names: n }); }, 250);
    }
    window.dispName = function (p) {
        if (p == null) return '';
        if (typeof p === 'string') {
            var c = NC[p];
            if (!c) { ask(p); return p; }
            return (c.clan ? '[' + c.clan + '] ' : '') + (c.nick || p);
        }
        if (typeof p === 'object') {
            var nm = p.name, clan = typeof p.clan === 'string' ? p.clan : '';
            if (nm && typeof nm === 'string' && typeof p.nick === 'string' && !p.isBot) { var k = NC[nm]; if (!k || k.nick !== p.nick || k.clan !== clan) setNick(nm, p.nick, clan); }
            return (clan ? '[' + clan + '] ' : '') + (p.nick || nm || '');
        }
        return String(p);
    };
    function nickChanged() { try { window.dispatchEvent(new Event('nickcache')); } catch (e) {} }

    // =====================================================================================
    //  Аватар (генерується за логіном)
    // =====================================================================================
    var avUid = 0;
    function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function avatar(login, size, ring) {
        login = String(login || '?'); size = size || 48;
        var h = hash(login), h1 = h % 360, h2 = (h1 + 40 + (h >>> 9) % 90) % 360, pat = (h >>> 5) % 4, id = 'pfav' + (++avUid);
        var ini = (login.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9]/g, '')[0] || '?').toUpperCase(), g = '';
        if (pat === 0) g = '<circle cx="14" cy="50" r="22" fill="#fff" opacity=".14"/><circle cx="56" cy="12" r="16" fill="#fff" opacity=".12"/>';
        else if (pat === 1) g = '<g stroke="#fff" stroke-opacity=".16" stroke-width="6"><path d="M-10 30L30 -10M-10 52L52 -10M-10 74L74 -10M12 80L80 12M34 80L80 34"/></g>';
        else if (pat === 2) g = '<path d="M32 -4L56 10V38L32 52L8 38V10Z" transform="translate(6 14) scale(.9)" fill="#fff" opacity=".13"/><path d="M52 40l12 7v14l-12 7-12-7V47z" fill="#fff" opacity=".12"/>';
        else g = '<path d="M0 64L32 8L64 64Z" fill="#fff" opacity=".12"/><path d="M-6 30L20 -4L46 30Z" fill="#fff" opacity=".1"/>';
        return '<span class="pf-av' + (ring ? ' ring' : '') + '" style="width:' + size + 'px;height:' + size + 'px;font-size:' + Math.round(size * 0.46) + 'px"><svg viewBox="0 0 64 64" width="100%" height="100%" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(' + h1 + ',72%,52%)"/><stop offset="1" stop-color="hsl(' + h2 + ',70%,26%)"/></linearGradient></defs><rect width="64" height="64" fill="url(#' + id + ')"/>' + g + '</svg><b>' + esc(ini) + '</b></span>';
    }

    // =====================================================================================
    //  CSS
    // =====================================================================================
    var css = [
        '.pf-ov{position:fixed;inset:0;z-index:78;display:flex;align-items:center;justify-content:center;padding:10px;background:rgba(2,6,23,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);zoom:var(--ui-zoom,1);opacity:0;pointer-events:none;transition:opacity .22s}',
        '.pf-ov *,.pf-ov *::before,.pf-ov *::after{box-sizing:border-box}',
        '.pf-ov.on{opacity:1;pointer-events:auto}.pf-ov.hidden{display:none}',
        '.pf-panel{position:relative;width:min(1020px,100%);max-height:calc(var(--uvh,1vh)*96);display:flex;flex-direction:column;border-radius:26px;background:linear-gradient(165deg,rgba(30,41,59,.96),rgba(8,15,32,.97));border:1px solid rgba(96,165,250,.38);box-shadow:0 0 60px rgba(37,99,235,.28),inset 0 1px 0 rgba(255,255,255,.07);overflow:hidden;transform:translateY(18px) scale(.97);transition:transform .35s cubic-bezier(.16,1,.3,1)}',
        '.pf-ov.on .pf-panel{transform:none}',
        '.pf-x{position:absolute;top:10px;right:12px;z-index:5;width:36px;height:36px;border-radius:12px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#cbd5e1;font-size:16px;cursor:pointer;transition:.15s}.pf-x:hover{color:#fff;background:rgba(239,68,68,.55);border-color:#ef4444}',
        '.pf-scroll>*{flex-shrink:0}.pf-scroll{overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:16px;display:flex;flex-direction:column;gap:14px}',
        '.pf-load{padding:70px 20px;text-align:center;color:#94a3b8;font:700 14px "Russo One",Arial,sans-serif;letter-spacing:.08em}.pf-load i{display:block;width:34px;height:34px;margin:0 auto 14px;border-radius:50%;border:3px solid rgba(96,165,250,.25);border-top-color:#60a5fa;animation:pfspin .8s linear infinite}',
        '@keyframes pfspin{to{transform:rotate(360deg)}}',
        // шапка
        '.pf-hero{position:relative;display:flex;gap:16px;align-items:center;padding:16px;border-radius:20px;background:radial-gradient(120% 140% at 0% 0%,rgba(59,130,246,.28),transparent 55%),linear-gradient(135deg,rgba(30,58,138,.35),rgba(15,23,42,.6));border:1px solid rgba(96,165,250,.3);overflow:hidden}',
        '.pf-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(168,85,247,.25),transparent 70%);pointer-events:none}',
        '.pf-av{position:relative;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;border-radius:24%;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.45),inset 0 0 0 2px rgba(255,255,255,.22);vertical-align:middle}',
        '.pf-av svg{position:absolute;inset:0}.pf-av b{position:relative;z-index:1;font-family:"Russo One",sans-serif;font-weight:400;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.6)}',
        '.pf-av.ring{box-shadow:0 0 0 3px var(--rc,#60a5fa),0 0 22px var(--rc,#60a5fa)}',
        '.pf-hero .pf-av{box-shadow:0 0 0 3px rgba(96,165,250,.55),0 8px 24px rgba(0,0,0,.5)}',
        '.pf-id{flex:1;min-width:0;position:relative;z-index:1}',
        '.pf-nick{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font:400 clamp(20px,3.4vw,30px)/1.1 "Russo One",sans-serif;color:#fff;letter-spacing:.03em;word-break:break-word;padding-right:36px}',
        '.pf-tag{display:inline-block;padding:2px 8px;border-radius:8px;font:400 12px/1.5 "Russo One",sans-serif;color:#fde68a;background:rgba(245,158,11,.16);border:1px solid rgba(245,158,11,.5);letter-spacing:.06em}',
        '.pf-view{display:inline-block;padding:2px 8px;border-radius:8px;font:400 10px/1.6 "Russo One",sans-serif;color:#a5f3fc;background:rgba(34,211,238,.12);border:1px solid rgba(34,211,238,.4);letter-spacing:.12em}',
        '.pf-sub{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:6px;color:#94a3b8;font-size:13px;font-weight:700}',
        '.pf-sub .lg{color:#cbd5e1}.pf-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#475569;margin-right:5px}.pf-dot.on{background:#22c55e;box-shadow:0 0 8px #22c55e}',
        '.pf-pid{display:inline-flex;align-items:center;gap:6px}.pf-pid b{font-family:"Russo One",sans-serif;font-weight:400;color:#7dd3fc;letter-spacing:.05em}',
        '.pf-copy{border:1px solid rgba(125,211,252,.4);background:rgba(14,165,233,.12);color:#bae6fd;border-radius:8px;padding:2px 8px;font:700 11px Jura,Arial,sans-serif;cursor:pointer;transition:.15s}.pf-copy:hover{background:rgba(14,165,233,.3)}.pf-copy.ok{color:#86efac;border-color:#4ade80;background:rgba(34,197,94,.18)}',
        '.pf-lv{display:flex;align-items:center;gap:12px;margin-top:12px}.pf-lv .ico{width:52px;height:52px;flex-shrink:0}.pf-lv .ico svg{width:100%;height:100%;filter:drop-shadow(0 0 6px var(--glow,#60a5fa))}',
        '.pf-lv-m{flex:1;min-width:0}.pf-lv-t{font:400 12px "Russo One",sans-serif;letter-spacing:.08em;color:#e2e8f0;text-transform:uppercase;margin-bottom:5px}.pf-lv-t span{color:#94a3b8}',
        '.pf-xp{position:relative;height:18px;border-radius:999px;background:linear-gradient(#020617,#0f172a);border:1px solid rgba(148,163,184,.35);overflow:hidden;box-shadow:inset 0 2px 5px rgba(0,0,0,.8)}',
        '.pf-xp i{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:999px;background:linear-gradient(180deg,var(--c2,#bae6fd),var(--c1,#38bdf8) 50%,#075985);box-shadow:0 0 12px var(--c1,#38bdf8);transition:width 1.1s cubic-bezier(.16,1,.3,1)}',
        '.pf-xp span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:400 10px "Russo One",sans-serif;letter-spacing:.06em;color:#fff;text-shadow:0 1px 3px #000}',
        // сітка
        '.pf-grid{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,6fr);gap:14px;align-items:start}',
        '.pf-card{border-radius:20px;background:rgba(15,23,42,.62);border:1px solid rgba(71,85,105,.55);padding:14px;min-width:0}',
        '.pf-h{font:400 12px "Russo One",sans-serif;letter-spacing:.14em;color:#94a3b8;text-transform:uppercase;margin:0 0 10px;display:flex;align-items:center;gap:8px}.pf-h::after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(148,163,184,.35),transparent)}',
        '.pf-stage{position:relative;display:flex;justify-content:center;align-items:center;margin:-4px auto 8px;width:min(100%,250px);aspect-ratio:1}',
        '.pf-stage::before{content:"";position:absolute;inset:8% 4% 2%;border-radius:50%;background:radial-gradient(closest-side,var(--tg,rgba(96,165,250,.38)),transparent 72%);filter:blur(2px)}',
        '.pf-stage::after{content:"";position:absolute;left:12%;right:12%;bottom:8%;height:14%;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.55),transparent);}',
        '.pf-stage canvas{position:relative;z-index:1;width:100%;height:100%}',
        '.pf-mods{display:flex;flex-direction:column;gap:7px}',
        '.pf-mod{display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:14px;background:rgba(2,6,23,.55);border:1px solid color-mix(in srgb,var(--rc,#475569) 55%,transparent);position:relative;overflow:hidden}',
        '.pf-mod::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--rc,#475569) 16%,transparent),transparent 60%);pointer-events:none}',
        '.pf-mod.empty{border-style:dashed;border-color:rgba(100,116,139,.5)}.pf-mod.empty::before{display:none}',
        '.pf-mi{width:44px;height:44px;flex-shrink:0;border-radius:11px;background:#020617;border:1px solid color-mix(in srgb,var(--rc,#475569) 70%,transparent);display:flex;align-items:center;justify-content:center;padding:5px;position:relative}',
        '.pf-mod.empty .pf-mi{opacity:.55;border-color:#334155}',
        '.pf-mt{flex:1;min-width:0;position:relative}.pf-mn{font:400 13px "Russo One",sans-serif;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.pf-mod.empty .pf-mn{color:#64748b}',
        '.pf-mr{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--rc,#64748b);margin-top:2px}.pf-mr span{color:#64748b}',
        '.pf-i{position:relative;width:30px;height:30px;flex-shrink:0;border-radius:50%;border:1px solid rgba(148,163,184,.45);background:rgba(30,41,59,.8);color:#e2e8f0;font:700 15px Georgia,serif;font-style:italic;cursor:pointer;transition:.15s}.pf-i:hover{background:#2563eb;border-color:#93c5fd;color:#fff}',
        // плитки
        '.pf-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
        '.pf-tile{position:relative;display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:15px;background:linear-gradient(150deg,rgba(30,41,59,.85),rgba(15,23,42,.75));border:1px solid rgba(71,85,105,.5);min-width:0;opacity:0;animation:pftile .5s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*45ms)}',
        '.pf-tile.w2{grid-column:span 2}',
        '.pf-ti{width:36px;height:36px;flex-shrink:0;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:19px;background:rgba(var(--tc,59,130,246),.18);border:1px solid rgba(var(--tc,59,130,246),.5);box-shadow:0 0 12px rgba(var(--tc,59,130,246),.25)}',
        '.pf-tb{min-width:0}.pf-tl{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.pf-tv{font:400 20px/1.15 "Russo One",sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}.pf-ts{font-size:10px;font-weight:700;color:#64748b;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '@keyframes pftile{from{opacity:0;transform:translateY(10px) scale(.96)}to{opacity:1;transform:none}}',
        // сезон
        '.pf-ses{display:flex;flex-wrap:wrap;gap:8px}.pf-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:999px;background:rgba(30,41,59,.8);border:1px solid rgba(71,85,105,.6);font-size:12px;font-weight:800;color:#cbd5e1}.pf-chip b{font-family:"Russo One",sans-serif;font-weight:400;color:#fff}.pf-chip.g{border-color:rgba(245,158,11,.6);color:#fde68a}',
        // акаунт
        '.pf-acts{display:flex;flex-wrap:wrap;gap:8px}',
        '.pf-btn{display:inline-flex;align-items:center;gap:7px;padding:10px 16px;border-radius:13px;border:1px solid rgba(96,165,250,.5);background:linear-gradient(180deg,rgba(37,99,235,.55),rgba(30,64,175,.55));color:#fff;font:400 12px "Russo One",sans-serif;letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:.15s}.pf-btn:hover{filter:brightness(1.2);transform:translateY(-1px)}',
        '.pf-btn.alt{border-color:rgba(148,163,184,.4);background:rgba(30,41,59,.8)}.pf-btn.go{border-color:#34d399;background:linear-gradient(180deg,#059669,#047857)}.pf-btn:disabled{opacity:.5;cursor:default;transform:none;filter:none}',
        '.pf-form{display:none;margin-top:12px;padding:12px;border-radius:14px;background:rgba(2,6,23,.55);border:1px solid rgba(71,85,105,.55);gap:9px;flex-direction:column}.pf-form.on{display:flex}',
        '.pf-form label{font-size:11px;font-weight:800;letter-spacing:.08em;color:#94a3b8;text-transform:uppercase}',
        '.pf-in{width:100%;padding:11px 13px;border-radius:11px;border:1px solid rgba(100,116,139,.6);background:rgba(15,23,42,.9);color:#fff;font:700 15px Jura,Arial,sans-serif;outline:none;transition:.15s}.pf-in:focus{border-color:#60a5fa;box-shadow:0 0 0 3px rgba(59,130,246,.25)}',
        '.pf-hint{font-size:12px;color:#94a3b8;line-height:1.4}.pf-err{display:none;font-size:13px;font-weight:800;color:#fca5a5;padding:8px 10px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.45)}.pf-err.on{display:block;animation:pfshake .35s}',
        '.pf-okm{display:none;font-size:13px;font-weight:800;color:#86efac;padding:8px 10px;border-radius:10px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.45)}.pf-okm.on{display:block}',
        '@keyframes pfshake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}',
        '.pf-hist{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
        // адаптив
        '@media (max-width:760px){.pf-grid{grid-template-columns:1fr}.pf-grid>.pf-card:first-child{order:2}.pf-stage{width:min(100%,210px)}.pf-hero{padding:12px;gap:12px}.pf-hero .pf-av{width:72px!important;height:72px!important;font-size:33px!important}.pf-lv .ico{width:44px;height:44px}.pf-tv{font-size:17px}.pf-panel{border-radius:20px}.pf-scroll{padding:12px}}',
        '@media (max-height:480px){.pf-ov{padding:4px}.pf-panel{max-height:calc(var(--uvh,1vh)*98)}.pf-grid{grid-template-columns:5fr 6fr}.pf-stage{width:min(100%,170px)}.pf-hero .pf-av{width:64px!important;height:64px!important;font-size:29px!important}.pf-tile{padding:6px 8px}.pf-ti{width:28px;height:28px;font-size:15px}.pf-tv{font-size:15px}}',
        'html.gfx-low .pf-ov,html.gfx-low .pf-panel{backdrop-filter:none;-webkit-backdrop-filter:none}html.gfx-low .pf-tile{animation:none;opacity:1}',

        // ================= РЕЙТИНГ =================
        '.rk-panel{width:min(760px,100%)}',
        '.rk-top{display:flex;align-items:center;gap:12px;padding:16px 56px 10px 18px;flex-wrap:wrap}',
        '.rk-title{font:400 clamp(20px,3.5vw,28px) "Russo One",sans-serif;letter-spacing:.06em;color:#fde68a;text-shadow:0 0 18px rgba(245,158,11,.55)}',
        '.rk-season{margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:2px}.rk-sn{font:400 12px "Russo One",sans-serif;color:#e2e8f0;letter-spacing:.06em;text-transform:uppercase}.rk-timer{font:700 12px Jura,Arial,sans-serif;color:#fbbf24;font-variant-numeric:tabular-nums}',
        '.rk-tabs{position:relative;display:grid;grid-template-columns:1fr 1fr;margin:4px 16px 6px;padding:4px;border-radius:15px;background:rgba(2,6,23,.7);border:1px solid rgba(71,85,105,.6)}',
        '.rk-tabs button{position:relative;z-index:1;padding:10px 6px;border:0;background:transparent;color:#94a3b8;font:400 12px "Russo One",sans-serif;letter-spacing:.07em;text-transform:uppercase;cursor:pointer;transition:color .2s}.rk-tabs button.on{color:#fff}',
        '.rk-ind{position:absolute;top:4px;bottom:4px;left:4px;width:calc(50% - 4px);border-radius:11px;background:linear-gradient(135deg,#d97706,#f59e0b);box-shadow:0 0 18px rgba(245,158,11,.5);transition:transform .3s cubic-bezier(.16,1,.3,1)}.rk-tabs[data-t="br"] .rk-ind{transform:translateX(100%);background:linear-gradient(135deg,#65a30d,#84cc16);box-shadow:0 0 18px rgba(132,204,22,.5)}',
        '.rk-rw{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;padding:2px 16px 6px}.rk-rw span{font-size:11px;font-weight:800;color:#cbd5e1;padding:3px 9px;border-radius:999px;background:rgba(30,41,59,.7);border:1px solid rgba(71,85,105,.5);display:inline-flex;align-items:center;gap:4px}',
        '.rk-body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:0 12px 6px;flex:1;min-height:120px}',
        '.rk-pod{display:grid;grid-template-columns:1fr 1.12fr 1fr;gap:8px;align-items:end;padding:14px 4px 6px}',
        '.rk-slot{display:flex;flex-direction:column;align-items:center;min-width:0;cursor:pointer;--rc:#94a3b8}.rk-slot.p1{--rc:#fbbf24}.rk-slot.p2{--rc:#cbd5e1}.rk-slot.p3{--rc:#f59e0b}.rk-slot.p3{--rc:#d97706}',
        '.rk-slot.ghost{cursor:default;opacity:.35}',
        '.rk-who{position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;margin-bottom:6px;max-width:100%;opacity:0;animation:rkdrop .6s cubic-bezier(.16,1,.3,1) forwards;animation-delay:var(--d,0s)}',
        '.rk-crown{font-size:26px;line-height:1;filter:drop-shadow(0 0 8px #fbbf24);animation:rkbob 2s ease-in-out infinite}',
        '.rk-nm{max-width:100%;font:400 13px "Russo One",sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}.rk-nm em{font-style:normal;color:#fde68a;font-size:11px;margin-right:3px}',
        '.rk-val{font:400 15px "Russo One",sans-serif;color:var(--rc)}',
        '.rk-ped{position:relative;width:100%;border-radius:12px 12px 4px 4px;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;transform-origin:bottom;transform:scaleY(0);animation:rkrise .7s cubic-bezier(.16,1,.3,1) forwards;animation-delay:var(--d,0s);overflow:hidden;font:400 30px "Russo One",sans-serif;color:rgba(0,0,0,.45);text-shadow:0 1px 0 rgba(255,255,255,.35)}',
        '.rk-slot.p1 .rk-ped{height:104px;background:linear-gradient(180deg,#fde68a,#f59e0b 55%,#b45309);box-shadow:0 0 28px rgba(251,191,36,.45)}.rk-slot.p2 .rk-ped{height:78px;background:linear-gradient(180deg,#f1f5f9,#94a3b8 55%,#475569)}.rk-slot.p3 .rk-ped{height:60px;background:linear-gradient(180deg,#fdba74,#d97706 55%,#7c2d12)}',
        '.rk-ped::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);animation:rkshine 3.2s ease-in-out infinite 1s}',
        '.rk-slot.p1 .pf-av{animation:rkglow 2.4s ease-in-out infinite}',
        '@keyframes rkrise{to{transform:scaleY(1)}}@keyframes rkdrop{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:none}}@keyframes rkbob{50%{transform:translateY(-3px) rotate(4deg)}}@keyframes rkshine{0%,55%{left:-60%}100%{left:130%}}@keyframes rkglow{50%{box-shadow:0 0 0 3px #fbbf24,0 0 34px #fbbf24}}',
        '.rk-list{display:flex;flex-direction:column;gap:5px;margin-top:10px}',
        '.rk-row{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:13px;background:rgba(15,23,42,.65);border:1px solid rgba(51,65,85,.7);cursor:pointer;transition:.15s;opacity:0;animation:rkdrop .4s ease forwards;animation-delay:calc(var(--i,0)*18ms)}.rk-row:hover{background:rgba(30,41,59,.9);border-color:rgba(96,165,250,.6)}',
        '.rk-row.me{background:linear-gradient(90deg,rgba(37,99,235,.38),rgba(15,23,42,.7));border-color:#60a5fa;box-shadow:0 0 16px rgba(59,130,246,.35)}',
        '.rk-pl{width:34px;text-align:center;font:400 14px "Russo One",sans-serif;color:#94a3b8;flex-shrink:0}.rk-row.top10 .rk-pl{color:#fbbf24}',
        '.rk-mid{flex:1;min-width:0}.rk-mn{font:400 14px "Russo One",sans-serif;color:#f1f5f9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rk-mn em{font-style:normal;color:#fde68a;font-size:11px;margin-right:4px}.rk-ml{font-size:11px;font-weight:700;color:#64748b;display:flex;align-items:center;gap:4px}.rk-ml svg{width:14px;height:14px}',
        '.rk-v{font:400 17px "Russo One",sans-serif;color:#fff;flex-shrink:0}',
        '.rk-me{margin:0 12px 12px;padding:10px 14px;border-radius:15px;background:linear-gradient(90deg,rgba(37,99,235,.5),rgba(30,41,59,.9));border:1px solid #60a5fa;display:flex;align-items:center;gap:10px;box-shadow:0 0 20px rgba(59,130,246,.35);cursor:pointer;flex-shrink:0}',
        '.rk-me .big{font:400 20px "Russo One",sans-serif;color:#fde68a;min-width:56px;text-align:center}.rk-me .tx{flex:1;min-width:0;font-size:13px;font-weight:700;color:#cbd5e1}.rk-me .tx b{font-family:"Russo One",sans-serif;font-weight:400;color:#fff}',
        '.rk-empty{padding:34px 16px;text-align:center;color:#94a3b8;font-weight:700}',
        '@media (max-width:520px){.rk-pod{gap:5px}.rk-nm{font-size:11px}.rk-slot.p1 .rk-ped{height:84px}.rk-slot.p2 .rk-ped{height:62px}.rk-slot.p3 .rk-ped{height:48px}.rk-season{align-items:flex-start;margin-left:0;width:100%}}',
        '@media (max-height:480px){.rk-top{padding:8px 52px 4px 14px}.rk-pod{padding-top:4px}.rk-slot.p1 .rk-ped{height:56px}.rk-slot.p2 .rk-ped{height:42px}.rk-slot.p3 .rk-ped{height:32px}.rk-crown{font-size:18px}.rk-rw{display:none}}',
        'html.gfx-low .rk-ped::after,html.gfx-low .rk-crown,html.gfx-low .rk-slot.p1 .pf-av{animation:none}',

        // ================= НАГОРОДА ЗА СЕЗОН =================
        '.sr-ov{z-index:92}.sr-card{position:relative;width:min(420px,100%);padding:26px 22px 22px;border-radius:26px;text-align:center;background:radial-gradient(120% 90% at 50% 0%,rgba(245,158,11,.3),transparent 60%),linear-gradient(165deg,#1e293b,#0b1224);border:1px solid rgba(251,191,36,.6);box-shadow:0 0 70px rgba(245,158,11,.35);transform:scale(.9);transition:transform .45s cubic-bezier(.16,1,.3,1)}.pf-ov.on .sr-card{transform:none}',
        '.sr-h{font:400 12px "Russo One",sans-serif;letter-spacing:.2em;color:#fbbf24}.sr-t{font:400 clamp(22px,5vw,30px) "Russo One",sans-serif;color:#fff;margin:6px 0 4px;text-shadow:0 0 20px rgba(251,191,36,.6)}.sr-s{color:#94a3b8;font-weight:700;font-size:13px;margin-bottom:14px}',
        '.sr-it{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;margin-bottom:8px;background:rgba(2,6,23,.55);border:1px solid rgba(245,158,11,.4);text-align:left}.sr-it .m{font-size:30px}.sr-it .tx{flex:1;font-weight:800;color:#e2e8f0;font-size:13px}.sr-it .tx small{display:block;color:#94a3b8;font-weight:700}.sr-it .cr{font:400 18px "Russo One",sans-serif;color:#fde68a;display:flex;align-items:center;gap:5px}',
        '.sr-tot{margin:12px 0 14px;font:400 26px "Russo One",sans-serif;color:#34d399;display:flex;justify-content:center;align-items:center;gap:8px;text-shadow:0 0 18px rgba(16,185,129,.6)}',

        // ================= ПІДСУМКИ БОЮ =================
        '#winner-modal.ps-on>div{max-width:36rem!important;padding:18px 16px!important}',
        '#winner-modal.ps-on .ps-old,#winner-modal.ps-on #winner-xp,#winner-modal.ps-on #drop-notification{display:none!important}',
        '#winner-modal.ps-on #winner-emoji{font-size:clamp(34px,7vh,60px)!important;margin-bottom:2px!important;line-height:1.1!important}#winner-modal.ps-on #winner-title{font-size:clamp(26px,5.4vh,44px)!important;margin-bottom:4px!important}',
        '#winner-modal.ps-on #back-to-room-lobby-btn{position:sticky;bottom:-6px;z-index:20;box-shadow:0 -10px 18px rgba(8,15,32,.9),0 0 20px rgba(37,99,235,.4)}',
        '#winner-modal.ps-on #winner-message{margin-bottom:8px!important;font-size:15px!important}',
        '#winner-modal.ps-win>div{border-color:rgba(251,191,36,.7)!important;box-shadow:0 0 60px rgba(251,191,36,.28)!important}',
        '#winner-modal.ps-loss>div{border-color:rgba(148,163,184,.4)!important;box-shadow:0 0 40px rgba(71,85,105,.3)!important}',
        '#winner-modal.ps-draw>div{border-color:rgba(148,163,184,.55)!important}',
        '.ps{position:relative;z-index:10;text-align:left;display:flex;flex-direction:column;gap:9px;margin-bottom:12px}',
        '.ps.hidden{display:none}',
        '.ps-chips{display:flex;justify-content:center;flex-wrap:wrap;gap:6px}.ps-chips span{padding:4px 11px;border-radius:999px;background:rgba(30,41,59,.85);border:1px solid rgba(71,85,105,.7);font-size:12px;font-weight:800;color:#cbd5e1}',
        '.ps-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.ps-tiles.n3{grid-template-columns:repeat(3,minmax(0,1fr))}',
        '.ps-t{text-align:center;padding:9px 4px 8px;border-radius:14px;background:linear-gradient(160deg,rgba(30,41,59,.9),rgba(2,6,23,.85));border:1px solid rgba(71,85,105,.6);opacity:0;animation:pftile .5s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(var(--i,0)*80ms + .1s)}',
        '.ps-t i{display:block;font-style:normal;font-size:10px;font-weight:800;letter-spacing:.1em;color:#94a3b8;text-transform:uppercase;margin-bottom:3px}.ps-t b{display:flex;justify-content:center;align-items:center;gap:4px;font:400 22px/1.1 "Russo One",sans-serif;color:#fff}',
        '.ps-t.pl b{color:#fbbf24;text-shadow:0 0 14px rgba(251,191,36,.6)}.ps-t.cr b{color:#fde68a;font-size:19px}.ps-t small{display:block;font-size:10px;font-weight:700;color:#64748b;margin-top:1px}',
        '.ps-xp{margin:0!important;max-width:none}.ps-xp .wx-gain{font-size:22px}',
        '.ps-next{text-align:center;font-weight:800;font-size:14px;color:#cbd5e1;margin-top:-2px}.ps-next b{font-family:"Russo One",sans-serif;font-weight:400;color:#34d399;font-size:16px}.ps-next b.n{color:#7dd3fc}.ps-next b.l{color:#fbbf24}',
        '.ps-drop{display:flex;align-items:center;gap:12px;padding:9px 12px;border-radius:14px;background:linear-gradient(90deg,color-mix(in srgb,var(--rc,#a855f7) 22%,transparent),rgba(15,23,42,.8));border:1px solid var(--rc,#a855f7);animation:pftile .6s ease .5s both}',
        '.ps-drop .ic{width:42px;height:42px;padding:5px;border-radius:11px;background:#020617;border:1px solid var(--rc,#a855f7);flex-shrink:0}.ps-drop .tx{min-width:0}.ps-drop small{display:block;font-size:10px;font-weight:800;letter-spacing:.12em;color:#94a3b8;text-transform:uppercase}.ps-drop b{display:block;font:400 14px "Russo One",sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ps-drop em{font-style:normal;font-size:11px;font-weight:800;color:var(--rc,#a855f7)}',
        '.ps-board{display:flex;flex-direction:column;gap:3px}.ps-br{display:flex;align-items:center;gap:8px;padding:4px 9px;border-radius:9px;background:rgba(15,23,42,.6);font-size:12px;font-weight:800;color:#94a3b8}.ps-br.me{background:rgba(37,99,235,.3);color:#fff;box-shadow:inset 0 0 0 1px rgba(96,165,250,.7)}.ps-br span{width:20px;text-align:center;font-family:"Russo One",sans-serif;font-weight:400}.ps-br em{flex:1;font-style:normal;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ps-br u{text-decoration:none;font-family:"Russo One",sans-serif;font-weight:400;font-size:11px}',
        '#ps-extra{position:relative;z-index:10;text-align:left;display:flex;flex-direction:column;gap:7px;margin-bottom:12px}#ps-extra:empty{display:none}',
        '.ps-conf{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0}.ps-conf i{position:absolute;top:-14px;width:7px;height:12px;border-radius:2px;opacity:0;animation:psfall linear forwards}',
        '@keyframes psfall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(520px) rotate(540deg)}}',
        '@media (max-height:560px){#winner-modal.ps-on #back-to-room-lobby-btn{position:static;box-shadow:none}.ps{gap:6px;margin-bottom:8px}.ps-t{padding:5px 2px}.ps-t b{font-size:17px}.ps-board{display:none}.ps-next{font-size:12px}}',
        'html.gfx-low .ps-conf{display:none}'
    ].join('\n');
    var st = document.createElement('style'); st.id = 'pf-css'; st.textContent = css; document.head.appendChild(st);

    // =====================================================================================
    //  Службове
    // =====================================================================================
    var MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
    function seasonLabel(id) { var m = /^(\d{4})-(\d{2})$/.exec(id || ''); return m ? MONTHS[(+m[2] - 1) % 12] + ' ' + m[1] : (id || '—'); }
    function fmtTime(ms) { ms = +ms || 0; var m = Math.floor(ms / 60000); if (m < 1) return '0 хв'; if (m < 60) return m + ' хв'; var h = Math.floor(m / 60); return h >= 100 ? h + ' год' : h + ' год ' + (m % 60) + ' хв'; }
    function fmtDur(ms) { var s = Math.max(0, Math.round((+ms || 0) / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
    function clanTag(c) { return c ? '<span class="pf-tag">[' + esc(c) + ']</span>' : ''; }
    function modeInfo(k) { var M = window.ModeInfo && ModeInfo.MODES && ModeInfo.MODES[k]; return M || null; }
    var myLogin = function () { return (typeof myName !== 'undefined' && myName) || ''; };
    var mkOverlay = function (id, cls, panelCls, inner) {
        var o = document.createElement('div'); o.id = id; o.className = 'pf-ov hidden ' + (cls || ''); o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true');
        o.innerHTML = '<div class="pf-panel ' + (panelCls || '') + '">' + inner + '</div>'; document.body.appendChild(o); return o;
    };
    function show(o) { o.classList.remove('hidden'); void o.offsetWidth; o.classList.add('on'); }
    function hide(o, cb) { o.classList.remove('on'); setTimeout(function () { if (!o.classList.contains('on')) o.classList.add('hidden'); if (cb) cb(); }, 230); }

    // =====================================================================================
    //  ПРОФІЛЬ
    // =====================================================================================
    var okAfter = '', pfEl = null, pfBody = null, awaiting = null, awaitT = 0, tankRaf = 0, cur = null, meProfile = null;
    function buildPf() {
        if (pfEl) return;
        pfEl = mkOverlay('pf-modal', '', '', '<button class="pf-x" type="button" aria-label="Закрити">✕</button><div class="pf-scroll" id="pf-body"></div>');
        pfBody = pfEl.querySelector('#pf-body');
        pfEl.querySelector('.pf-x').onclick = function () { snd('ui_click'); closeProfile(); };
        pfEl.addEventListener('mousedown', function (e) { if (e.target === pfEl) closeProfile(); });
    }
    function openProfile(arg) {
        buildPf();
        var req = {}, self = false;
        if (arg == null || arg === 'me' || arg === myLogin()) { self = true; }
        else if (typeof arg === 'number' || (typeof arg === 'string' && /^#\d+$/.test(arg))) req = { pid: parseInt(String(arg).replace('#', ''), 10) };
        else if (typeof arg === 'object') req = arg.pid != null ? { pid: arg.pid } : { name: arg.name };
        else req = { name: String(arg) };
        if (!self && req.name && String(req.name) === myLogin()) self = true;
        awaiting = { self: self }; clearTimeout(awaitT);
        pfBody.innerHTML = '<div class="pf-load"><i></i>Завантаження профілю…</div>';
        show(pfEl); pfBody.scrollTop = 0;
        socket.emit('getProfile', self ? {} : req);
        awaitT = setTimeout(function () { if (awaiting) { awaiting = null; pfBody.innerHTML = '<div class="pf-load">Не вдалося завантажити профіль</div>'; } }, 7000);
    }
    function closeProfile() { if (!pfEl || pfEl.classList.contains('hidden')) return; stopTank(); awaiting = null; hide(pfEl); }
    var isOpen = function (el) { return el && !el.classList.contains('hidden'); };

    function tile(i, ico, tc, label, val, sub, cls) {
        return '<div class="pf-tile ' + (cls || '') + '" style="--i:' + i + ';--tc:' + tc + '"><div class="pf-ti">' + ico + '</div><div class="pf-tb"><div class="pf-tl">' + label + '</div><div class="pf-tv">' + val + '</div>' + (sub ? '<div class="pf-ts">' + sub + '</div>' : '') + '</div></div>';
    }
    var SLOTS = ['cannon', 'turret', 'hull', 'tracks'];
    function modRow(slot, id) {
        var m = id && MODS() ? MODULES[id] : null, cn = (CATN() && CAT_NAMES[slot]) || slot;
        if (!m) {
            var ic = SVGI() && SVG_ICONS[slot] ? SVG_ICONS[slot]('#64748b') : '';
            return '<div class="pf-mod empty"><div class="pf-mi">' + ic + '</div><div class="pf-mt"><div class="pf-mn">Порожньо</div><div class="pf-mr"><span>' + esc(cn) + '</span></div></div></div>';
        }
        var R = (RAR() && RARITY[m.rarity]) || { name: '', color: '#94a3b8' };
        return '<div class="pf-mod" style="--rc:' + R.color + '"><div class="pf-mi">' + (window.modIcon ? modIcon(m) : '') + '</div><div class="pf-mt"><div class="pf-mn">' + esc(m.name) + '</div><div class="pf-mr">' + esc(R.name) + ' <span>· ' + esc(cn) + '</span></div></div><button class="pf-i" type="button" data-mod="' + esc(id) + '" aria-label="Характеристики" title="Характеристики">i</button></div>';
    }
    function renderProfile(p) {
        cur = p; stopTank();
        var s = p.stats || {}, pr = p.prog || { level: p.level, cur: 0, need: 1, pct: 0, max: false }, hasP = !!s.hasP;
        var dash = '<span style="opacity:.55">—</span>';
        var name = p.nick || p.login, kd = s.deaths > 0 ? (s.kills / s.deaths) : s.kills;
        var wr = hasP && s.games > 0 ? Math.round(s.wins / s.games * 100) + '%' : null;
        var fm = s.favMode ? modeInfo(s.favMode) : null;
        var lvIcon = window.LV ? LV.icon(p.level, 52) : '';
        var tg = window.LV ? (LV.TIERS[LV.tierOf(p.level)] || {}).glow : '#60a5fa';
        var BARS = [['#f59e0b', '#fde68a'], ['#0ea5e9', '#bae6fd'], ['#eab308', '#fef08a'], ['#14b8a6', '#99f6e4'], ['#a855f7', '#e9d5ff'], ['#ef4444', '#fecaca']];
        var bc = BARS[window.LV ? LV.tierOf(p.level) : 0] || BARS[0];
        var xpTxt = pr.max ? 'MAX' : num(pr.cur) + ' / ' + num(pr.need) + ' XP';
        var h = '';
        h += '<div class="pf-hero">' + avatar(p.login, 96) + '<div class="pf-id"><div class="pf-nick"><span>' + esc(name) + '</span>' + clanTag(p.clan) + (p.self ? '' : '<span class="pf-view">ПЕРЕГЛЯД</span>') + '</div>';
        h += '<div class="pf-sub"><span class="lg"><i class="pf-dot' + (p.online ? ' on' : '') + '"></i>@' + esc(p.login) + '</span>';
        h += p.pid ? '<span class="pf-pid">ID <b>#' + esc(p.pid) + '</b><button class="pf-copy" type="button" data-copy="' + esc(p.pid) + '">копіювати</button></span>' : '<span class="pf-pid">ID <b>—</b></span>';
        h += '</div><div class="pf-lv"><div class="ico" style="--glow:' + tg + '">' + lvIcon + '</div><div class="pf-lv-m"><div class="pf-lv-t">Рівень ' + p.level + ' <span>· ' + esc(window.LV ? LV.rankName(p.level) : '') + '</span></div><div class="pf-xp" style="--c1:' + bc[0] + ';--c2:' + bc[1] + '"><i style="width:0" data-w="' + (pr.max ? 100 : pr.pct) + '"></i><span>' + xpTxt + '</span></div></div></div></div></div>';
        h += '<div class="pf-grid"><div class="pf-card"><div class="pf-h">Танк</div><div class="pf-stage"><canvas id="pf-tank" width="300" height="300"></canvas></div><div class="pf-mods">';
        SLOTS.forEach(function (sl) { h += modRow(sl, p.equipped && p.equipped[sl]); });
        h += '</div></div><div class="pf-card"><div class="pf-h">Статистика</div><div class="pf-tiles">';
        h += tile(0, '🎮', '59,130,246', 'Зіграно матчів', num(s.games));
        h += tile(1, '🏆', '245,158,11', 'Перемоги / поразки', hasP ? num(s.wins) + ' <span style="color:#64748b;font-size:15px">/ ' + num(s.losses) + '</span>' : dash, hasP && s.draws ? 'нічиїх: ' + num(s.draws) : '');
        h += tile(2, '📈', '34,197,94', '% перемог', wr || dash);
        h += tile(3, '⚔️', '168,85,247', 'K/D', hasP || s.kills ? (Math.round(kd * 100) / 100).toFixed(2) : dash, hasP ? 'смертей: ' + num(s.deaths) : '');
        h += tile(4, '🎯', '239,68,68', 'Вбивств', num(s.kills));
        h += tile(5, '💀', '148,163,184', 'Смертей', hasP ? num(s.deaths) : dash);
        h += tile(6, fm ? fm.e : '⭐', fm && fm.c ? fm.c : '236,72,153', 'Улюблений режим', fm ? esc(fm.sn || fm.n) : dash, fm && s.modes[s.favMode] ? num(s.modes[s.favMode].games) + ' ігор' : '', 'w2');
        h += tile(7, '💰', '234,179,8', 'Зароблено кредитів', (window.creditIcon ? creditIcon(18) : '') + ' ' + num(s.earned));
        h += tile(8, '⏱', '14,165,233', 'Час у грі', hasP ? fmtTime(s.playMs) : dash);
        h += tile(9, '📦', '20,184,166', 'Відкрито кейсів', hasP ? num(s.cases) : dash);
        h += tile(10, '👑', '132,204,22', 'Перемог у БР', hasP ? num(s.brWins) : dash);
        h += '</div></div></div>';
        // сезон
        var se = p.season || {};
        h += '<div class="pf-card"><div class="pf-h">Сезон · ' + esc(seasonLabel(se.id)) + '</div><div class="pf-ses">';
        h += '<span class="pf-chip">💥 Вбивств: <b>' + num(se.kills) + '</b>' + (se.placeKills ? ' <span class="pf-chip g" style="padding:1px 8px">#' + se.placeKills + '</span>' : '') + '</span>';
        h += '<span class="pf-chip">👑 Перемог у БР: <b>' + num(se.brWins) + '</b>' + (se.placeBr ? ' <span class="pf-chip g" style="padding:1px 8px">#' + se.placeBr + '</span>' : '') + '</span>';
        h += '</div>';
        if (p.history && p.history.length) {
            h += '<div class="pf-hist">';
            p.history.forEach(function (x) { var t = []; if (x.kills) t.push('💥 #' + x.kills.place); if (x.br) t.push('👑 #' + x.br.place); if (t.length) h += '<span class="pf-chip g">' + esc(seasonLabel(x.id)) + ' · ' + t.join(' ') + '</span>'; });
            h += '</div>';
        }
        h += '</div>';
        if (p.self) {
            h += '<div class="pf-card"><div class="pf-h">Акаунт</div><div class="pf-acts"><button class="pf-btn" type="button" data-f="nick">✏️ Змінити ім\'я</button><button class="pf-btn alt" type="button" data-f="pw">🔒 Змінити пароль</button><button class="pf-btn alt" type="button" data-f="hangar">🛡 В ангар</button></div>';
            h += '<form class="pf-form" id="pf-f-nick" autocomplete="off"><label for="pf-nick-in">Нове ім\'я</label><input class="pf-in" id="pf-nick-in" maxlength="12" placeholder="' + esc(name) + '" autocomplete="off" spellcheck="false"><div class="pf-hint" id="pf-nick-hint"></div><div class="pf-err" id="pf-nick-err"></div><div class="pf-okm" id="pf-nick-ok"></div><div><button class="pf-btn go" type="submit" id="pf-nick-go">Зберегти ім\'я</button></div></form>';
            h += '<form class="pf-form" id="pf-f-pw" autocomplete="off"><label for="pf-pw0">Старий пароль</label><input class="pf-in" id="pf-pw0" type="password" autocomplete="current-password" maxlength="128"><label for="pf-pw1">Новий пароль (від 4 символів)</label><input class="pf-in" id="pf-pw1" type="password" autocomplete="new-password" maxlength="128"><label for="pf-pw2">Підтвердіть новий пароль</label><input class="pf-in" id="pf-pw2" type="password" autocomplete="new-password" maxlength="128"><div class="pf-err" id="pf-pw-err"></div><div class="pf-okm" id="pf-pw-ok"></div><div><button class="pf-btn go" type="submit" id="pf-pw-go">Змінити пароль</button></div></form></div>';
        }
        pfBody.innerHTML = h; pfBody.scrollTop = 0;
        // анімація смуги досвіду
        setTimeout(function () { var f = pfBody.querySelector('.pf-xp i'); if (f) f.style.width = f.dataset.w + '%'; }, 120);
        // кнопки
        pfBody.querySelectorAll('.pf-i').forEach(function (b) { b.onclick = function () { if (window.openModuleInfo) openModuleInfo(b.dataset.mod); }; });
        var cp = pfBody.querySelector('.pf-copy');
        if (cp) cp.onclick = function () { snd('ui_click'); copyText(cp.dataset.copy, function () { cp.classList.add('ok'); cp.textContent = 'скопійовано ✓'; setTimeout(function () { cp.classList.remove('ok'); cp.textContent = 'копіювати'; }, 1600); }); };
        if (p.self) bindSelf(p);
        startTank(p.equipped || {});
        if (okAfter && p.self) { var f = $('pf-f-nick'); if (f) f.classList.add('on'); msg('pf-nick-ok', okAfter); okAfter = ''; }
    }
    function copyText(t, ok) {
        t = String(t);
        function fb() { try { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0;top:0;left:0'; document.body.appendChild(a); a.select(); document.execCommand('copy'); a.remove(); ok(); } catch (e) {} }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(ok, fb); else fb();
    }
    function msg(id, text, bad) {
        var e = $(id); if (!e) return; e.textContent = text || ''; e.classList.toggle('on', !!text);
        if (bad && text) { e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; }
    }
    function bindSelf(p) {
        var forms = { nick: $('pf-f-nick'), pw: $('pf-f-pw') };
        pfBody.querySelectorAll('.pf-btn[data-f]').forEach(function (b) {
            b.onclick = function () {
                snd('ui_click'); var k = b.dataset.f;
                if (k === 'hangar') { closeProfile(); var n = $('nav-hangar-btn'); if (n) n.click(); return; }
                Object.keys(forms).forEach(function (x) { if (x !== k) forms[x].classList.remove('on'); });
                forms[k].classList.toggle('on');
                if (forms[k].classList.contains('on')) { var i = forms[k].querySelector('input'); if (i) setTimeout(function () { i.focus(); }, 60); }
            };
        });
        var hint = $('pf-nick-hint'), go = $('pf-nick-go'), ni = $('pf-nick-in');
        function nickHint() {
            var left = p.nickNextAt ? p.nickNextAt - Date.now() : 0;
            if (left > 0) { var m = Math.ceil(left / 60000); hint.textContent = 'Змінювати ім\'я можна раз на 24 години. Наступна зміна через ' + (m >= 60 ? Math.floor(m / 60) + ' год ' + (m % 60) + ' хв' : m + ' хв') + '. Логін @' + p.login + ' не змінюється.'; }
            else hint.textContent = '3–12 символів: літери, цифри, _ та -. ' + (p.nickChanges ? 'Після зміни наступна буде доступна через 24 години.' : 'Перша зміна безкоштовна й без очікування.') + ' Логін @' + p.login + ' не змінюється.';
        }
        nickHint();
        $('pf-f-nick').onsubmit = function (e) {
            e.preventDefault(); msg('pf-nick-err', ''); msg('pf-nick-ok', '');
            var v = ni.value.trim();
            if (!NAME_RE.test(v)) { snd('ui_error'); return msg('pf-nick-err', 'Ім\'я: 3–12 символів (літери, цифри, _ -)', true); }
            go.disabled = true; setTimeout(function () { go.disabled = false; }, 4000);
            socket.emit('changeNick', { nick: v });
        };
        $('pf-f-pw').onsubmit = function (e) {
            e.preventDefault(); msg('pf-pw-err', ''); msg('pf-pw-ok', '');
            var a = $('pf-pw0').value.trim(), b = $('pf-pw1').value.trim(), c = $('pf-pw2').value.trim();
            var er = !a || !b || !c ? 'Заповніть усі поля' : b.length < 4 ? 'Новий пароль — від 4 символів' : b.length > 128 ? 'Новий пароль — до 128 символів' : b !== c ? 'Підтвердження не збігається з новим паролем' : '';
            if (er) { snd('ui_error'); return msg('pf-pw-err', er, true); }
            var g = $('pf-pw-go'); g.disabled = true; setTimeout(function () { g.disabled = false; }, 4000);
            socket.emit('changePassword', { oldPassword: a, newPassword: b, confirm: c });
        };
    }

    // ---------- танк з екіпірованих модулів ----------
    function stopTank() { if (tankRaf) { cancelAnimationFrame(tankRaf); tankRaf = 0; } }
    function startTank(eq) {
        stopTank();
        var cv = $('pf-tank'); if (!cv || typeof drawModVis !== 'function') return;
        var c = cv.getContext('2d'), still = low() || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
        // світіння під танком — за найвищою рідкістю
        var tiers = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 }, best = null, bt = -1;
        SLOTS.forEach(function (sl) { var m = eq[sl] && MODULES[eq[sl]]; if (m && (tiers[m.rarity] || 0) > bt) { bt = tiers[m.rarity] || 0; best = m; } });
        if (best && RARITY[best.rarity]) { var st = cv.parentElement; st.style.setProperty('--tg', RARITY[best.rarity].color + '66'); }
        function draw() {
            if (!cv.isConnected || !isOpen(pfEl)) { tankRaf = 0; return; }
            var r = cv.getBoundingClientRect(), k = Math.max(1, Math.min(2.5, (r.width / 300) * (window.devicePixelRatio || 1))), px = Math.round(300 * k);
            if (px > 0 && cv.width !== px) { cv.width = px; cv.height = px; }
            c.setTransform(px / 300, 0, 0, px / 300, 0, 0); c.clearRect(0, 0, 300, 300);
            var T = performance.now() / 1000, body = -0.3, ta = body + (still ? 0 : Math.sin(T * 0.7) * 0.45);
            c.save(); c.translate(150, 150); c.scale(2.05, 2.05);
            c.save(); c.rotate(body);
            drawModVis(c, 'tracks', eq.tracks || null, T); drawModVis(c, 'hull', eq.hull || null, T);
            c.restore(); c.save(); c.rotate(ta);
            drawModVis(c, 'cannon', eq.cannon || null, T); drawModVis(c, 'turret', eq.turret || null, T);
            c.restore(); c.restore();
            tankRaf = still ? 0 : requestAnimationFrame(draw);
        }
        draw();
    }

    // =====================================================================================
    //  РЕЙТИНГ
    // =====================================================================================
    var rkEl = null, rkTab = 'kills', rkData = null, rkTimer = 0, rkPoll = 0, rkSkew = 0;
    function buildRk() {
        if (rkEl) return;
        rkEl = mkOverlay('rk-modal', '', 'rk-panel', '<button class="pf-x" type="button" aria-label="Закрити">✕</button>' +
            '<div class="rk-top"><div class="rk-title">🏆 РЕЙТИНГ</div><div class="rk-season"><div class="rk-sn" id="rk-sn">Сезон</div><div class="rk-timer" id="rk-timer"></div></div></div>' +
            '<div class="rk-tabs" id="rk-tabs" data-t="kills"><i class="rk-ind"></i><button type="button" data-t="kills" class="on">💥 Вбивства</button><button type="button" data-t="br" >👑 Перемоги в БР</button></div>' +
            '<div class="rk-rw" id="rk-rw"></div><div class="rk-body" id="rk-body"></div><div id="rk-mine"></div>');
        rkEl.querySelector('.pf-x').onclick = function () { snd('ui_click'); closeRanking(); };
        rkEl.addEventListener('mousedown', function (e) { if (e.target === rkEl) closeRanking(); });
        rkEl.querySelectorAll('#rk-tabs button').forEach(function (b) {
            b.onclick = function () { if (rkTab === b.dataset.t) return; snd('ui_click'); rkTab = b.dataset.t; syncTabs(); renderRanking(); };
        });
    }
    function syncTabs() { var t = $('rk-tabs'); t.dataset.t = rkTab; t.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.t === rkTab); }); }
    function openRanking() {
        buildRk(); rkData = null; syncTabs();
        $('rk-body').innerHTML = '<div class="pf-load"><i></i>Завантаження рейтингу…</div>'; $('rk-mine').innerHTML = '';
        show(rkEl); socket.emit('getRanking');
        clearInterval(rkPoll); rkPoll = setInterval(function () { if (isOpen(rkEl)) socket.emit('getRanking'); }, 15000);
        clearInterval(rkTimer); rkTimer = setInterval(tickTimer, 1000); tickTimer();
    }
    function closeRanking() { if (!isOpen(rkEl)) return; clearInterval(rkPoll); clearInterval(rkTimer); hide(rkEl); }
    function tickTimer() {
        var e = $('rk-timer'); if (!e || !rkData) return;
        var ms = rkData.season.endsAt - (Date.now() - rkSkew); if (ms < 0) ms = 0;
        var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60, p2 = function (n) { return ('0' + n).slice(-2); };
        e.textContent = '⏳ до кінця сезону: ' + (d ? d + 'д ' : '') + p2(h) + ':' + p2(m) + ':' + p2(ss);
    }
    function rowName(r) { return (r.clan ? '<em>[' + esc(r.clan) + ']</em>' : '') + esc(r.nick || r.login); }
    function renderRanking() {
        if (!rkData) return;
        var T = rkData[rkTab], rows = T.rows || [], unit = rkTab === 'kills' ? 'вбивств' : 'перемог', me = T.me || {}, body = $('rk-body');
        $('rk-sn').textContent = 'Сезон · ' + seasonLabel(rkData.season.id);
        var rw = rkData.rewards || [], lab = ['🥇', '🥈', '🥉'], rh = '', prev = 0;
        rw.forEach(function (x) { rh += '<span>' + (x.upTo <= 3 ? lab[x.upTo - 1] : (prev + 1) + '–' + x.upTo + ' місце') + ' ' + (window.creditIcon ? creditIcon(13) : '') + x.credits + '</span>'; prev = x.upTo; });
        $('rk-rw').innerHTML = rh;
        if (!rows.length) { body.innerHTML = '<div class="rk-empty">🏁 Сезон щойно почався — нікого ще немає в таблиці.<br>Станьте першим!</div>'; }
        else {
            var h = '<div class="rk-pod">', ord = [2, 1, 3], dl = { 1: '.35s', 2: '.15s', 3: '0s' };
            ord.forEach(function (pl) {
                var r = rows[pl - 1];
                if (!r) { h += '<div class="rk-slot p' + pl + ' ghost"><div class="rk-who"><span class="pf-av" style="width:54px;height:54px;background:#1e293b"></span><div class="rk-nm">—</div></div><div class="rk-ped" style="--d:' + dl[pl] + '">' + pl + '</div></div>'; return; }
                h += '<div class="rk-slot p' + pl + '" data-l="' + esc(r.login) + '"><div class="rk-who" style="--d:calc(' + dl[pl] + ' + .35s)">' + (pl === 1 ? '<div class="rk-crown">👑</div>' : '') + avatar(r.login, pl === 1 ? 70 : 56, true) + '<div class="rk-nm">' + rowName(r) + '</div><div class="rk-val">' + num(r.value) + '</div></div><div class="rk-ped" style="--d:' + dl[pl] + '">' + pl + '</div></div>';
            });
            h += '</div><div class="rk-list">';
            rows.slice(3).forEach(function (r, i) {
                var isMe = r.login === myLogin(), lv = window.LV ? LV.icon(r.level || 1, 18) : '';
                h += '<div class="rk-row' + (isMe ? ' me' : '') + (r.place <= 10 ? ' top10' : '') + '" data-l="' + esc(r.login) + '" style="--i:' + i + '"><div class="rk-pl">' + r.place + '</div>' + avatar(r.login, 36) + '<div class="rk-mid"><div class="rk-mn">' + rowName(r) + '</div><div class="rk-ml">' + lv + ' рівень ' + (r.level || 1) + '</div></div><div class="rk-v">' + num(r.value) + '</div></div>';
            });
            body.innerHTML = h + '</div>';
            body.querySelectorAll('[data-l]').forEach(function (e) { e.onclick = function () { snd('ui_click'); openProfile(e.dataset.l); }; });
        }
        var mine = $('rk-mine');
        if (me.place) mine.innerHTML = '<div class="rk-me" id="rk-me"><div class="big">#' + me.place + '</div>' + avatar(myLogin(), 38) + '<div class="tx">Ваше місце · <b>' + num(me.value) + '</b> ' + unit + (me.place > 50 ? '<br>Ви поза топ-50' : '') + '</div></div>';
        else mine.innerHTML = '<div class="rk-me" id="rk-me"><div class="big">—</div>' + avatar(myLogin(), 38) + '<div class="tx">' + (rkTab === 'kills' ? 'Знищте першого ворога цього сезону, щоб потрапити до рейтингу' : 'Вигравайте королівські бої, щоб потрапити до рейтингу') + '</div></div>';
        var mm = $('rk-me'); if (mm) mm.onclick = function () { snd('ui_click'); openProfile(); };
        tickTimer();
    }

    // =====================================================================================
    //  НАГОРОДА ЗА СЕЗОН
    // =====================================================================================
    var srQ = [], srEl = null, srBusy = false;
    function srNext() {
        if (srBusy || !srQ.length) return;
        var menu = $('main-menu-screen');
        if (!menu || menu.classList.contains('hidden')) { setTimeout(srNext, 2500); return; }
        srBusy = true; var d = srQ.shift();
        if (!srEl) {
            srEl = document.createElement('div'); srEl.id = 'sr-modal'; srEl.className = 'pf-ov sr-ov hidden'; document.body.appendChild(srEl);
        }
        var names = { kills: ['💥', 'Вбивства'], br: ['👑', 'Перемоги в королівській битві'] }, medal = ['🥇', '🥈', '🥉'];
        var h = '<div class="sr-card"><div class="sr-h">ПІДСУМКИ СЕЗОНУ</div><div class="sr-t">Нагорода за сезон</div><div class="sr-s">' + esc(seasonLabel(d.seasonId)) + '</div>';
        (d.items || []).forEach(function (it) {
            var n = names[it.table] || ['🏆', 'Рейтинг'];
            h += '<div class="sr-it"><div class="m">' + (it.place <= 3 ? medal[it.place - 1] : n[0]) + '</div><div class="tx">' + esc(n[1]) + '<small>' + it.place + ' місце · ' + num(it.value) + '</small></div><div class="cr">+' + (window.creditIcon ? creditIcon(20) : '') + num(it.reward) + '</div></div>';
        });
        h += '<div class="sr-tot">+' + (window.creditIcon ? creditIcon(28) : '') + num(d.total) + '</div><button class="pf-btn go" type="button" id="sr-ok" style="width:100%;justify-content:center">ЗАБРАТИ</button></div>';
        srEl.innerHTML = h; show(srEl); snd('powerup');
        try { if (window.UISFX) UISFX.play('reveal_legendary'); } catch (e) {}
        $('sr-ok').onclick = function () { snd('ui_buy'); hide(srEl, function () { srBusy = false; setTimeout(srNext, 300); }); };
    }

    // =====================================================================================
    //  ПІДСУМКИ БОЮ
    // =====================================================================================
    var pm = { sum: null, sumAt: 0, goAt: 0, shown: false, t: 0, defer: null };
    function ensureBox() {
        var wm = $('winner-modal'); if (!wm) return null;
        var box = $('ps-box'); if (box) return box;
        var back = $('back-to-room-lobby-btn'); if (!back) return null;
        var rw = $('winner-reward'); if (rw && rw.parentElement && rw.parentElement.parentElement) rw.parentElement.parentElement.classList.add('ps-old');
        box = document.createElement('div'); box.id = 'ps-box'; box.className = 'ps hidden';
        var ex = document.createElement('div'); ex.id = 'ps-extra';
        back.parentNode.insertBefore(box, back); back.parentNode.insertBefore(ex, back);
        return box;
    }
    function renderSummary(s) {
        var wm = $('winner-modal'), box = ensureBox(); if (!wm || !box) return;
        pm.shown = true; clearTimeout(pm.t); pm.defer = null;
        wm.classList.remove('ps-win', 'ps-loss', 'ps-draw'); wm.classList.add('ps-on', 'ps-' + (s.outcome === 'win' ? 'win' : s.outcome === 'draw' ? 'draw' : 'loss'));
        // заголовок має відповідати підсумку
        var T = $('winner-title'), E = $('winner-emoji');
        if (T && E) {
            var tx = T.textContent || '';
            if (s.outcome === 'win' && !/ПЕРЕМОГ/i.test(tx)) { T.textContent = 'ПЕРЕМОГА!'; E.textContent = s.mode === 'battle_royale' ? '👑' : '🏆'; }
            else if (s.outcome === 'draw' && !/НІЧИЯ/i.test(tx)) { T.textContent = 'НІЧИЯ'; E.textContent = '🤝'; }
            else if (s.outcome === 'loss' && /ПЕРЕМОГ|НІЧИЯ/i.test(tx)) { T.textContent = 'ПОРАЗКА'; E.textContent = '💔'; }
        }
        var mi = modeInfo(s.mode), kindPvp = mi ? mi.kind === 'pvp' : false;
        var showPlace = s.place > 0 && s.players > 2 && kindPvp;
        var h = '<div class="ps-chips"><span>' + esc(s.modeEmoji || (mi && mi.e) || '🎮') + ' ' + esc(s.modeName || (mi && mi.n) || '') + '</span><span>⏱ ' + fmtDur(s.durationMs) + '</span></div>';
        var cells = [];
        if (showPlace) cells.push('<div class="ps-t pl"><i>Місце</i><b>' + s.place + '<small style="display:inline;color:#94a3b8;font-size:12px">/' + s.players + '</small></b></div>');
        cells.push('<div class="ps-t"><i>Вбивства</i><b>🎯 ' + num(s.kills) + '</b></div>');
        cells.push('<div class="ps-t"><i>Смерті</i><b>💀 ' + num(s.deaths) + '</b></div>');
        cells.push('<div class="ps-t cr"><i>Кредити</i><b>' + (window.creditIcon ? creditIcon(20) : '') + '+' + num(s.credits) + '</b></div>');
        cells = cells.map(function (c, i) { return c.replace('class="ps-t', 'style="--i:' + i + '" class="ps-t'); });
        h += '<div class="ps-tiles' + (cells.length === 3 ? ' n3' : '') + '">' + cells.join('') + '</div>';
        h += '<div class="wx ps-xp" id="ps-xp"><div class="wx-top"><span class="wx-kind">🏆</span><span class="wx-gain">+0 XP</span></div><div class="wx-row"><div class="wx-ico"></div><div class="wx-main"><div class="wx-lvl">Рівень 1</div><div class="xpbar xpbar-lg"><div class="xpbar-fill"></div><div class="xpbar-notch"></div><div class="xpbar-txt"></div></div></div></div><div class="wx-up hidden"></div></div>';
        h += '<div class="ps-next" id="ps-next"></div>';
        var m = s.dropped && MODS() ? MODULES[s.dropped] : null;
        if (m) { var R = (RAR() && RARITY[m.rarity]) || { name: '', color: '#a855f7' }; h += '<div class="ps-drop" style="--rc:' + R.color + '"><div class="ic">' + (window.modIcon ? modIcon(m) : '') + '</div><div class="tx"><small>Трофей з бою</small><b>' + esc(m.name) + '</b><em>' + esc(R.name) + (CATN() ? ' · ' + esc(CAT_NAMES[m.type] || '') : '') + '</em></div></div>'; }
        if (s.board && s.board.length > 1) {
            h += '<div class="ps-board">' + s.board.slice(0, 5).map(function (b, i) { return '<div class="ps-br' + (b.me ? ' me' : '') + '"><span>' + (b.place || i + 1) + '</span><em>' + (b.bot ? '🤖 ' : '') + esc(b.name) + '</em><u>' + num(b.kills) + ' / ' + num(b.deaths) + '</u></div>'; }).join('') + '</div>';
        }
        box.innerHTML = h; box.classList.remove('hidden');
        // досвід: перевикористовуємо анімацію рівнів
        var root = $('ps-xp'), info = { before: s.xpBefore, after: s.xpAfter, outcome: s.outcome, lvlBefore: s.lvlBefore, lvlAfter: s.lvlAfter };
        if (window.LV && LV.animateXp && LV._pmOrig) LV._pmOrig(info, root); else if (window.LV && LV.animateXp) LV.animateXp(info, root);
        var nx = $('ps-next'), gain = s.xp | 0, t0 = performance.now();
        function nextTxt(g) {
            return '<b>+' + g + '</b> досвіду' + (s.maxLevel ? ' · <b class="l">максимальний рівень</b>' : ' · до наступного рівня <b class="n">' + num(s.toNext) + '</b>') + (s.lvlAfter > s.lvlBefore ? '<br><b class="l">⬆ Новий рівень: ' + s.lvlAfter + ' · ' + esc(s.rank || '') + '</b>' : '');
        }
        nx.innerHTML = nextTxt(0);
        (function tick(now) { var k = Math.min(1, (now - t0) / 1300); nx.innerHTML = nextTxt(Math.round(gain * (1 - Math.pow(1 - k, 3)))); if (k < 1 && nx.isConnected) requestAnimationFrame(tick); })(t0);
        // зайві рядки від режимів, що дублюють плитки
        var mf = $('mfx-sum');
        if (mf) { Array.prototype.forEach.call(mf.children, function (r) { var l = r.firstElementChild && r.firstElementChild.textContent; if (l === 'Ваші вбивства' || l === 'Ваше місце') r.remove(); }); if (!mf.children.length) mf.style.display = 'none'; }
        // конфеті для перемоги
        var old = wm.querySelector('.ps-conf'); if (old) old.remove();
        if (s.outcome === 'win' && !low()) {
            var cf = document.createElement('div'), cols = ['#fbbf24', '#f59e0b', '#60a5fa', '#34d399', '#f472b6', '#fff'];
            cf.className = 'ps-conf';
            for (var i = 0; i < 26; i++) { var p = document.createElement('i'); p.style.left = (Math.random() * 100) + '%'; p.style.background = cols[i % cols.length]; p.style.animationDuration = (2.2 + Math.random() * 2.2) + 's'; p.style.animationDelay = (Math.random() * 1.2) + 's'; cf.appendChild(p); }
            wm.firstElementChild.insertBefore(cf, wm.firstElementChild.firstChild);
        }
    }
    function resetSummary() {
        var wm = $('winner-modal'); if (!wm) return;
        wm.classList.remove('ps-on', 'ps-win', 'ps-loss', 'ps-draw');
        var b = $('ps-box'); if (b) { b.classList.add('hidden'); b.innerHTML = ''; }
        var ex = $('ps-extra'); if (ex) ex.innerHTML = '';
        var mf = $('mfx-sum'); if (mf) mf.style.display = '';
        var c = wm.querySelector('.ps-conf'); if (c) c.remove();
        pm.shown = false; pm.sum = null;
    }
    window.PostMatch = {
        addExtra: function (html) { ensureBox(); var ex = $('ps-extra'); if (!ex) return; var d = document.createElement('div'); d.className = 'ps-ex'; d.innerHTML = html; ex.appendChild(d); },
        render: renderSummary, reset: resetSummary
    };

    // =====================================================================================
    //  Сокет
    // =====================================================================================
    function wire() {
        if (typeof socket === 'undefined') return;
        socket.on('authSuccess', function (d) { if (d && d.name) setNick(d.name, undefined, undefined); socket.emit('getProfile', {}); });
        socket.on('profile', function (p) {
            if (!p) return;
            if (p.error) { if (awaiting) { awaiting = null; clearTimeout(awaitT); pfBody.innerHTML = '<div class="pf-load">' + esc(p.error) + '</div>'; snd('ui_error'); } return; }
            setNick(p.login, p.nick, p.clan);
            if (p.self) { meProfile = p; nickChanged(); }
            if (awaiting && awaiting.self === !!p.self) { awaiting = null; clearTimeout(awaitT); renderProfile(p); }
        });
        socket.on('nicks', function (d) { if (!d || !d.map) return; Object.keys(d.map).forEach(function (k) { setNick(k, d.map[k].nick, d.map[k].clan); }); nickChanged(); });
        socket.on('nickUpdate', function (d) { if (d && d.name) { setNick(d.name, d.nick); nickChanged(); } });
        socket.on('roomsList', function (rs) { if (Array.isArray(rs)) rs.forEach(function (r) { if (r && r.hostName && typeof r.hostNick === 'string') setNick(r.hostName, r.hostNick === r.hostName ? '' : r.hostNick); }); });
        socket.on('nickResult', function (d) {
            if (!d) return;
            if (!d.ok) { snd('ui_error'); return msg('pf-nick-err', d.msg, true); }
            snd('ui_confirm'); setNick(myLogin(), d.nick); nickChanged();
            msg('pf-nick-err', ''); okAfter = 'Ім\'я змінено на «' + d.nick + '»'; msg('pf-nick-ok', okAfter);
            if (isOpen(pfEl) && cur && cur.self) { awaiting = { self: true, quiet: true }; socket.emit('getProfile', {}); }
            if (typeof renderHangar === 'function') { try { renderHangar(); } catch (e) {} }
        });
        socket.on('passwordResult', function (d) {
            if (!d) return;
            if (!d.ok) { snd('ui_error'); return msg('pf-pw-err', d.msg, true); }
            if (d.token) lsSet('tankToken', d.token);
            snd('ui_confirm'); ['pf-pw0', 'pf-pw1', 'pf-pw2'].forEach(function (i) { var e = $(i); if (e) e.value = ''; });
            msg('pf-pw-err', ''); msg('pf-pw-ok', 'Пароль змінено. Сесію оновлено.');
        });
        socket.on('profileToken', function (d) { if (d && d.token) lsSet('tankToken', d.token); });
        socket.on('ranking', function (d) { if (!d || !d.season) return; rkData = d; rkSkew = Date.now() - d.season.now; if (isOpen(rkEl)) renderRanking(); });
        socket.on('seasonReward', function (d) { if (d && d.total > 0) { srQ.push(d); srNext(); } });
        socket.on('matchSummary', function (s) {
            if (!s) return;
            s.recv = Date.now();
            if (pm.goAt && s.recv - pm.goAt < 8000 && !pm.shown) renderSummary(s); else { pm.sum = s; pm.sumAt = s.recv; }
        });
        socket.on('gameOver', function () {
            pm.goAt = Date.now(); pm.shown = false;
            var wm = $('winner-modal'); if (wm) { wm.classList.remove('ps-on', 'ps-win', 'ps-loss', 'ps-draw'); var b = $('ps-box'); if (b) { b.classList.add('hidden'); } }
            ensureBox();
            if (pm.sum && Date.now() - pm.sumAt < 3000) { var s = pm.sum; pm.sum = null; renderSummary(s); }
        });
    }
    wire();

    // стара анімація досвіду в #winner-xp відкладається: якщо за мить прийде персональний підсумок — вона не потрібна
    if (window.LV && LV.animateXp && !LV._pmOrig) {
        var orig = LV.animateXp; LV._pmOrig = orig;
        LV.animateXp = function (info, root) {
            if (root) return orig(info, root);
            if (pm.shown) return;
            clearTimeout(pm.t); pm.t = setTimeout(function () { if (!pm.shown) orig(info); }, 500);
        };
    }
    // ховаємо підсумки, коли вікно результату закрите
    (function () {
        var wm = $('winner-modal'); if (!wm || !window.MutationObserver) return;
        new MutationObserver(function () { if (wm.classList.contains('hidden') && (pm.shown || $('ps-extra') && $('ps-extra').children.length)) resetSummary(); }).observe(wm, { attributes: true, attributeFilter: ['class'] });
    })();

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        var ci = $('case-info-modal'); if (ci && !ci.classList.contains('hidden')) return;
        if (isOpen(srEl)) return;
        if (isOpen(pfEl)) { e.preventDefault(); closeProfile(); }
        else if (isOpen(rkEl)) { e.preventDefault(); closeRanking(); }
    });

    // =====================================================================================
    //  Точки входу
    // =====================================================================================
    if (window.MenuHub) {
        MenuHub.addCard({ id: 'mm-profile-card', icon: '👤', title: 'ПРОФІЛЬ', sub: 'Статистика та танк', color: 'indigo', bg: '🪪', onClick: function () { openProfile(); } });
        MenuHub.addCard({ id: 'mm-rating-card', icon: '🏆', title: 'РЕЙТИНГ', sub: 'Сезонні таблиці', color: 'amber', bg: '👑', onClick: openRanking });
    }
    window.Profile = {
        open: openProfile, close: closeProfile, avatar: avatar,
        nick: function () { return (meProfile && meProfile.nick) || (NC[myLogin()] && NC[myLogin()].nick) || myLogin(); },
        me: function () { return meProfile; }
    };
    window.Ranking = { open: openRanking, close: closeRanking };
})();
