import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert, Card } from 'react-bootstrap';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Boxes, LayoutGrid, Users } from 'lucide-react';
import { getStats, getEncoderMonths } from '../../services/dataService';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from '../admin/PageHeader';
import MunicipalityMapArt from './MunicipalityMapArt';
import RecordsTable from './RecordsTable';
import ProductionRecordForm from './ProductionRecordForm';
import { formatMT } from '../../utils/volumeFormat';
import EnvironmentReports from './EnvironmentReports';
import ProducerReports from './ProducerReports';

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

function pad2(value) {
  return String(value).padStart(2, '0');
}

function isoDate(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function monthRange(year, month) {
  return {
    start: isoDate(year, month, 1),
    end: isoDate(year, month, daysInMonth(year, month)),
  };
}

function presetRange(months) {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  return {
    start: isoDate(start.getFullYear(), start.getMonth() + 1, 1),
    end: isoDate(end.getFullYear(), end.getMonth() + 1, end.getDate()),
  };
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
  const location = useLocation();
  const navigate = useNavigate();

  const now = new Date();
  const initialYear = now.getFullYear();
  const [filterMode, setFilterMode] = useState('range');
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(pad2(now.getMonth() + 1));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activePreset, setActivePreset] = useState('all');
  const [range, setRange] = useState({ start: null, end: null });
  const [months, setMonths] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);
  const [activeReport, setActiveReport] = useState(null);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    getEncoderMonths()
      .then((res) => setMonths(res.months || []))
      .catch(() => {});
  }, []);

  /* WHAT: Buksan ang add-modal kapag galing sa sidebar action item.
     WHY: pinapasa ng EncoderSidebar ang openReport sa location state. */
  useEffect(() => {
    const wanted = location.state?.openReport;
    if (!wanted) return;
    if (wanted === 'production') setEditingId(null);
    setActiveReport(wanted);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);

  const availableYears = useMemo(() => {
    const years = new Set([initialYear]);
    (months || []).forEach((m) => {
      const y = m.split('-')[0];
      if (y) years.add(Number(y));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [months, initialYear]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      const next = availableYears[0];
      setSelectedYear(next || initialYear);
    }
  }, [availableYears, selectedYear, initialYear]);

  const rangeError = filterMode === 'range' && startDate && endDate && startDate > endDate
    ? 'Start date must be on or before end date.'
    : null;

  useEffect(() => {
    if (activePreset === 'all') {
      setRange({ start: null, end: null });
      return;
    }
    if (filterMode === 'range') {
      if (startDate && endDate && startDate > endDate) return;
      setRange({ start: startDate || null, end: endDate || null });
      return;
    }
    if (selectedMonth === 'all') {
      setRange({ start: `${selectedYear}-01-01`, end: `${selectedYear}-12-31` });
      return;
    }
    setRange(monthRange(selectedYear, Number(selectedMonth)));
  }, [activePreset, filterMode, startDate, endDate, selectedMonth, selectedYear]);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (range.start) params.start = range.start;
    if (range.end) params.end = range.end;
    getStats(params)
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard.'); setLoading(false); });
  }, [range.start, range.end]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleYearChange = (value) => {
    const year = Number(value);
    setActivePreset('');
    setSelectedYear(year);
    const monthsForYear = (months || [])
      .filter((month) => month.startsWith(`${year}-`))
      .sort();
    if (
      selectedMonth !== 'all'
      && monthsForYear.length
      && !monthsForYear.includes(`${year}-${selectedMonth}`)
    ) {
      setSelectedMonth(monthsForYear[monthsForYear.length - 1].slice(5, 7));
    }
  };

  const applyPreset = (key) => {
    setActivePreset(key);
    setFilterMode('range');
    if (key === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }
    const next = presetRange(key === '6m' ? 6 : 12);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  const handleEdit = (id) => {
    setEditingId(id);
    setActiveReport('production');
  };

  const handleClose = () => {
    setActiveReport(null);
    setEditingId(null);
  };

  const handleSaved = () => {
    setActiveReport(null);
    setEditingId(null);
    setRecordsRefreshKey((k) => k + 1);
    loadStats();
  };

  const handleImported = () => {
    setRecordsRefreshKey((key) => key + 1);
    loadStats();
  };

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [...(stats.by_barangay || [])]
      .filter((b) => (b.total_volume_mt || 0) > 0)
      .sort((a, b) => a.barangay.localeCompare(b.barangay))
      .map((b) => ({ name: b.barangay, value: Math.round((b.total_volume_mt || 0) * 1000) / 1000 }));
  }, [stats]);

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
        title="Dashboard"
        subtitle={`Record, review, and manage salt production data for ${municipalityName}.`}
        art={<MunicipalityMapArt highlightName={municipalityName} />}
      >
        {/* WHAT: Period filters. WHY: Year mode or an exact date range, plus
            quick presets that keep both modes in sync. */}
        <label className="admin-page-hero-control" htmlFor="encoder-filter-mode">
          <span className="admin-page-hero-field">Filter by</span>
          <select
            id="encoder-filter-mode"
            className="admin-page-hero-select"
            value={filterMode}
            onChange={(e) => {
              setActivePreset('');
              setFilterMode(e.target.value);
            }}
          >
            <option value="year">Year</option>
            <option value="range">Date Range</option>
          </select>
        </label>

        {filterMode === 'year' ? (
          <>
            <label className="admin-page-hero-control" htmlFor="encoder-year">
              <span className="admin-page-hero-field">Year</span>
              <select
                id="encoder-year"
                className="admin-page-hero-select"
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </label>
            <label className="admin-page-hero-control" htmlFor="encoder-month">
              <span className="admin-page-hero-field">Month</span>
              <select
                id="encoder-month"
                className="admin-page-hero-select"
                value={selectedMonth}
                onChange={(e) => {
                  setActivePreset('');
                  setSelectedMonth(e.target.value);
                }}
              >
                <option value="all">All Months</option>
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={pad2(index + 1)}>
                    {new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="admin-page-hero-control" htmlFor="encoder-start-date">
              <span className="admin-page-hero-field">Start Date</span>
              <input
                id="encoder-start-date"
                type="date"
                className="admin-page-hero-input"
                value={startDate}
                onChange={(e) => {
                  setActivePreset('');
                  setStartDate(e.target.value);
                }}
              />
            </label>
            <label className="admin-page-hero-control" htmlFor="encoder-end-date">
              <span className="admin-page-hero-field">End Date</span>
              <input
                id="encoder-end-date"
                type="date"
                className="admin-page-hero-input"
                value={endDate}
                onChange={(e) => {
                  setActivePreset('');
                  setEndDate(e.target.value);
                }}
              />
            </label>
          </>
        )}

        <div className="admin-page-hero-control">
          <span className="admin-page-hero-field">Quick range</span>
          <div className="d-flex gap-2">
            {[
              { key: 'all', label: 'All' },
              { key: '6m', label: '6 Months' },
              { key: '12m', label: '12 Months' },
            ].map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={activePreset === preset.key ? 'ui-btn-primary' : 'ui-btn-outline'}
                aria-pressed={activePreset === preset.key}
                onClick={() => applyPreset(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
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
                <h5 className="admin-card-head-title">Production by Barangay</h5>
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
                <h5 className="admin-card-head-title">Barangay Total Summary</h5>
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
                          <Cell key={entry.name} fill={colorFor(entry.name, barangayOrder)} />
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

      <div id="encoder-submissions">
        <RecordsTable
          onEdit={handleEdit}
          onImported={handleImported}
          refreshKey={recordsRefreshKey}
          user={user}
          start={range.start || undefined}
          end={range.end || undefined}
        />
      </div>

      <EnvironmentReports user={user} open={activeReport === 'environment'} onClose={handleClose} onImported={handleImported} />
      <ProducerReports user={user} open={activeReport === 'producer'} onClose={handleClose} onImported={handleImported} />

      {activeReport === 'production' && (
        <ProductionRecordForm
          editingId={editingId}
          user={user}
          onClose={handleClose}
          onSaved={handleSaved}
          onImported={handleImported}
        />
      )}
    </div>
  );
}
