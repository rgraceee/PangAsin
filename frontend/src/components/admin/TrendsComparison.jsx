import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Table, Spinner, Alert } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, BarChart, Bar, Cell } from 'recharts';
import { getAdminTrends } from '../../services/dataService';

const MUNI_COLORS = [
  '#1565C8', '#F09A28', '#E53935', '#29B039',
  '#8E24AA', '#00ACC1', '#FB8C00',
];

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

export default function TrendsComparison() {
  const [trendData, setTrendData] = useState([]);
  const [comparisonData, setComparisonData] = useState([]);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminTrends()
      .then((res) => {
        setTrendData(res.trend || []);
        setComparisonData(res.municipalities || []);
        setPeriod(res.period || null);
        setLoading(false);
      })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const barData = useMemo(() => comparisonData.map((m) => ({ name: m.name, current: m.current })), [comparisonData]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (trendData.length === 0) {
    return <Alert variant="info">No approved production records available to build trends yet.</Alert>;
  }

  return (
    <div>
      <h2 className="mb-1">Trends &amp; Comparison</h2>
      <p className="text-muted">
        Province-wide production trends over time and side-by-side municipality comparison.
        {period ? ` (${period.start} to ${period.end})` : ''}
      </p>

      <Row className="g-3 mb-3">
        <Col lg={8}>
          <Card className="encoder-card h-100">
            <Card.Header as="h5">Province-Wide Production Trend (MT / month)</Card.Header>
            <Card.Body>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={3} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="total" name="Total Production (MT)" stroke="#1565C8" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
        <Col lg={4}>
          <Card className="encoder-card h-100">
            <Card.Header as="h5">Year-over-Year Change</Card.Header>
            <Card.Body className="p-0">
              <Table responsive striped hover size="sm" className="mb-0 encoder-table">
                <thead>
                  <tr>
                    <th>Municipality</th>
                    <th className="text-end">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td className="text-end">
                        {m.changePct === null || m.changePct === undefined ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={m.changePct >= 0 ? 'text-success fw-bold' : 'text-danger fw-bold'}>
                            {m.changePct >= 0 ? '+' : ''}{m.changePct}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="encoder-card">
        <Card.Header as="h5">Municipality Comparison (Current Production, MT)</Card.Header>
        <Card.Body>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend content={<CustomLegend />} />
                <Bar dataKey="current" name="Production (MT)" radius={[4, 4, 0, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={MUNI_COLORS[i % MUNI_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
