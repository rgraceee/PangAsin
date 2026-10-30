// WHAT: Shared "Share of Provincial Production" donut, extracted from the public
//       dashboard so the public page and the admin Production by Municipality
//       card render the same donut from the same code.
// WHY: one donut implementation, one colour ramp, one legend format; the public
//       dashboard keeps its own tooltip and header copy, so it looks identical.
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { fmtNumber, fmtPct } from '../../public/publicChartTheme';

export const DONUT_COLORS = [
  '#0C2340',
  '#1565C8',
  '#29B039',
  '#F09A28',
  '#574326',
  '#6FA8DC',
  '#F7C16A',
];

function DonutTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload || {};
  if (!row.name) return null;
  return (
    <div className="admin-chart-tooltip">
      <div className="ct-label">{row.name}</div>
      <div className="ct-row">
        <span>Production</span><b>{fmtNumber(row.value)} MT</b>
      </div>
      <div className="ct-row">
        <span>Share of province</span><b>{fmtPct(row.share)}</b>
      </div>
    </div>
  );
}

export default function MuniShareDonut({
  data = [],
  height = 250,
  centerLabel = 'Total',
  activeName,
  onActiveChange,
  tooltip: TooltipComp = DonutTooltip,
  colorMap,
  showLegend = true,
}) {
  const [innerActive, setInnerActive] = useState(null);
  const active = activeName !== undefined ? activeName : innerActive;
  const setActive = (name) => {
    setInnerActive(name);
    onActiveChange?.(name);
  };

  const list = useMemo(() => {
    const rows = (Array.isArray(data) ? data : [])
      .map((m) => ({
        id: m.id ?? m.name,
        name: m.name,
        value: Number(m.value) || 0,
      }))
      .filter((m) => m.name)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

    const sum = rows.reduce((acc, row) => acc + row.value, 0);

    return rows.map((row, index) => ({
      ...row,
      share: sum > 0 ? (row.value / sum) * 100 : 0,
      color: colorMap?.[row.name] ?? DONUT_COLORS[index % DONUT_COLORS.length],
    }));
  }, [data, colorMap]);

  const total = list.reduce((sum, row) => sum + row.value, 0);
  const slices = list.filter((row) => row.value > 0);
  const activeSlice = slices.find((row) => row.name === active) || null;
  const hasData = list.length > 0 && total > 0;

  if (!hasData) {
    return (
      <div className="muni-empty" role="img" aria-label="No production data available.">
        <span className="muni-empty-chip">No data</span>
        No production records for the selected municipalities.
      </div>
    );
  }

  const aria = slices.map((row) => `${row.name}: ${fmtPct(row.share)}`).join('; ');

  return (
    <div className="muni-share-donut" role="img" aria-label={`Donut chart of each municipality's share of provincial salt production. ${aria}.`}>
      <div className="public-donut" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius="61%"
              outerRadius="93%"
              paddingAngle={2}
              cornerRadius={5}
              dataKey="value"
              nameKey="name"
              stroke="none"
              onMouseEnter={(_, index) => setActive(slices[index]?.name ?? null)}
              onMouseLeave={() => setActive(null)}
            >
              {slices.map((row) => (
                <Cell
                  key={row.id}
                  fill={row.color}
                  fillOpacity={active === null || active === row.name ? 1 : 0.45}
                />
              ))}
            </Pie>
            <Tooltip content={<TooltipComp />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="public-donut-center" aria-hidden="true">
          <span className="public-donut-value">
            {fmtNumber(activeSlice ? activeSlice.value : total)}<em>MT</em>
          </span>
          <span className="public-donut-label">{activeSlice ? activeSlice.name : centerLabel}</span>
          {activeSlice && <span className="public-donut-pct">{fmtPct(activeSlice.share)}</span>}
        </div>
      </div>
      {showLegend && (
        <ul className="public-muni-legend">
          {list.map((row) => (
            <li
              key={row.id}
              className={`public-muni-legend__row${row.name === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(row.name)}
              onMouseLeave={() => setActive(null)}
            >
              <span className="public-muni-legend__dot" style={{ backgroundColor: row.color }} aria-hidden="true" />
              <span className="public-muni-legend__name">{row.name}</span>
              <span className="public-muni-legend__value">{fmtNumber(row.value)} MT</span>
              <span className="public-muni-legend__pct">{fmtPct(row.share)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
