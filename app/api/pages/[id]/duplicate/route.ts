import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest, requireResourcePermission } from '@/lib/auth'
import { getPageById, createPage, downloadFile, uploadFile, getPageByClientSlug } from '@/lib/db'
import { captureException } from '@/lib/logger'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSessionFromRequest(req)

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const permErr = await requireResourcePermission(req, page.workspace_id, 'create')
  if (permErr) return permErr

  const html = await downloadFile(page.file_path)
  if (!html) return NextResponse.json({ error: 'HTML file not found in storage' }, { status: 404 })

  // Find a free slug, including soft-deleted rows — the unique constraint and
  // the derived storage path both collide with trashed pages otherwise.
  let newSlug = `${page.slug}-copy`
  let attempt = 1
  while (await getPageByClientSlug(page.client, newSlug, { includeDeleted: true })) {
    attempt++
    newSlug = `${page.slug}-copy-${attempt}`
  }

  const newFilePath = `${page.client}/${newSlug}.html`
  const newSourcePath = `${page.client}/${newSlug}.source.html`

  try {
    // Insert the row first — if the DB rejects it, no storage file is written.
    const newPage = await createPage({
      client: page.client,
      slug: newSlug,
      title: `${page.title} (עותק)`,
      file_path: newFilePath,
      expires_at: page.expires_at,
      created_by: session?.userId && session.userId !== 'legacy' ? session.userId : undefined,
      workspace_id: page.workspace_id || undefined,
      client_id: page.client_id,
    })

    const uploads: Promise<void>[] = [
      uploadFile(newFilePath, Buffer.from(html, 'utf-8')),
    ]
    const sourcePath = page.file_path.replace(/\.html$/, '.source.html')
    const sourceHtml = await downloadFile(sourcePath)
    if (sourceHtml) {
      uploads.push(uploadFile(newSourcePath, Buffer.from(sourceHtml, 'utf-8')))
    }
    await Promise.all(uploads)

    return NextResponse.json(newPage, { status: 201 })
  } catch (err) {
    captureException(err, { route: 'POST /api/pages/[id]/duplicate', id })
    return NextResponse.json({ error: 'שגיאה בשכפול הדף' }, { status: 500 })
  }
}
