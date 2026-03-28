'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command, Moon, Search, Settings2, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { useTheme } from 'next-themes'
import { getBaseThemeMode, loadAppSettings, saveAppSettings, toggleStoredThemeVariant } from '@/lib/app-settings'

export function TopBar() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const {
    globalSearchQuery,
    setGlobalSearchQuery,
    setPersistentSearch,
    toggleCommandPalette,
    isDesktopApp,
  } = useAppStore()
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const submitGlobalSearch = () => {
    setPersistentSearch({ query: globalSearchQuery.trim() })
    router.push(`/search?q=${encodeURIComponent(globalSearchQuery.trim())}`)
  }

  const toggleTheme = async () => {
    const settings = await loadAppSettings(isDesktopApp)
    const nextTheme = toggleStoredThemeVariant(settings.theme, resolvedTheme)
    setTheme(getBaseThemeMode(nextTheme))
    await saveAppSettings(isDesktopApp, {
      ...settings,
      theme: nextTheme,
    })
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border/80 bg-background/92 px-5 backdrop-blur">
      <div className="relative w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={globalSearchQuery}
          onChange={(event) => setGlobalSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submitGlobalSearch()
            }
          }}
          className="h-10 rounded-full border-border/80 bg-card pl-9 pr-4"
          placeholder="Search"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => toggleCommandPalette(true)}>
          <Command className="h-4 w-4" />
          <span className="hidden lg:inline">Command</span>
          <span className="hidden text-[11px] text-muted-foreground md:inline">Ctrl K</span>
        </Button>

        {mounted && (
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => void toggleTheme()}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        )}

        <Button variant="outline" size="icon" className="rounded-full" onClick={() => router.push('/settings')} aria-label="Open settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
