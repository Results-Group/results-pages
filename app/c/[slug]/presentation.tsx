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
                <CreativesSlide slide={slides[activeSlide]} onAssetClick={setLightboxAsset} />
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

function CoverSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="cover-slide">
      <div className="cover-glow" />
      <div className="cover-glow-2" />
      <motion.div className="cover-badge-top" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}>
        Creative Presentation
      </motion.div>
      {slide.logoUrl && (
        <motion.div className="cover-logo-wrap" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.6 }}>
          <img src={slide.logoUrl} alt={slide.title} className="cover-logo" />
        </motion.div>
      )}
      <motion.h1 className="cover-client" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}>
        {slide.title}
      </motion.h1>
      <motion.h2 className="cover-campaign" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.6 }}>
        {slide.subtitle}
      </motion.h2>
      <motion.div className="cover-divider" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.55, duration: 0.6 }} />
      {slide.date && (
        <motion.p className="cover-date" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 0.5 }}>
          {slide.date}
        </motion.p>
      )}
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

function CreativesSlide({ slide, onAssetClick }: { slide: SlideData; onAssetClick: (a: { url: string; caption?: string }) => void }) {
  const assets = slide.assets || []
  const isStory = slide.mockupType === 'instagram_story'

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
                if (url && asset.type !== 'video') onAssetClick({ url, caption: asset.caption })
              }}
              style={{ cursor: asset.type !== 'video' ? 'pointer' : 'default' }}
            >
              <AssetRenderer
                asset={asset}
                mockupType={slide.mockupType || 'general'}
                clientLogoUrl={slide.clientLogoUrl || null}
                clientName={slide.clientName || ''}
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
    <div className="closing-slide">
      <div className="closing-glow" />
      <motion.h2 className="closing-title" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
        {slide.title}
      </motion.h2>
      <motion.p className="closing-subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }}>
        {slide.subtitle}
      </motion.p>
      <motion.div className="closing-divider" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.35, duration: 0.5 }} />
      <motion.div className="closing-brand" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <span className="closing-by">Presented by</span>
        <span className="closing-name">Results Digital</span>
      </motion.div>
    </div>
  )
}

function AssetRenderer({ asset, mockupType, clientLogoUrl, clientName }: {
  asset: CampaignAsset; mockupType: string; clientLogoUrl: string | null; clientName: string
}) {
  const imageUrl = asset.file_path ? assetProxyUrl(asset.file_path) : (asset.public_url || '')
  const videoInfo = asset.url ? parseVideoUrl(asset.url) : null

  switch (mockupType) {
    case 'instagram_feed':
      return <InstagramFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={asset.caption} />
    case 'instagram_story':
      return <InstagramStoryMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} />
    case 'facebook_feed':
      return <FacebookFeedMockup imageUrl={imageUrl} clientName={clientName} logoUrl={clientLogoUrl ?? undefined} caption={asset.caption} />
    case 'video':
      return <VideoCard url={asset.url || ''} embedUrl={videoInfo?.embedUrl} platform={videoInfo?.platform || 'other'} caption={asset.caption} />
    case 'general':
    default:
      return <GeneralCard imageUrl={imageUrl} caption={asset.caption} />
  }
}

