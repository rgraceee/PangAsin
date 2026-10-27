// WHAT: The age-band bar chart of the Producer Profile panel.
// WHY: five bands with their counts and share of the master-list sample.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { fmtInt } from './muniData';
import { AgeTooltip } from './muniTooltips';

export default function MuniAgeChart({ age }) {
  return (
    <div className="muni-chart" style={{ height: 280 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={age} layout="vertical" margin={{ top: 4, right: 76, bottom: 4, left: 0 }} barCategoryGap="26%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--muni-grid)" vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 12, fill: 'var(--muni-axis)' }}
            tickFormatter={(v) => fmtInt(v)}
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
            isAnimationActive={false}
            label={({ x, y, width, height, index }) => {
              const row = age[index];
              if (!row) return null;
              return (
                <text
                  x={x + width + 10}
                  y={y + height / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={12.5}
                  fontWeight={700}
                  fill="var(--muni-text)"
                >
                  {fmtInt(row.value)}
                </text>
              );
            }}
          >
            {age.map((row) => (
              <Cell key={row.name} fill="var(--muni-ocean)" radius={[0, 8, 8, 0]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
