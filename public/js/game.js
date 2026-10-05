let canvas = document.getElementById('game-canvas');
let ctx = canvas.getContext('2d');

window.addEventListener('resize', () => { 
    canvas.width = window.innerWidth; 
    canvas.height = window.innerHeight; 
});
canvas.width = window.innerWidth; 
canvas.height = window.innerHeight;

let spectatingId = null;
let isBossIncoming = false;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let joysticks = {
    left: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, angle: 0, force: 0, id: null },
    right: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0, angle: 0, force: 0, id: null, hasAimed: false, released: false }
};

let BASE_RELOAD = 2000;
let mines = {};
let lasers = [];

window.getTankSpeed = function() {
    let spd = typeof BASE_SPEED !== 'undefined' ? BASE_SPEED : 200;
    if (myEquipped && myEquipped.hull && MODULES[myEquipped.hull] && MODULES[myEquipped.hull].stats.speed) spd *= MODULES[myEquipped.hull].stats.speed;
    if (myEquipped && myEquipped.tracks && MODULES[myEquipped.tracks] && MODULES[myEquipped.tracks].stats.speed) spd *= MODULES[myEquipped.tracks].stats.speed;
    if (myLocalTank.buff === 'speed') spd *= 1.5;
    if (myLocalTank.buff === 'samurai') spd *= 1.6;
    if (myLocalTank.buff === 'boss') spd *= 0.6;
    return spd;
};

window.getReloadTime = function() {
    let cd = BASE_RELOAD;
    if (myEquipped && myEquipped.cannon && MODULES[myEquipped.cannon] && MODULES[myEquipped.cannon].stats.cd) cd *= MODULES[myEquipped.cannon].stats.cd;
    return cd;
};

function createExplosion(x, y, count, color) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = Math.random() * 200 + 50;
        particles.push({ x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: Math.random() * 0.4 + 0.1, color });
    }
}

function checkCollision(x, y, r, checkS = true, isB = false) {
    if (!currentRoomData) return true;
    let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map';
    let mS = MAP_DATA[cMap].size;
    if (x - r < 0 || x + r > mS || y - r < 0 || y + r > mS) return true;
    
    if (checkS) {
        for (let s of MAP_DATA[cMap].solids) {
            if (s.type.includes('spawn') || s.type === 'line' || s.type === 'prop_puddle' || s.type === 'prop_crater') continue;
            if (s.type.includes('water') && isB) continue;
            if (s.type === 'tree' || s.type === 'neon_circle' || s.type === 'neon_pillar') {
                let cx = s.x + (s.w ? s.w / 2 : 0), cy = s.y + (s.h ? s.h / 2 : 0), sr = s.r || (s.w ? s.w / 2 : 30);
                if (Math.hypot(x - cx, y - cy) <= r + sr) return true;
            } else {
                let tX = Math.max(s.x, Math.min(x, s.x + (s.w || 30))), tY = Math.max(s.y, Math.min(y, s.y + (s.h || 30)));
                if (Math.hypot(x - tX, y - tY) <= r) return true;
            }
        }
    }
    return false;
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

function updatePhys(now, dt) {
    if (!currentRoomData || !currentRoomId) return;
    let myRad = myLocalTank.buff === 'boss' ? 75 : 24;
    
    if (myLocalTank.hp <= 0) {
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
        
        if (joysticks.right.active) myLocalTank.turretAngle = joysticks.right.angle;
        else if (!isMobile && !myLocalTank.isDisguised) myLocalTank.turretAngle = Math.atan2(mouseY - (canvas.height / 2), mouseX - (canvas.width / 2));
        
        socket.emit('move', { roomId: currentRoomId, x: myLocalTank.x, y: myLocalTank.y, bodyAngle: myLocalTank.bodyAngle, turretAngle: myLocalTank.turretAngle });
        
        let fCfg = window.BUFFS[myLocalTank.buff || 'none'] || window.BUFFS['none'];
        let tR = 1.0;
        
        if (currentRoomData.mode === 'prophunt') {
            if (myLocalTank.team === 'hunter') { fCfg = { cd: 1000, type: 'hunter_gun' }; tR = 1; } 
            else fCfg = { cd: 9999999, type: 'none' };
        } else {
            if (myEquipped.cannon && MODULES[myEquipped.cannon]) { tR *= MODULES[myEquipped.cannon].stats.range || 1; }
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
            fireBull(now, myRad, fCfg, tR);
        } else if (isMobile && !isMg && joysticks.right.released) {
            joysticks.right.released = false;
        }
        
        for (let pid in powerups) if (Math.hypot(powerups[pid].x - myLocalTank.x, powerups[pid].y - myLocalTank.y) < myRad + 30) socket.emit('collectPowerup', { roomId: currentRoomId, pid: pid });
        for (let tid in tokens) if (Math.hypot(tokens[tid].x - myLocalTank.x, tokens[tid].y - myLocalTank.y) < myRad + 25) socket.emit('collectToken', { roomId: currentRoomId, tid: tid });
        
        camera.x += (myLocalTank.x - camera.x) * 5 * dt;
        camera.y += (myLocalTank.y - camera.y) * 5 * dt;
    }
    
    for (let id in opponents) {
        let o = opponents[id];
        if (o.targetX !== undefined) {
            if (Math.hypot(o.targetX - o.x, o.targetY - o.y) > 150) { o.x = o.targetX; o.y = o.targetY; } 
            else { o.x += (o.targetX - o.x) * 15 * dt; o.y += (o.targetY - o.y) * 15 * dt; }
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
        
        let isS = currentRoomData.mode === 'survival', hP = false, hZ = false;
        
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
                        if (currentRoomData.mode === 'team_deathmatch' && myLocalTank.team === op.team) continue;
                        // Відправляємо обчислений урон
                        socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: actualDmg, type: b.type });
                    }
                    break;
                }
            }
        }
        
        if (!hP && myLocalTank.hp > 0 && myLocalTank.buff !== 'shield' && b.owner !== myId) {
            let mR = myLocalTank.buff === 'boss' ? 75 : 24, hD = b.type === 'samurai' ? mR + 30 : mR + 4;
            if (Math.hypot(b.x - myLocalTank.x, b.y - myLocalTank.y) < hD) {
                if (currentRoomData.mode === 'team_deathmatch' && opponents[b.owner] && opponents[b.owner].team === myLocalTank.team) { } 
                else {
                    hP = true;
                    if (currentRoomData.mode === 'prophunt' && myLocalTank.isDisguised) {
                        myLocalTank.isDisguised = false;
                        socket.emit('updateDisguise', { roomId: currentRoomId, state: false, x: myLocalTank.x, y: myLocalTank.y });
                    }
                }
            }
        }
        
        if (!hP && isS) {
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
                        if (currentRoomData.mode === 'team_deathmatch' && opponents[oid].team === myLocalTank.team) continue;
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
    
    let bHC = '#1e293b', hC = eq && eq.hull && MODULES[eq.hull] ? RARITY[MODULES[eq.hull].rarity].color : '#0f172a',
        trC = eq && eq.tracks && MODULES[eq.tracks] ? RARITY[MODULES[eq.tracks].rarity].color : '#0f172a',
        cC = eq && eq.cannon && MODULES[eq.cannon] ? RARITY[MODULES[eq.cannon].rarity].color : '#0f172a',
        tuC = eq && eq.turret && MODULES[eq.turret] ? RARITY[MODULES[eq.turret].rarity].color : '#334155';
        
    ctx.save();
    ctx.rotate(bA);
    ctx.fillStyle = trC;
    ctx.shadowColor = trC;
    ctx.shadowBlur = eq && eq.tracks ? 15 : 0;
    ctx.fillRect(-36, -32, 72, 14);
    ctx.fillRect(-36, 18, 72, 14);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = bHC;
    ctx.strokeStyle = hC;
    ctx.lineWidth = eq && eq.hull ? 3 : 1;
    if (eq && eq.hull) { ctx.shadowColor = hC; ctx.shadowBlur = 10; }
    ctx.fillRect(-30, -22, 60, 44);
    ctx.strokeRect(-30, -22, 60, 44);
    ctx.shadowBlur = 0;
    ctx.restore();
    
    ctx.save();
    ctx.rotate(tA);
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = cC;
    ctx.lineWidth = eq && eq.cannon ? 3 : 1;
    if (eq && eq.cannon) { ctx.shadowColor = cC; ctx.shadowBlur = 10; }
    
    let cL = 45;
    if (eq && eq.cannon && MODULES[eq.cannon].stats.range > 1.1) cL = 60;
    if (eq && eq.cannon && MODULES[eq.cannon].stats.range < 1.0) cL = 35;
    
    ctx.fillRect(0, -6, cL, 12);
    ctx.strokeRect(0, -6, cL, 12);
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = bHC;
    ctx.strokeStyle = tuC;
    ctx.lineWidth = eq && eq.turret ? 3 : 1;
    if (eq && eq.turret) { ctx.shadowColor = tuC; ctx.shadowBlur = 15; }
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(-4, -4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
}

function drPrp(c, o, t) {
    let x = o.x, y = o.y, w = o.w || 50, h = o.h || 50;
    c.save();
    switch (o.type) {
        case 'prop_crate':
            c.fillStyle = '#b45309'; c.fillRect(x, y, w, h); c.strokeStyle = '#78350f'; c.lineWidth = 3; c.strokeRect(x, y, w, h);
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke(); break;
        case 'prop_barrel':
            c.fillStyle = '#dc2626'; c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#991b1b'; c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2 - 4, 0, Math.PI * 2); c.fill(); break;
        case 'prop_sandbag':
            c.fillStyle = '#d4a373'; c.strokeStyle = '#a68a64'; c.lineWidth = 2;
            c.beginPath(); c.roundRect(x, y, w, h / 2, 10); c.fill(); c.stroke();
            c.beginPath(); c.roundRect(x + 5, y + h / 2, w - 10, h / 2, 10); c.fill(); c.stroke(); break;
        case 'prop_rock':
            c.fillStyle = '#52525b'; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h / 3); c.lineTo(x + w * 0.8, y + h); c.lineTo(x + w * 0.2, y + h); c.lineTo(x, y + h / 2); c.fill(); break;
        case 'prop_bush':
            c.fillStyle = '#15803d'; c.beginPath(); c.arc(x + w / 3, y + h / 3, w / 2, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(x + w * 0.7, y + h / 3, w / 2, 0, Math.PI * 2); c.fill();
            c.beginPath(); c.arc(x + w / 2, y + h * 0.7, w / 2.5, 0, Math.PI * 2); c.fill(); break;
        case 'prop_cone':
            c.fillStyle = '#ea580c'; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.fill();
            c.fillStyle = '#fff'; c.fillRect(x + w * 0.3, y + h * 0.5, w * 0.4, h * 0.2); break;
        case 'prop_concrete':
            c.fillStyle = '#a1a1aa'; c.fillRect(x, y, w, h); c.strokeStyle = '#71717a'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, w - 4, h - 4); break;
        case 'prop_hedgehog':
            c.strokeStyle = '#71717a'; c.lineWidth = 4; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y + h); c.moveTo(x + w, y); c.lineTo(x, y + h); c.stroke();
            c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke(); break;
        case 'prop_radar':
            c.fillStyle = '#334155'; c.beginPath(); c.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2); c.fill();
            c.translate(x + w / 2, y + h / 2); c.rotate(t * 2); c.strokeStyle = '#10b981'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, 0); c.stroke(); break;
        case 'prop_tent':
            c.fillStyle = '#4d7c0f'; c.fillRect(x, y, w, h); c.fillStyle = '#1a2e05'; c.beginPath(); c.moveTo(x + w / 2, y + h); c.lineTo(x + w / 2 - 15, y + h - 20); c.lineTo(x + w / 2 + 15, y + h - 20); c.fill(); break;
        case 'prop_cont_red':
        case 'prop_cont_blue':
            c.fillStyle = o.type === 'prop_cont_red' ? '#dc2626' : '#2563eb'; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
            for (let l = x + 10; l < x + w; l += 15) { c.beginPath(); c.moveTo(l, y); c.lineTo(l, y + h); c.stroke(); } break;
        case 'prop_fence_wood':
            c.fillStyle = '#78350f'; c.fillRect(x, y + h / 2 - 2, w, 4);
            for (let f = x; f <= x + w; f += 20) { c.beginPath(); c.arc(f, y + h / 2, 4, 0, Math.PI * 2); c.fill(); } break;
        case 'prop_fence_metal':
            c.fillStyle = '#94a3b8'; c.fillRect(x, y + h / 2 - 1, w, 2); c.setLineDash([5, 5]); c.strokeStyle = '#94a3b8';
            c.beginPath(); c.moveTo(x, y + h / 2 - 5); c.lineTo(x + w, y + h / 2 - 5); c.stroke();
            c.beginPath(); c.moveTo(x, y + h / 2 + 5); c.lineTo(x + w, y + h / 2 + 5); c.stroke(); break;
        case 'prop_wreck':
            c.fillStyle = '#1c1917'; c.fillRect(x + 5, y + 10, w - 10, h - 20);
            c.fillStyle = '#09090b'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 15, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#09090b'; c.lineWidth = 6; c.beginPath(); c.moveTo(x + w / 2, y + h / 2); c.lineTo(x + w, y + h); c.stroke(); break;
        case 'prop_tires':
            c.fillStyle = '#171717'; c.beginPath(); c.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2); c.fill();
            c.fillStyle = '#27272a'; c.beginPath(); c.arc(x + w / 2, y + h / 2, w / 3, 0, Math.PI * 2); c.fill(); break;
        case 'prop_generator':
            c.fillStyle = '#eab308'; c.fillRect(x, y, w, h); c.fillStyle = '#171717'; c.fillRect(x + 5, y + 5, w - 10, h / 2); break;
        case 'prop_spotlight':
            c.fillStyle = '#d4d4d8'; c.beginPath(); c.arc(x + w / 2, y + h / 2, 10, 0, Math.PI * 2); c.fill();
            c.translate(x + w / 2, y + h / 2); c.rotate(Math.sin(t) * 0.5);
            c.fillStyle = 'rgba(253, 224, 71, 0.2)'; c.beginPath(); c.moveTo(0, 0); c.lineTo(150, -40); c.lineTo(150, 40); c.fill(); break;
        case 'tree':
            c.beginPath(); c.arc(x + w / 2, y + h / 2, o.r || 30, 0, Math.PI * 2); c.fillStyle = '#0c0a09'; c.fill();
            c.fillStyle = 'rgba(22, 163, 74, 0.4)'; c.beginPath(); c.arc(x + w / 2 + 5, y + h / 2 + 5, Math.max(5, (o.r || 30) - 10), 0, Math.PI * 2); c.fill(); break;
    }
    c.restore();
}

function drJ() {
    if (!isMobile || myLocalTank.hp <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    if (myEquipped.cannon && MODULES[myEquipped.cannon]) tR *= MODULES[myEquipped.cannon].stats.range || 1;
    let bS = (myLocalTank.buff === 'fast' || myLocalTank.buff === 'minigun') ? BASE_BULLET_SPEED * 1.8 : BASE_BULLET_SPEED, mD = (2.5 * tR) * bS;
    ctx.lineTo(myLocalTank.x + Math.cos(myLocalTank.turretAngle) * mD, myLocalTank.y + Math.sin(myLocalTank.turretAngle) * mD);
    ctx.stroke();
    ctx.restore();
}

function drPCA() {
    if (isMobile || myLocalTank.hp <= 0 || (currentRoomData.mode === 'prophunt' && myLocalTank.team === 'hider')) return;
    ctx.save();
    let tR = 1.0;
    if (myEquipped.cannon && MODULES[myEquipped.cannon]) tR = MODULES[myEquipped.cannon].stats.range || 1;
    let d = 60 * tR, ax = myLocalTank.x + Math.cos(myLocalTank.turretAngle) * d, ay = myLocalTank.y + Math.sin(myLocalTank.turretAngle) * d;
    ctx.translate(ax, ay); ctx.rotate(myLocalTank.turretAngle);
    ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, 8); ctx.lineTo(-3, 0); ctx.lineTo(-8, -8); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

socket.on('sync', (data) => {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    currentRoomData.players = data.players;
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
        currentRoomData.teamScores = data.teamScores;
        currentRoomData.timeEndTime = data.timeEndTime;
    }
    let aO = {};
    for (let id in data.players) {
        if (id !== myId) {
            if (!opponents[id]) aO[id] = { ...data.players[id] };
            else {
                aO[id] = opponents[id];
                aO[id].targetX = data.players[id].x;
                aO[id].targetY = data.players[id].y;
                aO[id].targetBody = data.players[id].bodyAngle;
                aO[id].targetTurret = data.players[id].turretAngle;
            }
            aO[id].hp = data.players[id].hp;
            aO[id].buff = data.players[id].buff;
            aO[id].equipped = data.players[id].equipped;
            aO[id].color = data.players[id].color;
            aO[id].team = data.players[id].team;
            aO[id].isDisguised = data.players[id].isDisguised;
            aO[id].propType = data.players[id].propType;
        } else {
            if (currentRoomData.mode === 'prophunt' && myLocalTank.hp > data.players[id].hp) myLocalTank.isDisguised = false;
            myLocalTank.hp = data.players[id].hp;
            myLocalTank.buff = data.players[id].buff;
            myLocalTank.buffProgress = data.players[id].buffProgress;
            myLocalTank.score = data.players[id].score;
            myEquipped = data.players[id].equipped || myEquipped;
            myColor = data.players[id].color;
            myLocalTank.propType = data.players[id].propType;
        }
    }
    opponents = aO;
    zombies = data.zombies || {}; powerups = data.powerups || {}; tokens = data.tokens || {}; mines = data.mines || {};
    if (typeof window.updateHUD === 'function') window.updateHUD();
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
        else if (typeof findNextSpectateTarget === 'function') findNextSpectateTarget(1);
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
    if (Math.hypot(data.x - myLocalTank.x, data.y - myLocalTank.y) < 120) emitDamage(50, 'bomber');
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
    let dN = document.getElementById('drop-notification');
    if (typeof pendingDrop !== 'undefined' && pendingDrop && MODULES[pendingDrop]) {
        let m = MODULES[pendingDrop];
        document.getElementById('drop-name').innerText = m.name;
        document.getElementById('drop-cat').innerText = `${CAT_NAMES[m.type]} | ${RARITY[m.rarity].name}`;
        document.getElementById('drop-cat').style.color = RARITY[m.rarity].color;
        document.getElementById('drop-icon').innerHTML = SVG_ICONS[m.type](RARITY[m.rarity].color);
        dN.classList.remove('hidden');
    } else if (dN) dN.classList.add('hidden');
    
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

function draw(now) {
    if (!currentRoomData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    let shX = 0, shY = 0;
    if (shakeTime > 0) { shX = (Math.random() - 0.5) * 20; shY = (Math.random() - 0.5) * 20; shakeTime -= 0.03; }
    ctx.translate(canvas.width / 2 - camera.x + shX, canvas.height / 2 - camera.y + shY);
    
    let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'epic_map', mS = MAP_DATA[cMap].size;
    ctx.fillStyle = MAP_DATA[cMap].bg || '#020617'; ctx.fillRect(0, 0, mS, mS);
    ctx.strokeStyle = MAP_DATA[cMap].grid || '#1e293b'; ctx.lineWidth = 1;
    
    for (let i = 0; i <= mS; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, mS); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(mS, i); ctx.stroke();
    }
    
    let tm = Date.now() / 1000;
    
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn')) return;
        ctx.save();
        if (o.type === 'line') {
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
    
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type === 'prop_puddle' || o.type === 'prop_crater') return;
        if (o.type === 'shape_triangle') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'shape_rhombus') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w / 2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h / 2); ctx.lineTo(o.x + o.w / 2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h / 2); ctx.fill(); }
        else if (o.type === 'shape_parallelepiped') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w * 0.2, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w * 0.8, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'wall' || o.type === 'wall_square') { ctx.fillStyle = o.color || '#1e293b'; ctx.fillRect(o.x, o.y, o.w, o.h); }
        else if (o.type === 'tree') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r || 30, 0, Math.PI * 2); ctx.fill(); }
        else if (o.type.includes('prop_')) drPrp(ctx, o, tm);
    });
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    
    MAP_DATA[cMap].solids.forEach(o => {
        if (o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type.includes('prop_')) return;
        ctx.save();
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
        const p = opponents[id], sn = currentRoomData.players[id] || { name: 'Гравець', color: 'white', equipped: {} };
        const cH = sn.color ? (sn.color === 'white' ? '#f8fafc' : sn.color === 'black' ? '#1e293b' : sn.color === 'red' ? '#ef4444' : sn.color === 'blue' ? '#3b82f6' : sn.color === 'brown' ? '#78350f' : '#9333ea') : '#ef4444';
        if (p.isDisguised) drPrp(ctx, { type: p.propType, x: p.x - 25, y: p.y - 25, w: 50, h: 50, r: 25 }, tm);
        else drTnk(p.x, p.y, p.bodyAngle, p.turretAngle, cH, sn.name, false, p.hp, p.buff, sn.equipped, true);
        if ((myLocalTank.buff === 'homing' || myLocalTank.buff === 'autolaser') && id === homingTargetId && p.hp > 0) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(now / 300); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.setLineDash([15, 10]); ctx.strokeRect(-45, -45, 90, 90); ctx.restore();
        }
    }
    
    drAL();
    if (myLocalTank.hp > 0) {
        const mC = myColor ? (myColor === 'white' ? '#f8fafc' : myColor === 'black' ? '#1e293b' : myColor === 'red' ? '#ef4444' : myColor === 'blue' ? '#3b82f6' : myColor === 'brown' ? '#78350f' : '#9333ea') : '#3b82f6';
        if (myLocalTank.isDisguised) drPrp(ctx, { type: myLocalTank.propType, x: myLocalTank.x - 25, y: myLocalTank.y - 25, w: 50, h: 50, r: 25 }, tm);
        else { drTnk(myLocalTank.x, myLocalTank.y, myLocalTank.bodyAngle, myLocalTank.turretAngle, mC, myName, true, myLocalTank.hp, myLocalTank.buff, myEquipped, true); drPCA(); }
    }
    
    lasers.forEach(l => { ctx.save(); ctx.strokeStyle = '#38bdf8'; ctx.lineWidth = 4; ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 15; ctx.globalAlpha = Math.max(0, l.life / 0.15); ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); ctx.restore(); });
    
    if (currentRoomData.mode === 'survival') {
        for (let zid in zombies) {
            let z = zombies[zid], zC = zType(z.type); ctx.save(); ctx.translate(z.x, z.y);
            if (zC.ghost) ctx.globalAlpha = 0.5;
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; ctx.fillStyle = zC.color; ctx.beginPath(); ctx.arc(0, 0, zC.radius, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-zC.radius * 0.3, -zC.radius * 0.2, zC.radius * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(zC.radius * 0.3, -zC.radius * 0.2, zC.radius * 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillRect(-zC.radius * 0.4, zC.radius * 0.3, zC.radius * 0.8, zC.radius * 0.2);
            if (zC.isBoss) {
                ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.fillText(zC.name, 0, -zC.radius - 20);
                ctx.fillStyle = '#ef4444'; ctx.fillRect(-40, -zC.radius - 10, 80, 8); ctx.fillStyle = '#22c55e'; ctx.fillRect(-40, -zC.radius - 10, 80 * Math.max(0, Math.min(1, z.hp / (z.maxHp || zC.hp))), 8);
            } else {
                ctx.fillStyle = '#ef4444'; ctx.fillRect(-15, -zC.radius - 10, 30, 4); ctx.fillStyle = '#22c55e'; ctx.fillRect(-15, -zC.radius - 10, 30 * Math.max(0, Math.min(1, z.hp / (z.maxHp || zC.hp))), 4);
            }
            ctx.restore();
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
    
    particles.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5));
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.random() * 4 + 2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1.0;
    });
    ctx.restore();
    
    let tCd = 1.0, cd = BASE_RELOAD;
    if (currentRoomData.mode === 'prophunt') {
        if (myLocalTank.team === 'hunter') cd = 1000; else cd = 9999999;
    } else {
        if (myEquipped.cannon && MODULES[myEquipped.cannon]) tCd *= MODULES[myEquipped.cannon].stats.cd || 1;
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
        if (sT.isDisguised) drPrp(ctx, { type: sT.propType, x: sT.x - 25, y: sT.y - 25, w: 50, h: 50, r: 25 }, tm);
        ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText(`СПОСТЕРІГАННЯ: ${sN}`, canvas.width / 2, 120);
        if (!isMobile) { ctx.font = '14px Jura'; ctx.fillStyle = '#94a3b8'; ctx.fillText(`[A] Попередній  |  Наступний [D]`, canvas.width / 2, 150); }
        ctx.shadowBlur = 0;
    }
    drJ();
}

window.updateHUD = function() {
    if (!currentRoomData || currentRoomData.status !== 'playing') return;
    let mHp = typeof MAX_HP !== 'undefined' ? MAX_HP : 500;
    if (myEquipped && myEquipped.hull && MODULES[myEquipped.hull] && MODULES[myEquipped.hull].stats.hp) mHp *= MODULES[myEquipped.hull].stats.hp;
    if (myEquipped && myEquipped.turret && MODULES[myEquipped.turret] && MODULES[myEquipped.turret].stats.hp) mHp *= MODULES[myEquipped.turret].stats.hp;
    if (myEquipped && myEquipped.tracks && MODULES[myEquipped.tracks] && MODULES[myEquipped.tracks].stats.hp) mHp *= MODULES[myEquipped.tracks].stats.hp;
    mHp = Math.round(mHp);
    let pct = Math.max(0, Math.min(100, (myLocalTank.hp / mHp) * 100)), bC = myLocalTank.hp < mHp * 0.3 ? 'h-full bg-gradient-to-r from-red-600 to-red-400 w-full transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.8)]' : 'h-full bg-gradient-to-r from-green-500 to-emerald-400 w-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]', hpB = document.getElementById('hp-bar'), hpT = document.getElementById('hp-text');
    if (hpB) { hpB.style.width = pct + '%'; hpB.className = bC; }
    if (hpT) hpT.innerText = `${Math.ceil(myLocalTank.hp)}/${mHp}`;
    let hpBM = document.getElementById('hp-bar-mob'), hpTM = document.getElementById('hp-text-mob');
    if (hpBM) { hpBM.style.width = pct + '%'; hpBM.className = bC; }
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
    if (currentRoomData.mode === 'prophunt') {
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
            let tl = Math.max(0, Math.ceil((currentRoomData.timeEndTime - Date.now()) / 1000)), m = Math.floor(tl / 60), s = tl % 60;
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
        
        if (myLocalTank.hp <= 0 && (currentRoomData.mode === 'survival' || currentRoomData.mode === 'prophunt' || currentRoomData.mode === 'team_deathmatch')) {
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
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    if (currentRoomData && currentRoomData.status === 'playing') {
        // Помилка в одному кадрі більше не вбиває цикл: інакше картинка зависає, а звуки з сокетів продовжують грати
        try { updatePhys(now, dt); draw(now); }
        catch (err) {
            if (now - (window.__loopErrAt || 0) > 2000) { window.__loopErrAt = now; console.error('Помилка ігрового циклу (цикл продовжує працювати):', err); }
            try { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.shadowColor = 'transparent'; } catch (e) {}
        }
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', e => {
    if (!e || !e.key) return;
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k) || k === ' ') { if (k === ' ') keys.space = true; else keys[k] = true; }
    if (myLocalTank.hp <= 0 && currentRoomData && (currentRoomData.mode === 'survival' || currentRoomData.mode === 'prophunt' || currentRoomData.mode === 'team_deathmatch')) {
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
    if (!isMobile || myLocalTank.hp <= 0) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        if (t.clientX < canvas.width / 2 && !joysticks.left.active) {
            joysticks.left.active = true; joysticks.left.id = t.identifier;
            joysticks.left.startX = t.clientX; joysticks.left.startY = t.clientY;
            joysticks.left.currentX = t.clientX; joysticks.left.currentY = t.clientY;
        } else if (t.clientX >= canvas.width / 2 && !joysticks.right.active) {
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

function handleTEnd(e) {
    if (!isMobile || myLocalTank.hp <= 0) return;
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