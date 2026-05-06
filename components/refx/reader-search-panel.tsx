'use client'

import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useT } from '@/lib/localization'
import type { SearchOccurrence } from '@/lib/services/document-processing'

type GroupedSearchOccurrence = {
  occurrence: SearchOccurrence
  occurrenceIndexes: number[]
}

type ReaderSearchPanelProps = {
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  groupedSearchOccurrences: GroupedSearchOccurrence[]
  searchOccurrencesLength: number
  activeOccurrenceIndex: number
  activeOccurrenceGroupIndex: number
  onRotateOccurrence: (direction: 'prev' | 'next') => void
  onSelectOccurrence: (occurrenceIndex: number) => void
  setOccurrenceRef: (groupIndex: number, element: HTMLButtonElement | null) => void
  renderHighlightedSnippet: (snippet: string) => ReactNode
}

export function ReaderSearchPanel({
  searchQuery,
  onSearchQueryChange,
  groupedSearchOccurrences,
  searchOccurrencesLength,
  activeOccurrenceIndex,
  activeOccurrenceGroupIndex,
  onRotateOccurrence,
  onSelectOccurrence,
  setOccurrenceRef,
  renderHighlightedSnippet,
}: ReaderSearchPanelProps) {
  const t = useT()
  const trimmedQuery = searchQuery.trim()

  return (
    <div className="space-y-2 rounded-lg border p-3" data-tour-id="reader-search">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Search className="h-4 w-4" />
        {t('readerView.search')}
      </div>
      <div className="space-y-2">
        <Input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={t('readerView.keywordOrPhrase')}
        />
        {trimmedQuery ? (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{groupedSearchOccurrences.length} occurrence{groupedSearchOccurrences.length === 1 ? '' : 's'}</span>
            {groupedSearchOccurrences.length > 0 && <span>Selected {activeOccurrenceGroupIndex + 1}</span>}
          </div>
        ) : null}
        {trimmedQuery ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRotateOccurrence('prev')}
              disabled={searchOccurrencesLength === 0}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              {t('readerView.previous')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRotateOccurrence('next')}
              disabled={searchOccurrencesLength === 0}
            >
              {t('readerView.next')}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {searchOccurrencesLength > 0 ? (
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {groupedSearchOccurrences.map(({ occurrence, occurrenceIndexes }, groupIndex) => (
              <button
                key={`${occurrence.start}-${occurrenceIndexes.join('-')}`}
                ref={(element) => {
                  setOccurrenceRef(groupIndex, element)
                }}
                type="button"
                onClick={() => {
                  onSelectOccurrence(occurrenceIndexes[0] ?? 0)
                }}
                className={`w-full rounded-md border p-2 text-left text-sm transition ${
                  occurrenceIndexes.includes(activeOccurrenceIndex) ? 'border-primary bg-primary/8' : 'border-border bg-muted/40 hover:bg-muted/70'
                }`}
              >
                <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {occurrenceIndexes.length === 1
                      ? t('readerView.occurrence', { index: (occurrenceIndexes[0] ?? 0) + 1 })
                      : `Occurrences ${occurrenceIndexes.map((value) => value + 1).join(', ')}`}
                  </span>
                  <span>{occurrence.rects?.length ? 'Page' : t('readerView.approxPage')} {occurrence.estimatedPage}</span>
                </div>
                {!occurrence.rects?.length ? (
                  <Badge variant="outline" className="mb-2">
                    {t('readerView.pageFallback')}
                  </Badge>
                ) : null}
                <div className="leading-6">{renderHighlightedSnippet(occurrence.snippet)}</div>
              </button>
            ))}
          </div>
        ) : trimmedQuery ? (
          <div className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
            {t('readerView.noMatchesKeyword')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
