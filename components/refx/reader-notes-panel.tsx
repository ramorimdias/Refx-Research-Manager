'use client'

import type { RefObject } from 'react'
import { ChevronLeft, ChevronRight, MapPin, StickyNote, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useT } from '@/lib/localization'
import { buildDocumentCommentTitle } from '@/lib/services/document-comment-service'
import type { DbNote } from '@/lib/repositories/local-db'
import { cn } from '@/lib/utils'

type ReaderSidebarComment = DbNote & {
  color?: string
  areaRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

type ReaderNotesPanelProps = {
  canUsePreciseViewer: boolean
  isSelectingCommentPosition: boolean
  isNoteEditorOpen: boolean
  isDesktopApp: boolean
  isSavingComment: boolean
  commentDraftPosition: { x: number; y: number } | null
  commentDraftContent: string
  onCommentDraftContentChange: (value: string) => void
  noteEditorTextareaRef: RefObject<HTMLTextAreaElement | null>
  currentPageComments: ReaderSidebarComment[]
  documentCommentsLength: number
  selectedComment: ReaderSidebarComment | null
  selectedCommentId: string | null
  hoveredCommentId: string | null
  nextCommentNumber: number
  onStartNewComment: () => void
  onCancelCommentEditor: () => void
  onStartChoosingPosition: () => void
  onSaveComment: () => void
  onStepComment: (direction: 'prev' | 'next') => void
  onSelectComment: (commentId: string) => void
  onOpenCommentEditor: () => void
  onRequestDeleteComment: () => void
  setCommentCardRef: (commentId: string, element: HTMLDivElement | null) => void
  onHoveredCommentChange: (commentId: string | null) => void
}

export function ReaderNotesPanel({
  canUsePreciseViewer,
  isSelectingCommentPosition,
  isNoteEditorOpen,
  isDesktopApp,
  isSavingComment,
  commentDraftPosition,
  commentDraftContent,
  onCommentDraftContentChange,
  noteEditorTextareaRef,
  currentPageComments,
  documentCommentsLength,
  selectedComment,
  selectedCommentId,
  hoveredCommentId,
  nextCommentNumber,
  onStartNewComment,
  onCancelCommentEditor,
  onStartChoosingPosition,
  onSaveComment,
  onStepComment,
  onSelectComment,
  onOpenCommentEditor,
  onRequestDeleteComment,
  setCommentCardRef,
  onHoveredCommentChange,
}: ReaderNotesPanelProps) {
  const t = useT()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <StickyNote className="h-4 w-4" />
          {t('readerView.notes')}
        </div>
        {isSelectingCommentPosition ? (
          <Button variant="outline" size="sm" onClick={onCancelCommentEditor}>
            {t('readerView.cancel')}
          </Button>
        ) : !isNoteEditorOpen ? (
          <Button size="sm" onClick={onStartNewComment} disabled={!canUsePreciseViewer}>
            {t('readerView.newNote')}
          </Button>
        ) : null}
      </div>

      {isNoteEditorOpen ? (
        <div className="rounded-lg border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {selectedComment
                    ? buildDocumentCommentTitle(selectedComment.commentNumber ?? nextCommentNumber)
                    : buildDocumentCommentTitle(nextCommentNumber)}
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartChoosingPosition}
              disabled={!canUsePreciseViewer}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {commentDraftPosition ? t('readerView.moveBalloon') : t('readerView.choosePosition')}
            </Button>
          </div>
          <Textarea
            ref={noteEditorTextareaRef}
            value={commentDraftContent}
            onChange={(event) => onCommentDraftContentChange(event.target.value)}
            placeholder={t('readerView.writeNote')}
            className="mt-3 min-h-32"
          />
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelCommentEditor}>
              {t('readerView.cancel')}
            </Button>
            <Button
              size="sm"
              onClick={onSaveComment}
              disabled={!isDesktopApp || !commentDraftContent.trim() || !commentDraftPosition || isSavingComment}
            >
              {isSavingComment
                ? t('readerView.saving')
                : selectedComment
                  ? t('readerView.saveNote')
                  : t('readerView.createNote')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{t('readerView.notesOnPage', { count: currentPageComments.length, suffix: currentPageComments.length === 1 ? '' : 's' })}</span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => onStepComment('prev')}
              disabled={documentCommentsLength === 0}
              aria-label="Previous note"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => onStepComment('next')}
              disabled={documentCommentsLength === 0}
              aria-label="Next note"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {currentPageComments.length > 0 ? (
          <div className="space-y-2">
            {currentPageComments.map((comment) => {
              const isActive = comment.id === selectedCommentId
              const isHovered = comment.id === hoveredCommentId

              return (
                <div
                  key={comment.id}
                  ref={(element) => {
                    setCommentCardRef(comment.id, element)
                  }}
                  onMouseEnter={() => onHoveredCommentChange(comment.id)}
                  onMouseLeave={() => onHoveredCommentChange(null)}
                  className={cn(
                    'rounded-md border p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/[0.04] hover:shadow-sm',
                    isActive ? 'border-primary bg-primary/5' : 'border-border bg-muted/30',
                    isHovered && 'border-primary/50 bg-primary/[0.06] shadow-sm ring-1 ring-primary/15',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectComment(comment.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={isActive ? 'default' : 'secondary'}>
                          {buildDocumentCommentTitle(comment.commentNumber ?? nextCommentNumber)}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(comment.updatedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 text-sm leading-6 text-foreground">
                      {comment.content || t('readerView.noNoteText')}
                    </div>
                  </button>
                  {isActive ? (
                    <div className="mt-3 flex items-center justify-end gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" onClick={onOpenCommentEditor}>
                        {t('readerView.edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={onRequestDeleteComment}
                        disabled={!isDesktopApp || isSavingComment}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('readerView.delete')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            {t('readerView.noNotesPage')}
          </div>
        )}
      </div>
    </div>
  )
}
