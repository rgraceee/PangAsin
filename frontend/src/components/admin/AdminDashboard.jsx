import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Alert, Spinner, Card, Table } from 'react-bootstrap';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { Boxes, LayoutGrid, Ruler, Hourglass, Scale, CalendarCheck, ChartLine, TrendingUp, TrendingDown } from 'lucide-react';
import {
  getAdminStats, getAdminTrends,
  getMunicipalityOutlook, getAdminSupplyDemand,
} from '../../services/dataService';
import { BRAND } from '../../theme/colors';
import AdminKpiCard from './AdminKpiCard';
import PageHeader from './PageHeader';

function KPIStat({ title, value, supporting, accent, icon }) {
  return (
    <AdminKpiCard icon={icon} title={title} value={value} supporting={supporting} accent={accent} />
  );
}

function KPICluster({ title, accent, children }) {
  return (
    <div className="mb-4">
      <div className={`d-flex align-items-center gap-2 admin-kpi-cluster admin-kpi-cluster-${accent}`}>
        <span className={`admin-kpi-cluster-bar admin-kpi-accent-${accent}`} />
        <span className="admin-kpi-cluster-title">{title}</span>
      </div>
      <Row className="g-3">{children}</Row>
    </div>
  );
}

function CustomLegend({ payload }) {
  return (
    <div className="admin-chart-legend">
      {payload.map((entry, i) => (
        <span key={i} className="admin-chart-legend-item">
          <span className="admin-chart-legend-swatch" style={{ background: entry.color }} />
          {entry.value}
        </span>
      ))}
    </div>
  );
}

function ChartTooltip({ active, payload, label, suffix = '', nameFormatter }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="admin-chart-tooltip">
      {label != null && <div className="ct-label">{label}</div>}
      {payload.map((entry, i) => (
        <div key={entry.dataKey || i}>
          <div className="ct-value">{nameFormatter ? nameFormatter(entry.value) : `${Number(entry.value).toLocaleString()}${suffix}`}</div>
          <div className="ct-sub">{entry.name}</div>
        </div>
      ))}
    </div>
  );
}

function ChangePill({ value }) {
  if (value === null || value === undefined) {
    return <span className="yc-pill">—</span>;
  }
  const up = value >= 0;
  return (
    <span className={`yc-pill ${up ? 'yc-pill-up' : 'yc-pill-down'}`}>
      <span className="yc-arrow">{up ? <TrendingUp size={13} strokeWidth={2.5} /> : <TrendingDown size={13} strokeWidth={2.5} />}</span>
      {up ? '+' : ''}{value}%
    </span>
  );
}

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [trendSeries, setTrendSeries] = useState([]);
  const [yoyRows, setYoyRows] = useState([]);
  const [period, setPeriod] = useState(null);
  const [outlook, setOutlook] = useState([]);
  const [supplyDemand, setSupplyDemand] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAdminStats(),
      getAdminTrends().catch(() => ({ trend: [], municipalities: [] })),
      getMunicipalityOutlook().catch(() => ({ municipalities: [] })),
      getAdminSupplyDemand().catch(() => null),
    ])
      .then(([s, tr, ol, sd]) => {
        setStats(s);
        setTrendSeries(tr.trend || []);
        setYoyRows(tr.municipalities || []);
        setPeriod(tr.period || null);
        setOutlook(ol.municipalities || []);
        setSupplyDemand(sd);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const muniData = useMemo(() => {
    if (!stats) return [];
    return stats.by_municipality
      .map((m) => ({
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_kg || 0) / 1000 * 100) / 100,
        beds: m.total_salt_beds,
        area: m.total_area_sqm,
        registered: m.total_registered_producers,
        efficiency: m.total_salt_beds > 0 ? Math.round((m.total_volume_kg / m.total_salt_beds) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
  }, [stats]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalVolumeMT = Math.round((stats.total_volume_kg / 1000) * 100) / 100;
  const demandBenchmark = supplyDemand?.pangasinan?.demand_volume ?? 0;
  const supplyDemandGap = totalVolumeMT - demandBenchmark;
  const supplyDemandLabel = supplyDemandGap >= 0 ? 'Surplus' : 'Shortage';

  const readyMunis = outlook.filter((o) => o.readiness !== 'not_ready').length;
  const totalMunis = outlook.length || muniData.length;

  return (
    <div>
      <PageHeader
        id="admin-dashboard"
        variant="main"
        title="Executive Dashboard"
        subtitle={`Welcome, ${user?.name} · Province-wide overview across all municipalities.`}
      />

      <Row className="g-3 mb-4">
        <Col md={4}>
          <KPIStat icon={Boxes} title="Total Production" value={`${totalVolumeMT.toLocaleString()} MT`} supporting={`${stats.total_volume_kg.toLocaleString()} kg`} accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat icon={Ruler} title="Production Area" value={`${stats.total_area_sqm.toLocaleString()} m²`} supporting="Combined area of all beds" accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat
            icon={Scale}
            title="Supply-Demand Balance"
            value={`${supplyDemandLabel} ${Math.abs(Math.round(supplyDemandGap)).toLocaleString()} MT`}
            supporting={`vs ${demandBenchmark.toLocaleString()} MT demand benchmark`}
            accent="gold"
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col md={4}>
          <KPIStat icon={LayoutGrid} title="Total Salt Beds" value={stats.total_salt_beds.toLocaleString()} supporting="Active production beds" accent="ocean" />
        </Col>
        <Col md={4}>
          <KPIStat icon={Hourglass} title="Pending Validation" value={stats.pending_validation_count.toLocaleString()} supporting="Awaiting admin review" accent="green" />
        </Col>
        <Col md={4}>
          <KPIStat
            icon={CalendarCheck}
            title="Forecast Availability"
            value={`${readyMunis} / ${totalMunis}`}
            supporting="Municipalities with forecast data"
            accent="gold"
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={8}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><ChartLine size={16} strokeWidth={2} /></span>
                <div>
                  <h5 className="admin-card-head-title">Province-Wide Production Trend (MT / month)</h5>
                  {period ? <span className="fw-normal text-muted small ms-1">({period.start} to {period.end})</span> : null}
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {trendSeries.length === 0 ? (
                <div className="text-muted text-center py-4">No approved production records available to build trends yet.</div>
              ) : (
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendSeries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={3} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<ChartTooltip nameFormatter={(v) => `${v.toLocaleString()} MT`} />} />
                      <Legend />
                      <Line type="monotone" dataKey="total" name="Total Production (MT)" stroke={BRAND.ocean} strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-goldbg"><TrendingUp size={16} strokeWidth={2} /></span>
                <h5 className="admin-card-head-title">Year-over-Year Change</h5>
              </div>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive striped hover size="sm" className="mb-0 encoder-table">
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th className="text-end">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="text-center text-muted py-4">No year-over-year change data available.</td>
                    </tr>
                  ) : (
                    yoyRows.map((m) => (
                      <tr key={m.name}>
                        <td>{m.name}</td>
                        <td className="text-end">
                          <ChangePill value={m.changePct} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
