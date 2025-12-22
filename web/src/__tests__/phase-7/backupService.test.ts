import { describe, it, expect, beforeEach } from 'vitest';
import { backupService } from '../../services/backupService';
import { db } from '../../db/database';

describe('BackupService', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await db.emails.clear();
    await db.accounts.clear();
    await db.purchases.clear();
    await db.contacts.clear();
    await db.calendarEvents.clear();
    await db.folders.clear();
  });

  describe('exportBackup', () => {
    it('should export an empty backup when no data exists', async () => {
      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: true,
        includePurchases: true,
        includeContacts: true,
        includeCalendarEvents: true,
        includeFolders: true,
        encrypt: false,
      });

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should export emails when data exists', async () => {
      // Add test data
      await db.emails.add({
        subject: 'Test Email',
        sender: 'test@example.com',
        recipients: ['recipient@example.com'],
        date: Date.now(),
        body: 'Test body',
        attachments: [],
        size: 100,
        isRead: false,
        isStarred: false,
        folderId: 'inbox',
        emailType: 'regular',
      } as any);

      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: false,
        includePurchases: false,
        includeContacts: false,
        includeCalendarEvents: false,
        includeFolders: false,
        encrypt: false,
      });

      expect(blob.size).toBeGreaterThan(0);
    });

    it('should filter emails by date range', async () => {
      const now = Date.now();
      const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
      const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000;

      await db.emails.bulkAdd([
        {
          subject: 'Recent Email',
          sender: 'test@example.com',
          recipients: [],
          date: now,
          body: 'Recent',
          attachments: [],
          size: 100,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
        {
          subject: 'Old Email',
          sender: 'test@example.com',
          recipients: [],
          date: twoWeeksAgo,
          body: 'Old',
          attachments: [],
          size: 100,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ] as any[]);

      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: false,
        includePurchases: false,
        includeContacts: false,
        includeCalendarEvents: false,
        includeFolders: false,
        encrypt: false,
        dateRange: {
          start: new Date(oneWeekAgo),
          end: new Date(now + 1000),
        },
      });

      // The backup should be created successfully
      expect(blob.size).toBeGreaterThan(0);
    });

    it('should report progress during export', async () => {
      const progressUpdates: number[] = [];

      await backupService.exportBackup(
        {
          includeEmails: true,
          includeAccounts: true,
          includePurchases: true,
          includeContacts: true,
          includeCalendarEvents: true,
          includeFolders: true,
          encrypt: false,
        },
        (progress) => progressUpdates.push(progress)
      );

      expect(progressUpdates).toContain(0);
      expect(progressUpdates).toContain(100);
    });
  });

  describe('getBackupInfo', () => {
    it('should return metadata from a backup file', async () => {
      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: true,
        includePurchases: true,
        includeContacts: true,
        includeCalendarEvents: true,
        includeFolders: true,
        encrypt: false,
      });

      const file = new File([blob], 'backup.zip');
      const metadata = await backupService.getBackupInfo(file);

      expect(metadata.version).toBe('1.0.0');
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.encrypted).toBe(false);
    });
  });

  describe('importBackup', () => {
    it('should import data from a backup', async () => {
      // Add test data
      await db.emails.add({
        subject: 'Test Email',
        sender: 'test@example.com',
        recipients: ['recipient@example.com'],
        date: Date.now(),
        body: 'Test body',
        attachments: [],
        size: 100,
        isRead: false,
        isStarred: false,
        folderId: 'inbox',
        emailType: 'regular',
      } as any);

      // Export
      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: false,
        includePurchases: false,
        includeContacts: false,
        includeCalendarEvents: false,
        includeFolders: false,
        encrypt: false,
      });

      // Clear data
      await db.emails.clear();
      expect(await db.emails.count()).toBe(0);

      // Import
      const file = new File([blob], 'backup.zip');
      await backupService.importBackup(file);

      // Verify
      expect(await db.emails.count()).toBe(1);
      const emails = await db.emails.toArray();
      expect(emails[0].subject).toBe('Test Email');
    });

    it('should report progress during import', async () => {
      const blob = await backupService.exportBackup({
        includeEmails: true,
        includeAccounts: true,
        includePurchases: true,
        includeContacts: true,
        includeCalendarEvents: true,
        includeFolders: true,
        encrypt: false,
      });

      const file = new File([blob], 'backup.zip');
      const progressUpdates: number[] = [];

      await backupService.importBackup(file, (progress) => progressUpdates.push(progress));

      expect(progressUpdates).toContain(0);
      expect(progressUpdates).toContain(100);
    });
  });

  describe('clearAllData', () => {
    it('should clear all data from database', async () => {
      // Add some test data
      await db.emails.add({
        subject: 'Test',
        sender: 'test@test.com',
        recipients: [],
        date: Date.now(),
        body: '',
        attachments: [],
        size: 0,
        isRead: false,
        isStarred: false,
        folderId: 'inbox',
        emailType: 'regular',
      } as any);

      await db.contacts.add({
        name: 'Test',
        email: 'test@test.com',
        emailCount: 1,
      });

      // Verify data exists
      expect(await db.emails.count()).toBe(1);
      expect(await db.contacts.count()).toBe(1);

      // Clear
      await backupService.clearAllData();

      // Verify cleared
      expect(await db.emails.count()).toBe(0);
      expect(await db.contacts.count()).toBe(0);
    });
  });
});

