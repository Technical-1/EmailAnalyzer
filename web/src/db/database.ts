import Dexie, { type EntityTable } from 'dexie';
import type { Email, Account, Purchase, Contact, CalendarEvent, Folder, Subscription, Newsletter } from '../types';
import { SYSTEM_FOLDERS } from '../types';

const SYSTEM_FOLDER_IDS: Set<string> = new Set(Object.values(SYSTEM_FOLDERS));

// Database email type (with id required)
interface DBEmail extends Omit<Email, 'date'> {
  id: number;
  date: number; // Store as timestamp
}

interface DBAccount extends Omit<Account, 'signupDate' | 'lastActivityDate'> {
  id: number;
  signupDate: number;
  lastActivityDate?: number;
}

interface DBPurchase extends Omit<Purchase, 'purchaseDate'> {
  id: number;
  purchaseDate: number;
}

interface DBContact extends Omit<Contact, 'lastEmailDate'> {
  id: number;
  lastEmailDate: number;
}

interface DBCalendarEvent extends Omit<CalendarEvent, 'startDate' | 'endDate'> {
  id: number;
  startDate: number;
  endDate: number;
}

interface DBFolder extends Omit<Folder, 'createdAt'> {
  createdAt: number;
}

interface DBSubscription extends Omit<Subscription, 'lastRenewalDate' | 'nextRenewalDate'> {
  id: number;
  lastRenewalDate: number;
  nextRenewalDate?: number;
}

interface DBNewsletter extends Omit<Newsletter, 'lastEmailDate'> {
  id: number;
  lastEmailDate: number;
}

// Database class
class EmailAnalyzerDB extends Dexie {
  emails!: EntityTable<DBEmail, 'id'>;
  accounts!: EntityTable<DBAccount, 'id'>;
  purchases!: EntityTable<DBPurchase, 'id'>;
  contacts!: EntityTable<DBContact, 'id'>;
  calendarEvents!: EntityTable<DBCalendarEvent, 'id'>;
  folders!: EntityTable<DBFolder, 'id'>;
  subscriptions!: EntityTable<DBSubscription, 'id'>;
  newsletters!: EntityTable<DBNewsletter, 'id'>;

  constructor() {
    super('EmailAnalyzerDB');
    
    this.version(1).stores({
      emails: '++id, subject, sender, date, emailType, folderId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category',
      contacts: '++id, name, email, emailCount',
      calendarEvents: '++id, title, startDate, endDate, isAllDay',
    });
    
    // Version 2 adds folders table
    this.version(2).stores({
      emails: '++id, subject, sender, date, emailType, folderId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category',
      contacts: '++id, name, email, emailCount',
      calendarEvents: '++id, title, startDate, endDate, isAllDay',
      folders: 'id, name, isSystem, createdAt',
    });

    // Version 3 adds composite indexes for performance
    this.version(3).stores({
      emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
      contacts: '++id, name, email, emailCount, lastEmailDate',
      calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
      folders: 'id, name, isSystem, createdAt',
    });

    // Version 4 adds subscriptions and newsletters tables
    this.version(4).stores({
      emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
      contacts: '++id, name, email, emailCount, lastEmailDate',
      calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
      folders: 'id, name, isSystem, createdAt',
      subscriptions: '++id, serviceName, category, isActive, lastRenewalDate',
      newsletters: '++id, senderEmail, isPromotional, lastEmailDate',
    });
  }
}

// Database instance
export const db = new EmailAnalyzerDB();

// ==================== EMAIL OPERATIONS ====================

export const insertEmail = async (email: Omit<Email, 'id'>): Promise<number> => {
  return await db.emails.add({
    ...email,
    date: email.date.getTime(),
  } as DBEmail);
};

export const getEmails = async (): Promise<Email[]> => {
  const dbEmails = await db.emails.orderBy('date').reverse().toArray();
  return dbEmails.map(dbEmailToEmail);
};

export const getEmailById = async (id: number): Promise<Email | undefined> => {
  const dbEmail = await db.emails.get(id);
  return dbEmail ? dbEmailToEmail(dbEmail) : undefined;
};

export const updateEmailRead = async (id: number, isRead: boolean): Promise<void> => {
  await db.emails.update(id, { isRead });
};

export const updateEmailStar = async (id: number, isStarred: boolean): Promise<void> => {
  await db.emails.update(id, { isStarred });
};

export const updateEmailFolder = async (id: number, folderId: string): Promise<void> => {
  await db.emails.update(id, { folderId });
};

export const deleteEmail = async (id: number): Promise<void> => {
  await db.emails.delete(id);
};

export const deleteEmails = async (ids: number[]): Promise<void> => {
  await db.emails.bulkDelete(ids);
};

const dbEmailToEmail = (dbEmail: DBEmail): Email => ({
  ...dbEmail,
  date: new Date(dbEmail.date),
});

// Bulk insert emails for performance
export const bulkInsertEmails = async (emails: Omit<Email, 'id'>[]): Promise<number[]> => {
  const dbEmails = emails.map(email => ({
    ...email,
    date: email.date.getTime(),
  })) as DBEmail[];
  
  return await db.emails.bulkAdd(dbEmails, { allKeys: true }) as number[];
};

// Get emails by folder with pagination (lazy loading)
export const getEmailsByFolderPaginated = async (
  folderId: string,
  offset: number,
  limit: number
): Promise<Email[]> => {
  const dbEmails = await db.emails
    .where('[folderId+date]')
    .between([folderId, Dexie.minKey], [folderId, Dexie.maxKey])
    .reverse()
    .offset(offset)
    .limit(limit)
    .toArray();
  return dbEmails.map(dbEmailToEmail);
};

// Get email count by folder
export const getEmailCountByFolder = async (folderId: string): Promise<number> => {
  return await db.emails.where('folderId').equals(folderId).count();
};

// Get email headers only (for lazy loading - body loaded on demand)
export const getEmailHeaders = async (): Promise<Omit<Email, 'body' | 'htmlBody'>[]> => {
  const dbEmails = await db.emails.orderBy('date').reverse().toArray();
  return dbEmails.map(dbEmail => {
    const email = dbEmailToEmail(dbEmail);
    const { body, htmlBody, ...rest } = email;
    void body; void htmlBody;
    return rest as Omit<Email, 'body' | 'htmlBody'>;
  });
};

// Get email body by ID (for lazy loading)
export const getEmailBody = async (id: number): Promise<{ body: string; htmlBody?: string } | undefined> => {
  const dbEmail = await db.emails.get(id);
  if (!dbEmail) return undefined;
  return { body: dbEmail.body, htmlBody: dbEmail.htmlBody };
};

// ==================== ACCOUNT OPERATIONS ====================

export const insertAccount = async (account: Omit<Account, 'id'>): Promise<number> => {
  return await db.accounts.add({
    ...account,
    signupDate: account.signupDate.getTime(),
    lastActivityDate: account.lastActivityDate?.getTime(),
  } as DBAccount);
};

export const getAccounts = async (): Promise<Account[]> => {
  const dbAccounts = await db.accounts.orderBy('serviceName').toArray();
  return dbAccounts.map(dbAccountToAccount);
};

export const getAccountByServiceName = async (serviceName: string): Promise<Account | undefined> => {
  const dbAccount = await db.accounts.where('serviceName').equals(serviceName).first();
  return dbAccount ? dbAccountToAccount(dbAccount) : undefined;
};

const dbAccountToAccount = (dbAccount: DBAccount): Account => ({
  ...dbAccount,
  signupDate: new Date(dbAccount.signupDate),
  lastActivityDate: dbAccount.lastActivityDate ? new Date(dbAccount.lastActivityDate) : undefined,
});

// ==================== PURCHASE OPERATIONS ====================

export const insertPurchase = async (purchase: Omit<Purchase, 'id'>): Promise<number> => {
  return await db.purchases.add({
    ...purchase,
    purchaseDate: purchase.purchaseDate.getTime(),
  } as DBPurchase);
};

export const findDuplicatePurchase = async (
  merchant: string,
  amount: number,
  purchaseDate: Date,
  orderNumber?: string
): Promise<Purchase | undefined> => {
  const dateTimestamp = purchaseDate.getTime();
  // Allow 24 hour window for date matching
  const dayStart = dateTimestamp - (dateTimestamp % 86400000);
  const dayEnd = dayStart + 86400000;
  
  const candidates = await db.purchases
    .where('merchant')
    .equals(merchant)
    .and(p => p.amount === amount && p.purchaseDate >= dayStart && p.purchaseDate < dayEnd)
    .toArray();
  
  // If we have an order number, use that for precise matching
  if (orderNumber) {
    const match = candidates.find(p => p.orderNumber === orderNumber);
    if (match) return dbPurchaseToPurchase(match);
  }
  
  // Otherwise, just check if there's any match with same merchant + amount + date
  if (candidates.length > 0) {
    return dbPurchaseToPurchase(candidates[0]);
  }
  
  return undefined;
};

export const getPurchases = async (): Promise<Purchase[]> => {
  const dbPurchases = await db.purchases.orderBy('purchaseDate').reverse().toArray();
  return dbPurchases.map(dbPurchaseToPurchase);
};

const dbPurchaseToPurchase = (dbPurchase: DBPurchase): Purchase => ({
  ...dbPurchase,
  purchaseDate: new Date(dbPurchase.purchaseDate),
});

// ==================== CONTACT OPERATIONS ====================

export const insertContact = async (contact: Omit<Contact, 'id'>): Promise<number> => {
  return await db.contacts.add({
    ...contact,
    lastEmailDate: contact.lastEmailDate.getTime(),
  } as DBContact);
};

export const getContacts = async (): Promise<Contact[]> => {
  const dbContacts = await db.contacts.orderBy('name').toArray();
  return dbContacts.map(dbContactToContact);
};

export const getContactByEmail = async (email: string): Promise<Contact | undefined> => {
  const dbContact = await db.contacts.where('email').equals(email).first();
  return dbContact ? dbContactToContact(dbContact) : undefined;
};

export const updateContactEmailCount = async (email: string, count: number, lastDate: Date): Promise<void> => {
  const contact = await db.contacts.where('email').equals(email).first();
  if (contact) {
    await db.contacts.update(contact.id, { 
      emailCount: count, 
      lastEmailDate: lastDate.getTime() 
    });
  }
};

export const updateContact = async (
  id: number, 
  updates: Partial<Pick<Contact, 'phone' | 'notes' | 'tags'>>
): Promise<void> => {
  await db.contacts.update(id, updates);
};

const dbContactToContact = (dbContact: DBContact): Contact => ({
  ...dbContact,
  lastEmailDate: new Date(dbContact.lastEmailDate),
});

// Bulk insert contacts for performance
export const bulkInsertContacts = async (contacts: Omit<Contact, 'id'>[]): Promise<number[]> => {
  const dbContacts = contacts.map(contact => ({
    ...contact,
    lastEmailDate: contact.lastEmailDate.getTime(),
  })) as DBContact[];
  
  return await db.contacts.bulkAdd(dbContacts, { allKeys: true }) as number[];
};

// ==================== CALENDAR EVENT OPERATIONS ====================

export const insertCalendarEvent = async (event: Omit<CalendarEvent, 'id'>): Promise<number> => {
  return await db.calendarEvents.add({
    ...event,
    startDate: event.startDate.getTime(),
    endDate: event.endDate.getTime(),
  } as DBCalendarEvent);
};

export const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  const dbEvents = await db.calendarEvents.orderBy('startDate').toArray();
  return dbEvents.map(dbEventToEvent);
};

export const updateCalendarEventRead = async (id: number, isRead: boolean): Promise<void> => {
  await db.calendarEvents.update(id, { isRead });
};

export const deleteCalendarEvent = async (id: number): Promise<void> => {
  await db.calendarEvents.delete(id);
};

export const deleteCalendarEvents = async (ids: number[]): Promise<void> => {
  await db.calendarEvents.bulkDelete(ids);
};

const dbEventToEvent = (dbEvent: DBCalendarEvent): CalendarEvent => ({
  ...dbEvent,
  startDate: new Date(dbEvent.startDate),
  endDate: new Date(dbEvent.endDate),
});

// Bulk insert calendar events for performance
export const bulkInsertCalendarEvents = async (events: Omit<CalendarEvent, 'id'>[]): Promise<number[]> => {
  const dbEvents = events.map(event => ({
    ...event,
    startDate: event.startDate.getTime(),
    endDate: event.endDate.getTime(),
  })) as DBCalendarEvent[];
  
  return await db.calendarEvents.bulkAdd(dbEvents, { allKeys: true }) as number[];
};

// ==================== FOLDER OPERATIONS ====================

export const getFolders = async (): Promise<Folder[]> => {
  const dbFolders = await db.folders.orderBy('createdAt').toArray();
  return dbFolders.map(dbFolderToFolder);
};

export const createFolder = async (folder: Folder): Promise<void> => {
  await db.folders.add({
    ...folder,
    createdAt: folder.createdAt.getTime(),
  });
};

/**
 * Create a folder if it doesn't already exist
 * Returns true if created, false if already existed
 */
export const ensureFolderExists = async (folderId: string, folderName?: string): Promise<boolean> => {
  const existing = await db.folders.get(folderId);
  if (existing) return false;
  
  // Create the folder
  await db.folders.add({
    id: folderId,
    name: folderName || folderId.charAt(0).toUpperCase() + folderId.slice(1).replace(/-/g, ' '),
    isSystem: SYSTEM_FOLDER_IDS.has(folderId),
    createdAt: Date.now(),
  });
  
  return true;
};

/**
 * Ensure multiple folders exist (for batch import)
 */
export const ensureFoldersExist = async (folderIds: string[]): Promise<void> => {
  const existingFolders = await db.folders.toArray();
  const existingIds = new Set(existingFolders.map(f => f.id));
  
  const foldersToCreate = folderIds.filter(id => !existingIds.has(id));
  
  for (const folderId of foldersToCreate) {
    await db.folders.add({
      id: folderId,
      name: folderId.charAt(0).toUpperCase() + folderId.slice(1).replace(/-/g, ' '),
      isSystem: SYSTEM_FOLDER_IDS.has(folderId),
      createdAt: Date.now(),
    });
  }
};

export const deleteFolder = async (id: string): Promise<void> => {
  // Move all emails from this folder back to inbox before deleting
  const emails = await db.emails.where('folderId').equals(id).toArray();
  await Promise.all(emails.map(e => db.emails.update(e.id, { folderId: SYSTEM_FOLDERS.INBOX })));
  await db.folders.delete(id);
};

export const updateFolder = async (id: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon'>>): Promise<void> => {
  await db.folders.update(id, updates);
};

const dbFolderToFolder = (dbFolder: DBFolder): Folder => ({
  ...dbFolder,
  createdAt: new Date(dbFolder.createdAt),
});

// Initialize default system folders
export const initializeSystemFolders = async (): Promise<void> => {
  const existingFolders = await db.folders.toArray();
  const systemFolders = [
    { id: SYSTEM_FOLDERS.INBOX, name: 'Inbox' },
    { id: SYSTEM_FOLDERS.SENT, name: 'Sent' },
    { id: SYSTEM_FOLDERS.DRAFTS, name: 'Drafts' },
    { id: SYSTEM_FOLDERS.SPAM, name: 'Spam' },
    { id: SYSTEM_FOLDERS.ARCHIVE, name: 'Archive' },
    { id: SYSTEM_FOLDERS.TRASH, name: 'Trash' },
  ];
  
  for (const folder of systemFolders) {
    if (!existingFolders.find(f => f.id === folder.id)) {
      await db.folders.add({
        id: folder.id,
        name: folder.name,
        isSystem: true,
        createdAt: Date.now(),
      });
    }
  }
};

// ==================== SUBSCRIPTION OPERATIONS ====================

export const insertSubscription = async (subscription: Omit<Subscription, 'id'>): Promise<number> => {
  return await db.subscriptions.add({
    ...subscription,
    lastRenewalDate: subscription.lastRenewalDate.getTime(),
    nextRenewalDate: subscription.nextRenewalDate?.getTime(),
  } as DBSubscription);
};

export const getSubscriptions = async (): Promise<Subscription[]> => {
  const dbSubscriptions = await db.subscriptions.orderBy('serviceName').toArray();
  return dbSubscriptions.map(dbSubscriptionToSubscription);
};

export const getSubscriptionByServiceName = async (serviceName: string): Promise<Subscription | undefined> => {
  const dbSubscription = await db.subscriptions.where('serviceName').equals(serviceName).first();
  return dbSubscription ? dbSubscriptionToSubscription(dbSubscription) : undefined;
};

export const updateSubscription = async (
  id: number,
  updates: Partial<Pick<Subscription, 'isActive' | 'emailIds' | 'monthlyAmount' | 'lastRenewalDate'>>
): Promise<void> => {
  const updateData: Partial<{ isActive: boolean; emailIds: number[]; monthlyAmount: number; lastRenewalDate: number }> = {};
  if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
  if (updates.emailIds !== undefined) updateData.emailIds = updates.emailIds;
  if (updates.monthlyAmount !== undefined) updateData.monthlyAmount = updates.monthlyAmount;
  if (updates.lastRenewalDate) updateData.lastRenewalDate = updates.lastRenewalDate.getTime();
  await db.subscriptions.update(id, updateData);
};

const dbSubscriptionToSubscription = (dbSub: DBSubscription): Subscription => ({
  ...dbSub,
  lastRenewalDate: new Date(dbSub.lastRenewalDate),
  nextRenewalDate: dbSub.nextRenewalDate ? new Date(dbSub.nextRenewalDate) : undefined,
});

// ==================== NEWSLETTER OPERATIONS ====================

export const insertNewsletter = async (newsletter: Omit<Newsletter, 'id'>): Promise<number> => {
  return await db.newsletters.add({
    ...newsletter,
    lastEmailDate: newsletter.lastEmailDate.getTime(),
  } as DBNewsletter);
};

export const getNewsletters = async (): Promise<Newsletter[]> => {
  const dbNewsletters = await db.newsletters.orderBy('senderEmail').toArray();
  return dbNewsletters.map(dbNewsletterToNewsletter);
};

export const getNewsletterBySender = async (senderEmail: string): Promise<Newsletter | undefined> => {
  const dbNewsletter = await db.newsletters.where('senderEmail').equals(senderEmail).first();
  return dbNewsletter ? dbNewsletterToNewsletter(dbNewsletter) : undefined;
};

export const updateNewsletter = async (
  id: number,
  updates: Partial<Pick<Newsletter, 'emailCount' | 'lastEmailDate' | 'unsubscribeLink'>>
): Promise<void> => {
  const updateData: Partial<{ emailCount: number; lastEmailDate: number; unsubscribeLink: string }> = {};
  if (updates.emailCount !== undefined) updateData.emailCount = updates.emailCount;
  if (updates.lastEmailDate) updateData.lastEmailDate = updates.lastEmailDate.getTime();
  if (updates.unsubscribeLink !== undefined) updateData.unsubscribeLink = updates.unsubscribeLink;
  await db.newsletters.update(id, updateData);
};

const dbNewsletterToNewsletter = (dbNL: DBNewsletter): Newsletter => ({
  ...dbNL,
  lastEmailDate: new Date(dbNL.lastEmailDate),
});

// ==================== UTILITY OPERATIONS ====================

export const clearAllData = async (): Promise<void> => {
  await Promise.all([
    db.emails.clear(),
    db.accounts.clear(),
    db.purchases.clear(),
    db.contacts.clear(),
    db.calendarEvents.clear(),
    db.folders.clear(),
    db.subscriptions.clear(),
    db.newsletters.clear(),
  ]);
};

// ==================== EXPORT OPERATIONS ====================

export interface ExportData {
  version: string;
  exportDate: string;
  emails: Email[];
  accounts: Account[];
  purchases: Purchase[];
  contacts: Contact[];
  calendarEvents: CalendarEvent[];
  folders: Folder[];
  subscriptions: Subscription[];
  newsletters: Newsletter[];
}

export const exportAllData = async (): Promise<ExportData> => {
  const [emails, accounts, purchases, contacts, calendarEvents, folders, subscriptions, newsletters] = await Promise.all([
    getEmails(),
    getAccounts(),
    getPurchases(),
    getContacts(),
    getCalendarEvents(),
    getFolders(),
    getSubscriptions(),
    getNewsletters(),
  ]);
  
  return {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    emails,
    accounts,
    purchases,
    contacts,
    calendarEvents,
    folders,
    subscriptions,
    newsletters,
  };
};

