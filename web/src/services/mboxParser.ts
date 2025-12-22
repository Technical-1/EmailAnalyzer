import type { Email } from '../types';
import { cleanEmailAddress } from '../utils/emailUtils';

/**
 * Parser for MBOX email archive format
 * Used by Gmail Takeout, Thunderbird, and other email clients
 */
class MBOXParser {
  /**
   * Parse an MBOX file and extract emails
   */
  async parseMBOXFile(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Omit<Email, 'id'>[]> {
    const emails: Omit<Email, 'id'>[] = [];
    
    onProgress?.(0, 'Reading MBOX file...');
    
    const text = await file.text();
    const lines = text.split('\n');
    
    let currentEmail: string[] = [];
    let totalEmails = 0;
    let processedEmails = 0;

    // Count emails first
    for (const line of lines) {
      if (line.startsWith('From ')) {
        totalEmails++;
      }
    }

    onProgress?.(10, `Found ${totalEmails} emails, parsing...`);

    // Parse emails
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('From ') && currentEmail.length > 0) {
        // End of current email, parse it
        const email = this.parseEmailFromLines(currentEmail);
        if (email) {
          emails.push(email);
          processedEmails++;
          
          if (processedEmails % 100 === 0) {
            const progress = 10 + (processedEmails / totalEmails) * 90;
            onProgress?.(progress, `Parsed ${processedEmails} of ${totalEmails} emails`);
          }
        }
        currentEmail = [];
      }

      currentEmail.push(line);
    }

    // Parse last email (only if it has actual content)
    if (currentEmail.length > 0 && currentEmail.some(line => line.trim().length > 0)) {
      const email = this.parseEmailFromLines(currentEmail);
      if (email) {
        emails.push(email);
      }
    }

    onProgress?.(100, `Parsed ${emails.length} emails successfully`);
    return emails;
  }

  /**
   * Parse a single email from raw lines
   */
  private parseEmailFromLines(lines: string[]): Omit<Email, 'id'> | null {
    try {
      const headers: Record<string, string> = {};
      let bodyStartIndex = 0;
      let inHeaders = true;

      // Parse headers
      for (let i = 1; i < lines.length; i++) { // Skip the "From " line
        const line = lines[i];

        if (line.trim() === '') {
          bodyStartIndex = i + 1;
          inHeaders = false;
          break;
        }

        if (inHeaders) {
          // Check for header continuation (starts with whitespace)
          if (line.match(/^\s+/) && Object.keys(headers).length > 0) {
            const lastKey = Object.keys(headers).pop()!;
            headers[lastKey] += ' ' + line.trim();
          } else {
            const match = line.match(/^([^:]+):\s*(.*)$/);
            if (match) {
              const key = match[1].toLowerCase();
              headers[key] = match[2];
            }
          }
        }
      }

      // Extract body
      const bodyLines = lines.slice(bodyStartIndex);
      let body = bodyLines.join('\n');

      // Handle Content-Transfer-Encoding
      const encoding = headers['content-transfer-encoding']?.toLowerCase();
      if (encoding === 'quoted-printable') {
        body = this.decodeQuotedPrintable(body);
      } else if (encoding === 'base64') {
        try {
          body = atob(body.replace(/\s/g, ''));
        } catch {
          // Keep original if decode fails
        }
      }

      // Parse date
      const dateStr = headers['date'] || '';
      const date = this.parseDate(dateStr);

      // Parse sender
      const from = headers['from'] || '';
      const { email: sender, name: senderName } = this.parseEmailAddress(from);

      // Parse recipients
      const to = headers['to'] || '';
      const recipients = this.parseRecipients(to);

      // Parse subject
      const subject = this.decodeHeaderValue(headers['subject'] || '(No Subject)');

      // Extract thread ID
      const threadId = headers['thread-topic'] || 
                       headers['references']?.split(/\s+/)[0] ||
                       headers['in-reply-to'];

      if (!sender && !subject) {
        return null;
      }

      return {
        subject,
        sender: cleanEmailAddress(sender),
        senderName: senderName || undefined,
        recipients,
        date: date || new Date(),
        body: body.trim(),
        htmlBody: headers['content-type']?.includes('text/html') ? body : undefined,
        attachments: [],
        size: lines.join('\n').length,
        isRead: false,
        isStarred: false,
        folderId: 'inbox',
        threadId,
        emailType: 'regular',
      };
    } catch (error) {
      console.warn('Failed to parse email:', error);
      return null;
    }
  }

  /**
   * Parse an email address string like "John Doe <john@example.com>"
   */
  private parseEmailAddress(str: string): { email: string; name?: string } {
    const trimmed = str.trim();
    
    // Try to match "Name <email@example.com>" or "<email@example.com>" format
    const angleMatch = trimmed.match(/^(?:"?(.+?)"?\s*)?<([^>]+)>$/);
    if (angleMatch) {
      return {
        name: angleMatch[1]?.trim() || undefined,
        email: angleMatch[2]?.trim(),
      };
    }
    
    // Try to match just email address (without angle brackets)
    const emailMatch = trimmed.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (emailMatch) {
      return { email: emailMatch[1] };
    }
    
    // Fallback: return the whole string as email
    return { email: trimmed };
  }

  /**
   * Parse recipient list
   */
  private parseRecipients(str: string): string[] {
    if (!str) return [];
    
    return str
      .split(/[,;]/)
      .map((r) => {
        const { email } = this.parseEmailAddress(r.trim());
        return cleanEmailAddress(email);
      })
      .filter(Boolean);
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Decode quoted-printable encoding
   */
  private decodeQuotedPrintable(str: string): string {
    return str
      .replace(/=\r?\n/g, '') // Remove soft line breaks
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => 
        String.fromCharCode(parseInt(hex, 16))
      );
  }

  /**
   * Decode RFC 2047 encoded header value
   */
  private decodeHeaderValue(str: string): string {
    // Handle =?charset?encoding?text?= format
    return str.replace(
      /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
      (_, charset, encoding, text) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            // Base64
            return atob(text);
          } else {
            // Quoted-printable
            return this.decodeQuotedPrintable(text.replace(/_/g, ' '));
          }
        } catch {
          return text;
        }
      }
    );
  }

  /**
   * Check if a file is MBOX format
   */
  isMBOXFile(file: File): boolean {
    return (
      file.name.endsWith('.mbox') ||
      file.name.endsWith('.mbx') ||
      file.type === 'application/mbox'
    );
  }
}

export const mboxParser = new MBOXParser();

