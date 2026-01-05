/**
 * Flow Export Utilities
 * Export flows with their version history
 */

import type { StorageProvider, FlowEntry, FlowVersion } from '@/lib/storage'

/**
 * Exported flow format
 */
export interface ExportedFlow {
  meta: {
    exportedAt: number
    version: string
  }
  flow: FlowEntry
  versions: FlowVersion[]
}

/**
 * Exported flows bundle (for multiple flows)
 */
export interface ExportedFlowBundle {
  meta: {
    exportedAt: number
    version: string
    flowCount: number
  }
  flows: ExportedFlow[]
}

/**
 * Export options
 */
export interface ExportOptions {
  includeVersions?: boolean
  maxVersions?: number
  includeAutoSaves?: boolean
}

const EXPORT_VERSION = '1.0.0'

/**
 * Export a single flow with its versions
 */
export async function exportFlow(
  storage: StorageProvider,
  flowId: string,
  options: ExportOptions = {}
): Promise<ExportedFlow | null> {
  const { includeVersions = true, maxVersions, includeAutoSaves = false } = options

  const flowEntry = await storage.getFlow(flowId)
  if (!flowEntry) {
    return null
  }

  let versions: FlowVersion[] = []

  if (includeVersions) {
    const versionSummaries = await storage.listVersions(flowId)
    let filteredSummaries = includeAutoSaves
      ? versionSummaries
      : versionSummaries.filter((v) => !v.isAutoSave)

    if (maxVersions !== undefined) {
      filteredSummaries = filteredSummaries.slice(0, maxVersions)
    }

    for (const summary of filteredSummaries) {
      const version = await storage.getVersion(flowId, summary.id)
      if (version) {
        versions.push(version)
      }
    }
  }

  return {
    meta: {
      exportedAt: Date.now(),
      version: EXPORT_VERSION,
    },
    flow: flowEntry,
    versions,
  }
}

/**
 * Export multiple flows
 */
export async function exportFlows(
  storage: StorageProvider,
  flowIds: string[],
  options: ExportOptions = {}
): Promise<ExportedFlowBundle> {
  const flows: ExportedFlow[] = []

  for (const flowId of flowIds) {
    const exported = await exportFlow(storage, flowId, options)
    if (exported) {
      flows.push(exported)
    }
  }

  return {
    meta: {
      exportedAt: Date.now(),
      version: EXPORT_VERSION,
      flowCount: flows.length,
    },
    flows,
  }
}

/**
 * Export all flows
 */
export async function exportAllFlows(
  storage: StorageProvider,
  options: ExportOptions = {}
): Promise<ExportedFlowBundle> {
  const allFlows = await storage.listFlows()
  const flowIds = allFlows.map((f) => f.id)
  return exportFlows(storage, flowIds, options)
}

/**
 * Convert exported data to JSON string
 */
export function exportToJson(data: ExportedFlow | ExportedFlowBundle): string {
  return JSON.stringify(data, null, 2)
}

/**
 * Download exported data as a file
 */
export function downloadExport(
  data: ExportedFlow | ExportedFlowBundle,
  filename?: string
): void {
  const json = exportToJson(data)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const defaultFilename =
    'flows' in data
      ? `flows-export-${new Date().toISOString().split('T')[0]}.json`
      : `${data.flow.name}-export.json`

  const a = document.createElement('a')
  a.href = url
  a.download = filename || defaultFilename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export and download a single flow
 */
export async function exportAndDownloadFlow(
  storage: StorageProvider,
  flowId: string,
  options: ExportOptions = {}
): Promise<boolean> {
  const exported = await exportFlow(storage, flowId, options)
  if (!exported) {
    return false
  }
  downloadExport(exported)
  return true
}

/**
 * Export and download multiple flows
 */
export async function exportAndDownloadFlows(
  storage: StorageProvider,
  flowIds: string[],
  options: ExportOptions = {}
): Promise<void> {
  const exported = await exportFlows(storage, flowIds, options)
  downloadExport(exported)
}
