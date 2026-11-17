/**
 * db.js — доступ к базе данных «АлкоТрекер»: SQLite или MySQL.
 *
 * Оба режима предоставляют один и тот же интерфейс
 * (query / queryOne / queryValue / execute / insert), поэтому
 * остальной код приложения от режима не зависит.
 *
 * Все запросы выполняются через подготовленные выражения:
 * значения подставляются через «?», а не склеиваются в строку, —
 * это защищает от SQL-инъекций в обоих режимах.
 *
 * Режим 'sqlite' (по умолчанию) использует встроенный в Node.js
 * модуль node:sqlite (Node 22.5+) — отдельные пакеты не нужны.
 * При первом запуске файл базы создаётся автоматически и
 * заполняется схемой и демо-данными из sql/alkotracker_sqlite.sql.
 *
 * Режим 'mysql' — пул соединений mysql2 (защита ВКР, phpMyAdmin).
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

const MODE = String(config.db || 'sqlite').toLowerCase();

let pool = null;   // пул mysql2 (только в режиме MySQL)
let query;         // SELECT ... → массив строк
let execute;       // INSERT/UPDATE/DELETE → число затронутых строк
let insert;        // INSERT → id новой строки

if (MODE === 'mysql') {
    /* ─────────── Режим MySQL (пул соединений mysql2) ─────────── */

    const mysql = require('mysql2/promise');

    // dateStrings — DATE и DATETIME возвращаются строками 'ГГГГ-ММ-ДД',
    // а не объектами Date: так с датами проще работать в аналитике
    pool = mysql.createPool({
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
        waitForConnections: true,
        connectionLimit: 10,
        charset: 'utf8mb4_unicode_ci',
        dateStrings: true,
    });

    query = async (sql, params = []) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
    };

    execute = async (sql, params = []) => {
        const [result] = await pool.execute(sql, params);
        return result.affectedRows;
    };

    insert = async (sql, params = []) => {
        const [result] = await pool.execute(sql, params);
        return result.insertId;
    };

} else {
    /* ─────────── Режим SQLite (встроенная база, node:sqlite) ─────────── */

    const { DatabaseSync } = require('node:sqlite');

    const dbFile = path.join(__dirname, config.sqliteFile || 'alkotracker.db');
    const sqlite = new DatabaseSync(dbFile);

    // внешние ключи (каскадные удаления) в SQLite включаются на соединение
    sqlite.exec('PRAGMA foreign_keys = ON');

    // Автоинициализация: если базы ещё нет — создаём схему и демо-данные.
    // Проверяем наличие таблицы users в служебной схеме sqlite_master.
    const hasTables = sqlite.prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'users'"
    ).get();
    if (Number(hasTables.n) === 0) {
        const sqlPath = path.join(__dirname, 'sql', 'alkotracker_sqlite.sql');
        sqlite.exec(fs.readFileSync(sqlPath, 'utf8'));
        console.log('Создана встроенная база SQLite: ' + (config.sqliteFile || 'alkotracker.db') +
            ' (схема + демо-данные, демо-аккаунт demo / demo123)');
    }

    query = (sql, params = []) => sqlite.prepare(sql).all(...params);

    execute = (sql, params = []) => sqlite.prepare(sql).run(...params).changes;

    insert = (sql, params = []) => Number(sqlite.prepare(sql).run(...params).lastInsertRowid);
}

/* ─────────── Общие помощники (одинаковы для обоих режимов) ─────────── */

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

module.exports = { pool, query, queryOne, queryValue, execute, insert, mode: MODE };
