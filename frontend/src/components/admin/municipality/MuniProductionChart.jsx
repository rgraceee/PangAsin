import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, niceTicks } from './muniData';
import { BarTooltip } from './muniTooltips';

export default function MuniProductionChart({ rows, selectedMuni }) {
  const data = [...rows].sort((a, b) => b.volumeMT - a.volumeMT);
  const max = Math.max(...data.map((r) => r.volumeMT), 1);
  const scale = niceTicks(max);
  const total = data.reduce((s, r) => s + r.volumeMT, 0);

  return (
    <MuniCard
      icon={TrendingUp}
      title="Production by Municipality"
      sub="Total volume (MT), ranked"
      chips={<MuniChip label={`${fmtInt(total)} MT total`} meta />}
    >
      {data.length === 0 ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">No data</span>
          No production records for the selected municipalities.
        </div>
      ) : (
        <div className="muni-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 0 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muni-grid)" vertical={false} />
              <XAxis type="number" domain={scale.domain} ticks={scale.ticks} tick={{ fontSize: 12, fill: 'var(--muni-axis)' }} tickFormatter={(v) => fmtInt(v)} tickLine={false} axisLine={false} interval={0} />
              <YAxis type="category" dataKey="name" width={124} tick={({ x, y, payload }) => (
                <text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--muni-text)">{payload.value}</text>
              )} tickLine={false} axisLine={false} interval={0} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muni-hover)' }} />
              <Bar dataKey="volumeMT" name="Volume (MT)" maxBarSize={18} isAnimationActive={false} label={({ x, y, width, height, index }) => {
                const row = data[index];
                if (!row) return null;
                return <text x={x + width + 10} y={y + height / 2} textAnchor="start" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--muni-text)">{fmtInt(row.volumeMT)}</text>;
              }}>
                {data.map((row) => (
                  <Cell key={row.id} fill={selectedMuni && row.name === selectedMuni ? '#1e3a5f' : 'var(--muni-ocean)'} radius={[0, 8, 8, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </MuniCard>
  );
}