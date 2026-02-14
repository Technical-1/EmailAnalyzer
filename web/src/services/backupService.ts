import JSZip from 'jszip';
import { db } from '../db/database';
import type { DBEmail, DBAccount, DBPurchase, DBContact, DBCalendarEvent, DBFolder, DBSubscription, DBNewsletter } from '../db/database';
import type { Email, Account, Purchase, Contact, CalendarEvent, Folder, Subscription, Newsletter } from '../types';
import { encryptionService } from './encryptionService';

interface BackupMetadata {
  version: string;
  createdAt: string;
  emailCount: number;
  accountCount: number;
  purchaseCount: number;
  contactCount: number;
  calendarEventCount: number;
  folderCount: number;
  subscriptionCount: number;
  newsletterCount: number;
  encrypted: boolean;
}

interface BackupData {
  metadata: BackupMetadata;
  emails?: Email[];
  accounts?: Account[];
  purchases?: Purchase[];
  contacts?: Contact[];
  calendarEvents?: CalendarEvent[];
  folders?: Folder[];
  subscriptions?: Subscription[];
  newsletters?: Newsletter[];
}

interface ExportOptions {
  includeEmails: boolean;
  includeAccounts: boolean;
  includePurchases: boolean;
  includeContacts: boolean;
  includeCalendarEvents: boolean;
  includeFolders: boolean;
  includeSubscriptions: boolean;
  includeNewsletters: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  folderIds?: string[];
  encrypt: boolean;
}

class BackupService {
  private readonly BACKUP_VERSION = '1.0.0';

  /**
   * Export data to a backup file
   */
  async exportBackup(
    options: ExportOptions,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Blob> {
    onProgress?.(0, 'Preparing backup...');

    const backup: BackupData = {
      metadata: {
        version: this.BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        emailCount: 0,
        accountCount: 0,
        purchaseCount: 0,
        contactCount: 0,
        calendarEventCount: 0,
        folderCount: 0,
        subscriptionCount: 0,
        newsletterCount: 0,
        encrypted: options.encrypt,
      },
    };

    // Collect data based on options
    if (options.includeEmails) {
      onProgress?.(10, 'Exporting emails...');
      let emails = await db.emails.toArray();

      // Apply date filter
      if (options.dateRange) {
        const startTime = options.dateRange.start.getTime();
        const endTime = options.dateRange.end.getTime();
        emails = emails.filter((e) => e.date >= startTime && e.date <= endTime);
      }

      // Apply folder filter
      if (options.folderIds && options.folderIds.length > 0) {
        emails = emails.filter((e) => options.folderIds!.includes(e.folderId));
      }

      backup.emails = emails.map((e) => ({
        ...e,
        date: new Date(e.date),
      })) as unknown as Email[];
      backup.metadata.emailCount = backup.emails.length;
    }

    if (options.includeAccounts) {
      onProgress?.(30, 'Exporting accounts...');
      const accounts = await db.accounts.toArray();
      backup.accounts = accounts.map((a) => ({
        ...a,
        signupDate: new Date(a.signupDate),
      })) as unknown as Account[];
      backup.metadata.accountCount = backup.accounts.length;
    }

    if (options.includePurchases) {
      onProgress?.(45, 'Exporting purchases...');
      const purchases = await db.purchases.toArray();
      backup.purchases = purchases.map((p) => ({
        ...p,
        purchaseDate: new Date(p.purchaseDate),
      })) as unknown as Purchase[];
      backup.metadata.purchaseCount = backup.purchases.length;
    }

    if (options.includeContacts) {
      onProgress?.(60, 'Exporting contacts...');
      const contacts = await db.contacts.toArray();
      backup.contacts = contacts.map((c) => ({
        ...c,
        lastEmailDate: new Date(c.lastEmailDate),
      })) as unknown as Contact[];
      backup.metadata.contactCount = backup.contacts.length;
    }

    if (options.includeCalendarEvents) {
      onProgress?.(75, 'Exporting calendar events...');
      const events = await db.calendarEvents.toArray();
      backup.calendarEvents = events.map((e) => ({
        ...e,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
      })) as unknown as CalendarEvent[];
      backup.metadata.calendarEventCount = backup.calendarEvents.length;
    }

    if (options.includeFolders) {
      onProgress?.(75, 'Exporting folders...');
      const folders = await db.folders.toArray();
      backup.folders = folders.map((f) => ({
        ...f,
        createdAt: new Date(f.createdAt),
      })) as unknown as Folder[];
      backup.metadata.folderCount = backup.folders.length;
    }

    if (options.includeSubscriptions) {
      onProgress?.(80, 'Exporting subscriptions...');
      const subscriptions = await db.subscriptions.toArray();
      backup.subscriptions = subscriptions.map((s) => ({
        ...s,
        lastRenewalDate: new Date(s.lastRenewalDate),
        nextRenewalDate: s.nextRenewalDate ? new Date(s.nextRenewalDate) : undefined,
        emailIds: typeof s.emailIds === 'string' ? JSON.parse(s.emailIds) : (s.emailIds || []),
      })) as unknown as Subscription[];
      backup.metadata.subscriptionCount = backup.subscriptions.length;
    }

    if (options.includeNewsletters) {
      onProgress?.(85, 'Exporting newsletters...');
      const newsletters = await db.newsletters.toArray();
      backup.newsletters = newsletters.map((n) => ({
        ...n,
        lastEmailDate: new Date(n.lastEmailDate),
      })) as unknown as Newsletter[];
      backup.metadata.newsletterCount = backup.newsletters.length;
    }

    onProgress?.(90, 'Creating backup file...');

    const zip = new JSZip();

    // Add metadata
    zip.file('metadata.json', JSON.stringify(backup.metadata, null, 2));

    // Add data files
    if (options.encrypt && encryptionService.isUnlocked()) {
      // Encrypt each data type
      if (backup.emails) {
        const encrypted = await encryptionService.encryptObject(backup.emails);
        zip.file('emails.enc', JSON.stringify(encrypted));
      }
      if (backup.accounts) {
        const encrypted = await encryptionService.encryptObject(backup.accounts);
        zip.file('accounts.enc', JSON.stringify(encrypted));
      }
      if (backup.purchases) {
        const encrypted = await encryptionService.encryptObject(backup.purchases);
        zip.file('purchases.enc', JSON.stringify(encrypted));
      }
      if (backup.contacts) {
        const encrypted = await encryptionService.encryptObject(backup.contacts);
        zip.file('contacts.enc', JSON.stringify(encrypted));
      }
      if (backup.calendarEvents) {
        const encrypted = await encryptionService.encryptObject(backup.calendarEvents);
        zip.file('calendar-events.enc', JSON.stringify(encrypted));
      }
      if (backup.folders) {
        const encrypted = await encryptionService.encryptObject(backup.folders);
        zip.file('folders.enc', JSON.stringify(encrypted));
      }
      if (backup.subscriptions) {
        const encrypted = await encryptionService.encryptObject(backup.subscriptions);
        zip.file('subscriptions.enc', JSON.stringify(encrypted));
      }
      if (backup.newsletters) {
        const encrypted = await encryptionService.encryptObject(backup.newsletters);
        zip.file('newsletters.enc', JSON.stringify(encrypted));
      }
    } else {
      // Store as plain JSON
      if (backup.emails) {
        zip.file('emails.json', JSON.stringify(backup.emails));
      }
      if (backup.accounts) {
        zip.file('accounts.json', JSON.stringify(backup.accounts));
      }
      if (backup.purchases) {
        zip.file('purchases.json', JSON.stringify(backup.purchases));
      }
      if (backup.contacts) {
        zip.file('contacts.json', JSON.stringify(backup.contacts));
      }
      if (backup.calendarEvents) {
        zip.file('calendar-events.json', JSON.stringify(backup.calendarEvents));
      }
      if (backup.folders) {
        zip.file('folders.json', JSON.stringify(backup.folders));
      }
      if (backup.subscriptions) {
        zip.file('subscriptions.json', JSON.stringify(backup.subscriptions));
      }
      if (backup.newsletters) {
        zip.file('newsletters.json', JSON.stringify(backup.newsletters));
      }
    }

    onProgress?.(100, 'Backup complete!');

    return zip.generateAsync({ type: 'blob' });
  }

  /**
   * Import data from a backup file
   */
  async importBackup(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<BackupMetadata> {
    onProgress?.(0, 'Opening backup file...');

    const zip = await JSZip.loadAsync(file);

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid backup file: missing metadata');
    }

    const metadata: BackupMetadata = JSON.parse(await metadataFile.async('string'));

    onProgress?.(10, 'Validating backup...');

    // Check if encrypted
    if (metadata.encrypted) {
      if (!encryptionService.isUnlocked()) {
        throw new Error('This backup is encrypted. Please unlock with your passphrase first.');
      }
    }

    // Import data
    const readAndParse = async <T>(filename: string): Promise<T[] | null> => {
      const plainFile = zip.file(`${filename}.json`);
      const encFile = zip.file(`${filename}.enc`);

      if (encFile && metadata.encrypted) {
        const encryptedData = JSON.parse(await encFile.async('string'));
        return encryptionService.decryptObject<T[]>(encryptedData);
      } else if (plainFile) {
        return JSON.parse(await plainFile.async('string'));
      }
      return null;
    };

    // Import emails
    onProgress?.(20, 'Importing emails...');
    const emails = await readAndParse<Email>('emails');
    if (emails && emails.length > 0) {
      const dbEmails: DBEmail[] = emails.map((e) => ({
        ...e,
        date: new Date(e.date).getTime(),
      })) as DBEmail[];
      await db.emails.bulkPut(dbEmails);
    }

    // Import accounts
    onProgress?.(35, 'Importing accounts...');
    const accounts = await readAndParse<Account>('accounts');
    if (accounts && accounts.length > 0) {
      const dbAccounts: DBAccount[] = accounts.map((a) => ({
        ...a,
        signupDate: new Date(a.signupDate).getTime(),
      })) as DBAccount[];
      await db.accounts.bulkPut(dbAccounts);
    }

    // Import purchases
    onProgress?.(50, 'Importing purchases...');
    const purchases = await readAndParse<Purchase>('purchases');
    if (purchases && purchases.length > 0) {
      const dbPurchases: DBPurchase[] = purchases.map((p) => ({
        ...p,
        purchaseDate: new Date(p.purchaseDate).getTime(),
      })) as DBPurchase[];
      await db.purchases.bulkPut(dbPurchases);
    }

    // Import contacts
    onProgress?.(65, 'Importing contacts...');
    const contacts = await readAndParse<Contact>('contacts');
    if (contacts && contacts.length > 0) {
      const dbContacts: DBContact[] = contacts.map((c) => ({
        ...c,
        lastEmailDate: new Date(c.lastEmailDate).getTime(),
      })) as DBContact[];
      await db.contacts.bulkPut(dbContacts);
    }

    // Import calendar events
    onProgress?.(80, 'Importing calendar events...');
    const calendarEvents = await readAndParse<CalendarEvent>('calendar-events');
    if (calendarEvents && calendarEvents.length > 0) {
      const dbEvents: DBCalendarEvent[] = calendarEvents.map((e) => ({
        ...e,
        startDate: new Date(e.startDate).getTime(),
        endDate: new Date(e.endDate).getTime(),
      })) as DBCalendarEvent[];
      await db.calendarEvents.bulkPut(dbEvents);
    }

    // Import folders
    onProgress?.(80, 'Importing folders...');
    const folders = await readAndParse<Folder>('folders');
    if (folders && folders.length > 0) {
      const dbFolders: DBFolder[] = folders.map((f) => ({
        ...f,
        createdAt: new Date(f.createdAt).getTime(),
      })) as DBFolder[];
      await db.folders.bulkPut(dbFolders);
    }

    // Import subscriptions
    onProgress?.(88, 'Importing subscriptions...');
    const subscriptions = await readAndParse<Subscription>('subscriptions');
    if (subscriptions && subscriptions.length > 0) {
      const dbSubscriptions: DBSubscription[] = subscriptions.map((s) => ({
        ...s,
        lastRenewalDate: new Date(s.lastRenewalDate).getTime(),
        nextRenewalDate: s.nextRenewalDate ? new Date(s.nextRenewalDate).getTime() : undefined,
        emailIds: JSON.stringify(s.emailIds || []),
      })) as unknown as DBSubscription[];
      await db.subscriptions.bulkPut(dbSubscriptions);
    }

    // Import newsletters
    onProgress?.(95, 'Importing newsletters...');
    const newsletters = await readAndParse<Newsletter>('newsletters');
    if (newsletters && newsletters.length > 0) {
      const dbNewsletters: DBNewsletter[] = newsletters.map((n) => ({
        ...n,
        lastEmailDate: new Date(n.lastEmailDate).getTime(),
      })) as DBNewsletter[];
      await db.newsletters.bulkPut(dbNewsletters);
    }

    onProgress?.(100, 'Import complete!');

    return metadata;
  }

  /**
   * Get backup info without importing
   */
  async getBackupInfo(file: File): Promise<BackupMetadata> {
    const zip = await JSZip.loadAsync(file);
    const metadataFile = zip.file('metadata.json');

    if (!metadataFile) {
      throw new Error('Invalid backup file: missing metadata');
    }

    return JSON.parse(await metadataFile.async('string'));
  }

  /**
   * Download a backup file
   */
  downloadBackup(blob: Blob, filename?: string): void {
    const name = filename || `email-analyzer-backup-${new Date().toISOString().split('T')[0]}.zip`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all data (factory reset)
   */
  async clearAllData(): Promise<void> {
    await db.emails.clear();
    await db.accounts.clear();
    await db.purchases.clear();
    await db.contacts.clear();
    await db.calendarEvents.clear();
    await db.folders.clear();
    await db.subscriptions.clear();
    await db.newsletters.clear();
  }
}

export const backupService = new BackupService();

