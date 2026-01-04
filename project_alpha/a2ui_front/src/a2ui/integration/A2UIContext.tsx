/**
 * A2UI Context - State bridge between A2UI DataModel and React
 */
import { createContext, useContext, useRef, useSyncExternalStore, useCallback, useEffect, useState, ReactNode } from 'react';
import { DataModel } from '../renderer/data-model';
import type { DataModelSnapshot, Action } from '../types';

interface A2UIContextValue {
  dataModel: DataModel;
  getValue: (path: string) => unknown;
  setValue: (path: string, value: unknown) => void;
  dispatchAction: (action: Action, sourceId: string) => void;
  onAction: (handler: (action: Action, sourceId: string) => void) => () => void;
}

const A2UIContext = createContext<A2UIContextValue | null>(null);

interface A2UIProviderProps {
  children: ReactNode;
}

export function A2UIProvider({ children }: A2UIProviderProps) {
  // Use useState to create stable instances that are safe to access during render
  const [dataModel] = useState(() => new DataModel());
  const actionHandlersRef = useRef<Set<(action: Action, sourceId: string) => void>>(new Set());

  const getValue = useCallback((path: string): unknown => {
    return dataModel.get(path);
  }, [dataModel]);

  const setValue = useCallback((path: string, value: unknown): void => {
    dataModel.set(path, value);
  }, [dataModel]);

  const dispatchAction = useCallback((action: Action, sourceId: string): void => {
    for (const handler of actionHandlersRef.current) {
      try {
        handler(action, sourceId);
      } catch (err) {
        console.error('A2UI action handler error:', err);
      }
    }
  }, []);

  const onAction = useCallback((handler: (action: Action, sourceId: string) => void): () => void => {
    actionHandlersRef.current.add(handler);
    return () => {
      actionHandlersRef.current.delete(handler);
    };
  }, []);

  const value: A2UIContextValue = {
    dataModel,
    getValue,
    setValue,
    dispatchAction,
    onAction,
  };

  return <A2UIContext.Provider value={value}>{children}</A2UIContext.Provider>;
}

/**
 * Hook to access A2UI context
 */
export function useA2UIContext(): A2UIContextValue {
  const context = useContext(A2UIContext);
  if (!context) {
    throw new Error('useA2UIContext must be used within A2UIProvider');
  }
  return context;
}

/**
 * Hook to subscribe to a specific data model path
 */
export function useA2UIValue<T = unknown>(path: string): T | undefined {
  const { dataModel } = useA2UIContext();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return dataModel.subscribe((changedPath) => {
        if (changedPath === path || changedPath.startsWith(path + '/')) {
          onStoreChange();
        }
      });
    },
    [dataModel, path]
  );

  const getSnapshot = useCallback(() => {
    return dataModel.get(path) as T;
  }, [dataModel, path]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to get/set a data model value with React state-like API
 */
export function useA2UIState<T = unknown>(path: string, initialValue?: T): [T | undefined, (value: T) => void] {
  const { dataModel, setValue } = useA2UIContext();
  const value = useA2UIValue<T>(path);

  const setStateValue = useCallback(
    (newValue: T) => {
      setValue(path, newValue);
    },
    [setValue, path]
  );

  // Set initial value if provided and path is empty
  if (value === undefined && initialValue !== undefined) {
    dataModel.set(path, initialValue, false);
  }

  return [value ?? initialValue, setStateValue];
}

/**
 * Hook to get entire data model snapshot
 */
export function useA2UISnapshot(): DataModelSnapshot {
  const { dataModel } = useA2UIContext();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return dataModel.subscribe(() => {
        onStoreChange();
      });
    },
    [dataModel]
  );

  const getSnapshot = useCallback(() => {
    return dataModel.getSnapshot();
  }, [dataModel]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Hook to handle A2UI actions
 */
export function useA2UIAction(handler: (action: Action, sourceId: string) => void): void {
  const { onAction } = useA2UIContext();

  // Register handler on mount, cleanup on unmount
  useEffect(() => {
    const unsubscribe = onAction(handler);
    return unsubscribe;
  }, [onAction, handler]);
}
