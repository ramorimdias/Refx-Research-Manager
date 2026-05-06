'use client'

import type { PointerEventHandler, RefCallback } from 'react'
import type { DbNote } from '@/lib/repositories/local-db'
import { buildDocumentCommentTitle } from '@/lib/services/document-comment-service'
import type { PdfWord, SearchOccurrence } from '@/lib/services/document-processing'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/localization'

type ReaderSidebarComment = DbNote & {
  color?: string
  areaRect?: {
    x: number
    y: number
    width: number
    height: number
  }
}

type ReaderAreaHighlight = {
  id: string
  rect: { x: number; y: number; width: number; height: number }
  color: string
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((value) => Number.isNaN(value))) return hex
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function getFloatingHintStyle(
  cursor: { x: number; y: number },
  pageSize: { width: number; height: number },
  hintWidth: number,
) {
  const halfWidth = hintWidth / 2
  const left = Math.min(
    Math.max(cursor.x * pageSize.width, halfWidth + 8),
    Math.max(halfWidth + 8, pageSize.width - halfWidth - 8),
  )
  const top = Math.max(cursor.y * pageSize.height, 28)

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${hintWidth}px`,
  }
}

type ReaderPageOverlaysProps = {
  isActivePage: boolean
  pageSize: { width: number; height: number }
  zoom: number
  renderZoom: number
  isOverlayZoomTransitioning: boolean
  isTextSelectionLayerVisible: boolean
  pageWords: PdfWord[]
  pageNotePointComments: ReaderSidebarComment[]
  pageNoteAreaComments: ReaderSidebarComment[]
  selectedCommentId: string | null
  hoveredCommentId: string | null
  defaultNoteColor: string
  selectedNoteColor: { note: string }
  nextCommentNumber: number
  draftCommentNumber: number
  isNoteDeleteMode: boolean
  isSelectingCommentPosition: boolean
  draftNotePreview: {
    position: { x: number; y: number }
    areaRect: { x: number; y: number; width: number; height: number } | null
    commentNumber: number
  } | null
  commentDraftAreaRect: { x: number; y: number; width: number; height: number } | null
  notePlacementCursor: { x: number; y: number } | null
  isNotePlacementDragging: boolean
  onSelectComment: (commentId: string) => void
  onHoveredCommentChange: (commentId: string | null) => void
  onDisableNoteDeleteMode: () => void
  onNotePlacementPointerDown?: PointerEventHandler<HTMLDivElement>
  onNotePlacementPointerMove?: PointerEventHandler<HTMLDivElement>
  onNotePlacementPointerUp?: PointerEventHandler<HTMLDivElement>
  onCancelNotePlacementPointer: () => void
  pageHighlights: SearchOccurrence[]
  activeOccurrenceGroupIndexes: Set<number>
  activeOccurrenceIndex: number
  activeOccurrenceHighlightRef: RefCallback<HTMLDivElement>
  pageAreaHighlights: ReaderAreaHighlight[]
  isHighlightMode: boolean
  isHighlightDeleteMode: boolean
  highlightPlacementCursor: { x: number; y: number } | null
  isHighlightPlacementDragging: boolean
  draftHighlightRect: { x: number; y: number; width: number; height: number } | null
  selectedHighlightColor: { highlight: string }
  onHighlightPointerDown?: PointerEventHandler<HTMLDivElement>
  onHighlightPointerMove?: PointerEventHandler<HTMLDivElement>
  onHighlightPointerUp?: PointerEventHandler<HTMLDivElement>
  onCancelHighlightPointer: () => void
  onDeleteAreaHighlight: (highlightId: string) => void
  onDisableHighlightDeleteMode: () => void
}

export function ReaderPageOverlays({
  isActivePage,
  pageSize,
  zoom,
  renderZoom,
  isOverlayZoomTransitioning,
  isTextSelectionLayerVisible,
  pageWords,
  pageNotePointComments,
  pageNoteAreaComments,
  selectedCommentId,
  hoveredCommentId,
  defaultNoteColor,
  selectedNoteColor,
  nextCommentNumber,
  draftCommentNumber,
  isNoteDeleteMode,
  isSelectingCommentPosition,
  draftNotePreview,
  commentDraftAreaRect,
  notePlacementCursor,
  isNotePlacementDragging,
  onSelectComment,
  onHoveredCommentChange,
  onDisableNoteDeleteMode,
  onNotePlacementPointerDown,
  onNotePlacementPointerMove,
  onNotePlacementPointerUp,
  onCancelNotePlacementPointer,
  pageHighlights,
  activeOccurrenceGroupIndexes,
  activeOccurrenceIndex,
  activeOccurrenceHighlightRef,
  pageAreaHighlights,
  isHighlightMode,
  isHighlightDeleteMode,
  highlightPlacementCursor,
  isHighlightPlacementDragging,
  draftHighlightRect,
  selectedHighlightColor,
  onHighlightPointerDown,
  onHighlightPointerMove,
  onHighlightPointerUp,
  onCancelHighlightPointer,
  onDeleteAreaHighlight,
  onDisableHighlightDeleteMode,
}: ReaderPageOverlaysProps) {
  const t = useT()

  return (
    <div
      className={cn(
        'absolute inset-0 transition-opacity duration-200',
        isOverlayZoomTransitioning ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      {isActivePage && isTextSelectionLayerVisible ? (
        <div className="absolute inset-0 z-30 overflow-hidden select-text cursor-text">
          {pageWords.map((word, wordIndex) => (
            <span
              key={`${wordIndex}-${word.left}-${word.top}`}
              className="absolute cursor-text select-text whitespace-pre"
              style={{
                left: `${word.left * (renderZoom / 100)}px`,
                top: `${word.top * (renderZoom / 100)}px`,
                width: `${Math.max(6, word.width * (renderZoom / 100))}px`,
                height: `${Math.max(10, word.height * (renderZoom / 100))}px`,
                fontSize: `${Math.max(10, word.height * (renderZoom / 100) * 0.85)}px`,
                lineHeight: `${Math.max(10, word.height * (renderZoom / 100))}px`,
                color: 'rgba(0, 0, 0, 0.01)',
                userSelect: 'text',
                WebkitUserSelect: 'text',
              }}
            >
              {word.trailingSpace ? `${word.text} ` : word.text}
            </span>
          ))}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {pageNotePointComments.map((comment) => {
          const isActive = comment.id === selectedCommentId
          const isHovered = comment.id === hoveredCommentId
          const noteColor = comment.color ?? defaultNoteColor

          return (
            <button
              key={comment.id}
              type="button"
              onMouseEnter={() => onHoveredCommentChange(comment.id)}
              onMouseLeave={() => onHoveredCommentChange(null)}
              onClick={(event) => {
                event.stopPropagation()
                onSelectComment(comment.id)
              }}
              onContextMenu={(event) => {
                if (!isNoteDeleteMode) return
                event.preventDefault()
                event.stopPropagation()
                onDisableNoteDeleteMode()
              }}
              className={cn(
                'pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white text-xs font-semibold text-white shadow-lg transition hover:scale-105',
                isActive && 'z-20 ring-2 ring-foreground/20',
                isHovered && 'z-30 scale-110 ring-4 ring-primary/30 shadow-[0_0_0_6px_rgba(59,130,246,0.14)]',
              )}
              style={{
                left: `${(comment.positionX ?? 0) * pageSize.width}px`,
                top: `${(comment.positionY ?? 0) * pageSize.height}px`,
                backgroundColor: noteColor,
              }}
              aria-label={`Select ${buildDocumentCommentTitle(comment.commentNumber ?? nextCommentNumber)}`}
              title={isNoteDeleteMode ? 'Click to delete' : buildDocumentCommentTitle(comment.commentNumber ?? nextCommentNumber)}
            >
              {comment.commentNumber}
              <span
                className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-white"
                style={{ backgroundColor: noteColor }}
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>
      <div className="pointer-events-none absolute inset-0 z-10 overflow-visible">
        {pageNoteAreaComments.map((comment) => {
          const isActive = comment.id === selectedCommentId
          const isHovered = comment.id === hoveredCommentId
          if (!comment.areaRect) return null
          const noteColor = comment.color ?? defaultNoteColor

          return (
            <button
              key={comment.id}
              type="button"
              onMouseEnter={() => onHoveredCommentChange(comment.id)}
              onMouseLeave={() => onHoveredCommentChange(null)}
              onClick={(event) => {
                event.stopPropagation()
                onSelectComment(comment.id)
              }}
              onContextMenu={(event) => {
                if (!isNoteDeleteMode) return
                event.preventDefault()
                event.stopPropagation()
                onDisableNoteDeleteMode()
              }}
              className={cn(
                'pointer-events-auto absolute rounded-sm transition',
                isActive && 'ring-2 ring-foreground/20',
                isHovered && 'z-30 ring-4 ring-primary/35 shadow-[0_0_0_6px_rgba(59,130,246,0.12)]',
              )}
              style={{
                left: `${comment.areaRect.x * pageSize.width}px`,
                top: `${comment.areaRect.y * pageSize.height}px`,
                width: `${comment.areaRect.width * pageSize.width}px`,
                height: `${comment.areaRect.height * pageSize.height}px`,
                backgroundColor: hexToRgba(noteColor, isHovered ? 0.34 : isActive ? 0.34 : 0.26),
              }}
              aria-label={`Select ${buildDocumentCommentTitle(comment.commentNumber ?? nextCommentNumber)}`}
              title={isNoteDeleteMode ? 'Click to delete' : buildDocumentCommentTitle(comment.commentNumber ?? nextCommentNumber)}
            >
              <span
                className="absolute left-0 top-0 flex h-6 min-w-6 -translate-x-[calc(100%+0.375rem)] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white shadow-sm"
                style={{ backgroundColor: noteColor }}
              >
                {comment.commentNumber}
              </span>
            </button>
          )
        })}
        {isActivePage && draftNotePreview?.areaRect && !isSelectingCommentPosition ? (
          <div
            className="pointer-events-none absolute rounded-sm ring-2 ring-dashed"
            style={{
              left: `${draftNotePreview.areaRect.x * pageSize.width}px`,
              top: `${draftNotePreview.areaRect.y * pageSize.height}px`,
              width: `${draftNotePreview.areaRect.width * pageSize.width}px`,
              height: `${draftNotePreview.areaRect.height * pageSize.height}px`,
              backgroundColor: hexToRgba(selectedNoteColor.note, 0.3),
              borderColor: hexToRgba(selectedNoteColor.note, 0.55),
            }}
          >
            <span
              className="absolute left-0 top-0 flex h-6 min-w-6 -translate-x-[calc(100%+0.375rem)] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: selectedNoteColor.note }}
            >
              {draftNotePreview.commentNumber}
            </span>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-0">
        {pageHighlights.flatMap((occurrence) =>
          (occurrence.rects ?? []).map((rect, rectIndex) => {
            const isActive = activeOccurrenceGroupIndexes.has(occurrence.index)
            return (
              <div
                key={`${occurrence.index}-${rectIndex}`}
                ref={isActive && occurrence.index === activeOccurrenceIndex && rectIndex === 0 ? activeOccurrenceHighlightRef : null}
                className={`absolute mix-blend-multiply ${
                  isActive ? 'bg-amber-300/52' : 'bg-sky-300/28'
                }`}
                style={{
                  left: `${rect.left * (zoom / 100)}px`,
                  top: `${rect.top * (zoom / 100)}px`,
                  width: `${rect.width * (zoom / 100)}px`,
                  height: `${Math.max(10, rect.height * (zoom / 100))}px`,
                }}
              />
            )
          }),
        )}
      </div>
      {isActivePage && draftNotePreview?.position && !draftNotePreview.areaRect && !isSelectingCommentPosition ? (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
          <div
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border border-white text-xs font-semibold text-white shadow-lg opacity-85"
            style={{
              left: `${draftNotePreview.position.x * pageSize.width}px`,
              top: `${draftNotePreview.position.y * pageSize.height}px`,
              backgroundColor: selectedNoteColor.note,
            }}
          >
            {draftNotePreview.commentNumber}
            <span
              className="absolute left-1/2 top-full h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-white"
              style={{ backgroundColor: selectedNoteColor.note }}
              aria-hidden="true"
            />
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          'absolute inset-0 z-20',
          isActivePage && isSelectingCommentPosition ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        onPointerDown={isActivePage ? onNotePlacementPointerDown : undefined}
        onPointerMove={isActivePage ? onNotePlacementPointerMove : undefined}
        onPointerUp={isActivePage ? onNotePlacementPointerUp : undefined}
        onPointerCancel={() => {
          if (!isActivePage) return
          onCancelNotePlacementPointer()
        }}
        onPointerLeave={() => {
          if (!isActivePage || isNotePlacementDragging) return
          onCancelNotePlacementPointer()
        }}
      >
        {isActivePage && isSelectingCommentPosition && notePlacementCursor && !isNotePlacementDragging ? (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] rounded-full border border-primary/25 bg-background/75 px-3 py-1.5 text-center text-xs font-medium leading-tight text-foreground/85 shadow-md"
            style={getFloatingHintStyle(notePlacementCursor, pageSize, 280)}
          >
            {t('readerView.clickOrDrawNote')}
          </div>
        ) : null}
        {isActivePage && isSelectingCommentPosition && commentDraftAreaRect ? (
          <div
            className="pointer-events-none absolute rounded-sm"
            style={{
              left: `${commentDraftAreaRect.x * pageSize.width}px`,
              top: `${commentDraftAreaRect.y * pageSize.height}px`,
              width: `${commentDraftAreaRect.width * pageSize.width}px`,
              height: `${commentDraftAreaRect.height * pageSize.height}px`,
              backgroundColor: hexToRgba(selectedNoteColor.note, 0.26),
            }}
          >
            <span
              className="absolute left-0 top-0 flex h-6 min-w-6 -translate-x-[calc(100%+0.375rem)] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white shadow-sm"
              style={{ backgroundColor: selectedNoteColor.note }}
            >
              {draftCommentNumber}
            </span>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          'absolute inset-0 z-20',
          isActivePage && isHighlightMode ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        onPointerDown={isActivePage ? onHighlightPointerDown : undefined}
        onPointerMove={isActivePage ? onHighlightPointerMove : undefined}
        onPointerUp={isActivePage ? onHighlightPointerUp : undefined}
        onPointerCancel={() => {
          if (!isActivePage) return
          onCancelHighlightPointer()
        }}
        onPointerLeave={() => {
          if (!isActivePage || isHighlightPlacementDragging) return
          onCancelHighlightPointer()
        }}
      >
        {isActivePage && isHighlightMode && highlightPlacementCursor && !isHighlightPlacementDragging ? (
          <div
            className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+0.75rem)] rounded-full border border-primary/25 bg-background/75 px-3 py-1.5 text-center text-xs font-medium leading-tight text-foreground/85 shadow-md"
            style={getFloatingHintStyle(highlightPlacementCursor, pageSize, 220)}
          >
            {t('readerView.drawHighlight')}
          </div>
        ) : null}
        {pageAreaHighlights.map((highlight) => (
          <button
            key={highlight.id}
            type="button"
            className="pointer-events-auto absolute rounded-sm mix-blend-multiply transition"
            style={{
              left: `${highlight.rect.x * pageSize.width}px`,
              top: `${highlight.rect.y * pageSize.height}px`,
              width: `${highlight.rect.width * pageSize.width}px`,
              height: `${highlight.rect.height * pageSize.height}px`,
              backgroundColor: hexToRgba(highlight.color, 0.24),
            }}
            onClick={(event) => {
              if (!isHighlightDeleteMode) return
              event.preventDefault()
              event.stopPropagation()
              onDeleteAreaHighlight(highlight.id)
            }}
            onContextMenu={(event) => {
              if (!isHighlightDeleteMode) return
              event.preventDefault()
              event.stopPropagation()
              onDisableHighlightDeleteMode()
            }}
            title={isHighlightDeleteMode ? 'Click to delete' : 'Highlight'}
          />
        ))}
        {isActivePage && draftHighlightRect ? (
          <div
            className="pointer-events-none absolute rounded-sm mix-blend-multiply"
            style={{
              left: `${draftHighlightRect.x * pageSize.width}px`,
              top: `${draftHighlightRect.y * pageSize.height}px`,
              width: `${draftHighlightRect.width * pageSize.width}px`,
              height: `${draftHighlightRect.height * pageSize.height}px`,
              backgroundColor: hexToRgba(selectedHighlightColor.highlight, 0.26),
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
