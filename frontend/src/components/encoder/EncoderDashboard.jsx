import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert, Card } from 'react-bootstrap';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Boxes, LayoutGrid, ClipboardList, Users, MapPin } from 'lucide-react';
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

function toIsoDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
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
          <div className="ct-value">{Number(entry.value).toLocaleString()} MT</div>
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
      <div className="ct-value">{p.value.toLocaleString()} MT{formatPct(share)}</div>
    </div>
  );
}

export default function EncoderDashboard() {
  const { user } = useOutletContext();
  const location = useLocation();
  const navigate = useNavigate();

  const now = new Date();
  const initialYear = now.getFullYear();
  const initialMonth = now.toISOString().slice(0, 7);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth);
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
    const years = new Set();
    (months || []).forEach((m) => {
      const y = m.split('-')[0];
      if (y) years.add(Number(y));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [months]);

  const monthsInYear = useMemo(() => {
    return (months || [])
      .filter((m) => m.startsWith(`${selectedYear}-`))
      .sort();
  }, [months, selectedYear]);

  useEffect(() => {
    if (!monthsInYear.includes(selectedMonth)) {
      const next = monthsInYear[0];
      setSelectedMonth(next || '');
    }
  }, [selectedYear, monthsInYear, selectedMonth]);

  useEffect(() => {
    if (!availableYears.includes(selectedYear)) {
      const next = availableYears[0];
      setSelectedYear(next || initialYear);
    }
  }, [availableYears, selectedYear, initialYear]);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const month = selectedMonth || undefined;
    const params = month ? { month } : {};
    getStats(params)
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard.'); setLoading(false); });
  }, [selectedMonth]);

  useEffect(() => { loadStats(); }, [loadStats]);

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
        {/* WHAT: Chip ng assigned municipality. WHY: dynamic sa login, hindi hardcoded. */}
        <span className="ui-pageheader-chip" aria-label={`Assigned municipality: ${municipalityName}`}>
          <MapPin size={14} strokeWidth={1.5} aria-hidden="true" />
          {municipalityName}
        </span>
        {/* WHAT: Period selectors. WHY: dating nasa KPI label row, nasa header na ngayon. */}
        <select
          id="encoder-year"
          className="ui-pageheader-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          aria-label="Select year"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          id="encoder-month"
          className="ui-pageheader-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          aria-label="Select month"
          disabled={!monthsInYear.length}
        >
          {monthsInYear.map((m) => {
            const [y, mo] = m.split('-');
            const d = new Date(Number(y), Number(mo) - 1);
            return (
              <option key={m} value={m}>
                {d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
              </option>
            );
          })}
        </select>
      </PageHeader>

      {error && <Alert variant="danger">{error}</Alert>}

      <KpiGrid columns={4}>
        <KpiCard
          icon={Boxes}
          title="Total Production"
          value={formatMT(stats.total_volume_mt)}
          unit="MT"
          info="Sum of production volume across all your records for the selected period."
        />
        <KpiCard
          icon={LayoutGrid}
          title="Total Salt Beds"
          value={stats.total_salt_beds}
          info="Total salt beds counted across your records for the selected period."
        />
        <KpiCard
          icon={ClipboardList}
          title="Records"
          value={stats.record_count}
          info="Barangay-level entries you submitted for the selected period."
        />
        <KpiCard
          icon={Users}
          title="Registered Producers"
          value={stats.total_registered_producers}
          info="Total registered producers counted across your records for the selected period."
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
        <RecordsTable onEdit={handleEdit} onImported={handleImported} refreshKey={recordsRefreshKey} user={user} />
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
