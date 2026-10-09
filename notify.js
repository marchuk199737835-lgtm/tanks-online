/* notify.js — push-сповіщення (PWA, Web Push) і нагорода за повернення.
 *
 * Push (лише гравцям НЕ в мережі; кожен тип — не частіше 1 разу на добу, разом не більше 4 на добу; мовою гравця):
 *   daily  — «Щоденний бонус чекає» (12:00–20:00 за Києвом, якщо бонус ще не забрано й гравець заходив за останні 14 днів)
 *   friend — «Друг чекає на вас» (друг зайшов у гру)
 *   season — «До кінця сезону 2 дні» (раз на сезон, тим, хто заходив за останні 30 днів)
 *   dm     — «Вам написав <нік>» (приватне повідомлення від друга, поки ви не в мережі)
 * Підписки: u.push = [{ e: endpoint, k: { p256dh, auth } }] (до 3 пристроїв). Ключі VAPID: змінні VAPID_PUBLIC / VAPID_PRIVATE,
 * інакше генеруються один раз і зберігаються (MongoDB meta/vapid або data/vapid.json). Потрібен пакет web-push (є в package.json).
 * Нагорода за повернення: не було 3+ дні → +100 кредитів при вході (не частіше разу на 7 днів).
 * Сокет: pushKey → pushKey {key} · pushSub {sub} · pushOff {e} ;  сервер → welcomeBack {days, cr}. */
'use strict';
const fs = require('fs'), path = require('path');
let webpush = null; try { webpush = require('web-push'); } catch (e) { console.warn('⚠️  web-push не встановлено — push-сповіщення вимкнено (npm i web-push)'); }

module.exports = function (ctx) {
    const { io, dbUsers, Events, saveUser } = ctx;
    const DAY = 864e5, BACK_DAYS = 3, BACK_CR = 100, BACK_GAP = 7 * DAY;
    const nick = n => (ctx.displayName && ctx.displayName(n)) || n;
    const dayKey = t => { try { return ctx.Progress ? ctx.Progress._dayKey(t) : Math.floor(t / DAY); } catch (e) { return Math.floor(t / DAY); } };
    const kyivHour = () => { try { return +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Kiev', hour: 'numeric', hourCycle: 'h23' }).format(new Date()); } catch (e) { return new Date().getUTCHours() + 3; } };

    // ---------- тексти (мова акаунта) ----------
    const TXT = {
        uk: { daily: ['🎁 Щоденний бонус чекає', 'Заберіть сьогоднішню нагороду — серія не має перерватися!'], friend: ['🤝 Друг чекає на вас', '{n} зараз у грі. Приєднуйтесь до бою!'], season: ['🏆 До кінця сезону 2 дні', 'Встигніть піднятися в рейтингу — нагорода залежить від ліги!'], dm: ['💬 Вам написав {n}', '{t}'] },
        en: { daily: ['🎁 Daily bonus is waiting', "Claim today's reward — don't break your streak!"], friend: ['🤝 A friend is waiting', '{n} is in the game now. Join the battle!'], season: ['🏆 2 days left in the season', 'Climb the ranks in time — rewards depend on your league!'], dm: ['💬 {n} sent you a message', '{t}'] },
        es: { daily: ['🎁 Tu bono diario te espera', '¡Reclama la recompensa de hoy y no rompas tu racha!'], friend: ['🤝 Un amigo te espera', '{n} está jugando ahora. ¡Únete a la batalla!'], season: ['🏆 Quedan 2 días de temporada', '¡Sube en la clasificación a tiempo: la recompensa depende de tu liga!'], dm: ['💬 {n} te escribió', '{t}'] },
        de: { daily: ['🎁 Dein Tagesbonus wartet', 'Hol dir die heutige Belohnung — reiß deine Serie nicht ab!'], friend: ['🤝 Ein Freund wartet', '{n} ist gerade im Spiel. Komm in den Kampf!'], season: ['🏆 Noch 2 Tage Saison', 'Steig rechtzeitig auf — die Belohnung hängt von deiner Liga ab!'], dm: ['💬 {n} hat dir geschrieben', '{t}'] },
        fr: { daily: ['🎁 Votre bonus quotidien vous attend', "Récupérez la récompense du jour — ne cassez pas votre série !"], friend: ['🤝 Un ami vous attend', '{n} est en jeu. Rejoignez le combat !'], season: ['🏆 Plus que 2 jours de saison', 'Montez au classement à temps — la récompense dépend de votre ligue !'], dm: ['💬 {n} vous a écrit', '{t}'] },
        pt: { daily: ['🎁 Seu bônus diário está esperando', 'Resgate a recompensa de hoje — não quebre sua sequência!'], friend: ['🤝 Um amigo está esperando', '{n} está no jogo agora. Entre na batalha!'], season: ['🏆 Faltam 2 dias para o fim da temporada', 'Suba no ranking a tempo — a recompensa depende da sua liga!'], dm: ['💬 {n} enviou uma mensagem', '{t}'] },
        pl: { daily: ['🎁 Dzienny bonus czeka', 'Odbierz dzisiejszą nagrodę — nie przerywaj serii!'], friend: ['🤝 Znajomy czeka', '{n} jest teraz w grze. Dołącz do bitwy!'], season: ['🏆 Do końca sezonu 2 dni', 'Awansuj w rankingu na czas — nagroda zależy od ligi!'], dm: ['💬 {n} napisał do ciebie', '{t}'] },
        tr: { daily: ['🎁 Günlük bonus seni bekliyor', 'Bugünün ödülünü al — serini bozma!'], friend: ['🤝 Bir arkadaşın bekliyor', '{n} şu an oyunda. Savaşa katıl!'], season: ['🏆 Sezonun bitmesine 2 gün', 'Zamanında yüksel — ödül ligine bağlı!'], dm: ['💬 {n} sana yazdı', '{t}'] }
    };
    const fill = (s, d) => s.replace('{n}', d.n || '').replace('{t}', d.t || '');

    // ---------- ключі VAPID ----------
    let vapid = null, vapidLoading = false;
    const DATA = path.join(__dirname, 'data', 'vapid.json');
    function applyVapid(k) { if (!webpush || !k || !k.publicKey || !k.privateKey) return; vapid = k; webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@puls-project.info', k.publicKey, k.privateKey); }
    function loadVapid() {
        if (!webpush || vapid || vapidLoading) return;
        if (process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE) return applyVapid({ publicKey: process.env.VAPID_PUBLIC, privateKey: process.env.VAPID_PRIVATE });
        const db = ctx.getDb && ctx.getDb();
        if (db) {
            vapidLoading = true; const col = db.collection('meta');
            col.findOne({ _id: 'vapid' }).then(doc => {                         // 1 читання при старті
                if (doc && doc.publicKey) return applyVapid(doc);
                const k = webpush.generateVAPIDKeys(); applyVapid(k);
                return col.insertOne({ _id: 'vapid', publicKey: k.publicKey, privateKey: k.privateKey });   // 1 запис за все життя
            }).catch(e => console.error('❌ VAPID:', e.message)).finally(() => { vapidLoading = false; });
            return;
        }
        try { applyVapid(JSON.parse(fs.readFileSync(DATA, 'utf8'))); } catch (e) {
            const k = webpush.generateVAPIDKeys(); applyVapid(k);
            try { fs.mkdirSync(path.dirname(DATA), { recursive: true }); fs.writeFileSync(DATA, JSON.stringify(k)); } catch (er) {}
        }
    }
    const vt = setInterval(() => { if (!vapid) loadVapid(); else clearInterval(vt); }, 5000); if (vt.unref) vt.unref();
    setTimeout(loadVapid, 1500);

    // ---------- надсилання ----------
    const pushUsers = new Set();      // хто має підписку (щоб планувальник не перебирав усі акаунти)
    function indexUsers() { for (const n in dbUsers) { const u = dbUsers[n]; if (u && Array.isArray(u.push) && u.push.length) pushUsers.add(n); } }
    setTimeout(indexUsers, 15000);
    function send(login, type, d) {
        const u = dbUsers[login]; if (!webpush || !vapid || !u || !Array.isArray(u.push) || !u.push.length) return false;
        if (ctx.isOnline(login)) return false;
        const now = Date.now(), dk = dayKey(now);
        const L = u.pushLog && typeof u.pushLog === 'object' ? u.pushLog : (u.pushLog = {});
        if (L[type] === dk) return false;
        if (L._d !== dk) { L._d = dk; L._n = 0; } if (L._n >= 4) return false;
        L[type] = dk; L._n++;
        const T = (TXT[u.lang] || TXT.uk)[type], body = JSON.stringify({ t: fill(T[0], d || {}), b: fill(T[1], d || {}).slice(0, 160), u: '/', tag: type });
        u.push.slice().forEach(s => {
            webpush.sendNotification({ endpoint: s.e, keys: s.k }, body, { TTL: 6 * 3600, urgency: type === 'dm' ? 'high' : 'normal', topic: type }).catch(err => {
                if (err && (err.statusCode === 404 || err.statusCode === 410)) { u.push = u.push.filter(x => x.e !== s.e); if (!u.push.length) pushUsers.delete(login); saveUser(login); }
            });
        });
        saveUser(login);
        return true;
    }

    // ---------- події ----------
    Events.on('login', e => {
        try {
            const u = dbUsers[e.name]; if (!u) return; const now = Date.now();
            // нагорода за повернення
            const last = Math.max(+u.lastLogin || 0, +u.lastSeen || 0);
            if (last && now - last >= BACK_DAYS * DAY && (!u.backAt || now - u.backAt >= BACK_GAP)) {
                u.bucks += BACK_CR; if (u.stats) u.stats.earned = (u.stats.earned | 0) + BACK_CR; u.backAt = now;
                const days = Math.floor((now - last) / DAY);
                setTimeout(() => { try { io.to(e.socketId).emit('welcomeBack', { days, cr: BACK_CR }); ctx.sendEconomy(e.socketId, e.name); } catch (er) {} }, 2500);
            }
            u.lastLogin = now; saveUser(e.name);
            // друзям, що не в мережі: «Друг чекає на вас»
            (Array.isArray(u.friends) ? u.friends : []).slice(0, 50).forEach(f => { if (pushUsers.has(f)) send(f, 'friend', { n: nick(e.name) }); });
        } catch (er) { console.error('❌ notify login', er && er.message); }
    });
    // планувальник (раз на 10 хв): щоденний бонус і кінець сезону — лише серед підписаних
    const tick = setInterval(() => {
        try {
            if (!vapid || !pushUsers.size) return;
            const now = Date.now(), h = kyivHour(), dk = dayKey(now);
            let sEnd = 0, sId = ''; try { sEnd = ctx.Profile.seasonEnd(); sId = ctx.Profile.seasonId(); } catch (e) {}
            const seasonSoon = sEnd && sEnd - now < 2 * DAY && sEnd - now > DAY;
            pushUsers.forEach(n => {
                const u = dbUsers[n]; if (!u) { pushUsers.delete(n); return; }
                const seen = +u.lastLogin || 0;
                if (h >= 12 && h < 20 && now - seen < 14 * DAY && !(u.daily && u.daily.last === dk)) send(n, 'daily', {});
                if (seasonSoon && now - seen < 30 * DAY && u.pushSeason !== sId && send(n, 'season', {})) u.pushSeason = sId;
            });
        } catch (e) { console.error('❌ notify tick', e && e.message); }
    }, 10 * 60e3); if (tick.unref) tick.unref();

    // ---------- сокет ----------
    ctx.onConnection(socket => {
        let last = 0;
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        socket.on('pushKey', () => { if (vapid) socket.emit('pushKey', { key: vapid.publicKey }); else socket.emit('pushKey', { key: null }); });
        socket.on('pushSub', d => {
            const n = me(); const t = Date.now(); if (!n || t - last < 2000) return; last = t;
            const s = d && d.sub; if (!s || typeof s.endpoint !== 'string' || !/^https:\/\//.test(s.endpoint) || s.endpoint.length > 600 || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string' || s.keys.p256dh.length > 200 || s.keys.auth.length > 64) return;
            const u = dbUsers[n]; if (!Array.isArray(u.push)) u.push = [];
            if (u.push.some(x => x.e === s.endpoint && x.k.p256dh === s.keys.p256dh)) return;
            u.push = u.push.filter(x => x.e !== s.endpoint).concat({ e: s.endpoint, k: { p256dh: s.keys.p256dh, auth: s.keys.auth } }).slice(-3);
            pushUsers.add(n); saveUser(n);
        });
        socket.on('pushOff', d => {
            const n = me(); if (!n || !d || typeof d.e !== 'string') return; const u = dbUsers[n];
            if (Array.isArray(u.push)) { u.push = u.push.filter(x => x.e !== d.e); if (!u.push.length) pushUsers.delete(n); saveUser(n); }
        });
    });
    ctx.Notify = { send, pushUsers };
};
