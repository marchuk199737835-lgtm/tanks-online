const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

app.use(express.static(path.join(__dirname)));

const musicDir = path.join(__dirname, 'music');
if (!fs.existsSync(musicDir)) fs.mkdirSync(musicDir); 
app.use('/music', express.static(musicDir));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const MAX_HP = 500;
const BUFF_DURATION = 15000;
const MAX_PLAYERS = 6;

const usersFile = path.join(__dirname, 'users.json');
let dbUsers = {};
if (fs.existsSync(usersFile)) {
    try { dbUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8')); } catch(e) {}
}
function saveUsers() { fs.writeFileSync(usersFile, JSON.stringify(dbUsers, null, 2)); }
function hashPwd(pwd) { return crypto.createHash('sha256').update(pwd).digest('hex'); }

const SHOP_DATA = {
    damage: { levels: [0, 2, 4, 8, 12], prices: [50, 100, 200, 500] },
    speed: { levels: [0, 2, 5, 10], prices: [50, 100, 150] },
    earnings: { levels: [0, 5, 10], prices: [50, 100] }
};

const MAP_DATA = {
    'city': { size: 3600, solids: [] },
    'hangars': { size: 3000, solids: [] },
    'ship': { size: 2000, solids: [] },
    'castle': { size: 2500, solids: [] }
};
const neonColors = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981'];
for(let x=200; x<3400; x+=450) { for(let y=200; y<3400; y+=450) { let n = (x*13 + y*17) % 100; if(n < 75) MAP_DATA['city'].solids.push({ type: 'wall', x, y, w: 300, h: 300 }); } }
for(let x=150; x<2800; x+=350) { for(let y=150; y<2800; y+=300) { let n = (x*23 + y*29) % 100; if(n < 60) MAP_DATA['hangars'].solids.push({ type: 'wall', x, y, w: 250, h: 150 }); } }
for(let x=200; x<1800; x+=250) { for(let y=200; y<1800; y+=250) { let n = (x*31 + y*37) % 100; if(n < 30) MAP_DATA['ship'].solids.push({ type: 'wall', x, y, w: 180, h: 80 }); } }
for(let x=200; x<2300; x+=300) { for(let y=200; y<2300; y+=300) { let n = (x*41 + y*43) % 100; if(n < 50) { if(n < 15) MAP_DATA['castle'].solids.push({ type: 'tree', x: x+100, y: y+100, r: 60 }); else MAP_DATA['castle'].solids.push({ type: 'wall', x, y, w: 250, h: 80 }); } } }

function checkCollisionServer(mapName, x, y, r) {
    let cMap = MAP_DATA[mapName] ? mapName : 'city';
    let mSize = MAP_DATA[cMap].size;
    if (x - r < 0 || x + r > mSize || y - r < 0 || y + r > mSize) return true;
    let solids = MAP_DATA[cMap].solids;
    for(let s of solids) {
        if(s.type === 'wall') {
            let testX = Math.max(s.x, Math.min(x, s.x+s.w)), testY = Math.max(s.y, Math.min(y, s.y+s.h));
            if(Math.hypot(x-testX, y-testY) <= r) return true;
        } else if (s.type === 'tree') {
            if(Math.hypot(x-s.x, y-s.y) < r+s.r) return true;
        }
    }
    return false;
}

function getValidSpawn(mapName, r) {
    let cMap = MAP_DATA[mapName] ? mapName : 'city';
    let mSize = MAP_DATA[cMap].size;
    for(let i=0; i<100; i++) {
        let x = Math.random()*(mSize-200)+100;
        let y = Math.random()*(mSize-200)+100;
        if(!checkCollisionServer(cMap, x, y, r + 20)) return {x, y};
    }
    return {x: mSize/2, y: mSize/2}; 
}

const configPath = path.join(__dirname, 'admin_config.json');
let savedConfig = { map: 'city', mode: 'deathmatch', winScore: 50 };
if (fs.existsSync(configPath)) {
    try { 
        let parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')); 
        if (MAP_DATA[parsed.map]) savedConfig.map = parsed.map;
        if (parsed.mode) savedConfig.mode = parsed.mode;
        if (parsed.winScore) savedConfig.winScore = parsed.winScore;
    } catch(e) {}
}

function getMusicPlaylist() {
    if (!fs.existsSync(musicDir)) return [];
    let files = fs.readdirSync(musicDir).filter(f => f.endsWith('.mp3'));
    return files.sort(() => Math.random() - 0.5); 
}

let gameState = {
    status: 'lobby', 
    mode: savedConfig.mode, 
    map: savedConfig.map,
    winScore: savedConfig.winScore,
    wave: 1,
    survivalState: 'waiting',
    nextWaveTime: 0,
    leaderId: null,
    playlist: getMusicPlaylist()
};

let players = {};
let powerups = {};
let tokens = {};
let zombies = {};

const Z_TYPES = {
    'normal': { hp: 25, speed: 120, dmg: 10, radius: 15, color: '#22c55e' },
    'runner': { hp: 15, speed: 250, dmg: 5, radius: 12, color: '#84cc16' },
    'tanker': { hp: 100, speed: 60, dmg: 25, radius: 25, color: '#15803d' },
    'spitter': { hp: 40, speed: 90, dmg: 15, radius: 15, color: '#a3e635', ranged: true },
    'bomber': { hp: 30, speed: 140, dmg: 50, radius: 18, color: '#dc2626', explode: true },
    'ghost': { hp: 20, speed: 100, dmg: 10, radius: 15, color: '#cbd5e1', ghost: true }
};

let lastPowerupSpawn = Date.now();

function sendEconomy(socketId, name) {
    if (dbUsers[name]) {
        io.to(socketId).emit('economyUpdate', { bucks: dbUsers[name].bucks, upgrades: dbUsers[name].upgrades });
    }
}

io.on('connection', (socket) => {
    
    function setupPlayer(socket, name, token) {
        let alreadyOnline = Object.values(players).find(p => p.name === name);
        if(alreadyOnline) return socket.emit('authError', 'Гравець з таким ніком вже в грі!');
        if (Object.keys(players).length >= MAX_PLAYERS) return socket.emit('authError', 'Лоббі повне (максимум 6 гравців).');

        players[socket.id] = { id: socket.id, name: name, color: null, ready: false, hp: MAX_HP, score: 0, x: 0, y: 0, bodyAngle: 0, turretAngle: 0, buff: null, buffEndTime: 0, buffProgress: 0 };
        if (Object.keys(players).length === 1 && !gameState.leaderId) {
            gameState.leaderId = socket.id;
            gameState.playlist = getMusicPlaylist(); 
        }

        socket.emit('authSuccess', { name, token });
        sendEconomy(socket.id, name);
        io.emit('updateLobby', { players, gameState });
    }

    socket.on('register', (data) => {
        const { name, password } = data;
        if(!name || !password || name.length < 3 || password.length < 4) return socket.emit('authError', 'Логін від 3 символів, пароль від 4!');
        if(dbUsers[name]) return socket.emit('authError', 'Цей логін вже зайнятий!');

        const token = crypto.randomUUID();
        dbUsers[name] = { password: hashPwd(password), token: token, bucks: 0, upgrades: { damage: 0, speed: 0, earnings: 0 } };
        saveUsers(); setupPlayer(socket, name, token);
    });

    socket.on('login', (data) => {
        const { name, password } = data;
        const u = dbUsers[name];
        if(!u || u.password !== hashPwd(password)) return socket.emit('authError', 'Невірний логін або пароль!');
        const token = crypto.randomUUID(); u.token = token;
        if(u.bucks === undefined) { u.bucks = 0; u.upgrades = { damage: 0, speed: 0, earnings: 0 }; }
        saveUsers(); setupPlayer(socket, name, token);
    });

    socket.on('authToken', (token) => {
        let foundName = null;
        for(let n in dbUsers) { if(dbUsers[n].token === token) foundName = n; }
        if(foundName) setupPlayer(socket, foundName, token);
        else socket.emit('authError', 'Сесія закінчилась, увійдіть знову');
    });

    socket.on('buyUpgrade', (type) => {
        let p = players[socket.id]; if(!p || !dbUsers[p.name] || !SHOP_DATA[type]) return;
        let u = dbUsers[p.name];
        let currentLvl = u.upgrades[type] || 0;
        let maxLvl = SHOP_DATA[type].prices.length;
        if(currentLvl < maxLvl) {
            let price = SHOP_DATA[type].prices[currentLvl];
            if(u.bucks >= price) {
                u.bucks -= price;
                u.upgrades[type] = currentLvl + 1;
                saveUsers(); sendEconomy(socket.id, p.name);
            }
        }
    });

    socket.on('buyCase', () => {
        let p = players[socket.id]; if(!p || !dbUsers[p.name]) return;
        let u = dbUsers[p.name];
        if(u.bucks >= 50) {
            u.bucks -= 50;
            let types = ['damage', 'speed', 'earnings'];
            let rType = types[Math.floor(Math.random() * types.length)];
            let maxLvl = SHOP_DATA[rType].prices.length;
            let rLvl = Math.floor(Math.random() * maxLvl) + 1; 
            
            u.upgrades[rType] = rLvl; 
            saveUsers();
            socket.emit('caseResult', { type: rType, level: rLvl, bucks: u.bucks, upgrades: u.upgrades });
        }
    });

    socket.on('setColor', (color) => {
        if(players[socket.id]) { players[socket.id].color = color; players[socket.id].ready = false; io.emit('updateLobby', { players, gameState }); }
    });

    socket.on('toggleReady', () => {
        if(players[socket.id] && players[socket.id].color) {
            players[socket.id].ready = !players[socket.id].ready;
            io.emit('updateLobby', { players, gameState });
        }
    });

    socket.on('startGame', () => {
        if (socket.id === gameState.leaderId && gameState.status === 'lobby') {
            const pKeys = Object.keys(players);
            const allReady = pKeys.every(id => players[id].ready);
            
            if (pKeys.length >= 2 && allReady) {
                gameState.status = 'playing';
                if (gameState.mode === 'survival') { gameState.wave = 1; gameState.survivalState = 'spawning'; zombies = {}; }
                
                pKeys.forEach((id) => {
                    players[id].hp = MAX_HP; players[id].score = 0; players[id].buff = null;
                    let spawn = getValidSpawn(gameState.map, 30);
                    players[id].x = spawn.x; players[id].y = spawn.y;
                });
                
                io.emit('gameStarting', { players, gameState });
            }
        }
    });

    socket.on('adminUpdate', (data) => {
        if (data.code === '123321') {
            if (data.map) gameState.map = data.map;
            if (data.mode) gameState.mode = data.mode;
            if (data.winScore) gameState.winScore = data.winScore;
            io.emit('updateLobby', { players, gameState });
        }
    });

    socket.on('adminSave', () => {
        savedConfig = { map: gameState.map, mode: gameState.mode, winScore: gameState.winScore };
        fs.writeFileSync(configPath, JSON.stringify(savedConfig));
    });

    socket.on('move', (data) => {
        if(players[socket.id] && gameState.status === 'playing') {
            players[socket.id].x = data.x; players[socket.id].y = data.y;
            players[socket.id].bodyAngle = data.bodyAngle; players[socket.id].turretAngle = data.turretAngle;
        }
    });

    socket.on('shoot', (data) => {
        if(gameState.status === 'playing') io.emit('spawnBullet', { ...data, owner: socket.id });
    });

    socket.on('takeDamage', (data) => {
        if(players[socket.id] && players[socket.id].hp > 0 && gameState.status === 'playing') {
            let finalDmg = data.amt;
            if (data.attacker && players[data.attacker]) {
                let atkName = players[data.attacker].name;
                if (dbUsers[atkName]) {
                    let dLvl = dbUsers[atkName].upgrades.damage || 0;
                    let dMult = 1.0;
                    if(dLvl === 1) dMult = 1.02; else if(dLvl === 2) dMult = 1.04; else if(dLvl === 3) dMult = 1.08; else if(dLvl === 4) dMult = 1.12;
                    finalDmg = data.amt * dMult;
                }
                io.to(data.attacker).emit('hitConfirmed');
            }

            players[socket.id].hp = Math.max(0, players[socket.id].hp - finalDmg);

            if (players[socket.id].hp === 0) {
                players[socket.id].buff = null;
                io.emit('playerDied', { id: socket.id, killer: data.attacker });
                
                if (gameState.mode === 'deathmatch') {
                    const tid = 'tkn_' + Date.now() + Math.random();
                    tokens[tid] = { id: tid, x: players[socket.id].x, y: players[socket.id].y, color: players[socket.id].color, active: true };
                }
                
                setTimeout(() => {
                    if(players[socket.id] && gameState.status === 'playing' && gameState.mode !== 'survival') {
                        players[socket.id].hp = MAX_HP;
                        let spawn = getValidSpawn(gameState.map, 30);
                        players[socket.id].x = spawn.x;
                        players[socket.id].y = spawn.y;
                        io.emit('playerRespawn', players[socket.id]);
                    }
                }, 3000);
            }
        }
    });

    socket.on('collectToken', (tid) => {
        if (tokens[tid] && tokens[tid].active && players[socket.id] && players[socket.id].hp > 0) {
            tokens[tid].active = false;
            players[socket.id].score += 1;
            
            if (players[socket.id].score >= gameState.winScore && gameState.mode === 'deathmatch') {
                gameState.status = 'finished'; gameState.winner = socket.id;
                
                let name = players[socket.id].name;
                let reward = 0;
                if(dbUsers[name]) {
                    let eLvl = dbUsers[name].upgrades.earnings || 0;
                    let bonus = eLvl === 1 ? 1.05 : (eLvl === 2 ? 1.10 : 1.0);
                    reward = Math.round(20 * bonus);
                    dbUsers[name].bucks += reward;
                    saveUsers(); sendEconomy(socket.id, name);
                }
                
                io.emit('tokenCollected', { tid, playerId: socket.id, score: players[socket.id].score });
                io.emit('gameOver', { winner: socket.id, name: name, reward: reward });
            } else {
                io.emit('tokenCollected', { tid, playerId: socket.id, score: players[socket.id].score });
            }
            delete tokens[tid]; 
        }
    });

    socket.on('collectPowerup', (pid) => {
        if (powerups[pid] && powerups[pid].active && players[socket.id] && players[socket.id].hp > 0) {
            players[socket.id].buff = powerups[pid].type;
            players[socket.id].buffEndTime = Date.now() + BUFF_DURATION;
            powerups[pid].active = false;
            io.emit('powerupCollected', { pid, playerId: socket.id, type: powerups[pid].type });
            delete powerups[pid];
        }
    });

    socket.on('zombieHit', (data) => {
        if (zombies[data.zid] && zombies[data.zid].hp > 0) {
            let finalDmg = data.dmg;
            let atkName = players[socket.id]?.name;
            if (atkName && dbUsers[atkName]) {
                let dLvl = dbUsers[atkName].upgrades.damage || 0;
                let dMult = 1.0;
                if(dLvl === 1) dMult = 1.02; else if(dLvl === 2) dMult = 1.04; else if(dLvl === 3) dMult = 1.08; else if(dLvl === 4) dMult = 1.12;
                finalDmg = data.dmg * dMult;
            }

            zombies[data.zid].hp -= finalDmg;
            if (zombies[data.zid].hp <= 0) {
                if(zombies[data.zid].type === 'bomber') io.emit('bomberExplode', { x: zombies[data.zid].x, y: zombies[data.zid].y });
                delete zombies[data.zid];
            }
        }
    });

    socket.on('backToLobby', () => {
        if (gameState.status === 'finished') {
            gameState.status = 'lobby'; gameState.winner = null;
            powerups = {}; tokens = {}; zombies = {}; gameState.wave = 1;
            Object.values(players).forEach(p => { p.ready = false; p.score = 0; p.hp = MAX_HP; p.buff = null; });
            io.emit('updateLobby', { players, gameState });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
        if (gameState.leaderId === socket.id) {
            const remainingKeys = Object.keys(players);
            gameState.leaderId = remainingKeys.length > 0 ? remainingKeys[0] : null;
        }
        if (Object.keys(players).length < 2 && gameState.status === 'playing') {
            gameState.status = 'lobby'; io.emit('updateLobby', { players, gameState });
        } else { io.emit('updateLobby', { players, gameState }); }
    });
});

setInterval(() => {
    if (gameState.status !== 'playing') return;
    const now = Date.now();

    Object.values(players).forEach(p => {
        if (p.buff) {
            p.buffProgress = Math.max(0, (p.buffEndTime - now) / BUFF_DURATION);
            if (now > p.buffEndTime) { p.buff = null; p.buffProgress = 0; }
        } else p.buffProgress = 0;
    });

    if (now - lastPowerupSpawn > 30000) {
        lastPowerupSpawn = now;
        const types = ['fast', 'explosive', 'piercing', 'incendiary', 'minigun', 'boss', 'invisible', 'shotgun', 'homing'];
        if (Object.keys(powerups).length > 10) delete powerups[Object.keys(powerups)[0]];
        for(let i=0; i<2; i++) {
            const pid = 'pu_' + now + '_' + i;
            let pSpawn = getValidSpawn(gameState.map, 30);
            powerups[pid] = { id: pid, type: types[Math.floor(Math.random() * types.length)], active: true, x: pSpawn.x, y: pSpawn.y };
        }
    }
    
    if (Object.keys(tokens).length > 40) delete tokens[Object.keys(tokens)[0]];

    if (gameState.mode === 'survival') {
        const alivePlayers = Object.values(players).filter(p => p.hp > 0);
        if (alivePlayers.length === 0) {
            gameState.status = 'finished'; gameState.winner = 'ZOMBIES';
            
            Object.values(players).forEach(p => {
                let name = p.name;
                if(dbUsers[name]) {
                    let eLvl = dbUsers[name].upgrades.earnings || 0;
                    let bonus = eLvl === 1 ? 1.05 : (eLvl === 2 ? 1.10 : 1.0);
                    let reward = Math.round(gameState.wave * bonus);
                    dbUsers[name].bucks += reward;
                    io.to(p.id).emit('economyUpdate', { bucks: dbUsers[name].bucks, upgrades: dbUsers[name].upgrades, reward: reward });
                }
            });
            saveUsers();
            io.emit('gameOver', { winner: 'ZOMBIES', wave: gameState.wave });
            return;
        }

        if (Object.keys(zombies).length === 0) {
            if (gameState.survivalState === 'playing') {
                gameState.survivalState = 'waiting'; gameState.nextWaveTime = now + 5000;
            } else if (gameState.survivalState === 'waiting' && now > gameState.nextWaveTime) {
                gameState.wave++;
                let spawnCount = 10 + (gameState.wave - 1) * 20;
                const typesList = Object.keys(Z_TYPES);
                for(let i=0; i<spawnCount; i++) {
                    let type = typesList[Math.floor(Math.random()*typesList.length)];
                    if (gameState.wave < 3 && (type === 'tanker' || type === 'boss')) type = 'normal';
                    let zid = `z_${now}_${i}`;
                    
                    let cMap = MAP_DATA[gameState.map] ? gameState.map : 'city';
                    let zSpawn = getValidSpawn(cMap, 20);
                    let mSize = MAP_DATA[cMap].size;
                    zSpawn.x = Math.random() < 0.5 ? 50 : mSize-50;
                    
                    zombies[zid] = { id: zid, x: zSpawn.x, y: Math.random() * mSize, type: type, hp: Z_TYPES[type].hp, nextAttack: 0 };
                }
                gameState.survivalState = 'playing';
                io.emit('newWave', { wave: gameState.wave, zombies });
            } else if (gameState.survivalState === 'spawning') {
                gameState.survivalState = 'waiting'; gameState.nextWaveTime = now + 1000;
            }
        } else if (gameState.survivalState === 'playing') {
            for (let zid in zombies) {
                let z = zombies[zid];
                let target = null; let minDist = Infinity;
                alivePlayers.forEach(p => {
                    let dist = Math.hypot(p.x - z.x, p.y - z.y);
                    if (p.buff === 'invisible') dist *= 3;
                    if (dist < minDist) { minDist = dist; target = p; }
                });

                if (target) {
                    let dx = target.x - z.x; let dy = target.y - z.y; let len = Math.hypot(dx, dy);
                    let speed = Z_TYPES[z.type].speed;
                    z.x += (dx/len) * speed * (1/30);
                    z.y += (dy/len) * speed * (1/30);
                    
                    let tr = (target.buff === 'boss' ? 75 : 30);
                    if (Z_TYPES[z.type].ranged && minDist < 400 && now > z.nextAttack) {
                        z.nextAttack = now + 2000;
                        io.emit('spawnBullet', { id: 'ac_'+now+zid, x: z.x, y: z.y, vx: (dx/len)*400, vy: (dy/len)*400, type: 'acid', owner: 'zombie' });
                    } else if (minDist < tr + Z_TYPES[z.type].radius + 5 && now > z.nextAttack) {
                        z.nextAttack = now + 1000;
                        io.emit('zombieMeleeHit', { targetId: target.id, dmg: Z_TYPES[z.type].dmg });
                    }
                }
            }
        }
    }

    io.emit('sync', { players, zombies, powerups, tokens });

}, 1000 / 30);

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });