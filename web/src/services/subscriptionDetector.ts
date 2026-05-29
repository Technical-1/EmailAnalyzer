import type { Email, Subscription } from '../types';
import { stripHtml, extractDomain, formatDomainAsName } from '../utils/emailUtils';
import { isDomainMatch } from './domainMatch';

/**
 * Detector for recurring subscription services
 */
class SubscriptionDetector {
  // Known subscription services
  private readonly knownSubscriptions: Record<string, { name: string; category: Subscription['category'] }> = {
    // Streaming
    'netflix.com': { name: 'Netflix', category: 'streaming' },
    'spotify.com': { name: 'Spotify', category: 'streaming' },
    'hulu.com': { name: 'Hulu', category: 'streaming' },
    'disneyplus.com': { name: 'Disney+', category: 'streaming' },
    'hbomax.com': { name: 'HBO Max', category: 'streaming' },
    'max.com': { name: 'Max', category: 'streaming' },
    'appletv.apple.com': { name: 'Apple TV+', category: 'streaming' },
    'primevideo.com': { name: 'Prime Video', category: 'streaming' },
    'peacocktv.com': { name: 'Peacock', category: 'streaming' },
    'paramountplus.com': { name: 'Paramount+', category: 'streaming' },
    'crunchyroll.com': { name: 'Crunchyroll', category: 'streaming' },
    'audible.com': { name: 'Audible', category: 'streaming' },
    'youtube.com': { name: 'YouTube Premium', category: 'streaming' },
    'pandora.com': { name: 'Pandora', category: 'streaming' },
    'deezer.com': { name: 'Deezer', category: 'streaming' },
    'tidal.com': { name: 'Tidal', category: 'streaming' },
    'twitch.tv': { name: 'Twitch', category: 'streaming' },
    // Software
    'adobe.com': { name: 'Adobe Creative Cloud', category: 'software' },
    'microsoft.com': { name: 'Microsoft 365', category: 'software' },
    'office365.com': { name: 'Microsoft 365', category: 'software' },
    'dropbox.com': { name: 'Dropbox', category: 'software' },
    'notion.so': { name: 'Notion', category: 'software' },
    '1password.com': { name: '1Password', category: 'software' },
    'lastpass.com': { name: 'LastPass', category: 'software' },
    'bitwarden.com': { name: 'Bitwarden', category: 'software' },
    'grammarly.com': { name: 'Grammarly', category: 'software' },
    'canva.com': { name: 'Canva Pro', category: 'software' },
    'figma.com': { name: 'Figma', category: 'software' },
    'slack.com': { name: 'Slack', category: 'software' },
    'zoom.us': { name: 'Zoom', category: 'software' },
    'github.com': { name: 'GitHub', category: 'software' },
    'jetbrains.com': { name: 'JetBrains', category: 'software' },
    // VPN
    'nordvpn.com': { name: 'NordVPN', category: 'software' },
    'expressvpn.com': { name: 'ExpressVPN', category: 'software' },
    'surfshark.com': { name: 'Surfshark', category: 'software' },
    // News/Publications
    'nytimes.com': { name: 'New York Times', category: 'news' },
    'washingtonpost.com': { name: 'Washington Post', category: 'news' },
    'wsj.com': { name: 'Wall Street Journal', category: 'news' },
    'economist.com': { name: 'The Economist', category: 'news' },
    'medium.com': { name: 'Medium', category: 'news' },
    'substack.com': { name: 'Substack', category: 'news' },
    // Fitness
    'peloton.com': { name: 'Peloton', category: 'fitness' },
    'classpass.com': { name: 'ClassPass', category: 'fitness' },
    'myfitnesspal.com': { name: 'MyFitnessPal', category: 'fitness' },
    'strava.com': { name: 'Strava', category: 'fitness' },
    'fitbit.com': { name: 'Fitbit Premium', category: 'fitness' },
    'calm.com': { name: 'Calm', category: 'fitness' },
    'headspace.com': { name: 'Headspace', category: 'fitness' },
    // Other
    'amazon.com': { name: 'Amazon Prime', category: 'other' },
    'costco.com': { name: 'Costco Membership', category: 'other' },
    'linkedin.com': { name: 'LinkedIn Premium', category: 'other' },
    'evernote.com': { name: 'Evernote', category: 'other' },
  };

  // Subscription-related subject patterns
  private readonly subjectPatterns = [
    /subscription\s+(?:confirmed?|renewed?|receipt)/i,
    /your\s+(?:monthly|yearly|annual)\s+(?:subscription|membership|plan)/i,
    /(?:subscription|membership)\s+(?:renewal|billing|payment)/i,
    /(?:thank you|thanks)\s+for\s+(?:subscribing|your subscription)/i,
    /your\s+\w+\s+(?:subscription|membership)\s+(?:is active|has been renewed)/i,
    /billing\s+(?:receipt|statement|confirmation)/i,
    /payment\s+(?:confirmation|receipt)\s+for\s+(?:subscription|membership)/i,
    /auto.?renew(?:al|ed)?/i,
    /recurring\s+(?:payment|charge|billing)/i,
    /your\s+next\s+(?:bill|payment)\s+(?:date|is)/i,
  ];

  // Body patterns for subscription emails
  private readonly bodyPatterns = [
    /subscription\s+(?:plan|type)[:\s]+/i,
    /billing\s+period[:\s]+/i,
    /next\s+(?:billing|payment)\s+date[:\s]+/i,
    /auto.?renew(?:s|al)?\s+on/i,
    /(?:monthly|annual|yearly)\s+(?:subscription|membership|plan)/i,
    /(?:subscription|membership)\s+(?:fee|price|cost)[:\s]+[$€£]/i,
    /renews?\s+(?:on|every)\s+/i,
    /recurring\s+(?:charge|payment)[:\s]+/i,
    /cancel\s+(?:anytime|subscription|membership)/i,
  ];

  /**
   * Detect if an email is a subscription-related email
   */
  detectSubscription(email: Email): { isSubscription: boolean; serviceName?: string; category?: Subscription['category']; amount?: number; currency?: string; frequency?: Subscription['frequency'] } {
    const subject = email.subject || '';
    const body = stripHtml(email.body || '');
    const sender = email.sender || '';
    const domain = extractDomain(sender);

    let isSubscription = false;
    let serviceName: string | undefined;
    let category: Subscription['category'] | undefined;
    let amount: number | undefined;
    let currency: string | undefined;
    let frequency: Subscription['frequency'] | undefined;

    // Check known subscription services
    const knownService = this.findKnownSubscription(domain);
    if (knownService) {
      serviceName = knownService.name;
      category = knownService.category;
    }

    // Check subject patterns
    for (const pattern of this.subjectPatterns) {
      if (pattern.test(subject)) {
        isSubscription = true;
        break;
      }
    }

    // Check body patterns
    if (!isSubscription) {
      let bodyMatches = 0;
      for (const pattern of this.bodyPatterns) {
        if (pattern.test(body)) {
          bodyMatches++;
        }
      }
      if (bodyMatches >= 2) {
        isSubscription = true;
      }
    }

    // Extract subscription amount
    if (isSubscription) {
      const extracted = this.extractAmount(body);
      amount = extracted.amount;
      currency = extracted.currency;
      frequency = this.detectFrequency(body);

      // Try to extract service name from subject if not known
      if (!serviceName) {
        serviceName = this.extractServiceName(subject, body);
      }

      // Fallback to sender name or domain
      if (!serviceName || serviceName.length < 3) {
        // Use sender name if available
        if (email.senderName && email.senderName.length > 2) {
          serviceName = email.senderName;
        } else {
          // Use formatted domain as fallback
          serviceName = formatDomainAsName(domain);
        }
      }
    }

    return {
      isSubscription,
      serviceName,
      category: category || 'other',
      amount,
      currency,
      frequency,
    };
  }

  /**
   * Find known subscription service by domain
   */
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

  /**
   * Extract subscription amount from text
   * Only trusts a currency value that sits within a billing-context window.
   */
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

  /**
   * Detect billing frequency from text
   * Returns a frequency only when a billing/charge verb or per-X phrase anchors it.
   * Returns undefined when there is no billing signal.
   */
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

  /**
   * Extract service name from email content
   */
  private extractServiceName(subject: string, body: string): string | undefined {
    // Try to extract from subject
    const subjectPatterns = [
      /(?:your\s+)?([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+subscription/i,
      /subscription\s+(?:to|for)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/i,
      /welcome\s+to\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/i,
      /([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)\s+(?:membership|premium|pro|plus)/i,
    ];

    for (const pattern of subjectPatterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate it's a reasonable service name
        if (name.length >= 2 && name.length <= 30 && this.isValidServiceName(name)) {
          return name;
        }
      }
    }

    // Try to extract from body
    const bodyPatterns = [
      /(?:subscribing to|subscription to)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/i,
      /thank you for (?:joining|subscribing to)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+)?)/i,
    ];

    for (const pattern of bodyPatterns) {
      const match = body.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        if (name.length >= 2 && name.length <= 30 && this.isValidServiceName(name)) {
          return name;
        }
      }
    }

    return undefined;
  }

  /**
   * Check if a string is a valid service name (not generic words)
   */
  private isValidServiceName(name: string): boolean {
    const invalidWords = [
      'your', 'the', 'this', 'that', 'our', 'monthly', 'annual', 'yearly',
      'weekly', 'subscription', 'membership', 'billing', 'payment', 'account',
      'email', 'newsletter', 'update', 'notification', 'com', 'org', 'net',
      'edu', 'gov', 'mail', 'info', 'noreply', 'reply'
    ];
    return !invalidWords.includes(name.toLowerCase());
  }

  /**
   * Get all known subscription services
   */
  getKnownServices(): { domain: string; name: string; category: Subscription['category'] }[] {
    return Object.entries(this.knownSubscriptions).map(([domain, info]) => ({
      domain,
      ...info,
    }));
  }
}

export const subscriptionDetector = new SubscriptionDetector();

