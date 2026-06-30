'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { SlideData } from './page'
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
}

const slideVariants = {
  enter: { opacity: 0, y: 30, scale: 0.98 },
  center: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -20, scale: 0.98 },
}

const staggerChild = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
}

export default function CampaignPresentation({ slides, clientName, campaignName }: Props) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [lightboxAsset, setLightboxAsset] = useState<{ url: string; caption?: string } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })

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
    function onMove(e: MouseEvent) {
      setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight })
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
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
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="campaign-pres">
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

const STYLES = `
  @font-face{font-family:'Ping';src:url('/fonts/ping-regular.otf') format('opentype');font-weight:400;font-display:swap}
  @font-face{font-family:'Ping';src:url('/fonts/ping-bold.otf') format('opentype');font-weight:700;font-display:swap}
  @font-face{font-family:'Ping';src:url('/fonts/ping-heavy.otf') format('opentype');font-weight:900;font-display:swap}

  .campaign-pres{
    --bg-dark:#090c0e;
    --brand-cyan:#40e1d3;
    --brand-yellow:#F3D56D;
    --brand-green:#2EC4B6;
    --brand-blue:#5B8CDB;
    --brand-purple:#a78bfa;
    --card-bg:rgba(16,22,26,0.75);
    --text-primary:#f4f4f5;
    --text-secondary:#94a3b0;
    --border-color:rgba(64,225,211,0.12);
    font-family:'Ping','Heebo','Assistant',sans-serif;
    background:var(--bg-dark);
    color:var(--text-primary);
    line-height:1.7;
    direction:rtl;
    min-height:100vh;
    position:relative;
    overflow-x:hidden;
  }

  /* ── Parallax Background ── */
  .campaign-pres .bg-noise{position:fixed;inset:0;opacity:0.025;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
  .campaign-pres .bg-grid{position:fixed;inset:-50px;background-image:linear-gradient(rgba(64,225,211,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(64,225,211,0.02) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;z-index:0;transition:transform 0.15s ease-out}
  .campaign-pres .ambient-light{position:fixed;top:-300px;right:-200px;width:800px;height:800px;background:radial-gradient(circle,rgba(64,225,211,0.06) 0%,transparent 65%);pointer-events:none;z-index:0;transition:transform 0.15s ease-out}
  .campaign-pres .ambient-light-2{position:fixed;bottom:-300px;left:-200px;width:800px;height:800px;background:radial-gradient(circle,rgba(91,140,219,0.04) 0%,transparent 65%);pointer-events:none;z-index:0;transition:transform 0.15s ease-out}
  .campaign-pres .ambient-light-3{position:fixed;top:40%;left:60%;width:600px;height:600px;background:radial-gradient(circle,rgba(167,139,250,0.03) 0%,transparent 65%);pointer-events:none;z-index:0;transition:transform 0.15s ease-out}

  /* ── Story Progress Bars ── */
  .campaign-pres .story-progress{position:fixed;top:0;left:0;right:0;z-index:1100;display:flex;gap:3px;padding:6px 12px;background:linear-gradient(to bottom,rgba(9,12,14,0.9),transparent)}
  .campaign-pres .story-bar{flex:1;height:3px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;cursor:pointer;border:none;padding:0}
  .campaign-pres .story-bar-fill{height:100%;border-radius:3px;width:0;transition:width 0.4s ease}
  .campaign-pres .story-bar-fill.done{width:100%;background:var(--brand-cyan)}
  .campaign-pres .story-bar-fill.active{width:100%;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));animation:progressGlow 2s ease-in-out infinite}
  @keyframes progressGlow{0%,100%{box-shadow:0 0 4px rgba(64,225,211,0.3)}50%{box-shadow:0 0 12px rgba(64,225,211,0.6)}}

  /* ── Header ── */
  .campaign-pres .pres-header{position:sticky;top:0;z-index:1000;background:rgba(9,12,14,0.85);backdrop-filter:blur(24px) saturate(1.4);border-bottom:1px solid rgba(255,255,255,0.04);padding:14px 40px;display:flex;align-items:center;justify-content:space-between}
  .campaign-pres .pres-header .brand{font-size:1.15rem;font-weight:900;letter-spacing:0.5px;background:linear-gradient(135deg,var(--brand-cyan),var(--brand-green));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .campaign-pres .pres-header .header-right{display:flex;align-items:center;gap:12px}
  .campaign-pres .pres-header .campaign-badge{background:rgba(64,225,211,0.06);border:1px solid rgba(64,225,211,0.15);border-radius:24px;padding:5px 18px;font-size:0.78rem;color:var(--text-secondary);letter-spacing:0.3px}
  .campaign-pres .pdf-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(243,213,109,0.06);border:1px solid rgba(243,213,109,0.15);border-radius:24px;padding:5px 18px;font-size:0.78rem;color:var(--brand-yellow);font-family:'Ping',sans-serif;cursor:pointer;transition:all 0.3s;white-space:nowrap}
  .campaign-pres .pdf-btn:hover:not(:disabled){background:rgba(243,213,109,0.12);box-shadow:0 0 20px rgba(243,213,109,0.1);border-color:rgba(243,213,109,0.3)}
  .campaign-pres .pdf-btn:disabled{opacity:0.4;cursor:default}

  /* ── Floating Dock Nav ── */
  .campaign-pres .floating-dock{position:sticky;top:56px;z-index:999;display:flex;gap:2px;overflow-x:auto;padding:8px 20px;background:rgba(9,12,14,0.9);backdrop-filter:blur(20px);border-bottom:1px solid rgba(255,255,255,0.03)}
  .campaign-pres .dock-item{background:none;border:none;display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 16px;border-radius:12px;cursor:pointer;transition:all 0.3s;position:relative}
  .campaign-pres .dock-item::after{content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:0;height:2px;border-radius:2px;background:var(--brand-cyan);transition:width 0.3s}
  .campaign-pres .dock-item.active::after{width:20px}
  .campaign-pres .dock-icon{font-size:0.9rem;color:var(--text-secondary);transition:all 0.3s}
  .campaign-pres .dock-label{font-size:0.7rem;color:var(--text-secondary);font-family:'Ping',sans-serif;white-space:nowrap;transition:color 0.3s}
  .campaign-pres .dock-item:hover{background:rgba(64,225,211,0.05)}
  .campaign-pres .dock-item:hover .dock-icon,.campaign-pres .dock-item:hover .dock-label{color:var(--text-primary)}
  .campaign-pres .dock-item.active .dock-icon{color:var(--brand-cyan);text-shadow:0 0 12px rgba(64,225,211,0.5)}
  .campaign-pres .dock-item.active .dock-label{color:var(--brand-cyan);font-weight:700}

  /* ── Main ── */
  .campaign-pres .pres-main{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:40px 24px 80px}
  .campaign-pres .slide{position:relative}

  /* ── Slide Title ── */
  .campaign-pres .slide-title{font-size:1.8rem;font-weight:900;margin-bottom:28px;color:var(--text-primary);display:flex;align-items:center;gap:14px;letter-spacing:-0.02em}
  .campaign-pres .slide-title::before{content:'';display:block;width:4px;height:32px;background:linear-gradient(to bottom,var(--brand-cyan),var(--brand-yellow));border-radius:2px;flex-shrink:0}
  .campaign-pres .slide-intro{font-size:1.1rem;line-height:1.85;color:var(--text-secondary);margin:-16px 0 32px;max-width:760px;white-space:pre-wrap}

  /* ── Cover Slide ── */
  .campaign-pres .cover-slide{text-align:center;padding:80px 20px 60px;position:relative;min-height:75vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .cover-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:800px;background:radial-gradient(circle,rgba(64,225,211,0.07) 0%,rgba(243,213,109,0.03) 30%,transparent 60%);pointer-events:none;animation:glowPulse 6s ease-in-out infinite}
  .campaign-pres .cover-glow-2{position:absolute;top:30%;left:30%;width:500px;height:500px;background:radial-gradient(circle,rgba(167,139,250,0.04) 0%,transparent 60%);pointer-events:none;animation:glowPulse 8s ease-in-out 2s infinite}
  @keyframes glowPulse{0%,100%{opacity:0.5;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.12)}}

  .campaign-pres .cover-badge-top{position:relative;display:inline-block;background:rgba(64,225,211,0.06);border:1px solid rgba(64,225,211,0.2);border-radius:32px;padding:8px 28px;font-size:0.72rem;letter-spacing:3px;text-transform:uppercase;color:var(--brand-cyan);font-weight:700;margin-bottom:40px}

  .campaign-pres .cover-logo-wrap{position:relative;margin-bottom:40px}
  .campaign-pres .cover-logo-wrap::before{content:'';position:absolute;inset:-6px;border-radius:50%;background:linear-gradient(135deg,var(--brand-cyan),var(--brand-yellow),var(--brand-purple));opacity:0.4;animation:logoRingSpin 8s linear infinite}
  @keyframes logoRingSpin{to{transform:rotate(360deg)}}
  .campaign-pres .cover-logo{width:110px;height:110px;border-radius:50%;object-fit:cover;position:relative;z-index:1;border:4px solid var(--bg-dark);box-shadow:0 0 60px rgba(64,225,211,0.15)}

  .campaign-pres .cover-client{font-size:4.5rem;font-weight:900;margin-bottom:16px;position:relative;line-height:1.05;letter-spacing:-0.03em;background:linear-gradient(120deg,var(--brand-yellow),#fff,var(--brand-cyan),var(--brand-yellow));background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 6s linear infinite}
  @keyframes shimmer{to{background-position:300% center}}

  .campaign-pres .cover-campaign{font-size:1.5rem;font-weight:300;color:var(--text-secondary);margin-bottom:24px;position:relative;letter-spacing:0.02em}
  .campaign-pres .cover-divider{width:120px;height:2px;background:linear-gradient(90deg,transparent,var(--brand-cyan),var(--brand-yellow),transparent);margin:0 auto 28px}
  .campaign-pres .cover-date{font-size:0.9rem;color:var(--text-secondary);position:relative;opacity:0.7}

  /* ── Concept Slide ── */
  .campaign-pres .concept-slide{padding:50px 0}
  .campaign-pres .concept-card{background:var(--card-bg);backdrop-filter:blur(16px);border:1px solid var(--border-color);border-radius:20px;padding:44px;position:relative;overflow:hidden}
  .campaign-pres .concept-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-green),var(--brand-blue),var(--brand-purple))}
  .campaign-pres .concept-card::after{content:'"';position:absolute;top:20px;right:30px;font-size:6rem;line-height:1;color:rgba(64,225,211,0.06);font-family:Georgia,serif;pointer-events:none}
  .campaign-pres .concept-card p{font-size:1.1rem;color:var(--text-secondary);line-height:2.1;white-space:pre-wrap;position:relative;z-index:1}

  /* ── Divider Slide ── */
  .campaign-pres .divider-slide{text-align:center;padding:100px 20px 80px;position:relative;min-height:65vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .divider-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(64,225,211,0.04) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .divider-number{font-size:10rem;font-weight:900;line-height:1;color:transparent;-webkit-text-stroke:1px rgba(64,225,211,0.08);position:absolute;z-index:0;pointer-events:none;letter-spacing:-0.05em}
  .campaign-pres .divider-title{font-size:3rem;font-weight:900;color:var(--text-primary);margin-bottom:18px;position:relative;line-height:1.15;letter-spacing:-0.02em;z-index:1}
  .campaign-pres .divider-desc{font-size:1.1rem;color:var(--text-secondary);max-width:600px;margin:0 auto 28px;line-height:1.9;position:relative;white-space:pre-wrap;z-index:1}
  .campaign-pres .divider-line{width:60px;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:0 auto;z-index:1;position:relative}

  /* ── Creatives ── */
  .campaign-pres .assets-grid{display:grid;gap:28px}
  .campaign-pres .assets-grid.story-grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
  .campaign-pres .assets-grid.standard-grid{grid-template-columns:repeat(auto-fill,minmax(340px,1fr))}
  .campaign-pres .mockup-wrapper{position:relative;transition:transform 0.4s cubic-bezier(0.22,1,0.36,1)}
  .campaign-pres .mockup-wrapper:hover{transform:translateY(-4px)}

  /* ── Closing Slide ── */
  .campaign-pres .closing-slide{text-align:center;padding:100px 20px 80px;position:relative;min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .closing-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:600px;height:600px;background:radial-gradient(circle,rgba(243,213,109,0.06) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .closing-title{font-size:4rem;font-weight:900;margin-bottom:16px;position:relative;line-height:1.05;letter-spacing:-0.03em;background:linear-gradient(135deg,var(--brand-yellow),#fff);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .campaign-pres .closing-subtitle{font-size:1.3rem;color:var(--text-secondary);margin-bottom:40px;position:relative}
  .campaign-pres .closing-divider{width:80px;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:0 auto 36px}
  .campaign-pres .closing-brand{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px}
  .campaign-pres .closing-by{font-size:0.75rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:2px}
  .campaign-pres .closing-name{font-size:1.3rem;font-weight:900;background:linear-gradient(135deg,var(--brand-cyan),var(--brand-green));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

  /* ── Footer Nav ── */
  .campaign-pres .slide-footer-nav{position:fixed;bottom:0;left:0;right:0;z-index:1000;background:rgba(9,12,14,0.92);backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,0.04);display:flex;align-items:center;justify-content:center;gap:28px;padding:12px 20px}
  .campaign-pres .nav-btn{background:none;border:1px solid rgba(255,255,255,0.08);color:var(--text-secondary);font-family:'Ping',sans-serif;font-size:0.82rem;padding:9px 22px;border-radius:12px;cursor:pointer;transition:all 0.3s;display:flex;align-items:center;gap:6px}
  .campaign-pres .nav-btn:hover:not(:disabled){background:rgba(64,225,211,0.06);color:var(--brand-cyan);border-color:rgba(64,225,211,0.2)}
  .campaign-pres .nav-btn:disabled{opacity:0.25;cursor:default}
  .campaign-pres .slide-counter{font-size:0.8rem;color:var(--text-secondary);font-weight:700;font-variant-numeric:tabular-nums}

  .campaign-pres .pres-footer{display:flex;justify-content:space-between;align-items:center;padding:20px 40px 70px;position:relative;z-index:1}
  .campaign-pres .pres-footer p,.campaign-pres .pres-footer a{color:var(--text-secondary);font-size:0.78rem;margin:0;text-decoration:none;opacity:0.6}
  .campaign-pres .pres-footer a:hover{opacity:1;color:var(--brand-cyan)}

  /* ── Lightbox ── */
  .campaign-pres .lightbox-overlay{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.92);backdrop-filter:blur(20px);display:flex;align-items:center;justify-content:center;padding:40px;cursor:pointer}
  .campaign-pres .lightbox-content{position:relative;max-width:90vw;max-height:85vh;cursor:default}
  .campaign-pres .lightbox-img{max-width:100%;max-height:80vh;object-fit:contain;border-radius:16px;box-shadow:0 30px 100px rgba(0,0,0,0.6)}
  .campaign-pres .lightbox-caption{text-align:center;margin-top:16px;font-size:0.95rem;color:var(--text-secondary);max-width:600px;margin-left:auto;margin-right:auto}
  .campaign-pres .lightbox-close{position:absolute;top:-16px;left:-16px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);color:#fff;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s}
  .campaign-pres .lightbox-close:hover{background:rgba(255,255,255,0.2);transform:scale(1.1)}

  /* ── Scrollbar ── */
  .campaign-pres ::-webkit-scrollbar{width:5px;height:5px}
  .campaign-pres ::-webkit-scrollbar-track{background:transparent}
  .campaign-pres ::-webkit-scrollbar-thumb{background:rgba(64,225,211,0.2);border-radius:3px}

  /* ── Responsive ── */
  @media(max-width:768px){
    .campaign-pres .pres-header{padding:12px 16px}
    .campaign-pres .pres-header .campaign-badge{display:none}
    .campaign-pres .pres-main{padding:24px 14px 90px}
    .campaign-pres .cover-client{font-size:2.2rem}
    .campaign-pres .cover-campaign{font-size:1rem}
    .campaign-pres .cover-logo{width:80px;height:80px}
    .campaign-pres .divider-title{font-size:1.8rem}
    .campaign-pres .divider-number{font-size:5rem}
    .campaign-pres .closing-title{font-size:2.2rem}
    .campaign-pres .assets-grid.standard-grid{grid-template-columns:1fr}
    .campaign-pres .assets-grid.story-grid{grid-template-columns:repeat(2,1fr)}
    .campaign-pres .floating-dock{padding:4px 8px;gap:0}
    .campaign-pres .dock-item{padding:6px 10px}
    .campaign-pres .dock-label{font-size:0.6rem}
    .campaign-pres .pres-footer{padding:16px 16px 70px;flex-direction:column;gap:8px;text-align:center}
    .campaign-pres .story-progress{padding:4px 8px}
    .campaign-pres .lightbox-overlay{padding:16px}
  }

  /* ── Print ── */
  @media print{
    body.printing-all-slides .campaign-pres .pres-header,
    body.printing-all-slides .campaign-pres .floating-dock,
    body.printing-all-slides .campaign-pres .slide-footer-nav,
    body.printing-all-slides .campaign-pres .pres-footer,
    body.printing-all-slides .campaign-pres .story-progress{display:none !important}
    body.printing-all-slides .campaign-pres .bg-noise,
    body.printing-all-slides .campaign-pres .bg-grid,
    body.printing-all-slides .campaign-pres .ambient-light,
    body.printing-all-slides .campaign-pres .ambient-light-2,
    body.printing-all-slides .campaign-pres .ambient-light-3{display:none !important}
    body.printing-all-slides .campaign-pres{background:#090c0e !important}
    body.printing-all-slides .campaign-pres .pres-main{padding:0 !important;max-width:100% !important}
    body.printing-all-slides *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    @page{size:landscape;margin:0}
  }
`
