// ===== DomPatch: «розумне» оновлення DOM без повного перемальовування =====
// DomPatch.html(el, html)  — приводить вміст el до нового HTML, зберігаючи існуючі вузли (за ключем data-id / data-l / data-key / id,
//                            інакше — за позицією й тегом). Нічого не чіпає, якщо html не змінився. Нові вузли — справжні нові
//                            (їхня CSS-анімація входу програється), старі лишаються (hover, прокрутка, фокус, анімації не переривааються).
// DomPatch.text(el, str)   — textContent лише якщо змінився.
(function () {
    'use strict';
    var KEYS = ['data-id', 'data-l', 'data-key', 'data-login', 'id'];
    function keyOf(n) {
        if (n.nodeType !== 1) return null;
        for (var i = 0; i < KEYS.length; i++) { var v = n.getAttribute(KEYS[i]); if (v) return KEYS[i] + '=' + v; }
        return null;
    }
    function isForm(n) { return n.nodeName === 'INPUT' || n.nodeName === 'TEXTAREA' || n.nodeName === 'SELECT'; }
    // I18N переписує тексти/атрибути на місці: порівнюємо з перекладеною версією, щоб не «воювати» з ним на кожному оновленні
    function tr(v) { try { return window.I18N && I18N.t ? I18N.t(v) : v; } catch (e) { return v; } }
    function syncAttrs(a, b) {
        var i, at;
        for (i = a.attributes.length - 1; i >= 0; i--) { at = a.attributes[i]; if (!b.hasAttribute(at.name)) { if (isForm(a) && (at.name === 'value' || at.name === 'checked')) continue; a.removeAttribute(at.name); } }
        for (i = 0; i < b.attributes.length; i++) {
            at = b.attributes[i];
            if (isForm(a) && (at.name === 'value' || at.name === 'checked')) { if (!a.hasAttribute(at.name)) a.setAttribute(at.name, at.value); continue; }
            var cv = a.getAttribute(at.name); if (cv !== at.value && cv !== tr(at.value)) a.setAttribute(at.name, at.value);
        }
    }
    function same(a, b) { return a.nodeType === b.nodeType && a.nodeName === b.nodeName; }
    // SVG-іконки мають унікальні id градієнтів на кожну генерацію: порівнюємо розмітку з нормалізованими id
    function svgSig(n) {
        var h = n.outerHTML, ids = h.match(/ id="[^"]+"/g);
        if (ids) ids.forEach(function (x, i) { h = h.split(x.slice(5, -1)).join('@' + i); });
        return h;
    }
    function morphNode(a, b) {
        if (a.nodeName === 'svg' && b.nodeName === 'svg') { if (svgSig(a) === svgSig(b)) return a; return b; }
        if (a.nodeType === 3 || a.nodeType === 8) { if (a.nodeValue !== b.nodeValue && a.nodeValue !== tr(b.nodeValue)) a.nodeValue = b.nodeValue; return a; }
        syncAttrs(a, b);
        if (isForm(a) || (b.hasAttribute('data-dp-skip') && a.hasAttribute('data-dp-skip'))) return a;   // data-dp-skip: контейнер, який наповнює окремий код
        morphKids(a, b); return a;
    }
    function morphKids(parent, tmpl) {
        var olds = Array.prototype.slice.call(parent.childNodes), keyed = Object.create(null), cnt = Object.create(null), loose = [], i, n, k;
        for (i = 0; i < olds.length; i++) { k = keyOf(olds[i]); if (k) cnt[k] = (cnt[k] || 0) + 1; }
        for (i = 0; i < olds.length; i++) { k = keyOf(olds[i]); if (k && cnt[k] === 1) keyed[k] = olds[i]; else loose.push(olds[i]); }   // ключ, що повторюється серед сусідів, ключем не вважаємо
        var news = Array.prototype.slice.call(tmpl.childNodes), res = [], li = 0, used = new Set();
        for (i = 0; i < news.length; i++) {
            n = news[i]; k = keyOf(n); var m = null;
            if (k && (cnt[k] === 1 || !cnt[k])) { m = keyed[k]; if (m && m.nodeName === n.nodeName && !used.has(m)) used.add(m); else m = null; }
            else {
                while (li < loose.length && used.has(loose[li])) li++;
                if (li < loose.length && same(loose[li], n)) { m = loose[li]; used.add(m); li++; }
            }
            res.push(m ? morphNode(m, n) : n);
        }
        // видалення зайвого, потім порядок: рухаємо лише те, що стоїть не на місці
        var keep = new Set(res);
        for (i = 0; i < olds.length; i++) if (!keep.has(olds[i])) parent.removeChild(olds[i]);
        var ref = parent.firstChild;
        for (i = 0; i < res.length; i++) {
            if (res[i] === ref) ref = ref.nextSibling;
            else parent.insertBefore(res[i], ref);
        }
    }
    function html(el, h) {
        if (!el) return;
        h = String(h == null ? '' : h);
        if (!el.firstChild) { el.innerHTML = h; return; }
        var t = document.createElement(el.nodeName === 'UL' || el.nodeName === 'OL' ? el.nodeName : 'div');
        t.innerHTML = h;
        morphKids(el, t);
    }
    // морфінг одного елемента до першого елемента з html (напр., шапка клану)
    function el(old, h) {
        if (!old) return;
        var t = document.createElement('div'); t.innerHTML = h; var n = t.firstElementChild; if (!n) return;
        if (n.nodeName !== old.nodeName) { old.replaceWith(n); return; }
        var r = morphNode(old, n); if (r !== old) old.replaceWith(r);
    }
    function text(el, s) { if (el && el.textContent !== String(s)) el.textContent = s; }
    window.DomPatch = { html: html, el: el, text: text };
})();
