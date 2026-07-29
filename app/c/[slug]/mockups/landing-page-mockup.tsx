'use client'

import { ExternalLink } from 'lucide-react'

/**
 * MacBook + iPhone side-by-side mockup that embeds a landing page live via
 * two iframes. Either takes a full URL ("https://…") or a same-origin path
 * ("/pages/client/slug"). If the URL is empty a placeholder shows instead,
 * so the operator can still position the section before pasting a link.
 *
 * iframes are set to loading="lazy" and referrerpolicy="no-referrer" so
 * heavy landing pages don't block the deck's first paint. Every rendered
 * card also carries a small "פתח בטאב חדש" overlay button as an escape
 * hatch for sites that block iframe embedding via X-Frame-Options.
 */
export default function LandingPageMockup({ url, caption }: { url?: string; caption?: string }) {
  const trimmed = (url || '').trim()
  const isEmpty = trimmed === ''
  // Relative paths (`/pages/foo/bar`) render fine inside the iframe because
  // the browser resolves them against the current origin — but the "open in
  // new tab" link needs an absolute href, which we build at click-time so
  // the SSR pass doesn't touch `window`.
  const openHref = trimmed.startsWith('http') ? trimmed : trimmed || undefined

  return (
    <div dir="ltr" className="w-full">
      <div className="flex flex-wrap items-end justify-center gap-6">
        {/* Desktop / MacBook */}
        <div className="relative" style={{ width: 480, maxWidth: '100%' }}>
          <div className="rounded-t-lg overflow-hidden shadow-2xl" style={{ background: '#1c1e21' }}>
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
              <div
                className="flex-1 mx-4 px-2.5 py-1 rounded text-[10px] truncate"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
              >
                {trimmed || 'about:blank'}
              </div>
              {openHref && (
                <a
                  href={openHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded transition-colors"
                  style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                  title="פתח בטאב חדש"
                >
                  <ExternalLink className="w-3 h-3" />
                  פתח
                </a>
              )}
            </div>
          </div>
          <div className="relative" style={{ aspectRatio: '16 / 10', background: '#fff', border: '1px solid #1c1e21' }}>
            {isEmpty ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                <div className="text-sm font-semibold text-gray-500">אין קישור לדף נחיתה</div>
                <div className="text-[11px] text-gray-400">הזן URL בעורך כדי לראות תצוגה חיה</div>
              </div>
            ) : (
              <iframe
                src={trimmed}
                className="absolute inset-0 w-full h-full border-0"
                title="Desktop landing preview"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          {/* MacBook base */}
          <div className="mx-auto rounded-b-xl" style={{ height: 10, background: 'linear-gradient(180deg, #2b2e33, #1c1e21)', maxWidth: '100%' }}>
            <div className="mx-auto rounded-b-lg" style={{ width: 64, height: 4, background: '#0a0a0a' }} />
          </div>
        </div>

        {/* iPhone */}
        <div className="relative" style={{ width: 150 }}>
          <div className="rounded-[1.6rem] p-[3px]" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04))' }}>
            <div className="relative rounded-[1.5rem] overflow-hidden bg-white" style={{ boxShadow: '0 15px 45px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)' }}>
              <div className="relative w-full" style={{ aspectRatio: '9 / 19.5' }}>
                {isEmpty ? (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-[10px] text-gray-400 px-2">
                    אין קישור
                  </div>
                ) : (
                  <iframe
                    src={trimmed}
                    className="absolute inset-0 w-full h-full border-0"
                    title="Mobile landing preview"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                {/* Dynamic-island / notch */}
                <div className="absolute top-1 inset-x-0 flex justify-center z-10 pointer-events-none">
                  <div className="w-14 h-3.5 rounded-full" style={{ background: '#000' }} />
                </div>
                {/* Home indicator */}
                <div className="absolute bottom-1 inset-x-0 flex justify-center z-10 pointer-events-none">
                  <div className="w-16 h-[3px] rounded-full" style={{ background: 'rgba(0,0,0,0.35)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {caption && (
        <p
          dir="auto"
          className="mt-4 text-sm leading-relaxed whitespace-pre-line text-center max-w-2xl mx-auto"
          style={{ color: 'var(--text-secondary, #94a3b8)' }}
        >
          {caption}
        </p>
      )}
    </div>
  )
}
