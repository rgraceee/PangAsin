// WHAT: The diverging horizontal bar chart used by both municipality panels.
// WHY: One chart implementation so the two panels always share the same
//      municipality order, axis labels, colours and "no data" placeholder.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { fmtPctSigned } from './forecastData';
import { MUNI_COLORS, MUNI_EDGES, colorKeyFor } from './forecastColors';
import { PlaceholderShape, PanelTooltip, MunicipalityTick } from './ForecastMunicipalityTooltip';

export default function ForecastMuniChart({ data, scale, unitLabel, sourceNote }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 62, bottom: 4, left: 0 }} barCategoryGap="24%">
        <XAxis
          type="number"
          domain={scale.domain}
          ticks={scale.ticks}
          tick={{ fontSize: 12, fill: 'var(--fc-axis)' }}
          tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={118}
          tick={<MunicipalityTick />}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <Tooltip
          content={<PanelTooltip unitLabel={unitLabel} sourceNote={sourceNote} />}
          cursor={{ fill: 'var(--fc-hover)' }}
        />
        {/* Clear zero line: the axis every bar grows from. */}
        <ReferenceLine x={0} stroke="var(--fc-text-2)" strokeWidth={1.5} />
        <Bar
          dataKey="value"
          name={unitLabel}
          maxBarSize={16}
          isAnimationActive={false}
          stackId="muni"
          label={({ x, y, width, height, index }) => {
            const row = data[index];
            if (!row || row.value === null || row.value === undefined) return null;
            const right = Math.max(x, x + width);
            const left = Math.min(x, x + width);
            const barWidth = Math.abs(right - left);
            const positive = row.value >= 0;
            // Long negative bars carry the label inside, so it never runs over
            // the municipality names. Short negative bars put the label just
            // past the zero line, where nothing else is drawn.
            const inside = !positive && barWidth > 52;
            const labelX = positive ? right + 10 : (inside ? left + 10 : right + 10);
            return (
              <text
                x={labelX}
                y={y + height / 2}
                textAnchor="start"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fill="var(--fc-text)"
              >
                {fmtPctSigned(row.value)}
              </text>
            );
          }}
        >
          {data.map((entry, i) => {
            const key = colorKeyFor(entry.direction);
            return (
              <Cell
                key={`v-${entry.name}-${i}`}
                fill={MUNI_COLORS[key]}
                stroke={MUNI_EDGES[key]}
                strokeWidth={1}
                radius={entry.value >= 0 ? [0, 8, 8, 0] : [8, 0, 0, 8]}
              />
            );
          })}
        </Bar>
        <Bar
          dataKey="placeholder"
          name="No data"
          maxBarSize={16}
          isAnimationActive={false}
          stackId="muni"
          shape={<PlaceholderShape />}
        >
          {data.map((entry, i) => (
            <Cell
              key={`p-${entry.name}-${i}`}
              fill={MUNI_COLORS.nodata}
              stroke={MUNI_EDGES.nodata}
              strokeDasharray="4 3"
              radius={[0, 8, 8, 0]}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
