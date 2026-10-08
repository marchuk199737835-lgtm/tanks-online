// Завантажуємо збережені налаштування, або ставимо стандартні (0.3 та 0.6)
let volMusic = localStorage.getItem('tankVolMusic') !== null ? parseFloat(localStorage.getItem('tankVolMusic')) : 0.3;
let volSfx = localStorage.getItem('tankVolSfx') !== null ? parseFloat(localStorage.getItem('tankVolSfx')) : 0.6;

let audioCtx = null;
let bgMusic = new Audio(); 
bgMusic.volume = volMusic;
let myMusicPlaylists = { loby: [], main: [] };
let activePlaylist = []; let currentMusicState = ''; let currentTrackIndex = 0;

function initAudio() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } }

// ===== Розблокування звуку =====
// Браузери не дозволяють музику/звуки без жесту користувача. Після автоматичного входу за токеном жесту ще не було,
// тому музика й AudioContext лишалися «заснулими». Ловимо перший дотик/клік/клавішу і запускаємо все, що чекало.
let audioUnlocked = false, musicWanted = false;
function tryUnlockAudio() {
    initAudio();
    if (audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} }
    if (audioCtx && !audioUnlocked) {            // тихий буфер — «будить» звук на iOS/Safari
        try { const b = audioCtx.createBuffer(1, 1, 22050), src = audioCtx.createBufferSource(); src.buffer = b; src.connect(audioCtx.destination); src.start(0); } catch (e) {}
    }
    if (musicWanted && bgMusic.paused && activePlaylist.length) {
        const pr = bgMusic.src ? bgMusic.play() : (playCurrentTrack(), null);
        if (pr && pr.catch) pr.catch(() => {});
    }
    const ctxOk = !audioCtx || audioCtx.state === 'running';
    const musicOk = !musicWanted || !activePlaylist.length || !bgMusic.paused;
    if (ctxOk && musicOk && audioCtx) {
        audioUnlocked = true; hideAudioHint();
        ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(ev => document.removeEventListener(ev, tryUnlockAudio, true));
    }
}
['pointerdown', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, tryUnlockAudio, true));
document.addEventListener('visibilitychange', () => { if (!document.hidden && audioCtx && audioCtx.state !== 'running') { try { audioCtx.resume(); } catch (e) {} } });

function showAudioHint() {
    if (audioUnlocked || document.getElementById('audio-hint')) return;
    const d = document.createElement('div'); d.id = 'audio-hint'; d.className = 'audio-hint';
    d.innerHTML = '<span class="audio-hint-ico">🔊</span><span>Торкніться екрана, щоб увімкнути музику та звуки</span>';
    document.body.appendChild(d);
}
function hideAudioHint() { const d = document.getElementById('audio-hint'); if (d) d.remove(); }

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

// Стани музики: 'main' — головне меню, 'loby' — лобі/кімнати. У бою ('dezmatch'/'survive'/'battle'/'') музики немає.
// Якщо для стану немає треків — береться другий список (щоб меню не мовчало); немає жодного — тиша.
function stopMusic() {
    activePlaylist = []; currentTrackIndex = 0; currentMusicState = '';
    try { bgMusic.pause(); } catch (e) {}
    hideAudioHint();
}
function switchMusicState(newState) {
    if (newState !== 'main' && newState !== 'loby') { musicWanted = false; stopMusic(); currentMusicState = newState || ''; return; }
    musicWanted = true;
    if (currentMusicState === newState && activePlaylist.length) { if (bgMusic.paused) tryUnlockAudio(); return; }
    currentMusicState = newState;
    const other = newState === 'main' ? 'loby' : 'main';
    let tracks = [...(myMusicPlaylists[newState] || [])];
    if (!tracks.length) tracks = [...(myMusicPlaylists[other] || [])];
    if (!tracks.length) { activePlaylist = []; try { bgMusic.pause(); } catch (e) {} return; }
    for (let i = tracks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tracks[i], tracks[j]] = [tracks[j], tracks[i]]; }
    activePlaylist = tracks; currentTrackIndex = 0; playCurrentTrack();
}

function playCurrentTrack() {
    if (!musicWanted || activePlaylist.length === 0) return;
    const url = '/music/' + activePlaylist[currentTrackIndex].split('/').map(encodeURIComponent).join('/');
    bgMusic.src = url;
    const pr = bgMusic.play();
    if (pr && pr.catch) pr.catch(e => { console.log('Autoplay prevented'); showAudioHint(); });
}
// екран → музика: меню грає «main», лобі й список кімнат — «loby», у бою (game-screen) тиша
(function () {
    function hook() {
        const orig = window.showScreen; if (typeof orig !== 'function' || orig.__music) return;
        const w = function (id) {
            orig.apply(this, arguments);
            if (typeof myName === 'undefined' || !myName) return;
            if (id === 'main-menu-screen') switchMusicState('main');
            else if (id === 'lobby-screen' || id === 'room-browser-screen') switchMusicState('loby');
            else if (id === 'game-screen') switchMusicState('battle');
        };
        w.__music = true; window.showScreen = w;
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(hook, 0)); else setTimeout(hook, 0);
})();
bgMusic.addEventListener('ended', () => { if (activePlaylist.length > 0) { currentTrackIndex = (currentTrackIndex + 1) % activePlaylist.length; playCurrentTrack(); } });

function playSound(type) {
    if (!audioCtx) initAudio();
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch (e) {} }
    if (!audioCtx || audioCtx.state !== 'running') return;
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