# Bucket F: Storage & Crypto Safety

## Goal

Make the base64 conversion path safe for large blobs (no `RangeError` stack overflow) and strengthen the auto-generated passphrase (larger wordlist + unbiased random index selection). The AES-GCM primitives themselves are already sound — fresh random IV per `encrypt`, PBKDF2 100k/SHA-256, random salt — and **must not change**.

Two concrete defects to fix:

1. **(MEDIUM) Stack overflow on large blobs.** `web/src/services/encryptionService.ts:270` `arrayToBase64` does `btoa(String.fromCharCode(...array))`, spreading every byte as a function argument. For large inputs (and `encryptBlob` at `:218-222` feeds whole blobs through this) this throws `RangeError: Maximum call stack size exceeded`. The same pattern is duplicated in `web/src/services/attachmentService.ts:57-65` (`createBlob` does a per-char `atob` loop — the decode side — but the encode duplication and the shared concept live here too). Fix by converting in fixed-size chunks (`0x8000` bytes) and extracting a shared, dependency-free helper used by both files (DRY). `base64ToArray` must stay symmetric so round-trips are exact.

2. **(LOW) Weak generated passphrase.** `generatePassphrase` at `:283-301` picks 4 words from a 30-word list (~19.6 bits total) and uses `array[i] % words.length`. Because 30 does not divide 2^32, this introduces modulo bias. This passphrase derives the AES key. Fix: replace the 30-word list with a much larger bundled EFF-style wordlist (dependency-free, embedded in-repo) and use **rejection sampling** to pick an unbiased index. Keep the default word count but ensure entropy is adequate (a ~1296-word list at 4 words ≈ 41 bits; default raised to 6 words ≈ 62 bits is recommended — see step notes).

## Architecture

- `web/src/services/encryptionService.ts` — singleton `EncryptionService`. Holds `cryptoKey` + `salt` in memory. Public API: `encrypt`, `decrypt`, `encryptBlob`, `decryptBlob`, `generatePassphrase`, etc. Private helpers `arrayToBase64` / `base64ToArray` at `:269-278` are the hot path being fixed.
- `web/src/services/attachmentService.ts` — singleton `AttachmentService`. `createBlob` at `:57-65` decodes base64 → `Uint8Array`. Shares the base64 concern.
- **New shared module:** `web/src/utils/base64.ts` — two pure functions `uint8ArrayToBase64(array: Uint8Array): string` and `base64ToUint8Array(base64: string): Uint8Array`, chunked and symmetric. Both services import from here. (`web/src/utils/` already holds `emailUtils.ts`, `logger.ts`.)
- **New wordlist module:** `web/src/utils/wordlist.ts` — exports `WORDLIST: readonly string[]` (a compact ~1296-word EFF-style list). Kept separate so the service file stays readable and the list is reusable/testable.
- Tests live in `web/src/__tests__/phase-9/` (new directory; existing phases are 1,2,3,7,8). Style mirrors `web/src/__tests__/phase-7/encryptionService.test.ts` (Vitest, `describe/it/expect`, `localStorage.removeItem` cleanup, `encryptionService.lock()`).

## Tech Stack

- Vite + React + TypeScript (browser app)
- Vitest 4 + jsdom + `fake-indexeddb` + localStorage mock
- Web Crypto (`crypto.subtle`, `crypto.getRandomValues`) available via Node/jsdom
- Run from `web/`: `npm run test:run`, `npm run lint`, `npm run build`

**For agentic workers:** Execute this plan using `superpowers:subagent-driven-development`. Each task is bite-sized and test-first (strict TDD: write the failing test, watch it fail, then make it pass). Do not batch tasks. Commit after each green+lint step with normal `git commit` (no `--no-verify`, no author env vars; confirm `git config user.email` is an allowlisted value first).

## File Structure

```
web/src/
├── utils/
│   ├── base64.ts          # NEW — chunked uint8ArrayToBase64 / base64ToUint8Array
│   ├── wordlist.ts        # NEW — WORDLIST: readonly string[] (~1296 words)
│   ├── emailUtils.ts      # existing (untouched)
│   └── logger.ts          # existing (untouched)
├── services/
│   ├── encryptionService.ts   # EDIT — use base64 helper; rewrite generatePassphrase
│   └── attachmentService.ts   # EDIT — use base64 helper in createBlob
└── __tests__/
    └── phase-9/               # NEW directory
        ├── base64.test.ts                 # NEW — chunked round-trip incl. large arrays
        ├── encryptionService.blob.test.ts # NEW — large blob encrypt/decrypt round-trip
        └── generatePassphrase.test.ts     # NEW — wordlist membership + entropy/no-bias
```

---

## Tasks

### Task 1 — Failing test: large `Uint8Array` round-trips through the base64 helper

Create the test directory and the first test. This test imports a module that does not exist yet, so it will fail to resolve (expected red).

- [ ] Create directory `web/src/__tests__/phase-9/`.
- [ ] Create `web/src/__tests__/phase-9/base64.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest';
import { uint8ArrayToBase64, base64ToUint8Array } from '../../utils/base64';

describe('base64 helpers', () => {
  it('round-trips a small array exactly', () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 127, 128]);
    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('produces base64 compatible with native atob', () => {
    const original = new Uint8Array([72, 105]); // "Hi"
    const b64 = uint8ArrayToBase64(original);
    expect(atob(b64)).toBe('Hi');
  });

  it('round-trips an empty array', () => {
    const original = new Uint8Array([]);
    const b64 = uint8ArrayToBase64(original);
    expect(b64).toBe('');
    expect(base64ToUint8Array(b64).length).toBe(0);
  });

  it('round-trips a large (1.5MB) array without throwing RangeError', () => {
    const size = 1_500_000;
    const original = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      original[i] = i % 256;
    }

    let b64 = '';
    expect(() => {
      b64 = uint8ArrayToBase64(original);
    }).not.toThrow();

    const decoded = base64ToUint8Array(b64);
    expect(decoded.length).toBe(size);
    // Spot-check boundaries and a few interior points rather than full array equality
    expect(decoded[0]).toBe(original[0]);
    expect(decoded[size - 1]).toBe(original[size - 1]);
    expect(decoded[0x8000]).toBe(original[0x8000]); // chunk boundary
    expect(decoded[0x8000 + 1]).toBe(original[0x8000 + 1]);
    expect(decoded[size >> 1]).toBe(original[size >> 1]);
  });

  it('round-trips array lengths that are not multiples of 3 (padding)', () => {
    for (const len of [1, 2, 4, 5, 100, 0x8000 + 1, 0x8000 + 2]) {
      const original = new Uint8Array(len);
      for (let i = 0; i < len; i++) original[i] = (i * 31 + 7) % 256;
      const decoded = base64ToUint8Array(uint8ArrayToBase64(original));
      expect(Array.from(decoded)).toEqual(Array.from(original));
    }
  });
});
```

- [ ] Run `cd web && npm run test:run -- phase-9/base64.test.ts`. Confirm it **fails** (module `../../utils/base64` cannot be resolved). This is the expected red state.

### Task 2 — Implement the chunked base64 helper (make Task 1 green)

- [ ] Create `web/src/utils/base64.ts` with this exact content:

```ts
/**
 * Base64 <-> Uint8Array conversion helpers.
 *
 * Converts in fixed-size chunks instead of spreading the whole array into
 * String.fromCharCode(...array), which throws
 * "RangeError: Maximum call stack size exceeded" on large blobs.
 */

// 0x8000 = 32768 bytes per chunk. Comfortably below the arg-count limit of
// String.fromCharCode on every engine while keeping the loop count low.
const CHUNK_SIZE = 0x8000;

/**
 * Convert a Uint8Array to a base64 string.
 * Safe for arbitrarily large arrays.
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i += CHUNK_SIZE) {
    const chunk = array.subarray(i, i + CHUNK_SIZE);
    // String.fromCharCode.apply lets us pass the chunk as an arg list without
    // spreading a potentially huge array. The chunk is bounded by CHUNK_SIZE.
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 * Symmetric with uint8ArrayToBase64.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const length = binary.length;
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}
```

- [ ] Run `cd web && npm run test:run -- phase-9/base64.test.ts`. Confirm **all green**.
- [ ] Run `cd web && npm run lint`. Confirm no new errors in `base64.ts`.

### Task 3 — Route `encryptionService` through the shared helper

Refactor the service to delegate to `web/src/utils/base64.ts`, removing the unsafe spread at `:270`. The existing phase-7 tests are the regression guard.

- [ ] In `web/src/services/encryptionService.ts`, add an import at the top of the file (after the file header comment block, alongside other top-level declarations — there are currently no imports, so add it directly under the closing `*/` of the header):

```ts
import { uint8ArrayToBase64, base64ToUint8Array } from '../utils/base64';
```

- [ ] Replace the two private helpers (currently `:266-278`):

```ts
  /**
   * Helper: Convert Uint8Array to Base64
   */
  private arrayToBase64(array: Uint8Array): string {
    return btoa(String.fromCharCode(...array));
  }

  /**
   * Helper: Convert Base64 to Uint8Array
   */
  private base64ToArray(base64: string): Uint8Array {
    return new Uint8Array(atob(base64).split('').map(c => c.charCodeAt(0)));
  }
```

with thin delegators (keeps all existing call sites — `encrypt`, `decrypt`, `encryptBlob`, `decryptBlob`, `initialize` — unchanged):

```ts
  /**
   * Helper: Convert Uint8Array to Base64 (chunked; safe for large blobs)
   */
  private arrayToBase64(array: Uint8Array): string {
    return uint8ArrayToBase64(array);
  }

  /**
   * Helper: Convert Base64 to Uint8Array
   */
  private base64ToArray(base64: string): Uint8Array {
    return base64ToUint8Array(base64);
  }
```

- [ ] Run `cd web && npm run test:run -- phase-7/encryptionService.test.ts`. Confirm **all still green** (no behavior change for small inputs).
- [ ] Run `cd web && npm run lint`. Confirm clean.

### Task 4 — Failing test: large blob encrypt/decrypt round-trip

This proves `encryptBlob`/`decryptBlob` survive a large payload end-to-end (before Task 3 this would have thrown inside `arrayToBase64`; after Task 3 it must pass — write it now as a guard and to exercise the full path).

- [ ] Create `web/src/__tests__/phase-9/encryptionService.blob.test.ts` with this exact content:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService } from '../../services/encryptionService';

describe('EncryptionService large blob round-trip', () => {
  const testPassphrase = 'test-passphrase-123';

  beforeEach(async () => {
    localStorage.removeItem('encryption_salt');
    localStorage.removeItem('encryption_verification');
    encryptionService.lock();
    await encryptionService.setupEncryption(testPassphrase);
  });

  afterEach(() => {
    encryptionService.lock();
  });

  it('encrypts and decrypts a large (1MB) blob without throwing', async () => {
    const size = 1_000_000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = (i * 17 + 3) % 256;
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });

    const encrypted = await encryptionService.encryptBlob(blob);
    const decryptedBlob = await encryptionService.decryptBlob(
      encrypted,
      'application/octet-stream'
    );

    expect(decryptedBlob.type).toBe('application/octet-stream');
    expect(decryptedBlob.size).toBe(size);

    const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(decryptedBytes.length).toBe(size);
    expect(decryptedBytes[0]).toBe(bytes[0]);
    expect(decryptedBytes[size - 1]).toBe(bytes[size - 1]);
    expect(decryptedBytes[size >> 1]).toBe(bytes[size >> 1]);
  });

  it('produces a different ciphertext than plaintext for a small blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'text/plain' });
    const encrypted = await encryptionService.encryptBlob(blob);
    expect(typeof encrypted.ciphertext).toBe('string');
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);

    const out = await encryptionService.decryptBlob(encrypted, 'text/plain');
    const outBytes = new Uint8Array(await out.arrayBuffer());
    expect(Array.from(outBytes)).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] Run `cd web && npm run test:run -- phase-9/encryptionService.blob.test.ts`. Confirm **green** (Task 3 already made the path safe). If it fails, debug per `superpowers:systematic-debugging` before proceeding.

### Task 5 — Route `attachmentService.createBlob` through the shared helper (DRY)

`createBlob` at `:57-65` re-implements the decode-side loop. Replace it with the shared helper so both files share one implementation.

- [ ] In `web/src/services/attachmentService.ts`, add to the imports at the top (currently lines 1-2 import `Attachment` and `logger`):

```ts
import { base64ToUint8Array } from '../utils/base64';
```

- [ ] Replace `createBlob` (currently `:54-65`):

```ts
  /**
   * Create a blob from base64 data
   */
  createBlob(data: string, mimeType: string): Blob {
    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }
```

with:

```ts
  /**
   * Create a blob from base64 data
   */
  createBlob(data: string, mimeType: string): Blob {
    const byteArray = base64ToUint8Array(data);
    return new Blob([byteArray as unknown as BlobPart], { type: mimeType });
  }
```

> Note on the cast: `BlobPart` accepts `Uint8Array` at runtime; the `as unknown as BlobPart` is only needed if the TS lib target flags it. If `npm run build` accepts `new Blob([byteArray], ...)` without the cast, drop the cast to keep it clean. Verify in the build step below.

- [ ] Run `cd web && npm run test:run`. Confirm the full suite is green (attachmentService is exercised by existing tests; downloads etc. still go through `createBlob`).
- [ ] Run `cd web && npm run lint`. Confirm clean.

### Task 6 — Failing test: stronger `generatePassphrase` (wordlist membership + entropy, no modulo bias)

This test asserts (a) words come only from the exported wordlist, (b) the list is large enough for adequate entropy, and (c) over many samples the selected indices span a wide range (a smoke test that selection is not collapsing/biased). It imports `WORDLIST`, which does not exist yet → red.

- [ ] Create `web/src/__tests__/phase-9/generatePassphrase.test.ts` with this exact content:

```ts
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
```

- [ ] Run `cd web && npm run test:run -- phase-9/generatePassphrase.test.ts`. Confirm it **fails** (`../../utils/wordlist` unresolved). Expected red.

### Task 7 — Add the bundled wordlist module

Create a dependency-free EFF-style wordlist of at least 1296 short words. Below is a generator-free, fully literal approach: build the list deterministically from a compact set of syllables at module load so the file stays small but yields a large, duplicate-free list. (This avoids pasting 1296 literal words while remaining dependency-free and reproducible.)

- [ ] Create `web/src/utils/wordlist.ts` with this exact content:

```ts
/**
 * Dependency-free passphrase wordlist.
 *
 * Generated deterministically at module load from short consonant/vowel
 * syllable fragments to produce >= 1296 unique, pronounceable, lowercase
 * words. This gives >= ~10.3 bits of entropy per word without bundling a
 * large external file or adding a dependency.
 *
 * The list is frozen and stable across runs (no randomness here).
 */

const ONSETS = [
  'b', 'br', 'c', 'cl', 'cr', 'd', 'dr', 'f', 'fl', 'fr', 'g', 'gl', 'gr',
  'h', 'j', 'k', 'l', 'm', 'n', 'p', 'pl', 'pr', 'r', 's', 'sk', 'sl', 'sn',
  'sp', 'st', 'sw', 't', 'tr', 'v', 'w', 'z',
];

const NUCLEI = ['a', 'e', 'i', 'o', 'u'];

const CODAS = ['b', 'ck', 'd', 'ft', 'g', 'ld', 'll', 'm', 'n', 'nd', 'ng', 'nt', 'p', 'r', 'sh', 'sk', 'st', 't', 'x', 'z'];

function buildWordlist(): string[] {
  const words: string[] = [];
  const seen = new Set<string>();
  for (const onset of ONSETS) {
    for (const nucleus of NUCLEI) {
      for (const coda of CODAS) {
        const word = onset + nucleus + coda;
        if (!seen.has(word)) {
          seen.add(word);
          words.push(word);
        }
      }
    }
  }
  return words;
}

// 36 onsets * 5 nuclei * 20 codas = 3600 candidate words (all unique here).
export const WORDLIST: readonly string[] = Object.freeze(buildWordlist());
```

> The combinatorial space is 36×5×20 = 3600 unique words (≈ 11.8 bits/word). Comfortably above the test's 1024 floor. If a future maintainer prefers a real EFF wordlist, they can replace `buildWordlist()` with a literal frozen array of the 1296-word EFF short list — the rest of the code is agnostic.

- [ ] Run `cd web && npm run test:run -- phase-9/generatePassphrase.test.ts`. The wordlist-shape assertions now resolve, but `generatePassphrase` still uses the old 30-word inline list, so the "only uses words from the wordlist" and spread assertions **fail**. Expected partial red — proceed to Task 8.

### Task 8 — Rewrite `generatePassphrase` to use the wordlist + rejection sampling

Remove the inline 30-word array and the biased `% words.length`. Use `WORDLIST` and an unbiased index via rejection sampling. Raise the default word count to 6 for adequate entropy.

- [ ] In `web/src/services/encryptionService.ts`, add to the imports (next to the base64 import added in Task 3):

```ts
import { WORDLIST } from '../utils/wordlist';
```

- [ ] Replace the entire `generatePassphrase` method (currently `:280-301`):

```ts
  /**
   * Generate a strong passphrase
   */
  generatePassphrase(wordCount: number = 4): string {
    const words = [
      'apple', 'banana', 'cherry', 'dragon', 'eagle', 'forest',
      'garden', 'harbor', 'island', 'jungle', 'kernel', 'lemon',
      'mountain', 'nebula', 'ocean', 'planet', 'quartz', 'river',
      'sunset', 'thunder', 'urban', 'valley', 'winter', 'xenon',
      'yellow', 'zenith', 'anchor', 'beacon', 'castle', 'diamond',
    ];

    const randomWords: string[] = [];
    const array = new Uint32Array(wordCount);
    crypto.getRandomValues(array);

    for (let i = 0; i < wordCount; i++) {
      randomWords.push(words[array[i] % words.length]);
    }

    return randomWords.join('-');
  }
```

with:

```ts
  /**
   * Return an unbiased random integer in [0, max) using rejection sampling
   * over crypto.getRandomValues. Avoids the modulo bias of (rand % max).
   */
  private randomIndex(max: number): number {
    // Largest multiple of `max` that fits in a Uint32, used as the rejection
    // threshold. Any draw at or above this is discarded and retried.
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let value: number;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  /**
   * Generate a strong passphrase from the bundled wordlist.
   * Default of 6 words from a 1024+ word list yields >= ~60 bits of entropy.
   */
  generatePassphrase(wordCount: number = 6): string {
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      words.push(WORDLIST[this.randomIndex(WORDLIST.length)]);
    }
    return words.join('-');
  }
```

> The default changed from 4 to 6. The phase-7 test only calls `generatePassphrase(4)` and `generatePassphrase()` (asserting difference, not a fixed length for the no-arg call), so this remains compatible. If any caller in the app relied on a 4-word default, it still works — they pass no arg and get a stronger 6-word phrase. Verify no caller asserts a 4-word length: search `generatePassphrase(` usages before finalizing.

- [ ] Search for callers: `cd web && npm run test:run` after the edit, and additionally confirm no production caller hard-codes a 4-word expectation (grep `generatePassphrase` across `web/src`). If a UI caller needs exactly 4, pass `4` explicitly at that call site rather than reverting the default.
- [ ] Run `cd web && npm run test:run -- phase-9/generatePassphrase.test.ts`. Confirm **all green**.
- [ ] Run `cd web && npm run test:run -- phase-7/encryptionService.test.ts`. Confirm the existing passphrase tests still pass.

### Task 9 — Full verification & commit

- [ ] From `web/`: run the full gate:

```bash
npm run test:run && npm run lint && npm run build
```

- [ ] Confirm: full test suite green (phase-1/2/3/7/8 plus new phase-9), zero new lint errors, build succeeds. If the `BlobPart` cast in Task 5 was unnecessary, the build will pass without it — prefer the un-cast form and re-run if you removed it.
- [ ] Confirm `git config user.email` returns an allowlisted address (`51518860+Technical-1@users.noreply.github.com` or `jacobrk2001@gmail.com`). Fix with `git config user.email <allowed>` if not — never `--no-verify`, never author env vars.
- [ ] Stage and commit with a normal commit. Suggested message:

```
fix(crypto): chunk base64 for large blobs and strengthen generated passphrase

- Extract shared chunked base64 helper (web/src/utils/base64.ts); fixes
  RangeError: Maximum call stack size exceeded on large blob encryption
- Route encryptionService and attachmentService through the shared helper (DRY)
- Replace 30-word passphrase list + modulo-biased index with a 1024+ word
  bundled list and rejection-sampled unbiased index; default 6 words
- Add phase-9 tests: large base64 round-trip, large blob encrypt/decrypt,
  passphrase wordlist membership + entropy/no-bias

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

---

## Out of scope (do not touch)

- AES-GCM parameters: algorithm, key length (256), IV length (12, fresh per encrypt at `:164`), PBKDF2 iterations (100000), SHA-256, random salt generation. These are sound.
- The verification-token / salt-storage flow in `initialize` / `setupEncryption` / `verifyPassphrase`.
- `attachmentService` download/zip logic beyond `createBlob`.
