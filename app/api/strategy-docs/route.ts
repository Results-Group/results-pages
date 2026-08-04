import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { getStrategyDocs, createStrategyDoc } from '@/lib/strategy-docs'
import { createBrandPositioningTemplate } from '@/lib/strategy/template'
import { findOrCreateClient, getClientById } from '@/lib/clients'
import { slugifyPath } from '@/lib/slug'
import { parseJson } from '@/lib/http'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search') || undefined
  const deleted = searchParams.get('deleted') === '1'
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
    const docs = await getStrategyDocs({ workspaceId, deleted, search })
    // The list only needs the count, and a document's sections are large.
    const summary = docs.map(({ sections, ...rest }) => ({ ...rest, section_count: sections.length }))
    return NextResponse.json(summary)
  } catch (err) {
    captureException(err, { route: 'GET /api/strategy-docs', workspaceId })
    return NextResponse.json({ error: 'שגיאה בטעינת מסמכי האסטרטגיה' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: body, error: parseError } = await parseJson<{
    client?: string
    client_id?: string | null
    doc_name?: string
    slug?: string
    workspace_id?: string | null
    /** Omit or pass true for the full brand-positioning template. */
    from_template?: boolean
  }>(request)
  if (parseError) return parseError

  const workspaceId = body.workspace_id ?? await getActiveWorkspaceId(request)
  if (workspaceId) {
    const permErr = await requireWorkspacePermission(request, workspaceId, 'create')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role === 'viewer') {
    return NextResponse.json({ error: 'אין הרשאה לפעולה זו' }, { status: 403 })
  }

  const client = (body.client || '').trim()
  const docName = (body.doc_name || '').trim()
  if (!client || !docName) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  // A random suffix rather than a uniqueness probe + retry: two documents for
  // the same client would otherwise race onto the same slug.
  const base = slugifyPath(body.slug || docName, '') || 'strategy'
  const slug = body.slug ? base : `${base}-${crypto.randomUUID().slice(0, 6)}`

  try {
    let clientId = body.client_id || null
    if (!clientId) {
      // Best-effort: branding falls back to the plain name if this fails.
      try {
        const record = await findOrCreateClient(client, workspaceId)
        clientId = record.id
      } catch { /* non-fatal */ }
    } else if (!(await getClientById(clientId))) {
      clientId = null
    }

    const doc = await createStrategyDoc({
      client,
      doc_name: docName,
      slug,
      client_id: clientId,
      workspace_id: workspaceId,
      created_by: session.userId,
      sections: body.from_template === false ? [] : createBrandPositioningTemplate(),
    })

    await logAudit({
      actor: session, action: 'create', entity_type: 'strategy_doc',
      entity_id: doc.id, entity_label: doc.doc_name, workspace_id: workspaceId || undefined,
    })
    return NextResponse.json(doc, { status: 201 })
  } catch (err) {
    // The live-slug unique index is the only way two concurrent creates can
    // collide; say so rather than returning a bare 500.
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'כתובת זהה כבר קיימת' }, { status: 409 })
    }
    captureException(err, { route: 'POST /api/strategy-docs' })
    return NextResponse.json({ error: 'שגיאה ביצירת המסמך' }, { status: 500 })
  }
}
