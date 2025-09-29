import { createHash, createHmac, randomBytes } from 'crypto';
import { SignatureError } from '../core/types';

/**
 * Cryptographic utilities for secure operations
 */
export class CryptoUtils {
  
  /**
   * Generate a secure random salt
   * @param length - Length of the salt in bytes (default: 32)
   * @returns Base64 encoded salt
   */
  static generateSalt(length: number = 32): string {
    try {
      if (length <= 0) {
        throw new SignatureError('Salt length must be positive');
      }
      return randomBytes(length).toString('base64');
    } catch (error) {
      throw new SignatureError(`Failed to generate salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a secure random ID
   * @param length - Length of the ID in bytes (default: 16)
   * @returns Hex encoded ID
   */
  static generateId(length: number = 16): string {
    try {
      return randomBytes(length).toString('hex');
    } catch (error) {
      throw new SignatureError(`Failed to generate ID: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a SHA-256 hash with salt
   * @param input - Input string to hash
   * @param salt - Salt to use for hashing
   * @returns Base64 encoded hash
   */
  static hashWithSalt(input: string, salt: string): string {
    try {
      if (typeof input !== 'string' || typeof salt !== 'string') {
        throw new SignatureError('Input and salt must be strings');
      }
      const hash = createHash('sha256');
      hash.update(input + salt);
      return hash.digest('base64');
    } catch (error) {
      throw new SignatureError(`Failed to hash with salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create HMAC signature for data integrity
   * @param data - Data to sign
   * @param secret - Secret key for HMAC
   * @returns Base64 encoded HMAC signature
   */
  static createHmac(data: string, secret: string): string {
    try {
      if (typeof data !== 'string' || typeof secret !== 'string') {
        throw new SignatureError('Data and secret must be strings');
      }
      const hmac = createHmac('sha256', secret);
      hmac.update(data);
      return hmac.digest('base64');
    } catch (error) {
      throw new SignatureError(`Failed to create HMAC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify HMAC signature
   * @param data - Original data
   * @param signature - Signature to verify
   * @param secret - Secret key for HMAC
   * @returns True if signature is valid
   */
  static verifyHmac(data: string, signature: string, secret: string): boolean {
    try {
      const expectedSignature = this.createHmac(data, secret);
      return this.constantTimeCompare(signature, expectedSignature);
    } catch (error) {
      throw new SignatureError(`Failed to verify HMAC: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   * @param a - First string
   * @param b - Second string
   * @returns True if strings are equal
   */
  static constantTimeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Generate a secure proxy token with prefix
   * @param originalToken - Original token to anonymize
   * @param salt - Salt for hashing
   * @param prefix - Prefix for the proxy token (default: 'anon_')
   * @returns Anonymous proxy token
   */
  static generateProxyToken(originalToken: string, salt: string, prefix: string = 'anon_'): string {
    try {
      const hash = this.hashWithSalt(originalToken, salt);
      // Take first 16 characters of hash for readability
      const shortHash = hash.substring(0, 16).replace(/[^a-zA-Z0-9]/g, '');
      return `${prefix}${shortHash}`;
    } catch (error) {
      throw new SignatureError(`Failed to generate proxy token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate that a string is a valid proxy token
   * @param token - Token to validate
   * @param prefix - Expected prefix (default: 'anon_')
   * @returns True if token appears to be a valid proxy
   */
  static isValidProxyToken(token: string, prefix: string = 'anon_'): boolean {
    try {
      return token.startsWith(prefix) && 
             token.length > prefix.length &&
             /^[a-zA-Z0-9_]+$/.test(token);
    } catch (error) {
      return false;
    }
  }
}
