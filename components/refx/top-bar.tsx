'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Cloud, DownloadCloud, Eye, PencilLine, RefreshCw, Search, Settings, Unplug, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppTour } from '@/components/refx/app-tour-provider'
import { useUiStore } from '@/lib/stores/ui-store'
import { useT } from '@/lib/localization'
import { cn } from '@/lib/utils'
import { getRemoteVaultDisplayMessage } from '@/lib/remote-vault-copy'
import * as repo from '@/lib/repositories/local-db'
import { useRuntimeActions } from '@/lib/stores/runtime-store'
import { toast } from 'sonner'
import {
  getRemoteVaultStatusSnapshot,
  getRemoteVaultSyncPhaseSnapshot,
  getRemoteVaultSyncQueueSnapshot,
  subscribeRemoteVaultStatus,
  subscribeRemoteVaultSyncPhase,
  subscribeRemoteVaultSyncQueue,
  type RemoteVaultStatus,
  type RemoteVaultSyncPhase,
  type RemoteVaultSyncQueueState,
} from '@/lib/remote-storage-state'

function getRemoteVaultBadge(
  status: RemoteVaultStatus,
  syncPhase: RemoteVaultSyncPhase,
  syncState: RemoteVaultSyncQueueState,
  t: ReturnType<typeof useT>,
) {
  const showExplicitActivity = syncState.activeKind === 'manual' || syncState.longRunning

  if (syncState.state === 'conflict') {
    return {
      Icon: AlertTriangle,
      loading: false,
      pending: false,
      label: 'Remote vault conflict',
      tooltip: syncState.lastError ?? 'Remote vault validation failed. Refresh manually after resolving the conflict.',
      className: 'border-red-300/80 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-200',
    }
  }

  if (syncState.state === 'checking' || syncState.state === 'refreshAvailable') {
    return {
      Icon: RefreshCw,
      loading: syncState.state === 'refreshAvailable',
      pending: false,
      label: syncState.state === 'checking' ? 'Checking remote vault' : 'Remote update available',
      tooltip: syncState.state === 'checking' ? 'Checking for a newer remote revision.' : 'A newer revision is being received.',
      className: 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-200',
    }
  }

  if (showExplicitActivity && syncPhase === 'pulling') {
    return {
      Icon: DownloadCloud,
      loading: true,
      pending: false,
      label: t('topBar.remoteVaultReceiving'),
      tooltip: t('topBar.remoteVaultReceivingTooltip'),
      className: 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-200',
    }
  }

  if (showExplicitActivity && syncPhase === 'pushing') {
    return {
      Icon: UploadCloud,
      loading: true,
      pending: false,
      label: t('topBar.remoteVaultSending'),
      tooltip: t('topBar.remoteVaultSendingTooltip'),
      className: 'border-sky-300/80 bg-sky-50 text-sky-800 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-200',
    }
  }

  if (status.mode === 'remoteOfflineCache') {
    return {
      Icon: Unplug,
      loading: false,
      pending: false,
      label: t('topBar.remoteVaultOffline'),
      tooltip: getRemoteVaultDisplayMessage(t, status),
      className: 'border-red-300/80 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-200',
    }
  }

  if (status.mode === 'remoteWriter') {
    return {
      Icon: PencilLine,
      loading: false,
      pending: syncState.hasPendingSync,
      label: t('topBar.remoteVaultWriter'),
      tooltip: getRemoteVaultDisplayMessage(t, status),
      className: 'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-200',
    }
  }

  if (status.mode === 'remoteReader') {
    return {
      Icon: Eye,
      loading: false,
      pending: syncState.hasPendingSync,
      label: t('topBar.remoteVaultReadOnly'),
      tooltip: getRemoteVaultDisplayMessage(t, status),
      className: 'border-slate-300/80 bg-slate-50 text-slate-800 dark:border-slate-500/40 dark:bg-slate-900/70 dark:text-slate-200',
    }
  }

  return {
    Icon: Cloud,
    loading: false,
    pending: syncState.hasPendingSync,
    label: t('topBar.remoteVaultConnected'),
    tooltip: getRemoteVaultDisplayMessage(t, status),
    className: 'border-border bg-muted/60 text-muted-foreground',
  }
}

export function TopBar() {
  const t = useT()
  const router = useRouter()
  const {
    canStartCurrentPageTour,
    closeCurrentPageTour,
    currentPageTourUnavailableReason,
    startCurrentPageTour,
  } = useAppTour()
  const inputRef = useRef<HTMLInputElement>(null)
  const { refreshData } = useRuntimeActions()
  const [isRequestingEditing, setIsRequestingEditing] = useState(false)
  const [remoteVaultStatus, setRemoteVaultStatus] = useState(getRemoteVaultStatusSnapshot)
  const [remoteVaultSyncPhase, setRemoteVaultSyncPhase] = useState(getRemoteVaultSyncPhaseSnapshot)
  const [remoteVaultSyncState, setRemoteVaultSyncState] = useState(getRemoteVaultSyncQueueSnapshot)
  const globalSearchQuery = useUiStore((state) => state.globalSearchQuery)
  const setGlobalSearchQuery = useUiStore((state) => state.setGlobalSearchQuery)
  const setPersistentSearch = useUiStore((state) => state.setPersistentSearch)

  const submitGlobalSearch = () => {
    setPersistentSearch({ query: globalSearchQuery.trim() })
    router.push(`/search?q=${encodeURIComponent(globalSearchQuery.trim())}`)
  }

  useEffect(() => subscribeRemoteVaultStatus(setRemoteVaultStatus), [])
  useEffect(() => subscribeRemoteVaultSyncPhase(setRemoteVaultSyncPhase), [])
  useEffect(() => subscribeRemoteVaultSyncQueue(setRemoteVaultSyncState), [])

  const remoteVaultBadge = remoteVaultStatus.enabled
    ? getRemoteVaultBadge(remoteVaultStatus, remoteVaultSyncPhase, remoteVaultSyncState, t)
    : null
  const canRequestEditing = remoteVaultStatus.mode === 'remoteReader' && !remoteVaultStatus.isOffline

  const requestEditingAccess = async () => {
    if (!canRequestEditing || isRequestingEditing) return
    setIsRequestingEditing(true)
    try {
      const status = await repo.requestRemoteVaultEditing()
      await refreshData()
      if (status.mode === 'remoteWriter') {
        toast.success(t('settings.remoteVault.writerMessage'))
      } else {
        toast.info(getRemoteVaultDisplayMessage(t, status))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('settings.remoteVault.actionFailed'))
    } finally {
      setIsRequestingEditing(false)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border/80 bg-background/92 px-5 backdrop-blur">
      <div className="relative w-full max-w-xl" data-tour-id="shell-search">
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
          placeholder={t('topBar.searchPlaceholder')}
        />
      </div>

      <div className="flex items-center gap-2">
        {canRequestEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full whitespace-nowrap"
            disabled={isRequestingEditing}
            aria-busy={isRequestingEditing}
            onClick={() => { void requestEditingAccess() }}
          >
            {isRequestingEditing ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isRequestingEditing
              ? t('settings.remoteVault.requestingEditing')
              : t('settings.remoteVault.requestEditing')}
          </Button>
        ) : null}

        {remoteVaultBadge ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring/50',
                  canRequestEditing ? 'hover:scale-105 active:scale-95' : 'cursor-default',
                )}
                aria-label={canRequestEditing ? t('settings.remoteVault.requestEditing') : remoteVaultBadge.label}
                aria-busy={isRequestingEditing}
                onClick={() => { void requestEditingAccess() }}
              >
                {remoteVaultBadge.loading || isRequestingEditing ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-[-3px] rounded-full border-2 border-sky-200/70 border-t-sky-500 animate-spin dark:border-sky-900/80 dark:border-t-sky-400"
                  />
                ) : null}
                {!remoteVaultBadge.loading && !isRequestingEditing && remoteVaultBadge.pending ? (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 rounded-full border border-background bg-sky-500"
                  />
                ) : null}
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border text-base shadow-sm',
                    remoteVaultBadge.className,
                  )}
                >
                  <remoteVaultBadge.Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <div className="max-w-xs space-y-1">
                <p>{remoteVaultBadge.tooltip}</p>
                {canRequestEditing ? (
                  <p className="font-medium text-foreground">{t('settings.remoteVault.requestEditing')}</p>
                ) : null}
              </div>
            </TooltipContent>
          </Tooltip>
        ) : null}

        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full text-sm font-semibold"
                onClick={() => startCurrentPageTour()}
                aria-label={t('topBar.openPageGuide')}
                disabled={!canStartCurrentPageTour}
              >
                ?
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {canStartCurrentPageTour
              ? t('topBar.openPageGuide')
              : (currentPageTourUnavailableReason ?? t('topBar.pageGuideUnavailable'))}
          </TooltipContent>
        </Tooltip>

        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => {
            closeCurrentPageTour()
            router.push('/settings')
          }}
          aria-label={t('topBar.openSettings')}
          data-tour-id="shell-settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
