import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { getCampaignById } from '@/lib/campaigns'
import { getClientById } from '@/lib/clients'
import { geminiGenerateJson, isAiConfigured } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'
import { captureException } from '@/lib/logger'

export const runtime = 'nodejs'

interface Ctx { params: Promise<{ id: string }> }

interface CopyResult { captions?: string[]; titles?: string[] }

/** Generate ad copy for a campaign slide, grounded in the client's distilled positioning. */
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
  if (campaign.workspace_id) {
    const permErr = await requireWorkspacePermission(req, campaign.workspace_id, 'edit')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role === 'viewer') {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }

  const rl = await rateLimit(req, { windowMs: 60_000, max: 15, prefix: 'ai-copy' })
  if (rl) return rl

  if (!isAiConfigured()) {
    return NextResponse.json({ error: 'AI לא מוגדר — חסר GEMINI_API_KEY' }, { status: 503 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const slideTitle = typeof body.slideTitle === 'string' ? body.slideTitle : ''
    const slideDescription = typeof body.slideDescription === 'string' ? body.slideDescription : ''
    const mockupType = typeof body.mockupType === 'string' ? body.mockupType : 'general'

    let positioning = ''
    if (campaign.client_id) {
      const client = await getClientById(campaign.client_id)
      positioning = client?.positioning || ''
    }

    const prompt = `אתה קופירייטר בכיר במשרד פרסום דיגיטלי. כתוב קופי למודעה בעברית, נאמן למיצוב המותג של הלקוח. הימנע מקלישאות, כתוב חד וממוקד.

מיצוב המותג של הלקוח "${campaign.client || ''}":
${positioning || '(לא הוזן מסמך מיצוב — התבסס על שם הלקוח והקמפיין בלבד)'}

שם הקמפיין: ${campaign.campaign_name || ''}
${campaign.concept ? `קונספט הקמפיין: ${campaign.concept}` : ''}
הקשר השקף: סוג מוקאפ "${mockupType}"${slideTitle ? `, כותרת "${slideTitle}"` : ''}${slideDescription ? `, תיאור "${slideDescription}"` : ''}

החזר JSON בלבד במבנה הזה:
{
  "captions": ["3 וריאציות קופי קצר למודעה, כל אחת מוכנה לפרסום"],
  "titles": ["3 כותרות קצרות וקולעות לשקף"]
}`

    const result = await geminiGenerateJson<CopyResult>(prompt)
    return NextResponse.json({
      captions: Array.isArray(result.captions) ? result.captions.filter(s => typeof s === 'string') : [],
      titles: Array.isArray(result.titles) ? result.titles.filter(s => typeof s === 'string') : [],
      grounded: Boolean(positioning),
    })
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/generate-copy', id })
    return NextResponse.json({ error: 'שגיאה ביצירת טקסט' }, { status: 500 })
  }
}
