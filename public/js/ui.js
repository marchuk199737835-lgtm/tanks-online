function updateLobbyUI() {
    if(serverGameState.status === 'playing' || serverGameState.status === 'starting') return;
    document.getElementById('login-screen').classList.add('hidden'); document.getElementById('lobby-screen').classList.remove('hidden'); document.getElementById('lobby-screen').classList.add('flex'); document.getElementById('game-screen').classList.add('hidden');
    const list = document.getElementById('players-list'); list.innerHTML = ''; const takenColors = new Set(); const pKeys = Object.keys(serverPlayers); let pCount = pKeys.length;
    for(let id in serverPlayers) {
        const p = serverPlayers[id]; if (p.color) takenColors.add(p.color); if (id === myId) { myColor = p.color; isReady = p.ready; }
        const colorHex = p.color ? (p.color==='white'?'#e2e8f0':p.color==='black'?'#1e293b':p.color==='red'?'#ef4444':p.color==='blue'?'#3b82f6':p.color==='brown'?'#78350f':'#9333ea') : '#475569';
        const isLeader = (id === serverGameState.leaderId) ? '👑' : '';
        list.innerHTML += `<div class="flex items-center justify-between p-3 bg-slate-800 rounded-lg shadow-inner"><div class="flex items-center gap-3"><div class="w-5 h-5 rounded-md border-2 border-slate-600" style="background-color: ${colorHex}"></div><span class="font-bold text-white tracking-wide">${p.name} ${isLeader}</span></div><span class="text-xs font-bold px-2 py-1 rounded ${p.ready ? 'bg-green-900/50 text-green-400' : 'bg-slate-700/50 text-slate-400'}">${p.ready ? 'ГОТОВИЙ' : 'ЧЕКАЄ'}</span></div>`;
    }
    document.getElementById('lobby-count').innerText = `${pCount} / 6`;
    document.querySelectorAll('.color-btn').forEach(btn => { const c = btn.dataset.color; btn.classList.toggle('selected', c === myColor); btn.disabled = takenColors.has(c) && c !== myColor; });

    const MAP_NAMES = { 'city': '🏙️ МІСТО', 'hangars': '🏭 АНГАРИ', 'ship': '🚢 КОРАБЕЛЬ', 'castle': '🏰 ЗАМОК' };
    let activeMap = MAP_DATA[serverGameState.map] ? serverGameState.map : 'city';
    document.getElementById('view-map-name').innerText = (serverGameState.mode === 'survival' ? '🧟 ' : '⚔️ ') + MAP_NAMES[activeMap];
    document.getElementById('view-win-score').innerText = serverGameState.mode === 'survival' ? 'БЕЗКІНЕЧНО' : serverGameState.winScore;
    
    if(isAdmin) {
        document.querySelectorAll('.map-select').forEach(el => el.classList.toggle('selected', el.dataset.map === serverGameState.map));
        document.querySelectorAll('.mode-select').forEach(el => el.classList.toggle('selected', el.dataset.mode === serverGameState.mode));
        if(document.activeElement !== document.getElementById('win-score-input')) document.getElementById('win-score-input').value = serverGameState.winScore;
    }

    const btn = document.getElementById('btn-ready'); const allReady = pKeys.every(id => serverPlayers[id].ready);
    if (!myColor) { btn.innerText = "ОБЕРІТЬ КАМУФЛЯЖ"; btn.disabled = true; btn.className = "w-full py-5 rounded-xl font-bold bg-slate-700 text-slate-500 mb-2 font-russo uppercase shadow-inner"; } else {
        btn.disabled = false;
        if (myId === serverGameState.leaderId) {
            if (isReady) { if (pKeys.length >= 2 && allReady) { btn.innerText = "🚀 ПОЧАТИ ГРУ"; btn.className = "w-full py-5 rounded-xl font-bold bg-gradient-to-b from-orange-500 to-red-600 text-white shadow-[0_5px_15px_rgba(249,115,22,0.6)] mb-2 font-russo uppercase"; } else { btn.innerText = "ГОТОВИЙ (ЧЕКАЄМО ІНШИХ...)"; btn.className = "w-full py-5 rounded-xl font-bold bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_5px_15px_rgba(34,197,94,0.5)] mb-2 font-russo uppercase"; } } else { btn.innerText = "ПІДТВЕРДИТИ ГОТОВНІСТЬ"; btn.className = "w-full py-5 rounded-xl font-bold bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_5px_15px_rgba(59,130,246,0.5)] mb-2 font-russo uppercase"; }
        } else {
            if (isReady) { btn.innerText = "ГОТОВИЙ (СКАСУВАТИ)"; btn.className = "w-full py-5 rounded-xl font-bold bg-gradient-to-b from-green-500 to-green-700 text-white shadow-[0_5px_15px_rgba(34,197,94,0.5)] mb-2 font-russo uppercase"; } else { btn.innerText = "ПІДТВЕРДИТИ ГОТОВНІСТЬ"; btn.className = "w-full py-5 rounded-xl font-bold bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-[0_5px_15px_rgba(59,130,246,0.5)] mb-2 font-russo uppercase"; }
        }
    }
}

function renderShop() {
    document.getElementById('shop-bucks').innerText = myBucks; document.getElementById('lobby-bucks-display').innerText = myBucks;
    const container = document.getElementById('shop-items-container'); container.innerHTML = '';
    for(let key in SHOP_DATA) {
        let data = SHOP_DATA[key]; let currentLvl = myUpgrades[key] || 0; let maxLvl = data.levels.length - 1;
        let nextPrice = currentLvl < maxLvl ? data.prices[currentLvl] : 'MAX'; let nextBonus = currentLvl < maxLvl ? data.levels[currentLvl+1] : data.levels[maxLvl];
        let btnHtml = currentLvl < maxLvl ? `<button onclick="buyUpgrade('${key}')" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded transition text-sm">💵 ${nextPrice}</button>` : `<button disabled class="bg-slate-700 text-slate-500 font-bold py-2 px-4 rounded text-sm">MAX</button>`;
        container.innerHTML += `<div class="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow flex justify-between items-center gap-2"><div><p class="font-bold text-white text-lg">${data.icon} ${data.title}</p><p class="text-xs text-slate-400">Рівень: <span class="text-emerald-400">${currentLvl}</span> (${data.levels[currentLvl]}%)</p>${currentLvl < maxLvl ? `<p class="text-[10px] text-slate-500">Далі: ${nextBonus}%</p>` : ''}</div>${btnHtml}</div>`;
    }
}

window.buyUpgrade = function(type) { let price = SHOP_DATA[type].prices[myUpgrades[type] || 0]; if (myBucks >= price) { playSound('token'); socket.emit('buyUpgrade', type); } else { alert('Недостатньо баксів!'); } };

function doCountdown() {
    document.getElementById('lobby-screen').classList.add('hidden'); document.getElementById('lobby-screen').classList.remove('flex'); document.getElementById('game-screen').classList.remove('hidden');
    const overlay = document.getElementById('countdown-overlay'), text = document.getElementById('countdown-text'); overlay.classList.remove('hidden');
    bullets = []; particles = [];
    let count = 3; text.innerText = count; text.className = "text-[12rem] font-russo text-white drop-shadow-[0_0_40px_rgba(249,115,22,1)] scale-150 transition-transform";
    const iv = setInterval(() => { count--; if (count > 0) { text.innerText = count; playSound('token'); } else if (count === 0) { text.innerText = "БІЙ!"; text.classList.add('text-green-500', 'drop-shadow-[0_0_40px_rgba(34,197,94,1)]'); playSound('shoot'); startGameLoop(); } else { clearInterval(iv); overlay.classList.add('hidden'); } }, 1000);
}

document.getElementById('vol-music').addEventListener('input', e => { volMusic = parseFloat(e.target.value); bgMusic.volume = volMusic; });
document.getElementById('vol-sfx').addEventListener('input', e => { volSfx = parseFloat(e.target.value); });

document.getElementById('login-settings-btn').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
document.getElementById('lobby-settings-btn').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
document.getElementById('game-settings-btn').onclick = () => document.getElementById('settings-modal').classList.remove('hidden');
document.getElementById('close-settings-btn').onclick = () => document.getElementById('settings-modal').classList.add('hidden');

document.getElementById('tab-login').onclick = () => { authMode='login'; document.getElementById('tab-login').className='flex-1 py-3 text-sm font-bold uppercase transition bg-orange-600 text-white'; document.getElementById('tab-register').className='flex-1 py-3 text-sm font-bold uppercase transition text-slate-400 hover:bg-slate-800'; document.getElementById('auth-btn').innerText='УВІЙТИ В ГРУ'; };
document.getElementById('tab-register').onclick = () => { authMode='register'; document.getElementById('tab-register').className='flex-1 py-3 text-sm font-bold uppercase transition bg-orange-600 text-white'; document.getElementById('tab-login').className='flex-1 py-3 text-sm font-bold uppercase transition text-slate-400 hover:bg-slate-800'; document.getElementById('auth-btn').innerText='ЗАРЕЄСТРУВАТИСЯ'; };
document.getElementById('auth-btn').onclick = () => { const name = document.getElementById('nickname-input').value.trim().toUpperCase(); const pwd = document.getElementById('password-input').value.trim(); if(!name || !pwd) return alert('Введіть логін та пароль!'); socket.emit(authMode, { name, password: pwd }); };
document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('tankToken'); location.reload(); };

document.getElementById('open-shop-btn').onclick = () => { document.getElementById('shop-panel').classList.replace('-translate-x-full', 'translate-x-0'); playSound('token'); };
document.getElementById('close-shop-btn').onclick = () => { document.getElementById('shop-panel').classList.replace('translate-x-0', '-translate-x-full'); playSound('token'); };
document.getElementById('buy-case-btn').onclick = () => { if (myBucks >= 50) { playSound('token'); document.getElementById('case-confirm-modal').classList.remove('hidden'); } else { alert('Недостатньо баксів для кейсу (потрібно 50$)!'); } };
document.getElementById('cancel-case-btn').onclick = () => { playSound('token'); document.getElementById('case-confirm-modal').classList.add('hidden'); };
document.getElementById('confirm-case-btn').onclick = () => { playSound('token'); document.getElementById('case-confirm-modal').classList.add('hidden'); socket.emit('buyCase'); };

document.querySelectorAll('.color-btn').forEach(btn => { btn.onclick = () => { if(!btn.disabled) { playSound('token'); socket.emit('setColor', btn.dataset.color); } } });
document.getElementById('btn-ready').onclick = () => { playSound('token'); const pKeys = Object.keys(serverPlayers); const allReady = pKeys.every(id => serverPlayers[id].ready); if (myId === serverGameState.leaderId && isReady && pKeys.length >= 2 && allReady) { socket.emit('startGame'); } else { socket.emit('toggleReady'); } };

document.getElementById('admin-code').addEventListener('input', e => { isAdmin = (e.target.value === '123321'); document.getElementById('admin-panel').classList.toggle('hidden', !isAdmin); document.getElementById('admin-panel').classList.toggle('flex', isAdmin); });
document.getElementById('admin-save-btn').onclick = () => { if(isAdmin) { playSound('token'); socket.emit('adminSave'); const btn = document.getElementById('admin-save-btn'); btn.innerText = "ЗБЕРЕЖЕНО!"; btn.classList.replace('bg-orange-600', 'bg-green-600'); setTimeout(() => { btn.innerText = "ЗБЕРЕГТИ"; btn.classList.replace('bg-green-600', 'bg-orange-600'); }, 2000); } };
document.querySelectorAll('.map-select').forEach(el => el.onclick = () => { if(isAdmin) { playSound('token'); socket.emit('adminUpdate', { code: '123321', map: el.dataset.map }); }});
document.querySelectorAll('.mode-select').forEach(el => el.onclick = () => { if(isAdmin) { playSound('token'); socket.emit('adminUpdate', { code: '123321', mode: el.dataset.mode }); }});
document.getElementById('win-score-input').onchange = e => { if(isAdmin) { let v=parseInt(e.target.value); socket.emit('adminUpdate', { code: '123321', winScore: Math.max(1, Math.min(1000, v)) }); }};
document.getElementById('back-to-lobby-btn').onclick = () => { 
    document.getElementById('winner-modal').classList.add('hidden'); 
    socket.emit('backToLobby'); 
    if (typeof switchMusicState === 'function') switchMusicState('loby'); 
};