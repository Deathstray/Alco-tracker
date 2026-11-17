/**
 * routes/daily.js — ежедневные показатели (таблица daily_records):
 * качество сна и утреннее состояние оцениваются один раз за дату (UPSERT).
 */
const express = require('express');
const db = require('../db');
const { sendSuccess, Validator, asyncRoute, getPeriod, isUniqueError } = require('../helpers');

const router = express.Router();

/* Показатели за период (свежие сверху) */
router.get('/', asyncRoute(async (req, res) => {
    const { from, to } = await getPeriod(req);
    const params = [req.session.userId];
    let sql = 'SELECT * FROM daily_records WHERE user_id = ?';
    if (from) { sql += ' AND record_date >= ?'; params.push(from); }
    if (to)   { sql += ' AND record_date <= ?'; params.push(to); }
    sql += ' ORDER BY record_date DESC';
    sendSuccess(res, await db.query(sql, params));
}));

/* Создать или обновить показатели дня */
router.post('/', asyncRoute(async (req, res) => {
    const data = new Validator(req.body)
        .required('record_date').date('record_date')
        .int('sleep_quality', 1, 5)
        .int('morning_condition', 1, 5)
        .validate();

    const uid = req.session.userId;
    const date = data.record_date;
    const sleep = data.sleep_quality === '' || data.sleep_quality === undefined
        ? null : Number(data.sleep_quality);
    const morning = data.morning_condition === '' || data.morning_condition === undefined
        ? null : Number(data.morning_condition);
    const note = data.note && String(data.note).trim() !== '' ? String(data.note).trim() : null;

    // UPSERT в переносимом виде (работает и в SQLite, и в MySQL):
    // сначала пробуем обновить запись за дату, если её нет — вставляем.
    // Гонку параллельных сохранений (двойной клик) страхует уникальный
    // ключ uq_user_record_date (user_id, record_date): повторная вставка
    // отклоняется базой, и мы просто обновляем уже созданную строку.
    const updated = await db.execute(
        'UPDATE daily_records SET sleep_quality = ?, morning_condition = ?, note = ?' +
        ' WHERE user_id = ? AND record_date = ?',
        [sleep, morning, note, uid, date]
    );

    if (updated === 0) {
        try {
            await db.execute(
                'INSERT INTO daily_records (user_id, record_date, sleep_quality, morning_condition, note)' +
                ' VALUES (?, ?, ?, ?, ?)',
                [uid, date, sleep, morning, note]
            );
            return sendSuccess(res, { saved: date }, 201);   // создана новая запись
        } catch (e) {
            if (!isUniqueError(e)) throw e;
            await db.execute(                                 // строку успел вставить другой запрос
                'UPDATE daily_records SET sleep_quality = ?, morning_condition = ?, note = ?' +
                ' WHERE user_id = ? AND record_date = ?',
                [sleep, morning, note, uid, date]
            );
        }
    }
    sendSuccess(res, { saved: date }, 200);                   // обновлена существующая
}));

module.exports = router;
