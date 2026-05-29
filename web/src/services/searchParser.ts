import type { Email } from '../types';

/**
 * Parsed search query with structured filters
 */
export interface ParsedSearch {
  freeText: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateYear?: number;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  isRead?: boolean;
  type?: 'account_signup' | 'purchase' | 'regular';
  folder?: string;
}

/**
 * Search token types
 */
type TokenType = 
  | 'from' 
  | 'to' 
  | 'subject' 
  | 'body'
  | 'date' 
  | 'before' 
  | 'after'
  | 'has'
  | 'is'
  | 'type'
  | 'in'
  | 'text';

interface SearchToken {
  type: TokenType;
  value: string;
  operator?: '>' | '<' | '=' | ':';
}

/**
 * Parse a search query string into structured filters
 * 
 * Supported syntax:
 * - from:email@example.com
 * - to:recipient@example.com
 * - subject:keyword
 * - body:keyword
 * - date:2024
 * - date:2024-01-15
 * - before:2024-01-01
 * - after:2024-01-01
 * - has:attachment
 * - is:unread
 * - is:starred
 * - is:read
 * - type:purchase
 * - type:account
 * - in:inbox / in:archive / in:trash
 * - Free text for general search
 */
// Limits to prevent ReDoS and performance issues
const MAX_QUERY_LENGTH = 500;
const MAX_TERM_LENGTH = 100;
const MAX_SEARCH_TERMS = 10;

export function parseSearchQuery(query: string): ParsedSearch {
  const result: ParsedSearch = {
    freeText: '',
  };

  if (!query || !query.trim()) {
    return result;
  }

  // Truncate excessively long queries
  if (query.length > MAX_QUERY_LENGTH) {
    query = query.slice(0, MAX_QUERY_LENGTH);
  }

  const tokens = tokenize(query);
  const freeTextParts: string[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'from':
        result.from = token.value.toLowerCase();
        break;
      
      case 'to':
        result.to = token.value.toLowerCase();
        break;
      
      case 'subject':
        result.subject = token.value.toLowerCase();
        break;
      
      case 'body':
        result.body = token.value.toLowerCase();
        break;
      
      case 'date': {
        const dateValue = parseDateValue(token.value);
        if (dateValue.year && !dateValue.month) {
          result.dateYear = dateValue.year;
        } else if (dateValue.date) {
          result.dateFrom = dateValue.date;
          result.dateTo = dateValue.date;
        }
        break;
      }

      case 'before': {
        const beforeDate = parseDateValue(token.value);
        if (beforeDate.date) {
          result.dateTo = beforeDate.date;
        }
        break;
      }

      case 'after': {
        const afterDate = parseDateValue(token.value);
        if (afterDate.date) {
          result.dateFrom = afterDate.date;
        }
        break;
      }

      case 'has':
        if (token.value.toLowerCase() === 'attachment') {
          result.hasAttachment = true;
        }
        break;

      case 'is': {
        const isValue = token.value.toLowerCase();
        if (isValue === 'unread') {
          result.isUnread = true;
        } else if (isValue === 'starred') {
          result.isStarred = true;
        } else if (isValue === 'read') {
          result.isRead = true;
        }
        break;
      }

      case 'type': {
        const typeValue = token.value.toLowerCase();
        if (typeValue === 'purchase') {
          result.type = 'purchase';
        } else if (typeValue === 'account' || typeValue === 'signup') {
          result.type = 'account_signup';
        } else if (typeValue === 'regular') {
          result.type = 'regular';
        }
        break;
      }
      
      case 'in':
        result.folder = token.value.toLowerCase();
        break;
      
      case 'text':
        freeTextParts.push(token.value);
        break;
    }
  }

  result.freeText = freeTextParts.join(' ').trim();
  return result;
}

/**
 * Tokenize a search query string
 */
function tokenize(query: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const operators = ['from:', 'to:', 'subject:', 'body:', 'date:', 'before:', 'after:', 'has:', 'is:', 'type:', 'in:'];
  
  // Match quoted strings and operator:value pairs
  const regex = /(\w+):("([^"]+)"|(\S+))|"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(query)) !== null) {
    if (match[1]) {
      // Operator:value pair
      const operator = match[1].toLowerCase() as TokenType;
      const value = match[3] || match[4]; // Quoted or unquoted value
      
      if (operators.includes(`${operator}:`)) {
        tokens.push({ type: operator, value });
      } else {
        // Unknown operator, treat as text
        tokens.push({ type: 'text', value: match[0] });
      }
    } else {
      // Free text (quoted or unquoted)
      const value = match[5] || match[6];
      tokens.push({ type: 'text', value });
    }
  }

  return tokens;
}

/**
 * Parse a date value from various formats
 */
function parseDateValue(value: string): { date?: Date; year?: number; month?: number } {
  // Check for year only (e.g., "2024")
  if (/^\d{4}$/.test(value)) {
    return { year: parseInt(value) };
  }

  // Check for year-month (e.g., "2024-01")
  if (/^\d{4}-\d{1,2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return { year, month, date: new Date(year, month - 1, 1) };
  }

  // Check for full date (e.g., "2024-01-15")
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { date: new Date(year, month - 1, day), year, month };
  }

  // Try natural date parsing
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return { date: parsed };
  }

  return {};
}

/**
 * Apply parsed search filters to an email list
 */
export function filterEmails(emails: Email[], search: ParsedSearch): Email[] {
  return emails.filter((email) => {
    // Free text search (subject, sender, body)
    if (search.freeText) {
      const searchText = search.freeText.toLowerCase();
      const matchesSubject = email.subject.toLowerCase().includes(searchText);
      const matchesSender = email.sender.toLowerCase().includes(searchText);
      const matchesBody = (email.searchText ?? email.body ?? '').toLowerCase().includes(searchText);
      
      if (!matchesSubject && !matchesSender && !matchesBody) {
        return false;
      }
    }

    // From filter
    if (search.from) {
      if (!email.sender.toLowerCase().includes(search.from)) {
        return false;
      }
    }

    // To filter
    if (search.to) {
      const hasRecipient = email.recipients.some(
        (r) => r.toLowerCase().includes(search.to!)
      );
      if (!hasRecipient) {
        return false;
      }
    }

    // Subject filter
    if (search.subject) {
      if (!email.subject.toLowerCase().includes(search.subject)) {
        return false;
      }
    }

    // Body filter
    if (search.body) {
      if (!(email.searchText ?? email.body ?? '').toLowerCase().includes(search.body)) {
        return false;
      }
    }

    // Date year filter
    if (search.dateYear) {
      const emailYear = new Date(email.date).getFullYear();
      if (emailYear !== search.dateYear) {
        return false;
      }
    }

    // Date range filters
    if (search.dateFrom) {
      const emailDate = new Date(email.date);
      emailDate.setHours(0, 0, 0, 0);
      const fromDate = new Date(search.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (emailDate < fromDate) {
        return false;
      }
    }

    if (search.dateTo) {
      const emailDate = new Date(email.date);
      emailDate.setHours(23, 59, 59, 999);
      const toDate = new Date(search.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (emailDate > toDate) {
        return false;
      }
    }

    // Has attachment filter
    if (search.hasAttachment) {
      if (email.attachments.length === 0) {
        return false;
      }
    }

    // Is unread filter
    if (search.isUnread) {
      if (email.isRead) {
        return false;
      }
    }

    // Is read filter
    if (search.isRead) {
      if (!email.isRead) {
        return false;
      }
    }

    // Is starred filter
    if (search.isStarred) {
      if (!email.isStarred) {
        return false;
      }
    }

    // Type filter
    if (search.type) {
      if (email.emailType !== search.type) {
        return false;
      }
    }

    // Folder filter
    if (search.folder) {
      if (email.folderId !== search.folder) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Highlight search matches in text
 */
export function highlightMatches(text: string, searchTerms: string[]): string {
  if (!text || searchTerms.length === 0) {
    return text;
  }

  // Apply term count and length limits
  const limitedTerms = searchTerms.slice(0, MAX_SEARCH_TERMS);
  let result = text;
  for (const rawTerm of limitedTerms) {
    if (!rawTerm) continue;
    const term = rawTerm.length > MAX_TERM_LENGTH ? rawTerm.slice(0, MAX_TERM_LENGTH) : rawTerm;
    const regex = new RegExp(`(${escapeRegex(term)})`, 'gi');
    result = result.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-700">$1</mark>');
  }

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get search terms for highlighting
 */
export function getSearchTerms(search: ParsedSearch): string[] {
  const terms: string[] = [];

  if (search.freeText) {
    terms.push(...search.freeText.split(' ').filter(Boolean));
  }
  if (search.from) terms.push(search.from);
  if (search.to) terms.push(search.to);
  if (search.subject) terms.push(search.subject);
  if (search.body) terms.push(search.body);

  // Limit term count and length to prevent ReDoS
  return terms
    .slice(0, MAX_SEARCH_TERMS)
    .map(t => t.length > MAX_TERM_LENGTH ? t.slice(0, MAX_TERM_LENGTH) : t);
}

