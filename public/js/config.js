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

const RARITY = {
    'common':{name:'Звичайний',color:'#94a3b8'},
    'rare':{name:'Рідкісний',color:'#3b82f6'},
    'epic':{name:'Епічний',color:'#a855f7'},
    'legendary':{name:'Легендарний',color:'#eab308'}
};

const CAT_NAMES = {'cannon':'ДУЛО','turret':'БАШТА','hull':'КОРПУС','tracks':'ГУСЕНИЦІ'};

const SVG_ICONS = {
    'cannon': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="9" y="2" width="6" height="12" rx="1"></rect><path d="M12 14v8"></path><path d="M8 22h8"></path></svg>`,
    'turret': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    'hull': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><path d="M4 6h16v12H4z"></path><path d="M8 6V4h8v2"></path></svg>`,
    'tracks': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="4" y="2" width="4" height="20" rx="1"></rect><rect x="16" y="2" width="4" height="20" rx="1"></rect><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path></svg>`
};

const MODULES = {'can_c1':{id:'can_c1',type:'cannon',rarity:'common',name:'Іскра',price:15,stats:{cd:0.96,dmg:0.98,range:1.00}},'can_c2':{id:'can_c2',type:'cannon',rarity:'common',name:'Чавун',price:25,stats:{dmg:1.05,cd:1.03,range:0.98}},'can_c3':{id:'can_c3',type:'cannon',rarity:'common',name:'Подовжене',price:40,stats:{range:1.05,dmg:1.02,cd:1.02}},'can_r1':{id:'can_r1',type:'cannon',rarity:'rare',name:'Блискавка',price:60,stats:{cd:0.9,dmg:0.93,range:1.00}},'can_r2':{id:'can_r2',type:'cannon',rarity:'rare',name:'Молот',price:90,stats:{dmg:1.1,cd:1.06,range:0.95}},'can_r3':{id:'can_r3',type:'cannon',rarity:'rare',name:'Снайпер',price:130,stats:{range:1.12,dmg:1.06,cd:1.06}},'can_e1':{id:'can_e1',type:'cannon',rarity:'epic',name:'Квазар',price:170,stats:{cd:0.84,dmg:0.88,range:1.00}},'can_e2':{id:'can_e2',type:'cannon',rarity:'epic',name:'Титан',price:220,stats:{dmg:1.18,cd:1.12,range:0.92}},'can_e3':{id:'can_e3',type:'cannon',rarity:'epic',name:'Каратель',price:280,stats:{range:1.22,dmg:1.12,cd:1.1}},'can_l1':{id:'can_l1',type:'cannon',rarity:'legendary',name:'Пульсар',price:350,stats:{cd:0.78,dmg:0.82,range:1.00}},'can_l2':{id:'can_l2',type:'cannon',rarity:'legendary',name:'Колос',price:450,stats:{dmg:1.28,cd:1.2,range:0.88}},'can_l3':{id:'can_l3',type:'cannon',rarity:'legendary',name:'Армагеддон',price:550,stats:{range:1.35,dmg:1.22,cd:1.18}},'tur_c1':{id:'tur_c1',type:'turret',rarity:'common',name:'Легка',price:15,stats:{rotSpeed:1.04,hp:0.98}},'tur_c2':{id:'tur_c2',type:'turret',rarity:'common',name:'Клепана',price:25,stats:{hp:1.03,rotSpeed:0.98}},'tur_c3':{id:'tur_c3',type:'turret',rarity:'common',name:'Оптика',price:40,stats:{rotSpeed:1.02,hp:0.99}},'tur_r1':{id:'tur_r1',type:'turret',rarity:'rare',name:'Спритна',price:60,stats:{rotSpeed:1.10,hp:0.95}},'tur_r2':{id:'tur_r2',type:'turret',rarity:'rare',name:'Щит',price:90,stats:{hp:1.08,rotSpeed:0.95}},'tur_r3':{id:'tur_r3',type:'turret',rarity:'rare',name:'Скаут',price:130,stats:{rotSpeed:1.05,hp:0.97}},'tur_e1':{id:'tur_e1',type:'turret',rarity:'epic',name:'Віраж',price:170,stats:{rotSpeed:1.20,hp:0.90}},'tur_e2':{id:'tur_e2',type:'turret',rarity:'epic',name:'Фортеця',price:220,stats:{hp:1.15,rotSpeed:0.9}},'tur_e3':{id:'tur_e3',type:'turret',rarity:'epic',name:'Вартовий',price:280,stats:{rotSpeed:1.12,hp:0.94}},'tur_l1':{id:'tur_l1',type:'turret',rarity:'legendary',name:'Міраж',price:350,stats:{rotSpeed:1.35,hp:0.9}},'tur_l2':{id:'tur_l2',type:'turret',rarity:'legendary',name:'Бастіон',price:450,stats:{hp:1.2,rotSpeed:0.85}},'tur_l3':{id:'tur_l3',type:'turret',rarity:'legendary',name:'Яструб',price:550,stats:{rotSpeed:1.20,hp:0.90}},'hul_c1':{id:'hul_c1',type:'hull',rarity:'common',name:'Каркас',price:15,stats:{speed:1.04,hp:0.98}},'hul_c2':{id:'hul_c2',type:'hull',rarity:'common',name:'Панцер',price:25,stats:{hp:1.04,speed:0.98}},'hul_c3':{id:'hul_c3',type:'hull',rarity:'common',name:'Розвідник',price:40,stats:{speed:1.02,hp:0.99}},'hul_r1':{id:'hul_r1',type:'hull',rarity:'rare',name:'Болід',price:60,stats:{speed:1.10,hp:0.95}},'hul_r2':{id:'hul_r2',type:'hull',rarity:'rare',name:'Броньовик',price:90,stats:{hp:1.1,speed:0.95}},'hul_r3':{id:'hul_r3',type:'hull',rarity:'rare',name:'Авангард',price:130,stats:{speed:1.05,hp:0.97}},'hul_e1':{id:'hul_e1',type:'hull',rarity:'epic',name:'Фантом',price:170,stats:{speed:1.20,hp:0.90}},'hul_e2':{id:'hul_e2',type:'hull',rarity:'epic',name:'Моноліт',price:220,stats:{hp:1.18,speed:0.9}},'hul_e3':{id:'hul_e3',type:'hull',rarity:'epic',name:'Хижак',price:280,stats:{speed:1.10,hp:0.94}},'hul_l1':{id:'hul_l1',type:'hull',rarity:'legendary',name:'Тінь',price:350,stats:{speed:1.35,hp:0.85}},'hul_l2':{id:'hul_l2',type:'hull',rarity:'legendary',name:'Егіда',price:450,stats:{hp:1.28,speed:0.85}},'hul_l3':{id:'hul_l3',type:'hull',rarity:'legendary',name:'Ассасін',price:550,stats:{speed:1.15,hp:0.90}},'trk_c1':{id:'trk_c1',type:'tracks',rarity:'common',name:'Тонкі',price:15,stats:{speed:1.04,hp:0.98}},'trk_c2':{id:'trk_c2',type:'tracks',rarity:'common',name:'Важкі',price:25,stats:{hp:1.04,speed:0.98}},'trk_c3':{id:'trk_c3',type:'tracks',rarity:'common',name:'Гібрид',price:40,stats:{speed:1.02,hp:0.99}},'trk_r1':{id:'trk_r1',type:'tracks',rarity:'rare',name:'Ралійні',price:60,stats:{speed:1.10,hp:0.95}},'trk_r2':{id:'trk_r2',type:'tracks',rarity:'rare',name:'Всюдихід',price:90,stats:{hp:1.1,speed:0.95}},'trk_r3':{id:'trk_r3',type:'tracks',rarity:'rare',name:'Посилені',price:130,stats:{speed:1.05,hp:0.97}},'trk_e1':{id:'trk_e1',type:'tracks',rarity:'epic',name:'Граві',price:170,stats:{speed:1.20,hp:0.90}},'trk_e2':{id:'trk_e2',type:'tracks',rarity:'epic',name:'Гусеничні',price:220,stats:{hp:1.18,speed:0.9}},'trk_e3':{id:'trk_e3',type:'tracks',rarity:'epic',name:'Адаптивні',price:280,stats:{speed:1.10,hp:0.94}},'trk_l1':{id:'trk_l1',type:'tracks',rarity:'legendary',name:'Струм',price:350,stats:{speed:1.35,hp:0.85}},'trk_l2':{id:'trk_l2',type:'tracks',rarity:'legendary',name:'Скала',price:450,stats:{hp:1.28,speed:0.85}},'trk_l3':{id:'trk_l3',type:'tracks',rarity:'legendary',name:'Кіготь',price:550,stats:{speed:1.15,hp:0.90}}};

const CASES = {
    1:{name:'МІКС',price:110,icon:'📦',color:'#3b82f6',drop:{c:60,r:30,e:9,l:1},pool:'all'},
    2:{name:'ПРИВИД',price:100,icon:'👻',color:'#a855f7',drop:{c:50,r:35,e:12,l:3},pool:['can_c1','can_r1','can_e1','can_l1','tur_c1','tur_r1','tur_e1','tur_l1','hul_c3','hul_r1','hul_e1','hul_l1','trk_c1','trk_r1','trk_e1','trk_l1']},
    3:{name:'ДЖАГГЕРНАУТ',price:130,icon:'🛡️',color:'#eab308',drop:{c:50,r:35,e:12,l:3},pool:['tur_c2','tur_r2','tur_e2','tur_l2','hul_c1','hul_r2','hul_e2','hul_l2','trk_c2','trk_r2','trk_e2','trk_l2']},
    4:{name:'ХИЖАК',price:175,icon:'🎯',color:'#ef4444',drop:{c:50,r:35,e:12,l:3},pool:['can_c2','can_r2','can_e2','can_l2','can_c3','can_r3','can_e3','can_l3','tur_c3','tur_r3','tur_e3','tur_l3','hul_c2','hul_r3','hul_e3','hul_l3','trk_c3','trk_r3','trk_e3','trk_l3']},
    5:{name:'ЗБРОЙОВИЙ',price:110,icon:'⚔️',color:'#f87171',drop:{c:60,r:30,e:9,l:1},pool:'cannon'},
    6:{name:'БАШТОВИЙ',price:110,icon:'🗼',color:'#60a5fa',drop:{c:60,r:30,e:9,l:1},pool:'turret'},
    7:{name:'БРОНЬОВИЙ',price:110,icon:'🏗️',color:'#4ade80',drop:{c:60,r:30,e:9,l:1},pool:'hull'},
    8:{name:'ХОДОВИЙ',price:110,icon:'🚜',color:'#fb923c',drop:{c:60,r:30,e:9,l:1},pool:'tracks'},
    9:{name:'ВЕТЕРАН',price:210,icon:'🎖️',color:'#818cf8',drop:{c:0,r:75,e:22,l:3},pool:'all'},
    10:{name:'ЕЛІТА',price:410,icon:'💎',color:'#c084fc',drop:{c:0,r:0,e:85,l:15},pool:'all'},
    11:{name:'БІЗНЕС',price:200,icon:'💼',color:'#fbbf24',drop:{c:30,r:40,e:25,l:5},pool:'all'},
    12:{name:'ЛЕГЕНДА',price:720,icon:'👑',color:'#fb7185',drop:{c:0,r:0,e:0,l:100},pool:'all'}
};

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
    if (st.rotSpeed) add('Швидкість башти', st.rotSpeed);
    return rows;
}
function modStatsHtml(mod, sep) {
    return modStatRows(mod).map(r => `<span style="color:${r.good ? '#34d399' : '#f87171'}">${r.name}: ${r.pct > 0 ? '+' : ''}${r.pct}%</span>`).join(sep || '<br>');
}

// ===== ВІЗУАЛ МОДУЛІВ (єдине джерело форм для танка на канвасі та для SVG-іконок) =====
// Правило: звичайні модулі — прості й матові, рідкісні — з кольоровим контуром,
// епічні — з деталями та слабким світінням, легендарні — м'яке неонове світіння, що пульсує.
// Форма залежить від архетипу (цифра в id: 1 = швидкість/скорострільність, 2 = броня/урон, 3 = універсал/дальність) та рівня рідкості.
const MOD_TIER = { common: 0, rare: 1, epic: 2, legendary: 3 };
function modArch(mod) { const m = /_[a-z](\d)$/.exec(mod.id); return m ? parseInt(m[1], 10) : 1; }

function modPalette(rarity) {
    if (!rarity) return { acc: '#475569', tier: 0, m: '#1e293b', d: '#0f172a', l: '#334155', line: '#334155' };
    const tier = MOD_TIER[rarity], acc = RARITY[rarity].color;
    return { acc: acc, tier: tier, m: ['#56627a', '#4a5875', '#3f4a6b', '#2b3254'][tier], d: '#161c2b', l: ['#7c889c', '#93a8cc', '#c3b0ea', '#f6e3a0'][tier], line: tier === 0 ? '#8793a8' : acc };
}

const _R = (x, y, w, h, f, s, o) => Object.assign({ k: 'r', x: x, y: y, w: w, h: h, f: f, s: s }, o || {});
const _P = (p, f, s, o) => Object.assign({ k: 'p', p: p, f: f, s: s }, o || {});
const _C = (x, y, r, f, s, o) => Object.assign({ k: 'c', x: x, y: y, r: r, f: f, s: s }, o || {});
const _L = (x1, y1, x2, y2, s, o) => Object.assign({ k: 'l', x1: x1, y1: y1, x2: x2, y2: y2, s: s }, o || {});
const _G = { g: true };
const _mir = (pts) => pts.map(p => [p[0], -p[1]]);
const _oct = (r) => { const a = []; for (let i = 0; i < 8; i++) { const t = Math.PI / 8 + i * Math.PI / 4; a.push([+(Math.cos(t) * r).toFixed(2), +(Math.sin(t) * r).toFixed(2)]); } return a; };

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
        } else { // дальнобійна: довга й тонка, приціл
            if (t === 0) S.push(_R(0, -4, L, 8, 'm', 'line'));
            else if (t === 1) S.push(_R(0, -4, L, 8, 'm', 'line'), _R(L * 0.3, -9, 12, 4, 'l', 'line'));
            else if (t === 2) S.push(_P([[0, -5], [L, -3], [L, 3], [0, 5]], 'm', 'line'), _R(L * 0.28, -10, 14, 5, 'd', 'a', _G), _R(L - 5, -4, 5, 8, 'l', 'line'));
            else S.push(_P([[0, -5], [L, -3], [L, 3], [0, 5]], 'm', 'a', _G), _R(L * 0.28, -10, 14, 5, 'd', 'a'), _C(L * 0.28 + 14, -7.5, 2.2, 'a', null, _G), _L(4, 0, L - 3, 0, 'a', _G), _R(L - 5, -4, 5, 8, 'a', null, _G));
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
        } else { // універсальна: люк, перископ, смуга огляду
            S.push(_C(0, 0, 20, 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(-5, 0, 6, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_R(-2, -15, 7, 4, 'l', 'line'), t === 3 ? _R(11, -7, 3, 14, 'a', null, _G) : _L(11, -6, 11, 6, 'l'));
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
        } else { // універсальний: зрізаний ніс, люк, вентиляція
            S.push(_P([[-30, -22], [18, -22], [30, -10], [30, 10], [18, 22], [-30, 22]], 'm', 'line', t === 3 ? _G : null));
            if (t >= 1) S.push(_C(-8, 0, 8, 'd', t === 3 ? 'a' : 'l', t === 3 ? _G : null));
            if (t >= 2) S.push(_R(-27, -12, 3, 24, t === 3 ? 'a' : 'd', null, t === 3 ? _G : null), _R(8, -4, 12, 8, 'd'));
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
            } else { // універсальні: шипована гума
                S.push(_R(-36, y0, 72, 14, 'm', 'line', t === 3 ? _G : null));
                if (t >= 1) for (let x = -30; x <= 30; x += 8) S.push(_C(x, y0 + 7, 1.7, t === 3 ? 'a' : 'l', null, t === 3 ? _G : null));
                if (t >= 2) S.push(_C(-34, y0 + 7, 4, 'd', 'l'), _C(34, y0 + 7, 4, 'd', 'l'));
            }
        });
    }
    return S;
}

const _modShapeCache = {};
function modShapes(type, mod) {
    const key = mod ? mod.id : type + '_default';
    if (!_modShapeCache[key]) _modShapeCache[key] = buildModShapes(type, mod ? modArch(mod) : 0, mod ? MOD_TIER[mod.rarity] : 0, mod ? mod.stats : null);
    return _modShapeCache[key];
}
function _tok(tk, pal) { if (!tk) return null; return tk === 'line' ? pal.line : (tk === 'm' || tk === 'd' || tk === 'l') ? pal[tk] : tk === 'a' ? pal.acc : tk; }

// Малювання на канвасі (контекст уже повернутий на кут корпуса/башти)
function drawModVis(c, type, modOrId, T) {
    const mod = typeof modOrId === 'string' ? MODULES[modOrId] : modOrId, pal = modPalette(mod ? mod.rarity : null), shapes = modShapes(type, mod || null);
    c.lineJoin = 'round';
    for (const s of shapes) {
        const f = _tok(s.f, pal), st = _tok(s.s, pal);
        if (s.g && pal.tier >= 2) { c.shadowColor = pal.acc; c.shadowBlur = pal.tier === 3 ? 8 + 3 * Math.sin((T || 0) * 2.2) : 4; } else c.shadowBlur = 0;
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
    const glowPx = pal.tier === 3 ? 3 : pal.tier === 2 ? 1.6 : 0, gst = glowPx ? ` style="filter:drop-shadow(0 0 ${glowPx}px ${pal.acc})"` : '';
    const body = shapes.map(s => { const e = el(s); return (s.g && glowPx) ? e.replace('/>', gst + '/>') : e; }).join('');
    const vb = mod.type === 'cannon' ? '-26 -67 52 70' : mod.type === 'turret' ? '-28 -28 56 56' : mod.type === 'hull' ? '-37 -37 74 74' : '-38 -38 76 76';
    const rot = mod.type === 'turret' ? '' : ' transform="rotate(-90)"';
    const svg = `<svg viewBox="${vb}" style="width:100%;height:100%;overflow:visible"><g${rot}>${body}</g></svg>`;
    return (_modIconCache[mod.id] = svg);
}
