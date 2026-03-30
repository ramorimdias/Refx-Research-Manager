'use client'

import { Download, Loader2, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { AppUpdateSummary } from '@/lib/services/app-update-service'
import { useLocale, useT } from '@/lib/localization'

type AppUpdateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  update: AppUpdateSummary | null
  isInstalling: boolean
  installStatus: string | null
  onInstall: () => void
}

export function AppUpdateDialog({
  open,
  onOpenChange,
  update,
  isInstalling,
  installStatus,
  onInstall,
}: AppUpdateDialogProps) {
  const t = useT()
  const { locale } = useLocale()
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!isInstalling ? onOpenChange(nextOpen) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('updateDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {update
              ? t('updateDialog.descriptionVersion', { version: update.version })
              : t('updateDialog.descriptionFallback')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {update?.publishedAt ? (
            <p className="text-sm text-muted-foreground">{t('updateDialog.published', { value: new Date(update.publishedAt).toLocaleString(locale) })}</p>
          ) : null}

          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t('updateDialog.releaseNotes')}</p>
            <div className="max-h-56 overflow-auto whitespace-pre-wrap text-sm text-foreground">
              {update?.notes || t('updateDialog.noNotes')}
            </div>
          </div>

          {installStatus ? (
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm text-muted-foreground">
              {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {installStatus}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isInstalling}>
            {t('updateDialog.later')}
          </Button>
          <Button onClick={onInstall} disabled={isInstalling || !update}>
            {isInstalling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isInstalling ? t('updateDialog.installing') : t('updateDialog.downloadInstall')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
