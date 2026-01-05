/**
 * Version History Service
 * Manages flow version history using IndexedDB
 */

import { get, set, del, keys, createStore } from 'idb-keyval'
import type { FlowModel } from '@/types/flow'

export interface FlowVersion {
  id: string
  flowId: string
  version: number
  name: string
  description?: string
  flow: FlowModel
  createdAt: number
  createdBy?: string
  tags?: string[]
  isAutoSave?: boolean
}

export interface FlowVersionSummary {
  id: string
  flowId: string
  version: number
  name: string
  description?: string
  createdAt: number
  tags?: string[]
  isAutoSave?: boolean
}

// Create custom store for flow versions
const flowVersionStore = createStore('flow-versions-db', 'versions')
const flowMetaStore = createStore('flow-meta-db', 'meta')

/**
 * Version History Manager
 */
export class VersionHistoryManager {
  private flowId: string
  private autoSaveInterval: number | null = null
  private lastAutoSave: FlowModel | null = null

  constructor(flowId: string) {
    this.flowId = flowId
  }

  /**
   * Get all versions for the current flow
   */
  async getVersions(): Promise<FlowVersionSummary[]> {
    const allKeys = await keys(flowVersionStore)
    const flowKeys = allKeys.filter((key) => String(key).startsWith(`${this.flowId}:`))

    const versions: FlowVersionSummary[] = []
    for (const key of flowKeys) {
      const version = await get<FlowVersion>(key, flowVersionStore)
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
  async getVersion(versionId: string): Promise<FlowVersion | null> {
    const key = `${this.flowId}:${versionId}`
    const result = await get<FlowVersion>(key, flowVersionStore)
    return result ?? null
  }

  /**
   * Get the latest version
   */
  async getLatestVersion(): Promise<FlowVersion | null> {
    const versions = await this.getVersions()
    if (versions.length === 0) return null

    return this.getVersion(versions[0].id)
  }

  /**
   * Save a new version
   */
  async saveVersion(
    flow: FlowModel,
    options: {
      name?: string
      description?: string
      tags?: string[]
      isAutoSave?: boolean
    } = {}
  ): Promise<FlowVersion> {
    const versions = await this.getVersions()
    const nextVersion = versions.length > 0 ? versions[0].version + 1 : 1

    const versionId = `v${nextVersion}-${Date.now()}`
    const version: FlowVersion = {
      id: versionId,
      flowId: this.flowId,
      version: nextVersion,
      name: options.name || `版本 ${nextVersion}`,
      description: options.description,
      flow: JSON.parse(JSON.stringify(flow)), // Deep clone
      createdAt: Date.now(),
      tags: options.tags,
      isAutoSave: options.isAutoSave,
    }

    const key = `${this.flowId}:${versionId}`
    await set(key, version, flowVersionStore)

    // Update flow metadata
    await this.updateFlowMeta({
      latestVersion: nextVersion,
      lastModified: Date.now(),
    })

    // Clean up old auto-saves (keep only last 5)
    await this.cleanupAutoSaves()

    return version
  }

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<void> {
    const key = `${this.flowId}:${versionId}`
    await del(key, flowVersionStore)
  }

  /**
   * Restore a version as the current flow
   */
  async restoreVersion(versionId: string): Promise<FlowModel | null> {
    const version = await this.getVersion(versionId)
    if (!version) return null

    return version.flow
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    versionId1: string,
    versionId2: string
  ): Promise<{ added: string[]; removed: string[]; modified: string[] } | null> {
    const v1 = await this.getVersion(versionId1)
    const v2 = await this.getVersion(versionId2)

    if (!v1 || !v2) return null

    const nodes1 = new Map(v1.flow.nodes.map((n) => [n.id, n]))
    const nodes2 = new Map(v2.flow.nodes.map((n) => [n.id, n]))

    const added: string[] = []
    const removed: string[] = []
    const modified: string[] = []

    // Find added and modified nodes
    for (const [id, node] of nodes2) {
      if (!nodes1.has(id)) {
        added.push(id)
      } else {
        const oldNode = nodes1.get(id)!
        if (JSON.stringify(oldNode.data) !== JSON.stringify(node.data)) {
          modified.push(id)
        }
      }
    }

    // Find removed nodes
    for (const id of nodes1.keys()) {
      if (!nodes2.has(id)) {
        removed.push(id)
      }
    }

    return { added, removed, modified }
  }

  /**
   * Start auto-save
   */
  startAutoSave(getFlow: () => FlowModel, intervalMs: number = 60000): void {
    this.stopAutoSave()

    this.autoSaveInterval = window.setInterval(async () => {
      const currentFlow = getFlow()

      // Only save if flow has changed
      if (this.lastAutoSave && JSON.stringify(this.lastAutoSave) === JSON.stringify(currentFlow)) {
        return
      }

      this.lastAutoSave = JSON.parse(JSON.stringify(currentFlow))
      await this.saveVersion(currentFlow, {
        name: '自动保存',
        isAutoSave: true,
      })
    }, intervalMs)
  }

  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
  }

  /**
   * Clean up old auto-saves
   */
  private async cleanupAutoSaves(keepCount: number = 5): Promise<void> {
    const versions = await this.getVersions()
    const autoSaves = versions.filter((v) => v.isAutoSave)

    if (autoSaves.length <= keepCount) return

    const toDelete = autoSaves.slice(keepCount)
    for (const version of toDelete) {
      await this.deleteVersion(version.id)
    }
  }

  /**
   * Update flow metadata
   */
  private async updateFlowMeta(meta: Record<string, unknown>): Promise<void> {
    const existing = (await get<Record<string, unknown>>(this.flowId, flowMetaStore)) || {}
    await set(this.flowId, { ...existing, ...meta }, flowMetaStore)
  }

  /**
   * Get flow metadata
   */
  async getFlowMeta(): Promise<Record<string, unknown> | null> {
    const result = await get<Record<string, unknown>>(this.flowId, flowMetaStore)
    return result ?? null
  }

  /**
   * Export all versions as JSON
   */
  async exportVersions(): Promise<string> {
    const versions = await this.getVersions()
    const fullVersions: FlowVersion[] = []

    for (const summary of versions) {
      const version = await this.getVersion(summary.id)
      if (version) {
        fullVersions.push(version)
      }
    }

    return JSON.stringify(fullVersions, null, 2)
  }

  /**
   * Import versions from JSON
   */
  async importVersions(json: string): Promise<number> {
    const versions = JSON.parse(json) as FlowVersion[]
    let imported = 0

    for (const version of versions) {
      const key = `${this.flowId}:${version.id}`
      await set(key, version, flowVersionStore)
      imported++
    }

    return imported
  }

  /**
   * Clear all versions for this flow
   */
  async clearAllVersions(): Promise<void> {
    const allKeys = await keys(flowVersionStore)
    const flowKeys = allKeys.filter((key) => String(key).startsWith(`${this.flowId}:`))

    for (const key of flowKeys) {
      await del(key, flowVersionStore)
    }
  }
}

/**
 * Create a version history manager for a flow
 */
export function createVersionHistoryManager(flowId: string): VersionHistoryManager {
  return new VersionHistoryManager(flowId)
}
