/**
 * Storage Settings Component
 * Allows users to switch between local and backend storage modes
 */

import { useState, useEffect } from 'react'
import { useStorageConfig } from '@/lib/storage'
import type { StorageConfig, StorageMode } from '@/lib/storage'

interface StorageSettingsProps {
  onClose?: () => void
}

export function StorageSettings({ onClose }: StorageSettingsProps) {
  const { config, setConfig, isReady } = useStorageConfig()
  const [mode, setMode] = useState<StorageMode>(config.mode)
  const [backendUrl, setBackendUrl] = useState(config.backendUrl || '')
  const [token, setToken] = useState(config.token || '')
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    setMode(config.mode)
    setBackendUrl(config.backendUrl || '')
    setToken(config.token || '')
  }, [config])

  const testConnection = async () => {
    if (!backendUrl) {
      setErrorMessage('请输入后端地址')
      setConnectionStatus('error')
      return
    }

    setIsConnecting(true)
    setConnectionStatus('idle')
    setErrorMessage('')

    try {
      const url = backendUrl.replace(/\/$/, '')
      const response = await fetch(`${url}/api/health`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      if (response.ok) {
        setConnectionStatus('success')
      } else {
        setConnectionStatus('error')
        setErrorMessage(`连接失败: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setConnectionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : '连接失败')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSave = () => {
    const newConfig: StorageConfig = {
      mode,
      backendUrl: mode === 'backend' ? backendUrl : undefined,
      token: mode === 'backend' ? token : undefined,
    }
    setConfig(newConfig)
    onClose?.()
  }

  if (!isReady) {
    return <div className="p-4">加载中...</div>
  }

  return (
    <div className="p-6 space-y-6 max-w-lg">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          存储设置
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          选择流程数据的存储方式
        </p>
      </div>

      {/* Storage Mode Selection */}
      <div className="space-y-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          存储模式
        </label>

        <div className="space-y-3">
          {/* Local Mode */}
          <label
            className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
              mode === 'local'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="storageMode"
              value="local"
              checked={mode === 'local'}
              onChange={() => setMode('local')}
              className="mt-0.5 h-4 w-4 text-blue-600"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                本地存储
              </span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                数据保存在浏览器本地 (IndexedDB)，仅在当前设备可用
              </span>
            </div>
          </label>

          {/* Backend Mode */}
          <label
            className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
              mode === 'backend'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="storageMode"
              value="backend"
              checked={mode === 'backend'}
              onChange={() => setMode('backend')}
              className="mt-0.5 h-4 w-4 text-blue-600"
            />
            <div className="ml-3">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                后端服务
              </span>
              <span className="block text-sm text-gray-500 dark:text-gray-400">
                数据保存在后端服务器，支持多设备同步和团队协作
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Backend Configuration */}
      {mode === 'backend' && (
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            <label
              htmlFor="backendUrl"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              后端地址
            </label>
            <input
              type="url"
              id="backendUrl"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              placeholder="https://api.example.com"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              访问令牌 (可选)
            </label>
            <input
              type="password"
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="JWT Token"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {/* Connection Test */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={testConnection}
              disabled={isConnecting || !backendUrl}
              className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-900/20 dark:hover:bg-blue-900/30"
            >
              {isConnecting ? '测试中...' : '测试连接'}
            </button>

            {connectionStatus === 'success' && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                连接成功
              </span>
            )}

            {connectionStatus === 'error' && (
              <span className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={mode === 'backend' && !backendUrl}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          保存设置
        </button>
      </div>

      {/* Warning for mode switch */}
      {mode !== config.mode && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex">
            <svg
              className="h-5 w-5 text-yellow-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                切换存储模式
              </h3>
              <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                切换存储模式后，当前存储中的数据不会自动迁移到新存储。
                如需迁移数据，请先导出流程再导入到新存储。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StorageSettings
