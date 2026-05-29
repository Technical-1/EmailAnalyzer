import { describe, it, expect } from 'vitest';
import { encryptionService } from '../../services/encryptionService';
import { WORDLIST } from '../../utils/wordlist';

describe('generatePassphrase', () => {
  it('exposes a large wordlist for adequate entropy', () => {
    // >= 1024 words => >= 10 bits per word. 6 words => >= 60 bits.
    expect(WORDLIST.length).toBeGreaterThanOrEqual(1024);
    // No duplicates in the list (duplicates would reduce real entropy).
    expect(new Set(WORDLIST).size).toBe(WORDLIST.length);
  });

  it('generates the requested number of words', () => {
    expect(encryptionService.generatePassphrase(4).split('-')).toHaveLength(4);
    expect(encryptionService.generatePassphrase(6).split('-')).toHaveLength(6);
  });

  it('only uses words from the wordlist', () => {
    const set = new Set(WORDLIST);
    for (let i = 0; i < 50; i++) {
      for (const word of encryptionService.generatePassphrase(6).split('-')) {
        expect(set.has(word)).toBe(true);
      }
    }
  });

  it('generates different passphrases each time', () => {
    const a = encryptionService.generatePassphrase();
    const b = encryptionService.generatePassphrase();
    expect(a).not.toBe(b);
  });

  it('samples a wide spread of distinct words (no collapse/obvious bias)', () => {
    const seen = new Set<string>();
    // 2000 words drawn from a >=1024 list should reveal many distinct values.
    for (let i = 0; i < 500; i++) {
      for (const word of encryptionService.generatePassphrase(4).split('-')) {
        seen.add(word);
      }
    }
    // Expect to have touched a large fraction of the list, not a tiny clump.
    expect(seen.size).toBeGreaterThan(500);
  });
});
