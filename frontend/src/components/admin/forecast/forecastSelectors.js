// WHAT: Pure selectors that turn API payloads into the exact rows the
//       Forecasting page renders.
// WHY: keeps the component files small and guarantees the KPI, the charts and
//       the captions all read the same numbers.
import {
  shiftMonth, monthShort, monthNumber, computeReadiness,
  directionFromPct, fmtPctSigned, MONTH_SHORT,
} from './forecastData';

/* Complete monthly index for the plotted history. Missing months stay null
   (they are never coerced to zero production). */
export function buildHistoryRows(monthlySeries, recordedWindow) {
  const byMonth = new Map((monthlySeries || []).map((m) => [m.month, m.total_mt]));
  const labels = [...byMonth.keys()].sort();
  if (labels.length === 0) return [];
  const first = labels[0];
  const last = labels[labels.length - 1];
  let start = first;
  if (recordedWindow !== 'all') {
    const wanted = shiftMonth(last, -(Number(recordedWindow) - 1));
    if (wanted > first) start = wanted;
  }
  const rows = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= last && guard < 400) {
    rows.push({
      label: cursor,
      labelShort: monthShort(cursor),
      historical: byMonth.has(cursor) ? byMonth.get(cursor) : null,
    });
    cursor = shiftMonth(cursor, 1);
    guard += 1;
  }
  return rows;
}

/* History + forecast on one continuous monthly axis. */
export function buildTimeline(historyRows, forecastPoints) {
  const map = new Map();
  historyRows.forEach((h) => {
    map.set(h.label, { ...h, forecast: null, lower: null, upper: null, band: null });
  });
  forecastPoints.forEach((p) => {
    const lower = p.lower_bound === undefined ? null : p.lower_bound;
    const upper = p.upper_bound === undefined ? null : p.upper_bound;
    const base = map.get(p.period_label) || {
      label: p.period_label, labelShort: monthShort(p.period_label), historical: null,
    };
    map.set(p.period_label, {
      ...base,
      forecast: p.predicted_value === undefined ? null : p.predicted_value,
      lower,
      upper,
      band: lower !== null && upper !== null ? Math.max(0, upper - lower) : null,
    });
  });
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/* One row per municipality, shared by both municipality panels so the order,
   the axis labels and the values always line up. */
export function buildMunicipalityRows(outlook, trends) {
  const trendByName = new Map((trends?.municipalities || []).map((m) => [m.name, m]));
  const rows = (outlook || []).map((o) => {
    const t = trendByName.get(o.municipality_name);
    const hasChange = o.expected_change_pct !== null && o.expected_change_pct !== undefined;
    const hasYoy = Boolean(t && t.status === 'complete' && t.changePct !== null && t.changePct !== undefined);
    return {
      id: o.municipality_id,
      name: o.municipality_name,
      change: hasChange ? o.expected_change_pct : null,
      changeStatus: hasChange ? 'ok' : 'nodata',
      yoy: hasYoy ? t.changePct : null,
      yoyStatus: hasYoy ? 'ok' : 'incomplete',
      reliability: o.reliability,
      readiness: o.readiness,
    };
  });
  rows.sort((a, b) => {
    const aHas = a.change !== null;
    const bHas = b.change !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && b.change !== a.change) return b.change - a.change;
    return a.name.localeCompare(b.name);
  });
  return rows;
}

/* Municipalities that need a decision, with the reason for each.
   WHAT: severity score + proportional bar, sorted worst first.
   WHY: a flat list hides which place needs the decision now. */
export function buildNeedsAttention(rows) {
  const items = rows
    .filter((r) => directionFromPct(r.change) === 'declining' || r.reliability === 'low' || r.change === null)
    .map((r) => {
      const reasons = [];
      const declining = directionFromPct(r.change) === 'declining';
      const low = r.reliability === 'low';
      const nodata = r.change === null;
      if (declining) reasons.push({ label: 'Declining forecast', tone: 'declining' });
      if (low) reasons.push({ label: 'Low confidence', tone: 'low' });
      if (nodata) reasons.push({ label: 'Not enough data', tone: 'nodata' });
      return {
        id: r.id,
        name: r.name,
        change: r.change,
        value: r.change === null ? '\u2014' : fmtPctSigned(r.change),
        severity: (declining ? 3 : 0) + (low ? 2 : 0) + (nodata ? 1 : 0),
        reasons,
      };
    });

  const maxAbs = Math.max(...items.map((i) => Math.abs(Number(i.change) || 0)), 1);
  items.sort((a, b) => (
    b.severity - a.severity
    || (Number(a.change) || 0) - (Number(b.change) || 0)
    || a.name.localeCompare(b.name)
  ));

  return items.map((item) => ({
    ...item,
    barPct: item.change === null
      ? 100
      : Math.max(6, Math.round((Math.abs(Number(item.change)) / maxAbs) * 100)),
  }));
}

/* 12 calendar months; months without source rows stay empty. */
export function buildSeasonalSeries(seasonalPattern) {
  const byMonth = new Map((seasonalPattern || []).map((s) => [s.month, s.avg_mt]));
  const out = [];
  for (let m = 1; m <= 12; m += 1) {
    out.push({
      month: m,
      label: MONTH_SHORT[m - 1],
      value: byMonth.has(m) ? byMonth.get(m) : null,
    });
  }
  return out;
}

/* Data-quality notice: shown only when the recorded totals really did drop.
   Never hides or changes a number - it only explains the gap. */
export function buildDataNotice(trends, selectedMuni, outlook) {
  if (trends?.data_source === 'municipality_production') return null;
  const trendRows = trends?.municipalities || [];
  let current = null;
  let previous = null;
  let scopeName = 'Pangasinan';
  if (selectedMuni === 'all') {
    current = trends?.totals?.current ?? null;
    previous = trends?.totals?.previous ?? null;
  } else {
    const row = trendRows.find((m) => String(m.municipality_id) === String(selectedMuni));
    current = row ? row.current : null;
    previous = row ? row.previous : null;
    const o = (outlook || []).find((x) => String(x.municipality_id) === String(selectedMuni));
    scopeName = o ? o.municipality_name : 'this municipality';
  }
  if (current === null || previous === null || previous <= 0) return null;
  const ratio = current / previous;
  const complete = trendRows.filter((m) => m.status === 'complete' && m.changePct !== null);
  const heavyDrops = complete.filter((m) => m.changePct < -50);
  const mostDropped = complete.length > 0 && heavyDrops.length > complete.length / 2;
  const bigDrop = ratio < 0.5;
  if (!bigDrop && !mostDropped) return null;
  return {
    current,
    previous,
    ratioPct: Math.round(ratio * 100),
    scopeName,
    droppedCount: heavyDrops.length,
    totalCount: complete.length,
  };
}

export { computeReadiness, monthNumber };
