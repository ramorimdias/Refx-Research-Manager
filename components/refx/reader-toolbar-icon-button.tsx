'use client'

import { forwardRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const ReaderToolbarIconButton = forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button> & { label: string }
>(({ label, children, className, ...props }, ref) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          ref={ref}
          variant="ghost"
          size="icon"
          aria-label={label}
          className={cn(
            'h-8 w-8 rounded-full border border-transparent text-muted-foreground hover:border-border/70 hover:bg-muted/70 hover:text-foreground',
            className,
          )}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
})

ReaderToolbarIconButton.displayName = 'ReaderToolbarIconButton'
