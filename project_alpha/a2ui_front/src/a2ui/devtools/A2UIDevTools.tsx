/**
 * A2UI DevTools Panel
 * A floating panel for debugging A2UI applications
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { devToolsStore, type DevToolsLogEntry } from './store';
import { useA2UIContext, useA2UISnapshot } from '../integration/A2UIContext';
import type { Component } from '../types';

type TabId = 'logs' | 'dataModel' | 'components' | 'dirtyPaths';

interface JsonTreeProps {
  data: unknown;
  name?: string;
  expanded?: boolean;
  depth?: number;
}

function JsonTree({ data, name, expanded = false, depth = 0 }: JsonTreeProps) {
  const [isExpanded, setIsExpanded] = useState(expanded || depth < 2);

  if (data === null) {
    return <span className="text-gray-400">null</span>;
  }

  if (data === undefined) {
    return <span className="text-gray-400">undefined</span>;
  }

  if (typeof data === 'string') {
    return <span className="text-green-600">"{data}"</span>;
  }

  if (typeof data === 'number') {
    return <span className="text-blue-600">{data}</span>;
  }

  if (typeof data === 'boolean') {
    return <span className="text-purple-600">{data ? 'true' : 'false'}</span>;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-gray-500">[]</span>;
    }

    return (
      <div className="ml-3">
        <span
          className="cursor-pointer hover:bg-gray-100 rounded px-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} {name && <span className="text-gray-700">{name}: </span>}
          <span className="text-gray-500">[{data.length}]</span>
        </span>
        {isExpanded && (
          <div className="ml-4 border-l border-gray-200 pl-2">
            {data.map((item, index) => (
              <div key={index}>
                <span className="text-gray-400">{index}: </span>
                <JsonTree data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    if (entries.length === 0) {
      return <span className="text-gray-500">{'{}'}</span>;
    }

    return (
      <div className="ml-3">
        <span
          className="cursor-pointer hover:bg-gray-100 rounded px-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? '▼' : '▶'} {name && <span className="text-gray-700">{name}: </span>}
          <span className="text-gray-500">{'{...}'}</span>
        </span>
        {isExpanded && (
          <div className="ml-4 border-l border-gray-200 pl-2">
            {entries.map(([key, value]) => (
              <div key={key}>
                <span className="text-gray-600">{key}: </span>
                <JsonTree data={value} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <span>{String(data)}</span>;
}

function LogEntry({ entry, isSelected, onClick }: {
  entry: DevToolsLogEntry;
  isSelected: boolean;
  onClick: () => void;
}) {
  const typeColors: Record<DevToolsLogEntry['type'], string> = {
    sse: 'bg-blue-100 text-blue-800',
    action: 'bg-yellow-100 text-yellow-800',
    response: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  };

  const directionIcon = entry.direction === 'in' ? '⬅' : '➡';

  const getMessageType = (): string => {
    if (entry.type === 'sse' && typeof entry.data === 'object' && entry.data !== null) {
      const data = entry.data as Record<string, unknown>;
      if ('surfaceUpdate' in data) return 'SurfaceUpdate';
      if ('dataModelUpdate' in data) return 'DataModelUpdate';
      if ('beginRendering' in data) return 'BeginRendering';
      if ('deleteSurface' in data) return 'DeleteSurface';
    }
    if (entry.type === 'action') {
      const data = entry.data as { action?: { name?: string } };
      return data.action?.name || 'Action';
    }
    return entry.type;
  };

  return (
    <div
      className={`p-2 border-b cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-400">
          {entry.timestamp.toLocaleTimeString('zh-CN', { hour12: false })}
        </span>
        <span>{directionIcon}</span>
        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeColors[entry.type]}`}>
          {getMessageType()}
        </span>
        {entry.surfaceId && (
          <span className="text-gray-500 text-xs">@{entry.surfaceId}</span>
        )}
      </div>
    </div>
  );
}

function LogsPanel() {
  const [, forceUpdate] = useState({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return devToolsStore.subscribe(() => forceUpdate({}));
  }, []);

  const state = devToolsStore.getState();
  const logs = devToolsStore.getFilteredLogs();
  const selectedLog = logs.find(l => l.id === selectedId);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const toggleFilter = (type: DevToolsLogEntry['type']) => {
    const newTypes = new Set(state.filter.types);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    devToolsStore.setFilterTypes(newTypes);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50 flex-shrink-0">
        <span className="text-xs text-gray-500">Filter:</span>
        {(['sse', 'action', 'response', 'error'] as const).map(type => (
          <button
            key={type}
            className={`px-2 py-0.5 text-xs rounded ${
              state.filter.types.has(type)
                ? 'bg-gray-700 text-white'
                : 'bg-gray-200 text-gray-600'
            }`}
            onClick={() => toggleFilter(type)}
          >
            {type}
          </button>
        ))}
        <div className="flex-1" />
        <button
          className="px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          onClick={() => devToolsStore.clearLogs()}
        >
          Clear
        </button>
      </div>

      {/* Logs list and detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* Logs list */}
        <div className="w-1/2 overflow-y-auto border-r">
          {logs.length === 0 ? (
            <div className="p-4 text-gray-400 text-center text-sm">
              No logs yet. Interact with A2UI components to see activity.
            </div>
          ) : (
            <>
              {logs.map(log => (
                <LogEntry
                  key={log.id}
                  entry={log}
                  isSelected={log.id === selectedId}
                  onClick={() => setSelectedId(log.id)}
                />
              ))}
              <div ref={logsEndRef} />
            </>
          )}
        </div>

        {/* Log detail */}
        <div className="w-1/2 overflow-y-auto p-2 bg-gray-50">
          {selectedLog ? (
            <div className="text-xs font-mono">
              <div className="mb-2 text-gray-500">
                {selectedLog.timestamp.toISOString()}
              </div>
              <JsonTree data={selectedLog.data} expanded />
            </div>
          ) : (
            <div className="text-gray-400 text-center text-sm p-4">
              Select a log entry to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DataModelPanel() {
  const snapshot = useA2UISnapshot();
  const [searchPath, setSearchPath] = useState('');

  const filteredData = useMemo(() => {
    if (!searchPath) return snapshot;

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (key.toLowerCase().includes(searchPath.toLowerCase())) {
        result[key] = value;
      }
    }
    return result;
  }, [snapshot, searchPath]);

  // Build tree structure from flat paths
  const buildTree = (data: Record<string, unknown>): Record<string, unknown> => {
    const tree: Record<string, unknown> = {};

    const sortedKeys = Object.keys(data).sort();
    for (const path of sortedKeys) {
      const parts = path.split('/').filter(p => p);
      let current = tree;

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = parts[parts.length - 1];
      current[lastPart] = data[path];
    }

    return tree;
  };

  const treeData = buildTree(filteredData);

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-2 border-b bg-gray-50 flex-shrink-0">
        <input
          type="text"
          value={searchPath}
          onChange={e => setSearchPath(e.target.value)}
          placeholder="Search path..."
          className="w-full px-2 py-1 text-sm border rounded"
        />
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {Object.keys(treeData).length === 0 ? (
          <div className="text-gray-400 text-center p-4">
            DataModel is empty
          </div>
        ) : (
          <JsonTree data={treeData} expanded />
        )}
      </div>

      {/* Stats */}
      <div className="p-2 border-t bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        {Object.keys(snapshot).length} paths
      </div>
    </div>
  );
}

function ComponentsPanel() {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return devToolsStore.subscribe(() => forceUpdate({}));
  }, []);

  const state = devToolsStore.getState();
  const surfaceIds = devToolsStore.getAllSurfaceIds();

  const renderComponentTree = (components: Component[]): React.ReactNode[] => {
    // Find root-level components (not referenced by others)
    const allRefs = new Set<string>();
    for (const comp of components) {
      const p = Object.values(comp.component)[0] as Record<string, unknown>;
      const ch = p?.children as { explicitList?: string[] } | undefined;
      ch?.explicitList?.forEach(id => allRefs.add(id));
    }

    return components
      .filter(c => !allRefs.has(c.id))
      .map(comp => {
        const type = Object.keys(comp.component)[0];
        const props = comp.component[type] as Record<string, unknown>;
        const compChildren = props?.children as { explicitList?: string[] } | undefined;

        return (
          <div key={comp.id} className="ml-2">
            <div className="flex items-center gap-1 py-0.5 hover:bg-gray-100 rounded px-1">
              <span className="text-purple-600">&lt;{type}&gt;</span>
              <span className="text-gray-400 text-xs">#{comp.id}</span>
            </div>
            {compChildren?.explicitList && (
              <div className="ml-4 border-l border-gray-200 pl-2">
                {compChildren.explicitList.map(childId => {
                  const childComp = components.find(c => c.id === childId);
                  if (!childComp) return null;
                  const childType = Object.keys(childComp.component)[0];

                  return (
                    <div key={childId}>
                      <div className="flex items-center gap-1 py-0.5 hover:bg-gray-100 rounded px-1">
                        <span className="text-purple-600">&lt;{childType}&gt;</span>
                        <span className="text-gray-400 text-xs">#{childId}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {surfaceIds.length === 0 ? (
        <div className="p-4 text-gray-400 text-center text-sm">
          No surfaces registered yet
        </div>
      ) : (
        surfaceIds.map(surfaceId => {
          const components = state.components.get(surfaceId);
          return (
            <div key={surfaceId} className="border-b">
              <div className="p-2 bg-gray-100 font-medium text-sm">
                Surface: {surfaceId}
              </div>
              <div className="p-2 font-mono text-xs">
                {components ? (
                  renderComponentTree(components)
                ) : (
                  <span className="text-gray-400">No components</span>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function DirtyPathsPanel() {
  const { dataModel, getValue } = useA2UIContext();
  const [, forceUpdate] = useState({});

  useEffect(() => {
    return dataModel.subscribe(() => forceUpdate({}));
  }, [dataModel]);

  const dirtyPaths = dataModel.getDirtyPaths();

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-gray-50 flex-shrink-0">
        <div className="text-sm text-gray-600">
          Dirty paths are marked when users modify form inputs.
          Server updates skip these paths to preserve user input.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {dirtyPaths.length === 0 ? (
          <div className="text-gray-400 text-center p-4">
            No dirty paths. User has not modified any inputs yet.
          </div>
        ) : (
          <div className="space-y-1">
            {dirtyPaths.map(path => (
              <div
                key={path}
                className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded"
              >
                <span className="text-yellow-800">{path}</span>
                <span className="text-gray-500 text-xs truncate max-w-[200px]">
                  = {JSON.stringify(getValue(path))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-2 border-t bg-gray-50 flex items-center justify-between flex-shrink-0">
        <span className="text-xs text-gray-500">
          {dirtyPaths.length} dirty path(s)
        </span>
        <button
          className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
          onClick={() => {
            dataModel.clearAllDirty();
            forceUpdate({});
          }}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

// Check if we're in development mode
const isDev = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
);

export function A2UIDevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('logs');
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Keyboard shortcut: Ctrl+Shift+D to toggle DevTools
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Only show in development
  if (!isDev) {
    return null;
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.devtools-content')) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // Toggle button when closed
  if (!isOpen) {
    return (
      <button
        className="fixed bottom-4 right-4 z-[9999] bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-700 flex items-center gap-2 text-sm"
        onClick={() => setIsOpen(true)}
      >
        <span className="text-lg">🔧</span>
        A2UI DevTools
      </button>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'logs', label: 'Logs' },
    { id: 'dataModel', label: 'DataModel' },
    { id: 'components', label: 'Components' },
    { id: 'dirtyPaths', label: 'Dirty Paths' },
  ];

  return (
    <div
      className="fixed z-[9999] bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: isMinimized ? 300 : size.width,
        height: isMinimized ? 40 : size.height,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-gray-800 text-white cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <span>🔧</span>
          <span className="font-medium text-sm">A2UI DevTools</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-0.5 hover:bg-gray-700 rounded text-xs"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? '▢' : '—'}
          </button>
          <button
            className="px-2 py-0.5 hover:bg-red-600 rounded text-xs"
            onClick={() => setIsOpen(false)}
          >
            ✕
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="devtools-content flex flex-col" style={{ height: size.height - 40 }}>
          {/* Tabs */}
          <div className="flex border-b bg-gray-50 flex-shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`px-4 py-2 text-sm font-medium border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === 'logs' && <LogsPanel />}
            {activeTab === 'dataModel' && <DataModelPanel />}
            {activeTab === 'components' && <ComponentsPanel />}
            {activeTab === 'dirtyPaths' && <DirtyPathsPanel />}
          </div>
        </div>
      )}

      {/* Resize handle */}
      {!isMinimized && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={e => {
            e.preventDefault();
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = size.width;
            const startHeight = size.height;

            const handleMouseMove = (e: MouseEvent) => {
              setSize({
                width: Math.max(400, startWidth + e.clientX - startX),
                height: Math.max(200, startHeight + e.clientY - startY),
              });
            };

            const handleMouseUp = () => {
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <svg className="w-4 h-4 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22 22H20V20H22V22ZM22 18H18V22H22V18ZM18 22H14V18H18V22ZM22 14H14V22H22V14Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
