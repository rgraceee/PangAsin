// WHAT: Shared Recharts theme constants + helpers so every admin chart uses the
//       same fonts, grid, axes, tooltip, legend, and palette.
// WHY: one color = one meaning on every page; no hard-coded hex values in
//      chart components.
import { BRAND, STATUS } from '../../theme/colors';

export const CHART_PALETTE = {
  ocean: BRAND.ocean,    // #1565C8 - primary series / forecast
  gold: BRAND.gold,      // #F09A28 - target / benchmark / secondary
  green: BRAND.green,    // #29B039 - good / achieved / solar
  brown: BRAND.brown,    // #574326 - cooked / neutral
  danger: STATUS.not_ready, // #E53935 - bad / shortfall
};

export const GRID_STROKE = 'var(--gray-200)';
export const AXIS_TICK_FONT = 11;
export const TOOLTIP_FONT = 12;

/* WHAT: Build a consistent YAxis tick formatter that shows Metric Tons (MT) with thousands
   separators and no decimals. WHY: pantay ang pagbabasa ng lahat ng volume axis. */
export function mtTickFormatter(v) {
  return `${Math.round(v).toLocaleString()} Metric Tons (MT)`;
}

/* WHAT: Build a consistent plain number tick formatter (thousands, no unit).
   WHY: para sa percentage / count axes na hindi kailangan ng "MT". */
export function numberTickFormatter(v) {
  return Math.round(v).toLocaleString();
}

/* WHAT: Consistent Recharts tooltip content wrapper. WHY: lahat ng chart
   tooltip ay parehong look (white card, label + value rows). */
export function TooltipContent({ rows, label }) {
  return (
    <div className="admin-chart-tooltip">
      {label && <div className="ct-label">{label}</div>}
      {rows.map(({ name, value }, i) => (
        <div key={i} className="ct-row">
          <span className="ct-name">{name}</span>
          <span className="ct-value">{Number(value).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

/* WHAT: Standard Recharts theme props applied to every chart. WHY: single
   source for grid/axis/tooltip/legend styling. */
export const chartBaseProps = {
  margin: { top: 10, right: 20, bottom: 10, left: 0 },
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: GRID_STROKE,
  },
  xAxis: { tick: { fontSize: AXIS_TICK_FONT } },
  yAxis: { tick: { fontSize: AXIS_TICK_FONT } },
  legend: {},
};
