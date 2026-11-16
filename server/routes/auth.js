/**
 * routes/auth.js — авторизация: регистрация, вход, выход, текущий пользователь.
 *
 * Пароль хранится только в виде хэша bcrypt (пакет bcryptjs),
 * проверка — асинхронный bcrypt.compare (не блокирует поток сервера).
 * Между запросами пользователь опознаётся по идентификатору,
 * записанному в сессию (cookie connect.sid).
 *
 * Защита от тайминга: если логин не существует, bcrypt всё равно
 * выполняет сравнение с фиктивным хэшем — время ответа не выдаёт,
 * зарегистрирован ли логин.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sendSuccess, sendError, Validator, asyncRoute } = require('../helpers');

const router = express.Router();

/* Фиктивный хэш для сравнения «впустую» при несуществующем логине. */
const DUMMY_HASH = bcrypt.hashSync('alkotracker-dummy', 10);

/** Пользователь по id без хэша пароля (хэш наружу не отдаём). */
async function getUserById(userId) {
    const user = await db.queryOne('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (user) delete user.password_hash;
    return user;
}

/** Сохранить пользователя в сессию (после входа и регистрации). */
function openSession(req, res, userId, user, status = 200) {
    // regenerate меняет идентификатор сессии — защита от её фиксации
    req.session.regenerate(() => {
        req.session.userId = userId;
        sendSuccess(res, user, status);
    });
}

/* ─────────── Вход ─────────── */
router.post('/login', asyncRoute(async (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (login === '' || password === '') {
        return sendError(res, 'Укажите логин и пароль', 422);
    }

    const user = await db.queryOne('SELECT * FROM users WHERE login = ?', [login]);
    // одно и то же сообщение и одинаковое время ответа: если логина нет,
    // bcrypt всё равно сравнивает пароль — с фиктивным хэшем
    const passwordOk = await bcrypt.compare(
        password, user !== null ? user.password_hash : DUMMY_HASH);
    if (user === null || !passwordOk) {
        return sendError(res, 'Неверный логин или пароль', 401);
    }

    openSession(req, res, user.user_id, await getUserById(user.user_id));
}));

/* ─────────── Регистрация ─────────── */
router.post('/register', asyncRoute(async (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const name = String(req.body.name || '').trim() || login;
    const gender = req.body.gender === 'female' ? 'female' : 'male';
    const birthYear = Number(req.body.birth_year) || 2000;
    const weightKg = Number(req.body.weight_kg) || 70;
    const heightCm = Number(req.body.height_cm) || 175;

    // Логин — латиница, цифры, «_» и «-», от 3 до 30 символов
    if (!/^[a-z0-9_-]{3,30}$/.test(login)) {
        return sendError(res, 'Логин: от 3 до 30 символов, латиница, цифры, «_» и «-»', 422);
    }
    if (password.length < 6) {
        return sendError(res, 'Пароль должен быть не короче 6 символов', 422);
    }

    // Диапазоны параметров — те же, что и в маршруте профиля (routes/profile.js):
    // имя не длиннее 100 симв., год 1930..текущий, вес 30–250, рост 120–230.
    // Необязательные поля при отсутствии принимают значения по умолчанию.
    new Validator(req.body)
        .maxlen('name', 100)
        .number('weight_kg', 30, 250)
        .int('birth_year', 1930, new Date().getFullYear())
        .int('height_cm', 120, 230)
        .validate();

    const exists = await db.queryValue('SELECT COUNT(*) FROM users WHERE login = ?', [login]);
    if (Number(exists) > 0) {
        return sendError(res, 'Такой логин уже занят', 422);
    }

    // Хэш bcrypt со случайной солью (cost 10 — стандартная сложность),
    // асинхронный вызов — сервер продолжает обрабатывать другие запросы
    const hash = await bcrypt.hash(password, 10);

    const userId = await db.insert(
        'INSERT INTO users (login, password_hash, name, gender, birth_year, weight_kg, height_cm)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?)',
        [login, hash, name, gender, birthYear, weightKg, heightCm]
    );

    openSession(req, res, userId, await getUserById(userId), 201);
}));

/* ─────────── Выход ─────────── */
router.post('/logout', (req, res) => {
    // Сессия полностью уничтожается
    req.session.destroy(() => {
        sendSuccess(res, { logged_out: true });
    });
});

/* ─────────── Текущий пользователь ─────────── */
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        return sendError(res, 'Требуется авторизация', 401);
    }
    db.queryOne('SELECT * FROM users WHERE user_id = ?', [req.session.userId])
        .then(user => {
            if (!user) return sendError(res, 'Требуется авторизация', 401);
            delete user.password_hash;
            sendSuccess(res, user);
        })
        .catch(() => sendError(res, 'Нет связи с базой данных', 500));
});

module.exports = router;
