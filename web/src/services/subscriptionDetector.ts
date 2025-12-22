import type { Email, Subscription } from '../types';
import { stripHtml, extractDomain } from '../utils/emailUtils';

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
      if (domain.endsWith('.' + subDomain) || domain.includes(subDomain.split('.')[0])) {
        return info;
      }
    }

    return null;
  }

  /**
   * Extract subscription amount from text
   */
  private extractAmount(text: string): { amount?: number; currency: string } {
    const currencyPatterns: { symbol: string; pattern: RegExp }[] = [
      { symbol: 'USD', pattern: /\$\s*([\d,]+\.\d{2})/i },
      { symbol: 'EUR', pattern: /€\s*([\d,]+[.,]\d{2})/i },
      { symbol: 'GBP', pattern: /£\s*([\d,]+\.\d{2})/i },
      { symbol: 'JPY', pattern: /¥\s*([\d,]+)/i },
    ];

    const contextPatterns = [
      /(?:subscription|membership)\s+(?:fee|price|cost)[:\s]+/i,
      /(?:monthly|annual|yearly)\s+(?:fee|price|cost)[:\s]+/i,
      /(?:charged|billed)[:\s]+/i,
      /(?:total|amount)[:\s]+/i,
    ];

    for (const currencyInfo of currencyPatterns) {
      const match = text.match(currencyInfo.pattern);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return { amount, currency: currencyInfo.symbol };
        }
      }
    }

    return { currency: 'USD' };
  }

  /**
   * Detect billing frequency from text
   */
  private detectFrequency(text: string): Subscription['frequency'] | undefined {
    if (/(?:yearly|annual|annually|per year|\/year)/i.test(text)) {
      return 'yearly';
    }
    if (/(?:weekly|per week|\/week)/i.test(text)) {
      return 'weekly';
    }
    if (/(?:monthly|per month|\/month|each month)/i.test(text)) {
      return 'monthly';
    }
    return 'monthly'; // Default assumption
  }

  /**
   * Extract service name from email content
   */
  private extractServiceName(subject: string, body: string): string | undefined {
    // Try to extract from "Your [Service] subscription"
    const subjectMatch = subject.match(/(?:your\s+)?(\w+(?:\s+\w+)?)\s+subscription/i);
    if (subjectMatch) {
      return subjectMatch[1];
    }

    // Try to extract from "Thank you for subscribing to [Service]"
    const bodyMatch = body.match(/(?:subscribing to|subscription to)\s+(\w+(?:\s+\w+)?)/i);
    if (bodyMatch) {
      return bodyMatch[1];
    }

    return undefined;
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

