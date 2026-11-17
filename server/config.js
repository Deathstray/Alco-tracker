/**
 * config.js — настройки базы данных «АлкоТрекер».
 *
 * Поддерживаются два режима:
 *
 *   'sqlite' (по умолчанию) — встроенная база SQLite. Ничего
 *      устанавливать не нужно: файл server/alkotracker.db
 *      создаётся автоматически при первом запуске вместе со схемой
 *      и демо-данными. Так проект запускается «из коробки».
 *
 *   'mysql' — полноценный сервер MySQL/MariaDB (OpenServer, XAMPP).
 *      Используется на защите ВКР: импорт дампа через phpMyAdmin,
 *      те же таблицы, представления и данные (см. INSTALL.md).
 *
 * Режим выбирается здесь или переменной окружения ALKOTRACKER_DB
 * (её устанавливает start-mysql.bat).
 */
module.exports = {
    db: process.env.ALKOTRACKER_DB || 'sqlite',

    // файл встроенной базы (в каталоге server/, можно удалять — создастся заново)
    sqliteFile: 'alkotracker.db',

    // параметры подключения MySQL для режима db: 'mysql'
    mysql: {
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',          // пароль root в вашей сборке
        database: 'alkotracker',
    },
};
