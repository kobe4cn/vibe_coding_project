/**
 * IndexedDB Storage Provider
 * Implements StorageProvider interface using browser IndexedDB
 */

import { get, set, del, keys, createStore } from 'idb-keyval'
import type {
  StorageProvider,
  FlowEntry,
  FlowVersion,
  FlowVersionSummary,
  CreateFlowInput,
  UpdateFlowInput,
  SaveVersionInput,
  ListOptions,
} from './types'

// Create custom stores for flows and versions
const flowStore = createStore('fdl-flows-db', 'flows')
const versionStore = createStore('fdl-versions-db', 'versions')

/**
 * IndexedDB implementation of StorageProvider
 */
export class IndexedDBProvider implements StorageProvider {
  /**
   * List all flows with optional filtering and sorting
   */
  async listFlows(options?: ListOptions): Promise<FlowEntry[]> {
    const allKeys = await keys(flowStore)
    const flows: FlowEntry[] = []

    for (const key of allKeys) {
      const flow = await get<FlowEntry>(key, flowStore)
      if (flow) {
        flows.push(flow)
      }
    }

    let result = flows

    // Apply search filter
    if (options?.search) {
      const search = options.search.toLowerCase()
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.description?.toLowerCase().includes(search)
      )
    }

    // Apply tag filter
    if (options?.tags && options.tags.length > 0) {
      result = result.filter((f) =>
        options.tags!.some((tag) => f.tags?.includes(tag))
      )
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'updatedAt'
    const sortOrder = options?.sortOrder || 'desc'
    result.sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      if (sortBy === 'name') {
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
      } else {
        aVal = a[sortBy] as number
        bVal = b[sortBy] as number
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // Apply pagination
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options.offset || 0
      const limit = options.limit || result.length
      result = result.slice(offset, offset + limit)
    }

    return result
  }

  /**
   * Get a single flow by ID
   */
  async getFlow(id: string): Promise<FlowEntry | null> {
    const flow = await get<FlowEntry>(id, flowStore)
    return flow ?? null
  }

  /**
   * Create a new flow
   */
  async createFlow(input: CreateFlowInput): Promise<FlowEntry> {
    const id = crypto.randomUUID()
    const now = Date.now()

    const entry: FlowEntry = {
      id,
      name: input.name,
      description: input.description,
      tags: input.tags,
      latestVersion: 0,
      versionCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await set(id, entry, flowStore)
    return entry
  }

  /**
   * Update an existing flow
   */
  async updateFlow(id: string, updates: UpdateFlowInput): Promise<FlowEntry> {
    const existing = await this.getFlow(id)
    if (!existing) {
      throw new Error(`Flow not found: ${id}`)
    }

    const updated: FlowEntry = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    }

    await set(id, updated, flowStore)
    return updated
  }

  /**
   * Delete a flow and all its versions
   */
  async deleteFlow(id: string): Promise<void> {
    // Delete all versions first
    const versions = await this.listVersions(id)
    for (const version of versions) {
      await this.deleteVersion(id, version.id)
    }

    // Delete the flow entry
    await del(id, flowStore)
  }

  /**
   * List all versions for a flow
   */
  async listVersions(flowId: string): Promise<FlowVersionSummary[]> {
    const allKeys = await keys(versionStore)
    const flowKeys = allKeys.filter((key) =>
      String(key).startsWith(`${flowId}:`)
    )

    const versions: FlowVersionSummary[] = []
    for (const key of flowKeys) {
      const version = await get<FlowVersion>(key, versionStore)
      if (version) {
        versions.push({
          id: version.id,
          flowId: version.flowId,
          version: version.version,
          name: version.name,
          description: version.description,
          createdAt: version.createdAt,
          tags: version.tags,
          isAutoSave: version.isAutoSave,
        })
      }
    }

    // Sort by version descending
    return versions.sort((a, b) => b.version - a.version)
  }

  /**
   * Get a specific version
   */
  async getVersion(
    flowId: string,
    versionId: string
  ): Promise<FlowVersion | null> {
    const key = `${flowId}:${versionId}`
    const version = await get<FlowVersion>(key, versionStore)
    return version ?? null
  }

  /**
   * Get the latest version for a flow
   */
  async getLatestVersion(flowId: string): Promise<FlowVersion | null> {
    const versions = await this.listVersions(flowId)
    if (versions.length === 0) return null
    return this.getVersion(flowId, versions[0].id)
  }

  /**
   * Save a new version
   */
  async saveVersion(
    flowId: string,
    input: SaveVersionInput
  ): Promise<FlowVersion> {
    const flow = await this.getFlow(flowId)
    if (!flow) {
      throw new Error(`Flow not found: ${flowId}`)
    }

    const versions = await this.listVersions(flowId)
    const nextVersionNum = versions.length > 0 ? versions[0].version + 1 : 1

    const versionId = `v${nextVersionNum}-${Date.now()}`
    const version: FlowVersion = {
      id: versionId,
      flowId,
      version: nextVersionNum,
      name: input.name || `版本 ${nextVersionNum}`,
      description: input.description,
      flow: JSON.parse(JSON.stringify(input.flow)), // Deep clone
      createdAt: Date.now(),
      tags: input.tags,
      isAutoSave: input.isAutoSave,
    }

    const key = `${flowId}:${versionId}`
    await set(key, version, versionStore)

    // Update flow metadata
    await this.updateFlow(flowId, {
      thumbnail: flow.thumbnail, // Keep existing thumbnail
    })

    // Update version count
    const updatedFlow = await this.getFlow(flowId)
    if (updatedFlow) {
      await set(
        flowId,
        {
          ...updatedFlow,
          latestVersion: nextVersionNum,
          versionCount: versions.length + 1,
          updatedAt: Date.now(),
        },
        flowStore
      )
    }

    // Cleanup old auto-saves (keep only last 5)
    await this.cleanupAutoSaves(flowId)

    return version
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(flowId: string, versionId: string): Promise<void> {
    const key = `${flowId}:${versionId}`
    await del(key, versionStore)

    // Update version count
    const versions = await this.listVersions(flowId)
    const flow = await this.getFlow(flowId)
    if (flow) {
      await set(
        flowId,
        {
          ...flow,
          versionCount: versions.length,
          latestVersion: versions.length > 0 ? versions[0].version : 0,
        },
        flowStore
      )
    }
  }

  /**
   * Clean up old auto-saves, keeping only the most recent ones
   */
  private async cleanupAutoSaves(
    flowId: string,
    keepCount: number = 5
  ): Promise<void> {
    const versions = await this.listVersions(flowId)
    const autoSaves = versions.filter((v) => v.isAutoSave)

    if (autoSaves.length <= keepCount) return

    const toDelete = autoSaves.slice(keepCount)
    for (const version of toDelete) {
      await this.deleteVersion(flowId, version.id)
    }
  }
}

/**
 * Create a new IndexedDB provider instance
 */
export function createIndexedDBProvider(): IndexedDBProvider {
  return new IndexedDBProvider()
}
