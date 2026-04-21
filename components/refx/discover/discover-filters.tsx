'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { DiscoverFilterState } from '@/lib/types'
import { useT } from '@/lib/localization'

export function DiscoverFilters({
  filters,
  onChange,
  onClear,
}: {
  filters: DiscoverFilterState
  onChange: (min: number | null, max: number | null) => void
  onClear: () => void
}) {
  const t = useT()

  return (
    <div className="rounded-2xl border bg-muted/40 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {t('discoverPage.filters')}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={filters.yearMin ?? ''}
          onChange={(event) => onChange(event.target.value ? Number.parseInt(event.target.value, 10) : null, filters.yearMax ?? null)}
          placeholder={t('discoverPage.yearMin')}
          inputMode="numeric"
        />
        <Input
          value={filters.yearMax ?? ''}
          onChange={(event) => onChange(filters.yearMin ?? null, event.target.value ? Number.parseInt(event.target.value, 10) : null)}
          placeholder={t('discoverPage.yearMax')}
          inputMode="numeric"
        />
      </div>
      <div className="mt-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onClear}>{t('discoverPage.clearFilters')}</Button>
      </div>
    </div>
  )
}
