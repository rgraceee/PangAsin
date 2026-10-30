// WHAT: "Cumulative Pace" - recorded production plus the forecast as one
//       continuous line against the seasonal target path.
// WHY: it answers "will we reach the target, and if not, where do we fall
//       short?" in a single picture, with the forecast's own range as a band.
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

export default function TargetPaceChart({ rows, annualTarget, reachedMonth, yearEndGap }) {
  const [width, setWidth] = useState(0);
  const narrow = width > 0 && width < 560;
  const firstForecast = rows.find((r) => r.isForecast);
  const lastRow = rows[rows.length - 1];
  const reached = rows.find((r) => r.label === reachedMonth);
  const band = rows.map((r) => ({
    ...r,
    bandLower: r.cumLower ?? null,
    bandUpper: r.cumUpper ?? null,
  }));
  const gapNote = !rows.length
    ? 'No production or forecast data is available for this target.'
    : yearEndGap == null
      ? 'No projected year-end gap is available for this target.'
      : yearEndGap >= 0
        ? `Projected year-end is ${fmtMT(yearEndGap)} Metric Tons (MT) above the ${fmtMT(annualTarget)} Metric Tons (MT) target.`
        : `Projected year-end is ${fmtMT(Math.abs(yearEndGap))} Metric Tons (MT) below the ${fmtMT(annualTarget)} Metric Tons (MT) target.`;

  return (
    <TargetCard
      icon={ChartNoAxesColumnIncreasing}
      title="Target path vs production"
      sub="Recorded production against the seasonal target path; the dashed line is the target."
      chips={(
        <>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: NAVY }} />Production to date</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: GOLD }} />Target path</span>
          <span className="te-chip"><span className="te-chip-swatch te-chip-swatch--soft" style={{ background: 'var(--te-gold-soft)' }} />Expected range</span>
        </>
      )}
      caption={`The target path spreads the ${fmtMT(annualTarget)} Metric Tons (MT) annual target across the months by season, so wet months are not judged against a flat share. Forecast months beyond the evaluation year are not part of this target.`}
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
              <PaceMarkers rows={rows} reachedMonth={reachedMonth} yearEndGap={yearEndGap} narrow={narrow} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="te-note">{gapNote}</div>
    </TargetCard>
  );
}
