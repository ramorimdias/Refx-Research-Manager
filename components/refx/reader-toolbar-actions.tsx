'use client'

import { FilePenLine, Highlighter, Loader2, Printer, SquareArrowOutUpRight, StickyNote, Type, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ReaderToolbarIconButton } from '@/components/refx/reader-toolbar-icon-button'
import { cn } from '@/lib/utils'

const READER_COLOR_OPTIONS = [
  { id: 'yellow', highlight: '#fde047', note: '#f59e0b' },
  { id: 'blue', highlight: '#7dd3fc', note: '#0ea5e9' },
  { id: 'red', highlight: '#fda4af', note: '#ef4444' },
  { id: 'green', highlight: '#86efac', note: '#22c55e' },
  { id: 'purple', highlight: '#d8b4fe', note: '#a855f7' },
] as const

type ReaderColorId = (typeof READER_COLOR_OPTIONS)[number]['id']

function ReaderColorPalette({
  selectedColorId,
  onSelect,
  type,
  isDeleteMode = false,
  onToggleDeleteMode,
}: {
  selectedColorId: ReaderColorId
  onSelect: (colorId: ReaderColorId) => void
  type: 'highlight' | 'note'
  isDeleteMode?: boolean
  onToggleDeleteMode?: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/95 px-2 py-1 shadow-sm">
      {READER_COLOR_OPTIONS.map((option) => {
        const swatchColor = type === 'highlight' ? option.highlight : option.note
        const isSelected = option.id === selectedColorId
        return (
          <button
            key={`${type}-${option.id}`}
            type="button"
            aria-label={`${type} color ${option.id}`}
            onClick={() => onSelect(option.id)}
            className={cn(
              'h-5 w-5 rounded-full border transition-transform hover:scale-105',
              isSelected ? 'border-foreground/70 ring-2 ring-foreground/15' : 'border-border/70',
            )}
            style={{ backgroundColor: swatchColor }}
          />
        )
      })}
      {onToggleDeleteMode ? (
        <button
          type="button"
          aria-label={`delete ${type}s`}
          onClick={onToggleDeleteMode}
          className={cn(
            'ml-1 flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-105',
            isDeleteMode
              ? 'border-red-500 bg-red-500 text-white ring-2 ring-red-500/20'
              : 'border-border/70 bg-background text-red-600',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}

function ReaderToolbarColorIndicator({
  color,
  label,
  showDeleteMark = false,
}: {
  color: string
  label: string
  showDeleteMark?: boolean
}) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-label={label}>
      {showDeleteMark ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_0_1px_rgba(15,23,42,0.2)]">
          <X className="h-3 w-3" />
        </span>
      ) : (
        <span
          className="h-4 w-4 rounded-full border border-background shadow-[0_0_0_1px_rgba(15,23,42,0.2)]"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  )
}

type ReaderToolbarActionsProps = {
  canUsePreciseViewer: boolean
  viewerMode: 'pdfjs' | 'native' | 'unavailable'
  isHighlightPickerOpen: boolean
  onHighlightPickerOpenChange: (open: boolean) => void
  isHighlightMode: boolean
  isHighlightDeleteMode: boolean
  selectedHighlightColorId: ReaderColorId
  selectedHighlightColor: { highlight: string }
  activateHighlightPlacementMode: (colorId?: ReaderColorId) => void
  deactivateTextSelectionMode: () => void
  exitNoteMode: () => void
  setIsHighlightMode: (value: boolean) => void
  setIsHighlightDeleteMode: (value: boolean) => void
  exitHighlightMode: () => void
  isNotePickerOpen: boolean
  onNotePickerOpenChange: (open: boolean) => void
  isSelectingCommentPosition: boolean
  isNoteDeleteMode: boolean
  isNoteEditorOpen: boolean
  selectedNoteColorId: ReaderColorId
  selectedNoteColor: { note: string }
  activateNotePlacementMode: (colorId?: ReaderColorId) => void
  setSelectedCommentId: (value: string | null) => void
  setCommentDraftPosition: (value: { x: number; y: number } | null) => void
  setIsNoteDeleteMode: (value: boolean) => void
  handleCancelCommentEditor: () => void
  isTextSelectionLayerVisible: boolean
  setIsTextSelectionMode: (value: boolean) => void
  activeFilePath: string | null
  isPrintOptionsOpen: boolean
  onPrintOptionsOpenChange: (open: boolean) => void
  isDesktopApp: boolean
  isPrinting: boolean
  onPrintDocument: (mode: 'original' | 'highlights' | 'highlights-notes') => void
  onDetachReaderWindow: () => void
  onOpenDetails: () => void
  onRunOcr: () => void
  isRunningOcr: boolean
  ocrStatus: string | null | undefined
  hasNativeTextLayer: boolean | undefined
  hasOcrText: boolean | null | undefined
}

export function ReaderToolbarActions({
  canUsePreciseViewer,
  viewerMode,
  isHighlightPickerOpen,
  onHighlightPickerOpenChange,
  isHighlightMode,
  isHighlightDeleteMode,
  selectedHighlightColorId,
  selectedHighlightColor,
  activateHighlightPlacementMode,
  deactivateTextSelectionMode,
  exitNoteMode,
  setIsHighlightMode,
  setIsHighlightDeleteMode,
  exitHighlightMode,
  isNotePickerOpen,
  onNotePickerOpenChange,
  isSelectingCommentPosition,
  isNoteDeleteMode,
  isNoteEditorOpen,
  selectedNoteColorId,
  selectedNoteColor,
  activateNotePlacementMode,
  setSelectedCommentId,
  setCommentDraftPosition,
  setIsNoteDeleteMode,
  handleCancelCommentEditor,
  isTextSelectionLayerVisible,
  setIsTextSelectionMode,
  activeFilePath,
  isPrintOptionsOpen,
  onPrintOptionsOpenChange,
  isDesktopApp,
  isPrinting,
  onPrintDocument,
  onDetachReaderWindow,
  onOpenDetails,
  onRunOcr,
  isRunningOcr,
  ocrStatus,
  hasNativeTextLayer,
  hasOcrText,
}: ReaderToolbarActionsProps) {
  return (
    <>
      <div className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />
      <Popover open={isHighlightPickerOpen} onOpenChange={onHighlightPickerOpenChange}>
        <PopoverTrigger asChild>
          <ReaderToolbarIconButton
            label="Highlight colors"
            disabled={!canUsePreciseViewer}
            aria-pressed={isHighlightMode || isHighlightDeleteMode}
            className={cn((isHighlightMode || isHighlightDeleteMode) && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary')}
            data-tour-id="reader-highlight"
            onClick={() => {
              if (!isHighlightMode || isHighlightDeleteMode) {
                activateHighlightPlacementMode()
              }
            }}
          >
            {isHighlightMode || isHighlightDeleteMode ? (
              <ReaderToolbarColorIndicator
                color={selectedHighlightColor.highlight}
                label="Active highlight color"
                showDeleteMark={isHighlightDeleteMode}
              />
            ) : (
              <Highlighter className="h-4 w-4" />
            )}
          </ReaderToolbarIconButton>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={10} className="w-64 rounded-2xl border-border/80 bg-background/98 p-2 shadow-xl">
          <div className="px-2 pb-2 pt-1">
            <div className="text-sm font-medium text-foreground">Highlight colors</div>
            <div className="text-xs text-muted-foreground">Choose a highlight color and mode.</div>
          </div>
          <div className="px-2 pb-2">
            <ReaderColorPalette
              selectedColorId={selectedHighlightColorId}
              onSelect={(colorId) => {
                activateHighlightPlacementMode(colorId)
                onHighlightPickerOpenChange(false)
              }}
              type="highlight"
              isDeleteMode={isHighlightDeleteMode}
              onToggleDeleteMode={() => {
                deactivateTextSelectionMode()
                exitNoteMode()
                setIsHighlightDeleteMode(true)
                setIsHighlightMode(true)
                onHighlightPickerOpenChange(false)
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl px-3"
              onClick={() => {
                exitHighlightMode()
                onHighlightPickerOpenChange(false)
              }}
              disabled={!isHighlightMode && !isHighlightDeleteMode}
            >
              Exit highlight mode
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <Popover open={isNotePickerOpen} onOpenChange={onNotePickerOpenChange}>
        <PopoverTrigger asChild>
          <ReaderToolbarIconButton
            label="Note colors"
            disabled={!canUsePreciseViewer}
            aria-pressed={isSelectingCommentPosition || isNoteDeleteMode}
            className={cn((isSelectingCommentPosition || isNoteDeleteMode) && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary')}
            data-tour-id="reader-notes"
            onClick={() => {
              if (isNoteDeleteMode || (!isSelectingCommentPosition && !isNoteEditorOpen)) {
                activateNotePlacementMode()
              }
            }}
          >
            {isSelectingCommentPosition || isNoteDeleteMode ? (
              <ReaderToolbarColorIndicator
                color={selectedNoteColor.note}
                label="Active note color"
                showDeleteMark={isNoteDeleteMode}
              />
            ) : (
              <StickyNote className="h-4 w-4" />
            )}
          </ReaderToolbarIconButton>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={10} className="w-64 rounded-2xl border-border/80 bg-background/98 p-2 shadow-xl">
          <div className="px-2 pb-2 pt-1">
            <div className="text-sm font-medium text-foreground">Note colors</div>
            <div className="text-xs text-muted-foreground">Choose a note color and start placing it.</div>
          </div>
          <div className="px-2 pb-2">
            <ReaderColorPalette
              selectedColorId={selectedNoteColorId}
              onSelect={(colorId) => {
                activateNotePlacementMode(colorId)
                onNotePickerOpenChange(false)
              }}
              type="note"
              isDeleteMode={isNoteDeleteMode}
              onToggleDeleteMode={() => {
                deactivateTextSelectionMode()
                exitHighlightMode()
                exitNoteMode()
                setSelectedCommentId(null)
                setCommentDraftPosition(null)
                setIsNoteDeleteMode(true)
                onNotePickerOpenChange(false)
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-2 px-2 pb-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl px-3"
              onClick={() => {
                if (isSelectingCommentPosition || isNoteDeleteMode) {
                  handleCancelCommentEditor()
                }
                onNotePickerOpenChange(false)
              }}
              disabled={!isSelectingCommentPosition && !isNoteDeleteMode}
            >
              Cancel note mode
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ReaderToolbarIconButton
        label={isTextSelectionLayerVisible ? 'Exit text selection' : 'Select text'}
        onClick={() => {
          exitHighlightMode()
          exitNoteMode()
          if (isTextSelectionLayerVisible) {
            deactivateTextSelectionMode()
          } else {
            setIsTextSelectionMode(true)
          }
        }}
        disabled={!canUsePreciseViewer}
        aria-pressed={isTextSelectionLayerVisible}
        className={cn(isTextSelectionLayerVisible && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary')}
      >
        <Type className="h-4 w-4" />
      </ReaderToolbarIconButton>
      {viewerMode === 'native' ? (
        <Badge variant="outline" className="shrink-0 border-amber-300 bg-amber-50 text-amber-900 text-xs">
          Basic preview only
        </Badge>
      ) : null}
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {activeFilePath && (
          <Popover open={isPrintOptionsOpen} onOpenChange={onPrintOptionsOpenChange}>
            <PopoverTrigger asChild>
              <ReaderToolbarIconButton
                label="Print document"
                disabled={!isDesktopApp || !activeFilePath || isPrinting}
              >
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              </ReaderToolbarIconButton>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-64 rounded-2xl border-border/80 bg-background/98 p-2 shadow-xl">
              <div className="px-2 pb-2 pt-1">
                <div className="text-sm font-medium text-foreground">Print document</div>
                <div className="text-xs text-muted-foreground">Choose how this PDF should be prepared.</div>
              </div>
              <div className="grid gap-1">
                <Button variant="ghost" className="justify-start rounded-xl" onClick={() => onPrintDocument('original')} disabled={isPrinting}>
                  Print original
                </Button>
                <Button variant="ghost" className="justify-start rounded-xl" onClick={() => onPrintDocument('highlights')} disabled={isPrinting}>
                  Print with highlights
                </Button>
                <Button variant="ghost" className="justify-start rounded-xl" onClick={() => onPrintDocument('highlights-notes')} disabled={isPrinting}>
                  Highlights + notes text
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {activeFilePath && (
          <ReaderToolbarIconButton
            label="Open in window"
            onClick={onDetachReaderWindow}
            disabled={!isDesktopApp || !activeFilePath}
          >
            <SquareArrowOutUpRight className="h-4 w-4" />
          </ReaderToolbarIconButton>
        )}
        <Button variant="outline" size="sm" className="h-8 gap-1.5 border-border/80 px-2" onClick={onOpenDetails}>
          <FilePenLine className="h-4 w-4" />
          Details
        </Button>
      </div>
      {activeFilePath && !hasNativeTextLayer && (
        <Button
          variant="outline"
          size="sm"
          className="ml-1 h-8 border-border/80 px-2"
          onClick={onRunOcr}
          disabled={!isDesktopApp || !activeFilePath || isRunningOcr || ocrStatus === 'processing'}
          aria-label={
            isRunningOcr || ocrStatus === 'processing'
              ? 'Running OCR'
              : hasOcrText
                ? 'Re-run OCR'
                : 'Run OCR'
          }
        >
          <Loader2 className={`mr-2 h-4 w-4 ${isRunningOcr || ocrStatus === 'processing' ? 'animate-spin' : 'hidden'}`} />
          {isRunningOcr || ocrStatus === 'processing'
            ? 'Running OCR...'
            : hasOcrText
              ? 'Re-run OCR'
              : 'Run OCR'}
        </Button>
      )}
    </>
  )
}
