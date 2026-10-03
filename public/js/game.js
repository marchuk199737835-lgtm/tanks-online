const canvas = document.getElementById('game-canvas'); const ctx = canvas.getContext('2d'); window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }); canvas.width = window.innerWidth; canvas.height = window.innerHeight;

let spectatingId = null; // Змінна для режиму спостерігача

function createExplosion(x, y, count, color) { for(let i=0; i<count; i++){ const ang = Math.random() * Math.PI * 2; const spd = Math.random() * 200 + 50; particles.push({ x, y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, life: Math.random() * 0.4 + 0.1, color }); } }

function checkCollision(x, y, r, checkSolids = true, isBullet = false) { 
    if (!currentRoomData) return true; let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'площя'; let mSize = MAP_DATA[cMap].size; 
    if (x - r < 0 || x + r > mSize || y - r < 0 || y + r > mSize) return true; 
    if (checkSolids) { 
        const solids = MAP_DATA[cMap].solids; 
        for (let s of solids) { 
            // Ігноруємо спавни, калюжі, воронки і намальовані лінії
            if(s.type.includes('spawn') || s.type === 'line' || s.type === 'prop_puddle' || s.type === 'prop_crater') continue;
            
            // ВОДА: Танки врізаються, СНАРЯДИ ПРОЛІТАЮТЬ НАД НЕЮ
            if(s.type.includes('water') && isBullet) continue;

            if(s.type === 'tree' || s.type === 'neon_circle' || s.type === 'neon_pillar') { 
                let cx = s.x + (s.w ? s.w/2 : 0); let cy = s.y + (s.h ? s.h/2 : 0); let sr = s.r || (s.w ? s.w/2 : 30);
                if(Math.hypot(x - cx, y - cy) <= r + sr) return true; 
            } 
            else { 
                let testX = Math.max(s.x, Math.min(x, s.x+(s.w||30))), testY = Math.max(s.y, Math.min(y, s.y+(s.h||30))); 
                if(Math.hypot(x-testX, y-testY) <= r) return true; 
            } 
        } 
    } return false; 
}

// ЛОГІКА ПЕРЕМИКАННЯ СПОСТЕРІГАЧА
function findNextSpectateTarget(dir) {
    if (!currentRoomData) return;
    let aliveOps = Object.keys(currentRoomData.players).filter(id => currentRoomData.players[id].hp > 0 && id !== myId);
    if (aliveOps.length === 0) { spectatingId = null; return; }
    if (!spectatingId || !aliveOps.includes(spectatingId)) { spectatingId = aliveOps[0]; } 
    else {
        let idx = aliveOps.indexOf(spectatingId);
        idx = (idx + dir + aliveOps.length) % aliveOps.length;
        spectatingId = aliveOps[idx];
    }
}

function updatePhysics(now, dt) {
    if (!currentRoomData || !currentRoomId) return;
    let myRadius = myLocalTank.buff === 'boss' ? 75 : 30;
    
    // ЯКЩО ГРАВЕЦЬ МЕРТВИЙ - КАМЕРА СЛІДКУЄ ЗА ІНШИМИ (SPECTATOR MODE)
    if (myLocalTank.hp <= 0) {
        if (spectatingId && opponents[spectatingId]) {
            camera.x += (opponents[spectatingId].x - camera.x) * 5 * dt;
            camera.y += (opponents[spectatingId].y - camera.y) * 5 * dt;
        }
    } else {
        // ЯКЩО ЖИВИЙ - ЗВИЧАЙНИЙ РУХ
        let moveX = 0, moveY = 0; let totalSpeed = 1.0;
        if(myEquipped.hull && MODULES[myEquipped.hull]) totalSpeed *= MODULES[myEquipped.hull].stats.speed || 1;
        if(myEquipped.tracks && MODULES[myEquipped.tracks]) totalSpeed *= MODULES[myEquipped.tracks].stats.speed || 1;
        let speedMult = 1.0; if(myLocalTank.buff === 'samurai') speedMult *= 1.5; 
        let speed = (myLocalTank.buff === 'boss' ? TANK_SPEED * 0.6 : TANK_SPEED) * speedMult * totalSpeed;
        
        if (keys.w) moveY -= 1; if (keys.s) moveY += 1; if (keys.a) moveX -= 1; if (keys.d) moveX += 1;
        if (moveX !== 0 || moveY !== 0) { 
            let len = Math.hypot(moveX, moveY); moveX /= len; moveY /= len; myLocalTank.bodyAngle = Math.atan2(moveY, moveX); 
            let nextX = myLocalTank.x + moveX * speed * dt, nextY = myLocalTank.y + moveY * speed * dt; 
            let isBoss = (myLocalTank.buff === 'boss');
            if (!checkCollision(nextX, myLocalTank.y, myRadius, true, false) || isBoss) myLocalTank.x = nextX; 
            if (!checkCollision(myLocalTank.x, nextY, myRadius, true, false) || isBoss) myLocalTank.y = nextY; 
        }

        let wMx = mouseX + camera.x - canvas.width/2, wMy = mouseY + camera.y - canvas.height/2; myLocalTank.turretAngle = Math.atan2(wMy - myLocalTank.y, wMx - myLocalTank.x);
        socket.emit('move', { roomId: currentRoomId, x: myLocalTank.x, y: myLocalTank.y, bodyAngle: myLocalTank.bodyAngle, turretAngle: myLocalTank.turretAngle });

        let fCfg = BUFFS[myLocalTank.buff || 'none'];
        let totalCd = 1.0; let totalRange = 1.0;
        if(myEquipped.cannon && MODULES[myEquipped.cannon]) { totalCd *= MODULES[myEquipped.cannon].stats.cd || 1; totalRange *= MODULES[myEquipped.cannon].stats.range || 1; }

        if (keys.space && (now - lastShootTime >= fCfg.cd * totalCd)) {
            lastShootTime = now; let bId = Date.now() + Math.random(); let bSpd = (myLocalTank.buff === 'fast' || myLocalTank.buff === 'minigun') ? BASE_BULLET_SPEED * 1.8 : BASE_BULLET_SPEED;
            let shot = { roomId: currentRoomId, id: bId, x: myLocalTank.x + Math.cos(myLocalTank.turretAngle)*(myRadius+10), y: myLocalTank.y + Math.sin(myLocalTank.turretAngle)*(myRadius+10), vx: Math.cos(myLocalTank.turretAngle)*bSpd, vy: Math.sin(myLocalTank.turretAngle)*bSpd, type: myLocalTank.buff || 'none', lifeMult: totalRange };
            if (myLocalTank.buff === 'samurai') { shot.x = myLocalTank.x + Math.cos(myLocalTank.turretAngle)*(myRadius+15); shot.y = myLocalTank.y + Math.sin(myLocalTank.turretAngle)*(myRadius+15); shot.vx = Math.cos(myLocalTank.turretAngle) * 100; shot.vy = Math.sin(myLocalTank.turretAngle) * 100; }
            if (myLocalTank.buff === 'homing' && homingTargetId) shot.targetId = homingTargetId; socket.emit('shoot', shot);
        }

        for(let pid in powerups) { if (Math.hypot(powerups[pid].x - myLocalTank.x, powerups[pid].y - myLocalTank.y) < myRadius + 30) socket.emit('collectPowerup', {roomId: currentRoomId, pid: pid}); }
        for(let tid in tokens) { if (Math.hypot(tokens[tid].x - myLocalTank.x, tokens[tid].y - myLocalTank.y) < myRadius + 25) socket.emit('collectToken', {roomId: currentRoomId, tid: tid}); }

        camera.x += (myLocalTank.x - camera.x) * 5 * dt; camera.y += (myLocalTank.y - camera.y) * 5 * dt;
    }

    for (let id in opponents) { let o = opponents[id]; if (o.targetX !== undefined) { if (Math.hypot(o.targetX - o.x, o.targetY - o.y) > 150) { o.x = o.targetX; o.y = o.targetY; } else { o.x += (o.targetX - o.x) * 15 * dt; o.y += (o.targetY - o.y) * 15 * dt; } let db = o.targetBody - o.bodyAngle; while(db > Math.PI) db-=Math.PI*2; while(db < -Math.PI) db+=Math.PI*2; o.bodyAngle += db * 15 * dt; let dtur = o.targetTurret - o.turretAngle; while(dtur > Math.PI) dtur-=Math.PI*2; while(dtur < -Math.PI) dtur+=Math.PI*2; o.turretAngle += dtur * 25 * dt; } }

    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i]; 
        if (b.type === 'homing' && b.targetId) { let tgt = (b.targetId === myId) ? myLocalTank : opponents[b.targetId]; if (tgt && tgt.hp > 0) { let ang = Math.atan2(tgt.y - b.y, tgt.x - b.x); let currentSpd = Math.hypot(b.vx, b.vy); b.vx = Math.cos(ang) * currentSpd; b.vy = Math.sin(ang) * currentSpd; } }
        b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let hit = false; let bCfg = BUFFS[b.type] || BUFFS['none'];
        
        // КУЛІ ПРОЛІТАЮТЬ НАД ВОДОЮ (isBullet = true)
        if (b.type === 'samurai' || b.type === 'homing' || b.type.includes('piercing') || b.type === 'ghost_melee' || b.type === 'boss_proj') { hit = checkCollision(b.x, b.y, 4, false, true); } 
        else { hit = checkCollision(b.x, b.y, 4, true, true); } 
        
        let isSurvival = currentRoomData.mode === 'survival';

        if (!hit && b.owner === myId && !isSurvival) {
            for (let oid in opponents) { let op = opponents[oid]; if (op.hp > 0) { let opRadius = op.buff === 'boss' ? 75 : 30; let hitDist = b.type === 'samurai' ? opRadius + 30 : opRadius + 4; if (Math.hypot(b.x - op.x, b.y - op.y) < hitDist) { hit = true; let dmgToDeal = b.dmgOverride || bCfg.dmg; socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: dmgToDeal }); if(b.type === 'incendiary') { let end = now + 5000; let int = setInterval(() => { if(Date.now() > end || !opponents[oid] || opponents[oid].hp <= 0) clearInterval(int); else { socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: 10 }); createExplosion(opponents[oid].x, opponents[oid].y, 5, '#f97316'); } }, 1000); } break; } } }
        }

        if (!hit && isSurvival && b.owner === myId) { for(let zid in zombies) { let z = zombies[zid]; let zDist = b.type === 'samurai' ? Z_TYPES[z.type].radius + 35 : Z_TYPES[z.type].radius + 10; if (Math.hypot(b.x - z.x, b.y - z.y) < zDist) { hit = true; socket.emit('zombieHit', { roomId: currentRoomId, zid: zid, dmg: bCfg.dmg }); createExplosion(b.x, b.y, 5, Z_TYPES[z.type].color); break; } } }
        if (!hit && b.owner === 'zombie' && myLocalTank.hp > 0) { let hitDist = myRadius + 4; if (Math.hypot(b.x - myLocalTank.x, b.y - myLocalTank.y) < hitDist) { hit = true; let dmgToDeal = b.dmgOverride || bCfg.dmg; playSound('hurt'); shakeTime = 0.3; socket.emit('takeDamage', { roomId: currentRoomId, amt: dmgToDeal, attacker: 'zombie' }); } }
        
        if (hit || b.life <= 0) { 
            if (b.type !== 'shotgun' && b.type !== 'minigun' && b.type !== 'acid' && b.type !== 'samurai') { createExplosion(b.x, b.y, bCfg.type === 'explosive' ? 30 : 10, bCfg.type === 'explosive' ? '#ea580c' : '#fcd34d'); }
            if (hit && bCfg.type === 'explosive' && b.owner === myId) { let splashRad = b.type === 'boss' ? 250 : 120; for (let oid in opponents) { if (opponents[oid].hp > 0 && Math.hypot(b.x - opponents[oid].x, b.y - opponents[oid].y) < splashRad) { socket.emit('registerHit', { roomId: currentRoomId, targetId: oid, amt: bCfg.dmg }); } } } 
            bullets.splice(i, 1); 
        }
    }
    for(let i=particles.length-1; i>=0; i--){ particles[i].life -= dt; particles[i].x += particles[i].vx * dt; particles[i].y += particles[i].vy * dt; if(particles[i].life <= 0) particles.splice(i, 1); }
}

function drawTank(x, y, bodyAngle, turretAngle, colorHex, name, isMe, hp, buff, equipped) {
    if (hp <= 0) return; ctx.save(); ctx.translate(x, y); let scale = buff === 'boss' ? 2.5 : 1.0; ctx.scale(scale, scale); if (buff === 'invisible') ctx.globalAlpha = isMe ? 0.2 : 0.03; else ctx.globalAlpha = 1.0;
    
    ctx.shadowColor = 'transparent'; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; 
    ctx.fillStyle = colorHex; ctx.font = '14px Russo One'; ctx.textAlign = 'center'; if(buff !== 'invisible' || isMe) ctx.fillText(name, 0, -45);
    
    let baseHullCol = '#1e293b'; 
    let hCol = equipped && equipped.hull && MODULES[equipped.hull] ? RARITY[MODULES[equipped.hull].rarity].color : '#0f172a';
    let trCol = equipped && equipped.tracks && MODULES[equipped.tracks] ? RARITY[MODULES[equipped.tracks].rarity].color : '#0f172a';
    let cCol = equipped && equipped.cannon && MODULES[equipped.cannon] ? RARITY[MODULES[equipped.cannon].rarity].color : '#0f172a';
    let tuCol = equipped && equipped.turret && MODULES[equipped.turret] ? RARITY[MODULES[equipped.turret].rarity].color : '#334155';

    ctx.save(); ctx.rotate(bodyAngle); 
    ctx.fillStyle = trCol; ctx.shadowColor = trCol; ctx.shadowBlur = equipped && equipped.tracks ? 15 : 0;
    ctx.fillRect(-36, -32, 72, 14); ctx.fillRect(-36, 18, 72, 14); ctx.shadowBlur = 0;
    
    ctx.fillStyle = baseHullCol; ctx.strokeStyle = hCol; ctx.lineWidth = equipped && equipped.hull ? 3 : 1;
    if(equipped && equipped.hull) { ctx.shadowColor = hCol; ctx.shadowBlur = 10; }
    ctx.fillRect(-30, -22, 60, 44); ctx.strokeRect(-30, -22, 60, 44); ctx.shadowBlur = 0;
    ctx.restore();
    
    ctx.save(); ctx.rotate(turretAngle); 
    ctx.fillStyle = '#334155'; ctx.strokeStyle = cCol; ctx.lineWidth = equipped && equipped.cannon ? 3 : 1;
    if(equipped && equipped.cannon) { ctx.shadowColor = cCol; ctx.shadowBlur = 10; }
    let cLen = 45; if(equipped && equipped.cannon && MODULES[equipped.cannon].stats.range > 1.1) cLen = 60;
    if(equipped && equipped.cannon && MODULES[equipped.cannon].stats.range < 1.0) cLen = 35;
    ctx.fillRect(0, -6, cLen, 12); ctx.strokeRect(0, -6, cLen, 12); ctx.shadowBlur = 0;
    
    ctx.fillStyle = baseHullCol; ctx.strokeStyle = tuCol; ctx.lineWidth = equipped && equipped.turret ? 3 : 1;
    if(equipped && equipped.turret) { ctx.shadowColor = tuCol; ctx.shadowBlur = 15; }
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.beginPath(); ctx.arc(-4, -4, 8, 0, Math.PI*2); ctx.fill(); 
    ctx.restore(); ctx.restore();
}

function drawProp(ctx, o, time) {
    let x = o.x, y = o.y, w = o.w||30, h = o.h||30; ctx.save();
    switch(o.type) {
        case 'prop_crate': ctx.fillStyle = '#b45309'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#78350f'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, h); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+w, y+h); ctx.moveTo(x+w, y); ctx.lineTo(x, y+h); ctx.stroke(); break;
        case 'prop_barrel': ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, Math.min(w,h)/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, Math.min(w,h)/2 - 4, 0, Math.PI*2); ctx.fill(); break;
        case 'prop_sandbag': ctx.fillStyle = '#d4a373'; ctx.strokeStyle = '#a68a64'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x, y, w, h/2, 10); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(x+5, y+h/2, w-10, h/2, 10); ctx.fill(); ctx.stroke(); break;
        case 'prop_rock': ctx.fillStyle = '#52525b'; ctx.beginPath(); ctx.moveTo(x+w/2, y); ctx.lineTo(x+w, y+h/3); ctx.lineTo(x+w*0.8, y+h); ctx.lineTo(x+w*0.2, y+h); ctx.lineTo(x, y+h/2); ctx.fill(); break;
        case 'prop_bush': ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(x+w/3, y+h/3, w/2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+w*0.7, y+h/3, w/2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x+w/2, y+h*0.7, w/2.5, 0, Math.PI*2); ctx.fill(); break;
        case 'prop_cone': ctx.fillStyle = '#ea580c'; ctx.beginPath(); ctx.moveTo(x+w/2, y); ctx.lineTo(x+w, y+h); ctx.lineTo(x, y+h); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(x+w*0.3, y+h*0.5, w*0.4, h*0.2); break;
        case 'prop_concrete': ctx.fillStyle = '#a1a1aa'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#71717a'; ctx.lineWidth = 2; ctx.strokeRect(x+2, y+2, w-4, h-4); break;
        case 'prop_hedgehog': ctx.strokeStyle = '#71717a'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x+w, y+h); ctx.moveTo(x+w, y); ctx.lineTo(x, y+h); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x+w/2, y); ctx.lineTo(x+w/2, y+h); ctx.moveTo(x, y+h/2); ctx.lineTo(x+w, y+h/2); ctx.stroke(); break;
        case 'prop_radar': ctx.fillStyle = '#334155'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w/2, 0, Math.PI*2); ctx.fill(); ctx.translate(x+w/2, y+h/2); ctx.rotate(time * 2); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w/2, 0); ctx.stroke(); break;
        case 'prop_tent': ctx.fillStyle = '#4d7c0f'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#1a2e05'; ctx.beginPath(); ctx.moveTo(x+w/2, y+h); ctx.lineTo(x+w/2 - 15, y+h - 20); ctx.lineTo(x+w/2 + 15, y+h - 20); ctx.fill(); break;
        case 'prop_cont_red': case 'prop_cont_blue': ctx.fillStyle = o.type === 'prop_cont_red' ? '#dc2626' : '#2563eb'; ctx.fillRect(x, y, w, h); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; for(let l=x+10; l<x+w; l+=15) { ctx.beginPath(); ctx.moveTo(l, y); ctx.lineTo(l, y+h); ctx.stroke(); } break;
        case 'prop_fence_wood': ctx.fillStyle = '#78350f'; ctx.fillRect(x, y+h/2-2, w, 4); for(let fx=x; fx<=x+w; fx+=20) { ctx.beginPath(); ctx.arc(fx, y+h/2, 4, 0, Math.PI*2); ctx.fill(); } break;
        case 'prop_fence_metal': ctx.fillStyle = '#94a3b8'; ctx.fillRect(x, y+h/2-1, w, 2); ctx.setLineDash([5, 5]); ctx.strokeStyle='#94a3b8'; ctx.beginPath(); ctx.moveTo(x, y+h/2-5); ctx.lineTo(x+w, y+h/2-5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x, y+h/2+5); ctx.lineTo(x+w, y+h/2+5); ctx.stroke(); break;
        case 'prop_wreck': ctx.fillStyle = '#1c1917'; ctx.fillRect(x+5, y+10, w-10, h-20); ctx.fillStyle = '#09090b'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, 15, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = '#09090b'; ctx.lineWidth=6; ctx.beginPath(); ctx.moveTo(x+w/2, y+h/2); ctx.lineTo(x+w, y+h); ctx.stroke(); break;
        case 'prop_tires': ctx.fillStyle = '#171717'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#27272a'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w/3, 0, Math.PI*2); ctx.fill(); break;
        case 'prop_generator': ctx.fillStyle = '#eab308'; ctx.fillRect(x, y, w, h); ctx.fillStyle = '#171717'; ctx.fillRect(x+5, y+5, w-10, h/2); break;
        case 'prop_spotlight': ctx.fillStyle = '#d4d4d8'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, 10, 0, Math.PI*2); ctx.fill(); ctx.translate(x+w/2, y+h/2); ctx.rotate(Math.sin(time)*0.5); ctx.fillStyle = 'rgba(253, 224, 71, 0.2)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(150, -40); ctx.lineTo(150, 40); ctx.fill(); break;
        case 'prop_puddle': ctx.fillStyle = '#451a03'; ctx.beginPath(); ctx.ellipse(x+w/2, y+h/2, w/2, h/3, Math.PI/4, 0, Math.PI*2); ctx.fill(); break;
        case 'prop_crater': ctx.fillStyle = '#27272a'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w/2, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = '#09090b'; ctx.beginPath(); ctx.arc(x+w/2, y+h/2, w/3, 0, Math.PI*2); ctx.fill(); break;
    }
    ctx.restore();
}

function draw(now) {
    if(!currentRoomData) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.save();
    let shX = 0, shY = 0; if (shakeTime > 0) { shX = (Math.random() - 0.5) * 20; shY = (Math.random() - 0.5) * 20; shakeTime -= 0.03; } ctx.translate(canvas.width/2 - camera.x + shX, canvas.height/2 - camera.y + shY);
    
    let cMap = MAP_DATA[currentRoomData.map] ? currentRoomData.map : 'площя'; let mSize = MAP_DATA[cMap].size; ctx.fillStyle = MAP_DATA[cMap].bg || '#020617'; ctx.fillRect(0, 0, mSize, mSize); ctx.strokeStyle = MAP_DATA[cMap].grid || '#1e293b'; ctx.lineWidth = 1;
    for(let i=0; i<=mSize; i+=50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, mSize); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(mSize, i); ctx.stroke(); }
    
    let time = Date.now() / 1000;

    // --- ПІДЛОГА (ВОДА, ЛІНІЇ) ---
    MAP_DATA[cMap].solids.forEach(o => {
        if(o.type.includes('spawn')) return;
        ctx.save();
        if (o.type === 'line') { ctx.strokeStyle = o.color; ctx.lineWidth = o.width; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(o.points[0].x, o.points[0].y); for(let i=1; i<o.points.length; i++) ctx.lineTo(o.points[i].x, o.points[i].y); ctx.stroke(); } 
        else if (o.type.includes('water')) {
            ctx.fillStyle = '#0369a1'; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
            if(o.type === 'water_curve') { ctx.beginPath(); ctx.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w,o.h)/2); ctx.fill(); ctx.clip(); } 
            else { ctx.fillRect(o.x, o.y, o.w, o.h); ctx.beginPath(); ctx.rect(o.x, o.y, o.w, o.h); ctx.clip(); }
            ctx.setLineDash([20, 20]); ctx.lineDashOffset = -time * 20;
            for(let wy=o.y+10; wy<o.y+o.h; wy+=30) { ctx.beginPath(); ctx.moveTo(o.x, wy); ctx.lineTo(o.x+o.w, wy); ctx.stroke(); }
            ctx.setLineDash([]);
        }
        else if (o.type === 'prop_puddle' || o.type === 'prop_crater') { drawProp(ctx, o, time); }
        ctx.restore();
    });

    for (let tid in tokens) { const tkn = tokens[tid]; ctx.save(); ctx.translate(tkn.x, tkn.y + Math.sin(now/200)*10); const colorHex = tkn.color==='white'?'#f8fafc':tkn.color==='black'?'#1e293b':tkn.color==='red'?'#ef4444':tkn.color==='blue'?'#3b82f6':tkn.color==='brown'?'#78350f':'#9333ea'; ctx.shadowColor = colorHex; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fillStyle = '#0f172a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = colorHex; ctx.stroke(); ctx.fillStyle = colorHex; ctx.font = '16px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, 1); ctx.restore(); }
    
    // --- ТІНІ ДЛЯ ВИСОКИХ ОБ'ЄКТІВ (ВКЛЮЧНО З ФІГУРАМИ) ---
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 15; ctx.shadowOffsetX = 8; ctx.shadowOffsetY = 12;
    MAP_DATA[cMap].solids.forEach(o => {
        if(o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type === 'prop_puddle' || o.type === 'prop_crater') return;
        
        if (o.type === 'shape_triangle') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w/2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'shape_rhombus') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w/2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h/2); ctx.lineTo(o.x + o.w/2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h/2); ctx.fill(); }
        else if (o.type === 'shape_parallelepiped') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w*0.2, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w*0.8, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'wall' || o.type === 'wall_square') { ctx.fillStyle = o.color || '#1e293b'; ctx.fillRect(o.x, o.y, o.w, o.h); }
        else if (o.type === 'tree') { ctx.beginPath(); ctx.arc(o.x, o.y, o.r||30, 0, Math.PI*2); ctx.fill(); }
        else if (o.type.includes('prop_')) { drawProp(ctx, o, time); }
    });
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

    // --- ДЕТАЛІ ТА НЕОН ---
    MAP_DATA[cMap].solids.forEach(o => {
        if(o.type.includes('spawn') || o.type.includes('water') || o.type === 'line' || o.type.includes('prop_')) return;
        ctx.save();
        
        if (o.type === 'shape_triangle') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w/2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'shape_rhombus') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w/2, o.y); ctx.lineTo(o.x + o.w, o.y + o.h/2); ctx.lineTo(o.x + o.w/2, o.y + o.h); ctx.lineTo(o.x, o.y + o.h/2); ctx.fill(); }
        else if (o.type === 'shape_parallelepiped') { ctx.fillStyle = o.color || '#333'; ctx.beginPath(); ctx.moveTo(o.x + o.w*0.2, o.y); ctx.lineTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w*0.8, o.y + o.h); ctx.lineTo(o.x, o.y + o.h); ctx.fill(); }
        else if (o.type === 'wall' || o.type === 'wall_square') {
            if (o.neon) { ctx.strokeStyle = o.neon; ctx.lineWidth = 2; ctx.strokeRect(o.x, o.y, o.w, o.h); ctx.fillStyle = o.neon; ctx.globalAlpha = 0.2; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.globalAlpha = 1.0; }
            if (o.stripe) { ctx.fillStyle = o.stripe; ctx.fillRect(o.x, o.y + o.h/2 - 10, o.w, 20); }
            if (!o.neon && !o.stripe) { ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(o.x, o.y, o.w, 5); }
        } 
        else if (o.type === 'tree') { ctx.fillStyle = 'rgba(22, 163, 74, 0.4)'; ctx.beginPath(); ctx.arc(o.x+5, o.y+5, Math.max(5,(o.r||30)-10), 0, Math.PI*2); ctx.fill(); }
        else if (o.type.includes('neon')) {
            ctx.strokeStyle = o.color || '#3b82f6'; ctx.lineWidth = 4; ctx.shadowColor = o.color || '#3b82f6'; ctx.shadowBlur = 15 + Math.sin(time*5)*5;
            if(o.type === 'neon_wall') ctx.strokeRect(o.x, o.y, o.w, o.h);
            else if(o.type === 'neon_circle') { ctx.beginPath(); ctx.arc(o.x+o.w/2, o.y+o.h/2, Math.min(o.w,o.h)/2, 0, Math.PI*2); ctx.stroke(); }
            else if(o.type === 'neon_cross') { ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.moveTo(o.x+o.w, o.y); ctx.lineTo(o.x, o.y+o.h); ctx.stroke(); }
            else if(o.type === 'neon_triangle') { ctx.beginPath(); ctx.moveTo(o.x+o.w/2, o.y); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.lineTo(o.x, o.y+o.h); ctx.closePath(); ctx.stroke(); }
            else if(o.type === 'neon_diamond') { ctx.beginPath(); ctx.moveTo(o.x+o.w/2, o.y); ctx.lineTo(o.x+o.w, o.y+o.h/2); ctx.lineTo(o.x+o.w/2, o.y+o.h); ctx.lineTo(o.x, o.y+o.h/2); ctx.closePath(); ctx.stroke(); }
            else if(o.type === 'neon_arch') { ctx.beginPath(); ctx.moveTo(o.x, o.y+o.h); ctx.lineTo(o.x, o.y+o.h/2); ctx.arc(o.x+o.w/2, o.y+o.h/2, o.w/2, Math.PI, 0); ctx.lineTo(o.x+o.w, o.y+o.h); ctx.stroke(); }
            else if(o.type === 'neon_pillar') { ctx.beginPath(); ctx.ellipse(o.x+o.w/2, o.y+o.h/2, o.w/2, o.h/2, 0, 0, Math.PI*2); ctx.stroke(); }
            ctx.fillStyle = o.color || '#3b82f6'; ctx.globalAlpha = 0.2; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.globalAlpha = 1.0;
        }
        ctx.restore();
    });
    
    for(let pid in powerups) { const pu = powerups[pid]; const boxColor = PU_COLORS[pu.type] || '#38bdf8'; ctx.save(); ctx.translate(pu.x, pu.y); ctx.rotate(now / 500); ctx.fillStyle = '#334155'; ctx.fillRect(-20, -20, 40, 40); ctx.strokeStyle = boxColor; ctx.lineWidth = 3; ctx.strokeRect(-20, -20, 40, 40); ctx.fillStyle = boxColor; ctx.shadowBlur = 10; ctx.shadowColor = boxColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '24px Russo One'; ctx.fillText(PU_ICONS[pu.type], 0, 2); ctx.restore(); }
    
    for (let id in opponents) { 
        const p = opponents[id]; const sn = currentRoomData.players[id] || { name: 'Гравець', color: 'white', equipped: {} }; 
        const cHex = sn.color==='white'?'#f8fafc':sn.color==='black'?'#1e293b':sn.color==='red'?'#ef4444':sn.color==='blue'?'#3b82f6':sn.color==='brown'?'#78350f':'#9333ea'; drawTank(p.x, p.y, p.bodyAngle, p.turretAngle, cHex, sn.name, false, p.hp, p.buff, sn.equipped); if (myLocalTank.buff === 'homing' && id === homingTargetId && p.hp > 0) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(now/300); ctx.strokeStyle = '#10b981'; ctx.lineWidth = 3; ctx.setLineDash([15, 10]); ctx.strokeRect(-45, -45, 90, 90); ctx.restore(); } 
    }
    if (myLocalTank.hp > 0) { const myCHex = myColor==='white'?'#f8fafc':myColor==='black'?'#1e293b':myColor==='red'?'#ef4444':myColor==='blue'?'#3b82f6':myColor==='brown'?'#78350f':'#9333ea'; drawTank(myLocalTank.x, myLocalTank.y, myLocalTank.bodyAngle, myLocalTank.turretAngle, myCHex, myName, true, myLocalTank.hp, myLocalTank.buff, myEquipped); }
    
    if (currentRoomData.mode === 'survival') { 
        for (let zid in zombies) { 
            let z = zombies[zid]; let zCfg = Z_TYPES[z.type]; ctx.save(); ctx.translate(z.x, z.y); 
            if (zCfg.ghost) ctx.globalAlpha = 0.5; ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 5; 
            ctx.fillStyle = zCfg.color; ctx.beginPath(); ctx.arc(0, 0, zCfg.radius, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-zCfg.radius*0.3, -zCfg.radius*0.2, zCfg.radius*0.2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(zCfg.radius*0.3, -zCfg.radius*0.2, zCfg.radius*0.2, 0, Math.PI*2); ctx.fill(); ctx.fillRect(-zCfg.radius*0.4, zCfg.radius*0.3, zCfg.radius*0.8, zCfg.radius*0.2); 
            if (zCfg.isBoss) { ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.fillText(zCfg.name, 0, -zCfg.radius - 20); ctx.fillStyle = '#ef4444'; ctx.fillRect(-40, -zCfg.radius-10, 80, 8); ctx.fillStyle = '#22c55e'; ctx.fillRect(-40, -zCfg.radius-10, 80 * (z.hp/zCfg.hp), 8); } else { ctx.fillStyle = '#ef4444'; ctx.fillRect(-15, -zCfg.radius-10, 30, 4); ctx.fillStyle = '#22c55e'; ctx.fillRect(-15, -zCfg.radius-10, 30 * (z.hp/zCfg.hp), 4); }
            ctx.restore(); 
        } 
    }
    
    ctx.shadowColor = 'transparent';
    bullets.forEach(b => { 
        if (b.type === 'samurai') { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx)); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 10; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15; ctx.beginPath(); ctx.arc(0, 0, 25, -Math.PI/1.5, Math.PI/1.5); ctx.stroke(); ctx.restore(); return; }
        ctx.beginPath(); if(b.type === 'piercing' || b.type === 'fast' || b.type === 'minigun' || b.type === 'homing') { ctx.moveTo(b.x, b.y-4); ctx.lineTo(b.x+20, b.y); ctx.lineTo(b.x, b.y+4); } else if (b.type === 'acid') { ctx.arc(b.x, b.y, 8, 0, Math.PI*2); } else if (b.type === 'boss_proj') { ctx.arc(b.x, b.y, 10, 0, Math.PI*2); } else ctx.arc(b.x, b.y, 6, 0, Math.PI*2); let bCol = b.type === 'fast' || b.type === 'minigun' ? '#38bdf8' : b.type === 'explosive' || b.type === 'boss_proj' ? '#fb923c' : b.type === 'incendiary' ? '#ef4444' : b.type === 'piercing' ? '#d946ef' : b.type === 'acid' ? '#a3e635' : b.type === 'shotgun' ? '#f8fafc' : b.type === 'homing' ? '#10b981' : '#fef08a'; ctx.fillStyle = bCol; ctx.shadowColor = bCol; ctx.shadowBlur = 10; ctx.fill(); ctx.shadowBlur = 0; 
    });
    
    particles.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.5)); ctx.beginPath(); ctx.arc(p.x, p.y, Math.random()*4+2, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0; }); ctx.restore();
    
    let totalCd = 1.0; if(myEquipped.cannon && MODULES[myEquipped.cannon]) totalCd *= MODULES[myEquipped.cannon].stats.cd || 1;
    let cd = (BUFFS[myLocalTank.buff] || BUFFS['none']).cd * totalCd; 
    let bar = document.getElementById('cooldown-bar'); if (now - lastShootTime < cd) { bar.style.transition = 'none'; bar.style.width = ((now - lastShootTime) / cd * 100) + '%'; } else { bar.style.width = '100%'; }
    const timerContainer = document.getElementById('buff-timer-container'); if (myLocalTank.buff && myLocalTank.buffProgress > 0) { timerContainer.classList.remove('hidden'); document.getElementById('buff-timer-icon').innerText = PU_ICONS[myLocalTank.buff]; document.getElementById('buff-timer-name').innerText = BUFF_NAMES[myLocalTank.buff]; document.getElementById('buff-timer-name').style.color = PU_COLORS[myLocalTank.buff] || '#cbd5e1'; document.getElementById('buff-timer-bar').style.width = (myLocalTank.buffProgress * 100) + '%'; } else { timerContainer.classList.add('hidden'); }

    // --- ТЕКСТ СПОСТЕРІГАЧА (SPECTATOR UI) ---
    if (myLocalTank.hp <= 0 && spectatingId && opponents[spectatingId]) {
        let specName = currentRoomData.players[spectatingId] ? currentRoomData.players[spectatingId].name : 'ГРАВЕЦЬ';
        ctx.fillStyle = '#fff'; ctx.font = '24px Russo One'; ctx.textAlign = 'center'; ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText(`СПОСТЕРІГАННЯ: ${specName}`, canvas.width/2, 100);
        if (currentRoomData.mode === 'survival') {
            ctx.font = '14px Jura'; ctx.fillStyle = '#94a3b8';
            ctx.fillText(`[A] Попередній  |  Наступний [D]`, canvas.width/2, 130);
        }
        ctx.shadowBlur = 0;
    }
}

function updateHUD() {
    if(!currentRoomData) return;
    
    let myTotalHp = 1.0;
    if(myEquipped.hull && MODULES[myEquipped.hull]) myTotalHp *= MODULES[myEquipped.hull].stats.hp || 1;
    if(myEquipped.turret && MODULES[myEquipped.turret]) myTotalHp *= MODULES[myEquipped.turret].stats.hp || 1;
    if(myEquipped.tracks && MODULES[myEquipped.tracks]) myTotalHp *= MODULES[myEquipped.tracks].stats.hp || 1;
    let myMaxHp = Math.round(MAX_HP * myTotalHp);

    document.getElementById('hp-bar').style.width = Math.max(0, (myLocalTank.hp/myMaxHp)*100) + '%'; document.getElementById('hp-text').innerText = `${Math.ceil(myLocalTank.hp)}/${myMaxHp}`;
    let vignetteOpacity = 0; if (myLocalTank.hp < myMaxHp) vignetteOpacity = (1 - (myLocalTank.hp / myMaxHp)) * 0.85; document.getElementById('damage-vignette').style.opacity = vignetteOpacity;
    if(myLocalTank.hp < myMaxHp * 0.3) document.getElementById('hp-bar').className = 'h-full bg-gradient-to-r from-red-600 to-red-400 w-full transition-all duration-300 shadow-[0_0_15px_rgba(239,68,68,0.8)]'; else document.getElementById('hp-bar').className = 'h-full bg-gradient-to-r from-green-500 to-emerald-400 w-full transition-all duration-300 shadow-[0_0_10px_rgba(34,197,94,0.5)]';
    const targetUI = document.getElementById('homing-target-ui'); if (myLocalTank.buff === 'homing') targetUI.classList.remove('hidden'); else targetUI.classList.add('hidden');
    const slist = document.getElementById('score-list'); slist.innerHTML = ''; if (currentRoomData.mode === 'survival') { document.getElementById('target-score-display').innerText = currentRoomData.wave; }
    Object.values(currentRoomData.players).sort((a,b) => b.score - a.score).forEach(p => { slist.innerHTML += `<div class="flex justify-between w-full ${p.id===myId?'text-blue-400':'text-slate-300'} border-b border-slate-700/50 pb-1 ${p.hp<=0?'opacity-30 line-through':''}"><span>${p.name}</span><span class="font-bold">${currentRoomData.mode === 'survival' ? Math.ceil(p.hp) : p.score}</span></div>`; });
}

function startGameLoop() { if(gameLoopId) cancelAnimationFrame(gameLoopId); lastTime = performance.now(); requestAnimationFrame(gameLoop); }
function gameLoop(now) { const dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now; if (currentRoomData && currentRoomData.status === 'playing') { updatePhysics(now, dt); draw(now); } gameLoopId = requestAnimationFrame(gameLoop); }

window.addEventListener('keydown', e => { 
    if (!e || !e.key) return; const k = e.key.toLowerCase(); if(keys.hasOwnProperty(k) || k===' ') { if(k===' ') keys.space = true; else keys[k] = true; }
    
    // SPECTATOR CONTROLS (Керування камерою після смерті)
    if (myLocalTank.hp <= 0 && currentRoomData && currentRoomData.mode === 'survival') {
        if (k === 'a') findNextSpectateTarget(-1);
        if (k === 'd') findNextSpectateTarget(1);
    }

    if(e.key === 'Tab') { e.preventDefault(); if(myLocalTank.buff === 'homing') { let visibleOps = Object.keys(opponents).filter(id => opponents[id].hp > 0 && Math.hypot(opponents[id].x - myLocalTank.x, opponents[id].y - myLocalTank.y) < 1500); if(visibleOps.length > 0) { playSound('hitmarker'); if(!homingTargetId || !visibleOps.includes(homingTargetId)) homingTargetId = visibleOps[0]; else { let idx = visibleOps.indexOf(homingTargetId); homingTargetId = visibleOps[(idx + 1) % visibleOps.length]; } } else homingTargetId = null; } }
});
window.addEventListener('keyup', e => { if (!e || !e.key) return; const k = e.key.toLowerCase(); if(keys.hasOwnProperty(k) || k===' ') { if(k===' ') keys.space = false; else keys[k] = false; } });
window.addEventListener('mousemove', e => { mouseX = e.clientX; mouseY = e.clientY; });