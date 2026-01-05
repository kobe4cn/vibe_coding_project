/**
 * Storage Context
 * Provides storage provider access throughout the React component tree
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'
import type { StorageProvider, StorageConfig, StorageMode } from './types'
import { IndexedDBProvider } from './indexeddb-provider'
import { BackendProvider } from './backend-provider'

/**
 * Storage context value
 */
interface StorageContextValue {
  provider: StorageProvider
  mode: StorageMode
  config: StorageConfig
  setConfig: (config: StorageConfig) => void
  isReady: boolean
}

const StorageContext = createContext<StorageContextValue | null>(null)

/**
 * Default storage configuration
 */
const DEFAULT_CONFIG: StorageConfig = {
  mode: 'local',
}

/**
 * Local storage key for persisting config
 */
const CONFIG_STORAGE_KEY = 'fdl-storage-config'

/**
 * Load config from localStorage
 */
function loadConfig(): StorageConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as StorageConfig
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_CONFIG
}

/**
 * Save config to localStorage
 */
function saveConfig(config: StorageConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Ignore errors
  }
}

/**
 * Storage provider component props
 */
interface StorageProviderProps {
  children: ReactNode
  initialConfig?: StorageConfig
}

/**
 * Storage provider component
 * Wraps the app to provide storage access
 */
export function StorageProviderComponent({
  children,
  initialConfig,
}: StorageProviderProps) {
  const [config, setConfigState] = useState<StorageConfig>(
    () => initialConfig || loadConfig()
  )
  const [isReady, setIsReady] = useState(false)

  // Create provider based on mode
  const provider = useMemo<StorageProvider>(() => {
    if (config.mode === 'backend' && config.backendUrl) {
      return new BackendProvider({
        baseUrl: config.backendUrl,
        token: config.token,
      })
    }
    return new IndexedDBProvider()
  }, [config.mode, config.backendUrl, config.token])

  // Update config and persist
  const setConfig = (newConfig: StorageConfig) => {
    setConfigState(newConfig)
    saveConfig(newConfig)
  }

  // Mark as ready after mount
  useEffect(() => {
    setIsReady(true)
  }, [])

  const value: StorageContextValue = {
    provider,
    mode: config.mode,
    config,
    setConfig,
    isReady,
  }

  return (
    <StorageContext.Provider value={value}>{children}</StorageContext.Provider>
  )
}

/**
 * Hook to access storage provider
 */
export function useStorage(): StorageProvider {
  const context = useContext(StorageContext)
  if (!context) {
    throw new Error('useStorage must be used within a StorageProviderComponent')
  }
  return context.provider
}

/**
 * Hook to access storage configuration
 */
export function useStorageConfig(): {
  mode: StorageMode
  config: StorageConfig
  setConfig: (config: StorageConfig) => void
  isReady: boolean
} {
  const context = useContext(StorageContext)
  if (!context) {
    throw new Error(
      'useStorageConfig must be used within a StorageProviderComponent'
    )
  }
  return {
    mode: context.mode,
    config: context.config,
    setConfig: context.setConfig,
    isReady: context.isReady,
  }
}

/**
 * Hook to check if storage is ready
 */
export function useStorageReady(): boolean {
  const context = useContext(StorageContext)
  return context?.isReady ?? false
}
