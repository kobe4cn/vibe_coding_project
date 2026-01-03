/**
 * A2UISurface React Component
 * Wraps the Lit-based A2UI renderer for use in React applications
 */
import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useA2UI } from './useA2UI';
import { useA2UIContext } from './A2UIContext';
import type { Action, Component } from '../types';
import type { A2UISurface as LitA2UISurface } from '../renderer/renderer';

// Import renderer to register custom elements
import '../renderer/renderer';

export interface A2UISurfaceRef {
  sendAction: (action: Action, sourceId: string) => Promise<void>;
  getDataModel: () => Record<string, unknown>;
  setValue: (path: string, value: unknown) => void;
}

interface A2UISurfaceProps {
  surfaceId: string;
  streamUrl?: string;
  actionUrl?: string;
  className?: string;
  onAction?: (action: Action, sourceId: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** Fallback content when loading */
  fallback?: React.ReactNode;
  /** Custom components to render instead of server-driven UI */
  components?: Component[];
  /** Custom root ID */
  rootId?: string;
}

export const A2UISurface = forwardRef<A2UISurfaceRef, A2UISurfaceProps>(
  function A2UISurface(
    {
      surfaceId,
      streamUrl,
      actionUrl,
      className,
      onAction,
      onReady,
      onError,
      fallback,
      components: customComponents,
      rootId: customRootId,
    },
    ref
  ) {
    // Use useState instead of useRef so that setting the surface triggers effects
    const [surface, setSurface] = useState<LitA2UISurface | null>(null);
    const { dataModel } = useA2UIContext();

    const {
      isConnected,
      isLoading,
      error,
      components,
      rootId,
      sendAction,
    } = useA2UI({
      surfaceId,
      streamUrl,
      actionUrl,
      onAction,
      onError,
    });

    // Use custom components/rootId if provided, otherwise use from SSE
    const activeComponents = customComponents ?? components;
    const activeRootId = customRootId ?? rootId;

    // Expose imperative API
    useImperativeHandle(ref, () => ({
      sendAction,
      getDataModel: () => dataModel.dump(),
      setValue: (path: string, value: unknown) => dataModel.set(path, value),
    }), [sendAction, dataModel]);

    // Set up dataModel and action handler when surface element is available
    useEffect(() => {
      if (!surface) return;

      // Share data model with Lit surface
      surface.dataModel = dataModel;

      // Set action handler to bridge to React
      surface.setActionHandler((action, sourceId, contextPath) => {
        sendAction(action, sourceId, contextPath ? { contextPath } : undefined);
      });
    }, [surface, dataModel, sendAction]);

    // Update components when they change
    useEffect(() => {
      if (!surface || !activeComponents.length) return;

      surface.setComponents(activeComponents);
    }, [surface, activeComponents]);

    // Update root when it changes
    useEffect(() => {
      if (!surface || !activeRootId) return;

      surface.setRoot(activeRootId);
    }, [surface, activeRootId]);

    // Notify when ready
    useEffect(() => {
      if (isConnected && activeRootId && activeComponents.length > 0) {
        onReady?.();
      }
    }, [isConnected, activeRootId, activeComponents.length, onReady]);

    // Callback ref to capture the surface element - must be before conditional returns
    const surfaceRefCallback = useCallback((el: HTMLElement | null) => {
      setSurface(el as LitA2UISurface | null);
    }, []);

    // Show fallback while loading
    if (isLoading && fallback) {
      return <>{fallback}</>;
    }

    // Show error state
    if (error && !isConnected) {
      return (
        <div className="a2ui-error" style={{ padding: 16, color: '#EF4444' }}>
          Connection error: {error.message}
        </div>
      );
    }

    return (
      <a2ui-surface
        ref={surfaceRefCallback}
        surfaceId={surfaceId}
        class={className}
      />
    );
  }
);

// Type declarations for JSX
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'a2ui-surface': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { surfaceId?: string },
        HTMLElement
      >;
    }
  }
}
