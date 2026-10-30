// WHAT: "Municipality Contribution" - each municipality's forecast against its
//       historical-share of the annual target, ranked.
// WHY: in the province view the admin needs to see who carries the target and
//       who is behind. A municipality without a forecast is "No data", never a
//       zero bar.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceDot,
} from 'recharts';
import { useState } from 'react';
import { Building2 } from 'lucide-react';
import { fmtMT, fmtAxis } from './targetData';
import { ContributionTooltip, ContributionBar, ContributionLabel } from './targetTooltips';
import TargetCard from './TargetCard';

const ABOVE = 'var(--te-soft-green)';
const ABOVE_EDGE = 'var(--te-green-edge)';
const BELOW = 'var(--te-soft-red)';
const BELOW_EDGE = 'var(--te-red-edge)';
const TARGET = 'var(--te-gold)';
const NODATA = 'var(--te-soft-slate)';
const NODATA_EDGE = 'var(--te-nodata-edge)';

export default function TargetMunicipalityChart({ rows }) {
  const [width, setWidth] = useState(0);
  const maxValue = Math.max(
    ...rows.map((r) => r.forecast || 0),
    ...rows.map((r) => r.targetShare || 0),
    1,
  );
  const above = rows.filter((r) => r.hasForecast && r.above).length;
  const below = rows.filter((r) => r.hasForecast && !r.above).length;
  const missing = rows.filter((r) => !r.hasForecast).length;
  const muniNote = !rows.length
    ? 'No municipality data is available for this target.'
    : (above + below) === 0
      ? 'No municipality has a forecast for this target yet.'
      : `${above} of ${rows.length} municipalities are at or above their target share${missing > 0 ? `; ${missing} have no forecast.` : '.'}`;

  return (
    <TargetCard
      icon={Building2}
      title="Municipality Contribution"
      sub="Each municipality's forecast against its share of the annual target, by past output"
      chips={(
        <>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: ABOVE, borderColor: ABOVE_EDGE }} />At or above share</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: BELOW, borderColor: BELOW_EDGE }} />Below share</span>
          <span className="te-chip"><span className="te-chip-swatch" style={{ background: TARGET }} />Target share</span>
        </>
      )}
      caption="The gold marker is each municipality's target share, based on what it delivered in past complete years. A municipality whose newest forecast covers fewer than 12 months is compared only against the share for those same months."
    >
      <div className="te-muni-summary" role="list">
        <span className="te-muni-summary__item te-muni-summary__item--above" role="listitem">
          <strong>{above}</strong> at or above share
        </span>
        <span className="te-muni-summary__item te-muni-summary__item--below" role="listitem">
          <strong>{below}</strong> below share
        </span>
        <span className="te-muni-summary__item te-muni-summary__item--nodata" role="listitem">
          <strong>{missing}</strong> no forecast
        </span>
      </div>
      <div className="te-chart" style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%" onResize={(w) => setWidth(w)}>
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 112, bottom: 4, left: 0 }}
              barCategoryGap="26%"
            >
              <XAxis
                type="number"
                domain={[0, maxValue * 1.08]}
                tick={{ fontSize: 12, fill: 'var(--te-axis)' }}
                tickFormatter={(v) => fmtAxis(v)}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={118}
                tick={({ x, y, payload }) => (
                  <text x={x - 10} y={y + 5} textAnchor="end" fontSize={13} fill="var(--te-text)">
                    {payload.value}
                  </text>
                )}
                tickLine={false}
                axisLine={false}
                interval={0}
              />
              <Tooltip content={<ContributionTooltip />} cursor={{ fill: 'var(--te-hover)' }} />
              <Bar
                dataKey="forecast"
                name="Forecast"
                maxBarSize={16}
                isAnimationActive={false}
                shape={<ContributionBar />}
                label={({ x, y, width: barWidth, height, index }) => (
                  <ContributionLabel rows={rows} index={index} x={x} y={y} width={barWidth} height={height} chartWidth={width} />
                )}
              >
                {rows.map((row, i) => (
                  <Cell
                    key={`c-${i}`}
                    fill={!row.hasForecast ? NODATA : (row.above ? ABOVE : BELOW)}
                    stroke={!row.hasForecast ? NODATA_EDGE : (row.above ? ABOVE_EDGE : BELOW_EDGE)}
                    strokeWidth={1.25}
                    strokeDasharray={!row.hasForecast ? '4 3' : undefined}
                  />
                ))}
              </Bar>
              {rows.map((row, i) => (
                row.hasForecast ? (
                  <ReferenceDot
                    key={`t-${i}`}
                    x={row.targetShare}
                    y={row.name}
                    r={5}
                    fill={TARGET}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                  />
                ) : null
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="te-note">{muniNote}</div>
        <div className="te-muni-legend">
          {rows.filter((r) => r.hasForecast && r.monthsLabel && r.monthsLabel !== '12 of 12 months').map((r) => (
            <span key={r.id} className="te-chip te-chip--muted">{r.name}: {r.monthsLabel} forecast</span>
          ))}
        </div>
    </TargetCard>
  );
}
