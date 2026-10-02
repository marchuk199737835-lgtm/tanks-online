let myId = null;
let myName = "", myColor = null, isReady = false, isAdmin = false;
let authMode = 'login';
let myBucks = 0;
let myInventory = [];
let myEquipped = { cannon: null, turret: null, hull: null, tracks: null };
let myStats = { kills: 0, matches: 0, earned: 0 };

const MAX_HP = 500; const TANK_SPEED = 280; const BASE_BULLET_SPEED = 700;

let currentRoomId = null; let currentRoomData = null;
let myLocalTank = { x: 0, y: 0, bodyAngle: 0, turretAngle: 0, hp: MAX_HP, buffProgress: 0, score: 0 };
let opponents = {}; let powerups = {}; let tokens = {}; let zombies = {}; let bullets = []; let particles = [];
const keys = { w: false, a: false, s: false, d: false, space: false };
let mouseX = 0, mouseY = 0; let lastShootTime = 0; let camera = { x: 0, y: 0 }; let shakeTime = 0; let homingTargetId = null;
let gameLoopId = null; let lastTime = 0;

// ТВОЯ КРУТА МАПА
const MAP_DATA = { 
    'площя': {
        size: 750,
        bg: '#4b5062',
        grid: '#393c47',
        solids: [
            {"type":"shape_rhombus","x":100,"y":100,"w":100,"h":100,"color":"#878787"},
            {"type":"shape_rhombus","x":550,"y":100,"w":100,"h":100,"color":"#878787"},
            {"type":"shape_rhombus","x":100,"y":550,"w":100,"h":100,"color":"#878787"},
            {"type":"shape_rhombus","x":550,"y":550,"w":100,"h":100,"color":"#878787"},
            {"type":"neon_cross","x":350,"y":350,"w":50,"h":50,"color":"#878787"},
            {"type":"spawn_player","x":150,"y":700},
            {"type":"spawn_player","x":600,"y":700},
            {"type":"spawn_player","x":150,"y":50},
            {"type":"spawn_player","x":600,"y":50},
            {"type":"spawn_player","x":250,"y":300},
            {"type":"spawn_player","x":500,"y":450},
            {"type":"spawn_zombie","x":50,"y":550},
            {"type":"spawn_zombie","x":50,"y":450},
            {"type":"spawn_zombie","x":50,"y":350},
            {"type":"spawn_zombie","x":50,"y":250},
            {"type":"spawn_zombie","x":50,"y":150},
            {"type":"spawn_zombie","x":50,"y":650},
            {"type":"spawn_zombie","x":700,"y":650},
            {"type":"spawn_zombie","x":700,"y":550},
            {"type":"spawn_zombie","x":700,"y":450},
            {"type":"spawn_zombie","x":700,"y":350},
            {"type":"spawn_zombie","x":700,"y":250},
            {"type":"spawn_zombie","x":700,"y":150},
            {"type":"spawn_zombie","x":250,"y":500},
            {"type":"spawn_zombie","x":500,"y":500},
            {"type":"spawn_zombie","x":500,"y":200},
            {"type":"spawn_zombie","x":250,"y":200},
            {"type":"spawn_powerup","x":250,"y":400},
            {"type":"spawn_powerup","x":500,"y":350},
            {"type":"spawn_powerup","x":50,"y":50},
            {"type":"spawn_powerup","x":700,"y":50},
            {"type":"spawn_powerup","x":700,"y":700},
            {"type":"spawn_powerup","x":50,"y":700}
        ]
    }
};

const BUFFS = { 'none': { cd: 1500, dmg: 75, type: 'normal' }, 'explosive': { cd: 1500, dmg: 250, type: 'explosive' }, 'minigun': { cd: 100, dmg: 25, type: 'fast' }, 'boss': { cd: 1000, dmg: 500, type: 'explosive' }, 'shotgun': { cd: 1500, dmg: 25, type: 'normal' }, 'healing': { cd: 1500, dmg: 75, type: 'normal' }, 'samurai': { cd: 750, dmg: 75, type: 'melee' }, 'piercing': { cd: 1500, dmg: 50, type: 'piercing' }, 'invisible': { cd: 500, dmg: 75, type: 'normal' }, 'homing': { cd: 3000, dmg: 125, type: 'homing' } };
const PU_COLORS = { 'explosive': '#fb923c', 'minigun': '#fde047', 'boss': '#dc2626', 'shotgun': '#9ca3af', 'healing': '#22c55e', 'samurai': '#ef4444', 'piercing': '#d946ef', 'invisible': '#cbd5e1', 'homing': '#10b981' };
const PU_ICONS = { 'explosive': '💥', 'minigun': '🔫', 'boss': '👹', 'shotgun': '💨', 'healing': '➕', 'samurai': '⚔️', 'piercing': '🏹', 'invisible': '👻', 'homing': '🎯' };
const BUFF_NAMES = { 'explosive': 'Розривний', 'minigun': 'Мініган', 'boss': 'БОС', 'shotgun': 'Дробовик', 'healing': 'Лікування', 'samurai': 'Самурай', 'piercing': 'Бронебійний', 'invisible': 'Привид', 'homing': 'Наведення' };
const Z_TYPES = { 'normal': { radius: 15, color: '#22c55e' }, 'runner': { radius: 12, color: '#84cc16' }, 'tanker': { radius: 25, color: '#15803d' }, 'spitter': { radius: 15, color: '#a3e635' }, 'bomber': { radius: 18, color: '#dc2626' }, 'ghost': { radius: 15, color: '#cbd5e1', ghost: true } };

const RARITY = { 'common': { name: 'Звичайний', color: '#94a3b8', price: 5 }, 'rare': { name: 'Рідкісний', color: '#3b82f6', price: 10 }, 'epic': { name: 'Епічний', color: '#a855f7', price: 50 }, 'legendary': { name: 'Легендарний', color: '#eab308', price: 250 } };
const CAT_NAMES = { 'cannon': 'ДУЛО', 'turret': 'БАШТА', 'hull': 'КОРПУС', 'tracks': 'ГУСЕНИЦІ' };

const SVG_ICONS = {
    'cannon': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="9" y="2" width="6" height="12" rx="1"></rect><path d="M12 14v8"></path><path d="M8 22h8"></path></svg>`,
    'turret': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    'hull': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><path d="M4 6h16v12H4z"></path><path d="M8 6V4h8v2"></path></svg>`,
    'tracks': (color) => `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:100%; height:100%;"><rect x="4" y="2" width="4" height="20" rx="1"></rect><rect x="16" y="2" width="4" height="20" rx="1"></rect><path d="M4 6h16"></path><path d="M4 12h16"></path><path d="M4 18h16"></path></svg>`
};

const MODULES = {
    'can_c1': { id: 'can_c1', type: 'cannon', rarity: 'common', name: 'Вкорочене', stats: { dmg: 1.01, range: 0.90, cd: 1.00 } }, 'can_c2': { id: 'can_c2', type: 'cannon', rarity: 'common', name: 'Труба', stats: { dmg: 1.00, range: 1.05, cd: 0.99 } }, 'can_c3': { id: 'can_c3', type: 'cannon', rarity: 'common', name: 'Самопал', stats: { dmg: 1.02, range: 1.00, cd: 0.98 } },
    'can_r1': { id: 'can_r1', type: 'cannon', rarity: 'rare', name: 'Снайпер', stats: { dmg: 1.05, range: 1.15, cd: 1.00 } }, 'can_r2': { id: 'can_r2', type: 'cannon', rarity: 'rare', name: 'Штурмове', stats: { dmg: 1.02, range: 1.00, cd: 0.90 } }, 'can_r3': { id: 'can_r3', type: 'cannon', rarity: 'rare', name: 'Важке', stats: { dmg: 1.12, range: 0.95, cd: 1.05 } },
    'can_e1': { id: 'can_e1', type: 'cannon', rarity: 'epic', name: 'Рейлгун', stats: { dmg: 1.15, range: 1.30, cd: 1.05 } }, 'can_e2': { id: 'can_e2', type: 'cannon', rarity: 'epic', name: 'Вулкан', stats: { dmg: 1.05, range: 0.90, cd: 0.75 } }, 'can_e3': { id: 'can_e3', type: 'cannon', rarity: 'epic', name: 'Руйнівник', stats: { dmg: 1.25, range: 1.00, cd: 0.90 } },
    'can_l1': { id: 'can_l1', type: 'cannon', rarity: 'legendary', name: 'Плазма', stats: { dmg: 1.40, range: 1.00, cd: 0.85 } }, 'can_l2': { id: 'can_l2', type: 'cannon', rarity: 'legendary', name: 'Око Смерті', stats: { dmg: 1.20, range: 1.50, cd: 0.90 } }, 'can_l3': { id: 'can_l3', type: 'cannon', rarity: 'legendary', name: 'Армагеддон', stats: { dmg: 1.50, range: 1.20, cd: 0.85 } },
    'tur_c1': { id: 'tur_c1', type: 'turret', rarity: 'common', name: 'Іржа', stats: { rotSpeed: 1.01, hp: 1.01 } }, 'tur_c2': { id: 'tur_c2', type: 'turret', rarity: 'common', name: 'Клепана', stats: { rotSpeed: 1.00, hp: 1.02 } }, 'tur_c3': { id: 'tur_c3', type: 'turret', rarity: 'common', name: 'Полегшена', stats: { rotSpeed: 1.02, hp: 1.00 } },
    'tur_r1': { id: 'tur_r1', type: 'turret', rarity: 'rare', name: 'Лицар', stats: { rotSpeed: 0.98, hp: 1.10 } }, 'tur_r2': { id: 'tur_r2', type: 'turret', rarity: 'rare', name: 'Скаут', stats: { rotSpeed: 1.10, hp: 0.98 } }, 'tur_r3': { id: 'tur_r3', type: 'turret', rarity: 'rare', name: 'Баланс', stats: { rotSpeed: 1.05, hp: 1.05 } },
    'tur_e1': { id: 'tur_e1', type: 'turret', rarity: 'epic', name: 'Фортеця', stats: { rotSpeed: 0.95, hp: 1.25 } }, 'tur_e2': { id: 'tur_e2', type: 'turret', rarity: 'epic', name: 'Торнадо', stats: { rotSpeed: 1.25, hp: 0.95 } }, 'tur_e3': { id: 'tur_e3', type: 'turret', rarity: 'epic', name: 'Вартовий', stats: { rotSpeed: 1.15, hp: 1.15 } },
    'tur_l1': { id: 'tur_l1', type: 'turret', rarity: 'legendary', name: 'Титан', stats: { rotSpeed: 0.90, hp: 1.50 } }, 'tur_l2': { id: 'tur_l2', type: 'turret', rarity: 'legendary', name: 'Вихор', stats: { rotSpeed: 1.50, hp: 1.10 } }, 'tur_l3': { id: 'tur_l3', type: 'turret', rarity: 'legendary', name: 'Сингулярність', stats: { rotSpeed: 1.35, hp: 1.35 } },
    'hul_c1': { id: 'hul_c1', type: 'hull', rarity: 'common', name: 'Іржа', stats: { hp: 1.01, speed: 1.01 } }, 'hul_c2': { id: 'hul_c2', type: 'hull', rarity: 'common', name: 'Корито', stats: { hp: 1.03, speed: 0.99 } }, 'hul_c3': { id: 'hul_c3', type: 'hull', rarity: 'common', name: 'Каркас', stats: { hp: 0.99, speed: 1.03 } },
    'hul_r1': { id: 'hul_r1', type: 'hull', rarity: 'rare', name: 'Панцер', stats: { hp: 1.12, speed: 0.95 } }, 'hul_r2': { id: 'hul_r2', type: 'hull', rarity: 'rare', name: 'Болід', stats: { hp: 0.95, speed: 1.12 } }, 'hul_r3': { id: 'hul_r3', type: 'hull', rarity: 'rare', name: 'Ветеран', stats: { hp: 1.06, speed: 1.06 } },
    'hul_e1': { id: 'hul_e1', type: 'hull', rarity: 'epic', name: 'Моноліт', stats: { hp: 1.30, speed: 0.90 } }, 'hul_e2': { id: 'hul_e2', type: 'hull', rarity: 'epic', name: 'Фантом', stats: { hp: 0.90, speed: 1.30 } }, 'hul_e3': { id: 'hul_e3', type: 'hull', rarity: 'epic', name: 'Центуріон', stats: { hp: 1.15, speed: 1.15 } },
    'hul_l1': { id: 'hul_l1', type: 'hull', rarity: 'legendary', name: 'Голіаф', stats: { hp: 1.60, speed: 0.85 } }, 'hul_l2': { id: 'hul_l2', type: 'hull', rarity: 'legendary', name: 'Тінь', stats: { hp: 1.10, speed: 1.50 } }, 'hul_l3': { id: 'hul_l3', type: 'hull', rarity: 'legendary', name: 'Нано-броня', stats: { hp: 1.40, speed: 1.40 } },
    'trk_c1': { id: 'trk_c1', type: 'tracks', rarity: 'common', name: 'Іржаві', stats: { speed: 1.01, hp: 1.01 } }, 'trk_c2': { id: 'trk_c2', type: 'tracks', rarity: 'common', name: 'Шиповані', stats: { speed: 1.02, hp: 1.00 } }, 'trk_c3': { id: 'trk_c3', type: 'tracks', rarity: 'common', name: 'Тракторні', stats: { speed: 1.00, hp: 1.02 } },
    'trk_r1': { id: 'trk_r1', type: 'tracks', rarity: 'rare', name: 'Ралійні', stats: { speed: 1.10, hp: 0.98 } }, 'trk_r2': { id: 'trk_r2', type: 'tracks', rarity: 'rare', name: 'Всюдихідні', stats: { speed: 0.98, hp: 1.10 } }, 'trk_r3': { id: 'trk_r3', type: 'tracks', rarity: 'rare', name: 'Посилені', stats: { speed: 1.05, hp: 1.05 } },
    'trk_e1': { id: 'trk_e1', type: 'tracks', rarity: 'epic', name: 'Турбінні', stats: { speed: 1.25, hp: 0.95 } }, 'trk_e2': { id: 'trk_e2', type: 'tracks', rarity: 'epic', name: 'Магнітні', stats: { speed: 0.95, hp: 1.25 } }, 'trk_e3': { id: 'trk_e3', type: 'tracks', rarity: 'epic', name: 'Елітні', stats: { speed: 1.15, hp: 1.15 } },
    'trk_l1': { id: 'trk_l1', type: 'tracks', rarity: 'legendary', name: 'Гравітаційні', stats: { speed: 1.50, hp: 1.00 } }, 'trk_l2': { id: 'trk_l2', type: 'tracks', rarity: 'legendary', name: 'Кібернетичні', stats: { speed: 1.00, hp: 1.50 } }, 'trk_l3': { id: 'trk_l3', type: 'tracks', rarity: 'legendary', name: 'Омега', stats: { speed: 1.35, hp: 1.35 } }
};