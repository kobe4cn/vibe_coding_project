/**
 * Base Node Component
 * Material Design 3 styled node design
 */

import { memo, type ReactNode } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { FlowNodeType, NodeExecutionStatus } from '@/types/flow'
import { NODE_COLORS } from '@/types/flow'

interface BaseNodeProps {
  nodeType: FlowNodeType
  label: string
  description?: string
  icon?: ReactNode
  children?: ReactNode
  selected?: boolean
  executionStatus?: NodeExecutionStatus
  hasBreakpoint?: boolean
  showSourceHandle?: boolean
  showTargetHandle?: boolean
  sourceHandles?: Array<{ id: string; label?: string; position?: Position }>
  targetHandles?: Array<{ id: string; label?: string; position?: Position }>
}

// Material Design 3 status colors
const statusConfig: Record<NodeExecutionStatus, {
  ring: string
  bg: string
  iconBg: string
  glow: string
}> = {
  idle: { ring: '', bg: '', iconBg: '', glow: '' },
  pending: {
    ring: 'ring-2 ring-[var(--outline)]',
    bg: '',
    iconBg: 'bg-[var(--outline)]',
    glow: 'rgba(147, 143, 153, 0.4)'
  },
  running: {
    ring: 'ring-2 ring-[#86efac] animate-md-pulse',
    bg: '',
    iconBg: 'bg-[#86efac]',
    glow: 'rgba(134, 239, 172, 0.5)'
  },
  paused: {
    ring: 'ring-2 ring-[#ffb77c]',
    bg: 'bg-[#ffb77c]/5',
    iconBg: 'bg-[#ffb77c]',
    glow: 'rgba(255, 183, 124, 0.5)'
  },
  completed: {
    ring: 'ring-2 ring-[#86efac]',
    bg: '',
    iconBg: 'bg-[#86efac]',
    glow: 'rgba(134, 239, 172, 0.5)'
  },
  error: {
    ring: 'ring-2 ring-[var(--error)]',
    bg: 'bg-[var(--error)]/5',
    iconBg: 'bg-[var(--error)]',
    glow: 'rgba(242, 184, 181, 0.5)'
  },
}

export const BaseNode = memo(function BaseNode({
  nodeType,
  label,
  description,
  icon,
  children,
  selected,
  executionStatus = 'idle',
  hasBreakpoint,
  showSourceHandle = true,
  showTargetHandle = true,
  sourceHandles,
  targetHandles,
}: BaseNodeProps) {
  const color = NODE_COLORS[nodeType]
  const status = statusConfig[executionStatus]

  return (
    <div
      className={`
        group relative min-w-[200px] max-w-[300px]
        rounded-2xl overflow-hidden
        transition-all duration-200 ease-out
        ${selected ? 'scale-[1.02]' : ''}
        ${status.ring}
        ${status.bg}
      `}
      style={{
        backgroundColor: 'var(--surface-container-high)',
        boxShadow: selected
          ? `0 0 0 2px ${color}, var(--elevation-3), 0 0 24px ${color}30`
          : 'var(--elevation-2)',
      }}
    >
      {/* Breakpoint indicator */}
      {hasBreakpoint && (
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 z-10">
          <div
            className="w-3.5 h-3.5 rounded-full animate-md-pulse"
            style={{
              backgroundColor: 'var(--error)',
              boxShadow: '0 0 8px rgba(242, 184, 181, 0.6)'
            }}
          />
        </div>
      )}

      {/* Status indicator badge */}
      {executionStatus !== 'idle' && (
        <div
          className={`
            absolute -right-1 -top-1 z-10
            w-5 h-5 rounded-full
            flex items-center justify-center
            text-[10px] font-bold
            shadow-lg
            ${status.iconBg}
          `}
          style={{
            boxShadow: `0 0 8px ${status.glow}`,
            color: executionStatus === 'running' || executionStatus === 'completed' ? '#1d1b20' : 'white'
          }}
        >
          {executionStatus === 'pending' && (
            <span className="text-white">...</span>
          )}
          {executionStatus === 'running' && (
            <div className="w-2 h-2 rounded-full bg-[#1d1b20] animate-md-pulse" />
          )}
          {executionStatus === 'paused' && (
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          )}
          {executionStatus === 'completed' && (
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {executionStatus === 'error' && (
            <span className="text-white">!</span>
          )}
        </div>
      )}

      {/* Header with gradient accent */}
      <div
        className="relative flex items-center"
        style={{
          background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
          padding: '14px 18px',
          gap: '14px',
        }}
      >
        {/* Subtle shine effect */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 50%)'
          }}
        />

        {icon && (
          <span className="relative text-white flex-shrink-0 flex items-center justify-center w-5 h-5">
            {icon}
          </span>
        )}
        <span className="relative text-white text-sm font-medium truncate flex-1">
          {label}
        </span>
      </div>

      {/* Content area */}
      <div
        style={{
          backgroundColor: 'var(--surface-container-highest)',
          borderTop: '1px solid var(--outline-variant)',
          padding: '14px 18px',
        }}
      >
        {description && (
          <p
            className="text-xs mb-2 line-clamp-2"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            {description}
          </p>
        )}
        {children}
      </div>

      {/* Default target handle (top) */}
      {showTargetHandle && !targetHandles && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-4 !h-4 !-top-2 !border-2 !rounded-full transition-all duration-150 hover:!scale-150 hover:!border-[#86efac] !z-50"
          style={{
            backgroundColor: color,
            borderColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      )}

      {/* Custom target handles */}
      {targetHandles?.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="target"
          position={handle.position || Position.Top}
          className="!w-4 !h-4 !border-2 !rounded-full transition-all duration-150 hover:!scale-150 hover:!border-[#86efac] !z-50"
          style={{
            backgroundColor: color,
            borderColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      ))}

      {/* Default source handle (bottom) */}
      {showSourceHandle && !sourceHandles && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-4 !h-4 !-bottom-2 !border-2 !rounded-full transition-all duration-150 hover:!scale-150 hover:!border-[#86efac] cursor-crosshair !z-50"
          style={{
            backgroundColor: color,
            borderColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      )}

      {/* Custom source handles */}
      {sourceHandles?.map((handle) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={handle.position || Position.Bottom}
          className="!w-4 !h-4 !border-2 !rounded-full transition-all duration-150 hover:!scale-150 hover:!border-[#86efac] cursor-crosshair !z-50"
          style={{
            backgroundColor: color,
            borderColor: 'white',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          }}
        />
      ))}
    </div>
  )
})
