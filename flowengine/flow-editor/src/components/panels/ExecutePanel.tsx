/**
 * Execute Panel Component
 * Shows execution results and status
 */

import { useCallback } from 'react'
import { useExecuteStore } from '@/stores/executeStore'
import { useFlowStore } from '@/stores/flowStore'

const Icons = {
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  ),
  play: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
    </svg>
  ),
  loading: (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.25" />
      <path
        d="M4 12a8 8 0 018-8"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  ),
  refresh: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
    </svg>
  ),
}

export function ExecutePanel() {
  const { state, result, error, closeResultsPanel, reset } = useExecuteStore()
  const { flow } = useFlowStore()
  const execute = useExecuteStore((s) => s.execute)

  const handleRerun = useCallback(() => {
    reset()
    execute(flow)
  }, [reset, execute, flow])

  const getStatusColor = () => {
    switch (state) {
      case 'completed':
        return 'var(--primary)'
      case 'failed':
        return 'var(--error)'
      case 'running':
        return 'var(--tertiary)'
      default:
        return 'var(--on-surface-variant)'
    }
  }

  const getStatusIcon = () => {
    switch (state) {
      case 'completed':
        return Icons.check
      case 'failed':
        return Icons.error
      case 'running':
        return Icons.loading
      default:
        return Icons.play
    }
  }

  const getStatusText = () => {
    switch (state) {
      case 'completed':
        return '执行完成'
      case 'failed':
        return '执行失败'
      case 'running':
        return '执行中...'
      default:
        return '准备就绪'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: getStatusColor() }}>{getStatusIcon()}</span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--on-surface)' }}
          >
            执行结果
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background:
                state === 'completed'
                  ? 'var(--primary-container)'
                  : state === 'failed'
                    ? 'var(--error-container)'
                    : 'var(--surface-container-high)',
              color:
                state === 'completed'
                  ? 'var(--on-primary-container)'
                  : state === 'failed'
                    ? 'var(--on-error-container)'
                    : 'var(--on-surface-variant)',
            }}
          >
            {getStatusText()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {state !== 'running' && (
            <button
              onClick={handleRerun}
              className="p-1.5 rounded-lg transition-all"
              style={{
                background: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)',
              }}
              title="重新执行"
            >
              {Icons.refresh}
            </button>
          )}
          <button
            onClick={closeResultsPanel}
            className="p-1.5 rounded-lg transition-all"
            style={{
              background: 'var(--surface-container-high)',
              color: 'var(--on-surface-variant)',
            }}
            title="关闭"
          >
            {Icons.close}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        {state === 'running' && (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="animate-spin">{Icons.loading}</div>
            <span
              className="text-sm"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              正在执行流程...
            </span>
          </div>
        )}

        {state === 'failed' && error && (
          <div
            className="p-4 rounded-xl"
            style={{
              background: 'var(--error-container)',
              color: 'var(--on-error-container)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              {Icons.error}
              <span className="font-medium">执行错误</span>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {error}
            </pre>
          </div>
        )}

        {state === 'completed' && result && (
          <div className="space-y-4">
            {/* Summary */}
            <div
              className="p-4 rounded-xl"
              style={{
                background: 'var(--primary-container)',
                color: 'var(--on-primary-container)',
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                {Icons.check}
                <span className="font-medium">执行成功</span>
              </div>
              <div className="text-sm space-y-1">
                <p>执行 ID: {result.execution_id}</p>
                {result.result?.duration_ms && (
                  <p>耗时: {result.result.duration_ms}ms</p>
                )}
              </div>
            </div>

            {/* Outputs */}
            {result.result?.outputs && (
              <div>
                <h4
                  className="text-sm font-medium mb-2"
                  style={{ color: 'var(--on-surface)' }}
                >
                  输出结果
                </h4>
                <pre
                  className="p-4 rounded-xl text-xs font-mono overflow-auto"
                  style={{
                    background: 'var(--surface-container-low)',
                    color: 'var(--on-surface)',
                  }}
                >
                  {JSON.stringify(result.result.outputs, null, 2)}
                </pre>
              </div>
            )}

            {/* Node Results */}
            {result.result?.node_results &&
              Object.keys(result.result.node_results).length > 0 && (
                <div>
                  <h4
                    className="text-sm font-medium mb-2"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    节点结果
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(result.result.node_results).map(
                      ([nodeId, nodeResult]) => (
                        <div
                          key={nodeId}
                          className="p-3 rounded-lg"
                          style={{
                            background: 'var(--surface-container-low)',
                          }}
                        >
                          <div
                            className="text-xs font-medium mb-1"
                            style={{ color: 'var(--on-surface-variant)' }}
                          >
                            {nodeId}
                          </div>
                          <pre
                            className="text-xs font-mono overflow-auto"
                            style={{ color: 'var(--on-surface)' }}
                          >
                            {JSON.stringify(nodeResult as Record<string, unknown>, null, 2)}
                          </pre>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {state === 'idle' && (
          <div
            className="flex flex-col items-center justify-center h-full gap-2"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            <span className="text-sm">点击执行按钮运行流程</span>
          </div>
        )}
      </div>
    </div>
  )
}
