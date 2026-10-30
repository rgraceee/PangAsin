// WHAT: The Forecasting filters, rendered inside the page hero.
// WHY: the header already owns the scope and the period, so every filter sits
//      in one row using the same tokens as the other admin pages.
import { useEffect, useState } from 'react';
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

/* Plain-English "how old is this data" label. */
export function formatUpdated(timestamp) {
  if (!timestamp) return '';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Updated yesterday';
  if (days < 7) return `Updated ${days} days ago`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? 'Updated last week' : `Updated ${weeks} weeks ago`;
}

export default function ForecastFilters({
  recordedWindow, onRecordedWindow,
  forecastHorizon, onForecastHorizon,
  selectedMuni, municipalities, onSelectedMuni,
  onReset, lastUpdated,
  summary, disabled = false, municipalityCount = 0,
}) {
  // Re-render every 30s so the "updated" label keeps up with the clock.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

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

      <p className="fc-hero-summary">
        <span className="fc-hero-summary-text">
          {lastUpdated ? `${formatUpdated(lastUpdated)} · ` : ''}
          {summary}
        </span>
      </p>
    </>
  );
}
