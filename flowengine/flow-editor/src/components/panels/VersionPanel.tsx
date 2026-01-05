/**
 * Version Panel Component
 * Material Design 3 styled version history using StorageProvider
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFlowStore } from '@/stores/flowStore'
import { useStorage } from '@/lib/storage'
import type { FlowVersionSummary } from '@/lib/storage'

// Material Icons
const Icons = {
  add: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  history: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </svg>
  ),
  restore: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3a9 9 0 0 0-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42A8.954 8.954 0 0 0 13 21a9 9 0 0 0 0-18zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </svg>
  ),
  delete: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  preview: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  loading: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="animate-spin">
      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>
  ),
}

interface VersionPanelProps {
  flowId?: string
}

export function VersionPanel({ flowId }: VersionPanelProps) {
  const navigate = useNavigate()
  const { flow, setFlow, setIsDirty } = useFlowStore()
  const storage = useStorage()
  const [versions, setVersions] = useState<FlowVersionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Auto-save refs
  const autoSaveIntervalRef = useRef<number | null>(null)
  const lastAutoSaveRef = useRef<string | null>(null)

  // Load versions
  const loadVersions = useCallback(async () => {
    if (!flowId) {
      setLoading(false)
      return
    }

    try {
      const v = await storage.listVersions(flowId)
      setVersions(v)
    } catch (err) {
      console.error('Failed to load versions:', err)
    } finally {
      setLoading(false)
    }
  }, [flowId, storage])

  useEffect(() => {
    loadVersions()
  }, [loadVersions])

  // Auto-save setup
  useEffect(() => {
    if (!flowId) return

    const autoSaveInterval = 120000 // 2 minutes

    autoSaveIntervalRef.current = window.setInterval(async () => {
      const currentFlowJson = JSON.stringify(flow)

      // Only save if flow has changed
      if (lastAutoSaveRef.current === currentFlowJson) {
        return
      }

      lastAutoSaveRef.current = currentFlowJson

      try {
        await storage.saveVersion(flowId, {
          name: '自动保存',
          flow,
          isAutoSave: true,
        })
        // Refresh versions list
        const v = await storage.listVersions(flowId)
        setVersions(v)
      } catch (err) {
        console.error('Auto-save failed:', err)
      }
    }, autoSaveInterval)

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [flowId, flow, storage])

  const handleSaveVersion = useCallback(async () => {
    if (!flowId) return

    setSaving(true)
    try {
      await storage.saveVersion(flowId, {
        name: saveName || `版本 ${versions.length + 1}`,
        description: saveDescription,
        flow,
      })
      await loadVersions()
      setShowSaveDialog(false)
      setSaveName('')
      setSaveDescription('')
      setIsDirty(false)
    } catch (err) {
      console.error('Failed to save version:', err)
    } finally {
      setSaving(false)
    }
  }, [flowId, storage, flow, saveName, saveDescription, versions.length, loadVersions, setIsDirty])

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      if (!flowId) return

      try {
        const version = await storage.getVersion(flowId, versionId)
        if (version) {
          setFlow(version.flow)
          setIsDirty(true)
        }
      } catch (err) {
        console.error('Failed to restore version:', err)
      }
    },
    [flowId, storage, setFlow, setIsDirty]
  )

  const handleDeleteVersion = useCallback(
    async (versionId: string) => {
      if (!flowId) return
      if (!confirm('删除此版本?')) return

      try {
        await storage.deleteVersion(flowId, versionId)
        await loadVersions()
      } catch (err) {
        console.error('Failed to delete version:', err)
      }
    },
    [flowId, storage, loadVersions]
  )

  const handlePreviewVersion = useCallback(
    (versionId: string) => {
      if (!flowId) return
      navigate(`/editor/${flowId}/version/${versionId}`)
    },
    [flowId, navigate]
  )

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`

    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
  }

  if (!flowId) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ background: 'var(--surface-container)' }}
      >
        <div className="text-center p-8">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface-container-high)' }}
          >
            <span style={{ opacity: 0.5 }}>{Icons.history}</span>
          </div>
          <p
            className="text-sm"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            请先保存流程
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div
        className="h-full flex items-center justify-center"
        style={{ background: 'var(--surface-container)' }}
      >
        <div className="flex items-center gap-2" style={{ color: 'var(--on-surface-variant)' }}>
          {Icons.loading}
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: 'var(--surface-container)' }}
    >
      {/* Header */}
      <div
        className="px-5 pt-6 pb-4"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            版本历史
          </h3>
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium rounded-lg transition-all"
            style={{
              backgroundColor: 'var(--primary-container)',
              color: 'var(--on-primary-container)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {Icons.add}
            保存
          </button>
        </div>
        <p
          className="text-[11px]"
          style={{ color: 'var(--outline)' }}
        >
          {versions.length} 个版本
        </p>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div
          className="p-5 animate-md-fade-in"
          style={{
            borderBottom: '1px solid var(--outline-variant)',
            backgroundColor: 'var(--surface-container-high)',
          }}
        >
          <h4
            className="text-sm font-medium mb-4"
            style={{ color: 'var(--on-surface)' }}
          >
            保存新版本
          </h4>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="版本名称"
            className="w-full px-3 py-2.5 text-sm rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
            style={{
              backgroundColor: 'var(--surface-container-highest)',
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
            }}
          />
          <textarea
            value={saveDescription}
            onChange={(e) => setSaveDescription(e.target.value)}
            placeholder="描述 (可选)"
            className="w-full px-3 py-2.5 text-sm rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 resize-none"
            style={{
              backgroundColor: 'var(--surface-container-highest)',
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
            }}
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveVersion}
              disabled={saving}
              className="flex-1 px-4 py-2 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
              style={{
                backgroundColor: 'var(--primary-container)',
                color: 'var(--on-primary-container)',
              }}
            >
              {saving ? '保存中...' : '保存版本'}
            </button>
            <button
              onClick={() => setShowSaveDialog(false)}
              className="px-4 py-2 text-xs font-medium rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--surface-container-highest)',
                color: 'var(--on-surface-variant)',
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Version list */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
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
            <p className="text-sm">暂无保存的版本</p>
          </div>
        ) : (
          <div className="p-3">
            {versions.map((version) => (
              <VersionItem
                key={version.id}
                version={version}
                onPreview={() => handlePreviewVersion(version.id)}
                onRestore={() => handleRestoreVersion(version.id)}
                onDelete={() => handleDeleteVersion(version.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function VersionItem({
  version,
  onPreview,
  onRestore,
  onDelete,
  formatDate,
}: {
  version: FlowVersionSummary
  onPreview: () => void
  onRestore: () => void
  onDelete: () => void
  formatDate: (ts: number) => string
}) {
  const [showActions, setShowActions] = useState(false)

  return (
    <div
      className="p-3 rounded-xl mb-2 transition-all cursor-pointer"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => {
        setShowActions(true)
        e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'
      }}
      onMouseLeave={(e) => {
        setShowActions(false)
        e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-medium truncate"
              style={{ color: 'var(--on-surface)' }}
            >
              {version.name}
            </span>
            {version.isAutoSave && (
              <span
                className="px-2 py-0.5 text-[10px] font-medium rounded-lg"
                style={{
                  backgroundColor: 'var(--surface-container-highest)',
                  color: 'var(--on-surface-variant)',
                }}
              >
                自动
              </span>
            )}
          </div>
          {version.description && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {version.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-xs font-mono"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              v{version.version}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {formatDate(version.createdAt)}
            </span>
          </div>
        </div>

        {showActions && (
          <div className="flex gap-1 ml-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onPreview()
              }}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'var(--tertiary)' }}
              title="预览"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(125, 196, 186, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {Icons.preview}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRestore()
              }}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'var(--primary)' }}
              title="恢复"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(208, 188, 255, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {Icons.restore}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'var(--error)' }}
              title="删除"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(242, 184, 181, 0.1)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              {Icons.delete}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
