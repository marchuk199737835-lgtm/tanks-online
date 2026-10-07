// ЄДИНЕ ДЖЕРЕЛО ДАНИХ МОДУЛІВ І КЕЙСІВ (використовують і сервер, і клієнт). Згенеровано /tmp/gen/gen.js — правте тут вручну тільки ціни/шанси.
// Рідкості: common < rare < epic < legendary < mythic. Множники статів: dmg, cd (менше = швидше), range, hp, speed, rotSpeed — перемножуються по всіх 4 встановлених модулях.
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.GameData = factory(); })(typeof self !== 'undefined' ? self : this, function () {
const RARITY = {
  common: { name: 'Звичайний', color: '#94a3b8' },
  rare: { name: 'Рідкісний', color: '#3b82f6' },
  epic: { name: 'Епічний', color: '#a855f7' },
  legendary: { name: 'Легендарний', color: '#eab308' },
  mythic: { name: 'Міфічний', color: '#ff3b6b' }
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary', 'mythic'];
const MODULES = {
  'can_c1':{id:'can_c1',type:'cannon',rarity:'common',name:'Іскра',price:15,stats:{cd:0.96,dmg:0.98,range:1}},
  'can_c2':{id:'can_c2',type:'cannon',rarity:'common',name:'Чавун',price:25,stats:{dmg:1.05,cd:1.03,range:0.98}},
  'can_c5':{id:'can_c5',type:'cannon',rarity:'common',name:'Штамп',price:30,stats:{dmg:1.04,cd:1.03,range:1.03}},
  'can_c4':{id:'can_c4',type:'cannon',rarity:'common',name:'Кремінь',price:35,stats:{cd:0.97,dmg:1.01,range:1.01}},
  'can_c3':{id:'can_c3',type:'cannon',rarity:'common',name:'Подовжене',price:40,stats:{range:1.05,dmg:1.02,cd:1.02}},
  'can_r1':{id:'can_r1',type:'cannon',rarity:'rare',name:'Блискавка',price:60,stats:{cd:0.9,dmg:0.93,range:1}},
  'can_r2':{id:'can_r2',type:'cannon',rarity:'rare',name:'Молот',price:90,stats:{dmg:1.1,cd:1.06,range:0.95}},
  'can_r6':{id:'can_r6',type:'cannon',rarity:'rare',name:'Далекобій',price:95,stats:{range:1.14,dmg:1.04,cd:1.06}},
  'can_r5':{id:'can_r5',type:'cannon',rarity:'rare',name:'Бронебій',price:100,stats:{dmg:1.14,cd:1.07,speed:0.98}},
  'can_r4':{id:'can_r4',type:'cannon',rarity:'rare',name:'Картеч',price:105,stats:{cd:0.9,dmg:0.95,rotSpeed:1.04}},
  'can_r3':{id:'can_r3',type:'cannon',rarity:'rare',name:'Снайпер',price:130,stats:{range:1.12,dmg:1.06,cd:1.06}},
  'can_e1':{id:'can_e1',type:'cannon',rarity:'epic',name:'Квазар',price:170,stats:{cd:0.84,dmg:0.88,range:1}},
  'can_e2':{id:'can_e2',type:'cannon',rarity:'epic',name:'Титан',price:220,stats:{dmg:1.18,cd:1.12,range:0.92}},
  'can_e5':{id:'can_e5',type:'cannon',rarity:'epic',name:'Таран',price:240,stats:{dmg:1.22,cd:1.13,hp:1.03,range:0.94}},
  'can_e6':{id:'can_e6',type:'cannon',rarity:'epic',name:'Сокіл',price:255,stats:{range:1.24,dmg:1.08,cd:1.09,rotSpeed:1.04}},
  'can_e4':{id:'can_e4',type:'cannon',rarity:'epic',name:'Гадюка',price:270,stats:{cd:0.82,dmg:0.9,speed:1.03,range:1.02}},
  'can_e3':{id:'can_e3',type:'cannon',rarity:'epic',name:'Каратель',price:280,stats:{range:1.22,dmg:1.12,cd:1.1}},
  'can_l1':{id:'can_l1',type:'cannon',rarity:'legendary',name:'Пульсар',price:350,stats:{cd:0.78,dmg:0.82,range:1}},
  'can_l2':{id:'can_l2',type:'cannon',rarity:'legendary',name:'Колос',price:450,stats:{dmg:1.28,cd:1.2,range:0.88}},
  'can_l3':{id:'can_l3',type:'cannon',rarity:'legendary',name:'Армагеддон',price:550,stats:{range:1.35,dmg:1.22,cd:1.18}},
  'can_l5':{id:'can_l5',type:'cannon',rarity:'legendary',name:'Гроза',price:620,stats:{dmg:1.36,cd:1.22,range:0.92,hp:1.05}},
  'can_l4':{id:'can_l4',type:'cannon',rarity:'legendary',name:'Шторм',price:635,stats:{cd:0.76,dmg:0.82,range:1.04,speed:1.05}},
  'can_m3':{id:'can_m3',type:'cannon',rarity:'mythic',name:'Гарпун',price:1450,stats:{range:1.55,dmg:1.3,rotSpeed:0.94,speed:0.96}},
  'can_m2':{id:'can_m2',type:'cannon',rarity:'mythic',name:'Ліквідатор',price:1465,stats:{cd:0.68,dmg:1.06,range:1.08,speed:0.96,hp:0.96}},
  'can_m1':{id:'can_m1',type:'cannon',rarity:'mythic',name:'Гайковерт',price:1490,stats:{dmg:1.54,speed:1.1,hp:0.95,rotSpeed:0.95}},
  'tur_c1':{id:'tur_c1',type:'turret',rarity:'common',name:'Легка',price:15,stats:{rotSpeed:1.04,hp:0.98}},
  'tur_c2':{id:'tur_c2',type:'turret',rarity:'common',name:'Клепана',price:25,stats:{hp:1.03,rotSpeed:0.98}},
  'tur_c4':{id:'tur_c4',type:'turret',rarity:'common',name:'Ковпак',price:30,stats:{hp:1.02,rotSpeed:0.99}},
  'tur_c5':{id:'tur_c5',type:'turret',rarity:'common',name:'Дозор',price:30,stats:{rotSpeed:1.03,hp:0.99,range:1.01}},
  'tur_c3':{id:'tur_c3',type:'turret',rarity:'common',name:'Оптика',price:40,stats:{rotSpeed:1.02,hp:0.99}},
  'tur_r1':{id:'tur_r1',type:'turret',rarity:'rare',name:'Спритна',price:60,stats:{rotSpeed:1.1,hp:0.95}},
  'tur_r6':{id:'tur_r6',type:'turret',rarity:'rare',name:'Пілот',price:85,stats:{rotSpeed:1.06,speed:1.03,hp:0.97}},
  'tur_r2':{id:'tur_r2',type:'turret',rarity:'rare',name:'Щит',price:90,stats:{hp:1.08,rotSpeed:0.95}},
  'tur_r4':{id:'tur_r4',type:'turret',rarity:'rare',name:'Рефлекс',price:90,stats:{rotSpeed:1.12,hp:0.96,cd:0.98}},
  'tur_r5':{id:'tur_r5',type:'turret',rarity:'rare',name:'Валун',price:110,stats:{hp:1.1,rotSpeed:0.94,range:1.02}},
  'tur_r3':{id:'tur_r3',type:'turret',rarity:'rare',name:'Скаут',price:130,stats:{rotSpeed:1.05,hp:0.97}},
  'tur_e1':{id:'tur_e1',type:'turret',rarity:'epic',name:'Віраж',price:170,stats:{rotSpeed:1.2,hp:0.9}},
  'tur_e6':{id:'tur_e6',type:'turret',rarity:'epic',name:'Радар',price:195,stats:{rotSpeed:1.14,range:1.08,hp:0.93}},
  'tur_e4':{id:'tur_e4',type:'turret',rarity:'epic',name:'Вихор',price:200,stats:{rotSpeed:1.28,hp:0.89,cd:0.96}},
  'tur_e2':{id:'tur_e2',type:'turret',rarity:'epic',name:'Фортеця',price:220,stats:{hp:1.15,rotSpeed:0.9}},
  'tur_e3':{id:'tur_e3',type:'turret',rarity:'epic',name:'Вартовий',price:280,stats:{rotSpeed:1.12,hp:0.94}},
  'tur_e5':{id:'tur_e5',type:'turret',rarity:'epic',name:'Цитадель',price:295,stats:{hp:1.21,rotSpeed:0.88,dmg:1.03}},
  'tur_l1':{id:'tur_l1',type:'turret',rarity:'legendary',name:'Міраж',price:350,stats:{rotSpeed:1.35,hp:0.9}},
  'tur_l2':{id:'tur_l2',type:'turret',rarity:'legendary',name:'Бастіон',price:450,stats:{hp:1.2,rotSpeed:0.85}},
  'tur_l3':{id:'tur_l3',type:'turret',rarity:'legendary',name:'Яструб',price:550,stats:{rotSpeed:1.2,hp:0.9}},
  'tur_l4':{id:'tur_l4',type:'turret',rarity:'legendary',name:'Циклон',price:565,stats:{rotSpeed:1.45,hp:0.88,cd:0.95,speed:1.03}},
  'tur_l6':{id:'tur_l6',type:'turret',rarity:'legendary',name:'Оракул',price:615,stats:{range:1.18,rotSpeed:1.2,hp:0.92,dmg:1.05}},
  'tur_l5':{id:'tur_l5',type:'turret',rarity:'legendary',name:'Граніт',price:700,stats:{hp:1.3,rotSpeed:0.82,dmg:1.03}},
  'tur_m1':{id:'tur_m1',type:'turret',rarity:'mythic',name:'Око Бурі',price:940,stats:{rotSpeed:1.5,range:1.12,hp:1.04,dmg:1.06,speed:0.97}},
  'tur_m2':{id:'tur_m2',type:'turret',rarity:'mythic',name:'Купол Титана',price:1265,stats:{hp:1.34,rotSpeed:0.95,dmg:1.1,cd:0.98}},
  'hul_c1':{id:'hul_c1',type:'hull',rarity:'common',name:'Каркас',price:15,stats:{speed:1.04,hp:0.98}},
  'hul_c2':{id:'hul_c2',type:'hull',rarity:'common',name:'Панцер',price:25,stats:{hp:1.04,speed:0.98}},
  'hul_c4':{id:'hul_c4',type:'hull',rarity:'common',name:'Лист',price:30,stats:{hp:1.03,speed:0.99}},
  'hul_c5':{id:'hul_c5',type:'hull',rarity:'common',name:'Шасі',price:30,stats:{speed:1.03,hp:0.98,rotSpeed:1.01}},
  'hul_c3':{id:'hul_c3',type:'hull',rarity:'common',name:'Розвідник',price:40,stats:{speed:1.02,hp:0.99}},
  'hul_r1':{id:'hul_r1',type:'hull',rarity:'rare',name:'Болід',price:60,stats:{speed:1.1,hp:0.95}},
  'hul_r2':{id:'hul_r2',type:'hull',rarity:'rare',name:'Броньовик',price:90,stats:{hp:1.1,speed:0.95}},
  'hul_r4':{id:'hul_r4',type:'hull',rarity:'rare',name:'Кентавр',price:90,stats:{speed:1.08,hp:0.97,rotSpeed:1.03}},
  'hul_r6':{id:'hul_r6',type:'hull',rarity:'rare',name:'Рейнджер',price:90,stats:{speed:1.04,hp:1.03,cd:1.02}},
  'hul_r5':{id:'hul_r5',type:'hull',rarity:'rare',name:'Бульдог',price:110,stats:{hp:1.12,speed:0.94,dmg:1.01}},
  'hul_r3':{id:'hul_r3',type:'hull',rarity:'rare',name:'Авангард',price:130,stats:{speed:1.05,hp:0.97}},
  'hul_e1':{id:'hul_e1',type:'hull',rarity:'epic',name:'Фантом',price:170,stats:{speed:1.2,hp:0.9}},
  'hul_e2':{id:'hul_e2',type:'hull',rarity:'epic',name:'Моноліт',price:220,stats:{hp:1.18,speed:0.9}},
  'hul_e4':{id:'hul_e4',type:'hull',rarity:'epic',name:'Гепард',price:230,stats:{speed:1.24,hp:0.9,cd:0.97}},
  'hul_e6':{id:'hul_e6',type:'hull',rarity:'epic',name:'Шершень',price:245,stats:{speed:1.12,rotSpeed:1.08,dmg:0.97,hp:1.02}},
  'hul_e5':{id:'hul_e5',type:'hull',rarity:'epic',name:'Бункер',price:265,stats:{hp:1.22,speed:0.88,range:1.03}},
  'hul_e3':{id:'hul_e3',type:'hull',rarity:'epic',name:'Хижак',price:280,stats:{speed:1.1,hp:0.94}},
  'hul_l1':{id:'hul_l1',type:'hull',rarity:'legendary',name:'Тінь',price:350,stats:{speed:1.35,hp:0.85}},
  'hul_l2':{id:'hul_l2',type:'hull',rarity:'legendary',name:'Егіда',price:450,stats:{hp:1.28,speed:0.85}},
  'hul_l3':{id:'hul_l3',type:'hull',rarity:'legendary',name:'Ассасін',price:550,stats:{speed:1.15,hp:0.9}},
  'hul_l4':{id:'hul_l4',type:'hull',rarity:'legendary',name:'Фурія',price:665,stats:{speed:1.28,hp:0.93,rotSpeed:1.08,dmg:1.03}},
  'hul_l5':{id:'hul_l5',type:'hull',rarity:'legendary',name:'Левіафан',price:700,stats:{hp:1.34,speed:0.84,dmg:1.04}},
  'hul_m2':{id:'hul_m2',type:'hull',rarity:'mythic',name:'Аврора',price:940,stats:{speed:1.38,hp:1.06,cd:0.96,rotSpeed:0.95}},
  'hul_m3':{id:'hul_m3',type:'hull',rarity:'mythic',name:'Омега',price:1205,stats:{hp:1.28,speed:1.12,dmg:1.08,range:0.95}},
  'hul_m1':{id:'hul_m1',type:'hull',rarity:'mythic',name:'Джаггернаут',price:1275,stats:{hp:1.45,dmg:1.06,rotSpeed:0.97,speed:0.97}},
  'trk_c1':{id:'trk_c1',type:'tracks',rarity:'common',name:'Тонкі',price:15,stats:{speed:1.04,hp:0.98}},
  'trk_c2':{id:'trk_c2',type:'tracks',rarity:'common',name:'Важкі',price:25,stats:{hp:1.04,speed:0.98}},
  'trk_c4':{id:'trk_c4',type:'tracks',rarity:'common',name:'Гума',price:30,stats:{speed:1.03,hp:1}},
  'trk_c5':{id:'trk_c5',type:'tracks',rarity:'common',name:'Ланцюг',price:30,stats:{hp:1.03,speed:0.99}},
  'trk_c3':{id:'trk_c3',type:'tracks',rarity:'common',name:'Гібрид',price:40,stats:{speed:1.02,hp:0.99}},
  'trk_r1':{id:'trk_r1',type:'tracks',rarity:'rare',name:'Ралійні',price:60,stats:{speed:1.1,hp:0.95}},
  'trk_r2':{id:'trk_r2',type:'tracks',rarity:'rare',name:'Всюдихід',price:90,stats:{hp:1.1,speed:0.95}},
  'trk_r4':{id:'trk_r4',type:'tracks',rarity:'rare',name:'Крос',price:90,stats:{speed:1.09,hp:0.96,rotSpeed:1.03}},
  'trk_r6':{id:'trk_r6',type:'tracks',rarity:'rare',name:'Шиповані',price:100,stats:{speed:1.05,hp:1.03,dmg:0.99}},
  'trk_r5':{id:'trk_r5',type:'tracks',rarity:'rare',name:'Бронестрічка',price:105,stats:{hp:1.11,speed:0.95,range:1.01}},
  'trk_r3':{id:'trk_r3',type:'tracks',rarity:'rare',name:'Посилені',price:130,stats:{speed:1.05,hp:0.97}},
  'trk_e1':{id:'trk_e1',type:'tracks',rarity:'epic',name:'Граві',price:170,stats:{speed:1.2,hp:0.9}},
  'trk_e2':{id:'trk_e2',type:'tracks',rarity:'epic',name:'Гусеничні',price:220,stats:{hp:1.18,speed:0.9}},
  'trk_e4':{id:'trk_e4',type:'tracks',rarity:'epic',name:'Іскряні',price:225,stats:{speed:1.22,hp:0.92,rotSpeed:1.05}},
  'trk_e3':{id:'trk_e3',type:'tracks',rarity:'epic',name:'Адаптивні',price:280,stats:{speed:1.1,hp:0.94}},
  'trk_e5':{id:'trk_e5',type:'tracks',rarity:'epic',name:'Мамонт',price:280,stats:{hp:1.2,speed:0.9,dmg:1.03}},
  'trk_e6':{id:'trk_e6',type:'tracks',rarity:'epic',name:'Магнітні',price:295,stats:{speed:1.1,hp:1.06,cd:0.96}},
  'trk_l1':{id:'trk_l1',type:'tracks',rarity:'legendary',name:'Струм',price:350,stats:{speed:1.35,hp:0.85}},
  'trk_l2':{id:'trk_l2',type:'tracks',rarity:'legendary',name:'Скала',price:450,stats:{hp:1.28,speed:0.85}},
  'trk_l3':{id:'trk_l3',type:'tracks',rarity:'legendary',name:'Кіготь',price:550,stats:{speed:1.15,hp:0.9}},
  'trk_l4':{id:'trk_l4',type:'tracks',rarity:'legendary',name:'Блискавиця',price:610,stats:{speed:1.42,hp:0.88,rotSpeed:1.04}},
  'trk_l5':{id:'trk_l5',type:'tracks',rarity:'legendary',name:'Титанові',price:700,stats:{hp:1.3,speed:0.87,range:1.03}},
  'trk_l6':{id:'trk_l6',type:'tracks',rarity:'legendary',name:'Левітація',price:700,stats:{speed:1.2,hp:1,rotSpeed:1.1,cd:0.98}},
  'trk_m2':{id:'trk_m2',type:'tracks',rarity:'mythic',name:'Гравіплан',price:980,stats:{speed:1.3,hp:1.15,rotSpeed:1.08,dmg:0.97}},
  'trk_m1':{id:'trk_m1',type:'tracks',rarity:'mythic',name:'Нітро',price:1060,stats:{speed:1.45,hp:1.06,cd:0.96,rotSpeed:0.96}}
};
// drop: шанси у % (c,r,e,l,m — сума 100). pool: 'all' | 'cannon' | 'turret' | 'hull' | 'tracks' | масив id.
// legend:true — кейс, з якого видається нагорода адвенту (лише легендарні).
const CASES = {
  1:{name:'РЕКРУТ',price:65,color:'#94a3b8',theme:'crate',drop:{c:80,r:17,e:3,l:0,m:0},pool:'all'},
  2:{name:'АРСЕНАЛ',price:100,color:'#f87171',theme:'cannon',drop:{c:60,r:30,e:9,l:1,m:0},pool:'cannon'},
  3:{name:'КУПОЛ',price:100,color:'#60a5fa',theme:'turret',drop:{c:60,r:30,e:9,l:1,m:0},pool:'turret'},
  4:{name:'БРОНЯ',price:100,color:'#4ade80',theme:'hull',drop:{c:60,r:30,e:9,l:1,m:0},pool:'hull'},
  5:{name:'ЛАНЦЮГ',price:100,color:'#fb923c',theme:'tracks',drop:{c:60,r:30,e:9,l:1,m:0},pool:'tracks'},
  6:{name:'ТІНЬ',price:125,color:'#a78bfa',theme:'ghost',drop:{c:50,r:35,e:12,l:3,m:0},pool:['can_c1','can_r1','can_e1','can_l1','tur_c1','tur_r1','tur_r3','tur_e1','tur_e3','tur_l1','tur_l3','hul_c1','hul_r1','hul_r3','hul_e1','hul_e3','hul_l1','hul_l3','trk_c1','trk_r1','trk_r3','trk_e1','trk_e3','trk_l1','trk_l3','can_c4','can_r4','can_e4','can_e6','can_l4','tur_r4','tur_r6','tur_e4','tur_e6','tur_l4','tur_l6','hul_c5','hul_r4','hul_r6','hul_e4','hul_e6','hul_l4','trk_c4','trk_r4','trk_r6','trk_e4','trk_e6','trk_l4','trk_l6']},
  7:{name:'БАСТІОН',price:130,color:'#facc15',theme:'shield',drop:{c:50,r:35,e:12,l:3,m:0},pool:['tur_c2','tur_r2','tur_e2','tur_l2','hul_c2','hul_r2','hul_e2','hul_l2','trk_c2','trk_r2','trk_e2','trk_l2','can_e5','can_l5','tur_c4','tur_r5','tur_e5','tur_l5','hul_c4','hul_r5','hul_r6','hul_e5','hul_e6','hul_l5','trk_c5','trk_r5','trk_r6','trk_e5','trk_e6','trk_l5']},
  8:{name:'ЯСТРУБ',price:140,color:'#38bdf8',theme:'eye',drop:{c:50,r:35,e:12,l:3,m:0},pool:['can_c3','can_r3','can_e3','can_l3','tur_r1','tur_r3','tur_e1','tur_e3','tur_l1','tur_l3','can_c5','can_r6','can_e4','can_e6','can_l4','tur_r4','tur_r5','tur_r6','tur_e4','tur_e6','tur_l4','tur_l6','hul_e5','hul_e6','hul_l4','trk_e4','trk_l5','trk_l6']},
  9:{name:'ЛЮТЬ',price:145,color:'#ef4444',theme:'fang',drop:{c:50,r:35,e:12,l:3,m:0},pool:['can_c2','can_c3','can_r1','can_r2','can_r3','can_e1','can_e2','can_e3','can_l1','can_l2','can_l3','can_c5','can_r4','can_r5','can_r6','can_e4','can_e5','can_e6','can_l4','can_l5','tur_e5','tur_l4','tur_l5','tur_l6','hul_l4','hul_l5','trk_e5']},
  10:{name:'КОНТРАБАНДА',price:175,color:'#fbbf24',theme:'case',drop:{c:30,r:45,e:22,l:3,m:0},pool:'all'},
  11:{name:'ВЕТЕРАН',price:225,color:'#818cf8',theme:'medal',drop:{c:0,r:68,e:28,l:4,m:0},pool:'all'},
  12:{name:'ОФІЦЕР',price:310,color:'#2dd4bf',theme:'star',drop:{c:0,r:40,e:48,l:12,m:0},pool:'all'},
  13:{name:'ЧОРНИЙ РИНОК',price:450,color:'#94a3b8',theme:'mask',drop:{c:0,r:0,e:76,l:23,m:1},pool:'all'},
  14:{name:'ЕЛІТА',price:540,color:'#c084fc',theme:'gem',drop:{c:0,r:0,e:60,l:38,m:2},pool:'all'},
  15:{name:'ЛЕГЕНДА',price:680,color:'#fb7185',theme:'crown',legend:true,drop:{c:0,r:0,e:0,l:100,m:0},pool:'all'},
  16:{name:'ДЕМОН ВІЙНИ',price:910,color:'#ff3b3b',theme:'demon',drop:{c:0,r:0,e:15,l:73,m:12},pool:'cannon'},
  17:{name:'ОКО БУРІ',price:850,color:'#22d3ee',theme:'storm',drop:{c:0,r:0,e:15,l:74,m:11},pool:'turret'},
  18:{name:'ЗАЛІЗНИЙ ТРОН',price:920,color:'#fcd34d',theme:'throne',drop:{c:0,r:0,e:10,l:76,m:14},pool:'hull'},
  19:{name:'ВІХОЛА',price:870,color:'#34d399',theme:'vortex',drop:{c:0,r:0,e:15,l:74,m:11},pool:'tracks'},
  20:{name:'ПРОТОКОЛ ОМЕГА',price:1150,color:'#e879f9',theme:'omega',drop:{c:0,r:0,e:0,l:70,m:30},pool:'all'},
  21:{name:'ІМПЕРАТОР',price:1400,color:'#ff9d2e',theme:'emperor',drop:{c:0,r:0,e:0,l:45,m:55},pool:'all'},
  22:{name:'АБСОЛЮТ',price:1650,color:'#ff3b6b',theme:'absolute',drop:{c:0,r:0,e:0,l:0,m:100},pool:'all'}
};
function casePool(cs) {
  if (Array.isArray(cs.pool)) return cs.pool.filter(function (id) { return MODULES[id]; });
  const ids = Object.keys(MODULES);
  if (cs.pool === 'all' || !cs.pool) return ids;
  return ids.filter(function (id) { return MODULES[id].type === cs.pool; });
}
// Рідкість -> ключ шансу в drop
function dropKey(rar) { return rar.charAt(0); }
// Підсумковий пул кейса за рідкостями: [{rar, chance, ids}] від найрідкіснішого
function caseTable(cs) {
  const pool = casePool(cs), out = [];
  for (let i = RARITY_ORDER.length - 1; i >= 0; i--) {
    const rar = RARITY_ORDER[i], chance = (cs.drop && cs.drop[dropKey(rar)]) || 0;
    if (chance <= 0) continue;
    const ids = pool.filter(function (id) { return MODULES[id].rarity === rar; });
    if (ids.length) out.push({ rar: rar, chance: chance, ids: ids });
  }
  return out;
}
// Випадковий модуль із кейса; rnd — функція 0..1 (для тестів)
function rollCase(cs, rnd) {
  rnd = rnd || Math.random;
  const tbl = caseTable(cs); if (!tbl.length) return null;
  let tot = 0; tbl.forEach(function (t) { tot += t.chance; });
  let r = rnd() * tot;
  for (let i = 0; i < tbl.length; i++) { r -= tbl[i].chance; if (r < 0 || i === tbl.length - 1) return tbl[i].ids[Math.floor(rnd() * tbl[i].ids.length)]; }
}
// Межі сумарних множників (щоб комбінація міфічних модулів не ламала гру)
const STAT_LIMITS = { dmg: [0.5, 2.0], cd: [0.5, 2.0], range: [0.6, 1.8], hp: [0.5, 1.9], speed: [0.6, 1.8], rotSpeed: [0.5, 2.4] };
// Множник стату за всіма встановленими модулями
function statMult(equipped, stat) {
  let m = 1;
  if (equipped) ['cannon', 'turret', 'hull', 'tracks'].forEach(function (slot) {
    const mod = MODULES[equipped[slot]];
    if (mod && mod.stats && mod.stats[stat]) m *= mod.stats[stat];
  });
  const lim = STAT_LIMITS[stat];
  return lim ? Math.max(lim[0], Math.min(lim[1], m)) : m;
}
// Шанс апгрейду (%): справедливий шанс (вхід+бакси)/ціна цілі зі «зборами казино»: -15% (на міфічні -25%) і стеля 75% (на міфічні 50%).
// Ланцюжок дрібних апгрейдів тому не безпечний: кожен крок множить очікувану цінність на 0.85.
function upgradeChance(pIn, bucks, target) {
  const myth = target && target.rarity === 'mythic', pOut = (target && target.price) || 5;
  const edge = myth ? 0.75 : 0.85, cap = myth ? 50 : 75;
  return Math.max(1, Math.min(cap, ((pIn + (bucks || 0)) / pOut) * 100 * edge));
}
// ===== РІВНІ ГРАВЦЯ =====
// LEVEL_XP[i] — скільки всього досвіду потрібно, щоб мати рівень i+1. Рівень 1 дається одразу.
const LEVEL_XP = [0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5400, 6500, 7700, 9000, 10500, 12000];
const MAX_LEVEL = LEVEL_XP.length;
const LEVEL_NAMES = ['Рекрут', 'Рядовий', 'Єфрейтор', 'Молодший сержант', 'Сержант', 'Старший сержант', 'Старшина', 'Лейтенант', 'Старший лейтенант', 'Капітан', 'Майор', 'Підполковник', 'Полковник', 'Генерал', 'Маршал'];
const LEVEL_REWARD_MAX_PRICE = 650; // кейс за новий рівень коштує не більше за це
const XP_WIN = [5, 15], XP_LOSS = [1, 8]; // діапазони досвіду за матч (перемога / поразка чи нічия)
function levelFromXp(xp) { let l = 1; for (let i = 1; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) l = i + 1; return l; }
// {level, cur, need, pct, max}: прогрес усередині поточного рівня
function levelProgress(xp) {
  const l = levelFromXp(xp);
  if (l >= MAX_LEVEL) return { level: l, cur: xp - LEVEL_XP[MAX_LEVEL - 1], need: 0, pct: 100, max: true };
  const base = LEVEL_XP[l - 1], need = LEVEL_XP[l] - base, cur = xp - base;
  return { level: l, cur: cur, need: need, pct: Math.max(0, Math.min(100, cur / need * 100)), max: false };
}
// Нагороди за рівні 2..MAX_LEVEL: {рівень: id кейса}. Чим вищий рівень, тим дорожчий кейс може випасти (але до LEVEL_REWARD_MAX_PRICE)
function genLevelRewards(rnd) {
  rnd = rnd || Math.random;
  const ids = Object.keys(CASES).filter(function (k) { return CASES[k].price <= LEVEL_REWARD_MAX_PRICE && !CASES[k].legend; })
    .sort(function (a, b) { return CASES[a].price - CASES[b].price; });
  const out = {};
  for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    const t = (lv - 2) / (MAX_LEVEL - 2), lo = Math.floor(ids.length * 0.45 * t), top = Math.max(lo + 2, Math.ceil(ids.length * (0.3 + 0.7 * t)));
    const win = ids.slice(lo, Math.min(top, ids.length));
    out[lv] = +win[Math.floor(rnd() * win.length)];
  }
  return out;
}
function rollXp(outcome, rnd) { rnd = rnd || Math.random; const r = outcome === 'win' ? XP_WIN : XP_LOSS; return r[0] + Math.floor(rnd() * (r[1] - r[0] + 1)); }
function legendCaseId() { for (const k in CASES) if (CASES[k].legend) return +k; return null; }
return { RARITY: RARITY, RARITY_ORDER: RARITY_ORDER, MODULES: MODULES, CASES: CASES, casePool: casePool, caseTable: caseTable, rollCase: rollCase, statMult: statMult, LEVEL_XP: LEVEL_XP, MAX_LEVEL: MAX_LEVEL, LEVEL_NAMES: LEVEL_NAMES, levelFromXp: levelFromXp, levelProgress: levelProgress, genLevelRewards: genLevelRewards, rollXp: rollXp, XP_WIN: XP_WIN, XP_LOSS: XP_LOSS, upgradeChance: upgradeChance, legendCaseId: legendCaseId };
});
