// WHAT: "Production by Municipality" as ranked horizontal bars.
// WHY: seven names never fit under rotated axis labels; ranked rows read the
//      leader and the laggard at a glance, and the values sit at the bar ends.
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import MuniCard, { MuniChip } from './MuniCard';
import { fmtInt, fmtMT, niceTicks } from './muniData';
import { ProductionTooltip } from './muniTooltips';
import {
  AXIS_TICK_FONT, BAR_RADIUS, CHART_GRID, VALUE_LABEL_FONT, compactNumberFormatter, useChartMotion,
} from '../../ui/chartTheme';

export default function MuniProductionChart({ rows }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const motion = useChartMotion('production-by-municipality');

  const data = [...rows]
    .map((row) => ({ ...row, volumeMT: Number(row.volumeMT) || 0 }))
    .sort((a, b) => b.volumeMT - a.volumeMT);
  const total = data.reduce((sum, row) => sum + row.volumeMT, 0);
  const max = Math.max(...data.map((row) => row.volumeMT), 1);
  const scale = niceTicks(max);
  const chartRows = data.map((row) => ({
    ...row,
    share: total > 0 ? (row.volumeMT / total) * 100 : 0,
  }));

  return (
    <MuniCard
      icon={TrendingUp}
      title="Production by Municipality"
      sub="Total volume (MT), ranked"
      chips={<MuniChip label={`${fmtInt(total)} MT total`} meta />}
      caption="Ranked by total volume. Share of total compares each municipality with the scope total."
    >
      {data.length === 0 ? (
        <div className="muni-empty">
          <span className="muni-empty-chip">No data</span>
          No production records for the selected municipalities.
        </div>
      ) : (
        <div className="muni-chart muni-chart--bars">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 4, right: 84, bottom: 4, left: 0 }}
              barCategoryGap="26%"
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
                width={108}
                tick={({ x, y, payload }) => (
                  <text
                    x={x - 10}
                    y={y + 5}
                    textAnchor="end"
                    fontSize={13}
                    fill="var(--muni-text)"
                  >
                    {payload.value}
                  </text>
                )}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip
                content={<ProductionTooltip />}
                cursor={{ fill: 'var(--muni-hover)' }}
              />
              <Bar
                dataKey="volumeMT"
                name="Production"
                maxBarSize={20}
                minPointSize={4}
                radius={BAR_RADIUS}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                {...motion}
                label={({ x, y, width, height, index }) => {
                  const row = chartRows[index];
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
                      {fmtMT(row.volumeMT, 1)} MT
                    </text>
                  );
                }}
              >
                {chartRows.map((row, index) => (
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
    </MuniCard>
  );
}
