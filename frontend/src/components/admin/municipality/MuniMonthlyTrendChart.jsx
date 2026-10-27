import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity } from 'lucide-react';
import { getAdminDescriptive } from '../../../services/dataService';
import MuniCard, { MuniChip } from './MuniCard';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RANGES = [
  { key: 'all', label: 'All' },
  { key: '6', label: '6 months' },
  { key: '12', label: '12 months' },
  { key: '24', label: '24 months' },
];

function labelMonth(key) {
  const [y, m] = String(key).split('-');
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
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
        setState({ loading: false, error: err?.message || 'Failed to load', data: [] });
      });
    return () => { alive = false; };
  }, [municipalityId]);

  const sliced = (() => {
    if (range === 'all') return state.data;
    const n = Number(range);
    return state.data.slice(-n);
  })();

  const rangeLabel = range === 'all'
    ? `All (${state.data.length} months)`
    : `${range} months`;

  const tickInterval = range === '6' ? 0 : range === '12' ? 1 : range === '24' ? 2 : Math.max(1, Math.floor(sliced.length / 6));

  return (
    <MuniCard
      icon={Activity}
      title="Monthly Production Trend"
      sub={selectedMuni ? `${selectedMuni} · ${rangeLabel}` : `Pangasinan (all municipalities) · ${rangeLabel}`}
      chips={<MuniChip label={rangeLabel} meta />}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            aria-pressed={range === r.key}
            onClick={() => setRange(r.key)}
            style={{ padding: '4px 10px', borderRadius: 999, border: '1px solid #ccc', background: range === r.key ? '#1e3a5f' : '#fff', color: range === r.key ? '#fff' : '#333', cursor: 'pointer' }}
          >
            {r.label}
          </button>
        ))}
      </div>
      {state.loading ? (
        <div className="muni-empty"><span className="muni-empty-chip">Loading</span>Loading monthly trend…</div>
      ) : state.error ? (
        <div className="muni-empty"><span className="muni-empty-chip">Error</span>{state.error}</div>
      ) : sliced.length === 0 ? (
        <div className="muni-empty"><span className="muni-empty-chip">No data</span>No production data for this scope.</div>
      ) : (
        <div className="muni-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sliced} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muni-grid)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muni-axis)' }} tickLine={false} axisLine={false} interval={tickInterval} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--muni-axis)' }} tickFormatter={(v) => Number(v).toLocaleString()} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => [`${Number(v).toLocaleString()} MT`, 'Production']} labelFormatter={(l) => l} />
              <Line type="monotone" dataKey="value" stroke="var(--muni-ocean)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </MuniCard>
  );
}