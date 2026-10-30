// WHAT: The three Overview KPI cards of the Forecasting page.
import { ChartLine, Target, TrendingUp } from 'lucide-react';
import KpiCard from '../../ui/KpiCard';
import KpiGrid from '../../ui/KpiGrid';
import { definition, TREND_LABELS } from '../../../constants/labels';
import { fmtMT, fmtPctSigned, directionFromPct } from './forecastData';

export default function ForecastKpis({
  recordedMT, recordedPeriodLabel, recordedThrough,
  forecastMT, horizon,
  expectedChangePct,
  runMonth, loading = false,
}) {
  const direction = directionFromPct(expectedChangePct);
  const hasForecast = horizon > 0;

  return (
    <KpiGrid columns={3} className="fc-kpis">
      <KpiCard
        icon={ChartLine}
        title="Municipality Production"
        value={recordedMT === null ? null : fmtMT(recordedMT)}
        unit="Metric Tons (MT)"
        supporting={`Municipality production data, ${recordedPeriodLabel}${recordedThrough ? ` through ${recordedThrough}` : ''}.`}
        info={definition('recordedMt')}
        loading={loading}
      />

      <KpiCard
        icon={Target}
        title="Forecasted Total Production"
        value={forecastMT === null ? null : fmtMT(forecastMT)}
        unit="Metric Tons (MT)"
        badge={hasForecast
          ? { text: `${horizon} month${horizon === 1 ? '' : 's'}`, tone: 'neutral' }
          : { text: 'No forecast', tone: 'neutral' }}
        supporting={hasForecast
          ? `Total projected production for the next ${horizon} month${horizon === 1 ? '' : 's'}.`
          : 'No forecast run is available for this selection.'}
        info={definition('forecastTotalMt') + ' Source: the latest forecast run for the selected scope and horizon.'}
        loading={loading}
      />

      <KpiCard
        icon={TrendingUp}
        title="Expected Change"
        value={expectedChangePct === null || expectedChangePct === undefined ? null : fmtPctSigned(expectedChangePct)}
        badge={expectedChangePct === null || expectedChangePct === undefined
          ? { text: 'No data', tone: 'neutral' }
          : { text: TREND_LABELS[direction] || 'Stable', tone: direction === 'increasing' ? 'good' : direction === 'declining' ? 'bad' : 'neutral' }}
        trend={expectedChangePct === null || expectedChangePct === undefined ? null : {
          direction: direction === 'declining' ? 'down' : 'up',
          value: Math.round(Math.abs(Number(expectedChangePct) || 0) * 10) / 10,
          label: 'Forecast vs recent average',
          goodWhen: 'up',
        }}
        supporting={runMonth ? `Latest forecast run, generated ${runMonth}.` : 'Latest forecast run.'}
        info={definition('changeVsRecentAvgPct') + ' Source: expected_change_pct of the latest forecast run.'}
        loading={loading}
      />
    </KpiGrid>
  );
}