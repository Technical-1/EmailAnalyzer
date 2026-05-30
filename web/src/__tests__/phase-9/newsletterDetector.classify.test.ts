import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { newsletterDetector } from '../../services/newsletterDetector';

// Behavioral coverage for the newsletter-vs-promotional split, unsubscribe-link
// extraction, and groupBySender/frequency aggregation. The existing
// newsletterDetector.domain test covers promotional-domain matching only.

const MARKETING_FOOTER =
  'Unsubscribe here. View in browser. Privacy policy. All rights reserved.';

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

describe('NewsletterDetector.categorize', () => {
  it('classifies a discount blast as promotional', () => {
    const category = newsletterDetector.categorize(
      email({
        sender: 'deals@news.brand.com',
        subject: 'Save 50% off everything',
        body: MARKETING_FOOTER,
      })
    );
    expect(category).toBe('promotional');
  });

  it('classifies a weekly digest as a newsletter (not promotional)', () => {
    const category = newsletterDetector.categorize(
      email({
        sender: 'news@substack.com',
        subject: 'Weekly digest',
        body: MARKETING_FOOTER,
      })
    );
    expect(category).toBe('newsletter');
  });

  it('classifies an ordinary personal email as regular', () => {
    const category = newsletterDetector.categorize(
      email({
        sender: 'friend@gmail.com',
        subject: 'coffee?',
        body: 'free tomorrow morning?',
      })
    );
    expect(category).toBe('regular');
  });
});

describe('NewsletterDetector.extractUnsubscribeLink', () => {
  it('pulls an unsubscribe href out of an anchor tag', () => {
    const link = newsletterDetector.extractUnsubscribeLink(
      '<a href="https://example.com/unsubscribe?id=9">Unsubscribe</a>'
    );
    expect(link).toBe('https://example.com/unsubscribe?id=9');
  });

  it('returns undefined when there is no unsubscribe link', () => {
    expect(newsletterDetector.extractUnsubscribeLink('<p>just text</p>')).toBeUndefined();
    expect(newsletterDetector.extractUnsubscribeLink('')).toBeUndefined();
  });
});

describe('NewsletterDetector.groupBySender', () => {
  it('aggregates a sender across emails, deriving name, count and frequency', () => {
    const emails = [
      email({ id: 1, sender: 'news@substack.com', subject: 'Weekly digest', body: MARKETING_FOOTER, date: new Date('2024-01-15') }),
      email({ id: 2, sender: 'news@substack.com', subject: 'Weekly digest', body: MARKETING_FOOTER, date: new Date('2024-01-08') }),
      email({ id: 3, sender: 'news@substack.com', subject: 'Weekly digest', body: MARKETING_FOOTER, date: new Date('2024-01-01') }),
    ];

    const grouped = newsletterDetector.groupBySender(emails);
    const sub = grouped.get('news@substack.com');

    expect(sub).toBeDefined();
    expect(sub?.emailCount).toBe(3);
    expect(sub?.senderName).toBe('Substack');
    expect(sub?.frequency).toBe('weekly');
    expect(sub?.lastEmailDate).toEqual(new Date('2024-01-15'));
  });

  it('does not group ordinary non-marketing emails', () => {
    const grouped = newsletterDetector.groupBySender([
      email({ sender: 'friend@gmail.com', subject: 'hi', body: 'hello there' }),
    ]);
    expect(grouped.size).toBe(0);
  });
});
