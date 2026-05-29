import { describe, it, expect, beforeEach } from 'vitest';
import { db, deleteFolder, clearAllData } from '../../db/database';
import { SYSTEM_FOLDERS } from '../../types';

describe('database transactional helpers (phase-9)', () => {
  beforeEach(async () => {
    await db.emails.clear();
    await db.emailBodies.clear();
    await db.folders.clear();
  });

  it('deleteFolder moves all emails to inbox and removes the folder', async () => {
    await db.folders.add({
      id: 'custom',
      name: 'Custom',
      isSystem: false,
      createdAt: Date.now(),
    } as Parameters<typeof db.folders.add>[0]);

    await db.emails.bulkAdd([
      {
        subject: 'A', sender: 's@x.com', recipients: [], date: Date.now(),
        body: '', attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'custom', emailType: 'regular',
      },
      {
        subject: 'B', sender: 's@x.com', recipients: [], date: Date.now(),
        body: '', attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'custom', emailType: 'regular',
      },
    ] as Parameters<typeof db.emails.bulkAdd>[0]);

    await deleteFolder('custom');

    expect(await db.folders.get('custom')).toBeUndefined();
    expect(await db.emails.where('folderId').equals('custom').count()).toBe(0);
    expect(await db.emails.where('folderId').equals(SYSTEM_FOLDERS.INBOX).count()).toBe(2);
  });

  it('clearAllData empties every table', async () => {
    await db.emails.add({
      subject: 'A', sender: 's@x.com', recipients: [], date: Date.now(),
      body: '', attachments: [], size: 0, isRead: false, isStarred: false,
      folderId: 'inbox', emailType: 'regular',
    } as Parameters<typeof db.emails.add>[0]);
    await db.folders.add({
      id: 'custom', name: 'Custom', isSystem: false, createdAt: Date.now(),
    } as Parameters<typeof db.folders.add>[0]);

    await clearAllData();

    expect(await db.emails.count()).toBe(0);
    expect(await db.folders.count()).toBe(0);
  });
});
