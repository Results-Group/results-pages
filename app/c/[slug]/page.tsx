import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getCampaignBySlug, getAssetPublicUrl, enrichCampaignUrls } from '@/lib/campaigns'
import type { CampaignSection, CampaignAsset } from '@/lib/campaigns'
import CampaignPresentation from './presentation'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const campaign = await getCampaignBySlug(slug)

  if (!campaign) return { title: 'Campaign Not Found' }

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

export default async function CampaignPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const isPreview = sp.preview === '1'
  const rawCampaign = await getCampaignBySlug(slug)

  if (!rawCampaign || (!isPreview && rawCampaign.status === 'draft')) {
    notFound()
  }

  const campaign = enrichCampaignUrls(rawCampaign)
  const clientLogoUrl = campaign.logo_url || (campaign.logo_path ? getAssetPublicUrl(campaign.logo_path) : null)
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const sections = (campaign.sections || []) as CampaignSection[]

  const slides: SlideData[] = []

  slides.push({ type: 'cover', title: campaign.client, subtitle: campaign.campaign_name, logoUrl: clientLogoUrl, date: formattedDate })

  if (campaign.concept) {
    slides.push({ type: 'concept', title: 'קונספט הקמפיין', content: campaign.concept })
  }

  for (const section of sections) {
    if (section.mockup_type === 'divider') {
      slides.push({ type: 'divider', title: section.title, content: section.description })
    } else if ((section.assets || []).length > 0) {
      slides.push({
        type: 'creatives',
        title: section.title,
        mockupType: section.mockup_type,
        assets: section.assets || [],
        clientLogoUrl,
        clientName: campaign.client,
      })
    }
  }

  slides.push({ type: 'closing', title: 'תודה רבה!', subtitle: campaign.client })

  return (
    <CampaignPresentation
      slides={slides}
      clientName={campaign.client}
      campaignName={campaign.campaign_name}
    />
  )
}

export interface SlideData {
  type: 'cover' | 'concept' | 'divider' | 'creatives' | 'closing'
  title: string
  subtitle?: string
  content?: string
  logoUrl?: string | null
  date?: string
  mockupType?: string
  assets?: CampaignAsset[]
  clientLogoUrl?: string | null
  clientName?: string
}
