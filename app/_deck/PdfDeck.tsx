'use client'

import '@/app/c/[slug]/presentation.css'
import { readableAccent, hexToRgba, hexToRgbTriplet } from '@/lib/brand-color'
import { DeckRenderModeProvider } from './render-mode'

/**
 * The deck as the PDF export captures it: every page stacked, one
 * `<section data-pdf-slide>` per PDF page, and none of DeckShell's chrome —
 * no header, progress, footer nav, keyboard or parallax. The route prints it,
 * each section on a page of its own size (app/api/campaigns/[id]/pdf).
 *
 * The root keeps DeckShell's class and brand-colour variables so every slide
 * renders with the same rules as on screen; only `.pdf-mode` rules differ.
 */
export default function PdfDeck({
  pages,
  brandColor,
  variantClass,
}: {
  pages: React.ReactNode[]
  brandColor?: string | null
  /** 'nav-tabs' for report decks — their slide styling hangs off that class. */
  variantClass?: string
}) {
  const accent = readableAccent(brandColor)
  return (
    <DeckRenderModeProvider value={{ pdf: true }}>
      <div
        className={`campaign-pres pdf-mode${variantClass ? ` ${variantClass}` : ''}`}
        style={accent ? ({
          '--brand-cyan': accent,
          '--brand-green': accent,
          '--border-color': `${hexToRgba(accent, 0.14)}`,
          ...(hexToRgbTriplet(accent) ? { '--brand-rgb': hexToRgbTriplet(accent) } : {}),
        } as React.CSSProperties) : undefined}
      >
        {pages.map((page, i) => (
          <section key={i} data-pdf-slide={i} className="pdf-page">
            <div className="pres-main">
              <div className="slide active">{page}</div>
            </div>
          </section>
        ))}
      </div>
    </DeckRenderModeProvider>
  )
}
