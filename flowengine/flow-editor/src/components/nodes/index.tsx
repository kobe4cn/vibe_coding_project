/**
 * Node Components
 * All flow node type implementations
 */

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import type {
  StartNodeData,
  ExecNodeData,
  MappingNodeData,
  ConditionNodeData,
  SwitchNodeData,
  DelayNodeData,
  EachNodeData,
  LoopNodeData,
  AgentNodeData,
  GuardNodeData,
  ApprovalNodeData,
  MCPNodeData,
  HandoffNodeData,
  OSSNodeData,
  MQNodeData,
  MailNodeData,
  SMSNodeData,
  ServiceNodeData,
} from '@/types/flow'

// Lucide style SVG icons - consistent with NodePalette and PropertyPanel
const Icons = {
  // 开始节点 - Play Circle icon
  start: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // 工具调用 - Play/Execute icon
  exec: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 3 20 12 6 21 6 3"/>
    </svg>
  ),
  // 数据映射 - Shuffle/Transform icon
  mapping: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>
      <path d="m18 2 4 4-4 4"/>
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>
      <path d="m18 14 4 4-4 4"/>
    </svg>
  ),
  // 条件跳转 - Git Branch/Split icon
  condition: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <path d="M6 9v12"/>
      <circle cx="18" cy="9" r="3"/>
      <path d="M6 12c0-3.3 2.7-6 6-6h3"/>
    </svg>
  ),
  // 多分支跳转 - Route/Network icon
  switch: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="18" cy="18" r="3"/>
      <path d="M9 12h6"/>
      <path d="M9 12l6-5"/>
      <path d="M9 12l6 5"/>
    </svg>
  ),
  // 延迟执行 - Clock/Timer icon
  delay: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  // 集合遍历 - Activity/Each icon
  each: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4"/>
    </svg>
  ),
  // 条件循环 - Repeat/Loop icon
  loop: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="m7 22-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  // AI Agent - Bot icon
  agent: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  ),
  // 安全校验 - Shield Check icon
  guard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  // 人工审批 - User Check icon
  approval: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
  // MCP 工具 - Plug icon
  mcp: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5"/>
      <path d="M9 8V2"/>
      <path d="M15 8V2"/>
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>
    </svg>
  ),
  // Agent 移交 - Arrow Right icon
  handoff: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  // 对象存储 - Cloud Storage icon
  oss: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M12 12v9"/>
      <path d="m8 17 4 4 4-4"/>
    </svg>
  ),
  // 消息队列 - Queue icon
  mq: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <path d="M10 6h4"/>
      <path d="M6 10v4"/>
      <path d="M10 17.5h4"/>
    </svg>
  ),
  // 邮件发送 - Mail icon
  mail: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  // 短信发送 - Message icon
  sms: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 10h.01"/>
      <path d="M12 10h.01"/>
      <path d="M16 10h.01"/>
    </svg>
  ),
  // 微服务调用 - Server icon
  service: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
}

// Node props interface matching React Flow's structure
interface NodeComponentProps<T> {
  data: T
  selected?: boolean
}

// Start Node - Flow entry point
export const StartNode = memo(function StartNode({
  data,
  selected,
}: NodeComponentProps<StartNodeData>) {
  const paramCount = data.parameters?.length || 0

  return (
    <BaseNode
      nodeType="start"
      label={data.label}
      description={data.description}
      icon={Icons.start}
      selected={selected}
      showTargetHandle={false}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600">
        {paramCount > 0 ? (
          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">
            {paramCount} 个输入参数
          </span>
        ) : (
          <span className="text-gray-400">无输入参数</span>
        )}
      </div>
    </BaseNode>
  )
})

// Exec Node - Tool/API call
export const ExecNode = memo(function ExecNode({
  data,
  selected,
}: NodeComponentProps<ExecNodeData>) {
  return (
    <BaseNode
      nodeType="exec"
      label={data.label}
      description={data.description}
      icon={Icons.exec}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.exec || '未配置'}
      </div>
    </BaseNode>
  )
})

// Mapping Node - Data transformation
export const MappingNode = memo(function MappingNode({
  data,
  selected,
}: NodeComponentProps<MappingNodeData>) {
  return (
    <BaseNode
      nodeType="mapping"
      label={data.label}
      description={data.description}
      icon={Icons.mapping}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      {data.with && (
        <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded line-clamp-2">
          {data.with}
        </div>
      )}
    </BaseNode>
  )
})

// Condition Node - If/else branch
export const ConditionNode = memo(function ConditionNode({
  data,
  selected,
}: NodeComponentProps<ConditionNodeData>) {
  return (
    <BaseNode
      nodeType="condition"
      label={data.label}
      description={data.description}
      icon={Icons.condition}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
      sourceHandles={[
        { id: 'then', label: 'then', position: Position.Right },
        { id: 'else', label: 'else', position: Position.Left },
      ]}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
        {data.when || '未配置条件'}
      </div>
      <div className="flex justify-between text-xs mt-2">
        <span className="text-red-500">Else ←</span>
        <span className="text-green-500">→ Then</span>
      </div>
    </BaseNode>
  )
})

// Switch Node - Multi-branch
export const SwitchNode = memo(function SwitchNode({
  data,
  selected,
}: NodeComponentProps<SwitchNodeData>) {
  const caseHandles = data.cases.map((_, i) => ({
    id: `case-${i}`,
    label: `Case ${i + 1}`,
    position: Position.Bottom,
  }))

  return (
    <BaseNode
      nodeType="switch"
      label={data.label}
      description={data.description}
      icon={Icons.switch}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
      sourceHandles={[...caseHandles, { id: 'else', label: 'Default' }]}
    >
      <div className="text-xs text-gray-600">
        {data.cases.length} 个分支
      </div>
    </BaseNode>
  )
})

// Delay Node - Wait/pause
export const DelayNode = memo(function DelayNode({
  data,
  selected,
}: NodeComponentProps<DelayNodeData>) {
  return (
    <BaseNode
      nodeType="delay"
      label={data.label}
      description={data.description}
      icon={Icons.delay}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-sm text-gray-700 font-medium">
        等待 {data.wait}
      </div>
    </BaseNode>
  )
})

// Each Node - Collection iteration
export const EachNode = memo(function EachNode({
  data,
  selected,
}: NodeComponentProps<EachNodeData>) {
  return (
    <BaseNode
      nodeType="each"
      label={data.label}
      description={data.description}
      icon={Icons.each}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
        {data.each || '未配置'}
      </div>
      {data.subFlowNodes && data.subFlowNodes.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          包含 {data.subFlowNodes.length} 个子节点
        </div>
      )}
    </BaseNode>
  )
})

// Loop Node - Conditional loop
export const LoopNode = memo(function LoopNode({
  data,
  selected,
}: NodeComponentProps<LoopNodeData>) {
  return (
    <BaseNode
      nodeType="loop"
      label={data.label}
      description={data.description}
      icon={Icons.loop}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600">
        <span className="font-mono bg-gray-100 px-1 rounded">
          while: {data.when || '未配置'}
        </span>
      </div>
      {data.subFlowNodes && data.subFlowNodes.length > 0 && (
        <div className="text-xs text-gray-500 mt-1">
          包含 {data.subFlowNodes.length} 个子节点
        </div>
      )}
    </BaseNode>
  )
})

// Agent Node - AI/LLM
export const AgentNode = memo(function AgentNode({
  data,
  selected,
}: NodeComponentProps<AgentNodeData>) {
  return (
    <BaseNode
      nodeType="agent"
      label={data.label}
      description={data.description}
      icon={Icons.agent}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600">
        {data.model && (
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1">
            {data.model}
          </span>
        )}
        {data.tools && data.tools.length > 0 && (
          <span className="text-gray-500">
            {data.tools.length} 个工具
          </span>
        )}
      </div>
    </BaseNode>
  )
})

// Guard Node - Safety validation
export const GuardNode = memo(function GuardNode({
  data,
  selected,
}: NodeComponentProps<GuardNodeData>) {
  return (
    <BaseNode
      nodeType="guard"
      label={data.label}
      description={data.description}
      icon={Icons.guard}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
      sourceHandles={[
        { id: 'then', label: 'Pass', position: Position.Right },
        { id: 'else', label: 'Fail', position: Position.Left },
      ]}
    >
      <div className="flex flex-wrap gap-1">
        {data.guardTypes.map((type) => (
          <span
            key={type}
            className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded"
          >
            {type}
          </span>
        ))}
      </div>
    </BaseNode>
  )
})

// Approval Node - Human in the loop
export const ApprovalNode = memo(function ApprovalNode({
  data,
  selected,
}: NodeComponentProps<ApprovalNodeData>) {
  return (
    <BaseNode
      nodeType="approval"
      label={data.label}
      description={data.description}
      icon={Icons.approval}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
      sourceHandles={[
        { id: 'then', label: 'Approve', position: Position.Right },
        { id: 'else', label: 'Reject', position: Position.Left },
      ]}
    >
      <div className="text-xs text-gray-600">
        {data.title}
      </div>
      {data.timeout && (
        <div className="text-xs text-gray-400 mt-1">
          超时: {data.timeout}
        </div>
      )}
    </BaseNode>
  )
})

// MCP Node - External tool via MCP
export const MCPNode = memo(function MCPNode({
  data,
  selected,
}: NodeComponentProps<MCPNodeData>) {
  return (
    <BaseNode
      nodeType="mcp"
      label={data.label}
      description={data.description}
      icon={Icons.mcp}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600">
        <span className="font-mono bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
          {data.server || '?'}/{data.tool || '?'}
        </span>
      </div>
    </BaseNode>
  )
})

// Handoff Node - Agent delegation
export const HandoffNode = memo(function HandoffNode({
  data,
  selected,
}: NodeComponentProps<HandoffNodeData>) {
  return (
    <BaseNode
      nodeType="handoff"
      label={data.label}
      description={data.description}
      icon={Icons.handoff}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600">
        → <span className="font-medium">{data.target || '未配置'}</span>
      </div>
      {data.context && data.context.length > 0 && (
        <div className="text-xs text-gray-400 mt-1">
          传递 {data.context.length} 个上下文
        </div>
      )}
    </BaseNode>
  )
})

// OSS Node - Object Storage Service
export const OSSNode = memo(function OSSNode({
  data,
  selected,
}: NodeComponentProps<OSSNodeData>) {
  const operationLabels: Record<string, string> = {
    upload: '上传',
    download: '下载',
    delete: '删除',
    list: '列表',
  }

  return (
    <BaseNode
      nodeType="oss"
      label={data.label}
      description={data.description}
      icon={Icons.oss}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.oss || '未配置'}
      </div>
      {data.operation && (
        <div className="text-xs text-gray-500 mt-1">
          <span className="bg-cyan-100 text-cyan-700 px-1.5 py-0.5 rounded">
            {operationLabels[data.operation] || data.operation}
          </span>
        </div>
      )}
    </BaseNode>
  )
})

// MQ Node - Message Queue
export const MQNode = memo(function MQNode({
  data,
  selected,
}: NodeComponentProps<MQNodeData>) {
  const operationLabels: Record<string, string> = {
    send: '发送',
    receive: '接收',
    subscribe: '订阅',
  }

  return (
    <BaseNode
      nodeType="mq"
      label={data.label}
      description={data.description}
      icon={Icons.mq}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.mq || '未配置'}
      </div>
      {data.operation && (
        <div className="text-xs text-gray-500 mt-1">
          <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">
            {operationLabels[data.operation] || data.operation}
          </span>
        </div>
      )}
    </BaseNode>
  )
})

// Mail Node - Email Service
export const MailNode = memo(function MailNode({
  data,
  selected,
}: NodeComponentProps<MailNodeData>) {
  return (
    <BaseNode
      nodeType="mail"
      label={data.label}
      description={data.description}
      icon={Icons.mail}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.mail || '未配置'}
      </div>
      {data.template && (
        <div className="text-xs text-gray-500 mt-1">
          模板: <span className="text-purple-600">{data.template}</span>
        </div>
      )}
    </BaseNode>
  )
})

// SMS Node - SMS Service
export const SMSNode = memo(function SMSNode({
  data,
  selected,
}: NodeComponentProps<SMSNodeData>) {
  return (
    <BaseNode
      nodeType="sms"
      label={data.label}
      description={data.description}
      icon={Icons.sms}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.sms || '未配置'}
      </div>
      {data.template && (
        <div className="text-xs text-gray-500 mt-1">
          模板: <span className="text-green-600">{data.template}</span>
        </div>
      )}
    </BaseNode>
  )
})

// Service Node - Microservice Call
export const ServiceNode = memo(function ServiceNode({
  data,
  selected,
}: NodeComponentProps<ServiceNodeData>) {
  return (
    <BaseNode
      nodeType="service"
      label={data.label}
      description={data.description}
      icon={Icons.service}
      selected={selected}
      executionStatus={data.executionStatus}
      hasBreakpoint={data.hasBreakpoint}
    >
      <div className="text-xs text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded truncate">
        {data.service || '未配置'}
      </div>
      {data.method && (
        <div className="text-xs text-gray-500 mt-1">
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
            {data.method}
          </span>
        </div>
      )}
    </BaseNode>
  )
})

// Node type mapping for React Flow
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeTypes: Record<string, any> = {
  start: StartNode,
  exec: ExecNode,
  mapping: MappingNode,
  condition: ConditionNode,
  switch: SwitchNode,
  delay: DelayNode,
  each: EachNode,
  loop: LoopNode,
  agent: AgentNode,
  guard: GuardNode,
  approval: ApprovalNode,
  mcp: MCPNode,
  handoff: HandoffNode,
  // Integration service nodes
  oss: OSSNode,
  mq: MQNode,
  mail: MailNode,
  sms: SMSNode,
  service: ServiceNode,
}
