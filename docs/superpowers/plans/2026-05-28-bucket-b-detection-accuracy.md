# Bucket B: Detection & Analysis Accuracy

## Goal
Stop wrong service/merchant/amount/thread attributions in the detection layer. Five concrete defects:

- **Issue 5 (HIGH)** — Loose substring domain matching causes false attributions across three detectors.
- **Issue 10 (MEDIUM)** — Subscription amount/frequency extraction has no billing context and silently defaults.
- **Issue 11 (MEDIUM)** — Purchase locale amount parsing mangles EUR-style numbers (`1.234` → `1.234` instead of `1234`).
- **Issue 16 (MEDIUM)** — Threadless emails with generic subjects (`Invoice`, `Receipt`) collapse different senders into one thread.
- **Issue 12 (MEDIUM)** — Custom-rule regex runs unbounded against full body → catastrophic backtracking freezes the tab.

## Architecture
Vite + React + TypeScript browser app. Detection layer lives in `web/src/services/*Detector.ts`, threading in `web/src/services/threadingService.ts`, user rules in `web/src/services/customRulesEngine.ts`. All detectors take an `Email` and produce structured results stored in IndexedDB (Dexie). Domain extraction is centralized in `web/src/utils/emailUtils.ts` (`extractDomain`). Three detectors duplicate the same buggy domain-matching loop, so this plan introduces ONE shared helper `web/src/services/domainMatch.ts` and wires all three to it (DRY).

## Tech Stack
- Tests: Vitest 4 + jsdom + @testing-library/react + `fake-indexeddb/auto`
- Run from `web/` dir: `npm run test:run` (single run) or `npx vitest run <path>` (one file)
- Lint: `npm run lint` · Build: `npm run build`
- New tests go in `web/src/__tests__/phase-9/`

## For agentic workers
Execute this plan with **superpowers:subagent-driven-development**. Each task is strict TDD: write the failing test → run it and SEE it fail → write minimal implementation → run it and SEE it pass → lint → commit. Do NOT batch tasks. Do NOT use `--no-verify`, and do NOT set any `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars. Before the first commit, confirm `git config user.email` returns `51518860+Technical-1@users.noreply.github.com` or `jacobrk2001@gmail.com`.

---

## File Structure

New files:
```
web/src/services/domainMatch.ts                         # NEW: shared isDomainMatch helper
web/src/__tests__/phase-9/domainMatch.test.ts           # NEW: Issue 5 helper tests
web/src/__tests__/phase-9/accountDetector.domain.test.ts# NEW: Issue 5 accountDetector
web/src/__tests__/phase-9/purchaseDetector.domain.test.ts# NEW: Issue 5 purchaseDetector
web/src/__tests__/phase-9/subscriptionDetector.domain.test.ts # NEW: Issue 5 subscriptionDetector
web/src/__tests__/phase-9/subscriptionDetector.billing.test.ts # NEW: Issue 10
web/src/__tests__/phase-9/purchaseDetector.locale.test.ts# NEW: Issue 11
web/src/__tests__/phase-9/threadingService.fallback.test.ts # NEW: Issue 16
web/src/__tests__/phase-9/customRulesEngine.regex.test.ts# NEW: Issue 12
```

Modified files:
```
web/src/services/accountDetector.ts        # findKnownService → use isDomainMatch
web/src/services/purchaseDetector.ts        # findKnownMerchant → use isDomainMatch; parseAmount locale fix
web/src/services/subscriptionDetector.ts    # findKnownSubscription → use isDomainMatch; extractAmount/detectFrequency billing-context
web/src/services/threadingService.ts        # getThreadKey fallback incorporates sender domain
web/src/services/customRulesEngine.ts       # matchesCondition regex bounds body length
```

---

## Issue 5 — Shared exact/suffix domain matching (HIGH)

Current bug: `accountDetector.ts:277-282` and `purchaseDetector.ts:423-428` add a SECOND loop after the correct suffix loop:
```ts
const baseDomain = serviceDomain.split('.')[0];
if (domain.includes(baseDomain + '.') || domain.includes('.' + baseDomain)) {
```
This makes `'max'` match `maxwell.com`, `'apple'` match `pineapple.com`, `'hp'` match `php.net`. `subscriptionDetector.ts:183-187` is worse — `domain.includes(subDomain.split('.')[0])` with no boundary at all. The FIRST loop in account/purchase (`domain === serviceDomain || domain.endsWith('.' + serviceDomain)`) is already correct; the fix is to delete the buggy second loop and route all three through a shared helper.

### Task 5.1 — Create shared helper test (RED)

- [ ] Create `web/src/__tests__/phase-9/domainMatch.test.ts`:
```ts
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
```
- [ ] Run `npx vitest run src/__tests__/phase-9/domainMatch.test.ts` from `web/`. EXPECT failure: module `../../services/domainMatch` does not exist.

### Task 5.2 — Implement helper (GREEN)

- [ ] Create `web/src/services/domainMatch.ts`:
```ts
/**
 * Returns true iff emailDomain is exactly serviceDomain or a subdomain of it.
 * Boundary-safe: 'maxwell.com' does NOT match 'max.com', 'pineapple.com' does
 * NOT match 'apple.com'. Comparison is case-insensitive and trimmed.
 */
export function isDomainMatch(emailDomain: string, serviceDomain: string): boolean {
  const d = emailDomain.trim().toLowerCase();
  const s = serviceDomain.trim().toLowerCase();
  if (!d || !s) return false;
  return d === s || d.endsWith('.' + s);
}
```
- [ ] Run `npx vitest run src/__tests__/phase-9/domainMatch.test.ts`. EXPECT pass.
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/domainMatch.ts web/src/__tests__/phase-9/domainMatch.test.ts && git commit -m "Add boundary-safe isDomainMatch helper (issue 5)"`

### Task 5.3 — accountDetector uses helper (RED)

- [ ] Create `web/src/__tests__/phase-9/accountDetector.domain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { accountDetector } from '../../services/accountDetector';

describe('AccountDetector domain matching (issue 5)', () => {
  it('does NOT treat maxwell.com as a known service via "max"', () => {
    // 'other' is the fallback when no known service matches
    expect(accountDetector.getServiceType('maxwell.com')).toBe('other');
  });

  it('does NOT treat pineapple.com as Apple', () => {
    expect(accountDetector.getServiceType('pineapple.com')).toBe('other');
  });

  it('still resolves real subdomains of a known service', () => {
    // mail.netflix.com should resolve to netflix's known type, not 'other'
    expect(accountDetector.getServiceType('mail.netflix.com')).not.toBe('other');
  });
});
```
- [ ] NOTE: confirm `netflix.com` and an `apple`/`max` entry exist in `accountDetector.ts` `knownServices`. If `apple.com`/`max.com` are NOT present, replace those assertions with whatever short-base-word entries DO exist (read `knownServices` first), but keep at least one positive subdomain case and two negative substring cases.
- [ ] Run `npx vitest run src/__tests__/phase-9/accountDetector.domain.test.ts`. EXPECT failure: `maxwell.com` / `pineapple.com` currently match via the buggy substring loop.

### Task 5.4 — accountDetector fix (GREEN)

- [ ] In `web/src/services/accountDetector.ts`, add to the import on line 2:
```ts
import { stripHtml, extractDomain } from '../utils/emailUtils';
import { isDomainMatch } from './domainMatch';
```
- [ ] Replace the body of `findKnownService` (lines 263-285) so it has exactly ONE matching loop and NO substring loop:
```ts
  private findKnownService(domain: string): { name: string; type: Account['serviceType'] } | null {
    // Direct match
    if (this.knownServices[domain]) {
      return this.knownServices[domain];
    }

    // Exact or subdomain match against each known service domain
    for (const [serviceDomain, info] of Object.entries(this.knownServices)) {
      if (isDomainMatch(domain, serviceDomain)) {
        return info;
      }
    }

    return null;
  }
```
- [ ] Run `npx vitest run src/__tests__/phase-9/accountDetector.domain.test.ts`. EXPECT pass.
- [ ] Run `npx vitest run src/__tests__/phase-1 src/__tests__/phase-2 src/__tests__/phase-3` (regression on any accountDetector tests). EXPECT pass.
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/accountDetector.ts web/src/__tests__/phase-9/accountDetector.domain.test.ts && git commit -m "accountDetector: boundary-safe domain matching (issue 5)"`

### Task 5.5 — purchaseDetector uses helper (RED)

- [ ] Create `web/src/__tests__/phase-9/purchaseDetector.domain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { purchaseDetector } from '../../services/purchaseDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your order confirmation #12345',
  sender: 'orders@maxwell.com',
  senderName: 'Maxwell',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'Order total: $42.00',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('PurchaseDetector merchant domain matching (issue 5)', () => {
  it('does NOT attribute a maxwell.com purchase to a "max" merchant', () => {
    const result = purchaseDetector.detect(email());
    // detected merchant must be the formatted domain (Maxwell), never a known
    // merchant matched via the buggy substring path
    expect(result.data?.merchant).toBe('Maxwell');
  });
});
```
- [ ] NOTE: read `purchaseDetector.detect` and its `DetectionResult.data` shape first to confirm the field name (`merchant`) and that `detect` returns a merchant for a clear order email. If a known merchant uses a 3-letter base that collides with `maxwell`, pick a sender domain that collides with an ACTUAL `knownMerchants` short base and assert the formatted-domain fallback instead. Keep the negative-substring intent.
- [ ] Run `npx vitest run src/__tests__/phase-9/purchaseDetector.domain.test.ts`. EXPECT failure (current substring loop mis-attributes).

### Task 5.6 — purchaseDetector merchant fix (GREEN)

- [ ] In `web/src/services/purchaseDetector.ts`, add to import on line 2:
```ts
import { stripHtml, extractDomain } from '../utils/emailUtils';
import { isDomainMatch } from './domainMatch';
```
- [ ] Replace the body of `findKnownMerchant` (lines 409-431) with a single loop, no substring loop:
```ts
  private findKnownMerchant(domain: string): string | null {
    // Direct match
    if (this.knownMerchants[domain]) {
      return this.knownMerchants[domain];
    }

    // Exact or subdomain match against each known merchant domain
    for (const [merchantDomain, name] of Object.entries(this.knownMerchants)) {
      if (isDomainMatch(domain, merchantDomain)) {
        return name;
      }
    }

    return null;
  }
```
- [ ] Run `npx vitest run src/__tests__/phase-9/purchaseDetector.domain.test.ts`. EXPECT pass.
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/purchaseDetector.ts web/src/__tests__/phase-9/purchaseDetector.domain.test.ts && git commit -m "purchaseDetector: boundary-safe merchant matching (issue 5)"`

### Task 5.7 — subscriptionDetector uses helper (RED)

- [ ] Create `web/src/__tests__/phase-9/subscriptionDetector.domain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { subscriptionDetector } from '../../services/subscriptionDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your subscription renewal',
  sender: 'billing@maxwell.com',
  senderName: 'Maxwell',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: 'Your subscription renews. Recurring charge: $9.99 per month.',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('SubscriptionDetector domain matching (issue 5)', () => {
  it('does NOT attribute maxwell.com to "Max" via base-word substring', () => {
    const result = subscriptionDetector.detectSubscription(email());
    // 'max.com' -> { name: 'Max' } exists in knownSubscriptions; maxwell.com must NOT match it
    expect(result.serviceName).not.toBe('Max');
  });

  it('still matches a real subdomain of a known service', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ sender: 'no-reply@mail.netflix.com', senderName: '' }),
    );
    expect(result.serviceName).toBe('Netflix');
  });
});
```
- [ ] Run `npx vitest run src/__tests__/phase-9/subscriptionDetector.domain.test.ts`. EXPECT failure: `maxwell.com.includes('max')` is true today, so it resolves to `Max`.

### Task 5.8 — subscriptionDetector domain fix (GREEN)

- [ ] In `web/src/services/subscriptionDetector.ts`, add to import on line 2:
```ts
import { stripHtml, extractDomain, formatDomainAsName } from '../utils/emailUtils';
import { isDomainMatch } from './domainMatch';
```
- [ ] Replace the body of `findKnownSubscription` (lines 178-190):
```ts
  private findKnownSubscription(domain: string): { name: string; category: Subscription['category'] } | null {
    if (this.knownSubscriptions[domain]) {
      return this.knownSubscriptions[domain];
    }

    for (const [subDomain, info] of Object.entries(this.knownSubscriptions)) {
      if (isDomainMatch(domain, subDomain)) {
        return info;
      }
    }

    return null;
  }
```
- [ ] Run `npx vitest run src/__tests__/phase-9/subscriptionDetector.domain.test.ts`. EXPECT pass.
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/subscriptionDetector.ts web/src/__tests__/phase-9/subscriptionDetector.domain.test.ts && git commit -m "subscriptionDetector: boundary-safe domain matching (issue 5)"`

---

## Issue 10 — Subscription amount/frequency need billing context (MEDIUM)

Current bug: `subscriptionDetector.ts:195-214` `extractAmount` returns the FIRST currency match anywhere in the body — so a footer `$0.00 shipping` or an unrelated price wins. `detectFrequency` (219-230) returns `'yearly'` whenever the word appears anywhere (e.g. `"billed monthly, save yearly"` → wrongly `yearly`) and falls through to `'monthly'` unconditionally even with NO billing signal.

**Type decision (be consistent):** `Subscription.frequency` is `'weekly' | 'monthly' | 'yearly'` and we will NOT widen it. `detectFrequency` returns `Subscription['frequency'] | undefined` (it already does). New rule: return a concrete frequency ONLY when a billing-context phrase is found near the frequency word; otherwise return `undefined` (no silent `'monthly'` default). `extractAmount` returns `amount: undefined` unless the currency value sits within a billing-context window.

### Task 10.1 — billing-context amount + frequency tests (RED)

- [ ] Create `web/src/__tests__/phase-9/subscriptionDetector.billing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Email } from '../../types';
import { subscriptionDetector } from '../../services/subscriptionDetector';

const email = (overrides: Partial<Email> = {}): Email => ({
  id: 1,
  subject: 'Your subscription renewal',
  sender: 'billing@netflix.com',
  senderName: 'Netflix',
  recipients: ['me@example.com'],
  date: new Date('2024-01-01'),
  body: '',
  attachments: [],
  size: 1024,
  isRead: true,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('SubscriptionDetector billing context (issue 10)', () => {
  it('picks the billing amount, not an unrelated footer price', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        body: 'Your subscription renews. You will be charged $15.49 per month. Free shipping on orders over $0.00.',
      }),
    );
    expect(result.amount).toBe(15.49);
  });

  it('returns no amount when no billing-context phrase surrounds a price', () => {
    const result = subscriptionDetector.detectSubscription(
      email({
        body: 'Your subscription renewal is confirmed. Check out our store: hoodies from $0.00 today!',
      }),
    );
    expect(result.amount).toBeUndefined();
  });

  it('detects yearly only when the billing context says yearly', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Your subscription renews. You will be billed $99.00 per year.' }),
    );
    expect(result.frequency).toBe('yearly');
  });

  it('does NOT pick yearly from "billed monthly, save yearly"', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Recurring charge: $9.99 billed monthly. Switch and save 20% yearly!' }),
    );
    expect(result.frequency).toBe('monthly');
  });

  it('returns undefined frequency when there is no billing signal at all', () => {
    const result = subscriptionDetector.detectSubscription(
      email({ body: 'Your subscription renewal is confirmed. Enjoy the show.' }),
    );
    expect(result.frequency).toBeUndefined();
  });
});
```
- [ ] Run `npx vitest run src/__tests__/phase-9/subscriptionDetector.billing.test.ts`. EXPECT failures: footer `$0.00` wins / `yearly` mis-detected / frequency defaults to `monthly`.

### Task 10.2 — billing-anchored extractAmount + detectFrequency (GREEN)

- [ ] In `web/src/services/subscriptionDetector.ts`, replace `extractAmount` (lines 195-214) with a version that only accepts a currency value sitting within ~40 chars of a billing keyword:
```ts
  private extractAmount(text: string): { amount?: number; currency: string } {
    // Billing-context keywords that must appear NEAR the price to trust it
    const billingContext = /(?:charged?|charge|bill(?:ed|ing)?|renew(?:s|al|ed)?|recurring|payment|per\s+(?:month|year|week)|\/(?:mo|month|yr|year|wk|week))/i;

    const currencyPatterns: { symbol: string; pattern: RegExp }[] = [
      { symbol: 'USD', pattern: /\$\s*([\d,]+\.\d{2})/g },
      { symbol: 'EUR', pattern: /€\s*([\d,]+[.,]\d{2})/g },
      { symbol: 'GBP', pattern: /£\s*([\d,]+\.\d{2})/g },
      { symbol: 'JPY', pattern: /¥\s*([\d,]+)/g },
    ];

    for (const { symbol, pattern } of currencyPatterns) {
      for (const match of text.matchAll(pattern)) {
        const idx = match.index ?? 0;
        // Window of +/- 40 chars around the matched price
        const window = text.slice(Math.max(0, idx - 40), idx + match[0].length + 40);
        if (!billingContext.test(window)) continue;

        const raw = match[1].replace(/,/g, '');
        const amount = parseFloat(raw);
        if (!isNaN(amount) && amount > 0) {
          return { amount, currency: symbol };
        }
      }
    }

    return { currency: 'USD' };
  }
```
- [ ] Replace `detectFrequency` (lines 219-230) so it requires a billing signal and disambiguates competing words by anchoring frequency to a billing verb:
```ts
  private detectFrequency(text: string): Subscription['frequency'] | undefined {
    // Frequency is only trusted when tied to a billing/charge verb or a per-X phrase.
    const yearly = /(?:bill(?:ed)?|charged?|renew(?:s|al|ed)?|recurring)[^.]*?(?:yearly|annual(?:ly)?|per\s+year|\/(?:yr|year))|(?:per\s+year|\/(?:yr|year))/i;
    const weekly = /(?:bill(?:ed)?|charged?|renew(?:s|al|ed)?|recurring)[^.]*?(?:weekly|per\s+week|\/(?:wk|week))|(?:per\s+week|\/(?:wk|week))/i;
    const monthly = /(?:bill(?:ed)?|charged?|renew(?:s|al|ed)?|recurring)[^.]*?(?:monthly|per\s+month|\/(?:mo|month)|each\s+month)|(?:per\s+month|\/(?:mo|month)|each\s+month)/i;

    if (yearly.test(text)) return 'yearly';
    if (weekly.test(text)) return 'weekly';
    if (monthly.test(text)) return 'monthly';
    return undefined; // no billing signal -> unknown
  }
```
- [ ] NOTE on the "billed monthly, save yearly" case: the `monthly` regex matches `billed ... monthly` (anchored to `billed`); the `yearly` regex's billing-anchored branch requires a billing verb before `yearly` within the same sentence (`[^.]*?` stops at `.`), and "save 20% yearly" has no billing verb, so `yearly` does not fire — `monthly` wins. The standalone `per year`/`/yr` branch is intentionally narrow (explicit per-period notation only) and does not match the bare word "yearly".
- [ ] Run `npx vitest run src/__tests__/phase-9/subscriptionDetector.billing.test.ts`. EXPECT pass. If the "save yearly" case still trips, tighten the standalone branches and re-run.
- [ ] Run `npx vitest run src/__tests__/phase-9/subscriptionDetector.domain.test.ts` (no regression on Issue 5 tests).
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/subscriptionDetector.ts web/src/__tests__/phase-9/subscriptionDetector.billing.test.ts && git commit -m "subscriptionDetector: anchor amount/frequency to billing context (issue 10)"`

---

## Issue 11 — Purchase locale amount parsing (MEDIUM)

Current bug: `purchaseDetector.ts:348-364` `parseAmount`. For EUR/CHF/BRL it only treats comma as a decimal when `/,\d{2}$/` matches, so `'1.234'` (EUR thousands, no cents) stays `'1.234'` → `parseFloat` returns `1.234` instead of `1234`. Then the unconditional `cleaned.replace(/,(?=\d{3})/g, '')` leaves `'1,23'` intact → `parseFloat('1,23')` → `1` (cents dropped). Fix: decide which separator is decimal vs thousands explicitly, by locale and a last-separator heuristic, BEFORE stripping.

### Task 11.1 — locale parsing tests (RED)

- [ ] Create `web/src/__tests__/phase-9/purchaseDetector.locale.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { purchaseDetector } from '../../services/purchaseDetector';

// parseAmount is private; expose via a tiny cast to keep the test focused.
const parse = (s: string, currency: string): number =>
  (purchaseDetector as unknown as { parseAmount(s: string, c: string): number }).parseAmount(s, currency);

describe('PurchaseDetector.parseAmount locale handling (issue 11)', () => {
  it('EUR thousands with dot, no cents: 1.234 -> 1234', () => {
    expect(parse('1.234', 'EUR')).toBe(1234);
  });

  it('EUR with dot thousands and comma decimals: 1.234,56 -> 1234.56', () => {
    expect(parse('1.234,56', 'EUR')).toBe(1234.56);
  });

  it('EUR comma decimals only: 1,23 -> 1.23 (cents NOT dropped)', () => {
    expect(parse('1,23', 'EUR')).toBe(1.23);
  });

  it('EUR space thousands: 1 234,56 -> 1234.56', () => {
    expect(parse('1 234,56', 'EUR')).toBe(1234.56);
  });

  it('USD dot decimals with comma thousands: 1,234.56 -> 1234.56', () => {
    expect(parse('1,234.56', 'USD')).toBe(1234.56);
  });

  it('USD plain decimals: 42.00 -> 42', () => {
    expect(parse('42.00', 'USD')).toBe(42);
  });

  it('CHF apostrophe thousands with dot decimals: 1'234.50 -> 1234.5', () => {
    expect(parse("1'234.50", 'CHF')).toBe(1234.5);
  });
});
```
- [ ] Run `npx vitest run src/__tests__/phase-9/purchaseDetector.locale.test.ts`. EXPECT failures on the `1.234`, `1,23`, and `1 234,56` EUR cases.

### Task 11.2 — explicit separator resolution (GREEN)

- [ ] In `web/src/services/purchaseDetector.ts`, replace `parseAmount` (lines 348-364) with explicit decimal-vs-thousands resolution:
```ts
  private parseAmount(amountStr: string, currency: string): number {
    // Strip spaces (used as thousands separators in some locales) and apostrophes (CHF)
    let cleaned = amountStr.replace(/[\s']/g, '');

    const commaDecimalLocale = currency === 'EUR' || currency === 'CHF' || currency === 'BRL';
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
      // Both separators present: the LAST one is the decimal separator.
      if (lastComma > lastDot) {
        // comma is decimal, dot is thousands (e.g. 1.234,56)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
      } else {
        // dot is decimal, comma is thousands (e.g. 1,234.56)
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      // Only commas present.
      const tail = cleaned.slice(lastComma + 1);
      // Treat as decimal if 1-2 trailing digits AND (comma-decimal locale OR exactly one comma)
      const oneComma = cleaned.indexOf(',') === lastComma;
      if (tail.length >= 1 && tail.length <= 2 && (commaDecimalLocale || oneComma)) {
        cleaned = cleaned.replace(',', '.');
      } else {
        // comma(s) are thousands separators
        cleaned = cleaned.replace(/,/g, '');
      }
    } else if (lastDot !== -1) {
      // Only dots present.
      const tail = cleaned.slice(lastDot + 1);
      const oneDot = cleaned.indexOf('.') === lastDot;
      // In comma-decimal locales a lone dot is a thousands separator (1.234 -> 1234),
      // UNLESS it clearly looks like cents in a non-comma locale.
      if (commaDecimalLocale) {
        // dot is thousands -> drop it (1.234 -> 1234, 1.234.567 -> 1234567)
        cleaned = cleaned.replace(/\./g, '');
      } else if (!(tail.length >= 1 && tail.length <= 2 && oneDot)) {
        // non-comma locale but dot is grouping (e.g. 1.234.567)
        cleaned = cleaned.replace(/\./g, '');
      }
      // else: dot is the decimal point, leave as-is
    }

    const amount = parseFloat(cleaned);
    return isNaN(amount) ? 0 : amount;
  }
```
- [ ] NOTE: the `2 cents` heuristic intentionally keeps `42.00` (USD) and `1.23` decimal; `1.234` in EUR is grouping per the comma-decimal-locale branch. Verify against the test fixtures, not intuition.
- [ ] Run `npx vitest run src/__tests__/phase-9/purchaseDetector.locale.test.ts`. EXPECT pass.
- [ ] Run `npx vitest run src/__tests__/phase-9/purchaseDetector.domain.test.ts` (no regression).
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/purchaseDetector.ts web/src/__tests__/phase-9/purchaseDetector.locale.test.ts && git commit -m "purchaseDetector: explicit locale decimal/thousands parsing (issue 11)"`

---

## Issue 16 — Threading fallback key collisions (MEDIUM)

Current bug: `threadingService.ts:67` keys threadless emails purely by `subject:<normalized-subject>`. Two different senders both emailing `Invoice` / `Receipt` / `Your order` collapse into one thread. The docstring (lines 9-11) claims participant overlap as step 3, but it is unimplemented. Fix: when falling back to subject, fold the sender domain into the key so different senders stay separate; additionally, very short / generic subjects should not group across senders.

### Task 16.1 — fallback collision tests (RED)

- [ ] Create `web/src/__tests__/phase-9/threadingService.fallback.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { threadingService } from '../../services/threadingService';
import type { Email } from '../../types';

const mk = (overrides: Partial<Email> = {}): Email => ({
  id: Math.floor(Math.random() * 100000),
  subject: 'Invoice',
  sender: 'billing@acme.com',
  recipients: ['me@example.com'],
  date: new Date(),
  body: 'body',
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
  ...overrides,
});

describe('ThreadingService fallback key (issue 16)', () => {
  it('does NOT merge identical generic subjects from different sender domains', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'billing@acme.com' }),
      mk({ id: 2, subject: 'Invoice', sender: 'no-reply@globex.com' }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(2);
  });

  it('still merges same generic subject from the SAME sender domain', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'billing@acme.com', date: new Date('2024-01-01') }),
      mk({ id: 2, subject: 'Re: Invoice', sender: 'accounts@acme.com', date: new Date('2024-01-02') }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(2);
  });

  it('still respects explicit threadId regardless of subject/sender', () => {
    const emails = [
      mk({ id: 1, subject: 'Invoice', sender: 'a@acme.com', threadId: 'thread-1' }),
      mk({ id: 2, subject: 'Receipt', sender: 'b@globex.com', threadId: 'thread-1' }),
    ];
    const threads = threadingService.buildThreads(emails);
    expect(threads).toHaveLength(1);
    expect(threads[0].messageCount).toBe(2);
  });
});
```
- [ ] Run `npx vitest run src/__tests__/phase-9/threadingService.fallback.test.ts`. EXPECT failure on the first case (two `Invoice` emails currently collapse to one thread).

### Task 16.2 — sender-domain-scoped fallback key (GREEN)

- [ ] In `web/src/services/threadingService.ts`, add the domain import at line 2:
```ts
import { normalizeSubject } from '../utils/emailUtils';
import { extractDomain } from '../utils/emailUtils';
```
- [ ] Replace the fallback portion of `getThreadKey` (lines 58-68) so the subject key is scoped by sender domain:
```ts
    // Fallback: Normalize subject for thread matching (for legacy emails without threadId)
    const normalizedSubject = normalizeSubject(email.subject);

    // Empty subjects get unique keys
    if (!normalizedSubject) {
      return `single:${email.id || Math.random()}`;
    }

    // Scope the subject key by sender domain so identical generic subjects
    // ('Invoice', 'Receipt', 'Your order') from different senders do not merge.
    const domain = extractDomain(email.sender) || 'unknown';
    const subjectSlug = normalizedSubject.toLowerCase().replace(/\s+/g, '-');
    return `subject:${domain}:${subjectSlug}`;
```
- [ ] NOTE: the existing phase-2 test "should group emails with same normalized subject" uses the SAME sender (`sender@example.com` default), so it still groups — verify by running phase-2 below. The "different subjects in separate threads" test also stays correct.
- [ ] Run `npx vitest run src/__tests__/phase-9/threadingService.fallback.test.ts`. EXPECT pass.
- [ ] Run `npx vitest run src/__tests__/phase-2/threadingService.test.ts`. EXPECT pass (no regression).
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/threadingService.ts web/src/__tests__/phase-9/threadingService.fallback.test.ts && git commit -m "threadingService: scope fallback thread key by sender domain (issue 16)"`

---

## Issue 12 — Custom-rule regex DoS (MEDIUM)

Current bug: `customRulesEngine.ts:153-159` compiles user-supplied `condition.value` as a RegExp and runs `regex.test(fieldValue)` against full `email.body` per email. A pathological pattern like `(a+)+$` against a long body causes catastrophic backtracking and freezes the tab. Fix (simple, synchronous): bound the matched input length by slicing to a few KB before testing. Keep the existing try/catch for invalid patterns.

### Task 12.1 — bounded-input regex test (RED)

- [ ] Create `web/src/__tests__/phase-9/customRulesEngine.regex.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { Email, RuleCondition } from '../../types';
import { customRulesEngine } from '../../services/customRulesEngine';

const mk = (body: string): Email => ({
  id: 1,
  subject: 'subj',
  sender: 'a@example.com',
  recipients: ['me@example.com'],
  date: new Date(),
  body,
  attachments: [],
  size: 1024,
  isRead: false,
  isStarred: false,
  folderId: 'inbox',
  emailType: 'regular',
});

describe('customRulesEngine regex safety (issue 12)', () => {
  it('returns quickly for a catastrophic-backtracking pattern against a long body', () => {
    const body = 'a'.repeat(50000) + '!';
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: '(a+)+$',
      caseSensitive: false,
    } as RuleCondition;

    const start = Date.now();
    const result = customRulesEngine.matchesCondition(mk(body), condition);
    const elapsed = Date.now() - start;

    expect(typeof result).toBe('boolean');
    expect(elapsed).toBeLessThan(1000); // must not hang
  });

  it('still matches a normal regex within the bounded window', () => {
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: 'hello',
      caseSensitive: false,
    } as RuleCondition;
    expect(customRulesEngine.matchesCondition(mk('say hello world'), condition)).toBe(true);
  });

  it('returns false for an invalid regex pattern', () => {
    const condition: RuleCondition = {
      field: 'body',
      operator: 'regex',
      value: '(',
      caseSensitive: false,
    } as RuleCondition;
    expect(customRulesEngine.matchesCondition(mk('anything'), condition)).toBe(false);
  });
});
```
- [ ] NOTE: confirm `RuleCondition`'s exact field names (`field`, `operator`, `value`, `caseSensitive`) by reading `web/src/types/index.ts` before running; adjust the cast/shape if they differ. The hang test must FAIL today (it will exceed 1000ms because `(a+)+$` backtracks on 50k `a`s).
- [ ] Run `npx vitest run src/__tests__/phase-9/customRulesEngine.regex.test.ts`. EXPECT the hang test to fail (timeout/slow).

### Task 12.2 — bound input length before matching (GREEN)

- [ ] In `web/src/services/customRulesEngine.ts`, replace the `case 'regex':` block (lines 153-160) so the tested input is sliced to a bounded window:
```ts
      case 'regex':
        try {
          const flags = condition.caseSensitive ? '' : 'i';
          const regex = new RegExp(condition.value, flags);
          // Bound input length to avoid catastrophic backtracking freezing the tab.
          const MAX_REGEX_INPUT = 4096;
          const boundedValue =
            fieldValue.length > MAX_REGEX_INPUT
              ? fieldValue.slice(0, MAX_REGEX_INPUT)
              : fieldValue;
          return regex.test(boundedValue);
        } catch {
          return false;
        }
```
- [ ] NOTE: `(a+)+$` is anchored to end-of-string, so truncating to 4096 chars makes the `$` fail fast (the 4096th char is still `a`, mismatch found in linear time). This is the intended bound; do not add a worker.
- [ ] Run `npx vitest run src/__tests__/phase-9/customRulesEngine.regex.test.ts`. EXPECT pass.
- [ ] `npm run lint`.
- [ ] Commit: `git add web/src/services/customRulesEngine.ts web/src/__tests__/phase-9/customRulesEngine.regex.test.ts && git commit -m "customRulesEngine: bound regex input length to prevent backtracking DoS (issue 12)"`

---

## Final verification

- [ ] From `web/`: `npm run test:run` — ALL suites pass (phase-1, -2, -3, -7, -8, -9).
- [ ] From `web/`: `npm run lint` — no new errors.
- [ ] From `web/`: `npm run build` — TypeScript check + production build succeed (validates `domainMatch.ts` types and the new imports).
- [ ] Confirm `git log --oneline -8` shows the seven feature commits and the helper commit, each with an allowed author email (`git log -1 --format='%ae'`).
- [ ] Sanity-check the DRY goal: `accountDetector.ts`, `purchaseDetector.ts`, and `subscriptionDetector.ts` all import `isDomainMatch` from `./domainMatch` and contain NO remaining `domain.includes(` substring-matching loop for known service/merchant lookup.
