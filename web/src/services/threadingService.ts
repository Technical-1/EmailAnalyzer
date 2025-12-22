import type { Email, EmailThread } from '../types';
import { normalizeSubject } from '../utils/emailUtils';

/**
 * Service for grouping emails into conversation threads
 */
class ThreadingService {
  /**
   * Build threads from a list of emails
   * Matches by: 1) threadId, 2) Normalized subject, 3) participant overlap
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
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
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
    // Use explicit threadId if available
    if (email.threadId) {
      return `thread:${email.threadId}`;
    }

    // Normalize subject for thread matching
    const normalizedSubject = normalizeSubject(email.subject);
    
    // Create key from normalized subject
    // Empty subjects get unique keys
    if (!normalizedSubject) {
      return `single:${email.id || Math.random()}`;
    }

    return `subject:${normalizedSubject}`;
  }

  /**
   * Create a thread object from a list of emails
   */
  private createThread(threadKey: string, emails: Email[]): EmailThread {
    const firstEmail = emails[0];
    const lastEmail = emails[emails.length - 1];

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
      firstMessageDate: new Date(firstEmail.date),
      lastMessageDate: new Date(lastEmail.date),
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
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
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

