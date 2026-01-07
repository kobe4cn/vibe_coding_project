/**
 * Flow Editor App
 * Main entry point with routing and storage provider
 */

import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { StorageProviderComponent, checkMigrationNeeded } from '@/lib/storage'
import { MigrationDialog } from '@/components/ui/MigrationDialog'
import { FlowListPage } from '@/pages/FlowListPage'
import { FlowEditorPage } from '@/pages/FlowEditorPage'
import { ToolsPage } from '@/pages/ToolsPage'
import { PublishedFlowsPage } from '@/pages/PublishedFlowsPage'
import { useEditorStore } from '@/stores/editorStore'

// Helper function to check if it's night time (6PM - 6AM)
function isNightTime(): boolean {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme, setResolvedTheme } = useEditorStore()

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  // Handle theme changes and auto-switching
  useEffect(() => {
    if (theme === 'light') {
      setResolvedTheme('light')
    } else if (theme === 'dark') {
      setResolvedTheme('dark')
    } else {
      const updateThemeByTime = () => {
        setResolvedTheme(isNightTime() ? 'dark' : 'light')
      }

      updateThemeByTime()
      const interval = setInterval(updateThemeByTime, 60000)
      return () => clearInterval(interval)
    }
  }, [theme, setResolvedTheme])

  return <>{children}</>
}

function AppContent() {
  const [showMigration, setShowMigration] = useState(false)
  const [checkingMigration, setCheckingMigration] = useState(true)

  useEffect(() => {
    async function check() {
      const needsMigration = await checkMigrationNeeded()
      if (needsMigration) {
        setShowMigration(true)
      }
      setCheckingMigration(false)
    }
    check()
  }, [])

  if (checkingMigration) {
    return (
      <div
        className="h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--surface-dim)' }}
      >
        <div className="text-center">
          <div
            className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-4"
            style={{ color: 'var(--primary)' }}
          />
          <p
            className="text-sm"
            style={{ color: 'var(--on-surface-variant)' }}
          >
            初始化中...
          </p>
        </div>
      </div>
    )
  }

  if (showMigration) {
    return (
      <MigrationDialog
        onComplete={() => setShowMigration(false)}
        onSkip={() => setShowMigration(false)}
      />
    )
  }

  return (
    <Routes>
      <Route path="/" element={<FlowListPage />} />
      <Route path="/tools" element={<ToolsPage />} />
      <Route path="/published" element={<PublishedFlowsPage />} />
      <Route path="/editor/:flowId" element={<FlowEditorPage />} />
      <Route path="/editor/:flowId/version/:versionId" element={<FlowEditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <StorageProviderComponent>
          <AppContent />
        </StorageProviderComponent>
      </ThemeProvider>
    </BrowserRouter>
  )
}
