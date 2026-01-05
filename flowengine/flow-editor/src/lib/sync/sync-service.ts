/**
 * Sync Service
 * Handles offline/online synchronization between local and backend storage
 */

import { get, set, del, keys, createStore } from 'idb-keyval'
import type {
  SyncOperation,
  SyncState,
  SyncResult,
  SyncOptions,
  SyncConflict,
  SyncOperationType,
} from './types'
import type { StorageProvider } from '../storage/types'

// IndexedDB store for sync queue
const syncStore = createStore('fdl-sync-db', 'sync-queue')

/**
 * Default sync options
 */
const DEFAULT_OPTIONS: SyncOptions = {
  conflictStrategy: 'local',
  maxRetries: 3,
  retryDelay: 1000,
  batchSize: 10,
}

/**
 * Sync Service Class
 */
export class SyncService {
  private options: SyncOptions
  private state: SyncState
  private localProvider: StorageProvider | null = null
  private remoteProvider: StorageProvider | null = null
  private listeners: Set<(state: SyncState) => void> = new Set()
  private syncInProgress = false

  constructor(options: Partial<SyncOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    this.state = {
      status: 'idle',
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      pendingOperations: [],
      lastSyncAt: null,
      error: null,
    }

    // Listen for online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  /**
   * Initialize with storage providers
   */
  async initialize(local: StorageProvider, remote: StorageProvider): Promise<void> {
    this.localProvider = local
    this.remoteProvider = remote

    // Load pending operations from IndexedDB
    await this.loadPendingOperations()

    // Auto-sync if online
    if (this.state.isOnline && this.state.pendingOperations.length > 0) {
      this.sync()
    }
  }

  /**
   * Get current state
   */
  getState(): SyncState {
    return { ...this.state }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: (state: SyncState) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  /**
   * Queue an operation for sync
   */
  async queueOperation(
    type: SyncOperationType,
    resourceId: string,
    data: unknown
  ): Promise<void> {
    const operation: SyncOperation = {
      id: crypto.randomUUID(),
      type,
      resourceId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    }

    // Persist to IndexedDB
    await set(operation.id, operation, syncStore)

    // Update state
    this.state.pendingOperations.push(operation)
    this.notifyListeners()

    // Try to sync if online
    if (this.state.isOnline && !this.syncInProgress) {
      this.sync()
    }
  }

  /**
   * Sync pending operations
   */
  async sync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [{ operationId: '', error: 'Sync already in progress' }],
      }
    }

    if (!this.state.isOnline) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [{ operationId: '', error: 'Offline' }],
      }
    }

    if (!this.remoteProvider) {
      return {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        conflicts: [],
        errors: [{ operationId: '', error: 'Remote provider not initialized' }],
      }
    }

    this.syncInProgress = true
    this.setState({ status: 'syncing', error: null })

    const result: SyncResult = {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      conflicts: [],
      errors: [],
    }

    try {
      // Process operations in batches
      const operations = [...this.state.pendingOperations]

      for (let i = 0; i < operations.length; i += this.options.batchSize) {
        const batch = operations.slice(i, i + this.options.batchSize)

        for (const op of batch) {
          try {
            await this.executeOperation(op)
            await this.removeOperation(op.id)
            result.syncedCount++
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'

            // Check if it's a conflict
            if (errorMessage.includes('conflict') || errorMessage.includes('409')) {
              result.conflicts.push({
                operationId: op.id,
                localData: op.data,
                remoteData: null, // Would need to fetch
                resourceType: op.type.split('_')[1],
                resourceId: op.resourceId,
                timestamp: op.timestamp,
              })
            } else {
              // Retry logic
              op.retryCount++
              if (op.retryCount >= this.options.maxRetries) {
                result.errors.push({ operationId: op.id, error: errorMessage })
                await this.removeOperation(op.id)
                result.failedCount++
              } else {
                // Update retry count in store
                await set(op.id, op, syncStore)
              }
            }
          }
        }
      }

      // Update state
      this.setState({
        status: result.errors.length > 0 ? 'error' : 'idle',
        lastSyncAt: Date.now(),
        error: result.errors.length > 0 ? `${result.failedCount} operations failed` : null,
      })

      result.success = result.failedCount === 0 && result.conflicts.length === 0
    } finally {
      this.syncInProgress = false
    }

    return result
  }

  /**
   * Force full sync
   */
  async fullSync(): Promise<void> {
    if (!this.localProvider || !this.remoteProvider) return

    // This would implement a full bidirectional sync
    // For now, just sync pending operations
    await this.sync()
  }

  /**
   * Clear all pending operations
   */
  async clearPending(): Promise<void> {
    const allKeys = await keys(syncStore)
    for (const key of allKeys) {
      await del(key, syncStore)
    }
    this.state.pendingOperations = []
    this.notifyListeners()
  }

  /**
   * Destroy the service
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
    this.listeners.clear()
  }

  // Private methods

  private handleOnline = (): void => {
    this.setState({ isOnline: true, status: 'idle' })
    if (this.state.pendingOperations.length > 0) {
      this.sync()
    }
  }

  private handleOffline = (): void => {
    this.setState({ isOnline: false, status: 'offline' })
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const allKeys = await keys(syncStore)
      const operations: SyncOperation[] = []

      for (const key of allKeys) {
        const op = await get<SyncOperation>(key, syncStore)
        if (op) {
          operations.push(op)
        }
      }

      // Sort by timestamp
      operations.sort((a, b) => a.timestamp - b.timestamp)
      this.state.pendingOperations = operations
      this.notifyListeners()
    } catch (error) {
      console.error('Failed to load pending operations:', error)
    }
  }

  private async removeOperation(id: string): Promise<void> {
    await del(id, syncStore)
    this.state.pendingOperations = this.state.pendingOperations.filter(
      (op) => op.id !== id
    )
    this.notifyListeners()
  }

  private async executeOperation(op: SyncOperation): Promise<void> {
    if (!this.remoteProvider) {
      throw new Error('Remote provider not available')
    }

    switch (op.type) {
      case 'create_flow': {
        const data = op.data as { name: string; description?: string }
        await this.remoteProvider.createFlow(data)
        break
      }
      case 'update_flow': {
        const data = op.data as { name?: string; description?: string }
        await this.remoteProvider.updateFlow(op.resourceId, data)
        break
      }
      case 'delete_flow': {
        await this.remoteProvider.deleteFlow(op.resourceId)
        break
      }
      case 'create_version': {
        const data = op.data as { flowId: string; input: unknown }
        await this.remoteProvider.saveVersion(
          (data as { flowId: string }).flowId,
          data.input as Parameters<StorageProvider['saveVersion']>[1]
        )
        break
      }
      case 'delete_version': {
        const data = op.data as { flowId: string; versionId: string }
        await this.remoteProvider.deleteVersion(data.flowId, data.versionId)
        break
      }
      default:
        throw new Error(`Unknown operation type: ${op.type}`)
    }
  }

  private setState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial }
    this.notifyListeners()
  }

  private notifyListeners(): void {
    const state = this.getState()
    this.listeners.forEach((callback) => callback(state))
  }
}

/**
 * Create a new sync service instance
 */
export function createSyncService(options?: Partial<SyncOptions>): SyncService {
  return new SyncService(options)
}

/**
 * Singleton instance
 */
let syncServiceInstance: SyncService | null = null

/**
 * Get or create sync service singleton
 */
export function getSyncService(options?: Partial<SyncOptions>): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = createSyncService(options)
  }
  return syncServiceInstance
}
