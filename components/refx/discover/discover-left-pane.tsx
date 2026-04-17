'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DiscoverWorkRow } from '@/components/refx/discover/discover-work-row'
import { formatDiscoverFilterSummary } from '@/lib/services/discover-filter-service'
import type { DiscoverJourneyStep, DiscoverWork } from '@/lib/types'
import { useDiscoverStore } from '@/lib/stores/discover-store'
import { useT } from '@/lib/localization'

export function DiscoverLeftPane({
  label,
  step,
  items,
  showFilterHint = false,
  onFilterHintClick,
}: {
  label: ReactNode
  step: DiscoverJourneyStep | null
  items: DiscoverWork[]
  showFilterHint?: boolean
  onFilterHintClick?: () => void
}) {
  const t = useT()
  const hoveredWorkId = useDiscoverStore((state) => state.hoveredWorkId)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const filters = step?.filters ?? {}

  useEffect(() => {
    if (!hoveredWorkId || !containerRef.current) return
    const row = containerRef.current.querySelector<HTMLElement>(`[data-discover-work-row="${hoveredWorkId}"]`)
    row?.scrollIntoView({ block: 'nearest', behavior: 'auto' })
  }, [hoveredWorkId])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-[28px] border bg-card/95 p-4">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('discoverPage.currentStep')}</div>
        <div className="text-lg font-semibold leading-tight">{label}</div>
        <div className="text-sm text-muted-foreground">{formatDiscoverFilterSummary(filters)}</div>
      </div>
      {showFilterHint ? (
        <button
          type="button"
          onClick={onFilterHintClick}
          className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-left text-sm text-amber-900 transition hover:border-amber-300 hover:bg-amber-50"
        >
          Large step detected. Use the filters to reduce the number of visible works.
        </button>
      ) : null}
      <ScrollArea className="min-h-0 flex-1 pr-2">
        <div ref={containerRef} className="space-y-2">
          {items.map((work) => <DiscoverWorkRow key={work.id} work={work} />)}
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
              {t('discoverPage.noResults')}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
