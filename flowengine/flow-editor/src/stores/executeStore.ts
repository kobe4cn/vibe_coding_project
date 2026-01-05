/**
 * Execute Store
 * State management for flow execution
 */

import { create } from 'zustand'
import {
  executeFlow,
  getExecutionStatus,
  type ExecutionResult,
  type ExecutionStatus,
  type BackendProviderConfig,
} from '@/lib/storage/backend-provider'
import type { FlowModel } from '@/types/flow'

export type ExecutionState = 'idle' | 'running' | 'completed' | 'failed'

interface ExecuteState {
  // Execution state
  state: ExecutionState
  executionId: string | null
  result: ExecutionResult | null
  error: string | null

  // Inputs dialog
  showInputsDialog: boolean
  inputs: Record<string, unknown>

  // Results panel
  showResultsPanel: boolean

  // Backend config
  backendUrl: string

  // Actions
  setBackendUrl: (url: string) => void
  setInputs: (inputs: Record<string, unknown>) => void
  openInputsDialog: () => void
  closeInputsDialog: () => void
  openResultsPanel: () => void
  closeResultsPanel: () => void
  execute: (flow: FlowModel) => Promise<void>
  checkStatus: (executionId: string) => Promise<ExecutionStatus | null>
  reset: () => void
}

export const useExecuteStore = create<ExecuteState>((set, get) => ({
  state: 'idle',
  executionId: null,
  result: null,
  error: null,
  showInputsDialog: false,
  inputs: {},
  showResultsPanel: false,
  backendUrl: import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001',

  setBackendUrl: (url) => set({ backendUrl: url }),

  setInputs: (inputs) => set({ inputs }),

  openInputsDialog: () => set({ showInputsDialog: true }),

  closeInputsDialog: () => set({ showInputsDialog: false }),

  openResultsPanel: () => set({ showResultsPanel: true }),

  closeResultsPanel: () => set({ showResultsPanel: false }),

  execute: async (flow: FlowModel) => {
    const { backendUrl, inputs } = get()

    set({
      state: 'running',
      executionId: null,
      result: null,
      error: null,
      showInputsDialog: false,
      showResultsPanel: true,
    })

    const config: BackendProviderConfig = {
      baseUrl: backendUrl,
    }

    try {
      const result = await executeFlow(config, {
        flow: {
          meta: flow.meta,
          nodes: flow.nodes,
          edges: flow.edges,
          vars: flow.vars,
        },
        inputs,
        async_mode: false,
      })

      set({
        state: result.status === 'completed' ? 'completed' : 'failed',
        executionId: result.execution_id,
        result,
        error: result.result?.error || null,
      })
    } catch (err) {
      set({
        state: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  },

  checkStatus: async (executionId: string) => {
    const { backendUrl } = get()
    const config: BackendProviderConfig = {
      baseUrl: backendUrl,
    }

    try {
      return await getExecutionStatus(config, executionId)
    } catch {
      return null
    }
  },

  reset: () =>
    set({
      state: 'idle',
      executionId: null,
      result: null,
      error: null,
      inputs: {},
    }),
}))
