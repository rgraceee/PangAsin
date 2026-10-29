// WHAT: The admin Data Quality page - what is complete, what is missing, and
//       what the admin should do next.
// WHY: The old page contradicted itself (a 100% score next to red bars), showed
//      "82.9% %", hid pending records behind "missing", and only listed
//      problems. Every number here comes from the API, and every panel says
//      where its numbers come from. The header and the KPI cards follow the
//      Dashboard's design language so both pages feel like one product.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card } from 'react-bootstrap';
import {
  AlertTriangle, BadgeCheck, CalendarRange, ClipboardCheck, ClipboardList, RefreshCw,
} from 'lucide-react';
import { getDataQuality } from '../../services/dataService';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import DqHeatmap from './data-quality/DqHeatmap';
import DqFieldCompleteness from './data-quality/DqFieldCompleteness';
import { STATE_LEGEND, formatMonth, formatTimestamp, toneForPercent } from './data-quality/dqData';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import './data-quality/dataQuality.css';

const RANGE_OPTIONS = [
  { value: 'all', label: 'All months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
];

/* WHAT: The status of a KPI card, shown as the small text badge the Dashboard
   uses (e.g. "Surplus" on the Supply-Demand card).
   WHY: One visual language for status across the admin - the card shell, the
        badge slot and the good / warn / bad tones all come from the shared
        components, so the Data Quality cards look like the Dashboard's. */
function statusBadge(tone) {
  if (tone === 'critical') return { text: 'Critical', tone: 'bad' };
  if (tone === 'watch') return { text: 'Watch', tone: 'warn' };
  return { text: 'On track', tone: 'good' };
}

export default function DataQualityDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(12);
  const [selectedId, setSelectedId] = useState(null);
  const { activeNames } = useMunicipalityDirectory();

  const load = useCallback((value) => {
    setRefreshing(true);
    setError(null);
    getDataQuality({ months: value })
      .then((payload) => {
        setData(payload);
        setLoading(false);
        setRefreshing(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  if (loading && !data) {
    return (
      <div className="admin-dashboard-page dq-page skeleton-dashboard">
        <div className="ui-pageheader ui-pageheader--dashboard">
          <SkeletonBlock width="100%" height={24} />
          <SkeletonBlock className="mt-2" width="60%" height={13} />
        </div>
        <div className="mt-4"><SkeletonCards count={4} /></div>
        <div className="skeleton-card"><SkeletonChart height={340} /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dq-page">
        <Alert variant="danger" className="d-flex flex-column align-items-start gap-2">
          <div className="d-flex align-items-center gap-2">
            <AlertTriangle size={18} strokeWidth={2} aria-hidden="true" />
            <strong>We could not load the data quality report.</strong>
          </div>
          <span style={{ fontSize: 13 }}>
            {error.message || 'The request failed.'} Please check that the server is running and that
            you are still signed in, then try again.
          </span>
          <Button size="sm" variant="outline-danger" onClick={() => load(range)}>
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, thresholds, fields, municipalities } = data;
  const behind = municipalities.filter((municipality) => municipality.status !== 'ok');
  const worstBehind = behind.some((municipality) => municipality.status === 'critical')
    ? 'critical' : (behind.length ? 'watch' : 'ok');
  const pendingTone = kpis.pending_total > 0 ? 'watch' : 'ok';
  /* WHY: The supporting line has to stand on its own - it names who is behind
     when there is nothing to review, and says what a review would unlock. */
  const reviewNote = kpis.review_clearable_count > 0
    ? `${kpis.review_clearable_count} of them can move forward once the waiting records are reviewed.`
    : (behind.length ? `Behind: ${behind.map((m) => m.name).join(', ')}.` : 'Every municipality is on track.');
  const rangeLabel = range === 'all'
    ? `Since ${formatMonth(data.months[0])}`
    : `Last ${range} months`;

  const headerActions = null;

  return (
    <div className={`admin-dashboard-page dq-page${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
      <PageHeader
        id="admin-data-quality"
        variant="clean"
        className="ui-pageheader--admin"
        title="Data Quality"
        subtitle="How complete the records are, and which months still have no report."
        actions={headerActions}
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      >
        <div className="dq-range-pills d-flex flex-row gap-2 flex-nowrap align-items-center">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`ui-btn-${String(range) === String(option.value) ? 'primary' : 'outline'} dq-range-pill`}
              onClick={() => setRange(option.value === 'all' ? 'all' : Number(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="dq-refreshable">
        <KpiGrid columns={4}>
          <KpiCard
            icon={ClipboardCheck}
            title="Waiting for review"
            value={kpis.pending_total}
            badge={statusBadge(pendingTone)}
            supporting={kpis.pending_total > 0
              ? `The oldest has been waiting ${kpis.oldest_pending_days} day${kpis.oldest_pending_days === 1 ? '' : 's'}.`
              : 'Nothing is waiting for review.'}
            info="Records submitted by the encoders that no admin has reviewed yet. A month with a waiting record is not the same as a month with no record at all."
          />
          <KpiCard
            icon={CalendarRange}
            title="Months reported"
            value={kpis.reporting_pct}
            unit="%"
            badge={statusBadge(toneForPercent(kpis.reporting_pct, thresholds))}
            supporting={`${kpis.municipality_count} municipalities over ${data.expected_months} completed months`}
            info="Share of municipality-months that have at least one approved record. The month in progress is not counted."
          />
          <KpiCard
            icon={AlertTriangle}
            title="Municipalities behind"
            value={kpis.behind_count}
            unit={`of ${kpis.municipality_count}`}
            badge={statusBadge(worstBehind)}
            supporting={reviewNote}
            info="Municipalities whose score or reporting gap means they need attention. The list below shows exactly which ones and what to do."
          />
          <KpiCard
            icon={BadgeCheck}
            title="Fields filled in"
            value={kpis.field_pct}
            unit="%"
            badge={statusBadge(toneForPercent(kpis.field_pct, thresholds))}
            supporting={`Across all ${fields.length} required fields`}
            info="Share of the required fields that are filled in on approved records. A value of 0 is a valid answer; an empty field is not."
          />
        </KpiGrid>

        <Card className="encoder-card mb-3">
          <Card.Header>
            <div className="admin-card-head">
              <span className="admin-card-head-icon admin-kpi-accent-oceanbg">
                <ClipboardList size={16} strokeWidth={2} />
              </span>
              <div className="d-flex align-items-center gap-2">
                <h5 className="admin-card-head-title">Reporting by month</h5>
                <span className="badge text-bg-light">{rangeLabel}</span>
              </div>
            </div>
          </Card.Header>
          <Card.Body>
            <DqHeatmap data={data} selectedId={selectedId} onSelect={setSelectedId} />
            <div className="dq-legend">
              {STATE_LEGEND.map((item) => (
                <span className="dq-legend-item" key={item.state}>
                  <span className={`dq-legend-swatch dq-legend-swatch--${item.state}`} aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </div>
            <p className="dq-formula">
              Score = {thresholds.w_reporting} &times; months reported + {thresholds.w_fields} &times; fields filled in.
              A score of <b>{thresholds.ok}</b> or more is on track, below <b>{thresholds.watch}</b> needs urgent attention,
              and <b>{thresholds.stale_months}</b> months without a report is already a problem.
            </p>
          </Card.Body>
        </Card>

        <p className="dq-footnote">Generated at {formatTimestamp(data.generated_at)}</p>
      </div>
    </div>
  );
}
