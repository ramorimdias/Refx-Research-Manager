'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { ReactFlowProvider } from 'reactflow'
import { Loader2, Telescope, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DiscoverEmptyState } from '@/components/refx/discover/discover-empty-state'
import { DiscoverTimeline } from '@/components/refx/discover/discover-timeline'
import { DiscoverLeftPane } from '@/components/refx/discover/discover-left-pane'
import { DiscoverRightPane } from '@/components/refx/discover/discover-right-pane'
import { DiscoverMap } from '@/components/refx/discover/discover-map'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { filterDiscoverItems } from '@/lib/services/discover-filter-service'
import { useDiscoverActions, useDiscoverStore } from '@/lib/stores/discover-store'
import { useT } from '@/lib/localization'
import { cn } from '@/lib/utils'

type DiscoverViewMode = 'home' | 'seed' | 'workspace'

function DiscoverPageContent() {
  const t = useT()
  const sourceWork = useDiscoverStore((state) => state.sourceWork)
  const activeJourney = useDiscoverStore((state) => state.activeJourney)
  const activeStepIndex = useDiscoverStore((state) => state.activeStepIndex)
  const selectedWorkId = useDiscoverStore((state) => state.selectedWorkId)
  const hoveredWorkId = useDiscoverStore((state) => state.hoveredWorkId)
  const savedJourneys = useDiscoverStore((state) => state.savedJourneys)
  const isLoading = useDiscoverStore((state) => state.isLoading)
  const error = useDiscoverStore((state) => state.error)
  const {
    resetDiscoverSession,
    openStep,
    saveCurrentJourney,
    deleteSavedJourney,
    loadSavedJourney,
    setSelectedWork,
  } = useDiscoverActions()
  const [journeyName, setJourneyName] = useState('')
  const [viewMode, setViewMode] = useState<DiscoverViewMode>('home')
  const [saveFeedbackVisible, setSaveFeedbackVisible] = useState(false)
  const [journeyPendingDeleteId, setJourneyPendingDeleteId] = useState<string | null>(null)
  const saveFeedbackTimeoutRef = useRef<number | null>(null)

  const currentStep = activeStepIndex >= 0 ? activeJourney?.steps[activeStepIndex] ?? null : null
  const starredItems = useMemo(() => {
    if (!activeJourney) return []
    const seen = new Map<string, typeof activeJourney.steps[number]['items'][number]>()
    for (const step of activeJourney.steps) {
      for (const item of step.items) {
        if (item.isStarred) seen.set(item.id, item)
      }
      if (step.sourceWork.isStarred) seen.set(step.sourceWork.id, step.sourceWork)
    }
    return Array.from(seen.values())
  }, [activeJourney])
  const starredLinks = useMemo(() => {
    if (!activeJourney) return []

    const starredIds = new Set(starredItems.map((item) => item.id))
    if (sourceWork?.isStarred) starredIds.add(sourceWork.id)

    const seen = new Set<string>()
    const links: Array<{ sourceId: string; targetId: string }> = []

    for (const step of activeJourney.steps) {
      const sourceId = step.sourceWork.id
      if (!starredIds.has(sourceId)) continue

      for (const item of step.items) {
        if (!starredIds.has(item.id) || item.id === sourceId) continue

        const key = `${sourceId}:${item.id}`
        if (seen.has(key)) continue
        seen.add(key)
        links.push({ sourceId, targetId: item.id })
      }
    }

    return links
  }, [activeJourney, sourceWork?.id, sourceWork?.isStarred, starredItems])

  const currentItems = useMemo(() => {
    if (activeStepIndex === -1) return starredItems
    if (!currentStep) return []
    return filterDiscoverItems(currentStep.items, currentStep.filters)
  }, [activeStepIndex, currentStep, starredItems])

  const selectedWork = useMemo(() => {
    const pool = [
      ...(sourceWork ? [sourceWork] : []),
      ...(activeJourney?.steps.flatMap((step) => [step.sourceWork, ...step.items]) ?? []),
      ...starredItems,
    ]
    return pool.find((item) => item.id === selectedWorkId) ?? sourceWork ?? null
  }, [activeJourney?.steps, selectedWorkId, sourceWork, starredItems])
  const showStepFilters = Boolean(
    currentStep
    && selectedWork
    && selectedWork.id === currentStep.sourceWork.id,
  )
  const showFilterHint = Boolean(currentStep && currentStep.items.length > 50)
  const isSavedJourney = Boolean(activeJourney && savedJourneys.some((journey) => journey.id === activeJourney.id))

  const focusCurrentStepFilters = () => {
    if (!currentStep) return
    setSelectedWork(currentStep.sourceWork.id)
    window.setTimeout(() => {
      document.getElementById('discover-step-filters')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 40)
  }

  const leftPaneLabel = activeStepIndex === -1
    ? <span>{t('discoverPage.starredWorks')}</span>
    : currentStep
      ? (
        <span>
          <span
            className={cn(
              'font-bold',
              currentStep.mode === 'references' ? 'text-sky-600' : 'text-rose-600',
            )}
          >
            {currentStep.mode === 'references' ? 'References' : 'Citations'}
          </span>
          <span className="text-muted-foreground"> of </span>
          <span className="font-bold text-amber-500">
            {currentStep.sourceWork.firstAuthorLabel}
            {currentStep.sourceWork.year ? `, ${currentStep.sourceWork.year}` : ''}
          </span>
        </span>
      )
      : <span>{t('discoverPage.currentStep')}</span>

  useEffect(() => {
    return () => {
      if (saveFeedbackTimeoutRef.current != null) {
        window.clearTimeout(saveFeedbackTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    setJourneyName(activeJourney?.name ?? '')
  }, [activeJourney?.id, activeJourney?.name])

  const handleSaveJourney = () => {
    const fallbackLabel = sourceWork?.firstAuthorLabel
      ?? activeJourney?.steps[0]?.sourceWork.firstAuthorLabel
      ?? 'Discovery'
    const savedName = journeyName || `${fallbackLabel} journey`
    saveCurrentJourney(savedName)
    setSaveFeedbackVisible(true)
    if (saveFeedbackTimeoutRef.current != null) {
      window.clearTimeout(saveFeedbackTimeoutRef.current)
    }
    saveFeedbackTimeoutRef.current = window.setTimeout(() => {
      setSaveFeedbackVisible(false)
    }, 1800)
    toast.success(t('discoverPage.saveJourney'), {
      description: isSavedJourney
        ? `"${savedName}" updated.`
        : `"${savedName}" saved to your journeys.`,
    })
  }

  const handleDeleteJourney = (journeyId: string) => {
    deleteSavedJourney(journeyId)
    setJourneyPendingDeleteId((current) => (current === journeyId ? null : current))
  }

  if (viewMode === 'home') {
    return (
      <div className="relative mx-auto flex h-full max-w-6xl min-h-0 flex-col gap-6 overflow-hidden p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('discoverPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('discoverPage.subtitle')}</p>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="min-h-0 rounded-[28px] p-6">
            <div className="flex h-full flex-col gap-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Telescope className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-lg font-semibold">{t('discoverPage.continueCurrentJourney')}</div>
                  <div className="text-sm text-muted-foreground">{t('discoverPage.continueCurrentJourneyDescription')}</div>
                </div>
              </div>

              {activeJourney ? (
                <div className="rounded-2xl border bg-background/70 p-4">
                  <div className="font-medium">{activeJourney.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {t('discoverPage.stepCount', { count: activeJourney.steps.length })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('discoverPage.noCurrentJourney')}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setViewMode(activeJourney ? 'workspace' : 'seed')}
                  disabled={!activeJourney && !sourceWork}
                >
                  {t('discoverPage.continue')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetDiscoverSession()
                    setJourneyName('')
                    setViewMode('seed')
                  }}
                >
                  {t('discoverPage.startNewJourney')}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="min-h-0 rounded-[28px] p-6">
            <div className="flex h-full min-h-0 flex-col space-y-4 overflow-hidden">
              <div>
                <div className="text-lg font-semibold">{t('discoverPage.savedJourneys')}</div>
                <div className="text-sm text-muted-foreground">{t('discoverPage.savedJourneysDescription')}</div>
              </div>
              <div className="min-h-0 space-y-2 overflow-y-auto">
                {savedJourneys.length > 0 ? savedJourneys.map((journey) => (
                  <div
                    key={journey.id}
                    className="rounded-2xl border px-4 py-3 transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          loadSavedJourney(journey.id)
                          setViewMode('workspace')
                        }}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="font-medium">{journey.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {t('discoverPage.stepCount', { count: journey.steps.length })}
                        </div>
                      </button>
                      {journeyPendingDeleteId === journey.id ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setJourneyPendingDeleteId(null)}
                          >
                            {t('referencesPage.cancel')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-red-600 text-white hover:bg-red-700"
                            onClick={() => handleDeleteJourney(journey.id)}
                          >
                            {t('mapsPage.delete')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setJourneyPendingDeleteId(journey.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('discoverPage.noSavedJourneys')}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {isLoading ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/55 backdrop-blur-sm">
            <div className="rounded-2xl border bg-card px-5 py-4 shadow-lg">
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('discoverPage.loading')}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (viewMode === 'seed' && !sourceWork) {
    return <DiscoverEmptyState />
  }

  if (viewMode === 'seed' && sourceWork && !activeJourney) {
    return (
      <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t('discoverPage.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('discoverPage.seedPreviewDescription')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setViewMode('home')}>
              {t('discoverPage.backToHome')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                resetDiscoverSession()
                setViewMode('seed')
              }}
            >
              {t('discoverPage.chooseAnotherDocument')}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <Card className="rounded-[28px] p-4">
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{t('discoverPage.currentStep')}</div>
              <div className="text-lg font-semibold leading-tight">{t('discoverPage.seedReadyTitle')}</div>
              <div className="text-sm text-muted-foreground">{t('discoverPage.seedReadyDescription')}</div>
            </div>
          </Card>
          <Card className="flex min-h-[360px] items-center justify-center rounded-[28px] border-dashed p-6 text-center text-sm text-muted-foreground">
            {t('discoverPage.seedPreviewMapPlaceholder')}
          </Card>
          <DiscoverRightPane work={sourceWork} />
        </div>

        {isLoading ? (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/55 backdrop-blur-sm">
            <div className="rounded-2xl border bg-card px-5 py-4 shadow-lg">
              <div className="flex items-center gap-3 text-sm font-medium text-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('discoverPage.loading')}</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    )
  }

  if (!sourceWork) {
    return <DiscoverEmptyState />
  }

  return (
      <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('discoverPage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('discoverPage.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setViewMode('home')}>
            {t('discoverPage.backToHome')}
          </Button>
          <Input
            value={journeyName}
            onChange={(event) => setJourneyName(event.target.value)}
            placeholder={isSavedJourney ? activeJourney?.name ?? t('discoverPage.saveJourneyPlaceholder') : t('discoverPage.saveJourneyPlaceholder')}
            className="w-56"
          />
          <Button
            onClick={handleSaveJourney}
            className={cn(
              'transition-all',
              saveFeedbackVisible && 'bg-emerald-600 text-white hover:bg-emerald-600',
            )}
          >
            {saveFeedbackVisible ? 'Saved' : isSavedJourney ? 'Change name' : t('discoverPage.saveJourney')}
          </Button>
        </div>
      </div>

      {activeJourney ? (
        <DiscoverTimeline journey={activeJourney} activeStepIndex={activeStepIndex} onOpenStep={openStep} />
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        <DiscoverLeftPane
          label={leftPaneLabel}
          step={currentStep}
          items={currentItems}
          showFilterHint={showFilterHint}
          onFilterHintClick={focusCurrentStepFilters}
        />
        <div className="min-h-0 overflow-hidden">
          <DiscoverMap
            sourceWork={activeStepIndex === -1 ? sourceWork : currentStep?.sourceWork ?? sourceWork}
            items={currentItems}
            selectedWorkId={selectedWorkId}
            hoveredWorkId={hoveredWorkId}
            mode={activeStepIndex === -1 ? 'starred' : currentStep?.mode}
            starredLinks={activeStepIndex === -1 ? starredLinks : []}
          />
        </div>
        <DiscoverRightPane
          work={selectedWork}
          showStepFilters={showStepFilters}
          filters={currentStep?.filters ?? {}}
          currentMode={currentStep?.mode ?? null}
        />
      </div>

      {isLoading ? (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/55 backdrop-blur-sm">
          <div className="rounded-2xl border bg-card px-5 py-4 shadow-lg">
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('discoverPage.loading')}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function DiscoverPage() {
  return (
    <ReactFlowProvider>
      <DiscoverPageContent />
    </ReactFlowProvider>
  )
}
