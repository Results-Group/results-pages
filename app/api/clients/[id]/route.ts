import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireWorkspacePermission, type SessionUser } from '@/lib/auth'
import { getClientById, updateClient, deleteClient, uploadClientLogo, type ClientContact } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

const BRAND_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export async function GET(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const client = await getClientById(id)
  if (!client) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })
  if (client.workspace_id) {
    const permErr = await requireWorkspacePermission(req, client.workspace_id, 'view')
    if (permErr) return permErr
  }
  return NextResponse.json(client)
}

async function ensurePermission(
  req: NextRequest,
  workspaceId: string | null,
  action: 'edit' | 'delete',
): Promise<{ session: SessionUser; error: null } | { session: null; error: NextResponse }> {
  const session = await getSessionFromRequest(req)
  if (!session) return { session: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (workspaceId) {
    const permErr = await requireWorkspacePermission(req, workspaceId, action)
    if (permErr) return { session: null, error: permErr }
  } else if (!session.isOwner && session.role === 'viewer') {
    return { session: null, error: NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 }) }
  }
  return { session, error: null }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const existing = await getClientById(id)
  if (!existing) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })

  const { session, error: permErr } = await ensurePermission(req, existing.workspace_id, 'edit')
  if (permErr) return permErr

  try {
    const contentType = req.headers.get('content-type') || ''

    // Multipart → logo upload (+ optional fields)
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      const updates: Record<string, unknown> = {}

      const logo = form.get('logo')
      if (logo && logo instanceof Blob && logo.size > 0) {
        updates.logo_path = await uploadClientLogo(logo, id)
      }
      const name = form.get('name')
      if (typeof name === 'string' && name.trim()) updates.name = name.trim()
      const brandColor = form.get('brand_color')
      if (typeof brandColor === 'string') {
        if (!BRAND_COLOR_RE.test(brandColor)) {
          return NextResponse.json({ error: 'צבע מותג לא תקין' }, { status: 400 })
        }
        updates.brand_color = brandColor
      }
      const notes = form.get('notes')
      if (typeof notes === 'string') updates.notes = notes
      const contacts = form.get('contacts')
      if (typeof contacts === 'string') {
        try { updates.contacts = JSON.parse(contacts) as ClientContact[] } catch { /* ignore */ }
      }

      const client = await updateClient(id, updates)
      await logAudit({ actor: session, action: 'update', entity_type: 'client', entity_id: id, entity_label: client.name, workspace_id: client.workspace_id })
      return NextResponse.json(client)
    }

    // JSON metadata update
    const body = await req.json()
    if (body.brand_color !== undefined && body.brand_color !== null && !BRAND_COLOR_RE.test(String(body.brand_color))) {
      return NextResponse.json({ error: 'צבע מותג לא תקין' }, { status: 400 })
    }
    // Moving the client to another workspace requires permission there too
    if (body.workspace_id !== undefined && body.workspace_id !== existing.workspace_id && body.workspace_id) {
      const targetErr = await requireWorkspacePermission(req, body.workspace_id, 'edit')
      if (targetErr) return targetErr
    }
    const client = await updateClient(id, {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.brand_color !== undefined && { brand_color: body.brand_color }),
      ...(body.contacts !== undefined && { contacts: body.contacts }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.logo_path !== undefined && { logo_path: body.logo_path }),
      ...(body.workspace_id !== undefined && { workspace_id: body.workspace_id }),
    })
    await logAudit({ actor: session, action: 'update', entity_type: 'client', entity_id: id, entity_label: client.name, workspace_id: client.workspace_id })
    return NextResponse.json(client)
  } catch (err) {
    captureException(err, { route: 'PUT /api/clients/[id]', id })
    return NextResponse.json({ error: 'שגיאה בעדכון לקוח' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const existing = await getClientById(id)
  if (!existing) return NextResponse.json({ error: 'לקוח לא נמצא' }, { status: 404 })

  const { session, error: permErr } = await ensurePermission(req, existing.workspace_id, 'delete')
  if (permErr) return permErr

  try {
    await deleteClient(id)
    await logAudit({ actor: session, action: 'delete', entity_type: 'client', entity_id: id, entity_label: existing.name, workspace_id: existing.workspace_id })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/clients/[id]', id })
    return NextResponse.json({ error: 'שגיאה במחיקת לקוח' }, { status: 500 })
  }
}
