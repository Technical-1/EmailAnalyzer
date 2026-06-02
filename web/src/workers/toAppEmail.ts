import type { Email as LibEmail } from '@technical-1/email-archive-parser';
import type { Email } from '../types';
import { makeSnippet } from '../services/mimeUtils';

/**
 * Map a library Email (no app-specific fields) to an EmailAnalyzer row shape.
 * Adds snippet + emailType; preserves a null date (library v3 semantics).
 */
export function toAppEmail(e: LibEmail): Omit<Email, 'id'> {
  return {
    subject: e.subject,
    sender: e.sender,
    senderName: e.senderName,
    recipients: e.recipients,
    cc: e.cc,
    date: e.date, // Date | null
    body: e.body,
    htmlBody: e.htmlBody,
    attachments: [],
    size: e.size,
    isRead: e.isRead,
    isStarred: e.isStarred,
    folderId: e.folderId,
    threadId: e.threadId,
    snippet: makeSnippet(e.htmlBody || e.body || ''),
    emailType: 'regular',
  };
}
