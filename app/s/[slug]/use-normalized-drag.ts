'use client'

import { useCallback, useRef, useState } from 'react'

/**
 * Drag anything to a normalized (-1..1) position inside a container.
 *
 * Raw pointer events rather than @dnd-kit: that library models sortable lists
 * and droppable targets, and free 2-D placement has neither. Using it would
 * mean taking a pixel delta from it and then doing the rect maths, clamping and
 * normalization by hand anyway — which is the entire job. `setPointerCapture`
 * also covers mouse, touch and pen in one path and keeps tracking when the
 * pointer leaves the plot, which happens constantly when dragging to an edge.
 *
 * Movement reports through `onMove` (write to local state); the document is
 * written once, from `onCommit`. Writing on every frame would hammer the
 * autosave and trip its 409 conflict latch, which locks the editor.
 */

export interface NormalizedDragOptions {
  plotRef: React.RefObject<HTMLElement | null>
  onMove: (x: number, y: number) => void
  onCommit: (x: number, y: number) => void
  /** Quantization. Invisible to the eye, and it stops the document differing
   *  on every sub-pixel move. */
  step?: number
  disabled?: boolean
}

const quantize = (v: number, step: number) => Math.round(v / step) * step
const clamp = (v: number) => Math.min(1, Math.max(-1, v))

export function useNormalizedDrag({ plotRef, onMove, onCommit, step = 0.02, disabled }: NormalizedDragOptions) {
  const [dragging, setDragging] = useState(false)
  const rect = useRef<DOMRect | null>(null)
  const latest = useRef<{ x: number; y: number } | null>(null)
  const frame = useRef(0)

  const toNormalized = useCallback((clientX: number, clientY: number) => {
    const r = rect.current
    if (!r || r.width === 0 || r.height === 0) return { x: 0, y: 0 }
    return {
      x: clamp(quantize(((clientX - r.left) / r.width) * 2 - 1, step)),
      // Screen y grows downward; the model's y grows upward, so the axes read
      // the way anyone would draw them.
      y: clamp(quantize(1 - ((clientY - r.top) / r.height) * 2, step)),
    }
  }, [step])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    // Read the rect once, here. The element carries touch-action:none and we
    // preventDefault, so the page cannot scroll mid-gesture and the rect cannot
    // move — re-reading it per move would force layout on every frame.
    rect.current = plotRef.current?.getBoundingClientRect() ?? null
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    setDragging(true)
    const p = toNormalized(e.clientX, e.clientY)
    latest.current = p
    onMove(p.x, p.y)
  }, [disabled, plotRef, toNormalized, onMove])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    const p = toNormalized(e.clientX, e.clientY)
    latest.current = p
    // Coalesce to one update per frame, like the deck's parallax handler.
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (latest.current) onMove(latest.current.x, latest.current.y)
    })
  }, [dragging, toNormalized, onMove])

  const end = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    setDragging(false)
    if (frame.current) { cancelAnimationFrame(frame.current); frame.current = 0 }
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* already released */ }
    const p = latest.current
    latest.current = null
    if (p) onCommit(p.x, p.y)
  }, [dragging, onCommit])

  return {
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
    },
  }
}
