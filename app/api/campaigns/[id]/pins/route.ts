import { NextRequest, NextResponse } from 'next/server'
import { getCampaignById, type Campaign, type CampaignSection } from '@/lib/campaigns'
import { getPins, createPin, setPinResolved, deletePin } from '@/lib/pins'
import { verifyAccessToken } from '@/lib/content-access'
import { getSessionFromRequest } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

function parseSections(campaign: Campaign): CampaignSection[] {
  try {
    const raw = campaign.sections as CampaignSection[] | string | null
    if (typeof raw === 'string') return JSON.parse(raw) as CampaignSection[]
    return raw || []
  } catch {
    return []
  }
}

/** Same gate as slide feedback: staff session, or valid access token, or public-if-published. */
async function authorize(req: NextRequest, campaign: Campaign): Promise<boolean> {
  const session = await getSessionFromRequest(req)
  const isStaff = !!session && (session.role === 'admin' || session.role === 'editor')
  if (isStaff) return true
  if (campaign.status !== 'published') return false
  if (campaign.password) {
    const token = req.cookies.get(`cmp_${campaign.id}`)?.value
    return token ? await verifyAccessToken(token, campaign.id, campaign.password) : false
  }
  return true
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 120, prefix: 'pins-read' })
  if (rl) return rl
  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    if (!(await authorize(req, campaign))) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    return NextResponse.json(await getPins(id))
  } catch (err) {
    captureException(err, { route: 'GET /api/campaigns/[id]/pins', id })
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const rl = await rateLimit(req, { windowMs: 60_000, max: 60, prefix: 'pins-write' })
  if (rl) return rl
  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    if (!(await authorize(req, campaign))) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })

    const body = await req.json()
    const slideKey = String(body.slide_key || '').trim()
    const x = Number(body.x)
    const y = Number(body.y)
    if (!slideKey || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
      return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
    }
    const sectionIds = new Set(parseSections(campaign).map(s => s.id))
    if (!sectionIds.has(slideKey)) return NextResponse.json({ error: 'שקופית לא קיימת' }, { status: 400 })

    const pin = await createPin({
      campaign_id: id,
      slide_key: slideKey,
      asset_id: typeof body.asset_id === 'string' ? body.asset_id.slice(0, 100) : null,
      x, y,
      comment: typeof body.comment === 'string' ? body.comment.slice(0, 2000) : null,
      author: typeof body.author === 'string' ? body.author.slice(0, 120) : null,
    })
    return NextResponse.json(pin)
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/pins', id })
    return NextResponse.json({ error: 'שגיאה בשמירת ההערה' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    if (!(await authorize(req, campaign))) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    const body = await req.json()
    const pinId = String(body.id || '').trim()
    if (!pinId) return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
    await setPinResolved(pinId, id, !!body.resolved)
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'PATCH /api/campaigns/[id]/pins', id })
    return NextResponse.json({ error: 'שגיאה בעדכון ההערה' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  try {
    const campaign = await getCampaignById(id)
    if (!campaign || campaign.deleted_at) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    if (!(await authorize(req, campaign))) return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 })
    const body = await req.json()
    const pinId = String(body.id || '').trim()
    if (!pinId) return NextResponse.json({ error: 'נתונים חסרים' }, { status: 400 })
    await deletePin(pinId, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/campaigns/[id]/pins', id })
    return NextResponse.json({ error: 'שגיאה במחיקת ההערה' }, { status: 500 })
  }
}
