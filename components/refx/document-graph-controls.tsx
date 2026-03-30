'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/localization'
import type {
  GraphColorMode,
  GraphNeighborhoodDepth,
  GraphSizeMode,
} from '@/lib/services/document-graph-view-service'
import type { Document } from '@/lib/types'

type DocumentGraphControlsProps = {
  colorMode: GraphColorMode
  onColorModeChange: (value: GraphColorMode) => void
  sizeMode: GraphSizeMode
  onSizeModeChange: (value: GraphSizeMode) => void
  neighborhoodDepth: GraphNeighborhoodDepth
  onNeighborhoodDepthChange: (value: GraphNeighborhoodDepth) => void
  hideOrphans: boolean
  onHideOrphansChange: (value: boolean) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchResults: Document[]
  onJumpToDocument: (documentId: string) => void
}

export function DocumentGraphControls({
  colorMode,
  onColorModeChange,
  sizeMode,
  onSizeModeChange,
  neighborhoodDepth,
  onNeighborhoodDepthChange,
  hideOrphans,
  onHideOrphansChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onJumpToDocument,
}: DocumentGraphControlsProps) {
  const t = useT()
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  return (
    <Card className="border-border/70 bg-card/92 p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('mapsPage.filterLayout')}
          </p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="graph-search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder={t('mapsPage.searchTitlesInMap')}
              className="bg-background/90 pl-9"
            />
          </div>
          {searchResults.length > 0 ? (
            <Select onValueChange={onJumpToDocument}>
              <SelectTrigger className="h-9 bg-background/90">
                <SelectValue placeholder={t('mapsPage.jumpToMatchingDocument')} />
              </SelectTrigger>
              <SelectContent>
                {searchResults.slice(0, 12).map((document) => (
                  <SelectItem key={document.id} value={document.id}>
                    {document.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
        <div className="flex items-end justify-end lg:self-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsAdvancedOpen((current) => !current)}
              >
                {isAdvancedOpen ? (
                  <ChevronUp className="mr-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                {isAdvancedOpen ? t('mapsPage.collapseControls') : t('mapsPage.expandControls')}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              {t('mapsPage.filterLayoutHelp')}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isAdvancedOpen ? (
        <>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="inline-flex cursor-help text-sm font-semibold text-foreground">{t('mapsPage.appearance')}</h3>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t('mapsPage.appearanceDescription')}
                </TooltipContent>
              </Tooltip>
              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label>{t('mapsPage.nodeColors')}</Label>
                  <Select value={colorMode} onValueChange={(value) => onColorModeChange(value as GraphColorMode)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="library">{t('mapsPage.libraryColors')}</SelectItem>
                      <SelectItem value="year">{t('mapsPage.yearColors')}</SelectItem>
                      <SelectItem value="density">{t('mapsPage.density')}</SelectItem>
                      <SelectItem value="status">{t('mapsPage.status')}</SelectItem>
                      <SelectItem value="component">{t('mapsPage.component')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('mapsPage.nodeSize')}</Label>
                  <Select value={sizeMode} onValueChange={(value) => onSizeModeChange(value as GraphSizeMode)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uniform">{t('mapsPage.uniform')}</SelectItem>
                      <SelectItem value="inbound_citations">{t('mapsPage.inboundCitations')}</SelectItem>
                      <SelectItem value="total_degree">{t('mapsPage.totalDegree')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="inline-flex cursor-help text-sm font-semibold text-foreground">{t('mapsPage.focus')}</h3>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {t('mapsPage.focusDescription')}
                </TooltipContent>
              </Tooltip>
              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label>{t('mapsPage.focusType')}</Label>
                  <Select value={neighborhoodDepth} onValueChange={(value) => onNeighborhoodDepthChange(value as GraphNeighborhoodDepth)}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">{t('mapsPage.fullGraph')}</SelectItem>
                      <SelectItem value="1">{t('mapsPage.oneHopNeighbors')}</SelectItem>
                      <SelectItem value="2">{t('mapsPage.twoHopNeighbors')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-3">
                  <Label className="flex items-center justify-between gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help">{t('mapsPage.hideIsolated')}</span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={8}>
                        {t('mapsPage.hideIsolatedDescription')}
                      </TooltipContent>
                    </Tooltip>
                    <Switch checked={hideOrphans} onCheckedChange={onHideOrphansChange} />
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  )
}
