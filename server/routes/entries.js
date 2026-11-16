/**
 * routes/entries.js — записи дневника употребления (таблица entries).
 *
 * Основные CRUD-операции: список за период, создать, изменить, удалить.
 * Данные отдаются через представление vw_entry_details, чтобы сразу
 * получать русские названия справочников и число доз.
 * Здесь же — экспорт дневника в CSV (файл открывается в Excel).
 */
const express = require('express');
const db = require('../db');
const { sendSuccess, sendError, Validator, asyncRoute, getPeriod } = require('../helpers');

const router = express.Router();

/** Записи за период (новые сверху). */
async function entriesForPeriod(uid, from, to, limit = 500) {
    const params = [uid];
    let sql = 'SELECT * FROM vw_entry_details WHERE user_id = ?';
    if (from) { sql += ' AND entry_date >= ?'; params.push(from); }
    if (to)   { sql += ' AND entry_date <= ?'; params.push(to); }
    sql += ' ORDER BY entry_date DESC, entry_time DESC LIMIT ' + Number(limit);
    return db.query(sql, params);
}

/** Значение поля или null, если пустая строка (для необязательных id справочников). */
function idOrNull(v) {
    return v === undefined || v === null || v === '' ? null : Number(v);
}

/** Экранирование значения для CSV: кавычки и точка с запятой. */
function csvValue(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

/* ─────────── Список записей ─────────── */
router.get('/', asyncRoute(async (req, res) => {
    const { from, to } = await getPeriod(req);
    sendSuccess(res, await entriesForPeriod(req.session.userId, from, to));
}));

/* ─────────── Создать запись ─────────── */
router.post('/', asyncRoute(async (req, res) => {
    const data = new Validator(req.body)
        .required('drink_id').int('drink_id', 1, 1000000)
        .required('entry_date').date('entry_date')
        .time('entry_time')
        .required('volume_ml').int('volume_ml', 1, 10000)
        .number('strength', 0, 100)
        .validate();

    const entryId = await db.insert(
        'INSERT INTO entries' +
        ' (user_id, drink_id, entry_date, entry_time, volume_ml, strength, price, place_id, reason_id, company_id)' +
        ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
            req.session.userId,
            Number(data.drink_id),
            data.entry_date,
            data.entry_time || '18:00:00',
            Number(data.volume_ml),
            Number(data.strength || 0),
            Number(data.price || 0),
            idOrNull(data.place_id),
            idOrNull(data.reason_id),
            idOrNull(data.company_id),
        ]
    );
    const row = await db.queryOne('SELECT * FROM vw_entry_details WHERE entry_id = ?', [entryId]);
    sendSuccess(res, row, 201);
}));

/* ─────────── Изменить запись ─────────── */
router.put('/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return sendError(res, 'Некорректный id записи', 422);
    }
    // Проверяем, что запись существует и принадлежит текущему пользователю
    const current = await db.queryOne(
        'SELECT * FROM entries WHERE entry_id = ? AND user_id = ?',
        [id, req.session.userId]
    );
    if (!current) {
        return sendError(res, 'Запись не найдена', 404);
    }
    const data = new Validator(req.body)
        .required('drink_id').int('drink_id', 1, 1000000)
        .required('entry_date').date('entry_date')
        .time('entry_time')
        .required('volume_ml').int('volume_ml', 1, 10000)
        .number('strength', 0, 100)
        .validate();

    // Неизвестные поля не затираются: если место/повод/компанию не
    // прислали, сохраняются текущие значения записи
    await db.execute(
        'UPDATE entries SET' +
        ' drink_id = ?, entry_date = ?, entry_time = ?, volume_ml = ?, strength = ?,' +
        ' price = ?, place_id = ?, reason_id = ?, company_id = ?' +
        ' WHERE entry_id = ? AND user_id = ?',
        [
            Number(data.drink_id),
            data.entry_date,
            data.entry_time || current.entry_time,
            Number(data.volume_ml),
            Number(data.strength !== undefined ? data.strength : current.strength),
            Number(data.price !== undefined && data.price !== '' ? data.price : current.price),
            data.place_id !== undefined ? idOrNull(data.place_id) : current.place_id,
            data.reason_id !== undefined ? idOrNull(data.reason_id) : current.reason_id,
            data.company_id !== undefined ? idOrNull(data.company_id) : current.company_id,
            id,
            req.session.userId,
        ]
    );
    const row = await db.queryOne('SELECT * FROM vw_entry_details WHERE entry_id = ?', [id]);
    sendSuccess(res, row);
}));

/* ─────────── Удалить запись ─────────── */
router.delete('/:id', asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    const deleted = await db.execute(
        'DELETE FROM entries WHERE entry_id = ? AND user_id = ?',
        [id, req.session.userId]
    );
    if (deleted === 0) {
        return sendError(res, 'Запись не найдена', 404);
    }
    sendSuccess(res, { deleted: id });
}));

/* ─────────── Экспорт дневника в CSV ───────────
 * Кодировка UTF-8 с BOM — файл корректно открывается в Excel
 * и LibreOffice без ручного выбора кодировки.
 */
router.get('/export', asyncRoute(async (req, res) => {
    const { from, to } = await getPeriod(req);
    const rows = await entriesForPeriod(req.session.userId, from, to, 100000);
    // Экспорт идёт по возрастанию дат (удобнее читать в Excel)
    rows.reverse();

    const headers = ['Дата', 'Время', 'Напиток', 'Тип', 'Объём, мл',
        'Крепость, %', 'Цена, руб.', 'Чистый спирт, г', 'Доз',
        'Место', 'Повод', 'Компания'];

    let csv = '\uFEFF'; // BOM
    csv += headers.join(';') + '\r\n';
    for (const r of rows) {
        csv += [
            r.entry_date,
            String(r.entry_time).slice(0, 5),
            r.drink_name,
            r.type_name,
            r.volume_ml,
            r.strength,
            r.price,
            r.pure_grams,
            r.doses,
            r.place_name,
            r.reason_name,
            r.company_name,
        ].map(csvValue).join(';') + '\r\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="alkotracker_export.csv"');
    res.send(csv);
}));

module.exports = router;
