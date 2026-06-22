import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const client = (formData.get('client') as string)?.trim().toLowerCase().replace(/\s+/g, '-')
  const title = (formData.get('title') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-').replace(/\.html$/, '')
  const expiresAt = formData.get('expiresAt') as string | null

  if (!file || !client || !title || !slug) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  if (!file.name.endsWith('.html') && !file.type.includes('html')) {
    return NextResponse.json({ error: 'ניתן להעלות קבצי HTML בלבד' }, { status: 400 })
  }

  // Check for duplicates
  const existing = await prisma.page.findUnique({ where: { client_slug: { client, slug } } })
  if (existing) {
    return NextResponse.json({ error: `דף "${slug}" כבר קיים עבור ${client}` }, { status: 409 })
  }

  // Save file
  const dir = join(process.cwd(), 'public', 'pages', client)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })

  const filePath = `pages/${client}/${slug}.html`
  const fullPath = join(process.cwd(), 'public', filePath)
  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)

  // Save to DB
  const page = await prisma.page.create({
    data: {
      client,
      slug,
      title,
      filePath,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  })

  return NextResponse.json(page, { status: 201 })
}
