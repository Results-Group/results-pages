import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { getCampaigns, createCampaign } from '@/lib/campaigns'
import { findOrCreateClient, getClientById } from '@/lib/clients'
import { slugifyPath } from '@/lib/slug'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const status = searchParams.get('status') || undefined
  const deleted = searchParams.get('deleted') === '1'
  const templates = searchParams.get('templates') === '1'
  const workspaceId = searchParams.get('workspace_id') || await getActiveWorkspaceId(request) || undefined

  // A caller may only list a workspace they belong to; without a workspace
  // scope, only global admins/owners may enumerate everything.
  if (workspaceId) {
    const permErr = await requireWorkspacePermission(request, workspaceId, 'view')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role !== 'admin') {
    return NextResponse.json([])
  }

  try {
    const campaigns = await getCampaigns({ search, status, workspace_id: workspaceId, deleted, templates })

    // Aggregate per-campaign approval counts so the list can show a feedback badge
    // without opening each editor (same idea as client counts in /api/clients).
    const ids = campaigns.map(c => c.id)
    const counts: Record<string, { approved: number; rejected: number; pending: number }> = {}
    if (ids.length) {
      const { data: fb } = await supabase.from('slide_feedback').select('campaign_id,status').in('campaign_id', ids)
      for (const r of fb || []) {
        const c = (counts[r.campaign_id] ||= { approved: 0, rejected: 0, pending: 0 })
        const st = String(r.status)
        if (st === 'approved' || st === 'rejected' || st === 'pending') c[st]++
      }
    }

    const safe = campaigns.map(c => ({
      ...c,
      has_password: !!c.password,
      password: undefined,
      feedback_counts: counts[c.id] || { approved: 0, rejected: 0, pending: 0 },
    }))
    return NextResponse.json(safe)
  } catch (err) {
    captureException(err, { route: 'GET /api/campaigns', workspaceId })
    return NextResponse.json({ error: 'שגיאה בטעינת קמפיינים' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const { client, campaign_name, concept, status, password, sections, logo_path, publish_at } = body

    // Honor an explicit workspace from the body, falling back to the active-workspace cookie
    const workspaceId: string | null = body.workspace_id ?? await getActiveWorkspaceId(request)
    if (workspaceId) {
      const permErr = await requireWorkspacePermission(request, workspaceId, 'create')
      if (permErr) return permErr
    } else if (!session.isOwner && session.role === 'viewer') {
      // No workspace scope — viewers may not create orphan resources
      return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
    }

    if (!client || !campaign_name) {
      return NextResponse.json({ error: 'שם לקוח ושם קמפיין הם שדות חובה' }, { status: 400 })
    }

    // Transliterate Hebrew → Latin so a Hebrew campaign name yields a readable
    // slug (e.g. "kmpyyn-abc") instead of being stripped to just the suffix.
    const baseSlug = slugifyPath(body.slug || campaign_name, '')
    const suffix = crypto.randomUUID().slice(0, 6)
    const slug = baseSlug ? `${baseSlug}-${suffix}` : suffix

    // Check slug uniqueness directly against the table — the DB UNIQUE constraint
    // also covers soft-deleted rows, which getCampaignBySlug filters out
    const { data: slugTaken } = await supabase
      .from('campaigns')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (slugTaken) {
      return NextResponse.json({ error: `קמפיין עם הסלאג "${slug}" כבר קיים` }, { status: 409 })
    }

    // Resolve (or create) the client entity so campaigns link to a real client
    let clientId: string | null = body.client_id || null
    if (clientId) {
      const clientRow = await getClientById(clientId)
      if (!clientRow) {
        return NextResponse.json({ error: 'הלקוח שנבחר לא נמצא' }, { status: 400 })
      }
      if (clientRow.workspace_id && clientRow.workspace_id !== workspaceId) {
        return NextResponse.json({ error: 'הלקוח שנבחר אינו שייך לסביבת העבודה שנבחרה' }, { status: 400 })
      }
    } else if (client) {
      try {
        const c = await findOrCreateClient(client, workspaceId)
        clientId = c.id
      } catch { /* non-fatal — campaign still stores client name */ }
    }

    const campaign = await createCampaign({
      client,
      campaign_name,
      slug,
      concept: concept || undefined,
      logo_path: logo_path || undefined,
      sections: sections || undefined,
      status: status || 'draft',
      publish_at: publish_at || null,
      password: password || undefined,
      created_by: session.userId,
      workspace_id: workspaceId || undefined,
      client_id: clientId,
    })

    await logAudit({ actor: session, action: 'create', entity_type: 'campaign', entity_id: campaign.id, entity_label: campaign.campaign_name, workspace_id: workspaceId })
    return NextResponse.json({ ...campaign, has_password: !!campaign.password, password: undefined }, { status: 201 })
  } catch (err) {
    captureException(err, { route: 'POST /api/campaigns' })
    return NextResponse.json({ error: 'שגיאה ביצירת קמפיין' }, { status: 500 })
  }
}
