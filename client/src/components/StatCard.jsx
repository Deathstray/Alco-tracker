/**
 * StatCard.jsx — карточка показателя аналитики.
 * cls — цветовая модификация ('alc', 'good', 'warn', 'bad'), extra — 'text'.
 */
import React from 'react';

export default function StatCard({ value, label, cls, extra }) {
    const classes = ['stat-card'];
    if (cls) classes.push('stat-card--' + cls);
    if (extra) classes.push('stat-card--' + extra);
    return (
        <div className={classes.join(' ')}>
            <div className="stat-card__value">{value}</div>
            <div className="stat-card__label">{label}</div>
        </div>
    );
}
