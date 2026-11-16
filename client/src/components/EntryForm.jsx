/**
 * EntryForm.jsx — модальная форма добавления/изменения записи дневника.
 *
 * При выборе напитка крепость, объём и цена подставляются из справочника,
 * цена пересчитывается пропорционально объёму.
 */
import React, { useState } from 'react';
import Modal from './Modal.jsx';
import Api from '../api.js';
import { todayISO, nowHM } from '../format.js';

export default function EntryForm({ entry, dicts, onClose, onSaved }) {
    const isEdit = !!entry;
    const d = entry || {
        entry_date: todayISO(), entry_time: nowHM(),
        drink_id: '', volume_ml: 500, strength: '', price: '',
        place_id: '', reason_id: '', company_id: '',
    };

    const [form, setForm] = useState({
        drink_id: String(d.drink_id ?? ''),
        entry_date: (d.entry_date || '').slice(0, 10),
        entry_time: String(d.entry_time || '').slice(0, 5),
        volume_ml: d.volume_ml,
        strength: d.strength,
        price: d.price,
        place_id: d.place_id ? String(d.place_id) : '',
        reason_id: d.reason_id ? String(d.reason_id) : '',
        company_id: d.company_id ? String(d.company_id) : '',
    });
    const [error, setError] = useState('');

    /** Изменение простого поля формы. */
    function setField(name, value) {
        setForm(f => ({ ...f, [name]: value }));
    }

    /** Выбор напитка: подставляем крепость/объём/цену из справочника. */
    function onDrinkChange(drinkId) {
        const drink = dicts.drinks.find(dr => String(dr.drink_id) === String(drinkId));
        if (!drink) {
            setField('drink_id', drinkId);
            return;
        }
        setForm(f => ({
            ...f,
            drink_id: String(drink.drink_id),
            strength: Number(drink.strength),
            volume_ml: drink.package_volume_ml,
            // цена пересчитывается пропорционально объёму порции
            price: Math.round(Number(drink.default_price) / Number(drink.package_volume_ml) * Number(f.volume_ml)),
        }));
    }

    /** Цена пропорционально объёму при изменении объёма. */
    function onVolumeChange(volume) {
        const drink = dicts.drinks.find(dr => String(dr.drink_id) === String(form.drink_id));
        setForm(f => ({
            ...f,
            volume_ml: volume,
            price: drink
                ? Math.round(Number(drink.default_price) / Number(drink.package_volume_ml) * Number(volume))
                : f.price,
        }));
    }

    /** Список <option> для справочника (id + name приходят из API). */
    function dictOptions(list) {
        const options = [<option key="0" value="">— не указано —</option>];
        list.forEach(x => {
            options.push(
                <option key={x.id} value={x.id}>
                    {x.name}
                </option>
            );
        });
        return options;
    }

    async function onSubmit(ev) {
        ev.preventDefault();
        if (!form.drink_id) {
            setError('Выберите напиток');
            return;
        }
        const payload = {
            drink_id: form.drink_id,
            entry_date: form.entry_date,
            entry_time: form.entry_time,
            volume_ml: form.volume_ml,
            strength: form.strength,
            price: form.price || 0,
            place_id: form.place_id,
            reason_id: form.reason_id,
            company_id: form.company_id,
        };
        try {
            if (isEdit) await Api.put('/api/entries/' + entry.entry_id, payload);
            else await Api.post('/api/entries', payload);
            onSaved();
        } catch (e) {
            setError(e.message);
        }
    }

    // напитки, сгруппированные по типам (optgroup)
    const drinkGroups = dicts.types.map(t => ({
        type: t,
        drinks: dicts.drinks.filter(x => x.type_id === t.type_id),
    })).filter(g => g.drinks.length > 0);

    return (
        <Modal title={isEdit ? 'Изменить запись' : 'Новая запись'} onClose={onClose}>
            <form onSubmit={onSubmit}>
                <div className="field">
                    <label>Напиток</label>
                    <select value={form.drink_id} required
                            onChange={e => onDrinkChange(e.target.value)}>
                        <option value="">— выберите напиток —</option>
                        {drinkGroups.map(g => (
                            <optgroup key={g.type.type_id} label={g.type.type_name}>
                                {g.drinks.map(dr => (
                                    <option key={dr.drink_id} value={dr.drink_id}>
                                        {dr.drink_name}, {Number(dr.strength)}%
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
                <div className="form-row">
                    <div className="field">
                        <label>Дата</label>
                        <input type="date" value={form.entry_date} required
                               onChange={e => setField('entry_date', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Время</label>
                        <input type="time" value={form.entry_time} required
                               onChange={e => setField('entry_time', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field">
                        <label>Объём, мл</label>
                        <input type="number" min="10" max="10000" step="10"
                               value={form.volume_ml} required
                               onChange={e => onVolumeChange(e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Крепость, %</label>
                        <input type="number" min="0" max="100" step="0.1"
                               value={form.strength} required
                               onChange={e => setField('strength', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Цена, ₽</label>
                        <input type="number" min="0" step="1"
                               value={form.price}
                               onChange={e => setField('price', e.target.value)} />
                    </div>
                </div>
                <div className="form-row">
                    <div className="field">
                        <label>Место</label>
                        <select value={form.place_id}
                                onChange={e => setField('place_id', e.target.value)}>
                            {dictOptions(dicts.places)}
                        </select>
                    </div>
                    <div className="field">
                        <label>Повод</label>
                        <select value={form.reason_id}
                                onChange={e => setField('reason_id', e.target.value)}>
                            {dictOptions(dicts.reasons)}
                        </select>
                    </div>
                    <div className="field">
                        <label>Компания</label>
                        <select value={form.company_id}
                                onChange={e => setField('company_id', e.target.value)}>
                            {dictOptions(dicts.companies)}
                        </select>
                    </div>
                </div>
                <div className="form-hint">Дозы считаются автоматически: объём × крепость × 0,789 / 10 г.</div>
                <div className="form-error">{error}</div>
                <div className="modal__actions">
                    <button type="button" className="btn btn--ghost" onClick={onClose}>Отмена</button>
                    <button type="submit" className="btn">{isEdit ? 'Сохранить' : 'Добавить'}</button>
                </div>
            </form>
        </Modal>
    );
}
