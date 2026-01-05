/**
 * Flow Store
 * Main state management for the flow editor using Zustand
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type { FlowModel, FlowNode, FlowEdge, FlowMeta, FlowArgs, FlowNodeData } from '@/types/flow'
import { v4 as uuid } from 'uuid'

interface FlowState {
  // Current flow model
  flow: FlowModel

  // Flow identification
  flowId: string | null
  flowName: string

  // Read-only mode (for viewing historical versions)
  isReadOnly: boolean
  viewingVersionId: string | null

  // Selection state
  selectedNodeIds: string[]
  selectedEdgeIds: string[]

  // History for undo/redo
  history: FlowModel[]
  historyIndex: number

  // Dirty flag
  isDirty: boolean

  // Actions
  setFlow: (flow: FlowModel) => void
  setFlowId: (flowId: string | null) => void
  setFlowName: (name: string) => void
  setReadOnly: (isReadOnly: boolean, versionId?: string | null) => void
  loadFlow: (flowId: string, flow: FlowModel, flowName: string) => void
  updateMeta: (meta: Partial<FlowMeta>) => void
  updateArgs: (args: FlowArgs) => void
  updateVars: (vars: string) => void

  // Node operations
  addNode: (node: FlowNode) => void
  updateNode: (nodeId: string, data: Partial<FlowNodeData>) => void
  deleteNodes: (nodeIds: string[]) => void
  moveNode: (nodeId: string, position: { x: number; y: number }) => void

  // Edge operations
  addEdge: (edge: FlowEdge) => void
  updateEdge: (edgeId: string, data: Partial<FlowEdge>) => void
  deleteEdges: (edgeIds: string[]) => void

  // Selection
  setSelectedNodes: (nodeIds: string[]) => void
  setSelectedEdges: (edgeIds: string[]) => void
  clearSelection: () => void

  // History
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Reset
  reset: () => void

  // Dirty flag control
  setIsDirty: (isDirty: boolean) => void
}

const initialFlow: FlowModel = {
  meta: {
    name: '新流程',
  },
  nodes: [],
  edges: [],
}

export const useFlowStore = create<FlowState>()(
  immer((set) => ({
    flow: initialFlow,
    flowId: null,
    flowName: '新流程',
    isReadOnly: false,
    viewingVersionId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    history: [initialFlow],
    historyIndex: 0,
    isDirty: false,

    setFlow: (flow) =>
      set((state) => {
        state.flow = flow
        state.isDirty = false
        state.history = [flow]
        state.historyIndex = 0
      }),

    setFlowId: (flowId) =>
      set((state) => {
        state.flowId = flowId
      }),

    setFlowName: (name) =>
      set((state) => {
        state.flowName = name
      }),

    setReadOnly: (isReadOnly, versionId = null) =>
      set((state) => {
        state.isReadOnly = isReadOnly
        state.viewingVersionId = versionId
      }),

    loadFlow: (flowId, flow, flowName) =>
      set((state) => {
        state.flowId = flowId
        state.flow = flow
        state.flowName = flowName
        state.isDirty = false
        state.isReadOnly = false
        state.viewingVersionId = null
        state.history = [flow]
        state.historyIndex = 0
        state.selectedNodeIds = []
        state.selectedEdgeIds = []
      }),

    updateMeta: (meta) =>
      set((state) => {
        state.flow.meta = { ...state.flow.meta, ...meta }
        state.isDirty = true
      }),

    updateArgs: (args) =>
      set((state) => {
        state.flow.args = args
        state.isDirty = true
      }),

    updateVars: (vars) =>
      set((state) => {
        state.flow.vars = vars
        state.isDirty = true
      }),

    addNode: (node) =>
      set((state) => {
        // Ensure unique ID
        if (!node.id) {
          node.id = uuid()
        }
        state.flow.nodes.push(node)
        state.isDirty = true
      }),

    updateNode: (nodeId, data) =>
      set((state) => {
        const node = state.flow.nodes.find((n) => n.id === nodeId)
        if (node) {
          node.data = { ...node.data, ...data } as FlowNodeData
          state.isDirty = true
        }
      }),

    deleteNodes: (nodeIds) =>
      set((state) => {
        const nodeIdSet = new Set(nodeIds)
        state.flow.nodes = state.flow.nodes.filter((n) => !nodeIdSet.has(n.id))
        // Also delete connected edges
        state.flow.edges = state.flow.edges.filter(
          (e) => !nodeIdSet.has(e.source) && !nodeIdSet.has(e.target)
        )
        state.selectedNodeIds = state.selectedNodeIds.filter((id) => !nodeIdSet.has(id))
        state.isDirty = true
      }),

    moveNode: (nodeId, position) =>
      set((state) => {
        const node = state.flow.nodes.find((n) => n.id === nodeId)
        if (node) {
          node.position = position
          state.isDirty = true
        }
      }),

    addEdge: (edge) =>
      set((state) => {
        // Ensure unique ID
        if (!edge.id) {
          edge.id = uuid()
        }
        // Check for duplicate edges
        const exists = state.flow.edges.some(
          (e) => e.source === edge.source && e.target === edge.target
        )
        if (!exists) {
          state.flow.edges.push(edge)
          state.isDirty = true
        }
      }),

    updateEdge: (edgeId, data) =>
      set((state) => {
        const edge = state.flow.edges.find((e) => e.id === edgeId)
        if (edge) {
          Object.assign(edge, data)
          state.isDirty = true
        }
      }),

    deleteEdges: (edgeIds) =>
      set((state) => {
        const edgeIdSet = new Set(edgeIds)
        state.flow.edges = state.flow.edges.filter((e) => !edgeIdSet.has(e.id))
        state.selectedEdgeIds = state.selectedEdgeIds.filter((id) => !edgeIdSet.has(id))
        state.isDirty = true
      }),

    setSelectedNodes: (nodeIds) =>
      set((state) => {
        state.selectedNodeIds = nodeIds
      }),

    setSelectedEdges: (edgeIds) =>
      set((state) => {
        state.selectedEdgeIds = edgeIds
      }),

    clearSelection: () =>
      set((state) => {
        state.selectedNodeIds = []
        state.selectedEdgeIds = []
      }),

    undo: () =>
      set((state) => {
        if (state.historyIndex > 0) {
          state.historyIndex--
          state.flow = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        }
      }),

    redo: () =>
      set((state) => {
        if (state.historyIndex < state.history.length - 1) {
          state.historyIndex++
          state.flow = JSON.parse(JSON.stringify(state.history[state.historyIndex]))
        }
      }),

    pushHistory: () =>
      set((state) => {
        // Remove any future history if we're not at the end
        state.history = state.history.slice(0, state.historyIndex + 1)
        // Add current state to history
        state.history.push(JSON.parse(JSON.stringify(state.flow)))
        state.historyIndex = state.history.length - 1
        // Limit history size
        if (state.history.length > 50) {
          state.history.shift()
          state.historyIndex--
        }
      }),

    reset: () =>
      set((state) => {
        state.flow = initialFlow
        state.flowId = null
        state.flowName = '新流程'
        state.isReadOnly = false
        state.viewingVersionId = null
        state.selectedNodeIds = []
        state.selectedEdgeIds = []
        state.history = [initialFlow]
        state.historyIndex = 0
        state.isDirty = false
      }),

    setIsDirty: (isDirty) =>
      set((state) => {
        state.isDirty = isDirty
      }),
  }))
)

// Selector hooks
export const useFlow = () => useFlowStore((state) => state.flow)
export const useFlowId = () => useFlowStore((state) => state.flowId)
export const useFlowName = () => useFlowStore((state) => state.flowName)
export const useIsReadOnly = () => useFlowStore((state) => state.isReadOnly)
export const useViewingVersionId = () => useFlowStore((state) => state.viewingVersionId)
export const useNodes = () => useFlowStore((state) => state.flow.nodes)
export const useEdges = () => useFlowStore((state) => state.flow.edges)
export const useSelectedNodes = () => useFlowStore((state) => state.selectedNodeIds)
export const useSelectedEdges = () => useFlowStore((state) => state.selectedEdgeIds)
export const useIsDirty = () => useFlowStore((state) => state.isDirty)
