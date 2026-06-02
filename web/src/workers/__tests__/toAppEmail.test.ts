import { describe, it, expect } from 'vitest';
import type { Email as LibEmail } from '@technical-1/email-archive-parser';
import { toAppEmail } from '../toAppEmail';

const lib: LibEmail = {
  subject: 'Hello', sender: 'a@example.com', senderName: 'A',
  recipients: ['me@example.com'], date: null,
  body: 'plain body', htmlBody: '<p>rich <b>body</b></p>',
  attachments: [], size: 123, isRead: true, isStarred: false, folderId: 'inbox',
};

describe('toAppEmail', () => {
  it('adds app-only fields and preserves a null date', () => {
    const e = toAppEmail(lib);
    expect(e.emailType).toBe('regular');
    expect(e.date).toBeNull();
    expect(typeof e.snippet).toBe('string');
    expect(e.snippet!.length).toBeGreaterThan(0);
    expect('id' in e).toBe(false);
  });
});
