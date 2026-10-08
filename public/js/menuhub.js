/* menuhub.js — спільні точки входу в головне меню для нових розділів (завдання, друзі, клани, рейтинг…).
 *   MenuHub.addCard({ id, icon, title, sub, color:'blue|purple|green|rose|amber|cyan|pink|lime', onClick, bg })  → картка в сітці меню
 *   MenuHub.addTop({ id, icon, title, onClick })                                                              → кругла кнопка біля рівня (угорі праворуч)
 *   MenuHub.badge(id, n)   — число/крапка на картці або кнопці (0 = сховати)
 *   MenuHub.ready(fn)      — виконати, коли меню вже є в DOM */
(function () {
    'use strict';
    var css = '.mm-card.c-amber{--c:245,158,11}.mm-card.c-cyan{--c:34,211,238}.mm-card.c-pink{--c:236,72,153}.mm-card.c-lime{--c:132,204,22}.mm-card.c-indigo{--c:99,102,241}.mm-card.c-teal{--c:20,184,166}' +
        '.mm-grid-nav{overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;align-content:start}.mm-grid-nav.many{grid-auto-rows:minmax(104px,1fr)}' +
        '@media (orientation:landscape) and (min-width:560px){.mm-grid-nav.many{grid-template-columns:repeat(4,1fr)}}' +
        '.mh-badge{position:absolute;top:8px;right:10px;z-index:3;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#ef4444;color:#fff;font:800 11px/20px "Russo One",Arial,sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(15,23,42,.9),0 0 14px rgba(239,68,68,.7);animation:mhPulse 1.8s ease-in-out infinite}' +
        '.mh-badge.dot{min-width:12px;width:12px;height:12px;padding:0;top:10px;right:12px}.mh-top{position:relative}.mh-top .mh-badge{top:-4px;right:-4px;min-width:18px;height:18px;line-height:18px;font-size:10px}' +
        '@keyframes mhPulse{50%{transform:scale(1.14)}}' +
        '.mm-grid-nav.many{gap:8px}.mm-grid-nav.many .mm-card{padding:8px 6px;gap:2px}.mm-grid-nav.many .mm-card-ico{font-size:clamp(26px,5.6vh,40px)}.mm-grid-nav.many .mm-card h2{font-size:clamp(13px,2.4vh,18px)}.mm-grid-nav.many .mm-card p{font-size:clamp(9px,1.6vh,12px)}' +
        '@media (orientation:landscape) and (max-height:520px){.mm-grid-nav.many .mm-card p{display:none}}';
    var st = document.createElement('style'); st.id = 'menuhub-css'; st.textContent = css; document.head.appendChild(st);
    var pend = [];
    function ready(fn) { if (document.getElementById('main-menu-screen')) fn(); else pend.push(fn); }
    document.addEventListener('DOMContentLoaded', function () { pend.splice(0).forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); });
    function nav() { return document.querySelector('#main-menu-screen .mm-grid-nav'); }
    function addCard(o) {
        ready(function () {
            var n = nav(); if (!n || document.getElementById(o.id)) return;
            var b = document.createElement('button'); b.type = 'button'; b.id = o.id; b.className = 'mm-card c-' + (o.color || 'blue');
            b.innerHTML = '<div class="mm-card-ico">' + (o.icon || '⭐') + '</div><h2>' + (o.title || '') + '</h2><p>' + (o.sub || '') + '</p><span class="mm-card-bg">' + (o.bg || o.icon || '') + '</span>';
            b.addEventListener('click', function () { try { if (typeof playSound === 'function') playSound('ui_click'); } catch (e) {} o.onClick && o.onClick(); });
            n.appendChild(b); if (n.children.length > 4) n.classList.add('many');
        });
    }
    function addTop(o) {
        ready(function () {
            var r = document.querySelector('#main-menu-screen .mm-top-r'); if (!r || document.getElementById(o.id)) return;
            var b = document.createElement('button'); b.type = 'button'; b.id = o.id; b.className = 'mm-round mh-top'; b.title = o.title || ''; b.setAttribute('aria-label', o.title || ''); b.innerHTML = o.icon || '⭐';
            b.addEventListener('click', function () { try { if (typeof playSound === 'function') playSound('ui_click'); } catch (e) {} o.onClick && o.onClick(); });
            var lv = document.getElementById('menu-lv'); if (lv && lv.nextSibling) r.insertBefore(b, lv.nextSibling); else r.appendChild(b);
        });
    }
    function badge(id, n) {
        var el = document.getElementById(id); if (!el) return; var bd = el.querySelector(':scope > .mh-badge');
        if (!n) { if (bd) bd.remove(); return; } if (!bd) { bd = document.createElement('span'); bd.className = 'mh-badge'; el.appendChild(bd); }
        if (n === true) { bd.classList.add('dot'); bd.textContent = ''; } else { bd.classList.remove('dot'); bd.textContent = n > 99 ? '99+' : n; }
    }
    window.MenuHub = { addCard: addCard, addTop: addTop, badge: badge, ready: ready };
})();
