import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend, PieChart, Pie } from 'recharts';
import { Boxes, Target, Percent } from 'lucide-react';
import { getAdminSupplyDemand } from '../../services/dataService';
import { BRAND, STATUS } from '../../theme/colors';
import AdminKpiCard from './AdminKpiCard';
import PageHeader from './PageHeader';

const BARS = [
  { key: 'localSupply', name: 'Local Supply', color: BRAND.ocean },
  { key: 'demandBenchmark', name: 'Demand Benchmark', color: BRAND.gold },
];

const GRADIENT = [BRAND.ocean, BRAND.gold, BRAND.green, STATUS.not_ready];

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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminSupplyDemand()
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const pangasinan = data?.pangasinan || null;
  const sectorDemand = data?.sector_demand || {};

  const localSupply = pangasinan?.local_production != null ? pangasinan.local_production : 0;
  const demandBenchmark = pangasinan?.demand_volume != null ? pangasinan.demand_volume : 0;

  const supplyDemandData = useMemo(() => [
    { name: BARS[0].name, value: localSupply, fill: BARS[0].color },
    { name: BARS[1].name, value: demandBenchmark, fill: BARS[1].color },
  ], [localSupply, demandBenchmark]);

  const sectorData = useMemo(() => {
    return Object.entries(sectorDemand).map(([key, value], i) => ({
      name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
      value,
      fill: GRADIENT[i % GRADIENT.length],
    }));
  }, [sectorDemand]);

  if (loading) {
    return <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>;
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!pangasinan || demandBenchmark <= 0) {
    return <Alert variant="info">No supply/demand benchmark data available yet.</Alert>;
  }

  const sufficiency = localSupply > 0
    ? Math.round((localSupply / demandBenchmark) * 1000) / 10
    : 0;
  const gap = localSupply - demandBenchmark;

  return (
    <div>
      <PageHeader
        id="admin-supply-demand"
        variant="sub"
        title="Supply &amp; Demand Analytics"
        subtitle="Domestic salt supply compared with demand benchmarks."
      />

      <Row className="g-3 mb-3">
        <Col md={4}>
          <AdminKpiCard
            icon={Boxes}
            title="Local Supply"
            value={`${localSupply.toLocaleString()} MT`}
            supporting={`Pangasinan production (${pangasinan.year})`}
            accent="ocean"
          />
        </Col>
        <Col md={4}>
          <AdminKpiCard
            icon={Target}
            title="Demand Benchmark"
            value={`${demandBenchmark.toLocaleString()} MT`}
            supporting={`Target demand (${pangasinan.year})`}
            accent="gold"
          />
        </Col>
        <Col md={4}>
          <AdminKpiCard
            icon={Percent}
            title="Sufficiency"
            value={`${sufficiency}%`}
            supporting={`${gap >= 0 ? 'Surplus' : 'Shortage'} of ${Math.abs(gap).toLocaleString()} MT`}
            accent="green"
          />
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
      {data?.sector_demand_note && (
        <p className="text-muted small mt-3 mb-0">{data.sector_demand_note}</p>
      )}
    </div>
  );
}
