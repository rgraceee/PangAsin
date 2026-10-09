// WHAT: I-format ang isang MT volume value para sa display (3 decimal).
// WHY: Ang storage ay hanggang 5 decimal (Numeric(...,5)) para eksakto ang
//      kg->MT conversion; 3 decimal lang ang ipapakita sa UI.
export function formatMT(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return (Math.round(n * 1000) / 1000).toLocaleString();
}
