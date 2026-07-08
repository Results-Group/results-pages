import { NextRequest, NextResponse } from 'next/server'
import { getPageByClientSlug, getPageByShortUrl, createPage, uploadFile } from '@/lib/db'
import { requireRole, getSessionFromRequest } from '@/lib/auth'
import { minifyHtml } from '@/lib/minify'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const roleErr = await requireRole(req, 'editor')
  if (roleErr) return roleErr

  const session = await getSessionFromRequest(req)
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const client = (formData.get('client') as string)?.trim().toLowerCase().replace(/\s+/g, '-')
  const title = (formData.get('title') as string)?.trim()
  const slug = (formData.get('slug') as string)?.trim().toLowerCase().replace(/\s+/g, '-').replace(/\.html$/, '')
  const expiresAt = formData.get('expiresAt') as string | null
  const password = (formData.get('password') as string)?.trim() || null
  const shortUrl = (formData.get('shortUrl') as string)?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || null

  if (!file || !client || !title || !slug) {
    return NextResponse.json({ error: 'חסרים שדות חובה' }, { status: 400 })
  }

  if (!file.name.endsWith('.html') && !file.type.includes('html')) {
    return NextResponse.json({ error: 'ניתן להעלות קבצי HTML בלבד' }, { status: 400 })
  }

  const existing = await getPageByClientSlug(client, slug)
  if (existing) {
    return NextResponse.json({ error: `דף "${slug}" כבר קיים עבור ${client}` }, { status: 409 })
  }

  if (shortUrl) {
    const shortConflict = await getPageByShortUrl(shortUrl)
    if (shortConflict) {
      return NextResponse.json({ error: 'קישור קצר זה כבר בשימוש' }, { status: 409 })
    }
  }

  const originalHtml = await file.text()
  const filePath = `${client}/${slug}.html`
  const sourcePath = `${client}/${slug}.source.html`

  await Promise.all([
    uploadFile(filePath, Buffer.from(minifyHtml(originalHtml), 'utf-8')),
    uploadFile(sourcePath, Buffer.from(originalHtml, 'utf-8')),
  ])

  const page = await createPage({
    client,
    slug,
    title,
    file_path: filePath,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    password,
    short_url: shortUrl,
    created_by: session?.userId !== 'legacy' ? session?.userId : undefined,
  })

  return NextResponse.json(page, { status: 201 })
}
