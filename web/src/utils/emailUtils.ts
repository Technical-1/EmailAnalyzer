/**
 * Shared email utility functions
 */

/**
 * Strips HTML tags, CSS, scripts, and decodes HTML entities from text.
 */
export function stripHtml(text: string): string {
  return text
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]+>/g, ' ') // Remove HTML tags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts the domain from an email address.
 * @param email - Email address (e.g., "user@example.com")
 * @returns Domain portion (e.g., "example.com") or empty string
 */
export function extractDomain(email: string): string {
  const match = email.match(/@(.+)/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Cleans and normalizes an email address.
 * Handles formats like "Name <email@domain.com>" and extracts just the email.
 * @param email - Raw email string
 * @returns Cleaned, lowercase email address
 */
export function cleanEmailAddress(email: string): string {
  if (!email) return '';
  // Extract email from formats like "Name <email@domain.com>"
  const match = email.match(/<([^>]+)>/);
  if (match) {
    return match[1].trim().toLowerCase();
  }
  return email.trim().toLowerCase();
}

