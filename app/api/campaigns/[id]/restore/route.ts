import { NextRequest, NextResponse } from 'next/server'
import { getCampaignById, restoreCampaign } from '@/lib/campaigns'
import { getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const campaign = await getCampaignById(id)
  if (!campaign) return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })

  if (campaign.workspace_id) {
    const permErr = await requireWorkspacePermission(req, campaign.workspace_id, 'delete')
    if (permErr) return permErr
  }

  try {
    await restoreCampaign(id)
    await logAudit({ actor: session, action: 'restore', entity_type: 'campaign', entity_id: id, entity_label: campaign.campaign_name, workspace_id: campaign.workspace_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns/[id]/restore', id })
    return NextResponse.json({ error: 'שגיאה בשחזור הקמפיין' }, { status: 500 })
  }
}
