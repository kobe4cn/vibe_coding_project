/**
 * Canvas Toolbar Component
 * Provides canvas controls and actions
 */

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useFlowStore } from '@/stores/flowStore'
import { useEditorStore } from '@/stores/editorStore'

export function Toolbar() {
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const { undo, redo, history, historyIndex } = useFlowStore()
  const {
    showGrid,
    setShowGrid,
    snapToGrid,
    setSnapToGrid,
    showMinimap,
    toggleMinimap,
    viewMode,
    setViewMode,
    zoom,
  } = useEditorStore()

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < history.length - 1

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 })
  }, [fitView])

  return (
    <div className="flex items-center gap-1 bg-white rounded-lg shadow-md p-1">
      {/* Zoom controls */}
      <div className="flex items-center border-r pr-1 mr-1">
        <button
          onClick={() => zoomOut()}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="缩小"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <span className="px-1.5 text-xs text-gray-600 font-medium min-w-[40px] text-center" title="当前缩放比例">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => zoomIn()}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="放大"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button
          onClick={handleFitView}
          className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
          title="适应画布"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>

      {/* Undo/Redo */}
      <div className="flex items-center border-r pr-1 mr-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-1.5 rounded ${canUndo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`}
          title="撤销 (Ctrl+Z)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-1.5 rounded ${canRedo ? 'hover:bg-gray-100 text-gray-600' : 'text-gray-300'}`}
          title="重做 (Ctrl+Y)"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"
            />
          </svg>
        </button>
      </div>

      {/* Grid toggle */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className={`p-1.5 rounded ${showGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
        title="显示网格"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM9 4v16M15 4v16M4 9h16M4 15h16"
          />
        </svg>
      </button>

      {/* Snap to grid toggle */}
      <button
        onClick={() => setSnapToGrid(!snapToGrid)}
        className={`p-1.5 rounded ${snapToGrid ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
        title="吸附网格"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
          />
        </svg>
      </button>

      {/* Minimap toggle */}
      <button
        onClick={toggleMinimap}
        className={`p-1.5 rounded ${showMinimap ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}
        title="显示小地图"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      </button>

      {/* View mode */}
      <div className="flex items-center border-l pl-1 ml-1">
        <button
          onClick={() => setViewMode('visual')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'visual' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          可视化
        </button>
        <button
          onClick={() => setViewMode('yaml')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'yaml' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          YAML
        </button>
        <button
          onClick={() => setViewMode('split')}
          className={`px-2 py-1 text-xs rounded ${viewMode === 'split' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
        >
          分屏
        </button>
      </div>
    </div>
  )
}
