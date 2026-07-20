export function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'other'; videoId?: string; embedUrl?: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    return { platform: 'youtube', videoId: ytMatch[1], embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` }
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return { platform: 'vimeo', videoId: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` }
  }

  // Google Drive share links → embeddable /preview player (file must be shared
  // "anyone with the link"). Handles /file/d/ID/view, open?id=ID and uc?id=ID.
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^&]*&)*id=)([a-zA-Z0-9_-]{10,})/)
  if (driveMatch) {
    return { platform: 'other', videoId: driveMatch[1], embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview` }
  }

  return { platform: 'other' }
}

/**
 * Best-effort poster image for a video URL, resolvable without an API call.
 * - YouTube serves predictable still frames.
 * - Google Drive exposes a thumbnail endpoint for link-shared files (same
 *   sharing requirement as the embed player).
 * Vimeo has no static URL — it needs the oEmbed lookup the card does at runtime.
 */
export function getVideoThumbnail(url: string): string | null {
  const { platform, videoId } = parseVideoUrl(url)
  if (!videoId) return null
  if (platform === 'youtube') return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  // Proxied through our own origin: mobile browsers block the direct Drive
  // request (tracking prevention), which left the card blank on phones.
  if (/drive\.google\.com/.test(url)) return `/api/video-thumb?id=${videoId}`
  return null
}

/** Lower-resolution YouTube still that always exists, for maxres 404 fallback. */
export function getYouTubeFallbackThumbnail(url: string): string | null {
  const { platform, videoId } = parseVideoUrl(url)
  return platform === 'youtube' && videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}
