// WHAT: "Production by Municipality" card for the Admin Dashboard: ranked bar
//       chart toggleable with the Production Method donut. One card, one
//       Municipality | Method segmented toggle, same height for both views so
//       the layout below never jumps.
// WHY: the sliding thumb is positioned from each option's actual offsetLeft /
//      offsetWidth and recomputed on window resize so it always sits exactly
//      under the active option regardless of card width.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card } from 'react-bootstrap';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts';
import { BarChart2, Blend } from 'lucide-react';
import { BRAND, MUNICIPALITY_COLORS } from '../../../theme/colors';
import { fmtMT } from './municipalityData';
import { ProductionTooltip, MethodTooltip } from './municipalityTooltips';
import MuniDonut from './MuniDonut';

const CHART_HEIGHT = 340;

function barFillFor(name) {
  const fill = MUNICIPALITY_COLORS[name] ?? BRAND.ocean;
  const c = fill.slice(1);
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55;
  return { fill, stroke: light ? '#FFFFFF' : 'none', strokeWidth: light ? 1 : 0 };
}

export default function MuniProductionCard({
  rows = [],
  methodRows = [],
  methodTotal = 0,
}) {
  const [view, setView] = useState('bar');
  const thumbRef = useRef(null);
  const optionRefs = useRef({ bar: null, method: null });

  const { list, total } = useMemo(() => {
    const data = [...rows]
      .map((row) => ({ ...row, volumeMT: Number(row.volumeMT) || 0 }))
      .sort((a, b) => b.volumeMT - a.volumeMT);
    return {
      list: data,
      total: data.reduce((sum, row) => sum + row.volumeMT, 0),
    };
  }, [rows]);

  const max = Math.max(...list.map((row) => row.volumeMT), 1);
  const topRow = list[0];
  const topShare = total > 0 ? (topRow.volumeMT / total) * 100 : 0;
  const topMethod = methodRows && methodRows.length
    ? methodRows.reduce((a, b) => (b.value || 0) > (a.value || 0) ? b : a)
    : null;
  const topMethodShare = methodTotal > 0 && topMethod
    ? (topMethod.value / methodTotal) * 100 : 0;
  const hasData = list.length > 0 && total > 0;
  const methodDisabled = !methodRows || methodRows.length === 0;
  const effectiveView = methodDisabled && view === 'method' ? 'bar' : view;

  const sub = effectiveView === 'bar'
    ? 'Total volume (MT) per municipality, ranked.'
    : 'Share of production by method in the selected period.';

  const note = effectiveView === 'bar' && topRow
    ? `Top municipality: ${topRow.name} · ${topShare.toFixed(1)}% of total production.`
    : effectiveView === 'method' && topMethod
      ? `Top method: ${topMethod.name} · ${topMethodShare.toFixed(1)}% of total production.`
      : null;

  const positionThumb = useCallback(() => {
    const thumb = thumbRef.current;
    const activeKey = effectiveView;
    const option = optionRefs.current[activeKey];
    if (!thumb || !option) return;
    thumb.style.left = `${option.offsetLeft}px`;
    thumb.style.width = `${option.offsetWidth}px`;
  }, [effectiveView]);

  useEffect(() => {
    positionThumb();
    window.addEventListener('resize', positionThumb);
    return () => window.removeEventListener('resize', positionThumb);
  }, [positionThumb]);

  useEffect(() => {
    requestAnimationFrame(positionThumb);
  }, [positionThumb, effectiveView]);

  return (
    <Card className="encoder-card h-100 admin-prod-card">
      <Card.Header className="d-flex flex-wrap justify-content-between align-items-start gap-3">
        <div className="admin-card-head" style={{ minWidth: 0 }}>
          <span className="admin-card-head-icon admin-card-head-icon--soft">
            <BarChart2 size={16} strokeWidth={2} />
          </span>
          <div>
            <h5 className="admin-card-head-title">Production by Municipality</h5>
            <p className="admin-card-head-sub">{sub}</p>
          </div>
        </div>
        <div className="admin-prod-view" role="group" aria-label="Chart view" style={{ minWidth: 0 }}>
          <div className={`te-segmented te-segmented--two te-segmented--${effectiveView === 'method' ? 'method' : 'municipality'}`}>
            <span className="te-segmented__thumb" ref={thumbRef} aria-hidden="true" />
            <button
              type="button"
              ref={(el) => { optionRefs.current.bar = el; }}
              className={`te-segmented__option${effectiveView === 'bar' ? ' is-active' : ''}`}
              aria-pressed={effectiveView === 'bar'}
              onClick={() => setView('bar')}
            >
              <BarChart2 size={13} strokeWidth={2} aria-hidden="true" /> Municipality
            </button>
            <button
              type="button"
              ref={(el) => { optionRefs.current.method = el; }}
              className={`te-segmented__option${effectiveView === 'method' ? ' is-active' : ''}${methodDisabled ? ' is-disabled' : ''}`}
              aria-pressed={effectiveView === 'method'}
              disabled={methodDisabled}
              title={methodDisabled ? 'No production method data available' : undefined}
              onClick={() => setView('method')}
            >
              <Blend size={13} strokeWidth={2} aria-hidden="true" /> Method
            </button>
          </div>
        </div>
      </Card.Header>
      <Card.Body>
        {!hasData ? (
          <div className="admin-prod-empty">
            <span className="admin-prod-empty-chip">No data</span>
            No production records for the selected municipalities.
          </div>
        ) : effectiveView === 'bar' ? (
          <>
            <div className="admin-prod-chart" style={{ height: CHART_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={list}
                  layout="vertical"
                  margin={{ top: 4, right: 84, bottom: 4, left: 0 }}
                  barCategoryGap="26%"
                >
                  <CartesianGrid strokeDasharray="2 6" stroke="var(--ui-border)" vertical horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, max * 1.15]}
                    tick={{ fontSize: 11, fill: 'var(--ui-text-2)' }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--ui-border)' }}
                    tickFormatter={(v) => Math.round(v).toLocaleString()}
                    interval={0}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    tick={({ x, y, payload }) => (
                      <text
                        x={x - 10}
                        y={y + 5}
                        textAnchor="end"
                        fontSize={13}
                        fill="var(--ui-text)"
                      >
                        {payload.value}
                      </text>
                    )}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <Tooltip content={<ProductionTooltip />} />
                  <Bar
                    dataKey="volumeMT"
                    name="Production"
                    maxBarSize={20}
                    radius={[0, 7, 7, 0]}
                    label={({ x, y, width, height, index }) => {
                      const row = list[index];
                      if (!row) return null;
                      return (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          textAnchor="start"
                          dominantBaseline="central"
                          fontSize={13}
                          fontWeight={700}
                          fill="var(--ui-text)"
                        >
                          {fmtMT(row.volumeMT, 1)} MT
                        </text>
                      );
                    }}
                  >
                    {list.map((row) => {
                      const { fill, stroke, strokeWidth } = barFillFor(row.name);
                      return (
                        <Cell
                          key={row.id ?? row.name}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          fillOpacity={1}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {note && <p className="admin-prod-note">{note}</p>}
          </>
        ) : (
          <div className="admin-prod-method" style={{ height: CHART_HEIGHT, display: 'flex', flexDirection: 'column' }}>
            <div className="muni-method" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <MuniDonut
                rows={methodRows}
                total={methodTotal}
                unit="MT"
                label="All methods"
                tooltip={<MethodTooltip />}
                chartKey="production-method"
                ariaLabel={`Production method split, ${methodTotal || 0} metric tons in total`}
              />
              <ul className="muni-legend" role="list" style={{ marginTop: 12 }}>
                {methodRows.map((row) => (
                  <li key={row.key} className="muni-legend-item">
                    <span className="muni-legend-swatch" style={{ background: row.color }} />
                    <span className="muni-legend-name">{row.name}</span>
                    <span className="muni-legend-value">{fmtMT(row.value, 0)} MT</span>
                    <span className="muni-legend-pct">{row.pct.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            {note && <p className="admin-prod-note">{note}</p>}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
