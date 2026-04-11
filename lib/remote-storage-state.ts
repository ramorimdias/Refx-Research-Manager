'use client'

import { invoke } from '@/lib/tauri/client'

export type RemoteStorageMode = 'local' | 'remoteWriter' | 'remoteReader' | 'remoteOfflineCache'
export type RemoteVaultSyncPhase = 'idle' | 'pulling' | 'pushing'

export type RemoteVaultLease = {
  deviceId: string
  hostname: string
  createdAt: string
  expiresAt: string
}

export type RemoteVaultStatus = {
  enabled: boolean
  mode: RemoteStorageMode
  isWritable: boolean
  isOffline: boolean
  path?: string | null
  vaultId?: string | null
  deviceId: string
  revision?: number | null
  remoteUpdatedAt?: string | null
  remoteLastPulledAt?: string | null
  remoteLastPushedAt?: string | null
  activeLease?: RemoteVaultLease | null
  message: string
  cacheBytes: number
}

const LOCAL_STATUS: RemoteVaultStatus = {
  enabled: false,
  mode: 'local',
  isWritable: true,
  isOffline: false,
  deviceId: '',
  message: 'Using local library storage.',
  cacheBytes: 0,
}

let currentRemoteVaultStatus: RemoteVaultStatus = LOCAL_STATUS
const listeners = new Set<(status: RemoteVaultStatus) => void>()
let currentRemoteVaultSyncPhase: RemoteVaultSyncPhase = 'idle'
const syncPhaseListeners = new Set<(phase: RemoteVaultSyncPhase) => void>()
let activeSyncOperationCount = 0
let pendingPushTimer: number | null = null

export function getRemoteVaultStatusSnapshot() {
  return currentRemoteVaultStatus
}

export function setRemoteVaultStatus(status: RemoteVaultStatus | null | undefined) {
  currentRemoteVaultStatus = status ?? LOCAL_STATUS
  listeners.forEach((listener) => listener(currentRemoteVaultStatus))
}

export function subscribeRemoteVaultStatus(listener: (status: RemoteVaultStatus) => void) {
  listeners.add(listener)
  listener(currentRemoteVaultStatus)
  return () => {
    listeners.delete(listener)
  }
}

export function getRemoteVaultSyncPhaseSnapshot() {
  return currentRemoteVaultSyncPhase
}

export function setRemoteVaultSyncPhase(phase: RemoteVaultSyncPhase) {
  currentRemoteVaultSyncPhase = phase
  syncPhaseListeners.forEach((listener) => listener(currentRemoteVaultSyncPhase))
}

export function beginRemoteVaultSyncPhase(phase: Exclude<RemoteVaultSyncPhase, 'idle'>) {
  let completed = false
  activeSyncOperationCount += 1
  setRemoteVaultSyncPhase(phase)

  return () => {
    if (completed) return
    completed = true
    activeSyncOperationCount = Math.max(0, activeSyncOperationCount - 1)
    if (activeSyncOperationCount === 0) {
      setRemoteVaultSyncPhase('idle')
    }
  }
}

export function subscribeRemoteVaultSyncPhase(listener: (phase: RemoteVaultSyncPhase) => void) {
  syncPhaseListeners.add(listener)
  listener(currentRemoteVaultSyncPhase)
  return () => {
    syncPhaseListeners.delete(listener)
  }
}

export function assertRemoteWriteAllowed() {
  const status = currentRemoteVaultStatus
  if (!status.enabled || status.isWritable) return
  throw new Error(status.message || 'This remote vault is currently read-only.')
}

export function scheduleRemoteVaultPush() {
  const status = currentRemoteVaultStatus
  if (!status.enabled || status.mode !== 'remoteWriter' || typeof window === 'undefined') return

  if (pendingPushTimer) {
    window.clearTimeout(pendingPushTimer)
  }

  pendingPushTimer = window.setTimeout(() => {
    pendingPushTimer = null
    const endSyncPhase = beginRemoteVaultSyncPhase('pushing')
    void invoke<{ status?: RemoteVaultStatus }>('push_remote_vault')
      .then((result) => {
        if (result.status) {
          setRemoteVaultStatus(result.status)
        }
      })
      .catch((error) => {
        console.warn('Remote vault push failed:', error)
      })
      .finally(() => {
        endSyncPhase()
      })
  }, 1600)
}
