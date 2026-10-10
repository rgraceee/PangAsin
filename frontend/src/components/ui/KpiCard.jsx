import React, { useId, useState } from 'react';
import { Info } from 'lucide-react';

// WHAT: I-format ang raw value para sa display at para sa aria-label.
// WHY: numbers dapat may thousands separator, blangko/zero dapat "—" o "0".
function renderValue(value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') return value.toLocaleString();
  return value;
}

// WHAT: Ambag ng trend arrow + kulay base sa meaning.
// WHY: berde kapag "good" ang direksyon, pula kapag "bad", abo kapag neutral.
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
  supporting,
  tone = 'default',
  info,
  trend,
  badge,
  loading = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const classes = ['ui-kpi', tone !== 'default' ? `ui-kpi--${tone}` : '', className].filter(Boolean).join(' ');

  /* WHAT: Skeleton state na pareho ang sukat sa totoong card.
     WHY: hindi tumatalon ang layout habang naglo-load. */
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
        <div className="ui-kpi__skeleton-block" style={{ width: '85%', height: 12 }} />
      </div>
    );
  }

  const display = renderValue(value);
  const ariaValue = unit ? `${display} ${unit}` : `${display}`;
  // WHAT: Badge ay maaaring string lang o {text, tone}.
  // WHY: tinitipid ang call site — string default good (green), object para sa warn/bad.
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
        {info && (
          <button
            type="button"
            className="ui-kpi__info"
            aria-label={`About ${title}`}
            aria-expanded={open}
            aria-describedby={open ? tooltipId : undefined}
            onClick={() => setOpen((o) => !o)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          >
            <Info size={14} strokeWidth={2} />
            {open && (
              <span className="ui-kpi__tooltip" role="tooltip" id={tooltipId}>{info}</span>
            )}
          </button>
        )}
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

      {supporting && <div className="ui-kpi__supporting">{supporting}</div>}
    </div>
  );
}
