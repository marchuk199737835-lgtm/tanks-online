// Service worker гри. Мета: швидкий старт на мобільному інтернеті й завжди свіжий код після деплою.
//  - HTML і код без версії в URL (/, мови, /mapdata.js): «мережа першою» з таймаутом — на поганому зв'язку віддається збережена копія;
//  - js/css з ?v=<хеш> (index.html отримує їх від сервера): «кеш першим», бо URL змінюється разом із вмістом файлу — оновлення приходять самі;
//  - звуки, іконки, картинки: «кеш першим» (у звуків в URL теж є ?v=);
//  - сокети, API, редактор, музика (потокові запити з Range) — повз кеш.
// Підняти CACHE_VER, якщо треба примусово скинути всі старі кеші.
const CACHE_VER = 'v3';
const SHELL = 'tanks-shell-' + CACHE_VER;     // сторінка, мови, mapdata
const ASSETS = 'tanks-assets-' + CACHE_VER;   // версіоновані js/css, звуки, іконки
const MAX_ASSETS = 220;                        // старі версії файлів витісняються найстарішими першими
const NET_TIMEOUT = 4000;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function put(name, req, res, limit) {
    return caches.open(name).then(c => c.put(req, res).then(() => limit ? c.keys().then(ks => { if (ks.length > limit) return Promise.all(ks.slice(0, ks.length - limit).map(k => c.delete(k))); }) : null)).catch(() => {});
}
function cacheable(res) { return res && res.status === 200 && res.type === 'basic'; }

// мережа першою; якщо відповіді немає за timeout мс або мережа впала — збережена копія
function networkFirst(req, name, key, timeout) {
    return new Promise(resolve => {
        let settled = false, timer = 0;
        const fallback = () => caches.match(key || req).then(r => r || null);
        const finish = r => { if (settled) return; settled = true; clearTimeout(timer); resolve(r); };
        if (timeout) timer = setTimeout(() => { fallback().then(r => { if (r) finish(r); }); }, timeout);
        fetch(req).then(res => {
            if (cacheable(res)) put(name, key || req, res.clone());
            finish(res);
        }).catch(() => fallback().then(r => finish(r || Response.error())));
    });
}
function cacheFirst(req, name, limit) {
    return caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(res => {
        if (cacheable(res)) put(name, req, res.clone(), limit);
        return res;
    }));
}

// без версії в URL (іконки): віддаємо збережене одразу, а свіже підтягуємо у фоні
function staleWhileRevalidate(req, name, limit) {
    return caches.match(req, { ignoreVary: true }).then(hit => {
        const net = fetch(req).then(res => { if (cacheable(res)) put(name, req, res.clone(), limit); return res; });
        if (hit) { net.catch(() => {}); return hit; }
        return net;
    });
}

// ===== Push-сповіщення (сервер: notify.js). Пакет: { t: заголовок, b: текст, u: адреса, tag } =====
self.addEventListener('push', e => {
    let d = {}; try { d = e.data ? e.data.json() : {}; } catch (er) { d = { t: 'PULS-PROJECT', b: e.data ? e.data.text() : '' }; }
    e.waitUntil(self.registration.showNotification(d.t || 'PULS-PROJECT', {
        body: d.b || '', icon: '/icon-192.png', badge: '/icon-192.png', tag: d.tag || 'puls', renotify: false, data: { u: d.u || '/' }, vibrate: [80, 40, 80]
    }));
});
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const url = (e.notification.data && e.notification.data.u) || '/';
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const c of list) if (new URL(c.url).origin === location.origin && 'focus' in c) return c.focus();
        return self.clients.openWindow(url);
    }));
});

self.addEventListener('fetch', e => {
    const req = e.request, url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin) return;
    if (/^\/(socket\.io|api|editor|music)(\/|$)/.test(url.pathname) || req.headers.has('range')) return;
    if (url.pathname === '/sw.js') return;

    if (req.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
        e.respondWith(networkFirst(req, SHELL, '/', NET_TIMEOUT).then(r => r || Response.error()));
        return;
    }
    const versioned = url.searchParams.has('v');
    if (/\.(js|css)$/.test(url.pathname) && versioned) { e.respondWith(cacheFirst(req, ASSETS, MAX_ASSETS)); return; }
    if (/\.(mp3|ogg|wav|png|jpe?g|webp|gif|ico|svg|woff2?)$/i.test(url.pathname)) { e.respondWith(versioned ? cacheFirst(req, ASSETS, MAX_ASSETS) : staleWhileRevalidate(req, ASSETS, MAX_ASSETS)); return; }
    // решта (мови, /mapdata.js, manifest, js без версії): мережа першою, але без довгого очікування
    e.respondWith(networkFirst(req, SHELL, null, url.pathname === '/mapdata.js' ? 0 : NET_TIMEOUT).then(r => r || Response.error()));
});
