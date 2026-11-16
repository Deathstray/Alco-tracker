/**
 * DayForm.jsx — модальная форма оценки дня: качество сна,
 * утреннее состояние (1–5) и заметка.
 */
import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Api from '../api.js';
import { fmtDate } from '../format.js';

/** Блок оценки: 5 переключателей. */
function Rating({ name, value, onChange }) {
    return (
        <div className="rating">
            {[1, 2, 3, 4, 5].map(i => (
                <React.Fragment key={i}>
                    <input type="radio" id={name + '-' + i} name={name} value={i}
                           checked={value === String(i)}
                           onChange={() => onChange(name, String(i))} />
                    <label htmlFor={name + '-' + i}>{i}</label>
                </React.Fragment>
            ))}
        </div>
    );
}

export default function DayForm({ date, record, onClose, onSaved }) {
    const [sleep, setSleep] = useState(record && record.sleep_quality ? String(record.sleep_quality) : '0');
    const [morning, setMorning] = useState(record && record.morning_condition ? String(record.morning_condition) : '0');
    const [note, setNote] = useState(record && record.note ? record.note : '');
    const [error, setError] = useState('');

    function changeRating(name, value) {
        if (name === 'sleep') setSleep(value);
        else setMorning(value);
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        try {
            await Api.post('/api/daily', {
                record_date: date,
                sleep_quality: sleep === '0' ? '' : sleep,
                morning_condition: morning === '0' ? '' : morning,
                note: note.trim(),
            });
            onSaved();
        } catch (e) {
            setError(e.message);
        }
    }

    return (
        <Modal title={'Оценить день — ' + fmtDate(date)} onClose={onClose}>
            <form onSubmit={onSubmit}>
                <div className="field">
                    <label>Качество сна (1 — плохо, 5 — отлично)</label>
                    <Rating name="sleep" value={sleep} onChange={changeRating} />
                </div>
                <div className="field">
                    <label>Утреннее состояние (1 — тяжело, 5 — бодро)</label>
                    <Rating name="morning" value={morning} onChange={changeRating} />
                </div>
                <div className="field">
                    <label>Заметка</label>
                    <textarea rows="2" maxLength="255" value={note}
                              placeholder="Например: день рождения у друга"
                              onChange={e => setNote(e.target.value)} />
                </div>
                <div className="form-error">{error}</div>
                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
                    <button type="submit" className="btn">Сохранить</button>
                </div>
            </form>
        </Modal>
    );
}
