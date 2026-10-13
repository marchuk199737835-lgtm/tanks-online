/* stakesinfo.js — «Фортуна»: спільні правила й числа для сервера (stakes.js) і клієнта (js/stakes.js).
 * Розділ має дві гри:
 *  • колесо фортуни — оберт лише за квиток (квиток дає щоденне завдання «Квиток дня»), ставки немає, приз — кредити від гри;
 *  • дуель із другом — бій 1×1 на кредити, результат вирішує вміння, а не випадок.
 * Кредити й предмети не мають грошової вартості, вивести їх неможливо.
 * Чесність колеса (provably fair): до оберту видно SHA-256 від секретного ключа (serverSeed), після — сам ключ;
 * сектор = HMAC-SHA256(serverSeed, логін + ':' + номер оберту) → число 0…1 (перші 13 hex-символів / 2^52) × кількість секторів. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.StakesInfo = factory(); })(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var S = {
        MIN_LEVEL: 3,            // дуелі — з 3 рівня (захист від твінків)
        MIN_BET: 50, MAX_BET: 5000,
        DAILY: 30,               // дуелей на добу (Київ)
        FEE: 0.05,               // комісія системи в дуелі
        INV_MAX: 30,
        TICKETS_MAX: 30,         // квитків колеса в запасі
        // ---- колесо фортуни: 68 секторів, приз — кредити (без ставки). Середній виграш ≈ 123 кредити за квиток.
        WH: { SPIN: 6500, SECT: [{ id: 'c50', v: 50, n: 33, c: '#64748b' }, { id: 'c100', v: 100, n: 22, c: '#10b981' }, { id: 'c250', v: 250, n: 12, c: '#a855f7' }, { id: 'c1500', v: 1500, n: 1, c: '#f59e0b' }] },
        // ---- дуель із другом ----
        DU: { MAPS: ['Colosseum', 'Duelist Pit', 'Neon Grid', 'Ice Cathedral', 'Lava Pit', 'Ruined Plaza', 'Metro Line'], ROUNDS: [3, 5, 7], TIMES: [60, 90, 120, 180], PAIR_MAX: 3, INVITE_MS: 60000 }
    };
    // колесо: головний приз — нульовий сектор, решта рівномірно перемішані (детерміновано, однаково на сервері й клієнті)
    S.wheel = (function () {
        var big = S.WH.SECT[S.WH.SECT.length - 1], rest = S.WH.SECT.filter(function (s) { return s !== big; }), tot = 0, out = [big.id], used = {};
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
    // зсув часу Києва (UTC+2/+3) — межа доби для ліміту дуелей
    S.kyivOffset = function (ts) {
        try {
            var f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kiev', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }), o = {};
            f.formatToParts(new Date(ts)).forEach(function (p) { if (p.type !== 'literal') o[p.type] = +p.value; });
            return Date.UTC(o.year, o.month - 1, o.day, o.hour, o.minute) - Math.floor(ts / 60000) * 60000;
        } catch (e) { return 2 * 3600e3; }
    };
    S.dayId = function (ts) { var d = new Date(ts + S.kyivOffset(ts)); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
    return S;
});
