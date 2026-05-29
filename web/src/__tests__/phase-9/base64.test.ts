import { describe, it, expect } from 'vitest';
import { uint8ArrayToBase64, base64ToUint8Array } from '../../utils/base64';

describe('base64 helpers', () => {
  it('round-trips a small array exactly', () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 127, 128]);
    const b64 = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(b64);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('produces base64 compatible with native atob', () => {
    const original = new Uint8Array([72, 105]); // "Hi"
    const b64 = uint8ArrayToBase64(original);
    expect(atob(b64)).toBe('Hi');
  });

  it('round-trips an empty array', () => {
    const original = new Uint8Array([]);
    const b64 = uint8ArrayToBase64(original);
    expect(b64).toBe('');
    expect(base64ToUint8Array(b64).length).toBe(0);
  });

  it('round-trips a large (1.5MB) array without throwing RangeError', () => {
    const size = 1_500_000;
    const original = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      original[i] = i % 256;
    }

    let b64 = '';
    expect(() => {
      b64 = uint8ArrayToBase64(original);
    }).not.toThrow();

    const decoded = base64ToUint8Array(b64);
    expect(decoded.length).toBe(size);
    // Spot-check boundaries and a few interior points rather than full array equality
    expect(decoded[0]).toBe(original[0]);
    expect(decoded[size - 1]).toBe(original[size - 1]);
    expect(decoded[0x8000]).toBe(original[0x8000]); // chunk boundary
    expect(decoded[0x8000 + 1]).toBe(original[0x8000 + 1]);
    expect(decoded[size >> 1]).toBe(original[size >> 1]);
  });

  it('round-trips array lengths that are not multiples of 3 (padding)', () => {
    for (const len of [1, 2, 4, 5, 100, 0x8000 + 1, 0x8000 + 2]) {
      const original = new Uint8Array(len);
      for (let i = 0; i < len; i++) original[i] = (i * 31 + 7) % 256;
      const decoded = base64ToUint8Array(uint8ArrayToBase64(original));
      expect(Array.from(decoded)).toEqual(Array.from(original));
    }
  });
});
