// WHAT: Pure display formatters for the admin Generate Reports page.
// WHY: Keeping them outside the component makes them reusable and testable.

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function thisMonthRange() {
  const now = new Date();
  return [
    toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    toISODate(now),
  ];
}

export function lastQuarterRange() {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3) - 1;
  const year = now.getFullYear() + Math.floor(quarter / 4);
  const index = ((quarter % 4) + 4) % 4;
  const start = new Date(year, index * 3, 1);
  const end = new Date(year, index * 3 + 3, 0);
  return [toISODate(start), toISODate(end)];
}

export function formatDateRange(start, end) {
  if (!start && !end) return 'All records';
  return [start, end].filter(Boolean).join(' to ');
}

export function formatDateTime(value) {
  if (!value) return '\u2014';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '\u2014';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCell(value) {
  if (value === null || value === undefined || value === '') return '\u2014';
  if (typeof value === 'number') {
    const rounded = Math.round(value * 100) / 100;
    return rounded.toLocaleString();
  }
  return String(value);
}

export function reportScopeLabel(report) {
  if (!report) return '';
  if (report.barangay_name) return `Barangay ${report.barangay_name}`;
  if (report.municipality_name) return `Municipality ${report.municipality_name}`;
  return 'Province-wide';
}

export function formatLabel(format) {
  if (!format) return '\u2014';
  if (format === 'docx') return 'DOCX';
  if (format === 'pdf') return 'PDF';
  return String(format).toUpperCase();
}

export function formatBadgeClass(format) {
  if (format === 'pdf') return 'report-format-badge--pdf';
  if (format === 'docx') return 'report-format-badge--docx';
  return 'report-format-badge--other';
}

// A report "has data" if any of its table sections has rows, or if any of the
// single-number totals is non-zero. Otherwise the filter combination simply
// matched nothing (e.g. no records in that year/barangay).
export function dataHasRows(data) {
  if (!data) return false;
  const sectionKeys = ['municipalities', 'by_municipality', 'by_barangay', 'monthly_trend', 'runs', 'producers', 'environment_reports'];
  if (sectionKeys.some((k) => Array.isArray(data[k]) && data[k].length > 0)) return true;
  const scalarKeys = ['total_production_mt', 'total_registered_producers', 'total_projected'];
  return scalarKeys.some((k) => typeof data[k] === 'number' && data[k] > 0);
}
