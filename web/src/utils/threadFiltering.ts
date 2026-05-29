import type { Email, EmailThread } from '../types';
import { threadingService } from '../services/threadingService';

export interface ViewFilter {
  /** The folder id to show (ignored when isFavorites is true). */
  currentFolder: string;
  /** When true, show starred emails across all folders instead of a single folder. */
  isFavorites: boolean;
}

/**
 * Filter emails down to the set visible in the current view (folder or favorites).
 * Mirrors the list-view folder filtering in EmailsPage so list and thread modes agree.
 */
export function filterEmailsForView(emails: Email[], view: ViewFilter): Email[] {
  if (view.isFavorites) {
    return emails.filter((e) => e.isStarred);
  }
  return emails.filter((e) => e.folderId === view.currentFolder);
}

/**
 * Build conversation threads from ONLY the emails visible in the current view, so Threads
 * mode in Trash/Archive/Favorites/custom folders shows only that view's conversations.
 */
export function buildThreadsForView(emails: Email[], view: ViewFilter): EmailThread[] {
  return threadingService.buildThreads(filterEmailsForView(emails, view));
}
