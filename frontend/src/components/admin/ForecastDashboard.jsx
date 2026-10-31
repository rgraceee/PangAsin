// WHAT: The /admin/forecast page - one clean, scrolling page.
// WHY: no tabs. Header, filters, the KPIs, the production trajectory and the
//      municipality outlook, in that order, reading the same numbers.
import { useMemo, useState } from 'react';
import { Alert } from 'react-bootstrap';
import { TrendingUp, Info } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import useForecastData from './forecast/useForecastData';
import useAutoRefresh from './forecast/useAutoRefresh';
import ForecastFilters from './forecast/ForecastFilters';
import ForecastKpis from './forecast/ForecastKpis';
import ForecastTrendChart from './forecast/ForecastTrendChart';
import ForecastMuniPanels from './forecast/ForecastMuniPanels';
import ForecastNeedsAttention from './forecast/ForecastNeedsAttention';
import ForecastSeasonalityChart from './forecast/ForecastSeasonalityChart';
import ForecastDataNotice from './forecast/ForecastDataNotice';
import {
  buildMunicipalityRows, buildNeedsAttention, buildSeasonalSeries, buildDataNotice,
} from './forecast/forecastSelectors';
import {
  fmtMT, monthLong, monthNumber,
} from './forecast/forecastData';
import { scopeAllLabel } from '../../constants/labels';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';

const DEFAULT_FILTERS = {
  recordedWindow: 'all',
  forecastHorizon: '6',
  selectedMuni: 'all',
  province: 'pangasinan',
};

function SectionHead({ icon: Icon, title, subtitle }) {
  return (
    <div className="fc-section-head">
      <span className="fc-section-chip"><Icon size={16} strokeWidth={1.75} /></span>
      <div>
        <h2 className="fc-section-title">{title}</h2>
        {subtitle && <p className="fc-section-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

function InnerForecastDashboard() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const { activeNames } = useMunicipalityDirectory();

  const {
    municipalities, outlook, trends, descriptive, selectedRun,
    forecastPoints, forecastTotal, timeline, recordedTotal,
    booting, error, reload,
  } = useForecastData(filters);
  /* Keeps the page current: refresh when the admin comes back to the tab and
     once a week as a safety net, plus the manual button in the filter bar. */
  const { lastUpdated } = useAutoRefresh(reload);

  const scopeName = useMemo(() => {
    if (filters.selectedMuni === 'all') {
      return scopeAllLabel(activeNames.length || municipalities.length);
    }
    const m = municipalities.find((x) => String(x.id) === String(filters.selectedMuni));
    return m ? m.name : '\u2014';
  }, [filters.selectedMuni, municipalities, activeNames.length]);

  const municipalityOptions = useMemo(() => {
    if (activeNames.length === 0) return municipalities;
    const active = new Set(activeNames);
    return municipalities.filter((m) => active.has(m.name));
  }, [municipalities, activeNames]);

  const horizon = forecastPoints.length;

  const muniRows = useMemo(() => buildMunicipalityRows(outlook, trends), [outlook, trends]);
  const attentionItems = useMemo(() => buildNeedsAttention(muniRows), [muniRows]);
  const seasonalSeries = useMemo(
    () => buildSeasonalSeries(descriptive?.seasonal_pattern),
    [descriptive],
  );
  const notice = useMemo(
    () => buildDataNotice(trends, filters.selectedMuni, outlook),
    [trends, filters.selectedMuni, outlook],
  );

  const latestRecordMonth = descriptive?.kpis?.latest_record_month || null;
  const runMonth = selectedRun?.created_at ? monthLong(String(selectedRun.created_at).slice(0, 7)) : null;
  const windowLabel = filters.recordedWindow === 'all'
    ? 'all available months'
    : `the last ${filters.recordedWindow} months`;

  const filterSummary = useMemo(() => {
    if (!selectedRun) {
      return `No forecast run is available for ${scopeName} yet. Production history shown is ${windowLabel}.`;
    }
    return `Showing ${windowLabel} of municipality production data and the next ${horizon} month${horizon === 1 ? '' : 's'} of forecast for ${scopeName}.`;
  }, [selectedRun, scopeName, windowLabel, horizon]);

  const headline = selectedRun && forecastTotal !== null
    ? `Forecast production for the next ${horizon} month${horizon === 1 ? '' : 's'} is ${fmtMT(forecastTotal)} Metric Tons (MT).`
    : 'No forecast run is available for this selection yet.';

  /* WHAT: Ang header ay laging naka-render, kahit naglo-load pa o may error.
     WHY: hindi na "kumakalog" ang pahina (skeleton lang ang nagpapalit) at
          hindi nawawala ang navigation context kapag mabagal ang API. */
  const header = (
    <PageHeader
      id="admin-forecast-header"
      variant="clean"
      className="ui-pageheader--admin"
      title="Forecasting"
      subtitle="Future production estimates and decision support for the salt industry."
      art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
    >
      <ForecastFilters
        recordedWindow={filters.recordedWindow}
        onRecordedWindow={set('recordedWindow')}
        forecastHorizon={filters.forecastHorizon}
        onForecastHorizon={set('forecastHorizon')}
        selectedMuni={filters.selectedMuni}
        municipalities={municipalityOptions}
        municipalityCount={activeNames.length || municipalityOptions.length}
        onSelectedMuni={set('selectedMuni')}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        lastUpdated={lastUpdated}
        summary={filterSummary}
      />
    </PageHeader>
  );

  if (booting) {
    return (
      <div className="admin-single-page forecast-page">
        {header}
        <div className="skeleton-dashboard">
          <SkeletonBlock width="45%" height={24} />
          <SkeletonBlock width="70%" height={13} />
          <div className="mt-4"><SkeletonCards count={5} /></div>
          <div className="skeleton-card"><SkeletonChart height={320} /></div>
          <div className="skeleton-card"><SkeletonChart height={280} /></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-single-page forecast-page">
        {header}
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="admin-single-page forecast-page">
      {header}

      <ForecastDataNotice notice={notice} scopeKey={filters.selectedMuni} />

      <section className="fc-section" id="fc-overview">
        <SectionHead
          icon={TrendingUp}
          title="Overview"
          subtitle={headline}
        />
        <ForecastKpis
          recordedMT={recordedTotal}
          recordedPeriodLabel={windowLabel}
          recordedThrough={latestRecordMonth ? monthLong(latestRecordMonth) : null}
          forecastMT={forecastTotal}
          horizon={horizon}
          expectedChangePct={selectedRun ? selectedRun.expected_change_pct : null}
          runMonth={runMonth}
          loading={!selectedRun}
        />
      </section>

      <section className="fc-section" id="fc-trajectory">
        <ForecastTrendChart
          data={timeline}
          forecastStartLabel={forecastPoints.length ? forecastPoints[0].period_label : null}
          scopeLabel={scopeName}
          height={340}
        />
      </section>

      <section className="fc-section" id="fc-seasonality">
        <ForecastSeasonalityChart
          series={seasonalSeries}
          reportingMonth={latestRecordMonth ? monthNumber(latestRecordMonth) : null}
          scopeLabel={scopeName}
          height={320}
        />
      </section>

      <section className="fc-section fc-outlook" id="fc-municipalities">
        <ForecastMuniPanels rows={muniRows} height={320} />
        <ForecastNeedsAttention items={attentionItems} total={muniRows.length} />
      </section>

      <footer className="fc-footer-note">
        <Info size={13} strokeWidth={1.75} aria-hidden="true" />
        <span>Forecasting is a decision-support feature, not a guarantee of future production.</span>
      </footer>
    </div>
  );
}

export default function ForecastDashboard() {
  return (
    <ErrorBoundary>
      <InnerForecastDashboard />
    </ErrorBoundary>
  );
}
