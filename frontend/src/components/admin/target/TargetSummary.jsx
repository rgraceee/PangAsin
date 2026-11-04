// WHAT: The Target Evaluation summary strip: demand target, horizon projection,
//       and the remaining gap or surplus.
import { Info } from 'lucide-react';
import { fmtMT, fmtPct, fmtSignedMT } from './targetData';

function Stat({ label, value, unit, sub, badge, tone, info, compact }) {
  return (
    <div className={`te-stat${tone ? ` te-stat--${tone}` : ''}`}>
      <div className="te-stat-label">
        <span>{label}</span>
        {info && (
          <span className="te-stat-info" title={info} aria-label={info}>
            <Info size={13} strokeWidth={2} />
          </span>
        )}
      </div>
      <div className={`te-stat-value${compact ? ' te-stat-value--compact' : ''}`}>
        {value}
        {unit && <span className="te-stat-unit">{unit}</span>}
        {badge && <span className={`te-status te-status--${badge.tone}`}>{badge.label}</span>}
      </div>
      {sub && <div className="te-stat-sub">{sub}</div>}
    </div>
  );
}

export default function TargetSummary({ summary, evaluationYear, partial }) {
  const { annualTarget, projected, pct, gap, status, rangeLow, rangeHigh, recordedTotal, forecastTotal } = summary;

  return (
    <div className="te-summary">
      <Stat
        label={`Annual demand target ${evaluationYear}`}
        value={fmtMT(annualTarget)}
        unit="Metric Tons (MT)"
        sub="Compared with current approved supply plus the selected forecast horizon"
      />
      <Stat
        label="Projected supply after horizon"
        value={fmtMT(projected)}
        unit="Metric Tons (MT)"
        badge={{ label: status.label, tone: status.key }}
        sub={`${fmtMT(recordedTotal)} Metric Tons (MT) current approved supply + ${fmtMT(forecastTotal)} Metric Tons (MT) forecast`}
        info="On track: projected supply meets at least 90% of the target. At risk: 70% to 90%. Off track: below 70%."
      />
      <Stat
        label="Target achievement"
        value={pct === null ? '\u2014' : fmtPct(pct)}
        sub={`${gap >= 0 ? 'Surplus' : 'Shortfall'} ${fmtSignedMT(gap)} Metric Tons (MT) vs target; likely range ${rangeLow === null ? '\u2014' : `${fmtMT(rangeLow, 0)} \u2013 ${fmtMT(rangeHigh, 0)}`} Metric Tons (MT)`}
        tone={gap >= 0 ? 'good' : 'bad'}
      />
      {partial && (
        <div className="te-summary-note">
          <strong>Partial forecast:</strong> only {partial.covered} of {partial.remaining} requested months are available,
          so the projected supply uses the forecast months available.
        </div>
      )}
    </div>
  );
}
