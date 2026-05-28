import { describe, it, expect } from 'vitest';
import {
  MAX_SUBJECT_LEN,
  MAX_BODY_LEN,
  MAX_EMAIL_LEN,
  MAX_COMPRESSED_BYTES,
  MAX_DECOMPRESSED_BYTES,
} from '../../services/mimeUtils';

describe('mimeUtils size constants', () => {
  it('matches the values ported from olmParser', () => {
    expect(MAX_SUBJECT_LEN).toBe(1000);
    expect(MAX_BODY_LEN).toBe(10 * 1024 * 1024);
    expect(MAX_EMAIL_LEN).toBe(254);
    expect(MAX_COMPRESSED_BYTES).toBe(500 * 1024 * 1024);
    expect(MAX_DECOMPRESSED_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });
});
