/* uisfx.js — звуки інтерфейсу: клік, наведення, вкладки, вікна, перемикачі, покупка, рулетка кейсів (тік за кожним предметом,
 * зупинка, відкриття за рідкістю) та апгрейдер (запуск, «зарядка» зі стрілкою, зупинка, успіх / провал).
 * Файли: public/sfx/{ui,case,roll,reveal,upg}_*.mp3. Якщо файли ще не завантажились — працює старий синтезований звук. */
(function () {
    'use strict';
    var NAMES = ['ui_hover', 'ui_click', 'ui_tab', 'ui_back', 'ui_open', 'ui_close', 'ui_on', 'ui_off', 'ui_confirm', 'ui_error', 'ui_buy', 'ui_sell', 'ui_equip', 'ui_slot', 'ui_screen', 'ui_notify', 'ui_tick', 'ui_invite', 'ui_friend',
        'case_confirm', 'roll_start', 'roll_tick_1', 'roll_tick_2', 'roll_tick_3', 'roll_stop', 'reveal_common', 'reveal_rare', 'reveal_epic', 'reveal_legendary', 'reveal_mythic',
        'upg_start', 'upg_charge', 'upg_tick_1', 'upg_tick_2', 'upg_stop', 'upg_win', 'upg_fail'];
    var GAIN = { ui_hover: 0.22, ui_click: 0.6, ui_tab: 0.55, ui_back: 0.55, ui_open: 0.5, ui_close: 0.45, ui_on: 0.55, ui_off: 0.5, ui_confirm: 0.6, ui_error: 0.55, ui_buy: 0.7, ui_sell: 0.6, ui_equip: 0.65, ui_slot: 0.65,
        ui_screen: 0.4, ui_notify: 0.55, ui_tick: 0.35, ui_invite: 0.95, ui_friend: 0.75, case_confirm: 0.75, roll_start: 0.7, roll_tick: 0.6, roll_stop: 0.8, reveal: 0.85, upg_start: 0.75, upg_charge: 0.6, upg_tick: 0.4, upg_stop: 0.8, upg_win: 0.9, upg_fail: 0.9 };
    var buf = {}, loading = false, loaded = 0, lastAt = {}, lastVar = {}, active = 0, lastClick = 0, lastAny = 0, armedAt = 0, raf = 0, dbg = [], loops = [];
    var AC = function () { try { return typeof audioCtx !== 'undefined' ? audioCtx : null; } catch (e) { return null; } };
    var vol = function () { try { return typeof volSfx === 'number' ? volSfx : 0.6; } catch (e) { return 0.6; } };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var now = function () { return performance.now(); };
    function inGame() { var g = document.getElementById('game-screen'); return !!(g && !g.classList.contains('hidden') && typeof currentRoomData !== 'undefined' && currentRoomData); }

    // ---- завантаження: меню-пакет після першого жесту; в економному режимі (saveData / 2g / 3g) — лише найнеобхідніше, решта за потребою ----
    var SLOW = false, retryAt = {}, pending = {};
    try { var cn = navigator.connection; SLOW = !!(cn && (cn.saveData || /(^|-)(2g|3g)$/.test(cn.effectiveType || ''))); } catch (e) {}
    var ESSENTIAL = ['ui_click', 'ui_back', 'ui_confirm', 'ui_error', 'ui_buy', 'ui_notify', 'ui_invite', 'ui_friend', 'ui_open', 'ui_close'];
    function urlOf(n) { var v = window.__AV && window.__AV.sfx; return '/sfx/' + n + '.mp3' + (v ? '?v=' + v : ''); }
    function fetchOne(n) {
        var c = AC(); if (!c || buf[n] || pending[n] || (retryAt[n] && performance.now() < retryAt[n])) return; pending[n] = 1;
        var fail = function () { delete pending[n]; retryAt[n] = performance.now() + 15000; };      // збій не критичний: працюють старі синтезовані звуки
        fetch(urlOf(n)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (ab) {
            var ok = function (b) { if (!buf[n]) { buf[n] = b; loaded++; } delete pending[n]; };
            var p = c.decodeAudioData(ab, ok, fail); if (p && p.then) p.then(ok, fail);
        }).catch(fail);
    }
    function bundleReady(list) { if (!SLOW) return true; var ok = true; list.forEach(function (n) { if (!buf[n]) { ok = false; fetchOne(n); } }); return ok; }   // економний режим: набір підтягується при першому використанні, а цього разу грає синтезований звук
    function load() { loading = true; (SLOW ? ESSENTIAL : NAMES).forEach(fetchOne); }
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(function (ev) { document.addEventListener(ev, function once() { setTimeout(load, 200); document.removeEventListener(ev, once, true); }, true); });

    function play(name, o) {
        o = o || {}; var c = AC(); if (!c || c.state !== 'running') return null; var b = buf[name]; if (!b) { if (SLOW && NAMES.indexOf(name) >= 0) fetchOne(name); return null; }
        var t = now(); if (o.gap && lastAt[name] && t - lastAt[name] < o.gap) return null; if (active >= 20 && !o.force) return null; lastAt[name] = t; lastAny = t;
        var s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.jit == null ? 0.03 : o.jit));
        var base = name.replace(/_\d+$/, ''), g = c.createGain(), gk = GAIN[base] != null ? GAIN[base] : (GAIN[name.replace(/_.*$/, '')] || 0.7);
        g.gain.value = vol() * (o.vol == null ? 1 : o.vol) * gk; s.connect(g); g.connect(c.destination);
        active++; s.onended = function () { active--; try { s.disconnect(); g.disconnect(); } catch (e) {} };
        s.start(0); if (dbg.length > 80) dbg.shift(); dbg.push(name); s._g = g; return s;
    }
    function fadeStop(s, ms) { if (!s) return; try { var c = AC(), g = s._g.gain; g.setValueAtTime(g.value, c.currentTime); g.linearRampToValueAtTime(0, c.currentTime + ms / 1000); s.stop(c.currentTime + ms / 1000 + 0.02); } catch (e) {} }
    function pickVar(base, n) { var i = 1 + Math.floor(Math.random() * n); if (n > 1 && i === lastVar[base]) i = i % n + 1; lastVar[base] = i; return base + '_' + i; }

    // ---------- делеговані події інтерфейсу ----------
    var INTER = 'button,a,[onclick],[role=button],[role=tab],summary,select,.up-card,.sh-card,label.cursor-pointer,[data-wl-tab],[data-wl-go]';
    var CLOSE_RE = /close|cancel|back|exit|скас|закри|назад/i;
    function kindOf(el) {
        var id = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''), tx = (el.textContent || '').trim().slice(0, 24);
        if (el.getAttribute('role') === 'tab' || el.hasAttribute('data-wl-tab') || /(^|[\s-_])tab/i.test(id)) return 'ui_tab';
        if (CLOSE_RE.test(id) || /^(✕|×|✖|x)$/i.test(tx) || /^(закрити|назад|скасувати|відміна)/i.test(tx)) return 'ui_back';
        if (/confirm-case/.test(id)) return null;                                           // озвучується окремо (case_confirm)
        if (/upg-action/.test(id)) return null;                                              // озвучується окремо (upg_start)
        if (/sell|продат/i.test(id + tx)) return 'ui_sell';
        if (/equip|одягн|встанов/i.test(id + tx)) return 'ui_equip';
        return 'ui_click';
    }
    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest(INTER) : null; if (!el || el.disabled) return;
        if (el.matches('input[type=checkbox],input[type=radio]') || (el.tagName === 'LABEL' && el.querySelector('input[type=checkbox],input[type=radio]'))) return;   // перемикачі — у change
        if (el.tagName === 'SELECT') return;
        var k = kindOf(el); if (!k) { lastClick = now(); return; }
        lastClick = now(); if (!play(k, { gap: 40 }) && !loaded) { /* старий звук зіграє сам виклик playSound */ lastClick = 0; }
    }, true);
    document.addEventListener('change', function (e) {
        var t = e.target; if (!t || !t.matches) return;
        if (t.matches('input[type=checkbox]')) { lastClick = now(); play(t.checked ? 'ui_on' : 'ui_off', { gap: 40 }); }
        else if (t.matches('input[type=radio]') || t.tagName === 'SELECT') { lastClick = now(); play('ui_tab', { gap: 40 }); }
    }, true);
    document.addEventListener('input', function (e) {
        var t = e.target; if (!t || !t.matches || !t.matches('input[type=range]')) return;
        var mn = +t.min || 0, mx = +t.max || 100, p = clamp(((+t.value) - mn) / ((mx - mn) || 1), 0, 1);
        play('ui_tick', { gap: 45, rate: 0.85 + p * 0.5, jit: 0.01 });
    }, true);
    var lastHover = null;
    document.addEventListener('pointerover', function (e) {
        if (e.pointerType !== 'mouse' || inGame()) return; var el = e.target && e.target.closest ? e.target.closest(INTER) : null;
        if (!el || el === lastHover || el.disabled) return; lastHover = el; play('ui_hover', { gap: 50 });
    }, true);
    document.addEventListener('pointerout', function (e) { if (lastHover && !lastHover.contains(e.relatedTarget)) lastHover = null; }, true);

    // ---------- відкриття / закриття вікон ----------
    var MODAL_RE = /modal|(^|[\s-_])dlg($|[\s-_])|wl-back|overlay|prop-selection-menu/i, SKIP_RE = /roulette|reward|hitmarker|blind|loading|toast|hud|banner|tooltip|damage|flash/i;
    function isShown(el) { return !el.hidden && !el.classList.contains('hidden') && !el.classList.contains('wl-out'); }
    var shownMap = new WeakMap();
    function check(el) {
        if (!el || el.nodeType !== 1 || now() - armedAt < 0) return;
        var sig = (el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''); if (!MODAL_RE.test(sig) || SKIP_RE.test(sig)) return;
        var cs = shownMap.get(el), sh = isShown(el); shownMap.set(el, sh); if (cs === undefined || cs === sh) return;
        if (now() < armedAt) return; play(sh ? 'ui_open' : 'ui_close', { gap: 90, vol: sh ? 1 : 0.8 });
    }
    function startObserver() {
        armedAt = now() + 1500;
        document.querySelectorAll('[id],[class]').forEach(function (el) { if (MODAL_RE.test((el.id || '') + ' ' + (typeof el.className === 'string' ? el.className : ''))) shownMap.set(el, isShown(el)); });
        new MutationObserver(function (ms) {
            ms.forEach(function (m) {
                if (m.type === 'attributes') check(m.target);
                else m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && MODAL_RE.test((n.id || '') + ' ' + (typeof n.className === 'string' ? n.className : '')) && !SKIP_RE.test(n.id || '')) { shownMap.set(n, isShown(n)); } });
            });
        }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'], childList: true });
    }
    if (document.body) startObserver(); else document.addEventListener('DOMContentLoaded', startObserver);

    // зміна екранів (showScreen)
    window.addEventListener('load', function () {
        var ss = window.showScreen; if (typeof ss !== 'function') return;
        window.showScreen = function (id) { var r = ss.apply(this, arguments); if (id !== 'game-screen') play('ui_screen', { gap: 150 }); return r; };
    });

    // ---------- рулетка кейсу ----------
    function stopLoops() { loops.forEach(function (f) { f(); }); loops = []; cancelAnimationFrame(raf); }
    function curX(el) { try { var m = new DOMMatrix(getComputedStyle(el).transform); return m.m41; } catch (e) { return 0; } }
    function roll(tape) {
        if (!loaded || !bundleReady(['roll_start', 'roll_tick_1', 'roll_tick_2', 'roll_tick_3', 'roll_stop'])) return false; stopLoops(); play('roll_start', { force: true, jit: 0 });
        var itemW = (tape.firstElementChild && tape.firstElementChild.offsetWidth) || 60, cw = (tape.parentElement && tape.parentElement.offsetWidth) || 600;
        var lastIdx = -1, lastX = 0, lastT = now(), t0 = lastT, still = 0, stopped = false, stopT = 0;
        function stopSnd() { if (stopped) return; stopped = true; play('roll_stop', { force: true, jit: 0 }); }
        function step() {
            var x = curX(tape), t = now(), dt = Math.max(1, t - lastT), v = Math.abs(x - lastX) / dt;   // px/мс
            var idx = Math.floor((-x + cw / 2) / itemW);
            if (idx !== lastIdx && lastIdx !== -1 && v > 0.001) {
                var sp = clamp(v / 4, 0, 1);                                               // швидко → тихіше й густіше
                play(pickVar('roll_tick', 3), { vol: 1 - 0.55 * sp, rate: 0.92 + 0.35 * (1 - sp) * 0.5 + 0.12 * sp, gap: 11, jit: 0.05 });
            }
            lastIdx = idx; if (v < 0.003 && t - t0 > 800) { still++; } else still = 0;
            if (!stopped && (still > 4 || t - t0 > 3900)) { stopSnd(); }
            lastX = x; lastT = t; if (t - t0 < 4600 && !stopped) raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step); loops.push(function () { stopped = true; }); return true;
    }
    function reveal(rar) { if (!loaded) return false; var n = ['common', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rar) >= 0 ? rar : 'common'; if (!bundleReady(['reveal_' + n])) return false; return !!play('reveal_' + n, { force: true, jit: 0 }); }
    function caseConfirm() { return !!play('case_confirm', { force: true, jit: 0 }); }

    // ---------- апгрейдер ----------
    function upgStart() { return !!play('upg_start', { force: true, jit: 0 }); }
    function upgRun(pointer) {
        if (!loaded || !bundleReady(['upg_charge', 'upg_tick_1', 'upg_tick_2', 'upg_stop'])) return false; stopLoops(); var ch = play('upg_charge', { force: true, jit: 0 });
        var par = pointer.parentElement, W = (par && par.offsetWidth) || 1, lastBin = -1, lastX = 0, lastT = now(), t0 = lastT, still = 0, stopped = false;
        function step() {
            var left = pointer.getBoundingClientRect().left - (par ? par.getBoundingClientRect().left : 0), p = clamp(left / W, 0, 1), t = now(), dt = Math.max(1, t - lastT), v = Math.abs(left - lastX) / dt;
            var bin = Math.floor(p * 40);
            if (bin !== lastBin && lastBin !== -1 && v > 0.002) play(pickVar('upg_tick', 2), { vol: clamp(0.35 + 0.65 * (1 - v / 3), 0.3, 1), rate: 0.85 + p * 0.5, gap: 28, jit: 0.02 });
            lastBin = bin; if (v < 0.004 && t - t0 > 700) still++; else still = 0;
            if (!stopped && (still > 5 || t - t0 > 3200)) { stopped = true; fadeStop(ch, 120); play('upg_stop', { force: true, jit: 0 }); }
            lastX = left; lastT = t; if (t - t0 < 3600 && !stopped) raf = requestAnimationFrame(step);
        }
        raf = requestAnimationFrame(step); loops.push(function () { stopped = true; fadeStop(ch, 60); }); return true;
    }
    function upgWin(rar) { if (!loaded || !bundleReady(['upg_win'])) return false; stopLoops(); play('upg_win', { force: true, jit: 0 }); if (rar === 'legendary' || rar === 'mythic') setTimeout(function () { play('reveal_' + rar, { force: true, jit: 0, vol: 0.55 }); }, 450); return true; }
    function upgFail() { if (!loaded) return false; stopLoops(); return !!play('upg_fail', { force: true, jit: 0 }); }

    // ---------- перехоплення playSound() ----------
    var orig = window.playSound;
    if (typeof orig === 'function') {
        window.playSound = function (type) {
            if (loaded) {
                var sinceClick = now() - lastClick;
                switch (type) {
                    case 'ui_click': if (sinceClick < 150 || now() - lastAny < 60) return; if (play('ui_click', { gap: 40 })) return; break;
                    case 'ui_buy': { var cm = document.getElementById('case-confirm-modal'); if (cm && !cm.classList.contains('hidden')) { if (caseConfirm()) return; } else if (play('ui_buy', { force: true })) return; break; }
                    case 'hurt': if (!inGame() && play('ui_error', { force: true })) return; break;
                    case 'powerup': if (!inGame() && play('ui_confirm', { force: true })) return; break;
                    case 'token': if (!inGame() && play('ui_notify', { force: true })) return; break;
                }
            }
            return orig.apply(this, arguments);
        };
    }
    window.UISFX = { load: load, play: play, roll: roll, reveal: reveal, caseConfirm: caseConfirm, upgStart: upgStart, upgRun: upgRun, upgWin: upgWin, upgFail: upgFail, ready: function () { return loaded; }, log: function () { return dbg.slice(); } };
})();
