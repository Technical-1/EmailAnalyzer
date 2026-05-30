import { describe, it, expect, beforeEach } from 'vitest';
import type { Email } from '../../types';
import {
  db,
  bulkInsertEmails,
  getEmailHeaders,
  searchEmailIdsByText,
  getSearchTextForIds,
  getAllSearchText,
} from '../../db/database';
import { filterEmails, parseSearchQuery } from '../../services/searchParser';

const mk = (over: Partial<Omit<Email, 'id'>> = {}): Omit<Email, 'id'> => ({
  subject: 'Subject',
  sender: 'sender@example.com',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'plain body',
  attachments: [],
  size: 1,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...over,
});

describe('DB-backed body search', () => {
  beforeEach(async () => {
    await Promise.all([db.emails.clear(), db.emailBodies.clear()]);
  });

  it('finds email ids whose body (searchText) contains the query', async () => {
    const [a, b] = await bulkInsertEmails([
      mk({ subject: 'one', body: 'contains pineapple here' }),
      mk({ subject: 'two', body: 'totally unrelated' }),
    ]);

    const ids = await searchEmailIdsByText('pineapple');
    expect(ids.has(a)).toBe(true);
    expect(ids.has(b)).toBe(false);

    // Case-insensitive, and empty query matches nothing.
    expect((await searchEmailIdsByText('PINEAPPLE')).has(a)).toBe(true);
    expect((await searchEmailIdsByText('   ')).size).toBe(0);
  });

  it('getSearchTextForIds returns searchText only for the requested ids', async () => {
    const [a, b] = await bulkInsertEmails([
      mk({ body: 'alpha body content' }),
      mk({ body: 'beta body content' }),
    ]);
    const map = await getSearchTextForIds([a]);
    expect(map.get(a)).toContain('alpha');
    expect(map.has(b)).toBe(false);
  });

  it('getAllSearchText returns searchText for every email', async () => {
    await bulkInsertEmails([mk({ body: 'x marks' }), mk({ body: 'y marks' })]);
    const map = await getAllSearchText();
    expect(map.size).toBe(2);
  });

  it('getEmailHeaders no longer carries searchText (it lives in the DB only)', async () => {
    await bulkInsertEmails([mk({ body: 'header strip check' })]);
    const headers = await getEmailHeaders();
    expect(headers).toHaveLength(1);
    expect((headers[0] as Record<string, unknown>).searchText).toBeUndefined();
  });

  it('filterEmails matches body-only hits via a supplied id set', async () => {
    const [a, b] = await bulkInsertEmails([
      mk({ subject: 'no match here', sender: 'x@y.com', body: 'secret pineapple' }),
      mk({ subject: 'no match here', sender: 'x@y.com', body: 'nothing relevant' }),
    ]);
    // Store-style header rows: slim, no searchText.
    const headers = await getEmailHeaders();
    const bodyIds = await searchEmailIdsByText('pineapple');

    const matched = filterEmails(headers as Email[], parseSearchQuery('pineapple'), { freeText: bodyIds });
    const ids = matched.map((e) => e.id);
    expect(ids).toContain(a);
    expect(ids).not.toContain(b);
  });
});
