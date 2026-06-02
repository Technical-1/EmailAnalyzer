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
