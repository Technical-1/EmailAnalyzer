import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  /** 1-based index of the first item shown (for the "Showing X - Y of Z" label). */
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Noun for the label, e.g. "purchases". Defaults to "results". */
  itemLabel?: string;
  /** Accessible label for the nav landmark. */
  ariaLabel?: string;
}

/**
 * Shared pagination control. Renders a "Showing X - Y of Z" summary plus a
 * windowed set of up to 5 page buttons with prev/next. Renders nothing when
 * there is only a single page. Extracted from the original inline block in
 * EmailsPage so list pages share one implementation.
 */
export function Pagination({
  currentPage,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  onPageChange,
  itemLabel = 'results',
  ariaLabel = 'Pagination',
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-700"
      aria-label={ariaLabel}
    >
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Showing {rangeStart} - {rangeEnd} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label="Previous page"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                aria-label={`Page ${pageNum}`}
                aria-current={currentPage === pageNum ? 'page' : undefined}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === pageNum
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label="Next page"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
