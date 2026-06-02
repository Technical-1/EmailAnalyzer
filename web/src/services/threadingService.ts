import type { Email, EmailThread } from '../types';
import { normalizeSubject, extractDomain } from '../utils/emailUtils';

/**
 * Service for grouping emails into conversation threads
 */
class ThreadingService {
  /**
   * Build threads from a list of emails.
   *
   * Grouping key (see getThreadKey): an email is keyed by its explicit
   * threadId when present, otherwise by its sender domain + normalized
   * subject. Emails with no usable subject get a unique key so they stay
   * separate. There is intentionally no participant-overlap merge pass —
   * the domain scoping keeps generic subjects from collapsing across
   * unrelated senders without the false-merge risk of overlap heuristics.
   */
  buildThreads(emails: Email[]): EmailThread[] {
    const threadMap = new Map<string, Email[]>();

    // First pass: group by explicit threadId or normalized subject
    for (const email of emails) {
      const threadKey = this.getThreadKey(email);
      
      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, []);
      }
      threadMap.get(threadKey)!.push(email);
    }

    // Convert to EmailThread objects
    const threads: EmailThread[] = [];
    
    for (const [threadKey, threadEmails] of threadMap) {
      // Sort emails by date (oldest first for conversation view)
      const sortedEmails = [...threadEmails].sort(
        (a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity)
      );

      const thread = this.createThread(threadKey, sortedEmails);
      threads.push(thread);
    }

    // Sort threads by last message date (newest first)
    return threads.sort(
      (a, b) => b.lastMessageDate.getTime() - a.lastMessageDate.getTime()
    );
  }

  /**
   * Get the thread key for an email
   * Uses threadId if available, otherwise normalizes subject
   */
  private getThreadKey(email: Email): string {
    // Use explicit threadId if available (already prefixed from parsing)
    if (email.threadId) {
      // If already prefixed, return as-is
      if (email.threadId.startsWith('subject:') || email.threadId.startsWith('thread:')) {
        return email.threadId;
      }
      return `thread:${email.threadId}`;
    }

    // Fallback: Normalize subject for thread matching (for legacy emails without threadId)
    const normalizedSubject = normalizeSubject(email.subject);

    // Empty subjects get unique keys
    if (!normalizedSubject) {
      return `single:${email.id || Math.random()}`;
    }

    // Scope the subject key by sender domain so identical generic subjects
    // ('Invoice', 'Receipt', 'Your order') from different senders do not merge.
    const domain = extractDomain(email.sender) || 'unknown';
    const subjectSlug = normalizedSubject.toLowerCase().replace(/\s+/g, '-');
    return `subject:${domain}:${subjectSlug}`;
  }

  /**
   * Create a thread object from a list of emails
   */
  private createThread(threadKey: string, emails: Email[]): EmailThread {
    const firstEmail = emails[0];

    // Thread message dates derive only from emails that actually have a date.
    // Undated emails are ignored for the thread's first/last timestamps; if no
    // email in the thread has a date, fall back to the epoch (sorts last/oldest).
    const validDates = emails
      .map(e => e.date)
      .filter((d): d is Date => d != null)
      .map(d => d.getTime());
    const firstMessageDate = validDates.length ? new Date(Math.min(...validDates)) : new Date(0);
    const lastMessageDate = validDates.length ? new Date(Math.max(...validDates)) : new Date(0);

    // Collect all unique participants
    const participants = new Set<string>();
    let hasAttachments = false;
    let unreadCount = 0;
    let isStarred = false;

    for (const email of emails) {
      participants.add(email.sender);
      email.recipients.forEach(r => participants.add(r));
      
      if (email.attachments.length > 0) {
        hasAttachments = true;
      }
      
      if (!email.isRead) {
        unreadCount++;
      }
      
      if (email.isStarred) {
        isStarred = true;
      }
    }

    return {
      id: threadKey,
      subject: firstEmail.subject,
      emails,
      participants: Array.from(participants),
      firstMessageDate,
      lastMessageDate,
      messageCount: emails.length,
      unreadCount,
      hasAttachments,
      isStarred,
    };
  }

  /**
   * Find related emails for a given email
   */
  findRelatedEmails(email: Email, allEmails: Email[]): Email[] {
    const threadKey = this.getThreadKey(email);
    
    return allEmails.filter(e => {
      if (e.id === email.id) return false;
      return this.getThreadKey(e) === threadKey;
    });
  }

  /**
   * Get thread for a specific email
   */
  getThreadForEmail(email: Email, allEmails: Email[]): EmailThread | null {
    const threadKey = this.getThreadKey(email);
    const threadEmails = allEmails.filter(e => this.getThreadKey(e) === threadKey);
    
    if (threadEmails.length === 0) {
      return null;
    }

    const sortedEmails = [...threadEmails].sort(
      (a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity)
    );

    return this.createThread(threadKey, sortedEmails);
  }

  /**
   * Check if an email is part of a conversation (has related emails)
   */
  isPartOfConversation(email: Email, allEmails: Email[]): boolean {
    const threadKey = this.getThreadKey(email);
    const count = allEmails.filter(e => this.getThreadKey(e) === threadKey).length;
    return count > 1;
  }

  /**
   * Get thread summary for display in email list
   */
  getThreadSummary(thread: EmailThread): string {
    if (thread.messageCount === 1) {
      return '';
    }
    return `${thread.messageCount} messages`;
  }
}

export const threadingService = new ThreadingService();

