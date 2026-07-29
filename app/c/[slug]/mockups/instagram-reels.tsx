'use client'

import VideoPlayer from './VideoPlayer'
import { useLogoNeedsDarkBackdrop } from './useLogoContrast'
import type { ReactNode } from 'react'

/**
 * Vertical Instagram-Reels mockup: 9:16 phone frame with a Reels-style
 * top bar, right-side action rail (like/comment/share/bookmark), and a
 * bottom overlay with username + caption + music strip. Either plays a
 * video URL via <VideoPlayer aspectRatio="9/16"> or, if no URL yet, shows
 * a dark placeholder so the operator still sees the Reels chrome.
 */
export default function InstagramReels({
  videoUrl, embedUrl, platform,
  posterUrl,
  clientName, logoUrl,
  caption,
}: {
  videoUrl?: string
  embedUrl?: string
  platform?: 'youtube' | 'vimeo' | 'other'
  /** Optional still image behind the play button when no video URL was pasted. */
  posterUrl?: string
  clientName: string
  logoUrl?: string
  caption?: string
}) {
  const logoNeedsDark = useLogoNeedsDarkBackdrop(logoUrl)

  const media: ReactNode = videoUrl ? (
    <VideoPlayer
      url={videoUrl}
      embedUrl={embedUrl}
      platform={platform || 'other'}
      aspectRatio="9 / 16"
    />
  ) : (
    <div className="w-full h-full relative">
      {posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      {!posterUrl && (
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #1a1d20, #0d1112)' }} />
      )}
    </div>
  )

  return (
    <div dir="rtl" className="w-[260px] mx-auto">
      {/* Phone frame */}
      <div className="relative rounded-[2.4rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))' }}>
        <div className="relative rounded-[2.2rem] overflow-hidden" style={{ boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.1)' }}>
          <div className="relative w-full aspect-[9/16] bg-black">
            {/* Video (or placeholder) fills the whole frame */}
            <div className="absolute inset-0">{media}</div>

            {/* Top / bottom scrims so overlays stay legible over any footage */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none" />

            {/* Notch */}
            <div className="absolute top-0 inset-x-0 flex justify-center pt-2 z-20 pointer-events-none">
              <div className="w-[100px] h-[25px] rounded-full" style={{ background: '#000' }} />
            </div>

            {/* Top bar — "Reels" title + camera */}
            <div dir="ltr" className="absolute top-10 inset-x-3 z-10 flex items-center justify-between text-white pointer-events-none">
              <span className="text-[15px] font-bold drop-shadow-md">Reels</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" className="opacity-90">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>

            {/* Right action rail */}
            <div className="absolute bottom-24 end-2 z-10 flex flex-col items-center gap-4 text-white pointer-events-none">
              {/* Profile avatar */}
              <div className="w-9 h-9 rounded-full overflow-hidden" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
                <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center" style={{ background: logoNeedsDark ? '#1c1e21' : '#fff' }}>
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={clientName} className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <div className="w-full h-full rounded-full" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
                  )}
                </div>
              </div>
              {/* Like */}
              <ActionIcon count="12.5K">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="white" stroke="white" />
              </ActionIcon>
              {/* Comment */}
              <ActionIcon count="234">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="none" stroke="white" strokeWidth="1.8" />
              </ActionIcon>
              {/* Share (paper-plane) */}
              <ActionIcon>
                <path d="M22 2 11 13" fill="none" stroke="white" strokeWidth="1.8" />
                <path d="M22 2 15 22l-4-9-9-4 20-7z" fill="none" stroke="white" strokeWidth="1.8" />
              </ActionIcon>
              {/* Bookmark */}
              <ActionIcon>
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="none" stroke="white" strokeWidth="1.8" />
              </ActionIcon>
              {/* More */}
              <ActionIcon>
                <circle cx="12" cy="5" r="1.5" fill="white" />
                <circle cx="12" cy="12" r="1.5" fill="white" />
                <circle cx="12" cy="19" r="1.5" fill="white" />
              </ActionIcon>
            </div>

            {/* Bottom overlay: username row, caption, music strip */}
            <div className="absolute bottom-8 inset-x-3 z-10 pr-1 pointer-events-none" style={{ marginInlineEnd: '52px' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white text-[13px] font-semibold drop-shadow-md">{clientName}</span>
                <span dir="ltr" className="px-2 py-[3px] rounded-md text-[11px] font-semibold border border-white/80 text-white">Follow</span>
              </div>
              {caption && (
                <p className="text-white text-[12px] leading-snug line-clamp-2 mb-2 whitespace-pre-line drop-shadow-md" dir="auto">
                  {caption}
                </p>
              )}
              {/* Music strip */}
              <div dir="ltr" className="flex items-center gap-1.5 text-white/95">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" className="flex-shrink-0">
                  <path d="M9 17V5l12-2v12M9 17a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" fill="none" stroke="white" strokeWidth="1.8" />
                </svg>
                <span className="text-[11px] font-medium drop-shadow-md truncate">{clientName} · Original audio</span>
              </div>
            </div>

            {/* Home bar indicator */}
            <div className="absolute bottom-1 inset-x-0 flex justify-center z-20 pointer-events-none">
              <div className="w-[120px] h-[4px] rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>
      {/* Reflection */}
      <div className="mx-6 h-6 rounded-b-[2rem] opacity-15" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)', filter: 'blur(6px)' }} />
    </div>
  )
}

function ActionIcon({ children, count }: { children: ReactNode; count?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="26" height="26" viewBox="0 0 24 24" className="drop-shadow-md">
        {children}
      </svg>
      {count && <span className="text-[10px] font-semibold drop-shadow-md">{count}</span>}
    </div>
  )
}
