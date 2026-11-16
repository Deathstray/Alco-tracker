/**
 * db.js — подключение к MySQL через пул соединений (пакет mysql2).
 *
 * Все запросы приложения выполняются через подготовленные выражения:
 * значения подставляются через «?», а не склеиваются в строку, —
 * это защищает от SQL-инъекций.
 */
const mysql = require('mysql2/promise');
const config = require('./config');

// Пул соединений: несколько запросов могут выполняться параллельно
// dateStrings — DATE и DATETIME возвращаются строками 'ГГГГ-ММ-ДД',
// а не объектами Date: так с датами проще работать в аналитике
const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4_unicode_ci',
    dateStrings: true,
});

// Выполнить SELECT и вернуть все строки
async function query(sql, params = []) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

// SELECT одной строки (или null)
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}

// первое значение первой строки (для COUNT(*), SUM(...) и т.п.)
async function queryValue(sql, params = []) {
    const row = await queryOne(sql, params);
    if (row === null) return null;
    return Object.values(row)[0];
}

// INSERT/UPDATE/DELETE — возвращает число затронутых строк
async function execute(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result.affectedRows;
}

// INSERT — возвращает id новой строки (AUTO_INCREMENT)
async function insert(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result.insertId;
}

module.exports = { pool, query, queryOne, queryValue, execute, insert };
