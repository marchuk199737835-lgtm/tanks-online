const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

app.use(express.static(path.join(__dirname, 'public')));
const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir); 
const musicCategories = ['loby', 'dezmatch', 'survive', 'main']; let musicData = {};
musicCategories.forEach(cat => { const catDir = path.join(musicDir, cat); if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true }); });
function scanMusic() { musicCategories.forEach(cat => { const catDir = path.join(musicDir, cat); musicData[cat] = fs.readdirSync(catDir).filter(f => f.endsWith('.mp3')).map(f => `${cat}/${f}`); }); }
scanMusic();
app.use('/music', express.static(musicDir));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const MAX_HP = 500; const BUFF_DURATION = 15000;
const mongoUri = process.env.MONGO_URI; let dbUsersCol = null; let dbUsers = {}; 

if (mongoUri) {
    const client = new MongoClient(mongoUri);
    client.connect().then(() => {
        console.log("✅ Підключено до MongoDB!");
        const db = client.db("tanks_db"); dbUsersCol = db.collection("users");
        dbUsersCol.find({}).toArray().then(users => { users.forEach(u => dbUsers[u.name] = u); console.log(`Завантажено акаунтів: ${users.length}`); });
    }).catch(err => console.error("❌ Помилка MongoDB:", err));
}

function saveUser(name) { if (dbUsersCol && dbUsers[name]) { dbUsersCol.updateOne({ name: name }, { $set: dbUsers[name] }, { upsert: true }); } }
function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }

const SHOP_DATA = { damage: { levels: [0, 2, 4, 8, 12], prices: [50, 100, 200, 500] }, speed: { levels: [0, 2, 5, 10], prices: [50, 100, 150] }, earnings: { levels: [0, 5, 10], prices: [50, 100] } };
const MAP_DATA = { 'city': { size: 3600, solids: [] }, 'hangars': { size: 3000, solids: [] }, 'ship': { size: 2000, solids: [] }, 'castle': { size: 2500, solids: [] } };
const neonColors = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981'];
for(let x=200; x<3400; x+=450) { for(let y=200; y<3400; y+=450) { let n = (x*13 + y*17) % 100; if(n < 75) MAP_DATA['city'].solids.push({ type: 'wall', x, y, w: 300, h: 300 }); } }
for(let x=150; x<2800; x+=350) { for(let y=150; y<2800; y+=300) { let n = (x*23 + y*29) % 100; if(n < 60) MAP_DATA['hangars'].solids.push({ type: 'wall', x, y, w: 250, h: 150 }); } }
for(let x=200; x<1800; x+=250) { for(let y=200; y<1800; y+=250) { let n = (x*31 + y*37) % 100; if(n < 30) MAP_DATA['ship'].solids.push({ type: 'wall', x, y, w: 180, h: 80 }); } }
for(let x=200; x<2300; x+=300) { for(let y=200; y<2300; y+=300) { let n = (x*41 + y*43) % 100; if(n < 50) { if(n < 15) MAP_DATA['castle'].solids.push({ type: 'tree', x: x+100, y: y+100, r: 60 }); else MAP_DATA['castle'].solids.push({ type: 'wall', x, y, w: 250, h: 80 }); } } }

function checkCollisionServer(mapName, x, y, r) {
    let cMap = MAP_DATA[mapName] ? mapName : 'city'; let mSize = MAP_DATA[cMap].size;
    if (x - r < 0 || x + r > mSize || y - r < 0 || y + r > mSize) return true;
    for(let s of MAP_DATA[cMap].solids) { if(s.type === 'wall') { let testX = Math.max(s.x, Math.min(x, s.x+s.w)), testY = Math.max(s.y, Math.min(y, s.y+s.h)); if(Math.hypot(x-testX, y-testY) <= r) return true; } else if (s.type === 'tree') { if(Math.hypot(x-s.x, y-s.y) < r+s.r) return true; } } return false;
}

function getValidSpawn(mapName, r) {
    let cMap = MAP_DATA[mapName] ? mapName : 'city'; let mSize = MAP_DATA[cMap].size;
    for(let i=0; i<100; i++) { let x = Math.random()*(mSize-200)+100; let y = Math.random()*(mSize-200)+100; if(!checkCollisionServer(cMap, x, y, r + 20)) return {x, y}; } return {x: mSize/2, y: mSize/2}; 
}

function getValidEdgeSpawn(mapName, r) {
    let cMap = MAP_DATA[mapName] ? mapName : 'city'; let mSize = MAP_DATA[cMap].size;
    for(let i=0; i<100; i++) { let x = Math.random() < 0.5 ? 50 : mSize-50; let y = Math.random() * (mSize - 100) + 50; if(!checkCollisionServer(cMap, x, y, r + 20)) return {x, y}; }
    return getValidSpawn(mapName, r); 
}

let rooms = {}; let globalPlayers = {}; 
const Z_TYPES = { 'normal': { hp: 25, speed: 120, dmg: 10, radius: 15, color: '#22c55e' }, 'runner': { hp: 15, speed: 250, dmg: 5, radius: 12, color: '#84cc16' }, 'tanker': { hp: 100, speed: 60, dmg: 25, radius: 25, color: '#15803d' }, 'spitter': { hp: 40, speed: 90, dmg: 15, radius: 15, color: '#a3e635', ranged: true }, 'bomber': { hp: 30, speed: 140, dmg: 50, radius: 18, color: '#dc2626', explode: true }, 'ghost': { hp: 20, speed: 100, dmg: 10, radius: 15, color: '#cbd5e1', ghost: true }, 'pikus': { isBoss: true, name: 'ПІКУС', hp: 1000, speed: 294, dmg: 100, radius: 30, color: '#9333ea', bullets: 3, cd: 3000 }, 'shurik': { isBoss: true, name: 'ШУРІК', hp: 2000, speed: 280, dmg: 100, radius: 22.5, color: '#f43f5e', bullets: 10, cd: 3000 }, 'oneshot': { isBoss: true, name: 'ВАНШОТУС', hp: 3000, speed: 294, dmg: 1000, radius: 30, color: '#fbbf24', bullets: 2, cd: 2000 }, 'padlo': { isBoss: true, name: 'ПАДЛО', hp: 5000, speed: 280, dmg: 75, radius: 15, color: '#10b981', bullets: 25, cd: 1500 } };

function sendEconomy(socketId, name) { if (dbUsers[name]) io.to(socketId).emit('economyUpdate', { bucks: dbUsers[name].bucks, upgrades: dbUsers[name].upgrades }); }
function getActiveRooms() { return Object.values(rooms).map(r => ({ id: r.id, hostName: r.hostName, mode: r.mode, map: r.map, playersCount: Object.keys(r.players).length, maxPlayers: r.maxPlayers, status: r.status })); }

io.on('connection', (socket) => {
    socket.emit('initMusic', musicData);
    
    socket.on('register', (data) => { const { name, password } = data; if(!name || !password || name.length < 3 || password.length < 4) return socket.emit('authError', 'Логін від 3 символів, пароль від 4!'); if(dbUsers[name]) return socket.emit('authError', 'Цей логін вже зайнятий!'); const token = crypto.randomUUID(); dbUsers[name] = { name: name, password: hashPwd(password), token: token, bucks: 0, upgrades: { damage: 0, speed: 0, earnings: 0 } }; saveUser(name); globalPlayers[socket.id] = name; socket.emit('authSuccess', { name, token }); sendEconomy(socket.id, name); });
    socket.on('login', (data) => { const { name, password } = data; const u = dbUsers[name]; if(!u || u.password !== hashPwd(password)) return socket.emit('authError', 'Невірний логін або пароль!'); const token = crypto.randomUUID(); u.token = token; if(u.bucks === undefined) { u.bucks = 0; u.upgrades = { damage: 0, speed: 0, earnings: 0 }; } saveUser(name); globalPlayers[socket.id] = name; socket.emit('authSuccess', { name, token }); sendEconomy(socket.id, name); });
    socket.on('authToken', (token) => { let foundName = null; for(let n in dbUsers) { if(dbUsers[n].token === token) foundName = n; } if(foundName) { globalPlayers[socket.id] = foundName; socket.emit('authSuccess', { name: foundName, token }); sendEconomy(socket.id, foundName); } else socket.emit('authError', 'Сесія закінчилась, увійдіть знову'); });

    socket.on('buyUpgrade', (type) => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name] || !SHOP_DATA[type]) return; let u = dbUsers[name]; let currentLvl = u.upgrades[type] || 0; let maxLvl = SHOP_DATA[type].prices.length; if(currentLvl < maxLvl) { let price = SHOP_DATA[type].prices[currentLvl]; if(u.bucks >= price) { u.bucks -= price; u.upgrades[type] = currentLvl + 1; saveUser(name); sendEconomy(socket.id, name); } } });
    socket.on('buyCase', () => { let name = globalPlayers[socket.id]; if(!name || !dbUsers[name]) return; let u = dbUsers[name]; if(u.bucks >= 50) { u.bucks -= 50; let types = ['damage', 'speed', 'earnings']; let rType = types[Math.floor(Math.random() * types.length)]; let maxLvl = SHOP_DATA[rType].prices.length; let rLvl = Math.floor(Math.random() * maxLvl) + 1; u.upgrades[rType] = rLvl; saveUser(name); socket.emit('caseResult', { type: rType, level: rLvl, bucks: u.bucks, upgrades: u.upgrades }); } });

    socket.on('requestRooms', () => { socket.emit('roomsList', getActiveRooms()); });
    socket.on('createRoom', (config) => { let name = globalPlayers[socket.id]; if(!name) return; let roomId = 'room_' + Date.now(); rooms[roomId] = { id: roomId, hostName: name, hostSocket: socket.id, mode: config.mode, map: config.map, maxPlayers: Math.max(2, Math.min(10, config.maxPlayers)), winScore: Math.max(5, config.winScore), status: 'lobby', players: {}, powerups: {}, tokens: {}, zombies: {}, wave: 1, survivalState: 'waiting', nextWaveTime: 0, lastPowerupSpawn: Date.now() }; socket.emit('roomCreated', roomId); io.emit('roomsList', getActiveRooms()); });
    socket.on('joinRoom', (roomId) => { let name = globalPlayers[socket.id]; if(!name || !rooms[roomId]) return socket.emit('joinError', 'Кімната не знайдена'); let room = rooms[roomId]; if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('joinError', 'Кімната повна'); if (room.status !== 'lobby') return socket.emit('joinError', 'Гра вже почалася'); socket.join(roomId); room.players[socket.id] = { id: socket.id, name: name, color: null, ready: false, hp: MAX_HP, score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0, buff: null, buffEndTime: 0, buffProgress: 0 }; socket.emit('joinedRoom', { roomId: roomId, roomData: room }); io.to(roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); });
    socket.on('leaveRoom', (roomId) => { if(rooms[roomId] && rooms[roomId].players[socket.id]) { delete rooms[roomId].players[socket.id]; socket.leave(roomId); if(Object.keys(rooms[roomId].players).length === 0) { delete rooms[roomId]; } else if (rooms[roomId].hostSocket === socket.id) { rooms[roomId].hostSocket = Object.keys(rooms[roomId].players)[0]; rooms[roomId].hostName = rooms[roomId].players[rooms[roomId].hostSocket].name; } if (rooms[roomId]) io.to(roomId).emit('updateLobby', rooms[roomId]); io.emit('roomsList', getActiveRooms()); } });

    socket.on('updateRoomSettings', (data) => { let room = rooms[data.roomId]; if (room && room.hostSocket === socket.id && room.status === 'lobby') { if (data.mode) room.mode = data.mode; if (data.map) room.map = data.map; if (data.maxPlayers) room.maxPlayers = Math.max(2, Math.min(10, data.maxPlayers)); if (data.winScore) room.winScore = Math.max(5, data.winScore); io.to(data.roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); } });
    socket.on('setColor', (data) => { let room = rooms[data.roomId]; if(room && room.players[socket.id]) { room.players[socket.id].color = data.color; room.players[socket.id].ready = false; io.to(data.roomId).emit('updateLobby', room); } });
    socket.on('toggleReady', (roomId) => { let room = rooms[roomId]; if(room && room.players[socket.id] && room.players[socket.id].color) { room.players[socket.id].ready = !room.players[socket.id].ready; io.to(roomId).emit('updateLobby', room); } });
    socket.on('startGame', (roomId) => { let room = rooms[roomId]; if (room && room.hostSocket === socket.id && room.status === 'lobby') { const pKeys = Object.keys(room.players); if (pKeys.length >= 2 && pKeys.every(id => room.players[id].ready)) { room.status = 'playing'; if (room.mode === 'survival') { room.wave = 1; room.survivalState = 'spawning'; room.zombies = {}; } pKeys.forEach((id) => { room.players[id].hp = MAX_HP; room.players[id].score = 0; room.players[id].buff = null; let spawn = getValidSpawn(room.map, 30); room.players[id].x = spawn.x; room.players[id].y = spawn.y; }); io.to(roomId).emit('gameStarting', room); io.emit('roomsList', getActiveRooms()); } } });

    socket.on('move', (data) => { let room = rooms[data.roomId]; if(room && room.players[socket.id] && room.status === 'playing') { room.players[socket.id].x = data.x; room.players[socket.id].y = data.y; room.players[socket.id].bodyAngle = data.bodyAngle; room.players[socket.id].turretAngle = data.turretAngle; } });
    socket.on('shoot', (data) => { let room = rooms[data.roomId]; if(room && room.status === 'playing') io.to(data.roomId).emit('spawnBullet', { ...data, owner: socket.id }); });

    socket.on('takeDamage', (data) => {
        let room = rooms[data.roomId]; if(!room || room.status !== 'playing' || !room.players[socket.id] || room.players[socket.id].hp <= 0) return; let finalDmg = data.amt;
        if (data.attacker && room.players[data.attacker]) { let atkName = room.players[data.attacker].name; if (dbUsers[atkName]) { let dLvl = dbUsers[atkName].upgrades.damage || 0; let dMult = 1.0; if(dLvl===1) dMult=1.02; else if(dLvl===2) dMult=1.04; else if(dLvl===3) dMult=1.08; else if(dLvl===4) dMult=1.12; finalDmg *= dMult; } io.to(data.attacker).emit('hitConfirmed'); }
        room.players[socket.id].hp = Math.max(0, room.players[socket.id].hp - finalDmg);
        if (room.players[socket.id].hp === 0) { room.players[socket.id].buff = null; io.to(data.roomId).emit('playerDied', { id: socket.id, killer: data.attacker }); if (room.mode === 'deathmatch') { const tid = 'tkn_' + Date.now() + Math.random(); room.tokens[tid] = { id: tid, x: room.players[socket.id].x, y: room.players[socket.id].y, color: room.players[socket.id].color, active: true }; } setTimeout(() => { if(room && room.players[socket.id] && room.status === 'playing' && room.mode !== 'survival') { room.players[socket.id].hp = MAX_HP; let spawn = getValidSpawn(room.map, 30); room.players[socket.id].x = spawn.x; room.players[socket.id].y = spawn.y; io.to(data.roomId).emit('playerRespawn', room.players[socket.id]); } }, 3000); }
    });

    socket.on('collectToken', (data) => {
        let room = rooms[data.roomId]; if (!room || !room.tokens[data.tid] || !room.tokens[data.tid].active || !room.players[socket.id] || room.players[socket.id].hp <= 0) return;
        room.tokens[data.tid].active = false; room.players[socket.id].score += 1;
        if (room.players[socket.id].score >= room.winScore && room.mode === 'deathmatch') {
            room.status = 'finished'; let multiplier = 1 + Math.max(0, room.winScore - 5) * 0.10; let baseWin = Math.round(10 * multiplier); let baseLose = Math.round(2 * multiplier); let rewards = {};
            Object.values(room.players).forEach(p => { let eLvl = dbUsers[p.name] ? (dbUsers[p.name].upgrades.earnings || 0) : 0; let bonus = eLvl === 1 ? 1.05 : (eLvl === 2 ? 1.10 : 1.0); let amt = Math.round((p.id === socket.id ? baseWin : baseLose) * bonus); rewards[p.id] = amt; if(dbUsers[p.name]) { dbUsers[p.name].bucks += amt; saveUser(p.name); io.to(p.id).emit('economyUpdate', { bucks: dbUsers[p.name].bucks, upgrades: dbUsers[p.name].upgrades }); } });
            io.to(data.roomId).emit('tokenCollected', { tid: data.tid, playerId: socket.id, score: room.players[socket.id].score }); io.to(data.roomId).emit('gameOver', { winner: socket.id, name: room.players[socket.id].name, rewards: rewards }); io.emit('roomsList', getActiveRooms());
        } else { io.to(data.roomId).emit('tokenCollected', { tid: data.tid, playerId: socket.id, score: room.players[socket.id].score }); } delete room.tokens[data.tid]; 
    });

    socket.on('collectPowerup', (data) => { 
        let room = rooms[data.roomId]; 
        if (room && room.powerups[data.pid] && room.powerups[data.pid].active && room.players[socket.id] && room.players[socket.id].hp > 0) { 
            let pType = room.powerups[data.pid].type; room.players[socket.id].buff = pType; room.players[socket.id].buffEndTime = Date.now() + BUFF_DURATION; room.powerups[data.pid].active = false; 
            if (pType === 'healing') { room.players[socket.id].hp = Math.min(MAX_HP, room.players[socket.id].hp + 100); }
            io.to(data.roomId).emit('powerupCollected', { pid: data.pid, playerId: socket.id, type: pType }); delete room.powerups[data.pid]; 
        } 
    });

    socket.on('zombieHit', (data) => {
        let room = rooms[data.roomId]; if (room && room.zombies[data.zid] && room.zombies[data.zid].hp > 0) {
            let finalDmg = data.dmg; let atkName = room.players[socket.id]?.name;
            if (atkName && dbUsers[atkName]) { let dLvl = dbUsers[atkName].upgrades.damage || 0; let dMult = 1.0; if(dLvl===1) dMult=1.02; else if(dLvl===2) dMult=1.04; else if(dLvl===3) dMult=1.08; else if(dLvl===4) dMult=1.12; finalDmg *= dMult; }
            room.zombies[data.zid].hp -= finalDmg;
            if (room.zombies[data.zid].hp <= 0) { if(room.zombies[data.zid].type === 'bomber') io.to(data.roomId).emit('bomberExplode', { x: room.zombies[data.zid].x, y: room.zombies[data.zid].y }); delete room.zombies[data.zid]; }
        }
    });

    socket.on('backToRoomLobby', (roomId) => { let room = rooms[roomId]; if (room && room.status === 'finished') { room.status = 'lobby'; room.powerups = {}; room.tokens = {}; room.zombies = {}; room.wave = 1; Object.values(room.players).forEach(p => { p.ready = false; p.score = 0; p.hp = MAX_HP; p.buff = null; }); io.to(roomId).emit('updateLobby', room); io.emit('roomsList', getActiveRooms()); } });

    socket.on('disconnect', () => {
        delete globalPlayers[socket.id];
        for(let roomId in rooms) {
            if(rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                if(Object.keys(rooms[roomId].players).length === 0) { delete rooms[roomId]; } else if (rooms[roomId].hostSocket === socket.id) { rooms[roomId].hostSocket = Object.keys(rooms[roomId].players)[0]; rooms[roomId].hostName = rooms[roomId].players[rooms[roomId].hostSocket].name; }
                if (rooms[roomId]) { if(Object.keys(rooms[roomId].players).length < 2 && rooms[roomId].status === 'playing') { rooms[roomId].status = 'lobby'; io.to(roomId).emit('updateLobby', rooms[roomId]); } else { io.to(roomId).emit('updateLobby', rooms[roomId]); } }
            }
        }
        io.emit('roomsList', getActiveRooms());
    });
});

setInterval(() => {
    const now = Date.now();
    for(let roomId in rooms) {
        let room = rooms[roomId]; if (room.status !== 'playing') continue;
        Object.values(room.players).forEach(p => { 
            if (p.buff) { 
                p.buffProgress = Math.max(0, (p.buffEndTime - now) / BUFF_DURATION); 
                if (p.buff === 'healing' && p.hp > 0) p.hp = Math.min(MAX_HP, p.hp + 10 * (1/30)); 
                if (now > p.buffEndTime) { 
                    if (p.buff === 'boss') { 
                        if (checkCollisionServer(room.map, p.x, p.y, 30)) {
                            let found = false;
                            for(let rad = 50; rad < 800; rad += 50) {
                                for(let angle = 0; angle < Math.PI * 2; angle += Math.PI/4) {
                                    let testX = p.x + Math.cos(angle)*rad; let testY = p.y + Math.sin(angle)*rad;
                                    if (!checkCollisionServer(room.map, testX, testY, 30)) { p.x = testX; p.y = testY; found = true; break; }
                                }
                                if(found) break;
                            }
                        }
                    }
                    p.buff = null; p.buffProgress = 0; 
                } 
            } else p.buffProgress = 0; 
        });

        if (now - room.lastPowerupSpawn > 30000) {
            room.lastPowerupSpawn = now; 
            // ПОВЕРНУТІ ЕФЕКТИ В ПУЛ
            const types = ['explosive', 'minigun', 'boss', 'shotgun', 'healing', 'samurai', 'piercing', 'invisible', 'homing'];
            if (Object.keys(room.powerups).length > 10) delete room.powerups[Object.keys(room.powerups)[0]];
            for(let i=0; i<2; i++) { const pid = 'pu_' + now + '_' + i; let pSpawn = getValidSpawn(room.map, 30); room.powerups[pid] = { id: pid, type: types[Math.floor(Math.random() * types.length)], active: true, x: pSpawn.x, y: pSpawn.y }; }
        }
        if (Object.keys(room.tokens).length > 40) delete room.tokens[Object.keys(room.tokens)[0]];

        if (room.mode === 'survival') {
            const alivePlayers = Object.values(room.players).filter(p => p.hp > 0);
            if (alivePlayers.length === 0) {
                room.status = 'finished';
                Object.values(room.players).forEach(p => { let name = p.name; if(dbUsers[name]) { let eLvl = dbUsers[name].upgrades.earnings || 0; let bonus = eLvl === 1 ? 1.05 : (eLvl === 2 ? 1.10 : 1.0); let reward = Math.round(room.wave * bonus); dbUsers[name].bucks += reward; saveUser(name); io.to(p.id).emit('economyUpdate', { bucks: dbUsers[name].bucks, upgrades: dbUsers[name].upgrades }); } });
                io.to(roomId).emit('gameOver', { winner: 'ZOMBIES', wave: room.wave }); io.emit('roomsList', getActiveRooms()); continue;
            }
            if (Object.keys(room.zombies).length === 0) {
                if (room.survivalState === 'playing') { room.survivalState = 'waiting'; room.nextWaveTime = now + 5000; } 
                else if (room.survivalState === 'waiting' && now > room.nextWaveTime) {
                    room.wave++; 
                    let isBossWave = (room.wave === 25 || room.wave === 50 || room.wave === 75 || room.wave === 100);
                    if (isBossWave) {
                        let bType = room.wave === 25 ? 'pikus' : room.wave === 50 ? 'shurik' : room.wave === 75 ? 'oneshot' : 'padlo';
                        let zid = `boss_${now}`; let zSpawn = getValidSpawn(room.map, 50);
                        room.zombies[zid] = { id: zid, x: zSpawn.x, y: zSpawn.y, type: bType, hp: Z_TYPES[bType].hp, nextAttack: 0 };
                    } else {
                        let spawnCount = Math.min(125, 10 + (room.wave - 1) * 5);
                        let isTenth = (room.wave % 10 === 0);
                        let typesList = ['normal', 'runner', 'spitter', 'tanker', 'bomber', 'ghost'];
                        let maxIdx = Math.min(typesList.length - 1, Math.floor(room.wave / 3));
                        
                        for(let i=0; i<spawnCount; i++) { 
                            let type = 'normal';
                            if (isTenth && i >= spawnCount/2) type = typesList[Math.floor(Math.random()*maxIdx) + 1];
                            else if (i === 0 && room.wave > 1) type = typesList[Math.min(typesList.length-1, Math.floor(room.wave/4))];
                            else type = typesList[Math.floor(Math.random() * (maxIdx + 1))];
                            if (type === 'boss') type = 'tanker';
                            
                            let zSpawn = getValidEdgeSpawn(room.map, 20); let zid = `z_${now}_${i}`; 
                            room.zombies[zid] = { id: zid, x: zSpawn.x, y: zSpawn.y, type: type, hp: Z_TYPES[type].hp, nextAttack: 0 }; 
                        }
                    }
                    room.survivalState = 'playing'; io.to(roomId).emit('newWave', { wave: room.wave });
                } else if (room.survivalState === 'spawning') { room.survivalState = 'waiting'; room.nextWaveTime = now + 1000; }
            } else if (room.survivalState === 'playing') {
                for (let zid in room.zombies) {
                    let z = room.zombies[zid]; let target = null; let minDist = Infinity;
                    alivePlayers.forEach(p => { let dist = Math.hypot(p.x - z.x, p.y - z.y); if (p.buff === 'invisible') dist *= 3; if (dist < minDist) { minDist = dist; target = p; } });
                    if (target) {
                        let dx = target.x - z.x; let dy = target.y - z.y; let len = Math.hypot(dx, dy); let speed = Z_TYPES[z.type].speed;
                        let nextX = z.x + (dx/len) * speed * (1/30); let nextY = z.y + (dy/len) * speed * (1/30);
                        if (!checkCollisionServer(room.map, nextX, z.y, Z_TYPES[z.type].radius)) z.x = nextX;
                        if (!checkCollisionServer(room.map, z.x, nextY, Z_TYPES[z.type].radius)) z.y = nextY;
                        
                        if (Z_TYPES[z.type].isBoss && now > z.nextAttack) {
                            z.nextAttack = now + Z_TYPES[z.type].cd; let bCount = Z_TYPES[z.type].bullets; let spread = Math.PI / 4; 
                            let startAngle = Math.atan2(dy, dx) - (spread / 2); let step = spread / Math.max(1, bCount - 1);
                            if (bCount === 25) { spread = Math.PI * 2; step = spread / 25; startAngle = 0; } 
                            for(let b=0; b<bCount; b++) { let a = startAngle + (b * step); io.to(roomId).emit('spawnBullet', { id: 'b_'+now+b+zid, x: z.x, y: z.y, vx: Math.cos(a)*500, vy: Math.sin(a)*500, type: 'boss_proj', owner: 'zombie', dmgOverride: Z_TYPES[z.type].dmg }); }
                        }
                        else if (Z_TYPES[z.type].ranged && !Z_TYPES[z.type].isBoss && minDist < 400 && now > z.nextAttack) { z.nextAttack = now + 2000; io.to(roomId).emit('spawnBullet', { id: 'ac_'+now+zid, x: z.x, y: z.y, vx: (dx/len)*400, vy: (dy/len)*400, type: 'acid', owner: 'zombie' }); } 
                        else if (!Z_TYPES[z.type].isBoss && minDist < 30 + Z_TYPES[z.type].radius + 5 && now > z.nextAttack) { z.nextAttack = now + 1000; io.to(roomId).emit('zombieMeleeHit', { targetId: target.id, dmg: Z_TYPES[z.type].dmg }); }
                    }
                }
            }
        }
        io.to(roomId).emit('sync', { players: room.players, zombies: room.zombies, powerups: room.powerups, tokens: room.tokens });
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000; http.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });