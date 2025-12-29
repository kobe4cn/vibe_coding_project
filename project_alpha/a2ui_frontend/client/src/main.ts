/**
 * A2UI Client Shell - Main entry point
 */
import './renderer';
import type { A2UIMessage, Action, UserAction, SurfaceUpdate, DataModelUpdate, BeginRendering } from './types';
import type { A2UISurface } from './renderer';

class A2UIClient {
  private surface: A2UISurface | null = null;
  private eventSource: EventSource | null = null;
  private currentPath: string = '/';

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Create surface element
    const app = document.getElementById('app');
    if (!app) {
      console.error('App container not found');
      return;
    }

    // Clear loading state
    app.innerHTML = '';

    // Create surface
    this.surface = document.createElement('a2ui-surface') as A2UISurface;
    this.surface.surfaceId = 'main';
    this.surface.setActionHandler((action, sourceId, contextPath) => this.handleAction(action, sourceId, contextPath));
    app.appendChild(this.surface);

    // Get initial path from URL
    this.currentPath = window.location.pathname + window.location.search;

    // Handle browser navigation
    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname + window.location.search;
      this.connect();
    });

    // Connect to server
    this.connect();
  }

  private connect(): void {
    // Close existing connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Build SSE URL
    const sseUrl = `/api/a2ui/stream?path=${encodeURIComponent(this.currentPath)}`;
    console.log(`Connecting to: ${sseUrl}`);

    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Attempt to reconnect after delay
      setTimeout(() => {
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.connect();
        }
      }, 3000);
    };

    this.eventSource.onopen = () => {
      console.log('SSE connection established');
    };
  }

  private handleMessage(data: string): void {
    try {
      const message: A2UIMessage = JSON.parse(data);

      if ('surfaceUpdate' in message) {
        this.handleSurfaceUpdate(message as SurfaceUpdate);
      } else if ('dataModelUpdate' in message) {
        this.handleDataModelUpdate(message as DataModelUpdate);
      } else if ('beginRendering' in message) {
        this.handleBeginRendering(message as BeginRendering);
      } else if ('deleteSurface' in message) {
        console.log('Surface deleted');
      }
    } catch (error) {
      console.error('Error parsing message:', error, data);
    }
  }

  private handleSurfaceUpdate(message: SurfaceUpdate): void {
    if (this.surface && message.surfaceUpdate.surfaceId === this.surface.surfaceId) {
      this.surface.setComponents(message.surfaceUpdate.components);
    }
  }

  private handleDataModelUpdate(message: DataModelUpdate): void {
    if (this.surface && message.dataModelUpdate.surfaceId === this.surface.surfaceId) {
      const path = message.dataModelUpdate.path || '/';
      this.surface.dataModel.update(path, message.dataModelUpdate.contents);
    }
  }

  private handleBeginRendering(message: BeginRendering): void {
    if (this.surface && message.beginRendering.surfaceId === this.surface.surfaceId) {
      this.surface.setRoot(message.beginRendering.root);
    }
  }

  private async handleAction(action: Action, sourceId: string, contextPath?: string): Promise<void> {
    console.log(`Action: ${action.name} from ${sourceId}`, action.context, `contextPath: ${contextPath}`);

    // Build context object from action.context array
    // Pass contextPath to resolve relative paths (e.g., "id" -> "/app/tickets/list/ticket0/id")
    const context: Record<string, unknown> = {};
    if (action.context) {
      for (const item of action.context) {
        const value = this.surface?.dataModel.resolve(item.value, contextPath);
        context[item.key] = value;
      }
    }

    // Build userAction
    const userAction: UserAction = {
      name: action.name,
      surfaceId: this.surface?.surfaceId || 'main',
      sourceComponentId: sourceId,
      timestamp: new Date().toISOString(),
      context,
    };

    try {
      const response = await fetch('/api/a2ui/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userAction),
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Action result:', result);

      // Handle navigation
      if (result.result?.navigate) {
        this.navigate(result.result.navigate);
      } else if (result.result?.refresh) {
        this.connect();
      }
    } catch (error) {
      console.error('Error sending action:', error);
    }
  }

  private navigate(path: string): void {
    // Update URL without reload
    window.history.pushState({}, '', path);
    this.currentPath = path;

    // Reconnect to get new page
    this.connect();
  }
}

// Initialize client
new A2UIClient();
