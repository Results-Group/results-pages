'use client'

// Imported here as well as in presentation.tsx so the admin editor's canvas,
// which renders these directly, gets the same styles. The bundler dedupes.
import '../presentation.css'
import { assetProxyUrl } from '@/lib/asset-url'
import { normalizeProfile, type ProfileBlock } from '@/lib/launch-stats'

/**
 * Facebook page and YouTube channel headers, as the client will see them once
 * the artwork is live.
 *
 * Rendered by BOTH the public deck and the admin editor's canvas — same rule as
 * the other mockups: one definition, so the preview can never drift from the
 * delivered slide.
 *
 * The chrome (tab strips, buttons, counts) is deliberately static and unbranded
 * beyond the platform's own look. It is scenery whose only job is to make the
 * uploaded cover read at the right proportions; anything interactive here would
 * invite the client to click it.
 */

function coverUrl(path?: string): string | null {
  return path ? assetProxyUrl(path) : null
}

function Initials({ name, className }: { name: string; className: string }) {
  return <div className={className}>{(name || '?').slice(0, 2).toUpperCase()}</div>
}

export function FacebookCover({ profile }: { profile?: ProfileBlock | null }) {
  const p = normalizeProfile(profile)
  const cover = coverUrl(p.coverPath)
  const avatar = coverUrl(p.avatarPath)

  return (
    <div className="fbpage" dir="ltr">
      <div className="fbpage-cover">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={p.name} className="fbpage-cover-img" />
        ) : (
          <div className="fbpage-cover-empty">תמונת נושא · 820 × 312</div>
        )}
      </div>

      <div className="fbpage-bar">
        <div className="fbpage-identity">
          <div className="fbpage-avatar">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt={p.name} className="fbpage-avatar-img" />
            ) : (
              <Initials name={p.name} className="fbpage-avatar-initials" />
            )}
          </div>
          <div className="fbpage-names">
            <h3 className="fbpage-name">{p.name || 'שם העמוד'}</h3>
            {(p.meta || p.handle) && (
              <p className="fbpage-meta">{[p.meta, p.handle].filter(Boolean).join(' · ')}</p>
            )}
          </div>
        </div>
        <div className="fbpage-actions" aria-hidden>
          <span className="fbpage-btn primary">👍 Like</span>
          <span className="fbpage-btn">Follow</span>
          <span className="fbpage-btn">Message</span>
        </div>
      </div>

      <div className="fbpage-tabs" aria-hidden>
        {['Posts', 'About', 'Photos', 'Videos', 'Reels', 'More'].map((t, i) => (
          <span key={t} className={`fbpage-tab${i === 0 ? ' active' : ''}`}>{t}</span>
        ))}
      </div>
    </div>
  )
}

export function YouTubeCover({ profile }: { profile?: ProfileBlock | null }) {
  const p = normalizeProfile(profile)
  const banner = coverUrl(p.coverPath)
  const avatar = coverUrl(p.avatarPath)

  return (
    <div className="ytchan" dir="ltr">
      <div className="ytchan-banner">
        {banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt={p.name} className="ytchan-banner-img" />
        ) : (
          <div className="ytchan-banner-empty">באנר ערוץ · 2560 × 423</div>
        )}
      </div>

      <div className="ytchan-head">
        <div className="ytchan-avatar">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={p.name} className="ytchan-avatar-img" />
          ) : (
            <Initials name={p.name} className="ytchan-avatar-initials" />
          )}
        </div>
        <div className="ytchan-info">
          <h3 className="ytchan-name">{p.name || 'שם הערוץ'}</h3>
          <p className="ytchan-meta">
            {[p.handle, p.meta].filter(Boolean).join(' · ') || '@handle'}
          </p>
          {p.bio && <p className="ytchan-bio">{p.bio}</p>}
          <span className="ytchan-subscribe" aria-hidden>Subscribe</span>
        </div>
      </div>

      <div className="ytchan-tabs" aria-hidden>
        {['Home', 'Videos', 'Shorts', 'Playlists', 'About'].map((t, i) => (
          <span key={t} className={`ytchan-tab${i === 0 ? ' active' : ''}`}>{t}</span>
        ))}
      </div>
    </div>
  )
}

/** One entry point, so the slide renderers stay a single branch each. */
export default function SocialCover({
  kind,
  profile,
  title,
  description,
}: {
  kind: 'facebook_cover' | 'youtube_cover'
  profile?: ProfileBlock | null
  title?: string
  description?: string
}) {
  return (
    <div className="cover-mockup-slide">
      {title && <h2 className="slide-title rp-anim rp-in rp-d1">{title}</h2>}
      {description && <p className="dist-intro rp-anim rp-up rp-d1">{description}</p>}
      <div className="cover-mockup-frame rp-anim rp-up rp-d2">
        {kind === 'facebook_cover' ? <FacebookCover profile={profile} /> : <YouTubeCover profile={profile} />}
      </div>
    </div>
  )
}
