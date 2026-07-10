import { NextRequest, NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, purgePage, moveFile, getPageByShortUrl } from '@/lib/db'
import { requireAuth, getSessionFromRequest, requireWorkspacePermission } from '@/lib/auth'
import { findOrCreateClient } from '@/lib/clients'
import { logAudit } from '@/lib/audit'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const authError = await requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ...page, has_password: !!page.password, password: undefined })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getPageById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (existing.workspace_id) {
    const permErr = await requireWorkspacePermission(req, existing.workspace_id, 'edit')
    if (permErr) return permErr
  }

  const body = await req.json()
  const { title, client, slug, active, expiresAt, publishAt, password, shortUrl, workspace_id } = body
  let clientId: string | null | undefined = body.client_id
  if (clientId === undefined && client && client !== existing.client) {
    try {
      const c = await findOrCreateClient(client, workspace_id ?? existing.workspace_id)
      clientId = c.id
    } catch { /* non-fatal */ }
  }

  if (shortUrl !== undefined && shortUrl) {
    // Include soft-deleted rows — the unique constraint covers them too
    const conflict = await getPageByShortUrl(shortUrl, { includeDeleted: true })
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ error: 'קישור קצר זה כבר בשימוש (ייתכן בסל המיחזור)' }, { status: 409 })
    }
  }

  const needsMove = (client && client !== existing.client) || (slug && slug !== existing.slug)
  let newFilePath = existing.file_path

  if (needsMove) {
    const newClient = client || existing.client
    const newSlug = slug || existing.slug
    newFilePath = `${newClient}/${newSlug}.html`

    const oldSourcePath = existing.file_path.replace(/\.html$/, '.source.html')
    const newSourcePath = newFilePath.replace(/\.html$/, '.source.html')

    const moves = [
      moveFile(existing.file_path, newFilePath).catch(() => {}),
      moveFile(oldSourcePath, newSourcePath).catch(() => {}),
    ]
    await Promise.all(moves)
  }

  const page = await updatePage(id, {
    ...(title !== undefined && { title }),
    ...(client !== undefined && { client }),
    ...(slug !== undefined && { slug }),
    ...(active !== undefined && { active }),
    ...(expiresAt !== undefined && { expires_at: expiresAt ? new Date(expiresAt).toISOString() : null }),
    ...(publishAt !== undefined && { publish_at: publishAt ? new Date(publishAt).toISOString() : null }),
    ...(password !== undefined && { password: password || null }),
    ...(shortUrl !== undefined && { short_url: shortUrl || null }),
    ...(workspace_id !== undefined && { workspace_id }),
    ...(clientId !== undefined && { client_id: clientId }),
    file_path: newFilePath,
    updated_by: session.userId,
  })

  await logAudit({ actor: session, action: 'update', entity_type: 'page', entity_id: id, entity_label: page.title, workspace_id: page.workspace_id })
  return NextResponse.json(page)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (page.workspace_id) {
    const permErr = await requireWorkspacePermission(req, page.workspace_id, 'delete')
    if (permErr) return permErr
  }

  // ?purge=1 permanently deletes (files + row); default is a reversible soft-delete.
  const purge = new URL(req.url).searchParams.get('purge') === '1'
  if (purge) {
    await purgePage(id)
  } else {
    await deletePage(id)
  }
  await logAudit({ actor: session, action: purge ? 'purge' : 'delete', entity_type: 'page', entity_id: id, entity_label: page.title, workspace_id: page.workspace_id })
  return NextResponse.json({ ok: true, purged: purge })
}
