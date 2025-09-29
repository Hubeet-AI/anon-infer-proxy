import { createAnonEngine, anonymize, deanonymize, DEFAULT_CONFIGS, validateConfig, healthCheck } from '../../index';
import { AnonymizationStrategy, StorageBackend } from '../../core/types';

describe('Full Workflow Integration Tests', () => {
  
  describe('Complete Anonymization Flow', () => {
    test('should complete full anonymization -> inference -> deanonymization flow', async () => {
      const engine = createAnonEngine({
        strategy: AnonymizationStrategy.HASH_SALT,
        storage: StorageBackend.MEMORY,
        enableSignatures: true,
        signatureSecret: 'test-secret',
        enableLogging: false
      });

      try {
        // Original prompt with sensitive data
        const originalPrompt = `
          Please help me with this task:
          - Use API key sk-1234567890abcdef
          - Send email to admin@company.com  
          - Connect to server 192.168.1.100
          - User ID: 550e8400-e29b-41d4-a716-446655440000
        `;

        // Step 1: Anonymize
        const anonResult = await engine.anonymize(originalPrompt);
        
        expect(anonResult.anonPrompt).not.toBe(originalPrompt);
        expect(anonResult.anonPrompt).toContain('anon_');
        expect(anonResult.anonPrompt).not.toContain('sk-1234567890abcdef');
        expect(anonResult.anonPrompt).not.toContain('admin@company.com');
        expect(anonResult.anonPrompt).not.toContain('192.168.1.100');
        expect(anonResult.mapId).toBeDefined();
        expect(anonResult.signature).toBeDefined();

        // Step 2: Simulate external inference service response
        // The external service would receive anonResult.anonPrompt and return a response
        // that might contain the proxy tokens
        const proxyTokens = anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/g) || [];
        const externalResponse = `
          I'll help you with your task:
          - I see you want to use the API key ${proxyTokens[0] || 'anon_token1'}
          - Email will be sent to ${proxyTokens[1] || 'anon_token2'}
          - Server connection to ${proxyTokens[2] || 'anon_token3'}
          - User identified as ${proxyTokens[3] || 'anon_token4'}
        `;

        // Step 3: Deanonymize the response
        const finalResponse = await engine.deanonymize(
          externalResponse,
          anonResult.mapId,
          anonResult.signature
        );

        // Verify original sensitive data is restored
        expect(finalResponse).toContain('sk-1234567890abcdef');
        expect(finalResponse).toContain('admin@company.com');
        expect(finalResponse).toContain('192.168.1.100');
        expect(finalResponse).toContain('550e8400-e29b-41d4-a716-446655440000');
        expect(finalResponse).not.toContain('anon_');

      } finally {
        engine.dispose();
      }
    });

    test('should handle prompts with no sensitive data', async () => {
      const engine = createAnonEngine({
        enableSignatures: false
      });

      try {
        const normalPrompt = 'What is the weather like today?';
        
        const anonResult = await engine.anonymize(normalPrompt);
        expect(anonResult.anonPrompt).toBe(normalPrompt);
        
        const response = 'It is sunny and warm today.';
        const deanonymized = await engine.deanonymize(
          response,
          anonResult.mapId,
          anonResult.signature
        );
        expect(deanonymized).toBe(response);

      } finally {
        engine.dispose();
      }
    });
  });

  describe('Convenience Functions', () => {
    test('should work with convenience anonymize function', async () => {
      const prompt = 'API key: sk-1234567890abcdef';
      
      const result = await anonymize(prompt, {
        enableSignatures: false,
        enableLogging: false
      });

      expect(result.anonPrompt).not.toBe(prompt);
      expect(result.anonPrompt).toContain('anon_');
      expect(result.mapId).toBeDefined();
    });

    test('should work with convenience deanonymize function', async () => {
      const prompt = 'API key: sk-1234567890abcdef';
      const config = {
        enableSignatures: false,
        enableLogging: false
      };
      
      const anonResult = await anonymize(prompt, config);
      
      const output = `Using ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/)?.[0] || 'anon_token'}`;
      const deanonymized = await deanonymize(output, anonResult.mapId, undefined, config);

      expect(deanonymized).toContain('sk-1234567890abcdef');
    });
  });

  describe('Configuration Presets', () => {
    test('should work with development configuration', async () => {
      const engine = createAnonEngine(DEFAULT_CONFIGS.DEVELOPMENT);

      try {
        const prompt = 'API key: sk-1234567890abcdef';
        const result = await engine.anonymize(prompt);

        expect(result.anonPrompt).toContain('anon_');
        expect(result.signature).toBeUndefined(); // Signatures disabled in dev config

      } finally {
        engine.dispose();
      }
    });

    test('should validate production configuration requirements', () => {
      const validation = validateConfig(DEFAULT_CONFIGS.PRODUCTION);
      
      // Should have warnings about missing Vault configuration
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('VAULT_TOKEN'))).toBe(true);
    });

    test('should validate high security configuration', () => {
      const validation = validateConfig({
        ...DEFAULT_CONFIGS.HIGH_SECURITY,
        signatureSecret: 'test-secret'
      });
      
      // Should be valid with signature secret provided
      expect(validation.valid).toBe(false); // Still invalid due to missing Vault config
      expect(validation.errors.some(e => e.includes('signatureSecret'))).toBe(false);
    });
  });

  describe('Multiple Strategies', () => {
    test('should work with hash-salt strategy', async () => {
      const engine = createAnonEngine({
        strategy: AnonymizationStrategy.HASH_SALT,
        storage: StorageBackend.MEMORY,
        enableSignatures: false
      });

      try {
        const prompt = 'API key: sk-1234567890abcdef';
        const result = await engine.anonymize(prompt);

        expect(result.anonPrompt).toContain('anon_');
        
        const info = await engine.getInfo();
        expect(info.strategy).toBe(AnonymizationStrategy.HASH_SALT);

      } finally {
        engine.dispose();
      }
    });

    test('should work with embeddings strategy', async () => {
      const engine = createAnonEngine({
        strategy: AnonymizationStrategy.EMBEDDINGS,
        storage: StorageBackend.MEMORY,
        enableSignatures: false
      });

      try {
        const prompt = 'API key: sk-1234567890abcdef';
        const result = await engine.anonymize(prompt);

        expect(result.anonPrompt).toContain('sem_');
        
        const info = await engine.getInfo();
        expect(info.strategy).toBe(AnonymizationStrategy.EMBEDDINGS);

      } finally {
        engine.dispose();
      }
    });
  });

  describe('Complex Real-World Scenarios', () => {
    test('should handle AWS infrastructure prompt', async () => {
      const engine = createAnonEngine({
        enableSignatures: true,
        signatureSecret: 'aws-test-secret'
      });

      try {
        const awsPrompt = `
          Deploy this infrastructure:
          - AWS Access Key: AKIAIOSFODNN7EXAMPLE
          - Secret: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
          - RDS endpoint: mydb.cluster-abc123.us-west-2.rds.amazonaws.com
          - S3 bucket: s3://my-sensitive-bucket/data
          - Admin email: admin@mycompany.com
          - VPC: vpc-12345678 in region us-west-2
        `;

        const anonResult = await engine.anonymize(awsPrompt);
        
        // Should anonymize all sensitive data
        expect(anonResult.anonPrompt).not.toContain('AKIAIOSFODNN7EXAMPLE');
        expect(anonResult.anonPrompt).not.toContain('wJalrXUtnFEMI/K7MDENG');
        expect(anonResult.anonPrompt).not.toContain('admin@mycompany.com');
        expect(anonResult.anonPrompt).toContain('anon_');

        // Simulate LLM response
        const llmResponse = `
          I'll help you deploy this infrastructure:
          1. First, configure AWS CLI with access key ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/)?.[0]}
          2. Set up the database connection to ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/g)?.[2]}
          3. Send notifications to ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/g)?.[4]}
        `;

        const finalResponse = await engine.deanonymize(
          llmResponse,
          anonResult.mapId,
          anonResult.signature
        );

        // Original credentials should be restored
        expect(finalResponse).toContain('AKIAIOSFODNN7EXAMPLE');
        expect(finalResponse).toContain('mydb.cluster-abc123.us-west-2.rds.amazonaws.com');
        expect(finalResponse).toContain('admin@mycompany.com');

      } finally {
        engine.dispose();
      }
    });

    test('should handle customer support scenario', async () => {
      const engine = createAnonEngine({
        enableSignatures: true,
        signatureSecret: 'support-secret'
      });

      try {
        const supportPrompt = `
          Customer issue:
          - Customer: john.doe@customer.com
          - Phone: +1-555-123-4567
          - Account ID: cust_1234567890
          - Payment method: **** **** **** 1234
          - Issue with order: order_abc123def456
          - API integration key: sk-live_1234567890abcdef
        `;

        const anonResult = await engine.anonymize(supportPrompt);
        
        // PII should be anonymized
        expect(anonResult.anonPrompt).not.toContain('john.doe@customer.com');
        expect(anonResult.anonPrompt).not.toContain('+1-555-123-4567');
        expect(anonResult.anonPrompt).not.toContain('sk-live_1234567890abcdef');

        const supportResponse = `
          I understand the customer ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/)?.[0]} 
          is having issues. Please call them at ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/g)?.[1]} 
          and reference their API key ${anonResult.anonPrompt.match(/anon_[a-zA-Z0-9]+/g)?.[5]}
        `;

        const finalResponse = await engine.deanonymize(
          supportResponse,
          anonResult.mapId,
          anonResult.signature
        );

        expect(finalResponse).toContain('john.doe@customer.com');
        expect(finalResponse).toContain('+1-555-123-4567');
        expect(finalResponse).toContain('sk-live_1234567890abcdef');

      } finally {
        engine.dispose();
      }
    });
  });

  describe('Health and Monitoring', () => {
    test('should provide comprehensive health check', async () => {
      const health = await healthCheck({
        strategy: AnonymizationStrategy.HASH_SALT,
        storage: StorageBackend.MEMORY,
        enableSignatures: false
      });

      expect(health.healthy).toBe(true);
      expect(health.components.storage).toBe(true);
      expect(health.components.strategy).toBe(true);
      expect(health.components.configuration).toBe(true);
      expect(health.details).toBeDefined();
    });

    test('should detect configuration issues in health check', async () => {
      const health = await healthCheck({
        enableSignatures: true
        // Missing signatureSecret
      });

      expect(health.healthy).toBe(false);
      expect(health.components.configuration).toBe(false);
      expect(health.details.configValidation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Error Recovery', () => {
    test('should handle corrupted mapping gracefully', async () => {
      const engine = createAnonEngine({
        enableSignatures: true,
        signatureSecret: 'test-secret'
      });

      try {
        const prompt = 'API key: sk-1234567890abcdef';
        const result = await engine.anonymize(prompt);

        // Attempt deanonymization with wrong signature (simulating corruption)
        await expect(
          engine.deanonymize('output', result.mapId, 'corrupted-signature')
        ).rejects.toThrow();

      } finally {
        engine.dispose();
      }
    });

    test('should handle missing mappings', async () => {
      const engine = createAnonEngine({ enableSignatures: false });

      try {
        await expect(
          engine.deanonymize('output', 'non-existent-id')
        ).rejects.toThrow();

      } finally {
        engine.dispose();
      }
    });
  });

  describe('Performance', () => {
    test('should handle large prompts efficiently', async () => {
      const engine = createAnonEngine({ enableSignatures: false });

      try {
        // Create a large prompt with many sensitive tokens
        const sensitiveTokens = [
          'sk-1234567890abcdef',
          'user1@company.com',
          'user2@company.com', 
          '192.168.1.100',
          '10.0.0.1',
          'cust_1234567890',
          'order_abc123def456'
        ];

        const largePrompt = `
          This is a large prompt with many sensitive tokens repeated multiple times.
          ${sensitiveTokens.map(token => `Token: ${token}`).join('\n').repeat(100)}
        `;

        const startTime = Date.now();
        const result = await engine.anonymize(largePrompt);
        const anonymizeTime = Date.now() - startTime;

        expect(result.anonPrompt).toContain('anon_');
        expect(anonymizeTime).toBeLessThan(5000); // Should complete within 5 seconds

        const deanonymizeStart = Date.now();
        await engine.deanonymize(result.anonPrompt, result.mapId, result.signature);
        const deanonymizeTime = Date.now() - deanonymizeStart;

        expect(deanonymizeTime).toBeLessThan(2000); // Should complete within 2 seconds

      } finally {
        engine.dispose();
      }
    });
  });
});
