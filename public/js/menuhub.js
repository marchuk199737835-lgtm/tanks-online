/* menuhub.js — спільні точки входу в головне меню для нових розділів (завдання, друзі, клани, рейтинг…).
 *   MenuHub.addCard({ id, icon, title, sub, color:'blue|purple|green|rose|amber|cyan|pink|lime', onClick, bg })  → картка в сітці меню
 *   MenuHub.addTop({ id, icon, title, onClick })                                                              → кругла кнопка біля рівня (угорі праворуч)
 *   MenuHub.badge(id, n)   — число/крапка на картці або кнопці (0 = сховати)
 *   MenuHub.ready(fn)      — виконати, коли меню вже є в DOM */
(function () {
    'use strict';
    // сітку й вигляд карток задає style.css («Арсенал»); тут лише кольори й значки
    var css = '.mm-card.c-amber{--c:245,158,11}.mm-card.c-cyan{--c:34,211,238}.mm-card.c-pink{--c:236,72,153}.mm-card.c-lime{--c:132,204,22}.mm-card.c-indigo{--c:99,102,241}.mm-card.c-teal{--c:20,184,166}' +
        '.mh-badge{position:absolute;top:8px;right:10px;z-index:3;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#ef4444;color:#fff;font:800 11px/20px "Russo One",Arial,sans-serif;text-align:center;box-shadow:0 0 0 2px rgba(15,23,42,.9),0 0 14px rgba(239,68,68,.7);animation:mhPulse 1.8s ease-in-out infinite}' +
        '.mh-badge.dot{min-width:12px;width:12px;height:12px;padding:0;top:10px;right:12px}.mh-top{position:relative}.mh-top .mh-badge{top:-4px;right:-4px;min-width:18px;height:18px;line-height:18px;font-size:10px}' +
        '@keyframes mhPulse{50%{transform:scale(1.14)}}' +
        '@media (hover:none) and (pointer:coarse){.mm-round.mh-top{min-width:clamp(34px,calc(44px / var(--ui-zoom,1)),56px);min-height:clamp(34px,calc(44px / var(--ui-zoom,1)),56px)}}';
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

    // ---------- «Арсенал»: збираємо розкладку, навіть якщо index.html ще старий (часткове оновлення файлів) ----------
    var TANK = '<div class="ars-tank" aria-hidden="true"><svg viewBox="-70 -70 140 140"><defs><linearGradient id="ars-h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient><linearGradient id="ars-t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93c5fd"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs><rect x="-44" y="-40" width="18" height="80" rx="6" fill="#0f172a" stroke="#475569" stroke-width="2"/><rect x="26" y="-40" width="18" height="80" rx="6" fill="#0f172a" stroke="#475569" stroke-width="2"/><path d="M-44 -30h18M-44 -18h18M-44 -6h18M-44 6h18M-44 18h18M-44 30h18M26 -30h18M26 -18h18M26 -6h18M26 6h18M26 18h18M26 30h18" stroke="#334155" stroke-width="2"/><rect x="-30" y="-36" width="60" height="72" rx="12" fill="url(#ars-h)" stroke="#bfdbfe" stroke-width="2"/><g class="ars-tur"><rect x="-5" y="-64" width="10" height="46" rx="3" fill="#cbd5e1" stroke="#475569" stroke-width="2"/><circle r="22" fill="url(#ars-t)" stroke="#dbeafe" stroke-width="2.5"/><circle r="9" fill="rgba(2,6,23,.5)" stroke="#93c5fd" stroke-width="1.5"/></g></svg></div>';
    function ensureArsenal() {
        var m = document.getElementById('main-menu-screen'), n = nav(); if (!m || !n || m.querySelector('.ars-body')) return;
        var body = document.createElement('div'); body.className = 'ars-body';
        var left = document.createElement('aside'); left.className = 'ars-left';
        var center = document.createElement('section'); center.className = 'ars-center';
        var adv = m.querySelector('.mm-advent');
        if (adv) {
            var tm = document.getElementById('hw-timer'); if (!tm) { tm = document.createElement('div'); tm.id = 'hw-timer'; }
            adv.innerHTML = '<span class="mm-advent-ic" aria-hidden="true">🎃</span><b class="mm-advent-t">АДВЕНТ КАЛЕНДАР</b><div class="mm-advent-days" id="mm-adv-days"></div><span class="mm-advent-claim hidden" id="mm-adv-claim">🎁 Забрати нагороду</span>';
            adv.insertBefore(tm, adv.querySelector('.mm-advent-days')); adv.setAttribute('role', 'button'); adv.tabIndex = 0; left.appendChild(adv);
        }
        var hero = m.querySelector('.mm-hero'); if (hero) { if (!hero.querySelector('.ars-tank')) hero.insertAdjacentHTML('afterbegin', TANK); center.appendChild(hero); }
        if (!document.getElementById('mm-ev')) { var ev = document.createElement('div'); ev.id = 'mm-ev'; ev.className = 'ars-ev'; center.appendChild(ev); }
        var old = document.getElementById('ev-bar'); if (old) old.remove();
        n.parentNode.insertBefore(body, n); body.appendChild(left); body.appendChild(center); body.appendChild(n);
    }
    ready(ensureArsenal);

    // ---------- ефекти: картка нахиляється за курсором з відблиском (лише миша), каскадна поява при відкритті меню ----------
    var lowGfx = function () { return document.documentElement.classList.contains('gfx-low') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); };
    function tilt() {
        var n = nav(); if (!n || n.__tilt || !(window.matchMedia && matchMedia('(hover:hover) and (pointer:fine)').matches)) return; n.__tilt = 1;
        var cur = null, ev = null, raf = 0;
        function reset(c) { c.classList.remove('tl'); ['--rx', '--ry', '--mx', '--my'].forEach(function (k) { c.style.removeProperty(k); }); }
        function apply() {
            raf = 0; if (!cur || !ev || lowGfx()) return;
            var r = cur.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
            cur.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg'); cur.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
            cur.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); cur.style.setProperty('--my', (y * 100).toFixed(1) + '%'); cur.classList.add('tl');
        }
        n.addEventListener('pointermove', function (e) {
            var c = e.target.closest && e.target.closest('.mm-card');
            if (c !== cur) { if (cur) reset(cur); cur = c; }
            if (!c) return; ev = e; if (!raf) raf = requestAnimationFrame(apply);
        });
        n.addEventListener('pointerleave', function () { if (cur) reset(cur); cur = null; });
    }
    function intro() {
        var m = document.getElementById('main-menu-screen'); if (!m || lowGfx()) return;
        var cards = Array.prototype.slice.call(m.querySelectorAll('.mm-grid-nav > .mm-card'));
        cards.sort(function (a, b) { return (parseInt(getComputedStyle(a).order, 10) || 0) - (parseInt(getComputedStyle(b).order, 10) || 0); });
        cards.forEach(function (c, i) { c.style.setProperty('--i', i); });
        m.classList.remove('mm-in'); void m.offsetWidth; m.classList.add('mm-in');
        clearTimeout(intro.t); intro.t = setTimeout(function () { m.classList.remove('mm-in'); }, 1300);
    }
    ready(function () {
        tilt();
        var m = document.getElementById('main-menu-screen'); if (!m || !window.MutationObserver) return;
        var was = !m.classList.contains('hidden');
        new MutationObserver(function () { var vis = !m.classList.contains('hidden'); if (vis && !was) intro(); was = vis; }).observe(m, { attributes: true, attributeFilter: ['class'] });
    });
})();
