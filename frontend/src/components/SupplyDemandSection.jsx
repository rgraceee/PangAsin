import React, { useMemo, useState } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import { Globe, MapPin } from 'lucide-react';
import { getSupplyDemand, getSectorDemand } from '../services/dataService';
import { BRAND, BRAND_TINTS } from '../theme/colors';
import ChartCaption from './ChartCaption';

const BAR_COLORS = {
  'National Demand': BRAND.ocean,
  'Domestic Supply': BRAND.green,
  'Imported Salt': BRAND.gold,
  'Pangasinan Supply': BRAND.ocean,
  'Demand Benchmark': BRAND.gold,
};

const SECTOR_COLORS = [BRAND.ocean, BRAND_TINTS.oceanLight, BRAND.gold, BRAND_TINTS.goldLight, BRAND.navy, BRAND.green];

function BarTooltip({ active, payload, unit }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-label">{payload[0].payload.name}</div>
      <div className="ct-value">{Number(payload[0].value).toLocaleString()} {unit}</div>
    </div>
  );
}

export default function SupplyDemandSection() {
  const [scope, setScope] = useState('philippines');

  const data = useMemo(() => getSupplyDemand(scope), [scope]);
  const supplyDemandRows = data.labels.map((label, index) => ({ name: label, value: data.values[index] }));
  const sectorData = useMemo(
    () =>
      [...getSectorDemand()]
        .sort((a, b) => b.value - a.value)
        .map((s) => ({
          ...s,
          label: `${s.value.toLocaleString()} MT · ${s.percentage.toFixed(1)}%`,
        })),
    []
  );

  const isPhilippines = scope === 'philippines';

  let supplyDemandCaption;
  if (isPhilippines) {
    const [demand, supply, imports] = data.values;
    supplyDemandCaption = `Recorded national demand of ${demand.toLocaleString()} MT outpaces domestic supply of ${supply.toLocaleString()} MT, with imports (${imports.toLocaleString()} MT) covering the shortfall.`;
  } else {
    const [pSupply, benchmark] = data.values;
    const coverage = benchmark > 0 ? (pSupply / benchmark) * 100 : 0;
    supplyDemandCaption = `Pangasinan's recorded supply of ${pSupply.toLocaleString()} MT covers ${coverage.toFixed(1)}% of the local demand benchmark (${benchmark.toLocaleString()} MT).`;
  }

  const spansBoth = sectorData.length >= 2;

  return (
    <section className="public-section">
      <Row className="g-4">
        <Col lg={7}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div className="admin-card-head">
                  <h5 className="admin-card-head-title">Salt Supply and Demand</h5>
                  <span className="fw-normal text-muted small ms-1">Compare salt demand with production and imports</span>
                </div>
                <div className="fc-segmented" role="group" aria-label="Scope selector">
                  <button
                    type="button"
                    className={`fc-segmented-btn ${isPhilippines ? 'active' : ''}`}
                    onClick={() => setScope('philippines')}
                  >
                    Philippines
                  </button>
                  <button
                    type="button"
                    className={`fc-segmented-btn ${!isPhilippines ? 'active' : ''}`}
                    onClick={() => setScope('pangasinan')}
                  >
                    Pangasinan
                  </button>
                </div>
              </div>
            </Card.Header>
            <Card.Body className={isPhilippines ? 'scope-tint-philippines' : 'scope-tint-pangasinan'}>
              <span className={`scope-flag ${isPhilippines ? 'scope-flag-philippines' : 'scope-flag-pangasinan'}`}>
                {isPhilippines ? <Globe size={13} /> : <MapPin size={13} />}
                {isPhilippines ? 'National scope' : 'Provincial scope'}
              </span>
              <ChartCaption>{supplyDemandCaption}</ChartCaption>
              <div className="chart-container" style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplyDemandRows} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<BarTooltip unit={data.unit} />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={60}>
                      {data.labels.map((label) => (
                        <Cell key={label} fill={BAR_COLORS[label] || BRAND.ocean} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted small mt-2 mb-0">{data.note}</p>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <h5 className="admin-card-head-title">Salt Demand by Sector</h5>
                <span className="fw-normal text-muted small ms-1">National breakdown by end use</span>
              </div>
            </Card.Header>
            <Card.Body>
              {spansBoth && (
                <ChartCaption>
                  {sectorData[0].sector} is the largest recorded end use ({sectorData[0].percentage.toFixed(1)}% of
                  total), followed by {sectorData[1].sector} ({sectorData[1].percentage.toFixed(1)}%).
                </ChartCaption>
              )}
              <div className="chart-container" style={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorData} layout="vertical" margin={{ top: 5, right: 150, left: 20, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(value) => value.toLocaleString()} />
                    <YAxis type="category" dataKey="sector" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<BarTooltip unit="MT" />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
                      {sectorData.map((entry) => (
                        <Cell key={entry.sector} fill={SECTOR_COLORS[0]} />
                      ))}
                      <LabelList dataKey="label" position="right" className="chart-bar-label" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-muted small mt-2 mb-0">
                Reference data — compiled from recorded national salt demand benchmarks in the dashboard database.
              </p>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </section>
  );
}