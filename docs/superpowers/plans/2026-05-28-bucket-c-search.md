# Bucket C: Wire Advanced/Operator Search End-to-End

**Goal:** Make the advanced/operator search actually work in the Emails page. Today
`web/src/services/searchParser.ts` is fully implemented and unit-tested but has **zero importers
outside tests**. `EmailsPage.tsx` filters with a raw `.includes(query)` block (lines 124-130), so
operator queries (`from:`, `subject:`, `is:unread`, `type:purchase`, `in:archive`, etc.) match
nothing — the operator string is searched literally against subject/sender/body. The
`AdvancedSearchBuilder` component emits these exact operator strings (`from:…`, `is:unread`, …) into
the same search box, so its output is currently dead. This bucket wires `parseSearchQuery` +
`filterEmails` into `EmailsPage` so operator queries work, while preserving plain free-text search.

**Architecture:** Browser-only Vite/React/TS email archive analyzer. Data lives in IndexedDB (Dexie),
mirrored into a Zustand store (`web/src/store/index.ts`). `EmailsPage` reads `emails` from the store,
filters/sorts them in a `processedEmails` `useMemo`, and renders paginated or virtualized lists. The
search parser is a pure module: `parseSearchQuery(query: string): ParsedSearch` turns a query string
into a structured filter object, and `filterEmails(emails: Email[], search: ParsedSearch): Email[]`
applies it. We plug these two into the existing `processedEmails` pipeline.

**Tech Stack:** Vite, React 18, TypeScript (strict), Zustand, Dexie. Tests: Vitest 4 + jsdom +
`@testing-library/react` + `fake-indexeddb/auto`. Tests live under `web/src/__tests__/phase-N/`.
Run from the `web` directory:
- `npm run test:run` — run all tests once
- `npx vitest run src/__tests__/phase-3/searchParser.test.ts` — run one file
- `npm run lint` — ESLint
- `npm run build` — `tsc -b` typecheck + Vite production build

**For agentic workers:** Execute this plan using `superpowers:subagent-driven-development`. Work
strictly test-first: write/extend a failing test, run it and SEE it fail, implement the minimum to
pass, run it and SEE it pass, then move on. Use real code in every step — no placeholders. Commit
after each green task with a normal `git commit` (no `--no-verify`, no author env vars; verify
`git config user.email` is an allowed value first).

---

## IMPORTANT: scope & verified findings (read before starting)

### Shared-file boundary (DO NOT EDIT outside scope)
`web/src/pages/EmailsPage.tsx` is **also** edited by the UI-correctness bucket, which owns the
**`threads` `useMemo`** (lines 154-172, the threads-view folder filter). **This plan must NOT touch
the `threads` useMemo at all.** This plan only touches:
1. The search-related **imports** at the top of `EmailsPage.tsx`.
2. The **search-filter block inside `processedEmails`** (lines 124-131 in the current file).

Leave sorting, folder filtering, the `filter` switch, and the entire `threads` useMemo untouched.

### Verified-against-source finding about the tokenizer (changes Task 1)
The bucket brief asked for a tokenizer *fix* in `searchParser.ts` (~186-199) on the theory that any
`word:value` is treated as an operator, so URLs (`https://x`) and times (`12:30`) get split into bogus
operator tokens.

**This was verified against the actual current source and is already handled.** The tokenizer at
`web/src/services/searchParser.ts:181-209` already maintains an `operators` allowlist (line 183) and,
at lines 190-200, only emits an operator token when ``operators.includes(`${operator}:`)`` is true
(line 195). For an unknown prefix it falls to the `else` branch (lines 197-199) and emits the **whole
matched token** (`match[0]`) as free text. Confirmed by replicating the exact tokenize logic:

```
"check https://example.com now"  => text "check", text "https://example.com", text "now"
"meeting at 12:30 today"         => text "meeting", text "at", text "12:30", text "today"
"from:bob hello"                 => from "bob", text "hello"
```

So URLs and times are **already** preserved as free text today. Therefore Task 1 is **not a fix** —
it is a **regression guard**: add explicit tests that lock in this behavior so a future tokenizer
refactor cannot silently regress it. (If, when you run these new tests, any of them unexpectedly
FAIL, then the source has diverged from what was audited — in that case apply the allowlist fix
described in the Task 1 "fallback fix" note and re-run.)

### Verified public API of `searchParser.ts` (use these EXACT names)
- `parseSearchQuery(query: string): ParsedSearch` — returns a structured object, NOT a predicate.
- `filterEmails(emails: Email[], search: ParsedSearch): Email[]` — applies the parsed search.
- `getSearchTerms(search: ParsedSearch): string[]` — for highlighting (not needed here).
- `ParsedSearch` fields used: `freeText`, `from`, `to`, `subject`, `body`, `dateFrom`, `dateTo`,
  `dateYear`, `hasAttachment`, `isUnread`, `isStarred`, `isRead`, `type`, `folder`.
- `filterEmails`'s free-text branch (lines 247-256) already matches `subject`/`sender`/`body` with
  `.includes()` — identical semantics to EmailsPage's current plain-query behavior, so plain queries
  keep working after the swap.

### Verified EmailsPage facts (current line numbers)
- `debouncedSearch` state: line 30; populated via debounce effect lines 34-39.
- The raw search block to replace: **lines 124-131** inside `processedEmails` (`useMemo` spans
  99-151; deps array line 151).
- `import { SYSTEM_FOLDERS, type Email } from '../types';` is line 12 — a good anchor to add the
  parser import after.

### Folder-operator caveat (note, do not "fix" here)
`filterEmails` applies `search.folder` as `email.folderId !== search.folder` (lines 354-358).
`processedEmails` ALSO pre-filters by `currentFolder` (lines 101-103). So an `in:archive` operator
while viewing the Inbox folder will (correctly) yield zero results, because the page is already scoped
to Inbox. That is acceptable/expected behavior for this bucket and must NOT be special-cased here.

### Dependency on the Performance bucket (Bucket D) — `searchText`
Per the build order `A → B → D → C`, Bucket D runs BEFORE this bucket. Bucket D moves email
`body`/`htmlBody` OUT of the in-memory store rows (table split) and adds a bounded
`Email.searchText?: string` (first ~2KB of stripped body) onto the slim header rows, populated at
import and in the `version(5)` migration. **Consequence:** after Bucket D, `email.body` is `undefined`
on in-memory rows, so `filterEmails`'s body/free-text matching (which reads `email.body`) would
silently match nothing. **Task 1.5 below fixes this** by making those reads
`email.searchText ?? email.body`. This is backward-compatible — if Bucket D has not landed yet,
`searchText` is undefined and it falls back to `email.body` (current behavior). Do Task 1.5
regardless of whether D has landed.

---

## File Structure

Files touched by this plan:

```
web/src/
├── services/
│   └── searchParser.ts                         # Task 1.5: body reads -> email.searchText ?? email.body
├── pages/
│   └── EmailsPage.tsx                           # Task 3: imports + processedEmails search block
├── types/
│   └── index.ts                                 # Task 1.5: Email.searchText? (only if Bucket D hasn't added it)
└── __tests__/
    └── phase-3/
        ├── searchParser.test.ts                # Task 1: tokenizer guard; Task 1.5: searchText body match
        └── emailsPage-search-integration.test.ts  # Task 2: NEW parse+apply integration test
```

No new runtime files. One new test file (`emailsPage-search-integration.test.ts`).

---

## Task 1 — Tokenizer regression guard for URLs & times (searchParser.ts)

Goal: lock in that free-text URLs and times are NOT mis-parsed into operator filters. Extend the
existing phase-3 test file.

- [ ] **1.1 Write the failing-or-passing guard tests.** Open
  `web/src/__tests__/phase-3/searchParser.test.ts`. Inside the existing
  `describe('parseSearchQuery', () => { ... })` block (after the `'should extract free text'` test,
  i.e. after line 99's test that ends at line 99), add these tests:

  ```ts
    it('should keep a URL as free text, not an operator', () => {
      const result = parseSearchQuery('check https://example.com now');
      expect(result.freeText).toBe('check https://example.com now');
      // https: must NOT be interpreted as an operator
      expect(result.from).toBeUndefined();
      expect(result.subject).toBeUndefined();
      expect(result.body).toBeUndefined();
    });

    it('should keep a time value as free text, not an operator', () => {
      const result = parseSearchQuery('meeting at 12:30 today');
      expect(result.freeText).toBe('meeting at 12:30 today');
      expect(result.from).toBeUndefined();
      expect(result.subject).toBeUndefined();
    });

    it('should keep an unknown word:value token as free text', () => {
      const result = parseSearchQuery('foo:bar hello');
      expect(result.freeText).toBe('foo:bar hello');
      expect(result.from).toBeUndefined();
    });

    it('should still parse a real operator mixed with a URL', () => {
      const result = parseSearchQuery('from:bob see https://x.com/y');
      expect(result.from).toBe('bob');
      expect(result.freeText).toBe('see https://x.com/y');
    });
  ```

- [ ] **1.2 Run the test file and observe.**
  ```bash
  npx vitest run src/__tests__/phase-3/searchParser.test.ts
  ```
  Expected: all four new tests **pass** (per the verified finding above, the allowlist already
  exists). This green run is your evidence the regression guard is in place.

- [ ] **1.3 Fallback fix (ONLY if any 1.1 test failed in 1.2).** If a test failed, the source has
  diverged. Open `web/src/services/searchParser.ts` and harden the `tokenize` function (lines
  181-209) so a `word:` prefix is treated as an operator only when it is in the allowlist. The
  branch at lines 190-200 should read:

  ```ts
      if (match[1]) {
        const operator = match[1].toLowerCase() as TokenType;
        const value = match[3] || match[4]; // Quoted or unquoted value

        if (operators.includes(`${operator}:`)) {
          tokens.push({ type: operator, value });
        } else {
          // Unknown prefix (e.g. "https" in a URL, "12" in "12:30") -> whole token as free text
          tokens.push({ type: 'text', value: match[0] });
        }
      } else {
  ```

  This is the same shape already present; only apply if reality differed. Re-run 1.2 until green.

- [ ] **1.4 Commit.** Verify author first.
  ```bash
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer config user.email
  ```
  Then:
  ```bash
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer add web/src/__tests__/phase-3/searchParser.test.ts web/src/services/searchParser.ts
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer commit -m "test(search): guard tokenizer against URLs/times being parsed as operators"
  ```

---

## Task 1.5 — Make body matching `searchText`-aware (Bucket D reconciliation)

Goal: ensure `filterEmails` still matches email bodies after Bucket D moves `body` out of in-memory
rows. Change the two `email.body` reads in `filterEmails` to `email.searchText ?? email.body`.
Backward-compatible (falls back to `body` when `searchText` is absent).

- [ ] **1.5.1 Write the failing test.** In `web/src/__tests__/phase-3/searchParser.test.ts`, add a
  `describe('filterEmails + searchText', ...)` block:

  ```ts
    it('matches body via searchText when body is absent (post table-split)', () => {
      const email = {
        id: 1, subject: 'Hi', sender: 'a@x.com', recipients: ['b@y.com'],
        date: new Date(), body: '', searchText: 'quarterly invoice total due',
        attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'inbox', emailType: 'regular' as const,
      } as Email;
      expect(filterEmails([email], parseSearchQuery('invoice')).length).toBe(1);
      expect(filterEmails([email], parseSearchQuery('body:quarterly')).length).toBe(1);
    });

    it('still matches via body when searchText is absent (pre table-split)', () => {
      const email = {
        id: 2, subject: 'Hi', sender: 'a@x.com', recipients: [],
        date: new Date(), body: 'legacy body text', attachments: [], size: 0,
        isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular' as const,
      } as Email;
      expect(filterEmails([email], parseSearchQuery('legacy')).length).toBe(1);
    });
  ```

- [ ] **1.5.2 Run it.**
  ```bash
  npx vitest run src/__tests__/phase-3/searchParser.test.ts
  ```
  Expected: the first test **FAILS** (body is `''`, so `invoice`/`body:quarterly` don't match while
  the source still reads `email.body`). This requires `Email.searchText?` to exist on the type — it is
  added by Bucket D. **If Bucket D has not landed**, first add `searchText?: string;` to the `Email`
  interface in `web/src/types/index.ts` (optional, additive) so the test compiles.

- [ ] **1.5.3 Make it pass.** In `web/src/services/searchParser.ts`, change the free-text body read
  (currently line 251) and the body-operator read (currently lines 283-287):

  ```ts
      // free-text branch (was: const matchesBody = email.body.toLowerCase().includes(searchText);)
      const matchesBody = (email.searchText ?? email.body ?? '').toLowerCase().includes(searchText);
  ```
  ```ts
      // body operator (was: if (!email.body.toLowerCase().includes(search.body)) {)
      if (search.body) {
        if (!(email.searchText ?? email.body ?? '').toLowerCase().includes(search.body)) {
          return false;
        }
      }
  ```

- [ ] **1.5.4 Run + commit.**
  ```bash
  npx vitest run src/__tests__/phase-3/searchParser.test.ts
  ```
  Expected: PASS.
  ```bash
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer config user.email
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer add web/src/services/searchParser.ts web/src/__tests__/phase-3/searchParser.test.ts web/src/types/index.ts
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer commit -m "fix(search): match body via searchText so search survives the body table-split"
  ```

---

## Task 2 — Integration test: parse + apply over a fixture Email[] (proves operator search works)

Goal: prove `parseSearchQuery` → `filterEmails` produces the behavior EmailsPage will rely on:
operator queries filter correctly AND plain queries still match subject/sender/body. Because
`EmailsPage` is a component, we test the parse+apply integration directly (the same two functions the
page will call), which is the load-bearing logic.

- [ ] **2.1 Create the failing test file.** Create
  `web/src/__tests__/phase-3/emailsPage-search-integration.test.ts` with:

  ```ts
  import { describe, it, expect } from 'vitest';
  import { parseSearchQuery, filterEmails } from '../../services/searchParser';
  import type { Email } from '../../types';

  // Mirrors the helper in searchParser.test.ts so fixtures stay self-contained.
  const createMockEmail = (overrides: Partial<Email> = {}): Email => ({
    id: 1,
    subject: 'Test Subject',
    sender: 'sender@example.com',
    recipients: ['recipient@example.com'],
    date: new Date('2024-06-15'),
    body: 'Test body content',
    attachments: [],
    size: 1024,
    isRead: false,
    isStarred: false,
    folderId: 'inbox',
    emailType: 'regular',
    ...overrides,
  });

  // The exact integration EmailsPage will perform: parse the search box string,
  // then apply it to the in-memory email list.
  const applySearch = (emails: Email[], query: string): Email[] =>
    filterEmails(emails, parseSearchQuery(query));

  describe('EmailsPage search integration (parse + apply)', () => {
    const emails: Email[] = [
      createMockEmail({ id: 1, sender: 'bob@x.com', subject: 'Lunch plans', body: 'see you at noon', isRead: false }),
      createMockEmail({ id: 2, sender: 'alice@x.com', subject: 'Invoice #42', body: 'payment due', isRead: true, emailType: 'purchase' }),
      createMockEmail({ id: 3, sender: 'newsletter@news.com', subject: 'Weekly digest', body: 'top stories', isRead: false }),
    ];

    it('from: matches only the matching sender', () => {
      const result = applySearch(emails, 'from:bob@x.com');
      expect(result.map(e => e.id)).toEqual([1]);
    });

    it('is:unread matches only unread emails', () => {
      const result = applySearch(emails, 'is:unread');
      expect(result.map(e => e.id).sort()).toEqual([1, 3]);
    });

    it('subject: with quotes matches the full phrase', () => {
      const result = applySearch(emails, 'subject:"Invoice #42"');
      expect(result.map(e => e.id)).toEqual([2]);
    });

    it('type:purchase matches only purchase emails', () => {
      const result = applySearch(emails, 'type:purchase');
      expect(result.map(e => e.id)).toEqual([2]);
    });

    it('combined operators are ANDed together', () => {
      const result = applySearch(emails, 'from:x.com is:unread');
      expect(result.map(e => e.id).sort()).toEqual([1]);
    });

    it('plain free text still matches subject', () => {
      const result = applySearch(emails, 'Lunch');
      expect(result.map(e => e.id)).toEqual([1]);
    });

    it('plain free text still matches sender', () => {
      const result = applySearch(emails, 'newsletter@news.com');
      expect(result.map(e => e.id)).toEqual([3]);
    });

    it('plain free text still matches body', () => {
      const result = applySearch(emails, 'top stories');
      expect(result.map(e => e.id)).toEqual([3]);
    });

    it('a free-text URL does not act as an operator and matches nothing here', () => {
      // None of the fixtures contain this URL; it must be treated as free text,
      // not as a "https:" operator that would error or match everything.
      const result = applySearch(emails, 'https://unmatched.example.com');
      expect(result).toHaveLength(0);
    });

    it('empty query returns all emails', () => {
      const result = applySearch(emails, '');
      expect(result.map(e => e.id).sort()).toEqual([1, 2, 3]);
    });
  });
  ```

- [ ] **2.2 Run and observe.**
  ```bash
  npx vitest run src/__tests__/phase-3/emailsPage-search-integration.test.ts
  ```
  Expected: all tests **pass** — they exercise already-implemented functions. This locks in the
  contract EmailsPage will depend on in Task 3. (The `from:x.com` AND-combined case relies on
  `filterEmails`'s `email.sender.toLowerCase().includes(search.from)` substring match at lines
  259-263; `bob@x.com` and `alice@x.com` both contain `x.com`, but only id 1 is also unread.)

- [ ] **2.3 Commit.**
  ```bash
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer add web/src/__tests__/phase-3/emailsPage-search-integration.test.ts
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer commit -m "test(search): integration coverage for parse+apply over fixture emails"
  ```

---

## Task 3 — Wire the parser into EmailsPage.processedEmails (the actual fix)

Goal: replace the raw `.includes()` search block with `filterEmails(result, parseSearchQuery(...))`.
This is the change that makes operator search work in the running app. The integration test in Task 2
is the safety net.

- [ ] **3.1 Add the import.** In `web/src/pages/EmailsPage.tsx`, the current import at line 12 is:

  ```ts
  import { SYSTEM_FOLDERS, type Email } from '../types';
  ```

  Add a new import line immediately after it (becomes line 13):

  ```ts
  import { parseSearchQuery, filterEmails } from '../services/searchParser';
  ```

- [ ] **3.2 Replace the search-filter block.** In `processedEmails` (the `useMemo` at lines 99-151),
  the current search block is lines 123-131:

  **BEFORE (current lines 123-131):**
  ```ts
      // Apply search (debounced to avoid scanning bodies on every keystroke)
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        result = result.filter(email =>
          email.subject.toLowerCase().includes(query) ||
          email.sender.toLowerCase().includes(query) ||
          email.body.toLowerCase().includes(query)
        );
      }
  ```

  **AFTER (replacement):**
  ```ts
      // Apply search via the operator-aware parser (debounced).
      // Plain queries fall through to ParsedSearch.freeText, which filterEmails
      // matches against subject/sender/body — preserving prior behavior.
      // Operator queries (from:, subject:, is:unread, type:, in:, date:, etc.) now work.
      if (debouncedSearch.trim()) {
        result = filterEmails(result, parseSearchQuery(debouncedSearch));
      }
  ```

  Do NOT change anything else inside `processedEmails`: the folder filter (lines 101-103), the
  `filter` switch (lines 106-121), the sort (lines 134-148), and the deps array (line 151, which
  already includes `debouncedSearch`) all stay as-is.

- [ ] **3.3 Confirm the `threads` useMemo is untouched.** Visually verify lines 154-172 (the
  `threads` useMemo owned by the UI bucket) are byte-for-byte unchanged. If they differ from the
  original, revert that portion — it is out of scope.

- [ ] **3.4 Run the full test suite to confirm no regressions.**
  ```bash
  cd /Users/jacobkanfer/CodeRepos/EmailAnalyzer/web && npm run test:run
  ```
  Expected: green. Pay attention to any existing EmailsPage tests under `phase-7`/`phase-8`.

- [ ] **3.5 Typecheck + lint.**
  ```bash
  cd /Users/jacobkanfer/CodeRepos/EmailAnalyzer/web && npm run lint
  ```
  Expected: no new errors. `parseSearchQuery`/`filterEmails` are both used, so no unused-import lint.

- [ ] **3.6 Commit.**
  ```bash
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer add web/src/pages/EmailsPage.tsx
  git -C /Users/jacobkanfer/CodeRepos/EmailAnalyzer commit -m "feat(search): wire operator-aware searchParser into EmailsPage filtering"
  ```

---

## Task 4 — Manual verification in the running app

Goal: confirm end-to-end behavior in a browser with real data.

- [ ] **4.1 Start the dev server.**
  ```bash
  cd /Users/jacobkanfer/CodeRepos/EmailAnalyzer/web && npm run dev
  ```
  Open the printed localhost URL. Import an archive (or use existing IndexedDB data) so the Emails
  page has emails. Navigate to the Emails page (Inbox).

- [ ] **4.2 Plain free text.** Type a word you know appears in a subject/sender/body (e.g. a known
  sender domain). Confirm only matching emails show and the count line ("N emails") updates after the
  ~250ms debounce.

- [ ] **4.3 `from:` operator.** Type `from:` followed by a known sender fragment (e.g.
  `from:amazon`). Confirm only emails from that sender show — and that the literal text `from:` is no
  longer searched as plain text (before this fix it would have matched ~nothing).

- [ ] **4.4 Quoted `subject:`.** Type `subject:"order confirmation"` (or another known multi-word
  subject). Confirm only emails whose subject contains that phrase show.

- [ ] **4.5 `is:unread`.** Type `is:unread`. Confirm only unread emails show. Then try
  `from:<known> is:unread` and confirm the results are the intersection.

- [ ] **4.6 URL / time as free text.** Type a URL like `https://example.com` (something not present
  in your data). Confirm it returns zero results gracefully — NOT a crash and NOT "match everything".
  Then type a plain time like `12:30`; confirm it is searched as literal free text (no console
  errors).

- [ ] **4.7 AdvancedSearchBuilder round-trip.** Click the sliders icon, fill in From + check
  "Unread only", click Search. Confirm the generated query (e.g. `from:… is:unread`) populates the
  box and the list filters correctly. This proves the builder's previously-dead output now drives
  filtering.

- [ ] **4.8 Stop the dev server** (Ctrl-C).

---

## Final verification

- [ ] Run the full gate from the `web` directory and confirm all three pass:
  ```bash
  cd /Users/jacobkanfer/CodeRepos/EmailAnalyzer/web && npm run test:run && npm run lint && npm run build
  ```
  Expected: tests green, lint clean, `tsc -b` + Vite build succeed.

- [ ] Confirm the only runtime change is in `EmailsPage.tsx` (imports + the search block in
  `processedEmails`), `searchParser.ts` is unchanged (or only the fallback allowlist hardening from
  1.3), and the `threads` useMemo was never touched.
