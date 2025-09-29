/**
 * Token detection utilities for identifying sensitive information
 */

/**
 * Patterns for detecting sensitive tokens
 */
export const TOKEN_PATTERNS = {
  // API Keys and tokens
  API_KEY: /(?:api[_-]?key|apikey|key)["\s]*[:=]["\s]*([a-zA-Z0-9_\-\.]{16,})/gi,
  ACCESS_TOKEN: /(?:access[_-]?token|accesstoken|token)["\s]*[:=]["\s]*([a-zA-Z0-9_\-\.]{16,})/gi,
  SECRET_KEY: /(?:secret[_-]?key|secretkey|secret)["\s]*[:=]["\s]*([a-zA-Z0-9_\-\.]{16,})/gi,
  
  // Authentication tokens
  BEARER_TOKEN: /Bearer\s+([a-zA-Z0-9_\-\.]{16,})/gi,
  JWT_TOKEN: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/gi,
  
  // Database and service credentials
  PASSWORD: /(?:password|passwd|pwd)["\s]*[:=]["\s]*([^\s"']{8,})/gi,
  DATABASE_URL: /(?:database[_-]?url|db[_-]?url)["\s]*[:=]["\s]*([^\s"']{10,})/gi,
  
  // Cloud provider specific
  AWS_ACCESS_KEY: /AKIA[0-9A-Z]{16}/gi,
  AWS_SECRET_KEY: /[a-zA-Z0-9\/+=]{40}/gi,
  AZURE_CLIENT_SECRET: /[a-zA-Z0-9~\-._]{34,}/gi,
  
  // Personal identifiers
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
  PHONE: /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/gi,
  SSN: /(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}/gi,
  CREDIT_CARD: /(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})/gi,
  
  // IP Addresses (private ranges that might be sensitive)
  PRIVATE_IP: /(?:10\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|172\.(?:1[6-9]|2[0-9]|3[0-1])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|192\.168\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))/gi,
  
  // Generic sensitive patterns
  UUID: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
  HEX_TOKEN: /[a-fA-F0-9]{32,}/gi,
  BASE64_TOKEN: /[A-Za-z0-9+/]{20,}={0,2}/gi
};

/**
 * Configuration for token detection
 */
export interface TokenDetectionConfig {
  /** Patterns to use for detection */
  patterns: (keyof typeof TOKEN_PATTERNS)[];
  /** Minimum token length to consider */
  minLength: number;
  /** Custom patterns to include */
  customPatterns?: RegExp[];
  /** Tokens to explicitly exclude from anonymization */
  exclusions?: string[];
  /** Case sensitive matching */
  caseSensitive: boolean;
}

/**
 * Default configuration for token detection
 */
export const DEFAULT_DETECTION_CONFIG: TokenDetectionConfig = {
  patterns: [
    'API_KEY',
    'ACCESS_TOKEN', 
    'SECRET_KEY',
    'BEARER_TOKEN',
    'JWT_TOKEN',
    'PASSWORD',
    'EMAIL',
    'PHONE',
    'PRIVATE_IP',
    'UUID'
  ],
  minLength: 8,
  caseSensitive: false,
  exclusions: ['localhost', '127.0.0.1', 'example.com', 'test@example.com']
};

/**
 * Detected token information
 */
export interface DetectedToken {
  /** The detected token value */
  value: string;
  /** Type of token detected */
  type: string;
  /** Start position in the original text */
  startIndex: number;
  /** End position in the original text */
  endIndex: number;
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Token detector class for identifying sensitive information
 */
export class TokenDetector {
  private config: TokenDetectionConfig;

  constructor(config: Partial<TokenDetectionConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
  }

  /**
   * Detect sensitive tokens in text
   * @param text - Text to analyze
   * @returns Array of detected tokens
   */
  detectTokens(text: string): DetectedToken[] {
    const detected: DetectedToken[] = [];
    const processedText = this.config.caseSensitive ? text : text.toLowerCase();

    try {
      // Check each configured pattern
      for (const patternName of this.config.patterns) {
        const pattern = TOKEN_PATTERNS[patternName];
        if (!pattern) {
          continue;
        }

        // Reset regex state
        pattern.lastIndex = 0;
        
        let match;
        while ((match = pattern.exec(processedText)) !== null) {
          const value = match[1] || match[0];
          
          // Skip if too short or in exclusions
          if (value.length < this.config.minLength || 
              this.config.exclusions?.includes(value.toLowerCase())) {
            continue;
          }

          // Calculate confidence based on pattern type and length
          const confidence = this.calculateConfidence(patternName, value);

          detected.push({
            value: this.config.caseSensitive ? value : text.substring(match.index, match.index + value.length),
            type: patternName,
            startIndex: match.index,
            endIndex: match.index + value.length,
            confidence
          });
        }
      }

      // Check custom patterns
      if (this.config.customPatterns) {
        for (const pattern of this.config.customPatterns) {
          pattern.lastIndex = 0;
          
          let match;
          while ((match = pattern.exec(processedText)) !== null) {
            const value = match[0];
            
            if (value.length >= this.config.minLength) {
              detected.push({
                value: this.config.caseSensitive ? value : text.substring(match.index, match.index + value.length),
                type: 'CUSTOM',
                startIndex: match.index,
                endIndex: match.index + value.length,
                confidence: 0.7 // Medium confidence for custom patterns
              });
            }
          }
        }
      }

      // Remove duplicates and sort by position
      return this.deduplicateTokens(detected);
      
    } catch (error) {
      throw new Error(`Token detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate confidence score for detected token
   * @param patternType - Type of pattern that matched
   * @param value - The detected value
   * @returns Confidence score between 0 and 1
   */
  private calculateConfidence(patternType: string, value: string): number {
    try {
      // Base confidence by pattern type
      const baseConfidence: Record<string, number> = {
        'JWT_TOKEN': 0.95,
        'AWS_ACCESS_KEY': 0.95,
        'BEARER_TOKEN': 0.9,
        'API_KEY': 0.85,
        'SECRET_KEY': 0.85,
        'EMAIL': 0.9,
        'UUID': 0.9,
        'CREDIT_CARD': 0.95,
        'PHONE': 0.8,
        'PRIVATE_IP': 0.8,
        'PASSWORD': 0.7,
        'HEX_TOKEN': 0.6,
        'BASE64_TOKEN': 0.6
      };

      let confidence = baseConfidence[patternType] || 0.5;

      // Adjust based on length
      if (value.length > 50) {
        confidence += 0.1;
      } else if (value.length < 16) {
        confidence -= 0.1;
      }

      // Adjust based on entropy (randomness)
      const entropy = this.calculateEntropy(value);
      if (entropy > 4) {
        confidence += 0.1;
      } else if (entropy < 2) {
        confidence -= 0.2;
      }

      return Math.max(0, Math.min(1, confidence));
      
    } catch (error) {
      return 0.5; // Default confidence on error
    }
  }

  /**
   * Calculate Shannon entropy of a string
   * @param str - String to analyze
   * @returns Entropy value
   */
  private calculateEntropy(str: string): number {
    try {
      const freq: Record<string, number> = {};
      
      for (const char of str) {
        freq[char] = (freq[char] || 0) + 1;
      }

      let entropy = 0;
      const length = str.length;

      for (const count of Object.values(freq)) {
        const probability = count / length;
        entropy -= probability * Math.log2(probability);
      }

      return entropy;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Remove duplicate and overlapping tokens
   * @param tokens - Array of detected tokens
   * @returns Deduplicated array sorted by position
   */
  private deduplicateTokens(tokens: DetectedToken[]): DetectedToken[] {
    try {
      // Sort by start index
      tokens.sort((a, b) => a.startIndex - b.startIndex);

      const result: DetectedToken[] = [];
      
      for (const token of tokens) {
        // Check if this token overlaps with any already added
        const hasOverlap = result.some(existing => 
          (token.startIndex >= existing.startIndex && token.startIndex < existing.endIndex) ||
          (token.endIndex > existing.startIndex && token.endIndex <= existing.endIndex) ||
          (token.startIndex <= existing.startIndex && token.endIndex >= existing.endIndex)
        );

        if (!hasOverlap) {
          result.push(token);
        } else {
          // If there's overlap, keep the one with higher confidence
          const overlappingIndex = result.findIndex(existing => 
            (token.startIndex >= existing.startIndex && token.startIndex < existing.endIndex) ||
            (token.endIndex > existing.startIndex && token.endIndex <= existing.endIndex) ||
            (token.startIndex <= existing.startIndex && token.endIndex >= existing.endIndex)
          );

          if (overlappingIndex >= 0 && result[overlappingIndex] && token.confidence > result[overlappingIndex]!.confidence) {
            result[overlappingIndex] = token;
          }
        }
      }

      return result;
      
    } catch (error) {
      throw new Error(`Token deduplication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a string contains any sensitive tokens
   * @param text - Text to check
   * @returns True if sensitive tokens are detected
   */
  hasSensitiveTokens(text: string): boolean {
    try {
      return this.detectTokens(text).length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get statistics about detected tokens
   * @param text - Text to analyze
   * @returns Statistics object
   */
  getDetectionStats(text: string): {
    totalTokens: number;
    byType: Record<string, number>;
    averageConfidence: number;
    highConfidenceCount: number;
  } {
    try {
      const tokens = this.detectTokens(text);
      const byType: Record<string, number> = {};
      
      let totalConfidence = 0;
      let highConfidenceCount = 0;

      for (const token of tokens) {
        byType[token.type] = (byType[token.type] || 0) + 1;
        totalConfidence += token.confidence;
        if (token.confidence > 0.8) {
          highConfidenceCount++;
        }
      }

      return {
        totalTokens: tokens.length,
        byType,
        averageConfidence: tokens.length > 0 ? totalConfidence / tokens.length : 0,
        highConfidenceCount
      };
      
    } catch (error) {
      return {
        totalTokens: 0,
        byType: {},
        averageConfidence: 0,
        highConfidenceCount: 0
      };
    }
  }
}
