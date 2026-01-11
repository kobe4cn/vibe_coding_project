/**
 * GML Language Service
 *
 * 提供 GML 语言的语法检查、自动补全、悬浮提示等功能。
 * 作为 YAML 编辑器与 GML 解析器之间的桥梁。
 */

import { parseGML } from '@fdl-parser/gml/parser'
import {
  createDiagnostic,
  GML_BUILTIN_FUNCTIONS,
  GML_ARRAY_METHODS,
  GML_STRING_METHODS,
  GML_OBJECT_METHODS,
} from '@fdl-parser/gml/errorMessages'
import type { GMLDiagnostic } from '@fdl-parser/gml/errorMessages'
import {
  detectGMLRegions,
  findGMLRegionAt,
  mapGMLPositionToYAML,
} from './yamlGmlBridge'
import type { GMLRegion } from './yamlGmlBridge'

/**
 * YAML 中的 GML 诊断信息（包含 YAML 位置）
 */
export interface YAMLGMLDiagnostic extends GMLDiagnostic {
  /** YAML 中的起始行号 */
  yamlStartLine: number
  /** YAML 中的起始列号 */
  yamlStartColumn: number
  /** YAML 中的结束行号 */
  yamlEndLine: number
  /** YAML 中的结束列号 */
  yamlEndColumn: number
  /** 所属节点 ID */
  nodeId?: string
  /** 字段名 */
  fieldName: string
}

/**
 * 生成包含上下文信息的友好错误消息
 */
function formatDiagnosticMessage(
  diagnostic: ReturnType<typeof createDiagnostic>,
  region: GMLRegion,
  gmlContent: string
): string {
  // 获取出错的代码行
  const lines = gmlContent.split('\n')
  const errorLineIndex = diagnostic.line - 1
  const errorLine = errorLineIndex >= 0 && errorLineIndex < lines.length
    ? lines[errorLineIndex].trim()
    : ''

  // 构建上下文信息
  const context: string[] = []

  // 添加节点和字段信息
  if (region.nodeId) {
    context.push(`节点: ${region.nodeId}`)
  }
  context.push(`字段: ${region.fieldName}`)

  // 添加错误位置
  context.push(`位置: 第 ${diagnostic.line} 行`)

  // 添加问题代码片段
  if (errorLine) {
    context.push(`代码: ${errorLine.length > 50 ? errorLine.slice(0, 50) + '...' : errorLine}`)
  }

  // 组合最终消息
  return `${diagnostic.friendlyMessage}\n[${context.join(' | ')}]`
}

/**
 * 验证 YAML 中所有 GML 区域的语法
 *
 * @param yamlContent YAML 内容
 * @returns 诊断信息列表
 */
export function validateGMLInYaml(yamlContent: string): YAMLGMLDiagnostic[] {
  const diagnostics: YAMLGMLDiagnostic[] = []

  try {
    const regions = detectGMLRegions(yamlContent)

    for (const region of regions) {
      try {
        const result = parseGML(region.content)

        if (!result.success && result.errors.length > 0) {
          for (const error of result.errors) {
            const diagnostic = createDiagnostic(
              error.message,
              error.line,
              error.column,
              error.start,
              error.end,
              region.content
            )

            // 将 GML 位置转换为 YAML 位置
            const yamlStart = mapGMLPositionToYAML(region, error.line, error.column)
            const yamlEnd = mapGMLPositionToYAML(
              region,
              error.line,
              error.column + (error.end - error.start)
            )

            // 生成包含上下文的友好消息
            const enhancedMessage = formatDiagnosticMessage(diagnostic, region, region.content)

            diagnostics.push({
              ...diagnostic,
              friendlyMessage: enhancedMessage,
              yamlStartLine: yamlStart.line,
              yamlStartColumn: yamlStart.column,
              yamlEndLine: yamlEnd.line,
              yamlEndColumn: yamlEnd.column,
              nodeId: region.nodeId,
              fieldName: region.fieldName,
            })
          }
        }
      } catch (e) {
        // 单个 GML 区域解析失败，创建通用错误
        const errorMessage = e instanceof Error ? e.message : String(e)
        const diagnostic = createDiagnostic(
          errorMessage,
          1,
          1,
          0,
          region.content.length,
          region.content
        )

        // 生成包含上下文的友好消息
        const enhancedMessage = formatDiagnosticMessage(diagnostic, region, region.content)

        diagnostics.push({
          ...diagnostic,
          friendlyMessage: enhancedMessage,
          yamlStartLine: region.startLine,
          yamlStartColumn: region.startColumn,
          yamlEndLine: region.endLine,
          yamlEndColumn: region.endColumn,
          nodeId: region.nodeId,
          fieldName: region.fieldName,
        })
      }
    }
  } catch (e) {
    // YAML 解析失败，无法进行 GML 验证
    console.warn('[GMLLanguageService] Failed to detect GML regions:', e)
  }

  return diagnostics
}

/**
 * 补全项类型
 */
export type CompletionItemKind =
  | 'function'
  | 'method'
  | 'variable'
  | 'keyword'
  | 'property'
  | 'constant'

/**
 * 补全项
 */
export interface CompletionItem {
  /** 补全标签 */
  label: string
  /** 类型 */
  kind: CompletionItemKind
  /** 插入文本 */
  insertText: string
  /** 详细信息 */
  detail?: string
  /** 文档说明 */
  documentation?: string
  /** 排序优先级 (数字越小越靠前) */
  sortOrder?: number
}

/**
 * 获取 GML 补全建议
 *
 * @param yamlContent YAML 内容
 * @param line YAML 行号 (1-based)
 * @param column YAML 列号 (1-based)
 * @param triggerCharacter 触发字符
 * @returns 补全项列表
 */
export function getGMLCompletions(
  yamlContent: string,
  line: number,
  column: number,
  triggerCharacter?: string
): CompletionItem[] {
  const regions = detectGMLRegions(yamlContent)
  const region = findGMLRegionAt(regions, line, column)

  if (!region) {
    return []
  }

  const completions: CompletionItem[] = []

  // 根据触发字符提供不同的补全
  if (triggerCharacter === '.') {
    // 方法补全
    completions.push(...getMethodCompletions())
  } else if (triggerCharacter === '(') {
    // 函数参数提示 - 暂不实现
  } else {
    // 默认补全：函数 + 关键字
    completions.push(...getFunctionCompletions())
    completions.push(...getKeywordCompletions())
  }

  return completions
}

/**
 * 获取函数补全
 */
function getFunctionCompletions(): CompletionItem[] {
  return GML_BUILTIN_FUNCTIONS.map((fn, index) => ({
    label: fn.name,
    kind: 'function' as CompletionItemKind,
    insertText: fn.name + '($1)',
    detail: fn.signature,
    documentation: fn.description,
    sortOrder: index,
  }))
}

/**
 * 获取方法补全
 */
function getMethodCompletions(): CompletionItem[] {
  const methods: CompletionItem[] = []

  // 数组方法
  GML_ARRAY_METHODS.forEach((m, i) => {
    methods.push({
      label: m.name,
      kind: 'method',
      insertText: m.name + '($1)',
      detail: `[Array] ${m.signature}`,
      documentation: m.description,
      sortOrder: i,
    })
  })

  // 字符串方法
  GML_STRING_METHODS.forEach((m, i) => {
    methods.push({
      label: m.name,
      kind: 'method',
      insertText: m.name + '($1)',
      detail: `[String] ${m.signature}`,
      documentation: m.description,
      sortOrder: 100 + i,
    })
  })

  // 对象方法
  GML_OBJECT_METHODS.forEach((m, i) => {
    methods.push({
      label: m.name,
      kind: 'method',
      insertText: m.name + '($1)',
      detail: `[Object] ${m.signature}`,
      documentation: m.description,
      sortOrder: 200 + i,
    })
  })

  return methods
}

/**
 * 获取关键字补全
 */
function getKeywordCompletions(): CompletionItem[] {
  const keywords = [
    { label: 'true', detail: '布尔值 true' },
    { label: 'false', detail: '布尔值 false' },
    { label: 'null', detail: '空值' },
    { label: 'this', detail: '当前上下文' },
    { label: 'return', detail: '返回语句' },
    { label: 'CASE', detail: 'CASE 表达式' },
    { label: 'WHEN', detail: 'CASE 条件' },
    { label: 'THEN', detail: 'CASE 结果' },
    { label: 'ELSE', detail: 'CASE 默认值' },
    { label: 'END', detail: 'CASE 结束' },
    { label: 'IN', detail: '包含运算符' },
    { label: 'LIKE', detail: '模式匹配' },
  ]

  return keywords.map((kw, i) => ({
    label: kw.label,
    kind: 'keyword' as CompletionItemKind,
    insertText: kw.label,
    detail: kw.detail,
    sortOrder: 300 + i,
  }))
}

/**
 * 悬浮提示信息
 */
export interface HoverInfo {
  /** 内容（支持 Markdown） */
  contents: string
  /** 范围 */
  range?: {
    startLine: number
    startColumn: number
    endLine: number
    endColumn: number
  }
}

/**
 * 获取悬浮提示
 *
 * @param yamlContent YAML 内容
 * @param line YAML 行号 (1-based)
 * @param column YAML 列号 (1-based)
 * @param word 当前单词
 * @returns 悬浮提示信息
 */
export function getGMLHover(
  yamlContent: string,
  line: number,
  column: number,
  word: string
): HoverInfo | null {
  const regions = detectGMLRegions(yamlContent)
  const region = findGMLRegionAt(regions, line, column)

  if (!region) {
    return null
  }

  // 查找内置函数
  const func = GML_BUILTIN_FUNCTIONS.find(
    (f) => f.name.toLowerCase() === word.toLowerCase()
  )
  if (func) {
    return {
      contents: `**${func.name}**\n\n\`\`\`\n${func.signature}\n\`\`\`\n\n${func.description}`,
    }
  }

  // 查找数组方法
  const arrayMethod = GML_ARRAY_METHODS.find(
    (m) => m.name.toLowerCase() === word.toLowerCase()
  )
  if (arrayMethod) {
    return {
      contents: `**${arrayMethod.name}** (Array method)\n\n\`\`\`\n${arrayMethod.signature}\n\`\`\`\n\n${arrayMethod.description}`,
    }
  }

  // 查找字符串方法
  const stringMethod = GML_STRING_METHODS.find(
    (m) => m.name.toLowerCase() === word.toLowerCase()
  )
  if (stringMethod) {
    return {
      contents: `**${stringMethod.name}** (String method)\n\n\`\`\`\n${stringMethod.signature}\n\`\`\`\n\n${stringMethod.description}`,
    }
  }

  // 查找对象方法
  const objectMethod = GML_OBJECT_METHODS.find(
    (m) => m.name.toLowerCase() === word.toLowerCase()
  )
  if (objectMethod) {
    return {
      contents: `**${objectMethod.name}** (Object method)\n\n\`\`\`\n${objectMethod.signature}\n\`\`\`\n\n${objectMethod.description}`,
    }
  }

  return null
}

/**
 * 获取 GML 区域列表（供外部使用）
 */
export function getGMLRegions(yamlContent: string): GMLRegion[] {
  return detectGMLRegions(yamlContent)
}

/**
 * 检查指定位置是否在 GML 区域内
 */
export function isInGMLRegion(
  yamlContent: string,
  line: number,
  column: number
): boolean {
  const regions = detectGMLRegions(yamlContent)
  return findGMLRegionAt(regions, line, column) !== null
}
