import Dexie, { type EntityTable } from 'dexie';
import type { Email, Account, Purchase, Contact, CalendarEvent } from '../types';

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

// Database class
class EmailAnalyzerDB extends Dexie {
  emails!: EntityTable<DBEmail, 'id'>;
  accounts!: EntityTable<DBAccount, 'id'>;
  purchases!: EntityTable<DBPurchase, 'id'>;
  contacts!: EntityTable<DBContact, 'id'>;
  calendarEvents!: EntityTable<DBCalendarEvent, 'id'>;

  constructor() {
    super('EmailAnalyzerDB');
    
    this.version(1).stores({
      emails: '++id, subject, sender, date, emailType, folderId, isRead, isStarred',
      accounts: '++id, serviceName, serviceType, domain, signupDate',
      purchases: '++id, merchant, amount, purchaseDate, category',
      contacts: '++id, name, email, emailCount',
      calendarEvents: '++id, title, startDate, endDate, isAllDay',
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

export const insertEmails = async (emails: Omit<Email, 'id'>[]): Promise<number[]> => {
  const dbEmails = emails.map(email => ({
    ...email,
    date: email.date.getTime(),
  })) as DBEmail[];
  
  return await db.emails.bulkAdd(dbEmails, { allKeys: true }) as number[];
};

export const getEmails = async (): Promise<Email[]> => {
  const dbEmails = await db.emails.orderBy('date').reverse().toArray();
  return dbEmails.map(dbEmailToEmail);
};

export const getEmailById = async (id: number): Promise<Email | undefined> => {
  const dbEmail = await db.emails.get(id);
  return dbEmail ? dbEmailToEmail(dbEmail) : undefined;
};

export const searchEmails = async (query: string): Promise<Email[]> => {
  if (!query.trim()) {
    return getEmails();
  }
  
  const lowercaseQuery = query.toLowerCase();
  const dbEmails = await db.emails.filter(email => 
    email.subject.toLowerCase().includes(lowercaseQuery) ||
    email.body.toLowerCase().includes(lowercaseQuery) ||
    email.sender.toLowerCase().includes(lowercaseQuery)
  ).toArray();
  
  return dbEmails.map(dbEmailToEmail);
};

export const getEmailsByType = async (type: Email['emailType']): Promise<Email[]> => {
  const dbEmails = await db.emails.where('emailType').equals(type).toArray();
  return dbEmails.map(dbEmailToEmail);
};

export const updateEmailRead = async (id: number, isRead: boolean): Promise<void> => {
  await db.emails.update(id, { isRead });
};

export const updateEmailStar = async (id: number, isStarred: boolean): Promise<void> => {
  await db.emails.update(id, { isStarred });
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

const dbEventToEvent = (dbEvent: DBCalendarEvent): CalendarEvent => ({
  ...dbEvent,
  startDate: new Date(dbEvent.startDate),
  endDate: new Date(dbEvent.endDate),
});

// ==================== UTILITY OPERATIONS ====================

export const clearAllData = async (): Promise<void> => {
  await Promise.all([
    db.emails.clear(),
    db.accounts.clear(),
    db.purchases.clear(),
    db.contacts.clear(),
    db.calendarEvents.clear(),
  ]);
};

export const getEmailCount = async (): Promise<number> => {
  return await db.emails.count();
};

export const getAccountCount = async (): Promise<number> => {
  return await db.accounts.count();
};

export const getPurchaseCount = async (): Promise<number> => {
  return await db.purchases.count();
};

export const getTotalPurchaseAmount = async (): Promise<number> => {
  const purchases = await db.purchases.toArray();
  return purchases.reduce((sum, p) => sum + p.amount, 0);
};

