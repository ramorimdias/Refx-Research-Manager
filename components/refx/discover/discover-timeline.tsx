'use client'

import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiscoverJourney } from '@/lib/types'

export function DiscoverTimeline({
  journey,
  activeStepIndex,
  onOpenStep,
}: {
  journey: DiscoverJourney
  activeStepIndex: number
  onOpenStep: (index: number) => void
}) {
  return (
    <div className="flex items-center gap-3 overflow-auto rounded-2xl border bg-background/90 px-4 py-3">
      <button
        type="button"
        onClick={() => onOpenStep(-1)}
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition',
          activeStepIndex === -1 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/40',
        )}
      >
        <Star className="h-4 w-4" />
      </button>
      {journey.steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-3">
          <div className="h-px w-10 bg-border" />
          <button
            type="button"
            onClick={() => onOpenStep(index)}
            className={cn(
              'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border px-3 text-sm font-semibold transition',
              activeStepIndex === index ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/40',
            )}
          >
            {index + 1}
          </button>
        </div>
      ))}
    </div>
  )
}
