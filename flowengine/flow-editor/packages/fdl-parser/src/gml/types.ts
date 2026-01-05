/**
 * GML (Generic Mapping Language) Type Definitions
 */

// Token types for GML lexer
export type GMLTokenType =
  | 'identifier'
  | 'number'
  | 'string'
  | 'template' // Template string `...`
  | 'operator'
  | 'keyword'
  | 'punctuation'
  | 'comment'
  | 'whitespace'
  | 'newline'
  | 'eof'
  | 'unknown'

// Token structure
export interface GMLToken {
  type: GMLTokenType
  value: string
  start: number
  end: number
  line: number
  column: number
}

// AST Node types
export type GMLNodeType =
  | 'Program'
  | 'AssignmentStatement'
  | 'Identifier'
  | 'MemberExpression'
  | 'CallExpression'
  | 'BinaryExpression'
  | 'UnaryExpression'
  | 'ConditionalExpression' // a ? b : c
  | 'CaseExpression' // CASE WHEN ... THEN ... END
  | 'NumberLiteral'
  | 'StringLiteral'
  | 'TemplateLiteral'
  | 'BooleanLiteral'
  | 'NullLiteral'
  | 'ArrayExpression'
  | 'ObjectExpression'
  | 'SpreadElement' // ...obj
  | 'Property'
  | 'ArrowFunction' // x => x.value

// Base AST node
export interface GMLASTNode {
  type: GMLNodeType
  start: number
  end: number
}

// Program - root node containing statements
export interface GMLProgram extends GMLASTNode {
  type: 'Program'
  body: GMLStatement[]
}

// Statement types
export type GMLStatement = GMLAssignmentStatement | GMLExpression

// Assignment: name = expression
export interface GMLAssignmentStatement extends GMLASTNode {
  type: 'AssignmentStatement'
  left: GMLIdentifier | GMLMemberExpression
  right: GMLExpression
}

// Expression types
export type GMLExpression =
  | GMLIdentifier
  | GMLMemberExpression
  | GMLCallExpression
  | GMLBinaryExpression
  | GMLUnaryExpression
  | GMLConditionalExpression
  | GMLCaseExpression
  | GMLLiteral
  | GMLArrayExpression
  | GMLObjectExpression
  | GMLArrowFunction
  | GMLSpreadElement

// Identifier: variable name
export interface GMLIdentifier extends GMLASTNode {
  type: 'Identifier'
  name: string
}

// Member access: obj.prop or obj[expr] or obj?.prop (optional chaining)
export interface GMLMemberExpression extends GMLASTNode {
  type: 'MemberExpression'
  object: GMLExpression
  property: GMLExpression
  computed: boolean // true for obj[expr], false for obj.prop
  optional?: boolean // true for obj?.prop (optional chaining)
}

// Function call: func(args) or obj.method(args) or obj?.method(args)
export interface GMLCallExpression extends GMLASTNode {
  type: 'CallExpression'
  callee: GMLExpression
  arguments: GMLExpression[]
  optional?: boolean // true for obj?.method() (optional chaining)
}

// Binary operations: a + b, a && b, etc.
export interface GMLBinaryExpression extends GMLASTNode {
  type: 'BinaryExpression'
  operator: string
  left: GMLExpression
  right: GMLExpression
}

// Unary operations: !a, -b
export interface GMLUnaryExpression extends GMLASTNode {
  type: 'UnaryExpression'
  operator: string
  argument: GMLExpression
  prefix: boolean
}

// Ternary: condition ? consequent : alternate
export interface GMLConditionalExpression extends GMLASTNode {
  type: 'ConditionalExpression'
  test: GMLExpression
  consequent: GMLExpression
  alternate: GMLExpression
}

// CASE expression
export interface GMLCaseWhen {
  when: GMLExpression
  then: GMLExpression
}

export interface GMLCaseExpression extends GMLASTNode {
  type: 'CaseExpression'
  cases: GMLCaseWhen[]
  else?: GMLExpression
}

// Literals
export type GMLLiteral =
  | GMLNumberLiteral
  | GMLStringLiteral
  | GMLTemplateLiteral
  | GMLBooleanLiteral
  | GMLNullLiteral

export interface GMLNumberLiteral extends GMLASTNode {
  type: 'NumberLiteral'
  value: number
  raw: string
}

export interface GMLStringLiteral extends GMLASTNode {
  type: 'StringLiteral'
  value: string
  raw: string
}

export interface GMLTemplateLiteral extends GMLASTNode {
  type: 'TemplateLiteral'
  quasis: string[] // Static parts
  expressions: GMLExpression[] // Dynamic parts
}

export interface GMLBooleanLiteral extends GMLASTNode {
  type: 'BooleanLiteral'
  value: boolean
}

export interface GMLNullLiteral extends GMLASTNode {
  type: 'NullLiteral'
}

// Array: [a, b, c]
export interface GMLArrayExpression extends GMLASTNode {
  type: 'ArrayExpression'
  elements: GMLExpression[]
}

// Object: {a: 1, b: 2} or {a, b}
export interface GMLObjectExpression extends GMLASTNode {
  type: 'ObjectExpression'
  properties: (GMLProperty | GMLSpreadElement)[]
}

export interface GMLProperty extends GMLASTNode {
  type: 'Property'
  key: GMLIdentifier | GMLStringLiteral
  value: GMLExpression
  shorthand: boolean // true for {a} instead of {a: a}
}

// Spread: ...obj
export interface GMLSpreadElement extends GMLASTNode {
  type: 'SpreadElement'
  argument: GMLExpression
}

// Arrow function: x => x.value or (x, y) => x + y
export interface GMLArrowFunction extends GMLASTNode {
  type: 'ArrowFunction'
  params: GMLIdentifier[]
  body: GMLExpression
}

// Evaluation context
export interface GMLContext {
  variables: Record<string, unknown>
  parent?: GMLContext
}

// Parse result
export interface GMLParseResult {
  success: boolean
  ast?: GMLProgram
  errors: GMLParseError[]
}

// Parse error
export interface GMLParseError {
  message: string
  line: number
  column: number
  start: number
  end: number
}

// GML Keywords
export const GML_KEYWORDS = ['CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'IN', 'LIKE', 'AND', 'OR', 'NOT', 'true', 'false', 'null']

// GML Operators (ordered by precedence, descending)
export const GML_OPERATORS = [
  '||', '??', // Logical OR, Nullish coalescing
  '&&', // Logical AND
  '|', // Bitwise OR
  '^', // Bitwise XOR
  '&', // Bitwise AND
  '==', '!=', '===', '!==', // Equality
  '<', '>', '<=', '>=', 'IN', 'LIKE', // Comparison
  '<<', '>>', // Shift
  '+', '-', // Addition
  '*', '/', '%', // Multiplication
  '!', // Unary NOT
  '.', // Member access
]

// Built-in functions
export const GML_BUILTINS = [
  'DATE', 'TIME', 'NOW',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
  'LEN', 'TRIM', 'UPPER', 'LOWER',
  'ROUND', 'FLOOR', 'CEIL', 'ABS',
  'IF', 'COALESCE',
]

// Array prototype methods
export const GML_ARRAY_METHODS = [
  'filter', 'map', 'reduce', 'find', 'findIndex',
  'some', 'every', 'includes', 'indexOf',
  'slice', 'concat', 'join', 'sort', 'reverse',
  'push', 'pop', 'shift', 'unshift',
  'add', 'addAll', 'remove', 'removeAt',
  'first', 'last', 'take', 'skip',
  'group', 'groupBy', 'distinct', 'flatten',
  'sum', 'avg', 'min', 'max', 'count',
  'proj', 'pick', 'omit',
]

// String prototype methods
export const GML_STRING_METHODS = [
  'length', 'trim', 'trimStart', 'trimEnd',
  'toUpperCase', 'toLowerCase',
  'startsWith', 'endsWith', 'includes',
  'indexOf', 'lastIndexOf',
  'substring', 'slice', 'substr',
  'split', 'replace', 'replaceAll',
  'padStart', 'padEnd',
  'charAt', 'charCodeAt',
]

// Object prototype methods
export const GML_OBJECT_METHODS = [
  'keys', 'values', 'entries',
  'pick', 'omit', 'merge',
]
