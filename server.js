const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

process.on('uncaughtException', err => console.error('Crash prevented:', err));
process.on('unhandledRejection', err => console.error('Promise rejection prevented:', err));

app.use(express.static(path.join(__dirname, 'public')));

const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir);

const musicCategories = ['loby', 'dezmatch', 'survive', 'main'];
let musicData = {};

musicCategories.forEach(cat => {
    const catDir = path.join(musicDir, cat);
    if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
});

function scanMusic() {
    musicCategories.forEach(cat => {
        const catDir = path.join(musicDir, cat);
        musicData[cat] = fs.readdirSync(catDir).filter(f => f.endsWith('.mp3')).map(f => `${cat}/${f}`);
    });
}
scanMusic();
app.use('/music', express.static(musicDir));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const MAX_HP = 500, BUFF_DURATION = 15000, BASE_RELOAD = 2000;
const mongoUri = process.env.MONGO_URI;
let dbUsersCol = null, dbUsers = {};

if (mongoUri) {
    const client = new MongoClient(mongoUri);
    client.connect().then(() => {
        console.log("✅ Підключено до MongoDB!");
        const db = client.db("tanks_db");
        dbUsersCol = db.collection("users");
        dbUsersCol.find({}).toArray().then(users => {
            users.forEach(u => dbUsers[u.name] = u);
            console.log(`Завантажено акаунтів: ${users.length}`);
        });
    }).catch(err => console.error("❌ Помилка MongoDB:", err));
}

function saveUser(name) {
    if (dbUsersCol && dbUsers[name]) {
        dbUsersCol.updateOne({ name: name }, { $set: dbUsers[name] }, { upsert: true });
    }
}

function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }

// --- КОНСТАНТИ ---
const MAP_DATA={"epic_map":{size:3000,bg:"#565a6c",grid:"#494d55",solids:[{type:"wall_square",x:850,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1050,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:1800,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1900,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1800,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:1750,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:1850,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:1700,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1100,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1150,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1000,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1850,w:50,h:50,color:"#353940"},{type:"wall_square",x:950,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:900,y:1950,w:50,h:50,color:"#353940"},{type:"wall_square",x:800,y:1800,w:50,h:50,color:"#353940"},{type:"shape_rhombus",x:1150,y:1300,w:400,h:400,color:"#353940"},{type:"shape_rhombus",x:1250,y:1350,w:200,h:300,color:"#22252a"},{type:"tree",x:0,y:700,r:424.26},{type:"tree",x:2650,y:2550,r:180.27},{type:"tree",x:300,y:2400,r:158.11},{type:"tree",x:2850,y:750,r:364.00},{type:"neon_circle",x:850,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1050,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1100,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1800,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:1750,y:1900,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:850,y:1850,w:50,h:50,color:"#21252c"},{type:"neon_circle",x:900,y:1900,w:50,h:50,color:"#21252c"},{type:"prop_crate",x:3000,y:2950,w:50,h:50},{type:"spawn_player",x:250,y:2750},{type:"spawn_player",x:2850,y:2850},{type:"spawn_player",x:1500,y:2750},{type:"spawn_powerup",x:1500,y:1500},{type:"spawn_powerup",x:800,y:800},{type:"spawn_powerup",x:2200,y:800},{type:"spawn_powerup",x:1500,y:2200}]},'Бій Насмерть':{size:2500,bg:'#3e2604',grid:'#1e293b',solids:[{type:"spawn_player",x:1400,y:1450},{type:"spawn_player",x:100,y:1350},{type:"spawn_player",x:1400,y:750},{type:"spawn_player",x:100,y:700},{type:"spawn_powerup",x:700,y:700},{type:"spawn_powerup",x:1800,y:700},{type:"spawn_powerup",x:700,y:1800},{type:"spawn_powerup",x:1800,y:1800}]}};
const Z_TYPES={normal:{hp:25,speed:120,dmg:10,radius:15,color:'#22c55e'},runner:{hp:15,speed:250,dmg:5,radius:12,color:'#84cc16'},tanker:{hp:100,speed:60,dmg:25,radius:25,color:'#15803d'},spitter:{hp:40,speed:90,dmg:15,radius:15,color:'#a3e635',ranged:true},bomber:{hp:30,speed:140,dmg:50,radius:18,color:'#dc2626',explode:true},ghost:{hp:20,speed:100,dmg:10,radius:15,color:'#cbd5e1',ghost:true},pikus:{isBoss:true,name:'ПІКУС',hp:1000,speed:294,dmg:100,radius:30,color:'#9333ea',bullets:3,cd:3000},shurik:{isBoss:true,name:'ШУРІК',hp:2000,speed:280,dmg:100,radius:22.5,color:'#f43f5e',bullets:10,cd:3000},oneshot:{isBoss:true,name:'ВАНШОТУС',hp:3000,speed:294,dmg:1000,radius:30,color:'#fbbf24',bullets:2,cd:2000},padlo:{isBoss:true,name:'ПАДЛО',hp:5000,speed:280,dmg:75,radius:15,color:'#10b981',bullets:25,cd:1500}};
const MODULES={'can_c1':{id:'can_c1',type:'cannon',rarity:'common',name:'Іскра',price:15,stats:{cd:0.96,dmg:0.98,range:1.00}},'can_c2':{id:'can_c2',type:'cannon',rarity:'common',name:'Чавун',price:25,stats:{dmg:1.05,cd:1.03,range:0.98}},'can_c3':{id:'can_c3',type:'cannon',rarity:'common',name:'Подовжене',price:40,stats:{range:1.05,dmg:1.02,cd:1.02}},'can_r1':{id:'can_r1',type:'cannon',rarity:'rare',name:'Блискавка',price:60,stats:{cd:0.90,dmg:0.95,range:1.00}},'can_r2':{id:'can_r2',type:'cannon',rarity:'rare',name:'Молот',price:90,stats:{dmg:1.12,cd:1.06,range:0.95}},'can_r3':{id:'can_r3',type:'cannon',rarity:'rare',name:'Снайпер',price:130,stats:{range:1.12,dmg:1.06,cd:1.04}},'can_e1':{id:'can_e1',type:'cannon',rarity:'epic',name:'Квазар',price:170,stats:{cd:0.84,dmg:0.90,range:1.00}},'can_e2':{id:'can_e2',type:'cannon',rarity:'epic',name:'Титан',price:220,stats:{dmg:1.20,cd:1.10,range:0.92}},'can_e3':{id:'can_e3',type:'cannon',rarity:'epic',name:'Каратель',price:280,stats:{range:1.22,dmg:1.15,cd:1.06}},'can_l1':{id:'can_l1',type:'cannon',rarity:'legendary',name:'Пульсар',price:350,stats:{cd:0.78,dmg:0.85,range:1.00}},'can_l2':{id:'can_l2',type:'cannon',rarity:'legendary',name:'Колос',price:450,stats:{dmg:1.30,cd:1.15,range:0.90}},'can_l3':{id:'can_l3',type:'cannon',rarity:'legendary',name:'Армагеддон',price:550,stats:{range:1.35,dmg:1.25,cd:1.08}},'tur_c1':{id:'tur_c1',type:'turret',rarity:'common',name:'Легка',price:15,stats:{rotSpeed:1.04,hp:0.98}},'tur_c2':{id:'tur_c2',type:'turret',rarity:'common',name:'Клепана',price:25,stats:{hp:1.05,rotSpeed:0.98}},'tur_c3':{id:'tur_c3',type:'turret',rarity:'common',name:'Оптика',price:40,stats:{rotSpeed:1.02,hp:0.99}},'tur_r1':{id:'tur_r1',type:'turret',rarity:'rare',name:'Спритна',price:60,stats:{rotSpeed:1.10,hp:0.95}},'tur_r2':{id:'tur_r2',type:'turret',rarity:'rare',name:'Щит',price:90,stats:{hp:1.12,rotSpeed:0.95}},'tur_r3':{id:'tur_r3',type:'turret',rarity:'rare',name:'Скаут',price:130,stats:{rotSpeed:1.05,hp:0.97}},'tur_e1':{id:'tur_e1',type:'turret',rarity:'epic',name:'Віраж',price:170,stats:{rotSpeed:1.20,hp:0.90}},'tur_e2':{id:'tur_e2',type:'turret',rarity:'epic',name:'Фортеця',price:220,stats:{hp:1.25,rotSpeed:0.90}},'tur_e3':{id:'tur_e3',type:'turret',rarity:'epic',name:'Вартовий',price:280,stats:{rotSpeed:1.12,hp:0.94}},'tur_l1':{id:'tur_l1',type:'turret',rarity:'legendary',name:'Міраж',price:350,stats:{rotSpeed:1.35,hp:0.85}},'tur_l2':{id:'tur_l2',type:'turret',rarity:'legendary',name:'Бастіон',price:450,stats:{hp:1.40,rotSpeed:0.85}},'tur_l3':{id:'tur_l3',type:'turret',rarity:'legendary',name:'Яструб',price:550,stats:{rotSpeed:1.20,hp:0.90}},'hul_c1':{id:'hul_c1',type:'hull',rarity:'common',name:'Каркас',price:15,stats:{speed:1.04,hp:0.98}},'hul_c2':{id:'hul_c2',type:'hull',rarity:'common',name:'Панцер',price:25,stats:{hp:1.05,speed:0.98}},'hul_c3':{id:'hul_c3',type:'hull',rarity:'common',name:'Розвідник',price:40,stats:{speed:1.02,hp:0.99}},'hul_r1':{id:'hul_r1',type:'hull',rarity:'rare',name:'Болід',price:60,stats:{speed:1.10,hp:0.95}},'hul_r2':{id:'hul_r2',type:'hull',rarity:'rare',name:'Броньовик',price:90,stats:{hp:1.12,speed:0.95}},'hul_r3':{id:'hul_r3',type:'hull',rarity:'rare',name:'Авангард',price:130,stats:{speed:1.05,hp:0.97}},'hul_e1':{id:'hul_e1',type:'hull',rarity:'epic',name:'Фантом',price:170,stats:{speed:1.20,hp:0.90}},'hul_e2':{id:'hul_e2',type:'hull',rarity:'epic',name:'Моноліт',price:220,stats:{hp:1.25,speed:0.90}},'hul_e3':{id:'hul_e3',type:'hull',rarity:'epic',name:'Хижак',price:280,stats:{speed:1.10,hp:0.94}},'hul_l1':{id:'hul_l1',type:'hull',rarity:'legendary',name:'Тінь',price:350,stats:{speed:1.35,hp:0.85}},'hul_l2':{id:'hul_l2',type:'hull',rarity:'legendary',name:'Егіда',price:450,stats:{hp:1.40,speed:0.85}},'hul_l3':{id:'hul_l3',type:'hull',rarity:'legendary',name:'Ассасін',price:550,stats:{speed:1.15,hp:0.90}},'trk_c1':{id:'trk_c1',type:'tracks',rarity:'common',name:'Тонкі',price:15,stats:{speed:1.04,hp:0.98}},'trk_c2':{id:'trk_c2',type:'tracks',rarity:'common',name:'Важкі',price:25,stats:{hp:1.05,speed:0.98}},'trk_c3':{id:'trk_c3',type:'tracks',rarity:'common',name:'Гібрид',price:40,stats:{speed:1.02,hp:0.99}},'trk_r1':{id:'trk_r1',type:'tracks',rarity:'rare',name:'Ралійні',price:60,stats:{speed:1.10,hp:0.95}},'trk_r2':{id:'trk_r2',type:'tracks',rarity:'rare',name:'Всюдихід',price:90,stats:{hp:1.12,speed:0.95}},'trk_r3':{id:'trk_r3',type:'tracks',rarity:'rare',name:'Посилені',price:130,stats:{speed:1.05,hp:0.97}},'trk_e1':{id:'trk_e1',type:'tracks',rarity:'epic',name:'Граві',price:170,stats:{speed:1.20,hp:0.90}},'trk_e2':{id:'trk_e2',type:'tracks',rarity:'epic',name:'Гусеничні',price:220,stats:{hp:1.25,speed:0.90}},'trk_e3':{id:'trk_e3',type:'tracks',rarity:'epic',name:'Адаптивні',price:280,stats:{speed:1.10,hp:0.94}},'trk_l1':{id:'trk_l1',type:'tracks',rarity:'legendary',name:'Струм',price:350,stats:{speed:1.35,hp:0.85}},'trk_l2':{id:'trk_l2',type:'tracks',rarity:'legendary',name:'Скала',price:450,stats:{hp:1.40,speed:0.85}},'trk_l3':{id:'trk_l3',type:'tracks',rarity:'legendary',name:'Кіготь',price:550,stats:{speed:1.15,hp:0.90}}};
const CASES={1:{price:50,drop:{c:60,r:30,e:9,l:1},pool:'all'},2:{price:75,drop:{c:50,r:35,e:12,l:3},pool:['can_c1','can_r1','can_e1','can_l1','tur_c1','tur_r1','tur_e1','tur_l1','hul_c3','hul_r1','hul_e1','hul_l1','trk_c1','trk_r1','trk_e1','trk_l1']},3:{price:75,drop:{c:50,r:35,e:12,l:3},pool:['tur_c2','tur_r2','tur_e2','tur_l2','hul_c1','hul_r2','hul_e2','hul_l2','trk_c2','trk_r2','trk_e2','trk_l2']},4:{price:75,drop:{c:50,r:35,e:12,l:3},pool:['can_c2','can_r2','can_e2','can_l2','can_c3','can_r3','can_e3','can_l3','tur_c3','tur_r3','tur_e3','tur_l3','hul_c2','hul_r3','hul_e3','hul_l3','trk_c3','trk_r3','trk_e3','trk_l3']},5:{price:60,drop:{c:60,r:30,e:9,l:1},pool:'cannon'},6:{price:60,drop:{c:60,r:30,e:9,l:1},pool:'turret'},7:{price:60,drop:{c:60,r:30,e:9,l:1},pool:'hull'},8:{price:60,drop:{c:60,r:30,e:9,l:1},pool:'tracks'},9:{price:100,drop:{c:0,r:75,e:22,l:3},pool:'all'},10:{price:200,drop:{c:0,r:0,e:85,l:15},pool:'all'},11:{price:150,drop:{c:30,r:40,e:25,l:5},pool:'all'},12:{price:500,drop:{c:0,r:0,e:0,l:100},pool:'all'}};

function getRandomModuleFromCase(caseId) {
    let cs = CASES[caseId]; if (!cs) return null;
    let pool = Object.keys(MODULES);
    if (cs.pool === 'cannon') pool = Object.keys(MODULES).filter(m => MODULES[m].type === 'cannon');
    else if (cs.pool === 'turret') pool = Object.keys(MODULES).filter(m => MODULES[m].type === 'turret');
    else if (cs.pool === 'hull') pool = Object.keys(MODULES).filter(m => MODULES[m].type === 'hull');
    else if (cs.pool === 'tracks') pool = Object.keys(MODULES).filter(m => MODULES[m].type === 'tracks');
    else if (Array.isArray(cs.pool)) pool = cs.pool;
    else if (cs.drop && cs.drop.l === 100) pool = Object.keys(MODULES).filter(m => MODULES[m].rarity === 'legendary');
    let r = Math.random() * 100, rar = 'common';
    let d = cs.drop;
    if (r <= d.c) rar = 'common';
    else if (r <= d.c + d.r) rar = 'rare';
    else if (r <= d.c + d.r + d.e) rar = 'epic';
    else rar = 'legendary';
    let rarPool = pool.filter(m => MODULES[m].rarity === rar);
    if (rarPool.length === 0) rarPool = pool;
    return rarPool[Math.floor(Math.random() * rarPool.length)];
}

function checkCollisionServer(mapName, x, y, r, ignoreList = []) {
    let cM = MAP_DATA[mapName] ? mapName : 'epic_map', mS = MAP_DATA[cM].size;
    if (x - r < 0 || x + r > mS || y - r < 0 || y + r > mS) return true;
    let arr = MAP_DATA[cM].solids;
    for (let i = 0; i < arr.length; i++) {
        if (ignoreList.includes(i)) continue;
        let s = arr[i];
        if (s.type.includes('spawn') || s.type === 'line' || s.type === 'prop_puddle' || s.type === 'prop_crater') continue;
        if (s.type === 'tree' || s.type === 'neon_circle' || s.type === 'neon_pillar') {
            let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30);
            if (Math.hypot(x - cx, y - cy) <= r + sr) return true;
        } else {
            let tX = Math.max(s.x, Math.min(x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(y, s.y + (s.h || 30)));
            if (Math.hypot(x - tX, y - tY) <= r) return true;
        }
    }
    return false;
}

function getValidSpawn(m, r, t = 'spawn_player') {
    let cM = MAP_DATA[m] ? m : 'epic_map', mS = MAP_DATA[cM].size, sP = MAP_DATA[cM].solids.filter(s => s.type === t);
    if (sP.length > 0) {
        let a = 0;
        while (a < 50) {
            let sp = sP[Math.floor(Math.random() * sP.length)], sx = sp.x + (Math.random() * 20 - 10), sy = sp.y + (Math.random() * 20 - 10);
            if (!checkCollisionServer(cM, sx, sy, r)) return { x: sx, y: sy };
            a++;
        }
        let sp = sP[Math.floor(Math.random() * sP.length)];
        return { x: sp.x, y: sp.y };
    }
    for (let i = 0; i < 100; i++) {
        let x = Math.random() * (mS - 200) + 100, y = Math.random() * (mS - 200) + 100;
        if (!checkCollisionServer(cM, x, y, r + 20)) return { x, y };
    }
    return { x: mS / 2, y: mS / 2 };
}

function getValidEdgeSpawn(m, r, t = 'spawn_zombie') {
    let cM = MAP_DATA[m] ? m : 'epic_map', mS = MAP_DATA[cM].size, sP = MAP_DATA[cM].solids.filter(s => s.type === t);
    if (sP.length > 0) return getValidSpawn(m, r, t);
    for (let i = 0; i < 100; i++) {
        let x = Math.random() < 0.5 ? 50 : mS - 50, y = Math.random() * (mS - 100) + 50;
        if (!checkCollisionServer(cM, x, y, r + 20)) return { x, y };
    }
    return getValidSpawn(m, r);
}

let rooms = {}, globalPlayers = {};

function sendEconomy(socketId, name) {
    if (dbUsers[name]) io.to(socketId).emit('economyUpdate', { bucks: dbUsers[name].bucks, inventory: dbUsers[name].inventory, equipped: dbUsers[name].equipped, stats: dbUsers[name].stats, adventClaims: dbUsers[name].adventClaims });
}

function getActiveRooms() {
    return Object.values(rooms).map(r => ({ id: r.id, hostName: r.hostName, mode: r.mode, map: r.map, playersCount: Object.keys(r.players).length, maxPlayers: r.maxPlayers, status: r.status }));
}

function getMaxHp(equipped) {
    let hpMult = 1.0;
    if (equipped) {
        if (equipped.hull && MODULES[equipped.hull] && MODULES[equipped.hull].stats.hp) hpMult *= MODULES[equipped.hull].stats.hp;
        if (equipped.turret && MODULES[equipped.turret] && MODULES[equipped.turret].stats.hp) hpMult *= MODULES[equipped.turret].stats.hp;
        if (equipped.tracks && MODULES[equipped.tracks] && MODULES[equipped.tracks].stats.hp) hpMult *= MODULES[equipped.tracks].stats.hp;
    }
    return Math.round(MAX_HP * hpMult);
}

function validateUser(u) {
    if (!u.inventory) u.inventory = [];
    if (!u.equipped) u.equipped = { cannon: null, turret: null, hull: null, tracks: null };
    if (!u.stats) u.stats = { kills: 0, matches: 0, earned: 0 };
    if (!u.usedPromos) u.usedPromos = [];
    if (!u.adventClaims) u.adventClaims = [];
    return u;
}

function rollDrop(name) {
    if (Math.random() <= 0.10) {
        let r = Math.random() * 100, rarity = 'common';
        if (r > 90 && r <= 98) rarity = 'rare';
        else if (r > 98 && r <= 99.5) rarity = 'epic';
        else if (r > 99.5) rarity = 'legendary';
        let pool = Object.keys(MODULES).filter(m => MODULES[m].rarity === rarity);
        let modId = pool[Math.floor(Math.random() * pool.length)];
        if (dbUsers[name].inventory.length < 30) {
            dbUsers[name].inventory.push(modId);
            return modId;
        }
    }
    return null;
}

// УНІВЕРСАЛЬНА ФУНКЦІЯ ОБРОБКИ СМЕРТІ ТА РЕСПАВНУ
function processPlayerDeath(r, victimId, killerId) {
    let v = r.players[victimId];
    if (!v) return;
    v.buff = null;
    v.onFire = null;
    
    io.to(r.id).emit('playerDied', { id: victimId, killer: killerId });
    
    let atk = (killerId && r.players[killerId]) ? r.players[killerId] : null;
    if (atk && dbUsers[atk.name] && r.mode !== 'prophunt') {
        dbUsers[atk.name].stats.kills++;
        saveUser(atk.name);
    }

    if (r.mode === 'team_deathmatch') {
        if (atk && atk.team && atk.team !== v.team) {
            r.teamScores[atk.team]++;
            if (r.teamScores[atk.team] >= r.tdmScore) {
                endTDMGame(r, atk.team);
                return;
            }
        }
        setTimeout(() => {
            if (rooms[r.id] && rooms[r.id].players[victimId] && rooms[r.id].status === 'playing') {
                v.hp = getMaxHp(v.equipped);
                let sp = getValidSpawn(r.map, 24, 'spawn_player');
                v.x = sp.x; v.y = sp.y;
                io.to(r.id).emit('playerRespawn', v);
            }
        }, 3000);
    } else if (r.mode === 'deathmatch') {
        const tid = 'tkn_' + Date.now() + Math.random();
        r.tokens[tid] = { id: tid, x: v.x, y: v.y, color: v.color, active: true };
        setTimeout(() => {
            if (rooms[r.id] && rooms[r.id].players[victimId] && rooms[r.id].status === 'playing') {
                v.hp = getMaxHp(v.equipped);
                let sp = getValidSpawn(r.map, 24, 'spawn_player');
                v.x = sp.x; v.y = sp.y;
                io.to(r.id).emit('playerRespawn', v);
            }
        }, 3000);
    } else if (r.mode === 'prophunt') {
        let hA = Object.values(r.players).filter(pl => pl.team === 'hider' && pl.hp > 0).length;
        if (hA === 0) endPropHuntGame(r, 'hunter');
    }
}
io.on('connection', (socket) => {
    socket.emit('initMusic', musicData);
    
    socket.on('register', (data) => {
        const { name, password } = data;
        if (!name || !password || name.length < 3 || password.length < 4) return socket.emit('joinError', 'Логін від 3 символів, пароль від 4!');
        if (dbUsers[name]) return socket.emit('joinError', 'Цей логін вже зайнятий!');
        const token = crypto.randomUUID();
        dbUsers[name] = validateUser({ name: name, password: hashPwd(password), token: token, bucks: 0 });
        saveUser(name);
        globalPlayers[socket.id] = name;
        socket.emit('authSuccess', { name, token });
        sendEconomy(socket.id, name);
    });

    socket.on('login', (data) => {
        const { name, password } = data;
        let u = dbUsers[name];
        if (!u || u.password !== hashPwd(password)) return socket.emit('joinError', 'Невірний логін або пароль!');
        const token = crypto.randomUUID();
        u.token = token;
        u = validateUser(u);
        saveUser(name);
        globalPlayers[socket.id] = name;
        socket.emit('authSuccess', { name, token });
        sendEconomy(socket.id, name);
    });

    socket.on('authToken', (token) => {
        let foundName = null;
        for (let n in dbUsers) { if (dbUsers[n].token === token) foundName = n; }
        if (foundName) {
            globalPlayers[socket.id] = foundName;
            dbUsers[foundName] = validateUser(dbUsers[foundName]);
            socket.emit('authSuccess', { name: foundName, token });
            sendEconomy(socket.id, foundName);
        } else socket.emit('joinError', 'Сесія закінчилась, увійдіть знову');
    });

    socket.on('claimAdvent', () => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], d = new Date(), month = d.getMonth(), day = d.getDate();
        if (month !== 9) return socket.emit('promoError', 'Івент проходить лише в жовтні!');
        if (day < 3) return socket.emit('promoError', 'Івент ще не почався!');
        if (u.adventClaims.includes(day)) return socket.emit('promoError', 'Сьогоднішня нагорода вже отримана!');
        u.adventClaims.push(day);
        if (day === 31) {
            if (u.adventClaims.length >= 20) {
                let modId = getRandomModuleFromCase(12);
                if (u.inventory.length < 30) u.inventory.push(modId);
                socket.emit('adventSuccess', { type: 'legendary', item: modId, day: day });
            } else {
                u.adventClaims.pop();
                return socket.emit('promoError', 'Недостатньо зібраних днів (мінімум 20) для фінальної нагороди!');
            }
        } else {
            let reward = 20 + (day - 3) * 5;
            u.bucks += reward;
            u.stats.earned += reward;
            socket.emit('adventSuccess', { type: 'bucks', amount: reward, day: day });
        }
        saveUser(name);
        sendEconomy(socket.id, name);
    });

    socket.on('usePromo', (code) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], nCode = code.trim().toLowerCase();
        if (nCode === 'alex-top1') {
            if (u.usedPromos.includes(nCode)) return socket.emit('promoError', 'Промокод вже використано!');
            u.bucks += 200;
            u.stats.earned += 200;
            u.usedPromos.push(nCode);
            saveUser(name);
            sendEconomy(socket.id, name);
            socket.emit('promoSuccess', 'Успішно! +200 баксів.');
        } else socket.emit('promoError', 'Невірний код!');
    });

    socket.on('buyCase', (caseId) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name];
        if (u.inventory.length >= 30) return socket.emit('joinError', 'Інвентар повний (макс 30)!');
        let cs = CASES[caseId];
        if (!cs) return;
        if (u.bucks >= cs.price) {
            u.bucks -= cs.price;
            let modId = getRandomModuleFromCase(caseId);
            if (modId) {
                u.inventory.push(modId);
                saveUser(name);
                socket.emit('caseResult', { modId: modId, bucks: u.bucks, inventory: u.inventory, equipped: u.equipped, stats: u.stats, caseId: caseId });
            }
        } else socket.emit('joinError', 'Недостатньо баксів!');
    });

    socket.on('upgradeItem', (d) => {
        let n = globalPlayers[socket.id];
        if (!n || !dbUsers[n]) return;
        let u = dbUsers[n], sId = u.inventory[d.idx];
        if (!sId) return socket.emit('joinError', 'Помилка предмета!');
        let sMod = MODULES[sId], tMod = MODULES[d.target];
        if (!sMod || !tMod) return;
        let pIn = sMod.price || 5, pOut = tMod.price || 5;
        if (pIn >= pOut) return socket.emit('joinError', 'Ви не можете апгрейднути в дешевший або такий самий предмет!');
        let b = parseInt(d.bucks) || 0;
        if (b < 0 || u.bucks < b) return socket.emit('joinError', 'Недостатньо баксів!');
        u.bucks -= b;
        u.inventory.splice(d.idx, 1);
        let ch = Math.min(90, ((pIn + b) / pOut) * 100), roll = Math.random() * 100, win = d.rollUnder ? (roll <= ch) : (roll >= (100 - ch));
        if (win) u.inventory.push(d.target);
        saveUser(n);
        sendEconomy(socket.id, n);
        socket.emit('upgradeResult', { win: win, roll: roll, ch: ch, under: d.rollUnder, newBucks: u.bucks, inv: u.inventory, tId: d.target });
    });

    socket.on('reorderInventory', (newInv) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name];
        if (Array.isArray(newInv) && newInv.length === u.inventory.length) {
            u.inventory = newInv;
            saveUser(name);
        }
    });

    socket.on('unequipModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], modId = u.equipped[data.type];
        if (modId) {
            if (u.inventory.length < 30) {
                u.inventory.push(modId);
                u.equipped[data.type] = null;
                saveUser(name);
                sendEconomy(socket.id, name);
                for (let rId in rooms) {
                    let r = rooms[rId];
                    if (r.players[socket.id] && r.status === 'lobby') {
                        r.players[socket.id].equipped = u.equipped;
                        r.players[socket.id].hp = getMaxHp(u.equipped);
                        io.to(rId).emit('updateLobby', r);
                    }
                }
            } else socket.emit('joinError', 'Інвентар повний!');
        }
    });

    socket.on('equipModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            if (u.equipped[data.type]) u.inventory.push(u.equipped[data.type]);
            u.equipped[data.type] = data.id;
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
            for (let rId in rooms) {
                let r = rooms[rId];
                if (r.players[socket.id] && r.status === 'lobby') {
                    r.players[socket.id].equipped = u.equipped;
                    r.players[socket.id].hp = getMaxHp(u.equipped);
                    io.to(rId).emit('updateLobby', r);
                }
            }
        }
    });

    socket.on('sellModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            let modPr = MODULES[data.id] ? MODULES[data.id].price : 10;
            u.bucks += modPr;
            u.stats.earned += modPr;
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
        }
    });

    socket.on('dropModule', (data) => {
        let name = globalPlayers[socket.id];
        if (!name || !dbUsers[name]) return;
        let u = dbUsers[name], idx = u.inventory.indexOf(data.id);
        if (idx !== -1) {
            u.inventory.splice(idx, 1);
            saveUser(name);
            sendEconomy(socket.id, name);
        }
    });

    socket.on('requestRooms', () => { socket.emit('roomsList', getActiveRooms()); });

    socket.on('createRoom', (c) => {
        let n = globalPlayers[socket.id];
        if (!n || !dbUsers[n]) return socket.emit('joinError', 'Помилка авторизації');
        let rId = 'room_' + Date.now();
        rooms[rId] = {
            id: rId, hostName: n, hostSocket: socket.id, mode: c.mode || 'deathmatch',
            map: MAP_DATA[c.map] ? c.map : 'epic_map',
            maxPlayers: Math.max(2, Math.min(10, parseInt(c.maxPlayers) || 6)),
            winScore: Math.max(5, parseInt(c.winScore) || 50),
            hideTime: parseInt(c.hideTime) || 30, seekTime: parseInt(c.seekTime) || 120,
            hunterCount: parseInt(c.hunterCount) || 1, tdmTeams: parseInt(c.tdmTeams) || 2,
            tdmTime: parseInt(c.tdmTime) || 180, tdmScore: parseInt(c.tdmScore) || 20,
            tdmAutoBalance: c.tdmAutoBalance !== undefined ? !!c.tdmAutoBalance : true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0,
            players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {},
            wave: 1, nextWaveTime: 0, lastPowerupSpawn: Date.now()
        };
        socket.emit('roomCreated', rId);
        io.emit('roomsList', getActiveRooms());
    });

    socket.on('joinRoom', (roomId) => {
        let n = globalPlayers[socket.id];
        if (!n || !dbUsers[n]) return socket.emit('joinError', 'Помилка авторизації');
        if (!rooms[roomId]) return socket.emit('joinError', 'Кімната не знайдена');
        let r = rooms[roomId];
        if (Object.keys(r.players).length >= r.maxPlayers) return socket.emit('joinError', 'Кімната повна');
        if (r.status !== 'lobby') return socket.emit('joinError', 'Гра вже почалася');
        socket.join(roomId);
        let uEq = (dbUsers[n] && dbUsers[n].equipped) ? dbUsers[n].equipped : { cannon: null, turret: null, hull: null, tracks: null };
        r.players[socket.id] = {
            id: socket.id, name: n, color: null, team: null, ready: false,
            hp: getMaxHp(uEq), score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0,
            buff: null, buffEndTime: 0, buffProgress: 0, stuckIn: [], laserTarget: null,
            onFire: null, equipped: uEq, propType: 'prop_crate', isDisguised: false
        };
        socket.emit('joinedRoom', { roomId: roomId, roomData: r });
        io.to(roomId).emit('updateLobby', r);
        io.emit('roomsList', getActiveRooms());
    });

    socket.on('leaveRoom', (roomId) => {
        if (rooms[roomId] && rooms[roomId].players[socket.id]) {
            delete rooms[roomId].players[socket.id];
            socket.leave(roomId);
            if (Object.keys(rooms[roomId].players).length === 0) delete rooms[roomId];
            else if (rooms[roomId].hostSocket === socket.id) {
                rooms[roomId].hostSocket = Object.keys(rooms[roomId].players)[0];
                rooms[roomId].hostName = rooms[roomId].players[rooms[roomId].hostSocket].name;
            }
            if (rooms[roomId]) io.to(roomId).emit('updateLobby', rooms[roomId]);
            io.emit('roomsList', getActiveRooms());
        }
    });

    socket.on('updateRoomSettings', (d) => {
        let r = rooms[d.roomId];
        if (r && r.hostSocket === socket.id && r.status === 'lobby') {
            if (d.mode) {
                r.mode = d.mode;
                Object.values(r.players).forEach(p => { p.ready = false; p.team = null; p.color = null; });
            }
            if (d.map) r.map = MAP_DATA[d.map] ? d.map : 'epic_map';
            if (d.maxPlayers) r.maxPlayers = Math.max(2, Math.min(10, parseInt(d.maxPlayers) || 6));
            if (d.winScore) r.winScore = Math.max(5, parseInt(d.winScore) || 50);
            if (d.hunterCount) r.hunterCount = Math.max(1, Math.min(Object.keys(r.players).length - 1, parseInt(d.hunterCount) || 1));
            if (d.tdmTeams) r.tdmTeams = parseInt(d.tdmTeams) || 2;
            if (d.tdmTime) r.tdmTime = parseInt(d.tdmTime) || 180;
            if (d.tdmScore) r.tdmScore = parseInt(d.tdmScore) || 20;
            if (d.tdmAutoBalance !== undefined) r.tdmAutoBalance = !!d.tdmAutoBalance;
            io.to(d.roomId).emit('updateLobby', r);
            io.emit('roomsList', getActiveRooms());
        }
    });

    socket.on('setColor', (d) => {
        let r = rooms[d.roomId];
        if (r && r.players[socket.id]) {
            r.players[socket.id].color = d.color;
            r.players[socket.id].ready = false;
            io.to(d.roomId).emit('updateLobby', r);
        }
    });

    socket.on('setTeam', (d) => {
        let r = rooms[d.roomId];
        if (r && r.players[socket.id]) {
            if (r.mode === 'prophunt') {
                let cH = 0;
                Object.values(r.players).forEach(p => { if (p.team === 'hunter' && p.id !== socket.id) cH++; });
                if (d.team === 'hunter' && cH >= r.hunterCount) return;
            }
            r.players[socket.id].team = d.team;
            r.players[socket.id].ready = false;
            io.to(d.roomId).emit('updateLobby', r);
        }
    });

    socket.on('toggleReady', (roomId) => {
        let r = rooms[roomId];
        if (r && r.players[socket.id]) {
            if ((r.mode === 'prophunt' || r.mode === 'team_deathmatch') && !r.players[socket.id].team) return;
            if ((r.mode === 'deathmatch' || r.mode === 'survival') && !r.players[socket.id].color) return;
            r.players[socket.id].ready = !r.players[socket.id].ready;
            io.to(roomId).emit('updateLobby', r);
        }
    });

    socket.on('startGame', (roomId) => {
        let r = rooms[roomId];
        if (r && r.hostSocket === socket.id && r.status === 'lobby') {
            const pK = Object.keys(r.players);
            if (pK.length >= 2 && pK.every(id => r.players[id].ready)) {
                if (r.mode === 'team_deathmatch') {
                    let c = {};
                    pK.forEach(id => { let t = r.players[id].team; if (t) c[t] = (c[t] || 0) + 1; });
                    let aT = Object.keys(c);
                    if (aT.length < 2) return socket.emit('joinError', 'Для Командного бою потрібно мінімум 2 команди!');
                    if (r.tdmAutoBalance) {
                        let v = Object.values(c);
                        if (Math.max(...v) - Math.min(...v) > 1) return socket.emit('joinError', 'Увімкнено Автобаланс: склади команд не рівні!');
                    }
                    const cM = MAP_DATA[r.map] ? r.map : 'epic_map';
                    let sPts = MAP_DATA[cM].solids.filter(s => s.type === 'spawn_player');
                    if (sPts.length < aT.length) return socket.emit('joinError', `На мапі недостатньо точок спавну (${sPts.length}) для ${aT.length} команд!`);
                    r.teamScores = {};
                    aT.forEach(t => r.teamScores[t] = 0);
                    r.timeEndTime = Date.now() + 4000 + (r.tdmTime * 1000);
                    let tS = {};
                    aT.forEach((t, i) => tS[t] = sPts[i % sPts.length]);
                    pK.forEach(id => {
                        let p = r.players[id];
                        p.hp = getMaxHp(p.equipped);
                        p.score = 0; p.buff = null; p.stuckIn = []; p.onFire = null; p.color = p.team;
                        let sp = tS[p.team];
                        let rx = sp.x + (Math.random() * 80 - 40), ry = sp.y + (Math.random() * 80 - 40);
                        if (checkCollisionServer(cM, rx, ry, 24)) { rx = sp.x; ry = sp.y; }
                        p.x = rx; p.y = ry;
                    });
                } else {
                    pK.forEach(id => {
                        let p = r.players[id];
                        p.hp = getMaxHp(p.equipped);
                        p.score = 0; p.buff = null; p.stuckIn = []; p.onFire = null;
                        let sp = getValidSpawn(r.map, 24, 'spawn_player');
                        p.x = sp.x; p.y = sp.y;
                    });
                }
                r.status = 'playing';
                r.powerups = {}; r.mines = {}; r.lastPowerupSpawn = Date.now();
                
                if (r.mode === 'survival') {
                    r.wave = 0; r.state = 'waiting'; r.nextWaveTime = Date.now() + 4000; r.zombies = {};
                } else if (r.mode === 'prophunt') {
                    r.state = 'hiding'; r.phaseEndTime = Date.now() + 4000 + (r.hideTime * 1000);
                    const prps = ['prop_crate', 'prop_barrel', 'prop_sandbag', 'prop_rock', 'prop_bush', 'tree', 'prop_cone', 'prop_concrete', 'prop_tent', 'prop_generator', 'prop_tires'];
                    pK.forEach(id => {
                        if (r.players[id].team === 'hider') {
                            r.players[id].propType = prps[Math.floor(Math.random() * prps.length)];
                            r.players[id].isDisguised = false;
                        }
                    });
                }
                io.to(roomId).emit('gameStarting', r);
                io.emit('roomsList', getActiveRooms());
            }
        }
    });
socket.on('selectProp', (data) => {
        if (!data || !data.roomId) return;
        let r = rooms[data.roomId];
        if (r && r.status === 'playing' && r.mode === 'prophunt' && r.players[socket.id]) r.players[socket.id].propType = data.type;
    });

    socket.on('updateDisguise', (data) => {
        if (!data || !data.roomId) return;
        let r = rooms[data.roomId];
        if (r && r.status === 'playing' && r.mode === 'prophunt' && r.players[socket.id]) {
            r.players[socket.id].isDisguised = data.state;
            if (data.state) {
                r.players[socket.id].x = data.x;
                r.players[socket.id].y = data.y;
                r.players[socket.id].bodyAngle = 0;
                r.players[socket.id].turretAngle = 0;
            }
        }
    });

    socket.on('setLaserTarget', (data) => {
        let r = rooms[data.roomId], p = r ? r.players[socket.id] : null;
        if (p && p.buff === 'autolaser') p.laserTarget = data.targetId;
    });

    socket.on('move', (data) => {
        let r = rooms[data.roomId];
        if (r && r.players[socket.id] && r.status === 'playing') {
            let p = r.players[socket.id];
            p.x = data.x; p.y = data.y; p.bodyAngle = data.bodyAngle; p.turretAngle = data.turretAngle;
            if (p.stuckIn.length > 0) {
                let cM = MAP_DATA[r.map] ? r.map : 'epic_map', arr = MAP_DATA[cM].solids, sI = [];
                p.stuckIn.forEach(i => {
                    let s = arr[i], rad = 24;
                    let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30), h = Math.hypot(p.x - cx, p.y - cy) <= rad + sr;
                    let tX = Math.max(s.x, Math.min(p.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(p.y, s.y + (s.h || 30))), h2 = Math.hypot(p.x - tX, p.y - tY) <= rad;
                    if (s.type === 'tree' || s.type.includes('neon')) { if (h) sI.push(i); } else { if (h2) sI.push(i); }
                });
                p.stuckIn = sI;
            }
        }
    });

    socket.on('shoot', (data) => {
        let r = rooms[data.roomId];
        if (r && r.status === 'playing') {
            let p = r.players[socket.id];
            if (!p) return;
            if (p.buff === 'reaper') {
                let mId = 'mine_' + Date.now() + Math.random();
                r.mines[mId] = { id: mId, x: data.x, y: data.y, owner: socket.id, time: Date.now() };
                return;
            }
            data.owner = socket.id; data.pierced = [];
            io.to(data.roomId).emit('spawnBullet', data);
        }
    });

    socket.on('registerHit', (data) => {
        let r = rooms[data.roomId];
        if (!r || r.status !== 'playing' || !r.players[data.targetId]) return;
        let v = r.players[data.targetId], atk = r.players[socket.id], atkName = globalPlayers[socket.id];
        
        if (r.mode === 'survival' || v.hp <= 0 || v.buff === 'shield') return;
        if (r.mode === 'team_deathmatch' && atk && atk.team === v.team) return;
        
        let fD = data.amt;
        
        if (r.mode === 'prophunt') {
            if (r.state !== 'seeking' || !atk || atk.team !== 'hunter' || v.team === 'hunter') return;
            fD = 250; v.isDisguised = false;
        } else {
            if (atkName && dbUsers[atkName] && dbUsers[atkName].equipped && dbUsers[atkName].equipped.cannon) {
                let c = dbUsers[atkName].equipped.cannon;
                if (MODULES[c] && MODULES[c].stats.dmg) fD *= MODULES[c].stats.dmg;
            }
        }
        
        if (data.type === 'incendiary') v.onFire = { end: Date.now() + 5000, nextTick: Date.now() + 1000, owner: socket.id };
        
        v.hp = Math.max(0, v.hp - fD);
        io.to(socket.id).emit('hitConfirmed');
        
        if (v.hp === 0) processPlayerDeath(r, data.targetId, socket.id);
    });

    socket.on('takeDamage', (d) => {
        let r = rooms[d.roomId];
        if (!r || r.status !== 'playing' || !r.players[socket.id] || d.attacker !== 'zombie') return;
        let v = r.players[socket.id];
        if (v.buff === 'shield') return;
        v.hp = Math.max(0, v.hp - d.amt);
        if (v.hp === 0) processPlayerDeath(r, socket.id, 'zombie');
    });

    socket.on('collectToken', (d) => {
        let r = rooms[d.roomId];
        if (!r || !r.tokens[d.tid] || !r.tokens[d.tid].active || !r.players[socket.id] || r.players[socket.id].hp <= 0) return;
        r.tokens[d.tid].active = false; r.players[socket.id].score += 1;
        
        if (r.players[socket.id].score >= r.winScore && r.mode === 'deathmatch') {
            r.status = 'finished';
            let mt = 1 + Math.max(0, r.winScore - 5) * 0.10, bW = Math.round(10 * mt), bL = Math.round(2 * mt), rw = {};
            Object.values(r.players).forEach(p => {
                let a = Math.round(p.id === socket.id ? bW : bL); rw[p.id] = a;
                if (dbUsers[p.name]) {
                    dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
                    let dr = rollDrop(p.name); saveUser(p.name);
                    io.to(p.id).emit('economyUpdate', { bucks: dbUsers[p.name].bucks, inventory: dbUsers[p.name].inventory, equipped: dbUsers[p.name].equipped, stats: dbUsers[p.name].stats, adventClaims: dbUsers[p.name].adventClaims });
                    if (dr) io.to(p.id).emit('dropReceived', dr);
                }
            });
            io.to(d.roomId).emit('tokenCollected', { tid: d.tid, playerId: socket.id, score: r.players[socket.id].score });
            io.to(d.roomId).emit('gameOver', { winner: socket.id, name: r.players[socket.id] ? r.players[socket.id].name : 'ГРАВЕЦЬ', rewards: rw, isTeamWin: false });
            io.emit('roomsList', getActiveRooms());
        } else {
            io.to(d.roomId).emit('tokenCollected', { tid: d.tid, playerId: socket.id, score: r.players[socket.id].score });
        }
        delete r.tokens[d.tid];
    });

    socket.on('collectPowerup', (d) => {
        let r = rooms[d.roomId];
        if (r && r.powerups[d.pid] && r.powerups[d.pid].active && r.players[socket.id] && r.players[socket.id].hp > 0 && (r.mode === 'deathmatch' || r.mode === 'survival')) {
            let pT = r.powerups[d.pid].type, p = r.players[socket.id];
            p.buff = pT; p.buffEndTime = Date.now() + BUFF_DURATION; r.powerups[d.pid].active = false;
            if (pT === 'healing') { p.hp = Math.min(getMaxHp(p.equipped), p.hp + 150); p.nextHeal = Date.now() + 1000; }
            io.to(d.roomId).emit('powerupCollected', { pid: d.pid, playerId: socket.id, type: pT });
            delete r.powerups[d.pid];
        }
    });

    socket.on('zombieHit', (d) => {
        let r = rooms[d.roomId];
        if (r && r.zombies[d.zid] && r.zombies[d.zid].hp > 0) {
            let fD = d.dmg, aN = r.players[socket.id]?.name;
            if (aN && dbUsers[aN] && dbUsers[aN].equipped && dbUsers[aN].equipped.cannon) {
                let cId = dbUsers[aN].equipped.cannon;
                if (MODULES[cId] && MODULES[cId].stats.dmg) fD *= MODULES[cId].stats.dmg;
            }
            if (d.type === 'incendiary') r.zombies[d.zid].onFire = { end: Date.now() + 5000, nextTick: Date.now() + 1000, owner: socket.id };
            r.zombies[d.zid].hp -= fD;
            if (r.zombies[d.zid].hp <= 0) {
                if (r.zombies[d.zid].type === 'bomber') io.to(d.roomId).emit('bomberExplode', { x: r.zombies[d.zid].x, y: r.zombies[d.zid].y });
                delete r.zombies[d.zid];
            }
        }
    });

    socket.on('backToRoomLobby', (roomId) => {
        let r = rooms[roomId];
        if (r && r.status === 'finished') {
            r.status = 'lobby'; r.powerups = {}; r.tokens = {}; r.zombies = {}; r.mines = {}; r.wave = 1;
            Object.values(r.players).forEach(p => { p.ready = false; p.score = 0; p.hp = getMaxHp(p.equipped); p.buff = null; p.stuckIn = []; p.onFire = null; p.isDisguised = false; });
            io.to(roomId).emit('updateLobby', r);
            io.emit('roomsList', getActiveRooms());
        }
    });

    socket.on('disconnect', () => {
        delete globalPlayers[socket.id];
        for (let rId in rooms) {
            if (rooms[rId].players[socket.id]) {
                let wHi = rooms[rId].players[socket.id].team === 'hider', wHu = rooms[rId].players[socket.id].team === 'hunter';
                delete rooms[rId].players[socket.id];
                if (Object.keys(rooms[rId].players).length === 0) delete rooms[rId];
                else if (rooms[rId].hostSocket === socket.id) {
                    rooms[rId].hostSocket = Object.keys(rooms[rId].players)[0];
                    rooms[rId].hostName = rooms[rId].players[rooms[rId].hostSocket].name;
                }
                if (rooms[rId]) {
                    if (Object.keys(rooms[rId].players).length < 2 && rooms[rId].status === 'playing') {
                        rooms[rId].status = 'lobby'; io.to(rId).emit('updateLobby', rooms[rId]);
                    } else if (rooms[rId].status === 'playing' && rooms[rId].mode === 'prophunt') {
                        if (wHi) { let hA = Object.values(rooms[rId].players).filter(pl => pl.team === 'hider' && pl.hp > 0).length; if (hA === 0) endPropHuntGame(rooms[rId], 'hunter'); }
                        if (wHu) { let huA = Object.values(rooms[rId].players).filter(pl => pl.team === 'hunter' && pl.hp > 0).length; if (huA === 0) endPropHuntGame(rooms[rId], 'hider'); }
                    } else io.to(rId).emit('updateLobby', rooms[rId]);
                }
            }
        }
        io.emit('roomsList', getActiveRooms());
    });
});

function endPropHuntGame(r, wT) {
    r.status = 'finished'; let rew = {}, wId = null;
    Object.values(r.players).forEach(p => {
        let isW = (p.team === wT), a = isW ? 15 : 3; rew[p.id] = a; if (isW && !wId) wId = p.id;
        if (dbUsers[p.name]) {
            dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
            let dr = rollDrop(p.name); saveUser(p.name);
            io.to(p.id).emit('economyUpdate', { bucks: dbUsers[p.name].bucks, inventory: dbUsers[p.name].inventory, equipped: dbUsers[p.name].equipped, stats: dbUsers[p.name].stats, adventClaims: dbUsers[p.name].adventClaims });
            if (dr) io.to(p.id).emit('dropReceived', dr);
        }
    });
    io.to(r.id).emit('gameOver', { winner: wId || 'TEAM', name: wT === 'hunter' ? 'КОМАНДА МИСЛИВЦІВ' : 'ТІ, ХТО ХОВАВСЯ', rewards: rew, isTeamWin: true });
    io.emit('roomsList', getActiveRooms());
}

function endTDMGame(r, wT) {
    r.status = 'finished'; let rew = {}, wId = null, isD = (wT === 'draw');
    Object.values(r.players).forEach(p => {
        let isW = !isD && (p.team === wT), a = isD ? 10 : (isW ? 20 : 5); rew[p.id] = a; if (isW && !wId) wId = p.id;
        if (dbUsers[p.name]) {
            dbUsers[p.name].bucks += a; dbUsers[p.name].stats.earned += a; dbUsers[p.name].stats.matches++;
            let dr = rollDrop(p.name); saveUser(p.name);
            io.to(p.id).emit('economyUpdate', { bucks: dbUsers[p.name].bucks, inventory: dbUsers[p.name].inventory, equipped: dbUsers[p.name].equipped, stats: dbUsers[p.name].stats, adventClaims: dbUsers[p.name].adventClaims });
            if (dr) io.to(p.id).emit('dropReceived', dr);
        }
    });
    io.to(r.id).emit('gameOver', { winner: isD ? 'DRAW' : (wT || 'TEAM'), name: isD ? 'НІЧИЯ' : `КОМАНДА ${typeof wT === 'string' ? wT.toUpperCase() : 'ПОБЕДИТЕЛЬ'}`, rewards: rew, isTeamWin: !isD });
    io.emit('roomsList', getActiveRooms());
}

setInterval(() => {
    const now = Date.now();
    for (let rId in rooms) {
        let r = rooms[rId];
        if (r.status !== 'playing') continue;

        if (r.mode === 'deathmatch' || r.mode === 'survival') {
            let pKeys = Object.keys(r.powerups);
            pKeys.forEach(k => { if (now - r.powerups[k].spawnTime > 60000) delete r.powerups[k]; });
            pKeys = Object.keys(r.powerups);
            if (now - r.lastPowerupSpawn >= 30000) {
                r.lastPowerupSpawn = now;
                const cM = MAP_DATA[r.map] ? r.map : 'epic_map', sPts = MAP_DATA[cM].solids.filter(s => s.type === 'spawn_powerup');
                if (sPts.length > 0 && pKeys.length < 4) {
                    let cnt = Math.min(2, 4 - pKeys.length), shuffled = [...sPts].sort(() => 0.5 - Math.random()).slice(0, cnt);
                    const pTypes = ['boss', 'samurai', 'minigun', 'shotgun', 'homing', 'incendiary', 'explosive', 'piercing', 'healing', 'shield', 'autolaser', 'reaper'];
                    shuffled.forEach((pt, i) => {
                        let pid = 'p_up_' + now + '_' + i, pType = pTypes[Math.floor(Math.random() * pTypes.length)];
                        r.powerups[pid] = { id: pid, x: pt.x, y: pt.y, type: pType, active: true, spawnTime: now };
                    });
                }
            }
        } else r.powerups = {};

        if (r.mode === 'prophunt') {
            if (r.state === 'hiding' && now >= r.phaseEndTime) {
                r.state = 'seeking'; r.phaseEndTime = now + (r.seekTime * 1000);
                Object.values(r.players).forEach(p => { if (p.team === 'hunter') { p.hp = getMaxHp(p.equipped); let sp = getValidSpawn(r.map, 30, 'spawn_player'); p.x = sp.x; p.y = sp.y; } });
                io.to(rId).emit('phPhaseChange', { phase: 'seeking', time: r.seekTime });
            } else if (r.state === 'seeking' && now >= r.phaseEndTime) {
                endPropHuntGame(r, 'hider');
                continue;
            }
        }
        
        if (r.mode === 'team_deathmatch') {
            if (now >= r.timeEndTime) {
                let mS = -1, w = [];
                for (let t in r.teamScores) {
                    if (r.teamScores[t] > mS) { mS = r.teamScores[t]; w = [t]; } else if (r.teamScores[t] === mS) w.push(t);
                }
                if (w.length === 1) endTDMGame(r, w[0]); else endTDMGame(r, 'draw');
                continue;
            }
        }

        for (let mid in r.mines) {
            let m = r.mines[mid];
            Object.values(r.players).forEach(p => {
                if (p.hp > 0 && p.id !== m.owner && Math.hypot(p.x - m.x, p.y - m.y) < 35 && p.buff !== 'shield') {
                    p.hp = Math.max(0, p.hp - 125);
                    io.to(rId).emit('mineExploded', { x: m.x, y: m.y });
                    if (p.hp === 0) processPlayerDeath(r, p.id, m.owner);
                    delete r.mines[mid];
                }
            });
        }

        Object.values(r.players).forEach(p => {
            if (p.onFire) {
                if (now >= p.onFire.end) p.onFire = null;
                else if (now >= p.onFire.nextTick && p.hp > 0) {
                    p.onFire.nextTick = now + 1000;
                    if (p.buff !== 'shield') p.hp = Math.max(0, p.hp - 20);
                    io.to(rId).emit('burnTick', { x: p.x, y: p.y });
                    if (p.hp === 0) {
                        let killerId = p.onFire ? p.onFire.owner : null;
                        processPlayerDeath(r, p.id, killerId);
                    }
                }
            }
            if (p.buff) {
                p.buffProgress = Math.max(0, (p.buffEndTime - now) / BUFF_DURATION);
                if (p.buff === 'healing' && p.hp > 0 && now >= p.nextHeal) {
                    p.hp = Math.min(getMaxHp(p.equipped), p.hp + 10); p.nextHeal = now + 1000;
                }
                if (p.buff === 'autolaser' && p.laserTarget && r.players[p.laserTarget] && r.players[p.laserTarget].hp > 0 && (!p.nextLaser || now >= p.nextLaser)) {
                    if (Math.hypot(p.x - r.players[p.laserTarget].x, p.y - r.players[p.laserTarget].y) < 400) {
                        p.nextLaser = now + 100;
                        io.to(rId).emit('laserHit', { src: p.id, tgt: p.laserTarget });
                        if (r.players[p.laserTarget].buff !== 'shield') {
                            r.players[p.laserTarget].hp = Math.max(0, r.players[p.laserTarget].hp - 20);
                            if (r.players[p.laserTarget].hp === 0) processPlayerDeath(r, p.laserTarget, p.id);
                        }
                    }
                }
                if (now > p.buffEndTime) {
                    if (p.buff === 'boss') {
                        p.stuckIn = []; let cM = MAP_DATA[r.map] ? r.map : 'epic_map', arr = MAP_DATA[cM].solids;
                        for (let i = 0; i < arr.length; i++) {
                            let s = arr[i]; if (s.type.includes('spawn') || s.type === 'line') continue;
                            let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30), h = Math.hypot(p.x - cx, p.y - cy) <= 24 + sr;
                            let tX = Math.max(s.x, Math.min(p.x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(p.y, s.y + (s.h || 30))), h2 = Math.hypot(p.x - tX, p.y - tY) <= 24;
                            if (s.type === 'tree' || s.type.includes('neon')) { if (h) p.stuckIn.push(i); } else { if (h2) p.stuckIn.push(i); }
                        }
                    }
                    p.buff = null; p.buffProgress = 0;
                }
            } else p.buffProgress = 0;
        });

        if (r.mode === 'survival') {
            const aP = Object.values(r.players).filter(pl => pl.hp > 0);
            if (aP.length === 0) {
                r.status = 'finished'; let rw = {};
                Object.values(r.players).forEach(pl => {
                    let n = pl.name; if (dbUsers[n]) { let wv = r.wave; dbUsers[n].bucks += wv; dbUsers[n].stats.earned += wv; dbUsers[n].stats.matches++; let dr = rollDrop(n); saveUser(n); io.to(pl.id).emit('economyUpdate', { bucks: dbUsers[n].bucks, inventory: dbUsers[n].inventory, equipped: dbUsers[n].equipped, stats: dbUsers[n].stats, adventClaims: dbUsers[n].adventClaims }); if (dr) io.to(pl.id).emit('dropReceived', dr); }
                });
                io.to(rId).emit('gameOver', { winner: 'ZOMBIES', wave: r.wave, rewards: rw, isTeamWin: false }); io.emit('roomsList', getActiveRooms());
                continue;
            }
            if (Object.keys(r.zombies).length === 0) {
                if (r.state === 'playing') { r.state = 'waiting'; r.nextWaveTime = now + 4000; let nW = r.wave + 1; if (nW === 10 || nW === 20 || nW === 30 || nW === 40) io.to(rId).emit('bossWarning'); }
                else if (r.state === 'waiting' && now > r.nextWaveTime) {
                    r.wave++; let isBW = (r.wave % 10 === 0 && r.wave <= 40);
                    if (isBW) {
                        let bTypes = ['pikus', 'shurik', 'oneshot', 'padlo'], bType = bTypes[(r.wave / 10) - 1], zid = 'boss_' + now, zS = getValidSpawn(r.map, 50, 'spawn_zombie');
                        r.zombies[zid] = { id: zid, x: zS.x, y: zS.y, type: bType, hp: Z_TYPES[bType].hp, nextAttack: 0, onFire: null };
                        io.to(rId).emit('newWave', { wave: r.wave, isBoss: true, bossName: Z_TYPES[bType].name });
                    } else {
                        let sC = 20 + (r.wave - 1) * 5, tL = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost'], mI = Math.min(tL.length - 1, Math.floor((r.wave) / 5)), aT = tL.slice(0, mI + 1);
                        for (let i = 0; i < sC; i++) { let t = aT[Math.floor(Math.random() * aT.length)], zS = getValidEdgeSpawn(r.map, 20, 'spawn_zombie'), zid = 'z_' + now + '_' + i; r.zombies[zid] = { id: zid, x: zS.x, y: zS.y, type: t, hp: Z_TYPES[t].hp, nextAttack: 0, onFire: null }; }
                        io.to(rId).emit('newWave', { wave: r.wave, isBoss: false });
                    }
                    r.state = 'playing';
                }
            } else if (r.state === 'playing') {
                for (let zid in r.zombies) {
                    let z = r.zombies[zid], t = null, mD = Infinity;
                    if (z.onFire) {
                        if (now >= z.onFire.end) z.onFire = null;
                        else if (now >= z.onFire.nextTick && z.hp > 0) {
                            z.onFire.nextTick = now + 1000; z.hp -= 20; io.to(rId).emit('burnTick', { x: z.x, y: z.y });
                            if (z.hp <= 0) { if (z.type === 'bomber') io.to(rId).emit('bomberExplode', { x: z.x, y: z.y }); delete r.zombies[zid]; continue; }
                        }
                    }
                    aP.forEach(pl => { let d = Math.hypot(pl.x - z.x, pl.y - z.y); if (pl.buff === 'invisible') d *= 3; if (d < mD) { mD = d; t = pl; } });
                    if (t) {
                        let dx = t.x - z.x, dy = t.y - z.y, l = Math.hypot(dx, dy), sp = Z_TYPES[z.type].speed, nX = z.x + (dx / l) * sp * (1 / 30), nY = z.y + (dy / l) * sp * (1 / 30);
                        if (!checkCollisionServer(r.map, nX, z.y, Z_TYPES[z.type].radius)) z.x = nX;
                        if (!checkCollisionServer(r.map, z.x, nY, Z_TYPES[z.type].radius)) z.y = nY;
                        if (Z_TYPES[z.type].isBoss && now > z.nextAttack) {
                            z.nextAttack = now + Z_TYPES[z.type].cd; let bC = Z_TYPES[z.type].bullets, spr = Math.PI / 4, sA = Math.atan2(dy, dx) - (spr / 2), st = spr / Math.max(1, bC - 1); if (bC === 25) { spr = Math.PI * 2; st = spr / 25; sA = 0; }
                            for (let b = 0; b < bC; b++) { let a = sA + (b * st); io.to(rId).emit('spawnBullet', { id: 'b_' + now + b + zid, x: z.x, y: z.y, vx: Math.cos(a) * 500, vy: Math.sin(a) * 500, type: 'boss_proj', owner: 'zombie', dmgOverride: Z_TYPES[z.type].dmg }); }
                        } else if (Z_TYPES[z.type].ranged && !Z_TYPES[z.type].isBoss && mD < 400 && now > z.nextAttack) {
                            z.nextAttack = now + 2000; io.to(rId).emit('spawnBullet', { id: 'ac_' + now + zid, x: z.x, y: z.y, vx: (dx / l) * 400, vy: (dy / l) * 400, type: 'acid', owner: 'zombie' });
                        } else if (!Z_TYPES[z.type].isBoss && mD < 30 + Z_TYPES[z.type].radius + 5 && now > z.nextAttack) {
                            z.nextAttack = now + 1000; io.to(rId).emit('zombieMeleeHit', { targetId: t.id, dmg: Z_TYPES[z.type].dmg });
                        }
                    }
                }
            }
        }
        
        let syncData = { players: r.players, zombies: r.zombies, powerups: r.powerups, tokens: r.tokens, mines: r.mines };
        if (r.mode === 'prophunt') { syncData.phState = r.state; syncData.phTimeLeft = Math.max(0, Math.ceil((r.phaseEndTime - now) / 1000)); }
        if (r.mode === 'team_deathmatch') { syncData.teamScores = r.teamScores; syncData.timeEndTime = r.timeEndTime; }
        io.to(rId).emit('sync', syncData);
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log(`Server running on port ${PORT}`));