/**
 * FDL Flow Executor Unit Tests
 * Focus on sub-flow execution (each and loop nodes)
 */

import { describe, it, expect } from 'vitest'
import type { FlowModel, FlowNode, FlowEdge } from '../../../src/types/flow'
import { FlowExecutor } from './executor'
import type { ExecutionEvent } from './types'

// Helper to create test nodes
function createNode(
  id: string,
  type: string,
  data: Record<string, unknown> = {}
): FlowNode {
  return {
    id,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: { nodeType: type, label: id, ...data },
  }
}

// Helper to create test edges
function createEdge(source: string, target: string, type = 'next'): FlowEdge {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    sourceHandle: type,
    data: { edgeType: type },
  }
}

describe('FlowExecutor - Basic Execution', () => {
  it('should execute a simple linear flow', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'result = 1' }),
        createNode('B', 'mapping', { sets: 'result = result + 1' }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getStatus()).toBe('completed')
    expect(executor.getContext().vars.result).toBe(2)
  })

  it('should pass args to flow', async () => {
    const flow: FlowModel = {
      nodes: [createNode('A', 'mapping', { sets: 'output = input * 2' })],
      edges: [],
    }

    const executor = new FlowExecutor(flow)
    await executor.start({ input: 5 })

    expect(executor.getContext().vars.output).toBe(10)
  })

  it('should handle condition nodes', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'condition', { when: 'x > 0' }),
        createNode('B', 'mapping', { sets: 'result = "positive"' }),
        createNode('C', 'mapping', { sets: 'result = "non-positive"' }),
      ],
      edges: [createEdge('A', 'B', 'then'), createEdge('A', 'C', 'else')],
    }

    const executor1 = new FlowExecutor(flow)
    await executor1.start({ x: 5 })
    expect(executor1.getContext().vars.result).toBe('positive')

    const executor2 = new FlowExecutor(flow)
    await executor2.start({ x: -5 })
    expect(executor2.getContext().vars.result).toBe('non-positive')
  })

  it('should handle switch nodes', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'switch', {
          cases: [
            { when: 'status == "active"', then: 'active' },
            { when: 'status == "pending"', then: 'pending' },
          ],
        }),
        createNode('B', 'mapping', { sets: 'result = "is-active"' }),
        createNode('C', 'mapping', { sets: 'result = "is-pending"' }),
        createNode('D', 'mapping', { sets: 'result = "is-other"' }),
      ],
      edges: [
        createEdge('A', 'B', 'case-0'),
        createEdge('A', 'C', 'case-1'),
        createEdge('A', 'D', 'else'),
      ],
    }

    const executor1 = new FlowExecutor(flow)
    await executor1.start({ status: 'active' })
    expect(executor1.getContext().vars.result).toBe('is-active')

    const executor2 = new FlowExecutor(flow)
    await executor2.start({ status: 'pending' })
    expect(executor2.getContext().vars.result).toBe('is-pending')

    const executor3 = new FlowExecutor(flow)
    await executor3.start({ status: 'unknown' })
    expect(executor3.getContext().vars.result).toBe('is-other')
  })
})

describe('FlowExecutor - Each Node (Collection Iteration)', () => {
  it('should iterate over array with each node', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2, 3]' }),
        createNode('B', 'each', {
          each: 'items => item, index',
          sets: 'results = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getStatus()).toBe('completed')
    expect(executor.getContext().vars.results).toEqual([1, 2, 3])
  })

  it('should execute sub-flow for each item', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: '$result = item * 2' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2, 3]' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [],
          sets: 'doubled = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getContext().vars.doubled).toEqual([2, 4, 6])
  })

  it('should provide index variable in each iteration', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: '$result = { item: item, idx: idx }' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = ["a", "b", "c"]' }),
        createNode('B', 'each', {
          each: 'items => item, idx',
          subFlowNodes: subNodes,
          subFlowEdges: [],
          sets: 'indexed = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getContext().vars.indexed).toEqual([
      { item: 'a', idx: 0 },
      { item: 'b', idx: 1 },
      { item: 'c', idx: 2 },
    ])
  })

  it('should execute each items in parallel when parallel=true', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'delay', { wait: '10ms' }),
      createNode('sub-B', 'mapping', { sets: '$result = item' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2, 3, 4, 5]' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [createEdge('sub-A', 'sub-B')],
          parallel: true,
          sets: 'results = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const events: ExecutionEvent[] = []
    const executor = new FlowExecutor(flow, {
      onEvent: (event) => events.push(event),
    })

    await executor.start()

    // All items should complete
    expect(executor.getContext().vars.results).toEqual([1, 2, 3, 4, 5])
  })

  it('should handle empty array gracefully', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = []' }),
        createNode('B', 'each', {
          each: 'items => item',
          sets: 'results = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getStatus()).toBe('completed')
    expect(executor.getContext().vars.results).toEqual([])
  })

  it('should maintain variable isolation between iterations', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: 'temp = item * 2' }),
      createNode('sub-B', 'mapping', { sets: '$result = temp' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2, 3]' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [createEdge('sub-A', 'sub-B')],
          sets: 'results = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getContext().vars.results).toEqual([2, 4, 6])
    // temp should not leak to outer scope
    expect(executor.getContext().vars.temp).toBeUndefined()
  })
})

describe('FlowExecutor - Loop Node (Conditional Iteration)', () => {
  it('should execute loop with when condition', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'count = 0' }),
        createNode('B', 'loop', {
          when: 'count < 3',
          sets: 'count = count + 1',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getStatus()).toBe('completed')
    expect(executor.getContext().vars.count).toBe(3)
  })

  it('should execute loop with until condition', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'count = 0' }),
        createNode('B', 'loop', {
          until: 'count >= 5',
          sets: 'count = count + 1',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getContext().vars.count).toBe(5)
  })

  it('should execute sub-flow in each loop iteration', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: 'sum = sum + $iteration' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'sum = 0' }),
        createNode('B', 'loop', {
          when: '$iteration < 4',
          subFlowNodes: subNodes,
          subFlowEdges: [],
          sets: 'sum = sum',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    // Sum of 1 + 2 + 3 = 6
    expect(executor.getContext().vars.sum).toBe(6)
  })

  it('should handle break signal in loop', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', {
        sets: '$break = $iteration >= 2',
      }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'iterations = 0' }),
        createNode('B', 'loop', {
          when: 'iterations < 10',
          subFlowNodes: subNodes,
          subFlowEdges: [],
          sets: 'iterations = $iteration',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    // Should break after iteration 2
    expect(executor.getContext().vars.iterations).toBeLessThanOrEqual(2)
  })

  it('should enforce max iterations limit', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'loop', {
          when: 'true', // Infinite loop
        }),
      ],
      edges: [],
    }

    const executor = new FlowExecutor(flow, { maxIterations: 5 })
    await executor.start()

    expect(executor.getStatus()).toBe('error')
  })

  it('should track iteration variable', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: '$result = $iteration' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'loop', {
          when: '$iteration <= 3',
          subFlowNodes: subNodes,
          subFlowEdges: [],
        }),
      ],
      edges: [],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    // Loop completes 3 iterations (when $iteration = 1, 2, 3)
    // $iteration is incremented before condition check, so it's 4 when loop exits
    expect(executor.getContext().vars.$iteration).toBe(4)
    // But $results should contain results from 3 iterations
    expect(executor.getContext().vars.$results).toEqual([1, 2, 3])
  })
})

describe('FlowExecutor - Variable Scoping', () => {
  it('should access outer scope variables in sub-flow', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: '$result = item + multiplier' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2, 3]\nmultiplier = 10' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [],
          sets: 'results = $results',
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getContext().vars.results).toEqual([11, 12, 13])
  })

  it('should not modify outer scope from sub-flow (unless explicitly set)', async () => {
    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: 'outerVar = 999' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1]\nouterVar = 1' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [],
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    // outerVar should remain unchanged
    expect(executor.getContext().vars.outerVar).toBe(1)
  })
})

describe('FlowExecutor - Events', () => {
  it('should emit events during execution', async () => {
    const events: ExecutionEvent[] = []

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'x = 1' }),
        createNode('B', 'mapping', { sets: 'y = 2' }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow, {
      onEvent: (event) => events.push(event),
    })

    await executor.start()

    expect(events.some((e) => e.type === 'start')).toBe(true)
    expect(events.some((e) => e.type === 'nodeStart' && e.nodeId === 'A')).toBe(true)
    expect(events.some((e) => e.type === 'nodeComplete' && e.nodeId === 'A')).toBe(true)
    expect(events.some((e) => e.type === 'nodeStart' && e.nodeId === 'B')).toBe(true)
    expect(events.some((e) => e.type === 'nodeComplete' && e.nodeId === 'B')).toBe(true)
    expect(events.some((e) => e.type === 'complete')).toBe(true)
  })

  it('should emit iteration events for each node', async () => {
    const events: ExecutionEvent[] = []

    const subNodes: FlowNode[] = [
      createNode('sub-A', 'mapping', { sets: '$result = item' }),
    ]

    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'items = [1, 2]' }),
        createNode('B', 'each', {
          each: 'items => item',
          subFlowNodes: subNodes,
          subFlowEdges: [],
        }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow, {
      onEvent: (event) => events.push(event),
    })

    await executor.start()

    // Should have events for each iteration
    const iterationEvents = events.filter((e) => e.nodeId?.includes('['))
    expect(iterationEvents.length).toBeGreaterThan(0)
  })
})

describe('FlowExecutor - Breakpoints and Debugging', () => {
  it('should manage breakpoints', () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'mapping', { sets: 'x = 1' }),
        createNode('B', 'mapping', { sets: 'y = 2' }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)

    // Test setting breakpoints
    executor.setBreakpoint('A')
    executor.setBreakpoint('B')
    expect(executor.getBreakpoints()).toContain('A')
    expect(executor.getBreakpoints()).toContain('B')

    // Test removing breakpoints
    executor.removeBreakpoint('A')
    expect(executor.getBreakpoints()).not.toContain('A')
    expect(executor.getBreakpoints()).toContain('B')

    // Test clearing breakpoints
    executor.clearBreakpoints()
    expect(executor.getBreakpoints()).toEqual([])
  })

  it('should pause and resume execution', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'delay', { wait: '100ms' }),
        createNode('B', 'mapping', { sets: 'done = true' }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const executor = new FlowExecutor(flow)
    const startPromise = executor.start()

    // Wait a bit then pause
    await new Promise((resolve) => setTimeout(resolve, 30))
    executor.pause()

    // Should be running or paused at this point
    const status = executor.getStatus()
    expect(['running', 'paused', 'completed']).toContain(status)

    if (status === 'paused') {
      await executor.resume()
    }

    await startPromise
    expect(executor.getStatus()).toBe('completed')
  })
})

describe('FlowExecutor - Delay Node', () => {
  it('should pause execution for specified duration', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'delay', { wait: '50ms' }),
        createNode('B', 'mapping', { sets: 'done = true' }),
      ],
      edges: [createEdge('A', 'B')],
    }

    const start = Date.now()
    const executor = new FlowExecutor(flow)
    await executor.start()
    const duration = Date.now() - start

    expect(executor.getStatus()).toBe('completed')
    expect(executor.getContext().vars.done).toBe(true)
    expect(duration).toBeGreaterThanOrEqual(45) // Allow some timing tolerance
  })

  it('should handle different time units', async () => {
    const flow1: FlowModel = {
      nodes: [createNode('A', 'delay', { wait: '10ms' })],
      edges: [],
    }

    const flow2: FlowModel = {
      nodes: [createNode('A', 'delay', { wait: 10 })],
      edges: [],
    }

    const executor1 = new FlowExecutor(flow1)
    await executor1.start()
    expect(executor1.getStatus()).toBe('completed')

    const executor2 = new FlowExecutor(flow2)
    await executor2.start()
    expect(executor2.getStatus()).toBe('completed')
  })
})

describe('FlowExecutor - Error Handling', () => {
  it('should handle exec node with no tool handler', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'exec', { exec: 'api://test/endpoint' }),
      ],
      edges: [],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    // Should complete with simulated output
    expect(executor.getStatus()).toBe('completed')
  })

  it('should follow fail edge on error', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'exec', { exec: 'api://test/endpoint' }),
        createNode('B', 'mapping', { sets: 'result = "success"' }),
        createNode('C', 'mapping', { sets: 'result = "failed"' }),
      ],
      edges: [createEdge('A', 'B'), createEdge('A', 'C', 'fail')],
    }

    const executor = new FlowExecutor(flow, {
      toolHandler: async () => {
        throw new Error('Tool error')
      },
    })

    await executor.start()

    expect(executor.getContext().vars.result).toBe('failed')
  })

  it('should error on invalid each expression', async () => {
    const flow: FlowModel = {
      nodes: [
        createNode('A', 'each', { each: 'invalid format' }),
      ],
      edges: [],
    }

    const executor = new FlowExecutor(flow)
    await executor.start()

    expect(executor.getStatus()).toBe('error')
  })
})
