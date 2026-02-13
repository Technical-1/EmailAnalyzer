# Email Archive Explorer — Comprehensive Project Audit

**Date:** 2026-02-11
**Overall Score:** 85/100 — Feature-complete, needs hardening to ship
**Build Status:** FAILING (TypeScript errors)

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [What's Already Great](#whats-already-great)
- [Phase 1: Critical Blockers](#phase-1-critical-blockers-must-fix-to-ship)
- [Phase 2: Security Hardening](#phase-2-security-hardening)
- [Phase 3: Performance Optimization](#phase-3-performance-optimization)
- [Phase 4: Code Quality & Architecture](#phase-4-code-quality--architecture)
- [Phase 5: Test Coverage](#phase-5-test-coverage)
- [Phase 6: Production Readiness](#phase-6-production-readiness)
- [Phase 7: Accessibility & UX Polish](#phase-7-accessibility--ux-polish)
- [Phase 8: Nice-to-Have Features](#phase-8-nice-to-have-features)
- [Appendix A: Full Feature Inventory](#appendix-a-full-feature-inventory)
- [Appendix B: File Reference Map](#appendix-b-file-reference-map)
- [Appendix C: Dependency Audit](#appendix-c-dependency-audit)

---

## Executive Summary

The Email Archive Explorer is a **mature, feature-complete application** with no TODO/FIXME comments, no stub implementations, and a clean architecture. All three email formats (OLM, MBOX, Gmail Takeout) work. Detection services (accounts, purchases, subscriptions, newsletters) are functional. The UI has dark mode, responsive mobile design, virtual scrolling, and proper empty/loading/error states.

**The path to "done" is hardening, not building.** The main blockers are:
1. TypeScript build is broken (50+ errors)
2. XSS vulnerability in email rendering
3. Dependency vulnerabilities (react-router)
4. Missing security headers

Everything else is optimization, testing, and polish.

---

## What's Already Great

- **Privacy architecture genuinely works** — no server calls, all processing client-side
- **3 major email format parsers** all functional (OLM, MBOX, Gmail Takeout)
- **Virtual scrolling** handles thousands of emails smoothly via `@tanstack/react-virtual`
- **Web Worker** for parsing prevents UI freeze
- **Streaming/batch processing** for large files with progress reporting
- **Encryption service** uses proper Web Crypto API (AES-GCM, PBKDF2)
- **Dark mode**, responsive mobile design, empty states all solid
- **Zustand + Dexie** pattern is clean and well-organized
- **Composite IndexedDB indexes** for performance: `[folderId+date]`, `[sender+date]`
- **DOMPurify** properly used in `PrintableEmail` component
- **No dangerous code execution patterns** found in the codebase
- **Export options**: JSON, CSV, encrypted backup with selective data types
- **Advanced search syntax**: `from:`, `to:`, `subject:`, `date:`, `has:attachment`, etc.
- **0 TODO/FIXME comments** — code is finished

---

## Phase 1: Critical Blockers (Must Fix to Ship)

> These prevent the app from building or create immediate security risk.

### 1.1 Fix TypeScript Build Errors

**Priority:** CRITICAL — Build fails, nothing can deploy
**Location:** Multiple files
**Effort:** 1-2 hours

`npm run build` exits with code 2 due to 50+ TypeScript errors:

| Error Category | Files Affected | Fix |
|---------------|----------------|-----|
| Missing `includeSubscriptions`, `includeNewsletters` in ExportOptions | `backupService.test.ts` | Add properties to ExportOptions interface in `types/index.ts` |
| Missing `organization` property on Contact type | `vcardExporter.ts` | Add optional `organization` field to Contact interface |
| StatsCard missing `color` prop definition | `AnalyticsPage.tsx` | Add `color` to StatsCard props interface |
| Unused imports and variables | Multiple files | Remove unused imports (strict mode catches these) |
| Date vs number timestamp mismatches | `database.ts`, store | Ensure proper conversion between DB types and API types |
| Invalid `frequency` property in subscription | `olmParser.ts` | Match property name to Subscription interface |
| Unused deduplication function | `gmailTakeoutParser.ts` | Remove or use the function |
| Unused currency patterns | `purchaseDetector.ts` | Remove or use the patterns |

### 1.2 Fix XSS in Email Detail View

**Priority:** CRITICAL — Malicious emails can execute JavaScript
**Location:** `web/src/pages/EmailDetailPage.tsx:275-312`
**Effort:** 30 minutes

The main email detail view renders `email.htmlBody` directly into an iframe `srcDoc` **without DOMPurify sanitization**. The iframe uses `sandbox="allow-same-origin"` which defeats the sandbox.

**Fix:**
- Import and apply DOMPurify sanitization to `email.htmlBody` before passing to `srcDoc`
- Configure DOMPurify to forbid script, style tags and event handler attributes
- Remove `allow-same-origin` from the sandbox attribute (use empty `sandbox=""`)

Note: `PrintableEmail` already uses DOMPurify correctly — this is just the main detail view that was missed.

### 1.3 Update React Router (Known CVEs)

**Priority:** CRITICAL — 3 known vulnerabilities
**Location:** `web/package.json` — `react-router-dom@7.10.1`
**Effort:** 10 minutes

| CVE | Severity | Issue |
|-----|----------|-------|
| GHSA-h5cw-625j-3rxh | HIGH | CSRF in Action/Server Action Request Processing |
| GHSA-2w69-qvjg-hvjx | HIGH | XSS via Open Redirects |
| GHSA-8v8x-cx79-35w7 | HIGH | SSR XSS in ScrollRestoration |

**Fix:** `cd web && npm audit fix`

### 1.4 Add Content Security Policy Headers

**Priority:** HIGH — No CSP means XSS has no defense-in-depth
**Location:** `vercel.json`
**Effort:** 15 minutes

Add security headers to `vercel.json`:
- `Content-Security-Policy` — restrict script/style/font/img sources to `'self'`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy` — disable camera, microphone, geolocation

---

## Phase 2: Security Hardening

> Fix remaining security issues that don't block the build.

### 2.1 Self-Host Google Fonts

**Priority:** HIGH — Contradicts "no data leaves your device" privacy claim
**Location:** `web/index.html:32-34`
**Effort:** 30 minutes

Every page load sends requests to `fonts.googleapis.com` and `fonts.gstatic.com`, leaking user IP, user agent, and referrer to Google.

**Fix:**
1. Download Inter font files (woff2 format)
2. Place in `web/public/fonts/`
3. Replace external `<link>` tags with local `@font-face` declarations
4. Remove the three `<link>` tags for Google Fonts

### 2.2 ZIP Bomb / Resource Exhaustion Protection

**Priority:** MEDIUM — Malicious archives can crash browser tab
**Location:** `web/src/services/olmParser.ts:48`, `gmailTakeoutParser.ts:30`
**Effort:** 30 minutes

`JSZip.loadAsync()` loads entire ZIP into memory without size validation.

**Fix:**
- Add compressed file size check (500MB limit) before `JSZip.loadAsync()`
- After loading, iterate entries and sum decompressed sizes
- Reject if decompressed total exceeds 2GB

### 2.3 Input Validation on Email Parsers

**Priority:** MEDIUM — Extremely long fields can cause performance issues
**Location:** All parsers (`olmParser.ts`, `mboxParser.ts`, `gmailTakeoutParser.ts`)
**Effort:** 30 minutes

**Fix:** Add field length limits:
- Subject: max 1,000 characters
- Body: max 10MB
- Email addresses: basic format validation

### 2.4 Search Term Length Limit (ReDoS Prevention)

**Priority:** LOW — Theoretical risk with complex search patterns
**Location:** `web/src/services/searchParser.ts`, `web/src/components/SearchHighlight.tsx`
**Effort:** 10 minutes

**Fix:** Limit search terms to 100 characters each, max 10 terms.

### 2.5 localStorage Verification Token

**Priority:** LOW — Encryption salt and verification token stored in localStorage
**Location:** `web/src/services/encryptionService.ts:69-80`
**Effort:** 10 minutes

Consider using `sessionStorage` for the verification token if encryption only needs to persist during a session.

---

## Phase 3: Performance Optimization

> Make the app fast for large archives (100K+ emails, 1GB+ files).

### 3.1 Route-Level Code Splitting

**Priority:** HIGH — Quick win, reduces initial bundle by 20-30%
**Location:** `web/src/App.tsx`
**Effort:** 30 minutes

All 15+ page components are eagerly imported. Recharts alone adds ~200KB.

**Fix:** Use `React.lazy()` and `Suspense` for all non-critical page routes (Analytics, Calendar, Attachments, Subscriptions, etc.).

### 3.2 Vite Build Configuration

**Priority:** HIGH — Currently using bare defaults with no optimization
**Location:** `web/vite.config.ts`
**Effort:** 15 minutes

Current config has no `build` section at all.

**Fix:** Add `build` configuration with:
- `manualChunks` to split recharts, react-dnd, vendor, and state into separate bundles
- `chunkSizeWarningLimit` set appropriately
- Source maps disabled for production

### 3.3 Optimize Store Lookups (O(n) to O(1))

**Priority:** MEDIUM — Affects every email toggle/star/read action
**Location:** `web/src/store/index.ts:305-320`
**Effort:** 1-2 hours

Every `toggleEmailStar`, `toggleEmailRead`, etc. does a `.find()` then `.map()` over the entire email array — two O(n) passes per action.

**Fix options:**
- **Option A:** Maintain a `Map<number, Email>` alongside the array for O(1) lookups
- **Option B:** Use Zustand's Immer middleware for efficient immutable updates
- **Option C:** Use proper selectors that filter once per render

### 3.4 Search Performance (Full-Text)

**Priority:** MEDIUM — Search scans all email bodies with `.includes()`
**Location:** `web/src/pages/EmailsPage.tsx:113-119`
**Effort:** 2-4 hours

100K emails x 50KB body = 5GB scanned per keystroke.

**Fix options:**
- Build a simple inverted index on import (tokenize subjects/bodies)
- Use Lunr.js (~100KB) for client-side full-text search
- Only search subject/sender in real-time, body search as explicit action

### 3.5 Paginate Store Loading

**Priority:** MEDIUM — All emails loaded into memory at init
**Location:** `web/src/store/index.ts:115`
**Effort:** 2-3 hours

`db.emails.orderBy('date').reverse().toArray()` loads everything into memory.

**Fix:** Load only the current folder's emails. Use the existing `getEmailsByFolderPaginated` function and load more as user scrolls.

### 3.6 React.memo on List Components

**Priority:** LOW — Reduces unnecessary re-renders in virtual lists
**Location:** `web/src/components/EmailCard.tsx`, `DraggableEmailCard`
**Effort:** 15 minutes

Wrap list item components in `React.memo` to prevent re-renders when parent state changes.

### 3.7 Compress OG Image

**Priority:** LOW — 404KB is unnecessarily large
**Location:** `web/public/og-image.png`
**Effort:** 5 minutes

Compress from 404KB to under 100KB using WebP or optimized PNG.

---

## Phase 4: Code Quality & Architecture

> Clean up patterns that create maintenance burden or risk subtle bugs.

### 4.1 Remove Production console.error Calls

**Priority:** HIGH — 11+ console.error calls in store without logging infrastructure
**Location:** `web/src/store/index.ts:153, 165, 174, 191, 209, 219, 265, 319, 355, 372, 386`
**Effort:** 30 minutes

**Fix:** Either remove (if errors are handled), or wrap in a dev-only logging utility that only logs in development mode.

### 4.2 Extract Timestamp Conversion Helpers

**Priority:** MEDIUM — Manual `getTime()` / `new Date()` in 15+ places
**Location:** `web/src/db/database.ts` (throughout)
**Effort:** 20 minutes

**Fix:** Create `toTimestamp(date)` and `fromTimestamp(ts)` helper functions.

### 4.3 Prevent Concurrent Store Initialization

**Priority:** MEDIUM — Race condition possible
**Location:** `web/src/store/index.ts:115-116`
**Effort:** 15 minutes

`isInitialized` / `isLoading` guards allow parallel initializations if called rapidly.

**Fix:** Use a single Promise field so concurrent calls share the same initialization.

### 4.4 Type-Safe Database Updates

**Priority:** MEDIUM — `Record<string, unknown>` loses type information
**Location:** `web/src/db/database.ts:488, 524`
**Effort:** 15 minutes

**Fix:** Use `Partial<DBSubscription>` or similar typed interfaces instead of `Record<string, unknown>`.

### 4.5 Extract System Folder Constants

**Priority:** LOW — Folder IDs hardcoded in two places
**Location:** `web/src/db/database.ts:386-418`
**Effort:** 10 minutes

**Fix:** Extract to a shared constant array.

### 4.6 Batch Contact Tracking in OLM Parser

**Priority:** LOW — Individual DB calls per email during parsing
**Location:** `web/src/services/olmParser.ts:108-110`
**Effort:** 30 minutes

`trackContact` is called for every email. Collect contacts in memory, deduplicate, then bulk insert after parsing.

### 4.7 Silent Parser Failures

**Priority:** LOW — Parsing errors logged but data corruption possible
**Location:** `web/src/services/mboxParser.ts:42-44, 289-292, 349`
**Effort:** 30 minutes

**Fix:** Return structured error results from parsers. Show warning if error count exceeds threshold.

---

## Phase 5: Test Coverage

> Current coverage: ~20-30%. Critical detection logic is 0% tested.

### Test Infrastructure (Already Good)
- Vitest configured with jsdom environment
- `fake-indexeddb` for IndexedDB mocking
- localStorage mock implemented
- `@testing-library/react` available
- 9 existing test files across 3 phases, ~1,380 lines total

### 5.1 Detector Tests (0% coverage — CRITICAL)

**Priority:** CRITICAL — Core business logic completely untested
**Effort:** 3-4 hours

| Detector | Lines | Test Needed |
|----------|-------|-------------|
| `accountDetector.ts` | 150+ | Pattern matching, confidence scoring, known service detection |
| `purchaseDetector.ts` | 150+ | Amount extraction, currency detection, anti-pattern logic |
| `subscriptionDetector.ts` | 100+ | Renewal detection, billing patterns, domain matching |
| `newsletterDetector.ts` | 120+ | Promotional patterns, unsubscribe detection, frequency calc |

### 5.2 Store Tests (0% coverage — HIGH)

**Priority:** HIGH — 400+ lines of state logic untested
**Effort:** 2-3 hours

Test: `initialize()`, `toggleEmailStar()`, `toggleEmailRead()`, `deleteEmail()`, `archiveEmail()`, `moveEmailToFolder()`, `createFolder()`, `emptyTrash()`, `exportData()`, error handling in async actions, state consistency.

### 5.3 Missing Parser Tests (HIGH)

**Priority:** HIGH
**Effort:** 2-3 hours

| Parser | Current Coverage | Missing |
|--------|-----------------|---------|
| OLM Parser | 0% | XML parsing, folder extraction, contact/calendar parsing |
| Gmail Takeout Parser | 0% | ZIP structure, folder mapping, deduplication |
| MBOX Parser | Basic only | Base64, MIME multipart, malformed headers, attachments |

### 5.4 Component Tests (0% coverage)

**Priority:** MEDIUM — 26+ components untested
**Effort:** 4-6 hours for critical components

Focus on: `FileDropzone`, `SearchInput`, `EmailCard`, `VirtualEmailList`, `AttachmentPreview`, modals.

### 5.5 Integration Tests (None exist)

**Priority:** MEDIUM
**Effort:** 3-4 hours

Test flows: file upload -> parse -> detect -> store, backup -> import -> restore, search across parsed data.

### 5.6 Add CI/CD Test Pipeline

**Priority:** HIGH — No automated testing before deploy
**Effort:** 30 minutes

Create `.github/workflows/test.yml` with jobs for: checkout, install, lint, test, build.

---

## Phase 6: Production Readiness

> Legal, operational, and deployment items needed for a real launch.

### 6.1 Add LICENSE File

**Priority:** HIGH — Unclear usage rights for GitHub repo
**Location:** Repository root
**Effort:** 5 minutes

Add MIT license (or your preference).

### 6.2 Add Privacy Policy

**Priority:** HIGH — Required for an email analyzer
**Location:** Could be a page in the app or a static document
**Effort:** 1-2 hours

Must cover:
- All processing happens client-side
- No data leaves the device (after font fix)
- IndexedDB storage explanation
- User's right to delete data
- Third-party library usage
- Encryption capabilities

### 6.3 Add robots.txt

**Priority:** LOW
**Location:** `web/public/robots.txt`
**Effort:** 2 minutes

### 6.4 Add Web App Manifest (PWA)

**Priority:** LOW — Enables "Add to Home Screen"
**Location:** `web/public/manifest.json`
**Effort:** 15 minutes

### 6.5 Consider Error Monitoring

**Priority:** LOW — No visibility into production errors
**Effort:** 1 hour

Options: Sentry (free tier), self-hosted error tracking, or at minimum a global error handler.

---

## Phase 7: Accessibility & UX Polish

> Current accessibility: ~60%. Functional but gaps for screen readers.

### 7.1 ARIA Live Regions

**Priority:** MEDIUM — Bulk operations don't announce completion
**Location:** Bulk action areas in `EmailsPage`, toast notifications
**Effort:** 30 minutes

Add `aria-live="polite"` regions for bulk operations, search results count, import progress, toast notifications.

### 7.2 Keyboard Navigation

**Priority:** MEDIUM — Works but undocumented
**Effort:** 1 hour

- Ensure Tab order is logical on all pages
- Add Escape to close modals/sidebars
- Add keyboard shortcuts for common actions (j/k for next/prev email)
- Document shortcuts in a help dialog

### 7.3 Screen Reader Labels

**Priority:** MEDIUM — Only a few ARIA labels exist
**Location:** Most interactive components
**Effort:** 1-2 hours

Current coverage: toggle menu, theme toggle. Missing on: email list items, filter buttons, sort controls, pagination, chart visualizations, dynamic content areas.

### 7.4 Visual Advanced Search Builder

**Priority:** LOW — Current syntax-only search works but isn't discoverable
**Effort:** 4-6 hours

Add a dropdown/form UI that generates search syntax. Users shouldn't need to memorize `from:` / `to:` / `has:attachment` syntax.

---

## Phase 8: Nice-to-Have Features

> Features users might expect but aren't blocking launch.

### 8.1 Features That Would Add Value

| Feature | Complexity | Impact |
|---------|-----------|--------|
| Email preview pane (split view) | Medium | HIGH — faster email browsing |
| Saved searches UI | Low | MEDIUM — service exists, just needs UI |
| Custom labels/tags beyond star | Medium | MEDIUM — better organization |
| Export analytics as PDF/PNG | Low | LOW — chart screenshots |
| Duplicate email detection UI | Medium | LOW — dedup logic partially exists |
| Email printing | Low | LOW — print single email |
| Batch .eml export | Medium | LOW — export selected emails |

### 8.2 Features Intentionally Not Included

These are explicitly out of scope for a read-only archive viewer:
- Email composition/reply/forward
- Live email server connection
- Multi-account simultaneous view
- Collaboration/sharing features

---

## Appendix A: Full Feature Inventory

### Email Parsing & Import
- OLM (Outlook for Mac) — emails, contacts, calendar, folders
- MBOX (Gmail, Thunderbird) — streaming 5MB chunks, batch 100 emails
- Gmail Takeout ZIP — folder mapping, deduplication
- Web Worker processing with progress tracking
- Drag-and-drop file upload

### Email Management
- Browse, search, star, archive, delete, restore
- Folder system: Inbox, Sent, Drafts, Spam, Archive, Trash, custom folders
- Threading/conversation grouping
- Read/unread tracking
- Multiple view modes: paginated, virtual scrolling, thread view
- Email detail with HTML/plain text support

### Search & Filtering
- Advanced syntax: `from:`, `to:`, `subject:`, `body:`, `date:`, `before:`, `after:`
- Status filters: `has:attachment`, `is:unread`, `is:starred`, `is:read`
- Type filters: `type:purchase`, `type:account`
- Folder filters: `in:inbox`, `in:archive`, `in:trash`
- Real-time search across subjects and senders
- Sort: date, sender, subject

### Auto-Detection
- Account signups (17 subject patterns, service domain matching)
- Purchases (amount, merchant, order number, currency, anti-pattern detection)
- Subscriptions (renewal detection, monthly/yearly costs)
- Newsletters (promotional detection, unsubscribe links, frequency)

### Data Organization
- Contacts with phone, notes, tags, email frequency
- Calendar events with attendees, locations, time zones
- Attachment browsing with preview and download
- Sender/organization grouping and analysis

### Analytics
- Email volume charts (monthly trends)
- Top senders chart
- Spending analysis (monthly, by category)
- Activity heatmap (by day and hour)
- Year-based filtering

### Export & Backup
- Complete backup (all data + metadata)
- JSON export (email data)
- CSV export (spreadsheet-compatible)
- Selective export (choose data types)
- Encrypted backups (AES-GCM, PBKDF2)
- Import from backup

### UI/UX
- Dark mode with system preference detection
- Responsive mobile design with hamburger sidebar
- Virtual scrolling for large lists
- Empty states for all sections
- Loading states with progress bars
- Error states with user-friendly messages
- Undo toasts for destructive actions
- Confirmation dialogs for dangerous operations

---

## Appendix B: File Reference Map

### Critical Files for Each Phase

**Phase 1 (Build Fix):**
- `web/src/types/index.ts` — Interface definitions
- `web/src/pages/AnalyticsPage.tsx` — StatsCard props
- `web/src/services/gmailTakeoutParser.ts` — Unused function
- `web/src/services/purchaseDetector.ts` — Unused patterns
- `web/src/services/olmParser.ts` — Subscription frequency

**Phase 2 (Security):**
- `web/src/pages/EmailDetailPage.tsx:275-312` — XSS fix
- `web/index.html:32-34` — Google Fonts removal
- `vercel.json` — CSP headers
- `web/src/services/olmParser.ts:48` — ZIP bomb protection
- `web/src/services/gmailTakeoutParser.ts:30` — ZIP bomb protection
- `web/src/services/searchParser.ts` — ReDoS prevention
- `web/src/services/encryptionService.ts:69-80` — localStorage token

**Phase 3 (Performance):**
- `web/src/App.tsx` — Route lazy loading
- `web/vite.config.ts` — Build configuration
- `web/src/store/index.ts:305-320` — Store O(n) lookups
- `web/src/pages/EmailsPage.tsx:113-119` — Search scanning
- `web/src/store/index.ts:115` — Full email loading
- `web/src/components/EmailCard.tsx` — React.memo
- `web/public/og-image.png` — Image compression

**Phase 4 (Code Quality):**
- `web/src/store/index.ts` — console.error cleanup, race condition
- `web/src/db/database.ts` — Timestamp helpers, type safety, folder constants
- `web/src/services/olmParser.ts` — Batch contact tracking
- `web/src/services/mboxParser.ts` — Parser error reporting

**Phase 5 (Tests):**
- `web/src/services/accountDetector.ts` — Needs tests
- `web/src/services/purchaseDetector.ts` — Needs tests
- `web/src/services/subscriptionDetector.ts` — Needs tests
- `web/src/services/newsletterDetector.ts` — Needs tests
- `web/src/store/index.ts` — Needs tests
- `web/src/services/olmParser.ts` — Needs tests
- `web/src/services/gmailTakeoutParser.ts` — Needs tests

---

## Appendix C: Dependency Audit

### Production Dependencies

| Package | Version | Size | Status |
|---------|---------|------|--------|
| react | 19.2.0 | ~40KB | OK |
| react-dom | 19.2.0 | ~130KB | OK |
| react-router-dom | 7.10.1 | ~25KB | VULNERABLE — update |
| zustand | 5.0.9 | ~2KB | Excellent (lightweight) |
| dexie | 4.2.1 | ~20KB | OK |
| recharts | 3.6.0 | ~200KB | Heavy — lazy load |
| jszip | 3.10.1 | ~45KB | OK (necessary) |
| dompurify | 3.3.1 | ~15KB | OK (security-critical) |
| react-dnd | 16.0.1 | ~100KB | Heavy — lazy load |
| date-fns | 4.1.0 | ~40KB | OK (tree-shakeable) |
| lucide-react | 0.561.0 | ~60KB | OK (tree-shakeable) |
| @tanstack/react-virtual | 3.13.13 | ~10KB | Excellent |

### Estimated Bundle Impact
- **Current total (gzipped):** ~400-500KB
- **After lazy loading recharts + code splitting:** ~250-350KB
- **Target:** under 300KB initial bundle

---

## Phase Summary

| Phase | Items | Effort | Impact |
|-------|-------|--------|--------|
| **1. Critical Blockers** | 4 items | 2-3 hours | Build works, security holes closed |
| **2. Security Hardening** | 5 items | 1.5 hours | Privacy claims honest, inputs validated |
| **3. Performance** | 7 items | 6-10 hours | Fast for large archives |
| **4. Code Quality** | 7 items | 2-3 hours | Maintainable, fewer bugs |
| **5. Test Coverage** | 6 items | 15-20 hours | Confidence in releases |
| **6. Production Readiness** | 5 items | 2-3 hours | Legally and operationally ready |
| **7. Accessibility** | 4 items | 3-5 hours | Usable by everyone |
| **8. Nice-to-Have** | 7 items | Variable | Delight users |

**Minimum to ship (Phases 1-2):** ~4-5 hours
**Solid V1 (Phases 1-4):** ~12-17 hours
**Complete V1 (Phases 1-7):** ~30-45 hours
