'use client'

import { useMemo, useState } from 'react'
import { Search, Telescope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useLibraryStore } from '@/lib/stores/library-store'
import { useDiscoverActions } from '@/lib/stores/discover-store'
import { useT } from '@/lib/localization'
import { cn } from '@/lib/utils'

const ALL_LIBRARIES_ID = '__all_libraries__'

type DiscoverEmptyStateProps = {
  onBack?: () => void
}

export function DiscoverEmptyState({ onBack }: DiscoverEmptyStateProps) {
  const t = useT()
  const documents = useDocumentStore((state) => state.documents)
  const libraries = useLibraryStore((state) => state.libraries)
  const { loadSeedDocument } = useDiscoverActions()
  const [query, setQuery] = useState('')
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>(ALL_LIBRARIES_ID)

  const librariesById = useMemo(
    () => new Map(libraries.map((library) => [library.id, library])),
    [libraries],
  )

  const librariesWithDocuments = useMemo(
    () => libraries
      .map((library) => ({
        ...library,
        documents: documents
          .filter((document) => document.libraryId === library.id)
          .sort((left, right) => left.title.localeCompare(right.title)),
      }))
      .filter((library) => library.documents.length > 0),
    [documents, libraries],
  )

  const selectedLibrary = selectedLibraryId === ALL_LIBRARIES_ID
    ? null
    : librariesById.get(selectedLibraryId) ?? null

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    const scopedDocuments = selectedLibraryId === ALL_LIBRARIES_ID
      ? documents
      : documents.filter((document) => document.libraryId === selectedLibraryId)

    return scopedDocuments
      .filter((document) => {
        if (!normalized) return true
        return [
          document.title,
          document.authors.join(' '),
          document.year ? String(document.year) : '',
          document.doi ?? '',
          document.citationKey,
          librariesById.get(document.libraryId)?.name ?? '',
        ].join(' ').toLowerCase().includes(normalized)
      })
      .sort((left, right) => {
        const leftLibrary = librariesById.get(left.libraryId)?.name ?? ''
        const rightLibrary = librariesById.get(right.libraryId)?.name ?? ''
        if (leftLibrary !== rightLibrary) return leftLibrary.localeCompare(rightLibrary)
        return left.title.localeCompare(right.title)
      })
  }, [documents, librariesById, query, selectedLibraryId])

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4 md:p-6">
      <Card className="relative min-h-0 flex-1 border-dashed p-4 md:p-6">
        {onBack ? (
          <div className="absolute left-4 top-4 z-10 md:left-6 md:top-6">
            <Button variant="outline" className="rounded-full bg-card/90 backdrop-blur" onClick={onBack}>
              {t('discoverPage.backToHome')}
            </Button>
          </div>
        ) : null}
        <div className="flex h-full min-h-0 flex-col items-center gap-5 text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="discover-seed-icon-glow absolute rounded-full" />
            <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Telescope className="h-8 w-8" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{t('discoverPage.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('discoverPage.emptyDescription')}</p>
          </div>

          <div className="grid min-h-0 w-full flex-1 gap-4 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="flex min-h-0 flex-col rounded-2xl border bg-muted/40 p-3 text-left">
              <div className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t('discoverPage.chooseLibrary')}
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelectedLibraryId(ALL_LIBRARIES_ID)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                    selectedLibraryId === ALL_LIBRARIES_ID
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent/30',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{t('discoverPage.allLibraries')}</span>
                    <span className="block text-xs text-muted-foreground">{t('discoverPage.searchAcrossLibraries')}</span>
                  </span>
                  <Badge variant="secondary">{documents.length}</Badge>
                </button>

                {librariesWithDocuments.map((library) => (
                  <button
                    key={library.id}
                    type="button"
                    onClick={() => setSelectedLibraryId(library.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2.5 text-left transition',
                      selectedLibraryId === library.id ? 'bg-primary/10' : 'bg-card hover:bg-accent/30',
                    )}
                    style={{
                      borderColor: selectedLibraryId === library.id ? library.color : `${library.color}55`,
                      boxShadow: selectedLibraryId === library.id ? `0 0 0 3px ${library.color}22` : undefined,
                    }}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: library.color }} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{library.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {t('discoverPage.documentsInLibrary', { count: library.documents.length })}
                        </span>
                      </span>
                    </span>
                    <Badge
                      variant="outline"
                      className="shrink-0"
                      style={{ borderColor: `${library.color}77`, color: library.color }}
                    >
                      {library.documents.length}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-3 overflow-hidden text-left">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={selectedLibrary
                    ? t('discoverPage.searchSelectedLibrary', { library: selectedLibrary.name })
                    : t('discoverPage.seedPlaceholder')}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center justify-between gap-3 px-1 text-sm">
                <div className="font-medium">
                  {selectedLibrary
                    ? t('discoverPage.documentsFromLibrary', { library: selectedLibrary.name })
                    : t('discoverPage.allDocuments')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t('discoverPage.matchingDocuments', { count: filteredDocuments.length })}
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-auto rounded-2xl border bg-muted/40 p-2">
                {filteredDocuments.map((document) => {
                  const library = librariesById.get(document.libraryId)

                  return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => void loadSeedDocument(document.id)}
                      className="w-full rounded-2xl border bg-card px-4 py-3 text-left transition hover:border-primary/40 hover:bg-accent/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-2 font-medium">{document.title}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {document.authors.join(', ') || t('searchPage.unknownAuthor')}
                            {document.year ? ` - ${document.year}` : ''}
                          </div>
                        </div>
                        {library ? (
                          <span
                            className="flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium"
                            style={{
                              borderColor: `${library.color}66`,
                              backgroundColor: `${library.color}18`,
                              color: library.color,
                            }}
                          >
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: library.color }} />
                            {library.name}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {document.doi ? `DOI: ${document.doi}` : document.citationKey}
                      </div>
                    </button>
                  )
                })}
                {filteredDocuments.length === 0 ? (
                  <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('discoverPage.noSeedResults')}
                  </div>
                ) : null}
              </div>

              <div className="text-center text-xs text-muted-foreground">
                {t('discoverPage.chooseSeedHint')}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <style jsx>{`
        .discover-seed-icon-glow {
          inset: 6px;
          border: 0;
          background: radial-gradient(
            circle,
            transparent 0%,
            transparent 36%,
            color-mix(in oklch, var(--primary) 18%, transparent) 52%,
            color-mix(in oklch, var(--primary) 10%, transparent) 68%,
            transparent 82%
          );
          box-shadow: 0 0 28px color-mix(in oklch, var(--primary) 32%, transparent);
          animation: discover-seed-icon-glow 3.8s ease-in-out infinite;
          filter: blur(0.5px);
          will-change: transform, opacity, box-shadow;
        }

        @keyframes discover-seed-icon-glow {
          0%,
          100% {
            transform: scale(0.78);
            opacity: 0.38;
            box-shadow: 0 0 18px color-mix(in oklch, var(--primary) 20%, transparent);
          }

          50% {
            transform: scale(1.24);
            opacity: 0.92;
            box-shadow: 0 0 38px color-mix(in oklch, var(--primary) 42%, transparent);
          }
        }
      `}</style>
    </div>
  )
}
