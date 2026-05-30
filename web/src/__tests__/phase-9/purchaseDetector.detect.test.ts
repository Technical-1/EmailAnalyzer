import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { purchaseDetector } from '../../services/purchaseDetector';

// Behavioral coverage for detectPurchase()'s confidence gating, anti-pattern
// rejection, order-number extraction, and getPurchaseCategory(). The existing
// purchaseDetector.{currency,locale,domain} tests cover amount parsing and
// merchant matching only.

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

describe('PurchaseDetector.detectPurchase', () => {
  it('detects a known-merchant order confirmation with an amount', () => {
    const result = purchaseDetector.detectPurchase(
      email({
        sender: 'orders@amazon.com',
        subject: 'Your order confirmation #100001',
        body: 'Order total: $42.00\nYour order has been confirmed.',
      })
    );

    expect(result.type).toBe('purchase');
    expect(result.confidence).toBeGreaterThanOrEqual(70);
    expect(result.data?.merchant).toBe('Amazon');
    expect(result.data?.amount).toBe(42);
    expect(result.data?.currency).toBe('USD');
  });

  it('extracts and validates an order number from the body', () => {
    const result = purchaseDetector.detectPurchase(
      email({
        sender: 'orders@amazon.com',
        subject: 'Your order confirmation',
        body: 'Order number: ABC12345\nOrder total: $42.00\nYour order has been confirmed.',
      })
    );

    expect(result.type).toBe('purchase');
    expect(result.data?.orderNumber).toBe('ABC12345');
  });

  it('rejects promotional emails that trip 3+ anti-patterns', () => {
    const result = purchaseDetector.detectPurchase(
      email({
        sender: 'deals@amazon.com',
        subject: 'Save $50 today!',
        body: 'Up to 70% off! Free shipping on all orders. Order total: $42.00',
      })
    );

    expect(result.type).toBe('none');
  });

  it('does NOT report a purchase when no amount can be parsed (confidence < 70)', () => {
    const result = purchaseDetector.detectPurchase(
      email({
        sender: 'orders@amazon.com',
        subject: 'Your order confirmation',
        body: 'Thanks for your order. Details are inside your account.',
      })
    );

    expect(result.type).toBe('none');
  });

  it('does NOT flag a plain personal email as a purchase', () => {
    const result = purchaseDetector.detectPurchase(
      email({
        sender: 'friend@gmail.com',
        subject: 're: dinner',
        body: 'see you at 7',
      })
    );

    expect(result.type).toBe('none');
  });
});

describe('PurchaseDetector.getPurchaseCategory', () => {
  it('maps known merchants to their category', () => {
    expect(purchaseDetector.getPurchaseCategory('Amazon')).toBe('ecommerce');
    expect(purchaseDetector.getPurchaseCategory('Netflix')).toBe('entertainment');
    expect(purchaseDetector.getPurchaseCategory('Uber')).toBe('transportation');
    expect(purchaseDetector.getPurchaseCategory('Delta Airlines')).toBe('travel');
  });

  it('falls back to "other" for unknown merchants', () => {
    expect(purchaseDetector.getPurchaseCategory('Some Local Shop')).toBe('other');
  });
});

describe('PurchaseDetector.createPurchaseFromEmail', () => {
  it('builds a purchase record and derives the category from the merchant', () => {
    const purchase = purchaseDetector.createPurchaseFromEmail(
      email({ id: 7, date: new Date('2024-03-03') }),
      'Amazon',
      42,
      'ABC12345'
    );

    expect(purchase.emailId).toBe(7);
    expect(purchase.merchant).toBe('Amazon');
    expect(purchase.amount).toBe(42);
    expect(purchase.orderNumber).toBe('ABC12345');
    expect(purchase.category).toBe('ecommerce');
    expect(purchase.purchaseDate).toEqual(new Date('2024-03-03'));
  });
});
