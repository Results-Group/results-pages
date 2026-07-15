import { NextRequest, NextResponse } from 'next/server'
import { getPages, createPage } from '@/lib/db'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { findOrCreateClient } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'
import { parseJson } from '@/lib/http'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const client = searchParams.get('client') || undefined
  const search = searchParams.get('search') || undefined
  const deleted = searchParams.get('deleted') === '1'
  const workspaceId = searchParams.get('workspace_id') || await getActiveWorkspaceId(req) || undefined

  if (workspaceId) {
    const permErr = await requireWorkspacePermission(req, workspaceId, 'view')
    if (permErr) return permErr
  } else if (!session.isOwner && session.role !== 'admin') {
    return NextResponse.json([])
  }

  const pages = await getPages({ client, search, workspace_id: workspaceId, deleted })
  const safe = pages.map(p => ({ ...p, has_password: !!p.password, password: undefined }))
  return NextResponse.json(safe)
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

  const { data: body, error: parseError } = await parseJson<Record<string, string>>(req)
  if (parseError) return parseError
  const { client, slug, title, filePath, expiresAt, publishAt } = body

  if (!client || !slug || !title || !filePath) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  let clientId: string | null = body.client_id || null
  if (!clientId && client) {
    try {
      const c = await findOrCreateClient(client, workspaceId)
      clientId = c.id
    } catch { /* non-fatal */ }
  }

  try {
    const page = await createPage({
      client,
      slug,
      title,
      file_path: filePath,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      publish_at: publishAt ? new Date(publishAt).toISOString() : null,
      created_by: session.userId,
      workspace_id: workspaceId || undefined,
      client_id: clientId,
    })

    await logAudit({ actor: session, action: 'create', entity_type: 'page', entity_id: page.id, entity_label: page.title, workspace_id: workspaceId })
    return NextResponse.json({ ...page, has_password: !!page.password, password: undefined }, { status: 201 })
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      return NextResponse.json({ error: 'קיים דף עם כתובת זהה (ייתכן בסל המיחזור)' }, { status: 409 })
    }
    captureException(err, { route: 'POST /api/pages' })
    return NextResponse.json({ error: 'שגיאה ביצירת הדף' }, { status: 500 })
  }
}
