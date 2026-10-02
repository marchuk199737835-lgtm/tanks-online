function showScreen(screenId) {
    const screens = ['login-screen', 'main-menu-screen', 'room-browser-screen', 'shop-screen', 'lobby-screen', 'game-screen', 'hangar-screen'];
    screens.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
    const s = document.getElementById(screenId); if (s) { s.classList.remove('hidden'); if (screenId !== 'game-screen') s.classList.add('flex'); }
    if (typeof playSound === 'function') playSound('ui_click');
    if (screenId === 'hangar-screen') startHangarPreview(); else stopHangarPreview();
}
function updateGlobalBucks() { document.querySelectorAll('.global-bucks-display').forEach(el => el.innerText = myBucks); }

// Синхронізуємо повзунки зі збереженими налаштуваннями
const musicSlider = document.getElementById('vol-music'); 
if(musicSlider) { 
    if(typeof volMusic !== 'undefined') musicSlider.value = volMusic;
    musicSlider.addEventListener('input', e => { if (typeof setMusicVolume === 'function') setMusicVolume(parseFloat(e.target.value)); }); 
}
const sfxSlider = document.getElementById('vol-sfx'); 
if(sfxSlider) { 
    if(typeof volSfx !== 'undefined') sfxSlider.value = volSfx;
    sfxSlider.addEventListener('input', e => { if (typeof setSfxVolume === 'function') setSfxVolume(parseFloat(e.target.value)); }); 
}

document.getElementById('tab-login').onclick = () => { authMode='login'; if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('tab-login').className='flex-1 py-3 text-xs font-bold uppercase transition bg-blue-600 text-white tracking-wider'; document.getElementById('tab-register').className='flex-1 py-3 text-xs font-bold uppercase transition text-slate-400 hover:bg-slate-800 tracking-wider'; document.getElementById('auth-btn').innerText='АВТОРИЗАЦІЯ'; };
document.getElementById('tab-register').onclick = () => { authMode='register'; if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('tab-register').className='flex-1 py-3 text-xs font-bold uppercase transition bg-blue-600 text-white tracking-wider'; document.getElementById('tab-login').className='flex-1 py-3 text-xs font-bold uppercase transition text-slate-400 hover:bg-slate-800 tracking-wider'; document.getElementById('auth-btn').innerText='СТВОРИТИ АКАУНТ'; };
document.getElementById('auth-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); const name = document.getElementById('nickname-input').value.trim().toUpperCase(); const pwd = document.getElementById('password-input').value.trim(); if(!name || !pwd) return alert('Введіть логін та пароль!'); socket.emit(authMode, { name, password: pwd }); };
document.getElementById('menu-logout-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); localStorage.removeItem('tankToken'); location.reload(); };
document.querySelectorAll('.settings-btn').forEach(btn => btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('settings-modal').classList.remove('hidden'); });
document.getElementById('close-settings-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('settings-modal').classList.add('hidden'); };

document.getElementById('nav-sessions-btn').onclick = () => { socket.emit('requestRooms'); showScreen('room-browser-screen'); };
document.getElementById('nav-shop-btn').onclick = () => { showScreen('shop-screen'); };
document.getElementById('nav-hangar-btn').onclick = () => { renderHangar(); showScreen('hangar-screen'); };
document.getElementById('shop-back-btn').onclick = () => { showScreen('main-menu-screen'); };
document.getElementById('hangar-back-btn').onclick = () => { showScreen('main-menu-screen'); };
document.getElementById('back-to-menu-btn').onclick = () => { showScreen('main-menu-screen'); };

function renderRoomsList(rooms) {
    const list = document.getElementById('rooms-list'); list.innerHTML = '';
    if (rooms.length === 0) { list.innerHTML = '<div class="text-center text-slate-500 py-10 font-bold tracking-widest uppercase">Немає активних сесій</div>'; return; }
    rooms.forEach(r => {
        let isFull = r.playersCount >= r.maxPlayers; let inProgress = r.status === 'playing'; let btnHtml = '';
        if (inProgress) btnHtml = '<button disabled class="bg-slate-700 text-slate-500 px-4 py-2 rounded font-bold uppercase text-xs">В ГРІ</button>';
        else if (isFull) btnHtml = '<button disabled class="bg-red-900/50 text-red-500 px-4 py-2 rounded font-bold uppercase text-xs border border-red-500/30">ПОВНА</button>';
        else btnHtml = `<button onclick="joinRoomBtn('${r.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold uppercase text-xs transition shadow-[0_0_10px_rgba(37,99,235,0.4)]">ПІД'ЄДНАТИСЬ</button>`;
        const modeEmoji = r.mode === 'survival' ? '🧟' : '⚔️';
        list.innerHTML += `<div class="grid grid-cols-5 gap-4 items-center p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 transition"><div class="col-span-2 flex flex-col"><span class="font-bold text-white text-sm">${r.hostName}</span><span class="text-[10px] text-slate-500 font-mono">${r.id}</span></div><div class="text-sm font-bold text-slate-300 uppercase">${modeEmoji} ${r.mode === 'survival'?'ВИЖИВАННЯ':'ДЕТМАТЧ'}</div><div class="text-sm text-slate-300 uppercase">${r.map}</div><div class="flex justify-between items-center"><span class="font-russo ${isFull?'text-red-400':'text-blue-400'}">${r.playersCount}/${r.maxPlayers}</span>${btnHtml}</div></div>`;
    });
}
window.joinRoomBtn = function(roomId) { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('joinRoom', roomId); };

let createConfig = { mode: 'deathmatch', map: 'city', maxPlayers: 6, winScore: 50 };
document.getElementById('open-create-room-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('create-room-modal').classList.remove('hidden'); };
document.getElementById('cancel-create-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('create-room-modal').classList.add('hidden'); };
document.querySelectorAll('.create-mode-select').forEach(btn => { btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.querySelectorAll('.create-mode-select').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); createConfig.mode = btn.dataset.mode; document.getElementById('create-score-wrap').style.display = createConfig.mode === 'survival' ? 'none' : 'block'; }; });
document.querySelectorAll('.create-map-select').forEach(btn => { btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.querySelectorAll('.create-map-select').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); createConfig.map = btn.dataset.map; }; });
document.getElementById('create-max-players').oninput = (e) => { createConfig.maxPlayers = e.target.value; document.getElementById('max-players-val').innerText = e.target.value; };
document.getElementById('confirm-create-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); createConfig.winScore = document.getElementById('create-win-score').value; document.getElementById('create-room-modal').classList.add('hidden'); socket.emit('createRoom', createConfig); };

let dragSource = null;
window.dragStartInv = function(e, modId, index) { dragSource = { type: 'inv', index: index, id: modId }; e.dataTransfer.setData('text/plain', modId); };
window.dragStartEq = function(e, modId, slotType) { dragSource = { type: 'eq', slotType: slotType, id: modId }; e.dataTransfer.setData('text/plain', modId); };
window.allowDrop = function(e) { e.preventDefault(); };

window.dropInv = function(e, targetIndex) {
    e.preventDefault(); if (!dragSource) return;
    if (dragSource.type === 'inv') {
        if(dragSource.index !== targetIndex) {
            let item = myInventory.splice(dragSource.index, 1)[0];
            let target = targetIndex > myInventory.length ? myInventory.length : targetIndex;
            myInventory.splice(target, 0, item);
            renderHangar(); socket.emit('reorderInventory', myInventory);
        }
    } else if (dragSource.type === 'eq') { socket.emit('unequipModule', { type: dragSource.slotType }); }
    dragSource = null;
};

window.dropEq = function(e, slotType) {
    e.preventDefault(); if (!dragSource) return;
    if (dragSource.type === 'inv') {
        let mod = MODULES[dragSource.id];
        if (mod && mod.type === slotType) { if (typeof playSound === 'function') playSound('powerup'); socket.emit('equipModule', { id: dragSource.id, type: slotType }); } 
        else { if (typeof playSound === 'function') playSound('ui_click'); }
    }
    dragSource = null;
};

function renderHangar() {
    document.getElementById('hangar-player-name').innerText = myName;
    document.getElementById('stat-kills').innerText = myStats.kills || 0; document.getElementById('stat-matches').innerText = myStats.matches || 0; document.getElementById('stat-earned').innerText = myStats.earned || 0;
    let totalDmg = 1.0, totalRange = 1.0, totalCd = 1.0, totalHp = 1.0, totalSpeed = 1.0, totalRot = 1.0;
    const eqHtml = []; const types = [{k: 'cannon', n: 'Дуло'}, {k: 'turret', n: 'Башта'}, {k: 'hull', n: 'Корпус'}, {k: 'tracks', n: 'Гусениці'}];
    
    types.forEach(t => {
        let modId = myEquipped[t.k];
        if (modId && MODULES[modId]) {
            let m = MODULES[modId];
            if(m.stats.dmg) totalDmg *= m.stats.dmg; if(m.stats.range) totalRange *= m.stats.range; if(m.stats.cd) totalCd *= m.stats.cd;
            if(m.stats.hp) totalHp *= m.stats.hp; if(m.stats.speed) totalSpeed *= m.stats.speed; if(m.stats.rotSpeed) totalRot *= m.stats.rotSpeed;
            let iconSvg = SVG_ICONS[t.k](RARITY[m.rarity].color);
            eqHtml.push(`<div class="flex items-center gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition" draggable="true" ondragstart="dragStartEq(event, '${modId}', '${t.k}')" ondragover="allowDrop(event)" ondrop="dropEq(event, '${t.k}')" onclick="openCtxMenu(event, '${modId}', 'eq', '${t.k}')"><div class="w-10 h-10 p-2 flex items-center justify-center rounded-lg bg-slate-900 border" style="border-color:${RARITY[m.rarity].color}">${iconSvg}</div><div><p class="text-xs text-white font-bold">${m.name}</p><p class="text-[9px] uppercase font-bold" style="color:${RARITY[m.rarity].color}">${CAT_NAMES[t.k]} | ${RARITY[m.rarity].name}</p></div></div>`);
        } else {
            eqHtml.push(`<div class="flex items-center gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800 opacity-50" ondragover="allowDrop(event)" ondrop="dropEq(event, '${t.k}')"><div class="w-10 h-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700">❌</div><div><p class="text-xs text-slate-500 font-bold">Стандарт</p><p class="text-[9px] uppercase font-bold text-slate-600">${t.n}</p></div></div>`);
        }
    });
    document.getElementById('equipped-slots-container').innerHTML = eqHtml.join('');
    
    document.getElementById('stat-hp').innerText = Math.round(MAX_HP * totalHp); document.getElementById('stat-speed').innerText = Math.round(totalSpeed * 100) + '%';
    document.getElementById('stat-dmg').innerText = Math.round(totalDmg * 100) + '%'; document.getElementById('stat-rot').innerText = Math.round(totalRot * 100) + '%';
    document.getElementById('bar-hp').style.width = Math.min(100, (totalHp/2) * 100) + '%'; document.getElementById('bar-speed').style.width = Math.min(100, (totalSpeed/2) * 100) + '%';
    document.getElementById('bar-dmg').style.width = Math.min(100, (totalDmg/2) * 100) + '%'; document.getElementById('bar-rot').style.width = Math.min(100, (totalRot/2) * 100) + '%';

    document.getElementById('inv-count').innerText = myInventory.length; const invGrid = document.getElementById('inventory-grid'); invGrid.innerHTML = '';
    
    for(let i=0; i<30; i++) {
        if (i < myInventory.length) {
            let modId = myInventory[i]; let mod = MODULES[modId]; if(!mod) continue;
            let iconSvg = SVG_ICONS[mod.type](RARITY[mod.rarity].color);
            invGrid.innerHTML += `<div class="inv-slot item-${mod.rarity} p-2 cursor-grab active:cursor-grabbing" onclick="openCtxMenu(event, '${modId}', 'inv')" draggable="true" ondragstart="dragStartInv(event, '${modId}', ${i})" ondragover="allowDrop(event)" ondrop="dropInv(event, ${i})" title="${mod.name}">${iconSvg}</div>`;
        } else {
            invGrid.innerHTML += `<div class="inv-slot empty" ondragover="allowDrop(event)" ondrop="dropInv(event, ${i})"></div>`;
        }
    }
}

let contextMode = 'inv'; let selectedEqSlot = null; let selectedInvItem = null;
window.openCtxMenu = function(e, modId, mode = 'inv', slot = null) {
    e.preventDefault(); if (typeof playSound === 'function') playSound('ui_click');
    selectedInvItem = modId; contextMode = mode; selectedEqSlot = slot;
    
    let mod = MODULES[modId]; document.getElementById('ctx-name').innerText = mod.name; document.getElementById('ctx-name').style.color = RARITY[mod.rarity].color;
    document.getElementById('ctx-cat').innerText = `${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`; document.getElementById('ctx-cat').style.color = RARITY[mod.rarity].color;
    
    let desc = [];
    if(mod.stats.dmg) desc.push(`Урон: ${Math.round(mod.stats.dmg*100)}%`); if(mod.stats.hp) desc.push(`Броня: ${Math.round(mod.stats.hp*100)}%`);
    if(mod.stats.speed) desc.push(`Рух: ${Math.round(mod.stats.speed*100)}%`); if(mod.stats.cd) desc.push(`Перезарядка: ${Math.round(mod.stats.cd*100)}%`);
    if(mod.stats.range) desc.push(`Дальність: ${Math.round(mod.stats.range*100)}%`); if(mod.stats.rotSpeed) desc.push(`Башта: ${Math.round(mod.stats.rotSpeed*100)}%`);
    document.getElementById('ctx-desc').innerHTML = desc.join('<br>');
    
    if (mode === 'inv') {
        document.getElementById('ctx-equip').innerText = "Одягнути"; document.getElementById('ctx-sell').style.display = 'block'; document.getElementById('ctx-drop').style.display = 'block'; document.getElementById('ctx-sell').innerText = `Продати ($${RARITY[mod.rarity].price})`;
    } else {
        document.getElementById('ctx-equip').innerText = "Зняти"; document.getElementById('ctx-sell').style.display = 'none'; document.getElementById('ctx-drop').style.display = 'none';
    }
    
    const menu = document.getElementById('context-menu'); menu.classList.remove('hidden');
    let x = e.clientX; let y = e.clientY; if (x + 200 > window.innerWidth) x -= 200; if (y + 150 > window.innerHeight) y -= 150;
    menu.style.left = x + 'px'; menu.style.top = y + 'px';
};

document.addEventListener('click', (e) => { if (!e.target.closest('.inv-slot') && !e.target.closest('#equipped-slots-container') && !e.target.closest('#context-menu')) document.getElementById('context-menu').classList.add('hidden'); });

document.getElementById('ctx-equip').onclick = () => { 
    if (typeof playSound === 'function') playSound('powerup'); 
    if (contextMode === 'inv') { socket.emit('equipModule', { id: selectedInvItem, type: MODULES[selectedInvItem].type }); } 
    else { socket.emit('unequipModule', { type: selectedEqSlot }); }
    document.getElementById('context-menu').classList.add('hidden'); 
};
document.getElementById('ctx-sell').onclick = () => { if (typeof playSound === 'function') playSound('ui_buy'); socket.emit('sellModule', { id: selectedInvItem }); document.getElementById('context-menu').classList.add('hidden'); };
document.getElementById('ctx-drop').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('dropModule', { id: selectedInvItem }); document.getElementById('context-menu').classList.add('hidden'); };

window.buyShopCase = function(caseId, price) {
    if (myBucks >= price) { 
        if(myInventory.length >= 30) { alert('Звільніть місце в Інвентарі!'); return; }
        document.getElementById('case-confirm-modal').classList.remove('hidden'); 
        document.getElementById('confirm-case-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_buy'); document.getElementById('case-confirm-modal').classList.add('hidden'); socket.emit('buyCase', caseId); };
    } else { alert('Недостатньо баксів!'); }
};

document.getElementById('cancel-case-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('case-confirm-modal').classList.add('hidden'); };
document.getElementById('close-reward-btn').onclick = () => { 
    if (typeof playSound === 'function') playSound('ui_click'); 
    document.getElementById('reward-modal').classList.add('hidden'); 
    if (!document.getElementById('hangar-screen').classList.contains('hidden')) renderHangar(); 
};

let hangarAnimId = null; let hMouseX = 150, hMouseY = 150;
const hCanvas = document.getElementById('hangar-canvas'); const hCtx = hCanvas.getContext('2d');
hCanvas.addEventListener('mousemove', e => { const rect = hCanvas.getBoundingClientRect(); hMouseX = e.clientX - rect.left; hMouseY = e.clientY - rect.top; });

function startHangarPreview() {
    if (hangarAnimId) cancelAnimationFrame(hangarAnimId);
    function drawPreview() {
        hCtx.clearRect(0, 0, hCanvas.width, hCanvas.height); hCtx.save(); hCtx.translate(150, 150);
        let tAng = Math.atan2(hMouseY - 150, hMouseX - 150); let cHex = '#1e293b'; 
        let hCol = myEquipped.hull ? RARITY[MODULES[myEquipped.hull].rarity].color : '#0f172a';
        let trCol = myEquipped.tracks ? RARITY[MODULES[myEquipped.tracks].rarity].color : '#0f172a';
        let cCol = myEquipped.cannon ? RARITY[MODULES[myEquipped.cannon].rarity].color : '#0f172a';
        let tuCol = myEquipped.turret ? RARITY[MODULES[myEquipped.turret].rarity].color : '#334155';

        hCtx.fillStyle = trCol; hCtx.shadowColor = trCol; hCtx.shadowBlur = myEquipped.tracks ? 15 : 0;
        hCtx.fillRect(-36, -32, 72, 14); hCtx.fillRect(-36, 18, 72, 14); hCtx.shadowBlur = 0;
        
        hCtx.fillStyle = cHex; hCtx.strokeStyle = hCol; hCtx.lineWidth = myEquipped.hull ? 3 : 1;
        if(myEquipped.hull) { hCtx.shadowColor = hCol; hCtx.shadowBlur = 10; }
        hCtx.fillRect(-30, -22, 60, 44); hCtx.strokeRect(-30, -22, 60, 44); hCtx.shadowBlur = 0;

        hCtx.save(); hCtx.rotate(tAng); 
        hCtx.fillStyle = '#334155'; hCtx.strokeStyle = cCol; hCtx.lineWidth = myEquipped.cannon ? 3 : 1;
        if(myEquipped.cannon) { hCtx.shadowColor = cCol; hCtx.shadowBlur = 10; }
        let cLen = 45; if(myEquipped.cannon && MODULES[myEquipped.cannon].stats.range > 1.1) cLen = 60;
        if(myEquipped.cannon && MODULES[myEquipped.cannon].stats.range < 1.0) cLen = 35;
        hCtx.fillRect(0, -6, cLen, 12); hCtx.strokeRect(0, -6, cLen, 12); hCtx.shadowBlur = 0;

        hCtx.fillStyle = cHex; hCtx.strokeStyle = tuCol; hCtx.lineWidth = myEquipped.turret ? 3 : 1;
        if(myEquipped.turret) { hCtx.shadowColor = tuCol; hCtx.shadowBlur = 15; }
        hCtx.beginPath(); hCtx.arc(0, 0, 20, 0, Math.PI*2); hCtx.fill(); hCtx.stroke(); hCtx.shadowBlur = 0;
        hCtx.restore(); hCtx.restore();
        hangarAnimId = requestAnimationFrame(drawPreview);
    }
    drawPreview();
}
function stopHangarPreview() { if (hangarAnimId) cancelAnimationFrame(hangarAnimId); }

document.getElementById('leave-room-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); if(currentRoomId) socket.emit('leaveRoom', currentRoomId); currentRoomId = null; currentRoomData = null; showScreen('room-browser-screen'); };

function updateLobbyUI() {
    if(!currentRoomData || currentRoomData.status === 'playing') return;
    document.getElementById('lobby-room-name').innerText = currentRoomData.hostName + " СЕСІЯ";
    const MAP_NAMES = { 'city': '🏙️ МІСТО', 'hangars': '🏭 АНГАРИ', 'ship': '🚢 КОРАБЕЛЬ', 'castle': '🏰 ЗАМОК' };
    document.getElementById('view-map-name').innerText = (currentRoomData.mode === 'survival' ? '🧟 ' : '⚔️ ') + MAP_NAMES[currentRoomData.map];
    document.getElementById('view-win-score').innerText = currentRoomData.mode === 'survival' ? 'БЕЗКІНЕЧНО' : currentRoomData.winScore;

    const isHost = (myId === currentRoomData.hostSocket); const hostPanel = document.getElementById('host-settings-panel');
    if(hostPanel) { hostPanel.classList.toggle('hidden', !isHost); hostPanel.classList.toggle('flex', isHost); }
    if (isHost) {
        document.querySelectorAll('.host-mode-select').forEach(el => el.classList.toggle('selected', el.dataset.mode === currentRoomData.mode));
        document.querySelectorAll('.host-map-select').forEach(el => el.classList.toggle('selected', el.dataset.map === currentRoomData.map));
        const maxPInput = document.getElementById('host-max-players');
        if (maxPInput && document.activeElement !== maxPInput) { maxPInput.value = currentRoomData.maxPlayers; document.getElementById('host-max-players-val').innerText = currentRoomData.maxPlayers; }
        const winSInput = document.getElementById('host-win-score');
        if (winSInput && document.activeElement !== winSInput) winSInput.value = currentRoomData.winScore;
        const scoreWrap = document.getElementById('host-score-wrap');
        if(scoreWrap) scoreWrap.style.display = currentRoomData.mode === 'survival' ? 'none' : 'block';
    }

    const list = document.getElementById('players-list'); list.innerHTML = ''; const takenColors = new Set(); const pKeys = Object.keys(currentRoomData.players);
    document.getElementById('lobby-count').innerText = `${pKeys.length} / ${currentRoomData.maxPlayers}`;
    for(let id in currentRoomData.players) {
        const p = currentRoomData.players[id]; if (p.color) takenColors.add(p.color); if (id === myId) { myColor = p.color; isReady = p.ready; }
        const colorHex = p.color ? (p.color==='white'?'#f8fafc':p.color==='black'?'#1e293b':p.color==='red'?'#ef4444':p.color==='blue'?'#3b82f6':p.color==='brown'?'#78350f':'#9333ea') : '#475569';
        const isLeader = (id === currentRoomData.hostSocket) ? '👑' : '';
        list.innerHTML += `<div class="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 mb-2"><div class="flex items-center gap-3"><div class="w-6 h-6 rounded-lg border border-slate-500 shadow-inner" style="background-color: ${colorHex}"></div><span class="font-bold text-white tracking-widest uppercase">${p.name} ${isLeader}</span></div><span class="text-xs font-bold px-3 py-1.5 rounded border ${p.ready ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'}">${p.ready ? 'ГОТОВИЙ' : 'ЧЕКАЄ'}</span></div>`;
    }
    
    document.querySelectorAll('.color-btn').forEach(btn => { const c = btn.dataset.color; btn.classList.toggle('selected', c === myColor); btn.disabled = takenColors.has(c) && c !== myColor; });

    const btn = document.getElementById('btn-ready'); const allReady = pKeys.every(id => currentRoomData.players[id].ready);
    if (!myColor) { btn.innerText = "ОБЕРІТЬ КАМУФЛЯЖ"; btn.disabled = true; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-slate-800 text-slate-500 transition shadow-inner border border-slate-700"; } else {
        btn.disabled = false;
        if (myId === currentRoomData.hostSocket) {
            if (isReady) { if (pKeys.length >= 2 && allReady) { btn.innerText = "🚀 ЗАПУСК СЕСІЇ"; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition shadow-[0_0_30px_rgba(37,99,235,0.6)]"; } else { btn.innerText = "ГОТОВИЙ (ЧЕКАЄМО...)"; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-emerald-600 text-white transition shadow-[0_0_20px_rgba(16,185,129,0.4)]"; } } else { btn.innerText = "ПІДТВЕРДИТИ"; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-slate-700 hover:bg-slate-600 text-white transition border border-slate-500"; }
        } else {
            if (isReady) { btn.innerText = "ВІДМІНИТИ"; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-[0_0_20px_rgba(16,185,129,0.4)]"; } else { btn.innerText = "ПІДТВЕРДИТИ"; btn.className = "w-full py-6 rounded-2xl font-russo text-2xl uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition shadow-[0_0_20px_rgba(37,99,235,0.4)]"; }
        }
    }
}

document.querySelectorAll('.host-mode-select').forEach(btn => { btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, mode: btn.dataset.mode }); }; });
document.querySelectorAll('.host-map-select').forEach(btn => { btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, map: btn.dataset.map }); }; });
const hostMaxPlayers = document.getElementById('host-max-players');
if(hostMaxPlayers) hostMaxPlayers.onchange = (e) => { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, maxPlayers: parseInt(e.target.value) }); };
const hostWinScore = document.getElementById('host-win-score');
if(hostWinScore) hostWinScore.onchange = (e) => { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, winScore: parseInt(e.target.value) }); };

document.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = () => { if(!btn.disabled) { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('setColor', { roomId: currentRoomId, color: btn.dataset.color }); } } });
document.getElementById('btn-ready').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); const pKeys = Object.keys(currentRoomData.players); const allReady = pKeys.every(id => currentRoomData.players[id].ready); if (myId === currentRoomData.hostSocket && isReady && pKeys.length >= 2 && allReady) { socket.emit('startGame', currentRoomId); } else { socket.emit('toggleReady', currentRoomId); } };

function doCountdown() {
    showScreen('game-screen');
    const overlay = document.getElementById('countdown-overlay'), text = document.getElementById('countdown-text'); overlay.classList.remove('hidden');
    bullets = []; particles = []; let count = 3; text.innerText = count; text.className = "text-[15rem] font-russo text-white drop-shadow-[0_0_50px_rgba(37,99,235,0.8)] scale-150 transition-transform";
    const iv = setInterval(() => { count--; if (count > 0) { text.innerText = count; if (typeof playSound === 'function') playSound('ui_click'); } else if (count === 0) { text.innerText = "БІЙ!"; text.classList.add('text-emerald-400', 'drop-shadow-[0_0_50px_rgba(16,185,129,0.8)]'); if (typeof playSound === 'function') playSound('shoot'); startGameLoop(); } else { clearInterval(iv); overlay.classList.add('hidden'); } }, 1000);
}

document.getElementById('back-to-room-lobby-btn').onclick = () => { 
    if (typeof playSound === 'function') playSound('ui_click'); 
    document.getElementById('winner-modal').classList.add('hidden'); 
    socket.emit('backToRoomLobby', currentRoomId); 
    if(typeof switchMusicState === 'function') switchMusicState('loby'); 
    showScreen('lobby-screen');
};

const savedToken = localStorage.getItem('tankToken');
if(savedToken) socket.emit('authToken', savedToken);
else showScreen('login-screen');