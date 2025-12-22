import { useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Email } from '../types';
import { EmailCard } from './EmailCard';

interface VirtualEmailListProps {
  emails: Email[];
  onEmailClick: (email: Email) => void;
  estimateSize?: number;
  overscan?: number;
}

export function VirtualEmailList({
  emails,
  onEmailClick,
  estimateSize = 100,
  overscan = 5,
}: VirtualEmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  const items = virtualizer.getVirtualItems();

  const handleEmailClick = useCallback(
    (email: Email) => {
      onEmailClick(email);
    },
    [onEmailClick]
  );

  if (emails.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className="h-[calc(100vh-300px)] overflow-auto"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const email = emails[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-3">
                <EmailCard
                  email={email}
                  onClick={() => handleEmailClick(email)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// A simpler version that doesn't require a fixed height container
// Uses window scrolling instead
export function VirtualEmailListWindow({
  emails,
  onEmailClick,
  estimateSize = 100,
  overscan = 5,
}: VirtualEmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    measureElement: (element) => {
      return element.getBoundingClientRect().height;
    },
  });

  const items = virtualizer.getVirtualItems();

  const handleEmailClick = useCallback(
    (email: Email) => {
      onEmailClick(email);
    },
    [onEmailClick]
  );

  if (emails.length === 0) {
    return null;
  }

  return (
    <div
      ref={parentRef}
      className="max-h-[calc(100vh-350px)] overflow-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const email = emails[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-3">
                <EmailCard
                  email={email}
                  onClick={() => handleEmailClick(email)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

