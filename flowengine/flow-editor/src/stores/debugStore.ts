/**
 * Debug Store
 * State management for flow debugging
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type DebugStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

// Inline types to avoid import issues
export interface ExecutionHistoryEntry {
  nodeId: string
  timestamp: number
  state: 'pending' | 'running' | 'paused' | 'completed' | 'error' | 'skipped'
  input?: unknown
  output?: unknown
  error?: string
  duration?: number
}

export interface ExecutionEvent {
  type: 'start' | 'nodeStart' | 'nodeComplete' | 'nodeError' | 'pause' | 'resume' | 'complete' | 'error'
  nodeId?: string
  data?: unknown
  timestamp: number
}

interface NodeExecutionInfo {
  state: 'pending' | 'running' | 'paused' | 'completed' | 'error' | 'skipped'
  startTime?: number
  endTime?: number
  input?: unknown
  output?: unknown
  error?: string
}

interface DebugState {
  // Execution status
  status: DebugStatus
  currentNodeId: string | null

  // Breakpoints
  breakpoints: Set<string>

  // Execution history
  history: ExecutionHistoryEntry[]

  // Node execution info
  nodeStates: Map<string, NodeExecutionInfo>

  // Variables
  variables: Record<string, unknown>

  // Events log
  events: ExecutionEvent[]

  // Input arguments
  inputArgs: Record<string, unknown>

  // Actions
  setStatus: (status: DebugStatus) => void
  setCurrentNode: (nodeId: string | null) => void

  toggleBreakpoint: (nodeId: string) => void
  setBreakpoints: (nodeIds: string[]) => void
  clearBreakpoints: () => void
  hasBreakpoint: (nodeId: string) => boolean

  addHistoryEntry: (entry: ExecutionHistoryEntry) => void
  clearHistory: () => void

  updateNodeState: (nodeId: string, info: Partial<NodeExecutionInfo>) => void
  clearNodeStates: () => void

  setVariables: (vars: Record<string, unknown>) => void
  updateVariable: (key: string, value: unknown) => void

  addEvent: (event: ExecutionEvent) => void
  clearEvents: () => void

  setInputArgs: (args: Record<string, unknown>) => void

  reset: () => void
}

export const useDebugStore = create<DebugState>()(
  immer((set, get) => ({
    status: 'idle',
    currentNodeId: null,
    breakpoints: new Set(),
    history: [],
    nodeStates: new Map(),
    variables: {},
    events: [],
    inputArgs: {},

    setStatus: (status) =>
      set((state) => {
        state.status = status
      }),

    setCurrentNode: (nodeId) =>
      set((state) => {
        state.currentNodeId = nodeId
      }),

    toggleBreakpoint: (nodeId) =>
      set((state) => {
        if (state.breakpoints.has(nodeId)) {
          state.breakpoints.delete(nodeId)
        } else {
          state.breakpoints.add(nodeId)
        }
      }),

    setBreakpoints: (nodeIds) =>
      set((state) => {
        state.breakpoints = new Set(nodeIds)
      }),

    clearBreakpoints: () =>
      set((state) => {
        state.breakpoints.clear()
      }),

    hasBreakpoint: (nodeId) => get().breakpoints.has(nodeId),

    addHistoryEntry: (entry) =>
      set((state) => {
        state.history.push(entry)
      }),

    clearHistory: () =>
      set((state) => {
        state.history = []
      }),

    updateNodeState: (nodeId, info) =>
      set((state) => {
        const existing = state.nodeStates.get(nodeId) || { state: 'pending' }
        state.nodeStates.set(nodeId, { ...existing, ...info })
      }),

    clearNodeStates: () =>
      set((state) => {
        state.nodeStates.clear()
      }),

    setVariables: (vars) =>
      set((state) => {
        state.variables = vars
      }),

    updateVariable: (key, value) =>
      set((state) => {
        state.variables[key] = value
      }),

    addEvent: (event) =>
      set((state) => {
        state.events.push(event)
        // Keep only last 100 events
        if (state.events.length > 100) {
          state.events = state.events.slice(-100)
        }
      }),

    clearEvents: () =>
      set((state) => {
        state.events = []
      }),

    setInputArgs: (args) =>
      set((state) => {
        state.inputArgs = args
      }),

    reset: () =>
      set((state) => {
        state.status = 'idle'
        state.currentNodeId = null
        state.history = []
        state.nodeStates.clear()
        state.variables = {}
        state.events = []
      }),
  }))
)

// Selectors
export const useDebugStatus = () => useDebugStore((state) => state.status)
export const useCurrentNodeId = () => useDebugStore((state) => state.currentNodeId)
export const useBreakpoints = () => useDebugStore((state) => state.breakpoints)
export const useDebugHistory = () => useDebugStore((state) => state.history)
export const useDebugVariables = () => useDebugStore((state) => state.variables)
