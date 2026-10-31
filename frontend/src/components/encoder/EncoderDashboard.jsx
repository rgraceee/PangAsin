import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import {
  Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Activity, Boxes, LayoutGrid, PieChart as PieGlyph, Users } from 'lucide-react';
import { getStats, getEncoderMonths, getEncoderBarangays, getProducers } from '../../services/dataService';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from '../admin/PageHeader';
import MunicipalityMapArt from './MunicipalityMapArt';
import EncoderProfileCharts from './EncoderProfileCharts';
import { formatMT } from '../../utils/volumeFormat';
import PeriodFilters, { usePeriodFilters } from './PeriodFilters';
import MuniCard, { MuniChip } from '../admin/municipality/MuniCard';
import MuniDonut from '../admin/municipality/MuniDonut';
import { fmtMT, fmtPct } from '../admin/municipality/municipalityData';
import {
  AXIS_TICK_FONT, CHART_GRID, compactNumberFormatter, useChartMotion,
} from '../ui/chartTheme';

const BRAND_PALETTE = [
  '#0D2B4B',
  '#1565C8',
  '#43A047',
  '#D4A017',
  '#795548',
  '#1E88E5',
  '#8E24AA',
  '#00897B',
  '#E64A19',
  '#5E35B1',
];

function colorFor(name, names) {
  const idx = names.indexOf(name);
  if (idx < 0) return BRAND_PALETTE[0];
  return BRAND_PALETTE[idx % BRAND_PALETTE.length];
}

/* WHAT: White hover card for the multi-line production trend.
   WHY: Same label + value rows as the Admin municipality charts; every barangay
        series in the month is listed with its own colour. */
function TrendLineTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{label || '—'}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey || entry.name} className="muni-tooltip-row">
          <span>
            <span
              className="muni-legend-swatch"
              style={{ display: 'inline-block', marginRight: 6, background: entry.stroke || entry.color }}
              aria-hidden="true"
            />
            {entry.name}
          </span>
          <b>{fmtMT(entry.value, 1)} MT</b>
        </div>
      ))}
      <div className="muni-tooltip-source">Approved production records in the selected period.</div>
    </div>
  );
}

/* WHAT: White hover card for the barangay share donut. */
function ShareTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload || {};
  return (
    <div className="muni-tooltip">
      <div className="muni-tooltip-label">{row.name || '—'}</div>
      <div className="muni-tooltip-row">
        <span>Production</span><b>{fmtMT(row.value, 1)} MT</b>
      </div>
      <div className="muni-tooltip-row">
        <span>Share</span><b>{fmtPct(row.pct)}</b>
      </div>
      <div className="muni-tooltip-source">Approved production records in the selected period.</div>
    </div>
  );
}

export default function EncoderDashboard() {
  const { user } = useOutletContext();

  const [months, setMonths] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [barangayId, setBarangayId] = useState('');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [producerStats, setProducerStats] = useState(null);
  const [producerLoading, setProducerLoading] = useState(true);
  const [producerError, setProducerError] = useState(null);

  useEffect(() => {
    getEncoderMonths()
      .then((res) => setMonths(res.months || []))
      .catch(() => {});
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch(() => {});
  }, []);

  /* WHAT: Master list statistics for the Gender and Age cards.
     WHY: The producer master list has no period dimension, so this request only
          follows the Barangay filter. The cards state that in their caption. */
  useEffect(() => {
    let alive = true;
    setProducerLoading(true);
    const params = {};
    if (barangayId) params.barangay_id = barangayId;
    getProducers(params)
      .then((res) => {
        if (!alive) return;
        setProducerStats(res.statistics || null);
        setProducerError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setProducerError(err.message || 'Failed to load the salt farmer profile.');
      })
      .finally(() => {
        if (alive) setProducerLoading(false);
      });
    return () => { alive = false; };
  }, [barangayId]);

  const period = usePeriodFilters(months);
  const { range, rangeError } = period;
  const lineMotion = useChartMotion('encoder-production-trend');

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (range.start) params.start = range.start;
    if (range.end) params.end = range.end;
    if (barangayId) params.barangay_id = barangayId;
    getStats(params)
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard.'); setLoading(false); });
  }, [range.start, range.end, barangayId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  /* WHAT: Ang napiling barangay para sa labels ng charts at pie breakdown. */
  const selectedBarangay = useMemo(
    () => barangays.find((b) => String(b.id) === String(barangayId)) || null,
    [barangays, barangayId],
  );
  const selectedName = selectedBarangay?.name
    || (barangayId ? stats?.by_barangay?.[0]?.barangay : null)
    || null;

  /* WHAT: Kapag may napiling barangay, "share of municipality" ang pie.
     WHY: isang slice lang (100%) ang Barangay Total Summary kapag isa lang
          ang barangay; mas kapaki-pakinabang kung makita ang bahagi nito sa
          buong munisipyo para sa parehong period. */
  const pieData = useMemo(() => {
    if (!stats) return [];
    if (barangayId) {
      const selected = Math.round((stats.total_volume_mt || 0) * 1000) / 1000;
      const municipality = Math.round((stats.municipality_total_volume_mt ?? selected) * 1000) / 1000;
      const others = Math.round((municipality - selected) * 1000) / 1000;
      const data = [];
      if (selected > 0) data.push({ name: selectedName || 'Selected barangay', value: selected });
      if (others > 0) data.push({ name: 'Other barangays', value: others });
      return data;
    }
    return [...(stats.by_barangay || [])]
      .filter((b) => (b.total_volume_mt || 0) > 0)
      .sort((a, b) => a.barangay.localeCompare(b.barangay))
      .map((b) => ({ name: b.barangay, value: Math.round((b.total_volume_mt || 0) * 1000) / 1000 }));
  }, [stats, barangayId, selectedName]);

  const pieTotal = useMemo(
    () => pieData.reduce((sum, d) => sum + d.value, 0),
    [pieData],
  );

  const barangayOrder = useMemo(
    () => (stats?.barangays || pieData.map((d) => d.name)).slice().sort((a, b) => a.localeCompare(b)),
    [stats, pieData],
  );

  /* WHAT: Donut rows carry the same shape the Admin MuniDonut expects.
     WHY: name, value, colour and share in one place — no second calculation in
          the chart or the legend. */
  const pieRows = useMemo(
    () => pieData.map((entry) => ({
      ...entry,
      key: entry.name,
      color: entry.name === 'Other barangays' ? '#C3CEDD' : colorFor(entry.name, barangayOrder),
      pct: pieTotal > 0 ? (entry.value / pieTotal) * 100 : 0,
    })),
    [pieData, pieTotal, barangayOrder],
  );

  const lineData = useMemo(() => {
    if (!stats) return [];
    return (stats.by_month || []).map((row) => {
      const out = { month: row.month };
      barangayOrder.forEach((b) => { out[b] = row[b] || 0; });
      return out;
    });
  }, [stats, barangayOrder]);

  if (loading && !stats) {
    return (
      <div className="skeleton-dashboard">
        <SkeletonBlock width="45%" height={24} />
        <SkeletonBlock width="70%" height={13} />
        <div className="mt-4"><SkeletonCards count={4} /></div>
        <div className="row g-3 mt-1">
          <div className="col-lg-7"><div className="skeleton-card"><SkeletonChart height={280} /></div></div>
          <div className="col-lg-5"><div className="skeleton-card"><SkeletonChart height={280} /></div></div>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return <Alert variant="danger">{error}</Alert>;
  }

  /* WHAT: Priority ng municipality name: user ( agad may value pagkalogin) -> stats -> fallback.
     WHY: para walang flash ng fallback text habang naglo-load pa ang stats. */
  const municipalityName = user?.municipality_name || stats?.municipality_name || 'your municipality';

  return (
    <div className="encoder-dashboard">
      <PageHeader
        id="encoder-overview"
        variant="clean"
        className="ui-pageheader--encoder"
        title="Dashboard"
        subtitle={`Record, review, and manage salt production data for ${municipalityName}.`}
        art={<MunicipalityMapArt highlightName={municipalityName} />}
      >
        <PeriodFilters filters={period} />
        <label className="admin-page-hero-control" htmlFor="encoder-dashboard-barangay">
          <span className="admin-page-hero-field">Barangay</span>
          <select
            id="encoder-dashboard-barangay"
            className="admin-page-hero-select"
            value={barangayId}
            onChange={(e) => setBarangayId(e.target.value)}
          >
            <option value="">All barangays</option>
            {barangays.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
      </PageHeader>

      {rangeError && <Alert variant="warning">{rangeError}</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}

      <KpiGrid columns={3}>
        <KpiCard
          icon={Boxes}
          title="Total Production"
          value={formatMT(stats.total_volume_mt)}
          unit="Metric Tons (MT)"
          info="Sum of production volume across all your records for the selected period."
        />
        <KpiCard
          icon={LayoutGrid}
          title="Total Salt Beds"
          value={stats.total_salt_beds}
          info="Total salt beds counted across your records for the selected period."
        />
        <KpiCard
          icon={Users}
          title="Registered Salt Farmers"
          value={stats.total_registered_producers}
          info="Total registered salt farmers counted across your records for the selected period."
        />
      </KpiGrid>

      <Row className="g-3 mb-4">
        <Col lg={7}>
          <MuniCard
            icon={Activity}
            title={selectedName ? `Production Trend · ${selectedName}` : 'Production by Barangay'}
            sub={selectedName
              ? 'Each point is one month; the line shows how volume moves over time.'
              : 'Each line is one barangay; higher points mean more volume that month.'}
            chips={<MuniChip label="Metric Tons (MT)" meta />}
            caption="Approved production records in the selected period and barangay."
          >
            {lineData.length === 0 ? (
              <div className="muni-empty">
                <span className="muni-empty-chip">No data</span>
                No records in this period.
              </div>
            ) : (
              <>
                <div className="muni-chart muni-chart--trend">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
                      <CartesianGrid
                        strokeDasharray={CHART_GRID.strokeDasharray}
                        vertical={false}
                        stroke="var(--muni-grid)"
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: AXIS_TICK_FONT, fill: 'var(--muni-axis)' }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--muni-border)' }}
                      />
                      <YAxis
                        tick={{ fontSize: AXIS_TICK_FONT, fill: 'var(--muni-axis)' }}
                        tickFormatter={compactNumberFormatter}
                        tickLine={false}
                        axisLine={false}
                        width={48}
                      />
                      <Tooltip
                        content={<TrendLineTooltip />}
                        cursor={{ stroke: 'var(--muni-border)' }}
                      />
                      {barangayOrder.map((b) => (
                        <Line
                          key={b}
                          type="monotone"
                          dataKey={b}
                          name={b}
                          stroke={colorFor(b, barangayOrder)}
                          strokeWidth={2}
                          dot={{ r: 2.5, strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                          {...lineMotion}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="muni-chips">
                  {barangayOrder.map((b) => (
                    <MuniChip key={b} label={b} color={colorFor(b, barangayOrder)} />
                  ))}
                </div>
              </>
            )}
          </MuniCard>
        </Col>
        <Col lg={5}>
          <MuniCard
            icon={PieGlyph}
            title={selectedName ? `Share of Municipality · ${selectedName}` : 'Barangay Total Summary'}
            sub={selectedName
              ? 'The selected barangay against the rest of the municipality.'
              : 'Each slice is one barangay\u2019s share of total production.'}
            chips={<MuniChip label={`${fmtMT(pieTotal, 1)} MT`} meta />}
            caption="Approved production records in the selected period."
          >
            {pieRows.length === 0 ? (
              <div className="muni-empty">
                <span className="muni-empty-chip">No data</span>
                No production in this period.
              </div>
            ) : (
              <div className="muni-method">
                <MuniDonut
                  rows={pieRows}
                  total={pieTotal}
                  unit="MT"
                  label="Total"
                  tooltip={<ShareTooltip />}
                  chartKey="encoder-barangay-share"
                  ariaLabel={`Share of production by barangay for the selected period`}
                />
                <ul className="muni-legend" role="list">
                  {pieRows.map((row) => (
                    <li key={row.key} className="muni-legend-item">
                      <span className="muni-legend-swatch" style={{ background: row.color }} />
                      <span className="muni-legend-name">{row.name}</span>
                      <span className="muni-legend-value">{fmtMT(row.value, 1)}</span>
                      <span className="muni-legend-pct">{fmtPct(row.pct)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </MuniCard>
        </Col>
      </Row>

      <EncoderProfileCharts
        statistics={producerStats}
        barangayName={selectedName}
        loading={producerLoading}
        error={producerError}
      />
    </div>
  );
}
