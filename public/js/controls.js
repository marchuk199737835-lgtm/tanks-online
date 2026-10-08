/* controls.js — перемикач «Керування: Авто / ПК / Телефон» у налаштуваннях (одним із перших).
 * Авто-визначення лишається; ручний вибір зберігається (localStorage 'ctlMode') і перекриває його. Логіка — setCtlMode() у game.js. */
(function () {
    'use strict';
    var css = '.ctl-seg{display:flex;gap:6px}.ctl-seg button{flex:1;min-height:40px;padding:6px 4px;border-radius:12px;border:1px solid #334155;background:rgba(15,23,42,.8);color:#cbd5e1;font:700 13px/1.1 "Russo One",Arial,sans-serif;cursor:pointer}' +
        '.ctl-seg button.on{background:linear-gradient(135deg,#2563eb,#7c3aed);border-color:#818cf8;color:#fff;box-shadow:0 0 12px rgba(99,102,241,.5)}.ctl-hint{margin-top:6px;font-size:10px;line-height:1.35;color:#64748b}' +
        '@media (hover:none) and (pointer:coarse){.ctl-seg button{min-height:46px}}';
    var st = document.createElement('style'); st.id = 'ctl-css'; st.textContent = css; document.head.appendChild(st);
    function cur() { try { var v = localStorage.getItem('ctlMode'); return v === 'pc' || v === 'phone' ? v : 'auto'; } catch (e) { return 'auto'; } }
    function paint(row) { var c = cur(); row.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === c); b.setAttribute('aria-pressed', b.dataset.m === c ? 'true' : 'false'); }); }
    function init() {
        var lang = document.getElementById('lang-select'); if (!lang || document.getElementById('ctl-row')) return;
        var anchor = lang.closest('.mb-4') || lang.parentNode;
        var row = document.createElement('div'); row.id = 'ctl-row'; row.className = 'mb-4 lg:mb-6 text-left';
        row.innerHTML = '<label class="text-[10px] lg:text-xs font-bold uppercase text-slate-400 block mb-2 tracking-wider">Керування</label>' +
            '<div class="ctl-seg"><button type="button" data-m="auto">Авто</button><button type="button" data-m="pc">ПК</button><button type="button" data-m="phone">Телефон</button></div>' +
            '<div class="ctl-hint">Авто сама визначає пристрій. Якщо на планшеті керування не те — оберіть вручну.</div>';
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
        row.addEventListener('click', function (e) {
            var b = e.target.closest('button'); if (!b) return;
            if (typeof window.setCtlMode === 'function') window.setCtlMode(b.dataset.m);
            paint(row);
            if (window.uiToast) try { uiToast(b.dataset.m === 'phone' ? 'Керування: Телефон' : b.dataset.m === 'pc' ? 'Керування: ПК' : 'Керування: Авто'); } catch (e2) {}
        });
        paint(row);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
