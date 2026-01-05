/**
 * Sync Service Types
 * Types for offline/online synchronization
 */

/**
 * Sync operation types
 */
export type SyncOperationType =
  | 'create_flow'
  | 'update_flow'
  | 'delete_flow'
  | 'create_version'
  | 'delete_version'

/**
 * Pending sync operation
 */
export interface SyncOperation {
  id: string
  type: SyncOperationType
  resourceId: string
  data: unknown
  timestamp: number
  retryCount: number
}

/**
 * Sync status
 */
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline'

/**
 * Sync state
 */
export interface SyncState {
  status: SyncStatus
  isOnline: boolean
  pendingOperations: SyncOperation[]
  lastSyncAt: number | null
  error: string | null
}

/**
 * Conflict resolution strategy
 */
export type ConflictStrategy = 'local' | 'remote' | 'manual'

/**
 * Sync conflict
 */
export interface SyncConflict {
  operationId: string
  localData: unknown
  remoteData: unknown
  resourceType: string
  resourceId: string
  timestamp: number
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  syncedCount: number
  failedCount: number
  conflicts: SyncConflict[]
  errors: Array<{ operationId: string; error: string }>
}

/**
 * Sync options
 */
export interface SyncOptions {
  conflictStrategy: ConflictStrategy
  maxRetries: number
  retryDelay: number
  batchSize: number
}
