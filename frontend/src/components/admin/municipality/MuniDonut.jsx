// WHAT: The donut used by "Production Method" and the Gender tab.
// WHY: one donut with one hover language - the hovered slice stays solid, the
//      rest fade, and the hole says what is being read instead of repeating the
//      legend. The centre value is display-only; every number still comes from
//      the rows the page already built.
import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fmtInt, fmtPct } from './municipalityData';
import { useChartMotion } from '../../ui/chartTheme';

export default function MuniDonut({
  rows,
  total,
  unit = 'MT',
  label = 'Total',
  tooltip,
  chartKey = 'donut',
  animate = true,
  ariaLabel,
}) {
  const [activeIndex, setActiveIndex] = useState(null);
  const motion = useChartMotion(chartKey, animate);

  // Zero slices have no drawable area and would shift the hover index.
  const data = (rows || []).filter((row) => Number(row.value) > 0);
  const active = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="muni-donut" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="61%"
            outerRadius="93%"
            paddingAngle={2}
            cornerRadius={5}
            dataKey="value"
            nameKey="name"
            stroke="none"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            {...motion}
          >
            {data.map((row, index) => (
              <Cell
                key={row.key ?? row.name}
                fill={row.color}
                fillOpacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
              />
            ))}
          </Pie>
          <Tooltip content={tooltip} />
        </PieChart>
      </ResponsiveContainer>

      <div className="muni-donut-center" aria-hidden="true">
        <span className="muni-donut-center-value">
          {fmtInt(active ? active.value : total)}
          {unit ? <em>{unit}</em> : null}
        </span>
        <span className="muni-donut-center-label">{active ? active.name : label}</span>
        {active ? <span className="muni-donut-center-pct">{fmtPct(active.pct)}</span> : null}
      </div>
    </div>
  );
}
