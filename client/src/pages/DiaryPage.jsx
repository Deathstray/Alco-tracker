/**
 * DiaryPage.jsx — экран «Дневник»: записи сгруппированы по дням,
 * карточка дня показывает дозы, траты и оценки сна/утра.
 * Добавление, изменение и удаление записей — в модальных окнах.
 */
import React, { useEffect, useState } from 'react';
import Api from '../api.js';
import EntryForm from '../components/EntryForm.jsx';
import DayForm from '../components/DayForm.jsx';
import { fmtDate, fmtMoney, plural, typeMark } from '../format.js';

/** Одна строка дневника (напиток). */
function EntryRow({ entry, onEdit, onDelete }) {
    const isAlc = Number(entry.is_alcoholic) === 1;
    return (
        <div className="entry">
            <div className={'entry__icon' + (isAlc ? ' entry__icon--alc' : '')}>
                {typeMark(entry.type_name)}
            </div>
            <div className="entry__body">
                <div className="entry__name">{entry.drink_name}</div>
                <div className="entry__meta">
                    {entry.volume_ml} мл · {Number(entry.strength)}% · {String(entry.entry_time).slice(0, 5)}
                    {entry.place_name ? ' · ' + entry.place_name : ''}
                    {entry.reason_name ? ' · ' + entry.reason_name : ''}
                    {entry.company_name ? ' · ' + entry.company_name : ''}
                </div>
            </div>
            <div className="entry__right">
                <div className="entry__doses">{isAlc ? Number(entry.doses).toFixed(1) + ' доз' : '—'}</div>
                <div className="entry__price">{fmtMoney(entry.price)}</div>
            </div>
            <div className="entry__actions">
                <button className="icon-btn" title="Изменить" onClick={() => onEdit(entry)}>✎</button>
                <button className="icon-btn" title="Удалить" onClick={() => onDelete(entry)}>✕</button>
            </div>
        </div>
    );
}

/** Карточка одного дня с записями. */
function DayCard({ date, dayEntries, record, onEdit, onDelete, onRate }) {
    const alcohol = dayEntries.filter(e => Number(e.is_alcoholic) === 1);
    const doses = alcohol.reduce((s, e) => s + Number(e.doses), 0);
    const money = dayEntries.reduce((s, e) => s + Number(e.price), 0);

    return (
        <article className="day-card">
            <div className="day-card__head">
                <div className="day-card__date">{fmtDate(date)}</div>
                <div className="badges">
                    {doses > 0
                        ? <span className="badge badge--alc">{doses.toFixed(1)} {plural(doses.toFixed(1), ['доза', 'дозы', 'доз'])}</span>
                        : <span className="badge badge--good">трезвый день</span>}
                    <span className="badge badge--muted">{fmtMoney(money)}</span>
                    {record && record.sleep_quality
                        ? <span className="badge">сон {record.sleep_quality}/5</span> : null}
                    {record && record.morning_condition
                        ? <span className="badge">утро {record.morning_condition}/5</span> : null}
                    <button className="icon-btn" title="Оценить день" onClick={() => onRate(date)}>✎</button>
                </div>
            </div>

            {record && record.note
                ? <div className="day-card__note">«{record.note}»</div> : null}

            {dayEntries.map(e => (
                <EntryRow key={e.entry_id} entry={e} onEdit={onEdit} onDelete={onDelete} />
            ))}
        </article>
    );
}

export default function DiaryPage({ dicts, onAuthError }) {
    const [entries, setEntries] = useState(null);   // null — идёт загрузка
    const [dailyByDate, setDailyByDate] = useState({});
    const [loadError, setLoadError] = useState('');  // ошибка загрузки
    const [daysShown, setDaysShown] = useState(30); // сколько карточек-дней показано
    const [modal, setModal] = useState(null);       // {type:'entry', entry} | {type:'day', date}

    /** Загрузка записей и ежедневных показателей. */
    async function load() {
        setLoadError('');
        try {
            const [entriesData, dailyData] = await Promise.all([
                Api.get('/api/entries'),
                Api.get('/api/daily'),
            ]);
            setEntries(entriesData);
            const byDate = {};
            dailyData.forEach(r => { byDate[r.record_date] = r; });
            setDailyByDate(byDate);
        } catch (e) {
            if (e.status === 401) { onAuthError(); return; }
            setLoadError(e.message || 'Не удалось загрузить данные');
        }
    }

    useEffect(() => { load(); }, []);

    if (loadError) {
        return (
            <div>
                <div className="view-head">
                    <div>
                        <h2 className="view-title">Дневник</h2>
                        <div className="view-sub">не удалось загрузить записи</div>
                    </div>
                </div>
                <div className="empty">
                    <b>Ошибка загрузки данных</b><br />
                    {loadError}<br /><br />
                    <button className="btn btn--ghost" onClick={load}>Повторить</button>
                </div>
            </div>
        );
    }

    if (entries === null) {
        return <div className="empty">Загрузка данных…</div>;
    }
    if (entries.length === 0 && !modal) {
        return (
            <div>
                <div className="view-head">
                    <div>
                        <h2 className="view-title">Дневник</h2>
                        <div className="view-sub">записей пока нет</div>
                    </div>
                </div>
                <div className="empty">
                    Записей пока нет.<br />Нажмите «Добавить запись» и внесите первый напиток.
                </div>
                <div className="fab-wrap">
                    <button className="btn" onClick={() => setModal({ type: 'entry', entry: null })}>
                        + Добавить запись
                    </button>
                </div>
            </div>
        );
    }

    // группировка записей по датам (новые сверху)
    const groups = {};
    entries.forEach(e => {
        (groups[e.entry_date] = groups[e.entry_date] || []).push(e);
    });
    const dates = Object.keys(groups).sort().reverse();
    const shown = dates.slice(0, daysShown);
    const lastActivity = entries[0].entry_date;

    async function onDelete(entry) {
        if (!window.confirm('Удалить запись?')) return;
        try {
            await Api.del('/api/entries/' + entry.entry_id);
            await load();
        } catch (e) {
            window.alert(e.message);
        }
    }

    return (
        <div>
            <div className="view-head">
                <div>
                    <h2 className="view-title">Дневник</h2>
                    <div className="view-sub">
                        {entries.length} {plural(entries.length, ['запись', 'записи', 'записей'])} ·
                        последняя активность {fmtDate(lastActivity)}
                    </div>
                </div>
            </div>

            {shown.map(date => (
                <DayCard
                    key={date}
                    date={date}
                    dayEntries={groups[date]}
                    record={dailyByDate[date]}
                    onEdit={entry => setModal({ type: 'entry', entry: entry })}
                    onDelete={onDelete}
                    onRate={date => setModal({ type: 'day', date: date })}
                />
            ))}

            {dates.length > daysShown
                ? <div className="fab-wrap">
                      <button className="btn btn--ghost" onClick={() => setDaysShown(daysShown + 30)}>
                          Показать ещё 30 дней
                      </button>
                  </div>
                : null}

            <div className="fab-wrap">
                <button className="btn" onClick={() => setModal({ type: 'entry', entry: null })}>
                    + Добавить запись
                </button>
            </div>

            {modal && modal.type === 'entry'
                ? <EntryForm
                      entry={modal.entry}
                      dicts={dicts}
                      onClose={() => setModal(null)}
                      onSaved={() => { setModal(null); load(); }} />
                : null}
            {modal && modal.type === 'day'
                ? <DayForm
                      date={modal.date}
                      record={dailyByDate[modal.date]}
                      onClose={() => setModal(null)}
                      onSaved={() => { setModal(null); load(); }} />
                : null}
        </div>
    );
}
