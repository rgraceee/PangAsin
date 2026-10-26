// WHAT: Public na "Salt Supply and Demand" + "Salt Demand by Sector" — dalawang
//       card sa iisang row.
// WHY: Parehong visual language ang admin charts (card shell, grid, axis,
//      tooltip, caption) kaya hindi mapagkakita kung alin ang public at alin
//      ang admin. Ang mga numerong hango ay mula sa parehong /api/public/dashboard.
import React, { useMemo, useState } from 'react';
import { Card, Row, Col } from 'react-bootstrap';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { Globe, MapPin, BarChart3, PieChart, Info } from 'lucide-react';
import { getSupplyDemand, getSectorDemand } from '../services/dataService';
import {
  CATEGORY_RAMP, FC_TOKENS, SUPPLY_COLORS, fmtMT, fmtNumber, fmtPct,
  niceCeil, pctOf,
} from './public/publicChartTheme';

// WHAT: Tooltip na pareho ang admin (fc-tooltip): label + value row + sub row.
// WHY: Isang itsura para sa lahat ng chart sa app; hindi na kailangang
//      basahin ang default na Recharts tooltip.
function SupplyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload || {};
  return (
    <div className="fc-tooltip">
      <div className="fc-tooltip-label">{point.name || point.sector}</div>
      <div className="fc-tooltip-row">
        <span>Volume</span><b>{fmtMT(point.value)}</b>
      </div>
      {point.percentage != null ? (
        <div className="fc-tooltip-row">
          <span>Share of demand</span><b>{fmtPct(point.percentage)}</b>
        </div>
      ) : null}
      {point.note ? <div className="fc-tooltip-source">{point.note}</div> : null}
    </div>
  );
}

/* WHAT: Custom label renderer para sa value label sa itaas ng vertical bar.
   WHY: Ang default na Recharts label ay naghahati ng text na may space sa
        dalawang linya ("683,608" / "MT") — kaya ito ang plain na <text>. */
function VerticalValueLabel({ x, y, width, value }) {
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      textAnchor="middle"
      fontSize={11.5}
      fontWeight={700}
      fill="#343A40"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {fmtMT(value)}
    </text>
  );
}

/* WHAT: Custom label renderer para sa value label sa kanan ng horizontal bar.
   WHY: same ang dahilan ng VerticalValueLabel — isang linya, walang wrap. */
function HorizontalValueLabel({ x, y, width, height, value }) {
  return (
    <text
      x={x + width + 8}
      y={y + height / 2}
      dominantBaseline="middle"
      textAnchor="start"
      fontSize={11.5}
      fontWeight={700}
      fill="#343A40"
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {fmtMT(value)}
    </text>
  );
}

/* WHAT: Custom tick renderer para sa pangalan ng sector.
   WHY: "Food Processing" ay naghahati din ng default na Recharts tick
        ("Food" / "Processing") — plain na <text> ang naka-render dito. */
function CategoryTick({ x, y, payload }) {
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={12}
      fill={FC_TOKENS.text2}
    >
      {payload.value}
    </text>
  );
}

// WHAT: Legend na gumagamit ng fc-chip (parehong admin chart chips).
// WHY: Parehong chip na hugis at kulay sa header chips ng admin charts.
//      Ang 'dashed' ay para sa reference line (parehong fc-chip-swatch--dashed).
function ChartLegend({ items }) {
  return (
    <div className="fc-card-legend">
      {items.map((item) => (
        <span key={item.label} className="fc-chip">
          <span
            className={`fc-chip-swatch${item.dashed ? ' fc-chip-swatch--dashed' : ''}`}
            style={item.dashed
              ? { borderColor: item.color, backgroundColor: 'transparent' }
              : { backgroundColor: item.color }}
          />
          {item.label}
          {item.percentage != null ? (
            <span className="public-chip-pct">{fmtPct(item.percentage)}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}

export default function SupplyDemandSection() {
  const [scope, setScope] = useState('philippines');

  const data = useMemo(() => getSupplyDemand(scope), [scope]);
  const sectorData = useMemo(
    () =>
      [...getSectorDemand()]
        .filter((s) => Number(s.value) > 0)
        .sort((a, b) => b.value - a.value),
    []
  );

  const isPhilippines = scope === 'philippines';

  /* WHAT: Rows ng bar chart + ang mga Derived na sukat (share, gap).
     WHY: Isang beses lang ang kalkula — hindi kalkulado sa render ng chart. */
  const { rows, max, legend, balance, caption, benchmark } = useMemo(() => {
    const [a, b, c] = data.values;
    const source = isPhilippines
      ? { demand: a, supply: b, imports: c }
      : { supply: a, demand: b };

    const demand = Number(source.demand) || 0;
    const supply = Number(source.supply) || 0;
    const imports = Number(source.imports) || 0;
    const covered = supply + (isPhilippines ? imports : 0);

    const built = data.labels.map((label, index) => {
      const value = Number(data.values[index]) || 0;
      const share = isPhilippines && label !== 'National Demand' ? pctOf(value, demand) : null;
      return {
        name: label,
        value,
        color: SUPPLY_COLORS[label] || FC_TOKENS.ocean,
        percentage: share,
        note: isPhilippines
          ? (label === 'National Demand'
            ? 'Total salt demand benchmark for the Philippines'
            : (label === 'Domestic Supply'
              ? 'Salt produced by local salt farmers'
              : 'Salt sourced from imports'))
          : (label === 'Demand Benchmark'
            ? 'Annual salt demand benchmark for Pangasinan'
            : 'Approved production recorded to date'),
      };
    });

    const highest = built.reduce((mx, r) => Math.max(mx, r.value), 0);
    const axisMax = niceCeil(highest * 1.15);

    const legendItems = built.map((r) => ({ label: r.name, color: r.color }));

    let chips = [];
    let captionText = '';
    let benchmarkLine = null;
    if (isPhilippines) {
      const domesticShare = pctOf(supply, demand);
      const importShare = pctOf(imports, demand);
      const unmet = Math.max(demand - covered, 0);
      const unmetShare = pctOf(unmet, demand);
      chips = [
        { label: 'Domestic supply', value: domesticShare == null ? '—' : fmtPct(domesticShare) },
        { label: 'Imports', value: importShare == null ? '—' : fmtPct(importShare) },
        { label: unmet > 0 ? 'Unmet demand' : 'Demand met', value: unmet > 0 ? fmtPct(unmetShare) : '100%' },
      ];
      captionText = demand > 0
        ? `Recorded national demand of ${fmtMT(demand)} is met by ${fmtMT(supply)} of domestic supply and `
          + `${fmtMT(imports)} of imports`
          + (unmet > 0
            ? `, leaving ${fmtMT(unmet)} unmet.`
            : ', fully covered by domestic supply and imports.')
        : 'No national salt demand benchmark is available yet.';
    } else {
      const coverage = pctOf(supply, demand);
      const gap = supply - demand;
      chips = [
        { label: 'Recorded supply', value: fmtMT(supply) },
        { label: 'Demand benchmark', value: fmtMT(demand) },
        {
          label: gap >= 0 ? 'Surplus' : 'Shortage',
          value: fmtMT(Math.abs(gap)),
        },
      ];
      captionText =
        `Pangasinan's recorded supply of ${fmtMT(supply)} covers ${coverage == null ? '—' : fmtPct(coverage)} `
        + `of the local demand benchmark of ${fmtMT(demand)}`
        + (gap >= 0 ? ' — a surplus against the benchmark.' : ' — a shortfall against the benchmark.');
      if (demand > 0) {
        benchmarkLine = { value: demand };
        /* WHAT: Dashed chip sa legend para malinaw kung ano ang guhit na linya.
           WHY: parehong fc-chip-swatch--dashed ng admin — walang text label sa
                ReferenceLine dahil doon nahaharap sa overlap sa mga bar. */
        legendItems.push({
          label: 'Demand benchmark line',
          color: FC_TOKENS.gold,
          dashed: true,
        });
      }
    }

    return {
      rows: built,
      max: axisMax,
      legend: legendItems,
      balance: chips,
      caption: captionText,
      benchmark: benchmarkLine,
    };
  }, [data, isPhilippines]);

  /* WHAT: Sector rows na may percentage na nakalagay sa legend chip.
     WHY: Isang lugar lang ang eksaktong numero (bar label = Metric Tons (MT), chip = %),
          at hindi nauubos ang espasyo ng bar. */
  const sectorRows = useMemo(() => {
    const total = sectorData.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    return sectorData.map((s, index) => ({
      sector: s.sector,
      value: Number(s.value) || 0,
      percentage: total > 0 ? (s.value / total) * 100 : 0,
      color: CATEGORY_RAMP[index % CATEGORY_RAMP.length],
    }));
  }, [sectorData]);

  const sectorMax = niceCeil(sectorRows.reduce((mx, s) => Math.max(mx, s.value), 0) * 1.05);

  const sectorCaption = useMemo(() => {
    if (sectorRows.length === 0) return 'No sector demand benchmark available yet.';
    const top = sectorRows[0];
    const second = sectorRows[1];
    const total = sectorRows.reduce((sum, s) => sum + s.value, 0);
    const lead = `${top.sector} is the largest tracked end use at ${fmtMT(top.value)} (${fmtPct(top.percentage)} of tracked demand)`;
    const follow = second
      ? `, followed by ${second.sector} (${fmtPct(second.percentage)}).`
      : '.';
    return `${lead}${follow} Tracked demand totals ${fmtMT(total)}.`;
  }, [sectorRows]);

  // WHAT: Plain-text na buod para sa screen readers.
  const supplyAria = rows.map((r) => `${r.name}: ${fmtMT(r.value)}`).join('; ');
  const sectorAria = sectorRows
    .map((s) => `${s.sector}: ${fmtMT(s.value)}, ${fmtPct(s.percentage)}`)
    .join('; ');

  return (
    <section className="public-section">
      <Row className="g-4">
        <Col lg={7}>
          <Card className="fc-card h-100">
            <Card.Header className="fc-card-head">
              <div className="fc-card-head-left">
                <span className="fc-card-head-icon">
                  <BarChart3 size={16} strokeWidth={1.75} />
                </span>
                <div className="fc-card-head-text">
                  <h5 className="fc-card-title">Salt Supply and Demand</h5>
                  <p className="fc-card-sub">Compare salt demand with production and imports (Metric Tons (MT))</p>
                </div>
              </div>
              {/* WHAT: Segmented scope switcher (Philippines / Pangasinan).
                  WHY: Ang dating `fc-segmented` ay walang CSS sa app kaya
                       naka-render ito bilang plain na button — ngayon ay may
                       tunay na pill styling na kapareho ng admin chips. */}
              <div className="fc-card-head-right">
                <div className="public-segmented" role="group" aria-label="Scope selector">
                  <button
                    type="button"
                    className={`public-segmented-btn ${isPhilippines ? 'is-active' : ''}`}
                    aria-pressed={isPhilippines}
                    onClick={() => setScope('philippines')}
                  >
                    <Globe size={13} aria-hidden="true" />
                    Philippines
                  </button>
                  <button
                    type="button"
                    className={`public-segmented-btn ${!isPhilippines ? 'is-active' : ''}`}
                    aria-pressed={!isPhilippines}
                    onClick={() => setScope('pangasinan')}
                  >
                    <MapPin size={13} aria-hidden="true" />
                    Pangasinan
                  </button>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="fc-card-body">
              <div
                className="fc-chart"
                style={{ height: 300 }}
                role="img"
                aria-label={`Bar chart of salt supply and demand in metric tons. ${supplyAria}.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rows} margin={{ top: 24, right: 16, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={FC_TOKENS.grid} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12, fill: FC_TOKENS.text2 }}
                      tickLine={false}
                      axisLine={{ stroke: FC_TOKENS.border }}
                      interval={0}
                    />
                    <YAxis
                      type="number"
                      domain={[0, max]}
                      tick={{ fontSize: 11, fill: FC_TOKENS.muted }}
                      tickLine={false}
                      axisLine={false}
                      width={62}
                      tickFormatter={fmtNumber}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                      content={<SupplyTooltip />}
                    />
                    {benchmark && (
                      <ReferenceLine
                        y={benchmark.value}
                        stroke={FC_TOKENS.gold}
                        strokeDasharray="5 3"
                        strokeWidth={2}
                      />
                    )}
                    <Bar dataKey="value" name="Volume" radius={[6, 6, 0, 0]} maxBarSize={64}>
                      {rows.map((row) => (
                        <Cell key={row.name} fill={row.color} />
                      ))}
                      <LabelList dataKey="value" content={<VerticalValueLabel />} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <ChartLegend items={legend} />

              {/* WHAT: Meta chips na may numerong buod ng balanse.
                  WHY: Isang beses lang ang basahin ang reader — hindi na kailangang
                       magmental-math para malaman ang unmet demand. */}
              <div className="public-balance-strip">
                {balance.map((chip) => (
                  <span key={chip.label} className="public-balance-chip">
                    <span className="public-balance-label">{chip.label}</span>
                    <span className="public-balance-value">{chip.value}</span>
                  </span>
                ))}
              </div>

              <p className="fc-chart-caption">{caption}</p>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={5}>
          <Card className="fc-card h-100">
            <Card.Header className="fc-card-head">
              <div className="fc-card-head-left">
                <span className="fc-card-head-icon">
                  <PieChart size={16} strokeWidth={1.75} />
                </span>
                <div className="fc-card-head-text">
                  <h5 className="fc-card-title">Salt Demand by Sector</h5>
                  <p className="fc-card-sub">National breakdown by end use (Metric Tons (MT))</p>
                </div>
              </div>
              <div className="fc-card-head-right">
                <span className="reference-tag">
                  <Info size={12} strokeWidth={2} /> Reference data &mdash; not live
                </span>
              </div>
            </Card.Header>
            <Card.Body className="fc-card-body">
              {sectorRows.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-chip">No data</span>
                  No sector demand reference data available yet.
                </div>
              ) : (
                <>
                  <div
                    className="fc-chart"
                    style={{ height: 300 }}
                    role="img"
                    aria-label={`Horizontal bar chart of salt demand by sector in metric tons. ${sectorAria}.`}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sectorRows}
                        layout="vertical"
                        margin={{ top: 4, right: 76, bottom: 4, left: 0 }}
                        barCategoryGap="28%"
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={FC_TOKENS.grid} />
                        <XAxis
                          type="number"
                          domain={[0, sectorMax]}
                          tick={{ fontSize: 11, fill: FC_TOKENS.muted }}
                          tickLine={false}
                          axisLine={{ stroke: FC_TOKENS.border }}
                          tickFormatter={fmtNumber}
                        />
                        <YAxis
                          type="category"
                          dataKey="sector"
                          tick={<CategoryTick />}
                          tickLine={false}
                          axisLine={false}
                          width={104}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(21, 101, 200, 0.06)' }}
                          content={<SupplyTooltip />}
                        />
                        <Bar dataKey="value" name="Sector demand" radius={[0, 6, 6, 0]} maxBarSize={28}>
                          {sectorRows.map((row) => (
                            <Cell key={row.sector} fill={row.color} />
                          ))}
                          <LabelList dataKey="value" content={<HorizontalValueLabel />} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <ChartLegend
                    items={sectorRows.map((row) => ({
                      label: row.sector,
                      color: row.color,
                      percentage: row.percentage,
                    }))}
                  />
                  <p className="fc-chart-caption">{sectorCaption}</p>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </section>
  );
}
