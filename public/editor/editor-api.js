/* editor-api.js — зв'язок із сервером (пароль зберігається лише в пам'яті сторінки) */
const EAPI = (function () {
    let password = null;
    async function req(method, url, body) {
        const r = await fetch(url, { method: method, headers: Object.assign({ 'Content-Type': 'application/json' }, password ? { 'x-editor-password': password } : {}), body: body ? JSON.stringify(body) : undefined });
        let data = {}; try { data = await r.json(); } catch (e) { }
        if (!r.ok) throw new Error(data.error || ('Помилка ' + r.status));
        return data;
    }
    return {
        async login(p) { await req('POST', '/api/editor/login', { password: p }); password = p; },
        isLoggedIn: () => !!password,
        listMaps: () => req('GET', '/api/editor/maps'),
        saveMap: (name, map) => req('PUT', '/api/editor/maps/' + encodeURIComponent(name), { map: map }),
        deleteMap: (name) => req('DELETE', '/api/editor/maps/' + encodeURIComponent(name))
    };
})();
