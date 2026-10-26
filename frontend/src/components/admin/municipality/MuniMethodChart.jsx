// WHAT: "Production Method" as a donut with a readable legend.
// WHY: the old legend was tiny and carried a "0 Metric Tons (MT) / 0.0%" slice from a
//      fraction of a ton. Slices under 0.5 Metric Tons (MT) are dropped and every row shows
//      the method, the volume and the share.
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Blend } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, fmtPct } from './muniData';
import { MethodTooltip } from './muniTooltips';

export default function MuniMethodChart({ rows, total }) {
  const leader = rows[0];

  return (
    <MuniCard
      icon={Blend}
      title="Production Method"
      sub="Approved production records, all time"
      chips={<MuniChip label={`${fmtInt(total)} Metric Tons (MT)`} meta />}
      caption={leader
        ? `${leader.name} leads production with ${fmtPct(leader.pct)}.`
        : 'No production recorded for the selected municipalities.'}
    >
      {rows.length === 0 ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">No data</span>
          No production method data for the selected municipalities.
        </div>
      ) : (
        <div className="muni-method">
          <div className="muni-method-donut">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {rows.map((entry) => <Cell key={entry.key} fill={entry.color} />)}
                </Pie>
                <Tooltip content={<MethodTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="muni-legend" role="list">
            {rows.map((row) => (
              <li key={row.key} className="muni-legend-item">
                <span className="muni-legend-swatch" style={{ background: row.color }} />
                <span className="muni-legend-name">{row.name}</span>
                <span className="muni-legend-value">{fmtInt(row.value)} Metric Tons (MT)</span>
                <span className="muni-legend-pct">{fmtPct(row.pct)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </MuniCard>
  );
}
