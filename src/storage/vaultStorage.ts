import { StorageInterface, MappingData, StorageError, VaultConfig } from '../core/types';

// Note: node-vault is an optional dependency for Vault integration
let nodeVault: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  nodeVault = require('node-vault');
} catch (error) {
  // Vault integration is optional
}

/**
 * HashiCorp Vault storage implementation for mappings
 * Provides secure, persistent storage with encryption at rest
 */
export class VaultStorage implements StorageInterface {
  private vault: any = null;
  private config: VaultConfig;
  private basePath: string;
  private isInitialized: boolean = false;

  constructor(config: VaultConfig) {
    this.config = {
      timeout: 5000,
      verifyTls: true,
      ...config
    };
    this.basePath = `${this.config.mountPath}/anon-proxy-mappings`;
  }

  /**
   * Initialize connection to Vault
   */
  private async initialize(): Promise<void> {
    try {
      if (this.isInitialized && this.vault) {
        return;
      }

      if (!nodeVault) {
        throw new StorageError('node-vault package is required for Vault storage. Install with: npm install node-vault');
      }

      this.vault = nodeVault({
        endpoint: this.config.endpoint,
        token: this.config.token,
        requestOptions: {
          timeout: this.config.timeout,
          rejectUnauthorized: this.config.verifyTls
        }
      });

      // Test connection
      await this.vault.status();
      this.isInitialized = true;
      
    } catch (error) {
      throw new StorageError(`Failed to initialize Vault connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store a mapping in Vault
   * @param mapId - Unique identifier for the mapping
   * @param mappingData - The mapping data to store
   */
  async store(mapId: string, mappingData: MappingData): Promise<void> {
    try {
      await this.initialize();

      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      if (!mappingData) {
        throw new StorageError('Mapping data is required');
      }

      // Convert Map to plain object for JSON serialization
      const serializedData = {
        id: mappingData.id,
        mappings: Object.fromEntries(mappingData.mappings),
        createdAt: mappingData.createdAt.toISOString(),
        signature: mappingData.signature,
        strategy: mappingData.strategy
      };

      const path = `${this.basePath}/${mapId}`;
      
      await this.vault.write(path, {
        data: serializedData,
        metadata: {
          created_at: new Date().toISOString(),
          version: '1.0.0'
        }
      });
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to store mapping in Vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve a mapping from Vault
   * @param mapId - Unique identifier for the mapping
   * @returns The mapping data or null if not found
   */
  async retrieve(mapId: string): Promise<MappingData | null> {
    try {
      await this.initialize();

      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      const path = `${this.basePath}/${mapId}`;
      
      try {
        const response = await this.vault.read(path);
        
        if (!response || !response.data || !response.data.data) {
          return null;
        }

        const data = response.data.data;
        
        // Reconstruct Map from plain object
        const mappings = new Map<string, string>(Object.entries(data.mappings) as [string, string][]);
        
        return {
          id: data.id,
          mappings,
          createdAt: new Date(data.createdAt),
          signature: data.signature,
          strategy: data.strategy
        };
        
      } catch (vaultError: any) {
        // Check if it's a "not found" error
        if (vaultError.response && vaultError.response.status === 404) {
          return null;
        }
        throw vaultError;
      }
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to retrieve mapping from Vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a mapping from Vault
   * @param mapId - Unique identifier for the mapping
   */
  async delete(mapId: string): Promise<void> {
    try {
      await this.initialize();

      if (!mapId || typeof mapId !== 'string') {
        throw new StorageError('Map ID must be a non-empty string');
      }

      const path = `${this.basePath}/${mapId}`;
      
      try {
        await this.vault.delete(path);
      } catch (vaultError: any) {
        // Ignore 404 errors when deleting
        if (vaultError.response && vaultError.response.status === 404) {
          return;
        }
        throw vaultError;
      }
      
    } catch (error) {
      if (error instanceof StorageError) {
        throw error;
      }
      throw new StorageError(`Failed to delete mapping from Vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all mappings from Vault (use with extreme caution)
   */
  async clear(): Promise<void> {
    try {
      await this.initialize();

      // List all mappings first
      const mappingIds = await this.listAllMappings();
      
      // Delete each mapping
      const deletePromises = mappingIds.map(id => this.delete(id));
      await Promise.all(deletePromises);
      
    } catch (error) {
      throw new StorageError(`Failed to clear mappings from Vault: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if Vault storage is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.initialize();
      
      // Check Vault status and authentication
      const status = await this.vault.status();
      
      // Check if we can access our mount point
      const mounts = await this.vault.mounts();
      const mountExists = Object.keys(mounts.data).some(mount => 
        mount.startsWith(this.config.mountPath + '/')
      );
      
      return status.sealed === false && mountExists;
      
    } catch (error) {
      return false;
    }
  }

  /**
   * List all mapping IDs (for management purposes)
   * @returns Array of mapping IDs
   */
  private async listAllMappings(): Promise<string[]> {
    try {
      await this.initialize();

      try {
        const response = await this.vault.list(this.basePath);
        
        if (!response || !response.data || !response.data.keys) {
          return [];
        }
        
        return response.data.keys.filter((key: string) => !key.endsWith('/'));
        
      } catch (vaultError: any) {
        // If path doesn't exist, return empty array
        if (vaultError.response && vaultError.response.status === 404) {
          return [];
        }
        throw vaultError;
      }
      
    } catch (error) {
      throw new StorageError(`Failed to list mappings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get storage statistics
   * @returns Storage statistics object
   */
  async getStats(): Promise<{
    totalMappings: number;
    vaultStatus: string;
    mountPath: string;
    healthCheck: boolean;
  }> {
    try {
      const mappingIds = await this.listAllMappings();
      const health = await this.healthCheck();
      
      let vaultStatus = 'unknown';
      try {
        const status = await this.vault.status();
        vaultStatus = status.sealed ? 'sealed' : 'unsealed';
      } catch (error) {
        vaultStatus = 'error';
      }

      return {
        totalMappings: mappingIds.length,
        vaultStatus,
        mountPath: this.config.mountPath,
        healthCheck: health
      };
      
    } catch (error) {
      return {
        totalMappings: 0,
        vaultStatus: 'error',
        mountPath: this.config.mountPath,
        healthCheck: false
      };
    }
  }

  /**
   * Test Vault connectivity and permissions
   * @returns Test result with details
   */
  async testConnection(): Promise<{
    success: boolean;
    details: {
      endpoint: string;
      authentication: boolean;
      mountAccess: boolean;
      readWrite: boolean;
    };
    error?: string;
  }> {
    const result = {
      success: false,
      details: {
        endpoint: this.config.endpoint,
        authentication: false,
        mountAccess: false,
        readWrite: false
      }
    };

    try {
      // Test basic connection
      await this.initialize();
      
      // Test authentication
      await this.vault.status();
      result.details.authentication = true;

      // Test mount access
      const mounts = await this.vault.mounts();
      result.details.mountAccess = Object.keys(mounts.data).some(mount => 
        mount.startsWith(this.config.mountPath + '/')
      );

      // Test read/write permissions with a temporary mapping
      const testId = `test-${Date.now()}`;
      const testMapping: MappingData = {
        id: testId,
        mappings: new Map([['test', 'value']]),
        createdAt: new Date(),
        strategy: 'hash_salt' as any
      };

      await this.store(testId, testMapping);
      const retrieved = await this.retrieve(testId);
      await this.delete(testId);

      result.details.readWrite = retrieved !== null;
      result.success = true;

      return result;
      
    } catch (error) {
      return {
        ...result,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get Vault configuration (without sensitive data)
   * @returns Safe configuration object
   */
  getConfig(): {
    endpoint: string;
    mountPath: string;
    timeout: number;
    verifyTls: boolean;
  } {
    return {
      endpoint: this.config.endpoint,
      mountPath: this.config.mountPath,
      timeout: this.config.timeout || 5000,
      verifyTls: this.config.verifyTls !== false
    };
  }

  /**
   * Check if a mapping exists in Vault
   * @param mapId - Mapping ID to check
   * @returns True if mapping exists
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
      this.vault = null;
      this.isInitialized = false;
    } catch (error) {
      // Fail silently during disposal
    }
  }
}
