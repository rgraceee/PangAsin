import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert, Card } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Boxes, LayoutGrid, Users } from 'lucide-react';
import { getStats, getEncoderMonths, getEncoderBarangays } from '../../services/dataService';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from '../admin/PageHeader';
import MunicipalityMapArt from './MunicipalityMapArt';
import { formatMT } from '../../utils/volumeFormat';
import PeriodFilters, { usePeriodFilters } from './PeriodFilters';

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

function formatPct(value) {
  if (!Number.isFinite(value)) return '';
  return ` (${value.toFixed(1)}%)`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="admin-chart-tooltip">
      {label != null && <div className="ct-label">{label}</div>}
      {payload.map((entry, i) => (
        <div key={entry.dataKey || i}>
          <div className="ct-value">{Number(entry.value).toLocaleString()} Metric Tons (MT)</div>
          <div className="ct-sub">{entry.name}</div>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const share = total > 0 ? (p.value / total) * 100 : 0;
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-label">{p.name}</div>
      <div className="ct-value">{p.value.toLocaleString()} Metric Tons (MT){formatPct(share)}</div>
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

  useEffect(() => {
    getEncoderMonths()
      .then((res) => setMonths(res.months || []))
      .catch(() => {});
    getEncoderBarangays()
      .then((res) => setBarangays(res.barangays || []))
      .catch(() => {});
  }, []);

  const period = usePeriodFilters(months);
  const { range, rangeError } = period;

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
    <div>
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
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">
                  {selectedName ? `Production Trend · ${selectedName}` : 'Production by Barangay'}
                </h5>
              </div>
            </Card.Header>
            <Card.Body>
              {lineData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No records in this period.
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      {barangayOrder.map((b) => (
                        <Line
                          key={b}
                          type="monotone"
                          dataKey={b}
                          name={b}
                          stroke={colorFor(b, barangayOrder)}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={5}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">
                  {selectedName ? `Share of Municipality · ${selectedName}` : 'Barangay Total Summary'}
                </h5>
              </div>
            </Card.Header>
            <Card.Body>
              {pieData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No production in this period.
                </div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={entry.name === 'Other barangays'
                              ? '#C3CEDD'
                              : colorFor(entry.name, barangayOrder)}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip total={pieTotal} />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => {
                          const slice = pieData.find((d) => d.name === value);
                          const share = pieTotal > 0 && slice ? (slice.value / pieTotal) * 100 : 0;
                          return `${value} (${share.toFixed(1)}%)`;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
