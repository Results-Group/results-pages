'use client'

import { useEffect, useState, type RefObject } from 'react'
import { scrollCueState, type ScrollCueState } from '@/lib/deck-scroll-cue'

/**
 * Phone-only pill above the footer nav: "Ad 1 of 2 · more below ↓". Tapping
 * it scrolls the next creative into view; it disappears once the last one is
 * reached. Desktop never renders it (CSS), the pair sits side by side there.
 * Threshold logic lives in lib/deck-scroll-cue.ts.
 */
export default function MoreBelowCue({ gridRef, count, label }: {
  gridRef: RefObject<HTMLDivElement | null>
  count: number
  label: (reached: number) => string
}) {
  const [state, setState] = useState<ScrollCueState>({ reached: 0, showCue: false, nextIndex: null })

  useEffect(() => {
    const cards = () => Array.from(gridRef.current?.children ?? []) as HTMLElement[]
    let raf = 0
    const measure = () => {
      raf = 0
      const next = scrollCueState(cards().map(el => el.getBoundingClientRect().top), window.innerHeight)
      setState(prev => (prev.reached === next.reached && prev.showCue === next.showCue ? prev : next))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Mockup images load lazily, so the cards grow after mount — re-measure.
    const ro = typeof ResizeObserver !== 'undefined' && gridRef.current ? new ResizeObserver(schedule) : null
    if (ro && gridRef.current) ro.observe(gridRef.current)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      ro?.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [gridRef, count])

  if (!state.showCue) return null

  const jump = () => {
    const el = gridRef.current?.children[state.nextIndex ?? 0] as HTMLElement | undefined
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // 72px clears the sticky header so the card's top is not hidden under it.
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 72, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <button type="button" className="more-below-cue" onClick={jump} aria-live="polite">
      <span>{label(state.reached)}</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}
