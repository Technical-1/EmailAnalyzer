/**
 * Returns true iff emailDomain is exactly serviceDomain or a subdomain of it.
 * Boundary-safe: 'maxwell.com' does NOT match 'max.com', 'pineapple.com' does
 * NOT match 'apple.com'. Comparison is case-insensitive and trimmed.
 */
export function isDomainMatch(emailDomain: string, serviceDomain: string): boolean {
  const d = emailDomain.trim().toLowerCase();
  const s = serviceDomain.trim().toLowerCase();
  if (!d || !s) return false;
  return d === s || d.endsWith('.' + s);
}
