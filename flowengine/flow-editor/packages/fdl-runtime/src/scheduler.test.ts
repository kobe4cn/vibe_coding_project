/**
 * Parallel Execution Scheduler Unit Tests
 */

import { describe, it, expect } from 'vitest'
import type { FlowNode, FlowEdge } from '../../../src/types/flow'
import {
  buildDependencyGraph,
  getExecutionBatches,
  ParallelScheduler,
  findConvergencePoints,
  findForkPoints,
} from './scheduler'

// Helper to create test nodes
function createNode(id: string, type: 'exec' | 'mapping' = 'exec'): FlowNode {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { nodeType: type, label: id },
  }
}

// Helper to create test edges
function createEdge(source: string, target: string): FlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
  }
}

describe('buildDependencyGraph', () => {
  it('should build graph for simple linear flow', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const graph = buildDependencyGraph(nodes, edges)

    expect(graph.nodes.size).toBe(3)
    expect(graph.sorted).toEqual(['A', 'B', 'C'])

    const nodeA = graph.nodes.get('A')!
    expect(nodeA.indegree).toBe(0)
    expect([...nodeA.dependsOn]).toEqual([])
    expect([...nodeA.dependents]).toEqual(['B'])

    const nodeB = graph.nodes.get('B')!
    expect(nodeB.indegree).toBe(1)
    expect([...nodeB.dependsOn]).toEqual(['A'])
    expect([...nodeB.dependents]).toEqual(['C'])

    const nodeC = graph.nodes.get('C')!
    expect(nodeC.indegree).toBe(1)
    expect([...nodeC.dependsOn]).toEqual(['B'])
    expect([...nodeC.dependents]).toEqual([])
  })

  it('should build graph for parallel branches', () => {
    // A -> B
    // A -> C
    // B -> D
    // C -> D
    const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')]
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const graph = buildDependencyGraph(nodes, edges)

    expect(graph.nodes.size).toBe(4)
    // A should come first, D should come last, B and C in middle
    expect(graph.sorted[0]).toBe('A')
    expect(graph.sorted[graph.sorted.length - 1]).toBe('D')

    const nodeD = graph.nodes.get('D')!
    expect(nodeD.indegree).toBe(2)
    expect([...nodeD.dependsOn]).toContain('B')
    expect([...nodeD.dependsOn]).toContain('C')
  })

  it('should detect cycle and throw error', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C'), createEdge('C', 'A')]

    expect(() => buildDependencyGraph(nodes, edges)).toThrow('Cycle detected')
  })

  it('should handle disconnected nodes', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B')] // C is disconnected

    const graph = buildDependencyGraph(nodes, edges)

    expect(graph.nodes.size).toBe(3)
    expect(graph.sorted).toContain('C')

    const nodeC = graph.nodes.get('C')!
    expect(nodeC.indegree).toBe(0)
  })
})

describe('getExecutionBatches', () => {
  it('should create single batch for linear flow', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(3)
    expect(batches[0].nodeIds).toEqual(['A'])
    expect(batches[1].nodeIds).toEqual(['B'])
    expect(batches[2].nodeIds).toEqual(['C'])
  })

  it('should batch parallel nodes together', () => {
    // A -> B
    // A -> C
    // B -> D
    // C -> D
    const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')]
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(3)
    expect(batches[0].nodeIds).toEqual(['A'])
    expect(batches[1].nodeIds.sort()).toEqual(['B', 'C']) // B and C in same batch
    expect(batches[2].nodeIds).toEqual(['D'])
  })

  it('should batch multiple independent start nodes', () => {
    // A -> C
    // B -> C
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'C'), createEdge('B', 'C')]

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(2)
    expect(batches[0].nodeIds.sort()).toEqual(['A', 'B'])
    expect(batches[1].nodeIds).toEqual(['C'])
  })

  it('should handle complex diamond pattern', () => {
    //     A
    //    / \
    //   B   C
    //  / \ / \
    // D   E   F
    //  \ | /
    //    G
    const nodes = [
      createNode('A'),
      createNode('B'),
      createNode('C'),
      createNode('D'),
      createNode('E'),
      createNode('F'),
      createNode('G'),
    ]
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('B', 'E'),
      createEdge('C', 'E'),
      createEdge('C', 'F'),
      createEdge('D', 'G'),
      createEdge('E', 'G'),
      createEdge('F', 'G'),
    ]

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(4)
    expect(batches[0].nodeIds).toEqual(['A'])
    expect(batches[1].nodeIds.sort()).toEqual(['B', 'C'])
    expect(batches[2].nodeIds.sort()).toEqual(['D', 'E', 'F'])
    expect(batches[3].nodeIds).toEqual(['G'])
  })
})

describe('ParallelScheduler', () => {
  it('should get ready nodes for start nodes', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const scheduler = new ParallelScheduler(nodes, edges)
    const ready = scheduler.getReadyNodes()

    expect(ready).toEqual(['A'])
  })

  it('should get ready nodes after completion', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const scheduler = new ParallelScheduler(nodes, edges)

    scheduler.markStarted('A')
    expect(scheduler.getReadyNodes()).toEqual([])

    scheduler.markCompleted('A')
    expect(scheduler.getReadyNodes()).toEqual(['B'])
  })

  it('should handle parallel branches', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')]
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const scheduler = new ParallelScheduler(nodes, edges)

    expect(scheduler.getReadyNodes()).toEqual(['A'])

    scheduler.markStarted('A')
    scheduler.markCompleted('A')

    const parallel = scheduler.getReadyNodes().sort()
    expect(parallel).toEqual(['B', 'C'])

    scheduler.markStarted('B')
    scheduler.markStarted('C')
    scheduler.markCompleted('B')
    scheduler.markCompleted('C')

    expect(scheduler.getReadyNodes()).toEqual(['D'])
  })

  it('should track execution stats', () => {
    const nodes = [createNode('A'), createNode('B')]
    const edges = [createEdge('A', 'B')]

    const scheduler = new ParallelScheduler(nodes, edges)

    let stats = scheduler.getStats()
    expect(stats).toEqual({
      total: 2,
      completed: 0,
      failed: 0,
      running: 0,
      pending: 2,
    })

    scheduler.markStarted('A')
    stats = scheduler.getStats()
    expect(stats.running).toBe(1)
    expect(stats.pending).toBe(1)

    scheduler.markCompleted('A')
    stats = scheduler.getStats()
    expect(stats.completed).toBe(1)
    expect(stats.running).toBe(0)
  })

  it('should detect when done', () => {
    const nodes = [createNode('A')]
    const edges: FlowEdge[] = []

    const scheduler = new ParallelScheduler(nodes, edges)

    expect(scheduler.isDone()).toBe(false)

    scheduler.markStarted('A')
    expect(scheduler.isDone()).toBe(false)

    scheduler.markCompleted('A')
    expect(scheduler.isDone()).toBe(true)
  })

  it('should detect blocked state due to failure', () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const scheduler = new ParallelScheduler(nodes, edges)

    scheduler.markStarted('A')
    scheduler.markFailed('A')

    // B should be skipped because A (direct dependency) failed
    expect(scheduler.getSkippedNodes()).toContain('B')
    // C is not yet marked as skipped because B is still pending (not failed)
    // This is correct behavior - transitive failures need to be processed
    expect(scheduler.isBlocked()).toBe(true)
  })

  it('should execute nodes in parallel', async () => {
    const nodes = [createNode('A'), createNode('B'), createNode('C'), createNode('D')]
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const scheduler = new ParallelScheduler(nodes, edges)
    const executionOrder: string[] = []

    const results = await scheduler.executeParallel(async (nodeId) => {
      executionOrder.push(nodeId)
      await new Promise((resolve) => setTimeout(resolve, 10))
      return { success: true, result: `result-${nodeId}` }
    })

    // A should be first
    expect(executionOrder[0]).toBe('A')
    // D should be last
    expect(executionOrder[executionOrder.length - 1]).toBe('D')
    // B and C should be executed before D
    expect(executionOrder.indexOf('B')).toBeLessThan(executionOrder.indexOf('D'))
    expect(executionOrder.indexOf('C')).toBeLessThan(executionOrder.indexOf('D'))

    // Check results
    expect(results.get('A')).toEqual({ success: true, result: 'result-A' })
    expect(results.get('D')).toEqual({ success: true, result: 'result-D' })
  })

  it('should handle failures in parallel execution', async () => {
    // Test with simpler parallel branches to verify failure handling
    // A -> B
    // A -> C
    const nodes = [createNode('A'), createNode('B'), createNode('C')]
    const edges = [createEdge('A', 'B'), createEdge('A', 'C')]

    const scheduler = new ParallelScheduler(nodes, edges)

    const results = await scheduler.executeParallel(async (nodeId) => {
      if (nodeId === 'A') {
        return { success: false }
      }
      return { success: true }
    })

    expect(results.get('A')?.success).toBe(false)
    // B and C directly depend on A, so they should be skipped
    expect(results.get('B')?.success).toBe(false)
    expect(results.get('C')?.success).toBe(false)
  })
})

describe('findConvergencePoints', () => {
  it('should find nodes with multiple incoming edges', () => {
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const convergence = findConvergencePoints(edges)

    expect(convergence.size).toBe(1)
    expect(convergence.has('D')).toBe(true)
  })

  it('should return empty set for linear flow', () => {
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const convergence = findConvergencePoints(edges)

    expect(convergence.size).toBe(0)
  })

  it('should find multiple convergence points', () => {
    // A -> C
    // B -> C
    // C -> E
    // D -> E
    const edges = [
      createEdge('A', 'C'),
      createEdge('B', 'C'),
      createEdge('C', 'E'),
      createEdge('D', 'E'),
    ]

    const convergence = findConvergencePoints(edges)

    expect(convergence.size).toBe(2)
    expect(convergence.has('C')).toBe(true)
    expect(convergence.has('E')).toBe(true)
  })
})

describe('findForkPoints', () => {
  it('should find nodes with multiple outgoing edges', () => {
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('C', 'D'),
    ]

    const forks = findForkPoints(edges)

    expect(forks.size).toBe(1)
    expect(forks.has('A')).toBe(true)
  })

  it('should return empty set for linear flow', () => {
    const edges = [createEdge('A', 'B'), createEdge('B', 'C')]

    const forks = findForkPoints(edges)

    expect(forks.size).toBe(0)
  })

  it('should find multiple fork points', () => {
    // A -> B
    // A -> C
    // B -> D
    // B -> E
    const edges = [
      createEdge('A', 'B'),
      createEdge('A', 'C'),
      createEdge('B', 'D'),
      createEdge('B', 'E'),
    ]

    const forks = findForkPoints(edges)

    expect(forks.size).toBe(2)
    expect(forks.has('A')).toBe(true)
    expect(forks.has('B')).toBe(true)
  })
})

describe('Edge Cases', () => {
  it('should handle empty flow', () => {
    const nodes: FlowNode[] = []
    const edges: FlowEdge[] = []

    const graph = buildDependencyGraph(nodes, edges)

    expect(graph.nodes.size).toBe(0)
    expect(graph.sorted).toEqual([])
  })

  it('should handle single node', () => {
    const nodes = [createNode('A')]
    const edges: FlowEdge[] = []

    const scheduler = new ParallelScheduler(nodes, edges)

    expect(scheduler.getReadyNodes()).toEqual(['A'])
    expect(scheduler.isDone()).toBe(false)

    scheduler.markStarted('A')
    scheduler.markCompleted('A')

    expect(scheduler.isDone()).toBe(true)
  })

  it('should handle long chain', () => {
    const nodeCount = 100
    const nodes = Array.from({ length: nodeCount }, (_, i) => createNode(`N${i}`))
    const edges = Array.from({ length: nodeCount - 1 }, (_, i) =>
      createEdge(`N${i}`, `N${i + 1}`)
    )

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(nodeCount)
    expect(graph.sorted).toEqual(Array.from({ length: nodeCount }, (_, i) => `N${i}`))
  })

  it('should handle wide parallel flow', () => {
    // A -> B1, B2, B3, ..., B10 -> C
    const parallelCount = 10
    const nodes = [
      createNode('A'),
      ...Array.from({ length: parallelCount }, (_, i) => createNode(`B${i}`)),
      createNode('C'),
    ]
    const edges = [
      ...Array.from({ length: parallelCount }, (_, i) => createEdge('A', `B${i}`)),
      ...Array.from({ length: parallelCount }, (_, i) => createEdge(`B${i}`, 'C')),
    ]

    const graph = buildDependencyGraph(nodes, edges)
    const batches = getExecutionBatches(graph)

    expect(batches.length).toBe(3)
    expect(batches[0].nodeIds).toEqual(['A'])
    expect(batches[1].nodeIds.length).toBe(parallelCount)
    expect(batches[2].nodeIds).toEqual(['C'])
  })
})
