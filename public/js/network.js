socket.on('initMusic', (data) => { myMusicPlaylists = data; });

// АВТОРИЗАЦІЯ
socket.on('authSuccess', (data) => { 
    localStorage.setItem('tankToken', data.token); myName = data.name; myId = socket.id; 
    initAudio(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
    switchMusicState('loby');
    showScreen('main-menu-screen'); // Відразу в головне меню після входу
});

socket.on('authError', (msg) => { 
    alert(msg); 
    localStorage.removeItem('tankToken'); // Видаляємо зламаний/старий пароль
    showScreen('login-screen'); // Залишаємо на екрані входу
});

socket.on('economyUpdate', (data) => { 
    myBucks = data.bucks; myUpgrades = data.upgrades; 
    if(data.reward) { document.getElementById('winner-reward').innerText = data.reward; } 
    if (typeof updateGlobalBucks === 'function') updateGlobalBucks();
    if (typeof renderShop === 'function') renderShop(); 
});

// КІМНАТИ
socket.on('roomsList', (rooms) => {
    if (typeof renderRoomsList === 'function') renderRoomsList(rooms);
});

socket.on('roomCreated', (roomId) => {
    socket.emit('joinRoom', roomId);
});

socket.on('joinedRoom', (data) => {
    currentRoomId = data.roomId;
    currentRoomData = data.roomData;
    showScreen('lobby-screen');
});

socket.on('joinError', (msg) => { alert(msg); });

socket.on('updateLobby', (roomData) => {
    currentRoomData = roomData;
    if (typeof updateLobbyUI === 'function') updateLobbyUI();
});

// ГРА
socket.on('gameStarting', (roomData) => {
    currentRoomData = roomData;
    const pData = currentRoomData.players[myId];
    myLocalTank.x = pData.x; myLocalTank.y = pData.y; myLocalTank.hp = MAX_HP; camera.x = pData.x; camera.y = pData.y;
    homingTargetId = null; document.getElementById('damage-vignette').style.opacity = 0;
    
    if (currentRoomData.mode === 'survival') switchMusicState('survive');
    else switchMusicState('dezmatch');
    
    if (typeof doCountdown === 'function') doCountdown();
});

socket.on('sync', (data) => {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    let activeOpponents = {};
    for (let id in data.players) {
        if (id !== myId) {
            if (!opponents[id]) activeOpponents[id] = { ...data.players[id] };
            else { activeOpponents[id] = opponents[id]; activeOpponents[id].targetX = data.players[id].x; activeOpponents[id].targetY = data.players[id].y; activeOpponents[id].targetBody = data.players[id].bodyAngle; activeOpponents[id].targetTurret = data.players[id].turretAngle; }
            activeOpponents[id].hp = data.players[id].hp; activeOpponents[id].buff = data.players[id].buff;
        } else {
            myLocalTank.hp = data.players[id].hp; myLocalTank.buff = data.players[id].buff; myLocalTank.buffProgress = data.players[id].buffProgress; myLocalTank.score = data.players[id].score;
        }
    }
    opponents = activeOpponents; zombies = data.zombies || {}; powerups = data.powerups || {}; tokens = data.tokens || {};
    if (typeof updateHUD === 'function') updateHUD();
});

socket.on('spawnBullet', (data) => {
    playSound(data.type === 'minigun' ? 'minigun' : data.type === 'boss' ? 'boss_shoot' : 'shoot');
    if (data.type === 'shotgun') { for(let i=0; i<20; i++) { let angle = Math.atan2(data.vy, data.vx) + (Math.random()-0.5)*0.6; let spd = BASE_BULLET_SPEED * (0.8 + Math.random()*0.4); bullets.push({ ...data, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd, life: 0.8 }); } } 
    else bullets.push({ ...data, life: 2.5 });
});

socket.on('hitConfirmed', () => { playSound('hitmarker'); const hm = document.getElementById('hitmarker'); hm.classList.remove('hidden'); hm.classList.remove('hitmarker-active'); void hm.offsetWidth; hm.classList.add('hitmarker-active'); });
socket.on('powerupCollected', (data) => { playSound('powerup'); });
socket.on('playerDied', (data) => { if (typeof createExplosion === 'function' && currentRoomData && currentRoomData.players[data.id]) createExplosion(currentRoomData.players[data.id].x, currentRoomData.players[data.id].y, 60, '#ef4444'); playSound('explosion'); });
socket.on('playerRespawn', (data) => { if(data.id === myId) { myLocalTank.x = data.x; myLocalTank.y = data.y; myLocalTank.hp = MAX_HP; camera.x = data.x; camera.y = data.y; document.getElementById('damage-vignette').style.opacity = 0; } });
socket.on('tokenCollected', (data) => { playSound('token'); });
socket.on('bomberExplode', (data) => { if (typeof createExplosion === 'function') createExplosion(data.x, data.y, 40, '#dc2626'); if(Math.hypot(data.x - myLocalTank.x, data.y - myLocalTank.y) < 120) emitDamage(50, 'bomber'); });
socket.on('zombieMeleeHit', (data) => { if (data.targetId === myId && myLocalTank.hp > 0) emitDamage(data.dmg, 'zombie'); });
socket.on('newWave', (data) => { document.getElementById('wave-overlay').classList.remove('hidden'); document.getElementById('wave-text').innerText = `ХВИЛЯ ${data.wave}`; setTimeout(()=> document.getElementById('wave-overlay').classList.add('hidden'), 3000); });

socket.on('gameOver', (data) => {
    if(currentRoomData) currentRoomData.status = 'finished'; 
    document.getElementById('winner-modal').classList.remove('hidden'); document.getElementById('damage-vignette').style.opacity = 0;
    if (data.winner === 'ZOMBIES') { document.getElementById('winner-title').innerText = "ВИ НЕ ВИЖИЛИ"; document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-red-500 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]"; document.getElementById('winner-emoji').innerText = "💀"; document.getElementById('winner-message').innerText = `Ви протримались до ${data.wave} хвилі.`; } 
    else { document.getElementById('winner-title').innerText = "ПЕРЕМОГА!"; document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]"; document.getElementById('winner-emoji').innerText = "🏆"; document.getElementById('winner-message').innerText = `${data.name} здобуває перемогу!`; }
});

socket.on('caseResult', (result) => {
    myBucks = result.bucks; myUpgrades = result.upgrades; if (typeof updateGlobalBucks === 'function') updateGlobalBucks(); if (typeof renderShop === 'function') renderShop();
    document.getElementById('roulette-modal').classList.remove('hidden');
    const tape = document.getElementById('roulette-tape'); tape.style.transition = 'none'; tape.style.transform = 'translateX(0)'; tape.innerHTML = '';
    let items = []; let types = ['damage', 'speed', 'earnings'];
    for(let i=0; i<50; i++) { if (i === 44) { items.push({ type: result.type, level: result.level }); } else { let rT = types[Math.floor(Math.random()*types.length)]; let rL = Math.floor(Math.random() * (SHOP_DATA[rT].levels.length - 1)) + 1; items.push({ type: rT, level: rL }); } }
    items.forEach(item => { let d = SHOP_DATA[item.type]; tape.innerHTML += `<div class="roulette-item text-center"><div class="text-3xl">${d.icon}</div><div class="text-[10px] text-slate-300">Lvl ${item.level}</div></div>`; });
    setTimeout(() => { playSound('shoot'); tape.style.transition = 'transform 3.5s cubic-bezier(0.1, 1, 0.3, 1)'; tape.style.transform = `translateX(-${90 * 43.5}px)`; }, 100);
    setTimeout(() => { playSound('powerup'); setTimeout(() => { document.getElementById('roulette-modal').classList.add('hidden'); }, 2000); }, 3600);
});

function emitDamage(amt, attacker) { playSound('hurt'); shakeTime = 0.3; socket.emit('takeDamage', { roomId: currentRoomId, amt: amt, attacker: attacker }); }

// Перевірка старого токену
const savedToken = localStorage.getItem('tankToken');
if(savedToken) socket.emit('authToken', savedToken);
else showScreen('login-screen');