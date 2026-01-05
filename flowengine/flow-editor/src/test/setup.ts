/**
 * Vitest Test Setup
 * Global test configuration and mocks
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock IndexedDB for storage tests
const createMockIDB = () => {
  const storage = new Map<string, unknown>()

  return {
    get: vi.fn((key: string) => Promise.resolve(storage.get(key))),
    set: vi.fn((key: string, value: unknown) => {
      storage.set(key, value)
      return Promise.resolve()
    }),
    del: vi.fn((key: string) => {
      storage.delete(key)
      return Promise.resolve()
    }),
    keys: vi.fn(() => Promise.resolve(Array.from(storage.keys()))),
    clear: vi.fn(() => {
      storage.clear()
      return Promise.resolve()
    }),
    createStore: vi.fn(() => ({})),
    _storage: storage,
    _reset: () => storage.clear(),
  }
}

// Create mock instance
export const mockIdbKeyval = createMockIDB()

// Mock idb-keyval module
vi.mock('idb-keyval', () => ({
  get: mockIdbKeyval.get,
  set: mockIdbKeyval.set,
  del: mockIdbKeyval.del,
  keys: mockIdbKeyval.keys,
  clear: mockIdbKeyval.clear,
  createStore: mockIdbKeyval.createStore,
}))

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock scrollTo
window.scrollTo = vi.fn()

// Export helper to reset mocks between tests
export function resetMocks() {
  mockIdbKeyval._reset()
  vi.clearAllMocks()
}
