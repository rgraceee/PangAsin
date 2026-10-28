// WHAT: "Monthly Production Trend" for the selected scope.
// WHY: the page had no month-by-month view. The line uses the same municipality
//      production dataset as the rest of Municipality Analytics, and the hover
//      card adds the month-over-month change without changing any number.
import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { Activity } from 'lucide-react';
import { getAdminDescriptive } from '../../../services/dataService';
import {
  AXIS_TICK_FONT, CHART_ANIMATION, CHART_GRID, compactNumberFormatter,
} from '../../ui/chartTheme';
import MuniCard, { MuniChip } from './MuniCard';
import { TrendTooltip } from './muniTooltips';
import { SkeletonChart } from '../../Skeleton';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANGES = [
  { key: 'all', label: 'All' },
  { key: '6', label: '6 months' },
  { key: '12', label: '12 months' },
  { key: '24', label: '24 months' },
];

function labelMonth(key) {
  const [year, month] = String(key).split('-');
  return `${MONTH_NAMES[Number(month) - 1] || month} ${year}`;
}

export default function MuniMonthlyTrendChart({ selectedMuni, municipalityId }) {
  const [range, setRange] = useState('24');
  const [state, setState] = useState({ loading: true, error: null, data: [] });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null, data: [] });

    const params = { months: 24, source: 'municipality_production' };
    if (municipalityId) params.municipality_id = Number(municipalityId);

    getAdminDescriptive(params)
      .then((res) => {
        if (!alive) return;
        const rows = (res?.monthly_series || []).map((r) => ({
          month: r.month,
          label: labelMonth(r.month),
          value: r.total_mt ?? 0,
        }));
        setState({ loading: false, error: null, data: rows });
      })
      .catch((err) => {
        if (!alive) return;
        setState({ loading: false, error: err?.message || 'Failed to load the monthly trend.', data: [] });
      });

    return () => { alive = false; };
  }, [municipalityId]);

  const sliced = useMemo(() => {
    if (range === 'all') return state.data;
    return state.data.slice(-Number(range));
  }, [state.data, range]);

  /* WHAT: Month-over-month is derived for display only, from the rows already
     on screen. A first point or a zero previous month has no percentage. */
  const rows = useMemo(() => sliced.map((row, index) => {
    if (index === 0) return { ...row, mom: null };
    const previous = Number(sliced[index - 1].value);
    const current = Number(row.value);
    if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0) {
      return { ...row, mom: null };
    }
    return { ...row, mom: ((current - previous) / previous) * 100 };
  }), [sliced]);

  const scopeLabel = selectedMuni || 'Pangasinan';
  const rangeLabel = range === 'all'
    ? `All ${state.data.length} month${state.data.length === 1 ? '' : 's'}`
    : `Last ${range} months`;
  const tickGap = range === '6' ? 64 : 96;

  return (
    <MuniCard
      icon={Activity}
      title="Monthly Production Trend"
      sub={`${scopeLabel} · ${rangeLabel}`}
      chips={<MuniChip label={rangeLabel} meta />}
      caption="Each point is a month in the municipality production dataset. Month-over-month compares with the previous month in view."
    >
      <div className="muni-tabs muni-tabs--filters" role="group" aria-label="Production trend range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`muni-tab${range === r.key ? ' is-active' : ''}`}
            aria-pressed={range === r.key}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {state.loading ? (
        <div className="muni-chart muni-chart--trend">
          <SkeletonChart height="100%" />
        </div>
      ) : state.error ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">Error</span>
          {state.error}
        </div>
      ) : rows.length === 0 ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">No data</span>
          No production data for this scope.
        </div>
      ) : (
        <div className="muni-chart muni-chart--trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 10, right: 14, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray={CHART_GRID.strokeDasharray}
                stroke="var(--muni-grid)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: AXIS_TICK_FONT, fill: 'var(--muni-axis)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={tickGap}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: AXIS_TICK_FONT, fill: 'var(--muni-axis)' }}
                tickFormatter={compactNumberFormatter}
                tickLine={false}
                axisLine={false}
                width={50}
                label={{
                  value: 'MT',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  style: { fontSize: 11, fontWeight: 600, fill: 'var(--muni-muted)' },
                }}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: 'var(--muni-axis)', strokeDasharray: '4 4', strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                name="Production"
                stroke="var(--muni-ocean)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: 'var(--muni-ocean)' }}
                /* WHAT: Animate on first paint and whenever a pill changes the
                   data; hover only moves the tooltip, so Recharts leaves the
                   line alone. */
                isAnimationActive
                animationDuration={CHART_ANIMATION.duration}
                animationEasing={CHART_ANIMATION.easing}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </MuniCard>
  );
}
