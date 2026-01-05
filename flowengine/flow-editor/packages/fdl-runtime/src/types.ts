/**
 * FDL Runtime Types
 * Types for flow execution engine
 */

export type ExecutionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error'

export type NodeExecutionState = 'pending' | 'running' | 'paused' | 'completed' | 'error' | 'skipped'

export interface ExecutionContext {
  // Flow variables
  vars: Record<string, unknown>
  // Input arguments
  args: Record<string, unknown>
  // Current execution path
  currentNodeId: string | null
  // Execution history
  history: ExecutionHistoryEntry[]
  // Breakpoints
  breakpoints: Set<string>
  // Execution mode
  mode: 'run' | 'step' | 'stepOver'
}

export interface ExecutionHistoryEntry {
  nodeId: string
  timestamp: number
  state: NodeExecutionState
  input?: unknown
  output?: unknown
  error?: string
  duration?: number
}

export interface NodeExecutionResult {
  success: boolean
  output?: unknown
  error?: string
  nextNodeId?: string | null
  // For conditional nodes
  branch?: 'then' | 'else' | string
}

export interface ExecutionEvent {
  type: 'start' | 'nodeStart' | 'nodeComplete' | 'nodeError' | 'pause' | 'resume' | 'complete' | 'error'
  nodeId?: string
  data?: unknown
  timestamp: number
}

export interface ToolHandler {
  (uri: string, args: Record<string, unknown>, context: ExecutionContext): Promise<unknown>
}

export interface AgentHandler {
  (config: AgentConfig, input: unknown, context: ExecutionContext): Promise<unknown>
}

export interface AgentConfig {
  model?: string
  instructions?: string
  tools?: string[]
  outputFormat?: 'json' | 'markdown' | 'text'
  temperature?: number
}

export interface GuardConfig {
  types: string[]
  action: 'block' | 'warn' | 'redact'
  schema?: object
  expression?: string
}

export interface ApprovalConfig {
  title: string
  description?: string
  timeout?: number
  timeoutAction?: 'approve' | 'reject'
}

export interface ApprovalHandler {
  (config: ApprovalConfig, context: ExecutionContext): Promise<{ approved: boolean; response?: unknown }>
}

export interface MCPConfig {
  server: string
  tool: string
  authType?: string
  authKey?: string
}

export interface MCPHandler {
  (config: MCPConfig, args: Record<string, unknown>, context: ExecutionContext): Promise<unknown>
}

export interface RuntimeConfig {
  // Tool execution handler
  toolHandler?: ToolHandler
  // Agent execution handler
  agentHandler?: AgentHandler
  // Approval handler
  approvalHandler?: ApprovalHandler
  // MCP handler
  mcpHandler?: MCPHandler
  // Event callback
  onEvent?: (event: ExecutionEvent) => void
  // Max execution time (ms)
  timeout?: number
  // Max iterations for loops
  maxIterations?: number
}
