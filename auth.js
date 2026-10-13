/* auth.js — паролі акаунтів і захист входу від перебору (підключається з server.js напряму).
 *
 * Формат хешу: 's1$<сіль hex>$<scrypt hex>' — scrypt (N=16384, r=8, p=1, 32 байти) з випадковою сіллю на кожен акаунт.
 * Старі акаунти мають SHA-256 без солі (64 hex-символи): такий пароль приймається один раз і одразу перезаписується
 * в новому форматі (тиха міграція при наступному вході / зміні пароля). scrypt рахується асинхронно — тік гри не гальмує.
 *
 * Перебір: 8 невдалих спроб з однієї мережі за 10 хв → пауза 10 хв (для всіх логінів з цієї мережі);
 * 10 невдалих спроб на один логін за 10 хв → пауза 10 хв для цього логіна. */
'use strict';
const crypto = require('crypto');

const PREFIX = 's1$', KEYLEN = 32, OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const scrypt = (pwd, salt) => new Promise((res, rej) => crypto.scrypt(String(pwd), salt, KEYLEN, OPTS, (e, k) => e ? rej(e) : res(k)));
const sha256 = pwd => crypto.createHash('sha256').update(String(pwd)).digest('hex');

async function makeHash(pwd) {
    const salt = crypto.randomBytes(16);
    return PREFIX + salt.toString('hex') + '$' + (await scrypt(pwd, salt)).toString('hex');
}
const isLegacy = stored => typeof stored === 'string' && /^[0-9a-f]{64}$/.test(stored);
// → { ok, upgrade } ; upgrade = true — пароль правильний, але збережений у старому форматі (треба перезаписати)
async function verify(stored, pwd) {
    if (typeof stored !== 'string' || typeof pwd !== 'string') return { ok: false };
    if (stored.startsWith(PREFIX)) {
        const [, saltHex, hashHex] = stored.split('$');
        if (!saltHex || !hashHex) return { ok: false };
        const want = Buffer.from(hashHex, 'hex'), got = await scrypt(pwd, Buffer.from(saltHex, 'hex'));
        return { ok: want.length === got.length && crypto.timingSafeEqual(want, got) };
    }
    if (isLegacy(stored)) {
        const ok = crypto.timingSafeEqual(Buffer.from(stored, 'hex'), Buffer.from(sha256(pwd), 'hex'));
        return { ok, upgrade: ok };
    }
    return { ok: false };
}

// ---------- обмеження спроб ----------
const WINDOW = 10 * 60e3, LOCK = 10 * 60e3, MAX_IP = 8, MAX_NAME = 10;
const tries = new Map();      // ключ → { n, t0, until }
function rec(k) { let r = tries.get(k); const now = Date.now(); if (!r || now - r.t0 > WINDOW) { r = { n: 0, t0: now, until: r ? r.until : 0 }; tries.set(k, r); } return r; }
function lockedFor(ip, name) {
    const now = Date.now(), a = tries.get('ip|' + ip), b = tries.get('nm|' + String(name).toLowerCase());
    const until = Math.max(a && a.until > now ? a.until : 0, b && b.until > now ? b.until : 0);
    return until ? until - now : 0;
}
function failed(ip, name) {
    const now = Date.now(), a = rec('ip|' + ip), b = rec('nm|' + String(name).toLowerCase());
    if (++a.n >= MAX_IP) { a.n = 0; a.until = now + LOCK; }
    if (++b.n >= MAX_NAME) { b.n = 0; b.until = now + LOCK; }
    if (tries.size > 20000) for (const [k, r] of tries) { if (now - r.t0 > WINDOW && r.until < now) tries.delete(k); }
}
function succeeded(ip, name) { tries.delete('nm|' + String(name).toLowerCase()); const a = tries.get('ip|' + ip); if (a) a.n = Math.max(0, a.n - 1); }

module.exports = { makeHash, verify, isLegacy, lockedFor, failed, succeeded, _sha256: sha256 };
