'use client'

import '../positioning-slides.css'
import type { AnySection, SectionKind, SectionOfKind } from '@/lib/strategy/types'
import StatementSlide from './statement-slide'
import InfoSlide from './info-slide'
import MatrixTableSlide from './matrix-table-slide'
import BoxesSlide from './boxes-slide'
import PositioningMapSlide from './positioning-map-slide'
import QuestionSlide from './question-slide'
import SplitMediaSlide from './split-media-slide'
import BrandLanguageSlide from './brand-language-slide'
import HeatGaugesSlide from './heat-gauges-slide'

/**
 * The renderer for each section kind.
 *
 * Every component takes `{ section, edit? }` — one component, not a read-only
 * one and an editing one. The admin canvas renders these same components with
 * `edit` supplied, so the preview is provably what the client sees rather than
 * a second implementation that can drift. The campaign builder's split
 * rendering logic broke exactly that way, twice.
 *
 * The Record is typed against SectionKind, so adding a kind to the union makes
 * this file fail to compile until its renderer exists.
 */

export interface SlideProps<S extends AnySection = AnySection> {
  section: S
  /** Present only in the admin canvas. Its presence switches on editing affordances. */
  edit?: EditHandlers
}

export interface EditHandlers {
  /** Patch the section being rendered. Called on commit, not on every frame. */
  onChange: (patch: Record<string, unknown>) => void
  /** Continuous gestures call this while dragging and onChange on release. */
  onPreview?: (patch: Record<string, unknown>) => void
  selectedId?: string | null
  onSelect?: (id: string | null) => void
}

/**
 * Each entry is typed against its own section, so a renderer cannot be filed
 * under the wrong kind — and adding a kind to the union makes this object fail
 * to compile until its renderer exists.
 */
type SlideComponents = { [K in SectionKind]: React.ComponentType<SlideProps<SectionOfKind<K>>> }

export const SLIDE_RENDERERS: SlideComponents = {
  statement: StatementSlide,
  info: InfoSlide,
  matrix_table: MatrixTableSlide,
  boxes: BoxesSlide,
  positioning_map: PositioningMapSlide,
  question: QuestionSlide,
  split_media: SplitMediaSlide,
  brand_language: BrandLanguageSlide,
  heat_gauges: HeatGaugesSlide,
}

/** Renders one section, or nothing if this deploy has no renderer for it. */
export function SectionSlide({ section, edit }: SlideProps) {
  if (section.kind === '__unknown__') return null
  // One cast, in one place: the map is exhaustively typed per kind above, but
  // TypeScript can't correlate the key with the value at a dynamic lookup.
  const Renderer = SLIDE_RENDERERS[section.kind] as React.ComponentType<SlideProps>
  return Renderer ? <Renderer section={section} edit={edit} /> : null
}

/** Shared title + subtitle header. Every slide type uses it. */
export function SlideHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <>
      {title ? <h2 className="slide-title rp-anim rp-in rp-d1">{title}</h2> : null}
      {subtitle ? <p className="pos-sub rp-anim rp-up rp-d2">{subtitle}</p> : null}
    </>
  )
}

/**
 * Placeholder for content the operator hasn't filled in.
 *
 * The read-only renderer drops empty content; the editor must not, or the
 * operator sees a blank canvas and assumes the slide is broken. This is the
 * one place the editing view legitimately differs from the client's.
 */
export function EmptyHint({ edit, children }: { edit?: EditHandlers; children: React.ReactNode }) {
  if (!edit) return null
  return <p className="pos-empty">{children}</p>
}
