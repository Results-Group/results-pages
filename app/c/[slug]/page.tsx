import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import { getCampaignBySlug, enrichCampaignUrls, getAssetPublicUrl } from '@/lib/campaigns'
import type { CampaignSection } from '@/lib/campaigns'
import { getClientById } from '@/lib/clients'
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

  const isScheduled = campaign.publish_at && new Date(campaign.publish_at) > new Date()
  if (campaign.status === 'draft' || campaign.password || isScheduled) {
    return { title: 'Results Digital', robots: { index: false, follow: false } }
  }

  const title = `${campaign.client} – ${campaign.campaign_name}`
  const description = campaign.concept || `מצגת קריאייטיב עבור ${campaign.client}`
  let logoPath = campaign.logo_path
  if (!logoPath && campaign.client_id) {
    const client = await getClientById(campaign.client_id)
    logoPath = client?.logo_path || null
  }
  const image = logoPath ? getAssetPublicUrl(logoPath) : undefined

  return {
    title: `${title} | Results Digital`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Results Digital',
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(image ? { images: [image] } : {}),
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

  // Scheduled publish: not yet available to the public (staff preview bypasses)
  if (rawCampaign.publish_at && new Date(rawCampaign.publish_at) > new Date() && !isPreview) {
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

  // Effective branding: campaign logo overrides, else inherit the client's logo/color
  let effectiveLogoPath = campaign.logo_path
  let brandColor: string | null = null
  if (campaign.client_id) {
    const client = await getClientById(campaign.client_id)
    if (client) {
      brandColor = client.brand_color
      if (!effectiveLogoPath) effectiveLogoPath = client.logo_path
    }
  }
  const clientLogoUrl = effectiveLogoPath ? assetProxyUrl(effectiveLogoPath) : null
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('he-IL', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  const slides = buildCampaignSlides({
    client: campaign.client,
    campaignName: campaign.campaign_name,
    concept: campaign.concept,
    copies: campaign.copies || [],
    clientLogoUrl,
    date: formattedDate,
    sections: (campaign.sections || []) as CampaignSection[],
  })

  return (
    <CampaignPresentation
      slides={slides}
      clientName={campaign.client}
      campaignName={campaign.campaign_name}
      brandColor={brandColor}
      campaignId={campaign.id}
      feedbackEnabled
    />
  )
}

export type { SlideData } from '@/lib/slides'
