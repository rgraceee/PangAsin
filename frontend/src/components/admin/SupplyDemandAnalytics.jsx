import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, LabelList } from 'recharts';
import { Boxes, Target, Percent, Info } from 'lucide-react';
import { getAdminSupplyDemand } from '../../services/dataService';
import { BRAND, STATUS } from '../../theme/colors';
import AdminKpiCard from './AdminKpiCard';
import PageHeader from './PageHeader';

const GRADIENT = [BRAND.ocean, BRAND.gold, BRAND.green, STATUS.not_ready];

function bulletTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload.find((p) => p.name === 'Local Supply') || payload[0];
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-value">{Number(entry.value).toLocaleString()} MT</div>
      <div className="ct-sub">{entry.name}</div>
    </div>
  );
}

function bulletCaption(localSupply, demandBenchmark) {
  if (localSupply <= 0 && demandBenchmark <= 0) return null;
  const pct = demandBenchmark > 0 ? Math.round((localSupply / demandBenchmark) * 1000) / 10 : 0;
  const gap = Math.round(localSupply - demandBenchmark);
  const verb = gap >= 0 ? 'surplus' : 'shortage';
  return (
    <div className="chart-caption">
      Local supply covers <b>{pct}%</b> of the {demandBenchmark.toLocaleString()} MT benchmark
      {' '}&mdash; a <span className={gap >= 0 ? 'chart-caption-good' : 'chart-caption-bad'}>{Math.abs(gap).toLocaleString()} MT {verb}</span>.
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
  const bulletMax = Math.max(localSupply, demandBenchmark, 1) * 1.15;

  const bulletData = useMemo(() => [
    { name: 'Local Supply', value: localSupply, fill: BRAND.ocean },
  ], [localSupply]);

  const sectorData = useMemo(() => {
    return Object.entries(sectorDemand)
      .map(([key, value], i) => ({
        name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
        value,
        fill: GRADIENT[i % GRADIENT.length],
      }))
      .sort((a, b) => b.value - a.value);
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

  const topSector = sectorData.length > 0 ? sectorData[0] : null;

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
              <div>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
<BarChart data={bulletData} layout="vertical" margin={{ top: 5, right: 70, bottom: 5, left: 10 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, bulletMax]} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip content={bulletTooltip} cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} />
                        <Bar dataKey="value" name="Local Supply" radius={[0, 6, 6, 0]} maxBarSize={34} isAnimationActive background={{ fill: 'rgba(12, 35, 64, 0.08)', radius: [0, 6, 6, 0] }}>
                          {bulletData.map((b, i) => (
                            <Cell key={i} fill={b.fill} />
                          ))}
                        </Bar>
                        <ReferenceLine
                          x={demandBenchmark}
                          stroke={BRAND.gold}
                          strokeDasharray="5 3"
                          strokeWidth={2}
                          label={{ value: `Benchmark ${demandBenchmark.toLocaleString()} MT`, position: 'insideTopLeft', fill: BRAND.gold, fontSize: 11, fontWeight: 800 }}
                        />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
                {bulletCaption(localSupply, demandBenchmark)}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="encoder-card h-100 reference-card">
            <Card.Header>
              <div className="admin-card-head d-flex align-items-center justify-content-between w-100">
                <h5 className="admin-card-head-title mb-0">Sector Demand Breakdown</h5>
                <span className="reference-tag"><Info size={12} strokeWidth={2} /> Reference data &mdash; not live</span>
              </div>
            </Card.Header>
            <Card.Body>
              {sectorData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No sector demand reference data available yet.
                </div>
              ) : (
                <div>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorData} layout="vertical" margin={{ top: 5, right: 80, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                        <Tooltip
                          formatter={(value) => [`${Number(value).toLocaleString()} MT`, 'Sector demand']}
                          cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                        />
                        <Bar dataKey="value" name="Sector demand (MT)" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive>
                          {sectorData.map((s, i) => (
                            <Cell key={i} fill={s.fill} fillOpacity={0.45} stroke={s.fill} strokeOpacity={0.4} strokeWidth={1} />
                          ))}
                          <LabelList
                            dataKey="value"
                            position="right"
                            formatter={(v) => `${Number(v).toLocaleString()} MT`}
                            style={{ fontSize: 11, fontWeight: 700, fill: 'var(--gray-500)' }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-caption">
                    {topSector
                      ? <><b>{topSector.name}</b> is the largest tracked demand sector at <b>{topSector.value.toLocaleString()} MT</b>. Figures are reference benchmarks, not live production data.</>
                      : <><b>No sector demand data</b> available yet.</>}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      {data?.sector_demand_note && (
        <p className="text-muted small mt-3 mb-0">{data?.sector_demand_note}</p>
      )}
    </div>
  );
}