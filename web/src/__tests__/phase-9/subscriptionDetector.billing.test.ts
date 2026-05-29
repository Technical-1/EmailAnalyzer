import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { subscriptionDetector } from '../../services/subscriptionDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your subscription renewal',
  sender: 'billing@netflix.com',
  senderName: 'Netflix',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: '',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('SubscriptionDetector billing context (issue 10)', () => {
  it('picks the billing amount, not an unrelated footer price', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        body: 'Your subscription renews. You will be charged $15.49 per month. Free shipping on orders over $0.00.',
      }),
    );
    expect(result.amount).toBe(15.49);
  });

  it('returns no amount when no billing-context phrase surrounds a price', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        body: 'Your subscription renewal is confirmed. Check out our store: hoodies from $0.00 today!',
      }),
    );
    expect(result.amount).toBeUndefined();
  });

  it('detects yearly only when the billing context says yearly', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Your subscription renews. You will be billed $99.00 per year.' }),
    );
    expect(result.frequency).toBe('yearly');
  });

  it('does NOT pick yearly from "billed monthly, save yearly"', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Recurring charge: $9.99 billed monthly. Switch and save 20% yearly!' }),
    );
    expect(result.frequency).toBe('monthly');
  });

  it('returns undefined frequency when there is no billing signal at all', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Your subscription renewal is confirmed. Enjoy the show.' }),
    );
    expect(result.frequency).toBeUndefined();
  });
});
