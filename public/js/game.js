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
    { const w = Math.max(1, Math.round(GW * RS)), h = Math.max(1, Math.round(GH * RS)); if (canvas.width !== w) canvas.width = w; if (canvas.height !== h) canvas.height = h; }   // без зайвого перевиділення полотна
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
        
        for (let pid in powerups) if (((powerups[pid].x - myLocalTank.x) ** 2 + (powerups[pid].y - myLocalTank.y) ** 2) < (myHitRad + 30) ** 2 && (!powerups[pid].mod || !window.ModesFX || ModesFX.canTake(powerups[pid]))) socket.emit('collectPowerup', { roomId: currentRoomId, pid: pid });
        for (let tid in tokens) if (((tokens[tid].x - myLocalTank.x) ** 2 + (tokens[tid].y - myLocalTank.y) ** 2) < (myHitRad + 25) ** 2) socket.emit('collectToken', { roomId: currentRoomId, tid: tid });
        
        camera.x += (myLocalTank.x - camera.x) * 5 * dt;
        camera.y += (myLocalTank.y - camera.y) * 5 * dt;
    }
    
    for (let zid in zombies) { const z = zombies[zid]; if (z.tx !== undefined) { z.x += (z.tx - z.x) * Math.min(1, _ZSMOOTH * dt); z.y += (z.ty - z.y) * Math.min(1, _ZSMOOTH * dt); } }
    for (let id in opponents) {
        let o = opponents[id];
        if (o.targetX !== undefined) {
            if ((o.targetX - o.x) ** 2 + (o.targetY - o.y) ** 2 > 22500) { o.x = o.targetX; o.y = o.targetY; } 
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
        
        const _ally = isS && b.owner !== 'zombie';   // кооп/PvE: снаряди гравців НЕ зачіпають союзників (ні візуально, ні по шкоді)
        for (let oid in opponents) {
            if (_ally) break;
            let op = opponents[oid];
            if (op.hp > 0 && op.buff !== 'shield') {
                let oR = op.buff === 'boss' ? 75 : 24, hD = b.type === 'samurai' ? oR + 30 : oR + 4;
                const _dx = b.x - op.x, _dy = b.y - op.y;
                if (_dx * _dx + _dy * _dy < hD * hD) {
                    hP = true;
                    if (b.owner === myId) {
                        if (isTeamM(currentRoomData.mode) && myLocalTank.team === op.team) continue;
                        // Відправляємо обчислений урон
                        socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: actualDmg, type: b.type, bid: b.bid });
                    }
                    break;
                }
            }
        }
        
        if (!hP && !_ally && myLocalTank.hp > 0 && myLocalTank.buff !== 'shield' && b.owner !== myId && b.owner !== 'zombie') {
            let mR = myLocalTank.buff === 'boss' ? 75 : 24, hD = b.type === 'samurai' ? mR + 30 : mR + 4;
            const _dx = b.x - myLocalTank.x, _dy = b.y - myLocalTank.y;
            if (_dx * _dx + _dy * _dy < hD * hD) {
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
                const _dx = b.x - z.x, _dy = b.y - z.y;
                if (_dx * _dx + _dy * _dy < zD * zD) {
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
                        socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: expDmg, type: 'explosive', bid: b.bid });
                    }
                }
            }
            
            if (hW && !hP && !hZ && b.owner === myId && b.type === 'hunter_gun') socket.emit('bulletMissed', { roomId: currentRoomId });
            if (hit && b.type === 'piercing') { } else bullets.splice(i, 1);
        }
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.life <= 0) { const l = particles.pop(); if (i < particles.length) particles[i] = l; }   // видалення без зсуву масиву
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
    if (window.SFX && bT !== 'autolaser' && typeof window.getReloadTime === 'function') { try { SFX.armReload(window.getReloadTime()); } catch (e) {} }
    socket.emit('shoot', sh);
}

// кулі: світіння (shadowBlur) на кожну кулю кожного кадру — дорого; тепер готовий спрайт «куля + ореол» на тип
const _bsp = new Map(); let _bspKey = '';
function bulletSprite(type) {
    const gf = window.GFX, k0 = _curS.toFixed(3) + '|' + (gf ? gf.tier + gf.blur : '');
    if (k0 !== _bspKey) { _bspKey = k0; _bsp.clear(); }
    let e = _bsp.get(type); if (e) return e;
    const s = _curS, tri = type === 'piercing' || type === 'fast' || type === 'minigun' || type === 'homing', r = tri ? 0 : type === 'acid' ? 8 : type === 'boss_proj' ? 10 : 6;
    const col = type === 'fast' || type === 'minigun' ? '#38bdf8' : type === 'explosive' || type === 'boss_proj' ? '#fb923c' : type === 'incendiary' ? '#ef4444' : type === 'piercing' ? '#d946ef' : type === 'acid' ? '#a3e635' : type === 'shotgun' ? '#f8fafc' : type === 'homing' ? '#10b981' : type === 'hunter_gun' ? '#ef4444' : '#fef08a';
    const bx0 = tri ? 0 : -r, bx1 = tri ? 20 : r, by0 = tri ? -4 : -r, by1 = tri ? 4 : r, blur = gf ? (gf.shadow ? 10 * gf.blur : 0) : 10;
    const pad = Math.ceil(blur * 1.5) + 2, W = Math.ceil((bx1 - bx0) * s) + pad * 2, H = Math.ceil((by1 - by0) * s) + pad * 2;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
    g.setTransform(s, 0, 0, s, pad - bx0 * s, pad - by0 * s);
    g.beginPath();
    if (tri) { g.moveTo(0, -4); g.lineTo(20, 0); g.lineTo(0, 4); } else g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = col; if (blur) { g.shadowColor = col; g.shadowBlur = blur; } g.fill();
    e = { cv, x: bx0 - pad / s, y: by0 - pad / s, w: W / s, h: H / s }; _bsp.set(type, e); return e;
}

// ===== Готові спрайти частин танка й підписів =====
// Модулі з світінням (епічні й вище) малювались через shadowBlur — по кілька розмитих проходів на кожен танк у кожному кадрі.
// Тепер кожна частина (гусениці, корпус, гармата, башта) малюється один раз у спрайт (з супер-семплінгом), далі кадр = drawImage із поворотом.
// «Дихання» світіння легендарних/міфічних: два спрайти (слабке/сильне світіння), що плавно змішуються по alpha.
let _curS = 1, _curOx = 0, _curOy = 0;   // масштаб полотна (RS*VS) і піксельний зсув світу — виставляє draw()
const _msp = new Map(); let _mspKey = '';
// parts: [[тип, модуль], ...] — які частини об'єднуємо в один спрайт (гусениці+корпус, гармата+башта)
function _modSprite(parts) {
    const gf = window.GFX, k0 = _curS.toFixed(3) + '|' + (gf ? gf.tier + gf.blur : '');
    if (k0 !== _mspKey) { _mspKey = k0; _msp.clear(); }
    let id = ''; for (const q of parts) id += q[0] + ':' + (q[1] ? q[1].id : '') + '|';
    let e = _msp.get(id); if (e !== undefined) return e;
    e = null;
    try {
        const s = _curS, rho = Math.min(3, Math.max(1, Math.round(s * 1.5 * 4) / 4));   // густина пікселів спрайта (трохи вища за екранну: гарне згладжування при зменшенні)
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, tier = 0, anyGlow = false;
        const ex = (x, y) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
        for (const q of parts) {
            const pal = modPalette(q[1] ? q[1].rarity : null);
            for (const sh of modShapes(q[0], q[1] || null)) {
                if (sh.g && pal.tier >= 2) { anyGlow = true; if (pal.tier > tier) tier = pal.tier; }
                if (sh.k === 'r') { ex(sh.x, sh.y); ex(sh.x + sh.w, sh.y + sh.h); } else if (sh.k === 'p') sh.p.forEach(z => ex(z[0], z[1])); else if (sh.k === 'c') { ex(sh.x - sh.r, sh.y - sh.r); ex(sh.x + sh.r, sh.y + sh.r); } else if (sh.k === 'l') { ex(sh.x1, sh.y1); ex(sh.x2, sh.y2); }
            }
        }
        if (x0 > x1) { _msp.set(id, null); return null; }
        const blurK = gf ? (gf.shadow ? gf.blur : 0) : 1, maxBlur = anyGlow ? (tier === 4 ? 16 : tier === 3 ? 11 : 4) * blurK : 0;
        const pad = Math.ceil(maxBlur * 1.4 / s) + 3;
        const W = Math.ceil((x1 - x0 + pad * 2) * rho), H = Math.ceil((y1 - y0 + pad * 2) * rho);
        if (W * H > 700000) { _msp.set(id, null); return null; }
        const omega = (anyGlow && tier >= 3 && (!gf || gf.tier === 'high')) ? (tier === 4 ? 3 : 2.2) : 0;   // «дихання» світіння — лише на високій якості
        const mk = (T) => {
            const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d');
            if (gf) gf.attach(g);
            // shadowBlur у GFX.attach — у пікселях полотна; у спрайті потрібно rho/s разів більше, щоб після зменшення світіння було те саме
            const dB = Object.getOwnPropertyDescriptor(g, 'shadowBlur'), kk = rho / s;
            if (dB && dB.set) Object.defineProperty(g, 'shadowBlur', { configurable: true, get: dB.get, set(v) { dB.set.call(g, v * kk); } });
            g.setTransform(rho, 0, 0, rho, (pad - x0) * rho, (pad - y0) * rho);
            for (const q of parts) drawModVis(g, q[0], q[1] || null, T);
            return cv;
        };
        e = { a: mk(omega ? -Math.PI / 2 / omega : (tier === 4 ? 0.0 : 0)), b: omega ? mk(Math.PI / 2 / omega) : null, omega, x: x0 - pad, y: y0 - pad, w: W / rho, h: H / rho };
    } catch (err) { e = null; }
    _msp.set(id, e); return e;
}
const _pp0 = [['tracks', null], ['hull', null]], _pp1 = [['cannon', null], ['turret', null]];
function drModPair(arr, ta, a, tb, b, T, raw) {
    const ma = typeof a === 'string' ? MODULES[a] : a, mb = typeof b === 'string' ? MODULES[b] : b;
    arr[0][0] = ta; arr[0][1] = ma || null; arr[1][0] = tb; arr[1][1] = mb || null;
    const e = raw ? null : _modSprite(arr);
    if (!e) { drawModVis(ctx, ta, a, T); drawModVis(ctx, tb, b, T); return; }
    ctx.drawImage(e.a, e.x, e.y, e.w, e.h);
    if (e.b && ctx.globalAlpha === 1) { ctx.globalAlpha = (Math.sin(T * e.omega) + 1) / 2; ctx.drawImage(e.b, e.x, e.y, e.w, e.h); ctx.globalAlpha = 1; }
}
// підпис танка: готовий спрайт тексту (шрифт Russo One підвантажується — після його появи кеш скидається)
const _lbl = new Map(); let _lblKey = '';
try { if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => _lbl.clear()); } catch (e) { }
function drLabel(nm, cH, x, y) {
    const k0 = _curS.toFixed(3); if (k0 !== _lblKey) { _lblKey = k0; _lbl.clear(); }
    const id = cH + '|' + nm; let e = _lbl.get(id);
    if (e === undefined) {
        const s = _curS, f = '14px Russo One';
        ctx.font = f; const tw = Math.ceil(ctx.measureText(nm).width) + 8, ww = Math.min(400, tw), hh = 24;
        const cv = document.createElement('canvas'); cv.width = Math.ceil(ww * s); cv.height = Math.ceil(hh * s);
        const g = cv.getContext('2d'); g.setTransform(s, 0, 0, s, 0, 0); g.fillStyle = cH; g.font = f; g.textAlign = 'center'; g.fillText(nm, ww / 2, 17);
        e = { cv, w: cv.width / s, h: cv.height / s, hw: ww / 2 };
        if (_lbl.size > 160) _lbl.clear(); _lbl.set(id, e);
    }
    // без дробового зсуву: підпис лягає на цілі пікселі полотна (інакше растровий текст розмивається при плавному русі танка)
    const s = _curS, dx = Math.round(s * (x - e.hw) + _curOx), dy = Math.round(s * (y - 62) + _curOy);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(e.cv, dx, dy); ctx.setTransform(s, 0, 0, s, _curOx + s * x, _curOy + s * y);
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
        if (sc === 1) drLabel(nm, cH, x, y);
        else { ctx.fillStyle = cH; ctx.font = '14px Russo One'; ctx.textAlign = 'center'; ctx.fillText(nm, 0, -45); }
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
    drModPair(_pp0, 'tracks', eq && eq.tracks, 'hull', eq && eq.hull, T, sc !== 1);
    ctx.restore();

    ctx.save();
    ctx.rotate(tA);
    drModPair(_pp1, 'cannon', eq && eq.cannon, 'turret', eq && eq.turret, T, sc !== 1);
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
    if (myLocalTank.hp <= 0 || (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider')) return;
    if (isMobile ? (!joysticks.right.active || !joysticks.right.hasAimed) : !(window.AimFX && AimFX.lineOn(false))) return;
    if (window.AimFX && !AimFX.lineOn(isMobile)) return; // «Показувати лінію» вимкнено в налаштуваннях
    let tR = 1.0;
    tR *= GameData.statMult(myEquipped, 'range');
    let bS = (myLocalTank.buff === 'fast' || myLocalTank.buff === 'minigun') ? BASE_BULLET_SPEED * 1.8 : BASE_BULLET_SPEED, mD = (2.5 * tR) * bS;
    if (window.AimFX) { AimFX.drawLine(ctx, myLocalTank.x, myLocalTank.y, myLocalTank.x + Math.cos(myLocalTank.turretAngle) * mD, myLocalTank.y + Math.sin(myLocalTank.turretAngle) * mD, VS); return; }
    ctx.save();
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
    ctx.beginPath(); ctx.moveTo(myLocalTank.x, myLocalTank.y);
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
const _ZSMOOTH = 14, _zAlias = {}, _PV = { x0: 0, x1: 0, y0: 0, y1: 0 }; let _hudAt = 0;
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
            if (window.SFX && sp.hp !== myLocalTank.hp) { try { SFX.onHp(sp.hp, Math.round(MAX_HP * GameData.statMult(myEquipped, 'hp'))); } catch (e) {} }
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
    if (window.SFX && SFX.ready() && SFX.shot(data) !== undefined) { /* озвучено пакетом sfx */ } else playSound(data.type === 'minigun' ? 'minigun' : data.type.includes('boss') ? 'boss_shoot' : data.type === 'samurai' ? 'samurai' : 'shoot');
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

socket.on('powerupCollected', (d) => { if (d && (d.playerId !== myId || d.type === 'mod')) return; playSound('powerup'); });

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
            document.getElementById('winner-message').innerText = `${window.dispName ? dispName(data.name) : data.name} здобуває перемогу.`;
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

// ===== Кеш статичного світу («чанки») =====
// Земля, дороги, будинки, дерева, стіни й нерухомий декор не змінюються між кадрами, тому раніше їх
// перемальовували щокадру (сотні шляхів, градієнтів, кліпів). Тепер світ ділиться на плитки 256×256 px у масштабі екрана
// й кожна малюється ОДИН раз у два шари: «під» (земля, дороги, дно води) і «над» (об'єми стін, дерева, декор).
// Кожен кадр — лише кілька drawImage. Те, що рухається (хвилі води, двері, вогнище, радар, неон, дахи), малюється наживо між шарами.
// Чанки лінійно добудовуються наперед (за напрямком руху), старі — витісняються (LRU). Вимкнути: WC.on = false (повертає старий «живий» режим).
const WC = (function () {
    const P = 256, M = 70, G = 256;
    let an = null, S = 0, tk = '';
    const store = new Map(), pool = [];
    let tick = 0, maxN = 0, lastWarm = '', nEmpty = 0;
    const api = { on: true, built: 0, buildMs: 0, hits: 0 };
    const EMPTY = {};
    const dynMemo = Object.create(null);

    // ---- чи змінюється вигляд декору з часом (порівнюємо журнали викликів canvas при різних t) ----
    function sigOf(o, t) {
        const log = [], st = { globalAlpha: 1, lineWidth: 1, shadowBlur: 0, canvas: { width: 64, height: 64 }, font: '', globalCompositeOperation: 'source-over' };
        const fmt = a => typeof a === 'number' ? Math.round(a * 1000) / 1000 : (a && a.__g) ? '[g' + a.__g + ']' : String(a);
        const px = new Proxy(st, {
            get(tg, k) {
                if (k in st) return st[k]; if (typeof k === 'symbol') return undefined;
                return (st[k] = function () {
                    let s = k + '('; for (let i = 0; i < arguments.length; i++) s += fmt(arguments[i]) + ','; log.push(s);
                    if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') { const id = log.length; return { __g: id, addColorStop() { log.push('cs' + Array.prototype.join.call(arguments)); } }; }
                    if (k === 'measureText') return { width: 10 };
                });
            },
            set(tg, k, v) { log.push(k + '=' + fmt(v)); st[k] = v; return true; }
        });
        MapObj.drawProp(px, o, t); return log.join(';');
    }
    function isDynProp(o) {
        const t = o.type; if (t in dynMemo) return dynMemo[t];
        let d = true;
        try { const a = sigOf(o, 0), b = sigOf(o, 0), c = sigOf(o, 1.234), e = sigOf(o, 7.77); d = !(a === b && a === c && a === e); } catch (err) { d = true; }
        return (dynMemo[t] = d);
    }

    // ---- аналіз мапи: межі, шари, динамічні об'єкти, сітка для швидкого пошуку ----
    function analyze(map) {
        const so = map.solids, n = so.length, nx = Math.ceil(map.size / G) + 1;
        const A = { map, n, nx, bb: new Float64Array(n * 4), pc: new Uint8Array(n), dy: new Uint8Array(n), ow: new Uint8Array(n), stamp: new Int32Array(n), st: 0, d1: [], d2: [], d3: [], grid: new Array(nx * nx), roofs: [] };
        for (let i = 0; i < n; i++) {
            const o = so[i], t = o.type || '';
            if (t.indexOf('spawn') >= 0) continue;
            let x0, y0, x1, y1;
            if (t === 'line') {
                if (!o.points || !o.points.length) continue;
                x0 = 1e9; y0 = 1e9; x1 = -1e9; y1 = -1e9; for (const q of o.points) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }
                const w = (o.width || 10) / 2 + 4; x0 -= w; y0 -= w; x1 += w; y1 += w;
            } else if (o.w === undefined && o.h === undefined) { const r = (o.r || 30) + 40; x0 = o.x - r; x1 = o.x + r; y0 = o.y - r; y1 = o.y + r; }
            else { const w = o.w || 0, h = o.h || 0, cx = o.x + w / 2, cy = o.y + h / 2, r = Math.hypot(w, h) / 2 + 40; x0 = cx - r; x1 = cx + r; y0 = cy - r; y1 = cy + r; }
            A.bb[i * 4] = x0; A.bb[i * 4 + 1] = y0; A.bb[i * 4 + 2] = x1; A.bb[i * 4 + 3] = y1;
            const water = t.indexOf('water') >= 0;
            let pc = 0, dy = 0;
            if (t === 'line' || water || t === 'prop_puddle' || t === 'prop_crater' || t === 'prop_floor') {
                pc = 1; if (water) dy = 2; else if (t !== 'line') dy = isDynProp(o) ? 1 : 0;
            } else if (t === 'prop_roof') { A.roofs.push(i); continue; }
            else if (MapFX.solidKind(o)) pc = 2;
            else if (t.indexOf('prop_') >= 0) { pc = 2; dy = (t.indexOf('prop_door_') === 0 || isDynProp(o)) ? 1 : 0; }
            else if (t.indexOf('neon') >= 0) { pc = 3; dy = 1; }
            else continue;
            A.pc[i] = pc; A.dy[i] = dy;
            if (dy === 1) (pc === 1 ? A.d1 : pc === 2 ? A.d2 : A.d3).push(i);
            else if (dy === 2) A.d1.push(i);
            // сітка
            const gx0 = Math.max(0, Math.floor(x0 / G)), gx1 = Math.min(nx - 1, Math.floor(x1 / G)), gy0 = Math.max(0, Math.floor(y0 / G)), gy1 = Math.min(nx - 1, Math.floor(y1 / G));
            for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) { const k = gy * nx + gx; (A.grid[k] || (A.grid[k] = [])).push(i); }
        }
        // статичні об'єкти нижнього шару, що лежать ПОВЕРХ води в порядку малювання (мости, підлога), переходять у верхній шар, щоб хвилі не лягали на них
        for (let w = 0; w < n; w++) {
            if (A.dy[w] !== 2) continue;
            const wx0 = A.bb[w * 4], wy0 = A.bb[w * 4 + 1], wx1 = A.bb[w * 4 + 2], wy1 = A.bb[w * 4 + 3];
            for (let j = w + 1; j < n; j++) {
                if (A.pc[j] !== 1 || A.dy[j] === 2) continue;
                if (A.bb[j * 4 + 2] < wx0 || A.bb[j * 4] > wx1 || A.bb[j * 4 + 3] < wy0 || A.bb[j * 4 + 1] > wy1) continue;
                if (A.dy[j] === 0) A.ow[j] = 1;
            }
        }
        // водойми, що перекривають одна одну: піну/хвилі раніших закривають пізніші (в порядку малювання), тож вирізаємо їх із живого шару
        A.excl = Object.create(null);
        for (let w = 0; w < n; w++) {
            if (A.dy[w] !== 2) continue;
            for (let j = w + 1; j < n; j++) {
                if (A.dy[j] !== 2 || A.bb[j * 4 + 2] < A.bb[w * 4] || A.bb[j * 4] > A.bb[w * 4 + 2] || A.bb[j * 4 + 3] < A.bb[w * 4 + 1] || A.bb[j * 4 + 1] > A.bb[w * 4 + 3]) continue;
                (A.excl[w] || (A.excl[w] = [])).push(so[j]);
            }
        }
        return A;
    }
    function query(R, out) {   // індекси об'єктів, що перетинають прямокутник, за зростанням (порядок малювання)
        out.length = 0; const nx = an.nx, st = ++an.st;
        const gx0 = Math.max(0, Math.floor(R.x0 / G)), gx1 = Math.min(nx - 1, Math.floor(R.x1 / G)), gy0 = Math.max(0, Math.floor(R.y0 / G)), gy1 = Math.min(nx - 1, Math.floor(R.y1 / G));
        for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
            const cell = an.grid[gy * nx + gx]; if (!cell) continue;
            for (let k = 0; k < cell.length; k++) { const i = cell[k]; if (an.stamp[i] === st) continue; an.stamp[i] = st; const b = an.bb; if (b[i * 4 + 2] < R.x0 || b[i * 4] > R.x1 || b[i * 4 + 3] < R.y0 || b[i * 4 + 1] > R.y1) continue; out.push(i); }
        }
        out.sort((a, b) => a - b); return out;
    }

    // ---- малювання шарів (mode 0 — усе наживо, як раніше; mode 1 — статична частина для чанка) ----
    function obj1(c, o, tm, th, low, view, full) {   // нижній шар: дороги, вода, підлога
        c.save(); MapObj.applyRot(c, o);
        if (o.type === 'line') MapFX.drawLine(c, o);
        else if (o.type.indexOf('water') >= 0) MapFX.drawWater(c, o, th, tm, view, full ? { low } : { low, part: 'base' });
        else drPrp(c, o, tm);
        c.restore();
    }
    function obj2(c, o, tm, th, low) {               // верхній шар: стіни, дерева, декор (з тінню)
        c.save(); MapObj.applyRot(c, o);
        const k = MapFX.solidKind(o);
        if (k === 'block') MapFX.drawBlock(c, o, th, { low });
        else if (k === 'tree') MapFX.drawTree(c, o, th, { low });
        else { MapFX.propShadow(c, o); drPrp(c, o, tm); }
        c.restore();
    }
    function obj3(c, o, tm) {                         // неонові фігури (пульсують)
        c.save(); MapObj.applyRot(c, o);
        c.strokeStyle = o.color || '#3b82f6'; c.lineWidth = 4; c.shadowColor = o.color || '#3b82f6'; c.shadowBlur = 15 + Math.sin(tm * 5) * 5;
        if (o.type === 'neon_wall') c.strokeRect(o.x, o.y, o.w, o.h);
        else if (o.type === 'neon_circle') { c.beginPath(); c.arc(o.x + o.w / 2, o.y + o.h / 2, Math.min(o.w, o.h) / 2, 0, Math.PI * 2); c.stroke(); }
        else if (o.type === 'neon_cross') { c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.moveTo(o.x + o.w, o.y); c.lineTo(o.x, o.y + o.h); c.stroke(); }
        else if (o.type === 'neon_triangle') { c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.lineTo(o.x, o.y + o.h); c.closePath(); c.stroke(); }
        else if (o.type === 'neon_diamond') { c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h / 2); c.lineTo(o.x + o.w / 2, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.closePath(); c.stroke(); }
        else if (o.type === 'neon_arch') { c.beginPath(); c.moveTo(o.x, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, Math.PI, 0); c.lineTo(o.x + o.w, o.y + o.h); c.stroke(); }
        else if (o.type === 'neon_pillar') { c.beginPath(); c.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); c.stroke(); }
        c.fillStyle = o.color || '#3b82f6'; c.globalAlpha = 0.2; c.fillRect(o.x, o.y, o.w, o.h); c.globalAlpha = 1.0;
        c.restore();
    }
    const _ids = [];
    function ground(c, R) {
        const mp = an.map, mS = mp.size, th = MapFX.themeOf(mp), sh = MapObj.hasShape(mp);
        const gx0 = Math.max(0, R.x0), gy0 = Math.max(0, R.y0), gx1 = Math.min(mS, R.x1), gy1 = Math.min(mS, R.y1);
        if (gx1 <= gx0 || gy1 <= gy0) return;
        if (sh) { // фігурна мапа: все поза контуром — порожнеча
            c.fillStyle = th ? MapFX.shade(mp.bg || '#222', 0.16) : '#000'; c.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
            c.save(); c.beginPath(); mp.shape.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.clip();
        }
        MapFX.drawGround(c, mp, gx0, gy0, gx1, gy1, th ? 0 : 1);
        if (th) MapFX.drawEdges(c, mp, gx0, gy0, gx1, gy1);
        if (sh) {
            c.restore();
            c.save(); c.beginPath(); mp.shape.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath();
            if (th) { c.lineJoin = 'round'; c.strokeStyle = MapFX.shade(mp.bg || '#222', 0.28); c.lineWidth = 30; c.stroke(); c.strokeStyle = MapFX.shade(mp.bg || '#222', 0.5); c.lineWidth = 10; c.stroke(); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 3; c.stroke(); }
            else { c.strokeStyle = '#38bdf8'; c.lineWidth = 6; c.lineJoin = 'round'; c.shadowColor = '#38bdf8'; c.shadowBlur = 18; c.stroke(); }
            c.restore();
        }
    }
    // mode 0: земля + весь нижній шар наживо; mode 1: земля + статичний нижній шар (для чанка)
    function paintUnder(c, R, mode, tm, th, low, view) {
        ground(c, R);
        const ids = query({ x0: R.x0 - M, x1: R.x1 + M, y0: R.y0 - M, y1: R.y1 + M }, _ids), so = an.map.solids; let n = 0;
        for (let k = 0; k < ids.length; k++) {
            const i = ids[k]; if (an.pc[i] !== 1) continue;
            if (mode === 1 && (an.dy[i] === 1 || an.ow[i])) continue;
            obj1(c, so[i], tm, th, low, view, mode === 0); n++;
        }
        return n;
    }
    // mode 0: усе верхнє наживо (нижній шар вже намальовано); mode 1: статичне (для чанка) — спершу «підняті» об'єкти над водою
    function paintOver(c, R, mode, tm, th, low) {
        const ids = query({ x0: R.x0 - M, x1: R.x1 + M, y0: R.y0 - M, y1: R.y1 + M }, _ids), so = an.map.solids; let n = 0;
        if (mode === 1) for (let k = 0; k < ids.length; k++) { const i = ids[k]; if (an.pc[i] === 1 && an.ow[i]) { obj1(c, so[i], tm, th, low, null, false); n++; } }
        for (let k = 0; k < ids.length; k++) { const i = ids[k]; if (an.pc[i] !== 2 || (mode === 1 && an.dy[i])) continue; obj2(c, so[i], tm, th, low); n++; }
        if (mode === 0) for (let k = 0; k < ids.length; k++) { const i = ids[k]; if (an.pc[i] === 3) obj3(c, so[i], tm); }
        return n;
    }

    // ---- чанки ----
    function build(layer, i, j) {
        const t0 = performance.now();
        let e = pool.pop();
        if (!e) { const cv = document.createElement('canvas'); cv.width = P; cv.height = P; const c = cv.getContext('2d'); if (window.GFX) GFX.attach(c); e = { cv, c, used: 0 }; }
        const c = e.c, th = MapFX.themeOf(an.map), low = !!(window.GFX && GFX.tier === 'low');
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, P, P); c.globalAlpha = 1; c.shadowColor = 'transparent'; c.shadowBlur = 0;
        c.setTransform(S, 0, 0, S, -i * P, -j * P);
        const ex = 1 / S, R = { x0: i * P / S - ex, y0: j * P / S - ex, x1: (i + 1) * P / S + ex, y1: (j + 1) * P / S + ex };
        c.save();
        let n;
        if (layer === 0) n = paintUnder(c, R, 1, 0, th, low, null) + 1; else n = paintOver(c, R, 1, 0, th, low);
        c.restore(); c.setTransform(1, 0, 0, 1, 0, 0);
        api.built++; api.buildMs += performance.now() - t0;
        if (!n) { pool.push(e); return EMPTY; }
        return e;
    }
    function get(layer, i, j, mustHave) {
        const k = (layer * 4096 + i) * 4096 + j; let e = store.get(k);
        if (e === undefined) {
            if (!mustHave) return null;
            e = build(layer, i, j); store.set(k, e);
            if (e === EMPTY) nEmpty++; else if (store.size - nEmpty > maxN) evict();
        }
        if (e !== EMPTY) e.used = tick;
        return e;
    }
    function evict() {
        let n = store.size - nEmpty - maxN;
        while (n-- > 0) {
            let bk = -1, bu = 1e18;
            for (const [k, e] of store) { if (e === EMPTY) continue; if (e.used < bu) { bu = e.used; bk = k; } }
            if (bk < 0 || bu >= tick) break;
            const e = store.get(bk); store.delete(bk); pool.push(e);
        }
    }
    function reset() { for (const e of store.values()) if (e !== EMPTY) pool.push(e); store.clear(); nEmpty = 0; }
    function prepare(mp, name, s, now) {
        const low = window.GFX && GFX.tier === 'low' ? 1 : 0, key = name + '|' + s.toFixed(4) + '|' + low + '|' + (window.GFX ? GFX.blur : 1);
        if (!an || an.map !== mp || an.n !== mp.solids.length) { an = analyze(mp); reset(); tk = ''; }
        if (key !== tk) { tk = key; S = s; reset(); lastWarm = ''; }
        maxN = (typeof isMobile !== 'undefined' && isMobile) ? 224 : 360;   // ≈14–24 МБ пікселів на шар
        tick++;
    }

    // ---- API для draw() ----
    // Малює шар (0 — під, 1 — над) чанками, що перетинають видиму область. Координати: (ox,oy) — зсув світу в пікселях полотна (цілі).
    function blit(c, layer, vx0, vx1, vy0, vy1, ox, oy) {
        const mS = an.map.size, ni = Math.ceil(mS * S / P) - 1;
        const i0 = Math.max(0, Math.floor(vx0 * S / P)), i1 = Math.min(ni, Math.floor(vx1 * S / P)), j0 = Math.max(0, Math.floor(vy0 * S / P)), j1 = Math.min(ni, Math.floor(vy1 * S / P));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const e = get(layer, i, j, true); if (e === EMPTY) continue;
            c.drawImage(e.cv, i * P + ox, j * P + oy);
        }
    }
    // Підбудова наперед: по одному шару за кадр у кільці навколо видимої області (ближчі — першими)
    function prefetch(cx, cy, hw, hh, budgetMs) {
        const t0 = performance.now(), mS = an.map.size, ni = Math.ceil(mS * S / P) - 1, pw = P / S;
        const i0 = Math.max(0, Math.floor((cx - hw - pw) / pw)), i1 = Math.min(ni, Math.floor((cx + hw + pw) / pw)), j0 = Math.max(0, Math.floor((cy - hh - pw) / pw)), j1 = Math.min(ni, Math.floor((cy + hh + pw) / pw));
        for (;;) {
            let bl = -1, bi = 0, bj = 0, bd = 1e18;
            for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) for (let l = 0; l < 2; l++) {
                if (store.has((l * 4096 + i) * 4096 + j)) continue;
                const dx = (i + 0.5) * pw - cx, dy = (j + 0.5) * pw - cy, d = dx * dx + dy * dy; if (d < bd) { bd = d; bl = l; bi = i; bj = j; }
            }
            if (bl < 0) return true;
            get(bl, bi, bj, true);
            if (performance.now() - t0 > budgetMs) return false;
        }
    }
    return Object.assign(api, {
        prepare, blit, prefetch, get, get an() { return an; },
        paintUnder, paintOver, obj1, obj3, query,
        drawDyn(c, pass, view, tm, th, low) {   // нерухомі в чанках об'єкти, що живуть: вода (хвилі), двері, вогнище, радар, неон
            const list = pass === 1 ? an.d1 : pass === 2 ? an.d2 : an.d3, so = an.map.solids, b = an.bb;
            for (let k = 0; k < list.length; k++) {
                const i = list[k]; if (b[i * 4 + 2] < view[0] || b[i * 4] > view[1] || b[i * 4 + 3] < view[2] || b[i * 4 + 1] > view[3]) continue;
                const o = so[i];
                if (pass === 1) {
                    if (an.dy[i] === 2) {
                        c.save();
                        const ex = an.excl[i];
                        if (ex) {   // пізніші водойми, що перекривають цю, закривають її хвилі й піну (як у порядку малювання раніше)
                            c.beginPath(); c.rect(b[i * 4] - 60, b[i * 4 + 1] - 60, b[i * 4 + 2] - b[i * 4] + 120, b[i * 4 + 3] - b[i * 4 + 1] + 120);
                            for (let q = 0; q < ex.length; q++) { c.save(); MapObj.applyRot(c, ex[q]); MapFX.waterPath(c, ex[q]); c.restore(); }
                            c.clip('evenodd');
                        }
                        MapObj.applyRot(c, o); MapFX.drawWater(c, o, th, tm, view, { low, part: 'anim' }); c.restore();
                    }
                    else obj1(c, o, tm, th, low, view, true);
                } else if (pass === 2) obj2(c, o, tm, th, low); else obj3(c, o, tm);
            }
        },
        reset
    });
})();

const _viewA = [0, 0, 0, 0], _RV = { x0: 0, x1: 0, y0: 0, y1: 0 }; let _PF = 0, _PFok = false;

function draw(now) {
    if (!currentRoomData) return;
    ctx.setTransform(RS, 0, 0, RS, 0, 0); ctx.clearRect(0, 0, GW, GH);
    ctx.save();
    let shX = 0, shY = 0;
    if (shakeTime > 0) { shX = (Math.random() - 0.5) * 20; shY = (Math.random() - 0.5) * 20; shakeTime -= 0.03; }
    const _s = RS * VS; _curS = _s; const _ox = Math.round(GW * RS / 2 - _s * (camera.x - shX)), _oy = Math.round(GH * RS / 2 - _s * (camera.y - shY)); _curOx = _ox; _curOy = _oy;   // цілий піксельний зсув: чанки й живі об'єкти лягають без розмиття
    ctx.setTransform(_s, 0, 0, _s, _ox, _oy);

    const cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map', _mp = MAP_DATA[cMap];
    // видима область у координатах світу (із запасом на тінь/світіння)
    const _vw = GW / VS / 2 + 70, _vh = GH / VS / 2 + 70, VX0 = camera.x - _vw, VX1 = camera.x + _vw, VY0 = camera.y - _vh, VY1 = camera.y + _vh;
    const _fx = typeof MapFX !== 'undefined', _th = _fx ? MapFX.themeOf(_mp) : null, _low = !!(window.GFX && GFX.tier === 'low');
    let tm = Date.now() / 1000;
    const _view = _viewA; _view[0] = VX0; _view[1] = VX1; _view[2] = VY0; _view[3] = VY1;
    let _cached = false;
    if (_fx) {
        const _R = _RV; _R.x0 = camera.x - GW / VS / 2 - 24; _R.x1 = camera.x + GW / VS / 2 + 24; _R.y0 = camera.y - GH / VS / 2 - 24; _R.y1 = camera.y + GH / VS / 2 + 24;   // +24 — запас на тряску камери
        if (WC.on) {
            try {
                WC.prepare(_mp, cMap, _s, now); _cached = true;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                WC.blit(ctx, 0, _R.x0, _R.x1, _R.y0, _R.y1, _ox, _oy);
                ctx.setTransform(_s, 0, 0, _s, _ox, _oy);
                WC.drawDyn(ctx, 1, _view, tm, _th, _low);
            } catch (err) { console.error('WC:', err); WC.on = false; WC.reset(); _cached = false; ctx.setTransform(_s, 0, 0, _s, _ox, _oy); }
        }
        if (!_cached) { WC.prepare(_mp, cMap, _s, now); WC.paintUnder(ctx, _R, 0, tm, _th, _low, _view); }
    }

    for (let tid in tokens) {
        const tkn = tokens[tid]; ctx.save(); ctx.translate(tkn.x, tkn.y + Math.sin(now / 200) * 10);
        const cH = tkn.color === 'white' ? '#f8fafc' : tkn.color === 'black' ? '#1e293b' : tkn.color === 'red' ? '#ef4444' : tkn.color === 'blue' ? '#3b82f6' : tkn.color === 'brown' ? '#78350f' : '#9333ea';
        ctx.shadowColor = cH; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fillStyle = '#0f172a'; ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = cH; ctx.stroke();
        ctx.fillStyle = cH; ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, 1); ctx.restore();
    }

    if (_fx) {
        if (_cached) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            WC.blit(ctx, 1, _RV.x0, _RV.x1, _RV.y0, _RV.y1, _ox, _oy);
            ctx.setTransform(_s, 0, 0, _s, _ox, _oy);
            WC.drawDyn(ctx, 2, _view, tm, _th, _low); WC.drawDyn(ctx, 3, _view, tm, _th, _low);
            if (_PF++ % 2 === 0 || !_PFok) { const _hw = GW / VS / 2, _hh = GH / VS / 2; _PFok = WC.prefetch(camera.x, camera.y, _hw, _hh, 2.5); }
        } else WC.paintOver(ctx, _RV, 0, tm, _th, _low);
    }

    const _pv = _PV; _pv.x0 = VX0; _pv.x1 = VX1; _pv.y0 = VY0; _pv.y1 = VY1;   // один об'єкт на всі виклики (без виділень на кадр)
    if (window.ModesFX && ModesFX.ground) ModesFX.ground(ctx, now, _pv);   // аірдроп (королівський бій): нижній шар
    for (let pid in powerups) {
        let p = powerups[pid];
        if (p.mod) { if (window.ModesFX) ModesFX.lootDraw(ctx, p, now, _pv); continue; }
        ctx.save(); ctx.translate(p.x, p.y);
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
        if (p.x < VX0 - 140 || p.x > VX1 + 140 || p.y < VY0 - 140 || p.y > VY1 + 140) continue;   // поза екраном (із запасом на підпис/щит)
        const cH = sn.color ? (sn.color === 'white' ? '#f8fafc' : sn.color === 'black' ? '#1e293b' : sn.color === 'red' ? '#ef4444' : sn.color === 'blue' ? '#3b82f6' : sn.color === 'brown' ? '#78350f' : '#9333ea') : '#ef4444';
        if (p.isDisguised) MapObj.drawDisguise(ctx, { type: p.propType, x: p.x - 25, y: p.y - 25, w: 50, h: 50, r: 25 }, tm);
        else drTnk(p.x, p.y, p.bodyAngle, p.turretAngle, cH, (window.dispName ? dispName(sn) : sn.name), false, p.hp, p.buff, sn.equipped, true);
        if ((myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') && id === homingTargetId && p.hp > 0) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(now / 300); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.setLineDash([15, 10]); ctx.strokeRect(-45, -45, 90, 90); ctx.restore();
        }
    }
    
    drAL();
    if (myLocalTank.hp > 0) {
        const mC = myColor ? (myColor === 'white' ? '#f8fafc' : myColor === 'black' ? '#1e293b' : myColor === 'red' ? '#ef4444' : myColor === 'blue' ? '#3b82f6' : myColor === 'brown' ? '#78350f' : '#9333ea') : '#3b82f6';
        if (myLocalTank.isDisguised) MapObj.drawDisguise(ctx, { type: myLocalTank.propType, x: myLocalTank.x - 25, y: myLocalTank.y - 25, w: 50, h: 50, r: 25 }, tm);
        else { drTnk(myLocalTank.x, myLocalTank.y, myLocalTank.bodyAngle, myLocalTank.turretAngle, mC, (window.dispName ? dispName(myName) : myName), true, myLocalTank.hp, myLocalTank.buff, myEquipped, true); drPCA(); }
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
    for (let _bi = 0; _bi < bullets.length; _bi++) {
        const b = bullets[_bi];
        if (b.x < VX0 - 40 || b.x > VX1 + 40 || b.y < VY0 - 40 || b.y > VY1 + 40) continue;   // поза екраном
        if (b.type === 'samurai') {
            ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI / 1.5, Math.PI / 1.5); ctx.stroke(); ctx.restore(); continue;
        }
        const e = bulletSprite(b.type);
        ctx.drawImage(e.cv, b.x + e.x, b.y + e.y, e.w, e.h);
    }
    
    if (_fx) {   // дахи будівель: прозорі лише для локального гравця всередині (інші танки під дахом не видно)
        const _rdt = Math.min(0.1, Math.max(0, (now - (draw._rt || now)) / 1000)); draw._rt = now;
        const _alive = myLocalTank.hp > 0;
        MapFX.drawRoofs(ctx, MAP_DATA[cMap].solids, { x0: VX0, x1: VX1, y0: VY0, y1: VY1 }, _alive ? myLocalTank.x : camera.x, _alive ? myLocalTank.y : camera.y, _rdt);
    }
    if (window.ModesFX) ModesFX.top(ctx, now, tm, _pv);
    for (let _pi = 0; _pi < particles.length; _pi++) {
        const p = particles[_pi];
        if (p.x < VX0 || p.x > VX1 || p.y < VY0 || p.y > VY1) continue;
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life >= 0.4 ? 1 : p.life * 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 4 + 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1.0;
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
    {   // полоса перезарядки: пишемо в DOM лише коли ціле значення % змінилось (раніше — 2 стилі щокадру)
        const pc = now - lastShootTime < cd ? Math.round((now - lastShootTime) / cd * 100) : 100;
        if (pc !== draw._cd) {
            draw._cd = pc; const w = pc + '%';
            if (b) { if (pc < 100) b.style.transition = 'none'; b.style.width = w; }
            if (mB) { if (pc < 100) mB.style.transition = 'none'; mB.style.width = w; }
        }
    }
    
    const tC = document.getElementById('buff-timer-container');
    if (myLocalTank.buff && myLocalTank.buffProgress > 0) {
        _hid(tC, false);
        const _bi = window.BUFF_ICONS[myLocalTank.buff] || '✨', _bn = window.BUFF_NAMES[myLocalTank.buff] || 'ЕФЕКТ';
        if (draw._bk !== myLocalTank.buff) {   // іконка/назва змінюються лише разом із ефектом, а не щокадру
            draw._bk = myLocalTank.buff;
            document.getElementById('buff-timer-icon').innerText = _bi;
            document.getElementById('buff-timer-name').innerText = _bn;
            document.getElementById('buff-timer-name').style.color = '#cbd5e1';
        }
        const _bw = Math.round(myLocalTank.buffProgress * 1000) / 10;
        if (draw._bw !== _bw) { draw._bw = _bw; document.getElementById('buff-timer-bar').style.width = _bw + '%'; }
    } else { _hid(tC, true); draw._bk = null; }
    
    if (myLocalTank.hp <= 0 && spectatingId && opponents[spectatingId]) {
        let sN = currentRoomData.players[spectatingId] ? (window.dispName ? dispName(currentRoomData.players[spectatingId]) : currentRoomData.players[spectatingId].name) : 'ГРАВЕЦЬ', sT = opponents[spectatingId];
        if (sT.isDisguised) MapObj.drawDisguise(ctx, { type: sT.propType, x: sT.x - 25, y: sT.y - 25, w: 50, h: 50, r: 25 }, tm);
        ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText(`${I18N.t('СПОСТЕРІГАННЯ:')} ${sN}`, GW / 2, 120);
        if (!isMobile) { ctx.font = '14px Jura'; ctx.fillStyle = '#94a3b8'; ctx.fillText(`[A] ${I18N.t('Попередній')}  |  ${I18N.t('Наступний')} [D]`, GW / 2, 150); }
        ctx.shadowBlur = 0;
    }
    if (window.ModesFX) ModesFX.screen(ctx, now);
    drJ();
}

// записи в DOM лише при зміні (кожен запис — мутація для спостерігачів і перерахунок стилів)
function _hid(el, h) { if (el && el.classList.contains('hidden') !== h) el.classList.toggle('hidden', h); }
function _sw(el, w) { if (el && el._w !== w) { el._w = w; el.style.width = w; } }
function _tx(el, v) { if (el && el._v !== v) { el._v = v; el.innerText = v; } }
function _cl(el, c) { if (el && el._cn !== c) { el._cn = c; el.className = c; } }
window.updateHUD = function() {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    let mHp = typeof MAX_HP !== 'undefined' ? MAX_HP : 500;
    mHp *= GameData.statMult(myEquipped, 'hp');
    mHp = Math.round(mHp);
    let pct = Math.max(0, Math.min(100, (myLocalTank.hp / mHp) * 100)), bC = myLocalTank.hp < mHp * 0.3 ? 'h-full bg-gradient-to-r from-red-600 to-red-400 w-full transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'h-full bg-gradient-to-r from-green-500 to-emerald-400 w-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]', hpB = document.getElementById('hp-bar'), hpT = document.getElementById('hp-text');
    if (hpB) { _sw(hpB, pct + '%'); if (hpB._c !== bC) { hpB.className = bC; hpB._c = bC; } }
    if (hpT) _tx(hpT, `${Math.ceil(myLocalTank.hp)}/${mHp}`);
    let hpBM = document.getElementById('hp-bar-mob'), hpTM = document.getElementById('hp-text-mob');
    if (hpBM) { _sw(hpBM, pct + '%'); if (hpBM._c !== bC) { hpBM.className = bC; hpBM._c = bC; } }
    if (hpTM) _tx(hpTM, `${Math.ceil(myLocalTank.hp)}/${mHp}`);
    
    let vO = 0;
    if (myLocalTank.hp < mHp) vO = (1 - (myLocalTank.hp / mHp)) * 0.85;
    { const _dv = document.getElementById('damage-vignette'), _vq = Math.round(vO * 100) / 100; if (_dv && _dv._o !== _vq) { _dv._o = _vq; _dv.style.opacity = _vq; } }
    
    const buffWrap = document.getElementById('active-buff-wrap'), buffIcon = document.getElementById('active-buff-icon'), buffName = document.getElementById('active-buff-name'), buffBar = document.getElementById('active-buff-bar');
    if (myLocalTank.buff && myLocalTank.buffProgress > 0) {
        if (buffWrap) _hid(buffWrap, false);
        if (buffIcon) _tx(buffIcon, window.BUFF_ICONS[myLocalTank.buff] || '✨');
        if (buffName) _tx(buffName, window.BUFF_NAMES[myLocalTank.buff] || 'ЕФЕКТ');
        if (buffBar) _sw(buffBar, `${Math.round(myLocalTank.buffProgress * 1000) / 10}%`);
    } else {
        if (buffWrap) _hid(buffWrap, true);
    }
    
    const scEl = document.getElementById('hud-score');
    if (scEl) _tx(scEl, myLocalTank.score || 0);
    const tU = document.getElementById('homing-target-ui');
    if (myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') _hid(tU, false); else _hid(tU, true);
    
    const dH = document.getElementById('deathmatch-score-hud'), sH = document.getElementById('survival-hud'), pC = document.getElementById('pc-cd-container'), mC = document.getElementById('mob-cd-container'), sl = document.getElementById('score-list'), tdmH = document.getElementById('tdm-hud');
    if (window.ModesFX) ModesFX.toggle(currentRoomData.mode);
    if (window.ModesFX && ModesFX.active(currentRoomData.mode)) {
        _hid(dH, true); _hid(sH, true); if (tdmH) _hid(tdmH, true);
        if (pC) _hid(pC, false); if (mC) _hid(mC, false);
        ModesFX.hud();
    } else if (currentRoomData.mode === 'prophunt') {
        _hid(dH, true); _hid(sH, true); if (tdmH) _hid(tdmH, true);
        if (myLocalTank.team === 'hider') { if (pC) _hid(pC, true); if (mC) _hid(mC, true); } 
        else { if (pC) _hid(pC, false); if (mC) _hid(mC, false); }
    } else if (currentRoomData.mode === 'survival') {
        _hid(dH, true); if (tdmH) _hid(tdmH, true); _hid(sH, false);
        if (pC) _hid(pC, false); if (mC) _hid(mC, false);
        const wN = document.getElementById('survival-wave-number'), wB = document.getElementById('survival-wave-box');
        _tx(wN, currentRoomData.wave);
        if (isBossIncoming) {
            _cl(wB, "glass-panel px-4 lg:px-10 py-1 lg:py-2 rounded-xl lg:rounded-2xl border flex flex-col items-center transition-colors duration-300 border-red-500 bg-red-900/40 shadow-[0_0_20px_rgba(239,68,68,0.5)]");
            _cl(wN, "text-xl lg:text-4xl font-russo drop-shadow-md text-red-500 leading-none");
        } else {
            _cl(wB, "glass-panel px-4 lg:px-10 py-1 lg:py-2 rounded-xl lg:rounded-2xl border border-slate-600 flex flex-col items-center transition-colors duration-500 shadow-[0_0_15px_rgba(0,0,0,0.5)] bg-slate-900/80");
            _cl(wN, "text-xl lg:text-4xl font-russo text-white drop-shadow-md leading-none");
        }
    } else if (currentRoomData.mode === 'team_deathmatch') {
        _hid(dH, true); _hid(sH, true); if (tdmH) _hid(tdmH, false);
        if (pC) _hid(pC, false); if (mC) _hid(mC, false);
        let scC = document.getElementById('tdm-scores-container');
        if (scC && currentRoomData.teamScores) {
            const tC = { 'red': '#ef4444', 'blue': '#3b82f6', 'green': '#22c55e', 'yellow': '#eab308' };
            let _h = ''; for (let t in currentRoomData.teamScores) _h += `<span style="color:${tC[t] || '#fff'}">${currentRoomData.teamScores[t]}</span>`;
            if (scC._h !== _h) { scC._h = _h; scC.innerHTML = _h; }
        }
        let tT = document.getElementById('tdm-timer');
        if (tT && currentRoomData.timeEndTime) {
            let tl = Math.max(0, Math.ceil(((currentRoomData.tdmEndLocal || currentRoomData.timeEndTime) - Date.now()) / 1000)), m = Math.floor(tl / 60), s = tl % 60;
            _tx(tT, `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
    } else {
        _hid(dH, false); _hid(sH, true); if (tdmH) _hid(tdmH, true);
        if (pC) _hid(pC, false); if (mC) _hid(mC, false);
        let _h = '';
        Object.values(currentRoomData.players).sort((a, b) => b.score - a.score).forEach(p => {
            _h += `<div class="flex justify-between w-full ${p.id === myId ? 'text-blue-400' : 'text-slate-300'} border-b border-slate-700/50 pb-1 ${p.hp <= 0 ? 'opacity-30 line-through' : ''}"><span>${window.dispName ? dispName(p) : p.name}</span><span class="font-bold">${p.score}</span></div>`;
        });
        if (sl._h !== _h) { sl._h = _h; sl.innerHTML = _h; }   // таблицю перебудовуємо лише коли змінились очки/склад
    }
    
    if (isMobile) {
        if ((myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') && myLocalTank.hp > 0) _hid(document.getElementById('mobile-target-btn'), false);
        else _hid(document.getElementById('mobile-target-btn'), true);
        
        if (myLocalTank.hp <= 0 && canSpecM(currentRoomData.mode)) {
            _hid(document.getElementById('mobile-spec-prev'), false); _hid(document.getElementById('mobile-spec-next'), false);
        } else {
            _hid(document.getElementById('mobile-spec-prev'), true); _hid(document.getElementById('mobile-spec-next'), true);
        }
    }
};

document.addEventListener('visibilitychange', () => { if (!document.hidden) lastTime = performance.now(); });   // після повернення на вкладку — без стрибка dt

function startGameLoop() {
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// Заздалегідь будуємо кеш світу навколо камери (до старту бою), по кілька мс за кадр — щоб перший кадр бою не «завис»
let _warmKey = '';
function warmWorld() {
    if (!WC.on || typeof MapFX === 'undefined') return;
    const gs = document.getElementById('game-screen'); if (!gs || gs.classList.contains('hidden')) return;
    const cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map', mp = MAP_DATA[cMap]; if (!mp) return;
    const s = RS * VS, key = cMap + '|' + s.toFixed(4) + '|' + (camera.x | 0) + '|' + (camera.y | 0) + '|' + (window.GFX ? GFX.tier : '');
    if (key === _warmKey) return;
    WC.prepare(mp, cMap, s, 0);
    if (WC.prefetch(camera.x, camera.y, GW / VS / 2, GH / VS / 2, 5)) _warmKey = key;
}

function gameLoop(now) {
    if (gameLoop._rp === undefined) gameLoop._rp = 16.7;
    // обмеження частоти кадрів для слабких пристроїв (час між кадрами накопичується в dt, тож швидкість гри не змінюється)
    // оцінка періоду оновлення екрана (мінімум із останніх інтервалів rAF) — щоб обмежувач кадрів не «з'їдав» кадри на 120/144 Гц
    { const _d = now - (gameLoop._t || now); gameLoop._t = now; if (_d > 3 && _d < gameLoop._rp) gameLoop._rp = _d; else gameLoop._rp = Math.min(34, gameLoop._rp * 1.002); }
    if (window.GFX && GFX.cap && now - lastTime < 1000 / GFX.cap - gameLoop._rp * 0.5) { gameLoopId = requestAnimationFrame(gameLoop); return; }
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
    } else if (currentRoomData && currentRoomData.map) {
        try { warmWorld(); } catch (e) {}   // зворотний відлік / очікування: поки екран стоїть, заздалегідь будуємо чанки навколо точки спавну
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
            let vO = Object.keys(opponents).filter(id => opponents[id].hp > 0 && !(isPveM(currentRoomData.mode) || (isTeamM(currentRoomData.mode) && opponents[id].team === myLocalTank.team)) && Math.hypot(opponents[id].x - myLocalTank.x, opponents[id].y - myLocalTank.y) < 1500);
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
        let vO = Object.keys(opponents).filter(id => opponents[id].hp > 0 && !(isPveM(currentRoomData.mode) || (isTeamM(currentRoomData.mode) && opponents[id].team === myLocalTank.team)) && Math.hypot(opponents[id].x - myLocalTank.x, opponents[id].y - myLocalTank.y) < 1500);
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