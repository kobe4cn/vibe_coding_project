/**
 * WebSocket React Hooks
 * Provides React integration for WebSocket client
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { WsClient, createWsClient } from './client'
import type {
  ConnectionState,
  ExecutionEvent,
  ExecutionEventCallback,
  WsClientConfig,
} from './types'

/**
 * Hook to use WebSocket client
 */
export function useWsClient(config: WsClientConfig | null): {
  client: WsClient | null
  connectionState: ConnectionState
  connect: () => Promise<void>
  disconnect: () => void
} {
  const [client, setClient] = useState<WsClient | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')

  useEffect(() => {
    if (!config) {
      setClient(null)
      setConnectionState('disconnected')
      return
    }

    const wsClient = createWsClient(config)
    setClient(wsClient)

    const unsubscribe = wsClient.onStateChange(setConnectionState)

    return () => {
      unsubscribe()
      wsClient.disconnect()
    }
  }, [config?.url, config?.token])

  const connect = useCallback(async () => {
    if (client) {
      await client.connect()
    }
  }, [client])

  const disconnect = useCallback(() => {
    if (client) {
      client.disconnect()
    }
  }, [client])

  return {
    client,
    connectionState,
    connect,
    disconnect,
  }
}

/**
 * Hook to subscribe to execution events
 */
export function useExecutionEvents(
  client: WsClient | null,
  executionId: string | null,
  callback: ExecutionEventCallback
): {
  isSubscribed: boolean
  error: Error | null
} {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!client || !executionId) {
      setIsSubscribed(false)
      return
    }

    let unsubscribe: (() => void) | null = null

    const subscribe = async () => {
      try {
        unsubscribe = await client.subscribe(executionId, (event) => {
          callbackRef.current(event)
        })
        setIsSubscribed(true)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Subscription failed'))
        setIsSubscribed(false)
      }
    }

    subscribe()

    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
      setIsSubscribed(false)
    }
  }, [client, executionId])

  return { isSubscribed, error }
}

/**
 * Hook to get execution status
 */
export function useExecutionStatus(
  client: WsClient | null,
  executionId: string | null
): {
  status: string | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
} {
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!client || !executionId) return

    setLoading(true)
    setError(null)

    try {
      const result = await client.getExecutionStatus(executionId)
      setStatus(result.status)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get status'))
    } finally {
      setLoading(false)
    }
  }, [client, executionId])

  useEffect(() => {
    if (client && executionId) {
      refresh()
    } else {
      setStatus(null)
    }
  }, [client, executionId, refresh])

  return { status, loading, error, refresh }
}

/**
 * Hook to track execution progress with events
 */
export function useExecutionProgress(
  client: WsClient | null,
  executionId: string | null
): {
  status: string
  progress: number
  currentNode: string | null
  events: ExecutionEvent[]
  error: string | null
  isCompleted: boolean
} {
  const [status, setStatus] = useState<string>('pending')
  const [progress, setProgress] = useState(0)
  const [currentNode, setCurrentNode] = useState<string | null>(null)
  const [events, setEvents] = useState<ExecutionEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  const handleEvent = useCallback((event: ExecutionEvent) => {
    setEvents((prev) => [...prev, event])

    switch (event.event_type) {
      case 'started':
        setStatus('running')
        break
      case 'node_started':
        setCurrentNode(event.data.node_id as string)
        break
      case 'node_completed':
        setCurrentNode(null)
        break
      case 'node_failed':
        setCurrentNode(null)
        break
      case 'progress':
        setProgress(event.data.progress as number)
        break
      case 'completed':
        setStatus('completed')
        setProgress(1)
        setIsCompleted(true)
        break
      case 'failed':
        setStatus('failed')
        setError(event.data.error as string)
        setIsCompleted(true)
        break
      case 'cancelled':
        setStatus('cancelled')
        setIsCompleted(true)
        break
    }
  }, [])

  useExecutionEvents(client, executionId, handleEvent)

  // Reset state when execution ID changes
  useEffect(() => {
    setStatus('pending')
    setProgress(0)
    setCurrentNode(null)
    setEvents([])
    setError(null)
    setIsCompleted(false)
  }, [executionId])

  return {
    status,
    progress,
    currentNode,
    events,
    error,
    isCompleted,
  }
}
