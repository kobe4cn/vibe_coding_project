/**
 * Storage Abstraction Layer Types
 * Provides unified interfaces for flow and version storage
 */

import type { FlowModel } from '@/types/flow'

/**
 * Flow entry in the registry
 */
export interface FlowEntry {
  id: string
  name: string
  description?: string
  tags?: string[]
  thumbnail?: string
  latestVersion: number
  versionCount: number
  createdAt: number
  updatedAt: number
  createdBy?: string
}

/**
 * Input for creating a new flow
 */
export interface CreateFlowInput {
  name: string
  description?: string
  tags?: string[]
}

/**
 * Input for updating a flow
 */
export interface UpdateFlowInput {
  name?: string
  description?: string
  tags?: string[]
  thumbnail?: string
}

/**
 * Full flow version with flow data
 */
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

/**
 * Summary of a flow version (without full flow data)
 */
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

/**
 * Input for saving a new version
 */
export interface SaveVersionInput {
  name?: string
  description?: string
  flow: FlowModel
  tags?: string[]
  isAutoSave?: boolean
}

/**
 * Options for listing flows
 */
export interface ListOptions {
  search?: string
  tags?: string[]
  sortBy?: 'name' | 'updatedAt' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

/**
 * Storage provider interface
 * Abstraction layer for different storage backends
 */
export interface StorageProvider {
  // Flow operations
  listFlows(options?: ListOptions): Promise<FlowEntry[]>
  getFlow(id: string): Promise<FlowEntry | null>
  createFlow(input: CreateFlowInput): Promise<FlowEntry>
  updateFlow(id: string, updates: UpdateFlowInput): Promise<FlowEntry>
  deleteFlow(id: string): Promise<void>

  // Version operations
  listVersions(flowId: string): Promise<FlowVersionSummary[]>
  getVersion(flowId: string, versionId: string): Promise<FlowVersion | null>
  getLatestVersion(flowId: string): Promise<FlowVersion | null>
  saveVersion(flowId: string, input: SaveVersionInput): Promise<FlowVersion>
  deleteVersion(flowId: string, versionId: string): Promise<void>
}

/**
 * Storage mode
 */
export type StorageMode = 'local' | 'backend'

/**
 * Storage configuration
 */
export interface StorageConfig {
  mode: StorageMode
  backendUrl?: string
  token?: string
}
