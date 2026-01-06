/**
 * Flow Editor Type Definitions
 * Core types for the visual flow editor
 */

import type { Node, Edge } from '@xyflow/react'

// Node execution status (for debugger)
export type NodeExecutionStatus =
  | 'idle' // Not executed
  | 'pending' // Waiting to execute
  | 'running' // Currently executing
  | 'paused' // Paused at breakpoint
  | 'completed' // Successfully completed
  | 'error' // Execution failed

// FDL Node types - matching fdl-parser types
export type FlowNodeType =
  | 'start'
  | 'exec'
  | 'mapping'
  | 'condition'
  | 'switch'
  | 'delay'
  | 'each'
  | 'loop'
  | 'agent'
  | 'guard'
  | 'approval'
  | 'mcp'
  | 'handoff'

// Edge types for different flow paths
export type FlowEdgeType = 'next' | 'then' | 'else' | 'fail'

// Base node data shared by all node types
// Using index signature for React Flow v12 compatibility
export interface BaseNodeData {
  [key: string]: unknown
  nodeType: FlowNodeType
  label: string
  description?: string
  only?: string // GML condition for conditional execution
  executionStatus?: NodeExecutionStatus
  hasBreakpoint?: boolean
}

// Start node parameter definition
export interface StartParameterDef {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  defaultValue?: string
  description?: string
}

// Start node data - flow entry point
export interface StartNodeData extends BaseNodeData {
  nodeType: 'start'
  parameters: StartParameterDef[]
}

// Exec node data
export interface ExecNodeData extends BaseNodeData {
  nodeType: 'exec'
  exec: string // URI
  args?: string
  with?: string
  sets?: string
}

// Mapping node data
export interface MappingNodeData extends BaseNodeData {
  nodeType: 'mapping'
  with: string
  sets?: string
}

// Condition node data
export interface ConditionNodeData extends BaseNodeData {
  nodeType: 'condition'
  when: string
}

// Switch node data
export interface SwitchNodeData extends BaseNodeData {
  nodeType: 'switch'
  cases: Array<{ when: string; then: string }>
}

// Delay node data
export interface DelayNodeData extends BaseNodeData {
  nodeType: 'delay'
  wait: string | number
}

// Each node data (collection iteration)
export interface EachNodeData extends BaseNodeData {
  nodeType: 'each'
  each: string // Format: source => item, index
  vars?: string
  subFlowNodes?: FlowNode[]
  subFlowEdges?: FlowEdge[]
  outputWith?: string
}

// Loop node data (conditional iteration)
export interface LoopNodeData extends BaseNodeData {
  nodeType: 'loop'
  vars: string
  when: string
  subFlowNodes?: FlowNode[]
  subFlowEdges?: FlowEdge[]
  outputWith?: string
}

// Agent node data
export interface AgentNodeData extends BaseNodeData {
  nodeType: 'agent'
  model?: string
  instructions?: string
  tools?: string[]
  outputFormat?: 'json' | 'markdown' | 'text'
  temperature?: number
  args?: string
  with?: string
}

// Guard node data
export interface GuardNodeData extends BaseNodeData {
  nodeType: 'guard'
  guardTypes: ('pii' | 'jailbreak' | 'moderation' | 'hallucination' | 'schema' | 'custom')[]
  action: 'block' | 'warn' | 'redact'
  schema?: object
  customExpression?: string
  args?: string
}

// Approval node data
export interface ApprovalNodeData extends BaseNodeData {
  nodeType: 'approval'
  title: string
  approvalDescription?: string
  options?: Array<{ id: string; label: string }>
  timeout?: string
  timeoutAction?: 'approve' | 'reject'
}

// MCP node data
export interface MCPNodeData extends BaseNodeData {
  nodeType: 'mcp'
  server: string
  tool: string
  authType?: string
  authKey?: string
  args?: string
  with?: string
}

// Handoff node data
export interface HandoffNodeData extends BaseNodeData {
  nodeType: 'handoff'
  target: string
  context?: string[]
  resumeOn?: 'completed' | 'error' | 'any'
  args?: string
  with?: string
}

// Union type for all node data
export type FlowNodeData =
  | StartNodeData
  | ExecNodeData
  | MappingNodeData
  | ConditionNodeData
  | SwitchNodeData
  | DelayNodeData
  | EachNodeData
  | LoopNodeData
  | AgentNodeData
  | GuardNodeData
  | ApprovalNodeData
  | MCPNodeData
  | HandoffNodeData

// React Flow node type
export type FlowNode = Node<FlowNodeData, FlowNodeType>

// Edge data
// Using index signature for React Flow v12 compatibility
export interface FlowEdgeData {
  [key: string]: unknown
  edgeType: FlowEdgeType
  label?: string
  caseIndex?: number // For switch node case edges
}

// React Flow edge type
export type FlowEdge = Edge<FlowEdgeData>

// Parameter definition
export interface FlowParameter {
  name: string
  type: string
  nullable?: boolean
  isArray?: boolean
  defaultValue?: string
  description?: string
}

// Type definition
export interface FlowTypeDef {
  name: string
  fields: FlowParameter[]
}

// MCP Server configuration
export interface FlowMCPServer {
  id: string
  url: string
  name?: string
}

// Flow metadata
export interface FlowMeta {
  name: string
  description?: string
  mcpServers?: FlowMCPServer[]
}

// Flow arguments
export interface FlowArgs {
  inputs?: FlowParameter[]
  outputs?: FlowParameter[] | { type: string; nullable?: boolean; isArray?: boolean }
  defs?: FlowTypeDef[]
  /** 入口节点 ID 列表 - 从 Start 节点连接到这些节点 */
  entryNodeIds?: string[]
}

// Complete flow model
export interface FlowModel {
  meta: FlowMeta
  args?: FlowArgs
  vars?: string
  nodes: FlowNode[]
  edges: FlowEdge[]
}

// Node color configuration - Material Design 3 Palette
export const NODE_COLORS: Record<FlowNodeType, string> = {
  start: '#22c55e',     // Green - flow entry point
  exec: '#b4a7ff',      // Primary variant - actions
  mapping: '#c9b6ff',   // Secondary - data transformation
  condition: '#ffb77c', // Tertiary warm - conditional logic
  switch: '#ffa570',    // Tertiary warm - multi-branch
  delay: '#a8c7fa',     // Primary light - timing/wait
  each: '#7dd3fc',      // Tertiary cool - collection iteration
  loop: '#5eead4',      // Tertiary teal - conditional loops
  agent: '#f9a8d4',     // Tertiary pink - AI agents
  guard: '#fca5a5',     // Error variant - security
  approval: '#86efac',  // Success - human approval
  mcp: '#93c5fd',       // Info - external tools
  handoff: '#c4b5fd',   // Secondary variant - agent handoff
}

// Node labels for palette
export const NODE_LABELS: Record<FlowNodeType, string> = {
  start: '开始节点',
  exec: '工具调用',
  mapping: '数据映射',
  condition: '条件跳转',
  switch: '多分支跳转',
  delay: '延迟执行',
  each: '集合遍历',
  loop: '条件循环',
  agent: 'AI Agent',
  guard: '安全校验',
  approval: '人工审批',
  mcp: 'MCP 工具',
  handoff: 'Agent 移交',
}

// Node categories for palette
export const NODE_CATEGORIES = {
  entry: ['start'] as FlowNodeType[],
  basic: ['exec', 'mapping'] as FlowNodeType[],
  control: ['condition', 'switch', 'delay'] as FlowNodeType[],
  loop: ['each', 'loop'] as FlowNodeType[],
  agent: ['agent', 'guard', 'approval', 'mcp', 'handoff'] as FlowNodeType[],
}

export const NODE_CATEGORY_LABELS: Record<keyof typeof NODE_CATEGORIES, string> = {
  entry: '流程入口',
  basic: '基础节点',
  control: '流程控制',
  loop: '循环遍历',
  agent: 'Agent 能力',
}
