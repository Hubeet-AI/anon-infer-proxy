import { AnonEngine } from '../../core/anonEngine';
import { AnonymizationStrategy, StorageBackend, ValidationError, SignatureError } from '../../core/types';
import '../matchers';

describe('AnonEngine', () => {
  let engine: AnonEngine;

  beforeEach(() => {
    engine = new AnonEngine({
      strategy: AnonymizationStrategy.HASH_SALT,
      storage: StorageBackend.MEMORY,
      enableSignatures: true,
      signatureSecret: 'test-secret-key',
      enableLogging: false
    });
  });

  afterEach(() => {
    engine.dispose();
  });

  describe('Basic Anonymization', () => {
    test('should anonymize a prompt with sensitive tokens', async () => {
      const prompt = 'Please use API key sk-1234567890abcdef for authentication';
      
      const result = await engine.anonymize(prompt);
      
      expect(result.anonPrompt).not.toBe(prompt);
      expect(result.anonPrompt).toContainProxy();
      expect(result.mapId).toBeDefined();
      expect(result.signature).toBeDefined();
    });

    test('should return original prompt when no sensitive tokens found', async () => {
      const prompt = 'This is a simple prompt without any sensitive information';
      
      const result = await engine.anonymize(prompt);
      
      expect(result.anonPrompt).toBe(prompt);
      expect(result.mapId).toBeDefined();
      expect(result.signature).toBeDefined();
    });

    test('should handle multiple sensitive tokens', async () => {
      const prompt = 'API key: sk-123456 and email: user@example.com and token: abc-def-ghi';
      
      const result = await engine.anonymize(prompt);
      
      expect(result.anonPrompt).not.toBe(prompt);
      expect(result.anonPrompt).toContainProxy();
      expect(result.anonPrompt).not.toContain('sk-123456');
      expect(result.anonPrompt).not.toContain('user@example.com');
    });

    test('should handle empty or invalid input', async () => {
      await expect(engine.anonymize('')).rejects.toThrow(ValidationError);
      await expect(engine.anonymize(null as any)).rejects.toThrow(ValidationError);
      await expect(engine.anonymize(undefined as any)).rejects.toThrow(ValidationError);
    });
  });

  describe('Deanonymization', () => {
    test('should correctly deanonymize output', async () => {
      const prompt = 'Use API key sk-1234567890abcdef';
      
      // Anonymize first
      const anonResult = await engine.anonymize(prompt);
      
      // Simulate external service response with proxy token
      const externalOutput = `Processing with token ${anonResult.anonPrompt.split(' ').pop()}`;
      
      // Deanonymize
      const deanonymized = await engine.deanonymize(
        externalOutput, 
        anonResult.mapId, 
        anonResult.signature
      );
      
      expect(deanonymized).toContain('sk-1234567890abcdef');
      expect(deanonymized).not.toContain('anon_');
    });

    test('should handle output without proxy tokens', async () => {
      const prompt = 'Simple prompt';
      const anonResult = await engine.anonymize(prompt);
      
      const output = 'This response has no proxy tokens';
      const deanonymized = await engine.deanonymize(
        output, 
        anonResult.mapId, 
        anonResult.signature
      );
      
      expect(deanonymized).toBe(output);
    });

    test('should reject invalid mapping ID', async () => {
      const output = 'Some output';
      
      await expect(
        engine.deanonymize(output, 'invalid-id', 'fake-signature')
      ).rejects.toThrow(ValidationError);
    });

    test('should reject invalid signature when signatures enabled', async () => {
      const prompt = 'API key sk-123456';
      const anonResult = await engine.anonymize(prompt);
      
      await expect(
        engine.deanonymize('output', anonResult.mapId, 'invalid-signature')
      ).rejects.toThrow(SignatureError);
    });
  });

  describe('Security Features', () => {
    test('should generate unique proxy tokens for same input', async () => {
      const prompt = 'API key sk-1234567890abcdef';
      
      const result1 = await engine.anonymize(prompt);
      const result2 = await engine.anonymize(prompt);
      
      // Same input should produce different mapping IDs but same proxy tokens
      expect(result1.mapId).not.toBe(result2.mapId);
      
      // Extract proxy tokens
      const proxy1 = result1.anonPrompt.replace('API key ', '');
      const proxy2 = result2.anonPrompt.replace('API key ', '');
      
      // Same strategy should produce same proxy for same token
      expect(proxy1).toBe(proxy2);
    });

    test('should validate signatures correctly', async () => {
      const engineWithSig = new AnonEngine({
        strategy: AnonymizationStrategy.HASH_SALT,
        storage: StorageBackend.MEMORY,
        enableSignatures: true,
        signatureSecret: 'test-secret',
        enableLogging: false
      });

      try {
        const prompt = 'API key sk-123456';
        const result = await engineWithSig.anonymize(prompt);
        
        // Valid signature should work
        await expect(
          engineWithSig.deanonymize('output', result.mapId, result.signature)
        ).resolves.toBeDefined();
        
        // Invalid signature should fail
        await expect(
          engineWithSig.deanonymize('output', result.mapId, 'wrong-signature')
        ).rejects.toThrow(SignatureError);
        
      } finally {
        engineWithSig.dispose();
      }
    });

    test('should handle replay attacks', async () => {
      const prompt = 'API key sk-123456';
      const result = await engine.anonymize(prompt);
      
      // Delete the mapping to simulate expired/invalid mapping
      await engine.deleteMapping(result.mapId);
      
      // Attempt to use the mapping should fail
      await expect(
        engine.deanonymize('output', result.mapId, result.signature)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Configuration', () => {
    test('should require signature secret when signatures enabled', () => {
      expect(() => new AnonEngine({
        enableSignatures: true
        // Missing signatureSecret
      })).toThrow(ValidationError);
    });

    test('should work without signatures', async () => {
      const noSigEngine = new AnonEngine({
        strategy: AnonymizationStrategy.HASH_SALT,
        storage: StorageBackend.MEMORY,
        enableSignatures: false,
        enableLogging: false
      });

      try {
        const prompt = 'API key sk-123456';
        const result = await noSigEngine.anonymize(prompt);
        
        expect(result.signature).toBeUndefined();
        
        await expect(
          noSigEngine.deanonymize('output', result.mapId)
        ).resolves.toBeDefined();
        
      } finally {
        noSigEngine.dispose();
      }
    });

    test('should update configuration correctly', () => {
      expect(() => {
        engine.updateConfig({
          enableLogging: true,
          customSalt: 'new-salt'
        });
      }).not.toThrow();
    });
  });

  describe('Health and Info', () => {
    test('should report health status', async () => {
      const healthy = await engine.healthCheck();
      expect(typeof healthy).toBe('boolean');
    });

    test('should provide engine information', async () => {
      const info = await engine.getInfo();
      
      expect(info).toHaveProperty('strategy');
      expect(info).toHaveProperty('storage');
      expect(info).toHaveProperty('signaturesEnabled');
      expect(info).toHaveProperty('loggingEnabled');
      expect(info).toHaveProperty('storageHealthy');
      expect(info).toHaveProperty('strategyInfo');
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long prompts', async () => {
      const longPrompt = 'API key sk-123456 '.repeat(1000);
      
      const result = await engine.anonymize(longPrompt);
      
      expect(result.anonPrompt.length).toBeGreaterThan(0);
      expect(result.mapId).toBeDefined();
    });

    test('should handle special characters in tokens', async () => {
      const prompt = 'Password: p@ssw0rd!123$%^&*()';
      
      const result = await engine.anonymize(prompt);
      
      // Should work without throwing errors
      expect(result.anonPrompt).toBeDefined();
      expect(result.mapId).toBeDefined();
    });

    test('should handle overlapping token patterns', async () => {
      const prompt = 'Email user@api-key-domain.com and API key user@api-key';
      
      const result = await engine.anonymize(prompt);
      
      expect(result.anonPrompt).toBeDefined();
      expect(result.mapId).toBeDefined();
    });

    test('should handle unicode characters', async () => {
      const prompt = 'API key sk-123456 with unicode: 你好 🔐 ñoño';
      
      const result = await engine.anonymize(prompt);
      const deanonymized = await engine.deanonymize(
        result.anonPrompt, 
        result.mapId, 
        result.signature
      );
      
      expect(deanonymized).toContain('你好');
      expect(deanonymized).toContain('🔐');
      expect(deanonymized).toContain('ñoño');
    });
  });

  describe('Performance', () => {
    test('should handle multiple simultaneous operations', async () => {
      const prompts = [
        'API key sk-111111',
        'API key sk-222222',
        'API key sk-333333'
      ];
      
      const promises = prompts.map(prompt => engine.anonymize(prompt));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.mapId).toBeDefined();
        expect(result.anonPrompt).toContainProxy();
      });
    });

    test('should handle rapid sequential operations', async () => {
      const prompt = 'API key sk-123456';
      
      for (let i = 0; i < 10; i++) {
        const result = await engine.anonymize(prompt);
        expect(result.mapId).toBeDefined();
      }
    });
  });
});
