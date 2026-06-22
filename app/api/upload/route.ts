import { NextRequest, NextResponse } from 'next/server'
import { getPageByClientSlug, createPage, uploadFile } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const authError = requireAuth(req)
  if (authError) return authError

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

  const existing = await getPageByClientSlug(client, slug)
  if (existing) {
    return NextResponse.json({ error: `דף "${slug}" כבר קיים עבור ${client}` }, { status: 409 })
  }

  const filePath = `${client}/${slug}.html`
  const buffer = Buffer.from(await file.arrayBuffer())
  await uploadFile(filePath, buffer)

  const page = await createPage({
    client,
    slug,
    title,
    file_path: filePath,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
  })

  return NextResponse.json(page, { status: 201 })
}
