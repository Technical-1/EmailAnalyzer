import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Email } from '../../types';
import { db, getEmails } from '../../db/database';
import { createImportCounts, processEmailBatch } from '../../services/importPipeline';
import { customRulesEngine } from '../../services/customRulesEngine';

const email = (overrides: Partial<Omit<Email, 'id'>> = {}): Omit<Email, 'id'> => ({
  subject: 'Hello',
  sender: 'someone@example.com',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'plain message',
  attachments: [],
  size: 100,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('importPipeline applies custom rules to imported emails', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Promise.all([db.emails.clear(), db.emailBodies.clear()]);
  });

  afterEach(() => localStorage.clear());

  it('tags, stars and moves an email that matches an active rule', async () => {
    customRulesEngine.createRule({
      name: 'Amazon receipts',
      conditions: [{ field: 'sender', operator: 'contains', value: 'amazon', caseSensitive: false }],
      actions: [
        { type: 'tag', value: 'shopping' },
        { type: 'star' },
        { type: 'move', value: 'receipts' },
      ],
      isActive: true,
    });

    const counts = createImportCounts();
    await processEmailBatch(
      [
        email({ sender: 'orders@amazon.com', subject: 'Your order' }),
        email({ sender: 'friend@gmail.com', subject: 'hi' }),
      ],
      counts,
      new Set<string>(),
    );

    const stored = await getEmails();
    const amazon = stored.find((e) => e.sender === 'orders@amazon.com')!;
    const friend = stored.find((e) => e.sender === 'friend@gmail.com')!;

    expect(amazon.tags).toEqual(['shopping']);
    expect(amazon.isStarred).toBe(true);
    expect(amazon.folderId).toBe('receipts');

    // Non-matching email is untouched by the rule.
    expect(friend.tags ?? []).toEqual([]);
    expect(friend.isStarred).toBe(false);
    expect(friend.folderId).toBe('inbox');
  });

  it('does nothing when there are no active rules', async () => {
    customRulesEngine.createRule({
      name: 'Disabled rule',
      conditions: [{ field: 'sender', operator: 'contains', value: 'amazon', caseSensitive: false }],
      actions: [{ type: 'star' }],
      isActive: false,
    });

    const counts = createImportCounts();
    await processEmailBatch([email({ sender: 'orders@amazon.com' })], counts, new Set<string>());

    const stored = await getEmails();
    expect(stored[0].isStarred).toBe(false);
  });
});
