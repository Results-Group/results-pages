export function parseVideoUrl(url: string): { platform: 'youtube' | 'vimeo' | 'other'; videoId?: string; embedUrl?: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    return { platform: 'youtube', videoId: ytMatch[1], embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}` }
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return { platform: 'vimeo', videoId: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` }
  }

  return { platform: 'other' }
}
