'use client'

import type { DiscoverFilterState, DiscoverWork } from '@/lib/types'

export function filterDiscoverItems(
  items: DiscoverWork[],
  filters: DiscoverFilterState,
) {
  return items.filter((item) => {
    if (filters.yearMin != null && (item.year ?? Number.MIN_SAFE_INTEGER) < filters.yearMin) return false
    if (filters.yearMax != null && (item.year ?? Number.MAX_SAFE_INTEGER) > filters.yearMax) return false
    return true
  })
}

export function formatDiscoverFilterSummary(filters: DiscoverFilterState) {
  if (filters.yearMin != null && filters.yearMax != null) {
    return `Showing works published between ${filters.yearMin} and ${filters.yearMax}.`
  }
  if (filters.yearMin != null) {
    return `Showing works published from ${filters.yearMin} onward.`
  }
  if (filters.yearMax != null) {
    return `Showing works published up to ${filters.yearMax}.`
  }
  return 'Showing works from all years.'
}
