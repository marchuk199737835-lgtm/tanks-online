/* stakes.js — «Арена ставок» (сервер): батл кейсів, койнфліп, джекпот, краш, колесо, мінне поле, контракт обміну,
 * лотерея сезону та дуелі з друзями на кредити. Правила й числа — public/js/stakesinfo.js (спільні з клієнтом).
 *
 * Лише ігрова валюта: кредити й модулі не мають грошової вартості, вивести їх неможливо.
 *
 * Захист від зловживань:
 *  • доступ із 3 рівня, лише після згоди з правилами; ліміт 30 ставок на добу (Київ) і 50…5000 кредитів за ставку;
 *  • ставка списується одразу й лежить «на утриманні» (u.stk.hold, зберігається в БД разом з акаунтом). Якщо сервер
 *    перезапуститься посеред гри — при наступному вході все повертається (гра, якої вже немає в пам'яті, не може «з'їсти» ставку);
 *  • предмети в ставці одразу зникають з інвентарю (їх не можна одночасно продати, апгрейднути чи вдягти);
 *  • койнфліп: лише предмети, суми сторін відрізняються не більше ніж на 150; дуель і койнфліп — не з тієї ж мережі (хеш IP);
 *  • дуель: лише з другом, одна пара — не більше 3 дуелей на добу, утікач програє; у дуелі не випадають предмети й звичайні нагороди;
 *  • результати визначає лише сервер (provably fair: хеш ключа до гри, ключ після), частота запитів обмежена;
 *  • виграш не вміщується в інвентар — предмети чекають у «скриньці виграшу», гравець сам вирішує: забрати, продати чи замінити. */
'use strict';
const crypto = require('crypto');
const SI = require('./public/js/stakesinfo.js');

module.exports = function (ctx) {
    const { io, rooms, dbUsers, Events, GameData, MODULES, CASES, saveUser } = ctx;
    const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
    const priceOf = id => (MODULES[id] && MODULES[id].price) | 0;
    const nick = l => (ctx.displayName && ctx.displayName(l)) || l;
    const lvl = l => { try { return ctx.playerLevel(l); } catch (e) { return 1; } };
    const sockOf = l => ctx.onlineSocketsOf(l) || [];
    const toLogin = (l, ev, d) => sockOf(l).forEach(s => io.to(s).emit(ev, d));
    const msg = (l, t, bad) => toLogin(l, 'stkMsg', { t, bad: !!bad });
    const now = () => Date.now();
    const int = v => { const n = Math.floor(+v); return Number.isFinite(n) ? n : NaN; };

    // ================= ЧЕСНІСТЬ =================
    const newSeed = () => crypto.randomBytes(32).toString('hex');
    const sha = s => crypto.createHash('sha256').update(s).digest('hex');
    const fl = (ss, cs, nonce) => SI.hexFloat(crypto.createHmac('sha256', ss).update(cs + ':' + nonce).digest('hex'));
    const rngOf = (ss, cs, base) => { let i = 0; return () => fl(ss, cs, base + ':' + (i++)); };
    let seq = 1; const gid = p => p + '_' + Date.now().toString(36) + (seq++).toString(36);

    // ================= ДАНІ ГРАВЦЯ =================
    function S(l) {
        const u = dbUsers[l]; if (!u) return null;
        if (!u.stk || typeof u.stk !== 'object') u.stk = {};
        const s = u.stk;
        if (!Array.isArray(s.hold)) s.hold = []; if (!Array.isArray(s.prize)) s.prize = []; if (!Array.isArray(s.hist)) s.hist = [];
        if (!Array.isArray(s.news)) s.news = [];
        const d = SI.dayId(now()); if (s.day !== d) { s.day = d; s.n = 0; }
        s.n = s.n | 0;
        return s;
    }
    const ACTIVE = new Set();      // ідентифікатори ігор, що зараз живуть у пам'яті
    function hist(l, k, d, x) { const s = S(l); if (!s) return; s.hist.push({ k, d: d | 0, x: String(x || '').slice(0, 80), t: now() }); if (s.hist.length > 40) s.hist.splice(0, s.hist.length - 40); }
    function canBet(l) {
        const u = dbUsers[l]; if (!u) return 'Спершу увійдіть в акаунт';
        if (lvl(l) < SI.MIN_LEVEL) return 'Арена ставок відкривається з ' + SI.MIN_LEVEL + ' рівня';
        const s = S(l); if (!s.acc) return 'Спершу прийміть правила Арени ставок';
        if (s.n >= SI.DAILY) return 'Ліміт ставок на сьогодні вичерпано (' + SI.DAILY + '). Повертайтесь завтра!';
        return null;
    }
    const betOk = a => Number.isFinite(a) && a >= SI.MIN_BET && a <= SI.MAX_BET;
    function countBet(l) { const s = S(l); s.n++; }
    // списати кредити на утримання гри g
    function takeCr(l, amt, g) {
        const u = dbUsers[l]; if (!u || !(amt > 0) || u.bucks < amt) return false;
        u.bucks -= amt; S(l).hold.push({ g, b: amt, it: [], t: now() }); return true;
    }
    // забрати предмети (за id, з повтором) з інвентарю на утримання; equipped не чіпаємо
    function takeIt(l, ids, g) {
        const u = dbUsers[l]; if (!u || !Array.isArray(ids) || !ids.length) return false;
        const inv = u.inventory.slice();
        for (const id of ids) { const i = inv.indexOf(id); if (i < 0) return false; inv.splice(i, 1); }
        u.inventory = inv; S(l).hold.push({ g, b: 0, it: ids.slice(), t: now() }); return true;
    }
    function addCr(l, g, amt) { const s = S(l), h = s.hold.find(x => x.g === g); if (h) h.b += amt; }
    // гра завершилась — утримання для g знімаємо (ставка вже або програна, або повернулась виграшем)
    function release(l, g) { const s = S(l); if (s) s.hold = s.hold.filter(h => h.g !== g); }
    function refund(l, g, part) {
        const u = dbUsers[l], s = S(l); if (!u) return;
        s.hold.filter(h => h.g === g).forEach(h => { u.bucks += h.b; giveIt(l, h.it, true); });
        s.hold = s.hold.filter(h => h.g !== g);
        if (!part) saveUser(l);
    }
    // віддати предмети: в інвентар, а що не вміщується — у скриньку виграшу
    function giveIt(l, ids, quiet) {
        const u = dbUsers[l]; if (!u || !ids || !ids.length) return 0; const s = S(l); let box = 0;
        ids.forEach(id => { if (!MODULES[id]) return; if (u.inventory.length < SI.INV_MAX) u.inventory.push(id); else { s.prize.push(id); box++; } });
        if (box && !quiet) msg(l, '🎁 Інвентар повний: ' + box + ' предм. чекають у скриньці виграшу');
        return box;
    }
    function giveCr(l, amt) { const u = dbUsers[l]; if (u && amt > 0) u.bucks += Math.floor(amt); }
    function flushEco(l) { saveUser(l); sockOf(l).forEach(s => ctx.sendEconomy(s, l)); sendMe(l); }
    // повернення ставок ігор, яких уже немає (перезапуск сервера)
    function settleOrphans(l) {
        const s = S(l); if (!s || !s.hold.length) return;
        const dead = [...new Set(s.hold.map(h => h.g))].filter(g => !ACTIVE.has(g)); if (!dead.length) return;
        dead.forEach(g => refund(l, g, true)); saveUser(l);
        s.news.push({ t: now(), x: 'Гру було перервано (оновлення сервера) — вашу ставку повернуто.' });
    }
    function meView(l) {
        const s = S(l), u = dbUsers[l];
        return { n: s.n, max: SI.DAILY, acc: !!s.acc, lvl: lvl(l), prize: s.prize.slice(), hist: s.hist.slice(-25).reverse(), news: s.news.splice(0), lot: lotMe(l), mine: mineView(l), bucks: u.bucks };
    }
    function sendMe(l) { if (!dbUsers[l] || !sockOf(l).length) return; const v = meView(l); toLogin(l, 'stkMe', v); }      // офлайн — новини лишаються до входу

    // ================= ТРАНСЛЯЦІЯ =================
    const dirty = new Set();
    function mark(k) { dirty.add(k); }
    setInterval(() => {
        if (!dirty.size) return; const ks = [...dirty]; dirty.clear();
        ks.forEach(k => { try { io.to('stk').emit('stk_' + k, view(k)); } catch (e) { console.error('❌ stakes emit', k, e && e.message); } });
    }, 250).unref();
    function view(k) {
        if (k === 'cb') return { list: [...CB.values()].map(cbView), now: now() };
        if (k === 'cf') return { list: [...CF.values()].map(cfView), now: now() };
        if (k === 'jp') return jpView();
        if (k === 'cr') return crView();
        if (k === 'wh') return whView();
        if (k === 'lt') return ltView();
        return null;
    }

    // ================= БАТЛ КЕЙСІВ =================
    const CB = new Map(), CB_HIST = [];
    function cbView(b) {
        return { id: b.id, mode: b.mode, n: b.n, cases: b.cases, price: b.price, st: b.st, at: b.at, hash: b.hash, t0: b.t0 || 0, dur: b.dur || 0,
            slots: b.slots.map(s => s ? { l: s.l, nick: s.nick, bot: !!s.bot, lvl: s.lvl, team: s.team } : null),
            rounds: b.st !== 'open' ? b.rounds : null, elim: b.st !== 'open' ? b.elim : null, tot: b.st !== 'open' ? b.tot : null, win: b.st === 'done' || b.st === 'run' ? b.win : null,
            ss: b.st === 'done' ? b.ss : null, cs: b.cs || null };
    }
    function cbCreate(l, d) {
        const M = SI.CB.MODES[d && d.mode]; if (!M) return 'Оберіть режим';
        const n = M.n[0] === M.n[1] ? M.n[0] : int(d.n); if (!(n >= M.n[0] && n <= M.n[1])) return 'Невірна кількість гравців';
        const cases = Array.isArray(d.cases) ? d.cases.map(int).filter(c => CASES[c]) : [];
        if (!cases.length || cases.length !== d.cases.length || cases.length > SI.CB.MAX_CASES) return 'Оберіть від 1 до ' + SI.CB.MAX_CASES + ' кейсів';
        if (M.allin && cases.length < 1) return 'Оберіть кейси';
        const price = cases.reduce((s, c) => s + CASES[c].price, 0);
        if (!betOk(price)) return 'Вартість батлу має бути від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const e = canBet(l); if (e) return e;
        if ([...CB.values()].filter(b => b.st === 'open' && b.slots[0] && b.slots[0].l === l).length >= 2) return 'У вас уже є 2 відкриті батли';
        if (cbOf(l)) return 'Ви вже берете участь у батлі';
        const id = gid('cb'); if (!takeCr(l, price, id)) return 'Недостатньо кредитів';
        countBet(l); ACTIVE.add(id);
        const ss = newSeed(), b = { id, mode: d.mode, n, cases, price, st: 'open', at: now(), ss, hash: sha(ss), slots: new Array(n).fill(null) };
        b.slots[0] = { l, nick: nick(l), lvl: lvl(l), team: M.team ? 0 : null };
        CB.set(id, b); flushEco(l); mark('cb'); return null;
    }
    function cbOf(l) { for (const b of CB.values()) if (b.st !== 'done' && b.slots.some(s => s && s.l === l)) return b; return null; }
    function cbJoin(l, d) {
        const b = CB.get(d && d.id); if (!b || b.st !== 'open') return 'Батл уже почався або скасований';
        if (b.slots.some(s => s && s.l === l)) return 'Ви вже в цьому батлі';
        if (cbOf(l)) return 'Ви вже берете участь в іншому батлі';
        let i = int(d.slot); if (!(i >= 0 && i < b.n) || b.slots[i]) i = b.slots.findIndex(s => !s); if (i < 0) return 'Місць немає';
        const e = canBet(l); if (e) return e;
        if (!takeCr(l, b.price, b.id)) return 'Недостатньо кредитів';
        countBet(l);
        b.slots[i] = { l, nick: nick(l), lvl: lvl(l), team: SI.CB.MODES[b.mode].team ? (i < b.n / 2 ? 0 : 1) : null };
        flushEco(l); mark('cb');
        if (b.slots.every(Boolean)) cbStart(b);
        return null;
    }
    function cbLeave(l, d) {
        const b = CB.get(d && d.id); if (!b || b.st !== 'open') return 'Батл уже почався';
        const i = b.slots.findIndex(s => s && s.l === l); if (i < 0) return null;
        if (i === 0) {      // творець скасовує — повертаємо всім
            b.slots.forEach(s => { if (s && !s.bot) { refund(s.l, b.id); flushEco(s.l); } });
            CB.delete(b.id); ACTIVE.delete(b.id);
        } else { b.slots[i] = null; refund(l, b.id); flushEco(l); }
        mark('cb'); return null;
    }
    function cbStart(b) {
        const M = SI.CB.MODES[b.mode]; b.st = 'run';
        b.cs = b.id + ':' + b.slots.map(s => s.l || ('bot:' + s.nick)).join(',');
        const n = b.n, R = b.cases.length, rounds = [], elim = new Array(n).fill(null), alive = new Set(b.slots.map((s, i) => i)), tot = new Array(n).fill(0);
        for (let k = 0; k < R; k++) {
            const row = new Array(n).fill(null);
            alive.forEach(i => { const id = GameData.rollCase(CASES[b.cases[k]], rngOf(b.ss, b.cs, k + ':' + i)); row[i] = id; tot[i] += priceOf(id); });
            rounds.push(row);
            if (M.allin && alive.size > 1) {      // ва-банк: найдешевший дроп раунду вибуває (рівні — жереб)
                const live = [...alive], low = Math.min(...live.map(i => priceOf(row[i]))), cand = live.filter(i => priceOf(row[i]) === low);
                const out = cand[Math.floor(fl(b.ss, b.cs, 'el' + k) * cand.length)];
                alive.delete(out); elim[out] = k;
            }
            if (M.allin && alive.size === 1) break;
        }
        let win;
        if (M.team) { const t = [0, 0]; b.slots.forEach((s, i) => { t[s.team] += tot[i]; }); const wt = t[0] === t[1] ? (fl(b.ss, b.cs, 'tie') < 0.5 ? 0 : 1) : (t[0] > t[1] ? 0 : 1); win = b.slots.map((s, i) => s.team === wt ? i : -1).filter(i => i >= 0); }
        else {
            const pool = M.allin ? [...alive] : b.slots.map((s, i) => i), best = M.cheap ? Math.min(...pool.map(i => tot[i])) : Math.max(...pool.map(i => tot[i]));
            const cand = pool.filter(i => tot[i] === best); win = [cand[Math.floor(fl(b.ss, b.cs, 'tie') * cand.length)]];
        }
        b.rounds = rounds; b.elim = elim; b.tot = tot; b.win = win; b.t0 = now() + 1500; b.dur = rounds.length * SI.CB.ROUND_MS + 1200;
        mark('cb');
        setTimeout(() => cbFinish(b), b.t0 - now() + b.dur);
    }
    function cbFinish(b) {
        if (b.st !== 'run') return; b.st = 'done';
        const items = []; b.rounds.forEach(row => row.forEach(id => { if (id) items.push(id); }));
        const winners = b.win.map(i => b.slots[i]).filter(s => !s.bot);
        // ва-банк: невідкриті кейси повертаються кожному гравцю кредитами
        const opened = new Array(b.n).fill(0); b.rounds.forEach(row => row.forEach((id, i) => { if (id) opened[i]++; }));
        b.slots.forEach((s, i) => { if (s.bot) return; let back = 0; for (let k = opened[i]; k < b.cases.length; k++) back += CASES[b.cases[k]].price; if (back) giveCr(s.l, back); });
        if (winners.length) {      // предмети ділимо між переможцями (2×2) — по черзі від найдорожчого тому, у кого зараз менше
            const share = winners.map(() => ({ ids: [], v: 0 }));
            items.sort((a, c) => priceOf(c) - priceOf(a)).forEach(id => { let k = 0; share.forEach((x, j) => { if (x.v < share[k].v) k = j; }); share[k].ids.push(id); share[k].v += priceOf(id); });
            winners.forEach((w, j) => { giveIt(w.l, share[j].ids); });
        }
        const total = items.reduce((s, id) => s + priceOf(id), 0);
        b.slots.forEach((s, i) => {
            if (s.bot) return; release(s.l, b.id);
            const w = b.win.includes(i);
            hist(s.l, 'cb', w ? total - b.price : -b.price, (w ? 'Перемога' : 'Поразка') + ' · ' + b.mode);
            flushEco(s.l);
        });
        ACTIVE.delete(b.id); mark('cb');
        CB_HIST.unshift(cbView(b)); if (CB_HIST.length > 20) CB_HIST.length = 20;
        setTimeout(() => { CB.delete(b.id); mark('cb'); }, 45000);
    }
    function cbTick() {
        const t = now();
        for (const b of CB.values()) {
            if (b.st !== 'open') continue;
            if (t - b.at > SI.CB.TTL) { b.slots.forEach(s => { if (s && !s.bot) { refund(s.l, b.id); flushEco(s.l); msg(s.l, 'Батл ніхто не заповнив — кредити повернуто'); } }); CB.delete(b.id); ACTIVE.delete(b.id); mark('cb'); continue; }
            const M = SI.CB.MODES[b.mode];
            if (M.bot && t - b.at > SI.CB.BOT_AFTER && b.slots.filter(Boolean).length === b.n - 1) {
                const i = b.slots.findIndex(s => !s);
                let bn = 'Bot'; try { bn = ctx.Bots && ctx.Bots.freshName ? ctx.Bots.freshName() : 'Bot' + Math.floor(Math.random() * 900 + 100); } catch (e) {}
                b.slots[i] = { l: null, nick: bn, lvl: 3 + Math.floor(Math.random() * 10), bot: true, team: null };
                cbStart(b);
            }
        }
    }

    // ================= КОЙНФЛІП =================
    const CF = new Map(), CF_HIST = [];
    const valOf = ids => ids.reduce((s, id) => s + priceOf(id), 0);
    function cfView(f) {
        const side = x => x ? { l: x.l, nick: x.nick, lvl: x.lvl, items: x.items, val: x.val, side: x.side } : null;
        return { id: f.id, st: f.st, at: f.at, hash: f.hash, a: side(f.a), b: side(f.b), t0: f.t0 || 0, r: f.st !== 'open' ? f.r : null, win: f.st !== 'open' ? f.win : null, ss: f.st === 'done' ? f.ss : null, cs: f.cs || null };
    }
    function cleanIds(arr) { return Array.isArray(arr) && arr.length >= 1 && arr.length <= SI.CF.MAX_ITEMS && arr.every(id => typeof id === 'string' && MODULES[id]) ? arr.slice() : null; }
    const feeOf = v => Math.ceil(v * SI.FEE);
    function cfCreate(l, d, sock) {
        const ids = cleanIds(d && d.items); if (!ids) return 'Оберіть від 1 до ' + SI.CF.MAX_ITEMS + ' предметів';
        const v = valOf(ids); if (!betOk(v)) return 'Вартість ставки має бути від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const e = canBet(l); if (e) return e;
        if ([...CF.values()].filter(f => f.st === 'open' && f.a.l === l).length >= 3) return 'У вас уже 3 відкриті койнфліпи';
        const u = dbUsers[l], fee = feeOf(v); if (u.bucks < fee) return 'Потрібно ' + fee + ' кредитів на комісію (5%)';
        const id = gid('cf'); if (!takeIt(l, ids, id)) return 'Цих предметів уже немає в інвентарі';
        takeCr(l, fee, id); countBet(l); ACTIVE.add(id);
        const ss = newSeed(); CF.set(id, { id, st: 'open', at: now(), ss, hash: sha(ss), a: { l, nick: nick(l), lvl: lvl(l), items: ids, val: v, side: d.side === 'o' ? 'o' : 'b', ip: ipOf.get(sock.id) || '' }, b: null });
        flushEco(l); mark('cf'); return null;
    }
    function cfJoin(l, d, sock) {
        const f = CF.get(d && d.id); if (!f || f.st !== 'open') return 'Цей койнфліп уже зіграно';
        if (f.a.l === l) return 'Це ваш койнфліп';
        const ids = cleanIds(d.items); if (!ids) return 'Оберіть предмети';
        const v = valOf(ids); if (Math.abs(v - f.a.val) > SI.CF.DIFF) return 'Сума ваших предметів має бути в межах ±' + SI.CF.DIFF + ' від ' + f.a.val;
        if (!betOk(v)) return 'Вартість ставки має бути від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const ip = ipOf.get(sock.id) || ''; if (ip && ip === f.a.ip) return 'Не можна грати проти акаунта з тієї ж мережі';
        const e = canBet(l); if (e) return e;
        const u = dbUsers[l], fee = feeOf(v); if (u.bucks < fee) return 'Потрібно ' + fee + ' кредитів на комісію (5%)';
        if (!takeIt(l, ids, f.id)) return 'Цих предметів уже немає в інвентарі';
        takeCr(l, fee, f.id); countBet(l);
        f.b = { l, nick: nick(l), lvl: lvl(l), items: ids, val: v, side: f.a.side === 'b' ? 'o' : 'b' };
        f.cs = f.id + ':' + f.a.l + ':' + l; f.r = fl(f.ss, f.cs, 'flip'); f.win = f.r < f.a.val / (f.a.val + v) ? 'a' : 'b';
        f.st = 'run'; f.t0 = now() + 600;
        flushEco(l); mark('cf');
        setTimeout(() => cfFinish(f), 600 + SI.CF.SPIN_MS);
        return null;
    }
    function cfFinish(f) {
        if (f.st !== 'run') return; f.st = 'done';
        const W = f[f.win], L = f[f.win === 'a' ? 'b' : 'a'], all = f.a.items.concat(f.b.items);
        giveIt(W.l, all);
        [f.a, f.b].forEach(x => { release(x.l, f.id); hist(x.l, 'cf', x === W ? L.val - feeOf(x.val) : -x.val - feeOf(x.val), x === W ? 'Перемога' : 'Поразка'); flushEco(x.l); });
        ACTIVE.delete(f.id); mark('cf'); CF_HIST.unshift(cfView(f)); if (CF_HIST.length > 20) CF_HIST.length = 20;
        setTimeout(() => { CF.delete(f.id); mark('cf'); }, 30000);
    }
    function cfCancel(l, d) {
        const f = CF.get(d && d.id); if (!f || f.st !== 'open' || f.a.l !== l) return 'Скасувати не можна';
        refund(l, f.id); CF.delete(f.id); ACTIVE.delete(f.id); flushEco(l); mark('cf'); return null;
    }
    function cfTick() { const t = now(); for (const f of CF.values()) if (f.st === 'open' && t - f.at > SI.CF.TTL) { refund(f.a.l, f.id); flushEco(f.a.l); msg(f.a.l, 'Ваш койнфліп ніхто не прийняв — предмети повернуто'); CF.delete(f.id); ACTIVE.delete(f.id); mark('cf'); } }

    // ================= ДЖЕКПОТ =================
    let JP = null; const JP_HIST = [];
    function jpNew() { const ss = newSeed(); JP = { id: gid('jp'), ss, hash: sha(ss), deps: [], total: 0, endAt: 0, st: 'open', first: 0 }; ACTIVE.add(JP.id); mark('jp'); }
    function jpPlayers() { const m = new Map(); JP.deps.forEach(d => { const x = m.get(d.l) || { l: d.l, nick: d.nick, lvl: d.lvl, amt: 0 }; x.amt += d.amt; m.set(d.l, x); }); return [...m.values()]; }
    function jpView() { return { id: JP.id, st: JP.st, hash: JP.hash, total: JP.total, endAt: JP.endAt, players: jpPlayers(), r: JP.r == null ? null : JP.r, win: JP.win || null, spinAt: JP.spinAt || 0, ss: JP.st === 'done' ? JP.ss : null, hist: JP_HIST.slice(0, 8), now: now() }; }
    function jpBet(l, d) {
        if (JP.st !== 'open') return 'Зачекайте наступного раунду';
        const a = int(d && d.amt); if (!betOk(a)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const ps = jpPlayers(), me = ps.find(p => p.l === l);
        if ((me ? me.amt : 0) + a > SI.JP.MAX_PLAYER) return 'У джекпоті не більше ' + SI.JP.MAX_PLAYER + ' кредитів від одного гравця';
        if (!me && ps.length >= SI.JP.MAX_PLAYERS) return 'Котел заповнено, зачекайте наступного раунду';
        const e = canBet(l); if (e) return e;
        const u = dbUsers[l]; if (u.bucks < a) return 'Недостатньо кредитів';
        u.bucks -= a; const s = S(l), h = s.hold.find(x => x.g === JP.id); if (h) h.b += a; else s.hold.push({ g: JP.id, b: a, it: [], t: now() });
        countBet(l);
        JP.deps.push({ l, nick: nick(l), lvl: lvl(l), amt: a }); JP.total += a; if (!JP.first) JP.first = now();
        if (!JP.endAt && jpPlayers().length >= 2) JP.endAt = now() + SI.JP.MS;
        flushEco(l); mark('jp'); return null;
    }
    function jpTick() {
        const t = now();
        if (JP.st === 'open' && JP.endAt && t >= JP.endAt) {
            const ps = jpPlayers(); JP.cs = JP.id + ':' + ps.map(p => p.l).join(','); JP.r = fl(JP.ss, JP.cs, 'win');
            let x = JP.r * JP.total, w = ps[ps.length - 1]; for (const p of ps) { x -= p.amt; if (x < 0) { w = p; break; } }
            JP.win = { l: w.l, nick: w.nick, amt: Math.floor(JP.total * (1 - SI.FEE)), ch: Math.round(w.amt / JP.total * 1000) / 10 };
            JP.st = 'spin'; JP.spinAt = t; mark('jp');
            const J = JP; setTimeout(() => jpFinish(J), SI.JP.SPIN_MS);
        } else if (JP.st === 'open' && !JP.endAt && JP.first && t - JP.first > SI.JP.IDLE) {      // довго один у котлі — повертаємо
            jpPlayers().forEach(p => { refund(p.l, JP.id); flushEco(p.l); msg(p.l, 'Суперників для джекпоту не знайшлось — ставку повернуто'); });
            ACTIVE.delete(JP.id); jpNew();
        }
    }
    function jpFinish(J) {
        if (J.st !== 'spin') return; J.st = 'done';
        const players = (() => { const m = new Map(); J.deps.forEach(d => { const x = m.get(d.l) || { l: d.l, amt: 0 }; x.amt += d.amt; m.set(d.l, x); }); return [...m.values()]; })();
        giveCr(J.win.l, J.win.amt);
        players.forEach(p => { release(p.l, J.id); hist(p.l, 'jp', p.l === J.win.l ? J.win.amt - p.amt : -p.amt, p.l === J.win.l ? 'Джекпот ' + J.total : 'Джекпот'); flushEco(p.l); });
        JP_HIST.unshift({ id: J.id, nick: J.win.nick, amt: J.win.amt, ch: J.win.ch, total: J.total, hash: J.hash, ss: J.ss, cs: J.cs, r: J.r }); if (JP_HIST.length > 20) JP_HIST.length = 20;
        mark('jp'); ACTIVE.delete(J.id);
        setTimeout(() => { if (JP === J) jpNew(); }, 2500);
    }

    // ================= КРАШ =================
    let CR = null; const CR_HIST = [];
    function crNew() { const ss = newSeed(); CR = { id: gid('cr'), ss, hash: sha(ss), st: 'bet', betEnd: now() + SI.CR.BET_MS, bets: new Map() }; ACTIVE.add(CR.id); mark('cr'); }
    function crView() {
        return { id: CR.id, st: CR.st, hash: CR.hash, betEnd: CR.betEnd, t0: CR.t0 || 0, point: CR.st === 'crash' ? CR.point : null, ss: CR.st === 'crash' ? CR.ss : null, now: now(),
            bets: [...CR.bets.values()].map(b => ({ l: b.l, nick: b.nick, amt: b.amt, auto: b.auto || 0, out: b.out || 0 })), hist: CR_HIST.slice(0, 14) };
    }
    function crBet(l, d) {
        if (CR.st !== 'bet') return 'Ставки приймаються до старту раунду';
        if (CR.bets.has(l)) return 'Ви вже зробили ставку в цьому раунді';
        const a = int(d && d.amt); if (!betOk(a)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        let auto = Math.floor((+d.auto || 0) * 100) / 100; if (!(auto >= 1.01)) auto = 0; if (auto > SI.CR.MAX) auto = SI.CR.MAX;
        const e = canBet(l); if (e) return e;
        if (!takeCr(l, a, CR.id)) return 'Недостатньо кредитів';
        countBet(l); CR.bets.set(l, { l, nick: nick(l), amt: a, auto, out: 0 });
        flushEco(l); mark('cr'); return null;
    }
    function crCash(l, at) {
        const b = CR.bets.get(l); if (!b || b.out || CR.st !== 'run') return false;
        b.out = at; giveCr(l, Math.floor(b.amt * at)); release(l, CR.id); hist(l, 'cr', Math.floor(b.amt * at) - b.amt, '×' + at.toFixed(2)); flushEco(l); mark('cr'); return true;
    }
    function crOut(l) {
        if (CR.st !== 'run') return 'Раунд ще не почався або вже закінчився';
        const t = now(); if (t >= CR.crashT) return 'Запізно — вже вибухнуло!';
        const m = SI.crashAt(t - CR.t0); if (!crCash(l, Math.min(m, CR.point))) return 'Немає активної ставки';
        return null;
    }
    function crTick() {
        const t = now();
        if (CR.st === 'bet' && t >= CR.betEnd) {
            CR.cs = CR.id; CR.point = SI.crashPoint(fl(CR.ss, CR.cs, 'crash'));
            CR.st = 'run'; CR.t0 = t; CR.crashT = t + SI.crashTime(CR.point); mark('cr');
        }
        if (CR.st === 'run') {
            const m = SI.crashAt(t - CR.t0);
            CR.bets.forEach(b => { if (!b.out && b.auto && b.auto <= CR.point && m >= b.auto) crCash(b.l, b.auto); });
            if (t >= CR.crashT) {
                CR.st = 'crash';
                CR.bets.forEach(b => { if (!b.out) { release(b.l, CR.id); hist(b.l, 'cr', -b.amt, 'Вибух ×' + CR.point.toFixed(2)); flushEco(b.l); } });
                CR_HIST.unshift({ id: CR.id, p: CR.point, hash: CR.hash, ss: CR.ss }); if (CR_HIST.length > 30) CR_HIST.length = 30;
                ACTIVE.delete(CR.id); mark('cr');
                setTimeout(crNew, SI.CR.PAUSE_MS);
            }
        }
    }

    // ================= КОЛЕСО =================
    let WH = null; const WH_HIST = [];
    function whNew() { const ss = newSeed(), t = now(); WH = { id: gid('wh'), ss, hash: sha(ss), st: 'bet', start: t, spinAt: t + SI.WH.CYCLE - SI.WH.SPIN, bets: new Map() }; ACTIVE.add(WH.id); mark('wh'); }
    function whView() {
        const tot = {}; SI.WH.SECT.forEach(s => tot[s.id] = 0); const list = [];
        WH.bets.forEach(b => { Object.keys(b.s).forEach(k => { tot[k] += b.s[k]; list.push({ nick: b.nick, k, amt: b.s[k] }); }); });
        return { id: WH.id, st: WH.st, hash: WH.hash, spinAt: WH.spinAt, idx: WH.st !== 'bet' ? WH.idx : null, ss: WH.st === 'done' ? WH.ss : null, tot, list: list.slice(-60), hist: WH_HIST.slice(0, 20), now: now() };
    }
    function whBet(l, d) {
        if (WH.st !== 'bet' || now() > WH.spinAt - 300) return 'Ставки на цей оберт закрито';
        const k = d && d.sect, a = int(d && d.amt); if (!SI.sect(k)) return 'Оберіть сектор';
        if (!betOk(a)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const b = WH.bets.get(l) || { l, nick: nick(l), s: {} };
        if ((b.s[k] || 0) + a > SI.MAX_BET) return 'На один сектор не більше ' + SI.MAX_BET;
        const e = canBet(l); if (e) return e;
        const u = dbUsers[l]; if (u.bucks < a) return 'Недостатньо кредитів';
        u.bucks -= a; const s = S(l), h = s.hold.find(x => x.g === WH.id); if (h) h.b += a; else s.hold.push({ g: WH.id, b: a, it: [], t: now() });
        countBet(l); b.s[k] = (b.s[k] || 0) + a; WH.bets.set(l, b);
        flushEco(l); mark('wh'); return null;
    }
    function whTick() {
        const t = now();
        if (WH.st === 'bet' && t >= WH.spinAt) { WH.st = 'spin'; WH.idx = Math.floor(fl(WH.ss, WH.id, 'spin') * SI.wheel.length); mark('wh'); }
        else if (WH.st === 'spin' && t >= WH.spinAt + SI.WH.SPIN) {
            WH.st = 'done'; const k = SI.wheel[WH.idx], m = SI.sect(k).m;
            WH.bets.forEach(b => {
                const stake = Object.values(b.s).reduce((x, y) => x + y, 0), win = b.s[k] ? b.s[k] * m : 0;
                giveCr(b.l, win); release(b.l, WH.id); hist(b.l, 'wh', win - stake, '×' + m + (win ? ' виграш' : '')); flushEco(b.l);
            });
            WH_HIST.unshift({ id: WH.id, k, hash: WH.hash, ss: WH.ss }); if (WH_HIST.length > 40) WH_HIST.length = 40;
            ACTIVE.delete(WH.id); mark('wh');
            setTimeout(whNew, 1500);
        }
    }

    // ================= МІННЕ ПОЛЕ =================
    const MN = new Map();      // login → гра
    function mineView(l) {
        const g = MN.get(l); if (!g) return null;
        return { id: g.id, m: g.m, amt: g.amt, open: [...g.open], st: g.st, hash: g.hash, mines: g.st !== 'play' ? g.mines : null, boom: g.st === 'boom' ? g.boom : null, ss: g.st !== 'play' ? g.ss : null, cs: g.cs, mult: SI.minesMult(g.m, g.open.size), next: SI.minesMult(g.m, g.open.size + 1) };
    }
    function mnNew(l, d) {
        const old = MN.get(l); if (old && old.st === 'play') return 'Спершу завершіть поточну гру';
        const a = int(d && d.amt), m = int(d && d.m); if (!betOk(a)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        if (SI.MN.MINES.indexOf(m) < 0) return 'Оберіть кількість мін';
        const e = canBet(l); if (e) return e;
        const id = gid('mn'); if (!takeCr(l, a, id)) return 'Недостатньо кредитів';
        countBet(l); ACTIVE.add(id);
        const ss = newSeed(), cs = id + ':' + l, r = rngOf(ss, cs, 'm'), cells = []; for (let i = 0; i < SI.MN.N; i++) cells.push(i);
        for (let i = cells.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = cells[i]; cells[i] = cells[j]; cells[j] = x; }
        MN.set(l, { id, l, amt: a, m, ss, cs, hash: sha(ss), mines: cells.slice(0, m).sort((x, y) => x - y), open: new Set(), st: 'play' });
        flushEco(l); return null;
    }
    function mnPick(l, d) {
        const g = MN.get(l); if (!g || g.st !== 'play') return 'Немає активної гри';
        const i = int(d && d.i); if (!(i >= 0 && i < SI.MN.N) || g.open.has(i)) return null;
        if (g.mines.indexOf(i) >= 0) { g.st = 'boom'; g.boom = i; release(l, g.id); ACTIVE.delete(g.id); hist(l, 'mn', -g.amt, 'Міна · ' + g.m); flushEco(l); return null; }
        g.open.add(i);
        if (g.open.size >= SI.MN.N - g.m) return mnCash(l);
        sendMe(l); return null;
    }
    function mnCash(l) {
        const g = MN.get(l); if (!g || g.st !== 'play') return 'Немає активної гри'; if (!g.open.size) return 'Відкрийте хоча б одну клітинку';
        const mult = SI.minesMult(g.m, g.open.size), win = Math.floor(g.amt * mult);
        g.st = 'cash'; giveCr(l, win); release(l, g.id); ACTIVE.delete(g.id); hist(l, 'mn', win - g.amt, '×' + mult.toFixed(2)); flushEco(l); return null;
    }

    // ================= КОНТРАКТ =================
    function ctDo(l, d, sock) {
        const ids = Array.isArray(d && d.items) ? d.items : null; if (!ids || ids.length !== SI.CT.NEED || !ids.every(id => typeof id === 'string' && MODULES[id])) return 'Потрібно рівно ' + SI.CT.NEED + ' предметів';
        const rar = MODULES[ids[0]].rarity; if (!ids.every(id => MODULES[id].rarity === rar)) return 'Усі предмети мають бути однієї рідкості';
        const ri = GameData.RARITY_ORDER.indexOf(rar); if (ri < 0 || ri >= GameData.RARITY_ORDER.length - 1) return 'Міфічні предмети не обмінюються';
        const u = dbUsers[l], inv = u.inventory.slice(); for (const id of ids) { const i = inv.indexOf(id); if (i < 0) return 'Цих предметів уже немає в інвентарі'; inv.splice(i, 1); }
        const next = GameData.RARITY_ORDER[ri + 1], pool = Object.keys(MODULES).filter(id => MODULES[id].rarity === next);
        const out = pool[crypto.randomInt(pool.length)];
        u.inventory = inv; u.inventory.push(out); hist(l, 'ct', priceOf(out) - valOf(ids), MODULES[out].name);
        flushEco(l); sock.emit('stkCtRes', { mod: out, from: rar }); return null;
    }

    // ================= ЛОТЕРЕЯ =================
    let LT = { done: [], last: null, loaded: false };
    function metaCol() { const db = ctx.getDb && ctx.getDb(); return db ? db.collection('meta') : null; }
    function ltLoad() { if (LT.loaded) return; const c = metaCol(); if (!c) return; LT.loaded = true; c.findOne({ _id: 'lottery' }).then(d => { if (d) { LT.done = Array.isArray(d.done) ? d.done : []; LT.last = d.last || null; } mark('lt'); }).catch(() => { LT.loaded = false; }); }
    function ltSave() { const c = metaCol(); if (c) c.replaceOne({ _id: 'lottery' }, { _id: 'lottery', done: LT.done.slice(-30), last: LT.last }, { upsert: true }).catch(e => console.error('❌ lottery save', e.message)); }
    let ltCache = null, ltAt = 0;
    function ltPool() {
        const t = now(); if (ltCache && t - ltAt < 5000) return ltCache;
        const d = SI.drawId(t); let n = 0, p = 0; for (const l in dbUsers) { const x = dbUsers[l].stk && dbUsers[l].stk.lot; if (x && x.d === d && x.n > 0) { n += x.n; p++; } }
        ltCache = { d, n, p, pool: n * SI.LT.PRICE }; ltAt = t; return ltCache;
    }
    function ltView() { const P = ltPool(); return { d: P.d, at: SI.nextDraw(now()), tickets: P.n, players: P.p, pool: P.pool, last: LT.last, now: now() }; }
    function lotMe(l) { const s = S(l), x = s.lot, d = SI.drawId(now()); return { n: x && x.d === d ? x.n | 0 : 0 }; }
    function ltBuy(l, d) {
        const n = int(d && d.n); if (!(n >= 1 && n <= SI.LT.MAX)) return 'Від 1 до ' + SI.LT.MAX + ' квитків';
        const u = dbUsers[l]; if (!u) return 'Помилка'; if (lvl(l) < SI.MIN_LEVEL) return 'Лотерея відкривається з ' + SI.MIN_LEVEL + ' рівня';
        const s = S(l); if (!s.acc) return 'Спершу прийміть правила Арени ставок';
        const dd = SI.drawId(now()); if (!s.lot || s.lot.d !== dd) s.lot = { d: dd, n: 0 };
        if (s.lot.n + n > SI.LT.MAX) return 'Не більше ' + SI.LT.MAX + ' квитків на один розіграш';
        const cost = n * SI.LT.PRICE; if (u.bucks < cost) return 'Недостатньо кредитів';
        u.bucks -= cost; s.lot.n += n; hist(l, 'lt', -cost, n + ' квит.');
        ltCache = null; flushEco(l); mark('lt'); return null;
    }
    function ltDraw(d) {
        if (LT.done.indexOf(d) >= 0) return;
        const rows = []; for (const l in dbUsers) { const x = dbUsers[l].stk && dbUsers[l].stk.lot; if (x && x.d === d && x.n > 0) rows.push({ l, n: x.n | 0 }); }
        rows.sort((a, b) => a.l < b.l ? -1 : 1);
        const T = rows.reduce((s, r) => s + r.n, 0), pool = T * SI.LT.PRICE, ss = newSeed(), cs = 'lot:' + d, winners = [];
        let left = rows.slice();
        for (let k = 0; k < SI.LT.SHARES.length && left.length; k++) {
            const tot = left.reduce((s, r) => s + r.n, 0); let x = fl(ss, cs, 'w' + k) * tot, w = left[left.length - 1];
            for (const r of left) { x -= r.n; if (x < 0) { w = r; break; } }
            left = left.filter(r => r !== w);
            const cr = Math.floor(pool * SI.LT.SHARES[k]); let mod = null;
            if (k === 0) { const myth = Object.keys(MODULES).filter(id => MODULES[id].rarity === 'mythic'); mod = myth[Math.floor(fl(ss, cs, 'mod') * myth.length)]; }
            giveCr(w.l, cr); if (mod) giveIt(w.l, [mod], true);
            const s = S(w.l); s.news.push({ t: now(), x: '🎟 Лотерея ' + d + ': ви посіли ' + (k + 1) + ' місце! +' + cr + ' кредитів' + (mod ? ' і ' + MODULES[mod].name : '') });
            hist(w.l, 'lt', cr, (k + 1) + ' місце');
            saveUser(w.l); sockOf(w.l).forEach(sid => ctx.sendEconomy(sid, w.l)); sendMe(w.l);
            winners.push({ place: k + 1, nick: nick(w.l), cr, mod, n: w.n });
        }
        LT.done.push(d); LT.last = { d, T, pool, winners, hash: sha(ss), ss, cs, players: rows.length };
        ltSave(); ltCache = null; mark('lt');
        if (winners.length) io.to('stk').emit('stkMsgAll', { t: '🎟 Розіграш лотереї: переможець — ' + winners[0].nick + '!' });
    }
    let ltCur = SI.drawId(now());
    function ltTick() {
        ltLoad();
        const d = SI.drawId(now());
        if (d !== ltCur) { const prev = ltCur; ltCur = d; if (!metaCol() || LT.loaded) ltDraw(prev); }
        // пропущені розіграші (сервер не працював у момент розіграшу) — перевіряємо раз на хвилину
        if ((!metaCol() || LT.loaded) && now() - (ltTick.at || 0) > 60000) { ltTick.at = now(); const pend = new Set(); for (const l in dbUsers) { const x = dbUsers[l].stk && dbUsers[l].stk.lot; if (x && x.d && x.d < d && LT.done.indexOf(x.d) < 0 && x.n > 0) pend.add(x.d); } [...pend].sort().forEach(ltDraw); }
    }

    // ================= ДУЕЛІ =================
    const INV = new Map(), pairs = new Map(), ipOf = new Map();
    const pairKey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    function pairCount(a, b) { const k = pairKey(a, b), arr = (pairs.get(k) || []).filter(t => now() - t < 864e5); pairs.set(k, arr); return arr.length; }
    function roomOf(l) { for (const id in rooms) for (const p in rooms[id].players) if (rooms[id].players[p].name === l) return rooms[id]; return null; }
    function duCheck(a, b, stake) {
        if (!ctx.Social || !ctx.Social.areFriends(a, b)) return 'Дуель можлива лише з другом';
        if (!sockOf(b).length) return 'Друг зараз не в мережі';
        for (const l of [a, b]) {
            if (lvl(l) < SI.MIN_LEVEL) return (l === a ? 'Дуелі відкриваються з ' : 'Ваш друг ще не має ') + SI.MIN_LEVEL + ' рівня';
            if (roomOf(l)) return l === a ? 'Спершу вийдіть із поточної сесії' : 'Друг зараз у сесії або в бою';
            if (ctx.hooks.inRankedQueue && ctx.hooks.inRankedQueue(l)) return l === a ? 'Ви в черзі рейтингу' : 'Друг шукає рейтинговий бій';
            if ((dbUsers[l].bucks | 0) < stake) return l === a ? 'Недостатньо кредитів для ставки' : 'У друга недостатньо кредитів для такої ставки';
        }
        if (pairCount(a, b) >= SI.DU.PAIR_MAX) return 'З цим другом сьогодні вже зіграно ' + SI.DU.PAIR_MAX + ' дуелі. Спробуйте завтра';
        const ia = sockOf(a).map(s => ipOf.get(s)).filter(Boolean), ib = sockOf(b).map(s => ipOf.get(s)).filter(Boolean);
        if (ia.some(x => ib.indexOf(x) >= 0)) return 'Дуелі між акаунтами з однієї мережі заборонені';
        return null;
    }
    function duInvite(l, d) {
        const to = typeof (d && d.to) === 'string' ? d.to : ''; if (!dbUsers[to] || to === l) return 'Гравця не знайдено';
        const stake = int(d.stake); if (!betOk(stake)) return 'Ставка від ' + SI.MIN_BET + ' до ' + SI.MAX_BET;
        const map = SI.DU.MAPS.indexOf(d.map) >= 0 && ctx.MAP_DATA[d.map] ? d.map : null; if (!map) return 'Оберіть арену';
        const rounds = SI.DU.ROUNDS.indexOf(int(d.rounds)) >= 0 ? int(d.rounds) : null, time = SI.DU.TIMES.indexOf(int(d.time)) >= 0 ? int(d.time) : null;
        if (!rounds || !time) return 'Оберіть кількість раундів і час';
        const e = canBet(l) || duCheck(l, to, stake); if (e) return e;
        for (const v of INV.values()) if (pairKey(v.a, v.b) === pairKey(l, to)) return 'Виклик цьому другу вже надіслано';
        const id = gid('du'), inv = { id, a: l, b: to, stake, map, rounds, time, at: now() };
        INV.set(id, inv);
        toLogin(to, 'stkDuInv', { id, from: l, nick: nick(l), lvl: lvl(l), stake, map, rounds, time, ttl: SI.DU.INVITE_MS });
        msg(l, '⚔ Виклик надіслано. Чекаємо на відповідь друга…');
        setTimeout(() => { if (INV.get(id) === inv) { INV.delete(id); msg(l, 'Друг не відповів на виклик'); toLogin(to, 'stkDuGone', { id }); } }, SI.DU.INVITE_MS);
        return null;
    }
    function duAnswer(l, d, sock) {
        const inv = INV.get(d && d.id); if (!inv || inv.b !== l) return 'Виклик уже неактуальний';
        INV.delete(inv.id);
        if (!d.ok) { msg(inv.a, nick(l) + ' відхилив(-ла) виклик на дуель'); return null; }
        const e = canBet(l) || canBet(inv.a) || duCheck(inv.a, l, inv.stake); if (e) { msg(inv.a, 'Дуель не відбулась: ' + e, true); return e; }
        const sa = sockOf(inv.a)[0], sb = sock.id; if (!sa) return 'Суперник вийшов з гри';
        const id = inv.id; if (!takeCr(inv.a, inv.stake, id)) return 'У суперника недостатньо кредитів';
        if (!takeCr(l, inv.stake, id)) { refund(inv.a, id); return 'Недостатньо кредитів'; }
        countBet(inv.a); countBet(l); ACTIVE.add(id); pairs.set(pairKey(inv.a, l), (pairs.get(pairKey(inv.a, l)) || []).concat(now()));
        const t = now(), rid = 'du_' + t + '_' + Math.floor(Math.random() * 1e5);
        const r = {
            id: rid, hostName: inv.a, hostSocket: sa, mode: 'rounds', map: inv.map, maxPlayers: 2, du: inv.stake,
            winScore: 50, hideTime: 30, seekTime: 120, hunterCount: 1, tdmTeams: 2, tdmTime: 180, tdmScore: 20, tdmAutoBalance: true,
            status: 'lobby', state: 'waiting', phaseEndTime: 0, players: {}, powerups: {}, tokens: {}, zombies: {}, mines: {}, wave: 1, nextWaveTime: 0, lastPowerupSpawn: t
        };
        Object.defineProperty(r, 'duel', { value: { id, a: inv.a, b: l, stake: inv.stake, done: false }, enumerable: false, writable: true });
        Object.defineProperty(r, '_spawnFix', { value: duelSpawns(inv.map), enumerable: false, writable: true });
        r.mpPref = 2; ctx.Modes.readSettings(r, { rdRounds: inv.rounds, rdTime: inv.time, rdDraw: false, tdmAutoBalance: true });
        rooms[rid] = r;
        [[sa, inv.a, 'red'], [sb, l, 'blue']].forEach(([sid, login, team]) => { const s = io.sockets.sockets.get(sid); if (s) s.join(rid); const p = ctx.newPlayerEntry(sid, login); p.team = team; p.color = team; p.ready = true; r.players[sid] = p; });
        [sa, sb].forEach(sid => io.to(sid).emit('stkDuGo', { roomId: rid, roomData: r, stake: inv.stake }));
        flushEco(inv.a); flushEco(l);
        if (!ctx.startRoomGame(rid, m => console.warn('duel start:', m))) {
            Object.keys(r.players).forEach(pid => { const s = io.sockets.sockets.get(pid); if (s) s.leave(rid); });
            delete rooms[rid]; [inv.a, l].forEach(x => { refund(x, id); flushEco(x); msg(x, 'Не вдалося запустити дуель — ставку повернуто', true); toLogin(x, 'stkDuFail', {}); });
            ACTIVE.delete(id);
        }
        return null;
    }
    // бази суперників на арені: дві досяжні вільні точки якнайдалі одна від одної (але не більше ~1500 px — щоб раунд не перетворювався на пошуки)
    const spCache = new Map();
    function duelSpawns(mapName) {
        if (spCache.has(mapName)) return spCache.get(mapName);
        let out = null;
        try {
            const m = ctx.MAP_DATA[mapName], Nav = ctx.Nav, g = Nav.getGrid(m, 30), sp = m.solids.find(o => o.type === 'spawn_player'); if (!sp) return null;
            const f = Nav.buildField(g, sp.x, sp.y), pts = [];
            for (let i = 0; i < f.dist.length; i += 3) { if (f.dist[i] < 0) continue; const x = (i % g.N + 0.5) * Nav.CS, y = (Math.floor(i / g.N) + 0.5) * Nav.CS; if (!ctx.MapObj.collides(m, x, y, 44)) pts.push({ x, y }); }
            let best = -1;
            for (let a = 0; a < pts.length; a += 2) for (let b = a + 1; b < pts.length; b += 2) { const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); if (d <= 1500 && d > best) { best = d; out = { red: pts[a], blue: pts[b] }; } }
        } catch (e) { console.error('❌ duel spawns', e && e.message); }
        spCache.set(mapName, out); return out;
    }
    function duPay(r, winLogin, why) {
        const D = r.duel; if (!D || D.done) return; D.done = true;
        const lose = winLogin === D.a ? D.b : D.a, prize = Math.floor(D.stake * 2 * (1 - SI.FEE));
        giveCr(winLogin, prize);
        [D.a, D.b].forEach(x => { release(x, D.id); hist(x, 'du', x === winLogin ? prize - D.stake : -D.stake, (x === winLogin ? 'Перемога' : 'Поразка') + ' · ' + nick(x === D.a ? D.b : D.a)); flushEco(x); });
        ACTIVE.delete(D.id);
        [D.a, D.b].forEach(x => toLogin(x, 'stkDuRes', { win: x === winLogin, prize, stake: D.stake, vs: nick(x === D.a ? D.b : D.a), why: why || '' }));
    }
    Events.on('matchEnd', ev => {
        try {
            const r = ev && rooms[ev.roomId]; if (!r || !r.duel || r.duel.done) return;
            const w = ev.players.find(p => p.outcome === 'win'); if (w) duPay(r, w.name, '');
            else { [r.duel.a, r.duel.b].forEach(x => { refund(x, r.duel.id); flushEco(x); }); r.duel.done = true; ACTIVE.delete(r.duel.id); }
        } catch (e) { console.error('❌ duel matchEnd', e && e.stack || e); }
    });
    ctx.hooks.duelLeave = function (r, left) {
        if (!r.duel || r.duel.done || r.status !== 'playing' || !left) return;
        const other = left.name === r.duel.a ? r.duel.b : r.duel.a;
        duPay(r, other, 'leave');
    };

    // ================= СКРИНЬКА ВИГРАШУ =================
    function prizeAct(l, d) {
        const u = dbUsers[l], s = S(l), i = int(d && d.i), id = s.prize[i]; if (!id) return 'Предмет не знайдено';
        if (d.act === 'sell') { s.prize.splice(i, 1); u.bucks += priceOf(id); hist(l, 'box', priceOf(id), 'Продано ' + MODULES[id].name); }
        else if (d.act === 'take') { if (u.inventory.length >= SI.INV_MAX) return 'Інвентар повний — продайте або замініть предмет'; s.prize.splice(i, 1); u.inventory.push(id); }
        else if (d.act === 'swap') {
            const j = int(d.with); const old = u.inventory[j]; if (!old) return 'Оберіть предмет з інвентарю';
            s.prize.splice(i, 1); u.inventory.splice(j, 1, id); u.bucks += priceOf(old); hist(l, 'box', priceOf(old), 'Замінено ' + MODULES[old].name);
        } else return null;
        flushEco(l); return null;
    }

    // ================= ТАЙМЕРИ =================
    jpNew(); crNew(); whNew();
    const tm = setInterval(() => {
        try { crTick(); } catch (e) { console.error('❌ crash tick', e && e.message); }
        try { whTick(); } catch (e) { console.error('❌ wheel tick', e && e.message); }
        try { jpTick(); } catch (e) { console.error('❌ jackpot tick', e && e.message); }
    }, 100); if (tm.unref) tm.unref();
    const tm2 = setInterval(() => { try { cbTick(); cfTick(); ltTick(); } catch (e) { console.error('❌ stakes tick', e && e.message); } }, 1000); if (tm2.unref) tm2.unref();

    // ================= СОКЕТ =================
    Events.on('login', e => { try { if (e && dbUsers[e.name]) settleOrphans(e.name); } catch (er) {} });
    const H = {
        stkCbNew: cbCreate, stkCbJoin: cbJoin, stkCbLeave: cbLeave,
        stkCfNew: cfCreate, stkCfJoin: cfJoin, stkCfCancel: cfCancel,
        stkJpBet: jpBet, stkCrBet: crBet, stkCrOut: l => crOut(l), stkWhBet: whBet,
        stkMnNew: mnNew, stkMnPick: mnPick, stkMnOut: l => mnCash(l),
        stkCt: ctDo, stkLtBuy: ltBuy, stkDuInv: duInvite, stkDuAns: duAnswer, stkPrize: prizeAct
    };
    const GAP = { stkCrOut: 60, stkMnPick: 120, stkWhBet: 150 };
    ctx.onConnection(socket => {
        ipOf.set(socket.id, ctx.ipHashOf(socket));
        const last = {};
        const me = () => { const n = ctx.globalPlayers[socket.id]; return n && dbUsers[n] ? n : null; };
        socket.on('stkHello', () => {
            const l = me(); if (!l) return; socket.join('stk'); settleOrphans(l);
            socket.emit('stkState', { me: meView(l), cb: view('cb'), cf: view('cf'), jp: view('jp'), cr: view('cr'), wh: view('wh'), lt: view('lt'), cbHist: CB_HIST.slice(0, 10), cfHist: CF_HIST.slice(0, 10), now: now() });
        });
        socket.on('stkBye', () => socket.leave('stk'));
        socket.on('stkRules', () => { const l = me(); if (!l) return; const s = S(l); if (!s.acc) { s.acc = now(); saveUser(l); } sendMe(l); });
        Object.keys(H).forEach(ev => socket.on(ev, d => {
            const l = me(); if (!l) return; const t = now(); if (t - (last[ev] || 0) < (GAP[ev] || 350)) return; last[ev] = t;
            let err = null; try { err = H[ev](l, d || {}, socket); } catch (e) { console.error('❌ stakes', ev, e && e.stack || e); err = 'Помилка сервера, спробуйте ще раз'; }
            if (err) socket.emit('stkMsg', { t: err, bad: true, ev });
            else socket.emit('stkOk', { ev });
            if (ev === 'stkMnPick' || ev === 'stkMnNew' || ev === 'stkMnOut') sendMe(l);
        }));
        socket.on('stkDuLeave', () => {
            for (const id in rooms) { const r = rooms[id]; if (r.duel && r.players[socket.id]) { socket.leave(id); ctx.removePlayer(id, socket.id); } }
        });
        socket.on('disconnect', () => { ipOf.delete(socket.id); });
    });

    ctx.Stakes = { CB, CF, get JP() { return JP; }, get CR() { return CR; }, get WH() { return WH; }, MN, INV, ltDraw, settleOrphans, S, _cbTick: cbTick, _ip: ipOf, _pairs: pairs };
};
