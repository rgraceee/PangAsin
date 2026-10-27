// WHAT: The /admin/forecast page - one clean, scrolling page.
// WHY: no tabs. Header, filters, five KPIs, the production trajectory, the
//      seasonal curve and the municipality outlook, in that order, reading
//      the same numbers.
import { useMemo, useState } from 'react';
import { Alert, Col, Row } from 'react-bootstrap';
import { CalendarDays, TrendingUp, ChartLine, Building2, CalendarRange, Info } from 'lucide-react';
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
import { SCOPE_ALL_LABEL } from '../../constants/labels';

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

  const {
    municipalities, outlook, trends, descriptive, selectedRun,
    forecastPoints, forecastTotal, historyRows, timeline, recordedTotal,
    booting, error, reload,
  } = useForecastData(filters);

  /* Keeps the page current: refresh when the admin comes back to the tab and
     once a week as a safety net, plus the manual button in the filter bar. */
  const { lastUpdated, refreshing, refresh } = useAutoRefresh(reload);

  const scopeName = useMemo(() => {
    if (filters.selectedMuni === 'all') return SCOPE_ALL_LABEL;
    const m = municipalities.find((x) => String(x.id) === String(filters.selectedMuni));
    return m ? m.name : '\u2014';
  }, [filters.selectedMuni, municipalities]);

  const horizon = forecastPoints.length;
  const hasForecast = horizon > 0;

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
      actions={(
        <span className="ui-pageheader-chip">
          <CalendarDays size={14} strokeWidth={1.5} aria-hidden="true" />
          Data as of {latestRecordMonth ? monthLong(latestRecordMonth) : 'No data yet'}
        </span>
      )}
      art={<MunicipalityMapArt mode="province" />}
    />
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

      <ForecastFilters
        recordedWindow={filters.recordedWindow}
        onRecordedWindow={set('recordedWindow')}
        forecastHorizon={filters.forecastHorizon}
        onForecastHorizon={set('forecastHorizon')}
        selectedMuni={filters.selectedMuni}
        municipalities={municipalities}
        onSelectedMuni={set('selectedMuni')}
        province={filters.province}
        onProvince={set('province')}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        onRefresh={refresh}
        refreshing={refreshing}
        lastUpdated={lastUpdated}
        summary={filterSummary}
      />

      <ForecastDataNotice notice={notice} scopeKey={filters.selectedMuni} />

      <Alert variant="info" className="mt-3">
        Forecasts use municipality production estimates from Adjusted_Estimates.xlsx,
        not approved barangay submissions. Model outputs are future projections.
      </Alert>

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
        <SectionHead
          icon={ChartLine}
          title="Production Trajectory"
          subtitle={hasForecast
            ? `Municipality production data and the model projection for ${scopeName}.`
            : `Municipality production data for ${scopeName}. No forecast run is available for this scope yet.`}
        />
        <ForecastTrendChart
          data={timeline}
          forecastStartLabel={forecastPoints.length ? forecastPoints[0].period_label : null}
          scopeLabel={scopeName}
          height={340}
        />
      </section>

      <section className="fc-section" id="fc-seasonality">
        <SectionHead
          icon={CalendarRange}
          title="Seasonality"
          subtitle={`When production peaks and troughs across the year for ${scopeName}.`}
        />
        <ForecastSeasonalityChart
          series={seasonalSeries}
          reportingMonth={monthNumber(latestRecordMonth)}
          scopeLabel={scopeName}
          height={320}
        />
      </section>

      <section className="fc-section" id="fc-municipalities">
        <SectionHead
          icon={Building2}
          title="Municipalities"
          subtitle="Every municipality of the seven, in one order, with the places that need a decision first."
        />
        <Row className="g-3">
          <Col lg={12} className="d-flex">
            <ForecastMuniPanels rows={muniRows} height={320} />
          </Col>
          <Col lg={12} className="d-flex">
            <ForecastNeedsAttention items={attentionItems} />
          </Col>
        </Row>
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
