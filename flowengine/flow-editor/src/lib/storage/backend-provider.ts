/**
 * Backend Storage Provider
 * Implements StorageProvider interface using Rust backend REST API
 */

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

/**
 * Backend provider configuration
 */
export interface BackendProviderConfig {
  baseUrl: string
  tenantId?: string
  token?: string
}

/**
 * API response types from Rust backend
 */
interface ApiFlowListResponse {
  flows: ApiFlowEntry[]
  total: number
  limit: number
  offset: number
}

interface ApiFlowEntry {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  version_count: number
  created_at: string
  updated_at: string
  tenant_id?: string
}

interface ApiVersionListResponse {
  flow_id: string
  versions: ApiVersionEntry[]
  total: number
}

interface ApiVersionEntry {
  id: string
  flow_id: string
  version_number: number
  label: string | null
  data?: unknown
  created_at: string
}

/**
 * Backend implementation of StorageProvider
 */
export class BackendProvider implements StorageProvider {
  private baseUrl: string
  private tenantId: string
  private token?: string

  constructor(config: BackendProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.tenantId = config.tenantId || 'default'
    this.token = config.token
  }

  /**
   * Make an authenticated API request
   */
  private async fetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api${path}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error ${response.status}: ${error}`)
    }

    return response.json()
  }

  /**
   * Convert API flow entry to internal format
   */
  private toFlowEntry(api: ApiFlowEntry): FlowEntry {
    return {
      id: api.id,
      name: api.name,
      description: api.description || undefined,
      thumbnail: api.thumbnail || undefined,
      latestVersion: api.version_count,
      versionCount: api.version_count,
      createdAt: this.parseTimestamp(api.created_at),
      updatedAt: this.parseTimestamp(api.updated_at),
    }
  }

  /**
   * Convert API version entry to summary format
   */
  private toVersionSummary(api: ApiVersionEntry): FlowVersionSummary {
    return {
      id: api.id,
      flowId: api.flow_id,
      version: api.version_number,
      name: api.label || `Version ${api.version_number}`,
      createdAt: this.parseTimestamp(api.created_at),
    }
  }

  /**
   * Parse RFC3339/ISO8601 timestamp to milliseconds
   *
   * 后端返回的是 UTC 时间戳（格式如 2024-01-01T08:00:00+00:00）。
   * JavaScript Date 会正确解析并转换为本地时区的 Date 对象，
   * getTime() 返回的是从 epoch 开始的 UTC 毫秒数。
   */
  private parseTimestamp(timestamp: string): number {
    const date = new Date(timestamp)
    // 如果解析失败，返回当前时间
    if (isNaN(date.getTime())) {
      console.warn(`[BackendProvider] Failed to parse timestamp: ${timestamp}`)
      return Date.now()
    }
    return date.getTime()
  }

  /**
   * List all flows with optional filtering and sorting
   */
  async listFlows(options?: ListOptions): Promise<FlowEntry[]> {
    const params = new URLSearchParams({
      tenant_id: this.tenantId,
      limit: String(options?.limit || 100),
      offset: String(options?.offset || 0),
    })

    const response = await this.fetch<ApiFlowListResponse>(
      `/flows?${params.toString()}`
    )

    let flows = response.flows.map((f) => this.toFlowEntry(f))

    // Apply search filter (client-side for now)
    if (options?.search) {
      const search = options.search.toLowerCase()
      flows = flows.filter(
        (f) =>
          f.name.toLowerCase().includes(search) ||
          f.description?.toLowerCase().includes(search)
      )
    }

    // Apply tag filter
    if (options?.tags && options.tags.length > 0) {
      flows = flows.filter((f) =>
        options.tags!.some((tag) => f.tags?.includes(tag))
      )
    }

    // Apply sorting
    const sortBy = options?.sortBy || 'updatedAt'
    const sortOrder = options?.sortOrder || 'desc'
    flows.sort((a, b) => {
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

    return flows
  }

  /**
   * Get a single flow by ID
   */
  async getFlow(id: string): Promise<FlowEntry | null> {
    try {
      const response = await this.fetch<ApiFlowEntry>(`/flows/${id}`)
      return this.toFlowEntry(response)
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
  }

  /**
   * Create a new flow
   */
  async createFlow(input: CreateFlowInput): Promise<FlowEntry> {
    const response = await this.fetch<ApiFlowEntry>('/flows', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        description: input.description,
        tenant_id: this.tenantId,
      }),
    })

    return this.toFlowEntry(response)
  }

  /**
   * Update an existing flow
   */
  async updateFlow(id: string, updates: UpdateFlowInput): Promise<FlowEntry> {
    const response = await this.fetch<ApiFlowEntry>(`/flows/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: updates.name,
        description: updates.description,
      }),
    })

    return this.toFlowEntry(response)
  }

  /**
   * Delete a flow and all its versions
   */
  async deleteFlow(id: string): Promise<void> {
    await this.fetch(`/flows/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * List all versions for a flow
   */
  async listVersions(flowId: string): Promise<FlowVersionSummary[]> {
    try {
      const response = await this.fetch<ApiVersionListResponse>(
        `/flows/${flowId}/versions`
      )
      return response.versions.map((v) => this.toVersionSummary(v))
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return []
      }
      throw error
    }
  }

  /**
   * Get a specific version
   */
  async getVersion(
    flowId: string,
    versionId: string
  ): Promise<FlowVersion | null> {
    try {
      const response = await this.fetch<ApiVersionEntry>(
        `/flows/${flowId}/versions/${versionId}`
      )
      return {
        id: response.id,
        flowId: response.flow_id,
        version: response.version_number,
        name: response.label || `Version ${response.version_number}`,
        flow: response.data as FlowVersion['flow'],
        createdAt: this.parseTimestamp(response.created_at),
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        return null
      }
      throw error
    }
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
    const response = await this.fetch<ApiVersionEntry>(
      `/flows/${flowId}/versions`,
      {
        method: 'POST',
        body: JSON.stringify({
          data: input.flow,
          label: input.name,
          tenant_id: this.tenantId,
        }),
      }
    )

    return {
      id: response.id,
      flowId: response.flow_id,
      version: response.version_number,
      name: response.label || `Version ${response.version_number}`,
      flow: input.flow,
      createdAt: this.parseTimestamp(response.created_at),
      isAutoSave: input.isAutoSave,
    }
  }

  /**
   * Delete a specific version
   */
  async deleteVersion(flowId: string, versionId: string): Promise<void> {
    await this.fetch(`/flows/${flowId}/versions/${versionId}`, {
      method: 'DELETE',
    })
  }
}

/**
 * Execution request
 */
export interface ExecuteFlowRequest {
  flow: {
    meta: { name: string; description?: string }
    nodes: unknown[]
    edges: unknown[]
    vars?: string
  }
  inputs?: Record<string, unknown>
  async_mode?: boolean
  tenant_id?: string
}

/**
 * Execution result from backend
 */
export interface ExecutionResult {
  execution_id: string
  flow_id: string
  flow_name: string
  status: 'completed' | 'failed' | 'running' | 'cancelled'
  result?: {
    success: boolean
    outputs: unknown
    node_results: Record<string, unknown>
    error?: string
    duration_ms: number
  }
  message?: string
}

/**
 * Execution status response
 */
export interface ExecutionStatus {
  execution_id: string
  flow_id: string
  status: string
  progress: number
  current_node?: string
  result?: unknown
  error?: string
  started_at: string
  completed_at?: string
}

/**
 * Execute a flow directly (without storage)
 */
export async function executeFlow(
  config: BackendProviderConfig,
  request: ExecuteFlowRequest
): Promise<ExecutionResult> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  }

  const response = await fetch(`${baseUrl}/api/execute/run`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Execute error ${response.status}: ${error}`)
  }

  return response.json()
}

/**
 * Get execution status
 */
export async function getExecutionStatus(
  config: BackendProviderConfig,
  executionId: string
): Promise<ExecutionStatus> {
  const baseUrl = config.baseUrl.replace(/\/$/, '')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (config.token) {
    headers['Authorization'] = `Bearer ${config.token}`
  }

  const response = await fetch(`${baseUrl}/api/execute/status/${executionId}`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Status error ${response.status}: ${error}`)
  }

  return response.json()
}

/**
 * Create a new Backend provider instance
 */
export function createBackendProvider(
  config: BackendProviderConfig
): BackendProvider {
  return new BackendProvider(config)
}
