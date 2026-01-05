/**
 * Flow Store Tests
 * Unit tests for the flow editor state management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFlowStore } from './flowStore'
import type { FlowModel, FlowNode, FlowEdge } from '@/types/flow'

// Helper to create test flow model
function createTestFlow(name: string = 'Test Flow'): FlowModel {
  return {
    meta: { name, description: 'Test' },
    inputs: [],
    outputs: [],
    nodes: [],
    edges: [],
  }
}

// Helper to create test node
function createTestNode(id: string = 'test-node'): FlowNode {
  return {
    id,
    type: 'mapping',
    position: { x: 100, y: 100 },
    data: { label: 'Test Node' },
  }
}

// Helper to create test edge
function createTestEdge(
  source: string,
  target: string,
  id: string = 'test-edge'
): FlowEdge {
  return { id, source, target }
}

describe('useFlowStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useFlowStore.getState().reset()
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useFlowStore.getState()

      expect(state.flow.meta.name).toBe('新流程')
      expect(state.flow.nodes).toHaveLength(0)
      expect(state.flow.edges).toHaveLength(0)
      expect(state.flowId).toBeNull()
      expect(state.flowName).toBe('新流程')
      expect(state.isReadOnly).toBe(false)
      expect(state.viewingVersionId).toBeNull()
      expect(state.selectedNodeIds).toHaveLength(0)
      expect(state.selectedEdgeIds).toHaveLength(0)
      expect(state.isDirty).toBe(false)
    })
  })

  describe('Flow Operations', () => {
    describe('setFlow', () => {
      it('should set the flow and reset history', () => {
        const testFlow = createTestFlow('New Flow')
        useFlowStore.getState().setFlow(testFlow)

        const state = useFlowStore.getState()
        expect(state.flow.meta.name).toBe('New Flow')
        expect(state.isDirty).toBe(false)
        expect(state.history).toHaveLength(1)
        expect(state.historyIndex).toBe(0)
      })
    })

    describe('loadFlow', () => {
      it('should load a flow with all metadata', () => {
        const testFlow = createTestFlow('Loaded Flow')
        useFlowStore.getState().loadFlow('flow-123', testFlow, 'Loaded Flow')

        const state = useFlowStore.getState()
        expect(state.flowId).toBe('flow-123')
        expect(state.flowName).toBe('Loaded Flow')
        expect(state.flow.meta.name).toBe('Loaded Flow')
        expect(state.isDirty).toBe(false)
        expect(state.isReadOnly).toBe(false)
        expect(state.selectedNodeIds).toHaveLength(0)
      })
    })

    describe('setReadOnly', () => {
      it('should set read-only mode', () => {
        useFlowStore.getState().setReadOnly(true, 'version-1')

        const state = useFlowStore.getState()
        expect(state.isReadOnly).toBe(true)
        expect(state.viewingVersionId).toBe('version-1')
      })

      it('should clear read-only mode', () => {
        useFlowStore.getState().setReadOnly(true, 'version-1')
        useFlowStore.getState().setReadOnly(false)

        const state = useFlowStore.getState()
        expect(state.isReadOnly).toBe(false)
        expect(state.viewingVersionId).toBeNull()
      })
    })

    describe('updateMeta', () => {
      it('should update flow metadata', () => {
        useFlowStore.getState().updateMeta({ name: 'Updated', description: 'New desc' })

        const state = useFlowStore.getState()
        expect(state.flow.meta.name).toBe('Updated')
        expect(state.flow.meta.description).toBe('New desc')
        expect(state.isDirty).toBe(true)
      })
    })
  })

  describe('Node Operations', () => {
    describe('addNode', () => {
      it('should add a node', () => {
        const node = createTestNode('node-1')
        useFlowStore.getState().addNode(node)

        const state = useFlowStore.getState()
        expect(state.flow.nodes).toHaveLength(1)
        expect(state.flow.nodes[0].id).toBe('node-1')
        expect(state.isDirty).toBe(true)
      })

      it('should generate ID if not provided', () => {
        const node = { ...createTestNode(), id: '' }
        useFlowStore.getState().addNode(node)

        const state = useFlowStore.getState()
        expect(state.flow.nodes[0].id).toBeTruthy()
      })
    })

    describe('updateNode', () => {
      it('should update node data', () => {
        useFlowStore.getState().addNode(createTestNode('node-1'))
        useFlowStore.getState().updateNode('node-1', { label: 'Updated Label' })

        const state = useFlowStore.getState()
        expect(state.flow.nodes[0].data.label).toBe('Updated Label')
        expect(state.isDirty).toBe(true)
      })

      it('should not update non-existent node', () => {
        useFlowStore.getState().updateNode('non-existent', { label: 'Test' })

        const state = useFlowStore.getState()
        expect(state.flow.nodes).toHaveLength(0)
      })
    })

    describe('deleteNodes', () => {
      it('should delete nodes', () => {
        useFlowStore.getState().addNode(createTestNode('node-1'))
        useFlowStore.getState().addNode(createTestNode('node-2'))
        useFlowStore.getState().deleteNodes(['node-1'])

        const state = useFlowStore.getState()
        expect(state.flow.nodes).toHaveLength(1)
        expect(state.flow.nodes[0].id).toBe('node-2')
      })

      it('should delete connected edges when deleting nodes', () => {
        useFlowStore.getState().addNode(createTestNode('node-1'))
        useFlowStore.getState().addNode(createTestNode('node-2'))
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2'))

        useFlowStore.getState().deleteNodes(['node-1'])

        const state = useFlowStore.getState()
        expect(state.flow.edges).toHaveLength(0)
      })

      it('should clear selection for deleted nodes', () => {
        useFlowStore.getState().addNode(createTestNode('node-1'))
        useFlowStore.getState().setSelectedNodes(['node-1'])
        useFlowStore.getState().deleteNodes(['node-1'])

        const state = useFlowStore.getState()
        expect(state.selectedNodeIds).toHaveLength(0)
      })
    })

    describe('moveNode', () => {
      it('should move a node', () => {
        useFlowStore.getState().addNode(createTestNode('node-1'))
        useFlowStore.getState().moveNode('node-1', { x: 200, y: 300 })

        const state = useFlowStore.getState()
        expect(state.flow.nodes[0].position).toEqual({ x: 200, y: 300 })
        expect(state.isDirty).toBe(true)
      })
    })
  })

  describe('Edge Operations', () => {
    beforeEach(() => {
      useFlowStore.getState().addNode(createTestNode('node-1'))
      useFlowStore.getState().addNode(createTestNode('node-2'))
    })

    describe('addEdge', () => {
      it('should add an edge', () => {
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2'))

        const state = useFlowStore.getState()
        expect(state.flow.edges).toHaveLength(1)
        expect(state.flow.edges[0].source).toBe('node-1')
        expect(state.flow.edges[0].target).toBe('node-2')
        expect(state.isDirty).toBe(true)
      })

      it('should not add duplicate edges', () => {
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2', 'edge-1'))
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2', 'edge-2'))

        const state = useFlowStore.getState()
        expect(state.flow.edges).toHaveLength(1)
      })

      it('should generate ID if not provided', () => {
        const edge = { ...createTestEdge('node-1', 'node-2'), id: '' }
        useFlowStore.getState().addEdge(edge)

        const state = useFlowStore.getState()
        expect(state.flow.edges[0].id).toBeTruthy()
      })
    })

    describe('deleteEdges', () => {
      it('should delete edges', () => {
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2', 'edge-1'))
        useFlowStore.getState().deleteEdges(['edge-1'])

        const state = useFlowStore.getState()
        expect(state.flow.edges).toHaveLength(0)
      })

      it('should clear selection for deleted edges', () => {
        useFlowStore.getState().addEdge(createTestEdge('node-1', 'node-2', 'edge-1'))
        useFlowStore.getState().setSelectedEdges(['edge-1'])
        useFlowStore.getState().deleteEdges(['edge-1'])

        const state = useFlowStore.getState()
        expect(state.selectedEdgeIds).toHaveLength(0)
      })
    })
  })

  describe('Selection', () => {
    beforeEach(() => {
      useFlowStore.getState().addNode(createTestNode('node-1'))
      useFlowStore.getState().addNode(createTestNode('node-2'))
    })

    describe('setSelectedNodes', () => {
      it('should set selected nodes', () => {
        useFlowStore.getState().setSelectedNodes(['node-1', 'node-2'])

        const state = useFlowStore.getState()
        expect(state.selectedNodeIds).toEqual(['node-1', 'node-2'])
      })
    })

    describe('clearSelection', () => {
      it('should clear all selection', () => {
        useFlowStore.getState().setSelectedNodes(['node-1'])
        useFlowStore.getState().setSelectedEdges(['edge-1'])
        useFlowStore.getState().clearSelection()

        const state = useFlowStore.getState()
        expect(state.selectedNodeIds).toHaveLength(0)
        expect(state.selectedEdgeIds).toHaveLength(0)
      })
    })
  })

  describe('History (Undo/Redo)', () => {
    it('should push to history', () => {
      useFlowStore.getState().addNode(createTestNode('node-1'))
      useFlowStore.getState().pushHistory()

      const state = useFlowStore.getState()
      expect(state.history).toHaveLength(2)
      expect(state.historyIndex).toBe(1)
    })

    it('should undo changes', () => {
      useFlowStore.getState().addNode(createTestNode('node-1'))
      useFlowStore.getState().pushHistory()
      useFlowStore.getState().undo()

      const state = useFlowStore.getState()
      expect(state.flow.nodes).toHaveLength(0)
      expect(state.historyIndex).toBe(0)
    })

    it('should redo changes', () => {
      useFlowStore.getState().addNode(createTestNode('node-1'))
      useFlowStore.getState().pushHistory()
      useFlowStore.getState().undo()
      useFlowStore.getState().redo()

      const state = useFlowStore.getState()
      expect(state.flow.nodes).toHaveLength(1)
      expect(state.historyIndex).toBe(1)
    })

    it('should not undo past the beginning', () => {
      useFlowStore.getState().undo()
      useFlowStore.getState().undo()

      const state = useFlowStore.getState()
      expect(state.historyIndex).toBe(0)
    })

    it('should limit history size', () => {
      for (let i = 0; i < 60; i++) {
        useFlowStore.getState().addNode(createTestNode(`node-${i}`))
        useFlowStore.getState().pushHistory()
      }

      const state = useFlowStore.getState()
      expect(state.history.length).toBeLessThanOrEqual(50)
    })
  })

  describe('Dirty Flag', () => {
    it('should set dirty flag on node add', () => {
      useFlowStore.getState().addNode(createTestNode())
      expect(useFlowStore.getState().isDirty).toBe(true)
    })

    it('should clear dirty flag on setFlow', () => {
      useFlowStore.getState().addNode(createTestNode())
      useFlowStore.getState().setFlow(createTestFlow())
      expect(useFlowStore.getState().isDirty).toBe(false)
    })

    it('should allow manual dirty flag control', () => {
      useFlowStore.getState().setIsDirty(true)
      expect(useFlowStore.getState().isDirty).toBe(true)

      useFlowStore.getState().setIsDirty(false)
      expect(useFlowStore.getState().isDirty).toBe(false)
    })
  })

  describe('Reset', () => {
    it('should reset to initial state', () => {
      // Make some changes
      useFlowStore.getState().loadFlow('flow-123', createTestFlow('Test'), 'Test')
      useFlowStore.getState().addNode(createTestNode())
      useFlowStore.getState().setReadOnly(true, 'version-1')

      // Reset
      useFlowStore.getState().reset()

      const state = useFlowStore.getState()
      expect(state.flowId).toBeNull()
      expect(state.flowName).toBe('新流程')
      expect(state.flow.nodes).toHaveLength(0)
      expect(state.isReadOnly).toBe(false)
      expect(state.isDirty).toBe(false)
    })
  })
})
