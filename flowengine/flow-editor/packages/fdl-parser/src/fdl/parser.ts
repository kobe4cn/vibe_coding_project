/**
 * FDL YAML Parser
 * Parses FDL YAML content into typed Flow model
 */

import yaml from 'js-yaml'
import type {
  FDLFlow,
  FDLFlowMeta,
  FDLArgs,
  FDLParameter,
  FDLType,
  FDLTypeDef,
  FDLNode,
  FDLNodeRaw,
  FDLNodeType,
  FDLParseResult,
  FDLParseError,
  FDLCaseBranch,
} from './types'

// Raw YAML structure
interface RawFlow {
  flow: {
    name: string
    desp?: string
    mcp_servers?: Array<{ id: string; url: string; name?: string }>
    args?: {
      in?: Record<string, string>
      out?: Record<string, string> | string
      defs?: Record<string, Record<string, string>>
    }
    vars?: string
    node?: Record<string, FDLNodeRaw>
  }
}

/**
 * Parse type string into FDLType
 * Supports: string, string?, string[], string[]?, map<string>
 */
export function parseTypeString(typeStr: string): FDLType {
  let str = typeStr.trim()
  let nullable = false
  let isArray = false
  let isMap = false
  let mapValueType: FDLType | undefined

  // Check for map<T> pattern
  const mapMatch = str.match(/^map<(.+)>(\?)?$/)
  if (mapMatch) {
    isMap = true
    nullable = !!mapMatch[2]
    mapValueType = parseTypeString(mapMatch[1])
    return {
      base: 'map',
      nullable,
      isMap,
      mapValueType,
    }
  }

  // Check for array suffix []
  if (str.endsWith('[]?')) {
    isArray = true
    nullable = true
    str = str.slice(0, -3)
  } else if (str.endsWith('[]')) {
    isArray = true
    str = str.slice(0, -2)
  } else if (str.endsWith('?')) {
    nullable = true
    str = str.slice(0, -1)
  }

  return {
    base: str,
    nullable,
    isArray,
  }
}

/**
 * Parse parameter definition
 * Format: "type" or "type = defaultValue"
 */
function parseParameter(name: string, value: string): FDLParameter {
  const parts = value.split('=').map((p) => p.trim())
  const typeStr = parts[0]
  const defaultValue = parts.length > 1 ? parts.slice(1).join('=').trim() : undefined

  // Extract comment if present (after #)
  let description: string | undefined
  let cleanType = typeStr
  const commentIdx = typeStr.indexOf('#')
  if (commentIdx !== -1) {
    description = typeStr.slice(commentIdx + 1).trim()
    cleanType = typeStr.slice(0, commentIdx).trim()
  }

  return {
    name,
    type: parseTypeString(cleanType),
    defaultValue,
    description,
  }
}

/**
 * Parse args.in / args.out parameters
 */
function parseParameters(params: Record<string, string>): FDLParameter[] {
  return Object.entries(params).map(([name, value]) => parseParameter(name, value))
}

/**
 * Parse args.defs type definitions
 */
function parseTypeDefs(defs: Record<string, Record<string, string>>): FDLTypeDef[] {
  return Object.entries(defs).map(([name, fields]) => ({
    name,
    fields: parseParameters(fields),
  }))
}

/**
 * Parse args section
 */
function parseArgs(args: RawFlow['flow']['args']): FDLArgs | undefined {
  if (!args) return undefined

  const result: FDLArgs = {}

  if (args.in) {
    result.in = parseParameters(args.in)
  }

  if (args.out) {
    if (typeof args.out === 'string') {
      // Simple output type like "string" or "Order[]"
      result.out = parseTypeString(args.out)
    } else {
      result.out = parseParameters(args.out)
    }
  }

  if (args.defs) {
    result.defs = parseTypeDefs(args.defs)
  }

  return result
}

/**
 * Determine node type from raw node structure
 */
function inferNodeType(raw: FDLNodeRaw): FDLNodeType {
  // Agent extension nodes
  if (raw.agent) return 'agent'
  if (raw.guard) return 'guard'
  if (raw.approval) return 'approval'
  if (raw.mcp) return 'mcp'
  if (raw.handoff) return 'handoff'

  // FDL native nodes
  if (raw.exec) return 'exec'
  if (raw.wait !== undefined) return 'delay'
  if (raw.each) return 'each'
  if (raw.vars && raw.when && raw.node) return 'loop'
  if (raw.case && Array.isArray(raw.case)) return 'switch'
  if (raw.when && raw.then) return 'condition'
  if (raw.with) return 'mapping'

  // Default to mapping if only has name
  return 'mapping'
}

/**
 * Parse next field - can be single id or comma-separated list
 */
function parseNextField(next: string | undefined): string[] | undefined {
  if (!next) return undefined
  return next
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Parse a single node
 */
function parseNode(id: string, raw: FDLNodeRaw, errors: FDLParseError[]): FDLNode | null {
  const nodeType = inferNodeType(raw)

  const base = {
    id,
    name: raw.name,
    desp: raw.desp,
    only: raw.only,
    next: parseNextField(raw.next),
    fail: raw.fail,
  }

  try {
    switch (nodeType) {
      case 'exec':
        return {
          ...base,
          type: 'exec',
          exec: raw.exec!,
          args: raw.args,
          with: raw.with,
          sets: raw.sets,
        }

      case 'mapping':
        return {
          ...base,
          type: 'mapping',
          with: raw.with || '',
          sets: raw.sets,
        }

      case 'condition':
        return {
          ...base,
          type: 'condition',
          when: raw.when!,
          then: raw.then!,
          else: raw.else,
        }

      case 'switch':
        return {
          ...base,
          type: 'switch',
          case: raw.case as FDLCaseBranch[],
          else: raw.else,
        }

      case 'delay':
        return {
          ...base,
          type: 'delay',
          wait: raw.wait!,
        }

      case 'each': {
        const subNodes = raw.node ? parseNodes(raw.node, errors) : []
        return {
          ...base,
          type: 'each',
          each: raw.each!,
          vars: raw.vars,
          node: raw.node || {},
          with: raw.with,
        }
      }

      case 'loop': {
        const subNodes = raw.node ? parseNodes(raw.node, errors) : []
        return {
          ...base,
          type: 'loop',
          vars: raw.vars!,
          when: raw.when!,
          node: raw.node || {},
          with: raw.with,
        }
      }

      case 'agent':
        return {
          ...base,
          type: 'agent',
          agent: raw.agent!,
          args: raw.args,
          with: raw.with,
        }

      case 'guard':
        return {
          ...base,
          type: 'guard',
          guard: raw.guard!,
          args: raw.args,
          then: raw.then,
          else: raw.else,
        }

      case 'approval':
        return {
          ...base,
          type: 'approval',
          approval: raw.approval!,
          then: raw.then,
          else: raw.else,
        }

      case 'mcp':
        return {
          ...base,
          type: 'mcp',
          mcp: raw.mcp!,
          args: raw.args,
          with: raw.with,
        }

      case 'handoff':
        return {
          ...base,
          type: 'handoff',
          handoff: raw.handoff!,
          args: raw.args,
          with: raw.with,
        }

      default:
        errors.push({
          message: `Unknown node type for node: ${id}`,
          nodeId: id,
        })
        return null
    }
  } catch (e) {
    errors.push({
      message: `Error parsing node ${id}: ${e}`,
      nodeId: id,
    })
    return null
  }
}

/**
 * Parse all nodes in a node block
 */
function parseNodes(nodes: Record<string, FDLNodeRaw>, errors: FDLParseError[]): FDLNode[] {
  const result: FDLNode[] = []

  for (const [id, raw] of Object.entries(nodes)) {
    const node = parseNode(id, raw, errors)
    if (node) {
      result.push(node)
    }
  }

  return result
}

/**
 * Main parser function
 * Parses FDL YAML string into FDLFlow model
 */
export function parseFDL(yamlContent: string): FDLParseResult {
  const errors: FDLParseError[] = []

  try {
    const raw = yaml.load(yamlContent) as RawFlow

    if (!raw || !raw.flow) {
      return {
        success: false,
        errors: [{ message: 'Invalid FDL: missing flow root element' }],
      }
    }

    const flow = raw.flow

    // Parse flow metadata
    const meta: FDLFlowMeta = {
      name: flow.name || 'Untitled Flow',
      desp: flow.desp,
      mcp_servers: flow.mcp_servers,
    }

    // Parse arguments
    const args = parseArgs(flow.args)

    // Parse nodes
    const nodes = flow.node ? parseNodes(flow.node, errors) : []

    return {
      success: errors.length === 0,
      flow: {
        meta,
        args,
        vars: flow.vars,
        nodes,
      },
      errors,
    }
  } catch (e) {
    return {
      success: false,
      errors: [
        {
          message: `YAML parse error: ${e instanceof Error ? e.message : String(e)}`,
        },
      ],
    }
  }
}

/**
 * Validate FDL flow structure
 */
export function validateFDL(flow: FDLFlow): FDLParseError[] {
  const errors: FDLParseError[] = []
  const nodeIds = new Set(flow.nodes.map((n) => n.id))

  // Check for duplicate node IDs (already handled by Record key)

  // Validate node references
  for (const node of flow.nodes) {
    // Check next references
    if (node.next) {
      for (const targetId of node.next) {
        if (!nodeIds.has(targetId)) {
          errors.push({
            message: `Node '${node.id}' references non-existent node '${targetId}' in next`,
            nodeId: node.id,
          })
        }
      }
    }

    // Check fail references
    if (node.fail && !nodeIds.has(node.fail)) {
      errors.push({
        message: `Node '${node.id}' references non-existent node '${node.fail}' in fail`,
        nodeId: node.id,
      })
    }

    // Check condition/switch node references
    if (node.type === 'condition') {
      if (!nodeIds.has(node.then)) {
        errors.push({
          message: `Condition node '${node.id}' references non-existent node '${node.then}' in then`,
          nodeId: node.id,
        })
      }
      if (node.else && !nodeIds.has(node.else)) {
        errors.push({
          message: `Condition node '${node.id}' references non-existent node '${node.else}' in else`,
          nodeId: node.id,
        })
      }
    }

    if (node.type === 'switch') {
      for (const branch of node.case) {
        if (!nodeIds.has(branch.then)) {
          errors.push({
            message: `Switch node '${node.id}' references non-existent node '${branch.then}' in case`,
            nodeId: node.id,
          })
        }
      }
      if (node.else && !nodeIds.has(node.else)) {
        errors.push({
          message: `Switch node '${node.id}' references non-existent node '${node.else}' in else`,
          nodeId: node.id,
        })
      }
    }
  }

  return errors
}
