import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import { db, clearAllData, insertEmail, getEmailBody, bulkInsertEmails, getEmailHeaders } from '../../db/database';
import type { Email } from '../../types';

const baseEmail: Omit<Email, 'id'> = {
  subject: 'Hi', sender: 'a@b.com', recipients: ['c@d.com'],
  date: new Date('2024-02-02'), body: 'PLAIN BODY', htmlBody: '<p>HTML BODY</p>',
  attachments: [{ id: 'att1', filename: 'f.pdf', mimeType: 'application/pdf', size: 3, data: 'AAAA' }],
  size: 10, isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular',
};

describe('emailBodies table (version 5)', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('exposes an emailBodies table after opening the DB', async () => {
    await db.open();
    const names = db.tables.map(t => t.name);
    expect(names).toContain('emailBodies');
    expect(db.verno).toBeGreaterThanOrEqual(5);
  });

  it('stores body/html/attachment-data in emailBodies, not in the email row', async () => {
    const id = await insertEmail(baseEmail);
    const row = await db.emails.get(id);
    expect((row as unknown as Record<string, unknown>).body).toBeUndefined();
    expect((row as unknown as Record<string, unknown>).htmlBody).toBeUndefined();
    // attachment metadata stays, base64 data does not
    expect(row!.attachments[0].filename).toBe('f.pdf');
    expect(row!.attachments[0].data).toBeUndefined();

    const bodyRow = await db.emailBodies.get(id);
    expect(bodyRow?.body).toBe('PLAIN BODY');
    expect(bodyRow?.htmlBody).toBe('<p>HTML BODY</p>');
    expect(bodyRow?.attachmentData?.att1).toBe('AAAA');
  });

  it('getEmailBody returns body + html + attachment data from emailBodies', async () => {
    const id = await insertEmail(baseEmail);
    const result = await getEmailBody(id);
    expect(result?.body).toBe('PLAIN BODY');
    expect(result?.htmlBody).toBe('<p>HTML BODY</p>');
    expect(result?.attachmentData?.att1).toBe('AAAA');
  });

  it('bulkInsertEmails splits bodies and getEmailHeaders omits body/htmlBody', async () => {
    await bulkInsertEmails([
      { ...baseEmail, subject: 'one' },
      { ...baseEmail, subject: 'two', body: 'BODY TWO' },
    ]);
    const headers = await getEmailHeaders();
    expect(headers).toHaveLength(2);
    for (const h of headers) {
      expect((h as Record<string, unknown>).body).toBeUndefined();
      expect((h as Record<string, unknown>).htmlBody).toBeUndefined();
      // attachment metadata present, no base64
      expect(h.attachments[0].filename).toBe('f.pdf');
      expect(h.attachments[0].data).toBeUndefined();
    }
    // bodies retrievable
    const ids = headers.map(h => h.id!).sort((a, b) => a - b);
    const b0 = await getEmailBody(ids[0]);
    const b1 = await getEmailBody(ids[1]);
    const bodies = [b0?.body, b1?.body].sort();
    expect(bodies).toEqual(['BODY TWO', 'PLAIN BODY']);
  });
});

describe('v4 → v5 migration survival', () => {
  it('migrates pre-existing v4 rows: body moves to emailBodies, headers load clean', async () => {
    // Step 1: Delete the existing DB and close the singleton so we start fresh
    db.close();
    await Dexie.delete('EmailAnalyzerDB');

    // Step 2: Build a raw v4 DB (no emailBodies table, body on the row) then close it.
    const legacy = new Dexie('EmailAnalyzerDB');
    legacy.version(4).stores({
      emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
      contacts: '++id, name, email, emailCount, lastEmailDate',
      calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
      folders: 'id, name, isSystem, createdAt',
      subscriptions: '++id, serviceName, category, isActive, lastRenewalDate',
      newsletters: '++id, senderEmail, isPromotional, lastEmailDate',
    });
    await legacy.open();
    const legacyId = await legacy.table('emails').add({
      subject: 'Legacy', sender: 'x@y.com', recipients: ['z@y.com'],
      date: new Date('2023-01-01').getTime(), body: 'LEGACY BODY', htmlBody: '<i>legacy</i>',
      attachments: [{ id: 'la', filename: 'l.txt', mimeType: 'text/plain', size: 2, data: 'QQ==' }],
      size: 5, isRead: true, isStarred: false, folderId: 'inbox', emailType: 'regular',
    });
    legacy.close();

    // Step 3: Re-open through the app's db singleton (triggers version(5).upgrade)
    await db.open();

    const headers = await getEmailHeaders();
    const legacyHeader = headers.find(h => h.subject === 'Legacy')!;
    expect(legacyHeader).toBeDefined();
    expect((legacyHeader as Record<string, unknown>).body).toBeUndefined();
    expect(legacyHeader.attachments[0].filename).toBe('l.txt');
    expect(legacyHeader.attachments[0].data).toBeUndefined();

    const body = await getEmailBody(legacyId as number);
    expect(body?.body).toBe('LEGACY BODY');
    expect(body?.htmlBody).toBe('<i>legacy</i>');
    expect(body?.attachmentData?.la).toBe('QQ==');

    // Cleanup: clear everything for subsequent tests
    await clearAllData();
  });
});
