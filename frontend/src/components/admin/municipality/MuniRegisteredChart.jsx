// WHAT: "Registered Producers by Municipality" as ranked horizontal bars.
// WHY: seven names never fit under rotated axis labels; ranked rows read the
//      leader and the laggard at a glance, and the values sit at the bar ends.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Users } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, niceTicks } from './muniData';
import { BarTooltip } from './muniTooltips';

export default function MuniRegisteredChart({ rows, total, selectedMuni, bare = false }) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  const scale = niceTicks(max);
  const data = rows.map((r) => ({ ...r, share: total > 0 ? (r.count / total) * 100 : 0 }));

  const chart = (
    <>
      {data.length === 0 ? (
        <div className="muni-empty"><span className="muni-empty-chip">No data</span>No salt farmer records for the selected municipalities.</div>
      ) : (
        <div className="muni-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 70, bottom: 4, left: 0 }} barCategoryGap="24%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--muni-grid)" vertical={false} />
              <XAxis type="number" domain={scale.domain} ticks={scale.ticks} tick={{ fontSize: 12, fill: 'var(--muni-axis)' }} tickFormatter={(v) => fmtInt(v)} tickLine={false} axisLine={false} interval={0} />
              <YAxis type="category" dataKey="name" width={124} tick={({ x, y, payload }) => (<text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--muni-text)">{payload.value}</text>)} tickLine={false} axisLine={false} interval={0} />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muni-hover)' }} />
              <Bar dataKey="count" name="Salt Farmers" maxBarSize={18} isAnimationActive={false} label={({ x, y, width, height, index }) => {
                const row = data[index];
                if (!row) return null;
                return <text x={x + width + 10} y={y + height / 2} textAnchor="start" dominantBaseline="central" fontSize={12.5} fontWeight={700} fill="var(--muni-text)">{fmtInt(row.count)}</text>;
              }}>
                {data.map((row) => (
                  <Cell key={row.id} fill={selectedMuni && row.name === selectedMuni ? '#1e3a5f' : 'var(--muni-ocean)'} radius={[0, 8, 8, 0]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </>
  );

  if (bare) return chart;

  return (
    <MuniCard icon={Users} title="Registered Salt Farmers by Municipality" sub="Distinct salt farmers in the master list, ranked" chips={<><MuniChip label="Master list" meta /><MuniChip label={`${fmtInt(total)} salt farmers`} meta /></>} caption="The master list holds the registered salt farmers. Production reports log the same people again each month, so they are not counted here.">
      {chart}
    </MuniCard>
  );
}
