let myId = null;
let myName = "", myColor = null, isReady = false, isAdmin = false;
let authMode = 'login';
let myBucks = 0;
let myInventory = [];
let myEquipped = { cannon: null, turret: null, hull: null, tracks: null };
let myStats = { kills: 0, matches: 0, earned: 0 };
let myAdventClaims = [];

const MAX_HP = 500;
const BASE_SPEED = 200; // базова швидкість танка (множники корпусу, гусениць і бафів застосовуються в getTankSpeed)
const BASE_TURRET_ROT = 8; // рад/с при rotSpeed = 1.0
const BASE_BULLET_SPEED = 700;
const PLAYER_BODY_R = 22; // фізичний радіус танка для зіткнень зі стінами/декором (діаметр 44 — вміщається в клітинку мапи 50)

let currentRoomId = null;
let currentRoomData = null;
let myLocalTank = { x: 0, y: 0, bodyAngle: 0, turretAngle: 0, hp: MAX_HP, buffProgress: 0, score: 0, team: 'hider', isDisguised: false, propType: 'prop_crate' };
let opponents = {};
let powerups = {};
let tokens = {};
let zombies = {};
let bullets = [];
let particles = [];
const keys = { w: false, a: false, s: false, d: false, space: false, lmb: false };
let mouseX = 0, mouseY = 0;
let lastShootTime = 0;
let camera = { x: 0, y: 0 };
let shakeTime = 0;
let homingTargetId = null;
let gameLoopId = null;
let lastTime = 0;

// Мапи
const MAP_DATA = {'epic_map':{size:3000,bg:'#565a6c',grid:'#494d55',solids:[{type:"wall_square",x:850,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1800,w:50,h:50,color:"#353940"},{type:"shape_rhombus",x:1150,y:1300,w:400,h:400,color:"#353940"},{type:"shape_rhombus",x:1250,y:1350,w:200,h:300,color:"#22252a"},{type:"tree",x:0,y:700,r:424.26},{type:"tree",x:2650,y:2550,r:180.27},{type:"tree",x:300,y:2400,r:158.11},{type:"tree",x:2850,y:750,r:364.00},{type:"neon_circle",x:850,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1900,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:850,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1900,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1250,y:2200,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1300,y:2200,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1350,y:2200,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1400,y:2200,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1300,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1250,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1350,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1450,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1400,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:1200,y:2250,w:50,h:50,color:"#21252c"},{type:"wall_square",x:550,y:1400,w:50,h:50,color:"#21252c"},{type:"wall_square",x:550,y:1450,w:50,h:50,color:"#21252c"},{type:"wall_square",x:550,y:1500,w:50,h:50,color:"#21252c"},{type:"wall_square",x:550,y:1550,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1400,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1350,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1450,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1500,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1550,w:50,h:50,color:"#21252c"},{type:"wall_square",x:500,y:1600,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2100,y:1400,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2100,y:1450,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2100,y:1500,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2100,y:1550,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1350,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1400,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1450,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1500,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1550,w:50,h:50,color:"#21252c"},{type:"wall_square",x:2150,y:1600,w:50,h:50,color:"#21252c"},{type:"line",points:[{x:136,y:955},{x:130,y:956},{x:124,y:956},{x:122,y:956},{x:120,y:956},{x:115,y:956},{x:112,y:956},{x:102,y:956},{x:99,y:956},{x:98,y:957},{x:98,y:959},{x:98,y:960},{x:98,y:961},{x:98,y:964},{x:98,y:966},{x:98,y:967},{x:98,y:968},{x:98,y:971},{x:98,y:973},{x:98,y:974},{x:98,y:976},{x:98,y:976},{x:98,y:978},{x:98,y:980},{x:98,y:983},{x:98,y:984},{x:98,y:985},{x:98,y:987},{x:98,y:988},{x:99,y:992},{x:99,y:993},{x:99,y:995},{x:99,y:997},{x:99,y:998},{x:99,y:1000},{x:99,y:1000},{x:99,y:1001},{x:99,y:1002},{x:99,y:1004},{x:99,y:1005},{x:101,y:1007},{x:101,y:1009},{x:101,y:1011},{x:101,y:1012},{x:101,y:1014},{x:102,y:1015},{x:102,y:1016},{x:102,y:1018},{x:102,y:1019},{x:102,y:1021},{x:102,y:1022},{x:102,y:1024},{x:102,y:1025},{x:102,y:1026},{x:102,y:1028},{x:102,y:1029},{x:102,y:1031},{x:102,y:1032},{x:99,y:1032},{x:95,y:1032},{x:89,y:1032},{x:83,y:1031},{x:81,y:1029},{x:80,y:1029},{x:76,y:1029},{x:75,y:1029}],color:"#21252c",width:16},{type:"line",points:[{x:54,y:964},{x:54,y:966},{x:54,y:968},{x:54,y:968},{x:54,y:971},{x:54,y:972},{x:54,y:973},{x:54,y:975},{x:54,y:976},{x:54,y:977},{x:54,y:979},{x:54,y:980},{x:54,y:981},{x:54,y:982},{x:54,y:983},{x:54,y:984},{x:56,y:984},{x:60,y:984},{x:61,y:984},{x:63,y:984},{x:64,y:984},{x:65,y:984},{x:68,y:984},{x:70,y:984},{x:72,y:985},{x:78,y:988},{x:79,y:988},{x:80,y:988},{x:81,y:988},{x:82,y:988},{x:84,y:988},{x:86,y:988},{x:88,y:988},{x:88,y:988},{x:91,y:988},{x:93,y:988},{x:95,y:988},{x:96,y:988},{x:98,y:988},{x:101,y:988},{x:104,y:988},{x:105,y:988},{x:110,y:988},{x:113,y:988},{x:115,y:988},{x:117,y:988},{x:118,y:988},{x:120,y:988},{x:120,y:988},{x:122,y:988},{x:123,y:988},{x:124,y:988},{x:125,y:988},{x:127,y:988},{x:128,y:988},{x:128,y:988},{x:129,y:988},{x:131,y:988},{x:132,y:988},{x:134,y:988},{x:135,y:988},{x:136,y:988},{x:136,y:988},{x:137,y:988},{x:138,y:988},{x:139,y:988},{x:142,y:988},{x:143,y:988},{x:144,y:988},{x:144,y:988},{x:144,y:989},{x:144,y:990},{x:144,y:992},{x:144,y:992},{x:144,y:994},{x:144,y:995},{x:144,y:996},{x:144,y:997},{x:144,y:999},{x:144,y:1000},{x:145,y:1000},{x:146,y:1000},{x:146,y:1001},{x:146,y:1003},{x:146,y:1004},{x:146,y:1006},{x:147,y:1007},{x:147,y:1008},{x:147,y:1008},{x:147,y:1010},{x:147,y:1011},{x:147,y:1013},{x:147,y:1014},{x:147,y:1015},{x:147,y:1016},{x:147,y:1017},{x:147,y:1018},{x:147,y:1020},{x:147,y:1021},{x:147,y:1022},{x:147,y:1023},{x:147,y:1024},{x:147,y:1025}],color:"#21252c",width:16},{type:"line",points:[{x:1095,y:864}],color:"#21252c",width:16},{type:"prop_crate",x:3000,y:2950,w:50,h:50},{type:"prop_crate",x:2200,y:1000,w:100,h:100},{type:"prop_crate",x:450,y:1100,w:100,h:100},{type:"prop_crate",x:350,y:1850,w:250,h:100},{type:"prop_crate",x:700,y:2500,w:300,h:100},{type:"prop_crate",x:1800,y:2200,w:100,h:100},{type:"spawn_powerup",x:1600,y:1700},{type:"spawn_powerup",x:1100,y:1250},{type:"spawn_powerup",x:850,y:2700},{type:"spawn_powerup",x:150,y:2150},{type:"spawn_powerup",x:800,y:1000},{type:"spawn_powerup",x:750,y:2000},{type:"spawn_powerup",x:1950,y:2000},{type:"spawn_powerup",x:1900,y:1000},{type:"spawn_player",x:250,y:2750},{type:"spawn_player",x:2850,y:2850},{type:"spawn_player",x:1500,y:2750},{type:"wall_square",x:1100,y:2800,w:100,h:200,color:"#31363f"},{type:"wall_square",x:1900,y:2650,w:400,h:150,color:"#31363f"},{type:"wall_square",x:2650,y:1550,w:100,h:350,color:"#31363f"},{type:"wall_square",x:450,y:2700,w:150,h:150,color:"#31363f"}]},'Бій Насмерть':{size:2500,bg:'#3e2604',grid:'#1e293b',solids:[{type:"prop_crate",x:550,y:1300,w:50,h:50},{type:"prop_crate",x:550,y:1300,w:50,h:50},{type:"prop_crate",x:500,y:1300,w:50,h:50},{type:"prop_crate",x:550,y:1300,w:50,h:50},{type:"prop_crate",x:500,y:1250,w:50,h:50},{type:"prop_crate",x:500,y:1200,w:50,h:50},{type:"prop_crate",x:650,y:1300,w:50,h:50},{type:"prop_crate",x:650,y:1300,w:50,h:50},{type:"prop_crate",x:650,y:1300,w:50,h:50},{type:"prop_crate",x:650,y:1300,w:50,h:50},{type:"prop_crate",x:600,y:1300,w:50,h:50},{type:"prop_crate",x:750,y:1300,w:50,h:50},{type:"prop_crate",x:700,y:1300,w:50,h:50},{type:"prop_crate",x:800,y:1300,w:50,h:50},{type:"prop_crate",x:550,y:950,w:50,h:50},{type:"prop_crate",x:600,y:950,w:50,h:50},{type:"prop_crate",x:650,y:950,w:50,h:50},{type:"prop_crate",x:750,y:950,w:50,h:50},{type:"prop_crate",x:700,y:950,w:50,h:50},{type:"prop_crate",x:800,y:950,w:50,h:50},{type:"prop_crate",x:850,y:950,w:50,h:50},{type:"prop_crate",x:850,y:1050,w:50,h:50},{type:"prop_crate",x:850,y:1050,w:50,h:50},{type:"prop_crate",x:850,y:1000,w:50,h:50},{type:"prop_crate",x:850,y:1450,w:50,h:50},{type:"prop_crate",x:850,y:1500,w:50,h:50},{type:"prop_crate",x:900,y:1500,w:50,h:50},{type:"prop_crate",x:950,y:1500,w:50,h:50},{type:"prop_crate",x:950,y:1450,w:50,h:50},{type:"prop_crate",x:500,y:1450,w:50,h:50},{type:"prop_crate",x:500,y:1500,w:50,h:50},{type:"prop_crate",x:500,y:1500,w:50,h:50},{type:"prop_crate",x:500,y:1500,w:50,h:50},{type:"prop_crate",x:450,y:1500,w:50,h:50},{type:"prop_crate",x:450,y:1500,w:50,h:50},{type:"prop_crate",x:450,y:1500,w:50,h:50},{type:"prop_crate",x:400,y:1500,w:50,h:50},{type:"prop_crate",x:400,y:1450,w:50,h:50},{type:"prop_barrel",x:450,y:1450,w:50,h:50},{type:"prop_barrel",x:900,y:1450,w:50,h:50},{type:"prop_bush",x:350,y:1450,w:50,h:50},{type:"prop_bush",x:350,y:1500,w:50,h:50},{type:"prop_bush",x:250,y:1450,w:50,h:50},{type:"prop_bush",x:250,y:1500,w:50,h:50},{type:"prop_crate",x:200,y:1450,w:50,h:50},{type:"prop_crate",x:200,y:1500,w:50,h:50},{type:"prop_crate",x:200,y:1450,w:50,h:50},{type:"prop_crate",x:150,y:1450,w:50,h:50},{type:"prop_crate",x:150,y:1500,w:50,h:50},{type:"prop_bush",x:1000,y:1450,w:50,h:50},{type:"prop_bush",x:1000,y:1500,w:50,h:50},{type:"prop_crate",x:1150,y:1450,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1150,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1500,w:50,h:50},{type:"prop_crate",x:1200,y:1450,w:50,h:50},{type:"prop_bush",x:1100,y:1450,w:50,h:50},{type:"prop_bush",x:1100,y:1500,w:50,h:50},{type:"prop_barrel",x:1100,y:1250,w:50,h:50},{type:"prop_barrel",x:300,y:1200,w:50,h:50},{type:"prop_barrel",x:1100,y:1050,w:50,h:50},{type:"prop_barrel",x:300,y:1000,w:50,h:50},{type:"prop_crate",x:1200,y:1050,w:50,h:50},{type:"prop_crate",x:1150,y:1050,w:50,h:50},{type:"prop_crate",x:1200,y:1000,w:50,h:50},{type:"prop_crate",x:1150,y:1250,w:50,h:50},{type:"prop_crate",x:1200,y:1250,w:50,h:50},{type:"prop_crate",x:1200,y:1300,w:50,h:50},{type:"prop_bush",x:1200,y:1200,w:50,h:50},{type:"prop_bush",x:1200,y:1100,w:50,h:50},{type:"prop_crate",x:250,y:1200,w:50,h:50},{type:"prop_crate",x:200,y:1200,w:50,h:50},{type:"prop_crate",x:200,y:1250,w:50,h:50},{type:"prop_crate",x:250,y:1000,w:50,h:50},{type:"prop_crate",x:200,y:1000,w:50,h:50},{type:"prop_crate",x:200,y:950,w:50,h:50},{type:"prop_bush",x:250,y:1050,w:50,h:50},{type:"prop_bush",x:250,y:1150,w:50,h:50},{type:"prop_crate",x:200,y:700,w:50,h:50},{type:"prop_crate",x:200,y:750,w:50,h:50},{type:"prop_crate",x:250,y:700,w:50,h:50},{type:"prop_crate",x:250,y:750,w:50,h:50},{type:"prop_crate",x:450,y:700,w:50,h:50},{type:"prop_crate",x:450,y:750,w:50,h:50},{type:"prop_barrel",x:500,y:750,w:50,h:50},{type:"prop_barrel",x:550,y:750,w:50,h:50},{type:"prop_barrel",x:800,y:750,w:50,h:50},{type:"prop_barrel",x:850,y:750,w:50,h:50},{type:"prop_crate",x:900,y:750,w:50,h:50},{type:"prop_crate",x:900,y:700,w:50,h:50},{type:"prop_crate",x:1100,y:700,w:50,h:50},{type:"prop_crate",x:1100,y:750,w:50,h:50},{type:"prop_crate",x:1150,y:700,w:50,h:50},{type:"prop_crate",x:1150,y:750,w:50,h:50},{type:"water_square",x:500,y:1650,w:400,h:100},{type:"prop_bush",x:900,y:1750,w:50,h:50},{type:"prop_bush",x:850,y:1750,w:50,h:50},{type:"prop_bush",x:800,y:1750,w:50,h:50},{type:"prop_bush",x:800,y:1750,w:50,h:50},{type:"prop_bush",x:750,y:1750,w:50,h:50},{type:"prop_bush",x:750,y:1750,w:50,h:50},{type:"prop_bush",x:750,y:1750,w:50,h:50},{type:"prop_bush",x:700,y:1750,w:50,h:50},{type:"prop_bush",x:700,y:1750,w:50,h:50},{type:"prop_bush",x:700,y:1750,w:50,h:50},{type:"prop_bush",x:650,y:1750,w:50,h:50},{type:"prop_bush",x:650,y:1750,w:50,h:50},{type:"prop_bush",x:600,y:1750,w:50,h:50},{type:"prop_bush",x:600,y:1750,w:50,h:50},{type:"prop_bush",x:600,y:1750,w:50,h:50},{type:"prop_bush",x:550,y:1750,w:50,h:50},{type:"prop_bush",x:550,y:1750,w:50,h:50},{type:"prop_bush",x:500,y:1750,w:50,h:50},{type:"prop_bush",x:500,y:1750,w:50,h:50},{type:"prop_bush",x:500,y:1750,w:50,h:50},{type:"prop_bush",x:450,y:1750,w:50,h:50},{type:"water_square",x:450,y:500,w:50,h:50},{type:"water_square",x:900,y:500,w:50,h:50},{type:"prop_barrel",x:950,y:500,w:50,h:50},{type:"prop_barrel",x:400,y:500,w:50,h:50},{type:"prop_barrel",x:450,y:1700,w:50,h:50},{type:"prop_barrel",x:450,y:1650,w:50,h:50},{type:"prop_barrel",x:900,y:1650,w:50,h:50},{type:"prop_barrel",x:900,y:1700,w:50,h:50},{type:"water_square",x:450,y:550,w:500,h:50},{type:"water_square",x:500,y:500,w:400,h:50},{type:"prop_barrel",x:400,y:550,w:50,h:50},{type:"prop_barrel",x:950,y:550,w:50,h:50},{type:"prop_bush",x:400,y:450,w:50,h:50},{type:"prop_bush",x:450,y:450,w:50,h:50},{type:"prop_bush",x:500,y:450,w:50,h:50},{type:"prop_bush",x:550,y:450,w:50,h:50},{type:"prop_bush",x:600,y:450,w:50,h:50},{type:"prop_bush",x:650,y:450,w:50,h:50},{type:"prop_bush",x:700,y:450,w:50,h:50},{type:"prop_bush",x:750,y:450,w:50,h:50},{type:"prop_bush",x:800,y:450,w:50,h:50},{type:"prop_bush",x:850,y:450,w:50,h:50},{type:"prop_bush",x:900,y:450,w:50,h:50},{type:"prop_bush",x:950,y:450,w:50,h:50},{type:"prop_crate",x:0,y:0,w:350,h:150},{type:"prop_crate",x:1300,y:0,w:350,h:150},{type:"prop_crate",x:1300,y:2350,w:350,h:150},{type:"prop_crate",x:0,y:2350,w:350,h:150},{type:"spawn_player",x:1400,y:1450},{type:"spawn_player",x:100,y:1350},{type:"spawn_player",x:1400,y:750},{type:"spawn_player",x:100,y:700},{type:"spawn_powerup",x:400,y:850},{type:"spawn_powerup",x:1200,y:850},{type:"spawn_powerup",x:1000,y:1350},{type:"spawn_powerup",x:400,y:1300}]}};

const PROP_TYPES = ['prop_crate','prop_barrel','prop_sandbag','prop_rock','prop_bush','prop_cone','prop_concrete','prop_hedgehog','prop_tent','prop_cont_red','prop_cont_blue','prop_wreck','prop_tires','prop_generator','tree','wall_square'];

// ОДНА ГЛОБАЛЬНА КОПІЯ НАЛАШТУВАНЬ БАФІВ ТА ІКОНОК
window.BUFFS = {
    'none': { cd: 1500, dmg: 75, type: 'normal' },
    'explosive': { cd: 1500, dmg: 250, type: 'explosive' },
    'minigun': { cd: 150, dmg: 25, type: 'fast' },
    'boss': { cd: 1000, dmg: 500, type: 'explosive' },
    'shotgun': { cd: 1500, dmg: 25, type: 'normal' },
    'healing': { cd: 1500, dmg: 75, type: 'normal' },
    'samurai': { cd: 500, dmg: 75, type: 'melee' },
    'piercing': { cd: 1500, dmg: 50, type: 'piercing' },
    'invisible': { cd: 500, dmg: 75, type: 'normal' },
    'homing': { cd: 2000, dmg: 125, type: 'homing' },
    'hunter_gun': { cd: 1000, dmg: 250, type: 'normal' },
    'speed': { cd: 1500, dmg: 75, type: 'normal' },
    'shield': { cd: 1500, dmg: 75, type: 'normal' },
    'double_dmg': { cd: 1500, dmg: 150, type: 'normal' },
    'autolaser': { cd: 2000, dmg: 75, type: 'normal' },
    'reaper': { cd: 2000, dmg: 75, type: 'normal' },
    'incendiary': { cd: 2000, dmg: 75, type: 'normal' },
    'fast': { cd: 150, dmg: 25, type: 'fast' }
};

window.PU_COLORS = {
    'explosive':'#fb923c','minigun':'#fde047','boss':'#dc2626','shotgun':'#9ca3af',
    'healing':'#22c55e','samurai':'#ef4444','piercing':'#d946ef','invisible':'#cbd5e1',
    'homing':'#10b981','hunter_gun':'#dc2626'
};

window.BUFF_ICONS = {
    'healing': '➕', 'speed': '⚡', 'shield': '🛡️', 'invisible': '👻',
    'double_dmg': '⚔️', 'boss': '👹', 'samurai': '🗡️', 'minigun': '🔫',
    'shotgun': '💥', 'homing': '🎯', 'incendiary': '🔥', 'explosive': '💣',
    'piercing': '🪡', 'autolaser': '⚡', 'reaper': '☠️', 'hunter_gun': '🔫'
};

window.BUFF_NAMES = {
    'healing': 'ЗЦІЛЕННЯ', 'speed': 'ШВИДКІСТЬ', 'shield': 'ЩИТ',
    'invisible': 'НЕВИДИМІСТЬ', 'double_dmg': 'ПОДВІЙНА ШКОДА', 'boss': 'БОС',
    'samurai': 'САМУРАЙ', 'minigun': 'МІНІГАН', 'shotgun': 'ДРОБОВИК',
    'homing': 'САМОНАВЕДЕННЯ', 'incendiary': 'ЗАПАЛЮВАЛЬНІ', 'explosive': 'ВИБУХОВІ',
    'piercing': 'БРОНЕБІЙНІ', 'autolaser': 'АВТО-ЛАЗЕР', 'reaper': 'ЖНЕЦЬ', 'hunter_gun': 'МИСЛИВЕЦЬ'
};

// Типи зомбі та босів приходять із сервера (подія 'initZombies', джерело - Z_TYPES у server.js).
// Тут їх більше не дублюємо: додавайте нових зомбі лише в server.js.
const Z_TYPES = {};
const Z_FALLBACK = { hp: 25, radius: 15, color: '#22c55e' };
// Безпечний доступ: невідомий тип (або дані ще не прийшли) не валить гру
function zType(t){return Z_TYPES[t]||Z_FALLBACK;}

// Модулі, кейси та рідкості — у спільному файлі js/gamedata.js (його ж використовує сервер)
const RARITY = GameData.RARITY;

const CAT_NAMES = {'cannon':'ДУЛО','turret':'БАШТА','hull':'КОРПУС','tracks':'ГУСЕНИЦІ'};

const SVG_ICONS = {
    'cannon': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="9" y="2" width="6" height="12" rx="1"></rect><path d="M12 14v8"></path><path d="M8 22h8"></path></svg>`,
    'turret': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    'hull': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><path d="M4 6h16v12H4z"></path><path d="M8 6V4h8v2"></path></svg>`,
    'tracks': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="4" y="2" width="4" height="20" rx="1"></rect><rect x="16" y="2" width="4" height="20" rx="1"></rect><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path></svg>`
};

const MODULES = GameData.MODULES;
const CASES = GameData.CASES;

// Рядки характеристик модуля для UI: {name, pct (зі знаком), good}. Перезарядка показується як скорострільність (1/cd).
function fmtDelta(ratio) { const p = Math.round((ratio - 1) * 100); return (p > 0 ? '+' : '') + p + '%'; }
function modStatRows(mod) {
    const st = mod.stats || {}, rows = [];
    const add = (name, ratio) => { const p = Math.round((ratio - 1) * 100); if (p !== 0) rows.push({ name: name, pct: p, good: p > 0 }); };
    if (st.dmg) add('Урон', st.dmg);
    if (st.cd) add('Скорострільність', 1 / st.cd);
    if (st.range) add('Дальність стрільби', st.range);
    if (st.hp) add('Броня / Здоров\'я', st.hp);
    if (st.speed) add('Швидкість руху', st.speed);
    if (st.rotSpeed) add('Поворот башти', st.rotSpeed);
    return rows;
}
function modStatsHtml(mod, sep) {
    return modStatRows(mod).map(r => `<span style="color:${r.good ? '#34d399' : '#f87171'}">${r.name}: ${r.pct > 0 ? '+' : ''}${r.pct}%</span>`).join(sep || '<br>');
}

// ===== ВІЗУАЛ МОДУЛІВ (єдине джерело форм для танка на канвасі та для SVG-іконок) =====
// Правило: звичайні модулі — прості й матові, рідкісні — з кольоровим контуром,
// епічні — з деталями та слабким світінням, легендарні — м'яке неонове світіння, що пульсує.
// Форма залежить від архетипу (цифра в id: 1 = швидкість/скорострільність, 2 = броня/урон, 3 = універсал/дальність) та рівня рідкості.
const MOD_TIER = { common: 0, rare: 1, epic: 2, legendary: 3, mythic: 4 };
function modArch(mod) { const m = /_[a-z](\d)$/.exec(mod.id); return m ? parseInt(m[1], 10) : 1; }

function modPalette(rarity) {
    if (!rarity) return { acc: '#475569', tier: 0, m: '#1e293b', d: '#0f172a', l: '#334155', line: '#334155' };
    const tier = MOD_TIER[rarity], acc = RARITY[rarity].color;
    return { acc: acc, tier: tier, m: ['#56627a', '#4a5875', '#3f4a6b', '#2b3254', '#3d1530'][tier], d: tier === 4 ? '#1c0a16' : '#161c2b', l: ['#7c889c', '#93a8cc', '#c3b0ea', '#f6e3a0', '#ffd0dc'][tier], line: tier === 0 ? '#8793a8' : acc };
}

const _R = (x, y, w, h, f, s, o) => Object.assign({ k: 'r', x: x, y: y, w: w, h: h, f: f, s: s }, o || {});
const _P = (p, f, s, o) => Object.assign({ k: 'p', p: p, f: f, s: s }, o || {});
const _C = (x, y, r, f, s, o) => Object.assign({ k: 'c', x: x, y: y, r: r, f: f, s: s }, o || {});
const _L = (x1, y1, x2, y2, s, o) => Object.assign({ k: 'l', x1: x1, y1: y1, x2: x2, y2: y2, s: s }, o || {});
const _G = { g: true };
const _mir = (pts) => pts.map(p => [p[0], -p[1]]);
const _oct = (r) => { const a = []; for (let i = 0; i < 8; i++) { const t = Math.PI / 8 + i * Math.PI / 4; a.push([+(Math.cos(t) * r).toFixed(2), +(Math.sin(t) * r).toFixed(2)]); } return a; };

// Міфічні модулі: у кожного власна унікальна форма (Lr — дальність, щоб довжина дула відповідала статам)
const MYTHIC_SHAPES = {
    can_m1: (L) => [ // Гайковерт: гайковий ключ із гексагайкою
        _R(0, -5, L - 12, 10, 'm', 'a', _G), _L(4, 0, L - 16, 0, '#fff', _G),
        _P([[L - 16, -13], [L + 4, -13], [L + 4, -5], [L - 6, -5], [L - 6, 5], [L + 4, 5], [L + 4, 13], [L - 16, 13]], 'm', 'a', _G),
        _P(_oct(7).map(p => [p[0] + L * 0.38, p[1]]), 'd', 'a', _G), _C(L * 0.38, 0, 2.2, '#fff', null, _G), _R(L + 4, -3, 3, 6, 'a', null, _G)],
    can_m2: (L) => [ // Ліквідатор: чотири стволи з кільцями та дульним полум'ям
        [-11, -4, 3, 10].map(y => _R(0, y, L, 4, 'm', 'a', _G)), _R(L * 0.3, -14, 5, 28, 'l', 'a', _G), _R(L * 0.62, -14, 5, 28, 'l', 'a', _G),
        [-9, -2, 5, 12].map(y => _C(L + 3, y, 2.2, '#fff', 'a', _G)), _L(4, 0, L - 3, 0, '#fff', _G)].flat(),
    can_m3: (L) => [ // Гарпун: довге древко з зазубреним наконечником
        _P([[0, -4], [L - 14, -2], [L - 14, 2], [0, 4]], 'm', 'a', _G), _R(L * 0.22, -10, 16, 5, 'd', 'a', _G), _C(L * 0.22 + 16, -7.5, 2.4, '#fff', null, _G),
        _P([[L - 18, -9], [L + 6, 0], [L - 18, 9], [L - 12, 0]], 'l', 'a', _G), _L(5, 0, L - 18, 0, '#fff', _G), _C(L * 0.5, 0, 2, 'a', null, _G)],
    tur_m1: () => [ // Око Бурі: башта з палаючим оком
        _P(_oct(25), 'm', 'a', _G), _P([[-22, 0], [0, -14], [22, 0], [0, 14]], 'd', 'a', _G), _C(0, 0, 8, 'a', '#fff', _G), _C(0, 0, 3, '#fff', null, _G),
        _P([[22, -4], [34, -3], [34, 3], [22, 4]], 'l', 'a', _G), _L(-22, -20, -14, -26, 'a', _G), _L(-22, 20, -14, 26, 'a', _G)],
    tur_m2: () => [ // Купол Титана: масивна цитадель із бронекільцем
        _P(_oct(28), 'm', 'a', _G), _P(_oct(20), 'd', 'a', _G), _P(_oct(11), 'l', '#fff', _G), _C(0, 0, 4, 'a', null, _G),
        [[-17, -17], [17, -17], [-17, 17], [17, 17]].map(q => _C(q[0], q[1], 2.2, '#fff')), _R(16, -9, 14, 18, 'm', 'a', _G)].flat(),
    hul_m1: () => [ // Джаггернаут: бульдозерний ніс і бронеплити
        _P([[-31, -24], [20, -24], [34, -14], [34, 14], [20, 24], [-31, 24]], 'm', 'a', _G), _P([[26, -17], [37, -22], [37, 22], [26, 17]], 'l', 'a', _G),
        _R(-24, -17, 36, 34, 'd', 'a', _G), _L(-24, 0, 12, 0, '#fff', _G), [-14, 2].map(x => [_R(x, -22, 10, 4, 'l'), _R(x, 18, 10, 4, 'l')]).flat(), _C(-6, 0, 5, 'a', '#fff', _G)].flat(),
    hul_m2: () => [ // Аврора: гострий корпус із крилами та сяйвом
        _P([[-30, -16], [8, -22], [36, 0], [8, 22], [-30, 16]], 'm', 'a', _G),
        _P([[-26, -18], [-38, -30], [-14, -22]], 'l', 'a', _G), _P([[-26, 18], [-38, 30], [-14, 22]], 'l', 'a', _G),
        _L(-28, -6, 24, -2, '#ff7ab0', _G), _L(-28, 0, 30, 0, '#fff', _G), _L(-28, 6, 24, 2, '#7ad7ff', _G), _C(10, 0, 4, 'a', '#fff', _G)],
    hul_m3: () => [ // Омега: корпус із Ω-вирізом
        _P([[-30, -22], [24, -22], [34, -10], [34, 10], [24, 22], [-30, 22]], 'm', 'a', _G),
        _P([[-18, 14], [-10, 14], [-10, 10], [-15, 4], [-15, -4], [-8, -11], [4, -11], [11, -4], [11, 4], [6, 10], [6, 14], [14, 14], [14, 18], [2, 18], [2, 8], [8, 2], [8, -2], [3, -7], [-7, -7], [-12, -2], [-12, 2], [-6, 8], [-6, 18], [-18, 18]], 'a', '#fff', _G),
        _R(-30, -22, 4, 44, 'l', null, _G)],
    trk_m1: () => [-32, 18].map((y0, i) => [ // Нітро: траки з реактивним вихлопом
        _R(-36, y0, 72, 14, 'm', 'a', _G), [-30, -18, -6, 6, 18, 30].map(x => _L(x, y0 + 4, x, y0 + 10, 'a', _G)),
        _P([[-36, y0 + 3], [-52, y0 + 7], [-36, y0 + 11]], '#ffb347', '#fff', _G), _P([[-36, y0 + 5], [-44, y0 + 7], [-36, y0 + 9]], '#fff', null, _G), _C(33, y0 + 7, 4, 'l', 'a', _G)].flat()).flat(),
    trk_m2: () => [-32, 18].map((y0, i) => [ // Гравіплан: парящі подушки зі сяючим кільцем
        [-34, -12, 10].map(x => _R(x, y0 + 1, 20, 12, 'm', 'a', _G)), _L(-34, y0 + 7, 30, y0 + 7, '#fff', _G),
        [-24, -2, 20].map(x => _C(x, y0 + 7, 3, 'a', '#fff', _G)), _R(-36, i ? y0 + 15 : y0 - 3, 72, 2, 'a', null, _G)].flat()).flat()
};

function buildModShapes(type, a, t, st) {
    const S = [];
    if (type === 'cannon') {
        const L = Math.round(46 * ((st && st.range) || 1));
        if (a === 0) { S.push(_R(0, -6, 45, 12, 'm', 'line')); }
        else if (a === 1) { // скорострільна: тонка, з перфорацією; легендарна — здвоєна
            if (t < 3) {
                S.push(_R(0, -5, L, 10, 'm', 'line'));
                if (t >= 1) { S.push(_C(L * 0.45, 0, 1.7, 'd'), _C(L * 0.65, 0, 1.7, 'd'), _R(5, -6, 3, 12, 'l')); }
                if (t >= 2) { S.push(_C(L * 0.85, 0, 1.7, 'd'), _R(L * 0.25, -7, 3, 14, 'l'), _R(L - 4, -6, 4, 12, 'a', null, _G)); }
            } else {
                S.push(_R(0, -9, L, 6, 'm', 'line', _G), _R(0, 3, L, 6, 'm', 'line', _G), _R(2, -3, L - 4, 6, 'd'), _L(4, 0, L - 4, 0, 'a', _G), _R(L - 3, -9, 3, 6, 'a', null, _G), _R(L - 3, 3, 3, 6, 'a', null, _G));
            }
        } else if (a === 2) { // важка: коротка й товста, дульне гальмо
            if (t === 0) S.push(_R(0, -7, L, 14, 'm', 'line'));
            else if (t === 1) S.push(_R(0, -7, L, 14, 'm', 'line'), _R(L - 8, -9, 8, 18, 'l', 'line'));
            else if (t === 2) S.push(_R(0, -8, L, 16, 'm', 'line'), _R(L * 0.35, -10, 4, 20, 'l'), _R(L - 10, -10, 10, 20, 'l', 'line', _G), _L(L - 7, -10, L - 7, 10, 'd'), _L(L - 3, -10, L - 3, 10, 'd'));
            else S.push(_P([[0, -8], [L - 12, -8], [L, -14], [L, 14], [L - 12, 8], [0, 8]], 'm', 'a', _G), _R(L - 3, -7, 3, 14, 'd'), _L(6, 0, L - 14, 0, 'a', _G), _R(L * 0.3, -10, 3, 20, 'a', null, _G), _R(L * 0.55, -10, 3, 20, 'a', null, _G));
        } else if (a === 3) { // дальнобійна: довга й тонка, приціл
            if (t === 0) S.push(_R(0, -4, L, 8, 'm', 'line'));
            else if (t === 1) S.push(_R(0, -4, L, 8, 'm', 'line'), _R(L * 0.3, -9, 12, 4, 'l', 'line'));
            else if (t === 2) S.push(_P([[0, -5], [L, -3], [L, 3], [0, 5]], 'm', 'line'), _R(L * 0.28, -10, 14, 5, 'd', 'a', _G), _R(L - 5, -4, 5, 8, 'l', 'line'));
            else S.push(_P([[0, -5], [L, -3], [L, 3], [0, 5]], 'm', 'a', _G), _R(L * 0.28, -10, 14, 5, 'd', 'a'), _C(L * 0.28 + 14, -7.5, 2.2, 'a', null, _G), _L(4, 0, L - 3, 0, 'a', _G), _R(L - 5, -4, 5, 8, 'a', null, _G));
        } else if (a === 4) { // триствольна: три тонкі стволи зі стяжками
            const G3 = t === 3;
            [-9, -2, 5].forEach(y => S.push(_R(0, y, L, 4, 'm', t === 0 ? 'line' : 'line', G3 ? _G : null)));
            S.push(_R(L * 0.3, -11, 4, 22, t === 0 ? 'm' : 'l', 'line'));
            if (t >= 1) S.push(_R(L * 0.62, -11, 4, 22, 'l', 'line'));
            if (t >= 2) [-7, 0, 7].forEach(y => S.push(_C(L - 2, y, 1.6, 'a', null, _G)));
            if (t === 3) S.push(_R(L - 2, -9, 3, 18, 'a', null, _G));
        } else if (a === 5) { // міномет: коротка труба з розтрубом
            const B = Math.round(L * 0.6);
            S.push(_P([[0, -6], [B, -6], [L, -13], [L, 13], [B, 6], [0, 6]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_R(B * 0.4, -8, 4, 16, 'l', 'line'));
            if (t >= 2) S.push(_L(B + 2, -4, L - 3, -8, 'd'), _L(B + 2, 4, L - 3, 8, 'd'), _R(L - 3, -13, 3, 26, 'a', null, _G));
            if (t === 3) S.push(_C(L - 8, 0, 4, 'a', null, _G), _L(4, 0, B, 0, 'a', _G));
        } else { // рейлган: дві рейки з котушками
            S.push(_R(0, -7, L, 4, 'm', 'line', t === 3 ? _G : null), _R(0, 3, L, 4, 'm', 'line', t === 3 ? _G : null));
            const n = t === 0 ? 2 : t === 1 ? 3 : 4;
            for (let i = 0; i < n; i++) S.push(_R(5 + i * (L - 12) / n, -9, 3, 18, t >= 2 ? 'l' : 'd', 'line', t >= 2 ? _G : null));
            if (t >= 2) S.push(_L(4, 0, L, 0, 'a', _G));
            if (t === 3) S.push(_R(L - 3, -7, 3, 14, 'a', null, _G));
        }
    } else if (type === 'turret') {
        const gloss = _C(-4, -4, 7, 'rgba(255,255,255,0.13)');
        if (a === 0) { S.push(_C(0, 0, 20, 'm', 'line'), gloss); }
        else if (a === 1) { // швидка башта: низька, з антеною-радаром і крилами
            S.push(_C(0, 0, 17, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_R(-13, -15, 9, 3, 'l', 'line'));
            if (t >= 2) { S.push(_P([[-4, -17], [6, -27], [11, -17]], 'l', 'line'), _P(_mir([[-4, -17], [6, -27], [11, -17]]), 'l', 'line')); }
            if (t === 3) S.push(_C(0, 0, 10, null, 'a', _G), _C(7, 0, 2, 'a', null, _G));
            S.push(gloss);
        } else if (a === 2) { // броньована башта: восьмикутник із заклепками
            S.push(_P(_oct(23), 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) [[-12, -12], [12, -12], [-12, 12], [12, 12]].forEach(q => S.push(_C(q[0], q[1], 1.9, 'l')));
            if (t >= 2) S.push(_P(_oct(15), 'd', 'l'), _R(11, -9, 9, 18, 'l', 'line'));
            if (t === 3) S.push(_P(_oct(15), null, 'a', _G), _R(12, -8, 8, 16, 'm', 'a', _G));
            S.push(gloss);
        } else if (a === 3) { // універсальна: люк, перископ, смуга огляду
            S.push(_C(0, 0, 20, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(-5, 0, 6, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_R(-2, -15, 7, 4, 'l', 'line'), t === 3 ? _R(11, -7, 3, 14, 'a', null, _G) : _L(11, -6, 11, 6, 'l'));
            S.push(gloss);
        } else if (a === 4) { // дронова: круглий корпус із бічними капсулами
            S.push(_C(0, -22, 7, 'm', 'line', t === 3 ? _G : null), _C(0, 22, 7, 'm', 'line', t === 3 ? _G : null));
            S.push(_C(0, 0, 18, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(0, 0, 11, 'd', 'l'));
            if (t >= 2) S.push(_C(0, -22, 3, 'l'), _C(0, 22, 3, 'l'), _R(11, -3, 8, 6, 'l', 'line'));
            if (t === 3) S.push(_C(0, 0, 6, 'a', null, _G));
            S.push(gloss);
        } else if (a === 5) { // стелс: кутаста плита
            S.push(_P([[-20, -14], [4, -20], [24, 0], [4, 20], [-20, 14]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_L(-20, 0, 24, 0, t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_P([[-14, -9], [2, -12], [2, 12], [-14, 9]], 'd', 'l'));
            if (t === 3) S.push(_L(4, -20, 24, 0, 'a', _G), _L(4, 20, 24, 0, 'a', _G));
        } else { // радарна: купол із тарілкою
            S.push(_C(0, 0, 19, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(0, 0, 12, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_P([[-4, -22], [12, -27], [12, -17]], 'l', 'line'), _L(0, 0, 12, -22, 'l'));
            if (t === 3) S.push(_C(0, 0, 4, 'a', null, _G));
            S.push(gloss);
        }
    } else if (type === 'hull') {
        if (a === 0) { S.push(_R(-30, -22, 60, 44, 'm', 'line')); }
        else if (a === 1) { // швидкий: клиноподібний, гострий ніс
            S.push(_P([[-30, -18], [12, -22], [32, 0], [12, 22], [-30, 18]], 'm', t === 0 ? 'line' : 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_R(-26, -2, 46, 4, t === 3 ? 'a' : 'l', null, t === 3 ? _G : null));
            if (t >= 2) S.push(_R(-18, -17, 12, 4, 'd'), _R(-18, 13, 12, 4, 'd'));
            if (t === 3) S.push(_R(-31, -9, 3, 5, 'a', null, _G), _R(-31, 4, 3, 5, 'a', null, _G));
        } else if (a === 2) { // броньований: коробка зі скошеними кутами та плитами
            S.push(_P([[-30, -18], [-26, -22], [26, -22], [30, -18], [30, 18], [26, 22], [-26, 22], [-30, 18]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_R(19, -18, 9, 36, 'l', 'line'));
            if (t >= 2) { S.push(_R(-22, -21, 30, 4, 'l'), _R(-22, 17, 30, 4, 'l')); [-20, -8, 4].forEach(x => S.push(_C(x, 0, 1.8, 'l'))); }
            if (t === 3) S.push(_R(-20, -12, 36, 24, 'd', 'a', _G), _L(0, -22, 0, 22, 'a', _G), _R(19, -18, 9, 36, null, 'a', _G));
        } else if (a === 3) { // універсальний: зрізаний ніс, люк, вентиляція
            S.push(_P([[-30, -22], [18, -22], [30, -10], [30, 10], [18, 22], [-30, 22]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(-8, 0, 8, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_R(-27, -12, 3, 24, t === 3 ? 'a' : 'd', null, t === 3 ? _G : null), _R(8, -4, 12, 8, 'd'));
        } else if (a === 4) { // шестикутний
            S.push(_P([[-30, 0], [-18, -22], [18, -22], [32, 0], [18, 22], [-18, 22]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_P([[-20, 0], [-12, -13], [12, -13], [22, 0], [12, 13], [-12, 13]], 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) [-18, 18].forEach(x => S.push(_C(x, 0, 2, 'l')));
            if (t === 3) S.push(_C(0, 0, 4, 'a', null, _G));
        } else if (a === 5) { // з крилами-спойлерами
            S.push(_P([[-30, -14], [-8, -16], [30, -8], [30, 8], [-8, 16], [-30, 14]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_P([[-30, -14], [-36, -24], [-20, -22], [-14, -15]], 'l', 'line'), _P([[-30, 14], [-36, 24], [-20, 22], [-14, 15]], 'l', 'line'));
            if (t >= 2) S.push(_R(-14, -3, 30, 6, 'd'), _L(-14, 0, 26, 0, t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t === 3) S.push(_L(-30, -14, -36, -24, 'a', _G), _L(-30, 14, -36, 24, 'a', _G));
        } else { // шипований бронекороб
            S.push(_R(-28, -20, 56, 40, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) for (let x = -22; x <= 22; x += 11) S.push(_P([[x - 4, -20], [x, -26], [x + 4, -20]], 'l', 'line'), _P([[x - 4, 20], [x, 26], [x + 4, 20]], 'l', 'line'));
            if (t >= 2) S.push(_R(-20, -12, 40, 24, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t === 3) S.push(_C(0, 0, 5, 'a', null, _G));
        }
    } else if (type === 'tracks') {
        [-32, 18].forEach((y0, side) => {
            const outerTop = side === 0;
            if (a === 0) { S.push(_R(-36, y0, 72, 14, 'm', 'line')); }
            else if (a === 1) { // швидкі: вузькі, з круглими колесами
                S.push(_R(-36, y0 + 2, 72, 10, 'm', 'line', t === 3 ? _G : null));
                for (let x = -30; x <= 30; x += 10) S.push(_L(x, y0 + 4, x, y0 + 10, 'd'));
                if (t >= 1) S.push(_C(-33, y0 + 7, 5, 'l', 'line'), _C(33, y0 + 7, 5, 'l', 'line'));
                if (t === 3) S.push(_L(-28, y0 + 7, 28, y0 + 7, 'a', _G));
            } else if (a === 2) { // броньовані: широкі, зі щитками-спідницями
                S.push(_R(-36, y0, 72, 14, 'm', 'line'));
                for (let x = -30; x <= 30; x += 10) S.push(_L(x, y0 + 4, x, y0 + 10, 'd'));
                if (t >= 1) S.push(_R(-30, outerTop ? y0 - 1 : y0 + 11, 60, 4, t === 3 ? 'd' : 'l', t === 3 ? 'a' : 'line', t === 3 ? _G : null));
                if (t >= 2) [-22, -8, 8, 22].forEach(x => S.push(_C(x, outerTop ? y0 + 1 : y0 + 13, 1.4, t === 3 ? 'a' : 'd')));
            } else if (a === 3) { // універсальні: шипована гума
                S.push(_R(-36, y0, 72, 14, 'm', 'line', t === 3 ? _G : null));
                if (t >= 1) for (let x = -30; x <= 30; x += 8) S.push(_C(x, y0 + 7, 1.7, t === 3 ? 'a' : 'l', null, t === 3 ? _G : null));
                if (t >= 2) S.push(_C(-34, y0 + 7, 4, 'd', 'l'), _C(34, y0 + 7, 4, 'd', 'l'));
            } else if (a === 4) { // великі опорні колеса
                S.push(_R(-36, y0 + 1, 72, 12, 'm', 'line', t === 3 ? _G : null));
                [-26, -9, 9, 26].forEach(x => S.push(_C(x, y0 + 7, t === 0 ? 4.5 : 5.5, 'd', t >= 1 ? 'l' : 'line', t === 3 ? _G : null)));
                if (t >= 2) [-26, -9, 9, 26].forEach(x => S.push(_C(x, y0 + 7, 1.8, t === 3 ? 'a' : 'l')));
            } else if (a === 5) { // зубчасті траки
                S.push(_R(-36, y0, 72, 14, 'm', 'line', t === 3 ? _G : null));
                for (let x = -33; x <= 31; x += 6) S.push(_P([[x, y0 + 2], [x + 3, y0 + 12], [x + 6, y0 + 2]], t >= 1 ? 'l' : 'd', null, t === 3 ? _G : null));
                if (t >= 2) S.push(_C(-33, y0 + 7, 4, 'd', 'l'), _C(33, y0 + 7, 4, 'd', 'l'));
            } else { // магнітні подушки
                for (let x = -34; x <= 24; x += 20) S.push(_R(x, y0 + 1, 16, 12, 'm', 'line', t >= 2 ? _G : null));
                if (t >= 1) S.push(_L(-34, y0 + 7, 34, y0 + 7, t === 3 ? 'a' : 'l', t === 3 ? _G : null));
                if (t >= 2) for (let x = -26; x <= 26; x += 20) S.push(_C(x, y0 + 7, 2.2, 'a', null, _G));
            }
        });
    }
    return S;
}

const _modShapeCache = {};
function modShapes(type, mod) {
    const key = mod ? mod.id : type + '_default';
    if (!_modShapeCache[key]) _modShapeCache[key] = (mod && MYTHIC_SHAPES[mod.id]) ? MYTHIC_SHAPES[mod.id](Math.round(46 * ((mod.stats && mod.stats.range) || 1))) : buildModShapes(type, mod ? modArch(mod) : 0, mod ? Math.min(3, MOD_TIER[mod.rarity]) : 0, mod ? mod.stats : null);
    return _modShapeCache[key];
}
function _tok(tk, pal) { if (!tk) return null; return tk === 'line' ? pal.line : (tk === 'm' || tk === 'd' || tk === 'l') ? pal[tk] : tk === 'a' ? pal.acc : tk; }

// Малювання на канвасі (контекст уже повернутий на кут корпуса/башти)
function drawModVis(c, type, modOrId, T) {
    const mod = typeof modOrId === 'string' ? MODULES[modOrId] : modOrId, pal = modPalette(mod ? mod.rarity : null), shapes = modShapes(type, mod || null);
    c.lineJoin = 'round';
    for (const s of shapes) {
        const f = _tok(s.f, pal), st = _tok(s.s, pal);
        if (s.g && pal.tier >= 2) { c.shadowColor = pal.acc; c.shadowBlur = pal.tier === 4 ? 12 + 4 * Math.sin((T || 0) * 3) : pal.tier === 3 ? 8 + 3 * Math.sin((T || 0) * 2.2) : 4; } else c.shadowBlur = 0;
        c.lineWidth = s.k === 'l' ? 1.6 : 1.5;
        if (s.k === 'r') { if (f) { c.fillStyle = f; c.fillRect(s.x, s.y, s.w, s.h); } if (st) { c.strokeStyle = st; c.strokeRect(s.x, s.y, s.w, s.h); } }
        else if (s.k === 'p') { c.beginPath(); s.p.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.stroke(); } }
        else if (s.k === 'c') { c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); if (f) { c.fillStyle = f; c.fill(); } if (st) { c.strokeStyle = st; c.stroke(); } }
        else if (s.k === 'l') { c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.strokeStyle = st; c.stroke(); }
    }
    c.shadowBlur = 0;
}

// SVG-іконка модуля (інвентар, магазин, апгрейдер, рулетка)
const _modIconCache = {};
function modIcon(mod) {
    if (!mod) return '';
    if (_modIconCache[mod.id]) return _modIconCache[mod.id];
    const pal = modPalette(mod.rarity), shapes = modShapes(mod.type, mod), W = 1.5 * 1.35;
    const el = (s) => {
        const f = _tok(s.f, pal), st = _tok(s.s, pal), at = `fill="${f || 'none'}" stroke="${st || 'none'}" stroke-width="${W}" stroke-linejoin="round"`;
        if (s.k === 'r') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" ${at}/>`;
        if (s.k === 'p') return `<polygon points="${s.p.map(q => q.join(',')).join(' ')}" ${at}/>`;
        if (s.k === 'c') return `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" ${at}/>`;
        return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${st}" stroke-width="${W}"/>`;
    };
    // світяться лише відмічені деталі (g); порядок малювання зберігається
    const glowPx = pal.tier === 4 ? 4.5 : pal.tier === 3 ? 3 : pal.tier === 2 ? 1.6 : 0, gst = glowPx ? ` style="filter:drop-shadow(0 0 ${glowPx}px ${pal.acc})"` : '';
    const body = shapes.map(s => { const e = el(s); return (s.g && glowPx) ? e.replace('/>', gst + '/>') : e; }).join('');
    const vb = mod.type === 'cannon' ? '-26 -67 52 70' : mod.type === 'turret' ? '-28 -28 56 56' : mod.type === 'hull' ? '-37 -37 74 74' : '-38 -38 76 76';
    const rot = mod.type === 'turret' ? '' : ' transform="rotate(-90)"';
    const svg = `<svg viewBox="${vb}" style="width:100%;height:100%;overflow:visible"><g${rot}>${body}</g></svg>`;
    return (_modIconCache[mod.id] = svg);
}

// ===== ІКОНКИ КЕЙСІВ =====
// Дешеві кейси (<400) — прості плоскі малюнки без світіння; дорожчі — медальйон зі світінням;
// найдорожчі (>=800) — подвійний обідок, обертові промені й іскри.
const _CASE_EMBLEMS = {
    crate: (c, d) => `<rect x="11" y="17" width="42" height="32" rx="3" fill="${c}" stroke="${d}" stroke-width="2.5"/><path d="M11 25H53M11 41H53M23 17V49M41 17V49" stroke="${d}" stroke-width="2" opacity=".55"/>`,
    cannon: (c, d) => `<rect x="6" y="25" width="38" height="13" rx="2.5" fill="${c}" stroke="${d}" stroke-width="2.5"/><rect x="40" y="21" width="15" height="21" rx="2.5" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="20" cy="46" r="8" fill="${d}" stroke="${c}" stroke-width="2.5"/>`,
    turret: (c, d) => `<circle cx="28" cy="34" r="17" fill="${c}" stroke="${d}" stroke-width="2.5"/><rect x="42" y="29" width="17" height="10" rx="2.5" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="28" cy="34" r="7" fill="${d}"/>`,
    hull: (c, d) => `<path d="M7 42L13 27H51L58 42V49H7Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><rect x="21" y="16" width="22" height="11" rx="2.5" fill="${c}" stroke="${d}" stroke-width="2.5"/><path d="M13 42H58" stroke="${d}" stroke-width="2"/>`,
    tracks: (c, d) => `<rect x="5" y="30" width="54" height="20" rx="10" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="16" cy="40" r="5" fill="${d}"/><circle cx="32" cy="40" r="5" fill="${d}"/><circle cx="48" cy="40" r="5" fill="${d}"/>`,
    ghost: (c, d) => `<path d="M14 54V30a18 18 0 0 1 36 0V54l-6-5-6 5-6-5-6 5-6-5Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="25" cy="30" r="3.5" fill="${d}"/><circle cx="39" cy="30" r="3.5" fill="${d}"/>`,
    shield: (c, d) => `<path d="M32 7L53 15V32C53 44 44 52 32 58C20 52 11 44 11 32V15Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 15V50M17 28H47" stroke="${d}" stroke-width="2.2" opacity=".6"/>`,
    eye: (c, d) => `<path d="M5 32Q32 7 59 32Q32 57 5 32Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="32" r="11" fill="${d}"/><circle cx="32" cy="32" r="4.5" fill="${c}"/>`,
    fang: (c, d) => [0, 15, 30].map(o => `<path d="M${10 + o} 8L${20 + o} 57L${14 + o} 57L${3 + o} 12Z" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>`).join(''),
    case: (c, d) => `<rect x="8" y="22" width="48" height="30" rx="4" fill="${c}" stroke="${d}" stroke-width="2.5"/><path d="M22 22V16Q22 12 26 12H38Q42 12 42 16V22M8 35H56" fill="none" stroke="${d}" stroke-width="2.5"/><rect x="28" y="31" width="8" height="9" rx="1.5" fill="${d}"/>`,
    medal: (c, d) => `<path d="M19 6L32 28L45 6" fill="${c}" stroke="${d}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="32" cy="39" r="17" fill="${c}" stroke="${d}" stroke-width="2.5"/><polygon points="32,28 35,36 43,36 37,41 39,49 32,44 25,49 27,41 21,36 29,36" fill="${d}"/>`,
    star: (c, d) => `<polygon points="32,5 40,24 60,25 44,38 50,58 32,46 14,58 20,38 4,25 24,24" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><polygon points="32,20 35,28 43,29 37,34 39,42 32,38 25,42 27,34 21,29 29,28" fill="${d}" opacity=".45"/>`,
    mask: (c, d) => `<path d="M7 18Q32 8 57 18V34Q57 54 32 59Q7 54 7 34Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 31Q22 24 28 33Q22 38 14 31ZM50 31Q42 24 36 33Q42 38 50 31Z" fill="${d}"/><path d="M24 48Q32 52 40 48" stroke="${d}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
    gem: (c, d) => `<polygon points="17,10 47,10 59,26 32,58 5,26" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M5 26H59M17 10L24 26L32 58L40 26L47 10M24 26H40" stroke="${d}" stroke-width="2" fill="none" opacity=".55" stroke-linejoin="round"/>`,
    crown: (c, d) => `<path d="M8 47L10 17L23 31L32 11L41 31L54 17L56 47Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><rect x="8" y="47" width="48" height="9" rx="2" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="32" cy="38" r="3.5" fill="${d}"/><circle cx="19" cy="40" r="2.5" fill="${d}"/><circle cx="45" cy="40" r="2.5" fill="${d}"/>`,
    demon: (c, d) => `<path d="M10 6Q6 24 17 30L47 30Q58 24 54 6Q44 16 32 16Q20 16 10 6Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M15 28Q15 54 32 59Q49 54 49 28Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M19 35L29 40L19 43ZM45 35L35 40L45 43Z" fill="${d}"/><path d="M23 52L27 48L32 52L37 48L41 52" stroke="${d}" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`,
    storm: (c, d) => `<path d="M17 40A10 10 0 0 1 19 20A14 14 0 0 1 45 23A9 9 0 0 1 44 40Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><path d="M35 33L25 49H33L28 61L43 43H35L40 33Z" fill="#fff" stroke="${d}" stroke-width="2" stroke-linejoin="round"/>`,
    throne: (c, d) => `<path d="M15 6V38H11V50H53V38H49V6L40 15L32 5L24 15Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><rect x="15" y="38" width="34" height="7" fill="${d}" opacity=".45"/><rect x="9" y="50" width="46" height="8" rx="2" fill="${c}" stroke="${d}" stroke-width="2.5"/>`,
    vortex: (c, d) => `<path d="M32 32a4 4 0 0 1 8 0a8 8 0 0 1-16 0a12 12 0 0 1 24 0a16 16 0 0 1-32 0a20 20 0 0 1 40 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M32 32a4 4 0 0 1 8 0a8 8 0 0 1-16 0a12 12 0 0 1 24 0a16 16 0 0 1-32 0a20 20 0 0 1 40 0" fill="none" stroke="${d}" stroke-width="1.4" stroke-linecap="round" opacity=".6"/>`,
    omega: (c, d) => `<circle cx="32" cy="32" r="26" fill="none" stroke="${c}" stroke-width="3.5"/><path d="M13 46H24V42C16 38 14 31 17 24C20 17 27 14 32 14C37 14 44 17 47 24C50 31 48 38 40 42V46H51V51H34V41C42 38 43 31 41 26C39 21 35 19 32 19C29 19 25 21 23 26C21 31 22 38 30 41V51H13Z" fill="${c}" stroke="${d}" stroke-width="1.6" stroke-linejoin="round"/>`,
    emperor: (c, d) => `<path d="M32 5L38 20L60 12L52 34L42 36L32 58L22 36L12 34L4 12L26 20Z" fill="${c}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="29" r="7" fill="${d}"/><circle cx="32" cy="29" r="3" fill="#fff"/>`,
    absolute: (c, d) => `<polygon points="32,3 37,22 53,10 42,27 61,32 42,37 53,54 37,42 32,61 27,42 11,54 22,37 3,32 22,27 11,10 27,22" fill="${c}" stroke="${d}" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="32" r="10" fill="${d}"/><circle cx="32" cy="32" r="5" fill="#fff"/>`
};
// Рівні вигляду: 0 — простий, 1 — світиться, 2 — преміум (промені, іскри)
function caseTier(cs) { return cs.price >= 800 ? 2 : cs.price >= 400 ? 1 : 0; }
const _caseIconCache = {};
function caseIcon(cs) {
    const key = cs.theme + cs.price;
    if (_caseIconCache[key]) return _caseIconCache[key];
    const tier = caseTier(cs), c = cs.color, d = '#0b1020', em = (_CASE_EMBLEMS[cs.theme] || _CASE_EMBLEMS.crate), id = 'cg' + cs.theme;
    let svg;
    if (tier === 0) {
        svg = `<svg viewBox="0 0 64 64" style="width:100%;height:100%;overflow:visible"><circle cx="32" cy="32" r="30" fill="#111a2e" stroke="${c}" stroke-opacity=".35" stroke-width="2"/><g transform="translate(32 33) scale(.82) translate(-32 -32)">${em(c, d)}</g></svg>`;
    } else if (tier === 1) {
        svg = `<svg viewBox="0 0 64 64" style="width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 7px ${c}) drop-shadow(0 0 14px ${c}88)"><defs><radialGradient id="${id}b" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="#0b1020"/></radialGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="url(#${id}b)" stroke="${c}" stroke-width="2.5"/><circle cx="32" cy="32" r="26.5" fill="none" stroke="${c}" stroke-opacity=".4" stroke-width="1"/><g transform="translate(32 33) scale(.78) translate(-32 -32)">${em('url(#' + id + 'f)', d)}</g></svg>`;
    } else {
        let rays = ''; for (let i = 0; i < 12; i++) { rays += `<path d="M32 32L${(32 + 40 * Math.cos(i * Math.PI / 6 - .09)).toFixed(1)} ${(32 + 40 * Math.sin(i * Math.PI / 6 - .09)).toFixed(1)}L${(32 + 40 * Math.cos(i * Math.PI / 6 + .09)).toFixed(1)} ${(32 + 40 * Math.sin(i * Math.PI / 6 + .09)).toFixed(1)}Z" fill="${c}" opacity=".35"/>`; }
        svg = `<svg viewBox="-6 -6 76 76" style="width:100%;height:100%;overflow:visible;filter:drop-shadow(0 0 8px ${c}) drop-shadow(0 0 18px ${c})"><defs><radialGradient id="${id}b" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${c}" stop-opacity=".7"/><stop offset="1" stop-color="#0b1020"/></radialGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="${c}"/><stop offset="1" stop-color="${c}"/></linearGradient></defs><g><animateTransform attributeName="transform" type="rotate" from="0 32 32" to="360 32 32" dur="18s" repeatCount="indefinite"/>${rays}</g><circle cx="32" cy="32" r="30" fill="url(#${id}b)" stroke="${c}" stroke-width="3"/><circle cx="32" cy="32" r="25.5" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1"/><g transform="translate(32 33) scale(.74) translate(-32 -32)">${em('url(#' + id + 'f)', d)}</g><g fill="#fff"><circle cx="10" cy="12" r="1.6"><animate attributeName="opacity" values="0;1;0" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="56" cy="16" r="1.3"><animate attributeName="opacity" values="0;1;0" dur="3.1s" begin=".7s" repeatCount="indefinite"/></circle><circle cx="54" cy="52" r="1.7"><animate attributeName="opacity" values="0;1;0" dur="2.7s" begin="1.2s" repeatCount="indefinite"/></circle><circle cx="11" cy="50" r="1.2"><animate attributeName="opacity" values="0;1;0" dur="3.4s" begin=".3s" repeatCount="indefinite"/></circle></g></svg>`;
    }
    return (_caseIconCache[key] = svg);
}
