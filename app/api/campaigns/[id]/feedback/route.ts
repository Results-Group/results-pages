import { NextRequest, NextResponse } from 'next/server'
import { getCampaignById, setCampaignMondayFeedbackItem, type Campaign, type CampaignSection } from '@/lib/campaigns'
import { getFeedback, upsertFeedback, type FeedbackStatus } from '@/lib/feedback'
import { postMondayUpdate, createMondayItem, isMondayFeedbackConfigured } from '@/lib/monday'
import { verifyAccessToken } from '@/lib/content-access'
import { getSessionFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { captureException } from '@/lib/logger'

const STATUS_HE: Record<FeedbackStatus, string> = { approved: 'אישר', rejected: 'ביקש שינוי ב', pending: 'סימן כממתין' }

/**
 * Post an update to the campaign's row on the dedicated Monday feedback board.
 * Creates the row on first feedback, then appends every later update to it.
 * Best-effort — never blocks the response.
 */
async function mondayNotify(campaign: Campaign, text: string) {
  try {
    if (!isMondayFeedbackConfigured()) return
    const boardId = process.env.MONDAY_FEEDBACK_BOARD_ID as string
    let itemId = campaign.monday_feedback_item_id
    if (!itemId) {
      const rowName = `${campaign.client?.trim() || 'לקוח'} — ${campaign.campaign_name}`
      itemId = await createMondayItem(boardId, rowName)
      await setCampaignMondayFeedbackItem(campaign.id, itemId)
    }
    await postMondayUpdate(itemId, text)
  } catch (err) {
    captureException(err, { route: 'feedback→monday', campaign: campaign.id })
  }
}

/** One-slide notification text. */
function singleText(campaign: Campaign, section: CampaignSection | undefined, status: FeedbackStatus, comment: string | null, author: string | null): string {
  const who = author?.trim() ? author.trim() : 'הלקוח'
  const slideLabel = section?.title?.trim() ? `"${section.title.trim()}"` : 'שקף'
  return [
    `🎨 ${who} ${STATUS_HE[status]} ${slideLabel} בקמפיין "${campaign.campaign_name}".`,
    comment?.trim() ? `💬 ${comment.trim()}` : '',
  ].filter(Boolean).join('\n')
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
    const sections = parseSections(campaign)
    const sectionIds = new Set(sections.map(s => s.id))

    // ── Bulk path (e.g. "approve all") → one Monday summary instead of many ──
    if (Array.isArray(body.bulk)) {
      const items = (body.bulk as Array<{ slide_key?: string; status?: FeedbackStatus; comment?: string; author?: string }>)
        .filter(it => it.slide_key && VALID.includes(it.status as FeedbackStatus) && sectionIds.has(String(it.slide_key)))
      const saved = []
      for (const it of items) {
        saved.push(await upsertFeedback({
          campaign_id: id,
          slide_key: String(it.slide_key),
          status: it.status as FeedbackStatus,
          comment: typeof it.comment === 'string' ? it.comment.slice(0, 2000) : null,
          author: typeof it.author === 'string' ? it.author.slice(0, 120) : null,
        }))
      }
      if (!isStaff && items.length) {
        const who = items.find(i => i.author?.trim())?.author?.trim() || 'הלקוח'
        const approved = items.filter(i => i.status === 'approved').length
        const rejected = items.filter(i => i.status === 'rejected').length
        const parts = [approved ? `אישר ${approved} שקפים` : '', rejected ? `ביקש שינוי ב-${rejected}` : ''].filter(Boolean).join(', ')
        await mondayNotify(campaign, `🎨 ${who} ${parts || 'עדכן שקפים'} בקמפיין "${campaign.campaign_name}".`)
      }
      return NextResponse.json(saved)
    }

    const slideKey = String(body.slide_key || '').trim()
    const statusVal = body.status as FeedbackStatus
    if (!slideKey || !VALID.includes(statusVal)) {
      return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
    }

    // Only accept slide keys that map to real sections of this campaign
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
      const section = sections.find(s => s.id === slideKey)
      await mondayNotify(campaign, singleText(campaign, section, statusVal, feedback.comment, feedback.author))
    }

    return NextResponse.json(feedback)
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/feedback', id })
    return NextResponse.json({ error: 'שגיאה בשמירת המשוב' }, { status: 500 })
  }
}
