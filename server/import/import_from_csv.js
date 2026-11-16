/**
 * import/import_from_csv.js — перенос исходных данных в базу MySQL.
 *
 * Реализует этап демо-экзамена «перенести данные из Excel в БД»:
 * исходные таблицы (data/*.xlsx) пересохраняются в CSV (data/csv/*.csv,
 * разделитель «;», кодировка UTF-8) и загружаются в базу alkotracker.
 *
 * Запуск из каталога server:
 *     npm run import
 * или:
 *     node import/import_from_csv.js [--csv-dir=data/csv] [--force]
 *
 * Скрипт можно запускать повторно: записи не дублируются,
 * а параметр --force очищает дневник перед загрузкой.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../db');

/* ─────────── Разбор аргументов командной строки ─────────── */
const args = process.argv.slice(2);
function hasFlag(name) { return args.includes('--' + name); }
function getOption(name) {
    const i = args.indexOf('--' + name);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

const csvDir = getOption('csv-dir') || path.join(__dirname, '..', 'data', 'csv');
const force = hasFlag('force');

if (!fs.existsSync(csvDir)) {
    console.error('Каталог с CSV не найден: ' + csvDir);
    process.exit(1);
}

/**
 * Прочитать CSV-файл: первая строка — заголовки (кириллица),
 * далее — строки данных. Возвращает массив объектов.
 */
function readCsv(fileName) {
    const filePath = path.join(csvDir, fileName);
    if (!fs.existsSync(filePath)) return [];

    let text = fs.readFileSync(filePath, 'utf8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // снять BOM

    const rows = [];
    let headers = null;
    for (const line of text.split(/\r?\n/)) {
        if (line.trim() === '') continue; // пропускаем пустые строки
        const cells = line.split(';');
        if (headers === null) {
            headers = cells;
            continue;
        }
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i] : ''; });
        rows.push(row);
    }
    return rows;
}

/** Строка «Да/Нет» → 1/0 (для столбца «Алкогольный»). */
function yesNo(v) {
    return ['1', 'да', 'Да', 'ДА', 'yes', 'true'].includes(String(v).trim()) ? 1 : 0;
}

/** «3,14» → 3.14 (десятичная запятая в исходных таблицах). */
function toNumber(v) {
    return Number(String(v).replace(',', '.'));
}

async function main() {
    /* ─────────── 0. Первый пользователь базы (для --force и импорта) ─────────── */
    let user = await db.queryOne('SELECT * FROM users ORDER BY user_id LIMIT 1');

    /* ─────────── 1. Очистка (только по явному --force) ─────────── */
    if (force) {
        if (user !== null) {
            await db.execute('DELETE FROM entries WHERE user_id = ?', [user.user_id]);
            await db.execute('DELETE FROM daily_records WHERE user_id = ?', [user.user_id]);
            console.log('Дневник очищен (--force, user_id=' + user.user_id + ')');
        } else {
            console.log('Дневник пуст (--force): пользователей в базе ещё нет');
        }
    }

    /* ─────────── 2. Профиль пользователя ───────────
     * В users.csv логина и пароля нет (в исходных Excel их не было):
     * учётной записи назначается логин demo и пароль demo123,
     * пароль сразу же хэшируется bcrypt.
     */
    if (user === null) {
        const u = readCsv('users.csv');
        if (u.length > 0) {
            await db.insert(
                'INSERT INTO users (login, password_hash, name, gender, birth_year, weight_kg, height_cm)' +
                ' VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    'demo',
                    bcrypt.hashSync('demo123', 10),
                    u[0]['Имя'],
                    u[0]['Пол'] === 'female' || u[0]['Пол'] === 'жен' ? 'female' : 'male',
                    Number(u[0]['Год рождения']),
                    toNumber(u[0]['Вес, кг']),
                    Number(u[0]['Рост, см']),
                ]
            );
            user = await db.queryOne('SELECT * FROM users ORDER BY user_id LIMIT 1');
            console.log('Создана учётная запись: логин demo, пароль demo123');
        }
    }
    const userId = user !== null ? user.user_id : 1;

    /* ─────────── 2. Справочники ─────────── */
    for (const row of readCsv('drink_types.csv')) {
        const exists = await db.queryOne(
            'SELECT type_id FROM drink_types WHERE type_name = ?', [row['Название']]);
        if (exists === null) {
            await db.insert(
                'INSERT INTO drink_types (type_name, is_alcoholic, default_strength) VALUES (?, ?, ?)',
                [row['Название'], yesNo(row['Алкогольный']), toNumber(row['Крепость по умолчанию, %'])]
            );
        }
    }
    console.log('Типы напитков: ' + await db.queryValue('SELECT COUNT(*) FROM drink_types') + ' строк');

    for (const row of readCsv('drinks.csv')) {
        // в CSV тип может быть указан кодом (справочник «Типы напитков»)
        // или названием — поддерживаем оба варианта
        const typeKey = String(row['Тип напитка']).trim();
        const type = /^\d+$/.test(typeKey)
            ? await db.queryOne('SELECT * FROM drink_types WHERE type_id = ?', [Number(typeKey)])
            : await db.queryOne('SELECT * FROM drink_types WHERE type_name = ?', [typeKey]);
        if (type === null) {
            console.error('Тип не найден: ' + row['Тип напитка']);
            continue;
        }
        const exists = await db.queryOne(
            'SELECT drink_id FROM drinks WHERE drink_name = ?', [row['Название']]);
        if (exists === null) {
            await db.insert(
                'INSERT INTO drinks (type_id, drink_name, strength, package_volume_ml, default_price)' +
                ' VALUES (?, ?, ?, ?, ?)',
                [
                    type.type_id,
                    row['Название'],
                    toNumber(row['Крепость, %']),
                    Number(row['Объём тары, мл']),
                    toNumber(row['Цена по умолчанию, руб.']),
                ]
            );
        }
    }
    console.log('Напитки: ' + await db.queryValue('SELECT COUNT(*) FROM drinks') + ' строк');

    const dicts = [
        ['places.csv', 'places', 'place_name'],
        ['reasons.csv', 'reasons', 'reason_name'],
        ['companies.csv', 'companies', 'company_name'],
    ];
    for (const [file, table, column] of dicts) {
        for (const row of readCsv(file)) {
            const exists = await db.queryOne(
                'SELECT * FROM ' + table + ' WHERE ' + column + ' = ?', [row['Название']]);
            if (exists === null) {
                await db.insert(
                    'INSERT INTO ' + table + ' (' + column + ') VALUES (?)',
                    [row['Название']]
                );
            }
        }
    }
    console.log('Места: ' + await db.queryValue('SELECT COUNT(*) FROM places')
        + ', поводы: ' + await db.queryValue('SELECT COUNT(*) FROM reasons')
        + ', компании: ' + await db.queryValue('SELECT COUNT(*) FROM companies'));

    /* ─────────── 3. Записи дневника ─────────── */
    let imported = 0;
    let skipped = 0;
    for (const row of readCsv('entries.csv')) {
        const drink = await db.queryOne(
            'SELECT * FROM drinks WHERE drink_name = ?', [row['Напиток']]);
        if (drink === null) {
            console.error('Напиток не найден: ' + row['Напиток'] + ' — строка пропущена');
            skipped++;
            continue;
        }
        const place   = await db.queryOne('SELECT * FROM places   WHERE place_name   = ?', [row['Место']]);
        const reason  = await db.queryOne('SELECT * FROM reasons  WHERE reason_name  = ?', [row['Повод']]);
        const company = await db.queryOne('SELECT * FROM companies WHERE company_name = ?', [row['Компания']]);

        // защита от повторного импорта одной и той же записи
        // (совпадает с уникальным ключом таблицы: пользователь+дата+время+напиток)
        const exists = await db.queryValue(
            'SELECT COUNT(*) FROM entries' +
            ' WHERE user_id = ? AND entry_date = ? AND entry_time = ? AND drink_id = ?',
            [userId, row['Дата'], row['Время'] + ':00', drink.drink_id]
        );
        if (Number(exists) > 0) {
            skipped++;
            continue;
        }

        await db.insert(
            'INSERT INTO entries' +
            ' (user_id, drink_id, entry_date, entry_time, volume_ml, strength, price, place_id, reason_id, company_id)' +
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                userId,
                drink.drink_id,
                row['Дата'],
                row['Время'] + ':00',
                Number(row['Объём, мл']),
                toNumber(row['Крепость, %']),
                toNumber(row['Цена, руб.']),
                place !== null ? place.place_id : null,
                reason !== null ? reason.reason_id : null,
                company !== null ? company.company_id : null,
            ]
        );
        imported++;
    }
    console.log('Записи дневника: импортировано ' + imported + ', пропущено ' + skipped);

    /* ─────────── 4. Ежедневные показатели ─────────── */
    let importedDaily = 0;
    for (const row of readCsv('daily_records.csv')) {
        const exists = await db.queryValue(
            'SELECT COUNT(*) FROM daily_records WHERE user_id = ? AND record_date = ?',
            [userId, row['Дата']]
        );
        if (Number(exists) > 0) continue;

        const sleep = row['Качество сна (1-5)'] === '' ? null : Number(row['Качество сна (1-5)']);
        const morning = row['Утреннее состояние (1-5)'] === '' ? null : Number(row['Утреннее состояние (1-5)']);
        await db.insert(
            'INSERT INTO daily_records (user_id, record_date, sleep_quality, morning_condition, note)' +
            ' VALUES (?, ?, ?, ?, ?)',
            [userId, row['Дата'], sleep, morning,
                row['Заметка'] !== '' ? row['Заметка'] : null]
        );
        importedDaily++;
    }
    console.log('Ежедневные показатели: импортировано ' + importedDaily);

    console.log('\nИмпорт завершён.');
    process.exit(0);
}

main().catch(e => {
    console.error('Ошибка импорта: ' + e.message);
    console.error('Проверьте настройки в server/config.js и что база alkotracker создана.');
    process.exit(1);
});
