import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getCampaignBySlug, getAssetPublicUrl, parseVideoUrl } from '@/lib/campaigns'
import type { CampaignSection, CampaignAsset } from '@/lib/campaigns'
import InstagramFeedMockup from './mockups/instagram-feed'
import InstagramStoryMockup from './mockups/instagram-story'
import FacebookFeedMockup from './mockups/facebook-feed'
import VideoCard from './mockups/video-card'
import GeneralCard from './mockups/general-card'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const campaign = await getCampaignBySlug(slug)

  if (!campaign || campaign.status === 'draft') {
    return { title: 'Campaign Not Found' }
  }

  return {
    title: `${campaign.client} – ${campaign.campaign_name} | Results Digital`,
    description: campaign.concept || `Creative presentation for ${campaign.client}`,
    openGraph: {
      title: `${campaign.client} – ${campaign.campaign_name}`,
      description: campaign.concept || `Creative presentation for ${campaign.client}`,
      type: 'website',
    },
  }
}

const CAMPAIGN_STYLES = `
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Regular.woff2') format('woff2');font-weight:400}
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Bold.woff2') format('woff2');font-weight:700}
  @font-face{font-family:'Ping';src:url('https://my-fonts-bucket-results.s3.eu-north-1.amazonaws.com/pingnew/Ping-Light.woff2') format('woff2');font-weight:300}

  .campaign-page{
    --bg-dark:#0d1112;
    --brand-cyan:#40e1d3;
    --brand-yellow:#F3D56D;
    --brand-green:#2EC4B6;
    --brand-blue:#5B8CDB;
    --brand-red:#FF2A4D;
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
    margin:-1px;
    padding:1px;
  }

  .campaign-page .bg-noise{position:fixed;inset:0;opacity:0.03;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");pointer-events:none;z-index:0}
  .campaign-page .bg-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(64,225,211,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(64,225,211,0.03) 1px,transparent 1px);background-size:60px 60px;pointer-events:none;z-index:0}
  .campaign-page .ambient-light{position:fixed;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(64,225,211,0.06) 0%,transparent 70%);pointer-events:none;z-index:0}
  .campaign-page .ambient-light-2{position:fixed;bottom:-200px;left:-200px;width:600px;height:600px;background:radial-gradient(circle,rgba(91,140,219,0.04) 0%,transparent 70%);pointer-events:none;z-index:0}

  .campaign-page .c-header{position:sticky;top:0;z-index:1000;background:rgba(13,17,18,0.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border-color);padding:14px 40px;display:flex;align-items:center;justify-content:space-between}
  .campaign-page .c-header .brand{font-size:1.3rem;font-weight:700;color:var(--brand-cyan)}
  .campaign-page .c-header .date-badge{background:rgba(64,225,211,0.1);border:1px solid rgba(64,225,211,0.3);border-radius:20px;padding:4px 16px;font-size:0.82rem;color:var(--brand-cyan)}

  .campaign-page .c-main{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:30px 20px 60px}

  .campaign-page .hero-section{text-align:center;padding:40px 20px 50px;position:relative;z-index:1}
  .campaign-page .hero-section .client-logo{width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid rgba(243,213,109,0.3);box-shadow:0 0 30px rgba(243,213,109,0.1);margin:0 auto 20px;display:block}
  .campaign-page .hero-section .client-name{font-size:2.2rem;font-weight:700;color:var(--brand-yellow);margin-bottom:8px}
  .campaign-page .hero-section .campaign-name-h{font-size:1.3rem;font-weight:400;color:var(--text-primary);margin-bottom:12px}
  .campaign-page .hero-section .hero-divider{width:60px;height:2px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow));border-radius:2px;margin:20px auto 0}

  .campaign-page .concept-card{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:14px;padding:28px;margin-bottom:40px;position:relative;overflow:hidden}
  .campaign-page .concept-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-green),var(--brand-blue))}
  .campaign-page .concept-card p{font-size:0.95rem;color:var(--text-secondary);line-height:1.8}

  .campaign-page .section-block{margin-bottom:48px}
  .campaign-page .section-title-h{font-size:1.6rem;font-weight:700;margin-bottom:24px;color:var(--text-primary);display:flex;align-items:center;gap:12px}
  .campaign-page .section-title-h::before{content:'';display:block;width:4px;height:28px;background:var(--brand-yellow);border-radius:2px;flex-shrink:0}

  .campaign-page .assets-grid{display:grid;gap:24px}
  .campaign-page .assets-grid.story-grid{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
  .campaign-page .assets-grid.standard-grid{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}

  .campaign-page .mockup-wrapper{background:var(--card-bg);backdrop-filter:blur(12px);border:1px solid var(--border-color);border-radius:14px;padding:20px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .campaign-page .mockup-wrapper::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--brand-cyan),var(--brand-yellow))}

  .campaign-page .c-footer{display:flex;justify-content:space-between;align-items:center;padding:20px 40px;border-top:1px solid var(--border-color);margin-top:40px;position:relative;z-index:1;background:rgba(13,17,18,0.5)}
  .campaign-page .c-footer p,.campaign-page .c-footer a{color:var(--text-secondary);font-size:0.8rem;margin:0;text-decoration:none}
  .campaign-page .c-footer a:hover{color:var(--text-primary)}

  @media(max-width:768px){
    .campaign-page .c-header{padding:12px 16px}
    .campaign-page .c-main{padding:20px 12px 40px}
    .campaign-page .hero-section .client-name{font-size:1.6rem}
    .campaign-page .hero-section .campaign-name-h{font-size:1rem}
    .campaign-page .assets-grid.standard-grid{grid-template-columns:1fr}
    .campaign-page .assets-grid.story-grid{grid-template-columns:repeat(2,1fr)}
    .campaign-page .c-footer{padding:16px;flex-direction:column;gap:8px;text-align:center}
  }
`

export default async function CampaignPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const isPreview = sp.preview === '1'
  const campaign = await getCampaignBySlug(slug)

  if (!campaign || (!isPreview && campaign.status === 'draft')) {
    notFound()
  }

  const clientLogoUrl = campaign.logo_path ? getAssetPublicUrl(campaign.logo_path) : null
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const sections = (campaign.sections || []) as CampaignSection[]

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CAMPAIGN_STYLES }} />
      <div className="campaign-page">
        <div className="bg-noise" />
        <div className="bg-grid" />
        <div className="ambient-light" />
        <div className="ambient-light-2" />

        <header className="c-header">
          <div className="brand">Results Digital</div>
          <div className="date-badge">{formattedDate}</div>
        </header>

        <div className="c-main">
          <div className="hero-section">
            {clientLogoUrl && (
              <img src={clientLogoUrl} alt={campaign.client} className="client-logo" />
            )}
            <h1 className="client-name">{campaign.client}</h1>
            <h2 className="campaign-name-h">{campaign.campaign_name}</h2>
            <div className="hero-divider" />
          </div>

          {campaign.concept && (
            <div className="concept-card">
              <p>{campaign.concept}</p>
            </div>
          )}

          {sections.map((section: CampaignSection) => (
            <div key={section.id} className="section-block">
              {section.title && <h3 className="section-title-h">{section.title}</h3>}

              {section.assets && section.assets.length > 0 && (
                <div className={`assets-grid ${section.mockup_type === 'instagram_story' ? 'story-grid' : 'standard-grid'}`}>
                  {section.assets.map((asset: CampaignAsset) => (
                    <div key={asset.id} className="mockup-wrapper">
                      <AssetRenderer
                        asset={asset}
                        mockupType={section.mockup_type}
                        clientLogoUrl={clientLogoUrl}
                        clientName={campaign.client}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <footer className="c-footer">
          <a href="https://www.resultsgroup.co.il" target="_blank" rel="noopener noreferrer">
            www.resultsgroup.co.il
          </a>
          <p>By Results Group</p>
        </footer>
      </div>
    </>
  )
}

function AssetRenderer({
  asset, mockupType, clientLogoUrl, clientName,
}: {
  asset: CampaignAsset
  mockupType: CampaignSection['mockup_type']
  clientLogoUrl: string | null
  clientName: string
}) {
  const imageUrl = asset.file_path ? getAssetPublicUrl(asset.file_path) : ''
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
