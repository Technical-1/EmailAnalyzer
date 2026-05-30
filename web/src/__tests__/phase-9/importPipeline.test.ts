import { describe, it, expect, beforeEach } from 'vitest';
import type { Email } from '../../types';
import { db } from '../../db/database';
import { createImportCounts, processEmailBatch } from '../../services/importPipeline';

const email = (overrides: Partial<Omit<Email, 'id'>> = {}): Omit<Email, 'id'> => ({
  subject: 'Hello',
  sender: 'someone@example.com',
  senderName: undefined,
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'plain message',
  attachments: [],
  size: 100,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

// Four emails that each detector should positively classify.
const purchaseEmail = () =>
  email({
    sender: 'orders@amazon.com',
    subject: 'Your order confirmation #100001',
    body: 'Order total: $42.00\nYour order has been confirmed.',
  });
const accountEmail = () =>
  email({
    sender: 'info@netflix.com',
    subject: 'Welcome to Netflix',
    body: 'Your account has been created. Thanks for signing up!',
  });
const subscriptionEmail = () =>
  email({
    sender: 'billing@spotify.com',
    subject: 'Your subscription renewal',
    body: 'Your subscription will auto-renew. Billed monthly.',
  });
const newsletterEmail = () =>
  email({
    sender: 'news@substack.com',
    subject: 'Weekly digest',
    body: 'Unsubscribe here. View in browser. Privacy policy. All rights reserved.',
  });

describe('importPipeline.processEmailBatch', () => {
  beforeEach(async () => {
    await Promise.all([
      db.emails.clear(),
      db.emailBodies.clear(),
      db.accounts.clear(),
      db.purchases.clear(),
      db.subscriptions.clear(),
      db.newsletters.clear(),
      db.contacts.clear(),
    ]);
  });

  it('runs detection on EVERY email, not just every 5th', async () => {
    // All four detect-positive emails sit at positions 1-4 — none a multiple of
    // 5 — so any sampling gate (the old `% 5` bug) would detect none of them.
    const counts = createImportCounts();
    const batch = [purchaseEmail(), accountEmail(), subscriptionEmail(), newsletterEmail()];

    await processEmailBatch(batch, counts, new Set());

    expect(counts.purchases).toBe(1);
    expect(counts.accounts).toBe(1);
    expect(counts.subscriptions).toBe(1);
    expect(counts.newsletters).toBe(1);
    expect(await db.purchases.count()).toBe(1);
    expect(await db.accounts.count()).toBe(1);
    expect(await db.subscriptions.count()).toBe(1);
    expect(await db.newsletters.count()).toBe(1);
  });

  it('tracks every distinct sender as a contact (not just every 10th email)', async () => {
    const counts = createImportCounts();
    const batch = [
      email({ sender: 'a@x.com' }),
      email({ sender: 'b@x.com' }),
      email({ sender: 'c@x.com' }),
    ];

    await processEmailBatch(batch, counts, new Set());

    expect(counts.contacts).toBe(3);
    expect(await db.contacts.count()).toBe(3);
  });

  it('persists the whole batch and links a detection to the correct inserted email id', async () => {
    const counts = createImportCounts();
    const batch = [email({ sender: 'noise@x.com' }), purchaseEmail()];

    await processEmailBatch(batch, counts, new Set());

    expect(counts.emails).toBe(2);
    expect(await db.emails.count()).toBe(2);

    const purchase = await db.purchases.toCollection().first();
    const stored = await db.emails.get(purchase!.emailId!);
    expect(stored?.sender).toBe('orders@amazon.com');
  });

  it('dedupes subscriptions for the same sender domain detected under different names', async () => {
    const counts = createImportCounts();
    const batch = [
      email({
        sender: 'billing@acmecloud.io',
        subject: 'Your Acme Pro subscription renewal',
        body: 'Auto-renews monthly. $10.00 charged.',
      }),
      email({
        sender: 'noreply@acmecloud.io',
        subject: 'Subscription renewal',
        body: 'Auto-renews monthly. $10.00 charged.',
      }),
    ];

    await processEmailBatch(batch, counts, new Set());

    expect(await db.subscriptions.count()).toBe(1);
  });
});
