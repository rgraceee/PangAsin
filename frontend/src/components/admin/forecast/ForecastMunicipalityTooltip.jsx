// WHAT: Small building blocks of the municipality bar chart: the white
//       tooltip, the "no data" placeholder row and the municipality tick.
// WHY: kept apart so the chart file stays short and each piece has one job.

import { MUNI_COLORS, MUNI_EDGES } from './forecastColors';

const NODATA = MUNI_COLORS.nodata;
const NODATA_EDGE = MUNI_EDGES.nodata;

/* A dashed stub plus a small tag, so a municipality without a comparable
   number reads as a deliberate state instead of an empty row. */
export function PlaceholderShape({ x, y, width, height, payload }) {
  if (!payload || payload.placeholder === null || payload.placeholder === undefined) return null;
  const w = Math.max(width, 10);
  const label = payload.status === 'incomplete' ? 'Incomplete' : 'No data';
  const tagW = label.length * 6.4 + 16;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={height}
        rx={7}
        fill={NODATA}
        stroke={NODATA_EDGE}
        strokeDasharray="4 3"
        strokeWidth={1.25}
      />
      <rect
        x={x + w + 8}
        y={y + height / 2 - 10}
        width={tagW}
        height={20}
        rx={10}
        fill="#FFFFFF"
        stroke={NODATA_EDGE}
        strokeDasharray="3 2"
      />
      <text
        x={x + w + 16}
        y={y + height / 2}
        textAnchor="start"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={600}
        fill="var(--fc-text-muted)"
      >
        {label}
      </text>
    </g>
  );
}

export function PanelTooltip({ active, payload, unitLabel, sourceNote }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const hasValue = d.value !== null && d.value !== undefined;
  let direction = 'Stable';
  if (hasValue) {
    const n = Number(d.value);
    direction = n > 2 ? 'Increase' : n < -2 ? 'Decrease' : 'Stable';
  }
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{d.name}</div>
      {hasValue ? (
        <>
          <div className="fc-tooltip-row">
            <span>{unitLabel}</span><b>{fmtSigned(d.value)}</b>
          </div>
          <div className="fc-tooltip-row">
            <span>Direction</span><b>{direction}</b>
          </div>
        </>
      ) : (
        <div className="fc-tooltip-row">
          <span>Status</span>
          <b>{d.status === 'incomplete' ? 'Incomplete data' : 'No data'}</b>
        </div>
      )}
      <div className="fc-tooltip-source">{sourceNote}</div>
    </div>
  );
}

function fmtSigned(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

/* One shared y-axis tick renderer so both panels label the municipalities
   identically, on a single line, at the same size. */
export function MunicipalityTick({ x, y, payload }) {
  return (
    <text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--fc-text)">
      {payload.value}
    </text>
  );
}
