/**
 * FDL (Flow Definition Language) Type Definitions
 */

// Primitive types supported by FDL
export type FDLPrimitiveType =
  | 'bool'
  | 'int'
  | 'long'
  | 'double'
  | 'decimal'
  | 'string'
  | 'date'
  | 'any'

// Type definition with optional nullable and array markers
export interface FDLType {
  base: FDLPrimitiveType | string // Can be primitive or custom type name
  nullable?: boolean // Marked with ?
  isArray?: boolean // Marked with []
  isMap?: boolean // map<T> type
  mapValueType?: FDLType // Type parameter for map
}

// Parameter definition
export interface FDLParameter {
  name: string
  type: FDLType
  defaultValue?: string // GML expression for default value
  description?: string // Comment
}

// Custom type definition in args.defs
export interface FDLTypeDef {
  name: string
  fields: FDLParameter[]
}

// Flow arguments (input/output/defs)
export interface FDLArgs {
  in?: FDLParameter[]
  out?: FDLParameter[] | FDLType // Can be simple type or full definition
  defs?: FDLTypeDef[]
}

// Case branch in switch node
export interface FDLCaseBranch {
  when: string // GML boolean expression
  then: string // Target node id
}

// Node types - derived from node structure
export type FDLNodeType =
  | 'exec' // Has exec field
  | 'mapping' // Has with but no exec
  | 'condition' // Has when + then
  | 'switch' // Has case array
  | 'delay' // Has wait field
  | 'each' // Has each field
  | 'loop' // Has vars + when + node
  // Agent extension nodes
  | 'agent' // Has agent field
  | 'guard' // Has guard field
  | 'approval' // Has approval field
  | 'mcp' // Has mcp field
  | 'handoff' // Has handoff field

// Base node interface
export interface FDLNodeBase {
  id: string
  name?: string
  desp?: string
  only?: string // GML boolean expression - conditional execution
  next?: string[] // Successor node ids
  fail?: string // Error handling target node
}

// Tool execution node
export interface FDLExecNode extends FDLNodeBase {
  type: 'exec'
  exec: string // URI format: <tool-type>://<tool-code>?[options]
  args?: string // GML expression for arguments
  with?: string // GML expression for result transformation
  sets?: string // GML expression for variable updates
}

// Data mapping node
export interface FDLMappingNode extends FDLNodeBase {
  type: 'mapping'
  with: string // GML expression for output
  sets?: string
}

// Condition node (if-else)
export interface FDLConditionNode extends FDLNodeBase {
  type: 'condition'
  when: string // GML boolean expression
  then: string // Target node id when true
  else?: string // Target node id when false
}

// Switch node (multi-branch)
export interface FDLSwitchNode extends FDLNodeBase {
  type: 'switch'
  case: FDLCaseBranch[]
  else?: string // Default target
}

// Delay node
export interface FDLDelayNode extends FDLNodeBase {
  type: 'delay'
  wait: string | number // Duration: '3s', '5m', '1h' or milliseconds
}

// Each node (collection iteration)
export interface FDLEachNode extends FDLNodeBase {
  type: 'each'
  each: string // Format: sourceVar => itemAlias, indexAlias
  vars?: string // GML expression for initial variables
  node: Record<string, FDLNodeRaw> // Sub-flow nodes
  with?: string // Output expression
}

// Loop node (conditional iteration)
export interface FDLLoopNode extends FDLNodeBase {
  type: 'loop'
  vars: string // GML expression for initial variables
  when: string // GML boolean expression - continue condition
  node: Record<string, FDLNodeRaw> // Sub-flow nodes
  with?: string // Output expression
}

// Agent node (LLM-driven)
export interface FDLAgentConfig {
  model?: string
  instructions?: string
  tools?: string[]
  output_format?: 'json' | 'markdown' | 'text'
  temperature?: number
}

export interface FDLAgentNode extends FDLNodeBase {
  type: 'agent'
  agent: FDLAgentConfig
  args?: string
  with?: string
}

// Guardrail node (security validation)
export interface FDLGuardConfig {
  type: ('pii' | 'jailbreak' | 'moderation' | 'hallucination' | 'schema' | 'custom')[]
  action: 'block' | 'warn' | 'redact'
  on_fail?: string
  schema?: object // For schema type
  expression?: string // For custom type - GML expression
}

export interface FDLGuardNode extends FDLNodeBase {
  type: 'guard'
  guard: FDLGuardConfig
  args?: string
  then?: string
  else?: string
}

// Approval node (human-in-the-loop)
export interface FDLApprovalOption {
  id: string
  label: string
}

export interface FDLApprovalConfig {
  title: string
  description?: string
  options?: FDLApprovalOption[]
  timeout?: string
  timeout_action?: 'approve' | 'reject'
}

export interface FDLApprovalNode extends FDLNodeBase {
  type: 'approval'
  approval: FDLApprovalConfig
  then?: string
  else?: string
}

// MCP node (Model Context Protocol)
export interface FDLMCPConfig {
  server: string
  tool: string
  auth?: {
    type: string
    key?: string
  }
}

export interface FDLMCPNode extends FDLNodeBase {
  type: 'mcp'
  mcp: FDLMCPConfig
  args?: string
  with?: string
}

// Handoff node (agent delegation)
export interface FDLHandoffConfig {
  target: string
  context?: string[]
  resume_on?: 'completed' | 'error' | 'any'
}

export interface FDLHandoffNode extends FDLNodeBase {
  type: 'handoff'
  handoff: FDLHandoffConfig
  args?: string
  with?: string
}

// Union type for all node types
export type FDLNode =
  | FDLExecNode
  | FDLMappingNode
  | FDLConditionNode
  | FDLSwitchNode
  | FDLDelayNode
  | FDLEachNode
  | FDLLoopNode
  | FDLAgentNode
  | FDLGuardNode
  | FDLApprovalNode
  | FDLMCPNode
  | FDLHandoffNode

// Raw node as parsed from YAML (before type inference)
export interface FDLNodeRaw {
  name?: string
  desp?: string
  exec?: string
  args?: string
  with?: string
  sets?: string
  only?: string
  next?: string
  fail?: string
  when?: string
  then?: string
  else?: string
  case?: FDLCaseBranch[]
  wait?: string | number
  each?: string
  vars?: string
  node?: Record<string, FDLNodeRaw>
  // Agent extension fields
  agent?: FDLAgentConfig
  guard?: FDLGuardConfig
  approval?: FDLApprovalConfig
  mcp?: FDLMCPConfig
  handoff?: FDLHandoffConfig
}

// MCP Server configuration
export interface FDLMCPServer {
  id: string
  url: string
  name?: string
}

// Flow metadata
export interface FDLFlowMeta {
  name: string
  desp?: string
  mcp_servers?: FDLMCPServer[]
}

// Complete flow definition
export interface FDLFlow {
  meta: FDLFlowMeta
  args?: FDLArgs
  vars?: string // Global variables (GML expression)
  nodes: FDLNode[]
}

// Parsing error
export interface FDLParseError {
  message: string
  line?: number
  column?: number
  nodeId?: string
}

// Parse result
export interface FDLParseResult {
  success: boolean
  flow?: FDLFlow
  errors: FDLParseError[]
}
