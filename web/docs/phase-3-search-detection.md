# Phase 3: Search & Detection Improvements

This document covers the smart search, improved detection, and custom rules features.

## Overview

Phase 3 adds advanced search capabilities, improves account and purchase detection with more services and multi-currency support, and allows users to create custom rules.

## Features Implemented

### 1. Smart Search Parser

**Location:** `src/services/searchParser.ts`

Parses advanced search syntax similar to Gmail.

#### Supported Syntax:

| Operator | Example | Description |
|----------|---------|-------------|
| `from:` | `from:amazon` | Filter by sender |
| `to:` | `to:me@example.com` | Filter by recipient |
| `subject:` | `subject:order` | Search in subject |
| `body:` | `body:receipt` | Search in body |
| `date:` | `date:2024` | Filter by year |
| `date:` | `date:2024-01-15` | Filter by exact date |
| `before:` | `before:2024-06-01` | Emails before date |
| `after:` | `after:2024-01-01` | Emails after date |
| `has:` | `has:attachment` | Has attachments |
| `is:` | `is:unread` | Unread emails |
| `is:` | `is:starred` | Starred emails |
| `is:` | `is:read` | Read emails |
| `type:` | `type:purchase` | Email type |
| `in:` | `in:archive` | Folder filter |
| (free text) | `order confirmation` | General search |

#### Usage:

```typescript
import { parseSearchQuery, filterEmails } from './services/searchParser';

// Parse the search query
const parsed = parseSearchQuery('from:amazon subject:order date:2024');

// Filter emails
const results = filterEmails(allEmails, parsed);
```

#### Combining Operators:

```
from:amazon subject:order is:unread date:2024
```

#### Quoted Values:

```
subject:"order confirmation" from:"Amazon Orders"
```

### 2. Search Highlighting

**Location:** `src/components/SearchHighlight.tsx`

Highlights search terms in results.

```tsx
import { SearchHighlight } from './components/SearchHighlight';

<SearchHighlight
  text={email.subject}
  searchTerms={['order', 'amazon']}
/>
```

### 3. Saved Searches

**Location:** `src/services/savedSearchService.ts`

Persist and reuse frequent search queries.

```typescript
import { savedSearchService } from './services/savedSearchService';

// Save a search
savedSearchService.save('Amazon Orders', 'from:amazon type:purchase');

// Get all saved searches
const searches = savedSearchService.getAll();

// Get recent searches
const recent = savedSearchService.getRecent(5);

// Mark as used (updates lastUsed)
savedSearchService.markUsed(searchId);

// Delete
savedSearchService.delete(searchId);
```

### 4. Improved Account Detection

**Location:** `src/services/accountDetector.ts`

Now supports 100+ known services:

- **Streaming:** Netflix, Spotify, Hulu, Disney+, HBO Max, Apple TV+, Prime Video, Audible, Pandora, Deezer, Tidal, Crunchyroll, etc.
- **E-commerce:** Amazon, eBay, Etsy, Walmart, Target, Best Buy, Newegg, Wayfair, Zappos, Costco, etc.
- **Social:** Facebook, Instagram, Twitter/X, LinkedIn, TikTok, Reddit, Pinterest, Snapchat, Threads, etc.
- **Development:** GitHub, GitLab, Bitbucket, Vercel, Netlify, Heroku, DigitalOcean, AWS, Cloudflare, etc.
- **Communication:** Slack, Zoom, Discord, Teams, Telegram, WhatsApp, Signal, etc.
- **Banking/Finance:** PayPal, Venmo, Stripe, Chase, Bank of America, Robinhood, Coinbase, etc.
- **Other:** Dropbox, Notion, Figma, Canva, Adobe, 1Password, NordVPN, Duolingo, Peloton, etc.

### 5. Multi-Currency Purchase Detection

**Location:** `src/services/purchaseDetector.ts`

Supports multiple currencies:

| Currency | Symbol | Example |
|----------|--------|---------|
| USD | $ | $99.99 |
| EUR | € | €89,99 |
| GBP | £ | £79.99 |
| JPY | ¥ | ¥10,000 |
| CAD | C$ | C$129.99 |
| AUD | A$ | A$149.99 |
| CHF | CHF | CHF 99.00 |
| INR | ₹ | ₹7,499 |
| CNY | ¥ | ¥699.00 |
| KRW | ₩ | ₩120,000 |
| MXN | MX$ | MX$1,999 |
| BRL | R$ | R$499,99 |

#### European Format Support:

- German: `Betrag: €49,99`
- French: `Montant: €49,99`
- Spanish: `Importe: €49,99`

### 6. Custom Detection Rules

**Location:** `src/services/customRulesEngine.ts`

Users can define custom rules to tag and organize emails.

#### Rule Structure:

```typescript
interface CustomRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  createdAt: Date;
}
```

#### Condition Fields:
- `sender` - Email sender
- `subject` - Email subject
- `body` - Email body
- `recipient` - Email recipients

#### Condition Operators:
- `contains` - Contains text
- `equals` - Exact match
- `startsWith` - Starts with text
- `endsWith` - Ends with text
- `regex` - Regular expression

#### Action Types:
- `tag` - Add a tag
- `move` - Move to folder
- `star` - Star the email
- `markRead` - Mark as read

#### Usage:

```typescript
import { customRulesEngine } from './services/customRulesEngine';

// Create a rule
const rule = customRulesEngine.createRule({
  name: 'Bank Statements',
  conditions: [
    { field: 'sender', operator: 'contains', value: 'bank', caseSensitive: false },
    { field: 'subject', operator: 'contains', value: 'statement', caseSensitive: false },
  ],
  actions: [
    { type: 'tag', value: 'Bank Statement' },
    { type: 'move', value: 'finance' },
  ],
  isActive: true,
});

// Evaluate rules against an email
const actions = customRulesEngine.evaluateEmail(email);

// Parse from string format
const parsedRule = customRulesEngine.parseRuleString(
  'IF sender contains "bank" AND subject contains "statement" THEN tag "Bank Statement"'
);
```

## Testing

Tests are located in `src/__tests__/phase-3/`:

- `searchParser.test.ts` - Search parsing and filtering

Run tests:
```bash
npm test
```

## Data Types Added

```typescript
interface ParsedSearch {
  freeText: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
  dateFrom?: Date;
  dateTo?: Date;
  dateYear?: number;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  isRead?: boolean;
  type?: 'account_signup' | 'purchase' | 'regular';
  folder?: string;
}

interface SavedSearch {
  id: string;
  name: string;
  query: string;
  createdAt: Date;
  lastUsed?: Date;
}

interface CustomRule {
  id: string;
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  createdAt: Date;
}
```

## Storage

- Saved searches: `localStorage` key: `email-analyzer-saved-searches`
- Custom rules: `localStorage` key: `email-analyzer-custom-rules`

## Troubleshooting

### Search Not Finding Results

1. Check operator spelling (e.g., `from:` not `From:`)
2. Use quotes for multi-word values
3. Verify the field exists in the email

### Currency Detection Issues

1. Ensure currency symbol is directly before amount
2. Check for correct decimal separator (. vs ,)
3. Verify amount is within reasonable range

### Custom Rules Not Matching

1. Check rule is active (`isActive: true`)
2. Verify all conditions match (AND logic)
3. Test regex patterns separately
4. Check case sensitivity setting

