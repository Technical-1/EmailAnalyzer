import { describe, it, expect, beforeEach } from 'vitest';
import { bulkInsertEmails, clearAllData } from '../../db/database';
import { useAppStore } from '../../store';
import type { Email } from '../../types';

const mk = (over: Partial<Email>): Omit<Email, 'id'> => ({
  subject: 's', sender: 'a@b.com', recipients: [], date: new Date('2024-04-04'),
  body: 'b', attachments: [], size: 0, isRead: false, isStarred: false,
  folderId: 'inbox', emailType: 'regular', ...over,
});

describe('in-place index updates for membership-preserving mutations', () => {
  beforeEach(async () => {
    await clearAllData();
    useAppStore.setState({ isInitialized: false, emails: [], emailIndex: new Map(), threads: [] });
    await bulkInsertEmails([mk({ subject: 'a' }), mk({ subject: 'b' }), mk({ subject: 'c' })]);
    await useAppStore.getState().initialize();
  });

  it('toggleEmailStar keeps the SAME emailIndex Map identity (no rebuild)', async () => {
    const before = useAppStore.getState().emailIndex;
    const id = useAppStore.getState().emails[0].id!;
    await useAppStore.getState().toggleEmailStar(id);
    const after = useAppStore.getState().emailIndex;
    expect(after).toBe(before); // same Map reference => not rebuilt
    expect(useAppStore.getState().getEmailById(id)?.isStarred).toBe(true);
  });

  it('markEmailAsRead updates one entry and preserves index identity', async () => {
    const before = useAppStore.getState().emailIndex;
    const id = useAppStore.getState().emails[1].id!;
    await useAppStore.getState().markEmailAsRead(id);
    expect(useAppStore.getState().emailIndex).toBe(before);
    expect(useAppStore.getState().getEmailById(id)?.isRead).toBe(true);
  });

  it('permanentlyDeleteEmail DOES rebuild (membership changed)', async () => {
    const before = useAppStore.getState().emailIndex;
    const id = useAppStore.getState().emails[0].id!;
    await useAppStore.getState().permanentlyDeleteEmail(id);
    expect(useAppStore.getState().emailIndex).not.toBe(before); // rebuilt
    expect(useAppStore.getState().getEmailById(id)).toBeUndefined();
    expect(useAppStore.getState().emails).toHaveLength(2);
  });
});
