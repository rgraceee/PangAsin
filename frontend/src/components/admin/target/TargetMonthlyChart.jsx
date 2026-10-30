// WHAT: "Monthly vs Target" - one zero-based bar per month of the evaluation
//       year, coloured by whether it beats its monthly target.
// WHY: the flat annual/12 target made every wet month look like a failure;
//      with a seasonal target each month is judged fairly, and the required
//      pace marker shows what is still needed to hit the annual number.
import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceDot, Cell,
} from 'recharts';
import { ChartColumnBig } from 'lucide-react';
import { fmtMT, fmtAxis } from './targetData';
import { MonthTooltip } from './targetTooltips';
import TargetCard from './TargetCard';

const ABOVE = 'var(--te-soft-green)';
const ABOVE_EDGE = 'var(--te-green-edge)';
const BELOW = 'var(--te-soft-red)';
const BELOW_EDGE = 'var(--te-red-edge)';
const TARGET = 'var(--te-gold)';
const PACE = 'var(--te-pace)';

export default function TargetMonthlyChart({ rows, paceNote }) {
  const [width, setWidth] = useState(0);
  const narrow = width > 0 && width < 560;
  const values = rows.map((r) => r.value || 0);
  const chartMax = Math.max(...values, ...rows.map((r) => r.target || 0), 1);
  // The required pace can be enormous when recorded production is very low.
  // It is capped for drawing and explained in a short note.
  const paceRows = rows.filter((r) => r.isForecast && r.requiredPace !== null && r.requiredPace !== undefined);
  const cap = chartMax * 1.5;
  const pacePoints = paceRows.map((r) => ({ ...r, paceDisplay: Math.min(r.requiredPace, cap), capped: r.requiredPace > cap }));
  const domainMax = Math.max(chartMax, ...pacePoints.map((p) => p.paceDisplay)) * 1.06;

  return (
    <TargetCard
      icon={ChartColumnBig}
      title="Monthly target vs forecast"
      sub="Each bar is one month against its target; the line marks the required pace."
      chips={(
        <>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: ABOVE, borderColor: ABOVE_EDGE }} />At or above target</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: BELOW, borderColor: BELOW_EDGE }} />Below target</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: TARGET }} />Monthly target</span>
          {pacePoints.length > 0 && (
            <span className="te-chip"><span className="te-chip-swatch" style={{ background: PACE }} />Required pace</span>
          )}
        </>
      )}
      caption="Solid outline = approved records, dashed outline = forecast. Bars are zero-based so a short bar really is short. Forecast months past the evaluation year are not part of this target."
    >
      <div className="te-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
            <ComposedChart data={rows} margin={{ top: 18, right: 20, bottom: 6, left: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--te-grid)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: 'var(--te-axis)' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--te-grid)' }}
                minTickGap={10}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, domainMax]}
                tick={{ fontSize: 12, fill: 'var(--te-axis)' }}
                tickLine={false}
                axisLine={false}
                width={62}
                tickFormatter={(v) => fmtAxis(v)}
              />
              <Tooltip content={<MonthTooltip />} cursor={{ fill: 'var(--te-hover)' }} />
              <Bar
                dataKey="value"
                name="Production"
                maxBarSize={40}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
                label={({ x, y, width, index }) => {
                  const row = rows[index];
                  if (narrow) return null;
                  if (!row || row.value === null || row.value === undefined) return null;
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={600}
                      fill="var(--te-text-2)"
                      stroke="#FFFFFF"
                      strokeWidth={3}
                      paintOrder="stroke"
                    >
                      {fmtMT(row.value)}
                    </text>
                  );
                }}
              >
                {rows.map((row, i) => {
                  const above = (row.value ?? 0) >= (row.target || 0);
                  return (
                    <Cell
                      key={`m-${i}`}
                      fill={above ? ABOVE : BELOW}
                      stroke={above ? ABOVE_EDGE : BELOW_EDGE}
                      strokeWidth={1.25}
                      strokeDasharray={row.isForecast ? '4 3' : undefined}
                    />
                  );
                })}
              </Bar>
              <Line
                type="monotone"
                dataKey="target"
                stroke={TARGET}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: TARGET, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              {pacePoints.map((p) => (
                <ReferenceDot
                  key={`pace-${p.month}`}
                  x={p.label}
                  y={p.paceDisplay}
                  r={5}
                  fill={PACE}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {paceNote && <div className="te-note"><strong>Required pace:</strong> {paceNote}</div>}
        {!paceNote && <div className="te-note">No forecast months are available to compare with the monthly target.</div>}
    </TargetCard>
  );
}
