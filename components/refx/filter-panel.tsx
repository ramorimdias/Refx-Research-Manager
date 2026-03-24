'use client'

import { useState } from 'react'
import {
  Filter,
  X,
  ChevronDown,
  Star,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { mockTags } from '@/lib/mock-data'
import type { ReadingStage, MetadataStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const readingStages: { value: ReadingStage; label: string }[] = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'skimmed', label: 'Skimmed' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
]

const metadataStatuses: { value: MetadataStatus; label: string }[] = [
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'partial', label: 'Partial' },
  { value: 'complete', label: 'Complete' },
  { value: 'verified', label: 'Verified' },
]

export function FilterPanel() {
  const { filters, setFilters } = useAppStore()
  const [isOpen, setIsOpen] = useState(true)

  const activeFilterCount = [
    filters.tags?.length || 0,
    filters.readingStage?.length || 0,
    filters.metadataStatus?.length || 0,
    filters.favorite ? 1 : 0,
    filters.hasAnnotations ? 1 : 0,
  ].reduce((a, b) => a + b, 0)

  const toggleReadingStage = (stage: ReadingStage) => {
    const current = filters.readingStage || []
    const updated = current.includes(stage)
      ? current.filter((s) => s !== stage)
      : [...current, stage]
    setFilters({ ...filters, readingStage: updated.length > 0 ? updated : undefined })
  }

  const toggleMetadataStatus = (status: MetadataStatus) => {
    const current = filters.metadataStatus || []
    const updated = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status]
    setFilters({ ...filters, metadataStatus: updated.length > 0 ? updated : undefined })
  }

  const toggleTag = (tag: string) => {
    const current = filters.tags || []
    const updated = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag]
    setFilters({ ...filters, tags: updated.length > 0 ? updated : undefined })
  }

  const clearAllFilters = () => {
    setFilters({})
  }

  return (
    <div className="w-64 shrink-0 border-r border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Quick Filters */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="favorite"
              checked={filters.favorite || false}
              onCheckedChange={(checked) =>
                setFilters({ ...filters, favorite: checked ? true : undefined })
              }
            />
            <Label htmlFor="favorite" className="flex items-center gap-2 cursor-pointer">
              <Star className="h-3.5 w-3.5 text-amber-400" />
              Favorites only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="hasAnnotations"
              checked={filters.hasAnnotations || false}
              onCheckedChange={(checked) =>
                setFilters({ ...filters, hasAnnotations: checked ? true : undefined })
              }
            />
            <Label htmlFor="hasAnnotations" className="flex items-center gap-2 cursor-pointer">
              <MessageSquare className="h-3.5 w-3.5" />
              Has annotations
            </Label>
          </div>
        </div>

        <Separator />

        {/* Reading Stage */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            Reading Stage
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {readingStages.map((stage) => (
              <div key={stage.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`stage-${stage.value}`}
                  checked={filters.readingStage?.includes(stage.value) || false}
                  onCheckedChange={() => toggleReadingStage(stage.value)}
                />
                <Label htmlFor={`stage-${stage.value}`} className="cursor-pointer">
                  {stage.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Metadata Status */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            Metadata Status
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {metadataStatuses.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`meta-${status.value}`}
                  checked={filters.metadataStatus?.includes(status.value) || false}
                  onCheckedChange={() => toggleMetadataStatus(status.value)}
                />
                <Label htmlFor={`meta-${status.value}`} className="cursor-pointer">
                  {status.label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        {/* Tags */}
        <Collapsible defaultOpen>
          <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
            Tags
            <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2">
            {mockTags.slice(0, 10).map((tag) => (
              <div key={tag.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`tag-${tag.id}`}
                  checked={filters.tags?.includes(tag.name) || false}
                  onCheckedChange={() => toggleTag(tag.name)}
                />
                <Label htmlFor={`tag-${tag.id}`} className="flex items-center gap-2 cursor-pointer">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate">{tag.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {tag.documentCount}
                  </span>
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}
