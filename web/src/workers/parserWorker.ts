/**
 * Web Worker for parsing email archives
 * This runs on a separate thread to avoid blocking the UI
 * 
 * Handles: OLM, MBOX, and Gmail Takeout ZIP files
 */

import JSZip from 'jszip';
import { MBOXParser, OLMParser } from '@technical-1/email-archive-parser';
import type { Email, Contact, CalendarEvent } from '../types';
import { toAppEmail } from './toAppEmail';
import type {
  WorkerInputMessage,
  WorkerOutputMessage,
  WorkerParseContext
} from './parserWorker.types';
import {
  decodeQuotedPrintable,
  decodeRfc2047,
  isMboxFromLine,
  makeSnippet,
  MAX_SUBJECT_LEN,
  MAX_BODY_LEN,
  MAX_EMAIL_LEN,
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
} from '../services/mimeUtils';

// ============================================================================
// Worker-compatible utility functions (no DOM dependencies)
// ============================================================================

// Keep in sync with cleanEmailAddress in ../utils/emailUtils.ts
function cleanEmailAddress(email: string): string {
  if (!email) return 'unknown@example.com';
  const cleaned = email.replace(/[<>]/g, '').trim();
  const match = cleaned.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match) return match[1].replace(/[.,;:!?]+$/, '').toLowerCase();
  const bareMatch = cleaned.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/);
  if (bareMatch) return bareMatch[1].replace(/[.,;:!?]+$/, '').toLowerCase();
  // Never leak display-name text; use the sentinel downstream code checks for.
  return 'unknown@example.com';
}

function normalizeSubject(subject: string): string {
  if (!subject) return '';
  let normalized = subject;
  const prefixPattern = /^(re|fwd|fw|aw|sv|vs|antw|r):\s*/i;
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, '');
  }
  return normalized.trim().toLowerCase().replace(/\s+/g, ' ');
}

function decodeBase64(str: string): string {
  try {
    const binaryStr = atob(str);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    try {
      return atob(str);
    } catch {
      return str;
    }
  }
}

function stripHtml(html: string): string {
  // Worker-compatible HTML stripping (no DOMParser)
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

// ============================================================================
// Worker context and messaging
// ============================================================================

const ctx: WorkerParseContext = {
  isCancelled: false,
  totalEmailsParsed: 0,
  totalContactsParsed: 0,
  totalCalendarEventsParsed: 0,
};

function postMessage(message: WorkerOutputMessage) {
  self.postMessage(message);
}

function reportProgress(
  stage: WorkerOutputMessage extends { type: 'PROGRESS' } ? WorkerOutputMessage['payload']['stage'] : string,
  progress: number,
  message: string
) {
  postMessage({
    type: 'PROGRESS',
    payload: { stage: stage as 'extracting' | 'parsing_emails' | 'parsing_contacts' | 'parsing_calendar' | 'detecting' | 'saving', progress, message },
  });
}

function sendEmailBatch(emails: Omit<Email, 'id'>[], batchNumber: number, isLast: boolean) {
  postMessage({
    type: 'EMAIL_BATCH',
    payload: { emails, batchNumber, isLast },
  });
}

function sendContactBatch(contacts: Omit<Contact, 'id'>[], batchNumber: number, isLast: boolean) {
  postMessage({
    type: 'CONTACT_BATCH',
    payload: { contacts, batchNumber, isLast },
  });
}

function sendCalendarBatch(events: Omit<CalendarEvent, 'id'>[], batchNumber: number, isLast: boolean) {
  postMessage({
    type: 'CALENDAR_BATCH',
    payload: { events, batchNumber, isLast },
  });
}

function sendComplete() {
  postMessage({
    type: 'COMPLETE',
    payload: {
      totalEmails: ctx.totalEmailsParsed,
      totalContacts: ctx.totalContactsParsed,
      totalCalendarEvents: ctx.totalCalendarEventsParsed,
    },
  });
}

function sendError(message: string, stage?: string) {
  postMessage({
    type: 'ERROR',
    payload: { message, stage },
  });
}

// ============================================================================
// MBOX Parser (Worker version)
// ============================================================================

const MBOX_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
const BATCH_SIZE = 100;

function findLastFromLine(text: string): number {
  let lastIndex = -1;
  let searchStart = text.length - 1;
  
  while (searchStart > 0) {
    let idx = text.lastIndexOf('\r\nFrom ', searchStart);
    let offset = 2;
    
    if (idx === -1) {
      idx = text.lastIndexOf('\nFrom ', searchStart);
      offset = 1;
    }
    
    if (idx === -1) break;
    
    const lineStart = idx + offset;
    let lineEnd = text.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = text.length;
    let line = text.substring(lineStart, lineEnd);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    
    if (isMboxFromLine(line)) {
      lastIndex = lineStart;
      break;
    }
    searchStart = idx - 1;
  }
  
  if (lastIndex === -1 && text.startsWith('From ')) {
    let lineEnd = text.indexOf('\n');
    if (lineEnd === -1) lineEnd = text.length;
    let line = text.substring(0, lineEnd);
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (isMboxFromLine(line)) {
      lastIndex = 0;
    }
  }
  
  return lastIndex;
}

// Retained for the OLM/Gmail-Takeout paths still migrating to the library.
// The MBOX path now delegates to @technical-1/email-archive-parser, so these
// chunking helpers are temporarily unreferenced; deletion happens in the later
// cleanup phase. Reference them here to satisfy noUnusedLocals until then.
void MBOX_CHUNK_SIZE;
void findLastFromLine;

function parseEmailAddress(str: string): { email: string; name?: string } {
  const trimmed = decodeRfc2047(str.trim());
  
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

function parseRecipients(str: string): string[] {
  if (!str) return [];
  return str
    .split(/[,;]/)
    .map((r) => {
      const { email } = parseEmailAddress(r.trim());
      return cleanEmailAddress(email);
    })
    .filter(Boolean);
}

function parseGmailLabels(labelsHeader: string): string[] {
  if (!labelsHeader) return [];
  
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

function mapGmailLabelsToFolder(labels: string): string {
  const labelList = parseGmailLabels(labels);
  
  if (labelList.includes('inbox')) return 'inbox';
  if (labelList.includes('sent') || labelList.includes('sent mail')) return 'sent';
  if (labelList.includes('draft') || labelList.includes('drafts')) return 'drafts';
  if (labelList.includes('spam')) return 'spam';
  if (labelList.includes('trash')) return 'trash';
  
  const customLabels = labelList.filter(l => 
    !l.startsWith('category ') && 
    !['opened', 'unread', 'starred', 'important', 'all mail'].includes(l)
  );
  
  if (customLabels.length > 0) {
    return customLabels[0]
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
  }
  
  return 'archive';
}

function parseMimeParts(body: string, boundary: string): { text?: string; html?: string } {
  const result: { text?: string; html?: string } = {};
  
  const boundaryMarker = '--' + boundary;
  const parts = body.split(boundaryMarker);
  
  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    
    const headerEndIndex = part.indexOf('\n\n');
    if (headerEndIndex === -1) continue;
    
    const partHeaders = part.substring(0, headerEndIndex);
    let partContent = part.substring(headerEndIndex + 2);
    
    const contentTypeMatch = partHeaders.match(/content-type:\s*([^;\n]+)/i);
    const encodingMatch = partHeaders.match(/content-transfer-encoding:\s*(\S+)/i);
    
    if (!contentTypeMatch) continue;
    
    const partContentType = contentTypeMatch[1].toLowerCase().trim();
    const partEncoding = encodingMatch?.[1]?.toLowerCase() || '7bit';
    const partCharset = partHeaders.match(/charset=["']?([^"';\s]+)["']?/i)?.[1];
    
    if (partContentType.includes('multipart/')) {
      const nestedBoundaryMatch = partHeaders.match(/boundary=["']?([^"';\s\n]+)["']?/i);
      if (nestedBoundaryMatch) {
        const nestedResult = parseMimeParts(partContent, nestedBoundaryMatch[1]);
        if (nestedResult.text && !result.text) result.text = nestedResult.text;
        if (nestedResult.html && !result.html) result.html = nestedResult.html;
      }
      continue;
    }
    
    partContent = partContent.trim();
    if (partEncoding === 'base64') {
      try {
        const cleaned = partContent.replace(/\s/g, '');
        partContent = decodeBase64(cleaned);
      } catch {
        // Keep original if decode fails
      }
    } else if (partEncoding === 'quoted-printable') {
      partContent = decodeQuotedPrintable(partContent, partCharset);
    }
    
    if (partContentType.includes('text/plain') && !result.text) {
      result.text = partContent;
    } else if (partContentType.includes('text/html') && !result.html) {
      result.html = partContent;
    }
  }
  
  return result;
}

function parseEmailFromLines(lines: string[]): Omit<Email, 'id'> | null {
  try {
    if (lines.length < 2) return null;

    const headers: Record<string, string> = {};
    let bodyStartIndex = 0;
    let inHeaders = true;

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

    const bodyLines = lines.slice(bodyStartIndex);
    // mboxrd un-escaping: body lines that were escaped as ">From "/">>From "
    // (one extra ">") are restored by stripping a single leading ">".
    const rawBody = bodyLines.join('\n').replace(/^>(>*From )/gm, '$1');

    const contentType = headers['content-type'] || 'text/plain';
    let body = '';
    let htmlBody: string | undefined;
    
    if (contentType.includes('multipart/')) {
      const boundaryMatch = contentType.match(/boundary=["']?([^"';\s]+)["']?/i);
      if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = parseMimeParts(rawBody, boundary);
        body = parts.text || '';
        htmlBody = parts.html;
      } else {
        body = rawBody;
      }
    } else {
      body = rawBody;
      const encoding = headers['content-transfer-encoding']?.toLowerCase();
      if (encoding === 'quoted-printable') {
        const bodyCharset = contentType.match(/charset=["']?([^"';\s]+)["']?/i)?.[1];
        body = decodeQuotedPrintable(body, bodyCharset);
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
    let date: Date | null = null;
    if (dateStr) {
      try {
        const parsed = new Date(dateStr);
        date = isNaN(parsed.getTime()) ? null : parsed;
      } catch {
        date = null;
      }
    }

    const from = headers['from'] || '';
    const { email: sender, name: senderName } = parseEmailAddress(from);

    const to = headers['to'] || '';
    const recipients = parseRecipients(to);

    const subject = decodeRfc2047(headers['subject'] || '(No Subject)');

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
    const folderId = mapGmailLabelsToFolder(gmailLabels);
    const isRead = !gmailLabels.toLowerCase().includes('unread');
    const isStarred = gmailLabels.toLowerCase().includes('starred');

    if (!sender && !subject) {
      return null;
    }

    return {
      subject: subject.length > MAX_SUBJECT_LEN ? subject.slice(0, MAX_SUBJECT_LEN) : subject,
      sender: cleanEmailAddress(sender).slice(0, MAX_EMAIL_LEN),
      senderName: senderName || undefined,
      recipients: recipients.map(r => r.slice(0, MAX_EMAIL_LEN)).slice(0, 1000),
      date: date || new Date(),
      body: (() => {
        const b = body.trim() || (htmlBody ? stripHtml(htmlBody) : '');
        return b.length > MAX_BODY_LEN ? b.slice(0, MAX_BODY_LEN) : b;
      })(),
      htmlBody: htmlBody && htmlBody.length > MAX_BODY_LEN ? htmlBody.slice(0, MAX_BODY_LEN) : htmlBody,
      snippet: makeSnippet(htmlBody || body),
      attachments: [],
      size: Math.min(lines.join('\n').length, 100000),
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

function parseEmailsFromText(text: string): Omit<Email, 'id'>[] {
  const emails: Omit<Email, 'id'>[] = [];
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  let currentEmail: string[] = [];

  for (const line of lines) {
    if (isMboxFromLine(line) && currentEmail.length > 0) {
      const email = parseEmailFromLines(currentEmail);
      if (email) {
        emails.push(email);
      }
      currentEmail = [];
    }
    currentEmail.push(line);
  }

  if (currentEmail.length > 0 && currentEmail.some(line => line.trim().length > 0)) {
    const email = parseEmailFromLines(currentEmail);
    if (email) {
      emails.push(email);
    }
  }

  return emails;
}

async function parseMBOXFile(file: File): Promise<void> {
  const parser = new MBOXParser();
  let lastBatch = 0;
  // NOTE: the library's parseStreaming has no cancellation hook, so once started
  // it reads the whole file. Honoring ctx.isCancelled here stops us EMITTING
  // batches/progress, but the library keeps parsing in the background until done
  // (it yields to the event loop between chunks, so the worker stays responsive).
  // A future lib enhancement could accept an AbortSignal to abort mid-file.
  await parser.parseStreaming(
    file,
    (p) => {
      if (ctx.isCancelled) return;
      // Map the library's 'complete' stage onto the worker's 'saving' stage.
      const stage = p.stage === 'complete' ? 'saving' : p.stage;
      reportProgress(stage as 'extracting' | 'parsing_emails' | 'saving', p.progress, p.message);
    },
    async (batch, n) => {
      if (ctx.isCancelled) return;
      const mapped = batch.map(toAppEmail);
      sendEmailBatch(mapped, n, false);
      ctx.totalEmailsParsed += mapped.length;
      lastBatch = n;
    }
  );
  if (ctx.isCancelled) return;
  // parseStreaming flushed its final batch above; signal end-of-stream.
  sendEmailBatch([], lastBatch + 1, true);
  reportProgress('saving', 100, `Parsed ${ctx.totalEmailsParsed} emails successfully`);
}

// ============================================================================
// OLM Parser (Worker version)
// ============================================================================

async function parseOLMFile(file: File): Promise<void> {
  if (file.size > MAX_COMPRESSED_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum supported size is 500MB.`);
  }
  reportProgress('extracting', 0, 'Extracting OLM archive...');

  const result = await new OLMParser().parse(file, {
    onProgress: (p) => {
      if (ctx.isCancelled) return;
      const stage = p.stage === 'complete' ? 'saving' : p.stage;
      reportProgress(stage as 'extracting' | 'parsing_emails' | 'parsing_contacts' | 'parsing_calendar' | 'saving', p.progress, p.message);
    },
  });
  if (ctx.isCancelled) return;

  // Stream emails to the main thread in BATCH_SIZE chunks (worker contract).
  for (let i = 0; i < result.emails.length; i += BATCH_SIZE) {
    if (ctx.isCancelled) return;
    const slice = result.emails.slice(i, i + BATCH_SIZE).map(toAppEmail);
    const isLast = i + BATCH_SIZE >= result.emails.length;
    sendEmailBatch(slice, Math.floor(i / BATCH_SIZE), isLast);
    ctx.totalEmailsParsed += slice.length;
    await new Promise((r) => setTimeout(r, 0));
  }
  if (result.emails.length === 0) sendEmailBatch([], 0, true);

  // Contacts (library extracts Address Book + sender-derived) and calendar events.
  const contacts = result.contacts.map((c) => ({
    name: c.name,
    email: c.email,
    phone: c.phone,
    emailCount: c.emailCount,
    lastEmailDate: c.lastEmailDate,
  }));
  sendContactBatch(contacts, 0, true);
  ctx.totalContactsParsed = contacts.length;

  const events = result.calendarEvents.map((ev) => ({ ...ev, isRead: false }));
  sendCalendarBatch(events, 0, true);
  ctx.totalCalendarEventsParsed = events.length;

  reportProgress('saving', 100, 'Processing complete!');
}

// ============================================================================
// Gmail Takeout Parser (Worker version)
// ============================================================================

async function parseGmailTakeoutFile(file: File): Promise<void> {
  reportProgress('extracting', 0, 'Opening Gmail Takeout archive...');

  if (file.size > MAX_COMPRESSED_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum supported size is 500MB.`);
  }

  const zip = await JSZip.loadAsync(file);

  let totalDecompressedSize = 0;
  for (const entry of Object.values(zip.files)) {
    if (!entry.dir) {
      const entryData = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
      if (entryData && typeof entryData.uncompressedSize === 'number') {
        totalDecompressedSize += entryData.uncompressedSize;
      }
    }
  }
  if (totalDecompressedSize > MAX_DECOMPRESSED_BYTES) {
    throw new Error('Archive decompressed size exceeds 2GB limit. This may be a malicious file.');
  }

  
  const mboxFiles: string[] = [];
  zip.forEach((path, zipEntry) => {
    if (!zipEntry.dir && (path.endsWith('.mbox') || path.includes('Takeout/Mail/'))) {
      mboxFiles.push(path);
    }
  });

  reportProgress('extracting', 10, `Found ${mboxFiles.length} mail folders`);

  if (mboxFiles.length === 0) {
    throw new Error('No email archives found in this Takeout file.');
  }

  let batchNumber = 0;
  const seenEmailKeys = new Set<string>();

  // Process MBOX files sequentially to reduce memory pressure
  for (let fileIndex = 0; fileIndex < mboxFiles.length && !ctx.isCancelled; fileIndex++) {
    const mboxPath = mboxFiles[fileIndex];
    
    try {
      const zipEntry = zip.file(mboxPath);
      if (!zipEntry) continue;

      const folderName = mboxPath.split('/').pop()?.replace('.mbox', '').replace(/_/g, ' ') || 'Unknown';
      
      reportProgress(
        'parsing_emails',
        10 + (fileIndex / mboxFiles.length) * 80,
        `Processing ${folderName} (${fileIndex + 1}/${mboxFiles.length})...`
      );

      // Get content and parse (let so we can null it for GC)
      let content: string | null = await zipEntry.async('string');
      const emails = parseEmailsFromText(content);

      // Deduplicate and batch
      let currentBatch: Omit<Email, 'id'>[] = [];
      
      for (const email of emails) {
        // Create unique key for deduplication
        const key = email.threadId || `${email.subject}|${email.sender}|${email.date.getTime()}`;
        
        if (!seenEmailKeys.has(key)) {
          seenEmailKeys.add(key);
          currentBatch.push(email);
          
          if (currentBatch.length >= BATCH_SIZE) {
            sendEmailBatch(currentBatch, batchNumber, false);
            ctx.totalEmailsParsed += currentBatch.length;
            batchNumber++;
            currentBatch = [];
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }

      // Send remaining emails from this file
      if (currentBatch.length > 0) {
        const isLast = fileIndex === mboxFiles.length - 1;
        sendEmailBatch(currentBatch, batchNumber, isLast);
        ctx.totalEmailsParsed += currentBatch.length;
        batchNumber++;
      }

      // Help garbage collection
      content = null;
      
    } catch (error) {
      console.warn(`Failed to parse ${mboxPath}:`, error);
    }
  }

  // If no emails were sent (all files failed), send empty final batch
  if (ctx.totalEmailsParsed === 0) {
    sendEmailBatch([], 0, true);
  }

  // Send empty contact and calendar batches (Gmail Takeout doesn't include these)
  sendContactBatch([], 0, true);
  sendCalendarBatch([], 0, true);

  reportProgress('saving', 100, `Imported ${ctx.totalEmailsParsed} unique emails`);
}

// ============================================================================
// Main message handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerInputMessage>) => {
  const message = event.data;

  if (message.type === 'CANCEL') {
    ctx.isCancelled = true;
    return;
  }

  if (message.type === 'PARSE_FILE') {
    // Reset context
    ctx.isCancelled = false;
    ctx.totalEmailsParsed = 0;
    ctx.totalContactsParsed = 0;
    ctx.totalCalendarEventsParsed = 0;

    const { file, fileType } = message.payload;

    try {
      switch (fileType) {
        case 'olm':
          await parseOLMFile(file);
          break;
        case 'mbox':
          await parseMBOXFile(file);
          // For MBOX, send empty contact and calendar batches
          sendContactBatch([], 0, true);
          sendCalendarBatch([], 0, true);
          break;
        case 'gmail-takeout':
          await parseGmailTakeoutFile(file);
          break;
        default:
          throw new Error(`Unknown file type: ${fileType}`);
      }

      if (!ctx.isCancelled) {
        sendComplete();
      }
    } catch (error) {
      sendError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        'parsing'
      );
    }
  }
};

// Signal that worker is ready
postMessage({ type: 'PROGRESS', payload: { stage: 'extracting', progress: 0, message: 'Worker ready' } });

