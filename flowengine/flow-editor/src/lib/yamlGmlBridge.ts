/**
 * YAML-GML Bridge
 *
 * 检测 YAML 中的 GML 表达式区域，提供位置映射功能。
 * 用于在 YAML 编辑器中实现 GML 语法检查和智能提示。
 */

/**
 * GML 区域信息
 */
export interface GMLRegion {
  /** 字段名: args, with, sets, when, each, vars, only */
  fieldName: string
  /** YAML 中的起始行号 (1-based) */
  startLine: number
  /** 起始列号 (1-based) */
  startColumn: number
  /** 结束行号 (1-based) */
  endLine: number
  /** 结束列号 (1-based) */
  endColumn: number
  /** GML 内容 */
  content: string
  /** 是否多行 (使用 | 或 > 语法) */
  isMultiline: boolean
  /** 所属节点 ID */
  nodeId?: string
  /** 内容在 YAML 中的起始偏移量 */
  contentOffset: number
}

/** 包含 GML 表达式的字段名列表 */
const GML_FIELDS = ['args', 'with', 'sets', 'when', 'each', 'vars', 'only']

/**
 * 检测 YAML 内容中的所有 GML 区域
 *
 * @param yamlContent YAML 内容
 * @returns GML 区域列表
 */
export function detectGMLRegions(yamlContent: string): GMLRegion[] {
  const regions: GMLRegion[] = []
  const lines = yamlContent.split('\n')

  let currentNodeId: string | undefined
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const lineNumber = i + 1 // 1-based

    // 检测节点 ID (顶层缩进的标识符)
    const nodeIdMatch = line.match(/^(\s{8})(\w+):/)
    if (nodeIdMatch) {
      currentNodeId = nodeIdMatch[2]
    }

    // 检测 GML 字段
    for (const fieldName of GML_FIELDS) {
      const fieldPattern = new RegExp(`^(\\s+)(${fieldName}):\\s*(.*)$`)
      const match = line.match(fieldPattern)

      if (match) {
        const indent = match[1]
        const inlineContent = match[3]

        // 检查是否是多行块
        if (inlineContent === '|' || inlineContent === '>' || inlineContent === '|+' || inlineContent === '|-') {
          // 多行块语法
          const blockResult = parseMultilineBlock(lines, i, indent.length)
          if (blockResult.content) {
            regions.push({
              fieldName,
              startLine: lineNumber + 1, // 内容从下一行开始
              startColumn: blockResult.contentIndent + 1,
              endLine: lineNumber + blockResult.lineCount,
              endColumn: blockResult.lastLineLength + 1,
              content: blockResult.content,
              isMultiline: true,
              nodeId: currentNodeId,
              contentOffset: blockResult.contentOffset,
            })
          }
          i += blockResult.lineCount
        } else if (inlineContent) {
          // 单行内容
          const contentStartColumn = line.indexOf(inlineContent) + 1
          const contentOffset = getOffset(lines, i, contentStartColumn - 1)

          regions.push({
            fieldName,
            startLine: lineNumber,
            startColumn: contentStartColumn,
            endLine: lineNumber,
            endColumn: contentStartColumn + inlineContent.length,
            content: inlineContent,
            isMultiline: false,
            nodeId: currentNodeId,
            contentOffset,
          })
        }
        break
      }
    }

    i++
  }

  return regions
}

/**
 * 解析多行块内容
 */
function parseMultilineBlock(
  lines: string[],
  startLineIndex: number,
  baseIndent: number
): {
  content: string
  lineCount: number
  contentIndent: number
  lastLineLength: number
  contentOffset: number
} {
  const contentLines: string[] = []
  let lineCount = 0
  let contentIndent = 0
  let lastLineLength = 0
  let contentOffset = 0

  // 从下一行开始读取块内容
  for (let i = startLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]

    // 空行保留
    if (line.trim() === '') {
      contentLines.push('')
      lineCount++
      continue
    }

    // 计算当前行的缩进
    const currentIndent = line.search(/\S/)
    if (currentIndent === -1) {
      contentLines.push('')
      lineCount++
      continue
    }

    // 如果缩进小于等于基础缩进，说明块结束
    if (currentIndent <= baseIndent) {
      break
    }

    // 记录第一行的内容缩进
    if (contentLines.length === 0) {
      contentIndent = currentIndent
      contentOffset = getOffset(lines.slice(0, startLineIndex + 1), 0, 0) +
        lines[startLineIndex].length + 1 + // 当前行 + 换行符
        currentIndent
    }

    // 去除公共缩进
    const content = line.substring(contentIndent)
    contentLines.push(content)
    lastLineLength = content.length
    lineCount++
  }

  return {
    content: contentLines.join('\n'),
    lineCount,
    contentIndent,
    lastLineLength,
    contentOffset,
  }
}

/**
 * 计算在 YAML 内容中的偏移量
 */
function getOffset(lines: string[], lineIndex: number, column: number): number {
  let offset = 0
  for (let i = 0; i < lineIndex; i++) {
    offset += lines[i].length + 1 // +1 for newline
  }
  offset += column
  return offset
}

/**
 * 将 GML 区域内的位置转换为 YAML 中的位置
 *
 * @param region GML 区域
 * @param gmlLine GML 内部行号 (1-based)
 * @param gmlColumn GML 内部列号 (1-based)
 * @returns YAML 中的位置
 */
export function mapGMLPositionToYAML(
  region: GMLRegion,
  gmlLine: number,
  gmlColumn: number
): { line: number; column: number } {
  if (region.isMultiline) {
    return {
      line: region.startLine + gmlLine - 1,
      column: gmlColumn + region.startColumn - 1,
    }
  } else {
    return {
      line: region.startLine,
      column: region.startColumn + gmlColumn - 1,
    }
  }
}

/**
 * 检查给定位置是否在 GML 区域内
 *
 * @param regions GML 区域列表
 * @param line YAML 行号 (1-based)
 * @param column YAML 列号 (1-based)
 * @returns 匹配的 GML 区域，如果不在任何区域内则返回 null
 */
export function findGMLRegionAt(
  regions: GMLRegion[],
  line: number,
  column: number
): GMLRegion | null {
  for (const region of regions) {
    if (line >= region.startLine && line <= region.endLine) {
      if (line === region.startLine && column < region.startColumn) {
        continue
      }
      if (line === region.endLine && column > region.endColumn) {
        continue
      }
      return region
    }
  }
  return null
}

/**
 * 将 YAML 位置转换为 GML 区域内的位置
 *
 * @param region GML 区域
 * @param yamlLine YAML 行号 (1-based)
 * @param yamlColumn YAML 列号 (1-based)
 * @returns GML 内部位置
 */
export function mapYAMLPositionToGML(
  region: GMLRegion,
  yamlLine: number,
  yamlColumn: number
): { line: number; column: number } {
  if (region.isMultiline) {
    return {
      line: yamlLine - region.startLine + 1,
      column: yamlColumn - region.startColumn + 1,
    }
  } else {
    return {
      line: 1,
      column: yamlColumn - region.startColumn + 1,
    }
  }
}
