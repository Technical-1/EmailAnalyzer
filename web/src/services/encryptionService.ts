/**
 * Encryption Service using Web Crypto API
 * Provides AES-GCM encryption for local data security
 */

import { uint8ArrayToBase64, base64ToUint8Array } from '../utils/base64';
import { WORDLIST } from '../utils/wordlist';

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ITERATIONS = 100000;

interface EncryptedData {
  ciphertext: string;  // Base64 encoded
  iv: string;          // Base64 encoded
  salt: string;        // Base64 encoded
}

class EncryptionService {
  private cryptoKey: CryptoKey | null = null;
  private salt: Uint8Array | null = null;

  /**
   * Check if encryption is available
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 
           'crypto' in window && 
           'subtle' in window.crypto;
  }

  /**
   * Derive encryption key from passphrase using PBKDF2
   */
  private async deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer as ArrayBuffer,
        iterations: ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Initialize encryption with a passphrase
   * Returns true if successful
   */
  async initialize(passphrase: string): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Web Crypto API is not supported in this browser');
    }

    try {
      // Check if we have existing salt in storage
      const storedSalt = localStorage.getItem('encryption_salt');
      
      if (storedSalt) {
        // Use existing salt for consistency
        this.salt = new Uint8Array(
          atob(storedSalt).split('').map(c => c.charCodeAt(0))
        );
      } else {
        // Generate new salt
        this.salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
        localStorage.setItem('encryption_salt', this.arrayToBase64(this.salt));
      }

      this.cryptoKey = await this.deriveKey(passphrase, this.salt);
      
      // Verify by encrypting/decrypting test data
      const testData = 'encryption_test';
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);
      
      if (decrypted !== testData) {
        throw new Error('Encryption verification failed');
      }

      return true;
    } catch (error) {
      this.cryptoKey = null;
      throw error;
    }
  }

  /**
   * Verify a passphrase against stored verification hash
   */
  async verifyPassphrase(passphrase: string): Promise<boolean> {
    const storedVerification = localStorage.getItem('encryption_verification');
    if (!storedVerification) {
      return false;
    }

    try {
      await this.initialize(passphrase);
      const decrypted = await this.decrypt(JSON.parse(storedVerification));
      return decrypted === 'verification_token';
    } catch {
      this.cryptoKey = null;
      return false;
    }
  }

  /**
   * Set up encryption with a new passphrase
   */
  async setupEncryption(passphrase: string): Promise<void> {
    // Clear any existing encryption data
    localStorage.removeItem('encryption_salt');
    localStorage.removeItem('encryption_verification');
    
    await this.initialize(passphrase);
    
    // Store verification token
    const verificationToken = await this.encrypt('verification_token');
    localStorage.setItem('encryption_verification', JSON.stringify(verificationToken));
  }

  /**
   * Check if encryption is set up
   */
  isEncryptionSetup(): boolean {
    return localStorage.getItem('encryption_verification') !== null;
  }

  /**
   * Check if currently unlocked
   */
  isUnlocked(): boolean {
    return this.cryptoKey !== null;
  }

  /**
   * Lock the encryption (clear key from memory)
   */
  lock(): void {
    this.cryptoKey = null;
  }

  /**
   * Encrypt data
   */
  async encrypt(data: string): Promise<EncryptedData> {
    if (!this.cryptoKey || !this.salt) {
      throw new Error('Encryption not initialized. Call initialize() first.');
    }

    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv.buffer as ArrayBuffer },
      this.cryptoKey,
      encoder.encode(data)
    );

    return {
      ciphertext: this.arrayToBase64(new Uint8Array(ciphertext)),
      iv: this.arrayToBase64(iv),
      salt: this.arrayToBase64(this.salt),
    };
  }

  /**
   * Decrypt data
   */
  async decrypt(encrypted: EncryptedData): Promise<string> {
    if (!this.cryptoKey) {
      throw new Error('Encryption not initialized. Call initialize() first.');
    }

    const ciphertext = this.base64ToArray(encrypted.ciphertext);
    const iv = this.base64ToArray(encrypted.iv);

    const decrypted = await crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv: iv.buffer as ArrayBuffer },
      this.cryptoKey,
      ciphertext.buffer as ArrayBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Encrypt an object (serialize to JSON first)
   */
  async encryptObject<T>(obj: T): Promise<EncryptedData> {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to an object
   */
  async decryptObject<T>(encrypted: EncryptedData): Promise<T> {
    const json = await this.decrypt(encrypted);
    return JSON.parse(json);
  }

  /**
   * Encrypt a database blob
   */
  async encryptBlob(blob: Blob): Promise<EncryptedData> {
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = this.arrayToBase64(new Uint8Array(arrayBuffer));
    return this.encrypt(base64);
  }

  /**
   * Decrypt to a blob
   */
  async decryptBlob(encrypted: EncryptedData, type: string): Promise<Blob> {
    const base64 = await this.decrypt(encrypted);
    const array = this.base64ToArray(base64);
    return new Blob([array.buffer as ArrayBuffer], { type });
  }

  /**
   * Change passphrase
   * Requires current passphrase for verification
   */
  async changePassphrase(currentPassphrase: string, newPassphrase: string): Promise<boolean> {
    // Verify current passphrase
    const isValid = await this.verifyPassphrase(currentPassphrase);
    if (!isValid) {
      throw new Error('Current passphrase is incorrect');
    }

    // Re-setup with new passphrase
    await this.setupEncryption(newPassphrase);
    return true;
  }

  /**
   * Remove encryption (requires passphrase verification)
   */
  async removeEncryption(passphrase: string): Promise<boolean> {
    const isValid = await this.verifyPassphrase(passphrase);
    if (!isValid) {
      throw new Error('Passphrase is incorrect');
    }

    localStorage.removeItem('encryption_salt');
    localStorage.removeItem('encryption_verification');
    this.cryptoKey = null;
    this.salt = null;

    return true;
  }

  /**
   * Helper: Convert Uint8Array to Base64 (chunked; safe for large blobs)
   */
  private arrayToBase64(array: Uint8Array): string {
    return uint8ArrayToBase64(array);
  }

  /**
   * Helper: Convert Base64 to Uint8Array
   */
  private base64ToArray(base64: string): Uint8Array {
    return base64ToUint8Array(base64);
  }

  /**
   * Return an unbiased random integer in [0, max) using rejection sampling
   * over crypto.getRandomValues. Avoids the modulo bias of (rand % max).
   */
  private randomIndex(max: number): number {
    // Largest multiple of `max` that fits in a Uint32, used as the rejection
    // threshold. Any draw at or above this is discarded and retried.
    const limit = Math.floor(0xffffffff / max) * max;
    const buf = new Uint32Array(1);
    let value: number;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  /**
   * Generate a strong passphrase from the bundled wordlist.
   * Default of 6 words from a 1024+ word list yields >= ~60 bits of entropy.
   */
  generatePassphrase(wordCount: number = 6): string {
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      words.push(WORDLIST[this.randomIndex(WORDLIST.length)]);
    }
    return words.join('-');
  }
}

export const encryptionService = new EncryptionService();

