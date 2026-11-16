/**
 * tests/run_tests.js — юнит-тесты бизнес-логики.
 *
 * Запуск (из каталога server):  npm test
 * Тесты не требуют подключения к базе — проверяется чистая логика расчётов.
 * Каждое сравнение печатается отдельной строкой: OK / FAIL.
 */
const calc = require('../calc');
const bcrypt = require('bcryptjs');
const { Validator } = require('../helpers');

let passed = 0;
let failed = 0;

/** Проверить: фактическое значение строго равно ожидаемому. */
function check(name, actual, expected) {
    const ok = actual === expected;
    console.log((ok ? '  [OK]   ' : '  [FAIL] ') + name
        + ' — получено: ' + JSON.stringify(actual)
        + (ok ? '' : ', ожидалось: ' + JSON.stringify(expected)));
    ok ? passed++ : failed++;
}

console.log('═══ Тесты расчётного ядра (calc.js) ═══');

console.log('— Чистый спирт, г —');
check('500 мл пива 5% → 19,7 г',   calc.pureAlcoholGrams(500, 5), 19.7);
check('100 мл водки 40% → 31,6 г', calc.pureAlcoholGrams(100, 40), 31.6);
check('200 мл вина 12% → 18,9 г',  calc.pureAlcoholGrams(200, 12), 18.9);
check('0 мл → 0 г',                calc.pureAlcoholGrams(0, 40), 0.0);
check('отрицательный объём → 0 г', calc.pureAlcoholGrams(-10, 40), 0.0);
check('кофе 0% → 0 г',             calc.pureAlcoholGrams(250, 0), 0.0);

console.log('— Стандартные дозы (1 доза = 10 г) —');
check('500 мл пива 5% → 1,97 дозы',    calc.standardDoses(500, 5), 1.97);
check('100 мл водки 40% → 3,16 дозы',  calc.standardDoses(100, 40), 3.16);
check('бутылка вина 750 мл 12% → 7,1 дозы', calc.standardDoses(750, 12), 7.1);

console.log('— Промилле по Видмарку —');
// 31,56 г / (85 кг × 0,68) = 0,55 ‰
check('31,56 г, мужчина 85 кг, сейчас → 0,55‰',
    calc.promille(31.56, 85, 'male', 0), 0.55);
// 31,56 г / (60 кг × 0,55) = 0,96‰
check('31,56 г, женщина 60 кг, сейчас → 0,96‰',
    calc.promille(31.56, 60, 'female', 0), 0.96);
// 0,55 − 0,15 × 2 = 0,25‰
check('31,56 г, мужчина 85 кг, спустя 2 ч → 0,25‰',
    calc.promille(31.56, 85, 'male', 2), 0.25);
// элиминация ниже нуля не уходит
check('спустя 10 ч → 0‰', calc.promille(31.56, 85, 'male', 10), 0.0);
check('нулевая масса → 0‰', calc.promille(31.56, 0, 'male', 0), 0.0);

console.log('— Время вытрезвления —');
check('0,55‰ → 1,7 ч до 0,3‰', calc.soberingHours(0.55), 1.7);
check('1,5‰ → 8,0 ч до 0,3‰',  calc.soberingHours(1.5), 8.0);
check('0,2‰ → уже норма',      calc.soberingHours(0.2), 0.0);

console.log('— Шкала риска (внутренняя классификация приложения) —');
check('0 доз/нед → трезвая неделя', calc.riskLevel(0).code, 'sober');
check('4 дозы/нед → низкий',        calc.riskLevel(4).code, 'low');
check('8 доз/нед → умеренный',      calc.riskLevel(8).code, 'medium');
check('12 доз/нед → повышенный',    calc.riskLevel(12).code, 'high');
check('20 доз/нед → высокий',       calc.riskLevel(20).code, 'very_high');

console.log('— Описание промилле —');
check('0,1‰ → выведен',  calc.promilleDescription(0.1), 'Алкоголь практически выведен');
check('0,5‰ → лёгкая',   calc.promilleDescription(0.5), 'Лёгкая степень опьянения');
check('1,5‰ → средняя',  calc.promilleDescription(1.5), 'Средняя степень опьянения');
check('3,5‰ → опасная',  calc.promilleDescription(3.5), 'Опасная для жизни концентрация');

console.log('— Валидация входных данных (helpers.Validator) —');

/** Применить правила к данным: null — ошибок нет, иначе объект ошибок. */
function validate(data, apply) {
    const v = new Validator(data);
    apply(v);
    try {
        v.validate();
        return null;
    } catch (e) {
        return e.details;
    }
}

check('время «18:30» — корректно', validate({ t: '18:30' }, v => v.time('t')), null);
check('время «18:30:59» — корректно', validate({ t: '18:30:59' }, v => v.time('t')), null);
check('пустое время пропускается (поле необязательное)', validate({}, v => v.time('t')), null);
check('время «25:00» — ошибка (час > 23)', validate({ t: '25:00' }, v => v.time('t')) !== null, true);
check('время «18:99» — ошибка (минуты > 59)', validate({ t: '18:99' }, v => v.time('t')) !== null, true);
check('время «abc» — ошибка (не время)', validate({ t: 'abc' }, v => v.time('t')) !== null, true);
check('строка 101 символ — ошибка maxlen',
    validate({ n: 'а'.repeat(101) }, v => v.maxlen('n', 100)) !== null, true);
check('строка 100 символов — корректно',
    validate({ n: 'а'.repeat(100) }, v => v.maxlen('n', 100)), null);
check('целое 0 вне диапазона 1..5 — ошибка', validate({ x: 0 }, v => v.int('x', 1, 5)) !== null, true);
check('целое 3 в диапазоне 1..5 — корректно', validate({ x: 3 }, v => v.int('x', 1, 5)), null);
check('число 30 в диапазоне 30..250 — корректно',
    validate({ w: 30 }, v => v.number('w', 30, 250)), null);
check('дата «2026-13-01» — ошибка (месяц 13)',
    validate({ d: '2026-13-01' }, v => v.date('d')) !== null, true);

console.log('— Авторизация: хэш пароля (bcrypt) —');
const hash = bcrypt.hashSync('demo123', 10);
check('верный пароль подтверждается',
    bcrypt.compareSync('demo123', hash), true);
check('неверный пароль отклоняется',
    bcrypt.compareSync('wrong6', hash), false);
check('соль случайная — два хэша различаются',
    hash !== bcrypt.hashSync('demo123', 10), true);
check('хэш из дампа базы распознаётся bcryptjs',
    bcrypt.compareSync('demo123', '$2y$10$kDOoob5niTZvA1D3jZkLHeUe.ZJL.zKb5uIZc8lzq4UcyGK1Km3HK'), true);

console.log('— Авторизация: формат логина (как в routes/auth.js) —');
check('demo — допустимый логин',
    /^[a-z0-9_-]{3,30}$/.test('demo'), true);
check('кириллица и пробелы — недопустимый логин',
    /^[a-z0-9_-]{3,30}$/.test('Демо Пользователь'), false);

console.log('\n═══ Итог: ' + passed + ' OK, ' + failed + ' FAIL ═══');
process.exit(failed > 0 ? 1 : 0);
