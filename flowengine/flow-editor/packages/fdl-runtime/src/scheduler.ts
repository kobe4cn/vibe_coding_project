/**
 * Parallel Execution Scheduler
 * Implements dependency-based parallel execution of flow nodes
 */

import type { FlowNode, FlowEdge } from '../../../src/types/flow'

export interface DependencyGraph {
  nodes: Map<string, NodeDependency>
  sorted: string[]
}

export interface NodeDependency {
  nodeId: string
  dependsOn: Set<string>
  dependents: Set<string>
  indegree: number
}

export interface ExecutionBatch {
  nodeIds: string[]
  batchIndex: number
}

/**
 * Build a dependency graph from flow nodes and edges
 */
export function buildDependencyGraph(
  nodes: FlowNode[],
  edges: FlowEdge[]
): DependencyGraph {
  const graph = new Map<string, NodeDependency>()

  // Initialize all nodes
  for (const node of nodes) {
    graph.set(node.id, {
      nodeId: node.id,
      dependsOn: new Set(),
      dependents: new Set(),
      indegree: 0,
    })
  }

  // Build dependencies from edges
  for (const edge of edges) {
    const source = graph.get(edge.source)
    const target = graph.get(edge.target)

    if (source && target) {
      source.dependents.add(edge.target)
      target.dependsOn.add(edge.source)
      target.indegree++
    }
  }

  // Topological sort using Kahn's algorithm
  const sorted = topologicalSort(graph)

  return { nodes: graph, sorted }
}

/**
 * Topological sort using Kahn's algorithm
 */
function topologicalSort(graph: Map<string, NodeDependency>): string[] {
  const sorted: string[] = []
  const queue: string[] = []

  // Clone indegrees to avoid mutation
  const indegrees = new Map<string, number>()
  for (const [id, dep] of graph) {
    indegrees.set(id, dep.indegree)
    if (dep.indegree === 0) {
      queue.push(id)
    }
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!
    sorted.push(nodeId)

    const node = graph.get(nodeId)
    if (node) {
      for (const dependent of node.dependents) {
        const currentIndegree = indegrees.get(dependent)!
        indegrees.set(dependent, currentIndegree - 1)
        if (currentIndegree - 1 === 0) {
          queue.push(dependent)
        }
      }
    }
  }

  // Check for cycles
  if (sorted.length !== graph.size) {
    throw new Error('Cycle detected in flow graph')
  }

  return sorted
}

/**
 * Get execution batches for parallel execution
 * Nodes in the same batch have no dependencies on each other
 */
export function getExecutionBatches(graph: DependencyGraph): ExecutionBatch[] {
  const batches: ExecutionBatch[] = []
  const completed = new Set<string>()
  const remaining = new Set(graph.sorted)

  let batchIndex = 0

  while (remaining.size > 0) {
    const batch: string[] = []

    for (const nodeId of remaining) {
      const node = graph.nodes.get(nodeId)!
      const allDependenciesMet = [...node.dependsOn].every((dep) =>
        completed.has(dep)
      )

      if (allDependenciesMet) {
        batch.push(nodeId)
      }
    }

    if (batch.length === 0) {
      throw new Error('Unable to make progress - possible cycle')
    }

    for (const nodeId of batch) {
      remaining.delete(nodeId)
      completed.add(nodeId)
    }

    batches.push({ nodeIds: batch, batchIndex })
    batchIndex++
  }

  return batches
}

/**
 * Scheduler class for managing parallel execution
 */
export class ParallelScheduler {
  private graph: DependencyGraph
  private completed: Set<string> = new Set()
  private running: Set<string> = new Set()
  private failed: Set<string> = new Set()
  private pending: Set<string>

  constructor(nodes: FlowNode[], edges: FlowEdge[]) {
    this.graph = buildDependencyGraph(nodes, edges)
    this.pending = new Set(this.graph.sorted)
  }

  /**
   * Get the next batch of nodes ready for execution
   */
  getReadyNodes(): string[] {
    const ready: string[] = []

    for (const nodeId of this.pending) {
      const node = this.graph.nodes.get(nodeId)!
      const allDependenciesMet = [...node.dependsOn].every(
        (dep) => this.completed.has(dep) || this.failed.has(dep)
      )

      // Don't execute if any dependency failed (unless it has a fail edge)
      const anyDependencyFailed = [...node.dependsOn].some((dep) =>
        this.failed.has(dep)
      )

      if (allDependenciesMet && !anyDependencyFailed) {
        ready.push(nodeId)
      }
    }

    return ready
  }

  /**
   * Mark a node as started
   */
  markStarted(nodeId: string): void {
    this.pending.delete(nodeId)
    this.running.add(nodeId)
  }

  /**
   * Mark a node as completed
   */
  markCompleted(nodeId: string): void {
    this.running.delete(nodeId)
    this.completed.add(nodeId)
  }

  /**
   * Mark a node as failed
   */
  markFailed(nodeId: string): void {
    this.running.delete(nodeId)
    this.failed.add(nodeId)
  }

  /**
   * Check if all nodes are done (completed or failed)
   */
  isDone(): boolean {
    return this.pending.size === 0 && this.running.size === 0
  }

  /**
   * Check if execution is blocked (has pending nodes but none are ready)
   */
  isBlocked(): boolean {
    return this.pending.size > 0 && this.running.size === 0 && this.getReadyNodes().length === 0
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    total: number
    completed: number
    failed: number
    running: number
    pending: number
  } {
    return {
      total: this.graph.nodes.size,
      completed: this.completed.size,
      failed: this.failed.size,
      running: this.running.size,
      pending: this.pending.size,
    }
  }

  /**
   * Get dependent nodes that should be skipped due to failure
   */
  getSkippedNodes(): string[] {
    const skipped: string[] = []

    for (const nodeId of this.pending) {
      const node = this.graph.nodes.get(nodeId)!
      const anyDependencyFailed = [...node.dependsOn].some((dep) =>
        this.failed.has(dep)
      )

      if (anyDependencyFailed) {
        skipped.push(nodeId)
      }
    }

    return skipped
  }

  /**
   * Execute nodes in parallel batches
   */
  async executeParallel<T>(
    executor: (nodeId: string) => Promise<{ success: boolean; result?: T }>
  ): Promise<Map<string, { success: boolean; result?: T }>> {
    const results = new Map<string, { success: boolean; result?: T }>()

    while (!this.isDone() && !this.isBlocked()) {
      const ready = this.getReadyNodes()

      if (ready.length === 0) {
        break
      }

      // Mark all ready nodes as started
      for (const nodeId of ready) {
        this.markStarted(nodeId)
      }

      // Execute all ready nodes in parallel
      const promises = ready.map(async (nodeId) => {
        try {
          const result = await executor(nodeId)
          results.set(nodeId, result)

          if (result.success) {
            this.markCompleted(nodeId)
          } else {
            this.markFailed(nodeId)
          }
        } catch {
          results.set(nodeId, { success: false })
          this.markFailed(nodeId)
        }
      })

      await Promise.all(promises)
    }

    // Mark skipped nodes
    for (const nodeId of this.getSkippedNodes()) {
      results.set(nodeId, { success: false })
      this.pending.delete(nodeId)
      this.failed.add(nodeId)
    }

    return results
  }
}

/**
 * Utility function to find convergence points (nodes with multiple incoming edges)
 */
export function findConvergencePoints(edges: FlowEdge[]): Set<string> {
  const incomingCount = new Map<string, number>()

  for (const edge of edges) {
    const count = incomingCount.get(edge.target) || 0
    incomingCount.set(edge.target, count + 1)
  }

  const convergencePoints = new Set<string>()
  for (const [nodeId, count] of incomingCount) {
    if (count > 1) {
      convergencePoints.add(nodeId)
    }
  }

  return convergencePoints
}

/**
 * Utility function to find fork points (nodes with multiple outgoing edges)
 */
export function findForkPoints(edges: FlowEdge[]): Set<string> {
  const outgoingCount = new Map<string, number>()

  for (const edge of edges) {
    const count = outgoingCount.get(edge.source) || 0
    outgoingCount.set(edge.source, count + 1)
  }

  const forkPoints = new Set<string>()
  for (const [nodeId, count] of outgoingCount) {
    if (count > 1) {
      forkPoints.add(nodeId)
    }
  }

  return forkPoints
}
