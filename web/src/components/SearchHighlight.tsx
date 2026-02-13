import { useMemo } from 'react';

interface SearchHighlightProps {
  text: string;
  searchTerms: string[];
  className?: string;
}

const MAX_TERMS = 10;
const MAX_TERM_LENGTH = 100;

/**
 * Component to highlight search terms within text
 */
export function SearchHighlight({ text, searchTerms, className = '' }: SearchHighlightProps) {
  const highlightedText = useMemo(() => {
    if (!text || searchTerms.length === 0) {
      return text;
    }

    // Filter out empty terms and apply length/count limits
    const terms = searchTerms
      .filter((t) => t.trim().length > 0)
      .slice(0, MAX_TERMS)
      .map(t => t.length > MAX_TERM_LENGTH ? t.slice(0, MAX_TERM_LENGTH) : t);
    if (terms.length === 0) {
      return text;
    }

    // Create regex pattern for all terms
    const escapedTerms = terms.map((term) => 
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const pattern = new RegExp(`(${escapedTerms.join('|')})`, 'gi');

    // Split text by matches and create spans
    const parts = text.split(pattern);

    return parts.map((part, index) => {
      const isMatch = terms.some(
        (term) => part.toLowerCase() === term.toLowerCase()
      );

      if (isMatch) {
        return (
          <mark
            key={index}
            className="bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 rounded px-0.5"
          >
            {part}
          </mark>
        );
      }

      return <span key={index}>{part}</span>;
    });
  }, [text, searchTerms]);

  return <span className={className}>{highlightedText}</span>;
}

/**
 * Simple text highlighting without React component
 */
export function highlightText(text: string, searchTerms: string[]): string {
  if (!text || searchTerms.length === 0) {
    return text;
  }

  const terms = searchTerms
    .filter((t) => t.trim().length > 0)
    .slice(0, MAX_TERMS)
    .map(t => t.length > MAX_TERM_LENGTH ? t.slice(0, MAX_TERM_LENGTH) : t);
  if (terms.length === 0) {
    return text;
  }

  let result = text;
  for (const term of terms) {
    const regex = new RegExp(
      `(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      'gi'
    );
    result = result.replace(
      regex,
      '<mark class="bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100 rounded px-0.5">$1</mark>'
    );
  }

  return result;
}

