/**
 * Published Flows Page
 * Displays all published flows with management capabilities
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'

// Icons
const Icons = {
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
  ),
  publish: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 4v2h14V4H5zm0 10h4v6h6v-6h4l-7-7-7 7z"/>
    </svg>
  ),
  unpublish: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
    </svg>
  ),
  view: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  key: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.65 10C11.83 7.67 9.61 6 7 6c-3.31 0-6 2.69-6 6s2.69 6 6 6c2.61 0 4.83-1.67 5.65-4H17v4h4v-4h2v-4H12.65zM7 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  copy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  bolt: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
    </svg>
  ),
  empty: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 12H5c-.55 0-1-.45-1-1V9c0-.55.45-1 1-1h14c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1z"/>
    </svg>
  ),
  moreVert: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
    </svg>
  ),
  refresh: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  ),
  help: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
    </svg>
  ),
  code: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>
  ),
  link: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/>
    </svg>
  ),
}

// API flow type with publish info
interface PublishedFlow {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  version_count: number
  created_at: string
  updated_at: string
  published: boolean
  published_at: string | null
  published_version_id: string | null
}

interface ApiKeyInfo {
  id: string
  name: string
  key_prefix: string
  is_active: boolean
  rate_limit: number
  usage_count: number
  last_used_at: string | null
  created_at: string
  expires_at: string | null
}

interface NewlyCreatedKey {
  id: string
  name: string
  key: string
  key_prefix: string
}

// 获取后端 API 基础 URL
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`
  }
  return 'http://localhost:3001/api'
}

export function PublishedFlowsPage() {
  const navigate = useNavigate()
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), [])
  const tenantId = 'default'

  const [flows, setFlows] = useState<PublishedFlow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  // API Keys dialog state
  const [showApiKeysDialog, setShowApiKeysDialog] = useState(false)
  const [selectedFlowForKeys, setSelectedFlowForKeys] = useState<PublishedFlow | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  // Create key form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDescription, setNewKeyDescription] = useState('')
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(100)
  const [newKeyExpiresInDays, setNewKeyExpiresInDays] = useState<number | undefined>(undefined)
  const [creatingKey, setCreatingKey] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewlyCreatedKey | null>(null)

  // Help dialog state
  const [showHelpDialog, setShowHelpDialog] = useState(false)
  const [helpFlowId, setHelpFlowId] = useState<string | null>(null)

  // 获取外部 API 调用地址
  const getExternalApiUrl = (flowId: string) => {
    const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
    return `${backendUrl}/api/v1/flows/${flowId}/execute`
  }

  // Load published flows
  const loadFlows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `${apiBaseUrl}/flows?tenant_id=${tenantId}&published=true`
      )
      if (!response.ok) throw new Error('Failed to load published flows')

      const data = await response.json()
      setFlows(data.flows || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl])

  useEffect(() => {
    loadFlows()
  }, [loadFlows])

  // Unpublish a flow
  const handleUnpublish = async (flowId: string) => {
    if (!confirm('确定要取消发布该流程吗？API 密钥将失效。')) return

    try {
      const response = await fetch(`${apiBaseUrl}/flows/${flowId}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      })

      if (!response.ok) throw new Error('Failed to unpublish flow')

      await loadFlows()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to unpublish')
    }
  }

  // View flow in editor (read-only mode with published version)
  const handleViewFlow = (flowId: string, versionId: string | null) => {
    if (versionId) {
      navigate(`/editor/${flowId}/version/${versionId}`)
    } else {
      navigate(`/editor/${flowId}`)
    }
  }

  // Load API keys for a flow
  const loadApiKeys = async (flow: PublishedFlow) => {
    setSelectedFlowForKeys(flow)
    setShowApiKeysDialog(true)
    setLoadingKeys(true)
    // Reset form state
    setShowCreateForm(false)
    setNewlyCreatedKey(null)
    setNewKeyName('')
    setNewKeyDescription('')
    setNewKeyRateLimit(100)
    setNewKeyExpiresInDays(undefined)

    try {
      const response = await fetch(
        `${apiBaseUrl}/flows/${flow.id}/api-keys?tenant_id=${tenantId}`
      )
      if (!response.ok) throw new Error('Failed to load API keys')

      const data = await response.json()
      setApiKeys(data.api_keys || [])
    } catch (err) {
      console.error('Failed to load API keys:', err)
      setApiKeys([])
    } finally {
      setLoadingKeys(false)
    }
  }

  // Refresh API keys for current flow
  const refreshApiKeys = async () => {
    if (!selectedFlowForKeys) return

    try {
      const response = await fetch(
        `${apiBaseUrl}/flows/${selectedFlowForKeys.id}/api-keys?tenant_id=${tenantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.api_keys || [])
      }
    } catch (err) {
      console.error('Failed to refresh API keys:', err)
    }
  }

  // Create new API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !selectedFlowForKeys) return

    setCreatingKey(true)

    try {
      const response = await fetch(
        `${apiBaseUrl}/flows/${selectedFlowForKeys.id}/api-keys`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: newKeyName.trim(),
            description: newKeyDescription.trim() || undefined,
            rate_limit: newKeyRateLimit,
            expires_in_days: newKeyExpiresInDays,
            tenant_id: tenantId,
          }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '创建 API Key 失败')
      }

      const data = await response.json()

      // Show the newly created key (contains the full key, only shown once)
      setNewlyCreatedKey({
        id: data.id,
        name: data.name,
        key: data.key,
        key_prefix: data.key_prefix,
      })

      // Reset form
      setNewKeyName('')
      setNewKeyDescription('')
      setNewKeyRateLimit(100)
      setNewKeyExpiresInDays(undefined)
      setShowCreateForm(false)

      // Refresh keys list
      await refreshApiKeys()
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建 API Key 失败')
    } finally {
      setCreatingKey(false)
    }
  }

  // Delete API key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('确定要删除此 API Key 吗？此操作不可恢复。')) return
    if (!selectedFlowForKeys) return

    try {
      const response = await fetch(
        `${apiBaseUrl}/flows/${selectedFlowForKeys.id}/api-keys/${keyId}?tenant_id=${tenantId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      setApiKeys((keys) => keys.filter((k) => k.id !== keyId))
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  // Copy text to clipboard
  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKeyId(keyId)
    setTimeout(() => setCopiedKeyId(null), 2000)
  }

  // Format date
  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Filter flows by search
  const filteredFlows = flows.filter((f) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      f.name.toLowerCase().includes(searchLower) ||
      f.description?.toLowerCase().includes(searchLower)
    )
  })

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
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-xl transition-all"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {Icons.back}
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, var(--tertiary-container) 0%, var(--primary-container) 100%)',
                color: 'var(--on-tertiary-container)',
              }}
            >
              {Icons.publish}
            </div>
            <div>
              <h1
                className="text-lg font-medium"
                style={{ color: 'var(--on-surface)' }}
              >
                已发布流程
              </h1>
              <p
                className="text-xs"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                管理对外开放的 API 服务
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadFlows}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: 'var(--surface-container-high)',
                color: 'var(--on-surface-variant)',
              }}
            >
              {Icons.refresh}
              刷新
            </button>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              {Icons.bolt}
              所有流程
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Search bar */}
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
              placeholder="搜索已发布流程..."
              className="flex-1 bg-transparent text-sm focus:outline-none"
              style={{ color: 'var(--on-surface)' }}
            />
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div
            className="p-4 rounded-xl mb-6"
            style={{
              backgroundColor: 'var(--error-container)',
              color: 'var(--on-error-container)',
            }}
          >
            {error}
          </div>
        )}

        {/* Loading state */}
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
        ) : filteredFlows.length === 0 ? (
          /* Empty state */
          <div
            className="flex flex-col items-center justify-center py-20"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ backgroundColor: 'var(--surface-container)' }}
            >
              <span style={{ opacity: 0.5 }}>{Icons.empty}</span>
            </div>
            <h3
              className="text-lg font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              {search ? '没有找到匹配的流程' : '还没有已发布的流程'}
            </h3>
            <p className="text-sm mb-6">
              {search ? '尝试其他搜索词' : '在流程编辑器中发布流程后即可在此管理'}
            </p>
            {!search && (
              <Link
                to="/"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                }}
              >
                {Icons.bolt}
                浏览所有流程
              </Link>
            )}
          </div>
        ) : (
          /* Flow list */
          <div className="space-y-3">
            {filteredFlows.map((flow) => (
              <div
                key={flow.id}
                className="rounded-2xl p-5 transition-all"
                style={{
                  backgroundColor: 'var(--surface-container)',
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div
                    className="w-16 h-16 rounded-xl flex-shrink-0 flex items-center justify-center"
                    style={{
                      backgroundColor: 'var(--surface-container-high)',
                      background: flow.thumbnail
                        ? `url(${flow.thumbnail}) center/cover`
                        : 'linear-gradient(135deg, var(--tertiary-container) 0%, var(--primary-container) 100%)',
                    }}
                  >
                    {!flow.thumbnail && (
                      <span style={{ color: 'var(--on-tertiary-container)', opacity: 0.6 }}>
                        {Icons.bolt}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3
                        className="text-base font-medium truncate"
                        style={{ color: 'var(--on-surface)' }}
                      >
                        {flow.name}
                      </h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: 'var(--tertiary-container)',
                          color: 'var(--on-tertiary-container)',
                        }}
                      >
                        已发布
                      </span>
                    </div>

                    {flow.description && (
                      <p
                        className="text-sm line-clamp-1 mb-1"
                        style={{ color: 'var(--on-surface-variant)' }}
                      >
                        {flow.description}
                      </p>
                    )}

                    {/* API URL */}
                    <div
                      className="flex items-center gap-2 mb-2 p-2 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-container-high)' }}
                    >
                      <span style={{ color: 'var(--primary)', flexShrink: 0 }}>{Icons.link}</span>
                      <code
                        className="text-xs font-mono truncate flex-1"
                        style={{ color: 'var(--on-surface-variant)' }}
                        title={getExternalApiUrl(flow.id)}
                      >
                        {getExternalApiUrl(flow.id)}
                      </code>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(getExternalApiUrl(flow.id), `url-${flow.id}`)
                        }}
                        className="p-1 rounded transition-all flex-shrink-0"
                        style={{ color: 'var(--on-surface-variant)' }}
                        title="复制 API 地址"
                      >
                        {copiedKeyId === `url-${flow.id}` ? (
                          <span style={{ color: 'var(--tertiary)' }}>{Icons.check}</span>
                        ) : (
                          Icons.copy
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setHelpFlowId(flow.id)
                          setShowHelpDialog(true)
                        }}
                        className="p-1 rounded transition-all flex-shrink-0"
                        style={{ color: 'var(--primary)' }}
                        title="查看调用示例"
                      >
                        {Icons.code}
                      </button>
                    </div>

                    <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                      <span>发布于 {formatDate(flow.published_at)}</span>
                      <span>{flow.version_count} 个版本</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleViewFlow(flow.id, flow.published_version_id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                      style={{
                        backgroundColor: 'var(--surface-container-high)',
                        color: 'var(--on-surface-variant)',
                      }}
                      title="查看流程"
                    >
                      {Icons.view}
                      查看
                    </button>
                    <button
                      onClick={() => loadApiKeys(flow)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                      style={{
                        backgroundColor: 'var(--tertiary-container)',
                        color: 'var(--on-tertiary-container)',
                      }}
                      title="管理 API 密钥"
                    >
                      {Icons.key}
                      API 密钥
                    </button>
                    <button
                      onClick={() => handleUnpublish(flow.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                      style={{
                        backgroundColor: 'var(--error-container)',
                        color: 'var(--on-error-container)',
                      }}
                      title="取消发布"
                    >
                      {Icons.unpublish}
                      取消发布
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* API Keys Dialog */}
      {showApiKeysDialog && selectedFlowForKeys && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowApiKeysDialog(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-md-fade-in max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-container-high)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2
                  className="text-xl font-medium"
                  style={{ color: 'var(--on-surface)' }}
                >
                  API 密钥管理
                </h2>
                <p
                  className="text-sm mt-1"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {selectedFlowForKeys.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!showCreateForm && !newlyCreatedKey && (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--on-primary)',
                    }}
                  >
                    {Icons.plus}
                    新建密钥
                  </button>
                )}
                <button
                  onClick={() => setShowApiKeysDialog(false)}
                  className="p-2 rounded-xl"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {Icons.unpublish}
                </button>
              </div>
            </div>

            {/* Newly Created Key Display */}
            {newlyCreatedKey && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{
                  backgroundColor: 'var(--tertiary-container)',
                  border: '2px solid var(--tertiary)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: 'var(--on-tertiary-container)' }}>{Icons.check}</span>
                  <span
                    className="font-medium"
                    style={{ color: 'var(--on-tertiary-container)' }}
                  >
                    密钥创建成功
                  </span>
                </div>
                <p
                  className="text-xs mb-3"
                  style={{ color: 'var(--on-tertiary-container)', opacity: 0.8 }}
                >
                  请立即复制保存此密钥，关闭后将无法再次查看完整密钥。
                </p>
                <div
                  className="p-3 rounded-lg flex items-center justify-between"
                  style={{ backgroundColor: 'var(--surface-container-highest)' }}
                >
                  <code
                    className="text-sm font-mono flex-1 break-all"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    {newlyCreatedKey.key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey.key, 'new-key')}
                    className="ml-2 p-2 rounded-lg flex-shrink-0"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--on-primary)',
                    }}
                  >
                    {copiedKeyId === 'new-key' ? Icons.check : Icons.copy}
                  </button>
                </div>
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="mt-3 text-xs underline"
                  style={{ color: 'var(--on-tertiary-container)' }}
                >
                  我已保存，关闭此提示
                </button>
              </div>
            )}

            {/* Create Key Form */}
            {showCreateForm && (
              <div
                className="p-4 rounded-xl mb-4"
                style={{ backgroundColor: 'var(--surface-container-highest)' }}
              >
                <h3
                  className="text-sm font-medium mb-4"
                  style={{ color: 'var(--on-surface)' }}
                >
                  新建 API 密钥
                </h3>
                <div className="space-y-4">
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: 'var(--on-surface-variant)' }}
                    >
                      名称 *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="例如：生产环境密钥"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--surface-container)',
                        border: '1px solid var(--outline-variant)',
                        color: 'var(--on-surface)',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      className="block text-xs mb-1"
                      style={{ color: 'var(--on-surface-variant)' }}
                    >
                      描述（可选）
                    </label>
                    <input
                      type="text"
                      value={newKeyDescription}
                      onChange={(e) => setNewKeyDescription(e.target.value)}
                      placeholder="用途说明"
                      className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        backgroundColor: 'var(--surface-container)',
                        border: '1px solid var(--outline-variant)',
                        color: 'var(--on-surface)',
                      }}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label
                        className="block text-xs mb-1"
                        style={{ color: 'var(--on-surface-variant)' }}
                      >
                        限流（次/分钟）
                      </label>
                      <input
                        type="number"
                        value={newKeyRateLimit}
                        onChange={(e) => setNewKeyRateLimit(Number(e.target.value))}
                        min={1}
                        max={10000}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--surface-container)',
                          border: '1px solid var(--outline-variant)',
                          color: 'var(--on-surface)',
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        className="block text-xs mb-1"
                        style={{ color: 'var(--on-surface-variant)' }}
                      >
                        过期天数（可选）
                      </label>
                      <input
                        type="number"
                        value={newKeyExpiresInDays || ''}
                        onChange={(e) =>
                          setNewKeyExpiresInDays(
                            e.target.value ? Number(e.target.value) : undefined
                          )
                        }
                        placeholder="永不过期"
                        min={1}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                        style={{
                          backgroundColor: 'var(--surface-container)',
                          border: '1px solid var(--outline-variant)',
                          color: 'var(--on-surface)',
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 px-4 py-2 text-sm rounded-lg"
                    style={{
                      backgroundColor: 'var(--surface-container)',
                      color: 'var(--on-surface-variant)',
                    }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateKey}
                    disabled={!newKeyName.trim() || creatingKey}
                    className="flex-1 px-4 py-2 text-sm rounded-lg disabled:opacity-50"
                    style={{
                      backgroundColor: 'var(--primary)',
                      color: 'var(--on-primary)',
                    }}
                  >
                    {creatingKey ? '创建中...' : '创建'}
                  </button>
                </div>
              </div>
            )}

            {/* Loading state */}
            {loadingKeys ? (
              <div className="py-8 text-center">
                <div
                  className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-3"
                  style={{ color: 'var(--primary)' }}
                />
                <p className="text-sm" style={{ color: 'var(--on-surface-variant)' }}>
                  加载密钥...
                </p>
              </div>
            ) : apiKeys.length === 0 && !showCreateForm ? (
              /* Empty state */
              <div
                className="py-8 text-center"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'var(--surface-container)' }}
                >
                  {Icons.key}
                </div>
                <p className="text-sm">暂无 API 密钥</p>
                <p className="text-xs mt-1 mb-4">创建密钥以允许外部应用调用此流程</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm mx-auto"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--on-primary)',
                  }}
                >
                  {Icons.plus}
                  创建第一个密钥
                </button>
              </div>
            ) : !showCreateForm && apiKeys.length > 0 ? (
              /* Keys list */
              <div className="space-y-3">
                {apiKeys.map((key) => (
                  <div
                    key={key.id}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: 'var(--surface-container-highest)' }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-medium"
                            style={{ color: 'var(--on-surface)' }}
                          >
                            {key.name}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: key.is_active
                                ? 'var(--tertiary-container)'
                                : 'var(--error-container)',
                              color: key.is_active
                                ? 'var(--on-tertiary-container)'
                                : 'var(--on-error-container)',
                            }}
                          >
                            {key.is_active ? '有效' : '已禁用'}
                          </span>
                        </div>
                        <div
                          className="flex items-center gap-2 mt-1"
                          style={{ color: 'var(--on-surface-variant)' }}
                        >
                          <code className="text-xs font-mono">
                            {key.key_prefix}••••••••••••••••
                          </code>
                          <span className="text-xs opacity-60" title="完整密钥只在创建时显示一次">
                            (已隐藏)
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-2 rounded-lg transition-all hover:opacity-80"
                        style={{
                          backgroundColor: 'var(--error-container)',
                          color: 'var(--on-error-container)',
                        }}
                        title="删除密钥"
                      >
                        {Icons.trash}
                      </button>
                    </div>

                    <div
                      className="flex items-center gap-4 text-xs mt-3"
                      style={{ color: 'var(--on-surface-variant)' }}
                    >
                      <span>调用次数: {key.usage_count}</span>
                      <span>限流: {key.rate_limit}/min</span>
                      {key.last_used_at && (
                        <span>最后使用: {formatDate(key.last_used_at)}</span>
                      )}
                      {key.expires_at && (
                        <span>过期时间: {formatDate(key.expires_at)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Footer hint */}
            <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
              <p
                className="text-xs"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                API 调用地址: {getExternalApiUrl(selectedFlowForKeys.id)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog - API 调用示例 */}
      {showHelpDialog && helpFlowId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowHelpDialog(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl p-6 shadow-2xl animate-md-fade-in max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--surface-container-high)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: 'var(--primary-container)' }}
                >
                  <span style={{ color: 'var(--on-primary-container)' }}>{Icons.code}</span>
                </div>
                <div>
                  <h2
                    className="text-xl font-medium"
                    style={{ color: 'var(--on-surface)' }}
                  >
                    API 调用文档
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--on-surface-variant)' }}
                  >
                    如何调用已发布的流程
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelpDialog(false)}
                className="p-2 rounded-xl"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                {Icons.unpublish}
              </button>
            </div>

            {/* API Endpoint */}
            <div className="mb-6">
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--on-surface)' }}
              >
                API 地址
              </h3>
              <div
                className="flex items-center gap-2 p-3 rounded-xl"
                style={{ backgroundColor: 'var(--surface-container-highest)' }}
              >
                <code
                  className="text-sm font-mono flex-1 break-all"
                  style={{ color: 'var(--primary)' }}
                >
                  POST {getExternalApiUrl(helpFlowId)}
                </code>
                <button
                  onClick={() => copyToClipboard(getExternalApiUrl(helpFlowId), 'help-url')}
                  className="p-2 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'var(--on-primary)',
                  }}
                >
                  {copiedKeyId === 'help-url' ? Icons.check : Icons.copy}
                </button>
              </div>
            </div>

            {/* Request Headers */}
            <div className="mb-6">
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--on-surface)' }}
              >
                请求头
              </h3>
              <div
                className="p-4 rounded-xl font-mono text-sm"
                style={{ backgroundColor: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
              >
                <div className="flex">
                  <span style={{ color: 'var(--tertiary)' }}>Content-Type:</span>
                  <span className="ml-2">application/json</span>
                </div>
                <div className="flex mt-1">
                  <span style={{ color: 'var(--tertiary)' }}>Authorization:</span>
                  <span className="ml-2">Bearer {'<your-api-key>'}</span>
                </div>
              </div>
            </div>

            {/* Request Body */}
            <div className="mb-6">
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--on-surface)' }}
              >
                请求体
              </h3>
              <div
                className="p-4 rounded-xl font-mono text-sm overflow-x-auto"
                style={{ backgroundColor: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
              >
                <pre style={{ margin: 0 }}>{`{
  "inputs": {
    "param1": "value1",
    "param2": "value2"
  },
  "wait": true,
  "timeout": 30
}`}</pre>
              </div>
              <div
                className="mt-3 p-3 rounded-lg text-xs"
                style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)' }}
              >
                <p className="font-medium mb-2">参数说明：</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li><code>inputs</code> - 流程输入参数，与开始节点定义的参数对应</li>
                  <li><code>wait</code> - 是否等待执行完成（默认 false 异步执行，设为 true 同步返回结果）</li>
                  <li><code>timeout</code> - 等待超时秒数，最大 300（仅 wait=true 时有效）</li>
                </ul>
              </div>
            </div>

            {/* cURL Example */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3
                  className="text-sm font-medium"
                  style={{ color: 'var(--on-surface)' }}
                >
                  cURL 示例
                </h3>
                <button
                  onClick={() => {
                    const curlCmd = `curl -X POST '${getExternalApiUrl(helpFlowId)}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer <your-api-key>' \\
  -d '{
    "inputs": {
      "param1": "value1"
    },
    "wait": true
  }'`
                    copyToClipboard(curlCmd, 'curl')
                  }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                  }}
                >
                  {copiedKeyId === 'curl' ? '已复制' : '复制'}
                </button>
              </div>
              <div
                className="p-4 rounded-xl font-mono text-xs overflow-x-auto"
                style={{ backgroundColor: '#1e1e2e', color: '#cdd6f4' }}
              >
                <pre style={{ margin: 0 }}>{`curl -X POST '${getExternalApiUrl(helpFlowId)}' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer <your-api-key>' \\
  -d '{
    "inputs": {
      "param1": "value1"
    },
    "wait": true
  }'`}</pre>
              </div>
            </div>

            {/* JavaScript Example */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3
                  className="text-sm font-medium"
                  style={{ color: 'var(--on-surface)' }}
                >
                  JavaScript 示例
                </h3>
                <button
                  onClick={() => {
                    const jsCode = `const response = await fetch('${getExternalApiUrl(helpFlowId)}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-api-key>'
  },
  body: JSON.stringify({
    inputs: {
      param1: 'value1'
    },
    wait: true
  })
});

const result = await response.json();
console.log(result);`
                    copyToClipboard(jsCode, 'js')
                  }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                  }}
                >
                  {copiedKeyId === 'js' ? '已复制' : '复制'}
                </button>
              </div>
              <div
                className="p-4 rounded-xl font-mono text-xs overflow-x-auto"
                style={{ backgroundColor: '#1e1e2e', color: '#cdd6f4' }}
              >
                <pre style={{ margin: 0 }}>{`const response = await fetch('${getExternalApiUrl(helpFlowId)}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-api-key>'
  },
  body: JSON.stringify({
    inputs: {
      param1: 'value1'
    },
    wait: true
  })
});

const result = await response.json();
console.log(result);`}</pre>
              </div>
            </div>

            {/* Python Example */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3
                  className="text-sm font-medium"
                  style={{ color: 'var(--on-surface)' }}
                >
                  Python 示例
                </h3>
                <button
                  onClick={() => {
                    const pyCode = `import requests

url = '${getExternalApiUrl(helpFlowId)}'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-api-key>'
}
data = {
    'inputs': {
        'param1': 'value1'
    },
    'wait': True
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result)`
                    copyToClipboard(pyCode, 'python')
                  }}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: 'var(--primary-container)',
                    color: 'var(--on-primary-container)',
                  }}
                >
                  {copiedKeyId === 'python' ? '已复制' : '复制'}
                </button>
              </div>
              <div
                className="p-4 rounded-xl font-mono text-xs overflow-x-auto"
                style={{ backgroundColor: '#1e1e2e', color: '#cdd6f4' }}
              >
                <pre style={{ margin: 0 }}>{`import requests

url = '${getExternalApiUrl(helpFlowId)}'
headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <your-api-key>'
}
data = {
    'inputs': {
        'param1': 'value1'
    },
    'wait': True
}

response = requests.post(url, json=data, headers=headers)
result = response.json()
print(result)`}</pre>
              </div>
            </div>

            {/* Response */}
            <div>
              <h3
                className="text-sm font-medium mb-2"
                style={{ color: 'var(--on-surface)' }}
              >
                响应示例
              </h3>
              <div
                className="p-4 rounded-xl font-mono text-xs overflow-x-auto"
                style={{ backgroundColor: 'var(--surface-container-highest)', color: 'var(--on-surface)' }}
              >
                <pre style={{ margin: 0 }}>{`{
  "execution_id": "uuid-xxx",
  "flow_id": "${helpFlowId}",
  "status": "completed",
  "result": {
    "success": true,
    "outputs": {
      "output1": "result value"
    },
    "duration_ms": 1234
  }
}`}</pre>
              </div>
            </div>

            {/* Footer */}
            <div
              className="mt-6 pt-4 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--outline-variant)' }}
            >
              <p
                className="text-xs"
                style={{ color: 'var(--on-surface-variant)' }}
              >
                提示: 请在「API 密钥」中创建密钥后替换示例中的 {'<your-api-key>'}
              </p>
              <button
                onClick={() => setShowHelpDialog(false)}
                className="px-4 py-2 text-sm rounded-xl"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
