/**
 * TypeDefEditor - 类型定义编辑器组件
 *
 * 用于编辑 Flow 的 args.defs 类型定义，支持添加/删除/编辑自定义类型。
 */

import { useState } from 'react'
import type { FlowTypeDef, FlowParameter } from '@/types/flow'

// 基础类型选项
const BASE_TYPE_OPTIONS = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
  { value: 'array', label: 'Array' },
]

interface FieldDefEditorProps {
  field: FlowParameter
  index: number
  customTypes: string[]
  onUpdate: (field: Partial<FlowParameter>) => void
  onRemove: () => void
}

/**
 * 字段定义编辑器 - 编辑类型中的单个字段
 */
export function FieldDefEditor({
  field,
  index,
  customTypes,
  onUpdate,
  onRemove,
}: FieldDefEditorProps) {
  const [expanded, setExpanded] = useState(false)

  // 合并基础类型和自定义类型
  const typeOptions = [
    ...BASE_TYPE_OPTIONS,
    ...customTypes.map(t => ({ value: t, label: t })),
  ]

  return (
    <div
      className="rounded-lg border transition-all"
      style={{
        borderColor: 'var(--outline-variant)',
        backgroundColor: 'var(--surface-container-highest)',
      }}
    >
      {/* 字段头部 */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--secondary-container)', color: 'var(--on-secondary-container)' }}
        >
          {index + 1}
        </span>
        <span className="flex-1 text-[12px] font-medium truncate" style={{ color: 'var(--on-surface)' }}>
          {field.name || '未命名字段'}
        </span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded font-mono"
          style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}
        >
          {field.isArray ? `${field.type}[]` : field.type}
          {field.nullable && '?'}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
          title="删除字段"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* 展开的编辑区域 */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                字段名
              </label>
              <input
                type="text"
                value={field.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="fieldName"
                className="w-full px-2 py-1.5 text-[12px] font-mono rounded border focus:outline-none focus:ring-1"
                style={{
                  backgroundColor: 'var(--surface-container)',
                  borderColor: 'var(--outline-variant)',
                  color: 'var(--on-surface)',
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
                类型
              </label>
              <select
                value={field.type}
                onChange={(e) => onUpdate({ type: e.target.value })}
                className="w-full px-2 py-1.5 text-[12px] rounded border focus:outline-none focus:ring-1 cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface-container)',
                  borderColor: 'var(--outline-variant)',
                  color: 'var(--on-surface)',
                }}
              >
                {typeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.nullable || false}
                onChange={(e) => onUpdate({ nullable: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
              />
              <span className="text-[11px]" style={{ color: 'var(--on-surface-variant)' }}>可为空</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={field.isArray || false}
                onChange={(e) => onUpdate({ isArray: e.target.checked })}
                className="w-3.5 h-3.5 rounded accent-[var(--primary)]"
              />
              <span className="text-[11px]" style={{ color: 'var(--on-surface-variant)' }}>数组</span>
            </label>
          </div>

          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
              默认值
            </label>
            <input
              type="text"
              value={field.defaultValue || ''}
              onChange={(e) => onUpdate({ defaultValue: e.target.value })}
              placeholder="可选默认值"
              className="w-full px-2 py-1.5 text-[12px] font-mono rounded border focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--surface-container)',
                borderColor: 'var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium mb-1" style={{ color: 'var(--on-surface-variant)' }}>
              描述
            </label>
            <input
              type="text"
              value={field.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="字段说明"
              className="w-full px-2 py-1.5 text-[12px] rounded border focus:outline-none focus:ring-1"
              style={{
                backgroundColor: 'var(--surface-container)',
                borderColor: 'var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

interface TypeDefEditorProps {
  typeDef: FlowTypeDef
  index: number
  allTypeNames: string[]
  onUpdate: (typeDef: FlowTypeDef) => void
  onRemove: () => void
}

/**
 * 类型定义编辑器 - 编辑单个自定义类型
 */
export function TypeDefEditor({
  typeDef,
  index,
  allTypeNames,
  onUpdate,
  onRemove,
}: TypeDefEditorProps) {
  const [expanded, setExpanded] = useState(false)

  // 可用的自定义类型（排除当前类型，避免自引用）
  const otherTypes = allTypeNames.filter(t => t !== typeDef.name)

  const handleUpdateField = (fieldIndex: number, updates: Partial<FlowParameter>) => {
    const newFields = [...typeDef.fields]
    newFields[fieldIndex] = { ...newFields[fieldIndex], ...updates }
    onUpdate({ ...typeDef, fields: newFields })
  }

  const handleRemoveField = (fieldIndex: number) => {
    const newFields = typeDef.fields.filter((_, i) => i !== fieldIndex)
    onUpdate({ ...typeDef, fields: newFields })
  }

  const handleAddField = () => {
    const newField: FlowParameter = {
      name: '',
      type: 'string',
    }
    onUpdate({ ...typeDef, fields: [...typeDef.fields, newField] })
  }

  return (
    <div
      className="rounded-xl border transition-all"
      style={{
        borderColor: 'var(--outline-variant)',
        backgroundColor: 'var(--surface-container-low)',
      }}
    >
      {/* 类型头部 */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--tertiary-container)', color: 'var(--on-tertiary-container)' }}
        >
          Type {index + 1}
        </span>
        <span className="flex-1 text-[13px] font-semibold truncate font-mono" style={{ color: 'var(--on-surface)' }}>
          {typeDef.name || '未命名类型'}
        </span>
        <span
          className="text-[10px] px-2 py-0.5 rounded"
          style={{ backgroundColor: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}
        >
          {typeDef.fields.length} 字段
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            color: 'var(--on-surface-variant)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1 rounded hover:bg-red-100 text-red-500 transition-colors"
          title="删除类型"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      {/* 展开的编辑区域 */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t" style={{ borderColor: 'var(--outline-variant)' }}>
          {/* 类型名称 */}
          <div>
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: 'var(--on-surface-variant)' }}>
              类型名称
            </label>
            <input
              type="text"
              value={typeDef.name}
              onChange={(e) => onUpdate({ ...typeDef, name: e.target.value })}
              placeholder="TypeName"
              className="w-full px-3 py-2 text-[13px] font-mono rounded-lg border focus:outline-none focus:ring-2"
              style={{
                backgroundColor: 'var(--surface-container)',
                borderColor: 'var(--outline-variant)',
                color: 'var(--on-surface)',
              }}
            />
            <p className="text-[10px] mt-1" style={{ color: 'var(--on-surface-variant)' }}>
              类型名称使用 PascalCase 格式，如 CustomerInfo
            </p>
          </div>

          {/* 字段列表 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-medium" style={{ color: 'var(--on-surface-variant)' }}>
                字段定义
              </label>
              <button
                onClick={handleAddField}
                className="flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors"
                style={{
                  backgroundColor: 'var(--primary-container)',
                  color: 'var(--on-primary-container)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                添加字段
              </button>
            </div>

            {typeDef.fields.length === 0 ? (
              <div
                className="py-6 text-center text-[12px] rounded-lg border-2 border-dashed"
                style={{
                  borderColor: 'var(--outline-variant)',
                  color: 'var(--on-surface-variant)',
                }}
              >
                暂无字段，点击上方按钮添加
              </div>
            ) : (
              <div className="space-y-2">
                {typeDef.fields.map((field, fieldIndex) => (
                  <FieldDefEditor
                    key={fieldIndex}
                    field={field}
                    index={fieldIndex}
                    customTypes={otherTypes}
                    onUpdate={(updates) => handleUpdateField(fieldIndex, updates)}
                    onRemove={() => handleRemoveField(fieldIndex)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface TypeDefsEditorProps {
  defs: FlowTypeDef[]
  onChange: (defs: FlowTypeDef[]) => void
}

/**
 * 类型定义列表编辑器 - 管理所有自定义类型
 */
export function TypeDefsEditor({ defs, onChange }: TypeDefsEditorProps) {
  const allTypeNames = defs.map(d => d.name).filter(Boolean)

  const handleUpdateType = (index: number, typeDef: FlowTypeDef) => {
    const newDefs = [...defs]
    newDefs[index] = typeDef
    onChange(newDefs)
  }

  const handleRemoveType = (index: number) => {
    const newDefs = defs.filter((_, i) => i !== index)
    onChange(newDefs)
  }

  const handleAddType = () => {
    const newType: FlowTypeDef = {
      name: '',
      fields: [],
    }
    onChange([...defs, newType])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-semibold" style={{ color: 'var(--on-surface)' }}>
            自定义类型定义
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--on-surface-variant)' }}>
            定义流程中使用的复杂数据类型
          </p>
        </div>
        <button
          onClick={handleAddType}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'var(--on-primary)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          添加类型
        </button>
      </div>

      {defs.length === 0 ? (
        <div
          className="py-8 text-center rounded-xl border-2 border-dashed"
          style={{
            borderColor: 'var(--outline-variant)',
            color: 'var(--on-surface-variant)',
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto mb-2 opacity-50"
          >
            <path d="M4 7V4h16v3"/>
            <path d="M9 20h6"/>
            <path d="M12 4v16"/>
          </svg>
          <p className="text-[13px] font-medium">暂无自定义类型</p>
          <p className="text-[11px] mt-1">点击上方按钮创建第一个类型定义</p>
        </div>
      ) : (
        <div className="space-y-3">
          {defs.map((typeDef, index) => (
            <TypeDefEditor
              key={index}
              typeDef={typeDef}
              index={index}
              allTypeNames={allTypeNames}
              onUpdate={(updated) => handleUpdateType(index, updated)}
              onRemove={() => handleRemoveType(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
