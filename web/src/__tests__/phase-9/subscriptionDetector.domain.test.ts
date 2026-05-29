import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { subscriptionDetector } from '../../services/subscriptionDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your subscription renewal',
  sender: 'billing@maxwell.com',
  senderName: 'Maxwell',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'Your subscription renews. Recurring charge: $9.99 per month.',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('SubscriptionDetector domain matching (issue 5)', () => {
  it('does NOT attribute maxwell.com to "Max" via base-word substring', () => {
    const result = subscriptionDetector.detectSubscription(email());
    // 'max.com' -> { name: 'Max' } exists in knownSubscriptions; maxwell.com must NOT match it
    expect(result.serviceName).not.toBe('Max');
  });

  it('still matches a real subdomain of a known service', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ sender: 'no-reply@mail.netflix.com', senderName: '' }),
    );
    expect(result.serviceName).toBe('Netflix');
  });
});
