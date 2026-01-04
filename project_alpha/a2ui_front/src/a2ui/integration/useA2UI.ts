/**
 * useA2UI Hook - Connect React components to A2UI SSE stream
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { useA2UIContext } from './A2UIContext';
import { devToolsStore } from '../devtools/store';
import { validateA2UIMessage } from '../schemas';
import type { A2UIMessage, Action, UserAction, Component } from '../types';

interface UseA2UIOptions {
  surfaceId: string;
  streamUrl?: string;
  actionUrl?: string;
  onAction?: (action: Action, sourceId: string, contextPath?: string) => void;
  onMessage?: (message: A2UIMessage) => void;
  onError?: (error: Error) => void;
}

interface UseA2UIReturn {
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  components: Component[];
  rootId: string | null;
  sendAction: (action: Action, sourceId: string, context?: Record<string, unknown>) => Promise<void>;
  reconnect: () => void;
}

export function useA2UI({
  surfaceId,
  streamUrl = '/api/a2ui/stream',
  actionUrl = '/api/a2ui/action',
  onAction,
  onMessage,
  onError,
}: UseA2UIOptions): UseA2UIReturn {
  const { dataModel, dispatchAction } = useA2UIContext();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [rootId, setRootId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setIsLoading(true);
    setError(null);

    // Clear all dirty flags when reconnecting to allow fresh data from server
    // This is important because user input may have marked paths as dirty,
    // but a new query should receive fresh data
    dataModel.clearAllDirty();

    // Use & if URL already has query params, otherwise use ?
    const separator = streamUrl.includes('?') ? '&' : '?';
    const url = `${streamUrl}${separator}surfaceId=${encodeURIComponent(surfaceId)}`;

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setIsLoading(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);

        // Validate message schema
        const validationResult = validateA2UIMessage(rawData);
        if (!validationResult.success && validationResult.error) {
          // Log validation error to DevTools
          devToolsStore.logValidationError(surfaceId, {
            rawData,
            issues: validationResult.error.issues.map((issue) => ({
              path: issue.path.length > 0 ? issue.path.join('.') : 'root',
              message: issue.message,
            })),
          });
          console.warn('A2UI message validation failed:', validationResult.error.issues);
        }

        // Proceed with processing (use validated data if available, fallback to raw)
        const message = (validationResult.data || rawData) as A2UIMessage;

        // Log to DevTools
        devToolsStore.logSSEMessage(surfaceId, message);

        // Handle different message types
        if ('surfaceUpdate' in message) {
          const { surfaceId: msgSurfaceId, components: newComponents } = message.surfaceUpdate;
          if (msgSurfaceId === surfaceId) {
            setComponents(newComponents);
          }
        } else if ('dataModelUpdate' in message) {
          const { surfaceId: msgSurfaceId, path, contents } = message.dataModelUpdate;
          if (msgSurfaceId === surfaceId) {
            dataModel.batch(() => {
              dataModel.update(path || '', contents);
            });
          }
        } else if ('beginRendering' in message) {
          const { surfaceId: msgSurfaceId, root } = message.beginRendering;
          if (msgSurfaceId === surfaceId) {
            setRootId(root);
          }
        }

        onMessage?.(message);
      } catch (err) {
        console.error('Failed to parse A2UI message:', err);
        devToolsStore.logError(surfaceId, err instanceof Error ? err : String(err));
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setIsLoading(false);

      const err = new Error('SSE connection failed');
      setError(err);
      onError?.(err);
      devToolsStore.logError(surfaceId, err);

      // Auto-reconnect after 3 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [surfaceId, streamUrl, dataModel, onMessage, onError]);

  const sendAction = useCallback(async (
    action: Action,
    sourceId: string,
    context?: Record<string, unknown>
  ): Promise<void> => {
    // Extract contextPath if provided (for template-based list items)
    const contextPath = context?.contextPath as string | undefined;

    // Build context from action.context + additional context
    const resolvedContext: Record<string, unknown> = {};

    // Copy non-internal context values
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        if (key !== 'contextPath') {
          resolvedContext[key] = value;
        }
      }
    }

    if (action.context) {
      for (const { key, value } of action.context) {
        // Pass contextPath to resolve relative paths correctly
        resolvedContext[key] = dataModel.resolve(value, contextPath);
      }
    }

    const userAction: UserAction = {
      name: action.name,
      surfaceId,
      sourceComponentId: sourceId,
      timestamp: new Date().toISOString(),
      context: resolvedContext,
    };

    // Build resolved action for React handlers (with actual values instead of BoundValue)
    const resolvedAction = {
      name: action.name,
      context: action.context?.map(({ key, value }) => ({
        key,
        value: dataModel.resolve(value, contextPath),
      })),
    };

    // Log action to DevTools
    devToolsStore.logAction(surfaceId, action, sourceId, resolvedContext);

    // Dispatch to React handlers
    dispatchAction(resolvedAction as Action, sourceId);
    onAction?.(resolvedAction as Action, sourceId);

    // Send to backend
    try {
      const response = await fetch(actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userAction),
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }

      // Parse response for follow-up actions
      const result = await response.json();

      // Log response to DevTools
      devToolsStore.logActionResponse(surfaceId, result);

      // If backend returns a ticketId, trigger success action
      if (result.success && result.ticketId) {
        const successAction = {
          name: 'create_ticket_success',
          context: [{ key: 'ticketId', value: result.ticketId }],
        };
        dispatchAction(successAction as Action, sourceId);
        onAction?.(successAction as Action, sourceId);
      }

      // If backend returns a dataUpdate, update the DataModel
      if (result.success && result.dataUpdate) {
        const { path, items, value } = result.dataUpdate;
        if (path && items) {
          // Replace all items at path (for list updates like delete/create)
          dataModel.batch(() => {
            // First, clear all existing items at the path
            const currentData = dataModel.get(path) as Record<string, unknown> | undefined;
            if (currentData) {
              for (const oldId of Object.keys(currentData)) {
                dataModel.delete(`${path}/${oldId}`);
              }
            }
            
            // Then, add new items
            for (const item of items as Array<{ id: string; [key: string]: unknown }>) {
              const itemPath = `${path}/${item.id}`;
              for (const [k, v] of Object.entries(item)) {
                if (k !== 'id') {
                  dataModel.set(`${itemPath}/${k}`, v, false);
                } else {
                  // Also set the id at the item path level for reference
                  dataModel.set(`${itemPath}/id`, v, false);
                }
              }
            }
          });
        } else if (path && value !== undefined) {
          // Handle direct value update (e.g., priority selection)
          dataModel.set(path, value);
        }
      }

      // Handle pagination update
      if (result.success && result.paginationUpdate) {
        const pagination = result.paginationUpdate as Record<string, unknown>;
        dataModel.batch(() => {
          for (const [key, value] of Object.entries(pagination)) {
            dataModel.set(`/app/tickets/pagination/${key}`, value);
          }
        });
      }

      // Handle query update
      if (result.success && result.queryUpdate) {
        const query = result.queryUpdate as Record<string, unknown>;
        dataModel.batch(() => {
          for (const [key, value] of Object.entries(query)) {
            dataModel.set(`/app/tickets/query/${key}`, value);
          }
        });
      }

      // Handle filters update
      if (result.success && result.filtersUpdate) {
        const filters = result.filtersUpdate as Array<{ key: string; value: unknown }>;
        dataModel.batch(() => {
          for (const filter of filters) {
            // Use markDirty=false to allow server updates to override
            dataModel.set(`/app/tickets/${filter.key}`, filter.value, false);
          }
        });
      }

      // If backend returns an error, log it
      if (!result.success && result.error) {
        console.error('Action error:', result.error);
      }
    } catch (err) {
      console.error('Failed to send action:', err);
      devToolsStore.logError(surfaceId, err instanceof Error ? err : String(err));
      throw err;
    }
  }, [surfaceId, actionUrl, dataModel, dispatchAction, onAction]);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    connect();
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    isLoading,
    error,
    components,
    rootId,
    sendAction,
    reconnect,
  };
}
