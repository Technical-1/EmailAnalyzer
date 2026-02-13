import type { Email } from '../types';
import { cleanEmailAddress, normalizeSubject } from '../utils/emailUtils';

/**
 * Callback for streaming email processing
 */
export type EmailBatchCallback = (emails: Omit<Email, 'id'>[], batchNumber: number) => Promise<void>;

/**
 * Parser for MBOX email archive format
 * Uses streaming/batched approach for memory efficiency with large files
 */
class MBOXParser {
  private readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
  private readonly BATCH_SIZE = 100; // Process 100 emails at a time

  /**
   * Parse an MBOX file with streaming batch processing
   * Calls onBatch with each batch of emails as they're parsed
   */
  async parseMBOXFileStreaming(
    file: File,
    onProgress?: (progress: number, message: string) => void,
    onBatch?: EmailBatchCallback
  ): Promise<number> {
    const fileSize = file.size;
    let offset = 0;
    let leftover = ''; 
    let totalEmailsParsed = 0;
    let currentBatch: Omit<Email, 'id'>[] = [];
    let batchNumber = 0;

    onProgress?.(0, `Processing ${(fileSize / 1024 / 1024).toFixed(1)}MB file...`);

    while (offset < fileSize) {
      const chunkEnd = Math.min(offset + this.CHUNK_SIZE, fileSize);
      const chunk = file.slice(offset, chunkEnd);
      
      let chunkText: string;
      try {
        chunkText = await chunk.text();
      } catch (e) {
        console.error('Error reading chunk:', e);
        break;
      }
      
      const textToProcess = leftover + chunkText;
      
      // Find the last "From " line to know where to split
      const lastFromIndex = this.findLastFromLine(textToProcess);
      
      let processableText: string;
      if (lastFromIndex > 0 && chunkEnd < fileSize) {
        processableText = textToProcess.substring(0, lastFromIndex);
        leftover = textToProcess.substring(lastFromIndex);
      } else {
        processableText = textToProcess;
        leftover = '';
      }

      // Parse emails from this chunk
      const chunkEmails = this.parseEmailsFromText(processableText);
      
      for (const email of chunkEmails) {
        currentBatch.push(email);
        
        // When batch is full, process it
        if (currentBatch.length >= this.BATCH_SIZE) {
          if (onBatch) {
            await onBatch(currentBatch, batchNumber);
          }
          totalEmailsParsed += currentBatch.length;
          batchNumber++;
          currentBatch = []; // Clear batch from memory
          
          // Yield to UI
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      offset = chunkEnd;
      const progress = Math.round((offset / fileSize) * 95);
      onProgress?.(progress, `Parsed ${totalEmailsParsed + currentBatch.length} emails (${Math.round(offset / fileSize * 100)}% read)...`);
      
      // Yield to prevent UI blocking
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Process any remaining text
    if (leftover.trim()) {
      const finalEmails = this.parseEmailsFromText(leftover);
      for (const email of finalEmails) {
        currentBatch.push(email);
      }
    }

    // Process final batch
    if (currentBatch.length > 0 && onBatch) {
      await onBatch(currentBatch, batchNumber);
      totalEmailsParsed += currentBatch.length;
    }

    onProgress?.(100, `Parsed ${totalEmailsParsed} emails successfully`);
    return totalEmailsParsed;
  }

  /**
   * Legacy method for backwards compatibility
   * For small files only - use parseMBOXFileStreaming for large files
   */
  async parseMBOXFile(
    file: File,
    onProgress?: (progress: number, message: string) => void
  ): Promise<Omit<Email, 'id'>[]> {
    // For files under 20MB, use simple accumulator approach
    if (file.size < 20 * 1024 * 1024) {
      const emails: Omit<Email, 'id'>[] = [];
      await this.parseMBOXFileStreaming(file, onProgress, async (batch) => {
        emails.push(...batch);
      });
      return emails;
    }
    
    // For larger files, warn and still use streaming but accumulate
    console.warn('Large file detected. Consider using parseMBOXFileStreaming for better memory efficiency.');
    const emails: Omit<Email, 'id'>[] = [];
    await this.parseMBOXFileStreaming(file, onProgress, async (batch) => {
      emails.push(...batch);
    });
    return emails;
  }

  /**
   * Check if a line is a valid MBOX "From " line
   */
  private isFromLine(line: string): boolean {
    if (!line.startsWith('From ')) return false;
    const dayPattern = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/;
    return dayPattern.test(line);
  }

  /**
   * Find the index of the last "From " line in text
   */
  private findLastFromLine(text: string): number {
    let lastIndex = -1;
    let searchStart = text.length - 1;
    
    // Search backwards for "\nFrom " or "\r\nFrom " pattern
    while (searchStart > 0) {
      // Try both CRLF and LF
      let idx = text.lastIndexOf('\r\nFrom ', searchStart);
      let offset = 2; // Skip \r\n
      
      if (idx === -1) {
        idx = text.lastIndexOf('\nFrom ', searchStart);
        offset = 1; // Skip \n
      }
      
      if (idx === -1) break;
      
      const lineStart = idx + offset;
      let lineEnd = text.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = text.length;
      let line = text.substring(lineStart, lineEnd);
      // Remove trailing \r if present
      if (line.endsWith('\r')) line = line.slice(0, -1);
      
      if (this.isFromLine(line)) {
        lastIndex = lineStart;
        break;
      }
      searchStart = idx - 1;
    }
    
    // Also check if text starts with "From "
    if (lastIndex === -1 && text.startsWith('From ')) {
      let lineEnd = text.indexOf('\n');
      if (lineEnd === -1) lineEnd = text.length;
      let line = text.substring(0, lineEnd);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (this.isFromLine(line)) {
        lastIndex = 0;
      }
    }
    
    return lastIndex;
  }

  /**
   * Parse multiple emails from a text block
   */
  private parseEmailsFromText(text: string): Omit<Email, 'id'>[] {
    const emails: Omit<Email, 'id'>[] = [];
    // Normalize CRLF to LF, then split
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');
    let currentEmail: string[] = [];

    for (const line of lines) {
      if (this.isFromLine(line) && currentEmail.length > 0) {
        const email = this.parseEmailFromLines(currentEmail);
        if (email) {
          emails.push(email);
        }
        currentEmail = [];
      }
      currentEmail.push(line);
    }

    // Parse last email in chunk
    if (currentEmail.length > 0 && currentEmail.some(line => line.trim().length > 0)) {
      const email = this.parseEmailFromLines(currentEmail);
      if (email) {
        emails.push(email);
      }
    }

    return emails;
  }

  /**
   * Parse a single email from raw lines
   */
  private parseEmailFromLines(lines: string[]): Omit<Email, 'id'> | null {
    try {
      if (lines.length < 2) return null;

      const headers: Record<string, string> = {};
      let bodyStartIndex = 0;
      let inHeaders = true;

      // Parse headers (skip the "From " line)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        if (line.trim() === '') {
          bodyStartIndex = i + 1;
          inHeaders = false;
          break;
        }

        if (inHeaders) {
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

      if (inHeaders) {
        bodyStartIndex = lines.length;
      }

      // Extract body content
      const bodyLines = lines.slice(bodyStartIndex);
      const rawBody = bodyLines.join('\n');
      
      // Parse body based on content type
      const contentType = headers['content-type'] || 'text/plain';
      let body = '';
      let htmlBody: string | undefined;
      
      if (contentType.includes('multipart/')) {
        // Extract boundary from content-type
        const boundaryMatch = contentType.match(/boundary=["']?([^"';\s]+)["']?/i);
        if (boundaryMatch) {
          const boundary = boundaryMatch[1];
          const parts = this.parseMimeParts(rawBody, boundary);
          body = parts.text || '';
          htmlBody = parts.html;
        } else {
          body = rawBody;
        }
      } else {
        // Single part email
        body = rawBody;
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
        
        if (contentType.includes('text/html')) {
          htmlBody = body;
        }
      }

      const dateStr = headers['date'] || '';
      const date = this.parseDate(dateStr);

      const from = headers['from'] || '';
      const { email: sender, name: senderName } = this.parseEmailAddress(from);

      const to = headers['to'] || '';
      const recipients = this.parseRecipients(to);

      const subject = this.decodeHeaderValue(headers['subject'] || '(No Subject)');

      let threadId = headers['x-gm-thrid'] || 
                     headers['thread-topic'] || 
                     headers['references']?.split(/\s+/)[0] ||
                     headers['in-reply-to'];
      
      if (!threadId) {
        const normalizedSubj = normalizeSubject(subject);
        if (normalizedSubj) {
          threadId = `subject:${normalizedSubj.toLowerCase().replace(/\s+/g, '-')}`;
        }
      }

      const gmailLabels = headers['x-gmail-labels'] || '';
      const folderId = this.mapGmailLabelsToFolder(gmailLabels);
      const isRead = !gmailLabels.toLowerCase().includes('unread');
      const isStarred = gmailLabels.toLowerCase().includes('starred');

      if (!sender && !subject) {
        return null;
      }

      // Sanitize field lengths to prevent memory issues with malformed emails
      const MAX_SUBJECT_LEN = 1000;
      const MAX_BODY_LEN = 10 * 1024 * 1024; // 10MB
      const MAX_EMAIL_LEN = 254; // RFC 5321

      const sanitizedSubject = subject.length > MAX_SUBJECT_LEN ? subject.slice(0, MAX_SUBJECT_LEN) : subject;
      const sanitizedBody = body.trim() || (htmlBody ? this.stripHtml(htmlBody) : '');
      const truncatedBody = sanitizedBody.length > MAX_BODY_LEN ? sanitizedBody.slice(0, MAX_BODY_LEN) : sanitizedBody;
      const truncatedHtmlBody = htmlBody && htmlBody.length > MAX_BODY_LEN ? htmlBody.slice(0, MAX_BODY_LEN) : htmlBody;
      const sanitizedSender = cleanEmailAddress(sender).slice(0, MAX_EMAIL_LEN);
      const sanitizedRecipients = recipients.map(r => r.slice(0, MAX_EMAIL_LEN)).slice(0, 1000);

      return {
        subject: sanitizedSubject,
        sender: sanitizedSender,
        senderName: senderName || undefined,
        recipients: sanitizedRecipients,
        date: date || new Date(),
        body: truncatedBody,
        htmlBody: truncatedHtmlBody,
        attachments: [],
        size: Math.min(lines.join('\n').length, 100000), // Cap size calculation
        isRead,
        isStarred,
        folderId,
        threadId,
        emailType: 'regular',
      };
    } catch (error) {
      console.warn('Failed to parse email:', error);
      return null;
    }
  }

  /**
   * Parse Gmail labels and return the primary folder ID
   * Priority: Inbox > Sent > Drafts > Spam > Trash > first custom label > Archive
   */
  private mapGmailLabelsToFolder(labels: string): string {
    const labelList = this.parseGmailLabels(labels);
    
    // Priority order for folder assignment
    if (labelList.includes('inbox')) return 'inbox';
    if (labelList.includes('sent') || labelList.includes('sent mail')) return 'sent';
    if (labelList.includes('draft') || labelList.includes('drafts')) return 'drafts';
    if (labelList.includes('spam')) return 'spam';
    if (labelList.includes('trash')) return 'trash';
    
    // Check for custom labels (not category/system labels)
    const customLabels = labelList.filter(l => 
      !l.startsWith('category ') && 
      !['opened', 'unread', 'starred', 'important', 'all mail'].includes(l)
    );
    
    if (customLabels.length > 0) {
      // Use first custom label as folder
      return this.labelToFolderId(customLabels[0]);
    }
    
    return 'archive';
  }

  /**
   * Parse the X-Gmail-Labels header into an array of label names
   */
  parseGmailLabels(labelsHeader: string): string[] {
    if (!labelsHeader) return [];
    
    // Labels are comma-separated, may be quoted if they contain special chars
    const labels: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (const char of labelsHeader) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          labels.push(current.trim().toLowerCase());
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      labels.push(current.trim().toLowerCase());
    }
    
    return labels;
  }

  /**
   * Convert a label name to a valid folder ID
   */
  private labelToFolderId(label: string): string {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50); // Limit length
  }

  /**
   * Get all unique folder IDs that would be created from a labels header
   */
  getAllFolderIdsFromLabels(labelsHeader: string): string[] {
    const labels = this.parseGmailLabels(labelsHeader);
    const folderIds = new Set<string>();
    
    // Add system folders if mentioned
    if (labels.includes('inbox')) folderIds.add('inbox');
    if (labels.includes('sent') || labels.includes('sent mail')) folderIds.add('sent');
    if (labels.includes('draft') || labels.includes('drafts')) folderIds.add('drafts');
    if (labels.includes('spam')) folderIds.add('spam');
    if (labels.includes('trash')) folderIds.add('trash');
    
    // Add custom labels as folders
    for (const label of labels) {
      if (!label.startsWith('category ') && 
          !['opened', 'unread', 'starred', 'important', 'all mail', 
            'inbox', 'sent', 'sent mail', 'draft', 'drafts', 'spam', 'trash'].includes(label)) {
        folderIds.add(this.labelToFolderId(label));
      }
    }
    
    return Array.from(folderIds);
  }

  /**
   * Parse MIME multipart content and extract text/html parts
   */
  private parseMimeParts(body: string, boundary: string): { text?: string; html?: string } {
    const result: { text?: string; html?: string } = {};
    
    // Split by boundary
    const boundaryMarker = '--' + boundary;
    const parts = body.split(boundaryMarker);
    
    for (const part of parts) {
      if (!part.trim() || part.trim() === '--') continue;
      
      // Split headers from content
      const headerEndIndex = part.indexOf('\n\n');
      if (headerEndIndex === -1) continue;
      
      const partHeaders = part.substring(0, headerEndIndex);
      let partContent = part.substring(headerEndIndex + 2);
      
      // Parse part headers
      const contentTypeMatch = partHeaders.match(/content-type:\s*([^;\n]+)/i);
      const encodingMatch = partHeaders.match(/content-transfer-encoding:\s*(\S+)/i);
      
      if (!contentTypeMatch) continue;
      
      const partContentType = contentTypeMatch[1].toLowerCase().trim();
      const partEncoding = encodingMatch?.[1]?.toLowerCase() || '7bit';
      
      // Handle nested multipart (multipart/alternative, etc.)
      if (partContentType.includes('multipart/')) {
        const nestedBoundaryMatch = partHeaders.match(/boundary=["']?([^"';\s\n]+)["']?/i);
        if (nestedBoundaryMatch) {
          const nestedResult = this.parseMimeParts(partContent, nestedBoundaryMatch[1]);
          if (nestedResult.text && !result.text) result.text = nestedResult.text;
          if (nestedResult.html && !result.html) result.html = nestedResult.html;
        }
        continue;
      }
      
      // Decode content
      partContent = partContent.trim();
      if (partEncoding === 'base64') {
        try {
          // Remove whitespace and decode
          const cleaned = partContent.replace(/\s/g, '');
          partContent = this.decodeBase64(cleaned);
        } catch {
          // Keep original if decode fails
        }
      } else if (partEncoding === 'quoted-printable') {
        partContent = this.decodeQuotedPrintable(partContent);
      }
      
      // Store based on content type
      if (partContentType.includes('text/plain') && !result.text) {
        result.text = partContent;
      } else if (partContentType.includes('text/html') && !result.html) {
        result.html = partContent;
      }
    }
    
    return result;
  }

  /**
   * Decode base64 with UTF-8 support
   */
  private decodeBase64(str: string): string {
    try {
      // Use TextDecoder for proper UTF-8 handling
      const binaryStr = atob(str);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      // Fallback to simple atob
      try {
        return atob(str);
      } catch {
        return str;
      }
    }
  }

  /**
   * Strip HTML tags to create plain text
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private parseEmailAddress(str: string): { email: string; name?: string } {
    const trimmed = this.decodeHeaderValue(str.trim());
    
    const angleMatch = trimmed.match(/^(?:"?(.+?)"?\s*)?<([^>]+)>$/);
    if (angleMatch) {
      return {
        name: angleMatch[1]?.trim() || undefined,
        email: angleMatch[2]?.trim(),
      };
    }
    
    const emailMatch = trimmed.match(/^([^\s@]+@[^\s@]+\.[^\s@]+)$/);
    if (emailMatch) {
      return { email: emailMatch[1] };
    }
    
    return { email: trimmed };
  }

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

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private decodeQuotedPrintable(str: string): string {
    return str
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_, hex) => 
        String.fromCharCode(parseInt(hex, 16))
      );
  }

  private decodeHeaderValue(str: string): string {
    return str.replace(
      /=\?([^?]+)\?([BQ])\?([^?]+)\?=/gi,
      (_, _charset, encoding, text) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            return atob(text);
          } else {
            return this.decodeQuotedPrintable(text.replace(/_/g, ' '));
          }
        } catch {
          return text;
        }
      }
    );
  }

  isMBOXFile(file: File): boolean {
    return (
      file.name.endsWith('.mbox') ||
      file.name.endsWith('.mbx') ||
      file.type === 'application/mbox'
    );
  }
}

export const mboxParser = new MBOXParser();
