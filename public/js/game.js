let canvas = document.getElementById('game-canvas');
let ctx = canvas.getContext('2d');
if (window.GFX) GFX.attach(ctx);

// ФІКСОВАНИЙ МАСШТАБ ГРИ: по висоті екрана гравець завжди бачить однакову ділянку мапи (VIEW_H одиниць),
// тому зменшення масштабу браузера (Ctrl -), великий монітор чи планшет не дають бачити більше за інших.
// Телефони/планшети: видимість +20% за замовчуванням (VIEW_TOUCH_DEFAULT); у налаштуваннях від 1.0 (старий масштаб) до 1.8 (за замовчуванням 1.2).
const VIEW_H_DESKTOP = 800, VIEW_H_TOUCH = 420, VIEW_MAX_ASPECT = 2.0, VIEW_TOUCH_DEFAULT = 1.2, VIEW_TOUCH_MAXZOOM = 1.8;
let viewZoom = VIEW_TOUCH_DEFAULT;
try { const _z = parseFloat(localStorage.getItem('viewZoom')); if (_z >= 1 && _z <= VIEW_TOUCH_MAXZOOM) viewZoom = _z; } catch (e) {}
let VS = 1; // множник «одиниця світу -> піксель екрана»
let GW = window.innerWidth, GH = window.innerHeight, RS = 1; // GW/GH — логічний розмір (CSS-пікселі), RS — масштаб внутрішнього розширення полотна (налаштування графіки)
function fitCanvas() {
    RS = (window.GFX && GFX.rs) || 1; GW = window.innerWidth; GH = window.innerHeight;
    canvas.width = Math.max(1, Math.round(GW * RS)); canvas.height = Math.max(1, Math.round(GH * RS));
    const touch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches, VH = touch ? VIEW_H_TOUCH * viewZoom : VIEW_H_DESKTOP;
    VS = Math.max(GH / VH, GW / (VH * VIEW_MAX_ASPECT)); // надширокі екрани не бачать більше, ніж 2:1
    VS = Math.min(VS, GW / (VH * 0.9)); // вузький портретний екран не стискаємо до смужки
}
window.fitCanvas = fitCanvas;
window.addEventListener('resize', fitCanvas);
fitCanvas();
(function () { // повзунок «Масштаб інтерфейсу» (меню, вікна, кнопки) — окремо від камери
    const sl = document.getElementById('ui-scale'), lab = document.getElementById('ui-scale-val'); if (!sl || !window.getUiScale) return;
    const show = () => { if (lab) lab.textContent = Math.round(sl.value * 100) + '%'; };
    if (!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches)) sl.max = 1; // на ПК збільшувати вже нікуди (межа розкладки), лише зменшувати
    sl.value = window.getUiScale(); show();
    sl.addEventListener('input', () => { show(); window.setUiScale(parseFloat(sl.value) || 1); });
})();
(function () { // повзунок «Віддалення камери» (лише на пристроях із дотиком)
    const row = document.getElementById('view-zoom-row'), sl = document.getElementById('view-zoom'), lab = document.getElementById('view-zoom-val');
    if (!row || !sl) return;
    const touch = window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!touch) return; row.style.display = '';
    const show = () => { if (lab) lab.textContent = Math.round(viewZoom * 100) + '%'; };
    sl.min = 1; sl.max = VIEW_TOUCH_MAXZOOM; sl.step = 0.02; sl.value = viewZoom; show();
    sl.addEventListener('input', () => { viewZoom = Math.min(VIEW_TOUCH_MAXZOOM, Math.max(1, parseFloat(sl.value) || VIEW_TOUCH_DEFAULT)); try { localStorage.setItem('viewZoom', String(viewZoom)); } catch (e) {} show(); fitCanvas(); });
})();

let spectatingId = null;
let isBossIncoming = false;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let joysticks = {
    left: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, angle: 0, force: 0, id: null },
    right: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, angle: 0, force: 0, id: null, hasAimed: false, released: false }
};

let BASE_RELOAD = 2000;
const isTeamM = m => m === 'team_deathmatch' || m === 'capture_points';   // командні PvP: свої не отримують шкоди
const isPveM = m => !!(window.ModeInfo && ModeInfo.isPve(m));            // режими із зомбі/босами (виживання й нові кооп/соло)
const canSpecM = m => m !== 'deathmatch';                                // де після смерті спостерігаємо за живими
let mines = {};
let lasers = [];

window.getTankSpeed = function() {
    let spd = BASE_SPEED;
    spd *= GameData.statMult(myEquipped, 'speed');
    if (myLocalTank.buff === 'speed') spd *= 1.5;
    if (myLocalTank.buff === 'samurai') spd *= 1.6;
    if (myLocalTank.buff === 'boss') spd *= 0.6;
    if (window.PERK) spd *= PERK.spd || 1;
    return spd;
};

window.getReloadTime = function() {
    let cd = BASE_RELOAD;
    cd *= GameData.statMult(myEquipped, 'cd');
    if (window.PERK) cd *= PERK.cd || 1;
    return cd;
};

function createExplosion(x, y, count, color) {
    const _fx = window.GFX ? GFX.fx : 1; count = Math.ceil(count * _fx);
    if (particles.length > (window.GFX ? GFX.partMax : 400)) return;
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * 200 + 50;
        particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: Math.random() * 0.4 + 0.1, color });
    }
}

function checkCollision(x, y, r, checkS = true, isB = false) {
    if (!currentRoomData) return true;
    let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map', m = MAP_DATA[cMap];
    if (!checkS) { // лише межі мапи та фігурний контур
        if (x - r < 0 || x + r > m.size || y - r < 0 || y + r > m.size) return true;
        return MapObj.hasShape(m) && !MapObj.circleInPoly(m.shape, x, y, r);
    }
    return MapObj.collides(m, x, y, r, { skipWater: isB });
}

function checkPCollision(nX, nY, rad) {
    if (!currentRoomData || currentRoomData.mode !== 'prophunt') return false;
    for (let id in opponents) {
        let op = opponents[id];
        if (op.hp > 0 && op.isDisguised) {
            let pX = op.x - 25, pY = op.y - 25, tX = nX, tY = nY;
            if (nX < pX) tX = pX; else if (nX > pX + 50) tX = pX + 50;
            if (nY < pY) tY = pY; else if (nY > pY + 50) tY = pY + 50;
            if (Math.hypot(nX - tX, nY - tY) <= rad) return true;
        }
    }
    return false;
}

function findNextSpec(dir) {
    if (!currentRoomData) return;
    let aO = Object.keys(currentRoomData.players).filter(id => currentRoomData.players[id].hp > 0 && id !== myId);
    if (aO.length === 0) { spectatingId = null; return; }
    if (!spectatingId || !aO.includes(spectatingId)) spectatingId = aO[0];
    else spectatingId = aO[(aO.indexOf(spectatingId) + dir + aO.length) % aO.length];
}

let _mvAt = 0, _mvLast = {};
function updatePhys(now, dt) {
    if (!currentRoomData || !currentRoomId) return;
    // myRad — фізичне тіло (стіни, декор, двері): менше за клітинку 50, щоб вільно проходити між об'єктами; myHitRad — хітбокс для куль і підбору (візуальний, як і раніше)
    let myRad = myLocalTank.buff === 'boss' ? 75 : PLAYER_BODY_R, myHitRad = myLocalTank.buff === 'boss' ? 75 : 24;
    {   // авто-двері: відкриваються, коли поруч танк
        const _dm = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map';
        if (window._doorMapName !== currentRoomId + _dm) { window._doorMapName = currentRoomId + _dm; MapObj.resetDoors(MAP_DATA[_dm]); }
        const _act = []; if (myLocalTank.hp > 0) _act.push({ x: myLocalTank.x, y: myLocalTank.y, r: myRad });
        for (let _id in opponents) { const _o = opponents[_id]; if (_o.hp > 0) _act.push({ x: _o.x, y: _o.y, r: 24 }); }
        MapObj.updateDoors(MAP_DATA[_dm], _act, dt);
    }
    
    if (myLocalTank.hp <= 0) {
        if (joysticks.left.active || joysticks.right.active || joysticks.left.force) resetJoysticks();
        if (spectatingId && opponents[spectatingId]) {
            camera.x += (opponents[spectatingId].x - camera.x) * 5 * dt;
            camera.y += (opponents[spectatingId].y - camera.y) * 5 * dt;
        }
    } else {
        let mx = 0, my = 0, spd = window.getTankSpeed();
        if (keys.w) my -= 1; if (keys.s) my += 1; if (keys.a) mx -= 1; if (keys.d) mx += 1;
        
        if (joysticks.left.active) {
            mx = Math.cos(joysticks.left.angle) * joysticks.left.force;
            my = Math.sin(joysticks.left.angle) * joysticks.left.force;
        }
        
        if (mx !== 0 || my !== 0) {
            if (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider' && myLocalTank.isDisguised) {
                myLocalTank.isDisguised = false;
                socket.emit('updateDisguise', { roomId: currentRoomId, state: false, x: myLocalTank.x, y: myLocalTank.y });
            }
            let len = Math.hypot(mx, my);
            if (len > 1 && !joysticks.left.active) { mx /= len; my /= len; }
            myLocalTank.bodyAngle = Math.atan2(my, mx);
            let nX = myLocalTank.x + mx * spd * dt, nY = myLocalTank.y + my * spd * dt, isB = myLocalTank.buff === 'boss';
            
            if (!checkCollision(nX, myLocalTank.y, myRad, true, isB) && !checkPCollision(nX, myLocalTank.y, myRad) || isB) myLocalTank.x = nX;
            if (!checkCollision(myLocalTank.x, nY, myRad, true, isB) && !checkPCollision(myLocalTank.x, nY, myRad) || isB) myLocalTank.y = nY;
        }
        
        {
            let tgtA = null;
            if (joysticks.right.active) tgtA = joysticks.right.angle;
            else if (!isMobile && !myLocalTank.isDisguised) tgtA = Math.atan2(mouseY - (GH / 2), mouseX - (GW / 2));
            if (tgtA !== null) {
                let rotMul = 1;
                rotMul = GameData.statMult(myEquipped, 'rotSpeed');
                let maxStep = BASE_TURRET_ROT * rotMul * dt, diff = Math.atan2(Math.sin(tgtA - myLocalTank.turretAngle), Math.cos(tgtA - myLocalTank.turretAngle));
                myLocalTank.turretAngle = Math.abs(diff) <= maxStep ? tgtA : myLocalTank.turretAngle + Math.sign(diff) * maxStep;
            }
        }
        
        // позицію шлемо не частіше 20 разів/с і лише коли щось змінилось (раніше — кожен кадр, 60+ разів/с)
        if (now - _mvAt >= 50) {
            const mx = Math.round(myLocalTank.x * 10) / 10, my = Math.round(myLocalTank.y * 10) / 10, mb = Math.round(myLocalTank.bodyAngle * 100) / 100, mt = Math.round(myLocalTank.turretAngle * 100) / 100;
            if (mx !== _mvLast.x || my !== _mvLast.y || mb !== _mvLast.b || mt !== _mvLast.t || now - _mvAt >= 1000) {
                _mvAt = now; _mvLast = { x: mx, y: my, b: mb, t: mt };
                (socket.volatile || socket).emit('move', { roomId: currentRoomId, x: mx, y: my, bodyAngle: mb, turretAngle: mt });
            }
        }
        
        let fCfg = window.BUFFS[myLocalTank.buff || 'none'] || window.BUFFS['none'];
        let tR = 1.0;
        
        if (currentRoomData.mode === 'prophunt') {
            if (myLocalTank.team === 'hunter') { fCfg = { cd: 1000, type: 'hunter_gun' }; tR = 1; } 
            else fCfg = { cd: 9999999, type: 'none' };
        } else {
            tR *= GameData.statMult(myEquipped, 'range');
        }
        
        let isMg = (myLocalTank.buff === 'minigun' || myLocalTank.buff === 'fast' || myLocalTank.buff === 'autolaser'), sh = false;
        
        if (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider') {
            if (!myLocalTank.isDisguised && (keys.space || keys.lmb || joysticks.right.released)) {
                myLocalTank.isDisguised = true;
                myLocalTank.x = Math.round((myLocalTank.x - 25) / 50) * 50 + 25;
                myLocalTank.y = Math.round((myLocalTank.y - 25) / 50) * 50 + 25;
                myLocalTank.bodyAngle = 0; myLocalTank.turretAngle = 0;
                socket.emit('updateDisguise', { roomId: currentRoomId, state: true, x: myLocalTank.x, y: myLocalTank.y });
                keys.space = false; keys.lmb = false; joysticks.right.released = false;
            }
        } else {
            if (!isMobile && (keys.space || keys.lmb)) sh = true;
            if (isMobile) {
                if (isMg) { if (joysticks.right.active && joysticks.right.hasAimed) sh = true; } 
                else if (joysticks.right.released) { sh = true; joysticks.right.released = false; }
            }
        }
        
        let rt = window.getReloadTime();
        if (fCfg.type !== 'none' && fCfg.cd) rt = (fCfg.cd < 500 ? fCfg.cd : rt);
        
        if (sh && (now - lastShootTime >= rt) && !(currentRoomData.mode === 'prophunt' && currentRoomData.state !== 'seeking')) {
            fireBull(now, myHitRad, fCfg, tR);
        } else if (isMobile && !isMg && joysticks.right.released) {
            joysticks.right.released = false;
        }
        
        for (let pid in powerups) if (Math.hypot(powerups[pid].x - myLocalTank.x, powerups[pid].y - myLocalTank.y) < myHitRad + 30) socket.emit('collectPowerup', { roomId: currentRoomId, pid: pid });
        for (let tid in tokens) if (Math.hypot(tokens[tid].x - myLocalTank.x, tokens[tid].y - myLocalTank.y) < myHitRad + 25) socket.emit('collectToken', { roomId: currentRoomId, tid: tid });
        
        camera.x += (myLocalTank.x - camera.x) * 5 * dt;
        camera.y += (myLocalTank.y - camera.y) * 5 * dt;
    }
    
    for (let zid in zombies) { const z = zombies[zid]; if (z.tx !== undefined) { z.x += (z.tx - z.x) * Math.min(1, _ZSMOOTH * dt); z.y += (z.ty - z.y) * Math.min(1, _ZSMOOTH * dt); } }
    for (let id in opponents) {
        let o = opponents[id];
        if (o.targetX !== undefined) {
            if (Math.hypot(o.targetX - o.x, o.targetY - o.y) > 150) { o.x = o.targetX; o.y = o.targetY; } 
            else { o.x += (o.targetX - o.x) * Math.min(1, 15 * dt); o.y += (o.targetY - o.y) * Math.min(1, 15 * dt); }
            let db = o.targetBody - o.bodyAngle;
            while (db > Math.PI) db -= Math.PI * 2; while (db < -Math.PI) db += Math.PI * 2;
            o.bodyAngle += db * 15 * dt;
            let dtur = o.targetTurret - o.turretAngle;
            while (dtur > Math.PI) dtur -= Math.PI * 2; while (dtur < -Math.PI) dtur += Math.PI * 2;
            o.turretAngle += dtur * 25 * dt;
        }
    }
    
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        if (b.type === 'homing' && b.targetId) {
            let tgt = b.targetId === myId ? myLocalTank : opponents[b.targetId];
            if (tgt && tgt.hp > 0) {
                let ang = Math.atan2(tgt.y - b.y, tgt.x - b.x), cSpd = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(ang) * cSpd; b.vy = Math.sin(ang) * cSpd;
            }
        }
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        
        let hW = false, bC = window.BUFFS[b.type] || window.BUFFS['none'], isP = (b.type === 'samurai' || b.type === 'homing' || b.type.includes('piercing') || b.type === 'ghost_melee' || b.type === 'boss_proj');
        hW = checkCollision(b.x, b.y, 4, !isP, true);
        
        let isS = isPveM(currentRoomData.mode), hP = false, hZ = false;
        
        // ВАЖЛИВО: Беремо правильний базовий урон
        let bulletBaseDmg = window.BUFFS[b.type] ? window.BUFFS[b.type].dmg : 75;
        let actualDmg = b.dmgOverride || bulletBaseDmg;
        if (myLocalTank.buff === 'double_dmg') actualDmg *= 2; // Підтримка бафу на подвійний урон
        
        for (let oid in opponents) {
            let op = opponents[oid];
            if (op.hp > 0 && op.buff !== 'shield') {
                let oR = op.buff === 'boss' ? 75 : 24, hD = b.type === 'samurai' ? oR + 30 : oR + 4;
                if (Math.hypot(b.x - op.x, b.y - op.y) < hD) {
                    hP = true;
                    if (b.owner === myId) {
                        if (isTeamM(currentRoomData.mode) && myLocalTank.team === op.team) continue;
                        // Відправляємо обчислений урон
                        socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: actualDmg, type: b.type });
                    }
                    break;
                }
            }
        }
        
        if (!hP && myLocalTank.hp > 0 && myLocalTank.buff !== 'shield' && b.owner !== myId && b.owner !== 'zombie') {
            let mR = myLocalTank.buff === 'boss' ? 75 : 24, hD = b.type === 'samurai' ? mR + 30 : mR + 4;
            if (Math.hypot(b.x - myLocalTank.x, b.y - myLocalTank.y) < hD) {
                if (isTeamM(currentRoomData.mode) && opponents[b.owner] && opponents[b.owner].team === myLocalTank.team) { } 
                else {
                    hP = true;
                    if (currentRoomData.mode === 'prophunt' && myLocalTank.isDisguised) {
                        myLocalTank.isDisguised = false;
                        socket.emit('updateDisguise', { roomId: currentRoomId, state: false, x: myLocalTank.x, y: myLocalTank.y });
                    }
                }
            }
        }
        
        if (!hP && isS && b.owner !== 'zombie') {      // снаряди зомбі/босів не б'ють самих зомбі
            for (let zid in zombies) {
                let z = zombies[zid], zD = b.type === 'samurai' ? zType(z.type).radius + 35 : zType(z.type).radius + 10;
                if (Math.hypot(b.x - z.x, b.y - z.y) < zD) {
                    hZ = true;
                    if (b.owner === myId) {
                        socket.emit('zombieHit', { roomId: currentRoomId, zid: zid, dmg: actualDmg, type: b.type });
                        createExplosion(b.x, b.y, 5, zType(z.type).color);
                    }
                    break;
                }
            }
        }
        
        if (!hP && !hZ && b.owner === 'zombie' && myLocalTank.hp > 0 && myLocalTank.buff !== 'shield') {
            let mR = myLocalTank.buff === 'boss' ? 75 : 24, hD = mR + 4;
            if (Math.hypot(b.x - myLocalTank.x, b.y - myLocalTank.y) < hD) {
                hP = true;
                playSound('hurt'); shakeTime = 0.3;
                socket.emit('takeDamage', { roomId: currentRoomId, amt: actualDmg, attacker: 'zombie' });
            }
        }
        
        let hit = hW || hP || hZ;
        if (hit || b.life <= 0) {
            if (!['shotgun', 'minigun', 'acid', 'samurai', 'hunter_gun', 'piercing'].includes(b.type)) {
                createExplosion(b.x, b.y, b.type === 'explosive' ? 30 : 10, b.type === 'explosive' ? '#ea580c' : '#fcd34d');
            }
            if (b.type === 'hunter_gun') createExplosion(b.x, b.y, 10, '#dc2626');
            
            if (hP && b.type === 'explosive' && b.owner === myId) {
                let sR = b.type === 'boss' ? 250 : 120;
                for (let oid in opponents) {
                    if (opponents[oid].hp > 0 && opponents[oid].buff !== 'shield' && Math.hypot(b.x - opponents[oid].x, b.y - opponents[oid].y) < sR) {
                        if (isTeamM(currentRoomData.mode) && opponents[oid].team === myLocalTank.team) continue;
                        let expDmg = window.BUFFS['explosive'] ? window.BUFFS['explosive'].dmg : 250;
                        socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: expDmg, type: 'explosive' });
                    }
                }
            }
            
            if (hW && !hP && !hZ && b.owner === myId && b.type === 'hunter_gun') socket.emit('bulletMissed', { roomId: currentRoomId });
            if (hit && b.type === 'piercing') { } else bullets.splice(i, 1);
        }
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].life -= dt;
        particles[i].x += particles[i].vx * dt;
        particles[i].y += particles[i].vy * dt;
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
    
    for (let i = lasers.length - 1; i >= 0; i--) {
        lasers[i].life -= dt;
        if (lasers[i].life <= 0) lasers.splice(i, 1);
    }
}

function fireBull(now, mR, fC, tR) {
    lastShootTime = now;
    let bS = typeof BASE_BULLET_SPEED !== 'undefined' ? BASE_BULLET_SPEED : 800;
    if (myLocalTank.buff === 'fast' || myLocalTank.buff === 'minigun') bS *= 1.8;
    if (myLocalTank.buff === 'homing') bS *= 1.25;
    
    let bT = myLocalTank.buff || 'none';
    if (currentRoomData.mode === 'prophunt') bT = 'hunter_gun';
    if (bT === 'autolaser') return;
    
    let sh = {
        roomId: currentRoomId,
        id: Date.now() + Math.random(),
        x: myLocalTank.x + Math.cos(myLocalTank.turretAngle) * (mR + 10),
        y: myLocalTank.y + Math.sin(myLocalTank.turretAngle) * (mR + 10),
        vx: Math.cos(myLocalTank.turretAngle) * bS,
        vy: Math.sin(myLocalTank.turretAngle) * bS,
        type: bT,
        lifeMult: tR
    };
    
    if (bT === 'samurai') {
        sh.x = myLocalTank.x + Math.cos(myLocalTank.turretAngle) * (mR + 15);
        sh.y = myLocalTank.y + Math.sin(myLocalTank.turretAngle) * (mR + 15);
        sh.vx = Math.cos(myLocalTank.turretAngle) * 100;
        sh.vy = Math.sin(myLocalTank.turretAngle) * 100;
    }
    
    if ((bT === 'homing' || bT === 'autolaser') && homingTargetId) sh.targetId = homingTargetId;
    socket.emit('shoot', sh);
}

function drTnk(x, y, bA, tA, cH, nm, iM, hp, bf, eq, dN = true) {
    if (hp <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    let sc = bf === 'boss' ? 2.5 : 1.0;
    ctx.scale(sc, sc);
    ctx.globalAlpha = bf === 'invisible' ? (iM ? 0.2 : 0.03) : 1.0;
    ctx.shadowColor = 'transparent';
    
    if (dN && (bf !== 'invisible' || iM)) {
        ctx.fillStyle = cH;
        ctx.font = '14px Russo One';
        ctx.textAlign = 'center';
        ctx.fillText(nm, 0, -45);
    }
    
    if (bf === 'shield') {
        ctx.beginPath();
        ctx.arc(0, 0, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#38bdf8';
        ctx.stroke();
    }
    
    let T = performance.now() / 1000;
    ctx.save();
    ctx.rotate(bA);
    drawModVis(ctx, 'tracks', eq && eq.tracks, T);
    drawModVis(ctx, 'hull', eq && eq.hull, T);
    ctx.restore();

    ctx.save();
    ctx.rotate(tA);
    drawModVis(ctx, 'cannon', eq && eq.cannon, T);
    drawModVis(ctx, 'turret', eq && eq.turret, T);
    ctx.restore();
    ctx.restore();
}

function drPrp(c, o, t) { MapObj.drawProp(c, o, t); }

function drJ() {
    if (!isMobile || myLocalTank.hp <= 0) return;
    ctx.save();
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    if (joysticks.left.active) {
        ctx.beginPath(); ctx.arc(joysticks.left.startX, joysticks.left.startY, 60, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(joysticks.left.currentX, joysticks.left.currentY, 30, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; ctx.fill();
    }
    if (joysticks.right.active && !(currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider')) {
        ctx.beginPath(); ctx.arc(joysticks.right.startX, joysticks.right.startY, 60, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(joysticks.right.currentX, joysticks.right.currentY, 30, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.5)'; ctx.fill();
    }
    ctx.restore();
}

function drAL() {
    if (!isMobile || !joysticks.right.active || myLocalTank.hp <= 0 || (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider') || !joysticks.right.hasAimed) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(myLocalTank.x, myLocalTank.y);
    let tR = 1.0;
    tR *= GameData.statMult(myEquipped, 'range');
    let bS = (myLocalTank.buff === 'fast' || myLocalTank.buff === 'minigun') ? BASE_BULLET_SPEED * 1.8 : BASE_BULLET_SPEED, mD = (2.5 * tR) * bS;
    ctx.lineTo(myLocalTank.x + Math.cos(myLocalTank.turretAngle) * mD, myLocalTank.y + Math.sin(myLocalTank.turretAngle) * mD);
    ctx.stroke();
    ctx.restore();
}

function drPCA() {
    if (isMobile || myLocalTank.hp <= 0 || (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider')) return;
    ctx.save();
    let tR = 1.0;
    tR = GameData.statMult(myEquipped, 'range');
    let d = 60 * tR, ax = myLocalTank.x + Math.cos(myLocalTank.turretAngle) * d, ay = myLocalTank.y + Math.sin(myLocalTank.turretAngle) * d;
    ctx.translate(ax, ay); ctx.rotate(myLocalTank.turretAngle);
    ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, 8); ctx.lineTo(-3, 0); ctx.lineTo(-8, -8); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

// ===== Прийом дельта-синхронізації (сервер шле 20 разів/с лише зміни) =====
const _ZSMOOTH = 14, _zAlias = {}; let _hudAt = 0;
socket.on('sync2', (data) => {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    const pl = currentRoomData.players || (currentRoomData.players = {});
    if (data.ids) { const keep = new Set(data.ids); for (const id in pl) if (!keep.has(id)) { delete pl[id]; delete opponents[id]; } }
    const touched = new Set();
    if (data.s) for (const id in data.s) { pl[id] = Object.assign(pl[id] || { id: id }, data.s[id]); touched.add(id); }
    if (data.p) for (const id in data.p) {
        const a = data.p[id], o = pl[id] || (pl[id] = { id: id });
        o.x = a[0]; o.y = a[1]; o.bodyAngle = a[2]; o.turretAngle = a[3]; o.hp = a[4]; o.score = a[5];
        o.buff = a[6] || null; o.buffProgress = a[7]; o.isDisguised = !!a[8]; touched.add(id);
    }
    if (currentRoomData.mode === 'prophunt' && data.phState) {
        currentRoomData.state = data.phState;
        let pT = document.getElementById('prophunt-hud-timer'), pTT = document.getElementById('ph-time-text'), pPT = document.getElementById('ph-phase-text'), bO = document.getElementById('hunter-blind-overlay');
        if (pT) {
            pT.classList.remove('hidden');
            pTT.innerText = `${Math.floor(data.phTimeLeft / 60).toString().padStart(2, '0')}:${(data.phTimeLeft % 60).toString().padStart(2, '0')}`;
            if (data.phState === 'hiding') {
                if (pPT) { pPT.innerText = 'ХОВАНКИ'; pPT.className = 'text-[8px] lg:text-xs text-blue-400 font-bold tracking-widest uppercase'; }
                if (myLocalTank.team === 'hunter' && bO) { bO.classList.remove('hidden'); bO.classList.add('flex'); }
            } else if (data.phState === 'seeking') {
                if (pPT) { pPT.innerText = 'ПОШУК'; pPT.className = 'text-[8px] lg:text-xs text-red-500 font-bold tracking-widest uppercase'; }
                if (bO) { bO.classList.add('hidden'); bO.classList.remove('flex'); }
            }
        }
    }
    if (currentRoomData.mode === 'team_deathmatch') {
        if (data.tdm) { currentRoomData.teamScores = data.tdm.teamScores; currentRoomData.timeEndTime = data.tdm.timeEndTime; }
        if (data.tdmMsLeft !== undefined) currentRoomData.tdmEndLocal = Date.now() + data.tdmMsLeft; // залишок від сервера, не залежить від годинника клієнта
    }
    touched.forEach(id => {
        const sp = pl[id]; if (!sp) return;
        if (id !== myId) {
            const o = opponents[id];
            if (!o) opponents[id] = { ...sp };
            else {
                if (data.p && data.p[id]) { o.targetX = sp.x; o.targetY = sp.y; o.targetBody = sp.bodyAngle; o.targetTurret = sp.turretAngle; }
                o.hp = sp.hp; o.buff = sp.buff; o.equipped = sp.equipped; o.color = sp.color; o.team = sp.team; o.isDisguised = sp.isDisguised; o.propType = sp.propType;
                if (sp.name !== undefined) { o.name = sp.name; o.level = sp.level; }
            }
        } else {
            if (currentRoomData.mode === 'prophunt' && myLocalTank.hp > sp.hp) myLocalTank.isDisguised = false;
            myLocalTank.hp = sp.hp; myLocalTank.buff = sp.buff; myLocalTank.buffProgress = sp.buffProgress; myLocalTank.score = sp.score;
            if (sp.equipped) myEquipped = sp.equipped;
            if (sp.color !== undefined) myColor = sp.color;
            myLocalTank.propType = sp.propType;
        }
    });
    // зомбі: отримуємо цілі позиції, малюємо плавно (див. updatePhys)
    if (data.zi) { const keep = new Set(data.zi); for (const id in zombies) if (!keep.has(id)) delete zombies[id]; }
    if (data.zs) for (const id in data.zs) { const st = data.zs[id], z = zombies[id] || (zombies[id] = {}); _zAlias[st.a] = id; Object.assign(z, { id: st.id, type: st.type, maxHp: st.maxHp }); }
    if (data.z) for (const al in data.z) {
        const a = data.z[al], z = zombies[_zAlias[al]]; if (!z) continue;   // тип ще невідомий — дочекаємось статики
        if (z.x === undefined || Math.hypot(a[0] - z.x, a[1] - z.y) > 150) { z.x = a[0]; z.y = a[1]; }
        z.tx = a[0]; z.ty = a[1]; z.hp = a[2];
    }
    if (data.pu) powerups = data.pu; if (data.tk) tokens = data.tk; if (data.mn) mines = data.mn;
    if (data.md && window.ModesFX) ModesFX.sync(data.md);
    const _hn = performance.now();   // HUD оновлюємо не частіше ~11 разів/с: це купа записів у DOM
    if (_hn - _hudAt > 90 && typeof window.updateHUD === 'function') { _hudAt = _hn; window.updateHUD(); }
});

socket.on('phPhaseChange', (data) => {
    if (data.phase === 'seeking') {
        let bO = document.getElementById('hunter-blind-overlay');
        if (bO) { bO.classList.add('hidden'); bO.classList.remove('flex'); }
        playSound('boss_shoot');
    }
});

socket.on('spawnBullet', (data) => {
    playSound(data.type === 'minigun' ? 'minigun' : data.type.includes('boss') ? 'boss_shoot' : data.type === 'samurai' ? 'samurai' : 'shoot');
    let lM = data.lifeMult || 1.0;
    if (data.type === 'shotgun') {
        for (let i = 0; i < 20; i++) {
            let ang = Math.atan2(data.vy, data.vx) + (Math.random() - 0.5) * 0.6, spd = BASE_BULLET_SPEED * (0.8 + Math.random() * 0.4);
            bullets.push({ ...data, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1.2 * lM });
        }
    } else if (data.type === 'samurai') {
        bullets.push({ ...data, life: 0.15 });
    } else {
        bullets.push({ ...data, life: 2.5 * lM });
    }
});

socket.on('hitConfirmed', () => {
    playSound('hitmarker');
    let hm = document.getElementById('hitmarker');
    hm.classList.remove('hidden'); hm.classList.remove('hitmarker-active');
    void hm.offsetWidth; hm.classList.add('hitmarker-active');
});

socket.on('powerupCollected', () => playSound('powerup'));

socket.on('mineExploded', (d) => {
    playSound('explosion'); createExplosion(d.x, d.y, 30, '#f97316');
    if (Math.hypot(d.x - myLocalTank.x, d.y - myLocalTank.y) < 200) shakeTime = 0.5;
});

socket.on('burnTick', (d) => { createExplosion(d.x, d.y, 3, '#f97316'); });

socket.on('laserHit', (d) => {
    let srcP = d.src === myId ? myLocalTank : opponents[d.src], tgtP = d.tgt === myId ? myLocalTank : opponents[d.tgt];
    if (srcP && tgtP) lasers.push({ x1: srcP.x, y1: srcP.y, x2: tgtP.x, y2: tgtP.y, life: 0.15 });
});

socket.on('playerDied', (data) => {
    if (typeof createExplosion === 'function' && currentRoomData && currentRoomData.players[data.id]) createExplosion(currentRoomData.players[data.id].x, currentRoomData.players[data.id].y, 60, '#ef4444');
    playSound('explosion');
    if (data.id === myId) {
        if (data.killer && data.killer !== 'zombie' && opponents[data.killer]) spectatingId = data.killer;
        else if (typeof findNextSpec === 'function') findNextSpec(1);
    }
});

socket.on('playerRespawn', (data) => {
    if (data.id === myId) {
        myLocalTank.x = data.x; myLocalTank.y = data.y; myLocalTank.hp = data.hp; camera.x = data.x; camera.y = data.y;
        document.getElementById('damage-vignette').style.opacity = 0; spectatingId = null; myLocalTank.isDisguised = false;
    }
});

socket.on('tokenCollected', () => playSound('token'));

socket.on('bomberExplode', (data) => {
    if (typeof createExplosion === 'function') createExplosion(data.x, data.y, 40, '#dc2626');
    if (Math.hypot(data.x - myLocalTank.x, data.y - myLocalTank.y) < 120) emitDamage(data.dmg || 50, 'bomber');
});

socket.on('zombieMeleeHit', (data) => { if (data.targetId === myId && myLocalTank.hp > 0) emitDamage(data.dmg, 'zombie'); });

socket.on('bossWarning', () => { isBossIncoming = true; document.getElementById('survival-warning').classList.remove('hidden'); });

socket.on('newWave', (data) => {
    if (currentRoomData) currentRoomData.wave = data.wave;
    isBossIncoming = false; document.getElementById('survival-warning').classList.add('hidden');
    let ov = document.getElementById('wave-overlay'), tt = document.getElementById('wave-title-text'), st = document.getElementById('wave-subtitle-text');
    if (ov) ov.classList.remove('hidden');
    if (data.isBoss) {
        if (tt) { tt.innerText = `БОС ${data.bossName}`; tt.className = "text-8xl font-russo text-red-600 drop-shadow-[0_0_50px_rgba(220,38,38,1)] tracking-widest text-center px-4"; }
        if (st) { st.innerText = `Хвиля ${data.wave}`; st.classList.remove('hidden'); }
    } else {
        if (tt) { tt.innerText = `ХВИЛЯ ${data.wave}`; tt.className = "text-8xl font-russo text-red-500 drop-shadow-[0_0_40px_rgba(220,38,38,1)] tracking-widest text-center px-4"; }
        if (st) st.classList.add('hidden');
    }
    setTimeout(() => { if (ov) ov.classList.add('hidden'); }, 3500);
});

socket.on('gameOver', (data) => {
    if (currentRoomData) currentRoomData.status = 'finished';
    document.getElementById('winner-modal').classList.remove('hidden'); document.getElementById('damage-vignette').style.opacity = 0;
    if (window.LV) LV.animateXp((data.xp && data.xp[myId]) || null);
    let dN = document.getElementById('drop-notification');
    if (typeof pendingDrop !== 'undefined' && pendingDrop && MODULES[pendingDrop]) {
        let m = MODULES[pendingDrop];
        document.getElementById('drop-name').innerText = m.name;
        document.getElementById('drop-cat').innerText = `${CAT_NAMES[m.type]} | ${RARITY[m.rarity].name}`;
        document.getElementById('drop-cat').style.color = RARITY[m.rarity].color;
        document.getElementById('drop-icon').innerHTML = modIcon(m);
        dN.classList.remove('hidden');
    } else if (dN) dN.classList.add('hidden');
    
    if (data.outcomes && window.ModesFX) { ModesFX.gameOver(data); return; }
    if (data.winner === 'ZOMBIES') {
        document.getElementById('winner-title').innerText = "ВИ НЕ ВИЖИЛИ";
        document.getElementById('winner-title').className = "text-6xl font-russo mb-4 text-red-500 tracking-widest drop-shadow-[0_0_15px_rgba(239,68,68,0.5)] relative z-10";
        document.getElementById('winner-emoji').innerText = "💀";
        document.getElementById('winner-message').innerText = `Ви протримались до ${data.wave} хвилі.`;
        document.getElementById('winner-reward').innerText = data.wave;
    } else if (data.isTeamWin) {
        let rw = data.rewards ? (data.rewards[myId] || 0) : 0;
        document.getElementById('winner-reward').innerText = rw;
        if (rw === 20 || rw === 15) {
            document.getElementById('winner-title').innerText = "ПЕРЕМОГА!";
            document.getElementById('winner-title').className = "text-5xl lg:text-6xl font-russo mb-4 text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] relative z-10";
            document.getElementById('winner-emoji').innerText = "🏆";
            document.getElementById('winner-message').innerText = `${data.name} ПЕРЕМОГЛИ!`;
        } else if (data.winner === 'DRAW') {
            document.getElementById('winner-title').innerText = "НІЧИЯ";
            document.getElementById('winner-title').className = "text-5xl lg:text-6xl font-russo mb-4 text-slate-300 tracking-widest relative z-10";
            document.getElementById('winner-emoji').innerText = "🤝";
            document.getElementById('winner-message').innerText = "Бойова нічия!";
        } else {
            document.getElementById('winner-title').innerText = "ПОРАЗКА";
            document.getElementById('winner-title').className = "text-5xl lg:text-6xl font-russo mb-4 text-slate-400 tracking-widest relative z-10";
            document.getElementById('winner-emoji').innerText = "💔";
            document.getElementById('winner-message').innerText = `${data.name} ПЕРЕМОГЛИ...`;
        }
    } else {
        let rw = data.rewards ? (data.rewards[myId] || 0) : 0;
        document.getElementById('winner-reward').innerText = rw;
        if (data.winner === myId) {
            document.getElementById('winner-title').innerText = "ПЕРЕМОГА!";
            document.getElementById('winner-title').className = "text-5xl lg:text-6xl font-russo mb-4 text-white tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.5)] relative z-10";
            document.getElementById('winner-emoji').innerText = "🏆";
            document.getElementById('winner-message').innerText = "Ви розбили ворогів!";
        } else {
            document.getElementById('winner-title').innerText = "ЕХХ...";
            document.getElementById('winner-title').className = "text-5xl lg:text-6xl font-russo mb-4 text-slate-400 tracking-widest relative z-10";
            document.getElementById('winner-emoji').innerText = "💔";
            document.getElementById('winner-message').innerText = `${data.name} здобуває перемогу.`;
        }
    }
});

function emitDamage(amt, atk) { playSound('hurt'); shakeTime = 0.3; socket.emit('takeDamage', { roomId: currentRoomId, amt: amt, attacker: atk }); }


// ===== Відсікання за видимою областю: не малюємо й не тінимо те, чого не видно (на великих мапах це більшість об'єктів) =====
function solidInView(o, X0, X1, Y0, Y1) {
    let cx, cy, r;
    if (o.type === 'line') {
        let b = o._lb;
        if (!b) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const q of o.points) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; } const w = (o.width || 10) / 2 + 4; b = o._lb = [x0 - w, y0 - w, x1 + w, y1 + w]; }
        return !(b[2] < X0 || b[0] > X1 || b[3] < Y0 || b[1] > Y1);
    }
    if (o.w === undefined && o.h === undefined) { cx = o.x; cy = o.y; r = (o.r || 30) + 40; }
    else { const w = o.w || 0, h = o.h || 0; cx = o.x + w / 2; cy = o.y + h / 2; r = Math.hypot(w, h) / 2 + 40; }
    return !(cx + r < X0 || cx - r > X1 || cy + r < Y0 || cy - r > Y1);
}

function draw(now) {
    if (!currentRoomData) return;
    ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.clearRect(0, 0, GW, GH);
    ctx.save();
    let shX = 0, shY = 0;
    if (shakeTime > 0) { shX = (Math.random() - 0.5) * 20; shY = (Math.random() - 0.5) * 20; shakeTime -= 0.03; }
    ctx.scale(VS, VS);
    ctx.translate(GW / VS / 2 - camera.x + shX, GH / VS / 2 - camera.y + shY);
    
    let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map', mS = MAP_DATA[cMap].size;
    const _mp = MAP_DATA[cMap], _sh = MapObj.hasShape(_mp);
    const _vth = typeof MapFX !== 'undefined' && MapFX.themeOf(_mp);
    if (_sh) { // фігурна мапа: все поза контуром — порожнеча
        ctx.fillStyle = _vth ? MapFX.shade(_mp.bg || '#222', 0.16) : '#000'; ctx.fillRect(0, 0, mS, mS);
        ctx.save(); ctx.beginPath(); _mp.shape.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); ctx.clip();
    }
    // видима область у координатах світу (із запасом на тінь/світіння)
    const _vw = GW / VS / 2 + 70, _vh = GH / VS / 2 + 70, VX0 = camera.x - _vw, VX1 = camera.x + _vw, VY0 = camera.y - _vh, VY1 = camera.y + _vh;
    const _fx = typeof MapFX !== 'undefined', _th = _fx ? MapFX.themeOf(_mp) : null, _low = !!(window.GFX && GFX.tier === 'low');
    if (_fx) {
        const gx0 = Math.max(0, VX0), gy0 = Math.max(0, VY0), gx1 = Math.min(mS, VX1), gy1 = Math.min(mS, VY1);
        MapFX.drawGround(ctx, _mp, gx0, gy0, gx1, gy1, _th ? 0 : 1);
        if (_th) MapFX.drawEdges(ctx, _mp, gx0, gy0, gx1, gy1);
    } else {
        ctx.fillStyle = MAP_DATA[cMap].bg || '#020617'; ctx.fillRect(0, 0, mS, mS);
        ctx.strokeStyle = MAP_DATA[cMap].grid || '#1e293b'; ctx.lineWidth = 1;
        const gx0 = Math.max(0, Math.floor(VX0 / 50) * 50), gx1 = Math.min(mS, Math.ceil(VX1 / 50) * 50), gy0 = Math.max(0, Math.floor(VY0 / 50) * 50), gy1 = Math.min(mS, Math.ceil(VY1 / 50) * 50);
        ctx.beginPath();
        for (let x = gx0; x <= gx1; x += 50) { ctx.moveTo(x, gy0); ctx.lineTo(x, gy1); }
        for (let y = gy0; y <= gy1; y += 50) { ctx.moveTo(gx0, y); ctx.lineTo(gx1, y); }
        ctx.stroke();
    }
    if (_sh) {
        ctx.restore();
        ctx.save(); ctx.beginPath(); _mp.shape.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
        if (_vth) { ctx.lineJoin = 'round'; ctx.strokeStyle = MapFX.shade(_mp.bg || '#222', 0.28); ctx.lineWidth = 30; ctx.stroke(); ctx.strokeStyle = MapFX.shade(_mp.bg || '#222', 0.5); ctx.lineWidth = 10; ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 3; ctx.stroke(); }
        else { ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 18; ctx.stroke(); }
        ctx.restore();
    }
    
    let tm = Date.now() / 1000;
    
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn')) return;
        if (!solidInView(o, VX0, VX1, VY0, VY1)) return;
        ctx.save();
        MapObj.applyRot(ctx, o);
        if (o.type === 'line' && _fx) { MapFX.drawLine(ctx, o); }
        else if (o.type.includes('water') && _fx) { MapFX.drawWater(ctx, o, _th, tm, [VX0, VX1, VY0, VY1], { low: _low }); }
        else if (o.type === 'line') {
            ctx.strokeStyle = o.color; ctx.lineWidth = o.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(o.points[0].x, o.points[0].y);
            for (let i = 1; i < o.points.length; i++) ctx.lineTo(o.points[i].x, o.points[i].y);
            ctx.stroke();
        } else if (o.type.includes('water')) {
            ctx.fillStyle = '#0369a1'; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
            if (o.type === 'water_curve') {
                ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) / 2); ctx.fill(); ctx.clip();
            } else {
                ctx.fillRect(o.x, o.y, o.w, o.h); ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip();
            }
            ctx.setLineDash([20, 20]); ctx.lineDashOffset = -tm * 20;
            for (let wy = o.y + 10; wy < o.y + o.h; wy += 30) { ctx.beginPath(); ctx.moveTo(o.x, wy); ctx.lineTo(o.x + o.w, wy); ctx.stroke(); }
            ctx.setLineDash([]);
        } else if (o.type === 'prop_puddle' || o.type === 'prop_crater') drPrp(ctx, o, tm);
        ctx.restore();
    });
    
    for (let tid in tokens) {
        const tkn = tokens[tid]; ctx.save(); ctx.translate(tkn.x, tkn.y + Math.sin(now / 200) * 10);
        const cH = tkn.color === 'white' ? '#f8fafc' : tkn.color === 'black' ? '#1e293b' : tkn.color === 'red' ? '#ef4444' : tkn.color === 'blue' ? '#3b82f6' : tkn.color === 'brown' ? '#78350f' : '#9333ea';
        ctx.shadowColor = cH; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = cH; ctx.stroke();
        ctx.fillStyle = cH; ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, 1); ctx.restore();
    }
    
    if (!_fx) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12; }
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type === 'prop_puddle' || o.type === 'prop_crater') return;
        if (!solidInView(o, VX0, VX1, VY0, VY1)) return;
        ctx.save(); MapObj.applyRot(ctx, o);
        const _k = _fx ? MapFX.solidKind(o) : null;
        if (_k === 'block') MapFX.drawBlock(ctx, o, _th, { low: _low });
        else if (_k === 'tree') MapFX.drawTree(ctx, o, _th, { low: _low });
        else if (o.type === 'shape_triangle') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'shape_rhombus') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h / 2); ctx.lineTo(o.x + o.w / 2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h / 2); ctx.fill(); }
        else if (o.type === 'shape_parallelepiped') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.2, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w * 0.8, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'wall' || o.type === 'wall_square') { ctx.fillStyle = o.color || '#1e293b'; ctx.fillRect(o.x, o.y, o.w, o.h); }
        else if (o.type === 'tree') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r || 30, 0, Math.PI * 2); ctx.fill(); }
        else if (o.type.includes('prop_')) { if (_fx) MapFX.propShadow(ctx, o); drPrp(ctx, o, tm); }
        ctx.restore();
    });
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type.includes('prop_')) return;
        if (_fx && MapFX.solidKind(o)) return;   // стіни/дерева/фігури вже повністю намальовані з об'ємом
        if (!solidInView(o, VX0, VX1, VY0, VY1)) return;
        ctx.save(); MapObj.applyRot(ctx, o);
        if (o.type === 'shape_triangle') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'shape_rhombus') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h / 2); ctx.lineTo(o.x + o.w / 2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h / 2); ctx.fill(); }
        else if (o.type === 'shape_parallelepiped') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.2, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w * 0.8, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'wall' || o.type === 'wall_square') {
            if (o.neon) { ctx.strokeStyle = o.neon; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h); ctx.fillStyle = o.neon; ctx.globalAlpha = 0.2; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.globalAlpha = 1.0; }
            if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(o.x, o.y + o.h / 2 - 10, o.w, 20); }
            if (!o.neon && !o.stripe) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(o.x, o.y, o.w, 5); }
        } else if (o.type === 'tree') {
            ctx.fillStyle = 'rgba(22, 163, 74, 0.4)'; ctx.beginPath(); ctx.arc(o.x + 5, o.y + 5, Math.max(5, (o.r || 30) - 10), 0, Math.PI * 2); ctx.fill();
        } else if (o.type.includes('neon')) {
            ctx.strokeStyle = o.color || '#3b82f6'; ctx.lineWidth = 4; ctx.shadowColor = o.color || '#3b82f6'; ctx.shadowBlur = 15 + Math.sin(tm * 5) * 5;
            if (o.type === 'neon_wall') ctx.strokeRect(o.x, o.y, o.w, o.h);
            else if (o.type === 'neon_circle') { ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, Math.min(o.w, o.h) / 2, 0, Math.PI * 2); ctx.stroke(); }
            else if (o.type === 'neon_cross') { ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x, o.y + o.h); ctx.stroke(); }
            else if (o.type === 'neon_triangle') { ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.closePath(); ctx.stroke(); }
            else if (o.type === 'neon_diamond') { ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h / 2); ctx.lineTo(o.x + o.w / 2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h / 2); ctx.closePath(); ctx.stroke(); }
            else if (o.type === 'neon_arch') { ctx.beginPath(); ctx.moveTo(o.x, o.y + o.h); ctx.lineTo(o.x, o.y + o.h / 2); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, Math.PI, 0); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.stroke(); }
            else if (o.type === 'neon_pillar') { ctx.beginPath(); ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); ctx.stroke(); }
            ctx.fillStyle = o.color || '#3b82f6'; ctx.globalAlpha = 0.2; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    });
    
    for (let pid in powerups) {
        let p = powerups[pid]; ctx.save(); ctx.translate(p.x, p.y);
        ctx.fillStyle = '#1e293b'; ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 10;
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-15, -15, 30, 30, 5); else ctx.rect(-15, -15, 30, 30);
        ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(window.BUFF_ICONS[p.type] || '❓', 0, 1); ctx.restore();
    }
    
    for (let mid in mines) {
        let m = mines[mid]; ctx.save(); ctx.translate(m.x, m.y);
        ctx.globalAlpha = (m.owner === myId) ? 0.5 : 0.01;
        ctx.fillStyle = '#1e293b'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    
    for (let id in opponents) {
        const p = opponents[id], sn = currentRoomData.players[id]; if (!sn) { delete opponents[id]; continue; }
        const cH = sn.color ? (sn.color === 'white' ? '#f8fafc' : sn.color === 'black' ? '#1e293b' : sn.color === 'red' ? '#ef4444' : sn.color === 'blue' ? '#3b82f6' : sn.color === 'brown' ? '#78350f' : '#9333ea') : '#ef4444';
        if (p.isDisguised) MapObj.drawDisguise(ctx, { type: p.propType, x: p.x - 25, y: p.y - 25, w: 50, h: 50, r: 25 }, tm);
        else drTnk(p.x, p.y, p.bodyAngle, p.turretAngle, cH, sn.name, false, p.hp, p.buff, sn.equipped, true);
        if ((myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') && id === homingTargetId && p.hp > 0) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(now / 300); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.setLineDash([15, 10]); ctx.strokeRect(-45, -45, 90, 90); ctx.restore();
        }
    }
    
    drAL();
    if (myLocalTank.hp > 0) {
        const mC = myColor ? (myColor === 'white' ? '#f8fafc' : myColor === 'black' ? '#1e293b' : myColor === 'red' ? '#ef4444' : myColor === 'blue' ? '#3b82f6' : myColor === 'brown' ? '#78350f' : '#9333ea') : '#3b82f6';
        if (myLocalTank.isDisguised) MapObj.drawDisguise(ctx, { type: myLocalTank.propType, x: myLocalTank.x - 25, y: myLocalTank.y - 25, w: 50, h: 50, r: 25 }, tm);
        else { drTnk(myLocalTank.x, myLocalTank.y, myLocalTank.bodyAngle, myLocalTank.turretAngle, mC, myName, true, myLocalTank.hp, myLocalTank.buff, myEquipped, true); drPCA(); }
    }
    
    lasers.forEach(l => { ctx.save(); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15; ctx.globalAlpha = Math.max(0, l.life / 0.15); ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); ctx.restore(); });
    
    if (window.ModesFX) ModesFX.world(ctx, now, tm);
    if (isPveM(currentRoomData.mode)) {
        if (window.ZombieFX) ZombieFX.draw(ctx, zombies, now, { x0: VX0, x1: VX1, y0: VY0, y1: VY1 });
        else for (let zid in zombies) {
            let z = zombies[zid], zC = zType(z.type); ctx.fillStyle = zC.color; ctx.beginPath(); ctx.arc(z.x, z.y, zC.radius, 0, Math.PI * 2); ctx.fill();
        }
    }
    
    ctx.shadowColor = 'transparent';
    bullets.forEach(b => {
        if (b.type === 'samurai') {
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI / 1.5, Math.PI / 1.5); ctx.stroke(); ctx.restore(); return;
        }
        ctx.beginPath();
        if (b.type === 'piercing' || b.type === 'fast' || b.type === 'minigun' || b.type === 'homing') { ctx.moveTo(b.x, b.y - 4); ctx.lineTo(b.x + 20, b.y); ctx.lineTo(b.x, b.y + 4); }
        else if (b.type === 'acid') ctx.arc(b.x, b.y, 8, 0, Math.PI * 2);
        else if (b.type === 'boss_proj') ctx.arc(b.x, b.y, 10, 0, Math.PI * 2);
        else ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
        
        let bCol = b.type === 'fast' || b.type === 'minigun' ? '#38bdf8' : b.type === 'explosive' || b.type === 'boss_proj' ? '#fb923c' : b.type === 'incendiary' ? '#ef4444' : b.type === 'piercing' ? '#d946ef' : b.type === 'acid' ? '#a3e635' : b.type === 'shotgun' ? '#f8fafc' : b.type === 'homing' ? '#10b981' : b.type === 'hunter_gun' ? '#ef4444' : '#fef08a';
        ctx.fillStyle = bCol; ctx.shadowColor = bCol; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0;
    });
    
    if (window.ModesFX) ModesFX.top(ctx, now, tm);
    particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5));
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 4 + 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;
    });
    ctx.restore();
    
    let tCd = 1.0, cd = BASE_RELOAD;
    if (currentRoomData.mode === 'prophunt') {
        if (myLocalTank.team === 'hunter') cd = 1000; else cd = 9999999;
    } else {
        tCd *= GameData.statMult(myEquipped, 'cd');
        let fC = window.BUFFS[myLocalTank.buff] || window.BUFFS['none'];
        cd = (fC.cd < 500 ? fC.cd : window.getReloadTime());
    }
    
    let b = document.getElementById('cooldown-bar'), mB = document.getElementById('cooldown-bar-mob');
    if (now - lastShootTime < cd) {
        let pc = ((now - lastShootTime) / cd * 100) + '%';
        if (b) { b.style.transition = 'none'; b.style.width = pc; }
        if (mB) { mB.style.transition = 'none'; mB.style.width = pc; }
    } else {
        if (b) b.style.width = '100%';
        if (mB) mB.style.width = '100%';
    }
    
    const tC = document.getElementById('buff-timer-container');
    if (myLocalTank.buff && myLocalTank.buffProgress > 0) {
        tC.classList.remove('hidden');
        document.getElementById('buff-timer-icon').innerText = window.BUFF_ICONS[myLocalTank.buff] || '✨';
        document.getElementById('buff-timer-name').innerText = window.BUFF_NAMES[myLocalTank.buff] || 'ЕФЕКТ';
        document.getElementById('buff-timer-name').style.color = '#cbd5e1';
        document.getElementById('buff-timer-bar').style.width = (myLocalTank.buffProgress * 100) + '%';
    } else tC.classList.add('hidden');
    
    if (myLocalTank.hp <= 0 && spectatingId && opponents[spectatingId]) {
        let sN = currentRoomData.players[spectatingId] ? currentRoomData.players[spectatingId].name : 'ГРАВЕЦЬ', sT = opponents[spectatingId];
        if (sT.isDisguised) MapObj.drawDisguise(ctx, { type: sT.propType, x: sT.x - 25, y: sT.y - 25, w: 50, h: 50, r: 25 }, tm);
        ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText(`${I18N.t('СПОСТЕРІГАННЯ:')} ${sN}`, GW / 2, 120);
        if (!isMobile) { ctx.font = '14px Jura'; ctx.fillStyle = '#94a3b8'; ctx.fillText(`[A] ${I18N.t('Попередній')}  |  ${I18N.t('Наступний')} [D]`, GW / 2, 150); }
        ctx.shadowBlur = 0;
    }
    if (window.ModesFX) ModesFX.screen(ctx, now);
    drJ();
}

window.updateHUD = function() {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    let mHp = typeof MAX_HP !== 'undefined' ? MAX_HP : 500;
    mHp *= GameData.statMult(myEquipped, 'hp');
    mHp = Math.round(mHp);
    let pct = Math.max(0, Math.min(100, (myLocalTank.hp / mHp) * 100)), bC = myLocalTank.hp < mHp * 0.3 ? 'h-full bg-gradient-to-r from-red-600 to-red-400 w-full transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'h-full bg-gradient-to-r from-green-500 to-emerald-400 w-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]', hpB = document.getElementById('hp-bar'), hpT = document.getElementById('hp-text');
    if (hpB) { hpB.style.width = pct + '%'; if (hpB._c !== bC) { hpB.className = bC; hpB._c = bC; } }
    if (hpT) hpT.innerText = `${Math.ceil(myLocalTank.hp)}/${mHp}`;
    let hpBM = document.getElementById('hp-bar-mob'), hpTM = document.getElementById('hp-text-mob');
    if (hpBM) { hpBM.style.width = pct + '%'; if (hpBM._c !== bC) { hpBM.className = bC; hpBM._c = bC; } }
    if (hpTM) hpTM.innerText = `${Math.ceil(myLocalTank.hp)}/${mHp}`;
    
    let vO = 0;
    if (myLocalTank.hp < mHp) vO = (1 - (myLocalTank.hp / mHp)) * 0.85;
    document.getElementById('damage-vignette').style.opacity = vO;
    
    const buffWrap = document.getElementById('active-buff-wrap'), buffIcon = document.getElementById('active-buff-icon'), buffName = document.getElementById('active-buff-name'), buffBar = document.getElementById('active-buff-bar');
    if (myLocalTank.buff && myLocalTank.buffProgress > 0) {
        if (buffWrap) buffWrap.classList.remove('hidden');
        if (buffIcon) buffIcon.innerText = window.BUFF_ICONS[myLocalTank.buff] || '✨';
        if (buffName) buffName.innerText = window.BUFF_NAMES[myLocalTank.buff] || 'ЕФЕКТ';
        if (buffBar) buffBar.style.width = `${myLocalTank.buffProgress * 100}%`;
    } else {
        if (buffWrap) buffWrap.classList.add('hidden');
    }
    
    const scEl = document.getElementById('hud-score');
    if (scEl) scEl.innerText = myLocalTank.score || 0;
    const tU = document.getElementById('homing-target-ui');
    if (myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') tU.classList.remove('hidden'); else tU.classList.add('hidden');
    
    const dH = document.getElementById('deathmatch-score-hud'), sH = document.getElementById('survival-hud'), pC = document.getElementById('pc-cd-container'), mC = document.getElementById('mob-cd-container'), sl = document.getElementById('score-list'), tdmH = document.getElementById('tdm-hud');
    if (window.ModesFX) ModesFX.toggle(currentRoomData.mode);
    if (window.ModesFX && ModesFX.active(currentRoomData.mode)) {
        dH.classList.add('hidden'); sH.classList.add('hidden'); if (tdmH) tdmH.classList.add('hidden');
        if (pC) pC.classList.remove('hidden'); if (mC) mC.classList.remove('hidden');
        ModesFX.hud();
    } else if (currentRoomData.mode === 'prophunt') {
        dH.classList.add('hidden'); sH.classList.add('hidden'); if (tdmH) tdmH.classList.add('hidden');
        if (myLocalTank.team === 'hider') { if (pC) pC.classList.add('hidden'); if (mC) mC.classList.add('hidden'); } 
        else { if (pC) pC.classList.remove('hidden'); if (mC) mC.classList.remove('hidden'); }
    } else if (currentRoomData.mode === 'survival') {
        dH.classList.add('hidden'); if (tdmH) tdmH.classList.add('hidden'); sH.classList.remove('hidden');
        if (pC) pC.classList.remove('hidden'); if (mC) mC.classList.remove('hidden');
        const wN = document.getElementById('survival-wave-number'), wB = document.getElementById('survival-wave-box');
        wN.innerText = currentRoomData.wave;
        if (isBossIncoming) {
            wB.className = "glass-panel px-4 lg:px-10 py-1 lg:py-2 rounded-xl lg:rounded-2xl border flex flex-col items-center transition-colors duration-300 border-red-500 bg-red-900/40 shadow-[0_0_20px_rgba(239,68,68,0.5)]";
            wN.className = "text-xl lg:text-4xl font-russo drop-shadow-md text-red-500 leading-none";
        } else {
            wB.className = "glass-panel px-4 lg:px-10 py-1 lg:py-2 rounded-xl lg:rounded-2xl border border-slate-600 flex flex-col items-center transition-colors duration-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-slate-900/80";
            wN.className = "text-xl lg:text-4xl font-russo text-white drop-shadow-md leading-none";
        }
    } else if (currentRoomData.mode === 'team_deathmatch') {
        dH.classList.add('hidden'); sH.classList.add('hidden'); if (tdmH) tdmH.classList.remove('hidden');
        if (pC) pC.classList.remove('hidden'); if (mC) mC.classList.remove('hidden');
        let scC = document.getElementById('tdm-scores-container');
        if (scC && currentRoomData.teamScores) {
            scC.innerHTML = '';
            const tC = { 'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'yellow': '#eab308' };
            for (let t in currentRoomData.teamScores) scC.innerHTML += `<span style="color:${tC[t] || '#fff'}">${currentRoomData.teamScores[t]}</span>`;
        }
        let tT = document.getElementById('tdm-timer');
        if (tT && currentRoomData.timeEndTime) {
            let tl = Math.max(0, Math.ceil(((currentRoomData.tdmEndLocal || currentRoomData.timeEndTime) - Date.now()) / 1000)), m = Math.floor(tl / 60), s = tl % 60;
            tT.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
    } else {
        dH.classList.remove('hidden'); sH.classList.add('hidden'); if (tdmH) tdmH.classList.add('hidden');
        if (pC) pC.classList.remove('hidden'); if (mC) mC.classList.remove('hidden');
        sl.innerHTML = '';
        Object.values(currentRoomData.players).sort((a, b) => b.score - a.score).forEach(p => {
            sl.innerHTML += `<div class="flex justify-between w-full ${p.id === myId ? 'text-blue-400' : 'text-slate-300'} border-b border-slate-700/50 pb-1 ${p.hp <= 0 ? 'opacity-30 line-through' : ''}"><span>${p.name}</span><span class="font-bold">${p.score}</span></div>`;
        });
    }
    
    if (isMobile) {
        if ((myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') && myLocalTank.hp > 0) document.getElementById('mobile-target-btn').classList.remove('hidden');
        else document.getElementById('mobile-target-btn').classList.add('hidden');
        
        if (myLocalTank.hp <= 0 && canSpecM(currentRoomData.mode)) {
            document.getElementById('mobile-spec-prev').classList.remove('hidden'); document.getElementById('mobile-spec-next').classList.remove('hidden');
        } else {
            document.getElementById('mobile-spec-prev').classList.add('hidden'); document.getElementById('mobile-spec-next').classList.add('hidden');
        }
    }
};

function startGameLoop() {
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
    // обмеження частоти кадрів для слабких пристроїв (час між кадрами накопичується в dt, тож швидкість гри не змінюється)
    if (window.GFX && GFX.cap && now - lastTime < 1000 / GFX.cap - 2) { gameLoopId = requestAnimationFrame(gameLoop); return; }
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    const _raw = (now - lastTime) / 1000;
    lastTime = now;
    if (currentRoomData && currentRoomData.status === 'playing') {
        if (window.GFX) GFX.frame(now, _raw);
        // Помилка в одному кадрі більше не вбиває цикл: інакше картинка зависає, а звуки з сокетів продовжують грати
        const _w0 = performance.now();
        try { updatePhys(now, dt); draw(now); if (window.GFX) GFX.work(performance.now() - _w0); }
        catch (err) {
            if (now - (window.__loopErrAt || 0) > 2000) { window.__loopErrAt = now; console.error('Помилка ігрового циклу (цикл продовжує працювати):', err); }
            try { ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; } catch (e) {}
        }
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => {
    if (!e || !e.key) return;
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k) || k === ' ') { if (k === ' ') keys.space = true; else keys[k] = true; }
    if (myLocalTank.hp <= 0 && currentRoomData && canSpecM(currentRoomData.mode)) {
        if (k === 'a') findNextSpec(-1); if (k === 'd') findNextSpec(1);
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        if (myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') {
            let vO = Object.keys(opponents).filter(id => opponents[id].hp > 0 && Math.hypot(opponents[id].x - myLocalTank.x, opponents[id].y - myLocalTank.y) < 1500);
            if (vO.length > 0) {
                playSound('hitmarker');
                if (!homingTargetId || !vO.includes(homingTargetId)) homingTargetId = vO[0];
                else homingTargetId = vO[(vO.indexOf(homingTargetId) + 1) % vO.length];
                if (myLocalTank.buff === 'autolaser') socket.emit('setLaserTarget', { roomId: currentRoomId, targetId: homingTargetId });
            } else homingTargetId = null;
        }
    }
});

window.addEventListener('keyup', e => {
    if (!e || !e.key) return;
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k) || k === ' ') { if (k === ' ') keys.space = false; else keys[k] = false; }
});
window.addEventListener('mousemove', e => { if (!isMobile) { mouseX = e.clientX; mouseY = e.clientY; } });
window.addEventListener('mousedown', e => { if (!isMobile && e.button === 0 && e.target.id === 'game-canvas') keys.lmb = true; });
window.addEventListener('mouseup', e => { if (!isMobile && e.button === 0) keys.lmb = false; });

function handleTStart(e) {
    if (!isMobile) return;
    if (myLocalTank.hp <= 0) { resetJoysticks(); return; }
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.clientX < GW / 2 && !joysticks.left.active) {
            joysticks.left.active = true; joysticks.left.id = t.identifier;
            joysticks.left.startX = t.clientX; joysticks.left.startY = t.clientY;
            joysticks.left.currentX = t.clientX; joysticks.left.currentY = t.clientY;
        } else if (t.clientX >= GW / 2 && !joysticks.right.active) {
            joysticks.right.active = true; joysticks.right.id = t.identifier;
            joysticks.right.startX = t.clientX; joysticks.right.startY = t.clientY;
            joysticks.right.currentX = t.clientX; joysticks.right.currentY = t.clientY;
            joysticks.right.hasAimed = false; joysticks.right.released = false;
        }
    }
}

function handleTMove(e) {
    if (!isMobile || myLocalTank.hp <= 0) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (joysticks.left.active && t.identifier === joysticks.left.id) {
            let dx = t.clientX - joysticks.left.startX, dy = t.clientY - joysticks.left.startY, d = Math.hypot(dx, dy), mD = 60;
            if (d > mD) { dx = (dx / d) * mD; dy = (dy / d) * mD; }
            joysticks.left.currentX = joysticks.left.startX + dx; joysticks.left.currentY = joysticks.left.startY + dy;
            joysticks.left.angle = Math.atan2(dy, dx); joysticks.left.force = Math.min(1, d / mD);
        } else if (joysticks.right.active && t.identifier === joysticks.right.id) {
            let dx = t.clientX - joysticks.right.startX, dy = t.clientY - joysticks.right.startY, d = Math.hypot(dx, dy), mD = 60;
            if (d > 10) joysticks.right.hasAimed = true;
            if (d > mD) { dx = (dx / d) * mD; dy = (dy / d) * mD; }
            joysticks.right.currentX = joysticks.right.startX + dx; joysticks.right.currentY = joysticks.right.startY + dy;
            joysticks.right.angle = Math.atan2(dy, dx);
        }
    }
}

// скидання джойстиків (смерть/відродження/нова гра): інакше після смерті палець відпускається «в нікуди» і джойстик застрягає
function resetJoysticks() {
    ['left', 'right'].forEach(k => { const j = joysticks[k]; j.active = false; j.id = null; j.force = 0; j.hasAimed = false; j.released = false; });
}
window.resetJoysticks = resetJoysticks;

function handleTEnd(e) {
    if (!isMobile) return;      // відпускання пальця обробляємо завжди, навіть коли танк мертвий
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (joysticks.left.active && t.identifier === joysticks.left.id) {
            joysticks.left.active = false; joysticks.left.id = null; joysticks.left.force = 0;
        } else if (joysticks.right.active && t.identifier === joysticks.right.id) {
            if (joysticks.right.hasAimed) joysticks.right.released = true;
            joysticks.right.active = false; joysticks.right.id = null; joysticks.right.hasAimed = false;
        }
    }
}

canvas.addEventListener('touchstart', handleTStart, { passive: false });
canvas.addEventListener('touchmove', handleTMove, { passive: false });
canvas.addEventListener('touchend', handleTEnd, { passive: false });
canvas.addEventListener('touchcancel', handleTEnd, { passive: false });

const tgBtn = document.getElementById('mobile-target-btn');
if (tgBtn) tgBtn.addEventListener('touchstart', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') {
        let vO = Object.keys(opponents).filter(id => opponents[id].hp > 0 && Math.hypot(opponents[id].x - myLocalTank.x, opponents[id].y - myLocalTank.y) < 1500);
        if (vO.length > 0) {
            playSound('hitmarker');
            if (!homingTargetId || !vO.includes(homingTargetId)) homingTargetId = vO[0];
            else homingTargetId = vO[(vO.indexOf(homingTargetId) + 1) % vO.length];
            if (myLocalTank.buff === 'autolaser') socket.emit('setLaserTarget', { roomId: currentRoomId, targetId: homingTargetId });
        } else homingTargetId = null;
    }
}, { passive: false });

const sP = document.getElementById('mobile-spec-prev');
if (sP) sP.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); findNextSpec(-1); }, { passive: false });
const sN = document.getElementById('mobile-spec-next');
if (sN) sN.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); findNextSpec(1); }, { passive: false });