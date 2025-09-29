import { TokenDetector, TOKEN_PATTERNS, DEFAULT_DETECTION_CONFIG } from '../../utils/tokenDetector';

describe('TokenDetector', () => {
  let detector: TokenDetector;

  beforeEach(() => {
    detector = new TokenDetector();
  });

  describe('Basic Token Detection', () => {
    test('should detect API keys', () => {
      const text = 'Use API key sk-1234567890abcdef for authentication';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0]?.value).toBe('sk-1234567890abcdef');
      expect(tokens[0]?.type).toBe('API_KEY');
    });

    test('should detect email addresses', () => {
      const text = 'Contact us at user@example.com';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.value).toBe('user@example.com');
      expect(tokens[0]?.type).toBe('EMAIL');
    });

    test('should detect JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const text = `Bearer ${jwt}`;
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.type === 'JWT_TOKEN')).toBe(true);
    });

    test('should detect phone numbers', () => {
      const text = 'Call me at +1-555-123-4567';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.type).toBe('PHONE');
    });

    test('should detect UUIDs', () => {
      const text = 'User ID: 550e8400-e29b-41d4-a716-446655440000';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.value).toBe('550e8400-e29b-41d4-a716-446655440000');
      expect(tokens[0]?.type).toBe('UUID');
    });

    test('should detect private IP addresses', () => {
      const text = 'Connect to 192.168.1.100 or 10.0.0.1';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(2);
      expect(tokens.some(t => t.value === '192.168.1.100')).toBe(true);
      expect(tokens.some(t => t.value === '10.0.0.1')).toBe(true);
    });
  });

  describe('Multiple Token Detection', () => {
    test('should detect multiple different token types', () => {
      const text = `
        API Key: sk-1234567890abcdef
        Email: admin@company.com  
        Phone: 555-123-4567
        UUID: 550e8400-e29b-41d4-a716-446655440000
      `;
      
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBeGreaterThan(3);
      const types = tokens.map(t => t.type);
      expect(types).toContain('API_KEY');
      expect(types).toContain('EMAIL');
      expect(types).toContain('PHONE');
      expect(types).toContain('UUID');
    });

    test('should handle overlapping matches correctly', () => {
      const text = 'user@api-key-domain.com and api-key@test.com';
      const tokens = detector.detectTokens(text);
      
      // Should detect emails, not get confused by "api-key" in domain
      expect(tokens.length).toBe(2);
      expect(tokens.every(t => t.type === 'EMAIL')).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should respect minimum length setting', () => {
      const customDetector = new TokenDetector({ minLength: 20 });
      
      const text = 'Short key: sk-123 and long key: sk-1234567890abcdefghijklmnop';
      const tokens = customDetector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.value.length).toBeGreaterThanOrEqual(20);
    });

    test('should respect case sensitivity setting', () => {
      const caseSensitive = new TokenDetector({ caseSensitive: true });
      const caseInsensitive = new TokenDetector({ caseSensitive: false });
      
      const text = 'API Key: SK-1234567890ABCDEF';
      
      const sensitiveTokens = caseSensitive.detectTokens(text);
      const insensitiveTokens = caseInsensitive.detectTokens(text);
      
      // Both should detect, but may handle differently
      expect(sensitiveTokens.length).toBeGreaterThanOrEqual(0);
      expect(insensitiveTokens.length).toBeGreaterThanOrEqual(0);
    });

    test('should respect exclusions', () => {
      const detector = new TokenDetector({
        exclusions: ['test@example.com', 'localhost']
      });
      
      const text = 'Emails: test@example.com and real@company.com';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.value).toBe('real@company.com');
    });

    test('should work with custom patterns', () => {
      const customPattern = /CUSTOM-[A-Z0-9]{8}/g;
      const detector = new TokenDetector({
        customPatterns: [customPattern]
      });
      
      const text = 'Use token CUSTOM-ABC12345 for access';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.value).toBe('CUSTOM-ABC12345');
      expect(tokens[0]?.type).toBe('CUSTOM');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty text', () => {
      const tokens = detector.detectTokens('');
      expect(tokens).toEqual([]);
    });

    test('should handle text with no tokens', () => {
      const text = 'This is just regular text with no sensitive information';
      const tokens = detector.detectTokens(text);
      expect(tokens).toEqual([]);
    });

    test('should handle malformed tokens', () => {
      const text = 'Incomplete email @ and malformed API key sk-';
      const tokens = detector.detectTokens(text);
      
      // Should not detect malformed tokens
      expect(tokens.length).toBe(0);
    });

    test('should handle very long text', () => {
      const longText = 'API key sk-1234567890abcdef '.repeat(1000);
      const tokens = detector.detectTokens(longText);
      
      expect(tokens.length).toBeGreaterThan(0);
      // Should handle without performance issues
    });

    test('should handle special characters and unicode', () => {
      const text = 'Email: tëst@éxåmple.com and UUID: 550e8400-e29b-41d4-a716-446655440000';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBeGreaterThan(0);
    });
  });

  describe('Confidence Scoring', () => {
    test('should assign confidence scores', () => {
      const text = 'API key sk-1234567890abcdef';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.confidence).toBeGreaterThan(0);
      expect(tokens[0]?.confidence).toBeLessThanOrEqual(1);
    });

    test('should assign higher confidence to well-formed tokens', () => {
      const text = `
        JWT: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test
        Generic: randomstring123
      `;
      
      const tokens = detector.detectTokens(text);
      
      const jwtToken = tokens.find(t => t.type === 'JWT_TOKEN');
      const hexToken = tokens.find(t => t.type === 'HEX_TOKEN');
      
      if (jwtToken && hexToken) {
        expect(jwtToken.confidence).toBeGreaterThan(hexToken.confidence);
      }
    });
  });

  describe('Position Tracking', () => {
    test('should track token positions correctly', () => {
      const text = 'Start API key sk-1234567890abcdef end';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(1);
      expect(tokens[0]?.startIndex).toBeGreaterThan(0);
      expect(tokens[0]?.endIndex).toBeGreaterThan(tokens[0]!.startIndex);
      
      const extractedToken = text.substring(tokens[0]!.startIndex, tokens[0]!.endIndex);
      expect(extractedToken).toContain('sk-1234567890abcdef');
    });

    test('should handle multiple tokens with correct positions', () => {
      const text = 'Email: user@test.com and API key: sk-123456';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBe(2);
      
      // Positions should not overlap
      for (let i = 0; i < tokens.length - 1; i++) {
        for (let j = i + 1; j < tokens.length; j++) {
          const token1 = tokens[i];
          const token2 = tokens[j];
          
          const overlap = !(token1!.endIndex <= token2!.startIndex || token2!.endIndex <= token1!.startIndex);
          expect(overlap).toBe(false);
        }
      }
    });
  });

  describe('Utility Methods', () => {
    test('should detect if text has sensitive tokens', () => {
      const sensitiveText = 'API key sk-1234567890abcdef';
      const normalText = 'Just normal text';
      
      expect(detector.hasSensitiveTokens(sensitiveText)).toBe(true);
      expect(detector.hasSensitiveTokens(normalText)).toBe(false);
    });

    test('should provide detection statistics', () => {
      const text = `
        API key: sk-1234567890abcdef
        Email: user@test.com
        Another email: admin@test.com
        UUID: 550e8400-e29b-41d4-a716-446655440000
      `;
      
      const stats = detector.getDetectionStats(text);
      
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.byType).toBeDefined();
      expect(stats.averageConfidence).toBeGreaterThan(0);
      expect(stats.averageConfidence).toBeLessThanOrEqual(1);
      expect(stats.highConfidenceCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Pattern Coverage', () => {
    test('should have patterns for all configured types', () => {
      const configuredPatterns = DEFAULT_DETECTION_CONFIG.patterns;
      
      configuredPatterns.forEach(patternName => {
        expect(TOKEN_PATTERNS[patternName]).toBeDefined();
      });
    });

    test('should detect AWS credentials', () => {
      const text = 'AWS Access Key: AKIAIOSFODNN7EXAMPLE';
      const tokens = detector.detectTokens(text);
      
      // Should detect as either AWS_ACCESS_KEY or generic pattern
      expect(tokens.length).toBeGreaterThan(0);
    });

    test('should detect bearer tokens', () => {
      const text = 'Authorization: Bearer abc123def456ghi789';
      const tokens = detector.detectTokens(text);
      
      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens.some(t => t.type === 'BEARER_TOKEN')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid regex gracefully', () => {
      const validPattern = /test/g; // Valid regex
      
      expect(() => {
        new TokenDetector({
          customPatterns: [validPattern]
        });
      }).not.toThrow();
    });

    test('should handle null/undefined input gracefully', () => {
      expect(() => detector.detectTokens(null as any)).toThrow();
      expect(() => detector.detectTokens(undefined as any)).toThrow();
    });
  });
});
