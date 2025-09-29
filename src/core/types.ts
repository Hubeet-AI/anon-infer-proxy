/**
 * Core types and interfaces for anon-infer-proxy
 */

/**
 * Configuration options for the anonymization proxy
 */
export interface AnonProxyConfig {
  /** Strategy to use for anonymization */
  strategy: AnonymizationStrategy;
  /** Storage backend for mappings */
  storage: StorageBackend;
  /** Enable cryptographic signatures for mapping validation */
  enableSignatures: boolean;
  /** Secret key for HMAC signatures (required if enableSignatures is true) */
  signatureSecret?: string;
  /** Enable logging (default: false for security) */
  enableLogging: boolean;
  /** Custom salt for hash-based strategies */
  customSalt?: string;
}

/**
 * Supported anonymization strategies
 */
export enum AnonymizationStrategy {
  HASH_SALT = 'hash_salt',
  EMBEDDINGS = 'embeddings'
}

/**
 * Supported storage backends
 */
export enum StorageBackend {
  MEMORY = 'memory',
  VAULT = 'vault'
}

/**
 * Result of anonymization operation
 */
export interface AnonymizationResult {
  /** The anonymized prompt with sensitive tokens replaced */
  anonPrompt: string;
  /** Unique identifier for the mapping used to restore original tokens */
  mapId: string;
  /** Cryptographic signature for validation (optional) */
  signature?: string;
}

/**
 * Token mapping entry
 */
export interface TokenMapping {
  /** Original sensitive token */
  original: string;
  /** Anonymous proxy token */
  proxy: string;
  /** Timestamp when mapping was created */
  createdAt: Date;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete mapping data structure
 */
export interface MappingData {
  /** Unique identifier for this mapping */
  id: string;
  /** Map of proxy tokens to original tokens */
  mappings: Map<string, string>;
  /** Timestamp when mapping was created */
  createdAt: Date;
  /** Cryptographic signature for validation */
  signature?: string;
  /** Strategy used for this mapping */
  strategy: AnonymizationStrategy;
}

/**
 * Storage interface for mapping persistence
 */
export interface StorageInterface {
  /**
   * Store a mapping
   * @param mapId - Unique identifier for the mapping
   * @param mappingData - The mapping data to store
   */
  store(mapId: string, mappingData: MappingData): Promise<void>;

  /**
   * Retrieve a mapping
   * @param mapId - Unique identifier for the mapping
   * @returns The mapping data or null if not found
   */
  retrieve(mapId: string): Promise<MappingData | null>;

  /**
   * Delete a mapping
   * @param mapId - Unique identifier for the mapping
   */
  delete(mapId: string): Promise<void>;

  /**
   * Clear all mappings (use with caution)
   */
  clear(): Promise<void>;

  /**
   * Check if storage is healthy/connected
   */
  healthCheck(): Promise<boolean>;

  /**
   * Cleanup resources and connections
   */
  dispose?(): void;
}

/**
 * Anonymization strategy interface
 */
export interface AnonymizationStrategyInterface {
  /**
   * Generate an anonymous proxy for a token
   * @param token - The original sensitive token
   * @param config - Configuration options
   * @returns The anonymous proxy token
   */
  anonymize(token: string, config: AnonProxyConfig): Promise<string>;

  /**
   * Check if this strategy can reverse the anonymization
   */
  isReversible(): boolean;
}

/**
 * Vault configuration options
 */
export interface VaultConfig {
  /** Vault server endpoint */
  endpoint: string;
  /** Authentication token */
  token: string;
  /** Secret engine mount path */
  mountPath: string;
  /** Connection timeout in milliseconds */
  timeout?: number;
  /** Enable TLS verification */
  verifyTls?: boolean;
}

/**
 * Error types for the library
 */
export class AnonProxyError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AnonProxyError';
  }
}

export class ValidationError extends AnonProxyError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class StorageError extends AnonProxyError {
  constructor(message: string) {
    super(message, 'STORAGE_ERROR');
  }
}

export class SignatureError extends AnonProxyError {
  constructor(message: string) {
    super(message, 'SIGNATURE_ERROR');
  }
}
