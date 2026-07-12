import { NextRequest, NextResponse } from 'next/server'
import { getPageByClientSlug, getPageByShortUrl, createPage, uploadFile, purgePage } from '@/lib/db'
import { getSessionFromRequest, getActiveWorkspaceId, requireWorkspacePermission } from '@/lib/auth'
import { findOrCreateClient } from '@/lib/clients'
import { logAudit } from '@/lib/audit'
import { minifyHtml } from '@/lib/minify'

export const runtime = 'nodejs'
export const maxDuration = 60

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

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const rawClient = (formData.get('client') as string)?.trim()
  // Slugified only for URL/storage path — the raw name stays the client entity name
  const client = rawClient?.toLowerCase().replace(/\s+/g, '-')
  const title = (formData.get('title') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-').replace(/\.html$/, '')
  const expiresAt = formData.get('expiresAt') as string | null
  const password = (formData.get('password') as string)?.trim() || null
  const shortUrl = (formData.get('shortUrl') as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null
  let clientId = ((formData.get('client_id') as string) || (formData.get('clientId') as string))?.trim() || null

  if (!file || !client || !title || !slug) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  if (!file.name.endsWith('.html') && !file.type.includes('html')) {
    return NextResponse.json({ error: 'ניתן להעלות קבצי HTML בלבד' }, { status: 400 })
  }

  const MAX_HTML_BYTES = 10 * 1024 * 1024 // 10 MB — landing-page HTML is small
  if (file.size > MAX_HTML_BYTES) {
    return NextResponse.json({ error: 'הקובץ גדול מדי (מקסימום 10 MB)' }, { status: 413 })
  }

  // Check conflicts including soft-deleted rows — the DB unique constraints
  // cover trashed pages too, and uploading over their storage path would
  // destroy the trashed page's file.
  const existing = await getPageByClientSlug(client, slug, { includeDeleted: true })
  if (existing) {
    if (existing.deleted_at) {
      return NextResponse.json({ error: 'קיים דף עם כתובת זהה (ייתכן בסל המיחזור)' }, { status: 409 })
    }
    return NextResponse.json({ error: `דף "${slug}" כבר קיים עבור ${client}` }, { status: 409 })
  }

  if (shortUrl) {
    const shortConflict = await getPageByShortUrl(shortUrl, { includeDeleted: true })
    if (shortConflict) {
      return NextResponse.json({ error: 'קישור קצר זה כבר בשימוש (ייתכן בסל המיחזור)' }, { status: 409 })
    }
  }

  const originalHtml = await file.text()
  const filePath = `${client}/${slug}.html`
  const sourcePath = `${client}/${slug}.source.html`

  if (!clientId && rawClient) {
    try {
      const c = await findOrCreateClient(rawClient, workspaceId)
      clientId = c.id
    } catch { /* non-fatal */ }
  }

  // Insert the row first — if the DB rejects (e.g. unique conflict with a
  // trashed page) no storage file has been overwritten yet.
  const page = await createPage({
    client,
    slug,
    title,
    file_path: filePath,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    password,
    short_url: shortUrl,
    created_by: session.userId,
    workspace_id: workspaceId || undefined,
    client_id: clientId,
  })

  try {
    await Promise.all([
      uploadFile(filePath, Buffer.from(minifyHtml(originalHtml), 'utf-8')),
      uploadFile(sourcePath, Buffer.from(originalHtml, 'utf-8')),
    ])
  } catch {
    await purgePage(page.id).catch(() => {})
    return NextResponse.json({ error: 'שגיאה בהעלאת הקובץ' }, { status: 500 })
  }

  await logAudit({ actor: session, action: 'create', entity_type: 'page', entity_id: page.id, entity_label: page.title, workspace_id: workspaceId || undefined })
  return NextResponse.json(page, { status: 201 })
}
