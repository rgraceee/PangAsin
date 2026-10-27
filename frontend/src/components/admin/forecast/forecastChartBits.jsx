// WHAT: Shared pieces of the two line charts on the Forecasting page: the
//       tooltips, the forecast divider label, the current-month marker and
//       the gap-bridge helper.
// WHY: the trajectory and the seasonality chart share the same card, tooltip
//      and axis language, so they share the code too.

import { fmtMT } from './forecastData';

export const NAVY = 'var(--fc-navy)';
export const GOLD = 'var(--fc-gold)';
export const AXIS = 'var(--fc-axis)';

const DIVIDER_TEXT = 'Forecast starts here';
const DIVIDER_W = 122;

/* Rounded "pill" label for the forecast divider, placed to the left of the
   line so it can never be clipped by the right edge of the card. */
export function DividerLabel({ viewBox }) {
  if (!viewBox) return null;
  const x = viewBox.x;
  const y = viewBox.y + 6;
  return (
    <g>
      <rect x={x - DIVIDER_W - 10} y={y} width={DIVIDER_W} height={20} rx={10} fill="#FFFFFF" stroke="var(--fc-border)" />
      <text x={x - 16} y={y + 14} textAnchor="end" fontSize={11.5} fontWeight={600} fill="var(--fc-text-2)">
        {DIVIDER_TEXT}
      </text>
    </g>
  );
}

/* Small dot on the axis marking the month reporting currently stands at. */
export function CurrentMonthMarker({ viewBox }) {
  if (!viewBox) return null;
  return <circle cx={viewBox.x} cy={viewBox.y + viewBox.height} r={3.5} fill={AXIS} />;
}

/* Season band header: a weather icon + the season name in the top-left of the
   band, so the season is readable before the numbers are. */
export function SeasonBand({ viewBox, icon: Icon, title, ink }) {
  if (!viewBox || !Icon) return null;
  const iconX = viewBox.x + 14;
  return (
    <g>
      <Icon x={iconX} y={viewBox.y + 3} size={16} color={ink} strokeWidth={2} />
      <text
        x={iconX + 23}
        y={viewBox.y + 16}
        fontSize={12}
        fontWeight={700}
        letterSpacing="0.09em"
        fill={ink}
      >
        {title}
      </text>
    </g>
  );
}

export function TrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const hasHistory = d.historical !== null && d.historical !== undefined;
  const hasForecast = d.forecast !== null && d.forecast !== undefined;
  if (!hasHistory && !hasForecast) {
    return (
      <div className="fc-tooltip">
        <div className="fc-tooltip-label">{d.labelShort}</div>
        <div className="fc-tooltip-row">
          <span>Production data</span><b>No source row available</b>
        </div>
      </div>
    );
  }
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{d.labelShort}</div>
      {hasHistory && (
        <div className="fc-tooltip-row">
          <span>Production data</span><b>{fmtMT(d.historical)} Metric Tons (MT)</b>
        </div>
      )}
      {hasForecast && (
        <div className="fc-tooltip-row">
          <span>Forecast</span><b>{fmtMT(d.forecast)} Metric Tons (MT)</b>
        </div>
      )}
      {hasForecast && d.lower !== null && d.upper !== null && (
        <div className="fc-tooltip-row">
          <span>Expected range</span><b>{fmtMT(d.lower)} – {fmtMT(d.upper)} Metric Tons (MT)</b>
        </div>
      )}
    </div>
  );
}

export function SeasonTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  if (d.value === null || d.value === undefined) {
    return (
      <div className="fc-tooltip">
        <div className="fc-tooltip-label">{d.label}</div>
        <div className="fc-tooltip-row"><span>Average</span><b>No data</b></div>
      </div>
    );
  }
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{d.label}</div>
      <div className="fc-tooltip-row">
        <span>Average production</span><b>{fmtMT(d.value)} Metric Tons (MT)</b>
      </div>
      <div className="fc-tooltip-source">Averaged over available municipality production data.</div>
    </div>
  );
}

/* Mark the two ends of every gap so a dotted line can bridge it. The values
   come from the same rows the chart already draws - nothing is recalculated. */
export function withGapBridges(rows) {
  const isNull = (r) => r.historical === null || r.historical === undefined;
  const out = (rows || []).map((r) => ({ ...r, bridge: null }));
  for (let i = 0; i < out.length; i += 1) {
    if (!isNull(out[i])) continue;
    let p = i - 1;
    while (p >= 0 && isNull(out[p])) p -= 1;
    if (p < 0) continue;
    let n = i + 1;
    while (n < out.length && isNull(out[n])) n += 1;
    if (n >= out.length) continue;
    if (out[p].bridge === null) out[p].bridge = out[p].historical;
    if (out[n].bridge === null) out[n].bridge = out[n].historical;
  }
  return out;
}
