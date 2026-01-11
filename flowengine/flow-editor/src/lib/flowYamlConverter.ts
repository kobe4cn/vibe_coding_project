/**
 * Flow ↔ YAML Converter
 * Bidirectional conversion between FlowModel and standard FDL YAML
 *
 * Standard FDL format:
 * ```yaml
 * flow:
 *     name: 流程名称
 *     desp: 流程描述
 *     args:
 *         defs: ...
 *         in: ...
 *         out: ...
 *     vars: |
 *         variable = expression
 *     node:
 *         nodeId:
 *             name: 节点名称
 *             desp: 节点描述
 *             exec: uri
 *             args: ...
 *             with: ...
 *             next: targetNodeId
 * ```
 */

import * as yaml from 'js-yaml'
import type { FlowModel, FlowNode, FlowEdge, FlowNodeData, FlowNodeType, FlowEdgeData, StartNodeData } from '@/types/flow'
import dagre from 'dagre'

// Standard FDL YAML structure types
interface FDLYaml {
  flow: {
    name?: string
    desp?: string
    args?: {
      in?: Record<string, unknown>
      out?: unknown
      defs?: Record<string, unknown>
      entry?: string[]  // Start 节点连接的入口节点 ID 列表
    }
    vars?: string
    node?: Record<string, FDLNode>
  }
}

interface FDLNode {
  name?: string
  desp?: string
  only?: string
  // Exec node
  exec?: string
  args?: string
  with?: string
  sets?: string
  // Condition node
  when?: string
  then?: string
  else?: string
  // Switch node
  case?: Array<{ when: string; then: string }>
  // Delay node
  wait?: string | number
  // Loop nodes
  each?: string
  loop?: { vars: string; when: string } | string
  vars?: string
  node?: Record<string, FDLNode>  // Sub-flow nodes for each/loop
  // Agent node
  agent?: {
    model?: string
    instructions?: string
    tools?: string[]
    outputFormat?: string
    temperature?: number
  }
  // Guard node
  guard?: {
    types: string[]
    action: string
    schema?: object
    expression?: string
  }
  // Approval node
  approval?: {
    title?: string
    description?: string
    timeout?: string
    timeoutAction?: string
  }
  // MCP node
  mcp?: {
    server: string
    tool: string
    authType?: string
    authKey?: string
  }
  // Handoff node
  handoff?: {
    target: string
    context?: string[]
    resumeOn?: string
  }
  // Navigation
  next?: string
  fail?: string
}

/**
 * Convert FlowModel to standard FDL YAML string
 */
export function flowToYaml(flow: FlowModel): string {
  const fdl: FDLYaml = {
    flow: {
      name: flow.meta.name || '未命名流程',
    },
  }

  // Add description if present
  if (flow.meta.description) {
    fdl.flow.desp = flow.meta.description
  }

  // Find Start node and its connections
  const startNode = flow.nodes.find(n => n.data.nodeType === 'start')
  const startEdges = startNode
    ? flow.edges.filter(e => e.source === startNode.id)
    : []
  const entryNodeIds = startEdges.map(e => e.target)

  // Build args section
  fdl.flow.args = {}

  // Add defs if present
  if (flow.args?.defs && flow.args.defs.length > 0) {
    fdl.flow.args.defs = {}
    for (const def of flow.args.defs) {
      const fields: Record<string, unknown> = {}
      for (const field of def.fields) {
        fields[field.name] = formatParameterType(field)
      }
      fdl.flow.args.defs[def.name] = fields
    }
  }

  // Export Start node's parameters as args.in
  if (startNode) {
    const startData = startNode.data as FlowNodeData & { parameters?: Array<{
      name: string
      type: string
      required: boolean
      defaultValue?: string
      description?: string
    }> }
    if (startData.parameters && startData.parameters.length > 0) {
      fdl.flow.args.in = {}
      for (const param of startData.parameters) {
        // 转换为 YAML 格式：type? = defaultValue  # description
        let typeStr = param.type
        if (!param.required) typeStr += '?'
        if (param.defaultValue) typeStr += ` = ${param.defaultValue}`
        // 注释会在 YAML dump 时丢失，暂不处理 description
        fdl.flow.args.in[param.name] = typeStr
      }
    }
  } else if (flow.args?.inputs && flow.args.inputs.length > 0) {
    // Fallback: use flow.args.inputs if no Start node
    fdl.flow.args.in = {}
    for (const input of flow.args.inputs) {
      fdl.flow.args.in[input.name] = formatParameterType(input)
    }
  }

  // Add outputs
  if (flow.args?.outputs) {
    fdl.flow.args.out = flow.args.outputs
  }

  // Add entry node IDs (Start node's targets)
  if (entryNodeIds.length > 0) {
    fdl.flow.args.entry = entryNodeIds
  }

  // Clean up empty args
  if (Object.keys(fdl.flow.args).length === 0) {
    delete fdl.flow.args
  }

  // Add vars if present
  if (flow.vars) {
    fdl.flow.vars = flow.vars
  }

  // Build edge map for navigation (exclude edges from Start node)
  const edgeMap = buildEdgeMap(flow.edges.filter(e => !startNode || e.source !== startNode.id))

  // Filter out Start node for YAML export (it becomes args.in + args.entry)
  const nonStartNodes = flow.nodes.filter(n => n.data.nodeType !== 'start')

  // Convert nodes to FDL node object (preserving order)
  if (nonStartNodes.length > 0) {
    fdl.flow.node = {}

    // Find root nodes (nodes with no incoming edges from non-start nodes)
    const targetIds = new Set(flow.edges.filter(e => !startNode || e.source !== startNode.id).map((e) => e.target))
    const rootNodes = nonStartNodes.filter((n) => !targetIds.has(n.id))

    // Convert nodes in topological order
    const visited = new Set<string>()

    for (const root of rootNodes) {
      convertNodeToFDL(root, nonStartNodes, edgeMap, visited, fdl.flow.node)
    }

    // Handle any unvisited nodes (disconnected)
    for (const node of nonStartNodes) {
      if (!visited.has(node.id)) {
        convertNodeToFDL(node, nonStartNodes, edgeMap, visited, fdl.flow.node)
      }
    }
  }

  return yaml.dump(fdl, {
    indent: 4,
    lineWidth: 120,
    quotingType: '"',
    forceQuotes: false,
    noRefs: true,
  })
}

function formatParameterType(param: { type: string; nullable?: boolean; isArray?: boolean; defaultValue?: string }): string {
  let type = param.type
  if (param.nullable) type += '?'
  if (param.isArray) type += '[]'
  if (param.defaultValue) type += ` = ${param.defaultValue}`
  return type
}

function buildEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge[]> {
  const map = new Map<string, FlowEdge[]>()
  for (const edge of edges) {
    const existing = map.get(edge.source) || []
    existing.push(edge)
    map.set(edge.source, existing)
  }
  return map
}

function convertNodeToFDL(
  node: FlowNode,
  allNodes: FlowNode[],
  edgeMap: Map<string, FlowEdge[]>,
  visited: Set<string>,
  nodeObj: Record<string, FDLNode>
): void {
  if (visited.has(node.id)) return
  visited.add(node.id)

  const fdlNode = nodeToFDLNode(node)
  const edges = edgeMap.get(node.id) || []

  // Handle next/then/else/fail edges
  for (const edge of edges) {
    const edgeType = edge.data?.edgeType || 'next'

    if (edgeType === 'next') {
      fdlNode.next = edge.target
    } else if (edgeType === 'then') {
      fdlNode.then = edge.target
    } else if (edgeType === 'else') {
      fdlNode.else = edge.target
    } else if (edgeType === 'fail') {
      fdlNode.fail = edge.target
    }
  }

  nodeObj[node.id] = fdlNode

  // Continue with connected nodes
  for (const edge of edges) {
    const target = allNodes.find((n) => n.id === edge.target)
    if (target) {
      convertNodeToFDL(target, allNodes, edgeMap, visited, nodeObj)
    }
  }
}

function nodeToFDLNode(node: FlowNode): FDLNode {
  const data = node.data
  const fdlNode: FDLNode = {}

  if (data.label) fdlNode.name = data.label
  if (data.description) fdlNode.desp = data.description
  if (data.only) fdlNode.only = data.only

  switch (data.nodeType) {
    case 'exec': {
      const d = data as FlowNodeData & { exec?: string; args?: string; with?: string; sets?: string }
      if (d.exec) fdlNode.exec = d.exec
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'mapping': {
      const d = data as FlowNodeData & { with?: string; sets?: string }
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'condition': {
      const d = data as FlowNodeData & { when?: string }
      if (d.when) fdlNode.when = d.when
      break
    }
    case 'switch': {
      const d = data as FlowNodeData & { cases?: Array<{ when: string; then: string }> }
      if (d.cases) fdlNode.case = d.cases
      break
    }
    case 'delay': {
      const d = data as FlowNodeData & { wait?: string | number }
      if (d.wait) fdlNode.wait = d.wait
      break
    }
    case 'each': {
      const d = data as FlowNodeData & { each?: string; vars?: string }
      if (d.each) fdlNode.each = d.each
      if (d.vars) fdlNode.vars = d.vars
      // TODO: Handle subflow nodes
      break
    }
    case 'loop': {
      const d = data as FlowNodeData & { vars?: string; when?: string }
      if (d.vars && d.when) {
        fdlNode.loop = { vars: d.vars, when: d.when }
      }
      // TODO: Handle subflow nodes
      break
    }
    case 'agent': {
      const d = data as FlowNodeData & {
        model?: string
        instructions?: string
        tools?: string[]
        outputFormat?: string
        temperature?: number
        args?: string
        with?: string
      }
      fdlNode.agent = {}
      if (d.model) fdlNode.agent.model = d.model
      if (d.instructions) fdlNode.agent.instructions = d.instructions
      if (d.tools) fdlNode.agent.tools = d.tools
      if (d.outputFormat) fdlNode.agent.outputFormat = d.outputFormat
      if (d.temperature !== undefined) fdlNode.agent.temperature = d.temperature
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      break
    }
    case 'guard': {
      const d = data as FlowNodeData & {
        guardTypes?: string[]
        action?: string
        schema?: object
        customExpression?: string
        args?: string
      }
      fdlNode.guard = {
        types: d.guardTypes || [],
        action: d.action || 'block',
      }
      if (d.schema) fdlNode.guard.schema = d.schema
      if (d.customExpression) fdlNode.guard.expression = d.customExpression
      if (d.args) fdlNode.args = d.args
      break
    }
    case 'approval': {
      const d = data as FlowNodeData & {
        title?: string
        approvalDescription?: string
        timeout?: string
        timeoutAction?: string
      }
      fdlNode.approval = {}
      if (d.title) fdlNode.approval.title = d.title
      if (d.approvalDescription) fdlNode.approval.description = d.approvalDescription
      if (d.timeout) fdlNode.approval.timeout = d.timeout
      if (d.timeoutAction) fdlNode.approval.timeoutAction = d.timeoutAction
      break
    }
    case 'mcp': {
      const d = data as FlowNodeData & {
        server?: string
        tool?: string
        authType?: string
        authKey?: string
        args?: string
        with?: string
      }
      fdlNode.mcp = {
        server: d.server || '',
        tool: d.tool || '',
      }
      if (d.authType) fdlNode.mcp.authType = d.authType
      if (d.authKey) fdlNode.mcp.authKey = d.authKey
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      break
    }
    case 'handoff': {
      const d = data as FlowNodeData & {
        target?: string
        context?: string[]
        resumeOn?: string
        args?: string
        with?: string
      }
      fdlNode.handoff = {
        target: d.target || '',
      }
      if (d.context) fdlNode.handoff.context = d.context
      if (d.resumeOn) fdlNode.handoff.resumeOn = d.resumeOn
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      break
    }
    // 集成服务节点 - 都使用 exec 字段保存 URI
    case 'oss': {
      const d = data as FlowNodeData & { oss?: string; args?: string; with?: string; sets?: string }
      if (d.oss) fdlNode.exec = d.oss
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'mq': {
      const d = data as FlowNodeData & { mq?: string; args?: string; with?: string; sets?: string }
      if (d.mq) fdlNode.exec = d.mq
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'mail': {
      const d = data as FlowNodeData & { mail?: string; args?: string; with?: string; sets?: string }
      if (d.mail) fdlNode.exec = d.mail
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'sms': {
      const d = data as FlowNodeData & { sms?: string; args?: string; with?: string; sets?: string }
      if (d.sms) fdlNode.exec = d.sms
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
    case 'service': {
      const d = data as FlowNodeData & { service?: string; args?: string; with?: string; sets?: string }
      if (d.service) fdlNode.exec = d.service
      if (d.args) fdlNode.args = d.args
      if (d.with) fdlNode.with = d.with
      if (d.sets) fdlNode.sets = d.sets
      break
    }
  }

  return fdlNode
}

/**
 * Convert standard FDL YAML string to FlowModel
 */
export function yamlToFlow(yamlContent: string): { flow: FlowModel; error?: string } {
  try {
    const parsed = yaml.load(yamlContent) as unknown

    if (!parsed || typeof parsed !== 'object') {
      return {
        flow: createEmptyFlow(),
        error: 'Invalid YAML: not an object',
      }
    }

    // Check if it's standard FDL format (flow.node as object)
    if ('flow' in parsed && typeof (parsed as { flow: unknown }).flow === 'object') {
      const fdl = parsed as FDLYaml

      // Validate flow structure
      if (!fdl.flow) {
        return {
          flow: createEmptyFlow(),
          error: 'Invalid FDL: missing flow section',
        }
      }

      return parseStandardFDL(fdl)
    }

    // Fallback: try legacy format (for backwards compatibility)
    return parseLegacyFormat(parsed)
  } catch (e) {
    return {
      flow: createEmptyFlow(),
      error: e instanceof Error ? e.message : 'YAML 解析错误',
    }
  }
}

/**
 * Parse standard FDL format (flow.node as object)
 */
function parseStandardFDL(fdl: FDLYaml): { flow: FlowModel; error?: string } {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const nodeIdMap = new Map<string, string>()

  // Parse nodes from flow.node object
  if (fdl.flow.node) {
    const nodeEntries = Object.entries(fdl.flow.node)

    for (let i = 0; i < nodeEntries.length; i++) {
      const [nodeId, fdlNode] = nodeEntries[i]
      nodeIdMap.set(nodeId, nodeId)

      const { node, nodeEdges } = fdlNodeToNode(nodeId, fdlNode, i)
      nodes.push(node)
      edges.push(...nodeEdges)
    }

    // Create edges from next/then/else/fail references
    for (const [nodeId, fdlNode] of nodeEntries) {
      if (fdlNode.next && typeof fdlNode.next === 'string') {
        // next can be comma-separated list
        const nextIds = fdlNode.next.split(',').map(s => s.trim())
        for (const targetId of nextIds) {
          if (targetId) {
            edges.push(createEdge(nodeId, targetId, 'next'))
          }
        }
      }
      if (fdlNode.then && typeof fdlNode.then === 'string') {
        edges.push(createEdge(nodeId, fdlNode.then, 'then'))
      }
      if (fdlNode.else && typeof fdlNode.else === 'string') {
        edges.push(createEdge(nodeId, fdlNode.else, 'else'))
      }
      if (fdlNode.fail && typeof fdlNode.fail === 'string') {
        edges.push(createEdge(nodeId, fdlNode.fail, 'fail'))
      }
      // Handle switch case edges
      if (fdlNode.case) {
        for (const caseItem of fdlNode.case) {
          if (typeof caseItem.then === 'string') {
            edges.push(createEdge(nodeId, caseItem.then, 'then'))
          }
        }
      }
    }
  }

  // Create Start node from args.in
  const startNodeId = `start-${Date.now()}`
  const inputParams = fdl.flow.args?.in
  const startParameters: StartNodeData['parameters'] = []

  if (inputParams) {
    for (const [name, typeStr] of Object.entries(inputParams)) {
      const parsed = parseTypeString(String(typeStr))
      startParameters.push({
        name,
        type: (parsed.type as 'string' | 'number' | 'boolean' | 'object' | 'array') || 'string',
        required: !parsed.nullable,
        defaultValue: parsed.defaultValue,
      })
    }
  }

  const startNodeData: StartNodeData = {
    nodeType: 'start',
    label: '开始',
    parameters: startParameters,
  }

  const startNode: FlowNode = {
    id: startNodeId,
    type: 'start',
    position: { x: 0, y: 0 }, // Will be set by auto-layout
    data: startNodeData,
  }
  nodes.unshift(startNode) // Add at beginning

  // Determine entry nodes: use args.entry if specified, otherwise auto-detect
  let entryNodeIds: string[] = []
  if (fdl.flow.args?.entry && fdl.flow.args.entry.length > 0) {
    // Use explicitly specified entry nodes
    entryNodeIds = fdl.flow.args.entry.filter(id => nodeIdMap.has(id))
  } else {
    // Auto-detect: find nodes with no incoming edges
    const targetIds = new Set(edges.map(e => e.target))
    entryNodeIds = nodes
      .filter(n => n.data.nodeType !== 'start' && !targetIds.has(n.id))
      .map(n => n.id)
  }

  // Create edges from Start node to entry nodes
  for (const targetId of entryNodeIds) {
    edges.push(createEdge(startNodeId, targetId, 'next'))
  }

  // Apply auto-layout
  const layoutedNodes = applyAutoLayout(nodes, edges)

  const flow: FlowModel = {
    meta: {
      name: fdl.flow.name || '未命名流程',
      description: fdl.flow.desp,
    },
    nodes: layoutedNodes,
    edges,
  }

  // Parse args (excluding inputs since they're now in Start node)
  if (fdl.flow.args) {
    flow.args = parseArgs(fdl.flow.args)
  }

  // Parse vars
  if (fdl.flow.vars) {
    flow.vars = fdl.flow.vars
  }

  return { flow }
}

/**
 * Parse args section
 */
function parseArgs(args: FDLYaml['flow']['args']): FlowModel['args'] {
  const result: FlowModel['args'] = {}

  if (args?.defs) {
    result.defs = []
    for (const [name, fields] of Object.entries(args.defs)) {
      if (typeof fields === 'object' && fields !== null) {
        result.defs.push({
          name,
          fields: Object.entries(fields as Record<string, unknown>).map(([fieldName, fieldType]) => ({
            name: fieldName,
            ...parseTypeString(String(fieldType)),
          })),
        })
      }
    }
  }

  if (args?.in) {
    result.inputs = []
    for (const [name, typeStr] of Object.entries(args.in)) {
      result.inputs.push({
        name,
        ...parseTypeString(String(typeStr)),
      })
    }
  }

  if (args?.out) {
    if (typeof args.out === 'string') {
      // Simple output type
      result.outputs = parseTypeString(args.out)
    } else if (Array.isArray(args.out)) {
      // 数组格式: [{name: "id", type: "string"}, ...]
      result.outputs = (args.out as Array<{ name: string; type: string }>).map(item => ({
        name: item.name,
        ...parseTypeString(item.type || 'string'),
      }))
    } else if (typeof args.out === 'object') {
      // 对象格式: {fieldName: "type", ...}
      result.outputs = Object.entries(args.out as Record<string, unknown>).map(([name, typeStr]) => ({
        name,
        ...parseTypeString(String(typeStr)),
      }))
    }
  }

  return result
}

/**
 * Parse type string like "string?", "Order[]", "date = DATE('-3M')"
 */
function parseTypeString(typeStr: string): { type: string; nullable?: boolean; isArray?: boolean; defaultValue?: string } {
  const result: { type: string; nullable?: boolean; isArray?: boolean; defaultValue?: string } = { type: 'string' }

  // Check for default value
  const defaultMatch = typeStr.match(/^(.+?)\s*=\s*(.+)$/)
  if (defaultMatch) {
    typeStr = defaultMatch[1].trim()
    result.defaultValue = defaultMatch[2].trim()
  }

  // Check for array
  if (typeStr.endsWith('[]')) {
    result.isArray = true
    typeStr = typeStr.slice(0, -2)
  }

  // Check for nullable
  if (typeStr.endsWith('?')) {
    result.nullable = true
    typeStr = typeStr.slice(0, -1)
  }

  result.type = typeStr

  return result
}

/**
 * Infer OSS operation from URI or args
 * e.g., oss://bucket/path?operation=upload → 'upload'
 */
function inferOssOperation(uri: string): 'upload' | 'download' | 'delete' | 'list' | undefined {
  const match = uri.match(/[?&]operation=(\w+)/i)
  if (match) {
    const op = match[1].toLowerCase()
    if (['upload', 'download', 'delete', 'list'].includes(op)) {
      return op as 'upload' | 'download' | 'delete' | 'list'
    }
  }
  // 默认根据路径推断：有路径一般是 upload/download，无路径是 list
  return undefined
}

/**
 * Infer MQ operation from args
 * 通过 args 表达式中的 operation 字段推断
 */
function inferMqOperation(args?: string): 'send' | 'receive' | 'subscribe' | undefined {
  if (!args) return 'send' // 默认发送
  const lowerArgs = args.toLowerCase()
  if (lowerArgs.includes('receive')) return 'receive'
  if (lowerArgs.includes('subscribe')) return 'subscribe'
  return 'send'
}

/**
 * Infer service HTTP method from URI query
 * e.g., svc://service/path?method=POST → 'POST'
 */
function inferServiceMethod(uri: string): 'GET' | 'POST' | 'PUT' | 'DELETE' | undefined {
  const match = uri.match(/[?&]method=(\w+)/i)
  if (match) {
    const method = match[1].toUpperCase()
    if (['GET', 'POST', 'PUT', 'DELETE'].includes(method)) {
      return method as 'GET' | 'POST' | 'PUT' | 'DELETE'
    }
  }
  return undefined
}

/**
 * Convert FDL node to FlowNode
 */
function fdlNodeToNode(
  nodeId: string,
  fdlNode: FDLNode,
  index: number
): { node: FlowNode; nodeEdges: FlowEdge[] } {
  const nodeEdges: FlowEdge[] = []
  const nodeType = inferNodeType(fdlNode)
  console.log('[fdlNodeToNode] nodeId:', nodeId, 'nodeType:', nodeType, 'exec:', fdlNode.exec)

  const baseData = {
    nodeType,
    label: fdlNode.name || `步骤 ${index + 1}`,
    description: fdlNode.desp,
    only: fdlNode.only,
  }

  let data: FlowNodeData

  switch (nodeType) {
    case 'exec':
      data = {
        ...baseData,
        nodeType: 'exec' as const,
        exec: fdlNode.exec || '',
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    case 'mapping':
      data = {
        ...baseData,
        nodeType: 'mapping' as const,
        with: fdlNode.with || '',
        sets: fdlNode.sets,
      }
      break
    case 'condition':
      data = {
        ...baseData,
        nodeType: 'condition' as const,
        when: fdlNode.when || '',
      }
      break
    case 'switch':
      data = {
        ...baseData,
        nodeType: 'switch' as const,
        cases: fdlNode.case?.map((c) => ({ when: c.when, then: typeof c.then === 'string' ? c.then : '' })) || [],
      }
      break
    case 'delay':
      data = {
        ...baseData,
        nodeType: 'delay' as const,
        wait: fdlNode.wait || '1s',
      }
      break
    case 'each':
      data = {
        ...baseData,
        nodeType: 'each' as const,
        each: fdlNode.each || '',
        vars: fdlNode.vars,
      }
      break
    case 'loop':
      data = {
        ...baseData,
        nodeType: 'loop' as const,
        vars: typeof fdlNode.loop === 'object' ? fdlNode.loop.vars : (fdlNode.vars || ''),
        when: typeof fdlNode.loop === 'object' ? fdlNode.loop.when : '',
      }
      break
    case 'agent':
      data = {
        ...baseData,
        nodeType: 'agent' as const,
        model: fdlNode.agent?.model,
        instructions: fdlNode.agent?.instructions,
        tools: fdlNode.agent?.tools,
        outputFormat: fdlNode.agent?.outputFormat as 'json' | 'markdown' | 'text' | undefined,
        temperature: fdlNode.agent?.temperature,
        args: fdlNode.args,
        with: fdlNode.with,
      }
      break
    case 'guard':
      data = {
        ...baseData,
        nodeType: 'guard' as const,
        guardTypes: (fdlNode.guard?.types || []) as ('pii' | 'jailbreak' | 'moderation' | 'hallucination' | 'schema' | 'custom')[],
        action: (fdlNode.guard?.action || 'block') as 'block' | 'warn' | 'redact',
        schema: fdlNode.guard?.schema,
        customExpression: fdlNode.guard?.expression,
        args: fdlNode.args,
      }
      break
    case 'approval':
      data = {
        ...baseData,
        nodeType: 'approval' as const,
        title: fdlNode.approval?.title || '请审批',
        approvalDescription: fdlNode.approval?.description,
        timeout: fdlNode.approval?.timeout,
        timeoutAction: fdlNode.approval?.timeoutAction as 'approve' | 'reject' | undefined,
      }
      break
    case 'mcp':
      data = {
        ...baseData,
        nodeType: 'mcp' as const,
        server: fdlNode.mcp?.server || '',
        tool: fdlNode.mcp?.tool || '',
        authType: fdlNode.mcp?.authType,
        authKey: fdlNode.mcp?.authKey,
        args: fdlNode.args,
        with: fdlNode.with,
      }
      break
    case 'handoff':
      data = {
        ...baseData,
        nodeType: 'handoff' as const,
        target: fdlNode.handoff?.target || '',
        context: fdlNode.handoff?.context,
        resumeOn: fdlNode.handoff?.resumeOn as 'completed' | 'error' | 'any' | undefined,
        args: fdlNode.args,
        with: fdlNode.with,
      }
      break
    case 'oss':
      data = {
        ...baseData,
        nodeType: 'oss' as const,
        oss: fdlNode.exec || '',
        operation: inferOssOperation(fdlNode.exec || ''),
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    case 'mq':
      data = {
        ...baseData,
        nodeType: 'mq' as const,
        mq: fdlNode.exec || '',
        operation: inferMqOperation(fdlNode.args),
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    case 'mail':
      data = {
        ...baseData,
        nodeType: 'mail' as const,
        mail: fdlNode.exec || '',
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    case 'sms':
      data = {
        ...baseData,
        nodeType: 'sms' as const,
        sms: fdlNode.exec || '',
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    case 'service':
      data = {
        ...baseData,
        nodeType: 'service' as const,
        service: fdlNode.exec || '',
        method: inferServiceMethod(fdlNode.exec || ''),
        args: fdlNode.args,
        with: fdlNode.with,
        sets: fdlNode.sets,
      }
      break
    default:
      data = {
        ...baseData,
        nodeType: 'exec' as const,
        exec: '',
      }
  }

  const node: FlowNode = {
    id: nodeId,
    type: nodeType,
    position: { x: 0, y: 0 }, // Will be set by auto-layout
    data,
  }

  console.log('[fdlNodeToNode] Created node:', { id: node.id, type: node.type, dataNodeType: node.data.nodeType })
  return { node, nodeEdges }
}

/**
 * Infer node type from FDL node properties
 * 根据 exec URI scheme 识别集成服务节点类型
 */
function inferNodeType(fdlNode: FDLNode): FlowNodeType {
  if (fdlNode.exec) {
    // 根据 URI scheme 判断节点类型
    const execUri = fdlNode.exec.toLowerCase()
    console.log('[inferNodeType] exec URI:', fdlNode.exec, '-> lowercase:', execUri)
    if (execUri.startsWith('oss://')) {
      console.log('[inferNodeType] -> detected as OSS')
      return 'oss'
    }
    if (execUri.startsWith('mq://')) {
      console.log('[inferNodeType] -> detected as MQ')
      return 'mq'
    }
    if (execUri.startsWith('svc://')) {
      console.log('[inferNodeType] -> detected as SERVICE')
      return 'service'
    }
    if (execUri.startsWith('mail://')) {
      console.log('[inferNodeType] -> detected as MAIL')
      return 'mail'
    }
    if (execUri.startsWith('sms://')) {
      console.log('[inferNodeType] -> detected as SMS')
      return 'sms'
    }
    console.log('[inferNodeType] -> defaulting to EXEC')
    return 'exec'
  }
  if (fdlNode.agent) return 'agent'
  if (fdlNode.guard) return 'guard'
  if (fdlNode.approval) return 'approval'
  if (fdlNode.mcp) return 'mcp'
  if (fdlNode.handoff) return 'handoff'
  if (fdlNode.when && (fdlNode.then !== undefined || fdlNode.else !== undefined)) return 'condition'
  if (fdlNode.case) return 'switch'
  if (fdlNode.wait) return 'delay'
  if (fdlNode.each) return 'each'
  if (fdlNode.loop) return 'loop'
  if (fdlNode.with && !fdlNode.exec) return 'mapping'
  return 'exec' // default
}

/**
 * Parse legacy format (array-based flow)
 */
function parseLegacyFormat(parsed: unknown): { flow: FlowModel; error?: string } {
  interface LegacyFDL {
    meta?: {
      name?: string
      description?: string
      mcpServers?: Array<{ id: string; url: string; name?: string }>
    }
    args?: {
      in?: Record<string, unknown>
      out?: unknown
      defs?: Record<string, unknown>
    }
    vars?: string
    flow?: Array<{
      id?: string
      label?: string
      description?: string
      only?: string
      exec?: string
      args?: string
      with?: string
      sets?: string
      when?: string
      then?: string
      else?: string
      case?: Array<{ when: string; then: string }>
      wait?: string | number
      each?: string
      loop?: { vars: string; when: string } | string
      agent?: object
      guard?: object
      approval?: object
      mcp?: object
      handoff?: object
      next?: string
      fail?: string
    }>
  }

  const fdl = parsed as LegacyFDL

  if (!fdl.flow || !Array.isArray(fdl.flow)) {
    return {
      flow: createEmptyFlow(),
      error: 'Invalid format: expected flow.node (object) or flow (array)',
    }
  }

  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const nodeIdMap = new Map<string, string>()

  // Parse steps and create nodes
  for (let i = 0; i < fdl.flow.length; i++) {
    const step = fdl.flow[i]
    const nodeId = step.id || `step-${i}`
    nodeIdMap.set(step.id || `step-${i}`, nodeId)

    // Convert legacy step to FDL node format
    const fdlNode: FDLNode = {
      name: step.label,
      desp: step.description,
      only: step.only,
      exec: step.exec,
      args: step.args,
      with: step.with,
      sets: step.sets,
      when: step.when,
      then: step.then,
      else: step.else,
      case: step.case,
      wait: step.wait,
      each: step.each,
      loop: step.loop as FDLNode['loop'],
      agent: step.agent as FDLNode['agent'],
      guard: step.guard as FDLNode['guard'],
      approval: step.approval as FDLNode['approval'],
      mcp: step.mcp as FDLNode['mcp'],
      handoff: step.handoff as FDLNode['handoff'],
      next: step.next,
      fail: step.fail,
    }

    const { node } = fdlNodeToNode(nodeId, fdlNode, i)
    nodes.push(node)
  }

  // Create edges from next/then/else references
  for (let i = 0; i < fdl.flow.length; i++) {
    const step = fdl.flow[i]
    const sourceId = step.id || `step-${i}`

    if (step.next && typeof step.next === 'string') {
      const targetId = nodeIdMap.get(step.next) || step.next
      edges.push(createEdge(sourceId, targetId, 'next'))
    }
    if (step.then && typeof step.then === 'string') {
      const targetId = nodeIdMap.get(step.then) || step.then
      edges.push(createEdge(sourceId, targetId, 'then'))
    }
    if (step.else && typeof step.else === 'string') {
      const targetId = nodeIdMap.get(step.else) || step.else
      edges.push(createEdge(sourceId, targetId, 'else'))
    }
    if (step.fail && typeof step.fail === 'string') {
      const targetId = nodeIdMap.get(step.fail) || step.fail
      edges.push(createEdge(sourceId, targetId, 'fail'))
    }
  }

  // Apply auto-layout
  const layoutedNodes = applyAutoLayout(nodes, edges)

  const flow: FlowModel = {
    meta: {
      name: fdl.meta?.name || '未命名流程',
      description: fdl.meta?.description,
      mcpServers: fdl.meta?.mcpServers,
    },
    nodes: layoutedNodes,
    edges,
  }

  if (fdl.vars) {
    flow.vars = fdl.vars
  }

  return { flow }
}

function createEdge(source: string, target: string, edgeType: FlowEdgeData['edgeType']): FlowEdge {
  return {
    id: `${source}-${target}-${edgeType}`,
    source,
    target,
    sourceHandle: edgeType !== 'next' ? edgeType : undefined,
    data: { edgeType },
  }
}

function createEmptyFlow(): FlowModel {
  return {
    meta: { name: '未命名流程' },
    nodes: [],
    edges: [],
  }
}

/**
 * Migrate/normalize a FlowModel to ensure correct node types based on exec URI
 * 用于修正从存储加载的旧流程中节点类型不正确的问题
 */
export function migrateFlowModel(flow: FlowModel): FlowModel {
  const migratedNodes = flow.nodes.map(node => {
    const data = node.data

    // 只处理有 exec 字段的节点
    if ('exec' in data && typeof data.exec === 'string' && data.exec) {
      const execUri = data.exec.toLowerCase()
      let correctType: FlowNodeType = 'exec'

      if (execUri.startsWith('oss://')) {
        correctType = 'oss'
      } else if (execUri.startsWith('mq://')) {
        correctType = 'mq'
      } else if (execUri.startsWith('svc://')) {
        correctType = 'service'
      } else if (execUri.startsWith('mail://')) {
        correctType = 'mail'
      } else if (execUri.startsWith('sms://')) {
        correctType = 'sms'
      }

      // 如果类型需要修正
      if (node.type !== correctType || data.nodeType !== correctType) {
        console.log('[migrateFlowModel] Correcting node type:', node.id, 'from', node.type, 'to', correctType)

        // 创建修正后的节点数据
        let migratedData: FlowNodeData

        switch (correctType) {
          case 'oss':
            migratedData = {
              ...data,
              nodeType: 'oss' as const,
              oss: data.exec,
            } as FlowNodeData
            break
          case 'mq':
            migratedData = {
              ...data,
              nodeType: 'mq' as const,
              mq: data.exec,
            } as FlowNodeData
            break
          case 'service':
            migratedData = {
              ...data,
              nodeType: 'service' as const,
              service: data.exec,
            } as FlowNodeData
            break
          case 'mail':
            migratedData = {
              ...data,
              nodeType: 'mail' as const,
              mail: data.exec,
            } as FlowNodeData
            break
          case 'sms':
            migratedData = {
              ...data,
              nodeType: 'sms' as const,
              sms: data.exec,
            } as FlowNodeData
            break
          default:
            migratedData = data
        }

        return {
          ...node,
          type: correctType,
          data: migratedData,
        }
      }
    }

    return node
  })

  return {
    ...flow,
    nodes: migratedNodes,
  }
}

/**
 * Apply auto-layout using dagre
 */
function applyAutoLayout(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })
  g.setDefaultEdgeLabel(() => ({}))

  // Add nodes to graph
  for (const node of nodes) {
    g.setNode(node.id, { width: 200, height: 80 })
  }

  // Add edges to graph
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  // Run layout
  dagre.layout(g)

  // Apply positions
  return nodes.map((node) => {
    const nodeWithPosition = g.node(node.id)
    if (nodeWithPosition) {
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - 100, // Center node
          y: nodeWithPosition.y - 40,
        },
      }
    }
    return node
  })
}
