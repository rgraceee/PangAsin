// WHAT: The annotations on the Cumulative Pace chart: where the forecast
//       starts, the month the target is reached, and the year-end shortfall.
// WHY: they are the chart's answer, so they live together and are easy to
//       place (and to shorten on a narrow chart).

import { ReferenceLine, ReferenceDot } from 'recharts';
import { fmtMT } from './targetData';

export default function PaceMarkers({ rows, reachedMonth, yearEndGap, narrow }) {
  const firstForecast = rows.find((r) => r.isForecast);
  const lastRow = rows[rows.length - 1];
  const reached = rows.find((r) => r.label === reachedMonth);

  return (
    <>
      {firstForecast && (
        <ReferenceLine
          x={firstForecast.label}
          stroke="var(--te-axis)"
          strokeDasharray="4 4"
          strokeWidth={1}
          label={narrow ? null : {
            value: 'Forecast starts',
            position: 'insideTopLeft',
            fontSize: 12,
            fill: 'var(--te-axis)',
            offset: 6,
          }}
        />
      )}
      {reached && (
        <ReferenceLine
          x={reached.label}
          stroke="var(--te-green)"
          strokeWidth={1.5}
          label={{
            value: `Target reached ${fmtMT(reached.cumTarget)} Metric Tons (MT)`,
            position: 'insideTopRight',
            fontSize: 12,
            fill: 'var(--te-green)',
            offset: 6,
          }}
        />
      )}
      {!reached && lastRow && (
        <>
          <ReferenceLine
            x={lastRow.label}
            stroke="var(--te-red)"
            strokeWidth={1.5}
            label={{
              value: narrow
                ? `Shortfall ${fmtMT(Math.abs(yearEndGap))} Metric Tons (MT)`
                : `Year-end shortfall ${fmtMT(Math.abs(yearEndGap))} Metric Tons (MT)`,
              position: narrow ? 'insideTopLeft' : 'insideBottomRight',
              fontSize: 12,
              fontWeight: 700,
              fill: 'var(--te-red)',
              offset: 6,
            }}
          />
          <ReferenceDot
            x={lastRow.label}
            y={lastRow.cumTotal}
            r={6}
            fill="var(--te-red)"
            stroke="#FFFFFF"
            strokeWidth={2}
          />
        </>
      )}
    </>
  );
}
