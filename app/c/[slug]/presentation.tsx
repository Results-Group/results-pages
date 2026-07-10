'use client'

import './presentation.css'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideData } from '@/lib/slides'
import type { CampaignAsset } from '@/lib/campaigns'
import InstagramFeedMockup from './mockups/instagram-feed'
import InstagramStoryMockup from './mockups/instagram-story'
import FacebookFeedMockup from './mockups/facebook-feed'
import VideoCard from './mockups/video-card'
import GeneralCard from './mockups/general-card'
import { parseVideoUrl } from '@/lib/video-utils'
import { assetProxyUrl } from '@/lib/asset-url'

interface Props {
  slides: SlideData[]
  clientName: string
  campaignName: string
  brandColor?: string | null
  campaignId?: string
  feedbackEnabled?: boolean
}

type FeedbackStatus = 'approved' | 'rejected' | 'pending'
interface SlideFeedback { slide_key: string; status: FeedbackStatus; comment: string | null; author: string | null }

const slideVariants = {
  enter: { opacity: 0, y: 30, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
}

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

const staggerChild = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
}

export default function CampaignPresentation({ slides, clientName, campaignName, brandColor, campaignId, feedbackEnabled }: Props) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [lightboxAsset, setLightboxAsset] = useState<{ url: string; caption?: string } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const [feedback, setFeedback] = useState<Record<string, SlideFeedback>>({})
  const [feedbackError, setFeedbackError] = useState<Record<string, boolean>>({})
  // Global copy switcher — shared across all slides that have copies enabled
  const [activeCopyIdx, setActiveCopyIdx] = useState(0)
  // Collect all copies from any slide (they're all the same set from campaign meta)
  const globalCopies = slides.find(s => s.copies?.length)?.copies || []

  const showFeedback = Boolean(feedbackEnabled && campaignId)

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
  }, [showFeedback, campaignId])

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

  const goSlide = useCallback((n: number) => {
    setActiveSlide(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'Escape' && lightboxAsset) { setLightboxAsset(null); return }
      if (e.key === 'ArrowLeft') setActiveSlide(s => Math.min(slides.length - 1, s + 1))
      if (e.key === 'ArrowRight') setActiveSlide(s => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length, lightboxAsset])

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

  async function handleExportPdf() {
    setExporting(true)
    document.body.classList.add('printing-all-slides')
    try {
      if (document.fonts?.ready) await document.fonts.ready
      await new Promise(r => setTimeout(r, 150))
      window.print()
    } finally {
      document.body.classList.remove('printing-all-slides')
      setExporting(false)
    }
  }

  function getSlideIcon(slide: SlideData): string {
    if (slide.type === 'cover') return '◉'
    if (slide.type === 'concept') return '◎'
    if (slide.type === 'closing') return '✦'
    if (slide.type === 'divider') return '—'
    return '◻'
  }

  function getSlideLabel(slide: SlideData, i: number): string {
    if (slide.type === 'cover') return 'שער'
    if (slide.type === 'concept') return 'קונספט'
    if (slide.type === 'closing') return 'סיום'
    if (slide.type === 'divider') return slide.title || `חוצץ ${i}`
    return slide.title || `סקציה ${i}`
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
          {slides.map((_, i) => (
            <button key={i} className="story-bar" onClick={() => goSlide(i)}>
              <div className={`story-bar-fill ${i < activeSlide ? 'done' : i === activeSlide ? 'active' : ''}`} />
            </button>
          ))}
        </div>

        {/* Header */}
        <header className="pres-header">
          <div className="brand">Results Digital</div>
          <div className="header-right">
            {/* Global copy switcher — shown only when campaign has copies */}
            {globalCopies.length > 1 && (
              <div className="global-copy-switcher">
                <span className="global-copy-label">קופי:</span>
                {globalCopies.map((_, i) => (
                  <button
                    key={i}
                    className={`global-copy-btn${activeCopyIdx === i ? ' active' : ''}`}
                    onClick={() => setActiveCopyIdx(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
            <div className="campaign-badge">{clientName} — {campaignName}</div>
            <button className="pdf-btn" onClick={handleExportPdf} disabled={exporting}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {exporting ? 'מכין...' : 'ייצוא PDF'}
            </button>
          </div>
        </header>

        {/* Floating dock navigation */}
        <nav className="floating-dock">
          {slides.map((slide, i) => (
            <button
              key={i}
              className={`dock-item ${activeSlide === i ? 'active' : ''}`}
              onClick={() => goSlide(i)}
              title={getSlideLabel(slide, i)}
            >
              <span className="dock-icon">{getSlideIcon(slide)}</span>
              <span className="dock-label">{getSlideLabel(slide, i)}</span>
            </button>
          ))}
        </nav>

        <main className="pres-main">
          <AnimatePresence mode="wait">
            <motion.section
              key={activeSlide}
              className="slide active"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              {slides[activeSlide].type === 'cover' && <CoverSlide slide={slides[activeSlide]} />}
              {slides[activeSlide].type === 'concept' && <ConceptSlide slide={slides[activeSlide]} />}
              {slides[activeSlide].type === 'divider' && <DividerSlide slide={slides[activeSlide]} index={activeSlide} />}
              {slides[activeSlide].type === 'creatives' && (
                <CreativesSlide slide={slides[activeSlide]} activeCopyIdx={activeCopyIdx} onAssetClick={setLightboxAsset} />
              )}
              {slides[activeSlide].type === 'closing' && <ClosingSlide slide={slides[activeSlide]} />}
            </motion.section>
          </AnimatePresence>

          {showFeedback && slides[activeSlide].key && (
            <ApprovalBar
              key={slides[activeSlide].key}
              slideKey={slides[activeSlide].key as string}
              current={feedback[slides[activeSlide].key as string]}
              error={!!feedbackError[slides[activeSlide].key as string]}
              onSubmit={submitFeedback}
            />
          )}
        </main>

        {/* Bottom nav arrows */}
        <div className="slide-footer-nav">
          <button onClick={() => goSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className="nav-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
            הקודם
          </button>
          <span className="slide-counter">{activeSlide + 1} / {slides.length}</span>
          <button onClick={() => goSlide(Math.min(slides.length - 1, activeSlide + 1))} disabled={activeSlide === slides.length - 1} className="nav-btn">
            הבא
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
        </div>

        <footer className="pres-footer">
          <a href="https://www.resultsgroup.co.il" target="_blank" rel="noopener noreferrer">www.resultsgroup.co.il</a>
          <p>By Results Group</p>
        </footer>

        {/* Lightbox */}
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
                <img src={lightboxAsset.url} alt={lightboxAsset.caption || ''} className="lightbox-img" />
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

function ApprovalBar({ slideKey, current, error, onSubmit }: {
  slideKey: string
  current?: SlideFeedback
  error?: boolean
  onSubmit: (slideKey: string, status: FeedbackStatus, comment: string, author: string) => void
}) {
  const [comment, setComment] = useState(current?.comment || '')
  const [author, setAuthor] = useState(current?.author || '')
  const [touched, setTouched] = useState(false)
  const [showComment, setShowComment] = useState(false)
  const status = current?.status || 'pending'

  // Hydrate inputs once the async feedback fetch lands — unless the user already typed
  useEffect(() => {
    if (touched || !current) return
    setComment(current.comment || '')
    setAuthor(current.author || '')
  }, [current, touched])

  // Never wipe an existing comment with an empty string on save
  const effectiveComment = comment.trim() ? comment : (current?.comment || '')

  return (
    <div className="approval-bar">
      <div className="approval-actions">
        <button
          className={`approval-btn approve ${status === 'approved' ? 'active' : ''}`}
          onClick={() => onSubmit(slideKey, 'approved', effectiveComment, author)}
        >
          ✓ מאושר
        </button>
        <button
          className={`approval-btn reject ${status === 'rejected' ? 'active' : ''}`}
          onClick={() => { setShowComment(true); onSubmit(slideKey, 'rejected', effectiveComment, author) }}
        >
          ✕ דורש שינוי
        </button>
        <button className="approval-btn comment-toggle" onClick={() => setShowComment(s => !s)}>
          💬 הערה
        </button>
      </div>

      {(showComment || comment) && (
        <div className="approval-comment">
          <input
            className="approval-input"
            placeholder="השם שלך"
            value={author}
            onChange={e => { setTouched(true); setAuthor(e.target.value) }}
          />
          <textarea
            className="approval-textarea"
            placeholder="הוסף הערה או בקשת שינוי..."
            value={comment}
            onChange={e => { setTouched(true); setComment(e.target.value) }}
            rows={2}
          />
          <button
            className="approval-save"
            onClick={() => onSubmit(slideKey, status === 'pending' ? 'rejected' : status, effectiveComment, author)}
          >
            שמירת הערה
          </button>
        </div>
      )}

      {error && (
        <div className="approval-error">שגיאה בשמירה, נסו שוב</div>
      )}

      {current && (
        <div className={`approval-status-badge ${status}`}>
          {status === 'approved' ? 'אושר על ידי הלקוח' : status === 'rejected' ? 'נדרש שינוי' : 'ממתין לאישור'}
          {current.author ? ` · ${current.author}` : ''}
        </div>
      )}
    </div>
  )
}

function PartnerLogos() {
  return (
    <div className="partner-logos">
      <div className="partner-logo google">
        <span className="partner-g">G</span>
        <span className="partner-text">Partner</span>
      </div>
      <div className="partner-logo tiktok">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.37 6.37 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.82a8.23 8.23 0 0 0 4.81 1.54V6.9a4.85 4.85 0 0 1-1.05-.21z"/></svg>
        <span className="partner-text">Marketing Partners</span>
      </div>
      <div className="partner-logo meta">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 6.5c-.9 0-1.6.4-2.2 1.1-.4-.7-1-1.1-1.8-1.1-.7 0-1.3.3-1.7.9V8.7H9.3v6.6h1.5v-3.8c0-.8.4-1.3 1-1.3s.9.5.9 1.3v3.8h1.5v-3.8c0-.8.4-1.3 1-1.3s.9.5.9 1.3v3.8H17V11c0-1.4-.8-2.5-2.5-2.5z"/></svg>
        <span className="partner-text">Business Partners</span>
      </div>
      <div className="partner-logo wix">
        <span className="partner-wix">WiX</span>
        <span className="partner-text">Partner</span>
      </div>
    </div>
  )
}

function ResultsLogo() {
  return (
    <div className="results-logo">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="14" width="4" height="8" rx="1" fill="#F3D56D"/>
        <rect x="8" y="9" width="4" height="13" rx="1" fill="#F3D56D" opacity="0.85"/>
        <rect x="14" y="5" width="4" height="17" rx="1" fill="#F3D56D" opacity="0.7"/>
        <rect x="20" y="1" width="4" height="21" rx="1" fill="#F3D56D" opacity="0.55"/>
      </svg>
      <span className="results-logo-text">Results</span>
    </div>
  )
}

function CoverSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="cover-slide-v2">
      {/* Corner decorations */}
      <div className="cover-corner tl" />
      <div className="cover-corner tr" />
      <div className="cover-corner bl" />
      <div className="cover-corner br" />

      {/* Top bar */}
      <motion.div className="cover-top-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}>
        <ResultsLogo />
        <div className="cover-badge-pill">Creative Presentation</div>
      </motion.div>

      {/* Main content */}
      <div className="cover-body">
        {/* Left: campaign info */}
        <div className="cover-left">
          <motion.div className="cover-eyebrow" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
            {slide.date || ''}
          </motion.div>
          <motion.h1 className="cover-headline" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }}>
            {slide.subtitle || 'New Creative'}
          </motion.h1>
          <motion.div className="cover-meta-line" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.5 }}>
            <span className="cover-client-name">{slide.title}</span>
            <span className="cover-meta-sep">·</span>
            <span className="cover-by">By Results Group</span>
          </motion.div>
          <motion.div className="cover-h-rule" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.65, duration: 0.5 }} />
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}>
            <PartnerLogos />
          </motion.div>
        </div>

        {/* Right: client logo */}
        <motion.div className="cover-right" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, duration: 0.7 }}>
          {slide.logoUrl ? (
            <img src={slide.logoUrl} alt={slide.title} className="cover-client-logo" />
          ) : (
            <div className="cover-client-initials">
              {(slide.title || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom bar */}
      <motion.div className="cover-bottom-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}>
        <span />
        <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer" className="cover-url">
          www.resultsdigital.org
        </a>
      </motion.div>
    </div>
  )
}

function ConceptSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="concept-slide">
      <motion.h2 className="slide-title" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
        {slide.title}
      </motion.h2>
      <motion.div className="concept-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
        <p>{slide.content}</p>
      </motion.div>
    </div>
  )
}

function DividerSlide({ slide, index }: { slide: SlideData; index: number }) {
  const num = String(index).padStart(2, '0')
  return (
    <div className="divider-slide">
      <div className="divider-glow" />
      <span className="divider-number">{num}</span>
      <motion.h2 className="divider-title" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        {slide.title}
      </motion.h2>
      {slide.content && (
        <motion.p className="divider-desc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
          {slide.content}
        </motion.p>
      )}
      <motion.div className="divider-line" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.5 }} />
    </div>
  )
}

function CreativesSlide({ slide, activeCopyIdx, onAssetClick }: {
  slide: SlideData
  activeCopyIdx: number
  onAssetClick: (a: { url: string; caption?: string }) => void
}) {
  const assets = slide.assets || []
  const isStory = slide.mockupType === 'instagram_story'
  const copies = slide.copies || []
  // activeCopy is set only when this slide has copies enabled
  const activeCopy = copies.length > 0 ? (copies[activeCopyIdx] ?? copies[0] ?? '') : undefined

  return (
    <div>
      {slide.title && (
        <motion.h2 className="slide-title" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          {slide.title}
        </motion.h2>
      )}
      {slide.content && (
        <motion.p className="slide-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.5 }}>
          {slide.content}
        </motion.p>
      )}

      {/* Copy preview box — shown on this slide when copies are enabled for it */}
      {activeCopy !== undefined && activeCopy !== '' && (
        <motion.div className="copy-switcher" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
          <span className="copy-switcher-label">טקסט פעיל — ורסיה {activeCopyIdx + 1}</span>
          <div className="copy-text-preview" dir="auto">{activeCopy}</div>
        </motion.div>
      )}

      {assets.length > 0 && (
        <div className={`assets-grid ${isStory ? 'story-grid' : 'standard-grid'}`}>
          {assets.map((asset, i) => (
            <motion.div
              key={asset.id}
              className="mockup-wrapper"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={staggerChild}
              onClick={() => {
                const url = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
                if (url && asset.type !== 'video') onAssetClick({ url, caption: activeCopy || asset.caption })
              }}
              style={{ cursor: asset.type !== 'video' ? 'pointer' : 'default' }}
            >
              <AssetRenderer
                asset={asset}
                mockupType={slide.mockupType || 'general'}
                clientLogoUrl={slide.clientLogoUrl || null}
                clientName={slide.clientName || ''}
                captionOverride={activeCopy}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function ClosingSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="closing-slide-v2">
      {/* Corner decorations */}
      <div className="cover-corner tl" />
      <div className="cover-corner tr" />
      <div className="cover-corner bl" />
      <div className="cover-corner br" />

      {/* Top bar */}
      <motion.div className="cover-top-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05, duration: 0.5 }}>
        <ResultsLogo />
        <div className="cover-badge-pill">Thank You</div>
      </motion.div>

      {/* Main content */}
      <div className="cover-body">
        {/* Left */}
        <div className="cover-left">
          <motion.div className="cover-eyebrow" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
            Results Digital
          </motion.div>
          <motion.h1 className="cover-headline" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25, duration: 0.6 }}>
            {slide.title}
          </motion.h1>
          <motion.p className="closing-client" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}>
            {slide.subtitle}
          </motion.p>
          <motion.div className="cover-h-rule" initial={{ scaleX: 0, originX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.55, duration: 0.5 }} />
          <motion.div className="closing-contact" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5 }}>
            <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer">www.resultsdigital.org</a>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}>
            <PartnerLogos />
          </motion.div>
        </div>

        {/* Right: large Results branding */}
        <motion.div className="cover-right closing-brand-right" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.7 }}>
          <div className="closing-brand-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="14" width="4" height="8" rx="1" fill="#F3D56D"/>
              <rect x="8" y="9" width="4" height="13" rx="1" fill="#F3D56D" opacity="0.85"/>
              <rect x="14" y="5" width="4" height="17" rx="1" fill="#F3D56D" opacity="0.7"/>
              <rect x="20" y="1" width="4" height="21" rx="1" fill="#F3D56D" opacity="0.55"/>
            </svg>
          </div>
          <div className="closing-brand-name">Results Group</div>
          <div className="closing-brand-tagline">Digital Marketing Excellence</div>
        </motion.div>
      </div>

      {/* Bottom */}
      <motion.div className="cover-bottom-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }}>
        <span />
        <a href="https://www.resultsdigital.org" target="_blank" rel="noopener noreferrer" className="cover-url">
          www.resultsdigital.org
        </a>
      </motion.div>
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
      return <VideoCard url={asset.url || ''} embedUrl={videoInfo?.embedUrl} platform={videoInfo?.platform || 'other'} caption={caption} />
    case 'general':
    default:
      return <GeneralCard imageUrl={imageUrl} caption={caption} />
  }
}

