// WHAT: "Seasonal Pattern" - a smooth curve of the average output per
//       calendar month, with the dry and wet seasons shaded.
// WHY: a season is a cycle, not 12 separate quantities. The two zones say
//      what the chart is about before the numbers are even read. Months with
//      no source row stays empty - the line breaks, never drawn as zero.
import { useState } from 'react';
import {
  ComposedChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, CartesianGrid,
} from 'recharts';
import { CalendarDays, Sun, CloudRain } from 'lucide-react';
import ForecastChartCard, { ChartChip } from './ForecastChartCard';
import { fmtMT, seasonalExtremes, MONTH_SHORT } from './forecastData';
import { NAVY, AXIS, CurrentMonthMarker, SeasonTooltip, SeasonBand } from './forecastChartBits';

const DRY = 'var(--fc-dry)';
const DRY_INK = 'var(--fc-dry-ink)';
const RAINY = 'var(--fc-rainy)';
const RAINY_INK = 'var(--fc-rainy-ink)';
const CURVE = NAVY;
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/* Pangasinan's salt calendar: the dry season (amihan) runs November to May,
   the wet season (habagat) June to October. On a January-December axis the
   dry season wraps around the year edge - Jan-May left, Nov-Dec right. */
const SEASONS = {
  dry: { from: 0.5, to: 5.5, label: 'Nov \u2013 May' },
  wet: { from: 5.5, to: 10.5, label: 'Jun \u2013 Oct' },
  dryTail: { from: 10.5, to: 12.5 },
};

/* One dot per month; the peak and the lowest month get a highlighted ring
   (their numbers live in the card header, so the curve stays quiet). */
function SeasonDot({ cx, cy, payload, peakMonth, lowestMonth }) {
  if (!payload) return null;
  const isPeak = peakMonth !== null && payload.month === peakMonth;
  const isLow = lowestMonth !== null && payload.month === lowestMonth;
  if (isPeak || isLow) {
    return <circle cx={cx} cy={cy} r={6} fill={CURVE} stroke="#FFFFFF" strokeWidth={2.5} />;
  }
  return <circle cx={cx} cy={cy} r={3} fill={CURVE} />;
}

export default function ForecastSeasonalityChart({ series, reportingMonth, scopeLabel, height = 320 }) {
  const [width, setWidth] = useState(0);
  const data = (series || []).map((s) => ({
    month: s.month,
    label: MONTH_SHORT[s.month - 1] || s.label,
    value: s.value === undefined ? null : s.value,
  }));
  const { peak, lowest } = seasonalExtremes(data);
  // Below 520px the full season names do not fit side by side, so the headers
  // shorten to DRY / WET and the tail band loses its label - the chips still
  // carry the full names.
  const compact = width > 0 && width < 520;
  const tickInterval = compact ? 1 : 0;

  return (
    <ForecastChartCard
      icon={CalendarDays}
      title="Seasonal Pattern"
      subtitle={`${scopeLabel} \u00b7 dry and wet months across the year \u00b7 metric tons (MT) per month, averaged over complete years`}
      height={height}
      chips={(
        <>
          <ChartChip label={`Dry season (${SEASONS.dry.label})`} color={DRY} />
          <ChartChip label={`Wet season (${SEASONS.wet.label})`} color={RAINY} />
          {peak && <ChartChip label={`Peak: ${peak.label} at ${fmtMT(peak.value)} MT`} meta />}
          {lowest && <ChartChip label={`Lowest: ${lowest.label} at ${fmtMT(lowest.value)} MT`} meta />}
        </>
      )}
      caption="Production concentrates in the dry season (amihan, Nov–May) and falls through the wet season (habagat, Jun–Oct). Averages use municipality production data."
      className="fc-season-card"
    >
      <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
        <ComposedChart data={data} margin={{ top: 26, right: 12, bottom: 4, left: 0 }}>
          {/* The two seasons, shaded edge to edge. The dry season (amihan)
              wraps around the year edge: Jan-May on the left, Nov-Dec on the
              right; the wet season (habagat) sits in the middle. */}
          <ReferenceArea
            x1={SEASONS.dry.from}
            x2={SEASONS.dry.to}
            fill={DRY}
            fillOpacity={0.6}
            ifOverflow="hidden"
            label={<SeasonBand icon={Sun} title={compact ? 'DRY' : 'DRY SEASON'} ink={DRY_INK} />}
          />
          <ReferenceArea
            x1={SEASONS.wet.from}
            x2={SEASONS.wet.to}
            fill={RAINY}
            fillOpacity={0.6}
            ifOverflow="hidden"
            label={<SeasonBand icon={CloudRain} title={compact ? 'WET' : 'WET SEASON'} ink={RAINY_INK} />}
          />
          <ReferenceArea
            x1={SEASONS.dryTail.from}
            x2={SEASONS.dryTail.to}
            fill={DRY}
            fillOpacity={0.6}
            ifOverflow="hidden"
            label={compact ? null : <SeasonBand icon={Sun} title="DRY" ink={DRY_INK} />}
          />
          <CartesianGrid strokeDasharray="3 3" stroke="var(--fc-grid)" vertical={false} />
          <XAxis
            type="number"
            dataKey="month"
            domain={[0.5, 12.5]}
            ticks={MONTHS}
            tickFormatter={(m) => MONTH_SHORT[m - 1]}
            tick={{ fontSize: 12, fill: 'var(--fc-axis)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--fc-grid)' }}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fontSize: 12, fill: 'var(--fc-axis)' }}
            tickLine={false}
            axisLine={false}
            width={58}
            tickFormatter={(v) => Number(v).toLocaleString('en-US')}
          />
          <Tooltip content={<SeasonTooltip />} cursor={{ stroke: 'var(--fc-grid)' }} />
          {reportingMonth && (
            <ReferenceLine
              x={reportingMonth}
              stroke={AXIS}
              strokeDasharray="4 3"
              strokeWidth={1.25}
              label={<CurrentMonthMarker />}
            />
          )}
          <Area
            type="monotone"
            dataKey="value"
            stroke={CURVE}
            strokeWidth={2.5}
            fill="var(--fc-curve-fill)"
            fillOpacity={1}
            dot={(props) => (
              <SeasonDot
                {...props}
                peakMonth={peak ? peak.month : null}
                lowestMonth={lowest ? lowest.month : null}
              />
            )}
            activeDot={{ r: 5, fill: CURVE, strokeWidth: 0 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ForecastChartCard>
  );
}
