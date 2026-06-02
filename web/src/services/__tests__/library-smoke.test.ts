import { describe, it, expect } from 'vitest';
import { MBOXParser, AccountDetector } from '@technical-1/email-archive-parser';

describe('library smoke', () => {
  it('parses a trivial MBOX buffer and runs a detector', async () => {
    const mbox = [
      'From a@x.com Mon Jan  1 00:00:00 2024',
      'From: Welcome <info@netflix.com>',
      'Subject: Welcome to Netflix!',
      'Date: Mon, 01 Jan 2024 00:00:00 +0000',
      '',
      'Your account has been created.',
      '',
    ].join('\n');
    const result = await new MBOXParser().parse(Buffer.from(mbox, 'utf-8'));
    expect(result.emails.length).toBe(1);
    const det = new AccountDetector().detect(result.emails[0]);
    expect(det.type).toBe('account');
  });
});
