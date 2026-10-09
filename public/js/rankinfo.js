/* rankinfo.js — рейтинговий режим: ранги, пороги очок рейтингу (ОР), правила підбору й сезонні нагороди. Спільний для сервера й клієнта.
 *
 * Ранги (від найнижчого): Бронза I–III → Срібло I–III → Золото I–III → Платина I–III → Титан → Абсолют (14 сходинок, індекс 0…13).
 * Пороги ОР (початок сходинки):
 *   Бронза   0 / 100 / 200      (по 100)        Срібло  300 / 400 / 500   (по 100)
 *   Золото 600 / 725 / 850      (по 125)        Платина 1000 / 1150 / 1300 (по 150)
 *   Титан 1500 (300 до Абсолюту)                Абсолют 1800+ (без стелі)
 * За бій: ±(40 × (результат − очікуваний результат)) за формулою Ело (рівні суперники → +20 / −20), перемога щонайменше +8, поразка щонайменше −6.
 * Поразки м'якші на нижчих лігах: Бронза ×0.5, Срібло ×0.7, Золото ×0.85, далі ×1 — новачок піднімається, навіть вигравши половину боїв:
 *   50% перемог → у середньому +10 за бій у Бронзі (≈30 боїв до Срібла), +6 у Сріблі, +3 у Золоті; Платину й вище тримає лише гра понад 50%.
 * Захист рангу: після підйому до нової ліги 3 поразки не опускають нижче її порогу.
 * Підбір: суперники й союзники в межах ±1 сходинки (Бронза I ↔ Бронза I/II, Срібло I ↔ Бронза III/Срібло II).
 * Кінець сезону (щомісяця): нагорода за лігою (за умови ≥5 рейтингових боїв), рейтинг стискається вдвічі (м'яке скидання). */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RankInfo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const TIERS = {
        bronze:   { n: 'Бронза',  c1: '#e2a36b', c2: '#8a4b1f', glow: '205,127,50' },
        silver:   { n: 'Срібло',  c1: '#e5ebf3', c2: '#7b8798', glow: '203,213,225' },
        gold:     { n: 'Золото',  c1: '#fde68a', c2: '#c27c0e', glow: '251,191,36' },
        platinum: { n: 'Платина', c1: '#a7f3e4', c2: '#11806f', glow: '45,212,191' },
        titan:    { n: 'Титан',   c1: '#d8c8ff', c2: '#6233c9', glow: '167,139,250' },
        absolute: { n: 'Абсолют', c1: '#ffd36b', c2: '#e11d48', glow: '244,63,94' }
    };
    const ROMAN = ['I', 'II', 'III'];
    const RP = [0, 100, 200, 300, 400, 500, 600, 725, 850, 1000, 1150, 1300, 1500, 1800];
    const DIVS = RP.map((rp, i) => {
        const t = i < 3 ? 'bronze' : i < 6 ? 'silver' : i < 9 ? 'gold' : i < 12 ? 'platinum' : i === 12 ? 'titan' : 'absolute';
        const sub = i < 12 ? i % 3 : -1;
        return { i, t, sub, rp, next: RP[i + 1] != null ? RP[i + 1] : null, n: TIERS[t].n + (sub >= 0 ? ' ' + ROMAN[sub] : '') };
    });
    const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum', 'titan', 'absolute'];
    const LOSS_MULT = { bronze: 0.5, silver: 0.7, gold: 0.85, platinum: 1, titan: 1, absolute: 1 };
    // сезонні нагороди за лігою: креди + кейс (ціна — орієнтир, сервер бере найближчий кейс; legend — легендарний кейс)
    const SEASON_REWARDS = {
        bronze:   { cr: 100 },
        silver:   { cr: 200, caseP: 100 },
        gold:     { cr: 350, caseP: 175 },
        platinum: { cr: 600, caseP: 450 },
        titan:    { cr: 1000, caseP: 870 },
        absolute: { cr: 1500, caseP: 1650 }
    };
    const FORMATS = { '1v1': 1, '2v2': 2, '5v5': 5 };
    const K = 40, WIN_MIN = 8, LOSS_MIN = 6, SHIELD = 3, SOFT_RESET = 0.5;
    const MIN_LEVEL = 5, MIN_MATCHES = 10, MIN_SEASON_GAMES = 5;

    function divOf(rp) { rp = Math.max(0, rp | 0); let d = 0; for (let i = 0; i < RP.length; i++) if (rp >= RP[i]) d = i; return d; }
    const tierOf = rp => DIVS[divOf(rp)].t;
    const tierIdx = t => TIER_ORDER.indexOf(t);
    function tierFloor(t) { const d = DIVS.find(x => x.t === t); return d ? d.rp : 0; }
    // частка прогресу до наступної сходинки (0..1); для Абсолюту — 1
    function progress(rp) { const d = DIVS[divOf(rp)]; if (d.next == null) return 1; return Math.max(0, Math.min(1, (rp - d.rp) / (d.next - d.rp))); }
    // зміна ОР за бій. o: { me, opp (середній ОР суперників), outcome:'win'|'loss'|'draw', mvp, top (найкращий у своїй команді), streak, afk }
    function delta(o) {
        const S = o.outcome === 'win' ? 1 : o.outcome === 'draw' ? 0.5 : 0, E = 1 / (1 + Math.pow(10, ((o.opp || 0) - (o.me || 0)) / 400));
        let d = K * (S - E);
        if (o.outcome === 'win') { d = Math.max(WIN_MIN, d) + (o.mvp ? 4 : o.top ? 2 : 0) + (o.streak >= 2 ? 2 : 0); if (o.afk) d = 0; }
        else if (o.outcome === 'loss') { d = Math.min(-LOSS_MIN, d) + (o.top ? 3 : 0); d *= o.afk ? 1.5 : LOSS_MULT[tierOf(o.me)]; d = Math.min(-2, d); }
        else d = Math.max(-8, Math.min(8, d));
        return Math.round(d);
    }

    // ---------- емблема рангу (SVG, без зовнішніх файлів) ----------
    function emblem(i, size) {
        const d = DIVS[Math.max(0, Math.min(DIVS.length - 1, i | 0))], T = TIERS[d.t], s = size || 64, id = 'rk' + i + '_' + Math.floor(Math.random() * 1e6);
        const grad = '<defs><linearGradient id="' + id + 'a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + T.c1 + '"/><stop offset="1" stop-color="' + T.c2 + '"/></linearGradient>' +
            '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1226"/><stop offset="1" stop-color="#1c2547"/></linearGradient></defs>';
        let body;
        if (d.t === 'absolute') {
            body = '<path d="M50 4 61 30 90 30 67 48 76 76 50 59 24 76 33 48 10 30 39 30Z" fill="url(#' + id + 'a)" stroke="#fff6" stroke-width="2"/>' +
                '<path d="M8 50 Q2 70 22 88 L30 80 Q16 68 18 54Z M92 50 Q98 70 78 88 L70 80 Q84 68 82 54Z" fill="url(#' + id + 'a)" opacity=".85"/>' +
                '<circle cx="50" cy="44" r="10" fill="url(#' + id + 'b)" stroke="' + T.c1 + '" stroke-width="2.5"/>';
        } else if (d.t === 'titan') {
            body = '<path d="M50 4 88 24 88 66 50 96 12 66 12 24Z" fill="url(#' + id + 'a)" stroke="#fff5" stroke-width="2"/>' +
                '<path d="M50 16 78 31 78 61 50 83 22 61 22 31Z" fill="url(#' + id + 'b)"/>' +
                '<path d="M30 58 36 36 44 50 50 30 56 50 64 36 70 58Z" fill="url(#' + id + 'a)"/>';
        } else {
            const pts = d.t === 'platinum' ? 'M50 4 90 18 86 62 50 96 14 62 10 18Z' : d.t === 'gold' ? 'M50 4 88 16 84 60 50 96 16 60 12 16Z' : 'M50 6 86 18 82 60 50 94 18 60 14 18Z';
            const n = d.sub + 1, chev = [];
            for (let k = 0; k < n; k++) { const y = 62 - k * 13; chev.push('<path d="M30 ' + (y - 6) + ' 50 ' + (y + 4) + ' 70 ' + (y - 6) + ' 70 ' + (y + 1) + ' 50 ' + (y + 11) + ' 30 ' + (y + 1) + 'Z" fill="url(#' + id + 'a)"/>'); }
            body = '<path d="' + pts + '" fill="url(#' + id + 'a)" stroke="#fff5" stroke-width="2"/><path d="M50 15 76 24 73 57 50 82 27 57 24 24Z" fill="url(#' + id + 'b)"/>' +
                '<circle cx="50" cy="32" r="7" fill="url(#' + id + 'a)"/>' + chev.join('');
        }
        return '<svg class="rk-emb" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" aria-hidden="true">' + grad + body + '</svg>';
    }

    return { TIERS, DIVS, RP, TIER_ORDER, LOSS_MULT, SEASON_REWARDS, FORMATS, K, SHIELD, SOFT_RESET, MIN_LEVEL, MIN_MATCHES, MIN_SEASON_GAMES, divOf, tierOf, tierIdx, tierFloor, progress, delta, emblem };
});
