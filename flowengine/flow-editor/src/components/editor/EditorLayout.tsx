/**
 * Editor Layout Component
 * Material Design 3 Inspired Layout for the Flow Editor
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { NodePalette } from '@/components/panels/NodePalette'
import { PropertyPanel } from '@/components/panels/PropertyPanel'
import { DebugPanel } from '@/components/panels/DebugPanel'
import { VersionPanel } from '@/components/panels/VersionPanel'
import { ExecutePanel } from '@/components/panels/ExecutePanel'
import { InputsDialog } from '@/components/dialogs/InputsDialog'
import { PublishDialog } from '@/components/dialogs/PublishDialog'
import { SettingsDialog } from '@/components/settings'
import { ResizeHandle } from '@/components/ui/ResizeHandle'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { YamlEditor } from '@/components/editor/YamlEditor'
import { useEditorStore } from '@/stores/editorStore'
import { useFlowStore } from '@/stores/flowStore'
import { useExecuteStore } from '@/stores/executeStore'
import { useAutoSave } from '@/hooks/useAutoSave'
import { flowToYaml } from '@/lib/flowYamlConverter'

// Material Design Icons
const Icons = {
  lightMode: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/>
    </svg>
  ),
  darkMode: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/>
    </svg>
  ),
  autoMode: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  ),
  bolt: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
    </svg>
  ),
  widgets: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z"/>
    </svg>
  ),
  tune: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/>
    </svg>
  ),
  bugReport: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 8h-2.81c-.45-.78-1.07-1.45-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z"/>
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
    </svg>
  ),
  viewModule: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 11h5V5H4v6zm0 7h5v-6H4v6zm6 0h5v-6h-5v6zm6 0h5v-6h-5v6zm-6-7h5V5h-5v6zm6-6v6h5V5h-5z"/>
    </svg>
  ),
  code: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>
  ),
  splitscreen: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 4v5H6V4h12m0-2H6c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 13v5H6v-5h12m0-2H6c-1.1 0-2 .9-2 2v5c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-5c0-1.1-.9-2-2-2z"/>
    </svg>
  ),
  contentCopy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
  ),
  download: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7 7-7z"/>
    </svg>
  ),
  back: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
    </svg>
  ),
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  visibility: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  playArrow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
    </svg>
  ),
  publish: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
}

// Helper function to check if it's night time (6PM - 6AM)
function isNightTime(): boolean {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

interface EditorLayoutProps {
  flowId: string
  flowName: string
  onBack: () => void
  isReadOnly?: boolean
  versionId?: string
}

export function EditorLayout({ flowId, flowName, onBack, isReadOnly = false, versionId: _versionId }: EditorLayoutProps) {
  const navigate = useNavigate()
  const {
    showNodePalette,
    showPropertyPanel,
    showDebugPanel,
    showVersionPanel,
    nodePaletteWidth,
    propertyPanelWidth,
    versionPanelWidth,
    debugPanelHeight,
    yamlEditorWidth,
    viewMode,
    theme,
    resolvedTheme,
    setResolvedTheme,
    setNodePaletteWidth,
    setPropertyPanelWidth,
    setVersionPanelWidth,
    setDebugPanelHeight,
    setYamlEditorWidth,
  } = useEditorStore()
  const { undo, redo } = useFlowStore()

  // 自动保存 hook - 处理 Ctrl+S 和 afterDelay 自动保存
  const { isSaving, lastSaveTime, saveError } = useAutoSave({
    enabled: !isReadOnly,
  })

  // Exit preview mode
  const handleExitPreview = useCallback(() => {
    navigate(`/editor/${flowId}`)
  }, [navigate, flowId])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // Handle theme changes and auto-switching
  useEffect(() => {
    if (theme === 'light') {
      setResolvedTheme('light')
    } else if (theme === 'dark') {
      setResolvedTheme('dark')
    } else {
      const updateThemeByTime = () => {
        setResolvedTheme(isNightTime() ? 'dark' : 'light')
      }

      updateThemeByTime()
      const interval = setInterval(updateThemeByTime, 60000)
      return () => clearInterval(interval)
    }
  }, [theme, setResolvedTheme])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return (
    <div
      className="h-full w-full flex flex-col gap-4"
      style={{ background: 'var(--surface-dim)' }}
    >
      {/* Preview Mode Banner */}
      {isReadOnly && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-xl mx-4 mt-4 mb-0"
          style={{
            background: 'var(--tertiary-container)',
            color: 'var(--on-tertiary-container)',
          }}
        >
          <div className="flex items-center gap-3">
            {Icons.visibility}
            <span className="text-sm font-medium">
              正在预览历史版本 (只读模式)
            </span>
          </div>
          <button
            onClick={handleExitPreview}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: 'var(--tertiary)',
              color: 'var(--on-tertiary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1'
            }}
          >
            {Icons.close}
            退出预览
          </button>
        </div>
      )}

      {/* Top Bar */}
      <Header
        flowId={flowId}
        flowName={flowName}
        onBack={onBack}
        isSaving={isSaving}
        lastSaveTime={lastSaveTime}
        saveError={saveError}
      />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0 h-full">
        {/* Left Panel - Node Palette */}
        {showNodePalette && viewMode !== 'yaml' && (
          <>
            <aside
              className="flex-shrink-0 rounded-2xl"
              style={{
                width: nodePaletteWidth,
                background: 'var(--surface-container)',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              <NodePalette />
            </aside>
            <ResizeHandle
              direction="horizontal"
              onResize={(delta) => setNodePaletteWidth(nodePaletteWidth + delta)}
            />
          </>
        )}

        {/* Center - Canvas Area */}
        <main className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 h-full">
          {/* Canvas */}
          <div
            className="flex-1 flex gap-4 h-full min-h-0 rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--elevation-1)',
            }}
          >
            {viewMode === 'visual' && (
              <div className="flex-1 h-full min-w-0">
                <FlowCanvas />
              </div>
            )}
            {viewMode === 'yaml' && <YamlEditor />}
            {viewMode === 'split' && (
              <>
                <div className="flex-1 h-full min-w-0">
                  <FlowCanvas />
                </div>
                <ResizeHandle
                  direction="horizontal"
                  onResize={(delta) => setYamlEditorWidth(yamlEditorWidth + delta)}
                />
                <div
                  className="flex-shrink-0"
                  style={{
                    width: yamlEditorWidth,
                    borderLeft: '1px solid var(--outline-variant)',
                  }}
                >
                  <YamlEditor />
                </div>
              </>
            )}
          </div>

          {/* Debug Panel */}
          {showDebugPanel && viewMode !== 'yaml' && (
            <>
              <ResizeHandle
                direction="vertical"
                onResize={(delta) => setDebugPanelHeight(debugPanelHeight - delta)}
              />
              <div
                className="flex-shrink-0 rounded-2xl overflow-hidden"
                style={{
                  height: debugPanelHeight,
                  background: 'var(--surface-container)',
                  boxShadow: 'var(--elevation-1)',
                }}
              >
                <DebugPanel />
              </div>
            </>
          )}
        </main>

        {/* Right Panels */}
        {showPropertyPanel && viewMode !== 'yaml' && (
          <>
            <ResizeHandle
              direction="horizontal"
              onResize={(delta) => setPropertyPanelWidth(propertyPanelWidth - delta)}
            />
            <aside
              className="flex-shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: propertyPanelWidth,
                background: 'var(--surface-container)',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              <PropertyPanel />
            </aside>
          </>
        )}

        {showVersionPanel && (
          <>
            <ResizeHandle
              direction="horizontal"
              onResize={(delta) => setVersionPanelWidth(versionPanelWidth - delta)}
            />
            <aside
              className="flex-shrink-0 rounded-2xl overflow-hidden"
              style={{
                width: versionPanelWidth,
                background: 'var(--surface-container)',
                boxShadow: 'var(--elevation-1)',
              }}
            >
              <VersionPanel flowId={flowId} />
            </aside>
          </>
        )}

        {/* Execute Results Panel */}
        <ExecuteResultsPanel />
      </div>
    </div>
  )
}

function ExecuteResultsPanel() {
  const { showResultsPanel } = useExecuteStore()

  if (!showResultsPanel) return null

  return (
    <>
      <ResizeHandle direction="horizontal" onResize={() => {}} />
      <aside
        className="flex-shrink-0 rounded-2xl overflow-hidden"
        style={{
          width: 360,
          background: 'var(--surface-container)',
          boxShadow: 'var(--elevation-1)',
        }}
      >
        <ExecutePanel />
      </aside>
    </>
  )
}

interface HeaderProps {
  flowId: string
  flowName: string
  onBack: () => void
  isSaving?: boolean
  lastSaveTime?: Date | null
  saveError?: string | null
}

function Header({ flowId, flowName, onBack, isSaving, lastSaveTime, saveError }: HeaderProps) {
  const { isDirty, flow, isReadOnly } = useFlowStore()
  const {
    toggleNodePalette,
    togglePropertyPanel,
    toggleDebugPanel,
    toggleVersionPanel,
    showNodePalette,
    showPropertyPanel,
    showDebugPanel,
    showVersionPanel,
    viewMode,
    setViewMode,
    theme,
    setTheme,
  } = useEditorStore()
  const {
    state: executeState,
    execute,
    openResultsPanel,
    prepareExecution,
    showInputsDialog,
    closeInputsDialog,
    parameterDefs,
    setInputs,
  } = useExecuteStore()
  const [showSettings, setShowSettings] = useState(false)
  const [showPublish, setShowPublish] = useState(false)

  const cycleTheme = useCallback(() => {
    const themeOrder = ['system', 'light', 'dark'] as const
    const currentIndex = themeOrder.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themeOrder.length
    setTheme(themeOrder[nextIndex])
  }, [theme, setTheme])

  const getThemeIcon = () => {
    if (theme === 'light') return Icons.lightMode
    if (theme === 'dark') return Icons.darkMode
    return Icons.autoMode
  }

  const getThemeTooltip = () => {
    if (theme === 'light') return '浅色模式'
    if (theme === 'dark') return '深色模式'
    return '自动模式 (根据时间)'
  }

  const handleSave = useCallback(() => {
    const yamlContent = flowToYaml(flow)
    const blob = new Blob([yamlContent], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${flow.meta.name || 'flow'}.yaml`
    a.click()
    URL.revokeObjectURL(url)
  }, [flow])

  const handleExport = useCallback(() => {
    const yamlContent = flowToYaml(flow)
    navigator.clipboard.writeText(yamlContent)
  }, [flow])

  const handleExecute = useCallback(() => {
    if (executeState === 'running') {
      openResultsPanel()
    } else {
      prepareExecution(flow)
    }
  }, [executeState, prepareExecution, flow, openResultsPanel])

  const handleExecuteWithInputs = useCallback((inputs: Record<string, unknown>) => {
    setInputs(inputs)
    closeInputsDialog()
    execute(flow)
  }, [setInputs, closeInputsDialog, execute, flow])

  return (
    <header
      className="flex items-center justify-between px-6 py-3 rounded-2xl"
      style={{
        background: 'var(--surface-container)',
        boxShadow: 'var(--elevation-1)',
      }}
    >
      {/* Left - Back, Logo & Breadcrumb */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg transition-all"
          style={{
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)',
          }}
          title="返回列表"
        >
          {Icons.back}
        </button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--primary-container) 0%, var(--secondary-container) 100%)',
            color: 'var(--on-primary-container)',
          }}
        >
          {Icons.bolt}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Breadcrumb
              items={[
                { label: '流程列表', href: '/' },
                { label: flowName || flow.meta.name },
              ]}
            />
            {isDirty && !isSaving && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: 'var(--tertiary)' }}
                title="有未保存的更改"
              />
            )}
            {isSaving && (
              <span
                className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'var(--primary-container)', color: 'var(--on-primary-container)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                保存中...
              </span>
            )}
            {!isDirty && !isSaving && lastSaveTime && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--on-surface-variant)' }}
                title={`最后保存于 ${lastSaveTime.toLocaleString('zh-CN')}`}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                已保存
              </span>
            )}
            {saveError && (
              <span
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--error)' }}
                title={saveError}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                保存失败
              </span>
            )}
          </div>
          <p
            className="text-xs"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            Flow Definition Language</p>
        </div>
      </div>

      {/* Center - View Mode Tabs */}
      <div
        className="flex items-center p-1 rounded-xl gap-1"
        style={{ background: 'var(--surface-container-high)' }}
      >
        <ViewModeTab
          active={viewMode === 'visual'}
          onClick={() => setViewMode('visual')}
          icon={Icons.viewModule}
          label="Visual"
        />
        <ViewModeTab
          active={viewMode === 'yaml'}
          onClick={() => setViewMode('yaml')}
          icon={Icons.code}
          label="YAML"
        />
        <ViewModeTab
          active={viewMode === 'split'}
          onClick={() => setViewMode('split')}
          icon={Icons.splitscreen}
          label="Split"
        />
      </div>

      {/* Right - Panel Toggles & Actions */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center p-1 rounded-xl gap-1"
          style={{ background: 'var(--surface-container-high)' }}
        >
          <IconButton
            active={showNodePalette}
            onClick={toggleNodePalette}
            icon={Icons.widgets}
            tooltip="Nodes"
          />
          <IconButton
            active={showPropertyPanel}
            onClick={togglePropertyPanel}
            icon={Icons.tune}
            tooltip="Properties"
          />
          <IconButton
            active={showDebugPanel}
            onClick={toggleDebugPanel}
            icon={Icons.bugReport}
            tooltip="Debug"
          />
          <IconButton
            active={showVersionPanel}
            onClick={toggleVersionPanel}
            icon={Icons.history}
            tooltip="History"
          />
        </div>

        <button
          onClick={cycleTheme}
          title={getThemeTooltip()}
          className="p-2 rounded-lg transition-all"
          style={{
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-highest)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-high)'
          }}
        >
          {getThemeIcon()}
        </button>

        <button
          onClick={() => setShowSettings(true)}
          title="设置"
          className="p-2 rounded-lg transition-all"
          style={{
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-highest)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-high)'
          }}
        >
          {Icons.settings}
        </button>

        <div
          className="w-px h-8"
          style={{ background: 'var(--outline-variant)' }}
        />

        {/* Settings Dialog */}
        <SettingsDialog
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          initialTab="storage"
        />

        {/* Inputs Dialog */}
        <InputsDialog
          isOpen={showInputsDialog}
          onClose={closeInputsDialog}
          onExecute={handleExecuteWithInputs}
          parameters={parameterDefs}
          flowName={flow.meta.name}
        />

        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--surface-container-high)',
            color: 'var(--on-surface-variant)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-highest)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface-container-high)'
          }}
        >
          {Icons.contentCopy}
          Copy
        </button>
        {!isReadOnly && (
          <button
            onClick={handleExecute}
            disabled={executeState === 'running'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: executeState === 'running' ? 'var(--tertiary)' : 'var(--secondary)',
              color: executeState === 'running' ? 'var(--on-tertiary)' : 'var(--on-secondary)',
              opacity: executeState === 'running' ? 0.8 : 1,
            }}
            onMouseEnter={(e) => {
              if (executeState !== 'running') {
                e.currentTarget.style.opacity = '0.9'
              }
            }}
            onMouseLeave={(e) => {
              if (executeState !== 'running') {
                e.currentTarget.style.opacity = '1'
              }
            }}
            title={executeState === 'running' ? '执行中...' : '执行流程'}
          >
            {Icons.playArrow}
            {executeState === 'running' ? '执行中' : '执行'}
          </button>
        )}
        <button
          onClick={() => setShowPublish(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--tertiary-container)',
            color: 'var(--on-tertiary-container)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          title="发布管理"
        >
          {Icons.publish}
          发布
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--primary)',
            color: 'var(--on-primary)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.9'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          {Icons.download}
          Download
        </button>
      </div>

      {/* Publish Dialog */}
      <PublishDialog
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
        flowId={flowId}
        flowName={flow.meta.name}
      />
    </header>
  )
}

function ViewModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: active ? 'var(--primary-container)' : 'transparent',
        color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

function IconButton({
  active,
  onClick,
  icon,
  tooltip,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  tooltip: string
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="p-2 rounded-lg transition-all"
      style={{
        background: active ? 'var(--primary-container)' : 'transparent',
        color: active ? 'var(--on-primary-container)' : 'var(--on-surface-variant)',
      }}
    >
      {icon}
    </button>
  )
}

