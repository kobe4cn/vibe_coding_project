/**
 * Property Panel Component
 * Professional styled property editor with improved UX
 *
 * Start 节点作为普通可拖拽节点，其参数定义存储在 node.data.parameters 中
 * 当没有选中节点时，显示 Flow 级别的设置（包括类型定义）
 */

import { useMemo, useState } from 'react'
import { useFlowStore } from '@/stores/flowStore'
import type { FlowNode, FlowNodeData, FlowNodeType, StartParameterDef, FlowTypeDef } from '@/types/flow'
import { NODE_LABELS, NODE_COLORS } from '@/types/flow'
import { TypeDefsEditor } from './TypeDefEditor'

// Lucide style icons
const Icons = {
  edit: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
    </svg>
  ),
}

// Node type icons - matching NodePalette.tsx
const NODE_ICONS: Record<FlowNodeType, React.ReactNode> = {
  start: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  exec: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>
    </svg>
  ),
  mapping: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>
      <path d="m18 2 4 4-4 4"/>
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>
      <path d="m18 14 4 4-4 4"/>
    </svg>
  ),
  condition: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <path d="M6 9v12"/>
      <circle cx="18" cy="9" r="3"/>
      <path d="M6 12c0-3.3 2.7-6 6-6h3"/>
    </svg>
  ),
  switch: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="18" cy="18" r="3"/>
      <path d="M9 12h6"/>
      <path d="M9 12l6-5"/>
      <path d="M9 12l6 5"/>
    </svg>
  ),
  delay: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  each: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4"/>
    </svg>
  ),
  loop: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="m7 22-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  agent: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  ),
  guard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  approval: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
  mcp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5"/>
      <path d="M9 8V2"/>
      <path d="M15 8V2"/>
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>
    </svg>
  ),
  handoff: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  oss: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M12 12v9"/>
      <path d="m8 17 4 4 4-4"/>
    </svg>
  ),
  mq: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
      <path d="M10 6h4"/>
      <path d="M6 10v4"/>
      <path d="M10 17.5h4"/>
    </svg>
  ),
  mail: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  sms: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 10h.01"/>
      <path d="M12 10h.01"/>
      <path d="M16 10h.01"/>
    </svg>
  ),
  service: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
}

// Section header component
interface SectionProps {
  title: string
  children: React.ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }}
        >
          {title}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--outline-variant)', opacity: 0.5 }} />
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}

// Generic field editor with improved styling
interface FieldProps {
  label: string
  children: React.ReactNode
  hint?: string
}

function Field({ label, children, hint }: FieldProps) {
  return (
    <div>
      <label
        className="block text-[11px] font-medium mb-1.5 tracking-wide"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p
          className="mt-1 text-[10px]"
          style={{ color: 'var(--on-surface-variant)', opacity: 0.6 }}
        >
          {hint}
        </p>
      )}
    </div>
  )
}

// Professional text input field
interface TextFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  multiline?: boolean
  monospace?: boolean
  hint?: string
  rows?: number
}

function TextField({ label, value, onChange, placeholder, multiline, monospace, hint, rows = 3 }: TextFieldProps) {
  const baseClassName = `
    w-full text-[13px] leading-relaxed
    bg-[var(--surface-container-highest)]
    border border-[var(--outline-variant)]
    text-[var(--on-surface)]
    placeholder:text-[var(--on-surface-variant)] placeholder:opacity-40
    focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30
    transition-colors duration-150
    ${monospace ? 'font-mono text-[12px]' : ''}
    ${multiline ? 'rounded-lg px-3 py-2.5 resize-none' : 'rounded-md px-3 py-2'}
  `

  return (
    <Field label={label} hint={hint}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={baseClassName}
          rows={rows}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={baseClassName}
        />
      )}
    </Field>
  )
}

// Professional select field
interface SelectFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  hint?: string
}

function SelectField({ label, value, onChange, options, hint }: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="
          w-full px-3 py-2 text-[13px] rounded-md
          bg-[var(--surface-container-highest)]
          border border-[var(--outline-variant)]
          text-[var(--on-surface)]
          focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30
          transition-colors duration-150
          cursor-pointer
        "
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

// Node-specific editors
function ExecNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & { exec?: string; args?: string; with?: string; sets?: string }

  return (
    <>
      <TextField
        label="Tool URI"
        value={data.exec || ''}
        onChange={(value) => updateNode(node.id, { exec: value })}
        placeholder="api://service/method"
        monospace
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="param = value"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="result = response.data"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="total = total + 1"
        multiline
        monospace
      />
    </>
  )
}

function MappingNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & { with?: string; sets?: string }

  return (
    <>
      <TextField
        label="Data Mapping (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="...source\nfield = value"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        multiline
        monospace
      />
    </>
  )
}

function ConditionNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & { when?: string }

  return (
    <TextField
      label="Condition (when)"
      value={data.when || ''}
      onChange={(value) => updateNode(node.id, { when: value })}
      placeholder="status == 'active'"
      monospace
    />
  )
}

function DelayNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & { wait?: string | number }

  return (
    <TextField
      label="Wait Duration"
      value={String(data.wait || '')}
      onChange={(value) => updateNode(node.id, { wait: value })}
      placeholder="3s, 5m, 1h"
    />
  )
}

function AgentNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    model?: string
    instructions?: string
    outputFormat?: string
    temperature?: number
    sets?: string
  }

  return (
    <>
      <SelectField
        label="Model"
        value={data.model || 'gpt-4o'}
        onChange={(value) => updateNode(node.id, { model: value })}
        options={[
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-opus', label: 'Claude 3 Opus' },
        ]}
      />
      <TextField
        label="Instructions"
        value={data.instructions || ''}
        onChange={(value) => updateNode(node.id, { instructions: value })}
        placeholder="You are a helpful assistant..."
        multiline
      />
      <SelectField
        label="Output Format"
        value={data.outputFormat || 'text'}
        onChange={(value) => updateNode(node.id, { outputFormat: value })}
        options={[
          { value: 'text', label: 'Plain Text' },
          { value: 'json', label: 'JSON' },
          { value: 'markdown', label: 'Markdown' },
        ]}
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="result = response.content"
        multiline
        monospace
      />
    </>
  )
}

// Guard type labels for better readability
const GUARD_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  pii: { label: 'PII Detection', description: 'Personal information' },
  jailbreak: { label: 'Jailbreak', description: 'Prompt injection' },
  moderation: { label: 'Moderation', description: 'Content safety' },
  hallucination: { label: 'Hallucination', description: 'Fact checking' },
  schema: { label: 'Schema', description: 'Output validation' },
  custom: { label: 'Custom', description: 'Custom expression' },
}

function GuardNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    guardTypes?: string[]
    action?: string
    customExpression?: string
    sets?: string
  }

  const guardTypes = ['pii', 'jailbreak', 'moderation', 'hallucination', 'schema', 'custom']

  return (
    <>
      <Field label="Guard Types">
        <div className="space-y-1.5">
          {guardTypes.map((type) => {
            const isChecked = (data.guardTypes || []).includes(type)
            const info = GUARD_TYPE_LABELS[type]
            return (
              <label
                key={type}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all
                  border ${isChecked ? 'border-[var(--primary)]/40' : 'border-transparent'}
                `}
                style={{
                  backgroundColor: isChecked ? 'var(--primary-container)' : 'var(--surface-container-highest)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => {
                    const current = data.guardTypes || []
                    const next = e.target.checked
                      ? [...current, type]
                      : current.filter((t) => t !== type)
                    updateNode(node.id, { guardTypes: next })
                  }}
                  className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className="text-[12px] font-medium block"
                    style={{ color: isChecked ? 'var(--on-primary-container)' : 'var(--on-surface)' }}
                  >
                    {info.label}
                  </span>
                  <span
                    className="text-[10px] block"
                    style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }}
                  >
                    {info.description}
                  </span>
                </div>
              </label>
            )
          })}
        </div>
      </Field>
      <SelectField
        label="On Failure"
        value={data.action || 'block'}
        onChange={(value) => updateNode(node.id, { action: value })}
        options={[
          { value: 'block', label: 'Block Execution' },
          { value: 'warn', label: 'Warn & Continue' },
          { value: 'redact', label: 'Redact Content' },
        ]}
      />
      {(data.guardTypes || []).includes('custom') && (
        <TextField
          label="Custom Expression"
          value={data.customExpression || ''}
          onChange={(value) => updateNode(node.id, { customExpression: value })}
          placeholder="input.length < 1000"
          monospace
          hint="GML expression for custom validation"
        />
      )}
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="validated = true"
        multiline
        monospace
      />
    </>
  )
}

function ApprovalNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    title?: string
    approvalDescription?: string
    timeout?: string
    timeoutAction?: string
  }

  return (
    <>
      <TextField
        label="Approval Title"
        value={data.title || ''}
        onChange={(value) => updateNode(node.id, { title: value })}
        placeholder="Please confirm action"
      />
      <TextField
        label="Description"
        value={data.approvalDescription || ''}
        onChange={(value) => updateNode(node.id, { approvalDescription: value })}
        placeholder="Detailed description..."
        multiline
      />
      <TextField
        label="Timeout"
        value={data.timeout || ''}
        onChange={(value) => updateNode(node.id, { timeout: value })}
        placeholder="24h"
      />
      <SelectField
        label="Timeout Action"
        value={data.timeoutAction || 'reject'}
        onChange={(value) => updateNode(node.id, { timeoutAction: value })}
        options={[
          { value: 'reject', label: 'Auto Reject' },
          { value: 'approve', label: 'Auto Approve' },
        ]}
      />
    </>
  )
}

function MCPNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    server?: string
    tool?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="MCP Server"
        value={data.server || ''}
        onChange={(value) => updateNode(node.id, { server: value })}
        placeholder="filesystem"
        hint="MCP server name from flow configuration"
      />
      <TextField
        label="Tool Name"
        value={data.tool || ''}
        onChange={(value) => updateNode(node.id, { tool: value })}
        placeholder="read_file"
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="path = '/tmp/file.txt'"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="content = result.content"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="fileContent = content"
        multiline
        monospace
      />
    </>
  )
}

function HandoffNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    target?: string
    context?: string[]
    resumeOn?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="Target Agent"
        value={data.target || ''}
        onChange={(value) => updateNode(node.id, { target: value })}
        placeholder="specialist-agent"
        hint="Agent ID to hand off to"
      />
      <SelectField
        label="Resume On"
        value={data.resumeOn || 'completed'}
        onChange={(value) => updateNode(node.id, { resumeOn: value })}
        options={[
          { value: 'completed', label: 'On Completed' },
          { value: 'error', label: 'On Error' },
          { value: 'any', label: 'Any Outcome' },
        ]}
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="task = query"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="result = response.output"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="handoffResult = result"
        multiline
        monospace
      />
    </>
  )
}

// OSS 节点编辑器 - 对象存储操作
function OSSNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    oss?: string
    operation?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="OSS URI"
        value={data.oss || ''}
        onChange={(value) => updateNode(node.id, { oss: value })}
        placeholder="oss://bucket/path"
        hint="对象存储 URI，如 oss://my-bucket/files/"
        monospace
      />
      <SelectField
        label="Operation"
        value={data.operation || 'download'}
        onChange={(value) => updateNode(node.id, { operation: value })}
        options={[
          { value: 'upload', label: '上传 (Upload)' },
          { value: 'download', label: '下载 (Download)' },
          { value: 'delete', label: '删除 (Delete)' },
          { value: 'list', label: '列表 (List)' },
        ]}
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="key = 'reports/' + reportId + '.pdf'"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="url = result.signedUrl"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="uploadResult = result"
        multiline
        monospace
      />
    </>
  )
}

// MQ 节点编辑器 - 消息队列操作
function MQNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    mq?: string
    operation?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="MQ URI"
        value={data.mq || ''}
        onChange={(value) => updateNode(node.id, { mq: value })}
        placeholder="mq://topic/queue"
        hint="消息队列 URI，如 mq://orders/new-order"
        monospace
      />
      <SelectField
        label="Operation"
        value={data.operation || 'send'}
        onChange={(value) => updateNode(node.id, { operation: value })}
        options={[
          { value: 'send', label: '发送 (Send)' },
          { value: 'receive', label: '接收 (Receive)' },
          { value: 'subscribe', label: '订阅 (Subscribe)' },
        ]}
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="message = { orderId: order.id, status: 'created' }"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="messageId = result.id"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="sendResult = result"
        multiline
        monospace
      />
    </>
  )
}

// Mail 节点编辑器 - 邮件发送
function MailNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    mail?: string
    template?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="Mail Config"
        value={data.mail || ''}
        onChange={(value) => updateNode(node.id, { mail: value })}
        placeholder="mail://smtp-service/send"
        hint="邮件服务 URI 或收件人地址"
        monospace
      />
      <TextField
        label="Template"
        value={data.template || ''}
        onChange={(value) => updateNode(node.id, { template: value })}
        placeholder="welcome_email"
        hint="邮件模板 ID"
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="to = user.email, subject = '欢迎', variables = { name: user.name }"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="messageId = result.messageId"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="emailSent = true"
        multiline
        monospace
      />
    </>
  )
}

// SMS 节点编辑器 - 短信发送
function SMSNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    sms?: string
    template?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="SMS Config"
        value={data.sms || ''}
        onChange={(value) => updateNode(node.id, { sms: value })}
        placeholder="sms://aliyun/verification"
        hint="短信服务 URI 或手机号"
        monospace
      />
      <TextField
        label="Template"
        value={data.template || ''}
        onChange={(value) => updateNode(node.id, { template: value })}
        placeholder="SMS_VERIFY_CODE"
        hint="短信模板 ID"
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="phone = user.phone, params = { code: verifyCode }"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="messageId = result.messageId"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="smsSent = true"
        multiline
        monospace
      />
    </>
  )
}

// Service 节点编辑器 - 微服务调用
function ServiceNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & {
    service?: string
    method?: string
    args?: string
    with?: string
    sets?: string
  }

  return (
    <>
      <TextField
        label="Service URI"
        value={data.service || ''}
        onChange={(value) => updateNode(node.id, { service: value })}
        placeholder="svc://inventory-service/check_stock"
        hint="微服务 URI，如 svc://service-name/method"
        monospace
      />
      <SelectField
        label="HTTP Method"
        value={data.method || 'POST'}
        onChange={(value) => updateNode(node.id, { method: value })}
        options={[
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'DELETE', label: 'DELETE' },
        ]}
      />
      <TextField
        label="Arguments (args)"
        value={data.args || ''}
        onChange={(value) => updateNode(node.id, { args: value })}
        placeholder="productId = order.productId, quantity = order.quantity"
        multiline
        monospace
      />
      <TextField
        label="Transform (with)"
        value={data.with || ''}
        onChange={(value) => updateNode(node.id, { with: value })}
        placeholder="available = result.inStock"
        multiline
        monospace
      />
      <TextField
        label="Set Variables (sets)"
        value={data.sets || ''}
        onChange={(value) => updateNode(node.id, { sets: value })}
        placeholder="stockResult = result"
        multiline
        monospace
      />
    </>
  )
}

// Parameter type options
const PARAM_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
]

// Single parameter editor component
function ParameterEditor({
  param,
  index,
  onUpdate,
  onRemove,
}: {
  param: StartParameterDef
  index: number
  onUpdate: (field: keyof StartParameterDef, value: unknown) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="rounded-lg border transition-all"
      style={{
        borderColor: 'var(--outline-variant)',
        backgroundColor: 'var(--surface-container-highest)',
      }}
    >
      {/* Parameter header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)' }}
        >
          {index + 1}
        </span>
        <span className="flex-1 text-[12px] font-medium truncate" style={{ color: 'var(--on-surface)' }}>
          {param.name || '未命名参数'}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}
        >
          {param.type}
        </span>
        {param.required && (
          <span className="text-[10px] text-red-500">*</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
          title="删除参数"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                参数名
              </label>
              <input
                type="text"
                value={param.name}
                onChange={(e) => onUpdate('name', e.target.value)}
                placeholder="paramName"
                className="w-full px-2 py-1.5 text-[12px] font-mono rounded border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--surface-container)',
                  borderColor: 'var(--outline-variant)',
                  color: 'var(--on-surface)',
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                类型
              </label>
              <select
                value={param.type}
                onChange={(e) => onUpdate('type', e.target.value)}
                className="w-full px-2 py-1.5 text-[12px] rounded border focus:outline-none focus:ring-1 cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface-container)',
                  borderColor: 'var(--outline-variant)',
                  color: 'var(--on-surface)',
                }}
              >
                {PARAM_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={param.required}
                onChange={(e) => onUpdate('required', e.target.checked)}
                className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
              />
              <span className="text-[11px]" style={{ color: 'var(--on-surface-variant)' }}>必填</span>
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
              默认值
            </label>
            <input
              type="text"
              value={param.defaultValue || ''}
              onChange={(e) => onUpdate('defaultValue', e.target.value)}
              placeholder="可选默认值"
              className="w-full px-2 py-1.5 text-[12px] font-mono rounded border focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--surface-container)',
                borderColor: 'var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
              描述
            </label>
            <input
              type="text"
              value={param.description || ''}
              onChange={(e) => onUpdate('description', e.target.value)}
              placeholder="参数说明"
              className="w-full px-2 py-1.5 text-[12px] rounded border focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--surface-container)',
                borderColor: 'var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// Start node editor - parameter definition (for real start nodes stored in nodes array)
function StartNodeEditor({ node }: { node: FlowNode }) {
  const { updateNode } = useFlowStore()
  const data = node.data as FlowNodeData & { parameters?: StartParameterDef[] }
  const parameters = data.parameters || []

  const addParameter = () => {
    const newParam: StartParameterDef = {
      name: `param${parameters.length + 1}`,
      type: 'string',
      required: false,
    }
    updateNode(node.id, { parameters: [...parameters, newParam] })
  }

  const updateParameter = (index: number, field: keyof StartParameterDef, value: unknown) => {
    const updated = [...parameters]
    updated[index] = { ...updated[index], [field]: value }
    updateNode(node.id, { parameters: updated })
  }

  const removeParameter = (index: number) => {
    const updated = parameters.filter((_, i) => i !== index)
    updateNode(node.id, { parameters: updated })
  }

  return (
    <Field label="输入参数" hint="定义流程启动时需要传入的参数">
      <div className="space-y-2">
        {parameters.map((param, index) => (
          <ParameterEditor
            key={index}
            param={param}
            index={index}
            onUpdate={(field, value) => updateParameter(index, field, value)}
            onRemove={() => removeParameter(index)}
          />
        ))}

        <button
          onClick={addParameter}
          className="w-full py-2 px-3 text-[12px] font-medium rounded-lg border border-dashed transition-all hover:border-solid"
          style={{
            borderColor: 'var(--outline-variant)',
            color: 'var(--primary)',
            backgroundColor: 'transparent',
          }}
        >
          + 添加参数
        </button>
      </div>
    </Field>
  )
}

/**
 * Flow 级别设置面板 - 当没有选中节点时显示
 * 包含流程元信息和类型定义编辑
 */
function FlowSettingsPanel() {
  const { flow, updateMeta, updateArgs } = useFlowStore()
  const [activeTab, setActiveTab] = useState<'info' | 'types'>('info')

  const handleUpdateDefs = (defs: FlowTypeDef[]) => {
    updateArgs({
      ...flow.args,
      defs,
    })
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--surface-container)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: 'var(--primary-container)',
              color: 'var(--on-primary-container)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h2
              className="text-[14px] font-semibold truncate"
              style={{ color: 'var(--on-surface)' }}
            >
              Flow Settings
            </h2>
            <p
              className="text-[11px]"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              流程级别配置
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div
          className="flex items-center gap-1 mt-3 p-1 rounded-lg"
          style={{ background: 'var(--surface-container-high)' }}
        >
          <button
            onClick={() => setActiveTab('info')}
            className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: activeTab === 'info' ? 'var(--primary-container)' : 'transparent',
              color: activeTab === 'info' ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
            }}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className="flex-1 px-3 py-1.5 text-[12px] font-medium rounded-md transition-all"
            style={{
              background: activeTab === 'types' ? 'var(--primary-container)' : 'transparent',
              color: activeTab === 'types' ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
            }}
          >
            类型定义
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'info' ? (
          <div className="space-y-4">
            <Section title="Flow Information">
              <TextField
                label="名称"
                value={flow.meta.name}
                onChange={(value) => updateMeta({ name: value })}
                placeholder="Flow name"
              />
              <TextField
                label="描述"
                value={flow.meta.description || ''}
                onChange={(value) => updateMeta({ description: value })}
                placeholder="Flow description"
                multiline
              />
            </Section>

            <Section title="Global Variables (vars)">
              <TextField
                label="初始变量"
                value={flow.vars || ''}
                onChange={(value) => {
                  // Note: vars is at flow level, need to update differently
                  // This is a simplified version
                }}
                placeholder="counter = 0&#10;items = []"
                multiline
                monospace
                hint="定义流程启动时的初始变量"
              />
            </Section>
          </div>
        ) : (
          <TypeDefsEditor
            defs={flow.args?.defs || []}
            onChange={handleUpdateDefs}
          />
        )}
      </div>
    </div>
  )
}

// Main PropertyPanel component
export function PropertyPanel() {
  const { flow, selectedNodeIds, updateNode } = useFlowStore()

  const selectedNode = useMemo(() => {
    if (selectedNodeIds.length !== 1) return null
    return flow.nodes.find((n) => n.id === selectedNodeIds[0]) || null
  }, [flow.nodes, selectedNodeIds])

  if (!selectedNode) {
    return <FlowSettingsPanel />
  }

  const nodeType = selectedNode.data.nodeType as FlowNodeType
  const nodeColor = NODE_COLORS[nodeType]

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--surface-container)' }}
    >
      {/* Header - More compact and professional */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          {/* Node icon with subtle gradient */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: `${nodeColor}20`,
              color: nodeColor,
            }}
          >
            {NODE_ICONS[nodeType]}
          </div>
          {/* Node info */}
          <div className="flex-1 min-w-0">
            <h3
              className="text-[13px] font-semibold truncate"
              style={{ color: 'var(--on-surface)' }}
            >
              {NODE_LABELS[nodeType]}
            </h3>
            <div className="flex items-center gap-1.5">
              <p
                className="text-[11px] font-mono truncate"
                style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }}
              >
                {selectedNode.id}
              </p>
              <button
                onClick={() => navigator.clipboard.writeText(selectedNode.id)}
                className="p-0.5 rounded hover:bg-[var(--surface-container-high)] transition-colors"
                style={{ color: 'var(--on-surface-variant)', opacity: 0.5 }}
                title="Copy ID"
              >
                {Icons.copy}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Using Section components */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Basic Info Section */}
        <Section title="Basic">
          <TextField
            label="Name"
            value={selectedNode.data.label}
            onChange={(value) => updateNode(selectedNode.id, { label: value })}
            placeholder="Enter node name"
          />
          <TextField
            label="Description"
            value={selectedNode.data.description || ''}
            onChange={(value) => updateNode(selectedNode.id, { description: value })}
            placeholder="Optional description"
            multiline
            rows={2}
          />
        </Section>

        {/* Execution Control Section */}
        <Section title="Execution">
          <TextField
            label="Condition (only)"
            value={selectedNode.data.only || ''}
            onChange={(value) => updateNode(selectedNode.id, { only: value })}
            placeholder="e.g., status == 'active'"
            monospace
            hint="GML expression to control when this node executes"
          />
          <TextField
            label="Failure Handler (fail)"
            value={selectedNode.data.fail || ''}
            onChange={(value) => updateNode(selectedNode.id, { fail: value })}
            placeholder="e.g., error_handler"
            hint="Node ID to jump to on failure"
          />
        </Section>

        {/* Node-specific configuration */}
        <Section title="Configuration">
          {renderNodeEditor(selectedNode)}
        </Section>
      </div>
    </div>
  )
}

function renderNodeEditor(node: FlowNode) {
  switch (node.data.nodeType) {
    case 'start':
      return <StartNodeEditor node={node} />
    case 'exec':
      return <ExecNodeEditor node={node} />
    case 'mapping':
      return <MappingNodeEditor node={node} />
    case 'condition':
      return <ConditionNodeEditor node={node} />
    case 'delay':
      return <DelayNodeEditor node={node} />
    case 'agent':
      return <AgentNodeEditor node={node} />
    case 'guard':
      return <GuardNodeEditor node={node} />
    case 'approval':
      return <ApprovalNodeEditor node={node} />
    case 'mcp':
      return <MCPNodeEditor node={node} />
    case 'handoff':
      return <HandoffNodeEditor node={node} />
    case 'oss':
      return <OSSNodeEditor node={node} />
    case 'mq':
      return <MQNodeEditor node={node} />
    case 'mail':
      return <MailNodeEditor node={node} />
    case 'sms':
      return <SMSNodeEditor node={node} />
    case 'service':
      return <ServiceNodeEditor node={node} />
    default:
      return (
        <p
          className="text-sm"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          Editor not implemented for this node type
        </p>
      )
  }
}

