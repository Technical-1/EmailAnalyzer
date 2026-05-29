import { describe, it, expect } from 'vitest';
import { isDomainMatch } from '../../services/domainMatch';

describe('isDomainMatch', () => {
  it('matches exact domain', () => {
    expect(isDomainMatch('netflix.com', 'netflix.com')).toBe(true);
  });

  it('matches a subdomain of the service domain', () => {
    expect(isDomainMatch('mail.netflix.com', 'netflix.com')).toBe(true);
    expect(isDomainMatch('noreply.spotify.com', 'spotify.com')).toBe(true);
  });

  it('does NOT match an unrelated domain that merely contains the base word', () => {
    expect(isDomainMatch('maxwell.com', 'max.com')).toBe(false);
    expect(isDomainMatch('pineapple.com', 'apple.com')).toBe(false);
    expect(isDomainMatch('php.net', 'hp.com')).toBe(false);
  });

  it('does NOT match when service domain is a suffix without a dot boundary', () => {
    // 'notnetflix.com' ends with 'netflix.com' as a string but not on a label boundary
    expect(isDomainMatch('notnetflix.com', 'netflix.com')).toBe(false);
  });

  it('is case-insensitive and trims', () => {
    expect(isDomainMatch('Mail.Netflix.COM', 'netflix.com')).toBe(true);
    expect(isDomainMatch(' netflix.com ', ' NETFLIX.COM ')).toBe(true);
  });

  it('returns false for empty inputs', () => {
    expect(isDomainMatch('', 'netflix.com')).toBe(false);
    expect(isDomainMatch('netflix.com', '')).toBe(false);
  });
});
