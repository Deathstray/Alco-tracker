/**
 * charts.jsx — построение SVG-диаграмм без внешних библиотек.
 * Приложение работает полностью офлайн (в локальной сети), поэтому
 * вместо библиотек используются собственные SVG-компоненты.
 *
 * Цвета — приглушённая палитра (низкая насыщенность), подписи значений
 * наносятся напрямую, легенды выносятся за пределы графика.
 */
import React from 'react';

/* Палитра категорий (максимум 6 цветов, приглушённые тона) */
const PALETTE = ['#2A6F97', '#B85C4A', '#B7791F', '#2F855A', '#64748B', '#8B5E83'];

/** «Нет данных» — общая заглушка для всех диаграмм. */
function NoData() {
    return <div className="form-hint">Нет данных за период</div>;
}

/**
 * Столбчатая диаграмма: значения по категориям.
 * items: [{label, value}]
 */
export function BarChart({ items }) {
    if (!items || items.length === 0) return <NoData />;

    const W = 720, H = 260;
    const padL = 40, padR = 12, padT = 26, padB = 34;
    const color = '#2A6F97';
    const maxValue = Math.max(...items.map(i => i.value), 1) * 1.15;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const step = innerW / items.length;
    const barW = Math.min(step * 0.62, 64);

    // сетка: 4 горизонтальные линии со значениями
    const grid = [];
    for (let g = 0; g <= 4; g++) {
        const y = padT + innerH - (innerH * g / 4);
        const val = (maxValue * g / 4).toFixed(g === 4 ? 0 : 1);
        grid.push(
            <g key={g}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E2E8F0" strokeWidth="1" />
                <text x={padL - 6} y={y + 4} fontSize="10.5" fill="#94A3B8" textAnchor="end">{val}</text>
            </g>
        );
    }

    const best = Math.max(...items.map(i => i.value));
    const bars = items.map((it, i) => {
        const x = padL + step * i + (step - barW) / 2;
        const h = innerH * (it.value / maxValue);
        const y = padT + innerH - h;
        const isMax = it.value === best;
        return (
            <g key={it.label}>
                <rect x={x.toFixed(1)} y={y.toFixed(1)} width={barW.toFixed(1)}
                      height={Math.max(h, 1).toFixed(1)} rx="5"
                      fill={isMax ? '#B85C4A' : color} opacity={isMax ? 0.95 : 0.85} />
                <text x={(x + barW / 2).toFixed(1)} y={(y - 6).toFixed(1)}
                      fontSize="11.5" fontWeight="700" fill="#1F2937" textAnchor="middle">
                    {it.value.toFixed(1)}
                </text>
                <text x={(padL + step * i + step / 2).toFixed(1)} y={H - 10}
                      fontSize="11" fill="#6B7280" textAnchor="middle">{it.label}</text>
            </g>
        );
    });

    return (
        <svg viewBox={'0 0 ' + W + ' ' + H} xmlns="http://www.w3.org/2000/svg" role="img">
            {grid}
            {bars}
        </svg>
    );
}

/**
 * Кольцевая диаграмма (донат) с легендой справа.
 * items: [{label, value}]
 */
export function DonutChart({ items }) {
    if (!items || items.length === 0) return <NoData />;

    const total = items.reduce((s, i) => s + i.value, 0);
    const W = 720, H = 250;
    const cx = 130, cy = H / 2, r = 86, sw = 34;
    const C = 2 * Math.PI * r;

    // дуги: накапливаем смещение, чтобы сегменты шли друг за другом
    let offset = 0;
    const arcs = items.map((it, i) => {
        const frac = total > 0 ? it.value / total : 0;
        const len = frac * C;
        const dash = len.toFixed(1) + ' ' + (C - len).toFixed(1);
        const dashOffset = (-offset).toFixed(1);
        offset += len;
        return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                    stroke={PALETTE[i % PALETTE.length]} strokeWidth={sw}
                    strokeDasharray={dash} strokeDashoffset={dashOffset}
                    transform={'rotate(-90 ' + cx + ' ' + cy + ')'} />
        );
    });

    // легенда справа: маркер, название, доля, значение
    const lx = 260, lh = 30;
    const legend = items.map((it, i) => {
        const y = 30 + i * lh + 12;
        const pct = total > 0 ? (100 * it.value / total).toFixed(1) : '0.0';
        return (
            <g key={i}>
                <rect x={lx} y={y - 10} width="12" height="12" rx="3"
                      fill={PALETTE[i % PALETTE.length]} />
                <text x={lx + 20} y={y} fontSize="13" fill="#1F2937">{it.label}</text>
                <text x={W - 16} y={y} fontSize="13" fontWeight="700"
                      fill="#1F2937" textAnchor="end">{it.value.toFixed(1)} · {pct}%</text>
            </g>
        );
    });

    return (
        <svg viewBox={'0 0 ' + W + ' ' + H} xmlns="http://www.w3.org/2000/svg" role="img">
            {arcs}
            <text x={cx} y={cy - 4} fontSize="20" fontWeight="800"
                  fill="#1F2937" textAnchor="middle">{total.toFixed(1)}</text>
            <text x={cx} y={cy + 16} fontSize="11" fill="#6B7280" textAnchor="middle">доз всего</text>
            {legend}
        </svg>
    );
}

/**
 * Линейный график тренда по дням.
 * points: [{label(дата), value}] — отсортированы по дате
 */
export function LineChart({ points }) {
    if (!points || points.length === 0) return <NoData />;

    const W = 720, H = 250;
    const padL = 40, padR = 46, padT = 18, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const max = Math.max(...points.map(p => p.value), 1) * 1.15;

    const x = i => points.length === 1 ? padL + innerW / 2 : padL + innerW * i / (points.length - 1);
    const y = v => padT + innerH - innerH * (v / max);

    const grid = [];
    for (let g = 0; g <= 4; g++) {
        const gy = padT + innerH - innerH * g / 4;
        grid.push(
            <g key={g}>
                <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#E2E8F0" />
                <text x={padL - 6} y={gy + 4} fontSize="10.5" fill="#94A3B8" textAnchor="end">
                    {(max * g / 4).toFixed(1)}
                </text>
            </g>
        );
    }

    // линия и мягкая заливка под ней
    const path = points.map((p, i) =>
        (i === 0 ? 'M' : 'L') + ' ' + x(i).toFixed(1) + ' ' + y(p.value).toFixed(1)
    ).join(' ');
    const area = path + ' L ' + x(points.length - 1).toFixed(1) + ' ' + (padT + innerH).toFixed(1) +
        ' L ' + padL + ' ' + (padT + innerH).toFixed(1) + ' Z';

    // подписи дат: одна на несколько дней, без принудительной последней —
    // иначе она может наложиться на соседнюю
    const every = Math.max(1, Math.ceil(points.length / 9));
    const ticks = [];
    points.forEach((p, i) => {
        if (i % every !== 0) return;
        ticks.push(
            <text key={i} x={x(i).toFixed(1)} y={H - 8} fontSize="10.5"
                  fill="#6B7280" textAnchor="middle">{p.label.slice(5).replace('-', '.')}</text>
        );
    });

    // максимальная точка — маркер и значение
    const maxIdx = points.reduce((m, p, i) => p.value > points[m].value ? i : m, 0);
    // если подпись справа от маркера не помещается — рисуем её слева
    const flip = x(maxIdx) + 52 > W - padR;

    return (
        <svg viewBox={'0 0 ' + W + ' ' + H} xmlns="http://www.w3.org/2000/svg" role="img">
            {grid}
            <path d={area} fill="#2A6F97" opacity="0.10" />
            <path d={path} fill="none" stroke="#2A6F97" strokeWidth="2.5"
                  strokeLinejoin="round" strokeLinecap="round" />
            {ticks}
            <circle cx={x(maxIdx).toFixed(1)} cy={y(points[maxIdx].value).toFixed(1)}
                    r="4" fill="#B85C4A" />
            <text x={(flip ? x(maxIdx) - 8 : x(maxIdx) + 8).toFixed(1)}
                  y={(y(points[maxIdx].value) - 8).toFixed(1)}
                  fontSize="11" fontWeight="700" fill="#B85C4A"
                  textAnchor={flip ? 'end' : 'start'}>
                {points[maxIdx].value.toFixed(1)}
            </text>
        </svg>
    );
}
