// Service worker: «мережа першою» — гравці завжди отримують свіжу версію гри, а кеш рятує, коли зв'язок поганий.
// Кеш не чіпає сокети, API, редактор і музику (потокові запити з Range).
const CACHE = 'tanks-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
    const req = e.request, url = new URL(req.url);
    if (req.method !== 'GET' || url.origin !== location.origin) return;
    if (/^\/(socket\.io|api|editor|music)/.test(url.pathname) || req.headers.has('range')) return;
    e.respondWith(
        fetch(req).then(res => {
            if (res && res.status === 200 && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
            return res;
        }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('/') : Response.error())))
    );
});
