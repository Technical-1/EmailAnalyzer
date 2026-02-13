import { describe, it, expect } from 'vitest';
import {
  cleanEmailAddress,
  stripHtml,
  extractDomain,
  formatFileSize,
  truncateText,
  normalizeSubject,
  getInitials,
} from '../../utils/emailUtils';

describe('emailUtils', () => {
  describe('cleanEmailAddress', () => {
    it('should clean angle brackets from email', () => {
      expect(cleanEmailAddress('<test@example.com>')).toBe('test@example.com');
    });

    it('should extract email from "Name <email>" format', () => {
      expect(cleanEmailAddress('John Doe <john@example.com>')).toBe('john@example.com');
    });

    it('should lowercase email addresses', () => {
      expect(cleanEmailAddress('Test@EXAMPLE.COM')).toBe('test@example.com');
    });

    it('should return default for empty input', () => {
      expect(cleanEmailAddress('')).toBe('unknown@example.com');
    });
  });

  describe('stripHtml', () => {
    it('should remove HTML tags', () => {
      expect(stripHtml('<p>Hello <strong>World</strong></p>')).toBe('Hello World');
    });

    it('should handle empty input', () => {
      expect(stripHtml('')).toBe('');
    });
  });

  describe('extractDomain', () => {
    it('should extract domain from email', () => {
      expect(extractDomain('user@example.com')).toBe('example.com');
    });

    it('should handle email with angle brackets', () => {
      expect(extractDomain('<user@example.com>')).toBe('example.com');
    });

    it('should return empty for invalid email', () => {
      expect(extractDomain('invalid')).toBe('');
    });
  });

  describe('formatFileSize', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500)).toBe('500 B');
    });

    it('should format kilobytes', () => {
      expect(formatFileSize(1024)).toBe('1 KB');
    });

    it('should format megabytes', () => {
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('should handle zero', () => {
      expect(formatFileSize(0)).toBe('0 B');
    });
  });

  describe('truncateText', () => {
    it('should truncate long text', () => {
      expect(truncateText('This is a long text', 10)).toBe('This is...');
    });

    it('should not truncate short text', () => {
      expect(truncateText('Short', 10)).toBe('Short');
    });

    it('should handle empty input', () => {
      expect(truncateText('', 10)).toBe('');
    });
  });

  describe('normalizeSubject', () => {
    it('should remove Re: prefix', () => {
      expect(normalizeSubject('Re: Hello')).toBe('hello');
    });

    it('should remove multiple Re:/Fwd: prefixes', () => {
      expect(normalizeSubject('Re: Fwd: Re: Hello World')).toBe('hello world');
    });

    it('should handle various prefix formats', () => {
      expect(normalizeSubject('FW: Test')).toBe('test');
      expect(normalizeSubject('AW: Test')).toBe('test');
    });

    it('should normalize whitespace', () => {
      expect(normalizeSubject('Hello   World')).toBe('hello world');
    });
  });

  describe('getInitials', () => {
    it('should get initials from full name', () => {
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should get initials from single word', () => {
      expect(getInitials('John')).toBe('JO');
    });

    it('should handle email addresses', () => {
      expect(getInitials('john.doe@example.com')).toBe('JD');
    });

    it('should handle empty input', () => {
      expect(getInitials('')).toBe('?');
    });
  });
});

