import { NextRequest, NextResponse } from 'next/server'
import { getCampaignById, type Campaign, type CampaignSection } from '@/lib/campaigns'
import { getFeedback, upsertFeedback, type FeedbackStatus } from '@/lib/feedback'
import { getClientById } from '@/lib/clients'
import { postMondayUpdate, isMondayWriteConfigured } from '@/lib/monday'
import { verifyAccessToken } from '@/lib/content-access'
import { getSessionFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { captureException } from '@/lib/logger'

const STATUS_HE: Record<FeedbackStatus, string> = { approved: 'אישר', rejected: 'ביקש שינוי ב', pending: 'סימן כממתין' }

/** Notify the team on the client's Monday card. Best-effort — never blocks the response. */
async function notifyMonday(campaign: Campaign, section: CampaignSection | undefined, status: FeedbackStatus, comment: string | null, author: string | null) {
  try {
    if (!isMondayWriteConfigured() || !campaign.client_id) return
    const client = await getClientById(campaign.client_id)
    if (!client?.monday_item_id) return
    const who = author?.trim() ? author.trim() : 'הלקוח'
    const slideLabel = section?.title?.trim() ? `"${section.title.trim()}"` : 'שקף'
    const lines = [
      `🎨 ${who} ${STATUS_HE[status]} ${slideLabel} בקמפיין "${campaign.campaign_name}".`,
      comment?.trim() ? `💬 ${comment.trim()}` : '',
    ].filter(Boolean)
    await postMondayUpdate(client.monday_item_id, lines.join('\n'))
  } catch (err) {
    captureException(err, { route: 'feedback→monday', campaign: campaign.id })
  }
}

interface Ctx { params: Promise<{ id: string }> }

const VALID: FeedbackStatus[] = ['approved', 'rejected', 'pending']

/** Sections may be stored as a JSON string; normalize to an array. */
function parseSections(campaign: Campaign): CampaignSection[] {
  try {
    const raw = campaign.sections as CampaignSection[] | string | null
    if (typeof raw === 'string') return JSON.parse(raw) as CampaignSection[]
    return raw || []
  } catch {
    return []
  }
}

/** Feedback is readable only by whoever is allowed to view the campaign. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 120, prefix: 'feedback-read' })
  if (rl) return rl

  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    // Non-public campaigns (password-protected or not published) require a staff
    // session or a valid content-access token — same gate as the POST handler.
    if (campaign.password || campaign.status !== 'published') {
      const session = await getSessionFromRequest(req)
      const isStaff = !!session && (session.role === 'admin' || session.role === 'editor')
      if (!isStaff) {
        const token = req.cookies.get(`cmp_${campaign.id}`)?.value
        const ok = token ? await verifyAccessToken(token, campaign.id, campaign.password) : false
        if (!ok) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
      }
    }

    const feedback = await getFeedback(id)
    return NextResponse.json(feedback)
  } catch (err) {
    captureException(err, { route: 'GET /api/campaigns/[id]/feedback', id })
    return NextResponse.json([], { status: 200 })
  }
}

/**
 * Clients submit approval/rejection + comments. Access is gated by either an
 * editor/admin session or a valid content-access token (the password gate).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 60, prefix: 'feedback' })
  if (rl) return rl

  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    // Authorize: staff session OR (password set AND valid access token) OR public (no password)
    const session = await getSessionFromRequest(req)
    const isStaff = !!session && (session.role === 'admin' || session.role === 'editor')
    if (!isStaff && campaign.status !== 'published') {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }
    if (!isStaff && campaign.password) {
      const token = req.cookies.get(`cmp_${campaign.id}`)?.value
      const ok = token ? await verifyAccessToken(token, campaign.id, campaign.password) : false
      if (!ok) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    }

    const body = await req.json()
    const slideKey = String(body.slide_key || '').trim()
    const statusVal = body.status as FeedbackStatus
    if (!slideKey || !VALID.includes(statusVal)) {
      return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
    }

    // Only accept slide keys that map to real sections of this campaign
    const sectionIds = new Set(parseSections(campaign).map(s => s.id))
    if (!sectionIds.has(slideKey)) {
      return NextResponse.json({ error: 'שקופית לא קיימת' }, { status: 400 })
    }

    const feedback = await upsertFeedback({
      campaign_id: id,
      slide_key: slideKey,
      status: statusVal,
      comment: typeof body.comment === 'string' ? body.comment.slice(0, 2000) : null,
      author: typeof body.author === 'string' ? body.author.slice(0, 120) : null,
    })

    // When the client (not staff) responds, drop an update on their Monday card.
    if (!isStaff) {
      const section = parseSections(campaign).find(s => s.id === slideKey)
      await notifyMonday(campaign, section, statusVal, feedback.comment, feedback.author)
    }

    return NextResponse.json(feedback)
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/feedback', id })
    return NextResponse.json({ error: 'שגיאה בשמירת המשוב' }, { status: 500 })
  }
}
