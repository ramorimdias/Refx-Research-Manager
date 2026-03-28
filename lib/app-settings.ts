'use client'

import * as repo from '@/lib/repositories/local-db'

export type StoredAppSettings = {
  theme:
    | 'light'
    | 'dark'
    | 'system'
    | 'light-brown'
    | 'light-red'
    | 'light-green'
    | 'dark-brown'
    | 'dark-red'
    | 'dark-green'
  fontSize: '14' | '16' | '18'
  autoOcr: boolean
  autoMetadata: boolean
  autoOnlineMetadataEnrichment: boolean
  advancedClassificationMode: 'off' | 'local_heuristic'
  crossrefContactEmail: string
  semanticScholarApiKey: string
}

export const DEFAULT_APP_SETTINGS: StoredAppSettings = {
  theme: 'system',
  fontSize: '16',
  autoOcr: true,
  autoMetadata: true,
  autoOnlineMetadataEnrichment: false,
  advancedClassificationMode: 'off',
  crossrefContactEmail: '',
  semanticScholarApiKey: '',
}

export function getBaseThemeMode(theme: StoredAppSettings['theme']): 'light' | 'dark' | 'system' {
  if (theme === 'system') return 'system'
  if (theme.startsWith('dark')) return 'dark'
  return 'light'
}

export function getThemeAccentVariant(theme: StoredAppSettings['theme']): string | null {
  switch (theme) {
    case 'light-brown':
    case 'light-red':
    case 'light-green':
    case 'dark-brown':
    case 'dark-red':
    case 'dark-green':
      return theme
    default:
      return null
  }
}

export function toggleStoredThemeVariant(
  theme: StoredAppSettings['theme'],
  resolvedTheme?: string,
): StoredAppSettings['theme'] {
  switch (theme) {
    case 'light-brown':
      return 'dark-brown'
    case 'dark-brown':
      return 'light-brown'
    case 'light-red':
      return 'dark-red'
    case 'dark-red':
      return 'light-red'
    case 'light-green':
      return 'dark-green'
    case 'dark-green':
      return 'light-green'
    case 'system':
      return resolvedTheme === 'dark' ? 'light' : 'dark'
    case 'dark':
      return 'light'
    case 'light':
    default:
      return 'dark'
  }
}

const SETTINGS_STORAGE_KEY = 'refx-settings'

function parseValue<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function loadAppSettings(isDesktopApp: boolean): Promise<StoredAppSettings> {
  if (!isDesktopApp) {
    if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_APP_SETTINGS
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parseValue<Partial<StoredAppSettings>>(raw, {}),
    }
  }

  const stored = await repo.getSettings()
  return {
    theme: parseValue(stored.theme, DEFAULT_APP_SETTINGS.theme),
    fontSize: parseValue(stored.fontSize, DEFAULT_APP_SETTINGS.fontSize),
    autoOcr: parseValue(stored.autoOcr, DEFAULT_APP_SETTINGS.autoOcr),
    autoMetadata: parseValue(stored.autoMetadata, DEFAULT_APP_SETTINGS.autoMetadata),
    autoOnlineMetadataEnrichment: parseValue(
      stored.autoOnlineMetadataEnrichment,
      DEFAULT_APP_SETTINGS.autoOnlineMetadataEnrichment,
    ),
    advancedClassificationMode: parseValue(
      stored.advancedClassificationMode,
      DEFAULT_APP_SETTINGS.advancedClassificationMode,
    ),
    crossrefContactEmail: parseValue(stored.crossrefContactEmail, DEFAULT_APP_SETTINGS.crossrefContactEmail),
    semanticScholarApiKey: parseValue(stored.semanticScholarApiKey, DEFAULT_APP_SETTINGS.semanticScholarApiKey),
  }
}

export async function saveAppSettings(isDesktopApp: boolean, settings: StoredAppSettings) {
  if (!isDesktopApp) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    }
    return
  }

  await repo.setSettings({
    theme: JSON.stringify(settings.theme),
    fontSize: JSON.stringify(settings.fontSize),
    autoOcr: JSON.stringify(settings.autoOcr),
    autoMetadata: JSON.stringify(settings.autoMetadata),
    autoOnlineMetadataEnrichment: JSON.stringify(settings.autoOnlineMetadataEnrichment),
    advancedClassificationMode: JSON.stringify(settings.advancedClassificationMode),
    crossrefContactEmail: JSON.stringify(settings.crossrefContactEmail),
    semanticScholarApiKey: JSON.stringify(settings.semanticScholarApiKey),
  })
}
