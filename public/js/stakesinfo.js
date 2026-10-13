/* stakesinfo.js — «Арена ставок»: спільні правила й числа для сервера (stakes.js) і клієнта (js/stakes.js).
 * Усе грається лише ігровою валютою (кредити, модулі). Вивести кредити чи предмети за реальні гроші неможливо.
 * Чесність (provably fair): перед грою сервер показує SHA-256 від секретного ключа (serverSeed), після — сам ключ;
 * результат = HMAC-SHA256(serverSeed, clientSeed + ':' + nonce) → число 0…1 (перші 13 hex-символів / 2^52). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.StakesInfo = factory(); })(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var S = {
        MIN_LEVEL: 3,            // доступ з 3 рівня (захист від твінків)
        MIN_BET: 50, MAX_BET: 5000,
        DAILY: 30,               // ставок на добу (Київ) — у всіх іграх разом, крім контракту й лотереї
        FEE: 0.05,               // комісія системи: дуель, койнфліп, джекпот
        INV_MAX: 30,
        // ---- батл кейсів ----
        CB: {
            MODES: {
                '1v1': { n: [2, 2], team: false, cheap: false, allin: false, bot: true },
                '2v2': { n: [4, 4], team: true, cheap: false, allin: false, bot: false },
                cheap: { n: [2, 4], team: false, cheap: true, allin: false, bot: false },
                allin: { n: [2, 4], team: false, cheap: false, allin: true, bot: false }
            },
            MAX_CASES: 5,          // кейсів (раундів) у батлі
            BOT_AFTER: 30000,      // 1×1: бот сідає, якщо за 30 с ніхто не приєднався
            ROUND_MS: 5600,        // анімація одного раунду
            TTL: 15 * 60e3         // незаповнений батл скасовується (гроші повертаються)
        },
        // ---- койнфліп ----
        CF: { DIFF: 150, MAX_ITEMS: 10, SPIN_MS: 4600, TTL: 30 * 60e3 },
        // ---- джекпот ----
        JP: { MS: 60000, MAX_PLAYER: 5000, SPIN_MS: 6500, IDLE: 10 * 60e3, MAX_PLAYERS: 20 },
        // ---- краш ----
        CR: { BET_MS: 9000, K: 0.00006, EDGE: 0.04, MAX: 1000, PAUSE_MS: 3500 },
        // ---- колесо ----
        WH: { CYCLE: 30000, SPIN: 6500, SECT: [{ id: 'x2', m: 2, n: 26, c: '#64748b' }, { id: 'x3', m: 3, n: 17, c: '#10b981' }, { id: 'x5', m: 5, n: 10, c: '#a855f7' }, { id: 'x50', m: 50, n: 1, c: '#f59e0b' }] },
        // ---- мінне поле ----
        MN: { N: 25, EDGE: 0.03, MAX_MULT: 1000, MINES: [1, 3, 5, 10, 15, 24] },
        // ---- контракт обміну ----
        CT: { NEED: 10 },
        // ---- лотерея сезону ----
        LT: { PRICE: 50, MAX: 20, SHARES: [0.4, 0.2, 0.1], DOW: 0, HOUR: 20 },      // розіграш щонеділі о 20:00 за Києвом
        // ---- дуель із другом ----
        DU: { MAPS: ['Colosseum', 'Duelist Pit', 'Neon Grid', 'Ice Cathedral', 'Lava Pit', 'Ruined Plaza', 'Metro Line'], ROUNDS: [3, 5, 7], TIMES: [60, 90, 120, 180], PAIR_MAX: 3, INVITE_MS: 60000 }
    };
    // множник краша через t мс від старту
    S.crashAt = function (t) { return Math.max(1, Math.floor(100 * Math.exp(S.CR.K * Math.max(0, t))) / 100); };
    S.crashTime = function (m) { return Math.log(Math.max(1, m)) / S.CR.K; };      // мс до множника m
    // точка краша з числа 0…1: P(точка ≥ m) = (1 − EDGE) / m
    S.crashPoint = function (r) { if (r < S.CR.EDGE) return 1; return Math.min(S.CR.MAX, Math.max(1, Math.floor(100 * (1 - S.CR.EDGE) / (1 - r)) / 100)); };
    // множник мінного поля після k відкритих безпечних клітинок при m мінах
    S.minesMult = function (m, k) {
        if (k <= 0) return 1; var x = 1 - S.MN.EDGE;
        for (var i = 0; i < k; i++) x *= (S.MN.N - i) / (S.MN.N - m - i);
        return Math.min(S.MN.MAX_MULT, Math.floor(x * 100) / 100);
    };
    // колесо: 54 сектори; ×50 — нульовий, решта рівномірно перемішані (детерміновано, однаково на сервері й клієнті)
    S.wheel = (function () {
        var rest = S.WH.SECT.filter(function (s) { return s.id !== 'x50'; }), tot = 0, out = ['x50'], used = {};
        rest.forEach(function (s) { tot += s.n; used[s.id] = 0; });
        for (var i = 1; i <= tot; i++) {
            var best = null, bd = -1e9;
            rest.forEach(function (s) { var d = s.n * i / tot - used[s.id]; if (d > bd) { bd = d; best = s; } });
            used[best.id]++; out.push(best.id);
        }
        return out;
    })();
    S.sect = function (id) { for (var i = 0; i < S.WH.SECT.length; i++) if (S.WH.SECT[i].id === id) return S.WH.SECT[i]; return null; };
    // число 0…1 з hex HMAC
    S.hexFloat = function (hex) { return parseInt(String(hex).slice(0, 13), 16) / Math.pow(2, 52); };
    // тиждень лотереї: «YYYY-Www», межа — неділя DOW о HOUR:00 за Києвом (UTC+2/+3 приблизно: беремо +2 взимку, +3 влітку через Intl, якщо є)
    S.kyivOffset = function (ts) {
        try {
            var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kiev', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }), o = {};
            f.formatToParts(new Date(ts)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = +p.value; });
            return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - Math.floor(ts / 60000) * 60000;
        } catch (e) { return 2 * 3600e3; }
    };
    // наступний розіграш після ts (мс)
    S.nextDraw = function (ts) {
        var off = S.kyivOffset(ts), k = new Date(ts + off), d = new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate(), S.LT.HOUR, 0, 0));
        var add = (S.LT.DOW - d.getUTCDay() + 7) % 7; d = new Date(d.getTime() + add * 864e5);
        var t = d.getTime() - off; if (t <= ts) t += 7 * 864e5; return t;
    };
    S.drawId = function (ts) { var t = S.nextDraw(ts), d = new Date(t + S.kyivOffset(t)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
    S.dayId = function (ts) { var d = new Date(ts + S.kyivOffset(ts)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
    return S;
});
