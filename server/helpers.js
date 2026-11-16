/**
 * helpers.js — общие функции REST API: единый формат ответов,
 * проверка входных данных и периоды дат.
 *
 * Формат успешного ответа:  {"ok": true,  "data": ...}
 * Формат ответа с ошибкой:  {"ok": false, "error": "...", "details": {...}}
 */
const { queryValue } = require('./db');

/** Ошибка API: перехватывается общим обработчиком в server.js. */
class ApiError extends Error {
    constructor(message, status = 400, details = {}) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

/** Отправить успешный ответ. */
function sendSuccess(res, data, status = 200) {
    res.status(status).json({ ok: true, data: data });
}

/** Отправить ответ с ошибкой. */
function sendError(res, message, status = 400, details = {}) {
    res.status(status).json({ ok: false, error: message, details: details });
}

/**
 * Проверка входных данных.
 * Правила накапливаются по цепочке, ошибки собираются в объект:
 *   const data = new Validator(req.body).required('login').validate();
 * При ошибках бросается ApiError со статусом 422.
 */
class Validator {
    constructor(data) {
        this.data = data || {};
        this.errors = {};
    }

    /** Обязательное поле, непустая строка. */
    required(field) {
        const v = this.data[field];
        if (v === undefined || v === null || String(v).trim() === '') {
            this.errors[field] = 'Поле обязательно для заполнения';
        }
        return this;
    }

    /** Целое число в диапазоне [min, max]. */
    int(field, min = -2147483648, max = 2147483647) {
        const v = this.data[field];
        if (v === undefined || v === null || v === '') return this; // отсутствие проверяется required()
        const n = Number(v);
        if (!Number.isInteger(n) || n < min || n > max) {
            this.errors[field] = 'Ожидается целое число от ' + min + ' до ' + max;
        }
        return this;
    }

    /** Число в диапазоне [min, max]. */
    number(field, min, max) {
        const v = this.data[field];
        if (v === undefined || v === null || v === '') return this;
        const n = Number(v);
        if (isNaN(n) || n < min || n > max) {
            this.errors[field] = 'Ожидается число от ' + min + ' до ' + max;
        }
        return this;
    }

    /** Дата в формате ГГГГ-ММ-ДД. */
    date(field) {
        const v = this.data[field];
        if (v === undefined || v === null || v === '') return this;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) {
            this.errors[field] = 'Ожидается дата в формате ГГГГ-ММ-ДД';
        }
        return this;
    }

    /** Время в формате ЧЧ:ММ или ЧЧ:ММ:СС. */
    time(field) {
        const v = this.data[field];
        if (v === undefined || v === null || v === '') return this;
        if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v)) {
            this.errors[field] = 'Ожидается время в формате ЧЧ:ММ или ЧЧ:ММ:СС';
        }
        return this;
    }

    /** Строка длиной не более max символов. */
    maxlen(field, max) {
        const v = this.data[field];
        if (v !== undefined && v !== null && String(v).length > max) {
            this.errors[field] = 'Не более ' + max + ' символов';
        }
        return this;
    }

    /** Значение из списка допустимых. */
    in(field, allowed) {
        const v = this.data[field];
        if (v !== undefined && v !== null && v !== '' && !allowed.includes(v)) {
            this.errors[field] = 'Недопустимое значение';
        }
        return this;
    }

    /** Проверить накопленные ошибки. */
    validate() {
        if (Object.keys(this.errors).length > 0) {
            throw new ApiError('Данные не прошли валидацию', 422, this.errors);
        }
        return this.data;
    }
}

/** Обёртка для асинхронных маршрутов: ошибки уходят в общий обработчик. */
function asyncRoute(handler) {
    return (req, res, next) => {
        handler(req, res).catch(next);
    };
}

/** Сегодня в формате ГГГГ-ММ-ДД. */
function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/** Дата, сдвинутая на days дней назад, в формате ГГГГ-ММ-ДД. */
function daysAgoISO(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

/**
 * Период из параметров запроса: ?from=&to=
 * По умолчанию: от самой ранней записи пользователя до сегодня.
 */
async function getPeriod(req) {
    let from = (req.query.from || '').trim();
    let to = (req.query.to || '').trim();
    const uid = req.session.userId;

    if (to === '') to = todayISO();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
        throw new ApiError('Параметр to должен быть датой ГГГГ-ММ-ДД', 422);
    }
    if (from !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        throw new ApiError('Параметр from должен быть датой ГГГГ-ММ-ДД', 422);
    }
    if (from === '') {
        const min = await queryValue(
            'SELECT MIN(d) FROM (' +
            '  SELECT MIN(entry_date) AS d FROM entries WHERE user_id = ?' +
            '  UNION ALL' +
            '  SELECT MIN(record_date) FROM daily_records WHERE user_id = ?' +
            ') t',
            [uid, uid]
        );
        from = min || daysAgoISO(90);
    }
    return { from: from, to: to };
}

module.exports = {
    ApiError, sendSuccess, sendError, Validator,
    asyncRoute, todayISO, daysAgoISO, getPeriod,
};
