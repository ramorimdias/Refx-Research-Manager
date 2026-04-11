'use client'

import type { RemoteVaultStatus } from '@/lib/remote-storage-state'

type Translator = (key: string, params?: Record<string, string | number>) => string

export function getRemoteVaultModeLabel(t: Translator, status: RemoteVaultStatus | null | undefined) {
  switch (status?.mode) {
    case 'remoteWriter':
      return t('settings.remoteVault.modeWriter')
    case 'remoteReader':
      return t('settings.remoteVault.modeReader')
    case 'remoteOfflineCache':
      return t('settings.remoteVault.modeOffline')
    case 'local':
    default:
      return t('settings.remoteVault.modeLocal')
  }
}

export function getRemoteVaultDisplayMessage(t: Translator, status: RemoteVaultStatus | null | undefined) {
  if (!status?.enabled) {
    return t('settings.remoteVault.notConfigured')
  }

  switch (status.mode) {
    case 'remoteWriter':
      return t('settings.remoteVault.writerMessage')
    case 'remoteReader': {
      if (!status.activeLease) {
        return t('settings.remoteVault.leaseReleasedMessage')
      }
      const holder = status.activeLease?.hostname?.trim() || t('settings.remoteVault.anotherDevice')
      return t('settings.remoteVault.readerMessage', { holder })
    }
    case 'remoteOfflineCache':
      return t('settings.remoteVault.offlineMessage')
    case 'local':
    default:
      return t('settings.remoteVault.localMessage')
  }
}
