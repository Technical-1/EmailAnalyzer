import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { purchaseDetector } from '../../services/purchaseDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your order confirmation #12345',
  sender: 'orders@maxwell.com',
  senderName: 'Maxwell',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'Order total: $42.00',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('PurchaseDetector merchant domain matching (issue 5)', () => {
  it('does NOT attribute a maxwell.com purchase to a "max" merchant', () => {
    const result = purchaseDetector.detectPurchase(email());
    // detected merchant must be the formatted domain (Maxwell), never a known
    // merchant matched via the buggy substring path
    expect(result.data?.merchant).toBe('Maxwell');
  });

  it('does NOT attribute php.net purchase to HP via substring match', () => {
    // Bug: 'php.net'.includes('hp.') is true, so it wrongly matches hp.com -> 'HP'
    // After fix: php.net is not a subdomain of hp.com, so merchant = formatted domain
    const result = purchaseDetector.detectPurchase(
      email({ sender: 'billing@php.net', senderName: 'PHP' }),
    );
    // If matched via bug, merchant would be 'HP'. After fix, merchant = 'PHP' (formatted domain).
    expect(result.data?.merchant).not.toBe('HP');
  });
});
