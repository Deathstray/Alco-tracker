/**
 * server.js — точка входа REST API «АлкоТрекер» (Node.js + Express).
 *
 * Спецификация API (единый формат ответов см. helpers.js):
 *
 *   POST   /api/auth/login               — вход (логин + пароль)
 *   POST   /api/auth/register            — регистрация нового пользователя
 *   POST   /api/auth/logout              — выход
 *   GET    /api/auth/me                  — текущий пользователь
 *   — далее все запросы требуют авторизации (иначе 401) —
 *   GET    /api/types                    — список типов напитков
 *   GET    /api/drinks[?type_id=N]       — список напитков
 *   GET    /api/places                   — справочник мест
 *   GET    /api/reasons                  — справочник поводов
 *   GET    /api/companies                — справочник компаний
 *   GET    /api/entries?from=&to=        — записи дневника за период
 *   POST   /api/entries                  — создать запись (JSON-тело)
 *   PUT    /api/entries/:id              — изменить запись
 *   DELETE /api/entries/:id              — удалить запись
 *   GET    /api/entries/export?from=&to= — выгрузка дневника в CSV
 *   GET    /api/daily?from=&to=          — ежедневные показатели
 *   POST   /api/daily                    — сохранить оценки дня
 *   GET    /api/profile                  — профиль пользователя
 *   PUT    /api/profile                  — обновить профиль
 *   GET    /api/stats?mode=...&from=&to= — аналитика
 *
 * Запуск:  npm start  (порт 3000, см. PORT ниже)
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const { sendError, ApiError } = require('./helpers');
const db = require('./db');
const config = require('./config');

const PORT = process.env.PORT || 3000;

const app = express();

/* ─────────── Базовая настройка ─────────── */

// Разбор JSON-тел запросов (Content-Type: application/json)
app.use(express.json());

// Сессии: идентификатор хранится в cookie connect.sid,
// данные сессии — в памяти сервера (для учебного проекта достаточно)
app.use(session({
    // секрет можно переопределить переменной окружения SESSION_SECRET,
    // чтобы не хранить его в коде (продакшен-практика)
    secret: process.env.SESSION_SECRET || 'alkotracker-secret-key-2024',
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,                  // cookie недоступна из JavaScript
        sameSite: 'lax',                 // защита от CSRF
        maxAge: 24 * 60 * 60 * 1000,     // сессия живёт 24 часа
    },
}));

/* ─────────── Маршруты ─────────── */

// Авторизация доступна без входа
app.use('/api/auth', require('./routes/auth'));

// Проверка входа: всё, кроме /api/auth/*, — только для авторизованных
app.use('/api', (req, res, next) => {
    if (!req.session.userId) {
        return sendError(res, 'Требуется авторизация', 401);
    }
    next();
});

// Справочники: /api/types, /api/drinks, /api/places, /api/reasons, /api/companies
app.use('/api', require('./routes/dicts'));
app.use('/api/entries', require('./routes/entries'));
app.use('/api/daily', require('./routes/daily'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/stats', require('./routes/stats'));

// Неизвестные /api-адреса тоже отвечают JSON в едином формате
// (а не HTML-страницей 404, которую отдал бы Express по умолчанию)
app.use('/api', (req, res) => {
    sendError(res, 'Неизвестный маршрут API', 404);
});

/* ─────────── Клиент (собранная версия React) ───────────
 * Если выполнялась сборка клиента (npm run build в каталоге client),
 * сервер раздаёт её как статические файлы — тогда всё приложение
 * целиком живёт на одном порту: http://localhost:3000
 */
const distDir = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    // любое неизвестное «не-API»-адресу отдадим index.html (SPA)
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api/')) {
            return res.sendFile(path.join(distDir, 'index.html'));
        }
        next();
    });
}

/* ─────────── Обработка ошибок ─────────── */

// общий обработчик ошибок (4 аргумента — требование Express)
app.use((err, req, res, next) => {
    // Ошибки приложения (валидация, «не найдено» и т.п.)
    if (err instanceof ApiError) {
        return sendError(res, err.message, err.status, err.details);
    }
    // Нарушение уникальности в БД (например, запись с такой датой и временем уже есть)
    if (err && err.code === 'ER_DUP_ENTRY') {
        return sendError(res, 'Такая запись уже существует', 422);
    }
    // Ошибки разбора JSON-тела
    if (err && err.type === 'entity.parse.failed') {
        return sendError(res, 'Некорректный JSON в теле запроса', 400);
    }
    console.error('Ошибка сервера:', err.message);
    sendError(res, 'Внутренняя ошибка сервера', 500);
});

/* ─────────── Запуск ─────────── */

async function start() {
    // Проверяем подключение к базе ещё до приёма запросов
    try {
        await db.query('SELECT 1');
    } catch (e) {
        console.error('Не удалось подключиться к базе данных.');
        console.error('Проверьте настройки в server/config.js (host, user, password).');
        console.error('Подробности: ' + e.message);
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log('API АлкоТрекер запущено:  http://localhost:' + PORT);
        console.log('База данных: ' + config.database + ' @ ' + config.host + ':' + config.port);
    });
}

start();
