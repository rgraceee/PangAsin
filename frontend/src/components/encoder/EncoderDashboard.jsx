import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert, Spinner, Card, Button } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { Boxes, LayoutGrid, Ruler, ClipboardList, Users, Plus } from 'lucide-react';
import { getStats, getEncoderMonths } from '../../services/dataService';
import AdminKpiCard from '../admin/AdminKpiCard';
import PageHeader from '../admin/PageHeader';
import RecordsTable from './RecordsTable';
import ProductionRecordForm from './ProductionRecordForm';

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
          <div className="ct-value">{Number(entry.value).toLocaleString()} kg</div>
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
      <div className="ct-value">{p.value.toLocaleString()} kg{formatPct(share)}</div>
    </div>
  );
}

function KPICluster({ title, accent, actions, children }) {
  return (
    <div className="mb-4">
      <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
        <div className={`d-flex align-items-center gap-2 admin-kpi-cluster admin-kpi-cluster-${accent}`}>
          <span className={`admin-kpi-cluster-bar admin-kpi-accent-${accent}`} />
          <span className="admin-kpi-cluster-title">{title}</span>
        </div>
        {actions}
      </div>
      <Row className="g-3">{children}</Row>
    </div>
  );
}

export default function EncoderDashboard() {
  const { user } = useOutletContext();

  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [months, setMonths] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    getEncoderMonths()
      .then((res) => setMonths(res.months || []))
      .catch(() => {});
  }, []);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = selectedMonth ? { month: selectedMonth } : {};
    getStats(params)
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard.'); setLoading(false); });
  }, [selectedMonth]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleEdit = (id) => {
    setEditingId(id);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSaved = () => {
    setShowForm(false);
    setEditingId(null);
    setRecordsRefreshKey((k) => k + 1);
    loadStats();
  };

  const pieData = useMemo(() => {
    if (!stats) return [];
    return [...(stats.by_barangay || [])]
      .filter((b) => (b.total_volume_kg || 0) > 0)
      .sort((a, b) => a.barangay.localeCompare(b.barangay))
      .map((b) => ({ name: b.barangay, value: Math.round(b.total_volume_kg) }));
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
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }

  if (error && !stats) {
    return <Alert variant="danger">{error}</Alert>;
  }

  return (
    <div>
      <PageHeader
        id="encoder-overview"
        variant="main"
        title={stats?.municipality_name || user?.municipality_name || 'Encoder Dashboard'}
        subtitle={`Welcome, ${user?.name}. Record, review, and manage your municipality's production data.`}
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <KPICluster
        title="Your data at a glance"
        accent="ocean"
        actions={
          <div className="d-flex align-items-center gap-2">
            <label className="small fw-semibold text-muted" htmlFor="encoder-month">Period</label>
            <select
              id="encoder-month"
              className="form-select form-select-sm admin-demog-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select month"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {(() => {
                    const [y, mo] = m.split('-');
                    const d = new Date(Number(y), Number(mo) - 1);
                    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                  })()}
                </option>
              ))}
            </select>
            <Button className="admin-page-hero-btn" onClick={handleAdd}>
              <Plus size={16} strokeWidth={2.5} className="me-1" />
              Add Record
            </Button>
          </div>
        }
      >
        <Col md={4} lg>
          <AdminKpiCard
            icon={Boxes}
            title="Total Production"
            value={`${((stats.total_volume_kg || 0) / 1000).toFixed(2)} MT`}
            supporting={`${(stats.total_volume_kg || 0).toLocaleString()} kg recorded`}
            accent="ocean"
          />
        </Col>
        <Col md={4} lg>
          <AdminKpiCard
            icon={Ruler}
            title="Salt Area"
            value={`${(stats.total_area_sqm || 0).toLocaleString()} m²`}
            supporting="Beds × area per bed"
            accent="gold"
          />
        </Col>
        <Col md={4} lg>
          <AdminKpiCard
            icon={LayoutGrid}
            title="Total Salt Beds"
            value={(stats.total_salt_beds || 0).toLocaleString()}
            supporting="Across all records"
            accent="green"
          />
        </Col>
        <Col md={4} lg>
          <AdminKpiCard
            icon={ClipboardList}
            title="Records"
            value={stats.record_count || 0}
            supporting="Barangay-level entries"
            accent="brown"
          />
        </Col>
        <Col md={4} lg>
          <AdminKpiCard
            icon={Users}
            title="Registered Producers"
            value={(stats.total_registered_producers || 0).toLocaleString()}
            supporting="Across submitted records"
            accent="ocean"
          />
        </Col>
      </KPICluster>

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
        <RecordsTable onEdit={handleEdit} onAdd={handleAdd} refreshKey={recordsRefreshKey} />
      </div>

      {showForm && (
        <ProductionRecordForm
          editingId={editingId}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
