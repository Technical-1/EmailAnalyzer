import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { backupService } from '../../services/backupService';
import { db, bulkInsertEmails, getEmailBody, clearAllData } from '../../db/database';

// Build a backup zip in-memory matching exportBackup's plain-JSON layout.
async function makeBackupZip(parts: {
  version?: string;
  encrypted?: boolean;
  emails?: unknown[];
  accounts?: unknown[];
  contacts?: unknown[];
  emailBodies?: unknown[];
}): Promise<File> {
  const zip = new JSZip();
  const metadata = {
    version: parts.version ?? '1.0.0',
    createdAt: new Date().toISOString(),
    emailCount: parts.emails?.length ?? 0,
    accountCount: parts.accounts?.length ?? 0,
    purchaseCount: 0,
    contactCount: parts.contacts?.length ?? 0,
    calendarEventCount: 0,
    folderCount: 0,
    subscriptionCount: 0,
    newsletterCount: 0,
    emailBodyCount: parts.emailBodies?.length ?? 0,
    encrypted: parts.encrypted ?? false,
  };
  zip.file('metadata.json', JSON.stringify(metadata));
  if (parts.emails) zip.file('emails.json', JSON.stringify(parts.emails));
  if (parts.accounts) zip.file('accounts.json', JSON.stringify(parts.accounts));
  if (parts.contacts) zip.file('contacts.json', JSON.stringify(parts.contacts));
  if (parts.emailBodies) zip.file('email-bodies.json', JSON.stringify(parts.emailBodies));
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'backup.zip');
}

describe('importBackup robustness (phase-9)', () => {
  beforeEach(async () => {
    await db.emails.clear();
    await db.emailBodies.clear();
    await db.accounts.clear();
    await db.purchases.clear();
    await db.contacts.clear();
    await db.calendarEvents.clear();
    await db.folders.clear();
    await db.subscriptions.clear();
    await db.newsletters.clear();
  });

  it('scaffold builds a valid backup file', async () => {
    const file = await makeBackupZip({ emails: [] });
    const meta = await backupService.getBackupInfo(file);
    expect(meta.version).toBe('1.0.0');
  });

  // Task 2 — TEST: reject mismatched metadata.version
  it('rejects a backup whose metadata.version does not match BACKUP_VERSION', async () => {
    const file = await makeBackupZip({
      version: '0.9.0',
      emails: [
        {
          subject: 'X',
          sender: 'a@b.com',
          recipients: [],
          date: new Date().toISOString(),
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow(/version/i);
    // Nothing should have been written.
    expect(await db.emails.count()).toBe(0);
  });

  // Task 4 — TEST: reject records with invalid (NaN) dates
  it('rejects a backup containing an unparseable date (no NaN reaches the DB)', async () => {
    const file = await makeBackupZip({
      emails: [
        {
          subject: 'Bad date',
          sender: 'a@b.com',
          recipients: [],
          date: 'not-a-date',
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow(/invalid date/i);
    expect(await db.emails.count()).toBe(0);
  });

  // Task 6 — TEST: mid-import failure rolls back ALL tables
  it('rolls back all tables when one record fails mid-import', async () => {
    const file = await makeBackupZip({
      emails: [
        {
          subject: 'Good email',
          sender: 'a@b.com',
          recipients: [],
          date: new Date().toISOString(),
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
      accounts: [
        {
          serviceName: 'GoodService',
          serviceType: 'other',
          domain: 'b.com',
          email: 'a@b.com',
          signupDate: new Date().toISOString(),
          emailIds: [],
        },
      ],
      // contacts import AFTER emails+accounts and contains a poison record
      contacts: [
        {
          name: 'Bad contact',
          email: 'c@d.com',
          emailCount: 1,
          lastEmailDate: 'totally-invalid',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow();

    // Atomic: the earlier (valid) emails and accounts must NOT have been committed.
    expect(await db.emails.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.contacts.count()).toBe(0);
  });

  // Task 8 — TEST: full export → import round-trip preserves data
  it('round-trips export -> import with multiple tables intact', async () => {
    const now = Date.now();
    await db.emails.add({
      subject: 'Roundtrip',
      sender: 'a@b.com',
      recipients: ['r@b.com'],
      date: now,
      body: 'hi',
      attachments: [],
      size: 10,
      isRead: true,
      isStarred: false,
      folderId: 'inbox',
      emailType: 'regular',
    } as Parameters<typeof db.emails.add>[0]);
    await db.contacts.add({
      name: 'Alice',
      email: 'a@b.com',
      emailCount: 1,
      lastEmailDate: now,
    } as Parameters<typeof db.contacts.add>[0]);

    const blob = await backupService.exportBackup({
      includeEmails: true,
      includeAccounts: false,
      includePurchases: false,
      includeContacts: true,
      includeCalendarEvents: false,
      includeFolders: false,
      includeSubscriptions: false,
      includeNewsletters: false,
      encrypt: false,
    });

    await db.emails.clear();
    await db.emailBodies.clear();
    await db.contacts.clear();

    const file = new File([blob], 'backup.zip');
    const meta = await backupService.importBackup(file);

    expect(meta.version).toBe('1.0.0');
    expect(await db.emails.count()).toBe(1);
    expect(await db.contacts.count()).toBe(1);

    const [email] = await db.emails.toArray();
    expect(email.subject).toBe('Roundtrip');
    expect(Number.isFinite(email.date)).toBe(true);
    expect(email.date).toBe(now);

    const [contact] = await db.contacts.toArray();
    expect(contact.name).toBe('Alice');
    expect(Number.isFinite(contact.lastEmailDate)).toBe(true);
  });

  // Task 11.5 — TEST: emailBodies round-trip (body + attachment data survive export→clear→import)
  it('round-trips email body and attachment data via emailBodies table', async () => {
    const now = Date.now();
    const attachmentId = 'att-1';
    const base64Data = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

    // Insert via split-aware bulkInsertEmails so body goes to emailBodies
    const [emailId] = await bulkInsertEmails([
      {
        subject: 'Body Test',
        sender: 'x@y.com',
        recipients: ['r@y.com'],
        date: new Date(now),
        body: 'Plain body text',
        htmlBody: '<p>HTML body</p>',
        attachments: [
          {
            id: attachmentId,
            filename: 'test.txt',
            mimeType: 'text/plain',
            size: 100,
            data: base64Data,
          },
        ],
        size: 200,
        isRead: false,
        isStarred: false,
        folderId: 'inbox',
        emailType: 'regular',
      },
    ]);

    // Confirm body is in emailBodies before export
    const bodyBefore = await getEmailBody(emailId);
    expect(bodyBefore?.body).toBe('Plain body text');
    expect(bodyBefore?.htmlBody).toBe('<p>HTML body</p>');
    expect(bodyBefore?.attachmentData?.[attachmentId]).toBe(base64Data);

    // Export
    const blob = await backupService.exportBackup({
      includeEmails: true,
      includeAccounts: false,
      includePurchases: false,
      includeContacts: false,
      includeCalendarEvents: false,
      includeFolders: false,
      includeSubscriptions: false,
      includeNewsletters: false,
      encrypt: false,
    });

    // Clear everything
    await clearAllData();
    expect(await db.emails.count()).toBe(0);
    expect(await db.emailBodies.count()).toBe(0);

    // Import
    const file = new File([blob], 'backup.zip');
    await backupService.importBackup(file);

    // Assert email row is back
    expect(await db.emails.count()).toBe(1);

    // Assert body is restored correctly
    const [restoredEmail] = await db.emails.toArray();
    const bodyAfter = await getEmailBody(restoredEmail.id);
    expect(bodyAfter?.body).toBe('Plain body text');
    expect(bodyAfter?.htmlBody).toBe('<p>HTML body</p>');
    expect(bodyAfter?.attachmentData?.[attachmentId]).toBe(base64Data);
  });
});
