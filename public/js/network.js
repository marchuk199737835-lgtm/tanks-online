let myAdventClaims = [];

socket.on('initMusic', (data) => { myMusicPlaylists = data; });

socket.on('authSuccess', (data) => { 
    localStorage.setItem('tankToken', data.token); myName = data.name; myId = socket.id; 
    initAudio(); if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); 
    switchMusicState('loby'); showScreen('main-menu-screen');
});
socket.on('authError', (msg) => { alert(msg); localStorage.removeItem('tankToken'); showScreen('login-screen'); });

socket.on('economyUpdate', (data) => { 
    myBucks = data.bucks; myInventory = data.inventory || []; myEquipped = data.equipped || { cannon: null, turret: null, hull: null, tracks: null }; myStats = data.stats || { kills: 0, matches: 0, earned: 0 };
    myAdventClaims = data.adventClaims || [];
    if (typeof updateGlobalBucks === 'function') updateGlobalBucks(); 
    if (typeof renderHangar === 'function' && !document.getElementById('hangar-screen').classList.contains('hidden')) renderHangar(); 
    if (typeof renderAdvent === 'function' && !document.getElementById('advent-modal').classList.contains('hidden')) renderAdvent();
});

// ПРОМОКОДИ ТА АДВЕНТ
socket.on('promoSuccess', (msg) => { if (typeof playSound === 'function') playSound('ui_buy'); alert(msg); document.getElementById('promo-modal').classList.add('hidden'); document.getElementById('promo-input').value = ''; });
socket.on('promoError', (msg) => { alert(msg); });
socket.on('adventSuccess', (data) => {
    playSound('powerup');
    if (data.type === 'bucks') alert(`Вітаємо! Нараховано +${data.amount} 💵 за день ${data.day}.10.`);
    else alert(`ВІТАЄМО! Твоя фінальна Легендарна нагорода вже в Інвентарі!`);
});

let pendingDrop = null;
socket.on('dropReceived', (modId) => { pendingDrop = modId; });

socket.on('roomsList', (rooms) => { if (typeof renderRoomsList === 'function') renderRoomsList(rooms); });
socket.on('roomCreated', (roomId) => { socket.emit('joinRoom', roomId); });
socket.on('joinedRoom', (data) => { currentRoomId = data.roomId; currentRoomData = data.roomData; showScreen('lobby-screen'); });
socket.on('joinError', (msg) => { alert(msg); });

socket.on('updateLobby', (roomData) => {
    currentRoomData = roomData; if (typeof updateLobbyUI === 'function') updateLobbyUI();
    const gameScreen = document.getElementById('game-screen');
    if (roomData.status === 'lobby' && gameScreen && !gameScreen.classList.contains('hidden')) {
        document.getElementById('winner-modal').classList.add('hidden');
        if (typeof showScreen === 'function') showScreen('lobby-screen');
        if (typeof switchMusicState === 'function') switchMusicState('loby');
    }
});

socket.on('gameStarting', (roomData) => {
    currentRoomData = roomData; const pData = currentRoomData.players[myId];
    myLocalTank.x = pData.x; myLocalTank.y = pData.y; myLocalTank.hp = pData.hp; camera.x = pData.x; camera.y = pData.y;
    homingTargetId = null; document.getElementById('damage-vignette').style.opacity = 0; spectatingId = null; // Скидаємо спостерігача
    pendingDrop = null; document.getElementById('drop-notification').classList.add('hidden'); 
    if (currentRoomData.mode === 'survival') switchMusicState('survive'); else switchMusicState('dezmatch');
    if (typeof doCountdown === 'function') doCountdown();
});

socket.on('sync', (data) => {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    currentRoomData.players = data.players; let activeOpponents = {};
    for (let id in data.players) {
        if (id !== myId) {
            if (!opponents[id]) activeOpponents[id] = { ...data.players[id] };
            else { activeOpponents[id] = opponents[id]; activeOpponents[id].targetX = data.players[id].x; activeOpponents[id].targetY = data.players[id].y; activeOpponents[id].targetBody = data.players[id].bodyAngle; activeOpponents[id].targetTurret = data.players[id].turretAngle; }
            activeOpponents[id].hp = data.players[id].hp; activeOpponents[id].buff = data.players[id].buff; activeOpponents[id].equipped = data.players[id].equipped; activeOpponents[id].color = data.players[id].color;
        } else {
            myLocalTank.hp = data.players[id].hp; myLocalTank.buff = data.players[id].buff; myLocalTank.buffProgress = data.players[id].buffProgress; myLocalTank.score = data.players[id].score;
            myEquipped = data.players[id].equipped || myEquipped; myColor = data.players[id].color;
        }
    }
    opponents = activeOpponents; zombies = data.zombies || {}; powerups = data.powerups || {}; tokens = data.tokens || {};
    if (typeof updateHUD === 'function') updateHUD();
});

socket.on('spawnBullet', (data) => {
    playSound(data.type === 'minigun' ? 'minigun' : data.type.includes('boss') ? 'boss_shoot' : data.type === 'samurai' ? 'samurai' : 'shoot');
    let lM = data.lifeMult || 1.0;
    if (data.type === 'shotgun') { for(let i=0; i<20; i++) { let angle = Math.atan2(data.vy, data.vx) + (Math.random()-0.5)*0.6; let spd = BASE_BULLET_SPEED * (0.8 + Math.random()*0.4); bullets.push({ ...data, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd, life: 1.2 * lM }); } } 
    else if (data.type === 'samurai') { bullets.push({ ...data, life: 0.15 }); }
    else bullets.push({ ...data, life: 2.5 * lM });
});

socket.on('hitConfirmed', () => { playSound('hitmarker'); const hm = document.getElementById('hitmarker'); hm.classList.remove('hidden'); hm.classList.remove('hitmarker-active'); void hm.offsetWidth; hm.classList.add('hitmarker-active'); });
socket.on('powerupCollected', (data) => { playSound('powerup'); });

socket.on('playerDied', (data) => { 
    if (typeof createExplosion === 'function' && currentRoomData && currentRoomData.players[data.id]) createExplosion(currentRoomData.players[data.id].x, currentRoomData.players[data.id].y, 60, '#ef4444'); playSound('explosion'); 
    
    // SPECTATOR АВТО-ПЕРЕХІД
    if (data.id === myId) {
        if (data.killer && data.killer !== 'zombie' && opponents[data.killer]) { spectatingId = data.killer; } 
        else { if (typeof findNextSpectateTarget === 'function') findNextSpectateTarget(1); }
    }
});

socket.on('playerRespawn', (data) => { if(data.id === myId) { myLocalTank.x = data.x; myLocalTank.y = data.y; myLocalTank.hp = data.hp; camera.x = data.x; camera.y = data.y; document.getElementById('damage-vignette').style.opacity = 0; spectatingId = null; } });
socket.on('tokenCollected', (data) => { playSound('token'); });
socket.on('bomberExplode', (data) => { if (typeof createExplosion === 'function') createExplosion(data.x, data.y, 40, '#dc2626'); if(Math.hypot(data.x - myLocalTank.x, data.y - myLocalTank.y) < 120) emitDamage(50, 'bomber'); });
socket.on('zombieMeleeHit', (data) => { if (data.targetId === myId && myLocalTank.hp > 0) emitDamage(data.dmg, 'zombie'); });
socket.on('newWave', (data) => { document.getElementById('wave-overlay').classList.remove('hidden'); document.getElementById('wave-text').innerText = `ХВИЛЯ ${data.wave}`; setTimeout(()=> document.getElementById('wave-overlay').classList.add('hidden'), 3000); });

socket.on('gameOver', (data) => {
    if(currentRoomData) currentRoomData.status = 'finished'; 
    document.getElementById('winner-modal').classList.remove('hidden'); document.getElementById('damage-vignette').style.opacity = 0;
    
    const dropNotif = document.getElementById('drop-notification');
    if (pendingDrop && MODULES[pendingDrop]) {
        let mod = MODULES[pendingDrop]; document.getElementById('drop-name').innerText = mod.name; 
        document.getElementById('drop-cat').innerText = `${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`; document.getElementById('drop-cat').style.color = RARITY[mod.rarity].color;
        document.getElementById('drop-icon').innerHTML = SVG_ICONS[mod.type](RARITY[mod.rarity].color); dropNotif.classList.remove('hidden');
    } else { dropNotif.classList.add('hidden'); }
    
    if (data.winner === 'ZOMBIES') { 
        document.getElementById('winner-title').innerText = "ВИ НЕ ВИЖИЛИ"; document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-red-500 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] relative z-10"; 
        document.getElementById('winner-emoji').innerText = "💀"; document.getElementById('winner-message').innerText = `Ви протримались до ${data.wave} хвилі.`; document.getElementById('winner-reward').innerText = data.wave;
    } else { 
        let myReward = data.rewards ? (data.rewards[myId] || 0) : 0; document.getElementById('winner-reward').innerText = myReward;
        if (data.winner === myId) {
            document.getElementById('winner-title').innerText = "ПЕРЕМОГА!"; document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] relative z-10"; 
            document.getElementById('winner-emoji').innerText = "🏆"; document.getElementById('winner-message').innerText = "Ви розбили ворогів!"; 
        } else {
            document.getElementById('winner-title').innerText = "ЕХХ..."; document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-slate-400 tracking-widest relative z-10"; 
            document.getElementById('winner-emoji').innerText = "💔"; document.getElementById('winner-message').innerText = `${data.name} здобуває перемогу.`; 
        }
    }
});

socket.on('caseResult', (result) => {
    myBucks = result.bucks;
    if(result.inventory) myInventory = result.inventory;
    if(result.equipped) myEquipped = result.equipped;
    if (typeof updateGlobalBucks === 'function') updateGlobalBucks();
    
    document.getElementById('roulette-modal').classList.remove('hidden'); const tape = document.getElementById('roulette-tape'); tape.style.transition = 'none'; tape.style.transform = 'translateX(0)'; tape.innerHTML = '';
    let items = []; const allModsKeys = Object.keys(MODULES);
    for(let i=0; i<65; i++) { if (i === 44) { items.push(result.modId); } else { items.push(allModsKeys[Math.floor(Math.random() * allModsKeys.length)]); } }
    
    items.forEach(modId => { 
        let mod = MODULES[modId]; let rColor = RARITY[mod.rarity].color; let iconSvg = SVG_ICONS[mod.type](rColor);
        tape.innerHTML += `<div class="roulette-item text-center min-w-[90px] w-[90px] border-r border-slate-700 bg-slate-800" style="border-bottom: 3px solid ${rColor}"><div class="w-10 h-10 mx-auto">${iconSvg}</div><div class="text-[8px] text-slate-300 mt-2 uppercase truncate w-full px-1">${mod.name}</div></div>`; 
    });
    
    setTimeout(() => { playSound('shoot'); tape.style.transition = 'transform 3.5s cubic-bezier(0.1, 1, 0.3, 1)'; let containerWidth = tape.parentElement.offsetWidth || 600; let targetX = (44 * 90 + 45) - (containerWidth / 2); tape.style.transform = `translateX(-${targetX}px)`; }, 100);
    setTimeout(() => { 
        playSound('powerup'); document.getElementById('roulette-modal').classList.add('hidden'); const rw = document.getElementById('reward-modal'); 
        if(rw) { 
            let mod = MODULES[result.modId]; 
            document.getElementById('reward-title').innerText = "ТРИМАЙ!"; document.getElementById('reward-title').className = "text-4xl font-russo mb-6 tracking-widest text-emerald-400"; 
            document.getElementById('reward-modal-panel').style.borderColor = RARITY[mod.rarity].color; document.getElementById('reward-item-name').innerText = mod.name; 
            document.getElementById('reward-item-icon').innerHTML = SVG_ICONS[mod.type](RARITY[mod.rarity].color); 
            document.getElementById('reward-item-cat').innerText = `${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`; document.getElementById('reward-item-cat').style.color = RARITY[mod.rarity].color; 
            rw.classList.remove('hidden'); 
        } 
    }, 3600);
});

function emitDamage(amt, attacker) { playSound('hurt'); shakeTime = 0.3; socket.emit('takeDamage', { roomId: currentRoomId, amt: amt, attacker: attacker }); }