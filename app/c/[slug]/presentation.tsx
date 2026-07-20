'use client'

import './presentation.css'
import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideData } from '@/lib/slides'
import type { CampaignAsset } from '@/lib/campaigns'
import InstagramFeedMockup from './mockups/instagram-feed'
import InstagramStoryMockup from './mockups/instagram-story'
import FacebookFeedMockup from './mockups/facebook-feed'
import VideoPlayer from './mockups/VideoPlayer'
import CarouselFeed from './mockups/carousel-feed'
import GeneralCard from './mockups/general-card'
import { parseVideoUrl } from '@/lib/video-utils'
import { assetProxyUrl } from '@/lib/asset-url'
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

/** Convert a #RRGGBB (or #RGB) hex to an rgba() string. Falls back to the raw value. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Convert a #RRGGBB (or #RGB) hex to an 'R, G, B' triplet for rgba(var(--brand-rgb), a). */
function hexToRgbTriplet(hex: string): string | null {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

export default function CampaignPresentation({ slides, clientName, campaignName, brandColor, campaignId, feedbackEnabled, lang = 'he' }: Props) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const [activeSlide, setActiveSlide] = useState(0)
  const [lightboxAsset, setLightboxAsset] = useState<{ url: string; caption?: string; slideKey?: string; assetId?: string } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
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

  // ── Swipe navigation ──
  // The deck presents like Instagram stories, so a phone user's instinct is to
  // swipe. Direction follows the RTL layout and the on-screen arrows: "next"
  // points left, so a leftward drag advances.
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const SWIPE_MIN_PX = 60

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Never hijack a swipe that belongs to the carousel's own scroll track.
    if ((e.target as HTMLElement)?.closest?.('.carousel-track')) { touchStart.current = null; return }
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }, [])

  const goSlide = useCallback((n: number) => {
    setActiveSlide(n)
    // 'auto', not 'smooth': smooth scrolling is animation-frame driven, so with
    // animations paused the client stayed 1400px down the previous slide.
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || lightboxAsset) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    // Ignore short drags, and anything more vertical than horizontal — that's
    // the reader scrolling a tall creatives slide, not changing slide.
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5) return
    if (dx < 0) goSlide(Math.min(slides.length - 1, activeSlide + 1))
    else goSlide(Math.max(0, activeSlide - 1))
  }, [lightboxAsset, activeSlide, slides.length, goSlide])

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && lightboxAsset) { setLightboxAsset(null); return }
      // Route through goSlide so keyboard navigation also resets the scroll
      // position — otherwise arrow keys left the reader mid-way down the page.
      if (e.key === 'ArrowLeft') goSlide(Math.min(slides.length - 1, activeSlide + 1))
      if (e.key === 'ArrowRight') goSlide(Math.max(0, activeSlide - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, lightboxAsset, activeSlide, goSlide])

  useEffect(() => {
    let rafId = 0
    let pending = false
    function onMove(e: MouseEvent) {
      if (pending) return
      pending = true
      rafId = requestAnimationFrame(() => {
        setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
        pending = false
      })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafId) }
  }, [])


  function getSlideLabel(slide: SlideData, i: number): string {
    if (slide.type === 'cover') return t('public.cover')
    if (slide.type === 'concept') return t('public.concept')
    if (slide.type === 'closing') return t('public.closing')
    if (slide.type === 'divider') return slide.title || `${t('public.divider')} ${i}`
    return slide.title || `${t('public.section')} ${i}`
  }

  const parallaxX = (mousePos.x - 0.5) * -20
  const parallaxY = (mousePos.y - 0.5) * -20

  return (
    <>
      <div
        className="campaign-pres"
        style={brandColor ? ({
          '--brand-cyan': brandColor,
          '--brand-green': brandColor,
          '--border-color': `${hexToRgba(brandColor, 0.14)}`,
          ...(hexToRgbTriplet(brandColor) ? { '--brand-rgb': hexToRgbTriplet(brandColor) } : {}),
        } as React.CSSProperties) : undefined}
      >
        {/* Parallax background layers */}
        <div className="bg-noise" />
        <div className="bg-grid" style={{ transform: `translate(${parallaxX * 0.3}px, ${parallaxY * 0.3}px)` }} />
        <div className="ambient-light" style={{ transform: `translate(${parallaxX}px, ${parallaxY}px)` }} />
        <div className="ambient-light-2" style={{ transform: `translate(${parallaxX * -0.6}px, ${parallaxY * -0.6}px)` }} />
        <div className="ambient-light-3" style={{ transform: `translate(${parallaxX * 0.8}px, ${parallaxY * -0.8}px)` }} />

        {/* Story-style progress bars */}
        <div className="story-progress">
          {slides.map((slide, i) => (
            <button key={i} className="story-bar" onClick={() => goSlide(i)} title={getSlideLabel(slide, i)} aria-label={getSlideLabel(slide, i)}>
              <div className={`story-bar-fill ${i < activeSlide ? 'done' : i === activeSlide ? 'active' : ''}`} />
            </button>
          ))}
        </div>

        {/* Header */}
        <header className="pres-header">
          {/* The campaign takes the prominent slot — it's what the client came
              to review; the agency name sits on the opposite side. */}
          <div className="brand">{clientName} — {campaignName}</div>
          <div className="header-right">
            {/* The copy switcher used to live here, but a small pill in the
                header was easy to miss (especially on mobile) and appeared even
                on slides with no variants. It now sits inside the slide, next to
                the text it actually changes. */}
            {showFeedback && feedbackSlides.length > 0 && (
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
            )}
            <div className="campaign-badge">Results Digital</div>
          </div>
        </header>

        <main className="pres-main" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* Plain section keyed on the slide index: React swaps it immediately
              and the CSS class replays the transition. AnimatePresence with
              mode="wait" held the next slide until the previous one's exit
              animation finished — and when animations are paused (backgrounded
              tab, battery saver) that exit never completed, so the counter
              advanced but the deck never moved. */}
          <section key={activeSlide} className="slide active slide-enter">
            {slides[activeSlide].type === 'cover' && <CoverSlide slide={slides[activeSlide]} />}
            {slides[activeSlide].type === 'concept' && <ConceptSlide slide={slides[activeSlide]} />}
            {slides[activeSlide].type === 'divider' && <DividerSlide slide={slides[activeSlide]} index={activeSlide} />}
            {slides[activeSlide].type === 'creatives' && (
              <CreativesSlide slide={slides[activeSlide]} activeCopyIdx={activeCopyIdx} onActiveCopyChange={setActiveCopyIdx} onAssetClick={setLightboxAsset} lang={lang} />
            )}
            {slides[activeSlide].type === 'closing' && <ClosingSlide slide={slides[activeSlide]} />}
          </section>

          {showFeedback && isApprovable(slides[activeSlide]) && (
            <ApprovalBar
              key={slides[activeSlide].key}
              slideKey={slides[activeSlide].key as string}
              current={feedback[slides[activeSlide].key as string]}
              error={!!feedbackError[slides[activeSlide].key as string]}
              onSubmit={submitFeedback}
              reviewerName={reviewerName}
              onReviewerNameChange={updateReviewerName}
              lang={lang}
            />
          )}
        </main>

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

        {/* Bottom nav arrows */}
        <div className="slide-footer-nav">
          <button onClick={() => goSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="nav-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            {t('public.previous')}
          </button>
          <span className="slide-counter">{activeSlide + 1} / {slides.length}</span>
          <button onClick={() => goSlide(Math.min(slides.length - 1, activeSlide + 1))} disabled={activeSlide === slides.length - 1} className="nav-btn">
            {t('public.next')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        </div>

        {/* The closing slide carries its own sign-off, so the global footer
            would just repeat the same contact line underneath it. */}
        {slides[activeSlide].type !== 'closing' && (
          <footer className="pres-footer">
            <a href="https://www.resultsgroup.co.il" target="_blank" rel="noopener noreferrer">www.resultsgroup.co.il</a>
            <p>By Results Group</p>
          </footer>
        )}

        {/* Lightbox with pin annotations */}
        <AnimatePresence>
          {lightboxAsset && (
            <motion.div
              className="lightbox-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setLightboxAsset(null)}
            >
              <motion.div
                className="lightbox-content"
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
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

const PARTNER_LOGOS = [
  { src: '/partners/google.png', alt: 'Google Partner' },
  { src: '/partners/meta.png', alt: 'Meta Business Partner' },
  { src: '/partners/tiktok.png', alt: 'TikTok Marketing Partners' },
  { src: '/partners/wix.png', alt: 'Wix Partner' },
]

function PartnerLogos() {
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

function ResultsLogo() {
  // The real brand logo (yellow bars + arrow + "Results" wordmark) served from
  // /logo.png, instead of a hand-drawn imitation.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/logo.png" alt="Results" className="results-logo-img" />
}

function CoverSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="cover-slide-v2">
      {/* Fine inset gold frame — the "firm" cue */}
      <div className="cover-frame" aria-hidden />
      {/* Corner decorations */}
      <div className="cover-corner tl" />
      <div className="cover-corner tr" />
      <div className="cover-corner bl" />
      <div className="cover-corner br" />

      {/* Top bar */}
      <div className="cover-top-bar rp-anim rp-up rp-d1">
        <ResultsLogo />
      </div>

      {/* Main content */}
      <div className="cover-body">
        {/* Left: campaign info */}
        <div className="cover-left">
          <div className="cover-eyebrow rp-anim rp-in rp-d2">
            <span className="cover-eyebrow-dot" />
            {slide.date || 'Creative Campaign'}
          </div>
          <h1 className="cover-headline rp-anim rp-in rp-d3">
            {slide.subtitle || 'New Creative'}
          </h1>
          <div className="cover-meta-line rp-anim rp-up rp-d4">
            <span className="cover-client-name">{slide.title}</span>
            <span className="cover-meta-sep" aria-hidden />
            <span className="cover-by">By Results Group</span>
          </div>
          <div className="cover-h-rule rp-anim rp-wipe rp-d5" />
          <div className="rp-anim rp-up rp-d6">
            <PartnerLogos />
          </div>
        </div>

        {/* Right: client logo */}
        <div className="cover-right rp-anim rp-scale rp-d2">
          {slide.logoUrl ? (
            <img src={slide.logoUrl} alt={slide.title} className="cover-client-logo" />
          ) : (
            <div className="cover-client-initials">
              {(slide.title || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      </div>

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

function CreativesSlide({ slide, activeCopyIdx, onActiveCopyChange, onAssetClick, lang = 'he' }: {
  slide: SlideData
  activeCopyIdx: number
  onActiveCopyChange: (idx: number) => void
  onAssetClick: (a: { url: string; caption?: string; slideKey?: string; assetId?: string }) => void
  lang?: 'he' | 'en'
}) {
  const dict = lang === 'en' ? en : he
  const t = (key: keyof typeof he) => dict[key] ?? he[key] ?? key
  const assets = slide.assets || []
  const isStory = slide.mockupType === 'instagram_story'
  const isCarousel = slide.mockupType === 'carousel'
  const copies = slide.copies || []
  // activeCopy is set only when this slide has copies enabled
  const activeCopy = copies.length > 0 ? (copies[activeCopyIdx] ?? copies[0] ?? '') : undefined

  return (
    <div>
      {slide.title && (
        <h2 className="slide-title rp-anim rp-in rp-d1">
          {slide.title}
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
            {copies.map((_, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={activeCopyIdx === i}
                className={`copy-switch-btn${activeCopyIdx === i ? ' active' : ''}`}
                onClick={() => onActiveCopyChange(i)}
              >
                {t('public.copyVersion')} {i + 1}
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
            caption={activeCopy !== undefined ? activeCopy : (assets[0]?.caption || '')}
          />
        </div>
      )}

      {assets.length > 0 && !isCarousel && (
        <div className={`assets-grid ${isStory ? 'story-grid' : 'standard-grid'} count-${Math.min(assets.length, 4)}`}>
          {assets.map((asset, i) => (
            <div
              key={asset.id}
              className="mockup-wrapper rp-anim rp-up"
              onClick={() => {
                const url = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
                if (url && asset.type !== 'video') onAssetClick({ url, caption: activeCopy || asset.caption, slideKey: slide.key, assetId: asset.id })
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
                captionOverride={activeCopy}
              />
            </div>
          ))}
        </div>
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
function ClosingSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="closing-slide-v2">
      <div className="cover-frame" aria-hidden />
      <div className="closing-glow-center" aria-hidden />

      <div className="closing-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Results" className="closing-logo rp-anim rp-up rp-d1" />

        <h1 className="closing-headline rp-anim rp-up rp-d3">{slide.title}</h1>

        {slide.subtitle && (
          <p className="closing-client rp-anim rp-up rp-d4">{slide.subtitle}</p>
        )}

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

