// WHAT: The pager under a data table — "Showing 1–10 of 241 records" on the
//       left, rows-per-page and numbered pages on the right.
// WHY: The Reports page already paginates with this exact pattern
//      (`report-pagination` / `report-page-btn` in index.css), so it is reused
//      here instead of inventing a second pager. Every table that paginates —
//      server-side or client-side — uses this component, so the control always
//      sits in the same place and reads the same way.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePagination';

/* WHAT: At most five numbered buttons, centred on the current page.
   WHY: A 25-page list must not print 25 buttons; the same window rule as the
        Reports page keeps the control short. */
function pageWindow(page, pages) {
  const first = Math.max(1, Math.min(page - 2, pages - 4));
  const last = Math.min(pages, first + 4);
  const numbers = [];
  for (let n = first; n <= last; n += 1) numbers.push(n);
  return numbers;
}

/* WHAT: Singular form of the item label ("records" -> "record").
   WHY: a one-row table should read "of 1 salt farmer", not "of 1 salt farmer records". */
function singularLabel(label) {
  if (!label) return label;
  if (label.endsWith('ies')) return `${label.slice(0, -3)}y`;
  if (label.endsWith('s')) return label.slice(0, -1);
  return label;
}

export default function TablePagination({
  page = 1,
  pages = 1,
  total = 0,
  perPage = 10,
  onPageChange,
  onPerPageChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  itemLabel = 'records',
  disabled = false,
  className = '',
}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  if (safeTotal === 0) return null;

  const safePages = Math.max(1, Number(pages) || 1);
  const safePage = Math.min(Math.max(1, Number(page) || 1), safePages);
  const start = (safePage - 1) * perPage + 1;
  const end = Math.min(safePage * perPage, safeTotal);
  const numbers = pageWindow(safePage, safePages);
  const label = safeTotal === 1 ? singularLabel(itemLabel) : itemLabel;

  return (
    <div className={`report-pagination ${className}`.trim()}>
      <span className="report-pagination-info" aria-live="polite">
        Showing {start.toLocaleString()}&ndash;{end.toLocaleString()} of {safeTotal.toLocaleString()}
        {' '}{label}
      </span>

      <div className="report-pagination-btns">
        {onPerPageChange && (
          <label className="me-2" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="visually-hidden">Rows per page</span>
            <select
              className="form-select form-select-sm"
              style={{ width: 'auto' }}
              value={perPage}
              onChange={(event) => onPerPageChange(Number(event.target.value))}
              disabled={disabled}
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </label>
        )}

        <button
          type="button"
          className="report-page-btn"
          onClick={() => onPageChange?.(safePage - 1)}
          disabled={disabled || safePage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} aria-hidden="true" />
        </button>

        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            className={`report-page-btn${n === safePage ? ' is-active' : ''}`}
            onClick={() => onPageChange?.(n)}
            disabled={disabled}
            aria-label={`Page ${n}`}
            aria-current={n === safePage ? 'page' : undefined}
          >
            {n}
          </button>
        ))}

        <button
          type="button"
          className="report-page-btn"
          onClick={() => onPageChange?.(safePage + 1)}
          disabled={disabled || safePage >= safePages}
          aria-label="Next page"
        >
          <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
