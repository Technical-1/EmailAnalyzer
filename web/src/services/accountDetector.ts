import type { Email, Account, DetectionResult } from '../types';

class AccountDetector {
  // Strong subject line patterns for account signups (must be primary purpose of email)
  private readonly strongSubjectPatterns = [
    /^welcome to/i,
    /^verify your.*(?:email|account)/i,
    /^confirm your.*(?:email|account|registration)/i,
    /^activate your.*account/i,
    /^your.*account.*(?:has been |is )created/i,
    /^(?:complete|finish) your registration/i,
    /^thanks for (?:signing up|registering|joining)/i,
    /^you(?:'re| are) (?:in|registered)/i,
    /email verification/i,
    /account verification/i,
  ];

  // Strong body patterns (high confidence indicators)
  private readonly strongBodyPatterns = [
    /click.*(?:here|below|button).*(?:to )?verify your email/i,
    /confirm your email address/i,
    /complete your registration/i,
    /your account has been (?:successfully )?created/i,
    /welcome to .{2,50}[!.]/i,
    /thanks for (?:signing up|registering|creating an account)/i,
    /verification code[:\s]+\d{4,8}/i,
    /your verification code is/i,
  ];

  // Known service domains for reliable detection
  private readonly knownServices: Record<string, { name: string; type: Account['serviceType'] }> = {
    'netflix.com': { name: 'Netflix', type: 'streaming' },
    'spotify.com': { name: 'Spotify', type: 'streaming' },
    'hulu.com': { name: 'Hulu', type: 'streaming' },
    'disneyplus.com': { name: 'Disney+', type: 'streaming' },
    'hbomax.com': { name: 'HBO Max', type: 'streaming' },
    'max.com': { name: 'Max', type: 'streaming' },
    'peacocktv.com': { name: 'Peacock', type: 'streaming' },
    'paramountplus.com': { name: 'Paramount+', type: 'streaming' },
    'primevideo.com': { name: 'Prime Video', type: 'streaming' },
    'crunchyroll.com': { name: 'Crunchyroll', type: 'streaming' },
    'youtube.com': { name: 'YouTube', type: 'streaming' },
    'twitch.tv': { name: 'Twitch', type: 'streaming' },
    'amazon.com': { name: 'Amazon', type: 'ecommerce' },
    'ebay.com': { name: 'eBay', type: 'ecommerce' },
    'etsy.com': { name: 'Etsy', type: 'ecommerce' },
    'shopify.com': { name: 'Shopify', type: 'ecommerce' },
    'walmart.com': { name: 'Walmart', type: 'ecommerce' },
    'target.com': { name: 'Target', type: 'ecommerce' },
    'bestbuy.com': { name: 'Best Buy', type: 'ecommerce' },
    'aliexpress.com': { name: 'AliExpress', type: 'ecommerce' },
    'wish.com': { name: 'Wish', type: 'ecommerce' },
    'facebook.com': { name: 'Facebook', type: 'social' },
    'meta.com': { name: 'Meta', type: 'social' },
    'instagram.com': { name: 'Instagram', type: 'social' },
    'twitter.com': { name: 'Twitter', type: 'social' },
    'x.com': { name: 'X', type: 'social' },
    'linkedin.com': { name: 'LinkedIn', type: 'social' },
    'tiktok.com': { name: 'TikTok', type: 'social' },
    'reddit.com': { name: 'Reddit', type: 'social' },
    'pinterest.com': { name: 'Pinterest', type: 'social' },
    'snapchat.com': { name: 'Snapchat', type: 'social' },
    'threads.net': { name: 'Threads', type: 'social' },
    'github.com': { name: 'GitHub', type: 'development' },
    'gitlab.com': { name: 'GitLab', type: 'development' },
    'bitbucket.org': { name: 'Bitbucket', type: 'development' },
    'atlassian.com': { name: 'Atlassian', type: 'development' },
    'jetbrains.com': { name: 'JetBrains', type: 'development' },
    'stackoverflow.com': { name: 'Stack Overflow', type: 'development' },
    'heroku.com': { name: 'Heroku', type: 'development' },
    'vercel.com': { name: 'Vercel', type: 'development' },
    'netlify.com': { name: 'Netlify', type: 'development' },
    'digitalocean.com': { name: 'DigitalOcean', type: 'development' },
    'aws.amazon.com': { name: 'AWS', type: 'development' },
    'cloud.google.com': { name: 'Google Cloud', type: 'development' },
    'azure.microsoft.com': { name: 'Azure', type: 'development' },
    'slack.com': { name: 'Slack', type: 'communication' },
    'zoom.us': { name: 'Zoom', type: 'communication' },
    'discord.com': { name: 'Discord', type: 'communication' },
    'teams.microsoft.com': { name: 'Microsoft Teams', type: 'communication' },
    'telegram.org': { name: 'Telegram', type: 'communication' },
    'whatsapp.com': { name: 'WhatsApp', type: 'communication' },
    'signal.org': { name: 'Signal', type: 'communication' },
    'paypal.com': { name: 'PayPal', type: 'banking' },
    'venmo.com': { name: 'Venmo', type: 'banking' },
    'stripe.com': { name: 'Stripe', type: 'banking' },
    'chase.com': { name: 'Chase', type: 'banking' },
    'bankofamerica.com': { name: 'Bank of America', type: 'banking' },
    'wellsfargo.com': { name: 'Wells Fargo', type: 'banking' },
    'capitalone.com': { name: 'Capital One', type: 'banking' },
    'citi.com': { name: 'Citibank', type: 'banking' },
    'schwab.com': { name: 'Charles Schwab', type: 'banking' },
    'fidelity.com': { name: 'Fidelity', type: 'banking' },
    'robinhood.com': { name: 'Robinhood', type: 'banking' },
    'coinbase.com': { name: 'Coinbase', type: 'banking' },
    'dropbox.com': { name: 'Dropbox', type: 'other' },
    'box.com': { name: 'Box', type: 'other' },
    'notion.so': { name: 'Notion', type: 'other' },
    'figma.com': { name: 'Figma', type: 'other' },
    'canva.com': { name: 'Canva', type: 'other' },
    'adobe.com': { name: 'Adobe', type: 'other' },
    'microsoft.com': { name: 'Microsoft', type: 'other' },
    'google.com': { name: 'Google', type: 'other' },
    'apple.com': { name: 'Apple', type: 'other' },
    'icloud.com': { name: 'iCloud', type: 'other' },
    'uber.com': { name: 'Uber', type: 'other' },
    'lyft.com': { name: 'Lyft', type: 'other' },
    'doordash.com': { name: 'DoorDash', type: 'other' },
    'grubhub.com': { name: 'Grubhub', type: 'other' },
    'instacart.com': { name: 'Instacart', type: 'other' },
    'airbnb.com': { name: 'Airbnb', type: 'other' },
  };

  detectAccountSignup(email: Email): DetectionResult {
    const subject = email.subject || '';
    const body = this.stripHtml(email.body || '');
    const sender = email.sender || '';

    let confidence = 0;
    let detectedService = '';
    let serviceType: Account['serviceType'] = 'other';

    // Check if sender is from a known service
    const domain = this.extractDomain(sender);
    const serviceInfo = this.findKnownService(domain);

    if (serviceInfo) {
      detectedService = serviceInfo.name;
      serviceType = serviceInfo.type;
      confidence += 40; // Known service gives base confidence
    }

    // Check strong subject patterns
    for (const pattern of this.strongSubjectPatterns) {
      if (pattern.test(subject)) {
        confidence += 40;
        break;
      }
    }

    // Check strong body patterns
    for (const pattern of this.strongBodyPatterns) {
      if (pattern.test(body)) {
        confidence += 30;
        break;
      }
    }

    // If we have strong patterns but no known service, try to extract service name
    if (confidence >= 40 && !detectedService) {
      const extracted = this.extractServiceName(subject, body);
      if (extracted) {
        detectedService = extracted;
        confidence += 10;
      } else {
        // Use domain as fallback service name (but only if patterns matched)
        detectedService = this.formatDomainAsServiceName(domain);
      }
    }

    // Require high confidence AND a service name
    if (confidence >= 70 && detectedService) {
      return {
        type: 'account',
        confidence,
        data: {
          serviceName: detectedService,
          serviceType,
        },
      };
    }

    return { type: 'none', confidence: 0 };
  }

  private stripHtml(text: string): string {
    // Remove HTML tags and decode entities
    return text
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractDomain(email: string): string {
    const match = email.match(/@(.+)/);
    return match ? match[1].toLowerCase() : '';
  }

  private findKnownService(domain: string): { name: string; type: Account['serviceType'] } | null {
    // Direct match
    if (this.knownServices[domain]) {
      return this.knownServices[domain];
    }

    // Check if domain ends with a known service domain
    for (const [serviceDomain, info] of Object.entries(this.knownServices)) {
      if (domain === serviceDomain || domain.endsWith('.' + serviceDomain)) {
        return info;
      }
    }

    // Check common subdomains (e.g., mail.netflix.com, noreply.spotify.com)
    for (const [serviceDomain, info] of Object.entries(this.knownServices)) {
      const baseDomain = serviceDomain.split('.')[0];
      if (domain.includes(baseDomain + '.') || domain.includes('.' + baseDomain)) {
        return info;
      }
    }

    return null;
  }

  private extractServiceName(subject: string, _body: string): string {
    // Very strict patterns - only match clear service name mentions
    const patterns = [
      /^welcome to ([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)[!.,]/i,
      /thanks for (?:signing up|joining|registering) (?:for |with )?([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?)[!.,]/i,
      /your ([A-Z][a-zA-Z0-9]+(?:\s[A-Z][a-zA-Z0-9]+)?) account (?:has been |is )?(?:created|ready)/i,
    ];

    // Check subject first (more reliable)
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match && match[1]) {
        const name = match[1].trim();
        // Validate it looks like a service name (2-30 chars, starts with letter)
        if (name.length >= 2 && name.length <= 30 && /^[A-Z]/i.test(name)) {
          return name;
        }
      }
    }

    return '';
  }

  private formatDomainAsServiceName(domain: string): string {
    if (!domain) return '';
    
    // Get the main part of the domain (before the TLD)
    const parts = domain.split('.');
    if (parts.length < 2) return '';
    
    // For subdomains, try to get the main domain
    let mainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    
    // Skip common email subdomains
    const skipWords = ['mail', 'email', 'noreply', 'no-reply', 'notifications', 'info', 'support', 'news', 'newsletter'];
    if (skipWords.includes(mainPart.toLowerCase())) {
      mainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    }
    
    // Capitalize first letter
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
  }

  getServiceType(domain: string): Account['serviceType'] {
    const serviceInfo = this.findKnownService(domain);
    return serviceInfo ? serviceInfo.type : 'other';
  }

  createAccountFromEmail(email: Email, serviceName: string, serviceType?: Account['serviceType']): Omit<Account, 'id'> {
    const senderDomain = this.extractDomain(email.sender);

    return {
      serviceName,
      signupEmailId: email.id,
      signupDate: email.date,
      serviceType: serviceType || this.getServiceType(senderDomain),
      domain: senderDomain,
      lastActivityDate: email.date,
      emailCount: 1,
    };
  }
}

export const accountDetector = new AccountDetector();
