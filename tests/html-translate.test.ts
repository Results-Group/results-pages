import { describe, it, expect } from 'vitest'
import {
  extractSegments, restoreSegments, flipDirection, chunkSegments,
  segmentTexts, encodeForContext,
} from '@/lib/html-translate'

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
    const texts = segmentTexts(segments)
    expect(texts).toContain('דוח שנתי | Twill')
    expect(texts).toContain('תקציר מנהלים')
    expect(texts).toContain('ניתוח מערך השיווק')
    expect(texts).toContain('גרף ביצועים')
    expect(texts).toContain('ינואר')
    expect(texts).not.toContain('March')
    expect(masked).not.toMatch(/[֐-׿]/)
    expect(masked).toContain('<h1 class="big">')
    expect(masked).toContain('text-align: right; direction: rtl')
  })

  it('labels each segment with the context it will be written back into', () => {
    const { segments } = extractSegments(page)
    const ctx = (t: string) => segments.find(s => s.text === t)?.ctx
    expect(ctx('תקציר מנהלים')).toBe('text')
    expect(ctx('גרף ביצועים')).toBe('attr')
    expect(ctx('ניתוח מערך השיווק')).toBe('attr')
    expect(ctx('ינואר')).toBe('js')
    expect(segments.find(s => s.text === 'ינואר')?.quote).toBe('"')
  })

  it('a ">" inside an attribute value does not split the tag', () => {
    // The naive /<[^>]*>/ split handed the model `תת-דף" class="x">שלום`.
    const { segments } = extractSegments('<div title="דף > תת-דף" class="x">שלום</div>')
    const texts = segmentTexts(segments)
    expect(texts).toContain('דף > תת-דף')
    expect(texts).toContain('שלום')
    expect(texts.join()).not.toContain('class=')
  })

  it('skips js literals containing a backslash rather than mis-encoding them', () => {
    const { segments } = extractSegments(`<script>const a = 'שלום\\n עולם';</script>`)
    expect(segments).toHaveLength(0)
  })

  it('bails on input already containing the token character', () => {
    expect(() => extractSegments('<p>⟦</p>')).toThrow()
  })
})

describe('restoreSegments', () => {
  it('identity round-trip returns the original byte-for-byte', () => {
    const { masked, segments } = extractSegments(page)
    expect(restoreSegments(masked, segments, segmentTexts(segments))).toBe(page)
  })

  it('throws on count mismatch', () => {
    const { masked, segments } = extractSegments(page)
    expect(() => restoreSegments(masked, segments, segmentTexts(segments).slice(0, -1))).toThrow()
    expect(() => restoreSegments(masked, segments, [...segmentTexts(segments), 'extra'])).toThrow()
  })
})

// The bug this file exists to prevent: whatever the model returns is written
// into three different syntactic contexts, and an unescaped answer escapes them.
describe('model output cannot escape its context', () => {
  it('a tag in a text translation is inert', () => {
    const { masked, segments } = extractSegments('<h1>כותרת</h1>')
    const out = restoreSegments(masked, segments, ['<img src=x onerror=alert(1)>Summary'])
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })

  it('a quote in an attribute translation cannot open a new attribute', () => {
    const { masked, segments } = extractSegments('<img src="/l.png" alt="לוגו">')
    const out = restoreSegments(masked, segments, ['Logo" onerror="fetch(1)'])
    expect(out).not.toContain('onerror="')
    expect(out).toContain('&quot;')
    // the tag still has exactly its original attributes
    expect(out.match(/<img[^>]*>/)![0]).toContain('alt="Logo&quot; onerror=&quot;fetch(1)"')
  })

  it("an apostrophe in a js translation does not terminate the string", () => {
    // The everyday version of the bug: "don't" breaking the page's JavaScript.
    const { masked, segments } = extractSegments(`<script>const m = 'שלום';</script>`)
    const out = restoreSegments(masked, segments, ["it's here"])
    expect(out).toContain("'it\\'s here'")
  })

  it('a js translation cannot close the script element', () => {
    const { masked, segments } = extractSegments(`<script>const m = 'שלום';</script>`)
    const out = restoreSegments(masked, segments, ['a</script><script>alert(1)'])
    expect(out).not.toContain('</script><script>alert(1)')
    expect(out).toContain('<\\/script>')
  })

  it('a newline in a js translation is escaped, not literal', () => {
    const { masked, segments } = extractSegments(`<script>const m = 'שלום';</script>`)
    const out = restoreSegments(masked, segments, ['line1\nline2'])
    expect(out).toContain('line1\\nline2')
    expect(out.split('\n').find(l => l.includes('const m'))).toContain('line1\\nline2')
  })
})

describe('encodeForContext', () => {
  it('leaves ordinary translated text untouched', () => {
    expect(encodeForContext('Executive summary', { text: '', ctx: 'text' })).toBe('Executive summary')
    expect(encodeForContext('Logo', { text: '', ctx: 'attr' })).toBe('Logo')
    expect(encodeForContext('January', { text: '', ctx: 'js', quote: '"' })).toBe('January')
  })

  it('keeps existing entities intact in text', () => {
    expect(encodeForContext('a&nbsp;b', { text: '', ctx: 'text' })).toBe('a&nbsp;b')
  })
})

describe('flipDirection', () => {
  it('flips html lang/dir and directional CSS only', () => {
    const flipped = flipDirection(page)
    expect(flipped).toContain('<html lang="en" dir="ltr">')
    expect(flipped).toContain('text-align: left')
    expect(flipped).toContain('direction: ltr')
    expect(flipped).toContain('color: #fff')
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
