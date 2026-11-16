/**
 * format.js — вспомогательные функции форматирования (даты, суммы, склонения).
 */

// Дата «2026-10-02» → «пятница, 2 октября 2026»
export function fmtDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const days = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
}

// короткая дата: 2026-10-02 → 02.10
export function fmtShort(iso) {
    return iso.slice(8, 10) + '.' + iso.slice(5, 7);
}

// сегодня в формате ГГГГ-ММ-ДД
export function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
}

// сейчас в формате ЧЧ:ММ
export function nowHM() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// склонение: plural(5, ['день','дня','дней'])
export function plural(n, forms) {
    const abs = Math.abs(n) % 100;
    const n1 = abs % 10;
    if (abs > 10 && abs < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
}

// форматирование суммы: 16346 → «16 346 ₽»
export function fmtMoney(v) {
    return Math.round(Number(v)).toLocaleString('ru-RU') + ' ₽';
}

// значок типа напитка (краткий текст в плашке)
export function typeMark(typeName) {
    const map = {
        'Пиво': 'пиво', 'Вино': 'вино', 'Крепкий алкоголь': 'крепк.',
        'Коктейли': 'кокт.', 'Кофе': 'кофе', 'Энергетики': 'энерг.',
    };
    return map[typeName] || typeName;
}
