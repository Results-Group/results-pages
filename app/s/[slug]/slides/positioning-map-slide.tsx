'use client'

import { useRef, useState } from 'react'
import { assetProxyUrl } from '@/lib/asset-url'
import type { PositioningMapSection, MapPoint } from '@/lib/strategy/types'
import { useNormalizedDrag } from '../use-normalized-drag'
import { EmptyHint, SlideHeader, type SlideProps } from './index'

/**
 * The market positioning map: competitor logos placed on two axes, with an
 * optional highlight ring over the gap the brand should own.
 *
 * Coordinates are normalized -1..1 with the origin at the centre, and the plot
 * has a locked aspect ratio. Both matter: the axes cross in the middle, so 0
 * has to mean "on the axis" at any size, and a pixel coordinate saved on a
 * 1440px screen would land off-canvas on a laptop.
 *
 * Positioning is percentage-based CSS, so the read-only render needs no
 * JavaScript at all — the drag handlers only exist when `edit` is passed.
 */

/** -1..1 → a CSS percentage inside the plot. */
const toLeft = (x: number) => `${((x + 1) / 2) * 100}%`
const toTop = (y: number) => `${((1 - y) / 2) * 100}%`

function Mark({
  point, index, edit, onDragMove, onDragCommit, plotRef,
}: {
  point: MapPoint
  index: number
  edit?: SlideProps['edit']
  onDragMove: (id: string, x: number, y: number) => void
  onDragCommit: (id: string, x: number, y: number) => void
  plotRef: React.RefObject<HTMLDivElement | null>
}) {
  const { dragging, handlers } = useNormalizedDrag({
    plotRef,
    onMove: (x, y) => onDragMove(point.id, x, y),
    onCommit: (x, y) => onDragCommit(point.id, x, y),
    disabled: !edit,
  })

  const src = point.logo?.file_path ? assetProxyUrl(point.logo.file_path) : ''

  // Arrow keys nudge; the Inspector's numeric fields are the precise route and
  // the accessible one. Without this the deck's own arrow handler would fire
  // and change slide — hence data-deck-keys="off" on the plot.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!edit) return
    const stepSize = e.shiftKey ? 0.1 : 0.02
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-stepSize, 0], ArrowRight: [stepSize, 0],
      ArrowUp: [0, stepSize], ArrowDown: [0, -stepSize],
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    e.stopPropagation()
    onDragCommit(
      point.id,
      Math.min(1, Math.max(-1, point.x + move[0])),
      Math.min(1, Math.max(-1, point.y + move[1])),
    )
  }

  return (
    <div
      className="pos-map-mark"
      style={{
        left: toLeft(point.x),
        top: toTop(point.y),
        ...(edit ? { cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' } : {}),
      }}
      {...(edit ? handlers : {})}
      {...(edit ? { tabIndex: 0, role: 'button', onKeyDown } : {})}
      aria-label={edit
        ? `${point.label} — אופקי ${Math.round(((point.x + 1) / 2) * 100)}%, אנכי ${Math.round(((point.y + 1) / 2) * 100)}%`
        : undefined}
    >
      {src
        // eslint-disable-next-line @next/next/no-img-element -- same-origin proxy
        ? <img src={src} alt={point.label} draggable={false} />
        : <span className="pos-map-dot" aria-hidden="true" />}
      <span className="pos-map-mark-label">{point.label || `#${index + 1}`}</span>
      {/* Mobile only: the labels are hidden there, so this is what ties a mark
          to its entry in the legend below. */}
      <span className="pos-map-mark-num" aria-hidden="true">{index + 1}</span>
    </div>
  )
}

export default function PositioningMapSlide({ section, edit }: SlideProps<PositioningMapSection>) {
  const plotRef = useRef<HTMLDivElement>(null)
  // Live drag position, so a gesture never writes to the document per frame.
  const [preview, setPreview] = useState<Record<string, { x: number; y: number }>>({})

  const points = section.points.map(p => ({ ...p, ...(preview[p.id] ?? {}) }))

  const onDragMove = (id: string, x: number, y: number) =>
    setPreview(prev => ({ ...prev, [id]: { x, y } }))

  const onDragCommit = (id: string, x: number, y: number) => {
    setPreview(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    edit?.onChange({ points: section.points.map(p => (p.id === id ? { ...p, x, y } : p)) })
  }

  return (
    <div className="pos-map">
      <SlideHeader title={section.title} subtitle={section.subtitle} />

      {points.length === 0 && <EmptyHint edit={edit}>העלו לוגואים של מתחרים ומקמו אותם על המפה</EmptyHint>}

      <div
        className="pos-map-plot rp-anim rp-up rp-d3"
        // The deck's global arrow handler must not steal the keys a focused
        // mark uses to nudge itself.
        data-deck-keys={edit ? 'off' : undefined}
        data-swipe={edit ? 'off' : undefined}
      >
        {/* `start` is the end a Hebrew reader meets first: the right edge, the bottom. */}
        {section.axisX.startLabel ? <span className="pos-map-label at-right">{section.axisX.startLabel}</span> : null}
        {section.axisX.endLabel ? <span className="pos-map-label at-left">{section.axisX.endLabel}</span> : null}
        {section.axisY.startLabel ? <span className="pos-map-label at-bottom">{section.axisY.startLabel}</span> : null}
        {section.axisY.endLabel ? <span className="pos-map-label at-top">{section.axisY.endLabel}</span> : null}

        {/* The coordinate space is this inset layer, not the framed plot — see
            the note on .pos-map-field. The drag hook measures it too. */}
        <div className="pos-map-field" ref={plotRef}>
        <div className="pos-map-axis-x" />
        <div className="pos-map-axis-y" />

        {section.zones.map(zone => (
          <div
            key={zone.id}
            className="pos-map-zone"
            style={{
              left: toLeft(zone.cx),
              top: toTop(zone.cy),
              ['--zone-r' as string]: zone.r,
            }}
            aria-hidden="true"
          />
        ))}

        {points.map((point, i) => (
          <Mark
            key={point.id}
            point={point}
            index={i}
            edit={edit}
            plotRef={plotRef}
            onDragMove={onDragMove}
            onDragCommit={onDragCommit}
          />
        ))}
        </div>
      </div>

      {/* Below 768px the on-plot labels are hidden — six of them collide into
          mush — and this numbered list carries the names instead. */}
      {points.length > 0 && (
        <ol className="pos-map-legend">
          {points.map((point, i) => (
            <li key={point.id}>
              <span className="pos-map-legend-num">{i + 1}</span>
              <span>{point.label || `#${i + 1}`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
