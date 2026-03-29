'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, ChevronDown, Link2, Network, RefreshCw, Trash2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { Document, DocumentRelation } from '@/lib/types'
import { getDocumentOpenHref } from '@/lib/services/document-relation-service'

type DocumentGraphPanelProps = {
  selectedDocument: Document | null
  selectedRelation: DocumentRelation | null
  sourceDocument: Document | null
  targetDocument: Document | null
  relatedIncomingDocuments: Document[]
  relatedOutgoingDocuments: Document[]
  onDeleteRelation: (relationId: string) => Promise<void> | void
  onInvertRelation?: (relationId: string) => Promise<void> | void
  isDeletingRelation?: boolean
  onCloseSelection?: () => void
}

export function DocumentGraphPanel({
  selectedDocument,
  selectedRelation,
  sourceDocument,
  targetDocument,
  relatedIncomingDocuments,
  relatedOutgoingDocuments,
  onDeleteRelation,
  onInvertRelation,
  isDeletingRelation = false,
  onCloseSelection,
}: DocumentGraphPanelProps) {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false)

  useEffect(() => {
    setIsAbstractExpanded(false)
  }, [selectedDocument?.id])

  if (!selectedDocument && !selectedRelation) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="p-5">
          <h2 className="text-base font-semibold">Relationship Details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Select a document node to inspect it, or click a connection to review or remove that relation.
          </p>
        </div>
      </div>
    )
  }

  if (selectedRelation && sourceDocument && targetDocument) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full bg-teal-100 p-2 text-teal-700">
                <Link2 className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Relation</h2>
                <p className="text-sm text-muted-foreground">
                  Review this persisted link between two documents.
                </p>
              </div>
            </div>
            {onCloseSelection ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={onCloseSelection}
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <Separator />
        <ScrollArea className="h-0 min-h-0 flex-1">
          <div className="space-y-5 p-5">
            <div className="grid gap-4 rounded-2xl border bg-card p-4">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Citing document</p>
                <Link
                  href={getDocumentOpenHref(sourceDocument)}
                  className="block rounded-xl border border-sky-200/80 bg-sky-50/70 px-3 py-3 transition hover:border-sky-300 hover:bg-sky-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{sourceDocument.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {sourceDocument.authors[0] ?? 'Unknown author'}
                    {sourceDocument.year ? ` - ${sourceDocument.year}` : ''}
                  </p>
                </Link>
              </div>
              <div className="flex items-center justify-center gap-3 py-1 text-sm font-medium text-sky-700">
                <span>Makes reference to</span>
                <ArrowRight className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Referenced document</p>
                <Link
                  href={getDocumentOpenHref(targetDocument)}
                  className="block rounded-xl border border-rose-200/80 bg-rose-50/70 px-3 py-3 transition hover:border-rose-300 hover:bg-rose-50"
                >
                  <p className="text-sm font-semibold text-slate-900">{targetDocument.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {targetDocument.authors[0] ?? 'Unknown author'}
                    {targetDocument.year ? ` - ${targetDocument.year}` : ''}
                  </p>
                </Link>
              </div>
            </div>

            <div className="grid gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={() => void onInvertRelation?.(selectedRelation.id)}
                    disabled={isDeletingRelation}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reverse Link Direction
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  Swap which document points to the other
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="destructive"
                    onClick={() => void onDeleteRelation(selectedRelation.id)}
                    disabled={isDeletingRelation}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove Link
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  Delete this connection from the map
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </ScrollArea>
      </div>
    )
  }

  if (!selectedDocument) return null

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-sky-100 p-2 text-sky-700">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{selectedDocument.title}</h2>
              <p className="text-sm text-muted-foreground">
                {selectedDocument.documentType === 'physical_book'
                  ? 'Physical book'
                  : selectedDocument.documentType === 'my_work'
                    ? 'My work'
                    : 'PDF document'}
              </p>
            </div>
          </div>
          {onCloseSelection ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={onCloseSelection}
              aria-label="Close details"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <Separator />
      <ScrollArea className="h-0 min-h-0 flex-1">
        <div className="space-y-5 p-5">
          <div className="grid gap-4 rounded-2xl border bg-card p-4">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Author</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedDocument.authors.length ? selectedDocument.authors.join(', ') : 'none'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Year</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {selectedDocument.year ?? 'none'}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Abstract</p>
                {selectedDocument.abstract?.trim() ? (
                  <button
                    type="button"
                    onClick={() => setIsAbstractExpanded((current) => !current)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                  >
                    {isAbstractExpanded ? 'Collapse' : 'Expand'}
                    <ChevronDown className={isAbstractExpanded ? 'h-3.5 w-3.5 rotate-180' : 'h-3.5 w-3.5'} />
                  </button>
                ) : null}
              </div>
              <p className={isAbstractExpanded ? 'text-sm leading-6 text-muted-foreground' : 'line-clamp-3 text-sm leading-6 text-muted-foreground'}>
                {selectedDocument.abstract?.trim() || 'none'}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-sky-200/80 bg-sky-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-sky-900">Makes reference to</h3>
              <Badge className="border-sky-200 bg-sky-100 text-sky-700 hover:bg-sky-100">
                {relatedOutgoingDocuments.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {relatedOutgoingDocuments.length ? (
                relatedOutgoingDocuments.map((document) => (
                  <Link
                    key={document.id}
                    href={getDocumentOpenHref(document)}
                    className="block rounded-xl border border-sky-200/80 bg-white/90 px-3 py-2 transition hover:border-sky-300 hover:bg-white"
                  >
                    <p className="text-sm font-medium text-slate-900">{document.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.authors[0] ?? 'Unknown author'}
                      {document.year ? ` - ${document.year}` : ''}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-sky-800/80">none</p>
              )}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-rose-900">Is referenced by</h3>
              <Badge className="border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100">
                {relatedIncomingDocuments.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {relatedIncomingDocuments.length ? (
                relatedIncomingDocuments.map((document) => (
                  <Link
                    key={document.id}
                    href={getDocumentOpenHref(document)}
                    className="block rounded-xl border border-rose-200/80 bg-white/90 px-3 py-2 transition hover:border-rose-300 hover:bg-white"
                  >
                    <p className="text-sm font-medium text-slate-900">{document.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.authors[0] ?? 'Unknown author'}
                      {document.year ? ` - ${document.year}` : ''}
                    </p>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-rose-800/80">none</p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
