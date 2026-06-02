/**
 * Clean and normalize an email address
 */
export function cleanEmailAddress(email: string): string {
  if (!email) return 'unknown@example.com';

  // Remove angle brackets and extra whitespace
  const cleaned = email.replace(/[<>]/g, '').trim();

  // Prefer a fully-qualified address (dotted TLD). Strip any trailing
  // list-separator punctuation that rode along (e.g. "a@b.com," from a header).
  const match = cleaned.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (match) {
    return match[1].replace(/[.,;:!?]+$/, '').toLowerCase();
  }

  // Fallback: a bare address with no dotted TLD (e.g. "user@localhost").
  const bareMatch = cleaned.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+)/);
  if (bareMatch) {
    return bareMatch[1].replace(/[.,;:!?]+$/, '').toLowerCase();
  }

  // No address found — never leak display-name text; use the sentinel that
  // importPipeline/olmParser check for to drop sender-less emails.
  return 'unknown@example.com';
}

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  
  // Create a temporary element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

/**
 * Extract domain from an email address
 */
export function extractDomain(email: string): string {
  if (!email) return '';
  
  const cleaned = cleanEmailAddress(email);
  // The sentinel means no real address was found — it has no meaningful domain.
  if (cleaned === 'unknown@example.com') return '';
  const atIndex = cleaned.indexOf('@');
  if (atIndex === -1) return '';
  
  return cleaned.substring(atIndex + 1).toLowerCase();
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  } else if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  // Clamp the index so out-of-range (TB+/PB+) sizes don't produce an
  // `undefined` unit.
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Truncate text to a maximum length
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Normalize a subject line for thread matching
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return '';
  
  // Remove Re:, Fwd:, Fw:, etc. prefixes (multiple times)
  let normalized = subject;
  const prefixPattern = /^(re|fwd|fw|aw|sv|vs|antw|r):\s*/i;
  
  while (prefixPattern.test(normalized)) {
    normalized = normalized.replace(prefixPattern, '');
  }
  
  // Remove leading/trailing whitespace and normalize internal whitespace
  return normalized.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Generate initials from a name or email
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  
  const parts = name.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length > 1 ? 1 : 0][0]).toUpperCase();
}

/**
 * Get a consistent color for a string (for avatars, etc.)
 */
export function getColorForString(str: string): string {
  const colors = [
    'bg-red-500',
    'bg-orange-500',
    'bg-amber-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500',
    'bg-emerald-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-sky-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-purple-500',
    'bg-fuchsia-500',
    'bg-pink-500',
    'bg-rose-500',
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format a domain as a readable service/sender name
 */
export function formatDomainAsName(domain: string): string {
  if (!domain) return '';
  
  // Remove common prefixes (subdomains used for email)
  let name = domain
    .replace(/^(mail|email|noreply|no-reply|billing|notifications?|support|info|newsletter|news|updates?|marketing|promo|alerts?|digest|reply|bounce|mailer|sender|e\.)\./i, '');
  
  // Extract main domain part
  const parts = name.split('.');
  
  // Handle TLDs - get the main domain name
  if (parts.length >= 2) {
    // Check for country-code second-level domains (e.g., co.uk, com.au)
    const lastTwo = parts.slice(-2).join('.');
    const countrySecondLevel = ['co.uk', 'co.au', 'com.au', 'org.uk', 'co.nz', 'com.br'];
    
    if (countrySecondLevel.includes(lastTwo.toLowerCase()) && parts.length >= 3) {
      name = parts[parts.length - 3];
    } else {
      name = parts[parts.length - 2];
    }
  } else {
    name = parts[0];
  }
  
  // Skip if result is too generic
  const genericNames = ['mail', 'email', 'noreply', 'info', 'support', 'contact', 'hello', 'team'];
  if (genericNames.includes(name.toLowerCase())) {
    // Try to get the domain root
    if (parts.length >= 2) {
      name = parts[0];
    }
  }
  
  // Handle common compound domains
  name = name
    .replace(/[_-]/g, ' ')  // Convert separators to spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2');  // Split camelCase
  
  // Capitalize each word
  return name
    .split(/\s+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || domain;
}
