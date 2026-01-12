/**
 * Flow Editor Page
 * Wrapper for the flow editor with flow loading from storage
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { useStorage } from '@/lib/storage'
import { useFlowStore } from '@/stores/flowStore'
import { EditorLayout } from '@/components/editor/EditorLayout'
import { migrateFlowModel } from '@/lib/flowYamlConverter'
import type { FlowModel } from '@/types/flow'

// Icons
const Icons = {
  loading: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="animate-spin">
      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>
  ),
  error: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
    </svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
}

/**
 * Default empty flow for new flows
 */
function createEmptyFlow(name: string = '新流程'): FlowModel {
  return {
    meta: {
      name,
      description: '',
    },
    args: {
      inputs: [],
      outputs: [],
    },
    nodes: [],
    edges: [],
  }
}

export function FlowEditorPage() {
  const { flowId, versionId } = useParams<{ flowId: string; versionId?: string }>()
  const navigate = useNavigate()
  const storage = useStorage()
  const { setFlow, setIsDirty, setReadOnly, loadFlow: storeLoadFlow } = useFlowStore()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [flowName, setFlowName] = useState('')
  const [isViewingVersion, setIsViewingVersion] = useState(false)
  const [viewingVersionName, setViewingVersionName] = useState('')

  // Load flow from storage
  useEffect(() => {
    async function loadFlow() {
      if (!flowId) {
        setError('流程 ID 不存在')
        setLoading(false)
        return
      }

      try {
        // Get flow entry
        const flowEntry = await storage.getFlow(flowId)
        if (!flowEntry) {
          setError('流程不存在')
          setLoading(false)
          return
        }

        setFlowName(flowEntry.name)

        // Check if viewing a specific version
        if (versionId) {
          const version = await storage.getVersion(flowId, versionId)
          if (!version) {
            setError('版本不存在')
            setLoading(false)
            return
          }

          // 迁移旧流程以修正节点类型
          const migratedFlow = migrateFlowModel(version.flow)
          setFlow(migratedFlow)
          setReadOnly(true, versionId)
          setIsViewingVersion(true)
          setViewingVersionName(version.name)
          setIsDirty(false)
        } else {
          // Get latest version
          const latestVersion = await storage.getLatestVersion(flowId)
          if (latestVersion) {
            // 迁移旧流程以修正节点类型
            const migratedFlow = migrateFlowModel(latestVersion.flow)
            storeLoadFlow(flowId, migratedFlow, flowEntry.name)
          } else {
            // New flow with no versions yet
            storeLoadFlow(flowId, createEmptyFlow(flowEntry.name), flowEntry.name)
          }
          setReadOnly(false)
          setIsViewingVersion(false)
        }

        setLoading(false)
      } catch (err) {
        setError(`加载流程失败: ${err}`)
        setLoading(false)
      }
    }

    loadFlow()
  }, [flowId, versionId, storage, setFlow, setIsDirty, setReadOnly, storeLoadFlow])

  const handleBack = useCallback(() => {
    navigate('/')
  }, [navigate])

  if (loading) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-dim)' }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--surface-container)' }}
          >
            {Icons.loading}
          </div>
          <p
            className="text-sm"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            加载流程中...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-dim)' }}
      >
        <div className="text-center">
          <div
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--error-container)' }}
          >
            <span style={{ color: 'var(--on-error-container)' }}>
              {Icons.error}
            </span>
          </div>
          <h2
            className="text-xl font-medium mb-2"
            style={{ color: 'var(--on-surface)' }}
          >
            加载失败
          </h2>
          <p
            className="text-sm mb-6"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            {error}
          </p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all mx-auto"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
            }}
          >
            {Icons.back}
            返回列表
          </button>
        </div>
      </div>
    )
  }

  const displayName = isViewingVersion
    ? `${flowName} - ${viewingVersionName} (只读)`
    : flowName

  return (
    <div className="h-screen w-screen overflow-hidden">
      <ReactFlowProvider>
        <EditorLayout
          flowId={flowId!}
          flowName={displayName}
          onBack={handleBack}
          isReadOnly={isViewingVersion}
          versionId={versionId}
        />
      </ReactFlowProvider>
    </div>
  )
}
