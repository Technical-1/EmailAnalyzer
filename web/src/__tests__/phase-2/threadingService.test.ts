import { describe, it, expect } from 'vitest';
import { threadingService } from '../../services/threadingService';
import type { Email } from '../../types';

const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
  id: Math.floor(Math.random() * 10000),
  subject: 'Test Subject',
  sender: 'sender@example.com',
  recipients: ['recipient@example.com'],
  date: new Date(),
  body: 'Test body content',
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('ThreadingService', () => {
  describe('buildThreads', () => {
    it('should group emails with same normalized subject', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Test Subject', date: new Date('2024-01-01') }),
        createMockEmail({ id: 2, subject: 'Re: Test Subject', date: new Date('2024-01-02') }),
        createMockEmail({ id: 3, subject: 'Re: Re: Test Subject', date: new Date('2024-01-03') }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads).toHaveLength(1);
      expect(threads[0].messageCount).toBe(3);
      expect(threads[0].emails).toHaveLength(3);
    });

    it('should keep different subjects in separate threads', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Subject A' }),
        createMockEmail({ id: 2, subject: 'Subject B' }),
        createMockEmail({ id: 3, subject: 'Subject C' }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads).toHaveLength(3);
      threads.forEach((thread) => {
        expect(thread.messageCount).toBe(1);
      });
    });

    it('should group by threadId when available', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Subject A', threadId: 'thread-123' }),
        createMockEmail({ id: 2, subject: 'Subject B', threadId: 'thread-123' }),
        createMockEmail({ id: 3, subject: 'Subject C' }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads).toHaveLength(2);
      const threadWithId = threads.find((t) => t.messageCount === 2);
      expect(threadWithId).toBeDefined();
    });

    it('should sort threads by last message date', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Old Thread', date: new Date('2024-01-01') }),
        createMockEmail({ id: 2, subject: 'New Thread', date: new Date('2024-01-15') }),
        createMockEmail({ id: 3, subject: 'Middle Thread', date: new Date('2024-01-10') }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads[0].subject).toBe('New Thread');
      expect(threads[1].subject).toBe('Middle Thread');
      expect(threads[2].subject).toBe('Old Thread');
    });

    it('should track unread count in threads', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Test', isRead: true }),
        createMockEmail({ id: 2, subject: 'Re: Test', isRead: false }),
        createMockEmail({ id: 3, subject: 'Re: Re: Test', isRead: false }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads[0].unreadCount).toBe(2);
    });

    it('should track starred status in threads', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Test', isStarred: false }),
        createMockEmail({ id: 2, subject: 'Re: Test', isStarred: true }),
        createMockEmail({ id: 3, subject: 'Re: Re: Test', isStarred: false }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads[0].isStarred).toBe(true);
    });

    it('should collect all participants', () => {
      const emails: Email[] = [
        createMockEmail({
          id: 1,
          subject: 'Test',
          sender: 'alice@example.com',
          recipients: ['bob@example.com'],
        }),
        createMockEmail({
          id: 2,
          subject: 'Re: Test',
          sender: 'bob@example.com',
          recipients: ['alice@example.com', 'charlie@example.com'],
        }),
      ];

      const threads = threadingService.buildThreads(emails);

      expect(threads[0].participants).toContain('alice@example.com');
      expect(threads[0].participants).toContain('bob@example.com');
      expect(threads[0].participants).toContain('charlie@example.com');
    });
  });

  describe('findRelatedEmails', () => {
    it('should find emails with matching subject', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Test Subject' }),
        createMockEmail({ id: 2, subject: 'Re: Test Subject' }),
        createMockEmail({ id: 3, subject: 'Other Subject' }),
      ];

      const related = threadingService.findRelatedEmails(emails[0], emails);

      expect(related).toHaveLength(1);
      expect(related[0].id).toBe(2);
    });
  });

  describe('isPartOfConversation', () => {
    it('should return true for emails with related messages', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Test Subject' }),
        createMockEmail({ id: 2, subject: 'Re: Test Subject' }),
      ];

      expect(threadingService.isPartOfConversation(emails[0], emails)).toBe(true);
    });

    it('should return false for standalone emails', () => {
      const emails: Email[] = [
        createMockEmail({ id: 1, subject: 'Unique Subject' }),
        createMockEmail({ id: 2, subject: 'Other Subject' }),
      ];

      expect(threadingService.isPartOfConversation(emails[0], emails)).toBe(false);
    });
  });
});

