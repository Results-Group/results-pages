import { NextRequest, NextResponse } from 'next/server'
import { getPageById, downloadFile, uploadFile, createVersion } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const html = await downloadFile(page.file_path)
  if (html === null) {
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  }

  return NextResponse.json({ html, filePath: page.file_path })
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const authError = requireAuth(req)
  if (authError) return authError

  const { id } = await params
  const page = await getPageById(id)
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const contentType = req.headers.get('content-type') || ''

  let htmlContent: string

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!file.name.endsWith('.html') && !file.type.includes('html')) {
      return NextResponse.json({ error: 'ניתן להעלות קבצי HTML בלבד' }, { status: 400 })
    }
    htmlContent = await file.text()
  } else {
    const body = await req.json()
    if (!body.html || typeof body.html !== 'string') {
      return NextResponse.json({ error: 'No HTML content provided' }, { status: 400 })
    }
    htmlContent = body.html
  }

  // Save current file as a version before overwriting
  try {
    const currentHtml = await downloadFile(page.file_path)
    if (currentHtml) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const pathParts = page.file_path.replace('.html', '')
      const versionPath = `${pathParts}/versions/${timestamp}.html`
      await uploadFile(versionPath, Buffer.from(currentHtml, 'utf-8'))
      await createVersion(page.id, versionPath)
    }
  } catch {
    // Version save failed — continue with the update anyway
  }

  const buffer = Buffer.from(htmlContent, 'utf-8')
  await uploadFile(page.file_path, buffer)

  return NextResponse.json({ ok: true, filePath: page.file_path })
}
