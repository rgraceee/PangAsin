// WHAT: The status thresholds, the required pace and the headline summary
//       numbers for the Target Evaluation page.
// WHY: these three are the answer to "will we reach it?", so they live
//       together and are derived from the same rows the charts draw.

/* On track / At risk / Off track, from the share of the target reached. */
export function statusFor(pct) {
  if (pct === null || pct === undefined || !Number.isFinite(Number(pct))) {
    return { key: 'unknown', label: 'No forecast' };
  }
  if (pct >= 90) return { key: 'ontrack', label: 'On track' };
  if (pct >= 70) return { key: 'atrisk', label: 'At risk' };
  return { key: 'offtrack', label: 'Off track' };
}

/* The "required pace": what each remaining month must produce to still reach
   the annual target. It can explode when recorded production is very low, so
   the caller caps it for drawing. */
export function addRequiredPace(rows, annualTarget) {
  const target = Number(annualTarget) || 0;
  const forecastMonths = rows.filter((r) => r.isForecast);
  return rows.map((row) => {
    if (!row.isForecast) return { ...row, requiredPace: null };
    const idx = forecastMonths.indexOf(row);
    const previousCum = idx === 0
      ? (rows.filter((r) => r.isRecorded).slice(-1)[0]?.cumRecorded ?? 0)
      : forecastMonths[idx - 1].cumTotal;
    const remaining = forecastMonths.length - idx;
    const needed = target - previousCum;
    return { ...row, requiredPace: remaining > 0 ? needed / remaining : null };
  });
}

/* Headline numbers for the summary strip. */
export function buildSummary({ rows, annualTarget, target }) {
  const recordedTotal = rows.filter((r) => r.isRecorded).reduce((s, r) => s + r.recorded, 0);
  const forecastTotal = rows.filter((r) => r.isForecast).reduce((s, r) => s + (r.forecast || 0), 0);
  const projected = recordedTotal + forecastTotal;
  const pct = target > 0 ? (projected / target) * 100 : null;
  const lowerRows = rows.filter((r) => r.isForecast && r.lower !== null);
  const upperRows = rows.filter((r) => r.isForecast && r.upper !== null);
  return {
    annualTarget,
    recordedTotal,
    forecastTotal,
    projected,
    pct,
    gap: projected - target,
    status: statusFor(pct),
    rangeLow: lowerRows.length ? recordedTotal + lowerRows.reduce((s, r) => s + r.lower, 0) : null,
    rangeHigh: upperRows.length ? recordedTotal + upperRows.reduce((s, r) => s + r.upper, 0) : null,
    reachedMonth: (() => {
      const hit = rows.find((r) => r.cumTotal >= target && r.cumTarget > 0);
      return hit ? hit.label : null;
    })(),
  };
}

/* Headline numbers for current approved supply plus the selected horizon. */
export function buildProjectionSummary({ rows, annualTarget }) {
  const recordedTotal = rows.find((row) => row.isRecorded)?.cumTotal ?? 0;
  const forecastRows = rows.filter((row) => row.isForecast);
  const forecastTotal = forecastRows.reduce((sum, row) => sum + (row.forecast || 0), 0);
  const projected = recordedTotal + forecastTotal;
  const target = Number(annualTarget) || 0;
  const pct = target > 0 ? (projected / target) * 100 : null;
  const lowerRows = forecastRows.filter((row) => row.lower !== null && row.lower !== undefined);
  const upperRows = forecastRows.filter((row) => row.upper !== null && row.upper !== undefined);

  return {
    annualTarget: target,
    recordedTotal,
    forecastTotal,
    projected,
    pct,
    gap: projected - target,
    status: statusFor(pct),
    rangeLow: lowerRows.length
      ? recordedTotal + lowerRows.reduce((sum, row) => sum + row.lower, 0)
      : null,
    rangeHigh: upperRows.length
      ? recordedTotal + upperRows.reduce((sum, row) => sum + row.upper, 0)
      : null,
    reachedMonth: rows.find((row) => row.cumTotal >= target && target > 0)?.label ?? null,
  };
}
