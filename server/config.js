/**
 * config.js — настройки подключения к MySQL.
 *
 * Уточните пароль под свою сборку (OpenServer, XAMPP или отдельный MySQL).
 * По умолчанию: пользователь root без пароля, база alkotracker.
 */
module.exports = {
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'alkotracker',
};
