/**
 * GML Parser
 * Tokenizes and parses GML expressions into AST
 */

import type {
  GMLToken,
  GMLTokenType,
  GMLProgram,
  GMLStatement,
  GMLExpression,
  GMLIdentifier,
  GMLMemberExpression,
  GMLCallExpression,
  GMLBinaryExpression,
  GMLUnaryExpression,
  GMLConditionalExpression,
  GMLCaseExpression,
  GMLNumberLiteral,
  GMLStringLiteral,
  GMLTemplateLiteral,
  GMLBooleanLiteral,
  GMLNullLiteral,
  GMLArrayExpression,
  GMLObjectExpression,
  GMLProperty,
  GMLSpreadElement,
  GMLArrowFunction,
  GMLAssignmentStatement,
  GMLParseResult,
  GMLParseError,
} from './types'

import { GML_KEYWORDS } from './types'

/**
 * Tokenize GML expression
 */
export function tokenizeGML(input: string): GMLToken[] {
  const tokens: GMLToken[] = []
  let pos = 0
  let line = 1
  let column = 1

  function advance(count = 1) {
    for (let i = 0; i < count; i++) {
      if (input[pos] === '\n') {
        line++
        column = 1
      } else {
        column++
      }
      pos++
    }
  }

  function peek(offset = 0): string {
    return input[pos + offset] || ''
  }

  function createToken(type: GMLTokenType, value: string, start: number): GMLToken {
    return {
      type,
      value,
      start,
      end: pos,
      line,
      column: column - value.length,
    }
  }

  while (pos < input.length) {
    const start = pos
    const startLine = line
    const startColumn = column
    const char = input[pos]

    // Whitespace
    if (/\s/.test(char)) {
      if (char === '\n') {
        tokens.push(createToken('newline', char, start))
      }
      advance()
      continue
    }

    // Comments (# to end of line)
    if (char === '#') {
      let value = ''
      while (pos < input.length && input[pos] !== '\n') {
        value += input[pos]
        advance()
      }
      tokens.push({ type: 'comment', value, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Numbers
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(peek(1)))) {
      let value = ''
      while (pos < input.length && /[0-9.]/.test(input[pos])) {
        value += input[pos]
        advance()
      }
      // Handle scientific notation
      if ((input[pos] === 'e' || input[pos] === 'E') && /[0-9+-]/.test(peek(1))) {
        value += input[pos]
        advance()
        if (input[pos] === '+' || input[pos] === '-') {
          value += input[pos]
          advance()
        }
        while (pos < input.length && /[0-9]/.test(input[pos])) {
          value += input[pos]
          advance()
        }
      }
      tokens.push({ type: 'number', value, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Strings (single or double quotes)
    if (char === "'" || char === '"') {
      const quote = char
      let value = quote
      advance()
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          value += input[pos]
          advance()
        }
        value += input[pos]
        advance()
      }
      if (pos < input.length) {
        value += input[pos]
        advance()
      }
      tokens.push({ type: 'string', value, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Template strings (backtick)
    if (char === '`') {
      let value = char
      advance()
      while (pos < input.length && input[pos] !== '`') {
        if (input[pos] === '\\' && pos + 1 < input.length) {
          value += input[pos]
          advance()
        }
        value += input[pos]
        advance()
      }
      if (pos < input.length) {
        value += input[pos]
        advance()
      }
      tokens.push({ type: 'template', value, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Identifiers and keywords
    if (/[a-zA-Z_$]/.test(char)) {
      let value = ''
      while (pos < input.length && /[a-zA-Z0-9_$]/.test(input[pos])) {
        value += input[pos]
        advance()
      }
      const type = GML_KEYWORDS.includes(value) ? 'keyword' : 'identifier'
      tokens.push({ type, value, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Multi-character operators
    const twoChar = input.slice(pos, pos + 2)
    const threeChar = input.slice(pos, pos + 3)

    if (['===', '!==', '...'].includes(threeChar)) {
      advance(3)
      tokens.push({ type: 'operator', value: threeChar, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    if (['==', '!=', '<=', '>=', '&&', '||', '??', '=>', '<<', '>>'].includes(twoChar)) {
      advance(2)
      tokens.push({ type: 'operator', value: twoChar, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Single character operators and punctuation
    if ('+-*/%<>=!&|^~?:.'.includes(char)) {
      advance()
      tokens.push({ type: 'operator', value: char, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    if ('()[]{},:;'.includes(char)) {
      advance()
      tokens.push({ type: 'punctuation', value: char, start, end: pos, line: startLine, column: startColumn })
      continue
    }

    // Unknown character
    advance()
    tokens.push({ type: 'unknown', value: char, start, end: pos, line: startLine, column: startColumn })
  }

  tokens.push({ type: 'eof', value: '', start: pos, end: pos, line, column })
  return tokens
}

/**
 * Parser class
 */
class GMLParser {
  private tokens: GMLToken[]
  private pos: number = 0
  private errors: GMLParseError[] = []

  constructor(tokens: GMLToken[]) {
    // Filter out whitespace and comments
    this.tokens = tokens.filter(t => t.type !== 'whitespace' && t.type !== 'comment')
  }

  private peek(offset = 0): GMLToken {
    return this.tokens[this.pos + offset] || { type: 'eof', value: '', start: 0, end: 0, line: 0, column: 0 }
  }

  private current(): GMLToken {
    return this.peek()
  }

  private advance(): GMLToken {
    return this.tokens[this.pos++] || { type: 'eof', value: '', start: 0, end: 0, line: 0, column: 0 }
  }

  private expect(typeOrValue: GMLTokenType | string): GMLToken {
    const token = this.current()
    if (token.type === typeOrValue || token.value === typeOrValue) {
      return this.advance()
    }
    this.error(`Expected '${typeOrValue}', got '${token.value}'`)
    return token
  }

  private error(message: string) {
    const token = this.current()
    this.errors.push({
      message,
      line: token.line,
      column: token.column,
      start: token.start,
      end: token.end,
    })
  }

  private skipNewlines() {
    while (this.current().type === 'newline') {
      this.advance()
    }
  }

  parse(): GMLParseResult {
    try {
      const program = this.parseProgram()
      return {
        success: this.errors.length === 0,
        ast: program,
        errors: this.errors,
      }
    } catch (e) {
      this.error(`Parse error: ${e}`)
      return {
        success: false,
        errors: this.errors,
      }
    }
  }

  private parseProgram(): GMLProgram {
    const start = this.current().start
    const body: GMLStatement[] = []

    this.skipNewlines()

    while (this.current().type !== 'eof') {
      const stmt = this.parseStatement()
      if (stmt) {
        body.push(stmt)
      }
      this.skipNewlines()
      // Skip comma separators
      if (this.current().value === ',') {
        this.advance()
        this.skipNewlines()
      }
    }

    return {
      type: 'Program',
      body,
      start,
      end: this.current().end,
    }
  }

  private parseStatement(): GMLStatement {
    // Check if this looks like an assignment
    const start = this.current().start

    // Could be: identifier = expr or ...spread or just expr
    if (this.current().value === '...') {
      return this.parseExpression()
    }

    // Try to parse as assignment
    if (this.current().type === 'identifier') {
      const name = this.current().value
      const nextToken = this.peek(1)

      // Check for simple assignment: name = expr
      if (nextToken.value === '=') {
        this.advance() // consume identifier
        this.advance() // consume =
        const right = this.parseExpression()
        return {
          type: 'AssignmentStatement',
          left: { type: 'Identifier', name, start, end: start + name.length },
          right,
          start,
          end: right.end,
        } as GMLAssignmentStatement
      }
    }

    // Otherwise parse as expression
    return this.parseExpression()
  }

  private parseExpression(): GMLExpression {
    return this.parseConditional()
  }

  private parseConditional(): GMLExpression {
    const start = this.current().start
    let expr = this.parseLogicalOr()

    if (this.current().value === '?') {
      this.advance()
      const consequent = this.parseExpression()
      this.expect(':')
      const alternate = this.parseExpression()
      return {
        type: 'ConditionalExpression',
        test: expr,
        consequent,
        alternate,
        start,
        end: alternate.end,
      } as GMLConditionalExpression
    }

    return expr
  }

  private parseLogicalOr(): GMLExpression {
    let left = this.parseLogicalAnd()
    while (this.current().value === '||' || this.current().value === '??') {
      const op = this.advance().value
      const right = this.parseLogicalAnd()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseLogicalAnd(): GMLExpression {
    let left = this.parseEquality()
    while (this.current().value === '&&') {
      const op = this.advance().value
      const right = this.parseEquality()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseEquality(): GMLExpression {
    let left = this.parseComparison()
    while (['==', '!=', '===', '!=='].includes(this.current().value)) {
      const op = this.advance().value
      const right = this.parseComparison()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseComparison(): GMLExpression {
    let left = this.parseAdditive()
    while (['<', '>', '<=', '>=', 'IN', 'LIKE'].includes(this.current().value)) {
      const op = this.advance().value
      const right = this.parseAdditive()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseAdditive(): GMLExpression {
    let left = this.parseMultiplicative()
    while (['+', '-'].includes(this.current().value)) {
      const op = this.advance().value
      const right = this.parseMultiplicative()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseMultiplicative(): GMLExpression {
    let left = this.parseUnary()
    while (['*', '/', '%'].includes(this.current().value)) {
      const op = this.advance().value
      const right = this.parseUnary()
      left = {
        type: 'BinaryExpression',
        operator: op,
        left,
        right,
        start: left.start,
        end: right.end,
      } as GMLBinaryExpression
    }
    return left
  }

  private parseUnary(): GMLExpression {
    if (['!', '-', '+', 'NOT'].includes(this.current().value)) {
      const start = this.current().start
      const op = this.advance().value
      const argument = this.parseUnary()
      return {
        type: 'UnaryExpression',
        operator: op,
        argument,
        prefix: true,
        start,
        end: argument.end,
      } as GMLUnaryExpression
    }
    return this.parsePostfix()
  }

  private parsePostfix(): GMLExpression {
    let expr = this.parsePrimary()

    while (true) {
      if (this.current().value === '.') {
        // Member access: obj.prop
        this.advance()
        const prop = this.expect('identifier')
        expr = {
          type: 'MemberExpression',
          object: expr,
          property: {
            type: 'Identifier',
            name: prop.value,
            start: prop.start,
            end: prop.end,
          } as GMLIdentifier,
          computed: false,
          start: expr.start,
          end: prop.end,
        } as GMLMemberExpression
      } else if (this.current().value === '[') {
        // Computed member access: obj[expr]
        this.advance()
        const property = this.parseExpression()
        const end = this.expect(']')
        expr = {
          type: 'MemberExpression',
          object: expr,
          property,
          computed: true,
          start: expr.start,
          end: end.end,
        } as GMLMemberExpression
      } else if (this.current().value === '(') {
        // Function call: func(args)
        this.advance()
        const args: GMLExpression[] = []
        while (this.current().value !== ')' && this.current().type !== 'eof') {
          args.push(this.parseExpression())
          if (this.current().value === ',') {
            this.advance()
          }
        }
        const end = this.expect(')')
        expr = {
          type: 'CallExpression',
          callee: expr,
          arguments: args,
          start: expr.start,
          end: end.end,
        } as GMLCallExpression
      } else {
        break
      }
    }

    return expr
  }

  private parsePrimary(): GMLExpression {
    const token = this.current()

    // Spread: ...expr
    if (token.value === '...') {
      const start = token.start
      this.advance()
      const argument = this.parsePostfix()
      return {
        type: 'SpreadElement',
        argument,
        start,
        end: argument.end,
      } as GMLSpreadElement
    }

    // CASE expression
    if (token.value === 'CASE') {
      return this.parseCaseExpression()
    }

    // Parenthesized expression or arrow function
    if (token.value === '(') {
      return this.parseParenOrArrow()
    }

    // Array literal
    if (token.value === '[') {
      return this.parseArrayLiteral()
    }

    // Object literal
    if (token.value === '{') {
      return this.parseObjectLiteral()
    }

    // Number
    if (token.type === 'number') {
      this.advance()
      return {
        type: 'NumberLiteral',
        value: parseFloat(token.value),
        raw: token.value,
        start: token.start,
        end: token.end,
      } as GMLNumberLiteral
    }

    // String
    if (token.type === 'string') {
      this.advance()
      // Remove quotes
      const raw = token.value
      const value = raw.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"')
      return {
        type: 'StringLiteral',
        value,
        raw,
        start: token.start,
        end: token.end,
      } as GMLStringLiteral
    }

    // Template string
    if (token.type === 'template') {
      return this.parseTemplateLiteral()
    }

    // Boolean
    if (token.value === 'true' || token.value === 'false') {
      this.advance()
      return {
        type: 'BooleanLiteral',
        value: token.value === 'true',
        start: token.start,
        end: token.end,
      } as GMLBooleanLiteral
    }

    // Null
    if (token.value === 'null') {
      this.advance()
      return {
        type: 'NullLiteral',
        start: token.start,
        end: token.end,
      } as GMLNullLiteral
    }

    // Identifier
    if (token.type === 'identifier') {
      this.advance()

      // Check for arrow function: id => expr
      if (this.current().value === '=>') {
        this.advance()
        const body = this.parseExpression()
        return {
          type: 'ArrowFunction',
          params: [{ type: 'Identifier', name: token.value, start: token.start, end: token.end } as GMLIdentifier],
          body,
          start: token.start,
          end: body.end,
        } as GMLArrowFunction
      }

      return {
        type: 'Identifier',
        name: token.value,
        start: token.start,
        end: token.end,
      } as GMLIdentifier
    }

    this.error(`Unexpected token: ${token.value}`)
    this.advance()
    return {
      type: 'Identifier',
      name: '',
      start: token.start,
      end: token.end,
    } as GMLIdentifier
  }

  private parseCaseExpression(): GMLCaseExpression {
    const start = this.current().start
    this.expect('CASE')
    this.skipNewlines()

    const cases: { when: GMLExpression; then: GMLExpression }[] = []

    while (this.current().value === 'WHEN') {
      this.advance()
      const when = this.parseExpression()
      this.expect('THEN')
      const then = this.parseExpression()
      cases.push({ when, then })
      this.skipNewlines()
    }

    let elseExpr: GMLExpression | undefined
    if (this.current().value === 'ELSE') {
      this.advance()
      elseExpr = this.parseExpression()
    }

    const end = this.expect('END')

    return {
      type: 'CaseExpression',
      cases,
      else: elseExpr,
      start,
      end: end.end,
    }
  }

  private parseParenOrArrow(): GMLExpression {
    const start = this.current().start
    this.advance() // consume '('

    // Empty parens - might be () => expr
    if (this.current().value === ')') {
      this.advance()
      if (this.current().value === '=>') {
        this.advance()
        const body = this.parseExpression()
        return {
          type: 'ArrowFunction',
          params: [],
          body,
          start,
          end: body.end,
        } as GMLArrowFunction
      }
      // Empty tuple? Treat as null for now
      return { type: 'NullLiteral', start, end: this.current().end } as GMLNullLiteral
    }

    // Parse first expression
    const first = this.parseExpression()

    // If next is comma, might be arrow params
    if (this.current().value === ',') {
      const params: GMLIdentifier[] = []
      if (first.type === 'Identifier') {
        params.push(first)
      }

      while (this.current().value === ',') {
        this.advance()
        const param = this.parseExpression()
        if (param.type === 'Identifier') {
          params.push(param)
        }
      }

      this.expect(')')

      if (this.current().value === '=>') {
        this.advance()
        const body = this.parseExpression()
        return {
          type: 'ArrowFunction',
          params,
          body,
          start,
          end: body.end,
        } as GMLArrowFunction
      }

      // Otherwise it was a grouped expression list - return first? (edge case)
      return first
    }

    this.expect(')')

    // Check for arrow function: (x) => expr
    if (this.current().value === '=>') {
      this.advance()
      const body = this.parseExpression()
      const params: GMLIdentifier[] = first.type === 'Identifier' ? [first] : []
      return {
        type: 'ArrowFunction',
        params,
        body,
        start,
        end: body.end,
      } as GMLArrowFunction
    }

    // Just a parenthesized expression
    return first
  }

  private parseArrayLiteral(): GMLArrayExpression {
    const start = this.current().start
    this.expect('[')
    const elements: GMLExpression[] = []

    while (this.current().value !== ']' && this.current().type !== 'eof') {
      elements.push(this.parseExpression())
      if (this.current().value === ',') {
        this.advance()
      }
    }

    const end = this.expect(']')
    return {
      type: 'ArrayExpression',
      elements,
      start,
      end: end.end,
    }
  }

  private parseObjectLiteral(): GMLObjectExpression {
    const start = this.current().start
    this.expect('{')
    this.skipNewlines()
    const properties: (GMLProperty | GMLSpreadElement)[] = []

    while (this.current().value !== '}' && this.current().type !== 'eof') {
      // Spread: ...obj
      if (this.current().value === '...') {
        this.advance()
        const argument = this.parsePostfix()
        properties.push({
          type: 'SpreadElement',
          argument,
          start: argument.start - 3,
          end: argument.end,
        } as GMLSpreadElement)
      } else {
        // Property: key: value or shorthand key
        const key = this.current()
        if (key.type !== 'identifier' && key.type !== 'string') {
          this.error(`Expected property key, got ${key.value}`)
          this.advance()
          continue
        }
        this.advance()

        let value: GMLExpression
        let shorthand = false

        if (this.current().value === ':') {
          this.advance()
          value = this.parseExpression()
        } else {
          // Shorthand: { a } means { a: a }
          shorthand = true
          value = {
            type: 'Identifier',
            name: key.type === 'string' ? key.value.slice(1, -1) : key.value,
            start: key.start,
            end: key.end,
          } as GMLIdentifier
        }

        properties.push({
          type: 'Property',
          key:
            key.type === 'string'
              ? ({ type: 'StringLiteral', value: key.value.slice(1, -1), raw: key.value, start: key.start, end: key.end } as GMLStringLiteral)
              : ({ type: 'Identifier', name: key.value, start: key.start, end: key.end } as GMLIdentifier),
          value,
          shorthand,
          start: key.start,
          end: value.end,
        } as GMLProperty)
      }

      this.skipNewlines()
      if (this.current().value === ',') {
        this.advance()
        this.skipNewlines()
      }
    }

    const end = this.expect('}')
    return {
      type: 'ObjectExpression',
      properties,
      start,
      end: end.end,
    }
  }

  private parseTemplateLiteral(): GMLTemplateLiteral {
    const token = this.advance()
    const raw = token.value.slice(1, -1) // Remove backticks

    // Parse template string with ${...} expressions
    const quasis: string[] = []
    const expressions: GMLExpression[] = []

    let i = 0
    let current = ''

    while (i < raw.length) {
      if (raw[i] === '$' && raw[i + 1] === '{') {
        quasis.push(current)
        current = ''
        i += 2

        // Find matching }
        let depth = 1
        let exprStr = ''
        while (i < raw.length && depth > 0) {
          if (raw[i] === '{') depth++
          if (raw[i] === '}') depth--
          if (depth > 0) {
            exprStr += raw[i]
          }
          i++
        }

        // Parse the expression
        const exprTokens = tokenizeGML(exprStr)
        const parser = new GMLParser(exprTokens)
        const result = parser.parse()
        if (result.ast && result.ast.body.length > 0) {
          const stmt = result.ast.body[0]
          expressions.push(stmt as GMLExpression)
        }
      } else {
        current += raw[i]
        i++
      }
    }

    quasis.push(current)

    return {
      type: 'TemplateLiteral',
      quasis,
      expressions,
      start: token.start,
      end: token.end,
    }
  }
}

/**
 * Parse GML expression string
 */
export function parseGML(input: string): GMLParseResult {
  const tokens = tokenizeGML(input)
  const parser = new GMLParser(tokens)
  return parser.parse()
}
