import { describe, it, expect } from 'vitest';
import { filterEmailsForView, buildThreadsForView } from '../../utils/threadFiltering';
import { SYSTEM_FOLDERS, type Email } from '../../types';

function makeEmail(over: Partial<Email>): Email {
  return {
    subject: 'Hello',
    sender: 'a@example.com',
    senderName: 'A',
    recipients: ['me@example.com'],
    body: 'body',
    date: new Date('2024-01-01'),
    folderId: SYSTEM_FOLDERS.INBOX,
    isRead: true,
    isStarred: false,
    emailType: 'regular',
    attachments: [],
    ...over,
  } as Email;
}

describe('filterEmailsForView', () => {
  const inboxEmail = makeEmail({ id: 1, folderId: SYSTEM_FOLDERS.INBOX, subject: 'Inbox thread' });
  const trashEmail = makeEmail({ id: 2, folderId: SYSTEM_FOLDERS.TRASH, subject: 'Trash thread' });
  const archiveEmail = makeEmail({ id: 3, folderId: SYSTEM_FOLDERS.ARCHIVE, subject: 'Archive thread' });
  const starredTrash = makeEmail({ id: 4, folderId: SYSTEM_FOLDERS.TRASH, isStarred: true, subject: 'Starred trash' });
  const all = [inboxEmail, trashEmail, archiveEmail, starredTrash];

  it('returns only emails in the given folder', () => {
    const result = filterEmailsForView(all, { currentFolder: SYSTEM_FOLDERS.TRASH, isFavorites: false });
    expect(result.map(e => e.id).sort()).toEqual([2, 4]);
  });

  it('returns only inbox emails for inbox folder', () => {
    const result = filterEmailsForView(all, { currentFolder: SYSTEM_FOLDERS.INBOX, isFavorites: false });
    expect(result.map(e => e.id)).toEqual([1]);
  });

  it('returns all starred emails across folders when isFavorites', () => {
    const result = filterEmailsForView(all, { currentFolder: SYSTEM_FOLDERS.INBOX, isFavorites: true });
    expect(result.map(e => e.id)).toEqual([4]);
  });
});

describe('buildThreadsForView', () => {
  const trashA = makeEmail({ id: 10, folderId: SYSTEM_FOLDERS.TRASH, subject: 'Project X' });
  const trashB = makeEmail({ id: 11, folderId: SYSTEM_FOLDERS.TRASH, subject: 'Re: Project X' });
  const inboxC = makeEmail({ id: 12, folderId: SYSTEM_FOLDERS.INBOX, subject: 'Different topic' });
  const all = [trashA, trashB, inboxC];

  it('builds threads only from the current folder (trash shows only trash convos)', () => {
    const threads = buildThreadsForView(all, { currentFolder: SYSTEM_FOLDERS.TRASH, isFavorites: false });
    const allIds = threads.flatMap(t => t.emails.map(e => e.id));
    expect(allIds).not.toContain(12); // inbox email must not appear
    expect(allIds.sort()).toEqual([10, 11]);
  });

  it('does not include trash conversations when viewing inbox', () => {
    const threads = buildThreadsForView(all, { currentFolder: SYSTEM_FOLDERS.INBOX, isFavorites: false });
    const allIds = threads.flatMap(t => t.emails.map(e => e.id));
    expect(allIds).toEqual([12]);
  });
});
