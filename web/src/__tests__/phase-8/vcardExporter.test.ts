import { describe, it, expect } from 'vitest';
import { vcardExporter } from '../../services/vcardExporter';
import type { Contact } from '../../types';

const testDate = new Date('2024-01-01');

describe('VCardExporter', () => {
  describe('contactToVCard', () => {
    it('should create a valid vCard for a contact with name and email', () => {
      const contact: Contact = {
        name: 'John Doe',
        email: 'john@example.com',
        emailCount: 10,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('BEGIN:VCARD');
      expect(vcard).toContain('VERSION:3.0');
      expect(vcard).toContain('FN:John Doe');
      expect(vcard).toContain('N:Doe;John;;;');
      expect(vcard).toContain('EMAIL;TYPE=INTERNET:john@example.com');
      expect(vcard).toContain('NOTE:Exchanged 10 emails');
      expect(vcard).toContain('END:VCARD');
    });

    it('should handle contact with only email', () => {
      const contact: Contact = {
        name: '',
        email: 'unknown@example.com',
        emailCount: 5,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('FN:unknown@example.com');
      expect(vcard).toContain('N:;;;;');
    });

    it('should handle contact with single name', () => {
      const contact: Contact = {
        name: 'Madonna',
        email: 'madonna@example.com',
        emailCount: 1,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('N:;Madonna;;;');
      expect(vcard).toContain('FN:Madonna');
    });

    it('should handle multi-word names correctly', () => {
      const contact: Contact = {
        name: 'Mary Jane Watson',
        email: 'mj@example.com',
        emailCount: 3,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('N:Watson;Mary Jane;;;');
      expect(vcard).toContain('FN:Mary Jane Watson');
    });

    it('should escape special characters', () => {
      const contact: Contact = {
        name: 'John; Doe, Jr.',
        email: 'john@example.com',
        emailCount: 1,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('FN:John\\; Doe\\, Jr.');
    });

    it('should include phone if provided', () => {
      const contact: Contact = {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1-555-123-4567',
        emailCount: 2,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('TEL;TYPE=CELL:+1-555-123-4567');
    });

    it('should include organization if provided', () => {
      const contact: Contact = {
        name: 'John Doe',
        email: 'john@example.com',
        organization: 'Acme Corp',
        emailCount: 5,
        lastEmailDate: testDate,
      };

      const vcard = vcardExporter.contactToVCard(contact);

      expect(vcard).toContain('ORG:Acme Corp');
    });
  });

  describe('contactsToVCard', () => {
    it('should combine multiple contacts into one vCard file', () => {
      const contacts: Contact[] = [
        { name: 'John Doe', email: 'john@example.com', emailCount: 5, lastEmailDate: testDate },
        { name: 'Jane Smith', email: 'jane@example.com', emailCount: 3, lastEmailDate: testDate },
      ];

      const vcard = vcardExporter.contactsToVCard(contacts);

      // Should contain two vCards
      const vcardMatches = vcard.match(/BEGIN:VCARD/g);
      expect(vcardMatches).toHaveLength(2);

      expect(vcard).toContain('FN:John Doe');
      expect(vcard).toContain('FN:Jane Smith');
    });

    it('should handle empty array', () => {
      const vcard = vcardExporter.contactsToVCard([]);
      expect(vcard).toBe('');
    });
  });

  describe('createVCard', () => {
    it('should create a vCard from basic info', () => {
      const vcard = vcardExporter.createVCard('Test User', 'test@example.com');

      expect(vcard).toContain('BEGIN:VCARD');
      expect(vcard).toContain('FN:Test User');
      expect(vcard).toContain('EMAIL;TYPE=INTERNET:test@example.com');
      expect(vcard).toContain('END:VCARD');
    });

    it('should include phone if provided', () => {
      const vcard = vcardExporter.createVCard('Test User', 'test@example.com', '+1-555-0000');

      expect(vcard).toContain('TEL;TYPE=CELL:+1-555-0000');
    });
  });
});
