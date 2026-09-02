import React, { useEffect, useState } from 'react';
import { Row, Col, Alert, Spinner, Card, Button } from 'react-bootstrap';
import { useOutletContext, Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getStats } from '../../services/dataService';
import RecordsTable from './RecordsTable';

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

export default function EncoderDashboard() {
  const { user } = useOutletContext();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getStats()
      .then((s) => {
        setStats(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load dashboard.');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const chartData = (stats.by_barangay || [])
    .map((b) => ({ name: b.barangay, volume: Math.round(b.total_volume_kg) }))
    .sort((a, b) => b.volume - a.volume);

  return (
    <div>
      <div className="encoder-hello d-flex justify-content-between align-items-start">
        <div>
          <h2>Welcome, {user?.name}</h2>
          <p>Municipality: <strong>{stats.municipality_name}</strong></p>
        </div>
        <Button as={Link} to="/encoder/records/new" size="lg" className="encoder-submit-btn">
          + Submit Record
        </Button>
      </div>

      <Row className="g-3 mb-4">
        <Col md={4} lg={4}>
          <KPIStat title="Total Production" value={`${(stats.total_volume_kg / 1000).toFixed(2)} MT`} supporting={`${stats.total_volume_kg.toLocaleString()} kg recorded`} />
        </Col>
        <Col md={4} lg={4}>
          <KPIStat title="Salt Area" value={`${(stats.total_area_sqm || 0).toLocaleString()} m²`} supporting="Sum of beds × area per bed" />
        </Col>
        <Col md={4} lg={4}>
          <KPIStat title="Total Salt Beds" value={stats.total_salt_beds?.toLocaleString() || 0} supporting="Across all records" />
        </Col>
        <Col md={4} lg={4}>
          <KPIStat title="Records" value={stats.record_count} supporting="Barangay-level entries" />
        </Col>
        <Col md={4} lg={4}>
          <KPIStat title="Registered Producers" value={stats.total_registered_producers?.toLocaleString() || 0} supporting="Across submitted records" />
        </Col>
      </Row>

      <Row className="g-3 mb-4">
        <Col lg={8}>
          <Card className="encoder-card">
            <Card.Header as="h5">Production by Barangay</Card.Header>
            <Card.Body>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="volume" name="Volume (kg)" fill="#1565C8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="encoder-card">
            <Card.Header as="h5">Barangay Totals</Card.Header>
            <Card.Body className="p-0">
              <div className="encoder-recent-list">
                {chartData.length === 0 && <div className="text-muted p-3">No records yet. <Link to="/encoder/records/new">Submit one</Link>.</div>}
                {chartData.map((b) => (
                  <div key={b.name} className="encoder-recent-item">
                    <div className="encoder-recent-main">
                      <span className="encoder-recent-barangay">{b.name}</span>
                    </div>
                    <div className="encoder-recent-right">
                      <span className="encoder-recent-volume">{b.volume.toLocaleString()} kg</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <RecordsTable />
    </div>
  );
}