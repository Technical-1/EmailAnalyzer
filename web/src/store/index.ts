import { create } from 'zustand';
import type { Email, Account, Purchase, Contact, CalendarEvent } from '../types';
import {
  getEmails,
  getAccounts,
  getPurchases,
  getContacts,
  getCalendarEvents,
  clearAllData as clearDB,
} from '../db/database';

interface AppState {
  // Data
  emails: Email[];
  accounts: Account[];
  purchases: Purchase[];
  contacts: Contact[];
  calendarEvents: CalendarEvent[];
  
  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  
  // Stats
  totalEmailCount: number;
  
  // Actions
  initialize: () => Promise<void>;
  refreshEmails: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshPurchases: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  refreshCalendarEvents: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearAll: () => Promise<void>;
  
  // Selectors
  getEmailById: (id: number) => Email | undefined;
  searchEmails: (query: string) => Email[];
  getFilteredEmails: (filter: 'all' | 'account_signup' | 'purchase' | 'unread' | 'starred') => Email[];
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  emails: [],
  accounts: [],
  purchases: [],
  contacts: [],
  calendarEvents: [],
  isLoading: false,
  isInitialized: false,
  totalEmailCount: 0,
  
  // Initialize all data from IndexedDB
  initialize: async () => {
    const state = get();
    if (state.isInitialized || state.isLoading) return;
    
    set({ isLoading: true });
    
    try {
      const [emails, accounts, purchases, contacts, calendarEvents] = await Promise.all([
        getEmails(),
        getAccounts(),
        getPurchases(),
        getContacts(),
        getCalendarEvents(),
      ]);
      
      set({
        emails,
        accounts,
        purchases,
        contacts,
        calendarEvents,
        totalEmailCount: emails.length,
        isInitialized: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to initialize store:', error);
      set({ isLoading: false });
    }
  },
  
  // Refresh individual data types
  refreshEmails: async () => {
    try {
      const emails = await getEmails();
      set({ emails, totalEmailCount: emails.length });
    } catch (error) {
      console.error('Failed to refresh emails:', error);
    }
  },
  
  refreshAccounts: async () => {
    try {
      const accounts = await getAccounts();
      set({ accounts });
    } catch (error) {
      console.error('Failed to refresh accounts:', error);
    }
  },
  
  refreshPurchases: async () => {
    try {
      const purchases = await getPurchases();
      set({ purchases });
    } catch (error) {
      console.error('Failed to refresh purchases:', error);
    }
  },
  
  refreshContacts: async () => {
    try {
      const contacts = await getContacts();
      set({ contacts });
    } catch (error) {
      console.error('Failed to refresh contacts:', error);
    }
  },
  
  refreshCalendarEvents: async () => {
    try {
      const calendarEvents = await getCalendarEvents();
      set({ calendarEvents });
    } catch (error) {
      console.error('Failed to refresh calendar events:', error);
    }
  },
  
  // Refresh all data
  refreshAll: async () => {
    set({ isLoading: true });
    
    try {
      const [emails, accounts, purchases, contacts, calendarEvents] = await Promise.all([
        getEmails(),
        getAccounts(),
        getPurchases(),
        getContacts(),
        getCalendarEvents(),
      ]);
      
      set({
        emails,
        accounts,
        purchases,
        contacts,
        calendarEvents,
        totalEmailCount: emails.length,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to refresh all data:', error);
      set({ isLoading: false });
    }
  },
  
  // Clear all data
  clearAll: async () => {
    try {
      await clearDB();
      set({
        emails: [],
        accounts: [],
        purchases: [],
        contacts: [],
        calendarEvents: [],
        totalEmailCount: 0,
        isInitialized: true, // Keep initialized but empty
      });
    } catch (error) {
      console.error('Failed to clear data:', error);
    }
  },
  
  // Get email by ID
  getEmailById: (id: number) => {
    return get().emails.find(e => e.id === id);
  },
  
  // Search emails in memory
  searchEmails: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().emails.filter(email =>
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.sender.toLowerCase().includes(lowerQuery) ||
      email.body.toLowerCase().includes(lowerQuery)
    );
  },
  
  // Get filtered emails
  getFilteredEmails: (filter) => {
    const emails = get().emails;
    switch (filter) {
      case 'account_signup':
        return emails.filter(e => e.emailType === 'account_signup');
      case 'purchase':
        return emails.filter(e => e.emailType === 'purchase');
      case 'unread':
        return emails.filter(e => !e.isRead);
      case 'starred':
        return emails.filter(e => e.isStarred);
      default:
        return emails;
    }
  },
}));

