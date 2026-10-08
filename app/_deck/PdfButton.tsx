'use client'

import { useState } from 'react'
import { downloadDeckPdf } from '@/lib/deck-pdf-client'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

/**
 * Downloads the deck as a PDF rendered on the server (app/api/campaigns/[id]/pdf),
 * so the file looks the same whichever browser or phone the client exports
 * from. The first export of a version renders the whole deck and can take up
 * to a minute — the button says so while it waits.
 */
export default function PdfButton({ campaignId, fileName, lang = 'he' }: { campaignId: string; fileName: string; lang?: 'he' | 'en' }) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await downloadDeckPdf(campaignId, fileName)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('public.pdfError'))
      setTimeout(() => setError(null), 5000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="pdf-btn-wrap">
      <button type="button" className="deck-action pdf-btn" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? (
          <span className="pdf-btn-spin" aria-hidden />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        {busy ? t('public.pdfPreparing') : t('public.exportPdf')}
      </button>
      {error && <span className="pdf-btn-error" role="alert">{error}</span>}
    </span>
  )
}
