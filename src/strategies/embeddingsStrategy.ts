import { AnonymizationStrategyInterface, AnonProxyConfig } from '../core/types';
import { CryptoUtils } from '../utils/crypto';

/**
 * Embeddings-based anonymization strategy
 * Uses local embeddings to create semantic-preserving but irreversible tokens
 * Note: This is a placeholder implementation - real embeddings would require ML models
 */
export class EmbeddingsStrategy implements AnonymizationStrategyInterface {
  private readonly modelName: string;
  private readonly vectorDimensions: number;
  private readonly semanticPreservation: number;

  constructor(
    modelName: string = 'local-sentence-transformer',
    vectorDimensions: number = 384,
    semanticPreservation: number = 0.8
  ) {
    this.modelName = modelName;
    this.vectorDimensions = vectorDimensions;
    this.semanticPreservation = semanticPreservation;
  }

  /**
   * Anonymize a token using embeddings
   * @param token - Original sensitive token
   * @param config - Configuration options
   * @returns Anonymous proxy token
   */
  async anonymize(token: string, config: AnonProxyConfig): Promise<string> {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token must be a non-empty string');
      }

      // In a real implementation, this would:
      // 1. Generate embeddings for the token using a local model
      // 2. Apply semantic-preserving transformations
      // 3. Create a proxy that maintains semantic similarity but loses exact content
      
      // For now, we simulate this with a semantic hash approach
      const semanticProxy = await this.generateSemanticProxy(token);

      if (config.enableLogging) {
        // eslint-disable-next-line no-console
        console.log(`[EmbeddingsStrategy] Anonymized token (length: ${token.length}) -> ${semanticProxy}`);
      }

      return semanticProxy;
      
    } catch (error) {
      throw new Error(`Embeddings anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if this strategy can reverse the anonymization
   * Embeddings strategy is designed to be irreversible for maximum security
   */
  isReversible(): boolean {
    return false;
  }

  /**
   * Generate a semantic proxy for a token
   * This is a simplified implementation - real version would use ML models
   * @param token - Original token
   * @returns Semantic proxy token
   */
  private async generateSemanticProxy(token: string): Promise<string> {
    try {
      // Simulate embedding generation with deterministic but irreversible transformation
      const tokenFeatures = this.extractTokenFeatures(token);
      const semanticHash = await this.createSemanticHash(tokenFeatures);
      
      return `sem_${semanticHash}`;
      
    } catch (error) {
      throw new Error(`Failed to generate semantic proxy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract semantic features from a token
   * @param token - Input token
   * @returns Feature representation
   */
  private extractTokenFeatures(token: string): {
    length: number;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    isUpperCase: boolean;
    isLowerCase: boolean;
    entropy: number;
    tokenType: string;
  } {
    try {
      return {
        length: Math.min(token.length, 100), // Cap length for consistency
        hasNumbers: /\d/.test(token),
        hasSpecialChars: /[^a-zA-Z0-9]/.test(token),
        isUpperCase: token === token.toUpperCase(),
        isLowerCase: token === token.toLowerCase(),
        entropy: this.calculateSimpleEntropy(token),
        tokenType: this.classifyTokenType(token)
      };
    } catch (error) {
      throw new Error(`Feature extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate simple entropy for a token
   * @param token - Input token
   * @returns Entropy value
   */
  private calculateSimpleEntropy(token: string): number {
    try {
      const freq: Record<string, number> = {};
      
      for (const char of token) {
        freq[char] = (freq[char] || 0) + 1;
      }

      let entropy = 0;
      const length = token.length;

      for (const count of Object.values(freq)) {
        const probability = count / length;
        entropy -= probability * Math.log2(probability);
      }

      return Math.round(entropy * 100) / 100; // Round to 2 decimal places
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Classify the type of token based on patterns
   * @param token - Input token
   * @returns Token type classification
   */
  private classifyTokenType(token: string): string {
    try {
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
        return 'uuid';
      }
      if (/^[A-Za-z0-9+/]{20,}={0,2}$/.test(token)) {
        return 'base64';
      }
      if (/^[a-fA-F0-9]{32,}$/.test(token)) {
        return 'hex';
      }
      if (/^[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+$/.test(token)) {
        return 'email';
      }
      if (/^\+?[\ds\-()]{10,}$/.test(token)) {
        return 'phone';
      }
      if (/^[a-zA-Z0-9_\-.]{16,}$/.test(token)) {
        return 'apikey';
      }
      
      return 'generic';
      
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Create a semantic hash from token features
   * @param features - Extracted token features
   * @returns Semantic hash string
   */
  private async createSemanticHash(features: Record<string, unknown>): Promise<string> {
    try {
      // Create a deterministic but irreversible hash from semantic features
      const featureString = JSON.stringify(features);
      const salt = `semantic_${this.modelName}_${this.vectorDimensions}`;
      
      const hash = CryptoUtils.hashWithSalt(featureString, salt);
      
      // Take first 12 characters for readability
      return hash.substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');
      
    } catch (error) {
      throw new Error(`Semantic hash creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Simulate embedding similarity computation
   * @param token1 - First token
   * @param token2 - Second token
   * @returns Similarity score (0-1)
   */
  async computeSimilarity(token1: string, token2: string): Promise<number> {
    try {
      const features1 = this.extractTokenFeatures(token1);
      const features2 = this.extractTokenFeatures(token2);
      
      // Simple feature-based similarity
      let similarity = 0;
      let featureCount = 0;

      // Compare length similarity
      const lengthSim = 1 - Math.abs(features1.length - features2.length) / Math.max(features1.length, features2.length);
      similarity += lengthSim;
      featureCount++;

      // Compare boolean features
      if (features1.hasNumbers === features2.hasNumbers) similarity += 1;
      if (features1.hasSpecialChars === features2.hasSpecialChars) similarity += 1;
      if (features1.isUpperCase === features2.isUpperCase) similarity += 1;
      if (features1.isLowerCase === features2.isLowerCase) similarity += 1;
      featureCount += 4;

      // Compare entropy
      const entropySim = 1 - Math.abs(features1.entropy - features2.entropy) / Math.max(features1.entropy, features2.entropy);
      similarity += entropySim;
      featureCount++;

      // Compare token type
      if (features1.tokenType === features2.tokenType) similarity += 1;
      featureCount++;

      return similarity / featureCount;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Batch anonymize multiple tokens
   * @param tokens - Array of tokens to anonymize
   * @param config - Configuration options
   * @returns Array of anonymized tokens
   */
  async batchAnonymize(tokens: string[], config: AnonProxyConfig): Promise<string[]> {
    try {
      const results: string[] = [];
      
      for (const token of tokens) {
        const anonymized = await this.anonymize(token, config);
        results.push(anonymized);
      }

      return results;
      
    } catch (error) {
      throw new Error(`Batch anonymization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get strategy information and capabilities
   * @returns Strategy metadata
   */
  getInfo(): {
    name: string;
    version: string;
    isReversible: boolean;
    modelName: string;
    vectorDimensions: number;
    semanticPreservation: number;
    capabilities: string[];
  } {
    return {
      name: 'Embeddings Strategy',
      version: '1.0.0',
      isReversible: this.isReversible(),
      modelName: this.modelName,
      vectorDimensions: this.vectorDimensions,
      semanticPreservation: this.semanticPreservation,
      capabilities: [
        'semantic_preservation',
        'irreversible_anonymization',
        'batch_processing',
        'similarity_computation',
        'token_classification'
      ]
    };
  }

  /**
   * Validate strategy configuration
   * @returns Validation result
   */
  validateConfiguration(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (this.vectorDimensions <= 0) {
      issues.push('Vector dimensions must be positive');
    }

    if (this.semanticPreservation < 0 || this.semanticPreservation > 1) {
      issues.push('Semantic preservation must be between 0 and 1');
    }

    if (!this.modelName || this.modelName.trim().length === 0) {
      issues.push('Model name cannot be empty');
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
