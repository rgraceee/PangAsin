// WHAT: The formatting and normalisation primitives for the Municipality
//       Analytics section.
// WHY: one place for the number formats and the field names, so the cards,
//      charts and table always speak the same language.

import { fmtMT as sharedFmtMT } from '../../../utils/volumeFormat';

export const METHOD_LABELS = {
  solar: 'Solar Evaporation',
  cooked: 'Cooked / Boiled',
  hybrid: 'Hybrid',
};

export const METHOD_COLORS = {
  solar: 'var(--muni-gold)',
  cooked: 'var(--muni-ocean)',
  hybrid: 'var(--muni-green)',
};

export const AGE_BANDS = ['18-30', '31-40', '41-50', '51-60', '61+'];

export const SEX_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

export const SEX_COLORS = {
  male: 'var(--muni-ocean)',
  female: 'var(--muni-green)',
  other: 'var(--muni-soft-slate)',
};

/* A slice below this is noise from a handful of records - showing it as
   "0 Metric Tons (MT) / 0.0%" reads like a broken chart. */
export const MIN_SLICE_MT = 0.5;

export function fmtInt(value) {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function fmtMT(value, decimals = 0) {
  if (value === null || value === undefined) return '—';
  return sharedFmtMT(value, { decimals, empty: '—', locale: 'en-US' });
}

export function fmtPct(value) {
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
}

/* A "nice" axis for a count axis: round the maximum up so the ticks land on
   readable numbers instead of 65 / 130 / 195. */
export function niceTicks(max, target = 4) {
  const value = Math.max(1, Number(max) || 1);
  const raw = value / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || mag * 10;
  const top = Math.ceil(value / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { domain: [0, top], ticks };
}

/* The municipalities in scope: the selected one, or all of them. */
export function scopeRows(rows, selectedMuni) {
  if (!selectedMuni) return rows;
  return rows.filter((r) => r.name === selectedMuni);
}

/* Normalise the three API lists so they all speak the same field names. */
export function normaliseProduction(rows) {
  return (rows || []).map((m) => ({
    id: m.municipality_id,
    name: m.municipality_name,
    volumeMT: m.total_volume_mt || 0,
    beds: m.total_salt_beds || 0,
    area: m.total_area_sqm || 0,
    records: m.record_count || 0,
    productionMonths: m.production_month_count || 0,
  }));
}

export function normaliseMasterList(rows) {
  return (rows || []).map((m) => ({
    id: m.municipality_id,
    name: m.municipality_name,
    producers: m.producers || 0,
    age_bands: m.age_bands || {},
    sex: m.sex || {},
  }));
}

export function normaliseMethods(rows) {
  return (rows || []).map((m) => ({
    id: m.municipality_id,
    name: m.municipality_name,
    solar: m.solar || 0,
    cooked: m.cooked || 0,
    hybrid: m.hybrid || 0,
  }));
}

/* Registered producers per municipality, ranked. The master list is the real
   registry of distinct producers. */
export function buildRegisteredRows(masterList) {
  return masterList
    .map((m) => ({ id: m.id, name: m.name, count: m.producers || 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/* Production method split for the scope, all approved records. */
export function buildMethodRows(methods) {
  const totals = { solar: 0, cooked: 0, hybrid: 0 };
  methods.forEach((m) => {
    totals.solar += m.solar || 0;
    totals.cooked += m.cooked || 0;
    totals.hybrid += m.hybrid || 0;
  });
  const total = totals.solar + totals.cooked + totals.hybrid;
  const rows = Object.keys(totals)
    .filter((key) => totals[key] >= MIN_SLICE_MT)
    .map((key) => ({
      key,
      name: METHOD_LABELS[key],
      value: totals[key],
      color: METHOD_COLORS[key],
      pct: total > 0 ? (totals[key] / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  return { rows, total };
}

/* Age and gender profile from the master list. */
export function buildProfile(masterList) {
  const age = AGE_BANDS.map((band) => ({ name: band, value: 0 }));
  const sex = { male: 0, female: 0, other: 0 };
  let total = 0;
  masterList.forEach((m) => {
    total += m.producers || 0;
    Object.entries(m.age_bands || {}).forEach(([band, value]) => {
      const row = age.find((a) => a.name === band);
      if (row) row.value += value;
    });
    Object.keys(sex).forEach((key) => { sex[key] += (m.sex || {})[key] || 0; });
  });
  return {
    total,
    age: age.map((a) => ({ ...a, pct: total > 0 ? (a.value / total) * 100 : 0 })),
    sex: Object.keys(sex).map((key) => ({
      key,
      name: SEX_LABELS[key],
      value: sex[key],
      color: SEX_COLORS[key],
      pct: total > 0 ? (sex[key] / total) * 100 : 0,
    })),
  };
}

/* The details table rows. */
export function buildTableRows(scope, masterList) {
  const masterById = new Map((masterList || []).map((m) => [m.id, m]));
  return scope.map((m) => ({
    ...m,
    producers: masterById.has(m.id) ? masterById.get(m.id).producers || 0 : 0,
  }));
}
