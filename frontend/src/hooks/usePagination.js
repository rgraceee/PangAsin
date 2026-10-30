// WHAT: Shared pagination state for tables that already hold their full rows
//       (users, municipalities, barangay summaries).
// WHY: One rule for page clamping and reset, so every table behaves the same
//      when a filter shrinks the list, the page size changes, or a new filter
//      is applied. Server-paginated tables use the same numbers, but they keep
//      `page` themselves because the server owns the page.
import { useCallback, useEffect, useState } from 'react';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function usePagination({ total = 0, initialPerPage = 10, resetKey = '' } = {}) {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);

  const pages = Math.max(1, Math.ceil((Number(total) || 0) / perPage));
  const safePage = Math.min(page, pages);
  const pageStart = (safePage - 1) * perPage;

  // WHAT: A filter change always returns to the first page.
  // WHY: staying on page 7 of a list that now has two pages shows nothing.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // WHAT: Keep the page inside the new range after a reload.
  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), pages));
  }, [pages]);

  const goToPage = useCallback((next) => {
    setPage(Math.min(Math.max(1, Number(next) || 1), pages));
  }, [pages]);

  const changePerPage = useCallback((next) => {
    const value = Number(next);
    setPerPage(PAGE_SIZE_OPTIONS.includes(value) ? value : initialPerPage);
    setPage(1);
  }, [initialPerPage]);

  return { page: safePage, perPage, pages, pageStart, goToPage, changePerPage };
}
