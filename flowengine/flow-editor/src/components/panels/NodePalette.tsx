/**
 * Node Palette Component
 * Material Design 3 styled node list
 */

import { useState, useCallback } from 'react'
import type { FlowNodeType } from '@/types/flow'
import { NODE_COLORS, NODE_LABELS, NODE_CATEGORIES, NODE_CATEGORY_LABELS } from '@/types/flow'

// UI Icons (Lucide style)
const Icons = {
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  ),
  chevronRight: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6"/>
    </svg>
  ),
  dragIndicator: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
      <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4"/>
      <path d="M12 8h.01"/>
    </svg>
  ),
}

// Node type icons - Lucide style SVG icons for better design
const NODE_ICONS: Record<FlowNodeType, React.ReactNode> = {
  // 开始节点 - Play Circle icon
  start: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // 工具调用 - Play/Execute icon
  exec: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>
    </svg>
  ),
  // 数据映射 - Shuffle/Transform icon
  mapping: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/>
      <path d="m18 2 4 4-4 4"/>
      <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/>
      <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/>
      <path d="m18 14 4 4-4 4"/>
    </svg>
  ),
  // 条件跳转 - Git Branch/Split icon
  condition: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <path d="M6 9v12"/>
      <circle cx="18" cy="9" r="3"/>
      <path d="M6 12c0-3.3 2.7-6 6-6h3"/>
    </svg>
  ),
  // 多分支跳转 - Route/Network icon
  switch: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  // 集合遍历 - List/Each icon
  each: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l3-9 4 18 3-9h4"/>
    </svg>
  ),
  // 条件循环 - Repeat/Loop icon
  loop: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m17 2 4 4-4 4"/>
      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
      <path d="m7 22-4-4 4-4"/>
      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>
  ),
  // AI Agent - Bot/Sparkles icon
  agent: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8"/>
      <rect width="16" height="12" x="4" y="8" rx="2"/>
      <path d="M2 14h2"/>
      <path d="M20 14h2"/>
      <path d="M15 13v2"/>
      <path d="M9 13v2"/>
    </svg>
  ),
  // 安全校验 - Shield icon
  guard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  // 人工审批 - User Check icon
  approval: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <polyline points="16 11 18 13 22 9"/>
    </svg>
  ),
  // MCP 工具 - Plug/Extension icon
  mcp: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22v-5"/>
      <path d="M9 8V2"/>
      <path d="M15 8V2"/>
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/>
    </svg>
  ),
  // Agent 移交 - Send/Forward icon
  handoff: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14"/>
      <path d="m12 5 7 7-7 7"/>
    </svg>
  ),
  // 对象存储 - Cloud/Storage icon
  oss: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
      <path d="M12 12v9"/>
      <path d="m8 17 4 4 4-4"/>
    </svg>
  ),
  // 消息队列 - Queue/List icon
  mq: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  ),
  // 短信发送 - Message icon
  sms: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <path d="M8 10h.01"/>
      <path d="M12 10h.01"/>
      <path d="M16 10h.01"/>
    </svg>
  ),
  // 微服务调用 - Server/Network icon
  service: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
}

interface NodeItemProps {
  nodeType: FlowNodeType
  label: string
  color: string
}

function NodeItem({ nodeType, label, color }: NodeItemProps) {
  const handleDragStart = useCallback(
    (event: React.DragEvent) => {
      event.dataTransfer.setData('application/flownode', nodeType)
      event.dataTransfer.effectAllowed = 'move'
    },
    [nodeType]
  )

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group flex items-center gap-3 px-4 py-3 rounded-xl cursor-grab active:cursor-grabbing transition-all"
      style={{ background: 'transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-container-high)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {/* Drag indicator */}
      <span
        className="opacity-0 group-hover:opacity-50 transition-opacity"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        {Icons.dragIndicator}
      </span>

      {/* Node icon */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center"
        style={{
          background: `${color}20`,
          color: color,
        }}
      >
        {NODE_ICONS[nodeType]}
      </div>

      {/* Label */}
      <span
        className="text-sm font-medium"
        style={{ color: 'var(--on-surface)' }}
      >
        {label}
      </span>
    </div>
  )
}

interface NodeCategoryProps {
  category: keyof typeof NODE_CATEGORIES
  expanded: boolean
  onToggle: () => void
}

function NodeCategory({ category, expanded, onToggle }: NodeCategoryProps) {
  const nodeTypes = NODE_CATEGORIES[category]
  const label = NODE_CATEGORY_LABELS[category]

  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left rounded-xl transition-all"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-container-high)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <span
          className="transition-transform duration-200"
          style={{
            color: 'var(--on-surface-variant)',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          {Icons.chevronRight}
        </span>
        <span
          className="text-xs font-semibold uppercase tracking-wider flex-1"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          {label}
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{
            background: 'var(--surface-container-highest)',
            color: 'var(--on-surface-variant)',
          }}
        >
          {nodeTypes.length}
        </span>
      </button>

      {expanded && (
        <div className="mt-1 ml-2 space-y-1 animate-md-fade-in">
          {nodeTypes.map((nodeType) => (
            <NodeItem
              key={nodeType}
              nodeType={nodeType}
              label={NODE_LABELS[nodeType]}
              color={NODE_COLORS[nodeType]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function NodePalette() {
  const [search, setSearch] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['entry', 'basic', 'control', 'loop', 'agent', 'integration'])
  )

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  return (
    <div className="h-full flex flex-col rounded-2xl overflow-hidden" style={{ background: 'var(--surface-container)' }}>
      {/* Header */}
      <div className="pl-5 pr-4 pt-5 pb-4" style={{ borderBottom: '1px solid var(--outline-variant)' }}>
        <h3
          className="text-[11px] font-semibold uppercase tracking-wide mb-3"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          Components
        </h3>

        {/* Search */}
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none"
            style={{ color: 'var(--outline)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-full text-[13px] rounded-xl focus:outline-none"
            style={{
              background: 'var(--surface-container-highest)',
              border: 'none',
              color: 'var(--on-surface)',
              padding: '10px 12px 10px 36px',
            }}
          />
        </div>
      </div>

      {/* Node list */}
      <div className="flex-1 overflow-y-auto p-3">
        {search ? (
          <div className="space-y-1">
            {Object.entries(NODE_LABELS)
              .filter(([, label]) => label.toLowerCase().includes(search.toLowerCase()))
              .map(([nodeType]) => (
                <NodeItem
                  key={nodeType}
                  nodeType={nodeType as FlowNodeType}
                  label={NODE_LABELS[nodeType as FlowNodeType]}
                  color={NODE_COLORS[nodeType as FlowNodeType]}
                />
              ))}
          </div>
        ) : (
          <>
            {(Object.keys(NODE_CATEGORIES) as Array<keyof typeof NODE_CATEGORIES>).map(
              (category) => (
                <NodeCategory
                  key={category}
                  category={category}
                  expanded={expandedCategories.has(category)}
                  onToggle={() => toggleCategory(category)}
                />
              )
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div
        className="pl-5 pr-4 py-4"
        style={{
          borderTop: '1px solid var(--outline-variant)',
          background: 'var(--surface-container-low)',
        }}
      >
        <p
          className="text-[11px] flex items-center gap-2"
          style={{ color: 'var(--outline)' }}
        >
          <span className="flex-shrink-0">{Icons.info}</span>
          <span>Drag nodes to canvas</span>
        </p>
      </div>
    </div>
  )
}
