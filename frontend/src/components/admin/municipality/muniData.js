// WHAT: The formatting and normalisation primitives for the Municipality
//       Analytics section.
// WHY: one place for the number formats and the field names, so the cards,
//      charts and table always speak the same language.

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
  const n = Number(value);
  if (value === null || value === undefined || !Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
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
