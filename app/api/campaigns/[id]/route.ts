import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission, requireResourcePermission } from '@/lib/auth'
import { getCampaignById, updateCampaign, deleteCampaign, purgeCampaign, enrichCampaignUrls } from '@/lib/campaigns'
import { findOrCreateClient } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'
import { slugifyPath } from '@/lib/slug'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const campaign = await getCampaignById(id)
    if (!campaign) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }
    const permErr = await requireResourcePermission(request, campaign.workspace_id, 'view')
    if (permErr) return permErr
    const enriched = enrichCampaignUrls(campaign)
    return NextResponse.json({ ...enriched, has_password: !!enriched.password, password: undefined })
  } catch {
    return NextResponse.json({ error: 'שגיאה בטעינת קמפיין' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await getCampaignById(id)
    if (!existing) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, existing.workspace_id, 'edit')
    if (permErr) return permErr

    const body = await request.json()

    // Custom campaign URL. The slug is the public link, so it must be
    // ASCII-safe and unique; a clash is reported as 409 rather than surfacing
    // the DB's unique-constraint violation as a generic save error.
    if (typeof body.slug === 'string') {
      const desired = slugifyPath(body.slug, '')
      if (!desired) {
        return NextResponse.json({ error: 'כתובת לא תקינה — השתמשו באותיות, ספרות ומקפים' }, { status: 400 })
      }
      if (desired !== existing.slug) {
        const { data: taken } = await supabase
          .from('campaigns')
          .select('id')
          .eq('slug', desired)
          .neq('id', id)
          .maybeSingle()
        if (taken) {
          return NextResponse.json({ error: `הכתובת "${desired}" כבר תפוסה בקמפיין אחר` }, { status: 409 })
        }
      }
      body.slug = desired
    }

    // Moving the campaign to another workspace requires permission there too
    if (body.workspace_id && body.workspace_id !== existing.workspace_id) {
      const permErr = await requireWorkspacePermission(request, body.workspace_id, 'edit')
      if (permErr) return permErr
    }

    // Keep client_id in sync when the client name changes (the editor may send
    // client_id: null after free typing — re-resolve from the name in that case)
    const targetWorkspaceId = body.workspace_id !== undefined ? body.workspace_id : existing.workspace_id
    if (typeof body.client === 'string' && body.client.trim() && (body.client_id === undefined || body.client_id === null)) {
      try {
        const c = await findOrCreateClient(body.client, targetWorkspaceId)
        body.client_id = c.id
      } catch { /* non-fatal */ }
    }

    const campaign = await updateCampaign(id, body, { baseUpdatedAt: body.base_updated_at })
    const action = body.status === 'published' && existing.status !== 'published' ? 'publish' : 'update'
    await logAudit({ actor: session, action, entity_type: 'campaign', entity_id: id, entity_label: campaign.campaign_name, workspace_id: existing.workspace_id })
    return NextResponse.json({ ...campaign, has_password: !!campaign.password, password: undefined })
  } catch (err) {
    if ((err as { code?: string })?.code === 'CONFLICT') {
      return NextResponse.json({ error: 'הקמפיין עודכן במקום אחר. רעננו את הדף כדי לא לדרוס שינויים.' }, { status: 409 })
    }
    captureException(err, { route: 'PUT /api/campaigns/[id]', id })
    return NextResponse.json({ error: 'שגיאה בעדכון קמפיין' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const existing = await getCampaignById(id)
    if (!existing) {
      return NextResponse.json({ error: 'קמפיין לא נמצא' }, { status: 404 })
    }

    const permErr = await requireResourcePermission(request, existing.workspace_id, 'delete')
    if (permErr) return permErr

    const purge = new URL(request.url).searchParams.get('purge') === '1'
    if (purge) await purgeCampaign(id)
    else await deleteCampaign(id)
    await logAudit({ actor: session, action: purge ? 'purge' : 'delete', entity_type: 'campaign', entity_id: id, entity_label: existing.campaign_name, workspace_id: existing.workspace_id })
    return NextResponse.json({ success: true, purged: purge })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/campaigns/[id]', id })
    return NextResponse.json({ error: 'שגיאה במחיקת קמפיין' }, { status: 500 })
  }
}
