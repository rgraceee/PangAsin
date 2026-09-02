import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Alert, Spinner, Card } from 'react-bootstrap';
import { useOutletContext } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import { getAdminStats, getInsight, getAdminMunicipalities } from '../../services/dataService';

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

export default function AdminDashboard() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [insight, setInsight] = useState(null);
  const [munis, setMunis] = useState([]);
  const [filters, setFilters] = useState({ municipality_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminMunicipalities().then((res) => setMunis(res.municipalities || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getAdminStats()
      .then((s) => { setStats(s); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  useEffect(() => {
    getInsight().then(setInsight).catch(() => setInsight(null));
  }, []);

  const muniData = useMemo(() => {
    if (!stats) return [];
    return stats.by_municipality
      .map((m) => ({
        name: m.municipality_name,
        volumeMT: Math.round((m.total_volume_kg || 0) / 1000 * 100) / 100,
        beds: m.total_salt_beds,
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

  const filteredMuniIds = new Set(filteredMuniData.map((m) => m.name));
  const contribution = filteredMuniData.map((m) => ({
    name: m.name,
    volumeMT: m.volumeMT,
  }));
  const efficiency = filteredMuniData.map((m) => ({
    name: m.name,
    kgPerBed: m.efficiency,
  }));
  const trend = filteredMuniData.map((m, idx) => ({
    name: m.name,
    volumeMT: m.volumeMT,
  }));

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const totalVolumeMT = Math.round((stats.total_volume_kg / 1000) * 100) / 100;

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
          <KPIStat title="Salt Beds" value={stats.total_salt_beds.toLocaleString()} supporting={`${stats.total_area_sqm.toLocaleString()} m² total area`} accent="gold" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Registered Producers" value={stats.total_registered_producers.toLocaleString()} supporting="Across all submissions" accent="green" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Records" value={stats.record_count.toLocaleString()} supporting="Submissions on file" accent="brown" />
        </Col>
        <Col md={4} lg>
          <KPIStat title="Pending Validation" value={stats.pending_validation_count.toLocaleString()} supporting="Awaiting review" accent="warning" />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={8}>
          <Card className="encoder-card">
            <Card.Header as="h5">Production Trend by Municipality</Card.Header>
            <Card.Body>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="volumeMT" name="Volume (MT)" stroke="#1565C8" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
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
                  <BarChart data={contribution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="volumeMT" name="Volume (MT)" fill="#29B039" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="encoder-card">
            <Card.Header as="h5">Efficiency (kg / salt bed)</Card.Header>
            <Card.Body>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={efficiency} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="kgPerBed" name="kg per bed" fill="#F09A28" radius={[4, 4, 0, 0]} />
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