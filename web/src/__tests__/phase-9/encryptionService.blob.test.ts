import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService } from '../../services/encryptionService';

describe('EncryptionService large blob round-trip', () => {
  const testPassphrase = 'test-passphrase-123';

  beforeEach(async () => {
    localStorage.removeItem('encryption_salt');
    localStorage.removeItem('encryption_verification');
    encryptionService.lock();
    await encryptionService.setupEncryption(testPassphrase);
  });

  afterEach(() => {
    encryptionService.lock();
  });

  it('encrypts and decrypts a large (1MB) blob without throwing', async () => {
    const size = 1_000_000;
    const bytes = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      bytes[i] = (i * 17 + 3) % 256;
    }
    const blob = new Blob([bytes], { type: 'application/octet-stream' });

    const encrypted = await encryptionService.encryptBlob(blob);
    const decryptedBlob = await encryptionService.decryptBlob(
      encrypted,
      'application/octet-stream'
    );

    expect(decryptedBlob.type).toBe('application/octet-stream');
    expect(decryptedBlob.size).toBe(size);

    const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer());
    expect(decryptedBytes.length).toBe(size);
    expect(decryptedBytes[0]).toBe(bytes[0]);
    expect(decryptedBytes[size - 1]).toBe(bytes[size - 1]);
    expect(decryptedBytes[size >> 1]).toBe(bytes[size >> 1]);
  });

  it('produces a different ciphertext than plaintext for a small blob', async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'text/plain' });
    const encrypted = await encryptionService.encryptBlob(blob);
    expect(typeof encrypted.ciphertext).toBe('string');
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);

    const out = await encryptionService.decryptBlob(encrypted, 'text/plain');
    const outBytes = new Uint8Array(await out.arrayBuffer());
    expect(Array.from(outBytes)).toEqual([1, 2, 3, 4]);
  });
});
