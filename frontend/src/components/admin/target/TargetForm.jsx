// WHAT: The Target Evaluation inputs (municipality, annual target, horizon,
//       seasonal/even split) and the action button.
// WHY: the page reads better when the form is its own block, and the split
//      toggle has to be explained in one line under it.
import { Card, Form, Spinner } from 'react-bootstrap';
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
    <Card className="te-card te-form mb-3">
      <Card.Body>
        <div className="te-form-grid">
          <div className="te-field">
            <label className="te-label" htmlFor="te-muni">Municipality</label>
            <Form.Select id="te-muni" value={selectedMuni} onChange={(e) => onSelectedMuni(e.target.value)}>
              <option value="all">All Municipalities</option>
              {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Form.Select>
          </div>
          <div className="te-field">
            <label className="te-label" htmlFor="te-target">Annual target (Metric Tons (MT))</label>
            <Form.Control
              id="te-target"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={annualTarget}
              placeholder="e.g. 46000"
              onChange={(e) => onAnnualTarget(e.target.value)}
            />
          </div>
          <div className="te-field">
            <label className="te-label" htmlFor="te-horizon">Forecast horizon (months)</label>
            <Form.Control
              id="te-horizon"
              type="number"
              min="1"
              max="36"
              value={forecastHorizon}
              onChange={(e) => onForecastHorizon(Number(e.target.value))}
            />
          </div>
          <div className="te-field">
            <span className="te-label">Monthly target split</span>
            <div className="te-toggle" role="group" aria-label="Monthly target split">
              {SPLITS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={`te-toggle-btn${splitMethod === s.value ? ' is-active' : ''}`}
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
            className="te-submit"
            onClick={onSubmit}
            disabled={loading || !annualTarget || Number(annualTarget) <= 0}
          >
            {loading ? <Spinner as="span" animation="border" size="sm" /> : <Target size={16} strokeWidth={2} />}
            Compare target to forecast
          </button>
        </div>
        <p className="te-form-hint">
          {splitMethod === 'seasonal'
            ? 'Seasonal split: each month carries its share of past production, so wet months are judged fairly.'
            : 'Even split: the annual target is divided into twelve equal monthly shares.'}
        </p>
      </Card.Body>
    </Card>
  );
}
