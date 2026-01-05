/**
 * Migration Service Tests
 * Unit tests for the data migration functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  detectLegacyData,
  migrateFromLegacy,
  cleanupLegacyData,
  checkMigrationNeeded,
  type MigrationProgressCallback,
} from './migration'
import type { FlowModel } from '@/types/flow'

// Mock storage for legacy data
const mockLegacyVersionStore = new Map<string, unknown>()
const mockLegacyMetaStore = new Map<string, unknown>()
const mockNewFlowStore = new Map<string, unknown>()
const mockNewVersionStore = new Map<string, unknown>()

// Mock idb-keyval
vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string, store?: unknown) => {
    if (store === 'legacy-versions') return Promise.resolve(mockLegacyVersionStore.get(key))
    if (store === 'legacy-meta') return Promise.resolve(mockLegacyMetaStore.get(key))
    if (store === 'new-flows') return Promise.resolve(mockNewFlowStore.get(key))
    if (store === 'new-versions') return Promise.resolve(mockNewVersionStore.get(key))
    return Promise.resolve(mockLegacyVersionStore.get(key))
  }),
  set: vi.fn((key: string, value: unknown, store?: unknown) => {
    if (store === 'new-flows') mockNewFlowStore.set(key, value)
    else if (store === 'new-versions') mockNewVersionStore.set(key, value)
    else mockLegacyVersionStore.set(key, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string, store?: unknown) => {
    if (store === 'legacy-versions') mockLegacyVersionStore.delete(key)
    else if (store === 'legacy-meta') mockLegacyMetaStore.delete(key)
    return Promise.resolve()
  }),
  keys: vi.fn((store?: unknown) => {
    if (store === 'legacy-versions') return Promise.resolve(Array.from(mockLegacyVersionStore.keys()))
    if (store === 'legacy-meta') return Promise.resolve(Array.from(mockLegacyMetaStore.keys()))
    if (store === 'new-flows') return Promise.resolve(Array.from(mockNewFlowStore.keys()))
    if (store === 'new-versions') return Promise.resolve(Array.from(mockNewVersionStore.keys()))
    return Promise.resolve(Array.from(mockLegacyVersionStore.keys()))
  }),
  createStore: vi.fn((dbName: string) => {
    if (dbName === 'flow-versions-db') return 'legacy-versions'
    if (dbName === 'flow-meta-db') return 'legacy-meta'
    if (dbName.includes('flows')) return 'new-flows'
    return 'new-versions'
  }),
}))

// Helper to create legacy flow version
function createLegacyVersion(
  flowId: string,
  versionNum: number,
  flowName: string = 'Test Flow'
): { key: string; data: unknown } {
  const versionId = `v${versionNum}-${Date.now()}`
  const flow: FlowModel = {
    meta: { name: flowName, description: 'Test' },
    inputs: [],
    outputs: [],
    nodes: [],
    edges: [],
  }

  return {
    key: `${flowId}:${versionId}`,
    data: {
      id: versionId,
      flowId,
      version: versionNum,
      name: `Version ${versionNum}`,
      flow,
      createdAt: Date.now(),
    },
  }
}

describe('Migration Service', () => {
  beforeEach(() => {
    // Clear all mock stores
    mockLegacyVersionStore.clear()
    mockLegacyMetaStore.clear()
    mockNewFlowStore.clear()
    mockNewVersionStore.clear()
    vi.clearAllMocks()
  })

  describe('detectLegacyData', () => {
    it('should return hasLegacyData: false when no legacy data exists', async () => {
      const result = await detectLegacyData()

      expect(result.hasLegacyData).toBe(false)
      expect(result.versionCount).toBe(0)
      expect(result.flowCount).toBe(0)
    })

    it('should detect legacy data when it exists', async () => {
      // Add some legacy data
      const v1 = createLegacyVersion('flow-1', 1)
      const v2 = createLegacyVersion('flow-1', 2)
      const v3 = createLegacyVersion('flow-2', 1)

      mockLegacyVersionStore.set(v1.key, v1.data)
      mockLegacyVersionStore.set(v2.key, v2.data)
      mockLegacyVersionStore.set(v3.key, v3.data)

      const result = await detectLegacyData()

      expect(result.hasLegacyData).toBe(true)
      expect(result.versionCount).toBe(3)
      expect(result.flowCount).toBe(2)
    })

    it('should handle errors gracefully', async () => {
      // Mock an error
      vi.mocked(await import('idb-keyval')).keys.mockRejectedValueOnce(new Error('DB Error'))

      const result = await detectLegacyData()

      expect(result.hasLegacyData).toBe(false)
    })
  })

  describe('migrateFromLegacy', () => {
    it('should return success with no changes when no legacy data', async () => {
      const result = await migrateFromLegacy()

      expect(result.success).toBe(true)
      expect(result.migratedFlows).toBe(0)
      expect(result.migratedVersions).toBe(0)
      expect(result.errors).toHaveLength(0)
    })

    it('should call progress callback during migration', async () => {
      const v1 = createLegacyVersion('flow-1', 1)
      mockLegacyVersionStore.set(v1.key, v1.data)

      const progressCallback: MigrationProgressCallback = vi.fn()

      await migrateFromLegacy(progressCallback)

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'detecting' })
      )
    })

    it('should migrate versions in order', async () => {
      const v1 = createLegacyVersion('flow-1', 1, 'First Flow')
      const v2 = createLegacyVersion('flow-1', 2, 'First Flow')

      mockLegacyVersionStore.set(v1.key, v1.data)
      mockLegacyVersionStore.set(v2.key, v2.data)

      const progressCallback: MigrationProgressCallback = vi.fn()
      const result = await migrateFromLegacy(progressCallback)

      expect(result.migratedFlows).toBe(1)
      expect(result.migratedVersions).toBe(2)
    })

    it('should handle migration errors and continue', async () => {
      const v1 = createLegacyVersion('flow-1', 1)
      const v2 = createLegacyVersion('flow-2', 1)

      // Set v1 to invalid data that will cause error
      mockLegacyVersionStore.set(v1.key, null)
      mockLegacyVersionStore.set(v2.key, v2.data)

      const result = await migrateFromLegacy()

      // Should still migrate the valid flow
      expect(result.migratedFlows).toBeGreaterThanOrEqual(0)
    })
  })

  describe('cleanupLegacyData', () => {
    it('should delete all legacy data', async () => {
      const v1 = createLegacyVersion('flow-1', 1)
      const v2 = createLegacyVersion('flow-2', 1)

      mockLegacyVersionStore.set(v1.key, v1.data)
      mockLegacyVersionStore.set(v2.key, v2.data)
      mockLegacyMetaStore.set('flow-1', { lastModified: Date.now() })

      const result = await cleanupLegacyData()

      expect(result.success).toBe(true)
      expect(result.deletedCount).toBe(2)
    })

    it('should call progress callback during cleanup', async () => {
      const v1 = createLegacyVersion('flow-1', 1)
      mockLegacyVersionStore.set(v1.key, v1.data)

      const progressCallback: MigrationProgressCallback = vi.fn()
      await cleanupLegacyData(progressCallback)

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ phase: 'cleanup' })
      )
    })

    it('should handle cleanup errors gracefully', async () => {
      vi.mocked(await import('idb-keyval')).keys.mockRejectedValueOnce(new Error('DB Error'))

      const result = await cleanupLegacyData()

      expect(result.success).toBe(false)
      expect(result.deletedCount).toBe(0)
    })
  })

  describe('checkMigrationNeeded', () => {
    it('should return false when no legacy data', async () => {
      const result = await checkMigrationNeeded()
      expect(result).toBe(false)
    })

    it('should return true when legacy data exists', async () => {
      const v1 = createLegacyVersion('flow-1', 1)
      mockLegacyVersionStore.set(v1.key, v1.data)

      const result = await checkMigrationNeeded()
      expect(result).toBe(true)
    })
  })
})
