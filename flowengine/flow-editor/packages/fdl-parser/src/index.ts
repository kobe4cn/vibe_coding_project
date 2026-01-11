/**
 * FDL Parser Package
 * Provides FDL YAML parsing, serialization, and GML expression support
 */

// FDL types
export * from './fdl/types'

// FDL parser and serializer
export { parseFDL, validateFDL, parseTypeString } from './fdl/parser'
export { serializeFDL, formatFDL, typeToString } from './fdl/serializer'

// GML types and parser
export * from './gml/types'
export { parseGML, tokenizeGML } from './gml/parser'
export {
  evaluateGML,
  createContext,
  // UDF 动态加载支持
  compileUdf,
  compileUdfs,
  registerCustomFunction,
  unregisterCustomFunction,
  testUdf,
} from './gml/evaluator'

// GML error messages and diagnostics
export {
  createDiagnostic,
  getErrorCodeDescription,
  GMLErrorCode,
  GML_BUILTIN_FUNCTIONS,
  GML_ARRAY_METHODS,
  GML_STRING_METHODS,
  GML_OBJECT_METHODS,
} from './gml/errorMessages'
export type { GMLDiagnostic, QuickFixSuggestion } from './gml/errorMessages'
