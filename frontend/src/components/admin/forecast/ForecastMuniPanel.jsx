// WHAT: One municipality panel: a title, a one-line explanation and the
//       diverging bar chart of the municipalities for ONE metric.
// WHY: The two panels on the card measure different things, so each one owns
//      its own metric, scale and source note - but they share the rows.
import { niceScale, directionFromPct } from './forecastData';
import ForecastMuniChart from './ForecastMuniChart';

export default function ForecastMuniPanel({
  rows, valueKey, statusKey, title, unitLabel, height = 320,
}) {
  const values = rows.map((r) => r[valueKey]).filter((v) => v !== null && v !== undefined);
  const scale = niceScale(Math.min(...values, 0), Math.max(...values, 0), 4);
  const placeholder = Math.max(0.4, (scale.domain[1] - scale.domain[0]) * 0.015);

  const data = rows.map((r) => {
    const value = r[valueKey];
    const hasValue = value !== null && value !== undefined;
    return {
      name: r.name,
      value: hasValue ? value : null,
      placeholder: hasValue ? null : placeholder,
      status: hasValue ? 'ok' : (r[statusKey] || 'nodata'),
      direction: hasValue ? directionFromPct(value) : 'nodata',
    };
  });

  return (
    <div className="fc-muni-panel">
      <h6 className="fc-muni-panel-title">{title}</h6>
      <div className="fc-chart" style={{ height }}>
        <ForecastMuniChart data={data} scale={scale} unitLabel={unitLabel} />
      </div>
    </div>
  );
}
