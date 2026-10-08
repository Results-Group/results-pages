import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { Metadata } from 'next'
import { getCampaignBySlug } from '@/lib/campaigns'
import { getSession, canStaffViewResource } from '@/lib/auth'
import { verifyAccessToken, verifyRenderToken } from '@/lib/content-access'
import { buildDeckForCampaign } from '@/lib/campaign-deck'
import CampaignPresentation from './presentation'
import PasswordGate from './password-gate'
import MaintenancePage from './maintenance'
import ContentUnavailable from '@/app/_deck/unavailable'
import { databaseReachable, rebuildHold } from '@/lib/db-health'
import { recordDeckView } from '@/lib/deck-views'

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

  if (!campaign) {
    // During a database outage the link preview must not say "not found" —
    // clients re-share these links. See MaintenancePage.
    if (rebuildHold() || !(await databaseReachable())) {
      return { title: 'המצגת בעדכון | Results Digital', robots: { index: false, follow: false } }
    }
    return { title: 'הדף לא נמצא | Results Digital', robots: { index: false, follow: false } }
  }

  // Link previews always carry our own branded card. Using the client's logo
  // meant a client without one shared as a bare link with no image at all, and
  // a transparent logo rendered unpredictably across WhatsApp/Slack/Facebook.
  const shareImage = { url: '/og-image.png', width: 1200, height: 630, alt: 'Results Creative' }

  const isScheduled = campaign.publish_at && new Date(campaign.publish_at) > new Date()
  const isExpiredMeta = (!!campaign.expires_at && new Date(campaign.expires_at) < new Date()) || campaign.status === 'archived'
  // Expired/archived included: the deck itself is gone, so the share preview
  // must stop leaking the client and campaign name too.
  if (campaign.status === 'draft' || campaign.password || isScheduled || isExpiredMeta) {
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
    // A published deck is a private pitch for one client. The og/twitter cards
    // below still populate link previews; noindex only keeps it out of search
    // results, where the slug alone would otherwise expose it.
    robots: { index: false, follow: false },
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
    // Null means either "no such campaign" or "the database is down" — and
    // clients hold links we sent them, so during an outage they must see
    // "we're on it", not a 404. Added 2026-08-02, the night the production
    // Supabase project was deleted and every sent link broke at once.
    if (rebuildHold() || !(await databaseReachable())) return <MaintenancePage />
    notFound()
  }

  const session = await getSession()
  // Staff access is scoped to the campaign's own workspace — a global 'editor'
  // role is NOT enough, or an editor in workspace A reads workspace B's
  // password-protected decks and drafts.
  const isEditorOrAdmin = await canStaffViewResource(rawCampaign.workspace_id)
  // The PDF export's own headless browser (app/api/campaigns/[id]/pdf). The
  // route already checked the requester may see this deck, and signed that into
  // the token: it opens the password gate and stays out of the view count, and
  // opens a draft only when the requester was staff. A bad or stale token
  // changes nothing — the URL then renders exactly like the plain deck.
  const render = typeof sp.pdf === 'string' ? await verifyRenderToken(sp.pdf, rawCampaign.id) : null
  const isPreview = (sp.preview === '1' && isEditorOrAdmin) || !!render?.staff

  if (rawCampaign.status === 'draft' && !isPreview) {
    return <ContentUnavailable variant="not_published" />
  }

  // Scheduled publish: not yet available to the public (staff preview bypasses)
  if (rawCampaign.publish_at && new Date(rawCampaign.publish_at) > new Date() && !isPreview) {
    return <ContentUnavailable variant="not_published" />
  }

  // Past the end date (or already auto-archived): no longer public. The daily
  // cron flips the status to archived, but guard here too so it locks the moment
  // the date passes, before the cron runs. Staff preview still works. A branded
  // "expired" page, not notFound() — the client holds a link we sent them.
  const isExpired = !!rawCampaign.expires_at && new Date(rawCampaign.expires_at) < new Date()
  if ((isExpired || rawCampaign.status === 'archived') && !isPreview) {
    return <ContentUnavailable variant="expired" />
  }

  if (rawCampaign.password && !isEditorOrAdmin && !render) {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(`cmp_${rawCampaign.id}`)?.value
    const tokenValid = accessToken ? await verifyAccessToken(accessToken, rawCampaign.id, rawCampaign.password) : false
    if (!tokenValid) {
      return <PasswordGate slug={slug} clientName={rawCampaign.client} />
    }
  }

  // A real client view: every gate passed and there is no staff session.
  // Fire-and-forget — tracking must never slow or break the render.
  if (!session && !render) {
    const hdrs = await headers()
    recordDeckView({
      content_type: 'campaign',
      content_id: rawCampaign.id,
      ip: hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      user_agent: hdrs.get('user-agent') || undefined,
    }).catch(() => {})
  }

  const { campaign, slides, brandColor } = await buildDeckForCampaign(rawCampaign)

  return (
    <CampaignPresentation
      slides={slides}
      clientName={campaign.client}
      campaignName={campaign.campaign_name}
      brandColor={brandColor}
      campaignId={campaign.id}
      pdfMode={!!render}
      // Client-facing approval/commenting is intentionally off: the deck is a
      // presentation, and feedback is collected outside it. Flip to `true` to
      // bring back the approval bar, progress counter and pinned comments.
      feedbackEnabled={false}
    />
  )
}

export type { SlideData } from '@/lib/slides'
