import { describe, it, expect } from 'vitest';
import { mboxParser } from '../../services/mboxParser';

describe('MBOXParser', () => {
  describe('isMBOXFile', () => {
    it('should identify .mbox files', () => {
      const file = new File([''], 'test.mbox', { type: 'application/mbox' });
      expect(mboxParser.isMBOXFile(file)).toBe(true);
    });

    it('should identify .mbx files', () => {
      const file = new File([''], 'inbox.mbx');
      expect(mboxParser.isMBOXFile(file)).toBe(true);
    });

    it('should not identify other file types', () => {
      const file = new File([''], 'emails.json', { type: 'application/json' });
      expect(mboxParser.isMBOXFile(file)).toBe(false);
    });
  });

  describe('parseMBOXFile', () => {
    it('should parse a simple MBOX email', async () => {
      const mboxContent = `From sender@example.com Mon Jan 01 00:00:00 2024
From: John Doe <john@example.com>
To: jane@example.com
Subject: Test Email
Date: Mon, 01 Jan 2024 12:00:00 +0000

This is the email body.
`;

      const file = new File([mboxContent], 'test.mbox', { type: 'application/mbox' });
      const emails = await mboxParser.parseMBOXFile(file);

      expect(emails).toHaveLength(1);
      expect(emails[0].subject).toBe('Test Email');
      expect(emails[0].sender).toBe('john@example.com');
      expect(emails[0].body).toBe('This is the email body.');
    });

    it('should parse multiple emails', async () => {
      const mboxContent = `From sender1@example.com Mon Jan 01 00:00:00 2024
From: sender1@example.com
Subject: Email 1
Date: Mon, 01 Jan 2024 12:00:00 +0000

Body 1
From sender2@example.com Tue Jan 02 00:00:00 2024
From: sender2@example.com
Subject: Email 2
Date: Tue, 02 Jan 2024 12:00:00 +0000

Body 2
`;

      const file = new File([mboxContent], 'test.mbox', { type: 'application/mbox' });
      const emails = await mboxParser.parseMBOXFile(file);

      expect(emails).toHaveLength(2);
      expect(emails[0].subject).toBe('Email 1');
      expect(emails[1].subject).toBe('Email 2');
    });

    it('should handle emails with multiple recipients', async () => {
      const mboxContent = `From sender@example.com Mon Jan 01 00:00:00 2024
From: sender@example.com
To: user1@example.com, user2@example.com, user3@example.com
Subject: Group Email
Date: Mon, 01 Jan 2024 12:00:00 +0000

Hello everyone!
`;

      const file = new File([mboxContent], 'test.mbox', { type: 'application/mbox' });
      const emails = await mboxParser.parseMBOXFile(file);

      expect(emails).toHaveLength(1);
      expect(emails[0].recipients).toHaveLength(3);
      expect(emails[0].recipients).toContain('user1@example.com');
      expect(emails[0].recipients).toContain('user2@example.com');
      expect(emails[0].recipients).toContain('user3@example.com');
    });

    it('should handle quoted-printable encoding', async () => {
      const mboxContent = `From sender@example.com Mon Jan 01 00:00:00 2024
From: sender@example.com
Subject: Encoded Email
Content-Transfer-Encoding: quoted-printable
Date: Mon, 01 Jan 2024 12:00:00 +0000

Hello=20World
`;

      const file = new File([mboxContent], 'test.mbox', { type: 'application/mbox' });
      const emails = await mboxParser.parseMBOXFile(file);

      expect(emails).toHaveLength(1);
      expect(emails[0].body).toBe('Hello World');
    });

    it('should handle empty MBOX file', async () => {
      const file = new File([''], 'empty.mbox', { type: 'application/mbox' });
      const emails = await mboxParser.parseMBOXFile(file);
      expect(emails).toHaveLength(0);
    });

    it('should report progress during parsing', async () => {
      const mboxContent = `From sender@example.com Mon Jan 01 00:00:00 2024
From: sender@example.com
Subject: Test
Date: Mon, 01 Jan 2024 12:00:00 +0000

Body
`;

      const file = new File([mboxContent], 'test.mbox', { type: 'application/mbox' });
      const progressUpdates: number[] = [];

      await mboxParser.parseMBOXFile(file, (progress) => {
        progressUpdates.push(progress);
      });

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });
});

