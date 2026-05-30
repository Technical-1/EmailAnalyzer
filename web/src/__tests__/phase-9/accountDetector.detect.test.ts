import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { accountDetector } from '../../services/accountDetector';

// Behavioral coverage for the primary detectAccountSignup() surface and the
// createAccountFromEmail() factory. The existing accountDetector.domain test
// only covers substring/subdomain matching (issue 5), so this fills the
// happy-path + confidence-threshold gaps.

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
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

describe('AccountDetector.detectAccountSignup', () => {
  it('detects a known service with a welcome subject (known + subject = 80)', () => {
    const result = accountDetector.detectAccountSignup(
      email({
        sender: 'info@netflix.com',
        subject: 'Welcome to Netflix',
        body: 'Your account has been created. Thanks for signing up!',
      })
    );

    expect(result.type).toBe('account');
    expect(result.confidence).toBeGreaterThanOrEqual(70);
    expect(result.data?.serviceName).toBe('Netflix');
    expect(result.data?.serviceType).toBe('streaming');
  });

  it('detects an unknown service via strong subject + body and falls back to the domain name', () => {
    const result = accountDetector.detectAccountSignup(
      email({
        sender: 'hi@coolapp.io',
        subject: 'Verify your email',
        body: 'Click here to verify your email and finish setup.',
      })
    );

    expect(result.type).toBe('account');
    // No known service, no extractable name in subject -> formatted domain.
    expect(result.data?.serviceName).toBe('Coolapp');
    expect(result.data?.serviceType).toBe('other');
  });

  it('extracts the service name from a "Welcome to X!" subject for an unknown domain', () => {
    const result = accountDetector.detectAccountSignup(
      email({
        sender: 'team@mailer.acmewidgets.com',
        subject: 'Welcome to Acme!',
        body: 'Thanks for signing up. Your account has been created.',
      })
    );

    expect(result.type).toBe('account');
    expect(result.data?.serviceName).toBe('Acme');
  });

  it('does NOT flag a regular personal email as an account signup', () => {
    const result = accountDetector.detectAccountSignup(
      email({
        sender: 'friend@gmail.com',
        subject: 'lunch tomorrow?',
        body: 'wanna grab lunch around noon?',
      })
    );

    expect(result.type).toBe('none');
    expect(result.confidence).toBe(0);
  });

  it('does NOT flag a known service email that lacks any signup language (known alone = 40 < 70)', () => {
    const result = accountDetector.detectAccountSignup(
      email({
        sender: 'info@netflix.com',
        subject: 'New arrivals this week',
        body: 'Check out what is new to stream.',
      })
    );

    expect(result.type).toBe('none');
  });

  it('classifies known services into the correct serviceType', () => {
    expect(accountDetector.getServiceType('github.com')).toBe('development');
    expect(accountDetector.getServiceType('chase.com')).toBe('banking');
    expect(accountDetector.getServiceType('instagram.com')).toBe('social');
    expect(accountDetector.getServiceType('unknown-brand-xyz.com')).toBe('other');
  });
});

describe('AccountDetector.createAccountFromEmail', () => {
  it('builds an account record from the email, inferring serviceType from the domain', () => {
    const e = email({ id: 42, sender: 'noreply@github.com', date: new Date('2023-06-01') });
    const account = accountDetector.createAccountFromEmail(e, 'GitHub');

    expect(account.serviceName).toBe('GitHub');
    expect(account.signupEmailId).toBe(42);
    expect(account.domain).toBe('github.com');
    expect(account.serviceType).toBe('development');
    expect(account.emailCount).toBe(1);
    expect(account.signupDate).toEqual(new Date('2023-06-01'));
  });

  it('honors an explicit serviceType override', () => {
    const account = accountDetector.createAccountFromEmail(
      email({ sender: 'noreply@github.com' }),
      'GitHub',
      'other'
    );
    expect(account.serviceType).toBe('other');
  });
});
