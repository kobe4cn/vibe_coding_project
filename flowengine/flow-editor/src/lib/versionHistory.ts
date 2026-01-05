/**
 * Version History Service
 * Wrapper around StorageProvider for version management
 * Provides backwards-compatible API
 */

import type { FlowModel } from '@/types/flow'
import type {
  StorageProvider,
  FlowVersion,
  FlowVersionSummary,
} from '@/lib/storage'

// Re-export types for backwards compatibility
export type { FlowVersion, FlowVersionSummary }

/**
 * Version History Manager
 * Wraps StorageProvider to provide a convenient API for version management
 */
export class VersionHistoryManager {
  private flowId: string
  private storage: StorageProvider
  private autoSaveInterval: number | null = null
  private lastAutoSave: FlowModel | null = null

  constructor(flowId: string, storage: StorageProvider) {
    this.flowId = flowId
    this.storage = storage
  }

  /**
   * Get all versions for the current flow
   */
  async getVersions(): Promise<FlowVersionSummary[]> {
    return this.storage.listVersions(this.flowId)
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId: string): Promise<FlowVersion | null> {
    return this.storage.getVersion(this.flowId, versionId)
  }

  /**
   * Get the latest version
   */
  async getLatestVersion(): Promise<FlowVersion | null> {
    return this.storage.getLatestVersion(this.flowId)
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
    return this.storage.saveVersion(this.flowId, {
      name: options.name,
      description: options.description,
      flow,
      tags: options.tags,
      isAutoSave: options.isAutoSave,
    })
  }

  /**
   * Delete a version
   */
  async deleteVersion(versionId: string): Promise<void> {
    return this.storage.deleteVersion(this.flowId, versionId)
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
   * Export all versions as JSON
   */
  async exportVersions(): Promise<string> {
    const summaries = await this.getVersions()
    const fullVersions: FlowVersion[] = []

    for (const summary of summaries) {
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
      await this.saveVersion(version.flow, {
        name: version.name,
        description: version.description,
        tags: version.tags,
        isAutoSave: version.isAutoSave,
      })
      imported++
    }

    return imported
  }

  /**
   * Clear all versions for this flow
   */
  async clearAllVersions(): Promise<void> {
    const versions = await this.getVersions()
    for (const version of versions) {
      await this.deleteVersion(version.id)
    }
  }
}

/**
 * Create a version history manager for a flow
 * @param flowId - The flow ID
 * @param storage - The storage provider instance
 */
export function createVersionHistoryManager(
  flowId: string,
  storage: StorageProvider
): VersionHistoryManager {
  return new VersionHistoryManager(flowId, storage)
}
