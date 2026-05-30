import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../../hooks/usePagination';

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('usePagination', () => {
  it('slices the first page and reports the visible range', () => {
    const { result } = renderHook(() => usePagination(range(120), 50));

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.totalItems).toBe(120);
    expect(result.current.pageItems).toEqual(range(50));
    expect(result.current.rangeStart).toBe(1);
    expect(result.current.rangeEnd).toBe(50);
  });

  it('slices a middle page and a short final page', () => {
    const { result } = renderHook(() => usePagination(range(120), 50));

    act(() => result.current.setCurrentPage(3));

    expect(result.current.pageItems).toEqual([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120]);
    expect(result.current.rangeStart).toBe(101);
    expect(result.current.rangeEnd).toBe(120);
  });

  it('reports a single page (and renders no pagination) when items fit on one page', () => {
    const { result } = renderHook(() => usePagination(range(10), 50));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual(range(10));
  });

  it('handles an empty list without producing a negative range', () => {
    const { result } = renderHook(() => usePagination<number>([], 50));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageItems).toEqual([]);
    expect(result.current.rangeStart).toBe(0);
    expect(result.current.rangeEnd).toBe(0);
  });

  it('clamps back to page 1 when the list shrinks below the current page', () => {
    const { result, rerender } = renderHook(
      ({ items }: { items: number[] }) => usePagination(items, 50),
      { initialProps: { items: range(120) } }
    );

    act(() => result.current.setCurrentPage(3));
    expect(result.current.currentPage).toBe(3);

    // List shrinks to a single page (e.g. a filter narrows results).
    rerender({ items: range(10) });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageItems).toEqual(range(10));
  });
});
