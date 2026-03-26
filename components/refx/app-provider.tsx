'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useAppStore } from '@/lib/store'
import { Loader2 } from 'lucide-react'
import { loadAppSettings } from '@/lib/app-settings'
import { useTheme } from 'next-themes'

interface AppProviderProps {
  children: React.ReactNode
}

export function AppProvider({ children }: AppProviderProps) {
  const [isLoading, setIsLoading] = useState(true)
  const initialize = useAppStore((state) => state.initialize)
  const initialized = useAppStore((state) => state.initialized)
  const isDesktopApp = useAppStore((state) => state.isDesktopApp)
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
      setTheme(settings.theme)
      document.documentElement.style.fontSize = `${settings.fontSize}px`
    }

    void applySettings()
  }, [initialized, isDesktopApp, setTheme])

  if (isLoading || !initialized) {
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
            <span className="text-sm">Loading your research library...</span>
          </div>
        </div>
      </div>
    )
  }
  return children
}
