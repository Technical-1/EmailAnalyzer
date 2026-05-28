# Bucket D — Data loading & rendering performance

## Goal

Stop loading the entire archive into memory at app init, and stop doing O(n) work
per row render and per single-row mutation. Concretely:

1. **Issue 8 (init memory):** `initialize()` / `refreshAll()` call `getEmails()`, which
   does `db.emails.orderBy('date').reverse().toArray()` (database.ts:118-121) — pulling
   every email's full `body`, `htmlBody`, and base64 `attachments[].data` into the Zustand
   store. `getEmailHeaders()` (database.ts:185-193) exists but (a) is unused at init and
   (b) still loads bodies, because Dexie `.toArray()` returns whole rows and the body is
   only stripped afterward in JS. Fix by physically splitting body/html/attachment-blobs
   into a separate `emailBodies` Dexie table (`version(5)` migration) so header rows are
   small, and load headers at init + fetch bodies on demand.

2. **Issue 9 (per-row strip):** `EmailCard.tsx:132-133` and `ThreadView.tsx:71,164,229-234`
   call `stripHtml(email.body).substring(...)` on every render. Fix by rendering a
   precomputed `email.snippet` (SHARED CONTRACT) and only falling back to computing from
   body when `snippet` is absent, memoizing the fallback.

3. **Issue 14 (O(n) per mutation):** Every store mutation
   (`toggleEmailStar`/`markEmailAsRead`/`toggleEmailRead`/`deleteEmail`/`archiveEmail`/
   `moveEmailToFolder`/`restoreEmail`, store/index.ts:332-457) does a full-array `.map`
   **and** rebuilds the entire `emailIndex` via `buildEmailIndex(emails)` — O(n) per single
   toggle. Fix: for membership-preserving updates (star/read/move/archive/restore) mutate
   the one changed entry and reuse the existing index Map (no rebuild); only rebuild on
   add/delete (membership change: `permanentlyDeleteEmail`, `emptyTrash`, `deleteFolder`,
   the bulk move helpers, and refresh/init).

## Architecture

- **DB layer (`web/src/db/database.ts`):** add an `emailBodies` table keyed by the email
  `id`, holding `{ id, body, htmlBody?, attachmentData? }`. The `emails` table keeps
  everything else, including **lightweight attachment metadata** (`id, filename, mimeType,
  size` — but NOT the base64 `data`). A `version(5)` migration walks existing `emails` rows
  and, for each, writes a body row and strips `body`/`htmlBody`/`attachments[].data` off the
  email row in place. `getEmailHeaders()` becomes genuinely cheap (no body in the row).
  `getEmailBody(id)` reads from `emailBodies`. Writes (`insertEmail`, `bulkInsertEmails`)
  split the payload across both tables inside a transaction.

- **Store layer (`web/src/store/index.ts`):** `initialize()` / `refreshAll()` /
  `refreshEmails()` load **headers** (`getEmailHeaders`) instead of full emails. Headers
  still carry `subject`, `sender`, `snippet`, attachment metadata, flags — everything the
  list views and threading need. A small `updateEmailInPlace(id, patch)` helper mutates the
  single store entry at its known index and keeps the existing `emailIndex` Map identity.
  Membership-preserving mutations use it; add/delete mutations rebuild via `buildEmailIndex`.

- **Body consumers:** `EmailDetailPage` already uses `useLazyEmailBody` for the rendered
  body — but it also reads `email.htmlBody`/`email.body`/`email.attachments` off the store
  email (EmailDetailPage.tsx:252-278). After the split those fields are gone from store
  rows, so the detail page must source body/html/attachment-data from the lazy hook. The
  hook is widened to also return attachments-with-data. Body-search pages
  (`EmailsPage.tsx:129,166`, `SenderEmailsPage.tsx:102,343`) read `email.body` off the store
  array; after the split that's empty. These are handled explicitly (see Risk + Step 9).

- **Render layer:** `EmailCard` / `ThreadView` prefer `email.snippet`; fall back to a
  memoized `makeSnippet(htmlBody ?? body)` only when `snippet` is undefined (older rows).

## Tech Stack

- Vite + React + TypeScript, Zustand store, Dexie (IndexedDB).
- Tests: Vitest 4 + jsdom + @testing-library/react + `fake-indexeddb/auto` (real
  IndexedDB in tests, auto-imported via `web/src/__tests__/setup.ts`).
- New tests live in `web/src/__tests__/phase-9/`.
- Run from `web/`: `npm run test:run`, `npm run lint`, `npm run build`.

## For agentic workers

Execute this plan with **superpowers:subagent-driven-development**. Each step is a strict
TDD cycle: write the failing test first (RED), run it to confirm it fails for the right
reason, implement the minimum to pass (GREEN), then run `npm run test:run` before moving on.
Do NOT skip the RED run. Use real code in every step — no placeholders. Commit after each
green step with a normal `git commit` (no `--no-verify`, no `GIT_AUTHOR_*` env vars; verify
`git config user.email` is an allowed address before committing).

---

## SHARED CONTRACT (owned by the parsing bucket — reference only, do NOT redefine here)

- `Email.snippet?: string` is added to `web/src/types/index.ts` by the parsing bucket and
  populated at import time. It is **optional**; older rows lack it. EmailCard/ThreadView MUST
  fall back when it is `undefined`.
- `makeSnippet(htmlOrText: string, maxLen?: number): string` is exported from
  `web/src/services/mimeUtils.ts` by the parsing bucket.

**Dependency note:** as of this writing `web/src/services/mimeUtils.ts` does NOT exist and
`Email.snippet` is NOT yet in `types/index.ts`. This bucket must work whether or not the
parsing bucket has landed:

- **For `Email.snippet`:** Step 0 below adds the optional `snippet?: string` field to the
  `Email` interface **only if absent** (idempotent; harmless if the parsing bucket already
  added it — git will show no change). This is the one field this bucket needs and it is
  additive/optional, so co-owning it is safe.
- **For `makeSnippet`:** the render fallback (Steps 6-7) imports `makeSnippet` from
  `mimeUtils` **if the module exists**; otherwise it falls back to the existing
  `stripHtml(...).substring(...)` from `web/src/utils/emailUtils.ts`. To avoid a hard
  build-time dependency on a file another bucket owns, this bucket implements the fallback
  using `stripHtml` (already present) and a local `makeSnippet`-shaped helper, and leaves a
  `// TODO(parsing-bucket): replace with makeSnippet from mimeUtils once it lands` marker.
  Do NOT create `mimeUtils.ts` in this bucket.

## OWNERSHIP NOTE (shared file: `web/src/store/index.ts`)

This bucket owns **`initialize` / `refreshAll` / `refreshEmails`** and the
**index-update / in-place-mutation logic**. The UI-correctness bucket owns adding
**error surfacing** to the `catch` blocks. When editing mutation actions here, preserve the
existing `try/catch` + `logger.error(...)` structure verbatim and do NOT add user-facing
error surfacing — leave those `catch` bodies for the other bucket. Also preserve the
already-correct race-fix pattern where mutations re-read `get().emails` *after* the `await`
(do not capture the array before the awaited DB write).

---

## File Structure

```
web/src/
├── db/database.ts                          # MODIFY: emailBodies table, version(5) migration,
│                                           #         split insert/bulkInsert, header/body reads
├── store/index.ts                          # MODIFY: init/refresh use headers; in-place updates
├── hooks/useLazyEmailBody.ts               # MODIFY: also return attachments-with-data
├── components/EmailCard.tsx                # MODIFY: snippet-first render + memoized fallback
├── components/ThreadView.tsx               # MODIFY: snippet-first render (3 sites)
├── pages/EmailDetailPage.tsx               # MODIFY: source body/html/attachments from hook
├── pages/EmailsPage.tsx                    # MODIFY: body-search via async DB query (Step 9)
├── pages/SenderEmailsPage.tsx              # MODIFY: body-search/preview via DB (Step 9)
├── types/index.ts                          # MODIFY (Step 0, idempotent): snippet?, body-row type
└── __tests__/phase-9/
    ├── emailBodies-migration.test.ts       # NEW: Steps 1-4
    ├── store-headers-init.test.ts          # NEW: Step 5
    ├── store-inplace-index.test.ts         # NEW: Step 8
    └── snippet-render.test.tsx             # NEW: Steps 6-7
```

---

## Risk assessment (be honest)

- **Migration risk is real.** A `version(5)` upgrade that rewrites every email row runs once
  on every existing user's DB. If it throws mid-way, Dexie aborts the version transaction and
  the DB stays at v4 (Dexie upgrades are transactional per version), so it will retry next
  load — but a partially-bad migration that *commits* would be unrecoverable. Mitigations:
  (a) the upgrade runs entirely inside the Dexie-provided upgrade transaction (atomic);
  (b) Step 4 explicitly tests that pre-existing v4-shaped data still loads through headers +
  `getEmailBody` after upgrade; (c) keep the migration idempotent-safe — if a body row
  already exists for an id, overwrite it rather than failing.

- **Field-removal breakage.** Removing `body`/`htmlBody`/`attachments[].data` from store rows
  breaks any consumer that reads them off the in-memory array. Audited consumers:
  - `EmailDetailPage.tsx:252-278` (htmlBody/body/attachments) → fixed in Step 10 via the hook.
  - `EmailsPage.tsx:129,166` and `SenderEmailsPage.tsx:102,343` (body substring/search) →
    Step 9. **Attachment metadata is preserved** on header rows (filename/mimeType/size), so
    `AttachmentsPage.tsx:41-42`, `HomePage.tsx:631` (`e.attachments.length`),
    `EmailDetailPage` attachment *list* still work; only base64 `data` moves out (downloads
    fetch it lazily — already how `attachmentService`/`AttachmentGallery` should behave; verify
    in Step 10).
  - `threadingService` reads `email.body`/`attachments` when building threads
    (`hasAttachments`, etc.) — verify in Step 5 that header rows carry `attachments` metadata
    and that threading still produces correct `hasAttachments`/preview. Threads must NOT need
    full body; if they do, that is surfaced by the Step 5 test.

- **Scope honesty:** Step 9 (body-search off the store) is the largest behavioral change. If
  it proves too big for this bucket, the documented fallback (Option B partial) is: keep a
  truncated `searchText` (first ~2KB of stripped body) on the header row so substring search
  still works without loading full bodies. Step 9 picks the truncated-`searchText` approach
  because it is bounded and keeps search synchronous; full-fidelity body search is out of
  scope and noted as a limitation.

---

## Steps

### Step 0 — Types: add optional `snippet` (idempotent) and the body-row type

- [ ] **Inspect first.** Open `web/src/types/index.ts`. If the `Email` interface already has
      `snippet?: string` (parsing bucket landed), make NO change to that field.
- [ ] If absent, add to the `Email` interface (after `htmlBody?: string;`, before
      `attachments`):
      ```ts
      snippet?: string; // Precomputed preview text (populated at import). Optional: older rows lack it.
      ```
- [ ] Add an exported type for the new body table payload (used by db + tests):
      ```ts
      // Body/heavy payload stored in a separate table for cheap header loads (Bucket D)
      export interface EmailBodyRecord {
        id: number;           // same id as the Email row
        body: string;
        htmlBody?: string;
        // base64 attachment data keyed by attachment id (kept out of the email row)
        attachmentData?: Record<string, string>;
      }
      ```
- [ ] Add an exported header type so the store can be precise about "no body" rows:
      ```ts
      // An Email row as loaded for lists: no body/htmlBody, attachments carry metadata only (no `data`)
      export type EmailHeader = Omit<Email, 'body' | 'htmlBody'>;
      ```
- [ ] **No test for this step** (type-only). Verify with `npm run build` at the end of Step 1
      (the migration step) where these types are first consumed.
- [ ] Commit: `types: add Email.snippet and EmailBodyRecord/EmailHeader types (bucket D)`

---

### Step 1 — RED: `emailBodies` table exists after a `version(5)` upgrade

- [ ] Create `web/src/__tests__/phase-9/emailBodies-migration.test.ts`. First test:
      ```ts
      import { describe, it, expect, beforeEach } from 'vitest';
      import { db, clearAllData } from '../../db/database';

      describe('emailBodies table (version 5)', () => {
        beforeEach(async () => {
          await clearAllData();
        });

        it('exposes an emailBodies table after opening the DB', async () => {
          await db.open();
          const names = db.tables.map(t => t.name);
          expect(names).toContain('emailBodies');
          expect(db.verno).toBeGreaterThanOrEqual(5);
        });
      });
      ```
- [ ] Run `npm run test:run -- emailBodies-migration` → MUST fail (`emailBodies` not present,
      `verno` is 4).

### Step 1 (cont.) — GREEN: declare `version(5)` with `emailBodies`

- [ ] In `web/src/db/database.ts`, add the body table field to the class:
      ```ts
      emailBodies!: EntityTable<EmailBodyRecord, 'id'>;
      ```
      and import `EmailBodyRecord` from `../types`.
- [ ] After the `version(4)` block (line 102), add:
      ```ts
      // Version 5: split heavy payload (body/htmlBody/attachment data) into emailBodies
      // so the emails table holds small header rows for cheap list loads.
      this.version(5).stores({
        emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
        accounts: '++id, serviceName, serviceType, domain, signupDate',
        purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
        contacts: '++id, name, email, emailCount, lastEmailDate',
        calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
        folders: 'id, name, isSystem, createdAt',
        subscriptions: '++id, serviceName, category, isActive, lastRenewalDate',
        newsletters: '++id, senderEmail, isPromotional, lastEmailDate',
        emailBodies: 'id',
      }).upgrade(async (tx) => {
        // Move body/htmlBody/attachment-data out of each existing email row.
        const emailsTable = tx.table('emails');
        const bodiesTable = tx.table('emailBodies');
        await emailsTable.toCollection().modify((email) => {
          const id = (email as { id: number }).id;
          const rec = email as Record<string, unknown>;
          const attachmentData: Record<string, string> = {};
          const attachments = (rec.attachments as Array<Record<string, unknown>> | undefined) ?? [];
          for (const att of attachments) {
            if (typeof att.data === 'string' && att.id != null) {
              attachmentData[String(att.id)] = att.data as string;
              delete att.data; // strip base64 from the header row
            }
          }
          // Stage the body row write (modify cannot be async per-row reliably for adds,
          // so collect via the outer table put after stripping).
          void bodiesTable.put({
            id,
            body: (rec.body as string) ?? '',
            htmlBody: rec.htmlBody as string | undefined,
            attachmentData: Object.keys(attachmentData).length ? attachmentData : undefined,
          });
          delete rec.body;
          delete rec.htmlBody;
        });
      });
      ```
      > Note for implementer: `Collection.modify`'s callback is synchronous; the `bodiesTable.put`
      > returns a promise that is enqueued on the same upgrade transaction (`tx`), which Dexie
      > awaits before committing. If the runtime/typing rejects the fire-and-forget `void put`,
      > switch to the explicit two-pass form: `const rows = await emailsTable.toArray();` then a
      > `for` loop doing `await bodiesTable.put(...)` and `await emailsTable.update(id, {...})`
      > with body fields set to `undefined` via Dexie's delete. Keep it all inside `tx`. Choose
      > whichever the RED test in Step 4 proves correct.
- [ ] Run `npm run test:run -- emailBodies-migration` → Step 1 test passes.

---

### Step 2 — RED: writes split across both tables; `getEmailBody` reads from `emailBodies`

- [ ] Add to `emailBodies-migration.test.ts`:
      ```ts
      import { insertEmail, getEmailBody, db } from '../../db/database';
      import type { Email } from '../../types';

      const baseEmail: Omit<Email, 'id'> = {
        subject: 'Hi', sender: 'a@b.com', recipients: ['c@d.com'],
        date: new Date('2024-02-02'), body: 'PLAIN BODY', htmlBody: '<p>HTML BODY</p>',
        attachments: [{ id: 'att1', filename: 'f.pdf', mimeType: 'application/pdf', size: 3, data: 'AAAA' }],
        size: 10, isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular',
      };

      it('stores body/html/attachment-data in emailBodies, not in the email row', async () => {
        const id = await insertEmail(baseEmail);
        const row = await db.emails.get(id);
        expect((row as Record<string, unknown>).body).toBeUndefined();
        expect((row as Record<string, unknown>).htmlBody).toBeUndefined();
        // attachment metadata stays, base64 data does not
        expect(row!.attachments[0].filename).toBe('f.pdf');
        expect(row!.attachments[0].data).toBeUndefined();

        const bodyRow = await db.emailBodies.get(id);
        expect(bodyRow?.body).toBe('PLAIN BODY');
        expect(bodyRow?.htmlBody).toBe('<p>HTML BODY</p>');
        expect(bodyRow?.attachmentData?.att1).toBe('AAAA');
      });

      it('getEmailBody returns body + html + attachment data from emailBodies', async () => {
        const id = await insertEmail(baseEmail);
        const result = await getEmailBody(id);
        expect(result?.body).toBe('PLAIN BODY');
        expect(result?.htmlBody).toBe('<p>HTML BODY</p>');
        expect(result?.attachmentData?.att1).toBe('AAAA');
      });
      ```
- [ ] Run → MUST fail (current `insertEmail` writes body onto the email row; `getEmailBody`
      reads `db.emails.get`).

### Step 2 (cont.) — GREEN: split-aware writes + body read

- [ ] Rewrite `insertEmail` (database.ts:111-116) to split and write atomically:
      ```ts
      export const insertEmail = async (email: Omit<Email, 'id'>): Promise<number> => {
        return await db.transaction('rw', db.emails, db.emailBodies, async () => {
          const { body, htmlBody, attachments, ...rest } = email;
          const attachmentData: Record<string, string> = {};
          const slimAttachments = (attachments ?? []).map(att => {
            if (att.data != null) attachmentData[att.id] = att.data;
            const { data: _data, ...meta } = att;
            void _data;
            return meta as typeof att;
          });
          const id = await db.emails.add({
            ...rest,
            attachments: slimAttachments,
            date: email.date.getTime(),
          } as unknown as DBEmail);
          await db.emailBodies.put({
            id,
            body: body ?? '',
            htmlBody,
            attachmentData: Object.keys(attachmentData).length ? attachmentData : undefined,
          });
          return id;
        });
      };
      ```
- [ ] Update `DBEmail` to reflect the slimmer row. Change the interface (database.ts:8-11) so
      `body`/`htmlBody` are optional on the stored row (they are absent post-split). The
      simplest: `export interface DBEmail extends Omit<Email, 'date' | 'body' | 'htmlBody'> { id: number; date: number; body?: string; htmlBody?: string; }`
      (keep optional for backward-compat reads of un-migrated rows).
- [ ] Rewrite `getEmailBody` (database.ts:196-200) to read from `emailBodies`, falling back to
      the email row for any un-migrated/edge row:
      ```ts
      export const getEmailBody = async (
        id: number
      ): Promise<{ body: string; htmlBody?: string; attachmentData?: Record<string, string> } | undefined> => {
        const bodyRow = await db.emailBodies.get(id);
        if (bodyRow) return { body: bodyRow.body, htmlBody: bodyRow.htmlBody, attachmentData: bodyRow.attachmentData };
        const dbEmail = await db.emails.get(id);
        if (!dbEmail) return undefined;
        return { body: dbEmail.body ?? '', htmlBody: dbEmail.htmlBody };
      };
      ```
- [ ] Run → Step 2 tests pass.

---

### Step 3 — RED: `bulkInsertEmails` splits, and `getEmailHeaders` returns cheap rows w/o body

- [ ] Add to the test file:
      ```ts
      import { bulkInsertEmails, getEmailHeaders } from '../../db/database';

      it('bulkInsertEmails splits bodies and getEmailHeaders omits body/htmlBody', async () => {
        await bulkInsertEmails([
          { ...baseEmail, subject: 'one' },
          { ...baseEmail, subject: 'two', body: 'BODY TWO' },
        ]);
        const headers = await getEmailHeaders();
        expect(headers).toHaveLength(2);
        for (const h of headers) {
          expect((h as Record<string, unknown>).body).toBeUndefined();
          expect((h as Record<string, unknown>).htmlBody).toBeUndefined();
          // attachment metadata present, no base64
          expect(h.attachments[0].filename).toBe('f.pdf');
          expect(h.attachments[0].data).toBeUndefined();
        }
        // bodies retrievable
        const ids = headers.map(h => h.id!).sort((a, b) => a - b);
        const b0 = await getEmailBody(ids[0]);
        const b1 = await getEmailBody(ids[1]);
        const bodies = [b0?.body, b1?.body].sort();
        expect(bodies).toEqual(['BODY TWO', 'PLAIN BODY']);
      });
      ```
- [ ] Run → MUST fail.

### Step 3 (cont.) — GREEN: split bulk insert + true header read

- [ ] Rewrite `bulkInsertEmails` (database.ts:154-161) to split inside one transaction:
      ```ts
      export const bulkInsertEmails = async (emails: Omit<Email, 'id'>[]): Promise<number[]> => {
        return await db.transaction('rw', db.emails, db.emailBodies, async () => {
          const slimRows: DBEmail[] = [];
          const bodyPayloads: { body: string; htmlBody?: string; attachmentData?: Record<string, string> }[] = [];
          for (const email of emails) {
            const { body, htmlBody, attachments, ...rest } = email;
            const attachmentData: Record<string, string> = {};
            const slimAttachments = (attachments ?? []).map(att => {
              if (att.data != null) attachmentData[att.id] = att.data;
              const { data: _data, ...meta } = att; void _data;
              return meta as typeof att;
            });
            slimRows.push({ ...rest, attachments: slimAttachments, date: email.date.getTime() } as unknown as DBEmail);
            bodyPayloads.push({ body: body ?? '', htmlBody, attachmentData: Object.keys(attachmentData).length ? attachmentData : undefined });
          }
          const ids = (await db.emails.bulkAdd(slimRows, { allKeys: true })) as number[];
          await db.emailBodies.bulkPut(ids.map((id, i) => ({ id, ...bodyPayloads[i] })));
          return ids;
        });
      };
      ```
- [ ] Rewrite `getEmailHeaders` (database.ts:185-193) so it no longer strips-after-load; the
      rows are already body-free. Keep the existing return type but source from the slim rows:
      ```ts
      export const getEmailHeaders = async (): Promise<EmailHeader[]> => {
        const dbEmails = await db.emails.orderBy('date').reverse().toArray();
        return dbEmails.map(dbEmail => {
          const email = dbEmailToEmail(dbEmail);
          // Defensive: drop body/htmlBody if any un-migrated row still carries them
          const { body: _b, htmlBody: _h, ...rest } = email;
          void _b; void _h;
          return rest as EmailHeader;
        }) ;
      };
      ```
      Import `EmailHeader` from `../types`.
- [ ] **Also update `deleteEmail` / `deleteEmails` and `clearAllData`** to clean up the
      `emailBodies` table so it doesn't leak:
      - `deleteEmail` (database.ts:140-142): wrap in a `db.transaction('rw', db.emails, db.emailBodies, ...)` and call `db.emailBodies.delete(id)` too.
      - `deleteEmails` (database.ts:144-146): same, `db.emailBodies.bulkDelete(ids)`.
      - `clearAllData` (database.ts:540-551): add `db.emailBodies.clear()` to the `Promise.all`.
- [ ] Run → Step 3 tests pass.

---

### Step 4 — RED then GREEN: existing v4 data survives the migration

> This is the migration-safety test. It seeds a v4-shaped DB (body ON the email row, base64
> data in attachments, no `emailBodies` table) and asserts that after the v5 upgrade the data
> is reachable via headers + `getEmailBody`.

- [ ] Add to `emailBodies-migration.test.ts`:
      ```ts
      import Dexie from 'dexie';

      it('migrates pre-existing v4 rows: body moves to emailBodies, headers load clean', async () => {
        // Build a raw v4 DB (no emailBodies table, body on the row) then close it.
        const legacy = new Dexie('EmailAnalyzerDB');
        legacy.version(4).stores({
          emails: '++id, sender, date, [folderId+date], [emailType+date], [sender+date], threadId, isRead, isStarred',
          accounts: '++id, serviceName, serviceType, domain, signupDate',
          purchases: '++id, merchant, amount, purchaseDate, category, [merchant+purchaseDate]',
          contacts: '++id, name, email, emailCount, lastEmailDate',
          calendarEvents: '++id, title, startDate, endDate, isAllDay, [startDate+endDate]',
          folders: 'id, name, isSystem, createdAt',
          subscriptions: '++id, serviceName, category, isActive, lastRenewalDate',
          newsletters: '++id, senderEmail, isPromotional, lastEmailDate',
        });
        await legacy.open();
        const legacyId = await legacy.table('emails').add({
          subject: 'Legacy', sender: 'x@y.com', recipients: ['z@y.com'],
          date: new Date('2023-01-01').getTime(), body: 'LEGACY BODY', htmlBody: '<i>legacy</i>',
          attachments: [{ id: 'la', filename: 'l.txt', mimeType: 'text/plain', size: 2, data: 'QQ==' }],
          size: 5, isRead: true, isStarred: false, folderId: 'inbox', emailType: 'regular',
        });
        legacy.close();

        // Re-open through the app's db (triggers version(5).upgrade)
        const { db, getEmailHeaders, getEmailBody } = await import('../../db/database');
        if (!db.isOpen()) await db.open();

        const headers = await getEmailHeaders();
        const legacyHeader = headers.find(h => h.subject === 'Legacy')!;
        expect(legacyHeader).toBeDefined();
        expect((legacyHeader as Record<string, unknown>).body).toBeUndefined();
        expect(legacyHeader.attachments[0].filename).toBe('l.txt');
        expect(legacyHeader.attachments[0].data).toBeUndefined();

        const body = await getEmailBody(legacyId as number);
        expect(body?.body).toBe('LEGACY BODY');
        expect(body?.htmlBody).toBe('<i>legacy</i>');
        expect(body?.attachmentData?.la).toBe('QQ==');
      });
      ```
      > Implementer note: this test must NOT call `clearAllData` in its own setup (it needs the
      > legacy rows to persist into the upgrade). Put it in a separate `describe` with its own
      > `beforeEach` that deletes the named DB first via `await Dexie.delete('EmailAnalyzerDB')`
      > and re-imports the module fresh, or run it before the `clearAllData`-using block. Ensure
      > the app `db` singleton is reopened so the v5 upgrade actually runs against the legacy data.
- [ ] Run → confirm RED if the migration is wrong, then GREEN once the `version(5).upgrade`
      from Step 1 correctly moves rows. If it fails, this is the signal to switch the migration
      to the explicit two-pass form noted in Step 1.
- [ ] **Verify build + lint here** (first point all new DB types are exercised end to end):
      `npm run test:run -- emailBodies-migration && npm run lint && npm run build`.
- [ ] Commit: `db: split email bodies into emailBodies table with version(5) migration`

---

### Step 5 — RED: store `initialize` loads headers (no body) and threading still works

- [ ] Create `web/src/__tests__/phase-9/store-headers-init.test.ts`:
      ```ts
      import { describe, it, expect, beforeEach } from 'vitest';
      import { bulkInsertEmails, clearAllData } from '../../db/database';
      import { useAppStore } from '../../store';
      import type { Email } from '../../types';

      const mk = (over: Partial<Email>): Omit<Email, 'id'> => ({
        subject: 's', sender: 'a@b.com', recipients: ['c@d.com'], date: new Date('2024-03-03'),
        body: 'FULL BODY TEXT', htmlBody: '<p>x</p>',
        attachments: [{ id: 'a1', filename: 'a.pdf', mimeType: 'application/pdf', size: 1, data: 'ZZ' }],
        size: 1, isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular', ...over,
      });

      describe('store init loads headers only', () => {
        beforeEach(async () => {
          await clearAllData();
          useAppStore.setState({ isInitialized: false, emails: [], emailIndex: new Map(), threads: [] });
        });

        it('does not pull full bodies into the store, keeps attachment metadata', async () => {
          await bulkInsertEmails([mk({ subject: 'one' }), mk({ subject: 'two' })]);
          await useAppStore.getState().initialize();
          const emails = useAppStore.getState().emails;
          expect(emails).toHaveLength(2);
          for (const e of emails) {
            expect((e as Record<string, unknown>).body).toBeUndefined();
            expect((e as Record<string, unknown>).htmlBody).toBeUndefined();
            expect(e.attachments[0].filename).toBe('a.pdf');   // metadata present
            expect(e.attachments[0].data).toBeUndefined();      // base64 not loaded
          }
          // threads still built (hasAttachments works off metadata)
          expect(useAppStore.getState().threads.length).toBeGreaterThan(0);
        });
      });
      ```
- [ ] Run → MUST fail (init currently uses `getEmails`, so `body` is present).

### Step 5 (cont.) — GREEN: init/refresh use `getEmailHeaders`

- [ ] In `web/src/store/index.ts`:
  - Replace the `getEmails` import with `getEmailHeaders` (line 6). Keep all other imports.
  - The store `emails` field is typed `Email[]`; headers are `Omit<Email,'body'|'htmlBody'>`.
    Cast at the boundary: header rows are assignment-compatible with `Email[]` only if `body`
    is optional. Simplest correct move: change the store field/type usage to treat loaded rows
    as `Email[]` where `body`/`htmlBody` are simply absent — set the store type to
    `emails: Email[]` but load via `(await getEmailHeaders()) as Email[]`. Add a one-line
    comment explaining body is loaded lazily. (Do NOT widen the public `Email` type's `body`
    to optional — keep the SHARED CONTRACT intact; the cast is localized to the store.)
  - `initialize()` (line 142-151): change `getEmails()` in the `Promise.all` to
    `getEmailHeaders() as Promise<Email[]>` (or `await` then cast). Everything else (threads,
    `buildEmailIndex`, `totalEmailCount`) stays. Preserve the `try/catch`, the
    `initPromise` race-guard, and the `finally { initPromise = null }`.
  - `refreshAll()` (line 261-270): same swap.
  - `refreshEmails()` (line 183-191): same swap.
  - Do NOT touch the `catch` bodies (owned by the UI bucket).
- [ ] `threadingService.buildThreads(emails)` consumes these rows. Confirm via the Step 5 test
      that `hasAttachments` (derived from `attachments` metadata, still present) and previews
      work. If `buildThreads` needs `body` for snippets, it should read `email.snippet` (already
      in headers) — verify; if it currently reads `email.body`, note it and prefer `snippet`
      with a `stripHtml` fallback (but only if the test forces it).
- [ ] Run → Step 5 test passes. Then `npm run test:run` (full) to catch any store-consumer
      regressions early.
- [ ] Commit: `store: load email headers (not full bodies) at init/refresh`

---

### Step 6 — RED: `EmailCard` renders `snippet`, falls back when absent

- [ ] Create `web/src/__tests__/phase-9/snippet-render.test.tsx`:
      ```tsx
      import { describe, it, expect } from 'vitest';
      import { render, screen } from '@testing-library/react';
      import { MemoryRouter } from 'react-router-dom';
      import { EmailCard } from '../../components/EmailCard';
      import type { Email } from '../../types';

      const base: Email = {
        id: 1, subject: 'Subj', sender: 'a@b.com', recipients: [], date: new Date('2024-01-01'),
        body: '<p>RAW HTML BODY CONTENT</p>', attachments: [], size: 0,
        isRead: false, isStarred: false, folderId: 'inbox', emailType: 'regular',
      };

      const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

      describe('EmailCard snippet rendering', () => {
        it('renders precomputed snippet when present (does not derive from body)', () => {
          wrap(<EmailCard email={{ ...base, snippet: 'PRECOMPUTED SNIPPET' }} onClick={() => {}} />);
          expect(screen.getByText(/PRECOMPUTED SNIPPET/)).toBeInTheDocument();
        });

        it('falls back to stripped body when snippet is absent', () => {
          wrap(<EmailCard email={{ ...base, snippet: undefined }} onClick={() => {}} />);
          expect(screen.getByText(/RAW HTML BODY CONTENT/)).toBeInTheDocument();
        });

        it('does not crash when both snippet and body are empty (header-only row)', () => {
          wrap(<EmailCard email={{ ...base, snippet: undefined, body: '' }} onClick={() => {}} />);
          // renders without throwing; preview area is empty
          expect(screen.getByText('Subj')).toBeInTheDocument();
        });
      });
      ```
      > If `EmailCard` doesn't actually need `MemoryRouter` (it uses the store, not router),
      > drop the wrapper. Check imports in EmailCard.tsx before finalizing — it imports
      > `useAppStore`, not router, so `render(<EmailCard .../>)` directly is fine. Adjust.
- [ ] Run → first test FAILS (snippet not rendered; body always used).

### Step 6 (cont.) — GREEN: snippet-first preview in `EmailCard`

- [ ] In `web/src/components/EmailCard.tsx`:
  - Add `useMemo` to the React import (line 1): `import { memo, useMemo } from 'react';`
  - Add a local snippet helper near the top of the module (outside the component), with the
    TODO marker for the parsing bucket:
    ```ts
    // TODO(parsing-bucket): replace with makeSnippet from '../services/mimeUtils' once it lands.
    function deriveSnippet(text: string, maxLen = 150): string {
      const stripped = stripHtml(text || '');
      return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
    }
    ```
  - Inside the component, compute once:
    ```ts
    const preview = useMemo(
      () => email.snippet ?? deriveSnippet(email.body ?? ''),
      [email.snippet, email.body]
    );
    ```
  - Replace the preview JSX (EmailCard.tsx:132-134):
    ```tsx
    <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 line-clamp-2">
      {preview}{preview ? '...' : ''}
    </p>
    ```
- [ ] Run → all Step 6 tests pass.

---

### Step 7 — RED then GREEN: `ThreadView` snippet-first at all three sites

- [ ] Add to `snippet-render.test.tsx` a `ThreadView` block (single-email and multi-email).
      The single-email path renders `SingleEmailView` which uses `email.body` (line 164); the
      thread-preview uses `latestEmail.body` (line 71); the expanded item uses `email.body`
      (lines 229-234). Test the snippet-present and snippet-absent cases for the visible
      preview text. Example for the single-email path:
      ```tsx
      import { ThreadView } from '../../components/ThreadView';
      import type { EmailThread } from '../../types';

      const oneThread: EmailThread = {
        id: 't1', subject: 'T', emails: [{ ...base, snippet: 'THREAD SNIPPET' }],
        participants: ['a@b.com'], lastMessageDate: base.date, firstMessageDate: base.date,
        messageCount: 1, unreadCount: 1, hasAttachments: false, isStarred: false,
      };

      it('ThreadView single-email uses snippet when present', () => {
        render(<ThreadView thread={oneThread} />);
        expect(screen.getByText(/THREAD SNIPPET/)).toBeInTheDocument();
      });
      ```
      Add the snippet-absent fallback case asserting the stripped body shows. For the expanded
      full-body item (lines 228-231) note: the *full expanded* view legitimately needs the
      real body — and after Step 5 the store rows have no body. So the expanded full text must
      come from the lazy body, not the header row. For THIS bucket, keep the expanded item
      showing `email.snippet ?? deriveSnippet(email.body ?? '')` for the collapsed preview, and
      for the expanded full text fall back to `email.body ?? ''` (empty for header rows) — and
      add a `// TODO: load full body lazily for expanded thread items` marker. Do not wire a new
      hook into ThreadView in this bucket (out of scope); just ensure no crash and snippet works.
- [ ] Run → RED for the preview sites.

### Step 7 (cont.) — GREEN: apply snippet-first to ThreadView

- [ ] In `web/src/components/ThreadView.tsx`:
  - Add `useMemo` to the React import (line 1).
  - Add the same `deriveSnippet` helper at module top (or import a shared one if you extract it;
    simplest is to duplicate the small helper with the same TODO marker, or extract to
    `emailUtils.ts` — pick extraction only if lint complains about duplication).
  - Line 71 (thread preview): replace `{latestEmail.body.substring(0, 150)}...` with
    `{latestEmail.snippet ?? deriveSnippet(latestEmail.body ?? '')}{(latestEmail.snippet ?? latestEmail.body) ? '...' : ''}`.
  - Line 164 (`SingleEmailView`): replace `{stripHtml(email.body).substring(0, 100)}...` with
    a memoized `preview` (`email.snippet ?? deriveSnippet(email.body ?? '', 100)`).
  - Lines 233-234 (`ThreadEmailItem` collapsed preview): same snippet-first treatment.
  - Lines 229-231 (`ThreadEmailItem` expanded full body): keep `{stripHtml(email.body ?? '')}`
    with the TODO marker noted above (header rows render empty until lazy body wiring lands).
- [ ] Run → Step 7 tests pass. Then `npm run test:run` (full).
- [ ] Commit: `ui: render precomputed snippet with memoized fallback in EmailCard/ThreadView`

---

### Step 8 — RED: single star/read/move toggle does NOT rebuild the whole index

- [ ] Create `web/src/__tests__/phase-9/store-inplace-index.test.ts`:
      ```ts
      import { describe, it, expect, beforeEach } from 'vitest';
      import { bulkInsertEmails, clearAllData } from '../../db/database';
      import { useAppStore } from '../../store';
      import type { Email } from '../../types';

      const mk = (over: Partial<Email>): Omit<Email, 'id'> => ({
        subject: 's', sender: 'a@b.com', recipients: [], date: new Date('2024-04-04'),
        body: 'b', attachments: [], size: 0, isRead: false, isStarred: false,
        folderId: 'inbox', emailType: 'regular', ...over,
      });

      describe('in-place index updates for membership-preserving mutations', () => {
        beforeEach(async () => {
          await clearAllData();
          useAppStore.setState({ isInitialized: false, emails: [], emailIndex: new Map(), threads: [] });
          await bulkInsertEmails([mk({ subject: 'a' }), mk({ subject: 'b' }), mk({ subject: 'c' })]);
          await useAppStore.getState().initialize();
        });

        it('toggleEmailStar keeps the SAME emailIndex Map identity (no rebuild)', async () => {
          const before = useAppStore.getState().emailIndex;
          const id = useAppStore.getState().emails[0].id!;
          await useAppStore.getState().toggleEmailStar(id);
          const after = useAppStore.getState().emailIndex;
          expect(after).toBe(before); // same Map reference => not rebuilt
          expect(useAppStore.getState().getEmailById(id)?.isStarred).toBe(true);
        });

        it('markEmailAsRead updates one entry and preserves index identity', async () => {
          const before = useAppStore.getState().emailIndex;
          const id = useAppStore.getState().emails[1].id!;
          await useAppStore.getState().markEmailAsRead(id);
          expect(useAppStore.getState().emailIndex).toBe(before);
          expect(useAppStore.getState().getEmailById(id)?.isRead).toBe(true);
        });

        it('permanentlyDeleteEmail DOES rebuild (membership changed)', async () => {
          const before = useAppStore.getState().emailIndex;
          const id = useAppStore.getState().emails[0].id!;
          await useAppStore.getState().permanentlyDeleteEmail(id);
          expect(useAppStore.getState().emailIndex).not.toBe(before); // rebuilt
          expect(useAppStore.getState().getEmailById(id)).toBeUndefined();
          expect(useAppStore.getState().emails).toHaveLength(2);
        });
      });
      ```
- [ ] Run → the star/read identity tests FAIL (current code calls `buildEmailIndex(emails)`
      every time, creating a new Map). The delete test should pass already (sanity).

### Step 8 (cont.) — GREEN: in-place update helper + reuse index for membership-preserving ops

- [ ] In `web/src/store/index.ts`, add a private helper (module scope, above the store or as a
      local function) that updates one email by id at its known index and returns the SAME
      `emailIndex` Map:
      ```ts
      // Membership-preserving single-row update: mutate the one entry, reuse the index Map.
      // Returns the new emails array + the *same* index Map (identity preserved).
      function applyInPlace(
        emails: Email[],
        index: Map<number, number>,
        id: number,
        patch: Partial<Email>
      ): { emails: Email[]; emailIndex: Map<number, number> } | null {
        const idx = index.get(id);
        if (idx === undefined) return null;
        const next = emails.slice();          // new array ref so Zustand notifies subscribers
        next[idx] = { ...next[idx], ...patch };
        return { emails: next, emailIndex: index }; // SAME Map -> O(1), no rebuild
      }
      ```
      > Note: we still create a new `emails` array (cheap shallow copy) so React/Zustand
      > re-render; the O(n) win is avoiding `buildEmailIndex` (Map allocation + n inserts).
      > The Map is unchanged because indices don't move for in-place updates.
- [ ] Rewrite the membership-preserving mutations to use it, **preserving the post-await
      `get()` race-fix** (read state fresh after the DB write):
  - `toggleEmailStar` (332-348):
    ```ts
    toggleEmailStar: async (id) => {
      const cur = get().emailIndex.get(id);
      if (cur === undefined) return;
      const newStarred = !get().emails[cur].isStarred;
      try {
        await updateEmailStar(id, newStarred);
        const next = applyInPlace(get().emails, get().emailIndex, id, { isStarred: newStarred });
        if (next) set(next);
      } catch (error) {
        logger.error('Failed to toggle star:', error);
      }
    },
    ```
  - `markEmailAsRead` (351-365): same shape, `{ isRead: true }`, keep the early-return when
    already read.
  - `toggleEmailRead` (368-383): `{ isRead: newRead }`.
  - `deleteEmail` (386-399): `{ folderId: SYSTEM_FOLDERS.TRASH }` (move = membership-preserving
    in the global array; the email still exists in the store).
  - `archiveEmail` (415-428): `{ folderId: SYSTEM_FOLDERS.ARCHIVE }`.
  - `moveEmailToFolder` (444-457): `{ folderId }`.
  - `restoreEmail` (460-473): `{ folderId: SYSTEM_FOLDERS.INBOX }`.
  - For the **bulk** move helpers `deleteEmails` (402-412) and `archiveEmails` (431-441): these
    touch many ids but DON'T change membership. Update them to map over the affected ids doing
    in-place patches against a single cloned array while reusing the same index Map (loop and
    set `next[index.get(id)!]`), then `set({ emails: next, emailIndex: get().emailIndex })`.
    Keep them O(k) in changed rows, not O(n) index rebuild.
- [ ] **Leave membership-changing mutations rebuilding the index** (correct as-is): keep
      `buildEmailIndex` in `permanentlyDeleteEmail` (476-488), `emptyTrash` (491-508), and
      `deleteFolder` (533-551, since folder delete remaps emails but membership is unchanged —
      actually folder delete is membership-preserving too; you MAY convert it to a single-clone
      loop reusing the index, but it's a rare op, so leaving the rebuild is acceptable. Prefer
      converting for consistency if it's clean.) Do NOT change `createFolder` (no email change).
- [ ] Do NOT modify the `catch` bodies beyond keeping the existing `logger.error` (UI bucket
      owns surfacing).
- [ ] Run → all Step 8 tests pass. Then `npm run test:run` (full) to confirm no mutation
      regressions (selectors, folder filtering, etc.).
- [ ] Commit: `store: O(1) in-place updates for membership-preserving email mutations`

---

### Step 9 — Body-search consumers (the documented field-removal fix)

> After Step 5 the store rows carry no `body`, so `EmailsPage`/`SenderEmailsPage` substring
> search over `email.body` silently returns nothing. Fix with a bounded `searchText` on header
> rows (Option-B-partial, chosen for bounded memory + synchronous search).

- [ ] **Decision:** add an optional `searchText?: string` to header rows containing the first
      ~2000 chars of stripped body, computed at write time. This keeps search synchronous and
      bounded. (Full-fidelity body search is out of scope; note as a limitation in the commit.)
- [ ] RED: add a test (in `store-headers-init.test.ts` or a new `body-search.test.ts`) that
      inserts an email with a distinctive word deep in the body, loads headers, and asserts
      `header.searchText` contains the word (truncated form) while `body` is absent.
- [ ] GREEN:
  - Add `searchText?: string` to the `Email` interface in `types/index.ts` (optional, additive).
  - In `insertEmail`/`bulkInsertEmails` (database.ts), when splitting, compute
    `searchText = stripHtml(body ?? htmlBody ?? '').slice(0, 2000)` and write it onto the slim
    email row (NOT into `emailBodies`). Use the existing `stripHtml` from
    `../utils/emailUtils` (import it in database.ts).
  - In the `version(5).upgrade`, also set `searchText` on migrated rows from the body before
    deleting it.
  - Update `EmailsPage.tsx:129,166` and `SenderEmailsPage.tsx:102` to search
    `(email.searchText ?? '').toLowerCase().includes(query)` instead of `email.body`.
    > **Cross-bucket note:** the `EmailsPage.tsx` raw `.includes()` block is **superseded later**
    > by Bucket C (Search), which replaces it with `filterEmails(parseSearchQuery(...))`. Bucket C's
    > Task 1.5 makes `filterEmails` read `email.searchText ?? email.body`, so this `searchText` field
    > is exactly what Search consumes. Your edit here keeps list-search working in the interim
    > (between D landing and C landing); C overwriting it afterward is expected, not a regression.
    > `SenderEmailsPage.tsx` is NOT touched by C, so its `searchText` edit here is permanent.
  - Update `SenderEmailsPage.tsx:343` preview (`email.body?.substring(0,100)`) to
    `email.snippet ?? (email.searchText ?? '').substring(0, 100)`.
- [ ] Run targeted test + `npm run test:run`.
- [ ] Commit: `search: add bounded searchText to header rows so list search works without bodies`

---

### Step 10 — Detail page + attachments: source heavy data from the lazy hook

> `EmailDetailPage` reads `email.htmlBody`/`email.body`/attachment `data` off the store row
> (EmailDetailPage.tsx:252-278). After the split these are gone. Wire it to the lazy body.

- [ ] Read `web/src/pages/EmailDetailPage.tsx` fully and
      `web/src/hooks/useLazyEmailBody.ts` (already read) and
      `web/src/components/AttachmentGallery.tsx` / `web/src/services/attachmentService.ts`
      to see how attachment `data` is consumed for download/preview.
- [ ] Widen the hook return type in `useLazyEmailBody.ts` to include `attachmentData`:
      ```ts
      interface EmailBody { body: string; htmlBody?: string; attachmentData?: Record<string, string>; }
      ```
      `getEmailBody` already returns `attachmentData` (Step 2). No other hook logic changes;
      `prefetchEmailBody` stays.
- [ ] RED: add a component test (new file `phase-9/email-detail-body.test.tsx` or extend an
      existing detail test if present) that renders `EmailDetailPage` for an email whose body
      lives only in `emailBodies`, and asserts the rendered body/html appears (via the hook),
      not from a (now-absent) `email.htmlBody`. Mock the route param / store as the existing
      page tests do — inspect `src/__tests__` for any existing page-render harness first; if
      none, render the component with a `MemoryRouter` + seeded store + seeded DB.
- [ ] GREEN: in `EmailDetailPage.tsx`:
  - Use `const { body: lazyBody } = useLazyEmailBody(email?.id)` (the hook is likely already
    imported/used — verify; the page may already call it).
  - Replace `email.htmlBody` (line 274-275) → `lazyBody?.htmlBody`, and `email.body`
    (line 278) → `lazyBody?.body`. Keep the existing loading/empty states.
  - For attachments (lines 252-266): the `email.attachments` *list* (metadata) still renders
    from the header row; for download/preview pull base64 from `lazyBody?.attachmentData?.[att.id]`.
    Wire the download handler / `AttachmentGallery` to source `data` from `attachmentData` when
    the attachment's own `data` is absent.
- [ ] Verify `AttachmentsPage.tsx` (counts/listing off metadata — should already work) and
      `HomePage.tsx:631` (`e.attachments.length`) still function with metadata-only rows.
- [ ] Run targeted test + `npm run test:run`.
- [ ] Commit: `ui: source email body and attachment data from lazy hook in detail page`

---

### Step 11 — Full verification gate

- [ ] From `web/`: run the full gate and confirm all three pass:
      ```
      npm run test:run && npm run lint && npm run build
      ```
- [ ] If any prior step's full `npm run test:run` was skipped, it MUST pass here. Treat any new
      failure in existing phases (phase-1..8) as a regression from the field split and fix it in
      the owning step (most likely a body-search or attachment consumer missed in the audit).
- [ ] Manual sanity (optional but recommended given migration risk): start the dev server,
      import a small archive, confirm: list renders snippets, opening an email shows the body,
      attachments download, star/read toggles are instant, and a hard reload re-opens the
      existing DB without re-migrating (verno already 5). Document the result.
- [ ] Final commit if anything changed in this step:
      `chore: verify bucket D (test:run + lint + build all green)`

---

## Done criteria

- `initialize`/`refreshAll`/`refreshEmails` load header rows with no `body`/`htmlBody` and
  no base64 attachment data; bodies fetched on demand via `getEmailBody` from `emailBodies`.
- `version(5)` migration moves existing rows' heavy payload out, proven by Step 4 against a
  seeded legacy DB.
- `EmailCard`/`ThreadView` render `email.snippet` and only compute a memoized fallback when
  `snippet` is undefined.
- Membership-preserving mutations are O(1) on the index (same Map identity, proven by Step 8);
  add/delete still rebuild.
- Body-search and detail/attachment rendering keep working via `searchText`/lazy hook.
- `npm run test:run && npm run lint && npm run build` all green.
