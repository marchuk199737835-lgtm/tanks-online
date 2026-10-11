/* classfx.js — класи танків у кооперативі (клієнт): вибір у лобі, кнопка здібності (E на ПК / кнопка на телефоні),
 * неонова аура класу під танком, ефекти здібностей і звуки (синтез WebAudio, без файлів).
 * Якість ефектів залежить від налаштувань графіки (window.GFX.tier): high — світіння й частинки, medium — менше частинок без розмиття,
 * low — лише прості контури (без частинок і розмиття). Дані класів — js/classes.js, логіка — сервер (classes_srv.js). */
(function () {
    'use strict';
    var TC = window.TankClasses; if (!TC) return;
    var $ = function (id) { return document.getElementById(id); };
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    var tt = function (s) { return window.I18N && I18N.t ? I18N.t(s) : s; };
    var snd = function (n) { try { if (typeof playSound === 'function') playSound(n); } catch (e) {} };
    var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var room = function () { return typeof currentRoomData !== 'undefined' ? currentRoomData : null; };
    var tier = function () { return (window.GFX && GFX.tier) || 'high'; };
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ================= СТИЛІ =================
    var css = '' +
        // --- лобі ---
        '.lb-cls{flex:none}.lb-cls .cls-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin-top:6px}' +
        '.cls-t{--cc:59,130,246;position:relative;display:flex;flex-direction:column;align-items:center;gap:1px;padding:8px 2px 6px;border-radius:12px;background:linear-gradient(170deg,rgba(var(--cc),.16),rgba(15,23,42,.85));border:1px solid rgba(var(--cc),.3);color:#e2e8f0;cursor:pointer;transition:transform .18s,border-color .2s,box-shadow .2s,background .2s;min-width:0}' +
        '.cls-t i{font-style:normal;font-size:24px;line-height:1.1;transition:transform .25s cubic-bezier(.2,.9,.3,1.4)}.cls-t b{font:400 11px/1.15 "Russo One",sans-serif;letter-spacing:.03em;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.cls-t small{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:rgba(var(--cc),1);opacity:.85;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.cls-t:hover{transform:translateY(-2px);border-color:rgba(var(--cc),.75)}.cls-t:hover i{transform:scale(1.15) rotate(-6deg)}' +
        '.cls-t.on{background:linear-gradient(170deg,rgba(var(--cc),.42),rgba(15,23,42,.9));border-color:rgb(var(--cc));box-shadow:0 0 16px rgba(var(--cc),.45),inset 0 0 12px rgba(var(--cc),.25)}' +
        '.cls-t.on:after{content:"✓";position:absolute;top:3px;right:5px;font:700 10px/1 Arial;color:rgb(var(--cc))}' +
        '.cls-info{--cc:59,130,246;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:10px;margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(var(--cc),.08);border:1px solid rgba(var(--cc),.3)}' +
        '.cls-st{display:flex;flex-direction:column;gap:4px;font-size:10.5px;font-weight:700;color:#cbd5e1}.cls-st div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:6px}' +
        '.cls-st u{text-decoration:none;display:block;height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden}.cls-st u i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,rgba(var(--cc),.6),rgb(var(--cc)));box-shadow:0 0 6px rgba(var(--cc),.6);transition:width .35s}' +
        '.cls-st b{font:400 10.5px "Russo One",sans-serif;color:#fff;min-width:34px;text-align:right}' +
        '.cls-abx{display:flex;gap:8px;align-items:flex-start;min-width:0}.cls-abx>i{flex:none;font-style:normal;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:rgba(var(--cc),.25);border:1px solid rgba(var(--cc),.7);box-shadow:0 0 12px rgba(var(--cc),.4)}' +
        '.cls-abx b{display:block;font:400 12px "Russo One",sans-serif;color:rgb(var(--cc))}.cls-abx p{margin:2px 0 0;font-size:11px;line-height:1.35;color:#cbd5e1}.cls-abx small{display:block;margin-top:3px;font-size:10px;font-weight:800;color:#94a3b8;letter-spacing:.04em}' +
        '.cls-tag{display:inline-flex;align-items:center;gap:3px;margin-left:5px;padding:1px 6px;border-radius:7px;font-size:10px;font-weight:800;background:rgba(var(--cc),.2);border:1px solid rgba(var(--cc),.55);color:#fff;vertical-align:1px}' +
        '@media (max-width:700px){.lb-cls .cls-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.cls-info{grid-template-columns:1fr}.cls-t{flex-direction:row;justify-content:flex-start;gap:6px;padding:7px 8px}.cls-t i{font-size:20px}.cls-t small{display:none}}' +
        // --- бій: кнопка здібності ---
        '#cls-hud{position:absolute;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);transform:translateX(-50%);z-index:36;display:flex;align-items:center;gap:10px;pointer-events:none}' +
        '#cls-hud.hidden{display:none}' +
        '#cls-ab{--cc:59,130,246;--p:1;position:relative;pointer-events:auto;width:64px;height:64px;border-radius:50%;border:0;padding:0;cursor:pointer;background:radial-gradient(circle at 50% 38%,rgba(var(--cc),.55),rgba(8,12,30,.92) 70%);box-shadow:0 0 0 2px rgba(var(--cc),.35),0 6px 18px rgba(0,0,0,.5);color:#fff;transition:transform .12s,box-shadow .25s;touch-action:none;-webkit-tap-highlight-color:transparent}' +
        '#cls-ab:before{content:"";position:absolute;inset:-4px;border-radius:50%;background:conic-gradient(rgb(var(--cc)) calc(var(--p)*360deg),rgba(255,255,255,.08) 0);-webkit-mask:radial-gradient(circle,transparent 62%,#000 64%);mask:radial-gradient(circle,transparent 62%,#000 64%)}' +
        '#cls-ab i{position:relative;font-style:normal;font-size:28px;line-height:64px;display:block;transition:transform .25s,filter .25s}#cls-ab kbd{position:absolute;right:-2px;bottom:-2px;min-width:20px;height:20px;border-radius:6px;background:#0f172a;border:1px solid rgba(var(--cc),.8);font:700 11px/18px "Russo One",Arial;color:#fff}' +
        '#cls-ab em{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font:400 20px "Russo One",Arial;font-style:normal;color:#fff;text-shadow:0 2px 6px #000}' +
        '#cls-ab.cd i{filter:grayscale(.85) brightness(.55)}#cls-ab.cd em{display:flex}' +
        '#cls-ab.rdy{animation:clsRdy 1.8s ease-in-out infinite}#cls-ab.rdy i{transform:scale(1.06)}' +
        '#cls-ab.act{box-shadow:0 0 0 3px rgb(var(--cc)),0 0 26px rgba(var(--cc),.85)}#cls-ab:active{transform:scale(.92)}' +
        '@keyframes clsRdy{50%{box-shadow:0 0 0 3px rgba(var(--cc),.75),0 0 22px rgba(var(--cc),.65)}}' +
        'html.gfx-low #cls-ab.rdy{animation:none}' +
        '.cls-hud-t{display:flex;flex-direction:column;gap:2px;font:400 12px "Russo One",Arial;color:#fff;text-shadow:0 2px 6px #000}.cls-hud-t small{font:700 10px Jura,Arial;color:#cbd5e1;letter-spacing:.05em}' +
        '#cls-lives{font-size:13px;letter-spacing:1px;text-shadow:0 2px 6px #000}#cls-lives.hidden{display:none}' +
        // телефон: кнопка здібності праворуч над кнопкою емоцій, назва прихована
        'html.ctl-touch #cls-hud{left:auto;right:calc(env(safe-area-inset-right,0px) + 14px);bottom:calc(env(safe-area-inset-bottom,0px) + 46% + 58px);transform:none;flex-direction:column-reverse;gap:4px}' +
        'html.ctl-touch .cls-hud-t{display:none}html.ctl-touch #cls-ab{width:60px;height:60px}html.ctl-touch #cls-ab i{line-height:60px;font-size:26px}html.ctl-touch #cls-ab kbd{display:none}' +
        'html.ctl-touch #emo-btn.show{right:calc(env(safe-area-inset-right,0px) + 21px);width:46px;height:46px}' +
        '@media (orientation:landscape) and (max-height:430px){html.ctl-touch #cls-hud{bottom:calc(env(safe-area-inset-bottom,0px) + 46% + 52px)}html.ctl-touch #cls-ab{width:52px;height:52px}html.ctl-touch #cls-ab i{line-height:52px;font-size:22px}}' +
        '.lb-mult{cursor:help}.lb-mult b.up{color:#4ade80}.lb-mult b.dn{color:#f87171}' +
        '#cls-flash{position:absolute;inset:0;pointer-events:none;z-index:15;opacity:0;transition:opacity .5s}';
    var se = document.createElement('style'); se.id = 'classfx-css'; se.textContent = css; document.head.appendChild(se);

    // ================= ЗВУКИ (синтез) =================
    var AC = function () { try { if (typeof audioCtx === 'undefined' || !audioCtx) { if (typeof initAudio === 'function') initAudio(); } if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); return audioCtx || null; } catch (e) { return null; } };
    var VOL = function () { try { return typeof volSfx === 'number' ? volSfx : 0.6; } catch (e) { return 0.6; } };
    var nBuf = null;
    function noiseBuf(a) { if (nBuf) return nBuf; var n = a.sampleRate | 0, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return (nBuf = b); }
    function out(a, g) { var m = a.createGain(); m.gain.value = g; m.connect(a.destination); return m; }
    function osc(a, dst, type, f0, f1, t0, dur, g, att) {
        var o = a.createOscillator(), e = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + (att || 0.01)); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(e); e.connect(dst); o.start(t0); o.stop(t0 + dur + 0.05);
    }
    function noise(a, dst, ftype, f0, f1, t0, dur, g, q, att) {
        var s = a.createBufferSource(), f = a.createBiquadFilter(), e = a.createGain(); s.buffer = noiseBuf(a); f.type = ftype; f.Q.value = q || 1;
        f.frequency.setValueAtTime(f0, t0); if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        e.gain.setValueAtTime(0.0001, t0); e.gain.exponentialRampToValueAtTime(g, t0 + (att || 0.01)); e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        s.connect(f); f.connect(e); e.connect(dst); s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.05);
    }
    var lastZap = 0, lastBoom = 0;
    var SND = {
        // лікар: м’який мажорний переливчастий акорд + легкий «подих»
        heal: function (a, d, t) { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { osc(a, d, 'sine', f, f, t + i * 0.07, 1.1, 0.16, 0.02); osc(a, d, 'triangle', f * 2, f * 2, t + i * 0.07, 0.6, 0.03, 0.02); }); noise(a, d, 'bandpass', 3000, 6000, t, 0.9, 0.05, 2, 0.3); },
        // танк: важкий металевий удар + гул щита
        bastion: function (a, d, t) { osc(a, d, 'square', 80, 46, t, 0.55, 0.22); osc(a, d, 'triangle', 160, 120, t, 0.45, 0.2); noise(a, d, 'bandpass', 1200, 400, t, 0.25, 0.35, 3); osc(a, d, 'sine', 110, 110, t + 0.05, 1.0, 0.14, 0.15); osc(a, d, 'sine', 220, 222, t + 0.05, 0.9, 0.05, 0.2); },
        // вбивця: свист у тінь
        shadow: function (a, d, t) { noise(a, d, 'bandpass', 2600, 280, t, 0.55, 0.28, 4, 0.03); osc(a, d, 'sine', 420, 110, t, 0.6, 0.14, 0.02); osc(a, d, 'triangle', 880, 330, t + 0.05, 0.4, 0.04); },
        // штурмовик: розкрутка двигуна
        rage: function (a, d, t) { osc(a, d, 'sawtooth', 90, 520, t, 0.5, 0.1, 0.02); osc(a, d, 'square', 180, 1040, t + 0.02, 0.45, 0.05); noise(a, d, 'highpass', 900, 3500, t, 0.45, 0.12, 1); osc(a, d, 'sine', 1300, 1300, t + 0.48, 0.12, 0.08); },
        // бомбардир: свист снарядів, що летять
        barrage: function (a, d, t) { osc(a, d, 'sine', 1900, 650, t, 0.75, 0.12, 0.05); osc(a, d, 'sine', 1700, 600, t + 0.18, 0.75, 0.08, 0.05); osc(a, d, 'square', 220, 220, t, 0.08, 0.08); },
        // інженер: сервоприводи + підтверджувальний біп
        turret: function (a, d, t) { [0, 0.09, 0.18].forEach(function (o, i) { osc(a, d, 'square', 520 + i * 260, 640 + i * 260, t + o, 0.07, 0.07); }); noise(a, d, 'bandpass', 900, 1800, t, 0.3, 0.12, 3); osc(a, d, 'sine', 1568, 1568, t + 0.32, 0.18, 0.12); osc(a, d, 'sine', 2093, 2093, t + 0.42, 0.22, 0.1); },
        boom: function (a, d, t) { noise(a, d, 'lowpass', 1400, 90, t, 0.6, 0.55, 0.7); osc(a, d, 'sine', 95, 38, t, 0.5, 0.35); },
        splash: function (a, d, t) { noise(a, d, 'lowpass', 1100, 140, t, 0.3, 0.22, 0.7); },
        zap: function (a, d, t) { osc(a, d, 'square', 1500, 520, t, 0.07, 0.05); }
    };
    function play(k, x, y) {
        var a = AC(); if (!a || !SND[k]) return; var v = VOL(); if (v <= 0) return;
        var g = 0.85; if (x != null && typeof camera !== 'undefined') { var dd = Math.hypot(x - camera.x, y - camera.y); g *= Math.max(0, 1 - dd / 1500); if (g < 0.04) return; }
        try { SND[k](a, out(a, g * v), a.currentTime + 0.01); } catch (e) {}
    }

    // ================= СТАН =================
    var FX = {};          // id гравця → { k, until, t0 }
    var turrets = {};     // id власника → { x, y, until, ang, zx, zy, zt }
    var zones = [];       // артобстріл: { x, y, r, until, t0 }
    var booms = [];       // вибухи: { x, y, r, t0, dur, c }
    var parts = [];       // частинки: { x, y, vx, vy, life, max, c, s, kind }
    var beams = [];       // постріли турелі: { x1, y1, x2, y2, t0 }
    var cdEnd = 0, cdFull = 1, lives = null, myCls = null, lastAct = 0;
    function cls(id) { var r = room(), p = r && r.players && r.players[id]; return p && TC.valid(p.cls) ? p.cls : null; }
    function active() { var r = room(); return !!(r && r.status === 'playing' && TC.on(r.mode)); }
    function posOf(id) {
        if (typeof myId !== 'undefined' && id === myId) return (typeof myLocalTank !== 'undefined' && myLocalTank.hp > 0) ? myLocalTank : null;
        var o = typeof opponents !== 'undefined' ? opponents[id] : null; return o && o.hp > 0 ? o : null;
    }
    function on(id, k, now) { var f = FX[id]; return !!(f && f.k === k && now < f.until); }
    function partCap() { var t = tier(); return t === 'low' ? 0 : t === 'medium' ? 60 : 160; }
    function addPart(p) { if (parts.length < partCap()) parts.push(p); }

    // ================= ПІДКЛЮЧЕННЯ ДО ГРИ (виклики з game.js) =================
    var api = {
        active: active,
        // базова перезарядка класу (замість 2000 мс) з урахуванням «Адреналіну»
        reload: function (base) { if (!active()) return base; var k = cls(myId), c = k && TC.C[k]; if (!c) return base; var v = c.cd; if (on(myId, 'rage', Date.now())) v /= c.ab.rate; return v; },
        spdMul: function () { if (!active()) return 1; var k = cls(myId), c = k && TC.C[k]; if (!c) return 1; var m = c.spd, now = Date.now(); if (on(myId, 'rage', now) || on(myId, 'shadow', now)) m *= c.ab.spd || 1; return m; },
        hpMul: function () { if (!active()) return 1; var k = cls(myId); return k ? TC.C[k].hp / TC.BASE.hp : 1; },
        // прозорість танка вбивці в тіні (свій — напівпрозорий, чужий — ледь помітний)
        alpha: function (id) { if (!active() || !on(id, 'shadow', Date.now())) return 1; return id === myId ? 0.5 : 0.28; },
        ground: drawGround, top: drawTop, use: useAbility, reset: reset
    };
    window.ClassFX = api;

    // ================= ЛОБІ: вибір класу =================
    var built = false, sentFor = null;
    function buildLobby() {
        var pane = $('lb-pane-players'); if (!pane || $('lb-cls')) return;
        var card = document.createElement('div'); card.id = 'lb-cls'; card.className = 'lb-card lb-cls';
        card.innerHTML = '<div class="lb-card-h"><span>🎖️ Клас танка</span><small class="cls-hint">здібність: клавіша E</small></div><div class="cls-grid">' +
            TC.ORDER.map(function (k) { var c = TC.C[k]; return '<button type="button" class="cls-t" data-k="' + k + '" style="--cc:' + c.c + '"><i>' + c.e + '</i><b>' + esc(c.n) + '</b><small>' + esc(c.role) + '</small></button>'; }).join('') +
            '</div><div class="cls-info" id="cls-info"></div>';
        var roster = pane.querySelector('.lb-roster-card'); pane.insertBefore(card, roster || pane.firstChild);
        card.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('.cls-t'); if (!b) return; var k = b.dataset.k; snd('ui_click');
            lsSet('tankCls', k); paintInfo(k); mark(k);
            if (typeof currentRoomId !== 'undefined' && currentRoomId) socket.emit('setClass', { roomId: currentRoomId, cls: k });
        });
        built = true;
    }
    function mark(k) { var g = $('lb-cls'); if (!g) return; g.querySelectorAll('.cls-t').forEach(function (b) { b.classList.toggle('on', b.dataset.k === k); }); }
    function paintInfo(k) {
        var box = $('cls-info'); if (!box) return; var c = TC.of(k), B = TC.bars(k), sec = function (ms) { return Math.round(ms / 1000) + ' с'; };
        if (box._k === k) return; box._k = k; box.style.setProperty('--cc', c.c);
        var row = function (ic, l, w, v) { return '<div><span>' + ic + ' ' + esc(l) + '</span><u><i style="width:' + Math.round(w * 100) + '%"></i></u><b>' + v + '</b></div>'; };
        box.innerHTML = '<div class="cls-st">' + row('❤️', 'Броня', B.hp, c.hp) + row('💥', 'Урон', B.dmg, c.dmg) + row('⚡', 'Постріл', B.rate, (c.cd / 1000).toFixed(2).replace(/0$/, '') + ' с') + row('💨', 'Швидкість', B.spd, Math.round(c.spd * 100) + '%') + '</div>' +
            '<div class="cls-abx"><i>' + c.ab.e + '</i><div><b>' + esc(c.ab.n) + '</b><p>' + esc(c.ab.d) + '</p><small>⏱ <span>Перезарядка</span> ' + sec(c.ab.cd) + ' · ' + esc(c.d) + '</small></div></div>';
    }
    api.lobby = function (r) {
        if (!r) return; if (!built) buildLobby(); var card = $('lb-cls'); if (!card) return;
        var show = TC.on(r.mode); card.style.display = show ? '' : 'none'; if (!show) return;
        var me = r.players && r.players[myId], saved = lsGet('tankCls'), want = TC.valid(saved) ? saved : TC.DEF;
        var k = me && TC.valid(me.cls) ? me.cls : want;
        // одразу після входу в кооп-лобі — надсилаємо збережений клас (раз на кімнату)
        if (me && !TC.valid(me.cls) && sentFor !== r.id + '|' + myId) { sentFor = r.id + '|' + myId; socket.emit('setClass', { roomId: currentRoomId, cls: want }); }
        mark(k); paintInfo(k);
        var h = card.querySelector('.cls-hint'); if (h) h.textContent = document.documentElement.classList.contains('ctl-touch') ? 'здібність: кнопка в бою' : 'здібність: клавіша E';
    };
    // позначка класу в картці гравця (lobby.js)
    api.tag = function (r, p) { if (!r || !TC.on(r.mode) || !p || !TC.valid(p.cls)) return ''; var c = TC.C[p.cls]; return '<span class="cls-tag" style="--cc:' + c.c + '" title="' + esc(c.n) + '">' + c.e + '</span>'; };

    // ================= БІЙ: кнопка здібності =================
    var hud = null, abBtn = null;
    function buildHud() {
        var gs = $('game-screen'); if (!gs || hud) return;
        hud = document.createElement('div'); hud.id = 'cls-hud'; hud.className = 'hidden';
        hud.innerHTML = '<button type="button" id="cls-ab" aria-label="Здібність"><i></i><em></em><kbd>E</kbd></button><div class="cls-hud-t"><b id="cls-ab-n"></b><small id="cls-ab-s"></small></div><div id="cls-lives" class="hidden"></div>';
        gs.appendChild(hud); abBtn = $('cls-ab');
        var fire = function (e) { if (e) { e.preventDefault(); e.stopPropagation(); } useAbility(); };
        abBtn.addEventListener('touchstart', fire, { passive: false });
        abBtn.addEventListener('mousedown', function (e) { if (e.button === 0) fire(e); });
    }
    function useAbility() {
        if (!active() || typeof myLocalTank === 'undefined' || myLocalTank.hp <= 0) return;
        var now = Date.now(); if (now < cdEnd - 150) { snd('ui_error'); return; }
        if (now - lastAct < 400) return; lastAct = now;
        var d = { roomId: currentRoomId };
        // точка прицілу (артобстріл): на ПК — курсор, на телефоні — 320 px у напрямку башти
        var touch = document.documentElement.classList.contains('ctl-touch');
        if (!touch && typeof mouseX !== 'undefined' && typeof VS !== 'undefined') { d.x = camera.x + (mouseX - GW / 2) / VS; d.y = camera.y + (mouseY - GH / 2) / VS; }
        else { d.x = myLocalTank.x + Math.cos(myLocalTank.turretAngle) * 320; d.y = myLocalTank.y + Math.sin(myLocalTank.turretAngle) * 320; }
        socket.emit('useAbility', d);
    }
    document.addEventListener('keydown', function (e) {
        if (e.repeat || (e.key !== 'e' && e.key !== 'E' && e.key !== 'у' && e.key !== 'У' && e.code !== 'KeyE')) return;
        var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (!active()) return; e.preventDefault(); useAbility();
    });
    function hudTick() {
        if (!hud) buildHud(); if (!hud) return;
        var show = active() && typeof myLocalTank !== 'undefined' && (myLocalTank.hp > 0 || lives !== null);
        hud.classList.toggle('hidden', !show); if (!show) return;
        var k = cls(myId) || TC.DEF, c = TC.C[k], now = Date.now(), left = Math.max(0, cdEnd - now), act = FX[myId] && FX[myId].until > now;
        if (myCls !== k) { myCls = k; abBtn.style.setProperty('--cc', c.c); abBtn.querySelector('i').textContent = c.ab.e; $('cls-ab-n').textContent = tt(c.ab.n); }
        var p = left > 0 ? 1 - left / Math.max(1, cdFull) : 1;
        abBtn.style.setProperty('--p', p.toFixed(3));
        abBtn.classList.toggle('cd', left > 0 && !act); abBtn.classList.toggle('rdy', left <= 0 && !act && myLocalTank.hp > 0); abBtn.classList.toggle('act', !!act);
        var em = abBtn.querySelector('em'), sv = left > 0 ? String(Math.ceil(left / 1000)) : ''; if (em._v !== sv) { em._v = sv; em.textContent = sv; }
        var sEl = $('cls-ab-s'), sTxt = act ? tt('АКТИВНО') : left > 0 ? tt('Перезарядка') + ' ' + Math.ceil(left / 1000) + tt(' с') : tt('ГОТОВО') + ' · E';
        if (sEl._v !== sTxt) { sEl._v = sTxt; sEl.textContent = sTxt; }
        var lv = $('cls-lives'); if (lives === null) lv.classList.add('hidden'); else { lv.classList.remove('hidden'); var lt = lives > 0 ? '❤️'.repeat(Math.min(5, lives)) : '💀'; if (lv._v !== lt) { lv._v = lt; lv.textContent = lt; } }
    }
    setInterval(hudTick, 100);

    // ================= ПОДІЇ СЕРВЕРА =================
    socket.on('clsCd', function (d) { if (!d) return; cdEnd = Date.now() + (+d.ms || 0); cdFull = +d.full || +d.ms || 1; });
    socket.on('clsLives', function (d) { lives = d && d.n != null ? (+d.n) : null; });
    socket.on('clsAbil', function (d) {
        if (!d || !d.id) return; var now = Date.now(), k = d.k;
        FX[d.id] = { k: k, until: now + (+d.dur || 0), t0: now };
        var pos = posOf(d.id) || { x: d.x, y: d.y };
        play(k, pos.x, pos.y);
        if (d.id === myId) { var f = $('cls-flash'); if (!f) { f = document.createElement('div'); f.id = 'cls-flash'; var gs = $('game-screen'); if (gs) gs.appendChild(f); } var c = TC.C[cls(myId) || TC.DEF]; if (f && tier() !== 'low') { f.style.background = 'radial-gradient(circle at 50% 50%,transparent 45%,rgba(' + c.c + ',.35))'; f.style.transition = 'none'; f.style.opacity = '1'; void f.offsetWidth; f.style.transition = 'opacity .7s'; f.style.opacity = '0'; } }
        if (k === 'bastion') booms.push({ x: pos.x, y: pos.y, r: TC.C.tank.ab.pr + 30, t0: now, dur: 450, c: '96,165,250', ring: true });
        else if (k === 'rage') booms.push({ x: pos.x, y: pos.y, r: 90, t0: now, dur: 380, c: '249,115,22', ring: true });
        else if (k === 'heal') booms.push({ x: pos.x, y: pos.y, r: TC.C.medic.ab.r, t0: now, dur: 600, c: '34,197,94', ring: true });
        else if (k === 'shadow') { booms.push({ x: pos.x, y: pos.y, r: 70, t0: now, dur: 450, c: '168,85,247', ring: true }); for (var i = 0; i < 14; i++) { var a = Math.random() * 6.28; addPart({ x: pos.x, y: pos.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.7, max: 0.7, c: '168,85,247', s: 7, kind: 'smoke' }); } }
        else if (k === 'barrage') zones.push({ x: d.x, y: d.y, r: TC.C.bomber.ab.r, until: now + TC.C.bomber.ab.dur + 300, t0: now });
        else if (k === 'turret') { turrets[d.id] = { x: d.x, y: d.y, until: now + (+d.dur || 0), ang: 0, t0: now }; booms.push({ x: d.x, y: d.y, r: 60, t0: now, dur: 400, c: '6,182,212', ring: true }); }
    });
    socket.on('clsShell', function (d) {
        if (!d) return; var now = Date.now(); booms.push({ x: d.x, y: d.y, r: TC.C.bomber.ab.br, t0: now, dur: 520, c: '251,146,60', fire: true });
        var n = tier() === 'high' ? 12 : tier() === 'medium' ? 5 : 0; for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, s = 120 + Math.random() * 220; addPart({ x: d.x, y: d.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, max: 0.5, c: i % 2 ? '253,224,71' : '249,115,22', s: 3, kind: 'spark' }); }
        if (now - lastBoom > 90) { lastBoom = now; play('boom', d.x, d.y); }
        if (typeof shakeTime !== 'undefined' && typeof camera !== 'undefined' && Math.hypot(d.x - camera.x, d.y - camera.y) < 500) shakeTime = Math.max(shakeTime, 0.12);
    });
    socket.on('clsSplash', function (d) { if (!d) return; booms.push({ x: d.x, y: d.y, r: TC.C.bomber.splash.r, t0: Date.now(), dur: 320, c: '239,68,68', fire: true }); play('splash', d.x, d.y); });
    socket.on('clsZap', function (d) {
        var T = d && turrets[d.o]; if (!T) return; var now = Date.now();
        T.ang = Math.atan2(d.y - T.y, d.x - T.x); beams.push({ x1: T.x + Math.cos(T.ang) * 16, y1: T.y + Math.sin(T.ang) * 16, x2: d.x, y2: d.y, t0: now });
        if (now - lastZap > 120) { lastZap = now; play('zap', T.x, T.y); }
    });
    socket.on('gameStarting', function () { reset(); });
    function reset() { FX = {}; turrets = {}; zones = []; booms = []; parts = []; beams = []; cdEnd = 0; lives = null; myCls = null; }
    api.reset = reset;

    // ================= МАЛЮВАННЯ =================
    var hex = function (g, r) { g.beginPath(); for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r); else g.moveTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); };
    var cross = function (g, s) { g.fillRect(-s / 2, -s / 6, s, s / 3); g.fillRect(-s / 6, -s / 2, s / 3, s); };
    // аура класу під танком: неонове кільце + власний мотив кожного класу
    function aura(g, x, y, k, now, lw) {
        // танк ~ 70 px: кільце 48 (видно з-під корпусу), мотиви класу — на 52–60
        var c = TC.C[k], t = now / 1000, hi = tier() === 'high', lo = tier() === 'low', R = 48;
        g.save(); g.translate(x, y);
        if (!lo) {      // м’яке неонове сяйво під танком
            var gr = g.createRadialGradient(0, 0, 18, 0, 0, R + 10); gr.addColorStop(0, 'rgba(' + c.c + ',0)'); gr.addColorStop(0.7, 'rgba(' + c.c + ',' + (0.16 + 0.06 * Math.sin(t * 3)) + ')'); gr.addColorStop(1, 'rgba(' + c.c + ',0)');
            g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R + 10, 0, Math.PI * 2); g.fill();
        }
        if (hi) { g.shadowColor = c.hex; g.shadowBlur = 14; }
        g.strokeStyle = 'rgba(' + c.c + ',' + (0.65 + 0.25 * Math.sin(t * 3)) + ')'; g.lineWidth = lw || 2.5;
        g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke();
        if (!lo) {
            g.fillStyle = 'rgba(' + c.c + ',.9)'; g.strokeStyle = 'rgba(' + c.c + ',.85)'; g.lineWidth = 2.5;
            if (k === 'medic') { for (var i = 0; i < 4; i++) { var a = t * 1.2 + i * Math.PI / 2; g.save(); g.translate(Math.cos(a) * R, Math.sin(a) * R); g.rotate(a); cross(g, 12); g.restore(); } }
            else if (k === 'tank') { g.rotate(t * 0.4); hex(g, R + 8); g.stroke(); }
            else if (k === 'assassin') { g.rotate(-t * 1.6); for (var j = 0; j < 3; j++) { g.beginPath(); g.arc(0, 0, R + 6, j * 2.09, j * 2.09 + 0.9); g.stroke(); } }
            else if (k === 'assault') { g.rotate(t * 2); for (var m = 0; m < 6; m++) { g.save(); g.rotate(m * Math.PI / 3); g.beginPath(); g.moveTo(R + 2, -5); g.lineTo(R + 10, 0); g.lineTo(R + 2, 5); g.stroke(); g.restore(); } }
            else if (k === 'bomber') { g.rotate(t * 0.8); for (var q = 0; q < 4; q++) { g.save(); g.rotate(q * Math.PI / 2); g.beginPath(); g.moveTo(R - 6, 0); g.lineTo(R + 10, 0); g.stroke(); g.beginPath(); g.arc(R + 2, 0, 3, 0, Math.PI * 2); g.fill(); g.restore(); } }
            else if (k === 'engineer') { g.rotate(t * 0.9); for (var s = 0; s < 8; s++) { g.save(); g.rotate(s * Math.PI / 4); g.fillRect(R - 1, -4, 8, 8); g.restore(); } }
        }
        g.restore();
    }
    function drawGround(g, _t, view) {
        if (!active()) return; var r = room(); if (!r) return;
        var now = Date.now();      // події сервера мітимо Date.now(); час кадру з game.js (rAF) — інша шкала
        var vis = function (p, m) { return p.x > view.x0 - m && p.x < view.x1 + m && p.y > view.y0 - m && p.y < view.y1 + m; };
        // зони артобстрілу: червоне коло-ціль з перехрестям
        for (var i = zones.length - 1; i >= 0; i--) {
            var Z = zones[i]; if (now > Z.until) { zones.splice(i, 1); continue; } if (!vis(Z, Z.r)) continue;
            var k = Math.max(0.01, Math.min(1, (now - Z.t0) / 300)); g.save(); g.translate(Z.x, Z.y);
            g.fillStyle = 'rgba(239,68,68,' + (0.08 + 0.05 * Math.sin(now / 90)) + ')'; g.beginPath(); g.arc(0, 0, Z.r * k, 0, Math.PI * 2); g.fill();
            g.strokeStyle = 'rgba(248,113,113,.9)'; g.lineWidth = 3; g.setLineDash([14, 10]); g.lineDashOffset = -now / 30; g.beginPath(); g.arc(0, 0, Z.r * k, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            g.lineWidth = 2; g.beginPath(); g.moveTo(-22, 0); g.lineTo(22, 0); g.moveTo(0, -22); g.lineTo(0, 22); g.stroke(); g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.stroke(); g.restore();
        }
        // поле лікаря (під танками)
        for (var id in FX) {
            var f = FX[id]; if (f.k !== 'heal' || now > f.until) continue; var p = posOf(id); if (!p || !vis(p, 230)) continue;
            var R = TC.C.medic.ab.r, life = (f.until - now) / TC.C.medic.ab.dur, a0 = Math.min(1, (now - f.t0) / 250) * Math.min(1, life * 6);
            g.save(); g.translate(p.x, p.y); g.globalAlpha = a0;
            if (tier() !== 'low') { var gr = g.createRadialGradient(0, 0, R * 0.15, 0, 0, R); gr.addColorStop(0, 'rgba(34,197,94,.05)'); gr.addColorStop(0.75, 'rgba(34,197,94,.14)'); gr.addColorStop(1, 'rgba(74,222,128,.32)'); g.fillStyle = gr; }
            else g.fillStyle = 'rgba(34,197,94,.12)';
            g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
            if (tier() === 'high') { g.shadowColor = '#4ade80'; g.shadowBlur = 16; }
            g.strokeStyle = 'rgba(74,222,128,.9)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.stroke(); g.shadowBlur = 0;
            // хвиля кожного тіку лікування (0,25 с)
            var ph = ((now - f.t0) % 250) / 250; g.strokeStyle = 'rgba(134,239,172,' + (0.5 * (1 - ph)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, Math.max(0, R * (0.3 + 0.7 * ph)), 0, Math.PI * 2); g.stroke();
            g.rotate(now / 1400); g.setLineDash([6, 12]); g.strokeStyle = 'rgba(187,247,208,.55)'; g.beginPath(); g.arc(0, 0, R - 12, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            g.restore();
            if (Math.random() < (tier() === 'high' ? 0.5 : 0.18)) { var aa = Math.random() * 6.28, dd = Math.sqrt(Math.random()) * R; addPart({ x: p.x + Math.cos(aa) * dd, y: p.y + Math.sin(aa) * dd, vx: 0, vy: -40, life: 1.1, max: 1.1, c: '74,222,128', s: 8, kind: 'cross' }); }
        }
        // аури класів під кожним танком
        var ids = Object.keys(r.players);
        for (var n = 0; n < ids.length; n++) { var pid = ids[n], k2 = cls(pid), q = posOf(pid); if (!k2 || !q || !vis(q, 60)) continue; if (on(pid, 'shadow', now) && pid !== myId) continue; aura(g, q.x, q.y, k2, now, pid === myId ? 3 : 2.2); }
        // основи турелей
        for (var o in turrets) {
            var T = turrets[o]; if (now > T.until) { delete turrets[o]; continue; } if (!vis(T, 60)) continue;
            g.save(); g.translate(T.x, T.y);
            if (tier() === 'high') { g.shadowColor = '#22d3ee'; g.shadowBlur = 14; }
            g.fillStyle = '#0b1324'; g.strokeStyle = '#22d3ee'; g.lineWidth = 2.5; hex(g, 20); g.fill(); g.stroke(); g.shadowBlur = 0;
            var lf = (T.until - now) / TC.C.engineer.ab.dur; g.strokeStyle = 'rgba(34,211,238,.75)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * lf); g.stroke();
            g.strokeStyle = 'rgba(34,211,238,.18)'; g.lineWidth = 1; g.setLineDash([4, 8]); g.beginPath(); g.arc(0, 0, TC.C.engineer.ab.r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
            g.restore();
        }
    }
    function drawTop(g, _t, view) {
        if (!active()) { if (parts.length) parts.length = 0; return; }
        var now = Date.now();
        var dt = Math.min(0.05, Math.max(0, (now - (drawTop._t || now)) / 1000)); drawTop._t = now;
        var hi = tier() === 'high', lo = tier() === 'low';
        for (var id in FX) {
            var f = FX[id]; if (now > f.until) { delete FX[id]; continue; } var p = posOf(id); if (!p) continue;
            var t = now / 1000, life = Math.min(1, (f.until - now) / 400), a0 = Math.min(1, (now - f.t0) / 200) * life;
            if (f.k === 'bastion') {      // шестикутний щит навколо танка
                g.save(); g.translate(p.x, p.y); g.globalAlpha = a0;
                if (hi) { g.shadowColor = '#60a5fa'; g.shadowBlur = 18; }
                g.fillStyle = 'rgba(59,130,246,.13)'; hex(g, 50); g.fill();
                g.strokeStyle = 'rgba(147,197,253,.95)'; g.lineWidth = 3; g.rotate(t * 0.7); hex(g, 50); g.stroke();
                g.strokeStyle = 'rgba(250,204,21,.8)'; g.lineWidth = 2; g.rotate(-t * 1.6); hex(g, 42); g.stroke();
                g.restore();
            } else if (f.k === 'rage') {      // вогняна аура штурмовика
                g.save(); g.translate(p.x, p.y); g.globalAlpha = a0;
                if (!lo) { var gr = g.createRadialGradient(0, 0, 10, 0, 0, 58); gr.addColorStop(0, 'rgba(253,186,116,0)'); gr.addColorStop(0.6, 'rgba(249,115,22,.22)'); gr.addColorStop(1, 'rgba(239,68,68,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.fill(); }
                g.strokeStyle = 'rgba(251,146,60,' + (0.6 + 0.3 * Math.sin(t * 20)) + ')'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 44 + Math.sin(t * 14) * 3, 0, Math.PI * 2); g.stroke();
                g.restore();
                if (!lo && Math.random() < (hi ? 0.6 : 0.25)) { var a = Math.random() * 6.28; addPart({ x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, vx: Math.cos(a) * 30, vy: -60 - Math.random() * 40, life: 0.45, max: 0.45, c: Math.random() < 0.5 ? '253,186,116' : '239,68,68', s: 4, kind: 'spark' }); }
            } else if (f.k === 'shadow') {      // фіолетовий дим за вбивцею
                if (!lo && Math.random() < (hi ? 0.55 : 0.2)) addPart({ x: p.x + (Math.random() - 0.5) * 30, y: p.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20, life: 0.8, max: 0.8, c: '139,92,246', s: 9, kind: 'smoke' });
            }
        }
        // турелі: голова + промені
        for (var o in turrets) {
            var T = turrets[o]; g.save(); g.translate(T.x, T.y); g.rotate(T.ang || 0);
            g.fillStyle = '#164e63'; g.strokeStyle = '#67e8f9'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill(); g.stroke();
            g.fillStyle = '#a5f3fc'; g.fillRect(6, -3, 16, 6); g.restore();
        }
        for (var b = beams.length - 1; b >= 0; b--) {
            var B = beams[b], k = 1 - (now - B.t0) / 140; if (k <= 0) { beams.splice(b, 1); continue; }
            g.save(); g.globalAlpha = k; if (hi) { g.shadowColor = '#22d3ee'; g.shadowBlur = 12; }
            g.strokeStyle = '#a5f3fc'; g.lineWidth = 3; g.beginPath(); g.moveTo(B.x1, B.y1); g.lineTo(B.x2, B.y2); g.stroke();
            g.fillStyle = '#ecfeff'; g.beginPath(); g.arc(B.x2, B.y2, 6 * k, 0, Math.PI * 2); g.fill(); g.restore();
        }
        // вибухи й кільця активації
        for (var i = booms.length - 1; i >= 0; i--) {
            var E = booms[i], q = Math.max(0, (now - E.t0) / E.dur); if (q >= 1) { booms.splice(i, 1); continue; }
            g.save(); g.translate(E.x, E.y);
            if (E.fire) {
                if (!lo) { var gf = g.createRadialGradient(0, 0, 0, 0, 0, E.r); gf.addColorStop(0, 'rgba(255,247,237,' + (0.9 * (1 - q)) + ')'); gf.addColorStop(0.35, 'rgba(' + E.c + ',' + (0.7 * (1 - q)) + ')'); gf.addColorStop(1, 'rgba(' + E.c + ',0)'); g.fillStyle = gf; }
                else g.fillStyle = 'rgba(' + E.c + ',' + (0.5 * (1 - q)) + ')';
                g.beginPath(); g.arc(0, 0, E.r * (0.4 + 0.6 * q), 0, Math.PI * 2); g.fill();
            }
            g.strokeStyle = 'rgba(' + E.c + ',' + (1 - q) + ')'; g.lineWidth = E.ring ? 4 * (1 - q) + 1 : 2; if (hi) { g.shadowColor = 'rgb(' + E.c + ')'; g.shadowBlur = 12; }
            g.beginPath(); g.arc(0, 0, Math.max(0, E.r * (E.ring ? q : 0.5 + 0.5 * q)), 0, Math.PI * 2); g.stroke(); g.restore();
        }
        // частинки
        for (var j = parts.length - 1; j >= 0; j--) {
            var P = parts[j]; P.life -= dt; if (P.life <= 0) { var l = parts.pop(); if (j < parts.length) parts[j] = l; continue; }
            P.x += P.vx * dt; P.y += P.vy * dt; var al = P.life / P.max;
            g.globalAlpha = al; g.fillStyle = 'rgba(' + P.c + ',1)';
            if (P.kind === 'cross') { g.save(); g.translate(P.x, P.y); cross(g, P.s); g.restore(); }
            else if (P.kind === 'smoke') { g.globalAlpha = al * 0.45; g.beginPath(); g.arc(P.x, P.y, P.s * (1.6 - al * 0.6), 0, Math.PI * 2); g.fill(); }
            else { g.beginPath(); g.arc(P.x, P.y, P.s * al + 1, 0, Math.PI * 2); g.fill(); }
        }
        g.globalAlpha = 1;
    }
})();
