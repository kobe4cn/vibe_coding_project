/**
 * Flow Editor App
 * Material Design 3 Inspired Layout
 */

import { useCallback, useEffect, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { FlowCanvas } from '@/components/canvas/FlowCanvas'
import { NodePalette } from '@/components/panels/NodePalette'
import { PropertyPanel } from '@/components/panels/PropertyPanel'
import { DebugPanel } from '@/components/panels/DebugPanel'
import { VersionPanel } from '@/components/panels/VersionPanel'
import { ResizeHandle } from '@/components/ui/ResizeHandle'
import { useEditorStore } from '@/stores/editorStore'
import { useFlowStore } from '@/stores/flowStore'
import { flowToYaml, yamlToFlow } from '@/lib/flowYamlConverter'

// Material Design Icons (SVG paths)
const Icons = {
  // Theme icons
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
}

// Helper function to check if it's night time (6PM - 6AM)
function isNightTime(): boolean {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

function EditorLayout() {
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
      // System/Auto mode - based on time
      const updateThemeByTime = () => {
        setResolvedTheme(isNightTime() ? 'dark' : 'light')
      }

      updateThemeByTime()

      // Check every minute for time-based switching
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
      {/* Top Bar */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
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
        <main className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Canvas */}
          <div
            className="flex-1 flex gap-4 min-h-0 rounded-2xl overflow-hidden"
            style={{
              background: 'var(--surface-container-lowest)',
              boxShadow: 'var(--elevation-1)',
            }}
          >
            {viewMode === 'visual' && <FlowCanvas />}
            {viewMode === 'yaml' && <YamlEditor />}
            {viewMode === 'split' && (
              <>
                <div className="flex-1 min-w-0">
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

          {/* Debug Panel - hidden in YAML mode */}
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
        {/* Property Panel - hidden in YAML mode */}
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

        {/* Version Panel - always visible when enabled */}
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
              <VersionPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  )
}

function Header() {
  const { isDirty, flow } = useFlowStore()
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

  // Cycle through themes: system -> light -> dark -> system
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

  return (
    <header
      className="flex items-center justify-between px-6 py-3 rounded-2xl"
      style={{
        background: 'var(--surface-container)',
        boxShadow: 'var(--elevation-1)',
      }}
    >
      {/* Left - Logo & Title */}
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
            className="text-base font-medium flex items-center gap-2"
            style={{ color: 'var(--on-surface)' }}
          >
            {flow.meta.name}
            {isDirty && (
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: 'var(--tertiary)' }}
              />
            )}
          </h1>
          <p
            className="text-xs"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            Flow Definition Language
          </p>
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
        {/* Panel Toggles */}
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

        {/* Theme Toggle */}
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

        {/* Divider */}
        <div
          className="w-px h-8"
          style={{ background: 'var(--outline-variant)' }}
        />

        {/* Action Buttons */}
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

function YamlEditor() {
  const { yamlContent, yamlError, setYamlContent, setYamlError, isSyncing, setIsSyncing } = useEditorStore()
  const { flow, setFlow } = useFlowStore()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const syncTimeoutRef = useRef<number | null>(null)
  // Track if user is actively editing to prevent content reset
  const isUserEditingRef = useRef(false)

  useEffect(() => {
    // Don't overwrite content if user is editing or syncing, or if there's an error
    if (isSyncing || isUserEditingRef.current || yamlError) return
    const yaml = flowToYaml(flow)
    setYamlContent(yaml)
  }, [flow, isSyncing, yamlError, setYamlContent])

  const handleYamlChange = useCallback(
    (newContent: string) => {
      isUserEditingRef.current = true
      setYamlContent(newContent)
      setIsSyncing(true)

      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }

      syncTimeoutRef.current = window.setTimeout(() => {
        const { flow: newFlow, error } = yamlToFlow(newContent)
        if (error) {
          setYamlError(error)
        } else {
          setYamlError(null)
          setFlow(newFlow)
          // Only stop user editing mode when successfully synced
          isUserEditingRef.current = false
        }
        setIsSyncing(false)
      }, 500)
    },
    [setYamlContent, setIsSyncing, setFlow, setYamlError]
  )

  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--surface-container)' }}>
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--on-surface-variant)' }}>{Icons.code}</span>
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--on-surface)' }}
          >
            YAML Editor
          </span>
        </div>
        <div className="flex items-center gap-4">
          {isSyncing && (
            <span
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--primary)' }}
            >
              <span className="w-2 h-2 rounded-full bg-current animate-md-pulse" />
              Syncing...
            </span>
          )}
          {yamlError && (
            <span
              className="flex items-center gap-2 text-xs"
              style={{ color: 'var(--error)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {yamlError}
            </span>
          )}
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={yamlContent}
        onChange={(e) => handleYamlChange(e.target.value)}
        className="flex-1 p-5 font-mono text-sm resize-none focus:outline-none"
        style={{
          background: yamlError ? 'var(--error-container)' : 'var(--surface-container-low)',
          color: yamlError ? 'var(--on-error)' : 'var(--on-surface)',
          border: 'none',
        }}
        placeholder="# FDL YAML content..."
        spellCheck={false}
      />
    </div>
  )
}

export default function App() {
  return (
    <ReactFlowProvider>
      <EditorLayout />
    </ReactFlowProvider>
  )
}
