/**
 * GML Expression Evaluator
 * Evaluates GML AST with a context
 */

import type {
  GMLProgram,
  GMLStatement,
  GMLExpression,
  GMLContext,
  GMLCaseExpression,
  GMLArrowFunction,
} from './types'

/**
 * Create a new evaluation context
 */
export function createContext(
  variables: Record<string, unknown> = {},
  parent?: GMLContext
): GMLContext {
  return { variables, parent }
}

/**
 * Look up a variable in the context chain
 */
function lookupVariable(name: string, context: GMLContext): unknown {
  if (name in context.variables) {
    return context.variables[name]
  }
  if (context.parent) {
    return lookupVariable(name, context.parent)
  }
  return undefined
}

/**
 * Set a variable in the current context
 */
function setVariable(name: string, value: unknown, context: GMLContext): void {
  context.variables[name] = value
}

/**
 * Safe property access with null checking
 */
function safeGet(obj: unknown, key: string | number): unknown {
  if (obj === null || obj === undefined) {
    return undefined
  }
  return (obj as Record<string | number, unknown>)[key]
}

/**
 * Array prototype methods implementation
 */
const arrayMethods: Record<string, (arr: unknown[], ...args: unknown[]) => unknown> = {
  filter: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.filter((item, index) => fn(item, index, arr))
    }
    return arr.filter(Boolean)
  },
  map: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.map((item, index) => fn(item, index, arr))
    }
    // If fn is a string, it's a property name
    if (typeof fn === 'string') {
      return arr.map((item) => safeGet(item, fn))
    }
    return arr
  },
  reduce: (arr, fn, init) => {
    if (typeof fn === 'function') {
      return arr.reduce((acc, item, index) => fn(acc, item, index, arr), init)
    }
    return init
  },
  find: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.find((item, index) => fn(item, index, arr))
    }
    return undefined
  },
  findIndex: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.findIndex((item, index) => fn(item, index, arr))
    }
    return -1
  },
  some: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.some((item, index) => fn(item, index, arr))
    }
    return false
  },
  every: (arr, fn) => {
    if (typeof fn === 'function') {
      return arr.every((item, index) => fn(item, index, arr))
    }
    return true
  },
  includes: (arr, item) => arr.includes(item),
  indexOf: (arr, item) => arr.indexOf(item),
  slice: (arr, start, end) => arr.slice(start as number, end as number),
  concat: (arr, ...items) => arr.concat(...items.flat()),
  join: (arr, sep) => arr.join(sep as string),
  sort: (arr, fn) => {
    if (typeof fn === 'function') {
      return [...arr].sort((a, b) => fn(a, b) as number)
    }
    return [...arr].sort()
  },
  reverse: (arr) => [...arr].reverse(),

  // Custom GML array methods
  add: (arr, item) => [...arr, item],
  addAll: (arr, items) => [...arr, ...(Array.isArray(items) ? items : [items])],
  remove: (arr, item) => arr.filter((x) => x !== item),
  removeAt: (arr, index) => arr.filter((_, i) => i !== index),
  first: (arr) => arr[0],
  last: (arr) => arr[arr.length - 1],
  take: (arr, n) => arr.slice(0, n as number),
  skip: (arr, n) => arr.slice(n as number),
  distinct: (arr) => [...new Set(arr)],
  flatten: (arr) => arr.flat(),

  // Aggregation methods
  sum: (arr, prop) => {
    if (typeof prop === 'string') {
      return arr.reduce((sum, item) => sum + (Number(safeGet(item, prop)) || 0), 0)
    }
    return arr.reduce((sum, item) => sum + (Number(item) || 0), 0)
  },
  avg: (arr, prop) => {
    if (arr.length === 0) return 0
    const sum = arrayMethods.sum(arr, prop) as number
    return sum / arr.length
  },
  min: (arr, prop) => {
    if (typeof prop === 'string') {
      return Math.min(...arr.map((item) => Number(safeGet(item, prop)) || 0))
    }
    return Math.min(...arr.map((item) => Number(item) || 0))
  },
  max: (arr, prop) => {
    if (typeof prop === 'string') {
      return Math.max(...arr.map((item) => Number(safeGet(item, prop)) || 0))
    }
    return Math.max(...arr.map((item) => Number(item) || 0))
  },
  count: (arr) => arr.length,

  // Grouping
  group: (arr, prop) => {
    const groups: Record<string, unknown[]> = {}
    for (const item of arr) {
      const key = String(typeof prop === 'string' ? safeGet(item, prop) : prop)
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return Object.entries(groups).map(([key, val]) => ({ key, val }))
  },
  groupBy: (arr, prop) => {
    const groups: Record<string, unknown[]> = {}
    for (const item of arr) {
      const key = String(typeof prop === 'string' ? safeGet(item, prop) : prop)
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    }
    return groups
  },

  // Projection
  proj: (arr, fields) => {
    const fieldList =
      typeof fields === 'string' ? fields.split(',').map((f) => f.trim()) : (fields as string[])
    return arr.map((item) => {
      const result: Record<string, unknown> = {}
      for (const field of fieldList) {
        result[field] = safeGet(item, field)
      }
      return result
    })
  },
  pick: (arr, fields) => arrayMethods.proj(arr, fields),
  omit: (arr, fields) => {
    const fieldSet = new Set(
      typeof fields === 'string' ? fields.split(',').map((f) => f.trim()) : (fields as string[])
    )
    return arr.map((item) => {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(item as object)) {
        if (!fieldSet.has(key)) {
          result[key] = safeGet(item, key)
        }
      }
      return result
    })
  },
}

/**
 * String prototype methods implementation
 */
const stringMethods: Record<string, (str: string, ...args: unknown[]) => unknown> = {
  length: (str) => str.length,
  trim: (str) => str.trim(),
  trimStart: (str) => str.trimStart(),
  trimEnd: (str) => str.trimEnd(),
  toUpperCase: (str) => str.toUpperCase(),
  toLowerCase: (str) => str.toLowerCase(),
  startsWith: (str, search) => str.startsWith(String(search)),
  endsWith: (str, search) => str.endsWith(String(search)),
  includes: (str, search) => str.includes(String(search)),
  indexOf: (str, search) => str.indexOf(String(search)),
  lastIndexOf: (str, search) => str.lastIndexOf(String(search)),
  substring: (str, start, end) => str.substring(Number(start), end !== undefined ? Number(end) : undefined),
  slice: (str, start, end) => str.slice(Number(start), end !== undefined ? Number(end) : undefined),
  split: (str, sep) => str.split(String(sep)),
  replace: (str, search, replacement) => str.replace(String(search), String(replacement)),
  replaceAll: (str, search, replacement) => str.replaceAll(String(search), String(replacement)),
  padStart: (str, len, char) => str.padStart(Number(len), String(char || ' ')),
  padEnd: (str, len, char) => str.padEnd(Number(len), String(char || ' ')),
  charAt: (str, index) => str.charAt(Number(index)),
  charCodeAt: (str, index) => str.charCodeAt(Number(index)),
}

/**
 * Object methods implementation
 */
const objectMethods: Record<string, (obj: object, ...args: unknown[]) => unknown> = {
  keys: (obj) => Object.keys(obj),
  values: (obj) => Object.values(obj),
  entries: (obj) => Object.entries(obj),
  pick: (obj, fields) => {
    const fieldList =
      typeof fields === 'string' ? fields.split(',').map((f) => f.trim()) : (fields as string[])
    const result: Record<string, unknown> = {}
    for (const field of fieldList) {
      if (field in obj) {
        result[field] = (obj as Record<string, unknown>)[field]
      }
    }
    return result
  },
  omit: (obj, fields) => {
    const fieldSet = new Set(
      typeof fields === 'string' ? fields.split(',').map((f) => f.trim()) : (fields as string[])
    )
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(obj)) {
      if (!fieldSet.has(key)) {
        result[key] = (obj as Record<string, unknown>)[key]
      }
    }
    return result
  },
  merge: (obj, ...sources) => Object.assign({}, obj, ...sources),
}

/**
 * Built-in functions
 */
const builtins: Record<string, (...args: unknown[]) => unknown> = {
  DATE: (offset?: string) => {
    const now = new Date()
    if (offset) {
      const match = String(offset).match(/^([+-]?\d+)([smhdwMy])$/)
      if (match) {
        const value = parseInt(match[1])
        const unit = match[2]
        switch (unit) {
          case 's': now.setSeconds(now.getSeconds() + value); break
          case 'm': now.setMinutes(now.getMinutes() + value); break
          case 'h': now.setHours(now.getHours() + value); break
          case 'd': now.setDate(now.getDate() + value); break
          case 'w': now.setDate(now.getDate() + value * 7); break
          case 'M': now.setMonth(now.getMonth() + value); break
          case 'y': now.setFullYear(now.getFullYear() + value); break
        }
      }
    }
    return now.toISOString()
  },
  TIME: (offset?: string) => builtins.DATE(offset),
  NOW: () => new Date().toISOString(),
  COUNT: (arr) => Array.isArray(arr) ? arr.length : 0,
  SUM: (arr, prop?) => arrayMethods.sum(arr as unknown[], prop),
  AVG: (arr, prop?) => arrayMethods.avg(arr as unknown[], prop),
  MIN: (arr, prop?) => arrayMethods.min(arr as unknown[], prop),
  MAX: (arr, prop?) => arrayMethods.max(arr as unknown[], prop),
  LEN: (val) => typeof val === 'string' ? val.length : Array.isArray(val) ? val.length : 0,
  TRIM: (str) => String(str).trim(),
  UPPER: (str) => String(str).toUpperCase(),
  LOWER: (str) => String(str).toLowerCase(),
  ROUND: (num, decimals = 0) => {
    const factor = Math.pow(10, Number(decimals))
    return Math.round(Number(num) * factor) / factor
  },
  FLOOR: (num) => Math.floor(Number(num)),
  CEIL: (num) => Math.ceil(Number(num)),
  ABS: (num) => Math.abs(Number(num)),
  IF: (cond, then, els) => cond ? then : els,
  COALESCE: (...args) => args.find(x => x !== null && x !== undefined),
}

/**
 * Evaluate a GML expression
 */
function evaluateExpression(expr: GMLExpression, context: GMLContext): unknown {
  switch (expr.type) {
    case 'Identifier':
      // Check builtins first
      if (expr.name in builtins) {
        return builtins[expr.name]
      }
      return lookupVariable(expr.name, context)

    case 'NumberLiteral':
      return expr.value

    case 'StringLiteral':
      return expr.value

    case 'BooleanLiteral':
      return expr.value

    case 'NullLiteral':
      return null

    case 'TemplateLiteral': {
      let result = expr.quasis[0]
      for (let i = 0; i < expr.expressions.length; i++) {
        const value = evaluateExpression(expr.expressions[i], context)
        result += String(value ?? '')
        result += expr.quasis[i + 1] || ''
      }
      return result
    }

    case 'ArrayExpression':
      return expr.elements.map((el) => evaluateExpression(el, context))

    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {}
      for (const prop of expr.properties) {
        if (prop.type === 'SpreadElement') {
          const spread = evaluateExpression(prop.argument, context)
          if (spread && typeof spread === 'object') {
            Object.assign(obj, spread)
          }
        } else {
          const key = prop.key.type === 'Identifier' ? prop.key.name : prop.key.value
          obj[key] = evaluateExpression(prop.value, context)
        }
      }
      return obj
    }

    case 'SpreadElement':
      return evaluateExpression(expr.argument, context)

    case 'MemberExpression': {
      const object = evaluateExpression(expr.object, context)
      if (expr.computed) {
        const property = evaluateExpression(expr.property, context)
        return safeGet(object, property as string | number)
      } else {
        const propName = (expr.property as { name: string }).name
        return safeGet(object, propName)
      }
    }

    case 'CallExpression': {
      const callee = expr.callee
      const args = expr.arguments.map((arg) => evaluateExpression(arg, context))

      // Method call: obj.method(args)
      if (callee.type === 'MemberExpression') {
        const obj = evaluateExpression(callee.object, context)
        const methodName = callee.computed
          ? String(evaluateExpression(callee.property, context))
          : (callee.property as { name: string }).name

        // Array methods
        if (Array.isArray(obj) && methodName in arrayMethods) {
          // Convert arrow function arguments
          const processedArgs = args.map((arg) => {
            if (typeof arg === 'object' && arg !== null && 'type' in arg && (arg as GMLArrowFunction).type === 'ArrowFunction') {
              const arrowFn = arg as GMLArrowFunction
              return (...fnArgs: unknown[]) => {
                const fnContext = createContext({}, context)
                arrowFn.params.forEach((param, i) => {
                  fnContext.variables[param.name] = fnArgs[i]
                })
                return evaluateExpression(arrowFn.body, fnContext)
              }
            }
            return arg
          })
          return arrayMethods[methodName](obj, ...processedArgs)
        }

        // String methods
        if (typeof obj === 'string' && methodName in stringMethods) {
          return stringMethods[methodName](obj, ...args)
        }

        // Object methods
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && methodName in objectMethods) {
          return objectMethods[methodName](obj as object, ...args)
        }

        // Try native method
        if (obj && typeof obj === 'object' && methodName in obj) {
          const method = (obj as Record<string, unknown>)[methodName]
          if (typeof method === 'function') {
            return method.apply(obj, args)
          }
        }

        return undefined
      }

      // Function call: func(args)
      const fn = evaluateExpression(callee, context)
      if (typeof fn === 'function') {
        return fn(...args)
      }

      return undefined
    }

    case 'BinaryExpression': {
      const left = evaluateExpression(expr.left, context)
      const right = evaluateExpression(expr.right, context)

      switch (expr.operator) {
        case '+': return (left as number) + (right as number)
        case '-': return (left as number) - (right as number)
        case '*': return (left as number) * (right as number)
        case '/': return (left as number) / (right as number)
        case '%': return (left as number) % (right as number)
        case '==': return left == right
        case '!=': return left != right
        case '===': return left === right
        case '!==': return left !== right
        case '<': return (left as number) < (right as number)
        case '>': return (left as number) > (right as number)
        case '<=': return (left as number) <= (right as number)
        case '>=': return (left as number) >= (right as number)
        case '&&': return left && right
        case '||': return left || right
        case '??': return left ?? right
        case 'IN': return Array.isArray(right) && right.includes(left)
        case 'LIKE': {
          const pattern = String(right).replace(/%/g, '.*').replace(/_/g, '.')
          return new RegExp(`^${pattern}$`, 'i').test(String(left))
        }
        default: return undefined
      }
    }

    case 'UnaryExpression': {
      const arg = evaluateExpression(expr.argument, context)
      switch (expr.operator) {
        case '!':
        case 'NOT':
          return !arg
        case '-':
          return -(arg as number)
        case '+':
          return +(arg as number)
        default:
          return undefined
      }
    }

    case 'ConditionalExpression': {
      const test = evaluateExpression(expr.test, context)
      return test
        ? evaluateExpression(expr.consequent, context)
        : evaluateExpression(expr.alternate, context)
    }

    case 'CaseExpression': {
      for (const { when, then } of (expr as GMLCaseExpression).cases) {
        if (evaluateExpression(when, context)) {
          return evaluateExpression(then, context)
        }
      }
      return expr.else ? evaluateExpression(expr.else, context) : undefined
    }

    case 'ArrowFunction':
      // Return the AST node for later evaluation
      return expr

    default:
      return undefined
  }
}

/**
 * Evaluate a GML statement
 */
function evaluateStatement(stmt: GMLStatement, context: GMLContext): unknown {
  if (stmt.type === 'AssignmentStatement') {
    const value = evaluateExpression(stmt.right, context)
    if (stmt.left.type === 'Identifier') {
      setVariable(stmt.left.name, value, context)
    }
    return value
  }
  return evaluateExpression(stmt as GMLExpression, context)
}

/**
 * Evaluate a GML program
 */
export function evaluateGML(
  program: GMLProgram,
  context: GMLContext = createContext()
): { result: unknown; context: GMLContext } {
  let result: unknown = undefined

  for (const stmt of program.body) {
    result = evaluateStatement(stmt, context)
  }

  return { result, context }
}
