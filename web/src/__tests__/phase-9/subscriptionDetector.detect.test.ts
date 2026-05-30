import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { subscriptionDetector } from '../../services/subscriptionDetector';

// Behavioral coverage for detectSubscription()'s end-to-end classification and
// getKnownServices(). The existing subscriptionDetector.{billing,domain} tests
// cover amount/frequency windowing and substring matching only.

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Hello',
  sender: 'someone@example.com',
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

describe('SubscriptionDetector.detectSubscription', () => {
  it('detects a known service renewal with amount, frequency and category', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        sender: 'billing@spotify.com',
        subject: 'Your subscription renewal',
        body: 'Your subscription will auto-renew. You will be charged $9.99 per month.',
      })
    );

    expect(result.isSubscription).toBe(true);
    expect(result.serviceName).toBe('Spotify');
    expect(result.category).toBe('streaming');
    expect(result.amount).toBe(9.99);
    expect(result.currency).toBe('USD');
    expect(result.frequency).toBe('monthly');
  });

  it('detects a subscription from an unknown sender via body patterns and names it from the sender', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        sender: 'noreply@someservice.io',
        senderName: 'Some Service',
        subject: 'Receipt',
        body: 'Billing period: monthly\nYour next billing date: 2024-02-01\nRecurring charge: $5.00',
      })
    );

    expect(result.isSubscription).toBe(true);
    expect(result.serviceName).toBe('Some Service');
  });

  it('does NOT flag a regular personal email as a subscription', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        sender: 'friend@gmail.com',
        subject: 'hi',
        body: 'how are you doing today?',
      })
    );

    expect(result.isSubscription).toBe(false);
    expect(result.category).toBe('other');
  });
});

describe('SubscriptionDetector.getKnownServices', () => {
  it('returns the catalogue of known subscription services with domain + category', () => {
    const services = subscriptionDetector.getKnownServices();
    const netflix = services.find(s => s.domain === 'netflix.com');

    expect(services.length).toBeGreaterThan(0);
    expect(netflix).toEqual({ domain: 'netflix.com', name: 'Netflix', category: 'streaming' });
  });
});
