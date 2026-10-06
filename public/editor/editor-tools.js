/* editor-tools.js — мишка, малювання, вибір, міні-меню об'єкта (поворот) та гарячі клавіші */
let drag = null;

function eventPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
}
function hitTest(x, y) {
    for (let i = ED.objects.length - 1; i >= 0; i--) if (MapObj.pointInObject(ED.objects[i], x, y)) return ED.objects[i];
    return null;
}
const isRotatable = (o) => o && o.type !== 'tree' && o.type !== 'line' && o.type.indexOf('spawn') < 0;
const isRectLike = (o) => isRotatable(o);
const hasColor = (o) => o && (o.type === 'line' || o.type === 'wall_square' || o.type === 'wall' || o.type.indexOf('shape_') === 0 || o.type.indexOf('neon_') === 0);
const isDrawTool = (t) => t !== 'select' && t !== 'eraser' && t.indexOf('contour_') !== 0 && t.indexOf('spawn') !== 0;

// ---------- створення об'єкта за перетягуванням ----------
function buildObject(tool, x1, y1, x2, y2, clickOnly) {
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    let w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    if (MapObj.DOOR_BY_ID[tool]) {
        const d = MapObj.DOOR_BY_ID[tool];
        if (clickOnly) return { type: tool, x: x1, y: y1 + Math.round((GRID_SIZE - d.h) / 2), w: d.w, h: d.h };
        if (w >= h) return { type: tool, x: x, y: y1 - Math.round(d.h / 2), w: Math.max(w, GRID_SIZE), h: d.h };
        return { type: tool, x: x1 - Math.round(d.h / 2), y: y, w: d.h, h: Math.max(h, GRID_SIZE) };
    }
    if (tool === 'tree') return { type: 'tree', x: x1, y: y1, r: clickOnly ? 30 : Math.max(20, Math.round(Math.hypot(x2 - x1, y2 - y1))) };
    if (w === 0) w = GRID_SIZE; if (h === 0) h = GRID_SIZE;
    const o = { type: tool, x: x, y: y, w: w, h: h };
    if (tool.indexOf('prop_') !== 0 && tool.indexOf('water') < 0) o.color = ED.drawColor;
    return o;
}
function previewObject() {
    if (!drag || drag.mode !== 'draw' || !drag.moved) return null;
    const o = buildObject(ED.tool, drag.sx, drag.sy, drag.ex, drag.ey, false); o.preview = true; return o;
}

// ---------- мишка ----------
canvas.addEventListener('contextmenu', e => {
    e.preventDefault(); const p = eventPos(e), hit = hitTest(p.x, p.y);
    if (hit) { ED.selected = hit; openMenu(hit, e.clientX, e.clientY); }
});

canvas.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    closeMenu();
    const p = eventPos(e), sx = snap(p.x), sy = snap(p.y), hit = hitTest(p.x, p.y), tool = ED.tool;
    if (tool === 'contour_draw') { contourClick(snap(p.x, 25), snap(p.y, 25)); return; }
    if (tool === 'contour_edit') {
        if (!ED.shape) return;
        const thr = Math.max(18, 14 / ED.zoom);
        let vi = ED.shape.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) <= thr);
        if (vi < 0) { // клік по ребру — нова вершина
            for (let i = 0; i < ED.shape.length; i++) {
                const a = ED.shape[i], b = ED.shape[(i + 1) % ED.shape.length];
                if (MapObj.distToSeg(p.x, p.y, a.x, a.y, b.x, b.y) <= thr) { ED.shape.splice(i + 1, 0, { x: snap(p.x, 25), y: snap(p.y, 25) }); vi = i + 1; break; }
            }
        }
        if (vi >= 0) { ED.dragVertex = vi; drag = { mode: 'vertex', moved: false }; }
        return;
    }
    if (tool === 'eraser') { if (hit) { ED.objects.splice(ED.objects.indexOf(hit), 1); if (ED.selected === hit) ED.selected = null; HIST.commit(); } return; }
    if (tool === 'select') {
        ED.selected = hit;
        if (hit) { drag = { mode: 'move', obj: hit, raw: p, moved: false, orig: hit.type === 'line' ? hit.points.map(q => ({ x: q.x, y: q.y })) : { x: hit.x, y: hit.y }, cx: e.clientX, cy: e.clientY }; }
        return;
    }
    if (tool.indexOf('spawn') === 0) {
        if (!ED.objects.some(o => o.type === tool && o.x === sx && o.y === sy)) { ED.objects.push({ type: tool, x: sx, y: sy }); HIST.commit(); }
        return;
    }
    if (tool === 'shape_line') { drag = { mode: 'line', downHit: hit, moved: false, line: null, cx: e.clientX, cy: e.clientY, raw: p }; return; }
    drag = { mode: 'draw', sx: sx, sy: sy, ex: sx, ey: sy, downHit: hit, moved: false, cx: e.clientX, cy: e.clientY };
});

window.addEventListener('mousemove', e => {
    const p = eventPos(e), r = canvas.getBoundingClientRect();
    ED.mouse = { x: p.x, y: p.y, sx: snap(p.x), sy: snap(p.y), in: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom };
    if (!drag) return;
    if (drag.mode === 'vertex') {
        const S = ED.settings.size;
        ED.shape[ED.dragVertex] = { x: Math.max(0, Math.min(S, snap(p.x, 25))), y: Math.max(0, Math.min(S, snap(p.y, 25))) }; drag.moved = true;
    } else if (drag.mode === 'move') {
        const dx = snap(p.x - drag.raw.x), dy = snap(p.y - drag.raw.y);
        if (dx || dy) drag.moved = true;
        const o = drag.obj;
        if (o.type === 'line') o.points.forEach((q, i) => { q.x = drag.orig[i].x + dx; q.y = drag.orig[i].y + dy; });
        else { o.x = drag.orig.x + dx; o.y = drag.orig.y + dy; }
    } else if (drag.mode === 'draw') {
        drag.ex = snap(p.x); drag.ey = snap(p.y); if (drag.ex !== drag.sx || drag.ey !== drag.sy) drag.moved = true;
    } else if (drag.mode === 'line') {
        if (!drag.line && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > 5) {
            drag.line = { type: 'line', points: [{ x: drag.raw.x, y: drag.raw.y }], color: ED.drawColor, width: ED.drawWidth }; ED.objects.push(drag.line); drag.moved = true;
        }
        if (drag.line) drag.line.points.push({ x: p.x, y: p.y });
    }
});

window.addEventListener('mouseup', e => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'vertex') { ED.dragVertex = -1; HIST.commit(); return; }
    if (d.mode === 'move') { if (d.moved) HIST.commit(); else if (d.obj) openMenu(d.obj, e.clientX, e.clientY); return; }
    if (d.mode === 'line') {
        if (d.line) { d.line.points = d.line.points.map(q => ({ x: Math.round(q.x), y: Math.round(q.y) })); HIST.commit(); }
        else if (d.downHit) { ED.selected = d.downHit; openMenu(d.downHit, e.clientX, e.clientY); }
        return;
    }
    if (d.mode === 'draw') {
        if (!d.moved) { // простий клік
            if (d.downHit) { ED.selected = d.downHit; openMenu(d.downHit, e.clientX, e.clientY); return; }
            ED.objects.push(buildObject(ED.tool, d.sx, d.sy, d.sx, d.sy, true)); HIST.commit(); return;
        }
        ED.objects.push(buildObject(ED.tool, d.sx, d.sy, d.ex, d.ey, false)); HIST.commit();
    }
});

canvas.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(ED.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });

// ---------- фігурний контур ----------
function contourClick(x, y) {
    if (!ED.draftShape) ED.draftShape = [];
    const d = ED.draftShape;
    if (d.length >= 3 && Math.hypot(d[0].x - x, d[0].y - y) <= Math.max(30, 20 / ED.zoom)) { finishContour(); return; }
    d.push({ x: x, y: y });
}
function finishContour() {
    const d = ED.draftShape; ED.draftShape = null;
    if (d && d.length >= 3) { ED.shape = d; HIST.commit(); setTool('contour_edit'); setStatus('Контур створено (' + d.length + ' вершин). Перетягуйте вершини, клік по ребру додає нову.', 'ok'); }
    else setStatus('Для контуру потрібно мінімум 3 точки', 'err');
    if (typeof refreshContourPanel === 'function') refreshContourPanel();
}

// ---------- міні-меню об'єкта ----------
const menuEl = document.getElementById('obj-menu');
function closeMenu() { menuEl.classList.add('hidden'); }
function openMenu(o, cx, cy) {
    ED.selected = o;
    const rot = isRotatable(o);
    let h = `<div class="m-title"><span>${NAMES[o.type] || o.type}</span><span style="color:#64748b;font-size:10px">${rot ? Math.round(o.rot || 0) + '°' : ''}</span></div>`;
    if (rot) {
        h += `<div class="m-row"><label>Поворот</label><button data-a="rot" data-v="-90">⟲ 90</button><button data-a="rot" data-v="-15">⟲ 15</button><button data-a="rot" data-v="15">15 ⟳</button><button data-a="rot" data-v="90">90 ⟳</button></div>`;
        h += `<div class="m-row"><label>Кут °</label><input type="number" id="m-rot" value="${Math.round(o.rot || 0)}" step="5"><button data-a="setrot" style="flex:0 0 36px">OK</button></div>`;
    }
    if (isRectLike(o)) h += `<div class="m-row"><label>Ш × В</label><input type="number" id="m-w" value="${o.w || 30}" step="10" min="10"><input type="number" id="m-h" value="${o.h || 30}" step="10" min="10"></div>`;
    if (o.type === 'tree') h += `<div class="m-row"><label>Радіус</label><input type="number" id="m-r" value="${o.r || 30}" step="5" min="10"></div>`;
    if (hasColor(o)) h += `<div class="m-row"><label>Колір</label><input type="color" id="m-color" value="${o.color || '#3b82f6'}"></div>`;
    if (MapObj.isDoor(o)) h += `<div class="hint" style="margin:0 0 6px">Авто-двері: відкриваються, коли поруч танк.</div>`;
    h += `<div class="m-row"><button data-a="dup">⧉ Дублювати</button><button data-a="del" class="danger">🗑 Видалити</button><button data-a="close" style="flex:0 0 30px">✖</button></div>`;
    menuEl.innerHTML = h; menuEl.classList.remove('hidden');
    const mw = 232, mh = menuEl.offsetHeight || 200;
    menuEl.style.left = Math.max(8, Math.min(cx + 14, window.innerWidth - mw - 8)) + 'px';
    menuEl.style.top = Math.max(8, Math.min(cy + 14, window.innerHeight - mh - 8)) + 'px';
}
function setRot(o, deg) { deg = ((Math.round(deg) % 360) + 360) % 360; if (deg) o.rot = deg; else delete o.rot; }
function deleteSelected() { if (!ED.selected) return; const i = ED.objects.indexOf(ED.selected); if (i >= 0) { ED.objects.splice(i, 1); ED.selected = null; closeMenu(); HIST.commit(); } }
function duplicateSelected() {
    const o = ED.selected; if (!o) return; const c = clone(o); delete c._open;
    if (c.type === 'line') c.points.forEach(p => { p.x += GRID_SIZE; p.y += GRID_SIZE; }); else { c.x += GRID_SIZE; c.y += GRID_SIZE; }
    ED.objects.push(c); ED.selected = c; HIST.commit();
}
function rotateSelected(delta) { const o = ED.selected; if (!isRotatable(o)) return; setRot(o, (o.rot || 0) + delta); HIST.commit(); }

menuEl.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const o = ED.selected; if (!o) return;
    const a = b.dataset.a;
    if (a === 'rot') { rotateSelected(parseFloat(b.dataset.v)); openMenu(o, parseFloat(menuEl.style.left) - 14, parseFloat(menuEl.style.top) - 14); }
    else if (a === 'setrot') { setRot(o, parseFloat(document.getElementById('m-rot').value) || 0); HIST.commit(); }
    else if (a === 'dup') { duplicateSelected(); closeMenu(); }
    else if (a === 'del') deleteSelected();
    else if (a === 'close') closeMenu();
});
menuEl.addEventListener('change', e => {
    const o = ED.selected; if (!o) return; const id = e.target.id;
    if (id === 'm-rot') setRot(o, parseFloat(e.target.value) || 0);
    else if (id === 'm-w') o.w = Math.max(10, parseInt(e.target.value) || 10);
    else if (id === 'm-h') o.h = Math.max(10, parseInt(e.target.value) || 10);
    else if (id === 'm-r') o.r = Math.max(10, parseInt(e.target.value) || 10);
    else if (id === 'm-color') o.color = e.target.value;
    else return;
    HIST.commit();
});
menuEl.addEventListener('input', e => { const o = ED.selected; if (o && e.target.id === 'm-color') o.color = e.target.value; });
menuEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'm-rot') { const o = ED.selected; setRot(o, parseFloat(e.target.value) || 0); HIST.commit(); } });

// ---------- гарячі клавіші ----------
window.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (!EAPI.isLoggedIn()) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.key;
    if (ctrl && (k === 'z' || k === 'Z' || k === 'я' || k === 'Я') && !e.shiftKey) { if (typing && tag !== 'select' && e.target.type !== 'color' && e.target.type !== 'range') return; e.preventDefault(); doUndo(); return; }
    if (ctrl && (k === 'y' || k === 'Y' || ((k === 'z' || k === 'Z') && e.shiftKey))) { if (typing && e.target.type === 'text') return; e.preventDefault(); doRedo(); return; }
    if (ctrl && (k === 's' || k === 'S')) { e.preventDefault(); if (typeof saveToServer === 'function') saveToServer(); return; }
    if (ctrl && (k === 'd' || k === 'D')) { e.preventDefault(); duplicateSelected(); return; }
    if (k === 'Escape') { closeMenu(); if (ED.draftShape) { ED.draftShape = null; setStatus('Малювання контуру скасовано'); } else { ED.selected = null; } return; }
    if (typing || ctrl || e.altKey) return;
    if (/^[0-9]$/.test(k)) { const idx = k === '0' ? 9 : parseInt(k) - 1; if (idx < TABS.length) { switchTab(idx); e.preventDefault(); } return; }
    if (k === 'Delete' || k === 'Backspace') { if (ED.selected) { e.preventDefault(); deleteSelected(); } else if (ED.tool === 'contour_edit' && ED.shape && ED.dragVertex >= 0) { } return; }
    const low = k.toLowerCase();
    if (low === 'r' || low === 'к') { if (ED.selected && isRotatable(ED.selected)) { rotateSelected(e.shiftKey ? -15 : 15); e.preventDefault(); } return; }
    if (low === 'v' || low === 'м') { setTool('select'); return; }
    if (low === 'e' || low === 'у') { setTool('eraser'); return; }
    if (low === 'f' || low === 'а') { fitZoom(); return; }
    if (k === '+' || k === '=') { setZoom(ED.zoom * 1.2); return; }
    if (k === '-' || k === '_') { setZoom(ED.zoom / 1.2); return; }
    if (k === 'Enter' && ED.draftShape) { finishContour(); return; }
    if (k.indexOf('Arrow') === 0 && ED.selected) {
        const st = e.shiftKey ? 10 : GRID_SIZE, o = ED.selected, dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
        if (o.type === 'line') o.points.forEach(p => { p.x += dx; p.y += dy; }); else { o.x += dx; o.y += dy; }
        HIST.commit(); e.preventDefault();
    }
});
function doUndo() { closeMenu(); if (HIST.undo()) setStatus('↶ Відмінено', 'ok'); else setStatus('Немає що відміняти'); updateTopbar(); }
function doRedo() { closeMenu(); if (HIST.redo()) setStatus('↷ Повернуто', 'ok'); else setStatus('Немає що повертати'); updateTopbar(); }
