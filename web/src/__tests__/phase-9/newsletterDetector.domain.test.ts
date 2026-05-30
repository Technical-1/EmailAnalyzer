import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { newsletterDetector } from '../../services/newsletterDetector';

// isPromotionalSenderDomain is private; expose via a tiny cast to keep the test focused.
const isPromoDomain = (domain: string): boolean =>
  (newsletterDetector as unknown as { isPromotionalSenderDomain(d: string): boolean })
    .isPromotionalSenderDomain(domain);

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Lunch tomorrow?',
  sender: 'friend@gmail.com',
  senderName: 'A Friend',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'Hey, are we still on for lunch?',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('NewsletterDetector promotional-domain matching', () => {
  it('does NOT treat gmail.com as a promotional domain (substring "mail." bug)', () => {
    expect(isPromoDomain('gmail.com')).toBe(false);
  });

  it('does NOT treat hotmail.com as a promotional domain', () => {
    expect(isPromoDomain('hotmail.com')).toBe(false);
  });

  it('does NOT treat an ordinary brand domain as promotional', () => {
    expect(isPromoDomain('mybrand.com')).toBe(false);
  });

  it('matches a marketing subdomain prefix (newsletter.brand.com)', () => {
    expect(isPromoDomain('newsletter.brand.com')).toBe(true);
  });

  it('matches a news. subdomain prefix', () => {
    expect(isPromoDomain('news.brand.com')).toBe(true);
  });

  it('matches a known full promotional domain (email.amazonses.com)', () => {
    expect(isPromoDomain('email.amazonses.com')).toBe(true);
  });

  it('does NOT classify a personal gmail email with a generic footer as promotional', () => {
    // 3 generic footer phrases push marketing matches to 3, but without the
    // bogus gmail "mail." domain boost the scores stay below the 40 threshold.
    const personal = email({
      body: 'Thanks!\n\nunsubscribe\nprivacy policy\nall rights reserved',
    });
    const result = newsletterDetector.detectNewsletter(personal);
    expect(result.isPromotional).toBe(false);
    expect(result.isNewsletter).toBe(false);
  });
});
