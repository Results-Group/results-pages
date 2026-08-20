'use client'

import { useState } from 'react'

/**
 * Public share affordance: native share sheet where one exists (mobile),
 * copy-to-clipboard everywhere else. Plain URL only — the Hebrew WhatsApp
 * message builder in lib/share is a staff tool, not for the client audience.
 * Hardcoded Hebrew with a lang prop, like the rest of the public surface.
 */
export default function ShareButton({ title, lang = 'he', className }: { title: string; lang?: 'he' | 'en'; className?: string }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (err) {
        // Cancelling the native sheet is not an error; anything else falls
        // through to the clipboard path.
        if (err instanceof Error && err.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard unavailable (http, permissions) — nothing to do */ }
  }

  return (
    <button type="button" onClick={share} className={className} aria-label={lang === 'en' ? 'Share' : 'שיתוף'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)',
        color: 'rgba(255,255,255,0.85)', cursor: 'pointer',
      }}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
      )}
      {copied ? (lang === 'en' ? 'Link copied' : 'הקישור הועתק') : (lang === 'en' ? 'Share' : 'שיתוף')}
    </button>
  )
}
