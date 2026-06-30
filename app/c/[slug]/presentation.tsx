'use client'

import { useState, useEffect } from 'react'
import type { SlideData } from './page'
import type { CampaignAsset } from '@/lib/campaigns'
import InstagramFeedMockup from './mockups/instagram-feed'
import InstagramStoryMockup from './mockups/instagram-story'
import FacebookFeedMockup from './mockups/facebook-feed'
import VideoCard from './mockups/video-card'
import GeneralCard from './mockups/general-card'
import { parseVideoUrl } from '@/lib/video-utils'

interface Props {
  slides: SlideData[]
  clientName: string
  campaignName: string
}

export default function CampaignPresentation({ slides, clientName, campaignName }: Props) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [exporting, setExporting] = useState(false)

  function goSlide(n: number) {
    setActiveSlide(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      // RTL: ArrowLeft advances, ArrowRight goes back
      if (e.key === 'ArrowLeft') setActiveSlide(s => Math.min(slides.length - 1, s + 1))
      if (e.key === 'ArrowRight') setActiveSlide(s => Math.max(0, s - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [slides.length])

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

  function getSlideLabel(slide: SlideData, i: number): string {
    if (slide.type === 'cover') return 'שער'
    if (slide.type === 'concept') return 'קונספט'
    if (slide.type === 'closing') return 'סיום'
    if (slide.type === 'divider') return slide.title || `חוצץ ${i}`
    return slide.title || `סקציה ${i}`
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <div className="campaign-pres">
        <div className="bg-noise" />
        <div className="bg-grid" />
        <div className="ambient-light" />
        <div className="ambient-light-2" />

        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((activeSlide + 1) / slides.length) * 100}%` }} />
        </div>

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

        <nav className="slide-nav">
          {slides.map((slide, i) => (
            <button
              key={i}
              className={activeSlide === i ? 'active' : ''}
              onClick={() => goSlide(i)}
            >
              {getSlideLabel(slide, i)}
            </button>
          ))}
        </nav>

        <main className="pres-main">
          {slides.map((slide, i) => (
            <section
              key={i}
              className={`slide ${activeSlide === i ? 'active' : ''}`}
            >
              {slide.type === 'cover' && <CoverSlide slide={slide} />}
              {slide.type === 'concept' && <ConceptSlide slide={slide} />}
              {slide.type === 'divider' && <DividerSlide slide={slide} />}
              {slide.type === 'creatives' && <CreativesSlide slide={slide} />}
              {slide.type === 'closing' && <ClosingSlide slide={slide} />}
            </section>
          ))}
        </main>

        <div className="slide-footer-nav">
          <button
            onClick={() => goSlide(Math.max(0, activeSlide - 1))}
            disabled={activeSlide === 0}
            className="nav-btn"
          >
            הקודם
          </button>
          <span className="slide-counter">{activeSlide + 1} / {slides.length}</span>
          <button
            onClick={() => goSlide(Math.min(slides.length - 1, activeSlide + 1))}
            disabled={activeSlide === slides.length - 1}
            className="nav-btn"
          >
            הבא
          </button>
        </div>

        <footer className="pres-footer">
          <a href="https://www.resultsgroup.co.il" target="_blank" rel="noopener noreferrer">www.resultsgroup.co.il</a>
          <p>By Results Group</p>
        </footer>
      </div>
    </>
  )
}

function CoverSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="cover-slide">
      <div className="cover-glow" />
      <div className="cover-badge-top">Creative Presentation</div>
      {slide.logoUrl && (
        <img src={slide.logoUrl} alt={slide.title} className="cover-logo" />
      )}
      <h1 className="cover-client">{slide.title}</h1>
      <h2 className="cover-campaign">{slide.subtitle}</h2>
      <div className="cover-divider" />
      {slide.date && <p className="cover-date">{slide.date}</p>}
    </div>
  )
}

function ConceptSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="concept-slide">
      <h2 className="slide-title">{slide.title}</h2>
      <div className="concept-card">
        <p>{slide.content}</p>
      </div>
    </div>
  )
}

function DividerSlide({ slide }: { slide: SlideData }) {
  return (
    <div className="divider-slide">
      <div className="divider-glow" />
      <h2 className="divider-title">{slide.title}</h2>
      {slide.content && <p className="divider-desc">{slide.content}</p>}
      <div className="divider-line" />
    </div>
  )
}

function CreativesSlide({ slide }: { slide: SlideData }) {
  const assets = slide.assets || []
  const isStory = slide.mockupType === 'instagram_story'

  return (
    <div>
      {slide.title && <h2 className="slide-title">{slide.title}</h2>}
      {assets.length > 0 && (
        <div className={`assets-grid ${isStory ? 'story-grid' : 'standard-grid'}`}>
          {assets.map((asset) => (
            <div key={asset.id} className="mockup-wrapper">
              <AssetRenderer
                asset={asset}
                mockupType={slide.mockupType || 'general'}
                clientLogoUrl={slide.clientLogoUrl || null}
                clientName={slide.clientName || ''}
              />
              {asset.caption && (
                <p className="asset-caption">{asset.caption}</p>
              )}
            </div>
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
      <h2 className="closing-title">{slide.title}</h2>
      <p className="closing-subtitle">{slide.subtitle}</p>
      <div className="closing-divider" />
      <div className="closing-brand">
        <span className="closing-by">Presented by</span>
        <span className="closing-name">Results Digital</span>
      </div>
    </div>
  )
}

function AssetRenderer({ asset, mockupType, clientLogoUrl, clientName }: {
  asset: CampaignAsset; mockupType: string; clientLogoUrl: string | null; clientName: string
}) {
  const encodedPath = asset.file_path ? asset.file_path.split('/').map(encodeURIComponent).join('/') : ''
  const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '')
  const imageUrl = asset.public_url || (encodedPath && supabaseHost ? `https://${supabaseHost}/storage/v1/object/public/campaign-assets/${encodedPath}` : '')
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
    --bg-dark:#0d1112;
    --brand-cyan:#40e1d3;
    --brand-yellow:#F3D56D;
    --brand-green:#2EC4B6;
    --brand-blue:#5B8CDB;
    --card-bg:rgba(20,30,32,0.7);
    --text-primary:#f0f0f0;
    --text-secondary:#a0aab0;
    --border-color:rgba(64,225,211,0.15);
    font-family:'Ping','Heebo','Assistant',sans-serif;
    background:var(--bg-dark);
    color:var(--text-primary);
    line-height:1.7;
    direction:rtl;
    min-height:100vh;
    position:relative;
    overflow-x:hidden;
  }

  .campaign-pres .progress-bar{position:fixed;top:0;left:0;right:0;height:3px;background:rgba(255,255,255,0.04);z-index:1100}
  .campaign-pres .progress-fill{height:100%;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));transition:width 0.4s ease;box-shadow:0 0 12px rgba(64,225,211,0.5)}

  .campaign-pres .bg-noise{position:fixed;inset:0;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
  .campaign-pres .bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(64,225,211,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(64,225,211,0.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0}
  .campaign-pres .ambient-light{position:fixed;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(64,225,211,0.06) 0%,transparent 70%);pointer-events:none;z-index:0}
  .campaign-pres .ambient-light-2{position:fixed;bottom:-200px;left:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(91,140,219,0.04) 0%,transparent 70%);pointer-events:none;z-index:0}

  .campaign-pres .pres-header{position:sticky;top:0;z-index:1000;background:rgba(13,17,18,0.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-color);padding:14px 40px;display:flex;align-items:center;justify-content:space-between}
  .campaign-pres .pres-header .brand{font-size:1.3rem;font-weight:700;color:var(--brand-cyan)}
  .campaign-pres .pres-header .header-right{display:flex;align-items:center;gap:12px}
  .campaign-pres .pres-header .campaign-badge{background:rgba(64,225,211,0.1);border:1px solid rgba(64,225,211,0.3);border-radius:20px;padding:4px 16px;font-size:0.82rem;color:var(--brand-cyan)}
  .campaign-pres .pdf-btn{display:inline-flex;align-items:center;gap:6px;background:rgba(243,213,109,0.1);border:1px solid rgba(243,213,109,0.3);border-radius:20px;padding:5px 16px;font-size:0.82rem;color:var(--brand-yellow);font-family:'Ping',sans-serif;cursor:pointer;transition:all 0.2s;white-space:nowrap}
  .campaign-pres .pdf-btn:hover:not(:disabled){background:rgba(243,213,109,0.18);box-shadow:0 0 16px rgba(243,213,109,0.15)}
  .campaign-pres .pdf-btn:disabled{opacity:0.5;cursor:default}

  .campaign-pres .slide-nav{position:sticky;top:56px;z-index:999;background:rgba(13,17,18,0.95);backdrop-filter:blur(16px);display:flex;gap:0;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,0.06);padding:0 20px}
  .campaign-pres .slide-nav button{background:none;border:none;border-bottom:3px solid transparent;color:var(--text-secondary);font-family:'Ping',sans-serif;font-size:0.85rem;padding:12px 18px;cursor:pointer;white-space:nowrap;transition:all 0.3s}
  .campaign-pres .slide-nav button:hover{color:var(--text-primary)}
  .campaign-pres .slide-nav button.active{color:var(--brand-cyan);border-bottom-color:var(--brand-cyan);font-weight:700}

  .campaign-pres .pres-main{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:30px 20px 60px}
  .campaign-pres .slide{display:none;animation:slideIn 0.4s ease}
  .campaign-pres .slide.active{display:block}
  @keyframes slideIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

  .campaign-pres .slide-title{font-size:1.6rem;font-weight:700;margin-bottom:24px;color:var(--text-primary);display:flex;align-items:center;gap:12px}
  .campaign-pres .slide-title::before{content:'';display:block;width:4px;height:28px;background:var(--brand-yellow);border-radius:2px;flex-shrink:0}

  /* Cover Slide */
  .campaign-pres .cover-slide{text-align:center;padding:90px 20px 80px;position:relative;min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .cover-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:700px;background:radial-gradient(circle,rgba(243,213,109,0.08) 0%,transparent 60%);pointer-events:none;animation:glowPulse 5s ease-in-out infinite}
  @keyframes glowPulse{0%,100%{opacity:0.6;transform:translate(-50%,-50%) scale(1)}50%{opacity:1;transform:translate(-50%,-50%) scale(1.1)}}
  .campaign-pres .cover-badge-top{position:relative;display:inline-block;background:rgba(64,225,211,0.08);border:1px solid rgba(64,225,211,0.3);border-radius:24px;padding:6px 22px;font-size:0.78rem;letter-spacing:2px;text-transform:uppercase;color:var(--brand-cyan);font-weight:700;margin-bottom:32px;animation:fadeUp 0.6s ease both}
  .campaign-pres .cover-logo{width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid rgba(243,213,109,0.4);box-shadow:0 0 60px rgba(243,213,109,0.2);margin:0 auto 32px;display:block;position:relative;animation:fadeUp 0.6s 0.1s ease both}
  .campaign-pres .cover-client{font-size:4rem;font-weight:900;margin-bottom:12px;position:relative;line-height:1.1;background:linear-gradient(120deg,var(--brand-yellow),#fff,var(--brand-cyan),var(--brand-yellow));background-size:300% auto;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;animation:fadeUp 0.6s 0.2s ease both,shimmer 6s linear infinite}
  @keyframes shimmer{to{background-position:300% center}}
  .campaign-pres .cover-campaign{font-size:1.6rem;font-weight:300;color:var(--text-primary);margin-bottom:20px;position:relative;animation:fadeUp 0.6s 0.3s ease both}
  .campaign-pres .cover-divider{width:100px;height:3px;background:linear-gradient(90deg,transparent,var(--brand-cyan),var(--brand-yellow),transparent);border-radius:2px;margin:24px auto;animation:fadeUp 0.6s 0.4s ease both}
  .campaign-pres .cover-date{font-size:0.95rem;color:var(--text-secondary);position:relative;animation:fadeUp 0.6s 0.5s ease both}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}

  /* Concept Slide */
  .campaign-pres .concept-slide{padding:40px 0}
  .campaign-pres .concept-card{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:14px;padding:36px;position:relative;overflow:hidden}
  .campaign-pres .concept-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-green),var(--brand-blue))}
  .campaign-pres .concept-card p{font-size:1.05rem;color:var(--text-secondary);line-height:2;white-space:pre-wrap}

  /* Divider Slide */
  .campaign-pres .divider-slide{text-align:center;padding:100px 20px 80px;position:relative;min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .divider-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(64,225,211,0.05) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .divider-title{font-size:2.8rem;font-weight:900;color:var(--brand-cyan);margin-bottom:16px;position:relative;line-height:1.15}
  .campaign-pres .divider-desc{font-size:1.1rem;color:var(--text-secondary);max-width:600px;margin:0 auto 24px;line-height:1.8;position:relative;white-space:pre-wrap}
  .campaign-pres .divider-line{width:60px;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:0 auto}

  /* Creatives */
  .campaign-pres .assets-grid{display:grid;gap:24px}
  .campaign-pres .assets-grid.story-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
  .campaign-pres .assets-grid.standard-grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
  .campaign-pres .mockup-wrapper{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:16px;padding:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;transition:transform 0.3s ease,box-shadow 0.3s ease,border-color 0.3s ease}
  .campaign-pres .mockup-wrapper:hover{transform:translateY(-6px);box-shadow:0 20px 40px rgba(0,0,0,0.4),0 0 30px rgba(64,225,211,0.08);border-color:rgba(64,225,211,0.35)}
  .campaign-pres .mockup-wrapper::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow))}
  .campaign-pres .asset-caption{font-size:0.85rem;color:var(--text-secondary);text-align:center;margin-top:14px;line-height:1.6}

  /* Closing Slide */
  .campaign-pres .closing-slide{text-align:center;padding:100px 20px 80px;position:relative;min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .closing-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(243,213,109,0.08) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .closing-title{font-size:3.4rem;font-weight:900;color:var(--brand-yellow);margin-bottom:12px;position:relative;line-height:1.1}
  .campaign-pres .closing-subtitle{font-size:1.3rem;color:var(--text-primary);margin-bottom:40px;position:relative}
  .campaign-pres .closing-divider{width:80px;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:0 auto 32px}
  .campaign-pres .closing-brand{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px}
  .campaign-pres .closing-by{font-size:0.8rem;color:var(--text-secondary)}
  .campaign-pres .closing-name{font-size:1.4rem;font-weight:700;color:var(--brand-cyan)}

  /* Slide Nav Footer */
  .campaign-pres .slide-footer-nav{position:fixed;bottom:0;left:0;right:0;z-index:1000;background:rgba(13,17,18,0.95);backdrop-filter:blur(16px);border-top:1px solid var(--border-color);display:flex;align-items:center;justify-content:center;gap:24px;padding:10px 20px}
  .campaign-pres .nav-btn{background:none;border:1px solid var(--border-color);color:var(--text-secondary);font-family:'Ping',sans-serif;font-size:0.85rem;padding:8px 20px;border-radius:8px;cursor:pointer;transition:all 0.2s}
  .campaign-pres .nav-btn:hover:not(:disabled){background:rgba(64,225,211,0.1);color:var(--brand-cyan);border-color:rgba(64,225,211,0.3)}
  .campaign-pres .nav-btn:disabled{opacity:0.3;cursor:default}
  .campaign-pres .slide-counter{font-size:0.85rem;color:var(--text-secondary);font-weight:700}

  .campaign-pres .pres-footer{display:flex;justify-content:space-between;align-items:center;padding:20px 40px 60px;position:relative;z-index:1}
  .campaign-pres .pres-footer p,.campaign-pres .pres-footer a{color:var(--text-secondary);font-size:0.8rem;margin:0;text-decoration:none}
  .campaign-pres .pres-footer a:hover{color:var(--text-primary)}

  .campaign-pres ::-webkit-scrollbar{width:6px;height:6px}
  .campaign-pres ::-webkit-scrollbar-track{background:transparent}
  .campaign-pres ::-webkit-scrollbar-thumb{background:rgba(64,225,211,0.3);border-radius:3px}

  @media(max-width:768px){
    .campaign-pres .pres-header{padding:12px 16px}
    .campaign-pres .pres-header .campaign-badge{display:none}
    .campaign-pres .pres-main{padding:20px 12px 80px}
    .campaign-pres .cover-client{font-size:2rem}
    .campaign-pres .cover-campaign{font-size:1.1rem}
    .campaign-pres .divider-title{font-size:1.6rem}
    .campaign-pres .closing-title{font-size:2rem}
    .campaign-pres .assets-grid.standard-grid{grid-template-columns:1fr}
    .campaign-pres .assets-grid.story-grid{grid-template-columns:repeat(2,1fr)}
    .campaign-pres .slide-nav button{font-size:0.75rem;padding:10px 12px}
    .campaign-pres .pres-footer{padding:16px 16px 60px;flex-direction:column;gap:8px;text-align:center}
  }

  @media print{
    body.printing-all-slides .campaign-pres .pres-header,
    body.printing-all-slides .campaign-pres .slide-nav,
    body.printing-all-slides .campaign-pres .slide-footer-nav,
    body.printing-all-slides .campaign-pres .pres-footer{display:none !important}
    body.printing-all-slides .campaign-pres .bg-noise,
    body.printing-all-slides .campaign-pres .bg-grid,
    body.printing-all-slides .campaign-pres .ambient-light,
    body.printing-all-slides .campaign-pres .ambient-light-2{display:none !important}
    body.printing-all-slides .campaign-pres{background:#0d1112 !important}
    body.printing-all-slides .campaign-pres .pres-main{padding:0 !important;max-width:100% !important}
    body.printing-all-slides .campaign-pres .slide{display:block !important;page-break-after:always;break-after:page;padding:40px 30px;min-height:auto}
    body.printing-all-slides .campaign-pres .slide:last-child{page-break-after:auto}
    body.printing-all-slides *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important}
    @page{size:landscape;margin:0}
  }
`
