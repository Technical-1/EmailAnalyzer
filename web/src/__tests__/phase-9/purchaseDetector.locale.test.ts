import { describe, it, expect } from 'vitest';
import { purchaseDetector } from '../../services/purchaseDetector';

// parseAmount is private; expose via a tiny cast to keep the test focused.
const parse = (s: string, currency: string): number =>
  (purchaseDetector as unknown as { parseAmount(s: string, c: string): number }).parseAmount(s, currency);

describe('PurchaseDetector.parseAmount locale handling (issue 11)', () => {
  it('EUR thousands with dot, no cents: 1.234 -> 1234', () => {
    expect(parse('1.234', 'EUR')).toBe(1234);
  });

  it('EUR with dot thousands and comma decimals: 1.234,56 -> 1234.56', () => {
    expect(parse('1.234,56', 'EUR')).toBe(1234.56);
  });

  it('EUR comma decimals only: 1,23 -> 1.23 (cents NOT dropped)', () => {
    expect(parse('1,23', 'EUR')).toBe(1.23);
  });

  it('EUR space thousands: 1 234,56 -> 1234.56', () => {
    expect(parse('1 234,56', 'EUR')).toBe(1234.56);
  });

  it('USD dot decimals with comma thousands: 1,234.56 -> 1234.56', () => {
    expect(parse('1,234.56', 'USD')).toBe(1234.56);
  });

  it('USD plain decimals: 42.00 -> 42', () => {
    expect(parse('42.00', 'USD')).toBe(42);
  });

  it('CHF apostrophe thousands with dot decimals: 1\'234.50 -> 1234.5', () => {
    expect(parse("1'234.50", 'CHF')).toBe(1234.5);
  });
});
