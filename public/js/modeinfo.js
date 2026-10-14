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
        battle_royale:   { e: '🔥', n: 'КОРОЛІВСЬКИЙ БІЙ', sn: 'Королів. бій', s: 'Останній танк виграє', kind: 'pvp', c: '132,204,22', d: 'Кожен сам за себе на звужуваній мапі. Усі стартують без модулів — їх треба знаходити на мапі: що довше триває бій, то кращі модулі (епічні → легендарні). Аірдропи скидають міфічні та легендарні модулі, а у фіналі міфічні лежать у центрі зони. Безпечна зона стискається — хто вийшов за її межі, отримує шкоду. Переможе останній танк. Відроджень немає.' },
        capture_points:  { e: '🚩', n: 'ЗАХОПЛЕННЯ ТОЧОК', sn: 'Точки', s: 'Контролюй точки', kind: 'pvp', c: '20,184,166', d: 'Команди борються за контрольні точки. Станьте на точку, щоб захопити її: що більше точок утримуєте, то швидше йдуть очки. Вбивства теж додають очки команді.' },
        bounty:          { e: '🎯', n: 'ПОЛЮВАННЯ ЗА ГОЛОВОЮ', sn: 'Ціль', s: 'Знищ ціль — візьми приз', kind: 'pvp', c: '202,138,4', d: 'Кожен сам за себе. Періодично одного з гравців (частіше лідера) позначають як ціль — усі бачать його на мапі. Знищіть ціль — отримаєте нагороду; проживіть ціллю до кінця таймера — заробите ви.' },
        rounds:          { e: '⏱️', n: 'РАУНДИ', sn: 'Раунди', s: 'Без відродження до кінця раунду', kind: 'pvp', c: '244,114,182', d: 'Команда проти команди по раундах. Знищений танк не відроджується до кінця раунду — раунд виграє команда, яка знищила всіх суперників (або має більше живих, коли вийде час). Перед кожним раундом — 4 секунди підготовки. Перемагає команда з більшою кількістю виграних раундів; за рівного рахунку — додаткові раунди або нічия (якщо її дозволено).' },
        // «Гладіатори» (gladiators.js): Форум між раундами, кожен — у своєму Колізеї проти зомбі, кожен 3-й раунд — дуель зі ставками
        gladiators:      { e: '🏛️', n: 'ГЛАДІАТОРИ', sn: 'Гладіатори', s: 'Зомбі, дуелі й ставки', kind: 'pvp', c: '234,179,8', isNew: true, players: '2–10',
            d: 'У кожного 3 життя. Між раундами всі збираються на Форумі: там магазин бафів (швидкість, шкода, здоров’я) і кейси з модулями. У звичайних раундах кожен б’ється сам у своєму Колізеї проти хвилі зомбі, заробляє поінти й прокачується. Кожен 2-й раунд — вибір 1 з 3 модулів. Кожен 3-й раунд випадкова пара б’ється в дуелі, решта — проти зомбі й ставить поінти на переможця. Раундів скільки завгодно — грає до останнього вцілілого.',
            fixedMaps: [{ n: 'Forum', t: 'Форум', d: 'Спільна мапа між раундами: магазин, табло ставок, очікування.' }, { n: 'Colosseum', t: 'Колізей', d: 'У кожного гравця своя арена проти хвилі зомбі.' }, { n: 'Duelist Pit', t: 'Яма дуелянтів', d: 'Дуель 1 на 1 до першого знищення — кожен 3-й раунд.' }] }
    };
    const ORDER = ['survival', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'gladiators', 'deathmatch', 'team_deathmatch', 'prophunt', 'battle_royale', 'capture_points', 'bounty', 'rounds'];
    const NEW = ['base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'battle_royale', 'capture_points', 'bounty', 'rounds'];
    const GROUPS = [{ k: 'coop', n: '🤝 Кооператив' }, { k: 'solo', n: '🎯 Соло (1 гравець)' }, { k: 'pvp', n: '⚔️ Проти гравців' }];
    const PVE = ['survival', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel', 'gl_arena'];      // gl_arena — службова арена «Гладіаторів» (у списку режимів її немає)
    const SOLO = ['solo_arena', 'boss_duel'];
    const TEAMS = ['team_deathmatch', 'capture_points', 'rounds'];           // командні PvP (команда = колір)
    const NO_COLOR = ['prophunt', 'team_deathmatch', 'capture_points', 'rounds'];   // режими, де замість камуфляжу обирають команду
    const set = a => { const o = {}; a.forEach(x => o[x] = 1); return o; };
    const sPve = set(PVE), sSolo = set(SOLO), sTeams = set(TEAMS), sNoColor = set(NO_COLOR);
    const CO = ['base_defense', 'boss_raid', 'convoy'], ALLPVE = ['survival', 'base_defense', 'boss_raid', 'convoy', 'solo_arena', 'boss_duel'];
    // життя: '1'…'5' або 'inf' (безліч відроджень). Менше життів — важче, але нагорода більша
    const LIVES = v => ({ v: v, l: v === 'inf' ? '∞' : v });
    const BOSSES = ['pikus', 'shurik', 'oneshot', 'padlo', 'titan'];
    const BOSS_NAMES = { pikus: 'Пікус', shurik: 'Шурік', oneshot: 'Ваншотус', padlo: 'Падло', titan: 'Титан' };

    // modes: '*' — усі, крім соло (там гравець один); межі min/max використовує й сервер
    const PARAMS = [
        { key: 'maxPlayers', label: 'Макс. гравців', min: 2, max: 10, def: 6, step: 1, modes: '*', desc: 'Скільки гравців може бути в сесії одночасно. У соло-режимах грає лише один гравець.' },
        { key: 'winScore', label: 'Жетони для перемоги', min: 5, max: 50, def: 50, step: 5, modes: ['deathmatch'], desc: 'Хто першим збере стільки жетонів — виграє. Чим більше жетонів, тим довший бій і більша нагорода. Якщо час вийде раніше — нагорода пропорційна зібраним жетонам.' },
        { key: 'dmTime', label: 'Тривалість бою', min: 180, max: 900, def: 480, step: 30, unit: 'с', modes: ['deathmatch'], desc: 'Максимальний час бою. Коли час вийде, перемагає гравець з найбільшою кількістю жетонів (рівні — більше вбивств). Остання хвилина — «Фінал»: жетони ×2 і зона, що стискається.' },
        { key: 'hideTime', label: 'Час на схованку', min: 30, max: 200, def: 30, step: 5, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд ті, хто ховається, мають, щоб замаскуватись, поки мисливці чекають.' },
        { key: 'seekTime', label: 'Час пошуку', min: 120, max: 600, def: 120, step: 10, unit: 'с', modes: ['prophunt'], desc: 'Скільки секунд мисливці шукають. Якщо час вийшов — перемагають ті, хто ховався.' },
        { key: 'hunterCount', label: 'Мисливців', min: 1, max: 9, def: 1, step: 1, modes: ['prophunt'], dyn: true, desc: 'Скільки гравців грає мисливцями. Не більше, ніж гравців у сесії мінус один.' },
        { key: 'tdmTeams', label: 'Команд', min: 2, max: 4, def: 2, step: 1, modes: ['team_deathmatch'], desc: 'Скільки команд беруть участь у бою (червоні, сині, зелені, жовті).' },
        { key: 'tdmTime', label: 'Тривалість бою', min: 60, max: 300, def: 180, step: 10, unit: 'с', modes: ['team_deathmatch'], desc: 'Максимальний час бою. Коли час вийде, перемагає команда з більшою кількістю очків.' },
        { key: 'tdmScore', label: 'Очки для перемоги', min: 5, max: 50, def: 20, step: 1, modes: ['team_deathmatch'], desc: 'Команда, яка першою набере стільки очок (за вбивства), перемагає достроково.' },
        { key: 'mapEvents', label: 'Події на мапі', type: 'toggle', def: true, modes: ['deathmatch', 'team_deathmatch', 'bounty', 'capture_points'], desc: 'Раз на 1–2 хвилини на мапі стається подія: артилерійський удар (тікай із червоної зони), дрон скидає скриньки з бонусами або на 20 секунд опускається туман.' },
        { key: 'tdmAutoBalance', label: 'Автобаланс', type: 'toggle', def: true, modes: ['team_deathmatch', 'capture_points', 'rounds'], desc: 'Якщо увімкнено — гру не можна почати, поки склади команд відрізняються більш ніж на одного гравця.' },

        { key: 'pveDiff', label: 'Складність', min: 50, max: 200, def: 100, step: 25, unit: '%', modes: ALLPVE, desc: 'Міцність і шкода ворогів. Вище — важче, але й нагорода більша (50% дає −25% до нагороди, 200% — +50%).' },
        { key: 'svLives', label: 'Життів на гравця', type: 'choice', def: '1', options: ['1', '2', '3'].map(LIVES), modes: ['survival'], desc: 'Скільки разів кожен гравець може загинути. Після загибелі відроджуєтесь через 6 с біля живого союзника. 1 — класичне виживання й найбільша нагорода.' },
        { key: 'bdLives', label: 'Життів на гравця', type: 'choice', def: 'inf', options: ['1', '2', '3', '5', 'inf'].map(LIVES), modes: ['base_defense'], desc: 'Скільки разів кожен гравець може відродитися біля ядра. ∞ — без обмежень. Менше життів — важче, але нагорода більша.' },
        { key: 'cvLives', label: 'Життів на гравця', type: 'choice', def: 'inf', options: ['1', '2', '3', '5', 'inf'].map(LIVES), modes: ['convoy'], desc: 'Скільки разів кожен гравець може відродитися біля конвою. ∞ — без обмежень. Якщо всі вибули — поразка. Менше життів — більша нагорода.' },

        { key: 'bdWaves', label: 'Хвиль до перемоги', min: 5, max: 30, def: 10, step: 1, modes: ['base_defense'], desc: 'Скільки хвиль потрібно відбити. Кожна десята хвиля — бос. Більше хвиль — довша гра й більша нагорода.' },
        { key: 'bdCoreHp', label: 'Міцність ядра', min: 500, max: 5000, def: 2000, step: 250, modes: ['base_defense'], desc: 'Здоров’я ядра бази. Зомбі б’ють по ядру, якщо воно ближче за гравців. Впало ядро — поразка. Слабше ядро — більша нагорода (500 — +25%, 5000 — −15%).' },
        { key: 'bdRepair', label: 'Ремонт між хвилями', type: 'toggle', def: true, modes: ['base_defense'], desc: 'Якщо увімкнено — після кожної хвилі ядро відновлює 15% здоров’я. Без ремонту нагорода +15%.' },

        { key: 'rbBoss', label: 'Бос', type: 'choice', def: 'padlo', options: BOSSES.map(b => ({ v: b, l: BOSS_NAMES[b] })), modes: ['boss_raid'], desc: 'Кого будете бити. Від Пікуса (найлегший) до Титана (найважчий). Здоров’я боса росте разом із кількістю гравців.' },
        { key: 'rbMinions', label: 'Приспішники', type: 'toggle', def: true, modes: ['boss_raid'], desc: 'Якщо увімкнено — бос періодично викликає зомбі собі на допомогу.' },
        { key: 'rbLives', label: 'Життів на гравця', min: 1, max: 5, def: 3, step: 1, modes: ['boss_raid'], desc: 'Скільки разів кожен гравець може відродитися після загибелі. Коли життя закінчились — гравець спостерігає.' },
        { key: 'rbTime', label: 'Час на бій', min: 120, max: 900, def: 420, step: 30, unit: 'с', modes: ['boss_raid'], desc: 'Скільки секунд є на вбивство боса. Не встигли — поразка. Менше часу — більша нагорода.' },

        { key: 'cvHp', label: 'Міцність конвою', min: 500, max: 5000, def: 1500, step: 250, modes: ['convoy'], desc: 'Здоров’я вантажівки. Її атакують зомбі, що ближчі до неї, ніж до гравців. Знищили — поразка. Слабша вантажівка — більша нагорода (500 — +25%, 5000 — −15%).' },
        { key: 'cvSpeed', label: 'Швидкість конвою', min: 40, max: 120, def: 70, step: 10, modes: ['convoy'], desc: 'Швидкість вантажівки (пікселів за секунду). Вона рухається лише коли поруч є гравець і немає ворогів. Швидший конвой важче прикривати: 120 — +12% до нагороди, 40 — −7%.' },
        { key: 'cvTime', label: 'Час на маршрут', min: 180, max: 900, def: 480, step: 30, unit: 'с', modes: ['convoy'], desc: 'За який час потрібно довезти вантаж. Не встигли — поразка. Менше часу — більша нагорода (3 хв — +20%, 15 хв — −10%).' },

        { key: 'saWaves', label: 'Хвиль до перемоги', min: 5, max: 40, def: 15, step: 1, modes: ['solo_arena'], desc: 'Скільки хвиль потрібно пройти на арені. Після кожної хвилі — вибір покращення.' },
        { key: 'saHeal', label: 'Лікування між хвилями', type: 'toggle', def: true, modes: ['solo_arena'], desc: 'Якщо увімкнено — після кожної хвилі відновлюється 30% здоров’я. Без лікування нагорода +20%.' },

        { key: 'duBosses', label: 'Босів', min: 1, max: 5, def: 5, step: 1, modes: ['boss_duel'], desc: 'Скільки босів потрібно перемогти поспіль. Йдуть від найлегшого до найважчого.' },
        { key: 'duLives', label: 'Життів', min: 1, max: 3, def: 2, step: 1, modes: ['boss_duel'], desc: 'Скільки разів можна загинути. Після смерті відроджуєтесь на арені, а бос лишається з поточним здоров’ям.' },
        { key: 'duHeal', label: 'Лікування між босами', type: 'toggle', def: true, modes: ['boss_duel'], desc: 'Якщо увімкнено — після перемоги над босом відновлюється 50% здоров’я.' },

        { key: 'brTime', label: 'Час до фіналу зони', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['battle_royale'], desc: 'За цей час безпечна зона стискається до мінімуму. Менше часу — швидший і агресивніший бій.' },
        { key: 'brDmg', label: 'Шкода зони за секунду', min: 2, max: 10, def: 4, step: 1, unit: '%', modes: ['battle_royale'], desc: 'Скільки відсотків здоров’я щосекунди забирає зона поза безпечним колом (росте з кожною фазою).' },
        { key: 'brLoot', label: 'Модулі на мапі', type: 'toggle', def: true, modes: ['battle_royale'], desc: 'Якщо увімкнено — модулів на мапі удвічі більше (ліміт залежить від розміру мапи). Бафи в цьому режимі не з’являються.' },

        { key: 'cpTeams', label: 'Команд', min: 2, max: 4, def: 2, step: 1, modes: ['capture_points'], desc: 'Скільки команд борються за точки (червоні, сині, зелені, жовті).' },
        { key: 'cpPoints', label: 'Контрольних точок', min: 1, max: 5, def: 3, step: 1, modes: ['capture_points'], desc: 'Кількість точок, які треба захоплювати. Мапа має бути достатньо великою.' },
        { key: 'cpScore', label: 'Очки для перемоги', min: 100, max: 1000, def: 300, step: 50, modes: ['capture_points'], desc: 'Команда, яка першою набере стільки очок, перемагає. Очки йдуть за утримання точок і за вбивства.' },
        { key: 'cpTime', label: 'Тривалість бою', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['capture_points'], desc: 'Максимальний час бою. Коли час вийде, перемагає команда з більшою кількістю очків (рівні — нічия).' },

        { key: 'bnScore', label: 'Очки для перемоги', min: 10, max: 100, def: 30, step: 5, modes: ['bounty'], desc: 'Хто першим набере стільки очок, перемагає. Вбивство — 1 очко, ціль — набагато більше.' },
        { key: 'bnTime', label: 'Тривалість бою', min: 120, max: 600, def: 300, step: 30, unit: 'с', modes: ['bounty'], desc: 'Максимальний час бою. Коли час вийде, перемагає гравець з найбільшою кількістю очок (рівні — нічия).' },
        { key: 'bnInterval', label: 'Зміна цілі', min: 20, max: 90, def: 40, step: 5, unit: 'с', modes: ['bounty'], desc: 'Скільки секунд тримається позначка цілі. Хто прожив цим часом — отримує бонусні очки.' },

        { key: 'rdRounds', label: 'Раундів', min: 2, max: 12, def: 6, step: 1, modes: ['rounds'], desc: 'Скільки раундів у матчі. Якщо одна команда вже не може наздогнати іншу — матч закінчується достроково. Більше раундів — довший бій і більша нагорода.' },
        { key: 'rdTime', label: 'Час раунду', min: 60, max: 180, def: 90, step: 10, unit: 'с', modes: ['rounds'], desc: 'Максимальна тривалість одного раунду. Коли час вийде, раунд виграє команда з більшою кількістю живих танків (рівні — більше сумарного здоров’я).' },
        { key: 'rdDraw', label: 'Нічия', type: 'toggle', def: false, modes: ['rounds'], desc: 'Якщо увімкнено — за рівного рахунку після всіх раундів матч закінчується нічиєю. Якщо вимкнено — граються додаткові раунди до першої перемоги.' }
    ];
    const BYKEY = {}; PARAMS.forEach(p => BYKEY[p.key] = p);

    const isPve = m => !!sPve[m], isSolo = m => !!sSolo[m], isTeamPvp = m => !!sTeams[m], usesColor = m => !sNoColor[m];
    const minPlayers = m => isSolo(m) ? 1 : 2;
    function paramOn(p, mode) { return p.modes === '*' ? !isSolo(mode) : p.modes.indexOf(mode) >= 0; }
    // Правило сумісності мап: нові режими успадковують дозвіл базових (поле modes у редакторі мап містить лише 4 базові режими)
    const MAP_ALIAS = { base_defense: 'survival', boss_raid: 'survival', convoy: 'survival', solo_arena: 'survival', boss_duel: 'survival', battle_royale: 'deathmatch', bounty: 'deathmatch', capture_points: 'team_deathmatch', rounds: 'team_deathmatch' };

    // ----- ФОРМУЛИ НАГОРОД (креди) -----
    // outcome: 'win' | 'loss' | 'draw'. r — налаштування сесії. c — підсумки матчу:
    //  waves — відбито хвиль, frac — частка (0..1: збита частка здоров’я боса / пройдена частина маршруту / лишок здоров’я вантажівки),
    //  killed — переможено босів, n — гравців, place — місце (1 = переможець), kills — вбивства, caps — захоплення точок, bk — вбивства цілі
    // ----- МНОЖНИК СКЛАДНОСТІ PvE (усі налаштування, що ускладнюють гру, підвищують нагороду) -----
    // n — гравців на старті матчу: маленькій команді важче (хвилі масштабуються, але не ідеально лінійно) — до +24% соло.
    const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
    const livesN = v => v === 'inf' || v === Infinity || v == null ? Infinity : Math.max(1, parseInt(v) || 1);
    function fLives(v) { const L = livesN(v); return L === Infinity ? 0.85 : ({ 1: 1.3, 2: 1.15, 3: 1.05, 4: 1.0, 5: 0.95 })[Math.min(5, L)]; }
    const fDiff = r => 0.5 + clamp(r && r.pveDiff != null ? +r.pveDiff : 100, 50, 200) / 200;                 // 0.75 … 1.5
    const fTeam = n => n >= 4 ? 1 : 1 + 0.08 * (4 - Math.max(1, n));                                      // 1 → ×1.24, 2 → ×1.16, 3 → ×1.08
    const lerp2 = (x, lo, def, hi, fLo, fHi) => x <= def ? 1 + (fLo - 1) * (def - x) / Math.max(1, def - lo) : 1 + (fHi - 1) * (x - def) / Math.max(1, hi - def);
    function mult(mode, r, n) {
        r = r || {}; const v = k => (r[k] != null ? r[k] : BYKEY[k].def), parts = [];
        const add = (l, f) => { if (Math.abs(f - 1) > 0.004) parts.push([l, Math.round(f * 100) / 100]); return f; };
        let m = add('Складність', fDiff(r));
        switch (mode) {
            case 'survival': m *= add('Життів', fLives(v('svLives'))); break;
            case 'base_defense': m *= add('Міцність ядра', lerp2(+v('bdCoreHp'), 500, 2000, 5000, 1.25, 0.85)); m *= add('Ремонт', v('bdRepair') ? 1 : 1.15); m *= add('Життів', fLives(v('bdLives'))); break;
            case 'convoy': m *= add('Міцність конвою', lerp2(+v('cvHp'), 500, 1500, 5000, 1.25, 0.85)); m *= add('Швидкість', lerp2(+v('cvSpeed'), 40, 70, 120, 0.93, 1.12)); m *= add('Час', lerp2(+v('cvTime'), 180, 480, 900, 1.2, 0.9)); m *= add('Життів', fLives(v('cvLives'))); break;
            case 'boss_raid': m *= add('Життів', fLives(String(v('rbLives')))); m *= add('Час', lerp2(+v('rbTime'), 120, 420, 900, 1.25, 0.9)); m *= add('Приспішники', v('rbMinions') ? 1 : 0.85); break;
            case 'solo_arena': m *= add('Лікування', v('saHeal') ? 1 : 1.2); break;
            case 'boss_duel': m *= add('Життів', ({ 1: 1.25, 2: 1, 3: 0.9 })[+v('duLives')] || 1); m *= add('Лікування', v('duHeal') ? 1 : 1.15); break;
            default: return { m: 1, parts: [] };
        }
        if (!SOLO.includes(mode) && n) m *= add('Гравців у загоні', fTeam(n));
        return { m: clamp(m, 0.5, 3), parts };
    }
    // очки за пережиті хвилі: кожна наступна хвиля цінніша (1.4 + 0.12·w), кожна десята (бос) — ще +4
    function wavePts(W) { W = Math.max(0, W | 0); return 1.4 * W + 0.06 * W * (W + 1) + 4 * Math.floor(W / 10); }
    function reward(mode, r, outcome, c) {
        r = r || {}; c = c || {}; const v = k => (r[k] != null ? +r[k] : BYKEY[k].def), n = Math.max(1, c.n || 1), kills = c.kills || 0, frac = Math.max(0, Math.min(1, c.frac || 0));
        const M = isPve(mode) ? mult(mode, r, n).m : 1;
        let a = 0;
        switch (mode) {
            // виживання завжди закінчується «поразкою» — платимо за кожну пережиту хвилю (пізні хвилі цінніші)
            case 'survival': a = wavePts(c.waves || 0) * M; break;
            // перемога: усі хвилі + бонус 10, ціле ядро до +10%; поразка: пережиті хвилі
            case 'base_defense': a = outcome === 'win' ? (wavePts(v('bdWaves')) + 10) * M * (0.9 + 0.2 * frac) : wavePts(c.waves || 0) * 0.9 * M; break;
            case 'boss_raid': { const t = Math.max(1, BOSSES.indexOf(r.rbBoss || BYKEY.rbBoss.def) + 1); a = outcome === 'win' ? (16 + 7 * t) * M : 4 * t * frac * M; break; }
            // перемога: 24 + до 12 за вцілілу вантажівку; поразка — лише за пройдену частину маршруту (frac = прогрес)
            case 'convoy': a = (outcome === 'win' ? (24 + 12 * frac) * M : 20 * frac * frac * M) * (c.rf || 1); break;      // rf — довжина маршруту (коротка — менше)
            case 'solo_arena': a = outcome === 'win' ? (wavePts(v('saWaves')) * 0.8 + 8) * M : wavePts(c.waves || 0) * 0.75 * M; break;
            case 'boss_duel': { const B = v('duBosses'); a = outcome === 'win' ? (18 + 9 * B) * M : 5 * (c.killed || 0) * M; break; }
            case 'battle_royale': a = outcome === 'win' ? 16 + 3 * n + 2 * kills : outcome === 'draw' ? (16 + 3 * n) / 2 + 2 * kills : 2 + 9 * (n - (c.place || n)) / Math.max(1, n - 1) + 2 * kills; break;
            // класичні режими: нагороди нараховує server.js (collectToken / endPropHuntGame / endTDMGame) — формули дзеркальні, щоб прев'ю й вікно «Гаманець» показували правду
            case 'deathmatch': a = (outcome === 'win' ? 10 : 2) * (1 + Math.max(0, v('winScore') - 5) * 0.10); break;
            case 'prophunt': a = outcome === 'win' ? 15 : 3; break;
            case 'team_deathmatch': a = outcome === 'win' ? 20 : outcome === 'draw' ? 10 : 5; break;
            case 'capture_points': a = (outcome === 'win' ? 22 : outcome === 'draw' ? 11 : 5) + Math.min(10, c.caps || 0); break;
            case 'bounty': { const pl = c.place || n; a = outcome === 'draw' ? 12 : (pl === 1 ? 20 : pl === 2 ? 9 : pl === 3 ? 6 : 3); a += Math.min(15, kills) + 2 * Math.min(5, c.bk || 0); break; }
            // раунди: R — кількість раундів (довший матч → більша нагорода); rw — виграні раунди вашої команди (втіха за поразку), kills — до +8
            //   R=6: перемога 31, нічия 15.5, поразка 8.5 + 1.5 за кожен виграний раунд;  R=12: 46 / 23 / 13+
            case 'rounds': { const R = v('rdRounds'); a = outcome === 'win' ? 16 + 2.5 * R : outcome === 'draw' ? 8 + 1.25 * R : 4 + 0.75 * R + 1.5 * Math.min(R, c.rw || 0); a += Math.min(8, kills); break; }
            // гладіатори: 4 за кожен прожитий раунд; переможцю +12 і +3 за кожного суперника, другому місцю +6
            case 'gladiators': a = 4 * Math.max(0, c.rounds || 0) + (outcome === 'win' ? 12 + 3 * n : (c.place === 2 ? 6 : 0)); break;
            default: a = 0;
        }
        return Math.max(1, Math.round(a));
    }
    // ----- ЕФЕКТИВНІСТЬ У PvP -----
    // e = вбивства − 0,3 × смерті; бонус = 4 × e / max(4, найкраще e в матчі), округлено (0…4). Менше 2 вбивств або e ≤ 0 — без бонусу.
    // Режими, що вже платять за вбивства («Ціль», королівський бій, раунди), — лише невеликий штраф: −1 за кожні 4 смерті (до −3).
    // Підсумок не перевищує максимум, показаний у лобі (cap), і не менший за 1.
    const EFF = { deathmatch: 1, team_deathmatch: 1, capture_points: 1, prophunt: 1, bounty: 2, battle_royale: 2, rounds: 2 };
    function effAdjust(mode, a, kd, maxE, cap) {
        const kind = EFF[mode]; if (!kind) return a;
        const k = (kd && kd.k) | 0, d = (kd && kd.d) | 0;
        let b;
        if (kind === 2) b = -Math.min(3, Math.floor(d / 4));
        else { const e = k - 0.3 * d; b = (k < 2 || e <= 0) ? 0 : Math.round(4 * Math.min(1, e / Math.max(4, maxE || 0))); }
        let out = a + b;
        if (cap > 0) out = Math.min(out, Math.max(a, cap));
        return Math.max(1, Math.round(out));
    }
    const effOn = m => !!EFF[m], effKind = m => EFF[m] | 0;

    // Орієнтовний діапазон для підказки в лобі: [поразка, перемога]
    // n: у лобі — реальна кількість гравців, у вікні створення — 2 (типовий загін)
    function rewardRange(mode, r) {
        const np = r && r.players ? Object.keys(r.players).length : 0, n = np || 2;
        if (mode === 'survival') return { loss: reward(mode, r, 'loss', { waves: 5, n }), win: reward(mode, r, 'loss', { waves: 20, n }), draw: null };
        if (mode === 'gladiators') return { loss: reward(mode, r, 'loss', { rounds: 2, n, place: n }), win: reward(mode, r, 'win', { rounds: 8, n }), draw: null };
        const lo = reward(mode, r, 'loss', { waves: 3, frac: 0.3, killed: 1, n, place: n, kills: 0, caps: 0 }), hi = reward(mode, r, 'win', { frac: 1, n, place: 1, kills: 0, caps: 0 });
        const hasDraw = mode === 'battle_royale' || mode === 'capture_points' || mode === 'bounty' || (mode === 'rounds' && r && r.rdDraw);
        return { loss: lo, win: hi, draw: hasDraw ? reward(mode, r, 'draw', { n, kills: 0 }) : null };
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

    return { PERKS, MODES, ORDER, NEW, GROUPS, PVE, SOLO, PARAMS, BYKEY, BOSSES, BOSS_NAMES, MAP_ALIAS, isPve, isSolo, isTeamPvp, usesColor, minPlayers, paramOn, reward, rewardRange, mult, wavePts, livesN, effAdjust, effOn, effKind };
});
