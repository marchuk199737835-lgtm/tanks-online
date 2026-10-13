/* stakesinfo.js — «Фортуна»: спільні правила й числа для сервера (stakes.js) і клієнта (js/stakes.js).
 * Усе грається лише ігровою валютою (кредити, модулі). Вивести кредити чи предмети за реальні гроші неможливо.
 * Чесність (provably fair): перед грою сервер показує SHA-256 від секретного ключа (serverSeed), після — сам ключ;
 * результат = HMAC-SHA256(serverSeed, clientSeed + ':' + nonce) → число 0…1 (перші 13 hex-символів / 2^52). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.StakesInfo = factory(); })(typeof self !== 'undefined' ? self : this, function () {
    'use strict';
    var S = {
        MIN_LEVEL: 3,            // доступ з 3 рівня (захист від твінків)
        MIN_BET: 50, MAX_BET: 5000,
        DAILY: 30,               // ставок на добу (Київ) — у всіх іграх разом
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
        // ---- колесо фортуни: 68 секторів. Чим більший множник, тим гірше співвідношення шансу до виграшу:
        //      ×2 — 48.5% (повернення 97%), ×3 — 32.4% (97%), ×5 — 17.6% (88%), ×50 — 1.47% (74%). Великий куш — рідкість.
        WH: { CYCLE: 30000, SPIN: 6500, SECT: [{ id: 'x2', m: 2, n: 33, c: '#64748b' }, { id: 'x3', m: 3, n: 22, c: '#10b981' }, { id: 'x5', m: 5, n: 12, c: '#a855f7' }, { id: 'x50', m: 50, n: 1, c: '#f59e0b' }] },
        // ---- дуель із другом ----
        DU: { MAPS: ['Colosseum', 'Duelist Pit', 'Neon Grid', 'Ice Cathedral', 'Lava Pit', 'Ruined Plaza', 'Metro Line'], ROUNDS: [3, 5, 7], TIMES: [60, 90, 120, 180], PAIR_MAX: 3, INVITE_MS: 60000 }
    };
    // колесо: ×50 — нульовий сектор, решта рівномірно перемішані (детерміновано, однаково на сервері й клієнті)
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
    // зсув часу Києва (UTC+2/+3) — межа доби для ліміту ставок
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
