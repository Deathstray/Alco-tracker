/**
 * routes/daily.js — ежедневные показатели (таблица daily_records):
 * качество сна и утреннее состояние оцениваются один раз за дату (UPSERT).
 */
const express = require('express');
const db = require('../db');
const { sendSuccess, Validator, asyncRoute, getPeriod } = require('../helpers');

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

    // Атомарный UPSERT: запись за дату уже есть — обновляем оценки, нет — вставляем.
    // Конфликт параллельных сохранений (двойной клик) решает уникальный ключ
    // uq_user_record_date (user_id, record_date) — база гарантирует атомарность
    const affected = await db.execute(
        'INSERT INTO daily_records (user_id, record_date, sleep_quality, morning_condition, note)' +
        ' VALUES (?, ?, ?, ?, ?)' +
        ' ON DUPLICATE KEY UPDATE' +
        ' sleep_quality = VALUES(sleep_quality),' +
        ' morning_condition = VALUES(morning_condition),' +
        ' note = VALUES(note)',
        [uid, date, sleep, morning, note]
    );

    // affectedRows: 1 — вставлена новая строка (201), 2/0 — обновлена существующая (200)
    sendSuccess(res, { saved: date }, affected === 1 ? 201 : 200);
}));

module.exports = router;
