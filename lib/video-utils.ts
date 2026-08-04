/**
 * Player parameters for the YouTube embed.
 *
 * A bare /embed/<id> URL renders YouTube's full chrome — the video title and
 * channel name across the top, the watermark, and a "More videos" grid on
 * pause. Inside an ad mockup that reads as part of the creative, which it
 * isn't, and clients asked about it.
 *
 * `controls=0` is what removes the title: it is drawn as part of the control
 * chrome, and `showinfo` (which used to hide it on its own) was withdrawn by
 * YouTube in 2018. `autoplay=1` is safe and wanted here — the embed is only
 * mounted after the viewer clicks our own play button, so it follows a real
 * user gesture rather than starting on its own.
 */
const YT_PLAYER_PARAMS = [
  'controls=0',        // no control bar — and no title overlay
  'rel=0',             // end screen stays on this channel
  'modestbranding=1',  // deprecated but still honoured by older players
  'iv_load_policy=3',  // no annotations
  'playsinline=1',     // iOS: play in place instead of going fullscreen
  'autoplay=1',
].join('&')

export function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'other'; videoId?: string; embedUrl?: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    // youtube-nocookie: no tracking cookie until the viewer actually plays.
    return {
      platform: 'youtube',
      videoId: ytMatch[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?${YT_PLAYER_PARAMS}`,
    }
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    // Same reasoning as YouTube: hide the title/byline/avatar overlay so the
    // player reads as the creative rather than as an embed.
    return {
      platform: 'vimeo',
      videoId: vimeoMatch[1],
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0&autoplay=1`,
    }
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
