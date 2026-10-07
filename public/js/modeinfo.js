// ===== ІНФОРМАЦІЯ ПРО РЕЖИМИ (спільна для сервера й клієнта) =====
// Єдине джерело правди: список режимів, їхні параметри (межі для сервера й повзунків), підказки та формули нагород.
// Нові режими: оборона бази, рейд на боса, конвой (кооператив); арена хвиль, дуель з босами (соло, 1 гравець);
// королівський бій, захоплення точок, полювання за головою (проти гравців).
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ModeInfo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const MODES = {
        deathmatch:      { e: '⚔️', n: 'ДЕТМАТЧ', sn: 'Детматч', s: 'Кожен сам за себе', kind: 'pvp', c: '59,130,246', d: 'Кожен сам за себе. Збирайте жетони й знищуйте суперників — хто першим набере потрібну кількість, той перемагає.' },
        survival:        { e: '🧟', n: 'ВИЖИВАННЯ', sn: 'Виживання', s: 'Проти орд зомбі', kind: 'coop', c: '16,185,129', d: 'Кооператив проти хвиль зомбі. Тримайтесь разом і протримайтесь якомога довше — з кожною хвилею стає важче.' },
        prophunt:        { e: '📦', n: 'ХОВАНКИ', sn: 'Хованки', s: 'Замаскуйся чи шукай', kind: 'pvp', c: '245,158,11', d: 'Одні маскуються під предмети, інші полюють. Мисливці мають знайти всіх, ті, хто ховається, — дотягнути до кінця часу.' },
        team_deathmatch: { e: '🤝', n: 'КОМАНДНИЙ', sn: 'Командний', s: 'Команда проти команди', kind: 'pvp', c: '168,85,247', d: 'Команди б’ються за очки. Оберіть свою команду у списку гравців та переможіть суперників.' },
        base_defense:    { e: '🏰', n: 'ОБОРОНА БАЗИ', sn: 'Оборона', s: 'Захистіть ядро від орд', kind: 'coop', c: '251,146,60', d: 'Кооператив: орди зомбі штурмують ядро вашої бази. Тримайте оборону навколо нього — якщо ядро впаде, ви програли. Переживіть усі хвилі, щоб перемогти.' },
        boss_raid:       { e: '👹', n: 'РЕЙД НА БОСА', sn: 'Рейд', s: 'Усією командою на одного', kind: 'coop', c: '239,68,68', d: 'Кооператив: спільний бій з одним могутнім босом. Він викликає підмогу й скаженіє, коли лишається половина здоров’я. Перемагайте до кінця часу, поки не закінчились життя.' },
        convoy:          { e: '🚚', n: 'КОНВОЙ', sn: 'Конвой', s: 'Ескорт вантажівки', kind: 'coop', c: '14,165,233', d: 'Кооператив: супроводжуйте броньовану вантажівку з пункту А до пункту Б. Вона їде лише коли поруч свої й немає ворогів. Не дайте знищити її та не запізніться.' },
        solo_arena:      { e: '🌀', n: 'АРЕНА ХВИЛЬ', sn: 'Арена', s: 'Соло з покращеннями', kind: 'solo', c: '236,72,153', d: 'Соло (1 гравець): хвиля за хвилею. Після кожної хвилі обирайте одне з трьох покращень — і стаєте сильнішим. Дійдіть до кінця арени!' },
        boss_duel:       { e: '💀', n: 'ДУЕЛЬ З БОСАМИ', sn: 'Дуель', s: 'Соло проти босів', kind: 'solo', c: '244,63,94', d: 'Соло (1 гравець): один на один з босами по черзі — кожен наступний сильніший. Маєте обмежену кількість життів. Переможіть усіх!' },
        battle_royale:   { e: '🔥', n: 'КОРОЛІВСЬКИЙ БІЙ', sn: 'Королів. бій', s: 'Останній танк виграє', kind: 'pvp', c: '132,204,22', d: 'Кожен сам за себе на звужуваній мапі. Безпечна зона стискається — хто вийшов за її межі, отримує шкоду. Переможе останній танк, що вижив. Відроджень немає.' },
        capture_points:  { e: '🚩', n: 'ЗАХОПЛЕННЯ ТОЧОК', sn: 'Точки', s: 'Контролюй точки', kind: 'pvp', c: '20,184,166', d: 'Команди борються за контрольні точки. Станьте на точку, щоб захопити її: що більше точок утримуєте, то швидше йдуть очки. Вбивства теж додають очки команді.' },
        bounty:          { e: '🎯', n: 'ПОЛЮВАННЯ ЗА ГОЛОВОЮ', sn: 'Ціль', s: 'Знищ ціль — візьми приз', kind: 'pvp', c: '202,138,4', d: 'Кожен сам за себе. Періодично одного з гравців (частіше лідера) позначають як ціль — усі бачать його на мапі. Знищіть ціль — отримаєте нагороду; проживіть ціллю до кінця таймера — заробите ви.' }
    };
    const ORDER = ['survival', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'deathmatch', 'team_deathmatch', 'prophunt', 'battle_royale', 'capture_points', 'bounty'];
    const NEW = ['base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'battle_royale', 'capture_points', 'bounty'];
    const GROUPS = [{ k: 'coop', n: '🤝 Кооператив' }, { k: 'solo', n: '🎯 Соло (1 гравець)' }, { k: 'pvp', n: '⚔️ Проти гравців' }];
    const PVE = ['survival', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel'];
    const SOLO = ['solo_arena', 'boss_duel'];
    const TEAMS = ['team_deathmatch', 'capture_points'];           // командні PvP (команда = колір)
    const NO_COLOR = ['prophunt', 'team_deathmatch', 'capture_points'];   // режими, де замість камуфляжу обирають команду
    const set = a => { const o = {}; a.forEach(x => o[x] = 1); return o; };
    const sPve = set(PVE), sSolo = set(SOLO), sTeams = set(TEAMS), sNoColor = set(NO_COLOR);
    const CO = ['base_defense', 'boss_raid', 'convoy'], ALLPVE = ['base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel'];
    const BOSSES = ['pikus', 'shurik', 'oneshot', 'padlo', 'titan'];
    const BOSS_NAMES = { pikus: 'Пікус', shurik: 'Шурік', oneshot: 'Ваншотус', padlo: 'Падло', titan: 'Титан' };

    // modes: '*' — усі, крім соло (там гравець один); межі min/max використовує й сервер
    const PARAMS = [
        { key: 'maxPlayers', label: 'Макс. гравців', min: 2, max: 10, def: 6, step: 1, modes: '*', desc: 'Скільки гравців може бути в сесії одночасно. У соло-режимах грає лише один гравець.' },
        { key: 'winScore', label: 'Жетони для перемоги', min: 5, max: 1000, def: 50, step: 5, modes: ['deathmatch'], desc: 'Хто першим збере стільки жетонів — виграє. Чим більше жетонів, тим довший бій і більша нагорода.' },
        { key: 'hideTime', label: 'Час на схованку', min: 30, max: 200, def: 30, step: 5, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд ті, хто ховається, мають, щоб замаскуватись, поки мисливці чекають.' },
        { key: 'seekTime', label: 'Час пошуку', min: 120, max: 600, def: 120, step: 10, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд мисливці шукають. Якщо час вийшов — перемагають ті, хто ховався.' },
        { key: 'hunterCount', label: 'Мисливців', min: 1, max: 9, def: 1, step: 1, modes: ['prophunt'], dyn: true, desc: 'Скільки гравців грає мисливцями. Не більше, ніж гравців у сесії мінус один.' },
        { key: 'tdmTeams', label: 'Команд', min: 2, max: 4, def: 2, step: 1, modes: ['team_deathmatch'], desc: 'Скільки команд беруть участь у бою (червоні, сині, зелені, жовті).' },
        { key: 'tdmTime', label: 'Тривалість бою', min: 60, max: 300, def: 180, step: 10, unit: 'с', modes: ['team_deathmatch'], desc: 'Максимальний час бою. Коли час вийде, перемагає команда з більшою кількістю очків.' },
        { key: 'tdmScore', label: 'Очки для перемоги', min: 5, max: 50, def: 20, step: 1, modes: ['team_deathmatch'], desc: 'Команда, яка першою набере стільки очок (за вбивства), перемагає достроково.' },
        { key: 'tdmAutoBalance', label: 'Автобаланс', type: 'toggle', def: true, modes: ['team_deathmatch', 'capture_points'], desc: 'Якщо увімкнено — гру не можна почати, поки склади команд відрізняються більш ніж на одного гравця.' },

        { key: 'pveDiff', label: 'Складність', min: 50, max: 200, def: 100, step: 25, unit: '%', modes: ALLPVE, desc: 'Міцність і шкода ворогів. Вище — важче, але й нагорода більша (50% дає −25% до нагороди, 200% — +50%).' },

        { key: 'bdWaves', label: 'Хвиль до перемоги', min: 5, max: 30, def: 10, step: 1, modes: ['base_defense'], desc: 'Скільки хвиль потрібно відбити. Кожна десята хвиля — бос. Більше хвиль — довша гра й більша нагорода.' },
        { key: 'bdCoreHp', label: 'Міцність ядра', min: 500, max: 5000, def: 2000, step: 250, modes: ['base_defense'], desc: 'Здоров’я ядра бази. Зомбі б’ють по ядру, якщо воно ближче за гравців. Впало ядро — поразка.' },
        { key: 'bdRepair', label: 'Ремонт між хвилями', type: 'toggle', def: true, modes: ['base_defense'], desc: 'Якщо увімкнено — після кожної хвилі ядро відновлює 15% здоров’я.' },

        { key: 'rbBoss', label: 'Бос', type: 'choice', def: 'padlo', options: BOSSES.map(b => ({ v: b, l: BOSS_NAMES[b] })), modes: ['boss_raid'], desc: 'Кого будете бити. Від Пікуса (найлегший) до Титана (найважчий). Здоров’я боса росте разом із кількістю гравців.' },
        { key: 'rbMinions', label: 'Приспішники', type: 'toggle', def: true, modes: ['boss_raid'], desc: 'Якщо увімкнено — бос періодично викликає зомбі собі на допомогу.' },
        { key: 'rbLives', label: 'Життів на гравця', min: 1, max: 5, def: 3, step: 1, modes: ['boss_raid'], desc: 'Скільки разів кожен гравець може відродитися після загибелі. Коли життя закінчились — гравець спостерігає.' },
        { key: 'rbTime', label: 'Час на бій', min: 120, max: 900, def: 420, step: 30, unit: 'с', modes: ['boss_raid'], desc: 'Скільки секунд є на вбивство боса. Не встигли — поразка.' },

        { key: 'cvHp', label: 'Міцність конвою', min: 500, max: 5000, def: 1500, step: 250, modes: ['convoy'], desc: 'Здоров’я вантажівки. Її атакують зомбі, що ближчі до неї, ніж до гравців. Знищили — поразка.' },
        { key: 'cvSpeed', label: 'Швидкість конвою', min: 40, max: 120, def: 70, step: 10, modes: ['convoy'], desc: 'Швидкість вантажівки (пікселів за секунду). Вона рухається лише коли поруч є гравець і немає ворогів.' },
        { key: 'cvTime', label: 'Час на маршрут', min: 180, max: 900, def: 480, step: 30, unit: 'с', modes: ['convoy'], desc: 'За який час потрібно довезти вантаж. Не встигли — поразка.' },

        { key: 'saWaves', label: 'Хвиль до перемоги', min: 5, max: 40, def: 15, step: 1, modes: ['solo_arena'], desc: 'Скільки хвиль потрібно пройти на арені. Після кожної хвилі — вибір покращення.' },
        { key: 'saHeal', label: 'Лікування між хвилями', type: 'toggle', def: true, modes: ['solo_arena'], desc: 'Якщо увімкнено — після кожної хвилі відновлюється 30% здоров’я.' },

        { key: 'duBosses', label: 'Босів', min: 1, max: 5, def: 5, step: 1, modes: ['boss_duel'], desc: 'Скільки босів потрібно перемогти поспіль. Йдуть від найлегшого до найважчого.' },
        { key: 'duLives', label: 'Життів', min: 1, max: 3, def: 2, step: 1, modes: ['boss_duel'], desc: 'Скільки разів можна загинути. Після смерті відроджуєтесь на арені, а бос лишається з поточним здоров’ям.' },
        { key: 'duHeal', label: 'Лікування між босами', type: 'toggle', def: true, modes: ['boss_duel'], desc: 'Якщо увімкнено — після перемоги над босом відновлюється 50% здоров’я.' },

        { key: 'brTime', label: 'Час до фіналу зони', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['battle_royale'], desc: 'За цей час безпечна зона стискається до мінімуму. Менше часу — швидший і агресивніший бій.' },
        { key: 'brDmg', label: 'Шкода зони за секунду', min: 2, max: 10, def: 4, step: 1, unit: '%', modes: ['battle_royale'], desc: 'Скільки відсотків здоров’я щосекунди забирає зона поза безпечним колом (росте з кожною фазою).' },
        { key: 'brLoot', label: 'Бонуси на мапі', type: 'toggle', def: true, modes: ['battle_royale'], desc: 'Якщо увімкнено — бонуси з’являються частіше й у більшій кількості.' },

        { key: 'cpTeams', label: 'Команд', min: 2, max: 4, def: 2, step: 1, modes: ['capture_points'], desc: 'Скільки команд борються за точки (червоні, сині, зелені, жовті).' },
        { key: 'cpPoints', label: 'Контрольних точок', min: 1, max: 5, def: 3, step: 1, modes: ['capture_points'], desc: 'Кількість точок, які треба захоплювати. Мапа має бути достатньо великою.' },
        { key: 'cpScore', label: 'Очки для перемоги', min: 100, max: 1000, def: 300, step: 50, modes: ['capture_points'], desc: 'Команда, яка першою набере стільки очок, перемагає. Очки йдуть за утримання точок і за вбивства.' },
        { key: 'cpTime', label: 'Тривалість бою', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['capture_points'], desc: 'Максимальний час бою. Коли час вийде, перемагає команда з більшою кількістю очків (рівні — нічия).' },

        { key: 'bnScore', label: 'Очки для перемоги', min: 10, max: 100, def: 30, step: 5, modes: ['bounty'], desc: 'Хто першим набере стільки очок, перемагає. Вбивство — 1 очко, ціль — набагато більше.' },
        { key: 'bnTime', label: 'Тривалість бою', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['bounty'], desc: 'Максимальний час бою. Коли час вийде, перемагає гравець з найбільшою кількістю очок (рівні — нічия).' },
        { key: 'bnInterval', label: 'Зміна цілі', min: 20, max: 90, def: 40, step: 5, unit: 'с', modes: ['bounty'], desc: 'Скільки секунд тримається позначка цілі. Хто прожив цим часом — отримує бонусні очки.' }
    ];
    const BYKEY = {}; PARAMS.forEach(p => BYKEY[p.key] = p);

    const isPve = m => !!sPve[m], isSolo = m => !!sSolo[m], isTeamPvp = m => !!sTeams[m], usesColor = m => !sNoColor[m];
    const minPlayers = m => isSolo(m) ? 1 : 2;
    function paramOn(p, mode) { return p.modes === '*' ? !isSolo(mode) : p.modes.indexOf(mode) >= 0; }
    // Правило сумісності мап: нові режими успадковують дозвіл базових (поле modes у редакторі мап містить лише 4 базові режими)
    const MAP_ALIAS = { base_defense: 'survival', boss_raid: 'survival', convoy: 'survival', solo_arena: 'survival', boss_duel: 'survival', battle_royale: 'deathmatch', bounty: 'deathmatch', capture_points: 'team_deathmatch' };

    // ----- ФОРМУЛИ НАГОРОД (💵) -----
    // outcome: 'win' | 'loss' | 'draw'. r — налаштування сесії. c — підсумки матчу:
    //  waves — відбито хвиль, frac — частка (0..1: збита частка здоров’я боса / пройдена частина маршруту / лишок здоров’я вантажівки),
    //  killed — переможено босів, n — гравців, place — місце (1 = переможець), kills — вбивства, caps — захоплення точок, bk — вбивства цілі
    function dm(r) { const d = r && r.pveDiff != null ? +r.pveDiff : 100; return 0.5 + Math.max(50, Math.min(200, d)) / 200; }   // 0.75 … 1.5
    function reward(mode, r, outcome, c) {
        r = r || {}; c = c || {}; const v = k => (r[k] != null ? +r[k] : BYKEY[k].def), n = Math.max(1, c.n || 1), kills = c.kills || 0, frac = Math.max(0, Math.min(1, c.frac || 0));
        let a = 0;
        switch (mode) {
            case 'base_defense': a = outcome === 'win' ? (14 + 1.6 * v('bdWaves')) * dm(r) : Math.max(1, (c.waves || 0) * 1.2 * dm(r)); break;
            case 'boss_raid': { const t = Math.max(1, BOSSES.indexOf(r.rbBoss || BYKEY.rbBoss.def) + 1); a = outcome === 'win' ? (16 + 7 * t) * dm(r) : Math.max(1, 4 * t * frac * dm(r)); break; }
            case 'convoy': a = outcome === 'win' ? (16 + 14 * frac) * dm(r) : Math.max(1, 10 * frac * dm(r)); break;
            case 'solo_arena': a = outcome === 'win' ? (12 + 1.4 * v('saWaves')) * dm(r) : Math.max(1, (c.waves || 0) * 0.9 * dm(r)); break;
            case 'boss_duel': { const B = v('duBosses'); a = outcome === 'win' ? (18 + 9 * B) * dm(r) * (v('duLives') === 1 ? 1.25 : 1) : Math.max(1, 5 * (c.killed || 0) * dm(r)); break; }
            case 'battle_royale': a = outcome === 'win' ? 16 + 3 * n + 2 * kills : outcome === 'draw' ? (16 + 3 * n) / 2 + 2 * kills : 2 + 9 * (n - (c.place || n)) / Math.max(1, n - 1) + 2 * kills; break;
            case 'capture_points': a = (outcome === 'win' ? 22 : outcome === 'draw' ? 11 : 5) + Math.min(10, c.caps || 0); break;
            case 'bounty': { const pl = c.place || n; a = outcome === 'draw' ? 12 : (pl === 1 ? 20 : pl === 2 ? 9 : pl === 3 ? 6 : 3); a += Math.min(15, kills) + 2 * Math.min(5, c.bk || 0); break; }
            default: a = 0;
        }
        return Math.max(1, Math.round(a));
    }
    // Орієнтовний діапазон для підказки в лобі: [поразка, перемога]
    function rewardRange(mode, r) {
        const n = Math.max(2, r && r.maxPlayers || 6);
        const lo = reward(mode, r, 'loss', { waves: 3, frac: 0.3, killed: 1, n, place: n, kills: 0, caps: 0 }), hi = reward(mode, r, 'win', { frac: 1, n, place: 1, kills: 0, caps: 0 });
        return { loss: lo, win: hi, draw: (mode === 'battle_royale' || mode === 'capture_points' || mode === 'bounty') ? reward(mode, r, 'draw', { n, kills: 0 }) : null };
    }

    // Покращення для «Арени хвиль» (обирає гравець після кожної хвилі)
    const PERKS = {
        dmg:   { e: '🔫', n: 'Сила вогню', d: '+15% шкоди', max: 5 },
        rate:  { e: '⚡', n: 'Скорострільність', d: '−10% перезарядки', max: 4 },
        spd:   { e: '💨', n: 'Швидкість', d: '+8% швидкості руху', max: 4 },
        armor: { e: '🛡️', n: 'Броня', d: '−10% отриманої шкоди', max: 5 },
        regen: { e: '🩹', n: 'Ремонт', d: '+3 HP за секунду', max: 5 },
        vamp:  { e: '🧛', n: 'Вампіризм', d: '+4 HP за вбитого ворога', max: 5 },
        crit:  { e: '🎯', n: 'Критичний удар', d: '+12% шансу подвійної шкоди', max: 4 },
        heal:  { e: '❤️', n: 'Аптечка', d: 'Миттєво лікує 60% здоров’я', max: 99 }
    };

    return { PERKS, MODES, ORDER, NEW, GROUPS, PVE, SOLO, PARAMS, BYKEY, BOSSES, BOSS_NAMES, MAP_ALIAS, isPve, isSolo, isTeamPvp, usesColor, minPlayers, paramOn, reward, rewardRange };
});
