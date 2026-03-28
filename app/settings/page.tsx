'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Database, HardDrive, Palette, Settings, ShieldAlert, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_APP_SETTINGS,
  getBaseThemeMode,
  getThemeAccentVariant,
  loadAppSettings,
  saveAppSettings,
  type StoredAppSettings,
} from '@/lib/app-settings'
import { useAppStore } from '@/lib/store'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

type SettingsSection = 'general' | 'display' | 'processing' | 'data' | 'about'

const sections: Array<{ id: SettingsSection; label: string; icon: typeof Settings }> = [
  { id: 'general', label: 'General', icon: Settings },
  { id: 'display', label: 'Display', icon: Palette },
  { id: 'processing', label: 'Processing', icon: Sparkles },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'about', label: 'About', icon: HardDrive },
]

export default function SettingsPage() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { clearLocalData, scanDocumentsOcr, documents, isDesktopApp } = useAppStore()
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [isClearing, setIsClearing] = useState(false)
  const [isScanningOcr, setIsScanningOcr] = useState(false)
  const [settings, setSettings] = useState<StoredAppSettings>(DEFAULT_APP_SETTINGS)
  const hasLoadedSettingsRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const loaded = await loadAppSettings(isDesktopApp)
      if (!cancelled) {
        setSettings(loaded)
        hasLoadedSettingsRef.current = true
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isDesktopApp])

  const activeMeta = useMemo(
    () => sections.find((section) => section.id === activeSection) ?? sections[0],
    [activeSection],
  )

  const updateSettings = <K extends keyof StoredAppSettings>(key: K, value: StoredAppSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  useEffect(() => {
    if (!hasLoadedSettingsRef.current) return

    const applyAndSave = async () => {
      await saveAppSettings(isDesktopApp, settings)
      const accentVariant = getThemeAccentVariant(settings.theme)
      setTheme(getBaseThemeMode(settings.theme))
      if (typeof document !== 'undefined') {
        if (accentVariant) {
          document.documentElement.dataset.refxAccent = accentVariant
        } else {
          delete document.documentElement.dataset.refxAccent
        }
        document.documentElement.style.fontSize = `${settings.fontSize}px`
      }
    }

    void applyAndSave()
  }, [isDesktopApp, setTheme, settings])

  const applySettingsImmediately = () => {
    const accentVariant = getThemeAccentVariant(settings.theme)
    setTheme(getBaseThemeMode(settings.theme))
    if (typeof document !== 'undefined') {
      if (accentVariant) {
        document.documentElement.dataset.refxAccent = accentVariant
      } else {
        delete document.documentElement.dataset.refxAccent
      }
      document.documentElement.style.fontSize = `${settings.fontSize}px`
    }
  }

  useEffect(() => {
    applySettingsImmediately()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme, settings.fontSize])

  const handleClearLocalData = async () => {
    const confirmed = window.confirm('Clear all local documents, notes, and imported files? This cannot be undone.')
    if (!confirmed) return

    setIsClearing(true)
    try {
      await clearLocalData()
      router.push('/libraries')
    } finally {
      setIsClearing(false)
    }
  }

  const handleScanAllOcr = async () => {
    setIsScanningOcr(true)
    try {
      await scanDocumentsOcr()
    } finally {
      setIsScanningOcr(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border/80 bg-background/92 px-6 py-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Settings className="h-6 w-6" />
              Settings
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Preferences for this device.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-56 shrink-0 overflow-auto border-r border-border/80 bg-muted/20 md:block">
          <nav className="space-y-1 p-4">
            {sections.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={cn(
                  'flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  activeSection === id ? 'bg-background font-medium text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.06)]' : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                )}
                onClick={() => setActiveSection(id)}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{activeMeta.label}</h2>
              <p className="text-sm text-muted-foreground">Adjust local behavior.</p>
            </div>

            {activeSection === 'general' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Workspace Mode</CardTitle>
                    <CardDescription>Everything stays local in this build.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between rounded-lg bg-muted p-3">
                      <div>
                        <p className="text-sm font-medium">Local Workspace</p>
                        <p className="mt-1 text-xs text-muted-foreground">All content stays on this device.</p>
                      </div>
                      <Badge>Offline</Badge>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeSection === 'display' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Appearance</CardTitle>
                  <CardDescription>Appearance for this device.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm">Theme</Label>
                    <Select value={settings.theme} onValueChange={(value) => updateSettings('theme', value as StoredAppSettings['theme'])}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="system">System</SelectItem>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="light-brown">Light Brown</SelectItem>
                        <SelectItem value="light-red">Light Red</SelectItem>
                        <SelectItem value="light-green">Light Green</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="dark-brown">Dark Brown</SelectItem>
                        <SelectItem value="dark-red">Dark Red</SelectItem>
                        <SelectItem value="dark-green">Dark Green</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-sm">Font Size</Label>
                    <Select value={settings.fontSize} onValueChange={(value) => updateSettings('fontSize', value as StoredAppSettings['fontSize'])}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14">Small (14px)</SelectItem>
                        <SelectItem value="16">Medium (16px)</SelectItem>
                        <SelectItem value="18">Large (18px)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeSection === 'processing' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Automatic Processing</CardTitle>
                    <CardDescription>Processing defaults.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Auto OCR</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Run OCR after import.</p>
                      </div>
                      <Checkbox checked={settings.autoOcr} onCheckedChange={(checked) => updateSettings('autoOcr', !!checked)} />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Auto Metadata Extraction</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Extract title, authors, year, and DOI during import.</p>
                      </div>
                      <Checkbox
                        checked={settings.autoMetadata}
                        onCheckedChange={(checked) => updateSettings('autoMetadata', !!checked)}
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Auto Online Metadata Enrichment</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Use Crossref first and Semantic Scholar second when metadata is incomplete.</p>
                      </div>
                      <Checkbox
                        checked={settings.autoOnlineMetadataEnrichment}
                        onCheckedChange={(checked) => updateSettings('autoOnlineMetadataEnrichment', !!checked)}
                      />
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-medium">Advanced Semantic Classification</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Optional topic classification after tag suggestion.</p>
                      <Select
                        value={settings.advancedClassificationMode}
                        onValueChange={(value) => updateSettings('advancedClassificationMode', value as StoredAppSettings['advancedClassificationMode'])}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="off">Disabled</SelectItem>
                          <SelectItem value="local_heuristic">Local Heuristic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Metadata API Configuration</CardTitle>
                  <CardDescription>Provider configuration is stored locally on this device.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Crossref Contact Email</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Optional contact hint for Crossref requests.</p>
                      <Input
                        type="email"
                        value={settings.crossrefContactEmail}
                        onChange={(event) => updateSettings('crossrefContactEmail', event.target.value)}
                        className="mt-2"
                        placeholder="name@example.com"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Semantic Scholar API Key</Label>
                      <p className="mt-1 text-xs text-muted-foreground">Optional secondary enrichment source.</p>
                      <Input
                        type="password"
                        value={settings.semanticScholarApiKey}
                        onChange={(event) => updateSettings('semanticScholarApiKey', event.target.value)}
                        className="mt-2"
                        placeholder="Enter your Semantic Scholar API key"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">OCR Scan</CardTitle>
                  <CardDescription>Scan stored documents and persist OCR/search state.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{documents.length} documents available.</p>
                    <Button variant="outline" onClick={() => void handleScanAllOcr()} disabled={isScanningOcr || documents.length === 0}>
                      {isScanningOcr ? 'Scanning...' : 'Scan All OCR'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {activeSection === 'data' && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Local Data</CardTitle>
                  <CardDescription>Reset local content while keeping app preferences.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      This removes documents, notes, comments, tags, and imported files, then recreates one empty library.
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200/70 bg-red-50/80">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base text-red-900">
                      <ShieldAlert className="h-4 w-4" />
                      Danger Zone
                    </CardTitle>
                    <CardDescription className="text-red-800">This action is irreversible.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button variant="destructive" className="w-full" onClick={() => void handleClearLocalData()} disabled={isClearing}>
                      {isClearing ? 'Clearing...' : 'Clear Local Data'}
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {activeSection === 'about' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Application</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Mode</span>
                    <Badge variant="secondary">{isDesktopApp ? 'Desktop' : 'Preview'}</Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Version</span>
                    <Badge variant="secondary">v1.0.0</Badge>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
