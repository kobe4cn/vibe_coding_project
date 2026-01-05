/**
 * FDL Flow Executor
 * Executes flow definitions step by step
 */

import type {
  ExecutionContext,
  ExecutionStatus,
  NodeExecutionResult,
  ExecutionEvent,
  RuntimeConfig,
  NodeExecutionState,
  ExecutionHistoryEntry,
} from './types'
import type { FlowModel, FlowNode, FlowEdge, FlowNodeData } from '../../../src/types/flow'

export class FlowExecutor {
  private flow: FlowModel
  private config: RuntimeConfig
  private context: ExecutionContext
  private status: ExecutionStatus = 'idle'
  private nodeMap: Map<string, FlowNode>
  private edgeMap: Map<string, FlowEdge[]>
  private pausePromise: { resolve: () => void } | null = null

  constructor(flow: FlowModel, config: RuntimeConfig = {}) {
    this.flow = flow
    this.config = {
      timeout: 300000, // 5 minutes default
      maxIterations: 1000,
      ...config,
    }
    this.context = this.createInitialContext()
    this.nodeMap = new Map(flow.nodes.map((n) => [n.id, n]))
    this.edgeMap = this.buildEdgeMap()
  }

  private createInitialContext(): ExecutionContext {
    return {
      vars: {},
      args: {},
      currentNodeId: null,
      history: [],
      breakpoints: new Set(),
      mode: 'run',
    }
  }

  private buildEdgeMap(): Map<string, FlowEdge[]> {
    const map = new Map<string, FlowEdge[]>()
    for (const edge of this.flow.edges) {
      const existing = map.get(edge.source) || []
      existing.push(edge)
      map.set(edge.source, existing)
    }
    return map
  }

  private emit(event: Omit<ExecutionEvent, 'timestamp'>) {
    this.config.onEvent?.({
      ...event,
      timestamp: Date.now(),
    })
  }

  // Public API

  getStatus(): ExecutionStatus {
    return this.status
  }

  getContext(): ExecutionContext {
    return { ...this.context }
  }

  setBreakpoint(nodeId: string) {
    this.context.breakpoints.add(nodeId)
  }

  removeBreakpoint(nodeId: string) {
    this.context.breakpoints.delete(nodeId)
  }

  clearBreakpoints() {
    this.context.breakpoints.clear()
  }

  getBreakpoints(): string[] {
    return Array.from(this.context.breakpoints)
  }

  async start(args: Record<string, unknown> = {}): Promise<void> {
    if (this.status === 'running') return

    this.context = this.createInitialContext()
    this.context.args = args
    this.status = 'running'
    this.emit({ type: 'start' })

    // Parse initial vars if defined
    if (this.flow.vars) {
      try {
        this.context.vars = this.parseVars(this.flow.vars)
      } catch (e) {
        this.status = 'error'
        this.emit({ type: 'error', data: { message: 'Failed to parse vars', error: e } })
        return
      }
    }

    // Find starting node (node with no incoming edges)
    const startNode = this.findStartNode()
    if (!startNode) {
      this.status = 'completed'
      this.emit({ type: 'complete' })
      return
    }

    this.context.currentNodeId = startNode.id
    await this.executeFlow()
  }

  async resume(): Promise<void> {
    if (this.status !== 'paused') return

    this.status = 'running'
    this.emit({ type: 'resume' })

    if (this.pausePromise) {
      this.pausePromise.resolve()
      this.pausePromise = null
    }
  }

  async step(): Promise<void> {
    if (this.status !== 'paused') return

    this.context.mode = 'step'
    await this.resume()
  }

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused'
      this.emit({ type: 'pause' })
    }
  }

  stop(): void {
    this.status = 'idle'
    this.context.currentNodeId = null
  }

  // Private execution methods

  private findStartNode(): FlowNode | null {
    const targetIds = new Set(this.flow.edges.map((e) => e.target))
    const startNodes = this.flow.nodes.filter((n) => !targetIds.has(n.id))
    return startNodes[0] || null
  }

  private async executeFlow(): Promise<void> {
    let iterations = 0

    while (this.context.currentNodeId && this.status === 'running') {
      iterations++
      if (iterations > this.config.maxIterations!) {
        this.status = 'error'
        this.emit({ type: 'error', data: { message: 'Max iterations exceeded' } })
        return
      }

      const node = this.nodeMap.get(this.context.currentNodeId)
      if (!node) {
        this.status = 'error'
        this.emit({ type: 'error', data: { message: `Node not found: ${this.context.currentNodeId}` } })
        return
      }

      // Check breakpoint
      if (this.context.breakpoints.has(node.id)) {
        this.status = 'paused'
        this.emit({ type: 'pause', nodeId: node.id })
        await this.waitForResume()
        if (this.status !== 'running') return
      }

      // Check step mode
      if (this.context.mode === 'step') {
        this.context.mode = 'run'
        this.status = 'paused'
        this.emit({ type: 'pause', nodeId: node.id })
        await this.waitForResume()
        if (this.status !== 'running') return
      }

      // Execute node
      const result = await this.executeNode(node)

      if (!result.success) {
        // Check for fail edge
        const failEdge = this.getEdgeByType(node.id, 'fail')
        if (failEdge) {
          this.context.currentNodeId = failEdge.target
        } else {
          this.status = 'error'
          this.emit({ type: 'error', nodeId: node.id, data: { error: result.error } })
          return
        }
      } else {
        // Determine next node
        this.context.currentNodeId = this.getNextNodeId(node, result)
      }
    }

    if (this.status === 'running') {
      this.status = 'completed'
      this.emit({ type: 'complete', data: { vars: this.context.vars } })
    }
  }

  private async waitForResume(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.pausePromise = { resolve }
    })
  }

  private async executeNode(node: FlowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now()
    this.emit({ type: 'nodeStart', nodeId: node.id })

    const historyEntry: ExecutionHistoryEntry = {
      nodeId: node.id,
      timestamp: startTime,
      state: 'running',
    }

    try {
      // Check 'only' condition
      if (node.data.only) {
        const shouldExecute = this.evaluateCondition(node.data.only)
        if (!shouldExecute) {
          historyEntry.state = 'skipped'
          this.context.history.push(historyEntry)
          return { success: true, nextNodeId: this.getDefaultNextNodeId(node.id) }
        }
      }

      const result = await this.executeNodeByType(node)

      historyEntry.state = result.success ? 'completed' : 'error'
      historyEntry.output = result.output
      historyEntry.error = result.error
      historyEntry.duration = Date.now() - startTime
      this.context.history.push(historyEntry)

      this.emit({
        type: result.success ? 'nodeComplete' : 'nodeError',
        nodeId: node.id,
        data: result,
      })

      return result
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e)
      historyEntry.state = 'error'
      historyEntry.error = error
      historyEntry.duration = Date.now() - startTime
      this.context.history.push(historyEntry)

      this.emit({ type: 'nodeError', nodeId: node.id, data: { error } })

      return { success: false, error }
    }
  }

  private async executeNodeByType(node: FlowNode): Promise<NodeExecutionResult> {
    const data = node.data

    switch (data.nodeType) {
      case 'exec':
        return this.executeExecNode(data)
      case 'mapping':
        return this.executeMappingNode(data)
      case 'condition':
        return this.executeConditionNode(data)
      case 'switch':
        return this.executeSwitchNode(data)
      case 'delay':
        return this.executeDelayNode(data)
      case 'each':
        return this.executeEachNode(node)
      case 'loop':
        return this.executeLoopNode(node)
      case 'agent':
        return this.executeAgentNode(data)
      case 'guard':
        return this.executeGuardNode(data)
      case 'approval':
        return this.executeApprovalNode(data)
      case 'mcp':
        return this.executeMCPNode(data)
      case 'handoff':
        return this.executeHandoffNode(data)
      default:
        return { success: false, error: `Unknown node type: ${(data as FlowNodeData).nodeType}` }
    }
  }

  private async executeExecNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const execData = data as FlowNodeData & { exec?: string; args?: string; with?: string; sets?: string }

    if (!execData.exec) {
      return { success: false, error: 'No exec URI specified' }
    }

    if (!this.config.toolHandler) {
      // Simulate tool execution
      console.log(`[Exec] ${execData.exec}`)
      return { success: true, output: { simulated: true } }
    }

    // Parse args
    const args = execData.args ? this.parseExpression(execData.args) : {}

    // Execute tool
    const result = await this.config.toolHandler(execData.exec, args as Record<string, unknown>, this.context)

    // Apply 'with' transformation
    let output = result
    if (execData.with) {
      output = this.applyWithTransform(execData.with, result)
    }

    // Apply 'sets' updates
    if (execData.sets) {
      this.applySetsUpdate(execData.sets, output)
    }

    return { success: true, output }
  }

  private async executeMappingNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const mappingData = data as FlowNodeData & { with?: string; sets?: string }

    if (mappingData.with) {
      const result = this.applyWithTransform(mappingData.with, this.context.vars)
      if (mappingData.sets) {
        this.applySetsUpdate(mappingData.sets, result)
      }
      return { success: true, output: result }
    }

    return { success: true }
  }

  private async executeConditionNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const condData = data as FlowNodeData & { when?: string }

    if (!condData.when) {
      return { success: true, branch: 'else' }
    }

    const result = this.evaluateCondition(condData.when)
    return { success: true, branch: result ? 'then' : 'else' }
  }

  private async executeSwitchNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const switchData = data as FlowNodeData & { cases?: Array<{ when: string; then: string }> }

    if (!switchData.cases || switchData.cases.length === 0) {
      return { success: true, branch: 'else' }
    }

    for (let i = 0; i < switchData.cases.length; i++) {
      const caseItem = switchData.cases[i]
      if (this.evaluateCondition(caseItem.when)) {
        return { success: true, branch: `case-${i}` }
      }
    }

    return { success: true, branch: 'else' }
  }

  private async executeDelayNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const delayData = data as FlowNodeData & { wait?: string | number }

    const ms = this.parseDelay(delayData.wait || '1s')
    await this.sleep(ms)

    return { success: true }
  }

  private async executeEachNode(node: FlowNode): Promise<NodeExecutionResult> {
    const data = node.data as FlowNodeData & { each?: string; subFlowNodes?: FlowNode[] }

    if (!data.each) {
      return { success: false, error: 'No each expression specified' }
    }

    // Parse "source => item, index" format
    const match = data.each.match(/(.+?)\s*=>\s*(\w+)(?:\s*,\s*(\w+))?/)
    if (!match) {
      return { success: false, error: 'Invalid each expression format' }
    }

    const [, sourceExpr, itemVar, indexVar] = match
    const source = this.parseExpression(sourceExpr)

    if (!Array.isArray(source)) {
      return { success: false, error: 'Each source must be an array' }
    }

    const results: unknown[] = []
    for (let i = 0; i < source.length; i++) {
      this.context.vars[itemVar] = source[i]
      if (indexVar) {
        this.context.vars[indexVar] = i
      }

      // Execute sub-flow if present
      if (data.subFlowNodes && data.subFlowNodes.length > 0) {
        // Sub-flow execution would go here
        results.push(source[i])
      } else {
        results.push(source[i])
      }
    }

    return { success: true, output: results }
  }

  private async executeLoopNode(node: FlowNode): Promise<NodeExecutionResult> {
    const data = node.data as FlowNodeData & { vars?: string; when?: string; subFlowNodes?: FlowNode[] }

    if (!data.when) {
      return { success: false, error: 'No loop condition specified' }
    }

    // Initialize vars
    if (data.vars) {
      this.applySetsUpdate(data.vars, {})
    }

    let iterations = 0
    while (this.evaluateCondition(data.when)) {
      iterations++
      if (iterations > this.config.maxIterations!) {
        return { success: false, error: 'Max loop iterations exceeded' }
      }

      // Execute sub-flow if present
      if (data.subFlowNodes && data.subFlowNodes.length > 0) {
        // Sub-flow execution would go here
      }
    }

    return { success: true, output: { iterations } }
  }

  private async executeAgentNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const agentData = data as FlowNodeData & {
      model?: string
      instructions?: string
      tools?: string[]
      outputFormat?: 'json' | 'markdown' | 'text'
      temperature?: number
    }

    if (!this.config.agentHandler) {
      console.log(`[Agent] Model: ${agentData.model}`)
      return { success: true, output: { simulated: true, response: 'Simulated agent response' } }
    }

    const result = await this.config.agentHandler(
      {
        model: agentData.model,
        instructions: agentData.instructions,
        tools: agentData.tools,
        outputFormat: agentData.outputFormat,
        temperature: agentData.temperature,
      },
      this.context.vars,
      this.context
    )

    return { success: true, output: result }
  }

  private async executeGuardNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const guardData = data as FlowNodeData & {
      guardTypes?: string[]
      action?: string
      schema?: object
      customExpression?: string
    }

    // Simulate guard checks
    const passed = true // Would perform actual validation

    if (!passed && guardData.action === 'block') {
      return { success: false, error: 'Guard validation failed', branch: 'else' }
    }

    return { success: true, branch: passed ? 'then' : 'else' }
  }

  private async executeApprovalNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const approvalData = data as FlowNodeData & {
      title?: string
      approvalDescription?: string
      timeout?: string
      timeoutAction?: string
    }

    if (!this.config.approvalHandler) {
      console.log(`[Approval] ${approvalData.title}`)
      return { success: true, output: { approved: true }, branch: 'then' }
    }

    const result = await this.config.approvalHandler(
      {
        title: approvalData.title || 'Approval Required',
        description: approvalData.approvalDescription,
        timeout: this.parseDelay(approvalData.timeout || '24h'),
        timeoutAction: approvalData.timeoutAction as 'approve' | 'reject',
      },
      this.context
    )

    return {
      success: true,
      output: result,
      branch: result.approved ? 'then' : 'else',
    }
  }

  private async executeMCPNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const mcpData = data as FlowNodeData & {
      server?: string
      tool?: string
      authType?: string
      authKey?: string
      args?: string
    }

    if (!mcpData.server || !mcpData.tool) {
      return { success: false, error: 'MCP server and tool required' }
    }

    if (!this.config.mcpHandler) {
      console.log(`[MCP] ${mcpData.server}/${mcpData.tool}`)
      return { success: true, output: { simulated: true } }
    }

    const args = mcpData.args ? this.parseExpression(mcpData.args) : {}

    const result = await this.config.mcpHandler(
      {
        server: mcpData.server,
        tool: mcpData.tool,
        authType: mcpData.authType,
        authKey: mcpData.authKey,
      },
      args as Record<string, unknown>,
      this.context
    )

    return { success: true, output: result }
  }

  private async executeHandoffNode(data: FlowNodeData): Promise<NodeExecutionResult> {
    const handoffData = data as FlowNodeData & {
      target?: string
      context?: string[]
      resumeOn?: string
    }

    if (!handoffData.target) {
      return { success: false, error: 'Handoff target required' }
    }

    console.log(`[Handoff] to ${handoffData.target}`)

    // In a real implementation, this would trigger a handoff to another agent
    return { success: true, output: { handedOff: true, target: handoffData.target } }
  }

  // Helper methods

  private getNextNodeId(node: FlowNode, result: NodeExecutionResult): string | null {
    if (result.nextNodeId !== undefined) {
      return result.nextNodeId
    }

    // Check for branch-specific edges
    if (result.branch) {
      const branchEdge = this.getEdgeByType(node.id, result.branch)
      if (branchEdge) {
        return branchEdge.target
      }
    }

    // Default to 'next' edge
    return this.getDefaultNextNodeId(node.id)
  }

  private getDefaultNextNodeId(nodeId: string): string | null {
    const edge = this.getEdgeByType(nodeId, 'next')
    return edge?.target || null
  }

  private getEdgeByType(sourceId: string, type: string): FlowEdge | undefined {
    const edges = this.edgeMap.get(sourceId) || []
    return edges.find((e) => e.data?.edgeType === type || e.sourceHandle === type)
  }

  private parseVars(varsExpr: string): Record<string, unknown> {
    // Simple var parsing: key = value per line
    const vars: Record<string, unknown> = {}
    const lines = varsExpr.split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/)
      if (match) {
        const [, key, valueExpr] = match
        vars[key] = this.parseExpression(valueExpr)
      }
    }
    return vars
  }

  private parseExpression(expr: string): unknown {
    // Simple expression evaluation
    const trimmed = expr.trim()

    // Number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed)
    }

    // Boolean
    if (trimmed === 'true') return true
    if (trimmed === 'false') return false

    // Null
    if (trimmed === 'null') return null

    // String (quoted)
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1)
    }

    // Variable reference
    if (/^[\w.]+$/.test(trimmed)) {
      return this.getVariable(trimmed)
    }

    // Return as string if can't parse
    return trimmed
  }

  private getVariable(path: string): unknown {
    const parts = path.split('.')
    let current: unknown = { ...this.context.vars, ...this.context.args }

    for (const part of parts) {
      if (current === null || current === undefined) return undefined
      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[part]
      } else {
        return undefined
      }
    }

    return current
  }

  private evaluateCondition(expr: string): boolean {
    // Simple condition evaluation
    const result = this.parseExpression(expr)
    return Boolean(result)
  }

  private applyWithTransform(withExpr: string, input: unknown): unknown {
    // Simple transformation - just return the input for now
    // In real implementation, would parse GML expressions
    return input
  }

  private applySetsUpdate(setsExpr: string, _value: unknown): void {
    // Parse and apply variable updates
    const lines = setsExpr.split('\n')
    for (const line of lines) {
      const match = line.match(/^\s*(\w+)\s*=\s*(.+?)\s*$/)
      if (match) {
        const [, key, valueExpr] = match
        this.context.vars[key] = this.parseExpression(valueExpr)
      }
    }
  }

  private parseDelay(delay: string | number): number {
    if (typeof delay === 'number') return delay

    const match = delay.match(/^(\d+)(ms|s|m|h)?$/)
    if (!match) return 1000

    const [, value, unit] = match
    const num = parseInt(value, 10)

    switch (unit) {
      case 'ms':
        return num
      case 's':
        return num * 1000
      case 'm':
        return num * 60 * 1000
      case 'h':
        return num * 60 * 60 * 1000
      default:
        return num * 1000
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
