import React, { useMemo } from 'react';
import { Row, Col, Card, Alert } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, PieChart, Pie } from 'recharts';
import { supplyDemand } from '../../data/municipalities';

const BARS = [
  { key: 'localSupply', name: 'Local Supply', color: '#1565C8' },
  { key: 'demandBenchmark', name: 'Demand Benchmark', color: '#F09A28' },
];

const GRADIENT = ['#1565C8', '#F09A28', '#29B039', '#E53935'];

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

export default function SupplyDemandAnalytics() {
  const pangasinan = supplyDemand.pangasinan;
  const philippines = supplyDemand.philippines;

  const supplyDemandData = useMemo(() => {
    const total = Object.values(pangasinan.sectorDemand || {}).reduce((s, v) => s + v, 0);
    return [
      ...BARS.map((b) => ({ name: b.name, value: pangasinan[b.key], fill: b.color })),
    ];
  }, [pangasinan]);

  const sectorData = useMemo(() => {
    const sd = supplyDemand.sectorDemand;
    return Object.entries(sd).map(([key, value], i) => ({
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value,
      fill: GRADIENT[i % GRADIENT.length],
    }));
  }, []);

  const sufficiency = pangasinan.localSupply > 0
    ? Math.round((pangasinan.localSupply / pangasinan.demandBenchmark) * 1000) / 10
    : 0;
  const gap = pangasinan.localSupply - pangasinan.demandBenchmark;

  return (
    <div>
      <h2 className="mb-1">Supply &amp; Demand Analytics</h2>
      <p className="text-muted">Domestic salt supply compared with demand benchmarks.</p>

      <Row className="g-3 mb-3">
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Local Supply</div>
              <div className="encoder-kpi-value">{pangasinan.localSupply.toLocaleString()} MT</div>
              <div className="encoder-kpi-supporting">Pangasinan production</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Demand Benchmark</div>
              <div className="encoder-kpi-value">{pangasinan.demandBenchmark.toLocaleString()} MT</div>
              <div className="encoder-kpi-supporting">Target demand</div>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="encoder-kpi admin-kpi">
            <Card.Body>
              <div className="encoder-kpi-title">Sufficiency</div>
              <div className="encoder-kpi-value">{sufficiency}%</div>
              <div className="encoder-kpi-supporting">{gap >= 0 ? 'Surplus' : 'Shortage'} of {Math.abs(gap).toLocaleString()} MT</div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {gap < 0 && (
        <Alert variant="warning" className="mb-3">
          Local supply is below the demand benchmark. Additional production or imports may be needed to meet demand.
        </Alert>
      )}

      <Row className="g-3">
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header as="h5">Supply vs Demand (MT)</Card.Header>
            <Card.Body>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplyDemandData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {supplyDemandData.map((entry, i) => (
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
          <Card className="encoder-card h-100">
            <Card.Header as="h5">Sector Demand Breakdown</Card.Header>
            <Card.Body>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} label>
                      {sectorData.map((s, i) => (
                        <Cell key={i} fill={s.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
