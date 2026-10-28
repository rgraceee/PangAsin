// WHAT: Shared Recharts theme constants + helpers so every admin chart uses the
//       same fonts, grid, axes, tooltip, legend, and palette.
// WHY: one color = one meaning on every page; no hard-coded hex values in
//      chart components.
import { useEffect, useRef, useState } from 'react';
import { BRAND, STATUS } from '../../theme/colors';

export const CHART_PALETTE = {
  ocean: BRAND.ocean,    // #1565C8 - primary series / forecast
  gold: BRAND.gold,      // #F09A28 - target / benchmark / secondary
  green: BRAND.green,    // #29B039 - good / achieved / solar
  brown: BRAND.brown,    // #574326 - cooked / neutral
  danger: STATUS.not_ready, // #E53935 - bad / shortfall
};

export const GRID_STROKE = 'var(--gray-200)';
export const AXIS_TICK_FONT = 12;
export const VALUE_LABEL_FONT = 13;
export const TOOLTIP_FONT = 13;

/* WHAT: One motion language for every chart.
   WHY: the first paint may animate; any later filter/tab change must either
        stay still or settle quickly, so re-renders never flicker on hover. */
export const CHART_ANIMATION = {
  duration: 800,
  updateDuration: 250,
  easing: 'ease-out',
};

/* WHAT: Rounded horizontal-bar ends shared by the ranked bar charts. */
export const BAR_RADIUS = [0, 7, 7, 0];

/* WHAT: Dotted horizontal grid that reads as a guide, not a cage. */
export const CHART_GRID = {
  strokeDasharray: '2 6',
  vertical: false,
};

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

/* WHAT: Compact axis labels: 950, 1K, 1.5K, 10K, 1.2M.
   WHY: a volume axis stays readable without repeating "MT" on every tick. */
export function compactNumberFormatter(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const compact = (scaled, suffix) => {
    const rounded = Math.round(scaled * 10) / 10;
    return `${sign}${rounded.toLocaleString('en-US', { maximumFractionDigits: 1 })}${suffix}`;
  };
  if (abs >= 1_000_000) return compact(abs / 1_000_000, 'M');
  if (abs >= 1_000) return compact(abs / 1_000, 'K');
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`;
}

/* WHAT: Animate only the first mount of a chart.
   WHY: Recharts restarts its animation whenever the data array changes. That
        made filters/tabs re-animate and looked like flicker. Here the first
        paint gets the full 800ms; as soon as the key changes (filter/tab) the
        animation is switched off, and hover never restarts it. A tab host can
        also pass enabled=false so a chart that remounts inside a tab does not
        replay the intro animation. */
export function useChartMotion(key = 'chart', enabled = true) {
  const firstKey = useRef(key);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!enabled || key !== firstKey.current) {
      setFinished(true);
      return undefined;
    }
    const timer = window.setTimeout(
      () => setFinished(true),
      CHART_ANIMATION.duration + 60,
    );
    return () => window.clearTimeout(timer);
  }, [key, enabled]);

  const isFirstRun = enabled && key === firstKey.current && !finished;

  return {
    isAnimationActive: isFirstRun,
    animationDuration: isFirstRun
      ? CHART_ANIMATION.duration
      : CHART_ANIMATION.updateDuration,
    animationEasing: CHART_ANIMATION.easing,
  };
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
    strokeDasharray: CHART_GRID.strokeDasharray,
    stroke: GRID_STROKE,
    vertical: CHART_GRID.vertical,
  },
  xAxis: { tick: { fontSize: AXIS_TICK_FONT } },
  yAxis: { tick: { fontSize: AXIS_TICK_FONT } },
  legend: {},
};
