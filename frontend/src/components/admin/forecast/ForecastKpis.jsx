// WHAT: The five Overview KPI cards of the Forecasting page.
// WHY: every headline number is rendered once, with its unit, its basis and a
//      plain-language tooltip, so the admin can defend the number.
import {
  ChartLine, Target, TrendingUp, ShieldCheck, Activity,
} from 'lucide-react';
import KpiCard from '../../ui/KpiCard';
import KpiGrid from '../../ui/KpiGrid';
import {
  definition, FORECAST_CONFIDENCE, TREND_LABELS, DATA_SUFFICIENCY,
} from '../../../constants/labels';
import { fmtMT, fmtPctSigned, directionFromPct, READINESS_LABEL } from './forecastData';

export default function ForecastKpis({
  recordedMT, recordedPeriodLabel, recordedThrough,
  forecastMT, horizon,
  expectedChangePct,
  confidence,
  readiness, readinessSupporting,
  runMonth, loading = false,
}) {
  const direction = directionFromPct(expectedChangePct);
  const confidenceLabel = confidence ? (FORECAST_CONFIDENCE[confidence] || confidence) : null;
  const readinessLabel = READINESS_LABEL[readiness?.level] || DATA_SUFFICIENCY[readiness?.level] || null;
  const hasForecast = horizon > 0;

  return (
    <KpiGrid columns={5} className="fc-kpis">
      <KpiCard
        icon={ChartLine}
        title="Recorded Production"
        value={recordedMT === null ? null : fmtMT(recordedMT)}
        unit="Metric Tons (MT)"
        supporting={`Approved records, ${recordedPeriodLabel}${recordedThrough ? ` through ${recordedThrough}` : ''}.`}
        info={definition('recordedMt') + ' Source: approved production records only.'}
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

      <KpiCard
        icon={ShieldCheck}
        title="Forecast Confidence"
        value={confidenceLabel}
        supporting="Combines data volume and backtest accuracy."
        info={definition('forecastConfidence') + ' Source: the latest forecast run.'}
        tone={confidence === 'high' ? 'good' : confidence === 'moderate' ? 'default' : 'bad'}
        loading={loading}
      />

      <KpiCard
        icon={Activity}
        title="Data Readiness"
        value={readinessLabel}
        supporting={readinessSupporting}
        info="Ready = at least 24 months of approved records and data from at least 5 of 7 municipalities. Limited = at least 12 months. Otherwise not enough data."
        tone={readiness?.level === 'ready' ? 'good' : readiness?.level === 'limited' ? 'default' : 'bad'}
        loading={loading}
      />
    </KpiGrid>
  );
}
