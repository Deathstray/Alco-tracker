/**
 * tests/api_tests.js — интеграционные тесты REST API.
 *
 * Запуск: сначала поднимите сервер (npm start), затем
 *         node tests/api_tests.js
 *
 * Тесты проходят по HTTP, как обычный клиент: вход под демо-учёткой,
 * обход всех маршрутов, создание/изменение/удаление тестовой записи.
 * Сессия передаётся cookie, как в браузере.
 */
const BASE = 'http://localhost:3000';

let passed = 0;
let failed = 0;
let cookie = ''; // cookie сессии (connect.sid)

/** Проверить условие и посчитать результат. */
function check(name, ok, extra) {
    console.log((ok ? '  [OK]   ' : '  [FAIL] ') + name + (ok || !extra ? '' : ' — ' + extra));
    ok ? passed++ : failed++;
}

/** Запрос к API с JSON-телом и cookie сессии. */
async function call(method, url, body) {
    const options = {
        method: method,
        headers: {},
    };
    if (cookie) options.headers['Cookie'] = cookie;
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }
    const response = await fetch(BASE + url, options);
    // запоминаем cookie сессии после входа/регистрации
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return response;
}

async function callJson(method, url, body) {
    const response = await call(method, url, body);
    let json = null;
    try { json = await response.json(); } catch (e) { /* не JSON */ }
    return { status: response.status, json: json };
}

async function main() {
    console.log('═══ Интеграционные тесты REST API ═══');

    /* ── Авторизация ── */
    let r = await callJson('GET', '/api/auth/me');
    check('без входа /api/auth/me → 401', r.status === 401);

    r = await callJson('GET', '/api/drinks');
    check('без входа справочники закрыты → 401', r.status === 401);

    r = await callJson('POST', '/api/auth/login', { login: 'demo', password: 'неверный' });
    check('неверный пароль → 401', r.status === 401);

    r = await callJson('POST', '/api/auth/login', { login: 'demo', password: 'demo123' });
    check('вход demo/demo123 → 200', r.status === 200, JSON.stringify(r.json));

    r = await callJson('GET', '/api/auth/me');
    check('после входа /api/auth/me → профиль', r.status === 200 && r.json.data.login === 'demo');

    /* ── Справочники ── */
    r = await callJson('GET', '/api/types');
    check('типы напитков: 6', r.status === 200 && r.json.data.length === 6);

    r = await callJson('GET', '/api/drinks');
    check('напитки: 20', r.status === 200 && r.json.data.length === 20);

    r = await callJson('GET', '/api/drinks?type_id=1');
    check('фильтр напитков по типу работает', r.status === 200 &&
        r.json.data.every(d => d.type_id === 1));

    r = await callJson('GET', '/api/places');
    check('места: 6', r.status === 200 && r.json.data.length === 6);

    r = await callJson('GET', '/api/reasons');
    check('поводы: 7', r.status === 200 && r.json.data.length === 7);

    r = await callJson('GET', '/api/companies');
    check('компании: 5', r.status === 200 && r.json.data.length === 5);

    /* ── Записи дневника ── */
    r = await callJson('GET', '/api/entries');
    check('записи дневника: 111', r.status === 200 && r.json.data.length === 111,
        'получено: ' + (r.json && r.json.data ? r.json.data.length : '?'));

    r = await callJson('POST', '/api/entries', { drink_id: 0, entry_date: '2026-01-01', volume_ml: 500 });
    check('создание с drink_id=0 → 422', r.status === 422);

    r = await callJson('GET', '/api/entries?from=bad-date');
    check('период с неверной датой → 422', r.status === 422);

    r = await callJson('POST', '/api/entries', {
        drink_id: 1, entry_date: '2026-01-01', entry_time: '25:90', volume_ml: 500,
    });
    check('создание с временем «25:90» → 422 (валидация времени)', r.status === 422);

    r = await callJson('POST', '/api/entries', {
        drink_id: 1, entry_date: '2026-01-01', entry_time: '21:00',
        volume_ml: 500, strength: 4.9, price: 75,
    });
    check('создание записи → 201', r.status === 201, JSON.stringify(r.json));
    const newId = r.status === 201 ? r.json.data.entry_id : 0;

    if (newId > 0) {
        // PUT с place_id присваивает место записи
        const placesList = (await callJson('GET', '/api/places')).json.data;
        r = await callJson('PUT', '/api/entries/' + newId, {
            drink_id: 1, entry_date: '2026-01-01', entry_time: '21:30',
            volume_ml: 1000, strength: 4.9, price: 150, place_id: placesList[1].id,
        });
        check('изменение записи (с местом) → 200, объём обновлён',
            r.status === 200 && Number(r.json.data.volume_ml) === 1000);

        // дозы считаются представлением: 1000 мл × 4,9% × 0,789 / 10 = 3,87
        check('дозы пересчитаны: 3,87', Number(r.json.data.doses) === 3.87,
            'получено: ' + (r.json.data ? r.json.data.doses : '?'));

        // PUT без place_id не затирает прежнее место (баг фикс: поля
        // сохраняются, если их не прислали в теле запроса)
        r = await callJson('PUT', '/api/entries/' + newId, {
            drink_id: 1, entry_date: '2026-01-01', entry_time: '21:30',
            volume_ml: 1000, strength: 4.9, price: 150,
        });
        check('PUT без place_id сохраняет прежнее место',
            r.status === 200 && r.json.data.place_name === placesList[1].name,
            'получено: ' + (r.json.data ? r.json.data.place_name : '?'));

        r = await callJson('DELETE', '/api/entries/' + newId);
        check('удаление записи → 200', r.status === 200 && r.json.data.deleted === newId);

        r = await callJson('DELETE', '/api/entries/' + newId);
        check('повторное удаление → 404', r.status === 404);
    }

    /* ── Два разных напитка в одну и ту же минуту ──
     * Уникальный ключ таблицы включает drink_id, поэтому разные напитки
     * в одну минуту записать можно, а точный дубль — нельзя. */
    const dupIds = [];
    r = await callJson('POST', '/api/entries', {
        drink_id: 1, entry_date: '2026-01-01', entry_time: '21:00',
        volume_ml: 500, strength: 4.9, price: 75,
    });
    check('первый напиток в 21:00 → 201', r.status === 201);
    if (r.status === 201) dupIds.push(r.json.data.entry_id);

    r = await callJson('POST', '/api/entries', {
        drink_id: 2, entry_date: '2026-01-01', entry_time: '21:00',
        volume_ml: 500, strength: 5.4, price: 120,
    });
    check('другой напиток в ту же минуту → тоже 201', r.status === 201, JSON.stringify(r.json));
    if (r.status === 201) dupIds.push(r.json.data.entry_id);

    r = await callJson('POST', '/api/entries', {
        drink_id: 1, entry_date: '2026-01-01', entry_time: '21:00',
        volume_ml: 500, strength: 4.9, price: 75,
    });
    check('точный дубль (тот же напиток в ту же минуту) → 422', r.status === 422);

    // убираем тестовые записи, чтобы дневник остался «111 записей»
    for (const id of dupIds) await callJson('DELETE', '/api/entries/' + id);

    r = await callJson('GET', '/api/entries');
    check('после удаления снова 111 записей', r.status === 200 && r.json.data.length === 111);

    /* ── Ежедневные показатели ── */
    r = await callJson('GET', '/api/daily');
    check('ежедневные показатели: 92 дня', r.status === 200 && r.json.data.length === 92,
        'получено: ' + (r.json && r.json.data ? r.json.data.length : '?'));

    r = await callJson('POST', '/api/daily', {
        record_date: '2026-01-01', sleep_quality: 4, morning_condition: 5, note: 'тест',
    });
    check('сохранение оценки дня → 201', r.status === 201);

    r = await callJson('POST', '/api/daily', {
        record_date: '2026-01-01', sleep_quality: 3, morning_condition: 4, note: 'обновлено',
    });
    check('повторное сохранение — атомарный UPSERT → 200 (обновление)', r.status === 200);

    r = await callJson('GET', '/api/daily?from=2026-01-01&to=2026-01-01');
    check('оценка дня обновилась (сон 3, заметка «обновлено»)',
        r.status === 200 && r.json.data.length === 1 && Number(r.json.data[0].sleep_quality) === 3
            && r.json.data[0].note === 'обновлено');

    /* ── Профиль ── */
    r = await callJson('GET', '/api/profile');
    check('профиль получен', r.status === 200 && r.json.data.login === 'demo');

    r = await callJson('PUT', '/api/profile', {
        name: 'Демо-пользователь', gender: 'male',
        birth_year: 1998, weight_kg: 85, height_cm: 180,
    });
    // MySQL (DECIMAL) возвращает вес строкой '85.0', SQLite — числом 85,
    // поэтому сравниваем как число: контракт API — «вес в кг»
    check('обновление профиля → 200', r.status === 200 && Number(r.json.data.weight_kg) === 85);

    /* ── Аналитика ── */
    r = await callJson('GET', '/api/stats?mode=summary');
    check('сводка: период считается', r.status === 200 && r.json.data.days_in_period >= 90);

    r = await callJson('GET', '/api/stats?mode=by_weekday');
    check('дозы по дням недели: все 7 ключей',
        r.status === 200 && Object.keys(r.json.data).length === 7);

    // результат через представление vw_weekday_stats (вся история) должен
    // совпадать с прямым запросом за период, покрывающий всю историю
    const wdAll = r.json.data;
    r = await callJson('GET', '/api/stats?mode=by_weekday&from=2026-01-01&to=2026-12-31');
    check('дозы по дням недели за период → 200', r.status === 200);
    check('представление vw_weekday_stats = прямому запросу за период',
        JSON.stringify(wdAll) === JSON.stringify(r.json.data));

    r = await callJson('GET', '/api/stats?mode=by_type');
    check('дозы по типам: есть данные', r.status === 200 && r.json.data.length > 0);

    r = await callJson('GET', '/api/stats?mode=trend');
    check('тренд: 35 дней с алкоголем', r.status === 200 && r.json.data.length === 35,
        'получено: ' + (r.json && r.json.data ? r.json.data.length : '?'));

    r = await callJson('GET', '/api/stats?mode=top_drinks');
    check('топ напитков: не пусто', r.status === 200 && r.json.data.length > 0);

    r = await callJson('GET', '/api/stats?mode=unknown_mode');
    check('неизвестный режим → 422', r.status === 422);

    r = await callJson('GET', '/api/unknown_path');
    check('неизвестный маршрут API → 404 в формате JSON',
        r.status === 404 && r.json !== null && r.json.ok === false);

    /* ── Экспорт CSV ── */
    const response = await call('GET', '/api/entries/export');
    const csvBytes = new Uint8Array(await response.arrayBuffer());
    const csvText = new TextDecoder().decode(csvBytes);
    check('экспорт CSV: HTTP 200', response.status === 200);
    check('экспорт CSV: BOM на месте (EF BB BF)',
        csvBytes[0] === 0xEF && csvBytes[1] === 0xBB && csvBytes[2] === 0xBF);
    check('экспорт CSV: 112 строк (заголовок + 111 записей)',
        csvText.trim().split('\n').length === 112,
        'строк: ' + csvText.trim().split('\n').length);

    /* ── Регистрация и выход ── */
    r = await callJson('POST', '/api/auth/register', {
        login: 'кириллица', password: '123456',
    });
    check('регистрация с кириллицей в логине → 422', r.status === 422);

    r = await callJson('POST', '/api/auth/register', {
        login: 'test_weight', password: 'test123456', weight_kg: 500,
    });
    check('регистрация с весом 500 кг → 422 (диапазон 30–250)', r.status === 422);

    cookie = ''; // регистрация проверяется без текущей сессии
    r = await callJson('POST', '/api/auth/register', {
        login: 'test_user', password: 'test123456', name: 'Тестовый',
    });
    check('регистрация test_user → 201', r.status === 201, JSON.stringify(r.json));

    r = await callJson('GET', '/api/auth/me');
    check('после регистрации пользователь сразу вошёл',
        r.status === 200 && r.json.data.login === 'test_user');

    r = await callJson('GET', '/api/entries');
    check('у нового пользователя дневник пуст (изоляция данных)',
        r.status === 200 && r.json.data.length === 0);

    r = await callJson('POST', '/api/auth/logout');
    check('выход → 200', r.status === 200);

    r = await callJson('GET', '/api/auth/me');
    check('после выхода /api/auth/me → 401', r.status === 401);

    /* ── Очистка тестовых данных (чтобы тесты можно было запускать повторно) ── */
    const db = require('../db');
    await db.execute("DELETE FROM daily_records WHERE user_id = 1 AND record_date = '2026-01-01'");
    await db.execute("DELETE FROM users WHERE login = 'test_user'");
    console.log('Тестовые данные удалены (оценка дня 2026-01-01, пользователь test_user)');
    // пул есть только в режиме MySQL; во встроенном SQLite закрывать нечего
    if (db.pool) await db.pool.end();

    console.log('\n═══ Итог: ' + passed + ' OK, ' + failed + ' FAIL ═══');
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Не удалось выполнить тесты: ' + e.message);
    console.error('Проверьте, что сервер запущен: npm start');
    process.exit(1);
});
