import React, { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Alert } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine, LabelList } from 'recharts';
import { Boxes, Target, Info, Scale } from 'lucide-react';
import { getAdminSupplyDemand } from '../../services/dataService';
import { BRAND, STATUS } from '../../theme/colors';
import KpiCard from '../ui/KpiCard';
import KpiGrid from '../ui/KpiGrid';
import PageHeader from './PageHeader';
import { SkeletonBlock, SkeletonCards, SkeletonChart } from '../Skeleton';
import { fmtMT } from '../../utils/volumeFormat';

const GRADIENT = [BRAND.ocean, BRAND.gold, BRAND.green, STATUS.not_ready];

// WHAT: Nice ceiling sa multiples (1/2/5 x 10^n) para even ang axis ticks.
// WHY: hindi bastang val*1.15 na pwedeng mag-iwan ng weird na max tick.
function niceCeil(value) {
  if (value <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function bulletTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload.find((p) => p.name === 'Local Supply') || payload[0];
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-value">{Number(entry.value).toLocaleString()} Metric Tons (MT)</div>
      <div className="ct-sub">{entry.name}</div>
    </div>
  );
}

export default function SupplyDemandAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectorScope, setSectorScope] = useState('national');

  useEffect(() => {
    getAdminSupplyDemand()
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  const pangasinan = data?.pangasinan || null;
  const localSupply = pangasinan?.local_production != null ? pangasinan.local_production : 0;
  const demandBenchmark = pangasinan?.demand_volume != null ? pangasinan.demand_volume : 0;
  const demandShortfall = Math.max(demandBenchmark - localSupply, 0);
  const bulletMax = niceCeil(Math.max(localSupply, demandBenchmark, 1) * 1.15);

  const bulletData = useMemo(() => [
    { name: 'Local Supply', value: localSupply, fill: BRAND.ocean },
  ], [localSupply]);

  const sectorData = useMemo(() => {
    return (data?.sector_demand_by_scope?.[sectorScope] || [])
      .map((sector, i) => ({
        name: sector.name,
        value: sector.demand_mt,
        fill: GRADIENT[i % GRADIENT.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [data, sectorScope]);

  const sectorMax = niceCeil(sectorData.reduce((mx, s) => Math.max(mx, s.value), 0) * 1.05);

  if (loading) {
    return (
      <div className="skeleton-dashboard">
        <SkeletonBlock width="45%" height={24} />
        <SkeletonBlock width="70%" height={13} />
        <div className="mt-4"><SkeletonCards count={3} /></div>
        <div className="row g-3 mt-1">
          <div className="col-lg-6"><div className="skeleton-card"><SkeletonChart height={300} /></div></div>
          <div className="col-lg-6"><div className="skeleton-card"><SkeletonChart height={300} /></div></div>
        </div>
      </div>
    );
  }
  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }
  if (!pangasinan) {
    return <Alert variant="info">No supply/demand benchmark data available yet.</Alert>;
  }

  return (
    <div>
      <PageHeader
        id="admin-supply-demand"
        variant="section"
        icon={Scale}
        title="Supply &amp; Demand Analytics"
        subtitle="Pangasinan local salt supply compared with the local demand benchmark."
      />

      <Row className="g-3 mb-3" aria-label="Stored supply and demand benchmarks">
        {[
          { key: 'provincial', label: 'Pangasinan' },
          { key: 'national', label: 'Philippines' },
        ].map(({ key, label }) => {
          const benchmark = data?.benchmarks?.[key];
          return (
            <Col md={6} key={key}>
              <Card className="encoder-card h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <h6 className="mb-1">{label} stored benchmark</h6>
                      <div className="text-muted small">
                        {benchmark ? `${benchmark.year} · ${benchmark.source_name}` : 'No benchmark saved yet'}
                      </div>
                    </div>
                  </div>
                  <div className="d-flex flex-wrap gap-3 mt-3 small">
                    <span>{key === 'provincial' ? 'Local demand (Pangasinan)' : 'National demand (Philippines)'}: <strong>{benchmark ? fmtMT(benchmark.demand_volume) : '—'}</strong> MT</span>
                    <span>{key === 'provincial' ? 'Local supply (Pangasinan)' : 'Domestic supply (Philippines)'}: <strong>{benchmark?.local_production != null ? fmtMT(benchmark.local_production) : (key === 'provincial' ? fmtMT(localSupply) : '—')}</strong> MT</span>
                    <span>Imports: <strong>{benchmark?.import_volume != null ? fmtMT(benchmark.import_volume) : '—'}</strong> MT</span>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>

      {demandBenchmark <= 0 && (
        <Alert variant="info">
          No Pangasinan demand benchmark is available yet. Add one from Demand Benchmarks in the admin sidebar.
        </Alert>
      )}

      <KpiGrid columns={3}>
        <KpiCard
          icon={Boxes}
          title="Local Supply (Pangasinan)"
          value={Math.round(localSupply * 100) / 100}
          unit="Metric Tons (MT)"
          supporting={`Pangasinan production (${pangasinan.year})`}
        />
        <KpiCard
          icon={Target}
          title="Local Demand (Pangasinan)"
          value={Math.round(demandBenchmark * 100) / 100}
          unit="Metric Tons (MT)"
          supporting={`Target demand (${pangasinan.year})`}
        />
        <KpiCard
          icon={Target}
          title="Salt Needed to Meet Demand"
          value={demandBenchmark > 0 ? Math.round(demandShortfall * 100) / 100 : null}
          unit={demandBenchmark > 0 ? 'Metric Tons (MT)' : undefined}
          supporting={demandBenchmark <= 0
            ? 'No Pangasinan demand benchmark available'
            : demandShortfall > 0
              ? 'Still needed to meet the Pangasinan demand target'
              : 'Pangasinan demand target met'}
        />
      </KpiGrid>

      <Row className="g-3">
        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header as="h5">Pangasinan Supply vs Local Demand (Metric Tons (MT))</Card.Header>
            <Card.Body>
              <div>
                {/* WHAT: Compact bullet — maliit na height, may benchmark line.
                   WHY: 190px lang para hindi ubusin ang row; axis 0..niceMax na may
                        even ticks at thousands separators. */}
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
<BarChart data={bulletData} layout="vertical" margin={{ top: 10, right: 70, bottom: 5, left: 10 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, bulletMax]} tickFormatter={fmtMT} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                        <Tooltip content={bulletTooltip} cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} />
                        <Bar dataKey="value" name="Local Supply" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive background={{ fill: 'rgba(12, 35, 64, 0.08)', radius: [0, 6, 6, 0] }}>
                          {bulletData.map((b, i) => (
                            <Cell key={i} fill={b.fill} />
                          ))}
                        </Bar>
                        <ReferenceLine
                          x={demandBenchmark}
                          stroke={BRAND.gold}
                          strokeDasharray="5 3"
                          strokeWidth={2}
                          label={{ value: `Benchmark ${fmtMT(demandBenchmark)} Metric Tons (MT)`, position: 'insideTopLeft', fill: BRAND.gold, fontSize: 11, fontWeight: 800 }}
                        />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={6}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head d-flex align-items-center justify-content-between w-100">
                <h5 className="admin-card-head-title mb-0">
                  Sector Demand Breakdown ({sectorScope === 'national' ? 'Philippines' : 'Pangasinan'})
                </h5>
                <div className="d-flex align-items-center gap-2">
                  <div className="d-flex gap-1" role="group" aria-label="Sector demand scope">
                    <button
                      type="button"
                      className={`ui-btn-text ui-btn--sm${sectorScope === 'national' ? ' is-active' : ''}`}
                      aria-pressed={sectorScope === 'national'}
                      onClick={() => setSectorScope('national')}
                    >
                      Philippines
                    </button>
                    <button
                      type="button"
                      className={`ui-btn-text ui-btn--sm${sectorScope === 'provincial' ? ' is-active' : ''}`}
                      aria-pressed={sectorScope === 'provincial'}
                      onClick={() => setSectorScope('provincial')}
                    >
                      Pangasinan
                    </button>
                  </div>
                  <span className="reference-tag"><Info size={12} strokeWidth={2} /> Admin-configured</span>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {sectorData.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No sector allocations have been configured for {sectorScope === 'national' ? 'the Philippines' : 'Pangasinan'}.
                </div>
              ) : (
                <div>
                  <div style={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorData} layout="vertical" margin={{ top: 30, right: 80, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" horizontal={false} />
                        {/* WHAT: Sensible axis — 0..niceMax, even ticks, thousands separators. */}
                        <XAxis type="number" tick={{ fontSize: 12 }} domain={[0, sectorMax]} tickFormatter={fmtMT} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={110} />
                        <Tooltip
                          formatter={(value) => [`${Number(value).toLocaleString()} Metric Tons (MT)`, 'Sector demand']}
                          cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                          // WHAT: Pin-up ang tooltip sa may margin area sa itaas ng plot.
                          // WHY: hindi nito tinatakpan ang mga bar at value labels kapag naka-hover.
                          position={{ x: 14, y: -36 }}
                          wrapperStyle={{ pointerEvents: 'none' }}
                        />
                        <Bar dataKey="value" name="Sector demand (Metric Tons (MT))" radius={[0, 6, 6, 0]} maxBarSize={28} isAnimationActive>
                          {sectorData.map((s, i) => (
                            <Cell key={i} fill={s.fill} />
                          ))}
                          {/* WHAT: Full-opacity na value labels (kayumanggi, hindi gray).
                             WHY: basahin kaagad nang hindi umaasa sa tooltip. */}
                          <LabelList
                            dataKey="value"
                            position="right"
                            formatter={fmtMT}
                            style={{ fontSize: 11, fontWeight: 700, fill: '#343A40', opacity: 1 }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
