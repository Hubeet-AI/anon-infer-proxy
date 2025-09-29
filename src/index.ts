/**
 * anon-infer-proxy - Secure anonymization proxy for LLM inference
 * 
 * Main entry point for the library
 */

// Core exports
export { AnonEngine } from './core/anonEngine';
export {
  AnonProxyConfig,
  AnonymizationResult,
  MappingData,
  TokenMapping,
  StorageInterface,
  AnonymizationStrategyInterface,
  VaultConfig,
  AnonymizationStrategy,
  StorageBackend,
  AnonProxyError,
  ValidationError,
  StorageError,
  SignatureError
} from './core/types';

// Import types for internal use
import {
  AnonProxyConfig,
  AnonymizationResult,
  AnonymizationStrategy,
  StorageBackend
} from './core/types';
import { AnonEngine } from './core/anonEngine';

// Strategy exports
export { HashSaltStrategy } from './strategies/hashSaltStrategy';
export { EmbeddingsStrategy } from './strategies/embeddingsStrategy';

// Storage exports
export { MemoryStorage } from './storage/memoryStorage';
export { VaultStorage } from './storage/vaultStorage';

// Utility exports
export { CryptoUtils } from './utils/crypto';
export { TokenDetector, TOKEN_PATTERNS, DetectedToken } from './utils/tokenDetector';

/**
 * Simple factory function for creating an anonymization engine
 * @param config - Configuration options
 * @returns Configured AnonEngine instance
 */
export function createAnonEngine(config?: Partial<AnonProxyConfig>): AnonEngine {
  return new AnonEngine(config);
}

/**
 * Convenience function for simple anonymization
 * @param prompt - Prompt to anonymize
 * @param config - Optional configuration
 * @returns Anonymization result
 */
export async function anonymize(prompt: string, config?: Partial<AnonProxyConfig>): Promise<AnonymizationResult> {
  const engine = createAnonEngine(config);
  try {
    return await engine.anonymize(prompt);
  } finally {
    engine.dispose();
  }
}

/**
 * Convenience function for simple deanonymization
 * @param output - Output to deanonymize
 * @param mapId - Mapping ID from anonymization
 * @param signature - Optional signature for validation
 * @param config - Optional configuration (must match anonymization config)
 * @returns Deanonymized output
 */
export async function deanonymize(
  output: string, 
  mapId: string, 
  signature?: string, 
  config?: Partial<AnonProxyConfig>
): Promise<string> {
  const engine = createAnonEngine(config);
  try {
    return await engine.deanonymize(output, mapId, signature);
  } finally {
    engine.dispose();
  }
}

/**
 * Library version and metadata
 */
export const VERSION = '1.0.0';
export const LIBRARY_NAME = 'anon-infer-proxy';

/**
 * Default configuration presets
 */
export const DEFAULT_CONFIGS = {
  /** Fast, memory-based anonymization for development */
  DEVELOPMENT: {
    strategy: AnonymizationStrategy.HASH_SALT,
    storage: StorageBackend.MEMORY,
    enableSignatures: false,
    enableLogging: true
  } as Partial<AnonProxyConfig>,

  /** Production configuration with signatures and Vault storage */
  PRODUCTION: {
    strategy: AnonymizationStrategy.HASH_SALT,
    storage: StorageBackend.VAULT,
    enableSignatures: true,
    enableLogging: false,
    // signatureSecret should be provided via environment variable or config
  } as Partial<AnonProxyConfig>,

  /** High security with embeddings and signatures */
  HIGH_SECURITY: {
    strategy: AnonymizationStrategy.EMBEDDINGS,
    storage: StorageBackend.VAULT,
    enableSignatures: true,
    enableLogging: false,
    // signatureSecret should be provided via environment variable or config
  } as Partial<AnonProxyConfig>
};

/**
 * Utility function to validate a configuration
 * @param config - Configuration to validate
 * @returns Validation result
 */
export function validateConfig(config: Partial<AnonProxyConfig>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check required fields when signatures are enabled
    if (config.enableSignatures && !config.signatureSecret) {
      errors.push('signatureSecret is required when enableSignatures is true');
    }

    // Check strategy validity
    if (config.strategy && !Object.values(AnonymizationStrategy).includes(config.strategy)) {
      errors.push(`Invalid anonymization strategy: ${config.strategy}`);
    }

    // Check storage validity
    if (config.storage && !Object.values(StorageBackend).includes(config.storage)) {
      errors.push(`Invalid storage backend: ${config.storage}`);
    }

    // Security warnings
    if (config.enableLogging) {
      warnings.push('Logging is enabled - ensure logs are properly secured');
    }

    if (config.storage === StorageBackend.MEMORY) {
      warnings.push('Memory storage is not persistent - mappings will be lost on restart');
    }

    if (!config.enableSignatures) {
      warnings.push('Signatures are disabled - mappings cannot be validated against tampering');
    }

    // Vault-specific checks
    if (config.storage === StorageBackend.VAULT) {
      if (!process.env.VAULT_TOKEN) {
        errors.push('VAULT_TOKEN environment variable is required for Vault storage');
      }
      if (!process.env.VAULT_ENDPOINT) {
        warnings.push('VAULT_ENDPOINT not set, will use default: http://localhost:8200');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    return {
      valid: false,
      errors: [`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
      warnings
    };
  }
}

/**
 * Health check function for the library
 * @param config - Configuration to test
 * @returns Health status
 */
export async function healthCheck(config?: Partial<AnonProxyConfig>): Promise<{
  healthy: boolean;
  components: {
    storage: boolean;
    strategy: boolean;
    configuration: boolean;
  };
  details?: any;
}> {
  try {
    const engine = createAnonEngine(config);
    
    try {
      const storageHealthy = await engine.healthCheck();
      const info = await engine.getInfo();
      const configValidation = validateConfig(config || {});

      return {
        healthy: storageHealthy && configValidation.valid,
        components: {
          storage: storageHealthy,
          strategy: true, // Strategy validation happens during engine creation
          configuration: configValidation.valid
        },
        details: {
          info,
          configValidation
        }
      };
      
    } finally {
      engine.dispose();
    }
    
  } catch (error) {
    return {
      healthy: false,
      components: {
        storage: false,
        strategy: false,
        configuration: false
      },
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}
