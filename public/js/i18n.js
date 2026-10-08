// ===== МУЛЬТИМОВНІСТЬ ІНТЕРФЕЙСУ =====
// Вихідна мова проєкту — українська (тексти лишаються в коді як є). Для інших мов клієнт підвантажує
// словник js/lang/<код>.js і підставляє переклад у DOM (текст, placeholder, title, alert), в т.ч. у динамічно створені елементи.
// Мова зберігається за акаунтом (сервер, подія setLang) і локально (localStorage) — для екрана входу.
(function () {
    var LANGS = [
        { code: 'uk', name: 'Українська' }, { code: 'en', name: 'English' }, { code: 'es', name: 'Español' },
        { code: 'de', name: 'Deutsch' }, { code: 'fr', name: 'Français' }, { code: 'pt', name: 'Português' },
        { code: 'pl', name: 'Polski' }, { code: 'tr', name: 'Türkçe' }
    ];
    var SRC = 'uk', CYR = /[А-ЯІЇЄҐа-яіїєґ]/, CYRCH = 'А-ЯІЇЄҐа-яіїєґ\'’ʼ';
    var dicts = {}, pats = {}, compiled = {}, cache = {}, orig = new WeakMap(), lastOut = new WeakMap();
    var cur = SRC, obs = null, writing = false;

    function norm(code) { code = String(code || '').toLowerCase().slice(0, 2); if (code === 'ru' || code === 'be') code = 'uk'; return LANGS.some(function (l) { return l.code === code; }) ? code : null; }
    function detect() {
        try { var s = norm(localStorage.getItem('lang')); if (s) return s; } catch (e) {}
        var nav = (navigator.languages && navigator.languages[0]) || navigator.language || 'uk';
        return norm(nav) || 'en';
    }

    // ---- словники ----
    function add(code, map, patterns) {
        dicts[code] = Object.assign(dicts[code] || {}, map); delete compiled[code]; cache = {};
        if (patterns) pats[code] = (pats[code] || []).concat(patterns.map(function (p) { return [new RegExp(p[0], 'g'), p[1]]; }));   // шаблони з числами: [регулярка, заміна]
    }
    function compile(code) {
        if (compiled[code]) return compiled[code];
        var merged = Object.assign({}, dicts.en || {}, dicts[code] || {});     // слова без власного перекладу беруться з англійської
        var exact = {}, frag = [];
        Object.keys(merged).forEach(function (k) {
            exact[k] = merged[k];
            if (k.length >= 3) frag.push(k);
        });
        frag.sort(function (a, b) { return b.length - a.length; });
        return (compiled[code] = { exact: exact, frag: frag });
    }

    // ---- переклад рядка ----
    function tr(s) {
        if (cur === SRC || typeof s !== 'string' || !CYR.test(s) || (!dicts[cur] && !dicts.en)) return s;
        var key = cur + '\u0001' + s; if (cache[key] !== undefined) return cache[key];
        var d = compile(cur), core = s.trim(), res;
        if (d.exact[core] !== undefined) res = s.replace(core, d.exact[core]);
        else {
            res = s;
            var pl = pats[cur] || [];
            for (var q = 0; q < pl.length; q++) res = res.replace(pl[q][0], pl[q][1]);
            for (var i = 0; i < d.frag.length && CYR.test(res); i++) {
                var k = d.frag[i]; if (res.indexOf(k) < 0) continue;
                var re = new RegExp('(^|[^' + CYRCH + '])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![' + CYRCH + '])', 'g');
                res = res.replace(re, function (m, p) { return p + d.exact[k]; });
            }
        }
        if (Object.keys(cache).length > 4000) cache = {};
        return (cache[key] = res);
    }

    // ---- DOM ----
    var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
    function doText(n) {
        var v = n.nodeValue; if (!v) return;
        var prev = lastOut.get(n);
        if (prev !== undefined && v === prev) return;                  // це наш власний переклад
        if (!CYR.test(v)) { if (prev !== undefined) { orig.delete(n); lastOut.delete(n); } return; }
        orig.set(n, v);
        var out = cur === SRC ? v : tr(v);
        if (out !== v) { writing = true; n.nodeValue = out; writing = false; lastOut.set(n, out); } else lastOut.delete(n);
    }
    function doAttr(el, a) {
        var v = el.getAttribute(a); if (v === null) return;
        var map = orig.get(el) || {}, last = (lastOut.get(el) || {});
        if (last[a] !== undefined && v === last[a]) return;
        if (!CYR.test(v)) return;
        map[a] = v; orig.set(el, map);
        var out = tr(v); if (out !== v) { writing = true; el.setAttribute(a, out); writing = false; last[a] = out; lastOut.set(el, last); }
    }
    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) return doText(root);
        if (root.nodeType !== 1 && root.nodeType !== 11) return;
        if (root.nodeType === 1) {
            var tag = root.tagName; if (tag === 'SCRIPT' || tag === 'STYLE' || (root.classList && root.classList.contains('i18n-skip'))) return;   // .i18n-skip: тексти користувачів (чат, ніки) не перекладаємо
            for (var i = 0; i < ATTRS.length; i++) if (root.hasAttribute && root.hasAttribute(ATTRS[i])) doAttr(root, ATTRS[i]);
        }
        var c = root.firstChild;
        while (c) { walk(c); c = c.nextSibling; }
    }
    function restoreAll(root) {   // повернення оригіналу (при зміні мови спершу відновлюємо українську, потім перекладаємо наново)
        var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n;
        while ((n = w.nextNode())) { var o = orig.get(n); if (o !== undefined && lastOut.get(n) === n.nodeValue) { n.nodeValue = o; lastOut.delete(n); } }
        var els = root.querySelectorAll ? root.querySelectorAll('[placeholder],[title],[alt],[aria-label]') : [];
        for (var i = 0; i < els.length; i++) { var m = orig.get(els[i]), l = lastOut.get(els[i]); if (m && l) ATTRS.forEach(function (a) { if (m[a] !== undefined && l[a] !== undefined && els[i].getAttribute(a) === l[a]) els[i].setAttribute(a, m[a]); }); lastOut.delete(els[i]); }
    }
    function onMut(list) {
        if (writing || cur === SRC) return;
        for (var i = 0; i < list.length; i++) {
            var m = list[i];
            if (m.type === 'characterData') doText(m.target);
            else if (m.type === 'attributes') doAttr(m.target, m.attributeName);
            else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
        }
        if (document.title && cur !== SRC) setTitle();
    }
    var titleSrc = null;
    function setTitle() {
        var t = document.title; if (!titleSrc || (CYR.test(t) && t !== titleSrc)) titleSrc = t;
        var out = cur === SRC ? titleSrc : tr(titleSrc); if (document.title !== out) document.title = out;
    }
    function start() {
        if (obs || !document.documentElement) return;
        obs = new MutationObserver(onMut);
        obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }
    function applyAll() {
        if (!document.body) return;
        writing = true; try { restoreAll(document.body); } finally { writing = false; }
        if (cur !== SRC) walk(document.body);
        setTitle();
        document.documentElement.lang = cur;
    }

    // ---- мова ----
    function loadDict(code, cb) {
        if (code === SRC || dicts[code]) return cb();
        var s = document.createElement('script'); s.src = 'js/lang/' + code + '.js'; s.onload = cb; s.onerror = cb; document.head.appendChild(s);
    }
    function setLanguage(code, opts) {
        opts = opts || {}; code = norm(code) || SRC;
        function go() {
            cur = code; cache = {};
            try { if (opts.save !== false) localStorage.setItem('lang', code); } catch (e) {}
            applyAll();
            var sel = document.getElementById('lang-select'); if (sel && sel.value !== code) sel.value = code;
            if (opts.remote && typeof socket !== 'undefined' && socket && socket.connected) socket.emit('setLang', code);
            if (typeof window.onLanguageChanged === 'function') window.onLanguageChanged(code);
        }
        if (code !== SRC && !dicts.en) loadDict('en', function () { loadDict(code, go); }); else loadDict(code, go);
    }

    // ---- публічний API ----
    var api = { LANGS: LANGS, add: add, t: tr, setLanguage: setLanguage, get lang() { return cur; }, detect: detect };
    api.missing = function (root) {                                  // для перевірки: українські тексти, що лишились без перекладу
        var out = {}, w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, null), n;
        while ((n = w.nextNode())) if (CYR.test(n.nodeValue) && n.parentNode && n.parentNode.tagName !== 'SCRIPT' && n.parentNode.tagName !== 'STYLE') out[n.nodeValue.trim()] = 1;
        return Object.keys(out);
    };
    window.I18N = api;

    // alert() теж перекладаємо (повідомлення сервера й гри)
    var _alert = window.alert.bind(window); window.alert = function (m) { return _alert(tr(String(m))); };

    // старт: мова з localStorage / браузера; словник підвантажується синхронно, щоб не мигала українська
    cur = SRC; var first = detect();
    if (first !== SRC) {
        document.write('<script src="js/lang/en.js"><\/script>' + (first !== 'en' ? '<script src="js/lang/' + first + '.js"><\/script>' : ''));
        cur = first;
    }
    start();
    document.addEventListener('DOMContentLoaded', function () {
        applyAll();
        var sel = document.getElementById('lang-select');
        if (sel) {
            sel.innerHTML = LANGS.map(function (l) { return '<option value="' + l.code + '">' + l.name + '</option>'; }).join('');
            sel.value = cur;
            sel.addEventListener('change', function () { setLanguage(sel.value, { remote: true }); });
        }
    });
})();
