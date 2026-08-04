/**
 * The cover and closing slides every Results deck opens and ends with.
 *
 * Extracted from the campaign presentation so the strategy deck reuses them
 * instead of imitating the markup — the gold frame, corner rules, partner
 * lockups and sign-off are the agency's identity, and there should be one
 * definition of them.
 *
 * Props are explicit rather than a SlideData, because the two products build
 * their slides from different models.
 */

const PARTNER_LOGOS = [
  { src: '/partners/google.png', alt: 'Google Partner' },
  { src: '/partners/meta.png', alt: 'Meta Business Partner' },
  { src: '/partners/tiktok.png', alt: 'TikTok Marketing Partners' },
  { src: '/partners/wix.png', alt: 'Wix Partner' },
]

export function PartnerLogos() {
  return (
    <div className="partner-logos">
      {PARTNER_LOGOS.map(p => (
        // Normalized to monochrome white so the mixed light/dark badge lockups
        // read uniformly on the dark cover.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.src} src={p.src} alt={p.alt} className="partner-logo-img" />
      ))}
    </div>
  )
}

export function ResultsLogo() {
  // The real brand logo (yellow bars + arrow + "Results" wordmark) served from
  // /logo.png, instead of a hand-drawn imitation.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Results" className="results-logo-img" />
}

export function CoverSlide({
  clientName,
  headline,
  eyebrow,
  logoUrl,
}: {
  /** The client, shown under the headline and used for the initials fallback. */
  clientName: string
  /** What this document is — the campaign name, or the strategy doc's name. */
  headline: string
  /** Small line above the headline; both products pass a formatted date. */
  eyebrow?: string
  logoUrl?: string | null
}) {
  return (
    <div className="cover-slide-v2">
      {/* Fine inset gold frame — the "firm" cue */}
      <div className="cover-frame" aria-hidden />
      <div className="cover-corner tl" />
      <div className="cover-corner tr" />
      <div className="cover-corner bl" />
      <div className="cover-corner br" />

      <div className="cover-top-bar rp-anim rp-up rp-d1">
        <ResultsLogo />
      </div>

      <div className="cover-body">
        <div className="cover-left">
          <div className="cover-eyebrow rp-anim rp-in rp-d2">
            <span className="cover-eyebrow-dot" />
            {eyebrow || 'Results Digital'}
          </div>
          <h1 className="cover-headline rp-anim rp-in rp-d3">{headline}</h1>
          <div className="cover-meta-line rp-anim rp-up rp-d4">
            <span className="cover-client-name">{clientName}</span>
            <span className="cover-meta-sep" aria-hidden />
            <span className="cover-by">By Results Digital</span>
          </div>
          <div className="cover-h-rule rp-anim rp-wipe rp-d5" />
          <div className="rp-anim rp-up rp-d6">
            <PartnerLogos />
          </div>
        </div>

        <div className="cover-right rp-anim rp-scale rp-d2">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={clientName} className="cover-client-logo" />
          ) : (
            <div className="cover-client-initials">
              {(clientName || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ClosingSlide({ title, clientName }: { title: string; clientName?: string }) {
  return (
    <div className="closing-slide-v2">
      <div className="cover-frame" aria-hidden />
      <div className="closing-glow-center" aria-hidden />

      <div className="closing-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Results" className="closing-logo rp-anim rp-up rp-d1" />

        <h1 className="closing-headline rp-anim rp-up rp-d3">{title}</h1>

        {clientName && <p className="closing-client rp-anim rp-up rp-d4">{clientName}</p>}

        <div className="closing-rule rp-anim rp-up rp-d5" />

        <a
          className="closing-url rp-anim rp-up rp-d6"
          href="https://www.resultsdigital.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          www.resultsdigital.org
        </a>
      </div>
    </div>
  )
}
