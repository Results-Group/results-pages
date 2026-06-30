import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import { getCampaignBySlug, getAssetPublicUrl, enrichCampaignUrls } from '@/lib/campaigns'
import type { CampaignSection, CampaignAsset } from '@/lib/campaigns'
import { getSession } from '@/lib/auth'
import CampaignPresentation from './presentation'
import PasswordGate from './password-gate'

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const campaign = await getCampaignBySlug(slug)

  if (!campaign) return { title: 'Campaign Not Found' }

  // Don't leak content for drafts or password-protected campaigns
  if (campaign.status === 'draft' || campaign.password) {
    return { title: 'Results Digital', robots: { index: false, follow: false } }
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

export default async function CampaignPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams
  const rawCampaign = await getCampaignBySlug(slug)

  if (!rawCampaign) {
    notFound()
  }

  // Only logged-in admins/editors may preview, and preview is the only way to view drafts.
  const session = await getSession()
  const isAdmin = !!session
  const isPreview = sp.preview === '1' && isAdmin

  if (rawCampaign.status === 'draft' && !isPreview) {
    notFound()
  }

  // Password gate: published campaigns with a password require the visitor to
  // enter it (admins bypass since they're authenticated).
  if (rawCampaign.password && !isAdmin) {
    const cookieStore = await cookies()
    const access = cookieStore.get(`cmp_${rawCampaign.id}`)?.value
    if (access !== rawCampaign.password) {
      return <PasswordGate slug={slug} clientName={rawCampaign.client} />
    }
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
