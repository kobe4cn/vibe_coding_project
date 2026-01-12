/**
 * Flow Templates
 * Pre-defined flow templates for quick start
 */

import type { FlowModel } from '@/types/flow'

export interface FlowTemplate {
  id: string
  name: string
  description: string
  icon: 'api' | 'data' | 'ai' | 'loop' | 'branch' | 'blank'
  flow: FlowModel
}

/**
 * Empty flow template
 */
const emptyFlow: FlowModel = {
  meta: {
    name: '',
    description: '',
  },
  args: {
    inputs: [],
    outputs: [],
  },
  nodes: [],
  edges: [],
}

/**
 * API workflow template - HTTP request with data mapping
 */
const apiWorkflowTemplate: FlowModel = {
  meta: {
    name: 'API 工作流',
    description: 'HTTP 请求和数据处理',
  },
  args: {
    inputs: [
      { name: 'url', type: 'string', description: 'API URL' },
      { name: 'method', type: 'string', defaultValue: 'GET', description: 'HTTP 方法' },
    ],
    outputs: [
      { name: 'result', type: 'object', description: '处理后的结果' },
    ],
  },
  nodes: [
    {
      id: 'exec-1',
      type: 'exec',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'exec',
        label: 'HTTP 请求',
        exec: 'http://example.com/api',
        args: JSON.stringify({
          url: '${inputs.url}',
          method: '${inputs.method}',
        }),
      },
    },
    {
      id: 'mapping-1',
      type: 'mapping',
      position: { x: 350, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '数据映射',
        with: JSON.stringify({
          result: '${exec-1.data}',
        }),
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'exec-1', target: 'mapping-1', data: { edgeType: 'next' } },
  ],
}

/**
 * Conditional workflow template - with branching logic
 */
const conditionalWorkflowTemplate: FlowModel = {
  meta: {
    name: '条件工作流',
    description: '带条件分支的流程',
  },
  args: {
    inputs: [
      { name: 'value', type: 'number', description: '判断值' },
      { name: 'threshold', type: 'number', defaultValue: '10', description: '阈值' },
    ],
    outputs: [
      { name: 'result', type: 'string', description: '处理结果' },
    ],
  },
  nodes: [
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'condition',
        label: '条件判断',
        when: '${inputs.value} > ${inputs.threshold}',
      },
    },
    {
      id: 'mapping-true',
      type: 'mapping',
      position: { x: 350, y: 50 },
      data: {
        nodeType: 'mapping',
        label: '大于阈值',
        with: JSON.stringify({
          result: '"高于阈值"',
        }),
      },
    },
    {
      id: 'mapping-false',
      type: 'mapping',
      position: { x: 350, y: 200 },
      data: {
        nodeType: 'mapping',
        label: '小于等于阈值',
        with: JSON.stringify({
          result: '"低于或等于阈值"',
        }),
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'condition-1', sourceHandle: 'then', target: 'mapping-true', data: { edgeType: 'then' } },
    { id: 'e2', source: 'condition-1', sourceHandle: 'else', target: 'mapping-false', data: { edgeType: 'else' } },
  ],
}

/**
 * Loop workflow template - with iteration
 */
const loopWorkflowTemplate: FlowModel = {
  meta: {
    name: '循环工作流',
    description: '遍历数组数据',
  },
  args: {
    inputs: [
      { name: 'items', type: 'array', description: '要处理的数组' },
    ],
    outputs: [
      { name: 'results', type: 'array', description: '处理结果数组' },
    ],
  },
  nodes: [
    {
      id: 'each-1',
      type: 'each',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'each',
        label: '遍历数组',
        each: '${inputs.items} => item, index',
      },
    },
    {
      id: 'mapping-1',
      type: 'mapping',
      position: { x: 350, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '处理单项',
        with: JSON.stringify({
          processed: '${item}',
        }),
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'each-1', target: 'mapping-1', data: { edgeType: 'next' } },
  ],
}

/**
 * AI Agent workflow template
 */
const aiAgentTemplate: FlowModel = {
  meta: {
    name: 'AI Agent 工作流',
    description: 'AI 驱动的智能流程',
  },
  args: {
    inputs: [
      { name: 'prompt', type: 'string', description: '用户输入' },
      { name: 'context', type: 'string', description: '上下文信息' },
    ],
    outputs: [
      { name: 'response', type: 'string', description: 'AI 响应' },
    ],
  },
  nodes: [
    {
      id: 'mapping-1',
      type: 'mapping',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '准备提示词',
        with: JSON.stringify({
          fullPrompt: '`上下文: ${inputs.context}\n\n用户问题: ${inputs.prompt}`',
        }),
      },
    },
    {
      id: 'agent-1',
      type: 'agent',
      position: { x: 350, y: 100 },
      data: {
        nodeType: 'agent',
        label: 'AI Agent',
        model: 'gpt-4',
        instructions: '你是一个智能助手，请根据上下文回答用户问题。',
        args: JSON.stringify({
          prompt: '${mapping-1.fullPrompt}',
        }),
      },
    },
    {
      id: 'mapping-2',
      type: 'mapping',
      position: { x: 600, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '提取响应',
        with: JSON.stringify({
          response: '${agent-1.response}',
        }),
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'mapping-1', target: 'agent-1', data: { edgeType: 'next' } },
    { id: 'e2', source: 'agent-1', target: 'mapping-2', data: { edgeType: 'next' } },
  ],
}

/**
 * Data pipeline template
 */
const dataPipelineTemplate: FlowModel = {
  meta: {
    name: '数据管道',
    description: '多步骤数据处理',
  },
  args: {
    inputs: [
      { name: 'data', type: 'object', description: '输入数据' },
    ],
    outputs: [
      { name: 'transformed', type: 'object', description: '转换后的数据' },
    ],
  },
  nodes: [
    {
      id: 'mapping-1',
      type: 'mapping',
      position: { x: 100, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '数据验证',
        with: JSON.stringify({
          validated: '${inputs.data}',
        }),
      },
    },
    {
      id: 'mapping-2',
      type: 'mapping',
      position: { x: 350, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '数据转换',
        with: JSON.stringify({
          transformed: '${mapping-1.validated}',
        }),
      },
    },
    {
      id: 'mapping-3',
      type: 'mapping',
      position: { x: 600, y: 100 },
      data: {
        nodeType: 'mapping',
        label: '数据输出',
        with: JSON.stringify({
          result: '${mapping-2.transformed}',
        }),
      },
    },
  ],
  edges: [
    { id: 'e1', source: 'mapping-1', target: 'mapping-2', data: { edgeType: 'next' } },
    { id: 'e2', source: 'mapping-2', target: 'mapping-3', data: { edgeType: 'next' } },
  ],
}

/**
 * All available templates
 */
export const flowTemplates: FlowTemplate[] = [
  {
    id: 'blank',
    name: '空白流程',
    description: '从零开始创建',
    icon: 'blank',
    flow: emptyFlow,
  },
  {
    id: 'api-workflow',
    name: 'API 工作流',
    description: 'HTTP 请求和数据映射',
    icon: 'api',
    flow: apiWorkflowTemplate,
  },
  {
    id: 'conditional',
    name: '条件分支',
    description: '带条件判断的流程',
    icon: 'branch',
    flow: conditionalWorkflowTemplate,
  },
  {
    id: 'loop',
    name: '循环遍历',
    description: '遍历数组数据',
    icon: 'loop',
    flow: loopWorkflowTemplate,
  },
  {
    id: 'ai-agent',
    name: 'AI Agent',
    description: 'AI 驱动的智能流程',
    icon: 'ai',
    flow: aiAgentTemplate,
  },
  {
    id: 'data-pipeline',
    name: '数据管道',
    description: '多步骤数据处理',
    icon: 'data',
    flow: dataPipelineTemplate,
  },
]

/**
 * Get a template by ID
 */
export function getTemplate(id: string): FlowTemplate | undefined {
  return flowTemplates.find((t) => t.id === id)
}

/**
 * Apply template with custom name and description
 */
export function applyTemplate(
  template: FlowTemplate,
  name: string,
  description?: string
): FlowModel {
  return {
    ...template.flow,
    meta: {
      ...template.flow.meta,
      name,
      description: description || template.flow.meta.description,
    },
  }
}
