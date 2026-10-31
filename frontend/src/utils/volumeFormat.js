// WHAT: Isa (parameterized) na formatter para sa Metric Tons (MT) values na
//       ginagamit ng buong front-end.
// WHY: Isa lamang ang MT formatting logic para hindi magkaka-conflict ang
//      mga display. Bawat tawag ay nagpapasya sa decimals, unit, empty
//      sentinel, at locale para matiyak na pareho ang output bawat pag-format.
export function fmtMT(value, {
  decimals = 2,
  unit = false,
  empty = '—',
  minDecimals = 0,
  locale,
} = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return unit ? `${empty} Metric Tons (MT)` : empty;
  const text = n.toLocaleString(locale, { minimumFractionDigits: minDecimals, maximumFractionDigits: decimals });
  return unit ? `${text} Metric Tons (MT)` : text;
}

/* WHAT: Dating 3-decimal MT formatter (walang unit). Pinanatiling kompatibleng
   sa mga component na nananatiling naka-import nito. */
export const formatMT = (v) => fmtMT(v, { decimals: 3 });

/* WHAT: Dating 3-decimal MT formatter na may "Metric Tons (MT)" unit. */
export const formatMTWithUnit = (v) => fmtMT(v, { decimals: 3, unit: true });
