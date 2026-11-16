/**
 * AnalyticsPage.jsx — экран «Аналитика»: карточки показателей,
 * диаграммы по дням недели и типам напитков, тренд и топ-5.
 *
 * Периоды считаются от «якоря» — последнего дня, по которому есть данные,
 * поэтому аналитика не «плывёт» со временем.
 */
import React, { useEffect, useState } from 'react';
import Api from '../api.js';
import StatCard from '../components/StatCard.jsx';
import { BarChart, DonutChart, LineChart } from '../charts.jsx';
import { fmtShort, plural, todayISO, fmtMoney } from '../format.js';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** Границы периода с учётом «якоря» (последнего дня с данными). */
function periodRange(anchor, period) {
    if (period === 'all') return { from: '', to: anchor };
    const from = new Date(anchor + 'T00:00:00');
    from.setDate(from.getDate() - (Number(period) - 1));
    const iso = from.getFullYear() + '-' +
        String(from.getMonth() + 1).padStart(2, '0') + '-' +
        String(from.getDate()).padStart(2, '0');
    return { from: iso, to: anchor };
}

export default function AnalyticsPage({ onAuthError }) {
    const [period, setPeriod] = useState('90');   // '30' | '90' | 'all'
    const [data, setData] = useState(null);       // все данные аналитики

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                // «якорь» — последний день с записями (список приходит новый сверху)
                const entries = await Api.get('/api/entries');
                const anchor = entries.length > 0 ? entries[0].entry_date : todayISO();
                const { from, to } = periodRange(anchor, period);

                const [s, weekday, byType, trend, topDrinks] = await Promise.all([
                    Api.get('/api/stats?mode=summary&from=' + from + '&to=' + to),
                    Api.get('/api/stats?mode=by_weekday&from=' + from + '&to=' + to),
                    Api.get('/api/stats?mode=by_type&from=' + from + '&to=' + to),
                    Api.get('/api/stats?mode=trend&from=' + from + '&to=' + to),
                    Api.get('/api/stats?mode=top_drinks&from=' + from + '&to=' + to),
                ]);
                if (!cancelled) setData({ s, weekday, byType, trend, topDrinks, from, to });
            } catch (e) {
                if (cancelled) return;
                if (e.status === 401) { onAuthError(); return; }
                setData({ error: e.message });
            }
        }

        load();
        return () => { cancelled = true; };
    }, [period]);

    if (data === null) {
        return <div className="empty">Загрузка данных…</div>;
    }
    if (data.error) {
        return <div className="empty"><b>Ошибка загрузки</b><br />{data.error}</div>;
    }

    const s = data.s;
    const periodLabel = period === 'all'
        ? 'весь период'
        : period + ' ' + plural(period, ['день', 'дня', 'дней']);
    const sleep = s.sleep || {};

    // данные для столбчатой диаграммы по дням недели
    const barItems = WEEKDAYS.map((name, i) => ({
        label: name,
        value: Number((data.weekday[i] || data.weekday[String(i)] || { doses: 0 }).doses || 0),
    }));
    const donutItems = data.byType.map(t => ({ label: t.name, value: Number(t.doses) }));
    const linePoints = data.trend.map(t => ({ label: t.entry_date, value: Number(t.doses) }));

    return (
        <div>
            <div className="view-head">
                <div>
                    <h2 className="view-title">Аналитика</h2>
                    <div className="view-sub">
                        {periodLabel}:
                        {data.from ? ' ' + fmtShort(data.from) + ' — ' : ' '}
                        {fmtShort(data.to)}
                    </div>
                </div>
                <div className="period-tabs">
                    {['30', '90', 'all'].map(p => (
                        <button key={p}
                                className={'period-tabs__item' + (period === p ? ' active' : '')}
                                onClick={() => setPeriod(p)}>
                            {p === 'all' ? 'Всё' : p + ' дней'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="cards">
                <StatCard value={s.total_doses.toFixed(1)} label="стандартных доз" cls="alc" />
                <StatCard value={s.total_liters.toFixed(1)} label="литров выпито" />
                <StatCard value={fmtMoney(s.money_total)} label="потрачено" />
                <StatCard value={<span>{s.sober_days} <small>из {s.days_in_period}</small></span>}
                          label={'трезвых дней (' + s.sober_percent + '%)'} cls="good" />
                <StatCard value={s.drinking_days} label="дней с алкоголем" />
                <StatCard value={s.avg_doses_per_drinking_day.toFixed(1)} label="доз за пьющий день" />
                <StatCard value={s.max_day ? s.max_day.doses.toFixed(1) : '—'}
                          label={s.max_day
                              ? <span>максимум за день <small>({fmtShort(s.max_day.date)})</small></span>
                              : 'максимум за день'}
                          cls="alc" />
                <StatCard value={s.current_sober_streak}
                          label={plural(s.current_sober_streak,
                              ['день трезвости подряд', 'дня трезвости подряд', 'дней трезвости подряд'])}
                          cls="good" />
                <StatCard value={s.longest_sober_streak}
                          label={plural(s.longest_sober_streak,
                              ['день — рекорд трезвости', 'дня — рекорд трезвости', 'дней — рекорд трезвости'])}
                          cls="good" />
                <StatCard value={s.last7_doses.toFixed(1)}
                          label={'доз за 7 дней · ' + s.risk.label}
                          cls={s.risk.color === 'good' ? 'good' : (s.risk.color === 'warn' ? 'warn' : 'bad')} />
                <StatCard value={s.top_drink ? s.top_drink.name : '—'} label="любимый напиток" extra="text" />
                <StatCard value={s.top_type ? s.top_type.name : '—'} label="тип напитков" extra="text" />
                <StatCard value={s.top_place ? s.top_place.name : '—'} label="частое место" extra="text" />
                <StatCard value={s.top_reason ? s.top_reason.name : '—'} label="главный повод" extra="text" />
                <StatCard value={s.top_company ? s.top_company.name : '—'} label="постоянная компания" extra="text" />
                <StatCard value={<span>
                            {Number(sleep.sleep_after_alc || 0).toFixed(1)} <small>/ {Number(sleep.sleep_sober || 0).toFixed(1)}</small>
                        </span>}
                          label="сон после алкоголя / трезвым вечером" />
                <StatCard value={<span>
                            {Number(sleep.morning_after_alc || 0).toFixed(1)} <small>/ {Number(sleep.morning_sober || 0).toFixed(1)}</small>
                        </span>}
                          label="утро после алкоголя / трезвым вечером" />
            </div>

            <div className="panel panel__chart">
                <h3 className="panel__title">Дозы по дням недели</h3>
                <BarChart items={barItems} />
            </div>

            <div className="panel panel__chart">
                <h3 className="panel__title">Структура по типам напитков</h3>
                <DonutChart items={donutItems} />
            </div>

            <div className="panel panel__chart">
                <h3 className="panel__title">Тренд: дозы по дням</h3>
                <LineChart points={linePoints} />
            </div>

            <div className="panel">
                <h3 className="panel__title">Топ-5 напитков</h3>
                <ul className="top-list">
                    {data.topDrinks.map(t => (
                        <li key={t.name}>
                            <span>{t.name}</span>
                            <span className="top-list__doses">
                                {Number(t.doses).toFixed(1)} доз · {t.cnt} {plural(t.cnt, ['раз', 'раза', 'раз'])}
                            </span>
                        </li>
                    ))}
                    {data.topDrinks.length === 0 ? <li>Нет данных</li> : null}
                </ul>
            </div>

            <div className="fab-wrap">
                <a className="btn btn--ghost" href={Api.exportUrl(data.from, data.to)} download>
                    Экспорт дневника в CSV
                </a>
            </div>
        </div>
    );
}
