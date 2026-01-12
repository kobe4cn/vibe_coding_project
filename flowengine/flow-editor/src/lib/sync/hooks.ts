/**
 * Sync Service React Hooks
 */

import { useState, useEffect, useCallback } from 'react'
import { getSyncService, SyncService } from './sync-service'
import type { SyncState, SyncResult, SyncOptions } from './types'
import type { StorageProvider } from '../storage/types'

/**
 * Hook to use sync service
 */
export function useSyncService(options?: Partial<SyncOptions>): {
  service: SyncService
  state: SyncState
  sync: () => Promise<SyncResult>
  clearPending: () => Promise<void>
} {
  const [service] = useState(() => getSyncService(options))
  const [state, setState] = useState<SyncState>(service.getState())

  useEffect(() => {
    const unsubscribe = service.subscribe(setState)
    return unsubscribe
  }, [service])

  const sync = useCallback(() => service.sync(), [service])
  const clearPending = useCallback(() => service.clearPending(), [service])

  return {
    service,
    state,
    sync,
    clearPending,
  }
}

/**
 * Hook to initialize sync service with providers
 */
export function useSyncInit(
  local: StorageProvider | null,
  remote: StorageProvider | null
): {
  isInitialized: boolean
  error: string | null
} {
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { service } = useSyncService()

  useEffect(() => {
    if (!local || !remote) {
      // 使用 requestAnimationFrame 避免在 effect 中同步调用 setState
      requestAnimationFrame(() => {
        setIsInitialized(false)
      })
      return
    }

    service
      .initialize(local, remote)
      .then(() => {
        setIsInitialized(true)
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Init failed')
        setIsInitialized(false)
      })
  }, [local, remote, service])

  return { isInitialized, error }
}

/**
 * Hook to get online status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

/**
 * Hook to get pending operation count
 */
export function usePendingCount(): number {
  const { state } = useSyncService()
  return state.pendingOperations.length
}
