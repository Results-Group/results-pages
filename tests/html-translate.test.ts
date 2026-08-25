import { describe, it, expect } from 'vitest'
import { extractSegments, restoreSegments, flipDirection, chunkSegments } from '@/lib/html-translate'

const page = `<!DOCTYPE html><html lang="he" dir="rtl"><head>
<title>דוח שנתי | Twill</title>
<meta name="description" content="ניתוח מערך השיווק">
<style>.hero { text-align: right; direction: rtl; color: #fff; }</style>
</head><body>
<h1 class="big">תקציר מנהלים</h1>
<p>ההשקעה עמדה על ₪120,000 <b>וההחזר</b> היה 7.5x</p>
<img src="/x.png" alt="גרף ביצועים">
<div>plain english stays</div>
<script>const labels = ["ינואר", "פברואר", "March"]; const n = 42;</script>
</body></html>`

describe('extractSegments', () => {
  it('finds text nodes, attributes and script strings — not tags or CSS', () => {
    const { masked, segments } = extractSegments(page)
    expect(segments).toContain('דוח שנתי | Twill')
    expect(segments).toContain('תקציר מנהלים')
    expect(segments).toContain('ניתוח מערך השיווק')
    expect(segments).toContain('גרף ביצועים')
    expect(segments).toContain('ינואר')
    expect(segments).toContain('פברואר')
    // Hebrew-free content is never sent
    expect(segments).not.toContain('March')
    expect(segments.join()).not.toMatch(/plain english stays/)
    // No Hebrew survives in the masked document, and markup is intact
    expect(masked).not.toMatch(/[֐-׿]/)
    expect(masked).toContain('<h1 class="big">')
    expect(masked).toContain('text-align: right; direction: rtl')
    expect(masked).toContain('src="/x.png"')
  })

  it('mixed text keeps numbers inside the segment (model preserves them)', () => {
    const { segments } = extractSegments(page)
    const money = segments.find(s => s.includes('₪120,000'))
    expect(money).toBeTruthy()
  })

  it('bails on input already containing the token character', () => {
    expect(() => extractSegments('<p>⟦</p>')).toThrow()
  })
})

describe('restoreSegments', () => {
  it('identity round-trip returns the original byte-for-byte', () => {
    const { masked, segments } = extractSegments(page)
    expect(restoreSegments(masked, segments)).toBe(page)
  })

  it('throws on count mismatch', () => {
    const { masked, segments } = extractSegments(page)
    expect(() => restoreSegments(masked, segments.slice(0, -1))).toThrow()
    expect(() => restoreSegments(masked, [...segments, 'extra'])).toThrow()
  })
})

describe('flipDirection', () => {
  it('flips html lang/dir and directional CSS only', () => {
    const flipped = flipDirection(page)
    expect(flipped).toContain('<html lang="en" dir="ltr">')
    expect(flipped).toContain('text-align: left')
    expect(flipped).toContain('direction: ltr')
    // untouched content
    expect(flipped).toContain('color: #fff')
    expect(flipped).toContain('תקציר מנהלים')
  })

  it('is a no-op on a page with no directional markers', () => {
    const ltr = '<html lang="en"><body><p style="text-align:center">x</p></body></html>'
    expect(flipDirection(ltr)).toBe(ltr)
  })
})

describe('chunkSegments', () => {
  it('preserves order and covers everything', () => {
    const items = Array.from({ length: 250 }, (_, i) => `s${i}`)
    const chunks = chunkSegments(items, 120)
    expect(chunks.map(c => c.length)).toEqual([120, 120, 10])
    expect(chunks.flat()).toEqual(items)
  })
})
