// WHAT: Public-dashboard chart helpers — number formatting, the categorical
//       colour ramp, and the design-token values the shared chart classes need.
// WHY: The public charts must read exactly like the admin charts, but the admin
//      files must not be touched. The token values below mirror the admin
//      forecast card spec (components/admin/forecast/forecast.css) so the
//      shared `fc-*` classes render correctly here, and every number format
//      used by the public charts is defined in one place.

/* WHAT: Mga halaga na kinopya mula sa admin forecast card spec.
   WHY: '--fc-*' ay scoped sa '.forecast-page' sa admin, kaya kailangan itong
        i-declare dito para magamit ng shared na fc-* classes sa public page. */
export const FC_TOKENS = {
  navy: '#0C2340',
  ocean: '#1565C8',
  gold: '#F09A28',
  green: '#29B039',
  brown: '#574326',
  danger: '#DC2626',
  grid: '#E9ECEF',
  axis: '#8A98A8',
  text: '#111827',
  text2: '#4B5563',
  muted: '#8A94A3',
  border: '#E7EAEF',
  shadow: '0 1px 2px rgba(16, 24, 40, 0.04)',
};

/* WHAT: Ordinal na color ramp para sa "isang kategorya = isang kulay".
   WHY: pareho ang hues na ginagamit sa admin (ocean/gold/green/brown) kaya
        magkasundo ang public at admin charts. Walang pula — pula ay reserved
        para sa problema lamang (shortfall). */
export const CATEGORY_RAMP = [
  FC_TOKENS.ocean,
  FC_TOKENS.gold,
  FC_TOKENS.green,
  FC_TOKENS.brown,
  '#6FA8DC',
  '#F7C16A',
];

/* WHAT: Semantikong kulay bawat barangay/linya ng supply-demand chart.
   WHY: "isang kulay = isang kahulugan" sa buong sistema:
        - gold  = demand at benchmark (ano ang kailangan)
        - ocean = supply mula sa lokal na produksyon
        - brown = import (panlabas na supply) */
export const SUPPLY_COLORS = {
  'National Demand': FC_TOKENS.gold,
  'Domestic Supply': FC_TOKENS.ocean,
  'Imported Salt': FC_TOKENS.brown,
  'Pangasinan Supply': FC_TOKENS.ocean,
  'Demand Benchmark': FC_TOKENS.gold,
};

/* WHAT: Format ng volume (MT) na walang extra decimals.
   WHY: max 2 decimals ang Metric Tons (MT) sa buong dashboard, at may thousands separator. */
export function fmtMT(value, { unit = true } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return unit ? '— Metric Tons (MT)' : '—';
  const text = n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return unit ? `${text} Metric Tons (MT)` : text;
}

/* WHAT: Format ng plain number (walang unit) para sa axis tick at bar label.
   WHY: ang Recharts ay naghahati ng label na may space sa dalawang linya —
        kaya ang axis at bar labels ay space-free (ang unit ay nasa subtitle). */
export function fmtNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}


/* WHAT: Format ng bahagdan (%).
   WHY: iisa na decimal para pareho ang lahat ng percentage sa public page. */
export function fmtPct(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

/* WHAT: Nice ceiling sa multiples (1/1.25/1.5/2/2.5/3/4/5/6/8/10 x 10^n)
   para even ang axis ticks.
   WHY: Ang mas maikling ladder ay kailangan para hindi malaki ang pagkakaiba
        ng bar at ng axis max (e.g. 336,000 -> 400,000, hindi 500,000) —
        kung hindi, mukhang napakaliit ang bar sa plot area. */
export function niceCeil(value) {
  const v = Number(value);
  if (!Number.isFinite(v) || v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const ladder = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const nice = ladder.find((step) => n <= step) ?? 10;
  return nice * pow;
}

/* WHAT: Bahagdan na nakalkula mula sa dalawang Metric Tons (MT) value.
   WHY: parehong formula (numerator / base) para hindi magkasalungat ang
        "coverage" sa KPI card at sa chart caption. */
export function pctOf(numerator, base) {
  const n = Number(numerator);
  const b = Number(base);
  if (!Number.isFinite(n) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round((n / b) * 1000) / 10;
}
