/**
 * Debug Panel Component
 * Material Design 3 styled debugging interface
 */

import { useState, useCallback, useMemo } from 'react'
import { useDebugStore } from '@/stores/debugStore'
import { useFlowStore } from '@/stores/flowStore'

// Material Icons
const Icons = {
  playCircle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
  ),
  database: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <ellipse cx="12" cy="5" rx="8" ry="3"/>
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5c0 1.66-3.58 3-8 3S4 6.66 4 5z"/>
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6c0 1.66-3.58 3-8 3s-8-1.34-8-3z"/>
    </svg>
  ),
  history: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </svg>
  ),
  breakpoint: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="8"/>
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  pause: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
    </svg>
  ),
  stop: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 6h12v12H6z"/>
    </svg>
  ),
  skipNext: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  ),
}

// Tab types
type DebugTab = 'controls' | 'variables' | 'history' | 'breakpoints'

export function DebugPanel() {
  const [activeTab, setActiveTab] = useState<DebugTab>('controls')

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--surface-container)' }}
    >
      {/* Tabs */}
      <div
        className="flex gap-1 px-3 pt-3"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <TabButton
          active={activeTab === 'controls'}
          onClick={() => setActiveTab('controls')}
          label="Controls"
          icon={Icons.playCircle}
        />
        <TabButton
          active={activeTab === 'variables'}
          onClick={() => setActiveTab('variables')}
          label="Variables"
          icon={Icons.database}
        />
        <TabButton
          active={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
          label="History"
          icon={Icons.history}
        />
        <TabButton
          active={activeTab === 'breakpoints'}
          onClick={() => setActiveTab('breakpoints')}
          label="Breakpoints"
          icon={Icons.breakpoint}
        />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'controls' && <ControlsTab />}
        {activeTab === 'variables' && <VariablesTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'breakpoints' && <BreakpointsTab />}
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 text-xs font-medium rounded-t-xl transition-all"
      style={{
        backgroundColor: active ? 'var(--surface-container-high)' : 'transparent',
        color: active ? 'var(--on-surface)' : 'var(--on-surface-variant)',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent'
        }
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function ControlsTab() {
  const { status, currentNodeId, reset } = useDebugStore()
  const { flow } = useFlowStore()
  const [inputJson, setInputJson] = useState('{}')
  const [inputError, setInputError] = useState<string | null>(null)

  const currentNode = useMemo(() => {
    if (!currentNodeId) return null
    return flow.nodes.find((n) => n.id === currentNodeId)
  }, [flow.nodes, currentNodeId])

  const handleStart = useCallback(() => {
    try {
      const args = JSON.parse(inputJson)
      setInputError(null)
      console.log('Starting execution with args:', args)
      useDebugStore.getState().setStatus('running')
      useDebugStore.getState().setInputArgs(args)
    } catch {
      setInputError('Invalid JSON format')
    }
  }, [inputJson])

  const handlePause = useCallback(() => {
    useDebugStore.getState().setStatus('paused')
  }, [])

  const handleResume = useCallback(() => {
    useDebugStore.getState().setStatus('running')
  }, [])

  const handleStep = useCallback(() => {
    console.log('Step execution')
  }, [])

  const handleStop = useCallback(() => {
    reset()
  }, [reset])

  return (
    <div className="p-5 space-y-5">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="text-xs uppercase tracking-wider"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            Status
          </span>
          <StatusBadge status={status} />
        </div>
        {currentNode && (
          <div className="flex items-center gap-2">
            <span
              className="text-xs"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              Current:
            </span>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                color: 'var(--on-surface)',
              }}
            >
              {currentNode.data.label}
            </span>
          </div>
        )}
      </div>

      {/* Input args */}
      <div className="space-y-2">
        <label
          className="text-xs font-medium"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          Input Arguments (JSON)
        </label>
        <textarea
          value={inputJson}
          onChange={(e) => setInputJson(e.target.value)}
          className="w-full h-24 p-3 text-xs font-mono rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 transition-all resize-none"
          style={{
            backgroundColor: 'var(--surface-container-highest)',
            border: `1px solid ${inputError ? 'var(--error)' : 'var(--outline-variant)'}`,
            color: 'var(--on-surface)',
          }}
          placeholder="{}"
          disabled={status === 'running'}
        />
        {inputError && (
          <p className="text-xs" style={{ color: 'var(--error)' }}>
            {inputError}
          </p>
        )}
      </div>

      {/* Control buttons */}
      <div className="flex gap-2">
        {status === 'idle' && (
          <ControlButton onClick={handleStart} icon="play" label="Run" variant="primary" />
        )}
        {status === 'running' && (
          <ControlButton onClick={handlePause} icon="pause" label="Pause" variant="warning" />
        )}
        {status === 'paused' && (
          <>
            <ControlButton onClick={handleResume} icon="play" label="Resume" variant="primary" />
            <ControlButton onClick={handleStep} icon="step" label="Step" variant="secondary" />
          </>
        )}
        {(status === 'running' || status === 'paused') && (
          <ControlButton onClick={handleStop} icon="stop" label="Stop" variant="danger" />
        )}
        {(status === 'completed' || status === 'error') && (
          <ControlButton onClick={handleStop} icon="reset" label="Reset" variant="secondary" />
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    idle: { bg: 'var(--surface-container-high)', text: 'var(--on-surface-variant)', label: 'Idle' },
    running: { bg: 'rgba(134, 239, 172, 0.15)', text: '#86efac', label: 'Running' },
    paused: { bg: 'rgba(255, 183, 124, 0.15)', text: '#ffb77c', label: 'Paused' },
    completed: { bg: 'rgba(208, 188, 255, 0.15)', text: '#d0bcff', label: 'Completed' },
    error: { bg: 'rgba(242, 184, 181, 0.15)', text: '#f2b8b5', label: 'Error' },
  }

  const { bg, text, label } = config[status] || config.idle

  return (
    <span
      className="px-2.5 py-1 text-xs font-medium rounded-lg flex items-center gap-1.5"
      style={{ backgroundColor: bg, color: text }}
    >
      {status === 'running' && (
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-md-pulse" />
      )}
      {label}
    </span>
  )
}

function ControlButton({
  onClick,
  icon,
  label,
  variant = 'secondary',
}: {
  onClick: () => void
  icon: string
  label: string
  variant?: 'primary' | 'secondary' | 'warning' | 'danger'
}) {
  const variants = {
    primary: { bg: 'var(--primary-container)', text: 'var(--on-primary-container)' },
    secondary: { bg: 'var(--surface-container-high)', text: 'var(--on-surface)' },
    warning: { bg: 'rgba(255, 183, 124, 0.2)', text: '#ffb77c' },
    danger: { bg: 'rgba(242, 184, 181, 0.2)', text: '#f2b8b5' },
  }

  const { bg, text } = variants[variant]

  const icons: Record<string, React.ReactNode> = {
    play: Icons.play,
    pause: Icons.pause,
    stop: Icons.stop,
    step: Icons.skipNext,
    reset: Icons.refresh,
  }

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl transition-all"
      style={{ backgroundColor: bg, color: text }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '0.9'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1'
      }}
    >
      {icons[icon]}
      {label}
    </button>
  )
}

function VariablesTab() {
  const { variables } = useDebugStore()

  const entries = Object.entries(variables)

  if (entries.length === 0) {
    return (
      <div
        className="p-8 text-center"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--surface-container-high)' }}
        >
          <span style={{ opacity: 0.5 }}>{Icons.database}</span>
        </div>
        <p className="text-sm">No variables yet</p>
      </div>
    )
  }

  return (
    <div className="p-5">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--outline-variant)' }}>
            <th
              className="text-left py-2 text-xs uppercase tracking-wider"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              Name
            </th>
            <th
              className="text-left py-2 text-xs uppercase tracking-wider"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, value]) => (
            <tr
              key={key}
              style={{ borderBottom: '1px solid var(--outline-variant)' }}
            >
              <td
                className="py-3 font-mono"
                style={{ color: 'var(--primary)' }}
              >
                {key}
              </td>
              <td
                className="py-3 font-mono text-xs"
                style={{ color: 'var(--on-surface)' }}
              >
                {formatValue(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatValue(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return `"${value}"`
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function HistoryTab() {
  const { history } = useDebugStore()
  const { flow } = useFlowStore()

  if (history.length === 0) {
    return (
      <div
        className="p-8 text-center"
        style={{ color: 'var(--on-surface-variant)' }}
      >
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--surface-container-high)' }}
        >
          <span style={{ opacity: 0.5 }}>{Icons.history}</span>
        </div>
        <p className="text-sm">No execution history</p>
      </div>
    )
  }

  return (
    <div className="p-5 space-y-2">
      {history.map((entry, index) => {
        const node = flow.nodes.find((n) => n.id === entry.nodeId)
        const isError = entry.state === 'error'
        const isCompleted = entry.state === 'completed'

        return (
          <div
            key={`${entry.nodeId}-${index}`}
            className="p-3 rounded-xl"
            style={{
              backgroundColor: isError
                ? 'rgba(242, 184, 181, 0.1)'
                : isCompleted
                ? 'rgba(134, 239, 172, 0.1)'
                : 'var(--surface-container-high)',
              border: `1px solid ${isError ? 'rgba(242, 184, 181, 0.3)' : isCompleted ? 'rgba(134, 239, 172, 0.3)' : 'var(--outline-variant)'}`,
            }}
          >
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-medium"
                style={{ color: 'var(--on-surface)' }}
              >
                {node?.data.label || entry.nodeId}
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                {entry.duration ? `${entry.duration}ms` : '-'}
              </span>
            </div>
            {entry.error && (
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--error)' }}
              >
                {entry.error}
              </p>
            )}
            {entry.output !== undefined && (
              <p
                className="text-xs font-mono mt-1 truncate"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                {formatValue(entry.output)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function BreakpointsTab() {
  const { breakpoints, toggleBreakpoint, clearBreakpoints } = useDebugStore()
  const { flow } = useFlowStore()

  const breakpointList = Array.from(breakpoints)

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-xs"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          {breakpointList.length} breakpoint{breakpointList.length !== 1 ? 's' : ''}
        </span>
        {breakpointList.length > 0 && (
          <button
            onClick={clearBreakpoints}
            className="text-xs font-medium px-2 py-1 rounded-lg transition-all"
            style={{ color: 'var(--error)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(242, 184, 181, 0.1)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {breakpointList.length === 0 ? (
        <div
          className="text-center py-4"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          <p className="text-sm">Click node edge to add breakpoint</p>
        </div>
      ) : (
        <div className="space-y-2">
          {breakpointList.map((nodeId) => {
            const node = flow.nodes.find((n) => n.id === nodeId)
            return (
              <div
                key={nodeId}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ backgroundColor: 'var(--surface-container-high)' }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: 'var(--error)' }}
                  />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    {node?.data.label || nodeId}
                  </span>
                </div>
                <button
                  onClick={() => toggleBreakpoint(nodeId)}
                  className="text-xs font-medium px-2 py-1 rounded-lg transition-all"
                  style={{ color: 'var(--on-surface-variant)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-container-highest)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  Remove
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div
        className="mt-5 pt-5"
        style={{ borderTop: '1px solid var(--outline-variant)' }}
      >
        <h4
          className="text-xs font-medium mb-3"
          style={{ color: 'var(--on-surface-variant)' }}
        >
          Available Nodes
        </h4>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {flow.nodes
            .filter((n) => !breakpoints.has(n.id))
            .map((node) => (
              <button
                key={node.id}
                onClick={() => toggleBreakpoint(node.id)}
                className="w-full text-left p-2.5 text-sm rounded-xl transition-all"
                style={{ color: 'var(--on-surface-variant)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {node.data.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
