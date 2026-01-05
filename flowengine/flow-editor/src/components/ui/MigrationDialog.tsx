/**
 * Migration Dialog Component
 * Shows migration progress when legacy data is detected
 */

import { useState, useEffect, useCallback } from 'react'
import {
  detectLegacyData,
  migrateFromLegacy,
  cleanupLegacyData,
  type MigrationResult,
} from '@/lib/storage/migration'

// Icons
const Icons = {
  migration: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
    </svg>
  ),
  check: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  warning: (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
    </svg>
  ),
  loading: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="animate-spin">
      <path d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
    </svg>
  ),
}

interface MigrationDialogProps {
  onComplete: () => void
  onSkip?: () => void
}

type MigrationPhase = 'detecting' | 'prompt' | 'migrating' | 'cleanup' | 'complete' | 'error'

export function MigrationDialog({ onComplete, onSkip }: MigrationDialogProps) {
  const [phase, setPhase] = useState<MigrationPhase>('detecting')
  const [legacyInfo, setLegacyInfo] = useState<{ flowCount: number; versionCount: number }>({
    flowCount: 0,
    versionCount: 0,
  })
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' })
  const [result, setResult] = useState<MigrationResult | null>(null)

  // Detect legacy data on mount
  useEffect(() => {
    async function detect() {
      const info = await detectLegacyData()
      if (info.hasLegacyData) {
        setLegacyInfo({ flowCount: info.flowCount, versionCount: info.versionCount })
        setPhase('prompt')
      } else {
        onComplete()
      }
    }
    detect()
  }, [onComplete])

  const handleMigrate = useCallback(async () => {
    setPhase('migrating')

    const migrationResult = await migrateFromLegacy((p) => {
      setProgress({ current: p.current, total: p.total, message: p.message })
      if (p.phase === 'complete') {
        setPhase('cleanup')
      }
    })

    setResult(migrationResult)

    if (migrationResult.success) {
      // Clean up legacy data
      await cleanupLegacyData((p) => {
        setProgress({ current: p.current, total: p.total, message: p.message })
      })
      setPhase('complete')
    } else {
      setPhase('error')
    }
  }, [])

  const handleSkip = useCallback(() => {
    onSkip?.()
    onComplete()
  }, [onComplete, onSkip])

  const handleFinish = useCallback(() => {
    onComplete()
  }, [onComplete])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
    >
      <div
        className="w-full max-w-md rounded-3xl p-8 shadow-2xl animate-md-fade-in"
        style={{ backgroundColor: 'var(--surface-container-high)' }}
      >
        {phase === 'detecting' && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--surface-container-highest)' }}
            >
              {Icons.loading}
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              检测数据...
            </h2>
            <p
              className="text-sm"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              正在检查是否有需要迁移的旧版数据
            </p>
          </div>
        )}

        {phase === 'prompt' && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-container)' }}
            >
              <span style={{ color: 'var(--on-primary-container)' }}>
                {Icons.migration}
              </span>
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              发现旧版数据
            </h2>
            <p
              className="text-sm mb-6"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              检测到 {legacyInfo.flowCount} 个流程，共 {legacyInfo.versionCount} 个版本。
              建议迁移到新格式以获得更好的管理体验。
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--surface-container-highest)',
                  color: 'var(--on-surface-variant)',
                }}
              >
                暂不迁移
              </button>
              <button
                onClick={handleMigrate}
                className="flex-1 px-4 py-3 text-sm font-medium rounded-xl transition-all"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'var(--on-primary)',
                }}
              >
                开始迁移
              </button>
            </div>
          </div>
        )}

        {phase === 'migrating' && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--surface-container-highest)' }}
            >
              {Icons.loading}
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              正在迁移...
            </h2>
            <p
              className="text-sm mb-4"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {progress.message}
            </p>
            {progress.total > 0 && (
              <div className="w-full">
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--surface-container-highest)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      backgroundColor: 'var(--primary)',
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
                <p
                  className="text-xs mt-2"
                  style={{ color: 'var(--on-surface-variant)' }}
                >
                  {progress.current} / {progress.total}
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'cleanup' && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--surface-container-highest)' }}
            >
              {Icons.loading}
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              清理旧数据...
            </h2>
            <p
              className="text-sm"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              {progress.message}
            </p>
          </div>
        )}

        {phase === 'complete' && result && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--tertiary-container)' }}
            >
              <span style={{ color: 'var(--on-tertiary-container)' }}>
                {Icons.check}
              </span>
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              迁移完成
            </h2>
            <p
              className="text-sm mb-6"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              成功迁移 {result.migratedFlows} 个流程，{result.migratedVersions} 个版本。
            </p>
            <button
              onClick={handleFinish}
              className="w-full px-4 py-3 text-sm font-medium rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              开始使用
            </button>
          </div>
        )}

        {phase === 'error' && result && (
          <div className="text-center">
            <div
              className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--error-container)' }}
            >
              <span style={{ color: 'var(--on-error-container)' }}>
                {Icons.warning}
              </span>
            </div>
            <h2
              className="text-xl font-medium mb-2"
              style={{ color: 'var(--on-surface)' }}
            >
              迁移遇到问题
            </h2>
            <p
              className="text-sm mb-2"
              style={{ color: 'var(--on-surface-variant)' }}
            >
              已迁移 {result.migratedFlows} 个流程，{result.migratedVersions} 个版本。
            </p>
            {result.errors.length > 0 && (
              <div
                className="text-left p-3 rounded-xl mb-4 max-h-32 overflow-y-auto"
                style={{
                  backgroundColor: 'var(--error-container)',
                  color: 'var(--on-error-container)',
                }}
              >
                <p className="text-xs font-medium mb-1">错误详情:</p>
                <ul className="text-xs list-disc list-inside">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>...还有 {result.errors.length - 5} 个错误</li>
                  )}
                </ul>
              </div>
            )}
            <button
              onClick={handleFinish}
              className="w-full px-4 py-3 text-sm font-medium rounded-xl transition-all"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'var(--on-primary)',
              }}
            >
              继续使用
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
