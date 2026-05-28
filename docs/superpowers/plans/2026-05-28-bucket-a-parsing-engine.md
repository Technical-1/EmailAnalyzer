# Bucket A — Email Parsing Engine (extract → test → fix)

**Goal:** Make the LIVE worker parser (`web/src/workers/parserWorker.ts`) correct and unit-testable by extracting its pure, DOM-free helpers into a new module `web/src/services/mimeUtils.ts`, then fixing four real bugs in that single source under strict TDD. Web Workers cannot be executed in jsdom, so the worker keeps its DOM/JSZip orchestration and imports the now-tested pure helpers.

**Architecture:** The worker is the only live parse path — `HomePage.tsx:428-436` routes every `.olm` / Gmail-Takeout `.zip` / `.mbox`/`.mbx` file to `processWithWorker(...)`, which spawns `parserWorker.ts`. The service classes `olmParser.ts` and `mboxParser.ts` are dead duplicates (no non-test importer; confirmed via grep — only `gmailTakeoutParser.ts` imports `mboxParser`, and `gmailTakeoutParser` itself is imported by `HomePage` ONLY for `.isGmailTakeout(file)` file-type detection, never for parsing). After extraction we point the worker at `mimeUtils.ts` and re-export the shared helpers from the dead parsers so nothing breaks while keeping one source of truth.

**Tech Stack:** Vite + React + TypeScript; Vitest 4 + jsdom + @testing-library/react + `fake-indexeddb/auto`; `File`/`Blob`.text() polyfilled in `web/src/__tests__/setup.ts`. Tests live in `web/src/__tests__/phase-N/`. From the `web` dir: run tests `npm run test:run` (or `npx vitest run <path>`), lint `npm run lint`, build `npm run build`. `atob` and `TextDecoder` are available in jsdom and in workers.

> **For agentic workers:** Execute this plan with **superpowers:subagent-driven-development**. Each task is test-first and independently committable. Do strict TDD per task: write the failing test → run it and confirm the EXACT expected failure → write the minimal implementation → run and confirm green → `npm run lint` → commit. Do not skip the "confirm failure" step. Do not batch multiple tasks into one commit.

---

## Git author note

Commits in this repo must use an allowlisted author. Do **not** set `GIT_AUTHOR_*` env vars and do **not** use `--no-verify`. Before the first commit, confirm `git config user.email` returns an allowlisted value (the executing engineer handles this). Write normal `git commit -m "..."` steps only.

---

## File Structure

### Created
- **`web/src/services/mimeUtils.ts`** — Pure, DOM-free MIME/MBOX utilities. The single source of truth for decoding and size limits. Exports:
  - Constants (exact values ported from `olmParser.ts`): `MAX_SUBJECT_LEN` (`1000`), `MAX_BODY_LEN` (`10 * 1024 * 1024`), `MAX_EMAIL_LEN` (`254`), `MAX_COMPRESSED_BYTES` (`500 * 1024 * 1024`), `MAX_DECOMPRESSED_BYTES` (`2 * 1024 * 1024 * 1024`).
  - `decodeQuotedPrintable(input: string, charset?: string): string` — UTF-8-correct QP decode via byte buffer + `TextDecoder`.
  - `decodeRfc2047(value: string): string` — charset-aware `=?charset?B/Q?...?=` decode.
  - `isMboxFromLine(line: string): boolean` — strict `From ` envelope-line matcher.
  - `makeSnippet(htmlOrText: string, maxLen?: number): string` — strip HTML tags, collapse whitespace, truncate with ellipsis (default `maxLen` 200).
- **`web/src/__tests__/phase-9/mimeUtils.test.ts`** — Unit tests for every export above.

### Modified
- **`web/src/workers/parserWorker.ts`** — Replace local `decodeQuotedPrintable` (lines 40-46), `decodeHeaderValue` (48-63), `decodeBase64` (65-80), `isFromLine` (170-174) bodies and the size/field-limit gaps in `parseEmailFromLines` (354-484), `parseOLMEmailXML` (597-690), `parseOLMFile` (800), `parseGmailTakeoutFile` (938) by importing from `mimeUtils.ts`. Populate `Email.snippet` at parse time via `makeSnippet`.
- **`web/src/types/index.ts`** — Add `snippet?: string` to the `Email` interface (after line 17 `threadId?`). NOT a Dexie index → no `database.ts` version bump.
- **`web/src/services/olmParser.ts`** & **`web/src/services/mboxParser.ts`** — Dead-code decision task: re-export the shared helpers from `mimeUtils.ts` so there is one source of truth (keeps the existing test suites green without duplicated logic).

---

## Tasks

### Task 1 — Add `snippet?` to the Email type (type-only, no test)

- [ ] Read `web/src/types/index.ts` lines 2-23 to confirm the current `Email` interface.
- [ ] Edit `web/src/types/index.ts`: insert `snippet?: string;` immediately after the `threadId?: string;` line (line 17). Resulting region:
  ```ts
    folderId: string;
    threadId?: string;
    snippet?: string;
    originalOlmId?: string;
  ```
- [ ] From `web`, run `npm run build` and confirm it passes (type-only change must not break compilation).
- [ ] Commit: `git commit -m "feat(types): add optional Email.snippet field"`

---

### Task 2 — Create `mimeUtils.ts` skeleton with ported size constants (test-first)

- [ ] Create `web/src/__tests__/phase-9/mimeUtils.test.ts` with the constants test:
  ```ts
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
  ```
- [ ] From `web`, run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm it FAILS to resolve the import (`Failed to resolve import "../../services/mimeUtils"` / module not found).
- [ ] Create `web/src/services/mimeUtils.ts` with ONLY the constants:
  ```ts
  /**
   * Pure, DOM-free MIME / MBOX parsing utilities.
   * Single source of truth shared by the parser worker and (re-exported) the
   * legacy service parsers. No DOM, no JSZip, no Dexie imports here.
   */

  // Field/size limits (exact values ported from olmParser.ts)
  export const MAX_SUBJECT_LEN = 1000;
  export const MAX_BODY_LEN = 10 * 1024 * 1024; // 10MB
  export const MAX_EMAIL_LEN = 254; // RFC 5321
  export const MAX_COMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB compressed
  export const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024; // 2GB decompressed (zip-bomb guard)
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm it PASSES.
- [ ] From `web`, run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "feat(mimeUtils): add module with ported size constants"`

---

### Task 3 — `decodeQuotedPrintable` UTF-8-correct (FIX #1, parserWorker.ts:40-46)

The live worker version maps each `=XX` through `String.fromCharCode`, so a multi-byte UTF-8 sequence like `=C3=A9` becomes two garbage code points instead of `é`. Fix: accumulate raw bytes into a `Uint8Array`, then `TextDecoder(charset)` the whole run.

- [ ] Add to `web/src/__tests__/phase-9/mimeUtils.test.ts`:
  ```ts
  import { decodeQuotedPrintable } from '../../services/mimeUtils';

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
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm the new `decodeQuotedPrintable` block FAILS on the import / undefined export.
- [ ] Add to `web/src/services/mimeUtils.ts`:
  ```ts
  /**
   * RFC 2045 quoted-printable decoder that preserves multi-byte UTF-8.
   * Collects raw bytes (literal chars + =XX escapes) then decodes once via
   * TextDecoder so sequences like =C3=A9 -> "é" survive intact.
   */
  export function decodeQuotedPrintable(input: string, charset = 'utf-8'): string {
    // Drop soft line breaks first.
    const text = input.replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '=' && i + 2 < text.length) {
        const hex = text.substr(i + 1, 2);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      // Literal character: push its code units as UTF-8 bytes.
      const code = ch.charCodeAt(0);
      if (code < 0x80) {
        bytes.push(code);
      } else {
        const enc = new TextEncoder().encode(ch);
        for (const b of enc) bytes.push(b);
      }
    }
    try {
      return new TextDecoder(normalizeCharset(charset)).decode(new Uint8Array(bytes));
    } catch {
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    }
  }

  /** Map common MIME charset aliases to labels TextDecoder accepts. */
  function normalizeCharset(charset: string): string {
    const c = charset.trim().toLowerCase();
    if (c === 'utf8') return 'utf-8';
    if (c === 'latin1' || c === 'iso8859-1') return 'iso-8859-1';
    return c || 'utf-8';
  }
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm all `decodeQuotedPrintable` cases PASS.
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "fix(mimeUtils): UTF-8-correct quoted-printable decode (#1)"`

---

### Task 4 — `decodeRfc2047` charset-aware (FIX #2, parserWorker.ts:48-63)

The live `decodeHeaderValue` 'B' branch does raw `atob(text)` ignoring charset → mojibake and throws on non-Latin1. Fix: 'B' decodes base64 → bytes → `TextDecoder(charset)`; 'Q' routes to the now-charset-aware `decodeQuotedPrintable` (with `_` → space per RFC 2047).

- [ ] Add to `web/src/__tests__/phase-9/mimeUtils.test.ts`:
  ```ts
  import { decodeRfc2047 } from '../../services/mimeUtils';

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
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm the `decodeRfc2047` block FAILS (undefined export).
- [ ] Add to `web/src/services/mimeUtils.ts`:
  ```ts
  /**
   * RFC 2047 encoded-word decoder: =?charset?B|Q?text?=.
   * 'B' = base64 -> bytes -> TextDecoder(charset); 'Q' = quoted-printable
   * (charset-aware, underscores become spaces). Falls back to raw text.
   */
  export function decodeRfc2047(value: string): string {
    return value.replace(
      /=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi,
      (_match, charset: string, encoding: string, text: string) => {
        try {
          if (encoding.toUpperCase() === 'B') {
            const binary = atob(text);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return new TextDecoder(normalizeCharset(charset)).decode(bytes);
          }
          // 'Q' branch — quoted-printable with RFC 2047 underscore-as-space.
          return decodeQuotedPrintable(text.replace(/_/g, ' '), charset);
        } catch {
          return text;
        }
      }
    );
  }
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm all `decodeRfc2047` cases PASS.
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "fix(mimeUtils): charset-aware RFC 2047 header decode (#2)"`

---

### Task 5 — `isMboxFromLine` strict matcher (FIX #3, parserWorker.ts:170-174)

The live `isFromLine` returns true for any line starting `From ` that contains a weekday substring anywhere, so a body line like `From Wednesday onward` falsely splits an email. Fix: require the `From <addr> <Day> <Mon> ` envelope shape, and treat `>From `-escaped body lines as NOT envelope lines.

- [ ] Add to `web/src/__tests__/phase-9/mimeUtils.test.ts`:
  ```ts
  import { isMboxFromLine } from '../../services/mimeUtils';

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
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm the `isMboxFromLine` block FAILS (undefined export).
- [ ] Add to `web/src/services/mimeUtils.ts`:
  ```ts
  /**
   * Strict mbox "From " envelope-line matcher. Requires the canonical
   *   From <addr> <Day> <Mon> ...
   * shape so prose like "From Wednesday onward" does not split messages.
   * Quoted ">From " body lines are NOT envelope lines.
   */
  const MBOX_FROM_RE = /^From \S+ (Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} /;
  export function isMboxFromLine(line: string): boolean {
    if (line.startsWith('>')) return false;
    return MBOX_FROM_RE.test(line);
  }
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm all `isMboxFromLine` cases PASS.
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "fix(mimeUtils): strict mbox From-line matcher (#3)"`

---

### Task 6 — `makeSnippet` (new helper for `Email.snippet`)

- [ ] Add to `web/src/__tests__/phase-9/mimeUtils.test.ts`:
  ```ts
  import { makeSnippet } from '../../services/mimeUtils';

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
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm the `makeSnippet` block FAILS (undefined export).
- [ ] Add to `web/src/services/mimeUtils.ts`:
  ```ts
  /**
   * Build a short plain-text snippet from HTML or text: strip script/style and
   * tags, decode common entities, collapse whitespace, truncate with ellipsis.
   */
  export function makeSnippet(htmlOrText: string, maxLen = 200): string {
    if (!htmlOrText) return '';
    const text = htmlOrText
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
  ```
- [ ] Run `npx vitest run src/__tests__/phase-9/mimeUtils.test.ts`. Confirm all `makeSnippet` cases PASS.
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "feat(mimeUtils): add makeSnippet helper"`

---

### Task 7 — Point the worker at `mimeUtils` for decoding + From-line matching

Replace the worker's local decode/match implementations with imports. Keep `decodeBase64` and `stripHtml` local for now (used by body parsing) — `decodeBase64` already uses TextDecoder correctly. There is no DOM/jsdom test for the worker; verification is `npm run build` + the existing mbox/olm service tests staying green (they use the legacy parsers, but Task 10 re-points those at `mimeUtils`, so run the full suite after Task 10 too).

- [ ] In `web/src/workers/parserWorker.ts`, add an import near the top (after line 14):
  ```ts
  import {
    decodeQuotedPrintable,
    decodeRfc2047,
    isMboxFromLine,
    makeSnippet,
    MAX_SUBJECT_LEN,
    MAX_BODY_LEN,
    MAX_EMAIL_LEN,
    MAX_COMPRESSED_BYTES,
    MAX_DECOMPRESSED_BYTES,
  } from '../services/mimeUtils';
  ```
- [ ] Delete the local `decodeQuotedPrintable` function (lines 40-46).
- [ ] Delete the local `decodeHeaderValue` function (lines 48-63) and replace ALL call sites with `decodeRfc2047`:
  - In `parseEmailAddress` (line 218): `const trimmed = decodeRfc2047(str.trim());`
  - In `parseEmailFromLines` subject (line 441): `const subject = decodeRfc2047(headers['subject'] || '(No Subject)');`
- [ ] Delete the local `isFromLine` function (lines 170-174) and replace its two call sites — `findLastFromLine` (lines 197, 209) and `parseEmailsFromText` (line 493) — with `isMboxFromLine`.
- [ ] Confirm `decodeQuotedPrintable` call sites in `parseMimeParts` (line 341) and `parseEmailFromLines` (line 409) now resolve to the imported helper (no signature change needed — `charset` is optional).
- [ ] From `web`, run `npm run build`. Confirm it passes (no unused-symbol / unresolved-import errors).
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "refactor(worker): use mimeUtils decode + From-line helpers (#1,#2,#3)"`

---

### Task 8 — Port size / zip-bomb / field-length guards into the worker (FIX #4)

The worker's `parseOLMFile` (~800), `parseGmailTakeoutFile` (~938), `parseEmailFromLines` (354-484), and `parseOLMEmailXML` (597-690) enforce NO size or field-length limits, unlike `olmParser.ts`. Port the guards using the imported constants.

- [ ] In `web/src/workers/parserWorker.ts` `parseOLMFile` (after `reportProgress('extracting', 0, ...)` at line 801, before `const zip = await JSZip.loadAsync(file);`), add the compressed-size guard:
  ```ts
    if (file.size > MAX_COMPRESSED_BYTES) {
      throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(0)}MB). Maximum supported size is 500MB.`);
    }
  ```
- [ ] In `parseOLMFile`, immediately after `const zip = await JSZip.loadAsync(file);` (line 803), add the decompressed (zip-bomb) guard ported from `olmParser.ts:58-70`:
  ```ts
    let totalDecompressedSize = 0;
    for (const entry of Object.values(zip.files)) {
      if (!entry.dir) {
        const entryData = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
        if (entryData && typeof entryData.uncompressedSize === 'number') {
          totalDecompressedSize += entryData.uncompressedSize;
        }
      }
    }
    if (totalDecompressedSize > MAX_DECOMPRESSED_BYTES) {
      throw new Error('Archive decompressed size exceeds 2GB limit. This may be a malicious file.');
    }
  ```
- [ ] In `parseGmailTakeoutFile`, after `reportProgress('extracting', 0, ...)` (line 939, before `JSZip.loadAsync`), add the same compressed-size guard; and after `const zip = await JSZip.loadAsync(file);` (line 941) add the same decompressed guard block (copy the two blocks above verbatim).
- [ ] In `parseEmailFromLines` (the `return {...}` at lines 464-479), apply per-field truncation so the worker matches `olmParser.ts:317-334`. Replace the return object's `subject`, `sender`, `recipients`, `body`, `htmlBody` fields:
  ```ts
      subject: subject.length > MAX_SUBJECT_LEN ? subject.slice(0, MAX_SUBJECT_LEN) : subject,
      sender: cleanEmailAddress(sender).slice(0, MAX_EMAIL_LEN),
      senderName: senderName || undefined,
      recipients: recipients.map(r => r.slice(0, MAX_EMAIL_LEN)).slice(0, 1000),
      date: date || new Date(),
      body: (() => {
        const b = body.trim() || (htmlBody ? stripHtml(htmlBody) : '');
        return b.length > MAX_BODY_LEN ? b.slice(0, MAX_BODY_LEN) : b;
      })(),
      htmlBody: htmlBody && htmlBody.length > MAX_BODY_LEN ? htmlBody.slice(0, MAX_BODY_LEN) : htmlBody,
  ```
- [ ] In `parseOLMEmailXML` (the `return {...}` at lines 670-685), apply the same truncation to `subject`, `sender`, `recipients`, `body`, `htmlBody`:
  ```ts
      subject: (subject || '(No Subject)').slice(0, MAX_SUBJECT_LEN),
      sender: cleanEmailAddress(sender).slice(0, MAX_EMAIL_LEN),
      senderName: senderName || undefined,
      recipients: recipients.map(r => r.slice(0, MAX_EMAIL_LEN)).slice(0, 1000),
      date: isNaN(date.getTime()) ? new Date() : date,
      body: (() => { const b = body || preview || ''; return b.length > MAX_BODY_LEN ? b.slice(0, MAX_BODY_LEN) : b; })(),
      htmlBody: htmlBody && htmlBody.length > MAX_BODY_LEN ? htmlBody.slice(0, MAX_BODY_LEN) : (htmlBody || undefined),
  ```
- [ ] From `web`, run `npm run build`. Confirm it passes.
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "fix(worker): port size, zip-bomb, and field-length guards (#4)"`

---

### Task 9 — Populate `Email.snippet` at parse time

Both worker email builders should set `snippet` from `htmlBody || body` via `makeSnippet`.

- [ ] In `parseEmailFromLines` return object (`web/src/workers/parserWorker.ts` ~464-479), add a `snippet` field after `htmlBody`:
  ```ts
      snippet: makeSnippet(htmlBody || body),
  ```
- [ ] In `parseOLMEmailXML` return object (~670-685), add after `htmlBody`:
  ```ts
      snippet: makeSnippet(htmlBody || body || preview || ''),
  ```
- [ ] From `web`, run `npm run build`. Confirm it passes (the `Email` type now includes `snippet?`, so this compiles).
- [ ] Run `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "feat(worker): populate Email.snippet at parse time"`

---

### Task 10 — Dead-code decision: re-export shared helpers from `mimeUtils`

`olmParser.ts` and `mboxParser.ts` are dead for the live parse path (only `gmailTakeoutParser` imports `mboxParser`, and `HomePage` imports `gmailTakeoutParser` solely for `isGmailTakeout` file detection — never for parsing). Their existing test suites (`phase-7/mboxParser.test.ts`, plus any olm tests) still exercise them, so deleting outright would drop coverage. Decision: **keep the classes but eliminate duplicated decode logic** by delegating to `mimeUtils`, making `mimeUtils` the single source of truth.

- [ ] In `web/src/services/mboxParser.ts`, replace the body of the private `decodeQuotedPrintable` (lines 610-616) to delegate:
  ```ts
    private decodeQuotedPrintable(str: string): string {
      return decodeQuotedPrintable(str);
    }
  ```
  and replace the private `decodeHeaderValue` (lines 618-633) to delegate:
  ```ts
    private decodeHeaderValue(str: string): string {
      return decodeRfc2047(str);
    }
  ```
  Add the import at the top of `mboxParser.ts`:
  ```ts
  import { decodeQuotedPrintable, decodeRfc2047 } from './mimeUtils';
  ```
- [ ] In `web/src/services/olmParser.ts`, replace the four inline size constants (lines 49, 58, 318-320) with imports from `mimeUtils` and use them. Add to the existing import group at the top:
  ```ts
  import { MAX_COMPRESSED_BYTES, MAX_DECOMPRESSED_BYTES, MAX_SUBJECT_LEN, MAX_BODY_LEN, MAX_EMAIL_LEN } from './mimeUtils';
  ```
  Then: delete `const MAX_COMPRESSED_SIZE = 500 * 1024 * 1024;` (line 49) and use `MAX_COMPRESSED_BYTES` in the check on line 50; delete `const MAX_DECOMPRESSED_SIZE = 2 * 1024 * 1024 * 1024;` (line 58) and use `MAX_DECOMPRESSED_BYTES` on line 68; delete the three local `MAX_*` consts (lines 318-320) — the existing references on lines 324-334 already use those names, now imported.
- [ ] From `web`, run the existing parser suites: `npx vitest run src/__tests__/phase-7/mboxParser.test.ts` and any olm test (`npx vitest run src/__tests__` to be safe). Confirm green — behavior is preserved (mbox `decodeQuotedPrintable` still defaults to UTF-8; mbox tests use ASCII bodies).
- [ ] Run `npm run build` and `npm run lint`. Confirm clean.
- [ ] Commit: `git commit -m "refactor: dedupe parser helpers via mimeUtils single source of truth (#19)"`

---

### Task 11 — Final verification (all green)

- [ ] From `web`, run `npm run test:run`. Confirm the FULL suite passes, including the new `src/__tests__/phase-9/mimeUtils.test.ts`.
- [ ] Run `npm run lint`. Confirm zero errors.
- [ ] Run `npm run build`. Confirm a clean TypeScript + Vite production build.
- [ ] Confirm `git status` is clean and `git config user.email` is allowlisted.
- [ ] If anything is red, switch to **superpowers:systematic-debugging** before patching — do not paper over failures.
- [ ] No commit needed unless verification surfaced a fix; if it did, commit it with a `fix:`-prefixed message describing the issue.
