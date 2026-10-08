#!/usr/bin/env node
// Сканер покриття перекладів. Збирає українські літерали з клієнтських і серверних файлів
// (рядки '…', "…", `…`, конкатенації 'а' + x + 'б' та шаблони з ${…} → «шаблони з числами»),
// порівнює зі словниками public/js/lang/*.js (точний ключ або pattern із регуляркою) і друкує відсутні.
//   node tools/i18n_scan.js                 — стандартний набір файлів, всі мови
//   node tools/i18n_scan.js a.js b.js       — свій набір файлів
//   --lang=de,en   --weak (показати рядки, що тримаються лише на пословному fallback)   --json
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const LANGS = ['en', 'es', 'de', 'fr', 'pt', 'pl', 'tr'];
const DEFAULT_FILES = ['public/js/progress.js', 'public/js/profile.js', 'public/js/social.js', 'public/js/clans.js', 'public/js/menuhub.js',
    'public/js/lobby.js', 'public/js/uisfx.js', 'progress.js', 'profile.js', 'social.js', 'clans.js', 'bots.js'];
const CYR = /[А-ЯІЇЄҐа-яіїєґ]/;
const args = process.argv.slice(2);
const flag = n => args.find(a => a === '--' + n || a.startsWith('--' + n + '='));
const langs = flag('lang') ? flag('lang').split('=')[1].split(',') : LANGS;
let files = args.filter(a => !a.startsWith('--')); if (!files.length) files = DEFAULT_FILES;

// ---------- словники ----------
function loadDict(code) {
    const dict = {}, pats = [];
    const sandbox = { I18N: { add(c, map, p) { Object.assign(dict, map); (p || []).forEach(x => pats.push([new RegExp(x[0], 'g'), x[1]])); } }, window: {} };
    const file = path.join(ROOT, 'public/js/lang', code + '.js');
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: file });
    return { dict, pats };
}
const D = {}; ['en'].concat(langs.filter(l => l !== 'en')).forEach(l => D[l] = loadDict(l));
const realCache = {};
function fragT(code, s) {   // той самий алгоритм, що tr() у i18n.js, але з уже завантаженими словниками
    if (!realCache[code]) {
        const sb = { window: {}, document: { documentElement: null, body: null, addEventListener() {}, write() {}, getElementById() { return null; } }, navigator: { language: 'uk' }, localStorage: { getItem() { return 'uk'; }, setItem() {} }, MutationObserver: function () {}, NodeFilter: {} };
        sb.window = sb; sb.alert = function () {}; vm.createContext(sb);
        vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/i18n.js'), 'utf8'), sb);
        ['en', code].filter((v, i, a) => a.indexOf(v) === i).forEach(c => vm.runInContext(fs.readFileSync(path.join(ROOT, 'public/js/lang/' + c + '.js'), 'utf8'), sb));
        sb.I18N.setLanguage(code, { save: false }); realCache[code] = sb;
    }
    return realCache[code].I18N.t(s);
}

// ---------- токенізатор JS ----------
function tokenize(src) {
    const toks = []; let i = 0, line = 1; const n = src.length;
    const prevSig = () => toks.length ? toks[toks.length - 1] : null;
    function readTemplate(startLine) {   // повертає {parts:[str|{hole}], i}
        const parts = []; let cur = ''; i++;
        while (i < n && src[i] !== '`') {
            if (src[i] === '\\') { cur += src[i + 1] === 'n' ? '\n' : src[i + 1]; if (src[i + 1] === '\n') line++; i += 2; continue; }
            if (src[i] === '$' && src[i + 1] === '{') {
                parts.push(cur); cur = ''; i += 2; let depth = 1, st = i;
                while (i < n && depth) {
                    const c = src[i];
                    if (c === '{') depth++; else if (c === '}') depth--;
                    else if (c === '`') { const save = line; readTemplate(); line = save; continue; }
                    else if (c === '"' || c === "'") { const q = c; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') i++; i++; } }
                    else if (c === '\n') line++;
                    i++;
                }
                parts.push({ hole: src.slice(st, i - 1).trim() }); continue;
            }
            if (src[i] === '\n') line++;
            cur += src[i++];
        }
        i++; parts.push(cur); return parts;
    }
    while (i < n) {
        const c = src[i];
        if (c === '\n') { line++; i++; continue; }
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); const seg = src.slice(i, e < 0 ? n : e + 2); line += (seg.match(/\n/g) || []).length; i += seg.length; continue; }
        if (c === '"' || c === "'") {
            const q = c, ln = line; let s = ''; i++;
            while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { const x = src[i + 1]; s += x === 'n' ? '\n' : x === 't' ? '\t' : x === 'u' ? (() => { const h = src.substr(i + 2, 4); i += 4; return String.fromCharCode(parseInt(h, 16)); })() : x; i += 2; continue; } s += src[i++]; }
            i++; toks.push({ t: 'str', parts: [s], line: ln }); continue;
        }
        if (c === '`') { const ln = line; const parts = readTemplate(); toks.push({ t: 'str', parts, line: ln, tpl: true }); continue; }
        if (c === '/') {
            const p = prevSig();
            const isDiv = p && (p.t === 'id' || p.t === 'num' || p.t === 'str' || (p.t === 'p' && (p.v === ')' || p.v === ']' || p.v === '}')));
            if (!isDiv) {   // регулярка
                i++; let inCls = false; while (i < n && (src[i] !== '/' || inCls) && src[i] !== '\n') { if (src[i] === '\\') i++; else if (src[i] === '[') inCls = true; else if (src[i] === ']') inCls = false; i++; }
                i++; while (/[a-z]/.test(src[i] || '')) i++; toks.push({ t: 'num', v: 're', line }); continue;
            }
        }
        if (/[A-Za-z_$]/.test(c)) { let s = i; while (i < n && /[\w$]/.test(src[i])) i++; toks.push({ t: 'id', v: src.slice(s, i), line }); continue; }
        if (/[0-9]/.test(c)) { let s = i; while (i < n && /[\w.]/.test(src[i])) i++; toks.push({ t: 'num', v: src.slice(s, i), line }); continue; }
        toks.push({ t: 'p', v: c, line, pos: i }); i++;
    }
    return toks;
}

// ---------- збирання літералів (з конкатенаціями) ----------
const H = '\u0000';
const ex = sl => sl.map(x => x.t === 'str' ? "'" + x.parts.map(q => typeof q === 'string' ? q : '${' + q.hole + '}').join('') + "'" : (x.v || '?')).join('');
const isHtmlHole = e => /['"`]\s*<[a-zA-Z\/!]/.test(e);
const cmps = [];
function collect(src, file) {
    const toks = tokenize(src), lines = src.split('\n'), out = [];
    let k = 0; const used = new Set();
    while (k < toks.length) {
        const tk = toks[k];
        if (tk.t !== 'str' || used.has(k)) { k++; continue; }
        // ланцюжок: str (+ expr)* + str ...
        let text = '', holes = [], line = tk.line, j = k;
        const addStr = t => t.parts.forEach(p => { if (typeof p === 'string') text += p; else { if (isHtmlHole(p.hole)) text += '<x>'; else { text += H; holes.push(p.hole); } } });
        // ведучий операнд: x + 'текст' (дірка перед першим літералом)
        if (k >= 2 && toks[k - 1].t === 'p' && toks[k - 1].v === '+' && toks[k - 2].t !== 'str') {
            let m = k - 2, depth = 0;
            for (; m >= 0; m--) {
                const q = toks[m];
                if (q.t === 'p') {
                    if (')]}'.includes(q.v)) depth++;
                    else if ('([{'.includes(q.v)) { if (depth === 0) break; depth--; }
                    else if (depth === 0 && '+,;?:=&|!'.includes(q.v)) break;
                } else if (q.t === 'id' && depth === 0 && /^(return|case|typeof|in|of)$/.test(q.v)) break;
            }
            { const e = ex(toks.slice(m + 1, k - 1)); if (isHtmlHole(e)) text += '<x>'; else { text += H; holes.push(e); } }
        }
        addStr(tk);
        while (true) {
            if (!(toks[j + 1] && toks[j + 1].t === 'p' && toks[j + 1].v === '+')) break;
            // розібрати операнд після '+'
            let m = j + 2, depth = 0, hasStrAfter = false, opStart = m, found = -1;
            if (toks[m] && toks[m].t === 'str') { // наступний літерал
                // але якщо після нього йде * / . — це не конкатенація текст; приймаємо
                addStr(toks[m]); used.add(m); j = m; continue;
            }
            // вираз-дірка: іти до наступного '+' на глибині 0 або термінатора
            for (; m < toks.length; m++) {
                const q = toks[m];
                if (q.t === 'p') {
                    if ('([{'.includes(q.v)) depth++;
                    else if (')]}'.includes(q.v)) { if (depth === 0) break; depth--; }
                    else if (depth === 0 && (q.v === '+' || q.v === ',' || q.v === ';' || q.v === ':' || q.v === '?')) break;
                }
            }
            if (m < toks.length && toks[m].t === 'p' && toks[m].v === '+' && toks[m + 1] && toks[m + 1].t === 'str') {
                { const e = ex(toks.slice(opStart, m)); if (isHtmlHole(e)) text += '<x>'; else { text += H; holes.push(e); } } addStr(toks[m + 1]); used.add(m + 1); j = m + 1; continue;
            }
            if (m >= toks.length || toks[m].t === 'p') {   // хвостова дірка: 'текст' + x
                if (text.trim() && toks[m] && toks[m].v !== '+') { { const e = ex(toks.slice(opStart, m)); if (isHtmlHole(e)) text += '<x>'; else { text += H; holes.push(e); } } j = m - 1; }
            }
            break;
        }
        const kk = k; k++;
        if (!CYR.test(text)) continue;
        const pv = toks[kk - 1], pv2 = toks[kk - 2], nx = toks[kk + 1], nx2 = toks[kk + 2];
        const isP = (t, v) => t && t.t === 'p' && v.includes(t.v);
        if (isP(pv, '=') && isP(pv2, '=!') || (isP(nx, '=!') && isP(nx2, '='))) { cmps.push({ text: text.replace(/\u0000/g, '${}'), file, line }); continue; }   // порівняння тексту в коді — не для перекладу, але небезпечне
        if (isP(pv, '(') && pv2 && pv2.t === 'id' && pv2.v === 'Error') continue;                              // службові помилки розробника
        if (isP(nx, '.') && nx2 && nx2.t === 'id' && /^(split|indexOf|replace|test)$/.test(nx2.v)) continue;     // 'ТАВК'.split('') тощо
        if (isP(pv, '(') && pv2 && pv2.t === 'id' && /^(replace|replaceAll|indexOf|lastIndexOf|split|includes|startsWith|endsWith|test|exec|match|search)$/.test(pv2.v)) continue;   // службові рядки для операцій над укр. текстом
        const ln = lines[line - 1] || '';
        if (/console\.(log|warn|error|info)/.test(ln)) continue;
        if (/^\s*const\s+[A-Z_]+\s*=\s*\[\s*'[^']*'(\s*,\s*'[^']*')*\s*\]/.test(ln) && /bots\.js$/.test(file)) continue;   // списки імен ботів — власні імена, не інтерфейс
        for (const seg of segments(text, holes)) out.push({ text: seg.text, holes: seg.holes, file, line });
    }
    return out;
}
// розбиття HTML-літералу на текстові вузли + атрибути title/placeholder/alt/aria-label
function segments(text, holes) {
    const res = []; let hi = 0;
    const holeAt = (s) => { const hs = []; for (const ch of s) if (ch === H) hs.push(holes[hi++]); return hs; };
    // пройти по тексту, відділяючи теги
    const hasTag = /<[a-zA-Z\/!][^<>]*>/.test(text);
    if (!hasTag && /\b(?:title|placeholder|alt|aria-label)=["']/.test(text)) { const r2 = [], ar = /\b(?:title|placeholder|alt|aria-label)=(?:"([^"]*)"|'([^']*)')/g; let am, ix = 0; while ((am = ar.exec(text))) { const v = am[1] !== undefined ? am[1] : am[2]; if (CYR.test(v)) r2.push({ text: v.replace(/\s+/g, ' ').trim(), holes: v.split(H).slice(1).map(() => '?') }); } return r2; }
    if (!hasTag) { const t = text.trim(); const hs = []; let idx = 0; for (const ch of text) if (ch === H) hs.push(holes[idx++]); return CYR.test(t) ? [{ text: t.replace(/\s+/g, ' '), holes: hs }] : []; }
    const re = /<[^<>]*>/g; let last = 0, m, idx = 0; const take = s => { const hs = []; for (const ch of s) if (ch === H) hs.push(holes[idx++]); return hs; };
    const push = (s, hs) => { const t = s.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); if (CYR.test(t)) res.push({ text: t, holes: hs }); };
    while ((m = re.exec(text))) {
        const between = text.slice(last, m.index); push(between, take(between));
        const tagHoles = take(m[0]);
        const ar = /\b(?:title|placeholder|alt|aria-label)=("([^"]*)"|'([^']*)')/g; let am;
        while ((am = ar.exec(m[0]))) { const v = am[2] !== undefined ? am[2] : am[3]; push(v, v.split(H).slice(1).map(() => '?')); }
        last = m.index + m[0].length;
    }
    const tail = text.slice(last); push(tail, take(tail));
    return res;
}

// ---------- перевірка ----------
const numHole = e => /(^|[^\w])(n|num|count|cnt|cost|price|xp|lvl|level|reward|sec|secs|min|score|amount|total|max|left|need|have|step|goal|prog|val|value|kills|wins|bucks|pct|percent|rank|place|wave|days?|hours?)$/i.test(e.replace(/\(.*$/, '')) || /Math\.|\.length|\||\*|\bcr\b|toLocale|\bcount|Count|Cost|Amount|\+\s*\d|\d\s*[-+*/]|\.(cost|price|xp|need|goal|reward|max|min|len)\b|bucks/i.test(e);
function check(code, item) {
    const { dict, pats } = D[code];
    const s = item.text;
    if (s.indexOf(H) < 0) {
        if (dict[s] !== undefined) return 'ok';
        const f = fragT(code, s); if (!CYR.test(f)) return 'weak';
        return 'miss';
    }
    // тип дірки (число/текст) невідомий, тож пробуємо всі комбінації зразків: «7»/«25» для числа і «Bob»/«Zed9» для тексту
    const n = item.holes.length, combos = [];
    for (let mask = 0; mask < (1 << Math.min(n, 6)); mask++) combos.push(mask);
    const lit = item.holes.map(h => { const m = /'([^']{6,}?)'/.exec(h.replace(/\.(replace|split|indexOf)\([^)]*\)/g, '')); return m && /[А-ЯІЇЄҐа-яіїєґ]/.test(m[1]) && !/^\s|\s$/.test(m[1]) ? m[1] : null; });   // укр. літерал усередині дірки (умовний вираз) — підставляємо як є
    const fill = (mask, k) => { let i = 0; return s.replace(/\u0000/g, () => { const j = i++; if (lit[j]) return lit[j]; const isNum = (mask >> j) & 1; return isNum ? ['7', '25'][k] : ['Bob', 'Zed9'][k]; }); };
    const hasLit = lit.some(Boolean);
    const apply = v => { let r = v; for (const [re, rep] of pats) { re.lastIndex = 0; r = r.replace(re, rep); } return hasLit && CYR.test(r) ? fragT(code, v) : r; };
    let okAny = false, weakAny = false;
    for (const mask of combos) {
        let allOk = true, allWeak = true;
        for (const k of [0, 1]) {
            const v = fill(mask, k);
            if (CYR.test(apply(v))) { allOk = false; if (CYR.test(fragT(code, v))) allWeak = false; }
        }
        if (allOk) { okAny = true; break; }
        if (allWeak) weakAny = true;
    }
    if (okAny) return 'ok';
    return weakAny ? 'weak' : 'miss';
}

// ---------- запуск ----------
const items = []; const seen = new Map();
for (const f of files) {
    const p = path.isAbsolute(f) ? f : path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    collect(fs.readFileSync(p, 'utf8'), path.relative(ROOT, p)).forEach(it => {
        const key = it.text; if (seen.has(key)) { seen.get(key).where.push(it.file + ':' + it.line); return; }
        it.where = [it.file + ':' + it.line]; seen.set(key, it); items.push(it);
    });
}
const report = { total: items.length, byLang: {}, missing: [] };
const showWeak = !!flag('weak');
for (const it of items) {
    const bad = []; const weak = [];
    for (const l of langs) { const r = check(l, it); if (r === 'miss') bad.push(l); else if (r === 'weak') weak.push(l); }
    it.bad = bad; it.weak = weak;
}
for (const l of langs) report.byLang[l] = { missing: items.filter(i => i.bad.includes(l)).length, weak: items.filter(i => i.weak.includes(l)).length };
const missing = items.filter(i => i.bad.length), weak = items.filter(i => !i.bad.length && i.weak.length);
if (flag('json')) { console.log(JSON.stringify({ total: items.length, byLang: report.byLang, missing: missing.map(i => ({ text: i.text.replace(/\u0000/g, '${}'), holes: i.holes, where: i.where, langs: i.bad })) }, null, 1)); }
else {
    const show = (it, tag) => console.log(tag + ' ' + it.where[0] + (it.where.length > 1 ? ' (+' + (it.where.length - 1) + ')' : '') + '  ' + JSON.stringify(it.text.replace(/\u0000/g, '${}')) + (it.holes.length ? '  holes=' + JSON.stringify(it.holes) : '') + (it.bad.length < langs.length ? '  [' + it.bad.join(',') + ']' : ''));
    missing.forEach(i => show(i, 'MISSING'));
    if (showWeak) weak.forEach(i => show(i, 'WEAK   '));
    cmps.forEach(c => console.log('CMP     ' + c.file + ':' + c.line + '  порівняння з укр. текстом: ' + JSON.stringify(c.text)));
    console.log('\nскановано файлів: ' + files.length + ', унікальних укр. рядків: ' + items.length + ' (з них шаблони: ' + items.filter(i => i.holes.length).length + ')');
    console.log('відсутні: ' + missing.length + ' | лише на пословному fallback: ' + weak.length + (showWeak ? '' : ' (--weak щоб показати)'));
    console.log(langs.map(l => l + ': ' + report.byLang[l].missing + '/' + report.byLang[l].weak).join('  ') + '   (відсутні/слабкі)');
}
process.exit(missing.length ? 1 : 0);
