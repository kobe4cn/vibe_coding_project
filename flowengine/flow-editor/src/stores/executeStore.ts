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
import type { FlowModel, StartParameterDef, StartNodeData } from '@/types/flow'

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
  parameterDefs: StartParameterDef[]

  // Results panel
  showResultsPanel: boolean

  // Backend config
  backendUrl: string

  // Actions
  setBackendUrl: (url: string) => void
  setInputs: (inputs: Record<string, unknown>) => void
  setParameterDefs: (defs: StartParameterDef[]) => void
  openInputsDialog: () => void
  closeInputsDialog: () => void
  openResultsPanel: () => void
  closeResultsPanel: () => void
  prepareExecution: (flow: FlowModel) => void
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
  parameterDefs: [],
  showResultsPanel: false,
  backendUrl: import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001',

  setBackendUrl: (url) => set({ backendUrl: url }),

  setInputs: (inputs) => set({ inputs }),

  setParameterDefs: (defs) => set({ parameterDefs: defs }),

  openInputsDialog: () => set({ showInputsDialog: true }),

  closeInputsDialog: () => set({ showInputsDialog: false }),

  openResultsPanel: () => set({ showResultsPanel: true }),

  closeResultsPanel: () => set({ showResultsPanel: false }),

  prepareExecution: (flow: FlowModel) => {
    // Find start node and extract parameter definitions
    const startNode = flow.nodes.find((n) => n.data.nodeType === 'start')
    const parameters = startNode
      ? ((startNode.data as StartNodeData).parameters || [])
      : []

    // If no parameters defined, execute directly
    if (parameters.length === 0) {
      get().execute(flow)
    } else {
      // Show inputs dialog
      set({
        parameterDefs: parameters,
        showInputsDialog: true,
        inputs: {},
      })
    }
  },

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
      // 转换 args.outputs 为后端期望的 args.out 格式
      const backendArgs = flow.args ? {
        in: flow.args.inputs?.reduce((acc, p) => {
          acc[p.name] = p.type
          return acc
        }, {} as Record<string, string>),
        out: Array.isArray(flow.args.outputs)
          ? flow.args.outputs.map(o => ({ name: o.name, type: o.type }))
          : undefined,
      } : undefined

      const result = await executeFlow(config, {
        flow: {
          meta: flow.meta,
          nodes: flow.nodes,
          edges: flow.edges,
          vars: flow.vars,
          args: backendArgs,
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
      parameterDefs: [],
    }),
}))
