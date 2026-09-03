import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Row, Col, Alert, Spinner, Card, Button, Form } from 'react-bootstrap';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getStats, logoutAPI } from '../../services/dataService';
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

function KPIStat({ title, value, supporting }) {
  return (
    <Card className="encoder-kpi">
      <Card.Body>
        <div className="encoder-kpi-title">{title}</div>
        <div className="encoder-kpi-value">{value}</div>
        <div className="encoder-kpi-supporting">{supporting}</div>
      </Card.Body>
    </Card>
  );
}

function periodThisYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return { start, end: now };
}

function periodLast12Months() {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 11);
  start.setDate(1);
  return { start, end };
}

function periodAllTime() {
  return { start: null, end: null };
}

function toIsoDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function formatPct(value) {
  if (!Number.isFinite(value)) return '';
  return ` (${value.toFixed(1)}%)`;
}

function PieTooltip({ active, payload, total }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const share = total > 0 ? (p.value / total) * 100 : 0;
  return (
    <div className="encoder-tooltip">
      <div><strong>{p.name}</strong></div>
      <div>{p.value.toLocaleString()} kg{formatPct(share)}</div>
    </div>
  );
}

export default function EncoderDashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();

  const [periodKey, setPeriodKey] = useState('thisYear');
  const [period, setPeriod] = useState(periodThisYear());
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handlePeriodChange = (e) => {
    const key = e.target.value;
    setPeriodKey(key);
    if (key === 'thisYear') setPeriod(periodThisYear());
    else if (key === 'last12') setPeriod(periodLast12Months());
    else setPeriod(periodAllTime());
  };

  const loadStats = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = { start: toIsoDate(period.start), end: toIsoDate(period.end) };
    if (!params.start) delete params.start;
    if (!params.end) delete params.end;
    getStats(params)
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message || 'Failed to load dashboard.'); setLoading(false); });
  }, [period]);

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

  const handleLogout = async () => {
    try { await logoutAPI(); } catch (e) { /* ignore */ }
    navigate('/login');
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
    <div className="encoder-dashboard">
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 encoder-floating-logout">
        <div>
          <h2 className="mb-0">Welcome, {user?.name}</h2>
          <div className="text-muted small">
            Municipality: <strong>{stats?.municipality_name || user?.municipality_name}</strong>
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <Form.Select
            size="sm"
            value={periodKey}
            onChange={handlePeriodChange}
            aria-label="Select period"
            style={{ minWidth: 170 }}
          >
            <option value="thisYear">This Year</option>
            <option value="last12">Last 12 Months</option>
            <option value="allTime">All Time</option>
          </Form.Select>
          <Button variant="link" size="sm" onClick={handleLogout}>Logout</Button>
        </div>
      </div>

      <div className="d-flex justify-content-end mb-3">
        <Button variant="primary" onClick={handleAdd} className="encoder-submit-btn">
          + Add Record
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3 mb-4">
        <Col md={4} lg>
          <KPIStat
            title="Total Production"
            value={`${((stats.total_volume_kg || 0) / 1000).toFixed(2)} MT`}
            supporting={`${(stats.total_volume_kg || 0).toLocaleString()} kg recorded`}
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Salt Area"
            value={`${(stats.total_area_sqm || 0).toLocaleString()} m²`}
            supporting="Beds × area per bed"
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Total Salt Beds"
            value={(stats.total_salt_beds || 0).toLocaleString()}
            supporting="Across all records"
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Records"
            value={stats.record_count || 0}
            supporting="Barangay-level entries"
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Registered Producers"
            value={(stats.total_registered_producers || 0).toLocaleString()}
            supporting="Across submitted records"
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={7}>
          <Card className="encoder-card">
            <Card.Header as="h5">Production by Barangay</Card.Header>
            <Card.Body>
              {lineData.length === 0 ? (
                <div className="text-muted py-4 text-center">No records in this period.</div>
              ) : (
                <div style={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
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
          <Card className="encoder-card">
            <Card.Header as="h5">Barangay Total Summary</Card.Header>
            <Card.Body>
              {pieData.length === 0 ? (
                <div className="text-muted py-4 text-center">No production in this period.</div>
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

      <RecordsTable onEdit={handleEdit} refreshKey={recordsRefreshKey} />

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
