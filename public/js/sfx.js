/* sfx.js — пакет бойових звуків (public/sfx/*.mp3): постріли, влучання, 5 ступенів «болю» за рівнем HP, підбирання за рідкістю,
 * перезарядка, серцебиття при критичному HP, аірдроп. Працює поверх audio.js: перехоплює playSound() лише під час гри,
 * а в меню лишає старі синтезовані звуки. Якщо файли ще не завантажились — працює старий звук (нічого не ламається). */
(function () {
    'use strict';
    var NAMES = ['shot_cannon_1', 'shot_cannon_2', 'shot_cannon_3', 'shot_minigun_1', 'shot_minigun_2', 'shot_minigun_3', 'shot_shotgun_1', 'shot_shotgun_2',
        'shot_samurai_1', 'shot_samurai_2', 'shot_boss_1', 'shot_boss_2', 'explosion_1', 'explosion_2', 'hit_dealt_1', 'hit_dealt_2', 'hit_dealt_3', 'hit_kill',
        'hurt_t1_a', 'hurt_t1_b', 'hurt_t2_a', 'hurt_t2_b', 'hurt_t3_a', 'hurt_t3_b', 'hurt_t4_a', 'hurt_t4_b', 'hurt_t5_a', 'hurt_t5_b',
        'heartbeat', 'death', 'pickup_buff', 'pickup_common', 'pickup_rare', 'pickup_epic', 'pickup_legendary', 'pickup_mythic',
        'reload_light', 'reload_heavy', 'drop_warn', 'drop_land', 'final_loot', 'zone'];
    var GAIN = { shot_cannon: 0.85, shot_minigun: 0.6, shot_shotgun: 0.9, shot_samurai: 0.9, shot_boss: 1, explosion: 1, hit_dealt: 0.75, hit_kill: 0.9, hurt: 1, heartbeat: 0.9,
        death: 1, pickup: 0.8, reload: 0.5, drop: 1, final_loot: 0.9, zone: 0.8 };
    var buf = {}, loading = false, loaded = 0, active = 0, lastAt = {}, lastVar = {}, lastHp = null, hbAt = 0, reloadT = 0, dbg = [];
    var AC = function () { try { return typeof audioCtx !== 'undefined' ? audioCtx : null; } catch (e) { return null; } };
    var vol = function () { try { return typeof volSfx === 'number' ? volSfx : 0.6; } catch (e) { return 0.6; } };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    function inGame() { var g = document.getElementById('game-screen'); return !!(g && !g.classList.contains('hidden') && typeof currentRoomData !== 'undefined' && currentRoomData); }

    // ---- завантаження: бойовий пакет тягнемо лише при вході в кімнату / старті гри (не в меню), без прелоаду ----
    var SLOW = false, retryAt = {}, pending = {}, passShot = false;
    try { var cn = navigator.connection; SLOW = !!(cn && (cn.saveData || /(^|-)(2g|3g)$/.test(cn.effectiveType || ''))); } catch (e) {}
    var CORE = ['shot_cannon_1', 'shot_cannon_2', 'shot_cannon_3', 'shot_minigun_1', 'shot_minigun_2', 'shot_minigun_3', 'shot_shotgun_1', 'shot_shotgun_2', 'shot_samurai_1', 'shot_samurai_2', 'shot_boss_1', 'shot_boss_2',
        'explosion_1', 'explosion_2', 'hit_dealt_1', 'hit_dealt_2', 'hit_dealt_3', 'hit_kill', 'hurt_t1_a', 'hurt_t3_a', 'hurt_t5_a', 'death', 'pickup_common'];   // для економного режиму; решта — за потребою
    function urlOf(n) { var v = window.__AV && window.__AV.sfx; return '/sfx/' + n + '.mp3' + (v ? '?v=' + v : ''); }
    function fetchOne(n) {
        var c = AC(); if (!c || buf[n] || pending[n] || (retryAt[n] && performance.now() < retryAt[n])) return; pending[n] = 1;
        var fail = function () { delete pending[n]; retryAt[n] = performance.now() + 15000; };    // збій мережі/декодування не ламає гру: працює синтезований звук, повтор не раніше ніж за 15 с
        fetch(urlOf(n)).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (ab) {
            var ok = function (b) { if (!buf[n]) { buf[n] = b; loaded++; } delete pending[n]; };
            var p = c.decodeAudioData(ab, ok, fail); if (p && p.then) p.then(ok, fail);
        }).catch(fail);
    }
    function load() { (SLOW ? CORE : NAMES).forEach(fetchOne); }
    function enterBattle() { setTimeout(load, 0); }
    if (typeof socket !== 'undefined' && socket && socket.on) { socket.on('joinedRoom', enterBattle); socket.on('gameStarting', enterBattle); }

    function pickVar(base, n) { var i = 1 + Math.floor(Math.random() * n); if (n > 1 && i === lastVar[base]) i = i % n + 1; lastVar[base] = i; return base + '_' + i; }
    function play(name, o) {
        o = o || {}; var c = AC(); if (!c || c.state !== 'running') return false; var b = buf[name]; if (!b) { fetchOne(name); return false; }
        var now = performance.now(); if (o.gap && lastAt[name] && now - lastAt[name] < o.gap) return false; if (active >= 26 && !o.force) return false; lastAt[name] = now;
        var s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = (o.rate || 1) * (1 + (Math.random() - 0.5) * (o.jit == null ? 0.07 : o.jit));
        var g = c.createGain(), gk = GAIN[name.replace(/_\d+$|_[ab]$/, '').replace(/_t\d$/, '').replace(/^(pickup|reload|drop)_.*/, '$1')] || GAIN[name.replace(/_\d+$/, '')] || 1;
        g.gain.value = vol() * (o.vol == null ? 1 : o.vol) * gk; s.connect(g);
        if (o.pan && c.createStereoPanner) { var p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -1, 1); g.connect(p); p.connect(c.destination); } else g.connect(c.destination);
        active++; s.onended = function () { active--; try { s.disconnect(); g.disconnect(); } catch (e) {} }; s.start(0); if (dbg.length > 60) dbg.shift(); dbg.push(name); return true;
    }

    // ---------- постріли (з урахуванням відстані й панорами) ----------
    function shot(d) {
        var t = d.type || 'none', name, o = {}, n = 3;
        if (t === 'minigun') { name = 'shot_minigun'; o.gap = 28; } else if (t === 'shotgun') { name = 'shot_shotgun'; n = 2; } else if (t === 'samurai') { name = 'shot_samurai'; n = 2; }
        else if (t.indexOf('boss') >= 0) { name = 'shot_boss'; n = 2; } else { name = 'shot_cannon'; o.rate = t === 'explosive' ? 0.86 : t === 'acid' ? 1.28 : (t === 'fast' || t === 'homing' || t === 'piercing' || t === 'hunter_gun') ? 1.1 : 1; }
        var own = typeof myId !== 'undefined' && d.owner === myId, att = 1;
        if (own) att = 0.8; else if (typeof myLocalTank !== 'undefined') {
            var dx = d.x - myLocalTank.x, dy = d.y - myLocalTank.y, dist = Math.hypot(dx, dy); if (dist > 1700) return true;
            att = Math.pow(1 - dist / 1700, 1.6) * 0.9; o.pan = clamp(dx / 900, -0.9, 0.9); if (att < 0.04) return true;
        }
        o.vol = att; var nm = pickVar(name, n); if (!buf[nm]) { fetchOne(nm); passShot = true; setTimeout(function () { passShot = false; }, 0); return undefined; }   // файл ще не прийшов — game.js зіграє синтезований постріл
        return play(nm, o);
    }
    // ---------- мої влучання по ворогу ----------
    function hitDealt() { return play(pickVar('hit_dealt', 3), { vol: 0.9 }); }
    // ---------- мене влучили: власний звук на кожному ступені здоров'я ----------
    function tierOf(pct) { return pct > 0.6 ? 1 : pct > 0.4 ? 2 : pct > 0.25 ? 3 : pct > 0.12 ? 4 : 5; }
    function onHp(cur, max) {
        if (lastHp === null) { lastHp = cur; return; } var prev = lastHp; lastHp = cur; if (!max) return;
        if (cur > prev + 0.5) return; var drop = prev - cur; if (drop < 0.5) return;
        if (prev <= 0) return;                                             // вже мертвий
        if (cur <= 0) { play('death', { force: true, jit: 0 }); return; }
        var bz = typeof ModesFX !== 'undefined' && ModesFX.outside && ModesFX.outside(myLocalTank.x, myLocalTank.y);
        if (bz && drop < max * 0.1) return;                                 // дрібні «тики» зони не озвучуємо, щоб не заглушувати влучання
        var pct = cur / max, tier = tierOf(pct), big = drop >= max * 0.25;
        play('hurt_t' + tier + '_' + (Math.random() < 0.5 ? 'a' : 'b'), { force: true, vol: big ? 1.15 : 0.95, jit: 0.05 });
        if (tier >= 4) hbAt = performance.now() + 700;                      // серцебиття починається одразу після важкого влучання
    }
    // серцебиття при критичному HP (< 25 %): що менше HP, то частіше й гучніше
    setInterval(function () {
        if (!inGame() || typeof myLocalTank === 'undefined' || myLocalTank.hp <= 0) return;
        var max = Math.round((typeof MAX_HP !== 'undefined' ? MAX_HP : 500) * (typeof GameData !== 'undefined' && typeof myEquipped !== 'undefined' ? GameData.statMult(myEquipped, 'hp') : 1)), pct = myLocalTank.hp / max;
        if (pct >= 0.25) return; var now = performance.now(), iv = 1150 - 700 * clamp((0.25 - pct) / 0.2, 0, 1);
        if (now >= hbAt) { hbAt = now + iv; play('heartbeat', { vol: 0.5 + 0.5 * clamp((0.25 - pct) / 0.2, 0, 1), jit: 0.02, force: true }); }
    }, 120);
    // ---------- підбирання ----------
    var RLV = { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary', mythic: 'mythic' };
    function pickMod(rar) { return play('pickup_' + (RLV[rar] || 'common'), { force: true, jit: 0 }); }
    // ---------- перезарядка ----------
    function armReload(ms) {
        clearTimeout(reloadT); if (!(ms >= 650)) return;
        reloadT = setTimeout(function () { if (inGame() && typeof myLocalTank !== 'undefined' && myLocalTank.hp > 0) play(ms >= 1400 ? 'reload_heavy' : 'reload_light', { vol: 0.8 }); }, Math.max(80, ms - 60));
    }

    // ---------- перехоплення playSound() ----------
    var orig = window.playSound;
    if (typeof orig === 'function') {
        window.playSound = function (type) {
            if (loaded && inGame()) {
                switch (type) {
                    case 'hurt': return;                                              // у грі «біль» озвучується за зміною HP (onHp)
                    case 'hitmarker': if (hitDealt()) return; break;
                    case 'explosion': if (play(pickVar('explosion', 2), {})) return; break;
                    case 'boss_shoot': if (play(pickVar('shot_boss', 2), { vol: 0.7 })) return; break;
                    case 'powerup': if (play('pickup_buff', {})) return; break;
                    case 'shoot': case 'minigun': case 'samurai': if (passShot) { passShot = false; break; } return;             // постріли йдуть через SFX.shot (з відстанню)
                    case 'drop_warn': case 'drop_land': case 'final_loot': case 'zone': if (play(type, { force: true, jit: 0 })) return; break;
                }
            }
            return orig.apply(this, arguments);
        };
    }
    window.SFX = { load: load, play: play, shot: shot, hitDealt: hitDealt, onHp: onHp, pickMod: pickMod, armReload: armReload, tierOf: tierOf, ready: function () { return loaded; }, log: function () { return dbg.slice(); }, resetHp: function () { lastHp = null; } };
})();
