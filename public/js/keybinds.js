/* keybinds.js — призначення клавіш (ПК). Усе працює за ФІЗИЧНОЮ клавішею (e.code), тож керування однакове
 * на будь-якій розкладці: англійській, українській, німецькій тощо. Якщо браузер не дав e.code — відновлюємо його з e.key
 * (латиниця та ЙЦУКЕН). Призначення зберігаються в localStorage 'keyBinds'; у кожної дії до двох клавіш.
 * Вікно перепризначення — у settings.js (вкладка «Керування»). */
(function () {
    'use strict';
    var ACTIONS = [
        { id: 'up', n: 'Рух уперед', d: ['KeyW', 'ArrowUp'] },
        { id: 'down', n: 'Рух назад', d: ['KeyS', 'ArrowDown'] },
        { id: 'left', n: 'Рух ліворуч', d: ['KeyA', 'ArrowLeft'] },
        { id: 'right', n: 'Рух праворуч', d: ['KeyD', 'ArrowRight'] },
        { id: 'fire', n: 'Постріл (також ЛКМ)', d: ['Space', ''] },
        { id: 'dash', n: 'Ривок', d: ['ShiftLeft', 'ShiftRight'] },
        { id: 'ability', n: 'Здібність класу', d: ['KeyE', ''] },
        { id: 'emote', n: 'Меню емоцій', d: ['KeyQ', ''] },
        { id: 'map', n: 'Велика міні-мапа', d: ['KeyM', ''] },
        { id: 'target', n: 'Зміна цілі (самонавідка)', d: ['Tab', ''] },
        { id: 'chat', n: 'Чат у бою', d: ['Enter', 'NumpadEnter'] }
    ];
    // клавіші, які не можна призначити (системні / зайняті іншим)
    var RESERVED = { Escape: 1, Digit1: 1, Digit2: 1, Digit3: 1, Digit4: 1, Digit5: 1, Digit6: 1, Numpad1: 1, Numpad2: 1, Numpad3: 1, Numpad4: 1, Numpad5: 1, Numpad6: 1, MetaLeft: 1, MetaRight: 1, ContextMenu: 1, F5: 1, F11: 1, F12: 1 };
    var LS = {
        get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };
    var B = {};
    function defaults() { var o = {}; ACTIONS.forEach(function (a) { o[a.id] = a.d.slice(); }); return o; }
    function load() {
        B = defaults();
        try {
            var j = JSON.parse(LS.get('keyBinds') || 'null');
            if (j && typeof j === 'object') ACTIONS.forEach(function (a) {
                var v = j[a.id]; if (!Array.isArray(v)) return;
                B[a.id] = [0, 1].map(function (i) { return typeof v[i] === 'string' && v[i].length < 24 && !RESERVED[v[i]] ? v[i] : ''; });
            });
        } catch (e) {}
        reindex();
    }
    var IDX = {};
    function reindex() { IDX = {}; ACTIONS.forEach(function (a) { B[a.id].forEach(function (c) { if (c && !IDX[c]) IDX[c] = a.id; }); }); }
    function save() { LS.set('keyBinds', JSON.stringify(B)); reindex(); fire(); }

    // ---- e.key → e.code (запасний шлях, якщо e.code порожній: старі браузери, деякі віртуальні клавіатури) ----
    var LAT = 'qwertyuiopasdfghjklzxcvbnm', CYR = 'йцукенгшщзфівапролдячсмить', CYR_RU = 'йцукенгшщзфывапролдячсмить';
    var K2C = { ' ': 'Space', 'spacebar': 'Space', 'enter': 'Enter', 'tab': 'Tab', 'shift': 'ShiftLeft', 'control': 'ControlLeft', 'alt': 'AltLeft', 'escape': 'Escape', 'esc': 'Escape',
        'arrowup': 'ArrowUp', 'arrowdown': 'ArrowDown', 'arrowleft': 'ArrowLeft', 'arrowright': 'ArrowRight', 'up': 'ArrowUp', 'down': 'ArrowDown', 'left': 'ArrowLeft', 'right': 'ArrowRight',
        'backspace': 'Backspace', 'delete': 'Delete', 'capslock': 'CapsLock', 'ї': 'BracketRight', 'х': 'BracketLeft', 'є': 'Quote', 'э': 'Quote', 'ж': 'Semicolon', 'б': 'Comma', 'ю': 'Period', 'ъ': 'BracketRight', 'ы': 'KeyS' };
    for (var i = 0; i < 26; i++) { K2C[LAT[i]] = 'Key' + LAT[i].toUpperCase(); K2C[CYR[i]] = 'Key' + LAT[i].toUpperCase(); K2C[CYR_RU[i]] = 'Key' + LAT[i].toUpperCase(); }
    for (var d = 0; d < 10; d++) K2C[String(d)] = 'Digit' + d;
    function codeOf(e) {
        if (!e) return '';
        if (e.code && e.code !== 'Unidentified') return e.code;
        var k = String(e.key || '').toLowerCase(); return K2C[k] || '';
    }
    function actOf(e) { return IDX[codeOf(e)] || null; }
    function is(e, id) { var c = codeOf(e); return !!c && (B[id] || []).indexOf(c) >= 0; }
    // цифра 1–9 незалежно від розкладки (AZERTY дає «&», «é»… у e.key) — для емоцій і перків
    function digit(e) { var m = /^(?:Digit|Numpad)([0-9])$/.exec(codeOf(e)); return m ? +m[1] : (/^[0-9]$/.test(e && e.key) ? +e.key : -1); }

    // ---- назви клавіш ----
    var NAMES = { Space: 'Пробіл', Enter: 'Enter', NumpadEnter: 'Num Enter', Tab: 'Tab', ShiftLeft: 'Shift', ShiftRight: 'Shift (прав.)', ControlLeft: 'Ctrl', ControlRight: 'Ctrl (прав.)', AltLeft: 'Alt', AltRight: 'Alt (прав.)',
        ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: 'Backspace', Delete: 'Delete', CapsLock: 'Caps', Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']',
        Semicolon: ';', Quote: "'", Backslash: '\\', Comma: ',', Period: '.', Slash: '/', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PgUp', PageDown: 'PgDn', IntlBackslash: '\\' };
    function keyName(c) {
        if (!c) return '—';
        if (NAMES[c]) return NAMES[c];
        var m = /^Key([A-Z])$/.exec(c); if (m) return m[1];
        m = /^Digit([0-9])$/.exec(c); if (m) return m[1];
        m = /^Numpad(.+)$/.exec(c); if (m) return 'Num ' + m[1];
        return c;
    }
    function label(id) { var b = B[id] || []; return keyName(b[0] || b[1] || ''); }

    // ---- зміни ----
    var subs = [];
    function on(fn) { subs.push(fn); }
    function fire() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
    // призначити клавішу code дії id у слот s (0/1). Якщо клавіша вже зайнята іншою дією — звідти її знімаємо (повертаємо, звідки знято).
    function bind(id, s, code) {
        if (!B[id] || RESERVED[code]) return null;
        var from = null;
        ACTIONS.forEach(function (a) { [0, 1].forEach(function (j) { if (B[a.id][j] === code && !(a.id === id && j === s)) { B[a.id][j] = ''; from = a.id; } }); });
        B[id][s] = code;
        ACTIONS.forEach(function (a) { var b = B[a.id]; if (!b[0] && b[1]) { b[0] = b[1]; b[1] = ''; } });     // порожній основний слот — підтягуємо другий
        save(); return from;
    }
    function clear(id, s) { if (!B[id]) return; B[id][s] = ''; if (!B[id][0] && B[id][1]) { B[id][0] = B[id][1]; B[id][1] = ''; } save(); }
    function reset() { B = defaults(); save(); }

    // ---- режим «натисніть клавішу» (перехоплює клавішу раніше за всі інші обробники) ----
    var cap = null;
    function capture(fn) { cap = fn; }
    function cancelCapture() { cap = null; }
    window.addEventListener('keydown', function (e) {
        if (!cap) return;
        e.preventDefault(); e.stopImmediatePropagation();
        var f = cap, c = codeOf(e); cap = null; f(c, e);
    }, true);
    window.addEventListener('keyup', function (e) { if (cap) { e.preventDefault(); e.stopImmediatePropagation(); } }, true);

    load();
    window.KB = { ACTIONS: ACTIONS, RESERVED: RESERVED, codeOf: codeOf, actOf: actOf, is: is, digit: digit, keyName: keyName, label: label, get: function (id) { return (B[id] || []).slice(); },
        bind: bind, clear: clear, reset: reset, on: on, capture: capture, cancelCapture: cancelCapture, capturing: function () { return !!cap; } };
})();
