// WHAT: The admin Data Integrity page - what is complete, what is missing, and
//       what the admin should do next.
// WHY: Reporting percentages and month counts should make the actual report
//      coverage easy to scan.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Card } from 'react-bootstrap';
import {
  AlertTriangle, BadgeCheck, CalendarRange, ClipboardCheck, ClipboardList,
} from 'lucide-react';
import { getDataQuality } from '../../services/dataService';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from './PageHeader';
import MunicipalityMapArt from '../encoder/MunicipalityMapArt';
import DqHeatmap from './data-quality/DqHeatmap';
import { STATE_LEGEND, formatTimestamp } from './data-quality/dqData';
import useMunicipalityDirectory from '../../hooks/useMunicipalityDirectory';
import './data-quality/dataQuality.css';

const RANGE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 6, label: '6 months' },
  { value: 12, label: '12 months' },
];

export default function DataQualityDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [range, setRange] = useState(12);
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedId, setSelectedId] = useState(null);
  const { activeNames } = useMunicipalityDirectory();

  const load = useCallback((value, selectedYear) => {
    setRefreshing(true);
    setError(null);
    getDataQuality({ months: value, year: selectedYear })
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
    load(range, year);
  }, [range, year, load]);

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
            <strong>We could not load the data integrity report.</strong>
          </div>
          <span style={{ fontSize: 13 }}>
            {error.message || 'The request failed.'} Please check that the server is running and that
            you are still signed in, then try again.
          </span>
          <button type="button" className="ui-btn-outline ui-btn--sm" onClick={() => load(range, year)}>
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  if (!data) return null;

  const { kpis, fields, municipalities } = data;
  const behind = municipalities.filter((municipality) => municipality.reporting_pct < 100);
  /* WHY: The supporting line has to stand on its own - it names who is behind
     when there is nothing to review, and says what a review would unlock. */
  const reviewNote = kpis.review_clearable_count > 0
    ? `${kpis.review_clearable_count} of them can move forward once the waiting records are reviewed.`
    : (behind.length ? `Behind: ${behind.map((m) => m.name).join(', ')}.` : 'Every municipality is on track.');
  const rangeLabel = range === 'all'
    ? `All months · ${year}`
    : `${range} months · ${year}`;

  const years = data.available_years || [year];

  return (
    <div className={`admin-dashboard-page dq-page${refreshing ? ' is-refreshing' : ''}`} aria-busy={refreshing}>
      <PageHeader
        id="admin-data-quality"
        variant="clean"
        className="ui-pageheader--admin"
        title="Data Integrity (Completeness)"
        subtitle="How complete the records are, and which months still have no report."
        art={<MunicipalityMapArt mode="province" activeNames={activeNames} />}
      >
        <div className="dq-range-pills d-flex flex-row gap-2 flex-wrap align-items-center">
          <label className="visually-hidden" htmlFor="dq-year">Year</label>
          <select
            id="dq-year"
            className="form-select"
            aria-label="Year"
            style={{ width: 120 }}
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {years.map((optionYear) => (
              <option key={optionYear} value={optionYear}>{optionYear}</option>
            ))}
          </select>
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
            supporting={`${kpis.municipality_count} municipalities · ${data.expected_months} months in this period`}
            info="Share of municipality-months in the selected window that have at least one approved record."
          />
          <KpiCard
            icon={AlertTriangle}
            title="Municipalities behind"
            value={kpis.behind_count}
            unit={`of ${kpis.municipality_count}`}
            supporting={reviewNote}
            info="Municipalities with at least one month without an approved report in this period."
          />
          <KpiCard
            icon={BadgeCheck}
            title="Fields filled in"
            value={kpis.field_pct}
            unit="%"
            supporting={`Across all ${fields.length} required fields`}
            info="Share of the required fields that are filled in on approved records. A value of 0 is a valid answer; an empty field is not."
          />
        </KpiGrid>

        <Card className="encoder-card mb-3">
          <Card.Header>
            <div className="admin-card-head">
              <span className="admin-card-head-icon admin-card-head-icon--soft">
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
          </Card.Body>
        </Card>

        <p className="dq-footnote">Generated at {formatTimestamp(data.generated_at)}</p>
      </div>
    </div>
  );
}
