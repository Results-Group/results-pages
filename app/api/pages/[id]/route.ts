import { NextRequest, NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, purgePage, moveFile, getPageByShortUrl } from '@/lib/db'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { findOrCreateClient } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const permErr = await requireResourcePermission(req, page.workspace_id, 'view')
  if (permErr) return permErr
  return NextResponse.json({ ...page, has_password: !!page.password, password: undefined })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const existing = await getPageById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, existing.workspace_id, 'edit')
  if (permErr) return permErr

  const body = await req.json()
  const { title, client, slug, active, expiresAt, publishAt, password, shortUrl, workspace_id } = body

  // Moving the page to another workspace requires permission there too
  if (workspace_id !== undefined && workspace_id !== existing.workspace_id) {
    const moveErr = await requireResourcePermission(req, workspace_id, 'edit')
    if (moveErr) return moveErr
  }
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
    const candidatePath = `${newClient}/${newSlug}.html`

    const oldSourcePath = existing.file_path.replace(/\.html$/, '.source.html')
    const newSourcePath = candidatePath.replace(/\.html$/, '.source.html')

    // The primary file move must succeed — otherwise updating file_path would
    // point the page at a file that doesn't exist (serving a 404).
    try {
      await moveFile(existing.file_path, candidatePath)
    } catch (err) {
      captureException(err, { route: 'PUT /api/pages/[id] moveFile', id })
      return NextResponse.json({ error: 'שגיאה בהעברת קובץ הדף — לא בוצע שינוי' }, { status: 500 })
    }
    // The source file is best-effort (older pages may not have one)
    await moveFile(oldSourcePath, newSourcePath).catch(() => {})
    newFilePath = candidatePath
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
  return NextResponse.json({ ...page, has_password: !!page.password, password: undefined })
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, page.workspace_id, 'delete')
  if (permErr) return permErr

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
