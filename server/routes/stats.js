/**
 * routes/stats.js — аналитика потребления.
 *
 * Карточки аналитики собираются SQL-запросами к представлениям
 * vw_entry_details / vw_daily_stats, а серии трезвых дней и шкала
 * риска считаются на JavaScript.
 *
 * Режимы:  ?mode=summary | by_weekday | by_type | trend | top_drinks
 */
const express = require('express');
const db = require('../db');
const calc = require('../calc');
const { sendSuccess, sendError, asyncRoute, getPeriod } = require('../helpers');

const router = express.Router();

/** Сколько дней входит в диапазон дат включительно. */
function daysBetween(from, to) {
    const a = new Date(from + 'T00:00:00');
    const b = new Date(to + 'T00:00:00');
    return Math.round((b - a) / 86400000) + 1;
}

/** Дата, сдвинутая на days дней назад от ISO-даты. */
function shiftISO(iso, days) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/** Выполнить запрос «топ-1» и нормализовать ответ. */
async function top(sql, params) {
    const row = await db.queryOne(sql, params);
    if (row === null || row.name === null) return null;
    return { name: row.name, doses: Math.round(Number(row.doses) * 10) / 10 };
}

/**
 * Серии трезвых дней.
 * current — сколько дней подряд без алкоголя до конца периода;
 * longest — максимальная непрерывная серия внутри периода.
 */
function streaks(from, to, dayRows) {
    const drinking = {};
    dayRows.forEach(r => { drinking[r.entry_date] = true; });

    // Текущая серия: идём от конца периода назад до первого дня с алкоголем
    let current = 0;
    let cursor = to;
    while (cursor >= from) {
        if (drinking[cursor]) break;
        current++;
        cursor = shiftISO(cursor, -1);
    }

    // Самая длинная серия: идём от начала периода вперёд
    let longest = 0;
    let run = 0;
    cursor = from;
    while (cursor <= to) {
        if (drinking[cursor]) {
            run = 0;
        } else {
            run++;
            if (run > longest) longest = run;
        }
        cursor = shiftISO(cursor, 1);
    }
    return { current: current, longest: longest };
}

/** Сводка за период: основная карточка аналитики. */
async function summary(uid, from, to) {
    // 1. Общие суммы за период (алкоголь отдельно от кофе/энергетиков)
    const totals = (await db.queryOne(
        'SELECT' +
        '  COUNT(*)                                           AS total_entries,' +
        '  SUM(is_alcoholic)                                  AS alcohol_entries,' +
        '  SUM(pure_grams)                                    AS pure_grams,' +
        '  SUM(CASE WHEN is_alcoholic = 1 THEN volume_ml END)  AS alcohol_ml,' +
        '  SUM(price)                                         AS money_total' +
        ' FROM vw_entry_details' +
        ' WHERE user_id = ? AND entry_date BETWEEN ? AND ?',
        [uid, from, to]
    )) || {};

    // 2. Сводка по дням из представления vw_daily_stats
    const dayRows = await db.query(
        'SELECT entry_date, doses, pure_grams' +
        ' FROM vw_daily_stats' +
        ' WHERE user_id = ? AND entry_date BETWEEN ? AND ?' +
        ' ORDER BY entry_date',
        [uid, from, to]
    );

    const daysInPeriod = daysBetween(from, to);
    const drinkingDays = dayRows.length;
    const soberDays = Math.max(0, daysInPeriod - drinkingDays);
    let totalDoses = 0;
    dayRows.forEach(r => { totalDoses += Number(r.doses); });

    // 3. День с максимальным числом доз
    let maxDay = null;
    dayRows.forEach(r => {
        if (maxDay === null || Number(r.doses) > Number(maxDay.doses)) maxDay = r;
    });

    // 4. Топ-справочники: напиток, тип, место, повод, компания (по дозам)
    const topSql = (column) =>
        'SELECT ' + column + ' AS name, SUM(doses) AS doses' +
        ' FROM vw_entry_details' +
        ' WHERE user_id = ? AND entry_date BETWEEN ? AND ?' +
        '   AND is_alcoholic = 1 AND ' + column + ' IS NOT NULL' +
        ' GROUP BY ' + column + ' ORDER BY doses DESC LIMIT 1';

    const topDrink  = await top('SELECT drink_name AS name, SUM(doses) AS doses FROM vw_entry_details' +
        ' WHERE user_id = ? AND entry_date BETWEEN ? AND ? AND is_alcoholic = 1' +
        ' GROUP BY drink_name ORDER BY doses DESC LIMIT 1', [uid, from, to]);
    const topType   = await top('SELECT type_name AS name, SUM(doses) AS doses FROM vw_entry_details' +
        ' WHERE user_id = ? AND entry_date BETWEEN ? AND ? AND is_alcoholic = 1' +
        ' GROUP BY type_name ORDER BY doses DESC LIMIT 1', [uid, from, to]);
    const topPlace   = await top(topSql('place_name'),   [uid, from, to]);
    const topReason  = await top(topSql('reason_name'),  [uid, from, to]);
    const topCompany = await top(topSql('company_name'), [uid, from, to]);

    // 5. Серии трезвых дней
    const st = streaks(from, to, dayRows);

    // 6. Связь употребления со сном и утренним состоянием
    const sleep = (await db.queryOne(
        'SELECT' +
        '  ROUND(AVG(CASE WHEN vs.entry_date IS NOT NULL THEN dr.sleep_quality END), 2)     AS sleep_after_alc,' +
        '  ROUND(AVG(CASE WHEN vs.entry_date IS NULL     THEN dr.sleep_quality END), 2)     AS sleep_sober,' +
        '  ROUND(AVG(CASE WHEN vs.entry_date IS NOT NULL THEN dr.morning_condition END), 2) AS morning_after_alc,' +
        '  ROUND(AVG(CASE WHEN vs.entry_date IS NULL     THEN dr.morning_condition END), 2) AS morning_sober' +
        ' FROM daily_records dr' +
        ' LEFT JOIN vw_daily_stats vs ON vs.user_id = dr.user_id AND vs.entry_date = dr.record_date' +
        ' WHERE dr.user_id = ? AND dr.record_date BETWEEN ? AND ?' +
        '   AND dr.record_date > (SELECT MIN(entry_date) FROM vw_entry_details WHERE user_id = ?)',
        [uid, from, to, uid]
    )) || {};

    // 7. Дозы за последние 7 дней периода → шкала риска
    const last7From = shiftISO(to, -6);
    const last7 = Number(await db.queryValue(
        'SELECT SUM(doses) FROM vw_daily_stats WHERE user_id = ? AND entry_date BETWEEN ? AND ?',
        [uid, last7From, to]
    )) || 0;

    return {
        from: from,
        to: to,
        days_in_period: daysInPeriod,
        total_entries: Number(totals.total_entries) || 0,
        alcohol_entries: Number(totals.alcohol_entries) || 0,
        total_doses: Math.round(totalDoses * 10) / 10,
        total_liters: Math.round(((Number(totals.alcohol_ml) || 0) / 1000) * 100) / 100,
        money_total: Math.round(Number(totals.money_total) || 0),
        drinking_days: drinkingDays,
        sober_days: soberDays,
        sober_percent: daysInPeriod > 0 ? Math.round(100 * soberDays / daysInPeriod) : 0,
        avg_doses_per_drinking_day: drinkingDays > 0 ? Math.round(totalDoses / drinkingDays * 10) / 10 : 0,
        max_day: maxDay !== null
            ? { date: maxDay.entry_date, doses: Math.round(Number(maxDay.doses) * 10) / 10 }
            : null,
        top_drink: topDrink,
        top_type: topType,
        top_place: topPlace,
        top_reason: topReason,
        top_company: topCompany,
        current_sober_streak: st.current,
        longest_sober_streak: st.longest,
        sleep: sleep,
        last7_doses: Math.round(last7 * 10) / 10,
        risk: calc.riskLevel(last7),
    };
}

/* Все режимы аналитики: /api/stats?mode=...&from=&to= */
router.get('/', asyncRoute(async (req, res) => {
    const { from, to } = await getPeriod(req);
    const uid = req.session.userId;
    const mode = String(req.query.mode || 'summary');

    if (mode === 'summary') {
        sendSuccess(res, await summary(uid, from, to));
        return;
    }

    if (mode === 'by_weekday') {
        // Дозы по дням недели (0 = понедельник … 6 = воскресенье).
        // День недели считаем в JavaScript, а не функцией WEEKDAY():
        // такой запрос одинаково работает в SQLite и MySQL.
        // (getDay(): 0 = воскресенье, сдвиг на 6 даёт 0 = понедельник)
        const rows = await db.query(
            'SELECT entry_date, doses' +
            ' FROM vw_daily_stats' +
            ' WHERE user_id = ? AND entry_date BETWEEN ? AND ?' +
            ' ORDER BY entry_date',
            [uid, from, to]
        );

        const result = {};
        rows.forEach(r => {
            const weekday = (new Date(r.entry_date + 'T00:00:00').getDay() + 6) % 7;
            if (!result[weekday]) result[weekday] = { doses: 0, days: 0 };
            result[weekday].doses += Number(r.doses);
            result[weekday].days += 1;
        });
        Object.keys(result).forEach(k => {
            result[k].doses = Math.round(result[k].doses * 10) / 10;
        });
        sendSuccess(res, result);
        return;
    }

    if (mode === 'by_type') {
        // Дозы по типам напитков
        sendSuccess(res, await db.query(
            'SELECT type_name AS name, SUM(doses) AS doses, COUNT(*) AS cnt' +
            ' FROM vw_entry_details' +
            ' WHERE user_id = ? AND entry_date BETWEEN ? AND ? AND is_alcoholic = 1' +
            ' GROUP BY type_name ORDER BY doses DESC',
            [uid, from, to]
        ));
        return;
    }

    if (mode === 'trend') {
        // Серия «доза по дням» для графика тренда
        sendSuccess(res, await db.query(
            'SELECT entry_date, doses' +
            ' FROM vw_daily_stats' +
            ' WHERE user_id = ? AND entry_date BETWEEN ? AND ?' +
            ' ORDER BY entry_date',
            [uid, from, to]
        ));
        return;
    }

    if (mode === 'top_drinks') {
        // Топ напитков по дозам
        sendSuccess(res, await db.query(
            'SELECT drink_name AS name, SUM(doses) AS doses, COUNT(*) AS cnt' +
            ' FROM vw_entry_details' +
            ' WHERE user_id = ? AND entry_date BETWEEN ? AND ? AND is_alcoholic = 1' +
            ' GROUP BY drink_name ORDER BY doses DESC LIMIT 5',
            [uid, from, to]
        ));
        return;
    }

    sendError(res, 'Неизвестный режим аналитики: ' + mode, 422);
}));

module.exports = router;
