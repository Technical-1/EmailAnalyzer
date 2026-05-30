import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { purchaseDetector } from '../../services/purchaseDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your order confirmation #12345',
  sender: 'orders@example.com',
  senderName: 'Example',
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

describe('PurchaseDetector currency persistence', () => {
  it('createPurchaseFromEmail uses the supplied currency, not a hardcoded USD', () => {
    const purchase = purchaseDetector.createPurchaseFromEmail(
      email(),
      'Acme',
      49.99,
      undefined,
      'EUR',
    );
    expect(purchase.currency).toBe('EUR');
  });

  it('defaults to USD when no currency is supplied', () => {
    const purchase = purchaseDetector.createPurchaseFromEmail(email(), 'Acme', 10);
    expect(purchase.currency).toBe('USD');
  });

  it('round-trips a detected EUR amount into the stored purchase currency', () => {
    const eur = email({
      sender: 'orders@shop.de',
      senderName: 'Shop',
      subject: 'Your order confirmation #99',
      body: 'Order total: €49,99\nThank you for your order.',
    });
    const result = purchaseDetector.detectPurchase(eur);
    expect(result.data?.currency).toBe('EUR');

    const purchase = purchaseDetector.createPurchaseFromEmail(
      eur,
      result.data!.merchant!,
      result.data!.amount!,
      result.data!.orderNumber,
      result.data!.currency,
    );
    expect(purchase.currency).toBe('EUR');
    expect(purchase.amount).toBe(49.99);
  });
});
