'use client'

import { useMemo, useState } from 'react'
import { Search, Telescope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useDocumentStore } from '@/lib/stores/document-store'
import { useDiscoverActions } from '@/lib/stores/discover-store'
import { useT } from '@/lib/localization'

export function DiscoverEmptyState() {
  const t = useT()
  const documents = useDocumentStore((state) => state.documents)
  const { loadSeedDocument } = useDiscoverActions()
  const [query, setQuery] = useState('')

  const filteredDocuments = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return documents.slice(0, 12)
    return documents
      .filter((document) => [document.title, document.authors.join(' '), document.year ? String(document.year) : ''].join(' ').toLowerCase().includes(normalized))
      .slice(0, 12)
  }, [documents, query])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 py-12">
      <Card className="rounded-[28px] border-dashed p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Telescope className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{t('discoverPage.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('discoverPage.emptyDescription')}</p>
          </div>
          <div className="w-full max-w-xl space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('discoverPage.seedPlaceholder')}
                className="pl-9"
              />
            </div>
            <div className="max-h-[420px] space-y-2 overflow-auto rounded-2xl border bg-background p-2">
              {filteredDocuments.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => void loadSeedDocument(document.id)}
                  className="w-full rounded-2xl border px-4 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <div className="font-medium">{document.title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {document.authors.join(', ') || t('searchPage.unknownAuthor')}
                    {document.year ? ` • ${document.year}` : ''}
                  </div>
                </button>
              ))}
              {filteredDocuments.length === 0 ? (
                <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('discoverPage.noSeedResults')}
                </div>
              ) : null}
            </div>
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" disabled>{t('discoverPage.chooseSeedHint')}</Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
