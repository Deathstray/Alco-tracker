/**
 * ProfilePage.jsx — экран «Профиль и калькулятор»:
 * параметры пользователя (нужны формуле Видмарка)
 * и калькулятор промилле.
 */
import React, { useEffect, useState } from 'react';
import Api from '../api.js';

/** Порт формулы Видмарка на JavaScript (дубль бизнес-логики сервера). */
const Bac = {
    grams(volume, strength) { return volume * strength / 100 * 0.789; },
    promille(grams, weightKg, gender, hours) {
        const r = gender === 'female' ? 0.55 : 0.68;
        return Math.max(0, grams / (weightKg * r) - 0.15 * Math.max(0, hours));
    },
    sobering(promille) { return promille > 0.3 ? (promille - 0.3) / 0.15 : 0; },
};

export default function ProfilePage({ dicts, onLogout, onAuthError }) {
    const [profile, setProfile] = useState(null);
    const [profileError, setProfileError] = useState('');  // ошибка сохранения формы
    const [loadError, setLoadError] = useState('');        // ошибка загрузки профиля

    // поля калькулятора (по умолчанию — первый напиток справочника)
    const firstDrink = dicts.drinks.length > 0 ? dicts.drinks[0] : null;
    const [calc, setCalc] = useState({
        volume: firstDrink ? firstDrink.package_volume_ml : 500,
        strength: firstDrink ? Number(firstDrink.strength) : 5,
        hours: 0,
    });

    /** Загрузка профиля; ошибки — на экран, а не в вечную «Загрузку…». */
    async function loadProfile() {
        setLoadError('');
        try {
            setProfile(await Api.get('/api/profile'));
        } catch (e) {
            if (e.status === 401) { onAuthError(); return; }
            setLoadError(e.message || 'Не удалось загрузить профиль');
        }
    }

    useEffect(() => { loadProfile(); }, []);

    if (loadError) {
        return (
            <div className="empty">
                <b>Ошибка загрузки профиля</b><br />
                {loadError}<br /><br />
                <button className="btn btn--ghost" onClick={loadProfile}>Повторить</button>
            </div>
        );
    }

    if (profile === null) {
        return <div className="empty">Загрузка данных…</div>;
    }

    const weight = Number(profile.weight_kg) || 70;
    const gender = profile.gender;

    // пересчёт калькулятора при любом изменении полей
    const grams = Bac.grams(Number(calc.volume) || 0, Number(calc.strength) || 0);
    const promille = Bac.promille(grams, weight, gender, Number(calc.hours) || 0);
    const sober = Bac.sobering(promille);

    let desc = 'Алкоголь практически выведен';
    if (promille >= 3) desc = 'Опасная для жизни концентрация';
    else if (promille >= 2) desc = 'Сильное опьянение';
    else if (promille >= 1) desc = 'Средняя степень опьянения';
    else if (promille >= 0.3) desc = 'Лёгкая степень опьянения';

    function setProfileField(name, value) {
        setProfile(p => ({ ...p, [name]: value }));
    }

    function setCalcField(name, value) {
        setCalc(c => ({ ...c, [name]: value }));
    }

    /** Выбор напитка в калькуляторе: подставляем крепость и объём тары. */
    function onCalcDrinkChange(drinkId) {
        const drink = dicts.drinks.find(dr => String(dr.drink_id) === String(drinkId));
        if (!drink) return;
        setCalc({ volume: drink.package_volume_ml, strength: Number(drink.strength), hours: calc.hours });
    }

    async function onProfileSubmit(ev) {
        ev.preventDefault();
        setProfileError('');
        try {
            const updated = await Api.put('/api/profile', {
                name: profile.name.trim(),
                gender: profile.gender,
                birth_year: Number(profile.birth_year) || 2000,
                weight_kg: Number(profile.weight_kg) || 70,
                height_cm: Number(profile.height_cm) || 175,
            });
            setProfile(updated);
            window.alert('Профиль сохранён');
        } catch (e) {
            setProfileError(e.message);
        }
    }

    async function onLogout() {
        try {
            await Api.logout(); // сервер закрывает сессию
        } catch (e) {
            // сессия могла уже истечь — всё равно уходим на экран входа
        }
        onLogout();
    }

    return (
        <div>
            <div className="view-head">
                <div>
                    <h2 className="view-title">Профиль и калькулятор</h2>
                    <div className="view-sub">параметры нужны для расчёта промилле по формуле Видмарка</div>
                </div>
                <button className="btn btn--ghost btn--sm" type="button" onClick={onLogout}>Выйти</button>
            </div>

            <div className="panel">
                <h3 className="panel__title">Параметры пользователя</h3>
                <form onSubmit={onProfileSubmit}>
                    <div className="form-row">
                        <div className="field">
                            <label>Имя</label>
                            <input value={profile.name || ''} required maxLength="100"
                                   onChange={e => setProfileField('name', e.target.value)} />
                        </div>
                        <div className="field">
                            <label>Пол</label>
                            <select value={profile.gender}
                                    onChange={e => setProfileField('gender', e.target.value)}>
                                <option value="male">мужской</option>
                                <option value="female">женский</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Год рождения</label>
                            <input type="number" min="1930" max={new Date().getFullYear()}
                                   value={profile.birth_year || 2000}
                                   onChange={e => setProfileField('birth_year', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="field">
                            <label>Вес, кг</label>
                            <input type="number" min="30" max="250" step="0.5"
                                   value={Number(profile.weight_kg)}
                                   onChange={e => setProfileField('weight_kg', e.target.value)} />
                        </div>
                        <div className="field">
                            <label>Рост, см</label>
                            <input type="number" min="120" max="230"
                                   value={profile.height_cm || 175}
                                   onChange={e => setProfileField('height_cm', e.target.value)} />
                        </div>
                        <div className="field" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn" type="submit">Сохранить</button>
                        </div>
                    </div>
                    <div className="form-error">{profileError}</div>
                </form>
            </div>

            <div className="panel">
                <h3 className="panel__title">Калькулятор промилле</h3>
                <div className="form-row">
                    <div className="field">
                        <label>Напиток</label>
                        <select onChange={e => onCalcDrinkChange(e.target.value)}>
                            {dicts.drinks.map(dr => (
                                <option key={dr.drink_id} value={dr.drink_id}>
                                    {dr.drink_name}, {Number(dr.strength)}%
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="field">
                        <label>Объём, мл</label>
                        <input type="number" min="10" max="10000" step="10" value={calc.volume}
                               onChange={e => setCalcField('volume', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Крепость, %</label>
                        <input type="number" min="0" max="100" step="0.1" value={calc.strength}
                               onChange={e => setCalcField('strength', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Часов прошло</label>
                        <input type="number" min="0" max="24" step="0.5" value={calc.hours}
                               onChange={e => setCalcField('hours', e.target.value)} />
                    </div>
                </div>
                <div className="calc-result">
                    <div className="calc-result__row">
                        <span>Чистый спирт в порции</span>
                        <b>{grams.toFixed(1)} г ({(grams / 10).toFixed(1)} доз)</b>
                    </div>
                    <div className="calc-result__row">
                        <span>Ожидаемая концентрация</span>
                        <b>{promille.toFixed(2)} ‰ — {desc}</b>
                    </div>
                    <div className="calc-result__row">
                        <span>Время до 0,3 ‰</span>
                        <b>{sober > 0 ? sober.toFixed(1) + ' ч' : 'уже в норме'}</b>
                    </div>
                </div>
                <div className="calc-note">
                    Расчёт ориентировочный, по формуле Э. Видмарка (C = A / (m × r) − β × t),
                    не является медицинским заключением. Управление транспортным средством в состоянии
                    опьянения запрещено законом.
                </div>
            </div>
        </div>
    );
}
