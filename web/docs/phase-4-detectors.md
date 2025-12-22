# Phase 4: New Detectors

This document covers the subscription and newsletter detection features.

## Overview

Phase 4 adds detectors for identifying recurring subscription services and promotional/newsletter emails, including the ability to extract unsubscribe links.

## Features Implemented

### 1. Subscription Detector

**Location:** `src/services/subscriptionDetector.ts`

Identifies emails related to recurring subscription services.

#### Known Services:

**Streaming (20+):**
Netflix, Spotify, Hulu, Disney+, HBO Max, Apple TV+, Prime Video, Peacock, Paramount+, Crunchyroll, Audible, YouTube Premium, Pandora, Deezer, Tidal, Twitch

**Software (15+):**
Adobe Creative Cloud, Microsoft 365, Dropbox, Notion, 1Password, LastPass, Bitwarden, Grammarly, Canva Pro, Figma, Slack, Zoom, GitHub, JetBrains, NordVPN, ExpressVPN, Surfshark

**News/Publications:**
New York Times, Washington Post, Wall Street Journal, The Economist, Medium, Substack

**Fitness/Wellness:**
Peloton, ClassPass, MyFitnessPal, Strava, Fitbit Premium, Calm, Headspace

**Other:**
Amazon Prime, Costco Membership, LinkedIn Premium, Evernote

#### Usage:

```typescript
import { subscriptionDetector } from './services/subscriptionDetector';

const result = subscriptionDetector.detectSubscription(email);

if (result.isSubscription) {
  console.log('Service:', result.serviceName);
  console.log('Category:', result.category); // streaming, software, news, fitness, other
  console.log('Amount:', result.amount);
  console.log('Frequency:', result.frequency); // weekly, monthly, yearly
}
```

#### Detection Patterns:

- "Subscription confirmed/renewed/receipt"
- "Your monthly/yearly subscription"
- "Subscription renewal/billing/payment"
- "Auto-renewal" notifications
- "Recurring payment/charge"
- "Next billing date"

### 2. Newsletter Detector

**Location:** `src/services/newsletterDetector.ts`

Identifies newsletters and promotional marketing emails.

#### Usage:

```typescript
import { newsletterDetector } from './services/newsletterDetector';

const result = newsletterDetector.detectNewsletter(email);

if (result.isPromotional) {
  console.log('This is a promotional email');
} else if (result.isNewsletter) {
  console.log('This is a newsletter');
}

console.log('Confidence:', result.confidence);
console.log('Unsubscribe link:', result.unsubscribeLink);
```

#### Newsletter Subject Patterns:

- "Newsletter"
- "Weekly/Monthly/Daily digest/update/roundup"
- "Latest news/updates/articles"
- "Edition #X" / "Issue #X"
- "Vol. X"

#### Promotional Subject Patterns:

- "Save X% off"
- "Up to X% off"
- "Sale ends/starts"
- "Flash sale"
- "Limited time"
- "Free shipping/delivery/gift"
- "Exclusive offer/deal/discount"
- "Don't miss out"
- "Last chance"
- "Promo code" / "Coupon code"
- "BOGO" / "Buy X get Y"
- "Black Friday" / "Cyber Monday"

#### Marketing Body Indicators:

- "Unsubscribe" links
- "Manage email preferences"
- "View in browser"
- "Forward to a friend"
- Copyright notices
- Privacy policy links

### 3. Unsubscribe Link Extraction

Built into the newsletter detector.

```typescript
const result = newsletterDetector.detectNewsletter(email);

if (result.unsubscribeLink) {
  // Open in new tab
  window.open(result.unsubscribeLink, '_blank');
}
```

#### Extraction Patterns:

1. Links containing "unsubscribe" in URL
2. Links containing "opt-out" in URL
3. Links to "email preferences" or "manage preferences"
4. Anchor tags with "unsubscribe" text

### 4. Categorization

```typescript
const category = newsletterDetector.categorize(email);
// Returns: 'newsletter' | 'promotional' | 'regular'
```

### 5. Group by Sender

Get all newsletters grouped by sender:

```typescript
const newsletters = newsletterDetector.groupBySender(emails);

newsletters.forEach((newsletter, sender) => {
  console.log(`${newsletter.senderName}: ${newsletter.emailCount} emails`);
  if (newsletter.unsubscribeLink) {
    console.log(`Unsubscribe: ${newsletter.unsubscribeLink}`);
  }
});
```

## Data Types

```typescript
interface Subscription {
  id?: number;
  serviceName: string;
  monthlyAmount: number;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  lastRenewalDate: Date;
  nextRenewalDate?: Date;
  emailIds: number[];
  isActive: boolean;
  category: 'streaming' | 'software' | 'news' | 'fitness' | 'other';
}

interface Newsletter {
  id?: number;
  senderEmail: string;
  senderName: string;
  emailCount: number;
  lastEmailDate: Date;
  unsubscribeLink?: string;
  isPromotional: boolean;
}
```

## Integration with Email Import

The detectors can be integrated into the OLM parsing pipeline:

```typescript
// During email import
for (const email of parsedEmails) {
  // Check for subscription
  const subResult = subscriptionDetector.detectSubscription(email);
  if (subResult.isSubscription) {
    // Track subscription
  }

  // Check for newsletter/promotional
  const newsResult = newsletterDetector.detectNewsletter(email);
  if (newsResult.isPromotional || newsResult.isNewsletter) {
    // Categorize email
    email.category = newsResult.isPromotional ? 'promotional' : 'newsletter';
  }
}
```

## Confidence Scoring

Both detectors use confidence scoring:

- **30+ points**: Subject pattern match
- **20-25 points**: Body pattern matches
- **15-20 points**: Known service domain
- **10-15 points**: Unsubscribe link present

Threshold for detection: **40 points**

## Troubleshooting

### Missing Subscriptions

1. Check if service domain is in known list
2. Verify email contains subscription keywords
3. Add custom patterns for niche services

### Promotional Emails Not Detected

1. Some transactional emails may look promotional
2. Check subject for marketing language
3. Verify body contains marketing indicators

### Unsubscribe Link Not Found

1. Link may be in image-only emails
2. May use tracking redirects
3. Some emails use "Preferences" instead of "Unsubscribe"

