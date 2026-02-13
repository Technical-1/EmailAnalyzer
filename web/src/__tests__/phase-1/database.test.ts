import { describe, it, expect, beforeEach } from 'vitest';
import {
  insertEmail,
  getEmails,
  getEmailById,
  bulkInsertEmails,
  bulkInsertContacts,
  bulkInsertCalendarEvents,
  clearAllData,
  getEmailsByFolderPaginated,
  getEmailCountByFolder,
} from '../../db/database';
import type { Email, Contact, CalendarEvent } from '../../types';

describe('Database Operations', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  describe('Email Operations', () => {
    const mockEmail: Omit<Email, 'id'> = {
      subject: 'Test Subject',
      sender: 'test@example.com',
      recipients: ['recipient@example.com'],
      date: new Date('2024-01-15'),
      body: 'Test body content',
      attachments: [],
      size: 1024,
      isRead: false,
      isStarred: false,
      folderId: 'inbox',
      emailType: 'regular',
    };

    it('should insert and retrieve an email', async () => {
      const id = await insertEmail(mockEmail);
      expect(id).toBeGreaterThan(0);

      const retrieved = await getEmailById(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.subject).toBe(mockEmail.subject);
      expect(retrieved?.sender).toBe(mockEmail.sender);
    });

    it('should bulk insert emails', async () => {
      const emails: Omit<Email, 'id'>[] = [
        { ...mockEmail, subject: 'Email 1' },
        { ...mockEmail, subject: 'Email 2' },
        { ...mockEmail, subject: 'Email 3' },
      ];

      const ids = await bulkInsertEmails(emails);
      expect(ids).toHaveLength(3);

      const allEmails = await getEmails();
      expect(allEmails).toHaveLength(3);
    });

    it('should get emails by folder with pagination', async () => {
      // Insert 10 emails
      const emails: Omit<Email, 'id'>[] = [];
      for (let i = 0; i < 10; i++) {
        emails.push({
          ...mockEmail,
          subject: `Email ${i}`,
          date: new Date(Date.now() - i * 86400000), // Different dates
        });
      }
      await bulkInsertEmails(emails);

      // Get first page
      const page1 = await getEmailsByFolderPaginated('inbox', 0, 5);
      expect(page1).toHaveLength(5);

      // Get second page
      const page2 = await getEmailsByFolderPaginated('inbox', 5, 5);
      expect(page2).toHaveLength(5);
    });

    it('should count emails by folder', async () => {
      await bulkInsertEmails([
        { ...mockEmail, folderId: 'inbox' },
        { ...mockEmail, folderId: 'inbox' },
        { ...mockEmail, folderId: 'archive' },
      ]);

      const inboxCount = await getEmailCountByFolder('inbox');
      expect(inboxCount).toBe(2);

      const archiveCount = await getEmailCountByFolder('archive');
      expect(archiveCount).toBe(1);
    });
  });

  describe('Contact Operations', () => {
    it('should bulk insert contacts', async () => {
      const contacts: Omit<Contact, 'id'>[] = [
        { name: 'John Doe', email: 'john@example.com', emailCount: 5, lastEmailDate: new Date() },
        { name: 'Jane Doe', email: 'jane@example.com', emailCount: 3, lastEmailDate: new Date() },
      ];

      const ids = await bulkInsertContacts(contacts);
      expect(ids).toHaveLength(2);
    });
  });

  describe('Calendar Event Operations', () => {
    it('should bulk insert calendar events', async () => {
      const events: Omit<CalendarEvent, 'id'>[] = [
        {
          title: 'Meeting 1',
          startDate: new Date(),
          endDate: new Date(),
          attendees: [],
          isAllDay: false,
          isRead: false,
        },
        {
          title: 'Meeting 2',
          startDate: new Date(),
          endDate: new Date(),
          attendees: [],
          isAllDay: false,
          isRead: false,
        },
      ];

      const ids = await bulkInsertCalendarEvents(events);
      expect(ids).toHaveLength(2);
    });
  });
});

