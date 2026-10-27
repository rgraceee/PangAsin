// WHAT: Small dismissible banner that appears only when record-based data
//       really did collapse against the previous year.
// WHY: the admin must know that a forecast anchored on older years may not
//       match reality - without hiding or changing any number.
import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { fmtMT } from './forecastData';

export default function ForecastDataNotice({ notice, scopeKey }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDismissed(false); }, [scopeKey]);

  if (!notice || dismissed) return null;

  return (
    <div className="fc-notice" role="status">
      <span className="fc-notice-icon" aria-hidden="true">
        <AlertTriangle size={16} strokeWidth={1.75} />
      </span>
      <p className="fc-notice-text">
        Approved production in the last 12 complete months is {notice.ratioPct}% of the previous 12 months
        ({fmtMT(notice.current)} MT vs {fmtMT(notice.previous)} MT). Forecasts may not reflect actual production
        until records are reviewed.
      </p>
      <button
        type="button"
        className="fc-notice-close"
        aria-label="Dismiss this notice"
        onClick={() => setDismissed(true)}
      >
        <X size={15} strokeWidth={1.75} />
      </button>
    </div>
  );
}
