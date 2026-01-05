/**
 * GML (Generic Mapping Language) Unit Tests
 */

import { describe, it, expect } from 'vitest'
import { parseGML, tokenizeGML } from './parser'
import { evaluateGML, createContext } from './evaluator'

// Helper function to parse and evaluate GML
function evalGML(input: string, variables: Record<string, unknown> = {}): unknown {
  const result = parseGML(input)
  if (!result.success || !result.ast) {
    throw new Error(`Parse error: ${result.errors.map(e => e.message).join(', ')}`)
  }
  const context = createContext(variables)
  const { result: value } = evaluateGML(result.ast, context)
  return value
}

describe('GML Tokenizer', () => {
  it('should tokenize numbers', () => {
    const tokens = tokenizeGML('42 3.14 1e10')
    expect(tokens.filter(t => t.type === 'number').map(t => t.value)).toEqual(['42', '3.14', '1e10'])
  })

  it('should tokenize strings', () => {
    const tokens = tokenizeGML('"hello" \'world\'')
    expect(tokens.filter(t => t.type === 'string').map(t => t.value)).toEqual(['"hello"', "'world'"])
  })

  it('should tokenize template strings', () => {
    const tokens = tokenizeGML('`Hello ${name}!`')
    expect(tokens.filter(t => t.type === 'template').length).toBe(1)
  })

  it('should tokenize identifiers and keywords', () => {
    const tokens = tokenizeGML('foo CASE WHEN THEN')
    expect(tokens.filter(t => t.type === 'identifier').map(t => t.value)).toEqual(['foo'])
    expect(tokens.filter(t => t.type === 'keyword').map(t => t.value)).toEqual(['CASE', 'WHEN', 'THEN'])
  })

  it('should tokenize operators', () => {
    const tokens = tokenizeGML('+ - * / == != <= >= && || ?. ??')
    expect(tokens.filter(t => t.type === 'operator').map(t => t.value)).toEqual([
      '+', '-', '*', '/', '==', '!=', '<=', '>=', '&&', '||', '?.', '??'
    ])
  })

  it('should skip comments', () => {
    const tokens = tokenizeGML('a # this is a comment\nb')
    const identifiers = tokens.filter(t => t.type === 'identifier')
    expect(identifiers.map(t => t.value)).toEqual(['a', 'b'])
  })
})

describe('GML Parser - Literals', () => {
  it('should parse number literals', () => {
    expect(evalGML('42')).toBe(42)
    expect(evalGML('3.14')).toBe(3.14)
    expect(evalGML('-10')).toBe(-10)
  })

  it('should parse string literals', () => {
    expect(evalGML('"hello"')).toBe('hello')
    expect(evalGML("'world'")).toBe('world')
  })

  it('should parse boolean literals', () => {
    expect(evalGML('true')).toBe(true)
    expect(evalGML('false')).toBe(false)
  })

  it('should parse null', () => {
    expect(evalGML('null')).toBe(null)
  })

  it('should parse array literals', () => {
    expect(evalGML('[1, 2, 3]')).toEqual([1, 2, 3])
    expect(evalGML('[]')).toEqual([])
    expect(evalGML('["a", "b"]')).toEqual(['a', 'b'])
  })

  it('should parse object literals', () => {
    expect(evalGML('{ a: 1, b: 2 }')).toEqual({ a: 1, b: 2 })
    expect(evalGML('{}')).toEqual({})
  })

  it('should parse object with shorthand properties', () => {
    expect(evalGML('{ x }', { x: 10 })).toEqual({ x: 10 })
  })

  it('should parse object with spread', () => {
    expect(evalGML('{ ...a, c: 3 }', { a: { a: 1, b: 2 } })).toEqual({ a: 1, b: 2, c: 3 })
  })
})

describe('GML Parser - Template Literals', () => {
  it('should parse simple template strings', () => {
    expect(evalGML('`hello world`')).toBe('hello world')
  })

  it('should interpolate variables in template strings', () => {
    expect(evalGML('`Hello ${name}!`', { name: 'Alice' })).toBe('Hello Alice!')
  })

  it('should interpolate expressions in template strings', () => {
    expect(evalGML('`Sum: ${a + b}`', { a: 1, b: 2 })).toBe('Sum: 3')
  })

  it('should handle multiple interpolations', () => {
    expect(evalGML('`${a} + ${b} = ${a + b}`', { a: 1, b: 2 })).toBe('1 + 2 = 3')
  })
})

describe('GML Parser - Binary Expressions', () => {
  it('should evaluate arithmetic operations', () => {
    expect(evalGML('2 + 3')).toBe(5)
    expect(evalGML('5 - 2')).toBe(3)
    expect(evalGML('3 * 4')).toBe(12)
    expect(evalGML('10 / 2')).toBe(5)
    expect(evalGML('7 % 3')).toBe(1)
  })

  it('should respect operator precedence', () => {
    expect(evalGML('2 + 3 * 4')).toBe(14)
    expect(evalGML('(2 + 3) * 4')).toBe(20)
  })

  it('should evaluate comparison operations', () => {
    expect(evalGML('2 < 3')).toBe(true)
    expect(evalGML('3 > 2')).toBe(true)
    expect(evalGML('2 <= 2')).toBe(true)
    expect(evalGML('2 >= 3')).toBe(false)
    expect(evalGML('2 == 2')).toBe(true)
    expect(evalGML('2 != 3')).toBe(true)
    expect(evalGML('2 === 2')).toBe(true)
    expect(evalGML('2 !== 3')).toBe(true)
  })

  it('should evaluate logical operations', () => {
    expect(evalGML('true && true')).toBe(true)
    expect(evalGML('true && false')).toBe(false)
    expect(evalGML('true || false')).toBe(true)
    expect(evalGML('false || false')).toBe(false)
  })

  it('should evaluate nullish coalescing', () => {
    expect(evalGML('null ?? "default"')).toBe('default')
    expect(evalGML('"value" ?? "default"')).toBe('value')
  })

  it('should evaluate IN operator', () => {
    expect(evalGML('2 IN [1, 2, 3]')).toBe(true)
    expect(evalGML('4 IN [1, 2, 3]')).toBe(false)
  })

  it('should evaluate LIKE operator', () => {
    expect(evalGML('"hello" LIKE "hel%"')).toBe(true)
    expect(evalGML('"hello" LIKE "h_llo"')).toBe(true)
    expect(evalGML('"hello" LIKE "world%"')).toBe(false)
  })
})

describe('GML Parser - Unary Expressions', () => {
  it('should evaluate logical NOT', () => {
    expect(evalGML('!true')).toBe(false)
    expect(evalGML('!false')).toBe(true)
    expect(evalGML('NOT true')).toBe(false)
  })

  it('should evaluate unary minus', () => {
    expect(evalGML('-5')).toBe(-5)
    expect(evalGML('--5')).toBe(5)
  })

  it('should evaluate unary plus', () => {
    expect(evalGML('+5')).toBe(5)
  })
})

describe('GML Parser - Conditional Expressions', () => {
  it('should evaluate ternary expressions', () => {
    expect(evalGML('true ? 1 : 2')).toBe(1)
    expect(evalGML('false ? 1 : 2')).toBe(2)
    expect(evalGML('x > 0 ? "positive" : "non-positive"', { x: 5 })).toBe('positive')
    expect(evalGML('x > 0 ? "positive" : "non-positive"', { x: -5 })).toBe('non-positive')
  })

  it('should evaluate nested ternary expressions', () => {
    expect(evalGML('x > 0 ? "positive" : x < 0 ? "negative" : "zero"', { x: 5 })).toBe('positive')
    expect(evalGML('x > 0 ? "positive" : x < 0 ? "negative" : "zero"', { x: -5 })).toBe('negative')
    expect(evalGML('x > 0 ? "positive" : x < 0 ? "negative" : "zero"', { x: 0 })).toBe('zero')
  })
})

describe('GML Parser - CASE Expressions', () => {
  it('should evaluate simple CASE expression', () => {
    expect(evalGML('CASE WHEN x > 0 THEN "positive" ELSE "non-positive" END', { x: 5 })).toBe('positive')
    expect(evalGML('CASE WHEN x > 0 THEN "positive" ELSE "non-positive" END', { x: -5 })).toBe('non-positive')
  })

  it('should evaluate CASE with multiple WHEN clauses', () => {
    const expr = 'CASE WHEN x > 0 THEN "positive" WHEN x < 0 THEN "negative" ELSE "zero" END'
    expect(evalGML(expr, { x: 5 })).toBe('positive')
    expect(evalGML(expr, { x: -5 })).toBe('negative')
    expect(evalGML(expr, { x: 0 })).toBe('zero')
  })

  it('should return undefined if no case matches and no ELSE', () => {
    expect(evalGML('CASE WHEN x > 0 THEN "positive" END', { x: -5 })).toBe(undefined)
  })
})

describe('GML Parser - Member Access', () => {
  it('should access object properties', () => {
    expect(evalGML('obj.a', { obj: { a: 1 } })).toBe(1)
    expect(evalGML('obj.nested.value', { obj: { nested: { value: 42 } } })).toBe(42)
  })

  it('should access array elements', () => {
    expect(evalGML('arr[0]', { arr: [1, 2, 3] })).toBe(1)
    expect(evalGML('arr[1]', { arr: [1, 2, 3] })).toBe(2)
  })

  it('should access with computed property', () => {
    expect(evalGML('obj[key]', { obj: { a: 1, b: 2 }, key: 'b' })).toBe(2)
  })
})

describe('GML Parser - Optional Chaining', () => {
  it('should return undefined for null/undefined with optional chaining', () => {
    expect(evalGML('obj?.a', { obj: null })).toBe(undefined)
    expect(evalGML('obj?.a', { obj: undefined })).toBe(undefined)
    expect(evalGML('obj?.a?.b', { obj: { a: null } })).toBe(undefined)
  })

  it('should access property when object exists', () => {
    expect(evalGML('obj?.a', { obj: { a: 1 } })).toBe(1)
    expect(evalGML('obj?.nested?.value', { obj: { nested: { value: 42 } } })).toBe(42)
  })
})

describe('GML Parser - Arrow Functions', () => {
  it('should parse single parameter arrow function', () => {
    expect(evalGML('[1, 2, 3].map(x => x * 2)')).toEqual([2, 4, 6])
  })

  it('should parse multi-parameter arrow function', () => {
    expect(evalGML('[1, 2, 3].reduce((acc, x) => acc + x, 0)')).toBe(6)
  })

  it('should parse parenthesized single parameter', () => {
    expect(evalGML('[1, 2, 3].filter((x) => x > 1)')).toEqual([2, 3])
  })
})

describe('GML Evaluator - Built-in Functions', () => {
  it('should evaluate DATE function', () => {
    const result = evalGML('DATE()') as string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should evaluate DATE with offset', () => {
    const now = new Date()
    const result = new Date(evalGML('DATE("+1d")') as string)
    expect(result.getTime()).toBeGreaterThan(now.getTime())
  })

  it('should evaluate NOW function', () => {
    const result = evalGML('NOW()') as string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('should evaluate COUNT function', () => {
    expect(evalGML('COUNT(arr)', { arr: [1, 2, 3] })).toBe(3)
    expect(evalGML('COUNT(arr)', { arr: [] })).toBe(0)
  })

  it('should evaluate SUM function', () => {
    expect(evalGML('SUM(arr)', { arr: [1, 2, 3, 4] })).toBe(10)
  })

  it('should evaluate AVG function', () => {
    expect(evalGML('AVG(arr)', { arr: [1, 2, 3, 4] })).toBe(2.5)
  })

  it('should evaluate MIN function', () => {
    expect(evalGML('MIN(arr)', { arr: [3, 1, 4, 1, 5] })).toBe(1)
  })

  it('should evaluate MAX function', () => {
    expect(evalGML('MAX(arr)', { arr: [3, 1, 4, 1, 5] })).toBe(5)
  })

  it('should evaluate LEN function', () => {
    expect(evalGML('LEN("hello")')).toBe(5)
    expect(evalGML('LEN(arr)', { arr: [1, 2, 3] })).toBe(3)
  })

  it('should evaluate TRIM function', () => {
    expect(evalGML('TRIM("  hello  ")')).toBe('hello')
  })

  it('should evaluate UPPER function', () => {
    expect(evalGML('UPPER("hello")')).toBe('HELLO')
  })

  it('should evaluate LOWER function', () => {
    expect(evalGML('LOWER("HELLO")')).toBe('hello')
  })

  it('should evaluate ROUND function', () => {
    expect(evalGML('ROUND(3.7)')).toBe(4)
    expect(evalGML('ROUND(3.14159, 2)')).toBe(3.14)
  })

  it('should evaluate FLOOR function', () => {
    expect(evalGML('FLOOR(3.7)')).toBe(3)
  })

  it('should evaluate CEIL function', () => {
    expect(evalGML('CEIL(3.2)')).toBe(4)
  })

  it('should evaluate ABS function', () => {
    expect(evalGML('ABS(-5)')).toBe(5)
    expect(evalGML('ABS(5)')).toBe(5)
  })

  it('should evaluate IF function', () => {
    expect(evalGML('IF(true, 1, 2)')).toBe(1)
    expect(evalGML('IF(false, 1, 2)')).toBe(2)
  })

  it('should evaluate COALESCE function', () => {
    expect(evalGML('COALESCE(null, null, "value")')).toBe('value')
    expect(evalGML('COALESCE("first", "second")')).toBe('first')
  })
})

describe('GML Evaluator - Array Methods', () => {
  it('should evaluate filter method', () => {
    expect(evalGML('[1, 2, 3, 4].filter(x => x > 2)')).toEqual([3, 4])
  })

  it('should evaluate map method', () => {
    expect(evalGML('[1, 2, 3].map(x => x * 2)')).toEqual([2, 4, 6])
  })

  it('should evaluate map with property name', () => {
    expect(evalGML('arr.map("name")', { arr: [{ name: 'a' }, { name: 'b' }] })).toEqual(['a', 'b'])
  })

  it('should evaluate reduce method', () => {
    expect(evalGML('[1, 2, 3, 4].reduce((acc, x) => acc + x, 0)')).toBe(10)
  })

  it('should evaluate find method', () => {
    expect(evalGML('[1, 2, 3, 4].find(x => x > 2)')).toBe(3)
    expect(evalGML('[1, 2, 3, 4].find(x => x > 10)')).toBe(undefined)
  })

  it('should evaluate findIndex method', () => {
    expect(evalGML('[1, 2, 3, 4].findIndex(x => x > 2)')).toBe(2)
    expect(evalGML('[1, 2, 3, 4].findIndex(x => x > 10)')).toBe(-1)
  })

  it('should evaluate some method', () => {
    expect(evalGML('[1, 2, 3].some(x => x > 2)')).toBe(true)
    expect(evalGML('[1, 2, 3].some(x => x > 10)')).toBe(false)
  })

  it('should evaluate every method', () => {
    expect(evalGML('[1, 2, 3].every(x => x > 0)')).toBe(true)
    expect(evalGML('[1, 2, 3].every(x => x > 2)')).toBe(false)
  })

  it('should evaluate includes method', () => {
    expect(evalGML('[1, 2, 3].includes(2)')).toBe(true)
    expect(evalGML('[1, 2, 3].includes(5)')).toBe(false)
  })

  it('should evaluate indexOf method', () => {
    expect(evalGML('[1, 2, 3].indexOf(2)')).toBe(1)
    expect(evalGML('[1, 2, 3].indexOf(5)')).toBe(-1)
  })

  it('should evaluate slice method', () => {
    expect(evalGML('[1, 2, 3, 4, 5].slice(1, 3)')).toEqual([2, 3])
    expect(evalGML('[1, 2, 3, 4, 5].slice(2)')).toEqual([3, 4, 5])
  })

  it('should evaluate concat method', () => {
    expect(evalGML('[1, 2].concat([3, 4])')).toEqual([1, 2, 3, 4])
  })

  it('should evaluate join method', () => {
    expect(evalGML('[1, 2, 3].join("-")')).toBe('1-2-3')
  })

  it('should evaluate sort method', () => {
    expect(evalGML('[3, 1, 4, 1, 5].sort()')).toEqual([1, 1, 3, 4, 5])
  })

  it('should evaluate reverse method', () => {
    expect(evalGML('[1, 2, 3].reverse()')).toEqual([3, 2, 1])
  })

  it('should evaluate first method', () => {
    expect(evalGML('[1, 2, 3].first()')).toBe(1)
  })

  it('should evaluate last method', () => {
    expect(evalGML('[1, 2, 3].last()')).toBe(3)
  })

  it('should evaluate take method', () => {
    expect(evalGML('[1, 2, 3, 4, 5].take(3)')).toEqual([1, 2, 3])
  })

  it('should evaluate skip method', () => {
    expect(evalGML('[1, 2, 3, 4, 5].skip(2)')).toEqual([3, 4, 5])
  })

  it('should evaluate distinct method', () => {
    expect(evalGML('[1, 2, 2, 3, 3, 3].distinct()')).toEqual([1, 2, 3])
  })

  it('should evaluate add method', () => {
    expect(evalGML('[1, 2].add(3)')).toEqual([1, 2, 3])
  })

  it('should evaluate sum method with property', () => {
    expect(evalGML('arr.sum("value")', { arr: [{ value: 1 }, { value: 2 }, { value: 3 }] })).toBe(6)
  })

  it('should evaluate avg method with property', () => {
    expect(evalGML('arr.avg("value")', { arr: [{ value: 1 }, { value: 2 }, { value: 3 }] })).toBe(2)
  })

  it('should evaluate group method', () => {
    const result = evalGML('arr.group("type")', {
      arr: [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ],
    }) as Array<{ key: string; val: unknown[] }>
    expect(result.length).toBe(2)
    expect(result.find(g => g.key === 'a')?.val.length).toBe(2)
    expect(result.find(g => g.key === 'b')?.val.length).toBe(1)
  })

  it('should evaluate groupBy method', () => {
    const result = evalGML('arr.groupBy("type")', {
      arr: [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ],
    }) as Record<string, unknown[]>
    expect(result.a.length).toBe(2)
    expect(result.b.length).toBe(1)
  })

  it('should evaluate proj method', () => {
    expect(
      evalGML('arr.proj("name, age")', {
        arr: [{ name: 'Alice', age: 30, city: 'NYC' }],
      })
    ).toEqual([{ name: 'Alice', age: 30 }])
  })

  it('should evaluate omit method', () => {
    expect(
      evalGML('arr.omit("city")', {
        arr: [{ name: 'Alice', age: 30, city: 'NYC' }],
      })
    ).toEqual([{ name: 'Alice', age: 30 }])
  })
})

describe('GML Evaluator - String Methods', () => {
  it('should evaluate trim methods', () => {
    expect(evalGML('"  hello  ".trim()')).toBe('hello')
    expect(evalGML('"  hello  ".trimStart()')).toBe('hello  ')
    expect(evalGML('"  hello  ".trimEnd()')).toBe('  hello')
  })

  it('should evaluate case methods', () => {
    expect(evalGML('"hello".toUpperCase()')).toBe('HELLO')
    expect(evalGML('"HELLO".toLowerCase()')).toBe('hello')
  })

  it('should evaluate startsWith and endsWith', () => {
    expect(evalGML('"hello".startsWith("hel")')).toBe(true)
    expect(evalGML('"hello".endsWith("lo")')).toBe(true)
  })

  it('should evaluate includes', () => {
    expect(evalGML('"hello".includes("ell")')).toBe(true)
    expect(evalGML('"hello".includes("xyz")')).toBe(false)
  })

  it('should evaluate indexOf and lastIndexOf', () => {
    expect(evalGML('"hello".indexOf("l")')).toBe(2)
    expect(evalGML('"hello".lastIndexOf("l")')).toBe(3)
  })

  it('should evaluate substring and slice', () => {
    expect(evalGML('"hello".substring(1, 4)')).toBe('ell')
    expect(evalGML('"hello".slice(1, 4)')).toBe('ell')
    expect(evalGML('"hello".slice(-2)')).toBe('lo')
  })

  it('should evaluate split', () => {
    expect(evalGML('"a,b,c".split(",")')).toEqual(['a', 'b', 'c'])
  })

  it('should evaluate replace', () => {
    expect(evalGML('"hello".replace("l", "L")')).toBe('heLlo')
    expect(evalGML('"hello".replaceAll("l", "L")')).toBe('heLLo')
  })

  it('should evaluate padStart and padEnd', () => {
    expect(evalGML('"5".padStart(3, "0")')).toBe('005')
    expect(evalGML('"5".padEnd(3, "0")')).toBe('500')
  })
})

describe('GML Evaluator - Object Methods', () => {
  it('should evaluate keys method', () => {
    expect(evalGML('obj.keys()', { obj: { a: 1, b: 2 } })).toEqual(['a', 'b'])
  })

  it('should evaluate values method', () => {
    expect(evalGML('obj.values()', { obj: { a: 1, b: 2 } })).toEqual([1, 2])
  })

  it('should evaluate entries method', () => {
    expect(evalGML('obj.entries()', { obj: { a: 1, b: 2 } })).toEqual([['a', 1], ['b', 2]])
  })

  it('should evaluate pick method', () => {
    expect(evalGML('obj.pick("a, c")', { obj: { a: 1, b: 2, c: 3 } })).toEqual({ a: 1, c: 3 })
  })

  it('should evaluate omit method', () => {
    expect(evalGML('obj.omit("b")', { obj: { a: 1, b: 2, c: 3 } })).toEqual({ a: 1, c: 3 })
  })

  it('should evaluate merge method', () => {
    expect(evalGML('obj.merge({ c: 3 })', { obj: { a: 1, b: 2 } })).toEqual({ a: 1, b: 2, c: 3 })
  })
})

describe('GML Evaluator - Assignment Statements', () => {
  it('should assign variables', () => {
    const result = parseGML('x = 10')
    expect(result.success).toBe(true)
    const context = createContext()
    evaluateGML(result.ast!, context)
    expect(context.variables.x).toBe(10)
  })

  it('should use assigned variables', () => {
    const result = parseGML('x = 10\ny = x * 2\ny')
    expect(result.success).toBe(true)
    const context = createContext()
    const { result: value } = evaluateGML(result.ast!, context)
    expect(value).toBe(20)
  })
})

describe('GML Evaluator - Context Scoping', () => {
  it('should access variables from context', () => {
    expect(evalGML('x + y', { x: 1, y: 2 })).toBe(3)
  })

  it('should access nested variables', () => {
    expect(evalGML('data.items[0].name', {
      data: {
        items: [{ name: 'first' }, { name: 'second' }],
      },
    })).toBe('first')
  })

  it('should shadow parent context variables', () => {
    const parent = createContext({ x: 1 })
    const child = createContext({ x: 2 }, parent)
    const result = parseGML('x')
    const { result: value } = evaluateGML(result.ast!, child)
    expect(value).toBe(2)
  })

  it('should access parent context variables when not shadowed', () => {
    const parent = createContext({ x: 1 })
    const child = createContext({ y: 2 }, parent)
    const result = parseGML('x + y')
    const { result: value } = evaluateGML(result.ast!, child)
    expect(value).toBe(3)
  })
})

describe('GML Complex Expressions', () => {
  it('should evaluate chained method calls', () => {
    expect(evalGML('[1, 2, 3, 4, 5].filter(x => x > 2).map(x => x * 2)')).toEqual([6, 8, 10])
  })

  it('should evaluate nested array operations', () => {
    expect(
      evalGML('items.filter(x => x.active).map(x => x.value).sum()', {
        items: [
          { active: true, value: 10 },
          { active: false, value: 20 },
          { active: true, value: 30 },
        ],
      })
    ).toBe(40)
  })

  it('should evaluate object transformation', () => {
    expect(
      evalGML(
        '{ total: items.sum("price"), count: items.count(), avg: items.avg("price") }',
        {
          items: [{ price: 10 }, { price: 20 }, { price: 30 }],
        }
      )
    ).toEqual({ total: 60, count: 3, avg: 20 })
  })

  it('should evaluate conditional with method calls', () => {
    expect(
      evalGML('items.count() > 0 ? items.first().name : "empty"', {
        items: [{ name: 'test' }],
      })
    ).toBe('test')
  })
})
