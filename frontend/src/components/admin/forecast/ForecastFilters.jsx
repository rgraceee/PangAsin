// WHAT: The Forecasting filters, rendered inside the page hero.
// WHY: the header already owns the scope and the period, so every filter sits
//      in one row using the same tokens as the other admin pages.
import { Form } from 'react-bootstrap';
import { RotateCcw } from 'lucide-react';
import { scopeAllLabel } from '../../../constants/labels';

const PERIODS = [
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
  { value: '24', label: '24 months' },
  { value: 'all', label: 'All data' },
];

const HORIZONS = [
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '12 months' },
];

export default function ForecastFilters({
  recordedWindow, onRecordedWindow,
  forecastHorizon, onForecastHorizon,
  selectedMuni, municipalities, onSelectedMuni,
  onReset, disabled = false, municipalityCount = 0,
}) {
  return (
    <>
      <div className="fc-hero-filters">
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-period">Historical period</label>
          <Form.Select
            id="fc-period"
            className="admin-page-hero-select"
            value={recordedWindow}
            disabled={disabled}
            onChange={(e) => onRecordedWindow(e.target.value)}
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </Form.Select>
        </div>

        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-horizon">Forecast horizon</label>
          <Form.Select
            id="fc-horizon"
            className="admin-page-hero-select"
            value={forecastHorizon}
            disabled={disabled}
            onChange={(e) => onForecastHorizon(e.target.value)}
          >
            {HORIZONS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </Form.Select>
        </div>

        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="fc-municipality">Municipality</label>
          <Form.Select
            id="fc-municipality"
            className="admin-page-hero-select"
            value={selectedMuni}
            disabled={disabled}
            onChange={(e) => onSelectedMuni(e.target.value)}
          >
            <option value="all">{scopeAllLabel(municipalityCount || municipalities.length)}</option>
            {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Form.Select>
        </div>

        <button type="button" className="ui-btn-outline fc-hero-reset" onClick={onReset} disabled={disabled}>
          <RotateCcw size={15} strokeWidth={1.75} />
          Reset
        </button>
      </div>
    </>
  );
}
