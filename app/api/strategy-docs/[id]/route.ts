import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionFromRequest, requireResourcePermission, requireWorkspacePermission,
} from '@/lib/auth'
import {
  getStrategyDocById, updateStrategyDoc, deleteStrategyDoc, purgeStrategyDoc,
  StrategyDocConflictError,
} from '@/lib/strategy-docs'
import { normalizeSections } from '@/lib/strategy/normalize'
import { findOrCreateClient } from '@/lib/clients'
import { requirePurgeConfirmation } from '@/lib/purge-guard'
import { slugifyPath } from '@/lib/slug'
import { parseJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const doc = await getStrategyDocById(id)
  if (!doc) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

  const permErr = await requireResourcePermission(request, doc.workspace_id, 'view')
  if (permErr) return permErr

  return NextResponse.json(doc)
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getStrategyDocById(id)
  if (!existing) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

  const permErr = await requireResourcePermission(request, existing.workspace_id, 'edit')
  if (permErr) return permErr

  const { data: body, error: parseError } = await parseJson<{
    client?: string
    client_id?: string | null
    doc_name?: string
    slug?: string
    sections?: unknown
    status?: 'draft' | 'published' | 'archived'
    workspace_id?: string | null
    base_updated_at?: string
  }>(request)
  if (parseError) return parseError

  // Moving a document into another workspace needs edit rights on the target
  // too, not just on the one it is leaving.
  if (body.workspace_id && body.workspace_id !== existing.workspace_id) {
    const targetErr = await requireWorkspacePermission(request, body.workspace_id, 'edit')
    if (targetErr) return targetErr
  }

  const patch: Parameters<typeof updateStrategyDoc>[1] = {}
  if (body.client !== undefined) patch.client = body.client.trim()
  if (body.doc_name !== undefined) patch.doc_name = body.doc_name.trim()
  if (body.slug !== undefined) patch.slug = slugifyPath(body.slug, '') || existing.slug
  if (body.status !== undefined) patch.status = body.status
  if (body.workspace_id !== undefined) patch.workspace_id = body.workspace_id
  // Normalized on the way in as well as on the way out: the API is the trust
  // boundary, and a hand-rolled request must not be able to store a section
  // shape the renderer would choke on.
  if (body.sections !== undefined) patch.sections = normalizeSections(body.sections)

  if (body.client_id !== undefined) {
    patch.client_id = body.client_id
  } else if (body.client && !existing.client_id) {
    // Self-heal the link the same way the campaigns route does.
    try {
      const record = await findOrCreateClient(body.client.trim(), body.workspace_id ?? existing.workspace_id)
      patch.client_id = record.id
    } catch { /* non-fatal */ }
  }

  try {
    const doc = await updateStrategyDoc(id, patch, { baseUpdatedAt: body.base_updated_at })
    const action = body.status === 'published' && existing.status !== 'published' ? 'publish' : 'update'
    await logAudit({
      actor: session, action, entity_type: 'strategy_doc',
      entity_id: doc.id, entity_label: doc.doc_name, workspace_id: doc.workspace_id || undefined,
    })
    return NextResponse.json(doc)
  } catch (err) {
    if (err instanceof StrategyDocConflictError) {
      return NextResponse.json(
        { error: 'המסמך עודכן במקום אחר. רענן את הדף כדי לראות את הגרסה העדכנית.' },
        { status: 409 },
      )
    }
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'כתובת זהה כבר קיימת' }, { status: 409 })
    }
    captureException(err, { route: 'PUT /api/strategy-docs/[id]', id })
    return NextResponse.json({ error: 'שגיאה בשמירת המסמך' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getStrategyDocById(id)
  if (!existing) return NextResponse.json({ error: 'המסמך לא נמצא' }, { status: 404 })

  const permErr = await requireResourcePermission(request, existing.workspace_id, 'delete')
  if (permErr) return permErr

  const purge = new URL(request.url).searchParams.get('purge') === '1'

  try {
    if (purge) {
      // Owner/admin only, and the exact name must be typed back — the same
      // guard the other purge routes use.
      const guardErr = await requirePurgeConfirmation(request, existing.doc_name)
      if (guardErr) return guardErr
      await purgeStrategyDoc(id)
    } else {
      await deleteStrategyDoc(id)
    }
    await logAudit({
      actor: session, action: purge ? 'purge' : 'delete', entity_type: 'strategy_doc',
      entity_id: id, entity_label: existing.doc_name, workspace_id: existing.workspace_id || undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    captureException(err, { route: 'DELETE /api/strategy-docs/[id]', id, purge })
    return NextResponse.json({ error: 'שגיאה במחיקת המסמך' }, { status: 500 })
  }
}
