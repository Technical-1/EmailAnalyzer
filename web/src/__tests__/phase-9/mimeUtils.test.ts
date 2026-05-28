import { describe, it, expect } from 'vitest';
import {
  MAX_SUBJECT_LEN,
  MAX_BODY_LEN,
  MAX_EMAIL_LEN,
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
} from '../../services/mimeUtils';
import { decodeQuotedPrintable } from '../../services/mimeUtils';
import { decodeRfc2047 } from '../../services/mimeUtils';
import { isMboxFromLine } from '../../services/mimeUtils';
import { makeSnippet } from '../../services/mimeUtils';

describe('mimeUtils size constants', () => {
  it('matches the values ported from olmParser', () => {
    expect(MAX_SUBJECT_LEN).toBe(1000);
    expect(MAX_BODY_LEN).toBe(10 * 1024 * 1024);
    expect(MAX_EMAIL_LEN).toBe(254);
    expect(MAX_COMPRESSED_BYTES).toBe(500 * 1024 * 1024);
    expect(MAX_DECOMPRESSED_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });
});

describe('decodeQuotedPrintable', () => {
  it('decodes a multi-byte UTF-8 sequence', () => {
    expect(decodeQuotedPrintable('=C3=A9')).toBe('é');
  });

  it('decodes a word with mixed literal and encoded bytes', () => {
    expect(decodeQuotedPrintable('caf=C3=A9')).toBe('café');
  });

  it('removes soft line breaks (=\\r\\n and =\\n)', () => {
    expect(decodeQuotedPrintable('abc=\r\ndef')).toBe('abcdef');
    expect(decodeQuotedPrintable('abc=\ndef')).toBe('abcdef');
  });

  it('passes through plain ASCII unchanged', () => {
    expect(decodeQuotedPrintable('Hello world')).toBe('Hello world');
  });

  it('honors an explicit non-UTF-8 charset', () => {
    // 0xE9 is é in latin1/iso-8859-1
    expect(decodeQuotedPrintable('caf=E9', 'iso-8859-1')).toBe('café');
  });
});

describe('decodeRfc2047', () => {
  it('decodes a UTF-8 Base64 (B) encoded-word', () => {
    // "café" -> base64 of UTF-8 bytes 63 61 66 C3 A9
    expect(decodeRfc2047('=?UTF-8?B?Y2Fmw6k=?=')).toBe('café');
  });

  it('decodes a UTF-8 Q encoded-word with underscore-as-space', () => {
    expect(decodeRfc2047('=?UTF-8?Q?Hi_caf=C3=A9?=')).toBe('Hi café');
  });

  it('leaves plain text untouched', () => {
    expect(decodeRfc2047('Just a subject')).toBe('Just a subject');
  });

  it('decodes multiple adjacent encoded-words', () => {
    expect(decodeRfc2047('=?UTF-8?B?Y2Fm?==?UTF-8?B?w6k=?=')).toBe('café');
  });

  it('falls back to the raw text on undecodable input', () => {
    expect(decodeRfc2047('=?UTF-8?B?@@@bad@@@?=')).toBe('@@@bad@@@');
  });
});

describe('isMboxFromLine', () => {
  it('matches a real mbox envelope From line', () => {
    expect(isMboxFromLine('From sender@example.com Mon Jan 01 00:00:00 2024')).toBe(true);
  });

  it('matches all weekday abbreviations', () => {
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(isMboxFromLine(`From a@b.com ${day} Feb 02 12:00:00 2024`)).toBe(true);
    }
  });

  it('does NOT match a body sentence beginning with "From "', () => {
    expect(isMboxFromLine('From Wednesday onward we will be closed')).toBe(false);
  });

  it('does NOT match a quoted >From body line', () => {
    expect(isMboxFromLine('>From sender@example.com Mon Jan 01 00:00:00 2024')).toBe(false);
  });

  it('does NOT match a line missing the weekday/month shape', () => {
    expect(isMboxFromLine('From sender@example.com is my address')).toBe(false);
  });
});

describe('makeSnippet', () => {
  it('strips HTML tags and collapses whitespace', () => {
    expect(makeSnippet('<p>Hello   <b>world</b></p>')).toBe('Hello world');
  });

  it('drops <style> and <script> contents', () => {
    expect(makeSnippet('<style>.x{color:red}</style><p>Hi</p>')).toBe('Hi');
  });

  it('decodes common HTML entities', () => {
    expect(makeSnippet('Tom &amp; Jerry &lt;3')).toBe('Tom & Jerry <3');
  });

  it('truncates to maxLen and adds an ellipsis', () => {
    const out = makeSnippet('a'.repeat(50), 10);
    expect(out).toBe('aaaaaaaaaa…');
    expect(out.length).toBe(11); // 10 chars + ellipsis
  });

  it('defaults to a 200-char limit', () => {
    const out = makeSnippet('b'.repeat(500));
    expect(out.length).toBe(201); // 200 + ellipsis
  });

  it('does not add an ellipsis when within the limit', () => {
    expect(makeSnippet('short')).toBe('short');
  });

  it('returns empty string for empty input', () => {
    expect(makeSnippet('')).toBe('');
  });
});
