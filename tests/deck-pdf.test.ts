import { describe, it, expect } from 'vitest'
import {
  deckExportAccess, deckPdfFingerprint, deckPdfPath, isDeckPdfCachePath,
  deckPdfFileName, pdfContentDisposition, printPageCss,
} from '@/lib/deck-pdf'
import { remainingHeight } from '@/lib/deck-viewport'
import { fileNameFromDisposition } from '@/lib/deck-pdf-client'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const live = { status: 'published', publishAt: null, expiresAt: null, hasPassword: false, staff: false, accessTokenValid: false, now: NOW }

describe('who may export a deck as PDF', () => {
  it('anyone, for a published deck without a password', () => {
    expect(deckExportAccess(live)).toEqual({ ok: true, staff: false })
  })

  it('staff, even a draft, a scheduled or an expired deck', () => {
    for (const over of [{ status: 'draft' }, { publishAt: '2026-11-01T00:00:00Z' }, { expiresAt: '2026-10-01T00:00:00Z' }, { status: 'archived' }]) {
      expect(deckExportAccess({ ...live, ...over, staff: true })).toEqual({ ok: true, staff: true })
    }
  })

  it('nobody else for a deck that is not live — as a 404, with no hint it exists', () => {
    for (const over of [{ status: 'draft' }, { status: 'archived' }, { publishAt: '2026-11-01T00:00:00Z' }, { expiresAt: '2026-10-01T00:00:00Z' }]) {
      const res = deckExportAccess({ ...live, ...over })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.status).toBe(404)
    }
  })

  it('a deck whose publish date has passed is live', () => {
    expect(deckExportAccess({ ...live, publishAt: '2026-10-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z' }).ok).toBe(true)
  })

  it('a password-protected deck only past its password gate', () => {
    const locked = deckExportAccess({ ...live, hasPassword: true })
    expect(locked.ok).toBe(false)
    if (!locked.ok) expect(locked.status).toBe(403)
    expect(deckExportAccess({ ...live, hasPassword: true, accessTokenValid: true })).toEqual({ ok: true, staff: false })
  })
})

describe('deck PDF cache key', () => {
  const base = { campaignId: 'c1', updatedAt: '2026-10-08T10:00:00Z', brandColor: '#ff0000', logoPath: 'campaigns/c1/logo.webp', snapshot: { a: '1', b: '2' }, commit: 'abc' }

  it('is stable, whatever order the slides were listed in', () => {
    expect(deckPdfFingerprint(base)).toBe(deckPdfFingerprint({ ...base, snapshot: { b: '2', a: '1' } }))
    expect(deckPdfFingerprint(base)).toMatch(/^[0-9a-f]{16}$/)
  })

  it('changes with anything the reader would see differently', () => {
    const fp = deckPdfFingerprint(base)
    for (const over of [
      { updatedAt: '2026-10-08T10:00:01Z' }, { brandColor: '#00ff00' }, { brandColor: null },
      { logoPath: 'campaigns/c1/other.webp' }, { snapshot: { a: '1', b: '3' } }, { commit: 'def' }, { campaignId: 'c2' },
    ]) {
      expect(deckPdfFingerprint({ ...base, ...over })).not.toBe(fp)
    }
  })

  it('lives flat in the campaign folder, so purging the campaign removes it', () => {
    const path = deckPdfPath('c1', deckPdfFingerprint(base))
    expect(path).toMatch(/^campaigns\/c1\/deck-[0-9a-f]{16}\.pdf$/)
    expect(isDeckPdfCachePath(path)).toBe(true)
  })

  it('is told apart from the campaign’s real files, which the backup keeps', () => {
    for (const p of ['campaigns/c1/logo.webp', 'campaigns/c1/deck-notes.pdf', 'campaigns/c1/sub/deck-0123456789abcdef.pdf', 'other/c1/deck-0123456789abcdef.pdf']) {
      expect(isDeckPdfCachePath(p)).toBe(false)
    }
  })
})

describe('deck PDF file name', () => {
  it('reads "Client - Campaign" in Hebrew, without characters a file name cannot hold', () => {
    expect(deckPdfFileName('פיצה האוס', 'קמפיין: סתיו/2026', 'pizza')).toBe('פיצה האוס - קמפיין סתיו2026.pdf')
  })

  it('falls back to the slug when nothing is left', () => {
    expect(deckPdfFileName('', '???', 'pizza-fall')).toBe('pizza-fall.pdf')
  })

  it('survives the round trip through Content-Disposition', () => {
    const name = deckPdfFileName('פיצה האוס', 'סתיו', 'pizza')
    const header = pdfContentDisposition(name, 'pizza')
    expect(header).toContain('filename="pizza.pdf"')
    expect(fileNameFromDisposition(header)).toBe(name)
  })

  it('reads a plain filename when there is no RFC 5987 one', () => {
    expect(fileNameFromDisposition('attachment; filename="deck.pdf"')).toBe('deck.pdf')
    expect(fileNameFromDisposition(null)).toBeNull()
  })
})

describe('printed pages', () => {
  it('give every slide a page of its own size — a taller slide a taller page', () => {
    const css = printPageCss(1600, [900, 1214.4])
    expect(css).toContain('@page slide-0{size:1600px 900px;margin:0}')
    // Rounded up: a page a fraction short spills the slide's last pixel row onto a page of its own.
    expect(css).toContain('@page slide-1{size:1600px 1215px;margin:0}')
  })

  it('paint the deck background behind the page edge', () => {
    expect(printPageCss(1600, [900])).toMatch(/html,body\{margin:0!important;padding:0!important;background:#090c0e\}/)
  })
})

describe('mockup height in a stacked deck', () => {
  it('on screen (slide at the top of the window) is the old formula', () => {
    // landing-page-mockup / reels used: innerHeight - el.top - reserve
    expect(remainingHeight({ viewportH: 900, elTop: 240, slideTop: 0, reserve: 96 })).toBe(900 - 240 - 96)
  })

  it('in the PDF render measures from its own slide, not the window', () => {
    // Slide 5 starts 3600px down the stacked page; its mockup 240px into it.
    expect(remainingHeight({ viewportH: 900, elTop: 3840, slideTop: 3600, reserve: 96 })).toBe(900 - 240 - 96)
  })
})
