/* events.js — спільна шина подій сервера (одна на весь процес). Модулі прогресу, профілю, соціальних функцій і ботів
 * підписуються на неї, а server.js / modes.js / bots.js їх викликають. Усі події синхронні, обробники НЕ мають кидати помилок
 * (обгортайте тіло в try/catch). Імена акаунтів — це ЛОГІНИ (ключі dbUsers); у ботів логіна в dbUsers немає (isBot=true).
 *
 *  'kill'        { roomId, mode, killerName, killerBot, victimName, victimBot, weapon }      // weapon = тип снаряда ('piercing', 'explosive', …) або null
 *  'multikill'   { roomId, mode, killerName, killerBot, weapon, count }                     // один снаряд поцілив кількох гравців одночасно (count≥2)
 *  'matchEnd'    { roomId, mode, durationMs, players:[{ name, isBot, outcome:'win'|'loss'|'draw', kills, deaths, credits, xp:{gain,before,after,lvlBefore,lvlAfter}|null, dropped, place, team, caps, brPicks }], wave, waves }
 *  'caseOpened'  { name, caseId, modId, price, fromLevel }
 *  'upgradeDone' { name, win, srcId, tgtId }
 *  'moduleEquipped' { name, modId }
 *  'moduleSold'  { name, modId, price }
 *  'login'       { name, socketId }
 *  'logout'      { name, socketId }
 */
const { EventEmitter } = require('events');
const bus = new EventEmitter(); bus.setMaxListeners(50);
const emit = bus.emit.bind(bus);
bus.emit = function (ev, payload) { try { return emit(ev, payload); } catch (e) { console.error('❌ Events:', ev, e && e.message); return false; } };
module.exports = bus;
