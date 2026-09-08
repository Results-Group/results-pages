import { describe, it, expect } from 'vitest'
import { needsJpegFallback, contentTypeFor } from '@/lib/asset-format'

const noWebp = { forceJpeg: false, supportsWebp: false }
const webp = { forceJpeg: false, supportsWebp: true }

describe('needsJpegFallback', () => {
  it('serves the jpeg sibling for a webp when the browser cannot read webp', () => {
    expect(needsJpegFallback('campaigns/abc/hero.webp', noWebp)).toBe(true)
  })

  it('leaves a webp alone for a browser that reads it', () => {
    expect(needsJpegFallback('campaigns/abc/hero.webp', webp)).toBe(false)
  })

  it('honours ?format=jpeg, but still only for a webp', () => {
    expect(needsJpegFallback('campaigns/abc/hero.webp', { forceJpeg: true, supportsWebp: true })).toBe(true)
    expect(needsJpegFallback('pages/relax/logo.png', { forceJpeg: true, supportsWebp: true })).toBe(false)
  })

  // The bug this file exists to prevent. `replace(/\.webp$/, '.jpeg')` is a
  // no-op on these paths, so the proxy fetched the same file back and shipped
  // it under a hard-coded image/jpeg — and these responses set nosniff.
  it('never fires for a stored png or jpg, whatever the browser accepts', () => {
    for (const p of ['pages/relax/commercial-2026/relax-logo-white.png',
                     'pages/relax/commercial-2026/frames/A1.jpg',
                     'clients/x/logo.PNG']) {
      expect(needsJpegFallback(p, noWebp)).toBe(false)
      expect(needsJpegFallback(p, webp)).toBe(false)
    }
  })
})

describe('contentTypeFor', () => {
  it('names the type from the extension, case-insensitively', () => {
    expect(contentTypeFor('a/b.png')).toBe('image/png')
    expect(contentTypeFor('a/b.PNG')).toBe('image/png')
    expect(contentTypeFor('a/b.jpg')).toBe('image/jpeg')
    expect(contentTypeFor('a/b.jpeg')).toBe('image/jpeg')
    expect(contentTypeFor('a/b.webp')).toBe('image/webp')
    expect(contentTypeFor('a/b.pdf')).toBe('application/pdf')
  })

  it('returns null rather than guessing for something unrecognised', () => {
    expect(contentTypeFor('a/b.bin')).toBeNull()
    expect(contentTypeFor('a/b')).toBeNull()
  })
})
