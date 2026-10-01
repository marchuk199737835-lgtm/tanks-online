let myId = null;
let myName = "", myColor = null, isReady = false, isAdmin = false;
let authMode = 'login';
let myBucks = 0;
let myUpgrades = { damage: 0, speed: 0, earnings: 0 };
const MAX_HP = 500;
const TANK_SPEED = 280;
const BASE_BULLET_SPEED = 700;

let currentRoomId = null; let currentRoomData = null;
let myLocalTank = { x: 0, y: 0, bodyAngle: 0, turretAngle: 0, hp: MAX_HP, buffProgress: 0, score: 0 };
let opponents = {}; let powerups = {}; let tokens = {}; let zombies = {}; let bullets = []; let particles = [];
const keys = { w: false, a: false, s: false, d: false, space: false };
let mouseX = 0, mouseY = 0; let lastShootTime = 0; let camera = { x: 0, y: 0 }; let shakeTime = 0; let homingTargetId = null;
let gameLoopId = null; let lastTime = 0;

const MAP_DATA = { 'city': { size: 3600, bg: '#020617', grid: '#1e293b', solids: [] }, 'hangars': { size: 3000, bg: '#0f172a', grid: '#334155', solids: [] }, 'ship': { size: 2000, bg: '#1e293b', grid: '#475569', solids: [] }, 'castle': { size: 2500, bg: '#1c1917', grid: '#292524', solids: [] } };
const neonColors = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981'];
for(let x=200; x<3400; x+=450) { for(let y=200; y<3400; y+=450) { let n = (x*13 + y*17) % 100; if(n < 75) MAP_DATA['city'].solids.push({ type: 'wall', x, y, w: 300, h: 300, color: '#09090b', neon: neonColors[n % neonColors.length] }); } }
const hangarColors = ['#0f172a', '#020617', '#1e293b'];
for(let x=150; x<2800; x+=350) { for(let y=150; y<2800; y+=300) { let n = (x*23 + y*29) % 100; if(n < 60) MAP_DATA['hangars'].solids.push({ type: 'wall', x, y, w: 250, h: 150, color: hangarColors[n % hangarColors.length], stripe: (n%2===0)?'#eab308':'#ef4444' }); } }
const containerColors = ['#0284c7', '#dc2626', '#16a34a', '#ca8a04'];
for(let x=200; x<1800; x+=250) { for(let y=200; y<1800; y+=250) { let n = (x*31 + y*37) % 100; if(n < 30) MAP_DATA['ship'].solids.push({ type: 'wall', x, y, w: 180, h: 80, color: containerColors[n % containerColors.length] }); } }
for(let x=200; x<2300; x+=300) { for(let y=200; y<2300; y+=300) { let n = (x*41 + y*43) % 100; if(n < 50) { if(n < 15) MAP_DATA['castle'].solids.push({ type: 'tree', x: x+100, y: y+100, r: 60, color: '#0c0a09' }); else MAP_DATA['castle'].solids.push({ type: 'wall', x, y, w: 250, h: 80, color: '#171717' }); } } }

const BUFFS = { 
    'none': { cd: 1500, dmg: 75, type: 'normal' }, 
    'explosive': { cd: 1500, dmg: 250, type: 'explosive' }, 
    'minigun': { cd: 100, dmg: 25, type: 'fast' }, 
    'boss': { cd: 1000, dmg: 500, type: 'explosive' }, 
    'shotgun': { cd: 1500, dmg: 25, type: 'normal' }, 
    'healing': { cd: 1500, dmg: 75, type: 'normal' }, 
    'samurai': { cd: 750, dmg: 75, type: 'melee' }
    // 'fast': { cd: 1500, dmg: 50, type: 'piercing_fast' }, 
    // 'piercing': { cd: 1500, dmg: 50, type: 'piercing' }, 
    // 'incendiary': { cd: 1500, dmg: 10, type: 'incendiary' }, 
    // 'invisible': { cd: 500, dmg: 75, type: 'normal' }, 
    // 'homing': { cd: 3000, dmg: 125, type: 'homing' }
};

const PU_COLORS = { 'explosive': '#fb923c', 'minigun': '#fde047', 'boss': '#dc2626', 'shotgun': '#9ca3af', 'healing': '#22c55e', 'samurai': '#ef4444' };
const PU_ICONS = { 'explosive': '💥', 'minigun': '🔫', 'boss': '👹', 'shotgun': '💨', 'healing': '➕', 'samurai': '⚔️' };
const BUFF_NAMES = { 'explosive': 'Розривний', 'minigun': 'Мініган', 'boss': 'БОС', 'shotgun': 'Дробовик', 'healing': 'Лікування', 'samurai': 'Самурай' };
const Z_TYPES = { 'normal': { radius: 15, color: '#22c55e' }, 'runner': { radius: 12, color: '#84cc16' }, 'tanker': { radius: 25, color: '#15803d' }, 'spitter': { radius: 15, color: '#a3e635' }, 'bomber': { radius: 18, color: '#dc2626' }, 'ghost': { radius: 15, color: '#cbd5e1', ghost: true } };
const SHOP_DATA = { damage: { title: "Урон", icon: "⚔️", levels: [0, 2, 4, 8, 12], prices: [50, 100, 200, 500] }, speed: { title: "Швидкість", icon: "💨", levels: [0, 2, 5, 10], prices: [50, 100, 150] }, earnings: { title: "Заробіток", icon: "💰", levels: [0, 5, 10], prices: [50, 100] } };