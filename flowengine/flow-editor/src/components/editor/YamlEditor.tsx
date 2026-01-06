/**
 * Professional YAML Editor Component
 *
 * 基于 Monaco Editor 的专业 YAML 编辑器，支持：
 * - 语法高亮和行号显示
 * - FDL/GML 规范感知
 * - 实时错误提示和位置标记
 * - 自动缩进和格式化
 * - 智能补全（FDL 关键字）
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import { useEditorStore } from '@/stores/editorStore'
import { useFlowStore } from '@/stores/flowStore'
import { flowToYaml, yamlToFlow } from '@/lib/flowYamlConverter'
import { createBackendProvider } from '@/lib/storage/backend-provider'

// 自动保存延迟时间（毫秒）
const AUTO_SAVE_DELAY = 1500

// FDL 关键字定义，用于自动补全
const FDL_KEYWORDS = {
  root: ['flow'],
  flow: ['name', 'desp', 'args', 'vars', 'node'],
  args: ['in', 'out', 'defs', 'entry'],
  node: [
    'name', 'desp', 'only', 'exec', 'args', 'with', 'sets',
    'when', 'then', 'else', 'case', 'wait', 'each', 'loop', 'vars',
    'agent', 'guard', 'approval', 'mcp', 'handoff', 'next', 'fail'
  ],
  types: ['string', 'number', 'boolean', 'object', 'array', 'date', 'int', 'float'],
  protocols: ['api://', 'db://', 'mcp://', 'flow://', 'agent://'],
}

// GML 关键字
const GML_KEYWORDS = [
  'true', 'false', 'null', 'if', 'else', 'for', 'in', 'map', 'filter',
  'reduce', 'find', 'some', 'every', 'keys', 'values', 'entries',
  'len', 'str', 'int', 'float', 'bool', 'now', 'date', 'json', 'yaml'
]

export function YamlEditor() {
  const { yamlContent, yamlError, setYamlContent, setYamlError, isSyncing, setIsSyncing, resolvedTheme } = useEditorStore()
  const { flow, setFlow, flowId, isDirty, setIsDirty } = useFlowStore()

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)
  const autoSaveTimeoutRef = useRef<number | null>(null)
  const isUserEditingRef = useRef(false)
  const lastFlowHashRef = useRef<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null)
  // 标记自定义主题是否已定义，避免初始渲染时使用未定义的主题
  const [themesReady, setThemesReady] = useState(false)

  // 生成 flow 的简单哈希，用于检测变化
  const getFlowHash = useCallback((f: typeof flow) => {
    return JSON.stringify({
      nodes: f.nodes.map(n => ({ id: n.id, type: n.type, data: n.data })),
      edges: f.edges.map(e => ({ id: e.id, source: e.source, target: e.target })),
      meta: f.meta,
    })
  }, [])

  // 从 flow 同步到 YAML（只在 flow 真正变化时）
  useEffect(() => {
    if (isSyncing || isUserEditingRef.current || yamlError) return

    const currentHash = getFlowHash(flow)
    if (currentHash === lastFlowHashRef.current) return

    lastFlowHashRef.current = currentHash
    const yaml = flowToYaml(flow)
    setYamlContent(yaml)
  }, [flow, isSyncing, yamlError, setYamlContent, getFlowHash])

  // 监听主题变化，更新 Monaco 编辑器主题
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const themeName = resolvedTheme === 'dark' ? 'fdl-dark' : 'fdl-light'
      monacoRef.current.editor.setTheme(themeName)
    }
  }, [resolvedTheme])

  // 自动保存功能（afterDelay 模式）
  const triggerAutoSave = useCallback(async () => {
    // 只有在有 flowId、有未保存的更改、没有错误、不在保存中时才触发
    if (!flowId || !isDirty || yamlError || isSaving) return

    setIsSaving(true)
    try {
      const backendUrl = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3001'
      const provider = createBackendProvider({ baseUrl: backendUrl })
      await provider.saveVersion(flowId, {
        flow,
        isAutoSave: true,
      })
      setIsDirty(false)
      setLastSaveTime(new Date())
    } catch (error) {
      console.error('Auto save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }, [flowId, isDirty, yamlError, isSaving, flow, setIsDirty])

  // 处理 YAML 内容变化
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!value) return

      isUserEditingRef.current = true
      setYamlContent(value)
      setIsSyncing(true)

      // 清除之前的同步定时器
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }

      // 清除之前的自动保存定时器
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current)
      }

      // 延迟解析，避免频繁解析
      syncTimeoutRef.current = window.setTimeout(() => {
        const { flow: newFlow, error } = yamlToFlow(value)
        if (error) {
          setYamlError(error)
          updateErrorMarkers(error, value)
        } else {
          setYamlError(null)
          clearErrorMarkers()
          lastFlowHashRef.current = getFlowHash(newFlow)
          setFlow(newFlow)
          isUserEditingRef.current = false

          // 设置自动保存定时器（afterDelay 模式）
          autoSaveTimeoutRef.current = window.setTimeout(() => {
            triggerAutoSave()
          }, AUTO_SAVE_DELAY)
        }
        setIsSyncing(false)
      }, 500)
    },
    [setYamlContent, setIsSyncing, setFlow, setYamlError, getFlowHash, triggerAutoSave]
  )

  // 更新错误标记
  const updateErrorMarkers = useCallback((error: string, content: string) => {
    if (!monacoRef.current || !editorRef.current) return

    const model = editorRef.current.getModel()
    if (!model) return

    // 尝试从错误信息中提取行号
    const lineMatch = error.match(/line\s*(\d+)/i) || error.match(/at\s*(\d+)/i)
    let lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : 1

    // 尝试从错误信息中提取列号
    const colMatch = error.match(/column\s*(\d+)/i) || error.match(/col\s*(\d+)/i)
    const column = colMatch ? parseInt(colMatch[1], 10) : 1

    // 确保行号有效
    const maxLines = model.getLineCount()
    lineNumber = Math.min(Math.max(1, lineNumber), maxLines)

    monacoRef.current.editor.setModelMarkers(model, 'fdl-validator', [
      {
        severity: monacoRef.current.MarkerSeverity.Error,
        message: error,
        startLineNumber: lineNumber,
        startColumn: column,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber),
      },
    ])
  }, [])

  // 清除错误标记
  const clearErrorMarkers = useCallback(() => {
    if (!monacoRef.current || !editorRef.current) return

    const model = editorRef.current.getModel()
    if (!model) return

    monacoRef.current.editor.setModelMarkers(model, 'fdl-validator', [])
  }, [])

  // 编辑器挂载
  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco

    // 注册 FDL/GML 自动补全
    monaco.languages.registerCompletionItemProvider('yaml', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        }

        const lineContent = model.getLineContent(position.lineNumber)
        const suggestions: ReturnType<typeof createSuggestions> = []

        // 根据上下文提供不同的补全
        if (lineContent.trim().startsWith('exec:') || lineContent.includes('exec:')) {
          // 协议补全
          suggestions.push(...FDL_KEYWORDS.protocols.map(protocol => ({
            label: protocol,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: protocol,
            range,
            detail: 'FDL Protocol',
          })))
        } else if (lineContent.match(/^\s*\w*:?\s*$/)) {
          // 节点属性补全
          const indent = lineContent.match(/^\s*/)?.[0].length || 0
          const keywords = indent === 0 ? FDL_KEYWORDS.root :
                          indent <= 4 ? FDL_KEYWORDS.flow :
                          indent <= 8 ? [...FDL_KEYWORDS.args, ...FDL_KEYWORDS.node] :
                          FDL_KEYWORDS.node

          suggestions.push(...keywords.map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw + ': ',
            range,
            detail: 'FDL Keyword',
          })))
        }

        // 类型补全
        if (lineContent.includes('type:') || lineContent.match(/:\s*\w*$/)) {
          suggestions.push(...FDL_KEYWORDS.types.map(type => ({
            label: type,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: type,
            range,
            detail: 'FDL Type',
          })))
        }

        // GML 关键字
        if (lineContent.includes('with:') || lineContent.includes('args:') ||
            lineContent.includes('when:') || lineContent.includes('sets:')) {
          suggestions.push(...GML_KEYWORDS.map(kw => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: kw,
            range,
            detail: 'GML Function',
          })))
        }

        return { suggestions }
      },
    })

    // 配置 YAML 语言
    monaco.languages.setLanguageConfiguration('yaml', {
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      indentationRules: {
        increaseIndentPattern: /^.*:(\s*|\s*#.*)?$/,
        decreaseIndentPattern: /^\s*$/,
      },
    })

    // 自定义 FDL Token 高亮
    monaco.editor.defineTheme('fdl-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '0066cc', fontStyle: 'bold' },
        { token: 'string', foreground: '008800' },
        { token: 'number', foreground: 'cc6600' },
        { token: 'comment', foreground: '888888', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#fafafa',
        'editor.lineHighlightBackground': '#f0f0f0',
        'editorLineNumber.foreground': '#999999',
        'editorLineNumber.activeForeground': '#333333',
      },
    })

    monaco.editor.defineTheme('fdl-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: '7cb7ff', fontStyle: 'bold' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'e5c07b' },
        { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': '#1e1e1e',
        'editor.lineHighlightBackground': '#2a2a2a',
        'editorLineNumber.foreground': '#666666',
        'editorLineNumber.activeForeground': '#cccccc',
      },
    })

    // 主题定义完成后，立即应用当前主题并标记就绪
    const themeName = resolvedTheme === 'dark' ? 'fdl-dark' : 'fdl-light'
    monaco.editor.setTheme(themeName)
    setThemesReady(true)
  }, [resolvedTheme])

  // 辅助函数：创建补全建议
  function createSuggestions(): Array<{
    label: string
    kind: ReturnType<typeof monacoRef.current extends Monaco ? Monaco['languages']['CompletionItemKind']['Keyword'] : never>
    insertText: string
    range: { startLineNumber: number; endLineNumber: number; startColumn: number; endColumn: number }
    detail: string
  }> {
    return []
  }

  // 图标组件
  const codeIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
    </svg>
  )

  const formatIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 21h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18v-2H3v2zm0-4h18V7H3v2zm0-6v2h18V3H3z"/>
    </svg>
  )

  // 格式化 YAML
  const handleFormat = useCallback(() => {
    if (!editorRef.current) return
    editorRef.current.getAction('editor.action.formatDocument')?.run()
  }, [])

  return (
    <div className="h-full w-full flex flex-col" style={{ background: 'var(--surface-container)' }}>
      {/* Header */}
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--outline-variant)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--on-surface-variant)' }}>{codeIcon}</span>
          <span className="text-sm font-medium" style={{ color: 'var(--on-surface)' }}>
            FDL YAML Editor
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'var(--secondary-container)',
              color: 'var(--on-secondary-container)',
            }}
          >
            Monaco
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* 格式化按钮 */}
          <button
            onClick={handleFormat}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all"
            style={{
              color: 'var(--on-surface-variant)',
              background: 'var(--surface-container-high)',
            }}
            title="格式化 (Shift+Alt+F)"
          >
            {formatIcon}
            格式化
          </button>

          {/* 保存状态 */}
          {isSaving && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--primary)' }}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              保存中...
            </span>
          )}

          {/* 最后保存时间 */}
          {!isSaving && lastSaveTime && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--on-surface-variant)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
              已保存 {lastSaveTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {/* 同步状态 */}
          {isSyncing && (
            <span className="flex items-center gap-2 text-xs" style={{ color: 'var(--primary)' }}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              同步中...
            </span>
          )}

          {/* 错误提示 */}
          {yamlError && (
            <span
              className="flex items-center gap-2 text-xs max-w-md truncate"
              style={{ color: 'var(--error)' }}
              title={yamlError}
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
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          language="yaml"
          value={yamlContent}
          onChange={handleEditorChange}
          onMount={handleEditorMount}
          // 初始使用标准主题，等自定义主题定义后再由 handleEditorMount 切换
          theme={themesReady
            ? (resolvedTheme === 'dark' ? 'fdl-dark' : 'fdl-light')
            : (resolvedTheme === 'dark' ? 'vs-dark' : 'vs')}
          options={{
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Menlo, Monaco, 'Courier New', monospace",
            lineNumbers: 'on',
            lineNumbersMinChars: 4,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            wrappingIndent: 'indent',
            tabSize: 4,
            insertSpaces: true,
            autoIndent: 'full',
            formatOnPaste: true,
            formatOnType: true,
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            padding: { top: 16, bottom: 16 },
            bracketPairColorization: { enabled: true },
            guides: {
              indentation: true,
              bracketPairs: true,
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
              showWords: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
          }}
        />
      </div>

      {/* Footer - 快捷键提示 */}
      <div
        className="px-4 py-2 flex items-center gap-4 text-xs"
        style={{
          borderTop: '1px solid var(--outline-variant)',
          color: 'var(--on-surface-variant)',
          background: 'var(--surface-container-low)',
        }}
      >
        <span>
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Ctrl</kbd>
          +
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>S</kbd>
          {' '}保存
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Ctrl</kbd>
          +
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Space</kbd>
          {' '}补全
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Ctrl</kbd>
          +
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Z</kbd>
          {' '}撤销
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Shift</kbd>
          +
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>Alt</kbd>
          +
          <kbd className="px-1 py-0.5 rounded" style={{ background: 'var(--surface-container-high)' }}>F</kbd>
          {' '}格式化
        </span>
      </div>
    </div>
  )
}
