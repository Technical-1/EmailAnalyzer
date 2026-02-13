import type { Contact } from '../types';

/**
 * vCard Exporter
 * Exports contacts to vCard 3.0 format
 */
class VCardExporter {
  /**
   * Convert a single contact to vCard format
   */
  contactToVCard(contact: Contact): string {
    const lines: string[] = [
      'BEGIN:VCARD',
      'VERSION:3.0',
    ];

    // Name
    if (contact.name) {
      const nameParts = this.parseName(contact.name);
      lines.push(`N:${nameParts.lastName};${nameParts.firstName};;;`);
      lines.push(`FN:${this.escapeVCard(contact.name)}`);
    } else {
      // Use email as display name if no name available
      lines.push(`FN:${this.escapeVCard(contact.email)}`);
      lines.push('N:;;;;');
    }

    // Email
    if (contact.email) {
      lines.push(`EMAIL;TYPE=INTERNET:${this.escapeVCard(contact.email)}`);
    }

    // Phone (if available)
    if (contact.phone) {
      lines.push(`TEL;TYPE=CELL:${this.escapeVCard(contact.phone)}`);
    }

    // Organization (if available)
    if (contact.organization) {
      lines.push(`ORG:${this.escapeVCard(contact.organization)}`);
    }

    // Note with email count
    if (contact.emailCount) {
      lines.push(`NOTE:Exchanged ${contact.emailCount} emails`);
    }

    lines.push('END:VCARD');

    return lines.join('\r\n');
  }

  /**
   * Convert multiple contacts to a single vCard file
   */
  contactsToVCard(contacts: Contact[]): string {
    return contacts.map(contact => this.contactToVCard(contact)).join('\r\n');
  }

  /**
   * Export contacts and trigger download
   */
  exportContacts(contacts: Contact[], filename?: string): void {
    const vcardData = this.contactsToVCard(contacts);
    const blob = new Blob([vcardData], { type: 'text/vcard;charset=utf-8' });
    
    const name = filename || `contacts-${new Date().toISOString().split('T')[0]}.vcf`;
    
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
   * Export a single contact
   */
  exportContact(contact: Contact): void {
    const filename = contact.name 
      ? `${contact.name.replace(/[^a-zA-Z0-9]/g, '_')}.vcf`
      : 'contact.vcf';
    this.exportContacts([contact], filename);
  }

  /**
   * Parse a full name into first and last name
   */
  private parseName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    
    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    }
    
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: '' };
    }
    
    // Last word is last name, everything else is first name
    const lastName = parts.pop() || '';
    const firstName = parts.join(' ');
    
    return { firstName, lastName };
  }

  /**
   * Escape special characters for vCard format
   */
  private escapeVCard(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  /**
   * Generate a valid vCard from basic info
   */
  createVCard(name: string, email: string, phone?: string): string {
    const contact: Contact = {
      name,
      email,
      phone,
      emailCount: 0,
      lastEmailDate: new Date(),
    };
    return this.contactToVCard(contact);
  }
}

export const vcardExporter = new VCardExporter();

