/* editor-app.js — запуск редактора: вхід, вкладки, панелі, збереження на сервер, експорт */
const $ = (id) => document.getElementById(id);
const tabsContainer = $('tabs-container'), toolsContainer = $('tools-container');
let curTab = 0;

function setStatus(msg, kind) { const s = $('status-line'); s.textContent = msg; s.className = kind || ''; }
function updateTopbar() {
    $('tb-undo').disabled = !HIST.canUndo(); $('tb-redo').disabled = !HIST.canRedo();
    $('tb-select').classList.toggle('active', ED.tool === 'select'); $('tb-eraser').classList.toggle('active', ED.tool === 'eraser');
    $('tb-zoom-val').innerText = Math.round(ED.zoom * 100) + '%';
}
function setZoom(z) { ED.zoom = Math.max(0.1, Math.min(2, z)); applyZoom(); updateTopbar(); }
function fitZoom() { const w = $('canvas-wrapper'); setZoom(Math.min((w.clientWidth - 40) / ED.settings.size, (w.clientHeight - 120) / ED.settings.size, 1)); }

function setTool(id) {
    if (ED.tool === 'contour_draw' && id !== 'contour_draw') ED.draftShape = null;
    ED.tool = id; if (id !== 'select') { /* вибір лишається видимим */ }
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.toggle('active', b.dataset.type === id));
    canvas.style.cursor = id === 'select' ? 'default' : id === 'eraser' ? 'not-allowed' : 'crosshair';
    updateTopbar();
}

function switchTab(i) {
    curTab = i; closeMenu();
    document.querySelectorAll('.tab-btn').forEach((b, k) => b.classList.toggle('active', k === i));
    document.querySelectorAll('.tab-content').forEach((c, k) => { c.classList.toggle('hidden', k !== i); });
    const id = TABS[i].id;
    if (id === 'settings') setTool('select');
    else if (id === 'contour') setTool(ED.shape ? 'contour_edit' : 'contour_draw');
    else { const first = TOOLS[id].find(t => t.id && t.id !== 'eraser'); if (first) setTool(first.id); }
    if (id === 'contour') refreshContourPanel();
}

// ---------- побудова бічної панелі ----------
function buildSidebar() {
    TABS.forEach((tab, index) => {
        tabsContainer.insertAdjacentHTML('beforeend', `<button class="tab-btn flex-1 pb-2 px-2 text-[10px] font-bold uppercase whitespace-nowrap text-slate-400" data-idx="${index}"><span class="tab-key">${tabKey(index)}</span>${tab.name}</button>`);
        let html = `<div class="tab-content hidden space-y-2" data-tab="${tab.id}">`;
        TOOLS[tab.id].forEach(tool => {
            if (tool.type === 'html') html += tool.html;
            else if (tool.type === 'custom') html += `<div id="panel-${tool.render}"></div>`;
            else { const cls = tool.id === 'eraser' ? 'border-red-500/50 hover:bg-red-500/20 text-red-400' : 'bg-slate-800 text-white'; html += `<button class="tool-btn w-full p-2 rounded-lg text-left font-bold text-xs ${cls}" data-type="${tool.id}">${tool.name}</button>`; }
        });
        toolsContainer.insertAdjacentHTML('beforeend', html + '</div>');
    });
    document.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => switchTab(parseInt(b.dataset.idx)));
    document.querySelectorAll('.tool-btn').forEach(b => b.onclick = () => setTool(b.dataset.type));
    const sc = $('shape-color'); if (sc) sc.oninput = e => { ED.drawColor = e.target.value; };
    const lw = $('line-width'); if (lw) lw.oninput = e => { ED.drawWidth = parseInt(e.target.value); };
    buildSettingsPanel(); buildContourPanel();
}

// ---------- вкладка «Налаштування» ----------
function buildSettingsPanel() {
    $('panel-settings').innerHTML = `
        <label class="side-label">Мапи на сервері</label>
        <select id="map-select" class="side-input"></select>
        <div id="maps-info"></div>
        <div class="flex gap-2"><button class="side-btn" id="map-load">📂 Відкрити</button><button class="side-btn" id="map-new">➕ Нова мапа</button></div>
        <button class="side-btn red" id="map-delete">🗑 Видалити / скинути до стандартної</button>
        <hr class="border-slate-700 my-3">
        <label class="side-label">Назва (ключ мапи)</label><input type="text" id="set-name" class="side-input" maxlength="32">
        <label class="side-label">Назва в меню (необов'язково)</label><input type="text" id="set-title" class="side-input" maxlength="40" placeholder="напр. Місячна база">
        <label class="side-label">Режими, де доступна мапа</label>
        <div id="set-modes" class="mb-3">
            <label class="mode-row"><input type="checkbox" data-mode="deathmatch"> ⚔️ Детматч</label>
            <label class="mode-row"><input type="checkbox" data-mode="team_deathmatch"> 🤝 Командний</label>
            <label class="mode-row"><input type="checkbox" data-mode="survival"> 🧟 Виживання</label>
            <label class="mode-row"><input type="checkbox" data-mode="prophunt"> 📦 Хованки</label>
            <label class="mode-row"><input type="checkbox" data-mode="base_defense"> 🏰 Оборона бази</label>
            <label class="mode-row"><input type="checkbox" data-mode="boss_raid"> 👹 Рейд на боса</label>
            <label class="mode-row"><input type="checkbox" data-mode="convoy"> 🚚 Конвой</label>
            <label class="mode-row"><input type="checkbox" data-mode="solo_arena"> 🌀 Арена хвиль (соло)</label>
            <label class="mode-row"><input type="checkbox" data-mode="boss_duel"> 💀 Дуель з босами (соло)</label>
            <label class="mode-row"><input type="checkbox" data-mode="battle_royale"> 🔥 Королівський бій</label>
            <label class="mode-row"><input type="checkbox" data-mode="capture_points"> 🚩 Захоплення точок</label>
            <label class="mode-row"><input type="checkbox" data-mode="bounty"> 🎯 Полювання за головою</label>
        </div>
        <label class="side-label">Розмір (квадрат, px)</label><input type="number" id="set-size" class="side-input" min="1000" max="8000" step="500">
        <label class="side-label">Текстура землі (стиль)</label>
        <select id="set-theme" class="side-input">
            <option value="">— плоска (стара) —</option><option value="grass">🌿 Трава</option><option value="sand">🏜 Пісок</option><option value="snow">❄️ Сніг</option><option value="stone">🏛 Кам'яні плити</option>
            <option value="asphalt">🛣 Асфальт</option><option value="metal">⚙️ Метал</option><option value="dirt">🟤 Ґрунт</option><option value="swamp">🐸 Болото</option><option value="lava">🌋 Лава / вулкан</option><option value="tech">🔷 Техно</option>
        </select>
        <label class="side-label">Підлога (основний колір)</label><input type="color" id="set-bg" class="w-full h-8 mb-3 bg-transparent cursor-pointer">
        <label class="side-label">Сітка</label><input type="color" id="set-grid" class="w-full h-8 mb-3 bg-transparent cursor-pointer">
        <p class="hint">Зміни, збережені на сервер, побачать гравці <b>після перезапуску сервера</b> (Redeploy / Restart у Coolify).</p>
        <p class="hint"><span class="kbd">1</span>–<span class="kbd">0</span> вкладки · <span class="kbd">V</span> вибір · <span class="kbd">E</span> гумка · <span class="kbd">R</span> поворот · <span class="kbd">Del</span> видалити · <span class="kbd">Ctrl+Z</span>/<span class="kbd">Ctrl+Y</span> · <span class="kbd">Ctrl+S</span> зберегти · <span class="kbd">Ctrl+D</span> дублювати · стрілки — зсув. Клік по об'єкту відкриває меню повороту.</p>`;
    $('set-name').oninput = e => { ED.settings.name = e.target.value; };
    $('set-name').onchange = () => HIST.commit();
    $('set-title').oninput = e => { ED.settings.title = e.target.value; };
    $('set-title').onchange = () => HIST.commit();
    document.querySelectorAll('#set-modes input').forEach(cb => cb.onchange = () => {
        const sel = [...document.querySelectorAll('#set-modes input:checked')].map(x => x.dataset.mode);
        if (!sel.length) { cb.checked = true; return setStatus('Потрібен хоча б один режим', 'err'); }
        ED.settings.modes = sel; HIST.commit();
    });
    $('set-size').onchange = e => { ED.settings.size = Math.max(1000, Math.min(8000, parseInt(e.target.value) || 3000)); applyZoom(); HIST.commit(); };
    $('set-theme').onchange = e => { ED.settings.theme = e.target.value; HIST.commit(); };
    $('set-bg').oninput = e => { ED.settings.bg = e.target.value; }; $('set-bg').onchange = () => HIST.commit();
    $('set-grid').oninput = e => { ED.settings.grid = e.target.value; }; $('set-grid').onchange = () => HIST.commit();
    $('map-load').onclick = () => { const n = $('map-select').value; if (n) loadMapByName(n); };
    $('map-new').onclick = newMap;
    $('map-delete').onclick = deleteMapFromServer;
    $('map-select').onchange = refreshMapsInfo;
}
function syncSettingsInputs() {
    $('set-name').value = ED.settings.name; $('set-title').value = ED.settings.title || ''; $('set-size').value = ED.settings.size;
    document.querySelectorAll('#set-modes input').forEach(cb => { cb.checked = (ED.settings.modes || []).indexOf(cb.dataset.mode) >= 0; });
    $('set-theme').value = ED.settings.theme || '';
    $('set-bg').value = ED.settings.bg; $('set-grid').value = ED.settings.grid;
}
function refreshMapsInfo() {
    const n = $('map-select').value, i = ED.serverInfo[n]; if (!i) { $('maps-info').textContent = ''; return; }
    $('maps-info').textContent = (i.builtin ? (i.hidden ? 'Вбудована (прихована в грі — шаблон)' : 'Вбудована') : 'Власна') + (i.saved ? ' · змінена в редакторі' : '') + (i.pending ? ' · ⏳ чекає перезапуску сервера' : ' · застосована');
}
function fillMapSelect(selectName) {
    const sel = $('map-select'); sel.innerHTML = '';
    Object.keys(ED.serverMaps).forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n + (ED.serverInfo[n] && ED.serverInfo[n].pending ? '  ⏳' : ''); sel.appendChild(o); });
    if (selectName && ED.serverMaps[selectName]) sel.value = selectName; refreshMapsInfo();
}
async function reloadServerMaps(selectName) {
    const d = await EAPI.listMaps(); ED.serverMaps = d.maps; ED.serverInfo = d.info; fillMapSelect(selectName);
}

// ---------- вкладка «Контур» ----------
function buildContourPanel() {
    $('panel-contour').innerHTML = `
        <p class="hint">Зробіть мапу будь-якої форми. Поза контуром — порожнеча: ні танки, ні кулі туди не потраплять. Без контуру мапа — звичайний квадрат.</p>
        <div id="contour-state" class="side-label" style="color:#38bdf8"></div>
        <button class="tool-btn side-btn" data-type="contour_draw">✏️ Малювати контур точками</button>
        <button class="tool-btn side-btn" data-type="contour_edit">🖐 Редагувати вершини</button>
        <p class="hint">Малювання: клік — нова точка, клік по зеленій першій точці (або <span class="kbd">Enter</span>) — замкнути, <span class="kbd">Esc</span> — скасувати. Редагування: перетягуйте вершини, клік по ребру додає вершину, правий клік по вершині видаляє її.</p>
        <label class="side-label">Готові форми</label>
        <div class="grid grid-cols-2 gap-2">
            <button class="side-btn" data-preset="hexagon">⬡ Шестикутник</button><button class="side-btn" data-preset="circle">⚪ Коло</button>
            <button class="side-btn" data-preset="diamond">◆ Ромб</button><button class="side-btn" data-preset="star">★ Зірка</button>
            <button class="side-btn" data-preset="cross">✚ Хрест</button><button class="side-btn" data-preset="lshape">▙ L-форма</button>
            <button class="side-btn" data-preset="island">🏝 Острів</button><button class="side-btn red" id="contour-clear">▢ Прямокутна</button>
        </div>`;
    $('panel-contour').querySelectorAll('[data-type]').forEach(b => b.onclick = () => setTool(b.dataset.type));
    $('panel-contour').querySelectorAll('[data-preset]').forEach(b => b.onclick = () => { ED.shape = shapePreset(b.dataset.preset, ED.settings.size); ED.draftShape = null; HIST.commit(); setTool('contour_edit'); refreshContourPanel(); setStatus('Контур застосовано. Розставте спавни всередині!', 'ok'); });
    $('contour-clear').onclick = () => { ED.shape = null; ED.draftShape = null; HIST.commit(); setTool('contour_draw'); refreshContourPanel(); setStatus('Контур прибрано — мапа прямокутна'); };
}
function refreshContourPanel() { const s = $('contour-state'); if (s) s.textContent = ED.shape ? ('Фігурна мапа: ' + ED.shape.length + ' вершин') : 'Мапа прямокутна (без контуру)'; }
// правий клік по вершині — видалити
canvas.addEventListener('contextmenu', e => {
    if (ED.tool !== 'contour_edit' || !ED.shape) return;
    const p = eventPos(e), thr = Math.max(18, 14 / ED.zoom), i = ED.shape.findIndex(v => Math.hypot(v.x - p.x, v.y - p.y) <= thr);
    if (i >= 0) { if (ED.shape.length > 3) { ED.shape.splice(i, 1); HIST.commit(); refreshContourPanel(); } else setStatus('Мінімум 3 вершини', 'err'); }
});

// ---------- завантаження / нова мапа ----------
function onHistoryRestored() { applyZoom(); syncSettingsInputs(); refreshContourPanel(); closeMenu(); updateTopbar(); }
function loadMapIntoEditor(name, m) {
    ED.settings = { name: name, title: m.title || '', modes: (m.modes && m.modes.length) ? m.modes.slice() : MapObj.MODES.slice(), size: m.size, bg: m.bg || '#020617', grid: m.grid || '#1e293b', theme: m.theme || '' };
    ED.objects = clone(m.solids).map(o => { if (o.type === 'shape_line') o.type = 'line'; delete o._open; return o; });
    ED.shape = m.shape && m.shape.length >= 3 ? clone(m.shape) : null; ED.selected = null; ED.draftShape = null;
    HIST.reset(); ED.dirty = false; applyZoom(); syncSettingsInputs(); refreshContourPanel(); fitZoom();
}
function loadMapByName(n) {
    if (ED.dirty && !confirm('Є незбережені зміни. Відкрити іншу мапу без збереження?')) return;
    loadMapIntoEditor(n, ED.serverMaps[n]); setStatus('Відкрито мапу «' + n + '» (' + ED.objects.length + ' об.)', 'ok');
}
function newMap() {
    if (ED.dirty && !confirm('Є незбережені зміни. Створити нову мапу без збереження?')) return;
    loadMapIntoEditor('нова_мапа', { size: 3000, bg: '#020617', grid: '#1e293b', solids: [{ type: 'spawn_player', x: 1500, y: 1500 }] }); ED.dirty = true;
    setStatus('Нова мапа. Задайте назву й додайте спавни.', 'ok');
}

// ---------- збереження на сервер ----------
function currentMapData() {
    const m = { size: ED.settings.size, bg: ED.settings.bg, grid: ED.settings.grid, solids: clone(ED.objects).map(o => { delete o._open; delete o.preview; return o; }) };
    if (ED.settings.theme) m.theme = ED.settings.theme;
    if (ED.settings.title && ED.settings.title.trim()) m.title = ED.settings.title.trim();
    if (ED.shape && ED.shape.length >= 3) m.shape = clone(ED.shape);
    if (ED.settings.modes && ED.settings.modes.length && ED.settings.modes.length < MapObj.MODES.length) m.modes = ED.settings.modes.slice();
    return m;
}
async function saveToServer() {
    const name = (ED.settings.name || '').trim();
    if (!/^[\p{L}\p{N} _\-]{1,32}$/u.test(name)) return setStatus('Назва мапи: літери, цифри, пробіл, _ та -, до 32 символів', 'err');
    if (!ED.objects.some(o => o.type === 'spawn_player')) return setStatus('Додайте хоча б один «Спавн: Гравець» (вкладка 9)', 'err');
    if (ED.shape && ED.shape.length >= 3) {
        const ins = ED.objects.filter(o => o.type === 'spawn_player' && MapObj.circleInPoly(ED.shape, o.x, o.y, 30)).length;
        if (!ins) return setStatus('Усі «Спавн: Гравець» поза контуром (червоні X). Перемістіть їх всередину', 'err');
    }
    if (ED.serverInfo[name] && !ED.serverInfo[name].saved && ED.serverInfo[name].builtin && !confirm('«' + name + '» — вбудована мапа. Зберегти ваші зміни замість неї?')) return;
    try {
        setStatus('Збереження…');
        const r = await EAPI.saveMap(name, currentMapData());
        ED.dirty = false; await reloadServerMaps(name);
        setStatus('✅ Збережено «' + name + '» (' + r.objects + ' об.). Гравці побачать після перезапуску сервера.', 'ok');
    } catch (e) { setStatus('❌ ' + e.message, 'err'); }
}
async function deleteMapFromServer() {
    const n = $('map-select').value; if (!n) return; const i = ED.serverInfo[n] || {};
    if (!i.saved) return setStatus(i.builtin ? 'Це вбудована мапа без змін — нічого скидати' : 'Мапа не збережена на сервері', 'err');
    if (!confirm(i.builtin ? 'Скинути «' + n + '» до стандартної версії?' : 'Видалити мапу «' + n + '» з сервера?')) return;
    try { await EAPI.deleteMap(n); await reloadServerMaps(i.builtin ? n : null); setStatus('Готово. Змінилось після перезапуску сервера.', 'ok'); } catch (e) { setStatus('❌ ' + e.message, 'err'); }
}

// ---------- експорт коду ----------
function exportCode() {
    const m = currentMapData();
    let code = `MAP_DATA['${ED.settings.name}'] = {\n    size: ${m.size},\n    bg: '${m.bg}',\n    grid: '${m.grid}',\n`;
    if (m.shape) code += `    shape: ${JSON.stringify(m.shape)},\n`;
    code += `    solids: [\n`; m.solids.forEach(o => { code += `        ${JSON.stringify(o)},\n`; }); code += `    ]\n};\n`;
    $('export-textarea').value = code; $('export-modal').classList.remove('hidden');
}

// ---------- запуск ----------
function bindTopbar() {
    $('tb-select').onclick = () => setTool('select'); $('tb-eraser').onclick = () => setTool('eraser');
    $('tb-undo').onclick = doUndo; $('tb-redo').onclick = doRedo;
    $('tb-zoom-in').onclick = () => setZoom(ED.zoom * 1.2); $('tb-zoom-out').onclick = () => setZoom(ED.zoom / 1.2); $('tb-fit').onclick = fitZoom;
    $('save-btn').onclick = saveToServer; $('export-btn').onclick = exportCode;
    $('export-close').onclick = () => $('export-modal').classList.add('hidden');
    $('export-copy').onclick = () => { const ta = $('export-textarea'); ta.select(); document.execCommand('copy'); setStatus('Код скопійовано', 'ok'); };
    $('clear-btn').onclick = () => { if (confirm('Видалити всі об\'єкти (контур лишається)?')) { ED.objects = []; ED.selected = null; HIST.commit(); } };
}
async function startEditor() {
    buildSidebar(); bindTopbar();
    try {
        await reloadServerMaps();
        const first = ED.serverMaps['epic_map'] ? 'epic_map' : Object.keys(ED.serverMaps)[0];
        if (first) { loadMapIntoEditor(first, ED.serverMaps[first]); fillMapSelect(first); }
    } catch (e) { setStatus('❌ ' + e.message, 'err'); newMap(); }
    switchTab(0); applyZoom(); fitZoom(); updateTopbar(); renderLoop();
    window.addEventListener('beforeunload', ev => { if (ED.dirty) { ev.preventDefault(); ev.returnValue = ''; } });
}

async function doLogin() {
    const pw = $('login-pass').value; $('login-err').textContent = '';
    try { await EAPI.login(pw); $('login-overlay').remove(); await startEditor(); }
    catch (e) { $('login-err').textContent = e.message; $('login-pass').value = ''; $('login-pass').focus(); }
}
$('login-btn').onclick = doLogin;
$('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
$('login-pass').focus();
