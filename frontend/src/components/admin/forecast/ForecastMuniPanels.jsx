// WHAT: One full-width card with two panels side by side: "Forecast vs recent
//       average" and "Year-over-year production".
// WHY: they are two DIFFERENT metrics, so each gets its own title, but they
//      share one municipality order, one set of axis labels and one colour
//      meaning, so the two charts can be read against each other.
import { Card } from 'react-bootstrap';
import { Building2 } from 'lucide-react';
import { ChartChip } from './ForecastChartCard';
import ForecastMuniPanel from './ForecastMuniPanel';
import { MUNI_COLORS, MUNI_EDGES, MUNI_LABELS } from './forecastColors';

export default function ForecastMuniPanels({ rows, height = 320 }) {
  const chips = (
    <>
      <ChartChip label={MUNI_LABELS.increase} color={MUNI_COLORS.increase} />
      <ChartChip label={MUNI_LABELS.decrease} color={MUNI_COLORS.decrease} />
      <ChartChip label={MUNI_LABELS.stable} color={MUNI_COLORS.stable} />
      <ChartChip label={MUNI_LABELS.nodata} color={MUNI_EDGES.nodata} dashed />
    </>
  );

  return (
    <Card className="fc-card fc-muni-card">
      <Card.Header className="fc-card-head">
        <div className="fc-card-head-left">
          <span className="fc-card-head-icon"><Building2 size={16} strokeWidth={1.75} /></span>
          <div className="fc-card-head-text">
            <h5 className="fc-card-title">Municipality Outlook</h5>
            <p className="fc-card-sub">Two different comparisons, shown for the same seven municipalities in the same order.</p>
          </div>
        </div>
        <div className="fc-card-head-right">{chips}</div>
      </Card.Header>
      <Card.Body className="fc-card-body">
        <div className="fc-muni-panels">
          <ForecastMuniPanel
            rows={rows}
            valueKey="change"
            statusKey="changeStatus"
            title="Forecast vs recent average"
            subTitle="Model forecast compared with the recent historical average."
            unitLabel="Forecast vs recent average"
            sourceNote="Source: expected_change_pct of each municipality's latest forecast run."
            height={height}
          />
          <ForecastMuniPanel
            rows={rows}
            valueKey="yoy"
            statusKey="yoyStatus"
            title="Year-over-year production"
            subTitle="Last 12 complete months compared with the previous 12 complete months."
            unitLabel="Year-over-year change"
            sourceNote="Source: municipality production data, two complete 12-month calendar blocks."
            height={height}
          />
        </div>
        <p className="fc-chart-caption">
          The two panels measure different things: the left panel is a model projection, the right panel compares
          municipality production data. A municipality is marked as incomplete when a month inside the 12-month
          block has no source row, so no percentage is shown for it.
        </p>
      </Card.Body>
    </Card>
  );
}
