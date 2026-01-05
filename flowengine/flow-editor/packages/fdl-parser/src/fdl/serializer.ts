/**
 * FDL YAML Serializer
 * Converts FDL Flow model back to YAML string
 */

import yaml from 'js-yaml'
import type {
  FDLFlow,
  FDLArgs,
  FDLParameter,
  FDLType,
  FDLTypeDef,
  FDLNode,
  FDLNodeRaw,
} from './types'

/**
 * Convert FDLType back to type string
 */
export function typeToString(type: FDLType): string {
  let str = type.base

  if (type.isMap && type.mapValueType) {
    str = `map<${typeToString(type.mapValueType)}>`
  }

  if (type.isArray) {
    str += '[]'
  }

  if (type.nullable) {
    str += '?'
  }

  return str
}

/**
 * Convert parameter to YAML format
 */
function parameterToString(param: FDLParameter): string {
  let str = typeToString(param.type)

  if (param.defaultValue) {
    str += ` = ${param.defaultValue}`
  }

  // Note: Comments are not preserved in YAML output
  // They would need special handling if required

  return str
}

/**
 * Convert parameters to Record format for YAML
 */
function parametersToRecord(params: FDLParameter[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const param of params) {
    result[param.name] = parameterToString(param)
  }
  return result
}

/**
 * Convert type definitions to Record format
 */
function typeDefsToRecord(defs: FDLTypeDef[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const def of defs) {
    result[def.name] = parametersToRecord(def.fields)
  }
  return result
}

/**
 * Convert FDLArgs to raw YAML format
 */
function argsToRaw(
  args: FDLArgs
): { in?: Record<string, string>; out?: Record<string, string> | string; defs?: Record<string, Record<string, string>> } | undefined {
  if (!args.in && !args.out && !args.defs) {
    return undefined
  }

  const result: {
    in?: Record<string, string>
    out?: Record<string, string> | string
    defs?: Record<string, Record<string, string>>
  } = {}

  if (args.defs && args.defs.length > 0) {
    result.defs = typeDefsToRecord(args.defs)
  }

  if (args.in && args.in.length > 0) {
    result.in = parametersToRecord(args.in)
  }

  if (args.out) {
    if (Array.isArray(args.out)) {
      result.out = parametersToRecord(args.out)
    } else {
      // Simple type output
      result.out = typeToString(args.out)
    }
  }

  return result
}

/**
 * Convert next array back to comma-separated string
 */
function nextToString(next: string[] | undefined): string | undefined {
  if (!next || next.length === 0) return undefined
  return next.join(', ')
}

/**
 * Convert FDLNode to raw YAML format
 */
function nodeToRaw(node: FDLNode): FDLNodeRaw {
  const base: FDLNodeRaw = {}

  if (node.name) base.name = node.name
  if (node.desp) base.desp = node.desp
  if (node.only) base.only = node.only

  const nextStr = nextToString(node.next)
  if (nextStr) base.next = nextStr

  if (node.fail) base.fail = node.fail

  switch (node.type) {
    case 'exec':
      base.exec = node.exec
      if (node.args) base.args = node.args
      if (node.with) base.with = node.with
      if (node.sets) base.sets = node.sets
      break

    case 'mapping':
      base.with = node.with
      if (node.sets) base.sets = node.sets
      break

    case 'condition':
      base.when = node.when
      base.then = node.then
      if (node.else) base.else = node.else
      break

    case 'switch':
      base.case = node.case
      if (node.else) base.else = node.else
      break

    case 'delay':
      base.wait = node.wait
      break

    case 'each':
      base.each = node.each
      if (node.vars) base.vars = node.vars
      base.node = node.node
      if (node.with) base.with = node.with
      break

    case 'loop':
      base.vars = node.vars
      base.when = node.when
      base.node = node.node
      if (node.with) base.with = node.with
      break

    case 'agent':
      base.agent = node.agent
      if (node.args) base.args = node.args
      if (node.with) base.with = node.with
      break

    case 'guard':
      base.guard = node.guard
      if (node.args) base.args = node.args
      if (node.then) base.then = node.then
      if (node.else) base.else = node.else
      break

    case 'approval':
      base.approval = node.approval
      if (node.then) base.then = node.then
      if (node.else) base.else = node.else
      break

    case 'mcp':
      base.mcp = node.mcp
      if (node.args) base.args = node.args
      if (node.with) base.with = node.with
      break

    case 'handoff':
      base.handoff = node.handoff
      if (node.args) base.args = node.args
      if (node.with) base.with = node.with
      break
  }

  return base
}

/**
 * Convert nodes array to Record format
 */
function nodesToRecord(nodes: FDLNode[]): Record<string, FDLNodeRaw> {
  const result: Record<string, FDLNodeRaw> = {}
  for (const node of nodes) {
    result[node.id] = nodeToRaw(node)
  }
  return result
}

/**
 * Main serializer function
 * Converts FDLFlow model to YAML string
 */
export function serializeFDL(flow: FDLFlow): string {
  const rawFlow: {
    name: string
    desp?: string
    mcp_servers?: Array<{ id: string; url: string; name?: string }>
    args?: ReturnType<typeof argsToRaw>
    vars?: string
    node?: Record<string, FDLNodeRaw>
  } = {
    name: flow.meta.name,
  }

  if (flow.meta.desp) {
    rawFlow.desp = flow.meta.desp
  }

  if (flow.meta.mcp_servers && flow.meta.mcp_servers.length > 0) {
    rawFlow.mcp_servers = flow.meta.mcp_servers
  }

  if (flow.args) {
    rawFlow.args = argsToRaw(flow.args)
  }

  if (flow.vars) {
    rawFlow.vars = flow.vars
  }

  if (flow.nodes.length > 0) {
    rawFlow.node = nodesToRecord(flow.nodes)
  }

  const raw = { flow: rawFlow }

  return yaml.dump(raw, {
    indent: 4,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
    quotingType: "'",
    forceQuotes: false,
  })
}

/**
 * Format FDL YAML with proper indentation
 * Useful for prettifying user input
 */
export function formatFDL(yamlContent: string): string {
  try {
    const parsed = yaml.load(yamlContent)
    return yaml.dump(parsed, {
      indent: 4,
      lineWidth: 120,
      noRefs: true,
      sortKeys: false,
      quotingType: "'",
      forceQuotes: false,
    })
  } catch {
    // Return original if parsing fails
    return yamlContent
  }
}
