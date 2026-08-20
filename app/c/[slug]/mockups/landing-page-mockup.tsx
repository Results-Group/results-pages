'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink, Monitor, Smartphone } from 'lucide-react'

/**
 * Landing-page mockup: the page embedded live in a MacBook or an iPhone frame,
 * one at a time, with a toggle between them. Takes a full URL ("https://…") or
 * a same-origin path ("/pages/client/slug"). With no URL a placeholder shows,
 * so the operator can position the section before pasting a link.
 *
 * Showing both devices side by side split the slide's width between them and
 * left the desktop view too small to read. One device at a time gets the whole
 * slide; the toggle keeps the mobile view a click away.
 *
 * The iframe renders at a REAL device viewport (1440×900 / 390×844) and is
 * scaled down with a transform. Sizing it to the frame's own pixel width
 * instead made the embedded page match a ~480px viewport — it served its mobile
 * layout inside the laptop chrome, so the hero was cut mid-headline and the
 * sticky CTA covered a third of the screen.
 *
 * loading="lazy" decoding="async" keeps heavy pages off the deck's first paint, and the chrome
 * carries an "open in a new tab" escape hatch for sites that refuse embedding
 * via X-Frame-Options.
 */

const DESKTOP_VW = 1440
const DESKTOP_VH = 900
const PHONE_VW = 390
const PHONE_VH = 844
/** Browser chrome bar and the MacBook base, in px — excluded from the screen. */
const CHROME_H = 34
const BASE_H = 12
/** Room kept for the deck's fixed footer nav, the toggle and the caption. */
const FOOTER_RESERVE = 150
const DESKTOP_MAX = 1180
const PHONE_MAX = 330

type Device = 'desktop' | 'mobile'

export default function LandingPageMockup({ url, caption }: { url?: string; caption?: string }) {
  const trimmed = (url || '').trim()
  const isEmpty = trimmed === ''
  // Relative paths render fine inside the iframe (the browser resolves them
  // against the current origin), and work as an href just the same.
  const openHref = trimmed || undefined

  const [device, setDevice] = useState<Device>('desktop')
  const wrapRef = useRef<HTMLDivElement>(null)
  // Measured rather than driven by media queries: this component renders both
  // in the client's deck and inside the admin canvas, whose width has nothing
  // to do with the viewport's.
  const [width, setWidth] = useState(900)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => {
      const available = el.clientWidth
      if (available <= 0) return
      // Height matters as much as width: a slide is one screen, and sizing off
      // width alone pushed the laptop's base and the phone below the fold.
      const top = el.getBoundingClientRect().top
      const heightBudget = Math.max(220, window.innerHeight - top - FOOTER_RESERVE)
      if (device === 'mobile') {
        setWidth(Math.min(available, PHONE_MAX, heightBudget * (PHONE_VW / PHONE_VH)))
      } else {
        const fromHeight = (heightBudget - CHROME_H - BASE_H) * (DESKTOP_VW / DESKTOP_VH)
        setWidth(Math.min(available, DESKTOP_MAX, fromHeight))
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    // The observer only fires on the element's own box; a viewport height
    // change (rotate, browser chrome) leaves it silent.
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [device])

  const isMobile = device === 'mobile'
  const scale = isMobile ? width / PHONE_VW : width / DESKTOP_VW
  const screenH = isMobile ? width * (PHONE_VH / PHONE_VW) : width * (DESKTOP_VH / DESKTOP_VW)

  const iframeStyle: React.CSSProperties = {
    width: isMobile ? PHONE_VW : DESKTOP_VW,
    height: isMobile ? PHONE_VH : DESKTOP_VH,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
    // A live page inside a swipe-navigated deck would otherwise swallow scroll
    // and clicks. The chrome's "פתח" button is the way in.
    pointerEvents: 'none',
  }

  return (
    <div className="w-full" ref={wrapRef}>
      {/* Device toggle */}
      <div className="lp-toggle" dir="rtl">
        <button
          type="button"
          className={`lp-toggle-btn${!isMobile ? ' active' : ''}`}
          onClick={() => setDevice('desktop')}
          aria-pressed={!isMobile}
        >
          <Monitor className="w-3.5 h-3.5" /> מחשב
        </button>
        <button
          type="button"
          className={`lp-toggle-btn${isMobile ? ' active' : ''}`}
          onClick={() => setDevice('mobile')}
          aria-pressed={isMobile}
        >
          <Smartphone className="w-3.5 h-3.5" /> מובייל
        </button>
      </div>

      <div dir="ltr" className="flex justify-center">
        {isMobile ? (
          <div className="relative" style={{ width }}>
            <div className="rounded-[1.8rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0.05))' }}>
              <div
                className="relative overflow-hidden bg-white rounded-[1.65rem]"
                style={{ height: screenH, boxShadow: '0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)' }}
              >
                {isEmpty ? (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] text-gray-400 px-3">
                    אין קישור לדף נחיתה
                  </div>
                ) : (
                  <iframe
                    src={trimmed}
                    title="Mobile landing preview"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    scrolling="no"
                    className="absolute top-0 left-0 border-0"
                    style={iframeStyle}
                  />
                )}
                {/* Dynamic island */}
                <div className="absolute top-1.5 inset-x-0 flex justify-center z-10 pointer-events-none">
                  <div className="rounded-full" style={{ width: '32%', height: width * 0.075, background: '#000' }} />
                </div>
                {/* Home indicator */}
                <div className="absolute bottom-1.5 inset-x-0 flex justify-center z-10 pointer-events-none">
                  <div className="rounded-full" style={{ width: '36%', height: 3, background: 'rgba(0,0,0,0.35)' }} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative" style={{ width, maxWidth: '100%' }}>
            <div className="rounded-t-xl overflow-hidden" style={{ background: '#1c1e21' }}>
              <div className="flex items-center gap-1.5 px-3" style={{ height: CHROME_H }}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#ff5f57' }} />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#febc2e' }} />
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#28c840' }} />
                <div
                  className="flex-1 mx-3 px-2.5 py-1 rounded text-[10px] truncate"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
                >
                  {trimmed || 'about:blank'}
                </div>
                {openHref && (
                  <a
                    href={openHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded shrink-0"
                    style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                    title="פתח בטאב חדש"
                  >
                    <ExternalLink className="w-3 h-3" />
                    פתח
                  </a>
                )}
              </div>
            </div>

            <div
              className="relative overflow-hidden"
              style={{
                height: screenH,
                background: '#fff',
                borderInline: '1px solid #1c1e21',
                boxShadow: '0 30px 70px rgba(0,0,0,0.45)',
              }}
            >
              {isEmpty ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <div className="text-sm font-semibold text-gray-500">אין קישור לדף נחיתה</div>
                  <div className="text-[11px] text-gray-400">הזן URL בעורך כדי לראות תצוגה חיה</div>
                </div>
              ) : (
                <iframe
                  src={trimmed}
                  title="Desktop landing preview"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  scrolling="no"
                  className="absolute top-0 left-0 border-0"
                  style={iframeStyle}
                />
              )}
            </div>

            {/* MacBook base */}
            <div className="rounded-b-xl" style={{ height: BASE_H, background: 'linear-gradient(180deg, #2b2e33, #131518)' }}>
              <div className="mx-auto rounded-b-lg" style={{ width: '14%', height: 5, background: '#0a0a0a' }} />
            </div>
          </div>
        )}
      </div>

      {caption && (
        <p
          dir="auto"
          className="mt-5 text-sm leading-relaxed whitespace-pre-line text-center max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary, #94a3b8)' }}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
