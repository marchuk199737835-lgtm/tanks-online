/* editor-render.js — малювання мапи в редакторі (той самий вигляд, що й у грі) */
const canvas = document.getElementById('map-canvas');
const ctx = canvas.getContext('2d');

function applyZoom() {
    canvas.width = ED.settings.size; canvas.height = ED.settings.size;
    canvas.style.width = Math.round(ED.settings.size * ED.zoom) + 'px'; canvas.style.height = Math.round(ED.settings.size * ED.zoom) + 'px';
    const z = document.getElementById('tb-zoom-val'); if (z) z.innerText = Math.round(ED.zoom * 100) + '%';
}

function drawNeon(c, o, time) {
    const col = o.color || '#3b82f6';
    c.strokeStyle = col; c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 15 + Math.sin(time * 5) * 5;
    if (o.type === 'neon_wall') c.strokeRect(o.x, o.y, o.w, o.h);
    else if (o.type === 'neon_circle') { c.beginPath(); c.arc(o.x + o.w / 2, o.y + o.h / 2, Math.min(o.w, o.h) / 2, 0, Math.PI * 2); c.stroke(); }
    else if (o.type === 'neon_cross') { c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.moveTo(o.x + o.w, o.y); c.lineTo(o.x, o.y + o.h); c.stroke(); }
    else if (o.type === 'neon_triangle') { c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.lineTo(o.x, o.y + o.h); c.closePath(); c.stroke(); }
    else if (o.type === 'neon_diamond') { c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h / 2); c.lineTo(o.x + o.w / 2, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.closePath(); c.stroke(); }
    else if (o.type === 'neon_arch') { c.beginPath(); c.moveTo(o.x, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, Math.PI, 0); c.lineTo(o.x + o.w, o.y + o.h); c.stroke(); }
    else if (o.type === 'neon_pillar') { c.beginPath(); c.ellipse(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, o.h / 2, 0, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = col; c.globalAlpha = 0.2; c.fillRect(o.x, o.y, o.w, o.h); c.globalAlpha = 1.0;
}

function drawObject(c, o, time) {
    c.save();
    if (o.preview) c.globalAlpha = 0.55;
    MapObj.applyRot(c, o);
    if (o.type === 'line') {
        c.strokeStyle = o.color; c.lineWidth = o.width; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(o.points[0].x, o.points[0].y); for (let i = 1; i < o.points.length; i++) c.lineTo(o.points[i].x, o.points[i].y); c.stroke();
    } else if (o.type.indexOf('water') >= 0) {
        c.fillStyle = '#0369a1'; c.strokeStyle = 'rgba(255,255,255,0.3)'; c.lineWidth = 2;
        if (o.type === 'water_curve') { c.beginPath(); c.roundRect(o.x, o.y, o.w, o.h, Math.min(o.w, o.h) / 2); c.fill(); c.clip(); }
        else { c.fillRect(o.x, o.y, o.w, o.h); c.beginPath(); c.rect(o.x, o.y, o.w, o.h); c.clip(); }
        c.setLineDash([20, 20]); c.lineDashOffset = -time * 20;
        for (let wy = o.y + 10; wy < o.y + o.h; wy += 30) { c.beginPath(); c.moveTo(o.x, wy); c.lineTo(o.x + o.w, wy); c.stroke(); }
        c.setLineDash([]);
    }
    else if (o.type === 'shape_triangle') { c.fillStyle = o.color || '#333'; c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.lineTo(o.x, o.y + o.h); c.fill(); }
    else if (o.type === 'shape_rhombus') { c.fillStyle = o.color || '#333'; c.beginPath(); c.moveTo(o.x + o.w / 2, o.y); c.lineTo(o.x + o.w, o.y + o.h / 2); c.lineTo(o.x + o.w / 2, o.y + o.h); c.lineTo(o.x, o.y + o.h / 2); c.fill(); }
    else if (o.type === 'shape_parallelepiped') { c.fillStyle = o.color || '#333'; c.beginPath(); c.moveTo(o.x + o.w * 0.2, o.y); c.lineTo(o.x + o.w, o.y); c.lineTo(o.x + o.w * 0.8, o.y + o.h); c.lineTo(o.x, o.y + o.h); c.fill(); }
    else if (o.type === 'wall_square' || o.type === 'wall') {
        c.fillStyle = o.color || '#1e293b'; c.fillRect(o.x, o.y, o.w, o.h);
        if (o.neon) { c.strokeStyle = o.neon; c.lineWidth = 2; c.strokeRect(o.x, o.y, o.w, o.h); }
        if (o.stripe) { c.fillStyle = o.stripe; c.fillRect(o.x, o.y + o.h / 2 - 10, o.w, 20); }
    }
    else if (o.type.indexOf('neon') >= 0) drawNeon(c, o, time);
    else if (o.type === 'tree') {
        c.fillStyle = '#0c0a09'; c.beginPath(); c.arc(o.x, o.y, o.r || 30, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(22, 163, 74, 0.4)'; c.beginPath(); c.arc(o.x + 5, o.y + 5, Math.max(5, (o.r || 30) - 10), 0, Math.PI * 2); c.fill();
    }
    else if (o.type.indexOf('spawn') >= 0) {
        const SPC = { spawn_player: ['#3b82f6', 'P'], spawn_zombie: ['#22c55e', 'Z'], spawn_core: ['#ef4444', '🏰'], spawn_cp: ['#a855f7', '🚩'], spawn_convoy_a: ['#06b6d4', 'A'], spawn_convoy_b: ['#f97316', 'B'] }, spc = SPC[o.type] || ['#eab308', '*'], col = spc[0];
        c.beginPath(); c.arc(o.x, o.y, 20, 0, Math.PI * 2); c.fillStyle = col; c.fill();
        c.fillStyle = '#fff'; c.font = '16px Russo One'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(spc[1], o.x, o.y);
        if (ED.shape && ED.shape.length >= 3 && !MapObj.circleInPoly(ED.shape, o.x, o.y, 5)) { c.strokeStyle = '#ef4444'; c.lineWidth = 5; c.beginPath(); c.arc(o.x, o.y, 26, 0, Math.PI * 2); c.moveTo(o.x - 18, o.y - 18); c.lineTo(o.x + 18, o.y + 18); c.stroke(); }
    }
    else if (o.type.indexOf('prop_') === 0) MapObj.drawProp(c, o, time);
    c.restore();
}

// Контур обводки вибраного об'єкта (з урахуванням повороту)
function drawSelection(c, o, time) {
    c.save();
    c.strokeStyle = '#38bdf8'; c.lineWidth = 2 / ED.zoom * 0.6 + 1; c.setLineDash([8, 6]); c.lineDashOffset = -time * 20;
    if (o.type === 'line') {
        let a = Infinity, b = Infinity, d = -Infinity, e = -Infinity; o.points.forEach(p => { a = Math.min(a, p.x); b = Math.min(b, p.y); d = Math.max(d, p.x); e = Math.max(e, p.y); });
        c.strokeRect(a - 8, b - 8, d - a + 16, e - b + 16);
    } else if (o.type === 'tree') { c.beginPath(); c.arc(o.x, o.y, (o.r || 30) + 4, 0, Math.PI * 2); c.stroke(); }
    else if (o.type.indexOf('spawn') >= 0) { c.beginPath(); c.arc(o.x, o.y, 26, 0, Math.PI * 2); c.stroke(); }
    else { MapObj.applyRot(c, o); c.strokeRect(o.x - 3, o.y - 3, (o.w || 30) + 6, (o.h || 30) + 6); }
    c.restore();
}

function drawShapeOverlay(c) {
    const S = ED.settings.size;
    if (ED.shape && ED.shape.length >= 3) {
        c.save(); c.fillStyle = 'rgba(0,0,0,0.62)'; c.beginPath(); c.rect(0, 0, S, S);
        ED.shape.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fill('evenodd');
        c.strokeStyle = '#38bdf8'; c.lineWidth = 4; c.lineJoin = 'round'; c.shadowColor = '#38bdf8'; c.shadowBlur = 12;
        c.beginPath(); ED.shape.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.stroke(); c.restore();
    }
    const showHandles = (ED.tool === 'contour_edit') && ED.shape;
    if (showHandles) { c.save(); ED.shape.forEach((p, i) => { c.fillStyle = i === ED.dragVertex ? '#f59e0b' : '#fff'; c.strokeStyle = '#0369a1'; c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, 9 / Math.max(ED.zoom, 0.2) * 0.5 + 5, 0, Math.PI * 2); c.fill(); c.stroke(); }); c.restore(); }
    if (ED.draftShape) { // контур, що малюється
        c.save(); c.strokeStyle = '#f59e0b'; c.lineWidth = 4; c.setLineDash([12, 8]); c.beginPath();
        ED.draftShape.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        if (ED.mouse.in) c.lineTo(snap(ED.mouse.x, 25), snap(ED.mouse.y, 25)); c.stroke(); c.setLineDash([]);
        ED.draftShape.forEach((p, i) => { c.fillStyle = i === 0 ? '#22c55e' : '#f59e0b'; c.beginPath(); c.arc(p.x, p.y, i === 0 ? 14 : 8, 0, Math.PI * 2); c.fill(); });
        c.restore();
    }
}

let _lastT = performance.now();
function renderLoop() {
    const now = performance.now(), dt = Math.min(0.1, (now - _lastT) / 1000); _lastT = now;
    const S = ED.settings.size, time = now / 1000;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = ED.settings.bg; ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = ED.settings.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= S; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(S, i); ctx.stroke(); }

    // двері відкриваються, коли курсор поруч (щоб бачити, як вони працюватимуть)
    MapObj.updateDoors({ solids: ED.objects }, ED.mouse.in && ED.tool === 'select' ? [{ x: ED.mouse.x, y: ED.mouse.y, r: 24 }] : [], dt);

    const list = ED.objects.slice(), pv = (typeof previewObject === 'function') ? previewObject() : null;
    if (pv) list.push(pv);
    // шари: спершу вода/калюжі, потім решта (як у грі)
    list.forEach(o => { if (o.type.indexOf('water') >= 0 || o.type === 'prop_puddle' || o.type === 'prop_crater' || o.type === 'prop_pad' || o.type === 'prop_hatch') drawObject(ctx, o, time); });
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 12; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 9;
    list.forEach(o => { if (!(o.type.indexOf('water') >= 0 || o.type === 'prop_puddle' || o.type === 'prop_crater' || o.type === 'prop_pad' || o.type === 'prop_hatch' || o.type.indexOf('neon') >= 0 || o.type.indexOf('spawn') >= 0)) drawObject(ctx, o, time); });
    ctx.restore();
    list.forEach(o => { if (o.type.indexOf('neon') >= 0) drawObject(ctx, o, time); });
    list.forEach(o => { if (o.type.indexOf('spawn') >= 0) drawObject(ctx, o, time); });

    drawShapeOverlay(ctx);
    if (ED.selected && ED.objects.indexOf(ED.selected) >= 0) drawSelection(ctx, ED.selected, time);
    requestAnimationFrame(renderLoop);
}
