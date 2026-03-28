import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.985]",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(37,99,235,0.18)] hover:bg-primary/92',
        destructive:
          'bg-destructive text-white shadow-[0_8px_24px_rgba(220,38,38,0.16)] hover:bg-destructive/92 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border border-border/90 bg-background/92 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-muted hover:text-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary: 'bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-secondary/88',
        ghost:
          'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3.5',
        sm: 'h-9 gap-1.5 px-3.5 text-[13px] has-[>svg]:px-3',
        lg: 'h-11 px-6 text-sm has-[>svg]:px-4.5',
        icon: 'size-10',
        'icon-sm': 'size-9',
        'icon-lg': 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
