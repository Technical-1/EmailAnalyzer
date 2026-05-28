/**
 * Pure, DOM-free MIME / MBOX parsing utilities.
 * Single source of truth shared by the parser worker and (re-exported) the
 * legacy service parsers. No DOM, no JSZip, no Dexie imports here.
 */

// Field/size limits (exact values ported from olmParser.ts)
export const MAX_SUBJECT_LEN = 1000;
export const MAX_BODY_LEN = 10 * 1024 * 1024; // 10MB
export const MAX_EMAIL_LEN = 254; // RFC 5321
export const MAX_COMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB compressed
export const MAX_DECOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024; // 2GB decompressed (zip-bomb guard)
