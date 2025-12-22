import Dexie, { type EntityTable } from 'dexie';
import type { Email, Account, Purchase, Contact, CalendarEvent, Folder } from '../types';

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

// Database class
class EmailAnalyzerDB extends Dexie {
  emails!: EntityTable<DBEmail, 'id'>;
  accounts!: EntityTable<DBAccount, 'id'>;
  purchases!: EntityTable<DBPurchase, 'id'>;
  contacts!: EntityTable<DBContact, 'id'>;
  calendarEvents!: EntityTable<DBCalendarEvent, 'id'>;
  folders!: EntityTable<DBFolder, 'id'>;

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

export const deleteFolder = async (id: string): Promise<void> => {
  // Move all emails from this folder back to inbox before deleting
  const emails = await db.emails.where('folderId').equals(id).toArray();
  await Promise.all(emails.map(e => db.emails.update(e.id, { folderId: 'inbox' })));
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
  const systemFolderIds = ['inbox', 'archive', 'trash'];
  
  for (const folderId of systemFolderIds) {
    if (!existingFolders.find(f => f.id === folderId)) {
      await db.folders.add({
        id: folderId,
        name: folderId.charAt(0).toUpperCase() + folderId.slice(1),
        isSystem: true,
        createdAt: Date.now(),
      });
    }
  }
};

// ==================== UTILITY OPERATIONS ====================

export const clearAllData = async (): Promise<void> => {
  await Promise.all([
    db.emails.clear(),
    db.accounts.clear(),
    db.purchases.clear(),
    db.contacts.clear(),
    db.calendarEvents.clear(),
    db.folders.clear(),
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
}

export const exportAllData = async (): Promise<ExportData> => {
  const [emails, accounts, purchases, contacts, calendarEvents, folders] = await Promise.all([
    getEmails(),
    getAccounts(),
    getPurchases(),
    getContacts(),
    getCalendarEvents(),
    getFolders(),
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
  };
};

