'use client'

import { useEffect, useRef, useState } from 'react'
import { SectionSlide } from '@/app/s/[slug]/slides'
import type { AnySection } from '@/lib/strategy/types'

/**
 * The editing canvas: the client's own slide component, scaled to fit the pane.
 *
 * Scaling rather than scrolling. These slides are laid out for a presentation
 * width, and a Facing table with four competitor columns simply doesn't fit a
 * 500px editor pane — rendered at natural size it was clipped, and the operator
 * couldn't see the slide they were building. A transform keeps the proportions
 * the client will see, which is the whole point of editing on the real
 * component instead of a stand-in.
 */

/** The width these slides are designed against — the deck's own content column. */
const DESIGN_WIDTH = 1100

export default function SlideCanvas({
  section,
  onChange,
}: {
  section: AnySection | null
  onChange: (patch: Record<string, unknown>) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const slideRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    const slide = slideRef.current
    if (!frame || !slide) return

    const measure = () => {
      const available = frame.clientWidth
      // Never scale up: a short slide blown up past its design size looks
      // broken rather than generous.
      const next = Math.min(1, available / DESIGN_WIDTH)
      setScale(next)
      // The scaled element still occupies its unscaled height in layout, so
      // the wrapper has to be told what the visual height actually is.
      setHeight(slide.offsetHeight * next)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(slide)
    return () => observer.disconnect()
  }, [section])

  if (!section) {
    return (
      <p className="p-8 text-sm text-center" style={{ color: 'var(--admin-text-muted)' }}>
        הוסיפו שקף כדי להתחיל
      </p>
    )
  }

  return (
    <div ref={frameRef} className="p-4">
      <div style={{ height: height || undefined, overflow: 'hidden' }}>
        <div
          ref={slideRef}
          style={{
            width: DESIGN_WIDTH,
            transform: `scale(${scale})`,
            transformOrigin: 'top right', // RTL: the slide grows from the right edge
          }}
        >
          <div className="campaign-pres pos-deck is-embedded" style={{ padding: '24px 28px' }}>
            <SectionSlide section={section} edit={{ onChange }} />
          </div>
        </div>
      </div>
    </div>
  )
}
