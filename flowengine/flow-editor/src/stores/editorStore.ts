/**
 * Editor Store
 * State management for editor UI state
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

export type ViewMode = 'visual' | 'yaml' | 'split'
export type Theme = 'light' | 'dark' | 'system'
export type PanelPosition = 'left' | 'right' | 'bottom'

interface EditorState {
  // View mode
  viewMode: ViewMode

  // Theme
  theme: Theme
  resolvedTheme: 'light' | 'dark'

  // Panel visibility
  showNodePalette: boolean
  showPropertyPanel: boolean
  showMinimap: boolean
  showDebugPanel: boolean
  showVersionPanel: boolean

  // Panel sizes (pixels)
  nodePaletteWidth: number
  propertyPanelWidth: number
  versionPanelWidth: number
  debugPanelHeight: number
  yamlEditorWidth: number // for split mode

  // Editor settings
  showGrid: boolean
  snapToGrid: boolean
  gridSize: number
  autoLayout: boolean

  // YAML editor sync state
  yamlContent: string
  yamlError: string | null
  isSyncing: boolean

  // Zoom
  zoom: number
  minZoom: number
  maxZoom: number

  // Actions
  setViewMode: (mode: ViewMode) => void
  setTheme: (theme: Theme) => void
  setResolvedTheme: (theme: 'light' | 'dark') => void

  toggleNodePalette: () => void
  togglePropertyPanel: () => void
  toggleMinimap: () => void
  toggleDebugPanel: () => void
  toggleVersionPanel: () => void

  setNodePaletteWidth: (width: number) => void
  setPropertyPanelWidth: (width: number) => void
  setVersionPanelWidth: (width: number) => void
  setDebugPanelHeight: (height: number) => void
  setYamlEditorWidth: (width: number) => void

  setShowGrid: (show: boolean) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSize: (size: number) => void
  setAutoLayout: (auto: boolean) => void

  setYamlContent: (content: string) => void
  setYamlError: (error: string | null) => void
  setIsSyncing: (syncing: boolean) => void

  setZoom: (zoom: number) => void
}

export const useEditorStore = create<EditorState>()(
  immer((set) => ({
    // Initial state
    viewMode: 'visual',
    theme: 'system',
    resolvedTheme: 'light',

    showNodePalette: true,
    showPropertyPanel: true,
    showMinimap: true,
    showDebugPanel: false,
    showVersionPanel: false,

    nodePaletteWidth: 240,
    propertyPanelWidth: 320,
    versionPanelWidth: 300,
    debugPanelHeight: 200,
    yamlEditorWidth: 420,

    showGrid: true,
    snapToGrid: true,
    gridSize: 20,
    autoLayout: false,

    yamlContent: '',
    yamlError: null,
    isSyncing: false,

    zoom: 1,
    minZoom: 0.1,
    maxZoom: 2,

    // Actions
    setViewMode: (mode) =>
      set((state) => {
        state.viewMode = mode
      }),

    setTheme: (theme) =>
      set((state) => {
        state.theme = theme
      }),

    setResolvedTheme: (theme) =>
      set((state) => {
        state.resolvedTheme = theme
      }),

    toggleNodePalette: () =>
      set((state) => {
        state.showNodePalette = !state.showNodePalette
      }),

    togglePropertyPanel: () =>
      set((state) => {
        state.showPropertyPanel = !state.showPropertyPanel
      }),

    toggleMinimap: () =>
      set((state) => {
        state.showMinimap = !state.showMinimap
      }),

    toggleDebugPanel: () =>
      set((state) => {
        state.showDebugPanel = !state.showDebugPanel
      }),

    toggleVersionPanel: () =>
      set((state) => {
        state.showVersionPanel = !state.showVersionPanel
      }),

    setNodePaletteWidth: (width) =>
      set((state) => {
        state.nodePaletteWidth = Math.max(180, Math.min(400, width))
      }),

    setPropertyPanelWidth: (width) =>
      set((state) => {
        state.propertyPanelWidth = Math.max(280, Math.min(500, width))
      }),

    setVersionPanelWidth: (width) =>
      set((state) => {
        state.versionPanelWidth = Math.max(200, Math.min(400, width))
      }),

    setDebugPanelHeight: (height) =>
      set((state) => {
        state.debugPanelHeight = Math.max(100, Math.min(400, height))
      }),

    setYamlEditorWidth: (width) =>
      set((state) => {
        state.yamlEditorWidth = Math.max(300, Math.min(800, width))
      }),

    setShowGrid: (show) =>
      set((state) => {
        state.showGrid = show
      }),

    setSnapToGrid: (snap) =>
      set((state) => {
        state.snapToGrid = snap
      }),

    setGridSize: (size) =>
      set((state) => {
        state.gridSize = Math.max(10, Math.min(50, size))
      }),

    setAutoLayout: (auto) =>
      set((state) => {
        state.autoLayout = auto
      }),

    setYamlContent: (content) =>
      set((state) => {
        state.yamlContent = content
      }),

    setYamlError: (error) =>
      set((state) => {
        state.yamlError = error
      }),

    setIsSyncing: (syncing) =>
      set((state) => {
        state.isSyncing = syncing
      }),

    setZoom: (zoom) =>
      set((state) => {
        state.zoom = Math.max(state.minZoom, Math.min(state.maxZoom, zoom))
      }),
  }))
)

// Selector hooks
export const useViewMode = () => useEditorStore((state) => state.viewMode)
export const useTheme = () => useEditorStore((state) => state.theme)
export const useShowGrid = () => useEditorStore((state) => state.showGrid)
export const useZoom = () => useEditorStore((state) => state.zoom)
