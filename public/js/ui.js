function showScreen(screenId) {
    const screens = ['login-screen', 'main-menu-screen', 'room-browser-screen', 'shop-screen', 'lobby-screen', 'game-screen', 'hangar-screen'];
    screens.forEach(id => { const el = document.getElementById(id); if (el) { el.classList.add('hidden'); el.classList.remove('flex'); } });
    const s = document.getElementById(screenId); if (s) { s.classList.remove('hidden'); if (screenId !== 'game-screen') s.classList.add('flex'); }
    if (typeof playSound === 'function') playSound('ui_click');
    if (screenId === 'hangar-screen') startHangarPreview(); else stopHangarPreview();
}
function updateGlobalBucks() { document.querySelectorAll('.global-bucks-display').forEach(el => el.innerText = myBucks); }

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

const submitPromoBtn = document.getElementById('submit-promo-btn');
if(submitPromoBtn) { submitPromoBtn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); const code = document.getElementById('promo-input').value; if(!code) return alert('Введіть промокод!'); socket.emit('usePromo', code); }; }

window.openAdvent = function() {
    if(typeof playSound==='function') playSound('ui_click');
    document.getElementById('advent-modal').classList.remove('hidden');
    renderAdvent();
};

window.renderAdvent = function() {
    let grid = document.getElementById('advent-grid');
    grid.innerHTML = '';
    let today = new Date();
    let currentDay = (today.getMonth() === 9) ? today.getDate() : 0; 
    let claims = myAdventClaims || [];
    document.getElementById('advent-counter').innerText = claims.length;

    for(let d = 3; d <= 31; d++) {
        let state = ''; let content = ''; let bg = 'bg-slate-800 border-slate-700'; let cursor = 'cursor-not-allowed opacity-50'; let onclick = '';
        if (claims.includes(d)) { state = 'ЗАБРАНО'; bg = 'bg-emerald-900/50 border-emerald-500 text-emerald-400'; content = '✔️'; }
        else if (d < currentDay) { state = 'ПРОПУЩЕНО'; bg = 'bg-red-900/30 border-red-800 text-red-500'; content = '❌'; }
        else if (d === currentDay) { state = 'ЗАБРАТИ'; bg = 'bg-orange-600 border-orange-400 text-white animate-pulse shadow-[0_0_15px_#ea580c]'; cursor = 'cursor-pointer hover:bg-orange-500'; content = d === 31 ? '🎁' : `💵 ${20 + (d-3)*5}`; onclick = `onclick="claimAdventDay()"`; }
        else { state = 'ЗАКРИТО'; bg = 'bg-slate-900 border-slate-700 text-slate-500'; content = '🔒'; }
        if(d === 31 && state !== 'ЗАБРАНО' && state !== 'ЗАБРАТИ') { content = '🎃'; }
        grid.innerHTML += `<div class="flex flex-col items-center justify-center p-2 rounded-xl border ${bg} ${cursor} transition h-20 relative overflow-hidden group" ${onclick}><span class="text-[10px] font-bold mb-1 opacity-70">${d}.10</span><span class="text-xl font-russo z-10 group-hover:scale-110 transition">${content}</span></div>`;
    }
}
window.claimAdventDay = function() { socket.emit('claimAdvent'); }

setInterval(() => {
    let now = new Date(); let hw = new Date(now.getFullYear(), 9, 31, 23, 59, 59); let diff = hw - now; let timerEl = document.getElementById('hw-timer');
    if(diff > 0 && timerEl) { let d = Math.floor(diff / (1000*60*60*24)); let h = Math.floor((diff / (1000*60*60)) % 24); let m = Math.floor((diff / 1000/60) % 60); let s = Math.floor((diff / 1000) % 60); timerEl.innerText = `${d}Д ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`; }
    else if (timerEl) { timerEl.innerText = "ХЕЛОУІН НАСТАВ!"; }
}, 1000);

window.openCaseInfo = function(caseId) {
    if (typeof playSound === 'function') playSound('ui_click');
    const modal = document.getElementById('case-info-modal'); const grid = document.getElementById('case-info-grid'); const title = document.getElementById('case-info-title');
    grid.innerHTML = ''; let allowedRarities = [];
    if (caseId === 1) { title.innerText = "БАЗОВИЙ ЯЩИК"; title.className = "text-2xl md:text-3xl font-russo text-white tracking-widest"; allowedRarities = ['common', 'rare', 'epic', 'legendary']; }
    else if (caseId === 2) { title.innerText = "ШТУРМОВИЙ КЕЙС"; title.className = "text-2xl md:text-3xl font-russo text-purple-400 tracking-widest"; allowedRarities = ['common', 'rare', 'epic', 'legendary']; }
    else if (caseId === 3) { title.innerText = "ЕЛІТНИЙ КОНТЕЙНЕР"; title.className = "text-2xl md:text-3xl font-russo text-yellow-500 tracking-widest"; allowedRarities = ['rare', 'epic', 'legendary']; }

    const sortedRarities = ['legendary', 'epic', 'rare', 'common'];
    sortedRarities.forEach(rar => {
        if (!allowedRarities.includes(rar)) return;
        grid.innerHTML += `<div class="col-span-full mt-4 mb-2"><span class="text-[10px] md:text-sm font-bold uppercase tracking-widest px-3 py-1 rounded" style="background-color: ${RARITY[rar].color}40; color: ${RARITY[rar].color}">${RARITY[rar].name}</span></div>`;
        let sectionGrid = `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-4 md:mb-6">`;
        Object.keys(MODULES).forEach(modId => {
            let mod = MODULES[modId];
            if (mod.rarity === rar) {
                let iconSvg = SVG_ICONS[mod.type](RARITY[mod.rarity].color);
                sectionGrid += `<div class="flex items-center gap-2 md:gap-3 bg-slate-800/50 p-2 md:p-3 rounded-xl border border-slate-700"><div class="w-8 h-8 md:w-10 md:h-10 p-1.5 md:p-2 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-900 border" style="border-color:${RARITY[mod.rarity].color}">${iconSvg}</div><div class="overflow-hidden"><p class="text-[10px] md:text-xs text-white font-bold truncate">${mod.name}</p><p class="text-[8px] md:text-[9px] uppercase font-bold truncate" style="color:${RARITY[mod.rarity].color}">${CAT_NAMES[mod.type]}</p></div></div>`;
            }
        });
        sectionGrid += `</div>`; grid.innerHTML += sectionGrid;
    });
    modal.classList.remove('hidden');
}

function renderRoomsList(rooms) {
    const list = document.getElementById('rooms-list'); list.innerHTML = '';
    if (rooms.length === 0) { list.innerHTML = '<div class="text-center text-slate-500 py-10 font-bold tracking-widest uppercase text-xs md:text-sm">Немає активних сесій</div>'; return; }
    rooms.forEach(r => {
        let isFull = r.playersCount >= r.maxPlayers; let inProgress = r.status === 'playing'; let btnHtml = '';
        if (inProgress) btnHtml = '<button disabled class="bg-slate-700 text-slate-500 px-3 md:px-4 py-1.5 md:py-2 rounded font-bold uppercase text-[9px] md:text-xs">В ГРІ</button>';
        else if (isFull) btnHtml = '<button disabled class="bg-red-900/50 text-red-500 px-3 md:px-4 py-1.5 md:py-2 rounded font-bold uppercase text-[9px] md:text-xs border border-red-500/30">ПОВНА</button>';
        else btnHtml = `<button onclick="joinRoomBtn('${r.id}')" class="bg-blue-600 hover:bg-blue-500 text-white px-3 md:px-4 py-1.5 md:py-2 rounded font-bold uppercase text-[9px] md:text-xs transition shadow-[0_0_10px_rgba(37,99,235,0.4)]">ПІД'ЄДНАТИСЬ</button>`;
        const modeEmoji = r.mode === 'survival' ? '🧟' : r.mode === 'prophunt' ? '📦' : '⚔️';
        const modeName = r.mode === 'survival' ? 'ВИЖИВАННЯ' : r.mode === 'prophunt' ? 'ХОВАНКИ' : 'ДЕТМАТЧ';
        list.innerHTML += `<div class="grid grid-cols-4 md:grid-cols-5 gap-2 md:gap-4 items-center p-3 md:p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700 transition"><div class="col-span-2 flex flex-col"><span class="font-bold text-white text-[10px] md:text-sm truncate">${r.hostName}</span><span class="text-[8px] md:text-[10px] text-slate-500 font-mono hidden sm:block">${r.id}</span></div><div class="text-[9px] md:text-sm font-bold text-slate-300 uppercase hidden md:block">${modeEmoji} ${modeName}</div><div class="text-[9px] md:text-sm text-slate-300 uppercase truncate">${r.map}</div><div class="flex justify-between items-center"><span class="font-russo text-xs md:text-base ${isFull?'text-red-400':'text-blue-400'} mr-2">${r.playersCount}/${r.maxPlayers}</span>${btnHtml}</div></div>`;
    });
}
window.joinRoomBtn = function(roomId) { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('joinRoom', roomId); };

let createConfig = { mode: 'deathmatch', map: 'площя', maxPlayers: 6, winScore: 50 };
document.getElementById('open-create-room-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('create-room-modal').classList.remove('hidden'); };
document.getElementById('cancel-create-btn').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.getElementById('create-room-modal').classList.add('hidden'); };
document.querySelectorAll('.create-mode-select').forEach(btn => { 
    btn.onclick = () => { 
        if (typeof playSound === 'function') playSound('ui_click'); 
        document.querySelectorAll('.create-mode-select').forEach(b => b.classList.remove('selected')); 
        btn.classList.add('selected'); 
        createConfig.mode = btn.dataset.mode; 
        
        document.getElementById('create-score-wrap').style.display = createConfig.mode === 'deathmatch' ? 'block' : 'none'; 
        const phWrap = document.getElementById('create-prophunt-wrap');
        if (phWrap) phWrap.style.display = createConfig.mode === 'prophunt' ? 'block' : 'none';
    }; 
});
document.querySelectorAll('.create-map-select').forEach(btn => { btn.onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); document.querySelectorAll('.create-map-select').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); createConfig.map = btn.dataset.map; }; });
document.getElementById('create-max-players').oninput = (e) => { createConfig.maxPlayers = e.target.value; document.getElementById('max-players-val').innerText = e.target.value; };

document.getElementById('confirm-create-btn').onclick = () => { 
    if (typeof playSound === 'function') playSound('ui_click'); 
    createConfig.winScore = document.getElementById('create-win-score').value; 
    
    if (createConfig.mode === 'prophunt') {
        const hTime = document.getElementById('create-hide-time');
        const sTime = document.getElementById('create-seek-time');
        const hCount = document.getElementById('create-hunter-count');
        if(hTime) createConfig.hideTime = Math.max(30, Math.min(200, parseInt(hTime.value)));
        if(sTime) createConfig.seekTime = Math.max(120, Math.min(600, parseInt(sTime.value)));
        if(hCount) createConfig.hunterCount = Math.max(1, parseInt(hCount.value));
    }
    
    document.getElementById('create-room-modal').classList.add('hidden'); 
    socket.emit('createRoom', createConfig); 
};

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
    if(document.getElementById('stat-kills')) document.getElementById('stat-kills').innerText = myStats.kills || 0; 
    if(document.getElementById('stat-matches')) document.getElementById('stat-matches').innerText = myStats.matches || 0;
    if(document.getElementById('stat-earned')) document.getElementById('stat-earned').innerText = myStats.earned || 0;

    let totalDmg = 1.0, totalRange = 1.0, totalCd = 1.0, totalHp = 1.0, totalSpeed = 1.0, totalRot = 1.0;
    const eqHtml = []; const types = [{k: 'cannon', n: 'Дуло'}, {k: 'turret', n: 'Башта'}, {k: 'hull', n: 'Корпус'}, {k: 'tracks', n: 'Гусениці'}];
    
    types.forEach(t => {
        let modId = myEquipped[t.k];
        if (modId && MODULES[modId]) {
            let m = MODULES[modId];
            if(m.stats.dmg) totalDmg *= m.stats.dmg; if(m.stats.range) totalRange *= m.stats.range; if(m.stats.cd) totalCd *= m.stats.cd;
            if(m.stats.hp) totalHp *= m.stats.hp; if(m.stats.speed) totalSpeed *= m.stats.speed; if(m.stats.rotSpeed) totalRot *= m.stats.rotSpeed;
            let iconSvg = SVG_ICONS[t.k](RARITY[m.rarity].color);
            eqHtml.push(`<div class="flex items-center gap-2 md:gap-3 bg-slate-800/50 p-2 rounded-xl border border-slate-700 cursor-pointer hover:bg-slate-700/50 transition relative overflow-hidden group" draggable="true" ondragstart="dragStartEq(event, '${modId}', '${t.k}')" ondragover="allowDrop(event)" ondrop="dropEq(event, '${t.k}')" onclick="openCtxMenu(event, '${modId}', 'eq', '${t.k}')"><div class="absolute -right-2 -bottom-2 text-3xl opacity-0 group-hover:opacity-10 transition pointer-events-none">🕸️</div><div class="w-8 h-8 md:w-10 md:h-10 p-1.5 md:p-2 flex items-center justify-center rounded-lg bg-slate-900 border z-10 flex-shrink-0" style="border-color:${RARITY[m.rarity].color}">${iconSvg}</div><div class="z-10 overflow-hidden"><p class="text-[10px] md:text-xs text-white font-bold truncate">${m.name}</p><p class="text-[8px] md:text-[9px] uppercase font-bold truncate" style="color:${RARITY[m.rarity].color}">${CAT_NAMES[t.k]} | ${RARITY[m.rarity].name}</p></div></div>`);
        } else {
            eqHtml.push(`<div class="flex items-center gap-2 md:gap-3 bg-slate-900/50 p-2 rounded-xl border border-slate-800 opacity-50" ondragover="allowDrop(event)" ondrop="dropEq(event, '${t.k}')"><div class="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-lg bg-slate-900 border border-slate-700 flex-shrink-0 text-[10px] md:text-xs">❌</div><div class="overflow-hidden"><p class="text-[10px] md:text-xs text-slate-500 font-bold truncate">Стандарт</p><p class="text-[8px] md:text-[9px] uppercase font-bold text-slate-600 truncate">${t.n}</p></div></div>`);
        }
    });
    document.getElementById('equipped-slots-container').innerHTML = eqHtml.join('');
    
    if(document.getElementById('stat-hp')) {
        document.getElementById('stat-hp').innerText = Math.round(MAX_HP * totalHp); document.getElementById('stat-speed').innerText = Math.round(totalSpeed * 100) + '%';
        document.getElementById('stat-dmg').innerText = Math.round(totalDmg * 100) + '%'; document.getElementById('stat-rot').innerText = Math.round(totalRot * 100) + '%';
        document.getElementById('bar-hp').style.width = Math.min(100, (totalHp/2) * 100) + '%'; document.getElementById('bar-speed').style.width = Math.min(100, (totalSpeed/2) * 100) + '%';
        document.getElementById('bar-dmg').style.width = Math.min(100, (totalDmg/2) * 100) + '%'; document.getElementById('bar-rot').style.width = Math.min(100, (totalRot/2) * 100) + '%';
    }

    document.getElementById('inv-count').innerText = myInventory.length; const invGrid = document.getElementById('inventory-grid'); invGrid.innerHTML = '';
    
    for(let i=0; i<30; i++) {
        if (i < myInventory.length) {
            let modId = myInventory[i]; let mod = MODULES[modId]; if(!mod) continue;
            let iconSvg = SVG_ICONS[mod.type](RARITY[mod.rarity].color);
            invGrid.innerHTML += `<div class="inv-slot item-${mod.rarity} p-1.5 md:p-2 cursor-pointer md:cursor-grab md:active:cursor-grabbing hover:scale-105 transition" onclick="openCtxMenu(event, '${modId}', 'inv')" draggable="true" ondragstart="dragStartInv(event, '${modId}', ${i})" ondragover="allowDrop(event)" ondrop="dropInv(event, ${i})" title="${mod.name}">${iconSvg}</div>`;
        } else {
            invGrid.innerHTML += `<div class="inv-slot empty border border-dashed border-slate-700 bg-slate-900/30 rounded-lg" ondragover="allowDrop(event)" ondrop="dropInv(event, ${i})"></div>`;
        }
    }
}

function spawnSpiders(x, y) {
    for (let i = 0; i < 5; i++) {
        let spider = document.createElement('div'); spider.innerText = '🕷'; spider.className = 'scatter-spider';
        spider.style.left = x + 'px'; spider.style.top = y + 'px';
        document.body.appendChild(spider);
        let angle = Math.random() * Math.PI * 2; let dist = 100 + Math.random() * 150;
        setTimeout(() => { spider.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(${Math.random() * 360}deg)`; spider.style.opacity = '0'; }, 10);
        setTimeout(() => spider.remove(), 700);
    }
}

let contextMode = 'inv'; let selectedEqSlot = null; let selectedInvItem = null;
window.openCtxMenu = function(e, modId, mode = 'inv', slot = null) {
    e.preventDefault(); if (typeof playSound === 'function') playSound('ui_click');
    selectedInvItem = modId; contextMode = mode; selectedEqSlot = slot;
    
    let clickX = e.clientX; let clickY = e.clientY;
    if (e.touches && e.touches.length > 0) { clickX = e.touches[0].clientX; clickY = e.touches[0].clientY; }
    spawnSpiders(clickX, clickY);

    let mod = MODULES[modId]; document.getElementById('ctx-name').innerText = mod.name; document.getElementById('ctx-name').style.color = RARITY[mod.rarity].color;
    document.getElementById('ctx-cat').innerText = `${CAT_NAMES[mod.type]} | ${RARITY[mod.rarity].name}`; document.getElementById('ctx-cat').style.color = RARITY[mod.rarity].color;
    
    let desc = [];
    if(mod.stats.dmg) desc.push(`Урон: ${Math.round(mod.stats.dmg*100)}%`); if(mod.stats.hp) desc.push(`Броня: ${Math.round(mod.stats.hp*100)}%`);
    if(mod.stats.speed) desc.push(`Рух: ${Math.round(mod.stats.speed*100)}%`); if(mod.stats.cd) desc.push(`Перезарядка: ${Math.round(mod.stats.cd*100)}%`);
    if(mod.stats.range) desc.push(`Дальність: ${Math.round(mod.stats.range*100)}%`); if(mod.stats.rotSpeed) desc.push(`Башта: ${Math.round(mod.stats.rotSpeed*100)}%`);
    document.getElementById('ctx-desc').innerHTML = desc.join('<br>');
    
    if (mode === 'inv') {
        document.getElementById('ctx-equip').innerText = "Одягнути"; document.getElementById('ctx-sell').style.display = 'block'; document.getElementById('ctx-drop').style.display = 'block'; document.getElementById('ctx-sell').querySelector('span').innerText = `Продати ($${RARITY[mod.rarity].price})`;
    } else {
        document.getElementById('ctx-equip').innerText = "Зняти"; document.getElementById('ctx-sell').style.display = 'none'; document.getElementById('ctx-drop').style.display = 'none';
    }
    
    const menu = document.getElementById('context-menu'); menu.classList.remove('hidden');
    let x = clickX; let y = clickY; 
    let menuWidth = menu.offsetWidth || 192; let menuHeight = menu.offsetHeight || 150;
    
    if (x + menuWidth > window.innerWidth) x -= menuWidth; 
    if (y + menuHeight > window.innerHeight) y -= menuHeight;
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

function updateHangarMousePos(e) {
    const rect = hCanvas.getBoundingClientRect(); 
    let cx = e.clientX; let cy = e.clientY;
    if (e.touches && e.touches.length > 0) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
    
    let scaleX = hCanvas.width / rect.width; let scaleY = hCanvas.height / rect.height;
    hMouseX = (cx - rect.left) * scaleX; hMouseY = (cy - rect.top) * scaleY;
}
hCanvas.addEventListener('mousemove', updateHangarMousePos);
hCanvas.addEventListener('touchmove', updateHangarMousePos, {passive: true});

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
    const MAP_NAMES = { 'площя': '🔲 ПЛОЩА', 'epic_map': '🌐 EPIC MAP', 'Бравл_map': '🌵 БРАВЛ', 'Бій Насмерть': '🔥 ДЕЗМАТЧ' };
    const modeNameStr = currentRoomData.mode === 'survival' ? '🧟 ' : currentRoomData.mode === 'prophunt' ? '📦 ' : '⚔️ ';
    document.getElementById('view-map-name').innerText = modeNameStr + MAP_NAMES[currentRoomData.map];
    
    let winScoreText = currentRoomData.winScore;
    if (currentRoomData.mode === 'survival') winScoreText = 'БЕЗКІНЕЧНО';
    if (currentRoomData.mode === 'prophunt') winScoreText = 'ЧАС';
    document.getElementById('view-win-score').innerText = winScoreText;

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
        if(scoreWrap) scoreWrap.style.display = currentRoomData.mode === 'deathmatch' ? 'block' : 'none';
        
        const phWrap = document.getElementById('host-prophunt-wrap');
        if(phWrap) {
            phWrap.style.display = currentRoomData.mode === 'prophunt' ? 'block' : 'none';
            if (currentRoomData.mode === 'prophunt') {
                document.getElementById('host-hide-time').value = currentRoomData.hideTime || 30;
                document.getElementById('host-seek-time').value = currentRoomData.seekTime || 120;
                let maxHuntersAllowed = Math.max(1, Object.keys(currentRoomData.players).length - 1);
                let hInput = document.getElementById('host-hunter-count');
                hInput.max = maxHuntersAllowed;
                if(parseInt(hInput.value) > maxHuntersAllowed) { hInput.value = maxHuntersAllowed; socket.emit('updateRoomSettings', { roomId: currentRoomId, hunterCount: maxHuntersAllowed }); }
                hInput.value = currentRoomData.hunterCount || 1;
            }
        }
    }

    const list = document.getElementById('players-list'); list.innerHTML = ''; const takenColors = new Set(); const pKeys = Object.keys(currentRoomData.players);
    document.getElementById('lobby-count').innerText = `${pKeys.length} / ${currentRoomData.maxPlayers}`;
    
    const colorSelectors = document.getElementById('color-selectors');
    const teamSelectors = document.getElementById('team-selectors');
    if (currentRoomData.mode === 'prophunt') {
        if(colorSelectors) colorSelectors.classList.add('hidden');
        if(teamSelectors) teamSelectors.classList.remove('hidden');
        document.getElementById('color-title-text').innerText = "Команда";
    } else {
        if(colorSelectors) colorSelectors.classList.remove('hidden');
        if(teamSelectors) teamSelectors.classList.add('hidden');
        document.getElementById('color-title-text').innerText = "Колір";
    }

    let myTeam = null;
    let currentHuntersCount = 0;
    for(let id in currentRoomData.players) {
        if(currentRoomData.players[id].team === 'hunter') currentHuntersCount++;
    }

    for(let id in currentRoomData.players) {
        const p = currentRoomData.players[id]; if (p.color) takenColors.add(p.color); 
        if (id === myId) { myColor = p.color; isReady = p.ready; myTeam = p.team; }
        
        let visualColor = '#475569';
        let visualText = '';
        if (currentRoomData.mode === 'prophunt') {
            if (p.team === 'hunter') { visualColor = '#ef4444'; visualText = '🔴 МИСЛИВЕЦЬ'; }
            else if (p.team === 'hider') { visualColor = '#3b82f6'; visualText = '🔵 ХОВАЄТЬСЯ'; }
        } else {
            visualColor = p.color ? (p.color==='white'?'#f8fafc':p.color==='black'?'#1e293b':p.color==='red'?'#ef4444':p.color==='blue'?'#3b82f6':p.color==='brown'?'#78350f':'#9333ea') : '#475569';
        }

        const isLeader = (id === currentRoomData.hostSocket) ? '👑' : '';
        list.innerHTML += `<div class="flex items-center justify-between p-3 md:p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 mb-2 transition transform hover:scale-[1.02]"><div class="flex items-center gap-2 md:gap-3 overflow-hidden"><div class="w-4 h-4 md:w-6 md:h-6 rounded border border-slate-500 shadow-inner flex-shrink-0" style="background-color: ${visualColor}"></div><span class="font-bold text-white tracking-widest uppercase text-[10px] md:text-sm truncate">${p.name} ${isLeader} <span class="text-[8px] text-slate-400 ml-2">${visualText}</span></span></div><span class="text-[8px] md:text-xs font-bold px-2 py-1 md:px-3 md:py-1.5 rounded border ${p.ready ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-500 border-slate-700'} flex-shrink-0">${p.ready ? 'ГОТОВИЙ' : 'ЧЕКАЄ'}</span></div>`;
    }
    
    if (currentRoomData.mode === 'prophunt') {
        document.querySelectorAll('.team-btn').forEach(btn => { 
            btn.classList.toggle('selected', btn.dataset.team === myTeam); 
            if (btn.dataset.team === 'hunter' && currentHuntersCount >= (currentRoomData.hunterCount || 1) && myTeam !== 'hunter') {
                btn.disabled = true;
                btn.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                btn.disabled = false;
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        });
    } else {
        document.querySelectorAll('.color-btn').forEach(btn => { const c = btn.dataset.color; btn.classList.toggle('selected', c === myColor); btn.disabled = takenColors.has(c) && c !== myColor; });
    }

    const btn = document.getElementById('btn-ready'); const allReady = pKeys.every(id => currentRoomData.players[id].ready);
    let canBeReady = currentRoomData.mode === 'prophunt' ? !!myTeam : !!myColor;
    
    if (!canBeReady) { 
        btn.innerText = currentRoomData.mode === 'prophunt' ? "ОБЕРІТЬ КОМАНДУ" : "ОБЕРІТЬ КАМУФЛЯЖ"; 
        btn.disabled = true; 
        btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-lg md:text-2xl uppercase tracking-widest bg-slate-800 text-slate-500 transition shadow-inner border border-slate-700 relative z-10"; 
    } else {
        btn.disabled = false;
        if (myId === currentRoomData.hostSocket) {
            if (isReady) { if (pKeys.length >= 2 && allReady) { btn.innerText = "🚀 ЗАПУСК СЕСІЇ"; btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-lg md:text-2xl uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition shadow-[0_0_30px_rgba(37,99,235,0.6)] relative z-10"; } else { btn.innerText = "ГОТОВИЙ (ЧЕКАЄМО...)"; btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-sm md:text-2xl uppercase tracking-widest bg-emerald-600 text-white transition shadow-[0_0_20px_rgba(16,185,129,0.4)] relative z-10"; } } else { btn.innerText = "ПІДТВЕРДИТИ"; btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-lg md:text-2xl uppercase tracking-widest bg-slate-700 hover:bg-slate-600 text-white transition border border-slate-500 relative z-10"; }
        } else {
            if (isReady) { btn.innerText = "ВІДМІНИТИ"; btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-lg md:text-2xl uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-[0_0_20px_rgba(16,185,129,0.4)] relative z-10"; } else { btn.innerText = "ПІДТВЕРДИТИ"; btn.className = "w-full py-4 md:py-6 rounded-xl md:rounded-2xl font-russo text-lg md:text-2xl uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-white transition shadow-[0_0_20px_rgba(37,99,235,0.4)] relative z-10"; }
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
document.querySelectorAll('.team-btn').forEach(btn => { btn.onclick = () => { if(!btn.disabled) { if (typeof playSound === 'function') playSound('ui_click'); socket.emit('setTeam', { roomId: currentRoomId, team: btn.dataset.team }); } } });

document.getElementById('btn-ready').onclick = () => { if (typeof playSound === 'function') playSound('ui_click'); const pKeys = Object.keys(currentRoomData.players); const allReady = pKeys.every(id => currentRoomData.players[id].ready); if (myId === currentRoomData.hostSocket && isReady && pKeys.length >= 2 && allReady) { socket.emit('startGame', currentRoomId); } else { socket.emit('toggleReady', currentRoomId); } };

function doCountdown() {
    showScreen('game-screen');
    const overlay = document.getElementById('countdown-overlay'), text = document.getElementById('countdown-text'); overlay.classList.remove('hidden');
    bullets = []; particles = []; let count = 3; text.innerText = count; text.className = "text-[10rem] lg:text-[15rem] font-russo text-white drop-shadow-[0_0_50px_rgba(37,99,235,0.8)] scale-150 transition-transform";
    const iv = setInterval(() => { count--; if (count > 0) { text.innerText = count; if (typeof playSound === 'function') playSound('ui_click'); } else if (count === 0) { text.innerText = "БІЙ!"; text.classList.add('text-emerald-400', 'drop-shadow-[0_0_50px_rgba(16,185,129,0.8)]'); if (typeof playSound === 'function') playSound('shoot'); startGameLoop(); } else { clearInterval(iv); overlay.classList.add('hidden'); } }, 1000);
}

document.getElementById('back-to-room-lobby-btn').onclick = () => { 
    if (typeof playSound === 'function') playSound('ui_click'); 
    document.getElementById('winner-modal').classList.add('hidden'); 
    socket.emit('backToRoomLobby', currentRoomId); 
    if(typeof switchMusicState === 'function') switchMusicState('loby'); 
    showScreen('lobby-screen');
};

window.showPropMenu = function(timeLeft) {
    let propMenu = document.getElementById('prop-selection-menu');
    if (!propMenu) {
        propMenu = document.createElement('div');
        propMenu.id = 'prop-selection-menu';
        propMenu.className = 'fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-md fade-in';
        
        const propsHtml = [
            'prop_crate', 'prop_barrel', 'prop_sandbag', 'prop_rock', 'prop_bush', 'tree', 
            'prop_cone', 'prop_concrete', 'prop_hedgehog', 'prop_radar', 'prop_tent',
            'prop_cont_red', 'prop_cont_blue', 'prop_fence_wood', 'prop_fence_metal',
            'prop_wreck', 'prop_tires', 'prop_generator', 'prop_spotlight'
        ].map(type => {
            return `<div class="bg-slate-800 border-2 border-slate-600 rounded-xl p-2 cursor-pointer hover:border-blue-500 hover:scale-105 transition prop-card" data-proptype="${type}" onclick="selectPropType('${type}')">
                        <canvas width="60" height="60" id="cvs_${type}"></canvas>
                    </div>`;
        }).join('');

        propMenu.innerHTML = `
            <h2 class="text-3xl font-russo text-white tracking-widest mb-2">ОБЕРІТЬ МАСКУВАННЯ</h2>
            <p class="text-blue-400 font-bold mb-6">Залишилось: <span id="prop-timer-text" class="text-xl">${timeLeft}</span> сек</p>
            <div class="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3 max-w-4xl max-h-[60vh] overflow-y-auto p-4 glass-panel rounded-3xl border border-slate-700">
                ${propsHtml}
            </div>
        `;
        document.body.appendChild(propMenu);

        setTimeout(() => {
            document.querySelectorAll('.prop-card').forEach(card => {
                let pType = card.dataset.proptype;
                let c = document.getElementById(`cvs_${pType}`);
                if(c) {
                    let ctx = c.getContext('2d');
                    ctx.translate(30, 30);
                    if(typeof drawProp === 'function') drawProp(ctx, {type: pType, x: -25, y: -25, w: 50, h: 50, r: 25}, 0);
                }
            });
        }, 100);
    } else {
        propMenu.classList.remove('hidden');
    }

    let tl = timeLeft;
    let timerInt = setInterval(() => {
        tl--;
        let span = document.getElementById('prop-timer-text');
        if(span) span.innerText = tl;
        if(tl <= 0) {
            clearInterval(timerInt);
            let propMenuEl = document.getElementById('prop-selection-menu');
            if (propMenuEl && !propMenuEl.classList.contains('hidden')) {
                propMenuEl.classList.add('hidden');
            }
        }
    }, 1000);
};

window.selectPropType = function(type) {
    if (typeof playSound === 'function') playSound('ui_click');
    socket.emit('selectProp', { roomId: currentRoomId, type: type });
    document.getElementById('prop-selection-menu').classList.add('hidden');
};

const savedToken = localStorage.getItem('tankToken');
if(savedToken) socket.emit('authToken', savedToken);
else showScreen('login-screen');