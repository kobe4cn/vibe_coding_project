/**
 * Flow Canvas Component
 * Main visual flow editor using React Flow
 */

import { useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  BackgroundVariant,
  Panel,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { nodeTypes } from '@/components/nodes'
import { useFlowStore } from '@/stores/flowStore'
import { useEditorStore } from '@/stores/editorStore'
import type { FlowNode, FlowEdge, FlowEdgeData, FlowNodeType, FlowNodeData } from '@/types/flow'
import { NODE_COLORS } from '@/types/flow'
import { Toolbar } from './Toolbar'

// Edge styles based on type
const edgeStyles: Record<string, React.CSSProperties> = {
  next: { stroke: '#94a3b8', strokeWidth: 2 },
  then: { stroke: '#22c55e', strokeWidth: 2 },
  else: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5,5' },
  fail: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '2,2' },
}

export function FlowCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  // Flow state
  const { flow, addNode, deleteNodes, deleteEdges, moveNode, pushHistory, setSelectedNodes, setSelectedEdges } =
    useFlowStore()
  const { showGrid, showMinimap, snapToGrid, gridSize, setZoom } = useEditorStore()

  // React Flow state - use generic Node and Edge types
  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges as Edge[])

  // Track if we're syncing to prevent selection reset
  const isSyncingRef = useRef(false)
  const selectedNodeIdsRef = useRef<string[]>([])

  // Sync nodes with store when flow changes - preserve selection
  useEffect(() => {
    isSyncingRef.current = true
    // Update nodes while preserving selection state
    setNodes((currentNodes) => {
      const currentNodeMap = new Map(currentNodes.map(n => [n.id, n]))
      return flow.nodes.map(flowNode => {
        const currentNode = currentNodeMap.get(flowNode.id)
        // Preserve the selected state from current node if it exists
        if (currentNode) {
          return {
            ...flowNode,
            selected: currentNode.selected,
          } as Node
        }
        return flowNode as Node
      })
    })
    // Re-enable selection handling after a tick
    requestAnimationFrame(() => {
      isSyncingRef.current = false
    })
  }, [flow.nodes, setNodes])

  useEffect(() => {
    setEdges(flow.edges as Edge[])
  }, [flow.edges, setEdges])

  // Sync React Flow state with store
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes)

      // Handle position changes
      for (const change of changes) {
        if (change.type === 'position' && 'position' in change && change.position && change.id) {
          moveNode(change.id, change.position)
        }
        if (change.type === 'remove' && change.id) {
          deleteNodes([change.id])
        }
      }
    },
    [onNodesChange, moveNode, deleteNodes]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      onEdgesChange(changes)

      for (const change of changes) {
        if (change.type === 'remove' && change.id) {
          deleteEdges([change.id])
        }
      }
    },
    [onEdgesChange, deleteEdges]
  )

  // Handle new connections
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      // Determine edge type based on source handle
      let edgeType: FlowEdgeData['edgeType'] = 'next'
      if (connection.sourceHandle === 'then') edgeType = 'then'
      else if (connection.sourceHandle === 'else') edgeType = 'else'
      else if (connection.sourceHandle === 'fail') edgeType = 'fail'

      const newEdge: FlowEdge = {
        id: `${connection.source}-${connection.target}-${edgeType}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        data: { edgeType },
        style: edgeStyles[edgeType],
        animated: edgeType === 'fail',
      }

      setEdges((eds) => addEdge(newEdge as Edge, eds))
      useFlowStore.getState().addEdge(newEdge)
      pushHistory()
    },
    [setEdges, pushHistory]
  )

  // Handle node drag end - save history
  const handleNodeDragStop = useCallback(() => {
    pushHistory()
  }, [pushHistory])

  // Handle selection changes - skip during sync to preserve selection
  const handleSelectionChange = useCallback(
    ({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) => {
      // Skip selection updates during sync to prevent losing selection
      if (isSyncingRef.current) return
      setSelectedNodes(nodes.map((n) => n.id))
      setSelectedEdges(edges.map((e) => e.id))
    },
    [setSelectedNodes, setSelectedEdges]
  )

  // Handle drop from palette
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/flownode') as FlowNodeType
      if (!nodeType) return

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!reactFlowBounds) return

      const position = {
        x: event.clientX - reactFlowBounds.left - 90,
        y: event.clientY - reactFlowBounds.top - 30,
      }

      // Snap to grid if enabled
      if (snapToGrid) {
        position.x = Math.round(position.x / gridSize) * gridSize
        position.y = Math.round(position.y / gridSize) * gridSize
      }

      const newNode: FlowNode = {
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: createDefaultNodeData(nodeType),
      }

      addNode(newNode)
      setNodes((nds) => [...nds, newNode as Node])
      pushHistory()
    },
    [addNode, setNodes, pushHistory, snapToGrid, gridSize]
  )

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  return (
    <div ref={reactFlowWrapper} className="flex-1 h-full" onDrop={handleDrop} onDragOver={handleDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeDragStop={handleNodeDragStop}
        onSelectionChange={handleSelectionChange}
        nodeTypes={nodeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        onMoveEnd={(_, viewport) => setZoom(viewport.zoom)}
        proOptions={{ hideAttribution: true }}
        connectionRadius={30}
        connectOnClick={true}
        defaultEdgeOptions={{
          style: { stroke: '#94a3b8', strokeWidth: 2 },
          type: 'smoothstep',
        }}
      >
        {showGrid && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={gridSize}
            size={1}
            color="#d1d5db"
          />
        )}

        <Controls position="bottom-left" />

        {showMinimap && (
          <MiniMap
            position="bottom-right"
            nodeColor={(node) => NODE_COLORS[node.type as FlowNodeType] || '#888'}
            maskColor="rgba(255, 255, 255, 0.8)"
            style={{ width: 150, height: 100 }}
          />
        )}

        <Panel position="top-left">
          <Toolbar />
        </Panel>
      </ReactFlow>
    </div>
  )
}

// Create default node data based on type
function createDefaultNodeData(nodeType: FlowNodeType): FlowNodeData {
  const baseData = {
    nodeType,
    label: getDefaultLabel(nodeType),
  }

  switch (nodeType) {
    case 'exec':
      return { ...baseData, nodeType: 'exec' as const, exec: '' }
    case 'mapping':
      return { ...baseData, nodeType: 'mapping' as const, with: '' }
    case 'condition':
      return { ...baseData, nodeType: 'condition' as const, when: '' }
    case 'switch':
      return { ...baseData, nodeType: 'switch' as const, cases: [] }
    case 'delay':
      return { ...baseData, nodeType: 'delay' as const, wait: '1s' }
    case 'each':
      return { ...baseData, nodeType: 'each' as const, each: '' }
    case 'loop':
      return { ...baseData, nodeType: 'loop' as const, vars: '', when: '' }
    case 'agent':
      return { ...baseData, nodeType: 'agent' as const, model: 'gpt-4o' }
    case 'guard':
      return { ...baseData, nodeType: 'guard' as const, guardTypes: ['pii'], action: 'block' as const }
    case 'approval':
      return { ...baseData, nodeType: 'approval' as const, title: '请审批' }
    case 'mcp':
      return { ...baseData, nodeType: 'mcp' as const, server: '', tool: '' }
    case 'handoff':
      return { ...baseData, nodeType: 'handoff' as const, target: '' }
    default:
      return baseData as FlowNodeData
  }
}

function getDefaultLabel(nodeType: FlowNodeType): string {
  const labels: Record<FlowNodeType, string> = {
    exec: '新工具调用',
    mapping: '新数据映射',
    condition: '新条件判断',
    switch: '新多分支',
    delay: '新延迟',
    each: '新遍历',
    loop: '新循环',
    agent: '新 Agent',
    guard: '新安全校验',
    approval: '新审批',
    mcp: '新 MCP 调用',
    handoff: '新移交',
  }
  return labels[nodeType]
}
