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
  { key: 'change', label: 'Forecast vs recent average', title: 'Forecast change by municipality', unit: 'Forecast vs recent average (%)' },
  { key: 'yoy', label: 'Year-over-year', title: 'Recorded change by municipality', unit: 'Recorded year-over-year change (%)' },
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
          unitLabel={m.unit}
          height={height}
        />
      </Card.Body>
    </Card>
  );
}
