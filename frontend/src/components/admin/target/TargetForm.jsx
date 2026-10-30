// WHAT: The Target Evaluation inputs (municipality, annual target, horizon,
//       seasonal/even split) and the action button.
// WHY: they live in the page hero now, so the page opens with the question and
//      the answer, not with a separate form card.
import { Form, Spinner } from 'react-bootstrap';
import { Target } from 'lucide-react';

const SPLITS = [
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'equal', label: 'Even' },
];

export default function TargetForm({
  selectedMuni, onSelectedMuni, municipalities,
  annualTarget, onAnnualTarget,
  forecastHorizon, onForecastHorizon,
  splitMethod, onSplitMethod,
  onSubmit, loading,
}) {
  return (
    <>
      <div className="te-hero-row">
        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="te-muni">Municipality</label>
          <Form.Select
            id="te-muni"
            className="admin-page-hero-select"
            value={selectedMuni}
            onChange={(e) => onSelectedMuni(e.target.value)}
          >
            <option value="all">All Municipalities</option>
            {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Form.Select>
        </div>

        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="te-target">Annual target (Metric Tons (MT))</label>
          <Form.Control
            id="te-target"
            className="admin-page-hero-input"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={annualTarget}
            placeholder="e.g. 46000"
            onChange={(e) => onAnnualTarget(e.target.value)}
          />
        </div>

        <div className="admin-page-hero-control">
          <label className="admin-page-hero-field" htmlFor="te-horizon">Forecast horizon (months)</label>
          <Form.Control
            id="te-horizon"
            className="admin-page-hero-input"
            type="number"
            min="1"
            max="36"
            value={forecastHorizon}
            onChange={(e) => onForecastHorizon(Number(e.target.value))}
          />
        </div>

      <div className="admin-page-hero-control">
        <span className="admin-page-hero-field">Monthly target split</span>
        <div className={`te-segmented te-segmented--${splitMethod}`} role="group" aria-label="Monthly target split">
          <span className="te-segmented__thumb" aria-hidden="true" />
          {SPLITS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`te-segmented__option${splitMethod === s.value ? ' is-active' : ''}`}
              aria-pressed={splitMethod === s.value}
              onClick={() => onSplitMethod(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="ui-btn-primary te-form-submit"
        onClick={onSubmit}
        disabled={loading || !annualTarget || Number(annualTarget) <= 0}
        aria-label="Compare target to forecast"
      >
        {loading ? <Spinner as="span" animation="border" size="sm" /> : <Target size={16} strokeWidth={2} />}
        Compare target to forecast
      </button>
      </div>

      <p className="te-form-foot">
        <span>Runs on the fly - nothing is saved.</span>
        <span>
          {splitMethod === 'seasonal'
            ? 'Seasonal split: each month carries its share of past production, so wet months are judged fairly.'
            : 'Even split: the annual target is divided into twelve equal monthly shares.'}
        </span>
      </p>
    </>
  );
}
