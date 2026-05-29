import { describe, it, expect, beforeEach } from 'vitest';
import { bulkInsertEmails, clearAllData } from '../../db/database';
import { useAppStore } from '../../store';
import type { Email } from '../../types';

const mk = (over: Partial<Email>): Omit<Email, 'id'> => ({
  subject: 's', sender: 'a@b.com', recipients: ['c@d.com'], date: new Date('2024-03-03'),
  body: 'FULL BODY TEXT', htmlBody: '<p>x</p>',
  attachments: [{ id: 'a1', filename: 'a.pdf', mimeType: 'application/pdf', size: 1, data: 'ZZ' }],
  size: 1, isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular', ...over,
});

describe('store init loads headers only', () => {
  beforeEach(async () => {
    await clearAllData();
    useAppStore.setState({ isInitialized: false, emails: [], emailIndex: new Map(), threads: [] });
  });

  it('does not pull full bodies into the store, keeps attachment metadata', async () => {
    await bulkInsertEmails([mk({ subject: 'one' }), mk({ subject: 'two' })]);
    await useAppStore.getState().initialize();
    const emails = useAppStore.getState().emails;
    expect(emails).toHaveLength(2);
    for (const e of emails) {
      expect((e as unknown as Record<string, unknown>).body).toBeUndefined();
      expect((e as unknown as Record<string, unknown>).htmlBody).toBeUndefined();
      expect(e.attachments[0].filename).toBe('a.pdf');   // metadata present
      expect(e.attachments[0].data).toBeUndefined();      // base64 not loaded
    }
    // threads still built (hasAttachments works off metadata)
    expect(useAppStore.getState().threads.length).toBeGreaterThan(0);
  });

  it('searchText is present on header rows (from Step 9)', async () => {
    await bulkInsertEmails([mk({ subject: 'search-test', body: 'unique-word-xyz in body content' })]);
    await useAppStore.getState().initialize();
    const emails = useAppStore.getState().emails;
    expect(emails).toHaveLength(1);
    const email = emails[0] as unknown as Record<string, unknown>;
    // searchText should contain the body text (or at least not be undefined)
    expect(email.searchText).toBeDefined();
    expect(String(email.searchText)).toContain('unique-word-xyz');
  });
});
