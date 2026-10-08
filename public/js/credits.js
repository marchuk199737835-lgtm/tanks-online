/* credits.js — «Музика та ліцензії»: вікно з авторами треків, посиланнями на Pixabay і ліцензію.
 * Картка в головному меню (MenuHub). Дані — у масиві TRACKS нижче: додав трек у music/<main|loby>/lic/free — додай рядок сюди. */
(function () {
    'use strict';
    var P = 'https://pixabay.com/';
    var LICENSE = P + 'service/license-summary/', TERMS = P + 'service/terms/', SITE = P + 'music/';
    var TRACKS = [
        { cat: 'main', title: 'Hyper Garden (Jungle Breakbeat Drum And Bass)', author: 'Musinova', url: P + 'music/drum-n-bass-hyper-garden-jungle-breakbeat-drum-and-bass-356529/', profile: P + 'users/musinova-47643763/' },
        { cat: 'main', title: 'Halloween Phonk', author: 'ArtIssizm', url: P + 'music/upbeat-halloween-phonk-424696/', profile: P + 'users/artissizm-29919399/' },
        { cat: 'loby', title: 'Halloween Time', author: 'NickyPe', url: P + 'music/horror-scene-halloween-time-122463/', profile: P + 'users/nickype-10327513/' },
        { cat: 'loby', title: 'Spooky Halloween', author: 'SOULFULJAMTRACKS', url: P + 'music/scary-childrens-tunes-spooky-halloween-586106/', profile: P + 'users/soulfuljamtracks-46363515/' },
        { cat: 'loby', title: 'Happy & Spooky Halloween Music', author: 'SOULFULJAMTRACKS', url: P + 'music/scary-childrens-tunes-happy-amp-spooky-halloween-music-598624/', profile: P + 'users/soulfuljamtracks-46363515/' },
        { cat: 'loby', title: 'Halloween Music', author: 'Sound4Stock', url: P + 'music/happy-childrens-tunes-halloween-music-609427/', profile: P + 'users/sound4stock-53243298/' },
        { cat: 'loby', title: 'Spooky Halloween', author: 'SOUND_GARAGE', url: P + 'music/scary-childrens-tunes-spooky-halloween-381141/', profile: P + 'users/sound_garage-47313534/' }
    ];
    var GROUPS = [['main', '🏠', 'Головне меню'], ['loby', '🎮', 'Лобі та кімнати']];
    var css = '#cr-ov{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(12px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px));background:rgba(2,6,23,.82);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
        '#cr-ov.on{display:flex;animation:crIn .22s ease-out}@keyframes crIn{from{opacity:0}to{opacity:1}}' +
        '.cr-box{position:relative;width:min(560px,100%);max-height:100%;display:flex;flex-direction:column;border-radius:20px;background:linear-gradient(160deg,rgba(30,41,82,.96),rgba(10,16,38,.97));border:1px solid rgba(139,92,246,.45);box-shadow:0 0 40px rgba(139,92,246,.25),0 20px 60px rgba(0,0,0,.6);color:#e2e8f0;overflow:hidden}' +
        '.cr-hd{padding:18px 56px 12px 20px;border-bottom:1px solid rgba(148,163,184,.15);background:radial-gradient(120% 140% at 0 0,rgba(139,92,246,.28),transparent 60%)}' +
        '.cr-hd h2{margin:0;font:400 20px/1.2 "Russo One",Arial,sans-serif;letter-spacing:.06em;color:#fff}.cr-hd p{margin:4px 0 0;font-size:12px;color:#94a3b8}' +
        '.cr-x{position:absolute;top:10px;right:10px;width:38px;height:38px;border-radius:50%;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.7);color:#e2e8f0;font-size:16px;cursor:pointer}.cr-x:hover{background:rgba(239,68,68,.35)}' +
        '.cr-bd{padding:14px 16px 8px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}' +
        '.cr-lic{display:flex;gap:10px;align-items:flex-start;padding:11px 13px;border-radius:14px;background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.35);font-size:12.5px;line-height:1.45;color:#cbd5e1}.cr-lic i{font-style:normal;font-size:20px;line-height:1}' +
        '.cr-gh{margin:14px 2px 7px;font:400 11px/1 "Russo One",Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#a5b4fc}' +
        '.cr-t{display:flex;align-items:center;gap:10px;padding:9px 10px;margin-bottom:7px;border-radius:14px;background:rgba(30,41,59,.65);border:1px solid rgba(148,163,184,.14)}' +
        '.cr-t:hover{border-color:rgba(139,92,246,.5);background:rgba(51,65,110,.55)}.cr-ni{flex:0 0 34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:rgba(139,92,246,.2)}' +
        '.cr-tx{flex:1;min-width:0}.cr-tx b{display:block;font-size:13.5px;color:#fff;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cr-tx small{display:block;font-size:12px;color:#94a3b8}' +
        '.cr-a{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 11px;border-radius:10px;font-size:12px;font-weight:800;text-decoration:none;color:#e0e7ff;background:rgba(99,102,241,.28);border:1px solid rgba(129,140,248,.5);cursor:pointer}.cr-a:hover{background:rgba(99,102,241,.5)}.cr-a.alt{background:rgba(51,65,85,.6);border-color:rgba(148,163,184,.35)}' +
        '.cr-ft{display:flex;flex-wrap:wrap;gap:8px;padding:10px 16px 14px;border-top:1px solid rgba(148,163,184,.15)}.cr-ft .cr-a{flex:1 1 140px}' +
        '.cr-note{margin:10px 2px 6px;font-size:11px;color:#64748b;line-height:1.4}' +
        '@media (hover:none) and (pointer:coarse){.cr-x{width:44px;height:44px}.cr-a{min-height:44px}}' +
        '@media (max-width:480px){.cr-t{flex-wrap:wrap}.cr-tx{flex:1 1 calc(100% - 50px)}.cr-t .cr-a{flex:1 1 40%}}' +
        '@media (max-height:480px){.cr-hd{padding:10px 52px 8px 16px}.cr-hd p{display:none}.cr-bd{padding:8px 12px 4px}.cr-lic{padding:8px 10px}}' +
        'html.gfx-low #cr-ov{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(2,6,23,.95)}html.gfx-low #cr-ov.on{animation:none}';
    var st = document.createElement('style'); st.id = 'cr-css'; st.textContent = css; document.head.appendChild(st);
    function a(href, txt, alt) { return '<a class="cr-a' + (alt ? ' alt' : '') + '" href="' + href + '" target="_blank" rel="noopener noreferrer">' + txt + '</a>'; }
    var ov = null;
    function build() {
        ov = document.createElement('div'); ov.id = 'cr-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
        var h = '<div class="cr-box"><button class="cr-x" type="button" aria-label="Закрити">✕</button>' +
            '<div class="cr-hd"><h2><span>🎵</span> <span>МУЗИКА ТА ЛІЦЕНЗІЇ</span></h2><p>Дякуємо авторам за музику в грі</p></div><div class="cr-bd">' +
            '<div class="cr-lic"><i>✅</i><div>Музика в грі — з бібліотеки Pixabay за ліцензією Pixabay Content License: безкоштовне використання, зокрема в іграх; зазначення автора не обов’язкове, але ми вказуємо всіх. Права на треки належать їхнім авторам.</div></div>';
        GROUPS.forEach(function (g) {
            var list = TRACKS.filter(function (t) { return t.cat === g[0]; }); if (!list.length) return;
            h += '<div class="cr-gh"><span>' + g[1] + '</span> <span>' + g[2] + '</span></div>';
            list.forEach(function (t) {
                h += '<div class="cr-t"><div class="cr-ni">♪</div><div class="cr-tx"><b class="i18n-skip">' + esc(t.title) + '</b><small><span>Автор</span>: <span class="i18n-skip">' + esc(t.author) + '</span></small></div>' +
                    a(t.url, 'Трек') + a(t.profile, 'Автор', true) + '</div>';
            });
        });
        h += '<div class="cr-note">Назви треків і імена авторів наведено мовою оригіналу.</div></div>' +
            '<div class="cr-ft">' + a(LICENSE, 'Ліцензія Pixabay') + a(TERMS, 'Умови використання', true) + a(SITE, 'Музика на Pixabay', true) + '</div></div>';
        ov.innerHTML = h; document.body.appendChild(ov);
        ov.addEventListener('click', function (e) { if (e.target === ov || e.target.closest('.cr-x')) close(); });
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function open() { if (!ov) build(); ov.classList.add('on'); try { ov.querySelector('.cr-x').focus(); } catch (e) {} }
    function close() { if (ov) ov.classList.remove('on'); }
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && ov && ov.classList.contains('on')) close(); });
    window.Credits = { open: open, close: close, tracks: TRACKS };
    if (window.MenuHub) MenuHub.addCard({ id: 'mm-credits', icon: '🎵', title: 'Музика', sub: 'Автори та ліцензії', color: 'indigo', onClick: open });
})();
