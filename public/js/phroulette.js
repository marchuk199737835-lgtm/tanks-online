/* phroulette.js — хованки: на старті матчу хованцю крутиться рулетка з предметами САМЕ ЦІЄЇ мапи (MapObj.phInfo),
 * і вона зупиняється на предметі, який видав сервер (propType). Під цей предмет і треба маскуватися — вручну обрати не можна.
 * Панель згори по центру, не заважає їхати: поки крутиться — вже можна шукати схованку. Виклик: showPropMenu() з network.js. */
(function () {
    'use strict';
    var tt = function (s) { return window.I18N ? I18N.t(s) : s; };
    var CSS = '' +
        '#ph-rl{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 64px);z-index:95;width:min(580px,94vw);transform:translate(-50%,-14px) scale(.97);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s;font-family:"Russo One",Arial,sans-serif}' +
        '#ph-rl.on{opacity:1;transform:translate(-50%,0) scale(1)}' +
        '#ph-rl .rl-box{border-radius:20px;padding:12px 14px 14px;background:linear-gradient(160deg,rgba(15,23,42,.94),rgba(30,27,75,.92));border:1px solid rgba(129,140,248,.55);box-shadow:0 14px 40px rgba(0,0,0,.55),0 0 26px rgba(99,102,241,.3)}' +
        '#ph-rl h3{margin:0;text-align:center;color:#fff;font-size:17px;letter-spacing:.12em}#ph-rl .rl-sub{text-align:center;color:#a5b4fc;font:700 11px/1.3 Jura,Arial,sans-serif;letter-spacing:.06em;margin:3px 0 10px}' +
        '#ph-rl .rl-win{position:relative;height:96px;border-radius:14px;overflow:hidden;background:rgba(2,6,23,.75);border:1px solid rgba(71,85,105,.8)}' +
        '#ph-rl .rl-win:before,#ph-rl .rl-win:after{content:"";position:absolute;top:0;bottom:0;width:70px;z-index:2;pointer-events:none}#ph-rl .rl-win:before{left:0;background:linear-gradient(90deg,rgba(2,6,23,.95),transparent)}#ph-rl .rl-win:after{right:0;background:linear-gradient(-90deg,rgba(2,6,23,.95),transparent)}' +
        '#ph-rl .rl-tape{position:absolute;left:0;top:8px;display:flex;will-change:transform}' +
        '#ph-rl .rl-it{flex:none;width:80px;height:80px;margin:0 2px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(30,41,59,.85);border:1px solid rgba(100,116,139,.45)}' +
        '#ph-rl .rl-it canvas{width:72px;height:72px;border-radius:9px}' +
        '#ph-rl .rl-mk{position:absolute;left:50%;top:0;bottom:0;width:3px;margin-left:-1.5px;z-index:3;background:#facc15;box-shadow:0 0 12px #facc15}#ph-rl .rl-mk:before,#ph-rl .rl-mk:after{content:"";position:absolute;left:50%;margin-left:-8px;border:8px solid transparent}#ph-rl .rl-mk:before{top:0;border-top-color:#facc15}#ph-rl .rl-mk:after{bottom:0;border-bottom-color:#facc15}' +
        '#ph-rl .rl-it.win{border-color:#facc15;box-shadow:0 0 0 2px #facc15,0 0 22px rgba(250,204,21,.65);animation:rlWin .9s ease-in-out 2}@keyframes rlWin{50%{transform:scale(1.08)}}' +
        '#ph-rl .rl-res{display:none;margin-top:10px;align-items:center;gap:12px;padding:8px 10px;border-radius:14px;background:rgba(250,204,21,.1);border:1px solid rgba(250,204,21,.45)}#ph-rl.done .rl-res{display:flex}' +
        '#ph-rl .rl-res canvas{flex:none;width:54px;height:54px;border-radius:10px}#ph-rl .rl-res b{display:block;color:#fde047;font-size:16px;letter-spacing:.04em}#ph-rl .rl-res p{margin:3px 0 0;color:#e2e8f0;font:700 11px/1.35 Jura,Arial,sans-serif}' +
        '#ph-rl .rl-x{position:absolute;right:10px;top:8px;width:28px;height:28px;border-radius:9px;border:1px solid #475569;background:rgba(15,23,42,.8);color:#cbd5e1;font:700 14px/1 Arial;cursor:pointer;pointer-events:auto}' +
        '@media (orientation:landscape) and (max-height:500px){#ph-rl{top:calc(env(safe-area-inset-top,0px) + 44px);width:min(500px,70vw)}#ph-rl .rl-win{height:76px}#ph-rl .rl-it{width:62px;height:62px}#ph-rl .rl-it canvas{width:56px;height:56px}#ph-rl .rl-tape{top:6px}#ph-rl h3{font-size:14px}#ph-rl .rl-sub{margin-bottom:6px}}';
    var st = document.createElement('style'); st.id = 'ph-rl-css'; st.textContent = CSS; document.head.appendChild(st);

    function curMap() { var r = typeof currentRoomData !== 'undefined' && currentRoomData; return (r && MAP_DATA[r.map]) || MAP_DATA.epic_map; }
    // мініатюра предмета: на тлі землі мапи, так само, як його малює світ
    function icon(cv, mp, t) {
        var g = cv.getContext('2d'), W = cv.width, o = MapObj.phObj(mp, t, 0, 0), k = Math.min(1.25, (W - 12) / Math.max(o.w || 50, o.h || 50));
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, W);
        g.fillStyle = mp.bg || '#3f3f46'; g.fillRect(0, 0, W, W);
        g.strokeStyle = mp.grid || 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, W); g.moveTo(0, W / 2); g.lineTo(W, W / 2); g.stroke();
        g.setTransform(k, 0, 0, k, W / 2, W / 2);
        try {
            if (typeof MapFX !== 'undefined') { var kind = MapFX.solidKind(o); if (kind === 'block') MapFX.drawBlock(g, o, MapFX.themeOf(mp), {}); else { MapFX.propShadow(g, o); MapObj.drawProp(g, o, 0); } }
            else MapObj.drawDisguise(g, o, 0);
        } catch (e) {}
        g.setTransform(1, 0, 0, 1, 0, 0);
    }
    var el = null, hideT = 0, spinT = 0;
    function build() {
        if (el) return el;
        el = document.createElement('div'); el.id = 'ph-rl'; el.setAttribute('role', 'status');
        el.innerHTML = '<div class="rl-box"><button type="button" class="rl-x" aria-label="Закрити">✕</button><h3>🎲 РУЛЕТКА МАСКУВАННЯ</h3><div class="rl-sub"></div>' +
            '<div class="rl-win"><div class="rl-tape"></div><div class="rl-mk"></div></div>' +
            '<div class="rl-res"><canvas width="108" height="108"></canvas><div><b></b><p></p></div></div></div>';
        document.body.appendChild(el);
        el.querySelector('.rl-x').addEventListener('click', hide);
        return el;
    }
    function hide() { clearTimeout(hideT); clearTimeout(spinT); if (el) el.classList.remove('on'); }
    function myProp() {
        var r = currentRoomData, me = r && r.players && r.players[myId];
        return (typeof myLocalTank !== 'undefined' && myLocalTank.propType) || (me && me.propType) || null;
    }
    function hint() {
        var touch = document.documentElement.classList.contains('ctl-touch'), key = window.KB ? KB.label('fire') : tt('Пробіл');
        return touch ? tt('Стань поруч із такими ж предметами і відпусти правий джойстик — танк стане предметом і стане рівно в клітинку.')
            : tt('Стань поруч із такими ж предметами і натисни') + ' ' + key + ' / ' + tt('ЛКМ') + ' — ' + tt('танк стане предметом і стане рівно в клітинку.');
    }

    window.showPropMenu = function () {
        if (typeof currentRoomData === 'undefined' || !currentRoomData || currentRoomData.mode !== 'prophunt' || myLocalTank.team !== 'hider') return;
        var mp = curMap(), inf = MapObj.phInfo(mp), pool = inf.pool.slice(), target = myProp();
        if (!target) return;
        if (pool.indexOf(target) < 0) pool.push(target);
        build(); hide();
        var tape = el.querySelector('.rl-tape'), win = el.querySelector('.rl-win');
        el.classList.remove('done');
        el.querySelector('.rl-sub').textContent = tt('Предмети з мапи') + ' «' + (mp.title || currentRoomData.map) + '» · ' + pool.length + ' ' + tt('видів');
        // стрічка: ~44 випадкові предмети (без двох однакових поспіль), переможець — 38-й
        var N = 44, WIN = 38, seq = [], prev = null;
        for (var i = 0; i < N; i++) {
            var t = i === WIN ? target : pool[Math.floor(Math.random() * pool.length)];
            if (i !== WIN && pool.length > 1) { var guard = 0; while ((t === prev || (i === WIN - 1 || i === WIN + 1) && t === target) && guard++ < 10) t = pool[Math.floor(Math.random() * pool.length)]; }
            seq.push(t); prev = t;
        }
        var cache = {};
        tape.innerHTML = seq.map(function () { return '<div class="rl-it"><canvas width="96" height="96"></canvas></div>'; }).join('');
        tape.querySelectorAll('canvas').forEach(function (cv, i) {
            var t = seq[i];
            if (cache[t]) { cv.getContext('2d').drawImage(cache[t], 0, 0); return; }
            icon(cv, mp, t); cache[t] = cv;
        });
        tape.style.transition = 'none'; tape.style.transform = 'translateX(0px)';
        el.classList.add('on');
        // розмір елемента беремо з розмітки (на телефоні в ландшафті він менший)
        requestAnimationFrame(function () {
            var it = tape.firstElementChild, iw = it ? it.offsetWidth + 4 : 84, cw = win.offsetWidth;
            var end = -(WIN * iw + iw / 2 - cw / 2) + (Math.random() - 0.5) * iw * 0.55;
            void tape.offsetWidth;
            tape.style.transition = 'transform 4.2s cubic-bezier(.08,.72,.16,1)'; tape.style.transform = 'translateX(' + end.toFixed(1) + 'px)';
            var snd = window.UISFX && UISFX.roll(tape);
            if (!snd && typeof playSound === 'function') try { playSound('ui_click'); } catch (e) {}
            spinT = setTimeout(function () {
                var w = tape.children[WIN]; if (w) w.classList.add('win');
                var name = tt(MapObj.nameOf(target)), n = inf.count && inf.count[target];
                el.querySelector('.rl-res b').textContent = tt('Ти — ') + name + '!';
                el.querySelector('.rl-res p').textContent = (n ? tt('Таких на мапі') + ': ' + n + '. ' : '') + hint();
                icon(el.querySelector('.rl-res canvas'), mp, target);
                el.classList.add('done');
                if (window.UISFX) UISFX.reveal('rare');
                hideT = setTimeout(hide, 6500);
            }, 4300);
        });
    };
    // будь-який вихід з бою / новий матч — прибираємо
    if (typeof socket !== 'undefined') {
        socket.on('gameStarting', hide);
        socket.on('phPhaseChange', function (d) { if (d && d.phase === 'seeking') setTimeout(hide, 1500); });
    }
})();
