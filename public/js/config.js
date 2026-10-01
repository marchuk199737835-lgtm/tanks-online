let myId = null;
let myName = "", myColor = null, isReady = false, isAdmin = false;
let authMode = 'login';
let myBucks = 0;
let myUpgrades = { damage: 0, speed: 0, earnings: 0 };
const MAX_HP = 500;
const TANK_SPEED = 280;
const BASE_BULLET_SPEED = 700;

let serverPlayers = {};
let serverGameState = { map: 'city', mode: 'deathmatch', winScore: 50, leaderId: null };
let myLocalTank = { x: 0, y: 0, bodyAngle: 0, turretAngle: 0, hp: MAX_HP, buffProgress: 0, score: 0 };
let opponents = {}; let powerups = {}; let tokens = {}; let zombies = {}; let bullets = []; let particles = [];

const keys = { w: false, a: false, s: false, d: false, space: false };
let mouseX = 0, mouseY = 0; let lastShootTime = 0; let camera = { x: 0, y: 0 }; let shakeTime = 0; let homingTargetId = null;
let gameLoopId = null; let lastTime = 0;

const MAP_DATA = {
    'city': { size: 3600, bg: '#09090b', grid: '#27272a', solids: [] },
    'hangars': { size: 3000, bg: '#334155', grid: '#475569', solids: [] },
    'ship': { size: 2000, bg: '#64748b', grid: '#94a3b8', solids: [] },
    'castle': { size: 2500, bg: '#44403c', grid: '#57534e', solids: [] }
};
const neonColors = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981'];
for(let x=200; x<3400; x+=450) { for(let y=200; y<3400; y+=450) { let n = (x*13 + y*17) % 100; if(n < 75) MAP_DATA['city'].solids.push({ type: 'wall', x, y, w: 300, h: 300, color: '#18181b', neon: neonColors[n % neonColors.length] }); } }
const hangarColors = ['#1e293b', '#0f172a', '#3f3f46'];
for(let x=150; x<2800; x+=350) { for(let y=150; y<2800; y+=300) { let n = (x*23 + y*29) % 100; if(n < 60) MAP_DATA['hangars'].solids.push({ type: 'wall', x, y, w: 250, h: 150, color: hangarColors[n % hangarColors.length], stripe: (n%2===0)?'#eab308':'#ef4444' }); } }
const containerColors = ['#0284c7', '#dc2626', '#16a34a', '#ca8a04'];
for(let x=200; x<1800; x+=250) { for(let y=200; y<1800; y+=250) { let n = (x*31 + y*37) % 100; if(n < 30) MAP_DATA['ship'].solids.push({ type: 'wall', x, y, w: 180, h: 80, color: containerColors[n % containerColors.length] }); } }
for(let x=200; x<2300; x+=300) { for(let y=200; y<2300; y+=300) { let n = (x*41 + y*43) % 100; if(n < 50) { if(n < 15) MAP_DATA['castle'].solids.push({ type: 'tree', x: x+100, y: y+100, r: 60, color: '#1c1917' }); else MAP_DATA['castle'].solids.push({ type: 'wall', x, y, w: 250, h: 80, color: '#292524' }); } } }

const BUFFS = { 'none': { cd: 1500, dmg: 75, type: 'normal' }, 'fast': { cd: 1500, dmg: 50, type: 'piercing_fast' }, 'explosive': { cd: 1500, dmg: 35, type: 'explosive' }, 'piercing': { cd: 1500, dmg: 50, type: 'piercing' }, 'incendiary': { cd: 1500, dmg: 10, type: 'incendiary' }, 'minigun': { cd: 100, dmg: 2, type: 'fast' }, 'boss': { cd: 1000, dmg: 500, type: 'explosive' }, 'invisible': { cd: 500, dmg: 75, type: 'normal' }, 'shotgun': { cd: 1500, dmg: 25, type: 'normal' }, 'homing': { cd: 3000, dmg: 125, type: 'homing' } };
const PU_COLORS = { 'fast': '#38bdf8', 'explosive': '#fb923c', 'piercing': '#d946ef', 'incendiary': '#ef4444', 'minigun': '#fde047', 'boss': '#dc2626', 'invisible': '#cbd5e1', 'shotgun': '#9ca3af', 'homing': '#10b981' };
const PU_ICONS = { 'fast': '⚡', 'explosive': '💥', 'piercing': '🏹', 'incendiary': '🔥', 'minigun': '🔫', 'boss': '👹', 'invisible': '👻', 'shotgun': '💨', 'homing': '🎯' };
const BUFF_NAMES = { 'fast': 'Швидкісний', 'explosive': 'Розривний', 'piercing': 'Бронебійний', 'incendiary': 'Горючий', 'minigun': 'Мініган', 'boss': 'БОС', 'invisible': 'Привид', 'shotgun': 'Дробовик', 'homing': 'Наведення' };
const Z_TYPES = { 'normal': { radius: 15, color: '#22c55e' }, 'runner': { radius: 12, color: '#84cc16' }, 'tanker': { radius: 25, color: '#15803d' }, 'spitter': { radius: 15, color: '#a3e635' }, 'bomber': { radius: 18, color: '#dc2626' }, 'ghost': { radius: 15, color: '#cbd5e1', ghost: true } };
const SHOP_DATA = { damage: { title: "Урон", icon: "⚔️", levels: [0, 2, 4, 8, 12], prices: [50, 100, 200, 500] }, speed: { title: "Швидкість", icon: "💨", levels: [0, 2, 5, 10], prices: [50, 100, 150] }, earnings: { title: "Заробіток", icon: "💰", levels: [0, 5, 10], prices: [50, 100] } };