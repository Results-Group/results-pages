'use client'

import { useRef, useState } from 'react'
import AdCaption from './AdCaption'
import { useLogoNeedsDarkBackdrop } from './useLogoContrast'

/**
 * Instagram/Facebook-style carousel ad: several creatives in one post that the
 * viewer swipes through, with dot indicators and arrows — the way the platforms
 * actually render a multi-image ad.
 */
export default function CarouselFeed({
  images,
  clientName,
  logoUrl,
  caption,
}: {
  images: string[]
  clientName: string
  logoUrl?: string
  caption?: string
}) {
  const logoNeedsDark = useLogoNeedsDarkBackdrop(logoUrl)
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const count = images.length

  // The track is inside a dir="rtl" subtree, where browsers report scrollLeft as
  // negative (and older Safari as positive-descending). Scrolling the target
  // child into view sidesteps the sign convention entirely, and the index is
  // read back from the absolute offset.
  function goTo(i: number) {
    const next = Math.max(0, Math.min(count - 1, i))
    setIndex(next)
    // 'auto', not 'smooth': smooth scrolling is animation-frame driven, so with
    // frames paused the dots and arrows advanced while the track never moved.
    trackRef.current?.children[next]?.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' })
  }

  // Keep the dots in sync when the user swipes natively.
  function onScroll() {
    const track = trackRef.current
    if (!track || !track.clientWidth) return
    const i = Math.round(Math.abs(track.scrollLeft) / track.clientWidth)
    const clamped = Math.max(0, Math.min(count - 1, i))
    if (clamped !== index) setIndex(clamped)
  }

  return (
    <div dir="rtl" className="w-full max-w-[468px] mx-auto" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div className="relative rounded-[2.2rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.03))' }}>
        <div className="rounded-[2rem] overflow-hidden" style={{ background: '#fff', boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)' }}>
          {/* Notch */}
          <div className="flex justify-center pt-2 pb-1" style={{ background: '#fff' }}>
            <div className="w-[120px] h-[28px] rounded-full" style={{ background: '#1a1a1a' }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid #efefef' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)', padding: '2px' }}>
                <div
                  className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
                  style={{ background: logoNeedsDark ? '#1c1e21' : '#fff' }}
                >
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={clientName} className="max-w-[70%] max-h-[70%] object-contain" />
                  ) : (
                    <div className="w-full h-full rounded-full" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} />
                  )}
                </div>
              </div>
              <div>
                <span className="text-[13px] font-semibold text-gray-900 block leading-tight">{clientName}</span>
                <span className="text-[10px] text-gray-400">Sponsored</span>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-gray-500 tabular-nums">{index + 1}/{count}</span>
          </div>

          {/* Swipeable track */}
          <div className="relative">
            <div
              ref={trackRef}
              onScroll={onScroll}
              className="carousel-track flex w-full aspect-square overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none' }}
            >
              {images.map((src, i) => (
                <div key={i} className="w-full h-full flex-shrink-0 snap-center bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </div>
              ))}
            </div>

            {index > 0 && (
              <CarouselArrow side="right" onClick={() => goTo(index - 1)} />
            )}
            {index < count - 1 && (
              <CarouselArrow side="left" onClick={() => goTo(index + 1)} />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M22 3L9.218 10.083M22 3l-9.782 18-3-8.917M22 3L9.218 10.083m0 0L6 19.083" /></svg>
            </div>

            {/* Dots — the carousel's signature affordance */}
            <div className="flex items-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`תמונה ${i + 1}`}
                  className="rounded-full transition-all"
                  style={{
                    width: i === index ? 7 : 5,
                    height: i === index ? 7 : 5,
                    background: i === index ? '#0095f6' : '#c7c7c7',
                  }}
                />
              ))}
            </div>

            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-900"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </div>

          {/* Likes */}
          <div className="px-3 pb-1">
            <p className="text-[13px] text-gray-900 font-semibold">1,247 likes</p>
          </div>

          {caption && (
            <div className="px-3 pb-3">
              <AdCaption text={caption} clientName={clientName} className="text-[13px] text-gray-900 leading-relaxed" />
            </div>
          )}

          {/* Home bar */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="w-[134px] h-[5px] rounded-full" style={{ background: '#1a1a1a' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function CarouselArrow({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={side === 'left' ? 'הבא' : 'הקודם'}
      className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center shadow-md transition-opacity hover:opacity-100 opacity-90"
      style={{ [side]: 8, background: 'rgba(255,255,255,0.92)' }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={side === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'} />
      </svg>
    </button>
  )
}
