import { NextRequest, NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, moveFile, deleteFile } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(page)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const body = await req.json()
  const { title, client, slug, active, expiresAt } = body

  const existing = await getPageById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
    file_path: newFilePath,
  })

  return NextResponse.json(page)
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const sourcePath = page.file_path.replace(/\.html$/, '.source.html')
    await Promise.all([
      deleteFile(page.file_path),
      deleteFile(sourcePath),
    ])
  } catch {
    // Files may already be deleted
  }

  await deletePage(id)
  return NextResponse.json({ ok: true })
}
