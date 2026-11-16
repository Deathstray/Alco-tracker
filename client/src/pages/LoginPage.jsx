/**
 * LoginPage.jsx — экран входа: логин и пароль,
 * переключение на экран регистрации.
 */
import React, { useState } from 'react';
import Api from '../api.js';

export default function LoginPage({ onLogin, onGoRegister }) {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function onSubmit(ev) {
        ev.preventDefault();
        setBusy(true);
        setError('');
        try {
            const user = await Api.login(login.trim(), password);
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
                <h2 className="panel__title">Вход</h2>
                <form onSubmit={onSubmit}>
                    <div className="field">
                        <label>Логин</label>
                        <input value={login} autoComplete="username" required maxLength="30"
                               onChange={e => setLogin(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Пароль</label>
                        <input type="password" value={password} autoComplete="current-password"
                               required onChange={e => setPassword(e.target.value)} />
                    </div>
                    <div className="form-error">{error}</div>
                    <button className="btn btn--block" type="submit" disabled={busy}>
                        {busy ? 'Входим…' : 'Войти'}
                    </button>
                </form>
                <button className="btn btn--ghost btn--block login__alt" type="button"
                        onClick={onGoRegister}>
                    Зарегистрироваться
                </button>
                <div className="login__hint">
                    Демо-доступ: логин <b>demo</b>, пароль <b>demo123</b>
                </div>
            </div>
        </div>
    );
}
