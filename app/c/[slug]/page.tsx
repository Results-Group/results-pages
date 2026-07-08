import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import { getCampaignBySlug, enrichCampaignUrls } from '@/lib/campaigns'
import type { CampaignSection } from '@/lib/campaigns'
import { getSession } from '@/lib/auth'
import { verifyAccessToken } from '@/lib/content-access'
import { assetProxyUrl } from '@/lib/asset-url'
import { buildCampaignSlides } from '@/lib/slides'
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

  const session = await getSession()
  const isEditorOrAdmin = !!session && (session.role === 'admin' || session.role === 'editor')
  const isPreview = sp.preview === '1' && isEditorOrAdmin

  if (rawCampaign.status === 'draft' && !isPreview) {
    notFound()
  }

  if (rawCampaign.password && !isEditorOrAdmin) {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(`cmp_${rawCampaign.id}`)?.value
    const tokenValid = accessToken ? await verifyAccessToken(accessToken, rawCampaign.id) : false
    if (!tokenValid) {
      return <PasswordGate slug={slug} clientName={rawCampaign.client} />
    }
  }

  const campaign = enrichCampaignUrls(rawCampaign)
  const clientLogoUrl = campaign.logo_path ? assetProxyUrl(campaign.logo_path) : null
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const slides = buildCampaignSlides({
    client: campaign.client,
    campaignName: campaign.campaign_name,
    concept: campaign.concept,
    clientLogoUrl,
    date: formattedDate,
    sections: (campaign.sections || []) as CampaignSection[],
  })

  return (
    <CampaignPresentation
      slides={slides}
      clientName={campaign.client}
      campaignName={campaign.campaign_name}
    />
  )
}

export type { SlideData } from '@/lib/slides'
