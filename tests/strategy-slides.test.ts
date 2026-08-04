import { describe, it, expect } from 'vitest'
import { buildStrategySlides, countStrategySlides } from '@/lib/strategy/slides'
import { normalizeSections } from '@/lib/strategy/normalize'
import { createBrandPositioningTemplate, TEMPLATE_SECTION_COUNT, SYSTEM_SLIDES } from '@/lib/strategy/template'
import { SECTION_KINDS } from '@/lib/strategy/registry'
import type { StrategyDocMeta } from '@/lib/strategy/types'

const meta: StrategyDocMeta = {
  client: 'לקוח לדוגמה',
  clientId: null,
  docName: 'מצגת מיצוב',
  logoPath: null,
  logoUrl: null,
  workspaceId: null,
}

const build = (sections: Parameters<typeof buildStrategySlides>[0]['sections']) =>
  buildStrategySlides({ meta, sections, date: 'July 20, 2026' })

/**
 * The counter and the builder must never disagree. In the campaign builder the
 * equivalent pair drifted twice, and the editor's badge quietly lied to the
 * operator about what the client would receive.
 */
describe('the slide count mirrors the built deck', () => {
  it('agrees on the full template', () => {
    const sections = createBrandPositioningTemplate()
    expect(countStrategySlides(sections)).toBe(build(sections).length)
  })

  it('agrees on an empty document', () => {
    expect(countStrategySlides([])).toBe(build([]).length)
  })

  it('agrees when a section this deploy cannot render is present', () => {
    const sections = normalizeSections([
      SECTION_KINDS.statement.create(),
      { kind: 'from_the_future', id: 'x' },
    ])
    expect(countStrategySlides(sections)).toBe(build(sections).length)
  })
})

describe('buildStrategySlides', () => {
  it('wraps the sections in a cover and a closing', () => {
    const slides = build(createBrandPositioningTemplate())
    expect(slides[0].type).toBe('cover')
    expect(slides[slides.length - 1].type).toBe('closing')
    expect(slides).toHaveLength(TEMPLATE_SECTION_COUNT + SYSTEM_SLIDES)
  })

  it('still produces a viewable deck with no sections at all', () => {
    const slides = build([])
    expect(slides.map(s => s.type)).toEqual(['cover', 'closing'])
  })

  it('carries the client branding onto the cover', () => {
    const slides = build([])
    expect(slides[0]).toMatchObject({ type: 'cover', clientName: 'לקוח לדוגמה', docName: 'מצגת מיצוב', date: 'July 20, 2026' })
  })

  it('one section is exactly one slide — no paging', () => {
    const sections = [SECTION_KINDS.info.create(), SECTION_KINDS.boxes.create()]
    expect(build(sections)).toHaveLength(2 + SYSTEM_SLIDES)
  })

  it('skips a section it cannot render rather than crashing the deck', () => {
    const sections = normalizeSections([{ kind: 'from_the_future', id: 'x' }])
    expect(build(sections).map(s => s.type)).toEqual(['cover', 'closing'])
  })

  it('keeps the sections in document order', () => {
    const sections = createBrandPositioningTemplate()
    const slides = build(sections)
    const rendered = slides.filter(s => s.type === 'section')
    expect(rendered.map(s => (s.type === 'section' ? s.section.id : ''))).toEqual(sections.map(s => s.id))
  })
})
