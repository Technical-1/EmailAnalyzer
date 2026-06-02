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
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
} from '../services/mimeUtils';

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

const BATCH_SIZE = 100;

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

function mapTakeoutFolder(folderName: string): string {
  const n = folderName.toLowerCase();
  if (n.includes('inbox')) return 'inbox';
  if (n.includes('sent')) return 'sent';
  if (n.includes('draft')) return 'drafts';
  if (n.includes('trash') || n.includes('deleted')) return 'trash';
  if (n.includes('spam') || n.includes('junk')) return 'spam';
  if (n.includes('archive') || n === 'all mail') return 'archive';
  if (n.includes('starred') || n.includes('important')) return 'starred';
  return `gmail-${n.replace(/\s+/g, '-')}`;
}

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
      if (entryData && typeof entryData.uncompressedSize === 'number') totalDecompressedSize += entryData.uncompressedSize;
    }
  }
  if (totalDecompressedSize > MAX_DECOMPRESSED_BYTES) {
    throw new Error('Archive decompressed size exceeds 2GB limit. This may be a malicious file.');
  }

  const mboxFiles: string[] = [];
  zip.forEach((path, zipEntry) => {
    if (!zipEntry.dir && (path.endsWith('.mbox') || path.includes('Takeout/Mail/'))) mboxFiles.push(path);
  });
  reportProgress('extracting', 10, `Found ${mboxFiles.length} mail folders`);
  if (mboxFiles.length === 0) throw new Error('No email archives found in this Takeout file.');

  let batchNumber = 0;
  const seenEmailKeys = new Set<string>();
  const parser = new MBOXParser();

  for (let fileIndex = 0; fileIndex < mboxFiles.length && !ctx.isCancelled; fileIndex++) {
    const mboxPath = mboxFiles[fileIndex];
    try {
      const zipEntry = zip.file(mboxPath);
      if (!zipEntry) continue;
      const folderName = mboxPath.split('/').pop()?.replace('.mbox', '').replace(/_/g, ' ') || 'Unknown';
      const folderId = mapTakeoutFolder(folderName);
      reportProgress('parsing_emails', 10 + (fileIndex / mboxFiles.length) * 80, `Processing ${folderName} (${fileIndex + 1}/${mboxFiles.length})...`);

      const text = await zipEntry.async('string');
      const mboxFile = new File([text], `${folderName}.mbox`, { type: 'application/mbox' });

      let currentBatch: Omit<Email, 'id'>[] = [];
      await parser.parseStreaming(mboxFile, undefined, async (batch) => {
        if (ctx.isCancelled) return;
        for (const libEmail of batch) {
          const e = toAppEmail(libEmail);
          const key = e.threadId || `${e.subject}|${e.sender}|${e.date ? e.date.getTime() : 'nodate'}`;
          if (seenEmailKeys.has(key)) continue;
          seenEmailKeys.add(key);
          currentBatch.push({ ...e, folderId });
          if (currentBatch.length >= BATCH_SIZE) {
            sendEmailBatch(currentBatch, batchNumber++, false);
            ctx.totalEmailsParsed += currentBatch.length;
            currentBatch = [];
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      });

      if (currentBatch.length > 0) {
        sendEmailBatch(currentBatch, batchNumber++, false);
        ctx.totalEmailsParsed += currentBatch.length;
      }
    } catch (error) {
      console.warn(`Failed to parse ${mboxPath}:`, error);
    }
  }

  if (ctx.isCancelled) return;
  // Always emit a final isLast batch so the stream terminates cleanly even if the
  // last folder produced no new emails.
  sendEmailBatch([], batchNumber, true);
  // Gmail Takeout has no contacts/calendar.
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

