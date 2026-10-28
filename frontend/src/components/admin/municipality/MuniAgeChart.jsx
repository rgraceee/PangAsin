// WHAT: The age-band bar chart of the Producer Profile panel.
// WHY: five bands with their counts and share of the master-list sample, in the
//      same ranked-bar language as the other municipality charts.
import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { fmtInt, niceTicks } from './muniData';
import { AgeTooltip } from './muniTooltips';
import {
  AXIS_TICK_FONT, BAR_RADIUS, CHART_GRID, VALUE_LABEL_FONT, compactNumberFormatter, useChartMotion,
} from '../../ui/chartTheme';

export default function MuniAgeChart({ age, animate = true }) {
  const [activeIndex, setActiveIndex] = useState(null);
  const motion = useChartMotion('age-distribution', animate);

  const max = Math.max(...age.map((r) => r.value), 1);
  const scale = niceTicks(max);

  return (
    <div className="muni-chart muni-chart--age">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={age}
          layout="vertical"
          margin={{ top: 4, right: 76, bottom: 4, left: 0 }}
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
            width={72}
            tick={({ x, y, payload }) => (
              <text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--muni-text)">
                {payload.value}
              </text>
            )}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip content={<AgeTooltip />} cursor={{ fill: 'var(--muni-hover)' }} />
          <Bar
            dataKey="value"
            name="Salt Farmers"
            maxBarSize={20}
            minPointSize={4}
            radius={BAR_RADIUS}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            {...motion}
            label={({ x, y, width, height, index }) => {
              const row = age[index];
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
                  {fmtInt(row.value)}
                </text>
              );
            }}
          >
            {age.map((row, index) => (
              <Cell
                key={row.name}
                fill="var(--muni-ocean)"
                fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
