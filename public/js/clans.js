// ===== КЛАНИ: меню кланів, майстер створення, сторінка клану, рейтинг, чат =====
// Картка «КЛАНИ» у головному меню (MenuHub) → повноекранне вікно #cl-ov.
// API: Clans.open(tab) · Clans.close() · Clans.emblem(icon,c1,c2,size) → HTML-рядок SVG · Clans.state()
// Сервер: див. шапку clans.js (clanGet / clanList / clanCreate / clanJoin …; clanState / clanList / clanResult / clanChatMsg / clanNotify).
(function () {
    'use strict';
    var tr = function (s) { return (window.I18N && I18N.t) ? I18N.t(String(s)) : String(s); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var $ = function (id) { return document.getElementById(id); };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var sfx = function (n) { try { if (window.UISFX && UISFX.ready()) UISFX.play(n); else snd(n === 'ui_buy' ? 'ui_buy' : 'ui_notify'); } catch (e) {} };
    var cr = function (n, px) { return (window.creditIcon ? creditIcon(px || 15) : '') + ' ' + n; };
    var bucks = function () { try { return typeof myBucks !== 'undefined' ? (myBucks | 0) : 0; } catch (e) { return 0; } };
    var COST = 249, MAXM = 30;

    // ---------- Емблеми ----------
    var ICONS = ['tank', 'star', 'bolt', 'crown', 'skull', 'swords', 'flame', 'wing', 'aim', 'gear', 'gem', 'paw', 'moon', 'rocket', 'bomb', 'snow', 'eye', 'shield'];
    var ICON_NAMES = { tank: 'Танк', star: 'Зірка', bolt: 'Блискавка', crown: 'Корона', skull: 'Череп', swords: 'Мечі', flame: 'Полум’я', wing: 'Крило', aim: 'Приціл', gear: 'Шестерня', gem: 'Кристал', paw: 'Лапа', moon: 'Місяць', rocket: 'Ракета', bomb: 'Бомба', snow: 'Сніжинка', eye: 'Око', shield: 'Щит' };
    function starPts(cx, cy, R, r) { var p = []; for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R; p.push((cx + Math.cos(a) * rr).toFixed(1) + ',' + (cy + Math.sin(a) * rr).toFixed(1)); } return p.join(' '); }
    function gearG() { var s = ''; for (var i = 0; i < 8; i++) s += '<rect x="28.5" y="11" width="7" height="11" rx="1.6" transform="rotate(' + i * 45 + ' 32 34)"/>'; return s + '<circle cx="32" cy="34" r="16"/><circle cx="32" cy="34" r="6.5" style="fill:var(--cut)"/>'; }
    function snowG() { var s = '<g stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none">'; [0, 60, 120].forEach(function (a) { s += '<g transform="rotate(' + a + ' 32 34)"><path d="M32 12V56"/><path d="M26 17L32 23L38 17M26 51L32 45L38 51"/></g>'; }); return s + '</g><circle cx="32" cy="34" r="4.2"/>'; }
    var GL = {
        tank: '<rect x="11" y="39" width="42" height="11" rx="5.5"/><circle cx="18" cy="44.5" r="2.4" style="fill:var(--cut)"/><circle cx="32" cy="44.5" r="2.4" style="fill:var(--cut)"/><circle cx="46" cy="44.5" r="2.4" style="fill:var(--cut)"/><path d="M16 39L20 30H44L48 39Z"/><rect x="23" y="21" width="19" height="10" rx="3"/><rect x="40" y="23.6" width="17" height="4.2" rx="1.6"/>',
        star: '<polygon points="' + starPts(32, 35, 23, 9.5) + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
        bolt: '<path d="M38 8L18 37H30L25 58L46 28H34Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
        crown: '<path d="M12 46L9 22L22 32L32 14L42 32L55 22L52 46Z"/><rect x="12" y="49" width="40" height="6" rx="2.5"/><circle cx="9" cy="21" r="3.4"/><circle cx="32" cy="13" r="3.6"/><circle cx="55" cy="21" r="3.4"/><circle cx="32" cy="38" r="3.4" style="fill:var(--cut)"/>',
        skull: '<path d="M32 10C20 10 13 19 13 29C13 36 17 40 21 42V51H43V42C47 40 51 36 51 29C51 19 44 10 32 10Z"/><circle cx="24.5" cy="30" r="5.6" style="fill:var(--cut)"/><circle cx="39.5" cy="30" r="5.6" style="fill:var(--cut)"/><path d="M32 35L28.5 42H35.5Z" style="fill:var(--cut)"/><path d="M27 51V45M32 51V46M37 51V45" stroke="var(--cut)" stroke-width="2" fill="none"/>',
        swords: '<g stroke="currentColor" stroke-linecap="round" fill="none"><path d="M13 13L39 39" stroke-width="5.5"/><path d="M51 13L25 39" stroke-width="5.5"/><path d="M31 46L46 31" stroke-width="4.2"/><path d="M33 46L18 31" stroke-width="4.2"/><path d="M41 41L51 51" stroke-width="4.6"/><path d="M23 41L13 51" stroke-width="4.6"/></g>',
        flame: '<path d="M32 7C35 19 47 23 47 37C47 48 40 57 32 57C23 57 17 49 19 39C20 34 25 31 26 25C29 28 31 27 32 7Z"/><path d="M32 57C26 57 24 50 28 45C30 42 32 40 33 35C37 41 40 44 39 50C38 55 35 57 32 57Z" style="fill:var(--cut);opacity:.55"/>',
        wing: '<path d="M9 43C13 26 30 13 55 13C48 19 44 23 38 26C44 26 48 25 54 22C49 32 41 38 32 38C38 40 43 40 47 38C41 49 28 53 9 43Z"/>',
        aim: '<circle cx="32" cy="34" r="16" fill="none" stroke="currentColor" stroke-width="4.2"/><path d="M32 9V23M32 45V59M7 34H21M43 34H57" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/><circle cx="32" cy="34" r="4.6"/>',
        gear: gearG(),
        gem: '<path d="M18 15H46L57 28L32 55L7 28Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M7 28H57M18 15L25 28L32 55M46 15L39 28L32 55M25 28L32 15L39 28" stroke="var(--cut)" stroke-width="1.8" fill="none" opacity=".6" stroke-linejoin="round"/>',
        paw: '<path d="M32 31C41 31 48 39 48 46C48 52 43 53 39 51C36 49.500 28 49.500 25 51C21 53 16 52 16 46C16 39 23 31 32 31Z"/><ellipse cx="15.500" cy="29" rx="5" ry="6.800" transform="rotate(-18 15.500 29)"/><ellipse cx="26" cy="19.500" rx="5.200" ry="7.400" transform="rotate(-6 26 19.500)"/><ellipse cx="38" cy="19.500" rx="5.200" ry="7.400" transform="rotate(6 38 19.500)"/><ellipse cx="48.500" cy="29" rx="5" ry="6.800" transform="rotate(18 48.500 29)"/>',
        moon: '<path d="M42 9C27 11 18 22 18 35C18 47 28 57 42 57C47 57 52 55.500 56 52.500C42 52 35 44 35 34C35 24 40 16 49 11.500C46.500 10 44 9 42 9Z"/><polygon points="' + starPts(47, 40, 6, 2.6) + '"/>',
        rocket: '<path d="M32 6C42 14 45 29 42 44H22C19 29 22 14 32 6Z"/><circle cx="32" cy="26" r="5.600" style="fill:var(--cut)"/><path d="M23 36L12 47V54L24 47Z"/><path d="M41 36L52 47V54L40 47Z"/><path d="M26.500 47H37.500L32 59Z" opacity=".85"/>',
        bomb: '<circle cx="29" cy="38" r="18"/><ellipse cx="22" cy="30" rx="5" ry="3.400" transform="rotate(-35 22 30)" style="fill:var(--cut)" opacity=".4"/><path d="M40 24C44 19 48 17 52 14" stroke="currentColor" stroke-width="3.600" fill="none" stroke-linecap="round"/><polygon points="' + starPts(54, 11, 7, 2.2) + '"/>',
        snow: snowG(),
        eye: '<path d="M6 34C17 17 47 17 58 34C47 51 17 51 6 34Z"/><circle cx="32" cy="34" r="11" style="fill:var(--cut)" opacity=".85"/><circle cx="32" cy="34" r="5" /><circle cx="35.500" cy="30.500" r="2" style="fill:var(--cut)" opacity=".5"/>',
        shield: '<path d="M32 12L50 19V33C50 44 42 51 32 56C22 51 14 44 14 33V19Z"/><path d="M23 32L30 39L42 26" stroke="var(--cut)" stroke-width="4.600" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    };
    var SH_OUT = 'M32 2L59 11V32C59 48 47 58 32 63C17 58 5 48 5 32V11Z', SH_IN = 'M32 6.500L55 14V32C55 45.500 45 54 32 58.500C19 54 9 45.500 9 32V14Z';
    var eid = 0;
    function emblem(icon, c1, c2, size, cls) {
        if (!GL[icon]) icon = 'tank';
        c1 = /^#[0-9a-f]{6}$/i.test(c1) ? c1 : '#f59e0b'; c2 = /^#[0-9a-f]{6}$/i.test(c2) ? c2 : '#b45309';
        var u = 'cle' + c1.slice(1) + c2.slice(1), g = GL[icon];   // id детермінований за кольорами: однакові дані дають однаковий HTML (без зайвих змін DOM)
        return '<svg class="cl-emb ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 64 64" style="--e1:' + c1 + ';--e2:' + c2 + '" aria-hidden="true" focusable="false"><defs>' +
            '<linearGradient id="' + u + 'a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
            '<linearGradient id="' + u + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".5" stop-color="' + c1 + '"/><stop offset="1" stop-color="' + c2 + '"/></linearGradient>' +
            '<linearGradient id="' + u + 'c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
            '<clipPath id="' + u + 'p"><path d="' + SH_IN + '"/></clipPath></defs>' +
            '<path d="' + SH_OUT + '" fill="url(#' + u + 'b)"/><path d="' + SH_IN + '" fill="url(#' + u + 'a)"/>' +
            '<path d="' + SH_IN + '" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.200"/>' +
            '<g clip-path="url(#' + u + 'p)"><path d="M9 6H55V30C40 24 24 24 9 30Z" fill="url(#' + u + 'c)" opacity=".55"/><rect class="cl-sheen" x="-30" y="-4" width="14" height="80" fill="#fff" opacity=".35" transform="skewX(-20)"/></g>' +
            '<g transform="translate(.9 1.6)" fill="currentColor" style="color:#000;--cut:#000" opacity=".32">' + g + '</g>' +
            '<g fill="currentColor" style="color:#fff;--cut:#0b1220">' + g + '</g></svg>';
    }

    var SWATCH = ['#f59e0b', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316', '#e2e8f0', '#64748b', '#1e293b', '#7f1d1d'];
    var DEF_EMB = { icon: 'tank', color1: '#f59e0b', color2: '#b45309' };
    var JOIN_NAME = { open: 'Відкритий', request: 'За заявкою', closed: 'Закритий' }, JOIN_ICO = { open: '🔓', request: '✉️', closed: '🔒' };
    var ROLE_NAME = { leader: 'Лідер', officer: 'Офіцер', member: 'Учасник' }, ROLE_ICO = { leader: '👑', officer: '⭐', member: '' };
    var LVN = ['Новобранці', 'Загін', 'Взвод', 'Рота', 'Батальйон', 'Полк', 'Бригада', 'Дивізія', 'Корпус', 'Легенда'];

    // ---------- Стилі ----------
    var CSS = '' +
        '.cl-ov{position:fixed;inset:0;z-index:120;display:none;font-family:"Russo One",Arial,sans-serif;color:#e2e8f0;background:radial-gradient(1200px 700px at 15% -10%,rgba(99,102,241,.28),transparent 60%),radial-gradient(900px 600px at 100% 0,rgba(245,158,11,.16),transparent 55%),linear-gradient(180deg,#0a1226,#050a18);opacity:0;transition:opacity .22s}' +
        '.cl-ov.on{display:block}.cl-ov.show{opacity:1}' +
        '.cl-ov:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.5;background-image:linear-gradient(rgba(148,163,184,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.06) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 0,#000,transparent 75%);mask-image:radial-gradient(ellipse at 50% 0,#000,transparent 75%)}' +
        '.cl-wrap{position:relative;max-width:1180px;margin:0 auto;height:100%;display:flex;flex-direction:column}' +
        '.cl-top{display:flex;align-items:center;gap:10px;padding:max(12px,env(safe-area-inset-top)) 16px 8px}' +
        '.cl-top h1{margin:0;flex:1;font-size:22px;letter-spacing:.2em;white-space:nowrap;background:linear-gradient(90deg,#fde68a,#f59e0b 40%,#fb7185);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 30px rgba(245,158,11,.25)}' +
        '.cl-top h1 small{display:block;font-size:10px;letter-spacing:.12em;color:#64748b;-webkit-text-fill-color:#64748b;margin-top:2px}' +
        '.cl-bal{display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid rgba(250,204,21,.35);background:rgba(15,23,42,.7);font-size:14px;color:#fde68a;cursor:pointer}' +
        '.cl-bal:hover{box-shadow:0 0 16px rgba(250,204,21,.3)}' +
        '.cl-x{width:40px;height:40px;border-radius:50%;border:1px solid rgba(148,163,184,.35);background:rgba(15,23,42,.75);color:#cbd5e1;font-size:17px;cursor:pointer;flex-shrink:0;transition:.2s;font-family:inherit}' +
        '.cl-x:hover{border-color:#f87171;color:#fecaca;box-shadow:0 0 16px rgba(248,113,113,.4)}' +
        '.cl-main{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;padding:6px 16px max(22px,env(safe-area-inset-bottom));scrollbar-width:thin;scrollbar-color:#334155 transparent}' +
        // емблема
        '.cl-emb{display:block;overflow:visible;filter:drop-shadow(0 0 7px color-mix(in srgb,var(--e1) 65%,transparent));flex-shrink:0}' +
        '.cl-emb .cl-sheen{animation:clSheen 4.5s ease-in-out infinite}@keyframes clSheen{0%,55%{transform:translateX(0) skewX(-20deg)}100%{transform:translateX(150px) skewX(-20deg)}}' +
        '.cl-emb.bob{animation:clBob 3.6s ease-in-out infinite}@keyframes clBob{50%{transform:translateY(-5px) scale(1.03)}}' +
        '.cl-emb.pulse{animation:clPulse 2.6s ease-in-out infinite}@keyframes clPulse{50%{filter:drop-shadow(0 0 20px var(--e1)) drop-shadow(0 0 6px var(--e2))}}' +
        // героя вітрини
        '.cl-hero{position:relative;overflow:hidden;border-radius:24px;padding:22px 24px;margin:6px 0 16px;border:1px solid rgba(245,158,11,.45);background:linear-gradient(120deg,rgba(120,53,15,.55),rgba(30,27,75,.8) 55%,rgba(15,23,42,.9));box-shadow:0 18px 50px rgba(0,0,0,.45),inset 0 0 60px rgba(245,158,11,.08);display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center}' +
        '.cl-hero:before{content:"";position:absolute;width:420px;height:420px;right:-90px;top:-170px;border-radius:50%;background:conic-gradient(from 0deg,rgba(251,191,36,.0),rgba(251,191,36,.28),rgba(251,113,133,.0),rgba(99,102,241,.25),rgba(251,191,36,.0));animation:clSpin 14s linear infinite;filter:blur(2px)}@keyframes clSpin{to{transform:rotate(360deg)}}' +
        '.cl-hero h2{margin:0 0 6px;font-size:26px;line-height:1.15;letter-spacing:.04em;text-shadow:0 2px 14px rgba(0,0,0,.6)}.cl-hero h2 em{font-style:normal;background:linear-gradient(90deg,#fde68a,#fb923c);-webkit-background-clip:text;background-clip:text;color:transparent}' +
        '.cl-hero p{margin:0 0 12px;color:#cbd5e1;font-size:13px;line-height:1.5;max-width:560px;font-family:Arial,sans-serif}' +
        '.cl-perks{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}.cl-perk{padding:5px 10px;border-radius:999px;font-size:11px;letter-spacing:.04em;border:1px solid rgba(253,230,138,.3);background:rgba(15,23,42,.55);color:#fde68a}' +
        '.cl-cta{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:10px;padding:13px 22px;border-radius:16px;border:1px solid #fde68a;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#1c0a00;font:inherit;font-size:16px;letter-spacing:.06em;cursor:pointer;box-shadow:0 10px 30px rgba(245,158,11,.4);transition:transform .2s,box-shadow .2s}' +
        '.cl-cta:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 14px 38px rgba(245,158,11,.6)}.cl-cta:active{transform:scale(.98)}' +
        '.cl-cta:after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:clShine 3.2s ease-in-out infinite}@keyframes clShine{60%,100%{left:140%}}' +
        '.cl-cta b{background:rgba(28,10,0,.18);padding:3px 9px;border-radius:999px;display:inline-flex;align-items:center;gap:4px;font-weight:400}' +
        '.cl-cta.poor{background:linear-gradient(135deg,#475569,#334155);border-color:#64748b;color:#cbd5e1;box-shadow:none}.cl-cta.poor:after{display:none}' +
        '.cl-cta small{font-size:11px;color:#fca5a5;margin-left:2px}' +
        '.cl-cta.busy{opacity:.6;pointer-events:none}' +
        '.cl-deco{position:relative;width:230px;height:150px}.cl-deco .cl-emb{position:absolute}.cl-deco .cl-emb:nth-child(1){left:70px;top:10px;z-index:2}.cl-deco .cl-emb:nth-child(2){left:6px;top:62px}.cl-deco .cl-emb:nth-child(3){left:150px;top:56px}' +
        // вкладки
        '.cl-tabs{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0 12px;-webkit-overflow-scrolling:touch}.cl-tabs::-webkit-scrollbar{display:none}' +
        '.cl-tab{position:relative;flex:0 0 auto;padding:10px 16px;border-radius:13px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.6);color:#94a3b8;font:inherit;font-size:13px;letter-spacing:.05em;cursor:pointer;white-space:nowrap;transition:.2s}' +
        '.cl-tab:hover{color:#e2e8f0;border-color:rgba(245,158,11,.5)}.cl-tab.on{color:#fff;border-color:#f59e0b;background:linear-gradient(135deg,rgba(245,158,11,.4),rgba(124,58,237,.3));box-shadow:0 0 18px rgba(245,158,11,.3)}' +
        '.cl-tab b{display:inline-block;min-width:18px;height:18px;line-height:18px;border-radius:9px;margin-left:6px;padding:0 5px;font-size:10px;text-align:center;background:#ef4444;color:#fff;box-shadow:0 0 10px rgba(239,68,68,.6)}' +
        '.cl-search{display:flex;gap:8px;margin:0 0 14px}.cl-search input{flex:1;min-width:0;padding:12px 14px;border-radius:13px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.6);color:#fff;font:inherit;font-size:14px;outline:none}.cl-search input:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2)}' +
        '.cl-note{font-size:11px;color:#64748b;letter-spacing:.04em;margin:0 2px 10px;font-family:Arial,sans-serif}' +
        // картки кланів
        '.cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px}' +
        '.cl-card{--e1:#f59e0b;--e2:#b45309;position:relative;overflow:hidden;border-radius:20px;border:1px solid color-mix(in srgb,var(--e1) 50%,transparent);background:linear-gradient(160deg,color-mix(in srgb,var(--e1) 26%,#0b1226),rgba(8,13,28,.95) 62%);padding:14px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(0,0,0,.4);transition:transform .22s cubic-bezier(.2,1.2,.4,1),box-shadow .22s;animation:clIn .45s both;cursor:pointer}' +
        '.cl-card:hover{transform:translateY(-4px);box-shadow:0 16px 40px color-mix(in srgb,var(--e1) 35%,transparent)}@keyframes clIn{from{opacity:0;transform:translateY(14px)}}' +
        '.cl-card:after{content:"";position:absolute;right:-40px;top:-40px;width:140px;height:140px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--e1) 45%,transparent),transparent 70%);pointer-events:none}' +
        '.cl-c-hd{display:flex;gap:12px;align-items:center;position:relative;z-index:1}.cl-c-nm{min-width:0;flex:1}.cl-c-nm b{display:block;font-size:16px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.cl-tag{display:inline-block;margin-top:3px;padding:2px 8px;border-radius:8px;font-size:11px;letter-spacing:.12em;color:var(--e1);background:rgba(2,6,23,.55);border:1px solid color-mix(in srgb,var(--e1) 50%,transparent)}' +
        '.cl-rk{position:absolute;right:0;top:0;z-index:1;font-size:12px;color:#94a3b8}.cl-rk b{color:#fde68a;font-weight:400;font-size:15px}' +
        '.cl-chips{display:flex;flex-wrap:wrap;gap:6px;position:relative;z-index:1}.cl-chip{padding:4px 9px;border-radius:999px;font-size:11px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.25);color:#cbd5e1;display:inline-flex;gap:5px;align-items:center;white-space:nowrap}' +
        '.cl-chip.gold{color:#fde68a;border-color:rgba(250,204,21,.4)}.cl-chip.red{color:#fecaca;border-color:rgba(248,113,113,.4)}.cl-chip.green{color:#bbf7d0;border-color:rgba(74,222,128,.4)}' +
        '.cl-desc{margin:0;font-size:12px;color:#94a3b8;line-height:1.45;min-height:17px;font-family:Arial,sans-serif;position:relative;z-index:1;overflow-wrap:anywhere}' +
        '.cl-btn{position:relative;z-index:1;padding:11px 14px;border-radius:13px;border:1px solid rgba(96,165,250,.6);background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font:inherit;font-size:13px;letter-spacing:.06em;cursor:pointer;transition:.2s}' +
        '.cl-btn:hover{filter:brightness(1.15);box-shadow:0 0 18px rgba(99,102,241,.5)}.cl-btn:disabled,.cl-btn.dis{opacity:.45;cursor:not-allowed;filter:none;box-shadow:none}' +
        '.cl-btn.gold{border-color:#fde68a;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#1c0a00}.cl-btn.green{border-color:#4ade80;background:linear-gradient(135deg,#16a34a,#0d9488)}' +
        '.cl-btn.ghost{background:rgba(15,23,42,.7);border-color:rgba(148,163,184,.4);color:#cbd5e1}.cl-btn.red{border-color:#f87171;background:linear-gradient(135deg,#dc2626,#9f1239)}.cl-btn.sm{padding:7px 11px;font-size:12px;border-radius:10px}' +
        '.cl-empty{text-align:center;padding:36px 12px;color:#64748b;font-size:14px;line-height:1.6}.cl-empty i{display:block;font-style:normal;font-size:44px;margin-bottom:8px;filter:grayscale(.3)}' +
        // сторінка клану
        '.cl-banner{--e1:#f59e0b;--e2:#b45309;position:relative;overflow:hidden;border-radius:26px;padding:20px 22px;margin:6px 0 14px;border:1px solid color-mix(in srgb,var(--e1) 60%,transparent);background:linear-gradient(120deg,color-mix(in srgb,var(--e1) 38%,#0a1020),color-mix(in srgb,var(--e2) 30%,#070c1a) 60%,#070c1a);box-shadow:0 18px 50px rgba(0,0,0,.5),0 0 40px color-mix(in srgb,var(--e1) 20%,transparent),inset 0 0 70px color-mix(in srgb,var(--e1) 12%,transparent);display:flex;gap:22px;align-items:center}' +
        '.cl-banner:before{content:"";position:absolute;left:-60px;top:-120px;width:420px;height:420px;border-radius:50%;background:conic-gradient(from 0deg,transparent,color-mix(in srgb,var(--e1) 40%,transparent),transparent 30%,color-mix(in srgb,var(--e2) 35%,transparent),transparent 70%);animation:clSpin 16s linear infinite;opacity:.65}' +
        '.cl-banner:after{content:"";position:absolute;inset:0;background-image:linear-gradient(60deg,rgba(255,255,255,.04) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.04) 50%,rgba(255,255,255,.04) 75%,transparent 75%);background-size:26px 45px;opacity:.7;pointer-events:none}' +
        '.cl-b-emb{position:relative;z-index:1;flex-shrink:0;display:grid;place-items:center;width:150px;height:150px}.cl-b-emb:before{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px dashed color-mix(in srgb,var(--e1) 60%,transparent);animation:clSpin 22s linear infinite;opacity:.7}' +
        '.cl-b-emb:after{content:"";position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--e1) 55%,transparent),transparent 68%);filter:blur(10px);animation:clGlow 3s ease-in-out infinite}@keyframes clGlow{50%{opacity:.5;transform:scale(1.12)}}' +
        '.cl-b-emb .cl-emb{position:relative;z-index:1}' +
        '.cl-b-in{position:relative;z-index:1;min-width:0;flex:1}.cl-b-in h2{margin:0;font-size:28px;line-height:1.1;letter-spacing:.03em;overflow-wrap:anywhere;text-shadow:0 2px 16px rgba(0,0,0,.7)}' +
        '.cl-b-in .cl-tag{font-size:13px;margin:6px 0 0;padding:3px 11px}.cl-b-lv{margin:12px 0 4px;display:flex;align-items:center;gap:10px;font-size:12px;color:#cbd5e1;flex-wrap:wrap}' +
        '.cl-b-lv strong{font-weight:400;color:#fde68a;font-size:14px}.cl-bar{position:relative;flex:1;min-width:120px;height:10px;border-radius:6px;background:rgba(2,6,23,.7);border:1px solid rgba(148,163,184,.25);overflow:hidden}.cl-bar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,var(--e2),var(--e1),#fff);box-shadow:0 0 12px var(--e1);transition:width .6s}' +
        '.cl-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.cl-st{padding:7px 12px;border-radius:12px;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.22);font-size:11px;color:#94a3b8;letter-spacing:.05em;min-width:84px}.cl-st b{display:block;font-size:17px;font-weight:400;color:#fff;letter-spacing:0;margin-top:1px}.cl-st b.gold{color:#fde68a}' +
        // панелі
        '.cl-still .cl-pn,.cl-still .cl-card,.cl-still .cl-row{animation:none!important}.cl-pn{animation:clIn .35s both}.cl-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
        '.cl-box{border-radius:18px;padding:14px 16px;border:1px solid rgba(148,163,184,.2);background:linear-gradient(145deg,rgba(30,41,59,.6),rgba(8,13,28,.85));margin-bottom:14px}' +
        '.cl-box h3{margin:0 0 10px;font-size:12px;letter-spacing:.16em;color:#94a3b8;font-weight:400;display:flex;align-items:center;gap:8px}.cl-box h3:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,rgba(100,116,139,.5),transparent)}' +
        '.cl-day{display:flex;align-items:center;gap:14px}.cl-ring{--p:0;position:relative;width:82px;height:82px;border-radius:50%;flex-shrink:0;background:conic-gradient(#fbbf24 calc(var(--p)*1%),rgba(51,65,85,.7) 0);display:grid;place-items:center;box-shadow:0 0 22px rgba(251,191,36,.2)}.cl-ring:before{content:"";position:absolute;inset:7px;border-radius:50%;background:#0b1226}.cl-ring b{position:relative;font-size:18px;font-weight:400;color:#fde68a}' +
        '.cl-day p{margin:0;font-size:12px;line-height:1.55;color:#94a3b8;font-family:Arial,sans-serif}.cl-day p strong{color:#fde68a;font-weight:700}' +
        '.cl-how{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cl-how div{padding:9px 10px;border-radius:12px;background:rgba(2,6,23,.5);border:1px solid rgba(148,163,184,.16);font-size:11px;color:#94a3b8;line-height:1.4}.cl-how b{display:block;color:#a5f3fc;font-weight:400;font-size:15px}' +
        '.cl-pod{display:flex;gap:10px;align-items:flex-end;justify-content:center;margin:6px 0 4px}' +
        '.cl-pd{--e1:#f59e0b;--e2:#b45309;flex:1;max-width:240px;min-width:0;text-align:center;cursor:pointer}.cl-pd .cl-emb{margin:0 auto 6px}' +
        '.cl-pd b{display:block;font-size:14px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 4px}.cl-pd small{display:block;font-size:11px;color:#94a3b8;margin:2px 0 6px}' +
        '.cl-pd .cl-step{border-radius:14px 14px 0 0;display:flex;align-items:flex-start;justify-content:center;padding-top:8px;font-size:28px;color:rgba(255,255,255,.92);text-shadow:0 2px 8px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);border-bottom:0}' +
        '.cl-pd.p1 .cl-step{height:112px;background:linear-gradient(180deg,#fbbf24,#b45309);box-shadow:0 0 30px rgba(251,191,36,.4)}.cl-pd.p2 .cl-step{height:82px;background:linear-gradient(180deg,#e2e8f0,#64748b)}.cl-pd.p3 .cl-step{height:62px;background:linear-gradient(180deg,#fdba74,#9a3412)}' +
        '.cl-pd.p1 .cl-emb{animation:clBob 3.4s ease-in-out infinite}.cl-pd .pts{color:#fde68a;font-size:12px}' +
        '.cl-crown{display:block;text-align:center;font-size:22px;margin-bottom:-4px;animation:clBob 3s ease-in-out infinite}' +
        '.cl-row{--e1:#f59e0b;display:flex;align-items:center;gap:11px;padding:9px 12px;margin-bottom:7px;border-radius:14px;border:1px solid rgba(148,163,184,.16);background:linear-gradient(135deg,rgba(30,41,59,.6),rgba(15,23,42,.6));animation:clIn .35s both;position:relative}' +
        '.cl-row.me{border-color:rgba(251,191,36,.7);background:linear-gradient(135deg,rgba(120,53,15,.45),rgba(15,23,42,.7));box-shadow:0 0 18px rgba(251,191,36,.15)}.cl-row.link{cursor:pointer}.cl-row.link:hover{border-color:rgba(251,191,36,.5)}' +
        '.cl-n{width:30px;text-align:center;font-size:15px;color:#94a3b8;flex-shrink:0}.cl-info{min-width:0;flex:1}.cl-info b{display:block;font-size:14px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cl-info small{display:block;font-size:11px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
        '.cl-pts{font-size:15px;color:#fde68a;text-align:right;flex-shrink:0}.cl-pts small{display:block;font-size:10px;color:#64748b;letter-spacing:.06em}' +
        // учасники
        '.cl-av{position:relative;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-size:17px;color:#fff;flex-shrink:0;border:2px solid rgba(255,255,255,.18);box-shadow:inset 0 0 10px rgba(0,0,0,.35)}' +
        '.cl-dot{position:absolute;right:-2px;bottom:-2px;width:13px;height:13px;border-radius:50%;background:#475569;border:2px solid #0b1226}.cl-dot.on{background:#22c55e;box-shadow:0 0 10px #22c55e}' +
        '.cl-mem.hot{border-color:rgba(251,191,36,.55);background:linear-gradient(135deg,rgba(120,53,15,.4),rgba(15,23,42,.65));box-shadow:0 0 16px rgba(251,191,36,.12)}' +
        '.cl-role{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:8px;font-size:10px;letter-spacing:.06em;margin-left:6px;vertical-align:middle;border:1px solid rgba(148,163,184,.3);color:#94a3b8}.cl-role.leader{color:#fde68a;border-color:rgba(250,204,21,.6);background:rgba(250,204,21,.1)}.cl-role.officer{color:#a5f3fc;border-color:rgba(34,211,238,.5);background:rgba(34,211,238,.08)}' +
        '.cl-td{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:8px;font-size:10px;color:#1c0a00;background:linear-gradient(135deg,#fde68a,#f59e0b);vertical-align:middle}' +
        '.cl-acts{display:flex;gap:5px;flex-shrink:0}.cl-ia{width:34px;height:34px;border-radius:10px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.8);color:#cbd5e1;cursor:pointer;font-size:15px;font-family:inherit;transition:.2s}.cl-ia:hover{border-color:#60a5fa;color:#fff}.cl-ia.bad:hover{border-color:#f87171;color:#fecaca;box-shadow:0 0 12px rgba(248,113,113,.4)}' +
        '.cl-lv{flex-shrink:0;display:flex;align-items:center}' +
        '.cl-log{list-style:none;margin:0;padding:0;font-size:12px;color:#94a3b8;font-family:Arial,sans-serif}.cl-log li{padding:6px 0;border-bottom:1px solid rgba(148,163,184,.1);display:flex;gap:8px;justify-content:space-between}.cl-log time{color:#475569;font-size:10px;white-space:nowrap}' +
        // чат
        '.cl-chat{display:flex;flex-direction:column;height:min(58vh,520px);min-height:260px}.cl-msgs{flex:1;overflow-y:auto;padding:4px 2px 8px;display:flex;flex-direction:column;gap:7px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}' +
        '.cl-msg{max-width:82%;padding:8px 12px;border-radius:14px 14px 14px 4px;background:rgba(30,41,59,.85);border:1px solid rgba(148,163,184,.18);font-size:13px;line-height:1.4;font-family:Arial,sans-serif;overflow-wrap:anywhere;align-self:flex-start;animation:clIn .25s both}.cl-msg.me{align-self:flex-end;border-radius:14px 14px 4px 14px;background:linear-gradient(135deg,rgba(37,99,235,.55),rgba(124,58,237,.45));border-color:rgba(129,140,248,.5)}' +
        '.cl-msg b{display:block;font-family:"Russo One",Arial,sans-serif;font-weight:400;font-size:11px;color:#fde68a;margin-bottom:2px}.cl-msg time{float:right;margin-left:10px;font-size:10px;color:#64748b}' +
        '.cl-send{display:flex;gap:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,.15)}.cl-send input,.cl-f input,.cl-f textarea,.cl-f select{width:100%;box-sizing:border-box;padding:11px 13px;border-radius:12px;border:1px solid rgba(148,163,184,.3);background:rgba(2,6,23,.65);color:#fff;font:inherit;font-size:14px;outline:none}' +
        '.cl-send input:focus,.cl-f input:focus,.cl-f textarea:focus,.cl-f select:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,.2)}.cl-f textarea{font-family:Arial,sans-serif;resize:none;height:70px}' +
        // форми / майстер
        '.cl-wiz{position:absolute;inset:0;z-index:5;display:none;background:radial-gradient(900px 500px at 80% -10%,rgba(245,158,11,.14),transparent 60%),linear-gradient(180deg,#0a1226,#050a18)}.cl-wiz.on{display:block}' +
        '.cl-wbox{position:relative;max-width:1000px;margin:0 auto;height:100%;display:flex;flex-direction:column}' +
        '.cl-wgrid{flex:1;min-height:0;overflow-y:auto;padding:4px 16px 16px;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);gap:18px;align-items:start;-webkit-overflow-scrolling:touch}' +
        '.cl-f{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}.cl-f>label,.cl-lb{font-size:11px;letter-spacing:.14em;color:#94a3b8;display:flex;justify-content:space-between}.cl-f>label span{color:#64748b;letter-spacing:0}' +
        '.cl-f.bad input,.cl-f.bad textarea{border-color:#f87171;box-shadow:0 0 0 3px rgba(248,113,113,.2)}.cl-hint{font-size:11px;color:#64748b;min-height:14px;font-family:Arial,sans-serif}.cl-f.bad .cl-hint{color:#f87171}' +
        '.cl-eg{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:7px}.cl-ep{position:relative;padding:6px 0;border-radius:12px;border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.7);cursor:pointer;display:grid;place-items:center;transition:.18s;color:inherit}.cl-ep:hover{transform:translateY(-2px);border-color:rgba(245,158,11,.6)}.cl-ep.on{border-color:#fbbf24;background:rgba(245,158,11,.16);box-shadow:0 0 16px rgba(245,158,11,.35)}' +
        '.cl-ep .cl-emb{filter:none}.cl-sw{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.cl-sw button{width:28px;height:28px;border-radius:50%;border:2px solid rgba(255,255,255,.2);cursor:pointer;padding:0;transition:.15s}.cl-sw button:hover{transform:scale(1.15)}.cl-sw button.on{border-color:#fff;box-shadow:0 0 0 2px rgba(0,0,0,.6),0 0 14px currentColor;transform:scale(1.12)}.cl-sw input[type=color]{width:34px;height:30px;padding:0;border:1px solid rgba(148,163,184,.4);border-radius:8px;background:none;cursor:pointer}' +
        '.cl-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.cl-seg button{padding:10px 4px;border-radius:12px;border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.7);color:#94a3b8;font:inherit;font-size:12px;cursor:pointer;transition:.18s;line-height:1.3}.cl-seg button.on{color:#fff;border-color:#fbbf24;background:rgba(245,158,11,.18);box-shadow:0 0 14px rgba(245,158,11,.3)}.cl-seg button i{display:block;font-style:normal;font-size:18px}' +
        '.cl-prev{position:sticky;top:0}.cl-prev .cl-banner{flex-direction:column;text-align:center;margin:0 0 12px;padding:22px 16px 18px}.cl-prev .cl-b-in{width:100%}.cl-prev .cl-b-emb{width:170px;height:170px}.cl-prev .cl-chips{justify-content:center}' +
        '.cl-wft{padding:12px 16px max(14px,env(safe-area-inset-bottom));border-top:1px solid rgba(148,163,184,.18);background:rgba(5,10,24,.88);display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:space-between}.cl-wft .cl-cta{flex:1;justify-content:center;min-width:220px}' +
        '.cl-money{font-size:12px;color:#94a3b8;display:flex;flex-direction:column;gap:2px}.cl-money b{font-weight:400;color:#fde68a;font-size:15px;display:flex;gap:5px;align-items:center}' +
        // тост + конфеті
        '.cl-toast{position:fixed;left:50%;top:max(16px,env(safe-area-inset-top));z-index:400;transform:translate(-50%,-30px);opacity:0;padding:11px 18px;border-radius:14px;max-width:min(92vw,520px);font:13px/1.35 "Russo One",Arial,sans-serif;color:#fff;border:1px solid rgba(96,165,250,.6);background:linear-gradient(135deg,rgba(30,58,138,.96),rgba(76,29,149,.96));box-shadow:0 14px 40px rgba(0,0,0,.5);transition:.3s;pointer-events:none;text-align:center}.cl-toast.on{opacity:1;transform:translate(-50%,0)}' +
        '.cl-toast.bad{border-color:#f87171;background:linear-gradient(135deg,rgba(127,29,29,.96),rgba(76,5,25,.96))}.cl-toast.good{border-color:#4ade80;background:linear-gradient(135deg,rgba(6,78,59,.96),rgba(30,58,138,.96))}.cl-toast.gold{border-color:#fde68a;background:linear-gradient(135deg,rgba(120,53,15,.97),rgba(76,29,149,.96))}' +
        '.cl-conf{position:fixed;inset:0;z-index:401;pointer-events:none;overflow:hidden}.cl-conf i{position:absolute;top:-20px;width:9px;height:14px;border-radius:2px;animation:clFall linear forwards}@keyframes clFall{to{transform:translateY(105vh) rotate(720deg)}}' +
        // адаптив
        '@media (max-width:860px){.cl-hero{grid-template-columns:1fr;padding:18px}.cl-deco{display:none}.cl-wgrid{grid-template-columns:1fr}.cl-prev{position:static;order:-1}.cl-cols{grid-template-columns:1fr}}' +
        '@media (max-width:860px){.cl-prev>.cl-card{display:none}.cl-prev .cl-banner{padding:12px;flex-direction:row;text-align:left;gap:12px}.cl-prev .cl-b-emb{width:96px;height:96px}.cl-prev .cl-b-emb .cl-emb{width:80px;height:80px}.cl-prev .cl-chips{justify-content:flex-start}.cl-prev .cl-desc{text-align:left!important}.cl-prev .cl-b-in h2{font-size:19px}}@media (max-width:640px){.cl-top h1{font-size:18px}.cl-bal{padding:6px 10px;font-size:13px}.cl-banner{flex-direction:column;text-align:center;padding:18px 14px;gap:12px}.cl-b-emb{width:120px;height:120px}.cl-b-in h2{font-size:23px}.cl-b-lv,.cl-stats{justify-content:center}.cl-st{flex:1;min-width:72px}' +
        '.cl-grid{grid-template-columns:1fr}.cl-hero h2{font-size:21px}.cl-how{grid-template-columns:1fr 1fr}.cl-row{gap:8px;padding:8px}.cl-mem{flex-wrap:wrap}.cl-mem .cl-acts{width:100%;justify-content:flex-end}.cl-lv{display:none}.cl-pd .cl-emb{width:54px;height:54px}.cl-pd b{font-size:12px}.cl-pod{gap:6px}.cl-cta{width:100%;justify-content:center}.cl-main{padding-left:12px;padding-right:12px}}' +
        '@media (max-height:480px){.cl-top{padding-top:6px}.cl-banner{flex-direction:row;text-align:left;padding:12px 16px;gap:16px}.cl-b-emb{width:96px;height:96px}.cl-b-emb .cl-emb{width:80px;height:80px}.cl-b-in h2{font-size:21px}.cl-b-lv,.cl-stats{justify-content:flex-start}.cl-hero{padding:12px 16px}.cl-hero p{display:none}.cl-prev .cl-b-emb{width:90px;height:90px}}' +
        /* телефон: безпечні зони, шапка не виштовхує «✕», цілі дотику ≥44px, поля ≥16px */
        '.cl-top{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}.cl-main{padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}' +
        '.cl-main,.cl-wgrid,.cl-msgs{overscroll-behavior:contain}.cl-top h1{min-width:0}.cl-bal{white-space:nowrap;flex-shrink:0}' +
        '@media (max-width:400px){.cl-top{gap:8px;padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}.cl-top h1{font-size:17px;letter-spacing:.1em;white-space:normal;line-height:1.1}.cl-top h1 small{font-size:9px;letter-spacing:.06em;white-space:normal}.cl-bal{padding:6px 9px;font-size:13px}.cl-main{padding-left:max(12px,env(safe-area-inset-left,0px));padding-right:max(12px,env(safe-area-inset-right,0px))}}' +
        '@media (max-width:400px){.cl-wft{padding:8px 12px max(10px,env(safe-area-inset-bottom));gap:8px}.cl-money{flex-direction:row;flex-wrap:wrap;gap:4px 10px}}@media (max-height:480px){.cl-top h1 small{display:none}.cl-wft{padding-top:6px;padding-bottom:max(6px,env(safe-area-inset-bottom))}}' +
        '@media (hover:none) and (pointer:coarse){.cl-x{width:44px;height:44px}.cl-bal{min-height:44px}.cl-tab{min-height:44px}.cl-btn{min-height:44px}.cl-search input,.cl-send input,.cl-f input,.cl-f textarea,.cl-f select{font-size:16px;min-height:44px}.cl-f textarea{min-height:70px}.cl-sw button{width:36px;height:36px}.cl-seg button{min-height:44px}.cl-chat{height:min(58dvh,520px)}.cl-note,.cl-hint,.cl-chip,.cl-role,.cl-td,.cl-pts small,.cl-tag{font-size:11px}}' +
        'html.gfx-low .cl-ov{-webkit-backdrop-filter:none;backdrop-filter:none}' +
        'html.gfx-low .cl-ov *,html.gfx-low .cl-ov *:before,html.gfx-low .cl-ov *:after{animation:none!important}html.gfx-low .cl-emb{filter:none}' +
        '@media (prefers-reduced-motion:reduce){.cl-ov *,.cl-ov *:before,.cl-ov *:after{animation:none!important}}';
    var st = document.createElement('style'); st.id = 'clans-css'; st.textContent = CSS; document.head.appendChild(st);

    // ---------- Стан ----------
    var S = { mine: null, cost: COST, got: false, list: null, q: '', peek: null }, hometab = 'browse', ctab = 'ov', isOpen = false, root = null, busy = false, busyT = 0;
    var W = null;   // стан майстра
    var pollT = 0, searchT = 0, toastT = 0, lastFocus = null;

    // ---------- Допоміжне ----------
    function hue(s) { var h = 7; s = String(s); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h % 360; }
    function avatar(login, nick, online) {
        var h = hue(login), ch = esc(String(nick || login).trim().charAt(0).toUpperCase() || '?');
        return '<div class="cl-av" style="background:linear-gradient(135deg,hsl(' + h + ',75%,52%),hsl(' + ((h + 50) % 360) + ',70%,30%))">' + ch + (online != null ? '<i class="cl-dot' + (online ? ' on' : '') + '" title="' + (online ? 'Онлайн' : 'Офлайн') + '"></i>' : '') + '</div>';
    }
    function dn(m) { try { if (window.dispName) return window.dispName({ name: m.login, nick: m.nick }) || m.nick || m.login; } catch (e) {} return m.nick || m.login; }
    function eb(c) { var e = c.emblem || DEF_EMB; return '--e1:' + e.color1 + ';--e2:' + e.color2; }
    function lvIcon(l, px) { return (window.LV && LV.icon) ? LV.icon(l, px) : '<b>' + l + '</b>'; }
    function fmt(n) { return String(n | 0).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    function ago(t) { var s = Math.max(0, (Date.now() - t) / 1000 | 0); if (s < 60) return 'щойно'; if (s < 3600) return (s / 60 | 0) + ' хв тому'; if (s < 86400) return (s / 3600 | 0) + ' год тому'; return (s / 86400 | 0) + ' д тому'; }
    function left(ts) { var s = Math.max(0, (ts - Date.now()) / 1000 | 0), d = s / 86400 | 0, h = (s % 86400) / 3600 | 0, m = (s % 3600) / 60 | 0; return d ? d + ' д ' + h + ' год' : h ? h + ' год ' + m + ' хв' : m + ' хв'; }
    function toast(text, kind) {
        var t = $('cl-toast'); if (!t) { t = document.createElement('div'); t.id = 'cl-toast'; t.className = 'cl-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
        t.className = 'cl-toast ' + (kind || ''); t.textContent = tr(text); void t.offsetWidth; t.classList.add('on');
        clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 3600);
    }
    function confetti() {
        if (document.documentElement.classList.contains('gfx-low')) return;
        var w = document.createElement('div'); w.className = 'cl-conf'; var cols = ['#fbbf24', '#f97316', '#ec4899', '#a78bfa', '#38bdf8', '#4ade80'];
        for (var i = 0; i < 60; i++) { var p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % 6]; p.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; p.style.animationDelay = Math.random() * .5 + 's'; w.appendChild(p); }
        document.body.appendChild(w); setTimeout(function () { w.remove(); }, 4000);
    }
    function emit(ev, d) {
        if (typeof socket === 'undefined' || !socket || socket.connected === false) { toast('Немає зв’язку з сервером', 'bad'); return false; }
        socket.emit(ev, d || {}); return true;
    }
    function setBusy(v) { busy = v; clearTimeout(busyT); if (v) busyT = setTimeout(function () { busy = false; toast('Немає відповіді від сервера. Спробуйте ще раз', 'bad'); render(); }, 7000); }
    function clanOfRow(c) { return c; }

    // ---------- Каркас ----------
    function build() {
        if (root) return;
        root = document.createElement('div'); root.id = 'cl-ov'; root.className = 'cl-ov'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Клани');
        root.innerHTML = '<div class="cl-wrap"><header class="cl-top"><h1>КЛАНИ<small>КОМАНДИ ТА РЕЙТИНГ СЕЗОНУ</small></h1>' +
            '<div class="cl-bal" id="cl-bal" role="button" tabindex="0" title="Гаманець"></div><button type="button" class="cl-x" id="cl-x" aria-label="Закрити">✕</button></header>' +
            '<div class="cl-main" id="cl-main"></div></div>' +
            '<div class="cl-wiz" id="cl-wiz"></div>';
        document.body.appendChild(root);
        root.addEventListener('click', onClick);
        root.addEventListener('input', onInput);
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.id === 'cl-chat-in') { e.preventDefault(); sendChat(); }
            else if ((e.key === 'Enter' || e.key === ' ') && e.target.id === 'cl-bal') { e.preventDefault(); openWallet(); }
        });
    }
    function openWallet() { if (window.Wallet && Wallet.open) Wallet.open('earn'); }
    function dlgOpen() { var d = $('dlg'); return d && !d.classList.contains('hidden'); }
    document.addEventListener('keydown', function (e) {
        if (!isOpen || e.key !== 'Escape' || dlgOpen()) return;
        var wl = $('wallet-modal'); if (wl && !wl.hidden) return;
        e.preventDefault(); e.stopPropagation();
        if (S.peek) { closePeek(); return; }
        if (W) { closeWiz(); return; }
        close();
    }, true);

    function open(tab) {
        build();
        if (isOpen) { if (tab) go(tab); return; }
        isOpen = true; lastFocus = document.activeElement;
        root.classList.add('on'); void root.offsetWidth; root.classList.add('show');
        if (tab === 'top') hometab = 'top';
        sigState = sigList = ''; still(false); render(); refreshBal();
        emit('clanGet'); emit('clanList', { q: '' });
        pollT = setInterval(function () { if (!isOpen) return; refreshBal(); if (S.mine && ctab !== 'chat' && ctab !== 'set') emit('clanGet'); if (ctab === 'top' || (!S.mine && hometab === 'top') || !S.mine) emit('clanList', { q: S.q }); }, 15000);
        snd('ui_click');
        setTimeout(function () { var x = $('cl-x'); if (x) x.focus({ preventScroll: true }); }, 50);
    }
    function close() {
        if (!isOpen) return; isOpen = false; clearInterval(pollT); closeWiz(true); closePeek();
        root.classList.remove('show'); setTimeout(function () { if (!isOpen) root.classList.remove('on'); }, 230);
        snd('ui_click'); try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
    }
    // фонові оновлення (поллінг) не програють анімацію появи заново; користувацька навігація — програє
    // фонові оновлення «вливаємо» в існуючий DOM (вузли зберігаються, анімації/прокрутка/фокус не збиваються); навігація — повний рендер з анімацією
    function put(el, h) { if (!el) return; if (window.DomPatch && root && root.classList.contains('cl-still')) DomPatch.html(el, h); else el.innerHTML = h; }
    function still(on) { if (root) root.classList.toggle('cl-still', !!on); }
    var sigState = '', sigList = '';
    function go(t) { still(false); if (S.mine) ctab = t; else hometab = t; render(); }
    function refreshBal() { var b = $('cl-bal'); if (b) b.innerHTML = cr(fmt(bucks()), 18); }

    // ---------- Вітрина (без клану) ----------
    function renderHome() {
        var b = bucks(), poor = b < S.cost, hero =
            '<section class="cl-hero"><div><h2>Створи <em>власний клан</em><br>і веди команду до слави</h2>' +
            '<p>Збирайте друзів, змагайтеся в рейтингу кланів і щодня приносьте очки своїй команді. Кращі три клани сезону отримують кредити для кожного учасника.</p>' +
            '<div class="cl-perks"><span class="cl-perk">🏆 Рейтинг сезону</span><span class="cl-perk">💬 Чат клану</span><span class="cl-perk">🎖️ Рівні кланів</span><span class="cl-perk">🥇 150 · 🥈 100 · 🥉 60 кредитів</span></div>' +
            '<button type="button" class="cl-cta' + (poor ? ' poor' : '') + '" data-a="wiz"' + (poor ? ' aria-disabled="true"' : '') + '>🛡️ Створити клан <b>' + cr(S.cost, 16) + '</b>' + (poor ? '<small>Бракує ' + (S.cost - b) + '</small>' : '') + '</button></div>' +
            '<div class="cl-deco" aria-hidden="true">' + emblem('crown', '#fbbf24', '#b45309', 96, 'bob') + emblem('swords', '#ef4444', '#7f1d1d', 70, 'pulse') + emblem('bolt', '#38bdf8', '#4338ca', 62, 'bob') + '</div></section>';
        var tabs = '<div class="cl-tabs" role="tablist"><button type="button" class="cl-tab' + (hometab === 'browse' ? ' on' : '') + '" role="tab" data-tab="browse">🔎 Усі клани</button><button type="button" class="cl-tab' + (hometab === 'top' ? ' on' : '') + '" role="tab" data-tab="top">🏆 Рейтинг кланів</button></div>';
        var body = hometab === 'top' ? '<div id="cl-top-body" data-dp-skip="1"></div>' :
            '<div class="cl-search"><input id="cl-q" type="search" maxlength="30" placeholder="Пошук за назвою або тегом" autocomplete="off" value="' + esc(S.q) + '"></div><div class="cl-grid" id="cl-grid" data-dp-skip="1"></div>';
        return hero + tabs + body;
    }
    function joinBtn(c) {
        if (c.members >= (c.max || MAXM)) return '<button type="button" class="cl-btn" disabled>Немає місць</button>';
        if (c.join === 'closed') return '<button type="button" class="cl-btn" disabled>🔒 Закритий</button>';
        var lv = myLevel(); if (lv && lv < c.minLevel) return '<button type="button" class="cl-btn" disabled>Потрібен ' + c.minLevel + ' рівень</button>';
        if (c.requested) return '<button type="button" class="cl-btn ghost" data-a="cancelreq" data-id="' + esc(c.id) + '">Заявку подано · скасувати</button>';
        return c.join === 'open' ? '<button type="button" class="cl-btn green" data-a="join" data-id="' + esc(c.id) + '">⚔ Вступити</button>' : '<button type="button" class="cl-btn" data-a="join" data-id="' + esc(c.id) + '">✉ Подати заявку</button>';
    }
    function myLevel() { try { return (window.LV && LV.state) ? (LV.state().level || 0) : 0; } catch (e) { return 0; } }
    function card(c, i) {
        return '<article class="cl-card" style="' + eb(c) + ';animation-delay:' + Math.min(i, 10) * 40 + 'ms" data-a="peek" data-id="' + esc(c.id) + '">' +
            '<div class="cl-c-hd">' + emblem(c.emblem.icon, c.emblem.color1, c.emblem.color2, 62, 'pulse') + '<div class="cl-c-nm"><b>' + esc(c.name) + '</b><span class="cl-tag">[' + esc(c.tag) + ']</span></div><div class="cl-rk">№<b>' + c.rank + '</b></div></div>' +
            '<div class="cl-chips"><span class="cl-chip gold">⭐ ' + fmt(c.points) + '</span><span class="cl-chip">Рів. ' + c.level + ' · ' + esc(c.levelName) + '</span><span class="cl-chip">👥 ' + c.members + '/' + (c.max || MAXM) + '</span><span class="cl-chip ' + (c.join === 'open' ? 'green' : c.join === 'closed' ? 'red' : '') + '">' + JOIN_ICO[c.join] + ' ' + JOIN_NAME[c.join] + '</span>' + (c.minLevel > 1 ? '<span class="cl-chip">від ' + c.minLevel + ' рів.</span>' : '') + '</div>' +
            '<p class="cl-desc">' + (esc(c.desc) || '<span style="opacity:.5">Без опису</span>') + '</p>' + (S.mine ? '' : joinBtn(c)) + '</article>';
    }
    function renderGrid() {
        var g = $('cl-grid'); if (!g) return;
        var L = S.list && S.list.list;
        if (!L) { put(g, '<div class="cl-empty" style="grid-column:1/-1"><i>⏳</i>Завантаження…</div>'); return; }
        if (!L.length) { put(g, '<div class="cl-empty" style="grid-column:1/-1"><i>🛡️</i>' + (S.q ? 'За запитом «' + esc(S.q) + '» нічого не знайдено' : 'Кланів ще немає — станьте першими!<br>Створіть свій клан і запросіть друзів') + '</div>'); return; }
        put(g, L.map(card).join(''));
    }

    // ---------- Рейтинг ----------
    function renderTop(into) {
        var L = S.list && S.list.list, mine = S.mine ? S.mine.id : (S.list && S.list.mineId);
        if (!L) return '<div class="cl-empty"><i>⏳</i>Завантаження…</div>';
        if (!L.length) return '<div class="cl-empty"><i>🏆</i>Рейтинг порожній — створіть клан першими</div>';
        var end = S.list.seasonEnd ? '<p class="cl-note">Сезон ' + esc(S.list.season) + ' · до кінця ' + left(S.list.seasonEnd) + ' · нагороди: 🥇 ' + cr(150, 13) + ' · 🥈 ' + cr(100, 13) + ' · 🥉 ' + cr(60, 13) + ' кожному учаснику</p>' : '';
        var top = L.slice(0, 3), pod = '';
        var order = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
        order.forEach(function (i) {
            var c = top[i], p = i + 1, sz = p === 1 ? 92 : 70;
            pod += '<div class="cl-pd p' + p + '" style="' + eb(c) + '" data-a="peek" data-id="' + esc(c.id) + '">' + (p === 1 ? '<span class="cl-crown">👑</span>' : '') + emblem(c.emblem.icon, c.emblem.color1, c.emblem.color2, sz, p === 1 ? 'pulse' : '') +
                '<b>' + esc(c.name) + '</b><small>[' + esc(c.tag) + '] · рів. ' + c.level + '</small><span class="pts">⭐ ' + fmt(c.points) + '</span><div class="cl-step">' + p + '</div></div>';
        });
        var rows = L.slice(3).map(function (c, i) {
            return '<div class="cl-row link' + (c.id === mine ? ' me' : '') + '" style="' + eb(c) + ';animation-delay:' + Math.min(i, 10) * 30 + 'ms" data-a="peek" data-id="' + esc(c.id) + '"><div class="cl-n">' + c.rank + '</div>' + emblem(c.emblem.icon, c.emblem.color1, c.emblem.color2, 40) +
                '<div class="cl-info"><b>' + esc(c.name) + ' <span class="cl-tag" style="margin:0 0 0 4px">[' + esc(c.tag) + ']</span></b><small>Рів. ' + c.level + ' · 👥 ' + c.members + '/' + (c.max || MAXM) + ' · ' + esc(c.leader) + '</small></div><div class="cl-pts">' + fmt(c.points) + '<small>ОЧКІВ</small></div></div>';
        }).join('');
        return end + '<div class="cl-pod">' + pod + '</div>' + rows;
    }

    // ---------- Сторінка клану ----------
    function banner(c) {
        var lvl = c.level, pct = c.lvTo ? Math.min(100, Math.round((c.totalPoints - c.lvFrom) / (c.lvTo - c.lvFrom) * 100)) : 100;
        return '<section class="cl-banner" style="' + eb(c) + '"><div class="cl-b-emb">' + emblem(c.emblem.icon, c.emblem.color1, c.emblem.color2, 128, 'bob') + '</div>' +
            '<div class="cl-b-in"><h2>' + esc(c.name) + '</h2><span class="cl-tag">[' + esc(c.tag) + ']</span>' +
            '<div class="cl-b-lv"><strong>Рівень ' + lvl + ' · ' + esc(c.levelName) + '</strong><div class="cl-bar"><i style="width:' + pct + '%"></i></div><span>' + (c.lvTo ? fmt(c.totalPoints) + ' / ' + fmt(c.lvTo) : 'максимум') + '</span></div>' +
            '<div class="cl-stats"><div class="cl-st">ОЧКИ СЕЗОНУ<b class="gold">⭐ ' + fmt(c.points) + '</b></div><div class="cl-st">МІСЦЕ<b>№' + c.rank + ' <span style="color:#64748b;font-size:12px">з ' + c.total + '</span></b></div><div class="cl-st">УЧАСНИКИ<b>' + c.count + '/' + MAXM + '</b></div><div class="cl-st">ДО КІНЦЯ СЕЗОНУ<b style="font-size:14px">' + left(c.seasonEnd) + '</b></div></div></div></section>';
    }
    function renderClan() {
        var c = S.mine, staff = c.myRole !== 'member';
        var tabs = [['ov', '📋 Огляд'], ['mem', '👥 Учасники (' + c.count + ')'], staff ? ['req', '✉ Заявки' + (c.reqCount ? ' <b>' + c.reqCount + '</b>' : '')] : null, ['top', '🏆 Рейтинг'], ['chat', '💬 Чат'], c.myRole === 'leader' ? ['set', '⚙ Налаштування'] : null].filter(Boolean);
        if (!tabs.some(function (t) { return t[0] === ctab; })) ctab = 'ov';
        return banner(c) + '<div class="cl-tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" class="cl-tab' + (ctab === t[0] ? ' on' : '') + '" role="tab" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="cl-pn" class="cl-pn" data-dp-skip="1"></div>';
    }
    function panel() {
        var c = S.mine, pn = $('cl-pn'); if (!pn || !c) return;
        var soft = window.DomPatch && root.classList.contains('cl-still') && pn.__tab === ctab && ctab !== 'chat' && ctab !== 'set', h = ({ ov: pOv, mem: pMem, req: pReq, top: function () { return renderTop(); }, chat: pChat, set: pSet })[ctab](c);
        pn.__tab = ctab; if (pn.className !== 'cl-pn') pn.className = 'cl-pn'; if (soft) DomPatch.html(pn, h); else pn.innerHTML = h;
        if (ctab === 'chat') { var m = $('cl-msgs'); if (m) m.scrollTop = m.scrollHeight; }
        if (ctab === 'set') initSettings(c);
    }
    function pOv(c) {
        var goal = 30, p = Math.min(100, Math.round(c.myToday / goal * 100));
        var day = '<div class="cl-box"><h3>ЩОДЕННИЙ ВНЕСОК</h3><div class="cl-day"><div class="cl-ring" style="--p:' + p + '"><b>' + c.myToday + '</b></div><p>Ваш внесок сьогодні: <strong>' + c.myToday + '</strong> оч. З ними клан уже зібрав <strong>' + c.todayPts + '</strong> оч. за день.<br>' +
            (c.myToday >= goal ? 'Денну ціль виконано — так тримати!' : 'Зіграйте матч або знищте кількох ворогів, щоб підняти клан у рейтингу. Новий день — за київським часом.') + '</p></div></div>';
        var how = '<div class="cl-box"><h3>ЯК ЗАРОБЛЯТИ ОЧКИ</h3><div class="cl-how"><div><b>+1</b>за кожне вбивство</div><div><b>+2</b>за участь у матчі</div><div><b>+10</b>за перемогу в матчі</div><div><b>+20</b>за перемогу в Battle Royale</div></div></div>';
        var prize = '<div class="cl-box"><h3>НАГОРОДИ СЕЗОНУ</h3><div class="cl-how"><div><b>🥇 ' + cr(150, 14) + '</b>1 місце · кожному</div><div><b>🥈 ' + cr(100, 14) + '</b>2 місце · кожному</div><div><b>🥉 ' + cr(60, 14) + '</b>3 місце · кожному</div><div><b>' + left(c.seasonEnd) + '</b>до скидання очок</div></div>' +
            (c.lastSeason && c.lastSeason.place ? '<p class="cl-note" style="margin-top:10px">Минулий сезон (' + esc(c.lastSeason.season) + '): ' + c.lastSeason.place + ' місце · ' + fmt(c.lastSeason.points) + ' оч.</p>' : '') + '</div>';
        var log = '<div class="cl-box"><h3>ОСТАННІ ПОДІЇ</h3>' + (c.log.length ? '<ul class="cl-log">' + c.log.slice(0, 12).map(function (e) { return '<li><span>' + esc(e.text) + '</span><time>' + ago(e.t) + '</time></li>'; }).join('') + '</ul>' : '<p class="cl-note">Подій поки немає</p>') + '</div>';
        var info = '<div class="cl-box"><h3>ПРО КЛАН</h3><p class="cl-desc" style="font-size:13px;margin-bottom:10px">' + (esc(c.desc) || 'Опису немає') + '</p><div class="cl-chips"><span class="cl-chip">' + JOIN_ICO[c.join] + ' ' + JOIN_NAME[c.join] + '</span><span class="cl-chip">від ' + c.minLevel + ' рівня</span><span class="cl-chip">Лідер: ' + esc(c.leader) + '</span></div></div>';
        var leave = '<div style="text-align:center;margin:6px 0 4px"><button type="button" class="cl-btn ghost sm" data-a="leave">🚪 ' + (c.myRole === 'leader' ? 'Вийти з клану' : 'Покинути клан') + '</button></div>';
        return '<div class="cl-cols"><div>' + day + how + prize + '</div><div>' + info + log + '</div></div>' + leave;
    }
    function pMem(c) {
        var role = c.myRole;
        return '<p class="cl-note">Учасників: ' + c.count + ' з ' + MAXM + ' · підсвічені ті, хто вже вніс очки сьогодні</p>' + c.members.map(function (m, i) {
            var me = m.login === (typeof myName !== 'undefined' ? myName : ''), acts = '';
            if (!me && m.role !== 'leader') {
                if (role === 'leader') {
                    if (m.role === 'member') acts += '<button type="button" class="cl-ia" title="Призначити офіцером" data-a="promote" data-l="' + esc(m.login) + '">⬆</button>';
                    if (m.role === 'officer') acts += '<button type="button" class="cl-ia" title="Знизити до учасника" data-a="demote" data-l="' + esc(m.login) + '">⬇</button>';
                    acts += '<button type="button" class="cl-ia" title="Передати лідерство" data-a="transfer" data-l="' + esc(m.login) + '" data-n="' + esc(dn(m)) + '">👑</button><button type="button" class="cl-ia bad" title="Вигнати" data-a="kick" data-l="' + esc(m.login) + '" data-n="' + esc(dn(m)) + '">✕</button>';
                } else if (role === 'officer' && m.role === 'member') acts = '<button type="button" class="cl-ia bad" title="Вигнати" data-a="kick" data-l="' + esc(m.login) + '" data-n="' + esc(dn(m)) + '">✕</button>';
            }
            return '<div data-key="' + esc(m.login) + '" class="cl-row cl-mem' + (m.today > 0 ? ' hot' : '') + (me ? ' me' : '') + '" style="animation-delay:' + Math.min(i, 12) * 28 + 'ms">' + avatar(m.login, m.nick, m.online) +
                '<div class="cl-info"><b>' + esc(dn(m)) + '<span class="cl-role ' + m.role + '">' + ROLE_ICO[m.role] + ' ' + ROLE_NAME[m.role] + '</span>' + (m.today > 0 ? '<span class="cl-td">+' + m.today + ' сьогодні</span>' : '') + '</b><small>' + (m.online ? '🟢 онлайн' : 'офлайн') + ' · у клані ' + ago(m.joinedAt).replace(' тому', '') + '</small></div>' +
                '<div class="cl-lv">' + lvIcon(m.level, 32) + '</div><div class="cl-pts">' + fmt(m.points) + '<small>ЗА СЕЗОН</small></div>' + (acts ? '<div class="cl-acts">' + acts + '</div>' : '') + '</div>';
        }).join('');
    }
    function pReq(c) {
        if (!c.requests.length) return '<div class="cl-empty"><i>📭</i>Нових заявок немає' + (c.join === 'request' ? '' : '<br><span style="font-size:12px">Тип вступу зараз — «' + JOIN_NAME[c.join] + '»</span>') + '</div>';
        return c.requests.map(function (r, i) {
            return '<div data-key="' + esc(r.login) + '" class="cl-row" style="animation-delay:' + i * 30 + 'ms">' + avatar(r.login, r.nick) + '<div class="cl-info"><b>' + esc(dn(r)) + '</b><small>Хоче приєднатися</small></div><div class="cl-lv">' + lvIcon(r.level, 32) + '</div>' +
                '<div class="cl-acts"><button type="button" class="cl-btn green sm" data-a="accept" data-l="' + esc(r.login) + '">Прийняти</button><button type="button" class="cl-btn red sm" data-a="reject" data-l="' + esc(r.login) + '">Відхилити</button></div></div>';
        }).join('');
    }
    function msgHtml(m) {
        var me = m.login === (typeof myName !== 'undefined' ? myName : '');
        return '<div class="cl-msg' + (me ? ' me' : '') + '"><b>' + esc(dn(m)) + '<time>' + hhmm(m.t) + '</time></b>' + esc(m.text) + '</div>';
    }
    function pChat(c) {
        return '<div class="cl-box cl-chat"><div class="cl-msgs" id="cl-msgs">' + (c.chat.length ? c.chat.map(msgHtml).join('') : '<div class="cl-empty" style="margin:auto"><i>💬</i>Тут поки тихо.<br>Напишіть першим!</div>') + '</div>' +
            '<div class="cl-send"><input id="cl-chat-in" type="text" maxlength="200" placeholder="Повідомлення (до 200 символів)" autocomplete="off"><button type="button" class="cl-btn" data-a="send">Надіслати</button></div></div>';
    }
    function sendChat() {
        var i = $('cl-chat-in'); if (!i) return; var t = i.value.trim(); if (!t) return;
        if (emit('clanChat', { text: t })) i.value = '';
    }

    // ---------- Налаштування лідера / редактор емблеми ----------
    var SE = null;   // стан редактора налаштувань
    function pSet(c) {
        SE = { icon: c.emblem.icon, color1: c.emblem.color1, color2: c.emblem.color2, join: c.join, minLevel: c.minLevel };
        return '<div class="cl-cols"><div class="cl-box cl-f">' + emblemEditor('s') + '</div><div><div class="cl-box cl-f"><div class="cl-f"><label for="cl-s-desc">ОПИС <span id="cl-s-dc">' + c.desc.length + '/120</span></label><textarea id="cl-s-desc" maxlength="120">' + esc(c.desc) + '</textarea></div>' +
            '<div class="cl-f"><div class="cl-lb">ТИП ВСТУПУ</div>' + joinSeg('s', SE.join) + '</div><div class="cl-f"><label for="cl-s-min">МІНІМАЛЬНИЙ РІВЕНЬ ГРАВЦЯ</label>' + lvSelect('cl-s-min', SE.minLevel) + '</div>' +
            '<button type="button" class="cl-btn gold" data-a="save">💾 Зберегти зміни</button></div>' +
            '<div class="cl-box"><h3>НЕБЕЗПЕЧНА ЗОНА</h3><p class="cl-note">Назву й тег змінити не можна. Розпуск клану незворотний: очки й склад зникнуть, плата за створення не повертається.</p><button type="button" class="cl-btn red sm" data-a="disband">🗑 Розпустити клан</button></div></div></div>';
    }
    function initSettings() { liveEmb('s'); }
    function joinSeg(p, cur) {
        return '<div class="cl-seg" data-seg="' + p + '">' + ['open', 'request', 'closed'].map(function (k) { return '<button type="button" data-a="join-' + p + '" data-v="' + k + '" class="' + (cur === k ? 'on' : '') + '"><i>' + JOIN_ICO[k] + '</i>' + JOIN_NAME[k] + '</button>'; }).join('') + '</div>';
    }
    function lvSelect(id, cur) { var o = ''; for (var i = 1; i <= 15; i++) o += '<option value="' + i + '"' + (i === cur ? ' selected' : '') + '>' + (i === 1 ? '1 (усі гравці)' : 'від ' + i + ' рівня') + '</option>'; return '<select id="' + id + '">' + o + '</select>'; }
    function emblemEditor(p) {
        var o = p === 'w' ? W : SE;
        return '<div class="cl-f"><div class="cl-lb">ЕМБЛЕМА</div><div class="cl-eg" data-eg="' + p + '">' + ICONS.map(function (k) { return '<button type="button" class="cl-ep' + (o.icon === k ? ' on' : '') + '" data-a="icon-' + p + '" data-v="' + k + '" title="' + ICON_NAMES[k] + '" aria-label="' + ICON_NAMES[k] + '">' + emblem(k, o.color1, o.color2, 40) + '</button>'; }).join('') + '</div></div>' +
            '<div class="cl-f"><div class="cl-lb">ОСНОВНИЙ КОЛІР</div>' + swatches(p, 'color1', o.color1) + '</div><div class="cl-f"><div class="cl-lb">ДОДАТКОВИЙ КОЛІР</div>' + swatches(p, 'color2', o.color2) + '</div>';
    }
    function swatches(p, key, cur) {
        return '<div class="cl-sw" data-sw="' + p + key + '">' + SWATCH.map(function (c) { return '<button type="button" style="background:' + c + ';color:' + c + '" class="' + (c === cur ? 'on' : '') + '" data-a="col-' + p + '" data-k="' + key + '" data-v="' + c + '" aria-label="' + c + '"></button>'; }).join('') +
            '<input type="color" value="' + cur + '" data-a="colin-' + p + '" data-k="' + key + '" aria-label="Свій колір"></div>';
    }
    // оновлення прев’ю/сітки емблем без повного перемальовування (щоб не збивати введення)
    function liveEmb(p) {
        var o = p === 'w' ? W : SE; if (!o) return;
        var g = root.querySelector('[data-eg="' + p + '"]');
        if (g) Array.prototype.forEach.call(g.children, function (b) { var v = b.getAttribute('data-v'); b.classList.toggle('on', v === o.icon); b.innerHTML = emblem(v, o.color1, o.color2, 40); });
        ['color1', 'color2'].forEach(function (k) {
            var s = root.querySelector('[data-sw="' + p + k + '"]'); if (!s) return;
            Array.prototype.forEach.call(s.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === o[k]); });
            var ci = s.querySelector('input'); if (ci && ci.value !== o[k]) ci.value = o[k];
        });
        if (p === 'w') drawPreview();
    }

    // ---------- Майстер створення ----------
    function openWiz() {
        var b = bucks();
        if (b < S.cost) { sfx('ui_error'); toast('Бракує ' + (S.cost - b) + ' кредитів', 'bad'); if (window.uiDialog && uiDialog.money) uiDialog.money({ price: S.cost, have: b, text: 'Для створення клану потрібно ' + S.cost + ' кредитів. Заробляйте креди в боях, адвенті, продавайте зайві модулі або активуйте промокод.' }); else openWallet(); return; }
        W = { name: '', tag: '', desc: '', join: 'open', minLevel: 1, icon: 'tank', color1: '#f59e0b', color2: '#b45309', err: {} };
        var w = $('cl-wiz');
        w.innerHTML = '<div class="cl-wbox"><header class="cl-top"><h1>СТВОРЕННЯ КЛАНУ<small>ОБЕРІТЬ НАЗВУ, ЕМБЛЕМУ Й ПРАВИЛА ВСТУПУ</small></h1><button type="button" class="cl-x" data-a="wizx" aria-label="Закрити">✕</button></header>' +
            '<div class="cl-wgrid"><div>' +
            '<div class="cl-f" id="cl-fn"><label for="cl-w-name">НАЗВА КЛАНУ <span id="cl-w-nc">0/16</span></label><input id="cl-w-name" maxlength="16" autocomplete="off" placeholder="Наприклад: Залізні Вовки"><div class="cl-hint" id="cl-w-nh">3–16 символів: літери, цифри, пробіл, дефіс</div></div>' +
            '<div class="cl-f" id="cl-ft"><label for="cl-w-tag">ТЕГ <span>2–4 символи</span></label><input id="cl-w-tag" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="WLF" style="text-transform:uppercase;letter-spacing:.2em"><div class="cl-hint" id="cl-w-th">Лише латиниця й цифри, унікальний</div></div>' +
            emblemEditor('w') +
            '<div class="cl-f"><label for="cl-w-desc">ОПИС <span id="cl-w-dc">0/120</span></label><textarea id="cl-w-desc" maxlength="120" placeholder="Коротко про ваш клан"></textarea></div>' +
            '<div class="cl-f"><div class="cl-lb">ТИП ВСТУПУ</div>' + joinSeg('w', 'open') + '</div><div class="cl-f"><label for="cl-w-min">МІНІМАЛЬНИЙ РІВЕНЬ ГРАВЦЯ</label>' + lvSelect('cl-w-min', 1) + '</div>' +
            '</div><div class="cl-prev" id="cl-w-prev"></div></div>' +
            '<footer class="cl-wft"><div class="cl-money"><span>ВАРТІСТЬ СТВОРЕННЯ</span><b>' + cr(S.cost, 18) + '</b><span id="cl-w-bal"></span></div><button type="button" class="cl-cta" id="cl-w-go" data-a="create">🛡️ Створити клан <b>' + cr(S.cost, 16) + '</b></button></footer></div>';
        w.classList.add('on'); drawPreview(); wizBal();
        setTimeout(function () { var n = $('cl-w-name'); if (n) n.focus({ preventScroll: true }); }, 60);
    }
    function wizBal() {
        var t = $('cl-w-bal'), g = $('cl-w-go'); if (!t || !g) return; var b = bucks(), poor = b < S.cost;
        t.innerHTML = 'Ваш баланс: ' + cr(fmt(b), 13) + (poor ? ' · <span style="color:#fca5a5">бракує ' + (S.cost - b) + '</span>' : '');
        g.classList.toggle('poor', poor); g.setAttribute('aria-disabled', poor ? 'true' : 'false');
        g.classList.toggle('busy', busy);
    }
    function drawPreview() {
        var p = $('cl-w-prev'); if (!p || !W) return;
        p.innerHTML = '<section class="cl-banner" style="--e1:' + W.color1 + ';--e2:' + W.color2 + '"><div class="cl-b-emb">' + emblem(W.icon, W.color1, W.color2, 140, 'bob') + '</div><div class="cl-b-in"><h2>' + (esc(W.name.trim()) || '<span style="opacity:.4">Назва клану</span>') + '</h2><span class="cl-tag">[' + (esc(W.tag) || 'TAG') + ']</span>' +
            '<div class="cl-chips" style="margin-top:12px"><span class="cl-chip">Рівень 1 · Новобранці</span><span class="cl-chip">👥 1/' + MAXM + '</span><span class="cl-chip">' + JOIN_ICO[W.join] + ' ' + JOIN_NAME[W.join] + '</span>' + (W.minLevel > 1 ? '<span class="cl-chip">від ' + W.minLevel + ' рів.</span>' : '') + '</div>' +
            '<p class="cl-desc" style="margin-top:10px;text-align:center">' + (esc(W.desc) || '') + '</p></div></section>' +
            '<div class="cl-card" style="--e1:' + W.color1 + ';--e2:' + W.color2 + ';animation:none;cursor:default"><div class="cl-c-hd">' + emblem(W.icon, W.color1, W.color2, 54, 'pulse') + '<div class="cl-c-nm"><b>' + (esc(W.name.trim()) || 'Назва клану') + '</b><span class="cl-tag">[' + (esc(W.tag) || 'TAG') + ']</span></div></div><p class="cl-note" style="margin:0;position:relative;z-index:1">Так клан виглядатиме у списку</p></div>';
    }
    function closeWiz(quiet) { var w = $('cl-wiz'); if (w) { w.classList.remove('on'); w.innerHTML = ''; } W = null; if (!quiet) snd('ui_click'); }
    function wizErr(field, msg) {
        var f = field === 'tag' ? 'cl-ft' : 'cl-fn', h = field === 'tag' ? 'cl-w-th' : 'cl-w-nh';
        var fe = $(f), he = $(h); if (!fe || !he) return; fe.classList.toggle('bad', !!msg); if (msg) he.textContent = msg;
    }
    function submitWiz() {
        if (!W || busy) return;
        var b = bucks();
        var name = W.name.replace(/\s+/g, ' ').trim(), tag = W.tag;
        if (name.length < 3) { wizErr('name', 'Назва — від 3 до 16 символів'); $('cl-w-name').focus(); sfx('ui_error'); return; }
        if (!/[A-Za-z0-9Ѐ-ӿ]/.test(name)) { wizErr('name', 'У назві мають бути літери або цифри'); sfx('ui_error'); return; }
        if (tag.length < 2) { wizErr('tag', 'Тег — від 2 до 4 символів'); $('cl-w-tag').focus(); sfx('ui_error'); return; }
        if (b < S.cost) { sfx('ui_error'); toast('Бракує ' + (S.cost - b) + ' кредитів', 'bad'); if (window.uiDialog && uiDialog.money) uiDialog.money({ price: S.cost, have: b }); else openWallet(); return; }
        if (!window.uiDialog || !uiDialog.confirm) { doCreate(); return; }
        uiDialog.confirm({ kind: 'warn', icon: '🛡️', title: 'Створити клан «' + name + '»?', text: 'З вашого балансу буде списано ' + S.cost + ' кредитів. Повернення не передбачено.', rows: [['Тег', '[' + tag + ']'], ['Вартість', cr(S.cost, 16), '', 1], ['Баланс після', cr(b - S.cost, 16), '', 1]], okText: 'Створити', cancelText: 'Скасувати' }).then(function (ok) { if (ok) doCreate(); });
    }
    function doCreate() {
        if (!W) return; setBusy(true); wizBal();
        emit('clanCreate', { name: W.name, tag: W.tag, desc: W.desc, join: W.join, minLevel: W.minLevel, emblem: { icon: W.icon, color1: W.color1, color2: W.color2 } }) || setBusy(false);
    }

    // ---------- Перегляд чужого клану ----------
    function closePeek() { var p = $('cl-peek'); if (p) p.remove(); S.peek = null; }
    function showPeek(c) {
        closePeek(); S.peek = c;
        var d = document.createElement('div'); d.id = 'cl-peek'; d.className = 'cl-wiz on'; d.style.zIndex = 6;
        d.innerHTML = '<div class="cl-wbox" style="max-width:640px"><header class="cl-top"><h1>КЛАН<small>ПЕРЕГЛЯД</small></h1><button type="button" class="cl-x" data-a="peekx" aria-label="Закрити">✕</button></header><div class="cl-main">' +
            '<section class="cl-banner" style="' + eb(c) + ';flex-direction:column;text-align:center"><div class="cl-b-emb">' + emblem(c.emblem.icon, c.emblem.color1, c.emblem.color2, 120, 'bob') + '</div><div class="cl-b-in"><h2>' + esc(c.name) + '</h2><span class="cl-tag">[' + esc(c.tag) + ']</span>' +
            '<div class="cl-chips" style="justify-content:center;margin-top:12px"><span class="cl-chip gold">⭐ ' + fmt(c.points) + '</span><span class="cl-chip">№' + c.rank + '</span><span class="cl-chip">Рів. ' + c.level + ' · ' + esc(c.levelName) + '</span><span class="cl-chip">👥 ' + c.members + '/' + MAXM + '</span><span class="cl-chip">' + JOIN_ICO[c.join] + ' ' + JOIN_NAME[c.join] + '</span></div>' +
            '<p class="cl-desc" style="margin-top:10px;font-size:13px">' + esc(c.desc) + '</p></div></section>' + (S.mine ? '' : '<div style="margin-bottom:14px;display:flex;justify-content:center">' + joinBtn(c).replace('class="cl-btn', 'style="min-width:220px" class="cl-btn') + '</div>') +
            '<div class="cl-box"><h3>УЧАСНИКИ</h3>' + (c.membersList || []).map(function (m) { return '<div class="cl-row" style="margin-bottom:5px">' + avatar(m.nick, m.nick) + '<div class="cl-info"><b>' + esc(m.nick) + '<span class="cl-role ' + m.role + '">' + ROLE_ICO[m.role] + ' ' + ROLE_NAME[m.role] + '</span></b></div><div class="cl-lv">' + lvIcon(m.level, 28) + '</div><div class="cl-pts">' + fmt(m.points) + '</div></div>'; }).join('') + '</div></div></div>';
        root.appendChild(d);
    }

    // ---------- Рендер ----------
    function render() {
        if (!root) return; var m = $('cl-main'); if (!m) return;
        var sc = m.scrollTop;
        if (!S.got) { m.innerHTML = '<div class="cl-empty"><i>⏳</i>Завантаження…</div>'; return; }
        if (S.mine) { put(m, renderClan()); panel(); }
        else { put(m, renderHome()); if (hometab === 'top') put($('cl-top-body'), renderTop()); else renderGrid(); }
        m.scrollTop = sc; refreshBal();
    }
    // м’яке оновлення шапки клану без скидання введення (чат/налаштування)
    function softUpdate() {
        var m = $('cl-main'); if (!m || !S.mine) return; still(true);
        var b = m.querySelector('.cl-banner'); if (b) { if (window.DomPatch) DomPatch.el(b, banner(S.mine)); else { var t = document.createElement('div'); t.innerHTML = banner(S.mine); b.replaceWith(t.firstChild); } }
        var rq = m.querySelector('[data-tab="req"]'); if (rq) { var n = S.mine.reqCount; put(rq, '✉ Заявки' + (n ? ' <b>' + n + '</b>' : '')); }
    }

    // ---------- Дії ----------
    function ask(o, fn) {
        if (!window.uiDialog || !uiDialog.confirm) { fn(); return; }
        uiDialog.confirm(Object.assign({ kind: 'danger', danger: true }, o)).then(function (ok) { if (ok) fn(); });
    }
    function onClick(e) {
        var t = e.target.closest && e.target.closest('[data-a],[data-tab],#cl-x,#cl-bal'); if (!t || !root.contains(t)) return;
        if (t.id === 'cl-x') return close();
        if (t.id === 'cl-bal') return openWallet();
        var tab = t.getAttribute('data-tab'); if (tab) { snd('ui_click'); still(false); if (S.mine) { ctab = tab; render(); if (tab === 'top') emit('clanList', { q: '' }); if (tab === 'req' || tab === 'mem') emit('clanGet'); } else { hometab = tab; render(); if (tab === 'top') emit('clanList', { q: '' }); } return; }
        var a = t.getAttribute('data-a'), id = t.getAttribute('data-id'), l = t.getAttribute('data-l'), n = t.getAttribute('data-n');
        if (t.disabled) return;
        if (a === 'peek') { if (e.target.closest('button[data-a]:not([data-a="peek"])')) return; emit('clanPeek', { id: id }); return; }
        switch (a) {
            case 'wiz': openWiz(); break;
            case 'wizx': closeWiz(); break;
            case 'peekx': closePeek(); break;
            case 'create': submitWiz(); break;
            case 'join': if (!busy) { setBusy(true); emit('clanJoin', { id: id }) || setBusy(false); } break;
            case 'cancelreq': emit('clanCancelRequest', { id: id }); break;
            case 'leave': ask({ title: 'Покинути клан?', text: 'Ваші очки сезону залишаться в клані. Повернутися можна лише за правилами вступу.', okText: 'Покинути', icon: '🚪' }, function () { emit('clanLeave'); }); break;
            case 'accept': emit('clanAccept', { login: l }); break;
            case 'reject': emit('clanReject', { login: l }); break;
            case 'promote': emit('clanPromote', { login: l }); break;
            case 'demote': emit('clanDemote', { login: l }); break;
            case 'kick': ask({ title: 'Вигнати ' + n + '?', text: 'Гравець одразу покине клан.', okText: 'Вигнати', icon: '👢' }, function () { emit('clanKick', { login: l }); }); break;
            case 'transfer': ask({ title: 'Передати лідерство?', text: 'Гравець ' + n + ' стане лідером клану, а ви — офіцером. Скасувати це зможе лише новий лідер.', okText: 'Передати', icon: '👑', kind: 'warn', danger: false }, function () { emit('clanTransfer', { login: l }); }); break;
            case 'disband': ask({ title: 'Розпустити клан?', text: 'Усі учасники буде виключено, очки й чат зникнуть. 249 кредитів не повертаються.', okText: 'Розпустити назавжди', icon: '🗑' }, function () { emit('clanDisband'); }); break;
            case 'save': {
                var d = $('cl-s-desc'), mn = $('cl-s-min');
                emit('clanSettings', { desc: d ? d.value : '', join: SE.join, minLevel: mn ? +mn.value : 1, emblem: { icon: SE.icon, color1: SE.color1, color2: SE.color2 } }); break;
            }
            case 'send': sendChat(); break;
            default: {
                var m = /^(icon|col|join)-([ws])$/.exec(a || ''); if (!m) break;
                var o = m[2] === 'w' ? W : SE; if (!o) break; var v = t.getAttribute('data-v');
                if (m[1] === 'icon') o.icon = v; else if (m[1] === 'col') o[t.getAttribute('data-k')] = v;
                else { o.join = v; Array.prototype.forEach.call(t.parentNode.children, function (b) { b.classList.toggle('on', b === t); }); }
                snd('ui_click'); liveEmb(m[2]); if (m[2] === 'w') drawPreview();
            }
        }
    }
    function onInput(e) {
        var t = e.target, id = t.id;
        if (id === 'cl-q') { S.q = t.value; clearTimeout(searchT); searchT = setTimeout(function () { emit('clanList', { q: S.q.trim() }); }, 320); return; }
        if (t.getAttribute('data-a') && /^colin-/.test(t.getAttribute('data-a'))) { var p = t.getAttribute('data-a').slice(-1), o = p === 'w' ? W : SE; if (o) { o[t.getAttribute('data-k')] = t.value.toLowerCase(); liveEmb(p); } return; }
        if (!W) { if (id === 'cl-s-desc') { var c = $('cl-s-dc'); if (c) c.textContent = t.value.length + '/120'; } return; }
        if (id === 'cl-w-name') { W.name = t.value.replace(/[^\p{L}\p{N} _.\-]/gu, ''); if (W.name !== t.value) t.value = W.name; $('cl-w-nc').textContent = W.name.length + '/16'; wizErr('name', ''); var h = $('cl-w-nh'); h.textContent = '3–16 символів: літери, цифри, пробіл, дефіс'; drawPreview(); }
        else if (id === 'cl-w-tag') { W.tag = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); if (t.value !== W.tag) t.value = W.tag; wizErr('tag', ''); $('cl-w-th').textContent = 'Лише латиниця й цифри, унікальний'; drawPreview(); }
        else if (id === 'cl-w-desc') { W.desc = t.value.slice(0, 120); $('cl-w-dc').textContent = W.desc.length + '/120'; drawPreview(); }
        else if (id === 'cl-w-min') { W.minLevel = +t.value || 1; drawPreview(); }
    }
    document.addEventListener('change', function (e) { if (e.target && e.target.id === 'cl-w-min' && W) { W.minLevel = +e.target.value || 1; drawPreview(); } });

    // ---------- Відповіді сервера ----------
    function updBadge() { if (window.MenuHub) MenuHub.badge('mm-clans', S.mine && S.mine.reqCount && S.mine.myRole !== 'member' ? S.mine.reqCount : 0); }
    function bindSocket() {
        if (typeof socket === 'undefined' || !socket || bindSocket.done) return; bindSocket.done = true;
        socket.on('clanState', function (d) {
            if (!d) return; var sg = JSON.stringify([d.mine, d.cost]); if (S.got && sg === sigState) { if (!isOpen) updBadge(); return; } sigState = sg;
            var prev = S.mine; S.got = true; S.mine = d.mine; S.cost = d.cost || COST;
            if (typeof d.bucks === 'number') { try { if (typeof myBucks !== 'undefined' && d.bucks !== myBucks) { /* баланс веде economyUpdate */ } } catch (e) {} }
            updBadge(); if (!isOpen) return;
            if (S.mine && prev && prev.id === S.mine.id && (ctab === 'chat' || ctab === 'set') && !$('cl-wiz').classList.contains('on')) { softUpdate(); if (S.mine.chat.length !== prev.chat.length && ctab === 'chat') { var m = $('cl-msgs'); } return; }
            if (S.mine && !prev) ctab = 'ov';
            if (W && S.mine) closeWiz(true);
            still(true); render(); if (W) wizBal();
        });
        socket.on('clanList', function (d) { if (!d) return; var sg = JSON.stringify(d); if (S.list && sg === sigList) return; sigList = sg; S.list = d; if (!isOpen) return; still(true); if (S.mine) { if (ctab === 'top') panel(); } else if (hometab === 'top') { put($('cl-top-body'), renderTop()); } else renderGrid(); });
        socket.on('clanPeek', function (d) { if (d && d.clan && isOpen) showPeek(d.clan); });
        socket.on('clanChatMsg', function (m) {
            if (!m || !S.mine) return; S.mine.chat.push(m); if (S.mine.chat.length > 50) S.mine.chat.shift();
            if (isOpen && ctab === 'chat') { var box = $('cl-msgs'); if (box) { var empty = box.querySelector('.cl-empty'); if (empty) empty.remove(); var near = box.scrollHeight - box.scrollTop - box.clientHeight < 80; box.insertAdjacentHTML('beforeend', msgHtml(m)); if (near || m.login === myName) box.scrollTop = box.scrollHeight; } }
        });
        socket.on('clanNotify', function (d) {
            if (!d || !d.text) return;
            var k = d.kind === 'season' ? 'gold' : d.kind === 'kick' ? 'bad' : 'good';
            toast(d.text, k); sfx(d.kind === 'season' ? 'ui_buy' : d.kind === 'request' ? 'ui_friend' : 'ui_notify');
            if (d.kind === 'season') confetti();
            if (isOpen && !S.mine) emit('clanGet');
        });
        socket.on('clanResult', function (r) {
            if (!r) return; var wasBusy = busy; setBusy(false);
            if (r.act === 'clanPeek' || r.act === 'chat' && r.ok) return;
            if (!r.ok) {
                sfx('ui_error'); toast(r.msg || 'Не вдалося виконати дію', 'bad');
                if (r.act === 'create') { if (r.field) wizErr(r.field, r.msg); wizBal(); if (r.need) { try { myBucks = Math.max(0, S.cost - r.need); } catch (e) {} refreshBal(); wizBal(); } }
                if (r.act === 'join' || r.act === 'accept' || r.act === 'kick') { emit('clanList', { q: S.q }); if (S.mine) emit('clanGet'); }
                if (wasBusy) render(); return;
            }
            if (r.act === 'create') { sfx('ui_buy'); toast(r.msg, 'gold'); confetti(); closeWiz(true); ctab = 'ov'; }
            else { sfx(r.act === 'join' && /приєдналися/.test(r.msg || '') ? 'ui_confirm' : 'ui_notify'); toast(r.msg || 'Готово', 'good'); }
            if (r.act === 'join' || r.act === 'cancel') { closePeek(); emit('clanList', { q: S.q }); }
            if (r.act === 'leave' || r.act === 'disband') { hometab = 'browse'; emit('clanList', { q: '' }); }
            if (!S.mine || r.act === 'leave' || r.act === 'disband') emit('clanGet');
        });
    }

    // ---------- Точка входу ----------
    function init() {
        bindSocket();
        if (window.MenuHub) MenuHub.addCard({ id: 'mm-clans', icon: '🛡️', title: 'КЛАНИ', sub: 'Команди та рейтинг', color: 'amber', bg: '🛡️', onClick: function () { open(); } });
        if (typeof socket !== 'undefined' && socket && socket.on) {
            socket.on('authSuccess', function () { setTimeout(function () { emit('clanGet'); }, 900); });
            if (socket.connected) setTimeout(function () { if (typeof myName !== 'undefined' && myName) emit('clanGet'); }, 1500);
        }
    }
    window.Clans = { open: open, close: close, emblem: emblem, state: function () { return S; }, ICONS: ICONS };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
