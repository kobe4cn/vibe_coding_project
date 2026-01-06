/**
 * 工具管理页面
 * 管理 API 服务、数据源和 UDF 配置
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

// API 基础地址
const API_BASE = 'http://localhost:3001/api'
const TENANT_ID = 'default'

// 类型定义
interface ApiService {
  name: string
  display_name: string
  description?: string
  base_url: string
  auth_type: string
  timeout_ms: number
  enabled: boolean
}

interface Datasource {
  name: string
  display_name: string
  description?: string
  db_type: string
  connection_string?: string
  schema?: string
  table?: string
  pool_size: number
  timeout_ms: number
  read_only: boolean
  enabled: boolean
}

interface Udf {
  name: string
  display_name: string
  description?: string
  udf_type: string
  handler: string
  is_builtin: boolean
  enabled: boolean
}

type TabType = 'services' | 'datasources' | 'udfs'
type DialogType = 'none' | 'create-service' | 'edit-service' | 'create-datasource' | 'edit-datasource' | 'create-udf' | 'edit-udf'

// 图标组件
function IconPlus() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-6-6h12" />
    </svg>
  )
}

function IconArrowLeft() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function IconClose() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconApi() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function IconDatabase() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
    </svg>
  )
}

function IconFunction() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}

function IconEdit() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}

function IconTrash() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

// 通用输入框组件
function FormInput({ label, value, onChange, placeholder, required, type = 'text' }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
        {label} {required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--surface-container)',
          border: '1px solid var(--outline-variant)',
          color: 'var(--on-surface)'
        }}
      />
    </div>
  )
}

function FormSelect({ label, value, onChange, options, required }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
        {label} {required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          backgroundColor: 'var(--surface-container)',
          border: '1px solid var(--outline-variant)',
          color: 'var(--on-surface)'
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  )
}

function FormCheckbox({ label, checked, onChange }: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 mb-4 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-4 h-4 rounded"
      />
      <span className="text-sm" style={{ color: 'var(--on-surface)' }}>{label}</span>
    </label>
  )
}

// API 服务创建/编辑对话框
function ApiServiceDialog({ open, service, onClose, onSave }: {
  open: boolean
  service: ApiService | null
  onClose: () => void
  onSave: (data: Partial<ApiService>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [authType, setAuthType] = useState('none')
  const [timeoutMs, setTimeoutMs] = useState('30000')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const isEdit = !!service

  useEffect(() => {
    if (service) {
      setName(service.name)
      setDisplayName(service.display_name)
      setDescription(service.description || '')
      setBaseUrl(service.base_url)
      setAuthType(service.auth_type)
      setTimeoutMs(String(service.timeout_ms))
      setEnabled(service.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setBaseUrl('')
      setAuthType('none')
      setTimeoutMs('30000')
      setEnabled(true)
    }
  }, [service, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !baseUrl.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        base_url: baseUrl.trim(),
        auth_type: authType,
        timeout_ms: parseInt(timeoutMs) || 30000,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-xl"
        style={{ backgroundColor: 'var(--surface-container-high)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>
            {isEdit ? '编辑 API 服务' : '添加 API 服务'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}>
            <IconClose />
          </button>
        </div>

        <FormInput label="服务标识" value={name} onChange={setName} placeholder="例如: crm-service" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: CRM 客户服务" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormInput label="基础 URL" value={baseUrl} onChange={setBaseUrl} placeholder="https://api.example.com/v1" required />
        <FormSelect
          label="认证类型"
          value={authType}
          onChange={setAuthType}
          options={[
            { value: 'none', label: '无认证' },
            { value: 'apikey', label: 'API Key' },
            { value: 'basic', label: 'Basic Auth' },
            { value: 'bearer', label: 'Bearer Token' },
            { value: 'oauth2', label: 'OAuth2' },
          ]}
        />
        <FormInput label="超时时间 (ms)" value={timeoutMs} onChange={setTimeoutMs} type="number" />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'var(--surface-container)',
              color: 'var(--on-surface-variant)'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !displayName.trim() || !baseUrl.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)'
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 数据源创建/编辑对话框
function DatasourceDialog({ open, datasource, onClose, onSave }: {
  open: boolean
  datasource: Datasource | null
  onClose: () => void
  onSave: (data: Partial<Datasource>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [dbType, setDbType] = useState('mysql')
  const [connectionString, setConnectionString] = useState('')
  const [schema, setSchema] = useState('')
  const [table, setTable] = useState('')
  const [poolSize, setPoolSize] = useState('10')
  const [timeoutMs, setTimeoutMs] = useState('5000')
  const [readOnly, setReadOnly] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const isEdit = !!datasource

  useEffect(() => {
    if (datasource) {
      setName(datasource.name)
      setDisplayName(datasource.display_name)
      setDescription(datasource.description || '')
      setDbType(datasource.db_type.toLowerCase())
      setConnectionString(datasource.connection_string || '')
      setSchema(datasource.schema || '')
      setTable(datasource.table || '')
      setPoolSize(String(datasource.pool_size))
      setTimeoutMs(String(datasource.timeout_ms))
      setReadOnly(datasource.read_only)
      setEnabled(datasource.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setDbType('mysql')
      setConnectionString('')
      setSchema('')
      setTable('')
      setPoolSize('10')
      setTimeoutMs('5000')
      setReadOnly(false)
      setEnabled(true)
    }
  }, [datasource, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !connectionString.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        db_type: dbType,
        connection_string: connectionString.trim(),
        schema: schema.trim() || undefined,
        table: table.trim() || undefined,
        pool_size: parseInt(poolSize) || 10,
        timeout_ms: parseInt(timeoutMs) || 5000,
        read_only: readOnly,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--surface-container-high)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>
            {isEdit ? '编辑数据源' : '添加数据源'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}>
            <IconClose />
          </button>
        </div>

        <FormInput label="数据源标识" value={name} onChange={setName} placeholder="例如: ec.mysql.order" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 订单数据库" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect
          label="数据库类型"
          value={dbType}
          onChange={setDbType}
          required
          options={[
            { value: 'mysql', label: 'MySQL' },
            { value: 'postgresql', label: 'PostgreSQL' },
            { value: 'sqlite', label: 'SQLite' },
            { value: 'mongodb', label: 'MongoDB' },
            { value: 'redis', label: 'Redis' },
            { value: 'elasticsearch', label: 'Elasticsearch' },
          ]}
        />
        <FormInput label="连接字符串" value={connectionString} onChange={setConnectionString} placeholder="mysql://user:pass@host:3306/db" required />
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="Schema" value={schema} onChange={setSchema} placeholder="可选" />
          <FormInput label="默认表" value={table} onChange={setTable} placeholder="可选" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="连接池大小" value={poolSize} onChange={setPoolSize} type="number" />
          <FormInput label="超时时间 (ms)" value={timeoutMs} onChange={setTimeoutMs} type="number" />
        </div>
        <FormCheckbox label="只读" checked={readOnly} onChange={setReadOnly} />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium"
            style={{
              backgroundColor: 'var(--surface-container)',
              color: 'var(--on-surface-variant)'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim() || !displayName.trim() || !connectionString.trim()}
            className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)'
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// API 服务卡片
function ApiServiceCard({ service, onEdit, onDelete }: {
  service: ApiService
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--surface-container)',
        borderColor: 'var(--outline-variant)'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-container)' }}>
            <IconApi />
          </div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>
              {service.display_name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
              {service.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}>
            <IconEdit />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}>
            <IconTrash />
          </button>
        </div>
      </div>
      <p className="text-sm mb-2 truncate" style={{ color: 'var(--on-surface-variant)' }}>
        {service.base_url}
      </p>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
          {service.auth_type}
        </span>
        <span
          className={`px-2 py-0.5 rounded ${service.enabled ? '' : 'opacity-50'}`}
          style={{
            backgroundColor: service.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)',
            color: service.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)'
          }}
        >
          {service.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// 数据源卡片
function DatasourceCard({ datasource, onEdit, onDelete }: {
  datasource: Datasource
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--surface-container)',
        borderColor: 'var(--outline-variant)'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--secondary-container)' }}>
            <IconDatabase />
          </div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>
              {datasource.display_name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
              {datasource.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}>
            <IconEdit />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}>
            <IconTrash />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs mb-2">
        <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
          {datasource.db_type}
        </span>
        {datasource.table && (
          <span style={{ color: 'var(--on-surface-variant)' }}>表: {datasource.table}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        {datasource.read_only && (
          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
            只读
          </span>
        )}
        <span
          className={`px-2 py-0.5 rounded ${datasource.enabled ? '' : 'opacity-50'}`}
          style={{
            backgroundColor: datasource.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)',
            color: datasource.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)'
          }}
        >
          {datasource.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// UDF 卡片
function UdfCard({ udf, onDelete }: {
  udf: Udf
  onDelete: () => void
}) {
  return (
    <div
      className="p-4 rounded-lg border"
      style={{
        backgroundColor: 'var(--surface-container)',
        borderColor: 'var(--outline-variant)'
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--tertiary-container)' }}>
            <IconFunction />
          </div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>
              {udf.display_name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>
              {udf.name}
            </p>
          </div>
        </div>
        {!udf.is_builtin && (
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}>
            <IconTrash />
          </button>
        )}
      </div>
      {udf.description && (
        <p className="text-sm mb-2" style={{ color: 'var(--on-surface-variant)' }}>
          {udf.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
          {udf.udf_type}
        </span>
        {udf.is_builtin && (
          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
            内置
          </span>
        )}
      </div>
    </div>
  )
}

// 主页面
export function ToolsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('services')
  const [services, setServices] = useState<ApiService[]>([])
  const [datasources, setDatasources] = useState<Datasource[]>([])
  const [udfs, setUdfs] = useState<Udf[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 对话框状态
  const [dialogType, setDialogType] = useState<DialogType>('none')
  const [editingService, setEditingService] = useState<ApiService | null>(null)
  const [editingDatasource, setEditingDatasource] = useState<Datasource | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [servicesRes, datasourcesRes, udfsRes] = await Promise.all([
        fetch(`${API_BASE}/tools/services?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/datasources?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/udfs?tenant_id=${TENANT_ID}`)
      ])

      if (servicesRes.ok) {
        const data = await servicesRes.json()
        setServices(data.services || [])
      }
      if (datasourcesRes.ok) {
        const data = await datasourcesRes.json()
        setDatasources(data.datasources || [])
      }
      if (udfsRes.ok) {
        const data = await udfsRes.json()
        setUdfs(data.udfs || [])
      }
    } catch (e) {
      setError('无法连接到服务器，请确保后台服务正在运行')
      console.error('Failed to load tools:', e)
    }
    setLoading(false)
  }

  // API 服务操作
  async function handleSaveService(data: Partial<ApiService>) {
    const isEdit = !!editingService
    const url = isEdit
      ? `${API_BASE}/tools/services/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/services?tenant_id=${TENANT_ID}`

    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteService(name: string) {
    if (!confirm(`确定要删除 API 服务 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/services/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  // 数据源操作
  async function handleSaveDatasource(data: Partial<Datasource>) {
    const isEdit = !!editingDatasource
    const url = isEdit
      ? `${API_BASE}/tools/datasources/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/datasources?tenant_id=${TENANT_ID}`

    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteDatasource(name: string) {
    if (!confirm(`确定要删除数据源 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/datasources/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  async function handleDeleteUdf(name: string) {
    if (!confirm(`确定要删除 UDF "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/udfs/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  function handleAdd() {
    if (activeTab === 'services') {
      setEditingService(null)
      setDialogType('create-service')
    } else if (activeTab === 'datasources') {
      setEditingDatasource(null)
      setDialogType('create-datasource')
    } else {
      alert('UDF 主要使用内置函数，暂不支持自定义添加')
    }
  }

  const tabs = [
    { id: 'services' as TabType, label: 'API 服务', icon: <IconApi />, count: services.length },
    { id: 'datasources' as TabType, label: '数据源', icon: <IconDatabase />, count: datasources.length },
    { id: 'udfs' as TabType, label: 'UDF', icon: <IconFunction />, count: udfs.length },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--surface-dim)' }}>
      {/* 顶部导航 */}
      <header
        className="h-14 border-b flex items-center justify-between px-4"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 rounded-lg hover:opacity-80" style={{ color: 'var(--on-surface-variant)' }}>
            <IconArrowLeft />
          </Link>
          <h1 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>
            工具管理
          </h1>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}
        >
          <IconPlus />
          <span>添加</span>
        </button>
      </header>

      {/* 标签页 */}
      <div className="border-b px-4" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--outline-variant)' }}>
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 transition-colors`}
              style={{
                borderColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--on-surface-variant)'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="px-2 py-0.5 text-xs rounded-full" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 内容区域 */}
      <main className="p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : error ? (
          <div className="p-6 rounded-lg text-center" style={{ backgroundColor: 'var(--error-container)', color: 'var(--on-error-container)' }}>
            <p className="mb-4">{error}</p>
            <button onClick={loadData} className="px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--error)', color: 'var(--on-error)' }}>
              重试
            </button>
          </div>
        ) : (
          <>
            {activeTab === 'services' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconApi /></div>
                    <p className="mt-2">暂无 API 服务配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个 API 服务</p>
                  </div>
                ) : (
                  services.map(service => (
                    <ApiServiceCard
                      key={service.name}
                      service={service}
                      onEdit={() => { setEditingService(service); setDialogType('edit-service') }}
                      onDelete={() => handleDeleteService(service.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'datasources' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {datasources.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconDatabase /></div>
                    <p className="mt-2">暂无数据源配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个数据源</p>
                  </div>
                ) : (
                  datasources.map(ds => (
                    <DatasourceCard
                      key={ds.name}
                      datasource={ds}
                      onEdit={() => { setEditingDatasource(ds); setDialogType('edit-datasource') }}
                      onDelete={() => handleDeleteDatasource(ds.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'udfs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {udfs.map(udf => (
                  <UdfCard
                    key={udf.name}
                    udf={udf}
                    onDelete={() => handleDeleteUdf(udf.name)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* 对话框 */}
      <ApiServiceDialog
        open={dialogType === 'create-service' || dialogType === 'edit-service'}
        service={editingService}
        onClose={() => { setDialogType('none'); setEditingService(null) }}
        onSave={handleSaveService}
      />
      <DatasourceDialog
        open={dialogType === 'create-datasource' || dialogType === 'edit-datasource'}
        datasource={editingDatasource}
        onClose={() => { setDialogType('none'); setEditingDatasource(null) }}
        onSave={handleSaveDatasource}
      />
    </div>
  )
}
