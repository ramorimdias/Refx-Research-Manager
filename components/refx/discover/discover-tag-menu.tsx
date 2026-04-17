'use client'

import { ChevronDown, Pin, Star, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DiscoverExternalTag, DiscoverWork } from '@/lib/types'
import { useDiscoverActions } from '@/lib/stores/discover-store'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/localization'

const TAG_CONFIG: Array<{ tag: DiscoverExternalTag; icon: typeof Star; labelKey: string }> = [
  { tag: 'favorite', icon: Star, labelKey: 'discoverPage.tagFavorite' },
  { tag: 'interesting', icon: Bookmark, labelKey: 'discoverPage.tagInteresting' },
  { tag: 'save_for_later', icon: Pin, labelKey: 'discoverPage.tagSaveForLater' },
]

export function DiscoverTagMenu({ work }: { work: DiscoverWork }) {
  const t = useT()
  const { toggleExternalTag } = useDiscoverActions()
  const activeTags = new Set(work.userTags ?? [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {t('discoverPage.tags')}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-1">
        {TAG_CONFIG.map(({ tag, icon: Icon, labelKey }) => {
          const isActive = activeTags.has(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleExternalTag(work.id, tag)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition',
                isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t(labelKey)}</span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
