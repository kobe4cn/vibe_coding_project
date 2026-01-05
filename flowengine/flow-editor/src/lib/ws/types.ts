/**
 * WebSocket Client Types
 * Types for JSON-RPC 2.0 protocol and execution events
 */

/**
 * JSON-RPC request ID
 */
export type JsonRpcId = string | number | null

/**
 * JSON-RPC 2.0 request
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
  id?: JsonRpcId
}

/**
 * JSON-RPC 2.0 response
 */
export interface JsonRpcResponse {
  jsonrpc: '2.0'
  result?: unknown
  error?: JsonRpcError
  id: JsonRpcId
}

/**
 * JSON-RPC error
 */
export interface JsonRpcError {
  code: number
  message: string
  data?: unknown
}

/**
 * Execution event types
 */
export type ExecutionEventType =
  | 'started'
  | 'node_started'
  | 'node_completed'
  | 'node_failed'
  | 'progress'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Execution event
 */
export interface ExecutionEvent {
  execution_id: string
  event_type: ExecutionEventType
  data: Record<string, unknown>
  timestamp: string
}

/**
 * Execution notification (JSON-RPC notification format)
 */
export interface ExecutionNotification {
  method: 'execution.event'
  params: ExecutionEvent
}

/**
 * WebSocket connection state
 */
export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * WebSocket client configuration
 */
export interface WsClientConfig {
  url: string
  token?: string
  reconnectAttempts?: number
  reconnectDelay?: number
  heartbeatInterval?: number
}

/**
 * Subscription callback
 */
export type ExecutionEventCallback = (event: ExecutionEvent) => void

/**
 * Connection state callback
 */
export type ConnectionStateCallback = (state: ConnectionState) => void
