'use client'

import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import {
  FilePenLine,
  Plus,
  RefreshCw,
  Save,
  SaveAll,
  Search,
  SlidersHorizontal,
  Trash2,
  WandSparkles,
  Waypoints,
} from 'lucide-react'
import { PageHeader } from '@/components/refx/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useT } from '@/lib/localization'
import type { Document, GraphView } from '@/lib/types'
import { cn } from '@/lib/utils'
import type {
  GraphColorMode,
  GraphNeighborhoodDepth,
  GraphRelationFilter,
  GraphScopeMode,
  GraphSizeMode,
} from '@/lib/services/document-graph-view-service'
import type { ConnectionDirection } from '@/components/refx/map-flow-types'

type GraphPreferences = {
  colorMode: GraphColorMode
  confidenceThreshold: number
  focusMode: boolean
  hideOrphans: boolean
  neighborhoodDepth: GraphNeighborhoodDepth
  relationFilter: GraphRelationFilter
  scopeMode: GraphScopeMode
  sizeMode: GraphSizeMode
  yearMax?: number
  yearMin?: number
}

const WORKING_MAP_SELECT_VALUE = '__working__'

function MapsToolbarIconButton({
  label,
  tooltipSide = 'top',
  className,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  label: string
  tooltipSide?: 'top' | 'bottom'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          {...props}
          aria-label={label}
          className={cn(
            'h-9 w-9 rounded-full border border-border/70 bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
            className,
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

type MapsWorkspaceToolbarProps = {
  visibleDocumentsCount: number
  activeGraphViewId: string | null
  onActiveGraphViewIdChange: (value: string | null) => void
  activeLibraryGraphViews: GraphView[]
  activeGraphView: GraphView | null
  isAddDocumentPopoverOpen: boolean
  onAddDocumentPopoverOpenChange: (open: boolean) => void
  addDocumentQuery: string
  onAddDocumentQueryChange: (value: string) => void
  pendingConnectionDirection: ConnectionDirection | null
  filteredAddableDocuments: Document[]
  addableDocumentsLength: number
  hasAddableWorks: boolean
  onAddDocumentToMap: (documentId: string) => void
  onRenameView: () => void
  graphPreferences: GraphPreferences
  setGraphPreferences: Dispatch<SetStateAction<GraphPreferences>>
  onOpenCreateMapDialog: () => void
  onPersistActiveViewSnapshot: () => void
  onOpenSaveViewDialog: () => void
  isReheatingLayout: boolean
  onReheatLayout: () => void
  isRefreshingWorkReferences: boolean
  onRefreshWorkReferences: () => void
  onDeleteWorkspace: () => void
}

export function MapsWorkspaceToolbar({
  visibleDocumentsCount,
  activeGraphViewId,
  onActiveGraphViewIdChange,
  activeLibraryGraphViews,
  activeGraphView,
  isAddDocumentPopoverOpen,
  onAddDocumentPopoverOpenChange,
  addDocumentQuery,
  onAddDocumentQueryChange,
  pendingConnectionDirection,
  filteredAddableDocuments,
  addableDocumentsLength,
  hasAddableWorks,
  onAddDocumentToMap,
  onRenameView,
  graphPreferences,
  setGraphPreferences,
  onOpenCreateMapDialog,
  onPersistActiveViewSnapshot,
  onOpenSaveViewDialog,
  isReheatingLayout,
  onReheatLayout,
  isRefreshingWorkReferences,
  onRefreshWorkReferences,
  onDeleteWorkspace,
}: MapsWorkspaceToolbarProps) {
  const t = useT()

  return (
    <PageHeader
      icon={<Waypoints className="h-6 w-6" />}
      title={t('mapsPage.title')}
      subtitle={t('mapsPage.subtitle')}
      actions={(
        <>
          <Badge variant="outline" className="h-8 rounded-full px-3 text-xs">
            {visibleDocumentsCount}
          </Badge>

          <div className="min-w-[220px] flex-1" data-tour-id="maps-workspace">
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Select
                    value={activeGraphViewId ?? WORKING_MAP_SELECT_VALUE}
                    onValueChange={(value) => onActiveGraphViewIdChange(value === WORKING_MAP_SELECT_VALUE ? null : value)}
                  >
                    <SelectTrigger className="h-9 rounded-xl bg-background">
                      <SelectValue placeholder={t('mapsPage.workingMap')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={WORKING_MAP_SELECT_VALUE}>
                        {t('mapsPage.workingMap')}
                      </SelectItem>
                      {activeLibraryGraphViews.map((view) => (
                        <SelectItem key={view.id} value={view.id}>
                          {view.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                {activeGraphView?.description?.trim() || t('mapsPage.workingMapDescription')}
              </TooltipContent>
            </Tooltip>
          </div>

          {activeGraphView ? (
            <MapsToolbarIconButton
              label={t('mapsPage.renameView')}
              tooltipSide="bottom"
              variant="ghost"
              onClick={onRenameView}
            >
              <FilePenLine className="h-4 w-4" />
            </MapsToolbarIconButton>
          ) : null}

          <Popover open={isAddDocumentPopoverOpen} onOpenChange={onAddDocumentPopoverOpenChange}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('mapsPage.addDocumentToMap')}
                aria-label={t('mapsPage.addDocumentToMap')}
                className="h-9 w-9 rounded-full"
                data-tour-id="maps-add-document"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[360px] p-0" align="start">
              <div className="space-y-2 p-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={addDocumentQuery}
                    onChange={(event) => onAddDocumentQueryChange(event.target.value)}
                    placeholder={pendingConnectionDirection ? t('mapsPage.searchAndLinkPlaceholder') : t('mapsPage.searchDocumentsPlaceholder')}
                    className="bg-background pl-9"
                  />
                </div>
                <div className="max-h-[320px] overflow-y-auto">
                  {filteredAddableDocuments.length > 0 ? (
                    <div className="space-y-1">
                      {filteredAddableDocuments.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          className="flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => {
                            onAddDocumentToMap(document.id)
                            onAddDocumentPopoverOpenChange(false)
                            onAddDocumentQueryChange('')
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{document.title}</p>
                              {document.documentType === 'my_work' ? (
                                <Badge className="h-5 rounded-full border-amber-300/70 bg-amber-50 px-2 text-[10px] font-medium text-amber-900 hover:bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-200 dark:hover:bg-amber-500/15">
                                  {t('referencesPage.title')}
                                </Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {document.authors.slice(0, 2).join(', ') || t('searchPage.unknownAuthor')}
                              {document.year ? ` - ${document.year}` : ''}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                      {addableDocumentsLength > 0 || hasAddableWorks
                        ? t('mapsPage.noMatchingDocument')
                        : t('mapsPage.myWorkAlreadyOnMap')}
                    </p>
                  )}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('mapsPage.filterLayout')}
                aria-label={t('mapsPage.filterLayout')}
                className="h-9 w-9 rounded-full"
                data-tour-id="maps-layout-filter"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-3" align="end">
              <div className="grid gap-3">
                <div className="space-y-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="inline-flex cursor-help text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                        {t('mapsPage.appearance')}
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      {t('mapsPage.appearanceDescription')}
                    </TooltipContent>
                  </Tooltip>
                  <div className="grid gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('mapsPage.nodeColors')}</Label>
                      <Select
                        value={graphPreferences.colorMode}
                        onValueChange={(value) => setGraphPreferences((current) => ({ ...current, colorMode: value as GraphColorMode }))}
                      >
                        <SelectTrigger className="h-8 bg-background">
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
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t('mapsPage.nodeSize')}</Label>
                      <Select
                        value={graphPreferences.sizeMode}
                        onValueChange={(value) => setGraphPreferences((current) => ({ ...current, sizeMode: value as GraphSizeMode }))}
                      >
                        <SelectTrigger className="h-8 bg-background">
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
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <h3 className="inline-flex cursor-help text-xs font-semibold uppercase tracking-[0.16em] text-foreground">
                        {t('mapsPage.focus')}
                      </h3>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                      {t('mapsPage.focusDescription')}
                    </TooltipContent>
                  </Tooltip>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t('mapsPage.focusType')}</Label>
                    <Select
                      value={graphPreferences.neighborhoodDepth}
                      onValueChange={(value) => setGraphPreferences((current) => ({
                        ...current,
                        neighborhoodDepth: value as GraphNeighborhoodDepth,
                        focusMode: value !== 'full',
                      }))}
                    >
                      <SelectTrigger className="h-8 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">{t('mapsPage.fullGraph')}</SelectItem>
                        <SelectItem value="1">{t('mapsPage.oneHopNeighbors')}</SelectItem>
                        <SelectItem value="2">{t('mapsPage.twoHopNeighbors')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <MapsToolbarIconButton
            label={t('mapsPage.newMap')}
            tooltipSide="bottom"
            onClick={onOpenCreateMapDialog}
            variant="outline"
            data-tour-id="maps-new-view"
          >
            <Plus className="h-4 w-4" />
          </MapsToolbarIconButton>
          {activeGraphView ? (
            <MapsToolbarIconButton
              label={t('mapsPage.saveCurrentView')}
              tooltipSide="bottom"
              variant="outline"
              onClick={onPersistActiveViewSnapshot}
            >
              <Save className="h-4 w-4" />
            </MapsToolbarIconButton>
          ) : null}
          <MapsToolbarIconButton
            label={activeGraphView ? t('mapsPage.saveAsNewView') : t('mapsPage.saveView')}
            tooltipSide="bottom"
            variant="outline"
            onClick={onOpenSaveViewDialog}
            data-tour-id="maps-save-as-view"
          >
            <SaveAll className="h-4 w-4" />
          </MapsToolbarIconButton>
          <MapsToolbarIconButton
            label={t('mapsPage.rebuildLayout')}
            tooltipSide="bottom"
            variant="outline"
            onClick={onReheatLayout}
            disabled={isReheatingLayout || visibleDocumentsCount === 0}
            data-tour-id="maps-rebuild-layout"
          >
            <WandSparkles className={cn('h-4 w-4', isReheatingLayout && 'animate-pulse')} />
          </MapsToolbarIconButton>
          <MapsToolbarIconButton
            label={t('mapsPage.refreshReferences')}
            tooltipSide="bottom"
            variant="outline"
            onClick={onRefreshWorkReferences}
            disabled={isRefreshingWorkReferences}
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshingWorkReferences && 'animate-spin')} />
          </MapsToolbarIconButton>
          <MapsToolbarIconButton
            label={t('mapsPage.deleteMap')}
            tooltipSide="bottom"
            variant="outline"
            className="text-rose-600 hover:text-rose-700"
            onClick={onDeleteWorkspace}
            disabled={!activeGraphView}
            data-tour-id="maps-delete-map"
          >
            <Trash2 className="h-4 w-4" />
          </MapsToolbarIconButton>
        </>
      )}
    />
  )
}
