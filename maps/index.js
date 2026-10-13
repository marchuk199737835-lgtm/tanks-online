/* maps/index.js — вбудовані мапи гри: кожна мапа — окремий JSON у цій папці (раніше все лежало одним файлом maps_modes.js на 650 КБ).
 * Назва мапи = поле title (або key, якщо назва відрізняється від заголовка). Файл: назва з пробілами → «_», напр. Iron_Bastion.json.
 * Порядок мап (від нього залежить порядок кнопок у меню) — _order.json.
 *   readAll()      → { [назва]: мапа }   — читає сервер при старті й інструменти tools/*.js
 *   writeAll(maps) → записує всі мапи (файли зниклих мап видаляються) — для генераторів tools/genmaps*.js, genhide.js, phgrid.js, retrofit_destr.js
 * Мапи з редактора (/editor.html) зберігаються в MongoDB і накладаються поверх цих. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = __dirname, ORDER = path.join(DIR, '_order.json');
const fileOf = name => String(name).replace(/[^A-Za-z0-9_-]/g, '_') + '.json';

function readAll() {
    const found = {};
    fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== '_order.json').sort().forEach(f => {
        try {
            const m = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'));
            const name = m.key || m.title || f.slice(0, -5); delete m.key;
            found[name] = m;
        } catch (e) { console.warn('maps/' + f + ':', e.message); }
    });
    let order = []; try { order = JSON.parse(fs.readFileSync(ORDER, 'utf8')); } catch (e) {}
    const out = {};
    (Array.isArray(order) ? order : []).forEach(n => { if (found[n]) out[n] = found[n]; });
    Object.keys(found).forEach(n => { if (!out[n]) out[n] = found[n]; });      // нові мапи без запису в _order.json — у кінці
    return out;
}
function writeAll(maps) {
    const keep = new Set(['_order.json']);
    Object.keys(maps).forEach(name => {
        const f = fileOf(name), m = Object.assign({}, maps[name]);
        if (m.title !== name) m.key = name;
        if (keep.has(f)) throw new Error('Дві мапи з однаковим файлом: ' + f);
        keep.add(f); fs.writeFileSync(path.join(DIR, f), JSON.stringify(m) + '\n');
    });
    fs.writeFileSync(ORDER, JSON.stringify(Object.keys(maps), null, 1) + '\n');
    fs.readdirSync(DIR).filter(f => f.endsWith('.json') && !keep.has(f)).forEach(f => fs.unlinkSync(path.join(DIR, f)));
}
module.exports = { readAll, writeAll, DIR };
