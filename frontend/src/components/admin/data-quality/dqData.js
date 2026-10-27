// WHAT: Small helpers for the Data Quality page - month names, cell wording and
//       the plain-language sentences shown to the admin.
// WHY: The page must speak plain words ("No record submitted"), and every number
//      it shows comes from the API - never from a constant in the browser.

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const STATE_TEXT = {
  reported: 'Approved record submitted',
  pending: 'Submitted, waiting for review',
  current: 'Month still in progress',
  missing: 'No record submitted',
};

export const STATE_LEGEND = [
  { state: 'reported', label: 'Reported' },
  { state: 'pending', label: 'Waiting for review' },
  { state: 'missing', label: 'No record submitted' },
  { state: 'current', label: 'Month in progress' },
];

export function formatMonth(key) {
  const [year, month] = String(key).split('-');
  const name = MONTH_NAMES[Number(month) - 1] || key;
  return `${name} ${year}`;
}

export function monthShortLabel(key) {
  return MONTH_NAMES[Number(String(key).slice(5, 7)) - 1] || '';
}

export function formatTimestamp(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/* WHAT: The tone of a score, using the thresholds the API sent.
   WHY: The browser must not carry its own cut-offs; the API is the only
        place that decides what "ok" means. */
export function toneForScore(score, thresholds) {
  if (!thresholds) return 'ok';
  if (score >= thresholds.ok) return 'ok';
  if (score >= thresholds.watch) return 'watch';
  return 'critical';
}

export function toneForPercent(pct, thresholds) {
  return toneForScore(pct, thresholds);
}

export function cellTitle(name, month, state) {
  return `${name}, ${formatMonth(month)}: ${STATE_TEXT[state] || state}`;
}

export function statusWord(status) {
  if (status === 'critical') return 'Needs urgent attention';
  if (status === 'watch') return 'Needs attention';
  return 'On track';
}
