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
  // 自定义 UDF 字段
  code?: string
  input_params?: UdfParam[]
  return_type?: string
}

interface UdfParam {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any'
  required: boolean
  default_value?: unknown
}

// OSS 对象存储配置
interface OssConfig {
  name: string
  display_name: string
  description?: string
  provider: 's3' | 'alioss' | 'minio' | 'azure' | 'gcs'
  bucket: string
  region?: string
  endpoint?: string
  access_key_id: string
  secret_access_key: string
  path_style: boolean
  enabled: boolean
}

// MQ 消息队列配置
interface MqConfig {
  name: string
  display_name: string
  description?: string
  broker: 'rabbitmq' | 'kafka' | 'rocketmq' | 'redis'
  connection_string: string
  default_queue?: string
  default_exchange?: string      // RabbitMQ 专用
  default_routing_key?: string   // RabbitMQ 专用
  serialization: 'json' | 'protobuf' | 'avro'
  enabled: boolean
}

// Mail 邮件配置
interface MailConfig {
  name: string
  display_name: string
  description?: string
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses' | 'aliyun'
  smtp_host?: string
  smtp_port?: number
  use_tls?: boolean
  username?: string
  password?: string
  api_key?: string
  from_address: string
  from_name?: string
  enabled: boolean
}

// SMS 短信配置
interface SmsConfig {
  name: string
  display_name: string
  description?: string
  provider: 'aliyun' | 'tencent' | 'twilio'
  api_key: string
  api_secret?: string
  sign_name?: string
  region?: string
  enabled: boolean
}

// Svc 微服务配置
interface SvcConfig {
  name: string
  display_name: string
  description?: string
  discovery_type: 'static' | 'consul' | 'k8s_dns'
  endpoints?: string[]
  consul_address?: string
  k8s_service_name?: string
  k8s_namespace?: string
  protocol: 'http' | 'grpc'
  load_balancer: 'round_robin' | 'random' | 'least_connections'
  timeout_ms: number
  enabled: boolean
}

type TabType = 'services' | 'datasources' | 'udfs' | 'oss' | 'mq' | 'mail' | 'sms' | 'svc'
type DialogType = 'none' | 'create-service' | 'edit-service' | 'create-datasource' | 'edit-datasource' | 'create-udf' | 'edit-udf' | 'create-oss' | 'edit-oss' | 'create-mq' | 'edit-mq' | 'create-mail' | 'edit-mail' | 'create-sms' | 'edit-sms' | 'create-svc' | 'edit-svc'

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

function IconCloud() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  )
}

function IconQueue() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  )
}

function IconMail() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
}

function IconSms() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

function IconService() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  )
}

function IconTest() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// 通用输入框组件
function FormInput({ label, value, onChange, placeholder, required, type = 'text', disabled }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  type?: string
  disabled?: boolean
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
        disabled={disabled}
        className={`w-full px-3 py-2 rounded-lg text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
  const [originalConnectionString, setOriginalConnectionString] = useState('') // 保存原始掩码值
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
      // 保存原始掩码值，用于判断用户是否修改
      const maskedStr = datasource.connection_string || ''
      setConnectionString(maskedStr)
      setOriginalConnectionString(maskedStr)
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
      setOriginalConnectionString('')
      setSchema('')
      setTable('')
      setPoolSize('10')
      setTimeoutMs('5000')
      setReadOnly(false)
      setEnabled(true)
    }
  }, [datasource, open])

  if (!open) return null

  // 检查连接字符串是否被修改（与原始掩码值不同且不包含掩码标记）
  const connectionStringModified = connectionString !== originalConnectionString && !connectionString.includes('***')

  const handleSave = async () => {
    // 新建时必须提供连接字符串，编辑时如果未修改则可选
    if (!name.trim() || !displayName.trim()) return
    if (!isEdit && !connectionString.trim()) return

    setSaving(true)
    try {
      const data: Partial<Datasource> = {
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        db_type: dbType,
        schema: schema.trim() || undefined,
        table: table.trim() || undefined,
        pool_size: parseInt(poolSize) || 10,
        timeout_ms: parseInt(timeoutMs) || 5000,
        read_only: readOnly,
        enabled
      }

      // 只有当连接字符串被修改时才发送（避免发送掩码值）
      if (!isEdit || connectionStringModified) {
        data.connection_string = connectionString.trim()
      }

      await onSave(data)
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
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
            连接字符串 {!isEdit && <span style={{ color: 'var(--error)' }}>*</span>}
          </label>
          <input
            type="text"
            value={connectionString}
            onChange={e => setConnectionString(e.target.value)}
            placeholder={isEdit ? '不修改请保留原值' : 'mysql://user:pass@host:3306/db'}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)'
            }}
          />
          {isEdit && connectionString.includes('***') && (
            <p className="text-xs mt-1" style={{ color: 'var(--on-surface-variant)' }}>
              用户名和密码已掩码。如需修改，请输入完整的连接字符串。
            </p>
          )}
        </div>
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
            disabled={saving || !name.trim() || !displayName.trim() || (!isEdit && !connectionString.trim())}
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
function UdfCard({ udf, onEdit, onDelete }: {
  udf: Udf
  onEdit?: () => void
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
          <div className="flex items-center gap-1">
            {onEdit && (
              <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}>
                <IconEdit />
              </button>
            )}
            <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}>
              <IconTrash />
            </button>
          </div>
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
        {udf.return_type && (
          <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>
            → {udf.return_type}
          </span>
        )}
      </div>
    </div>
  )
}

// UDF 编辑器对话框
function UdfEditorDialog({ open, udf, onClose, onSave }: {
  open: boolean
  udf: Udf | null
  onClose: () => void
  onSave: (data: Partial<Udf>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [udfType, setUdfType] = useState<'expression' | 'javascript'>('expression')
  const [code, setCode] = useState('')
  const [returnType, setReturnType] = useState('any')
  const [params, setParams] = useState<UdfParam[]>([])
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testInput, setTestInput] = useState('{}')
  const [testResult, setTestResult] = useState<string | null>(null)

  const isEdit = !!udf

  useEffect(() => {
    if (udf) {
      setName(udf.name)
      setDisplayName(udf.display_name)
      setDescription(udf.description || '')
      setUdfType((udf.udf_type as 'expression' | 'javascript') || 'expression')
      setCode(udf.code || '')
      setReturnType(udf.return_type || 'any')
      setParams(udf.input_params || [])
      setEnabled(udf.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setUdfType('expression')
      setCode('')
      setReturnType('any')
      setParams([])
      setEnabled(true)
    }
    setTestResult(null)
  }, [udf, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !code.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        udf_type: udfType,
        code: code.trim(),
        input_params: params,
        return_type: returnType,
        is_builtin: false,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${API_BASE}/tools/udfs/${name}/test?tenant_id=${TENANT_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: JSON.parse(testInput) })
      })
      const data = await res.json()
      if (res.ok) {
        setTestResult(JSON.stringify(data.result, null, 2))
      } else {
        setTestResult(`错误: ${data.error || '执行失败'}`)
      }
    } catch (e) {
      setTestResult(`错误: ${e instanceof Error ? e.message : '执行失败'}`)
    }
    setTesting(false)
  }

  const addParam = () => {
    setParams([...params, { name: '', type: 'any', required: true }])
  }

  const updateParam = (index: number, field: keyof UdfParam, value: unknown) => {
    const newParams = [...params]
    newParams[index] = { ...newParams[index], [field]: value }
    setParams(newParams)
  }

  const removeParam = (index: number) => {
    setParams(params.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>
            {isEdit ? '编辑自定义函数' : '创建自定义函数'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormInput label="函数标识" value={name} onChange={setName} placeholder="例如: my_calc" required disabled={isEdit} />
          <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 我的计算函数" required />
        </div>
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="函数功能说明" />

        <div className="grid grid-cols-2 gap-4">
          <FormSelect label="函数类型" value={udfType} onChange={v => setUdfType(v as 'expression' | 'javascript')} required options={[
            { value: 'expression', label: 'GML 表达式' },
            { value: 'javascript', label: 'JavaScript' },
          ]} />
          <FormSelect label="返回类型" value={returnType} onChange={setReturnType} options={[
            { value: 'any', label: 'Any' },
            { value: 'string', label: 'String' },
            { value: 'number', label: 'Number' },
            { value: 'boolean', label: 'Boolean' },
            { value: 'array', label: 'Array' },
            { value: 'object', label: 'Object' },
          ]} />
        </div>

        {/* 参数定义 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>输入参数</label>
            <button onClick={addParam} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ backgroundColor: 'var(--primary-container)', color: 'var(--on-primary-container)' }}>
              <IconPlus /> 添加参数
            </button>
          </div>
          {params.length === 0 ? (
            <p className="text-sm py-2" style={{ color: 'var(--on-surface-variant)' }}>暂无参数，点击"添加参数"按钮添加</p>
          ) : (
            <div className="space-y-2">
              {params.map((param, index) => (
                <div key={index} className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--surface-container)' }}>
                  <input
                    type="text"
                    value={param.name}
                    onChange={e => updateParam(index, 'name', e.target.value)}
                    placeholder="参数名"
                    className="flex-1 px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
                  />
                  <select
                    value={param.type}
                    onChange={e => updateParam(index, 'type', e.target.value)}
                    className="px-2 py-1 rounded text-sm"
                    style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
                  >
                    <option value="any">Any</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="array">Array</option>
                    <option value="object">Object</option>
                  </select>
                  <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--on-surface-variant)' }}>
                    <input type="checkbox" checked={param.required} onChange={e => updateParam(index, 'required', e.target.checked)} />
                    必填
                  </label>
                  <button onClick={() => removeParam(index)} className="p-1 rounded hover:opacity-80" style={{ color: 'var(--error)' }}>
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 代码编辑器 */}
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>
            函数代码 <span style={{ color: 'var(--error)' }}>*</span>
          </label>
          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder={udfType === 'expression'
              ? '// GML 表达式，例如:\n// a + b * 2\n// 可使用参数名直接引用'
              : '// JavaScript 代码，例如:\n// return a + b * 2;\n// 参数通过函数参数传入'}
            rows={8}
            className="w-full px-3 py-2 rounded-lg text-sm font-mono"
            style={{ backgroundColor: 'var(--surface-container)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
          />
        </div>

        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        {/* 测试面板 */}
        {isEdit && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--surface-container)' }}>
            <h3 className="text-sm font-medium mb-2" style={{ color: 'var(--on-surface)' }}>测试执行</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--on-surface-variant)' }}>输入参数 (JSON)</label>
                <textarea
                  value={testInput}
                  onChange={e => setTestInput(e.target.value)}
                  placeholder='{"a": 1, "b": 2}'
                  rows={3}
                  className="w-full px-2 py-1 rounded text-sm font-mono"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--on-surface-variant)' }}>执行结果</label>
                <pre
                  className="w-full px-2 py-1 rounded text-sm font-mono overflow-auto"
                  style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)', minHeight: '4.5rem', maxHeight: '4.5rem' }}
                >
                  {testResult || '点击"执行测试"查看结果'}
                </pre>
              </div>
            </div>
            <button
              onClick={handleTest}
              disabled={testing || !name.trim()}
              className="mt-2 px-3 py-1 rounded text-sm flex items-center gap-1"
              style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}
            >
              <IconTest />{testing ? '执行中...' : '执行测试'}
            </button>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim() || !code.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// OSS 对话框
function OssDialog({ open, oss, onClose, onSave }: {
  open: boolean
  oss: OssConfig | null
  onClose: () => void
  onSave: (data: Partial<OssConfig>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState<OssConfig['provider']>('s3')
  const [bucket, setBucket] = useState('')
  const [region, setRegion] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [pathStyle, setPathStyle] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isEdit = !!oss

  useEffect(() => {
    if (oss) {
      setName(oss.name)
      setDisplayName(oss.display_name)
      setDescription(oss.description || '')
      setProvider(oss.provider)
      setBucket(oss.bucket)
      setRegion(oss.region || '')
      setEndpoint(oss.endpoint || '')
      setAccessKeyId(oss.access_key_id)
      setSecretAccessKey(oss.secret_access_key)
      setPathStyle(oss.path_style)
      setEnabled(oss.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setProvider('s3')
      setBucket('')
      setRegion('')
      setEndpoint('')
      setAccessKeyId('')
      setSecretAccessKey('')
      setPathStyle(false)
      setEnabled(true)
    }
  }, [oss, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim()) {
      alert('请输入配置标识')
      return
    }
    if (!displayName.trim()) {
      alert('请输入显示名称')
      return
    }
    if (!bucket.trim()) {
      alert('请输入 Bucket 名称')
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        provider,
        bucket: bucket.trim(),
        region: region.trim() || undefined,
        endpoint: endpoint.trim() || undefined,
        access_key_id: accessKeyId.trim(),
        secret_access_key: secretAccessKey.trim(),
        path_style: pathStyle,
        enabled
      })
      onClose()
    } catch (err) {
      console.error('保存失败:', err)
      alert('保存失败，请检查控制台')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${API_BASE}/tools/oss/${name}/test?tenant_id=${TENANT_ID}`, { method: 'POST' })
      if (res.ok) {
        alert('连接测试成功!')
      } else {
        const data = await res.json()
        alert(`连接测试失败: ${data.error || '未知错误'}`)
      }
    } catch {
      alert('连接测试失败')
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>
            {isEdit ? '编辑对象存储' : '添加对象存储'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <FormInput label="配置标识" value={name} onChange={setName} placeholder="例如: my-oss" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 文件存储服务" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect label="存储提供商" value={provider} onChange={v => setProvider(v as OssConfig['provider'])} required options={[
          { value: 's3', label: 'Amazon S3' },
          { value: 'alioss', label: '阿里云 OSS' },
          { value: 'minio', label: 'MinIO' },
          { value: 'azure', label: 'Azure Blob' },
          { value: 'gcs', label: 'Google Cloud Storage' },
        ]} />
        <FormInput label="Bucket 名称" value={bucket} onChange={setBucket} placeholder="my-bucket" required />
        <div className="grid grid-cols-2 gap-4">
          <FormInput label="区域" value={region} onChange={setRegion} placeholder="us-east-1" />
          <FormInput label="端点 URL" value={endpoint} onChange={setEndpoint} placeholder="可选，自定义端点" />
        </div>
        <FormInput label="Access Key ID" value={accessKeyId} onChange={setAccessKeyId} placeholder="访问密钥 ID" />
        <FormInput label="Secret Access Key" value={secretAccessKey} onChange={setSecretAccessKey} placeholder="访问密钥" type="password" />
        <FormCheckbox label="使用 Path Style（MinIO 需要启用）" checked={pathStyle} onChange={setPathStyle} />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          {isEdit && (
            <button onClick={handleTest} disabled={testing} className="py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
              <IconTest />{testing ? '测试中...' : '测试连接'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim() || !bucket.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// OSS 卡片
function OssCard({ oss, onEdit, onDelete }: { oss: OssConfig; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'var(--outline-variant)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-container)' }}><IconCloud /></div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>{oss.display_name}</h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{oss.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}><IconEdit /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}><IconTrash /></button>
        </div>
      </div>
      <p className="text-sm mb-2 truncate" style={{ color: 'var(--on-surface-variant)' }}>{oss.bucket}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{oss.provider}</span>
        <span className={`px-2 py-0.5 rounded ${oss.enabled ? '' : 'opacity-50'}`} style={{ backgroundColor: oss.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)', color: oss.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)' }}>
          {oss.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// MQ 对话框
function MqDialog({ open, mq, onClose, onSave }: {
  open: boolean
  mq: MqConfig | null
  onClose: () => void
  onSave: (data: Partial<MqConfig>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [broker, setBroker] = useState<MqConfig['broker']>('rabbitmq')
  const [connectionString, setConnectionString] = useState('')
  const [defaultQueue, setDefaultQueue] = useState('')
  const [defaultExchange, setDefaultExchange] = useState('')
  const [defaultRoutingKey, setDefaultRoutingKey] = useState('')
  const [serialization, setSerialization] = useState<MqConfig['serialization']>('json')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isEdit = !!mq

  useEffect(() => {
    if (mq) {
      setName(mq.name)
      setDisplayName(mq.display_name)
      setDescription(mq.description || '')
      setBroker(mq.broker)
      setConnectionString(mq.connection_string)
      setDefaultQueue(mq.default_queue || '')
      setDefaultExchange(mq.default_exchange || '')
      setDefaultRoutingKey(mq.default_routing_key || '')
      setSerialization(mq.serialization)
      setEnabled(mq.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setBroker('rabbitmq')
      setConnectionString('')
      setDefaultQueue('')
      setDefaultExchange('')
      setDefaultRoutingKey('')
      setSerialization('json')
      setEnabled(true)
    }
  }, [mq, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !connectionString.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        broker,
        connection_string: connectionString.trim(),
        default_queue: defaultQueue.trim() || undefined,
        // RabbitMQ 专用字段
        default_exchange: broker === 'rabbitmq' ? (defaultExchange.trim() || undefined) : undefined,
        default_routing_key: broker === 'rabbitmq' ? (defaultRoutingKey.trim() || undefined) : undefined,
        serialization,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${API_BASE}/tools/mq/${name}/test?tenant_id=${TENANT_ID}`, { method: 'POST' })
      if (res.ok) {
        alert('连接测试成功!')
      } else {
        const data = await res.json()
        alert(`连接测试失败: ${data.error || '未知错误'}`)
      }
    } catch {
      alert('连接测试失败')
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>{isEdit ? '编辑消息队列' : '添加消息队列'}</h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <FormInput label="配置标识" value={name} onChange={setName} placeholder="例如: order-mq" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 订单消息队列" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect label="消息代理" value={broker} onChange={v => setBroker(v as MqConfig['broker'])} required options={[
          { value: 'rabbitmq', label: 'RabbitMQ' },
          { value: 'kafka', label: 'Apache Kafka' },
          { value: 'rocketmq', label: 'RocketMQ' },
          { value: 'redis', label: 'Redis Pub/Sub' },
        ]} />
        <FormInput label="连接字符串" value={connectionString} onChange={setConnectionString} placeholder="amqp://user:pass@localhost:5672" required />
        <FormInput label="默认队列" value={defaultQueue} onChange={setDefaultQueue} placeholder="可选" />
        {broker === 'rabbitmq' && (
          <>
            <FormInput label="默认 Exchange" value={defaultExchange} onChange={setDefaultExchange} placeholder="例如: customer.events" />
            <FormInput label="默认 Routing Key" value={defaultRoutingKey} onChange={setDefaultRoutingKey} placeholder="例如: view.updated" />
          </>
        )}
        <FormSelect label="序列化格式" value={serialization} onChange={v => setSerialization(v as MqConfig['serialization'])} options={[
          { value: 'json', label: 'JSON' },
          { value: 'protobuf', label: 'Protocol Buffers' },
          { value: 'avro', label: 'Apache Avro' },
        ]} />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          {isEdit && (
            <button onClick={handleTest} disabled={testing} className="py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
              <IconTest />{testing ? '测试中...' : '测试连接'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim() || !connectionString.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// MQ 卡片
function MqCard({ mq, onEdit, onDelete }: { mq: MqConfig; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'var(--outline-variant)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--secondary-container)' }}><IconQueue /></div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>{mq.display_name}</h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{mq.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}><IconEdit /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}><IconTrash /></button>
        </div>
      </div>
      <div className="text-sm mb-2 space-y-1" style={{ color: 'var(--on-surface-variant)' }}>
        <p className="truncate">{mq.default_queue || '未设置默认队列'}</p>
        {mq.broker === 'rabbitmq' && (mq.default_exchange || mq.default_routing_key) && (
          <p className="text-xs truncate">
            {mq.default_exchange && <span>Exchange: {mq.default_exchange}</span>}
            {mq.default_exchange && mq.default_routing_key && <span> / </span>}
            {mq.default_routing_key && <span>Key: {mq.default_routing_key}</span>}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{mq.broker}</span>
        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{mq.serialization}</span>
        <span className={`px-2 py-0.5 rounded ${mq.enabled ? '' : 'opacity-50'}`} style={{ backgroundColor: mq.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)', color: mq.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)' }}>
          {mq.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// Mail 对话框
function MailDialog({ open, mail, onClose, onSave }: {
  open: boolean
  mail: MailConfig | null
  onClose: () => void
  onSave: (data: Partial<MailConfig>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState<MailConfig['provider']>('smtp')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [useTls, setUseTls] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [fromAddress, setFromAddress] = useState('')
  const [fromName, setFromName] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isEdit = !!mail

  useEffect(() => {
    if (mail) {
      setName(mail.name)
      setDisplayName(mail.display_name)
      setDescription(mail.description || '')
      setProvider(mail.provider)
      setSmtpHost(mail.smtp_host || '')
      setSmtpPort(String(mail.smtp_port || 587))
      setUseTls(mail.use_tls ?? true)
      setUsername(mail.username || '')
      setPassword(mail.password || '')
      setApiKey(mail.api_key || '')
      setFromAddress(mail.from_address)
      setFromName(mail.from_name || '')
      setEnabled(mail.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setProvider('smtp')
      setSmtpHost('')
      setSmtpPort('587')
      setUseTls(true)
      setUsername('')
      setPassword('')
      setApiKey('')
      setFromAddress('')
      setFromName('')
      setEnabled(true)
    }
  }, [mail, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !fromAddress.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        provider,
        smtp_host: smtpHost.trim() || undefined,
        smtp_port: parseInt(smtpPort) || 587,
        use_tls: useTls,
        username: username.trim() || undefined,
        password: password.trim() || undefined,
        api_key: apiKey.trim() || undefined,
        from_address: fromAddress.trim(),
        from_name: fromName.trim() || undefined,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${API_BASE}/tools/mail/${name}/test?tenant_id=${TENANT_ID}`, { method: 'POST' })
      if (res.ok) {
        alert('发送测试邮件成功!')
      } else {
        const data = await res.json()
        alert(`发送测试邮件失败: ${data.error || '未知错误'}`)
      }
    } catch {
      alert('发送测试邮件失败')
    }
    setTesting(false)
  }

  const isSmtp = provider === 'smtp'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>{isEdit ? '编辑邮件配置' : '添加邮件配置'}</h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <FormInput label="配置标识" value={name} onChange={setName} placeholder="例如: notification-mail" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 通知邮件服务" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect label="邮件提供商" value={provider} onChange={v => setProvider(v as MailConfig['provider'])} required options={[
          { value: 'smtp', label: 'SMTP' },
          { value: 'sendgrid', label: 'SendGrid' },
          { value: 'mailgun', label: 'Mailgun' },
          { value: 'ses', label: 'Amazon SES' },
          { value: 'aliyun', label: '阿里云邮件推送' },
        ]} />

        {isSmtp ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="SMTP 服务器" value={smtpHost} onChange={setSmtpHost} placeholder="smtp.example.com" />
              <FormInput label="端口" value={smtpPort} onChange={setSmtpPort} type="number" />
            </div>
            <FormCheckbox label="使用 TLS" checked={useTls} onChange={setUseTls} />
            <FormInput label="用户名" value={username} onChange={setUsername} placeholder="发送账号" />
            <FormInput label="密码" value={password} onChange={setPassword} placeholder="发送密码" type="password" />
          </>
        ) : (
          <FormInput label="API Key" value={apiKey} onChange={setApiKey} placeholder="API 密钥" type="password" />
        )}

        <FormInput label="发件人地址" value={fromAddress} onChange={setFromAddress} placeholder="noreply@example.com" required />
        <FormInput label="发件人名称" value={fromName} onChange={setFromName} placeholder="可选" />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          {isEdit && (
            <button onClick={handleTest} disabled={testing} className="py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
              <IconMail />{testing ? '发送中...' : '发送测试'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim() || !fromAddress.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Mail 卡片
function MailCard({ mail, onEdit, onDelete }: { mail: MailConfig; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'var(--outline-variant)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--tertiary-container)' }}><IconMail /></div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>{mail.display_name}</h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{mail.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}><IconEdit /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}><IconTrash /></button>
        </div>
      </div>
      <p className="text-sm mb-2 truncate" style={{ color: 'var(--on-surface-variant)' }}>{mail.from_address}</p>
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{mail.provider}</span>
        <span className={`px-2 py-0.5 rounded ${mail.enabled ? '' : 'opacity-50'}`} style={{ backgroundColor: mail.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)', color: mail.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)' }}>
          {mail.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// SMS 对话框
function SmsDialog({ open, sms, onClose, onSave }: {
  open: boolean
  sms: SmsConfig | null
  onClose: () => void
  onSave: (data: Partial<SmsConfig>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [provider, setProvider] = useState<SmsConfig['provider']>('aliyun')
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [signName, setSignName] = useState('')
  const [region, setRegion] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)

  const isEdit = !!sms

  useEffect(() => {
    if (sms) {
      setName(sms.name)
      setDisplayName(sms.display_name)
      setDescription(sms.description || '')
      setProvider(sms.provider)
      setApiKey(sms.api_key)
      setApiSecret(sms.api_secret || '')
      setSignName(sms.sign_name || '')
      setRegion(sms.region || '')
      setEnabled(sms.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setProvider('aliyun')
      setApiKey('')
      setApiSecret('')
      setSignName('')
      setRegion('')
      setEnabled(true)
    }
  }, [sms, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim() || !apiKey.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        provider,
        api_key: apiKey.trim(),
        api_secret: apiSecret.trim() || undefined,
        sign_name: signName.trim() || undefined,
        region: region.trim() || undefined,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>{isEdit ? '编辑短信配置' : '添加短信配置'}</h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <FormInput label="配置标识" value={name} onChange={setName} placeholder="例如: notification-sms" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 通知短信服务" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect label="短信提供商" value={provider} onChange={v => setProvider(v as SmsConfig['provider'])} required options={[
          { value: 'aliyun', label: '阿里云短信' },
          { value: 'tencent', label: '腾讯云短信' },
          { value: 'twilio', label: 'Twilio' },
        ]} />
        <FormInput label="API Key / Access Key ID" value={apiKey} onChange={setApiKey} placeholder="访问密钥" required />
        <FormInput label="API Secret / Access Key Secret" value={apiSecret} onChange={setApiSecret} placeholder="访问密钥密码" type="password" />
        <FormInput label="签名名称" value={signName} onChange={setSignName} placeholder="短信签名" />
        <FormInput label="区域" value={region} onChange={setRegion} placeholder="cn-hangzhou" />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim() || !apiKey.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// SMS 卡片
function SmsCard({ sms, onEdit, onDelete }: { sms: SmsConfig; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'var(--outline-variant)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--primary-container)' }}><IconSms /></div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>{sms.display_name}</h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{sms.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}><IconEdit /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}><IconTrash /></button>
        </div>
      </div>
      {sms.sign_name && <p className="text-sm mb-2" style={{ color: 'var(--on-surface-variant)' }}>签名: {sms.sign_name}</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{sms.provider}</span>
        <span className={`px-2 py-0.5 rounded ${sms.enabled ? '' : 'opacity-50'}`} style={{ backgroundColor: sms.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)', color: sms.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)' }}>
          {sms.enabled ? '启用' : '禁用'}
        </span>
      </div>
    </div>
  )
}

// Svc 对话框
function SvcDialog({ open, svc, onClose, onSave }: {
  open: boolean
  svc: SvcConfig | null
  onClose: () => void
  onSave: (data: Partial<SvcConfig>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [discoveryType, setDiscoveryType] = useState<SvcConfig['discovery_type']>('static')
  const [endpoints, setEndpoints] = useState('')
  const [consulAddress, setConsulAddress] = useState('')
  const [k8sServiceName, setK8sServiceName] = useState('')
  const [k8sNamespace, setK8sNamespace] = useState('default')
  const [protocol, setProtocol] = useState<SvcConfig['protocol']>('http')
  const [loadBalancer, setLoadBalancer] = useState<SvcConfig['load_balancer']>('round_robin')
  const [timeoutMs, setTimeoutMs] = useState('30000')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const isEdit = !!svc

  useEffect(() => {
    if (svc) {
      setName(svc.name)
      setDisplayName(svc.display_name)
      setDescription(svc.description || '')
      setDiscoveryType(svc.discovery_type)
      setEndpoints(svc.endpoints?.join('\n') || '')
      setConsulAddress(svc.consul_address || '')
      setK8sServiceName(svc.k8s_service_name || '')
      setK8sNamespace(svc.k8s_namespace || 'default')
      setProtocol(svc.protocol)
      setLoadBalancer(svc.load_balancer)
      setTimeoutMs(String(svc.timeout_ms))
      setEnabled(svc.enabled)
    } else {
      setName('')
      setDisplayName('')
      setDescription('')
      setDiscoveryType('static')
      setEndpoints('')
      setConsulAddress('')
      setK8sServiceName('')
      setK8sNamespace('default')
      setProtocol('http')
      setLoadBalancer('round_robin')
      setTimeoutMs('30000')
      setEnabled(true)
    }
  }, [svc, open])

  if (!open) return null

  const handleSave = async () => {
    if (!name.trim() || !displayName.trim()) return
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        display_name: displayName.trim(),
        description: description.trim() || undefined,
        discovery_type: discoveryType,
        endpoints: endpoints.trim() ? endpoints.trim().split('\n').filter(e => e.trim()) : undefined,
        consul_address: consulAddress.trim() || undefined,
        k8s_service_name: k8sServiceName.trim() || undefined,
        k8s_namespace: k8sNamespace.trim() || 'default',
        protocol,
        load_balancer: loadBalancer,
        timeout_ms: parseInt(timeoutMs) || 30000,
        enabled
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleHealth = async () => {
    setTesting(true)
    try {
      const res = await fetch(`${API_BASE}/tools/svc/${name}/health?tenant_id=${TENANT_ID}`)
      if (res.ok) {
        const data = await res.json()
        alert(`健康检查结果: ${data.healthy ? '健康' : '不健康'}\n端点: ${data.endpoints?.length || 0} 个`)
      } else {
        const data = await res.json()
        alert(`健康检查失败: ${data.error || '未知错误'}`)
      }
    } catch {
      alert('健康检查失败')
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--surface-container-high)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium" style={{ color: 'var(--on-surface)' }}>{isEdit ? '编辑微服务配置' : '添加微服务配置'}</h2>
          <button onClick={onClose} style={{ color: 'var(--on-surface-variant)' }}><IconClose /></button>
        </div>

        <FormInput label="配置标识" value={name} onChange={setName} placeholder="例如: user-service" required disabled={isEdit} />
        <FormInput label="显示名称" value={displayName} onChange={setDisplayName} placeholder="例如: 用户服务" required />
        <FormInput label="描述" value={description} onChange={setDescription} placeholder="可选" />
        <FormSelect label="服务发现类型" value={discoveryType} onChange={v => setDiscoveryType(v as SvcConfig['discovery_type'])} required options={[
          { value: 'static', label: '静态端点' },
          { value: 'consul', label: 'Consul' },
          { value: 'k8s_dns', label: 'Kubernetes DNS' },
        ]} />

        {discoveryType === 'static' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--on-surface)' }}>端点列表 <span style={{ color: 'var(--error)' }}>*</span></label>
            <textarea
              value={endpoints}
              onChange={e => setEndpoints(e.target.value)}
              placeholder="每行一个端点，例如:&#10;http://localhost:8080&#10;http://localhost:8081"
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface-container)', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}
            />
          </div>
        )}
        {discoveryType === 'consul' && (
          <FormInput label="Consul 地址" value={consulAddress} onChange={setConsulAddress} placeholder="http://consul:8500" />
        )}
        {discoveryType === 'k8s_dns' && (
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="服务名称" value={k8sServiceName} onChange={setK8sServiceName} placeholder="my-service" />
            <FormInput label="命名空间" value={k8sNamespace} onChange={setK8sNamespace} placeholder="default" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormSelect label="协议" value={protocol} onChange={v => setProtocol(v as SvcConfig['protocol'])} options={[
            { value: 'http', label: 'HTTP' },
            { value: 'grpc', label: 'gRPC' },
          ]} />
          <FormSelect label="负载均衡" value={loadBalancer} onChange={v => setLoadBalancer(v as SvcConfig['load_balancer'])} options={[
            { value: 'round_robin', label: '轮询' },
            { value: 'random', label: '随机' },
            { value: 'least_connections', label: '最少连接' },
          ]} />
        </div>
        <FormInput label="超时时间 (ms)" value={timeoutMs} onChange={setTimeoutMs} type="number" />
        <FormCheckbox label="启用" checked={enabled} onChange={setEnabled} />

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}>取消</button>
          {isEdit && (
            <button onClick={handleHealth} disabled={testing} className="py-2 px-4 rounded-lg text-sm font-medium flex items-center gap-1" style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}>
              <IconTest />{testing ? '检查中...' : '健康检查'}
            </button>
          )}
          <button onClick={handleSave} disabled={saving || !name.trim() || !displayName.trim()} className="flex-1 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)' }}>
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Svc 卡片
function SvcCard({ svc, onEdit, onDelete }: { svc: SvcConfig; onEdit: () => void; onDelete: () => void }) {
  const discoveryLabel = { static: '静态', consul: 'Consul', k8s_dns: 'K8s' }[svc.discovery_type]
  return (
    <div className="p-4 rounded-lg border" style={{ backgroundColor: 'var(--surface-container)', borderColor: 'var(--outline-variant)' }}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--secondary-container)' }}><IconService /></div>
          <div>
            <h3 className="font-medium" style={{ color: 'var(--on-surface)' }}>{svc.display_name}</h3>
            <p className="text-xs" style={{ color: 'var(--on-surface-variant)' }}>{svc.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--primary)' }}><IconEdit /></button>
          <button onClick={onDelete} className="p-1.5 rounded hover:opacity-80" style={{ color: 'var(--error)' }}><IconTrash /></button>
        </div>
      </div>
      <p className="text-sm mb-2" style={{ color: 'var(--on-surface-variant)' }}>
        {svc.endpoints?.length ? `${svc.endpoints.length} 个端点` : svc.k8s_service_name || svc.consul_address || '-'}
      </p>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{svc.protocol}</span>
        <span className="px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-container-high)', color: 'var(--on-surface-variant)' }}>{discoveryLabel}</span>
        <span className={`px-2 py-0.5 rounded ${svc.enabled ? '' : 'opacity-50'}`} style={{ backgroundColor: svc.enabled ? 'var(--tertiary-container)' : 'var(--surface-container-high)', color: svc.enabled ? 'var(--on-tertiary-container)' : 'var(--on-surface-variant)' }}>
          {svc.enabled ? '启用' : '禁用'}
        </span>
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
  const [ossConfigs, setOssConfigs] = useState<OssConfig[]>([])
  const [mqConfigs, setMqConfigs] = useState<MqConfig[]>([])
  const [mailConfigs, setMailConfigs] = useState<MailConfig[]>([])
  const [smsConfigs, setSmsConfigs] = useState<SmsConfig[]>([])
  const [svcConfigs, setSvcConfigs] = useState<SvcConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 对话框状态
  const [dialogType, setDialogType] = useState<DialogType>('none')
  const [editingService, setEditingService] = useState<ApiService | null>(null)
  const [editingDatasource, setEditingDatasource] = useState<Datasource | null>(null)
  const [editingUdf, setEditingUdf] = useState<Udf | null>(null)
  const [editingOss, setEditingOss] = useState<OssConfig | null>(null)
  const [editingMq, setEditingMq] = useState<MqConfig | null>(null)
  const [editingMail, setEditingMail] = useState<MailConfig | null>(null)
  const [editingSms, setEditingSms] = useState<SmsConfig | null>(null)
  const [editingSvc, setEditingSvc] = useState<SvcConfig | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const [servicesRes, datasourcesRes, udfsRes, ossRes, mqRes, mailRes, smsRes, svcRes] = await Promise.all([
        fetch(`${API_BASE}/tools/services?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/datasources?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/udfs?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/oss?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/mq?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/mail?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/sms?tenant_id=${TENANT_ID}`),
        fetch(`${API_BASE}/tools/svc?tenant_id=${TENANT_ID}`)
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
      if (ossRes.ok) {
        const data = await ossRes.json()
        setOssConfigs(data.configs || [])
      }
      if (mqRes.ok) {
        const data = await mqRes.json()
        setMqConfigs(data.configs || [])
      }
      if (mailRes.ok) {
        const data = await mailRes.json()
        setMailConfigs(data.configs || [])
      }
      if (smsRes.ok) {
        const data = await smsRes.json()
        setSmsConfigs(data.configs || [])
      }
      if (svcRes.ok) {
        const data = await svcRes.json()
        setSvcConfigs(data.configs || [])
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

  // 自定义 UDF 操作
  async function handleSaveUdf(data: Partial<Udf>) {
    const isEdit = !!editingUdf
    const url = isEdit
      ? `${API_BASE}/tools/udfs/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/udfs?tenant_id=${TENANT_ID}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  // OSS 操作
  async function handleSaveOss(data: Partial<OssConfig>) {
    const isEdit = !!editingOss
    const url = isEdit
      ? `${API_BASE}/tools/oss/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/oss?tenant_id=${TENANT_ID}`
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`保存失败: ${res.status} ${err}`)
    }
    loadData()
  }

  async function handleDeleteOss(name: string) {
    if (!confirm(`确定要删除对象存储 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/oss/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  // MQ 操作
  async function handleSaveMq(data: Partial<MqConfig>) {
    const isEdit = !!editingMq
    const url = isEdit
      ? `${API_BASE}/tools/mq/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/mq?tenant_id=${TENANT_ID}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteMq(name: string) {
    if (!confirm(`确定要删除消息队列 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/mq/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  // Mail 操作
  async function handleSaveMail(data: Partial<MailConfig>) {
    const isEdit = !!editingMail
    const url = isEdit
      ? `${API_BASE}/tools/mail/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/mail?tenant_id=${TENANT_ID}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteMail(name: string) {
    if (!confirm(`确定要删除邮件配置 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/mail/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  // SMS 操作
  async function handleSaveSms(data: Partial<SmsConfig>) {
    const isEdit = !!editingSms
    const url = isEdit
      ? `${API_BASE}/tools/sms/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/sms?tenant_id=${TENANT_ID}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteSms(name: string) {
    if (!confirm(`确定要删除短信配置 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/sms/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  // Svc 操作
  async function handleSaveSvc(data: Partial<SvcConfig>) {
    const isEdit = !!editingSvc
    const url = isEdit
      ? `${API_BASE}/tools/svc/${data.name}?tenant_id=${TENANT_ID}`
      : `${API_BASE}/tools/svc?tenant_id=${TENANT_ID}`
    await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, tenant_id: TENANT_ID })
    })
    loadData()
  }

  async function handleDeleteSvc(name: string) {
    if (!confirm(`确定要删除微服务配置 "${name}" 吗？`)) return
    await fetch(`${API_BASE}/tools/svc/${name}?tenant_id=${TENANT_ID}`, { method: 'DELETE' })
    loadData()
  }

  function handleAdd() {
    if (activeTab === 'services') {
      setEditingService(null)
      setDialogType('create-service')
    } else if (activeTab === 'datasources') {
      setEditingDatasource(null)
      setDialogType('create-datasource')
    } else if (activeTab === 'oss') {
      setEditingOss(null)
      setDialogType('create-oss')
    } else if (activeTab === 'mq') {
      setEditingMq(null)
      setDialogType('create-mq')
    } else if (activeTab === 'mail') {
      setEditingMail(null)
      setDialogType('create-mail')
    } else if (activeTab === 'sms') {
      setEditingSms(null)
      setDialogType('create-sms')
    } else if (activeTab === 'svc') {
      setEditingSvc(null)
      setDialogType('create-svc')
    } else if (activeTab === 'udfs') {
      setEditingUdf(null)
      setDialogType('create-udf')
    }
  }

  const tabs = [
    { id: 'services' as TabType, label: 'API 服务', icon: <IconApi />, count: services.length },
    { id: 'datasources' as TabType, label: '数据源', icon: <IconDatabase />, count: datasources.length },
    { id: 'udfs' as TabType, label: 'UDF', icon: <IconFunction />, count: udfs.length },
    { id: 'oss' as TabType, label: '对象存储', icon: <IconCloud />, count: ossConfigs.length },
    { id: 'mq' as TabType, label: '消息队列', icon: <IconQueue />, count: mqConfigs.length },
    { id: 'mail' as TabType, label: '邮件', icon: <IconMail />, count: mailConfigs.length },
    { id: 'sms' as TabType, label: '短信', icon: <IconSms />, count: smsConfigs.length },
    { id: 'svc' as TabType, label: '微服务', icon: <IconService />, count: svcConfigs.length },
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
                {udfs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconFunction /></div>
                    <p className="mt-2">暂无自定义函数</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个自定义函数</p>
                  </div>
                ) : (
                  udfs.map(udf => (
                    <UdfCard
                      key={udf.name}
                      udf={udf}
                      onEdit={!udf.is_builtin ? () => { setEditingUdf(udf); setDialogType('edit-udf') } : undefined}
                      onDelete={() => handleDeleteUdf(udf.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'oss' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ossConfigs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconCloud /></div>
                    <p className="mt-2">暂无对象存储配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个对象存储配置</p>
                  </div>
                ) : (
                  ossConfigs.map(oss => (
                    <OssCard
                      key={oss.name}
                      oss={oss}
                      onEdit={() => { setEditingOss(oss); setDialogType('edit-oss') }}
                      onDelete={() => handleDeleteOss(oss.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'mq' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mqConfigs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconQueue /></div>
                    <p className="mt-2">暂无消息队列配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个消息队列配置</p>
                  </div>
                ) : (
                  mqConfigs.map(mq => (
                    <MqCard
                      key={mq.name}
                      mq={mq}
                      onEdit={() => { setEditingMq(mq); setDialogType('edit-mq') }}
                      onDelete={() => handleDeleteMq(mq.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'mail' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mailConfigs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconMail /></div>
                    <p className="mt-2">暂无邮件配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个邮件配置</p>
                  </div>
                ) : (
                  mailConfigs.map(mail => (
                    <MailCard
                      key={mail.name}
                      mail={mail}
                      onEdit={() => { setEditingMail(mail); setDialogType('edit-mail') }}
                      onDelete={() => handleDeleteMail(mail.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'sms' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {smsConfigs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconSms /></div>
                    <p className="mt-2">暂无短信配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个短信配置</p>
                  </div>
                ) : (
                  smsConfigs.map(sms => (
                    <SmsCard
                      key={sms.name}
                      sms={sms}
                      onEdit={() => { setEditingSms(sms); setDialogType('edit-sms') }}
                      onDelete={() => handleDeleteSms(sms.name)}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'svc' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {svcConfigs.length === 0 ? (
                  <div className="col-span-full p-12 text-center rounded-lg border-2 border-dashed" style={{ borderColor: 'var(--outline-variant)', color: 'var(--on-surface-variant)' }}>
                    <div className="flex justify-center mb-2"><IconService /></div>
                    <p className="mt-2">暂无微服务配置</p>
                    <p className="text-sm mt-1">点击"添加"按钮创建第一个微服务配置</p>
                  </div>
                ) : (
                  svcConfigs.map(svc => (
                    <SvcCard
                      key={svc.name}
                      svc={svc}
                      onEdit={() => { setEditingSvc(svc); setDialogType('edit-svc') }}
                      onDelete={() => handleDeleteSvc(svc.name)}
                    />
                  ))
                )}
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
      <UdfEditorDialog
        open={dialogType === 'create-udf' || dialogType === 'edit-udf'}
        udf={editingUdf}
        onClose={() => { setDialogType('none'); setEditingUdf(null) }}
        onSave={handleSaveUdf}
      />
      <OssDialog
        open={dialogType === 'create-oss' || dialogType === 'edit-oss'}
        oss={editingOss}
        onClose={() => { setDialogType('none'); setEditingOss(null) }}
        onSave={handleSaveOss}
      />
      <MqDialog
        open={dialogType === 'create-mq' || dialogType === 'edit-mq'}
        mq={editingMq}
        onClose={() => { setDialogType('none'); setEditingMq(null) }}
        onSave={handleSaveMq}
      />
      <MailDialog
        open={dialogType === 'create-mail' || dialogType === 'edit-mail'}
        mail={editingMail}
        onClose={() => { setDialogType('none'); setEditingMail(null) }}
        onSave={handleSaveMail}
      />
      <SmsDialog
        open={dialogType === 'create-sms' || dialogType === 'edit-sms'}
        sms={editingSms}
        onClose={() => { setDialogType('none'); setEditingSms(null) }}
        onSave={handleSaveSms}
      />
      <SvcDialog
        open={dialogType === 'create-svc' || dialogType === 'edit-svc'}
        svc={editingSvc}
        onClose={() => { setDialogType('none'); setEditingSvc(null) }}
        onSave={handleSaveSvc}
      />
    </div>
  )
}
