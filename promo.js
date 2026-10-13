/* promo.js — промокоди (винесено з server.js). Підключення: const Promo = require('./promo.js')(dbUsers); Promo.attachDb(db) після підключення до MongoDB. */
'use strict';
module.exports = function (dbUsers) {
let promoCol = null;
// ===== ПРОМОКОДИ =====
// Коди й суми живуть лише на сервері (клієнту суму не довіряємо). credits — скільки Кредів (поле bucks) дає код;
// maxUses — загальний ліміт активацій (0 = без ліміту); expires — 'YYYY-MM-DD' (включно, UTC) або null; once — один раз на акаунт.
// Лічильники використань: колекція promo_uses у MongoDB (або пам'ять, якщо БД нема); застосовані коди акаунта — u.usedPromos.
const PROMO_CODES = {
    'WELCOME':   { credits: 50,  maxUses: 0,    expires: null,         once: true },
    'BONUS25':   { credits: 25,  maxUses: 1000, expires: '2026-12-31', once: true },
    'ALEX-TOP1': { credits: 200, maxUses: 0,    expires: null,         once: true },  // старий код (раніше був зашитий у usePromo)
    'START':     { credits: 200, maxUses: 0,    expires: null,         once: true }   // промокод навчання новачка
};
const promoUses = Object.create(null);
const promoRate = Object.create(null);   // за ім'ям акаунта: { last, fails, windowStart, blockedUntil }
const PROMO_MIN_GAP = 1500, PROMO_MAX_FAILS = 8, PROMO_WINDOW = 10 * 60 * 1000, PROMO_BLOCK = 5 * 60 * 1000;
function redeemPromoCode(name, rawCode, now) {
    now = now || Date.now();
    const u = dbUsers[name];
    if (!u) return { ok: false, msg: 'Спершу увійдіть в акаунт' };
    const rt = promoRate[name] || (promoRate[name] = { last: 0, fails: 0, windowStart: now, blockedUntil: 0 });
    if (now < rt.blockedUntil) return { ok: false, msg: 'Забагато невдалих спроб. Спробуйте пізніше' };
    if (now - rt.last < PROMO_MIN_GAP) return { ok: false, msg: 'Не так швидко! Зачекайте секунду' };
    rt.last = now;
    if (now - rt.windowStart > PROMO_WINDOW) { rt.windowStart = now; rt.fails = 0; }
    const fail = msg => { if (++rt.fails >= PROMO_MAX_FAILS) { rt.blockedUntil = now + PROMO_BLOCK; rt.fails = 0; } return { ok: false, msg }; };
    if (typeof rawCode !== 'string') return fail('Невірний промокод');
    const code = rawCode.trim().toUpperCase();
    if (!code) return { ok: false, msg: 'Введіть промокод' };
    if (code.length > 40 || !Object.prototype.hasOwnProperty.call(PROMO_CODES, code)) return fail('Невірний промокод');
    const p = PROMO_CODES[code];
    if (p.off) return fail('Невірний промокод');      // вимкнений в адмінці
    if (p.expires && now > Date.parse(p.expires + 'T23:59:59.999Z')) return fail('Термін дії промокоду минув');
    if (!Array.isArray(u.usedPromos)) u.usedPromos = [];
    if (p.once !== false && u.usedPromos.some(x => String(x).toUpperCase() === code)) return fail('Цей промокод уже використано');
    if (p.maxUses > 0 && (promoUses[code] || 0) >= p.maxUses) return fail('Ліміт активацій цього промокоду вичерпано');
    const amt = Math.max(0, Math.floor(p.credits)) || 0;
    promoUses[code] = (promoUses[code] || 0) + 1;
    if (promoCol) promoCol.updateOne({ _id: code }, { $inc: { uses: 1 } }, { upsert: true }).catch(e => console.error('❌ Лічильник промокоду', code, e.message));
    u.usedPromos.push(code);
    u.bucks += amt; u.stats.earned += amt;
    rt.fails = 0;
    return { ok: true, msg: 'Успішно! +' + amt + ' кредів', amount: amt, bucks: u.bucks };
}
function attachDb(db) {
    promoCol = db.collection('promo_uses');
    promoCol.find({}).toArray().then(rows => { rows.forEach(r => { if (r && r._id) promoUses[r._id] = Math.max(promoUses[r._id] || 0, r.uses | 0); }); }).catch(e => console.error('❌ Лічильники промокодів:', e.message));
}
return { PROMO_CODES, promoUses, redeemPromoCode, attachDb };
};
