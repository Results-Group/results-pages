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
 * The embed keeps the control bar: without it an iPhone viewer, whose
 * autoplay is blocked, got a black frame with no play button (2026-09-27).
 * Related videos and annotations are still suppressed.
 */
describe('parseVideoUrl — embed player settings', () => {
  const yt = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').embedUrl!

  it('keeps the control bar so the viewer can always play, mute and seek', () => {
    expect(yt).toContain('controls=1')
    expect(yt).not.toContain('controls=0')
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

import { videoFrameRatio, isYouTubeShort, isDriveVideo } from '@/lib/video-utils'

describe('videoFrameRatio', () => {
  const drive = 'https://drive.google.com/file/d/abcdefghijklmnop/view?usp=sharing'

  it('keeps a square Drive video square — the frame no longer collapses to 16:9 on play', () => {
    expect(videoFrameRatio(drive, { posterRatio: 1 })).toBe(1)
  })

  it('treats a Shorts URL as vertical before any poster is measured', () => {
    expect(isYouTubeShort('https://youtube.com/shorts/lUuLgSc_yUA?feature=share')).toBe(true)
    expect(videoFrameRatio('https://youtube.com/shorts/lUuLgSc_yUA?feature=share', { posterRatio: 16 / 9 })).toBe('9 / 16')
  })

  it('lets an explicit ratio win (the Reels mockup passes 9 / 16)', () => {
    expect(videoFrameRatio(drive, { forced: '9 / 16', posterRatio: 1 })).toBe('9 / 16')
  })

  it('falls back to 16:9 only when nothing is known yet', () => {
    expect(videoFrameRatio('https://vimeo.com/123456', { posterRatio: null })).toBeCloseTo(16 / 9)
    expect(videoFrameRatio('https://www.youtube.com/watch?v=dQw4w9WgXcQ', { posterRatio: 16 / 9 })).toBeCloseTo(16 / 9)
  })

  it('recognises Drive links for the player height floor', () => {
    expect(isDriveVideo(drive)).toBe(true)
    expect(isDriveVideo('https://youtu.be/dQw4w9WgXcQ')).toBe(false)
  })
})
