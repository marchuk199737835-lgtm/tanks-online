/* combat.js — снаряди гравців: серверна таблиця зброї та перевірка влучань (підключається з server.js напряму).
 * Клієнт лише повідомляє «влучив у ціль X снарядом bid». Сервер перевіряє, що снаряд справжній (id видано в 'shoot'),
 * належить цьому гравцю, встиг долетіти й ще не влучав у цю ціль, а шкоду бере з таблиці нижче (ті самі числа, що BUFFS у public/js/config.js). */
'use strict';

const BULLET_SPEED = 700;
// dmg — шкода, spd — множник швидкості (база 700 px/с), life — секунд польоту, n — скільки разів снаряд може влучити в одну ціль
// (дріб: 20 дробин з одним id), splash — шкода уламків вибуху, gap — мінімальний інтервал між пострілами (мс) у PvP.
const SHOT_T = {
    none: { dmg: 75 }, explosive: { dmg: 250, splash: 250 }, minigun: { dmg: 25, spd: 1.8, gap: 90 }, fast: { dmg: 25, spd: 1.8, gap: 90 },
    boss: { dmg: 500 }, shotgun: { dmg: 25, spd: 1.2, life: 1.2, n: 20 }, healing: { dmg: 75 }, samurai: { dmg: 75, spd: 100 / 700, life: 0.15, reach: 45, gap: 250 },
    piercing: { dmg: 50 }, invisible: { dmg: 75, gap: 250 }, homing: { dmg: 125, spd: 1.25 }, hunter_gun: { dmg: 250 }, speed: { dmg: 75 }, shield: { dmg: 75 },
    double_dmg: { dmg: 300 }, incendiary: { dmg: 75 }, reaper: { dmg: 75 }, autolaser: { dmg: 75 }
};
const shotT = t => (typeof t === 'string' && Object.prototype.hasOwnProperty.call(SHOT_T, t)) ? SHOT_T[t] : SHOT_T.none;
const HIT_SLACK_S = 0.4, HIT_SLACK_PX = 240;      // пінг / рух цілі / радіус великого танка (бос 75 px)

// постріли за id (живуть 8 с): { owner, room, type, lm, x, y, t, hits: Map(ціль → кількість), kills }
const SHOTS = new Map(); let seq = 1;
function trim(now) { for (const [k, s] of SHOTS) { if (now - s.t > 8000) SHOTS.delete(k); else break; } }
function add(rec) { trim(rec.t); const id = seq++; SHOTS.set(id, rec); return id; }

// чи міг снаряд sh за цей час долетіти до цілі v (пряма — найкоротший шлях, тож рикошет і самонаведення теж проходять)
function reach(sh, v, now, splash) {
    const T = shotT(sh.type), age = (now - sh.t) / 1000, life = (T.life || 2.5) * sh.lm;
    if (age > life + 1.2) return false;
    const r = BULLET_SPEED * (T.spd || 1) * Math.min(age + HIT_SLACK_S, life + 0.2) + (T.reach || 0) + HIT_SLACK_PX + (splash ? 130 : 0);
    return Math.hypot(v.x - sh.x, v.y - sh.y) <= r;
}
// повний вердикт для влучання: снаряд shotId від гравця owner у кімнаті room по цілі key (координати tgt). Повертає запис пострілу або null
function claimHit(shotId, owner, room, key, tgt, splash, now) {
    const sh = Number.isInteger(shotId) ? SHOTS.get(shotId) : null;
    if (!sh || sh.owner !== owner || sh.room !== room) return null;
    const T = shotT(sh.type); if (splash && !T.splash) return null;
    const hk = key + (splash ? '|s' : ''), hn = sh.hits.get(hk) || 0;
    if (hn >= (splash ? 1 : (T.n || 1)) || !reach(sh, tgt, now, splash)) return null;
    sh.hits.set(hk, hn + 1);
    return sh;
}

module.exports = { BULLET_SPEED, SHOT_T, shotT, SHOTS, add, claimHit, reach };
