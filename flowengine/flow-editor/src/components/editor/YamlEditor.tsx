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
import {
  validateGMLInYaml,
  getGMLCompletions,
  getGMLHover,
  getGMLRegions,
  type YAMLGMLDiagnostic,
} from '@/lib/gmlLanguageService'

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

// GML 关键字和函数现在通过 gmlLanguageService 动态提供

export function YamlEditor() {
  const { yamlContent, yamlError, setYamlContent, setYamlError, isSyncing, setIsSyncing, resolvedTheme } = useEditorStore()
  const { flow, setFlow } = useFlowStore()

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const syncTimeoutRef = useRef<number | null>(null)
  const isUserEditingRef = useRef(false)
  const lastFlowHashRef = useRef<string>('')
  // GML 区域装饰 ID 存储
  const gmlDecorationsRef = useRef<string[]>([])
  // 标记自定义主题是否已定义，避免初始渲染时使用未定义的主题
  const [themesReady, setThemesReady] = useState(false)
  // GML 诊断信息存储
  const [gmlDiagnostics, setGmlDiagnostics] = useState<YAMLGMLDiagnostic[]>([])

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

  // 更新 GML 区域装饰（语法高亮背景）
  // 需要在 handleEditorChange 之前定义
  const updateGMLDecorations = useCallback((content: string) => {
    if (!editorRef.current) return

    const regions = getGMLRegions(content)

    // 创建装饰数组
    const decorations: editor.IModelDeltaDecoration[] = regions.map(region => ({
      range: {
        startLineNumber: region.startLine,
        startColumn: region.startColumn,
        endLineNumber: region.endLine,
        endColumn: region.endColumn,
      },
      options: {
        isWholeLine: false,
        inlineClassName: 'gml-expression-highlight',
        glyphMarginClassName: 'gml-glyph-margin',
        hoverMessage: { value: `**GML 表达式** (${region.fieldName})` },
      },
    }))

    gmlDecorationsRef.current = editorRef.current.deltaDecorations(
      gmlDecorationsRef.current,
      decorations
    )
  }, [])

  // 处理 YAML 内容变化
  // 注意：自动保存由 useAutoSave hook 统一处理
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

      // 延迟解析，避免频繁解析
      syncTimeoutRef.current = window.setTimeout(() => {
        const { flow: newFlow, error } = yamlToFlow(value)
        if (error) {
          setYamlError(error)
          setGmlDiagnostics([])
          updateErrorMarkers(error, [])
        } else {
          // YAML 解析成功后，进行 GML 语法验证
          const diagnostics = validateGMLInYaml(value)
          setGmlDiagnostics(diagnostics)

          // 更新 GML 区域装饰（语法高亮）
          updateGMLDecorations(value)

          if (diagnostics.length > 0) {
            // 有 GML 错误时显示第一个错误，但不阻止 flow 同步
            setYamlError(diagnostics[0].friendlyMessage)
            updateErrorMarkers(null, diagnostics)
          } else {
            setYamlError(null)
            clearErrorMarkers()
          }

          lastFlowHashRef.current = getFlowHash(newFlow)
          setFlow(newFlow)
          isUserEditingRef.current = false
        }
        setIsSyncing(false)
      }, 500)
    },
    [setYamlContent, setIsSyncing, setFlow, setYamlError, getFlowHash, updateGMLDecorations]
  )

  // 更新错误标记 - 支持 YAML 错误和 GML 诊断
  const updateErrorMarkers = useCallback((
    yamlError: string | null,
    gmlDiags: YAMLGMLDiagnostic[]
  ) => {
    if (!monacoRef.current || !editorRef.current) return

    const model = editorRef.current.getModel()
    if (!model) return

    const markers: Parameters<typeof monacoRef.current.editor.setModelMarkers>[2] = []
    const maxLines = model.getLineCount()

    // 处理 YAML 错误
    if (yamlError) {
      const lineMatch = yamlError.match(/line\s*(\d+)/i) || yamlError.match(/at\s*(\d+)/i)
      let lineNumber = lineMatch ? parseInt(lineMatch[1], 10) : 1
      const colMatch = yamlError.match(/column\s*(\d+)/i) || yamlError.match(/col\s*(\d+)/i)
      const column = colMatch ? parseInt(colMatch[1], 10) : 1
      lineNumber = Math.min(Math.max(1, lineNumber), maxLines)

      markers.push({
        severity: monacoRef.current.MarkerSeverity.Error,
        message: yamlError,
        startLineNumber: lineNumber,
        startColumn: column,
        endLineNumber: lineNumber,
        endColumn: model.getLineMaxColumn(lineNumber),
      })
    }

    // 处理 GML 诊断信息
    for (const diag of gmlDiags) {
      const startLine = Math.min(Math.max(1, diag.yamlStartLine), maxLines)
      const endLine = Math.min(Math.max(1, diag.yamlEndLine), maxLines)

      // 根据严重程度映射 Monaco 的 MarkerSeverity
      let severity = monacoRef.current.MarkerSeverity.Error
      if (diag.severity === 'warning') {
        severity = monacoRef.current.MarkerSeverity.Warning
      } else if (diag.severity === 'info') {
        severity = monacoRef.current.MarkerSeverity.Info
      }

      markers.push({
        severity,
        message: diag.friendlyMessage,
        startLineNumber: startLine,
        startColumn: diag.yamlStartColumn,
        endLineNumber: endLine,
        endColumn: diag.yamlEndColumn,
        // 附加 Quick Fix 建议信息
        code: diag.code,
        source: 'GML',
      })
    }

    monacoRef.current.editor.setModelMarkers(model, 'fdl-validator', markers)
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
      provideCompletionItems: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
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

        // GML 智能补全 - 使用语言服务
        const isGMLContext = lineContent.includes('with:') ||
                            lineContent.includes('args:') ||
                            lineContent.includes('when:') ||
                            lineContent.includes('sets:') ||
                            lineContent.includes('each:') ||
                            lineContent.includes('vars:') ||
                            lineContent.includes('only:')

        if (isGMLContext) {
          // 获取触发字符
          const textBeforeCursor = lineContent.substring(0, position.column - 1)
          const triggerChar = textBeforeCursor.slice(-1)

          // 使用语言服务获取 GML 补全
          const gmlCompletions = getGMLCompletions(
            model.getValue(),
            position.lineNumber,
            position.column,
            triggerChar === '.' ? '.' : undefined
          )

          suggestions.push(...gmlCompletions.map(item => {
            let kind = monaco.languages.CompletionItemKind.Function
            if (item.kind === 'method') kind = monaco.languages.CompletionItemKind.Method
            if (item.kind === 'variable') kind = monaco.languages.CompletionItemKind.Variable
            if (item.kind === 'keyword') kind = monaco.languages.CompletionItemKind.Keyword
            if (item.kind === 'property') kind = monaco.languages.CompletionItemKind.Property

            return {
              label: item.label,
              kind,
              insertText: item.insertText,
              range,
              detail: item.detail ?? '',
              documentation: item.documentation,
              sortText: String(item.sortOrder ?? 0).padStart(5, '0'),
            }
          }))
        }

        return { suggestions }
      },
    })

    // 注册 GML 悬浮提示
    monaco.languages.registerHoverProvider('yaml', {
      provideHover: (model: editor.ITextModel, position: { lineNumber: number; column: number }) => {
        const word = model.getWordAtPosition(position)
        if (!word) return null

        const hoverInfo = getGMLHover(
          model.getValue(),
          position.lineNumber,
          position.column,
          word.word
        )

        if (!hoverInfo) return null

        return {
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          },
          contents: [
            { value: hoverInfo.contents }
          ],
        }
      },
    })

    // 注册 GML Quick Fix（代码操作）
    monaco.languages.registerCodeActionProvider('yaml', {
      provideCodeActions: (
        model: editor.ITextModel,
        _range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number },
        context: { markers: { source?: string; code?: string | number; startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }[] }
      ) => {
        const actions: { title: string; kind: string; edit: { edits: { resource: unknown; textEdit: { range: unknown; text: string } }[] } }[] = []

        // 获取当前位置的诊断信息
        const markers = context.markers

        for (const marker of markers) {
          // 只处理 GML 相关的诊断
          if (marker.source !== 'GML') continue

          // 根据错误代码提供特定的 Quick Fix
          const code = marker.code as string

          // GML001: 双引号改单引号
          if (code === 'GML001') {
            const lineContent = model.getLineContent(marker.startLineNumber)
            // 查找双引号并替换为单引号
            const fixedLine = lineContent.replace(/"/g, "'")
            if (fixedLine !== lineContent) {
              actions.push({
                title: '将双引号替换为单引号',
                kind: 'quickfix',
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: {
                        startLineNumber: marker.startLineNumber,
                        startColumn: 1,
                        endLineNumber: marker.startLineNumber,
                        endColumn: lineContent.length + 1,
                      },
                      text: fixedLine,
                    },
                  }],
                },
              })
            }
          }

          // GML002: 冒号改等号
          if (code === 'GML002') {
            const lineContent = model.getLineContent(marker.startLineNumber)
            // 在 GML 上下文中将对象字面量的冒号改为等号
            const fixedLine = lineContent.replace(/(\w+)\s*:\s*(?=[^/])/g, '$1 = ')
            if (fixedLine !== lineContent) {
              actions.push({
                title: '将 : 替换为 =',
                kind: 'quickfix',
                edit: {
                  edits: [{
                    resource: model.uri,
                    textEdit: {
                      range: {
                        startLineNumber: marker.startLineNumber,
                        startColumn: 1,
                        endLineNumber: marker.startLineNumber,
                        endColumn: lineContent.length + 1,
                      },
                      text: fixedLine,
                    },
                  }],
                },
              })
            }
          }
        }

        return { actions, dispose: () => {} }
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
      {/* GML 高亮样式 */}
      <style>{`
        .gml-expression-highlight {
          background-color: rgba(100, 149, 237, 0.15);
          border-radius: 2px;
        }
        .monaco-editor.vs-dark .gml-expression-highlight {
          background-color: rgba(100, 149, 237, 0.2);
        }
        .gml-glyph-margin {
          background-color: #6495ed;
          width: 3px !important;
          margin-left: 2px;
          border-radius: 1px;
        }
      `}</style>
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
              title={gmlDiagnostics.length > 0
                ? gmlDiagnostics.map(d => d.friendlyMessage).join('\n')
                : yamlError}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {gmlDiagnostics.length > 1 ? (
                <span>
                  {yamlError}
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{
                      background: 'var(--error-container)',
                      color: 'var(--on-error-container)',
                    }}
                  >
                    +{gmlDiagnostics.length - 1} 个错误
                  </span>
                </span>
              ) : yamlError}
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
