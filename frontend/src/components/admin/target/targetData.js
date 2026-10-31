// WHAT: Pure helpers for the Target Evaluation page (month labels, number
//       formatting and the evaluation-year timeline).
// WHY: every number on the page is derived here, so the strip, the charts and
//       the captions can never disagree - and nothing is invented.

import { fmtMT as sharedFmtMT } from '../../../utils/volumeFormat';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthLabel(year, month) {
  return `${MONTH_SHORT[month - 1]} ${year}`;
}

export function fmtMT(value, decimals) {
  const max = decimals === undefined ? 2 : decimals;
  if (value === null || value === undefined) return '\u2014';
  return sharedFmtMT(value, { decimals: max, empty: '\u2014', locale: 'en-US' });
}

export function fmtAxis(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function fmtPct(value) {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '\u2014';
  return `${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

export function fmtSignedMT(value) {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '\u2014';
  const sign = n > 0 ? '+' : n < 0 ? '\u2212' : '';
  return `${sign}${fmtMT(Math.abs(n))}`;
}

/* The 12 months of the evaluation year, with the recorded months, the forecast
   months, the monthly target and the cumulative series. */
export function buildYearTimeline({
  evaluationYear, ytdApproved, forecastLabels, monthlyForecasts,
  forecastLower, forecastUpper, annualTarget, seasonalWeights, splitMethod,
}) {
  const recordedByMonth = new Map((ytdApproved || []).map((r) => [Number(r.month.slice(5, 7)), r.total_mt]));
  const forecastByMonth = new Map();
  (forecastLabels || []).forEach((label, i) => {
    const m = Number(label.slice(5, 7));
    if (Number(label.slice(0, 4)) !== Number(evaluationYear)) return;
    forecastByMonth.set(m, {
      value: monthlyForecasts?.[i] ?? null,
      lower: forecastLower?.[i] ?? null,
      upper: forecastUpper?.[i] ?? null,
    });
  });

  // The 12 calendar-month shares, index 0 = January. These come from the
  // backend as `seasonal_weights`; `weights` in the response is aligned to the
  // forecast months instead, so it must not be used for a calendar-year path.
  const shareFor = (m) => {
    if (splitMethod === 'seasonal' && Array.isArray(seasonalWeights) && seasonalWeights.length === 12) {
      const w = seasonalWeights[m - 1];
      return Number.isFinite(w) ? w : 1 / 12;
    }
    return 1 / 12;
  };

  const rows = [];
  let cumRecorded = 0;
  let cumForecast = 0;
  let cumTarget = 0;
  let cumLower = 0;
  let cumUpper = 0;
  for (let m = 1; m <= 12; m += 1) {
    const recorded = recordedByMonth.has(m) ? recordedByMonth.get(m) : null;
    const fc = forecastByMonth.get(m) || null;
    const target = (Number(annualTarget) || 0) * shareFor(m);
    if (recorded !== null) cumRecorded += recorded;
    if (fc && fc.value !== null) {
      cumForecast += fc.value;
      if (fc.lower !== null) cumLower += fc.lower;
      if (fc.upper !== null) cumUpper += fc.upper;
    }
    cumTarget += target;
    rows.push({
      month: m,
      label: monthLabel(evaluationYear, m),
      shortLabel: MONTH_SHORT[m - 1],
      recorded,
      forecast: fc ? fc.value : null,
      value: recorded !== null ? recorded : (fc ? fc.value : null),
      lower: fc ? fc.lower : null,
      upper: fc ? fc.upper : null,
      target,
      gap: ((recorded !== null ? recorded : (fc ? fc.value : 0)) || 0) - target,
      isRecorded: recorded !== null,
      isForecast: Boolean(fc && fc.value !== null),
      cumRecorded,
      cumForecast,
      cumTarget,
      cumLower: fc && fc.lower !== null ? cumRecorded + cumLower : null,
      cumUpper: fc && fc.upper !== null ? cumRecorded + cumUpper : null,
      cumTotal: cumRecorded + cumForecast,
    });
  }
  return rows;
}
