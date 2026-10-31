// WHAT: Pure helpers shared by the Forecasting page (month maths, formatting,
//       readiness, axis ticks). No React, no data fetching.
// WHY: one place for every number/label rule so the charts, KPIs and captions
//      can never disagree with each other.

import { fmtMT as sharedFmtMT } from '../../../utils/volumeFormat';

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function shiftMonth(ym, delta) {
  if (!ym) return null;
  let y = parseInt(ym.slice(0, 4), 10);
  let m = parseInt(ym.slice(5, 7), 10) + delta;
  while (m > 12) { m -= 12; y += 1; }
  while (m < 1) { m += 12; y -= 1; }
  return `${y}-${String(m).padStart(2, '0')}`;
}

/* Month labels: "Jan 26" on axes, "January 2026" in prose. */
export function monthShort(ym) {
  if (!ym || ym.length < 7) return '\u2014';
  const m = parseInt(ym.slice(5, 7), 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return '\u2014';
  return `${MONTH_SHORT[m - 1]} ${ym.slice(2, 4)}`;
}

export function monthLong(ym) {
  if (!ym || ym.length < 7) return '\u2014';
  const m = parseInt(ym.slice(5, 7), 10);
  if (!Number.isFinite(m) || m < 1 || m > 12) return '\u2014';
  return `${MONTH_LONG[m - 1]} ${ym.slice(0, 4)}`;
}

export function monthNumber(ym) {
  if (!ym) return null;
  const m = parseInt(ym.slice(5, 7), 10);
  return Number.isFinite(m) && m >= 1 && m <= 12 ? m : null;
}

/* Number formatting: thousands separators, max 2 decimals for Metric Tons (MT), 1 for %. */
export function fmtMT(value) {
  if (value === null || value === undefined) return '\u2014';
  return sharedFmtMT(value, { decimals: 2, empty: '\u2014', locale: 'en-US' });
}

export function fmtPctSigned(value) {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '\u2014';
  const sign = n > 0 ? '+' : n < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(n).toFixed(1)}%`;
}

/* Direction thresholds match the backend (_trend_direction): >2% up, <-2% down. */
export function directionFromPct(changePct) {
  if (changePct === null || changePct === undefined || !Number.isFinite(Number(changePct))) return 'stable';
  const n = Number(changePct);
  if (n > 2) return 'increasing';
  if (n < -2) return 'declining';
  return 'stable';
}

/* Readiness: 24+ months AND at least 70% of active municipalities with data
   -> Ready; 12+ -> Limited. Proportional so adding/deactivating municipalities
   does not require a new hard-coded ratio. */
export function computeReadiness(history, scopeId) {
  const h = history || {};
  const total = h.municipalities_total || 0;
  const withData = h.municipalities_with_data || 0;
  const monthsByMuni = h.municipality_months || {};
  if (scopeId === 'all') {
    const months = h.months_with_data || 0;
    const coverage = total > 0 ? withData / total : 0;
    const level = months >= 24 && coverage >= 0.7 ? 'ready' : months >= 12 ? 'limited' : 'not_ready';
    return { level, months, withData, total };
  }
  const months = monthsByMuni[String(scopeId)] || 0;
  const level = months >= 24 ? 'ready' : months >= 12 ? 'limited' : 'not_ready';
  return { level, months, withData, total };
}

export const READINESS_LABEL = {
  ready: 'Ready',
  limited: 'Limited',
  not_ready: 'Not enough data',
};

/* Axis ticks rounded to a "nice" step that fits the data (never -15..+45). */
export function niceScale(min, max, targetTicks = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { domain: [0, 1], ticks: [0, 1] };
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  const span = hi - lo || 1;
  const rawStep = span / Math.max(1, targetTicks);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag);
  let step = candidates[candidates.length - 1];
  for (const candidate of candidates) {
    const dlo = Math.floor(lo / candidate) * candidate;
    const dhi = Math.ceil(hi / candidate) * candidate;
    const count = Math.round((dhi - dlo) / candidate) + 1;
    if (count <= targetTicks + 2) { step = candidate; break; }
  }
  const domainLo = Math.floor(lo / step) * step;
  const domainHi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = domainLo; v <= domainHi + step / 2; v += step) {
    ticks.push(Math.round(v * 1000) / 1000);
  }
  return { domain: [domainLo, domainHi], ticks };
}

/* Peak / lowest of a seasonal series (ignores months without data). */
export function seasonalExtremes(series) {
  const withData = (series || []).filter((s) => s.value !== null && s.value !== undefined);
  if (withData.length === 0) return { peak: null, lowest: null };
  const peak = withData.reduce((a, b) => (b.value > a.value ? b : a));
  const lowest = withData.reduce((a, b) => (b.value < a.value ? b : a));
  return { peak, lowest };
}
