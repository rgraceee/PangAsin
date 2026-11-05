import React from 'react';

function renderValue(value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

function trendClass(direction, goodWhen) {
  if (goodWhen === 'neutral') return 'ui-kpi__trend--neutral';
  const good = (direction === 'up') === (goodWhen === 'up');
  return good ? 'ui-kpi__trend--good' : 'ui-kpi__trend--bad';
}

export default function KpiCard({
  icon: Icon,
  title,
  value,
  unit,
  tone = 'default',
  trend,
  badge,
  loading = false,
  className = '',
}) {
  const classes = ['ui-kpi', tone !== 'default' ? `ui-kpi--${tone}` : '', className].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className={`ui-kpi ui-kpi--skeleton ${className}`} aria-hidden="true">
        <div className="ui-kpi__top">
          <div className="ui-kpi__label-wrap">
            <span className="ui-kpi__skeleton-block" style={{ width: 40, height: 40, borderRadius: '50%' }} />
            <span className="ui-kpi__skeleton-block" style={{ width: 96, height: 14 }} />
          </div>
        </div>
        <div className="ui-kpi__skeleton-block" style={{ width: '70%', height: 30 }} />
      </div>
    );
  }

  const display = renderValue(value);
  const ariaValue = unit ? `${display} ${unit}` : `${display}`;
  const badgeText = typeof badge === 'string' ? badge : (badge && badge.text) || null;
  const badgeTone = typeof badge === 'object' && badge && badge.tone ? badge.tone : 'good';
  const trendText = trend
    ? `${trend.direction === 'up' ? 'up' : 'down'} ${Math.abs(trend.value)} percent ${trend.label || 'versus last month'}, ${trendClass(trend.direction, trend.goodWhen || 'up').endsWith('good') ? 'good' : trendClass(trend.direction, trend.goodWhen || 'up').endsWith('bad') ? 'bad' : 'neutral'}`
    : '';

  return (
    <div className={classes} role="group" aria-label={`${title}: ${ariaValue}${badgeText ? `, ${badgeText}` : ''}`}>
      <div className="ui-kpi__top">
        <div className="ui-kpi__label-wrap">
          {Icon && (
            <span className="ui-kpi__icon">
              <Icon size={20} strokeWidth={1.5} />
            </span>
          )}
          <span className="ui-kpi__label">{title}</span>
        </div>
      </div>

      <div className="ui-kpi__value-row">
        <span className="ui-kpi__value">{display}</span>
        {unit && <span className="ui-kpi__unit">{unit}</span>}
        {badgeText && <span className={`ui-kpi__badge ui-kpi__badge--${badgeTone}`}>{badgeText}</span>}
      </div>

      {trend && (
        <div className={`ui-kpi__trend ${trendClass(trend.direction, trend.goodWhen || 'up')}`} aria-label={trendText}>
          <span className="ui-kpi__trend-main">
            <span aria-hidden="true">{trend.direction === 'up' ? '\u25B2' : '\u25BC'}</span>
            {Math.abs(trend.value)}%
          </span>
          <span className="ui-kpi__trend-label">{trend.label || 'vs. last month'}</span>
        </div>
      )}
    </div>
  );
}
