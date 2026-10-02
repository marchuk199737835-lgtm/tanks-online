// Завантажуємо збережені налаштування, або ставимо стандартні (0.3 та 0.6)
let volMusic = localStorage.getItem('tankVolMusic') !== null ? parseFloat(localStorage.getItem('tankVolMusic')) : 0.3;
let volSfx = localStorage.getItem('tankVolSfx') !== null ? parseFloat(localStorage.getItem('tankVolSfx')) : 0.6;

let audioCtx = null;
let bgMusic = new Audio(); 
bgMusic.volume = volMusic;
let myMusicPlaylists = { loby: [], dezmatch: [], survive: [], main: [] };
let activePlaylist = []; let currentMusicState = ''; let currentTrackIndex = 0;

function initAudio() { if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } }

// Зберігаємо нові значення в пам'ять браузера при кожній зміні
window.setMusicVolume = function(val) { 
    volMusic = val; 
    bgMusic.volume = val; 
    localStorage.setItem('tankVolMusic', val);
};
window.setSfxVolume = function(val) { 
    volSfx = val; 
    localStorage.setItem('tankVolSfx', val);
};

function switchMusicState(newState) {
    if (currentMusicState === newState) return; currentMusicState = newState;
    let tracks = [...(myMusicPlaylists[newState] || [])];
    if (newState !== 'loby') tracks = [...tracks, ...(myMusicPlaylists['main'] || [])];
    if (tracks.length === 0) tracks = [...(myMusicPlaylists['main'] || [])];
    if (tracks.length === 0) { bgMusic.pause(); return; }
    for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
    activePlaylist = tracks; currentTrackIndex = 0; playCurrentTrack();
}

function playCurrentTrack() {
    if (activePlaylist.length === 0) return; let parts = activePlaylist[currentTrackIndex].split('/');
    if (parts.length === 2) { bgMusic.src = '/music/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]); bgMusic.play().catch(e => console.log('Autoplay prevented')); }
}
bgMusic.addEventListener('ended', () => { if (activePlaylist.length > 0) { currentTrackIndex = (currentTrackIndex + 1) % activePlaylist.length; playCurrentTrack(); } });

function playSound(type) {
    if (!audioCtx || audioCtx.state === 'suspended') return;
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination); const now = audioCtx.currentTime;

    if (type === 'ui_click') { osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.05); gain.gain.setValueAtTime(volSfx * 0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1); }
    else if (type === 'ui_buy') { osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(1200, now + 0.1); gain.gain.setValueAtTime(volSfx * 0.5, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3); }
    else if (type === 'shoot') { osc.type = 'sine'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(50, now+0.15); gain.gain.setValueAtTime(volSfx*0.4, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.15); osc.start(now); osc.stop(now+0.15); }
    else if (type === 'samurai') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(100, now+0.1); gain.gain.setValueAtTime(volSfx*0.5, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.1); osc.start(now); osc.stop(now+0.1); }
    else if (type === 'minigun') { osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(150, now+0.05); gain.gain.setValueAtTime(volSfx*0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.05); osc.start(now); osc.stop(now+0.05); }
    else if (type === 'boss_shoot') { osc.type = 'sine'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now+0.3); gain.gain.setValueAtTime(volSfx*0.7, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.3); osc.start(now); osc.stop(now+0.3); }
    else if (type === 'powerup' || type === 'token') { osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(type==='token'?1500:1000, now+0.3); gain.gain.setValueAtTime(volSfx*0.4, now); gain.gain.linearRampToValueAtTime(0.01, now+0.3); osc.start(now); osc.stop(now+0.3); }
    else if (type === 'explosion') { osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now+0.4); gain.gain.setValueAtTime(volSfx*0.6, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.4); osc.start(now); osc.stop(now+0.4); }
    else if (type === 'hurt') { osc.type = 'triangle'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(40, now+0.25); gain.gain.setValueAtTime(volSfx*0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.25); osc.start(now); osc.stop(now+0.25); }
    else if (type === 'hitmarker') { osc.type = 'sine'; osc.frequency.setValueAtTime(1200, now); osc.frequency.linearRampToValueAtTime(1800, now+0.08); gain.gain.setValueAtTime(volSfx*0.3, now); gain.gain.linearRampToValueAtTime(0.01, now+0.08); osc.start(now); osc.stop(now+0.08); }
}