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
 * Get default storage mode from environment
 */
function getDefaultStorageMode(): StorageMode {
  const envMode = import.meta.env.VITE_DEFAULT_STORAGE_MODE
  if (envMode === 'backend' || envMode === 'local') {
    return envMode
  }
  return 'backend' // Default to backend for full functionality
}

/**
 * Get default backend URL from environment
 */
function getDefaultBackendUrl(): string {
  return import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
}

/**
 * Default storage configuration
 */
const DEFAULT_CONFIG: StorageConfig = {
  mode: getDefaultStorageMode(),
  backendUrl: getDefaultBackendUrl(),
}

// Debug log for storage configuration
console.log('[Storage] Default config:', {
  mode: DEFAULT_CONFIG.mode,
  backendUrl: DEFAULT_CONFIG.backendUrl,
  envMode: import.meta.env.VITE_DEFAULT_STORAGE_MODE,
  envApiUrl: import.meta.env.VITE_API_URL,
})

/**
 * Local storage key for persisting config
 */
const CONFIG_STORAGE_KEY = 'fdl-storage-config'

/**
 * Load config from localStorage, with environment variable override
 */
function loadConfig(): StorageConfig {
  try {
    const stored = localStorage.getItem(CONFIG_STORAGE_KEY)
    if (stored) {
      const config = JSON.parse(stored) as StorageConfig
      // If no backendUrl is set, use the default from environment
      if (!config.backendUrl) {
        config.backendUrl = getDefaultBackendUrl()
      }
      return config
    }
  } catch {
    // Ignore errors
  }
  return DEFAULT_CONFIG
}

/**
 * Clear stored config and use defaults
 * Call this to reset to environment-based defaults
 */
export function resetStorageConfig(): void {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY)
  } catch {
    // Ignore errors
  }
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
    console.log('[Storage] Creating provider with config:', config)
    if (config.mode === 'backend' && config.backendUrl) {
      console.log('[Storage] Using BackendProvider with URL:', config.backendUrl)
      return new BackendProvider({
        baseUrl: config.backendUrl,
        token: config.token,
      })
    }
    console.log('[Storage] Using IndexedDBProvider (local storage)')
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
