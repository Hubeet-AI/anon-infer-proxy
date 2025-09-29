import {
  AnonProxyConfig,
  AnonymizationResult,
  MappingData,
  StorageInterface,
  AnonymizationStrategy,
  StorageBackend,
  ValidationError,
  SignatureError,
  StorageError
} from './types';
import { TokenDetector } from '../utils/tokenDetector';
import { CryptoUtils } from '../utils/crypto';
import { HashSaltStrategy } from '../strategies/hashSaltStrategy';
import { EmbeddingsStrategy } from '../strategies/embeddingsStrategy';
import { MemoryStorage } from '../storage/memoryStorage';
import { VaultStorage } from '../storage/vaultStorage';

/**
 * Core anonymization engine
 * Handles the complete anonymization and deanonymization workflow
 */
export class AnonEngine {
  private config: AnonProxyConfig;
  private storage: StorageInterface;
  private tokenDetector: TokenDetector;
  private strategy: HashSaltStrategy | EmbeddingsStrategy;

  constructor(config: Partial<AnonProxyConfig> = {}) {
    // Set default configuration
    this.config = {
      strategy: AnonymizationStrategy.HASH_SALT,
      storage: StorageBackend.MEMORY,
      enableSignatures: false, // Default to false for easier setup
      enableLogging: false,
      ...config
    };

    // Validate configuration
    this.validateConfig();

    // Initialize components
    this.tokenDetector = new TokenDetector();
    this.storage = this.createStorageBackend();
    this.strategy = this.createAnonymizationStrategy();
  }

  /**
   * Validate the configuration
   */
  private validateConfig(): void {
    try {
      if (this.config.enableSignatures && !this.config.signatureSecret) {
        throw new ValidationError('Signature secret is required when enableSignatures is true');
      }

      if (!Object.values(AnonymizationStrategy).includes(this.config.strategy)) {
        throw new ValidationError(`Invalid anonymization strategy: ${this.config.strategy}`);
      }

      if (!Object.values(StorageBackend).includes(this.config.storage)) {
        throw new ValidationError(`Invalid storage backend: ${this.config.storage}`);
      }
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create storage backend based on configuration
   */
  private createStorageBackend(): StorageInterface {
    try {
      switch (this.config.storage) {
        case StorageBackend.MEMORY: {
          return new MemoryStorage();
        }
        
        case StorageBackend.VAULT: {
          // Vault config should be provided via environment variables
          const vaultConfig = {
            endpoint: process.env.VAULT_ENDPOINT || 'http://localhost:8200',
            token: process.env.VAULT_TOKEN || '',
            mountPath: process.env.VAULT_MOUNT_PATH || 'secret',
            timeout: parseInt(process.env.VAULT_TIMEOUT || '5000'),
            verifyTls: process.env.VAULT_VERIFY_TLS !== 'false'
          };
          
          if (!vaultConfig.token) {
            throw new StorageError('VAULT_TOKEN environment variable is required for Vault storage');
          }
          
          return new VaultStorage(vaultConfig);
        }
        
        default:
          throw new StorageError(`Unsupported storage backend: ${this.config.storage}`);
      }
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to create storage backend: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create anonymization strategy based on configuration
   */
  private createAnonymizationStrategy(): HashSaltStrategy | EmbeddingsStrategy {
    try {
      switch (this.config.strategy) {
        case AnonymizationStrategy.HASH_SALT:
          return new HashSaltStrategy(this.config.customSalt);
        
        case AnonymizationStrategy.EMBEDDINGS:
          return new EmbeddingsStrategy();
        
        default:
          throw new ValidationError(`Unsupported anonymization strategy: ${this.config.strategy}`);
      }
      
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Failed to create anonymization strategy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Anonymize a prompt by replacing sensitive tokens
   * @param prompt - Original prompt containing sensitive information
   * @returns Anonymization result with anonymized prompt and mapping ID
   */
  async anonymize(prompt: string): Promise<AnonymizationResult> {
    try {
      if (!prompt || typeof prompt !== 'string') {
        throw new ValidationError('Prompt must be a non-empty string');
      }

      // Detect sensitive tokens in the prompt
      const detectedTokens = this.tokenDetector.detectTokens(prompt);
      
      if (detectedTokens.length === 0) {
        // No sensitive tokens found, return original prompt
        const mapId = CryptoUtils.generateId();
        const emptyMapping: MappingData = {
          id: mapId,
          mappings: new Map(),
          createdAt: new Date(),
          strategy: this.config.strategy
        };
        
        await this.storage.store(mapId, emptyMapping);
        
        return {
          anonPrompt: prompt,
          mapId,
          signature: this.config.enableSignatures ? 
            CryptoUtils.createHmac(`${mapId}:${prompt}`, this.config.signatureSecret!) : 
            undefined
        };
      }

      // Create mappings for detected tokens
      const mappings = new Map<string, string>();
      let anonymizedPrompt = prompt;

      // Sort tokens by position (reverse order to maintain indices during replacement)
      const sortedTokens = detectedTokens.sort((a, b) => b.startIndex - a.startIndex);

      for (const token of sortedTokens) {
        try {
          // Generate anonymous proxy for this token
          const proxyToken = await this.strategy.anonymize(token.value, this.config);
          
          // Store mapping (proxy -> original)
          mappings.set(proxyToken, token.value);
          
          // Replace token in prompt
          anonymizedPrompt = 
            anonymizedPrompt.slice(0, token.startIndex) + 
            proxyToken + 
            anonymizedPrompt.slice(token.endIndex);

          if (this.config.enableLogging) {
            // eslint-disable-next-line no-console
            console.log(`[AnonEngine] Replaced token at ${token.startIndex}-${token.endIndex} with ${proxyToken}`);
          }
          
        } catch (strategyError) {
          throw new ValidationError(`Failed to anonymize token: ${strategyError instanceof Error ? strategyError.message : 'Unknown error'}`);
        }
      }

      // Generate unique mapping ID
      const mapId = CryptoUtils.generateId();

      // Create mapping data
      const mappingData: MappingData = {
        id: mapId,
        mappings,
        createdAt: new Date(),
        strategy: this.config.strategy
      };

      // Add signature if enabled
      if (this.config.enableSignatures) {
        const dataToSign = `${mapId}:${JSON.stringify(Array.from(mappings.entries()))}`;
        mappingData.signature = CryptoUtils.createHmac(dataToSign, this.config.signatureSecret!);
      }

      // Store mapping
      await this.storage.store(mapId, mappingData);

      const result: AnonymizationResult = {
        anonPrompt: anonymizedPrompt,
        mapId,
        signature: mappingData.signature
      };

      if (this.config.enableLogging) {
        // eslint-disable-next-line no-console
        console.log(`[AnonEngine] Anonymized ${detectedTokens.length} tokens, mapping ID: ${mapId}`);
      }

      return result;
      
    } catch (error) {
      if (error instanceof ValidationError || error instanceof SignatureError || error instanceof StorageError) {
        throw error;
      }
      throw new ValidationError(`Anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deanonymize output by restoring original tokens
   * @param output - Output from external service with proxy tokens
   * @param mapId - Mapping ID from anonymization result
   * @param signature - Optional signature for validation
   * @returns Original output with sensitive tokens restored
   */
  async deanonymize(output: string, mapId: string, signature?: string): Promise<string> {
    try {
      if (!output || typeof output !== 'string') {
        throw new ValidationError('Output must be a non-empty string');
      }

      if (!mapId || typeof mapId !== 'string') {
        throw new ValidationError('Map ID must be a non-empty string');
      }

      // Retrieve mapping data
      const mappingData = await this.storage.retrieve(mapId);
      
      if (!mappingData) {
        throw new ValidationError(`Mapping not found for ID: ${mapId}`);
      }

      // Validate signature if enabled
      if (this.config.enableSignatures) {
        if (!signature) {
          throw new SignatureError('Signature is required when signatures are enabled');
        }

        if (!mappingData.signature) {
          throw new SignatureError('Stored mapping does not have a signature');
        }

        if (!CryptoUtils.constantTimeCompare(signature, mappingData.signature)) {
          throw new SignatureError('Invalid signature - mapping may have been tampered with');
        }

        // Also verify the mapping data integrity
        const dataToVerify = `${mapId}:${JSON.stringify(Array.from(mappingData.mappings.entries()))}`;
        if (!CryptoUtils.verifyHmac(dataToVerify, mappingData.signature, this.config.signatureSecret!)) {
          throw new SignatureError('Mapping data signature verification failed');
        }
      }

      // If no mappings, return output unchanged
      if (mappingData.mappings.size === 0) {
        return output;
      }

      let deanonymizedOutput = output;
      let replacementCount = 0;

      // Replace proxy tokens with original tokens
      for (const [proxyToken, originalToken] of mappingData.mappings.entries()) {
        // Use global replace to handle multiple occurrences
        const regex = new RegExp(this.escapeRegExp(proxyToken), 'g');
        const beforeLength = deanonymizedOutput.length;
        deanonymizedOutput = deanonymizedOutput.replace(regex, originalToken);
        
        // Count replacements
        const afterLength = deanonymizedOutput.length;
        const lengthDiff = afterLength - beforeLength;
        const tokenLengthDiff = originalToken.length - proxyToken.length;
        if (tokenLengthDiff !== 0) {
          replacementCount += Math.abs(lengthDiff / tokenLengthDiff);
        }
      }

      if (this.config.enableLogging) {
        // eslint-disable-next-line no-console
        console.log(`[AnonEngine] Restored ${replacementCount} tokens from mapping ${mapId}`);
      }

      return deanonymizedOutput;
      
    } catch (error) {
      if (error instanceof ValidationError || error instanceof SignatureError || error instanceof StorageError) {
        throw error;
      }
      throw new ValidationError(`Deanonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a mapping (cleanup)
   * @param mapId - Mapping ID to delete
   */
  async deleteMapping(mapId: string): Promise<void> {
    try {
      if (!mapId || typeof mapId !== 'string') {
        throw new ValidationError('Map ID must be a non-empty string');
      }

      await this.storage.delete(mapId);

      if (this.config.enableLogging) {
        // eslint-disable-next-line no-console
        console.log(`[AnonEngine] Deleted mapping ${mapId}`);
      }
      
    } catch (error) {
      if (error instanceof ValidationError || error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to delete mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if storage backend is healthy
   * @returns Health check result
   */
  async healthCheck(): Promise<boolean> {
    try {
      return await this.storage.healthCheck();
    } catch (error) {
      return false;
    }
  }

  /**
   * Get engine statistics and configuration
   * @returns Engine information
   */
  async getInfo(): Promise<{
    strategy: string;
    storage: string;
    signaturesEnabled: boolean;
    loggingEnabled: boolean;
    storageHealthy: boolean;
    strategyInfo: any;
  }> {
    try {
      const storageHealthy = await this.healthCheck();
      
      return {
        strategy: this.config.strategy,
        storage: this.config.storage,
        signaturesEnabled: this.config.enableSignatures,
        loggingEnabled: this.config.enableLogging,
        storageHealthy,
        strategyInfo: this.strategy.getInfo() as unknown
      };
      
    } catch (error) {
      return {
        strategy: this.config.strategy,
        storage: this.config.storage,
        signaturesEnabled: this.config.enableSignatures,
        loggingEnabled: this.config.enableLogging,
        storageHealthy: false,
        strategyInfo: null
      };
    }
  }

  /**
   * Update configuration (limited subset)
   * @param newConfig - New configuration options
   */
  updateConfig(newConfig: Partial<Pick<AnonProxyConfig, 'enableLogging' | 'customSalt'>>): void {
    try {
      if (newConfig.enableLogging !== undefined) {
        this.config.enableLogging = newConfig.enableLogging;
      }

      if (newConfig.customSalt !== undefined) {
        this.config.customSalt = newConfig.customSalt;
        
        // Update strategy salt if it's hash-salt strategy
        if (this.strategy instanceof HashSaltStrategy) {
          this.strategy.setSalt(newConfig.customSalt);
        }
      }
      
    } catch (error) {
      throw new ValidationError(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Escape special regex characters
   * @param string - String to escape
   * @returns Escaped string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Dispose of the engine and cleanup resources
   */
  dispose(): void {
    try {
      if (this.storage && typeof this.storage.dispose === 'function') {
        this.storage.dispose();
      }
    } catch (error) {
      // Fail silently during disposal
    }
  }
}
