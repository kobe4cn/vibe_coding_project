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
  private lastConnectedPath: string = '';

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

    // Only clear data model when path changes (navigation), not on reconnect
    if (this.surface && this.currentPath !== this.lastConnectedPath) {
      this.surface.dataModel.clear();
      this.lastConnectedPath = this.currentPath;
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
        // Convert undefined to null to ensure it's included in JSON
        context[item.key] = value !== undefined ? value : null;
        console.log(`  Context ${item.key}:`, value, 'from', item.value);
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

      const result = await response.json();
      console.log('Action result:', result);

      // Check for error response
      if (!result.success && result.error) {
        // Show error message to user
        alert(result.error);
        return;
      }

      // Show success message for certain actions
      const successMessages: Record<string, string> = {
        'create_tag': '标签创建成功！',
        'create_ticket': '任务创建成功！',
        'update_ticket': '任务更新成功！',
        'delete_ticket': '任务删除成功！',
        'delete_tag': '标签删除成功！',
        'change_status': '状态更新成功！',
      };
      
      if (successMessages[action.name] && result.result?.navigate) {
        alert(successMessages[action.name]);
      }

      // Handle navigation
      if (result.result?.navigate) {
        this.navigate(result.result.navigate);
      } else if (result.result?.refresh) {
        this.connect();
      } else if (result.result?.handled) {
        // Handle client-side actions
        this.handleClientSideAction(action.name, context);
      }
    } catch (error) {
      console.error('Error sending action:', error);
      alert('操作失败，请稍后重试');
    }
  }

  private navigate(path: string): void {
    // Update URL without reload
    window.history.pushState({}, '', path);
    // Store full path including query string for SSE reconnection
    this.currentPath = path;

    // Force clear data model on navigation (even if path is the same)
    // This ensures fresh data is loaded after create/delete operations
    if (this.surface) {
      this.surface.dataModel.clear();
    }
    // Reset lastConnectedPath to force data refresh
    this.lastConnectedPath = '';

    // Reconnect to get new page
    this.connect();
  }

  private handleClientSideAction(name: string, context: Record<string, unknown>): void {
    if (!this.surface) return;
    
    console.log(`[Client] Handling client-side action: ${name}`, context);
    
    let needsUpdate = false;
    
    if (name === 'set_form_priority') {
      // Determine the form path based on current page
      const priority = context.priority as string;
      const isEditPage = this.currentPath.includes('/edit');
      const formPath = isEditPage ? '/app/form/edit/priority' : '/app/form/create/priority';
      this.surface.dataModel.set(formPath, priority);
      console.log(`[Client] Set ${formPath} = ${priority}`);
      needsUpdate = true;
    } else if (name === 'set_tag_color') {
      // Set tag form color
      const color = context.color as string;
      this.surface.dataModel.set('/app/tags/form/color', color);
      console.log(`[Client] Set /app/tags/form/color = ${color}`);
      needsUpdate = true;
    } else if (name === 'show_create_tag_form') {
      this.surface.dataModel.set('/app/tags/showForm', true);
      console.log(`[Client] Set /app/tags/showForm = true`);
      needsUpdate = true;
    } else if (name === 'hide_create_tag_form') {
      this.surface.dataModel.set('/app/tags/showForm', false);
      console.log(`[Client] Set /app/tags/showForm = false`);
      needsUpdate = true;
    } else if (name === 'show_delete_dialog') {
      // Show delete confirmation dialog
      const id = context.id as string;
      this.surface.dataModel.set('/app/dialog/deleteId', id);
      this.surface.dataModel.set('/app/dialog/show', true);
      console.log(`[Client] Show delete dialog for id: ${id}`);
      needsUpdate = true;
    } else if (name === 'dismiss_dialog') {
      this.surface.dataModel.set('/app/dialog/show', false);
      console.log(`[Client] Dismiss dialog`);
      needsUpdate = true;
    } else if (name === 'toggle_form_tag' || name === 'toggle_multi_select') {
      // Toggle selection in multi-select (works for tags and other multi-selects)
      const optionId = (context.optionId || context.tagId) as string;
      const selectedPath = context.selectedPath as string | undefined;
      
      // Determine path - use explicit selectedPath or infer from context
      let formPath: string;
      if (selectedPath) {
        formPath = selectedPath;
      } else {
        const isEditPage = this.currentPath.includes('/edit');
        formPath = isEditPage ? '/app/form/edit/selectedTagIds' : '/app/form/create/selectedTagIds';
      }
      
      const currentSelected = (this.surface.dataModel.get(formPath) as string) || '';
      const selectedIds = currentSelected ? currentSelected.split(',').filter(id => id.trim()) : [];
      
      const index = selectedIds.indexOf(optionId);
      if (index >= 0) {
        // Remove option
        selectedIds.splice(index, 1);
      } else {
        // Add option
        selectedIds.push(optionId);
      }
      
      this.surface.dataModel.set(formPath, selectedIds.join(','));
      console.log(`[Client] Toggle ${optionId} in ${formPath}, selected: ${selectedIds.join(',')}`);
      needsUpdate = true;
    }
    
    // Trigger re-render to update UI (e.g., button selection states)
    if (needsUpdate) {
      this.surface.requestUpdate();
    }
  }
}

// Initialize client
new A2UIClient();
