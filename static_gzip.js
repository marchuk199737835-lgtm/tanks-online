/* static_gzip.js — роздача статики без етапу збірки: brotli/gzip, ETag/304, правильний кеш, версіонування URL у index.html.
 *
 * Підключення в server.js (один рядок замість express.static):
 *     require('./static_gzip.js')(app, express, { publicDir: path.join(__dirname, 'public') });
 *
 * Що робить:
 *  - текстові файли (html/js/css/json/svg/webmanifest/txt/xml) віддає у brotli (якщо клієнт приймає `br`), інакше gzip, інакше як є;
 *    стиснуті буфери лежать у пам'яті (ключ: шлях + mtime + розмір), на старті прогріваються у фоні;
 *  - не чіпає вже стиснуті формати (mp3/png/jpg/webp/woff2/…): їх віддає express.static (Range-запити для аудіо працюють);
 *  - заголовки: Content-Type, Vary: Accept-Encoding, ETag (слабкий, окремий на кожне кодування), Last-Modified, 304 за If-None-Match / If-Modified-Since;
 *  - кеш: js/css/html без `?v=` → `no-cache` (перевірка ETag, оновлення доходять одразу); з `?v=<хеш>` → `immutable` на рік;
 *    звуки/картинки/шрифти → тиждень; sw.js і manifest → завжди `no-cache`;
 *  - index.html «на льоту» отримує `?v=<хеш вмісту>` для всіх локальних js/css (хеш змінюється лише коли змінився файл), тож після деплою
 *    браузер бере нові файли, а незмінені — з кешу без жодного запиту. Також у <head> додається `window.__AV` (мапа шлях → хеш) для ліниво завантажуваних модулів і мов;
 *  - /mapdata.js (динамічний) стискається «на виході»; у index.html підключення socket.io переписується на socket.io.min.js (у 3–4 рази легше).
 * Нічого не вимагає окрім вбудованих zlib/fs/crypto/path. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const TEXT_TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8'
};
const LONG_EXT = /\.(mp3|ogg|wav|m4a|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf)$/i;
const MIN_SIZE = 256;
const MAX_CACHE_BYTES = 48 * 1024 * 1024;
const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Вибір кодування за Accept-Encoding (з урахуванням q=0). */
function pickEncoding(header) {
    if (!header) return 'identity';
    const q = Object.create(null);
    String(header).split(',').forEach(part => {
        const m = /^\s*([\w*-]+)\s*(?:;\s*q\s*=\s*([\d.]+))?\s*$/i.exec(part);
        if (m) q[m[1].toLowerCase()] = m[2] === undefined ? 1 : parseFloat(m[2]);
    });
    const ok = n => (q[n] !== undefined ? q[n] > 0 : (q['*'] !== undefined && q['*'] > 0));
    if (ok('br')) return 'br';
    if (ok('gzip') || ok('x-gzip')) return 'gzip';
    return 'identity';
}
/** Чи збігається ETag з If-None-Match (слабке порівняння, список через кому, `*`). */
function etagMatch(inm, tag) {
    if (!inm) return false;
    if (inm.trim() === '*') return true;
    const strip = s => s.trim().replace(/^W\//, '');
    const t = strip(tag);
    return inm.split(',').some(x => strip(x) === t);
}
function compress(enc, data) {
    return new Promise((resolve, reject) => {
        const cb = (e, b) => e ? reject(e) : resolve(b);
        if (enc === 'br') zlib.brotliCompress(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length, [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT } }, cb);
        else zlib.gzip(data, { level: 9 }, cb);
    });
}

module.exports = function mountStatic(app, express, opts) {
    opts = opts || {};
    const publicDir = path.resolve(opts.publicDir || path.join(__dirname, 'public'));
    const base = publicDir + path.sep;
    const log = opts.log || (() => {});
    const encCache = new Map();          // `${fp}|${enc}` -> { stamp, buf, tag }
    const inflight = new Map();
    let cacheBytes = 0;
    const hashCache = new Map();         // fp -> { stamp, h }
    let htmlState = null;                // { t, key, html, lm }

    const stampOf = st => st.size.toString(36) + '-' + Math.floor(st.mtimeMs).toString(36);

    function remember(key, ent) {
        const old = encCache.get(key); if (old) cacheBytes -= old.buf.length;
        encCache.set(key, ent); cacheBytes += ent.buf.length;
        if (cacheBytes > MAX_CACHE_BYTES) {                    // дуже просте витіснення: найстаріші записи першими
            for (const k of encCache.keys()) { if (cacheBytes <= MAX_CACHE_BYTES * 0.7) break; const e = encCache.get(k); cacheBytes -= e.buf.length; encCache.delete(k); }
        }
    }
    function getCompressed(key, enc, stamp, load) {
        const hit = encCache.get(key);
        if (hit && hit.stamp === stamp) return Promise.resolve(hit);
        const fk = key + '@' + stamp;
        if (inflight.has(fk)) return inflight.get(fk);
        const p = Promise.resolve().then(load).then(data => compress(enc, data)).then(buf => {
            const ent = { stamp, buf, tag: 'W/"' + stamp + '-' + enc + '"' }; remember(key, ent); return ent;
        }).finally(() => inflight.delete(fk));
        inflight.set(fk, p); return p;
    }

    // ---------- хеші файлів для ?v= ----------
    function fileHash(fp) {
        let st; try { st = fs.statSync(fp); } catch (e) { return null; }
        if (!st.isFile()) return null;
        const stamp = stampOf(st), c = hashCache.get(fp);
        if (c && c.stamp === stamp) return c.h;
        let h; try { h = crypto.createHash('md5').update(fs.readFileSync(fp)).digest('hex').slice(0, 10); } catch (e) { return null; }
        hashCache.set(fp, { stamp, h }); return h;
    }
    function walk(dir, out, depth) {
        let items; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
        for (const it of items) {
            if (it.name[0] === '.') continue;
            const fp = path.join(dir, it.name);
            if (it.isDirectory()) { if (depth < 3 && it.name !== 'editor') walk(fp, out, depth + 1); } else if (/\.(js|css)$/.test(it.name)) out.push(fp);
        }
        return out;
    }
    /** index.html з ?v=хеш на локальних js/css + window.__AV для динамічних підвантажень. Кеш на 3 с. */
    function buildHtml(htmlPath) {
        const now = Date.now();
        if (htmlState && now - htmlState.t < 3000) return htmlState;
        const st = fs.statSync(htmlPath);
        let html = fs.readFileSync(htmlPath, 'utf8');
        html = html.replace(/(\b(?:src|href)=")((?:js|css)\/[^"?#]+\.(?:js|css))(")/g, (m, a, rel, z) => {
            const h = fileHash(path.join(publicDir, rel)); return h ? a + rel + '?v=' + h + z : m;
        });
        // клієнт socket.io: мінімізована збірка (≈49 КБ замість ≈180 КБ); сервер socket.io стискає її сам. Лише на льоту, у файлі index.html нічого не змінюється
        if (opts.socketMin !== false) html = html.replace('src="/socket.io/socket.io.js"', 'src="/socket.io/socket.io.min.js"');
        const av = {};
        walk(path.join(publicDir, 'js'), [], 0).forEach(fp => { const rel = path.relative(publicDir, fp).split(path.sep).join('/'); const h = fileHash(fp); if (h) av[rel] = h; });
        try {   // версія пакета звуків (одна на теку): міняється, коли змінився хоч один файл
            const sd = path.join(publicDir, 'sfx'), parts = fs.readdirSync(sd).sort().map(f => { const x = fs.statSync(path.join(sd, f)); return f + ':' + x.size + ':' + Math.floor(x.mtimeMs); });
            if (parts.length) av.sfx = crypto.createHash('md5').update(parts.join('|')).digest('hex').slice(0, 10);
        } catch (e) {}
        const tag = '<script>window.__AV=' + JSON.stringify(av) + ';window.__av=function(p){var v=window.__AV[p];return v?p+"?v="+v:p};</script>';
        html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + tag) : tag + html;
        const key = crypto.createHash('md5').update(html).digest('hex').slice(0, 12);
        if (htmlState && htmlState.key === key) { htmlState.t = now; return htmlState; }
        htmlState = { t: now, key, html: Buffer.from(html, 'utf8'), lm: st.mtime };
        return htmlState;
    }

    function cacheControlFor(url, ext, rel) {
        if (/(^|\/)(sw\.js|manifest\.webmanifest)$/.test(rel)) return 'no-cache';
        if (ext === '.html') return 'no-cache';
        if ((ext === '.js' || ext === '.css') && /(?:^|&)v=[\w.-]+/.test(url.search ? url.search.slice(1) : '')) return IMMUTABLE;
        return 'no-cache';
    }

    function respond(req, res, o) {
        // o: { type, cc, tag, lm, enc, buf }
        res.setHeader('Content-Type', o.type);
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Cache-Control', o.cc);
        res.setHeader('ETag', o.tag);
        if (o.lm) res.setHeader('Last-Modified', o.lm.toUTCString());
        const inm = req.headers['if-none-match'];
        let notMod = false;
        if (inm) notMod = etagMatch(inm, o.tag);
        else if (req.headers['if-modified-since'] && o.lm) { const t = Date.parse(req.headers['if-modified-since']); notMod = !isNaN(t) && Math.floor(o.lm.getTime() / 1000) <= Math.floor(t / 1000); }
        if (notMod) { res.statusCode = 304; return res.end(); }
        if (o.enc !== 'identity') res.setHeader('Content-Encoding', o.enc);
        res.setHeader('Content-Length', o.buf.length);
        if (req.method === 'HEAD') return res.end();
        res.end(o.buf);
    }

    function handler(req, res, next) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        let url;
        try { url = new URL(req.url, 'http://x'); } catch (e) { return next(); }
        let rel;
        try { rel = decodeURIComponent(url.pathname); } catch (e) { return next(); }
        if (rel.indexOf('\0') >= 0) return next();
        if (rel === '/') rel = '/index.html';
        const ext = path.extname(rel).toLowerCase();
        if (!TEXT_TYPES[ext]) return next();
        const fp = path.resolve(publicDir, '.' + rel);
        if (fp.indexOf(base) !== 0 || rel.split('/').some(s => s[0] === '.' && s.length > 0 && s !== '.')) return next();
        const relp = rel.replace(/^\//, '');
        fs.stat(fp, (err, st) => {
            if (err || !st.isFile()) return next();
            const enc = pickEncoding(req.headers['accept-encoding']);
            const type = TEXT_TYPES[ext], cc = cacheControlFor(url, ext, relp);
            let stamp, load, lm = st.mtime;
            if (relp === 'index.html') {
                let hs; try { hs = buildHtml(fp); } catch (e) { return next(); }
                stamp = 'h' + hs.key; load = () => hs.html; lm = hs.lm;
                if (enc === 'identity' || hs.html.length < MIN_SIZE) return respond(req, res, { type, cc, tag: 'W/"' + stamp + '-identity"', lm, enc: 'identity', buf: hs.html });
            } else {
                stamp = stampOf(st); load = () => fs.readFileSync(fp);
                if (enc === 'identity' || st.size < MIN_SIZE) {
                    return fs.readFile(fp, (e, data) => e ? next() : respond(req, res, { type, cc, tag: 'W/"' + stamp + '-identity"', lm, enc: 'identity', buf: data }));
                }
            }
            getCompressed(fp + '|' + enc, enc, stamp, load).then(ent => respond(req, res, { type, cc, tag: ent.tag, lm, enc, buf: ent.buf })).catch(() => next());
        });
    }
    app.use(handler);

    // /mapdata.js та інші динамічні скрипти: стискаємо «на виході», не змінюючи самі маршрути
    app.use('/mapdata.js', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const enc = pickEncoding(req.headers['accept-encoding']);
        if (enc === 'identity') return next();
        const origEnd = res.end.bind(res);
        res.setHeader('Vary', 'Accept-Encoding');
        res.end = function (chunk, encoding, cb) {
            res.end = origEnd;
            if (chunk == null || typeof chunk === 'function' || res.headersSent || res.statusCode !== 200) return origEnd(chunk, encoding, cb);
            const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8');
            if (data.length < MIN_SIZE) return origEnd(data);
            compress(enc, data).then(buf => { res.setHeader('Content-Encoding', enc); res.setHeader('Content-Length', buf.length); origEnd(buf); }, () => origEnd(data));
            return res;
        };
        next();
    });

    // решта (картинки, звуки, іконки): express.static із Range/ETag/Last-Modified і довгим кешем
    app.use(express.static(publicDir, {
        setHeaders: (res, fp) => {
            if (/(^|[\\/])(sw\.js|manifest\.webmanifest)$/.test(fp)) res.setHeader('Cache-Control', 'no-cache');
            else if (LONG_EXT.test(fp)) res.setHeader('Cache-Control', res.req && /[?&]v=[\w.-]+/.test(res.req.url || '') ? IMMUTABLE : 'public, max-age=604800');
            else res.setHeader('Cache-Control', 'no-cache');
        }
    }));

    // прогрів кешу стиснення у фоні (по одному файлу, щоб не навантажувати процесор на старті)
    function warm() {
        const files = [];
        (function scan(dir, depth) {
            let items; try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
            for (const it of items) {
                if (it.name[0] === '.') continue; const fp = path.join(dir, it.name);
                if (it.isDirectory()) { if (depth < 3) scan(fp, depth + 1); } else if (TEXT_TYPES[path.extname(it.name).toLowerCase()] && fp !== path.join(publicDir, 'index.html')) files.push(fp);
            }
        })(publicDir, 0);
        let i = 0;
        (function next() {
            if (i >= files.length) { log('static_gzip: прогріто ' + files.length + ' файлів, ' + Math.round(cacheBytes / 1024) + ' КБ у кеші'); return; }
            const fp = files[i++];
            let st; try { st = fs.statSync(fp); } catch (e) { return setImmediate(next); }
            if (st.size < MIN_SIZE) return setImmediate(next);
            getCompressed(fp + '|br', 'br', stampOf(st), () => fs.readFileSync(fp)).then(() => getCompressed(fp + '|gzip', 'gzip', stampOf(st), () => fs.readFileSync(fp))).catch(() => {}).then(() => setTimeout(next, 5));
        })();
    }
    if (opts.warm !== false) { const tm = setTimeout(warm, 1500); if (tm && tm.unref) tm.unref(); }

    return { pickEncoding, etagMatch, stats: () => ({ entries: encCache.size, bytes: cacheBytes }) };
};
module.exports.pickEncoding = pickEncoding;
module.exports.etagMatch = etagMatch;
