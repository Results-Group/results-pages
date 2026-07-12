import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { getClients, createClient, getClientByName } from '@/lib/clients'
import { supabase } from '@/lib/supabase'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

const BRAND_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = req.nextUrl.searchParams.get('workspace_id') || await getActiveWorkspaceId(req)

  if (workspaceId) {
    const permErr = await requireWorkspacePermission(req, workspaceId, 'view')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role !== 'admin') {
    // No workspace scope: only admins/owners may list all clients
    return NextResponse.json([])
  }

  try {
    const clients = await getClients(workspaceId)
    const clientIds = clients.map(c => c.id)

    const [{ data: campCounts }, { data: pageCounts }] = await Promise.all([
      supabase.from('campaigns').select('client_id').is('deleted_at', null).in('client_id', clientIds),
      supabase.from('pages').select('client_id').is('deleted_at', null).in('client_id', clientIds),
    ])

    const campMap: Record<string, number> = {}
    const pageMap: Record<string, number> = {}
    for (const c of campCounts || []) campMap[c.client_id] = (campMap[c.client_id] || 0) + 1
    for (const p of pageCounts || []) pageMap[p.client_id] = (pageMap[p.client_id] || 0) + 1

    return NextResponse.json(
      clients.map(c => ({
        id: c.id,
        name: c.name,
        logo_url: c.logo_url || null,
        brand_color: c.brand_color,
        workspace_id: c.workspace_id,
        campaign_count: campMap[c.id] || 0,
        page_count: pageMap[c.id] || 0,
        contacts_count: (c.contacts || []).length,
      })),
    )
  } catch (err) {
    captureException(err, { route: 'GET /api/clients' })
    return NextResponse.json([], { status: 200 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getActiveWorkspaceId(req)
  if (workspaceId) {
    const permErr = await requireWorkspacePermission(req, workspaceId, 'create')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role === 'viewer') {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const name = (body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'שם לקוח הוא שדה חובה' }, { status: 400 })
    if (body.brand_color !== undefined && body.brand_color !== null && !BRAND_COLOR_RE.test(String(body.brand_color))) {
      return NextResponse.json({ error: 'צבע מותג לא תקין' }, { status: 400 })
    }

    const existing = await getClientByName(name, workspaceId)
    if (existing) return NextResponse.json(existing, { status: 200 })

    const client = await createClient({
      name,
      workspace_id: workspaceId,
      brand_color: body.brand_color,
      contacts: body.contacts,
      notes: body.notes,
    })
    await logAudit({ actor: session, action: 'create', entity_type: 'client', entity_id: client.id, entity_label: client.name, workspace_id: workspaceId })
    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    captureException(err, { route: 'POST /api/clients' })
    return NextResponse.json({ error: 'שגיאה ביצירת לקוח' }, { status: 500 })
  }
}
