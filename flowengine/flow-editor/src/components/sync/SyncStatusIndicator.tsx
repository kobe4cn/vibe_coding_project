/**
 * Sync Status Indicator Component
 * Shows current sync status in the UI
 */

import { useSyncService, useOnlineStatus } from '@/lib/sync'

export function SyncStatusIndicator() {
  const isOnline = useOnlineStatus()
  const { state, sync } = useSyncService()

  const pendingCount = state.pendingOperations.length

  // Determine icon and color based on status
  const getStatusDisplay = () => {
    if (!isOnline) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
        ),
        color: 'text-gray-500',
        bgColor: 'bg-gray-100 dark:bg-gray-800',
        label: '离线',
      }
    }

    if (state.status === 'syncing') {
      return {
        icon: (
          <svg
            className="w-4 h-4 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        ),
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/20',
        label: '同步中...',
      }
    }

    if (state.status === 'error') {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/20',
        label: '同步失败',
      }
    }

    if (pendingCount > 0) {
      return {
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ),
        color: 'text-yellow-500',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
        label: `${pendingCount} 待同步`,
      }
    }

    return {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      color: 'text-green-500',
      bgColor: 'bg-green-100 dark:bg-green-900/20',
      label: '已同步',
    }
  }

  const display = getStatusDisplay()

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => isOnline && pendingCount > 0 && sync()}
        disabled={!isOnline || pendingCount === 0 || state.status === 'syncing'}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${display.bgColor} ${display.color} hover:opacity-80 disabled:cursor-default`}
        title={state.error || display.label}
      >
        {display.icon}
        <span className="hidden sm:inline">{display.label}</span>
      </button>
    </div>
  )
}

export default SyncStatusIndicator
