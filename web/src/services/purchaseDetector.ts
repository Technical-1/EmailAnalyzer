import type { Email, Purchase, DetectionResult } from '../types';
import { stripHtml, extractDomain } from '../utils/emailUtils';

class PurchaseDetector {
  // Strong subject line patterns for purchases (must be primary purpose)
  private readonly strongSubjectPatterns = [
    /^(?:your )?order (?:confirmation|receipt|#)/i,
    /^(?:your )?(?:purchase|payment) (?:confirmation|receipt)/i,
    /^receipt (?:for|from)/i,
    /^invoice (?:for|from|#)/i,
    /^thank you for your (?:order|purchase)/i,
    /^order #?\w+ (?:confirmed|shipped|delivered)/i,
    /^your .{2,30} order/i,
    /^shipping confirmation/i,
    /^payment received/i,
    /^transaction receipt/i,
  ];

  // Strong body patterns that indicate actual purchase confirmation
  private readonly strongBodyPatterns = [
    /order\s+(?:total|summary)[:\s]+\$[\d,]+\.\d{2}/i,
    /(?:amount|total)\s+(?:charged|paid)[:\s]+\$[\d,]+\.\d{2}/i,
    /you (?:have )?(?:paid|purchased|ordered)/i,
    /thank you for your (?:order|purchase) (?:of|from)/i,
    /your order has been (?:confirmed|placed|received)/i,
    /payment of \$[\d,]+\.\d{2}/i,
    /transaction amount[:\s]+\$[\d,]+\.\d{2}/i,
    /order #\s*[A-Z0-9-]{5,}/i,
    /order number[:\s]+[A-Z0-9-]{5,}/i,
  ];

  // Patterns that indicate this is NOT a purchase (promotional emails, etc.)
  private readonly antiPatterns = [
    /save \$\d+/i,
    /up to \d+% off/i,
    /free shipping/i,
    /sale ends/i,
    /limited time/i,
    /discount code/i,
    /promo code/i,
    /shop now/i,
    /buy now/i,
    /subscribe/i,
    /unsubscribe/i,
    /view in browser/i,
  ];

  // Known merchant domains for reliable detection
  private readonly knownMerchants: Record<string, string> = {
    'amazon.com': 'Amazon',
    'ebay.com': 'eBay',
    'etsy.com': 'Etsy',
    'paypal.com': 'PayPal',
    'stripe.com': 'Stripe',
    'square.com': 'Square',
    'shopify.com': 'Shopify',
    'apple.com': 'Apple',
    'google.com': 'Google',
    'microsoft.com': 'Microsoft',
    'netflix.com': 'Netflix',
    'spotify.com': 'Spotify',
    'hulu.com': 'Hulu',
    'starbucks.com': 'Starbucks',
    'mcdonalds.com': "McDonald's",
    'uber.com': 'Uber',
    'ubereats.com': 'Uber Eats',
    'doordash.com': 'DoorDash',
    'grubhub.com': 'Grubhub',
    'instacart.com': 'Instacart',
    'walmart.com': 'Walmart',
    'target.com': 'Target',
    'bestbuy.com': 'Best Buy',
    'costco.com': 'Costco',
    'homedepot.com': 'Home Depot',
    'lowes.com': "Lowe's",
    'nordstrom.com': 'Nordstrom',
    'macys.com': "Macy's",
    'kohls.com': "Kohl's",
    'gap.com': 'Gap',
    'oldnavy.com': 'Old Navy',
    'nike.com': 'Nike',
    'adidas.com': 'Adidas',
    'newegg.com': 'Newegg',
    'bhphotovideo.com': 'B&H Photo',
    'dell.com': 'Dell',
    'hp.com': 'HP',
    'lenovo.com': 'Lenovo',
    'aliexpress.com': 'AliExpress',
    'wish.com': 'Wish',
    'chewy.com': 'Chewy',
    'wayfair.com': 'Wayfair',
    'ikea.com': 'IKEA',
    'sephora.com': 'Sephora',
    'ulta.com': 'Ulta',
    'airbnb.com': 'Airbnb',
    'booking.com': 'Booking.com',
    'expedia.com': 'Expedia',
    'southwest.com': 'Southwest Airlines',
    'delta.com': 'Delta Airlines',
    'united.com': 'United Airlines',
    'american.com': 'American Airlines',
    'lyft.com': 'Lyft',
    'seamless.com': 'Seamless',
    'postmates.com': 'Postmates',
    'caviar.com': 'Caviar',
    'ticketmaster.com': 'Ticketmaster',
    'stubhub.com': 'StubHub',
    'seatgeek.com': 'SeatGeek',
    'eventbrite.com': 'Eventbrite',
    'steamgames.com': 'Steam',
    'steampowered.com': 'Steam',
    'epicgames.com': 'Epic Games',
    'playstation.com': 'PlayStation',
    'xbox.com': 'Xbox',
    'nintendo.com': 'Nintendo',
  };

  // Merchant category mappings
  private readonly merchantCategories: Record<string, string> = {
    'amazon': 'ecommerce',
    'ebay': 'ecommerce',
    'etsy': 'ecommerce',
    'walmart': 'ecommerce',
    'target': 'ecommerce',
    'costco': 'ecommerce',
    'wayfair': 'ecommerce',
    'aliexpress': 'ecommerce',
    'wish': 'ecommerce',
    'shopify': 'ecommerce',
    'best buy': 'technology',
    'newegg': 'technology',
    'b&h photo': 'technology',
    'apple': 'technology',
    'dell': 'technology',
    'hp': 'technology',
    'lenovo': 'technology',
    'microsoft': 'technology',
    'paypal': 'payment',
    'stripe': 'payment',
    'square': 'payment',
    'venmo': 'payment',
    'netflix': 'entertainment',
    'spotify': 'entertainment',
    'hulu': 'entertainment',
    'disney+': 'entertainment',
    'hbo max': 'entertainment',
    'steam': 'entertainment',
    'epic games': 'entertainment',
    'playstation': 'entertainment',
    'xbox': 'entertainment',
    'nintendo': 'entertainment',
    'ticketmaster': 'entertainment',
    'stubhub': 'entertainment',
    'seatgeek': 'entertainment',
    'eventbrite': 'entertainment',
    'starbucks': 'food',
    'mcdonalds': 'food',
    "mcdonald's": 'food',
    'doordash': 'food',
    'grubhub': 'food',
    'uber eats': 'food',
    'instacart': 'food',
    'seamless': 'food',
    'postmates': 'food',
    'caviar': 'food',
    'uber': 'transportation',
    'lyft': 'transportation',
    'southwest': 'travel',
    'delta': 'travel',
    'united': 'travel',
    'american': 'travel',
    'airbnb': 'travel',
    'booking.com': 'travel',
    'expedia': 'travel',
    'home depot': 'home',
    "lowe's": 'home',
    'ikea': 'home',
    'nordstrom': 'fashion',
    "macy's": 'fashion',
    "kohl's": 'fashion',
    'gap': 'fashion',
    'old navy': 'fashion',
    'nike': 'fashion',
    'adidas': 'fashion',
    'sephora': 'beauty',
    'ulta': 'beauty',
    'chewy': 'pets',
  };

  detectPurchase(email: Email): DetectionResult {
    const subject = email.subject || '';
    const body = stripHtml(email.body || '');
    const sender = email.sender || '';

    // Check for anti-patterns first (promotional emails)
    const combinedText = `${subject} ${body}`;
    let antiPatternMatches = 0;
    for (const pattern of this.antiPatterns) {
      if (pattern.test(combinedText)) {
        antiPatternMatches++;
      }
    }
    // If too many promotional patterns, it's likely not a real purchase
    if (antiPatternMatches >= 3) {
      return { type: 'none', confidence: 0 };
    }

    let confidence = 0;
    let amount = 0;
    let merchant = '';
    let orderNumber = '';

    // Check if sender is from a known merchant
    const domain = extractDomain(sender);
    const knownMerchant = this.findKnownMerchant(domain);
    if (knownMerchant) {
      merchant = knownMerchant;
      confidence += 30;
    }

    // Check strong subject patterns
    for (const pattern of this.strongSubjectPatterns) {
      if (pattern.test(subject)) {
        confidence += 35;
        break;
      }
    }

    // Check strong body patterns
    for (const pattern of this.strongBodyPatterns) {
      if (pattern.test(body)) {
        confidence += 25;
        break;
      }
    }

    // Only extract amount if we have some confidence this is a purchase
    if (confidence >= 30) {
      amount = this.extractAmount(body);
      if (amount > 0 && amount < 10000) { // Reasonable purchase amount
        confidence += 20;
      } else if (amount >= 10000) {
        // Large amounts require extra validation
        confidence += 10;
      }

      // Extract order number
      orderNumber = this.extractOrderNumber(body);
      if (orderNumber && this.isValidOrderNumber(orderNumber)) {
        confidence += 15;
      }

      // If no known merchant, try to extract from email
      if (!merchant) {
        merchant = this.formatDomainAsMerchant(domain);
      }
    }

    // Require high confidence AND a reasonable amount
    if (confidence >= 70 && amount > 0 && merchant) {
      return {
        type: 'purchase',
        confidence,
        data: {
          merchant,
          amount,
          orderNumber: this.isValidOrderNumber(orderNumber) ? orderNumber : undefined,
        },
      };
    }

    return { type: 'none', confidence: 0 };
  }

  private extractAmount(text: string): number {
    // Look for amounts in context of totals/charges
    const contextPatterns = [
      /(?:order\s+)?total[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /(?:amount|total)\s+(?:charged|paid|due)[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /payment\s+(?:of|amount)[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /you\s+(?:paid|charged)[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /transaction\s+(?:amount|total)[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /subtotal[:\s]+\$\s*([\d,]+\.\d{2})/i,
      /grand\s+total[:\s]+\$\s*([\d,]+\.\d{2})/i,
    ];

    for (const pattern of contextPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    // Fallback: look for dollar amounts that appear to be totals
    // Only if we find exactly one or two dollar amounts (likely subtotal + total)
    const allAmounts = text.match(/\$\s*([\d,]+\.\d{2})/g);
    if (allAmounts && allAmounts.length >= 1 && allAmounts.length <= 5) {
      const amounts = allAmounts.map(a => {
        const num = a.match(/[\d,]+\.\d{2}/);
        return num ? parseFloat(num[0].replace(/,/g, '')) : 0;
      }).filter(a => a > 0 && a < 50000); // Reasonable purchase limits

      if (amounts.length > 0) {
        // Return the largest (usually the total)
        return Math.max(...amounts);
      }
    }

    return 0;
  }

  private extractOrderNumber(text: string): string {
    const patterns = [
      /order\s*(?:#|number|no\.?)[:\s]*([A-Z0-9][A-Z0-9-]{4,20})/i,
      /confirmation\s*(?:#|number|no\.?)[:\s]*([A-Z0-9][A-Z0-9-]{4,20})/i,
      /(?:order|reference)\s+(?:id|#)[:\s]*([A-Z0-9][A-Z0-9-]{4,20})/i,
      /tracking\s*(?:#|number)[:\s]*([A-Z0-9][A-Z0-9-]{8,30})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const orderNum = match[1].trim();
        if (this.isValidOrderNumber(orderNum)) {
          return orderNum;
        }
      }
    }

    return '';
  }

  private isValidOrderNumber(orderNum: string): boolean {
    if (!orderNum || orderNum.length < 5 || orderNum.length > 30) {
      return false;
    }
    // Must start with alphanumeric
    if (!/^[A-Z0-9]/i.test(orderNum)) {
      return false;
    }
    // Must contain mostly alphanumeric with possible hyphens
    if (!/^[A-Z0-9-]+$/i.test(orderNum)) {
      return false;
    }
    // Should not look like CSS (no common CSS patterns)
    const cssPatterns = ['-collapse', '-color', '-width', '-height', '-size', '-weight', '-style'];
    for (const pattern of cssPatterns) {
      if (orderNum.toLowerCase().includes(pattern)) {
        return false;
      }
    }
    return true;
  }

  private findKnownMerchant(domain: string): string | null {
    // Direct match
    if (this.knownMerchants[domain]) {
      return this.knownMerchants[domain];
    }

    // Check if domain ends with a known merchant domain
    for (const [merchantDomain, name] of Object.entries(this.knownMerchants)) {
      if (domain === merchantDomain || domain.endsWith('.' + merchantDomain)) {
        return name;
      }
    }

    // Check common subdomains
    for (const [merchantDomain, name] of Object.entries(this.knownMerchants)) {
      const baseDomain = merchantDomain.split('.')[0];
      if (domain.includes(baseDomain + '.') || domain.includes('.' + baseDomain)) {
        return name;
      }
    }

    return null;
  }

  private formatDomainAsMerchant(domain: string): string {
    if (!domain) return '';
    
    const parts = domain.split('.');
    if (parts.length < 2) return '';
    
    let mainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    
    // Skip common email subdomains
    const skipWords = ['mail', 'email', 'noreply', 'no-reply', 'notifications', 'info', 'support', 'orders', 'receipts', 'billing'];
    if (skipWords.includes(mainPart.toLowerCase()) && parts.length > 2) {
      mainPart = parts[parts.length - 2];
    }
    
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
  }

  getPurchaseCategory(merchant: string): string {
    const lowerMerchant = merchant.toLowerCase();
    
    for (const [key, category] of Object.entries(this.merchantCategories)) {
      if (lowerMerchant.includes(key.toLowerCase())) {
        return category;
      }
    }

    return 'other';
  }

  createPurchaseFromEmail(email: Email, merchant: string, amount: number, orderNumber?: string): Omit<Purchase, 'id'> {
    return {
      emailId: email.id,
      merchant,
      amount,
      currency: 'USD',
      purchaseDate: email.date,
      orderNumber,
      items: [],
      category: this.getPurchaseCategory(merchant),
    };
  }
}

export const purchaseDetector = new PurchaseDetector();
