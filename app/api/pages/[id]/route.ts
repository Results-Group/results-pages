import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { unlink, rename } from 'fs/promises'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await prisma.page.findUnique({
    where: { id },
    include: { _count: { select: { views: true } } },
  })
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(page)
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const body = await req.json()
  const { title, client, slug, active, expiresAt } = body

  const existing = await prisma.page.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If client or slug changed, move the file
  const needsMove = (client && client !== existing.client) || (slug && slug !== existing.slug)
  let newFilePath = existing.filePath

  if (needsMove) {
    const newClient = client || existing.client
    const newSlug = slug || existing.slug
    newFilePath = `pages/${newClient}/${newSlug}.html`
    const oldFull = join(process.cwd(), 'public', existing.filePath)
    const newDir = join(process.cwd(), 'public', 'pages', newClient)
    const newFull = join(newDir, `${newSlug}.html`)

    if (!existsSync(newDir)) mkdirSync(newDir, { recursive: true })
    if (existsSync(oldFull)) await rename(oldFull, newFull)
  }

  const page = await prisma.page.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(client !== undefined && { client }),
      ...(slug !== undefined && { slug }),
      ...(active !== undefined && { active }),
      ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      filePath: newFilePath,
    },
  })

  return NextResponse.json(page)
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  const page = await prisma.page.findUnique({ where: { id } })
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete the file
  const fileFull = join(process.cwd(), 'public', page.filePath)
  try { await unlink(fileFull) } catch {}

  await prisma.page.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
