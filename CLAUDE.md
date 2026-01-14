# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Email Archive Explorer is a privacy-first email archive analyzer that runs entirely in the browser. It parses email exports from Outlook (.olm), Gmail/Thunderbird (.mbox), and Gmail Takeout (.zip), storing everything locally in IndexedDB. No data ever leaves the user's device.

## Commands

```bash
# Development (from root or web directory)
npm run dev          # Start Vite dev server

# Build
npm run build        # TypeScript check + Vite production build

# Testing
cd web
npm test             # Run Vitest in watch mode
npm run test:run     # Run tests once
npm run test:coverage # Run tests with coverage

# Linting
cd web
npm run lint         # ESLint check
```

## Architecture

### Data Flow
1. **File Upload** → User drops .olm/.mbox/.zip file
2. **Parser Layer** → `olmParser.ts`, `mboxParser.ts`, or `gmailTakeoutParser.ts` extracts emails
3. **Detection Layer** → Services analyze each email for accounts, purchases, subscriptions, newsletters
4. **Storage** → Dexie (IndexedDB wrapper) persists everything locally
5. **State** → Zustand store syncs UI with database

### Key Directories
```
web/src/
├── db/database.ts       # Dexie schema, all DB operations
├── store/index.ts       # Zustand global state
├── services/            # Business logic
│   ├── olmParser.ts         # Outlook OLM (ZIP of XML)
│   ├── mboxParser.ts        # Standard MBOX format
│   ├── gmailTakeoutParser.ts # Google Takeout ZIP
│   ├── accountDetector.ts   # Detects service signups
│   ├── purchaseDetector.ts  # Extracts purchase data
│   ├── subscriptionDetector.ts
│   ├── newsletterDetector.ts
│   ├── threadingService.ts  # Groups emails into conversations
│   └── searchParser.ts      # Advanced search syntax parser
├── components/          # Reusable UI components
├── pages/               # Route-level components
└── types/index.ts       # All TypeScript interfaces
```

### Database Schema (Dexie/IndexedDB)
Tables: `emails`, `accounts`, `purchases`, `contacts`, `calendarEvents`, `folders`, `subscriptions`, `newsletters`

Dates are stored as timestamps (numbers) and converted to Date objects on read.

### State Management Pattern
The Zustand store (`store/index.ts`) holds all data in memory after initial load. Actions update both the database and the store to keep them in sync. Components use selectors from the store rather than querying IndexedDB directly.

### Search Syntax
Supported operators in `searchParser.ts`:
- `from:`, `to:`, `subject:`, `body:` - Field filters
- `date:2024`, `before:`, `after:` - Date filters
- `has:attachment`, `is:unread`, `is:starred`, `is:read`
- `type:purchase`, `type:account`
- `in:inbox`, `in:archive`, `in:trash` - Folder filters

### Threading
Emails are grouped into conversations by `threadingService.ts` using:
1. Explicit `threadId` from email headers
2. Normalized subject (strips Re:, Fwd:, etc.)

### Test Organization
Tests are organized by development phase in `web/src/__tests__/phase-N/`. Run all with `npm test` or a specific file with `npx vitest run path/to/test.ts`.
