// WHAT: "Registered Producers by Municipality" as ranked horizontal bars.
// WHY: seven names never fit under rotated axis labels; ranked rows read the
//      leader and the laggard at a glance, and the values sit at the bar ends.
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { Users } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, niceTicks } from './municipalityData';
import { BarTooltip } from './municipalityTooltips';
import {
  AXIS_TICK_FONT, BAR_RADIUS, CHART_GRID, VALUE_LABEL_FONT, compactNumberFormatter, useChartMotion,
} from '../../ui/chartTheme';

export default function MuniRegisteredChart({ rows, total, bare = false, animate = true }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const motion = useChartMotion('registered-farmers', animate);

  const max = Math.max(...rows.map((r) => r.count), 1);
  const scale = niceTicks(max);
  const data = rows.map((r) => ({ ...r, share: total > 0 ? (r.count / total) * 100 : 0 }));

  const chart = (
    <>
      {data.length === 0 ? (
        <div className="muni-empty"><span className="muni-empty-chip">No data</span>No salt farmer records for the selected municipalities.</div>
      ) : (
        <div className="muni-chart muni-chart--bars">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 76, bottom: 4, left: 0 }}
              barCategoryGap="24%"
              onMouseLeave={() => setActiveIndex(null)}
            >
              <CartesianGrid
                strokeDasharray={CHART_GRID.strokeDasharray}
                stroke="var(--muni-grid)"
                vertical
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={scale.domain}
                ticks={scale.ticks}
                tick={{ fontSize: AXIS_TICK_FONT, fill: 'var(--muni-axis)' }}
                tickFormatter={compactNumberFormatter}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={124}
                tick={({ x, y, payload }) => (
                  <text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--muni-text)">
                    {payload.value}
                  </text>
                )}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--muni-hover)' }} />
              <Bar
                dataKey="count"
                name="Salt Farmers"
                maxBarSize={20}
                minPointSize={4}
                radius={BAR_RADIUS}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                {...motion}
                label={({ x, y, width, height, index }) => {
                  const row = data[index];
                  if (!row) return null;
                  return (
                    <text
                      x={x + width + 8}
                      y={y + height / 2}
                      textAnchor="start"
                      dominantBaseline="central"
                      fontSize={VALUE_LABEL_FONT}
                      fontWeight={700}
                      fill="var(--muni-text)"
                    >
                      {fmtInt(row.count)}
                    </text>
                  );
                }}
              >
                {data.map((row, index) => (
                  <Cell
                    key={row.id ?? row.name}
                    fill={index === 0 ? 'var(--muni-navy)' : 'var(--muni-ocean)'}
                    fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                  />
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
    <MuniCard icon={Users} title="Registered Salt Farmers by Municipality" sub="Distinct salt farmers in the master list, ranked" chips={<><MuniChip label={`${fmtInt(total)} salt farmers`} meta /></>} caption="The master list holds the registered salt farmers. Production reports log the same people again each month, so they are not counted here.">
      {chart}
    </MuniCard>
  );
}
