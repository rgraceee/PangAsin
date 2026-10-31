// WHAT: One full-width card with a single municipality outlook chart and a
//       metric toggle: Forecast vs recent average / Year-over-year change.
// WHY: one chart, one axis, one tooltip, same municipality order.
import { useState } from 'react';
import { Card } from 'react-bootstrap';
import { Building2 } from 'lucide-react';
import { ChartChip } from './ForecastChartCard';
import ForecastMuniPanel from './ForecastMuniPanel';
import { MUNI_COLORS, MUNI_EDGES, MUNI_LABELS } from './forecastColors';

const METRICS = [
  { key: 'change', label: 'Forecast vs recent average', title: 'Forecast change by municipality', sub: 'Each bar is one municipality; bars to the right show a stronger forecast change.', unit: 'Forecast vs recent average (%)', source: 'Source: expected_change_pct of each municipality\'s latest forecast run.' },
  { key: 'yoy', label: 'Year-over-year', title: 'Recorded change by municipality', sub: 'Each bar is one municipality; bars to the right show stronger 12-month growth.', unit: 'Recorded year-over-year change (%)', source: 'Source: municipality production data, two complete 12-month calendar blocks.' },
];

export default function ForecastMuniPanels({ rows, height = 320 }) {
  const [metric, setMetric] = useState('change');
  const m = METRICS.find((x) => x.key === metric);
  const chips = (
    <>
      <ChartChip label={MUNI_LABELS.increase} color={MUNI_COLORS.increase} />
      <ChartChip label={MUNI_LABELS.decrease} color={MUNI_COLORS.decrease} />
      <ChartChip label={MUNI_LABELS.stable} color={MUNI_COLORS.stable} />
      <ChartChip label={MUNI_LABELS.nodata} color={MUNI_EDGES.nodata} dashed />
    </>
  );

  const valueKey = metric === 'change' ? 'change' : 'yoy';
  const statusKey = metric === 'change' ? 'changeStatus' : 'yoyStatus';

  return (
    <Card className="fc-card fc-muni-card">
      <Card.Header className="fc-card-head">
        <div className="fc-card-head-left">
          <span className="fc-card-head-icon"><Building2 size={16} strokeWidth={1.75} /></span>
          <div className="fc-card-head-text">
            <h5 className="fc-card-title">Municipality Outlook</h5>
            <div className="fc-muni-toggles" role="group" aria-label="Municipality outlook metric">
              {METRICS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  className={`ui-btn-outline fc-muni-toggle${metric === x.key ? ' is-active' : ''}`}
                  aria-pressed={metric === x.key}
                  onClick={() => setMetric(x.key)}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <p className="fc-card-sub">{m.sub}</p>
          </div>
        </div>
        <div className="fc-card-head-right">
          {chips}
        </div>
      </Card.Header>
      <Card.Body className="fc-card-body">
        <ForecastMuniPanel
          rows={rows}
          valueKey={valueKey}
          statusKey={statusKey}
          title={m.title}
          subTitle={m.sub}
          unitLabel={m.unit}
          sourceNote={m.source}
          height={height}
        />
        <p className="fc-chart-caption">
          A municipality is marked as incomplete when a month inside the 12-month block has no source row, so no
          percentage is shown for it.
        </p>
      </Card.Body>
    </Card>
  );
}
