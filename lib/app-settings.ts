'use client'

import * as repo from '@/lib/repositories/local-db'
import type { AppLocale } from '@/lib/localization'

const ENV_SEMANTIC_SCHOLAR_API_KEY = process.env.NEXT_PUBLIC_SEMANTIC_SCHOLAR_API_KEY ?? ''

export type StoredAppSettings = {
  userName: string
  skipNamePrompt: boolean
  locale: AppLocale
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
  autoCheckForUpdates: boolean
  autoBackupEnabled: boolean
  autoBackupScope: 'full' | 'documents' | 'settings'
  autoBackupIntervalDays: string
  autoBackupKeepCount: string
  autoOcr: boolean
  autoMetadata: boolean
  autoOnlineMetadataEnrichment: boolean
  advancedClassificationMode: 'off' | 'local_heuristic'
  crossrefContactEmail: string
  semanticScholarApiKey: string
}

export const DEFAULT_APP_SETTINGS: StoredAppSettings = {
  userName: '',
  skipNamePrompt: false,
  locale: 'en',
  theme: 'system',
  fontSize: '16',
  autoCheckForUpdates: true,
  autoBackupEnabled: false,
  autoBackupScope: 'full',
  autoBackupIntervalDays: '7',
  autoBackupKeepCount: '5',
  autoOcr: true,
  autoMetadata: true,
  autoOnlineMetadataEnrichment: false,
  advancedClassificationMode: 'off',
  crossrefContactEmail: '',
  semanticScholarApiKey: ENV_SEMANTIC_SCHOLAR_API_KEY,
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

function resolveSemanticScholarApiKey(value: string | undefined): string {
  const parsed = parseValue(value, '').trim()
  return parsed || ENV_SEMANTIC_SCHOLAR_API_KEY
}

export async function loadAppSettings(isDesktopApp: boolean): Promise<StoredAppSettings> {
  if (!isDesktopApp) {
    if (typeof window === 'undefined') return DEFAULT_APP_SETTINGS
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY)
    if (!raw) return DEFAULT_APP_SETTINGS
    const parsed = parseValue<Partial<StoredAppSettings>>(raw, {})
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      locale: parsed.locale ?? DEFAULT_APP_SETTINGS.locale,
      semanticScholarApiKey: parsed.semanticScholarApiKey?.trim() || ENV_SEMANTIC_SCHOLAR_API_KEY,
    }
  }

  const stored = await repo.getSettings()
  return {
    userName: parseValue(stored.userName, DEFAULT_APP_SETTINGS.userName),
    skipNamePrompt: parseValue(stored.skipNamePrompt, DEFAULT_APP_SETTINGS.skipNamePrompt),
    locale: parseValue(stored.locale, DEFAULT_APP_SETTINGS.locale),
    theme: parseValue(stored.theme, DEFAULT_APP_SETTINGS.theme),
    fontSize: parseValue(stored.fontSize, DEFAULT_APP_SETTINGS.fontSize),
    autoCheckForUpdates: parseValue(stored.autoCheckForUpdates, DEFAULT_APP_SETTINGS.autoCheckForUpdates),
    autoBackupEnabled: parseValue(stored.autoBackupEnabled, DEFAULT_APP_SETTINGS.autoBackupEnabled),
    autoBackupScope: parseValue(stored.autoBackupScope, DEFAULT_APP_SETTINGS.autoBackupScope),
    autoBackupIntervalDays: parseValue(stored.autoBackupIntervalDays, DEFAULT_APP_SETTINGS.autoBackupIntervalDays),
    autoBackupKeepCount: parseValue(stored.autoBackupKeepCount, DEFAULT_APP_SETTINGS.autoBackupKeepCount),
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
    semanticScholarApiKey: resolveSemanticScholarApiKey(stored.semanticScholarApiKey),
  }
}

export async function saveAppSettings(isDesktopApp: boolean, settings: StoredAppSettings) {
  if (!isDesktopApp) {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
      window.dispatchEvent(new CustomEvent('refx-settings-changed', { detail: settings }))
    }
    return
  }

  await repo.setSettings({
    userName: JSON.stringify(settings.userName),
    skipNamePrompt: JSON.stringify(settings.skipNamePrompt),
    locale: JSON.stringify(settings.locale),
    theme: JSON.stringify(settings.theme),
    fontSize: JSON.stringify(settings.fontSize),
    autoCheckForUpdates: JSON.stringify(settings.autoCheckForUpdates),
    autoBackupEnabled: JSON.stringify(settings.autoBackupEnabled),
    autoBackupScope: JSON.stringify(settings.autoBackupScope),
    autoBackupIntervalDays: JSON.stringify(settings.autoBackupIntervalDays),
    autoBackupKeepCount: JSON.stringify(settings.autoBackupKeepCount),
    autoOcr: JSON.stringify(settings.autoOcr),
    autoMetadata: JSON.stringify(settings.autoMetadata),
    autoOnlineMetadataEnrichment: JSON.stringify(settings.autoOnlineMetadataEnrichment),
    advancedClassificationMode: JSON.stringify(settings.advancedClassificationMode),
    crossrefContactEmail: JSON.stringify(settings.crossrefContactEmail),
    semanticScholarApiKey: JSON.stringify(settings.semanticScholarApiKey),
  })

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('refx-settings-changed', { detail: settings }))
  }
}
