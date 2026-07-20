'use client'

import { useEffect, useState } from 'react'
import { getVideoThumbnail, getYouTubeFallbackThumbnail } from '@/lib/video-utils'

/**
 * The poster → play → embed surface of a video, with no card chrome around it.
 * Extracted so it can sit inside an ad mockup (e.g. the Facebook feed media
 * slot) as well as on its own.
 */
export default function VideoPlayer({
  url,
  embedUrl,
  platform,
  rounded = false,
}: {
  url: string
  embedUrl?: string
  platform: 'youtube' | 'vimeo' | 'other'
  /** Rounded corners when standalone; square when filling a feed media slot. */
  rounded?: boolean
}) {
  const [showEmbed, setShowEmbed] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(() => getVideoThumbnail(url))

  useEffect(() => {
    setThumbnailUrl(getVideoThumbnail(url))
    if (platform !== 'vimeo') return
    let cancelled = false
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data?.thumbnail_url) setThumbnailUrl(data.thumbnail_url) })
      .catch(() => { /* keep the gradient placeholder */ })
    return () => { cancelled = true }
  }, [url, platform])

  return (
    <div
      className={`relative w-full aspect-video overflow-hidden ${rounded ? 'rounded-lg' : ''}`}
      style={{ background: 'linear-gradient(135deg, #141e20, #0d1112)' }}
    >
      {showEmbed && embedUrl ? (
        <iframe
          src={embedUrl}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <>
          {thumbnailUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbnailUrl}
                alt="Video thumbnail"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
                onError={() => {
                  const fallback = getYouTubeFallbackThumbnail(url)
                  setThumbnailUrl(fallback && fallback !== thumbnailUrl ? fallback : null)
                }}
              />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45), rgba(0,0,0,0.15))' }} />
            </>
          )}

          {embedUrl ? (
            <button onClick={() => setShowEmbed(true)} className="absolute inset-0 flex items-center justify-center group" aria-label="Play video">
              <PlayButton />
            </button>
          ) : url ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center group">
              <PlayButton />
            </a>
          ) : (
            // No link pasted yet — an <a href=""> would resolve to the current
            // page, so tapping "play" reloaded the deck back to slide one.
            <div className="absolute inset-0 flex items-center justify-center opacity-40">
              <PlayButton />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PlayButton() {
  return (
    <div
      className="w-16 h-16 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
      style={{ background: 'rgba(0,0,0,0.55)', border: '2px solid rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)' }}
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" className="ml-1">
        <path d="M8 5v14l11-7z" />
      </svg>
    </div>
  )
}
