/**
 * WebSocket Client
 * Handles real-time communication with the FDL Runtime backend
 */

import type {
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  ExecutionEvent,
  ExecutionEventCallback,
  ConnectionState,
  ConnectionStateCallback,
  WsClientConfig,
} from './types'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<WsClientConfig> = {
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  heartbeatInterval: 30000,
}

/**
 * Pending request handler
 */
interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * WebSocket client for FDL Runtime
 */
export class WsClient {
  private config: Required<WsClientConfig>
  private ws: WebSocket | null = null
  private connectionState: ConnectionState = 'disconnected'
  private reconnectCount = 0
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private requestId = 0
  private pendingRequests = new Map<JsonRpcId, PendingRequest>()
  private subscriptions = new Map<string, Set<ExecutionEventCallback>>()
  private stateListeners = new Set<ConnectionStateCallback>()

  constructor(config: WsClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      reconnectAttempts: config.reconnectAttempts ?? DEFAULT_CONFIG.reconnectAttempts!,
      reconnectDelay: config.reconnectDelay ?? DEFAULT_CONFIG.reconnectDelay!,
      heartbeatInterval: config.heartbeatInterval ?? DEFAULT_CONFIG.heartbeatInterval!,
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      this.setConnectionState('connecting')

      try {
        const url = new URL(this.config.url)
        if (this.config.token) {
          url.searchParams.set('token', this.config.token)
        }

        this.ws = new WebSocket(url.toString())

        this.ws.onopen = () => {
          this.setConnectionState('connected')
          this.reconnectCount = 0
          this.startHeartbeat()
          resolve()
        }

        this.ws.onclose = (event) => {
          this.handleClose(event)
        }

        this.ws.onerror = (event) => {
          this.setConnectionState('error')
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data)
        }
      } catch (error) {
        this.setConnectionState('error')
        reject(error)
      }
    })
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect')
      this.ws = null
    }
    this.setConnectionState('disconnected')
    this.pendingRequests.forEach(({ reject, timeout }) => {
      clearTimeout(timeout)
      reject(new Error('Connection closed'))
    })
    this.pendingRequests.clear()
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState
  }

  /**
   * Add connection state listener
   */
  onStateChange(callback: ConnectionStateCallback): () => void {
    this.stateListeners.add(callback)
    return () => this.stateListeners.delete(callback)
  }

  /**
   * Send a JSON-RPC request and wait for response
   */
  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const id = ++this.requestId
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error('Request timeout'))
      }, 30000)

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      })

      this.ws!.send(JSON.stringify(request))
    })
  }

  /**
   * Send a notification (no response expected)
   */
  notify(method: string, params?: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected')
    }

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
    }

    this.ws.send(JSON.stringify(request))
  }

  /**
   * Subscribe to execution events
   */
  async subscribe(
    executionId: string,
    callback: ExecutionEventCallback
  ): Promise<() => void> {
    // Add to local subscriptions
    let callbacks = this.subscriptions.get(executionId)
    if (!callbacks) {
      callbacks = new Set()
      this.subscriptions.set(executionId, callbacks)
    }
    callbacks.add(callback)

    // Send subscribe request to server
    await this.request('subscribe', { execution_id: executionId })

    // Return unsubscribe function
    return () => {
      this.unsubscribe(executionId, callback)
    }
  }

  /**
   * Unsubscribe from execution events
   */
  async unsubscribe(
    executionId: string,
    callback?: ExecutionEventCallback
  ): Promise<void> {
    const callbacks = this.subscriptions.get(executionId)
    if (!callbacks) return

    if (callback) {
      callbacks.delete(callback)
    }

    if (callbacks.size === 0 || !callback) {
      this.subscriptions.delete(executionId)
      await this.request('unsubscribe', { execution_id: executionId })
    }
  }

  /**
   * Get execution status
   */
  async getExecutionStatus(executionId: string): Promise<{
    execution_id: string
    status: string
  }> {
    return this.request('execute.status', { execution_id: executionId })
  }

  /**
   * List flows
   */
  async listFlows(): Promise<{
    flows: unknown[]
    total: number
  }> {
    return this.request('flow.list')
  }

  /**
   * Get a flow by ID
   */
  async getFlow(flowId: string): Promise<unknown> {
    return this.request('flow.get', { flow_id: flowId })
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as JsonRpcResponse

      // Check if it's a response to a pending request
      if (message.id !== undefined && message.id !== null) {
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.id)

          if (message.error) {
            pending.reject(new Error(message.error.message))
          } else {
            pending.resolve(message.result)
          }
          return
        }
      }

      // Check if it's a notification (execution event)
      if (message.result && typeof message.result === 'object') {
        const result = message.result as { method?: string; params?: ExecutionEvent }
        if (result.method === 'execution.event' && result.params) {
          this.handleExecutionEvent(result.params)
        }
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error)
    }
  }

  /**
   * Handle execution event
   */
  private handleExecutionEvent(event: ExecutionEvent): void {
    const callbacks = this.subscriptions.get(event.execution_id)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(event)
        } catch (error) {
          console.error('Error in execution event callback:', error)
        }
      })
    }
  }

  /**
   * Handle WebSocket close
   */
  private handleClose(event: CloseEvent): void {
    this.stopHeartbeat()
    this.setConnectionState('disconnected')

    // Try to reconnect if not a clean close
    if (event.code !== 1000 && this.reconnectCount < this.config.reconnectAttempts) {
      this.reconnectCount++
      const delay = this.config.reconnectDelay * Math.pow(2, this.reconnectCount - 1)
      setTimeout(() => {
        this.connect().catch(console.error)
      }, delay)
    }
  }

  /**
   * Set connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    this.connectionState = state
    this.stateListeners.forEach((callback) => {
      try {
        callback(state)
      } catch (error) {
        console.error('Error in state callback:', error)
      }
    })
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, this.config.heartbeatInterval)
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

/**
 * Create a new WebSocket client
 */
export function createWsClient(config: WsClientConfig): WsClient {
  return new WsClient(config)
}
