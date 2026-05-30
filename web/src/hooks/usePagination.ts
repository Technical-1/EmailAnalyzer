import { useMemo, useState } from 'react';

/**
 * Client-side pagination over an in-memory array.
 *
 * The whole app keeps its data in the Zustand store, so list pages paginate a
 * plain array rather than querying IndexedDB per page. This hook owns the page
 * state and derives the current slice. When the source list shrinks below the
 * current page (e.g. a filter narrows the results) the returned `currentPage`
 * is clamped to the last valid page, so the user never lands on an empty page
 * without us writing derived state back into React (see "You Might Not Need an
 * Effect").
 */
export function usePagination<T>(items: T[], pageSize: number) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  // Derived, not stored: the effective page can never exceed totalPages.
  const safePage = Math.min(currentPage, totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, items.length);

  return {
    currentPage: safePage,
    setCurrentPage,
    totalPages,
    pageItems,
    rangeStart,
    rangeEnd,
    totalItems: items.length,
  };
}
