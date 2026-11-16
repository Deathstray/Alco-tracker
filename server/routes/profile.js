/**
 * routes/profile.js — профиль текущего пользователя (таблица users).
 * Параметры (пол, вес) нужны клиенту для расчёта промилле по формуле Видмарка.
 */
const express = require('express');
const db = require('../db');
const { sendSuccess, sendError, Validator, asyncRoute } = require('../helpers');

const router = express.Router();

/** Профиль без хэша пароля. */
async function currentProfile(userId) {
    const user = await db.queryOne('SELECT * FROM users WHERE user_id = ?', [userId]);
    if (user) delete user.password_hash;
    return user;
}

/* Получить профиль */
router.get('/', asyncRoute(async (req, res) => {
    const user = await currentProfile(req.session.userId);
    if (user === null) {
        // пользователь исчез (например, удалён) при живой сессии — честный 404
        return sendError(res, 'Пользователь не найден', 404);
    }
    sendSuccess(res, user);
}));

/* Обновить параметры профиля */
router.put('/', asyncRoute(async (req, res) => {
    const data = new Validator(req.body)
        .required('name')
        .in('gender', ['male', 'female'])
        .int('birth_year', 1930, new Date().getFullYear())
        .number('weight_kg', 30, 250)
        .int('height_cm', 120, 230)
        .validate();

    const user = await db.queryOne('SELECT * FROM users WHERE user_id = ?', [req.session.userId]);
    if (!user) {
        return sendError(res, 'Пользователь не найден', 404);
    }

    await db.execute(
        'UPDATE users SET name = ?, gender = ?, birth_year = ?, weight_kg = ?, height_cm = ?' +
        ' WHERE user_id = ?',
        [
            String(data.name).trim(),
            data.gender === 'female' ? 'female' : 'male',
            Number(data.birth_year) || Number(user.birth_year) || 2000,
            Number(data.weight_kg) || Number(user.weight_kg) || 70,
            Number(data.height_cm) || Number(user.height_cm) || 175,
            req.session.userId,
        ]
    );
    sendSuccess(res, await currentProfile(req.session.userId));
}));

module.exports = router;
