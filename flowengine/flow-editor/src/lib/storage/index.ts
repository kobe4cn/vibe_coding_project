/**
 * Storage Module Exports
 */

export * from './types'
export * from './indexeddb-provider'
export * from './backend-provider'
export { StorageProviderComponent, useStorage, useStorageConfig, useStorageReady } from './context'
export {
  detectLegacyData,
  migrateFromLegacy,
  cleanupLegacyData,
  checkMigrationNeeded,
  type MigrationResult,
  type MigrationProgressCallback,
} from './migration'
