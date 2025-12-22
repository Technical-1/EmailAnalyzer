import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptionService } from '../../services/encryptionService';

// Note: These tests require the Web Crypto API which is available in jsdom

describe('EncryptionService', () => {
  const testPassphrase = 'test-passphrase-123';

  beforeEach(() => {
    // Clear any existing encryption setup
    localStorage.removeItem('encryption_salt');
    localStorage.removeItem('encryption_verification');
    encryptionService.lock();
  });

  afterEach(() => {
    encryptionService.lock();
  });

  describe('isSupported', () => {
    it('should return true when Web Crypto API is available', () => {
      expect(encryptionService.isSupported()).toBe(true);
    });
  });

  describe('isEncryptionSetup', () => {
    it('should return false when encryption is not set up', () => {
      expect(encryptionService.isEncryptionSetup()).toBe(false);
    });

    it('should return true after encryption is set up', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      expect(encryptionService.isEncryptionSetup()).toBe(true);
    });
  });

  describe('isUnlocked', () => {
    it('should return false initially', () => {
      expect(encryptionService.isUnlocked()).toBe(false);
    });

    it('should return true after initialization', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      expect(encryptionService.isUnlocked()).toBe(true);
    });

    it('should return false after locking', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      encryptionService.lock();
      expect(encryptionService.isUnlocked()).toBe(false);
    });
  });

  describe('encrypt and decrypt', () => {
    beforeEach(async () => {
      await encryptionService.setupEncryption(testPassphrase);
    });

    it('should encrypt and decrypt text correctly', async () => {
      const originalText = 'Hello, World!';
      const encrypted = await encryptionService.encrypt(originalText);
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should encrypt and decrypt objects correctly', async () => {
      const originalObject = { name: 'Test', value: 42, nested: { key: 'value' } };
      const encrypted = await encryptionService.encryptObject(originalObject);
      const decrypted = await encryptionService.decryptObject(encrypted);
      expect(decrypted).toEqual(originalObject);
    });

    it('should produce different ciphertext for same plaintext', async () => {
      const text = 'Same text';
      const encrypted1 = await encryptionService.encrypt(text);
      const encrypted2 = await encryptionService.encrypt(text);
      
      // Different IVs should produce different ciphertext
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should fail to decrypt with wrong passphrase', async () => {
      const text = 'Secret message';
      const encrypted = await encryptionService.encrypt(text);

      // Lock and reinitialize with wrong passphrase
      encryptionService.lock();
      localStorage.removeItem('encryption_salt');
      await encryptionService.setupEncryption('wrong-passphrase');

      await expect(encryptionService.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('verifyPassphrase', () => {
    it('should return true for correct passphrase', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      encryptionService.lock();
      
      const isValid = await encryptionService.verifyPassphrase(testPassphrase);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect passphrase', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      encryptionService.lock();
      
      const isValid = await encryptionService.verifyPassphrase('wrong-passphrase');
      expect(isValid).toBe(false);
    });
  });

  describe('generatePassphrase', () => {
    it('should generate a passphrase with the specified number of words', () => {
      const passphrase = encryptionService.generatePassphrase(4);
      const words = passphrase.split('-');
      expect(words).toHaveLength(4);
    });

    it('should generate different passphrases each time', () => {
      const passphrase1 = encryptionService.generatePassphrase();
      const passphrase2 = encryptionService.generatePassphrase();
      expect(passphrase1).not.toBe(passphrase2);
    });
  });

  describe('removeEncryption', () => {
    it('should remove encryption data with correct passphrase', async () => {
      await encryptionService.setupEncryption(testPassphrase);
      expect(encryptionService.isEncryptionSetup()).toBe(true);

      const result = await encryptionService.removeEncryption(testPassphrase);
      expect(result).toBe(true);
      expect(encryptionService.isEncryptionSetup()).toBe(false);
    });

    it('should fail to remove encryption with wrong passphrase', async () => {
      await encryptionService.setupEncryption(testPassphrase);

      await expect(
        encryptionService.removeEncryption('wrong-passphrase')
      ).rejects.toThrow();
    });
  });
});

