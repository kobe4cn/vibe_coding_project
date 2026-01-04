/**
 * A2UI DevTools Store - Global state for debugging A2UI
 */
import type { A2UIMessage, Action, Component } from '../types';

export interface DevToolsLogEntry {
  id: string;
  timestamp: Date;
  type: 'sse' | 'action' | 'response' | 'error' | 'validation';
  direction: 'in' | 'out';
  surfaceId?: string;
  data: unknown;
}

export interface ValidationError {
  rawData: unknown;
  issues: Array<{
    path: string;
    message: string;
  }>;
}

export interface DevToolsState {
  enabled: boolean;
  logs: DevToolsLogEntry[];
  components: Map<string, Component[]>;
  selectedLogId: string | null;
  filter: {
    types: Set<DevToolsLogEntry['type']>;
    surfaceId: string | null;
  };
}

type Listener = () => void;

const MAX_LOGS = 500;

class DevToolsStore {
  private state: DevToolsState = {
    enabled: typeof window !== 'undefined' && window.location.hostname === 'localhost',
    logs: [],
    components: new Map(),
    selectedLogId: null,
    filter: {
      types: new Set<DevToolsLogEntry['type']>(['sse', 'action', 'response', 'error', 'validation']),
      surfaceId: null,
    },
  };

  private listeners: Set<Listener> = new Set();
  private idCounter = 0;

  private generateId(): string {
    return `log-${Date.now()}-${++this.idCounter}`;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  getState(): DevToolsState {
    return this.state;
  }

  setEnabled(enabled: boolean): void {
    this.state = { ...this.state, enabled };
    this.notify();
  }

  /**
   * Log an SSE message received from server
   */
  logSSEMessage(surfaceId: string, message: A2UIMessage): void {
    if (!this.state.enabled) return;

    const entry: DevToolsLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'sse',
      direction: 'in',
      surfaceId,
      data: message,
    };

    this.addLog(entry);

    // Track components for component tree view
    if ('surfaceUpdate' in message) {
      this.state.components.set(
        message.surfaceUpdate.surfaceId,
        message.surfaceUpdate.components
      );
    }
  }

  /**
   * Log an action sent to server
   */
  logAction(surfaceId: string, action: Action, sourceId: string, context?: Record<string, unknown>): void {
    if (!this.state.enabled) return;

    const entry: DevToolsLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'action',
      direction: 'out',
      surfaceId,
      data: {
        action,
        sourceId,
        context,
      },
    };

    this.addLog(entry);
  }

  /**
   * Log an action response from server
   */
  logActionResponse(surfaceId: string, response: unknown): void {
    if (!this.state.enabled) return;

    const entry: DevToolsLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'response',
      direction: 'in',
      surfaceId,
      data: response,
    };

    this.addLog(entry);
  }

  /**
   * Log an error
   */
  logError(surfaceId: string | undefined, error: Error | string): void {
    if (!this.state.enabled) return;

    const entry: DevToolsLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'error',
      direction: 'in',
      surfaceId,
      data: {
        message: typeof error === 'string' ? error : error.message,
        stack: error instanceof Error ? error.stack : undefined,
      },
    };

    this.addLog(entry);
  }

  /**
   * Log a validation error for A2UI message schema validation
   */
  logValidationError(surfaceId: string | undefined, validationError: ValidationError): void {
    if (!this.state.enabled) return;

    const entry: DevToolsLogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      type: 'validation',
      direction: 'in',
      surfaceId,
      data: validationError,
    };

    this.addLog(entry);
  }

  private addLog(entry: DevToolsLogEntry): void {
    const newLogs = [...this.state.logs, entry];

    // Trim old logs if exceeds max
    if (newLogs.length > MAX_LOGS) {
      newLogs.splice(0, newLogs.length - MAX_LOGS);
    }

    this.state = {
      ...this.state,
      logs: newLogs,
    };
    this.notify();
  }

  clearLogs(): void {
    this.state = {
      ...this.state,
      logs: [],
      selectedLogId: null,
    };
    this.notify();
  }

  selectLog(logId: string | null): void {
    this.state = {
      ...this.state,
      selectedLogId: logId,
    };
    this.notify();
  }

  setFilterTypes(types: Set<DevToolsLogEntry['type']>): void {
    this.state = {
      ...this.state,
      filter: {
        ...this.state.filter,
        types,
      },
    };
    this.notify();
  }

  setFilterSurfaceId(surfaceId: string | null): void {
    this.state = {
      ...this.state,
      filter: {
        ...this.state.filter,
        surfaceId,
      },
    };
    this.notify();
  }

  getFilteredLogs(): DevToolsLogEntry[] {
    const { logs, filter } = this.state;

    return logs.filter(log => {
      if (!filter.types.has(log.type)) return false;
      if (filter.surfaceId && log.surfaceId !== filter.surfaceId) return false;
      return true;
    });
  }

  getComponents(surfaceId: string): Component[] | undefined {
    return this.state.components.get(surfaceId);
  }

  getAllSurfaceIds(): string[] {
    const surfaceIds = new Set<string>();
    for (const log of this.state.logs) {
      if (log.surfaceId) {
        surfaceIds.add(log.surfaceId);
      }
    }
    return Array.from(surfaceIds);
  }
}

// Global singleton
export const devToolsStore = new DevToolsStore();

// Helper hook for React
export function useDevToolsStore(): DevToolsState {
  const [, forceUpdate] = React.useState({});

  React.useEffect(() => {
    return devToolsStore.subscribe(() => forceUpdate({}));
  }, []);

  return devToolsStore.getState();
}

import * as React from 'react';
