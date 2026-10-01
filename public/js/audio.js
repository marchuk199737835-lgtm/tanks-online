let audioCtx = null, volMusic = 0.3, volSfx = 0.6;
let bgMusic = new Audio(); 
bgMusic.volume = volMusic;
let myMusicPlaylists = { loby: [], dezmatch: [], survive: [], main: [] };
let activePlaylist = [];
let currentMusicState = '';
let currentTrackIndex = 0;

function initAudio() { if (!audioCtx) { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } }

function switchMusicState(newState) {
    if (currentMusicState === newState) return;
    currentMusicState = newState;
    
    let tracks = [...(myMusicPlaylists[newState] || [])];
    if (newState !== 'loby') {
        tracks = [...tracks, ...(myMusicPlaylists['main'] || [])];
    }
    if (tracks.length === 0) tracks = [...(myMusicPlaylists['main'] || [])];
    
    if (tracks.length === 0) {
        bgMusic.pause();
        return;
    }

    // Перемішування
    for (let i = tracks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }

    activePlaylist = tracks;
    currentTrackIndex = 0;
    playCurrentTrack();
}

function playCurrentTrack() {
    if (activePlaylist.length === 0) return;
    let parts = activePlaylist[currentTrackIndex].split('/');
    if (parts.length === 2) {
        bgMusic.src = '/music/' + encodeURIComponent(parts[0]) + '/' + encodeURIComponent(parts[1]);
        bgMusic.play().catch(e => console.log('Autoplay prevented by browser'));
    }
}

bgMusic.addEventListener('ended', () => {
    if (activePlaylist.length > 0) {
        currentTrackIndex = (currentTrackIndex + 1) % activePlaylist.length;
        playCurrentTrack();
    }
});

function playSound(type) {
    if (!audioCtx) return; const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain(); osc.connect(gain); gain.connect(audioCtx.destination); const now = audioCtx.currentTime;
    if (type === 'shoot') { osc.type = 'square'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(40, now+0.1); gain.gain.setValueAtTime(volSfx*0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.1); osc.start(now); osc.stop(now+0.1); }
    else if (type === 'minigun') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(100, now+0.05); gain.gain.setValueAtTime(volSfx*0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.05); osc.start(now); osc.stop(now+0.05); }
    else if (type === 'boss_shoot') { osc.type = 'square'; osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(20, now+0.4); gain.gain.setValueAtTime(volSfx*0.8, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.4); osc.start(now); osc.stop(now+0.4); }
    else if (type === 'powerup' || type === 'token') { osc.type = 'sine'; osc.frequency.setValueAtTime(600, now); osc.frequency.linearRampToValueAtTime(type==='token'?1800:1200, now+0.2); gain.gain.setValueAtTime(volSfx*0.3, now); gain.gain.linearRampToValueAtTime(0.01, now+0.4); osc.start(now); osc.stop(now+0.4); }
    else if (type === 'explosion') { osc.type = 'square'; osc.frequency.setValueAtTime(50, now); osc.frequency.exponentialRampToValueAtTime(10, now+0.5); gain.gain.setValueAtTime(volSfx*0.7, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.5); osc.start(now); osc.stop(now+0.5); }
    else if (type === 'hurt') { osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(20, now+0.2); gain.gain.setValueAtTime(volSfx*0.9, now); gain.gain.exponentialRampToValueAtTime(0.01, now+0.2); osc.start(now); osc.stop(now+0.2); }
    else if (type === 'hitmarker') { osc.type = 'sine'; osc.frequency.setValueAtTime(1000, now); osc.frequency.linearRampToValueAtTime(1500, now+0.1); gain.gain.setValueAtTime(volSfx*0.5, now); gain.gain.linearRampToValueAtTime(0.01, now+0.1); osc.start(now); osc.stop(now+0.1); }
}