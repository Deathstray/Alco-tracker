/**
 * RegisterPage.jsx — экран регистрации: учётная запись
 * + параметры для расчёта промилле по формуле Видмарка.
 */
import React, { useState } from 'react';
import Api from '../api.js';

export default function RegisterPage({ onLogin, onGoLogin }) {
    const [form, setForm] = useState({
        login: '', password: '', name: '', gender: 'male', weight_kg: 70,
    });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    function setField(name, value) {
        setForm(f => ({ ...f, [name]: value }));
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        setBusy(true);
        setError('');
        try {
            const user = await Api.register({
                login: form.login.trim(),
                password: form.password,
                name: form.name.trim(),
                gender: form.gender,
                weight_kg: Number(form.weight_kg) || 70,
            });
            onLogin(user);
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="login">
            <div className="panel login__panel">
                <h2 className="panel__title">Регистрация</h2>
                <form onSubmit={onSubmit}>
                    <div className="field">
                        <label>Логин (латиница, 3–30 символов)</label>
                        <input value={form.login} autoComplete="username" required
                               maxLength="30" pattern="[a-zA-Z0-9_-]{3,30}"
                               onChange={e => setField('login', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Пароль (не короче 6 символов)</label>
                        <input type="password" value={form.password} autoComplete="new-password"
                               required minLength="6"
                               onChange={e => setField('password', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Имя</label>
                        <input value={form.name} maxLength="100"
                               placeholder="как к вам обращаться"
                               onChange={e => setField('name', e.target.value)} />
                    </div>
                    <div className="form-row">
                        <div className="field">
                            <label>Пол</label>
                            <select value={form.gender} onChange={e => setField('gender', e.target.value)}>
                                <option value="male">мужской</option>
                                <option value="female">женский</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Вес, кг</label>
                            <input type="number" min="30" max="250" step="0.5" value={form.weight_kg}
                                   onChange={e => setField('weight_kg', e.target.value)} />
                        </div>
                    </div>
                    <div className="form-error">{error}</div>
                    <button className="btn btn--block" type="submit" disabled={busy}>
                        {busy ? 'Создаём…' : 'Создать аккаунт'}
                    </button>
                </form>
                <button className="btn btn--ghost btn--block login__alt" type="button"
                        onClick={onGoLogin}>
                    У меня есть аккаунт
                </button>
            </div>
        </div>
    );
}
