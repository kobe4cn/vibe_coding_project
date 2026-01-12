/**
 * Flow Import Utilities
 * Import flows with their version history
 */

import type { StorageProvider } from '@/lib/storage'
import type { ExportedFlow, ExportedFlowBundle } from './flowExport'

/**
 * Import result for a single flow
 */
export interface FlowImportResult {
  success: boolean
  flowId?: string
  flowName: string
  versionCount: number
  error?: string
  renamed?: boolean
  newName?: string
}

/**
 * Import result for multiple flows
 */
export interface ImportResult {
  success: boolean
  results: FlowImportResult[]
  totalFlows: number
  successfulFlows: number
  failedFlows: number
  totalVersions: number
}

/**
 * Import options
 */
export interface ImportOptions {
  onConflict?: 'rename' | 'skip' | 'overwrite'
  importVersions?: boolean
}

/**
 * Check if data is a single flow export
 */
export function isSingleFlowExport(data: unknown): data is ExportedFlow {
  return (
    typeof data === 'object' &&
    data !== null &&
    'flow' in data &&
    'versions' in data &&
    !('flows' in data)
  )
}

/**
 * Check if data is a flow bundle export
 */
export function isFlowBundleExport(data: unknown): data is ExportedFlowBundle {
  return (
    typeof data === 'object' &&
    data !== null &&
    'flows' in data &&
    Array.isArray((data as ExportedFlowBundle).flows)
  )
}

/**
 * Parse import data from JSON string
 */
export function parseImportData(json: string): ExportedFlow | ExportedFlowBundle | null {
  try {
    const data = JSON.parse(json)
    if (isSingleFlowExport(data) || isFlowBundleExport(data)) {
      return data
    }
    return null
  } catch {
    return null
  }
}

/**
 * Read file as text
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

/**
 * Generate a unique name if there's a conflict
 */
async function generateUniqueName(
  storage: StorageProvider,
  baseName: string
): Promise<string> {
  const allFlows = await storage.listFlows()
  const existingNames = new Set(allFlows.map((f) => f.name.toLowerCase()))

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  let counter = 1
  let newName = `${baseName} (${counter})`
  while (existingNames.has(newName.toLowerCase())) {
    counter++
    newName = `${baseName} (${counter})`
  }

  return newName
}

/**
 * Import a single flow
 */
export async function importSingleFlow(
  storage: StorageProvider,
  exportedFlow: ExportedFlow,
  options: ImportOptions = {}
): Promise<FlowImportResult> {
  const { onConflict = 'rename', importVersions = true } = options

  try {
    // Check for existing flow with same name
    const allFlows = await storage.listFlows()
    const existingFlow = allFlows.find(
      (f) => f.name.toLowerCase() === exportedFlow.flow.name.toLowerCase()
    )

    let flowId: string
    let renamed = false
    let newName = exportedFlow.flow.name

    if (existingFlow) {
      switch (onConflict) {
        case 'skip':
          return {
            success: false,
            flowName: exportedFlow.flow.name,
            versionCount: 0,
            error: 'Flow with same name already exists',
          }

        case 'overwrite':
          // Delete existing flow first
          await storage.deleteFlow(existingFlow.id)
          flowId = (
            await storage.createFlow({
              name: exportedFlow.flow.name,
              description: exportedFlow.flow.description,
              tags: exportedFlow.flow.tags,
            })
          ).id
          break

        case 'rename':
        default:
          newName = await generateUniqueName(storage, exportedFlow.flow.name)
          renamed = true
          flowId = (
            await storage.createFlow({
              name: newName,
              description: exportedFlow.flow.description,
              tags: exportedFlow.flow.tags,
            })
          ).id
          break
      }
    } else {
      flowId = (
        await storage.createFlow({
          name: exportedFlow.flow.name,
          description: exportedFlow.flow.description,
          tags: exportedFlow.flow.tags,
        })
      ).id
    }

    // Import versions
    let versionCount = 0
    if (importVersions && exportedFlow.versions.length > 0) {
      // Sort versions by version number (ascending) to maintain order
      const sortedVersions = [...exportedFlow.versions].sort(
        (a, b) => a.version - b.version
      )

      for (const version of sortedVersions) {
        await storage.saveVersion(flowId, {
          name: version.name,
          description: version.description,
          flow: version.flow,
          tags: version.tags,
          isAutoSave: version.isAutoSave,
        })
        versionCount++
      }
    }

    return {
      success: true,
      flowId,
      flowName: exportedFlow.flow.name,
      versionCount,
      renamed,
      newName: renamed ? newName : undefined,
    }
  } catch (error) {
    return {
      success: false,
      flowName: exportedFlow.flow.name,
      versionCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Import multiple flows from a bundle
 */
export async function importFlowBundle(
  storage: StorageProvider,
  bundle: ExportedFlowBundle,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const results: FlowImportResult[] = []
  let totalVersions = 0

  for (const exportedFlow of bundle.flows) {
    const result = await importSingleFlow(storage, exportedFlow, options)
    results.push(result)
    totalVersions += result.versionCount
  }

  const successfulFlows = results.filter((r) => r.success).length
  const failedFlows = results.filter((r) => !r.success).length

  return {
    success: failedFlows === 0,
    results,
    totalFlows: results.length,
    successfulFlows,
    failedFlows,
    totalVersions,
  }
}

/**
 * Import from JSON string
 */
export async function importFromJson(
  storage: StorageProvider,
  json: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const data = parseImportData(json)

  if (!data) {
    return {
      success: false,
      results: [],
      totalFlows: 0,
      successfulFlows: 0,
      failedFlows: 0,
      totalVersions: 0,
    }
  }

  if (isSingleFlowExport(data)) {
    const result = await importSingleFlow(storage, data, options)
    return {
      success: result.success,
      results: [result],
      totalFlows: 1,
      successfulFlows: result.success ? 1 : 0,
      failedFlows: result.success ? 0 : 1,
      totalVersions: result.versionCount,
    }
  }

  return importFlowBundle(storage, data, options)
}

/**
 * Import from file
 */
export async function importFromFile(
  storage: StorageProvider,
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> {
  try {
    const json = await readFileAsText(file)
    return importFromJson(storage, json, options)
  } catch (error) {
    return {
      success: false,
      results: [
        {
          success: false,
          flowName: file.name,
          versionCount: 0,
          error: error instanceof Error ? error.message : 'Failed to read file',
        },
      ],
      totalFlows: 0,
      successfulFlows: 0,
      failedFlows: 1,
      totalVersions: 0,
    }
  }
}
