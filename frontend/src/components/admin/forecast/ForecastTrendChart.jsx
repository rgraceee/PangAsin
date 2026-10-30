// WHAT: "Municipality Production and Forecast" chart - full width.
// WHY: shows the production history and model projection on one continuous
//      monthly axis. Months with no source row break the solid line and
//      are bridged by a faint dotted connector, so a gap never reads as a
//      drop to zero and never reads as a real value either.
import { useMemo } from 'react';
import {
  ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { ChartLine } from 'lucide-react';
import ForecastChartCard, { ChartChip } from './ForecastChartCard';
import { monthShort } from './forecastData';
import {
  NAVY, GOLD, DividerLabel, TrendTooltip, withGapBridges,
} from './forecastChartBits';

const GRAD_HISTORY = 'url(#fcHistoryGradient)';
const GRAD_BAND = 'url(#fcBandGradient)';

export default function ForecastTrendChart({
  data, forecastStartLabel, scopeLabel, height = 340, emptyText,
}) {
  const rows = useMemo(() => withGapBridges(data), [data]);
  const hasForecast = rows.some((d) => d.forecast !== null && d.forecast !== undefined);
  const hasHistory = rows.some((d) => d.historical !== null && d.historical !== undefined);
  const hasGap = rows.some((d) => d.bridge !== null);
  const startLabel = forecastStartLabel ? monthShort(forecastStartLabel) : null;

  return (
    <ForecastChartCard
      icon={ChartLine}
      title="Production Trajectory"
      subtitle={`${scopeLabel} · each point is a month in metric tons (MT); the dashed line is the forecast.`}
      height={height}
      chips={(
        <>
          {hasHistory && <ChartChip label="Production data" color={NAVY} />}
          {hasForecast && <ChartChip label="Forecast" color={GOLD} dashed />}
          {hasForecast && <ChartChip label="Expected range" color="var(--fc-gold-soft)" />}
        </>
      )}
      caption="Solid line = municipality production data, dashed line = model forecast with its expected range. A dotted bridge marks a month with no source row."
      className="fc-trend-card"
    >
      {rows.length === 0 ? (
        <div className="fc-empty">
          <ChartLine size={22} strokeWidth={1.5} />
          <p>{emptyText || 'No production data available for this selection yet.'}</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 26, right: 20, bottom: 6, left: 2 }}>
            <defs>
              <linearGradient id="fcHistoryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0C2340" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#0C2340" stopOpacity={0.01} />
              </linearGradient>
              <linearGradient id="fcBandGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F09A28" stopOpacity={0.02} />
                <stop offset="100%" stopColor="#F09A28" stopOpacity={0.16} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--fc-grid)" vertical={false} />
            <XAxis
              dataKey="labelShort"
              tick={{ fontSize: 12, fill: 'var(--fc-axis)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--fc-grid)' }}
              minTickGap={14}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12, fill: 'var(--fc-axis)' }}
              tickLine={false}
              axisLine={false}
              width={58}
              tickFormatter={(v) => Number(v).toLocaleString('en-US')}
            />
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--fc-grid)' }} />
            {startLabel && (
              <ReferenceLine
                x={startLabel}
                stroke="var(--fc-axis)"
                strokeDasharray="4 4"
                strokeWidth={1}
                ifOverflow="extendDomain"
                label={<DividerLabel />}
              />
            )}
            {/* Expected range: a soft gold band under the forecast. */}
            <Area type="monotone" dataKey="lower" stackId="band" stroke="none" fill="none" isAnimationActive={false} connectNulls={false} />
            <Area type="monotone" dataKey="band" stackId="band" stroke="none" fill={GRAD_BAND} isAnimationActive={false} connectNulls={false} />
            {/* Recorded production with a soft gradient wash underneath. */}
            <Area type="monotone" dataKey="historical" stroke="none" fill={GRAD_HISTORY} isAnimationActive={false} connectNulls={false} />
            {hasGap && (
              <Line
                type="linear"
                dataKey="bridge"
                stroke="var(--fc-axis)"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                activeDot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="historical"
              stroke={NAVY}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: NAVY }}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="forecast"
              stroke={GOLD}
              strokeWidth={2.5}
              strokeDasharray="6 4"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: GOLD }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </ForecastChartCard>
  );
}
