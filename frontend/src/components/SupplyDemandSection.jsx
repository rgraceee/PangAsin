import React, { useMemo, useState } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell, CartesianGrid,
} from 'recharts';
import { Globe, MapPin, Lightbulb, BarChart3, PieChart } from 'lucide-react';
import { getSupplyDemand, getSectorDemand } from '../services/dataService';
import { BRAND, BRAND_TINTS } from '../theme/colors';
import ChartCaption from './ChartCaption';

// WHAT: Kulay kada категоriya (parehas sa buong system). WHY: hindi nagbabago ang kulay
//      ng bawat serye kahit magpalit ng scope, para mabasa agad ang chart.
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
  const point = payload[0].payload || {};
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-label">{point.name || point.sector}</div>
      <div className="ct-value">{Number(payload[0].value).toLocaleString()} {unit}</div>
      {point.percentage != null ? (
        <div className="ct-sub">{point.percentage.toFixed(1)}% of total recorded demand</div>
      ) : null}
    </div>
  );
}

// WHAT: Legend na ginagamit ang parehong swatch style ng admin charts.
function CategoryLegend({ labels }) {
  return (
    <div className="admin-chart-legend" aria-hidden="true">
      {labels.map((label) => (
        <span key={label} className="admin-chart-legend-item">
          <span className="admin-chart-legend-swatch" style={{ background: BAR_COLORS[label] || BRAND.ocean }} />
          {label}
        </span>
      ))}
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

  // WHAT: Plain-text na buod para sa screen readers. WHY: binabasa ng assistive tech
  //      ang laman ng bar chart kahit walang mouse.
  const supplyDemandAria = supplyDemandRows
    .map((r) => `${r.name}: ${Number(r.value).toLocaleString()} ${data.unit}`)
    .join('; ');
  const sectorAria = sectorData
    .map((s) => `${s.sector}: ${Number(s.value).toLocaleString()} MT, ${s.percentage.toFixed(1)} percent`)
    .join('; ');

  const spansBoth = sectorData.length >= 2;

  return (
    <section className="public-section">
      <Row className="g-4">
        <Col lg={7}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div className="admin-card-head">
                  <span className="admin-card-head-icon admin-kpi-accent-oceanbg"><BarChart3 size={16} strokeWidth={2} /></span>
                  <div>
                    <h5 className="admin-card-head-title">Salt Supply and Demand</h5>
                    <span className="fw-normal text-muted small ms-1">Compare salt demand with production and imports</span>
                  </div>
                </div>
                <div className="fc-segmented" role="group" aria-label="Scope selector">
                  <button
                    type="button"
                    className={`fc-segmented-btn ${isPhilippines ? 'active' : ''}`}
                    aria-pressed={isPhilippines}
                    onClick={() => setScope('philippines')}
                  >
                    <Globe size={13} aria-hidden="true" />
                    Philippines
                  </button>
                  <button
                    type="button"
                    className={`fc-segmented-btn ${!isPhilippines ? 'active' : ''}`}
                    aria-pressed={!isPhilippines}
                    onClick={() => setScope('pangasinan')}
                  >
                    <MapPin size={13} aria-hidden="true" />
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
              <ChartCaption icon={<Lightbulb size={15} strokeWidth={2} />}>{supplyDemandCaption}</ChartCaption>
              {/* WHAT: role="img" + aria-label. WHY: isang buod na lang ang binabasa ng SR. */}
              <div
                className="chart-container"
                style={{ height: 300 }}
                role="img"
                aria-label={`Bar chart of salt supply and demand in ${data.unit}. ${supplyDemandAria}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplyDemandRows} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(21, 35, 58, 0.08)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(21, 35, 58, 0.15)' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickFormatter={(value) => value.toLocaleString()}
                      label={{ value: data.unit, angle: -90, position: 'insideLeft', offset: 0,
                        style: { fontSize: 11, fill: '#6b7280', textAnchor: 'middle' } }}
                    />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<BarTooltip unit={data.unit} />} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {data.labels.map((label) => (
                        <Cell key={label} fill={BAR_COLORS[label] || BRAND.ocean} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <CategoryLegend labels={data.labels} />
              <p className="text-muted small mt-2 mb-0">{data.note}</p>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="encoder-card h-100">
            <Card.Header>
              <div className="admin-card-head">
                <span className="admin-card-head-icon admin-kpi-accent-goldbg"><PieChart size={16} strokeWidth={2} /></span>
                <div>
                  <h5 className="admin-card-head-title">Salt Demand by Sector</h5>
                  <span className="fw-normal text-muted small ms-1">National breakdown by end use</span>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {spansBoth && (
                <ChartCaption tone="info" icon={<Lightbulb size={15} strokeWidth={2} />}>
                  {sectorData[0].sector} is the largest recorded end use ({sectorData[0].percentage.toFixed(1)}% of
                  total), followed by {sectorData[1].sector} ({sectorData[1].percentage.toFixed(1)}%).
                </ChartCaption>
              )}
              <div
                className="chart-container"
                style={{ height: 320 }}
                role="img"
                aria-label={`Horizontal bar chart of salt demand by sector in MT. ${sectorAria}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorData} layout="vertical" margin={{ top: 4, right: 150, left: 8, bottom: 18 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(21, 35, 58, 0.08)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(21, 35, 58, 0.15)' }}
                      tickFormatter={(value) => value.toLocaleString()}
                      label={{ value: 'MT', position: 'insideBottomRight', offset: -2,
                        style: { fontSize: 11, fill: '#6b7280' } }}
                    />
                    <YAxis
                      type="category"
                      dataKey="sector"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={120}
                    />
                    <Tooltip cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }} content={<BarTooltip unit="MT" />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={30}>
                      {sectorData.map((entry, index) => (
                        <Cell key={entry.sector} fill={SECTOR_COLORS[index % SECTOR_COLORS.length]} />
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
