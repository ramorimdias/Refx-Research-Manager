'use client'

import { ArrowLeft, ChevronLeft, ChevronRight, SquareSquare, ZoomIn, ZoomOut } from 'lucide-react'
import { ReaderToolbarIconButton } from '@/components/refx/reader-toolbar-icon-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ReaderNavigationToolbarProps = {
  backLabel: string
  onBack: () => void
  page: number
  onPageChange: (page: number) => void
  totalPages: number | string
  onPreviousPage: () => void
  onNextPage: () => void
  displayedZoom: number
  onResetZoom: () => void
  onZoomOut: () => void
  onZoomIn: () => void
}

export function ReaderNavigationToolbar({
  backLabel,
  onBack,
  page,
  onPageChange,
  totalPages,
  onPreviousPage,
  onNextPage,
  displayedZoom,
  onResetZoom,
  onZoomOut,
  onZoomIn,
}: ReaderNavigationToolbarProps) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={backLabel}
        className="h-8 w-8 shrink-0 rounded-full border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/70 hover:text-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1">
        <ReaderToolbarIconButton label="Previous page" onClick={onPreviousPage}>
          <ChevronLeft className="h-4 w-4" />
        </ReaderToolbarIconButton>
        <div className="relative min-w-[4.6rem]">
          <Input
            value={page}
            onChange={(event) => onPageChange(Math.max(1, Number(event.target.value) || 1))}
            aria-label="Current page"
            className="h-8 w-16 border-transparent bg-background pr-6 text-center text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            / {totalPages}
          </span>
        </div>
        <ReaderToolbarIconButton label="Next page" onClick={onNextPage}>
          <ChevronRight className="h-4 w-4" />
        </ReaderToolbarIconButton>
      </div>
      <div className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />
      <div className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/80 px-2 py-1">
        <ReaderToolbarIconButton label="Reset zoom" onClick={onResetZoom}>
          <SquareSquare className="h-4 w-4" />
        </ReaderToolbarIconButton>
        <ReaderToolbarIconButton label="Zoom out" onClick={onZoomOut}>
          <ZoomOut className="h-4 w-4" />
        </ReaderToolbarIconButton>
        <span className="min-w-[2.75rem] text-center text-xs text-muted-foreground">{displayedZoom}%</span>
        <ReaderToolbarIconButton label="Zoom in" onClick={onZoomIn}>
          <ZoomIn className="h-4 w-4" />
        </ReaderToolbarIconButton>
      </div>
    </>
  )
}
