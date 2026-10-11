/* hud.js — новий інтерфейс бою та «відчуття» бою:
 *  • міні-мапа: ПК — лівий нижній кут (квадрат), телефон — кругла вгорі ліворуч із дугою HP і перезарядки; M / дотик — збільшити;
 *    гравець — стрілка руху, союзники — зелені точки, вороги (лише детматч / командний / «Ціль») спалахують на 2 с, коли стріляють;
 *    об'єкти режимів: зона й аірдроп (королівський бій), конвой і маршрут, ядро, точки захоплення, ціль.
 *  • ПК: «капсула танка» поруч із міні-мапою (сегментоване HP, перезарядка, ривок, бонус); старі панелі HP/перезарядки ховаються.
 *  • табло очок / жетонів згортається стрілкою (телефон — згорнуте одразу, ПК — відкрите), вибір запам'ятовується.
 *  • налаштування: «Показувати міні-мапу», на телефоні — «Масштаб HUD у бою» 60–100%.
 *  • ривок (Shift / кнопка на телефоні), цифри шкоди, віддача, струс і спалах на вбивстві, серії вбивств, дрифт зі слідами гусениць.
 * Оптимізація: силует мапи малюється один раз; міні-мапа оновлюється 15/8/4 разів на секунду (графіка high/medium/low);
 * на слабкій графіці — без світіння, частинок і слідів. */
(function () {
    'use strict';
    var $ = function (id) { return document.getElementById(id); };
    var root = document.documentElement;
    var tt = function (s) { return window.I18N && I18N.t ? I18N.t(s) : s; };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var room = function () { return typeof currentRoomData !== 'undefined' ? currentRoomData : null; };
    var touch = function () { return root.classList.contains('ctl-touch'); };
    var tier = function () { return (window.GFX && GFX.tier) || 'high'; };
    var inGame = function () { var g = $('game-screen'), r = room(); return !!(g && !g.classList.contains('hidden') && r && r.status === 'playing'); };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var MI = window.ModeInfo;
    var ENEMY_MODES = { deathmatch: 1, team_deathmatch: 1, bounty: 1 };
    var TEAM_MODES = { team_deathmatch: 1, capture_points: 1, rounds: 1, prophunt: 1 };
    var TCOL = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308' };

    // ================= НАЛАШТУВАННЯ =================
    var mmOn = lsGet('bhMini') !== '0';
    var hz = clamp(parseFloat(lsGet('bhScale')) || 1, 0.6, 1);
    function applyScale() { root.style.setProperty('--bhz', touch() ? hz : 1); }
    applyScale();

    // ================= СТИЛІ =================
    var css = '' +
        // міні-мапа (ПК)
        '#bh-mm{position:absolute;left:14px;bottom:14px;width:170px;height:170px;z-index:34;border-radius:16px;overflow:hidden;pointer-events:auto;cursor:pointer;background:rgba(2,6,23,.55);border:1px solid rgba(96,165,250,.35);box-shadow:0 8px 24px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.03);transition:width .22s,height .22s,opacity .2s}' +
        '#bh-mm canvas{display:block;width:100%;height:100%}' +
        '#bh-mm.big{width:300px;height:300px}#bh-mm.off{display:none}' +
        '#bh-mm .bh-key{position:absolute;right:6px;top:5px;font:700 9px/1 "Russo One",Arial;color:rgba(203,213,225,.7);background:rgba(2,6,23,.6);padding:2px 5px;border-radius:5px;pointer-events:none}' +
        'html:not(.gfx-low) #bh-mm{backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}' +
        // капсула танка (ПК)
        '#bh-cap{position:absolute;left:194px;bottom:14px;z-index:34;width:250px;display:flex;flex-direction:column;gap:6px;padding:9px 12px 10px;border-radius:16px;background:rgba(8,13,30,.78);border:1px solid rgba(96,165,250,.28);box-shadow:0 8px 24px rgba(0,0,0,.45);pointer-events:none}' +
        '#bh-cap .r1{display:flex;align-items:center;gap:8px}#bh-cap .r1 i{font-style:normal;font-size:15px;line-height:1;filter:drop-shadow(0 0 4px rgba(34,197,94,.7))}' +
        '.bh-hp{position:relative;flex:1;height:14px;border-radius:7px;background:rgba(15,23,42,.95);border:1px solid rgba(255,255,255,.1);overflow:hidden}' +
        '.bh-hp b{position:absolute;inset:0;width:100%;transform-origin:left;background:linear-gradient(90deg,#16a34a,#4ade80);box-shadow:0 0 10px rgba(74,222,128,.55);transition:transform .2s,background .3s}' +
        '.bh-hp b.mid{background:linear-gradient(90deg,#ca8a04,#facc15);box-shadow:0 0 10px rgba(250,204,21,.5)}.bh-hp b.low{background:linear-gradient(90deg,#b91c1c,#f87171);box-shadow:0 0 12px rgba(248,113,113,.7);animation:bhPulse .8s ease-in-out infinite}' +
        '.bh-hp u{position:absolute;inset:0;background:repeating-linear-gradient(90deg,transparent 0 calc(10% - 2px),rgba(2,6,23,.75) calc(10% - 2px) 10%);pointer-events:none}' +
        '.bh-hp s{position:absolute;inset:0;width:100%;transform-origin:left;background:rgba(255,255,255,.35);transition:transform .6s .15s;text-decoration:none}' +
        '#bh-hpt{min-width:66px;text-align:right;font:400 13px "Russo One",Arial;color:#fff;text-shadow:0 1px 4px #000}#bh-hpt small{font-size:10px;color:#94a3b8}' +
        '#bh-cap .r2{display:flex;align-items:center;gap:8px}' +
        '.bh-cd{position:relative;flex:1;height:6px;border-radius:3px;background:rgba(15,23,42,.95);overflow:hidden}.bh-cd b{position:absolute;inset:0;transform-origin:left;background:linear-gradient(90deg,#f97316,#fbbf24)}.bh-cd b.full{background:linear-gradient(90deg,#38bdf8,#a5f3fc);box-shadow:0 0 8px rgba(56,189,248,.6)}' +
        '.bh-ic{--p:1;position:relative;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;background:rgba(15,23,42,.9)}' +
        '.bh-ic:before{content:"";position:absolute;inset:-2px;border-radius:50%;background:conic-gradient(#38bdf8 calc(var(--p)*360deg),rgba(255,255,255,.1) 0);-webkit-mask:radial-gradient(circle,transparent 60%,#000 62%);mask:radial-gradient(circle,transparent 60%,#000 62%)}' +
        '.bh-ic.cd{filter:grayscale(.8) brightness(.7)}.bh-ic small{position:absolute;bottom:-12px;left:50%;transform:translateX(-50%);font:700 8px/1 "Russo One",Arial;color:#94a3b8;white-space:nowrap}' +
        '#bh-buff.bh-ic:before{background:conic-gradient(#facc15 calc(var(--p)*360deg),rgba(255,255,255,.1) 0)}#bh-buff.off{display:none}' +
        '@keyframes bhPulse{50%{opacity:.65}}' +
        // чат у бою (ПК) — над міні-мапою
        'html.bh-on #ch-root[data-k=game][data-t="0"]{left:14px;bottom:198px}' +
        // старі панелі HP / перезарядки / бафу — ховаємо, поки активний новий HUD
        'html.bh-on .bh-old{display:none!important}' +
        // табло: стрілка згортання
        '.bh-tgl{position:absolute;top:4px;left:-26px;width:22px;height:30px;border-radius:9px 0 0 9px;background:rgba(15,23,42,.88);border:1px solid rgba(148,163,184,.4);border-right:0;color:#cbd5e1;font:700 13px/28px Arial;text-align:center;cursor:pointer;pointer-events:auto;padding:0}' +
        '.bh-tgl:hover{color:#fff;background:rgba(30,41,82,.95)}' +
        '#deathmatch-score-hud{position:relative;overflow:visible!important}' +
        '#deathmatch-score-hud.bh-col{width:auto!important;padding:6px 10px!important}#deathmatch-score-hud.bh-col>h3,#deathmatch-score-hud.bh-col>#score-list{display:none!important}' +
        '.bh-chip{display:none;font:400 12px "Russo One",Arial;color:#fff;white-space:nowrap}.bh-col>.bh-chip{display:block}.bh-chip em{font-style:normal;color:#facc15}' +
        '#bh-bwrap{position:relative;display:flex;justify-content:center;pointer-events:auto}#bh-bwrap .bh-tgl{position:static;border-radius:9px;border:1px solid rgba(148,163,184,.4);height:24px;line-height:22px;margin-right:6px}' +
        '#bh-bwrap.bh-col .mfx-board{display:none}#bh-bwrap .bh-chip{padding:3px 10px;border-radius:99px;background:rgba(15,23,42,.88);border:1px solid rgba(250,204,21,.5)}' +
        // ===== телефон =====
        'html.ctl-touch #bh-mm{left:calc(env(safe-area-inset-left,0px) + 10px);top:calc(env(safe-area-inset-top,0px) + 48px);bottom:auto;width:calc(104px * var(--bhz));height:calc(104px * var(--bhz));border-radius:50%;overflow:visible;background:transparent;border:0;box-shadow:none}' +
        'html.ctl-touch #bh-mm canvas{border-radius:50%;background:rgba(2,6,23,.6);box-shadow:0 0 0 2px rgba(96,165,250,.45),0 0 18px rgba(59,130,246,.35),0 6px 18px rgba(0,0,0,.5)}' +
        'html.ctl-touch #bh-mm.big{width:calc(200px * var(--bhz));height:calc(200px * var(--bhz))}html.ctl-touch #bh-mm .bh-key{display:none}' +
        'html.gfx-low.ctl-touch #bh-mm canvas{box-shadow:0 0 0 2px rgba(96,165,250,.45)}' +
        '#bh-arc{position:absolute;left:-9%;top:-9%;width:118%;height:118%;pointer-events:none;overflow:visible;display:none}html.ctl-touch #bh-arc{display:block}' +
        '#bh-arc path{fill:none;stroke-linecap:round}#bh-arc .bg{stroke:rgba(15,23,42,.85);stroke-width:6}#bh-arc .hp{stroke:#4ade80;stroke-width:5;transition:stroke-dashoffset .2s,stroke .3s;filter:drop-shadow(0 0 3px rgba(74,222,128,.8))}#bh-arc .hp.mid{stroke:#facc15}#bh-arc .hp.low{stroke:#f87171;animation:bhPulse .8s infinite}' +
        '#bh-arc .cd{stroke:#fbbf24;stroke-width:4}#bh-arc .cd.full{stroke:#38bdf8}html.gfx-low #bh-arc .hp{filter:none}' +
        '#bh-hpm{display:none;position:absolute;left:50%;bottom:-17px;transform:translateX(-50%);padding:1px 7px;border-radius:8px;background:rgba(2,6,23,.85);font:400 10px/14px "Russo One",Arial;color:#fff;white-space:nowrap;pointer-events:none}html.ctl-touch #bh-hpm{display:block}' +
        'html.ctl-touch #bh-cap{display:none}' +
        // кнопка ривка (телефон) і колонка кнопок праворуч: здібність → ривок → емоції
        '#bh-dash{--p:1;display:none;position:absolute;right:calc(env(safe-area-inset-right,0px) + 18px);bottom:calc(env(safe-area-inset-bottom,0px) + 46% + 56px * var(--bhz));z-index:36;width:calc(52px * var(--bhz));height:calc(52px * var(--bhz));border-radius:50%;border:0;padding:0;color:#fff;font-size:calc(22px * var(--bhz));background:radial-gradient(circle at 50% 38%,rgba(56,189,248,.5),rgba(8,12,30,.92) 70%);box-shadow:0 0 0 2px rgba(56,189,248,.35),0 6px 16px rgba(0,0,0,.5);touch-action:none;-webkit-tap-highlight-color:transparent}' +
        '#bh-dash:before{content:"";position:absolute;inset:-3px;border-radius:50%;background:conic-gradient(#38bdf8 calc(var(--p)*360deg),rgba(255,255,255,.1) 0);-webkit-mask:radial-gradient(circle,transparent 62%,#000 64%);mask:radial-gradient(circle,transparent 62%,#000 64%)}' +
        '#bh-dash.cd{filter:grayscale(.7) brightness(.7)}#bh-dash:active{transform:scale(.9)}html.ctl-touch.bh-on #bh-dash.show{display:block}' +
        'html.ctl-touch.bh-on #cls-hud{bottom:calc(env(safe-area-inset-bottom,0px) + 46% + 118px * var(--bhz))}' +
        'html.ctl-touch.bh-on #cls-ab{width:calc(58px * var(--bhz));height:calc(58px * var(--bhz))}html.ctl-touch.bh-on #cls-ab i{line-height:calc(58px * var(--bhz));font-size:calc(25px * var(--bhz))}' +
        'html.ctl-touch.bh-on #emo-btn.show{width:calc(46px * var(--bhz));height:calc(46px * var(--bhz));font-size:calc(20px * var(--bhz))}' +
        // чат на телефоні — праворуч від кнопок налаштувань (ліве місце зайняла міні-мапа)
        'html.bh-on #ch-root[data-k=game][data-t="1"]{top:calc(env(safe-area-inset-top,0px) + 6px);left:calc(env(safe-area-inset-left,0px) + 84px);bottom:auto}' +
        // масштаб HUD у бою (телефон): верхні табло
        'html.ctl-touch.bh-on #mfx,html.ctl-touch.bh-on #deathmatch-score-hud,html.ctl-touch.bh-on #survival-hud,html.ctl-touch.bh-on #tdm-hud,html.ctl-touch.bh-on #prophunt-hud-timer{zoom:var(--bhz)}' +
        // «соковитість»: спалах вбивства і серії
        '#bh-flash{position:absolute;inset:0;z-index:16;pointer-events:none;opacity:0;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0) 40%,rgba(255,244,214,.45));transition:opacity .35s}' +
        '#bh-streak{position:absolute;left:50%;top:27%;z-index:46;transform:translate(-50%,-50%);pointer-events:none;text-align:center;font-family:"Russo One",Arial;opacity:0}' +
        '#bh-streak b{display:block;font-size:44px;letter-spacing:.06em;color:#fff;-webkit-text-stroke:1px rgba(0,0,0,.35);text-shadow:0 0 18px var(--sc,#f97316),0 4px 0 rgba(0,0,0,.4)}#bh-streak small{display:block;margin-top:2px;font-size:13px;letter-spacing:.2em;color:var(--sc,#f97316)}' +
        '#bh-streak.go{animation:bhStreak 1.6s cubic-bezier(.2,1.3,.4,1) forwards}@keyframes bhStreak{0%{opacity:0;transform:translate(-50%,-50%) scale(2.2)}12%{opacity:1;transform:translate(-50%,-50%) scale(.95)}20%{transform:translate(-50%,-50%) scale(1)}75%{opacity:1}100%{opacity:0;transform:translate(-50%,-62%) scale(1)}}' +
        'html.gfx-low #bh-streak b{text-shadow:0 3px 0 rgba(0,0,0,.5)}' +
        '@media (orientation:landscape) and (max-height:430px){#bh-streak b{font-size:30px}#bh-streak small{font-size:10px}}';
    var se = document.createElement('style'); se.id = 'hud-css'; se.textContent = css; document.head.appendChild(se);

    // ================= ЗВУКИ (синтез, як у classfx.js) =================
    var AC = function () { try { if (typeof audioCtx === 'undefined' || !audioCtx) { if (typeof initAudio === 'function') initAudio(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx || null; } catch (e) { return null; } };
    var VOL = function () { try { return typeof volSfx === 'number' ? volSfx : 0.6; } catch (e) { return 0.6; } };
    var nBuf = null;
    function noiseBuf(a) { if (nBuf) return nBuf; var n = a.sampleRate | 0, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (nBuf = b); }
    function osc(a, dst, type, f0, f1, t0, dur, g) { var o = a.createOscillator(), e = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur); e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(e); e.connect(dst); o.start(t0); o.stop(t0 + dur + 0.05); }
    function noise(a, dst, ft, f0, f1, t0, dur, g, q) { var s = a.createBufferSource(), f = a.createBiquadFilter(), e = a.createGain(); s.buffer = noiseBuf(a); f.type = ft; f.Q.value = q || 1; f.frequency.setValueAtTime(f0, t0); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur); e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + 0.02); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); s.connect(f); f.connect(e); e.connect(dst); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05); }
    var SND = {
        dash: function (a, d, t) { noise(a, d, 'bandpass', 900, 3200, t, 0.28, 0.32, 1.5); osc(a, d, 'sine', 220, 520, t, 0.22, 0.08); },
        kill: function (a, d, t) { osc(a, d, 'sine', 140, 60, t, 0.25, 0.25); noise(a, d, 'lowpass', 2400, 300, t, 0.2, 0.18, 0.7); },
        streak: function (a, d, t, lvl) { var base = 392 * Math.pow(1.122, lvl); [1, 1.26, 1.5, 2].forEach(function (m, i) { osc(a, d, i % 2 ? 'triangle' : 'sawtooth', base * m, base * m, t + i * 0.06, 0.5, 0.07); }); noise(a, d, 'highpass', 3000, 6000, t, 0.5, 0.06, 1); }
    };
    function play(k, x, y, arg) {
        var a = AC(); if (!a || !SND[k]) return; var v = VOL(); if (v <= 0) return; var g = 0.8;
        if (x != null && typeof camera !== 'undefined') { g *= Math.max(0, 1 - Math.hypot(x - camera.x, y - camera.y) / 1300); if (g < 0.05) return; }
        try { var m = a.createGain(); m.gain.value = g * v; m.connect(a.destination); SND[k](a, m, a.currentTime + 0.01, arg || 0); } catch (e) {}
    }

    // ================= DOM =================
    var mm = null, cv = null, g = null, arc = null, cap = null, dashBtn = null, flash = null, streakEl = null, built = false;
    function arcPath(cx, cy, r, a0, a1) { var x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1); return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + (Math.abs(a1 - a0) > Math.PI ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2); }
    function build() {
        var gs = $('game-screen'); if (!gs || built) return; built = true;
        // міні-мапа (+ дуга HP / перезарядки для телефона)
        mm = document.createElement('div'); mm.id = 'bh-mm'; mm.className = 'hidden';
        // HP — ліва дуга (заповнюється знизу вгору), перезарядка — права (згори вниз)
        var hp0 = Math.PI * 0.62, hp1 = Math.PI * 1.38, c0 = -Math.PI * 0.28, c1 = Math.PI * 0.28;
        mm.innerHTML = '<canvas></canvas><svg id="bh-arc" viewBox="-9 -9 118 118"><path class="bg" d="' + arcPath(50, 50, 54, hp0, hp1) + '"/><path class="hp" pathLength="100" stroke-dasharray="100 100" d="' + arcPath(50, 50, 54, hp0, hp1) + '"/>' +
            '<path class="bg" d="' + arcPath(50, 50, 54, c0, c1) + '"/><path class="cd" pathLength="100" stroke-dasharray="100 100" d="' + arcPath(50, 50, 54, c0, c1) + '"/></svg><b id="bh-hpm"></b><span class="bh-key">M</span>';
        gs.appendChild(mm); cv = mm.querySelector('canvas'); g = cv.getContext('2d'); arc = mm.querySelector('#bh-arc');
        mm.addEventListener('click', function () { setBig(!big, touch() ? 2000 : 0); snd('ui_click'); });
        mm.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
        // капсула (ПК)
        cap = document.createElement('div'); cap.id = 'bh-cap'; cap.className = 'hidden';
        cap.innerHTML = '<div class="r1"><i>❤</i><div class="bh-hp"><s id="bh-hps"></s><b id="bh-hpf"></b><u></u></div><span id="bh-hpt">0</span></div>' +
            '<div class="r2"><div class="bh-cd"><b id="bh-cdf"></b></div><span class="bh-ic" id="bh-dashi">💨<small>Shift</small></span><span class="bh-ic off" id="bh-buff"></span></div>';
        gs.appendChild(cap);
        // кнопка ривка (телефон)
        dashBtn = document.createElement('button'); dashBtn.id = 'bh-dash'; dashBtn.type = 'button'; dashBtn.setAttribute('aria-label', 'Ривок'); dashBtn.textContent = '💨';
        var fire = function (e) { e.preventDefault(); e.stopPropagation(); doDash(); };
        dashBtn.addEventListener('touchstart', fire, { passive: false }); dashBtn.addEventListener('mousedown', function (e) { if (e.button === 0) fire(e); });
        gs.appendChild(dashBtn);
        flash = document.createElement('div'); flash.id = 'bh-flash'; gs.appendChild(flash);
        streakEl = document.createElement('div'); streakEl.id = 'bh-streak'; streakEl.innerHTML = '<b></b><small></small>'; gs.appendChild(streakEl);
        // старі панелі — позначаємо (ховаються лише разом з активним новим HUD)
        var mark = function (el) { if (el) el.classList.add('bh-old'); };
        var pcd = $('pc-cd-container'); if (pcd && pcd.parentElement) mark(pcd.parentElement);
        var hpm = $('hp-bar-mob'); if (hpm) mark(hpm.closest('.glass-panel'));
        mark($('mob-cd-container')); mark($('buff-timer-container'));
        buildBoardToggle();
        buildSettings();
    }

    // ================= ТАБЛО: згортання =================
    var boardOpen = lsGet('bhBoard') === null ? null : lsGet('bhBoard') === '1';
    function isOpen() { return boardOpen === null ? !touch() : boardOpen; }
    function setOpen(v) { boardOpen = v; lsSet('bhBoard', v ? '1' : '0'); paintBoards(); }
    function buildBoardToggle() {
        var d = $('deathmatch-score-hud'); if (d && !d.querySelector('.bh-tgl')) {
            var b = document.createElement('button'); b.type = 'button'; b.className = 'bh-tgl'; b.setAttribute('aria-label', 'Табло'); d.insertBefore(b, d.firstChild);
            var c = document.createElement('div'); c.className = 'bh-chip'; d.appendChild(c);
            b.addEventListener('click', function (e) { e.stopPropagation(); snd('ui_click'); setOpen(!isOpen()); });
        }
    }
    function myPlace(r, key) {
        var ps = Object.keys(r.players).map(function (id) { var p = r.players[id], s = id === myId ? (myLocalTank.score || 0) : (typeof opponents !== 'undefined' && opponents[id] && opponents[id].score != null ? opponents[id].score : (p.score || 0)); return { id: id, s: s }; });
        ps.sort(function (a, b) { return b.s - a.s; }); var i = ps.findIndex(function (q) { return q.id === myId; });
        return { place: i + 1, score: i >= 0 ? ps[i].s : 0 };
    }
    function paintBoards() {
        var r = room(); if (!r) return; var open = isOpen();
        var d = $('deathmatch-score-hud');
        if (d) {
            d.classList.toggle('bh-col', !open); var t = d.querySelector('.bh-tgl'); if (t) t.textContent = open ? '▸' : '◂';
            if (!open && r.mode === 'deathmatch') { var q = myPlace(r), c = d.querySelector('.bh-chip'), s = '🏆 <em>' + q.place + '</em> · ' + q.score + '/' + (r.winScore || 50); if (c && c._v !== s) { c._v = s; c.innerHTML = s; } }
        }
        // табло «Цілі» (мітки гравців під панеллю режиму)
        var bd = document.querySelector('#mfx .mfx-board');
        if (bd) {
            var w = $('bh-bwrap');
            if (!w || w.parentElement !== bd.parentElement) {
                w = document.createElement('div'); w.id = 'bh-bwrap'; bd.parentElement.insertBefore(w, bd); w.appendChild(bd);
                var bt = document.createElement('button'); bt.type = 'button'; bt.className = 'bh-tgl'; w.insertBefore(bt, bd);
                var ch = document.createElement('span'); ch.className = 'bh-chip'; w.appendChild(ch);
                bt.addEventListener('click', function (e) { e.stopPropagation(); snd('ui_click'); setOpen(!isOpen()); });
            }
            w.classList.toggle('bh-col', !open); w.querySelector('.bh-tgl').textContent = open ? '▾' : '▸';
            if (!open) { var md = window.ModesFX && ModesFX.md, q2 = myPlace(r), s2 = '🏆 <em>' + q2.place + '</em> · ' + q2.score + '/' + (md && md.goal || r.bnScore || 30), ch2 = w.querySelector('.bh-chip'); if (ch2._v !== s2) { ch2._v = s2; ch2.innerHTML = s2; } }
        }
    }

    // ================= НАЛАШТУВАННЯ (вікно ⚙) =================
    function buildSettings() {
        var anchor = $('view-zoom-row') || $('ui-scale-row'); if (!anchor || $('bh-set')) return;
        var row = document.createElement('div'); row.id = 'bh-set'; row.className = 'mb-5 lg:mb-6 text-left';
        row.innerHTML = '<label class="text-[10px] lg:text-xs font-bold uppercase text-slate-400 block mb-2 tracking-wider">Інтерфейс бою</label>' +
            '<div class="ctl-seg"><button type="button" data-a="mm"></button></div>' +
            '<div id="bh-sc-row" style="margin-top:10px"><label class="text-[10px] lg:text-xs font-bold uppercase text-slate-400 block mb-2 tracking-wider">Масштаб HUD у бою <span id="bh-sc-v" class="text-sky-300"></span></label><input type="range" id="bh-sc" min="60" max="100" step="5" class="w-full accent-blue-500"><div class="flex justify-between text-[10px] text-slate-500 mt-1"><span>Менше</span><span>Більше</span></div></div>';
        anchor.parentNode.insertBefore(row, anchor.nextSibling);
        var mb = row.querySelector('[data-a=mm]'), rg = $('bh-sc'), rv = $('bh-sc-v');
        var paint = function () { mb.textContent = mmOn ? '🗺️ ' + tt('Міні-мапа: увімкнено') : '🗺️ ' + tt('Міні-мапа: вимкнено'); mb.classList.toggle('on', mmOn); rg.value = Math.round(hz * 100); rv.textContent = Math.round(hz * 100) + '%'; $('bh-sc-row').style.display = touch() ? '' : 'none'; };
        mb.addEventListener('click', function () { snd('ui_click'); mmOn = !mmOn; lsSet('bhMini', mmOn ? '1' : '0'); paint(); });
        rg.addEventListener('input', function () { hz = clamp(+rg.value / 100, 0.6, 1); lsSet('bhScale', String(hz)); applyScale(); rv.textContent = Math.round(hz * 100) + '%'; });
        document.querySelectorAll('.settings-btn').forEach(function (b) { b.addEventListener('click', paint); });
        paint();
    }

    // ================= РИВОК =================
    var DASH_MS = 160, DASH_DIST = 150, DASH_CD = 5000;
    var dash = { cdEnd: 0, until: 0, ax: 0, ay: 0, lastGhost: 0 };
    var ghosts = [];      // шлейф: { x, y, a, t, c }
    function canDash() {
        var r = room(); if (!inGame() || typeof myLocalTank === 'undefined' || myLocalTank.hp <= 0 || myLocalTank.isDisguised) return false;
        if (r.mode === 'prophunt' && (myLocalTank.team === 'hider' || r.state !== 'seeking')) return false;
        if (window.ModesFX && ModesFX.frozen && ModesFX.frozen()) return false;
        return true;
    }
    function myCol() { var r = room(), me = r && r.players[myId]; return (window.tankHex && me) ? tankHex(me.color || me.team, '#38bdf8') : '#38bdf8'; }
    function doDash() {
        var now = performance.now(); if (now < dash.cdEnd) { snd('ui_error'); return; } if (!canDash()) return;
        var mx = 0, my = 0;
        if (typeof joysticks !== 'undefined' && joysticks.left.active && joysticks.left.force > 0.15) { mx = Math.cos(joysticks.left.angle); my = Math.sin(joysticks.left.angle); }
        else if (typeof keys !== 'undefined') { if (keys.w) my -= 1; if (keys.s) my += 1; if (keys.a) mx -= 1; if (keys.d) mx += 1; }
        var a = (mx || my) ? Math.atan2(my, mx) : myLocalTank.bodyAngle;
        dash.ax = Math.cos(a); dash.ay = Math.sin(a); dash.until = now + DASH_MS; dash.cdEnd = now + DASH_CD; dash.lastGhost = 0;
        socket.emit('dash', { roomId: currentRoomId, a: a });
        play('dash');
    }
    document.addEventListener('keydown', function (e) {
        if (e.repeat) return; var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key === 'Shift' && inGame()) { doDash(); }
        else if ((e.code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь') && inGame() && mmOn) { setBig(!big, 0); }
    });
    // виклик з game.js (updatePhys): переміщення під час ривка з перевіркою стін
    function dashStep(dt, rad, isB) {
        var now = performance.now(); if (now >= dash.until || myLocalTank.hp <= 0) return;
        var sp = DASH_DIST / (DASH_MS / 1000), nx = myLocalTank.x + dash.ax * sp * dt, ny = myLocalTank.y + dash.ay * sp * dt;
        if (typeof checkCollision !== 'function' || isB || !checkCollision(nx, myLocalTank.y, rad, true, false)) myLocalTank.x = nx;
        if (typeof checkCollision !== 'function' || isB || !checkCollision(myLocalTank.x, ny, rad, true, false)) myLocalTank.y = ny;
        if (now - dash.lastGhost > 26) { dash.lastGhost = now; ghosts.push({ x: myLocalTank.x, y: myLocalTank.y, a: myLocalTank.bodyAngle, t: Date.now(), c: myCol() }); }
    }
    socket.on('dashFx', function (d) {
        if (!d) return; var r = room(), p = r && r.players[d.id], c = (window.tankHex && p) ? tankHex(p.color || p.team, '#94a3b8') : '#94a3b8', now = Date.now();
        for (var i = 0; i < 6; i++) ghosts.push({ x: d.x + Math.cos(d.a) * i * 25, y: d.y + Math.sin(d.a) * i * 25, a: d.a, t: now + i * 26, c: c });
        play('dash', d.x, d.y);
    });

    // ================= «СОКОВИТІСТЬ»: цифри шкоди, віддача, вбивства, серії =================
    var nums = [];       // { x, y, v, k, t }
    socket.on('dmgN', function (d) {
        if (!d || !inGame()) return; var cap = tier() === 'low' ? 8 : 26; if (nums.length >= cap) nums.shift();
        nums.push({ x: d.x + (Math.random() - 0.5) * 18, y: d.y - 20, v: d.v, k: d.k | 0, t: Date.now() });
    });
    socket.on('knock', function (d) {
        if (!d || typeof myLocalTank === 'undefined' || myLocalTank.hp <= 0 || !inGame()) return;
        var dx = myLocalTank.x - d.x, dy = myLocalTank.y - d.y, l = Math.hypot(dx, dy); if (l < 1) return;
        var nx = myLocalTank.x + dx / l * 8, ny = myLocalTank.y + dy / l * 8;
        if (typeof checkCollision === 'function' && !checkCollision(nx, ny, 22, true, false)) { myLocalTank.x = nx; myLocalTank.y = ny; }
        if (typeof shakeTime !== 'undefined') shakeTime = Math.max(shakeTime, 0.08);
    });
    function killFx(big) {
        if (typeof shakeTime !== 'undefined') shakeTime = Math.max(shakeTime, big ? 0.22 : 0.12);
        if (flash && tier() !== 'low') { flash.style.transition = 'none'; flash.style.opacity = big ? '1' : '.6'; void flash.offsetWidth; flash.style.transition = 'opacity .35s'; flash.style.opacity = '0'; }
    }
    // серії: PvP — вбивства гравців з паузою < 4 с; PvE — комбо зомбі з паузою < 2 с
    var st = { n: 0, at: 0 }, zc = { n: 0, at: 0 };
    var PVP = ['', '', 'ПОДВІЙНЕ!', 'ПОТРІЙНЕ!', 'НЕСТРИМНИЙ!'];
    function showStreak(txt, sub, col, lvl) {
        if (!streakEl) return; var b = streakEl.querySelector('b'), s = streakEl.querySelector('small');
        b.textContent = tt(txt); s.textContent = sub || ''; streakEl.style.setProperty('--sc', col);
        streakEl.classList.remove('go'); void streakEl.offsetWidth; streakEl.classList.add('go'); play('streak', null, null, lvl);
    }
    socket.on('playerDied', function (d) {
        if (!d || d.killer !== myId || d.id === myId || !inGame()) return;
        var now = Date.now(); st.n = now - st.at < 4000 ? st.n + 1 : 1; st.at = now;
        killFx(true); play('kill');
        if (st.n >= 2) { var i = Math.min(4, st.n); showStreak(PVP[i], st.n >= 4 ? '×' + st.n : '', st.n >= 4 ? '#f43f5e' : st.n === 3 ? '#f97316' : '#facc15', st.n); }
    });
    socket.on('zKill', function (d) {
        if (!d || !inGame()) return; var now = Date.now();
        zc.n = now - zc.at < 2000 ? zc.n + 1 : 1; zc.at = now; killFx(!!d.b); if (d.b) play('kill');
        if (zc.n === 5 || zc.n === 10) showStreak(zc.n === 10 ? 'НЕСТРИМНИЙ!' : 'КОМБО', '×' + zc.n, zc.n === 10 ? '#f43f5e' : '#22d3ee', zc.n === 10 ? 4 : 2);
        else if (zc.n > 10 && zc.n % 10 === 0) showStreak('НЕСТРИМНИЙ!', '×' + zc.n, '#f43f5e', 5);
    });
    socket.on('gameStarting', function () { st.n = 0; zc.n = 0; nums.length = 0; ghosts.length = 0; marks.length = 0; dash.cdEnd = 0; dash.until = 0; trk = {}; shots = {}; staticKey = ''; });

    // ================= ДРИФТ: занос корпусу, сліди гусениць, пил =================
    var trk = {}, marks = [], dust = [];
    function angDiff(a, b) { var d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
    function driftUpdate(now, dt) {
        var t = tier(), maxM = t === 'low' ? 0 : t === 'medium' ? 120 : 260;
        var list = []; if (myLocalTank.hp > 0) list.push([myId, myLocalTank]);
        for (var id in opponents) { var o = opponents[id]; if (o.hp > 0 && !o.isDisguised) list.push([id, o]); }
        var seen = {};
        for (var i = 0; i < list.length; i++) {
            var id2 = list[i][0], p = list[i][1], s = trk[id2]; seen[id2] = 1;
            if (!s) { trk[id2] = { x: p.x, y: p.y, a: p.bodyAngle, slip: 0, m: 0 }; continue; }
            var v = Math.hypot(p.x - s.x, p.y - s.y) / Math.max(dt, 0.001), w = angDiff(p.bodyAngle, s.a) / Math.max(dt, 0.001);
            var target = (v > 130 && v < 900 && Math.abs(w) > 2.2) ? clamp(-w * 0.06, -0.3, 0.3) : 0;
            s.slip += (target - s.slip) * Math.min(1, dt * (target ? 10 : 5));
            if (maxM && Math.abs(s.slip) > 0.06 && now - s.m > 34) {
                s.m = now; var ca = Math.cos(p.bodyAngle + s.slip), sa = Math.sin(p.bodyAngle + s.slip), rx = p.x - ca * 22, ry = p.y - sa * 22;
                marks.push({ x: rx - sa * 14, y: ry + ca * 14, a: p.bodyAngle + s.slip, t: now }); marks.push({ x: rx + sa * 14, y: ry - ca * 14, a: p.bodyAngle + s.slip, t: now });
                while (marks.length > maxM) marks.shift();
                if (t === 'high' && dust.length < 40) dust.push({ x: rx + (Math.random() - 0.5) * 20, y: ry + (Math.random() - 0.5) * 20, vx: -ca * 30 + (Math.random() - 0.5) * 30, vy: -sa * 30 + (Math.random() - 0.5) * 30, t: now });
            }
            s.x = p.x; s.y = p.y; s.a = p.bodyAngle;
        }
        for (var k in trk) if (!seen[k]) delete trk[k];
    }

    // ================= МАЛЮВАННЯ В СВІТІ (виклики з game.js) =================
    var lastG = 0;
    function ground(c, view) {
        if (!inGame()) return; var now = Date.now(), dt = Math.min(0.1, Math.max(0.001, (now - (lastG || now)) / 1000)); lastG = now;
        driftUpdate(now, dt);
        // сліди гусениць (зникають за 3 с)
        if (marks.length) {
            c.save(); c.fillStyle = '#000';
            for (var i = 0; i < marks.length; i++) {
                var m = marks[i], age = (now - m.t) / 3000; if (age >= 1) continue; if (m.x < view.x0 - 20 || m.x > view.x1 + 20 || m.y < view.y0 - 20 || m.y > view.y1 + 20) continue;
                c.globalAlpha = 0.28 * (1 - age); c.save(); c.translate(m.x, m.y); c.rotate(m.a); c.fillRect(-5, -2.5, 10, 5); c.restore();
            }
            c.restore();
            while (marks.length && now - marks[0].t > 3000) marks.shift();
        }
        groundB(c, view, now);
    }
    function top(c, view) {
        if (!inGame()) return; var now = Date.now(), lo = tier() === 'low';
        topB(c, view, now);
        // пил
        for (var j = dust.length - 1; j >= 0; j--) { var p = dust[j], a = (now - p.t) / 700; if (a >= 1) { dust.splice(j, 1); continue; } c.globalAlpha = 0.35 * (1 - a); c.fillStyle = '#cbd5e1'; c.beginPath(); c.arc(p.x + p.vx * a * 0.7, p.y + p.vy * a * 0.7, 3 + a * 7, 0, Math.PI * 2); c.fill(); }
        c.globalAlpha = 1;
        // шлейф ривка
        for (var i = ghosts.length - 1; i >= 0; i--) {
            var gh = ghosts[i], age = (now - gh.t) / 320; if (age >= 1) { ghosts.splice(i, 1); continue; } if (age < 0) continue;
            c.save(); c.translate(gh.x, gh.y); c.rotate(gh.a); c.globalAlpha = 0.38 * (1 - age);
            if (!lo && window.GFX && GFX.shadow) { c.shadowColor = gh.c; c.shadowBlur = 12; }
            c.fillStyle = gh.c; if (c.roundRect) { c.beginPath(); c.roundRect(-26, -22, 52, 44, 10); c.fill(); } else c.fillRect(-26, -22, 52, 44);
            c.restore();
        }
        // цифри шкоди
        if (nums.length) {
            c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
            for (var n = nums.length - 1; n >= 0; n--) {
                var N = nums[n], q = (now - N.t) / 900; if (q >= 1) { nums.splice(n, 1); continue; }
                var pop = q < 0.12 ? 0.6 + q / 0.12 * 0.6 : 1.2 - Math.min(0.2, (q - 0.12) * 0.5), size = N.k === 2 ? 26 : N.k === 1 ? 24 : 16;
                c.globalAlpha = q > 0.65 ? 1 - (q - 0.65) / 0.35 : 1;
                c.font = Math.round(size * pop) + 'px "Russo One", Arial'; c.lineWidth = 4; c.strokeStyle = 'rgba(2,6,23,.85)';
                var y = N.y - q * 46, txt = (N.k === 2 ? '💀 ' : '') + N.v;
                c.strokeText(txt, N.x, y); c.fillStyle = N.k === 2 ? '#f87171' : N.k === 1 ? '#facc15' : '#fff'; c.fillText(txt, N.x, y);
            }
            c.restore();
        }
    }
    var api = { ground: ground, top: top, dashStep: function (dt, rad, isB) { dashStep(dt, rad, isB); pullStep(dt, rad); }, slip: function (id) { var s = trk[id]; return s ? s.slip : 0; },
        ricochet: ricochet, heatLocked: heatLocked, heatShot: heatShot, shieldBlock: shieldBlock };
    window.BHUD = api;

    // ================= МІНІ-МАПА =================
    var staticCv = null, staticKey = '', shots = {}, big = false, bigUntil = 0, lastDraw = 0;
    function setBig(v, ms) { big = v; bigUntil = ms ? Date.now() + ms : 0; if (mm) mm.classList.toggle('big', big); lastDraw = 0; }
    socket.on('spawnBullet', function (d) { if (d && d.owner && d.owner !== 'zombie') shots[d.owner] = Date.now(); });
    function buildStatic(r) {
        var key = r.map + '|' + tier(); if (staticKey === key && staticCv) return staticCv;
        var m = (typeof MAP_DATA !== 'undefined') && (MAP_DATA[r.map] || MAP_DATA['epic_map']); if (!m) return null;
        var size = m.size, N = clamp(Math.round(size / 8), 256, 768), k = N / size, c = document.createElement('canvas'); c.width = c.height = N; var x = c.getContext('2d');
        x.fillStyle = '#030712'; x.fillRect(0, 0, N, N);
        var shp = window.MapObj && MapObj.hasShape && MapObj.hasShape(m);
        if (shp) { x.save(); x.beginPath(); m.shape.forEach(function (p, i) { if (i) x.lineTo(p.x * k, p.y * k); else x.moveTo(p.x * k, p.y * k); }); x.closePath(); x.clip(); }
        x.fillStyle = '#0f1a2e'; x.fillRect(0, 0, N, N);
        x.strokeStyle = 'rgba(148,163,184,.07)'; x.lineWidth = 1; for (var gl = 0; gl <= size; gl += 500) { x.beginPath(); x.moveTo(gl * k, 0); x.lineTo(gl * k, N); x.stroke(); x.beginPath(); x.moveTo(0, gl * k); x.lineTo(N, gl * k); x.stroke(); }
        (m.solids || []).forEach(function (o) {
            var t = o.type || ''; if (!t || t.indexOf('spawn') === 0 || t === 'prop_floor' || t === 'prop_roof' || t === 'prop_bush') return;
            if (t === 'line') { if (!o.points || !o.points.length) return; x.strokeStyle = '#3b4a66'; x.lineWidth = Math.max(1, (o.width || 10) * k); x.lineCap = 'round'; x.beginPath(); o.points.forEach(function (p, i) { if (i) x.lineTo(p.x * k, p.y * k); else x.moveTo(p.x * k, p.y * k); }); x.stroke(); return; }
            if (t.indexOf('water') >= 0) { x.fillStyle = '#0c4a6e'; x.fillRect(o.x * k, o.y * k, (o.w || 50) * k, (o.h || 50) * k); return; }
            if (t === 'tree') { x.fillStyle = '#14532d'; x.beginPath(); x.arc(o.x * k, o.y * k, Math.max(1.5, (o.r || 30) * k), 0, Math.PI * 2); x.fill(); return; }
            if (o.w && o.h) { x.fillStyle = '#3d4d6b'; x.fillRect(o.x * k, o.y * k, Math.max(1, o.w * k), Math.max(1, o.h * k)); return; }
            if (o.r) { x.fillStyle = '#3d4d6b'; x.beginPath(); x.arc(o.x * k, o.y * k, Math.max(1, o.r * k), 0, Math.PI * 2); x.fill(); }
        });
        if (shp) { x.restore(); x.strokeStyle = 'rgba(96,165,250,.45)'; x.lineWidth = 2; x.beginPath(); m.shape.forEach(function (p, i) { if (i) x.lineTo(p.x * k, p.y * k); else x.moveTo(p.x * k, p.y * k); }); x.closePath(); x.stroke(); }
        staticCv = c; staticCv._k = k; staticCv._size = size; staticKey = key; return c;
    }
    function drawMini() {
        var r = room(); if (!r || !g) return; var st0 = buildStatic(r); if (!st0) return;
        var round = touch(), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
        var dpr = Math.min(2, tier() === 'low' ? 1 : (window.devicePixelRatio || 1)), pw = Math.round(W * dpr), ph = Math.round(H * dpr);
        if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
        var size = st0._size, k = st0._k, now = Date.now(), alive = myLocalTank.hp > 0;
        var me = alive ? myLocalTank : (typeof camera !== 'undefined' ? camera : { x: size / 2, y: size / 2 });
        var span = big ? size : Math.min(size, 2200), x0 = clamp(me.x - span / 2, 0, Math.max(0, size - span)), y0 = clamp(me.y - span / 2, 0, Math.max(0, size - span)), sc = W / span;
        var X = function (x) { return (x - x0) * sc; }, Y = function (y) { return (y - y0) * sc; };
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.save();
        if (round) { g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); g.clip(); }
        g.drawImage(st0, x0 * k, y0 * k, span * k, span * k, 0, 0, W, H);
        var lo = tier() === 'low', R = W / 2;
        // точка поза видимою областю — притискаємо до краю (кола / квадрата), щоб завжди було видно напрям
        var edge = function (x, y, pad) { var px = X(x), py = Y(y); if (round) { var dx = px - R, dy = py - R, l = Math.hypot(dx, dy), lim = R - pad; if (l > lim) { px = R + dx / l * lim; py = R + dy / l * lim; } } else { px = clamp(px, pad, W - pad); py = clamp(py, pad, H - pad); } return [px, py]; };
        var dot = function (x, y, rad, col, ring, pad) { var p = edge(x, y, pad || rad + 2); g.fillStyle = col; g.beginPath(); g.arc(p[0], p[1], rad, 0, Math.PI * 2); g.fill(); if (ring) { g.lineWidth = 1.5; g.strokeStyle = ring; g.stroke(); } return p; };
        var md = window.ModesFX && ModesFX.md, mode = r.mode;
        if (md && md.m === mode) {
            if (mode === 'battle_royale' && md.z) {
                var zx = X(md.z.x), zy = Y(md.z.y);
                g.fillStyle = 'rgba(239,68,68,.16)'; g.beginPath(); g.rect(0, 0, W, H); g.arc(zx, zy, Math.max(0, md.z.r * sc), 0, Math.PI * 2, true); g.fill();
                g.strokeStyle = 'rgba(147,197,253,.95)'; g.lineWidth = 1.6; g.beginPath(); g.arc(zx, zy, Math.max(0, md.z.r * sc), 0, Math.PI * 2); g.stroke();
                if (md.z.nr && md.z.nr < md.z.r) { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(zx, zy, md.z.nr * sc, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
                if (md.dr && md.dr.st !== 'done') { var pp = 0.6 + 0.4 * Math.sin(now / 160); var p1 = dot(md.dr.x, md.dr.y, 4 + pp * 2, md.dr.st === 'open' ? '#ff3b6b' : '#f59e0b', '#fff', 7); g.font = '9px Arial'; g.textAlign = 'center'; g.fillText('📦', p1[0], p1[1] - 9); }
            } else if (mode === 'convoy' && md.cv) {
                if (md.A && md.B) { g.setLineDash([3, 4]); g.strokeStyle = 'rgba(56,189,248,.5)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(X(md.cv.x), Y(md.cv.y)); g.lineTo(X(md.B.x), Y(md.B.y)); g.stroke(); g.setLineDash([]); dot(md.B.x, md.B.y, 4, '#facc15', '#fff', 6); }
                g.save(); var cp = edge(md.cv.x, md.cv.y, 7); g.translate(cp[0], cp[1]); g.rotate(md.cv.a || 0); g.fillStyle = '#38bdf8'; g.strokeStyle = '#fff'; g.lineWidth = 1; g.fillRect(-6, -3.5, 12, 7); g.strokeRect(-6, -3.5, 12, 7); g.restore();
            } else if (mode === 'base_defense' && md.c) {
                var cc = edge(md.c.x, md.c.y, 7); g.save(); g.translate(cc[0], cc[1]); g.rotate(Math.PI / 4); g.fillStyle = '#22d3ee'; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.fillRect(-4.5, -4.5, 9, 9); g.strokeRect(-4.5, -4.5, 9, 9); g.restore();
            } else if (mode === 'capture_points' && md.pts) {
                md.pts.forEach(function (pt, i) { var col = pt.o ? (TCOL[pt.o] || '#fff') : 'rgba(148,163,184,.9)'; var p2 = edge(pt.x, pt.y, 7); g.fillStyle = col; g.globalAlpha = 0.35; g.beginPath(); g.arc(p2[0], p2[1], Math.max(4, pt.r * sc), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; g.strokeStyle = col; g.lineWidth = 1.4; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 8px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String.fromCharCode(65 + i), p2[0], p2[1]); });
            }
        }
        miniB(g, X, Y, sc, dot, edge, now);      // події на мапі, ціль-лідер
        // гравці: союзники зелені; вороги — лише в детматчі / командному / «Цілі» і лише 2 с після пострілу
        var myTeam = myLocalTank.team, pve = MI && MI.isPve(mode), tgt = md && md.m === 'bounty' ? md.tg : null;
        for (var id in opponents) {
            var o = opponents[id], sn = r.players[id]; if (!sn || !(o.hp > 0) || o.isDisguised) continue;
            var ally = pve || (TEAM_MODES[mode] && sn.team && sn.team === myTeam);
            if (ally) { dot(o.x, o.y, 3.2, '#4ade80', 'rgba(2,6,23,.8)'); continue; }
            if (id === tgt) { var tp = dot(o.x, o.y, 4, '#facc15', '#fff', 7); g.font = '9px Arial'; g.textAlign = 'center'; g.fillText('👑', tp[0], tp[1] - 8); continue; }
            if (ENEMY_MODES[mode]) { var age = now - (shots[id] || 0); if (age < 2000) { g.globalAlpha = 1 - age / 2000; dot(o.x, o.y, 3.6, '#ef4444', '#fecaca'); g.globalAlpha = 1; } }
        }
        // сам гравець: стрілка в напрямку руху
        if (alive) {
            var mp = edge(myLocalTank.x, myLocalTank.y, 8), col = myCol();
            if (!lo) { var pr = (now % 1400) / 1400; g.strokeStyle = col; g.globalAlpha = 0.6 * (1 - pr); g.lineWidth = 1.5; g.beginPath(); g.arc(mp[0], mp[1], 4 + pr * 9, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
            g.save(); g.translate(mp[0], mp[1]); g.rotate(myLocalTank.bodyAngle); g.beginPath(); g.moveTo(7, 0); g.lineTo(-5, -4.5); g.lineTo(-2.5, 0); g.lineTo(-5, 4.5); g.closePath();
            g.fillStyle = col; g.fill(); g.lineWidth = 1.3; g.strokeStyle = '#fff'; g.stroke(); g.restore();
        }
        // промінь радара (кругла міні-мапа)
        if (round && !lo) { var ang = (now / 1800) % 1 * Math.PI * 2; g.save(); g.translate(R, R); g.rotate(ang); g.fillStyle = 'rgba(96,165,250,.13)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -0.5, 0); g.closePath(); g.fill(); g.restore(); }
        g.restore();
    }

    // ================= ОНОВЛЕННЯ HUD =================
    var lastHp = -1, lastHpMax = -1, shown = false, hpLag = 1;
    function reloadInfo(now) {
        var r = room(), cd;
        if (r.mode === 'prophunt') { if (myLocalTank.team !== 'hunter') return null; cd = 1000; }
        else { var fC = window.BUFFS && (BUFFS[myLocalTank.buff] || BUFFS['none']); cd = fC && fC.cd < 500 ? fC.cd : (window.getReloadTime ? getReloadTime() : 2000); }
        var el = typeof lastShootTime !== 'undefined' ? now - lastShootTime : cd; return Math.max(0, Math.min(1, el / cd));
    }
    function tick() {
        var on = inGame();
        if (on !== shown) { shown = on; root.classList.toggle('bh-on', on); if (on) { build(); applyScale(); lastHp = -1; } }
        if (!on) { if (mm) mm.classList.add('hidden'); if (cap) cap.classList.add('hidden'); if (dashBtn) dashBtn.classList.remove('show'); return; }
        if (!built) build();
        var now = Date.now(), pn = performance.now(), t = touch();
        if (bigUntil && now > bigUntil) setBig(false, 0);
        mm.classList.toggle('hidden', !mmOn && !t); mm.classList.toggle('off', !mmOn);
        // на телефоні без міні-мапи дуга HP все одно потрібна: лишаємо коло, але без мапи
        if (t && !mmOn) { mm.classList.remove('off'); cv.style.visibility = 'hidden'; } else cv.style.visibility = '';
        cap.classList.toggle('hidden', t);
        dashBtn.classList.toggle('show', t && canDash());
        // HP
        var mHp = Math.round((typeof MAX_HP !== 'undefined' ? MAX_HP : 500) * (window.GameData ? GameData.statMult(myEquipped, 'hp') : 1) * (window.ClassFX ? ClassFX.hpMul() : 1)), hp = Math.max(0, Math.ceil(myLocalTank.hp || 0)), f = mHp ? Math.min(1, hp / mHp) : 0;
        var cls = f < 0.3 ? 'low' : f < 0.6 ? 'mid' : '';
        if (hp !== lastHp || mHp !== lastHpMax) {
            hpLag = lastHp < 0 ? f : hpLag;
            lastHp = hp; lastHpMax = mHp;
            var hf = $('bh-hpf'); if (hf) { hf.style.transform = 'scaleX(' + f.toFixed(3) + ')'; hf.className = cls; }
            var hs = $('bh-hps'); if (hs) hs.style.transform = 'scaleX(' + f.toFixed(3) + ')';
            var ht = $('bh-hpt'); if (ht) ht.innerHTML = hp + '<small>/' + mHp + '</small>';
            var ha = arc && arc.querySelector('.hp'); if (ha) { ha.style.strokeDashoffset = String(100 - f * 100); ha.setAttribute('class', 'hp ' + cls); }
            var hm = $('bh-hpm'); if (hm) hm.textContent = hp;
        }
        // перезарядка / ривок / бонус
        var rl = reloadInfo(pn), cf = $('bh-cdf'), ca = arc && arc.querySelector('.cd'), hOn = heatOn();
        heatTick(pn, 0.05);
        if (hOn && rl !== null) {      // швидкострільні: замість перезарядки — шкала перегріву
            var hh = heat.h / 100, lk = pn < heat.lock;
            if (cf) { cf.parentElement.style.visibility = ''; cf.style.transform = 'scaleX(' + hh.toFixed(3) + ')'; cf.className = 'heat' + (lk ? ' lock' : ''); }
            if (ca) { ca.style.visibility = ''; ca.style.strokeDashoffset = String(100 - hh * 100); ca.setAttribute('class', 'cd heat' + (lk ? ' lock' : '')); ca.style.stroke = lk ? '#ef4444' : hh > 0.7 ? '#f97316' : hh > 0.4 ? '#facc15' : '#38bdf8'; }
        } else if (rl === null) { if (cf) cf.parentElement.style.visibility = 'hidden'; if (ca) ca.style.visibility = 'hidden'; }
        else {
            if (cf && cf.className.indexOf('heat') >= 0) cf.className = ''; if (ca) ca.style.stroke = '';
            if (cf) { cf.parentElement.style.visibility = ''; cf.style.transform = 'scaleX(' + rl.toFixed(3) + ')'; cf.classList.toggle('full', rl >= 1); }
            if (ca) { ca.style.visibility = ''; ca.style.strokeDashoffset = String(100 - rl * 100); ca.setAttribute('class', rl >= 1 ? 'cd full' : 'cd'); }
        }
        var dp = pn >= dash.cdEnd ? 1 : 1 - (dash.cdEnd - pn) / DASH_CD, di = $('bh-dashi');
        if (di) { di.style.setProperty('--p', dp.toFixed(3)); di.classList.toggle('cd', dp < 1); }
        dashBtn.style.setProperty('--p', dp.toFixed(3)); dashBtn.classList.toggle('cd', dp < 1);
        var bf = $('bh-buff');
        if (bf) { if (myLocalTank.buff && myLocalTank.buffProgress > 0) { bf.classList.remove('off'); var ic = (window.BUFF_ICONS && BUFF_ICONS[myLocalTank.buff]) || '✨'; if (bf._i !== ic) { bf._i = ic; bf.textContent = ic; } bf.style.setProperty('--p', myLocalTank.buffProgress.toFixed(3)); } else bf.classList.add('off'); }
        paintBoards();
        // міні-мапа: частота за рівнем графіки
        var every = tier() === 'low' ? 250 : tier() === 'medium' ? 125 : 66;
        if (mmOn && now - lastDraw >= every) { lastDraw = now; try { drawMini(); } catch (e) { console.error('minimap', e); } }
    }
    setInterval(tick, 50);
    window.addEventListener('resize', function () { applyScale(); lastDraw = 0; });

    // =====================================================================
    //  ЧАСТИНА Б: рикошет, перегрів, добивання, події на мапі, еліт-зомбі, ціль-лідер
    // =====================================================================
    var cssB = '' +
        '.bh-cd b.heat{background:linear-gradient(90deg,#38bdf8,#facc15 55%,#ef4444);box-shadow:0 0 8px rgba(249,115,22,.6)}.bh-cd b.lock{animation:bhPulse .35s infinite}' +
        '#bh-arc .cd.lock{animation:bhPulse .35s infinite}' +
        '#bh-evb{position:absolute;left:50%;top:16%;z-index:46;transform:translate(-50%,-12px);display:flex;align-items:center;gap:12px;max-width:92vw;padding:9px 18px 9px 12px;border-radius:16px;background:rgba(8,13,30,.92);border:1.5px solid var(--ec,#60a5fa);box-shadow:0 0 26px color-mix(in srgb,var(--ec,#60a5fa) 55%,transparent);opacity:0;pointer-events:none;transition:opacity .3s,transform .3s}' +
        '#bh-evb.show{opacity:1;transform:translate(-50%,0)}#bh-evb i{font-style:normal;font-size:28px;line-height:1}#bh-evb b{display:block;font:400 16px "Russo One",Arial;letter-spacing:.04em;color:#fff}#bh-evb small{display:block;font-size:11px;font-weight:700;color:#cbd5e1}' +
        'html.gfx-low #bh-evb{box-shadow:none}' +
        '#bh-fog{position:absolute;inset:0;z-index:14;pointer-events:none;opacity:0;transition:opacity 1.2s}#bh-fog.on{opacity:1}' +
        '@media (orientation:landscape) and (max-height:430px){#bh-evb{top:20%;padding:6px 12px 6px 9px}#bh-evb i{font-size:20px}#bh-evb b{font-size:12px}#bh-evb small{font-size:9px}}';
    var seB = document.createElement('style'); seB.id = 'hud-css-b'; seB.textContent = cssB; document.head.appendChild(seB);

    // ---------- звуки частини Б ----------
    SND.ric = function (a, d, t) { osc(a, d, 'triangle', 2400, 1400, t, 0.14, 0.09); osc(a, d, 'sine', 3800, 2600, t, 0.1, 0.05); noise(a, d, 'highpass', 4000, 6000, t, 0.06, 0.08, 1); };
    SND.hiss = function (a, d, t) { noise(a, d, 'highpass', 2600, 900, t, 1.1, 0.28, 0.8); osc(a, d, 'square', 220, 110, t, 0.12, 0.05); };
    SND.cool = function (a, d, t) { osc(a, d, 'sine', 1320, 1320, t, 0.12, 0.08); osc(a, d, 'sine', 1760, 1760, t + 0.08, 0.16, 0.07); };
    SND.fin = function (a, d, t) { osc(a, d, 'sine', 120, 40, t, 0.6, 0.35); noise(a, d, 'lowpass', 3000, 200, t, 0.5, 0.35, 0.7); [523, 784, 1047].forEach(function (f, i) { osc(a, d, 'triangle', f, f, t + 0.05 + i * 0.05, 0.35, 0.06); }); };
    SND.siren = function (a, d, t) { for (var i = 0; i < 3; i++) { osc(a, d, 'square', 620, 880, t + i * 0.5, 0.25, 0.05); osc(a, d, 'square', 880, 620, t + i * 0.5 + 0.25, 0.25, 0.05); } };
    SND.drone = function (a, d, t) { osc(a, d, 'sawtooth', 95, 110, t, 1.6, 0.05); osc(a, d, 'sawtooth', 190, 205, t, 1.6, 0.03); noise(a, d, 'bandpass', 600, 800, t, 1.6, 0.06, 2); };
    SND.fogs = function (a, d, t) { noise(a, d, 'lowpass', 400, 1600, t, 1.8, 0.18, 0.6); osc(a, d, 'sine', 110, 82, t, 1.8, 0.08); };
    SND.boom2 = function (a, d, t) { noise(a, d, 'lowpass', 1600, 80, t, 0.7, 0.55, 0.7); osc(a, d, 'sine', 90, 34, t, 0.55, 0.35); };
    SND.clank = function (a, d, t) { osc(a, d, 'square', 900, 600, t, 0.08, 0.06); noise(a, d, 'bandpass', 3000, 2000, t, 0.06, 0.1, 4); };
    SND.split = function (a, d, t) { noise(a, d, 'bandpass', 1800, 400, t, 0.35, 0.25, 2); osc(a, d, 'sine', 600, 200, t, 0.3, 0.08); };
    SND.chain = function (a, d, t) { for (var i = 0; i < 5; i++) noise(a, d, 'bandpass', 2500 + i * 300, 2200, t + i * 0.05, 0.05, 0.12, 6); };
    SND.crown = function (a, d, t) { [659, 784, 988, 1319].forEach(function (f, i) { osc(a, d, 'triangle', f, f, t + i * 0.07, 0.4, 0.07); }); };

    // ---------- банер подій ----------
    var evbEl = null, evbT = null;
    function evBanner(icon, title, sub, col) {
        var gs = $('game-screen'); if (!gs) return;
        if (!evbEl) { evbEl = document.createElement('div'); evbEl.id = 'bh-evb'; evbEl.innerHTML = '<i></i><div><b></b><small></small></div>'; gs.appendChild(evbEl); }
        evbEl.style.setProperty('--ec', col); evbEl.querySelector('i').textContent = icon; evbEl.querySelector('b').textContent = tt(title); evbEl.querySelector('small').textContent = sub ? tt(sub) : '';
        evbEl.classList.add('show'); clearTimeout(evbT); evbT = setTimeout(function () { evbEl.classList.remove('show'); }, 3600);
    }

    // ---------- рикошет ----------
    var lastRic = 0;
    function ricochet(x, y) {
        var now = Date.now(); if (now - lastRic > 70) { lastRic = now; play('ric', x, y); }
        if (typeof createExplosion === 'function' && tier() !== 'low') createExplosion(x, y, 6, '#fde68a');
    }

    // ---------- перегрів (Штурмовик, мінігун, швидкий вогонь) ----------
    var heat = { h: 0, lock: 0, last: 0, wasLock: false };
    function heatOn() {
        if (!inGame() || typeof myLocalTank === 'undefined') return false; var b = myLocalTank.buff; if (b === 'minigun' || b === 'fast') return true;
        var r = room(), me = r && r.players[myId]; return !!(window.ClassFX && ClassFX.active() && me && me.cls === 'assault');
    }
    function heatLocked(now) { return heatOn() && now < heat.lock; }
    function heatShot(now) {
        if (!heatOn()) return; var b = myLocalTank.buff, per = (b === 'minigun' || b === 'fast') ? 2.6 : 7;
        heat.h = Math.min(100, heat.h + per); heat.last = now;
        if (heat.h >= 100 && now >= heat.lock) { heat.lock = now + 2000; heat.wasLock = true; play('hiss'); }
    }
    function heatTick(pn, dt) {
        if (pn < heat.lock) heat.h = 100 * (heat.lock - pn) / 2000;
        else { if (heat.wasLock) { heat.wasLock = false; heat.h = 0; play('cool'); } else if (pn - heat.last > 350) heat.h = Math.max(0, heat.h - 45 * dt); }
        if (!heatOn() && heat.h > 0 && pn >= heat.lock) heat.h = 0;
    }

    // ---------- добивання ----------
    var finFx = [];
    socket.on('finisher', function (d) {
        if (!d || !inGame()) return; finFx.push({ x: d.x, y: d.y, t: Date.now() });
        if (typeof createExplosion === 'function') createExplosion(d.x, d.y, tier() === 'low' ? 15 : 50, '#f43f5e');
        play('fin', d.x, d.y); if (d.by === myId) killFx(true);
    });
    function enemyMax(id) { var r = room(), sn = r && r.players[id]; return Math.round((typeof MAX_HP !== 'undefined' ? MAX_HP : 500) * (sn && window.GameData ? GameData.statMult(sn.equipped, 'hp') : 1)); }
    function finishable(now) {      // список цілей, яких можна добити (для черепа 💀)
        var out = [], r = room(); if (!r || myLocalTank.hp <= 0 || r.mode === 'prophunt') return out;
        var pve = MI && MI.isPve(r.mode);
        if (pve) {
            for (var zid in zombies) { var z = zombies[zid], ZT = window.zType ? zType(z.type) : null; if (!ZT || ZT.isBoss || !(ZT.elite || ZT.hp >= 90)) continue; if (z.hp / Math.max(1, z.maxHp || ZT.hp) < 0.15 && Math.hypot(z.x - myLocalTank.x, z.y - myLocalTank.y) <= 150) out.push(z); }
        } else {
            for (var id in opponents) {
                var o = opponents[id], sn = r.players[id]; if (!sn || !(o.hp > 0) || o.isDisguised) continue;
                if (TEAM_MODES[r.mode] && sn.team && sn.team === myLocalTank.team) continue;
                if (o.hp / enemyMax(id) < 0.15 && Math.hypot(o.x - myLocalTank.x, o.y - myLocalTank.y) <= 150) out.push(o);
            }
        }
        return out;
    }

    // ---------- події на мапі ----------
    var ev = { art: null, drone: null, fogUntil: 0 }, fogEl = null;
    socket.on('mapEv', function (d) {
        if (!d || !inGame()) return; var now = Date.now();
        if (d.k === 'art') { ev.art = { x: d.x, y: d.y, r: d.r, fire: now + (d.warn || 3000), end: now + (d.warn || 3000) + 2600, t0: now }; evBanner('🎯', 'Артилерійський удар!', 'Тікай із червоної зони', '#ef4444'); play('siren'); }
        else if (d.k === 'drone') { ev.drone = { x0: d.x0, y0: d.y0, x1: d.x1, y1: d.y1, t0: now, dur: d.dur || 8000, drops: d.drops || [] }; evBanner('🚁', 'Дрон із припасами!', 'Скриньки з бонусами — встигни першим', '#38bdf8'); play('drone'); }
        else if (d.k === 'fog') { ev.fogUntil = now + (d.dur || 20000); evBanner('🌫️', 'Туман!', '20 секунд видно лише поруч', '#94a3b8'); play('fogs'); }
    });
    socket.on('mapEvEnd', function (d) { if (!d) return; if (d.k === 'art') ev.art = null; else if (d.k === 'drone') ev.drone = null; else if (d.k === 'fog') ev.fogUntil = 0; });
    socket.on('mapShell', function (d) {
        if (!d || !inGame()) return;
        if (typeof createExplosion === 'function') createExplosion(d.x, d.y, tier() === 'low' ? 12 : 40, '#f97316');
        finFx.push({ x: d.x, y: d.y, t: Date.now(), c: '249,115,22', r: 95 });
        play('boom2', d.x, d.y);
        if (typeof shakeTime !== 'undefined' && typeof camera !== 'undefined' && Math.hypot(d.x - camera.x, d.y - camera.y) < 450) shakeTime = Math.max(shakeTime, 0.25);
    });
    function fogTick(now) {
        var gs = $('game-screen'); if (!gs) return; if (!fogEl) { fogEl = document.createElement('div'); fogEl.id = 'bh-fog'; gs.appendChild(fogEl); }
        var on = inGame() && now < ev.fogUntil; fogEl.classList.toggle('on', on); if (!on) return;
        var R = Math.round(260 * (typeof VS !== 'undefined' ? VS : 1)), bg = 'radial-gradient(circle at 50% 50%, rgba(2,6,23,0) ' + R + 'px, rgba(15,23,42,.88) ' + Math.round(R * 1.7) + 'px, rgba(2,6,23,.97) ' + Math.round(R * 2.6) + 'px)';
        if (fogEl._bg !== bg) { fogEl._bg = bg; fogEl.style.background = bg; }
    }
    setInterval(function () { fogTick(Date.now()); }, 200);

    // ---------- еліт-зомбі ----------
    var EICON = { puller: '🪝', shielder: '🛡️', splitter: '🧬' };
    var chains = [], pull = null;
    socket.on('chain', function (d) {
        if (!d) return; var now = Date.now(); chains.push({ zid: d.zid, pid: d.pid, until: now + (d.dur || 900) });
        if (d.pid === myId) { pull = { zid: d.zid, until: now + (d.dur || 900) - 150 }; play('chain'); }
    });
    socket.on('chainBreak', function (d) { if (!d) return; chains = chains.filter(function (c) { return c.zid !== d.zid; }); if (pull && pull.zid === d.zid) pull = null; });
    socket.on('zSplit', function (d) { if (!d || !inGame()) return; finFx.push({ x: d.x, y: d.y, t: Date.now(), c: '244,63,94', r: 60 }); if (typeof createExplosion === 'function') createExplosion(d.x, d.y, tier() === 'low' ? 8 : 26, '#fb7185'); play('split', d.x, d.y); });
    function pullStep(dt, rad) {
        if (!pull) return; var now = Date.now(); if (now > pull.until || myLocalTank.hp <= 0) { pull = null; return; }
        var z = zombies[pull.zid]; if (!z) { pull = null; return; }
        var dx = z.x - myLocalTank.x, dy = z.y - myLocalTank.y, l = Math.hypot(dx, dy); if (l < 75) { pull = null; return; }
        var sp = 470 * dt, nx = myLocalTank.x + dx / l * sp, ny = myLocalTank.y + dy / l * sp;
        if (!checkCollision(nx, myLocalTank.y, rad, true, false)) myLocalTank.x = nx;
        if (!checkCollision(myLocalTank.x, ny, rad, true, false)) myLocalTank.y = ny;
    }
    // напрям щита: на найближчого живого гравця (однаково рахують усі клієнти)
    function shieldDir(z) {
        var best = null, bd = Infinity, cands = [];
        if (myLocalTank.hp > 0) cands.push(myLocalTank); for (var id in opponents) if (opponents[id].hp > 0) cands.push(opponents[id]);
        for (var i = 0; i < cands.length; i++) { var d = Math.hypot(cands[i].x - z.x, cands[i].y - z.y); if (d < bd) { bd = d; best = cands[i]; } }
        return best ? Math.atan2(best.y - z.y, best.x - z.x) : (z.ang || 0);
    }
    var lastClank = 0;
    function shieldBlock(b) {
        for (var zid in zombies) {
            var z = zombies[zid]; if (z.type !== 'shielder') continue;
            var R0 = ((window.zType ? zType('shielder').radius : 24) * 1.05) + 18, dx = b.x - z.x, dy = b.y - z.y, d = Math.hypot(dx, dy);
            if (d > R0 + 8 || d < R0 - 14) continue;
            if (Math.abs(angDiff(Math.atan2(dy, dx), shieldDir(z))) < 1.22) {
                var now = Date.now(); if (now - lastClank > 90) { lastClank = now; play('clank', b.x, b.y); }
                if (typeof createExplosion === 'function' && tier() !== 'low') createExplosion(b.x, b.y, 5, '#7dd3fc');
                return true;
            }
        }
        return false;
    }

    // ---------- ціль-лідер ----------
    var leaderId = null;
    socket.on('leader', function (d) { leaderId = d && d.id || null; if (leaderId && leaderId === myId) { evBanner('👑', 'Ти — ціль!', 'За твоє знищення ворог отримає подвійну нагороду', '#facc15'); play('crown'); } });
    socket.on('leaderDown', function (d) { if (!d || !inGame()) return; leaderId = null; evBanner('👑', 'Лідера повалено!', (d.by || '') + ' → ' + (d.tg || ''), '#facc15'); play('crown'); });
    socket.on('gameStarting', function () { ev = { art: null, drone: null, fogUntil: 0 }; chains = []; pull = null; leaderId = null; heat.h = 0; heat.lock = 0; heat.wasLock = false; finFx = []; });

    // ---------- малювання ----------
    function groundB(c, view, now) {
        var A = ev.art; if (A && now < A.end) {      // червона зона артудару з відліком
            var pre = now < A.fire, k = pre ? (now - A.t0) / Math.max(1, A.fire - A.t0) : 1, lo = tier() === 'low';
            c.save(); c.translate(A.x, A.y);
            c.fillStyle = 'rgba(239,68,68,' + (pre ? 0.1 + 0.1 * Math.sin(now / 90) : 0.16) + ')'; c.beginPath(); c.arc(0, 0, A.r, 0, Math.PI * 2); c.fill();
            if (!lo) { c.fillStyle = 'rgba(239,68,68,.22)'; c.beginPath(); c.arc(0, 0, Math.max(0, A.r * k), 0, Math.PI * 2); c.fill(); }
            c.strokeStyle = 'rgba(248,113,113,.95)'; c.lineWidth = 4; c.setLineDash([18, 12]); c.lineDashOffset = -now / 25; c.beginPath(); c.arc(0, 0, A.r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
            if (pre) { c.font = '44px "Russo One", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 6; c.strokeStyle = 'rgba(2,6,23,.8)'; var s = String(Math.ceil((A.fire - now) / 1000)); c.strokeText(s, 0, 0); c.fillStyle = '#fecaca'; c.fillText(s, 0, 0); }
            c.restore();
        }
        var Dn = ev.drone; if (Dn) {      // тінь дрона
            var f = (now - Dn.t0) / Dn.dur; if (f >= 0 && f <= 1) { var x = Dn.x0 + (Dn.x1 - Dn.x0) * f, y = Dn.y0 + (Dn.y1 - Dn.y0) * f; c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 40, y + 60, 46, 28, 0, 0, Math.PI * 2); c.fill(); }
        }
    }
    function topB(c, view, now) {
        var lo = tier() === 'low', hi = tier() === 'high', inV = function (x, y, m) { return x > view.x0 - m && x < view.x1 + m && y > view.y0 - m && y < view.y1 + m; };
        // еліт-зомбі: аура, значок, щит
        for (var zid in zombies) {
            var z = zombies[zid], ZT = window.zType ? zType(z.type) : null; if (!ZT || !ZT.elite || !inV(z.x, z.y, 80)) continue;
            var R = ZT.radius * 1.3, col = ZT.color || '#fff';
            c.save(); c.translate(z.x, z.y);
            if (!lo) { c.globalAlpha = 0.5 + 0.25 * Math.sin(now / 200 + z.x); c.strokeStyle = col; c.lineWidth = 3; if (hi) { c.shadowColor = col; c.shadowBlur = 12; } c.beginPath(); c.arc(0, 0, R + 6, 0, Math.PI * 2); c.stroke(); c.shadowBlur = 0; c.globalAlpha = 1; }
            if (z.type === 'shielder') {
                var a = shieldDir(z), R0 = ZT.radius * 1.05 + 18; if (hi) { c.shadowColor = '#38bdf8'; c.shadowBlur = 14; }
                c.strokeStyle = 'rgba(125,211,252,.95)'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, R0, a - 1.22, a + 1.22); c.stroke();
                c.strokeStyle = 'rgba(186,230,253,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, R0 + 6, a - 1.1, a + 1.1); c.stroke(); c.shadowBlur = 0;
            }
            c.font = '16px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(EICON[z.type] || '⭐', 0, -R - 16);
            c.restore();
        }
        // ланцюги тягуна
        for (var i = chains.length - 1; i >= 0; i--) {
            var ch = chains[i]; if (now > ch.until) { chains.splice(i, 1); continue; }
            var zz = zombies[ch.zid], tp = ch.pid === myId ? (myLocalTank.hp > 0 ? myLocalTank : null) : opponents[ch.pid]; if (!zz || !tp) continue;
            var dx = tp.x - zz.x, dy = tp.y - zz.y, L = Math.hypot(dx, dy), n = Math.max(4, Math.floor(L / 22));
            c.save(); if (hi) { c.shadowColor = '#a855f7'; c.shadowBlur = 10; } c.strokeStyle = '#c084fc'; c.lineWidth = 3; c.beginPath(); c.moveTo(zz.x, zz.y);
            for (var s = 1; s <= n; s++) { var q = s / n, j = (s % 2 ? 1 : -1) * 5; c.lineTo(zz.x + dx * q - dy / L * j, zz.y + dy * q + dx / L * j); }
            c.stroke(); c.restore();
        }
        // череп над тими, кого можна добити
        var fl = finishable(now);
        for (var f = 0; f < fl.length; f++) { var o = fl[f], sy = o.y - 52 - 4 * Math.sin(now / 120); c.save(); c.globalAlpha = 0.85 + 0.15 * Math.sin(now / 100); c.font = '22px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; if (hi) { c.shadowColor = '#ef4444'; c.shadowBlur = 14; } c.fillText('💀', o.x, sy); c.restore(); }
        // ефекти добивання / вибухів подій
        for (var e = finFx.length - 1; e >= 0; e--) {
            var F = finFx[e], qq = (now - F.t) / 550; if (qq >= 1) { finFx.splice(e, 1); continue; }
            c.save(); c.strokeStyle = 'rgba(' + (F.c || '244,63,94') + ',' + (1 - qq) + ')'; c.lineWidth = 6 * (1 - qq) + 1; c.beginPath(); c.arc(F.x, F.y, Math.max(0, (F.r || 110) * qq), 0, Math.PI * 2); c.stroke(); c.restore();
        }
        // корона цілі-лідера
        if (leaderId) {
            var lp = leaderId === myId ? (myLocalTank.hp > 0 ? myLocalTank : null) : opponents[leaderId];
            if (lp && lp.hp > 0 && inV(lp.x, lp.y, 80)) {
                var cy = lp.y - 66 + 3 * Math.sin(now / 200); c.save(); c.translate(lp.x, cy); if (!lo) { c.shadowColor = '#facc15'; c.shadowBlur = hi ? 16 : 0; }
                c.fillStyle = '#facc15'; c.strokeStyle = '#78350f'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 7); c.lineTo(-16, -7); c.lineTo(-7, 0); c.lineTo(0, -10); c.lineTo(7, 0); c.lineTo(16, -7); c.lineTo(14, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
            }
        }
        // дрон із припасами
        var Dn = ev.drone; if (Dn) {
            var fd = (now - Dn.t0) / Dn.dur; if (fd >= 0 && fd <= 1) {
                var x = Dn.x0 + (Dn.x1 - Dn.x0) * fd, y = Dn.y0 + (Dn.y1 - Dn.y0) * fd, an = Math.atan2(Dn.y1 - Dn.y0, Dn.x1 - Dn.x0);
                c.save(); c.translate(x, y); c.rotate(an); c.fillStyle = '#1e293b'; c.strokeStyle = '#38bdf8'; c.lineWidth = 3;
                c.fillRect(-26, -12, 52, 24); c.strokeRect(-26, -12, 52, 24);
                for (var rr = 0; rr < 4; rr++) { var px = rr < 2 ? -30 : 30, py = rr % 2 ? -22 : 22; c.strokeStyle = 'rgba(148,163,184,.9)'; c.beginPath(); c.moveTo(px * 0.6, py * 0.4); c.lineTo(px, py); c.stroke(); c.save(); c.translate(px, py); c.rotate(now / 30); c.fillStyle = 'rgba(203,213,225,.35)'; c.fillRect(-14, -2, 28, 4); c.restore(); }
                if (!lo) { c.fillStyle = (Math.floor(now / 250) % 2) ? '#ef4444' : '#22c55e'; c.beginPath(); c.arc(24, 0, 3, 0, Math.PI * 2); c.fill(); }
                c.restore();
            }
        }
        // перегрів: розпечений ствол і пара
        if (heatOn() && myLocalTank.hp > 0 && heat.h > 55) {
            var ta = myLocalTank.turretAngle, bx = myLocalTank.x + Math.cos(ta) * 40, by = myLocalTank.y + Math.sin(ta) * 40, hk = (heat.h - 55) / 45;
            c.save(); c.globalAlpha = 0.35 + 0.5 * hk; c.fillStyle = '#ef4444'; if (hi) { c.shadowColor = '#f97316'; c.shadowBlur = 18; } c.beginPath(); c.arc(bx, by, 6 + 5 * hk, 0, Math.PI * 2); c.fill(); c.restore();
            if (!lo && performance.now() < heat.lock && Math.random() < 0.5 && dust.length < 50) dust.push({ x: bx, y: by, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, t: now });
        }
    }
    function miniB(g, X, Y, sc, dot, edge, now) {
        var A = ev.art; if (A && now < A.end) { g.fillStyle = 'rgba(239,68,68,.3)'; g.strokeStyle = 'rgba(248,113,113,.95)'; g.lineWidth = 1.5; g.beginPath(); g.arc(X(A.x), Y(A.y), Math.max(3, A.r * sc), 0, Math.PI * 2); g.fill(); g.stroke(); }
        var Dn = ev.drone; if (Dn) { var f = (now - Dn.t0) / Dn.dur; if (f >= 0 && f <= 1) { var p = dot(Dn.x0 + (Dn.x1 - Dn.x0) * f, Dn.y0 + (Dn.y1 - Dn.y0) * f, 3.5, '#38bdf8', '#fff', 6); g.font = '9px Arial'; g.textAlign = 'center'; g.fillText('🚁', p[0], p[1] - 9); } }
        if (leaderId && leaderId !== myId) { var lp = opponents[leaderId]; if (lp && lp.hp > 0) { var q = dot(lp.x, lp.y, 4, '#facc15', '#78350f', 7); g.font = '9px Arial'; g.textAlign = 'center'; g.fillText('👑', q[0], q[1] - 8); } }
    }
})();
