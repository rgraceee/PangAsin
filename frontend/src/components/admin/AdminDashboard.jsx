import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Alert, Spinner, Card } from 'react-bootstrap';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell, ComposedChart, Area,
} from 'recharts';
import {
  getAdminStats, getInsight, getAdminMunicipalities,
  getMunicipalityOutlook, getDataQuality, getAdminSupplyDemand,
} from '../../services/dataService';

const MUNI_COLORS = [
  '#1565C8', '#F09A28', '#E53935', '#29B039',
  '#8E24AA', '#00ACC1', '#FB8C00',
];

function KPIStat({ title, value, supporting, accent }) {
  return (
    <Card className="encoder-kpi admin-kpi">
      <Card.Body>
        <div className="encoder-kpi-title">{title}</div>
        <div className="encoder-kpi-value">{value}</div>
        <div className="encoder-kpi-supporting">{supporting}</div>
        {accent && <div className={`admin-kpi-accent admin-kpi-accent-${accent}`} />}
      </Card.Body>
    </Card>
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

export default function AdminDashboard({ user }) {
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(null);
  const [munis, setMunis] = useState([]);
  const [outlook, setOutlook] = useState([]);
  const [dq, setDq] = useState(null);
  const [supplyDemand, setSupplyDemand] = useState(null);
  const [filters, setFilters] = useState({ municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getAdminStats(),
      getInsight().catch(() => null),
      getMunicipalityOutlook().catch(() => ({ municipalities: [] })),
      getDataQuality().catch(() => null),
      getAdminSupplyDemand().catch(() => null),
    ])
      .then(([s, ins, ol, dqData, sd]) => {
        setStats(s);
        setInsight(ins);
        setOutlook(ol.municipalities || []);
        setDq(dqData);
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

  const filteredMuniData = useMemo(() => {
    if (!filters.municipality_id) return muniData;
    const id = Number(filters.municipality_id);
    return muniData.filter((m, idx) => {
      return stats.by_municipality[idx]?.municipality_id === id;
    });
  }, [muniData, filters.municipality_id, stats]);

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
  const totalMunis = outlook.length || munis.length;

  const qualityScore = dq ? dq.overall_quality_score : '—';

  const contribution = filteredMuniData.map((m) => ({
    name: m.name,
    volumeMT: m.volumeMT,
  }));
  const efficiency = filteredMuniData.map((m) => ({
    name: m.name,
    kgPerBed: m.efficiency,
  }));
  const trend = filteredMuniData.map((m) => ({
    name: m.name,
    volumeMT: m.volumeMT,
  }));

  const efficiencyWithColor = efficiency.map((e, i) => ({
    ...e,
    fill: MUNI_COLORS[i % MUNI_COLORS.length],
  }));
  const contributionWithColor = contribution.map((c, i) => ({
    ...c,
    fill: MUNI_COLORS[i % MUNI_COLORS.length],
  }));

  return (
    <div>
      <div className="encoder-hello d-flex justify-content-between align-items-start">
        <div>
          <h2>Executive Dashboard</h2>
          <p>Welcome, <strong>{user?.name}</strong> · Province-wide overview across all municipalities.</p>
        </div>
        <div className="d-flex gap-2 align-items-end">
          <select
            className="form-select form-select-sm"
            value={filters.municipality_id}
            onChange={(e) => setFilters({ municipality_id: e.target.value })}
          >
            <option value="">All municipalities</option>
            {munis.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      <Row className="g-3 mb-4">
        <Col md={4} lg>
          <KPIStat title="Total Production" value={`${totalVolumeMT.toLocaleString()} MT`} supporting={`${stats.total_volume_kg.toLocaleString()} kg`} accent="ocean" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Total Salt Beds" value={stats.total_salt_beds.toLocaleString()} supporting="Active production beds" accent="gold" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Production Area" value={`${stats.total_area_sqm.toLocaleString()} m²`} supporting="Combined area of all beds" accent="green" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Pending Validation" value={stats.pending_validation_count.toLocaleString()} supporting="Awaiting admin review" accent="warning" />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Supply-Demand Balance"
            value={`${supplyDemandLabel} ${Math.abs(Math.round(supplyDemandGap)).toLocaleString()} MT`}
            supporting={`vs ${demandBenchmark.toLocaleString()} MT demand benchmark`}
            accent={supplyDemandGap >= 0 ? 'green' : 'brown'}
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Forecast Availability"
            value={`${readyMunis} / ${totalMunis}`}
            supporting="Municipalities with forecast data"
            accent="ocean"
          />
        </Col>
        <Col md={4} lg>
          <KPIStat
            title="Data Quality Score"
            value={typeof qualityScore === 'number' ? `${qualityScore}%` : qualityScore}
            supporting="Based on record completeness"
            accent="gold"
          />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={8}>
          <Card className="encoder-card">
            <Card.Header as="h5">Production Trend by Municipality</Card.Header>
            <Card.Body>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="volumeMT" name="Volume (MT)" radius={[4, 4, 0, 0]}>
                      {trend.map((entry, i) => (
                        <Cell key={i} fill={MUNI_COLORS[i % MUNI_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="encoder-card">
            <Card.Header as="h5">Insight Callout</Card.Header>
            <Card.Body>
              {insight ? (
                <>
                  <p className="mb-2">{insight.insight}</p>
                  <p className="small text-muted mb-2">{insight.methodology}</p>
                  <p className="small text-muted mb-0">Source: {insight.source}</p>
                </>
              ) : (
                <p className="text-muted">Loading insight…</p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={6}>
          <Card className="encoder-card">
            <Card.Header as="h5">Municipality Contribution</Card.Header>
            <Card.Body>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contributionWithColor} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="volumeMT" name="Volume (MT)" radius={[4, 4, 0, 0]}>
                      {contributionWithColor.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="encoder-card">
            <Card.Header as="h5">Production Efficiency (kg / salt bed)</Card.Header>
            <Card.Body>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiencyWithColor} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="kgPerBed" name="kg per bed" radius={[4, 4, 0, 0]}>
                      {efficiencyWithColor.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
