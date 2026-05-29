/**
 * Base64 <-> Uint8Array conversion helpers.
 *
 * Converts in fixed-size chunks instead of spreading the whole array into
 * String.fromCharCode(...array), which throws
 * "RangeError: Maximum call stack size exceeded" on large blobs.
 */

// 0x8000 = 32768 bytes per chunk. Comfortably below the arg-count limit of
// String.fromCharCode on every engine while keeping the loop count low.
const CHUNK_SIZE = 0x8000;

/**
 * Convert a Uint8Array to a base64 string.
 * Safe for arbitrarily large arrays.
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < array.length; i += CHUNK_SIZE) {
    const chunk = array.subarray(i, i + CHUNK_SIZE);
    // String.fromCharCode.apply lets us pass the chunk as an arg list without
    // spreading a potentially huge array. The chunk is bounded by CHUNK_SIZE.
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

/**
 * Convert a base64 string back to a Uint8Array.
 * Symmetric with uint8ArrayToBase64.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const length = binary.length;
  const array = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array;
}
