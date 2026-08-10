'use client'

import './presentation.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideData } from '@/lib/slides'
import type { CampaignAsset } from '@/lib/campaigns'
import InstagramFeedMockup from './mockups/instagram-feed'
import InstagramStoryMockup from './mockups/instagram-story'
import InstagramReelsMockup from './mockups/instagram-reels'
import LandingPageMockup from './mockups/landing-page-mockup'
import FacebookFeedMockup from './mockups/facebook-feed'
import VideoPlayer from './mockups/VideoPlayer'
import { CaptionExpansionProvider } from './mockups/AdCaption'
import CarouselFeed from './mockups/carousel-feed'
import GeneralCard from './mockups/general-card'
import DistributionSlide from './distribution-slide'
import StatsSlide from './stats-slide'
import SocialCover from './mockups/social-cover'
import { parseVideoUrl } from '@/lib/video-utils'
import { assetProxyUrl } from '@/lib/asset-url'
import DeckShell from '@/app/_deck/DeckShell'
import { CoverSlide, ClosingSlide } from '@/app/_deck/cover-slide'
import he from '@/lib/i18n/he'
import en from '@/lib/i18n/en'

interface Props {
  slides: SlideData[]
  clientName: string
  campaignName: string
  brandColor?: string | null
  campaignId?: string
  feedbackEnabled?: boolean
  lang?: 'he' | 'en'
}

type FeedbackStatus = 'approved' | 'rejected' | 'pending'
interface SlideFeedback { slide_key: string; status: FeedbackStatus; comment: string | null; author: string | null }
interface SlidePin { id: string; slide_key: string; asset_id: string | null; x: number; y: number; comment: string | null; author: string | null; resolved: boolean }

export default function CampaignPresentation({ slides, clientName, campaignName, brandColor, campaignId, feedbackEnabled, lang = 'he' }: Props) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const [lightboxAsset, setLightboxAsset] = useState<{ url: string; caption?: string; slideKey?: string; assetId?: string } | null>(null)
  const [feedback, setFeedback] = useState<Record<string, SlideFeedback>>({})
  const [feedbackError, setFeedbackError] = useState<Record<string, boolean>>({})
  const [pins, setPins] = useState<SlidePin[]>([])
  // Reviewer name — remembered across slides and visits (per campaign)
  const [reviewerName, setReviewerName] = useState('')
  const [doneDismissed, setDoneDismissed] = useState(false)
  // Selected copy variant, shared across slides so the choice sticks as the
  // client moves through the deck.
  const [activeCopyIdx, setActiveCopyIdx] = useState(0)

  const showFeedback = Boolean(feedbackEnabled && campaignId)

  /**
   * A deck that reports numbers gets a named tab bar and a centred cover; a
   * creative presentation keeps the story bars and the split cover.
   *
   * Derived from the content rather than stored as a per-campaign setting: a
   * launch report is exactly a deck that carries stats slides, and a creative
   * deck never does. A stored flag would only restate what the sections already
   * say — and could then contradict them, which is the failure mode this
   * codebase keeps hitting (see the paging note in lib/slides.ts).
   */
  const isReport = slides.some(s => s.type === 'stats')

  // Remember the reviewer's name locally so they type it once, ever
  const reviewerKey = campaignId ? `rp_reviewer_${campaignId}` : ''
  useEffect(() => {
    if (!reviewerKey) return
    try { const v = localStorage.getItem(reviewerKey); if (v) setReviewerName(v) } catch { /* ignore */ }
  }, [reviewerKey])
  const updateReviewerName = useCallback((name: string) => {
    setReviewerName(name)
    try { if (reviewerKey) localStorage.setItem(reviewerKey, name) } catch { /* ignore */ }
  }, [reviewerKey])

  useEffect(() => {
    if (!showFeedback || !campaignId) return
    fetch(`/api/campaigns/${campaignId}/feedback`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: SlideFeedback[]) => {
        const map: Record<string, SlideFeedback> = {}
        for (const r of rows) map[r.slide_key] = r
        setFeedback(map)
      })
      .catch(() => {})
    fetch(`/api/campaigns/${campaignId}/pins`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: SlidePin[]) => Array.isArray(rows) && setPins(rows))
      .catch(() => {})
  }, [showFeedback, campaignId])

  const addPin = useCallback(async (pin: { slideKey: string; assetId?: string; x: number; y: number; comment: string; author: string }) => {
    if (!campaignId) return
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/pins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide_key: pin.slideKey, asset_id: pin.assetId, x: pin.x, y: pin.y, comment: pin.comment, author: pin.author }),
      })
      if (res.ok) { const saved: SlidePin = await res.json(); setPins(prev => [...prev, saved]) }
    } catch { /* ignore */ }
  }, [campaignId])

  const removePin = useCallback(async (pinId: string) => {
    if (!campaignId) return
    setPins(prev => prev.filter(p => p.id !== pinId))
    try {
      await fetch(`/api/campaigns/${campaignId}/pins`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pinId }),
      })
    } catch { /* ignore */ }
  }, [campaignId])

  const submitFeedback = useCallback(async (slideKey: string, status: FeedbackStatus, comment: string, author: string) => {
    if (!campaignId) return
    let prevEntry: SlideFeedback | undefined
    setFeedback(prev => {
      prevEntry = prev[slideKey]
      return { ...prev, [slideKey]: { slide_key: slideKey, status, comment, author } }
    })
    setFeedbackError(prev => ({ ...prev, [slideKey]: false }))
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slide_key: slideKey, status, comment, author }),
      })
      if (!res.ok) throw new Error(`feedback save failed: ${res.status}`)
    } catch {
      // Revert the optimistic entry and surface an error indicator
      setFeedback(prev => {
        const next = { ...prev }
        if (prevEntry) next[slideKey] = prevEntry
        else delete next[slideKey]
        return next
      })
      setFeedbackError(prev => ({ ...prev, [slideKey]: true }))
    }
  }, [campaignId])

  // Escape closes the lightbox. DeckShell owns Escape for its own slide index;
  // this listener runs first because the lightbox is the topmost surface.
  useEffect(() => {
    if (!lightboxAsset) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightboxAsset(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxAsset])

  // Approval progress across all feedback-enabled (creative) slides
  // Divider slides are just section breaks — there's nothing to approve on them,
  // so they're excluded from the approval flow and the approved/total counter.
  const isApprovable = (s: SlideData) => !!s.key && s.type !== 'divider'
  const feedbackSlides = showFeedback ? slides.filter(isApprovable) : []
  const approvedCount = feedbackSlides.filter(s => feedback[s.key as string]?.status === 'approved').length
  const allApproved = feedbackSlides.length > 0 && approvedCount === feedbackSlides.length

  function approveAllRemaining() {
    const toApprove = feedbackSlides.filter(s => feedback[s.key as string]?.status !== 'approved')
    if (!toApprove.length || !campaignId) return
    // Optimistic: mark them all approved locally
    setFeedback(prev => {
      const next = { ...prev }
      for (const s of toApprove) {
        const k = s.key as string
        next[k] = { slide_key: k, status: 'approved', comment: prev[k]?.comment ?? null, author: reviewerName }
      }
      return next
    })
    // One bulk request → the server posts a single Monday summary, not one per slide
    fetch(`/api/campaigns/${campaignId}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bulk: toApprove.map(s => ({ slide_key: s.key, status: 'approved', comment: feedback[s.key as string]?.comment || '', author: reviewerName })),
      }),
    }).catch(() => {})
  }

  function getSlideLabel(slide: SlideData): string {
    if (slide.type === 'cover') return t('public.cover')
    if (slide.type === 'concept') return t('public.concept')
    if (slide.type === 'closing') return t('public.closing')
    if (slide.type === 'divider') return slide.title || ''
    if (slide.type === 'distribution') return slide.title || t('public.dist.title')
    if (slide.type === 'stats') return slide.title || t('public.stats.title')
    if (slide.type === 'cover_mockup') return slide.title || t('public.coverMockup.title')
    // Untitled slides carry no name at all: the fallback used to read
    // "סקציה 4", numbered by position in the deck rather than by section, so
    // two halves of one section came out as "סקציה 3" and "סקציה 4". The index
    // already numbers every row — an invented name only misinforms.
    const base = slide.title || ''
    // A section spanning several screens repeats its name, so say which part
    // this is — otherwise the index lists the same title six times over.
    return base && slide.partsTotal
      ? `${base} · ${slide.part} ${t('public.partOf')} ${slide.partsTotal}`
      : base
  }

  return (
    <DeckShell
      count={slides.length}
      labelFor={i => getSlideLabel(slides[i])}
      headerTitle={`${clientName} — ${campaignName}`}
      brandColor={brandColor}
      lang={lang}
      nav={isReport ? 'tabs' : 'story'}
      // The lightbox is the topmost surface: while it's open, arrows and swipes
      // belong to it, not to the deck underneath.
      navLocked={!!lightboxAsset}
      // The closing slide carries its own sign-off.
      hideFooterOn={i => slides[i].type === 'closing'}
      headerExtra={showFeedback && feedbackSlides.length > 0 ? (
        <div className={`approval-progress${allApproved ? ' complete' : ''}`}>
          <span className="approval-progress-count">
            {allApproved ? `✓ ${t('public.allApprovedShort')}` : `${t('public.approvedLabel')} ${approvedCount}/${feedbackSlides.length}`}
          </span>
          <div className="approval-progress-track">
            <div className="approval-progress-fill" style={{ width: `${feedbackSlides.length ? (approvedCount / feedbackSlides.length) * 100 : 0}%` }} />
          </div>
          {!allApproved && (
            <button className="approve-all-btn" onClick={approveAllRemaining}>{t('public.approveAll')}</button>
          )}
        </div>
      ) : undefined}
      renderSlide={i => (
        <>
          {slides[i].type === 'cover' && (
            <CoverSlide
              clientName={slides[i].title}
              headline={slides[i].subtitle || 'New Creative'}
              eyebrow={slides[i].date || 'Creative Campaign'}
              logoUrl={slides[i].logoUrl}
              variant={isReport ? 'report' : 'default'}
            />
          )}
          {slides[i].type === 'concept' && <ConceptSlide slide={slides[i]} />}
          {slides[i].type === 'divider' && <DividerSlide slide={slides[i]} index={i} />}
          {slides[i].type === 'distribution' && (
            <DistributionSlide
              plan={slides[i].plan}
              title={slides[i].title}
              description={slides[i].content}
              lang={lang}
            />
          )}
          {slides[i].type === 'stats' && (
            <StatsSlide
              stats={slides[i].stats}
              title={slides[i].title}
              description={slides[i].content}
              lang={lang}
            />
          )}
          {slides[i].type === 'cover_mockup' && (
            <SocialCover
              kind={slides[i].mockupType as 'facebook_cover' | 'youtube_cover'}
              profile={slides[i].profile}
              title={slides[i].title}
              description={slides[i].content}
            />
          )}
          {slides[i].type === 'creatives' && (
            <CreativesSlide slide={slides[i]} activeCopyIdx={activeCopyIdx} onActiveCopyChange={setActiveCopyIdx} onAssetClick={setLightboxAsset} lang={lang} plain={isReport} />
          )}
          {slides[i].type === 'closing' && (
            <ClosingSlide title={slides[i].title} clientName={slides[i].subtitle} />
          )}
        </>
      )}
      renderBelowSlide={i => (showFeedback && isApprovable(slides[i]) ? (
        <ApprovalBar
          key={slides[i].key}
          slideKey={slides[i].key as string}
          current={feedback[slides[i].key as string]}
          error={!!feedbackError[slides[i].key as string]}
          onSubmit={submitFeedback}
          reviewerName={reviewerName}
          onReviewerNameChange={updateReviewerName}
          lang={lang}
        />
      ) : null)}
      overlays={
        <>
          {/* All-approved confirmation */}
          <AnimatePresence>
            {showFeedback && allApproved && !doneDismissed && (
              <motion.div
                className="approval-done-banner"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <span className="approval-done-check">✓</span>
                <span>{t('public.allApproved')}</span>
                <button className="approval-done-close" onClick={() => setDoneDismissed(true)} aria-label="✕">✕</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lightbox with pin annotations */}
          <AnimatePresence>
            {lightboxAsset && (
              <div className="lightbox-overlay" onClick={() => setLightboxAsset(null)}>
                <motion.div
                  className="lightbox-content"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  onClick={e => e.stopPropagation()}
                >
                  <PinnableImage
                    asset={lightboxAsset}
                    pins={pins.filter(p => p.slide_key === lightboxAsset.slideKey && (!lightboxAsset.assetId || p.asset_id === lightboxAsset.assetId))}
                    canPin={showFeedback}
                    reviewerName={reviewerName}
                    onReviewerNameChange={updateReviewerName}
                    onAddPin={addPin}
                    onRemovePin={removePin}
                    lang={lang}
                  />
                  {lightboxAsset.caption && <p className="lightbox-caption">{lightboxAsset.caption}</p>}
                  <button className="lightbox-close" onClick={() => setLightboxAsset(null)}>✕</button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      }
    />
  )
}

function ApprovalBar({ slideKey, current, error, onSubmit, reviewerName, onReviewerNameChange, lang = 'he' }: {
  slideKey: string
  current?: SlideFeedback
  error?: boolean
  onSubmit: (slideKey: string, status: FeedbackStatus, comment: string, author: string) => void
  reviewerName: string
  onReviewerNameChange: (name: string) => void
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const [comment, setComment] = useState(current?.comment || '')
  const [touched, setTouched] = useState(false)
  const [showComment, setShowComment] = useState(false)
  // Intent set by "needs change" so the rejection is only submitted when the client saves —
  // clicking it no longer fires an immediate reject.
  const [intent, setIntent] = useState<FeedbackStatus | null>(null)
  const status = current?.status || 'pending'

  // Hydrate the comment once the async feedback fetch lands — unless the user already typed
  useEffect(() => {
    if (touched || !current) return
    setComment(current.comment || '')
  }, [current, touched])

  // Never wipe an existing comment with an empty string on save
  const effectiveComment = comment.trim() ? comment : (current?.comment || '')

  return (
    <div className="approval-bar">
      <div className="approval-actions">
        <button
          className={`approval-btn approve ${status === 'approved' ? 'active' : ''}`}
          onClick={() => { setIntent(null); onSubmit(slideKey, 'approved', effectiveComment, reviewerName) }}
        >
          {'✓ ' + t('public.approved')}
        </button>
        <button
          className={`approval-btn reject ${status === 'rejected' || intent === 'rejected' ? 'active' : ''}`}
          onClick={() => { setIntent('rejected'); setShowComment(true) }}
        >
          {'✕ ' + t('public.needsChange')}
        </button>
        <button className="approval-btn comment-toggle" onClick={() => setShowComment(s => !s)}>
          {'💬 ' + t('public.comment')}
        </button>
      </div>

      {(showComment || comment) && (
        <div className="approval-comment">
          <input
            className="approval-input"
            placeholder={t('public.yourName')}
            value={reviewerName}
            onChange={e => onReviewerNameChange(e.target.value)}
          />
          <textarea
            className="approval-textarea"
            placeholder={t('public.addComment')}
            value={comment}
            onChange={e => { setTouched(true); setComment(e.target.value) }}
            rows={2}
          />
          <button
            className="approval-save"
            onClick={() => { onSubmit(slideKey, intent ?? status, effectiveComment, reviewerName); setIntent(null) }}
          >
            {intent === 'rejected' ? t('public.sendChangeRequest') : t('public.saveComment')}
          </button>
        </div>
      )}

      {error && (
        <div className="approval-error">{t('public.saveError')}</div>
      )}

      {current && (
        <div className={`approval-status-badge ${status}`}>
          {status === 'approved' ? t('public.approvedByClient') : status === 'rejected' ? t('public.changeRequired') : t('public.pendingApproval')}
          {current.author ? ` · ${current.author}` : ''}
        </div>
      )}
    </div>
  )
}

/** Lightbox image with Figma-style pin comments overlaid on the creative. */
function PinnableImage({ asset, pins, canPin, reviewerName, onReviewerNameChange, onAddPin, onRemovePin, lang = 'he' }: {
  asset: { url: string; caption?: string; slideKey?: string; assetId?: string }
  pins: SlidePin[]
  canPin: boolean
  reviewerName: string
  onReviewerNameChange: (name: string) => void
  onAddPin: (pin: { slideKey: string; assetId?: string; x: number; y: number; comment: string; author: string }) => void
  onRemovePin: (id: string) => void
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pinMode, setPinMode] = useState(false)
  const [draft, setDraft] = useState<{ x: number; y: number; comment: string } | null>(null)
  const [openPin, setOpenPin] = useState<string | null>(null)

  const canAnnotate = canPin && !!asset.slideKey

  function handleImageClick(e: React.MouseEvent) {
    if (!pinMode || !wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
    setDraft({ x, y, comment: '' })
    setOpenPin(null)
  }

  function saveDraft() {
    if (!draft || !asset.slideKey) return
    const text = draft.comment.trim()
    if (!text) { setDraft(null); return }
    onAddPin({ slideKey: asset.slideKey, assetId: asset.assetId, x: draft.x, y: draft.y, comment: text, author: reviewerName })
    setDraft(null)
    setPinMode(false)
  }

  return (
    <div className="pin-stage">
      {canAnnotate && (
        <div className="pin-toolbar">
          <button
            className={`pin-mode-btn${pinMode ? ' active' : ''}`}
            onClick={() => { setPinMode(m => !m); setDraft(null) }}
          >
            {pinMode ? `✕ ${t('public.pinModeExit')}` : `📍 ${t('public.pinAdd')}`}
          </button>
          {pins.length > 0 && <span className="pin-count">{pins.length} {t('public.pinCount')}</span>}
        </div>
      )}

      <div
        ref={wrapRef}
        className={`pin-image-wrap${pinMode ? ' pinning' : ''}`}
        onClick={handleImageClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.url} alt={asset.caption || ''} className="lightbox-img" draggable={false} />

        {/* Existing pins */}
        {pins.map((p, i) => (
          <div key={p.id} className="pin-marker-wrap" style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}>
            <button
              className={`pin-marker${p.resolved ? ' resolved' : ''}`}
              onClick={e => { e.stopPropagation(); setOpenPin(openPin === p.id ? null : p.id); setDraft(null) }}
            >
              {i + 1}
            </button>
            {openPin === p.id && (
              <div className="pin-popover" onClick={e => e.stopPropagation()}>
                <p className="pin-popover-comment" dir="auto">{p.comment}</p>
                <div className="pin-popover-foot">
                  {p.author && <span className="pin-popover-author">{p.author}</span>}
                  <button className="pin-popover-del" onClick={() => { onRemovePin(p.id); setOpenPin(null) }}>{t('public.pinDelete')}</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Draft pin being composed */}
        {draft && (
          <div className="pin-marker-wrap" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }}>
            <div className="pin-marker draft">•</div>
            <div className="pin-popover" onClick={e => e.stopPropagation()}>
              <input
                className="pin-input"
                placeholder={t('public.yourName')}
                value={reviewerName}
                onChange={e => onReviewerNameChange(e.target.value)}
              />
              <textarea
                className="pin-textarea"
                placeholder={t('public.pinPlaceholder')}
                value={draft.comment}
                onChange={e => setDraft(d => d ? { ...d, comment: e.target.value } : d)}
                rows={2}
                autoFocus
              />
              <div className="pin-popover-foot">
                <button className="pin-cancel" onClick={() => setDraft(null)}>{t('public.pinCancel')}</button>
                <button className="pin-save" onClick={saveDraft}>{t('public.pinSave')}</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {canAnnotate && pinMode && !draft && (
        <p className="pin-hint">{t('public.pinHint')}</p>
      )}
    </div>
  )
}

function ConceptSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="concept-slide">
      <h2 className="slide-title rp-anim rp-in rp-d1">
        {slide.title}
      </h2>
      <div className="concept-card rp-anim rp-up rp-d2">
        <p>{slide.content}</p>
      </div>
    </div>
  )
}

function DividerSlide({ slide, index }: { slide: SlideData; index: number }) {
  const num = String(index).padStart(2, '0')
  return (
    <div className="divider-slide">
      <div className="divider-glow" />
      <span className="divider-number">{num}</span>
      <h2 className="divider-title rp-anim rp-up rp-d1">
        {slide.title}
      </h2>
      {slide.content && (
        <p className="divider-desc rp-anim rp-up rp-d2">
          {slide.content}
        </p>
      )}
      <div className="divider-line rp-anim rp-wipe rp-d3" />
    </div>
  )
}

function CreativesSlide({ slide, activeCopyIdx, onActiveCopyChange, onAssetClick, lang = 'he', plain = false }: {
  slide: SlideData
  activeCopyIdx: number
  onActiveCopyChange: (idx: number) => void
  onAssetClick: (a: { url: string; caption?: string; slideKey?: string; assetId?: string }) => void
  lang?: 'he' | 'en'
  /**
   * Report decks show the work itself — a large bare player / clean image with
   * its caption as a heading, exactly like the hand-built launch reports. The
   * platform mockup chrome (Facebook card, Instagram frame) belongs to
   * creative-approval decks, where "how it looks in the feed" is the point.
   */
  plain?: boolean
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const assets = slide.assets || []
  const isStory = slide.mockupType === 'instagram_story'
  const isCarousel = slide.mockupType === 'carousel'
  // A laptop + phone pair needs the full slide width; the standard grid caps a
  // single creative at 520px, which broke the pair onto two rows.
  const isLanding = slide.mockupType === 'landing_page'
  const copies = slide.copies || []
  // activeCopy is set only when this slide has at least one copy targeted.
  const activeCopy = copies.length > 0 ? (copies[activeCopyIdx] ?? copies[0]) : undefined
  const activeCopyBody = activeCopy?.body

  return (
    <div>
      {slide.title && (
        <h2 className="slide-title rp-anim rp-in rp-d1">
          {slide.title}
          {slide.partsTotal && (
            <span className="slide-part">{slide.part}/{slide.partsTotal}</span>
          )}
        </h2>
      )}
      {slide.content && (
        <p className="slide-intro rp-anim rp-up rp-d2">
          {slide.content}
        </p>
      )}

      {/* Copy switcher, in context: it sits right above the creatives whose text
          it swaps, only on slides that actually have variants. */}
      {copies.length > 1 && (
        <div className="copy-switch rp-anim rp-up">
          <span className="copy-switch-label">{t('public.copyLabel')}</span>
          <div className="copy-switch-options" role="tablist">
            {copies.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={activeCopyIdx === i}
                className={`copy-switch-btn${activeCopyIdx === i ? ' active' : ''}`}
                onClick={() => onActiveCopyChange(i)}
              >
                {c.label.trim() || `${t('public.copyVersion')} ${i + 1}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* A carousel is one post containing every creative, so it renders as a
          single mockup rather than the per-asset grid. */}
      {assets.length > 0 && isCarousel && (
        <div className="carousel-slide-wrap rp-anim rp-up rp-d1">
          <CarouselFeed
            images={assets
              .map(a => (a.file_path ? assetProxyUrl(a.file_path) : (a.public_url || '')))
              .filter(Boolean)}
            clientName={slide.clientName || ''}
            logoUrl={slide.clientLogoUrl || undefined}
            caption={activeCopyBody !== undefined ? activeCopyBody : (assets[0]?.caption || '')}
          />
        </div>
      )}

      {/* Report showcase: the creative itself, full width, caption as a small
          accent heading above — videos stacked one per row, graphics in a
          two-up grid. No feed chrome. */}
      {assets.length > 0 && plain && !isCarousel && (
        <div className={slide.mockupType === 'video' || slide.mockupType === 'instagram_reels' ? 'showcase-stack' : 'showcase-grid'}>
          {assets.map((asset, i) => {
            const imageUrl = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
            const videoInfo = asset.url ? parseVideoUrl(asset.url) : null
            const isVideo = asset.type === 'video' || !!videoInfo
            return (
              <figure key={asset.id} className="showcase-item rp-anim rp-up" style={{ animationDelay: `${Math.min(i, 6) * 0.08}s` }}>
                {asset.caption && <figcaption className="showcase-cap">{asset.caption}</figcaption>}
                {isVideo ? (
                  <div className="showcase-frame is-video">
                    <VideoPlayer
                      url={asset.url || ''}
                      embedUrl={videoInfo?.embedUrl}
                      platform={videoInfo?.platform || 'other'}
                    />
                  </div>
                ) : (
                  <div
                    className="showcase-frame"
                    onClick={() => imageUrl && onAssetClick({ url: imageUrl, caption: asset.caption, slideKey: slide.key, assetId: asset.id })}
                    style={{ cursor: imageUrl ? 'pointer' : 'default' }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt={asset.caption || ''} className="showcase-img" />
                  </div>
                )}
              </figure>
            )
          })}
        </div>
      )}

      {/* One expansion state for the whole grid: the mockups sit side by side
          showing the same copy, and expanding one alone left the pair at
          different heights. */}
      {assets.length > 0 && !isCarousel && !plain && (
        <CaptionExpansionProvider>
        <div className={`assets-grid ${isStory ? 'story-grid' : isLanding ? 'landing-grid' : 'standard-grid'} count-${Math.min(assets.length, 4)}`}>
          {assets.map((asset, i) => (
            <div
              key={asset.id}
              className="mockup-wrapper rp-anim rp-up"
              onClick={() => {
                const url = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
                if (url && asset.type !== 'video') onAssetClick({ url, caption: activeCopyBody || asset.caption, slideKey: slide.key, assetId: asset.id })
              }}
              style={{
                cursor: asset.type !== 'video' ? 'pointer' : 'default',
                // Stagger without JS — Framer's rAF-driven variants left mockups
                // below the fold stranded at opacity 0 when animations were paused.
                animationDelay: `${Math.min(i, 6) * 0.08}s`,
              }}
            >
              <AssetRenderer
                asset={asset}
                mockupType={slide.mockupType || 'general'}
                clientLogoUrl={slide.clientLogoUrl || null}
                clientName={slide.clientName || ''}
                captionOverride={activeCopyBody}
              />
            </div>
          ))}
        </div>
        </CaptionExpansionProvider>
      )}
    </div>
  )
}

/**
 * Closing slide — same brand language as the cover (dark ground, gold accents,
 * inset frame, Ping) but a deliberately different composition: a centred
 * sign-off instead of the cover's asymmetric two-column. It doesn't repeat the
 * cover's badge pill, corner brackets, partner row or client-logo panel.
 */
function AssetRenderer({ asset, mockupType, clientLogoUrl, clientName, captionOverride }: {
  asset: CampaignAsset; mockupType: string; clientLogoUrl: string | null; clientName: string; captionOverride?: string
}) {
  const imageUrl = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
  const videoInfo = asset.url ? parseVideoUrl(asset.url) : null
  const caption = captionOverride !== undefined ? captionOverride : (asset.caption || '')

  switch (mockupType) {
    case 'instagram_feed':
      return <InstagramFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={caption} />
    case 'instagram_story':
      return <InstagramStoryMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} />
    case 'instagram_reels':
      return (
        <InstagramReelsMockup
          videoUrl={asset.url || undefined}
          embedUrl={videoInfo?.embedUrl}
          platform={videoInfo?.platform}
          posterUrl={imageUrl || undefined}
          clientName={clientName}
          logoUrl={clientLogoUrl ?? undefined}
          caption={caption}
        />
      )
    case 'landing_page':
      return <LandingPageMockup url={asset.url || undefined} caption={caption} />
    case 'facebook_feed':
      return <FacebookFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={caption} />
    case 'video':
      // Video ads run in the feed like any other placement, so present them in
      // the Facebook feed chrome with the player in the media slot.
      return (
        <FacebookFeedMockup
          imageUrl=""
          clientName={clientName}
          logoUrl={clientLogoUrl ?? undefined}
          caption={caption}
          media={
            <VideoPlayer
              url={asset.url || ''}
              embedUrl={videoInfo?.embedUrl}
              platform={videoInfo?.platform || 'other'}
            />
          }
        />
      )
    case 'general':
    default:
      return <GeneralCard imageUrl={imageUrl} caption={caption} />
  }
}

