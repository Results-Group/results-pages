import { describe, it, expect } from 'vitest'
import { readableAccent, contrastRatio, luminance, parseHex, DECK_BACKGROUND } from '@/lib/brand-color'

describe('parseHex', () => {
  it('accepts both shorthand and full hex, with or without the hash', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 })
    expect(parseHex('40e1d3')).toEqual({ r: 64, g: 225, b: 211 })
  })

  it('rejects anything else rather than guessing', () => {
    expect(parseHex('not-a-colour')).toBeNull()
    expect(parseHex('#12345')).toBeNull()
    expect(parseHex('')).toBeNull()
  })
})

describe('contrastRatio', () => {
  it('spans the WCAG range', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5)
  })

  it('rates the default brand colour as legible on the deck', () => {
    expect(contrastRatio('#40e1d3', DECK_BACKGROUND)).toBeGreaterThan(4.5)
  })
})

describe('readableAccent', () => {
  it('leaves an already-legible colour untouched', () => {
    expect(readableAccent('#40e1d3')).toBe('#40e1d3')
  })

  it('turns a black brand into a near-white accent — the Sergio case', () => {
    const accent = readableAccent('#000000') as string
    expect(contrastRatio(accent, DECK_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
    // Near-white, not a mid grey that would read as a rendering fault
    expect(luminance(accent)).toBeGreaterThan(0.7)
  })

  it('treats any near-greyscale brand the same way', () => {
    for (const grey of ['#000000', '#111111', '#2b2b2d']) {
      expect(contrastRatio(readableAccent(grey) as string, DECK_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the hue of a merely dark colour while making it legible', () => {
    // Deep navy: should stay blue, not become grey or the default cyan.
    const accent = readableAccent('#001a4d') as string
    const rgb = parseHex(accent)!
    expect(rgb.b).toBeGreaterThan(rgb.r)
    expect(contrastRatio(accent, DECK_BACKGROUND)).toBeGreaterThanOrEqual(4.5)
  })

  it('respects a different background', () => {
    const onReport = readableAccent('#000000', '#050505') as string
    expect(contrastRatio(onReport, '#050505')).toBeGreaterThanOrEqual(4.5)
  })

  it('returns null for missing or malformed values so callers fall back', () => {
    expect(readableAccent(null)).toBeNull()
    expect(readableAccent(undefined)).toBeNull()
    expect(readableAccent('rgb(0,0,0)')).toBeNull()
  })
})
