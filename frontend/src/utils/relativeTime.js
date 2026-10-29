// WHAT: Human-friendly timestamps para sa audit trail.
// WHY: Mas mabilis basahin ang "5 min ago" kaysa buong date, pero kailangan
//      pa ring makita ang exact time sa title/absolute line.

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatAbsoluteTime(value) {
  const date = toDate(value);
  if (!date) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(value, now = Date.now()) {
  const date = toDate(value);
  if (!date) return '—';

  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSeconds < 45) return 'just now';
  if (diffSeconds < 90) return '1 min ago';

  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(diffSeconds / 3600);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.round(diffSeconds / 86400);
  if (days < 7) return `${days} d ago`;

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
