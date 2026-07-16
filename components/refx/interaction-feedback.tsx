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
      const diameter = Math.max(bounds.width, bounds.height) * 1.7
      const ripple = document.createElement('span')
      ripple.className = 'refx-press-ripple'
      ripple.style.width = `${diameter}px`
      ripple.style.height = `${diameter}px`
      ripple.style.left = `${event.clientX - bounds.left - diameter / 2}px`
      ripple.style.top = `${event.clientY - bounds.top - diameter / 2}px`
      target.classList.add('refx-press-target')
      if (window.getComputedStyle(target).position === 'static') target.classList.add('refx-press-relative')
      target.appendChild(ripple)
      ripple.addEventListener('animationend', () => {
        ripple.remove()
        if (!target.querySelector('.refx-press-ripple')) {
          target.classList.remove('refx-press-target', 'refx-press-relative')
        }
      }, { once: true })
    }

    document.addEventListener('pointerdown', handlePointerDown, { passive: true })
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  return null
}
