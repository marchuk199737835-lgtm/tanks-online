// Намальовані SVG-іконки режимів (64×64). Градієнти — в одному прихованому <svg> (ModeIcons.defs()), щоб не дублювати id.
window.ModeIcons = (function () {
    const C = {
        survival: '16,185,129', base_defense: '251,146,60', boss_raid: '239,68,68', convoy: '14,165,233', solo_arena: '236,72,153', boss_duel: '244,63,94',
        deathmatch: '59,130,246', team_deathmatch: '168,85,247', prophunt: '245,158,11', battle_royale: '132,204,22', capture_points: '20,184,166', bounty: '202,138,4', rounds: '244,114,182', gladiators: '234,179,8'
    };
    const lite = c => c.split(',').map(x => Math.round(+x + (255 - x) * 0.55)).join(',');
    const dark = c => c.split(',').map(x => Math.round(x * 0.45)).join(',');
    const G = k => 'url(#mi-' + k + ')', S = 'stroke="rgba(2,6,23,.55)" stroke-width="1.6" stroke-linejoin="round"';
    const D = k => 'rgb(' + dark(C[k]) + ')';
    const P = {
        survival: k => `<ellipse cx="32" cy="55" rx="22" ry="5" fill="${D(k)}"/><circle cx="14" cy="52" r="2" fill="${D(k)}"/><circle cx="51" cy="51" r="1.6" fill="${D(k)}"/>
            <path d="M26 55 L26.5 36 L20 29.5 Q18.5 27.5 20.5 26 Q22.5 24.8 24.3 26.6 L28.5 30.5 L29 21.5 Q29.2 18.6 31.6 18.6 Q34 18.6 34.1 21.4 L34.4 28.4 L36.6 17.6 Q37.2 15.2 39.6 15.7 Q41.8 16.3 41.3 18.8 L39.6 29.5 L43 23 Q44.2 21 46.2 22 Q48 23.1 47 25.2 L42.2 37.5 Q40.5 43.5 38.5 46 L38.5 55 Z" fill="${G(k)}" ${S}/>
            <path d="M30 40 L33 43 M34.5 37 L36.5 40" stroke="${D(k)}" stroke-width="1.6" stroke-linecap="round"/>`,
        base_defense: k => `<path d="M16 56 V26 H21 V19 H26.5 V26 H29.5 V19 H34.5 V26 H37.5 V19 H43 V26 H48 V56 Z" fill="${G(k)}" ${S}/>
            <path d="M16 31 H48" stroke="${D(k)}" stroke-width="1.4" opacity=".6"/><path d="M27 56 V47 Q32 41 37 47 V56 Z" fill="${D(k)}"/>
            <path d="M32 27.5 L37.5 35 L32 42.5 L26.5 35 Z" fill="#e0f2fe" stroke="#38bdf8" stroke-width="1.6"/><path d="M32 27.5 L32 42.5 M26.5 35 H37.5" stroke="#7dd3fc" stroke-width="1"/>`,
        boss_raid: k => `<path d="M13 12 Q14 27 24 31 L22.5 24 Q17 20 13 12 Z M51 12 Q50 27 40 31 L41.5 24 Q47 20 51 12 Z" fill="#fef3c7" ${S}/>
            <path d="M19.5 31 Q19.5 18 32 18 Q44.5 18 44.5 31 Q44.5 40.5 40 44.5 L40 51 L24 51 L24 44.5 Q19.5 40.5 19.5 31 Z" fill="${G(k)}" ${S}/>
            <path d="M23.5 30.5 L30.5 33 L28.5 36.8 L23.8 34.4 Z M40.5 30.5 L33.5 33 L35.5 36.8 L40.2 34.4 Z" fill="#fde047"/>
            <path d="M28 46 V51 M32 45.5 V51 M36 46 V51" stroke="${D(k)}" stroke-width="1.6"/><path d="M30.4 39 L32 41.5 L33.6 39 Z" fill="${D(k)}"/>`,
        convoy: k => `<rect x="7" y="19" width="31" height="23" rx="3" fill="${G(k)}" ${S}/><path d="M12 25 H33 M12 30.5 H33 M12 36 H33" stroke="${D(k)}" stroke-width="1.4" opacity=".55"/>
            <path d="M38 27 H48.5 L55 35.5 V42 H38 Z" fill="${G(k)}" ${S}/><path d="M41 30 H47 L51 35.5 H41 Z" fill="#e0f2fe"/>
            <g fill="#0f172a" stroke="${D(k)}" stroke-width="1.5"><circle cx="16" cy="44" r="5"/><circle cx="29" cy="44" r="5"/><circle cx="47" cy="44" r="5"/></g><g fill="#94a3b8"><circle cx="16" cy="44" r="1.7"/><circle cx="29" cy="44" r="1.7"/><circle cx="47" cy="44" r="1.7"/></g>`,
        solo_arena: k => `<circle cx="32" cy="32" r="24" fill="none" stroke="${D(k)}" stroke-width="2" stroke-dasharray="3 4"/>
            <path d="M32 32 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 0 1 8 -8 a12 12 0 0 1 12 12 a16 16 0 0 1 -16 16 a20 20 0 0 1 -20 -20" fill="none" stroke="${G(k)}" stroke-width="5" stroke-linecap="round"/>
            <path d="M49 11 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z M13 46 l1.1 2.4 2.4 1.1 -2.4 1.1 -1.1 2.4 -1.1 -2.4 -2.4 -1.1 2.4 -1.1 Z" fill="#fdf2f8"/>`,
        boss_duel: k => `<g stroke-linecap="round"><path d="M10 54 L46 18" stroke="#cbd5e1" stroke-width="3.6"/><path d="M54 54 L18 18" stroke="#cbd5e1" stroke-width="3.6"/><path d="M8 48 L16 56 M56 48 L48 56" stroke="${D(k)}" stroke-width="4"/></g>
            <path d="M19.5 29 Q19.5 14 32 14 Q44.5 14 44.5 29 Q44.5 36.5 40.5 39.5 V46 H23.5 V39.5 Q19.5 36.5 19.5 29 Z" fill="${G(k)}" ${S}/>
            <circle cx="26.6" cy="29" r="4.3" fill="#0f172a"/><circle cx="37.4" cy="29" r="4.3" fill="#0f172a"/><circle cx="27.4" cy="28.2" r="1.2" fill="#fecdd3"/><circle cx="38.2" cy="28.2" r="1.2" fill="#fecdd3"/>
            <path d="M30.5 35.5 L32 33 L33.5 35.5 Z" fill="#0f172a"/><path d="M28 41.5 V46 M32 41.5 V46 M36 41.5 V46" stroke="${D(k)}" stroke-width="1.5"/>`,
        deathmatch: k => { const sw = `<path d="M11 11 L17 11 L46 40 L40 46 L11 17 Z" fill="${G(k)}" ${S}/><path d="M14 14 L43 43" stroke="#fff" stroke-width="1" opacity=".55"/><path d="M36.5 49.5 L49.5 36.5 L52.5 39.5 L39.5 52.5 Z" fill="#fbbf24" ${S}/><path d="M45.5 49.5 L49.5 45.5 L55.5 51.5 L51.5 55.5 Z" fill="${D(k)}" ${S}/>`;
            return sw + '<g transform="matrix(-1 0 0 1 64 0)">' + sw + '</g>'; },
        team_deathmatch: k => `<path d="M9 15 L25 11 L41 15 V29 Q41 43 25 51 Q9 43 9 29 Z" fill="rgb(${dark(C[k])})" ${S} opacity=".95"/>
            <path d="M23 19 L39 15 L55 19 V33 Q55 47 39 55 Q23 47 23 33 Z" fill="${G(k)}" ${S}/>
            <path d="M39 24 L41.6 30.2 L48.2 30.6 L43.1 34.8 L44.8 41.3 L39 37.6 L33.2 41.3 L34.9 34.8 L29.8 30.6 L36.4 30.2 Z" fill="#faf5ff"/>`,
        prophunt: k => `<rect x="11" y="17" width="42" height="38" rx="3" fill="${G(k)}" ${S}/><path d="M11 26 H53 M11 46 H53" stroke="${D(k)}" stroke-width="1.6" opacity=".7"/>
            <path d="M14 20 L50 52 M50 20 L14 52" stroke="${D(k)}" stroke-width="1.4" opacity=".35"/>
            <path d="M18 36 Q32 25 46 36 Q32 47 18 36 Z" fill="#fffbeb" ${S}/><circle cx="32" cy="36" r="5.6" fill="#0f172a"/><circle cx="33.8" cy="34.2" r="1.7" fill="#fff"/>`,
        battle_royale: k => `<circle cx="32" cy="33" r="25" fill="none" stroke="${D(k)}" stroke-width="2.2" stroke-dasharray="5 4"/>
            <path d="M32 9 Q43 22 41 32 Q45 29 45 24 Q54 37 46 48 Q40 55 32 55 Q21 55 18 46 Q15 37 21.5 29 Q21.5 35.5 26 37.5 Q21.5 23 32 9 Z" fill="${G(k)}" ${S}/>
            <path d="M32 30 Q38 37 37 43 Q39.5 41.5 40 39 Q43 46 38.5 50.5 Q35.5 53 32 53 Q26 53 25 48 Q24 43 28 39.5 Q28.5 43 30.5 43.5 Q28.5 36 32 30 Z" fill="#fef9c3"/>`,
        capture_points: k => `<ellipse cx="32" cy="51" rx="21" ry="6.5" fill="rgba(${C[k]},.25)" stroke="${G(k)}" stroke-width="2.2"/><ellipse cx="32" cy="51" rx="11" ry="3.4" fill="none" stroke="${D(k)}" stroke-width="1.4"/>
            <path d="M24 51 V9" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round"/>
            <path d="M25.5 11 Q34 7 40 12 Q46 17 53 13 V30 Q46 34 40 29 Q34 24 25.5 28 Z" fill="${G(k)}" ${S}/>`,
        bounty: k => `<circle cx="32" cy="32" r="21" fill="none" stroke="${G(k)}" stroke-width="4.2"/><circle cx="32" cy="32" r="11" fill="rgba(${C[k]},.18)" stroke="${G(k)}" stroke-width="2.4"/>
            <path d="M32 5 V17 M32 47 V59 M5 32 H17 M47 32 H59" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="32" r="3.6" fill="#ef4444" stroke="#fff" stroke-width="1"/>`,
        rounds: k => `<rect x="27.5" y="7" width="9" height="6" rx="1.6" fill="#e2e8f0" ${S}/><path d="M47 16 L51 12" stroke="#e2e8f0" stroke-width="3.4" stroke-linecap="round"/>
            <circle cx="32" cy="36" r="21" fill="${G(k)}" ${S}/><circle cx="32" cy="36" r="16.5" fill="#1e1b2e"/>
            <path d="M32 36 L32 19.5 A16.5 16.5 0 0 1 46.3 44.3 Z" fill="rgba(${C[k]},.75)"/><path d="M32 36 L32 23" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="32" cy="36" r="2.6" fill="#fff"/>`,
        gladiators: k => `<path d="M16 25 Q22 1 49 10 Q52 15 48 19 Q40 12.5 32 14.5 Q23 17 16 25 Z" fill="#ef4444" ${S}/><path d="M20 19 Q27 6 45 11 M23 21 Q30 11 46 15" stroke="#fca5a5" stroke-width="1.2" fill="none"/>
            <path d="M15 41 Q15 18 32 16 Q49 18 49 41 L49 51 Q41 56 32 56 Q23 56 15 51 Z" fill="${G(k)}" ${S}/>
            <path d="M20 31 H44 V35 H20 Z" fill="#1c1917"/><path d="M26 38 V52 M30 38 V54 M34 38 V54 M38 38 V52" stroke="#1c1917" stroke-width="2.2" stroke-linecap="round"/>
            <path d="M32 16 V30" stroke="#fef9c3" stroke-width="1.4" opacity=".7"/>`
    };
    function defs() {
        return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + Object.keys(C).map(k =>
            '<linearGradient id="mi-' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgb(' + lite(C[k]) + ')"/><stop offset="1" stop-color="rgb(' + C[k] + ')"/></linearGradient>').join('') + '</defs></svg>';
    }
    function svg(k) { const f = P[k]; return f ? '<svg class="mi" viewBox="0 0 64 64" aria-hidden="true">' + f(k) + '</svg>' : ''; }
    return { svg, defs, color: k => C[k] || '148,163,184' };
})();
