// WHAT: Cumulative approved supply plus each forecast month against demand.
// WHY: it answers whether supply reaches the target within the selected horizon.
import { useState } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceArea,
} from 'recharts';
import { ChartNoAxesColumnIncreasing } from 'lucide-react';
import { fmtMT, fmtAxis } from './targetData';
import { PaceTooltip } from './targetTooltips';
import PaceMarkers from './targetPaceMarkers';
import TargetCard from './TargetCard';

const NAVY = 'var(--te-navy)';
const GOLD = 'var(--te-gold)';

export default function TargetPaceChart({ rows, annualTarget, reachedMonth, horizonGap }) {
  const [width, setWidth] = useState(0);
  const narrow = width > 0 && width < 560;
  const firstForecast = rows.find((r) => r.isForecast);
  const lastRow = rows[rows.length - 1];
  const band = rows.map((r) => ({
    ...r,
    bandLower: r.cumLower ?? null,
    bandUpper: r.cumUpper ?? null,
  }));
  const gapNote = !rows.length
    ? 'No production or forecast data is available for this target.'
    : horizonGap == null
      ? 'No projected supply gap is available for this target.'
      : horizonGap >= 0
        ? `Projected supply after the selected horizon is ${fmtMT(horizonGap)} Metric Tons (MT) above the ${fmtMT(annualTarget)} Metric Tons (MT) demand target.`
        : `Projected supply after the selected horizon is ${fmtMT(Math.abs(horizonGap))} Metric Tons (MT) below the ${fmtMT(annualTarget)} Metric Tons (MT) demand target.`;

  return (
    <TargetCard
      icon={ChartNoAxesColumnIncreasing}
      title="Projected cumulative supply vs demand"
      sub="Approved supply to date plus monthly forecasts, compared with the full demand target."
      chips={(
        <>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: NAVY }} />Cumulative supply</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: GOLD }} />Demand target</span>
          <span className="te-chip"><span className="te-chip-swatch te-chip-swatch--soft" style={{ background: 'var(--te-gold-soft)' }} />Forecast range</span>
        </>
      )}
      caption={`Current supply is the sum of approved production records from January through the latest reported month (${fmtMT(rows[0]?.cumTotal ?? 0)} Metric Tons (MT)). Each forecast month is added to that starting supply; the dashed line is the full ${fmtMT(annualTarget)} Metric Tons (MT) demand target.`}
    >
      <div className="te-chart" style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
            <ComposedChart data={band} margin={{ top: 22, right: 22, bottom: 6, left: 2 }}>
              <defs>
                <linearGradient id="tePaceBand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F09A28" stopOpacity={0.02} />
                  <stop offset="100%" stopColor="#F09A28" stopOpacity={0.18} />
                </linearGradient>
              </defs>
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
                tick={{ fontSize: 12, fill: 'var(--te-axis)' }}
                tickLine={false}
                axisLine={false}
                width={62}
                tickFormatter={(v) => fmtAxis(v)}
              />
              <Tooltip content={<PaceTooltip />} cursor={{ stroke: 'var(--te-grid)' }} />
              {firstForecast && (
                <ReferenceArea
                  x1={firstForecast.label}
                  x2={lastRow.label}
                  fill="var(--te-ocean)"
                  fillOpacity={0.04}
                  ifOverflow="hidden"
                />
              )}
              <Area type="monotone" dataKey="bandLower" stackId="pace" stroke="none" fill="none" connectNulls={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="bandUpper" stackId="pace" stroke="none" fill="url(#tePaceBand)" connectNulls={false} isAnimationActive={false} />
              <Line
                type="monotone"
                dataKey="cumTarget"
                stroke={GOLD}
                strokeWidth={2.5}
                strokeDasharray="6 4"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cumTotal"
                stroke={NAVY}
                strokeWidth={3}
                dot={{ r: 3, fill: NAVY, strokeWidth: 0 }}
                activeDot={{ r: 5.5, fill: NAVY, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
              <PaceMarkers rows={rows} reachedMonth={reachedMonth} horizonGap={horizonGap} narrow={narrow} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="te-note">{gapNote}</div>
    </TargetCard>
  );
}
