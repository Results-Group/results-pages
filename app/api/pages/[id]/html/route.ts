import { NextRequest, NextResponse } from 'next/server'
import { getPageById, downloadFile, uploadFile } from '@/lib/db'

interface Ctx { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
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

  const buffer = Buffer.from(htmlContent, 'utf-8')
  await uploadFile(page.file_path, buffer)

  return NextResponse.json({ ok: true, filePath: page.file_path })
}
