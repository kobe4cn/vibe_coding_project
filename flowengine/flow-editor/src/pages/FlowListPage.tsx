/**
 * Flow List Page
 * Displays all saved flows with search, filter, and management capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStorage } from '@/lib/storage'
import type { FlowEntry, ListOptions } from '@/lib/storage'
import { exportAndDownloadFlow, exportAndDownloadFlows } from '@/lib/flowExport'
import { importFromFile, type ImportResult } from '@/lib/flowImport'
import { flowTemplates, applyTemplate, type FlowTemplate } from '@/lib/flowTemplates'

// Icons
const Icons = {
  add: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  ),
  folder: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
    </svg>
  ),
  bolt: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
    </svg>
  ),
  moreVert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
  ),
  delete: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  edit: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
    </svg>
  ),
  sortAsc: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/>
    </svg>
  ),
  copy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
  ),
  download: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
    </svg>
  ),
  upload: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 20h14v-2H5v2zM5 10h4v6h6v-6h4l-7-7-7 7z"/>
    </svg>
  ),
  template: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 7h2v2H7zm0 4h2v2H7zm0 4h2v2H7zm4-8h6v2h-6zm0 4h6v2h-6zm0 4h6v2h-6z"/>
    </svg>
  ),
  // Template icons
  blank: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
    </svg>
  ),
  api: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 12l-2 2-2-2 2-2 2 2zm-2-6l2.12 2.12 2.5-2.5L12 1 7.38 5.62l2.5 2.5L12 6zm-6 6l2.12-2.12-2.5-2.5L1 12l4.62 4.62 2.5-2.5L6 12zm12 0l-2.12 2.12 2.5 2.5L23 12l-4.62-4.62-2.5 2.5L18 12zm-6 6l-2.12-2.12-2.5 2.5L12 23l4.62-4.62-2.5-2.5L12 18z"/>
    </svg>
  ),
  branch: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 4l2.29 2.29-2.88 2.88 1.42 1.42 2.88-2.88L20 10V4h-6zm-4 0H4v6l2.29-2.29 4.71 4.7V20h2v-8.41l-5.29-5.3L10 4z"/>
    </svg>
  ),
  loop: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
    </svg>
  ),
  ai: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 10.12h-6.78l2.74-2.82c-2.73-2.7-7.15-2.8-9.88-.1-2.73 2.71-2.73 7.08 0 9.79s7.15 2.71 9.88 0C18.32 15.65 19 14.08 19 12.1h2c0 1.98-.88 4.55-2.64 6.29-3.51 3.48-9.21 3.48-12.72 0-3.5-3.47-3.53-9.11-.02-12.58s9.14-3.47 12.65 0L21 3v7.12zM12.5 8v4.25l3.5 2.08-.72 1.21L11 13V8h1.5z"/>
    </svg>
  ),
  data: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
    </svg>
  ),
  tools: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
    </svg>
  ),
}

interface CreateFlowDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description?: string, template?: FlowTemplate) => void
}

function CreateFlowDialog({ open, onClose, onCreate }: CreateFlowDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<FlowTemplate>(flowTemplates[0])
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    try {
      await onCreate(name.trim(), description.trim() || undefined, selectedTemplate)
      setName('')
      setDescription('')
      setSelectedTemplate(flowTemplates[0])
      onClose()
    } finally {
      setCreating(false)
    }
  }

  const getTemplateIcon = (icon: FlowTemplate['icon']) => {
    return Icons[icon] || Icons.blank
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-md-fade-in max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface-container-high)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-xl font-medium mb-6"
          style={{ color: 'var(--on-surface)' }}
        >
          新建流程
        </h2>

        <div className="space-y-4">
          {/* Template selection */}
          <div>
            <label
              className="block text-sm font-medium mb-3"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              选择模板
            </label>
            <div className="grid grid-cols-3 gap-2">
              {flowTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    backgroundColor:
                      selectedTemplate.id === template.id
                        ? 'var(--primary-container)'
                        : 'var(--surface-container-highest)',
                    border:
                      selectedTemplate.id === template.id
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                    style={{
                      backgroundColor:
                        selectedTemplate.id === template.id
                          ? 'var(--primary)'
                          : 'var(--surface-container)',
                      color:
                        selectedTemplate.id === template.id
                          ? 'var(--on-primary)'
                          : 'var(--on-surface-variant)',
                    }}
                  >
                    {getTemplateIcon(template.icon)}
                  </div>
                  <div
                    className="text-xs font-medium truncate"
                    style={{
                      color:
                        selectedTemplate.id === template.id
                          ? 'var(--on-primary-container)'
                          : 'var(--on-surface)',
                    }}
                  >
                    {template.name}
                  </div>
                  <div
                    className="text-[10px] truncate mt-0.5"
                    style={{
                      color:
                        selectedTemplate.id === template.id
                          ? 'var(--on-primary-container)'
                          : 'var(--on-surface-variant)',
                      opacity: 0.8,
                    }}
                  >
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              流程名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入流程名称"
              className="w-full px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
              style={{
                backgroundColor: 'var(--surface-container-highest)',
                border: '1px solid var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
              autoFocus
            />
          </div>

          <div>
            <label
              className="block text-sm font-medium mb-2"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              描述 (可选)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入流程描述"
              className="w-full px-4 py-3 text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50 resize-none"
              style={{
                backgroundColor: 'var(--surface-container-highest)',
                border: '1px solid var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all"
            style={{
              backgroundColor: 'var(--surface-container-highest)',
              color: 'var(--on-surface-variant)',
            }}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
            }}
          >
            {creating ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface FlowCardProps {
  flow: FlowEntry
  onOpen: () => void
  onDelete: () => void
  onRename: (newName: string) => void
  onCopy: () => void
  onExport: () => void
}

function FlowCard({ flow, onOpen, onDelete, onRename, onCopy, onExport }: FlowCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(flow.name)

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleRename = () => {
    if (newName.trim() && newName !== flow.name) {
      onRename(newName.trim())
    }
    setIsRenaming(false)
  }

  return (
    <div
      className="rounded-2xl p-5 transition-all cursor-pointer group relative"
      style={{
        backgroundColor: 'var(--surface-container)',
        boxShadow: 'var(--elevation-1)',
      }}
      onClick={onOpen}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elevation-2)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'var(--elevation-1)'
        setShowMenu(false)
      }}
    >
      {/* Thumbnail placeholder */}
      <div
        className="w-full h-32 rounded-xl mb-4 flex items-center justify-center"
        style={{
          backgroundColor: 'var(--surface-container-high)',
          background: flow.thumbnail
            ? `url(${flow.thumbnail}) center/cover`
            : 'linear-gradient(135deg, var(--primary-container) 0%, var(--secondary-container) 100%)',
        }}
      >
        {!flow.thumbnail && (
          <span style={{ color: 'var(--on-primary-container)', opacity: 0.5 }}>
            {Icons.bolt}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {isRenaming ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsRenaming(false)
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-2 py-1 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/50"
              style={{
                backgroundColor: 'var(--surface-container-highest)',
                color: 'var(--on-surface)',
              }}
              autoFocus
            />
          ) : (
            <h3
              className="text-sm font-medium truncate"
              style={{ color: 'var(--on-surface)' }}
            >
              {flow.name}
            </h3>
          )}
          {flow.description && (
            <p
              className="text-xs mt-1 line-clamp-2"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {flow.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              className="text-xs"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {formatDate(flow.updatedAt)}
            </span>
            <span
              className="text-xs"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {flow.versionCount} 个版本
            </span>
          </div>
        </div>

        {/* Menu button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            {Icons.moreVert}
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 py-2 rounded-xl shadow-lg z-10 min-w-32"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                boxShadow: 'var(--elevation-2)',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsRenaming(true)
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-sm text-left flex items-center gap-3 transition-colors"
                style={{ color: 'var(--on-surface)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-container-highest)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {Icons.edit}
                重命名
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy()
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-sm text-left flex items-center gap-3 transition-colors"
                style={{ color: 'var(--on-surface)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-container-highest)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {Icons.copy}
                复制
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExport()
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-sm text-left flex items-center gap-3 transition-colors"
                style={{ color: 'var(--on-surface)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-container-highest)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {Icons.download}
                导出
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                  setShowMenu(false)
                }}
                className="w-full px-4 py-2 text-sm text-left flex items-center gap-3 transition-colors"
                style={{ color: 'var(--error)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--error-container)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                {Icons.delete}
                删除
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function FlowListPage() {
  const navigate = useNavigate()
  const storage = useStorage()
  const [flows, setFlows] = useState<FlowEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showImportResult, setShowImportResult] = useState<ImportResult | null>(null)
  const [sortBy, setSortBy] = useState<ListOptions['sortBy']>('updatedAt')
  const [sortOrder, setSortOrder] = useState<ListOptions['sortOrder']>('desc')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFlows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await storage.listFlows({
        search: search || undefined,
        sortBy,
        sortOrder,
      })
      setFlows(result)
    } finally {
      setLoading(false)
    }
  }, [storage, search, sortBy, sortOrder])

  useEffect(() => {
    loadFlows()
  }, [loadFlows])

  const handleCreateFlow = async (name: string, description?: string, template?: FlowTemplate) => {
    const newFlow = await storage.createFlow({ name, description })

    // If a template is selected and it's not blank, save the initial version with template content
    if (template && template.id !== 'blank') {
      const flowFromTemplate = applyTemplate(template, name, description)
      await storage.saveVersion(newFlow.id, {
        name: '初始版本',
        description: `从模板"${template.name}"创建`,
        flow: flowFromTemplate,
      })
    }

    navigate(`/editor/${newFlow.id}`)
  }

  const handleOpenFlow = (flowId: string) => {
    navigate(`/editor/${flowId}`)
  }

  const handleDeleteFlow = async (flowId: string) => {
    if (!confirm('确定要删除这个流程吗？所有版本都将被删除。')) return
    await storage.deleteFlow(flowId)
    await loadFlows()
  }

  const handleRenameFlow = async (flowId: string, newName: string) => {
    await storage.updateFlow(flowId, { name: newName })
    await loadFlows()
  }

  const handleCopyFlow = async (flowId: string) => {
    const flowEntry = await storage.getFlow(flowId)
    if (!flowEntry) return

    // Get the latest version
    const latestVersion = await storage.getLatestVersion(flowId)

    // Create a new flow with copied name
    const newFlow = await storage.createFlow({
      name: `${flowEntry.name} (副本)`,
      description: flowEntry.description,
      tags: flowEntry.tags,
    })

    // Copy the latest version if it exists
    if (latestVersion) {
      await storage.saveVersion(newFlow.id, {
        name: '初始版本',
        flow: latestVersion.flow,
      })
    }

    await loadFlows()
  }

  const handleExportFlow = async (flowId: string) => {
    await exportAndDownloadFlow(storage, flowId, { includeVersions: true })
  }

  const handleImportFlows = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const result = await importFromFile(storage, file)
    setShowImportResult(result)
    await loadFlows()

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const toggleSort = () => {
    if (sortBy === 'updatedAt') {
      setSortBy('name')
    } else if (sortBy === 'name') {
      setSortBy('createdAt')
    } else {
      setSortBy('updatedAt')
    }
  }

  const getSortLabel = () => {
    if (sortBy === 'updatedAt') return '最近更新'
    if (sortBy === 'name') return '名称'
    return '创建时间'
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'var(--surface-dim)' }}
    >
      {/* Header */}
      <header
        className="px-6 py-4"
        style={{
          backgroundColor: 'var(--surface-container)',
          borderBottom: '1px solid var(--outline-variant)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--primary-container) 0%, var(--secondary-container) 100%)',
                color: 'var(--on-primary-container)',
              }}
            >
              {Icons.bolt}
            </div>
            <div>
              <h1
                className="text-lg font-medium"
                style={{ color: 'var(--on-surface)' }}
              >
                Flow Editor
              </h1>
              <p
                className="text-xs"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                Flow Definition Language
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/tools"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)',
              }}
            >
              {Icons.tools}
              工具管理
            </Link>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFlows}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)',
              }}
            >
              {Icons.upload}
              导入
            </button>
            <button
              onClick={() => setShowCreateDialog(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              {Icons.add}
              新建流程
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Search & Filter bar */}
        <div className="flex items-center gap-4 mb-6">
          <div
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{
              backgroundColor: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            <span style={{ color: 'var(--on-surface-variant)' }}>
              {Icons.search}
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索流程..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--on-surface)' }}
            />
          </div>

          <button
            onClick={toggleSort}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm transition-all"
            style={{
              backgroundColor: 'var(--surface-container)',
              color: 'var(--on-surface-variant)',
              border: '1px solid var(--outline-variant)',
            }}
          >
            {Icons.sortAsc}
            {getSortLabel()}
          </button>
        </div>

        {/* Flow grid */}
        {loading ? (
          <div
            className="flex items-center justify-center py-20"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm">加载中...</p>
            </div>
          </div>
        ) : flows.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: 'var(--surface-container)' }}
            >
              <span style={{ opacity: 0.5 }}>{Icons.folder}</span>
            </div>
            <h3
              className="text-lg font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              {search ? '没有找到匹配的流程' : '还没有流程'}
            </h3>
            <p className="text-sm mb-6">
              {search ? '尝试其他搜索词' : '点击上方按钮创建第一个流程'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreateDialog(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                }}
              >
                {Icons.add}
                新建流程
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {flows.map((flow) => (
              <FlowCard
                key={flow.id}
                flow={flow}
                onOpen={() => handleOpenFlow(flow.id)}
                onDelete={() => handleDeleteFlow(flow.id)}
                onRename={(newName) => handleRenameFlow(flow.id, newName)}
                onCopy={() => handleCopyFlow(flow.id)}
                onExport={() => handleExportFlow(flow.id)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create dialog */}
      <CreateFlowDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateFlow}
      />

      {/* Import result dialog */}
      {showImportResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowImportResult(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6 shadow-2xl animate-md-fade-in"
            style={{ backgroundColor: 'var(--surface-container-high)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-xl font-medium mb-4"
              style={{ color: 'var(--on-surface)' }}
            >
              导入结果
            </h2>

            <div className="space-y-3 mb-6">
              <div
                className="flex justify-between text-sm"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                <span>成功导入</span>
                <span
                  className="font-medium"
                  style={{ color: 'var(--tertiary)' }}
                >
                  {showImportResult.successfulFlows} 个流程
                </span>
              </div>
              {showImportResult.failedFlows > 0 && (
                <div
                  className="flex justify-between text-sm"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  <span>导入失败</span>
                  <span
                    className="font-medium"
                    style={{ color: 'var(--error)' }}
                  >
                    {showImportResult.failedFlows} 个流程
                  </span>
                </div>
              )}
              <div
                className="flex justify-between text-sm"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                <span>版本总数</span>
                <span className="font-medium">
                  {showImportResult.totalVersions} 个版本
                </span>
              </div>
            </div>

            {showImportResult.results.some((r) => r.renamed) && (
              <div
                className="p-3 rounded-xl mb-4 text-sm"
                style={{
                  backgroundColor: 'var(--surface-container-highest)',
                  color: 'var(--on-surface-variant)',
                }}
              >
                <p className="font-medium mb-2">以下流程已重命名以避免冲突：</p>
                <ul className="list-disc list-inside space-y-1">
                  {showImportResult.results
                    .filter((r) => r.renamed)
                    .map((r, i) => (
                      <li key={i}>
                        {r.flowName} → {r.newName}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setShowImportResult(null)}
              className="w-full px-4 py-3 text-sm font-medium rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
