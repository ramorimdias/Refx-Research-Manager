'use client'

import { Loader2, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/localization'
import type { GraphView } from '@/lib/types'

type GraphViewDraft = {
  name: string
  description: string
}

const DEFAULT_GRAPH_VIEW_DRAFT: GraphViewDraft = {
  name: '',
  description: '',
}

type MapsManagementDialogsProps = {
  isCreateMapDialogOpen: boolean
  onCreateMapDialogOpenChange: (open: boolean) => void
  isSaveViewDialogOpen: boolean
  onSaveViewDialogOpenChange: (open: boolean) => void
  isEditingViewDialogOpen: boolean
  onEditingViewDialogOpenChange: (open: boolean) => void
  isDeleteWorkspaceDialogOpen: boolean
  onDeleteWorkspaceDialogOpenChange: (open: boolean) => void
  graphViewDraft: GraphViewDraft
  onGraphViewDraftChange: (updater: (current: GraphViewDraft) => GraphViewDraft) => void
  onResetGraphViewDraft: () => void
  onCreateMap: () => void
  onSaveCurrentView: () => void
  onUpdateGraphViewMeta: () => void
  pendingDeleteRelationId: string | null
  onPendingDeleteRelationIdChange: (value: string | null) => void
  onDeleteRelationWithoutPrompt: (relationId: string) => void
  isDeletingRelation: boolean
  pendingDeleteAllLinksDocumentId: string | null
  onPendingDeleteAllLinksDocumentIdChange: (value: string | null) => void
  pendingDeleteAllLinksCount: number
  onDeleteAllLinksForDocument: (documentId: string) => void
  activeGraphView: GraphView | null
  onDeleteActiveGraphView: () => void
}

export function MapsManagementDialogs({
  isCreateMapDialogOpen,
  onCreateMapDialogOpenChange,
  isSaveViewDialogOpen,
  onSaveViewDialogOpenChange,
  isEditingViewDialogOpen,
  onEditingViewDialogOpenChange,
  isDeleteWorkspaceDialogOpen,
  onDeleteWorkspaceDialogOpenChange,
  graphViewDraft,
  onGraphViewDraftChange,
  onResetGraphViewDraft,
  onCreateMap,
  onSaveCurrentView,
  onUpdateGraphViewMeta,
  pendingDeleteRelationId,
  onPendingDeleteRelationIdChange,
  onDeleteRelationWithoutPrompt,
  isDeletingRelation,
  pendingDeleteAllLinksDocumentId,
  onPendingDeleteAllLinksDocumentIdChange,
  pendingDeleteAllLinksCount,
  onDeleteAllLinksForDocument,
  activeGraphView,
  onDeleteActiveGraphView,
}: MapsManagementDialogsProps) {
  const t = useT()

  return (
    <>
      <Dialog
        open={isCreateMapDialogOpen}
        onOpenChange={(open) => {
          onCreateMapDialogOpenChange(open)
          if (!open) {
            onResetGraphViewDraft()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.newMap')}</DialogTitle>
            <DialogDescription>
              Create a named map from the current view without clearing the existing one.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="create-graph-view-name">{t('mapsPage.name')}</Label>
              <Input
                id="create-graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('mapsPage.newMap')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-graph-view-description">{t('mapsPage.workspaceNote')}</Label>
              <Textarea
                id="create-graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, description: event.target.value }))}
                placeholder={t('mapsPage.workspaceNotePlaceholder')}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onCreateMapDialogOpenChange(false)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={onCreateMap}>
              {t('mapsPage.newMap')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSaveViewDialogOpen} onOpenChange={onSaveViewDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.saveGraphView')}</DialogTitle>
            <DialogDescription>
              {t('mapsPage.saveGraphViewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="graph-view-name">{t('mapsPage.name')}</Label>
              <Input
                id="graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, name: event.target.value }))}
                placeholder={t('mapsPage.saveGraphView')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="graph-view-description">{t('mapsPage.workspaceNote')}</Label>
              <Textarea
                id="graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, description: event.target.value }))}
                placeholder={t('mapsPage.workspaceNotePlaceholder')}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onSaveViewDialogOpenChange(false)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={onSaveCurrentView}>
              {t('mapsPage.saveView')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditingViewDialogOpen} onOpenChange={onEditingViewDialogOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.editGraphView')}</DialogTitle>
            <DialogDescription>
              {t('mapsPage.editGraphViewDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-name">{t('mapsPage.name')}</Label>
              <Input
                id="edit-graph-view-name"
                value={graphViewDraft.name}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-graph-view-description">{t('mapsPage.workspaceNote')}</Label>
              <Textarea
                id="edit-graph-view-description"
                value={graphViewDraft.description}
                onChange={(event) => onGraphViewDraftChange((current) => ({ ...current, description: event.target.value }))}
                className="min-h-24"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onEditingViewDialogOpenChange(false)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button onClick={onUpdateGraphViewMeta}>
              {t('mapsPage.saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDeleteRelationId)}
        onOpenChange={(open) => {
          if (!open) {
            onPendingDeleteRelationIdChange(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('mapsPage.breakLink')}</DialogTitle>
            <DialogDescription>
              This will remove permanently the relationship between those two documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onPendingDeleteRelationIdChange(null)}>
              {t('mapsPage.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteRelationId) return
                onDeleteRelationWithoutPrompt(pendingDeleteRelationId)
                onPendingDeleteRelationIdChange(null)
              }}
              disabled={isDeletingRelation}
            >
              {isDeletingRelation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t('mapsPage.breakLink')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDeleteAllLinksDocumentId)}
        onOpenChange={(open) => {
          if (!open) {
            onPendingDeleteAllLinksDocumentIdChange(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mapsPage.deleteAllLinks')}</AlertDialogTitle>
            <AlertDialogDescription>
              {`Delete ${pendingDeleteAllLinksCount} link(s) connected to this node?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingRelation}>{t('mapsPage.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingRelation}
              onClick={() => {
                if (!pendingDeleteAllLinksDocumentId) return
                onDeleteAllLinksForDocument(pendingDeleteAllLinksDocumentId)
              }}
            >
              {isDeletingRelation ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t('mapsPage.deleteAllLinks')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteWorkspaceDialogOpen} onOpenChange={onDeleteWorkspaceDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mapsPage.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {activeGraphView ? `Delete workspace "${activeGraphView.name}"?` : 'Delete this workspace?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('mapsPage.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteActiveGraphView}>
              {t('mapsPage.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { DEFAULT_GRAPH_VIEW_DRAFT }
