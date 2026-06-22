import { NextRequest, NextResponse } from 'next/server'
import { getPageById, updatePage, deletePage, moveFile, deleteFile } from '@/lib/db'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(page)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
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
    try {
      await moveFile(existing.file_path, newFilePath)
    } catch {
      // File may not exist yet in storage
    }
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

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await deleteFile(page.file_path)
  } catch {
    // File may already be deleted
  }

  await deletePage(id)
  return NextResponse.json({ ok: true })
}
