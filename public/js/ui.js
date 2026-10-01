function showScreen(screenId) {
    const screens = ['login-screen', 'main-menu-screen', 'room-browser-screen', 'shop-screen', 'lobby-screen', 'game-screen'];
    screens.forEach(id => { document.getElementById(id).classList.add('hidden'); document.getElementById(id).classList.remove('flex'); });
    const s = document.getElementById(screenId); s.classList.remove('hidden');
    if (screenId !== 'game-screen') s.classList.add('flex');
    playSound('ui_click');
}
function updateGlobalBucks() { document.querySelectorAll('.global-bucks-display').forEach(el => el.innerText = myBucks); }

document.getElementById('tab-login').onclick = () => { authMode='login'; playSound('ui_click'); document.getElementById('tab-login').className='flex-1 py-3 text-xs font-bold uppercase transition bg-blue-600 text-white tracking-wider'; document.getElementById('tab-register').className='flex-1 py-3 text-xs font-bold uppercase transition text-slate-400 hover:bg-slate-800 tracking-wider'; document.getElementById('auth-btn').innerText='АВТОРИЗАЦІЯ'; };
document.getElementById('tab-register').onclick = () => { authMode='register'; playSound('ui_click'); document.getElementById('tab-register').className='flex-1 py-3 text-xs font-bold uppercase transition bg-blue-600 text-white tracking-wider'; document.getElementById('tab-login').className='flex-1 py-3 text-xs font-bold uppercase transition text-slate-400 hover:bg-slate-800 tracking-wider'; document.getElementById('auth-btn').innerText='СТВОРИТИ АКАУНТ'; };
document.getElementById('auth-btn').onclick = () => { playSound('ui_click'); const name = document.getElementById('nickname-input').value.trim().toUpperCase(); const pwd = document.getElementById('password-input').value.trim(); if(!name || !pwd) return alert('Введіть логін та пароль!'); socket.emit(authMode, { name, password: pwd }); };
document.getElementById('menu-logout-btn').onclick = () => { playSound('ui_click'); localStorage.removeItem('tankToken'); location.reload(); };

// НАЛАШТУВАННЯ
document.querySelectorAll('.settings-btn').forEach(btn => btn.onclick = () => { playSound('ui_click'); document.getElementById('settings-modal').classList.remove('hidden'); });
document.getElementById('close-settings-btn').onclick = () => { playSound('ui_click'); document.getElementById('settings-modal').classList.add('hidden'); };

document.getElementById('nav-sessions-btn').onclick = () => { socket.emit('requestRooms'); showScreen('room-browser-screen'); };
document.getElementById('nav-shop-btn').onclick = () => { renderShop(); showScreen('shop-screen'); };
document.getElementById('shop-back-btn').onclick = () => { showScreen('main-menu-screen'); };
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
window.joinRoomBtn = function(roomId) { playSound('ui_click'); socket.emit('joinRoom', roomId); };

let createConfig = { mode: 'deathmatch', map: 'city', maxPlayers: 6, winScore: 50 };
document.getElementById('open-create-room-btn').onclick = () => { playSound('ui_click'); document.getElementById('create-room-modal').classList.remove('hidden'); };
document.getElementById('cancel-create-btn').onclick = () => { playSound('ui_click'); document.getElementById('create-room-modal').classList.add('hidden'); };
document.querySelectorAll('.create-mode-select').forEach(btn => { btn.onclick = () => { playSound('ui_click'); document.querySelectorAll('.create-mode-select').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); createConfig.mode = btn.dataset.mode; document.getElementById('create-score-wrap').style.display = createConfig.mode === 'survival' ? 'none' : 'block'; }; });
document.querySelectorAll('.create-map-select').forEach(btn => { btn.onclick = () => { playSound('ui_click'); document.querySelectorAll('.create-map-select').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); createConfig.map = btn.dataset.map; }; });
document.getElementById('create-max-players').oninput = (e) => { createConfig.maxPlayers = e.target.value; document.getElementById('max-players-val').innerText = e.target.value; };
document.getElementById('confirm-create-btn').onclick = () => { playSound('ui_click'); createConfig.winScore = document.getElementById('create-win-score').value; document.getElementById('create-room-modal').classList.add('hidden'); socket.emit('createRoom', createConfig); };

function renderShop() {
    updateGlobalBucks();
    const container = document.getElementById('shop-items-container'); container.innerHTML = '';
    for(let key in SHOP_DATA) {
        let data = SHOP_DATA[key]; let currentLvl = myUpgrades[key] || 0; let maxLvl = data.levels.length - 1; let nextPrice = currentLvl < maxLvl ? data.prices[currentLvl] : 'MAX'; let nextBonus = currentLvl < maxLvl ? data.levels[currentLvl+1] : data.levels[maxLvl];
        let btnHtml = currentLvl < maxLvl ? `<button onclick="buyUpgrade('${key}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-6 rounded-xl transition text-sm shadow-[0_0_15px_rgba(16,185,129,0.3)]">💵 ${nextPrice}</button>` : `<button disabled class="bg-slate-700/50 text-slate-500 font-bold py-3 px-6 rounded-xl text-sm border border-slate-600">MAX</button>`;
        container.innerHTML += `<div class="glass-panel p-5 rounded-2xl border border-slate-700 shadow-lg flex justify-between items-center gap-4 transition hover:border-slate-500"><div class="text-4xl drop-shadow-md">${data.icon}</div><div class="flex-1"><p class="font-russo text-white text-xl tracking-wider">${data.title}</p><div class="flex items-center gap-2 mt-1"><div class="flex gap-1">${Array.from({length: maxLvl}).map((_,i) => `<div class="w-3 h-1.5 rounded-full ${i < currentLvl ? 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]' : 'bg-slate-700'}"></div>`).join('')}</div><span class="text-xs text-slate-400 font-bold">(${data.levels[currentLvl]}%)</span></div></div>${btnHtml}</div>`;
    }
}
window.buyUpgrade = function(type) { let price = SHOP_DATA[type].prices[myUpgrades[type] || 0]; if (myBucks >= price) { playSound('ui_buy'); socket.emit('buyUpgrade', type); } else { alert('Недостатньо коштів!'); } };
document.getElementById('buy-case-btn').onclick = () => { playSound('ui_click'); if (myBucks >= 50) { document.getElementById('case-confirm-modal').classList.remove('hidden'); } else { alert('Недостатньо баксів!'); } };
document.getElementById('cancel-case-btn').onclick = () => { playSound('ui_click'); document.getElementById('case-confirm-modal').classList.add('hidden'); };
document.getElementById('confirm-case-btn').onclick = () => { playSound('ui_buy'); document.getElementById('case-confirm-modal').classList.add('hidden'); socket.emit('buyCase'); };

document.getElementById('leave-room-btn').onclick = () => { playSound('ui_click'); if(currentRoomId) socket.emit('leaveRoom', currentRoomId); currentRoomId = null; currentRoomData = null; showScreen('room-browser-screen'); };

function updateLobbyUI() {
    if(!currentRoomData || currentRoomData.status === 'playing') return;
    
    document.getElementById('lobby-room-name').innerText = currentRoomData.hostName + " СЕСІЯ";
    const MAP_NAMES = { 'city': '🏙️ МІСТО', 'hangars': '🏭 АНГАРИ', 'ship': '🚢 КОРАБЕЛЬ', 'castle': '🏰 ЗАМОК' };
    document.getElementById('view-map-name').innerText = (currentRoomData.mode === 'survival' ? '🧟 ' : '⚔️ ') + MAP_NAMES[currentRoomData.map];
    document.getElementById('view-win-score').innerText = currentRoomData.mode === 'survival' ? 'БЕЗКІНЕЧНО' : currentRoomData.winScore;

    // ПАНЕЛЬ ЛІДЕРА
    const isHost = (myId === currentRoomData.hostSocket);
    document.getElementById('host-settings-panel').classList.toggle('hidden', !isHost);
    document.getElementById('host-settings-panel').classList.toggle('flex', isHost);
    if (isHost) {
        document.querySelectorAll('.host-mode-select').forEach(el => el.classList.toggle('selected', el.dataset.mode === currentRoomData.mode));
        document.querySelectorAll('.host-map-select').forEach(el => el.classList.toggle('selected', el.dataset.map === currentRoomData.map));
        if (document.activeElement !== document.getElementById('host-max-players')) { document.getElementById('host-max-players').value = currentRoomData.maxPlayers; document.getElementById('host-max-players-val').innerText = currentRoomData.maxPlayers; }
        if (document.activeElement !== document.getElementById('host-win-score')) document.getElementById('host-win-score').value = currentRoomData.winScore;
        document.getElementById('host-score-wrap').style.display = currentRoomData.mode === 'survival' ? 'none' : 'block';
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

// ІВЕНТИ ЛІДЕРА
document.querySelectorAll('.host-mode-select').forEach(btn => { btn.onclick = () => { playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, mode: btn.dataset.mode }); }; });
document.querySelectorAll('.host-map-select').forEach(btn => { btn.onclick = () => { playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, map: btn.dataset.map }); }; });
document.getElementById('host-max-players').onchange = (e) => { playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, maxPlayers: parseInt(e.target.value) }); };
document.getElementById('host-win-score').onchange = (e) => { playSound('ui_click'); socket.emit('updateRoomSettings', { roomId: currentRoomId, winScore: parseInt(e.target.value) }); };

document.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = () => { if(!btn.disabled) { playSound('ui_click'); socket.emit('setColor', { roomId: currentRoomId, color: btn.dataset.color }); } } });
document.getElementById('btn-ready').onclick = () => { playSound('ui_click'); const pKeys = Object.keys(currentRoomData.players); const allReady = pKeys.every(id => currentRoomData.players[id].ready); if (myId === currentRoomData.hostSocket && isReady && pKeys.length >= 2 && allReady) { socket.emit('startGame', currentRoomId); } else { socket.emit('toggleReady', currentRoomId); } };

function doCountdown() {
    showScreen('game-screen'); const overlay = document.getElementById('countdown-overlay'), text = document.getElementById('countdown-text'); overlay.classList.remove('hidden');
    bullets = []; particles = []; let count = 3; text.innerText = count; text.className = "text-[15rem] font-russo text-white drop-shadow-[0_0_50px_rgba(37,99,235,0.8)] scale-150 transition-transform";
    const iv = setInterval(() => { count--; if (count > 0) { text.innerText = count; playSound('ui_click'); } else if (count === 0) { text.innerText = "БІЙ!"; text.classList.add('text-emerald-400', 'drop-shadow-[0_0_50px_rgba(16,185,129,0.8)]'); playSound('shoot'); startGameLoop(); } else { clearInterval(iv); overlay.classList.add('hidden'); } }, 1000);
}
document.getElementById('back-to-room-lobby-btn').onclick = () => { playSound('ui_click'); document.getElementById('winner-modal').classList.add('hidden'); socket.emit('backToRoomLobby', currentRoomId); switchMusicState('loby'); };