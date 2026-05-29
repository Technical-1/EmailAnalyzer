import { describe, it, expect } from 'vitest';
import { threadingService } from '../../services/threadingService';
import type { Email } from '../../types';

const mk = (overrides: Partial<Email> = {}): Email => ({
  id: Math.floor(Math.random() * 100000),
  subject: 'Invoice',
  sender: 'billing@acme.com',
  recipients: ['me@example.com'],
  date: new Date(),
  body: 'body',
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('ThreadingService fallback key (issue 16)', () => {
  it('does NOT merge identical generic subjects from different sender domains', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'billing@acme.com' }),
      mk({ id: 2, subject: 'Invoice', sender: 'no-reply@globex.com' }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(2);
  });

  it('still merges same generic subject from the SAME sender domain', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'billing@acme.com', date: new Date('2024-01-01') }),
      mk({ id: 2, subject: 'Re: Invoice', sender: 'accounts@acme.com', date: new Date('2024-01-02') }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(2);
  });

  it('still respects explicit threadId regardless of subject/sender', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'a@acme.com', threadId: 'thread-1' }),
      mk({ id: 2, subject: 'Receipt', sender: 'b@globex.com', threadId: 'thread-1' }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(2);
  });
});
