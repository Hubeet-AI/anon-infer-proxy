import { MemoryStorage } from '../../storage/memoryStorage';
import { MappingData, AnonymizationStrategy, StorageError } from '../../core/types';

describe('MemoryStorage', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  afterEach(() => {
    storage.dispose();
  });

  describe('Basic Operations', () => {
    test('should store and retrieve mappings', async () => {
      const mapId = 'test-id-123';
      const mappingData: MappingData = {
        id: mapId,
        mappings: new Map([['proxy1', 'original1'], ['proxy2', 'original2']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      await storage.store(mapId, mappingData);
      const retrieved = await storage.retrieve(mapId);

      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(mapId);
      expect(retrieved!.mappings.size).toBe(2);
      expect(retrieved!.mappings.get('proxy1')).toBe('original1');
      expect(retrieved!.strategy).toBe(AnonymizationStrategy.HASH_SALT);
    });

    test('should return null for non-existent mappings', async () => {
      const result = await storage.retrieve('non-existent-id');
      expect(result).toBeNull();
    });

    test('should delete mappings', async () => {
      const mapId = 'test-delete';
      const mappingData: MappingData = {
        id: mapId,
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      await storage.store(mapId, mappingData);
      expect(await storage.retrieve(mapId)).not.toBeNull();

      await storage.delete(mapId);
      expect(await storage.retrieve(mapId)).toBeNull();
    });

    test('should clear all mappings', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      await storage.store('id1', mappingData);
      await storage.store('id2', mappingData);

      expect(await storage.retrieve('id1')).not.toBeNull();
      expect(await storage.retrieve('id2')).not.toBeNull();

      await storage.clear();

      expect(await storage.retrieve('id1')).toBeNull();
      expect(await storage.retrieve('id2')).toBeNull();
    });
  });

  describe('Size Limits', () => {
    test('should respect maximum size limit', async () => {
      const limitedStorage = new MemoryStorage(2); // Max 2 items
      
      try {
        const createMapping = (id: string): MappingData => ({
          id,
          mappings: new Map([['proxy', 'original']]),
          createdAt: new Date(),
          strategy: AnonymizationStrategy.HASH_SALT
        });

        await limitedStorage.store('id1', createMapping('id1'));
        await limitedStorage.store('id2', createMapping('id2'));
        await limitedStorage.store('id3', createMapping('id3')); // Should evict oldest

        // id1 should be evicted, id2 and id3 should remain
        expect(await limitedStorage.retrieve('id1')).toBeNull();
        expect(await limitedStorage.retrieve('id2')).not.toBeNull();
        expect(await limitedStorage.retrieve('id3')).not.toBeNull();
        
      } finally {
        limitedStorage.dispose();
      }
    });

    test('should allow updating existing mappings without eviction', async () => {
      const limitedStorage = new MemoryStorage(2);
      
      try {
        const createMapping = (id: string, value: string): MappingData => ({
          id,
          mappings: new Map([['proxy', value]]),
          createdAt: new Date(),
          strategy: AnonymizationStrategy.HASH_SALT
        });

        await limitedStorage.store('id1', createMapping('id1', 'original1'));
        await limitedStorage.store('id2', createMapping('id2', 'original2'));
        
        // Update existing mapping (should not trigger eviction)
        await limitedStorage.store('id1', createMapping('id1', 'updated1'));

        expect(await limitedStorage.retrieve('id1')).not.toBeNull();
        expect(await limitedStorage.retrieve('id2')).not.toBeNull();
        
        const updated = await limitedStorage.retrieve('id1');
        expect(updated!.mappings.get('proxy')).toBe('updated1');
        
      } finally {
        limitedStorage.dispose();
      }
    });
  });

  describe('TTL (Time To Live)', () => {
    test('should expire mappings after TTL', async () => {
      const shortTtlStorage = new MemoryStorage(1000, 100); // 100ms TTL
      
      try {
        const mappingData: MappingData = {
          id: 'test',
          mappings: new Map([['proxy', 'original']]),
          createdAt: new Date(),
          strategy: AnonymizationStrategy.HASH_SALT
        };

        await shortTtlStorage.store('test-id', mappingData);
        
        // Should be available immediately
        expect(await shortTtlStorage.retrieve('test-id')).not.toBeNull();

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 150));

        // Should be expired now
        expect(await shortTtlStorage.retrieve('test-id')).toBeNull();
        
      } finally {
        shortTtlStorage.dispose();
      }
    });

    test('should not expire mappings when TTL is disabled', async () => {
      const noTtlStorage = new MemoryStorage(1000, 0); // TTL disabled
      
      try {
        const mappingData: MappingData = {
          id: 'test',
          mappings: new Map([['proxy', 'original']]),
          createdAt: new Date(),
          strategy: AnonymizationStrategy.HASH_SALT
        };

        await noTtlStorage.store('test-id', mappingData);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 50));

        // Should still be available
        expect(await noTtlStorage.retrieve('test-id')).not.toBeNull();
        
      } finally {
        noTtlStorage.dispose();
      }
    });

    test('should update TTL correctly', async () => {
      const storage = new MemoryStorage(1000, 1000); // 1 second TTL
      
      try {
        const mappingData: MappingData = {
          id: 'test',
          mappings: new Map([['proxy', 'original']]),
          createdAt: new Date(),
          strategy: AnonymizationStrategy.HASH_SALT
        };

        await storage.store('test-id', mappingData);

        // Change TTL to very short
        storage.setTTL(50);

        // Wait for new TTL to take effect
        await new Promise(resolve => setTimeout(resolve, 100));

        // Should be expired under new TTL
        expect(await storage.retrieve('test-id')).toBeNull();
        
      } finally {
        storage.dispose();
      }
    });
  });

  describe('Health Check', () => {
    test('should report healthy status', async () => {
      const healthy = await storage.healthCheck();
      expect(healthy).toBe(true);
    });

    test('should remain healthy after operations', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      await storage.store('test-id', mappingData);
      await storage.retrieve('test-id');
      await storage.delete('test-id');

      const healthy = await storage.healthCheck();
      expect(healthy).toBe(true);
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      const stats1 = storage.getStats();
      expect(stats1.totalMappings).toBe(0);

      await storage.store('id1', mappingData);
      await storage.store('id2', mappingData);

      const stats2 = storage.getStats();
      expect(stats2.totalMappings).toBe(2);
      expect(stats2.memoryUsage).toBeGreaterThan(0);
      expect(stats2.oldestMapping).toBeDefined();
      expect(stats2.newestMapping).toBeDefined();
    });

    test('should track oldest and newest mappings', async () => {
      const createMapping = (id: string): MappingData => ({
        id,
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      });

      await storage.store('old', createMapping('old'));
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await storage.store('new', createMapping('new'));

      const stats = storage.getStats();
      expect(stats.oldestMapping).toBeDefined();
      expect(stats.newestMapping).toBeDefined();
      expect(stats.newestMapping!.getTime()).toBeGreaterThan(stats.oldestMapping!.getTime());
    });
  });

  describe('Utility Methods', () => {
    test('should check if mapping exists', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      expect(await storage.exists('test-id')).toBe(false);

      await storage.store('test-id', mappingData);
      expect(await storage.exists('test-id')).toBe(true);

      await storage.delete('test-id');
      expect(await storage.exists('test-id')).toBe(false);
    });

    test('should list all mapping IDs', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      expect(storage.getAllMappingIds()).toEqual([]);

      await storage.store('id1', mappingData);
      await storage.store('id2', mappingData);

      const ids = storage.getAllMappingIds();
      expect(ids).toContain('id1');
      expect(ids).toContain('id2');
      expect(ids).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    test('should validate input parameters', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      // Invalid map ID
      await expect(storage.store('', mappingData)).rejects.toThrow(StorageError);
      await expect(storage.store(null as any, mappingData)).rejects.toThrow(StorageError);
      await expect(storage.retrieve('')).rejects.toThrow(StorageError);
      await expect(storage.delete('')).rejects.toThrow(StorageError);

      // Invalid mapping data
      await expect(storage.store('valid-id', null as any)).rejects.toThrow(StorageError);
      await expect(storage.store('valid-id', undefined as any)).rejects.toThrow(StorageError);
    });

    test('should handle concurrent operations', async () => {
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      // Perform multiple concurrent operations
      const promises = [
        storage.store('id1', mappingData),
        storage.store('id2', mappingData),
        storage.store('id3', mappingData),
        storage.retrieve('id1'),
        storage.retrieve('id2'),
        storage.exists('id3')
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe('Memory Management', () => {
    test('should dispose resources correctly', () => {
      const storage = new MemoryStorage();
      
      // Should not throw
      expect(() => storage.dispose()).not.toThrow();
      
      // Should be safe to call multiple times
      expect(() => storage.dispose()).not.toThrow();
    });

    test('should handle cleanup errors gracefully', async () => {
      const storage = new MemoryStorage(1000, 100); // Short TTL for cleanup
      
      // Store some data
      const mappingData: MappingData = {
        id: 'test',
        mappings: new Map([['proxy', 'original']]),
        createdAt: new Date(),
        strategy: AnonymizationStrategy.HASH_SALT
      };

      await storage.store('test-id', mappingData);
      
      // Cleanup should run automatically without throwing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      storage.dispose();
    });
  });
});
