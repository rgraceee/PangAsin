// WHAT: Tooltips and the custom bar shape shared by the Target Evaluation
//       charts.
// WHY: one place for the hover content and the "No data" row, so all three
//       charts read the same way.

import { fmtMT, fmtPct, fmtSignedMT } from './targetData';

const NODATA = 'var(--te-nodata-edge)';

export function PaceTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const hasValue = d.cumTotal !== null && d.cumTotal !== undefined;
  return (
    <div className="te-tooltip">
      <div className="te-tooltip-label">{d.label}</div>
      {hasValue ? (
        <>
          <div className="te-tooltip-row">
            <span>Production to date</span><b>{fmtMT(d.cumTotal)} Metric Tons (MT)</b>
          </div>
          <div className="te-tooltip-row">
            <span>Target to date</span><b>{fmtMT(d.cumTarget)} Metric Tons (MT)</b>
          </div>
          <div className="te-tooltip-row">
            <span>Gap</span><b>{fmtSignedMT(d.cumTotal - d.cumTarget)} Metric Tons (MT)</b>
          </div>
        </>
      ) : (
        <div className="te-tooltip-row"><span>Recorded</span><b>No data</b></div>
      )}
    </div>
  );
}

export function MonthTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const actual = d.value;
  return (
    <div className="te-tooltip">
      <div className="te-tooltip-label">{d.label}</div>
      <div className="te-tooltip-row">
        <span>{d.isRecorded ? 'Recorded' : 'Forecast'}</span>
        <b>{actual === null || actual === undefined ? '\u2014' : `${fmtMT(actual)} Metric Tons (MT)`}</b>
      </div>
      <div className="te-tooltip-row">
        <span>Monthly target</span><b>{fmtMT(d.target)} Metric Tons (MT)</b>
      </div>
      <div className="te-tooltip-row">
        <span>Difference</span>
        <b>{actual === null || actual === undefined ? '\u2014' : fmtSignedMT(d.gap)} Metric Tons (MT)</b>
      </div>
      {d.requiredPace !== null && d.requiredPace !== undefined && (
        <div className="te-tooltip-row">
          <span>Required pace</span><b>{fmtMT(d.requiredPace)} Metric Tons (MT)</b>
        </div>
      )}
    </div>
  );
}

export function ContributionTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="te-tooltip">
      <div className="te-tooltip-label">{d.name}</div>
      {d.hasForecast ? (
        <>
          <div className="te-tooltip-row">
            <span>Forecast</span><b>{fmtMT(d.forecast)} Metric Tons (MT)</b>
          </div>
          <div className="te-tooltip-row">
            <span>Target share</span><b>{fmtMT(d.targetShare)} Metric Tons (MT)</b>
          </div>
          <div className="te-tooltip-row">
            <span>Delivery</span><b>{fmtPct(d.ratio * 100)}</b>
          </div>
          {d.monthsLabel && <div className="te-tooltip-row"><span>Coverage</span><b>{d.monthsLabel}</b></div>}
        </>
      ) : (
        <div className="te-tooltip-row">
          <span>Status</span><b>No data</b>
        </div>
      )}
    </div>
  );
}

/* The value at the end of a municipality bar, plus its coverage note. */
export function ContributionLabel({ rows, index, x, y, width, height }) {
  const row = rows[index];
  if (!row || !row.hasForecast) return null;
  const valueText = fmtMT(row.forecast);
  const partial = row.monthsLabel && row.monthsLabel !== '12 of 12 months';
  // Long bars carry the value inside so it never collides with the
  // target-share marker just past the bar.
  const textW = valueText.length * 7;
  const inside = width > textW + 34;
  const labelX = inside ? x + width - 8 : x + width + 10;
  return (
    <g>
      <text
        x={labelX}
        y={y + height / 2}
        textAnchor={inside ? 'end' : 'start'}
        dominantBaseline="central"
        fontSize={12.5}
        fontWeight={700}
        fill="var(--te-text)"
      >
        {valueText}
      </text>
      {partial && !inside && (
        <text
          x={labelX + textW + 8}
          y={y + height / 2}
          textAnchor="start"
          dominantBaseline="central"
          fontSize={11.5}
          fill="var(--te-muted)"
        >
          {row.monthsLabel}
        </text>
      )}
    </g>
  );
}

/* A municipality without a forecast gets a dashed stub and a clear tag, so an
   empty row never reads as a zero. */
export function ContributionBar({ x, y, width, height, payload, fill, stroke, strokeWidth }) {
  if (payload && payload.hasForecast === false) {
    return (
      <g>
        <rect x={x} y={y} width={10} height={height} rx={5} fill="var(--te-soft-slate)" stroke={NODATA} strokeWidth={1.25} strokeDasharray="4 3" />
        <text x={x + 18} y={y + height / 2} dominantBaseline="central" fontSize={12} fontWeight={600} fill="var(--te-muted)">
          No data
        </text>
      </g>
    );
  }
  return (
    <rect x={x} y={y} width={width} height={height} rx={8} fill={fill} stroke={stroke} strokeWidth={strokeWidth || 1.25} />
  );
}
