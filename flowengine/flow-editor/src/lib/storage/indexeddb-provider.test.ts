/**
 * IndexedDB Provider Tests
 * Unit tests for the storage abstraction layer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IndexedDBProvider } from './indexeddb-provider'
import type { FlowModel } from '@/types/flow'

// Mock idb-keyval with in-memory storage
const mockStorage = {
  flows: new Map<string, unknown>(),
  versions: new Map<string, unknown>(),
}

vi.mock('idb-keyval', () => ({
  get: vi.fn((key: string, store?: unknown) => {
    const storeMap =
      store === 'flows-store' ? mockStorage.flows : mockStorage.versions
    return Promise.resolve(storeMap.get(key as string))
  }),
  set: vi.fn((key: string, value: unknown, store?: unknown) => {
    const storeMap =
      store === 'flows-store' ? mockStorage.flows : mockStorage.versions
    storeMap.set(key as string, value)
    return Promise.resolve()
  }),
  del: vi.fn((key: string, store?: unknown) => {
    const storeMap =
      store === 'flows-store' ? mockStorage.flows : mockStorage.versions
    storeMap.delete(key as string)
    return Promise.resolve()
  }),
  keys: vi.fn((store?: unknown) => {
    const storeMap =
      store === 'flows-store' ? mockStorage.flows : mockStorage.versions
    return Promise.resolve(Array.from(storeMap.keys()))
  }),
  createStore: vi.fn((dbName: string) => {
    if (dbName.includes('flows')) return 'flows-store'
    return 'versions-store'
  }),
}))

// Helper to create a test flow model
function createTestFlowModel(name: string = 'Test Flow'): FlowModel {
  return {
    meta: { name, description: 'Test description' },
    inputs: [],
    outputs: [],
    nodes: [
      {
        id: 'node-1',
        type: 'mapping',
        position: { x: 100, y: 100 },
        data: { label: 'Test Node' },
      },
    ],
    edges: [],
  }
}

describe('IndexedDBProvider', () => {
  let provider: IndexedDBProvider

  beforeEach(() => {
    // Clear mock storage
    mockStorage.flows.clear()
    mockStorage.versions.clear()
    vi.clearAllMocks()

    provider = new IndexedDBProvider()
  })

  describe('Flow Operations', () => {
    describe('createFlow', () => {
      it('should create a new flow with generated ID', async () => {
        const flow = await provider.createFlow({
          name: 'Test Flow',
          description: 'Test description',
        })

        expect(flow).toBeDefined()
        expect(flow.id).toBeDefined()
        expect(flow.name).toBe('Test Flow')
        expect(flow.description).toBe('Test description')
        expect(flow.latestVersion).toBe(0)
        expect(flow.versionCount).toBe(0)
        expect(flow.createdAt).toBeGreaterThan(0)
        expect(flow.updatedAt).toBeGreaterThan(0)
      })

      it('should create a flow with tags', async () => {
        const flow = await provider.createFlow({
          name: 'Tagged Flow',
          tags: ['test', 'demo'],
        })

        expect(flow.tags).toEqual(['test', 'demo'])
      })
    })

    describe('getFlow', () => {
      it('should return null for non-existent flow', async () => {
        const flow = await provider.getFlow('non-existent')
        expect(flow).toBeNull()
      })

      it('should return the flow by ID', async () => {
        const created = await provider.createFlow({ name: 'Test' })
        const retrieved = await provider.getFlow(created.id)

        expect(retrieved).toBeDefined()
        expect(retrieved!.id).toBe(created.id)
        expect(retrieved!.name).toBe('Test')
      })
    })

    describe('updateFlow', () => {
      it('should update flow properties', async () => {
        const created = await provider.createFlow({ name: 'Original' })
        const updated = await provider.updateFlow(created.id, {
          name: 'Updated',
          description: 'New description',
        })

        expect(updated.name).toBe('Updated')
        expect(updated.description).toBe('New description')
        expect(updated.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
      })

      it('should throw error for non-existent flow', async () => {
        await expect(
          provider.updateFlow('non-existent', { name: 'Test' })
        ).rejects.toThrow('Flow not found')
      })
    })

    describe('deleteFlow', () => {
      it('should delete a flow', async () => {
        const created = await provider.createFlow({ name: 'To Delete' })
        await provider.deleteFlow(created.id)

        const retrieved = await provider.getFlow(created.id)
        expect(retrieved).toBeNull()
      })

      it('should delete flow versions when deleting flow', async () => {
        const created = await provider.createFlow({ name: 'With Versions' })
        await provider.saveVersion(created.id, {
          flow: createTestFlowModel(),
          name: 'v1',
        })

        await provider.deleteFlow(created.id)

        const versions = await provider.listVersions(created.id)
        expect(versions).toHaveLength(0)
      })
    })

    describe('listFlows', () => {
      beforeEach(async () => {
        // Create test flows
        await provider.createFlow({ name: 'Alpha Flow', description: 'First' })
        await provider.createFlow({ name: 'Beta Flow', description: 'Second' })
        await provider.createFlow({
          name: 'Gamma Flow',
          tags: ['important'],
        })
      })

      it('should list all flows', async () => {
        const flows = await provider.listFlows()
        expect(flows).toHaveLength(3)
      })

      it('should filter by search term in name', async () => {
        const flows = await provider.listFlows({ search: 'Alpha' })
        expect(flows).toHaveLength(1)
        expect(flows[0].name).toBe('Alpha Flow')
      })

      it('should filter by search term in description', async () => {
        const flows = await provider.listFlows({ search: 'First' })
        expect(flows).toHaveLength(1)
        expect(flows[0].name).toBe('Alpha Flow')
      })

      it('should filter by tags', async () => {
        const flows = await provider.listFlows({ tags: ['important'] })
        expect(flows).toHaveLength(1)
        expect(flows[0].name).toBe('Gamma Flow')
      })

      it('should sort by name ascending', async () => {
        const flows = await provider.listFlows({
          sortBy: 'name',
          sortOrder: 'asc',
        })
        expect(flows[0].name).toBe('Alpha Flow')
        expect(flows[1].name).toBe('Beta Flow')
        expect(flows[2].name).toBe('Gamma Flow')
      })

      it('should sort by name descending', async () => {
        const flows = await provider.listFlows({
          sortBy: 'name',
          sortOrder: 'desc',
        })
        expect(flows[0].name).toBe('Gamma Flow')
        expect(flows[2].name).toBe('Alpha Flow')
      })

      it('should apply pagination', async () => {
        const flows = await provider.listFlows({
          sortBy: 'name',
          sortOrder: 'asc',
          offset: 1,
          limit: 1,
        })
        expect(flows).toHaveLength(1)
        expect(flows[0].name).toBe('Beta Flow')
      })
    })
  })

  describe('Version Operations', () => {
    let testFlowId: string

    beforeEach(async () => {
      const flow = await provider.createFlow({ name: 'Version Test Flow' })
      testFlowId = flow.id
    })

    describe('saveVersion', () => {
      it('should save a new version', async () => {
        const version = await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
          name: 'Initial Version',
          description: 'First version',
        })

        expect(version).toBeDefined()
        expect(version.id).toBeDefined()
        expect(version.flowId).toBe(testFlowId)
        expect(version.version).toBe(1)
        expect(version.name).toBe('Initial Version')
        expect(version.description).toBe('First version')
      })

      it('should increment version number', async () => {
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v1'),
        })
        const v2 = await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v2'),
        })

        expect(v2.version).toBe(2)
      })

      it('should update flow version metadata', async () => {
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
        })

        const flow = await provider.getFlow(testFlowId)
        expect(flow!.latestVersion).toBe(1)
        expect(flow!.versionCount).toBe(1)
      })

      it('should throw error for non-existent flow', async () => {
        await expect(
          provider.saveVersion('non-existent', {
            flow: createTestFlowModel(),
          })
        ).rejects.toThrow('Flow not found')
      })

      it('should deep clone the flow model', async () => {
        const flowModel = createTestFlowModel()
        const version = await provider.saveVersion(testFlowId, {
          flow: flowModel,
        })

        // Modify original
        flowModel.nodes[0].data.label = 'Modified'

        // Saved version should be unchanged
        const retrieved = await provider.getVersion(testFlowId, version.id)
        expect(retrieved!.flow.nodes[0].data.label).toBe('Test Node')
      })
    })

    describe('getVersion', () => {
      it('should return null for non-existent version', async () => {
        const version = await provider.getVersion(testFlowId, 'non-existent')
        expect(version).toBeNull()
      })

      it('should return the version', async () => {
        const saved = await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
          name: 'Test Version',
        })

        const retrieved = await provider.getVersion(testFlowId, saved.id)
        expect(retrieved).toBeDefined()
        expect(retrieved!.name).toBe('Test Version')
        expect(retrieved!.flow).toBeDefined()
      })
    })

    describe('getLatestVersion', () => {
      it('should return null when no versions exist', async () => {
        const latest = await provider.getLatestVersion(testFlowId)
        expect(latest).toBeNull()
      })

      it('should return the latest version', async () => {
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v1'),
          name: 'Version 1',
        })
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v2'),
          name: 'Version 2',
        })

        const latest = await provider.getLatestVersion(testFlowId)
        expect(latest).toBeDefined()
        expect(latest!.name).toBe('Version 2')
        expect(latest!.version).toBe(2)
      })
    })

    describe('listVersions', () => {
      it('should return empty array when no versions', async () => {
        const versions = await provider.listVersions(testFlowId)
        expect(versions).toHaveLength(0)
      })

      it('should list all versions sorted by version descending', async () => {
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v1'),
          name: 'Version 1',
        })
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('v2'),
          name: 'Version 2',
        })

        const versions = await provider.listVersions(testFlowId)
        expect(versions).toHaveLength(2)
        expect(versions[0].version).toBe(2)
        expect(versions[1].version).toBe(1)
      })

      it('should not include flow data in summary', async () => {
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
        })

        const versions = await provider.listVersions(testFlowId)
        // FlowVersionSummary should not have 'flow' property
        expect((versions[0] as unknown as Record<string, unknown>).flow).toBeUndefined()
      })
    })

    describe('deleteVersion', () => {
      it('should delete a version', async () => {
        const v1 = await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
        })

        await provider.deleteVersion(testFlowId, v1.id)

        const retrieved = await provider.getVersion(testFlowId, v1.id)
        expect(retrieved).toBeNull()
      })

      it('should update flow version count after deletion', async () => {
        const v1 = await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
        })
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel(),
        })

        await provider.deleteVersion(testFlowId, v1.id)

        const flow = await provider.getFlow(testFlowId)
        expect(flow!.versionCount).toBe(1)
      })
    })

    describe('Auto-save cleanup', () => {
      it('should keep only 5 most recent auto-saves', async () => {
        // Create 7 auto-saves
        for (let i = 0; i < 7; i++) {
          await provider.saveVersion(testFlowId, {
            flow: createTestFlowModel(`auto-${i}`),
            name: `Auto-save ${i}`,
            isAutoSave: true,
          })
        }

        const versions = await provider.listVersions(testFlowId)
        const autoSaves = versions.filter((v) => v.isAutoSave)
        expect(autoSaves.length).toBeLessThanOrEqual(5)
      })

      it('should not delete manual saves', async () => {
        // Create manual saves
        await provider.saveVersion(testFlowId, {
          flow: createTestFlowModel('manual'),
          name: 'Manual Save',
          isAutoSave: false,
        })

        // Create 6 auto-saves
        for (let i = 0; i < 6; i++) {
          await provider.saveVersion(testFlowId, {
            flow: createTestFlowModel(`auto-${i}`),
            name: `Auto-save ${i}`,
            isAutoSave: true,
          })
        }

        const versions = await provider.listVersions(testFlowId)
        const manualSaves = versions.filter((v) => !v.isAutoSave)
        expect(manualSaves).toHaveLength(1)
      })
    })
  })
})
