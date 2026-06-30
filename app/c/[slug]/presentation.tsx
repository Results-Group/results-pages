'use client'

import { useState } from 'react'
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

  function goSlide(n: number) {
    setActiveSlide(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

        <header className="pres-header">
          <div className="brand">Results Digital</div>
          <div className="campaign-badge">{clientName} — {campaignName}</div>
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
      {slide.logoUrl && (
        <img src={slide.logoUrl} alt="" className="cover-logo" />
      )}
      <h1 className="cover-client">{slide.title}</h1>
      <h2 className="cover-campaign">{slide.subtitle}</h2>
      <div className="cover-divider" />
      {slide.date && <p className="cover-date">{slide.date}</p>}
      <div className="cover-badge">Creative Presentation</div>
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
  const imageUrl = asset.public_url || (asset.file_path ? `https://${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '')}/storage/v1/object/public/campaign-assets/${asset.file_path}` : '')
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
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Regular.woff2') format('woff2');font-weight:400}
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Bold.woff2') format('woff2');font-weight:700}
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Light.woff2') format('woff2');font-weight:300}

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
    font-family:'Ping',sans-serif;
    background:var(--bg-dark);
    color:var(--text-primary);
    line-height:1.7;
    direction:rtl;
    min-height:100vh;
    position:relative;
    overflow-x:hidden;
  }

  .campaign-pres .bg-noise{position:fixed;inset:0;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
  .campaign-pres .bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(64,225,211,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(64,225,211,0.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0}
  .campaign-pres .ambient-light{position:fixed;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(64,225,211,0.06) 0%,transparent 70%);pointer-events:none;z-index:0}
  .campaign-pres .ambient-light-2{position:fixed;bottom:-200px;left:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(91,140,219,0.04) 0%,transparent 70%);pointer-events:none;z-index:0}

  .campaign-pres .pres-header{position:sticky;top:0;z-index:1000;background:rgba(13,17,18,0.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-color);padding:14px 40px;display:flex;align-items:center;justify-content:space-between}
  .campaign-pres .pres-header .brand{font-size:1.3rem;font-weight:700;color:var(--brand-cyan)}
  .campaign-pres .pres-header .campaign-badge{background:rgba(64,225,211,0.1);border:1px solid rgba(64,225,211,0.3);border-radius:20px;padding:4px 16px;font-size:0.82rem;color:var(--brand-cyan)}

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
  .campaign-pres .cover-slide{text-align:center;padding:80px 20px 60px;position:relative}
  .campaign-pres .cover-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(243,213,109,0.06) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .cover-logo{width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid rgba(243,213,109,0.3);box-shadow:0 0 40px rgba(243,213,109,0.15);margin:0 auto 28px;display:block;position:relative}
  .campaign-pres .cover-client{font-size:3rem;font-weight:700;color:var(--brand-yellow);margin-bottom:10px;position:relative}
  .campaign-pres .cover-campaign{font-size:1.5rem;font-weight:400;color:var(--text-primary);margin-bottom:20px;position:relative}
  .campaign-pres .cover-divider{width:80px;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:24px auto}
  .campaign-pres .cover-date{font-size:0.9rem;color:var(--text-secondary);margin-bottom:20px;position:relative}
  .campaign-pres .cover-badge{display:inline-block;background:rgba(64,225,211,0.1);border:1px solid rgba(64,225,211,0.3);border-radius:24px;padding:8px 24px;font-size:0.85rem;color:var(--brand-cyan);font-weight:700;position:relative}

  /* Concept Slide */
  .campaign-pres .concept-slide{padding:40px 0}
  .campaign-pres .concept-card{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:14px;padding:36px;position:relative;overflow:hidden}
  .campaign-pres .concept-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-green),var(--brand-blue))}
  .campaign-pres .concept-card p{font-size:1.05rem;color:var(--text-secondary);line-height:2;white-space:pre-wrap}

  /* Divider Slide */
  .campaign-pres .divider-slide{text-align:center;padding:100px 20px 80px;position:relative}
  .campaign-pres .divider-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:400px;height:400px;background:radial-gradient(circle,rgba(64,225,211,0.05) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .divider-title{font-size:2.4rem;font-weight:700;color:var(--brand-cyan);margin-bottom:16px;position:relative}
  .campaign-pres .divider-desc{font-size:1.1rem;color:var(--text-secondary);max-width:600px;margin:0 auto 24px;line-height:1.8;position:relative;white-space:pre-wrap}
  .campaign-pres .divider-line{width:60px;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:0 auto}

  /* Creatives */
  .campaign-pres .assets-grid{display:grid;gap:24px}
  .campaign-pres .assets-grid.story-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
  .campaign-pres .assets-grid.standard-grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
  .campaign-pres .mockup-wrapper{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:14px;padding:20px;position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .campaign-pres .mockup-wrapper::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow))}
  .campaign-pres .asset-caption{font-size:0.82rem;color:var(--text-secondary);text-align:center;margin-top:12px;line-height:1.6}

  /* Closing Slide */
  .campaign-pres .closing-slide{text-align:center;padding:100px 20px 80px;position:relative}
  .campaign-pres .closing-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:500px;height:500px;background:radial-gradient(circle,rgba(243,213,109,0.08) 0%,transparent 60%);pointer-events:none}
  .campaign-pres .closing-title{font-size:3rem;font-weight:700;color:var(--brand-yellow);margin-bottom:12px;position:relative}
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
`
