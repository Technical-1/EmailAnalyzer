/**
 * Pure, DOM-free MIME / MBOX parsing utilities.
 * Single source of truth shared by the parser worker and (re-exported) the
 * legacy service parsers. No DOM, no JSZip, no Dexie imports here.
 */

/**
 * RFC 2045 quoted-printable decoder that preserves multi-byte UTF-8.
 * Collects raw bytes (literal chars + =XX escapes) then decodes once via
 * TextDecoder so sequences like =C3=A9 -> "é" survive intact.
 */
export function decodeQuotedPrintable(input: string, charset = 'utf-8'): string {
  // Drop soft line breaks first.
  const text = input.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '=' && i + 2 < text.length) {
      const hex = text.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    // Literal character: push its code units as UTF-8 bytes.
    const code = ch.charCodeAt(0);
    if (code < 0x80) {
      bytes.push(code);
    } else {
      const enc = new TextEncoder().encode(ch);
      for (const b of enc) bytes.push(b);
    }
  }
  try {
    return new TextDecoder(normalizeCharset(charset)).decode(new Uint8Array(bytes));
  } catch {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }
}

/** Map common MIME charset aliases to labels TextDecoder accepts. */
function normalizeCharset(charset: string): string {
  const c = charset.trim().toLowerCase();
  if (c === 'utf8') return 'utf-8';
  if (c === 'latin1' || c === 'iso8859-1') return 'iso-8859-1';
  return c || 'utf-8';
}

// Field/size limits (exact values ported from olmParser.ts)
export const MAX_SUBJECT_LEN = 1000;
export const MAX_BODY_LEN = 10 * 1024 * 1024; // 10MB
export const MAX_EMAIL_LEN = 254; // RFC 5321
export const MAX_COMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB compressed
export const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024; // 2GB decompressed (zip-bomb guard)
