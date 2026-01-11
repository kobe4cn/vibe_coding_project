/**
 * Auto Save Hook
 * 提供统一的保存版本功能，支持：
 * - Ctrl+S 手动保存
 * - afterDelay 自动保存（编辑后延迟保存）
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFlowStore } from '@/stores/flowStore'
import { createBackendProvider } from '@/lib/storage/backend-provider'

// 自动保存延迟时间（毫秒）
const AUTO_SAVE_DELAY = 2000

interface UseAutoSaveOptions {
  /** 是否启用自动保存 */
  enabled?: boolean
  /** 自动保存延迟时间（毫秒） */
  delay?: number
}

interface UseAutoSaveReturn {
  /** 手动保存 */
  save: () => Promise<void>
  /** 是否正在保存 */
  isSaving: boolean
  /** 最后保存时间 */
  lastSaveTime: Date | null
  /** 保存错误 */
  saveError: string | null
}

export function useAutoSave(options: UseAutoSaveOptions = {}): UseAutoSaveReturn {
  const { enabled = true, delay = AUTO_SAVE_DELAY } = options

  const { flow, flowId, isDirty, setIsDirty, isReadOnly } = useFlowStore()

  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const autoSaveTimeoutRef = useRef<number | null>(null)
  const lastFlowHashRef = useRef<string>('')

  // 生成 flow 的简单哈希
  const getFlowHash = useCallback((f: typeof flow) => {
    return JSON.stringify({
      nodes: f.nodes.map(n => ({ id: n.id, type: n.type, data: n.data, position: n.position })),
      edges: f.edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      meta: f.meta,
      args: f.args,
      vars: f.vars,
    })
  }, [])

  // 保存版本
  // force: 强制保存，即使没有脏数据（用于 Ctrl+S 手动保存）
  const saveVersion = useCallback(async (isAutoSave = false, force = false) => {
    // 基本检查：必须有 flowId，不能正在保存，不能是只读模式
    if (!flowId || isSaving || isReadOnly) {
      console.log('[AutoSave] 跳过保存:', { flowId, isSaving, isReadOnly })
      return
    }

    // 自动保存需要有脏数据，手动保存可以强制
    if (isAutoSave && !isDirty) {
      return
    }

    // 非强制模式下，没有脏数据则跳过
    if (!force && !isDirty) {
      console.log('[AutoSave] 没有需要保存的更改')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
      const provider = createBackendProvider({ baseUrl: backendUrl })

      await provider.saveVersion(flowId, {
        flow,
        isAutoSave,
        name: isAutoSave ? undefined : `手动保存 ${new Date().toLocaleTimeString('zh-CN')}`,
      })

      setIsDirty(false)
      setLastSaveTime(new Date())
      lastFlowHashRef.current = getFlowHash(flow)

      console.log(`[AutoSave] ${isAutoSave ? '自动' : '手动'}保存成功`)
    } catch (error) {
      console.error('[AutoSave] 保存失败:', error)
      setSaveError(error instanceof Error ? error.message : '保存失败')
    } finally {
      setIsSaving(false)
    }
  }, [flowId, isDirty, isSaving, isReadOnly, flow, setIsDirty, getFlowHash])

  // 手动保存（Ctrl+S）
  // 手动保存时强制保存，即使没有脏数据
  const save = useCallback(async () => {
    // 清除自动保存定时器
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = null
    }
    // isAutoSave=false, force=true 强制保存
    await saveVersion(false, true)
  }, [saveVersion])

  // 触发自动保存
  const triggerAutoSave = useCallback(() => {
    if (!enabled || isReadOnly) return

    // 清除之前的定时器
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current)
    }

    // 设置新的定时器
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      saveVersion(true)
    }, delay)
  }, [enabled, isReadOnly, delay, saveVersion])

  // 监听 flow 变化，触发自动保存
  useEffect(() => {
    if (!enabled || !flowId || isReadOnly) return

    const currentHash = getFlowHash(flow)
    if (currentHash === lastFlowHashRef.current) return

    // flow 发生变化，触发自动保存
    if (isDirty) {
      triggerAutoSave()
    }
  }, [flow, flowId, isDirty, enabled, isReadOnly, getFlowHash, triggerAutoSave])

  // 监听 Ctrl+S 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [])

  return {
    save,
    isSaving,
    lastSaveTime,
    saveError,
  }
}
