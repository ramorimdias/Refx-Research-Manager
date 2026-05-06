'use client'

import { ArrowLeft, ChevronLeft, ChevronRight, Highlighter, Search, StickyNote, ZoomIn, ZoomOut } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ReaderViewTourDemo() {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border bg-background/95 px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="sm">
              <a href="/reader">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </a>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">REFX Tour Sample PDF</h1>
              <p className="text-sm text-muted-foreground">A safe bundled PDF used only for the guided tour.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Reader search">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" data-tour-id="reader-highlight" aria-label="Reader highlights">
              <Highlighter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" data-tour-id="reader-notes" aria-label="Reader notes">
              <StickyNote className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/80 p-3" data-tour-id="reader-search">
          <Input className="max-w-sm" value="tour sample" readOnly />
          <Badge variant="secondary">Reader demo</Badge>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-muted/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Badge variant="outline">Page 1 / 2</Badge>
              <Button variant="outline" size="icon" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Badge variant="outline">100%</Badge>
              <Button variant="outline" size="icon" aria-label="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
            <iframe
              src="/tour-sample.pdf#toolbar=0&navpanes=0&scrollbar=0"
              className="pointer-events-none h-[70vh] w-full border-0"
              title="Tour sample PDF"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
