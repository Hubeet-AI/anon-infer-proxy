import { CryptoUtils } from '../../utils/crypto';
import { SignatureError } from '../../core/types';

describe('CryptoUtils', () => {
  
  describe('Salt Generation', () => {
    test('should generate different salts each time', () => {
      const salt1 = CryptoUtils.generateSalt();
      const salt2 = CryptoUtils.generateSalt();
      
      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThan(0);
      expect(salt2.length).toBeGreaterThan(0);
    });

    test('should generate salt of specified length', () => {
      const salt = CryptoUtils.generateSalt(16);
      
      // Base64 encoding of 16 bytes should be about 24 characters
      expect(salt.length).toBeGreaterThan(20);
    });

    test('should handle invalid length gracefully', () => {
      expect(() => CryptoUtils.generateSalt(0)).toThrow(SignatureError);
      expect(() => CryptoUtils.generateSalt(-1)).toThrow(SignatureError);
    });
  });

  describe('ID Generation', () => {
    test('should generate unique IDs', () => {
      const id1 = CryptoUtils.generateId();
      const id2 = CryptoUtils.generateId();
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[a-f0-9]+$/); // Hex format
      expect(id2).toMatch(/^[a-f0-9]+$/);
    });

    test('should generate ID of correct length', () => {
      const id = CryptoUtils.generateId(8);
      
      // 8 bytes in hex = 16 characters
      expect(id.length).toBe(16);
    });
  });

  describe('Hash with Salt', () => {
    test('should produce consistent hashes for same input', () => {
      const input = 'test-input';
      const salt = 'test-salt';
      
      const hash1 = CryptoUtils.hashWithSalt(input, salt);
      const hash2 = CryptoUtils.hashWithSalt(input, salt);
      
      expect(hash1).toBe(hash2);
    });

    test('should produce different hashes for different inputs', () => {
      const salt = 'test-salt';
      
      const hash1 = CryptoUtils.hashWithSalt('input1', salt);
      const hash2 = CryptoUtils.hashWithSalt('input2', salt);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should produce different hashes for different salts', () => {
      const input = 'test-input';
      
      const hash1 = CryptoUtils.hashWithSalt(input, 'salt1');
      const hash2 = CryptoUtils.hashWithSalt(input, 'salt2');
      
      expect(hash1).not.toBe(hash2);
    });

    test('should handle empty input', () => {
      expect(() => CryptoUtils.hashWithSalt('', 'salt')).not.toThrow();
      expect(() => CryptoUtils.hashWithSalt('input', '')).not.toThrow();
    });
  });

  describe('HMAC Operations', () => {
    test('should create and verify HMAC correctly', () => {
      const data = 'test-data';
      const secret = 'secret-key';
      
      const signature = CryptoUtils.createHmac(data, secret);
      const isValid = CryptoUtils.verifyHmac(data, signature, secret);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
      expect(isValid).toBe(true);
    });

    test('should reject invalid signatures', () => {
      const data = 'test-data';
      const secret = 'secret-key';
      
      const validSignature = CryptoUtils.createHmac(data, secret);
      
      // Wrong signature
      expect(CryptoUtils.verifyHmac(data, 'wrong-signature', secret)).toBe(false);
      
      // Wrong secret
      expect(CryptoUtils.verifyHmac(data, validSignature, 'wrong-secret')).toBe(false);
      
      // Wrong data
      expect(CryptoUtils.verifyHmac('wrong-data', validSignature, secret)).toBe(false);
    });

    test('should handle empty data and secrets', () => {
      expect(() => CryptoUtils.createHmac('', 'secret')).not.toThrow();
      expect(() => CryptoUtils.createHmac('data', '')).not.toThrow();
    });
  });

  describe('Constant Time Comparison', () => {
    test('should return true for identical strings', () => {
      const str1 = 'test-string';
      const str2 = 'test-string';
      
      expect(CryptoUtils.constantTimeCompare(str1, str2)).toBe(true);
    });

    test('should return false for different strings of same length', () => {
      const str1 = 'test-string';
      const str2 = 'test-strong';
      
      expect(CryptoUtils.constantTimeCompare(str1, str2)).toBe(false);
    });

    test('should return false for different length strings', () => {
      const str1 = 'short';
      const str2 = 'longer-string';
      
      expect(CryptoUtils.constantTimeCompare(str1, str2)).toBe(false);
    });

    test('should handle empty strings', () => {
      expect(CryptoUtils.constantTimeCompare('', '')).toBe(true);
      expect(CryptoUtils.constantTimeCompare('', 'non-empty')).toBe(false);
      expect(CryptoUtils.constantTimeCompare('non-empty', '')).toBe(false);
    });
  });

  describe('Proxy Token Generation', () => {
    test('should generate valid proxy tokens', () => {
      const token = 'sk-1234567890abcdef';
      const salt = CryptoUtils.generateSalt();
      
      const proxy = CryptoUtils.generateProxyToken(token, salt);
      
      expect(proxy).toMatch(/^anon_[a-zA-Z0-9]+$/);
      expect(proxy.startsWith('anon_')).toBe(true);
    });

    test('should generate consistent proxy tokens', () => {
      const token = 'sk-1234567890abcdef';
      const salt = 'consistent-salt';
      
      const proxy1 = CryptoUtils.generateProxyToken(token, salt);
      const proxy2 = CryptoUtils.generateProxyToken(token, salt);
      
      expect(proxy1).toBe(proxy2);
    });

    test('should generate different proxy tokens for different inputs', () => {
      const salt = 'test-salt';
      
      const proxy1 = CryptoUtils.generateProxyToken('token1', salt);
      const proxy2 = CryptoUtils.generateProxyToken('token2', salt);
      
      expect(proxy1).not.toBe(proxy2);
    });

    test('should support custom prefixes', () => {
      const token = 'test-token';
      const salt = 'test-salt';
      const prefix = 'custom_';
      
      const proxy = CryptoUtils.generateProxyToken(token, salt, prefix);
      
      expect(proxy.startsWith(prefix)).toBe(true);
    });

    test('should handle special characters in tokens', () => {
      const token = 'token-with-special!@#$%^&*()chars';
      const salt = CryptoUtils.generateSalt();
      
      expect(() => CryptoUtils.generateProxyToken(token, salt)).not.toThrow();
    });
  });

  describe('Proxy Token Validation', () => {
    test('should validate correct proxy tokens', () => {
      const validProxy = 'anon_abc123def456';
      
      expect(CryptoUtils.isValidProxyToken(validProxy)).toBe(true);
    });

    test('should reject invalid proxy tokens', () => {
      expect(CryptoUtils.isValidProxyToken('invalid-token')).toBe(false);
      expect(CryptoUtils.isValidProxyToken('anon_')).toBe(false);
      expect(CryptoUtils.isValidProxyToken('anon_with spaces')).toBe(false);
      expect(CryptoUtils.isValidProxyToken('anon_with@special')).toBe(false);
      expect(CryptoUtils.isValidProxyToken('')).toBe(false);
    });

    test('should handle custom prefixes in validation', () => {
      const customProxy = 'custom_abc123';
      
      expect(CryptoUtils.isValidProxyToken(customProxy, 'custom_')).toBe(true);
      expect(CryptoUtils.isValidProxyToken(customProxy, 'anon_')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle undefined inputs gracefully', () => {
      expect(() => CryptoUtils.hashWithSalt(undefined as any, 'salt')).toThrow();
      expect(() => CryptoUtils.createHmac(undefined as any, 'secret')).toThrow();
    });

    test('should handle null inputs gracefully', () => {
      expect(() => CryptoUtils.hashWithSalt(null as any, 'salt')).toThrow();
      expect(() => CryptoUtils.createHmac(null as any, 'secret')).toThrow();
    });
  });

  describe('Security Properties', () => {
    test('should produce cryptographically strong hashes', () => {
      const inputs = ['test1', 'test2', 'test3'];
      const salt = CryptoUtils.generateSalt();
      
      const hashes = inputs.map(input => CryptoUtils.hashWithSalt(input, salt));
      
      // All hashes should be different
      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(hashes.length);
      
      // Hashes should be reasonably long (base64 encoding of SHA-256)
      hashes.forEach(hash => {
        expect(hash.length).toBeGreaterThan(40);
      });
    });

    test('should have good avalanche effect', () => {
      const salt = CryptoUtils.generateSalt();
      
      const hash1 = CryptoUtils.hashWithSalt('test', salt);
      const hash2 = CryptoUtils.hashWithSalt('Test', salt); // Only case difference
      
      expect(hash1).not.toBe(hash2);
      
      // Should have significant difference (avalanche effect)
      let differences = 0;
      const minLength = Math.min(hash1.length, hash2.length);
      
      for (let i = 0; i < minLength; i++) {
        if (hash1[i] !== hash2[i]) {
          differences++;
        }
      }
      
      // Should have changed many characters
      expect(differences / minLength).toBeGreaterThan(0.3);
    });
  });
});
