// WHAT: The Target Evaluation summary strip: demand target, horizon projection,
//       and the remaining gap or surplus.
import { fmtMT, fmtPct } from './targetData';

function Stat({ label, value, unit, badge, tone, compact }) {
  return (
    <div className={`te-stat${tone ? ` te-stat--${tone}` : ''}`}>
      <div className="te-stat-label">
        <span>{label}</span>
      </div>
      <div className={`te-stat-value${compact ? ' te-stat-value--compact' : ''}`}>
        {value}
        {unit && <span className="te-stat-unit">{unit}</span>}
        {badge && <span className={`te-status te-status--${badge.tone}`}>{badge.label}</span>}
      </div>
    </div>
  );
}

export default function TargetSummary({ summary, evaluationYear }) {
  const { annualTarget, projected, pct, gap, status } = summary;

  return (
    <div className="te-summary">
      <Stat
        label={`Annual demand target ${evaluationYear}`}
        value={fmtMT(annualTarget)}
        unit="Metric Tons (MT)"
      />
      <Stat
        label="Projected supply after horizon"
        value={fmtMT(projected)}
        unit="Metric Tons (MT)"
        badge={{ label: status.label, tone: status.key }}
      />
      <Stat
        label="Target achievement"
        value={pct === null ? '\u2014' : fmtPct(pct)}
        tone={gap >= 0 ? 'good' : 'bad'}
      />
    </div>
  );
}
