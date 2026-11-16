/**
 * calc.js — расчётное ядро бизнес-логики.
 *
 * Ключевые понятия:
 *  - «Чистый спирт» A (г) = объём (мл) × крепость (%) / 100 × плотность этанола 0,789 г/мл;
 *  - «Стандартная доза» — 10 г чистого этанола (рекомендация ВОЗ);
 *  - Промилле (‰) — концентрация алкоголя в крови по формуле Э. Видмарка (1932):
 *        C = A / (m × r) − β × t,
 *    где m — масса тела (кг), r — фактор распределения (0,68 муж / 0,55 жен),
 *    β — скорость элиминации 0,15 ‰/ч, t — время с начала употребления (ч).
 *
 * ВНИМАНИЕ: расчёт ориентировочный, не является медицинским диагнозом.
 */
module.exports = {

    ETHANOL_DENSITY: 0.789, // плотность этанола, г/мл
    DOSE_GRAMS: 10.0,       // одна стандартная доза = 10 г спирта
    BURN_RATE: 0.15,        // выведение алкоголя, ‰/час
    R_MALE: 0.68,           // фактор распределения Видмарка (мужчины)
    R_FEMALE: 0.55,         // фактор распределения Видмарка (женщины)

    // масса чистого этанола в порции, граммы
    pureAlcoholGrams(volumeMl, strengthPct) {
        if (volumeMl < 0 || strengthPct < 0) return 0.0;
        return Math.round(volumeMl * (strengthPct / 100) * this.ETHANOL_DENSITY * 10) / 10;
    },

    // количество стандартных доз (1 доза = 10 г) в порции
    standardDoses(volumeMl, strengthPct) {
        return Math.round(this.pureAlcoholGrams(volumeMl, strengthPct) / this.DOSE_GRAMS * 100) / 100;
    },

    /**
     * Ожидаемая концентрация алкоголя в крови, ‰ (формула Видмарка).
     * hoursPassed — часов с начала употребления.
     */
    promille(grams, weightKg, gender, hoursPassed = 0) {
        if (weightKg <= 0 || grams <= 0) return 0.0;
        const r = gender === 'female' ? this.R_FEMALE : this.R_MALE;
        const c = grams / (weightKg * r) - this.BURN_RATE * Math.max(0, hoursPassed);
        return Math.round(Math.max(0, c) * 100) / 100;
    },

    // время вытрезвления до 0,3 ‰ (условной нормы для вождения), часы
    soberingHours(promille) {
        if (promille <= 0.3) return 0.0;
        return Math.round((promille - 0.3) / this.BURN_RATE * 10) / 10;
    },

    /**
     * Внутренняя шкала приложения по недельному числу доз
     * (адаптированная классификация, не медицинский диагноз):
     *   0 — «трезвая неделя»; ≤5 — низкий; 6–10 — умеренный;
     *   11–15 — повышенный; >15 — высокий уровень.
     */
    riskLevel(weeklyDoses) {
        if (weeklyDoses <= 0.01) return { code: 'sober',     label: 'Трезвая неделя',    color: 'good' };
        if (weeklyDoses <= 5)     return { code: 'low',      label: 'Низкий уровень',    color: 'good' };
        if (weeklyDoses <= 10)    return { code: 'medium',   label: 'Умеренный уровень', color: 'warn' };
        if (weeklyDoses <= 15)    return { code: 'high',     label: 'Повышенный уровень', color: 'warn' };
        return { code: 'very_high', label: 'Высокий уровень', color: 'bad' };
    },

    // текстовое описание промилле (внутренняя подсказка приложения)
    promilleDescription(promille) {
        if (promille < 0.3) return 'Алкоголь практически выведен';
        if (promille < 1.0) return 'Лёгкая степень опьянения';
        if (promille < 2.0) return 'Средняя степень опьянения';
        if (promille < 3.0) return 'Сильное опьянение';
        return 'Опасная для жизни концентрация';
    },
};
