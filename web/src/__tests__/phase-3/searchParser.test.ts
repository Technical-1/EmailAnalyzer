import { describe, it, expect } from 'vitest';
import { parseSearchQuery, filterEmails, getSearchTerms } from '../../services/searchParser';
import type { Email } from '../../types';

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

describe('searchParser', () => {
  describe('parseSearchQuery', () => {
    it('should parse from: operator', () => {
      const result = parseSearchQuery('from:amazon@amazon.com');
      expect(result.from).toBe('amazon@amazon.com');
    });

    it('should parse to: operator', () => {
      const result = parseSearchQuery('to:recipient@example.com');
      expect(result.to).toBe('recipient@example.com');
    });

    it('should parse subject: operator', () => {
      const result = parseSearchQuery('subject:order confirmation');
      expect(result.subject).toBe('order');
    });

    it('should parse quoted values', () => {
      const result = parseSearchQuery('subject:"order confirmation"');
      expect(result.subject).toBe('order confirmation');
    });

    it('should parse date: with year only', () => {
      const result = parseSearchQuery('date:2024');
      expect(result.dateYear).toBe(2024);
    });

    it('should parse date: with full date', () => {
      const result = parseSearchQuery('date:2024-01-15');
      expect(result.dateFrom).toEqual(new Date(2024, 0, 15));
    });

    it('should parse before: operator', () => {
      const result = parseSearchQuery('before:2024-06-01');
      expect(result.dateTo).toEqual(new Date(2024, 5, 1));
    });

    it('should parse after: operator', () => {
      const result = parseSearchQuery('after:2024-01-01');
      expect(result.dateFrom).toEqual(new Date(2024, 0, 1));
    });

    it('should parse has:attachment', () => {
      const result = parseSearchQuery('has:attachment');
      expect(result.hasAttachment).toBe(true);
    });

    it('should parse is:unread', () => {
      const result = parseSearchQuery('is:unread');
      expect(result.isUnread).toBe(true);
    });

    it('should parse is:starred', () => {
      const result = parseSearchQuery('is:starred');
      expect(result.isStarred).toBe(true);
    });

    it('should parse type:purchase', () => {
      const result = parseSearchQuery('type:purchase');
      expect(result.type).toBe('purchase');
    });

    it('should parse in:folder', () => {
      const result = parseSearchQuery('in:archive');
      expect(result.folder).toBe('archive');
    });

    it('should combine multiple operators', () => {
      const result = parseSearchQuery('from:amazon subject:order is:unread');
      expect(result.from).toBe('amazon');
      expect(result.subject).toBe('order');
      expect(result.isUnread).toBe(true);
    });

    it('should extract free text', () => {
      const result = parseSearchQuery('hello world from:test@example.com');
      expect(result.freeText).toBe('hello world');
      expect(result.from).toBe('test@example.com');
    });

    it('should keep a URL as free text, not an operator', () => {
      const result = parseSearchQuery('check https://example.com now');
      expect(result.freeText).toBe('check https://example.com now');
      // https: must NOT be interpreted as an operator
      expect(result.from).toBeUndefined();
      expect(result.subject).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('should keep a time value as free text, not an operator', () => {
      const result = parseSearchQuery('meeting at 12:30 today');
      expect(result.freeText).toBe('meeting at 12:30 today');
      expect(result.from).toBeUndefined();
      expect(result.subject).toBeUndefined();
    });

    it('should keep an unknown word:value token as free text', () => {
      const result = parseSearchQuery('foo:bar hello');
      expect(result.freeText).toBe('foo:bar hello');
      expect(result.from).toBeUndefined();
    });

    it('should still parse a real operator mixed with a URL', () => {
      const result = parseSearchQuery('from:bob see https://x.com/y');
      expect(result.from).toBe('bob');
      expect(result.freeText).toBe('see https://x.com/y');
    });
  });

  describe('filterEmails', () => {
    const emails: Email[] = [
      createMockEmail({ id: 1, sender: 'amazon@amazon.com', subject: 'Order Confirmation' }),
      createMockEmail({ id: 2, sender: 'spotify@spotify.com', subject: 'Welcome!' }),
      createMockEmail({ id: 3, sender: 'bank@chase.com', subject: 'Statement', isRead: true }),
      createMockEmail({ id: 4, sender: 'test@example.com', emailType: 'purchase' }),
    ];

    it('should filter by from', () => {
      const search = parseSearchQuery('from:amazon');
      const filtered = filterEmails(emails, search);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sender).toBe('amazon@amazon.com');
    });

    it('should filter by subject', () => {
      const search = parseSearchQuery('subject:order');
      const filtered = filterEmails(emails, search);
      expect(filtered).toHaveLength(1);
    });

    it('should filter by is:unread', () => {
      const search = parseSearchQuery('is:unread');
      const filtered = filterEmails(emails, search);
      expect(filtered).toHaveLength(3);
    });

    it('should filter by type', () => {
      const search = parseSearchQuery('type:purchase');
      const filtered = filterEmails(emails, search);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].emailType).toBe('purchase');
    });

    it('should combine filters', () => {
      const search = parseSearchQuery('from:spotify is:unread');
      const filtered = filterEmails(emails, search);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].sender).toBe('spotify@spotify.com');
    });
  });

  describe('getSearchTerms', () => {
    it('should extract all search terms', () => {
      const search = parseSearchQuery('hello world from:amazon subject:order');
      const terms = getSearchTerms(search);
      expect(terms).toContain('hello');
      expect(terms).toContain('world');
      expect(terms).toContain('amazon');
      expect(terms).toContain('order');
    });
  });
});

