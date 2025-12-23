import { useRef, useCallback, useLayoutEffect, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Email, EmailThread } from '../types';
import { ThreadView } from './ThreadView';

interface VirtualThreadListProps {
  threads: EmailThread[];
  onEmailClick: (email: Email) => void;
  estimateSize?: number;
  overscan?: number;
}

// Find the scrollable parent element (the main content area)
function findScrollParent(element: HTMLElement | null): HTMLElement | null {
  if (!element) return null;
  
  let parent = element.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return document.documentElement;
}

export function VirtualThreadList({
  threads,
  onEmailClick,
  estimateSize = 150, // Threads are taller than emails
  overscan = 5,
}: VirtualThreadListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Find the scrollable parent on mount and calculate scroll margin
  useLayoutEffect(() => {
    if (containerRef.current) {
      const parent = findScrollParent(containerRef.current);
      setScrollElement(parent);
      
      if (parent) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const scrollRect = parent.getBoundingClientRect();
        setScrollMargin(containerRect.top - scrollRect.top + parent.scrollTop);
      }
    }
  }, []);

  const handleEmailClick = useCallback(
    (email: Email) => {
      onEmailClick(email);
    },
    [onEmailClick]
  );

  if (threads.length === 0) {
    return null;
  }

  return (
    <div ref={containerRef}>
      {scrollElement ? (
        <VirtualizedThreadContent
          threads={threads}
          scrollElement={scrollElement}
          scrollMargin={scrollMargin}
          estimateSize={estimateSize}
          overscan={overscan}
          onEmailClick={handleEmailClick}
        />
      ) : (
        // Placeholder while finding scroll element - prevents layout shift
        <div style={{ height: threads.length * estimateSize }} />
      )}
    </div>
  );
}

// Separate component to ensure virtualizer is initialized with correct scroll element
function VirtualizedThreadContent({
  threads,
  scrollElement,
  scrollMargin,
  estimateSize,
  overscan,
  onEmailClick,
}: {
  threads: EmailThread[];
  scrollElement: HTMLElement;
  scrollMargin: number;
  estimateSize: number;
  overscan: number;
  onEmailClick: (email: Email) => void;
}) {
  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        width: '100%',
        position: 'relative',
      }}
    >
      {items.map((virtualItem) => {
        const thread = threads[virtualItem.index];
        return (
          <div
            key={thread.id}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              // Subtract scrollMargin since our container is already positioned correctly
              transform: `translateY(${virtualItem.start - scrollMargin}px)`,
            }}
          >
            <div className="pb-3">
              <ThreadView
                thread={thread}
                onEmailClick={onEmailClick}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
