import { create } from 'zustand';
import type { Email, Account, Purchase, Contact, CalendarEvent, Folder, Subscription, Newsletter, EmailThread } from '../types';
import { SYSTEM_FOLDERS } from '../types';
import {
  getEmails,
  getAccounts,
  getPurchases,
  getContacts,
  getCalendarEvents,
  getFolders,
  getSubscriptions,
  getNewsletters,
  clearAllData as clearDB,
  updateEmailStar,
  updateEmailRead,
  updateEmailFolder,
  deleteEmail as deleteEmailDB,
  deleteEmails as deleteEmailsDB,
  createFolder as createFolderDB,
  deleteFolder as deleteFolderDB,
  initializeSystemFolders,
  exportAllData,
  updateContact as updateContactDB,
  updateCalendarEventRead as updateCalendarEventReadDB,
  deleteCalendarEvent as deleteCalendarEventDB,
  deleteCalendarEvents as deleteCalendarEventsDB,
  type ExportData,
} from '../db/database';
import { threadingService } from '../services/threadingService';

interface AppState {
  // Data
  emails: Email[];
  accounts: Account[];
  purchases: Purchase[];
  contacts: Contact[];
  calendarEvents: CalendarEvent[];
  folders: Folder[];
  subscriptions: Subscription[];
  newsletters: Newsletter[];
  threads: EmailThread[];
  
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
  refreshFolders: () => Promise<void>;
  refreshSubscriptions: () => Promise<void>;
  refreshNewsletters: () => Promise<void>;
  refreshAll: () => Promise<void>;
  clearAll: () => Promise<void>;
  
  // Selectors
  getEmailById: (id: number) => Email | undefined;
  getEmailsByFolder: (folderId: string) => Email[];
  
  // Email actions
  toggleEmailStar: (id: number) => Promise<void>;
  toggleEmailRead: (id: number) => Promise<void>;
  markEmailAsRead: (id: number) => Promise<void>;
  deleteEmail: (id: number) => Promise<void>;
  deleteEmails: (ids: number[]) => Promise<void>;
  archiveEmail: (id: number) => Promise<void>;
  archiveEmails: (ids: number[]) => Promise<void>;
  moveEmailToFolder: (id: number, folderId: string) => Promise<void>;
  restoreEmail: (id: number) => Promise<void>;
  permanentlyDeleteEmail: (id: number) => Promise<void>;
  emptyTrash: () => Promise<void>;
  
  // Folder actions
  createFolder: (name: string, color?: string, icon?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  
  // Contact actions
  updateContact: (id: number, updates: Partial<Pick<Contact, 'phone' | 'notes' | 'tags'>>) => Promise<void>;
  
  // Calendar event actions
  toggleCalendarEventRead: (id: number) => Promise<void>;
  markCalendarEventAsRead: (id: number) => Promise<void>;
  deleteCalendarEvent: (id: number) => Promise<void>;
  deleteCalendarEvents: (ids: number[]) => Promise<void>;
  
  // Export actions
  exportData: () => Promise<ExportData>;
  downloadExport: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  emails: [],
  accounts: [],
  purchases: [],
  contacts: [],
  calendarEvents: [],
  folders: [],
  subscriptions: [],
  newsletters: [],
  threads: [],
  isLoading: false,
  isInitialized: false,
  totalEmailCount: 0,
  
  // Initialize all data from IndexedDB
  initialize: async () => {
    const state = get();
    if (state.isInitialized || state.isLoading) return;
    
    set({ isLoading: true });
    
    try {
      // Initialize system folders first
      await initializeSystemFolders();
      
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
      
      // Pre-compute threads for instant switching
      const threads = threadingService.buildThreads(emails);
      
      set({
        emails,
        accounts,
        purchases,
        contacts,
        calendarEvents,
        folders,
        subscriptions,
        newsletters,
        threads,
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
      const threads = threadingService.buildThreads(emails);
      set({ emails, threads, totalEmailCount: emails.length });
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
  
  refreshFolders: async () => {
    try {
      const folders = await getFolders();
      set({ folders });
    } catch (error) {
      console.error('Failed to refresh folders:', error);
    }
  },
  
  refreshSubscriptions: async () => {
    try {
      const subscriptions = await getSubscriptions();
      set({ subscriptions });
    } catch (error) {
      console.error('Failed to refresh subscriptions:', error);
    }
  },
  
  refreshNewsletters: async () => {
    try {
      const newsletters = await getNewsletters();
      set({ newsletters });
    } catch (error) {
      console.error('Failed to refresh newsletters:', error);
    }
  },
  
  // Refresh all data
  refreshAll: async () => {
    set({ isLoading: true });
    
    try {
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
      
      // Pre-compute threads
      const threads = threadingService.buildThreads(emails);
      
      set({
        emails,
        accounts,
        purchases,
        contacts,
        calendarEvents,
        folders,
        subscriptions,
        newsletters,
        threads,
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
      await initializeSystemFolders();
      const folders = await getFolders();
      set({
        emails: [],
        accounts: [],
        purchases: [],
        contacts: [],
        calendarEvents: [],
        folders,
        subscriptions: [],
        newsletters: [],
        threads: [],
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
  
  // Get emails by folder
  getEmailsByFolder: (folderId: string) => {
    return get().emails.filter(e => e.folderId === folderId);
  },
  
  // Toggle email star status
  toggleEmailStar: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    const newStarred = !email.isStarred;
    
    try {
      await updateEmailStar(id, newStarred);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, isStarred: newStarred } : e
        ),
      });
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  },
  
  // Mark email as read
  markEmailAsRead: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email || email.isRead) return;
    
    try {
      await updateEmailRead(id, true);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, isRead: true } : e
        ),
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },
  
  // Toggle email read/unread status
  toggleEmailRead: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    const newRead = !email.isRead;
    
    try {
      await updateEmailRead(id, newRead);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, isRead: newRead } : e
        ),
      });
    } catch (error) {
      console.error('Failed to toggle read status:', error);
    }
  },
  
  // Delete email (move to trash)
  deleteEmail: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    try {
      await updateEmailFolder(id, SYSTEM_FOLDERS.TRASH);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, folderId: SYSTEM_FOLDERS.TRASH } : e
        ),
      });
    } catch (error) {
      console.error('Failed to delete email:', error);
    }
  },
  
  // Delete multiple emails (move to trash)
  deleteEmails: async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => updateEmailFolder(id, SYSTEM_FOLDERS.TRASH)));
      set({
        emails: get().emails.map(e => 
          ids.includes(e.id!) ? { ...e, folderId: SYSTEM_FOLDERS.TRASH } : e
        ),
      });
    } catch (error) {
      console.error('Failed to delete emails:', error);
    }
  },
  
  // Archive email
  archiveEmail: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    try {
      await updateEmailFolder(id, SYSTEM_FOLDERS.ARCHIVE);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, folderId: SYSTEM_FOLDERS.ARCHIVE } : e
        ),
      });
    } catch (error) {
      console.error('Failed to archive email:', error);
    }
  },
  
  // Archive multiple emails
  archiveEmails: async (ids: number[]) => {
    try {
      await Promise.all(ids.map(id => updateEmailFolder(id, SYSTEM_FOLDERS.ARCHIVE)));
      set({
        emails: get().emails.map(e => 
          ids.includes(e.id!) ? { ...e, folderId: SYSTEM_FOLDERS.ARCHIVE } : e
        ),
      });
    } catch (error) {
      console.error('Failed to archive emails:', error);
    }
  },
  
  // Move email to folder
  moveEmailToFolder: async (id: number, folderId: string) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    try {
      await updateEmailFolder(id, folderId);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, folderId } : e
        ),
      });
    } catch (error) {
      console.error('Failed to move email:', error);
    }
  },
  
  // Restore email from trash to inbox
  restoreEmail: async (id: number) => {
    const email = get().emails.find(e => e.id === id);
    if (!email) return;
    
    try {
      await updateEmailFolder(id, SYSTEM_FOLDERS.INBOX);
      set({
        emails: get().emails.map(e => 
          e.id === id ? { ...e, folderId: SYSTEM_FOLDERS.INBOX } : e
        ),
      });
    } catch (error) {
      console.error('Failed to restore email:', error);
    }
  },
  
  // Permanently delete email
  permanentlyDeleteEmail: async (id: number) => {
    try {
      await deleteEmailDB(id);
      set({
        emails: get().emails.filter(e => e.id !== id),
        totalEmailCount: get().totalEmailCount - 1,
      });
    } catch (error) {
      console.error('Failed to permanently delete email:', error);
    }
  },
  
  // Empty trash (permanently delete all emails in trash)
  emptyTrash: async () => {
    const trashEmails = get().emails.filter(e => e.folderId === SYSTEM_FOLDERS.TRASH);
    const trashIds = trashEmails.map(e => e.id!).filter(id => id !== undefined);
    
    if (trashIds.length === 0) return;
    
    try {
      await deleteEmailsDB(trashIds);
      set({
        emails: get().emails.filter(e => e.folderId !== SYSTEM_FOLDERS.TRASH),
        totalEmailCount: get().totalEmailCount - trashIds.length,
      });
    } catch (error) {
      console.error('Failed to empty trash:', error);
    }
  },
  
  // Create a new folder
  createFolder: async (name: string, color?: string, icon?: string) => {
    const id = `folder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newFolder: Folder = {
      id,
      name,
      isSystem: false,
      color,
      icon,
      createdAt: new Date(),
    };
    
    try {
      await createFolderDB(newFolder);
      set({
        folders: [...get().folders, newFolder],
      });
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  },
  
  // Delete a folder (only non-system folders)
  deleteFolder: async (id: string) => {
    const folder = get().folders.find(f => f.id === id);
    if (!folder || folder.isSystem) return;
    
    try {
      await deleteFolderDB(id);
      // Emails in this folder are automatically moved to inbox by the DB function
      set({
        folders: get().folders.filter(f => f.id !== id),
        emails: get().emails.map(e => 
          e.folderId === id ? { ...e, folderId: SYSTEM_FOLDERS.INBOX } : e
        ),
      });
    } catch (error) {
      console.error('Failed to delete folder:', error);
    }
  },
  
  // Update a contact (add notes, tags, phone)
  updateContact: async (id: number, updates: Partial<Pick<Contact, 'phone' | 'notes' | 'tags'>>) => {
    try {
      await updateContactDB(id, updates);
      set({
        contacts: get().contacts.map(c => 
          c.id === id ? { ...c, ...updates } : c
        ),
      });
    } catch (error) {
      console.error('Failed to update contact:', error);
    }
  },
  
  // Toggle calendar event read/unread status
  toggleCalendarEventRead: async (id: number) => {
    const event = get().calendarEvents.find(e => e.id === id);
    if (!event) return;
    
    const newRead = !event.isRead;
    
    try {
      await updateCalendarEventReadDB(id, newRead);
      set({
        calendarEvents: get().calendarEvents.map(e => 
          e.id === id ? { ...e, isRead: newRead } : e
        ),
      });
    } catch (error) {
      console.error('Failed to toggle calendar event read status:', error);
    }
  },
  
  // Mark calendar event as read
  markCalendarEventAsRead: async (id: number) => {
    const event = get().calendarEvents.find(e => e.id === id);
    if (!event || event.isRead) return;
    
    try {
      await updateCalendarEventReadDB(id, true);
      set({
        calendarEvents: get().calendarEvents.map(e => 
          e.id === id ? { ...e, isRead: true } : e
        ),
      });
    } catch (error) {
      console.error('Failed to mark calendar event as read:', error);
    }
  },
  
  // Delete a calendar event
  deleteCalendarEvent: async (id: number) => {
    try {
      await deleteCalendarEventDB(id);
      set({
        calendarEvents: get().calendarEvents.filter(e => e.id !== id),
      });
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
    }
  },
  
  // Delete multiple calendar events
  deleteCalendarEvents: async (ids: number[]) => {
    try {
      await deleteCalendarEventsDB(ids);
      set({
        calendarEvents: get().calendarEvents.filter(e => !ids.includes(e.id!)),
      });
    } catch (error) {
      console.error('Failed to delete calendar events:', error);
    }
  },
  
  // Export all data
  exportData: async () => {
    return await exportAllData();
  },
  
  // Download export as JSON file
  downloadExport: async () => {
    try {
      const data = await exportAllData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `email-analyzer-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download export:', error);
    }
  },
}));

