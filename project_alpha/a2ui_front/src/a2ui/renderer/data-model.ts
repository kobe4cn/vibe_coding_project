/**
 * A2UI Data Model Manager
 * Enhanced with React event subscription support for hybrid architecture
 */
import type { ValueMap, BoundValue, DataModelListener, DataModelSnapshot } from '../types';

export class DataModel {
  private data: Map<string, unknown> = new Map();
  private dirtyPaths: Set<string> = new Set();
  private listeners: Set<DataModelListener> = new Set();
  private batchMode = false;
  private batchedPaths: Set<string> = new Set();

  /**
   * Subscribe to data model changes (for React integration)
   */
  subscribe(listener: DataModelListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of a change
   */
  private notify(path: string, value: unknown): void {
    if (this.batchMode) {
      this.batchedPaths.add(path);
      return;
    }

    for (const listener of this.listeners) {
      try {
        listener(path, value);
      } catch (err) {
        console.error('DataModel listener error:', err);
      }
    }
  }

  /**
   * Batch multiple updates and notify once at the end
   */
  batch(fn: () => void): void {
    this.batchMode = true;
    this.batchedPaths.clear();

    try {
      fn();
    } finally {
      this.batchMode = false;

      // Notify for all batched paths
      for (const path of this.batchedPaths) {
        const value = this.get(path);
        for (const listener of this.listeners) {
          try {
            listener(path, value);
          } catch (err) {
            console.error('DataModel listener error:', err);
          }
        }
      }
      this.batchedPaths.clear();
    }
  }

  /**
   * Get a snapshot of all data (for React state sync)
   */
  getSnapshot(): DataModelSnapshot {
    const result: DataModelSnapshot = {};
    for (const [key, value] of this.data.entries()) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Update data model from ValueMap contents (from server)
   * Skips paths marked as dirty by user input
   */
  update(path: string, contents: ValueMap[]): void {
    const basePath = path.startsWith('/') ? path : `/${path}`;

    for (const item of contents) {
      const fullPath = `${basePath}/${item.key}`;

      // Skip paths that have been modified by user input
      if (this.dirtyPaths.has(fullPath)) {
        continue;
      }

      // For "items" key (list data), clear all existing children before adding new ones
      // This ensures old list items are removed when the list is refreshed
      if (item.key === 'items' && item.valueMap !== undefined) {
        this.clearChildPaths(fullPath);
      }

      const value = this.extractValue(item);
      this.data.set(fullPath, value);
      this.notify(fullPath, value);

      // Also store nested paths for valueMap items
      if (item.valueMap !== undefined) {
        this.storeNestedPaths(fullPath, item.valueMap);
      }
    }
  }

  /**
   * Clear all child paths under a given path
   */
  private clearChildPaths(basePath: string): void {
    const prefix = basePath + '/';
    const keysToDelete: string[] = [];
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.data.delete(key);
      this.dirtyPaths.delete(key);
    }
  }

  /**
   * Recursively store nested ValueMap paths
   */
  private storeNestedPaths(basePath: string, contents: ValueMap[]): void {
    for (const item of contents) {
      const fullPath = `${basePath}/${item.key}`;

      // Skip paths that have been modified by user input
      if (this.dirtyPaths.has(fullPath)) {
        continue;
      }

      const value = this.extractValue(item);
      this.data.set(fullPath, value);
      this.notify(fullPath, value);

      if (item.valueMap !== undefined) {
        this.storeNestedPaths(fullPath, item.valueMap);
      }
    }
  }

  /**
   * Get value at path
   * If the path has no direct value but has children, returns an object with all children
   */
  get(path: string): unknown {
    // Handle relative paths (starting with .)
    if (path === '.' || path === '') {
      return undefined;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // First, check if there's a direct value at this path
    const directValue = this.data.get(normalizedPath);
    if (directValue !== undefined) {
      return directValue;
    }

    // If no direct value, collect all children into an object
    const prefix = normalizedPath + '/';
    const result: Record<string, unknown> = {};
    let hasChildren = false;

    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) {
        const relativePath = key.substring(prefix.length);
        const parts = relativePath.split('/');

        // Only get immediate children (not nested paths)
        if (parts.length === 1) {
          result[parts[0]] = value;
          hasChildren = true;
        }
      }
    }

    return hasChildren ? result : undefined;
  }

  /**
   * Set value at path (called by user input or React)
   * Marks the path as dirty to prevent server updates from overwriting
   */
  set(path: string, value: unknown, markDirty = true): void {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    this.data.set(normalizedPath, value);

    if (markDirty) {
      this.dirtyPaths.add(normalizedPath);
    }

    this.notify(normalizedPath, value);
  }

  /**
   * Delete value at path and all nested paths
   */
  delete(path: string): void {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Delete the path itself
    this.data.delete(normalizedPath);
    
    // Delete all nested paths
    const prefix = normalizedPath + '/';
    const keysToDelete: string[] = [];
    for (const key of this.data.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.data.delete(key);
    }
    
    // Remove from dirty paths too
    this.dirtyPaths.delete(normalizedPath);
    for (const key of keysToDelete) {
      this.dirtyPaths.delete(key);
    }
    
    // Notify deletion
    this.notify(normalizedPath, undefined);
  }

  /**
   * Clear dirty flag for a path (called after submitting)
   */
  clearDirty(path: string): void {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    this.dirtyPaths.delete(normalizedPath);
  }

  /**
   * Clear all dirty flags
   */
  clearAllDirty(): void {
    this.dirtyPaths.clear();
  }

  /**
   * Resolve a BoundValue to its actual value
   */
  resolve(value: BoundValue, contextPath?: string): unknown {
    if ('literalString' in value) {
      return value.literalString;
    }
    if ('literalNumber' in value) {
      return value.literalNumber;
    }
    if ('literalBoolean' in value) {
      return value.literalBoolean;
    }
    if ('path' in value) {
      const resolvedPath = this.resolvePath(value.path, contextPath);
      return this.get(resolvedPath);
    }
    return undefined;
  }

  /**
   * Resolve a path considering context
   */
  private resolvePath(path: string, contextPath?: string): string {
    if (path.startsWith('/')) {
      return path;
    }
    if (contextPath) {
      return `${contextPath}/${path}`;
    }
    return path;
  }

  /**
   * Extract value from ValueMap item
   */
  private extractValue(item: ValueMap): unknown {
    if (item.valueString !== undefined) {
      return item.valueString;
    }
    if (item.valueNumber !== undefined) {
      return item.valueNumber;
    }
    if (item.valueBoolean !== undefined) {
      return item.valueBoolean;
    }
    if (item.valueMap !== undefined) {
      // Convert nested ValueMap to object
      const obj: Record<string, unknown> = {};
      for (const nested of item.valueMap) {
        obj[nested.key] = this.extractValue(nested);
      }
      return obj;
    }
    return undefined;
  }

  /**
   * Get all entries under a path (for list templates)
   */
  getEntries(path: string): Array<{ key: string; value: unknown; path: string }> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const entries: Array<{ key: string; value: unknown; path: string }> = [];

    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(normalizedPath + '/')) {
        const relativePath = key.substring(normalizedPath.length + 1);
        const parts = relativePath.split('/');
        if (parts.length === 1) {
          entries.push({
            key: parts[0],
            value,
            path: key,
          });
        }
      }
    }

    return entries;
  }

  /**
   * Clear all data and dirty flags
   */
  clear(): void {
    this.data.clear();
    this.dirtyPaths.clear();
  }

  /**
   * Debug: dump all data
   */
  dump(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of this.data.entries()) {
      result[key] = value;
    }
    return result;
  }
}
