# Bucket E: Backup & Restore Robustness

## Goal

Make backup import **atomic and validated**, and make the import UI **re-importable**.

Concretely, three defects are fixed:

1. **(HIGH) Non-atomic import.** `backupService.importBackup` (`web/src/services/backupService.ts:253-386`) performs **8 sequential `bulkPut` calls** (emails `:300`, accounts `:311`, purchases `:322`, contacts `:333`, calendarEvents `:345`, folders `:356`, subscriptions `:369`, newsletters `:380`) with **no enclosing `db.transaction()`**. A failure partway through (e.g. a malformed record on the 5th table) leaves the DB half-imported — earlier tables committed, later ones not.
2. **(HIGH) No version / record validation.** `importBackup` never checks `metadata.version` against `BACKUP_VERSION` (`:51`, value `'1.0.0'`). It also casts arbitrary parsed JSON straight to DB rows; `new Date(x).getTime()` on a bad value yields `NaN`, and a `NaN` in an indexed date column breaks ordered reads (`db.emails.orderBy('date')` etc.).
3. **(LOW/MEDIUM) Import `<input>` not reset.** `BackupPage.tsx:271-280` never clears `e.target.value` after handling a file, so selecting the **same file twice** does not re-fire `onChange` (the import silently does nothing). `FileDropzone.tsx:57` already does the correct `e.target.value = ''` reset.

Additionally, two DB helpers that perform multi-step writes are wrapped in transactions for consistency:
- `deleteFolder` (`web/src/db/database.ts:425-430`) reassigns emails one-by-one then deletes the folder — a mid-operation failure orphans emails or leaves a stale folder.
- `clearAllData` (`web/src/db/database.ts:540-551`) clears 8 tables via `Promise.all` — not transactional.

## Architecture

- **Storage:** Dexie 4 (`web/src/db/database.ts`) wrapping IndexedDB. Single `db` instance (`EmailAnalyzerDB`, `:107`). Tables: `emails`, `accounts`, `purchases`, `contacts`, `calendarEvents`, `folders`, `subscriptions`, `newsletters` (declared `:52-59`, current schema is `version(4)` `:93-102`). Dates stored as numeric timestamps; `*ToX` mappers convert back to `Date` on read.
- **Backup service:** `web/src/services/backupService.ts` — singleton `backupService`. `exportBackup` (`:56`) writes a JSZip of `metadata.json` + per-table `.json`/`.enc` files. `importBackup` (`:253`) reads them back. `BACKUP_VERSION = '1.0.0'` (`:51`).
- **UI:** `web/src/pages/BackupPage.tsx` — `handleImport` (`:63`) calls `backupService.importBackup` and surfaces failures via the page's **own local `error` state** (`setError`, `:23`, rendered `:136-141`). This bucket does **not** depend on any global Toast component.
- **Dexie transaction semantics:** `db.transaction('rw', [tables], async () => {...})` commits atomically; throwing anywhere inside aborts and rolls back **all** writes in that scope. The callback must `await` every table op so Dexie keeps the transaction open. (`bulkPut` inside a transaction participates automatically.)

## Tech Stack

- Vite + React + TypeScript (strict), browser-only.
- **Tests:** Vitest 4 + jsdom + `fake-indexeddb/auto` (real IndexedDB semantics in tests, incl. transaction rollback) + localStorage mock. Setup in `web/src/__tests__/setup.ts`.
- Test location: `web/src/__tests__/phase-N/`. New tests go in **`web/src/__tests__/phase-9/`**; the existing round-trip/import tests in `web/src/__tests__/phase-7/backupService.test.ts` are extended where natural.
- Commands (run from `web/`): `npm run test:run`, `npm run lint`, `npm run build`.

## For agentic workers

Execute this plan using **superpowers:subagent-driven-development**. Work strictly top-to-bottom, one `- [ ]` task at a time, TDD throughout: write the failing test first, run it to confirm it fails for the expected reason, then write the minimal implementation to make it pass, then re-run. Do not batch multiple tasks before running tests. Every code block below is **real, paste-ready code** — no placeholders. Use the exact table names and paths shown. Commit after each coherent green step with normal `git commit` (no `--no-verify`, no author env vars).

---

## File Structure

```
web/src/
├── services/
│   └── backupService.ts          # MODIFY: validateMetadata + sanitize + transactional importBackup
├── db/
│   └── database.ts               # MODIFY: deleteFolder + clearAllData wrapped in db.transaction
├── pages/
│   └── BackupPage.tsx            # MODIFY: reset file <input> value after handling (line ~275)
└── __tests__/
    ├── phase-7/
    │   └── backupService.test.ts # EXISTING: still must pass (round-trip already covered :165-207)
    └── phase-9/                  # NEW DIR
        ├── backupImportAtomic.test.ts     # NEW: rollback, version reject, NaN-date reject, round-trip
        └── databaseTransactions.test.ts   # NEW: deleteFolder + clearAllData consistency
```

---

## Tasks

### Task 1 — Create phase-9 directory and a sanity test

- [ ] Create the directory `web/src/__tests__/phase-9/`.
- [ ] Create `web/src/__tests__/phase-9/backupImportAtomic.test.ts` with the scaffold below and run `npm run test:run -- phase-9` to confirm the harness picks it up (fake-indexeddb is auto-loaded via `setup.ts`).

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { backupService } from '../../services/backupService';
import { db } from '../../db/database';

// Build a backup zip in-memory matching exportBackup's plain-JSON layout.
async function makeBackupZip(parts: {
  version?: string;
  encrypted?: boolean;
  emails?: unknown[];
  accounts?: unknown[];
  contacts?: unknown[];
}): Promise<File> {
  const zip = new JSZip();
  const metadata = {
    version: parts.version ?? '1.0.0',
    createdAt: new Date().toISOString(),
    emailCount: parts.emails?.length ?? 0,
    accountCount: parts.accounts?.length ?? 0,
    purchaseCount: 0,
    contactCount: parts.contacts?.length ?? 0,
    calendarEventCount: 0,
    folderCount: 0,
    subscriptionCount: 0,
    newsletterCount: 0,
    encrypted: parts.encrypted ?? false,
  };
  zip.file('metadata.json', JSON.stringify(metadata));
  if (parts.emails) zip.file('emails.json', JSON.stringify(parts.emails));
  if (parts.accounts) zip.file('accounts.json', JSON.stringify(parts.accounts));
  if (parts.contacts) zip.file('contacts.json', JSON.stringify(parts.contacts));
  const blob = await zip.generateAsync({ type: 'blob' });
  return new File([blob], 'backup.zip');
}

describe('importBackup robustness (phase-9)', () => {
  beforeEach(async () => {
    await db.emails.clear();
    await db.accounts.clear();
    await db.purchases.clear();
    await db.contacts.clear();
    await db.calendarEvents.clear();
    await db.folders.clear();
    await db.subscriptions.clear();
    await db.newsletters.clear();
  });

  it('scaffold builds a valid backup file', async () => {
    const file = await makeBackupZip({ emails: [] });
    const meta = await backupService.getBackupInfo(file);
    expect(meta.version).toBe('1.0.0');
  });
});
```

### Task 2 — TEST: reject a backup with a mismatched `metadata.version`

- [ ] Add this test to `backupImportAtomic.test.ts`. Run it; it MUST fail (current `importBackup` ignores version).

```ts
  it('rejects a backup whose metadata.version does not match BACKUP_VERSION', async () => {
    const file = await makeBackupZip({
      version: '0.9.0',
      emails: [
        {
          subject: 'X',
          sender: 'a@b.com',
          recipients: [],
          date: new Date().toISOString(),
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow(/version/i);
    // Nothing should have been written.
    expect(await db.emails.count()).toBe(0);
  });
```

### Task 3 — IMPL: validate `metadata.version` in `importBackup`

- [ ] In `web/src/services/backupService.ts`, add a private validator and call it right after metadata is parsed. Locate the existing block (`:267-269`):

```ts
    const metadata: BackupMetadata = JSON.parse(await metadataFile.async('string'));

    onProgress?.(10, 'Validating backup...');
```

Insert a version check immediately after the `JSON.parse` line so it runs before any encryption check or writes:

```ts
    const metadata: BackupMetadata = JSON.parse(await metadataFile.async('string'));

    onProgress?.(10, 'Validating backup...');

    this.validateMetadata(metadata);
```

- [ ] Add the `validateMetadata` method to the `BackupService` class (place it just below the `importBackup` method, before `getBackupInfo`):

```ts
  /**
   * Validate backup metadata. Throws if the backup version is incompatible.
   */
  private validateMetadata(metadata: BackupMetadata): void {
    if (!metadata || typeof metadata.version !== 'string') {
      throw new Error('Invalid backup file: missing or malformed metadata version');
    }
    if (metadata.version !== this.BACKUP_VERSION) {
      throw new Error(
        `Incompatible backup version "${metadata.version}". This app supports version ${this.BACKUP_VERSION}.`
      );
    }
  }
```

- [ ] Run `npm run test:run -- phase-9`. Task 2's test passes. Re-run phase-7 (`npm run test:run -- phase-7`) to confirm existing round-trip still passes (exports always write the current version, so they remain compatible).

### Task 4 — TEST: reject records with invalid (NaN) dates

- [ ] Add this test. It MUST fail today (a string like `'not-a-date'` yields `new Date('not-a-date').getTime() === NaN`, which currently reaches `bulkPut`).

```ts
  it('rejects a backup containing an unparseable date (no NaN reaches the DB)', async () => {
    const file = await makeBackupZip({
      emails: [
        {
          subject: 'Bad date',
          sender: 'a@b.com',
          recipients: [],
          date: 'not-a-date',
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow(/invalid date/i);
    expect(await db.emails.count()).toBe(0);
  });
```

### Task 5 — IMPL: add a date-sanitizing helper

- [ ] In `web/src/services/backupService.ts`, add a private helper that converts any incoming date value to a timestamp and throws on `NaN`. Place it next to `validateMetadata`:

```ts
  /**
   * Convert an incoming date value (ISO string, number, or Date) to a numeric
   * timestamp. Throws if the result is not a finite number so that no NaN
   * timestamp is ever written to an indexed date column.
   */
  private toTimestamp(value: unknown, field: string): number {
    const ms = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
    if (!Number.isFinite(ms)) {
      throw new Error(`Invalid date in backup (field "${field}"): ${String(value)}`);
    }
    return ms;
  }
```

- [ ] Do **not** wire it in yet — Task 7 replaces all the inline `new Date(...).getTime()` calls when the transaction is added. Run `npm run test:run -- phase-9`; Task 4 still fails (expected — helper exists but is unused). Run `npm run lint` to confirm the unused-private-method does not error (TS `noUnusedLocals` does not flag class members; if lint complains, proceed directly to Task 7 in the same change).

> Note for the worker: if your lint config flags the unused private method, merge Task 5 and Task 7 into a single edit so the helper is used immediately.

### Task 6 — TEST: a mid-import failure rolls back ALL tables

- [ ] Add this test. It seeds **valid** emails plus a **valid** accounts array, but the **contacts** array contains one record with a bad date. Because emails/accounts import before contacts in the current order, a non-atomic import would commit emails+accounts then throw on contacts. The atomic version must leave **everything** empty. MUST fail today.

```ts
  it('rolls back all tables when one record fails mid-import', async () => {
    const file = await makeBackupZip({
      emails: [
        {
          subject: 'Good email',
          sender: 'a@b.com',
          recipients: [],
          date: new Date().toISOString(),
          body: '',
          attachments: [],
          size: 0,
          isRead: false,
          isStarred: false,
          folderId: 'inbox',
          emailType: 'regular',
        },
      ],
      accounts: [
        {
          serviceName: 'GoodService',
          serviceType: 'other',
          domain: 'b.com',
          email: 'a@b.com',
          signupDate: new Date().toISOString(),
          emailIds: [],
        },
      ],
      // contacts import AFTER emails+accounts and contains a poison record
      contacts: [
        {
          name: 'Bad contact',
          email: 'c@d.com',
          emailCount: 1,
          lastEmailDate: 'totally-invalid',
        },
      ],
    });

    await expect(backupService.importBackup(file)).rejects.toThrow();

    // Atomic: the earlier (valid) emails and accounts must NOT have been committed.
    expect(await db.emails.count()).toBe(0);
    expect(await db.accounts.count()).toBe(0);
    expect(await db.contacts.count()).toBe(0);
  });
```

### Task 7 — IMPL: wrap all import writes in a single transaction + sanitize every date

- [ ] Replace the entire body from the comment `// Import emails` (`:292`) through the final `onProgress?.(100, 'Import complete!');` line (`:383`) — i.e. all 8 read/map/bulkPut blocks — with the version below. Key points: all `readAndParse` calls happen **before** the transaction (JSZip/decrypt are async I/O and must not run inside a Dexie `rw` transaction, which only allows DB ops); mapping + `bulkPut` happen **inside** `db.transaction`; every date goes through `this.toTimestamp`.

```ts
    // Read & decrypt everything up front (no async non-DB work allowed inside a Dexie tx).
    onProgress?.(20, 'Reading backup contents...');
    const emails = await readAndParse<Email>('emails');
    const accounts = await readAndParse<Account>('accounts');
    const purchases = await readAndParse<Purchase>('purchases');
    const contacts = await readAndParse<Contact>('contacts');
    const calendarEvents = await readAndParse<CalendarEvent>('calendar-events');
    const folders = await readAndParse<Folder>('folders');
    const subscriptions = await readAndParse<Subscription>('subscriptions');
    const newsletters = await readAndParse<Newsletter>('newsletters');

    // Map + validate dates BEFORE the transaction so any NaN throws without
    // touching the DB. toTimestamp throws on unparseable values.
    onProgress?.(40, 'Validating records...');

    const dbEmails: DBEmail[] | null = emails && emails.length > 0
      ? (emails.map((e) => ({ ...e, date: this.toTimestamp(e.date, 'email.date') })) as DBEmail[])
      : null;

    const dbAccounts: DBAccount[] | null = accounts && accounts.length > 0
      ? (accounts.map((a) => ({
          ...a,
          signupDate: this.toTimestamp(a.signupDate, 'account.signupDate'),
          lastActivityDate: a.lastActivityDate
            ? this.toTimestamp(a.lastActivityDate, 'account.lastActivityDate')
            : undefined,
        })) as unknown as DBAccount[])
      : null;

    const dbPurchases: DBPurchase[] | null = purchases && purchases.length > 0
      ? (purchases.map((p) => ({
          ...p,
          purchaseDate: this.toTimestamp(p.purchaseDate, 'purchase.purchaseDate'),
        })) as DBPurchase[])
      : null;

    const dbContacts: DBContact[] | null = contacts && contacts.length > 0
      ? (contacts.map((c) => ({
          ...c,
          lastEmailDate: this.toTimestamp(c.lastEmailDate, 'contact.lastEmailDate'),
        })) as DBContact[])
      : null;

    const dbEvents: DBCalendarEvent[] | null = calendarEvents && calendarEvents.length > 0
      ? (calendarEvents.map((e) => ({
          ...e,
          startDate: this.toTimestamp(e.startDate, 'calendarEvent.startDate'),
          endDate: this.toTimestamp(e.endDate, 'calendarEvent.endDate'),
        })) as DBCalendarEvent[])
      : null;

    const dbFolders: DBFolder[] | null = folders && folders.length > 0
      ? (folders.map((f) => ({
          ...f,
          createdAt: this.toTimestamp(f.createdAt, 'folder.createdAt'),
        })) as DBFolder[])
      : null;

    const dbSubscriptions: DBSubscription[] | null = subscriptions && subscriptions.length > 0
      ? (subscriptions.map((s) => ({
          ...s,
          lastRenewalDate: this.toTimestamp(s.lastRenewalDate, 'subscription.lastRenewalDate'),
          nextRenewalDate: s.nextRenewalDate
            ? this.toTimestamp(s.nextRenewalDate, 'subscription.nextRenewalDate')
            : undefined,
          emailIds: JSON.stringify(s.emailIds || []),
        })) as unknown as DBSubscription[])
      : null;

    const dbNewsletters: DBNewsletter[] | null = newsletters && newsletters.length > 0
      ? (newsletters.map((n) => ({
          ...n,
          lastEmailDate: this.toTimestamp(n.lastEmailDate, 'newsletter.lastEmailDate'),
        })) as DBNewsletter[])
      : null;

    // Atomic write: any throw inside aborts and rolls back ALL tables.
    onProgress?.(70, 'Writing to database...');
    await db.transaction(
      'rw',
      [
        db.emails,
        db.accounts,
        db.purchases,
        db.contacts,
        db.calendarEvents,
        db.folders,
        db.subscriptions,
        db.newsletters,
      ],
      async () => {
        if (dbEmails) await db.emails.bulkPut(dbEmails);
        if (dbAccounts) await db.accounts.bulkPut(dbAccounts);
        if (dbPurchases) await db.purchases.bulkPut(dbPurchases);
        if (dbContacts) await db.contacts.bulkPut(dbContacts);
        if (dbEvents) await db.calendarEvents.bulkPut(dbEvents);
        if (dbFolders) await db.folders.bulkPut(dbFolders);
        if (dbSubscriptions) await db.subscriptions.bulkPut(dbSubscriptions);
        if (dbNewsletters) await db.newsletters.bulkPut(dbNewsletters);
      }
    );

    onProgress?.(100, 'Import complete!');
```

- [ ] The mapping/validation runs **before** `db.transaction`, so Task 4's and Task 6's poison records throw before (or during) writes and nothing partial is committed. (Even if a bad date slipped to inside the tx, the throw would still roll back.) Run `npm run test:run -- phase-9` — Tasks 4 and 6 now pass.
- [ ] Run `npm run test:run -- phase-7` — the existing round-trip import test (`:165-207`) and progress test (`:209-229`) still pass.

### Task 8 — TEST: full export → import round-trip preserves data

- [ ] Add this round-trip test to `backupImportAtomic.test.ts` (covers more tables than the phase-7 single-email case, and confirms dates survive as valid `Date`s on read via the DB mappers).

```ts
  it('round-trips export -> import with multiple tables intact', async () => {
    const now = Date.now();
    await db.emails.add({
      subject: 'Roundtrip',
      sender: 'a@b.com',
      recipients: ['r@b.com'],
      date: now,
      body: 'hi',
      attachments: [],
      size: 10,
      isRead: true,
      isStarred: false,
      folderId: 'inbox',
      emailType: 'regular',
    } as Parameters<typeof db.emails.add>[0]);
    await db.contacts.add({
      name: 'Alice',
      email: 'a@b.com',
      emailCount: 1,
      lastEmailDate: now,
    } as Parameters<typeof db.contacts.add>[0]);

    const blob = await backupService.exportBackup({
      includeEmails: true,
      includeAccounts: false,
      includePurchases: false,
      includeContacts: true,
      includeCalendarEvents: false,
      includeFolders: false,
      includeSubscriptions: false,
      includeNewsletters: false,
      encrypt: false,
    });

    await db.emails.clear();
    await db.contacts.clear();

    const file = new File([blob], 'backup.zip');
    const meta = await backupService.importBackup(file);

    expect(meta.version).toBe('1.0.0');
    expect(await db.emails.count()).toBe(1);
    expect(await db.contacts.count()).toBe(1);

    const [email] = await db.emails.toArray();
    expect(email.subject).toBe('Roundtrip');
    expect(Number.isFinite(email.date)).toBe(true);
    expect(email.date).toBe(now);

    const [contact] = await db.contacts.toArray();
    expect(contact.name).toBe('Alice');
    expect(Number.isFinite(contact.lastEmailDate)).toBe(true);
  });
```

- [ ] Run `npm run test:run -- phase-9`. All four behavior tests (version reject, NaN reject, rollback, round-trip) pass.

### Task 9 — TEST: `deleteFolder` and `clearAllData` consistency

- [ ] Create `web/src/__tests__/phase-9/databaseTransactions.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db, deleteFolder, clearAllData } from '../../db/database';
import { SYSTEM_FOLDERS } from '../../types';

describe('database transactional helpers (phase-9)', () => {
  beforeEach(async () => {
    await db.emails.clear();
    await db.folders.clear();
  });

  it('deleteFolder moves all emails to inbox and removes the folder', async () => {
    await db.folders.add({
      id: 'custom',
      name: 'Custom',
      isSystem: false,
      createdAt: Date.now(),
    } as Parameters<typeof db.folders.add>[0]);

    await db.emails.bulkAdd([
      {
        subject: 'A', sender: 's@x.com', recipients: [], date: Date.now(),
        body: '', attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'custom', emailType: 'regular',
      },
      {
        subject: 'B', sender: 's@x.com', recipients: [], date: Date.now(),
        body: '', attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'custom', emailType: 'regular',
      },
    ] as Parameters<typeof db.emails.bulkAdd>[0]);

    await deleteFolder('custom');

    expect(await db.folders.get('custom')).toBeUndefined();
    expect(await db.emails.where('folderId').equals('custom').count()).toBe(0);
    expect(await db.emails.where('folderId').equals(SYSTEM_FOLDERS.INBOX).count()).toBe(2);
  });

  it('clearAllData empties every table', async () => {
    await db.emails.add({
      subject: 'A', sender: 's@x.com', recipients: [], date: Date.now(),
      body: '', attachments: [], size: 0, isRead: false, isStarred: false,
      folderId: 'inbox', emailType: 'regular',
    } as Parameters<typeof db.emails.add>[0]);
    await db.folders.add({
      id: 'custom', name: 'Custom', isSystem: false, createdAt: Date.now(),
    } as Parameters<typeof db.folders.add>[0]);

    await clearAllData();

    expect(await db.emails.count()).toBe(0);
    expect(await db.folders.count()).toBe(0);
  });
});
```

- [ ] Run `npm run test:run -- phase-9`. Both tests should PASS even against the current implementation (they assert the correct end-state). They lock in behavior before refactoring to transactions in Task 10.

### Task 10 — IMPL: wrap `deleteFolder` and `clearAllData` in transactions

- [ ] In `web/src/db/database.ts`, replace `deleteFolder` (`:425-430`):

```ts
export const deleteFolder = async (id: string): Promise<void> => {
  // Move all emails from this folder back to inbox, then delete the folder —
  // atomically, so a failure cannot orphan emails or leave a stale folder.
  await db.transaction('rw', [db.emails, db.folders], async () => {
    const emails = await db.emails.where('folderId').equals(id).toArray();
    await Promise.all(
      emails.map((e) => db.emails.update(e.id, { folderId: SYSTEM_FOLDERS.INBOX }))
    );
    await db.folders.delete(id);
  });
};
```

- [ ] Replace `clearAllData` (`:540-551`):

```ts
export const clearAllData = async (): Promise<void> => {
  await db.transaction(
    'rw',
    [
      db.emails,
      db.accounts,
      db.purchases,
      db.contacts,
      db.calendarEvents,
      db.folders,
      db.subscriptions,
      db.newsletters,
    ],
    async () => {
      await Promise.all([
        db.emails.clear(),
        db.accounts.clear(),
        db.purchases.clear(),
        db.contacts.clear(),
        db.calendarEvents.clear(),
        db.folders.clear(),
        db.subscriptions.clear(),
        db.newsletters.clear(),
      ]);
    }
  );
};
```

> Note: `backupService.clearAllData` (`backupService.ts:420-429`) is a separate copy that calls each table's `.clear()` sequentially. For consistency, optionally also wrap it the same way. Leave it as-is if you prefer the DB-layer `clearAllData` to be the single source of truth, but do not regress the phase-7 `clearAllData` test (`:232-267`).

- [ ] Run `npm run test:run -- phase-9` — Task 9's tests still pass against the transactional versions.
- [ ] Run the full suite `npm run test:run` to confirm no regressions across phases 1-3, 7, 8.

### Task 11 — IMPL: reset the import file `<input>` so the same file re-imports

- [ ] In `web/src/pages/BackupPage.tsx`, replace the `onChange` handler on the import `<input>` (`:275-278`) so it clears the value after handling, matching `FileDropzone.tsx:57`:

```tsx
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                // Reset so selecting the same file again re-fires onChange.
                e.target.value = '';
              }}
```

- [ ] Manual verification step (documented; no DOM test required since this is a one-line browser-input fix): run `npm run dev`, go to Backup & Security → Import, select a backup file, then select the **exact same file** again — the second selection must re-trigger the import (progress/message updates again) instead of silently doing nothing.

### Task 11.5 — Back up & restore the `emailBodies` table (Bucket D reconciliation — CRITICAL)

> **Why:** Bucket D split email `body`/`htmlBody`/attachment base64 `data` out of the `emails` rows into a
> new `emailBodies` table (keyed by email id; type `EmailBodyRecord` in `types/index.ts`). `exportBackup`
> currently reads only `db.emails.toArray()` (now body-less) and `importBackup` only writes `db.emails`,
> so a backup taken after the v5 migration **loses all email body text and attachment data on restore**.
> This task makes backups complete again. The `searchText` field lives ON the slim email row, so it is
> already exported with the email; no extra work for searchText beyond confirming it round-trips.

- [ ] **TEST (RED):** Add a round-trip body-integrity test (extend the Task 8 round-trip test or add a new
  one in the phase-9 backup test file). Use the split-aware `bulkInsertEmails` (or `insertEmail`) to insert
  an email WITH a body + an attachment with base64 `data`, so the body lands in `emailBodies`. Export, then
  `clearAllData`, then import the exported blob. Assert: `await getEmailBody(id)` returns the ORIGINAL
  `body`/`htmlBody`, and the attachment base64 `data` is restored. Confirm this FAILS before the impl below
  (export omits emailBodies → restored body is empty).
- [ ] **IMPL — export:** In `web/src/services/backupService.ts` `exportBackup`, also read
  `await db.emailBodies.toArray()` and include it in the exported payload (add an `emailBodies` array to the
  export object and its metadata counts). Read `database.ts` `exportAllData`/`ExportData` if the export shape
  is centralized there and extend that type too.
- [ ] **IMPL — import:** In `importBackup`, inside the SAME `db.transaction('rw', ...)` from Task 7, add
  `db.emailBodies` to the transaction's table list and `await db.emailBodies.bulkPut(...)` the imported
  `emailBodies` records (guard for older backups that lack the field — default to `[]`). Bump
  `BACKUP_VERSION` if the schema shape changed, and ensure the Task 3 version check still accepts current
  backups (decide: accept the new version; optionally still import older 1.0.0 backups that have bodies on
  the email rows — if you do, document it).
- [ ] **IMPL — clearAllData:** ensure `emailBodies` is also cleared (Task 10's transactional `clearAllData`
  must include `db.emailBodies`).
- [ ] Run the new round-trip body test + `npm run test:run` (all green) + `npm run build` + `npm run lint`.
- [ ] Commit: `git commit -m "fix(backup): export/restore emailBodies so bodies survive backup round-trip (D reconciliation)"`

### Task 12 — Full verification

- [ ] From `web/`, run all three gates and confirm each is clean:

```bash
npm run test:run && npm run lint && npm run build
```

- [ ] Confirm: all phase-7 and phase-9 backup tests green, no new lint errors, TypeScript build passes (the `as unknown as` casts on accounts/subscriptions mirror the original code and keep strict mode happy).
- [ ] Commit with a normal message (no `--no-verify`, no author env vars), e.g. `feat(backup): atomic+validated import, transactional db helpers, re-importable input`.
