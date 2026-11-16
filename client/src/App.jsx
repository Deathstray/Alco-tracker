/**
 * App.jsx — корневой компонент приложения «АлкоТрекер».
 *
 * Логика входа: сначала проверяется сессия (/api/auth/me),
 * затем загружаются справочники и показывается основное
 * приложение с тремя вкладками: Дневник, Аналитика, Профиль.
 */
import React, { useEffect, useState } from 'react';
import Api from './api.js';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DiaryPage from './pages/DiaryPage.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const TABS = [
    { key: 'diary', title: 'Дневник' },
    { key: 'analytics', title: 'Аналитика' },
    { key: 'profile', title: 'Профиль' },
];

export default function App() {
    const [checked, setChecked] = useState(false); // проверили ли сессию
    const [authed, setAuthed] = useState(false);
    const [screen, setScreen] = useState('login'); // login | register
    const [tab, setTab] = useState('diary');
    const [dicts, setDicts] = useState(null);      // справочники
    const [dictsError, setDictsError] = useState(false); // не загрузились

    /** Загрузить справочники после входа. */
    async function loadDicts() {
        setDictsError(false);
        try {
            const [types, drinks, places, reasons, companies] = await Promise.all([
                Api.get('/api/types'),
                Api.get('/api/drinks'),
                Api.get('/api/places'),
                Api.get('/api/reasons'),
                Api.get('/api/companies'),
            ]);
            setDicts({ types, drinks, places, reasons, companies });
        } catch (e) {
            if (e.status === 401) {
                // сессия истекла — возврат на экран входа
                setAuthed(false);
                setDicts(null);
                setScreen('login');
                return;
            }
            setDictsError(true);
        }
    }

    // При запуске: если сессия жива — сразу в приложение
    useEffect(() => {
        Api.get('/api/auth/me')
            .then(() => {
                setAuthed(true);
                return loadDicts();
            })
            .catch(() => { /* нет сессии — покажем экран входа */ })
            .finally(() => setChecked(true));
    }, []);

    /** Вход выполнен (вход или регистрация). */
    function onLogin() {
        setAuthed(true);
        setTab('diary');
        loadDicts();
    }

    /** Сессия истекла в любом экране — возврат на вход. */
    function onAuthError() {
        setAuthed(false);
        setDicts(null);
        setScreen('login');
    }

    if (!checked) {
        return (
            <div className="container">
                <div className="empty">Проверка сессии…</div>
            </div>
        );
    }

    /* ─────────── Экраны до входа ─────────── */
    if (!authed) {
        return (
            <div>
                <Header withTabs={false} />
                <main className="container">
                    {screen === 'login'
                        ? <LoginPage onLogin={onLogin} onGoRegister={() => setScreen('register')} />
                        : <RegisterPage onLogin={onLogin} onGoLogin={() => setScreen('login')} />}
                </main>
                <Footer />
            </div>
        );
    }

    /* ─────────── Основное приложение ─────────── */
    return (
        <div>
            <Header withTabs={true} tab={tab} onTab={setTab} />
            <main className="container">
                {dictsError
                    ? (
                        <div className="empty">
                            <b>Не удалось загрузить справочники.</b><br />
                            Проверьте, что сервер запущен, и попробуйте ещё раз.<br /><br />
                            <button className="btn btn--ghost" onClick={loadDicts}>Повторить</button>
                        </div>
                    )
                    : dicts === null
                        ? <div className="empty">Загрузка справочников…</div>
                        : (
                            <div>
                                {tab === 'diary'
                                    ? <DiaryPage dicts={dicts} onAuthError={onAuthError} /> : null}
                                {tab === 'analytics'
                                    ? <AnalyticsPage onAuthError={onAuthError} /> : null}
                                {tab === 'profile'
                                    ? <ProfilePage dicts={dicts} onLogout={onAuthError} onAuthError={onAuthError} /> : null}
                            </div>
                        )}
            </main>
            <Footer />
        </div>
    );
}

/** Шапка: логотип + вкладки. */
function Header({ withTabs, tab, onTab }) {
    return (
        <header className="header">
            <div className="container header__row">
                <div className="header__brand">
                    <span className="header__logo" aria-hidden="true"></span>
                    <div>
                        <div className="header__title">АлкоТрекер</div>
                        <div className="header__sub">дневник и аналитика потребления</div>
                    </div>
                </div>
                {withTabs ? (
                    <nav className="tabs">
                        {TABS.map(t => (
                            <button key={t.key}
                                    className={'tabs__item' + (tab === t.key ? ' active' : '')}
                                    onClick={() => onTab(t.key)}>
                                {t.title}
                            </button>
                        ))}
                    </nav>
                ) : null}
            </div>
        </header>
    );
}

/** Подвал. */
function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                Данные хранятся локально в вашей базе MySQL.
                Приложение не ставит диагнозов и не оценивает — только факты и цифры.
                <span className="footer__meta">
                    ВКР, специальность 09.02.07 · стек: React + Node.js (Express) + MySQL · v2.0
                </span>
            </div>
        </footer>
    );
}
