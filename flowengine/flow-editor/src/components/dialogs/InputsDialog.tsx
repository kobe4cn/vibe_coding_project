/**
 * Inputs Dialog Component
 * Dialog for entering flow execution parameters
 * Supports both form mode and JSON mode
 */

import { useState, useMemo, useEffect } from 'react'
import type { StartParameterDef } from '@/types/flow'

// Icons
const Icons = {
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12"/>
    </svg>
  ),
  form: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M3 9h18"/>
      <path d="M9 21V9"/>
    </svg>
  ),
  json: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1"/>
      <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>
    </svg>
  ),
  play: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <polygon points="6 3 20 12 6 21 6 3"/>
    </svg>
  ),
}

interface InputsDialogProps {
  isOpen: boolean
  onClose: () => void
  onExecute: (inputs: Record<string, unknown>) => void
  parameters: StartParameterDef[]
  flowName?: string
}

type InputMode = 'form' | 'json'

export function InputsDialog({
  isOpen,
  onClose,
  onExecute,
  parameters,
  flowName,
}: InputsDialogProps) {
  const [mode, setMode] = useState<InputMode>('form')
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})
  const [jsonValue, setJsonValue] = useState('{}')
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Initialize form values with defaults
  useEffect(() => {
    if (isOpen) {
      const initialValues: Record<string, unknown> = {}
      parameters.forEach((param) => {
        if (param.defaultValue !== undefined && param.defaultValue !== '') {
          try {
            // Try to parse as JSON for complex types
            if (param.type === 'object' || param.type === 'array') {
              initialValues[param.name] = JSON.parse(param.defaultValue)
            } else if (param.type === 'number') {
              initialValues[param.name] = parseFloat(param.defaultValue)
            } else if (param.type === 'boolean') {
              initialValues[param.name] = param.defaultValue === 'true'
            } else {
              initialValues[param.name] = param.defaultValue
            }
          } catch {
            initialValues[param.name] = param.defaultValue
          }
        }
      })
      // 使用 requestAnimationFrame 避免在 effect 中同步调用 setState
      requestAnimationFrame(() => {
        setFormValues(initialValues)
        setJsonValue(JSON.stringify(initialValues, null, 2))
        setJsonError(null)
      })
    }
  }, [isOpen, parameters])

  // Sync form values to JSON when switching modes
  const handleModeChange = (newMode: InputMode) => {
    if (newMode === 'json' && mode === 'form') {
      setJsonValue(JSON.stringify(formValues, null, 2))
    } else if (newMode === 'form' && mode === 'json') {
      try {
        const parsed = JSON.parse(jsonValue)
        setFormValues(parsed)
        setJsonError(null)
      } catch {
        // Keep current form values if JSON is invalid
      }
    }
    setMode(newMode)
  }

  // Validate inputs
  const validationErrors = useMemo(() => {
    const errors: string[] = []
    const values = mode === 'form' ? formValues : (() => {
      try {
        return JSON.parse(jsonValue)
      } catch {
        return {}
      }
    })()

    parameters.forEach((param) => {
      if (param.required && (values[param.name] === undefined || values[param.name] === '')) {
        errors.push(`"${param.name}" 为必填参数`)
      }
    })

    return errors
  }, [mode, formValues, jsonValue, parameters])

  // Handle form field change
  const handleFieldChange = (name: string, value: unknown, type: string) => {
    let parsedValue: unknown = value

    if (type === 'number' && typeof value === 'string') {
      parsedValue = value === '' ? undefined : parseFloat(value)
    } else if (type === 'boolean') {
      parsedValue = value === true || value === 'true'
    }

    setFormValues((prev) => ({ ...prev, [name]: parsedValue }))
  }

  // Handle JSON change
  const handleJsonChange = (value: string) => {
    setJsonValue(value)
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  // Handle execute
  const handleExecute = () => {
    let inputs: Record<string, unknown>

    if (mode === 'json') {
      try {
        inputs = JSON.parse(jsonValue)
      } catch {
        return // Invalid JSON
      }
    } else {
      inputs = formValues
    }

    onExecute(inputs)
  }

  if (!isOpen) return null

  const canExecute = validationErrors.length === 0 && (mode !== 'json' || !jsonError)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--surface-container)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid var(--outline-variant)' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--on-surface)' }}>
              执行参数
            </h2>
            {flowName && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--on-surface-variant)' }}>
                {flowName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            {Icons.close}
          </button>
        </div>

        {/* Mode switcher */}
        <div className="px-6 pt-4">
          <div
            className="inline-flex rounded-lg p-1"
            style={{ backgroundColor: 'var(--surface-container-high)' }}
          >
            <button
              onClick={() => handleModeChange('form')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'form' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: mode === 'form' ? 'var(--surface)' : 'transparent',
                color: mode === 'form' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              }}
            >
              {Icons.form}
              表单
            </button>
            <button
              onClick={() => handleModeChange('json')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                mode === 'json' ? 'shadow-sm' : ''
              }`}
              style={{
                backgroundColor: mode === 'json' ? 'var(--surface)' : 'transparent',
                color: mode === 'json' ? 'var(--on-surface)' : 'var(--on-surface-variant)',
              }}
            >
              {Icons.json}
              JSON
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          {parameters.length === 0 ? (
            <div
              className="text-center py-8"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              <p className="text-sm">此流程没有定义输入参数</p>
              <p className="text-xs mt-1 opacity-60">可以直接执行</p>
            </div>
          ) : mode === 'form' ? (
            <div className="space-y-4">
              {parameters.map((param) => (
                <div key={param.name}>
                  <label className="flex items-center gap-1.5 text-xs font-medium mb-1.5">
                    <span style={{ color: 'var(--on-surface-variant)' }}>{param.name}</span>
                    {param.required && <span className="text-red-500">*</span>}
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        backgroundColor: 'var(--surface-container-highest)',
                        color: 'var(--on-surface-variant)',
                      }}
                    >
                      {param.type}
                    </span>
                  </label>
                  {param.description && (
                    <p
                      className="text-[10px] mb-1.5"
                      style={{ color: 'var(--on-surface-variant)', opacity: 0.7 }}
                    >
                      {param.description}
                    </p>
                  )}
                  {renderFormField(param, formValues[param.name], (value) =>
                    handleFieldChange(param.name, value, param.type)
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div>
              <textarea
                value={jsonValue}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="w-full h-64 px-3 py-2 text-sm font-mono rounded-lg resize-none focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--surface-container-highest)',
                  color: 'var(--on-surface)',
                  borderColor: jsonError ? 'var(--error)' : 'var(--outline-variant)',
                  border: '1px solid',
                }}
                placeholder="{}"
              />
              {jsonError && (
                <p className="text-xs mt-1 text-red-500">{jsonError}</p>
              )}
            </div>
          )}
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div
            className="mx-6 mb-4 p-3 rounded-lg"
            style={{ backgroundColor: 'var(--error-container)' }}
          >
            {validationErrors.map((error, i) => (
              <p
                key={i}
                className="text-xs"
                style={{ color: 'var(--on-error-container)' }}
              >
                {error}
              </p>
            ))}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--outline-variant)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: 'var(--on-surface-variant)',
              backgroundColor: 'transparent',
            }}
          >
            取消
          </button>
          <button
            onClick={handleExecute}
            disabled={!canExecute}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              backgroundColor: canExecute ? 'var(--primary)' : 'var(--surface-container-high)',
              color: canExecute ? 'var(--on-primary)' : 'var(--on-surface-variant)',
              opacity: canExecute ? 1 : 0.5,
              cursor: canExecute ? 'pointer' : 'not-allowed',
            }}
          >
            {Icons.play}
            执行
          </button>
        </div>
      </div>
    </div>
  )
}

// Render form field based on parameter type
function renderFormField(
  param: StartParameterDef,
  value: unknown,
  onChange: (value: unknown) => void
) {
  const baseInputClass = `
    w-full px-3 py-2 text-sm rounded-lg
    bg-[var(--surface-container-highest)]
    border border-[var(--outline-variant)]
    text-[var(--on-surface)]
    placeholder:text-[var(--on-surface-variant)] placeholder:opacity-40
    focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/30
    transition-colors
  `

  switch (param.type) {
    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 rounded accent-[var(--primary)]"
          />
          <span className="text-sm" style={{ color: 'var(--on-surface)' }}>
            {value === true ? 'true' : 'false'}
          </span>
        </label>
      )

    case 'number':
      return (
        <input
          type="number"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.defaultValue || '输入数字'}
          className={baseInputClass}
        />
      )

    case 'object':
    case 'array':
      return (
        <textarea
          value={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '')}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value))
            } catch {
              onChange(e.target.value)
            }
          }}
          placeholder={param.type === 'object' ? '{ "key": "value" }' : '[ "item1", "item2" ]'}
          className={`${baseInputClass} font-mono h-24 resize-none`}
        />
      )

    default: // string
      return (
        <input
          type="text"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.defaultValue || '输入文本'}
          className={baseInputClass}
        />
      )
  }
}
