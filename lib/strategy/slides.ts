import { isUnknownSection } from './normalize'
import type { AnySection, StrategyDocMeta } from './types'

/**
 * Derives the slides a client sees from the stored sections.
 *
 * `buildStrategySlides` and `countStrategySlides` live in the same file on
 * purpose: in the campaign builder the equivalent pair drifted apart twice, and
 * the editor's slide counter quietly lied to the operator about what the client
 * would get. Keeping them adjacent — and asserting they agree, in
 * tests/strategy-slides.test.ts — is the fix.
 *
 * Unlike the campaign deck, a strategy section never spans several screens:
 * one section is exactly one slide. That removes the whole class of paging
 * bugs; if that ever changes, change it here and in the count together.
 */

export type StrategySlide =
  | { type: 'cover'; clientName: string; docName: string; logoUrl: string | null; date: string }
  | { type: 'section'; section: AnySection }
  | { type: 'closing'; clientName: string }

/** A section renders as a slide unless it is one this deploy cannot render. */
function isRenderable(section: AnySection): boolean {
  return !isUnknownSection(section)
}

export function countStrategySlides(sections: AnySection[]): number {
  return 1 + sections.filter(isRenderable).length + 1
}

export function buildStrategySlides(opts: {
  meta: StrategyDocMeta
  sections: AnySection[]
  /** Formatted by the caller — the cover's eyebrow line. */
  date: string
}): StrategySlide[] {
  const { meta, sections, date } = opts
  return [
    {
      type: 'cover',
      clientName: meta.client,
      docName: meta.docName,
      logoUrl: meta.logoUrl,
      date,
    },
    ...sections.filter(isRenderable).map(section => ({ type: 'section' as const, section })),
    { type: 'closing', clientName: meta.client },
  ]
}
