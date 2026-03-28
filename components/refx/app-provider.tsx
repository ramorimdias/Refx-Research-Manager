'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useAppStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'
import { getBaseThemeMode, getThemeAccentVariant, loadAppSettings } from '@/lib/app-settings'
import * as repo from '@/lib/repositories/local-db'
import { useTheme } from 'next-themes'

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const [isUiPrefsReady, setIsUiPrefsReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const initialize = useAppStore((state) => state.initialize)
  const initialized = useAppStore((state) => state.initialized)
  const isDesktopApp = useAppStore((state) => state.isDesktopApp)
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed)
  const setSidebarCollapsed = useAppStore((state) => state.setSidebarCollapsed)
  const { setTheme } = useTheme()

  useEffect(() => {
    const init = async () => {
      try {
        await initialize()
      } catch (error) {
        console.error('Failed to initialize app:', error)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [initialize])

  useEffect(() => {
    if (!initialized) return

    const applySettings = async () => {
      const settings = await loadAppSettings(isDesktopApp)
      setTheme(getBaseThemeMode(settings.theme))
      const accentVariant = getThemeAccentVariant(settings.theme)
      if (accentVariant) {
        document.documentElement.dataset.refxAccent = accentVariant
      } else {
        delete document.documentElement.dataset.refxAccent
      }
      document.documentElement.style.fontSize = `${settings.fontSize}px`

      if (isDesktopApp && settings.autoBackupEnabled) {
        void repo.runScheduledBackupIfDue(
          settings.autoBackupScope,
          Number(settings.autoBackupIntervalDays),
        ).catch((error) => {
          console.error('Automatic backup failed:', error)
        })
      }
    }

    void applySettings()
  }, [initialized, isDesktopApp, setTheme])

  useEffect(() => {
    if (!initialized || typeof window === 'undefined') return

    const stored = window.localStorage.getItem('refx.ui.sidebar-collapsed')
    if (stored !== null) {
      setSidebarCollapsed(stored === 'true')
    }
    setIsUiPrefsReady(true)
  }, [initialized, setSidebarCollapsed])

  useEffect(() => {
    if (!initialized || !isUiPrefsReady || typeof window === 'undefined') return
    window.localStorage.setItem('refx.ui.sidebar-collapsed', String(sidebarCollapsed))
  }, [initialized, isUiPrefsReady, sidebarCollapsed])

  if (isLoading || !initialized || !isUiPrefsReady) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/icon.svg"
              alt="Refx"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl"
            />
            <span className="text-2xl font-semibold">Refx</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading workspace...</span>
          </div>
        </div>
      </div>
    )
  }
  return children
}
