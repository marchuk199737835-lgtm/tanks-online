// Спільне екранування HTML для даних користувача (ніки, назви, повідомлення). Використання: innerHTML = '<b>' + escHtml(nick) + '</b>'.
(function () {
    var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
    window.escHtml = window.escHtml || function (s) { return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) { return MAP[c]; }); };
    // перший символ (code point) для аватарів: безпечно для емодзі й сурогатних пар
    window.firstChar = window.firstChar || function (s) { var a = Array.from(String(s == null ? '' : s).trim()); return (a[0] || '?').toUpperCase(); };
})();
