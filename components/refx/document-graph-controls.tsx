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
  yearMin?: number
  yearMax?: number
  yearOptions: number[]
  onYearMinChange: (value?: number) => void
  onYearMaxChange: (value?: number) => void
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
  yearMin,
  yearMax,
  yearOptions,
  onYearMinChange,
  onYearMaxChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onJumpToDocument,
}: DocumentGraphControlsProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)

  return (
    <Card className="border-border/70 bg-card/92 p-2.5 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
      <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-1">
          <div className="space-y-0.5">
            <Label htmlFor="graph-search">Find document</Label>
            <p className="text-xs text-muted-foreground">
              Search this map and jump to a matching node.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              id="graph-search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              placeholder="Search titles in this map"
              className="pl-9"
            />
          </div>
          {searchResults.length > 0 ? (
            <Select onValueChange={onJumpToDocument}>
              <SelectTrigger className="h-9 bg-white">
                <SelectValue placeholder="Jump to matching document" />
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
                Filters & Layout
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={8}>
              Show graph filters, layout options, and quick view tools
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isAdvancedOpen ? (
        <>
          <div className="mt-3 grid gap-3 xl:grid-cols-[1.1fr_1fr_1fr]">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Appearance</h3>
                <p className="text-xs text-muted-foreground">
                  Control how documents look in the graph.
                </p>
              </div>
              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label>Node colors</Label>
                  <Select value={colorMode} onValueChange={(value) => onColorModeChange(value as GraphColorMode)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="library">Library</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="density">Density</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="component">Component</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Node size</Label>
                  <Select value={sizeMode} onValueChange={(value) => onSizeModeChange(value as GraphSizeMode)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="uniform">Uniform</SelectItem>
                      <SelectItem value="inbound_citations">Inbound citations</SelectItem>
                      <SelectItem value="total_degree">Total degree</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Focus</h3>
                <p className="text-xs text-muted-foreground">
                  Limit the view around the selected document when needed.
                </p>
              </div>
              <div className="mt-3 grid gap-3">
                <div className="space-y-2">
                  <Label>Focus type</Label>
                  <Select value={neighborhoodDepth} onValueChange={(value) => onNeighborhoodDepthChange(value as GraphNeighborhoodDepth)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full graph</SelectItem>
                      <SelectItem value="1">1-hop neighbors</SelectItem>
                      <SelectItem value="2">2-hop neighbors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-xl border border-border/70 bg-white/80 px-3 py-3">
                  <Label className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span>Hide isolated documents</span>
                      <p className="text-xs font-normal text-muted-foreground">
                        Remove documents with no visible links.
                      </p>
                    </div>
                    <Switch checked={hideOrphans} onCheckedChange={onHideOrphansChange} />
                  </Label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/70 p-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Years</h3>
                <p className="text-xs text-muted-foreground">
                  Narrow the visible documents by publication year.
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="space-y-2">
                  <Label>From</Label>
                  <Select value={yearMin?.toString() ?? 'any'} onValueChange={(value) => onYearMinChange(value === 'any' ? undefined : Number.parseInt(value, 10))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>To</Label>
                  <Select value={yearMax?.toString() ?? 'any'} onValueChange={(value) => onYearMaxChange(value === 'any' ? undefined : Number.parseInt(value, 10))}>
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any</SelectItem>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  )
}
