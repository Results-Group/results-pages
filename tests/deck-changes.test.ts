import { describe, it, expect } from 'vitest'
import { slideIdentity, slideFingerprint, deckSnapshot, changedSlides, parseSnapshot } from '@/lib/deck-changes'

const creative = (over: Record<string, unknown> = {}) => ({
  type: 'creatives', key: 'sec-1', title: 'פיד', mockupType: 'facebook_feed',
  copies: [{ label: 'א', body: 'קופי' }],
  assets: [{ type: 'image', file_path: 'campaigns/x/1.webp', caption: '' }],
  ...over,
})

describe('slideFingerprint', () => {
  it('ignores what changes on its own — dates, logo URLs, the client name', () => {
    const a = { ...creative(), date: 'ספטמבר 2026', logoUrl: '/api/asset/a?v=1', clientName: 'A' }
    const b = { ...creative(), date: 'אוקטובר 2026', logoUrl: '/api/asset/a?v=2', clientName: 'B' }
    expect(slideFingerprint(a)).toBe(slideFingerprint(b))
  })

  it('changes when a creative is replaced, the copy is edited, or the title changes', () => {
    const base = slideFingerprint(creative())
    expect(slideFingerprint(creative({ assets: [{ type: 'image', file_path: 'campaigns/x/2.webp', caption: '' }] }))).not.toBe(base)
    expect(slideFingerprint(creative({ copies: [{ label: 'א', body: 'קופי חדש' }] }))).not.toBe(base)
    expect(slideFingerprint(creative({ title: 'פיד — גרסה 2' }))).not.toBe(base)
  })

  it('does not depend on the order keys were written in', () => {
    expect(slideFingerprint({ type: 'stats', stats: { a: 1, b: 2 } })).toBe(slideFingerprint({ type: 'stats', stats: { b: 2, a: 1 } }))
  })
})

describe('slideIdentity', () => {
  it('uses the section id and the part, so parts of one section stay apart', () => {
    expect(slideIdentity(creative({ part: 2 }), 5)).toBe('creatives:sec-1#2')
    expect(slideIdentity({ type: 'cover' }, 0)).toBe('cover:cover#1')
  })
})

describe('changedSlides', () => {
  const v1 = deckSnapshot([{ type: 'cover', title: 'X' }, creative(), creative({ key: 'sec-2' })])

  it('marks nothing on a first visit', () => {
    expect(changedSlides(null, v1).size).toBe(0)
  })

  it('marks nothing when nothing changed', () => {
    expect(changedSlides(v1, v1).size).toBe(0)
  })

  it('marks an edited slide and a newly added one — nothing else', () => {
    const v2 = deckSnapshot([{ type: 'cover', title: 'X' }, creative({ title: 'שונה' }), creative({ key: 'sec-2' }), creative({ key: 'sec-3' })])
    expect([...changedSlides(v1, v2)].sort()).toEqual(['creatives:sec-1#1', 'creatives:sec-3#1'])
  })
})

describe('parseSnapshot', () => {
  it('reads what the deck stored and rejects anything else', () => {
    expect(parseSnapshot(JSON.stringify({ at: 'x', slides: { a: '1' } }))).toEqual({ a: '1' })
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('not json')).toBeNull()
    expect(parseSnapshot(JSON.stringify({ slides: ['a'] }))).toBeNull()
  })
})

import { buildUpdateMessage, whatsappUpdateUrl } from '@/lib/share'

describe('buildUpdateMessage', () => {
  it('names the campaign, points at the updated marks and ends with the link', () => {
    const msg = buildUpdateMessage({ title: 'סוכות', url: 'https://reports.resultsdigital.org/c/sukkot' })
    expect(msg.split('\n')).toEqual(['היי! עדכנו את "סוכות" — השקפים שהשתנו מסומנים ב"עודכן" 👇', '', 'https://reports.resultsdigital.org/c/sukkot'])
    expect(whatsappUpdateUrl({ title: 'סוכות', url: 'https://x/c/s' })).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })
})
