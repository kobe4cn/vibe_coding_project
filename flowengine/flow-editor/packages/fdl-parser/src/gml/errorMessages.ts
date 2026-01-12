/**
 * GML 错误消息处理
 *
 * 提供用户友好的错误描述和自动修复建议。
 */

/**
 * GML 错误代码
 * 使用 const 对象替代 enum 以兼容 erasableSyntaxOnly
 */
export const GMLErrorCode = {
  /** 双引号应改为单引号 */
  DOUBLE_QUOTE: 'GML001',
  /** 冒号应改为等号 */
  COLON_INSTEAD_OF_EQUALS: 'GML002',
  /** 字符串未闭合 */
  UNTERMINATED_STRING: 'GML003',
  /** 未定义的变量 */
  UNDEFINED_VARIABLE: 'GML004',
  /** 未定义的函数 */
  UNDEFINED_FUNCTION: 'GML005',
  /** 括号不匹配 */
  UNMATCHED_BRACKET: 'GML006',
  /** 语法错误 */
  SYNTAX_ERROR: 'GML007',
  /** 非法字符 */
  ILLEGAL_CHARACTER: 'GML008',
} as const

export type GMLErrorCode = typeof GMLErrorCode[keyof typeof GMLErrorCode]

/**
 * Quick Fix 建议
 */
export interface QuickFixSuggestion {
  /** 修复标题 */
  title: string
  /** 替换内容 */
  replacement: string
  /** 替换起始位置 */
  start: number
  /** 替换结束位置 */
  end: number
}

/**
 * GML 诊断信息
 */
export interface GMLDiagnostic {
  /** 严重程度 */
  severity: 'error' | 'warning' | 'info'
  /** 原始错误消息 */
  message: string
  /** 用户友好的错误描述 */
  friendlyMessage: string
  /** 错误代码 */
  code: GMLErrorCode
  /** 行号 (1-based) */
  line: number
  /** 列号 (1-based) */
  column: number
  /** 起始位置 */
  start: number
  /** 结束位置 */
  end: number
  /** 修复建议 */
  suggestions?: QuickFixSuggestion[]
}

/**
 * 错误模式匹配规则
 */
interface ErrorPattern {
  /** 匹配正则 */
  pattern: RegExp
  /** 错误代码 */
  code: GMLErrorCode
  /** 生成友好消息的函数 */
  getFriendlyMessage: (match: RegExpMatchArray) => string
  /** 生成修复建议的函数 */
  getSuggestions?: (
    match: RegExpMatchArray,
    content: string,
    position: number
  ) => QuickFixSuggestion[]
}

/**
 * 错误模式定义
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    // GML 语法错误：冒号赋值（新增的更准确的模式）
    pattern: /GML 语法错误：请使用 '=' 进行赋值|GML 对象语法错误：字段赋值请使用/i,
    code: GMLErrorCode.COLON_INSTEAD_OF_EQUALS,
    getFriendlyMessage: () =>
      '语法错误：GML 使用 = 进行赋值，而非 : 冒号',
    getSuggestions: (_, content, position) => {
      const suggestions: QuickFixSuggestion[] = []
      const lineStart = content.lastIndexOf('\n', position) + 1
      let lineEnd = content.indexOf('\n', position)
      if (lineEnd === -1) lineEnd = content.length
      const line = content.substring(lineStart, lineEnd)

      const colonPattern = /(\w+)\s*:\s*(?=[^/])/g
      let match
      while ((match = colonPattern.exec(line)) !== null) {
        const colonPos = line.indexOf(':', match.index + match[1].length)
        if (colonPos !== -1) {
          suggestions.push({
            title: `将 ${match[1]}: 改为 ${match[1]} =`,
            replacement: ' =',
            start: lineStart + colonPos,
            end: lineStart + colonPos + 1,
          })
        }
      }
      return suggestions
    },
  },
  {
    // 双引号错误（多种表述）
    pattern: /GML 字符串请使用单引号|Unexpected character: '"|双引号/i,
    code: GMLErrorCode.DOUBLE_QUOTE,
    getFriendlyMessage: () =>
      '字符串错误：GML 请使用单引号 \' 而非双引号 "',
    getSuggestions: (_, content, position) => {
      const suggestions: QuickFixSuggestion[] = []
      const searchStart = Math.max(0, position - 50)
      const searchEnd = Math.min(content.length, position + 50)
      const searchRange = content.substring(searchStart, searchEnd)

      const doubleQuoteRegex = /"([^"\\]|\\.)*"/g
      let match
      while ((match = doubleQuoteRegex.exec(searchRange)) !== null) {
        const start = searchStart + match.index
        const end = start + match[0].length
        const replacement = "'" + match[0].slice(1, -1).replace(/'/g, "\\'") + "'"
        suggestions.push({
          title: '将双引号转换为单引号',
          replacement,
          start,
          end,
        })
      }
      return suggestions
    },
  },
  {
    // 意外的符号
    pattern: /意外的符号|意外的内容/i,
    code: GMLErrorCode.SYNTAX_ERROR,
    getFriendlyMessage: (match) => {
      return match[0]
    },
  },
  {
    // 表达式不完整
    pattern: /表达式不完整|缺少闭合/i,
    code: GMLErrorCode.UNMATCHED_BRACKET,
    getFriendlyMessage: () => '表达式不完整，请检查括号或引号是否正确闭合',
  },
  {
    // 冒号语法错误（旧模式保留兼容）
    pattern: /Unexpected token:?\s*['":]|Expected.*got.*:/i,
    code: GMLErrorCode.COLON_INSTEAD_OF_EQUALS,
    getFriendlyMessage: () =>
      '语法错误：GML 对象字段请使用 = 而非 :',
    getSuggestions: (_, content, position) => {
      const suggestions: QuickFixSuggestion[] = []
      const lineStart = content.lastIndexOf('\n', position) + 1
      let lineEnd = content.indexOf('\n', position)
      if (lineEnd === -1) lineEnd = content.length
      const line = content.substring(lineStart, lineEnd)

      const colonPattern = /(\w+)\s*:\s*(?=[^/])/g
      let match
      while ((match = colonPattern.exec(line)) !== null) {
        const colonPos = line.indexOf(':', match.index + match[1].length)
        if (colonPos !== -1) {
          suggestions.push({
            title: `将 : 替换为 =`,
            replacement: ' =',
            start: lineStart + colonPos,
            end: lineStart + colonPos + 1,
          })
        }
      }
      return suggestions
    },
  },
  {
    // 字符串未闭合
    pattern: /Unterminated string|string literal/i,
    code: GMLErrorCode.UNTERMINATED_STRING,
    getFriendlyMessage: () => '字符串未闭合，请添加匹配的引号',
    getSuggestions: (_, content, position) => {
      let lineEnd = content.indexOf('\n', position)
      if (lineEnd === -1) lineEnd = content.length
      return [{
        title: "添加闭合单引号 '",
        replacement: "'",
        start: lineEnd,
        end: lineEnd,
      }]
    },
  },
  {
    // 未定义变量
    pattern: /Undefined variable:?\s*['"]?(\w+)['"]?|Unknown identifier:?\s*['"]?(\w+)['"]?/i,
    code: GMLErrorCode.UNDEFINED_VARIABLE,
    getFriendlyMessage: (match) => {
      const varName = match[1] || match[2]
      return `未定义的变量 '${varName}'，请检查变量名是否正确`
    },
  },
  {
    // 未定义函数
    pattern: /Undefined function:?\s*['"]?(\w+)['"]?|Unknown function:?\s*['"]?(\w+)['"]?/i,
    code: GMLErrorCode.UNDEFINED_FUNCTION,
    getFriendlyMessage: (match) => {
      const funcName = match[1] || match[2]
      return `未定义的函数 '${funcName}'，请检查函数名是否正确`
    },
  },
  {
    // 括号不匹配
    pattern: /Expected.*\)|Unmatched.*\(|Missing.*\)/i,
    code: GMLErrorCode.UNMATCHED_BRACKET,
    getFriendlyMessage: () => '括号不匹配，请检查括号配对',
  },
  {
    // 非法字符
    pattern: /非法字符|Unexpected character:?\s*['"]?(.)['"]?/i,
    code: GMLErrorCode.ILLEGAL_CHARACTER,
    getFriendlyMessage: (match) => {
      const char = match[1]
      return char ? `非法字符 '${char}'` : match[0]
    },
  },
]

/**
 * 将原始错误消息转换为用户友好的诊断信息
 *
 * @param message 原始错误消息
 * @param line 行号
 * @param column 列号
 * @param start 起始位置
 * @param end 结束位置
 * @param content GML 内容（用于生成修复建议）
 * @returns 诊断信息
 */
export function createDiagnostic(
  message: string,
  line: number,
  column: number,
  start: number,
  end: number,
  content?: string
): GMLDiagnostic {
  // 尝试匹配已知错误模式
  for (const pattern of ERROR_PATTERNS) {
    const match = message.match(pattern.pattern)
    if (match) {
      const suggestions =
        content && pattern.getSuggestions
          ? pattern.getSuggestions(match, content, start)
          : undefined

      return {
        severity: 'error',
        message,
        friendlyMessage: pattern.getFriendlyMessage(match),
        code: pattern.code,
        line,
        column,
        start,
        end,
        suggestions,
      }
    }
  }

  // 未匹配到已知模式，返回通用错误
  return {
    severity: 'error',
    message,
    friendlyMessage: message,
    code: GMLErrorCode.SYNTAX_ERROR,
    line,
    column,
    start,
    end,
  }
}

/**
 * 获取错误代码的描述
 */
export function getErrorCodeDescription(code: GMLErrorCode): string {
  const descriptions: Record<GMLErrorCode, string> = {
    [GMLErrorCode.DOUBLE_QUOTE]: '字符串引号错误',
    [GMLErrorCode.COLON_INSTEAD_OF_EQUALS]: '对象语法错误',
    [GMLErrorCode.UNTERMINATED_STRING]: '字符串未闭合',
    [GMLErrorCode.UNDEFINED_VARIABLE]: '未定义变量',
    [GMLErrorCode.UNDEFINED_FUNCTION]: '未定义函数',
    [GMLErrorCode.UNMATCHED_BRACKET]: '括号不匹配',
    [GMLErrorCode.SYNTAX_ERROR]: '语法错误',
    [GMLErrorCode.ILLEGAL_CHARACTER]: '非法字符',
  }
  return descriptions[code] || '未知错误'
}

/**
 * GML 内置函数列表（用于函数补全和验证）
 */
export const GML_BUILTIN_FUNCTIONS = [
  // 时间函数
  { name: 'DATE', signature: 'DATE(offset?: string) -> date', description: '获取日期，可选偏移量如 "-3M"' },
  { name: 'TIME', signature: 'TIME(offset?: string) -> date', description: '获取时间，可选偏移量' },
  { name: 'NOW', signature: 'NOW() -> date', description: '获取当前时间' },

  // 聚合函数
  { name: 'COUNT', signature: 'COUNT(array) -> number', description: '计算数组元素数量' },
  { name: 'SUM', signature: 'SUM(array, property?: string) -> number', description: '求和' },
  { name: 'AVG', signature: 'AVG(array, property?: string) -> number', description: '求平均值' },
  { name: 'MIN', signature: 'MIN(array, property?: string) -> number', description: '求最小值' },
  { name: 'MAX', signature: 'MAX(array, property?: string) -> number', description: '求最大值' },

  // 字符串函数
  { name: 'TRIM', signature: 'TRIM(str: string) -> string', description: '去除首尾空白' },
  { name: 'UPPER', signature: 'UPPER(str: string) -> string', description: '转大写' },
  { name: 'LOWER', signature: 'LOWER(str: string) -> string', description: '转小写' },
  { name: 'CONCAT', signature: 'CONCAT(...args) -> string', description: '字符串拼接' },

  // 数学函数
  { name: 'ROUND', signature: 'ROUND(num: number, precision?: number) -> number', description: '四舍五入' },
  { name: 'FLOOR', signature: 'FLOOR(num: number) -> number', description: '向下取整' },
  { name: 'CEIL', signature: 'CEIL(num: number) -> number', description: '向上取整' },
  { name: 'ABS', signature: 'ABS(num: number) -> number', description: '绝对值' },

  // 逻辑函数
  { name: 'IF', signature: 'IF(condition, trueValue, falseValue) -> any', description: '条件判断' },
  { name: 'COALESCE', signature: 'COALESCE(...args) -> any', description: '返回第一个非空值' },

  // 类型转换
  { name: 'toJson', signature: 'toJson(value: any) -> string', description: '转换为 JSON 字符串' },
  { name: 'toString', signature: 'toString(value: any) -> string', description: '转换为字符串' },
  { name: 'toNumber', signature: 'toNumber(value: any) -> number', description: '转换为数字' },
]

/**
 * GML 数组方法列表
 */
export const GML_ARRAY_METHODS = [
  { name: 'filter', signature: 'filter(predicate) -> array', description: '过滤数组元素' },
  { name: 'map', signature: 'map(transform) -> array', description: '转换数组元素' },
  { name: 'find', signature: 'find(predicate) -> any', description: '查找第一个匹配元素' },
  { name: 'some', signature: 'some(predicate) -> boolean', description: '检查是否存在匹配元素' },
  { name: 'every', signature: 'every(predicate) -> boolean', description: '检查是否所有元素匹配' },
  { name: 'reduce', signature: 'reduce(reducer, initial) -> any', description: '归约数组' },
  { name: 'sum', signature: 'sum(property?: string) -> number', description: '求和' },
  { name: 'avg', signature: 'avg(property?: string) -> number', description: '求平均值' },
  { name: 'min', signature: 'min(property?: string) -> number', description: '求最小值' },
  { name: 'max', signature: 'max(property?: string) -> number', description: '求最大值' },
  { name: 'count', signature: 'count() -> number', description: '计数' },
  { name: 'first', signature: 'first() -> any', description: '获取第一个元素' },
  { name: 'last', signature: 'last() -> any', description: '获取最后一个元素' },
  { name: 'take', signature: 'take(n: number) -> array', description: '获取前 n 个元素' },
  { name: 'skip', signature: 'skip(n: number) -> array', description: '跳过前 n 个元素' },
  { name: 'sort', signature: 'sort(key?: string, order?: string) -> array', description: '排序' },
  { name: 'reverse', signature: 'reverse() -> array', description: '反转数组' },
  { name: 'distinct', signature: 'distinct(key?: string) -> array', description: '去重' },
  { name: 'group', signature: 'group(key: string) -> array', description: '分组' },
  { name: 'flatten', signature: 'flatten() -> array', description: '展平嵌套数组' },
  { name: 'add', signature: 'add(item: any) -> array', description: '添加元素' },
  { name: 'addAll', signature: 'addAll(items: array) -> array', description: '添加多个元素' },
  { name: 'remove', signature: 'remove(item: any) -> array', description: '移除元素' },
  { name: 'proj', signature: 'proj(fields: string) -> array', description: '投影指定字段' },
  { name: 'pick', signature: 'pick(...keys: string) -> array', description: '选择指定键' },
  { name: 'omit', signature: 'omit(...keys: string) -> array', description: '排除指定键' },
]

/**
 * GML 字符串方法列表
 */
export const GML_STRING_METHODS = [
  { name: 'trim', signature: 'trim() -> string', description: '去除首尾空白' },
  { name: 'split', signature: 'split(separator: string) -> array', description: '分割字符串' },
  { name: 'replace', signature: 'replace(search: string, replacement: string) -> string', description: '替换' },
  { name: 'indexOf', signature: 'indexOf(search: string) -> number', description: '查找位置' },
  { name: 'substring', signature: 'substring(start: number, end?: number) -> string', description: '截取子串' },
  { name: 'toUpperCase', signature: 'toUpperCase() -> string', description: '转大写' },
  { name: 'toLowerCase', signature: 'toLowerCase() -> string', description: '转小写' },
  { name: 'startsWith', signature: 'startsWith(prefix: string) -> boolean', description: '检查前缀' },
  { name: 'endsWith', signature: 'endsWith(suffix: string) -> boolean', description: '检查后缀' },
  { name: 'includes', signature: 'includes(search: string) -> boolean', description: '检查包含' },
]

/**
 * GML 对象方法列表
 */
export const GML_OBJECT_METHODS = [
  { name: 'keys', signature: 'keys() -> array', description: '获取所有键' },
  { name: 'values', signature: 'values() -> array', description: '获取所有值' },
  { name: 'entries', signature: 'entries() -> array', description: '获取键值对数组' },
  { name: 'has', signature: 'has(key: string) -> boolean', description: '检查键是否存在' },
  { name: 'get', signature: 'get(key: string, default?: any) -> any', description: '获取值' },
]
