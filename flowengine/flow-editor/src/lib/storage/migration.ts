/**
 * Data Migration Service
 * Migrates data from legacy IndexedDB structure to new storage format
 */

import { get, keys, del, createStore } from 'idb-keyval'
import type { FlowModel } from '@/types/flow'
import { IndexedDBProvider } from './indexeddb-provider'

/**
 * Legacy flow version format
 */
interface LegacyFlowVersion {
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

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean
  migratedFlows: number
  migratedVersions: number
  errors: string[]
}

/**
 * Migration progress callback
 */
export type MigrationProgressCallback = (progress: {
  phase: 'detecting' | 'migrating' | 'cleanup' | 'complete'
  current: number
  total: number
  message: string
}) => void

// Legacy stores
const legacyVersionStore = createStore('flow-versions-db', 'versions')
const legacyMetaStore = createStore('flow-meta-db', 'meta')

/**
 * Check if there is legacy data that needs migration
 */
export async function detectLegacyData(): Promise<{
  hasLegacyData: boolean
  versionCount: number
  flowCount: number
}> {
  try {
    const allKeys = await keys(legacyVersionStore)

    if (allKeys.length === 0) {
      return { hasLegacyData: false, versionCount: 0, flowCount: 0 }
    }

    // Count unique flow IDs
    const flowIds = new Set<string>()
    for (const key of allKeys) {
      const [flowId] = String(key).split(':')
      flowIds.add(flowId)
    }

    return {
      hasLegacyData: true,
      versionCount: allKeys.length,
      flowCount: flowIds.size,
    }
  } catch {
    return { hasLegacyData: false, versionCount: 0, flowCount: 0 }
  }
}

/**
 * Migrate from legacy format to new storage format
 */
export async function migrateFromLegacy(
  onProgress?: MigrationProgressCallback
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedFlows: 0,
    migratedVersions: 0,
    errors: [],
  }

  try {
    // Phase 1: Detect
    onProgress?.({
      phase: 'detecting',
      current: 0,
      total: 0,
      message: '检测旧版数据...',
    })

    const allKeys = await keys(legacyVersionStore)
    if (allKeys.length === 0) {
      result.success = true
      onProgress?.({
        phase: 'complete',
        current: 0,
        total: 0,
        message: '没有需要迁移的数据',
      })
      return result
    }

    // Group versions by flowId
    const flowVersions = new Map<string, LegacyFlowVersion[]>()

    for (const key of allKeys) {
      try {
        const version = await get<LegacyFlowVersion>(key, legacyVersionStore)
        if (version) {
          const [flowId] = String(key).split(':')
          const versions = flowVersions.get(flowId) || []
          versions.push(version)
          flowVersions.set(flowId, versions)
        }
      } catch (err) {
        result.errors.push(`读取版本失败: ${key}`)
      }
    }

    const totalFlows = flowVersions.size
    const totalVersions = allKeys.length

    onProgress?.({
      phase: 'detecting',
      current: totalFlows,
      total: totalFlows,
      message: `发现 ${totalFlows} 个流程，${totalVersions} 个版本`,
    })

    // Phase 2: Migrate
    const provider = new IndexedDBProvider()
    let flowIndex = 0

    for (const [legacyFlowId, versions] of flowVersions) {
      flowIndex++
      onProgress?.({
        phase: 'migrating',
        current: flowIndex,
        total: totalFlows,
        message: `迁移流程 ${flowIndex}/${totalFlows}...`,
      })

      try {
        // Sort versions by version number
        versions.sort((a, b) => a.version - b.version)

        // Get the latest version to extract flow metadata
        const latestVersion = versions[versions.length - 1]

        // Create new flow entry
        const flow = await provider.createFlow({
          name: latestVersion.flow.meta?.name || legacyFlowId,
          description: latestVersion.flow.meta?.description,
        })

        result.migratedFlows++

        // Migrate all versions
        for (const version of versions) {
          try {
            await provider.saveVersion(flow.id, {
              name: version.name,
              description: version.description,
              flow: version.flow,
              tags: version.tags,
              isAutoSave: version.isAutoSave,
            })
            result.migratedVersions++
          } catch (err) {
            result.errors.push(
              `迁移版本失败: ${legacyFlowId}:${version.id} - ${err}`
            )
          }
        }
      } catch (err) {
        result.errors.push(`迁移流程失败: ${legacyFlowId} - ${err}`)
      }
    }

    result.success = result.errors.length === 0

    onProgress?.({
      phase: 'complete',
      current: totalFlows,
      total: totalFlows,
      message: `迁移完成: ${result.migratedFlows} 个流程, ${result.migratedVersions} 个版本`,
    })

    return result
  } catch (err) {
    result.errors.push(`迁移失败: ${err}`)
    return result
  }
}

/**
 * Clean up legacy data after successful migration
 */
export async function cleanupLegacyData(
  onProgress?: MigrationProgressCallback
): Promise<{ success: boolean; deletedCount: number }> {
  try {
    onProgress?.({
      phase: 'cleanup',
      current: 0,
      total: 0,
      message: '清理旧版数据...',
    })

    const allKeys = await keys(legacyVersionStore)
    let deletedCount = 0

    for (const key of allKeys) {
      await del(key, legacyVersionStore)
      deletedCount++
    }

    // Clean up meta store too
    const metaKeys = await keys(legacyMetaStore)
    for (const key of metaKeys) {
      await del(key, legacyMetaStore)
    }

    onProgress?.({
      phase: 'cleanup',
      current: deletedCount,
      total: allKeys.length,
      message: `已清理 ${deletedCount} 条旧数据`,
    })

    return { success: true, deletedCount }
  } catch (err) {
    return { success: false, deletedCount: 0 }
  }
}

/**
 * Check if migration is needed (wrapper for UI)
 */
export async function checkMigrationNeeded(): Promise<boolean> {
  const { hasLegacyData } = await detectLegacyData()
  return hasLegacyData
}
