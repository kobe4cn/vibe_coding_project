/**
 * Publish Dialog Component
 * 流程发布和 API Key 管理对话框
 */

import { useState, useEffect, useCallback } from 'react'

// Icons
const Icons = {
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  publish: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v10M12 12l4-4M12 12l-4-4"/>
      <path d="M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17"/>
    </svg>
  ),
  unpublish: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12v10M12 12l4 4M12 12l-4 4"/>
      <path d="M2 7l.621-2.485A2 2 0 0 1 4.561 3h14.878a2 2 0 0 1 1.94 1.515L22 7"/>
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  trash: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  ),
  copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  check: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
}

interface ApiKey {
  id: string
  name: string
  description?: string
  key_prefix: string
  rate_limit: number
  is_active: boolean
  created_at: string
  expires_at?: string
}

interface NewlyCreatedKey {
  id: string
  name: string
  key: string
  key_prefix: string
}

interface PublishDialogProps {
  isOpen: boolean
  onClose: () => void
  flowId: string
  flowName: string
  tenantId?: string
}

export function PublishDialog({
  isOpen,
  onClose,
  flowId,
  flowName,
  tenantId = 'default',
}: PublishDialogProps) {
  const [isPublished, setIsPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<NewlyCreatedKey | null>(null)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  // Create key form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyDescription, setNewKeyDescription] = useState('')
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(100)
  const [newKeyExpiresInDays, setNewKeyExpiresInDays] = useState<number | undefined>(undefined)
  const [creatingKey, setCreatingKey] = useState(false)

  // Fetch publish status
  const fetchPublishStatus = useCallback(async () => {
    if (!flowId) return

    try {
      const response = await fetch(
        `/api/flows/${flowId}/publish-status?tenant_id=${tenantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setIsPublished(data.published)
        setPublishedAt(data.published_at)
        setPublishedVersionId(data.published_version_id)
      }
    } catch (err) {
      console.error('Failed to fetch publish status:', err)
    }
  }, [flowId, tenantId])

  // Fetch API keys
  const fetchApiKeys = useCallback(async () => {
    if (!flowId || !isPublished) return

    setLoadingKeys(true)
    try {
      const response = await fetch(
        `/api/flows/${flowId}/api-keys?tenant_id=${tenantId}`
      )
      if (response.ok) {
        const data = await response.json()
        setApiKeys(data.api_keys || [])
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err)
    } finally {
      setLoadingKeys(false)
    }
  }, [flowId, tenantId, isPublished])

  useEffect(() => {
    if (isOpen) {
      fetchPublishStatus()
    }
  }, [isOpen, fetchPublishStatus])

  useEffect(() => {
    if (isOpen && isPublished) {
      fetchApiKeys()
    }
  }, [isOpen, isPublished, fetchApiKeys])

  // Publish flow
  const handlePublish = async () => {
    setLoading(true)
    setError(null)

    try {
      // First get the latest version
      const versionsRes = await fetch(
        `/api/flows/${flowId}/versions?tenant_id=${tenantId}`
      )
      if (!versionsRes.ok) {
        throw new Error('无法获取版本列表')
      }

      const versionsData = await versionsRes.json()
      const versions = versionsData.versions || []

      if (versions.length === 0) {
        throw new Error('请先保存流程版本')
      }

      // Use the latest version
      const latestVersion = versions[0]

      const response = await fetch(`/api/flows/${flowId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_id: latestVersion.id,
          tenant_id: tenantId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '发布失败')
      }

      const data = await response.json()
      setIsPublished(true)
      setPublishedAt(data.published_at)
      setPublishedVersionId(data.published_version_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败')
    } finally {
      setLoading(false)
    }
  }

  // Unpublish flow
  const handleUnpublish = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/flows/${flowId}/unpublish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '取消发布失败')
      }

      setIsPublished(false)
      setPublishedAt(null)
      setPublishedVersionId(null)
      setApiKeys([])
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消发布失败')
    } finally {
      setLoading(false)
    }
  }

  // Create API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return

    setCreatingKey(true)
    setError(null)

    try {
      const response = await fetch(`/api/flows/${flowId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          description: newKeyDescription || undefined,
          rate_limit: newKeyRateLimit,
          expires_in_days: newKeyExpiresInDays,
          tenant_id: tenantId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '创建 API Key 失败')
      }

      const data = await response.json()

      // Show the newly created key
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
      fetchApiKeys()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建 API Key 失败')
    } finally {
      setCreatingKey(false)
    }
  }

  // Delete API key
  const handleDeleteKey = async (keyId: string) => {
    if (!confirm('确定要删除此 API Key 吗？此操作不可恢复。')) return

    try {
      const response = await fetch(
        `/api/flows/${flowId}/api-keys/${keyId}?tenant_id=${tenantId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '删除失败')
      }

      setApiKeys(keys => keys.filter(k => k.id !== keyId))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
  }

  // Copy to clipboard
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKeyId(id)
      setTimeout(() => setCopiedKeyId(null), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedKeyId(id)
      setTimeout(() => setCopiedKeyId(null), 2000)
    }
  }

  // Get API endpoint URL
  const getApiEndpoint = () => {
    const baseUrl = window.location.origin
    return `${baseUrl}/api/v1/flows/${flowId}/execute`
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(2px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#1e1e2e',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid #313244',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #313244',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#89b4fa' }}>{Icons.globe}</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#cdd6f4' }}>
                发布管理
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6c7086' }}>
                {flowName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6c7086',
              padding: '4px',
              display: 'flex',
            }}
          >
            {Icons.close}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(243, 139, 168, 0.1)',
              border: '1px solid rgba(243, 139, 168, 0.3)',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#f38ba8',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Publish Status */}
          <div style={{
            padding: '20px',
            backgroundColor: '#181825',
            borderRadius: '8px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isPublished ? '#a6e3a1' : '#6c7086',
                  }} />
                  <span style={{ color: '#cdd6f4', fontWeight: 500 }}>
                    {isPublished ? '已发布' : '未发布'}
                  </span>
                </div>
                {isPublished && publishedAt && (
                  <p style={{ margin: 0, fontSize: '12px', color: '#6c7086' }}>
                    发布于 {new Date(publishedAt).toLocaleString()}
                  </p>
                )}
              </div>

              <button
                onClick={isPublished ? handleUnpublish : handlePublish}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  backgroundColor: isPublished ? '#45475a' : '#89b4fa',
                  color: isPublished ? '#cdd6f4' : '#1e1e2e',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {isPublished ? Icons.unpublish : Icons.publish}
                {loading ? '处理中...' : isPublished ? '取消发布' : '发布流程'}
              </button>
            </div>
          </div>

          {/* API Endpoint */}
          {isPublished && (
            <div style={{
              padding: '16px',
              backgroundColor: '#181825',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ fontSize: '12px', color: '#6c7086', marginBottom: '8px' }}>
                API 端点
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: '#11111b',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#a6e3a1',
              }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {getApiEndpoint()}
                </span>
                <button
                  onClick={() => handleCopy(getApiEndpoint(), 'endpoint')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedKeyId === 'endpoint' ? '#a6e3a1' : '#6c7086',
                    padding: '4px',
                    display: 'flex',
                  }}
                  title="复制"
                >
                  {copiedKeyId === 'endpoint' ? Icons.check : Icons.copy}
                </button>
              </div>
            </div>
          )}

          {/* Newly Created Key Alert */}
          {newlyCreatedKey && (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(166, 227, 161, 0.1)',
              border: '1px solid rgba(166, 227, 161, 0.3)',
              borderRadius: '8px',
              marginBottom: '20px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ color: '#a6e3a1' }}>{Icons.key}</span>
                <span style={{ color: '#a6e3a1', fontWeight: 500 }}>API Key 创建成功</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#cdd6f4' }}>
                请立即复制并安全保存此 Key，关闭后将无法再次查看完整内容。
              </p>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                backgroundColor: '#11111b',
                borderRadius: '6px',
                fontFamily: 'monospace',
                fontSize: '13px',
                color: '#f9e2af',
              }}>
                <span style={{ flex: 1, wordBreak: 'break-all' }}>
                  {newlyCreatedKey.key}
                </span>
                <button
                  onClick={() => handleCopy(newlyCreatedKey.key, 'new-key')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: copiedKeyId === 'new-key' ? '#a6e3a1' : '#6c7086',
                    padding: '4px',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                  title="复制"
                >
                  {copiedKeyId === 'new-key' ? Icons.check : Icons.copy}
                </button>
              </div>
              <button
                onClick={() => setNewlyCreatedKey(null)}
                style={{
                  marginTop: '12px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  backgroundColor: '#45475a',
                  color: '#cdd6f4',
                }}
              >
                我已保存，关闭此提示
              </button>
            </div>
          )}

          {/* API Keys Section */}
          {isPublished && (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#cdd6f4' }}>
                  API Keys
                </h3>
                <button
                  onClick={() => setShowCreateForm(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    backgroundColor: '#45475a',
                    color: '#cdd6f4',
                  }}
                >
                  {Icons.plus}
                  新建 Key
                </button>
              </div>

              {/* Create Key Form */}
              {showCreateForm && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#181825',
                  borderRadius: '8px',
                  marginBottom: '12px',
                }}>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6c7086', marginBottom: '4px' }}>
                      名称 *
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="例如：生产环境"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #313244',
                        backgroundColor: '#11111b',
                        color: '#cdd6f4',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: '#6c7086', marginBottom: '4px' }}>
                      描述
                    </label>
                    <input
                      type="text"
                      value={newKeyDescription}
                      onChange={e => setNewKeyDescription(e.target.value)}
                      placeholder="可选"
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #313244',
                        backgroundColor: '#11111b',
                        color: '#cdd6f4',
                        fontSize: '14px',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6c7086', marginBottom: '4px' }}>
                        速率限制 (次/分钟)
                      </label>
                      <input
                        type="number"
                        value={newKeyRateLimit}
                        onChange={e => setNewKeyRateLimit(parseInt(e.target.value) || 100)}
                        min={1}
                        max={10000}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #313244',
                          backgroundColor: '#11111b',
                          color: '#cdd6f4',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '12px', color: '#6c7086', marginBottom: '4px' }}>
                        过期天数
                      </label>
                      <input
                        type="number"
                        value={newKeyExpiresInDays || ''}
                        onChange={e => setNewKeyExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
                        placeholder="永不过期"
                        min={1}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #313244',
                          backgroundColor: '#11111b',
                          color: '#cdd6f4',
                          fontSize: '14px',
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowCreateForm(false)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        backgroundColor: '#45475a',
                        color: '#cdd6f4',
                      }}
                    >
                      取消
                    </button>
                    <button
                      onClick={handleCreateKey}
                      disabled={!newKeyName.trim() || creatingKey}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: !newKeyName.trim() || creatingKey ? 'not-allowed' : 'pointer',
                        fontSize: '12px',
                        backgroundColor: '#89b4fa',
                        color: '#1e1e2e',
                        opacity: !newKeyName.trim() || creatingKey ? 0.5 : 1,
                      }}
                    >
                      {creatingKey ? '创建中...' : '创建'}
                    </button>
                  </div>
                </div>
              )}

              {/* Keys List */}
              {loadingKeys ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6c7086' }}>
                  加载中...
                </div>
              ) : apiKeys.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  backgroundColor: '#181825',
                  borderRadius: '8px',
                  color: '#6c7086',
                }}>
                  <div style={{ marginBottom: '8px' }}>{Icons.key}</div>
                  <p style={{ margin: 0, fontSize: '14px' }}>暂无 API Key</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px' }}>创建一个 Key 以允许外部系统调用此流程</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {apiKeys.map(key => (
                    <div
                      key={key.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: '#181825',
                        borderRadius: '8px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#cdd6f4', fontWeight: 500 }}>{key.name}</span>
                          {!key.is_active && (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(243, 139, 168, 0.2)',
                              color: '#f38ba8',
                              fontSize: '10px',
                            }}>
                              已禁用
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#6c7086' }}>
                            {key.key_prefix}
                          </span>
                          <span style={{ fontSize: '11px', color: '#6c7086' }}>
                            {key.rate_limit} 次/分
                          </span>
                          {key.expires_at && (
                            <span style={{ fontSize: '11px', color: '#6c7086' }}>
                              过期于 {new Date(key.expires_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6c7086',
                          padding: '4px',
                          display: 'flex',
                        }}
                        title="删除"
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
