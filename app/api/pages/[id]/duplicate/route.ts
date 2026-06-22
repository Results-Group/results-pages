import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getPageById, createPage, downloadFile, uploadFile, getPageByClientSlug } from '@/lib/db'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = await downloadFile(page.file_path)
  if (!html) return NextResponse.json({ error: 'HTML file not found in storage' }, { status: 404 })

  let newSlug = `${page.slug}-copy`
  let attempt = 1
  while (await getPageByClientSlug(page.client, newSlug)) {
    attempt++
    newSlug = `${page.slug}-copy-${attempt}`
  }

  const newFilePath = `${page.client}/${newSlug}.html`
  const newSourcePath = `${page.client}/${newSlug}.source.html`

  const uploads: Promise<void>[] = [
    uploadFile(newFilePath, Buffer.from(html, 'utf-8')),
  ]

  const sourcePath = page.file_path.replace(/\.html$/, '.source.html')
  const sourceHtml = await downloadFile(sourcePath)
  if (sourceHtml) {
    uploads.push(uploadFile(newSourcePath, Buffer.from(sourceHtml, 'utf-8')))
  }

  await Promise.all(uploads)

  const newPage = await createPage({
    client: page.client,
    slug: newSlug,
    title: `${page.title} (עותק)`,
    file_path: newFilePath,
    expires_at: page.expires_at,
  })

  return NextResponse.json(newPage, { status: 201 })
}
