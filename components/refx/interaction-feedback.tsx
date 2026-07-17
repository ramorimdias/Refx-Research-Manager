'use client'

import { useEffect } from 'react'

const PRESS_TARGETS = [
  'button:not(:disabled)',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
].join(',')

export function InteractionFeedback() {
  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const handlePointerDown = (event: PointerEvent) => {
      if (reducedMotion.matches || event.button !== 0) return
      const origin = event.target
      if (!(origin instanceof Element)) return
      const target = origin.closest<HTMLElement>(PRESS_TARGETS)
      if (!target) return

      const bounds = target.getBoundingClientRect()
      const radius = Math.hypot(
        Math.max(event.clientX - bounds.left, bounds.right - event.clientX),
        Math.max(event.clientY - bounds.top, bounds.bottom - event.clientY),
      )
      target.style.setProperty('--refx-ripple-x', `${event.clientX - bounds.left}px`)
      target.style.setProperty('--refx-ripple-y', `${event.clientY - bounds.top}px`)
      target.style.setProperty('--refx-ripple-max', `${radius}px`)
      if (window.getComputedStyle(target).position === 'static') {
        target.classList.add('refx-ripple-host')
      }
      target.classList.remove('refx-ripple-active')
      void target.offsetWidth
      target.classList.add('refx-ripple-active')
    }

    const clearRipple = (event: AnimationEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && event.animationName === 'refx-contained-ripple') {
        target.classList.remove('refx-ripple-active')
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true })
    document.addEventListener('animationend', clearRipple)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('animationend', clearRipple)
    }
  }, [])

  return null
}
