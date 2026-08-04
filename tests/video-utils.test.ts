import { describe, it, expect } from 'vitest'
import { parseVideoUrl, getVideoThumbnail, getYouTubeFallbackThumbnail } from '@/lib/video-utils'

describe('parseVideoUrl — the URL shapes people actually paste', () => {
  const youtube = [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s',
  ]

  it.each(youtube)('recognises %s', url => {
    const r = parseVideoUrl(url)
    expect(r.platform).toBe('youtube')
    expect(r.videoId).toBe('dQw4w9WgXcQ')
  })

  it('recognises vimeo and google drive', () => {
    expect(parseVideoUrl('https://vimeo.com/76979871').platform).toBe('vimeo')
    expect(parseVideoUrl('https://drive.google.com/file/d/1AbCdEfGhIjK/view').embedUrl)
      .toContain('/preview')
  })

  it('returns no embed for something that is not a video link', () => {
    expect(parseVideoUrl('https://example.com/page').embedUrl).toBeUndefined()
    expect(parseVideoUrl('').platform).toBe('other')
  })
})

/**
 * A bare /embed/<id> URL renders YouTube's own title, channel name and
 * "More videos" grid on top of the creative — inside an ad mockup that reads
 * as part of the ad. `controls=0` is what removes the title (it is drawn as
 * part of the control chrome; `showinfo` was withdrawn in 2018).
 */
describe('parseVideoUrl — embed chrome is suppressed', () => {
  const yt = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl!

  it('hides the title by disabling the player chrome', () => {
    expect(yt).toContain('controls=0')
  })

  it('keeps related videos on the same channel and drops annotations', () => {
    expect(yt).toContain('rel=0')
    expect(yt).toContain('iv_load_policy=3')
  })

  it('plays inline on iOS and starts on its own — the viewer already clicked play', () => {
    expect(yt).toContain('playsinline=1')
    expect(yt).toContain('autoplay=1')
  })

  it('uses the no-cookie host', () => {
    expect(yt.startsWith('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?')).toBe(true)
  })

  it('hides vimeo title, byline and avatar too', () => {
    const vimeo = parseVideoUrl('https://vimeo.com/76979871').embedUrl!
    expect(vimeo).toContain('title=0')
    expect(vimeo).toContain('byline=0')
    expect(vimeo).toContain('portrait=0')
  })
})

describe('thumbnails', () => {
  it('derives a YouTube still and a lower-res fallback', () => {
    const url = 'https://youtu.be/dQw4w9WgXcQ'
    expect(getVideoThumbnail(url)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
    expect(getYouTubeFallbackThumbnail(url)).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('proxies Drive thumbnails through our own origin', () => {
    // Direct Drive requests are blocked by mobile tracking prevention, which
    // left the card blank on phones.
    expect(getVideoThumbnail('https://drive.google.com/file/d/1AbCdEfGhIjK/view'))
      .toBe('/api/video-thumb?id=1AbCdEfGhIjK')
  })

  it('has no static thumbnail for vimeo (needs the runtime oEmbed lookup)', () => {
    expect(getVideoThumbnail('https://vimeo.com/76979871')).toBeNull()
    expect(getYouTubeFallbackThumbnail('https://vimeo.com/76979871')).toBeNull()
  })
})
