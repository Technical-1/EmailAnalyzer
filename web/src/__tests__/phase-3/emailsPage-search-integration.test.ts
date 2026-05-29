import { describe, it, expect } from 'vitest';
import { parseSearchQuery, filterEmails } from '../../services/searchParser';
import type { Email } from '../../types';

// Mirrors the helper in searchParser.test.ts so fixtures stay self-contained.
const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Test Subject',
  sender: 'sender@example.com',
  recipients: ['recipient@example.com'],
  date: new Date('2024-06-15'),
  body: 'Test body content',
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

// The exact integration EmailsPage will perform: parse the search box string,
// then apply it to the in-memory email list.
const applySearch = (emails: Email[], query: string): Email[] =>
  filterEmails(emails, parseSearchQuery(query));

describe('EmailsPage search integration (parse + apply)', () => {
  const emails: Email[] = [
    createMockEmail({ id: 1, sender: 'bob@x.com', subject: 'Lunch plans', body: 'see you at noon', isRead: false }),
    createMockEmail({ id: 2, sender: 'alice@x.com', subject: 'Invoice #42', body: 'payment due', isRead: true, emailType: 'purchase' }),
    createMockEmail({ id: 3, sender: 'newsletter@news.com', subject: 'Weekly digest', body: 'top stories', isRead: false }),
  ];

  it('from: matches only the matching sender', () => {
    const result = applySearch(emails, 'from:bob@x.com');
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('is:unread matches only unread emails', () => {
    const result = applySearch(emails, 'is:unread');
    expect(result.map(e => e.id).sort()).toEqual([1, 3]);
  });

  it('subject: with quotes matches the full phrase', () => {
    const result = applySearch(emails, 'subject:"Invoice #42"');
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('type:purchase matches only purchase emails', () => {
    const result = applySearch(emails, 'type:purchase');
    expect(result.map(e => e.id)).toEqual([2]);
  });

  it('combined operators are ANDed together', () => {
    const result = applySearch(emails, 'from:x.com is:unread');
    expect(result.map(e => e.id).sort()).toEqual([1]);
  });

  it('plain free text still matches subject', () => {
    const result = applySearch(emails, 'Lunch');
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('plain free text still matches sender', () => {
    const result = applySearch(emails, 'newsletter@news.com');
    expect(result.map(e => e.id)).toEqual([3]);
  });

  it('plain free text still matches body', () => {
    const result = applySearch(emails, 'top stories');
    expect(result.map(e => e.id)).toEqual([3]);
  });

  it('a free-text URL does not act as an operator and matches nothing here', () => {
    // None of the fixtures contain this URL; it must be treated as free text,
    // not as a "https:" operator that would error or match everything.
    const result = applySearch(emails, 'https://unmatched.example.com');
    expect(result).toHaveLength(0);
  });

  it('empty query returns all emails', () => {
    const result = applySearch(emails, '');
    expect(result.map(e => e.id).sort()).toEqual([1, 2, 3]);
  });
});
