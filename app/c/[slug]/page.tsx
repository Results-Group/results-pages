import { notFound } from 'next/navigation'
import { cookies } from 'next/headers'
import { Metadata } from 'next'
import { getCampaignBySlug, enrichCampaignUrls } from '@/lib/campaigns'
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

/** Flatten multi-paragraph text into one clean line for a link preview. */
function shareDescription(text: string | null, max = 200): string {
  const flat = (text || '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const campaign = await getCampaignBySlug(slug)

  if (!campaign) return { title: 'Campaign Not Found' }

  // Link previews always carry our own branded card. Using the client's logo
  // meant a client without one shared as a bare link with no image at all, and
  // a transparent logo rendered unpredictably across WhatsApp/Slack/Facebook.
  const shareImage = { url: '/og-image.png', width: 1200, height: 630, alt: 'Results Creative' }

  const isScheduled = campaign.publish_at && new Date(campaign.publish_at) > new Date()
  if (campaign.status === 'draft' || campaign.password || isScheduled) {
    return {
      title: 'Results Creative',
      robots: { index: false, follow: false },
      openGraph: { title: 'Results Creative', images: [shareImage] },
      twitter: { card: 'summary_large_image', title: 'Results Creative', images: [shareImage.url] },
    }
  }

  const title = `${campaign.client} – ${campaign.campaign_name}`
  // The concept is multi-paragraph free text. Share cards render a single
  // truncated line, so collapse the line breaks and cut at a word boundary
  // rather than letting the scraper chop mid-sentence.
  const description = shareDescription(campaign.concept) || `מצגת קריאייטיב עבור ${campaign.client}`

  return {
    title: `${title} | Results Creative`,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Results Creative',
      images: [shareImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [shareImage.url],
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

  // Past the end date (or already auto-archived): no longer public. The daily
  // cron flips the status to archived, but guard here too so it locks the moment
  // the date passes, before the cron runs. Staff preview still works.
  const isExpired = !!rawCampaign.expires_at && new Date(rawCampaign.expires_at) < new Date()
  if ((isExpired || rawCampaign.status === 'archived') && !isPreview) {
    notFound()
  }

  if (rawCampaign.password && !isEditorOrAdmin) {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(`cmp_${rawCampaign.id}`)?.value
    const tokenValid = accessToken ? await verifyAccessToken(accessToken, rawCampaign.id, rawCampaign.password) : false
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
  // The cover eyebrow reads as an English date line (e.g. "July 20, 2026"),
  // not a Hebrew one — it sits alongside the English brand lockup.
  const formattedDate = new Date(campaign.created_at).toLocaleDateString('en-US', {
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
      // Client-facing approval/commenting is intentionally off: the deck is a
      // presentation, and feedback is collected outside it. Flip to `true` to
      // bring back the approval bar, progress counter and pinned comments.
      feedbackEnabled={false}
    />
  )
}

export type { SlideData } from '@/lib/slides'
