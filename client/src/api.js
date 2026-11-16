/**
 * api.js — REST-клиент: единая точка доступа к API (server/server.js).
 * Все запросы идут через эти функции. Сессия передаётся cookie
 * connect.sid, как при обычном входе на сайт.
 */
const Api = {

    // низкоуровневый запрос, используется методами ниже
    async request(method, url, body) {
        const options = { method: method, headers: {} };
        if (body !== undefined) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
        }
        const response = await fetch(url, options);
        let json = null;
        try { json = await response.json(); } catch (e) { /* ответ не в JSON */ }
        if (!response.ok || json === null || !json.ok) {
            throw Api.fail(json, response);
        }
        return json.data;
    },

    get(url) {
        return Api.request('GET', url);
    },

    post(url, data) {
        return Api.request('POST', url, data);
    },

    put(url, data) {
        return Api.request('PUT', url, data);
    },

    del(url) {
        return Api.request('DELETE', url);
    },

    // вход: логин и пароль, сервер открывает сессию
    login(login, password) {
        return Api.post('/api/auth/login', { login, password });
    },

    // регистрация нового пользователя (и сразу вход)
    register(data) {
        return Api.post('/api/auth/register', data);
    },

    // выход: сессия на сервере закрывается
    logout() {
        return Api.post('/api/auth/logout', {});
    },

    // ошибка с кодом состояния (401 — нет авторизации)
    fail(json, response) {
        const err = new Error(json && json.error ? json.error : 'HTTP ' + response.status);
        err.status = response.status;
        return err;
    },

    // ссылка на экспорт дневника в CSV (открывать/скачивать напрямую)
    exportUrl(from, to) {
        return '/api/entries/export?from=' + encodeURIComponent(from) +
               '&to=' + encodeURIComponent(to);
    },
};

export default Api;
