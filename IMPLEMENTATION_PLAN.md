# Email Analyzer - Complete Implementation Plan

## Overview

This document provides a comprehensive, phased implementation plan for all features of the Email Analyzer application. Each phase includes detailed specifications, code implementations, tests, and documentation to enable another AI agent or developer to follow and complete the implementation.

## Timeline Summary

| Phase | Name | Duration | Focus |
|-------|------|----------|-------|
| 1 | Performance & Efficiency | Week 1-2 | Web Workers, Virtual Scrolling, IndexedDB Optimization |
| 2 | Email Organization | Week 2-3 | Threading, Drag & Drop, Undo Actions |
| 3 | Smart Search & Detection | Week 3-4 | Advanced Search, Improved Detection, Custom Rules |
| 4 | New Detectors | Week 4-5 | Subscriptions, Newsletters, Unsubscribe Links |
| 5 | Analytics Dashboard | Week 5-6 | Charts, Visualizations, Statistics |
| 6 | Attachment Handling | Week 6-7 | Preview, Gallery, Download |
| 7 | Import/Export & Security | Week 7-8 | MBOX, Gmail Takeout, Encryption, Backup |
| 8 | UX Polish | Week 8 | Dark Mode, vCard, Print, Mobile |

---

## Phase 1: Performance & Efficiency

**Duration**: Week 1-2
**Documentation**: `web/docs/phase-1-performance.md`

### Features

1. **Web Worker for OLM Parsing**
   - Move heavy parsing to background thread
   - Prevent UI freezing during imports
   - Progress reporting from worker

2. **IndexedDB Optimization**
   - Composite indexes for common queries
   - `[folderId+date]`, `[emailType+date]`, `threadId`
   - Batch operations with `bulkAdd`

3. **Virtual Scrolling**
   - Render only visible emails
   - Handle 10,000+ email lists
   - Maintain scroll position

4. **Lazy Loading**
   - Load email headers first
   - Fetch body content on demand
   - Reduce memory footprint

### Implementation Files

| File | Purpose |
|------|---------|
| `src/workers/olmWorker.ts` | Background OLM parsing |
| `src/services/workerOlmParser.ts` | Worker interface |
| `src/components/VirtualEmailList.tsx` | Virtualized list |
| `src/hooks/useLazyEmailBody.ts` | Body lazy loading |
| `src/db/database.ts` | Updated schema with indexes |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-1/database.test.ts` | IndexedDB operations |
| `src/__tests__/phase-1/virtualList.test.ts` | Virtual scrolling |
| `src/__tests__/phase-1/lazyLoading.test.ts` | Lazy body loading |

### Dependencies

```json
{
  "@tanstack/react-virtual": "^3.13.13"
}
```

---

## Phase 2: Email Organization

**Duration**: Week 2-3
**Documentation**: `web/docs/phase-2-threading.md`

### Features

1. **Email Threading / Conversations**
   - Group emails by `threadId` or subject
   - Collapsible conversation view
   - "View conversation" button

2. **Drag & Drop Organization**
   - Drag emails to sidebar folders
   - Multi-select with Shift+Click
   - Visual drop indicators

3. **Undo Actions**
   - Toast notification after actions
   - 5-second undo window
   - Restore original state

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/threadingService.ts` | Thread grouping logic |
| `src/components/ThreadView.tsx` | Conversation display |
| `src/components/DraggableEmailCard.tsx` | Draggable wrapper |
| `src/components/DroppableFolderItem.tsx` | Drop target |
| `src/components/DndProvider.tsx` | DnD context |
| `src/components/UndoToast.tsx` | Undo notifications |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-2/threadingService.test.ts` | Thread grouping |
| `src/__tests__/phase-2/dragDrop.test.ts` | Drag and drop |
| `src/__tests__/phase-2/undoToast.test.ts` | Undo functionality |

### Dependencies

```json
{
  "react-dnd": "^16.0.1",
  "react-dnd-html5-backend": "^16.0.1"
}
```

---

## Phase 3: Smart Search & Detection

**Duration**: Week 3-4
**Documentation**: `web/docs/phase-3-search-detection.md`

### Features

1. **Advanced Search Syntax**
   - `from:`, `to:`, `subject:`, `date:` filters
   - `has:attachment`, `is:unread`, `is:starred`
   - Quoted phrases: `"exact match"`

2. **Saved Searches**
   - Save filter combinations
   - Quick access to saved searches
   - Edit and delete saved searches

3. **Improved Account Detection**
   - 100+ known services
   - Confidence scoring
   - Service type categorization

4. **Improved Purchase Detection**
   - Multi-currency (€, £, ¥)
   - Better order number extraction
   - Item extraction from receipts

5. **Custom Detection Rules**
   - User-defined rules
   - IF/THEN logic
   - Tag, move, mark actions

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/searchParser.ts` | Query parsing |
| `src/components/SearchHighlight.tsx` | Term highlighting |
| `src/services/savedSearchService.ts` | Saved searches storage |
| `src/services/accountDetector.ts` | Enhanced account detection |
| `src/services/purchaseDetector.ts` | Enhanced purchase detection |
| `src/services/customRulesEngine.ts` | User-defined rules |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-3/searchParser.test.ts` | Query parsing |
| `src/__tests__/phase-3/accountDetector.test.ts` | Account detection |
| `src/__tests__/phase-3/purchaseDetector.test.ts` | Purchase detection |
| `src/__tests__/phase-3/customRules.test.ts` | Custom rules |

---

## Phase 4: New Detectors

**Duration**: Week 4-5
**Documentation**: `web/docs/phase-4-detectors.md`

### Features

1. **Subscription Detector**
   - Recurring service detection
   - Cost tracking
   - Renewal date alerts
   - 100+ known subscription services

2. **Newsletter/Promotional Detector**
   - Marketing email identification
   - Sender reputation analysis
   - Content pattern matching

3. **Unsubscribe Link Extraction**
   - List-Unsubscribe header parsing
   - HTML link extraction
   - One-click unsubscribe support

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/subscriptionDetector.ts` | Subscription detection |
| `src/services/newsletterDetector.ts` | Newsletter detection |
| `src/utils/unsubscribeExtractor.ts` | Unsubscribe links |
| `src/pages/SubscriptionsPage.tsx` | Subscription management UI |
| `src/pages/NewsletterPage.tsx` | Newsletter management UI |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-4/subscriptionDetector.test.ts` | Subscription detection |
| `src/__tests__/phase-4/newsletterDetector.test.ts` | Newsletter detection |
| `src/__tests__/phase-4/unsubscribeExtractor.test.ts` | Link extraction |

### Type Updates

```typescript
// types/index.ts
export interface Subscription {
  id?: number;
  emailId: number;
  serviceName: string;
  startDate: Date;
  renewalDate?: Date;
  cost: number;
  currency: string;
  frequency: 'monthly' | 'annually' | 'weekly' | 'quarterly' | 'other';
  status: 'active' | 'cancelled' | 'trial';
  alertEnabled: boolean;
}
```

---

## Phase 5: Analytics Dashboard

**Duration**: Week 5-6
**Documentation**: `web/docs/phase-5-analytics.md`

### Features

1. **Email Volume Chart**
   - Emails over time
   - Daily/weekly/monthly views
   - Sent vs received

2. **Top Senders Chart**
   - Bar chart of top senders
   - Click to filter by sender
   - Email count and percentage

3. **Purchase Spending Chart**
   - Spending over time
   - Category breakdown
   - Merchant analysis

4. **Activity Heatmap**
   - Day of week vs hour
   - Email activity patterns
   - Color-coded intensity

5. **Account Timeline**
   - Account signups over time
   - Service type distribution
   - Interactive timeline

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/analyticsService.ts` | Data aggregation |
| `src/components/charts/VolumeChart.tsx` | Email volume |
| `src/components/charts/SendersChart.tsx` | Top senders |
| `src/components/charts/SpendingChart.tsx` | Purchase spending |
| `src/components/charts/ActivityHeatmap.tsx` | Activity heatmap |
| `src/components/charts/AccountTimeline.tsx` | Account timeline |
| `src/pages/AnalyticsPage.tsx` | Dashboard page |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-5/analyticsService.test.ts` | Data aggregation |
| `src/__tests__/phase-5/charts.test.ts` | Chart components |

### Dependencies

```json
{
  "recharts": "^2.15.3"
}
```

---

## Phase 6: Attachment Handling

**Duration**: Week 6-7
**Documentation**: `web/docs/phase-6-attachments.md`

### Features

1. **Image Preview**
   - Inline image display
   - Lightbox for full view
   - Zoom and pan

2. **PDF Preview**
   - Embedded PDF viewer
   - Page navigation
   - Download option

3. **Attachment Gallery**
   - Grid view of all attachments
   - Filter by file type
   - Search attachments

4. **Attachment Download**
   - Individual download
   - Batch download (ZIP)
   - Progress indication

### Implementation Files

| File | Purpose |
|------|---------|
| `src/components/attachments/AttachmentPreview.tsx` | File preview |
| `src/components/attachments/ImageViewer.tsx` | Image lightbox |
| `src/components/attachments/PdfViewer.tsx` | PDF display |
| `src/components/attachments/AttachmentGallery.tsx` | Gallery view |
| `src/services/attachmentService.ts` | Download logic |
| `src/pages/AttachmentsPage.tsx` | Gallery page |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-6/attachmentPreview.test.ts` | Preview components |
| `src/__tests__/phase-6/attachmentService.test.ts` | Download service |

---

## Phase 7: Import/Export & Security

**Duration**: Week 7-8
**Documentation**: `web/docs/phase-7-import-export.md`

### Features

1. **MBOX Parser**
   - Standard MBOX format support
   - Gmail Takeout compatible
   - Mozilla Thunderbird support
   - Quoted-printable decoding

2. **Gmail Takeout Parser**
   - ZIP structure handling
   - Label to folder mapping
   - Email deduplication

3. **Local Encryption**
   - AES-256-GCM encryption
   - PBKDF2 key derivation
   - Passphrase management

4. **Backup/Restore**
   - Full data export
   - Selective export (date range, folders)
   - Encrypted backups
   - Import validation

### Implementation Files

| File | Purpose |
|------|---------|
| `src/services/mboxParser.ts` | MBOX parsing |
| `src/services/gmailTakeoutParser.ts` | Gmail Takeout |
| `src/services/encryptionService.ts` | Encryption |
| `src/services/backupService.ts` | Backup/restore |
| `src/pages/BackupPage.tsx` | Backup UI |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-7/mboxParser.test.ts` | MBOX parsing |
| `src/__tests__/phase-7/encryptionService.test.ts` | Encryption |
| `src/__tests__/phase-7/backupService.test.ts` | Backup/restore |

---

## Phase 8: UX Polish

**Duration**: Week 8
**Documentation**: `web/docs/phase-8-ux-polish.md`

### Features

1. **Dark Mode Toggle**
   - Explicit toggle control
   - Light/Dark/System options
   - Persistent preference

2. **vCard Contact Export**
   - Standard vCard 3.0 format
   - Single and batch export
   - Name parsing

3. **Print-Friendly Email View**
   - Clean print layout
   - Proper header formatting
   - Attachment list

4. **Mobile Responsive Design**
   - Collapsible sidebar
   - Bottom tab navigation
   - Touch-friendly targets

### Implementation Files

| File | Purpose |
|------|---------|
| `src/hooks/useTheme.ts` | Theme management |
| `src/components/ThemeToggle.tsx` | Theme toggle UI |
| `src/services/vcardExporter.ts` | vCard export |
| `src/components/PrintableEmail.tsx` | Print view |
| `src/components/MobileNav.tsx` | Mobile navigation |
| `src/styles/responsive.css` | Responsive styles |

### Tests

| File | Coverage |
|------|----------|
| `src/__tests__/phase-8/theme.test.ts` | Theme hook |
| `src/__tests__/phase-8/vcardExporter.test.ts` | vCard export |

---

## Complete Type Definitions

### Updated Email Interface

```typescript
export interface Email {
  id?: number;
  subject: string;
  sender: string;
  senderName?: string;
  recipients: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments: Attachment[];
  size: number;
  isRead: boolean;
  isStarred: boolean;
  folderId: string;
  threadId?: string;
  emailType: 'regular' | 'purchase' | 'account' | 'subscription' | 'newsletter';
  tags?: string[];
}
```

### Updated Purchase Interface

```typescript
export interface Purchase {
  id?: number;
  emailId?: number;
  merchant: string;
  amount: number;
  currency: string;
  purchaseDate: Date;
  orderNumber?: string;
  items: string[];
  category: string;
}
```

### New Subscription Interface

```typescript
export interface Subscription {
  id?: number;
  emailId: number;
  serviceName: string;
  startDate: Date;
  renewalDate?: Date;
  cost: number;
  currency: string;
  frequency: 'monthly' | 'annually' | 'weekly' | 'quarterly' | 'other';
  status: 'active' | 'cancelled' | 'trial';
  alertEnabled: boolean;
}
```

### New Contact Interface

```typescript
export interface Contact {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  emailCount: number;
  lastContact?: Date;
}
```

---

## Database Schema (Final)

```typescript
// db/database.ts
this.version(4).stores({
  emails: '++id, sender, date, [folderId+date], [emailType+date], threadId, subject',
  accounts: '++id, serviceName, serviceType, domain, signupDate',
  purchases: '++id, merchant, amount, purchaseDate, category, currency',
  contacts: '++id, name, email, emailCount',
  calendarEvents: '++id, title, startDate, endDate, isAllDay',
  folders: 'id, name, isSystem, createdAt',
  subscriptions: '++id, serviceName, status, renewalDate, cost',
  savedSearches: '++id, name, query, createdAt',
  customRules: '++id, name, isEnabled, createdAt',
});
```

---

## Testing Strategy

### Unit Tests
- All services have corresponding test files
- Minimum 80% code coverage target
- Mock IndexedDB with `fake-indexeddb`

### Integration Tests
- Full workflow tests (import → detect → display)
- Database round-trip tests
- Component integration tests

### Running Tests

```bash
# Run all tests
npm run test

# Run specific phase
npm run test -- --grep "phase-1"

# Run with coverage
npm run test -- --coverage
```

---

## Dependencies Summary

```json
{
  "dependencies": {
    "@tanstack/react-virtual": "^3.13.13",
    "date-fns": "^4.1.0",
    "dexie": "^4.2.1",
    "jszip": "^3.10.1",
    "lucide-react": "^0.561.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "react-router-dom": "^7.10.1",
    "recharts": "^2.15.3",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@types/jsdom": "^27.0.0",
    "fake-indexeddb": "^6.2.5",
    "jsdom": "^27.3.0",
    "vitest": "^4.0.16"
  }
}
```

---

## File Structure (Final)

```
web/
├── docs/
│   ├── phase-1-performance.md
│   ├── phase-2-threading.md
│   ├── phase-3-search-detection.md
│   ├── phase-4-detectors.md
│   ├── phase-5-analytics.md
│   ├── phase-6-attachments.md
│   ├── phase-7-import-export.md
│   └── phase-8-ux-polish.md
├── src/
│   ├── __tests__/
│   │   ├── phase-1/
│   │   ├── phase-2/
│   │   ├── phase-3/
│   │   ├── phase-4/
│   │   ├── phase-5/
│   │   ├── phase-6/
│   │   ├── phase-7/
│   │   ├── phase-8/
│   │   └── setup.ts
│   ├── components/
│   │   ├── attachments/
│   │   ├── charts/
│   │   ├── DndProvider.tsx
│   │   ├── DraggableEmailCard.tsx
│   │   ├── DroppableFolderItem.tsx
│   │   ├── MobileNav.tsx
│   │   ├── PrintableEmail.tsx
│   │   ├── SearchHighlight.tsx
│   │   ├── ThemeToggle.tsx
│   │   ├── ThreadView.tsx
│   │   ├── UndoToast.tsx
│   │   └── VirtualEmailList.tsx
│   ├── db/
│   │   └── database.ts
│   ├── hooks/
│   │   ├── useLazyEmailBody.ts
│   │   └── useTheme.ts
│   ├── pages/
│   │   ├── AnalyticsPage.tsx
│   │   ├── AttachmentsPage.tsx
│   │   ├── BackupPage.tsx
│   │   ├── NewsletterPage.tsx
│   │   └── SubscriptionsPage.tsx
│   ├── services/
│   │   ├── accountDetector.ts
│   │   ├── analyticsService.ts
│   │   ├── attachmentService.ts
│   │   ├── backupService.ts
│   │   ├── customRulesEngine.ts
│   │   ├── encryptionService.ts
│   │   ├── gmailTakeoutParser.ts
│   │   ├── mboxParser.ts
│   │   ├── newsletterDetector.ts
│   │   ├── purchaseDetector.ts
│   │   ├── savedSearchService.ts
│   │   ├── searchParser.ts
│   │   ├── subscriptionDetector.ts
│   │   ├── threadingService.ts
│   │   ├── vcardExporter.ts
│   │   └── workerOlmParser.ts
│   ├── styles/
│   │   └── responsive.css
│   ├── types/
│   │   └── index.ts
│   ├── utils/
│   │   ├── emailUtils.ts
│   │   └── unsubscribeExtractor.ts
│   └── workers/
│       └── olmWorker.ts
├── vitest.config.ts
└── package.json
```

---

## Implementation Guidelines

### For AI Agents

1. **Follow Phase Order**: Phases build on each other; complete in sequence
2. **Run Tests**: After each feature, run the corresponding tests
3. **Check Documentation**: Each phase has detailed docs in `web/docs/`
4. **Use Existing Patterns**: Follow the established code style and patterns
5. **Update Types**: Ensure type definitions are updated as features are added

### For Developers

1. **Start with Phase 1**: Performance improvements are foundational
2. **Parallel Development**: Phases 4-6 can be developed in parallel
3. **Test-Driven**: Write tests before or alongside implementation
4. **Review Documentation**: Phase docs contain implementation details

---

## Acceptance Criteria

### Phase 1
- [ ] Large imports (10,000+ emails) complete without UI freeze
- [ ] Email lists scroll smoothly
- [ ] Email body loads on demand

### Phase 2
- [ ] Emails grouped into conversations
- [ ] Drag and drop works between folders
- [ ] Undo restores deleted/moved emails

### Phase 3
- [ ] Complex search queries work correctly
- [ ] Saved searches persist across sessions
- [ ] Custom rules apply to new emails

### Phase 4
- [ ] Subscriptions detected and tracked
- [ ] Newsletters identified correctly
- [ ] Unsubscribe links extracted

### Phase 5
- [ ] All charts render with data
- [ ] Heatmap shows activity patterns
- [ ] Analytics are accurate

### Phase 6
- [ ] Images preview inline
- [ ] PDFs render in viewer
- [ ] Attachments downloadable

### Phase 7
- [ ] MBOX files import successfully
- [ ] Gmail Takeout archives import
- [ ] Encrypted backups work

### Phase 8
- [ ] Dark mode toggle works
- [ ] vCard exports valid
- [ ] Mobile layout responsive

---

## Navigation & Feature Access

All features are accessible through the sidebar navigation. Here's a guide to accessing each feature:

### Sidebar Navigation Items

| Route | Icon | Description |
|-------|------|-------------|
| `/` | Upload | Import OLM, MBOX, or Gmail Takeout files |
| `/emails` | Mail | View all emails with search and filtering |
| `/emails?folder=favorites` | Star | View starred/favorite emails |
| `/emails?folder=archive` | Archive | View archived emails |
| `/emails?folder=trash` | Trash | View deleted emails (can restore or permanently delete) |
| `/senders` | Building | View emails grouped by sender |
| `/accounts` | UserCheck | View detected account signups |
| `/purchases` | ShoppingBag | View detected purchases |
| `/subscriptions` | RefreshCw | **NEW** - View detected recurring subscriptions |
| `/newsletters` | Newspaper | **NEW** - View newsletters with unsubscribe links |
| `/attachments` | Paperclip | **NEW** - Browse all attachments in gallery view |
| `/contacts` | Users | Manage extracted contacts |
| `/calendar` | Calendar | View calendar events |
| `/analytics` | BarChart3 | View email analytics and charts |
| `/backup` | Shield | **NEW** - Export/import data and manage encryption |
| `/settings` | Settings | Application settings |

### Using Smart Search

The search bar on the emails page supports advanced search syntax:

```
from:amazon subject:order date:2024
from:netflix has:attachment
subject:"account confirmation" before:2024-06-01
is:starred is:unread folder:inbox
```

**Supported Operators:**
- `from:` - Filter by sender
- `to:` - Filter by recipient  
- `subject:` - Filter by subject (use quotes for phrases)
- `date:` - Filter by date (YYYY, YYYY-MM, or YYYY-MM-DD)
- `before:` / `after:` - Date range filters
- `has:attachment` - Only emails with attachments
- `is:starred` / `is:unread` / `is:read` - Status filters
- `folder:` - Filter by folder name

### Attachment Features

1. **Browse Attachments**: Navigate to `/attachments` to see all email attachments
2. **Filter by Type**: Use filter buttons for images, documents, archives
3. **Grid/List View**: Toggle between views using the view switcher
4. **Preview**: Click any attachment to preview (images/PDFs supported)
5. **Download**: Individual or bulk download (select multiple with checkboxes)
6. **View Email**: Jump directly to the email containing an attachment

### Subscription Tracking

The Subscriptions page (`/subscriptions`) shows:
- All detected recurring subscription services
- Monthly/yearly cost estimates
- Service categories (streaming, software, fitness, etc.)
- Last renewal dates
- Number of related emails

### Newsletter Management

The Newsletters page (`/newsletters`) provides:
- All detected newsletters and promotional emails
- One-click unsubscribe links (when available)
- Filter between newsletters and promotional emails
- Email count per sender
- Last received date

### Data Backup & Security

The Backup page (`/backup`) enables:
- **Export**: Download all data as a ZIP file (optionally encrypted)
- **Import**: Restore from a previous backup
- **Encryption**: Set up passphrase-based encryption for sensitive data
- **Clear Data**: Factory reset (permanently delete all data)

### Dark Mode

Toggle dark mode using the sun/moon icon in the sidebar footer. The setting persists across sessions and respects your system preference by default.

---

## Conclusion

This implementation plan provides everything needed to build a full-featured Email Analyzer application. Each phase is self-contained with tests and documentation, allowing for incremental development and verification.

Total estimated time: **8 weeks** for full implementation.

