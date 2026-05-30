import { describe, it, expect, beforeEach } from 'vitest';
import type { Email } from '../../types';
import { db, bulkInsertEmails, bulkUpdateEmailFields, getEmails } from '../../db/database';

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

describe('bulkUpdateEmailFields', () => {
  beforeEach(async () => {
    await Promise.all([db.emails.clear(), db.emailBodies.clear()]);
  });

  it('applies per-email field patches atomically in one call', async () => {
    const [a, b, c] = await bulkInsertEmails([
      email({ sender: 'a@x.com' }),
      email({ sender: 'b@x.com' }),
      email({ sender: 'c@x.com' }),
    ]);

    await bulkUpdateEmailFields([
      { id: a, changes: { isStarred: true, tags: ['vip'] } },
      { id: b, changes: { folderId: 'archive', isRead: true } },
    ]);

    const stored = await getEmails();
    const byId = new Map(stored.map((e) => [e.id!, e]));

    expect(byId.get(a)!.isStarred).toBe(true);
    expect(byId.get(a)!.tags).toEqual(['vip']);
    expect(byId.get(b)!.folderId).toBe('archive');
    expect(byId.get(b)!.isRead).toBe(true);
    // Untouched row keeps its defaults.
    expect(byId.get(c)!.isStarred).toBe(false);
    expect(byId.get(c)!.folderId).toBe('inbox');
  });

  it('is a no-op for an empty update list', async () => {
    await bulkInsertEmails([email()]);
    await expect(bulkUpdateEmailFields([])).resolves.toBeUndefined();
    const stored = await getEmails();
    expect(stored).toHaveLength(1);
  });
});
