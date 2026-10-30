// WHAT: Public "Production by Municipality" (ranked bars) and "Share of
//       Provincial Production" (donut) cards, shown under the public map.
// WHY: The public page explains the provincial numbers but had no per-municipality
//      view. Both cards use the same fc-card shell, tooltip and caption language as
//      the other public and admin charts, and read the same dashboard payload —
//      no extra API call and no new numbers.
import React, { useMemo, useState } from 'react';
import { Card, Col, Row } from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell,
  CartesianGrid,
} from 'recharts';
import { PieChart as PieGlyph, TrendingUp } from 'lucide-react';
import {
  FC_TOKENS, fmtCompact, fmtNumber, fmtPct, niceCeil,
} from './publicChartTheme';
import MuniShareDonut from '../admin/municipality/MuniShareDonut';

/* WHAT: Shared hover card for both charts.
   WHY: Same white card, label row and value rows as the public supply-demand
        tooltip, so the two sections read as one page. */
function MunicipalityTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload || {};
  if (!row.name) return null;
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{row.name}</div>
      <div className="fc-tooltip-row">
        <span>Production</span><b>{fmtNumber(row.value)} MT</b>
      </div>
      <div className="fc-tooltip-row">
        <span>Share of province</span><b>{fmtPct(row.share)}</b>
      </div>
    </div>
  );
}

/* WHAT: Value label at the end of a horizontal bar.
   WHY: Recharts splits labels that contain a space onto two lines, so the value
        and unit are drawn as one plain <text>. */
function BarValueLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="middle"
      textAnchor="start"
      fontSize={12}
      fontWeight={700}
      fill={FC_TOKENS.text}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {fmtCompact(value)} MT
    </text>
  );
}

/* WHAT: Municipality name tick without Recharts' automatic word wrap. */
function MunicipalityTick({ x, y, payload }) {
  return (
    <text
      x={x - 10}
      y={y + 5}
      textAnchor="end"
      fontSize={12.5}
      fill={FC_TOKENS.text}
    >
      {payload.value}
    </text>
  );
}

export default function MunicipalityProductionCharts({ municipalities = [] }) {
  const [activeName, setActiveName] = useState(null);

  const { rows, total, axisMax, slices } = useMemo(() => {
    const list = (Array.isArray(municipalities) ? municipalities : [])
      .map((m) => ({
        id: m.id ?? m.name,
        name: m.name,
        value: Number(m.productionMT) || 0,
      }))
      .filter((m) => m.name)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const sum = list.reduce((acc, row) => acc + row.value, 0);
    const chartRows = list.map((row, index) => ({
      ...row,
      share: sum > 0 ? (row.value / sum) * 100 : 0,
    }));
    const highest = chartRows.reduce((max, row) => Math.max(max, row.value), 0);

    return {
      rows: chartRows,
      total: sum,
      axisMax: niceCeil(highest * 1.15),
    };
  }, [municipalities]);

  const topRow = rows[0] || null;
  const hasData = rows.length > 0 && total > 0;

  /* WHAT: Plain-text summaries for screen readers. */
  const barAria = rows.map((row) => `${row.name}: ${fmtNumber(row.value)} metric tons, ${fmtPct(row.share)}`).join('; ');

  return (
    <section className="public-section">
      <Row className="g-4">
        <Col lg={7}>
          <Card className="fc-card h-100">
            <Card.Header className="fc-card-head">
              <div className="fc-card-head-left">
                <span className="fc-card-head-icon">
                  <TrendingUp size={16} strokeWidth={1.75} />
                </span>
                <div className="fc-card-head-text">
                  <h5 className="fc-card-title">Production by Municipality</h5>
                  <p className="fc-card-sub">Each bar is one municipality over the latest 12 months, ranked by volume in Metric Tons (MT).</p>
                </div>
              </div>
              <div className="fc-card-head-right">
                <span className="fc-chip fc-chip--meta">
                  {hasData ? `${fmtNumber(total)} MT total` : 'No data'}
                </span>
              </div>
            </Card.Header>
            <Card.Body className="fc-card-body">
              {!hasData ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No municipality production data is available yet.
                </div>
              ) : (
                <>
                  <div
                    className="fc-chart"
                    style={{ height: 340 }}
                    role="img"
                    aria-label={`Ranked bar chart of salt production by municipality in metric tons for the latest 12 months. ${barAria}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={rows}
                        layout="vertical"
                        margin={{ top: 4, right: 92, bottom: 4, left: 0 }}
                        barCategoryGap="26%"
                        onMouseLeave={() => setActiveName(null)}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                          stroke={FC_TOKENS.grid}
                        />
                        <XAxis
                          type="number"
                          domain={[0, axisMax]}
                          tick={{ fontSize: 11, fill: FC_TOKENS.muted }}
                          tickLine={false}
                          axisLine={{ stroke: FC_TOKENS.border }}
                          tickFormatter={fmtCompact}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={108}
                          tick={<MunicipalityTick />}
                          tickLine={false}
                          axisLine={false}
                          interval={0}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                          content={<MunicipalityTooltip />}
                        />
                        <Bar
                          dataKey="value"
                          name="Production"
                          maxBarSize={20}
                          radius={[0, 6, 6, 0]}
                          onMouseEnter={(_, index) => setActiveName(rows[index]?.name ?? null)}
                        >
                          {rows.map((row, index) => (
                            <Cell
                              key={row.id}
                              fill={index === 0 ? FC_TOKENS.navy : FC_TOKENS.ocean}
                              fillOpacity={activeName === null || activeName === row.name ? 1 : 0.45}
                            />
                          ))}
                          <LabelList dataKey="value" content={<BarValueLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="public-balance-strip">
                    <span className="public-balance-chip">
                      <span className="public-balance-label">Top municipality</span>
                      <span className="public-balance-value">
                        {topRow.name} · {fmtPct(topRow.share)}
                      </span>
                    </span>
                    <span className="public-balance-chip">
                      <span className="public-balance-label">Municipalities with data</span>
                      <span className="public-balance-value">
                        {rows.filter((row) => row.value > 0).length} of {rows.length}
                      </span>
                    </span>
                  </div>

                  <p className="fc-chart-caption">
                    Ranked by total production volume for the latest 12 months. Share compares each
                    municipality with the provincial total.
                  </p>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="fc-card h-100">
            <Card.Header className="fc-card-head">
              <div className="fc-card-head-left">
                <span className="fc-card-head-icon">
                  <PieGlyph size={16} strokeWidth={1.75} />
                </span>
                <div className="fc-card-head-text">
                  <h5 className="fc-card-title">Share of Provincial Production</h5>
                  <p className="fc-card-sub">Each slice is a municipality’s share of total provincial production in the latest 12 months.</p>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="fc-card-body">
              {!hasData ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No municipality production data is available yet.
                </div>
              ) : (
                <>
                  <MuniShareDonut
                    data={rows}
                    height={250}
                    centerLabel="Provincial total"
                    activeName={activeName}
                    onActiveChange={setActiveName}
                    tooltip={MunicipalityTooltip}
                  />

                  <p className="fc-chart-caption">
                    Percentages are each municipality's share of the {fmtNumber(total)} MT recorded
                    across the province in the latest 12 months.
                  </p>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </section>
  );
}
