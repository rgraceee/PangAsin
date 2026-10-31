// WHAT: The data selectors for the Municipality Analytics section.
// WHY: every panel is built from the same three API lists, so the ranking,
//      the shares and the totals are derived in one place.

import {
  AGE_BANDS, SEX_LABELS, SEX_COLORS, MIN_SLICE_MT, METHOD_LABELS, METHOD_COLORS,
} from './muniData';

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
