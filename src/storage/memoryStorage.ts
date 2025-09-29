import { StorageInterface, MappingData, StorageError } from '../core/types';

/**
 * In-memory storage implementation for mappings
 * Fast but non-persistent - data is lost when process ends
 */
export class MemoryStorage implements StorageInterface {
  private mappings: Map<string, MappingData>;
  private maxSize: number;
  private ttlMs: number; // Time to live in milliseconds
  private cleanupInterval: NodeJS.Timeout | null;

  constructor(maxSize: number = 10000, ttlMs: number = 3600000) { // Default 1 hour TTL
    this.mappings = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.cleanupInterval = null;
    
    // Start cleanup interval if TTL is enabled
    if (this.ttlMs > 0) {
      this.startCleanupInterval();
    }
  }

  /**
   * Store a mapping
   * @param mapId - Unique identifier for the mapping
   * @param mappingData - The mapping data to store
   */
  async store(mapId: string, mappingData: MappingData): Promise<void> {
    try {
      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      if (!mappingData) {
        throw new StorageError('Mapping data is required');
      }

      // Check size limit
      if (this.mappings.size >= this.maxSize && !this.mappings.has(mapId)) {
        // Remove oldest entry if at capacity
        const oldestKey = this.mappings.keys().next().value;
        if (oldestKey) {
          this.mappings.delete(oldestKey);
        }
      }

      // Store with current timestamp
      const dataToStore: MappingData = {
        ...mappingData,
        createdAt: new Date()
      };

      this.mappings.set(mapId, dataToStore);
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to store mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a mapping
   * @param mapId - Unique identifier for the mapping
   * @returns The mapping data or null if not found
   */
  async retrieve(mapId: string): Promise<MappingData | null> {
    try {
      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      const mappingData = this.mappings.get(mapId);
      
      if (!mappingData) {
        return null;
      }

      // Check if data has expired
      if (this.ttlMs > 0) {
        const age = Date.now() - mappingData.createdAt.getTime();
        if (age > this.ttlMs) {
          // Data has expired, remove it
          this.mappings.delete(mapId);
          return null;
        }
      }

      return mappingData;
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to retrieve mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a mapping
   * @param mapId - Unique identifier for the mapping
   */
  async delete(mapId: string): Promise<void> {
    try {
      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      this.mappings.delete(mapId);
      
    } catch (error) {
      throw new StorageError(`Failed to delete mapping: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all mappings
   */
  async clear(): Promise<void> {
    try {
      this.mappings.clear();
    } catch (error) {
      throw new StorageError(`Failed to clear mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if storage is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // For memory storage, just check if the Map is accessible
      return this.mappings instanceof Map;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns Storage statistics object
   */
  getStats(): {
    totalMappings: number;
    maxSize: number;
    memoryUsage: number;
    oldestMapping?: Date;
    newestMapping?: Date;
    ttlMs: number;
  } {
    try {
      let oldest: Date | undefined;
      let newest: Date | undefined;

      for (const mapping of this.mappings.values()) {
        if (!oldest || mapping.createdAt < oldest) {
          oldest = mapping.createdAt;
        }
        if (!newest || mapping.createdAt > newest) {
          newest = mapping.createdAt;
        }
      }

      // Rough memory usage estimation
      const memoryUsage = this.estimateMemoryUsage();

      return {
        totalMappings: this.mappings.size,
        maxSize: this.maxSize,
        memoryUsage,
        oldestMapping: oldest,
        newestMapping: newest,
        ttlMs: this.ttlMs
      };
      
    } catch (error) {
      return {
        totalMappings: 0,
        maxSize: this.maxSize,
        memoryUsage: 0,
        ttlMs: this.ttlMs
      };
    }
  }

  /**
   * Estimate memory usage in bytes
   * @returns Estimated memory usage
   */
  private estimateMemoryUsage(): number {
    try {
      let totalSize = 0;

      for (const [key, value] of this.mappings.entries()) {
        // Estimate key size
        totalSize += key.length * 2; // UTF-16 encoding

        // Estimate value size
        totalSize += value.id.length * 2;
        totalSize += value.mappings.size * 50; // Rough estimate per mapping entry
        totalSize += 100; // Overhead for dates, enums, etc.
      }

      return totalSize;
      
    } catch (error) {
      return 0;
    }
  }

  /**
   * Start automatic cleanup of expired entries
   */
  private startCleanupInterval(): void {
    try {
      // Run cleanup every 5 minutes
      this.cleanupInterval = setInterval(() => {
        this.cleanup().catch(() => {
          // Silently handle cleanup errors
        });
      }, 5 * 60 * 1000);
      
    } catch (error) {
      // Fail silently - cleanup is optional
    }
  }

  /**
   * Clean up expired entries
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.ttlMs <= 0) {
        return;
      }

      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, value] of this.mappings.entries()) {
        const age = now - value.createdAt.getTime();
        if (age > this.ttlMs) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        this.mappings.delete(key);
      }
      
    } catch (error) {
      // Fail silently - cleanup is best effort
    }
  }

  /**
   * Set TTL for the storage
   * @param ttlMs - Time to live in milliseconds
   */
  setTTL(ttlMs: number): void {
    try {
      this.ttlMs = ttlMs;

      // Restart cleanup interval with new TTL
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      if (this.ttlMs > 0) {
        this.startCleanupInterval();
      }
      
    } catch (error) {
      throw new StorageError(`Failed to set TTL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of all mapping IDs (for debugging/monitoring)
   * @returns Array of mapping IDs
   */
  getAllMappingIds(): string[] {
    try {
      return Array.from(this.mappings.keys());
    } catch (error) {
      return [];
    }
  }

  /**
   * Check if a mapping exists
   * @param mapId - Mapping ID to check
   * @returns True if mapping exists and is not expired
   */
  async exists(mapId: string): Promise<boolean> {
    try {
      const mapping = await this.retrieve(mapId);
      return mapping !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Dispose of the storage and cleanup resources
   */
  dispose(): void {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }
      
      this.mappings.clear();
      
    } catch (error) {
      // Fail silently during disposal
    }
  }
}
